import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { toggleFollowUser, getSuggestedCreators, checkIsFollowing } from '../services/pulseDb';
import { formatCount } from '../utils/formatters';
import { ArrowLeft, MessageSquare, UserPlus, Check } from 'lucide-react';
import { VerifiedBadge } from './VerifiedBadge';

interface FriendsPageProps {
  isOpen: boolean;
  currentUser: UserProfile;
  onClose: () => void;
  onSelectUser: (handle: string, uid: string) => void;
  onOpenChat: (user: { uid: string; handle: string; avatar: string }) => void;
  onToast: (msg: string) => void;
  onFollowToggle?: (targetUid: string, isFollowing: boolean) => void;
}

export const FriendsPage: React.FC<FriendsPageProps> = ({
  isOpen,
  currentUser,
  onClose,
  onSelectUser,
  onOpenChat,
  onToast,
  onFollowToggle
}) => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isOpen) return;

    async function loadCreators() {
      setIsLoading(true);
      try {
        const list = await getSuggestedCreators(currentUser?.uid);
        setUsers(list);

        // Check follow states for all users
        if (currentUser?.uid) {
          const followPromises = list.map(u => 
            checkIsFollowing(currentUser.uid, u.uid).then(isFol => ({ uid: u.uid, isFol }))
          );
          const results = await Promise.all(followPromises);
          const fMap: Record<string, boolean> = {};
          results.forEach(r => { fMap[r.uid] = r.isFol; });
          setFollowingMap(fMap);
        }
      } catch (err) {
        console.error('Load users error:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadCreators();
  }, [isOpen, currentUser?.uid]);

  if (!isOpen) return null;

  const handleToggleFollow = async (targetUid: string, handle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const isNowFollowing = !followingMap[targetUid];
    // Optimistic update, rolled back below if the toggle actually fails
    // (e.g. a block prevents the follow from going through).
    setFollowingMap(prev => ({ ...prev, [targetUid]: isNowFollowing }));
    if (onFollowToggle) {
      onFollowToggle(targetUid, isNowFollowing);
    }
    try {
      await toggleFollowUser(currentUser.uid, targetUid, currentUser, handle);
      onToast(isNowFollowing ? `You followed ${handle}` : `You unfollowed ${handle}`);
    } catch (err: any) {
      setFollowingMap(prev => ({ ...prev, [targetUid]: !isNowFollowing }));
      if (onFollowToggle) {
        onFollowToggle(targetUid, !isNowFollowing);
      }
      onToast(err?.message === 'blocked' ? "You can't follow this user" : 'Something went wrong — try again');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black max-w-[480px] mx-auto flex flex-col animate-in fade-in pb-16">
      {/* Header */}
      <div className="px-header">
        <button
          onClick={onClose}
          className="px-icon-btn"
          style={{ width: 34, height: 34 }}
        >
          <ArrowLeft className="w-[18px] h-[18px]" />
        </button>
        <span style={{ fontSize: 16, fontWeight: 850, letterSpacing: '-.4px' }}>Friends &amp; Creators</span>
        <div style={{ width: 34 }} />
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-black">
        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">
          Suggested Creators for you
        </span>

        {isLoading ? (
          <div className="text-center py-12 text-neutral-500 text-xs animate-pulse">
            Loading creators...
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-12 text-neutral-400 text-xs">
            No creators found.
          </div>
        ) : (
          <div className="space-y-1.5">
            {users.map((user) => (
              <div
                key={user.uid}
                onClick={() => onSelectUser(user.handle, user.uid)}
                className="flex items-center gap-2.5 p-2 bg-neutral-950 hover:bg-neutral-900 border border-white/10 rounded-lg cursor-pointer transition-colors"
              >
                <img
                  src={user.photoURL}
                  alt={user.handle}
                  className="w-9 h-9 rounded-full object-cover border border-white/10 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <b className="text-xs text-white truncate">{user.username || user.handle}</b>
                    {user.verified && <VerifiedBadge size="xs" />}
                  </div>
                  <span className="text-[10px] text-neutral-400 block truncate">
                    {user.handle} · {formatCount(user.followers || 0)} followers
                  </span>
                  {user.bio && (
                    <span className="text-[9.5px] text-neutral-500 block truncate mt-0.5">{user.bio}</span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenChat({ uid: user.uid, handle: user.handle, avatar: user.photoURL });
                    }}
                    className="w-7 h-7 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-white/10 flex items-center justify-center text-white cursor-pointer transition-colors"
                    title="Send message"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={(e) => handleToggleFollow(user.uid, user.handle, e)}
                    className={`text-[11px] px-2.5 py-1 rounded-lg font-bold border transition-all cursor-pointer ${
                      followingMap[user.uid]
                        ? 'bg-transparent text-white border-white/20'
                        : 'bg-[#ff2b54] text-white border-transparent hover:bg-[#ff1a47]'
                    }`}
                  >
                    {followingMap[user.uid] ? 'Following' : 'Follow'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
