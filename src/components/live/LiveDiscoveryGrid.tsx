import React, { useMemo, useState } from 'react';
import { LiveStream, UserProfile } from '../../types';
import { LIVE_CATEGORIES } from '../../services/pulseDb';
import { LiveCard } from './LiveCard';
import { LiveFeedScreen } from './LiveFeedScreen';
import { rankStreamsByEngagement, filterStreamsByCategory } from '../../utils/liveRanking';
import { LIVE_THEME } from '../../constants/liveTheme';
import { Radio } from 'lucide-react';

interface LiveDiscoveryGridProps {
  streams: LiveStream[];
  currentUser: UserProfile | null;
  onEnterRoom: (stream: LiveStream) => void;
  onRequireAuth: () => void;
}

export const LiveDiscoveryGrid: React.FC<LiveDiscoveryGridProps> = ({
  streams,
  currentUser,
  onEnterRoom,
  onRequireAuth
}) => {
  const [category, setCategory] = useState('all');
  const [feedIndex, setFeedIndex] = useState<number | null>(null);

  const ranked = useMemo(() => rankStreamsByEngagement(streams), [streams]);
  const filtered = useMemo(() => filterStreamsByCategory(ranked, category), [ranked, category]);
  const trending = useMemo(() => ranked.filter(s => s.isTrending).slice(0, 8), [ranked]);

  if (!streams.length) return null;

  return (
    <div>
      <div className="flex items-center justify-between pb-2">
        <span className="text-xs font-bold text-neutral-200 flex items-center gap-1.5">
          <Radio className="w-3.5 h-3.5 text-[#ff2b54] animate-pulse" /> Live Now
        </span>
        <span
          className="text-[10px] px-2 py-0.5 rounded-full font-bold border"
          style={{ background: 'rgba(255,43,84,0.15)', color: LIVE_THEME.coral, borderColor: 'rgba(255,43,84,0.3)' }}
        >
          {streams.length} Broadcasting Now
        </span>
      </div>

      {/* Category chips */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-3">
        {LIVE_CATEGORIES.map(c => {
          const active = c.id === category;
          return (
            <button
              key={c.id}
              onClick={() => setCategory(c.id)}
              className="shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-colors"
              style={{
                background: active ? LIVE_THEME.chipActiveBg : LIVE_THEME.chipInactiveBg,
                color: active ? '#0b0a12' : '#e5e5e5'
              }}
            >
              {c.icon} {c.name}
            </button>
          );
        })}
      </div>

      {/* Trending rail */}
      {trending.length > 0 && (
        <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar pb-3">
          {trending.map(stream => (
            <LiveCard
              key={stream.id}
              stream={stream}
              size="trending"
              onClick={() => setFeedIndex(filtered.findIndex(s => s.id === stream.id) >= 0 ? filtered.findIndex(s => s.id === stream.id) : 0)}
            />
          ))}
        </div>
      )}

      {/* Grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-2 gap-2.5">
          {filtered.map((stream, i) => (
            <LiveCard key={stream.id} stream={stream} size="grid" onClick={() => setFeedIndex(i)} />
          ))}
        </div>
      ) : (
        <p className="text-neutral-500 text-xs text-center py-6">No live streams in this category right now.</p>
      )}

      <LiveFeedScreen
        isOpen={feedIndex !== null}
        streams={filtered}
        startIndex={feedIndex ?? 0}
        currentUser={currentUser}
        onClose={() => setFeedIndex(null)}
        onEnterRoom={(stream) => {
          setFeedIndex(null);
          onEnterRoom(stream);
        }}
        onRequireAuth={onRequireAuth}
      />
    </div>
  );
};
