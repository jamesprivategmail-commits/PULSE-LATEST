import React from 'react';
import { LiveStream } from '../../types';
import { Users, Flame, TrendingUp } from 'lucide-react';
import { formatCount } from '../../utils/formatters';
import { LIVE_THEME } from '../../constants/liveTheme';

interface LiveCardProps {
  stream: LiveStream;
  size?: 'grid' | 'trending';
  onClick: () => void;
}

// Deliberately static — grid tiles show the host's avatar as a stand-in
// cover (no dedicated stream thumbnail is generated) rather than opening
// a real-time video connection per tile. Only the single active slide in
// LiveFeedScreen ever holds a live WebRTC connection (see
// useLiveKitViewer's `active`-gated design).
export const LiveCard: React.FC<LiveCardProps> = ({ stream, size = 'grid', onClick }) => {
  const isTrending = size === 'trending';

  return (
    <button
      onClick={onClick}
      className={`relative overflow-hidden text-left cursor-pointer active:scale-[0.97] transition-transform shrink-0 ${
        isTrending ? 'w-32 aspect-[9/13]' : 'w-full aspect-[9/13]'
      } rounded-2xl`}
      style={{
        background: LIVE_THEME.cardBg,
        border: `1px solid ${LIVE_THEME.cardBorder}`
      }}
    >
      {/* Host avatar as backdrop */}
      <img
        src={stream.hostAvatar}
        alt={stream.hostHandle}
        className="absolute inset-0 w-full h-full object-cover opacity-90"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-black/40" />

      {/* LIVE badge */}
      <div
        className="absolute top-2 left-2 px-1.5 py-0.5 rounded-full flex items-center gap-1 text-[8.5px] font-black uppercase text-white"
        style={{ background: LIVE_THEME.liveBadgeGradient, boxShadow: LIVE_THEME.liveBadgeGlow }}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
        Live
      </div>

      {/* Viewer count */}
      <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-full bg-black/50 backdrop-blur-md flex items-center gap-0.5 text-[8.5px] font-bold text-white">
        <Users className="w-2.5 h-2.5" />
        {formatCount(stream.viewerCount || 0)}
      </div>

      {/* Bottom info */}
      <div className="absolute bottom-0 left-0 right-0 p-2">
        <div className="flex items-center gap-1 mb-0.5">
          <span className="text-[10.5px] font-bold text-white truncate">{stream.hostUsername}</span>
          {stream.isTrending && <TrendingUp className="w-2.5 h-2.5 text-[#a06cff] shrink-0" />}
        </div>
        <p className="text-[9px] text-neutral-300 truncate">{stream.title}</p>
        {!!stream.heartsCount && (
          <div className="flex items-center gap-0.5 mt-0.5 text-[8.5px] text-[#ff2b54] font-bold">
            <Flame className="w-2.5 h-2.5" />
            {formatCount(stream.heartsCount)}
          </div>
        )}
      </div>
    </button>
  );
};
