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
  sendTipToCreator,
  getUserLikedVideos
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
  const [activeTab, setActiveTab] = useState<'videos' | 'media' | 'liked'>('videos');
  const [likedVideos, setLikedVideos] = useState<VideoPost[]>([]);

  useEffect(() => {
    if (activeTab === 'liked' && profile?.uid) {
      getUserLikedVideos(profile.uid).then(setLikedVideos).catch(() => {});
    }
  }, [activeTab, profile?.uid]);

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

  const activeVideos = videos.filter(v => !v.isArchived);
  const mediaVideos = activeVideos.filter(v => v.mediaType === 'image' || v.mediaType === 'carousel');
  const currentDisplayVideos = activeTab === 'videos' ? activeVideos : activeTab === 'media' ? mediaVideos : likedVideos;

  return (
    <div className="fixed inset-0 z-50 bg-black text-white overflow-y-auto pb-20 max-w-[780px] mx-auto select-none font-sans flex flex-col animate-in fade-in">
      {/* 1. Cover Banner & Floating Navigation Header */}
      <div className="relative h-[180px] overflow-hidden bg-[radial-gradient(circle_at_75%_20%,rgba(255,189,26,.2),transparent_27%),radial-gradient(circle_at_20%_30%,rgba(74,140,255,.15),transparent_30%),linear-gradient(125deg,#1c1c1e,#080809_65%)] shrink-0">
        {profile?.coverUrl && <img src={profile.coverUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/90" />

        {/* Floating Top Nav (Back, Share, More) */}
        <div className="absolute top-0 inset-x-0 z-30 flex items-center justify-between p-3">
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-[13px] grid place-items-center bg-black/60 backdrop-blur-md text-white hover:bg-black/80 transition-colors cursor-pointer border border-white/10"
            title="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                navigator.clipboard?.writeText(window.location.href);
                onToast('Profile link copied 🔗');
              }}
              className="w-10 h-10 rounded-[13px] grid place-items-center bg-black/60 backdrop-blur-md text-white hover:bg-black/80 transition-colors cursor-pointer border border-white/10"
              title="Share profile"
            >
              <Share2 className="w-4 h-4" />
            </button>
            <div className="relative">
              <button
                onClick={() => setShowOptionsMenu(!showOptionsMenu)}
                className="w-10 h-10 rounded-[13px] grid place-items-center bg-black/60 backdrop-blur-md text-white hover:bg-black/80 transition-colors cursor-pointer border border-white/10"
                title="Options"
              >
                <MoreVertical className="w-5 h-5" />
              </button>
              {showOptionsMenu && (
                <div className="absolute right-0 top-12 bg-neutral-900 border border-white/15 rounded-2xl p-1.5 w-40 shadow-xl flex flex-col gap-1 z-50 animate-in fade-in">
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
      </div>

      {/* 2. Profile Details (Exact match with UserProfilePage) */}
      <div className="px-[15px]">
        <div className="flex items-start justify-between">
          <div className="relative -mt-12 z-10 rounded-full p-[3px] bg-gradient-to-br from-white via-neutral-500 to-white shadow-[0_0_0_5px_var(--bg),0_17px_50px_rgba(0,0,0,.55)]">
            <img
              src={avatar}
              alt={handle}
              className="w-[106px] h-[106px] object-cover rounded-full border-2 border-[#050506]"
            />
            <span className="absolute right-[3px] bottom-[3px] w-[19px] h-[19px] rounded-full border-4 border-[#050506] bg-[var(--green)]" />
          </div>
        </div>

        <div className="mt-3.5 flex items-center gap-1.5">
          <h1 className="text-[25px] font-black tracking-[-.9px]">{profile?.username || handle}</h1>
          {profile?.verified && <VerifiedBadge size="xs" />}
        </div>
        <div className="mt-0.5 text-xs text-[#818188]">{profile?.handle || handle}</div>
        <p className="mt-2.5 max-w-[640px] text-xs leading-6 text-[#cdccd2]">
          {profile?.bio || 'Building things, exploring ideas and connecting with people around the world.'}
        </p>

        <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-2 text-[9px] text-[#74747b]">
          <span className="inline-flex items-center gap-1"><Globe className="w-3 h-3" /> Global creator</span>
          <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" /> Joined {profile?.createdAt ? new Date(profile.createdAt).getFullYear() : '2026'}</span>
          {profile?.instagramLink && (
            <a href={`https://instagram.com/${profile.instagramLink.replace('@', '')}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-pink-400 hover:underline">
              <Instagram className="w-3 h-3" /> Instagram
            </a>
          )}
          {profile?.websiteLink && (
            <a href={profile.websiteLink.startsWith('http') ? profile.websiteLink : `https://${profile.websiteLink}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[#25f4ee] hover:underline">
              <Globe className="w-3 h-3" /> Website
            </a>
          )}
        </div>

        {/* 3-column stats row */}
        <div className="grid grid-cols-3 mt-[18px] py-3.5 border-y border-white/[.075]">
          <button onClick={() => profile && onOpenFollowList('following', profile.uid)} className="text-center cursor-pointer hover:opacity-80 transition-opacity">
            <strong className="block text-[17px] font-extrabold">{formatCount(profile?.following || 0)}</strong>
            <span className="mt-0.5 block text-[9px] text-[#717178]">Following</span>
          </button>
          <button onClick={() => profile && onOpenFollowList('followers', profile.uid)} className="text-center border-x border-white/[.075] cursor-pointer hover:opacity-80 transition-opacity">
            <strong className="block text-[17px] font-extrabold">{formatCount(followerCount)}</strong>
            <span className="mt-0.5 block text-[9px] text-[#717178]">Followers</span>
          </button>
          <button onClick={() => setActiveTab('liked')} className="text-center cursor-pointer hover:opacity-80 transition-opacity">
            <strong className="block text-[17px] font-extrabold">{formatCount(profile?.likesReceived || 0)}</strong>
            <span className="mt-0.5 block text-[9px] text-[#717178]">Likes</span>
          </button>
        </div>

        {/* Action Buttons: Follow | Message | Calls | Tip */}
        <div className="flex gap-2 mt-[15px]">
          <button
            onClick={handleToggleFollow}
            disabled={followPending}
            className={`flex-1 h-11 rounded-[13px] text-xs font-extrabold transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-60 ${
              isFollowing
                ? 'bg-neutral-800 text-white border border-white/10 hover:bg-neutral-700'
                : isRequested
                ? 'bg-neutral-800 text-amber-400 border border-white/10'
                : 'bg-[#fe2c55] hover:bg-[#e0244a] text-white'
            }`}
          >
            {isFollowing ? (
              <>
                <Check className="w-3.5 h-3.5 stroke-[2.5]" /> Following
              </>
            ) : isRequested ? (
              <>
                <Clock className="w-3.5 h-3.5 stroke-[2.5]" /> Requested
              </>
            ) : (
              <>
                <UserPlus className="w-3.5 h-3.5 stroke-[2.5]" /> Follow
              </>
            )}
          </button>

          <button
            onClick={() => {
              if (!currentUser) return onRequireAuth();
              onOpenChat({
                uid: profile?.uid || creatorUid || '',
                handle: profile?.handle || handle,
                username: profile?.username || profile?.handle || handle,
                avatar: profile?.photoURL || avatar,
                verified: profile?.verified
              });
            }}
            className="flex-1 h-11 rounded-[13px] bg-[#171719] hover:bg-neutral-800 text-white font-extrabold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 border border-white/[.075]"
          >
            <MessageSquare className="w-3.5 h-3.5 text-neutral-300" /> Message
          </button>

          <button
            type="button"
            onClick={() => {
              if (!currentUser) return onRequireAuth();
              if (onStartCall) {
                onStartCall({
                  uid: profile?.uid || creatorUid || '',
                  handle: profile?.handle || handle,
                  username: profile?.username || profile?.handle || handle,
                  avatar: profile?.photoURL || avatar
                }, 'voice');
              }
            }}
            className="w-11 h-11 rounded-[13px] grid place-items-center bg-[#171719] border border-white/[.075] text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer shrink-0"
            title="Voice Call"
          >
            <Phone className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              if (!currentUser) return onRequireAuth();
              if (onStartCall) {
                onStartCall({
                  uid: profile?.uid || creatorUid || '',
                  handle: profile?.handle || handle,
                  username: profile?.username || profile?.handle || handle,
                  avatar: profile?.photoURL || avatar
                }, 'video');
              }
            }}
            className="w-11 h-11 rounded-[13px] grid place-items-center bg-[#171719] border border-white/[.075] text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer shrink-0"
            title="Video Call"
          >
            <Video className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              if (!currentUser) return onRequireAuth();
              setShowGiftPicker(true);
            }}
            className="w-11 h-11 rounded-[13px] grid place-items-center bg-gradient-to-r from-yellow-400 to-amber-500 hover:opacity-90 text-black transition-transform cursor-pointer active:scale-95 shadow-md shrink-0"
            title="Send Gift / Tip"
          >
            <Gift className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-3 mt-5 h-[54px] border-y border-white/[.075] bg-black/90">
        {([
          ['videos', 'Posts'],
          ['media', 'Media'],
          ['liked', 'Liked']
        ] as const).map(([tab, label]) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`relative text-[9px] font-extrabold cursor-pointer transition-colors ${
              activeTab === tab ? 'text-white' : 'text-[#626269] hover:text-white'
            }`}
          >
            {label}
            {activeTab === tab && (
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-7 h-0.5 rounded-full bg-white" />
            )}
          </button>
        ))}
      </div>

      {/* Content Area */}
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
        <div className="px-0.5 pt-1 pb-16 flex-1 bg-black">
          {currentDisplayVideos.length === 0 ? (
            <div className="text-center py-16 text-neutral-500 text-xs">
              {activeTab === 'videos' ? 'No posts yet.' : activeTab === 'media' ? 'No media posts yet.' : 'No liked videos yet.'}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-0.5">
              {currentDisplayVideos.map((video, idx) => (
                <div
                  key={video.id}
                  onClick={() => setViewerVideoIndex(idx)}
                  className="aspect-[3/4] bg-neutral-900 overflow-hidden relative cursor-pointer group rounded-[2px]"
                >
                  <GridThumb video={video} className="group-hover:scale-105 transition-transform" />
                  <div className="absolute bottom-1 left-1 text-[9px] text-white font-bold flex items-center gap-0.5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                    <Play className="w-2 h-2 fill-white stroke-none" /> {formatCount(video.likeCount)}
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
          videos={currentDisplayVideos}
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
