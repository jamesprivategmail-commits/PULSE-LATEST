import React, { useRef, useState, useEffect } from 'react';
import { VideoPost, UserProfile, VirtualGift } from '../types';
import { 
  toggleVideoLike, 
  toggleVideoSave, 
  toggleRepostVideo, 
  checkUserLikedVideo, 
  checkUserSavedVideo, 
  checkIsFollowing, 
  toggleFollowUser,
  recordVideoView,
  recordWatchHistory,
  isPlatformOwner,
  sendTipToCreator
} from '../services/pulseDb';
import { db, doc, getDoc } from '../backend';
import { formatCount } from '../utils/formatters';
import { 
  Heart, 
  MessageCircle, 
  Bookmark, 
  Share2, 
  MoreVertical, 
  Edit3, 
  Trash2, 
  Check, 
  Music, 
  Repeat, 
  EyeOff, 
  Flag, 
  Gauge, 
  Volume2, 
  VolumeX,
  Sparkles,
  FolderHeart,
  Pin,
  Download,
  Gift
} from 'lucide-react';
import { VerifiedBadge } from './VerifiedBadge';
import { GiftPickerSheet } from './GiftPickerSheet';
import { CreatorWalletModal } from './CreatorWalletModal';

interface VideoSlideProps {
  video: VideoPost;
  index: number;
  currentUser: UserProfile | null;
  muted: boolean;
  isActive: boolean;
  autoScroll?: boolean;
  isFollowing?: boolean;
  onOpenComments: (video: VideoPost) => void;
  onOpenProfile: (handle: string, uid: string) => void;
  onEditVideo: (video: VideoPost) => void;
  onDeleteVideo: (videoId: string) => void;
  onOpenReport: (type: 'video', id: string, handle?: string) => void;
  onTagClick?: (tag: string) => void;
  onSoundClick?: (soundTitle: string, creatorHandle?: string, creatorAvatar?: string) => void;
  onSearchPrompt?: (query: string) => void;
  onOpenShare?: (video: VideoPost) => void;
  onHideVideo?: (videoId: string) => void;
  onOpenPlaylists?: (video: VideoPost) => void;
  onToggleMute?: () => void;
  onVideoEnd?: () => void;
  onFollowToggle?: (targetUid: string, isFollowing: boolean) => void;
  onToast: (msg: string) => void;
  onRequireAuth: () => void;
}

const FILTER_CLASSES: Record<string, string> = {
  vivid: 'saturate-150 contrast-110 brightness-105',
  cyberpunk: 'hue-rotate-180 contrast-125 saturate-150',
  vintage: 'sepia contrast-110 brightness-95',
  noir: 'grayscale contrast-150',
  neon: 'contrast-125 saturate-200 brightness-110',
  sunset: 'sepia-50 saturate-150 hue-rotate-15'
};

