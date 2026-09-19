import React, { useState, useEffect } from 'react';
import { VideoPost, VideoComment, UserProfile } from '../types';
import { 
  subscribeToComments, 
  addVideoComment, 
  addCommentReply, 
  togglePinComment
} from '../services/pulseDb';
import { db, doc, deleteDoc, updateDoc, increment } from '../backend';
import { X, Send, Heart, Pin, Trash2, CornerDownRight, Flag, Reply } from 'lucide-react';
import { VerifiedBadge } from './VerifiedBadge';

interface CommentsSheetProps {
  video: VideoPost | null;
  currentUser: UserProfile | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenProfile?: (handle: string, uid?: string) => void;
  onOpenReport?: (type: 'comment', id: string) => void;
  onToast: (msg: string) => void;
  onRequireAuth: () => void;
}

export const CommentsSheet: React.FC<CommentsSheetProps> = ({
  video,
  currentUser,
  isOpen,
  onClose,
  onOpenProfile,
  onOpenReport,
  onToast,
  onRequireAuth
}) => {
  const [comments, setComments] = useState<VideoComment[]>([]);
  const [inputText, setInputText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{ id: string; handle: string } | null>(null);

  useEffect(() => {
    if (!video || !isOpen) return;

    const unsubscribe = subscribeToComments(video.id, (loadedComments) => {
      // Sort pinned comments to top
      const sorted = [...loadedComments].sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
      setComments(sorted);
    });

    return () => unsubscribe();
  }, [video?.id, isOpen]);

  if (!isOpen || !video) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      onRequireAuth();
      return;
    }
    const text = inputText.trim();
    if (!text) return;

    setSubmitting(true);
    try {
      if (replyingTo) {
        await addCommentReply(video.id, replyingTo.id, replyingTo.handle, currentUser, text);
        setReplyingTo(null);
        onToast('Reply posted!');
      } else {
        await addVideoComment(video.id, currentUser, text);
        onToast('Comment posted!');
      }
      setInputText('');
    } catch (err: any) {
      onToast('Failed to post comment: ' + (err.message || 'Error'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleLikeComment = async (comment: VideoComment) => {
    if (!currentUser) {
      onRequireAuth();
      return;
    }
    try {
      const commentRef = doc(db, 'videos', video.id, 'comments', comment.id);
      await updateDoc(commentRef, {
        likes: increment(1)
      });
    } catch (e) {}
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('Delete this comment?')) return;
    try {
      await deleteDoc(doc(db, 'videos', video.id, 'comments', commentId));
      await updateDoc(doc(db, 'videos', video.id), {
        commentCount: increment(-1)
      });
      onToast('Comment deleted');
    } catch (e) {
      onToast('Error deleting comment');
    }
  };

  const handleTogglePin = async (comment: VideoComment) => {
    try {
      const nextPinned = !comment.isPinned;
      await togglePinComment(video.id, comment.id, nextPinned);
      onToast(nextPinned ? 'Comment pinned to top 📌' : 'Comment unpinned');
    } catch (e) {
      onToast('Error updating pin');
    }
  };

  const formatTime = (ts: number) => {
    if (!ts) return 'just now';
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 60) return `${diff}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}d`;
  };

  const isVideoOwner = currentUser?.uid === video.ownerUid;

  return (
    <>
      {/* Backdrop */}
      <div
        id="commentsBackdrop"
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 max-w-[480px] mx-auto animate-in fade-in"
      />

      {/* Sheet Container */}
      <div
        id="commentsSheet"
        className="fixed bottom-0 left-0 right-0 max-w-[480px] mx-auto h-[68vh] bg-black rounded-t-xl z-50 flex flex-col border-t border-white/10 shadow-2xl animate-in slide-in-from-bottom duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-white/10 shrink-0 bg-neutral-950">
          <span className="font-extrabold text-xs text-white">
            {comments.length} Comments
          </span>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-neutral-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Comments List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-black">
          {comments.length === 0 ? (
            <div className="text-center text-neutral-500 text-xs py-12">
              No comments yet. Be the first to start the conversation! 💬
            </div>
          ) : (
            comments.map((comment) => {
              const isOwnComment = currentUser?.uid === comment.uid;

              return (
                <div
                  key={comment.id}
                  className={`flex items-start gap-3 text-sm relative group p-2 rounded-xl transition-colors ${
                    comment.isPinned ? 'bg-white/5 border border-[#25f4ee]/20' : ''
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onOpenProfile?.(comment.who, comment.uid)}
                    className="shrink-0 focus:outline-none group/avatar cursor-pointer"
                    title={`View @${comment.who.replace(/^@/, '')}'s profile`}
                  >
                    <img
                      src={comment.avatar}
                      alt={comment.who}
                      className="w-8 h-8 rounded-full object-cover border border-white/10 group-hover/avatar:border-[#25f4ee] transition-all"
                    />
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <button
                        type="button"
                        onClick={() => onOpenProfile?.(comment.who, comment.uid)}
                        className="font-bold text-xs text-neutral-300 hover:text-[#25f4ee] transition-colors cursor-pointer text-left truncate flex items-center gap-1"
                      >
                        <span>{comment.who}</span>
                        {(comment as any).verified && <VerifiedBadge size="xs" />}
                      </button>
                      {comment.isPinned && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 bg-[#25f4ee]/20 text-[#25f4ee] text-[9px] font-extrabold rounded">
                          <Pin className="w-2.5 h-2.5" /> Pinned
                        </span>
                      )}
                      <span className="text-[10px] text-neutral-500">
                        {formatTime(comment.createdAt)}
                      </span>
                    </div>

                    {comment.replyToHandle && (
                      <span className="text-[11px] text-[#25f4ee] font-semibold block mb-0.5">
                        Replying to {comment.replyToHandle}
                      </span>
                    )}

                    <p className="text-neutral-100 text-xs leading-relaxed break-words">
                      {comment.txt}
                    </p>

                    {/* Sub Actions: Reply, Pin (if video owner), Delete (if own) */}
                    <div className="flex items-center gap-3 mt-1.5 text-[11px] text-neutral-400">
                      <button
                        onClick={() => {
                          setReplyingTo({ id: comment.id, handle: comment.who });
                          setInputText(`@${comment.who.replace(/^@/, '')} `);
                        }}
                        className="hover:text-[#25f4ee] flex items-center gap-1 cursor-pointer font-semibold"
                      >
                        <Reply className="w-3 h-3" /> Reply
                      </button>

                      {isVideoOwner && (
                        <button
                          onClick={() => handleTogglePin(comment)}
                          className="hover:text-[#25f4ee] flex items-center gap-1 cursor-pointer"
                        >
                          <Pin className="w-3 h-3" /> {comment.isPinned ? 'Unpin' : 'Pin'}
                        </button>
                      )}

                      {isOwnComment && (
                        <button
                          onClick={() => handleDeleteComment(comment.id)}
                          className="hover:text-red-400 flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" /> Delete
                        </button>
                      )}

                      {onOpenReport && !isOwnComment && (
                        <button
                          onClick={() => onOpenReport('comment', comment.id)}
                          className="hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                          title="Report comment"
                        >
                          <Flag className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Heart / Like */}
                  <button
                    onClick={() => handleLikeComment(comment)}
                    className="flex flex-col items-center gap-0.5 text-neutral-500 hover:text-[#ff2b54] p-1 transition-colors cursor-pointer shrink-0"
                  >
                    <Heart className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-medium">{comment.likes || 0}</span>
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Replying Banner */}
        {replyingTo && (
          <div className="px-3.5 py-1 bg-neutral-950 border-t border-white/10 flex items-center justify-between text-xs text-neutral-300">
            <span>
              Replying to <b className="text-[#25f4ee]">{replyingTo.handle}</b>
            </span>
            <button
              onClick={() => {
                setReplyingTo(null);
                setInputText('');
              }}
              className="text-neutral-400 hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Input Bar */}
        <form
          onSubmit={handleSubmit}
          className="p-2.5 border-t border-white/10 flex items-center gap-2 bg-neutral-950 shrink-0"
        >
          <img
            src={currentUser?.photoURL || 'https://api.dicebear.com/7.x/avataaars/svg?seed=guest'}
            alt="My Avatar"
            className="w-6 h-6 rounded-full object-cover border border-white/10 shrink-0"
          />
          <input
            id="commentInput"
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={
              replyingTo
                ? `Reply to ${replyingTo.handle}...`
                : currentUser
                ? 'Add a comment...'
                : 'Log in to comment...'
            }
            disabled={submitting}
            className="flex-1 bg-black border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-[#25f4ee]"
          />
          <button
            id="sendComment"
            type="submit"
            disabled={!inputText.trim() || submitting}
            className="text-black bg-[#25f4ee] hover:bg-[#1ee0da] font-bold text-xs px-2.5 py-1 rounded-md disabled:opacity-40 disabled:hover:bg-[#25f4ee] cursor-pointer flex items-center gap-1 shrink-0"
          >
            <Send className="w-3 h-3" />
            Post
          </button>
        </form>
      </div>
    </>
  );
};
