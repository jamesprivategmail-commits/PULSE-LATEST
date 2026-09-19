import React, { useState, useEffect } from 'react';
import { UserProfile, VideoPost, VirtualGift } from '../types';
import { 
  fetchUserProfileByHandle, 
  fetchUserProfileByUid, 
  fetchUserVideos, 
  toggleFollowUser, 
  checkIsFollowing,
  sendFollowRequest,
  blockUser,
  unblockUser,
  subscribeToUserProfile,
  sendTipToCreator
} from '../services/pulseDb';
import { formatCount } from '../utils/formatters';
import { 
  ArrowLeft, 
  MoreVertical, 
  MessageSquare, 
  UserPlus, 
  Check, 
  Lock, 
  Globe, 
  Instagram, 
  Youtube, 
  UserX, 
  Flag, 
  Share2, 
  Bell, 
  Clock, 
  Play,
  Phone,
  Video,
  Gift
} from 'lucide-react';
import { VerifiedBadge } from './VerifiedBadge';
import { ProfilePostViewerModal } from './ProfilePostViewerModal';
import { GridThumb } from './GridThumb';
import { GiftPickerSheet } from './GiftPickerSheet';
import { CreatorWalletModal } from './CreatorWalletModal';

interface OtherProfilePageProps {
  isOpen: boolean;
  handle: string;
  creatorUid?: string;
  currentUser: UserProfile | null;
  onClose: () => void;
  onSelectVideo: (video: VideoPost) => void;
  onOpenChat: (user: { uid: string; handle: string; username: string; avatar: string; verified?: boolean }) => void;
  onOpenReport: (targetType: 'video' | 'user' | 'comment', targetId: string, handle?: string) => void;
  onOpenFollowList: (mode: 'followers' | 'following' | 'requests', uid: string) => void;
  onRequireAuth: () => void;
  onToast: (msg: string) => void;
  onStartCall?: (recipient: { uid: string; handle: string; username?: string; avatar: string }, type: 'voice' | 'video') => void;
  onFollowToggle?: (targetUid: string, isFollowing: boolean) => void;
}

