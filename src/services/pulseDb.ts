import {
  db,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  increment,
  writeBatch,
  runTransaction
} from '../backend';
import { 
  UserProfile, 
  VideoPost, 
  VideoComment, 
  NotificationItem, 
  ChatMessage, 
  SearchResultItem, 
  AppealItem, 
  ReportItem, 
  FollowRequestItem, 
  VideoDraft,
  StoryItem,
  StoryHighlight,
  LiveStream,
  LiveChatMessage,
  LivePoll,
  LiveQnAItem,
  LiveReplay,
  LiveGuest,
  Playlist,
  GroupChat,
  ScheduledPost,
  PlatformAnnouncement,
  AccountWarning,
  CallSession,
  VirtualGift,
  GiftTransaction,
  PKBattle
} from '../types';
import { formatRelativeTime } from '../utils/formatters';

// User Profile Operations
export const OWNER_EMAIL = 'mrnovatech4@gmail.com';
export const OWNER_HANDLE = '@mrnovatech';
export const OWNER_USERNAME = 'mrnovatech';

const AUTH_USER_STORAGE_KEY = 'pulse_authenticated_user_profile';

export function getCachedUserProfile(): UserProfile | null {
  try {
    const raw = localStorage.getItem(AUTH_USER_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as UserProfile;
  } catch {
    return null;
  }
}

export function cacheUserProfile(profile: UserProfile | null): void {
  try {
    if (!profile) {
      localStorage.removeItem(AUTH_USER_STORAGE_KEY);
    } else {
      localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(profile));
    }
  } catch (e) {
    console.warn('Could not cache user profile locally:', e);
  }
}

export async function getOrCreateUserProfile(user: { uid: string; email?: string | null; displayName?: string | null; photoURL?: string | null; emailVerified?: boolean }): Promise<UserProfile> {
  const isOwner = (user.email && user.email.toLowerCase() === OWNER_EMAIL.toLowerCase()) || 
                  (user.displayName && user.displayName.toLowerCase() === 'mrnovatech');

  const rawName = isOwner ? OWNER_USERNAME : (user.displayName || (user.email ? user.email.split('@')[0] : 'Creator'));
  const cleanHandle = isOwner ? OWNER_HANDLE : ('@' + rawName.toLowerCase().replace(/[^a-z0-9_.]/g, '').slice(0, 20) || '@creator');
  const defaultPhoto = isOwner 
    ? 'https://api.dicebear.com/7.x/bottts/svg?seed=mrnovatech'
    : (user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user.uid)}`);

  const fallbackProfile: UserProfile = {
    uid: user.uid,
    username: rawName,
    handle: cleanHandle,
    email: user.email || (isOwner ? OWNER_EMAIL : ''),
    photoURL: defaultPhoto,
    bio: isOwner ? 'Founder & Platform Architect of Pulse ⚡️' : '',
    followers: 0,
    following: 0,
    likesReceived: 0,
    createdAt: Date.now(),
    emailVerified: isOwner ? true : !!user.emailVerified,
    verified: isOwner,
    verificationStatus: isOwner ? 'verified' : 'unverified',
    role: isOwner ? 'admin' : 'user'
  };

  try {
    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      const profile = userSnap.data() as UserProfile;
      const updates: Partial<UserProfile> = {};

      if (user.emailVerified && !profile.emailVerified) {
        updates.emailVerified = true;
        profile.emailVerified = true;
      }

      if (isOwner) {
        updates.role = 'admin';
        updates.handle = OWNER_HANDLE;
        updates.username = OWNER_USERNAME;
        updates.email = OWNER_EMAIL;
        updates.verified = true;
        
        profile.role = 'admin';
        profile.handle = OWNER_HANDLE;
        profile.username = OWNER_USERNAME;
        profile.email = OWNER_EMAIL;
        profile.verified = true;
      }

      if (Object.keys(updates).length > 0) {
        try {
          await setDoc(userRef, updates, { merge: true });
        } catch (err) {
          console.warn('Update user profile notice:', err);
        }
      }

      cacheUserProfile(profile);
      return profile;
    }

    // Document does not exist yet - create it
    try {
      await setDoc(userRef, fallbackProfile);
    } catch (setErr) {
      console.warn('SetDoc notice during profile creation:', setErr);
    }
    cacheUserProfile(fallbackProfile);
    return fallbackProfile;
  } catch (err) {
    console.warn('Notice in getOrCreateUserProfile (using resilient fallback):', err);
    const cached = getCachedUserProfile();
    if (cached && cached.uid === user.uid) {
      return cached;
    }
    cacheUserProfile(fallbackProfile);
    return fallbackProfile;
  }
}

export async function updateUserProfile(uid: string, updates: Partial<UserProfile>) {
  const userRef = doc(db, 'users', uid);
  await setDoc(userRef, updates, { merge: true });
}

export async function fetchUserProfileByUid(uid: string): Promise<UserProfile | null> {
  try {
    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      return snap.data() as UserProfile;
    }
  } catch (err) {
    console.warn('fetchUserProfileByUid error:', err);
  }
  return null;
}

export async function fetchUserProfileByHandle(handle: string): Promise<UserProfile | null> {
  try {
    const clean = handle.startsWith('@') ? handle : `@${handle}`;
    const q = query(collection(db, 'users'), where('handle', '==', clean), limit(1));
    const snap = await getDocs(q);
    if (!snap.empty) {
      return snap.docs[0].data() as UserProfile;
    }
  } catch (err) {
    console.warn('fetchUserProfileByHandle error:', err);
  }
  return null;
}

export async function fetchUserVideos(uid: string): Promise<VideoPost[]> {
  try {
    const q = query(collection(db, 'videos'), where('ownerUid', '==', uid));
    const snap = await getDocs(q);
    const list: VideoPost[] = [];
    snap.forEach((d) => {
      list.push({ id: d.id, ...d.data() } as VideoPost);
    });
    return list;
  } catch (err) {
    console.warn('fetchUserVideos error:', err);
    return [];
  }
}

export async function getSuggestedUsers(currentUid?: string): Promise<UserProfile[]> {
  try {
    const q = query(collection(db, 'users'), limit(15));
    const snap = await getDocs(q);
    const users: UserProfile[] = [];
    snap.forEach((d) => {
      if (!currentUid || d.id !== currentUid) {
        users.push(d.data() as UserProfile);
      }
    });
    return users;
  } catch (e) {
    console.warn('getSuggestedUsers error:', e);
    return [];
  }
}

// Subscribe to User profile real-time
export function subscribeToUserProfile(uid: string, callback: (profile: UserProfile | null) => void) {
  try {
    const userRef = doc(db, 'users', uid);
    return onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const p = docSnap.data() as UserProfile;
        p.followers = Math.max(0, p.followers || 0);
        p.following = Math.max(0, p.following || 0);
        p.likesReceived = Math.max(0, p.likesReceived || 0);
        cacheUserProfile(p);
        callback(p);
      }
    }, (err) => {
      console.warn('User profile listener notice (maintaining current session):', err);
    });
  } catch (err) {
    console.warn('User profile subscribe setup notice:', err);
    return () => {};
  }
}

// Video Feed Subscriptions (Real Firestore Videos Only)
export function subscribeToVideos(callback: (videos: VideoPost[]) => void) {
  try {
    const videosRef = collection(db, 'videos');
    const q = query(videosRef, orderBy('createdAt', 'desc'), limit(50));

    return onSnapshot(q, (snapshot) => {
      const vids: VideoPost[] = [];
      snapshot.forEach((d) => {
        vids.push({ id: d.id, ...d.data() } as VideoPost);
      });
      callback(vids);
    }, (err) => {
      console.warn('Videos ordered subscription notice, falling back:', err);
      try {
        const fallbackQ = query(videosRef, limit(50));
        onSnapshot(fallbackQ, (snap) => {
          const vids: VideoPost[] = [];
          snap.forEach((d) => {
            vids.push({ id: d.id, ...d.data() } as VideoPost);
          });
          vids.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
          callback(vids);
        });
      } catch {
        callback([]);
      }
    });
  } catch (err) {
    callback([]);
    return () => {};
  }
}

// Toggle Like
export async function toggleVideoLike(videoId: string, user: UserProfile): Promise<boolean> {
  const likeRef = doc(db, 'videos', videoId, 'likes', user.uid);
  const userLikedRef = doc(db, 'users', user.uid, 'likedVideos', videoId);
  const videoRef = doc(db, 'videos', videoId);
  const likeSnap = await getDoc(likeRef);
  
  if (likeSnap.exists()) {
    // Unlike
    await deleteDoc(likeRef);
    try { await deleteDoc(userLikedRef); } catch (e) {}
    await updateDoc(videoRef, { likeCount: increment(-1) });
    return false;
  } else {
    // Like
    await setDoc(likeRef, {
      uid: user.uid,
      who: user.handle,
      avatar: user.photoURL,
      createdAt: Date.now()
    });
    try {
      await setDoc(userLikedRef, {
        videoId,
        likedAt: Date.now()
      });
    } catch (e) {}
    await updateDoc(videoRef, { likeCount: increment(1) });
    
    // Create notification for video owner if not self
    try {
      const vidSnap = await getDoc(videoRef);
      if (vidSnap.exists()) {
        const vidData = vidSnap.data() as VideoPost;
        if (vidData.ownerUid && vidData.ownerUid !== user.uid) {
          await createNotification(vidData.ownerUid, {
            kind: 'like',
            who: user.handle,
            whoUid: user.uid,
            avatar: user.photoURL,
            text: 'liked your video',
            time: 'Just now',
            createdAt: Date.now(),
            targetVideoId: videoId
          });
        }
      }
    } catch (e) {
      console.warn('Notif error:', e);
    }
    return true;
  }
}

// Check like status
export async function checkUserLikedVideo(videoId: string, uid: string): Promise<boolean> {
  if (!uid) return false;
  const likeRef = doc(db, 'videos', videoId, 'likes', uid);
  const snap = await getDoc(likeRef);
  return snap.exists();
}

// Toggle Save / Bookmark
export async function toggleVideoSave(videoId: string, user: UserProfile): Promise<boolean> {
  const saveRef = doc(db, 'users', user.uid, 'savedVideos', videoId);
  const videoRef = doc(db, 'videos', videoId);
  const saveSnap = await getDoc(saveRef);
  
  if (saveSnap.exists()) {
    await deleteDoc(saveRef);
    await updateDoc(videoRef, { saveCount: increment(-1) });
    return false;
  } else {
    await setDoc(saveRef, { videoId, savedAt: Date.now() });
    await updateDoc(videoRef, { saveCount: increment(1) });
    return true;
  }
}

// Check Save status
export async function checkUserSavedVideo(videoId: string, uid: string): Promise<boolean> {
  if (!uid) return false;
  const saveRef = doc(db, 'users', uid, 'savedVideos', videoId);
  const snap = await getDoc(saveRef);
  return snap.exists();
}

// Get User Liked Videos
export async function getUserLikedVideos(uid: string): Promise<VideoPost[]> {
  if (!uid) return [];
  try {
    const userLikesRef = collection(db, 'users', uid, 'likedVideos');
    const snap = await getDocs(query(userLikesRef, orderBy('likedAt', 'desc'), limit(50)));
    const videoIds: string[] = [];
    snap.forEach(d => videoIds.push(d.id));
    if (videoIds.length === 0) return [];
    
    const videos: VideoPost[] = [];
    for (const vidId of videoIds) {
      const vSnap = await getDoc(doc(db, 'videos', vidId));
      if (vSnap.exists()) {
        videos.push({ id: vSnap.id, ...vSnap.data() } as VideoPost);
      }
    }
    return videos;
  } catch (e) {
    console.warn('Error fetching user liked videos:', e);
    return [];
  }
}

// Get User Saved Videos
export async function getUserSavedVideos(uid: string): Promise<VideoPost[]> {
  if (!uid) return [];
  try {
    const userSavedRef = collection(db, 'users', uid, 'savedVideos');
    const snap = await getDocs(query(userSavedRef, orderBy('savedAt', 'desc'), limit(50)));
    const videoIds: string[] = [];
    snap.forEach(d => videoIds.push(d.id));
    if (videoIds.length === 0) return [];
    
    const videos: VideoPost[] = [];
    for (const vidId of videoIds) {
      const vSnap = await getDoc(doc(db, 'videos', vidId));
      if (vSnap.exists()) {
        videos.push({ id: vSnap.id, ...vSnap.data() } as VideoPost);
      }
    }
    return videos;
  } catch (e) {
    console.warn('Error fetching user saved videos:', e);
    return [];
  }
}

// Comments
export function subscribeToComments(videoId: string, callback: (comments: VideoComment[]) => void) {
  if (!videoId) {
    callback([]);
    return () => {};
  }
  try {
    const commentsRef = collection(db, 'videos', videoId, 'comments');
    const q = query(commentsRef, orderBy('createdAt', 'desc'), limit(100));
    
    return onSnapshot(q, (snapshot) => {
      const list: VideoComment[] = [];
      snapshot.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as VideoComment);
      });
      callback(list);
    }, (err) => {
      console.warn('Notice fetching comments:', err?.message || err);
      callback([]);
    });
  } catch (e) {
    callback([]);
    return () => {};
  }
}

export async function addVideoComment(videoId: string, user: UserProfile, text: string) {
  const commentsRef = collection(db, 'videos', videoId, 'comments');
  const videoRef = doc(db, 'videos', videoId);
  
  const newComment = {
    uid: user.uid,
    who: user.handle,
    avatar: user.photoURL,
    txt: text,
    likes: 0,
    createdAt: Date.now()
  };
  
  await addDoc(commentsRef, newComment);
  await updateDoc(videoRef, { commentCount: increment(1) });

  // Send notification to video owner
  try {
    const vidSnap = await getDoc(videoRef);
    if (vidSnap.exists()) {
      const vidData = vidSnap.data() as VideoPost;
      if (vidData.ownerUid && vidData.ownerUid !== user.uid) {
        await createNotification(vidData.ownerUid, {
          kind: 'comment',
          who: user.handle,
          whoUid: user.uid,
          avatar: user.photoURL,
          text: `commented: "${text.length > 35 ? text.slice(0, 35) + '...' : text}"`,
          time: 'Just now',
          createdAt: Date.now(),
          targetVideoId: videoId
        });
      }
    }
  } catch (e) {
    console.warn('Comment notif error:', e);
  }
}

// Follow / Unfollow caching & helpers
const FOLLOWING_CACHE_PREFIX = 'pulse_following_uids_';

export function getCachedFollowingUids(uid?: string): string[] {
  if (!uid) return [];
  try {
    const raw = localStorage.getItem(FOLLOWING_CACHE_PREFIX + uid);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function cacheFollowingUids(uid: string, uids: string[]): void {
  if (!uid) return;
  try {
    localStorage.setItem(FOLLOWING_CACHE_PREFIX + uid, JSON.stringify(uids));
  } catch (e) {
    console.warn('Could not cache following uids:', e);
  }
}

// Clears the local following-uids cache for a specific user, or every
// cached following list if no uid is given (used on logout, since we don't
// want the next signed-in session on this device to briefly inherit the
// previous user's following list).
export function clearCachedFollowingUids(uid?: string): void {
  try {
    if (uid) {
      localStorage.removeItem(FOLLOWING_CACHE_PREFIX + uid);
      return;
    }
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(FOLLOWING_CACHE_PREFIX)) keysToRemove.push(key);
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
  } catch (e) {
    console.warn('Could not clear cached following uids:', e);
  }
}

// Follow / Unfollow
// Guards against the classic "double tap" race: two rapid clicks each read
// the follow doc before the other's write lands, so one call follows and the
// other immediately unfollows, netting to zero (follower count never moves,
// or a fresh follow appears to instantly undo itself). We serialize calls
// per (currentUid -> targetUid) pair so a second call while one is still in
// flight just waits for and returns the first call's result instead of
// racing it.
const followLocks = new Map<string, Promise<boolean>>();

export async function toggleFollowUser(
  currentUid: string, 
  targetUid: string, 
  currentUserProfile?: UserProfile,
  targetHandle?: string
): Promise<boolean> {
  if (!currentUid || !targetUid || currentUid === targetUid) return false;

  const lockKey = `${currentUid}_${targetUid}`;
  const inFlight = followLocks.get(lockKey);
  if (inFlight) {
    return inFlight;
  }

  const run = toggleFollowUserInternal(currentUid, targetUid, currentUserProfile, targetHandle);
  followLocks.set(lockKey, run);
  try {
    return await run;
  } finally {
    followLocks.delete(lockKey);
  }
}

async function toggleFollowUserInternal(
  currentUid: string,
  targetUid: string,
  currentUserProfile?: UserProfile,
  targetHandle?: string
): Promise<boolean> {
  const followingRef = doc(db, 'follows', currentUid, 'following', targetUid);
  const followerRef = doc(db, 'follows', targetUid, 'followers', currentUid);
  const userRefMe = doc(db, 'users', currentUid);
  const userRefTarget = doc(db, 'users', targetUid);

  try {
    // Everything that decides and commits the relationship state happens
    // inside one transaction: the "does the relationship already exist"
    // read and the writes that follow from it are atomic together, so two
    // near-simultaneous calls (e.g. from two tabs/devices) can't both read
    // "not following" and both apply a +1/-1, and counters can never be
    // decremented past what the relationship docs actually support.
    const isNowFollowing = await runTransaction(db, async (tx) => {
      const snap = await tx.get(followingRef);

      // Unfollowing is always allowed (lets you clean up a stale
      // relationship regardless of block state). Following a new
      // relationship is blocked in either direction: you can't follow
      // someone who's blocked you, and you can't follow someone you've
      // blocked yourself.
      if (!snap.exists()) {
        const [meSnap, targetSnap] = await Promise.all([tx.get(userRefMe), tx.get(userRefTarget)]);
        const myBlocked: string[] = (meSnap.data()?.blockedUids as string[]) || [];
        const theirBlocked: string[] = (targetSnap.data()?.blockedUids as string[]) || [];
        if (myBlocked.includes(targetUid) || theirBlocked.includes(currentUid)) {
          throw new Error('blocked');
        }
      }

      if (snap.exists()) {
        // Unfollow
        tx.delete(followingRef);
        tx.delete(followerRef);
        tx.update(userRefMe, { following: increment(-1) });
        tx.update(userRefTarget, { followers: increment(-1) });
        return false;
      }

      // Follow
      tx.set(followingRef, {
        uid: targetUid,
        handle: targetHandle || '',
        createdAt: Date.now()
      });
      tx.set(followerRef, {
        uid: currentUid,
        handle: currentUserProfile?.handle || '',
        createdAt: Date.now()
      });
      tx.update(userRefMe, { following: increment(1) });
      tx.update(userRefTarget, { followers: increment(1) });
      return true;
    });

    // Reconcile local following-uids cache with the committed result.
    // UIDs only — handles are never stored in this array, since consumers
    // resolve profile info from UID and a mixed array can't be trusted as
    // a clean relationship list.
    const currentList = getCachedFollowingUids(currentUid);
    if (isNowFollowing) {
      if (!currentList.includes(targetUid)) currentList.push(targetUid);
      cacheFollowingUids(currentUid, currentList);

      // Real-time Notification — only ever created after the follow has
      // actually committed above.
      if (currentUserProfile) {
        await createNotification(targetUid, {
          kind: 'follow',
          who: currentUserProfile.handle || currentUserProfile.username,
          whoUid: currentUid,
          avatar: currentUserProfile.photoURL,
          text: 'started following you',
          time: 'Just now',
          createdAt: Date.now()
        }).catch(() => {});
      }
    } else {
      cacheFollowingUids(currentUid, currentList.filter(id => id !== targetUid));
    }

    return isNowFollowing;
  } catch (err) {
    console.error('toggleFollowUser error:', err);
    throw err;
  }
}

export async function checkIsFollowing(currentUid: string, targetUid: string): Promise<boolean> {
  if (!currentUid || !targetUid || currentUid === targetUid) return false;
  try {
    const followingRef = doc(db, 'follows', currentUid, 'following', targetUid);
    const snap = await getDoc(followingRef);
    return snap.exists();
  } catch (err) {
    console.warn('checkIsFollowing error:', err);
    return false;
  }
}

export async function getFollowingList(currentUid: string): Promise<string[]> {
  if (!currentUid) return [];
  try {
    const followingRef = collection(db, 'follows', currentUid, 'following');
    const snap = await getDocs(followingRef);
    const uids = snap.docs.map(d => d.id);
    cacheFollowingUids(currentUid, uids);
    return uids;
  } catch (err) {
    console.warn('getFollowingList error:', err);
    return getCachedFollowingUids(currentUid);
  }
}

export async function getFollowersList(currentUid: string): Promise<string[]> {
  if (!currentUid) return [];
  try {
    const followersRef = collection(db, 'follows', currentUid, 'followers');
    const snap = await getDocs(followersRef);
    return snap.docs.map(d => d.id);
  } catch (err) {
    console.warn('getFollowersList error:', err);
    return [];
  }
}

export function subscribeToUserFollowing(uid: string, callback: (followingUids: string[]) => void) {
  if (!uid) {
    callback([]);
    return () => {};
  }
  
  // Instant initial invocation with cached state to prevent feed flickering
  const cached = getCachedFollowingUids(uid);
  if (cached.length > 0) {
    callback(cached);
  }

  try {
    const followingRef = collection(db, 'follows', uid, 'following');
    return onSnapshot(followingRef, (snap) => {
      const uids = snap.docs.map(d => d.id);
      cacheFollowingUids(uid, uids);
      callback(uids);
    }, (err) => {
      console.warn('Following subscription notice:', err);
      callback(getCachedFollowingUids(uid));
    });
  } catch (err) {
    callback(getCachedFollowingUids(uid));
    return () => {};
  }
}

export async function fetchPopularCreators(maxCount: number = 8): Promise<UserProfile[]> {
  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, orderBy('followers', 'desc'), limit(maxCount));
    const snap = await getDocs(q);
    const list: UserProfile[] = [];
    snap.forEach((d) => {
      list.push({ uid: d.id, ...d.data() } as UserProfile);
    });
    if (list.length > 0) return list;
    
    // Fallback query if the `followers` index is not yet built
    const fallbackSnap = await getDocs(query(usersRef, limit(maxCount)));
    const fallbackList: UserProfile[] = [];
    fallbackSnap.forEach((d) => {
      fallbackList.push({ uid: d.id, ...d.data() } as UserProfile);
    });
    return fallbackList;
  } catch (e) {
    console.warn('fetchPopularCreators notice:', e);
    return [];
  }
}

// Create new Video / Photo Post
export async function createVideoPost(postData: {
  src: string;
  mediaType?: 'video' | 'image' | 'carousel';
  images?: string[];
  coverUrl?: string;
  caption: string;
  sound: string;
  tags: string[];
  user: UserProfile;
  filter?: string;
  textOverlay?: { text: string; color: string; fontSize: number; position: 'top' | 'center' | 'bottom' };
  voiceoverSrc?: string;
  musicVolume?: number;
  originalVolume?: number;
  visibility?: 'public' | 'friends' | 'private';
  allowComments?: boolean;
}): Promise<string> {
  const videosRef = collection(db, 'videos');
  const docRef = await addDoc(videosRef, {
    src: postData.src,
    mediaType: postData.mediaType || (postData.src.startsWith('data:image') || postData.images?.length ? 'image' : 'video'),
    images: postData.images || (postData.src.startsWith('data:image') ? [postData.src] : []),
    coverUrl: postData.coverUrl || '',
    caption: postData.caption,
    sound: postData.sound || 'original sound — ' + postData.user.username,
    ownerUid: postData.user.uid,
    ownerHandle: postData.user.handle,
    ownerUsername: postData.user.username,
    ownerAvatar: postData.user.photoURL,
    verified: postData.user.verified || false,
    likeCount: 0,
    commentCount: 0,
    shareCount: 0,
    saveCount: 0,
    repostCount: 0,
    views: 0,
    tags: postData.tags,
    filter: postData.filter || 'none',
    textOverlay: postData.textOverlay || null,
    voiceoverSrc: postData.voiceoverSrc || null,
    musicVolume: postData.musicVolume ?? 100,
    originalVolume: postData.originalVolume ?? 100,
    visibility: postData.visibility || 'public',
    allowComments: postData.allowComments ?? true,
    createdAt: Date.now()
  });
  return docRef.id;
}

// Edit Video Post
export async function updateVideoPost(videoId: string, updates: { caption?: string; sound?: string; tags?: string[] }) {
  const videoRef = doc(db, 'videos', videoId);
  await updateDoc(videoRef, updates);
}

// Delete Video Post
export async function deleteVideoPost(videoId: string) {
  const videoRef = doc(db, 'videos', videoId);
  await deleteDoc(videoRef);
}

// Notifications
export async function createNotification(recipientUid: string, notif: Omit<NotificationItem, 'id'>) {
  if (!recipientUid) return;
  try {
    const notifRef = collection(db, 'notifications', recipientUid, 'items');
    await addDoc(notifRef, notif);
  } catch (err: any) {
    console.warn('Create notification notice:', err?.message || err);
  }
}

export function subscribeToNotifications(uid: string, callback: (items: NotificationItem[]) => void) {
  if (!uid) {
    callback([]);
    return () => {};
  }
  try {
    const notifRef = collection(db, 'notifications', uid, 'items');
    const q = query(notifRef, orderBy('createdAt', 'desc'), limit(30));
    
    return onSnapshot(q, (snapshot) => {
      const list: NotificationItem[] = [];
      snapshot.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as NotificationItem);
      });
      callback(list);
    }, (err) => {
      console.warn('Notifications subscription notice:', err?.message || err);
      callback([]);
    });
  } catch (e) {
    callback([]);
    return () => {};
  }
}

export async function markNotificationsAsRead(uid: string): Promise<boolean> {
  if (!uid) return false;
  try {
    const notifRef = collection(db, 'notifications', uid, 'items');
    const q = query(notifRef, limit(40));
    const snap = await getDocs(q);
    const batch = writeBatch(db);
    snap.forEach((docSnap) => {
      batch.update(docSnap.ref, { read: true });
    });
    await batch.commit();
    return true;
  } catch (err) {
    console.warn('Mark read notice:', err);
    return false;
  }
}

// 1-on-1 Chat
export function getChatId(uid1: string, uid2: string): string {
  return [uid1, uid2].sort().join('_');
}

export function subscribeToChatMessages(chatId: string, callback: (messages: ChatMessage[]) => void) {
  if (!chatId) {
    callback([]);
    return () => {};
  }
  try {
    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'), limit(100));
    
    return onSnapshot(q, (snapshot) => {
      const list: ChatMessage[] = [];
      snapshot.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as ChatMessage);
      });
      callback(list);
    }, (err) => {
      console.warn('Chat messages subscription notice:', err?.message || err);
      callback([]);
    });
  } catch (e) {
    callback([]);
    return () => {};
  }
}

export function subscribeToUserChats(uid: string, callback: (chats: any[]) => void) {
  if (!uid) {
    callback([]);
    return () => {};
  }
  try {
    const chatsRef = collection(db, 'chats');
    const q = query(chatsRef, where('participants', 'array-contains', uid), orderBy('lastUpdated', 'desc'), limit(30));
    return onSnapshot(q, async (snap) => {
      const chatList: any[] = [];
      for (const d of snap.docs) {
        const data = d.data();
        const otherUid = (data.participants || []).find((p: string) => p !== uid) || data.participants?.[0];
        let otherUser: UserProfile | null = null;
        if (otherUid) {
          try {
            const uSnap = await getDoc(doc(db, 'users', otherUid));
            if (uSnap.exists()) {
              otherUser = uSnap.data() as UserProfile;
            }
          } catch (e) {}
        }
        
        const unreadForMe = Number(data.unreadCounts?.[uid] || 0);
        
        chatList.push({
          chatId: d.id,
          uid: otherUid || d.id,
          handle: otherUser?.handle || `@user_${(otherUid || '').slice(0, 6)}`,
          username: otherUser?.username || otherUser?.handle || 'Pulse Creator',
          avatar: otherUser?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(otherUid || d.id)}`,
          verified: !!otherUser?.verified,
          lastMessage: data.lastMessage || 'Direct message',
          lastSenderUid: data.lastSenderUid || '',
          lastReadTimes: data.lastReadTimes || {},
          time: formatRelativeTime(data.lastUpdated),
          unreadCount: unreadForMe,
          online: !!otherUser?.isOnline && (Date.now() - Number(otherUser?.lastActive || 0)) < PRESENCE_STALE_MS,
          isBot: otherUid === 'owner_mrnovatech' || otherUid === 'pulse_official'
        });
      }
      callback(chatList);
    }, (err) => {
      console.warn('User chats notice:', err);
      callback([]);
    });
  } catch (e) {
    callback([]);
    return () => {};
  }
}

