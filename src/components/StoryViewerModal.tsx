import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, StoryItem } from '../types';
import { recordStoryView, deleteStory } from '../services/pulseDb';
import { X, Trash2, Heart, MessageCircle, Send, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import { VerifiedBadge } from './VerifiedBadge';

interface StoryViewerModalProps {
  stories: StoryItem[];
  initialIndex?: number;
  currentUser: UserProfile | null;
  onClose: () => void;
  onOpenProfile: (handle: string, uid: string) => void;
  onToast: (msg: string) => void;
  onRequireAuth: () => void;
  onReplyToStory?: (story: StoryItem, text: string) => void;
}

export const StoryViewerModal: React.FC<StoryViewerModalProps> = ({
  stories,
  initialIndex = 0,
  currentUser,
  onClose,
  onOpenProfile,
  onToast,
  onRequireAuth,
  onReplyToStory
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [showViewers, setShowViewers] = useState(false);

  const currentStory = stories[currentIndex];
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressTimerRef = useRef<any>(null);

  // Mark viewed
  useEffect(() => {
    if (currentStory && currentUser) {
      recordStoryView(currentStory.id, currentUser);
    }
  }, [currentStory?.id, currentUser?.uid]);

  // Story auto-advance progress timer (5 seconds for photos, or video duration)
  useEffect(() => {
    if (isPaused || !currentStory) return;
    setProgress(0);

    const stepMs = 50;
    const totalDurationMs = currentStory.mediaType === 'video' ? 10000 : 5000;
    const increment = (stepMs / totalDurationMs) * 100;

    progressTimerRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressTimerRef.current);
          handleNext();
          return 0;
        }
        return prev + increment;
      });
    }, stepMs);

    return () => clearInterval(progressTimerRef.current);
  }, [currentIndex, isPaused, currentStory?.id]);

  const handleNext = () => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setProgress(0);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setProgress(0);
    }
  };

  const handleDeleteCurrent = async () => {
    if (!currentStory) return;
    if (confirm('Delete this story?')) {
      await deleteStory(currentStory.id);
      onToast('Story deleted');
      if (stories.length <= 1) {
        onClose();
      } else {
        handleNext();
      }
    }
  };

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !currentStory) return;
    if (!currentUser) {
      onRequireAuth();
      return;
    }
    if (onReplyToStory) {
      onReplyToStory(currentStory, replyText.trim());
      onToast('Reply sent to creator inbox! 💬');
      setReplyText('');
    }
  };

  const handleQuickReaction = (emoji: string) => {
    if (!currentUser) {
      onRequireAuth();
      return;
    }
    if (onReplyToStory && currentStory) {
      onReplyToStory(currentStory, emoji);
      onToast(`Reacted with ${emoji}`);
    }
  };

  if (!currentStory) return null;

  const isOwner = currentUser?.uid === currentStory.ownerUid;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center select-none max-w-[480px] mx-auto">
      {/* Segmented Top Progress Bars */}
      <div className="absolute top-3 left-3 right-3 z-30 flex items-center gap-1.5">
        {stories.map((s, idx) => (
          <div key={s.id} className="flex-1 h-1 bg-white/25 rounded-full overflow-hidden">
            <div
              className="h-full bg-white transition-all duration-75"
              style={{
                width:
                  idx < currentIndex
                    ? '100%'
                    : idx === currentIndex
                    ? `${progress}%`
                    : '0%'
              }}
            />
          </div>
        ))}
      </div>

      {/* Top Header Bar: User Info & Close */}
      <div className="absolute top-6 left-3 right-3 z-30 flex items-center justify-between">
        <div
          onClick={() => {
            onClose();
            onOpenProfile(currentStory.ownerHandle, currentStory.ownerUid);
          }}
          className="flex items-center gap-2 cursor-pointer bg-black/40 backdrop-blur-md px-3 py-1 rounded-full border border-white/10"
        >
          <img
            src={currentStory.ownerAvatar}
            alt={currentStory.ownerHandle}
            className="w-7 h-7 rounded-full object-cover border border-[#25f4ee]"
          />
          <div className="flex items-center gap-1">
            <span className="text-xs font-bold text-white">{currentStory.ownerHandle}</span>
            <span className="text-[10px] text-neutral-400">
              • {Math.max(1, Math.floor((Date.now() - currentStory.createdAt) / (1000 * 60)))}m
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {isOwner && (
            <>
              <button
                onClick={() => setShowViewers(!showViewers)}
                className="p-1.5 rounded-full bg-black/40 backdrop-blur-md text-white text-xs font-bold flex items-center gap-1 cursor-pointer border border-white/10"
              >
                <Eye className="w-3.5 h-3.5 text-[#25f4ee]" />
                <span>{currentStory.viewsCount || currentStory.viewers?.length || 0}</span>
              </button>
              <button
                onClick={handleDeleteCurrent}
                className="p-1.5 rounded-full bg-black/40 backdrop-blur-md text-red-400 hover:text-red-300 cursor-pointer border border-white/10"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}

          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-black/40 backdrop-blur-md text-white hover:bg-black/70 cursor-pointer border border-white/10"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Story Media (Image or Video) with tap-to-pause & tap left/right navigation */}
      <div
        onMouseDown={() => setIsPaused(true)}
        onMouseUp={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
        className="relative w-full h-full flex items-center justify-center bg-neutral-950"
      >
        {currentStory.mediaType === 'video' ? (
          <video
            ref={videoRef}
            src={currentStory.mediaUrl}
            autoPlay
            playsInline
            muted={false}
            className="w-full h-full object-cover"
          />
        ) : (
          <img
            src={currentStory.mediaUrl}
            alt="Story"
            className="w-full h-full object-cover"
          />
        )}

        {/* Left / Right Invisible Tap Zones */}
        <div
          onClick={(e) => {
            e.stopPropagation();
            handlePrev();
          }}
          className="absolute left-0 top-16 bottom-20 w-1/3 z-20 cursor-pointer"
        />
        <div
          onClick={(e) => {
            e.stopPropagation();
            handleNext();
          }}
          className="absolute right-0 top-16 bottom-20 w-2/3 z-20 cursor-pointer"
        />

        {/* Caption overlay */}
        {currentStory.caption && (
          <div className="absolute bottom-24 left-4 right-4 z-20 p-3 rounded-2xl bg-black/60 backdrop-blur-md border border-white/10 text-white text-xs font-medium">
            {currentStory.caption}
          </div>
        )}
      </div>

      {/* Viewers Drawer */}
      {showViewers && isOwner && (
        <div className="absolute inset-x-0 bottom-0 max-h-[60%] bg-neutral-900 border-t border-white/15 rounded-t-3xl p-4 z-40 overflow-y-auto shadow-2xl animate-in slide-in-from-bottom">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
              <Eye className="w-4 h-4 text-[#25f4ee]" /> Story Viewers ({currentStory.viewers?.length || 0})
            </h4>
            <button onClick={() => setShowViewers(false)} className="text-neutral-400 hover:text-white cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
          {(!currentStory.viewers || currentStory.viewers.length === 0) ? (
            <p className="text-xs text-neutral-500 py-6 text-center">No views yet. Followers will see it here!</p>
          ) : (
            <div className="space-y-2">
              {currentStory.viewers.map((v, i) => (
                <div
                  key={i}
                  onClick={() => {
                    onClose();
                    onOpenProfile(v.handle, v.uid);
                  }}
                  className="flex items-center gap-2.5 p-2 rounded-xl bg-black/40 hover:bg-black/60 cursor-pointer"
                >
                  <img src={v.avatar} alt={v.handle} className="w-8 h-8 rounded-full object-cover" />
                  <span className="text-xs font-bold text-white">{v.handle}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Bottom Reply Bar & Quick Emojis (for other users) */}
      {!isOwner && (
        <div className="absolute bottom-3 left-3 right-3 z-30 space-y-2">
          {/* Quick Reaction Emojis */}
          <div className="flex items-center justify-around bg-black/40 backdrop-blur-md py-1.5 px-3 rounded-full border border-white/10">
            {['🔥', '❤️', '😂', '👏', '😮', '😍'].map(emoji => (
              <button
                key={emoji}
                type="button"
                onClick={() => handleQuickReaction(emoji)}
                className="text-lg hover:scale-125 active:scale-95 transition-transform cursor-pointer"
              >
                {emoji}
              </button>
            ))}
          </div>

          <form onSubmit={handleSendReply} className="flex items-center gap-2">
            <input
              type="text"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder={`Send message to ${currentStory.ownerHandle}...`}
              className="flex-1 bg-black/60 backdrop-blur-md border border-white/20 rounded-full px-4 py-2 text-xs text-white placeholder-neutral-400 focus:outline-none focus:border-[#25f4ee]"
            />
            <button
              type="submit"
              disabled={!replyText.trim()}
              className="p-2 rounded-full bg-[#25f4ee] text-black font-bold disabled:opacity-30 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