export const OtherProfilePage: React.FC<OtherProfilePageProps> = ({
  isOpen,
  handle,
  creatorUid,
  currentUser,
  onClose,
  onSelectVideo,
  onOpenChat,
  onOpenReport,
  onOpenFollowList,
  onRequireAuth,
  onToast,
  onStartCall,
  onFollowToggle
}) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [videos, setVideos] = useState<VideoPost[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followPending, setFollowPending] = useState(false);
  const [isRequested, setIsRequested] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [viewerVideoIndex, setViewerVideoIndex] = useState<number | null>(null);
  const [showGiftPicker, setShowGiftPicker] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);

  const handleSendTip = async (gift: VirtualGift) => {
    if (!currentUser || !profile) return;
    try {
      await sendTipToCreator(
        currentUser,
        profile.uid,
        profile.handle,
        profile.photoURL || 'https://api.dicebear.com/7.x/avataaars/svg?seed=user',
        gift
      );
      onToast(`Tipped ${gift.icon} ${gift.name} to ${profile.handle}! 💖`);
    } catch (err: any) {
      onToast(err.message || 'Failed to send tip');
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    let unsubscribeProfile = () => {};

    async function loadCreatorData() {
      try {
        let p: UserProfile | null = null;
        if (creatorUid) {
          p = await fetchUserProfileByUid(creatorUid);
        }
        if (!p && handle) {
          p = await fetchUserProfileByHandle(handle);
        }

        if (p) {
          setProfile(p);
          setFollowerCount(p.followers || 0);

          unsubscribeProfile = subscribeToUserProfile(p.uid, (updated) => {
            if (updated) {
              setProfile(updated);
              setFollowerCount(updated.followers || 0);
            }
          });

          if (currentUser && currentUser.uid !== p.uid) {
            const isFol = await checkIsFollowing(currentUser.uid, p.uid);
            setIsFollowing(isFol);
            setIsBlocked(currentUser.blockedUids?.includes(p.uid) || false);
          }

          const vList = await fetchUserVideos(p.uid);
          setVideos(vList);
        }
      } catch (err) {
        console.error('Error loading creator:', err);
      }
    }

    loadCreatorData();

    return () => {
      unsubscribeProfile();
    };
  }, [isOpen, creatorUid, handle, currentUser?.uid]);

  if (!isOpen) return null;

  const handleToggleFollow = async () => {
    if (!currentUser) {
      onRequireAuth();
      return;
    }
    if (!profile) return;
    if (followPending) return; // ignore rapid double-taps while a toggle is in flight

    if (profile.isPrivate && !isFollowing) {
      setIsRequested(true);
      await sendFollowRequest(currentUser, profile.uid);
      onToast(`Follow request sent to ${profile.handle}`);
      return;
    }

    setFollowPending(true);
    try {
      const nowFollowing = await toggleFollowUser(currentUser.uid, profile.uid, currentUser, profile.handle);
      setIsFollowing(nowFollowing);
      if (onFollowToggle) {
        onFollowToggle(profile.uid, nowFollowing);
      }
      setFollowerCount(prev => Math.max(0, prev + (nowFollowing ? 1 : -1)));
      onToast(nowFollowing ? `You followed ${profile.handle}` : `You unfollowed ${profile.handle}`);
    } catch (err: any) {
      if (err?.message === 'blocked') {
        onToast(`You can't follow ${profile.handle}`);
      } else {
        onToast('Something went wrong — try again');
      }
    } finally {
      setFollowPending(false);
    }
  };

  const handleToggleBlock = async () => {
    if (!currentUser || !profile) return;
    try {
      if (isBlocked) {
        await unblockUser(currentUser.uid, profile.uid);
        setIsBlocked(false);
        onToast(`Unblocked ${profile.handle}`);
      } else {
        await blockUser(currentUser.uid, profile.uid);
        setIsBlocked(true);
        onToast(`Blocked ${profile.handle}`);
      }
      setShowOptionsMenu(false);
    } catch (e) {
      onToast('Failed to update block state');
    }
  };

  const avatar = profile?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(handle || 'creator')}`;
  const isLockedPrivate = profile?.isPrivate && !isFollowing && currentUser?.uid !== profile?.uid;

  return (
    <div className="fixed inset-0 z-50 bg-black text-white max-w-[480px] mx-auto flex flex-col overflow-y-auto animate-in fade-in select-none font-sans">
      {/* 1. Header (Tight, Pure Black) */}
      <div className="px-header sticky top-0 z-30">
        <button
          onClick={onClose}
          className="px-icon-btn"
        >
          <ArrowLeft className="w-[18px] h-[18px]" />
        </button>

        <div className="flex items-center gap-1 min-w-0">
          <span className="font-extrabold text-sm truncate" style={{ color: 'var(--text)' }}>
            {profile?.username || handle}
          </span>
          {profile?.verified && <VerifiedBadge size="xs" />}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              navigator.clipboard?.writeText(window.location.href);
              onToast('Link copied 🔗');
            }}
            className="px-icon-btn"
          >
            <Share2 className="w-[18px] h-[18px]" />
          </button>
          <div className="relative">
            <button
              onClick={() => setShowOptionsMenu(!showOptionsMenu)}
              className="px-icon-btn"
            >
              <MoreVertical className="w-[18px] h-[18px]" />
            </button>
            {showOptionsMenu && (
              <div className="absolute right-0 top-8 bg-neutral-900 border border-white/15 rounded-2xl p-1.5 w-40 shadow-xl flex flex-col gap-1 z-50 animate-in fade-in">
                <button
                  onClick={handleToggleBlock}
                  className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-neutral-200 hover:bg-white/10 rounded-xl w-full text-left cursor-pointer"
                >
                  <UserX className="w-3.5 h-3.5" /> {isBlocked ? 'Unblock' : 'Block'}
                </button>
                <button
                  onClick={() => {
                    setShowOptionsMenu(false);
                    if (profile) onOpenReport('user', profile.uid, profile.handle);
                  }}
                  className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-rose-400 hover:bg-rose-500/10 rounded-xl w-full text-left cursor-pointer"
                >
                  <Flag className="w-3.5 h-3.5" /> Report
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. Profile Details */}
      <div className="flex flex-col items-center px-4 pt-3 pb-1.5" style={{ background: 'var(--bg)' }}>
        <div
          className="rounded-full relative mb-1.5"
          style={{
            width: 88, height: 88, padding: 3,
            background: 'linear-gradient(135deg,#fff,#777,#fff)',
            boxShadow: '0 0 0 4px var(--bg), 0 14px 40px rgba(0,0,0,.5)'
          }}
        >
          <img
            src={avatar}
            alt={handle}
            className="w-full h-full object-cover rounded-full"
            style={{ border: '2px solid var(--bg)' }}
          />
        </div>

        <span className="font-black" style={{ fontSize: 18, letterSpacing: '-.4px', color: 'var(--text)' }}>{profile?.username || handle}</span>
        <span className="text-[11.5px] font-normal mt-0.5" style={{ color: 'var(--muted)' }}>{profile?.handle || handle}</span>

        {/* Following | Followers | Likes row */}
        <div
          className="grid grid-cols-3 w-full max-w-[280px] my-3 py-2"
          style={{ borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}
        >
          <div
            onClick={() => profile && onOpenFollowList('following', profile.uid)}
            className="flex flex-col items-center cursor-pointer hover:opacity-80 transition-opacity"
          >
            <b className="font-extrabold" style={{ fontSize: 14, color: 'var(--text)' }}>{formatCount(profile?.following || 0)}</b>
            <span className="mt-0.5" style={{ fontSize: 9.5, color: 'var(--dim)' }}>Following</span>
          </div>

          <div
            onClick={() => profile && onOpenFollowList('followers', profile.uid)}
            className="flex flex-col items-center cursor-pointer hover:opacity-80 transition-opacity"
            style={{ borderLeft: '1px solid var(--line)', borderRight: '1px solid var(--line)' }}
          >
            <b className="font-extrabold" style={{ fontSize: 14, color: 'var(--text)' }}>{formatCount(followerCount)}</b>
            <span className="mt-0.5" style={{ fontSize: 9.5, color: 'var(--dim)' }}>Followers</span>
          </div>

          <div className="flex flex-col items-center">
            <b className="font-extrabold" style={{ fontSize: 14, color: 'var(--text)' }}>{formatCount(profile?.likesReceived || 0)}</b>
            <span className="mt-0.5" style={{ fontSize: 9.5, color: 'var(--dim)' }}>Likes</span>
          </div>
        </div>

        {/* Action Buttons: Follow | Message */}
        <div className="flex items-center justify-center gap-2 mt-1.5 w-full max-w-[320px]">
          <button
            onClick={handleToggleFollow}
            disabled={followPending}
            className={`flex-1 h-10 px-3 text-[13px] font-bold rounded-full transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-60 ${
              isFollowing
                ? 'bg-neutral-800 text-white border border-white/10 hover:bg-neutral-700'
                : isRequested
                ? 'bg-neutral-800 text-amber-400 border border-white/10'
                : 'bg-[#fe2c55] hover:bg-[#e0244a] text-white'
            }`}
          >
            {isFollowing ? (
              <>
                <Check className="w-4 h-4 stroke-[2.5]" /> Following
              </>
            ) : isRequested ? (
              <>
                <Clock className="w-4 h-4 stroke-[2.5]" /> Requested
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4 stroke-[2.5]" /> Follow
              </>
            )}
          </button>

          <button
            onClick={() => {
              if (!currentUser) {
                onRequireAuth();
                return;
              }
              onOpenChat({
                uid: profile?.uid || creatorUid || '',
                handle: profile?.handle || handle,
                username: profile?.username || profile?.handle || handle,
                avatar: profile?.photoURL || avatar,
                verified: profile?.verified
              });
            }}
            className="flex-1 h-10 px-3 bg-neutral-800 hover:bg-neutral-700 text-white font-bold rounded-full text-[13px] transition-colors cursor-pointer flex items-center justify-center gap-1.5 border border-white/10"
          >
            <MessageSquare className="w-4 h-4 text-neutral-300" /> Message
          </button>

          {/* Quick Voice Call Button */}
          <button
            type="button"
            onClick={() => {
              if (!currentUser) {
                onRequireAuth();
                return;
              }
              if (onStartCall) {
                onStartCall({
                  uid: profile?.uid || creatorUid || '',
                  handle: profile?.handle || handle,
                  username: profile?.username || profile?.handle || handle,
                  avatar: profile?.photoURL || avatar
                }, 'voice');
              }
            }}
            className="w-10 h-10 bg-neutral-800 hover:bg-[#25f4ee] hover:text-black text-neutral-300 rounded-full flex items-center justify-center transition-colors cursor-pointer border border-white/10 shrink-0"
            title="Voice Call"
          >
            <Phone className="w-4 h-4" />
          </button>

          {/* Quick Video Call Button */}
          <button
            type="button"
            onClick={() => {
              if (!currentUser) {
                onRequireAuth();
                return;
              }
              if (onStartCall) {
                onStartCall({
                  uid: profile?.uid || creatorUid || '',
                  handle: profile?.handle || handle,
                  username: profile?.username || profile?.handle || handle,
                  avatar: profile?.photoURL || avatar
                }, 'video');
              }
            }}
            className="w-10 h-10 bg-neutral-800 hover:bg-[#ff2b54] text-neutral-300 rounded-full flex items-center justify-center transition-colors cursor-pointer border border-white/10 shrink-0"
            title="Video Call"
          >
            <Video className="w-4 h-4" />
          </button>

          {/* Quick Tip / Gift Creator Button */}
          <button
            type="button"
            onClick={() => {
              if (!currentUser) {
                onRequireAuth();
                return;
              }
              setShowGiftPicker(true);
            }}
            className="w-10 h-10 bg-gradient-to-r from-yellow-400 to-amber-500 hover:opacity-90 text-black rounded-full flex items-center justify-center transition-transform cursor-pointer active:scale-90 shadow-md shrink-0"
            title="Send Gift / Tip"
          >
            <Gift className="w-5 h-5" />
          </button>
        </div>

        {/* Bio */}
        <p className="text-xs text-center text-neutral-300 mt-2 max-w-[280px] leading-snug">
          {profile?.bio || 'Pulse Creator ✨'}
        </p>
      </div>

      {/* 3. Grid / Videos Tab */}
      {isLockedPrivate ? (
        <div className="border-t border-white/10 flex-1 flex flex-col items-center justify-center p-8 text-center bg-black">
          <div className="w-12 h-12 rounded-full bg-neutral-900 flex items-center justify-center mb-2 text-white border border-white/10">
            <Lock className="w-5 h-5" />
          </div>
          <b className="text-white text-xs block">This account is private</b>
          <p className="text-[11px] text-neutral-400 mt-1 max-w-[240px]">
            Follow this account to see their videos and likes.
          </p>
        </div>
      ) : (
        <div className="border-t border-white/10 pt-1 flex-1 bg-black">
          {videos.length === 0 ? (
            <div className="text-center py-16 text-neutral-500 text-xs">
              No videos posted yet.
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-[1px] bg-neutral-900">
              {videos.map((video, idx) => (
                <div
                  key={video.id}
                  onClick={() => setViewerVideoIndex(idx)}
                  className="aspect-[3/4] bg-black overflow-hidden relative cursor-pointer group"
                >
                  <GridThumb video={video} />
                  <div className="absolute bottom-1 left-1 text-[10px] text-white font-bold flex items-center gap-0.5 drop-shadow">
                    <Play className="w-2.5 h-2.5 fill-white stroke-none" /> {formatCount(video.likeCount)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Post Viewer Stack for this Creator Profile */}
      {viewerVideoIndex !== null && (
        <ProfilePostViewerModal
          isOpen={viewerVideoIndex !== null}
          creatorProfile={profile}
          videos={videos}
          initialIndex={viewerVideoIndex}
          currentUser={currentUser}
          onClose={() => setViewerVideoIndex(null)}
          onOpenComments={(v) => {
            setViewerVideoIndex(null);
            onSelectVideo(v);
          }}
          onToast={onToast}
          onRequireAuth={onRequireAuth}
        />
      )}

      {/* Gift / Tip Picker Sheet */}
      {profile && (
        <GiftPickerSheet
          isOpen={showGiftPicker}
          currentUser={currentUser}
          hostProfile={{
            uid: profile.uid,
            handle: profile.handle,
            username: profile.username,
            avatar: profile.photoURL
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
      )}

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
