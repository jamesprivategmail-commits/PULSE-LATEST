import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, ChatMessage } from '../types';
import { 
  getChatId, 
  subscribeToChatMessages, 
  sendChatMessage, 
  deleteChatMessage, 
  editChatMessage,
  reactToChatMessage,
  subscribeToUserProfile,
  markChatAsRead,
  subscribeToChatDoc,
  setTypingStatus,
  TYPING_STALE_MS,
  PRESENCE_STALE_MS
} from '../services/pulseDb';
import { formatRelativeTime } from '../utils/formatters';
import { VoiceNotePlayer } from './VoiceNotePlayer';
import { VoiceNoteRecorder } from './VoiceNoteRecorder';
import { 
  ArrowLeft, 
  Send, 
  Image as ImageIcon, 
  Trash2, 
  Smile, 
  Check, 
  CheckCheck,
  Clock3,
  AlertCircle,
  Mic,
  MicOff,
  Search,
  Pin,
  PinOff,
  Forward,
  Reply,
  Copy,
  Pencil,
  Palette,
  Volume2,
  BellOff,
  Bell,
  MoreVertical,
  X,
  Sparkles,
  Play,
  Pause,
  Phone,
  Video
} from 'lucide-react';
import { VerifiedBadge } from './VerifiedBadge';

interface ChatPageProps {
  isOpen: boolean;
  currentUser: UserProfile;
  recipient: {
    uid: string;
    handle: string;
    avatar: string;
    username?: string;
  } | null;
  onClose: () => void;
  onToast: (msg: string) => void;
  onOpenProfile?: (handle: string, uid: string) => void;
  onStartCall?: (recipient: { uid: string; handle: string; username?: string; avatar: string }, type: 'voice' | 'video') => void;
}

const EMOJI_REACTIONS = ['❤️', '🔥', '😂', '👏', '😮', '👍', '🙏', '🎉'];

const STICKERS = [
  '😂', '😍', '🥳', '😎', '🤩', '😭', '🙈', '🤡',
  '💀', '👀', '🥺', '😴', '🤝', '👑', '🔥', '💯',
  '🎉', '❤️', '💔', '👋', '🙏', '👏', '🤙', '✌️'
];

const CHAT_WALLPAPERS: Record<string, { name: string; bgClass: string; accentColor: string }> = {
  default: { name: 'Default Dark', bgClass: 'bg-[#121214]', accentColor: '#25f4ee' },
  cyber: { name: 'Cyber Neon', bgClass: 'bg-gradient-to-b from-[#0d1b2a] via-[#1b263b] to-[#0d1b2a]', accentColor: '#25f4ee' },
  sunset: { name: 'Sunset Glow', bgClass: 'bg-gradient-to-b from-[#2b1055] via-[#4a154b] to-[#1a0826]', accentColor: '#ff2b54' },
  midnight: { name: 'Midnight Obsidian', bgClass: 'bg-[#090a0f]', accentColor: '#a855f7' },
  matrix: { name: 'Matrix Emerald', bgClass: 'bg-gradient-to-b from-[#051d14] via-[#022c22] to-[#04120c]', accentColor: '#10b981' }
};

