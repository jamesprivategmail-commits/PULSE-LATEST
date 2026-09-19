import React, { useState, useEffect, useRef } from 'react';
import { VideoPost, UserProfile } from '../types';
import { 
  toggleVideoLike, 
  toggleVideoSave, 
  toggleRepostVideo, 
  checkUserLikedVideo, 
  checkUserSavedVideo, 
  recordVideoView,
  recordWatchHistory
} from '../services/pulseDb';
import { formatCount } from '../utils/formatters';
import { 
  ArrowLeft, 
  Heart, 
  MessageCircle, 
  Bookmark, 
  Share2, 
  Music, 
  Volume2, 
  VolumeX, 
  Play, 
  Gauge, 
  MoreVertical,
  Repeat
} from 'lucide-react';
import { VerifiedBadge } from './VerifiedBadge';

interface ProfilePostViewerModalProps {
  isOpen: boolean;
  videos: VideoPost[];
  initialIndex: number;
  creatorProfile?: UserProfile | null;
  currentUser: UserProfile | null;
  onClose: () => void;
  onOpenComments: (video: VideoPost) => void;
  onOpenShare?: (video: VideoPost) => void;
  onOpenReport?: (type: 'video', id: string, handle?: string) => void;
  onToast: (msg: string) => void;
  onRequireAuth: () => void;
}

