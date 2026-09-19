import React, { useState } from 'react';
import { LiveStream, UserProfile } from '../../types';
import { useLiveKitViewer } from '../../hooks/useLiveKitViewer';
import { sendLiveHeart } from '../../services/pulseDb';
import { Users, Heart, Volume2, VolumeX, RefreshCw, ChevronUp } from 'lucide-react';
import { formatCount } from '../../utils/formatters';
import { LIVE_THEME } from '../../constants/liveTheme';

interface LiveFeedSlideProps {
  stream: LiveStream;
  isActive: boolean;
  currentUser: UserProfile | null;
  onEnterRoom: () => void;
  onRequireAuth: () => void;
}

export const LiveFeedSlide: React.FC<LiveFeedSlideProps> = ({
  stream,
  isActive,
  currentUser,
  onEnterRoom,
  onRequireAuth
}) => {
  // Only opens a real LiveKit connection while this slide is the one
  // actually on screen — see useLiveKitViewer for why (feed-wide, not
  // per-slide, connection budget).
  const { videoRef, audioRef, isMuted, toggleMute, connecting, hasVideo } = useLiveKitViewer(stream.id, isActive);
  const [floatingHearts, setFloatingHearts] = useState<{ id: number; left: number }[]>([]);

  const handleHeart = () => {
    if (!currentUser) {
      onRequireAuth();
      return;
    }
    sendLiveHeart(stream.id, 1).catch(() => {});
    const newHeart = { id: Date.now() + Math.random(), left: Math.floor(Math.random() * 60) + 20 };
    setFloatingHearts(prev => [...prev.slice(-12), newHeart]);
  };

  return (
    <div
      data-slide-id={stream.id}
      className="relative w-full h-full shrink-0 snap-start overflow-hidden bg-black flex items-center justify-center"
    >
      {/* Video preview — only actually connected/playing while isActive.
          Muted at the element level always: LiveKit's audio track is
          attached to the separate <audio> element below, so this video
          element never carries sound of its own. */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover"
      />
      {/* Audio track lands here. Kept off-screen rather than omitted —
          without a mounted element for it, LiveKit has nowhere to attach
          the track and the mute button silently does nothing. */}
      <audio ref={audioRef} autoPlay className="hidden" />

      {/* Fallback: host avatar shown until the preview connects, or if this
          slide isn't active yet (avoids a jarring blank black rectangle) */}
      {!hasVideo && (
        <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ background: LIVE_THEME.backdropGradient }}>
          <img
            src={stream.hostAvatar}
            alt={stream.hostHandle}
            className="w-24 h-24 rounded-full object-cover border-4 border-white/10 mb-3"
          />
          {isActive && connecting ? (
            <div className="flex items-center gap-2 text-neutral-400 text-xs font-bold">
              <RefreshCw className="w-4 h-4 animate-spin" />
              Connecting...
            </div>
          ) : (
            <p className="text-neutral-400 text-xs font-bold">{stream.hostUsername}'s live stream</p>
          )}
        </div>
      )}

      {/* Top gradient + host info */}
      <div className="absolute top-0 left-0 right-0 p-3 pt-4 bg-gradient-to-b from-black/70 to-transparent flex items-center justify-between">
        <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-md px-2 py-1 rounded-full border border-white/10">
          <img src={stream.hostAvatar} alt={stream.hostHandle} className="w-5 h-5 rounded-full object-cover" />
          <span className="text-white text-[10.5px] font-bold">{stream.hostUsername}</span>
          <span
            className="ml-1 px-1.5 py-0.5 rounded-full text-[7.5px] font-black uppercase text-white flex items-center gap-0.5"
            style={{ background: LIVE_THEME.liveBadgeGradient }}
          >
            <span className="w-1 h-1 rounded-full bg-white animate-pulse" /> Live
          </span>
        </div>
        <div className="flex items-center gap-0.5 bg-black/40 backdrop-blur-md px-2 py-1 rounded-full border border-white/10 text-white text-[10px] font-bold">
          <Users className="w-3 h-3" />
          {formatCount(stream.viewerCount || 0)}
        </div>
      </div>

      {/* Floating hearts */}
      <div className="absolute right-3 bottom-32 w-14 h-56 pointer-events-none overflow-hidden">
        {floatingHearts.map(h => (
          <div
            key={h.id}
            style={{ left: `${h.left}%` }}
            className="absolute bottom-0 animate-bounce duration-1000 transform -translate-x-1/2 opacity-90 text-xl"
          >
            ❤️
          </div>
        ))}
      </div>

      {/* Bottom controls */}
      <div className="absolute bottom-0 left-0 right-0 p-3 pb-6 bg-gradient-to-t from-black/85 to-transparent flex items-end justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-white text-xs font-semibold truncate">{stream.title}</p>
          <button
            onClick={onEnterRoom}
            className="mt-2 flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-bold text-white cursor-pointer active:scale-95 transition-transform"
            style={{ background: LIVE_THEME.trendingGradient }}
          >
            <ChevronUp className="w-3.5 h-3.5" />
            Join Live Room
          </button>
        </div>

        <div className="flex flex-col items-center gap-2 shrink-0">
          <button
            onClick={toggleMute}
            className="w-9 h-9 rounded-full bg-black/50 backdrop-blur-md border border-white/10 text-white flex items-center justify-center cursor-pointer active:scale-90 transition-transform"
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <button
            onClick={handleHeart}
            className="w-10 h-10 rounded-full text-white flex items-center justify-center cursor-pointer active:scale-90 transition-transform shadow-md"
            style={{ background: LIVE_THEME.liveBadgeGradient }}
            title="Send Heart"
          >
            <Heart className="w-4.5 h-4.5 fill-white" />
          </button>
        </div>
      </div>
    </div>
  );
};