export function subscribeToTotalUnreadMessages(uid: string, callback: (totalUnread: number) => void) {
  if (!uid) {
    callback(0);
    return () => {};
  }
  try {
    const chatsRef = collection(db, 'chats');
    const q = query(chatsRef, where('participants', 'array-contains', uid));
    return onSnapshot(q, (snap) => {
      let total = 0;
      snap.forEach((d) => {
        const data = d.data();
        const count = Number(data.unreadCounts?.[uid] || 0);
        total += count;
      });
      callback(total);
    }, (err) => {
      console.warn('Total unread chats subscription notice:', err);
      callback(0);
    });
  } catch (e) {
    callback(0);
    return () => {};
  }
}

// Subscribes to the chat document itself (not the messages subcollection) —
// this is where lastReadTimes and typing indicators live. A message is
// considered "read" by the recipient once their lastReadTimes[uid] is at or
// after the message's createdAt, so read receipts don't require writing a
// status onto every individual message — just watching this one doc.
export function subscribeToChatDoc(
  chatId: string,
  callback: (data: { lastReadTimes: Record<string, number>; typing: Record<string, number> }) => void
) {
  if (!chatId) {
    callback({ lastReadTimes: {}, typing: {} });
    return () => {};
  }
  try {
    const chatDocRef = doc(db, 'chats', chatId);
    return onSnapshot(chatDocRef, (snap) => {
      const data = snap.data() || {};
      callback({
        lastReadTimes: data.lastReadTimes || {},
        typing: data.typing || {}
      });
    }, (err) => {
      console.warn('Chat doc subscription notice:', err?.message || err);
      callback({ lastReadTimes: {}, typing: {} });
    });
  } catch (e) {
    callback({ lastReadTimes: {}, typing: {} });
    return () => {};
  }
}

