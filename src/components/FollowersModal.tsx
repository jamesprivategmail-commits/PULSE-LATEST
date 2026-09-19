import React, { useState, useEffect } from 'react';
import { UserProfile, FollowRequestItem } from '../types';
import { 
  getFollowRequests, 
  handleFollowRequest, 
  toggleFollowUser, 
  checkIsFollowing 
} from '../services/pulseDb';
import { db, collection, getDocs, doc, getDoc } from '../firebase';
import { ArrowLeft, UserCheck, UserPlus, Users, Check, XCircle, Search } from 'lucide-react';
import { VerifiedBadge } from './VerifiedBadge';

interface FollowersModalProps {
  isOpen: boolean;
  mode: 'followers' | 'following' | 'requests';
  targetUid: string;
  currentUser: UserProfile;
  onClose: () => void;
  onOpenProfile: (handle: string, uid: string) => void;
  onToast: (msg: string) => void;
  onFollowToggle?: (targetUid: string, isFollowing: boolean) => void;
}

interface UserListItem {
  uid: string;
  username: string;
  handle: string;
  avatar: string;
  verified?: boolean;
  isFollowing?: boolean;
  isMutual?: boolean;
}

export const FollowersModal: React.FC<FollowersModalProps> = ({
  isOpen,
  mode: initialMode,
  targetUid,
  currentUser,
  onClose,
  onOpenProfile,
  onToast,
  onFollowToggle
}) => {
  const [mode, setMode] = useState<'followers' | 'following' | 'requests'>(initialMode);
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [requests, setRequests] = useState<FollowRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setLoading(true);

    async function loadData() {
      try {
        if (mode === 'requests') {
          const reqList = await getFollowRequests(currentUser.uid);
          if (isMounted) setRequests(reqList);
        } else {
          const collectionName = mode === 'followers' ? 'followers' : 'following';
          const snap = await getDocs(collection(db, 'follows', targetUid, collectionName));
          const list: UserListItem[] = [];

          for (const d of snap.docs) {
            const uid = d.id;
            try {
              const userDoc = await getDoc(doc(db, 'users', uid));
              if (userDoc.exists()) {
                const uData = userDoc.data() as UserProfile;
                let isFollowing = false;
                let isMutual = false;

                if (currentUser.uid !== uid) {
                  isFollowing = await checkIsFollowing(currentUser.uid, uid);
                  if (mode === 'followers') {
                    isMutual = isFollowing; // if they follow me and I follow them
                  }
                }

                list.push({
                  uid,
                  username: uData.username || 'Creator',
                  handle: uData.handle || `@user_${uid.slice(0, 5)}`,
                  avatar: uData.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${uid}`,
                  verified: uData.verified,
                  isFollowing,
                  isMutual
                });
              }
            } catch (e) {}
          }

          if (isMounted) setUsers(list);
        }
      } catch (err) {
        console.warn('Error loading follow list:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [isOpen, mode, targetUid, currentUser.uid]);

  if (!isOpen) return null;

  const handleToggleFollow = async (item: UserListItem) => {
    const nextState = !item.isFollowing;
    setUsers(prev =>
      prev.map(u => (u.uid === item.uid ? { ...u, isFollowing: nextState } : u))
    );
    if (onFollowToggle) {
      onFollowToggle(item.uid, nextState);
    }
    try {
      await toggleFollowUser(currentUser.uid, item.uid, currentUser, item.handle);
      onToast(nextState ? `Followed ${item.handle}` : `Unfollowed ${item.handle}`);
    } catch (err: any) {
      setUsers(prev =>
        prev.map(u => (u.uid === item.uid ? { ...u, isFollowing: !nextState } : u))
      );
      if (onFollowToggle) {
        onFollowToggle(item.uid, !nextState);
      }
      onToast(err?.message === 'blocked' ? "You can't follow this user" : 'Something went wrong — try again');
    }
  };

  const handleRequestAction = async (req: FollowRequestItem, accept: boolean) => {
    try {
      await handleFollowRequest(req, accept, currentUser);
      setRequests(prev => prev.filter(r => r.id !== req.id));
      onToast(accept ? `Accepted ${req.fromHandle}'s follow request` : 'Request declined');
    } catch (e) {
      onToast('Action failed');
    }
  };

  const filteredUsers = users.filter(
    u =>
      u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.handle.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 bg-black max-w-[480px] mx-auto flex flex-col animate-in fade-in select-none">
      <div className="flex-1 flex flex-col min-h-0">
        {/* Header Tabs */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10 shrink-0">
          <button
            onClick={onClose}
            className="p-1 text-white hover:text-neutral-300 cursor-pointer rounded-lg hover:bg-neutral-900 shrink-0"
          >
            <ArrowLeft className="w-4 h-4 stroke-[2.2]" />
          </button>
          <div className="flex items-center gap-1 flex-1 overflow-x-auto">
            <button
              onClick={() => setMode('followers')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                mode === 'followers' ? 'bg-[#25f4ee] text-black' : 'text-neutral-400 hover:text-white'
              }`}
            >
              Followers
            </button>
            <button
              onClick={() => setMode('following')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                mode === 'following' ? 'bg-[#25f4ee] text-black' : 'text-neutral-400 hover:text-white'
              }`}
            >
              Following
            </button>
            {targetUid === currentUser.uid && currentUser.isPrivate && (
              <button
                onClick={() => setMode('requests')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                  mode === 'requests' ? 'bg-[#ff2b54] text-white' : 'text-neutral-400 hover:text-white'
                }`}
              >
                Requests {requests.length > 0 && `(${requests.length})`}
              </button>
            )}
          </div>
        </div>

        {/* Search Bar */}
        {mode !== 'requests' && (
          <div className="p-3 border-b border-white/5 bg-[#17181c] shrink-0">
            <div className="flex items-center gap-2 bg-neutral-900 border border-white/10 rounded-xl px-3 py-1.5 text-xs">
              <Search className="w-3.5 h-3.5 text-neutral-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name or handle..."
                className="w-full bg-transparent text-white placeholder:text-neutral-500 focus:outline-none text-xs"
              />
            </div>
          </div>
        )}

        {/* Content List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-neutral-500 text-xs">
              <div className="w-5 h-5 border-2 border-[#25f4ee] border-t-transparent rounded-full animate-spin mb-2" />
              Loading {mode}...
            </div>
          ) : mode === 'requests' ? (
            requests.length === 0 ? (
              <div className="text-center py-16 text-neutral-500 text-xs">
                No pending follow requests.
              </div>
            ) : (
              requests.map((req) => (
                <div
                  key={req.id}
                  className="flex items-center justify-between p-3 bg-neutral-900 border border-white/10 rounded-xl"
                >
                  <div
                    onClick={() => {
                      onClose();
                      onOpenProfile(req.fromHandle, req.fromUid);
                    }}
                    className="flex items-center gap-2.5 cursor-pointer min-w-0"
                  >
                    <img
                      src={req.fromAvatar}
                      alt={req.fromUsername}
                      className="w-10 h-10 rounded-full object-cover border border-white/10 shrink-0"
                    />
                    <div className="truncate">
                      <b className="text-xs text-white block truncate">{req.fromUsername}</b>
                      <span className="text-[11px] text-neutral-400 font-mono block">{req.fromHandle}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleRequestAction(req, true)}
                      className="p-1.5 bg-[#25f4ee] hover:bg-[#1ee0da] text-black font-extrabold rounded-lg text-xs cursor-pointer shadow flex items-center gap-1"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleRequestAction(req, false)}
                      className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-xs cursor-pointer"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-16 text-neutral-500 text-xs">
              No {mode} found.
            </div>
          ) : (
            filteredUsers.map((user) => (
              <div
                key={user.uid}
                className="flex items-center justify-between p-2.5 bg-neutral-900/90 border border-white/10 rounded-xl hover:border-white/20 transition-all"
              >
                <div
                  onClick={() => {
                    onClose();
                    onOpenProfile(user.handle, user.uid);
                  }}
                  className="flex items-center gap-2.5 cursor-pointer min-w-0 flex-1 mr-2"
                >
                  <img
                    src={user.avatar}
                    alt={user.username}
                    className="w-10 h-10 rounded-full object-cover border border-white/10 shrink-0"
                  />
                  <div className="truncate min-w-0">
                    <div className="flex items-center gap-1">
                      <b className="text-xs text-white truncate">{user.username}</b>
                      {user.verified && <VerifiedBadge size="xs" />}
                      {user.isMutual && (
                        <span className="text-[9px] font-bold bg-[#ff2b54]/20 text-[#ff2b54] px-1.5 py-0.2 rounded-full">
                          Friends
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-neutral-400 font-mono block truncate">{user.handle}</span>
                  </div>
                </div>

                {user.uid !== currentUser.uid && (
                  <button
                    onClick={() => handleToggleFollow(user)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 ${
                      user.isFollowing
                        ? 'bg-neutral-800 text-neutral-300 hover:bg-red-950/40 hover:text-red-400 border border-white/10'
                        : 'bg-[#25f4ee] hover:bg-[#1ee0da] text-black shadow'
                    }`}
                  >
                    {user.isFollowing ? 'Following' : 'Follow'}
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
