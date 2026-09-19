import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, GroupChat, ChatMessage } from '../types';
import { 
  createGroupChat, 
  subscribeToUserGroups, 
  subscribeToGroupMessages, 
  sendGroupMessage, 
  addGroupMember, 
  removeGroupMember, 
  updateGroupInfo,
  unsendMessage,
  editMessage,
  reactToMessage,
  pinChatMessage,
  getSuggestedCreators
} from '../services/pulseDb';
import { 
  X, 
  Users, 
  Plus, 
  Send, 
  Image as ImageIcon, 
  Mic, 
  Pin, 
  PinOff,
  Copy,
  Pencil,
  Search, 
  MoreVertical, 
  Crown, 
  UserMinus, 
  UserPlus, 
  Volume2, 
  Smile, 
  Check, 
  CheckCheck,
  Radio,
  ArrowLeft,
  Trash2
} from 'lucide-react';
import { VerifiedBadge } from './VerifiedBadge';

interface GroupChatsModalProps {
  isOpen: boolean;
  currentUser: UserProfile;
  onClose: () => void;
  onToast: (msg: string) => void;
  onOpenProfile: (handle: string, uid: string) => void;
}

const POPULAR_GIFS = [
  'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExM3h2Z2VnOHprOGo1cmVxejFzYndmN293dDFmZGNld2N4MmlpdWtpciZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/artj92V8o75VPL7AeQ/giphy.gif',
  'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExenFkZGx2OTFqc2JqY3RydzU1NTR2anRrc2h1MnFjc3N1aW9zYTF5cyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/ICOgUNjpvO0PC/giphy.gif',
  'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExaDZ5cHRydjF5bm93cjZhcXQ5cWpqa3dyd3Vud2w0aG5idHNyNXNsayZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3o7TKSjRrfIPjeiVyM/giphy.gif',
  'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExMWdrZ2FzOHdrc2lyOGJqZ29sY2txc3hxc3R1NnV3dW9pYzhvZWdheSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/blSTtZehjAZ8I/giphy.gif'
];

const EMOJI_REACTIONS = ['❤️', '🔥', '😂', '👏', '😮', '👍', '🙏', '🎉'];

