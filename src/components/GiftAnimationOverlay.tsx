import React, { useEffect, useState } from 'react';
import { GiftTransaction } from '../types';
import confetti from 'canvas-confetti';
import { Sparkles, Flame, Zap, Crown } from 'lucide-react';

interface GiftAnimationOverlayProps {
  gifts: GiftTransaction[];
}

export const GiftAnimationOverlay: React.FC<GiftAnimationOverlayProps> = ({ gifts }) => {
  const [activeBanner, setActiveBanner] = useState<GiftTransaction | null>(null);
  const [specialEffect, setSpecialEffect] = useState<{
    icon: string;
    name: string;
    type: string;
    color: string;
  } | null>(null);

  useEffect(() => {
    if (gifts.length === 0) return;
    const latestGift = gifts[gifts.length - 1];
    
    // Trigger floating banner
    setActiveBanner(latestGift);

    // Trigger special full-screen effects for rare/epic/legendary gifts
    if (latestGift.coins >= 30) {
      setSpecialEffect({
        icon: latestGift.giftIcon,
        name: latestGift.giftName,
        type: latestGift.coins >= 1000 ? 'legendary' : latestGift.coins >= 100 ? 'epic' : 'rare',
        color: latestGift.coins >= 1000 ? '#ffd32a' : '#25f4ee'
      });

      // Confetti burst
      confetti({
        particleCount: latestGift.coins >= 500 ? 120 : 60,
        spread: 90,
        origin: { y: 0.5 }
      });
    }

    const timer = setTimeout(() => {
      setActiveBanner(null);
      setSpecialEffect(null);
    }, 4500);

    return () => clearTimeout(timer);
  }, [gifts]);

  return (
    <div className="absolute inset-0 pointer-events-none z-40 overflow-hidden">
      {/* 1. FLOATING GIFT NOTIFICATION BANNER (Top Left) */}
      {activeBanner && (
        <div className="absolute top-16 left-3 animate-in slide-in-from-left duration-300">
          <div className="flex items-center gap-2 bg-gradient-to-r from-black/80 via-neutral-900/90 to-black/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-yellow-400/40 shadow-xl max-w-xs">
            <div className="w-7 h-7 rounded-full overflow-hidden border border-yellow-400/80 shrink-0">
              <img
                src={activeBanner.senderAvatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=user'}
                alt={activeBanner.senderHandle}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1 min-w-0 pr-1">
              <p className="text-[10px] font-bold text-yellow-300 truncate">
                {activeBanner.senderHandle}
              </p>
              <p className="text-[9px] text-white/90 truncate flex items-center gap-1">
                Sent <span className="font-semibold text-white">{activeBanner.giftName}</span>
                {activeBanner.targetTeam && (
                  <span className={`text-[8px] font-bold px-1 rounded ${activeBanner.targetTeam === 'challenger' ? 'bg-red-500/80 text-white' : 'bg-blue-500/80 text-white'}`}>
                    {activeBanner.targetTeam === 'challenger' ? 'RED' : 'BLUE'}
                  </span>
                )}
              </p>
            </div>
            <div className="text-2xl animate-bounce shrink-0 filter drop-shadow">
              {activeBanner.giftIcon}
            </div>
          </div>
        </div>
      )}

      {/* 2. FULL SCREEN SPECIAL EFFECT OVERLAY (For High Tier Gifts) */}
      {specialEffect && (
        <div className="absolute inset-0 flex flex-col items-center justify-center animate-in zoom-in-50 duration-500 bg-black/30 backdrop-blur-xs">
          <div className="relative flex flex-col items-center">
            {/* Pulsing Light Glow */}
            <div className="absolute w-48 h-48 rounded-full bg-gradient-to-r from-yellow-400/30 to-pink-500/30 blur-2xl animate-pulse" />
            
            <div className="text-7xl mb-2 animate-bounce transform hover:scale-110 transition-transform filter drop-shadow-2xl">
              {specialEffect.icon}
            </div>

            <div className="flex items-center gap-1.5 px-4 py-1 rounded-full bg-black/80 backdrop-blur-md border border-yellow-400/50 shadow-2xl">
              <Sparkles className="w-4 h-4 text-yellow-400 animate-spin" />
              <span className="text-sm font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-pink-400 to-cyan-300 uppercase tracking-wide">
                {specialEffect.name}
              </span>
              <Sparkles className="w-4 h-4 text-yellow-400 animate-spin" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
