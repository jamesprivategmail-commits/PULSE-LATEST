import React, { useState, useEffect, useRef } from 'react';
import {
  auth,
  onAuthStateChanged,
  signOut
} from './backend';
import {
  subscribeToUserProfile,
  subscribeToVideos,
  subscribeToActiveStories,
  subscribeToActiveLiveStreams,
  subscribeToNotifications,
  subscribeToTotalUnreadMessages,
  subscribeToUserFollowing,
  markNotificationsAsRead,
  getFollowingList,
  getOrCreateUserProfile,
  clearExpiredSuspension,
  deleteVideoPost,
  getCachedUserProfile,
  cacheUserProfile,
  getCachedFollowingUids,
  cacheFollowingUids,
  clearCachedFollowingUids,
  subscribeToIncomingCalls,
  initiateDirectCall,
  answerDirectCall,
  declineDirectCall,
  updateUserPresence,
  PRESENCE_HEARTBEAT_INTERVAL_MS
} from './services/pulseDb';
import { APP_LOGO_URL } from './constants/branding';
import { SplashScreen } from './components/SplashScreen';
import { UserProfile, VideoPost, StoryItem, NotificationItem, CallSession, LiveStream } from './types';
import { PostCard } from './components/PostCard';
import { AuthModal } from './components/AuthModal';
import { CommentsSheet } from './components/CommentsSheet';
import { CreatePostModal } from './components/CreatePostModal';
import { EditPostModal } from './components/EditPostModal';
import { SearchPage } from './components/SearchPage';
import { InboxPage } from './components/InboxPage';
import { FriendsPage } from './components/FriendsPage';
import { UserProfilePage } from './components/UserProfilePage';
import { OtherProfilePage } from './components/OtherProfilePage';
import { ChatPage } from './components/ChatPage';
import { BannedScreen } from './components/BannedScreen';
import { ReportModal } from './components/ReportModal';
import { SettingsModal } from './components/SettingsModal';
import { FollowersModal } from './components/FollowersModal';
import { WatchHistoryModal } from './components/WatchHistoryModal';
import { PlaylistsModal } from './components/PlaylistsModal';
import { FeedbackOwnerModal } from './components/FeedbackOwnerModal';
import { StoryViewerModal } from './components/StoryViewerModal';
import { CreatorStudioModal } from './components/CreatorStudioModal';
import { GroupChatsModal } from './components/GroupChatsModal';
import { SoundPageModal } from './components/SoundPageModal';
import { ShareModal } from './components/ShareModal';
import { StoriesBar } from './components/StoriesBar';
import { Toast } from './components/Toast';
import { LiveStreamRoomModal } from './components/LiveStreamRoomModal';
import { LiveDiscoveryGrid } from './components/live/LiveDiscoveryGrid';
import { DirectCallModal } from './components/DirectCallModal';
import { IncomingCallBanner } from './components/IncomingCallBanner';
import { 
  Volume2, 
  VolumeX, 
  Search, 
  Home, 
  Users, 
  Plus, 
  Bell, 
  User as UserIcon,
  Sparkles,
  Radio,
  Clock,
  X
} from 'lucide-react';