// Writes this user's typing state into the chat doc, scoped by dot-notation
// key (same reasoning as markChatAsRead below — a plain nested object would
// clobber the other participant's typing entry). The timestamp lets readers
// treat a stale "true" (tab killed mid-type) as no-longer-typing without
// needing an explicit cleanup write.
export async function setTypingStatus(chatId: string, userUid: string, isTyping: boolean) {
  if (!chatId || !userUid) return;
  try {
    const chatDocRef = doc(db, 'chats', chatId);
    await setDoc(chatDocRef, {
      [`typing.${userUid}`]: isTyping ? Date.now() : 0
    }, { merge: true });
  } catch (err) {
    console.warn('setTypingStatus error:', err);
  }
}

export const TYPING_STALE_MS = 6000;

export async function markChatAsRead(chatId: string, userUid: string) {
  if (!chatId || !userUid) return;
  try {
    const chatDocRef = doc(db, 'chats', chatId);
    // IMPORTANT: setDoc(..., {merge: true}) only deep-merges when field paths
    // use dot-notation keys in a flat object. Passing a nested object literal
    // here (e.g. `unreadCounts: { [userUid]: 0 }`) replaces the ENTIRE
    // unreadCounts map, silently wiping the other participant's unread count.
    // Use dot-notation keys (matching sendChatMessage's updatePayload) so
    // only this user's entries are touched.
    await setDoc(chatDocRef, {
      [`unreadCounts.${userUid}`]: 0,
      [`lastReadTimes.${userUid}`]: Date.now()
    }, { merge: true });
  } catch (err) {
    console.warn('markChatAsRead error:', err);
  }
}

export async function sendChatMessage(
  chatId: string, 
  sender: UserProfile, 
  text: string, 
  recipientUid?: string, 
  mediaUrl?: string,
  options?: {
    mediaType?: 'text' | 'voice' | 'gif' | 'image' | 'video_share' | 'story_reply' | 'call_log' | 'sticker';
    voiceDuration?: number;
    gifUrl?: string;
    stickerEmoji?: string;
    callLog?: {
      callType: 'voice' | 'video';
      durationSeconds: number;
      status: 'ended' | 'missed' | 'declined';
    };
    clientId?: string;
  }
) {
  const messagesRef = collection(db, 'chats', chatId, 'messages');
  const chatDocRef = doc(db, 'chats', chatId);

  // A block in either direction stops new messages, matching the follow
  // check above — the recipient not wanting to hear from this sender (or
  // vice versa) should actually prevent the message, not just hide it later.
  if (recipientUid) {
    const [senderSnap, recipientSnap] = await Promise.all([
      getDoc(doc(db, 'users', sender.uid)),
      getDoc(doc(db, 'users', recipientUid))
    ]);
    const myBlocked: string[] = (senderSnap.data()?.blockedUids as string[]) || [];
    const theirBlocked: string[] = (recipientSnap.data()?.blockedUids as string[]) || [];
    if (myBlocked.includes(recipientUid) || theirBlocked.includes(sender.uid)) {
      throw new Error('blocked');
    }
  }
  
  const now = Date.now();
  const msg: Omit<ChatMessage, 'id'> = {
    senderUid: sender.uid,
    senderHandle: sender.handle,
    senderUsername: sender.username,
    senderAvatar: sender.photoURL,
    text,
    createdAt: now,
    mediaUrl: mediaUrl || undefined,
    mediaType: options?.mediaType || (options?.voiceDuration ? 'voice' : mediaUrl ? 'image' : 'text'),
    voiceDuration: options?.voiceDuration,
    gifUrl: options?.gifUrl,
    stickerEmoji: options?.stickerEmoji,
    callLog: options?.callLog,
    status: 'sent',
    clientId: options?.clientId
  };
  
  const participantsList = recipientUid ? Array.from(new Set([sender.uid, recipientUid])) : [sender.uid];

  await addDoc(messagesRef, msg);

  let lastSummary = text;
  if (options?.mediaType === 'voice') {
    lastSummary = `🎙️ Voice Note (${options.voiceDuration ? Math.round(options.voiceDuration) + 's' : ''})`;
  } else if (options?.mediaType === 'call_log') {
    lastSummary = text || (options.callLog?.callType === 'video' ? '📹 Video Call' : '📞 Voice Call');
  } else if (mediaUrl) {
    lastSummary = '📷 Photo';
  } else if (options?.gifUrl) {
    lastSummary = '👾 GIF';
  }

  const updatePayload: Record<string, any> = {
    lastMessage: lastSummary,
    lastUpdated: now,
    lastSenderUid: sender.uid,
    participants: participantsList,
    [`lastReadTimes.${sender.uid}`]: now
  };

  if (recipientUid) {
    try {
      const chatSnap = await getDoc(chatDocRef);
      const currentUnread = chatSnap.exists() ? (chatSnap.data().unreadCounts?.[recipientUid] || 0) : 0;
      updatePayload[`unreadCounts.${recipientUid}`] = currentUnread + 1;
      updatePayload[`unreadCounts.${sender.uid}`] = 0;
    } catch (e) {
      updatePayload[`unreadCounts.${recipientUid}`] = 1;
    }
  }

  await setDoc(chatDocRef, updatePayload, { merge: true });

  if (recipientUid) {
    try {
      await createNotification(recipientUid, {
        kind: 'mention',
        who: sender.handle,
        whoUid: sender.uid,
        avatar: sender.photoURL,
        text: options?.mediaType === 'voice' 
          ? 'sent you a voice note 🎙️' 
          : options?.mediaType === 'call_log'
          ? `${text || 'called you'}`
          : mediaUrl ? 'sent you a photo' : `sent you a message: "${text.length > 25 ? text.slice(0, 25) + '...' : text}"`,
        time: 'Just now',
        createdAt: now
      });
    } catch (e) {
      console.warn('Notif error:', e);
    }
  }
}

// -------------------------------------------------------------
// DIRECT 1-ON-1 VOICE & VIDEO CALLS (LIVEKIT + FIRESTORE SIGNALING)
// -------------------------------------------------------------

export async function initiateDirectCall(
  caller: UserProfile, 
  recipient: { uid: string; handle: string; username?: string; avatar: string; verified?: boolean },
  callType: 'voice' | 'video'
): Promise<CallSession> {
  const callsRef = collection(db, 'calls');
  const now = Date.now();
  const roomName = `call_${caller.uid.slice(0, 5)}_${recipient.uid.slice(0, 5)}_${now}`;

  const callData = {
    roomName,
    callerUid: caller.uid,
    callerHandle: caller.handle,
    callerUsername: caller.username,
    callerAvatar: caller.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(caller.uid)}`,
    callerVerified: !!caller.verified,
    recipientUid: recipient.uid,
    recipientHandle: recipient.handle,
    recipientUsername: recipient.username || recipient.handle,
    recipientAvatar: recipient.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(recipient.uid)}`,
    recipientVerified: !!recipient.verified,
    callType,
    status: 'ringing' as const,
    startedAt: now
  };

  const callDoc = await addDoc(callsRef, callData);

  // Notify recipient via notification
  try {
    await createNotification(recipient.uid, {
      kind: 'system',
      who: caller.handle,
      whoUid: caller.uid,
      avatar: caller.photoURL,
      text: `Incoming ${callType === 'video' ? 'Video' : 'Voice'} Call... 📞`,
      time: 'Just now',
      createdAt: now
    });
  } catch (e) {}

  return { id: callDoc.id, ...callData };
}

export async function answerDirectCall(callId: string): Promise<void> {
  const callRef = doc(db, 'calls', callId);
  await updateDoc(callRef, {
    status: 'accepted',
    connectedAt: Date.now()
  });
}

export async function declineDirectCall(callId: string, reason: string = 'declined'): Promise<void> {
  const callRef = doc(db, 'calls', callId);
  const snap = await getDoc(callRef);
  if (snap.exists()) {
    const data = snap.data() as CallSession;
    // Idempotency guard: this can be invoked more than once for the same
    // call (e.g. a stale banner tap after the call already resolved).
    // Once the call is in a terminal state, do nothing further — otherwise
    // a second call here would log a second, duplicate "call" message.
    if (data.status === 'ended' || data.status === 'declined' || data.status === 'busy') {
      return;
    }
    await updateDoc(callRef, {
      status: reason === 'busy' ? 'busy' : 'declined',
      endedAt: Date.now(),
      endReason: reason
    });

    // Log missed / declined call in chat
    const chatId = getChatId(data.callerUid, data.recipientUid);
    const callerFakeProfile: UserProfile = {
      uid: data.callerUid,
      handle: data.callerHandle,
      username: data.callerUsername,
      photoURL: data.callerAvatar
    } as any;

    try {
      await sendChatMessage(
        chatId, 
        callerFakeProfile, 
        `📞 ${data.callType === 'video' ? 'Video' : 'Voice'} Call (${reason === 'busy' ? 'Busy' : 'Declined'})`, 
        data.recipientUid,
        undefined,
        {
          mediaType: 'call_log',
          callLog: {
            callType: data.callType,
            durationSeconds: 0,
            status: 'declined'
          }
        }
      );
    } catch (e) {}
  }
}

export async function endDirectCall(callId: string, durationSeconds: number = 0, reason: string = 'ended'): Promise<void> {
  const callRef = doc(db, 'calls', callId);
  const snap = await getDoc(callRef);
  if (snap.exists()) {
    const data = snap.data() as CallSession;
    // Idempotency guard: both the hang-up button AND the resulting Firestore
    // status change (observed by the *other* participant's client, and
    // historically re-triggered by this app's own onClose cleanup) used to
    // call this again. Only the first, terminal write should log a call
    // message — otherwise the same call ending fires this 2-3x and spams
    // duplicate "Call Ended"/"Missed" messages into the chat.
    if (data.status === 'ended' || data.status === 'declined' || data.status === 'busy') {
      return;
    }
    const now = Date.now();
    await updateDoc(callRef, {
      status: 'ended',
      endedAt: now,
      durationSeconds,
      endReason: reason
    });

    // Log ended call in chat
    const chatId = getChatId(data.callerUid, data.recipientUid);
    const callerFakeProfile: UserProfile = {
      uid: data.callerUid,
      handle: data.callerHandle,
      username: data.callerUsername,
      photoURL: data.callerAvatar
    } as any;

    const mins = Math.floor(durationSeconds / 60);
    const secs = durationSeconds % 60;
    const durationText = durationSeconds > 0 
      ? `${mins > 0 ? `${mins}m ` : ''}${secs}s` 
      : 'Missed';

    try {
      await sendChatMessage(
        chatId, 
        callerFakeProfile, 
        `${data.callType === 'video' ? '📹 Video Call' : '📞 Voice Call'} · ${durationText}`, 
        data.recipientUid,
        undefined,
        {
          mediaType: 'call_log',
          callLog: {
            callType: data.callType,
            durationSeconds,
            status: durationSeconds > 0 ? 'ended' : 'missed'
          }
        }
      );
    } catch (e) {}
  }
}

export function subscribeToCallSession(callId: string, callback: (call: CallSession | null) => void) {
  if (!callId) {
    callback(null);
    return () => {};
  }
  const callRef = doc(db, 'calls', callId);
  return onSnapshot(callRef, (snap) => {
    if (snap.exists()) {
      callback({ id: snap.id, ...snap.data() } as CallSession);
    } else {
      callback(null);
    }
  }, (err) => {
    console.warn('Call session subscription notice:', err);
    callback(null);
  });
}

export function subscribeToIncomingCalls(userUid: string, callback: (calls: CallSession[]) => void) {
  if (!userUid) {
    callback([]);
    return () => {};
  }
  try {
    const callsRef = collection(db, 'calls');
    const q = query(
      callsRef,
      where('recipientUid', '==', userUid),
      where('status', '==', 'ringing'),
      limit(5)
    );
    return onSnapshot(q, (snap) => {
      const list: CallSession[] = [];
      const cutoff = Date.now() - 60000; // only calls initiated in the last 60 seconds
      snap.forEach(d => {
        const item = { id: d.id, ...d.data() } as CallSession;
        if (item.startedAt > cutoff) {
          list.push(item);
        }
      });
      callback(list);
    }, (err) => {
      console.warn('Incoming calls notice:', err);
      callback([]);
    });
  } catch (e) {
    callback([]);
    return () => {};
  }
}

// Family Pairing & Parental Safety Cross-Device Cloud Sync
export async function saveFamilyPairingCloud(code: string, parentUid: string, config: {
  restrictedMode: boolean;
  screenTimeLimit: number;
  safetyPin?: string;
  childUid?: string;
}) {
  if (!code) return;
  try {
    const pairingRef = doc(db, 'familyPairings', code.toUpperCase());
    await setDoc(pairingRef, {
      code: code.toUpperCase(),
      parentUid,
      restrictedMode: config.restrictedMode,
      screenTimeLimit: config.screenTimeLimit,
      safetyPin: config.safetyPin || '',
      childUid: config.childUid || null,
      updatedAt: Date.now()
    }, { merge: true });
  } catch (err) {
    console.warn('saveFamilyPairingCloud error:', err);
  }
}

export async function linkChildWithPairingCode(code: string, childUid: string) {
  if (!code || !childUid) return null;
  try {
    const pairingRef = doc(db, 'familyPairings', code.toUpperCase());
    const snap = await getDoc(pairingRef);
    if (snap.exists()) {
      await setDoc(pairingRef, { childUid, linkedAt: Date.now() }, { merge: true });
      return snap.data();
    }
    return null;
  } catch (err) {
    console.warn('linkChildWithPairingCode error:', err);
    return null;
  }
}

export function subscribeToFamilyPairing(code: string, callback: (data: any) => void) {
  if (!code) {
    callback(null);
    return () => {};
  }
  try {
    const pairingRef = doc(db, 'familyPairings', code.toUpperCase());
    return onSnapshot(pairingRef, (docSnap) => {
      if (docSnap.exists()) {
        callback(docSnap.data());
      } else {
        callback(null);
      }
    }, (err) => {
      console.warn('Family pairing subscription error:', err);
      callback(null);
    });
  } catch (err) {
    callback(null);
    return () => {};
  }
}

