export interface UserProfile {
  uid: string;
  username: string;
  handle: string;
  email: string;
  photoURL: string;
  bio: string;
  followers: number;
  following: number;
  likesReceived?: number;
  createdAt: number;
  emailVerified?: boolean;
  verified?: boolean;
  banned?: boolean;
  banReason?: string;
  bannedAt?: number;
  suspendedUntil?: number; // For temporary suspension countdown
  warningMessage?: string; // Moderation warning banner
  warningHistory?: AccountWarning[];
  verificationStatus?: 'unverified' | 'pending' | 'verified' | 'rejected';
  role?: 'admin' | 'user';
  isPrivate?: boolean; // Private account
  websiteLink?: string; // Profile links
  instagramLink?: string;
  youtubeLink?: string;
  blockedUids?: string[];
  pinnedVideoIds?: string[];
  archivedVideoIds?: string[];
  closeFriends?: string[];
  isOnline?: boolean;
  lastActive?: number;
  profileViews?: number;
  walletCoins?: number;
  walletDiamonds?: number;
  totalEarningsUSD?: number;
}

export interface VirtualGift {
  id: string;
  name: string;
  icon: string;
  coins: number;
  points: number;
  animationType: 'pop' | 'float' | 'rocket' | 'crown' | 'galaxy' | 'lion' | 'fireworks';
  color: string;
  tier: 'common' | 'rare' | 'epic' | 'legendary';
}

export interface GiftTransaction {
  id: string;
  senderUid: string;
  senderHandle: string;
  senderUsername: string;
  senderAvatar: string;
  receiverUid: string;
  receiverHandle: string;
  receiverAvatar: string;
  streamId?: string;
  videoId?: string;
  giftId: string;
  giftName: string;
  giftIcon: string;
  coins: number;
  points: number;
  createdAt: number;
  targetTeam?: 'challenger' | 'opponent';
}

export interface PKBattle {
  id: string;
  challengerUid: string;
  challengerHandle: string;
  challengerUsername: string;
  challengerAvatar: string;
  challengerScore: number;
  opponentUid: string;
  opponentHandle: string;
  opponentUsername: string;
  opponentAvatar: string;
  opponentScore: number;
  status: 'inviting' | 'active' | 'ended';
  durationSeconds: number;
  startedAt: number;
  endsAt: number;
  winnerUid?: string | 'draw';
  isBonusTime?: boolean;
  recentGifts?: {
    id: string;
    senderHandle: string;
    senderAvatar: string;
    giftName: string;
    giftIcon: string;
    points: number;
    targetTeam: 'challenger' | 'opponent';
    timestamp: number;
  }[];
}

export interface VipRewardDrop {
  id: string;
  title: string;
  description: string;
  icon: string;
  type: 'badge' | 'theme' | 'cosmetic' | 'xp' | 'coins';
  amount?: number;
  claimed?: boolean;
  unlockedAt: number;
}

export interface AccountWarning {
  id: string;
  reason: string;
  issuedAt: number;
  adminNote?: string;
  severity?: 'low' | 'medium' | 'high';
}

export interface VideoPost {
  id: string;
  src: string;
  mediaType?: 'video' | 'image' | 'carousel';
  images?: string[];
  caption: string;
  sound: string;
  soundTitle?: string;
  ownerUid: string;
  ownerHandle: string;
  ownerUsername?: string;
  ownerAvatar: string;
  verified?: boolean;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  saveCount: number;
  repostCount?: number;
  views?: number;
  coverUrl?: string;
  tags: string[];
  createdAt: number;
  isLiked?: boolean;
  isSaved?: boolean;
  isReposted?: boolean;
  filter?: string;
  textOverlay?: {
    text: string;
    color: string;
    fontSize: number;
    position: 'top' | 'center' | 'bottom';
  };
  voiceoverSrc?: string;
  musicVolume?: number;
  originalVolume?: number;
  visibility?: 'public' | 'friends' | 'private';
  allowComments?: boolean;
  scheduledAt?: number;
  playlistId?: string;
  playlistTitle?: string;
  isPinned?: boolean;
  isArchived?: boolean;
  category?: string;
  avgWatchTimeSeconds?: number;
  completionRatePercent?: number;
}

