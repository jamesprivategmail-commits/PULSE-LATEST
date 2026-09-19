import React, { useRef, useState, useEffect } from 'react';
import { VideoPost, UserProfile } from '../types';
import {
  toggleVideoLike,
  toggleVideoSave,
  toggleRepostVideo,
  checkUserLikedVideo,
  checkUserSavedVideo,
  checkIsFollowing,
  toggleFollowUser,
  recordVideoView
} from '../services/pulseDb';
import { formatCount } from '../utils/formatters';
import {
  Heart,
  MessageCircle,
  Bookmark,
  Share2,
  MoreVertical,
  Repeat,
  Check
} from 'lucide-react';
import { VerifiedBadge } from './VerifiedBadge';

interface PostCardProps {
  video: VideoPost;
  currentUser: UserProfile | null;
  isFollowing?: boolean;
  onOpenComments: (video: VideoPost) => void;
  onOpenProfile: (handle: string, uid: string) => void;
  onOpenShare?: (video: VideoPost) => void;
  onOpenReport: (type: 'video', id: string, handle?: string) => void;
  onFollowToggle?: (targetUid: string, isFollowing: boolean) => void;
  onToast: (msg: string) => void;
  onRequireAuth: () => void;
}

// Card version of a post for the scrollable Home feed — mirrors the design's
// `.post` layout (header row, media, action row, likes, caption) instead of
// VideoSlide's full-screen swipe layout. Reuses the same data + backend
// actions as the video feed so likes/saves/reposts/follows stay in sync.
export const PostCard: React.FC<PostCardProps> = ({
  video,
  currentUser,
  isFollowing: propIsFollowing,
  onOpenComments,
  onOpenProfile,
  onOpenShare,
  onOpenReport,
  onFollowToggle,
  onToast,
  onRequireAuth
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaContainerRef = useRef<HTMLDivElement>(null);
  const [liked, setLiked] = useState(!!video.isLiked);
  const [likeCount, setLikeCount] = useState(video.likeCount || 0);
  const [saved, setSaved] = useState(!!video.isSaved);
  const [reposted, setReposted] = useState(!!video.isReposted);
  const [isFollowing, setIsFollowing] = useState(propIsFollowing || false);
  const [followPending, setFollowPending] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const viewRecordedRef = useRef(false);
  const isLikingRef = useRef(false);
  const isImage = video.mediaType === 'image' || video.mediaType === 'carousel';

  useEffect(() => {
    if (propIsFollowing !== undefined) setIsFollowing(propIsFollowing);
  }, [propIsFollowing]);

  // Instagram/TikTok-style feed autoplay: play this card's video only while
  // it's substantially in view, pause it once scrolled past. Previously
  // there was no visibility tracking at all here — videos in the home feed
  // never autoplayed and never paused on scroll, they just sat static with
  // native controls until manually tapped.
  useEffect(() => {
    const el = mediaContainerRef.current;
    if (!el || isImage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        const vid = videoRef.current;
        if (!vid) return;
        if (entry.isIntersecting) {
          const playPromise = vid.play();
          if (playPromise && typeof playPromise.catch === 'function') {
            // Autoplay with sound can be blocked without a recent user
            // gesture (this fires from scrolling, not a tap/click). Fall
            // back to muted playback rather than leaving the video frozen
            // on its poster frame with no feedback.
            playPromise.catch(() => {
              vid.muted = true;
              vid.play().catch(() => {});
            });
          }
        } else {
          vid.pause();
        }
      },
      { threshold: 0.6 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [isImage, video.id]);

  useEffect(() => {
    if (!currentUser) return;
    checkUserLikedVideo(video.id, currentUser.uid).then(setLiked);
    checkUserSavedVideo(video.id, currentUser.uid).then(setSaved);
    if (propIsFollowing === undefined && video.ownerUid && video.ownerUid !== currentUser.uid) {
      checkIsFollowing(currentUser.uid, video.ownerUid).then(setIsFollowing);
    }
  }, [video.id, currentUser?.uid]);

  const handleLike = async () => {
    if (!currentUser) return onRequireAuth();
    // Guard against overlapping calls (rapid re-taps): two concurrent
    // toggleVideoLike calls can both read the "not liked" doc before either
    // write commits, double-incrementing likeCount server-side.
    if (isLikingRef.current) return;
    isLikingRef.current = true;
    const next = !liked;
    setLiked(next);
    setLikeCount(c => Math.max(0, c + (next ? 1 : -1)));
    try {
      const persisted = await toggleVideoLike(video.id, currentUser);
      setLiked(persisted);
    } catch (error: any) {
      setLiked(!next);
      setLikeCount(c => Math.max(0, c + (next ? -1 : 1)));
      onToast(error?.message || 'Like could not be saved. Please try again.');
    } finally {
      isLikingRef.current = false;
    }
  };

  const handleSave = async () => {
    if (!currentUser) return onRequireAuth();
    const next = !saved;
    setSaved(next);
    try {
      await toggleVideoSave(video.id, currentUser);
      onToast(next ? 'Saved' : 'Removed from saved');
    } catch {
      setSaved(!next);
    }
  };

  const handleRepost = async () => {
    if (!currentUser) return onRequireAuth();
    const next = !reposted;
    setReposted(next);
    try {
      await toggleRepostVideo(video, currentUser);
      onToast(next ? 'Reposted to your profile! 🔁' : 'Removed repost');
    } catch {
      setReposted(!next);
    }
  };

  const handleFollow = async () => {
    if (!currentUser) return onRequireAuth();
    if (followPending) return;
    setFollowPending(true);
    try {
      const next = await toggleFollowUser(currentUser.uid, video.ownerUid, currentUser, video.ownerHandle);
      setIsFollowing(next);
      onFollowToggle?.(video.ownerUid, next);
    } catch (err: any) {
      onToast(err?.message === 'blocked' ? "You can't follow this user" : 'Something went wrong — try again');
    } finally {
      setFollowPending(false);
    }
  };

  const handleMediaVisible = () => {
    if (viewRecordedRef.current || !currentUser) return;
    viewRecordedRef.current = true;
    recordVideoView(video.id).catch(() => {});
  };

  return (
    <article className="border-b border-white/[0.06] pb-3.5 last:border-b-0">
      {/* Header */}
      <div className="min-h-[58px] px-3.5 py-2.5 flex items-center justify-between">
        <div
          className="flex items-center gap-2.5 cursor-pointer min-w-0"
          onClick={() => onOpenProfile(video.ownerHandle, video.ownerUid)}
        >
          <div className="w-9 h-9 rounded-full p-[1.5px] bg-gradient-to-tr from-[#25f4ee] via-[#a06cff] to-[#ff2b54] shrink-0">
            <img
              src={video.ownerAvatar}
              alt={video.ownerHandle}
              className="w-full h-full rounded-full object-cover ring-2 ring-black block"
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1 text-[13px] font-semibold text-white truncate">
              <span className="truncate">{video.ownerUsername || video.ownerHandle}</span>
              {video.verified && <VerifiedBadge size="xs" />}
            </div>
            <div className="text-[11px] text-neutral-500 -mt-0.5">
              {timeAgo(video.createdAt)}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {currentUser?.uid !== video.ownerUid && (
            <button
              onClick={handleFollow}
              disabled={followPending}
              className={`h-7 px-3 rounded-lg text-[12px] font-semibold active:scale-95 transition-all disabled:opacity-60 ${
                isFollowing
                  ? 'text-neutral-400 hover:bg-white/[0.06]'
                  : 'text-[#25f4ee] hover:bg-[#25f4ee]/10'
              }`}
            >
              {isFollowing ? 'Following' : 'Follow'}
            </button>
          )}
          <div className="relative">
            <button
              onClick={() => setShowMenu(v => !v)}
              className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-300 hover:bg-white/[0.06] active:scale-90 transition-all"
            >
              <MoreVertical className="w-[18px] h-[18px]" />
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 top-9 z-20 w-44 bg-[#161618] border border-white/10 rounded-2xl shadow-2xl overflow-hidden py-1 animate-in fade-in zoom-in-95 duration-150 origin-top-right">
                  <button
                    onClick={() => { setShowMenu(false); onOpenReport('video', video.id, video.ownerHandle); }}
                    className="w-full text-left px-4 py-2.5 text-[13px] font-medium text-red-400 hover:bg-white/5 transition-colors"
                  >
                    Report
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Media */}
      <div
        ref={mediaContainerRef}
        className="w-full bg-[#0d0d0f] cursor-pointer relative group"
        onDoubleClick={() => { if (!liked) handleLike(); onToast('❤️ Liked'); }}
        onClick={handleMediaVisible}
      >
        {isImage ? (
          <img
            src={video.coverUrl || video.images?.[0] || video.src}
            alt=""
            className="w-full max-h-[720px] min-h-[280px] object-cover block"
          />
        ) : (
          <video
            ref={videoRef}
            src={video.src}
            poster={video.coverUrl}
            className="w-full max-h-[720px] min-h-[280px] object-cover block"
            controls
            muted
            loop
            playsInline
            preload="metadata"
          />
        )}
      </div>

      {/* Content */}
      <div className="px-3.5 pt-1.5">
        <div className="flex items-center gap-0.5 -ml-2">
          <button
            onClick={handleLike}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-transform active:scale-75 ${
              liked ? 'text-[#ff5361]' : 'text-white hover:text-neutral-300'
            }`}
          >
            <Heart className="w-[26px] h-[26px]" strokeWidth={liked ? 0 : 1.8} fill={liked ? 'currentColor' : 'none'} />
          </button>
          <button
            onClick={() => onOpenComments(video)}
            className="w-10 h-10 rounded-full flex items-center justify-center text-white active:scale-75 transition-transform"
          >
            <MessageCircle className="w-[24px] h-[24px]" strokeWidth={1.8} />
          </button>
          <button
            onClick={handleRepost}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-transform active:scale-75 ${
              reposted ? 'text-[#36d781]' : 'text-white'
            }`}
          >
            <Repeat className="w-[24px] h-[24px]" strokeWidth={1.8} />
          </button>
          <button
            onClick={() => onOpenShare?.(video)}
            className="w-10 h-10 rounded-full flex items-center justify-center text-white active:scale-75 transition-transform"
          >
            <Share2 className="w-[22px] h-[22px]" strokeWidth={1.8} />
          </button>
          <button
            onClick={handleSave}
            className={`w-10 h-10 rounded-full flex items-center justify-center ml-auto transition-transform active:scale-75 ${
              saved ? 'text-[#ffbd1a]' : 'text-white'
            }`}
          >
            <Bookmark className="w-[22px] h-[22px]" strokeWidth={1.8} fill={saved ? 'currentColor' : 'none'} />
          </button>
        </div>

        <div className="text-[13px] font-semibold text-white">
          {formatCount(likeCount)} likes
        </div>

        {video.caption && (
          <div className="mt-1 text-[13px] text-neutral-200 leading-snug">
            <strong className="text-white mr-1.5 font-semibold">{video.ownerUsername || video.ownerHandle}</strong>
            {video.caption}
          </div>
        )}

        {video.commentCount > 0 && (
          <div
            onClick={() => onOpenComments(video)}
            className="mt-1 text-[13px] text-neutral-500 cursor-pointer hover:text-neutral-400"
          >
            View {formatCount(video.commentCount)} comments
          </div>
        )}
      </div>
    </article>
  );
};

function timeAgo(ts: number): string {
  const diff = Math.max(0, Date.now() - (ts || Date.now()));
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