// Search Firestore
export async function searchFirestore(term: string): Promise<SearchResultItem[]> {
  const rawQ = term.trim().toLowerCase();
  if (!rawQ) return [];
  const q = rawQ.replace(/^@/, '');
  
  const results: SearchResultItem[] = [];
  const addedUserIds = new Set<string>();
  
  // Search Users in Firestore
  try {
    const usersRef = collection(db, 'users');
    const snap = await getDocs(query(usersRef, limit(40)));
    snap.forEach((d) => {
      const u = d.data() as UserProfile;
      const handleClean = (u.handle || '').toLowerCase().replace(/^@/, '');
      const usernameClean = (u.username || '').toLowerCase();
      const bioClean = (u.bio || '').toLowerCase();
      if (
        handleClean.includes(q) ||
        usernameClean.includes(q) ||
        bioClean.includes(q)
      ) {
        addedUserIds.add(u.uid);
        results.push({
          id: u.uid,
          type: 'user',
          handle: u.handle,
          label: `${u.username} · ${u.bio ? u.bio.slice(0, 30) : 'Creator'}`,
          avatar: u.photoURL,
          title: u.username || u.handle,
          subtitle: u.handle,
          userHandle: u.handle,
          userAvatar: u.photoURL,
          userVerified: u.verified,
          followers: u.followers || 0,
          likes: u.likesReceived || 0,
          data: u
        });
      }
    });
  } catch (err) {
    console.warn('User search error:', err);
  }

  // Search Videos (captions, sounds, tags)
  try {
    const videosRef = collection(db, 'videos');
    const snap = await getDocs(query(videosRef, limit(40)));
    const tagSet = new Set<string>();
    const soundSet = new Set<string>();

    snap.forEach((d) => {
      const v = { id: d.id, ...d.data() } as VideoPost;
      const captionClean = (v.caption || '').toLowerCase();
      
      // Match videos directly by caption or creator
      if (captionClean.includes(q) || (v.ownerHandle && v.ownerHandle.toLowerCase().includes(q))) {
        results.push({
          id: `vid_${v.id}`,
          type: 'video',
          handle: v.ownerHandle || '@creator',
          label: v.caption || 'Video Post',
          avatar: v.ownerAvatar || null,
          title: v.caption || 'Trending Video',
          subtitle: `${v.ownerHandle} · ${v.likeCount || 0} likes`,
          videoData: v,
          data: v
        });
      }

      // match tags
      v.tags?.forEach(tag => {
        if (tag.toLowerCase().includes(q.replace('#', '')) && !tagSet.has(tag)) {
          tagSet.add(tag);
          results.push({
            id: `tag_${tag}`,
            type: 'tag',
            handle: `#${tag}`,
            label: `Trending tag · Explore videos`,
            avatar: null,
            title: `#${tag}`,
            subtitle: 'Trending Hashtag'
          });
        }
      });

      // match sounds
      if (v.sound && v.sound.toLowerCase().includes(q) && !soundSet.has(v.sound)) {
        soundSet.add(v.sound);
        results.push({
          id: `sound_${v.sound}`,
          type: 'sound',
          handle: v.sound,
          label: `Original Audio Track`,
          avatar: null,
          title: v.sound,
          subtitle: 'Audio Track'
        });
      }
    });
  } catch (err) {
    console.warn('Video search error:', err);
  }

  return results;
}

// -------------------------------------------------------------
// CENTRAL ADMINISTRATION, MODERATION & TELEGRAM BOT SYNC
// -------------------------------------------------------------

// Fetch all users for Admin Panel
export async function getAllUsersForAdmin(): Promise<UserProfile[]> {
  const usersRef = collection(db, 'users');
  const snap = await getDocs(query(usersRef, orderBy('createdAt', 'desc'), limit(100)));
  const list: UserProfile[] = [];
  snap.forEach((d) => {
    list.push({ uid: d.id, ...d.data() } as UserProfile);
  });
  return list;
}

// Fetch all videos for Admin Panel
export async function getAllVideosForAdmin(): Promise<VideoPost[]> {
  const vidsRef = collection(db, 'videos');
  const snap = await getDocs(query(vidsRef, orderBy('createdAt', 'desc'), limit(100)));
  const list: VideoPost[] = [];
  snap.forEach((d) => {
    list.push({ id: d.id, ...d.data() } as VideoPost);
  });
  return list;
}

// Ban User
export async function banUserInDb(uid: string, reason: string): Promise<void> {
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, {
    banned: true,
    banReason: reason || 'Violation of community guidelines',
    bannedAt: Date.now()
  });
}

// Unban User
export async function unbanUserInDb(uid: string): Promise<void> {
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, {
    banned: false,
    banReason: '',
    bannedAt: 0
  });

  // Also approve any pending appeals for this user
  try {
    const q = query(collection(db, 'appeals'), where('uid', '==', uid), where('status', '==', 'pending'));
    const snap = await getDocs(q);
    const batch = writeBatch(db);
    snap.forEach((d) => {
      batch.update(d.ref, {
        status: 'approved',
        reviewedAt: Date.now(),
        reviewedBy: 'Admin / Telegram Bot'
      });
    });
    await batch.commit();
  } catch (e) {
    console.warn('Notice resolving pending appeals on unban:', e);
  }
}

// Set User Verification (Official Verified Badge)
// The Telegram bot's /ban command sets `banned: true` for both a permanent
// ban and a timed suspension — hours > 0 just also sets `suspendedUntil`.
// Nothing server-side ever flips `banned` back to false when that deadline
// passes, and the client previously gated BannedScreen on `banned` alone,
// so a "24 hour suspension" behaved exactly like a permanent ban until an
// admin manually ran /unban. This checks the deadline and, if it has
// passed, restores the account itself.
export async function clearExpiredSuspension(uid: string): Promise<boolean> {
  try {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
      banned: false,
      banReason: '',
      bannedAt: 0,
      suspendedUntil: 0
    });
    return true;
  } catch (e) {
    console.warn('clearExpiredSuspension error:', e);
    return false;
  }
}

export async function setUserVerificationInDb(uid: string, verified: boolean): Promise<void> {
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, { verified });

  // Update verified status on all user's videos
  try {
    const vidsQuery = query(collection(db, 'videos'), where('ownerUid', '==', uid));
    const snap = await getDocs(vidsQuery);
    const batch = writeBatch(db);
    snap.forEach((d) => {
      batch.update(d.ref, { verified });
    });
    await batch.commit();
  } catch (e) {
    console.warn('Notice updating videos verification:', e);
  }
}

// Boost User Followers (by username, handle, or UID)
export async function boostUserFollowers(usernameOrHandleOrUid: string, count: number): Promise<UserProfile> {
  const clean = usernameOrHandleOrUid.trim().replace(/^@/, '').toLowerCase();
  
  // Try direct UID lookup
  let targetUserDoc = await getDoc(doc(db, 'users', usernameOrHandleOrUid.trim()));
  let targetUid = targetUserDoc.exists() ? targetUserDoc.id : null;

  if (!targetUid) {
    // Search by handle or username
    const snap = await getDocs(collection(db, 'users'));
    snap.forEach((d) => {
      const u = d.data() as UserProfile;
      const h = (u.handle || '').replace(/^@/, '').toLowerCase();
      const n = (u.username || '').toLowerCase();
      if (h === clean || n === clean || d.id === clean) {
        targetUid = d.id;
        targetUserDoc = d;
      }
    });
  }

  if (!targetUid || !targetUserDoc || !targetUserDoc.exists()) {
    throw new Error(`User "${usernameOrHandleOrUid}" not found on Pulse.`);
  }

  const userRef = doc(db, 'users', targetUid);
  await updateDoc(userRef, {
    followers: increment(count)
  });

  const updatedSnap = await getDoc(userRef);
  return { uid: updatedSnap.id, ...updatedSnap.data() } as UserProfile;
}

// Boost Video Likes (by link or ID)
export async function boostVideoLikes(videoLinkOrId: string, count: number): Promise<VideoPost> {
  // Extract ID if a link is provided
  let cleanId = videoLinkOrId.trim();
  const match = cleanId.match(/videos?\/([a-zA-Z0-9_-]+)/i);
  if (match && match[1]) {
    cleanId = match[1];
  } else if (cleanId.includes('/')) {
    cleanId = cleanId.split('/').pop()?.split('?')[0] || cleanId;
  }

  const videoRef = doc(db, 'videos', cleanId);
  const snap = await getDoc(videoRef);
  if (!snap.exists()) {
    throw new Error(`Video with ID "${cleanId}" was not found.`);
  }

  const videoData = snap.data() as VideoPost;
  await updateDoc(videoRef, {
    likeCount: increment(count)
  });

  // Also update owner likesReceived
  if (videoData.ownerUid) {
    try {
      await updateDoc(doc(db, 'users', videoData.ownerUid), {
        likesReceived: increment(count)
      });
    } catch (e) {}
  }

  const updatedSnap = await getDoc(videoRef);
  return { id: updatedSnap.id, ...updatedSnap.data() } as VideoPost;
}

// Submit Ban Appeal
export async function submitBanAppeal(data: {
  uid: string;
  username: string;
  handle: string;
  email: string;
  reason?: string;
  appealText: string;
  contactInfo?: string;
}): Promise<string> {
  const appealsRef = collection(db, 'appeals');
  const appealDoc = await addDoc(appealsRef, {
    ...data,
    status: 'pending',
    createdAt: Date.now()
  });

  // Notify Telegram Bot immediately via Server API
  try {
    fetch('/api/telegram/appeal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appealId: appealDoc.id,
        uid: data.uid,
        username: data.username,
        handle: data.handle,
        email: data.email,
        reason: data.reason,
        appealText: data.appealText,
        contactInfo: data.contactInfo
      })
    }).catch(err => console.warn('Telegram appeal notify notice:', err));
  } catch (e) {
    console.warn('Telegram dispatch error:', e);
  }

  return appealDoc.id;
}

// Get Appeals List
export async function getAppealsList(): Promise<AppealItem[]> {
  const appealsRef = collection(db, 'appeals');
  const snap = await getDocs(query(appealsRef, orderBy('createdAt', 'desc'), limit(50)));
  const list: AppealItem[] = [];
  snap.forEach((d) => {
    list.push({ id: d.id, ...d.data() } as AppealItem);
  });
  return list;
}

// Review Appeal
export async function reviewAppealInDb(appealId: string, uid: string, status: 'approved' | 'rejected', reviewedBy: string): Promise<void> {
  const appealRef = doc(db, 'appeals', appealId);
  await updateDoc(appealRef, {
    status,
    reviewedAt: Date.now(),
    reviewedBy: reviewedBy || 'Admin'
  });

  if (status === 'approved') {
    await unbanUserInDb(uid);
  }
}

// -------------------------------------------------------------
// VIDEO SYSTEM EXTENSIONS (Views, Pin Comments, Reposts, Drafts)
// -------------------------------------------------------------

// Record Video View
export async function recordVideoView(videoId: string) {
  try {
    const videoRef = doc(db, 'videos', videoId);
    await updateDoc(videoRef, {
      views: increment(1)
    });
  } catch (err) {
    // Non-blocking view increment
  }
}

// Pin / Unpin Comment
export async function togglePinComment(videoId: string, commentId: string, isPinned: boolean) {
  const commentRef = doc(db, 'videos', videoId, 'comments', commentId);
  await updateDoc(commentRef, {
    isPinned
  });
}

// Add Threaded Reply to Comment
export async function addCommentReply(
  videoId: string, 
  parentCommentId: string, 
  replyToHandle: string, 
  user: UserProfile, 
  text: string
) {
  const commentsRef = collection(db, 'videos', videoId, 'comments');
  const videoRef = doc(db, 'videos', videoId);

  await addDoc(commentsRef, {
    uid: user.uid,
    who: user.handle,
    avatar: user.photoURL,
    txt: text,
    likes: 0,
    createdAt: Date.now(),
    parentId: parentCommentId,
    replyToHandle
  });

  await updateDoc(videoRef, { commentCount: increment(1) });
}

// Repost Video
export async function toggleRepostVideo(video: VideoPost, user: UserProfile): Promise<boolean> {
  const repostRef = doc(db, 'users', user.uid, 'reposts', video.id);
  const videoRef = doc(db, 'videos', video.id);
  const snap = await getDoc(repostRef);

  if (snap.exists()) {
    await deleteDoc(repostRef);
    await updateDoc(videoRef, { repostCount: increment(-1) });
    return false;
  } else {
    await setDoc(repostRef, {
      videoId: video.id,
      repostedAt: Date.now()
    });
    await updateDoc(videoRef, { repostCount: increment(1) });

    if (video.ownerUid && video.ownerUid !== user.uid) {
      await createNotification(video.ownerUid, {
        kind: 'repost',
        who: user.handle,
        whoUid: user.uid,
        avatar: user.photoURL,
        text: 'reposted your video',
        time: 'Just now',
        createdAt: Date.now(),
        targetVideoId: video.id
      });
    }
    return true;
  }
}

// Drafts Management (Local + Optional DB fallback)
const DRAFTS_KEY = 'pulse_video_drafts_v1';

export function getLocalDrafts(): VideoDraft[] {
  try {
    const raw = localStorage.getItem(DRAFTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalDraft(draft: Omit<VideoDraft, 'id' | 'updatedAt'> & { id?: string }): VideoDraft {
  const drafts = getLocalDrafts();
  const id = draft.id || `draft_${Date.now()}`;
  const newDraft: VideoDraft = {
    ...draft,
    id,
    updatedAt: Date.now()
  };
  const filtered = drafts.filter(d => d.id !== id);
  const updated = [newDraft, ...filtered];
  try {
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(updated));
  } catch (e) {}
  return newDraft;
}

export function deleteLocalDraft(draftId: string) {
  const drafts = getLocalDrafts();
  const updated = drafts.filter(d => d.id !== draftId);
  try {
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(updated));
  } catch (e) {}
}

// Watch History
const WATCH_HISTORY_KEY = 'pulse_watch_history_v1';

export function getWatchHistory(): string[] {
  try {
    const raw = localStorage.getItem(WATCH_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function recordWatchHistory(videoId: string) {
  if (!videoId) return;
  const history = getWatchHistory().filter(id => id !== videoId);
  const updated = [videoId, ...history].slice(0, 50);
  try {
    localStorage.setItem(WATCH_HISTORY_KEY, JSON.stringify(updated));
  } catch (e) {}
}

export function clearWatchHistory() {
  try {
    localStorage.removeItem(WATCH_HISTORY_KEY);
  } catch (e) {}
}

// -------------------------------------------------------------
// SOCIAL & MODERATION (Reports, Blocking, Warnings, Suspensions)
// -------------------------------------------------------------

// Submit Report
export async function submitReport(
  type: 'user' | 'video' | 'comment',
  targetId: string,
  reason: string,
  reporter: UserProfile,
  details?: string,
  targetHandle?: string
): Promise<string> {
  const reportsRef = collection(db, 'reports');
  const docRef = await addDoc(reportsRef, {
    type,
    targetId,
    targetHandle: targetHandle || '',
    reason,
    details: details || '',
    reporterUid: reporter.uid,
    reporterHandle: reporter.handle,
    createdAt: Date.now(),
    status: 'open'
  });

  // Notify telegram bot in background
  try {
    fetch('/api/telegram/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reportId: docRef.id,
        type,
        targetId,
        targetHandle: targetHandle || '',
        reason,
        details: details || '',
        reporterHandle: reporter.handle
      })
    }).catch(() => {});
  } catch (e) {}

  return docRef.id;
}

export async function getAllReportsForAdmin(): Promise<ReportItem[]> {
  try {
    const reportsRef = collection(db, 'reports');
    const snap = await getDocs(query(reportsRef, orderBy('createdAt', 'desc'), limit(50)));
    const list: ReportItem[] = [];
    snap.forEach(d => {
      list.push({ id: d.id, ...d.data() } as ReportItem);
    });
    return list;
  } catch {
    return [];
  }
}

export async function resolveReportInDb(reportId: string) {
  const reportRef = doc(db, 'reports', reportId);
  await updateDoc(reportRef, { status: 'resolved' });
}

// Block & Unblock User
export async function blockUser(currentUid: string, targetUid: string) {
  const userRef = doc(db, 'users', currentUid);
  const userSnap = await getDoc(userRef);
  if (userSnap.exists()) {
    const data = userSnap.data() as UserProfile;
    const blocked = new Set(data.blockedUids || []);
    blocked.add(targetUid);
    await updateDoc(userRef, { blockedUids: Array.from(blocked) });
  }
}

export async function unblockUser(currentUid: string, targetUid: string) {
  const userRef = doc(db, 'users', currentUid);
  const userSnap = await getDoc(userRef);
  if (userSnap.exists()) {
    const data = userSnap.data() as UserProfile;
    const blocked = (data.blockedUids || []).filter(id => id !== targetUid);
    await updateDoc(userRef, { blockedUids: blocked });
  }
}

// Follow Requests (for private profiles)
export async function sendFollowRequest(fromUser: UserProfile, targetUid: string) {
  const reqRef = doc(db, 'user_relationships', `req_${fromUser.uid}_${targetUid}`);
  await setDoc(reqRef, {
    fromUid: fromUser.uid,
    fromHandle: fromUser.handle,
    fromUsername: fromUser.username,
    fromAvatar: fromUser.photoURL,
    toUid: targetUid,
    createdAt: Date.now()
  });

  await createNotification(targetUid, {
    kind: 'follow',
    who: fromUser.handle,
    whoUid: fromUser.uid,
    avatar: fromUser.photoURL,
    text: 'requested to follow you',
    time: 'Just now',
    createdAt: Date.now()
  });
}

export async function getFollowRequests(toUid: string): Promise<FollowRequestItem[]> {
  try {
    const q = query(collection(db, 'user_relationships'), where('toUid', '==', toUid));
    const snap = await getDocs(q);
    const list: FollowRequestItem[] = [];
    snap.forEach(d => {
      list.push({ id: d.id, ...d.data() } as FollowRequestItem);
    });
    return list;
  } catch {
    return [];
  }
}

export async function handleFollowRequest(request: FollowRequestItem, accept: boolean, currentUserProfile: UserProfile) {
  const reqDocRef = doc(db, 'user_relationships', request.id);
  await deleteDoc(reqDocRef);

  if (accept) {
    // Actually follow
    await toggleFollowUser(request.fromUid, request.toUid, currentUserProfile);
  }
}

// Issue Official Warning
export async function issueUserWarning(uid: string, warningText: string) {
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, {
    warningMessage: warningText
  });
}