export default function App() {
  // 2-Second Initial Splash Screen on website entry
  const [showSplash, setShowSplash] = useState(true);

  // Authentication & Current User State (Instant cache hydration to prevent auto logout)
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => getCachedUserProfile());
  const [authChecked, setAuthChecked] = useState(false);
  const authCheckedRef = useRef(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // App Navigation & Tabs
  const [feedTab, setFeedTab] = useState<'foryou' | 'following'>('foryou');
  const [navTab, setNavTab] = useState<'home' | 'friends' | 'inbox' | 'profile'>('home');

  // Video Feed & Content State
  const [allVideos, setAllVideos] = useState<VideoPost[]>([]);
  const [activeStories, setActiveStories] = useState<StoryItem[]>([]);
  const [activeLiveCount, setActiveLiveCount] = useState<number>(0);
  const [activeLiveStreams, setActiveLiveStreams] = useState<LiveStream[]>([]);
  const [unreadNotifCount, setUnreadNotifCount] = useState<number>(0);
  const [unreadChatCount, setUnreadChatCount] = useState<number>(0);
  const [screenTimeLocked, setScreenTimeLocked] = useState<boolean>(false);
  const [unlockPinInput, setUnlockPinInput] = useState<string>('');
  const [screenTimeLimitMinutes, setScreenTimeLimitMinutes] = useState<number>(0);
  const [hiddenVideoIds, setHiddenVideoIds] = useState<string[]>([]);
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);
  const [followingUids, setFollowingUids] = useState<string[]>(() => {
    const cachedProfile = getCachedUserProfile();
    return cachedProfile?.uid ? getCachedFollowingUids(cachedProfile.uid) : [];
  });
  const [activeVideoIndex, setActiveVideoIndex] = useState(0);
  const [muted, setMuted] = useState(true);

  // Modals & Active Sheets
  const [activeCommentsVideo, setActiveCommentsVideo] = useState<VideoPost | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createModalPostType, setCreateModalPostType] = useState<'feed' | 'story'>('feed');
  const [editingVideo, setEditingVideo] = useState<VideoPost | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [showLiveDiscovery, setShowLiveDiscovery] = useState(false);
  const [searchInitialQuery, setSearchInitialQuery] = useState('');
  const [selectedCreator, setSelectedCreator] = useState<{ handle: string; uid: string } | null>(null);
  const [chatRecipient, setChatRecipient] = useState<{ uid: string; handle: string; avatar: string } | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showWatchHistory, setShowWatchHistory] = useState(false);
  const [showPlaylists, setShowPlaylists] = useState(false);
  const [playlistVideoTarget, setPlaylistVideoTarget] = useState<VideoPost | null>(null);
  const [showCreatorStudio, setShowCreatorStudio] = useState(false);
  const [showGroupChats, setShowGroupChats] = useState(false);
  const [soundModalState, setSoundModalState] = useState<{
    isOpen: boolean;
    soundTitle: string;
    creatorHandle?: string;
    creatorAvatar?: string;
  }>({
    isOpen: false,
    soundTitle: ''
  });
  const [shareVideoTarget, setShareVideoTarget] = useState<VideoPost | null>(null);

  // Live Stream State (Broadcaster / Viewer)
  const [liveStreamState, setLiveStreamState] = useState<{
    isOpen: boolean;
    mode: 'broadcast' | 'viewer';
    streamId?: string;
    hostProfile?: UserProfile | null;
  }>({
    isOpen: false,
    mode: 'broadcast'
  });

  // Stories Modal
  const [storyViewerState, setStoryViewerState] = useState<{
    isOpen: boolean;
    initialIndex: number;
  }>({
    isOpen: false,
    initialIndex: 0
  });

  const [showFeedbackOwner, setShowFeedbackOwner] = useState(false);

  // Real-time Calling State (LiveKit & Firestore Signaling)
  const [activeCallSession, setActiveCallSession] = useState<CallSession | null>(null);
  const [incomingCallSession, setIncomingCallSession] = useState<CallSession | null>(null);
  const [isCallModalOpen, setIsCallModalOpen] = useState(false);
  const [isCallMinimized, setIsCallMinimized] = useState(false);
  const isStartingCallRef = useRef(false);

  // Followers & Report Modals
  const [followersModalState, setFollowersModalState] = useState<{
    isOpen: boolean;
    mode: 'followers' | 'following' | 'requests';
    targetUid: string;
  }>({
    isOpen: false,
    mode: 'followers',
    targetUid: ''
  });

  const [reportState, setReportState] = useState<{
    isOpen: boolean;
    type: 'user' | 'video' | 'comment';
    targetId: string;
    targetHandle?: string;
  }>({
    isOpen: false,
    type: 'video',
    targetId: ''
  });

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<any>(null);
  const lastBackPressRef = useRef<number>(0);

  const feedContainerRef = useRef<HTMLDivElement>(null);

  // Active State tracking for Mobile Back-Button Gesture
  const activeStateRef = useRef({
    liveStreamOpen: liveStreamState.isOpen,
    showSettings,
    showWatchHistory,
    showPlaylists,
    showCreatorStudio,
    soundModalOpen: soundModalState.isOpen,
    shareModalOpen: !!shareVideoTarget,
    storyViewerOpen: storyViewerState.isOpen,
    followersModalOpen: followersModalState.isOpen,
    reportModalOpen: reportState.isOpen,
    chatRecipient,
    selectedCreator,
    activeCommentsVideo,
    showCreateModal,
    editingVideo,
    showSearch,
    showLiveDiscovery,
    showAuthModal,
    navTab,
    feedTab
  });

  useEffect(() => {
    activeStateRef.current = {
      liveStreamOpen: liveStreamState.isOpen,
      showSettings,
      showWatchHistory,
      showPlaylists,
      showCreatorStudio,
      soundModalOpen: soundModalState.isOpen,
      shareModalOpen: !!shareVideoTarget,
      storyViewerOpen: storyViewerState.isOpen,
      followersModalOpen: followersModalState.isOpen,
      reportModalOpen: reportState.isOpen,
      chatRecipient,
      selectedCreator,
      activeCommentsVideo,
      showCreateModal,
      editingVideo,
      showSearch,
      showLiveDiscovery,
      showAuthModal,
      navTab,
      feedTab
    };
  }, [
    liveStreamState.isOpen,
    showSettings,
    showWatchHistory,
    showPlaylists,
    showCreatorStudio,
    soundModalState.isOpen,
    shareVideoTarget,
    storyViewerState.isOpen,
    followersModalState.isOpen,
    reportState.isOpen,
    chatRecipient,
    selectedCreator,
    activeCommentsVideo,
    showCreateModal,
    editingVideo,
    showSearch,
    showLiveDiscovery,
    showAuthModal,
    navTab,
    feedTab
  ]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 2500);
  };

  // Mobile Back-Button Gesture Interceptor
  useEffect(() => {
    window.history.replaceState({ app: 'pulse', layer: 'root' }, '');

    const handlePopState = () => {
      const state = activeStateRef.current;

      if (state.liveStreamOpen) {
        setLiveStreamState(prev => ({ ...prev, isOpen: false }));
        window.history.pushState({ app: 'pulse', layer: 'main' }, '');
      } else if (state.storyViewerOpen) {
        setStoryViewerState({ isOpen: false, initialIndex: 0 });
        window.history.pushState({ app: 'pulse', layer: 'main' }, '');
      } else if (state.soundModalOpen) {
        setSoundModalState(prev => ({ ...prev, isOpen: false }));
        window.history.pushState({ app: 'pulse', layer: 'main' }, '');
      } else if (state.shareModalOpen) {
        setShareVideoTarget(null);
        window.history.pushState({ app: 'pulse', layer: 'main' }, '');
      } else if (state.showPlaylists) {
        setShowPlaylists(false);
        window.history.pushState({ app: 'pulse', layer: 'main' }, '');
      } else if (state.showCreatorStudio) {
        setShowCreatorStudio(false);
        window.history.pushState({ app: 'pulse', layer: 'profile' }, '');
      } else if (state.reportModalOpen) {
        setReportState(prev => ({ ...prev, isOpen: false }));
        window.history.pushState({ app: 'pulse', layer: 'main' }, '');
      } else if (state.showSettings) {
        setShowSettings(false);
        window.history.pushState({ app: 'pulse', layer: 'profile' }, '');
      } else if (state.showWatchHistory) {
        setShowWatchHistory(false);
        window.history.pushState({ app: 'pulse', layer: 'profile' }, '');
      } else if (state.followersModalOpen) {
        setFollowersModalState(prev => ({ ...prev, isOpen: false }));
        window.history.pushState({ app: 'pulse', layer: 'profile' }, '');
      } else if (state.chatRecipient) {
        setChatRecipient(null);
        window.history.pushState({ app: 'pulse', layer: 'creator' }, '');
      } else if (state.selectedCreator) {
        setSelectedCreator(null);
        window.history.pushState({ app: 'pulse', layer: 'main' }, '');
      } else if (state.activeCommentsVideo) {
        setActiveCommentsVideo(null);
        window.history.pushState({ app: 'pulse', layer: 'main' }, '');
      } else if (state.showCreateModal) {
        setShowCreateModal(false);
        window.history.pushState({ app: 'pulse', layer: 'main' }, '');
      } else if (state.editingVideo) {
        setEditingVideo(null);
        window.history.pushState({ app: 'pulse', layer: 'main' }, '');
      } else if (state.showSearch) {
        setShowSearch(false);
        window.history.pushState({ app: 'pulse', layer: 'main' }, '');
      } else if (state.showLiveDiscovery) {
        setShowLiveDiscovery(false);
        window.history.pushState({ app: 'pulse', layer: 'main' }, '');
      } else if (state.showAuthModal) {
        setShowAuthModal(false);
        window.history.pushState({ app: 'pulse', layer: 'main' }, '');
      } else if (state.navTab !== 'home') {
        setNavTab('home');
        window.history.pushState({ app: 'pulse', layer: 'main' }, '');
      } else if (state.feedTab !== 'foryou') {
        setFeedTab('foryou');
        window.history.pushState({ app: 'pulse', layer: 'main' }, '');
      } else {
        const now = Date.now();
        if (now - lastBackPressRef.current < 2500) {
          return;
        } else {
          lastBackPressRef.current = now;
          window.history.pushState({ app: 'pulse', layer: 'root' }, '');
          showToast('Press Back again to exit Pulse');
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const pushHistoryLayer = (layerName: string) => {
    window.history.pushState({ app: 'pulse', layer: layerName, t: Date.now() }, '');
  };

  // Closes every full-screen/modal overlay that isn't tied to navTab. These
  // overlays (search, chat, settings, etc.) are always mounted and simply
  // toggle visibility via `isOpen` — if one is left open while the user
  // navigates to a new destination (e.g. tapping a profile from inside
  // Search), it stays rendered on top of that destination since they all
  // share the same z-index. Every "go somewhere new" action should call
  // this first so only the new destination is left visible.
  //
  // `keep` lists overlay keys that should NOT be closed — used when this
  // same action is what's opening one of these overlays.
  const closeAllOverlays = (keep: Array<'search' | 'selectedCreator' | 'chatRecipient' | 'settings'> = []) => {
    if (!keep.includes('search')) setShowSearch(false);
    if (!keep.includes('selectedCreator')) setSelectedCreator(null);
    if (!keep.includes('chatRecipient')) setChatRecipient(null);
    if (!keep.includes('settings')) setShowSettings(false);
    setShowWatchHistory(false);
    setShowPlaylists(false);
    setShowCreatorStudio(false);
    setShowGroupChats(false);
    setSoundModalState(prev => ({ ...prev, isOpen: false }));
    setShareVideoTarget(null);
    setStoryViewerState({ isOpen: false, initialIndex: 0 });
    setFollowersModalState(prev => ({ ...prev, isOpen: false }));
    setReportState(prev => ({ ...prev, isOpen: false }));
    setShowLiveDiscovery(false);
    setActiveCommentsVideo(null);
    setShowCreateModal(false);
    setEditingVideo(null);
  };

  // Single entry point for "go look at this person's profile" from anywhere
  // in the app (FYP, stories, search, notifications, followers list, group
  // chats, etc). Ownership is decided the same way everywhere: if the UID
  // (or, as a fallback, the handle) matches the signed-in user, this opens
  // the real own-profile tab instead of the OtherProfilePage overlay — a
  // tap on your own avatar must never be treated like tapping someone else's.
  const openProfile = (handle: string, uid: string) => {
    if (currentUser && (uid === currentUser.uid || (!!handle && handle === currentUser.handle))) {
      closeAllOverlays();
      pushHistoryLayer('profile');
      setNavTab('profile');
      return;
    }
    closeAllOverlays(['selectedCreator']);
    pushHistoryLayer('creator');
    setSelectedCreator({ handle, uid });
  };

  // Single entry point for opening a 1-on-1 chat from anywhere in the app
  // (search, followers, comments, stories, friends, group chats, other
  // profile, etc). Closes whatever overlay the tap originated from so the
  // chat isn't left stacked underneath/behind it.
  const openChat = (user: { uid: string; handle: string; avatar: string }) => {
    closeAllOverlays(['chatRecipient']);
    pushHistoryLayer('chat');
    setChatRecipient(user);
  };

  // A timed suspension (set via the Telegram bot's /ban <user> <reason> <hours>)
  // sets `banned: true` plus `suspendedUntil`, but nothing server-side ever
  // flips `banned` back once that deadline passes — so a 24h timeout looked
  // identical to a permanent ban until an admin manually ran /unban. This
  // checks the deadline on every profile load/update and self-heals it.
  const applyProfileWithSuspensionCheck = (profile: UserProfile) => {
    const expired = !!profile.banned && !!profile.suspendedUntil && profile.suspendedUntil > 0 && profile.suspendedUntil <= Date.now();
    if (expired) {
      const restored = { ...profile, banned: false, banReason: '', bannedAt: 0, suspendedUntil: 0 };
      setCurrentUser(restored);
      cacheUserProfile(restored);
      clearExpiredSuspension(profile.uid).catch(() => {});
      return;
    }
    setCurrentUser(profile);
    cacheUserProfile(profile);
  };

  // 1. Listen to Real Firebase Auth State
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('mode') || urlParams.has('oobCode')) {
      setShowAuthModal(true);
    }

    let unsubscribeUser = () => {};
    let unsubscribeFollowing = () => {};

    // Tracks whether the auth SDK has resolved at least once, without being
    // a piece of React state — this effect must register onAuthStateChanged
    // exactly once. Making authChecked a dependency here previously caused
    // the effect to tear down and re-run (and thus re-subscribe) right
    // after the very first callback, since that same callback also calls
    // setAuthChecked(true).
    let hasResolvedOnce = authCheckedRef.current;

    const unsubscribeAuth = onAuthStateChanged(auth, async (fbUser) => {
      unsubscribeUser();
      unsubscribeFollowing();

      if (fbUser) {
        try {
          const profile = await getOrCreateUserProfile(fbUser);
          applyProfileWithSuspensionCheck(profile);
          unsubscribeUser = subscribeToUserProfile(fbUser.uid, (p) => {
            if (p) {
              applyProfileWithSuspensionCheck(p);
            }
          });
          unsubscribeFollowing = subscribeToUserFollowing(fbUser.uid, (fList) => {
            setFollowingUids(fList);
          });
        } catch (err) {
          console.warn('Notice while setting user profile:', err);
        }
      } else {
        // Only clear if confirmed not signed in after check
        if (hasResolvedOnce) {
          cacheUserProfile(null);
          setCurrentUser(null);
          setFollowingUids([]);
          clearCachedFollowingUids();
        }
      }
      hasResolvedOnce = true;
      authCheckedRef.current = true;
      setAuthChecked(true);
    });

    return () => {
      unsubscribeAuth();
      unsubscribeUser();
      unsubscribeFollowing();
    };
  }, []);

  // 2. Real-time Video Feed & Content Subscriptions
  useEffect(() => {
    const unsubscribeVideos = subscribeToVideos((videos) => {
      setAllVideos(videos);
    });
    const unsubscribeStories = subscribeToActiveStories((stories) => {
      setActiveStories(stories);
    });
    const unsubscribeLive = subscribeToActiveLiveStreams((streams) => {
      setActiveLiveCount(streams.length);
      setActiveLiveStreams(streams);
    });

    let unsubscribeNotifs = () => {};
    let unsubscribeChats = () => {};
    let unsubscribeCalls = () => {};

    if (currentUser?.uid) {
      unsubscribeNotifs = subscribeToNotifications(currentUser.uid, (notifs) => {
        const unread = notifs.filter(n => !(n as any).read).length;
        setUnreadNotifCount(unread);
      });

      unsubscribeChats = subscribeToTotalUnreadMessages(currentUser.uid, (chatUnread) => {
        setUnreadChatCount(chatUnread);
      });

      // Real-time Incoming Call Listener
      unsubscribeCalls = subscribeToIncomingCalls(currentUser.uid, (calls) => {
        if (!calls || calls.length === 0) {
          setIncomingCallSession(null);
          return;
        }

        const latestCall = calls[0];

        // If another user is calling us (status = ringing, recipient is currentUser)
        if (latestCall.status === 'ringing' && latestCall.recipientUid === currentUser.uid) {
          setIncomingCallSession(latestCall);
        }
      });
    }

    return () => {
      unsubscribeVideos();
      unsubscribeStories();
      unsubscribeLive();
      unsubscribeNotifs();
      unsubscribeChats();
      unsubscribeCalls();
    };
  }, [currentUser?.uid]);

  // Presence Heartbeat: marks the user online while the app is open and
  // reachable, and offline on clean sign-out/close. If the tab is killed
  // outright (crash/force-quit), the heartbeat simply stops landing and
  // subscribeToUserChats' staleness check (PRESENCE_STALE_MS) treats the
  // user as offline once it goes quiet — no explicit "leave" required.
  useEffect(() => {
    const uid = currentUser?.uid;
    if (!uid) return;

    updateUserPresence(uid, true);
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        updateUserPresence(uid, true);
      }
    }, PRESENCE_HEARTBEAT_INTERVAL_MS);

    const goOffline = () => { updateUserPresence(uid, false); };
    window.addEventListener('beforeunload', goOffline);
    window.addEventListener('pagehide', goOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', goOffline);
      window.removeEventListener('pagehide', goOffline);
      updateUserPresence(uid, false);
    };
  }, [currentUser?.uid]);

  // Screen Time Active Heartbeat Tracker
  useEffect(() => {
    const todayKey = `pulse_screentime_${new Date().toISOString().split('T')[0]}`;
    const limit = Number(localStorage.getItem('pulse_screen_time_limit') || 0);
    setScreenTimeLimitMinutes(limit);

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        const currentSeconds = Number(localStorage.getItem(todayKey) || 0) + 10;
        localStorage.setItem(todayKey, String(currentSeconds));

        const activeLimit = Number(localStorage.getItem('pulse_screen_time_limit') || 0);
        if (activeLimit > 0) {
          const snoozedUntil = Number(sessionStorage.getItem('pulse_screentime_snooze') || 0);
          if (Date.now() > snoozedUntil && currentSeconds >= activeLimit * 60) {
            setScreenTimeLocked(true);
          }
        }
      }
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const handleUnlockScreenTime = () => {
    const savedPin = localStorage.getItem('pulse_safety_pin') || '';
    if (!savedPin || unlockPinInput === savedPin) {
      setScreenTimeLocked(false);
      setUnlockPinInput('');
      // Snooze for rest of session
      sessionStorage.setItem('pulse_screentime_snooze', String(Date.now() + 60 * 60 * 1000));
      showToast('Screen time unlocked for 1 hour 🌿');
    } else {
      showToast('Incorrect safety PIN');
    }
  };

  const handleSnoozeScreenTime = () => {
    setScreenTimeLocked(false);
    sessionStorage.setItem('pulse_screentime_snooze', String(Date.now() + 15 * 60 * 1000));
    showToast('Snoozed for 15 minutes');
  };

  // Mark notifications as read when viewing inbox. Runs from this single
  // effect (not from each button that navigates to Inbox) so it fires
  // exactly once per inbox visit instead of once per entry point, and the
  // badge is only cleared once the mark-as-read write has actually
  // committed — a failed write (offline, permission error, etc.) leaves
  // the badge showing the real unread count instead of a fake zero.
  useEffect(() => {
    if (navTab === 'inbox' && currentUser?.uid) {
      let cancelled = false;
      markNotificationsAsRead(currentUser.uid)
        .then((success) => {
          if (!cancelled && success) setUnreadNotifCount(0);
        })
        .catch(() => {
          // Leave the badge as-is; the real-time notifications listener
          // remains the source of truth if this failed.
        });
      return () => { cancelled = true; };
    }
  }, [navTab, currentUser?.uid]);

  // Real-time follow toggle handler to optimistically update following feed
  const handleFollowToggle = (targetUid: string, isFol: boolean) => {
    setFollowingUids(prev => {
      const updated = isFol
        ? (prev.includes(targetUid) ? prev : [...prev, targetUid])
        : prev.filter(id => id !== targetUid);
      if (currentUser?.uid) {
        cacheFollowingUids(currentUser.uid, updated);
      }
      return updated;
    });
  };

  // Filter videos for "Following" vs "For You", Tag Filter, and Not-Interested
  const displayedVideos = allVideos
    .filter(v => !hiddenVideoIds.includes(v.id))
    .filter(v => {
      if (currentUser?.blockedUids?.includes(v.ownerUid)) return false;
      if (v.visibility === 'private' && v.ownerUid !== currentUser?.uid) return false;
      if (activeTagFilter) {
        const cleanFilter = activeTagFilter.replace(/^#/, '').toLowerCase();
        return v.tags?.some(t => t.toLowerCase() === cleanFilter);
      }
      if (feedTab === 'following') {
        // Strictly show only videos posted by the users/creators you are following
        if (!currentUser) return false;
        const cleanHandle = v.ownerHandle ? v.ownerHandle.toLowerCase().replace(/^@/, '') : '';
        const isFollowed = followingUids.includes(v.ownerUid) || 
          (cleanHandle && followingUids.some(id => id.toLowerCase() === `@${cleanHandle}` || id.toLowerCase() === cleanHandle));
        return isFollowed;
      }
      return true;
    });

  // Smooth scroll to top when changing feedTab or applying tag filter
  useEffect(() => {
    setActiveVideoIndex(0);
    if (feedContainerRef.current) {
      feedContainerRef.current.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [feedTab, activeTagFilter]);

  // IntersectionObserver for video scroll-snap feed
  useEffect(() => {
    const container = feedContainerRef.current;
    if (!container) return;

    const slides = container.querySelectorAll('.slide');
    if (!slides.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = Number((entry.target as HTMLElement).dataset.index);
            if (!isNaN(index)) {
              setActiveVideoIndex(index);
            }
          }
        });
      },
      { threshold: 0.65 }
    );

    slides.forEach((slide) => observer.observe(slide));
    return () => observer.disconnect();
  }, [displayedVideos.length, navTab]);

  const handleLogout = async () => {
    const previousUid = currentUser?.uid;
    try {
      await signOut(auth);
    } catch (e) {}
    cacheUserProfile(null);
    setCurrentUser(null);
    setFollowingUids([]);
    clearCachedFollowingUids(previousUid);
    setNavTab('home');
    showToast('Logged out of Pulse');
  };

  const handleRequireAuth = () => {
    pushHistoryLayer('auth');
    setShowAuthModal(true);
  };

  const handleDeleteVideo = async (videoId: string) => {
    try {
      await deleteVideoPost(videoId);
      setAllVideos(prev => prev.filter(v => v.id !== videoId));
      showToast('Video deleted from Pulse');
    } catch (err: any) {
      showToast('Failed to delete video: ' + (err.message || 'Error'));
    }
  };

  const handleHideVideo = (videoId: string) => {
    setHiddenVideoIds(prev => [...prev, videoId]);
  };

  const handleOpenReport = (type: 'user' | 'video' | 'comment', id: string, handle?: string) => {
    if (!currentUser) {
      handleRequireAuth();
      return;
    }
    setReportState({
      isOpen: true,
      type,
      targetId: id,
      targetHandle: handle
    });
  };

  const handleOpenFollowList = (mode: 'followers' | 'following' | 'requests', uid: string) => {
    if (!currentUser) {
      handleRequireAuth();
      return;
    }
    setFollowersModalState({
      isOpen: true,
      mode,
      targetUid: uid
    });
  };

  const handleOpenStoryViewer = (index: number) => {
    pushHistoryLayer('story');
    setStoryViewerState({
      isOpen: true,
      initialIndex: index
    });
  };

  // Direct Voice & Video Call Action Handlers
  const handleStartCall = async (
    recipient: { uid: string; handle: string; username?: string; avatar: string },
    type: 'voice' | 'video'
  ) => {
    if (!currentUser) {
      handleRequireAuth();
      return;
    }
    if (recipient.uid === currentUser.uid) {
      showToast('You cannot call your own profile');
      return;
    }
    // Guard against spam: a rapid double-tap (or re-render re-firing the
    // handler) used to fire initiateDirectCall multiple times before
    // isCallModalOpen/activeCallSession updated, creating several "ringing"
    // call docs for the same request — the recipient would see repeated
    // ring notifications and none of them would end up actually connecting
    // once the user answered just one of them. Block new calls while one is
    // already being started or is already active.
    if (isStartingCallRef.current || isCallModalOpen || activeCallSession) {
      return;
    }

    isStartingCallRef.current = true;
    try {
      showToast(`Calling ${recipient.username || recipient.handle}... 📞`);
      const session = await initiateDirectCall(currentUser, recipient, type);
      setActiveCallSession(session);
      setIsCallModalOpen(true);
      setIsCallMinimized(false);
    } catch (err: any) {
      console.error('Call initiation error:', err);
      showToast('Could not initiate call: ' + (err.message || 'Error'));
    } finally {
      isStartingCallRef.current = false;
    }
  };

  const handleAcceptIncomingCall = async (callToAccept?: CallSession) => {
    const target = callToAccept || incomingCallSession;
    if (!target) return;
    try {
      await answerDirectCall(target.id);
      setActiveCallSession({
        ...target,
        status: 'accepted'
      });
      setIncomingCallSession(null);
      setIsCallModalOpen(true);
      setIsCallMinimized(false);
    } catch (err) {
      console.error('Accept incoming call error:', err);
      showToast('Failed to answer call');
    }
  };

  const handleDeclineIncomingCall = async (callToDecline?: CallSession) => {
    const target = callToDecline || incomingCallSession;
    if (!target) return;
    try {
      await declineDirectCall(target.id);
      setIncomingCallSession(null);
    } catch (err) {
      console.error('Decline call error:', err);
    }
  };

  // Called when DirectCallModal closes — either because the user hung up
  // (DirectCallModal's own handler already wrote the terminal call state +
  // duration to Firestore before invoking this) or because the call session
  // turned terminal remotely (also already logged, by whichever side ended
  // it). This only needs to reset local UI state — it must NOT call
  // endDirectCall again here, since that used to write a second, duration-0
  // "Missed" log message on top of the real one every time a call ended.
  const handleEndCall = () => {
    setIsCallModalOpen(false);
    setActiveCallSession(null);
    setIsCallMinimized(false);
  };

  return (
    <div id="app" className="relative w-full h-[100dvh] max-w-[480px] mx-auto bg-black text-white overflow-hidden select-none font-sans flex flex-col">
      {/* 2-Second Initial Entry Splash Screen */}
      {showSplash && (
        <SplashScreen durationMs={2000} onFinish={() => setShowSplash(false)} />
      )}

      {/* Toast Notification Banner */}
      <Toast message={toastMessage} />

      {/* Auth Modal */}
      {(!currentUser && showAuthModal) && (
        <AuthModal
          onSuccess={(profile) => {
            setCurrentUser(profile);
            setShowAuthModal(false);
          }}
          onToast={showToast}
          onClose={() => setShowAuthModal(false)}
        />
      )}

      {/* MAIN APPLICATION CONTAINER */}
      <div className="relative w-full flex-1 overflow-hidden">
        {/* TOP BAR */}
        {navTab === 'home' && (
          <header className="px-header">
            {/* Official Website Logo Brand Icon + Wordmark */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  setNavTab('home');
                  setFeedTab('foryou');
                }}
                className="w-8 h-8 rounded-full bg-white flex items-center justify-center p-1 hover:scale-105 active:scale-90 transition-all cursor-pointer overflow-hidden shrink-0 mr-0.5"
                title="Pulse Home"
              >
                <img
                  src={APP_LOGO_URL}
                  alt="Pulse Logo"
                  className="w-full h-full object-contain rounded-full"
                  decoding="sync"
                  loading="eager"
                />
              </button>
              <span style={{ fontSize: 17, fontWeight: 850, letterSpacing: '-.45px', color: 'var(--text)' }}>Pulse</span>
            </div>

            <div className="flex items-center gap-1">
              {/* Search Trigger */}
              <button
                id="openSearch"
                onClick={() => {
                  closeAllOverlays(['search']);
                  pushHistoryLayer('search');
                  setShowSearch(true);
                }}
                className="px-icon-btn"
                title="Search"
              >
                <Search className="w-[19px] h-[19px]" strokeWidth={1.8} />
              </button>

              {/* Notifications Trigger */}
              <button
                onClick={() => {
                  if (!currentUser) {
                    handleRequireAuth();
                    return;
                  }
                  pushHistoryLayer('inbox');
                  setNavTab('inbox');
                }}
                className="px-icon-btn"
                title="Notifications"
              >
                <Bell className="w-[19px] h-[19px]" strokeWidth={1.8} />
                {unreadNotifCount > 0 && (
                  <span className="px-badge">
                    {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
                  </span>
                )}
              </button>
            </div>
          </header>
        )}

        {/* FEED VIEW (Home Tab) */}
        {navTab === 'home' && (
          <main
            ref={feedContainerRef}

            id="feed"
            className="feed-scroll-container w-full h-full overflow-y-auto scrollbar-none"
          >
            {/* Feed top row: For You / Following segment + live-now pill — matches design's .feed-top-row */}
            <div className="px-3.5 pt-3 pb-2.5 flex items-center justify-between gap-2">
              <div className="px-segment" style={{ width: 'auto' }}>
                {activeTagFilter ? (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs">
                    <span className="text-[#25f4ee] font-bold">#{activeTagFilter.replace(/^#/, '')}</span>
                    <button
                      onClick={() => setActiveTagFilter(null)}
                      className="text-neutral-400 hover:text-white font-bold cursor-pointer"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      id="tabForYou"
                      onClick={() => setFeedTab('foryou')}
                      className={feedTab === 'foryou' ? 'active' : ''}
                    >
                      For You
                    </button>
                    <button
                      id="tabFollowing"
                      onClick={() => {
                        if (!currentUser) {
                          handleRequireAuth();
                          return;
                        }
                        pushHistoryLayer('following');
                        setFeedTab('following');
                      }}
                      className={feedTab === 'following' ? 'active' : ''}
                    >
                      Following
                    </button>
                  </>
                )}
              </div>

              <button
                onClick={() => {
                  pushHistoryLayer('live');
                  setShowLiveDiscovery(true);
                }}
                className="h-8 px-2.5 flex items-center gap-1.5 rounded-full text-[#ddd] bg-[#111113] border border-white/[0.075] text-[9px] font-extrabold shrink-0"
                title={activeLiveCount > 0 ? "See who's live" : 'Discover'}
              >
                <i
                  className={`w-[7px] h-[7px] rounded-full ${activeLiveCount > 0 ? 'bg-[#ff5361] shadow-[0_0_12px_rgba(255,83,97,0.7)] animate-pulse' : 'bg-white/25'}`}
                />
                {activeLiveCount > 0 ? `${activeLiveCount} Live` : 'Live'}
              </button>
            </div>

            {currentUser && (
              <StoriesBar
                currentUser={currentUser}
                stories={activeStories}
                onOpenStory={handleOpenStoryViewer}
                onAddStory={() => {
                  pushHistoryLayer('create');
                  setCreateModalPostType('story');
                  setShowCreateModal(true);
                }}
                onOpenProfile={(handle, uid) => {
                  openProfile(handle, uid);
                }}
                onOpenChat={openChat}
              />
            )}
            {displayedVideos.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-4 text-center select-none animate-in fade-in duration-200">
                <div className="w-9 h-9 rounded-full bg-neutral-900 border border-white/10 flex items-center justify-center mb-2.5 text-[#25f4ee] shadow-md">
                  {feedTab === 'following' ? (
                    <Radio className="w-4.5 h-4.5 text-[#25f4ee]" />
                  ) : (
                    <Sparkles className="w-4.5 h-4.5 text-[#ff2b54]" />
                  )}
                </div>
                <h3 className="text-xs font-bold text-white mb-1">
                  {activeTagFilter
                    ? `No videos found with tag #${activeTagFilter.replace(/^#/, '')}`
                    : feedTab === 'following'
                    ? (!currentUser
                        ? 'Sign in to see Following feed'
                        : followingUids.length === 0
                        ? 'You are not following anyone yet'
                        : 'No videos from creators you follow')
                    : 'No videos found'}
                </h3>
                <p className="text-[9.5px] text-neutral-400 max-w-[230px] mb-3.5 leading-relaxed">
                  {activeTagFilter
                    ? 'Try clearing the tag filter or uploading a video with this hashtag!'
                    : feedTab === 'following'
                    ? (!currentUser
                        ? 'Log in to follow your favorite creators and watch their newest video posts here.'
                        : followingUids.length === 0
                        ? 'Explore the FYP feed or search creators to follow them and fill your personalized Following feed.'
                        : 'When creators you follow post new videos, they will appear right here in real time.')
                    : 'Be the first creator to upload a video to Pulse!'}
                </p>
                {activeTagFilter ? (
                  <button
                    onClick={() => setActiveTagFilter(null)}
                    className="px-2.5 py-1 bg-[#25f4ee] text-black font-bold rounded-full text-[10px] cursor-pointer shadow-xs active:scale-95 transition-transform max-w-[120px] mx-auto"
                  >
                    Clear Tag Filter
                  </button>
                ) : feedTab === 'following' ? (
                  !currentUser ? (
                    <button
                      onClick={handleRequireAuth}
                      className="px-2.5 py-1 bg-[#ff2b54] text-white font-semibold rounded-full text-[10px] cursor-pointer shadow-xs active:scale-95 transition-transform max-w-[120px] mx-auto"
                    >
                      Sign In to Pulse
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setFeedTab('foryou')}
                        className="px-2.5 py-1 bg-[#ff2b54] text-white font-semibold rounded-full text-[10px] cursor-pointer shadow-xs active:scale-95 transition-transform"
                      >
                        Explore FYP Feed
                      </button>
                      <button
                        onClick={() => {
                          closeAllOverlays(['search']);
                          pushHistoryLayer('search');
                          setShowSearch(true);
                        }}
                        className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-white font-medium rounded-full text-[10px] cursor-pointer border border-white/10 shadow-xs active:scale-95 transition-transform"
                      >
                        Find Creators
                      </button>
                    </div>
                  )
                ) : (
                  <button
                    onClick={() => {
                      if (!currentUser) handleRequireAuth();
                      else {
                        pushHistoryLayer('create');
                        setCreateModalPostType('feed');
                        setShowCreateModal(true);
                      }
                    }}
                    className="px-2.5 py-1 bg-[#ff2b54] text-white font-semibold rounded-full text-[10px] cursor-pointer shadow-xs active:scale-95 transition-transform max-w-[110px] mx-auto"
                  >
                    Post a Video
                  </button>
                )}
              </div>
            ) : (
              displayedVideos.map((video, idx) => (
                <PostCard
                  key={video.id}
                  video={video}
                  currentUser={currentUser}
                  isFollowing={
                    followingUids.includes(video.ownerUid) || 
                    (video.ownerHandle ? followingUids.some(id => {
                      const clean = id.toLowerCase().replace(/^@/, '');
                      const vidClean = video.ownerHandle.toLowerCase().replace(/^@/, '');
                      return clean === vidClean;
                    }) : false)
                  }
                  onFollowToggle={handleFollowToggle}
                  onOpenComments={(v) => {
                    pushHistoryLayer('comments');
                    setActiveCommentsVideo(v);
                  }}
                  onOpenProfile={(handle, uid) => {
                    openProfile(handle, uid);
                  }}
                  onOpenReport={(type, id, handle) => handleOpenReport(type, id, handle)}
                  onOpenShare={(v) => setShareVideoTarget(v)}
                  onToast={showToast}
                  onRequireAuth={handleRequireAuth}
                />
              ))
            )}
          </main>
        )}

        {/* PROFILE VIEW */}
        {navTab === 'profile' && currentUser && (
          <UserProfilePage
            currentUser={currentUser}
            onLogout={handleLogout}
            onSelectVideo={() => {
              setFeedTab('foryou');
              setNavTab('home');
            }}
            onOpenSettings={() => setShowSettings(true)}
            onOpenFollowList={handleOpenFollowList}
            onOpenWatchHistory={() => setShowWatchHistory(true)}
            onOpenPlaylists={(video) => {
              setPlaylistVideoTarget(video || null);
              setShowPlaylists(true);
            }}
            onOpenCreatorStudio={() => setShowCreatorStudio(true)}
            onUpdateUser={(updated) => {
              setCurrentUser(prev => prev ? { ...prev, ...updated } : null);
            }}
            onToast={showToast}
          />
        )}

        {/* FRIENDS VIEW WITH STORIES CAROUSEL */}
        {navTab === 'friends' && currentUser && (
          <div className="w-full h-full flex flex-col">
            <StoriesBar
              currentUser={currentUser}
              stories={activeStories}
              onOpenStory={handleOpenStoryViewer}
              onAddStory={() => {
                pushHistoryLayer('create');
                setCreateModalPostType('story');
                setShowCreateModal(true);
              }}
              onOpenProfile={(handle, uid) => {
                openProfile(handle, uid);
              }}
              onOpenChat={openChat}
            />
            <div className="flex-1">
              <FriendsPage
                isOpen={true}
                currentUser={currentUser}
                onClose={() => setNavTab('home')}
                onSelectUser={(handle, uid) => {
                  openProfile(handle, uid);
                }}
                onOpenChat={openChat}
                onFollowToggle={handleFollowToggle}
                onToast={showToast}
              />
            </div>
          </div>
        )}

        {/* INBOX VIEW */}
        {navTab === 'inbox' && currentUser && (
          <InboxPage
            isOpen={true}
            currentUser={currentUser}
            onClose={() => setNavTab('home')}
            onSelectUser={(handle, uid) => {
              openProfile(handle, uid);
            }}
            onOpenChat={openChat}
            onOpenFollowList={handleOpenFollowList}
            onToast={showToast}
          />
        )}

        {/* BOTTOM NAVIGATION BAR */}
        <nav
          className="absolute bottom-0 left-0 right-0 z-40 flex items-center justify-around pb-[env(safe-area-inset-bottom)] text-white transition-colors pointer-events-auto"
          style={{ height: 60, background: 'rgba(7,7,8,.95)', backdropFilter: 'blur(26px)', WebkitBackdropFilter: 'blur(26px)', borderTop: '1px solid var(--line)' }}
        >
          {/* Home */}
          <button
            onClick={() => {
              closeAllOverlays();
              setActiveTagFilter(null);
              setNavTab('home');
            }}
            className={`px-nav-btn ${navTab === 'home' ? 'active' : ''}`}
          >
            <Home
              className="w-[22px] h-[22px]"
              strokeWidth={navTab === 'home' ? 2.4 : 1.8}
              fill={navTab === 'home' ? 'currentColor' : 'none'}
            />
          </button>

          {/* Discover */}
          <button
            onClick={() => {
              closeAllOverlays(['search']);
              setShowSearch(true);
            }}
            className={`px-nav-btn ${showSearch ? 'active' : ''}`}
          >
            <Search
              className="w-[22px] h-[22px]"
              strokeWidth={showSearch ? 2.4 : 1.8}
            />
          </button>

          {/* Create Button */}
          <button
            id="navCreateBtn"
            onClick={() => {
              if (!currentUser) {
                handleRequireAuth();
                return;
              }
              closeAllOverlays();
              pushHistoryLayer('create');
              setCreateModalPostType('feed');
              setShowCreateModal(true);
            }}
            className="px-nav-create cursor-pointer active:scale-90 transition-transform"
          >
            <Plus className="w-[20px] h-[20px]" strokeWidth={2.6} />
          </button>

          {/* Inbox */}
          <button
            onClick={() => {
              if (!currentUser) {
                handleRequireAuth();
                return;
              }
              closeAllOverlays();
              pushHistoryLayer('inbox');
              setNavTab('inbox');
            }}
            className={`px-nav-btn ${navTab === 'inbox' ? 'active' : ''}`}
          >
            <Bell
              className="w-[22px] h-[22px]"
              strokeWidth={navTab === 'inbox' ? 2.4 : 1.8}
              fill={navTab === 'inbox' ? 'currentColor' : 'none'}
            />
            {(unreadNotifCount + unreadChatCount) > 0 && (
              <span className="px-nav-badge">
                {(unreadNotifCount + unreadChatCount) > 9 ? '9+' : (unreadNotifCount + unreadChatCount)}
              </span>
            )}
          </button>

          {/* Profile */}
          <button
            onClick={() => {
              if (!currentUser) {
                handleRequireAuth();
                return;
              }
              closeAllOverlays();
              pushHistoryLayer('profile');
              setNavTab('profile');
            }}
            className={`px-nav-btn ${navTab === 'profile' ? 'active' : ''}`}
          >
            <UserIcon
              className="w-[22px] h-[22px]"
              strokeWidth={navTab === 'profile' ? 2.4 : 1.8}
            />
          </button>
        </nav>
      </div>

      {/* COMMENTS SHEET */}
      <CommentsSheet
        video={activeCommentsVideo}
        currentUser={currentUser}
        isOpen={!!activeCommentsVideo}
        onClose={() => setActiveCommentsVideo(null)}
        onOpenProfile={(handle, uid) => {
          setActiveCommentsVideo(null);
          if (currentUser && (uid === currentUser.uid || handle === currentUser.handle)) {
            setNavTab('profile');
          } else {
            pushHistoryLayer('otherProfile');
            setSelectedCreator({ handle, uid: uid || '' });
          }
        }}
        onOpenReport={(type, id) => handleOpenReport(type, id)}
        onToast={showToast}
        onRequireAuth={handleRequireAuth}
      />

      {/* CREATE POST & STUDIO MODAL */}
      {currentUser && (
        <CreatePostModal
          isOpen={showCreateModal}
          currentUser={currentUser}
          initialPostType={createModalPostType}
          onClose={() => setShowCreateModal(false)}
          onOpenLiveStream={() => {
            setShowCreateModal(false);
            pushHistoryLayer('live');
            setLiveStreamState({ isOpen: true, mode: 'broadcast' });
          }}
          onPostCreated={() => {
            setActiveTagFilter(null);
            setFeedTab('foryou');
            setNavTab('home');
            setActiveVideoIndex(0);
          }}
          onToast={showToast}
        />
      )}

      {/* EDIT POST MODAL */}
      <EditPostModal
        video={editingVideo}
        isOpen={!!editingVideo}
        onClose={() => setEditingVideo(null)}
        onUpdated={() => {}}
        onToast={showToast}
      />

      {/* SEARCH PAGE */}
      <SearchPage
        isOpen={showSearch}
        initialQuery={searchInitialQuery}
        currentUser={currentUser}
        onClose={() => {
          setShowSearch(false);
          setSearchInitialQuery('');
        }}
        onSelectUser={(handle, uid) => {
          openProfile(handle, uid);
        }}
        onSelectTag={(tag) => {
          setActiveTagFilter(tag);
          setNavTab('home');
          showToast(`Filtered feed by #${tag.replace(/^#/, '')}`);
        }}
        onOpenChat={openChat}
        onSelectVideo={(video) => {
          setFeedTab('foryou');
          setNavTab('home');
          const idx = allVideos.findIndex(v => v.id === video.id);
          if (idx >= 0) setActiveVideoIndex(idx);
        }}
        onEnterLiveRoom={(stream) => {
          setShowSearch(false);
          pushHistoryLayer('live');
          setLiveStreamState({ isOpen: true, mode: 'viewer', streamId: stream.id });
        }}
        onRequireAuth={handleRequireAuth}
        onToast={showToast}
      />

      {/* OTHER CREATOR PROFILE */}
      {selectedCreator && (
        <OtherProfilePage
          isOpen={true}
          handle={selectedCreator.handle}
          creatorUid={selectedCreator.uid}
          currentUser={currentUser}
          onClose={() => setSelectedCreator(null)}
          onOpenChat={openChat}
          onSelectVideo={() => {
            setSelectedCreator(null);
            setFeedTab('foryou');
            setNavTab('home');
          }}
          onOpenFollowList={handleOpenFollowList}
          onOpenReport={handleOpenReport}
          onFollowToggle={handleFollowToggle}
          onToast={showToast}
          onRequireAuth={handleRequireAuth}
          onStartCall={handleStartCall}
        />
      )}

      {/* 1-ON-1 REAL-TIME CHAT */}
      {chatRecipient && currentUser && (
        <ChatPage
          isOpen={true}
          currentUser={currentUser}
          recipient={chatRecipient}
          onClose={() => setChatRecipient(null)}
          onToast={showToast}
          onStartCall={handleStartCall}
        />
      )}

      {/* SETTINGS & PRIVACY MODAL */}
      {currentUser && (
        <SettingsModal
          isOpen={showSettings}
          currentUser={currentUser}
          onClose={() => setShowSettings(false)}
          onToast={showToast}
          onOpenWatchHistory={() => setShowWatchHistory(true)}
          onOpenFeedbackOwner={() => setShowFeedbackOwner(true)}
        />
      )}

      {/* FEEDBACK & OWNER DESK MODAL */}
      <FeedbackOwnerModal
        isOpen={showFeedbackOwner}
        currentUser={currentUser}
        onClose={() => setShowFeedbackOwner(false)}
        onToast={showToast}
        onRequireAuth={handleRequireAuth}
        onDirectMessageOwner={() => {
          setShowFeedbackOwner(false);
          setChatRecipient({
            uid: 'owner_mrnovatech',
            handle: '@mrnovatech',
            avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=mrnovatech'
          });
        }}
      />

      {/* FOLLOWERS / FOLLOWING / REQUESTS MODAL */}
      {currentUser && (
        <FollowersModal
          isOpen={followersModalState.isOpen}
          mode={followersModalState.mode}
          targetUid={followersModalState.targetUid || currentUser.uid}
          currentUser={currentUser}
          onClose={() => setFollowersModalState(prev => ({ ...prev, isOpen: false }))}
          onOpenProfile={(handle, uid) => {
            setFollowersModalState(prev => ({ ...prev, isOpen: false }));
            openProfile(handle, uid);
          }}
          onFollowToggle={handleFollowToggle}
          onToast={showToast}
        />
      )}

      {/* WATCH HISTORY MODAL */}
      <WatchHistoryModal
        isOpen={showWatchHistory}
        onClose={() => setShowWatchHistory(false)}
        onSelectVideo={() => {
          setFeedTab('foryou');
          setNavTab('home');
        }}
        onToast={showToast}
      />

      {/* PLAYLISTS MODAL */}
      {currentUser && showPlaylists && (
        <PlaylistsModal
          currentUser={currentUser}
          videoToManage={playlistVideoTarget}
          onClose={() => {
            setShowPlaylists(false);
            setPlaylistVideoTarget(null);
          }}
          onToast={showToast}
        />
      )}

      {/* CREATOR STUDIO ANALYTICS & SCHEDULING MODAL */}
      {currentUser && showCreatorStudio && (
        <CreatorStudioModal
          isOpen={showCreatorStudio}
          currentUser={currentUser}
          videos={allVideos}
          onClose={() => setShowCreatorStudio(false)}
          onSelectVideo={() => {
            setShowCreatorStudio(false);
            setFeedTab('foryou');
            setNavTab('home');
          }}
          onToast={showToast}
        />
      )}

      {/* REAL-TIME GROUP CHATS MODAL */}
      {currentUser && showGroupChats && (
        <GroupChatsModal
          currentUser={currentUser}
          isOpen={showGroupChats}
          onClose={() => setShowGroupChats(false)}
          onOpenProfile={(handle, uid) => {
            setShowGroupChats(false);
            openProfile(handle, uid);
          }}
          onToast={showToast}
        />
      )}

      {/* SOUND PAGE MODAL */}
      {soundModalState.isOpen && (
        <SoundPageModal
          isOpen={soundModalState.isOpen}
          soundTitle={soundModalState.soundTitle}
          creatorHandle={soundModalState.creatorHandle}
          creatorAvatar={soundModalState.creatorAvatar}
          allVideos={allVideos}
          onClose={() => setSoundModalState(prev => ({ ...prev, isOpen: false }))}
          onSelectVideo={() => {
            setSoundModalState(prev => ({ ...prev, isOpen: false }));
            setNavTab('home');
          }}
          onUseSound={(soundTitle) => {
            if (!currentUser) {
              handleRequireAuth();
              return;
            }
            setCreateModalPostType('feed');
            setShowCreateModal(true);
          }}
          onToast={showToast}
        />
      )}

      {/* SHARE MODAL */}
      {shareVideoTarget && (
        <ShareModal
          isOpen={!!shareVideoTarget}
          video={shareVideoTarget}
          onClose={() => setShareVideoTarget(null)}
          onToast={showToast}
        />
      )}

      {/* STORY VIEWER MODAL */}
      {activeStories.length > 0 && storyViewerState.isOpen && (
        <StoryViewerModal
          stories={activeStories}
          initialIndex={storyViewerState.initialIndex}
          currentUser={currentUser}
          onClose={() => setStoryViewerState({ isOpen: false, initialIndex: 0 })}
          onOpenProfile={(handle, uid) => {
            setStoryViewerState({ isOpen: false, initialIndex: 0 });
            openProfile(handle, uid);
          }}
          onToast={showToast}
          onRequireAuth={handleRequireAuth}
        />
      )}

      {/* REPORT MODAL */}
      {currentUser && (
        <ReportModal
          isOpen={reportState.isOpen}
          type={reportState.type}
          targetId={reportState.targetId}
          targetHandle={reportState.targetHandle}
          currentUser={currentUser}
          onClose={() => setReportState(prev => ({ ...prev, isOpen: false }))}
          onToast={showToast}
        />
      )}

      {/* LIVE DISCOVERY (the "Live" button opens this — real active streams,
          never a fallback to Search) */}
      {showLiveDiscovery && (
        <div className="fixed inset-0 z-[70] bg-black flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
            <span className="text-sm font-extrabold text-white flex items-center gap-1.5">
              <Radio className="w-4 h-4 text-[#ff2b54]" /> Live
            </span>
            <button
              onClick={() => setShowLiveDiscovery(false)}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 text-white"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-3">
            {activeLiveStreams.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-6">
                <Radio className="w-8 h-8 text-white/20 mb-3" />
                <p className="text-neutral-400 text-sm">No one is live right now.</p>
              </div>
            ) : (
              <LiveDiscoveryGrid
                streams={activeLiveStreams}
                currentUser={currentUser}
                onEnterRoom={(stream) => {
                  setShowLiveDiscovery(false);
                  pushHistoryLayer('live');
                  setLiveStreamState({ isOpen: true, mode: 'viewer', streamId: stream.id });
                }}
                onRequireAuth={handleRequireAuth}
              />
            )}
          </div>
        </div>
      )}

      {/* LIVE STREAM ROOM MODAL (WebRTC Real-time Live) */}
      {liveStreamState.isOpen && (
        <LiveStreamRoomModal
          isOpen={liveStreamState.isOpen}
          mode={liveStreamState.mode}
          streamId={liveStreamState.streamId}
          hostProfile={liveStreamState.hostProfile}
          currentUser={currentUser}
          onClose={() => setLiveStreamState(prev => ({ ...prev, isOpen: false }))}
          onToast={showToast}
          onRequireAuth={handleRequireAuth}
        />
      )}

      {/* BANNED ACCOUNT INTERCEPTOR */}
      {currentUser && currentUser.banned && (
        <BannedScreen
          currentUser={currentUser}
          onLogout={handleLogout}
          onToast={showToast}
        />
      )}

      {/* REAL-TIME INCOMING CALL NOTIFICATION BANNER */}
      {incomingCallSession && (!isCallModalOpen || activeCallSession?.id !== incomingCallSession.id) && (
        <IncomingCallBanner
          incomingCall={incomingCallSession}
          onAnswer={handleAcceptIncomingCall}
          onDecline={handleDeclineIncomingCall}
        />
      )}

      {/* ACTIVE 1-ON-1 VOICE & VIDEO CALL MODAL */}
      {isCallModalOpen && activeCallSession && currentUser && (
        <DirectCallModal
          isOpen={isCallModalOpen}
          callSession={activeCallSession}
          currentUser={currentUser}
          onClose={handleEndCall}
          onToast={showToast}
          isMinimized={isCallMinimized}
          onToggleMinimize={() => setIsCallMinimized(prev => !prev)}
        />
      )}

      {/* SCREEN TIME BREAK LOCKOUT OVERLAY */}
      {screenTimeLocked && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center animate-in fade-in select-none">
          <div className="w-16 h-16 rounded-3xl bg-[#fe2c55]/20 border border-[#fe2c55]/30 text-[#fe2c55] flex items-center justify-center mb-4 shadow-xl">
            <Clock className="w-8 h-8 stroke-[2.2]" />
          </div>
          <h2 className="text-xl font-black text-white mb-2">Time for a Break 🌿</h2>
          <p className="text-xs text-neutral-300 max-w-xs mb-6 leading-relaxed">
            You've reached your daily screen time limit ({screenTimeLimitMinutes || 30}m). Take a few moments to rest your eyes and stretch.
          </p>

          {/* Passcode Unlock */}
          <div className="w-full max-w-xs bg-neutral-900 border border-white/10 rounded-2xl p-4 mb-4 shadow-2xl">
            <span className="text-xs font-bold text-neutral-300 block mb-2">Enter Safety PIN to Unlock</span>
            <div className="flex gap-2">
              <input
                type="password"
                maxLength={4}
                value={unlockPinInput}
                onChange={(e) => setUnlockPinInput(e.target.value.replace(/\D/g, ''))}
                placeholder="4-digit PIN"
                className="flex-1 bg-black border border-white/20 rounded-xl px-3 py-2 text-center text-sm font-mono text-white focus:outline-none focus:border-[#25f4ee]"
              />
              <button
                onClick={handleUnlockScreenTime}
                className="px-4 py-2 bg-white text-black text-xs font-bold rounded-xl hover:bg-neutral-200 cursor-pointer"
              >
                Unlock
              </button>
            </div>
          </div>

          <button
            onClick={handleSnoozeScreenTime}
            className="text-xs text-neutral-400 hover:text-white underline cursor-pointer transition-colors"
          >
            Snooze for 15 minutes
          </button>
        </div>
      )}
    </div>
  );
}