export const ChatPage: React.FC<ChatPageProps> = ({
  isOpen,
  currentUser,
  recipient,
  onClose,
  onToast,
  onOpenProfile,
  onStartCall
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [optimisticMessages, setOptimisticMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [activeReactionMsgId, setActiveReactionMsgId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
  const [actionSheetMsg, setActionSheetMsg] = useState<ChatMessage | null>(null);
  const [pinnedMessage, setPinnedMessage] = useState<ChatMessage | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [wallpaperTheme, setWallpaperTheme] = useState<string>('default');
  const [isMuted, setIsMuted] = useState(false);

  // Voice recording state
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);

  // GIF / Sticker Picker state
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [pickerTab, setPickerTab] = useState<'gifs' | 'stickers'>('gifs');

  // AI chat state
  const isAIChat = recipient?.uid === 'pulse_ai';
  const [aiTyping, setAiTyping] = useState(false);
  const aiHistoryRef = useRef<{ role: string; content: string }[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFiredRef = useRef(false);

  const [liveRecipient, setLiveRecipient] = useState<UserProfile | null>(null);
  const [chatDocState, setChatDocState] = useState<{ lastReadTimes: Record<string, number>; typing: Record<string, number> }>({ lastReadTimes: {}, typing: {} });
  // Forces a re-render every few seconds so presence/typing staleness
  // (computed from timestamps against Date.now()) actually expires in the
  // UI even when no new Firestore write comes in to trigger one.
  const [, setPresenceTick] = useState(0);

  const chatId = recipient ? getChatId(currentUser.uid, recipient.uid) : '';

  useEffect(() => {
    if (!recipient?.uid) return;
    const unsubscribeProfile = subscribeToUserProfile(recipient.uid, (p) => {
      if (p) setLiveRecipient(p);
    });
    return () => unsubscribeProfile();
  }, [recipient?.uid]);

  useEffect(() => {
    if (!isOpen || !chatId) return;
    const unsubscribeChatDoc = subscribeToChatDoc(chatId, (data) => {
      setChatDocState(data);
    });
    return () => unsubscribeChatDoc();
  }, [isOpen, chatId]);

  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => setPresenceTick(t => t + 1), 3000);
    return () => clearInterval(interval);
  }, [isOpen]);

  // Clear our own typing flag whenever the chat closes or the recipient
  // changes, so we never leave a stale "typing" write behind.
  useEffect(() => {
    return () => {
      if (chatId && currentUser?.uid) {
        setTypingStatus(chatId, currentUser.uid, false).catch(() => {});
      }
    };
  }, [chatId, currentUser?.uid]);

  const recipientIsOnline = !!liveRecipient?.isOnline &&
    (Date.now() - Number(liveRecipient?.lastActive || 0)) < PRESENCE_STALE_MS;

  const recipientIsTyping = !!(
    recipient &&
    chatDocState.typing[recipient.uid] &&
    (Date.now() - chatDocState.typing[recipient.uid]) < TYPING_STALE_MS
  );

  const typingTimeoutRef = useRef<any>(null);

  const handleInputChange = (value: string) => {
    setInputText(value);
    if (!chatId || !currentUser?.uid) return;
    setTypingStatus(chatId, currentUser.uid, true).catch(() => {});
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setTypingStatus(chatId, currentUser.uid, false).catch(() => {});
    }, 3000);
  };

  useEffect(() => {
    if (!isOpen || !recipient || !chatId) return;

    // Mark as read immediately on open
    if (currentUser?.uid) {
      markChatAsRead(chatId, currentUser.uid);
    }

    const unsubscribe = subscribeToChatMessages(chatId, (loadedMessages) => {
      setMessages(loadedMessages);
      // Drop any optimistic placeholders that have now landed for real —
      // matched by the clientId we stamped on them at send time.
      const landedClientIds = new Set(loadedMessages.map(m => m.clientId).filter(Boolean));
      setOptimisticMessages(prev => prev.filter(m => !landedClientIds.has(m.clientId)));
      if (currentUser?.uid) {
        markChatAsRead(chatId, currentUser.uid);
      }
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    });

    return () => unsubscribe();
  }, [isOpen, recipient?.uid, chatId, currentUser?.uid]);

  if (!isOpen || !recipient) return null;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputText.trim();
    if (!text && !mediaUrl) return;

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (chatId && currentUser?.uid) {
      setTypingStatus(chatId, currentUser.uid, false).catch(() => {});
    }

    // EDIT MODE — update the existing message in place, no optimistic bubble needed.
    if (editingMessage) {
      const messageId = editingMessage.id;
      setInputText('');
      setEditingMessage(null);
      try {
        await editChatMessage(chatId, messageId, text);
      } catch (err: any) {
        onToast('Failed to edit message: ' + (err.message || 'Error'));
      }
      return;
    }

    if (sending) return;

    let finalMessage = text;
    if (replyingTo) {
      finalMessage = `↩️ Replying to "${replyingTo.text.slice(0, 30)}...":\n${text}`;
    }
    const outgoingText = finalMessage || (mediaUrl ? '📷 Photo' : '');
    const outgoingMedia = mediaUrl;
    const clientId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Optimistic bubble — show it instantly, clear the composer instantly.
    // The real doc lands via the live subscription and swaps this out by clientId.
    const optimisticMsg: ChatMessage = {
      id: clientId,
      clientId,
      senderUid: currentUser.uid,
      senderHandle: currentUser.handle,
      senderUsername: currentUser.username,
      senderAvatar: currentUser.photoURL,
      text: outgoingText,
      createdAt: Date.now(),
      mediaUrl: outgoingMedia || undefined,
      mediaType: outgoingMedia ? 'image' : 'text',
      status: 'sent',
      pending: true
    };
    setOptimisticMessages(prev => [...prev, optimisticMsg]);
    setInputText('');
    setMediaUrl(null);
    setReplyingTo(null);
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);

    try {
      await sendChatMessage(
        chatId,
        currentUser,
        outgoingText,
        recipient.uid,
        outgoingMedia || undefined,
        {
          mediaType: outgoingMedia ? 'image' : 'text',
          clientId
        }
      );
      // Success: the live subscription will remove this placeholder once the
      // real doc (matching clientId) arrives. No extra action needed here.

      // If chatting with Pulse AI, get a response from the Groq-powered AI
      if (isAIChat && !outgoingMedia) {
        setAiTyping(true);
        aiHistoryRef.current.push({ role: 'user', content: outgoingText });
        try {
          const aiRes = await fetch('/api/ai/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: outgoingText,
              history: aiHistoryRef.current.slice(-10),
              userName: currentUser.username
            })
          });
          const aiData = await aiRes.json();
          const aiReply = aiData.reply || aiData.error || 'Sorry, I could not process that.';
          aiHistoryRef.current.push({ role: 'assistant', content: aiReply });

          // Save AI response as a chat message from the AI bot
          const aiProfile: UserProfile = {
            uid: 'pulse_ai',
            handle: '@pulse_ai',
            username: 'Pulse AI',
            photoURL: 'https://api.dicebear.com/7.x/bottts/svg?seed=pulseai',
            email: '',
            bio: 'Pulse AI Assistant',
            followers: 0,
            following: 0,
            likesReceived: 0,
            createdAt: Date.now(),
            emailVerified: true,
            verified: false
          } as any;
          await sendChatMessage(chatId, aiProfile, aiReply, currentUser.uid, undefined, {
            mediaType: 'text',
            clientId: `ai-${Date.now()}`
          });
        } catch (aiErr) {
          onToast('AI is having trouble responding — try again');
        } finally {
          setAiTyping(false);
        }
      }
    } catch (err: any) {
      onToast('Failed to send message: ' + (err.message || 'Error'));
      setOptimisticMessages(prev => prev.map(m => m.clientId === clientId ? { ...m, pending: false, failed: true } : m));
    }
  };

  const handleRetryFailed = async (msg: ChatMessage) => {
    setOptimisticMessages(prev => prev.map(m => m.clientId === msg.clientId ? { ...m, pending: true, failed: false } : m));
    try {
      await sendChatMessage(
        chatId,
        currentUser,
        msg.text,
        recipient.uid,
        msg.mediaUrl || undefined,
        { mediaType: msg.mediaType, clientId: msg.clientId }
      );
    } catch (err: any) {
      onToast('Failed to send message: ' + (err.message || 'Error'));
      setOptimisticMessages(prev => prev.map(m => m.clientId === msg.clientId ? { ...m, pending: false, failed: true } : m));
    }
  };

  const handleDiscardFailed = (msg: ChatMessage) => {
    setOptimisticMessages(prev => prev.filter(m => m.clientId !== msg.clientId));
  };

  // Upload Audio Blob to backend & send genuine Voice Note
  const handleSendVoiceBlob = async (audioBlob: Blob, durationSeconds: number) => {
    try {
      // 1. Read blob into Data URL
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(audioBlob);
      });

      let finalAudioUrl = dataUrl;

      // 2. Upload to /api/upload
      try {
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dataUrl,
            type: 'audio/webm'
          })
        });
        const data = await res.json();
        if (data.success && data.url) {
          finalAudioUrl = data.url;
        }
      } catch (uploadErr) {
        console.warn('Server upload notice, using direct data URI fallback:', uploadErr);
      }

      // 3. Send message with audio url & voiceDuration
      await sendChatMessage(
        chatId, 
        currentUser, 
        '🎙️ Voice Note', 
        recipient.uid, 
        finalAudioUrl, 
        {
          mediaType: 'voice',
          voiceDuration: durationSeconds
        }
      );

      setIsRecordingVoice(false);
      onToast('Voice note sent! 🎙️');
    } catch (err: any) {
      console.error('Send voice note error:', err);
      onToast('Failed to send voice note');
    }
  };

  const handleSendGif = async (gifUrl: string) => {
    setShowGifPicker(false);
    try {
      await sendChatMessage(chatId, currentUser, '👾 GIF', recipient.uid, gifUrl, {
        mediaType: 'gif',
        gifUrl
      });
      onToast('GIF sent!');
    } catch (e) {
      onToast('Error sending GIF');
    }
  };

  const handleSendSticker = async (emoji: string) => {
    setShowGifPicker(false);
    try {
      await sendChatMessage(chatId, currentUser, emoji, recipient.uid, undefined, {
        mediaType: 'sticker',
        stickerEmoji: emoji
      });
    } catch (e) {
      onToast('Error sending sticker');
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      onToast('Please select an image file');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setMediaUrl(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDelete = async (messageId: string) => {
    try {
      await deleteChatMessage(chatId, messageId);
      onToast('Message un-sent');
    } catch (e) {
      onToast('Error deleting message');
    }
  };

  const handleCopy = async (msg: ChatMessage) => {
    try {
      await navigator.clipboard.writeText(msg.text || '');
      onToast('Copied to clipboard');
    } catch (e) {
      onToast('Could not copy message');
    }
  };

  const handleStartEdit = (msg: ChatMessage) => {
    setEditingMessage(msg);
    setReplyingTo(null);
    setInputText(msg.text || '');
    setActionSheetMsg(null);
  };

  const handleCancelEdit = () => {
    setEditingMessage(null);
    setInputText('');
  };

  // Long-press (touch) support so the action sheet is reachable without hover,
  // which is the only way these actions worked before on a phone.
  const handleBubbleTouchStart = (msg: ChatMessage) => {
    longPressFiredRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      longPressFiredRef.current = true;
      if (navigator.vibrate) navigator.vibrate(15);
      setActionSheetMsg(msg);
    }, 450);
  };

  const handleBubbleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleBubbleContextMenu = (e: React.MouseEvent, msg: ChatMessage) => {
    e.preventDefault();
    setActionSheetMsg(msg);
  };

  const handleReact = async (messageId: string, emoji: string) => {
    try {
      await reactToChatMessage(chatId, messageId, emoji, currentUser.uid);
      setActiveReactionMsgId(null);
    } catch (e) {}
  };

  const handleTogglePin = (msg: ChatMessage) => {
    if (pinnedMessage?.id === msg.id) {
      setPinnedMessage(null);
      onToast('Unpinned message');
    } else {
      setPinnedMessage(msg);
      onToast('Pinned message to chat header 📌');
    }
  };

  const handleInitiateCall = (type: 'voice' | 'video') => {
    if (onStartCall) {
      onStartCall({
        uid: recipient.uid,
        handle: displayHandle,
        username: displayUsername,
        avatar: displayAvatar
      }, type);
    } else {
      onToast(`Starting ${type} call...`);
    }
  };

  const combinedMessages = [...messages, ...optimisticMessages].sort((a, b) => a.createdAt - b.createdAt);

  const filteredMessages = searchQuery.trim()
    ? combinedMessages.filter(m => (m.text || '').toLowerCase().includes(searchQuery.toLowerCase()))
    : combinedMessages;

  const currentTheme = CHAT_WALLPAPERS[wallpaperTheme] || CHAT_WALLPAPERS.default;

  const displayAvatar = liveRecipient?.photoURL || recipient.avatar;
  const displayUsername = liveRecipient?.username || recipient.username || recipient.handle;
  const displayHandle = liveRecipient?.handle || recipient.handle;
  const isVerified = (liveRecipient?.verified ?? (recipient as any).verified) === true;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col justify-between max-w-[480px] mx-auto select-none font-sans">
      
      {/* Header */}
      <div className="px-header" style={{ position: 'relative' }}>
        <div className="flex items-center gap-2 min-w-0">
          <button onClick={onClose} className="px-icon-btn" style={{ width: 32, height: 32 }}>
            <ArrowLeft className="w-[18px] h-[18px]" />
          </button>
          
          <div 
            onClick={() => onOpenProfile && onOpenProfile(displayHandle, recipient.uid)}
            className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity min-w-0"
          >
            <div className="relative shrink-0">
              <img
                src={displayAvatar}
                alt={displayHandle}
                className="rounded-full object-cover"
                style={{ width: 38, height: 38, border: '1px solid var(--line2)' }}
              />
              {recipientIsOnline && (
                <span className="absolute rounded-full" style={{ width: 10, height: 10, right: 0, bottom: 0, border: '2px solid var(--bg)', background: 'var(--green)' }} />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <span className="font-bold truncate max-w-[110px] sm:max-w-[160px]" style={{ fontSize: 13, color: 'var(--text)' }}>{displayUsername}</span>
                {isAIChat && <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full bg-[#25f4ee]/20 text-[#25f4ee]">AI</span>}
                {isVerified && <VerifiedBadge size="xs" />}
              </div>
              {aiTyping ? (
                <span className="font-medium leading-none block mt-0.5 animate-pulse" style={{ fontSize: 9.5, color: '#25f4ee' }}>AI is thinking...</span>
              ) : recipientIsTyping ? (
                <span className="font-medium leading-none block mt-0.5 animate-pulse" style={{ fontSize: 9.5, color: 'var(--green)' }}>typing...</span>
              ) : recipientIsOnline ? (
                <span className="font-medium leading-none block mt-0.5" style={{ fontSize: 9.5, color: 'var(--green)' }}>Active now</span>
              ) : liveRecipient?.lastActive ? (
                <span className="font-medium leading-none block mt-0.5" style={{ fontSize: 9.5, color: 'var(--muted)' }}>
                  Active {formatRelativeTime(Number(liveRecipient.lastActive))}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {/* Action buttons: Voice Call, Video Call, Search, Settings */}
        <div className="flex items-center gap-0.5 shrink-0">
          {/* Voice Call Button — hidden for AI chat */}
          {!isAIChat && (
          <button
            type="button"
            onClick={() => handleInitiateCall('voice')}
            className="px-icon-btn"
            style={{ width: 32, height: 32 }}
            title="Start Voice Call"
          >
            <Phone className="w-[16px] h-[16px]" />
          </button>
          )}

          {/* Video Call Button — hidden for AI chat */}
          {!isAIChat && (
          <button
            type="button"
            onClick={() => handleInitiateCall('video')}
            className="px-icon-btn"
            style={{ width: 32, height: 32 }}
            title="Start Video Call"
          >
            <Video className="w-[16px] h-[16px]" />
          </button>
          )}

          <button
            onClick={() => setIsSearching(prev => !prev)}
            className="px-icon-btn"
            style={{ width: 32, height: 32 }}
            title="Search Messages"
          >
            <Search className="w-[16px] h-[16px]" />
          </button>
          
          <button
            onClick={() => setShowSettings(prev => !prev)}
            className="px-icon-btn"
            style={{ width: 32, height: 32 }}
            title="Chat Options"
          >
            <MoreVertical className="w-[16px] h-[16px]" />
          </button>
        </div>
      </div>

      {/* Search Header Bar */}
      {isSearching && (
        <div className="p-1.5 bg-neutral-950 border-b border-white/10 flex items-center gap-1.5 shrink-0">
          <Search className="w-3 h-3 text-neutral-400 ml-1" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search messages..."
            className="flex-1 bg-black border border-white/10 rounded-md px-2 py-0.5 text-[11px] text-white focus:outline-none focus:border-[#25f4ee]"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="p-1 text-neutral-400 hover:text-white">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      )}

      {/* Pinned Message Banner */}
      {pinnedMessage && (
        <div className="p-1.5 bg-neutral-950 border-b border-[#25f4ee]/30 flex items-center justify-between text-[10.5px] px-2.5 shrink-0 shadow-sm">
          <div className="flex items-center gap-1.5 text-neutral-300 line-clamp-1 text-[10px]">
            <Pin className="w-2.5 h-2.5 text-[#25f4ee] shrink-0" />
            <span className="font-bold text-white shrink-0">Pinned:</span>
            <span className="line-clamp-1">{pinnedMessage.text}</span>
          </div>
          <button onClick={() => setPinnedMessage(null)} className="p-0.5 text-neutral-400 hover:text-white cursor-pointer">
            <X className="w-2.5 h-2.5" />
          </button>
        </div>
      )}

      {/* Settings / Wallpaper Dropdown */}
      {showSettings && (
        <div className="p-2 bg-neutral-950 border-b border-white/10 flex flex-col gap-1.5 shrink-0 animate-in slide-in-from-top-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-neutral-300">Chat Theme</span>
            <button onClick={() => setShowSettings(false)} className="text-neutral-400 hover:text-white">
              <X className="w-3 h-3" />
            </button>
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            {Object.entries(CHAT_WALLPAPERS).map(([key, theme]) => (
              <button
                key={key}
                onClick={() => setWallpaperTheme(key)}
                className={`px-2 py-0.5 rounded-full text-[9px] font-bold shrink-0 border transition-colors cursor-pointer ${
                  wallpaperTheme === key
                    ? 'border-[#25f4ee] bg-[#25f4ee]/20 text-[#25f4ee]'
                    : 'border-white/10 bg-neutral-900 text-neutral-400 hover:text-white'
                }`}
              >
                {theme.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chat Messages Feed */}
      <div className={`flex-1 overflow-y-auto p-3 space-y-2 ${currentTheme.bgClass}`}>
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4 space-y-2 opacity-60">
            <img
              src={displayAvatar}
              alt={displayHandle}
              className="w-12 h-12 rounded-full object-cover border border-white/15 mb-0.5"
            />
            <h4 className="text-xs font-bold text-white">{displayUsername}</h4>
            <p className="text-[10px] text-neutral-400 max-w-xs">
              Say hello! Direct messages, voice calls, and video calls on Pulse are live and private.
            </p>
          </div>
        ) : (
          filteredMessages.map((msg) => {
            const isMe = msg.senderUid === currentUser.uid;
            const isVoice = msg.mediaType === 'voice' || (msg.voiceDuration && msg.voiceDuration > 0);
            const isCallLog = msg.mediaType === 'call_log' || !!msg.callLog;
            const isSticker = msg.mediaType === 'sticker' && !!msg.stickerEmoji;

            const isPending = !!msg.pending;
            const isFailed = !!msg.failed;
            // A message I sent is "read" once the recipient's last-read
            // timestamp for this chat is at or after when I sent it —
            // markChatAsRead() already stamps that per-user timestamp on
            // the chat doc whenever they open/view it, so no per-message
            // write is needed to know this.
            const isRead = isMe && !!(
              recipient &&
              chatDocState.lastReadTimes[recipient.uid] &&
              chatDocState.lastReadTimes[recipient.uid] >= msg.createdAt
            );

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} group relative`}
              >
                <div className="flex items-end gap-1.5 max-w-[80%]">
                  {!isMe && (
                    <img
                      src={displayAvatar}
                      alt={displayHandle}
                      className="w-5 h-5 rounded-full object-cover border border-white/20 shrink-0 mb-0.5"
                    />
                  )}

                  {/* STICKER — no bubble, WhatsApp/Telegram style */}
                  {isSticker ? (
                    <div
                      className="flex flex-col items-end gap-0.5"
                      onTouchStart={() => handleBubbleTouchStart(msg)}
                      onTouchEnd={handleBubbleTouchEnd}
                      onTouchMove={handleBubbleTouchEnd}
                      onContextMenu={(e) => handleBubbleContextMenu(e, msg)}
                    >
                      <span className={`text-[52px] leading-none drop-shadow-lg select-none ${isPending ? 'opacity-50' : ''}`}>
                        {msg.stickerEmoji}
                      </span>
                      <div className="flex items-center gap-0.5 text-[8.5px] text-neutral-400 pr-0.5">
                        <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        {isMe && (isPending ? <Clock3 className="w-2.5 h-2.5" /> : isFailed ? <AlertCircle className="w-2.5 h-2.5 text-red-400" /> : isRead ? <CheckCheck className="w-2.5 h-2.5" style={{ color: 'var(--blue)' }} /> : <Check className="w-2.5 h-2.5" />)}
                      </div>
                    </div>
                  ) : isCallLog ? (
                    <div className="p-2 rounded-xl bg-neutral-900/90 border border-white/10 flex items-center gap-2 shadow-sm max-w-[240px]">
                      <div className={`p-1.5 rounded-full ${
                        msg.callLog?.status === 'declined' || msg.callLog?.status === 'missed'
                          ? 'bg-red-500/20 text-red-400'
                          : 'bg-emerald-500/20 text-emerald-400'
                      }`}>
                        {msg.callLog?.callType === 'video' ? <Video className="w-3.5 h-3.5" /> : <Phone className="w-3.5 h-3.5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-bold text-white leading-tight">
                          {msg.text || (msg.callLog?.callType === 'video' ? 'Video Call' : 'Voice Call')}
                        </div>
                        <div className="text-[9px] text-neutral-400">
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleInitiateCall(msg.callLog?.callType || 'voice')}
                        className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-[#25f4ee] hover:text-black text-[#25f4ee] text-[9.5px] font-bold cursor-pointer transition-colors"
                      >
                        Call
                      </button>
                    </div>
                  ) : (
                    /* REGULAR / VOICE / PHOTO MESSAGE BUBBLE */
                    <div
                      onTouchStart={() => handleBubbleTouchStart(msg)}
                      onTouchEnd={handleBubbleTouchEnd}
                      onTouchMove={handleBubbleTouchEnd}
                      onContextMenu={(e) => handleBubbleContextMenu(e, msg)}
                      className={`px-3.5 py-2.5 text-[14px] leading-[1.4] relative select-none ${
                        isPending ? 'opacity-60' : isFailed ? 'opacity-80' : ''
                      }`}
                      style={
                        isMe
                          ? {
                              background: 'linear-gradient(145deg, #3178e6, #225fbe)',
                              color: '#fff',
                              borderRadius: '20px 20px 6px 20px',
                              boxShadow: '0 4px 15px rgba(0,0,0,.25)'
                            }
                          : {
                              background: '#181818',
                              color: '#ededed',
                              border: '1px solid rgba(255,255,255,.045)',
                              borderRadius: '18px 18px 18px 6px'
                            }
                      }
                    >
                      {/* VOICE NOTE COMPONENT */}
                      {isVoice && msg.mediaUrl ? (
                        <VoiceNotePlayer
                          mediaUrl={msg.mediaUrl}
                          duration={msg.voiceDuration || 0}
                          isMe={isMe}
                        />
                      ) : (
                        <>
                          {/* Media image or GIF if present */}
                          {(msg.mediaUrl || msg.gifUrl) && (
                            <img
                              src={msg.mediaUrl || msg.gifUrl}
                              alt="Shared media"
                              className="rounded-lg max-h-48 w-auto object-cover mb-1 border border-black/10"
                            />
                          )}

                          {/* Text content */}
                          {msg.text && <p className="whitespace-pre-wrap break-words">{msg.text}</p>}
                        </>
                      )}

                      {/* Footer timestamp & delivery check */}
                      <div className="flex items-center justify-end gap-1 mt-1" style={{ fontSize: 10, color: isMe ? 'rgba(255,255,255,.58)' : '#666' }}>
                        {isFailed && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleDiscardFailed(msg)}
                              className="underline cursor-pointer"
                            >
                              Remove
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRetryFailed(msg)}
                              className="underline font-bold cursor-pointer"
                            >
                              Retry
                            </button>
                          </>
                        )}
                        {msg.isEdited && <span className="italic">edited</span>}
                        <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        {isMe && (
                          isPending ? <Clock3 className="w-2.5 h-2.5" /> :
                          isFailed ? <AlertCircle className="w-2.5 h-2.5 text-red-500" /> :
                          isRead ? <CheckCheck className="w-3 h-3" style={{ color: '#b7d4ff' }} /> :
                          <Check className="w-3 h-3" />
                        )}
                      </div>

                      {/* Reaction Display */}
                      {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                        <div className="absolute -bottom-2 right-1 flex items-center gap-0.5 bg-neutral-900 border border-white/20 rounded-full px-1 py-0.2 shadow-sm">
                          {Object.values(msg.reactions).map((emoji, idx) => (
                            <span key={idx} className="text-[9px]">{emoji}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Tap-to-open action sheet — replaces the old hover-only bar.
                    Works on both touch (tap) and mouse (hover reveal + click). */}
                {!isCallLog && !isPending && (
                  <button
                    type="button"
                    onClick={() => setActionSheetMsg(msg)}
                    title="Message options"
                    className="mt-0.5 p-0.5 rounded-full text-neutral-500 opacity-60 sm:opacity-0 sm:group-hover:opacity-100 hover:!opacity-100 hover:text-white hover:bg-white/10 transition-opacity cursor-pointer"
                  >
                    <MoreVertical className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Editing Message Bar */}
      {editingMessage && (
        <div className="p-1.5 bg-neutral-900 border-t border-white/10 flex items-center justify-between px-3 text-[10.5px] shrink-0">
          <div className="flex items-center gap-1.5">
            <Pencil className="w-3 h-3 text-[#25f4ee]" />
            <div className="line-clamp-1">
              <span className="text-neutral-400 font-bold mr-1">Editing message</span>
            </div>
          </div>
          <button onClick={handleCancelEdit} className="text-neutral-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Quoted Message Preview Bar */}
      {replyingTo && !editingMessage && (
        <div className="p-1.5 bg-neutral-900 border-t border-white/10 flex items-center justify-between px-3 text-[10.5px] shrink-0">
          <div className="flex items-center gap-1.5">
            <Reply className="w-3 h-3 text-[#25f4ee]" />
            <div className="line-clamp-1">
              <span className="text-neutral-400 font-bold mr-1">Replying to:</span>
              <span className="text-white">{replyingTo.text}</span>
            </div>
          </div>
          <button onClick={() => setReplyingTo(null)} className="text-neutral-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Attached Image Preview */}
      {mediaUrl && (
        <div className="p-1.5 bg-neutral-900 border-t border-white/10 flex items-center justify-between px-3 shrink-0">
          <div className="flex items-center gap-1.5">
            <img src={mediaUrl} alt="Upload preview" className="w-9 h-9 rounded-lg object-cover border border-white/20" />
            <span className="text-[10px] text-neutral-300">Photo attached</span>
          </div>
          <button onClick={() => setMediaUrl(null)} className="p-0.5 text-neutral-400 hover:text-white cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* GIF / Sticker Picker */}
      {showGifPicker && (
        <div className="bg-neutral-950 border-t border-white/10 shrink-0 animate-in slide-in-from-bottom-2">
          <div className="flex items-center justify-between px-2 pt-2">
            <div className="flex items-center gap-1 bg-neutral-900 rounded-full p-0.5">
              <button
                onClick={() => setPickerTab('gifs')}
                className={`px-3 py-1 rounded-full text-[10px] font-bold cursor-pointer transition-colors ${
                  pickerTab === 'gifs' ? 'bg-[#25f4ee] text-black' : 'text-neutral-400 hover:text-white'
                }`}
              >
                GIFs
              </button>
              <button
                onClick={() => setPickerTab('stickers')}
                className={`px-3 py-1 rounded-full text-[10px] font-bold cursor-pointer transition-colors ${
                  pickerTab === 'stickers' ? 'bg-[#25f4ee] text-black' : 'text-neutral-400 hover:text-white'
                }`}
              >
                Stickers
              </button>
            </div>
            <button onClick={() => setShowGifPicker(false)} className="text-neutral-400 hover:text-white p-1">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="p-2 max-h-40 overflow-y-auto">
            {pickerTab === 'gifs' ? (
              <div className="grid grid-cols-3 gap-1">
                {[
                  'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif',
                  'https://media.giphy.com/media/artj92V8o75VPL7AeQ/giphy.gif',
                  'https://media.giphy.com/media/3o7TKSjRrfIPjeiVyM/giphy.gif',
                  'https://media.giphy.com/media/26AHONQ79FdWZhAI0/giphy.gif',
                  'https://media.giphy.com/media/xT9IgzoKnwFNmISR8I/giphy.gif',
                  'https://media.giphy.com/media/3oKIPnAiaMCws8nOsE/giphy.gif'
                ].map((gif, i) => (
                  <img
                    key={i}
                    src={gif}
                    alt="GIF"
                    onClick={() => handleSendGif(gif)}
                    className="h-14 w-full object-cover rounded-md cursor-pointer hover:scale-105 transition-transform border border-white/10"
                  />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-6 gap-1">
                {STICKERS.map((emoji, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleSendSticker(emoji)}
                    className="text-2xl p-1 rounded-lg hover:bg-white/10 cursor-pointer transition-transform hover:scale-110 active:scale-95"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Real Live Voice Note Recorder Bar */}
      {isRecordingVoice ? (
        <VoiceNoteRecorder
          onSend={handleSendVoiceBlob}
          onCancel={() => setIsRecordingVoice(false)}
          onToast={onToast}
        />
      ) : (
        /* Chat Input Toolbar */
        <div className="p-2.5" style={{ background: 'var(--bg)', borderTop: '1px solid var(--line)' }}>
          <form
            onSubmit={handleSend}
            className="flex items-center gap-0.5 mx-auto"
            style={{
              maxWidth: 480,
              minHeight: 52,
              padding: 5,
              borderRadius: 27,
              background: 'linear-gradient(180deg, #202020, #191919)',
              border: '1px solid rgba(255,255,255,.085)',
              boxShadow: '0 8px 28px rgba(0,0,0,.4)'
            }}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageSelect}
              accept="image/*"
              className="hidden"
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-full flex items-center justify-center shrink-0 cursor-pointer active:scale-90 transition-transform"
              style={{ width: 40, height: 40, background: 'transparent', color: '#eee' }}
              title="Attach Photo"
            >
              <ImageIcon className="w-[18px] h-[18px]" />
            </button>

            <button
              type="button"
              onClick={() => setShowGifPicker(prev => !prev)}
              className="rounded-full flex items-center justify-center shrink-0 cursor-pointer active:scale-90 transition-transform"
              style={{ width: 40, height: 40, background: 'transparent', color: showGifPicker ? 'var(--green)' : '#eee' }}
              title="GIFs & Stickers"
            >
              <Smile className="w-[18px] h-[18px]" />
            </button>

            <input
              type="text"
              value={inputText}
              onChange={e => handleInputChange(e.target.value)}
              placeholder={editingMessage ? 'Edit message...' : `Message ${displayUsername}...`}
              autoFocus={!!editingMessage}
              className="flex-1 focus:outline-none min-w-0"
              style={{
                background: 'transparent',
                border: 0,
                padding: '0 6px',
                fontSize: 15,
                color: '#fff',
                height: 40
              }}
            />

            {inputText.trim() || mediaUrl ? (
              <button
                type="submit"
                disabled={sending}
                title={editingMessage ? 'Save edit' : 'Send'}
                className="rounded-full flex items-center justify-center transition-transform active:scale-90 cursor-pointer shrink-0"
                style={{
                  width: 40, height: 40,
                  background: 'linear-gradient(145deg, #3b82f6, #2563eb)',
                  color: '#fff',
                  boxShadow: '0 4px 17px rgba(37,99,235,.3)'
                }}
              >
                {editingMessage ? <Check className="w-4 h-4" /> : <Send className="w-4 h-4 ml-0.5" />}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsRecordingVoice(true)}
                className="rounded-full flex items-center justify-center shrink-0 cursor-pointer active:scale-90 transition-transform"
                style={{ width: 40, height: 40, background: 'transparent', color: '#eee' }}
                title="Record Voice Note"
              >
                <Mic className="w-[18px] h-[18px]" />
              </button>
            )}
          </form>
        </div>
      )}

      {/* Message Action Sheet — opened via long-press, right-click, or the
          "more" button. Mobile-first replacement for the old hover-only bar. */}
      {actionSheetMsg && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 animate-in fade-in"
          onClick={() => setActionSheetMsg(null)}
        >
          <div
            className="w-full max-w-[480px] bg-neutral-950 border-t border-white/10 rounded-t-2xl p-3 pb-4 animate-in slide-in-from-bottom-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-8 h-1 rounded-full bg-white/15 mx-auto mb-3" />

            {actionSheetMsg.text && (
              <div className="text-[10.5px] text-neutral-400 line-clamp-2 mb-3 px-1">
                {actionSheetMsg.text}
              </div>
            )}

            {/* Quick reactions row */}
            <div className="flex items-center justify-between px-1 mb-3">
              {EMOJI_REACTIONS.map(emoji => (
                <button
                  key={emoji}
                  onClick={() => { handleReact(actionSheetMsg.id, emoji); setActionSheetMsg(null); }}
                  className="text-xl hover:scale-125 transition-transform cursor-pointer"
                >
                  {emoji}
                </button>
              ))}
            </div>

            <div className="flex flex-col divide-y divide-white/5 border-t border-white/5">
              <button
                onClick={() => { setReplyingTo(actionSheetMsg); setEditingMessage(null); setActionSheetMsg(null); }}
                className="flex items-center gap-2.5 py-2.5 px-1 text-[12px] text-white cursor-pointer"
              >
                <Reply className="w-4 h-4 text-neutral-400" /> Reply
              </button>

              {!!actionSheetMsg.text && (
                <button
                  onClick={() => { handleCopy(actionSheetMsg); setActionSheetMsg(null); }}
                  className="flex items-center gap-2.5 py-2.5 px-1 text-[12px] text-white cursor-pointer"
                >
                  <Copy className="w-4 h-4 text-neutral-400" /> Copy
                </button>
              )}

              {actionSheetMsg.senderUid === currentUser.uid &&
                !actionSheetMsg.mediaUrl &&
                !actionSheetMsg.gifUrl &&
                actionSheetMsg.mediaType !== 'voice' &&
                actionSheetMsg.mediaType !== 'sticker' && (
                <button
                  onClick={() => handleStartEdit(actionSheetMsg)}
                  className="flex items-center gap-2.5 py-2.5 px-1 text-[12px] text-white cursor-pointer"
                >
                  <Pencil className="w-4 h-4 text-neutral-400" /> Edit
                </button>
              )}

              <button
                onClick={() => { handleTogglePin(actionSheetMsg); setActionSheetMsg(null); }}
                className="flex items-center gap-2.5 py-2.5 px-1 text-[12px] text-white cursor-pointer"
              >
                {pinnedMessage?.id === actionSheetMsg.id ? (
                  <><PinOff className="w-4 h-4 text-neutral-400" /> Unpin</>
                ) : (
                  <><Pin className="w-4 h-4 text-neutral-400" /> Pin</>
                )}
              </button>

              {actionSheetMsg.senderUid === currentUser.uid && (
                <button
                  onClick={() => { handleDelete(actionSheetMsg.id); setActionSheetMsg(null); }}
                  className="flex items-center gap-2.5 py-2.5 px-1 text-[12px] text-red-400 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" /> Unsend
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