const VideoSlideComponent: React.FC<VideoSlideProps> = ({
  video,
  currentUser,
  muted,
  isActive,
  autoScroll,
  isFollowing: propIsFollowing,
  onOpenComments,
  onOpenProfile,
  onEditVideo,
  onDeleteVideo,
  onOpenReport,
  onTagClick,
  onSoundClick,
  onSearchPrompt,
  onOpenShare,
  onHideVideo,
  onOpenPlaylists,
  onToggleMute,
  onVideoEnd,
  onFollowToggle,
  onToast,
  onRequireAuth
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const voiceoverRef = useRef<HTMLAudioElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const [currentVideoSrc, setCurrentVideoSrc] = useState<string>(video.src);
  const [hasVideoError, setHasVideoError] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(0);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(video.likeCount || 0);
  const [saved, setSaved] = useState(false);
  const [saveCount, setSaveCount] = useState(video.saveCount || 0);
  const [reposted, setReposted] = useState(false);
  const [repostCount, setRepostCount] = useState(video.repostCount || 0);
  const [isFollowing, setIsFollowing] = useState(propIsFollowing || false);
  const [followPending, setFollowPending] = useState(false);
  const [floatingHearts, setFloatingHearts] = useState<{ id: number; x: number; y: number }[]>([]);
  const [showOptions, setShowOptions] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [isExpandedCaption, setIsExpandedCaption] = useState(false);
  const [showGiftPicker, setShowGiftPicker] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const lastTapRef = useRef<number>(0);
  const viewRecordedRef = useRef<boolean>(false);
  const isLikingRef = useRef<boolean>(false);

  const handleSendTip = async (gift: VirtualGift) => {
    if (!currentUser) {
      onRequireAuth();
      return;
    }
    try {
      await sendTipToCreator(
        currentUser,
        video.ownerUid,
        video.ownerHandle,
        video.ownerAvatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=user',
        gift,
        video.id
      );
      onToast(`Tipped ${gift.icon} ${gift.name} to ${video.ownerHandle}! 💖`);
    } catch (err: any) {
      onToast(err.message || 'Failed to send tip');
    }
  };

  useEffect(() => {
    if (propIsFollowing !== undefined) {
      setIsFollowing(propIsFollowing);
    }
  }, [propIsFollowing]);

  // Sync initial like / save / repost / follow states & current video src
  useEffect(() => {
    setCurrentVideoSrc(video.src);
    setHasVideoError(false);
    setLikeCount(video.likeCount || 0);
    setSaveCount(video.saveCount || 0);
    setRepostCount(video.repostCount || 0);

    if (currentUser) {
      checkUserLikedVideo(video.id, currentUser.uid).then(setLiked);
      checkUserSavedVideo(video.id, currentUser.uid).then(setSaved);
      
      // Check repost status
      getDoc(doc(db, 'users', currentUser.uid, 'reposts', video.id))
        .then(s => setReposted(s.exists()))
        .catch(() => {});

      if (propIsFollowing === undefined && video.ownerUid && video.ownerUid !== currentUser.uid) {
        checkIsFollowing(currentUser.uid, video.ownerUid).then(setIsFollowing);
      }
    }
  }, [video.id, video.src, currentUser?.uid]);

  // Keep local follow state in sync with the parent's source-of-truth prop.
  // Previously this only seeded state on mount, so if the user followed this
  // creator from another screen (profile, followers list, search), this slide
  // never found out — its next tap on Follow would read the stale local
  // state and toggle the wrong direction (looking like an instant unfollow).
  useEffect(() => {
    if (propIsFollowing !== undefined) {
      setIsFollowing(propIsFollowing);
    }
  }, [propIsFollowing]);

  // Video playback management based on active slide in viewport
  useEffect(() => {
    const vid = videoRef.current;
    const voice = voiceoverRef.current;
    if (!vid) return;

    if (isActive) {
      vid.muted = muted;
      vid.currentTime = 0;
      vid.playbackRate = playbackSpeed;
      if (voice) {
        voice.currentTime = 0;
        voice.playbackRate = playbackSpeed;
        voice.play().catch(() => {});
      }
      const playPromise = vid.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsPlaying(true);
            if (!viewRecordedRef.current) {
              viewRecordedRef.current = true;
              recordVideoView(video.id);
              recordWatchHistory(video.id);
            }
          })
          .catch((err) => {
            console.warn('Autoplay notice:', err?.message || err);
            setIsPlaying(false);
          });
      }
    } else {
      vid.pause();
      if (voice) voice.pause();
      setIsPlaying(false);
      viewRecordedRef.current = false;
    }
  }, [isActive, muted, playbackSpeed, video.id, currentVideoSrc]);

  const handleVideoError = () => {
    if (!hasVideoError) {
      setHasVideoError(true);
      console.warn('Video stream failed to load:', currentVideoSrc);
      if (video.images && video.images.length > 0) {
        setCurrentVideoSrc(video.images[0]);
      } else {
        const reliableFallbacks = [
          'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
          'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
          'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
          'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4'
        ];
        const next = reliableFallbacks[Math.abs(video.id.split('').reduce((a, b) => a + b.charCodeAt(0), 0)) % reliableFallbacks.length];
        setCurrentVideoSrc(next);
      }
    }
  };

  const handleTimeUpdate = () => {
    const vid = videoRef.current;
    if (vid && vid.duration) {
      setProgress((vid.currentTime / vid.duration) * 100);
    }
  };

  const handleVideoEnded = () => {
    if (autoScroll && onVideoEnd) {
      onVideoEnd();
    }
  };

  // Interactive scrubber drag/click
  const handleScrub = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const vid = videoRef.current;
    const bar = progressBarRef.current;
    if (!vid || !bar || !vid.duration) return;

    const rect = bar.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const newPercent = Math.max(0, Math.min(1, clickX / rect.width));
    vid.currentTime = newPercent * vid.duration;
    if (voiceoverRef.current) {
      voiceoverRef.current.currentTime = newPercent * vid.duration;
    }
    setProgress(newPercent * 100);
  };

  const togglePlay = () => {
    const vid = videoRef.current;
    if (!vid) return;
    if (vid.paused) {
      vid.play().then(() => setIsPlaying(true));
      if (voiceoverRef.current) voiceoverRef.current.play().catch(() => {});
    } else {
      vid.pause();
      if (voiceoverRef.current) voiceoverRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleVideoTap = (e: React.MouseEvent<HTMLDivElement>) => {
    const now = Date.now();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (now - lastTapRef.current < 300) {
      // Double tap -> Like video with popping heart
      if (!currentUser) {
        onRequireAuth();
        return;
      }
      if (!liked) {
        handleLike();
      }
      const newHeart = { id: now, x, y };
      setFloatingHearts(prev => [...prev, newHeart]);
      setTimeout(() => {
        setFloatingHearts(prev => prev.filter(h => h.id !== now));
      }, 750);
    } else {
      // Single tap -> toggle play
      togglePlay();
    }
    lastTapRef.current = now;
  };

  const handleLike = async () => {
    if (!currentUser) {
      onRequireAuth();
      return;
    }
    // Guard against rapid repeat taps (double-tap-to-like + the heart button
    // can both fire in quick succession). Without this, two overlapping
    // toggleVideoLike calls each read the "not liked yet" doc before either
    // write lands, so both go down the "like" branch and increment() twice
    // server-side while the UI only ever applied +1 locally — likeCount
    // would silently drift out of sync with what's shown.
    if (isLikingRef.current) return;
    isLikingRef.current = true;
    const newLiked = !liked;
    setLiked(newLiked);
    setLikeCount(prev => prev + (newLiked ? 1 : -1));
    try {
      await toggleVideoLike(video.id, currentUser);
    } catch (e) {
      // Roll back the optimistic update if the write failed.
      setLiked(!newLiked);
      setLikeCount(prev => prev + (newLiked ? -1 : 1));
    } finally {
      isLikingRef.current = false;
    }
  };

  const handleSave = async () => {
    if (!currentUser) {
      onRequireAuth();
      return;
    }
    const newSaved = !saved;
    setSaved(newSaved);
    setSaveCount(prev => prev + (newSaved ? 1 : -1));
    await toggleVideoSave(video.id, currentUser);
    onToast(newSaved ? 'Saved to bookmarks' : 'Removed from bookmarks');
  };

  const handleRepost = async () => {
    if (!currentUser) {
      onRequireAuth();
      return;
    }
    const newReposted = !reposted;
    setReposted(newReposted);
    setRepostCount(prev => prev + (newReposted ? 1 : -1));
    await toggleRepostVideo(video, currentUser);
    onToast(newReposted ? 'Reposted to your profile! 🔁' : 'Removed repost');
  };

  const handleFollow = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser) {
      onRequireAuth();
      return;
    }
    if (followPending) return; // ignore rapid double-taps while a toggle is in flight
    setFollowPending(true);
    try {
      const nextFollowing = await toggleFollowUser(currentUser.uid, video.ownerUid, currentUser, video.ownerHandle);
      setIsFollowing(nextFollowing);
      if (onFollowToggle) {
        onFollowToggle(video.ownerUid, nextFollowing);
      }
      onToast(nextFollowing ? `Following ${video.ownerHandle}` : `Unfollowed ${video.ownerHandle}`);
    } catch (err: any) {
      onToast(err?.message === 'blocked' ? "You can't follow this user" : 'Something went wrong — try again');
    } finally {
      setFollowPending(false);
    }
  };

  const handleShareClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onOpenShare) {
      onOpenShare(video);
    } else {
      const videoUrl = `${window.location.origin}/?v=${video.id}`;
      navigator.clipboard.writeText(videoUrl).then(() => onToast('Link copied! 📋'));
    }
  };

  const handleSpeedSelect = (speed: number) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
    if (voiceoverRef.current) {
      voiceoverRef.current.playbackRate = speed;
    }
    setShowSpeedMenu(false);
    onToast(`Speed set to ${speed}x`);
  };

  const handleSoundTap = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onSoundClick) {
      onSoundClick(video.sound || 'Original sound — Pulse', video.ownerHandle, video.ownerAvatar);
    }
  };

  const isOwner = currentUser?.uid === video.ownerUid || isPlatformOwner(currentUser);

  const touchStartXRef = useRef<number>(0);
  const touchStartYRef = useRef<number>(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const deltaX = touchEndX - touchStartXRef.current;
    const deltaY = touchEndY - touchStartYRef.current;

    // Sliding right opens the creator's profile
    if (deltaX > 75 && Math.abs(deltaY) < 60) {
      if (video.ownerHandle) {
        onOpenProfile(video.ownerHandle, video.ownerUid);
      }
    }
  };

  const filterClass = video.filter ? (FILTER_CLASSES[video.filter] || '') : '';

  const isImage = video.mediaType === 'image' || video.mediaType === 'carousel' || video.src?.startsWith('data:image') || /\.(jpeg|jpg|png|gif|webp|avif|svg)(\?.*)?$/i.test(video.src || '');
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);
  const photoImages = video.images && video.images.length > 0 ? video.images : [video.src];

  return (
    <div 
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="slide relative w-full h-full snap-start flex items-end justify-between overflow-hidden bg-black select-none"
    >
      {/* Background Media: Video or High-Res Photo */}
      {isImage ? (
        <div className="absolute inset-0 w-full h-full bg-black flex items-center justify-center overflow-hidden">
          <img
            src={photoImages[activePhotoIdx] || video.src}
            alt={video.caption || 'Pulse post'}
            className={`w-full h-full object-cover transition-transform duration-700 ${filterClass}`}
          />
          {photoImages.length > 1 && (
            <div className="absolute top-14 right-3 z-30 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-[10px] font-extrabold text-white border border-white/10 shadow">
              {activePhotoIdx + 1}/{photoImages.length}
            </div>
          )}
          {/* Photo Carousel Navigation Dots if multi-photo */}
          {photoImages.length > 1 && (
            <div className="absolute bottom-1.5 left-0 right-0 z-30 flex items-center justify-center gap-1">
              {photoImages.map((_, pIdx) => (
                <button
                  key={pIdx}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActivePhotoIdx(pIdx);
                  }}
                  className={`h-1 rounded-full transition-all cursor-pointer ${
                    pIdx === activePhotoIdx ? 'w-4 bg-[#25f4ee]' : 'w-1 bg-white/40'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <video
          ref={videoRef}
          src={currentVideoSrc}
          loop={!autoScroll}
          playsInline
          preload="auto"
          muted={muted}
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleVideoEnded}
          onError={handleVideoError}
          className={`absolute inset-0 w-full h-full object-cover cursor-pointer ${filterClass}`}
        />
      )}

      {/* Voiceover or background audio sync track if present */}
      {video.voiceoverSrc && (
        <audio ref={voiceoverRef} src={video.voiceoverSrc} loop={!autoScroll} />
      )}

      {/* Text Overlay if present on video/photo */}
      {video.textOverlay && (
        <div
          className={`absolute inset-x-6 z-20 flex justify-center pointer-events-none ${
            video.textOverlay.position === 'top'
              ? 'top-20'
              : video.textOverlay.position === 'bottom'
              ? 'bottom-28'
              : 'top-1/2 -translate-y-1/2'
          }`}
        >
          <div
            className="px-3.5 py-1.5 rounded-xl bg-black/65 backdrop-blur-xs font-black text-center drop-shadow-2xl"
            style={{ color: video.textOverlay.color, fontSize: `${Math.min(video.textOverlay.fontSize || 16, 20)}px` }}
          >
            {video.textOverlay.text}
          </div>
        </div>
      )}

      {/* Touch overlay for play/pause and double tap hearts */}
      <div
        onClick={handleVideoTap}
        className="absolute inset-0 z-10 bg-gradient-to-b from-black/35 via-transparent to-black/85 cursor-pointer"
      />

      {/* Floating double tap hearts */}
      {floatingHearts.map((heart) => (
        <div
          key={heart.id}
          style={{ left: heart.x - 30, top: heart.y - 30 }}
          className="absolute z-30 pointer-events-none animate-ping text-[#ff2b54]"
        >
          <Heart className="w-16 h-16 fill-[#ff2b54] drop-shadow-2xl" />
        </div>
      ))}

      {/* Play/Pause indicator button overlay */}
      {!isPlaying && !isImage && (
        <div 
          onClick={(e) => {
            e.stopPropagation();
            togglePlay();
          }}
          className="absolute inset-0 z-20 flex flex-col items-center justify-center cursor-pointer group"
        >
          <div className="w-16 h-16 rounded-full bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-2xl transition-transform transform group-hover:scale-110 active:scale-95">
            <svg className="w-8 h-8 fill-current ml-1 text-white" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
          <span className="text-[11px] font-bold text-white/90 bg-black/60 backdrop-blur-xs px-3 py-1 rounded-full mt-3 border border-white/10 shadow">
            Tap to Play
          </span>
        </div>
      )}

      {/* Top Left Playback Speed Badge */}
      <div className="absolute top-12 left-3 z-30 flex items-center gap-1.5">
        {!isImage && (
          <div className="relative">
            <button
              onClick={() => setShowSpeedMenu(!showSpeedMenu)}
              className="px-2 py-0.5 rounded-full bg-black/40 backdrop-blur-md text-white border border-white/10 text-[11px] font-bold flex items-center gap-1 hover:bg-black/60 transition-colors cursor-pointer"
            >
              <Gauge className="w-3 h-3 text-[#25f4ee]" />
              <span>{playbackSpeed}x</span>
            </button>
            {showSpeedMenu && (
              <div className="absolute top-8 left-0 bg-neutral-900 border border-white/15 rounded-xl p-1 shadow-2xl flex flex-col gap-0.5 z-50 min-w-[65px]">
                {[0.5, 1, 1.25, 1.5, 2].map((s) => (
                  <button
                    key={s}
                    onClick={() => handleSpeedSelect(s)}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-lg text-left cursor-pointer transition-colors ${
                      playbackSpeed === s ? 'bg-[#25f4ee] text-black' : 'text-neutral-300 hover:bg-white/10'
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

      {/* Interactive Bottom Progress Bar Scrubber */}
      {!isImage && (
        <div 
          ref={progressBarRef}
          onClick={handleScrub}
          className="absolute bottom-0 left-0 right-0 h-1.5 bg-white/15 z-30 cursor-pointer group flex items-end"
        >
          <div
            className="h-0.5 group-hover:h-1.5 bg-gradient-to-r from-[#25f4ee] to-[#ff2b54] transition-all duration-75 relative"
            style={{ width: `${progress}%` }}
          >
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white opacity-0 group-hover:opacity-100 shadow-md" />
          </div>
        </div>
      )}

      {/* Bottom-Left Meta: Caption, Creator, Sound, and Search Pill */}
      <div className="relative z-20 p-3.5 pb-14 max-w-[75%] pointer-events-auto">
        {video.playlistTitle && (
          <div
            onClick={() => onOpenPlaylists && onOpenPlaylists(video)}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/60 border border-[#25f4ee]/40 text-[#25f4ee] text-[9.5px] font-extrabold mb-1 cursor-pointer hover:bg-black/80 shadow"
          >
            <FolderHeart className="w-2.5 h-2.5" /> Playlist: {video.playlistTitle}
          </div>
        )}

        <div
          onClick={() => onOpenProfile(video.ownerHandle, video.ownerUid)}
          className="flex items-center gap-1.5 cursor-pointer mb-1"
        >
          <span className="font-bold text-white text-sm hover:underline drop-shadow-md">
            {video.ownerHandle}
          </span>
          {video.verified && <VerifiedBadge size="sm" />}
        </div>

        <p className={`text-white text-xs leading-snug drop-shadow-md mb-1.5 font-normal ${isExpandedCaption ? '' : 'line-clamp-2'}`}>
          {video.caption}
        </p>
        {video.caption && video.caption.length > 80 && (
          <button
            onClick={() => setIsExpandedCaption(!isExpandedCaption)}
            className="text-[10px] font-bold text-neutral-300 hover:text-white mb-1.5 underline block"
          >
            {isExpandedCaption ? 'Less' : 'More'}
          </button>
        )}

        {video.tags && video.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-1.5">
            {video.tags.map((tag, i) => (
              <span
                key={i}
                onClick={() => onTagClick && onTagClick(tag)}
                className="text-[#25f4ee] text-[11px] font-semibold drop-shadow cursor-pointer hover:underline"
              >
                #{tag.replace('#', '')}
              </span>
            ))}
          </div>
        )}

        {/* Scrolling Sound Ticker */}
        <div 
          onClick={handleSoundTap}
          className="flex items-center gap-1.5 text-white/90 text-[11px] font-semibold drop-shadow cursor-pointer hover:text-[#25f4ee] transition-colors mb-2 overflow-hidden max-w-[210px]"
        >
          <Music className="w-3 h-3 shrink-0 text-[#25f4ee]" />
          <div className="overflow-hidden whitespace-nowrap mask-gradient">
            <span className="animate-marquee inline-block pr-4">
              {video.sound || 'Original audio — Pulse'}
            </span>
          </div>
        </div>

        {/* Related Search Pill (Matching TikTok Mobile UX) */}
        <div
          onClick={() => {
            const queryTerm = video.tags && video.tags.length > 0 
              ? video.tags[0].replace('#', '') 
              : video.sound 
              ? video.sound.replace(/^Original (sound|audio) — /, '')
              : video.ownerHandle.replace(/^@/, '');
            if (onSearchPrompt) {
              onSearchPrompt(queryTerm);
            }
          }}
          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-black/60 backdrop-blur-md border border-white/15 text-white/90 hover:text-white text-[10px] font-bold shadow-lg cursor-pointer hover:bg-black/80 hover:border-[#25f4ee]/50 transition-all active:scale-95"
        >
          <span className="text-[#25f4ee] font-black">Search</span>
          <span className="text-neutral-400">·</span>
          <span className="truncate max-w-[130px] text-neutral-200">
            {video.tags && video.tags.length > 0 
              ? `#${video.tags[0].replace('#', '')}` 
              : video.sound 
              ? video.sound.slice(0, 16)
              : video.ownerHandle}
          </span>
          <span className="text-neutral-400 text-[10px]">›</span>
        </div>
      </div>

      {/* Right Interaction Rail (Compact & Scaled Down) */}
      <div className="absolute right-2 bottom-12 z-20 flex flex-col items-center gap-2 pointer-events-auto pb-1">
        {/* Creator Avatar & Follow Button */}
        <div className="relative mb-0.5">
          <img
            onClick={() => onOpenProfile(video.ownerHandle, video.ownerUid)}
            src={video.ownerAvatar}
            alt={video.ownerHandle}
            className="w-8 h-8 rounded-full border border-white/80 object-cover cursor-pointer shadow-md hover:scale-105 transition-transform"
          />
          {currentUser?.uid !== video.ownerUid && (
            <button
              onClick={handleFollow}
              disabled={followPending}
              className={`absolute -bottom-1 left-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] font-black border border-black cursor-pointer shadow-sm transition-all disabled:opacity-60 ${
                isFollowing ? 'bg-neutral-800 text-white' : 'bg-[#ff2b54] text-white hover:scale-110'
              }`}
            >
              {isFollowing ? <Check className="w-2 h-2" /> : '+'}
            </button>
          )}
        </div>

        {/* Like Action */}
        <div onClick={handleLike} className="flex flex-col items-center gap-0.5 cursor-pointer group">
          <div className="w-6 h-6 rounded-full flex items-center justify-center transition-transform active:scale-125">
            <Heart
              className={`w-5 h-5 drop-shadow-md transition-colors ${
                liked ? 'fill-[#ff2b54] text-[#ff2b54]' : 'text-white group-hover:scale-110'
              }`}
            />
          </div>
          <span className="text-white text-[9.5px] font-bold drop-shadow">
            {formatCount(likeCount)}
          </span>
        </div>

        {/* Comment Action */}
        <div
          onClick={() => {
            if (!currentUser) {
              onRequireAuth();
              return;
            }
            onOpenComments(video);
          }}
          className="flex flex-col items-center gap-0.5 cursor-pointer group"
        >
          <div className="w-6 h-6 rounded-full flex items-center justify-center transition-transform active:scale-125">
            <MessageCircle className="w-5 h-5 text-white drop-shadow-md group-hover:scale-110" />
          </div>
          <span className="text-white text-[9.5px] font-bold drop-shadow">
            {formatCount(video.commentCount)}
          </span>
        </div>

        {/* Bookmark / Save Action */}
        <div onClick={handleSave} className="flex flex-col items-center gap-0.5 cursor-pointer group">
          <div className="w-6 h-6 rounded-full flex items-center justify-center transition-transform active:scale-125">
            <Bookmark
              className={`w-4.5 h-4.5 drop-shadow-md transition-colors ${
                saved ? 'fill-[#ffd54a] text-[#ffd54a]' : 'text-white group-hover:scale-110'
              }`}
            />
          </div>
          <span className="text-white text-[9.5px] font-bold drop-shadow">
            {formatCount(saveCount)}
          </span>
        </div>

        {/* Repost Action */}
        <div onClick={handleRepost} className="flex flex-col items-center gap-0.5 cursor-pointer group">
          <div className="w-6 h-6 rounded-full flex items-center justify-center transition-transform active:scale-125">
            <Repeat
              className={`w-4.5 h-4.5 drop-shadow-md transition-colors ${
                reposted ? 'text-[#25f4ee] scale-110' : 'text-white group-hover:scale-110'
              }`}
            />
          </div>
          <span className="text-white text-[9.5px] font-bold drop-shadow">
            {formatCount(repostCount)}
          </span>
        </div>

        {/* Share Action */}
        <div onClick={handleShareClick} className="flex flex-col items-center gap-0.5 cursor-pointer group">
          <div className="w-6 h-6 rounded-full flex items-center justify-center transition-transform active:scale-125">
            <Share2 className="w-4.5 h-4.5 text-white drop-shadow-md group-hover:scale-110" />
          </div>
          <span className="text-white text-[9.5px] font-bold drop-shadow">
            {formatCount(video.shareCount || 18)}
          </span>
        </div>

        {/* Tip / Gift Creator Action */}
        <div
          onClick={() => {
            if (!currentUser) {
              onRequireAuth();
              return;
            }
            setShowGiftPicker(true);
          }}
          className="flex flex-col items-center gap-0.5 cursor-pointer group"
        >
          <div className="w-6 h-6 rounded-full bg-gradient-to-r from-yellow-400 to-amber-500 flex items-center justify-center transition-transform active:scale-125 shadow-md">
            <Gift className="w-3.5 h-3.5 text-black" />
          </div>
          <span className="text-yellow-400 text-[9px] font-bold drop-shadow">
            Tip
          </span>
        </div>

        {/* More Options Menu (Mute/Unmute Audio, Edit, Delete, Not Interested, Playlist, Report) */}
        <div className="relative">
          <button
            onClick={() => setShowOptions(!showOptions)}
            className={`w-6 h-6 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/70 transition-colors cursor-pointer ${
              showOptions ? 'bg-white/30 text-[#25f4ee]' : ''
            }`}
            title="Video options & sound"
          >
            <MoreVertical className="w-3 h-3" />
          </button>
          {showOptions && (
            <>
              {/* Invisible backdrop to dismiss menu on tap outside */}
              <div 
                className="fixed inset-0 z-40" 
                onClick={(e) => {
                  e.stopPropagation();
                  setShowOptions(false);
                }} 
              />
              <div className="absolute right-0 bottom-9 bg-[#17181c]/95 backdrop-blur-xl border border-white/15 rounded-xl p-1 w-44 shadow-2xl flex flex-col gap-0.5 z-50 animate-in fade-in">
                {/* Audio Mute / Unmute Toggle */}
                <button
                  onClick={() => {
                    if (onToggleMute) {
                      onToggleMute();
                      onToast(muted ? 'Audio unmuted 🔊' : 'Audio muted 🔇');
                    }
                  }}
                  className="flex items-center justify-between px-2 py-1 text-[11px] font-medium text-white hover:bg-white/10 rounded-lg w-full text-left cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    {muted ? (
                      <VolumeX className="w-3 h-3 text-red-400 shrink-0" />
                    ) : (
                      <Volume2 className="w-3 h-3 text-[#25f4ee] shrink-0" />
                    )}
                    <span>{muted ? 'Unmute Audio' : 'Mute Audio'}</span>
                  </div>
                  <span className={`text-[8.5px] font-extrabold px-1 py-0.2 rounded ${
                    muted ? 'bg-red-500/20 text-red-300' : 'bg-emerald-500/20 text-emerald-300'
                  }`}>
                    {muted ? 'MUTED' : 'ON'}
                  </span>
                </button>

                {/* Download / Save Video to Device */}
                <button
                  onClick={async () => {
                    setShowOptions(false);
                    try {
                      onToast('Downloading video... 📥');
                      const res = await fetch(video.src);
                      const blob = await res.blob();
                      const url = window.URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `pulse_video_${video.id}.mp4`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      window.URL.revokeObjectURL(url);
                      onToast('Video saved to device! ✅');
                    } catch (err) {
                      const a = document.createElement('a');
                      a.href = video.src;
                      a.target = '_blank';
                      a.download = `pulse_video_${video.id}.mp4`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      onToast('Download link opened 📥');
                    }
                  }}
                  className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium text-white hover:bg-white/10 rounded-lg w-full text-left cursor-pointer transition-colors"
                >
                  <Download className="w-3 h-3 text-[#ffd54a]" />
                  <span>Download Video</span>
                </button>

                <div className="my-0.5 border-t border-white/10" />

                {isOwner && (
                  <>
                    <button
                      onClick={() => {
                        setShowOptions(false);
                        onEditVideo(video);
                      }}
                      className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium text-white hover:bg-white/10 rounded-lg w-full text-left cursor-pointer"
                    >
                      <Edit3 className="w-3 h-3 text-[#25f4ee]" /> Edit Details
                    </button>
                    <button
                      onClick={() => {
                        setShowOptions(false);
                        if (onOpenPlaylists) onOpenPlaylists(video);
                      }}
                      className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium text-white hover:bg-white/10 rounded-lg w-full text-left cursor-pointer"
                    >
                      <FolderHeart className="w-3 h-3 text-[#ffd54a]" /> Add to Playlist
                    </button>
                    <button
                      onClick={() => {
                        setShowOptions(false);
                        if (confirm('Delete this video from Pulse?')) {
                          onDeleteVideo(video.id);
                        }
                      }}
                      className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium text-[#ff2b54] hover:bg-[#ff2b54]/10 rounded-lg w-full text-left cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" /> Delete
                    </button>
                  </>
                )}

                <button
                  onClick={() => {
                    setShowOptions(false);
                    if (onHideVideo) onHideVideo(video.id);
                    onToast('Video hidden — we will show fewer videos like this');
                  }}
                  className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium text-neutral-300 hover:bg-white/10 rounded-lg w-full text-left cursor-pointer"
                >
                  <EyeOff className="w-3 h-3 text-neutral-400" /> Not Interested
                </button>

                <button
                  onClick={() => {
                    setShowOptions(false);
                    onOpenReport('video', video.id, video.ownerHandle);
                  }}
                  className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium text-red-400 hover:bg-red-500/10 rounded-lg w-full text-left cursor-pointer"
                >
                  <Flag className="w-3 h-3" /> Report Video
                </button>
              </div>
            </>
          )}
        </div>

        {/* Spinning Disc with sound click */}
        <div 
          onClick={handleSoundTap}
          className="w-8 h-8 rounded-full bg-neutral-900 border border-neutral-600 overflow-hidden animate-[spin_6s_linear_infinite] shadow-xl cursor-pointer hover:border-[#25f4ee] transition-colors"
        >
          <img src={video.ownerAvatar} alt="Sound art" className="w-full h-full object-cover" />
        </div>
      </div>

      {/* Gift / Tip Picker Sheet */}
      <GiftPickerSheet
        isOpen={showGiftPicker}
        currentUser={currentUser}
        hostProfile={{
          uid: video.ownerUid,
          handle: video.ownerHandle,
          username: video.ownerHandle,
          avatar: video.ownerAvatar
        }}
        onClose={() => setShowGiftPicker(false)}
        onSendGift={handleSendTip}
        onOpenRecharge={() => {
          setShowGiftPicker(false);
          setShowWalletModal(true);
        }}
        onRequireAuth={onRequireAuth}
        onToast={onToast}
      />

      {/* Creator Wallet Modal */}
      {currentUser && (
        <CreatorWalletModal
          isOpen={showWalletModal}
          currentUser={currentUser}
          onClose={() => setShowWalletModal(false)}
          onToast={onToast}
        />
      )}
    </div>
  );
};

export const VideoSlide = React.memo(VideoSlideComponent);

