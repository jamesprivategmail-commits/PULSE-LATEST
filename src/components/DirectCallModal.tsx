import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Room, RoomEvent, Track, RemoteParticipant, RemoteTrackPublication } from 'livekit-client';
import { CallSession, UserProfile } from '../types';
import { 
  answerDirectCall, 
  declineDirectCall, 
  endDirectCall, 
  subscribeToCallSession 
} from '../services/pulseDb';
import { callSounds } from '../utils/callSounds';
import { 
  Phone, 
  PhoneOff, 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  Minimize2, 
  Maximize2, 
  Volume2, 
  VolumeX, 
  SwitchCamera, 
  Sparkles,
  Users,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { VerifiedBadge } from './VerifiedBadge';

interface DirectCallModalProps {
  isOpen: boolean;
  callSession: CallSession | null;
  currentUser: UserProfile;
  isMinimized: boolean;
  onClose: () => void;
  onToggleMinimize: () => void;
  onToast: (msg: string) => void;
}

export const DirectCallModal: React.FC<DirectCallModalProps> = ({
  isOpen,
  callSession: initialCallSession,
  currentUser,
  isMinimized,
  onClose,
  onToggleMinimize,
  onToast
}) => {
  const [currentSession, setCurrentSession] = useState<CallSession | null>(initialCallSession);
  const [isConnected, setIsConnected] = useState(false);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isSpeakerMuted, setIsSpeakerMuted] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [connecting, setConnecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Audio level visualizer for voice call
  const [localAudioLevel, setLocalAudioLevel] = useState<number>(0);
  const [remoteAudioLevel, setRemoteAudioLevel] = useState<number>(0);

  // LiveKit refs
  const roomRef = useRef<Room | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const callDurationTimerRef = useRef<any>(null);

  const isCaller = currentSession?.callerUid === currentUser.uid;
  const otherPerson = isCaller 
    ? {
        uid: currentSession?.recipientUid || '',
        handle: currentSession?.recipientHandle || '@user',
        username: currentSession?.recipientUsername || currentSession?.recipientHandle || 'User',
        avatar: currentSession?.recipientAvatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=other',
        verified: !!currentSession?.recipientVerified
      }
    : {
        uid: currentSession?.callerUid || '',
        handle: currentSession?.callerHandle || '@user',
        username: currentSession?.callerUsername || currentSession?.callerHandle || 'User',
        avatar: currentSession?.callerAvatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=caller',
        verified: !!currentSession?.callerVerified
      };

  // Sync prop changes
  useEffect(() => {
    if (initialCallSession) {
      setCurrentSession(initialCallSession);
    }
  }, [initialCallSession?.id, initialCallSession?.status]);

  // Subscribe to real-time updates for active call in Firestore
  useEffect(() => {
    if (!initialCallSession?.id) return;

    const unsubscribe = subscribeToCallSession(initialCallSession.id, (session) => {
      if (!session) {
        handleCleanupAndClose('Call ended');
        return;
      }

      setCurrentSession(session);

      if (session.status === 'declined') {
        callSounds.playEndTone();
        onToast(isCaller ? `${otherPerson.username} declined the call` : 'Call declined');
        handleCleanupAndClose('Call declined');
      } else if (session.status === 'busy') {
        callSounds.playEndTone();
        onToast(`${otherPerson.username} is currently busy`);
        handleCleanupAndClose('User busy');
      } else if (session.status === 'ended') {
        callSounds.playEndTone();
        onToast('Call ended');
        handleCleanupAndClose('Call ended');
      }
    });

    return () => unsubscribe();
  }, [initialCallSession?.id, isCaller, otherPerson.username]);

  // Handle Ringing Sound Effects
  useEffect(() => {
    if (!isOpen || !currentSession) {
      callSounds.stop();
      return;
    }

    if (currentSession.status === 'ringing') {
      if (isCaller) {
        callSounds.startOutgoingRing();
      } else {
        callSounds.startIncomingRing();
      }
    } else if (currentSession.status === 'accepted') {
      callSounds.playConnectedChime();
    } else {
      callSounds.stop();
    }

    return () => {
      callSounds.stop();
    };
  }, [isOpen, currentSession?.status, isCaller]);

  // Handle Call Connection when status becomes 'accepted'
  useEffect(() => {
    if (!isOpen || !currentSession) return;

    if (currentSession.status === 'accepted' && !roomRef.current && !connecting) {
      connectToLiveKitRoom(currentSession.roomName, currentSession.callType);
    }
  }, [isOpen, currentSession?.status, currentSession?.roomName, currentSession?.callType]);

  // Timer counter when call is connected
  useEffect(() => {
    if (isConnected && currentSession?.status === 'accepted') {
      callDurationTimerRef.current = setInterval(() => {
        setDurationSeconds(s => s + 1);
      }, 1000);
    } else {
      if (callDurationTimerRef.current) {
        clearInterval(callDurationTimerRef.current);
        callDurationTimerRef.current = null;
      }
    }

    return () => {
      if (callDurationTimerRef.current) {
        clearInterval(callDurationTimerRef.current);
      }
    };
  }, [isConnected, currentSession?.status]);

  // Connect to LiveKit Room
  const connectToLiveKitRoom = async (roomName: string, callType: 'voice' | 'video') => {
    try {
      setConnecting(true);
      setErrorMessage(null);

      const identity = currentUser.uid;
      const displayName = currentUser.username || currentUser.handle;

      // 1. Fetch access token from backend API
      const tokenRes = await fetch('/api/livekit/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomName,
          participantIdentity: identity,
          participantName: displayName,
          isPublisher: true
        })
      });

      if (!tokenRes.ok) {
        throw new Error('Failed to retrieve call authorization token.');
      }

      const { token, url } = await tokenRes.json();

      // 2. Initialize LiveKit Room instance
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
        videoCaptureDefaults: {
          resolution: { width: 1280, height: 720, frameRate: 30 },
          facingMode: 'user'
        }
      });
      roomRef.current = room;

      // 3. Setup event listeners
      room.on(RoomEvent.TrackSubscribed, (track: Track, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
        if (track.kind === Track.Kind.Video && remoteVideoRef.current) {
          const el = track.attach(remoteVideoRef.current);
          el.play?.().catch(() => {});
        } else if (track.kind === Track.Kind.Audio && remoteAudioRef.current) {
          // Connection happens inside an async effect (triggered by a
          // Firestore listener callback), not synchronously inside the
          // "Answer" tap — so the browser's user-activation grace period
          // for unmuted autoplay isn't guaranteed to still be active here.
          // If play() is rejected, retry muted so the call isn't silently
          // one-way; the speaker button lets the person unmute manually.
          const el = track.attach(remoteAudioRef.current);
          el.play?.().catch(() => {
            el.muted = true;
            setIsSpeakerMuted(true);
            onToast('Tap the speaker icon to hear audio');
            el.play?.().catch(() => {});
          });
        }
      });

      room.on(RoomEvent.TrackUnsubscribed, (track: Track) => {
        track.detach();
      });

      room.on(RoomEvent.ParticipantDisconnected, () => {
        onToast(`${otherPerson.username} disconnected`);
        handleEndCall();
      });

      room.on(RoomEvent.Disconnected, () => {
        setIsConnected(false);
      });

      // 4. Connect to server
      await room.connect(url, token);
      setIsConnected(true);

      // 5. Publish Audio Track (both voice & video calls)
      await room.localParticipant.setMicrophoneEnabled(true);

      // 6. Publish Video Track (video calls only)
      if (callType === 'video') {
        await room.localParticipant.setCameraEnabled(true);
        const videoTrack = Array.from(room.localParticipant.videoTrackPublications.values())[0]?.videoTrack;
        if (videoTrack && localVideoRef.current) {
          videoTrack.attach(localVideoRef.current);
        }
      }

      setConnecting(false);
    } catch (err: any) {
      console.error('LiveKit call connection error:', err);
      setErrorMessage(err.message || 'Could not connect to call room.');
      setConnecting(false);
      onToast('Connection error: ' + (err.message || 'Error'));
    }
  };

  const handleAnswer = async () => {
    if (!currentSession) return;
    try {
      await answerDirectCall(currentSession.id);
      callSounds.stop();
    } catch (err) {
      onToast('Failed to answer call');
    }
  };

  const handleDecline = async () => {
    if (!currentSession) return;
    try {
      callSounds.stop();
      await declineDirectCall(currentSession.id, 'declined');
      handleCleanupAndClose('Declined');
    } catch (err) {
      handleCleanupAndClose('Declined');
    }
  };

  const handleEndCall = async () => {
    if (!currentSession) return;
    try {
      callSounds.playEndTone();
      await endDirectCall(currentSession.id, durationSeconds, 'ended');
    } catch (err) {}
    handleCleanupAndClose('Ended');
  };

  const handleCleanupAndClose = (reason?: string) => {
    callSounds.stop();
    if (roomRef.current) {
      roomRef.current.disconnect();
      roomRef.current = null;
    }
    if (callDurationTimerRef.current) {
      clearInterval(callDurationTimerRef.current);
      callDurationTimerRef.current = null;
    }
    setIsConnected(false);
    setDurationSeconds(0);
    onClose();
  };

  const toggleMic = async () => {
    if (!roomRef.current) return;
    const nextState = !isMicMuted;
    try {
      await roomRef.current.localParticipant.setMicrophoneEnabled(!nextState);
      setIsMicMuted(nextState);
      onToast(nextState ? 'Microphone muted' : 'Microphone unmuted');
    } catch (e) {
      onToast('Failed to toggle mic');
    }
  };

  const toggleCamera = async () => {
    if (!roomRef.current) return;
    const nextState = !isCameraOff;
    try {
      await roomRef.current.localParticipant.setCameraEnabled(!nextState);
      setIsCameraOff(nextState);
      onToast(nextState ? 'Camera turned off' : 'Camera turned on');
      if (!nextState && localVideoRef.current) {
        const videoTrack = Array.from(roomRef.current.localParticipant.videoTrackPublications.values())[0]?.videoTrack;
        if (videoTrack) videoTrack.attach(localVideoRef.current);
      }
    } catch (e) {
      onToast('Failed to toggle camera');
    }
  };

  const flipCamera = async () => {
    if (!roomRef.current || currentSession?.callType !== 'video') return;
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextMode);
    try {
      await roomRef.current.localParticipant.setCameraEnabled(false);
      await roomRef.current.localParticipant.setCameraEnabled(true, {
        facingMode: nextMode
      });
      if (localVideoRef.current) {
        const videoTrack = Array.from(roomRef.current.localParticipant.videoTrackPublications.values())[0]?.videoTrack;
        if (videoTrack) videoTrack.attach(localVideoRef.current);
      }
      onToast(`Switched to ${nextMode === 'user' ? 'front' : 'rear'} camera`);
    } catch (e) {
      onToast('Camera flip not supported on this device');
    }
  };

  const formatDuration = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins < 10 ? '0' : ''}${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  if (!isOpen || !currentSession) return null;

  // Render Hidden Audio element for remote participant sound
  const remoteAudioElem = (
    <audio 
      ref={remoteAudioRef} 
      autoPlay 
      playsInline 
      muted={isSpeakerMuted}
    />
  );

  // -------------------------------------------------------------
  // MINIMIZED FLOATING CALL PILL
  // -------------------------------------------------------------
  if (isMinimized) {
    return createPortal(
      <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[100] max-w-[360px] w-[92%] bg-neutral-900/95 backdrop-blur-md border border-[#25f4ee]/40 rounded-full px-3 py-2 shadow-2xl flex items-center justify-between animate-in slide-in-from-top select-none">
        {remoteAudioElem}
        
        <div 
          onClick={onToggleMinimize}
          className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0"
        >
          <div className="relative shrink-0">
            <img 
              src={otherPerson.avatar} 
              alt={otherPerson.handle} 
              className="w-8 h-8 rounded-full object-cover border border-[#25f4ee]"
            />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-black absolute -bottom-0.5 -right-0.5 animate-pulse" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold text-white truncate flex items-center gap-1">
              <span>{otherPerson.username}</span>
              <span className="text-[10px] text-neutral-400 font-normal">
                {currentSession.callType === 'video' ? '📹 Video' : '📞 Voice'}
              </span>
            </div>
            <div className="text-[10px] text-[#25f4ee] font-mono font-bold">
              {currentSession.status === 'ringing' ? 'Calling...' : formatDuration(durationSeconds)}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          <button
            type="button"
            onClick={toggleMic}
            className={`p-2 rounded-full cursor-pointer transition-colors ${
              isMicMuted ? 'bg-red-500/20 text-red-400' : 'bg-neutral-800 text-white'
            }`}
          >
            {isMicMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
          </button>

          <button
            type="button"
            onClick={handleEndCall}
            className="p-2 rounded-full bg-red-600 hover:bg-red-500 text-white cursor-pointer shadow"
          >
            <PhoneOff className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={onToggleMinimize}
            className="p-2 rounded-full bg-neutral-800 text-neutral-300 hover:text-white cursor-pointer"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>,
      document.body
    );
  }

  // -------------------------------------------------------------
  // FULL SCREEN CALL MODAL VIEW (true edge-to-edge, no side gaps)
  // -------------------------------------------------------------
  return createPortal(
    <div className="absolute inset-0 z-[90] bg-black flex flex-col justify-between w-full h-full select-none overflow-hidden">
      {remoteAudioElem}

      {/* Top Header Bar */}
      <div className="p-4 flex items-center justify-between z-20 shrink-0 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-full bg-white/10 backdrop-blur-md text-[11px] font-bold text-white flex items-center gap-1.5 border border-white/10">
            {currentSession.callType === 'video' ? <Video className="w-3 h-3 text-[#25f4ee]" /> : <Phone className="w-3 h-3 text-[#25f4ee]" />}
            <span>{currentSession.callType === 'video' ? 'Video Call' : 'Voice Call'}</span>
          </span>
          <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
            <ShieldCheck className="w-2.5 h-2.5" /> Encrypted
          </span>
        </div>

        <button
          type="button"
          onClick={onToggleMinimize}
          className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-md cursor-pointer transition-colors border border-white/10"
          title="Minimize Call"
        >
          <Minimize2 className="w-4 h-4" />
        </button>
      </div>

      {/* Main Call Body */}
      <div className="flex-1 relative flex flex-col items-center justify-center p-6 text-center">
        {/* VIDEO CALL ACTIVE VIEW */}
        {currentSession.callType === 'video' && currentSession.status === 'accepted' ? (
          <div className="absolute inset-0 w-full h-full bg-neutral-950 flex items-center justify-center overflow-hidden">
            {/* Remote Full Video */}
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />

            {/* Local Picture-in-Picture Preview */}
            <div className="absolute top-16 right-4 w-28 sm:w-32 aspect-[9/16] rounded-2xl overflow-hidden border-2 border-white/30 shadow-2xl z-20 bg-neutral-900">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
              />
              {isCameraOff && (
                <div className="absolute inset-0 bg-neutral-900 flex flex-col items-center justify-center text-[10px] text-neutral-400">
                  <VideoOff className="w-5 h-5 text-red-400 mb-1" />
                  Camera off
                </div>
              )}
            </div>

            {/* Remote Info Banner on Video */}
            <div className="absolute bottom-28 left-4 right-4 z-20 flex items-center justify-between bg-black/40 backdrop-blur-md px-3.5 py-2 rounded-xl border border-white/10">
              <div className="flex items-center gap-2 text-left">
                <img
                  src={otherPerson.avatar}
                  alt={otherPerson.handle}
                  className="w-8 h-8 rounded-full object-cover border border-white/20"
                />
                <div>
                  <div className="text-xs font-bold text-white leading-tight">{otherPerson.username}</div>
                  <div className="text-[10px] text-[#25f4ee] font-mono">{formatDuration(durationSeconds)}</div>
                </div>
              </div>
              <div className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Live HD
              </div>
            </div>
          </div>
        ) : (
          /* VOICE CALL OR RINGING VIEW */
          <div className="flex flex-col items-center justify-center space-y-6 max-w-sm">
            {/* Pulsing Avatar Halo */}
            <div className="relative flex items-center justify-center">
              <div className="absolute w-44 h-44 rounded-full bg-[#25f4ee]/15 animate-ping" />
              <div className="absolute w-36 h-36 rounded-full bg-gradient-to-tr from-[#25f4ee]/30 to-[#ff2b54]/30 animate-pulse" />
              <img
                src={otherPerson.avatar}
                alt={otherPerson.handle}
                className="w-28 h-28 rounded-full object-cover border-4 border-white/20 shadow-2xl relative z-10"
              />
            </div>

            {/* Name and Handle */}
            <div className="space-y-1">
              <h3 className="text-xl font-black text-white flex items-center justify-center gap-1.5">
                <span>{otherPerson.username}</span>
                {otherPerson.verified && <VerifiedBadge size="sm" />}
              </h3>
              <p className="text-xs text-neutral-400">{otherPerson.handle}</p>
            </div>

            {/* Call Status & Timer */}
            <div className="space-y-2">
              {currentSession.status === 'ringing' ? (
                <div className="flex flex-col items-center gap-1">
                  <span className="text-sm font-bold text-[#25f4ee] animate-pulse">
                    {isCaller ? 'Ringing...' : `Incoming ${currentSession.callType === 'video' ? 'Video' : 'Voice'} Call...`}
                  </span>
                  <span className="text-[11px] text-neutral-500">
                    {isCaller ? 'Waiting for recipient to answer...' : 'Tap accept to join'}
                  </span>
                </div>
              ) : currentSession.status === 'accepted' ? (
                <div className="flex flex-col items-center gap-1.5">
                  <span className="text-2xl font-mono font-bold text-white tracking-widest">
                    {formatDuration(durationSeconds)}
                  </span>
                  <span className="text-[11px] text-emerald-400 font-bold flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Connected via LiveKit WebRTC
                  </span>

                  {/* Audio Wave Visualizer Animation */}
                  <div className="flex items-center gap-1.5 h-8 mt-2">
                    {[12, 24, 18, 32, 28, 40, 22, 34, 16, 26, 30, 14].map((h, i) => (
                      <div
                        key={i}
                        className="w-1 rounded-full bg-gradient-to-t from-[#25f4ee] to-[#00b4d8] animate-pulse"
                        style={{
                          height: `${Math.max(6, (h * (isMicMuted ? 0.2 : 1)))}px`,
                          animationDelay: `${i * 0.1}s`,
                          animationDuration: '0.8s'
                        }}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <span className="text-sm font-bold text-red-400">
                  Call {currentSession.status}
                </span>
              )}
            </div>

            {errorMessage && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{errorMessage}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Controls Bar */}
      <div className="p-6 bg-gradient-to-t from-black via-black/90 to-transparent z-20 shrink-0 flex flex-col gap-4">
        {/* INCOMING RINGING: ANSWER / DECLINE CONTROLS */}
        {!isCaller && currentSession.status === 'ringing' ? (
          <div className="flex items-center justify-around max-w-xs mx-auto w-full">
            {/* Decline Button */}
            <button
              type="button"
              onClick={handleDecline}
              className="flex flex-col items-center gap-1 group cursor-pointer"
            >
              <div className="w-10 h-10 rounded-full bg-red-600 group-hover:bg-red-500 text-white flex items-center justify-center shadow-md shadow-red-600/30 transition-transform active:scale-90">
                <PhoneOff className="w-4.5 h-4.5" />
              </div>
              <span className="text-[10px] font-bold text-neutral-400 group-hover:text-white">Decline</span>
            </button>

            {/* Answer Button */}
            <button
              type="button"
              onClick={handleAnswer}
              className="flex flex-col items-center gap-1 group cursor-pointer"
            >
              <div className="w-10 h-10 rounded-full bg-emerald-500 group-hover:bg-emerald-400 text-white flex items-center justify-center shadow-md shadow-emerald-500/40 animate-pulse transition-transform active:scale-90">
                {currentSession.callType === 'video' ? <Video className="w-4.5 h-4.5" /> : <Phone className="w-4.5 h-4.5" />}
              </div>
              <span className="text-[10px] font-bold text-emerald-400 group-hover:text-emerald-300">Answer</span>
            </button>
          </div>
        ) : (
          /* ACTIVE CALL OR OUTGOING CALL CONTROLS (70% smaller compact buttons) */
          <div className="flex items-center justify-center gap-2.5 sm:gap-3.5">
            {/* Mic Toggle */}
            <button
              type="button"
              onClick={toggleMic}
              className={`w-8 h-8 rounded-full flex items-center justify-center cursor-pointer transition-all shadow-xs ${
                isMicMuted
                  ? 'bg-red-500 text-white hover:bg-red-600'
                  : 'bg-neutral-800 hover:bg-neutral-700 text-white'
              }`}
              title={isMicMuted ? 'Unmute Mic' : 'Mute Mic'}
            >
              {isMicMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
            </button>

            {/* Camera Toggle (For Video Calls) */}
            {currentSession.callType === 'video' && (
              <button
                type="button"
                onClick={toggleCamera}
                className={`w-8 h-8 rounded-full flex items-center justify-center cursor-pointer transition-all shadow-xs ${
                  isCameraOff
                    ? 'bg-red-500 text-white hover:bg-red-600'
                    : 'bg-neutral-800 hover:bg-neutral-700 text-white'
                }`}
                title={isCameraOff ? 'Turn Camera On' : 'Turn Camera Off'}
              >
                {isCameraOff ? <VideoOff className="w-3.5 h-3.5" /> : <Video className="w-3.5 h-3.5" />}
              </button>
            )}

            {/* Flip Camera (For Video Calls) */}
            {currentSession.callType === 'video' && (
              <button
                type="button"
                onClick={flipCamera}
                className="w-8 h-8 rounded-full bg-neutral-800 hover:bg-neutral-700 text-white flex items-center justify-center cursor-pointer shadow-xs transition-all"
                title="Flip Camera (Front / Rear)"
              >
                <SwitchCamera className="w-3.5 h-3.5 text-[#25f4ee]" />
              </button>
            )}

            {/* Speaker Toggle */}
            <button
              type="button"
              onClick={() => {
                setIsSpeakerMuted(prev => !prev);
                onToast(!isSpeakerMuted ? 'Muted speaker' : 'Unmuted speaker');
              }}
              className={`w-8 h-8 rounded-full flex items-center justify-center cursor-pointer transition-all shadow-xs ${
                isSpeakerMuted
                  ? 'bg-neutral-800 text-neutral-500'
                  : 'bg-neutral-800 hover:bg-neutral-700 text-white'
              }`}
              title={isSpeakerMuted ? 'Unmute Speaker' : 'Mute Speaker'}
            >
              {isSpeakerMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            </button>

            {/* End Call Button */}
            <button
              type="button"
              onClick={handleEndCall}
              className="w-9 h-9 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center cursor-pointer shadow-md shadow-red-600/40 transition-transform active:scale-90"
              title="Hang Up"
            >
              <PhoneOff className="w-4.5 h-4.5" />
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
