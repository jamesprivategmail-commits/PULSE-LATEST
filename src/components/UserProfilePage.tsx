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
  const [activeTab, setActiveTab] = useState<'videos' | 'private' | 'saved' | 'liked'>('videos');
  const [showDrawer, setShowDrawer] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAffiliateBanner, setShowAffiliateBanner] = useState(true);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);

  // Edit form state
  const [editUsername, setEditUsername] = useState(currentUser.username);
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
      const finalBio = editBio.trim();

      const updates: Partial<UserProfile> = {
        username: finalUsername,
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

  return (
    <div className="w-full h-full bg-black text-white overflow-y-auto pt-1 pb-20 max-w-[480px] mx-auto select-none font-sans">
      {/* 1. TOP HEADER (Tight, minimal, pure black) */}
      <div className="px-header" style={{ position: 'relative' }}>
        <button
          onClick={() => onOpenFollowList('followers', currentUser.uid)}
          className="px-icon-btn"
          title="Find friends"
        >
          <UserPlus className="w-[18px] h-[18px]" />
        </button>

        <div className="flex items-center gap-1">
          <button
            onClick={() => onOpenWatchHistory()}
            className="px-icon-btn"
            title="Footprints & History"
          >
            <Footprints className="w-[18px] h-[18px]" />
          </button>
          <button
            onClick={() => {
              if (navigator.share) {
                navigator.share({
                  title: `${currentUser.username} on Pulse`,
                  url: window.location.href
                }).catch(() => {});
              } else {
                navigator.clipboard?.writeText(window.location.href);
                onToast('Profile link copied to clipboard 🔗');
              }
            }}
            className="px-icon-btn"
            title="Share Profile"
          >
            <Share2 className="w-[18px] h-[18px]" />
          </button>
          <button
            onClick={() => setShowDrawer(true)}
            className="px-icon-btn"
            title="Menu"
          >
            <Menu className="w-[18px] h-[18px]" />
          </button>
        </div>
      </div>

      {/* 2. AVATAR & EDIT PHOTO BUTTON */}
      <div className="flex flex-col items-start px-3.5 pt-2 pb-0.5 relative">
        <div className="relative" style={{ marginTop: -44 }}>
          {/* Ring-style avatar matching Pulse 2026 profile */}
          <div
            className="rounded-full relative"
            style={{
              width: 84, height: 84, padding: 3,
              background: 'linear-gradient(135deg,#fff,#777,#fff)',
              boxShadow: '0 0 0 4px var(--bg), 0 14px 40px rgba(0,0,0,.5)'
            }}
          >
            <img
              src={currentUser.photoURL}
              alt={currentUser.username}
              className="w-full h-full object-cover rounded-full"
              style={{ border: '2px solid var(--bg)' }}
            />
          </div>
          <span
            className="absolute rounded-full"
            style={{ width: 15, height: 15, right: 2, bottom: 2, border: '3px solid var(--bg)', background: 'var(--green)' }}
          />

          {/* Plus Badge at Bottom-Right */}
          <button
            onClick={() => {
              setEditUsername(currentUser.username);
              setEditBio(currentUser.bio || '');
              setEditAvatar(currentUser.photoURL);
              setShowEditModal(true);
            }}
            className="absolute -bottom-0.5 -left-0.5 w-5 h-5 rounded-full bg-[#20D5EC] text-white flex items-center justify-center border border-black shadow-xs cursor-pointer hover:scale-105 transition-transform"
            title="Change photo / Edit profile"
          >
            <Plus className="w-3 h-3 stroke-[3]" />
          </button>
        </div>

        {/* 3. USERNAME ROW WITH INLINE EDIT BUTTON */}
        <div className="flex items-center justify-start gap-1.5 mt-2.5">
          <h1 className="font-black tracking-tight flex items-center gap-1" style={{ fontSize: 19, letterSpacing: '-.5px', color: 'var(--text)' }}>
            {currentUser.username}
            {currentUser.verified && <VerifiedBadge size="xs" />}
          </h1>
        </div>

        {/* Handle */}
        <span className="text-[11px] font-normal mt-0.5" style={{ color: 'var(--muted)' }}>
          {currentUser.handle.startsWith('@') ? currentUser.handle : `@${currentUser.handle}`}
        </span>

        {/* Inline Edit Pill Button */}
        <button
          onClick={() => {
            setEditUsername(currentUser.username);
            setEditBio(currentUser.bio || '');
            setEditAvatar(currentUser.photoURL);
            setShowEditModal(true);
          }}
          className="mt-2 px-3.5 h-8 text-[11px] font-bold rounded-xl cursor-pointer transition-colors"
          style={{ background: 'var(--white)', color: 'var(--black)' }}
        >
          Edit profile
        </button>

        {/* 4. STATS ROW — bordered 3-column grid like reference */}
        <div
          className="grid grid-cols-3 w-full mt-3 py-2.5"
          style={{ borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}
        >
          <div
            onClick={() => onOpenFollowList('following', currentUser.uid)}
            className="flex flex-col items-center cursor-pointer hover:opacity-80 transition-opacity"
          >
            <b className="font-extrabold" style={{ fontSize: 15, color: 'var(--text)' }}>{formatCount(currentUser.following || 0)}</b>
            <span className="mt-0.5" style={{ fontSize: 9.5, color: 'var(--dim)' }}>Following</span>
          </div>

          <div
            onClick={() => onOpenFollowList('followers', currentUser.uid)}
            className="flex flex-col items-center cursor-pointer hover:opacity-80 transition-opacity"
            style={{ borderLeft: '1px solid var(--line)', borderRight: '1px solid var(--line)' }}
          >
            <b className="font-extrabold" style={{ fontSize: 15, color: 'var(--text)' }}>{formatCount(currentUser.followers || 0)}</b>
            <span className="mt-0.5" style={{ fontSize: 9.5, color: 'var(--dim)' }}>Followers</span>
          </div>

          <div className="flex flex-col items-center">
            <b className="font-extrabold" style={{ fontSize: 15, color: 'var(--text)' }}>
              {formatCount(currentUser.likesReceived || userVideos.reduce((acc, v) => acc + (v.likeCount || 0), 0))}
            </b>
            <span className="mt-0.5" style={{ fontSize: 9.5, color: 'var(--dim)' }}>Likes</span>
          </div>
        </div>

        {/* 5. BIO & INTEREST PILLS ROW (Compact, rounded pills) */}
        <div className="flex items-center justify-start gap-1 mt-2 flex-wrap">
          {currentUser.bio ? (
            <button
              onClick={() => setShowEditModal(true)}
              className="px-2.5 py-0.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 text-[10px] font-medium rounded-full border border-white/10 cursor-pointer max-w-[170px] truncate"
            >
              {currentUser.bio}
            </button>
          ) : (
            <button
              onClick={() => setShowEditModal(true)}
              className="px-2.5 py-0.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-[10px] font-medium rounded-full border border-white/10 cursor-pointer flex items-center gap-1"
            >
              <Plus className="w-2.5 h-2.5 text-neutral-400" />
              <span>Add bio</span>
            </button>
          )}

          <button
            onClick={() => setShowEditModal(true)}
            className="px-2.5 py-0.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-[10px] font-medium rounded-full border border-white/10 cursor-pointer flex items-center gap-1"
          >
            <span>❤️ My hobbies are...</span>
          </button>
        </div>

        {/* Optional Social Links if provided */}
        {(currentUser.websiteLink || currentUser.instagramLink || currentUser.youtubeLink) && (
          <div className="flex items-center gap-2 mt-1 text-[9.5px] text-neutral-400">
            {currentUser.websiteLink && (
              <a href={currentUser.websiteLink} target="_blank" rel="noreferrer" className="flex items-center gap-0.5 text-[#20D5EC] hover:underline">
                <Globe className="w-2.5 h-2.5" /> Website
              </a>
            )}
            {currentUser.instagramLink && (
              <a href={`https://instagram.com/${currentUser.instagramLink}`} target="_blank" rel="noreferrer" className="flex items-center gap-0.5 text-pink-400 hover:underline">
                <Instagram className="w-2.5 h-2.5" /> Instagram
              </a>
            )}
            {currentUser.youtubeLink && (
              <a href={`https://youtube.com/@${currentUser.youtubeLink}`} target="_blank" rel="noreferrer" className="flex items-center gap-0.5 text-rose-400 hover:underline">
                <Youtube className="w-2.5 h-2.5" /> YouTube
              </a>
            )}
          </div>
        )}
      </div>

      {/* 6. PROFILE TABS (Minimalist icon tabs with active underline) */}
      <div className="flex mt-3 px-1" style={{ height: 46, borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
        {/* Equalizer Soundwave / Video tab */}
        <button
          onClick={() => setActiveTab('videos')}
          className={`flex-1 py-1.5 flex justify-center items-center relative cursor-pointer ${
            activeTab === 'videos' ? 'text-white' : 'text-neutral-500 hover:text-neutral-300'
          }`}
        >
          <div className="flex items-center gap-[2px] h-3">
            <span className={`w-[1.5px] h-2 rounded-full ${activeTab === 'videos' ? 'bg-white' : 'bg-neutral-600'}`} />
            <span className={`w-[1.5px] h-3 rounded-full ${activeTab === 'videos' ? 'bg-white' : 'bg-neutral-600'}`} />
            <span className={`w-[1.5px] h-1.5 rounded-full ${activeTab === 'videos' ? 'bg-white' : 'bg-neutral-600'}`} />
            <span className={`w-[1.5px] h-2.5 rounded-full ${activeTab === 'videos' ? 'bg-white' : 'bg-neutral-600'}`} />
            <span className={`w-[1.5px] h-2 rounded-full ${activeTab === 'videos' ? 'bg-white' : 'bg-neutral-600'}`} />
            <span className={`w-[1.5px] h-2.5 rounded-full ${activeTab === 'videos' ? 'bg-white' : 'bg-neutral-600'}`} />
          </div>
          {activeTab === 'videos' && (
            <div className="absolute bottom-0 left-6 right-6 h-[1.5px] bg-white rounded-full" />
          )}
        </button>

        {/* Private / Lock tab */}
        <button
          onClick={() => setActiveTab('private')}
          className={`flex-1 py-1.5 flex justify-center items-center relative cursor-pointer ${
            activeTab === 'private' ? 'text-white' : 'text-neutral-500 hover:text-neutral-300'
          }`}
        >
          <Lock className="w-3 h-3 stroke-[2.2]" />
          {activeTab === 'private' && (
            <div className="absolute bottom-0 left-6 right-6 h-[1.5px] bg-white rounded-full" />
          )}
        </button>

        {/* Bookmark tab */}
        <button
          onClick={() => setActiveTab('saved')}
          className={`flex-1 py-1.5 flex justify-center items-center relative cursor-pointer ${
            activeTab === 'saved' ? 'text-white' : 'text-neutral-500 hover:text-neutral-300'
          }`}
        >
          <Bookmark className="w-3 h-3 stroke-[2.2]" />
          {activeTab === 'saved' && (
            <div className="absolute bottom-0 left-6 right-6 h-[1.5px] bg-white rounded-full" />
          )}
        </button>

        {/* Liked / Heart tab */}
        <button
          onClick={() => setActiveTab('liked')}
          className={`flex-1 py-1.5 flex justify-center items-center relative cursor-pointer ${
            activeTab === 'liked' ? 'text-white' : 'text-neutral-500 hover:text-neutral-300'
          }`}
        >
          <Heart className="w-3 h-3 stroke-[2.2]" />
          {activeTab === 'liked' && (
            <div className="absolute bottom-0 left-6 right-6 h-[1.5px] bg-white rounded-full" />
          )}
        </button>
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
                    onToast('Offline videos coming soon');
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
