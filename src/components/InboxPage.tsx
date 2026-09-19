import React, { useState, useEffect } from 'react';
import { NotificationItem, UserProfile } from '../types';
import { 
  subscribeToNotifications, 
  toggleFollowUser, 
  markNotificationsAsRead, 
  getSuggestedUsers, 
  subscribeToUserChats,
  checkIsFollowing,
  markChatAsRead
} from '../services/pulseDb';
import { 
  ArrowLeft, 
  Heart, 
  MessageCircle, 
  UserPlus, 
  Bell, 
  ShieldAlert, 
  CheckCheck, 
  ChevronRight,
  Info,
  Check,
  Plus,
  X,
  Send,
  UserCheck,
  Sparkles
} from 'lucide-react';
import { VerifiedBadge } from './VerifiedBadge';

interface InboxPageProps {
  isOpen: boolean;
  currentUser: UserProfile;
  onClose: () => void;
  onSelectUser: (handle: string, uid: string) => void;
  onOpenChat?: (user: { uid: string; handle: string; username: string; avatar: string; verified?: boolean }) => void;
  onOpenFollowList?: (mode: 'followers' | 'following' | 'requests', uid: string) => void;
  onOpenGroupChats?: () => void;
  onToast: (msg: string) => void;
}

interface ChatSnippet {
  uid: string;
  handle: string;
  username: string;
  avatar: string;
  lastMessage: string;
  time: string;
  unreadCount: number;
  online: boolean;
  isBot?: boolean;
  verified?: boolean;
}

