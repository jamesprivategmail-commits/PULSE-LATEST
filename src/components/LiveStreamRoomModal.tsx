import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Room, RoomEvent, VideoPresets, Track, RemoteParticipant, RemoteTrackPublication } from 'livekit-client';
import { UserProfile, LiveStream, LiveChatMessage, LivePoll, VirtualGift, GiftTransaction, PKBattle } from '../types';
import { 
  startLiveStream, 
  endLiveStream, 
  sendLiveHeartbeat,
  LIVE_HEARTBEAT_INTERVAL_MS,
  sendLiveHeart, 
  sendLiveChatMessage, 
  subscribeToLiveChat, 
  subscribeToLiveStream,
  createLivePoll,
  voteLivePoll,
  endLivePoll,
  startPKBattle,
  endPKBattle,
  cancelPKBattle,
  sendGiftToStream,
  subscribeToGiftsForStream
} from '../services/pulseDb';
import { 
  X, 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  Send, 
  Heart, 
  Users, 
  Radio, 
  Sparkles, 
  Flame, 
  Gift, 
  Share2, 
  BarChart2, 
  ShieldCheck, 
  Check, 
  RefreshCw, 
  Swords, 
  Coins, 
  Trophy, 
  Zap, 
  UserPlus, 
  Volume2, 
  VolumeX 
} from 'lucide-react';
import { VerifiedBadge } from './VerifiedBadge';
import { GiftPickerSheet } from './GiftPickerSheet';
import { GiftAnimationOverlay } from './GiftAnimationOverlay';
import { PKBattleOverlay } from './PKBattleOverlay';
import { CreatorWalletModal } from './CreatorWalletModal';
import confetti from 'canvas-confetti';

interface LiveStreamRoomModalProps {
  isOpen: boolean;
  mode: 'broadcast' | 'viewer';
  streamId?: string;
  hostProfile?: UserProfile | null;
  currentUser: UserProfile | null;
  initialTitle?: string;
  initialCategory?: string;
  onClose: () => void;
  onToast: (msg: string) => void;
  onRequireAuth: () => void;
  onUpdateUser?: (updated: Partial<UserProfile>) => void;
}

