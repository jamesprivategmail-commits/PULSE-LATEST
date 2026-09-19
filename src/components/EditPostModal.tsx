import React, { useState, useEffect } from 'react';
import { VideoPost } from '../types';
import { updateVideoPost, deleteVideoPost } from '../services/pulseDb';
import { X, Check, Trash2, Music, Hash } from 'lucide-react';

interface EditPostModalProps {
  video: VideoPost | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdated: () => void;
  onToast: (msg: string) => void;
}

export const EditPostModal: React.FC<EditPostModalProps> = ({
  video,
  isOpen,
  onClose,
  onUpdated,
  onToast
}) => {
  const [caption, setCaption] = useState('');
  const [sound, setSound] = useState('');
  const [tagsStr, setTagsStr] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (video) {
      setCaption(video.caption || '');
      setSound(video.sound || '');
      setTagsStr((video.tags || []).join(' '));
    }
  }, [video]);

  if (!isOpen || !video) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const tagsArray = tagsStr
        .split(/[\s,]+/)
        .map(t => t.replace(/^#/, '').trim())
        .filter(Boolean);

      await updateVideoPost(video.id, {
        caption: caption.trim(),
        sound: sound.trim(),
        tags: tagsArray
      });

      onToast('Post updated successfully! ✨');
      onUpdated();
      onClose();
    } catch (err: any) {
      onToast('Failed to update post: ' + (err.message || 'Error'));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to permanently delete this video?')) return;
    setLoading(true);
    try {
      await deleteVideoPost(video.id);
      onToast('Post deleted.');
      onUpdated();
      onClose();
    } catch (err: any) {
      onToast('Failed to delete post: ' + (err.message || 'Error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xs flex items-center justify-center p-3 max-w-[480px] mx-auto animate-in fade-in">
      <div className="w-full bg-black border border-white/10 rounded-lg p-3.5 shadow-2xl space-y-3">
        <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
          <h3 className="font-extrabold text-sm text-white">Edit Post</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-2.5">
          <div>
            <label className="block text-[11px] font-semibold text-neutral-300 mb-1">Caption</label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={2}
              className="w-full bg-neutral-950 border border-white/10 rounded-lg p-2 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-white resize-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-neutral-300 mb-1 flex items-center gap-1">
              <Music className="w-3 h-3 text-[#25f4ee]" /> Sound Title
            </label>
            <input
              type="text"
              value={sound}
              onChange={(e) => setSound(e.target.value)}
              className="w-full bg-neutral-950 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-white"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-neutral-300 mb-1 flex items-center gap-1">
              <Hash className="w-3 h-3 text-[#ff2b54]" /> Tags (separated by space)
            </label>
            <input
              type="text"
              value={tagsStr}
              onChange={(e) => setTagsStr(e.target.value)}
              placeholder="fyp viral tech"
              className="w-full bg-neutral-950 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-white"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleDelete}
              disabled={loading}
              className="px-2.5 py-1.5 bg-red-950/40 hover:bg-red-900/60 text-red-400 font-bold rounded-lg border border-red-500/20 text-xs cursor-pointer flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-1.5 bg-white hover:bg-neutral-200 text-black font-extrabold rounded-lg text-xs shadow-md cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" /> Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