export const ProfilePostViewerModal: React.FC<ProfilePostViewerModalProps> = ({
  isOpen,
  videos,
  initialIndex,
  creatorProfile,
  currentUser,
  onClose,
  onOpenComments,
  onOpenShare,
  onOpenReport,
  onToast,
  onRequireAuth
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex || 0);
  const [muted, setMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [likedMap, setLikedMap] = useState<Record<string, boolean>>({});
  const [savedMap, setSavedMap] = useState<Record<string, boolean>>({});
  const [likeCountMap, setLikeCountMap] = useState<Record<string, number>>({});
  const [saveCountMap, setSaveCountMap] = useState<Record<string, number>>({});
  const likingRef = useRef<Record<string, boolean>>({});
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [progress, setProgress] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const touchStartY = useRef<number>(0);

  useEffect(() => {
    setCurrentIndex(initialIndex || 0);
  }, [initialIndex]);

  const currentVideo = videos[currentIndex] || videos[0];

  useEffect(() => {
    if (!currentVideo) return;
    
    // Check like / save status for current video
    if (currentUser?.uid) {
      checkUserLikedVideo(currentUser.uid, currentVideo.id).then((liked) => {
        setLikedMap(prev => ({ ...prev, [currentVideo.id]: liked }));
      });
      checkUserSavedVideo(currentUser.uid, currentVideo.id).then((saved) => {
        setSavedMap(prev => ({ ...prev, [currentVideo.id]: saved }));
      });
    }

    if (likeCountMap[currentVideo.id] === undefined) {
      setLikeCountMap(prev => ({ ...prev, [currentVideo.id]: currentVideo.likeCount || 0 }));
    }
    if (saveCountMap[currentVideo.id] === undefined) {
      setSaveCountMap(prev => ({ ...prev, [currentVideo.id]: currentVideo.saveCount || 0 }));
    }

    // Record view & history
    recordVideoView(currentVideo.id);
    if (currentUser?.uid) {
      recordWatchHistory(currentVideo.id);
    }
  }, [currentVideo?.id, currentUser?.uid]);

  // Video playback handling
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackSpeed;
      videoRef.current.muted = muted;
      videoRef.current.currentTime = 0;
      videoRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch(() => {
        setIsPlaying(false);
      });
    }
  }, [currentIndex, playbackSpeed, muted]);

  if (!isOpen || !currentVideo) return null;

  const isImage = currentVideo.mediaType === 'image' || 
                  (currentVideo.src && (currentVideo.src.startsWith('data:image') || currentVideo.src.includes('.jpg') || currentVideo.src.includes('.png') || currentVideo.src.includes('.webp')));

  const handleToggleLike = async () => {
    if (!currentUser) {
      onRequireAuth();
      return;
    }
    // Per-video guard: block overlapping toggles for the same video so two
    // rapid taps can't both read the "not liked" doc before either write
    // lands and double-increment likeCount on the server.
    if (likingRef.current[currentVideo.id]) return;
    likingRef.current[currentVideo.id] = true;
    const isLiked = !!likedMap[currentVideo.id];
    const nextLiked = !isLiked;
    setLikedMap(prev => ({ ...prev, [currentVideo.id]: nextLiked }));
    setLikeCountMap(prev => ({
      ...prev,
      [currentVideo.id]: Math.max(0, (prev[currentVideo.id] || 0) + (nextLiked ? 1 : -1))
    }));

    try {
      await toggleVideoLike(currentVideo.id, currentUser);
    } catch (e) {
      // rollback on error
      setLikedMap(prev => ({ ...prev, [currentVideo.id]: isLiked }));
      setLikeCountMap(prev => ({
        ...prev,
        [currentVideo.id]: Math.max(0, (prev[currentVideo.id] || 0) + (nextLiked ? -1 : 1))
      }));
    } finally {
      likingRef.current[currentVideo.id] = false;
    }
  };

  const handleToggleSave = async () => {
    if (!currentUser) {
      onRequireAuth();
      return;
    }
    const isSaved = !!savedMap[currentVideo.id];
    const nextSaved = !isSaved;
    setSavedMap(prev => ({ ...prev, [currentVideo.id]: nextSaved }));
    setSaveCountMap(prev => ({
      ...prev,
      [currentVideo.id]: Math.max(0, (prev[currentVideo.id] || 0) + (nextSaved ? 1 : -1))
    }));

    try {
      await toggleVideoSave(currentVideo.id, currentUser);
      onToast(nextSaved ? 'Saved to Bookmarks 📑' : 'Removed from Bookmarks');
    } catch (e) {
      setSavedMap(prev => ({ ...prev, [currentVideo.id]: isSaved }));
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStartY.current - e.changedTouches[0].clientY;
    if (diff > 50 && currentIndex < videos.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else if (diff < -50 && currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (Math.abs(e.deltaY) > 40) {
      if (e.deltaY > 0 && currentIndex < videos.length - 1) {
        setCurrentIndex(prev => prev + 1);
      } else if (e.deltaY < 0 && currentIndex > 0) {
        setCurrentIndex(prev => prev - 1);
      }
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current && videoRef.current.duration) {
      const p = (videoRef.current.currentTime / videoRef.current.duration) * 100;
      setProgress(p);
    }
  };

  const isLiked = !!likedMap[currentVideo.id];
  const isSaved = !!savedMap[currentVideo.id];
  const currentLikes = likeCountMap[currentVideo.id] ?? currentVideo.likeCount ?? 0;
  const currentSaves = saveCountMap[currentVideo.id] ?? currentVideo.saveCount ?? 0;

  return (
    <div 
      id="profilePostViewerModal"
      ref={containerRef}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="fixed inset-0 z-50 bg-black flex flex-col justify-between select-none animate-in fade-in duration-200"
    >
      {/* 1. TOP NAVIGATION BAR */}
      <header className="absolute top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
        {/* Back Button */}
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 p-2 -ml-2 text-white hover:text-gray-200 active:scale-95 transition-transform cursor-pointer drop-shadow-md rounded-full bg-black/30 backdrop-blur-xs"
          title="Back to profile"
          aria-label="Back to profile"
        >
          <ArrowLeft className="w-6 h-6 stroke-[2.5]" />
        </button>

        {/* Creator Info */}
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-1">
            <span className="text-white font-extrabold text-sm drop-shadow">
              {currentVideo.ownerUsername || creatorProfile?.username || currentVideo.ownerHandle}
            </span>
            {(currentVideo.verified || creatorProfile?.verified) && (
              <VerifiedBadge size="xs" />
            )}
          </div>
          <span className="text-[10px] text-white/70 font-mono">
            {currentIndex + 1} of {videos.length}
          </span>
        </div>

        {/* Mute Toggle */}
        <button
          onClick={() => setMuted(!muted)}
          className="p-2 -mr-2 text-white hover:text-gray-200 active:scale-95 transition-transform cursor-pointer drop-shadow-md rounded-full bg-black/30 backdrop-blur-xs"
        >
          {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
        </button>
      </header>

      {/* 2. MAIN MEDIA CONTENT */}
      <div 
        onClick={() => {
          if (!isImage && videoRef.current) {
            if (videoRef.current.paused) {
              videoRef.current.play();
              setIsPlaying(true);
            } else {
              videoRef.current.pause();
              setIsPlaying(false);
            }
          }
        }}
        className="relative flex-1 flex items-center justify-center bg-black overflow-hidden cursor-pointer"
      >
        {isImage ? (
          <img
            src={currentVideo.src}
            alt={currentVideo.caption}
            className="w-full h-full object-contain"
          />
        ) : (
          <video
            ref={videoRef}
            src={currentVideo.src}
            loop
            playsInline
            muted={muted}
            onTimeUpdate={handleTimeUpdate}
            className="w-full h-full object-cover sm:object-contain"
          />
        )}

        {/* Play/Pause Overlay Indicator */}
        {!isImage && !isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[2px]">
            <div className="w-16 h-16 rounded-full bg-black/60 border border-white/20 flex items-center justify-center text-white shadow-2xl">
              <Play className="w-8 h-8 fill-white ml-1" />
            </div>
          </div>
        )}

        {/* Playback speed selector */}
        {!isImage && (
          <div className="absolute top-16 left-4 z-30">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowSpeedMenu(!showSpeedMenu);
              }}
              className="px-2.5 py-1 rounded-full bg-black/50 backdrop-blur-md text-white border border-white/15 text-xs font-bold flex items-center gap-1 hover:bg-black/70 cursor-pointer shadow-lg"
            >
              <Gauge className="w-3.5 h-3.5 text-[#25f4ee]" />
              <span>{playbackSpeed}x</span>
            </button>
            {showSpeedMenu && (
              <div className="absolute top-9 left-0 bg-neutral-900/95 border border-white/15 rounded-xl p-1 shadow-2xl flex flex-col gap-0.5 z-50 min-w-[70px]">
                {[0.5, 1, 1.25, 1.5, 2].map((s) => (
                  <button
                    key={s}
                    onClick={(e) => {
                      e.stopPropagation();
                      setPlaybackSpeed(s);
                      setShowSpeedMenu(false);
                    }}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg text-left cursor-pointer transition-colors ${
                      playbackSpeed === s ? 'bg-[#25f4ee] text-black' : 'text-neutral-200 hover:bg-white/10'
                    }`}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. RIGHT SIDE ACTION BUTTONS */}
      <div className="absolute right-3 bottom-24 z-40 flex flex-col items-center gap-4">
        {/* Creator Avatar */}
        <div className="relative">
          <div className="w-11 h-11 rounded-full overflow-hidden border-2 border-white shadow-lg">
            <img
              src={currentVideo.ownerAvatar || creatorProfile?.photoURL || 'https://api.dicebear.com/7.x/bottts/svg?seed=pulse'}
              alt={currentVideo.ownerHandle}
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        {/* Like */}
        <button
          onClick={handleToggleLike}
          className="flex flex-col items-center gap-1 text-white active:scale-80 transition-transform cursor-pointer"
        >
          <div className={`p-2.5 rounded-full backdrop-blur-md ${isLiked ? 'bg-red-500/20 text-[#fe2c55]' : 'bg-black/40 text-white'}`}>
            <Heart className={`w-6 h-6 stroke-[2.2] ${isLiked ? 'fill-[#fe2c55] text-[#fe2c55]' : ''}`} />
          </div>
          <span className="text-[11px] font-bold drop-shadow">{formatCount(currentLikes)}</span>
        </button>

        {/* Comment */}
        <button
          onClick={() => onOpenComments(currentVideo)}
          className="flex flex-col items-center gap-1 text-white active:scale-80 transition-transform cursor-pointer"
        >
          <div className="p-2.5 rounded-full bg-black/40 backdrop-blur-md">
            <MessageCircle className="w-6 h-6 stroke-[2.2]" />
          </div>
          <span className="text-[11px] font-bold drop-shadow">{formatCount(currentVideo.commentCount || 0)}</span>
        </button>

        {/* Bookmark / Save */}
        <button
          onClick={handleToggleSave}
          className="flex flex-col items-center gap-1 text-white active:scale-80 transition-transform cursor-pointer"
        >
          <div className={`p-2.5 rounded-full backdrop-blur-md ${isSaved ? 'bg-amber-500/20 text-[#face15]' : 'bg-black/40 text-white'}`}>
            <Bookmark className={`w-6 h-6 stroke-[2.2] ${isSaved ? 'fill-[#face15] text-[#face15]' : ''}`} />
          </div>
          <span className="text-[11px] font-bold drop-shadow">{formatCount(currentSaves)}</span>
        </button>

        {/* Share */}
        <button
          onClick={() => {
            if (onOpenShare) {
              onOpenShare(currentVideo);
            } else {
              navigator.clipboard?.writeText(window.location.href);
              onToast('Video link copied to clipboard 🔗');
            }
          }}
          className="flex flex-col items-center gap-1 text-white active:scale-80 transition-transform cursor-pointer"
        >
          <div className="p-2.5 rounded-full bg-black/40 backdrop-blur-md">
            <Share2 className="w-6 h-6 stroke-[2.2]" />
          </div>
          <span className="text-[11px] font-bold drop-shadow">{formatCount(currentVideo.shareCount || 0)}</span>
        </button>
      </div>

      {/* 4. BOTTOM CAPTION & SOUND INFO */}
      <footer className="absolute bottom-0 left-0 right-16 z-40 p-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent">
        <div className="space-y-1.5 max-w-[85%]">
          <div className="flex items-center gap-1.5">
            <span className="text-white font-extrabold text-sm drop-shadow">
              {currentVideo.ownerHandle || '@' + currentVideo.ownerUsername}
            </span>
            {currentVideo.verified && <VerifiedBadge size="xs" />}
          </div>

          <p className="text-white text-xs leading-relaxed line-clamp-3 drop-shadow">
            {currentVideo.caption}
          </p>

          {/* Sound Info */}
          <div className="flex items-center gap-2 text-white/90 text-xs mt-1">
            <Music className="w-3.5 h-3.5 shrink-0 animate-pulse text-[#25f4ee]" />
            <span className="truncate text-[11px] font-medium drop-shadow">
              {currentVideo.sound || `original sound — ${currentVideo.ownerUsername}`}
            </span>
          </div>
        </div>

        {/* Progress Scrubber */}
        {!isImage && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
            <div 
              className="h-full bg-gradient-to-r from-[#25f4ee] to-[#ff2b54] transition-all duration-75"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </footer>
    </div>
  );
};
