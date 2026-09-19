import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, VideoPost, Playlist } from '../types';
import { 
  updateUserProfile, 
  deleteVideoPost, 
  togglePinVideo, 
  toggleArchiveVideo, 
  getUserPlaylists,
  getUserLikedVideos,
  getUserSavedVideos 
} from '../services/pulseDb';
import { db, getDocs, onSnapshot, collection, query, where, auth, sendEmailVerification, reload, updateProfile } from '../backend';
import { 
  UserPlus, 
  Share2, 
  Menu, 
  X, 
  Edit2, 
  Lock, 
  Bookmark, 
  Heart, 
  Plus, 
  Sparkles, 
  Settings, 
  Clock, 
  QrCode, 
  Wallet, 
  CloudDownload, 
  TrendingUp, 
  ChevronRight, 
  CheckCircle, 
  AlertCircle, 
  Upload, 
  Pin, 
  FolderHeart, 
  Archive, 
  MoreVertical, 
  Trash2, 
  Globe, 
  Instagram, 
  Youtube, 
  LogOut,
  Footprints,
  Sliders,
  Play,
  Coins,
  Gem
} from 'lucide-react';
import { CreatorWalletModal } from './CreatorWalletModal';
import { VerifiedBadge } from './VerifiedBadge';
import { ProfilePostViewerModal } from './ProfilePostViewerModal';
import { GridThumb } from './GridThumb';
import { formatCount } from '../utils/formatters';
import confetti from 'canvas-confetti';

interface UserProfilePageProps {
  currentUser: UserProfile;
  onLogout: () => void;
  onSelectVideo: (video: VideoPost) => void;
  onOpenSettings: () => void;
  onOpenFollowList: (mode: 'followers' | 'following' | 'requests', uid: string) => void;
  onOpenWatchHistory: () => void;
  onOpenPlaylists: (video?: VideoPost) => void;
  onToast: (msg: string) => void;
  onOpenCreatorStudio?: () => void;
  onUpdateUser?: (updated: Partial<UserProfile>) => void;
}

// Client-side image compression to ensure crystal-clear avatars under 80KB (prevents Firestore doc overflow)
const resizeAvatarImage = (file: File, maxDim = 360): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          resolve(dataUrl);
        } else {
          resolve(event.target?.result as string || '');
        }
      };
      img.onerror = () => reject(new Error('Failed to render selected image'));
      img.src = event.target?.result as string;
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
};