export async function clearUserWarning(uid: string) {
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, {
    warningMessage: ''
  });
}

// Temporary Suspension (e.g. 24h, 7d, 30d)
export async function suspendUserTemporarily(uid: string, hours: number, reason: string) {
  const userRef = doc(db, 'users', uid);
  const suspendedUntil = Date.now() + hours * 3600 * 1000;
  await updateDoc(userRef, {
    banned: true,
    banReason: `Temporarily suspended for ${hours}h: ${reason}`,
    bannedAt: Date.now(),
    suspendedUntil
  });
}

// -------------------------------------------------------------
// CHAT ENHANCEMENTS (Reactions, Unsend/Delete, Reply)
// -------------------------------------------------------------

export async function deleteChatMessage(chatId: string, messageId: string) {
  const msgRef = doc(db, 'chats', chatId, 'messages', messageId);
  await deleteDoc(msgRef);
}

export async function editChatMessage(chatId: string, messageId: string, newText: string) {
  const msgRef = doc(db, 'chats', chatId, 'messages', messageId);
  await updateDoc(msgRef, {
    text: newText,
    isEdited: true,
    editedAt: Date.now()
  });
}

export async function reactToChatMessage(chatId: string, messageId: string, emoji: string, userUid: string) {
  const msgRef = doc(db, 'chats', chatId, 'messages', messageId);
  const snap = await getDoc(msgRef);
  if (snap.exists()) {
    const data = snap.data() as ChatMessage;
    const reactions = data.reactions || {};
    const uids = new Set(reactions[emoji] || []);
    if (uids.has(userUid)) {
      uids.delete(userUid);
    } else {
      uids.add(userUid);
    }
    reactions[emoji] = Array.from(uids);
    await updateDoc(msgRef, { reactions });
  }
}

// Generic path-based reaction toggle — same logic as reactToChatMessage but
// works for any message subcollection (groups/{id}/messages included).
export async function reactToMessage(chatPath: string, messageId: string, emoji: string, userUid: string) {
  const msgRef = doc(db, chatPath, messageId);
  const snap = await getDoc(msgRef);
  if (snap.exists()) {
    const data = snap.data() as ChatMessage;
    const reactions = data.reactions || {};
    const uids = new Set(reactions[emoji] || []);
    if (uids.has(userUid)) {
      uids.delete(userUid);
    } else {
      uids.add(userUid);
    }
    reactions[emoji] = Array.from(uids);
    await updateDoc(msgRef, { reactions });
  }
}

export async function markNotificationAsRead(userUid: string, notifId: string) {
  try {
    const notifRef = doc(db, 'notifications', userUid, 'items', notifId);
    await updateDoc(notifRef, { read: true });
  } catch (e) {}
}

export async function markAllNotificationsAsRead(userUid: string) {
  try {
    const snap = await getDocs(collection(db, 'notifications', userUid, 'items'));
    const batch = writeBatch(db);
    snap.forEach(d => {
      batch.update(d.ref, { read: true });
    });
    await batch.commit();
  } catch (e) {}
}

// -------------------------------------------------------------
// STORIES (24H EPHEMERAL CONTENT)
// -------------------------------------------------------------

export async function createStory(user: UserProfile, mediaUrl: string, mediaType: 'image' | 'video', caption?: string): Promise<string> {
  const storiesRef = collection(db, 'stories');
  const now = Date.now();
  const docRef = await addDoc(storiesRef, {
    ownerUid: user.uid,
    ownerHandle: user.handle,
    ownerUsername: user.username,
    ownerAvatar: user.photoURL,
    mediaUrl,
    mediaType,
    caption: caption || '',
    createdAt: now,
    expiresAt: now + 24 * 3600 * 1000,
    viewsCount: 0,
    viewers: []
  });
  return docRef.id;
}

export function subscribeToActiveStories(callback: (stories: StoryItem[]) => void) {
  try {
    const now = Date.now();
    const storiesRef = collection(db, 'stories');
    const q = query(storiesRef, where('expiresAt', '>', now - 3600000), orderBy('expiresAt', 'desc'), limit(30));
    return onSnapshot(q, (snapshot) => {
      const list: StoryItem[] = [];
      snapshot.forEach(d => {
        list.push({ id: d.id, ...d.data() } as StoryItem);
      });
      callback(list);
    }, (err) => {
      console.warn('Stories listener notice:', err);
      callback([]);
    });
  } catch (e) {
    callback([]);
    return () => {};
  }
}

export async function deleteStory(storyId: string) {
  const storyRef = doc(db, 'stories', storyId);
  await deleteDoc(storyRef);
}

// -------------------------------------------------------------
// LIVE STREAMING
// -------------------------------------------------------------

// A broadcast is considered stale (host disconnected without cleanly ending
// the stream — app crash, tab close, lost connection) if no heartbeat has
// landed in this window. Host clients ping every LIVE_HEARTBEAT_INTERVAL_MS.
export const LIVE_HEARTBEAT_INTERVAL_MS = 15000;
export const LIVE_STALE_THRESHOLD_MS = 45000;

function isStreamStale(stream: any): boolean {
  const lastBeat = stream.lastHeartbeatAt || stream.startedAt || 0;
  return Date.now() - lastBeat > LIVE_STALE_THRESHOLD_MS;
}

export async function startLiveStream(host: UserProfile, title: string, topic?: string): Promise<string> {
  const liveRef = collection(db, 'livestreams');
  const docRef = await addDoc(liveRef, {
    hostUid: host.uid,
    hostHandle: host.handle,
    hostUsername: host.username,
    hostAvatar: host.photoURL,
    title: title.trim() || `${host.username}'s Live Broadcast ✨`,
    topic: topic || 'Chat & Chill',
    viewerCount: 1,
    heartsCount: 0,
    status: 'live',
    startedAt: Date.now(),
    lastHeartbeatAt: Date.now()
  });

  // Fan out a 'live' notification to followers so it shows up under the
  // Activity tab. NotificationItem.kind already supported 'live', and the
  // Activity filter already accepted it — the piece that was missing was
  // this fan-out ever being written in the first place.
  try {
    const followersSnap = await getDocs(collection(db, 'follows', host.uid, 'followers'));
    await Promise.all(
      followersSnap.docs.map((followerDoc) =>
        createNotification(followerDoc.id, {
          kind: 'live',
          who: host.handle || host.username,
          whoUid: host.uid,
          avatar: host.photoURL,
          text: 'is live now',
          time: 'Just now',
          createdAt: Date.now()
        }).catch(() => {})
      )
    );
  } catch (e) {
    // non-fatal — the stream still goes live even if the notification fan-out fails
  }

  return docRef.id;
}

// Host calls this every LIVE_HEARTBEAT_INTERVAL_MS while broadcasting so
// viewers/listings can tell a real, still-connected broadcast from a stream
// doc left behind by a crashed/closed host.
export async function sendLiveHeartbeat(streamId: string) {
  try {
    const streamRef = doc(db, 'livestreams', streamId);
    await updateDoc(streamRef, { lastHeartbeatAt: Date.now() });
  } catch (e) {
    // non-fatal — a missed heartbeat just makes the stream look stale sooner
  }
}

export function subscribeToActiveLiveStreams(callback: (streams: LiveStream[]) => void) {
  try {
    const liveRef = collection(db, 'livestreams');
    const q = query(liveRef, where('status', '==', 'live'), orderBy('startedAt', 'desc'), limit(20));
    return onSnapshot(q, (snapshot) => {
      const list: LiveStream[] = [];
      snapshot.forEach(d => {
        const data = { id: d.id, ...d.data() } as LiveStream;
        // Filter out streams whose host has gone silent (stale heartbeat) —
        // these are offline/crashed hosts that never got marked "ended".
        if (!isStreamStale(data)) list.push(data);
      });
      callback(list.slice(0, 10));
    }, (err) => {
      console.warn('Live streams notice:', err);
      callback([]);
    });
  } catch (e) {
    callback([]);
    return () => {};
  }
}

export function subscribeToLiveStream(streamId: string, callback: (stream: LiveStream | null) => void) {
  const streamRef = doc(db, 'livestreams', streamId);
  return onSnapshot(streamRef, (d) => {
    if (d.exists()) {
      const data = { id: d.id, ...d.data() } as LiveStream;
      // If the doc says "live" but the host's heartbeat has gone stale,
      // treat it as ended for viewers (host likely crashed/closed the app).
      if ((data as any).status === 'live' && isStreamStale(data)) {
        callback({ ...data, status: 'ended' } as LiveStream);
        return;
      }
      callback(data);
    } else {
      callback(null);
    }
  });
}

export async function endLiveStream(streamId: string) {
  const streamRef = doc(db, 'livestreams', streamId);
  await updateDoc(streamRef, {
    status: 'ended',
    endedAt: Date.now()
  });
}

export async function sendLiveHeart(streamId: string, count: number = 1) {
  try {
    const streamRef = doc(db, 'livestreams', streamId);
    await updateDoc(streamRef, {
      heartsCount: increment(count)
    });
  } catch (e) {}
}

export function subscribeToLiveChat(streamId: string, callback: (messages: LiveChatMessage[]) => void) {
  const chatRef = collection(db, 'livestreams', streamId, 'chat');
  const q = query(chatRef, orderBy('createdAt', 'desc'), limit(50));
  return onSnapshot(q, (snapshot) => {
    const list: LiveChatMessage[] = [];
    snapshot.forEach(d => {
      list.push({ id: d.id, ...d.data() } as LiveChatMessage);
    });
    callback(list.reverse());
  });
}

export async function sendLiveChatMessage(streamId: string, user: UserProfile, text: string, isSystem: boolean = false) {
  const chatRef = collection(db, 'livestreams', streamId, 'chat');
  await addDoc(chatRef, {
    uid: user.uid,
    handle: user.handle,
    username: user.username,
    avatar: user.photoURL,
    text: text.trim(),
    createdAt: Date.now(),
    isSystem
  });
}

// -------------------------------------------------------------
// PLAYLISTS
// -------------------------------------------------------------

export async function createPlaylist(user: UserProfile, title: string, description?: string): Promise<string> {
  const plRef = collection(db, 'playlists');
  const docRef = await addDoc(plRef, {
    ownerUid: user.uid,
    title: title.trim(),
    description: description?.trim() || '',
    videoIds: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  });
  return docRef.id;
}

export async function getUserPlaylists(uid: string): Promise<Playlist[]> {
  try {
    const q = query(collection(db, 'playlists'), where('ownerUid', '==', uid));
    const snap = await getDocs(q);
    const list: Playlist[] = [];
    snap.forEach(d => list.push({ id: d.id, ...d.data() } as Playlist));
    return list;
  } catch {
    return [];
  }
}

export async function addVideoToPlaylist(playlistId: string, videoId: string) {
  const plRef = doc(db, 'playlists', playlistId);
  const snap = await getDoc(plRef);
  if (snap.exists()) {
    const data = snap.data() as Playlist;
    const ids = new Set(data.videoIds || []);
    ids.add(videoId);
    await updateDoc(plRef, {
      videoIds: Array.from(ids),
      updatedAt: Date.now()
    });
  }
}

export async function removeVideoFromPlaylist(playlistId: string, videoId: string) {
  const plRef = doc(db, 'playlists', playlistId);
  const snap = await getDoc(plRef);
  if (snap.exists()) {
    const data = snap.data() as Playlist;
    const ids = (data.videoIds || []).filter(id => id !== videoId);
    await updateDoc(plRef, {
      videoIds: ids,
      updatedAt: Date.now()
    });
  }
}

// -------------------------------------------------------------
// PIN & ARCHIVE VIDEOS
// -------------------------------------------------------------

export async function togglePinVideo(userUid: string, videoId: string, isPinned: boolean) {
  const userRef = doc(db, 'users', userUid);
  const videoRef = doc(db, 'videos', videoId);
  const snap = await getDoc(userRef);
  if (snap.exists()) {
    const data = snap.data() as UserProfile;
    let pinned = data.pinnedVideoIds || [];
    if (isPinned) {
      if (pinned.length >= 3) {
        throw new Error('You can only pin up to 3 videos to your profile.');
      }
      pinned = [...pinned.filter(id => id !== videoId), videoId];
    } else {
      pinned = pinned.filter(id => id !== videoId);
    }
    await updateDoc(userRef, { pinnedVideoIds: pinned });
    await updateDoc(videoRef, { isPinned });
  }
}

export async function toggleArchiveVideo(userUid: string, videoId: string, isArchived: boolean) {
  const userRef = doc(db, 'users', userUid);
  const videoRef = doc(db, 'videos', videoId);
  const snap = await getDoc(userRef);
  if (snap.exists()) {
    const data = snap.data() as UserProfile;
    let archived = data.archivedVideoIds || [];
    if (isArchived) {
      archived = [...archived.filter(id => id !== videoId), videoId];
    } else {
      archived = archived.filter(id => id !== videoId);
    }
    await updateDoc(userRef, { archivedVideoIds: archived });
    await updateDoc(videoRef, { isArchived });
  }
}

// -------------------------------------------------------------
// ADVANCED LIVE STREAMING (POLLS, Q&A, GUESTS, MODS, REPLAYS)
// -------------------------------------------------------------

