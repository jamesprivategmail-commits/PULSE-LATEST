import React, { useState, useEffect } from 'react';
import { VideoPost } from '../types';
import { getWatchHistory, clearWatchHistory } from '../services/pulseDb';
import { db, doc, getDoc } from '../backend';
import { X, Clock, Trash2, Play } from 'lucide-react';

interface WatchHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectVideo: (video: VideoPost) => void;
  onToast: (msg: string) => void;
}

export const WatchHistoryModal: React.FC<WatchHistoryModalProps> = ({
  isOpen,
  onClose,
  onSelectVideo,
  onToast
}) => {
  const [historyVideos, setHistoryVideos] = useState<VideoPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setLoading(true);

    async function loadHistory() {
      const ids = getWatchHistory();
      const list: VideoPost[] = [];

      for (const id of ids) {
        try {
          const snap = await getDoc(doc(db, 'videos', id));
          if (snap.exists()) {
            list.push({ id: snap.id, ...snap.data() } as VideoPost);
          }
        } catch (e) {}
      }

      if (isMounted) {
        setHistoryVideos(list);
        setLoading(false);
      }
    }

    loadHistory();

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleClear = () => {
    clearWatchHistory();
    setHistoryVideos([]);
    onToast('Watch history cleared');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 max-w-[480px] mx-auto animate-in fade-in select-none">
      <div className="w-full h-[75vh] max-h-[600px] bg-[#111214] border border-white/10 rounded-2xl flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#25f4ee]" />
            <h3 className="font-extrabold text-sm text-white">Watch History</h3>
          </div>
          <div className="flex items-center gap-2">
            {historyVideos.length > 0 && (
              <button
                onClick={handleClear}
                className="text-xs text-red-400 hover:text-red-300 font-bold px-2 py-1 bg-red-950/40 rounded-lg border border-red-500/20 cursor-pointer flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" /> Clear
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1 rounded-full text-neutral-400 hover:text-white hover:bg-white/10 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-neutral-500 text-xs">
              <div className="w-5 h-5 border-2 border-[#25f4ee] border-t-transparent rounded-full animate-spin mb-2" />
              Loading history...
            </div>
          ) : historyVideos.length === 0 ? (
            <div className="text-center py-16 text-neutral-500 text-xs">
              No watched videos recorded yet. Watch videos on Pulse to populate your history! 📺
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {historyVideos.map((video) => (
                <div
                  key={video.id}
                  onClick={() => {
                    onClose();
                    onSelectVideo(video);
                  }}
                  className="bg-neutral-900 border border-white/10 rounded-xl overflow-hidden cursor-pointer group hover:border-[#25f4ee]/50 transition-all"
                >
                  <div className="aspect-[9/14] bg-black relative">
                    <video
                      src={video.src}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                    <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 flex items-center justify-center">
                      <div className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-white group-hover:scale-110 transition-transform">
                        <Play className="w-4 h-4 fill-white ml-0.5" />
                      </div>
                    </div>
                  </div>
                  <div className="p-2">
                    <b className="text-[11px] text-white block truncate">{video.caption || 'Video'}</b>
                    <span className="text-[10px] text-neutral-400 font-mono block truncate">{video.ownerHandle}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