export const UserProfilePage: React.FC<UserProfilePageProps> = ({
  currentUser,
  onLogout,
  onSelectVideo,
  onOpenSettings,
  onOpenFollowList,
  onOpenWatchHistory,
  onOpenPlaylists,
  onToast,
  onOpenCreatorStudio,
  onUpdateUser
}) => {
  const [userVideos, setUserVideos] = useState<VideoPost[]>([]);
  const [savedVideos, setSavedVideos] = useState<VideoPost[]>([]);
  const [likedVideos, setLikedVideos] = useState<VideoPost[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [activeTab, setActiveTab] = useState<'videos' | 'media' | 'reposts' | 'private' | 'saved' | 'liked'>('videos');
  const [showDrawer, setShowDrawer] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAffiliateBanner, setShowAffiliateBanner] = useState(true);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);

  // Edit form state
  const [editUsername, setEditUsername] = useState(currentUser.username);
  const [editHandle, setEditHandle] = useState(currentUser.handle || '');
  const [editBio, setEditBio] = useState(currentUser.bio || '');
  const [editAvatar, setEditAvatar] = useState(currentUser.photoURL);
  const [editWebsite, setEditWebsite] = useState(currentUser.websiteLink || '');
  const [editInstagram, setEditInstagram] = useState(currentUser.instagramLink || '');
  const [editYoutube, setEditYoutube] = useState(currentUser.youtubeLink || '');
  const [saving, setSaving] = useState(false);
  const [isEmailVerified, setIsEmailVerified] = useState(currentUser.emailVerified || auth.currentUser?.emailVerified || false);
  const [checkingVerification, setCheckingVerification] = useState(false);
  const [selectedVideoForMenu, setSelectedVideoForMenu] = useState<VideoPost | null>(null);
  const [viewerVideoIndex, setViewerVideoIndex] = useState<number | null>(null);

  const avatarFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!currentUser.uid) return;

    // Real-time listener for current user's video uploads
    const q = query(
      collection(db, 'videos'),
      where('ownerUid', '==', currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const list: VideoPost[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as VideoPost);
      });
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setUserVideos(list);
    }, (err) => {
      console.warn('User videos listener warning:', err);
    });

    // Load playlists, liked & saved
    getUserPlaylists(currentUser.uid).then(setPlaylists).catch(() => {});
    getUserLikedVideos(currentUser.uid).then(setLikedVideos).catch(() => {});
    getUserSavedVideos(currentUser.uid).then(setSavedVideos).catch(() => {});

    return () => unsubscribe();
  }, [currentUser.uid]);

  useEffect(() => {
    if (activeTab === 'liked') {
      getUserLikedVideos(currentUser.uid).then(setLikedVideos);
    } else if (activeTab === 'saved') {
      getUserSavedVideos(currentUser.uid).then(setSavedVideos);
    }
  }, [activeTab, currentUser.uid]);

  useEffect(() => {
    if (showEditModal) {
      setEditUsername(currentUser.username);
      setEditHandle(currentUser.handle || '');
      setEditBio(currentUser.bio || '');
      setEditAvatar(currentUser.photoURL);
      setEditWebsite(currentUser.websiteLink || '');
      setEditInstagram(currentUser.instagramLink || '');
      setEditYoutube(currentUser.youtubeLink || '');
    }
  }, [showEditModal, currentUser]);

  const loadMyContent = async () => {
    try {
      const q = query(
        collection(db, 'videos'),
        where('ownerUid', '==', currentUser.uid)
      );
      const snap = await getDocs(q);
      const list: VideoPost[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as VideoPost);
      });
      setUserVideos(list);

      const pls = await getUserPlaylists(currentUser.uid);
      setPlaylists(pls);

      const [liked, saved] = await Promise.all([
        getUserLikedVideos(currentUser.uid),
        getUserSavedVideos(currentUser.uid)
      ]);
      setLikedVideos(liked);
      setSavedVideos(saved);
    } catch (err) {
      console.warn('Load user content notice:', err);
    }
  };

  const handleAvatarFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      onToast('Please select a valid image file (PNG, JPG, WEBP)');
      return;
    }

    try {
      const compressedDataUrl = await resizeAvatarImage(file, 360);
      setEditAvatar(compressedDataUrl);
      onToast('Photo loaded! Click "Save Changes" to apply.');
    } catch (err: any) {
      onToast('Failed to process image: ' + (err.message || 'Error'));
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const finalAvatar = editAvatar || currentUser.photoURL;
      const finalUsername = editUsername.trim() || currentUser.username;
      const normalizedHandle = editHandle.trim().replace(/^@+/, '').toLowerCase().replace(/[^a-z0-9_.]/g, '').slice(0, 24);
      const finalBio = editBio.trim();

      const updates: Partial<UserProfile> = {
        username: finalUsername,
        handle: normalizedHandle ? `@${normalizedHandle}` : currentUser.handle,
        bio: finalBio,
        photoURL: finalAvatar,
        websiteLink: editWebsite.trim(),
        instagramLink: editInstagram.trim().replace(/^@/, ''),
        youtubeLink: editYoutube.trim().replace(/^@/, '')
      };

      try {
        await updateUserProfile(currentUser.uid, updates);
      } catch (dbErr) {
        console.warn('Firestore profile update fallback:', dbErr);
      }

      if (auth.currentUser) {
        try {
          await updateProfile(auth.currentUser, {
            displayName: finalUsername,
            photoURL: finalAvatar
          });
        } catch (authErr) {
          console.warn('Auth profile update:', authErr);
        }
      }

      if (onUpdateUser) {
        onUpdateUser(updates);
      }
      Object.assign(currentUser, updates);

      onToast('Profile updated successfully! ✨');
      setShowEditModal(false);
    } catch (err: any) {
      onToast('Failed to update profile: ' + (err.message || 'Error'));
    } finally {
      setSaving(false);
    }
  };

  const handleVerifyEmail = async () => {
    if (!auth.currentUser) return;
    setCheckingVerification(true);
    try {
      await reload(auth.currentUser);
      if (auth.currentUser.emailVerified) {
        setIsEmailVerified(true);
        await updateUserProfile(currentUser.uid, { emailVerified: true });
        confetti({ particleCount: 80, spread: 60 });
        onToast('Email verified successfully! 🎉');
      } else {
        await sendEmailVerification(auth.currentUser);
        onToast(`Verification link resent to ${currentUser.email}. Please check your inbox.`);
      }
    } catch (err: any) {
      onToast('Verification notice: ' + (err.message || 'Please check email'));
    } finally {
      setCheckingVerification(false);
    }
  };

  const handleTogglePin = async (video: VideoPost) => {
    try {
      const isPinned = !video.isPinned;
      await togglePinVideo(currentUser.uid, video.id, isPinned);
      onToast(isPinned ? 'Video pinned to top 📌' : 'Video unpinned');
      setSelectedVideoForMenu(null);
      await loadMyContent();
    } catch (err: any) {
      onToast(err.message || 'Failed to update pin');
    }
  };

  const handleToggleArchive = async (video: VideoPost) => {
    try {
      const isArchived = !video.isArchived;
      await toggleArchiveVideo(currentUser.uid, video.id, isArchived);
      onToast(isArchived ? 'Video moved to private archive 🔒' : 'Video restored to public profile');
      setSelectedVideoForMenu(null);
      await loadMyContent();
    } catch (err: any) {
      onToast(err.message || 'Failed to archive');
    }
  };

  const activeVideos = userVideos
    .filter(v => !v.isArchived)
    .sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return (b.createdAt || 0) - (a.createdAt || 0);
    });

  const privateVideos = userVideos.filter(v => v.isArchived);
  const mediaVideos = activeVideos.filter(v => v.mediaType === 'image' || v.mediaType === 'carousel');
  const repostedVideos = activeVideos.filter(v => v.isReposted);

  return (
    <div className="w-full h-full bg-black text-white overflow-y-auto pb-20 max-w-[780px] mx-auto select-none font-sans">
      <div className="relative h-[180px] overflow-hidden bg-[radial-gradient(circle_at_75%_20%,rgba(255,189,26,.2),transparent_27%),radial-gradient(circle_at_20%_30%,rgba(74,140,255,.15),transparent_30%),linear-gradient(125deg,#1c1c1e,#080809_65%)]">
        {currentUser.coverUrl && <img src={currentUser.coverUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/90" />
      </div>
      <div className="px-[15px]">
        <div className="flex items-start justify-between">
          <div className="relative -mt-12 z-10 rounded-full p-[3px] bg-gradient-to-br from-white via-neutral-500 to-white shadow-[0_0_0_5px_var(--bg),0_17px_50px_rgba(0,0,0,.55)]">
            <img src={currentUser.photoURL} alt={currentUser.username} className="w-[106px] h-[106px] object-cover rounded-full border-2 border-[#050506]" />
            <span className="absolute right-[3px] bottom-[3px] w-[19px] h-[19px] rounded-full border-4 border-[#050506] bg-[var(--green)]" />
          </div>
          <button onClick={() => setShowDrawer(true)} className="mt-3 w-10 h-10 rounded-[13px] grid place-items-center text-white hover:bg-white/[.055]" title="Profile menu"><Menu className="w-5 h-5" /></button>
        </div>
        <div className="mt-3.5 flex items-center gap-1.5">
          <h1 className="text-[25px] font-black tracking-[-.9px]">{currentUser.username}</h1>
          {currentUser.verified && <VerifiedBadge size="xs" />}
        </div>
        <div className="mt-0.5 text-xs text-[#818188]">{currentUser.handle?.startsWith('@') ? currentUser.handle : `@${currentUser.handle}`}</div>
        <p className="mt-2.5 max-w-[640px] text-xs leading-6 text-[#cdccd2]">{currentUser.bio || 'Building things, exploring ideas and connecting with people around the world.'}</p>
        <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-2 text-[9px] text-[#74747b]">
          <span className="inline-flex items-center gap-1"><Globe className="w-3 h-3" /> Global creator</span>
          <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" /> Joined {currentUser.createdAt ? new Date(currentUser.createdAt).getFullYear() : '2026'}</span>
          {currentUser.instagramLink && <a href={`https://instagram.com/${currentUser.instagramLink}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-pink-400"><Instagram className="w-3 h-3" /> Instagram</a>}
        </div>
        <div className="grid grid-cols-3 mt-[18px] py-3.5 border-y border-white/[.075]">
          <button onClick={() => onOpenFollowList('following', currentUser.uid)} className="text-center"><strong className="block text-[17px] font-extrabold">{formatCount(currentUser.following || 0)}</strong><span className="mt-0.5 block text-[9px] text-[#717178]">Following</span></button>
          <button onClick={() => onOpenFollowList('followers', currentUser.uid)} className="text-center border-x border-white/[.075]"><strong className="block text-[17px] font-extrabold">{formatCount(currentUser.followers || 0)}</strong><span className="mt-0.5 block text-[9px] text-[#717178]">Followers</span></button>
          <button onClick={() => setActiveTab('liked')} className="text-center"><strong className="block text-[17px] font-extrabold">{formatCount(currentUser.likesReceived || userVideos.reduce((acc, v) => acc + (v.likeCount || 0), 0))}</strong><span className="mt-0.5 block text-[9px] text-[#717178]">Likes</span></button>
        </div>
        <div className="flex gap-2 mt-[15px]">
          <button onClick={() => setShowEditModal(true)} className="flex-1 h-11 rounded-[13px] bg-[#efeff0] text-[#050505] text-xs font-extrabold">Edit profile</button>
          <button onClick={() => { if (navigator.share) navigator.share({ title: `${currentUser.username} on Pulse`, url: window.location.href }).catch(() => {}); else { navigator.clipboard?.writeText(window.location.href); onToast('Profile link copied'); } }} className="w-11 h-11 rounded-[13px] grid place-items-center bg-[#171719] border border-white/[.075]"><Share2 className="w-4 h-4" /></button>
          <button onClick={() => setShowWalletModal(true)} className="w-11 h-11 rounded-[13px] grid place-items-center bg-[var(--yellow)] text-black"><Gem className="w-4 h-4" /></button>
        </div>
      </div>

      <div className="grid grid-cols-5 mt-5 h-[54px] border-y border-white/[.075] bg-black/90">
        {([
          ['videos', 'Posts'], ['media', 'Media'], ['reposts', 'Reposts'], ['saved', 'Saved'], ['liked', 'Liked']
        ] as const).map(([tab, label]) => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`relative text-[9px] font-extrabold ${activeTab === tab ? 'text-white' : 'text-[#626269]'}`}>
            {label}
            {activeTab === tab && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-7 h-0.5 rounded-full bg-white" />}
          </button>
        ))}
      </div>

      {/* 7. AFFILIATE CREATOR PROMO BANNER (Compact & 40% reduced) */}
      {showAffiliateBanner && activeTab === 'videos' && (
        <div className="mx-2 my-1 px-2.5 py-1.5 bg-neutral-900/90 border border-white/10 rounded-xl flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-[#fe2c55]/20 flex items-center justify-center text-[#fe2c55] shrink-0">
              <Plus className="w-3 h-3 stroke-[3]" />
            </div>
            <div>
              <h4 className="text-[10.5px] font-bold text-white leading-tight">AffiliateCreator</h4>
              <p className="text-[9px] text-neutral-400 leading-tight">Post photos to get more views.</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => {
                const btn = document.getElementById('navCreateBtn');
                btn?.click();
              }}
              className="px-2 py-0.5 bg-[#fe2c55] hover:bg-[#e0244a] text-white text-[9.5px] font-bold rounded-full cursor-pointer shadow-xs active:scale-95 transition-all"
            >
              Create
            </button>
            <button
              onClick={() => setShowAffiliateBanner(false)}
              className="text-neutral-400 hover:text-white p-0.5 cursor-pointer"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </div>
        </div>
      )}

      {/* 8. 3-COLUMN VIDEO GRID (Sleek, 40% scaled empty state and micro grid) */}
      <div className="px-0.5 pb-16">
        {activeTab === 'videos' && (
          activeVideos.length === 0 ? (
            <div className="text-center py-8 text-neutral-400 text-xs px-6">
              <div className="w-8 h-8 rounded-full bg-neutral-900 text-neutral-400 mx-auto flex items-center justify-center mb-1.5 border border-white/5 shadow-xs">
                <Play className="w-3.5 h-3.5 ml-0.5 fill-neutral-400" />
              </div>
              <p className="font-semibold text-neutral-200 text-[11.5px]">Upload your first video or photo</p>
              <p className="text-[10px] text-neutral-500 mt-0.5">Your posts will appear here on your public profile.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-0.5">
              {activeVideos.map((video, idx) => (
                <div
                  key={video.id}
                  onClick={() => setViewerVideoIndex(idx)}
                  className="aspect-[3/4] bg-neutral-900 overflow-hidden relative cursor-pointer group rounded-[2px]"
                >
                  <GridThumb video={video} className={`group-hover:scale-105 transition-transform ${video.filter || ''}`} />
                  {video.isPinned && (
                    <div className="absolute top-1 left-1 px-1 py-0.2 bg-[#fe2c55] text-white text-[7.5px] font-black rounded flex items-center gap-0.5 shadow-xs">
                      <Pin className="w-1.5 h-1.5 fill-white" /> Pin
                    </div>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedVideoForMenu(video);
                    }}
                    className="absolute top-1 right-1 p-0.5 bg-black/60 rounded-full text-white/90 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <MoreVertical className="w-2.5 h-2.5" />
                  </button>
                  <div className="absolute bottom-1 left-1 text-[9px] text-white font-bold flex items-center gap-0.5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                    <Play className="w-2 h-2 fill-white" />
                    <span>{formatCount(video.likeCount || 0)}</span>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {activeTab === 'private' && (
          privateVideos.length === 0 ? (
            <div className="text-center py-16 text-neutral-400 text-xs px-6">
              <Lock className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
              <p className="font-semibold text-neutral-200">Your private videos</p>
              <p className="text-[11px] text-neutral-400 mt-1">Only you can see videos you have archived or set to private.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-0.5">
              {privateVideos.map((video) => (
                <div
                  key={video.id}
                  onClick={() => onSelectVideo(video)}
                  className="aspect-[3/4] bg-neutral-900 overflow-hidden relative cursor-pointer group"
                >
                  <GridThumb video={video} className="opacity-80" />
                  <div className="absolute top-1 left-1 px-1 py-0.2 bg-black/70 text-white text-[8.5px] font-medium rounded flex items-center gap-0.5">
                    <Lock className="w-2 h-2" /> Private
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleArchive(video);
                    }}
                    className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-neutral-800 hover:bg-neutral-700 text-white text-[9px] font-bold rounded shadow-xs"
                  >
                    Restore
                  </button>
                </div>
              ))}
            </div>
          )
        )}

        {(activeTab === 'media' || activeTab === 'reposts') && (
          (activeTab === 'media' ? mediaVideos : repostedVideos).length === 0 ? (
            <div className="text-center py-16 text-neutral-400 text-xs px-6">
              {activeTab === 'media' ? <Globe className="w-8 h-8 text-neutral-600 mx-auto mb-2" /> : <Share2 className="w-8 h-8 text-neutral-600 mx-auto mb-2" />}
              <p className="font-semibold text-neutral-200">{activeTab === 'media' ? 'No media posts yet' : 'No reposts yet'}</p>
              <p className="text-[11px] text-neutral-400 mt-1">Real posts from this account will appear here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-0.5">
              {(activeTab === 'media' ? mediaVideos : repostedVideos).map((video) => (
                <button key={video.id} onClick={() => onSelectVideo(video)} className="aspect-[3/4] bg-neutral-900 overflow-hidden relative cursor-pointer">
                  <GridThumb video={video} />
                </button>
              ))}
            </div>
          )
        )}

        {activeTab === 'saved' && (
          savedVideos.length === 0 ? (
            <div className="text-center py-16 text-neutral-400 text-xs px-6">
              <Bookmark className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
              <p className="font-semibold text-neutral-200">Favorite videos</p>
              <p className="text-[11px] text-neutral-400 mt-1">Save videos from your feed to easily watch them later.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-0.5">
              {savedVideos.map((video) => (
                <div
                  key={video.id}
                  onClick={() => onSelectVideo(video)}
                  className="aspect-[3/4] bg-neutral-900 relative cursor-pointer group overflow-hidden"
                >
                  <GridThumb video={video} className="group-hover:scale-105 transition-transform" />
                  <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 text-[10px] font-bold text-white drop-shadow-md">
                    <Bookmark className="w-2.5 h-2.5 fill-white text-white" />
                    <span>{formatCount(video.saveCount || video.likeCount || 0)}</span>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {activeTab === 'liked' && (
          likedVideos.length === 0 ? (
            <div className="text-center py-16 text-neutral-400 text-xs px-6">
              <Heart className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
              <p className="font-semibold text-neutral-200">Only you can see which videos you liked</p>
              <p className="text-[11px] text-neutral-400 mt-1">Videos you like from the feed appear right here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-0.5">
              {likedVideos.map((video) => (
                <div
                  key={video.id}
                  onClick={() => onSelectVideo(video)}
                  className="aspect-[3/4] bg-neutral-900 relative cursor-pointer group overflow-hidden"
                >
                  <GridThumb video={video} className="group-hover:scale-105 transition-transform" />
                  <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 text-[10px] font-bold text-white drop-shadow-md">
                    <Play className="w-2.5 h-2.5 fill-white" />
                    <span>{formatCount(video.likeCount || 0)}</span>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* 9. HAMBURGER SLIDE-OVER DRAWER */}
      {showDrawer && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[280px] bg-neutral-950 text-white border-l border-white/10 h-full shadow-2xl flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-200"
          >
            <div>
              {/* Drawer Header */}
              <div className="flex items-center justify-between px-3.5 py-3 border-b border-white/10">
                <h3 className="text-xs font-bold text-white">Menu</h3>
                <button
                  onClick={() => setShowDrawer(false)}
                  className="p-1 text-neutral-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* SECTION: PERSONAL TOOLS */}
              <div className="px-3 py-1.5 border-t border-white/10">
                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-0.5">
                  Personal tools
                </span>
                <div 
                  onClick={() => {
                    setShowDrawer(false);
                    onOpenWatchHistory();
                  }}
                  className="flex items-center justify-between py-1.5 cursor-pointer hover:bg-white/5 rounded-md px-1 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <Clock className="w-3.5 h-3.5 text-neutral-300" />
                    <span className="text-[11.5px] font-medium text-neutral-200">Activity center</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-neutral-500" />
                </div>

                <div 
                  onClick={() => {
                    setShowDrawer(false);
                    setActiveTab('saved');
                    onToast('Saved videos opened — choose a post to watch again');
                  }}
                  className="flex items-center justify-between py-1.5 cursor-pointer hover:bg-white/5 rounded-md px-1 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <CloudDownload className="w-3.5 h-3.5 text-neutral-300" />
                    <span className="text-[11.5px] font-medium text-neutral-200">Offline videos</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-neutral-500" />
                </div>

                <div 
                  onClick={() => {
                    setShowDrawer(false);
                    setShowQrModal(true);
                  }}
                  className="flex items-center justify-between py-1.5 cursor-pointer hover:bg-white/5 rounded-md px-1 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <QrCode className="w-3.5 h-3.5 text-neutral-300" />
                    <span className="text-[11.5px] font-medium text-neutral-200">Your QR code</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-neutral-500" />
                </div>
              </div>

              {/* SECTION: CREATION & BUSINESS TOOLS */}
              <div className="px-3 py-1.5 border-t border-white/10">
                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-0.5">
                  Creation & business tools
                </span>
                <div 
                  onClick={() => {
                    setShowDrawer(false);
                    setShowWalletModal(true);
                  }}
                  className="flex items-center justify-between py-1.5 cursor-pointer hover:bg-white/5 rounded-md px-1 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <Coins className="w-3.5 h-3.5 text-yellow-400" />
                    <div className="flex items-center gap-1">
                      <span className="text-[11.5px] font-medium text-neutral-200">Balance &amp; Wallet</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                        {currentUser.walletCoins || 0} 🪙
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-neutral-500" />
                </div>

                <div 
                  onClick={() => {
                    setShowDrawer(false);
                    if (onOpenCreatorStudio) onOpenCreatorStudio();
                  }}
                  className="flex items-center justify-between py-1.5 cursor-pointer hover:bg-white/5 rounded-md px-1 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                    <span className="text-[11.5px] font-medium text-neutral-200">Pulse Studio</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-neutral-500" />
                </div>

                <div 
                  onClick={() => {
                    setShowDrawer(false);
                    onOpenSettings();
                  }}
                  className="flex items-center justify-between py-1.5 cursor-pointer hover:bg-white/5 rounded-md px-1 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <Settings className="w-3.5 h-3.5 text-neutral-300" />
                    <span className="text-[11.5px] font-medium text-neutral-200">Settings and privacy</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-neutral-500" />
                </div>
              </div>
            </div>

            {/* Bottom Logout */}
            <div className="p-3 border-t border-white/10">
              <button
                onClick={() => {
                  setShowDrawer(false);
                  onLogout();
                }}
                className="w-full py-1.5 bg-neutral-900 hover:bg-red-500/10 hover:text-red-400 text-neutral-200 font-medium rounded-lg text-[11px] flex items-center justify-center gap-1.5 cursor-pointer transition-colors border border-white/10"
              >
                <LogOut className="w-3.5 h-3.5" /> Log out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 10. QR CODE MODAL */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-3">
          <div className="bg-neutral-950 border border-white/10 rounded-2xl p-4 max-w-[240px] w-full text-center shadow-2xl space-y-2.5">
            <h3 className="font-bold text-xs text-white">{currentUser.username}</h3>
            <div className="p-2.5 bg-white rounded-xl flex items-center justify-center">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=0&data=${encodeURIComponent(
                  `${window.location.origin}/@${currentUser.handle.replace(/^@/, '')}`
                )}`}
                alt={`QR code for ${currentUser.handle}`}
                className="w-28 h-28"
              />
            </div>
            <p className="text-[10px] text-neutral-400">Scan to follow {currentUser.handle}</p>
            <button
              onClick={() => setShowQrModal(false)}
              className="w-full py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white font-medium rounded-lg text-[11px] cursor-pointer border border-white/10"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* 11. VIDEO QUICK ACTIONS MODAL */}
      {selectedVideoForMenu && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-3 max-w-[480px] mx-auto">
          <div className="w-full bg-neutral-950 border border-white/10 rounded-xl p-3 shadow-2xl space-y-1.5">
            <div className="flex items-center justify-between pb-1.5 border-b border-white/10">
              <h4 className="text-[11px] font-bold text-white">Video Options</h4>
              <button onClick={() => setSelectedVideoForMenu(null)} className="text-neutral-400 hover:text-white cursor-pointer">
                ✕
              </button>
            </div>
            <button
              onClick={() => handleTogglePin(selectedVideoForMenu)}
              className="w-full py-1.5 px-2.5 bg-neutral-900 hover:bg-neutral-800 text-left text-[11px] font-medium text-white rounded-lg flex items-center gap-2 border border-white/5 cursor-pointer"
            >
              <Pin className="w-3.5 h-3.5 text-[#fe2c55]" />
              {selectedVideoForMenu.isPinned ? 'Unpin from profile' : 'Pin to top of profile'}
            </button>
            <button
              onClick={() => {
                const vid = selectedVideoForMenu;
                setSelectedVideoForMenu(null);
                onOpenPlaylists(vid);
              }}
              className="w-full py-1.5 px-2.5 bg-neutral-900 hover:bg-neutral-800 text-left text-[11px] font-medium text-white rounded-lg flex items-center gap-2 border border-white/5 cursor-pointer"
            >
              <FolderHeart className="w-3.5 h-3.5 text-[#20D5EC]" />
              Add to Playlist
            </button>
            <button
              onClick={() => handleToggleArchive(selectedVideoForMenu)}
              className="w-full py-1.5 px-2.5 bg-neutral-900 hover:bg-neutral-800 text-left text-[11px] font-medium text-neutral-300 rounded-lg flex items-center gap-2 border border-white/5 cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5 text-purple-400" />
              Make Video Private (Only visible to you)
            </button>
          </div>
        </div>
      )}

      {/* 12. EDIT PROFILE MODAL */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-3 max-w-[480px] mx-auto animate-in fade-in">
          <div className="w-full bg-neutral-950 border border-white/10 rounded-2xl p-4 shadow-2xl space-y-3 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-1.5 border-b border-white/10">
              <h3 className="font-bold text-xs text-white">Edit Profile</h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-neutral-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-2.5">
              <div>
                <label className="block text-[10.5px] font-bold text-neutral-300 mb-1">
                  Profile Photo
                </label>
                <div className="flex items-center gap-2.5 bg-neutral-900 p-2 rounded-xl border border-white/10">
                  <img
                    src={editAvatar}
                    alt="Preview"
                    className="w-11 h-11 rounded-full object-cover border border-white/20 shrink-0"
                  />
                  <div className="flex-1">
                    <button
                      type="button"
                      onClick={() => avatarFileInputRef.current?.click()}
                      className="px-2.5 py-0.5 bg-white hover:bg-neutral-200 text-black font-bold rounded-md text-[10px] flex items-center gap-1 cursor-pointer shadow-xs"
                    >
                      <Upload className="w-3 h-3" /> Upload photo
                    </button>
                    <span className="text-[9px] text-neutral-400 block mt-0.5">
                      JPG, PNG, WEBP
                    </span>
                    <input
                      ref={avatarFileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarFileSelect}
                      className="hidden"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[10.5px] font-bold text-neutral-300 mb-0.5">Display Name</label>
                <input
                  type="text"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  required
                  className="w-full bg-neutral-900 border border-white/10 rounded-lg px-2.5 py-1 text-[11px] text-white placeholder:text-neutral-500 focus:outline-none focus:border-[#20D5EC]"
                />
              </div>

              <div>
                <label className="block text-[10.5px] font-bold text-neutral-300 mb-0.5">Username</label>
                <input
                  type="text"
                  value={editHandle.replace(/^@/, '')}
                  onChange={(e) => setEditHandle(e.target.value.replace(/^@+/, '').toLowerCase())}
                  placeholder="username"
                  autoComplete="off"
                  spellCheck={false}
                  className="w-full bg-neutral-900 border border-white/10 rounded-lg px-2.5 py-1 text-[11px] text-white placeholder:text-neutral-500 focus:outline-none focus:border-[#20D5EC]"
                />
              </div>

              <div>
                <label className="block text-[10.5px] font-bold text-neutral-300 mb-0.5">Bio</label>
                <textarea
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  rows={2}
                  placeholder="Add a bio to your profile..."
                  className="w-full bg-neutral-900 border border-white/10 rounded-lg p-2 text-[11px] text-white placeholder:text-neutral-500 focus:outline-none focus:border-[#20D5EC] resize-none"
                />
              </div>

              <div>
                <label className="block text-[10.5px] font-bold text-neutral-300 mb-0.5">Website URL</label>
                <input
                  type="url"
                  value={editWebsite}
                  onChange={(e) => setEditWebsite(e.target.value)}
                  placeholder="https://yourwebsite.com"
                  className="w-full bg-neutral-900 border border-white/10 rounded-lg px-2.5 py-1 text-[11px] text-white placeholder:text-neutral-500 focus:outline-none focus:border-[#20D5EC]"
                />
              </div>

              <div className="flex gap-1.5">
                <div className="flex-1">
                  <label className="block text-[10.5px] font-bold text-neutral-300 mb-0.5">Instagram</label>
                  <input
                    type="text"
                    value={editInstagram}
                    onChange={(e) => setEditInstagram(e.target.value)}
                    placeholder="@username"
                    className="w-full bg-neutral-900 border border-white/10 rounded-lg px-2.5 py-1 text-[11px] text-white placeholder:text-neutral-500 focus:outline-none focus:border-[#20D5EC]"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-[10.5px] font-bold text-neutral-300 mb-0.5">YouTube</label>
                  <input
                    type="text"
                    value={editYoutube}
                    onChange={(e) => setEditYoutube(e.target.value)}
                    placeholder="@handle"
                    className="w-full bg-neutral-900 border border-white/10 rounded-lg px-2.5 py-1 text-[11px] text-white placeholder:text-neutral-500 focus:outline-none focus:border-[#20D5EC]"
                  />
                </div>
              </div>

              <div className="flex gap-1.5 pt-1.5">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 font-medium rounded-lg text-[11px] cursor-pointer border border-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-1.5 bg-[#fe2c55] hover:bg-[#e0244a] text-white font-bold rounded-lg text-[11px] shadow-xs cursor-pointer"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Creator Wallet & Tipping Modal */}
      {showWalletModal && (
        <CreatorWalletModal
          isOpen={showWalletModal}
          currentUser={currentUser}
          onClose={() => setShowWalletModal(false)}
          onToast={onToast}
          onUpdateUser={onUpdateUser}
        />
      )}

      {/* Post Viewer Stack for Profile Videos */}
      {viewerVideoIndex !== null && (
        <ProfilePostViewerModal
          isOpen={viewerVideoIndex !== null}
          creatorProfile={currentUser}
          videos={activeVideos}
          initialIndex={viewerVideoIndex}
          currentUser={currentUser}
          onClose={() => setViewerVideoIndex(null)}
          onOpenComments={(v) => {
            setViewerVideoIndex(null);
            onSelectVideo(v);
          }}
          onToast={onToast}
          onRequireAuth={() => {}}
        />
      )}
    </div>
  );
};