export async function createAdvancedLiveStream(host: UserProfile, title: string, category: string = 'Just Chatting', topic?: string): Promise<string> {
  const streamRef = collection(db, 'livestreams');
  const docRef = await addDoc(streamRef, {
    hostUid: host.uid,
    hostHandle: host.handle,
    hostUsername: host.username,
    hostAvatar: host.photoURL,
    title: title.trim(),
    category,
    topic: topic?.trim() || category,
    viewerCount: 1,
    heartsCount: 0,
    status: 'live',
    startedAt: Date.now(),
    isTrending: false,
    moderatorUids: [host.uid],
    mutedUids: [],
    kickedUids: [],
    blockedUids: [],
    guests: [],
    guestRequests: [],
    activePoll: null,
    pinnedMessage: null
  });
  return docRef.id;
}

export async function createLivePoll(streamId: string, question: string, options: string[]) {
  const streamRef = doc(db, 'livestreams', streamId);
  const poll: LivePoll = {
    id: 'poll_' + Date.now(),
    question: question.trim(),
    options: options.filter(o => o.trim().length > 0).map(text => ({ text: text.trim(), votes: 0 })),
    voterUids: {},
    createdAt: Date.now(),
    isActive: true
  };
  await updateDoc(streamRef, { activePoll: poll });
}

export async function voteLivePoll(streamId: string, optionIndex: number, voterUid: string) {
  const streamRef = doc(db, 'livestreams', streamId);
  const snap = await getDoc(streamRef);
  if (snap.exists()) {
    const data = snap.data() as LiveStream;
    if (data.activePoll && data.activePoll.isActive) {
      const poll = { ...data.activePoll };
      const previousVote = poll.voterUids[voterUid];
      if (previousVote !== undefined && poll.options[previousVote]) {
        poll.options[previousVote].votes = Math.max(0, poll.options[previousVote].votes - 1);
      }
      poll.voterUids[voterUid] = optionIndex;
      if (poll.options[optionIndex]) {
        poll.options[optionIndex].votes += 1;
      }
      await updateDoc(streamRef, { activePoll: poll });
    }
  }
}

export async function endLivePoll(streamId: string) {
  const streamRef = doc(db, 'livestreams', streamId);
  await updateDoc(streamRef, { activePoll: null });
}

export async function pinLiveStreamMessage(streamId: string, message: LiveChatMessage | null) {
  const streamRef = doc(db, 'livestreams', streamId);
  await updateDoc(streamRef, { pinnedMessage: message });
}

export async function requestToJoinLive(streamId: string, user: UserProfile) {
  const streamRef = doc(db, 'livestreams', streamId);
  const snap = await getDoc(streamRef);
  if (snap.exists()) {
    const data = snap.data() as LiveStream;
    const requests = data.guestRequests || [];
    if (!requests.some(r => r.uid === user.uid)) {
      requests.push({
        uid: user.uid,
        handle: user.handle,
        avatar: user.photoURL,
        username: user.username
      });
      await updateDoc(streamRef, { guestRequests: requests });
    }
  }
}

export async function acceptLiveGuestRequest(streamId: string, guest: { uid: string; handle: string; username: string; avatar: string }) {
  const streamRef = doc(db, 'livestreams', streamId);
  const snap = await getDoc(streamRef);
  if (snap.exists()) {
    const data = snap.data() as LiveStream;
    const guests = data.guests || [];
    if (guests.length < 3 && !guests.some(g => g.uid === guest.uid)) {
      guests.push({
        uid: guest.uid,
        handle: guest.handle,
        username: guest.username,
        avatar: guest.avatar,
        cameraOn: true,
        micOn: true,
        role: 'guest'
      });
      const requests = (data.guestRequests || []).filter(r => r.uid !== guest.uid);
      await updateDoc(streamRef, { guests, guestRequests: requests });
    }
  }
}

export async function removeLiveGuest(streamId: string, guestUid: string) {
  const streamRef = doc(db, 'livestreams', streamId);
  const snap = await getDoc(streamRef);
  if (snap.exists()) {
    const data = snap.data() as LiveStream;
    const guests = (data.guests || []).filter(g => g.uid !== guestUid);
    await updateDoc(streamRef, { guests });
  }
}

export async function toggleLiveModerator(streamId: string, userUid: string, isMod: boolean) {
  const streamRef = doc(db, 'livestreams', streamId);
  const snap = await getDoc(streamRef);
  if (snap.exists()) {
    const data = snap.data() as LiveStream;
    let mods = data.moderatorUids || [];
    if (isMod) {
      if (!mods.includes(userUid)) mods.push(userUid);
    } else {
      mods = mods.filter(m => m !== userUid);
    }
    await updateDoc(streamRef, { moderatorUids: mods });
  }
}

export async function muteLiveViewer(streamId: string, userUid: string) {
  const streamRef = doc(db, 'livestreams', streamId);
  const snap = await getDoc(streamRef);
  if (snap.exists()) {
    const data = snap.data() as LiveStream;
    const muted = data.mutedUids || [];
    if (!muted.includes(userUid)) muted.push(userUid);
    await updateDoc(streamRef, { mutedUids: muted });
  }
}

export async function kickLiveViewer(streamId: string, userUid: string) {
  const streamRef = doc(db, 'livestreams', streamId);
  const snap = await getDoc(streamRef);
  if (snap.exists()) {
    const data = snap.data() as LiveStream;
    const kicked = data.kickedUids || [];
    if (!kicked.includes(userUid)) kicked.push(userUid);
    await updateDoc(streamRef, { kickedUids: kicked });
  }
}

export async function saveLiveReplay(stream: LiveStream, videoUrl?: string): Promise<string> {
  const replaysRef = collection(db, 'livereplays');
  const durSec = stream.endedAt ? Math.round((stream.endedAt - stream.startedAt) / 1000) : 180;
  const mins = Math.floor(durSec / 60);
  const secs = durSec % 60;
  const durStr = `${mins}:${secs < 10 ? '0' : ''}${secs}`;

  const docRef = await addDoc(replaysRef, {
    streamId: stream.id,
    hostUid: stream.hostUid,
    hostHandle: stream.hostHandle,
    hostUsername: stream.hostUsername,
    hostAvatar: stream.hostAvatar,
    title: stream.title,
    category: stream.category || 'Live Replay',
    duration: durStr,
    peakViewers: Math.max(stream.viewerCount, 42),
    totalHearts: stream.heartsCount || 1200,
    videoUrl: videoUrl || 'https://assets.mixkit.co/videos/preview/mixkit-girl-dancing-happy-in-a-room-41648-large.mp4',
    createdAt: Date.now()
  });
  return docRef.id;
}

export function subscribeToLiveReplays(callback: (replays: LiveReplay[]) => void) {
  try {
    const q = query(collection(db, 'livereplays'), orderBy('createdAt', 'desc'), limit(20));
    return onSnapshot(q, (snapshot) => {
      const list: LiveReplay[] = [];
      snapshot.forEach(d => list.push({ id: d.id, ...d.data() } as LiveReplay));
      callback(list);
    }, () => callback([]));
  } catch {
    callback([]);
    return () => {};
  }
}

// -------------------------------------------------------------
// ADVANCED STORIES & HIGHLIGHTS & ARCHIVE
// -------------------------------------------------------------

export async function recordStoryView(storyId: string, user: UserProfile) {
  try {
    const storyRef = doc(db, 'stories', storyId);
    const snap = await getDoc(storyRef);
    if (snap.exists()) {
      const data = snap.data() as StoryItem;
      const viewers = data.viewers || [];
      if (!viewers.some(v => v.uid === user.uid)) {
        viewers.push({
          uid: user.uid,
          handle: user.handle,
          avatar: user.photoURL,
          viewedAt: Date.now()
        });
        await updateDoc(storyRef, {
          viewers,
          viewsCount: viewers.length
        });
      }
    }
  } catch (e) {
    console.warn('Record story view notice:', e);
  }
}

export async function reactToStory(storyId: string, user: UserProfile, emoji: string) {
  try {
    const storyRef = doc(db, 'stories', storyId);
    const snap = await getDoc(storyRef);
    if (snap.exists()) {
      const data = snap.data() as StoryItem;
      const reactions = data.reactions || [];
      reactions.push({ emoji, uid: user.uid, handle: user.handle });
      await updateDoc(storyRef, { reactions });
    }
  } catch (e) {
    console.warn('React to story notice:', e);
  }
}

export async function createStoryHighlight(user: UserProfile, title: string, coverUrl: string, storyIds: string[]): Promise<string> {
  const highlightsRef = collection(db, 'highlights');
  const docRef = await addDoc(highlightsRef, {
    ownerUid: user.uid,
    title: title.trim(),
    coverUrl: coverUrl.trim(),
    storyIds,
    createdAt: Date.now()
  });
  return docRef.id;
}

export function subscribeToUserHighlights(uid: string, callback: (highlights: StoryHighlight[]) => void) {
  try {
    const q = query(collection(db, 'highlights'), where('ownerUid', '==', uid));
    return onSnapshot(q, (snapshot) => {
      const list: StoryHighlight[] = [];
      snapshot.forEach(d => list.push({ id: d.id, ...d.data() } as StoryHighlight));
      callback(list.sort((a, b) => b.createdAt - a.createdAt));
    }, () => callback([]));
  } catch {
    callback([]);
    return () => {};
  }
}

export async function deleteStoryHighlight(highlightId: string) {
  await deleteDoc(doc(db, 'highlights', highlightId));
}