export interface StoryItem {
  id: string;
  ownerUid: string;
  ownerHandle: string;
  ownerUsername: string;
  ownerAvatar: string;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  caption?: string;
  createdAt: number;
  expiresAt: number;
  viewsCount?: number;
  viewers?: { uid: string; handle: string; avatar: string; viewedAt: number }[];
  privacy?: 'everyone' | 'friends' | 'close_friends';
  isArchived?: boolean;
  reactions?: { emoji: string; uid: string; handle: string }[];
}

export interface StoryHighlight {
  id: string;
  ownerUid: string;
  title: string;
  coverUrl: string;
  storyIds: string[];
  createdAt: number;
}

export interface Playlist {
  id: string;
  ownerUid: string;
  title: string;
  description?: string;
  videoIds: string[];
  createdAt: number;
  updatedAt: number;
}

export interface LivePoll {
  id: string;
  question: string;
  options: { text: string; votes: number }[];
  voterUids: { [uid: string]: number }; // uid -> option index
  createdAt: number;
  isActive: boolean;
}

export interface LiveQnAItem {
  id: string;
  uid: string;
  handle: string;
  avatar: string;
  question: string;
  createdAt: number;
  isAnswered: boolean;
  isPinned?: boolean;
}

export interface LiveGuest {
  uid: string;
  handle: string;
  username: string;
  avatar: string;
  cameraOn?: boolean;
  micOn?: boolean;
  role: 'co-host' | 'guest';
}

export interface LiveStream {
  id: string;
  hostUid: string;
  hostHandle: string;
  hostUsername: string;
  hostAvatar: string;
  title: string;
  topic?: string;
  category?: string; // Gaming, Music, Dance, Comedy, Beauty, Tech, Food, Chat
  viewerCount: number;
  heartsCount: number;
  status: 'live' | 'ended';
  startedAt: number;
  endedAt?: number;
  isTrending?: boolean;
  guests?: LiveGuest[];
  guestRequests?: { uid: string; handle: string; avatar: string; username: string }[];
  pinnedMessage?: LiveChatMessage | null;
  activePoll?: LivePoll | null;
  moderatorUids?: string[];
  mutedUids?: string[];
  kickedUids?: string[];
  blockedUids?: string[];
  replayVideoUrl?: string;
  durationSeconds?: number;
  pkBattle?: PKBattle | null;
  totalGiftsCount?: number;
  totalDiamonds?: number;
}

export interface LiveChatMessage {
  id: string;
  uid: string;
  handle: string;
  username: string;
  avatar: string;
  text: string;
  createdAt: number;
  isPinned?: boolean;
  isSystem?: boolean;
  isHost?: boolean;
  isMod?: boolean;
}

export interface LiveReplay {
  id: string;
  streamId: string;
  hostUid: string;
  hostHandle: string;
  hostUsername: string;
  hostAvatar: string;
  title: string;
  category: string;
  duration: string;
  peakViewers: number;
  totalHearts: number;
  videoUrl: string;
  createdAt: number;
}

export interface VideoDraft {
  id: string;
  src: string;
  caption: string;
  sound: string;
  tags: string[];
  coverUrl?: string;
  filter?: string;
  textOverlay?: any;
  updatedAt: number;
}

export interface ScheduledPost {
  id: string;
  ownerUid: string;
  videoData: {
    src: string;
    caption: string;
    sound: string;
    tags: string[];
    filter?: string;
    textOverlay?: any;
    visibility?: 'public' | 'friends' | 'private';
    allowComments?: boolean;
  };
  scheduledAt: number;
  createdAt: number;
  status: 'scheduled' | 'published' | 'cancelled';
}

export interface AppealItem {
  id: string;
  uid: string;
  username: string;
  handle: string;
  email: string;
  reason?: string;
  appealText: string;
  contactInfo?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: number;
  reviewedAt?: number;
  reviewedBy?: string;
  adminFeedback?: string;
}

export interface ReportItem {
  id: string;
  type: 'user' | 'video' | 'comment';
  targetId: string;
  targetHandle?: string;
  reason: string;
  details?: string;
  reporterUid: string;
  reporterHandle: string;
  createdAt: number;
  status: 'open' | 'resolved';
}

export interface FollowRequestItem {
  id: string;
  fromUid: string;
  fromHandle: string;
  fromUsername: string;
  fromAvatar: string;
  toUid: string;
  createdAt: number;
}

export interface AdminStats {
  totalUsers: number;
  totalVideos: number;
  totalLiveStreams?: number;
  totalStories?: number;
  totalComments?: number;
  bannedUsers: number;
  verifiedUsers: number;
  pendingAppeals: number;
  totalReports?: number;
  telegramBotActive: boolean;
  totalViews?: number;
}

