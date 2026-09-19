import React, { useState, useEffect } from 'react';
import { UserProfile, Playlist, VideoPost } from '../types';
import { 
  createPlaylist, 
  getUserPlaylists, 
  addVideoToPlaylist, 
  removeVideoFromPlaylist 
} from '../services/pulseDb';
import { X, Plus, ListPlus, Film, Trash2, Check, FolderHeart } from 'lucide-react';

interface PlaylistsModalProps {
  currentUser: UserProfile;
  videoToManage?: VideoPost | null;
  onClose: () => void;
  onToast: (msg: string) => void;
  onSelectPlaylistVideo?: (video: VideoPost) => void;
}

export const PlaylistsModal: React.FC<PlaylistsModalProps> = ({
  currentUser,
  videoToManage,
  onClose,
  onToast,
  onSelectPlaylistVideo
}) => {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPlaylists();
  }, [currentUser.uid]);

  const loadPlaylists = async () => {
    setLoading(true);
    try {
      const list = await getUserPlaylists(currentUser.uid);
      setPlaylists(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setSaving(true);
    try {
      await createPlaylist(currentUser, newTitle, newDesc);
      onToast(`Playlist "${newTitle}" created! 📂`);
      setNewTitle('');
      setNewDesc('');
      setShowCreate(false);
      await loadPlaylists();
    } catch (e: any) {
      onToast('Failed to create playlist: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleVideoInPlaylist = async (playlist: Playlist) => {
    if (!videoToManage) return;
    const isInside = playlist.videoIds.includes(videoToManage.id);
    try {
      if (isInside) {
        await removeVideoFromPlaylist(playlist.id, videoToManage.id);
        onToast(`Removed from "${playlist.title}"`);
      } else {
        await addVideoToPlaylist(playlist.id, videoToManage.id);
        onToast(`Added to "${playlist.title}"! ✅`);
      }
      await loadPlaylists();
    } catch (e: any) {
      onToast('Error updating playlist: ' + e.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 max-w-[480px] mx-auto select-none animate-in fade-in">
      <div className="w-full bg-[#111214] border border-white/15 rounded-3xl p-5 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <FolderHeart className="w-5 h-5 text-[#25f4ee]" />
            <h3 className="font-extrabold text-base text-white">
              {videoToManage ? 'Save to Playlist' : 'Your Playlists'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Create Form or Action */}
        {showCreate ? (
          <form onSubmit={handleCreate} className="space-y-3 py-3 border-b border-white/10">
            <h4 className="text-xs font-bold text-white">New Playlist</h4>
            <input
              type="text"
              placeholder="Playlist name (e.g. Favorite Dances, Comedy Clips)"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              required
              className="w-full bg-neutral-900 border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#25f4ee]"
            />
            <input
              type="text"
              placeholder="Optional description"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              className="w-full bg-neutral-900 border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#25f4ee]"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="flex-1 py-2 bg-neutral-900 text-neutral-300 text-xs font-bold rounded-xl border border-white/10 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !newTitle.trim()}
                className="flex-1 py-2 bg-[#25f4ee] text-black text-xs font-extrabold rounded-xl shadow cursor-pointer disabled:opacity-50"
              >
                {saving ? 'Creating...' : 'Create Playlist'}
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setShowCreate(true)}
            className="w-full my-3 py-2.5 bg-neutral-900/90 hover:bg-neutral-800 border border-dashed border-white/20 text-[#25f4ee] font-bold rounded-2xl text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            <Plus className="w-4 h-4" /> Create New Playlist
          </button>
        )}

        {/* Playlists List */}
        <div className="flex-1 overflow-y-auto space-y-2 py-2">
          {loading ? (
            <div className="text-center py-8 text-neutral-500 text-xs">Loading playlists...</div>
          ) : playlists.length === 0 ? (
            <div className="text-center py-10 text-neutral-500 text-xs space-y-1">
              <Film className="w-8 h-8 mx-auto text-neutral-600 mb-2" />
              <p>No playlists yet.</p>
              <p className="text-[11px] text-neutral-400">Organize your videos and series together!</p>
            </div>
          ) : (
            playlists.map((pl) => {
              const isAdded = videoToManage ? pl.videoIds.includes(videoToManage.id) : false;
              return (
                <div
                  key={pl.id}
                  onClick={() => videoToManage && handleToggleVideoInPlaylist(pl)}
                  className={`flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer ${
                    isAdded
                      ? 'bg-[#25f4ee]/15 border-[#25f4ee]/40'
                      : 'bg-neutral-900/70 border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-neutral-800 flex items-center justify-center text-white">
                      <Film className="w-5 h-5 text-[#25f4ee]" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">{pl.title}</h4>
                      <span className="text-[11px] text-neutral-400">
                        {pl.videoIds?.length || 0} videos
                      </span>
                    </div>
                  </div>

                  {videoToManage && (
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center border ${
                        isAdded
                          ? 'bg-[#25f4ee] border-[#25f4ee] text-black'
                          : 'border-white/30 text-transparent'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