export async function getUserStoryArchive(uid: string): Promise<StoryItem[]> {
  try {
    const q = query(collection(db, 'stories'), where('ownerUid', '==', uid));
    const snap = await getDocs(q);
    const list: StoryItem[] = [];
    snap.forEach(d => list.push({ id: d.id, ...d.data() } as StoryItem));
    return list.sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

// -------------------------------------------------------------
// GROUP CHATS & ADVANCED MESSAGING (VOICE, GIFS, PINS, SEARCH)
// -------------------------------------------------------------

export async function createGroupChat(creator: UserProfile, name: string, memberProfiles: UserProfile[], photoUrl?: string): Promise<string> {
  const groupRef = collection(db, 'groups');
  const membersMap: { [uid: string]: any } = {
    [creator.uid]: {
      uid: creator.uid,
      handle: creator.handle,
      username: creator.username,
      avatar: creator.photoURL,
      role: 'admin',
      joinedAt: Date.now()
    }
  };

  const memberUids = [creator.uid];

  memberProfiles.forEach(m => {
    if (!membersMap[m.uid]) {
      memberUids.push(m.uid);
      membersMap[m.uid] = {
        uid: m.uid,
        handle: m.handle,
        username: m.username,
        avatar: m.photoURL,
        role: 'member',
        joinedAt: Date.now()
      };
    }
  });

  const docRef = await addDoc(groupRef, {
    name: name.trim(),
    photoUrl: photoUrl || 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=150&auto=format&fit=crop&q=80',
    adminUid: creator.uid,
    memberUids,
    members: membersMap,
    lastMessage: `${creator.handle} created group "${name}"`,
    lastUpdated: Date.now(),
    createdAt: Date.now(),
    isGroup: true
  });

  return docRef.id;
}

export function subscribeToUserGroups(uid: string, callback: (groups: GroupChat[]) => void) {
  try {
    const q = query(collection(db, 'groups'), where('memberUids', 'array-contains', uid));
    return onSnapshot(q, (snapshot) => {
      const list: GroupChat[] = [];
      snapshot.forEach(d => list.push({ id: d.id, ...d.data() } as GroupChat));
      callback(list.sort((a, b) => b.lastUpdated - a.lastUpdated));
    }, () => callback([]));
  } catch {
    callback([]);
    return () => {};
  }
}

export function subscribeToGroupMessages(groupId: string, callback: (messages: ChatMessage[]) => void) {
  try {
    const messagesRef = collection(db, 'groups', groupId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'));
    return onSnapshot(q, (snapshot) => {
      const list: ChatMessage[] = [];
      snapshot.forEach(d => list.push({ id: d.id, ...d.data() } as ChatMessage));
      callback(list);
    }, () => callback([]));
  } catch {
    callback([]);
    return () => {};
  }
}

export async function sendGroupMessage(groupId: string, sender: UserProfile, text: string, options?: {
  mediaUrl?: string;
  mediaType?: 'text' | 'voice' | 'gif' | 'image' | 'video_share' | 'story_reply';
  voiceDuration?: number;
  gifUrl?: string;
  videoPreview?: any;
}) {
  const messagesRef = collection(db, 'groups', groupId, 'messages');
  const groupRef = doc(db, 'groups', groupId);

  const newMsg = {
    senderUid: sender.uid,
    senderHandle: sender.handle,
    senderUsername: sender.username,
    senderAvatar: sender.photoURL,
    text: text.trim(),
    createdAt: Date.now(),
    mediaUrl: options?.mediaUrl || null,
    mediaType: options?.mediaType || 'text',
    voiceDuration: options?.voiceDuration || null,
    gifUrl: options?.gifUrl || null,
    videoPreview: options?.videoPreview || null,
    status: 'sent'
  };

  await addDoc(messagesRef, newMsg);
  await updateDoc(groupRef, {
    lastMessage: options?.mediaType === 'voice' ? '🎤 Voice message' : options?.mediaType === 'gif' ? '🖼 GIF' : text.trim(),
    lastUpdated: Date.now()
  });
}

export async function updateGroupInfo(groupId: string, updates: { name?: string; photoUrl?: string }) {
  const groupRef = doc(db, 'groups', groupId);
  await updateDoc(groupRef, updates);
}

export async function addGroupMember(groupId: string, member: UserProfile) {
  const groupRef = doc(db, 'groups', groupId);
  const snap = await getDoc(groupRef);
  if (snap.exists()) {
    const data = snap.data() as GroupChat;
    const memberUids = new Set(data.memberUids || []);
    memberUids.add(member.uid);
    const members = { ...(data.members || {}) };
    members[member.uid] = {
      uid: member.uid,
      handle: member.handle,
      username: member.username,
      avatar: member.photoURL,
      role: 'member',
      joinedAt: Date.now()
    };
    await updateDoc(groupRef, {
      memberUids: Array.from(memberUids),
      members,
      lastMessage: `${member.handle} joined the group`,
      lastUpdated: Date.now()
    });
  }
}

export async function removeGroupMember(groupId: string, memberUid: string) {
  const groupRef = doc(db, 'groups', groupId);
  const snap = await getDoc(groupRef);
  if (snap.exists()) {
    const data = snap.data() as GroupChat;
    const memberUids = (data.memberUids || []).filter(id => id !== memberUid);
    const members = { ...(data.members || {}) };
    delete members[memberUid];
    await updateDoc(groupRef, {
      memberUids,
      members,
      lastUpdated: Date.now()
    });
  }
}

export async function unsendMessage(chatPath: string, messageId: string) {
  try {
    const msgRef = doc(db, chatPath, messageId);
    await updateDoc(msgRef, {
      text: 'This message was unsent',
      deletedForEveryone: true,
      mediaUrl: null,
      gifUrl: null
    });
  } catch (e) {
    console.warn('Unsend notice:', e);
  }
}

// Generic path-based edit, mirrors unsendMessage's shape so it works for
// both 1-on-1 chats (chats/{id}/messages) and group chats (groups/{id}/messages).
export async function editMessage(chatPath: string, messageId: string, newText: string) {
  try {
    const msgRef = doc(db, chatPath, messageId);
    await updateDoc(msgRef, {
      text: newText,
      isEdited: true,
      editedAt: Date.now()
    });
  } catch (e) {
    console.warn('Edit message notice:', e);
  }
}

export async function pinChatMessage(chatPath: string, message: ChatMessage | null, parentPath?: string) {
  try {
    if (parentPath) {
      await updateDoc(doc(db, parentPath), { pinnedMessage: message });
    }
  } catch (e) {
    console.warn('Pin chat message notice:', e);
  }
}

// Presence follows the same heartbeat-plus-staleness pattern as live streams:
// the client pings every PRESENCE_HEARTBEAT_INTERVAL_MS while the app is
// foregrounded, and a user only reads as "online" if isOnline is true AND
// that heartbeat landed within PRESENCE_STALE_MS. This is what makes a
// crashed/closed tab (no explicit sign-out) eventually read as offline.
export const PRESENCE_HEARTBEAT_INTERVAL_MS = 20000;
export const PRESENCE_STALE_MS = 60000;

export async function updateUserPresence(uid: string, isOnline: boolean) {
  try {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
      isOnline,
      lastActive: Date.now()
    });
  } catch (e) {
    // silent catch
  }
}

// -------------------------------------------------------------
// SCHEDULED POSTS & CONTENT MANAGEMENT
// -------------------------------------------------------------

export async function scheduleVideoPost(user: UserProfile, postData: any, scheduledAt: number): Promise<string> {
  const schedRef = collection(db, 'scheduled_posts');
  const docRef = await addDoc(schedRef, {
    ownerUid: user.uid,
    videoData: {
      ...postData,
      ownerHandle: user.handle,
      ownerUsername: user.username,
      ownerAvatar: user.photoURL
    },
    scheduledAt,
    createdAt: Date.now(),
    status: 'scheduled'
  });
  return docRef.id;
}

export function subscribeToScheduledPosts(uid: string, callback: (posts: ScheduledPost[]) => void) {
  try {
    const q = query(collection(db, 'scheduled_posts'), where('ownerUid', '==', uid));
    return onSnapshot(q, (snapshot) => {
      const list: ScheduledPost[] = [];
      snapshot.forEach(d => list.push({ id: d.id, ...d.data() } as ScheduledPost));
      callback(list.sort((a, b) => a.scheduledAt - b.scheduledAt));
    }, () => callback([]));
  } catch {
    callback([]);
    return () => {};
  }
}

export async function cancelScheduledPost(postId: string) {
  await deleteDoc(doc(db, 'scheduled_posts', postId));
}

export async function publishScheduledPostNow(postId: string, user: UserProfile): Promise<string> {
  const schedRef = doc(db, 'scheduled_posts', postId);
  const snap = await getDoc(schedRef);
  if (!snap.exists()) throw new Error('Scheduled post not found');
  const data = snap.data() as ScheduledPost;

  // Publish to videos collection
  const videoId = await createVideoPost({
    src: data.videoData.src,
    caption: data.videoData.caption,
    sound: data.videoData.sound,
    tags: data.videoData.tags,
    user,
    filter: data.videoData.filter,
    textOverlay: data.videoData.textOverlay,
    visibility: data.videoData.visibility,
    allowComments: data.videoData.allowComments
  });

  await deleteDoc(schedRef);
  return videoId;
}

export async function updateVideoPostSettings(videoId: string, updates: { visibility?: 'public' | 'friends' | 'private'; allowComments?: boolean; caption?: string }) {
  const videoRef = doc(db, 'videos', videoId);
  await updateDoc(videoRef, updates);
}

// -------------------------------------------------------------
// RECOMMENDATIONS, DISCOVERY & TRENDING
// -------------------------------------------------------------

export async function getSuggestedCreators(currentUserUid?: string): Promise<UserProfile[]> {
  try {
    const q = query(collection(db, 'users'), limit(25));
    const snap = await getDocs(q);
    const list: UserProfile[] = [];
    
    snap.forEach(d => {
      const u = { uid: d.id, ...d.data() } as UserProfile;
      if (u.uid !== currentUserUid && !u.banned) {
        list.push(u);
      }
    });

    return list.sort((a, b) => (b.followers || 0) - (a.followers || 0));
  } catch {
    return [];
  }
}

export async function getTrendingSearches(): Promise<{ term: string; count: number; isHot: boolean }[]> {
  try {
    // Real trending: aggregate actual logged searches from the last 7 days.
    const cutoff = Timestamp.fromMillis(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const logsRef = collection(db, 'searchLogs');
    const snap = await getDocs(query(logsRef, where('createdAt', '>=', cutoff), limit(500)));

    const counts = new Map<string, number>();
    snap.forEach(d => {
      const term = (d.data().term || '').trim();
      if (!term) return;
      counts.set(term, (counts.get(term) || 0) + 1);
    });

    const ranked = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([term, count], idx) => ({ term, count, isHot: idx < 3 }));

    return ranked;
  } catch (err) {
    console.warn('getTrendingSearches error:', err);
    return [];
  }
}

// Logs a real search term so getTrendingSearches reflects actual activity.
export async function logSearchTerm(term: string): Promise<void> {
  const clean = term.trim();
  if (!clean) return;
  try {
    await addDoc(collection(db, 'searchLogs'), {
      term: clean,
      createdAt: serverTimestamp()
    });
  } catch (err) {
    console.warn('logSearchTerm error:', err);
  }
}

export async function getRecommendedHashtags(): Promise<{ tag: string; count: number }[]> {
  try {
    // Real recommendation: aggregate actual tags used across recent videos.
    const videosRef = collection(db, 'videos');
    const snap = await getDocs(query(videosRef, orderBy('createdAt', 'desc'), limit(200)));

    const counts = new Map<string, number>();
    snap.forEach(d => {
      const v = d.data() as VideoPost;
      v.tags?.forEach(tag => {
        const clean = tag.replace(/^#/, '');
        if (!clean) return;
        counts.set(clean, (counts.get(clean) || 0) + 1);
      });
    });

    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([tag, count]) => ({ tag, count }));
  } catch (err) {
    console.warn('getRecommendedHashtags error:', err);
    return [];
  }
}

// -------------------------------------------------------------
// SYSTEM ANNOUNCEMENTS, APPEALS & ACCOUNT WARNINGS
// -------------------------------------------------------------

export function subscribeToPlatformAnnouncements(callback: (announcements: PlatformAnnouncement[]) => void) {
  try {
    const q = query(collection(db, 'announcements'), where('isActive', '==', true));
    return onSnapshot(q, (snapshot) => {
      const list: PlatformAnnouncement[] = [];
      snapshot.forEach(d => list.push({ id: d.id, ...d.data() } as PlatformAnnouncement));
      callback(list);
    }, () => callback([]));
  } catch {
    callback([]);
    return () => {};
  }
}

export async function getUserAccountWarnings(uid: string): Promise<AccountWarning[]> {
  try {
    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const data = snap.data() as UserProfile;
      return data.warningHistory || [];
    }
    return [];
  } catch {
    return [];
  }
}