export interface VideoComment {
  id: string;
  uid: string;
  who: string;
  avatar: string;
  txt: string;
  likes: number;
  createdAt: number;
  isPinned?: boolean;
  parentId?: string; // For replies
  replyToHandle?: string;
  likedBy?: string[];
}

export interface NotificationItem {
  id: string;
  kind: 'like' | 'comment' | 'follow' | 'mention' | 'system' | 'repost' | 'warning' | 'admin' | 'live' | 'appeal';
  who: string;
  whoUid?: string;
  avatar: string | null;
  text: string;
  time: string;
  createdAt: number;
  thumb?: string;
  following?: boolean;
  targetVideoId?: string;
  read?: boolean;
}

export interface FriendItem {
  uid: string;
  username: string;
  handle: string;
  label: string;
  avatar: string;
  following: boolean;
  isMutual?: boolean;
  isOnline?: boolean;
  lastActive?: number;
}

export interface CallSession {
  id: string;
  roomName: string;
  callerUid: string;
  callerHandle: string;
  callerUsername: string;
  callerAvatar: string;
  callerVerified?: boolean;
  recipientUid: string;
  recipientHandle: string;
  recipientUsername: string;
  recipientAvatar: string;
  recipientVerified?: boolean;
  callType: 'voice' | 'video';
  status: 'ringing' | 'accepted' | 'declined' | 'busy' | 'ended' | 'missed';
  startedAt: number;
  connectedAt?: number;
  endedAt?: number;
  durationSeconds?: number;
  endReason?: string;
}

export interface ChatMessage {
  id: string;
  senderUid: string;
  senderHandle: string;
  senderAvatar?: string;
  senderUsername?: string;
  text: string;
  createdAt: number;
  mediaUrl?: string;
  mediaType?: 'text' | 'voice' | 'gif' | 'image' | 'video_share' | 'story_reply' | 'call_log' | 'sticker';
  voiceDuration?: number;
  stickerEmoji?: string;
  callLog?: {
    callType: 'voice' | 'video';
    durationSeconds: number;
    status: 'ended' | 'missed' | 'declined';
  };
  gifUrl?: string;
  videoPreview?: {
    id: string;
    caption: string;
    coverUrl?: string;
    ownerHandle: string;
  };
  isForwarded?: boolean;
  isPinned?: boolean;
  deletedForEveryone?: boolean;
  replyTo?: {
    id: string;
    text: string;
    senderHandle: string;
  };
  reactions?: { [emoji: string]: string[] }; // emoji -> array of uids
  status?: 'sent' | 'delivered' | 'read';
  isEdited?: boolean;
  editedAt?: number;
  // Client-only fields for optimistic send (never read back from Firestore
  // as meaningful — clientId is persisted for de-dupe matching, pending/failed
  // are set locally in ChatPage and never written to the doc).
  clientId?: string;
  pending?: boolean;
  failed?: boolean;
}

export interface GroupChatMember {
  uid: string;
  handle: string;
  username: string;
  avatar: string;
  role: 'admin' | 'moderator' | 'member';
  joinedAt: number;
}

export interface GroupChat {
  id: string;
  name: string;
  photoUrl?: string;
  adminUid: string;
  memberUids: string[];
  members: { [uid: string]: GroupChatMember };
  lastMessage: string;
  lastUpdated: number;
  pinnedMessage?: ChatMessage | null;
  createdAt: number;
  isGroup: true;
}

export interface ChatConversation {
  id: string;
  participants: string[];
  otherUid: string;
  otherHandle: string;
  otherAvatar: string;
  lastMessage: string;
  lastUpdated: number;
  unreadCount?: number;
  isGroup?: boolean;
  groupName?: string;
  groupPhoto?: string;
}

export interface SearchResultItem {
  id: string;
  type: 'user' | 'tag' | 'sound' | 'video' | 'live';
  handle: string;
  label: string;
  avatar: string | null;
  title?: string;
  subtitle?: string;
  userHandle?: string;
  userAvatar?: string;
  userVerified?: boolean;
  followers?: number;
  likes?: number;
  videoData?: VideoPost;
  data?: any;
}

export interface PlatformAnnouncement {
  id: string;
  title: string;
  message: string;
  type: 'broadcast' | 'maintenance' | 'update' | 'event';
  isActive: boolean;
  createdAt: number;
  expiresAt?: number;
}