export const GroupChatsModal: React.FC<GroupChatsModalProps> = ({
  isOpen,
  currentUser,
  onClose,
  onToast,
  onOpenProfile
}) => {
  const [groups, setGroups] = useState<GroupChat[]>([]);
  const [activeGroup, setActiveGroup] = useState<GroupChat | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<UserProfile[]>([]);
  const [availableCreators, setAvailableCreators] = useState<UserProfile[]>([]);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [voiceSeconds, setVoiceSeconds] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchingMessages, setSearchingMessages] = useState(false);
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
  const [actionSheetMsg, setActionSheetMsg] = useState<ChatMessage | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const voiceTimerRef = useRef<any>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Subscribe to user's groups
  useEffect(() => {
    if (!isOpen || !currentUser) return;
    const unsub = subscribeToUserGroups(currentUser.uid, (list) => {
      setGroups(list);
      if (activeGroup) {
        const updated = list.find(g => g.id === activeGroup.id);
        if (updated) setActiveGroup(updated);
      }
    });
    return () => unsub();
  }, [isOpen, currentUser]);

  // Load available creators to invite
  useEffect(() => {
    if (isOpen) {
      getSuggestedCreators(currentUser.uid).then(setAvailableCreators);
    }
  }, [isOpen, currentUser]);

  // Subscribe to active group's messages
  useEffect(() => {
    if (!activeGroup) return;
    const unsub = subscribeToGroupMessages(activeGroup.id, (msgs) => {
      setMessages(msgs);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });
    return () => unsub();
  }, [activeGroup?.id]);

  if (!isOpen) return null;

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) {
      onToast('Please enter a group name');
      return;
    }
    try {
      const groupId = await createGroupChat(
        currentUser,
        newGroupName.trim(),
        selectedMembers
      );
      setIsCreating(false);
      setNewGroupName('');
      setSelectedMembers([]);
      onToast('Group created successfully! 🎉');
    } catch (err: any) {
      onToast('Failed to create group: ' + err.message);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !activeGroup) return;

    const txt = inputText.trim();

    if (editingMessage) {
      const messageId = editingMessage.id;
      setInputText('');
      setEditingMessage(null);
      try {
        await editMessage(`groups/${activeGroup.id}/messages`, messageId, txt);
      } catch (err: any) {
        onToast('Failed to edit message: ' + err.message);
      }
      return;
    }

    setInputText('');
    try {
      await sendGroupMessage(activeGroup.id, currentUser, txt);
    } catch (err: any) {
      onToast('Failed to send: ' + err.message);
    }
  };

  const handleSendGif = async (gifUrl: string) => {
    if (!activeGroup) return;
    setShowGifPicker(false);
    try {
      await sendGroupMessage(activeGroup.id, currentUser, 'Sent a GIF', {
        mediaType: 'gif',
        gifUrl
      });
      onToast('GIF sent!');
    } catch (err: any) {
      onToast('Error sending GIF');
    }
  };

  const startVoiceRecording = () => {
    setIsRecordingVoice(true);
    setVoiceSeconds(0);
    voiceTimerRef.current = setInterval(() => {
      setVoiceSeconds(prev => prev + 1);
    }, 1000);
  };

  const stopVoiceRecording = async () => {
    clearInterval(voiceTimerRef.current);
    setIsRecordingVoice(false);
    if (!activeGroup || voiceSeconds < 1) return;

    try {
      await sendGroupMessage(activeGroup.id, currentUser, `Voice Message (${voiceSeconds}s)`, {
        mediaType: 'voice',
        voiceDuration: voiceSeconds
      });
      onToast('Voice message sent! 🎤');
    } catch (err: any) {
      onToast('Failed to send voice message');
    }
  };

  const handleUnsend = async (msgId: string) => {
    if (!activeGroup) return;
    try {
      await unsendMessage(`groups/${activeGroup.id}/messages`, msgId);
      onToast('Message unsent');
    } catch (e) {
      onToast('Could not unsend message');
    }
  };

  const handlePin = async (msg: ChatMessage) => {
    if (!activeGroup) return;
    try {
      await pinChatMessage(`groups/${activeGroup.id}/messages`, msg, `groups/${activeGroup.id}`);
      onToast('Message pinned to group 📌');
    } catch (e) {
      onToast('Error pinning message');
    }
  };

  const handleUnpin = async () => {
    if (!activeGroup) return;
    try {
      await pinChatMessage(`groups/${activeGroup.id}/messages`, null, `groups/${activeGroup.id}`);
      onToast('Unpinned message');
    } catch (e) {
      onToast('Error unpinning message');
    }
  };

  const handleReact = async (messageId: string, emoji: string) => {
    if (!activeGroup) return;
    try {
      await reactToMessage(`groups/${activeGroup.id}/messages`, messageId, emoji, currentUser.uid);
    } catch (e) {}
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
    setInputText(msg.text || '');
    setActionSheetMsg(null);
  };

  const handleCancelEdit = () => {
    setEditingMessage(null);
    setInputText('');
  };

  // Long-press (touch) support so the action sheet is reachable without hover.
  const handleBubbleTouchStart = (msg: ChatMessage) => {
    longPressTimerRef.current = setTimeout(() => {
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

  const filteredMessages = searchQuery.trim()
    ? messages.filter(m => m.text?.toLowerCase().includes(searchQuery.toLowerCase()))
    : messages;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-0 sm:p-4 select-none">
      <div className="w-full max-w-lg h-full sm:h-[88vh] bg-[#111214] border border-white/10 sm:rounded-3xl flex flex-col overflow-hidden shadow-2xl">
        {/* Main Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-neutral-950">
          <div className="flex items-center gap-2.5">
            {activeGroup && (
              <button
                onClick={() => setActiveGroup(null)}
                className="p-1 rounded-full text-neutral-400 hover:text-white cursor-pointer mr-1"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#ff2b54] to-[#25f4ee] flex items-center justify-center text-white">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-extrabold text-sm text-white">
                {activeGroup ? activeGroup.name : 'Group Chats'}
              </h2>
              <span className="text-[11px] text-neutral-400">
                {activeGroup 
                  ? `${activeGroup.memberUids?.length || 1} members` 
                  : `${groups.length} active groups`}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!activeGroup && (
              <button
                onClick={() => setIsCreating(true)}
                className="px-3 py-1.5 bg-[#25f4ee] text-black font-extrabold rounded-full text-xs flex items-center gap-1 hover:bg-[#1ee0da] cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> New Group
              </button>
            )}
            {activeGroup && (
              <button
                onClick={() => setShowMemberModal(true)}
                className="p-2 rounded-full bg-neutral-900 border border-white/10 text-neutral-300 hover:text-white cursor-pointer"
                title="Group Members"
              >
                <Users className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-full text-neutral-400 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* View 1: List of Groups */}
        {!activeGroup && !isCreating && (
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {groups.length === 0 ? (
              <div className="text-center py-20 space-y-4">
                <div className="w-16 h-16 rounded-full bg-neutral-900 border border-white/10 flex items-center justify-center mx-auto text-neutral-500">
                  <Users className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-extrabold text-white text-base">No Group Chats Yet</h3>
                  <p className="text-xs text-neutral-400 max-w-xs mx-auto">
                    Create a group with your favorite creators or friends to share clips, voice notes, and discuss trends.
                  </p>
                </div>
                <button
                  onClick={() => setIsCreating(true)}
                  className="px-5 py-2.5 bg-gradient-to-r from-[#ff2b54] to-[#25f4ee] text-white font-bold rounded-2xl text-xs cursor-pointer shadow-lg"
                >
                  Create Your First Group
                </button>
              </div>
            ) : (
              groups.map((g) => (
                <div
                  key={g.id}
                  onClick={() => setActiveGroup(g)}
                  className="p-3.5 rounded-2xl bg-neutral-900/80 border border-white/5 hover:border-white/20 flex items-center justify-between cursor-pointer transition-all active:scale-98"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={g.photoUrl || 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=150&auto=format&fit=crop&q=80'}
                      alt={g.name}
                      className="w-11 h-11 rounded-2xl object-cover border border-white/10"
                    />
                    <div>
                      <h4 className="font-bold text-white text-sm flex items-center gap-1.5">
                        {g.name}
                        {g.adminUid === currentUser.uid && (
                          <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded-full font-bold">Admin</span>
                        )}
                      </h4>
                      <p className="text-xs text-neutral-400 truncate max-w-[200px]">
                        {g.lastMessage || 'No messages yet'}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] text-neutral-500">
                    {g.memberUids?.length || 1} members
                  </span>
                </div>
              ))
            )}
          </div>
        )}

        {/* View 2: Create Group Form */}
        {isCreating && (
          <form onSubmit={handleCreateGroup} className="flex-1 p-5 flex flex-col justify-between overflow-y-auto">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-neutral-300 mb-1">Group Name</label>
                <input
                  type="text"
                  placeholder="e.g. Anime Creators Club / Squad 🔥"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="w-full bg-neutral-900 border border-white/15 rounded-2xl px-4 py-3 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-[#25f4ee]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-300 mb-2">
                  Invite Members ({selectedMembers.length} selected)
                </label>
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {availableCreators.map((creator) => {
                    const isSelected = selectedMembers.some(m => m.uid === creator.uid);
                    return (
                      <div
                        key={creator.uid}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedMembers(selectedMembers.filter(m => m.uid !== creator.uid));
                          } else {
                            setSelectedMembers([...selectedMembers, creator]);
                          }
                        }}
                        className={`p-2.5 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                          isSelected ? 'bg-[#25f4ee]/15 border-[#25f4ee]' : 'bg-neutral-900 border-white/5 hover:border-white/15'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <img src={creator.photoURL} alt={creator.handle} className="w-8 h-8 rounded-full object-cover" />
                          <div>
                            <span className="text-xs font-bold text-white block">{creator.handle}</span>
                            <span className="text-[10px] text-neutral-400">{creator.username}</span>
                          </div>
                        </div>
                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${isSelected ? 'bg-[#25f4ee] border-[#25f4ee] text-black' : 'border-white/20'}`}>
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-4 border-t border-white/10">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="flex-1 py-3 bg-neutral-900 text-neutral-300 font-bold rounded-2xl text-xs border border-white/10 hover:bg-neutral-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!newGroupName.trim()}
                className="flex-1 py-3 bg-[#25f4ee] text-black font-extrabold rounded-2xl text-xs hover:bg-[#1ee0da] disabled:opacity-40 cursor-pointer shadow-lg"
              >
                Create Group
              </button>
            </div>
          </form>
        )}

        {/* View 3: Active Group Chat Window */}
        {activeGroup && (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* Search Bar Toggle */}
            <div className="px-4 py-2 bg-neutral-950/80 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2 flex-1 mr-2">
                <Search className="w-3.5 h-3.5 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Search group messages..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent text-xs text-white placeholder:text-neutral-500 focus:outline-none w-full"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="text-neutral-400 hover:text-white text-xs">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Messages Stream */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {filteredMessages.length === 0 ? (
                <div className="text-center py-16 text-neutral-500 text-xs">
                  {searchQuery ? `No messages matching "${searchQuery}"` : 'Welcome to the group! Send the first message.'}
                </div>
              ) : (
                filteredMessages.map((m) => {
                  const isMe = m.senderUid === currentUser.uid;
                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col relative group ${isMe ? 'items-end' : 'items-start'}`}
                    >
                      {!isMe && (
                        <span className="text-[10px] font-bold text-neutral-400 mb-0.5 ml-1">
                          {m.senderHandle}
                        </span>
                      )}

                      <div
                        onTouchStart={() => handleBubbleTouchStart(m)}
                        onTouchEnd={handleBubbleTouchEnd}
                        onTouchMove={handleBubbleTouchEnd}
                        onContextMenu={(e) => handleBubbleContextMenu(e, m)}
                        className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed break-words shadow-sm select-none ${
                          isMe
                            ? 'bg-[#ff2b54] text-white rounded-br-xs'
                            : 'bg-neutral-800 text-neutral-100 rounded-bl-xs'
                        }`}
                      >
                        {m.gifUrl && (
                          <img
                            src={m.gifUrl}
                            alt="GIF"
                            className="rounded-xl max-h-48 w-full object-cover mb-2 border border-white/10"
                          />
                        )}

                        {m.mediaType === 'voice' && (
                          <div className="flex items-center gap-2 py-1">
                            <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
                              <Volume2 className="w-4 h-4" />
                            </div>
                            <div className="flex flex-col">
                              <span className="font-bold text-[11px]">Voice Note</span>
                              <span className="text-[9px] opacity-80">{m.voiceDuration || 3}s</span>
                            </div>
                          </div>
                        )}

                        {m.text}
                      </div>

                      {/* Reaction Display */}
                      {m.reactions && Object.keys(m.reactions).length > 0 && (
                        <div className="flex items-center gap-0.5 -mt-1.5 mb-0.5 bg-neutral-900 border border-white/20 rounded-full px-1.5 py-0.5 shadow-sm">
                          {Object.entries(m.reactions).filter(([, uids]) => (uids as string[]).length > 0).map(([emoji, uids]) => (
                            <span key={emoji} className="text-[10px] flex items-center gap-0.5">
                              {emoji}{(uids as string[]).length > 1 ? (uids as string[]).length : ''}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Timestamp + edited tag are always visible; the "more" button
                          opens the action sheet (tap-friendly, replaces hover-only bar). */}
                      <div className="flex items-center gap-1.5 text-[9px] text-neutral-500 mt-1 px-1">
                        <span>{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        {m.isEdited && <span className="italic">edited</span>}
                        <button
                          onClick={() => setActionSheetMsg(m)}
                          title="Message options"
                          className="p-0.5 rounded-full opacity-60 sm:opacity-0 sm:group-hover:opacity-100 hover:!opacity-100 hover:text-white hover:bg-white/10 transition-opacity cursor-pointer"
                        >
                          <MoreVertical className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* GIF Picker Overlay */}
            {showGifPicker && (
              <div className="p-3 bg-neutral-900 border-t border-white/10 animate-in slide-in-from-bottom-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-white">Trending GIFs</span>
                  <button onClick={() => setShowGifPicker(false)} className="text-neutral-400 hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {POPULAR_GIFS.map((url, i) => (
                    <img
                      key={i}
                      src={url}
                      alt="gif"
                      onClick={() => handleSendGif(url)}
                      className="rounded-xl h-20 w-full object-cover cursor-pointer hover:opacity-80 transition-opacity border border-white/10"
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Voice Recording Banner */}
            {isRecordingVoice && (
              <div className="p-3 bg-red-950/80 border-t border-red-500/30 flex items-center justify-between animate-pulse">
                <div className="flex items-center gap-2 text-red-400 text-xs font-bold">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                  <span>Recording Voice Note... {voiceSeconds}s</span>
                </div>
                <button
                  onClick={stopVoiceRecording}
                  className="px-3 py-1 bg-red-500 text-white font-bold rounded-full text-xs cursor-pointer hover:bg-red-600"
                >
                  Send
                </button>
              </div>
            )}

            {/* Editing Message Bar */}
            {editingMessage && (
              <div className="px-3 py-1.5 bg-neutral-900 border-t border-white/10 flex items-center justify-between text-[10.5px]">
                <div className="flex items-center gap-1.5">
                  <Pencil className="w-3 h-3 text-[#25f4ee]" />
                  <span className="text-neutral-400 font-bold">Editing message</span>
                </div>
                <button onClick={handleCancelEdit} className="text-neutral-400 hover:text-white">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Chat Input Bar */}
            <form onSubmit={handleSendMessage} className="p-3 border-t border-white/10 bg-[#111214] flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowGifPicker(!showGifPicker)}
                className="p-2 rounded-full text-neutral-400 hover:text-[#25f4ee] hover:bg-white/5 cursor-pointer font-bold text-xs"
                title="Send GIF"
              >
                GIF
              </button>

              <button
                type="button"
                onClick={isRecordingVoice ? stopVoiceRecording : startVoiceRecording}
                className={`p-2 rounded-full cursor-pointer transition-colors ${
                  isRecordingVoice ? 'text-red-500 bg-red-500/20' : 'text-neutral-400 hover:text-white hover:bg-white/5'
                }`}
                title="Voice Note"
              >
                <Mic className="w-4 h-4" />
              </button>

              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={editingMessage ? 'Edit message...' : `Message ${activeGroup.name}...`}
                autoFocus={!!editingMessage}
                className="flex-1 bg-neutral-800/80 border border-white/10 rounded-full px-4 py-2.5 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-[#25f4ee]"
              />

              <button
                type="submit"
                disabled={!inputText.trim()}
                title={editingMessage ? 'Save edit' : 'Send'}
                className="w-9 h-9 rounded-full bg-[#25f4ee] text-black flex items-center justify-center font-bold disabled:opacity-40 hover:bg-[#1ee0da] cursor-pointer shrink-0"
              >
                {editingMessage ? <Check className="w-4 h-4" /> : <Send className="w-4 h-4 ml-0.5" />}
              </button>
            </form>
          </div>
        )}

        {/* Member Management Modal */}
        {showMemberModal && activeGroup && (
          <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-[#18191c] border border-white/10 rounded-3xl p-5 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <h3 className="font-extrabold text-sm text-white">Group Members</h3>
                <button onClick={() => setShowMemberModal(false)} className="text-neutral-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto">
                {Object.values(activeGroup.members || {}).map((m: any) => (
                  <div key={m.uid} className="flex items-center justify-between p-2 rounded-2xl bg-neutral-900 border border-white/5">
                    <div className="flex items-center gap-2">
                      <img src={m.avatar} alt={m.handle} className="w-8 h-8 rounded-full object-cover" />
                      <div>
                        <span className="text-xs font-bold text-white block">{m.handle}</span>
                        <span className="text-[10px] text-neutral-400 capitalize">{m.role}</span>
                      </div>
                    </div>
                    {activeGroup.adminUid === currentUser.uid && m.uid !== currentUser.uid && (
                      <button
                        onClick={async () => {
                          await removeGroupMember(activeGroup.id, m.uid);
                          onToast(`Removed ${m.handle}`);
                        }}
                        className="p-1.5 text-red-400 hover:bg-red-500/10 rounded-full cursor-pointer"
                        title="Remove Member"
                      >
                        <UserMinus className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <button
                onClick={() => setShowMemberModal(false)}
                className="w-full py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white font-bold rounded-2xl text-xs border border-white/10 cursor-pointer"
              >
                Close
              </button>
            </div>
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
                {!!actionSheetMsg.text && (
                  <button
                    onClick={() => { handleCopy(actionSheetMsg); setActionSheetMsg(null); }}
                    className="flex items-center gap-2.5 py-2.5 px-1 text-[12px] text-white cursor-pointer"
                  >
                    <Copy className="w-4 h-4 text-neutral-400" /> Copy
                  </button>
                )}

                {actionSheetMsg.senderUid === currentUser.uid &&
                  !actionSheetMsg.gifUrl &&
                  actionSheetMsg.mediaType !== 'voice' && (
                  <button
                    onClick={() => handleStartEdit(actionSheetMsg)}
                    className="flex items-center gap-2.5 py-2.5 px-1 text-[12px] text-white cursor-pointer"
                  >
                    <Pencil className="w-4 h-4 text-neutral-400" /> Edit
                  </button>
                )}

                <button
                  onClick={() => {
                    if (activeGroup?.pinnedMessage?.id === actionSheetMsg.id) {
                      handleUnpin();
                    } else {
                      handlePin(actionSheetMsg);
                    }
                    setActionSheetMsg(null);
                  }}
                  className="flex items-center gap-2.5 py-2.5 px-1 text-[12px] text-white cursor-pointer"
                >
                  {activeGroup?.pinnedMessage?.id === actionSheetMsg.id ? (
                    <><PinOff className="w-4 h-4 text-neutral-400" /> Unpin</>
                  ) : (
                    <><Pin className="w-4 h-4 text-neutral-400" /> Pin</>
                  )}
                </button>

                {actionSheetMsg.senderUid === currentUser.uid && (
                  <button
                    onClick={() => { handleUnsend(actionSheetMsg.id); setActionSheetMsg(null); }}
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
    </div>
  );
};