export const LiveStreamRoomModal: React.FC<LiveStreamRoomModalProps> = ({
  isOpen,
  mode,
  streamId: propStreamId,
  hostProfile,
  currentUser,
  initialTitle = 'Live Broadcast ✨',
  initialCategory = 'Just Chatting',
  onClose,
  onToast,
  onRequireAuth,
  onUpdateUser
}) => {
  const [activeStreamId, setActiveStreamId] = useState<string | null>(propStreamId || null);
  const [streamData, setStreamData] = useState<LiveStream | null>(null);
  const [isLive, setIsLive] = useState(mode === 'viewer');
  const [connecting, setConnecting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Broadcaster Setup
  const [streamTitle, setStreamTitle] = useState(initialTitle);
  const [category, setCategory] = useState(initialCategory);

  // Audio / Video Controls
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  // Viewers join muted by default. Browsers (Chrome/Safari) silently block
  // autoplay of unmuted <video> until the user has interacted with the page,
  // so an unmuted viewer video would just stay blank/black with no track
  // rendering and no error — this is what "live stream shows blank" was.
  // Starting muted lets autoplay succeed; the viewer can tap to unmute.
  const [isViewerMuted, setIsViewerMuted] = useState(true);
  // Whether we've actually attached a remote video frame for the viewer.
  // Used to show a "waiting for host video" placeholder instead of a bare
  // blank <video> element while the track is still connecting/subscribing.
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);
  const [viewerCount, setViewerCount] = useState(1);
  const [heartCount, setHeartCount] = useState(0);
  const [floatingHearts, setFloatingHearts] = useState<{ id: number; left: number; color: string }[]>([]);

  // Chat & Polls & PK Battles
  const [chatMessages, setChatMessages] = useState<LiveChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [showPollCreator, setShowPollCreator] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['Option 1', 'Option 2']);

  // Gifts & PK Battle Modals
  const [showGiftPicker, setShowGiftPicker] = useState(false);
  const [showPKLauncher, setShowPKLauncher] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [liveGifts, setLiveGifts] = useState<GiftTransaction[]>([]);
  const [pkDuration, setPkDuration] = useState<number>(180);
  const [selectedOpponent, setSelectedOpponent] = useState<{
    uid: string;
    handle: string;
    username: string;
    avatar: string;
  }>({
    uid: 'creator_sarah',
    handle: '@sarah_live',
    username: 'Sarah Live',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=sarah'
  });

  // Video Refs (Primary Host + Remote Co-Host / PK Opponent)
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const opponentVideoElementRef = useRef<HTMLVideoElement | null>(null);
  // Remote mic audio was never attached anywhere — TrackSubscribed only
  // handled Track.Kind.Video, so a host's voice never played for viewers
  // (or for a broadcaster hearing their PK opponent). These carry it.
  const remoteAudioElementRef = useRef<HTMLAudioElement | null>(null);
  const opponentAudioElementRef = useRef<HTMLAudioElement | null>(null);
  const roomRef = useRef<Room | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  // Auto scroll chat
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // Keep the host's remote audio element in sync with the viewer's
  // mute toggle — the video's `muted` attribute only silences that
  // element, not the separate audio track/element carrying the mic.
  useEffect(() => {
    if (remoteAudioElementRef.current) {
      remoteAudioElementRef.current.muted = isViewerMuted;
    }
  }, [isViewerMuted]);

  // Subscribe to live stream data, chat & gifts in Firestore
  useEffect(() => {
    if (!activeStreamId) return;

    const unsubStream = subscribeToLiveStream(activeStreamId, (data) => {
      if (data) {
        setStreamData(data);
        setViewerCount(Math.max(1, data.viewerCount || 1));
        setHeartCount((data as any).likes || (data as any).heartsCount || (data as any).heartCount || 0);
      } else if (mode === 'viewer') {
        onToast('Live stream has ended.');
        handleLeave();
      }
    });

    const unsubChat = subscribeToLiveChat(activeStreamId, (messages) => {
      setChatMessages(messages);
    });

    const unsubGifts = subscribeToGiftsForStream(activeStreamId, (gifts) => {
      setLiveGifts(gifts);
    });

    return () => {
      unsubStream();
      unsubChat();
      unsubGifts();
    };
  }, [activeStreamId, mode]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (roomRef.current) {
        roomRef.current.disconnect();
      }
    };
  }, []);

  // Connect to LiveKit Room
  const connectLiveKit = async (roomName: string, isPublisher: boolean) => {
    try {
      setConnecting(true);
      setErrorMsg('');
      setHasRemoteVideo(false);

      const identity = currentUser?.uid || `guest_${Math.random().toString(36).substring(7)}`;
      const displayName = currentUser?.username || 'Guest';

      // 1. Fetch token from backend
      const res = await fetch('/api/livekit/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomName,
          participantIdentity: identity,
          participantName: displayName,
          isPublisher
        })
      });

      const data = await res.json();
      if (!data.success || !data.token) {
        throw new Error(data.error || 'Failed to acquire LiveKit connection token');
      }

      // 2. Create LiveKit Room instance
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
        videoCaptureDefaults: {
          resolution: VideoPresets.h720.resolution
        }
      });
      roomRef.current = room;

      // Handle remote tracks for viewers & co-hosts
      room.on(RoomEvent.TrackSubscribed, (track: Track, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
        if (track.kind === Track.Kind.Video) {
          if (isPublisher && opponentVideoElementRef.current) {
            // Broadcaster rendering opponent in split screen
            track.attach(opponentVideoElementRef.current);
          } else if (videoElementRef.current) {
            const el = track.attach(videoElementRef.current);
            // attach() calls play() internally; on some browsers an unmuted
            // play() rejects (NotAllowedError) and is silently swallowed by
            // LiveKit, leaving a blank video with no visible error. Retry
            // muted so the viewer at least sees the stream, since the
            // element already starts muted={isViewerMuted} by default.
            el.play?.().catch(() => {
              el.muted = true;
              el.play?.().catch(() => {});
            });
            if (!isPublisher) setHasRemoteVideo(true);
          }
        } else if (track.kind === Track.Kind.Audio) {
          // Previously unhandled entirely — the host's mic audio was
          // subscribed over the wire but never attached to any element,
          // so nobody could ever hear a live host, viewer or PK opponent.
          const audioEl = isPublisher ? opponentAudioElementRef.current : remoteAudioElementRef.current;
          if (audioEl) {
            const el = track.attach(audioEl);
            el.play?.().catch(() => {
              // Unmuted audio autoplay can be blocked without a recent user
              // gesture. Mirror the video fallback: mute so playback at
              // least starts, matching the tap-to-unmute control below
              // (which un-mutes both video and this audio together).
              el.muted = true;
              el.play?.().catch(() => {});
            });
          }
        }
      });

      room.on(RoomEvent.TrackUnsubscribed, (track: Track) => {
        track.detach();
        if (track.kind === Track.Kind.Video && !isPublisher) setHasRemoteVideo(false);
      });

      room.on(RoomEvent.Disconnected, () => {
        console.log('LiveKit disconnected');
      });

      // 3. Connect to room
      await room.connect(data.url, data.token);

      // 4. Publish local tracks if broadcaster
      if (isPublisher) {
        await room.localParticipant.setCameraEnabled(true);
        await room.localParticipant.setMicrophoneEnabled(true);

        const videoTrack = room.localParticipant.getTrackPublication(Track.Source.Camera)?.videoTrack;
        if (videoTrack && videoElementRef.current) {
          videoTrack.attach(videoElementRef.current);
        }
      }

      setConnecting(false);
      return room;
    } catch (err: any) {
      console.warn('LiveKit connection fallback:', err);
      setConnecting(false);
      if (isPublisher && navigator.mediaDevices?.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          if (videoElementRef.current) {
            videoElementRef.current.srcObject = stream;
            videoElementRef.current.play();
          }
        } catch (mediaErr) {
          setErrorMsg('Camera & Microphone access is required for broadcasting.');
        }
      } else if (!isPublisher) {
        // Previously a viewer whose token fetch/room connect failed got no
        // feedback at all: connecting just flipped to false, leaving a
        // permanently blank video with nothing telling them the stream
        // couldn't be reached. Surface it via toast since the errorMsg
        // banner only renders on the broadcaster's Go Live Studio screen.
        onToast('Could not connect to this live stream. Try again in a moment.');
      }
    }
  };

  // Start Broadcast (Host)
  const handleStartBroadcast = async () => {
    if (!currentUser) {
      onRequireAuth();
      return;
    }

    try {
      setConnecting(true);
      const newStreamId = await startLiveStream(currentUser, streamTitle, category);
      setActiveStreamId(newStreamId);
      setIsLive(true);

      await connectLiveKit(`live_${newStreamId}`, true);

      // Send initial announcement
      await sendLiveChatMessage(newStreamId, currentUser, `🎉 Started live stream: "${streamTitle}"`, true);

      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
      onToast('You are now LIVE on Pulse! 🔴');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to start broadcast');
      setConnecting(false);
    }
  };

  // Viewer join
  useEffect(() => {
    if (mode === 'viewer' && propStreamId && isOpen) {
      setActiveStreamId(propStreamId);
      setIsLive(true);
      connectLiveKit(`live_${propStreamId}`, false);
    }
  }, [mode, propStreamId, isOpen]);

  // Heartbeat while broadcasting — lets viewers/listings detect a host that
  // crashed or closed the tab without cleanly ending the stream, instead of
  // leaving it stuck showing as "live" forever.
  useEffect(() => {
    if (mode !== 'broadcast' || !activeStreamId || !isLive) return;
    const interval = setInterval(() => {
      sendLiveHeartbeat(activeStreamId);
    }, LIVE_HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [mode, activeStreamId, isLive]);

  // Best-effort cleanup if the host closes the tab/app instead of tapping
  // "End stream" — without this the livestream doc is left as status:"live"
  // and shows up as a fake/offline "live" account.
  useEffect(() => {
    if (mode !== 'broadcast') return;
    const handleUnload = () => {
      if (activeStreamId) {
        try {
          const url = '';
          // Best-effort synchronous-ish signal; Firestore SDK calls made in
          // unload aren't guaranteed to complete, but the heartbeat timeout
          // (LIVE_STALE_THRESHOLD_MS) is the real safety net either way.
          endLiveStream(activeStreamId).catch(() => {});
        } catch (e) {}
      }
    };
    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('pagehide', handleUnload);
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      window.removeEventListener('pagehide', handleUnload);
    };
  }, [mode, activeStreamId]);

  // If this modal unmounts while still broadcasting (e.g. parent force-closes
  // it, navigation away) without the user tapping "Leave", end the stream so
  // it doesn't linger as a fake "live" host.
  const activeStreamIdRef = useRef(activeStreamId);
  useEffect(() => { activeStreamIdRef.current = activeStreamId; }, [activeStreamId]);
  useEffect(() => {
    return () => {
      if (mode === 'broadcast' && activeStreamIdRef.current) {
        endLiveStream(activeStreamIdRef.current).catch(() => {});
      }
    };
  }, [mode]);

  // Leave / End Stream
  const handleLeave = async () => {
    if (roomRef.current) {
      roomRef.current.disconnect();
      roomRef.current = null;
    }

    if (mode === 'broadcast' && activeStreamId) {
      try {
        await endLiveStream(activeStreamId);
      } catch (e) {}
    }

    onClose();
  };

  // Toggle Camera
  const handleToggleCamera = async () => {
    const nextState = !isCameraOn;
    setIsCameraOn(nextState);
    if (roomRef.current?.localParticipant) {
      await roomRef.current.localParticipant.setCameraEnabled(nextState);
    }
    if (videoElementRef.current?.srcObject) {
      const tracks = (videoElementRef.current.srcObject as MediaStream).getVideoTracks();
      tracks.forEach(t => t.enabled = nextState);
    }
  };

  // Toggle Mic
  const handleToggleMic = async () => {
    const nextState = !isMicOn;
    setIsMicOn(nextState);
    if (roomRef.current?.localParticipant) {
      await roomRef.current.localParticipant.setMicrophoneEnabled(nextState);
    }
    if (videoElementRef.current?.srcObject) {
      const tracks = (videoElementRef.current.srcObject as MediaStream).getAudioTracks();
      tracks.forEach(t => t.enabled = nextState);
    }
  };

  // Send Heart / Like
  const handleSendHeart = () => {
    if (activeStreamId) {
      sendLiveHeart(activeStreamId, 1);
    }
    setHeartCount(prev => prev + 1);

    const colors = ['#fe2c55', '#25f4ee', '#ff007a', '#ffbe0b', '#fb5607'];
    const newHeart = {
      id: Date.now() + Math.random(),
      left: Math.floor(Math.random() * 60) + 20,
      color: colors[Math.floor(Math.random() * colors.length)]
    };
    setFloatingHearts(prev => [...prev.slice(-15), newHeart]);
  };

  // Send Chat Message
  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || !activeStreamId) return;

    if (!currentUser) {
      onRequireAuth();
      return;
    }

    const text = inputMessage.trim();
    setInputMessage('');
    try {
      await sendLiveChatMessage(activeStreamId, currentUser, text);
    } catch (e) {
      onToast('Failed to send message');
    }
  };

  // Send Virtual Gift Handler
  const handleSendGift = async (
    gift: VirtualGift,
    targetTeam?: 'challenger' | 'opponent',
    receiver?: { uid: string; handle: string; username?: string; avatar: string }
  ) => {
    if (!currentUser || !activeStreamId) return;

    const finalReceiver = receiver || {
      uid: streamData?.hostUid || 'host',
      handle: streamData?.hostHandle || '@host',
      username: streamData?.hostUsername,
      avatar: streamData?.hostAvatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=host'
    };

    const gtx = await sendGiftToStream(activeStreamId, currentUser, finalReceiver, gift, targetTeam);
    
    // Update local user coin state
    if (onUpdateUser && currentUser.walletCoins !== undefined) {
      onUpdateUser({ walletCoins: Math.max(0, currentUser.walletCoins - gift.coins) });
    }
  };

  // Start PK Battle
  const handleStartPK = async () => {
    if (!activeStreamId || !currentUser) return;
    try {
      await startPKBattle(activeStreamId, currentUser, selectedOpponent, pkDuration);
      setShowPKLauncher(false);
      confetti({ particleCount: 90, spread: 80, origin: { y: 0.5 } });
      onToast(`⚔️ PK Battle launched against ${selectedOpponent.handle}!`);
    } catch (err: any) {
      onToast(err.message || 'Failed to start PK Battle');
    }
  };

  // End PK Battle
  const handleEndPK = async () => {
    if (!activeStreamId) return;
    try {
      await endPKBattle(activeStreamId);
      onToast('PK Battle concluded! 🏆');
    } catch (e) {}
  };

  // Create Poll
  const handleCreatePoll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pollQuestion.trim() || !activeStreamId) return;

    try {
      await createLivePoll(activeStreamId, pollQuestion, pollOptions.filter(o => o.trim()));
      setShowPollCreator(false);
      setPollQuestion('');
      onToast('Live Poll created! 📊');
    } catch (e) {
      onToast('Failed to create poll');
    }
  };

  if (!isOpen) return null;

  const isPKActive = !!(streamData?.pkBattle && streamData.pkBattle.status !== 'ended');
  const isPKEval = !!streamData?.pkBattle;

  return createPortal(
    <div className="absolute inset-0 z-50 bg-black w-full h-full flex flex-col justify-between select-none overflow-hidden animate-in fade-in">
      {/* Hidden audio elements carrying the host's mic (viewer) and the PK
          opponent's mic (broadcaster) — video muted attribute doesn't
          reach these since audio publishes as its own track/element. */}
      <audio ref={remoteAudioElementRef} autoPlay playsInline muted={isViewerMuted} />
      <audio ref={opponentAudioElementRef} autoPlay playsInline />

      {/* 1. BACKGROUND VIDEO / STREAM PLAYER (Single Video OR Split-Screen for PK Battle) */}
      <div className="relative flex-1 w-full h-full bg-neutral-950 flex items-center justify-center overflow-hidden">
        {isPKActive || (streamData?.pkBattle && streamData.pkBattle.status === 'ended') ? (
          /* SPLIT-SCREEN PK BATTLE CONTAINER */
          <div className="w-full h-full grid grid-cols-2 gap-0.5 bg-neutral-900">
            {/* LEFT: Challenger (RED TEAM) */}
            <div className="relative w-full h-full bg-neutral-950 overflow-hidden border-r-2 border-red-500/80">
              <video
                ref={videoElementRef}
                autoPlay
                playsInline
                muted={mode === 'broadcast' || isViewerMuted}
                className="w-full h-full object-cover"
              />
              <div className="absolute top-14 left-2 z-20 px-2 py-0.5 rounded-full bg-red-600/80 backdrop-blur-md text-white text-[9px] font-black uppercase flex items-center gap-1 shadow-md">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                <span>RED: {streamData?.pkBattle?.challengerHandle || 'Host'}</span>
              </div>
            </div>

            {/* RIGHT: Opponent (BLUE TEAM) */}
            <div className="relative w-full h-full bg-neutral-950 overflow-hidden border-l-2 border-blue-500/80 flex items-center justify-center">
              <video
                ref={opponentVideoElementRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
              {/* Co-Host Opponent Avatar fallback if track not active */}
              <div className="absolute inset-0 bg-neutral-900/60 backdrop-blur-xs flex flex-col items-center justify-center p-3 text-center pointer-events-none">
                <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-blue-400 shadow-xl mb-1.5">
                  <img
                    src={streamData?.pkBattle?.opponentAvatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=opponent'}
                    alt="Opponent"
                    className="w-full h-full object-cover"
                  />
                </div>
                <span className="text-white font-bold text-xs">
                  {streamData?.pkBattle?.opponentUsername || 'Opponent Co-Host'}
                </span>
                <span className="text-[9px] text-blue-300">Live Co-Hosting ⚡️</span>
              </div>

              <div className="absolute top-14 right-2 z-20 px-2 py-0.5 rounded-full bg-blue-600/80 backdrop-blur-md text-white text-[9px] font-black uppercase flex items-center gap-1 shadow-md">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                <span>BLUE: {streamData?.pkBattle?.opponentHandle || 'Opponent'}</span>
              </div>
            </div>
          </div>
        ) : (
          /* STANDARD FULL SCREEN VIDEO */
          <video
            ref={videoElementRef}
            autoPlay
            playsInline
            muted={mode === 'broadcast' || isViewerMuted}
            className="w-full h-full object-cover"
          />
        )}

        {/* Waiting-for-host placeholder: shown once initial connect finished
            but no remote video frame has attached yet (host camera off,
            track still subscribing, or host briefly disconnected). Without
            this the viewer just sees an empty black rectangle. */}
        {mode === 'viewer' && !connecting && !hasRemoteVideo && !isPKActive && (
          <div className="absolute inset-0 bg-neutral-950 flex flex-col items-center justify-center text-center p-6 z-10">
            <div className="w-16 h-16 rounded-full bg-neutral-800 flex items-center justify-center mb-2 text-neutral-400">
              <RefreshCw className="w-8 h-8 animate-spin" />
            </div>
            <p className="text-white font-bold text-sm">Waiting for host's video...</p>
            <p className="text-neutral-400 text-[10.5px] mt-0.5">This usually only takes a moment.</p>
          </div>
        )}

        {/* Tap-to-unmute button: viewers join muted so autoplay isn't
            blocked by the browser; this lets them turn sound on. */}
        {mode === 'viewer' && isLive && (
          <button
            onClick={() => setIsViewerMuted(m => !m)}
            className="absolute top-14 right-2 z-30 w-7 h-7 rounded-full bg-black/50 backdrop-blur-md border border-white/10 text-white flex items-center justify-center cursor-pointer active:scale-90 transition-transform"
            title={isViewerMuted ? 'Unmute' : 'Mute'}
          >
            {isViewerMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>
        )}

        {/* Camera Off Placeholder */}
        {!isCameraOn && !isPKActive && (
          <div className="absolute inset-0 bg-neutral-900 flex flex-col items-center justify-center text-center p-6">
            <div className="w-16 h-16 rounded-full bg-neutral-800 flex items-center justify-center mb-2 text-neutral-400">
              <VideoOff className="w-8 h-8" />
            </div>
            <p className="text-white font-bold text-sm">Camera is turned off</p>
            <p className="text-neutral-400 text-[10.5px] mt-0.5">Audio broadcast is still active.</p>
          </div>
        )}

        {/* Connecting Loader */}
        {connecting && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center text-white z-40">
            <RefreshCw className="w-8 h-8 animate-spin text-[#25f4ee] mb-2" />
            <p className="font-bold text-xs">Connecting to LiveKit Room...</p>
          </div>
        )}

        {/* PK BATTLE OVERLAY (Tug-of-War support meter & countdown) */}
        {streamData?.pkBattle && (
          <PKBattleOverlay
            pkBattle={streamData.pkBattle}
            isHost={mode === 'broadcast'}
            currentUser={currentUser}
            onEndBattle={handleEndPK}
            onSendQuickGift={(team) => {
              setShowGiftPicker(true);
            }}
          />
        )}

        {/* REAL-TIME ANIMATED VIRTUAL GIFTS OVERLAY */}
        <GiftAnimationOverlay gifts={liveGifts} />

        {/* Floating Heart Animations */}
        <div className="absolute right-4 bottom-20 w-16 h-64 pointer-events-none overflow-hidden z-30">
          {floatingHearts.map((h) => (
            <div
              key={h.id}
              style={{ left: `${h.left}%`, color: h.color }}
              className="absolute bottom-0 animate-bounce duration-1000 transform -translate-x-1/2 opacity-90 text-2xl transition-all"
            >
              ❤️
            </div>
          ))}
        </div>
      </div>

      {/* 2. TOP HEADER BAR */}
      <header className="absolute top-0 left-0 right-0 z-40 p-2 flex items-center justify-between bg-gradient-to-b from-black/80 via-black/30 to-transparent">
        {/* Host Info */}
        <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-md px-2 py-0.5 rounded-full border border-white/10 shadow-xs">
          <div className="w-5 h-5 rounded-full overflow-hidden border border-white/80">
            <img
              src={
                mode === 'broadcast' 
                  ? currentUser?.photoURL 
                  : hostProfile?.photoURL || streamData?.hostAvatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=live'
              }
              alt="Host"
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <div className="flex items-center gap-1">
              <span className="text-white font-bold text-[9.5px] leading-none">
                {mode === 'broadcast' ? currentUser?.username : hostProfile?.username || streamData?.hostUsername || 'Host'}
              </span>
              {(mode === 'broadcast' ? currentUser?.verified : hostProfile?.verified) && <VerifiedBadge size="xs" />}
            </div>
            <div className="flex items-center gap-0.5 text-[8px] text-neutral-300 leading-none mt-0.5">
              <span className="w-1 h-1 rounded-full bg-[#fe2c55] animate-ping" />
              <span className="text-[#fe2c55] font-black uppercase text-[7.5px]">LIVE</span>
              <span>•</span>
              <Users className="w-2.5 h-2.5 ml-0.5" />
              <span>{viewerCount}</span>
            </div>
          </div>
        </div>

        {/* Right Controls: Diamonds, Hearts, Wallet & Close (Ultra Compact) */}
        <div className="flex items-center gap-1">
          {/* Diamonds Balance Pill */}
          <button
            onClick={() => setShowWalletModal(true)}
            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-yellow-500/20 backdrop-blur-md border border-yellow-500/30 text-yellow-300 text-[9.5px] font-bold shadow-xs cursor-pointer hover:bg-yellow-500/30 transition-colors"
            title="Wallet &amp; Diamonds"
          >
            <Coins className="w-2.5 h-2.5 text-yellow-400" />
            <span>{streamData?.totalDiamonds || 0}</span>
          </button>

          {/* Hearts Pill */}
          <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-black/50 backdrop-blur-md border border-white/10 text-white text-[9.5px] font-bold shadow-xs">
            <Flame className="w-2.5 h-2.5 text-[#fe2c55]" />
            <span>{heartCount}</span>
          </div>

          {/* Leave Button */}
          <button
            onClick={handleLeave}
            className="w-5.5 h-5.5 rounded-full bg-black/50 backdrop-blur-md border border-white/10 text-white hover:bg-black/80 flex items-center justify-center cursor-pointer shadow-xs active:scale-90 transition-transform"
            title="Leave Live"
          >
            <X className="w-2.5 h-2.5 stroke-[2.5]" />
          </button>
        </div>
      </header>

      {/* 3. BROADCASTER GO LIVE STUDIO SCREEN */}
      {!isLive && mode === 'broadcast' && (
        <div className="absolute inset-0 bg-black/90 backdrop-blur-md z-50 flex flex-col justify-between p-3.5">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-1.5 text-white">
              <Radio className="w-3.5 h-3.5 text-[#fe2c55] animate-pulse" />
              <span className="font-bold text-xs">Go Live Studio</span>
            </div>
            <button onClick={onClose} className="p-1 text-white/80 hover:text-white cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="max-w-xs w-full mx-auto space-y-2.5 my-auto">
            <div>
              <label className="block text-[10.5px] font-semibold text-neutral-300 mb-1">Live Broadcast Title</label>
              <input
                type="text"
                value={streamTitle}
                onChange={(e) => setStreamTitle(e.target.value)}
                placeholder="What are you doing today?"
                className="w-full h-7.5 px-2.5 bg-neutral-900 border border-white/10 rounded-lg text-white text-[11px] focus:outline-none focus:border-[#25f4ee]"
              />
            </div>

            <div>
              <label className="block text-[10.5px] font-semibold text-neutral-300 mb-1">Category / Topic</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full h-7.5 px-2.5 bg-neutral-900 border border-white/10 rounded-lg text-white text-[11px] focus:outline-none focus:border-[#25f4ee]"
              >
                <option value="Just Chatting">💬 Just Chatting</option>
                <option value="Gaming & Esports">🎮 Gaming &amp; Esports</option>
                <option value="Music & Performance">🎵 Music &amp; Singing</option>
                <option value="Dance & Fitness">💃 Dance &amp; Fitness</option>
                <option value="Tech & Coding">💻 Tech &amp; Coding</option>
                <option value="Cooking & Food">🍳 Cooking &amp; Food</option>
              </select>
            </div>

            {errorMsg && (
              <div className="p-1.5 bg-red-500/20 border border-red-500/30 rounded-lg text-red-300 text-[10.5px]">
                {errorMsg}
              </div>
            )}
          </div>

          <div className="max-w-xs w-full mx-auto">
            <button
              onClick={handleStartBroadcast}
              disabled={connecting}
              className="w-full h-7.5 bg-gradient-to-r from-[#fe2c55] to-[#ff007a] text-white font-bold text-[11px] rounded-full shadow-xs hover:opacity-95 active:scale-98 transition-all flex items-center justify-center gap-1 cursor-pointer"
            >
              <Radio className="w-3 h-3 animate-pulse" />
              <span>{connecting ? 'Connecting LiveKit...' : 'Go LIVE Now'}</span>
            </button>
          </div>
        </div>
      )}

      {/* 4. LIVE INTERACTIVE OVERLAYS (Chat, PK Battles & Gift Triggers) */}
      {isLive && (
        <div className="absolute inset-x-0 bottom-0 z-40 p-2 bg-gradient-to-t from-black/95 via-black/60 to-transparent flex flex-col justify-end pointer-events-none">
          {/* Active Poll Banner if present */}
          {streamData?.activePoll && (
            <div className="mb-1.5 pointer-events-auto bg-black/75 backdrop-blur-md border border-white/15 rounded-xl p-2 max-w-xs">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold text-white flex items-center gap-1">
                  <BarChart2 className="w-2.5 h-2.5 text-[#25f4ee]" /> {streamData.activePoll.question}
                </span>
                {mode === 'broadcast' && (
                  <button
                    onClick={() => activeStreamId && endLivePoll(activeStreamId)}
                    className="text-[8.5px] text-red-400 hover:underline cursor-pointer"
                  >
                    End
                  </button>
                )}
              </div>
              <div className="space-y-1">
                {streamData.activePoll.options.map((opt, idx) => {
                  const optText = typeof opt === 'string' ? opt : opt.text;
                  const voteCount = typeof opt === 'object' && opt ? opt.votes : (streamData.activePoll?.voterUids ? Object.values(streamData.activePoll.voterUids).filter(v => v === idx).length : 0);
                  return (
                    <button
                      key={idx}
                      onClick={() => currentUser && activeStreamId && voteLivePoll(activeStreamId, idx, currentUser.uid)}
                      className="w-full py-0.5 px-1.5 rounded-md bg-white/10 hover:bg-white/20 text-left text-[10px] text-white flex justify-between items-center transition-colors cursor-pointer"
                    >
                      <span>{optText}</span>
                      <span className="text-[8.5px] text-neutral-400">{voteCount || 0}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Live Chat Stream */}
          <div
            ref={chatScrollRef}
            className="pointer-events-auto max-h-36 overflow-y-auto space-y-1 mb-1.5 max-w-sm scrollbar-none"
          >
            {chatMessages.map((msg) => (
              <div
                key={msg.id}
                className="flex items-start gap-1 bg-black/50 backdrop-blur-xs px-2 py-0.5 rounded-lg text-[10px] text-white inline-block max-w-full break-words border border-white/5 shadow-xs"
              >
                <span className="font-bold text-[#25f4ee] shrink-0">
                  {msg.handle || msg.username || (msg as any).who || 'User'}:
                </span>
                <span className="text-neutral-100">{msg.text}</span>
              </div>
            ))}
          </div>

          {/* Bottom Chat Bar & Action Controls (Reduced size by 70%) */}
          <div className="pointer-events-auto flex items-center gap-1">
            <form onSubmit={handleSendChat} className="flex-1 flex items-center bg-black/60 backdrop-blur-md rounded-full px-2 py-0.5 border border-white/20 shadow-xs">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Say something nice..."
                className="flex-1 bg-transparent text-white text-[10px] placeholder-white/50 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!inputMessage.trim()}
                className="text-white hover:text-[#25f4ee] p-0.5 disabled:opacity-30 cursor-pointer transition-colors"
              >
                <Send className="w-2.5 h-2.5" />
              </button>
            </form>

            {/* VIRTUAL GIFT BUTTON (All users & viewers) */}
            <button
              onClick={() => setShowGiftPicker(true)}
              className="w-6 h-6 rounded-full bg-gradient-to-r from-yellow-400 to-amber-500 text-black flex items-center justify-center cursor-pointer shadow-md active:scale-90 transition-transform"
              title="Send Animated Gift"
            >
              <Gift className="w-3 h-3" />
            </button>

            {/* Broadcast Controls (Mic / Camera / PK Launcher / Polls) OR Viewer Heart Button */}
            {mode === 'broadcast' ? (
              <div className="flex items-center gap-1">
                {/* PK Battle Trigger Button */}
                <button
                  onClick={() => setShowPKLauncher(true)}
                  className={`w-6 h-6 rounded-full backdrop-blur-md border flex items-center justify-center cursor-pointer shadow-xs active:scale-90 transition-transform ${
                    isPKActive ? 'bg-red-600 border-red-400 text-white animate-pulse' : 'bg-white/10 border-white/15 text-yellow-300'
                  }`}
                  title="Launch PK Battle"
                >
                  <Swords className="w-3 h-3" />
                </button>

                <button
                  onClick={handleToggleMic}
                  className={`w-6 h-6 rounded-full backdrop-blur-md border border-white/15 flex items-center justify-center cursor-pointer shadow-xs active:scale-90 transition-transform ${isMicOn ? 'bg-white/10 text-white' : 'bg-red-500/80 text-white'}`}
                  title={isMicOn ? 'Mute Mic' : 'Unmute Mic'}
                >
                  {isMicOn ? <Mic className="w-3 h-3" /> : <MicOff className="w-3 h-3" />}
                </button>
                <button
                  onClick={handleToggleCamera}
                  className={`w-6 h-6 rounded-full backdrop-blur-md border border-white/15 flex items-center justify-center cursor-pointer shadow-xs active:scale-90 transition-transform ${isCameraOn ? 'bg-white/10 text-white' : 'bg-red-500/80 text-white'}`}
                  title={isCameraOn ? 'Turn Camera Off' : 'Turn Camera On'}
                >
                  {isCameraOn ? <Video className="w-3 h-3" /> : <VideoOff className="w-3 h-3" />}
                </button>
                <button
                  onClick={() => setShowPollCreator(!showPollCreator)}
                  className="w-6 h-6 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-white hover:bg-white/20 flex items-center justify-center cursor-pointer shadow-xs active:scale-90 transition-transform"
                  title="Create Live Poll"
                >
                  <BarChart2 className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <button
                  onClick={handleSendHeart}
                  className="w-6 h-6 rounded-full bg-gradient-to-r from-[#fe2c55] to-[#ff007a] text-white active:scale-90 transition-transform shadow-md flex items-center justify-center cursor-pointer"
                  title="Send Heart"
                >
                  <Heart className="w-3 h-3 fill-white" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. PK BATTLE LAUNCHER MODAL (For Host) */}
      {showPKLauncher && (
        <div className="absolute inset-x-3 bottom-14 z-50 bg-neutral-950 border border-neutral-800 rounded-2xl p-3 shadow-2xl max-w-sm mx-auto">
          <div className="flex justify-between items-center mb-2 pb-1.5 border-b border-neutral-800">
            <div className="flex items-center gap-1.5 text-white font-bold text-xs">
              <Swords className="w-3.5 h-3.5 text-yellow-400" />
              <span>Launch Live PK Battle</span>
            </div>
            <button onClick={() => setShowPKLauncher(false)} className="text-neutral-400 hover:text-white p-0.5 cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2.5">
            {/* Select Opponent */}
            <div>
              <label className="block text-[10px] font-semibold text-neutral-300 mb-1">Select Co-Host / Opponent</label>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { uid: 'sarah_creator', handle: '@sarah_live', username: 'Sarah Live', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=sarah' },
                  { uid: 'alex_beats', handle: '@alex_beats', username: 'Alex Beats', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=alex' },
                  { uid: 'neon_dancer', handle: '@neon_dancer', username: 'Neon Dancer', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=neon' },
                  { uid: 'vibe_master', handle: '@vibe_master', username: 'Vibe Master', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=vibe' }
                ].map((opp) => (
                  <div
                    key={opp.uid}
                    onClick={() => setSelectedOpponent(opp)}
                    className={`flex items-center gap-1.5 p-1.5 rounded-xl border cursor-pointer transition-colors ${
                      selectedOpponent.handle === opp.handle
                        ? 'bg-neutral-800 border-yellow-400'
                        : 'bg-neutral-900/60 border-neutral-800'
                    }`}
                  >
                    <div className="w-6 h-6 rounded-full overflow-hidden border border-neutral-700 shrink-0">
                      <img src={opp.avatar} alt={opp.handle} className="w-full h-full object-cover" />
                    </div>
                    <div className="truncate">
                      <p className="text-[10px] font-bold text-white truncate">{opp.handle}</p>
                      <p className="text-[8.5px] text-emerald-400">Online</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Select Duration */}
            <div>
              <label className="block text-[10px] font-semibold text-neutral-300 mb-1">Battle Duration</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setPkDuration(180)}
                  className={`py-1 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                    pkDuration === 180 ? 'bg-yellow-500/20 border-yellow-400 text-yellow-300' : 'bg-neutral-900 border-neutral-800 text-neutral-400'
                  }`}
                >
                  ⚡️ 3 Minutes (Fast PK)
                </button>
                <button
                  onClick={() => setPkDuration(300)}
                  className={`py-1 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                    pkDuration === 300 ? 'bg-yellow-500/20 border-yellow-400 text-yellow-300' : 'bg-neutral-900 border-neutral-800 text-neutral-400'
                  }`}
                >
                  🔥 5 Minutes (Epic Battle)
                </button>
              </div>
            </div>

            <button
              onClick={handleStartPK}
              className="w-full h-7.5 bg-gradient-to-r from-red-600 to-amber-500 text-white font-black text-xs rounded-full shadow-md flex items-center justify-center gap-1 hover:opacity-95 cursor-pointer active:scale-98 transition-transform"
            >
              <Swords className="w-3 h-3" />
              <span>Start PK Battle with {selectedOpponent.handle}</span>
            </button>
          </div>
        </div>
      )}

      {/* 6. GIFT PICKER SHEET */}
      <GiftPickerSheet
        isOpen={showGiftPicker}
        currentUser={currentUser}
        hostProfile={{
          uid: streamData?.hostUid || 'host',
          handle: streamData?.hostHandle || '@host',
          username: streamData?.hostUsername,
          avatar: streamData?.hostAvatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=host'
        }}
        pkBattle={streamData?.pkBattle}
        onClose={() => setShowGiftPicker(false)}
        onSendGift={handleSendGift}
        onOpenRecharge={() => {
          setShowGiftPicker(false);
          setShowWalletModal(true);
        }}
        onRequireAuth={onRequireAuth}
        onToast={onToast}
      />

      {/* 7. CREATOR WALLET MODAL */}
      {currentUser && (
        <CreatorWalletModal
          isOpen={showWalletModal}
          currentUser={currentUser}
          onClose={() => setShowWalletModal(false)}
          onToast={onToast}
          onUpdateUser={onUpdateUser}
        />
      )}

      {/* 8. POLL CREATOR SHEET */}
      {showPollCreator && (
        <div className="absolute inset-x-3 bottom-14 z-50 bg-neutral-900 border border-neutral-700 rounded-xl p-3 shadow-2xl">
          <div className="flex justify-between items-center mb-2">
            <span className="text-white font-bold text-xs flex items-center gap-1">
              <BarChart2 className="w-3.5 h-3.5 text-[#25f4ee]" /> Create Live Poll
            </span>
            <button onClick={() => setShowPollCreator(false)} className="text-neutral-400 hover:text-white p-0.5 cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <form onSubmit={handleCreatePoll} className="space-y-2">
            <input
              type="text"
              value={pollQuestion}
              onChange={(e) => setPollQuestion(e.target.value)}
              placeholder="Ask your viewers a question..."
              className="w-full px-2.5 py-1.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-[11px] focus:outline-none"
            />
            <button
              type="submit"
              disabled={!pollQuestion.trim()}
              className="w-full py-1.5 bg-[#25f4ee] text-black font-bold rounded-lg text-[11px] hover:opacity-90 disabled:opacity-50 cursor-pointer shadow-xs"
            >
              Launch Poll
            </button>
          </form>
        </div>
      )}
    </div>,
    document.body
  );
};