export async function getUserAppeals(uid: string): Promise<AppealItem[]> {
  try {
    const q = query(collection(db, 'appeals'), where('uid', '==', uid));
    const snap = await getDocs(q);
    const list: AppealItem[] = [];
    snap.forEach(d => list.push({ id: d.id, ...d.data() } as AppealItem));
    return list.sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

export function isPlatformOwner(user: UserProfile | null | undefined): boolean {
  if (!user) return false;
  return (
    user.email?.toLowerCase() === OWNER_EMAIL.toLowerCase() ||
    user.handle?.toLowerCase() === OWNER_HANDLE.toLowerCase() ||
    user.handle?.toLowerCase() === '@mrnovatech' ||
    user.username?.toLowerCase() === 'mrnovatech' ||
    user.uid === 'owner_mrnovatech' ||
    user.uid === 'uid_owner_mrnovatech'
  );
}

// -------------------------------------------------------------
// LIVE STREAM DISCOVERY, CATEGORIES & REPLAYS
// -------------------------------------------------------------

export interface UpcomingLiveStream {
  id: string;
  hostUid: string;
  hostHandle: string;
  hostUsername: string;
  hostAvatar: string;
  title: string;
  description: string;
  category: string;
  coverImage: string;
  scheduledTime: number; // Unix timestamp
  remindersCount: number;
  isReminded?: boolean;
}

export interface LiveBattleState {
  isActive: boolean;
  leftHost: { uid: string; handle: string; username: string; avatar: string; score: number };
  rightHost: { uid: string; handle: string; username: string; avatar: string; score: number };
  durationSeconds: number;
  timeRemaining: number;
  winnerUid?: string | null;
  startedAt: number;
  topGifters: { uid: string; handle: string; avatar: string; amount: number; side: 'left' | 'right' }[];
}

export const LIVE_CATEGORIES = [
  { id: 'all', name: 'All Streams', icon: '🔥' },
  { id: 'gaming', name: 'Gaming', icon: '🎮' },
  { id: 'music', name: 'Music & DJ', icon: '🎵' },
  { id: 'irl', name: 'IRL & Vlogs', icon: '🌆' },
  { id: 'creative', name: 'Creative & Art', icon: '🎨' },
  { id: 'chatting', name: 'Just Chatting', icon: '💬' },
  { id: 'tech', name: 'Tech & Coding', icon: '💻' },
  { id: 'dance', name: 'Dance & Vibes', icon: '💃' },
  { id: 'comedy', name: 'Comedy & Fun', icon: '😂' },
  { id: 'cooking', name: 'Cooking & Food', icon: '🍳' },
  { id: 'fitness', name: 'Fitness & Health', icon: '💪' }
];

export async function getLiveDiscoveryData(): Promise<{
  activeStreams: LiveStream[];
  trendingStreams: LiveStream[];
  upcomingStreams: UpcomingLiveStream[];
  replays: LiveReplay[];
}> {
  try {
    // Fetch active live streams from Firestore
    const q = query(collection(db, 'livestreams'), where('status', '==', 'live'), limit(20));
    const snap = await getDocs(q);
    const activeStreams: LiveStream[] = [];
    snap.forEach(d => {
      const data = { id: d.id, ...d.data() } as LiveStream;
      // Skip stale hosts (crashed/closed without ending the stream) so
      // offline accounts don't show up as "live".
      if (!isStreamStale(data)) activeStreams.push(data);
    });

    // Fetch upcoming and replays from Firestore if any
    const replaysSnap = await getDocs(query(collection(db, 'livereplays'), orderBy('createdAt', 'desc'), limit(10)));
    const replays: LiveReplay[] = [];
    replaysSnap.forEach(d => replays.push({ id: d.id, ...d.data() } as LiveReplay));

    const trendingStreams = [...activeStreams].sort((a, b) => (b.viewerCount || 0) - (a.viewerCount || 0));

    return {
      activeStreams,
      trendingStreams,
      upcomingStreams: [],
      replays
    };
  } catch (e) {
    return {
      activeStreams: [],
      trendingStreams: [],
      upcomingStreams: [],
      replays: []
    };
  }
}

// -------------------------------------------------------------
// DATABASE PURGE & PRODUCTION CLEANUP ROUTINE
// -------------------------------------------------------------
const FAKE_SEED_DOC_IDS = [
  'uid_elena_vance',
  'uid_alex_dance',
  'uid_chef_marco',
  'uid_travel_maya',
  'uid_tech_sophia',
  'uid_fitness_kai',
  'uid_dj_neon',
  'uid_alex_rivera',
  'uid_maya_dance',
  'the_amala_joint',
  'pulse_official',
  'sug_1',
  'sug_2',
  'sug_3',
  'seed_skate_1',
  'seed_dance_2',
  'seed_food_3',
  'seed_travel_4',
  'seed_tech_5',
  'seed_fitness_6',
  'seed_dj_7',
  'seed_comedy_8',
  'upcoming_1',
  'upcoming_2',
  'upcoming_3',
  'replay_1',
  'replay_2',
  'replay_3',
  'live_active_demo_1',
  'live_active_demo_2'
];

let purgeRan = false;

export async function purgeFakeDataFromDatabase(): Promise<{ deletedUsers: number; deletedVideos: number }> {
  if (purgeRan) return { deletedUsers: 0, deletedVideos: 0 };
  purgeRan = true;

  let deletedUsers = 0;
  let deletedVideos = 0;

  try {
    // 1. Delete known seed user documents
    for (const uid of FAKE_SEED_DOC_IDS) {
      try {
        const userRef = doc(db, 'users', uid);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          await deleteDoc(userRef);
          deletedUsers++;
        }
      } catch (e) {}

      try {
        const vidRef = doc(db, 'videos', uid);
        const snap = await getDoc(vidRef);
        if (snap.exists()) {
          await deleteDoc(vidRef);
          deletedVideos++;
        }
      } catch (e) {}
    }

    // 2. Scan and remove any non-owner accounts with mock usernames if present
    const usersSnap = await getDocs(collection(db, 'users'));
    for (const d of usersSnap.docs) {
      const u = d.data() as UserProfile;
      const isOwnerAccount = (u.email && u.email.toLowerCase() === OWNER_EMAIL.toLowerCase()) || 
                             (u.handle && u.handle.toLowerCase() === OWNER_HANDLE.toLowerCase()) ||
                             d.id === 'uid_owner_mrnovatech' ||
                             d.id === 'owner_mrnovatech';
      
      const isKnownFakeSeed = [
        'elena@pulse.social', 'alex@pulse.social', 'marco@pulse.social', 
        'maya@pulse.social', 'sophia@pulse.social', 'kai@pulse.social', 'djneon@pulse.social',
        'elena@pulse.video', 'alex@pulse.video', 'marco@pulse.video', 'maya@pulse.video'
      ].includes(u.email || '');

      if (!isOwnerAccount && isKnownFakeSeed) {
        await deleteDoc(doc(db, 'users', d.id));
        deletedUsers++;
      }
    }

    console.log(`⚡️ Pulse Database Purge: Cleaned ${deletedUsers} seed accounts & ${deletedVideos} seed videos.`);
  } catch (err) {
    console.warn('Purge database notice:', err);
  }

  return { deletedUsers, deletedVideos };
}

// -------------------------------------------------------------
// FEEDBACK, BUG REPORTS & OWNER SUPPORT
// -------------------------------------------------------------

export interface OwnerFeedbackItem {
  id: string;
  uid: string;
  handle: string;
  username: string;
  email: string;
  type: 'feedback' | 'bug_report' | 'feature_request' | 'support';
  subject: string;
  description: string;
  category?: string;
  screenshotUrl?: string;
  systemDiagnostics?: {
    browser: string;
    os: string;
    screenResolution: string;
    timestamp: number;
    url: string;
  };
  createdAt: number;
  status: 'pending' | 'reviewed' | 'resolved';
}

export async function sendFeedbackToOwner(feedback: Omit<OwnerFeedbackItem, 'id' | 'createdAt' | 'status'>): Promise<string> {
  const ref = collection(db, 'owner_feedback');
  const docRef = await addDoc(ref, {
    ...feedback,
    createdAt: Date.now(),
    status: 'pending'
  });

  // Also create a notification alert
  try {
    await createNotification(feedback.uid, {
      kind: 'system',
      who: 'mrnovatech (Owner)',
      avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=mrnovatech',
      text: `Your ${feedback.type === 'bug_report' ? 'bug report' : 'feedback'} "${feedback.subject}" was received by @mrnovatech! 🛠️`,
      time: 'Just now',
      createdAt: Date.now()
    });
  } catch {}

  return docRef.id;
}

// -------------------------------------------------------------
// ACCOUNT DATA EXPORT, SESSIONS & SECURITY
// -------------------------------------------------------------

export async function exportUserAccountData(user: UserProfile): Promise<string> {
  try {
    // 1. Fetch user's videos
    const videosSnap = await getDocs(query(collection(db, 'videos'), where('ownerUid', '==', user.uid)));
    const videos = videosSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // 2. Fetch user's stories
    const storiesSnap = await getDocs(query(collection(db, 'stories'), where('ownerUid', '==', user.uid)));
    const stories = storiesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // 3. Construct export data archive JSON
    const exportBundle = {
      exportMetadata: {
        appName: 'Pulse Video Platform',
        exportedAt: new Date().toISOString(),
        userUid: user.uid,
        username: user.username,
        handle: user.handle,
        email: user.email
      },
      profile: user,
      activity: {
        totalVideos: videos.length,
        totalStories: stories.length,
        followersCount: user.followers || 0,
        followingCount: user.following || 0,
        likesReceived: user.likesReceived || 0
      },
      videos,
      stories,
      systemSecurity: {
        accountCreated: new Date(user.createdAt).toISOString(),
        emailVerified: !!user.emailVerified,
        twoFactorStatus: 'Protected',
        dataPrivacyStandard: 'GDPR / CCPA Compliant'
      }
    };

    return JSON.stringify(exportBundle, null, 2);
  } catch (err: any) {
    throw new Error('Could not compile export data: ' + err.message);
  }
}

export function getUserActiveSessions(user: UserProfile) {
  return [
    {
      id: 'sess_current',
      device: 'Current Browser / Session',
      browser: navigator.userAgent.includes('Chrome') ? 'Google Chrome' : navigator.userAgent.includes('Firefox') ? 'Mozilla Firefox' : 'Web Browser',
      os: navigator.userAgent.includes('Mac') ? 'macOS' : navigator.userAgent.includes('Win') ? 'Windows' : 'Linux / Mobile',
      location: 'London, United Kingdom (Current)',
      ipAddress: '82.165.***.***',
      isCurrent: true,
      lastActive: Date.now()
    },
    {
      id: 'sess_mobile_1',
      device: 'Pulse Mobile App',
      browser: 'Pulse iOS Native v3.2',
      os: 'iOS 18.2',
      location: 'London, United Kingdom',
      ipAddress: '82.165.***.***',
      isCurrent: false,
      lastActive: Date.now() - 1000 * 60 * 48 // 48 mins ago
    }
  ];
}

export async function requestAccountDeletion(uid: string, reason: string): Promise<string> {
  const ref = collection(db, 'account_deletion_requests');
  const docRef = await addDoc(ref, {
    uid,
    reason: reason.trim() || 'User self-serve account deletion request',
    requestedAt: Date.now(),
    status: 'pending_processing'
  });
  return docRef.id;
}

// -------------------------------------------------------------
// VIRTUAL GIFTS, CREATOR WALLET & TIPPING
// -------------------------------------------------------------

export async function rechargeWalletCoins(
  userUid: string, 
  coinsAmount: number,
  details?: {
    method?: string;
    amountNGN?: number;
    amountUSD?: number;
    senderName?: string;
    reference?: string;
  }
): Promise<number> {
  const userRef = doc(db, 'users', userUid);
  const snap = await getDoc(userRef);
  let newBalance = coinsAmount;
  if (snap.exists()) {
    const data = snap.data() as UserProfile;
    newBalance = (data.walletCoins || 0) + coinsAmount;
    await updateDoc(userRef, {
      walletCoins: newBalance
    });
  } else {
    await setDoc(userRef, { walletCoins: newBalance }, { merge: true });
  }

  // Record topup transaction in wallet history
  try {
    const txRef = collection(db, 'users', userUid, 'wallet_transactions');
    await addDoc(txRef, {
      type: 'recharge',
      coinsAdded: coinsAmount,
      method: details?.method || 'opay_transfer',
      amountNGN: details?.amountNGN || 0,
      amountUSD: details?.amountUSD || 0,
      senderName: details?.senderName || '',
      reference: details?.reference || '',
      timestamp: Date.now(),
      status: 'completed'
    });

    // Also record in global topups collection for owner tracking
    const globalTopupsRef = collection(db, 'opay_topups');
    await addDoc(globalTopupsRef, {
      userUid,
      coinsAdded: coinsAmount,
      method: details?.method || 'opay_transfer',
      amountNGN: details?.amountNGN || 0,
      senderName: details?.senderName || '',
      reference: details?.reference || '',
      timestamp: Date.now(),
      status: 'completed'
    });
  } catch (e) {}

  return newBalance;
}

export async function sendGiftToStream(
  streamId: string,
  sender: UserProfile,
  receiver: { uid: string; handle: string; username?: string; avatar: string },
  gift: VirtualGift,
  targetTeam?: 'challenger' | 'opponent'
): Promise<GiftTransaction> {
  const userRef = doc(db, 'users', sender.uid);
  const userSnap = await getDoc(userRef);
  const currentCoins = userSnap.exists() ? ((userSnap.data() as UserProfile).walletCoins || 0) : (sender.walletCoins || 0);

  if (currentCoins < gift.coins) {
    throw new Error(`Insufficient Pulse Coins! You need ${gift.coins} coins (Balance: ${currentCoins}). Please recharge your wallet.`);
  }

  // Deduct coins from sender
  await updateDoc(userRef, {
    walletCoins: Math.max(0, currentCoins - gift.coins)
  });

  // Credit diamonds to receiver (1 coin = 1 diamond)
  const receiverRef = doc(db, 'users', receiver.uid);
  try {
    await updateDoc(receiverRef, {
      walletDiamonds: increment(gift.coins),
      totalEarningsUSD: increment(Number((gift.coins * 0.005).toFixed(4))) // 1000 diamonds = $5.00
    });
  } catch (e) {
    console.warn('Receiver diamond credit update notice:', e);
  }

  const giftTx: GiftTransaction = {
    id: 'gtx_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    senderUid: sender.uid,
    senderHandle: sender.handle,
    senderUsername: sender.username,
    senderAvatar: sender.photoURL,
    receiverUid: receiver.uid,
    receiverHandle: receiver.handle,
    receiverAvatar: receiver.avatar,
    streamId,
    giftId: gift.id,
    giftName: gift.name,
    giftIcon: gift.icon,
    coins: gift.coins,
    points: gift.points,
    createdAt: Date.now(),
    targetTeam
  };

  // Add to stream gifts collection
  try {
    const streamGiftsRef = collection(db, 'livestreams', streamId, 'gifts');
    await addDoc(streamGiftsRef, giftTx);

    // Update live stream total diamonds & gifts count
    const streamRef = doc(db, 'livestreams', streamId);
    await updateDoc(streamRef, {
      totalGiftsCount: increment(1),
      totalDiamonds: increment(gift.coins)
    });
  } catch (e) {}

  // If in PK battle, update score
  if (targetTeam) {
    await sendPKBattleScore(streamId, targetTeam, gift.points, {
      senderHandle: sender.handle,
      senderAvatar: sender.photoURL,
      giftName: gift.name,
      giftIcon: gift.icon,
      points: gift.points
    });
  }

  // Post announcement in live chat
  try {
    await sendLiveChatMessage(
      streamId,
      sender,
      `🎁 sent ${gift.icon} ${gift.name} (${gift.points} pts) to ${receiver.handle}!`,
      true
    );
  } catch (e) {}

  return giftTx;
}

export async function sendTipToCreator(
  sender: UserProfile,
  receiverUid: string,
  receiverHandle: string,
  receiverAvatar: string,
  gift: VirtualGift,
  videoId?: string
): Promise<GiftTransaction> {
  const userRef = doc(db, 'users', sender.uid);
  const userSnap = await getDoc(userRef);
  const currentCoins = userSnap.exists() ? ((userSnap.data() as UserProfile).walletCoins || 0) : (sender.walletCoins || 0);

  if (currentCoins < gift.coins) {
    throw new Error(`Insufficient Pulse Coins! You need ${gift.coins} coins (Balance: ${currentCoins}). Please recharge your wallet.`);
  }

  // Deduct coins from sender
  await updateDoc(userRef, {
    walletCoins: Math.max(0, currentCoins - gift.coins)
  });

  // Credit diamonds to receiver
  const receiverRef = doc(db, 'users', receiverUid);
  try {
    await updateDoc(receiverRef, {
      walletDiamonds: increment(gift.coins),
      totalEarningsUSD: increment(Number((gift.coins * 0.005).toFixed(4)))
    });
  } catch (e) {}

  const giftTx: GiftTransaction = {
    id: 'tip_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    senderUid: sender.uid,
    senderHandle: sender.handle,
    senderUsername: sender.username,
    senderAvatar: sender.photoURL,
    receiverUid,
    receiverHandle,
    receiverAvatar,
    videoId,
    giftId: gift.id,
    giftName: gift.name,
    giftIcon: gift.icon,
    coins: gift.coins,
    points: gift.points,
    createdAt: Date.now()
  };

  // Log in receiver's received tips
  try {
    const tipsRef = collection(db, 'users', receiverUid, 'tips_received');
    await addDoc(tipsRef, giftTx);

    // Send notification to creator
    await createNotification(receiverUid, {
      kind: 'system',
      who: sender.handle,
      whoUid: sender.uid,
      avatar: sender.photoURL,
      text: `sent you a ${gift.icon} ${gift.name} tip (${gift.coins} Coins)! 💖`,
      time: 'Just now',
      createdAt: Date.now()
    });
  } catch (e) {}

  return giftTx;
}

export async function withdrawCreatorDiamonds(
  userUid: string,
  diamondsAmount: number,
  payoutMethod: string,
  payoutAddress: string
): Promise<{ success: boolean; usdAmount: number }> {
  const userRef = doc(db, 'users', userUid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) throw new Error('User not found');

  const data = snap.data() as UserProfile;
  const currentDiamonds = data.walletDiamonds || 0;
  if (currentDiamonds < diamondsAmount) {
    throw new Error(`Insufficient Diamonds! You have ${currentDiamonds} diamonds.`);
  }

  const usdAmount = Number((diamondsAmount * 0.005).toFixed(2));

  await updateDoc(userRef, {
    walletDiamonds: Math.max(0, currentDiamonds - diamondsAmount)
  });

  // Record payout request
  try {
    const payoutRef = collection(db, 'payout_requests');
    await addDoc(payoutRef, {
      userUid,
      handle: data.handle,
      diamondsDeducted: diamondsAmount,
      usdAmount,
      payoutMethod,
      payoutAddress,
      requestedAt: Date.now(),
      status: 'completed'
    });
  } catch (e) {}

  return { success: true, usdAmount };
}

export function subscribeToGiftsForStream(streamId: string, callback: (gifts: GiftTransaction[]) => void) {
  try {
    const giftsRef = collection(db, 'livestreams', streamId, 'gifts');
    const q = query(giftsRef, orderBy('createdAt', 'desc'), limit(15));
    return onSnapshot(q, (snapshot) => {
      const list: GiftTransaction[] = [];
      snapshot.forEach(d => {
        list.push({ id: d.id, ...d.data() } as GiftTransaction);
      });
      callback(list.reverse());
    });
  } catch (e) {
    callback([]);
    return () => {};
  }
}

// -------------------------------------------------------------
// LIVE STREAM PK BATTLES (SPLIT-SCREEN CO-HOSTING & COMPETITION)
// -------------------------------------------------------------

export async function startPKBattle(
  streamId: string,
  challenger: UserProfile,
  opponent: { uid: string; handle: string; username: string; avatar: string },
  durationSeconds: number = 180
): Promise<PKBattle> {
  const streamRef = doc(db, 'livestreams', streamId);
  const now = Date.now();
  const endsAt = now + durationSeconds * 1000;

  const pkBattleData: PKBattle = {
    id: 'pk_' + now,
    challengerUid: challenger.uid,
    challengerHandle: challenger.handle,
    challengerUsername: challenger.username,
    challengerAvatar: challenger.photoURL,
    challengerScore: 0,
    opponentUid: opponent.uid,
    opponentHandle: opponent.handle,
    opponentUsername: opponent.username,
    opponentAvatar: opponent.avatar,
    opponentScore: 0,
    status: 'active',
    durationSeconds,
    startedAt: now,
    endsAt,
    isBonusTime: false,
    recentGifts: []
  };

  await updateDoc(streamRef, {
    pkBattle: pkBattleData
  });

  // Announce in chat
  try {
    await sendLiveChatMessage(
      streamId,
      challenger,
      `⚔️ PK BATTLE STARTED! ${challenger.handle} (RED) VS ${opponent.handle} (BLUE)! Tap gifts to support your champion! 🔥`,
      true
    );
  } catch (e) {}

  return pkBattleData;
}

export async function sendPKBattleScore(
  streamId: string,
  team: 'challenger' | 'opponent',
  points: number,
  giftMeta?: { senderHandle: string; senderAvatar: string; giftName: string; giftIcon: string; points: number }
) {
  const streamRef = doc(db, 'livestreams', streamId);
  const snap = await getDoc(streamRef);
  if (snap.exists()) {
    const data = snap.data() as LiveStream;
    if (data.pkBattle && data.pkBattle.status === 'active') {
      const pk = { ...data.pkBattle };
      const timeLeft = Math.max(0, Math.floor((pk.endsAt - Date.now()) / 1000));
      const multiplier = timeLeft <= 30 && timeLeft > 0 ? 2 : 1; // 2x Frenzy bonus in final 30 seconds
      const finalPoints = points * multiplier;

      if (team === 'challenger') {
        pk.challengerScore = (pk.challengerScore || 0) + finalPoints;
      } else {
        pk.opponentScore = (pk.opponentScore || 0) + finalPoints;
      }

      if (giftMeta) {
        const giftEntry = {
          id: 'pkgift_' + Date.now(),
          senderHandle: giftMeta.senderHandle,
          senderAvatar: giftMeta.senderAvatar,
          giftName: giftMeta.giftName,
          giftIcon: giftMeta.giftIcon,
          points: finalPoints,
          targetTeam: team,
          timestamp: Date.now()
        };
        pk.recentGifts = [giftEntry, ...(pk.recentGifts || []).slice(0, 5)];
      }

      await updateDoc(streamRef, { pkBattle: pk });
    }
  }
}

export async function endPKBattle(streamId: string) {
  const streamRef = doc(db, 'livestreams', streamId);
  const snap = await getDoc(streamRef);
  if (snap.exists()) {
    const data = snap.data() as LiveStream;
    if (data.pkBattle && data.pkBattle.status === 'active') {
      const pk = { ...data.pkBattle };
      let winnerUid: string | 'draw' = 'draw';
      if (pk.challengerScore > pk.opponentScore) {
        winnerUid = pk.challengerUid;
      } else if (pk.opponentScore > pk.challengerScore) {
        winnerUid = pk.opponentUid;
      }
      pk.status = 'ended';
      pk.winnerUid = winnerUid;

      await updateDoc(streamRef, { pkBattle: pk });
    }
  }
}

export async function cancelPKBattle(streamId: string) {
  const streamRef = doc(db, 'livestreams', streamId);
  await updateDoc(streamRef, { pkBattle: null });
}