export const InboxPage: React.FC<InboxPageProps> = ({
  isOpen,
  currentUser,
  onClose,
  onSelectUser,
  onOpenChat,
  onOpenFollowList,
  onToast
}) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [tab, setTab] = useState<'chats' | 'notifications'>('chats');
  const [showReports, setShowReports] = useState(false);
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});
  const [suggestedCreators, setSuggestedCreators] = useState<UserProfile[]>([]);
  const [appealText, setAppealText] = useState('');
  const [appealSent, setAppealSent] = useState(false);

  const [chatThreads, setChatThreads] = useState<ChatSnippet[]>([]);

  useEffect(() => {
    if (!isOpen || !currentUser) return;

    const unsubscribeNotifs = subscribeToNotifications(currentUser.uid, (items) => {
      setNotifications(items);
    });

    const unsubscribeChats = subscribeToUserChats(currentUser.uid, (loadedChats) => {
      setChatThreads(loadedChats || []);
    });

    getSuggestedUsers(currentUser.uid).then(creators => {
      if (creators && creators.length > 0) {
        setSuggestedCreators(creators.filter(c => c.uid !== currentUser.uid).slice(0, 8));
      } else {
        setSuggestedCreators([]);
      }
    }).catch(() => {});

    return () => {
      unsubscribeNotifs();
      unsubscribeChats();
    };
  }, [isOpen, currentUser?.uid]);

  if (!isOpen) return null;

  const handleMarkAllRead = async () => {
    try {
      await markNotificationsAsRead(currentUser.uid);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      onToast('All notifications marked as read');
    } catch (e) {}
  };

  const handleToggleFollow = async (whoUid: string, handle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const isNowFollowing = !followingMap[whoUid];
    setFollowingMap(prev => ({ ...prev, [whoUid]: isNowFollowing }));
    try {
      await toggleFollowUser(currentUser.uid, whoUid, currentUser);
      onToast(isNowFollowing ? `Following ${handle}` : `Unfollowed ${handle}`);
    } catch (err: any) {
      setFollowingMap(prev => ({ ...prev, [whoUid]: !isNowFollowing }));
      onToast(err?.message === 'blocked' ? "You can't follow this user" : 'Something went wrong — try again');
    }
  };

  const handleStartChat = async (user: { chatId?: string; uid: string; handle: string; username: string; avatar: string; verified?: boolean }) => {
    if (user.chatId && currentUser?.uid) {
      markChatAsRead(user.chatId, currentUser.uid);
    }
    if (onOpenChat) {
      onOpenChat(user);
    } else {
      onSelectUser(user.handle, user.uid);
    }
  };

  const handleDismissSuggested = (uid: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSuggestedCreators(prev => prev.filter(c => c.uid !== uid));
  };

  const handleSendAppeal = () => {
    if (!appealText.trim()) {
      onToast('Please write your appeal or inquiry');
      return;
    }
    setAppealSent(true);
    onToast('Appeal submitted to Trust & Safety Team ✅');
    setAppealText('');
  };

  const unreadTotal = notifications.filter(n => !n.read).length;
  const unreadChats = chatThreads.reduce((acc, t) => acc + (t.unreadCount || 0), 0);

  const notifCopy = (n: NotificationItem): string => {
    switch (n.kind) {
      case 'follow': return 'started following you.';
      case 'like': return 'liked your post.';
      case 'comment': return `commented: "${n.text || ''}"`;
      case 'mention': return 'mentioned you in a comment.';
      case 'repost': return 'reposted your video.';
      case 'live': return 'started a live stream.';
      case 'admin': return n.text || 'Account update.';
      default: return n.text || 'interacted with you.';
    }
  };

  const notifActionLabel = (n: NotificationItem): string | null => {
    if (n.kind === 'follow') return followingMap[n.whoUid || ''] ? 'Following' : 'Follow back';
    if (n.kind === 'like' || n.kind === 'comment' || n.kind === 'mention' || n.kind === 'repost') return 'View';
    if (n.kind === 'live') return 'Watch';
    return null;
  };

  // REPORTS / SAFETY SCREEN
  if (showReports) {
    return (
      <div className="w-full h-full flex flex-col select-none overflow-hidden" style={{ background: 'var(--bg)' }}>
        <div className="px-header">
          <div className="flex items-center gap-2">
            <button onClick={() => setShowReports(false)} className="px-icon-btn">
              <ArrowLeft className="w-[18px] h-[18px]" />
            </button>
            <span style={{ fontSize: 17, fontWeight: 850, letterSpacing: '-.45px', color: 'var(--text)' }}>
              Reports &amp; Warnings
            </span>
          </div>
          <div />
        </div>

        <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
          <div className="p-3 rounded-2xl space-y-1.5" style={{ background: 'rgba(255,189,26,.07)', border: '1px solid rgba(255,189,26,.25)' }}>
            <div className="flex items-center gap-1.5" style={{ color: 'var(--yellow)' }}>
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <h4 className="text-[13px] font-bold">Account Health &amp; Trust Status</h4>
            </div>
            <p className="text-[12px] leading-snug" style={{ color: 'var(--soft)' }}>
              {currentUser.warningMessage || 'No active strikes or restrictions on your account. All community guidelines are in good standing.'}
            </p>
          </div>

          <div className="p-3 rounded-2xl space-y-2.5" style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}>
            <h4 className="text-[13px] font-bold" style={{ color: 'var(--text)' }}>Submit Inquiry / Appeal to Safety Team</h4>
            <textarea
              value={appealText}
              onChange={(e) => setAppealText(e.target.value)}
              rows={3}
              placeholder="If your account received a warning or restriction, explain the situation here..."
              className="w-full rounded-xl p-2.5 text-[12px] resize-none focus:outline-none"
              style={{ background: 'var(--bg2)', border: '1px solid var(--line)', color: 'var(--text)' }}
            />
            <button
              onClick={handleSendAppeal}
              className="w-full h-10 rounded-xl text-[12px] font-bold flex items-center justify-center gap-1.5"
              style={{ background: 'var(--white)', color: 'var(--black)' }}
            >
              <Send className="w-3.5 h-3.5" /> Submit Appeal
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col select-none overflow-hidden font-sans" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      {/* HEADER */}
      <div className="px-header">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onOpenFollowList?.('followers', currentUser.uid)}
            className="px-icon-btn"
            title="Add contacts / friends"
          >
            <UserPlus className="w-[18px] h-[18px]" />
          </button>
        </div>

        <span style={{ fontSize: 17, fontWeight: 850, letterSpacing: '-.45px' }}>Inbox</span>

        <div className="flex items-center gap-1">
          {tab === 'notifications' && unreadTotal > 0 && (
            <button onClick={handleMarkAllRead} className="px-icon-btn" title="Mark all as read">
              <CheckCheck className="w-[18px] h-[18px]" />
            </button>
          )}
          {tab === 'chats' && (
            <button onClick={() => setShowReports(true)} className="px-icon-btn" title="Reports & Warnings">
              <ShieldAlert className="w-[18px] h-[18px]" />
            </button>
          )}
        </div>
      </div>

      {/* SEGMENT TABS */}
      <div className="px-3.5 pt-3 pb-2.5">
        <div className="px-segment">
          <button className={tab === 'chats' ? 'active' : ''} onClick={() => setTab('chats')}>
            Chats {unreadChats > 0 ? `· ${unreadChats}` : ''}
          </button>
          <button className={tab === 'notifications' ? 'active' : ''} onClick={() => setTab('notifications')}>
            Notifications {unreadTotal > 0 ? `· ${unreadTotal}` : ''}
          </button>
        </div>
      </div>

      {/* CHATS TAB */}
      {tab === 'chats' && (
        <div className="flex-1 overflow-y-auto">
          {chatThreads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mb-3" style={{ background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--muted)' }}>
                <MessageCircle className="w-6 h-6" strokeWidth={1.5} />
              </div>
              <p className="text-[13px] font-bold" style={{ color: 'var(--soft)' }}>No conversations yet</p>
              <p className="text-[11.5px] mt-1" style={{ color: 'var(--dim)' }}>Start a conversation with a creator below.</p>
            </div>
          ) : (
            chatThreads.map((t) => (
              <div
                key={t.uid}
                onClick={() => handleStartChat(t)}
                className={`px-conversation ${t.unreadCount > 0 ? 'unread' : ''}`}
              >
                <div className="px-conversation-avatar-wrap">
                  <img src={t.avatar} alt={t.username} className="px-conversation-avatar" loading="lazy" />
                  {t.online && <span className="px-online-dot" />}
                </div>
                <div className="px-conversation-main">
                  <div className="px-conversation-top">
                    <span className="px-conversation-name flex items-center gap-1 truncate">
                      {t.username}
                      {t.verified && <VerifiedBadge size="xs" />}
                    </span>
                    <span className="px-conversation-time">{t.time}</span>
                  </div>
                  <div className="px-conversation-bottom">
                    <span className="px-conversation-message">{t.lastMessage}</span>
                    {t.unreadCount > 0 ? (
                      <span className="px-unread-count">{t.unreadCount > 9 ? '9+' : t.unreadCount}</span>
                    ) : (
                      <span className="px-unread-dot" style={{ opacity: 0 }} />
                    )}
                  </div>
                </div>
              </div>
            ))
          )}

          {suggestedCreators.length > 0 && (
            <div className="mt-1 pb-4">
              <div className="px-section-label flex items-center gap-1">
                Suggested creators <Info className="w-3 h-3" />
              </div>
              {suggestedCreators.map((c) => (
                <div
                  key={c.uid}
                  onClick={() => onSelectUser(c.handle, c.uid)}
                  className="px-conversation"
                  style={{ minHeight: 62, borderBottom: '1px solid var(--line)' }}
                >
                  <img src={c.photoURL} alt={c.username} className="px-conversation-avatar" style={{ width: 42, height: 42 }} />
                  <div className="px-conversation-main">
                    <div className="px-conversation-name flex items-center gap-1 truncate">
                      {c.username}
                      {c.verified && <VerifiedBadge size="xs" />}
                    </div>
                    <div className="px-conversation-message" style={{ marginTop: 2 }}>{c.handle}</div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={(e) => handleToggleFollow(c.uid, c.handle, e)}
                      className={`px-notification-action ${followingMap[c.uid] ? 'following' : ''}`}
                    >
                      {followingMap[c.uid] ? 'Following' : 'Follow'}
                    </button>
                    <button onClick={(e) => handleDismissSuggested(c.uid, e)} className="px-icon-btn" style={{ width: 30, height: 30 }}>
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* NOTIFICATIONS TAB — unified Instagram-style feed */}
      {tab === 'notifications' && (
        <div className="flex-1 overflow-y-auto pb-6">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mb-3" style={{ background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--muted)' }}>
                <Bell className="w-6 h-6" strokeWidth={1.5} />
              </div>
              <p className="text-[13px] font-bold" style={{ color: 'var(--soft)' }}>Nothing here yet</p>
              <p className="text-[11.5px] mt-1" style={{ color: 'var(--dim)' }}>Follows, likes, comments and account updates will show up here.</p>
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className={`px-notification-row ${!n.read ? 'unread' : ''}`}
                onClick={() => n.kind !== 'admin' && onSelectUser(n.who, n.whoUid || '')}
                style={{ cursor: n.kind !== 'admin' ? 'pointer' : 'default' }}
              >
                {n.kind === 'admin' ? (
                  <div className="px-notification-icon" style={{ background: 'var(--yellow)' }}>
                    <Bell className="w-[18px] h-[18px]" />
                  </div>
                ) : n.kind === 'like' ? (
                  <div className="relative shrink-0">
                    <img src={n.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(n.whoUid || n.who)}`} alt={n.who} />
                    <span className="absolute -bottom-0.5 -right-0.5 w-[17px] h-[17px] rounded-full grid place-items-center" style={{ background: 'var(--red)', border: '2px solid var(--bg)' }}>
                      <Heart className="w-2.5 h-2.5 fill-white text-white" />
                    </span>
                  </div>
                ) : (
                  <img src={n.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(n.whoUid || n.who)}`} alt={n.who} />
                )}

                <div className="px-notification-main">
                  <div className="px-notification-text">
                    <b>{n.kind === 'admin' ? (n.who || 'Pulse') : n.who}</b> {notifCopy(n)}
                  </div>
                  <div className="px-notification-time">{n.time || 'recently'}</div>
                </div>

                {notifActionLabel(n) && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (n.kind === 'follow' && n.whoUid) handleToggleFollow(n.whoUid, n.who, e);
                      else onSelectUser(n.who, n.whoUid || '');
                    }}
                    className={`px-notification-action ${n.kind === 'follow' && followingMap[n.whoUid || ''] ? 'following' : ''}`}
                  >
                    {notifActionLabel(n)}
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
