import React, { useState, useEffect } from 'react';
import { PKBattle, UserProfile } from '../types';
import { Swords, Flame, Zap, Trophy, Crown, Sparkles, X, Plus } from 'lucide-react';
import confetti from 'canvas-confetti';

interface PKBattleOverlayProps {
  pkBattle: PKBattle;
  isHost: boolean;
  currentUser: UserProfile | null;
  onEndBattle?: () => void;
  onSendQuickGift?: (team: 'challenger' | 'opponent') => void;
}

export const PKBattleOverlay: React.FC<PKBattleOverlayProps> = ({
  pkBattle,
  isHost,
  currentUser,
  onEndBattle,
  onSendQuickGift
}) => {
  const [secondsRemaining, setSecondsRemaining] = useState<number>(0);
  const [isBonusFrenzy, setIsBonusFrenzy] = useState(false);

  useEffect(() => {
    const calculateTime = () => {
      const remaining = Math.max(0, Math.floor((pkBattle.endsAt - Date.now()) / 1000));
      setSecondsRemaining(remaining);
      setIsBonusFrenzy(remaining <= 30 && remaining > 0);
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [pkBattle.endsAt]);

  // Trigger celebration on end
  useEffect(() => {
    if (pkBattle.status === 'ended' && pkBattle.winnerUid && pkBattle.winnerUid !== 'draw') {
      confetti({
        particleCount: 100,
        spread: 80,
        origin: { y: 0.4 }
      });
    }
  }, [pkBattle.status, pkBattle.winnerUid]);

  const totalScore = (pkBattle.challengerScore || 0) + (pkBattle.opponentScore || 0);
  const challengerPercent = totalScore > 0 
    ? Math.round(((pkBattle.challengerScore || 0) / totalScore) * 100)
    : 50;
  const opponentPercent = 100 - challengerPercent;

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const formattedTime = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

  return (
    <div className="absolute inset-x-0 top-12 z-30 px-2 pointer-events-none select-none">
      {/* 1. PK BATTLE TOP TUG-OF-WAR METER */}
      <div className="max-w-md mx-auto pointer-events-auto bg-black/80 backdrop-blur-md rounded-2xl p-2 border border-white/15 shadow-2xl">
        {/* Creator Avatars & Live Scores */}
        <div className="flex items-center justify-between mb-1">
          {/* Team RED (Challenger) */}
          <div className="flex items-center gap-1.5">
            <div className="relative w-8 h-8 rounded-full overflow-hidden border-2 border-red-500 shadow-md">
              <img
                src={pkBattle.challengerAvatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=challenger'}
                alt={pkBattle.challengerHandle}
                className="w-full h-full object-cover"
              />
              {pkBattle.status === 'ended' && pkBattle.winnerUid === pkBattle.challengerUid && (
                <div className="absolute inset-0 bg-yellow-500/60 flex items-center justify-center">
                  <Crown className="w-4 h-4 text-white fill-yellow-400" />
                </div>
              )}
            </div>
            <div>
              <div className="flex items-center gap-1">
                <span className="text-[10.5px] font-bold text-red-400 truncate max-w-[80px]">
                  {pkBattle.challengerHandle}
                </span>
                <span className="text-[8px] bg-red-600/80 text-white font-black px-1 rounded">RED</span>
              </div>
              <span className="text-xs font-black text-white leading-none">
                {(pkBattle.challengerScore || 0).toLocaleString()}
              </span>
            </div>
          </div>

          {/* Center VS Badge & Timer */}
          <div className="flex flex-col items-center">
            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full border shadow-sm ${
              isBonusFrenzy
                ? 'bg-gradient-to-r from-red-600 to-amber-600 border-yellow-400 animate-pulse text-yellow-200'
                : 'bg-neutral-800 border-neutral-700 text-white'
            }`}>
              {isBonusFrenzy ? (
                <>
                  <Flame className="w-3 h-3 text-yellow-300 animate-bounce" />
                  <span className="text-[9.5px] font-black tracking-wide">2X FRENZY: {formattedTime}</span>
                </>
              ) : (
                <>
                  <Swords className="w-3 h-3 text-amber-400" />
                  <span className="text-[10px] font-bold">{pkBattle.status === 'ended' ? 'BATTLE OVER' : formattedTime}</span>
                </>
              )}
            </div>
            {isHost && pkBattle.status === 'active' && onEndBattle && (
              <button
                onClick={onEndBattle}
                className="text-[8.5px] text-neutral-400 hover:text-red-400 underline mt-0.5 cursor-pointer"
              >
                End PK
              </button>
            )}
          </div>

          {/* Team BLUE (Opponent) */}
          <div className="flex items-center gap-1.5 text-right flex-row-reverse">
            <div className="relative w-8 h-8 rounded-full overflow-hidden border-2 border-blue-500 shadow-md">
              <img
                src={pkBattle.opponentAvatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=opponent'}
                alt={pkBattle.opponentHandle}
                className="w-full h-full object-cover"
              />
              {pkBattle.status === 'ended' && pkBattle.winnerUid === pkBattle.opponentUid && (
                <div className="absolute inset-0 bg-yellow-500/60 flex items-center justify-center">
                  <Crown className="w-4 h-4 text-white fill-yellow-400" />
                </div>
              )}
            </div>
            <div>
              <div className="flex items-center gap-1 justify-end">
                <span className="text-[8px] bg-blue-600/80 text-white font-black px-1 rounded">BLUE</span>
                <span className="text-[10.5px] font-bold text-blue-400 truncate max-w-[80px]">
                  {pkBattle.opponentHandle}
                </span>
              </div>
              <span className="text-xs font-black text-white leading-none">
                {(pkBattle.opponentScore || 0).toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* 2. DYNAMIC TUG-OF-WAR PROGRESS BAR */}
        <div className="relative w-full h-2.5 bg-neutral-900 rounded-full overflow-hidden flex border border-white/10">
          {/* Challenger RED Bar */}
          <div
            style={{ width: `${challengerPercent}%` }}
            className="h-full bg-gradient-to-r from-rose-600 via-red-500 to-amber-500 transition-all duration-500"
          />
          {/* Opponent BLUE Bar */}
          <div
            style={{ width: `${opponentPercent}%` }}
            className="h-full bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600 transition-all duration-500"
          />

          {/* Center Dividing Bolt */}
          <div className="absolute left-1/2 top-0 bottom-0 -translate-x-1/2 w-3 bg-white/20 flex items-center justify-center">
            <Zap className="w-2 h-2 text-white fill-white" />
          </div>
        </div>

        {/* 3. RECENT CONTRIBUTIONS TICKER */}
        {pkBattle.recentGifts && pkBattle.recentGifts.length > 0 && (
          <div className="flex items-center gap-1.5 mt-1 overflow-x-auto scrollbar-none py-0.5">
            {pkBattle.recentGifts.slice(0, 3).map((g) => (
              <div
                key={g.id}
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[8.5px] font-bold shrink-0 ${
                  g.targetTeam === 'challenger'
                    ? 'bg-red-500/20 border border-red-500/30 text-red-300'
                    : 'bg-blue-500/20 border border-blue-500/30 text-blue-300'
                }`}
              >
                <span>{g.giftIcon}</span>
                <span className="truncate max-w-[60px]">{g.senderHandle}</span>
                <span>+{g.points}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. VICTORY / DEFEAT BANNER (When Ended) */}
      {pkBattle.status === 'ended' && (
        <div className="mt-3 max-w-xs mx-auto bg-gradient-to-r from-neutral-900 via-black to-neutral-900 border-2 border-yellow-400 rounded-2xl p-3 text-center shadow-2xl animate-in zoom-in-75 duration-300 pointer-events-auto">
          <div className="flex justify-center mb-1">
            <Trophy className="w-8 h-8 text-yellow-400 animate-bounce" />
          </div>
          <h3 className="text-base font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-pink-400 to-cyan-300 uppercase">
            {pkBattle.winnerUid === 'draw'
              ? "IT'S A DRAW!"
              : pkBattle.winnerUid === pkBattle.challengerUid
              ? `🏆 ${pkBattle.challengerHandle} WINS!`
              : `🏆 ${pkBattle.opponentHandle} WINS!`}
          </h3>
          <p className="text-[10px] text-neutral-300 mt-0.5">
            Final Score: {pkBattle.challengerScore.toLocaleString()} vs {pkBattle.opponentScore.toLocaleString()}
          </p>
        </div>
      )}
    </div>
  );
};
