import { useEffect, useRef, useState } from 'react';
import { Room, RoomEvent, Track, VideoPresets } from 'livekit-client';

interface UseLiveKitViewerResult {
  videoRef: React.RefObject<HTMLVideoElement>;
  audioRef: React.RefObject<HTMLAudioElement>;
  isMuted: boolean;
  toggleMute: () => void;
  connecting: boolean;
  hasVideo: boolean;
}

// Connects a read-only LiveKit viewer session for `streamId`, but only
// while `active` is true. In a vertical swipe feed you never want more
// than one (maybe two, adjacent) real WebRTC connections open at once —
// browsers and mobile devices choke on a dozen concurrent live video
// connections, and it wastes the host's viewer-count/bandwidth for
// streams nobody's actually looking at. The parent feed decides which
// slide is "active" (via IntersectionObserver) and flips this on/off.
//
// IMPORTANT: `audioRef` must be attached to a real <audio> element by the
// consumer (see LiveFeedSlide). LiveKit's audio track is attached to
// whatever element this ref points at — if nothing is mounted there, the
// audio track silently never plays and unmuting does nothing.
export function useLiveKitViewer(streamId: string | null | undefined, active: boolean): UseLiveKitViewerResult {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const roomRef = useRef<Room | null>(null);
  // Feed previews start muted for the same reason LiveStreamRoomModal's
  // viewer video does: browsers silently block unmuted autoplay, and a
  // scroll into view is not a "user gesture" as far as autoplay policy
  // is concerned. Tap the slide's unmute control to opt in to audio.
  const [isMuted, setIsMuted] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [hasVideo, setHasVideo] = useState(false);

  useEffect(() => {
    if (!active || !streamId) {
      // Leaving the active slide (or no stream): tear the connection down
      // rather than leaving it connected off-screen.
      if (roomRef.current) {
        roomRef.current.disconnect();
        roomRef.current = null;
      }
      setHasVideo(false);
      setConnecting(false);
      return;
    }

    let cancelled = false;

    const connect = async () => {
      try {
        setConnecting(true);
        const identity = `preview_${Math.random().toString(36).substring(7)}`;

        const res = await fetch('/api/livekit/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomName: `live_${streamId}`,
            participantIdentity: identity,
            participantName: 'Viewer',
            isPublisher: false
          })
        });
        const data = await res.json();
        if (cancelled) return;
        if (!data.success || !data.token) {
          setConnecting(false);
          return;
        }

        const room = new Room({
          adaptiveStream: true,
          dynacast: true,
          videoCaptureDefaults: { resolution: VideoPresets.h540.resolution }
        });
        roomRef.current = room;

        room.on(RoomEvent.TrackSubscribed, (track: Track) => {
          if (track.kind === Track.Kind.Video && videoRef.current) {
            const el = track.attach(videoRef.current);
            el.muted = true; // video element itself never carries sound
            el.play?.().catch(() => {});
            setHasVideo(true);
          } else if (track.kind === Track.Kind.Audio && audioRef.current) {
            const el = track.attach(audioRef.current);
            el.muted = isMuted;
            el.play?.().catch(() => {
              // Autoplay-with-sound blocked until a user gesture (the
              // unmute tap) — keep muted rather than failing silently
              // in a way that looks like a bug.
              setIsMuted(true);
            });
          }
        });

        room.on(RoomEvent.TrackUnsubscribed, (track: Track) => {
          track.detach();
          if (track.kind === Track.Kind.Video) setHasVideo(false);
        });

        await room.connect(data.url, data.token);
        if (cancelled) {
          room.disconnect();
          return;
        }
        setConnecting(false);
      } catch (e) {
        if (!cancelled) setConnecting(false);
      }
    };

    connect();

    return () => {
      cancelled = true;
      if (roomRef.current) {
        roomRef.current.disconnect();
        roomRef.current = null;
      }
      setHasVideo(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, streamId]);

  // Keep the attached audio element's mute state in sync with toggles.
  // (Video element is always muted at the element level — see above —
  // so only the audio element needs to track isMuted.)
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = isMuted;
      if (!isMuted) audioRef.current.play?.().catch(() => {});
    }
  }, [isMuted]);

  const toggleMute = () => setIsMuted(m => !m);

  return { videoRef, audioRef, isMuted, toggleMute, connecting, hasVideo };
}
