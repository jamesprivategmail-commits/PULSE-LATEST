import React, { useState } from 'react';
import { UserProfile, VirtualGift, PKBattle } from '../types';
import { VIRTUAL_GIFTS } from '../constants/gifts';
import { X, Coins, Sparkles, Flame, Plus, Send, Zap } from 'lucide-react';

interface GiftPickerSheetProps {
  isOpen: boolean;
  currentUser: UserProfile | null;
  hostProfile: { uid: string; handle: string; username?: string; avatar: string };
  pkBattle?: PKBattle | null;
  onClose: () => void;
  onSendGift: (gift: VirtualGift, targetTeam?: 'challenger' | 'opponent', receiver?: { uid: string; handle: string; username?: string; avatar: string }) => Promise<void>;
  onOpenRecharge: () => void;
  onRequireAuth: () => void;
  onToast: (msg: string) => void;
}

export const GiftPickerSheet: React.FC<GiftPickerSheetProps> = ({
  isOpen,
  currentUser,
  hostProfile,
  pkBattle,
  onClose,
  onSendGift,
  onOpenRecharge,
  onRequireAuth,
  onToast
}) => {
  const [selectedGift, setSelectedGift] = useState<VirtualGift>(VIRTUAL_GIFTS[0]);
  const [selectedTeam, setSelectedTeam] = useState<'challenger' | 'opponent'>('challenger');
  const [comboMultiplier, setComboMultiplier] = useState<number>(1);
  const [sending, setSending] = useState(false);

  if (!isOpen) return null;

  const currentCoins = currentUser?.walletCoins || 0;

  const handleSend = async () => {
    if (!currentUser) {
      onRequireAuth();
      return;
    }

    if (currentCoins < selectedGift.coins * comboMultiplier) {
      onToast(`Insufficient Pulse Coins! Need ${selectedGift.coins * comboMultiplier} coins.`);
      onOpenRecharge();
      return;
    }

    try {
      setSending(true);
      let targetReceiver = hostProfile;
      if (pkBattle && selectedTeam === 'opponent') {
        targetReceiver = {
          uid: pkBattle.opponentUid,
          handle: pkBattle.opponentHandle,
          username: pkBattle.opponentUsername,
          avatar: pkBattle.opponentAvatar
        };
      }

      for (let i = 0; i < comboMultiplier; i++) {
        await onSendGift(selectedGift, pkBattle ? selectedTeam : undefined, targetReceiver);
      }
      onToast(`Sent ${selectedGift.icon} ${selectedGift.name} ${comboMultiplier > 1 ? `x${comboMultiplier}` : ''}! 🎉`);
    } catch (err: any) {
      onToast(err.message || 'Failed to send gift');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 bg-neutral-950/95 backdrop-blur-xl border-t border-neutral-800 rounded-t-2xl p-3 max-w-[480px] mx-auto select-none animate-in slide-in-from-bottom duration-200">
      {/* 1. TOP HEADER & BALANCE */}
      <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-yellow-500/10 border border-yellow-500/30 px-2 py-0.5 rounded-full">
            <Coins className="w-3.5 h-3.5 text-yellow-400" />
            <span className="text-yellow-400 font-bold text-xs">{currentCoins}</span>
          </div>
          <button
            onClick={onOpenRecharge}
            className="flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-[#25f4ee]/20 hover:bg-[#25f4ee]/30 text-[#25f4ee] text-[10px] font-bold border border-[#25f4ee]/30 transition-colors cursor-pointer"
          >
            <Plus className="w-2.5 h-2.5" />
            <span>Recharge</span>
          </button>
        </div>

        <button
          onClick={onClose}
          className="w-6 h-6 rounded-full bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 2. PK BATTLE TEAM SELECTION (If battle is active) */}
      {pkBattle && pkBattle.status === 'active' && (
        <div className="flex items-center gap-2 my-2 p-1 bg-neutral-900 rounded-xl border border-neutral-800">
          <button
            onClick={() => setSelectedTeam('challenger')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1 px-2 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
              selectedTeam === 'challenger'
                ? 'bg-gradient-to-r from-red-600 to-rose-500 text-white shadow-md'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-red-400 animate-ping" />
            <span>RED Team ({pkBattle.challengerHandle})</span>
          </button>
          <button
            onClick={() => setSelectedTeam('opponent')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1 px-2 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
              selectedTeam === 'opponent'
                ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-md'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
            <span>BLUE Team ({pkBattle.opponentHandle})</span>
          </button>
        </div>
      )}

      {/* 3. VIRTUAL GIFTS GRID (Clean 5 columns) */}
      <div className="grid grid-cols-5 gap-1.5 my-2 max-h-48 overflow-y-auto pr-0.5 scrollbar-none">
        {VIRTUAL_GIFTS.map((gift) => {
          const isSelected = selectedGift.id === gift.id;
          return (
            <div
              key={gift.id}
              onClick={() => setSelectedGift(gift)}
              className={`relative flex flex-col items-center justify-center p-1.5 rounded-xl border cursor-pointer transition-all ${
                isSelected
                  ? 'bg-neutral-800 border-yellow-400 scale-102 shadow-lg shadow-yellow-500/10'
                  : 'bg-neutral-900/60 border-neutral-800 hover:border-neutral-700'
              }`}
            >
              {/* Gift Icon */}
              <div className="text-2xl mb-1 filter drop-shadow animate-in zoom-in-75">
                {gift.icon}
              </div>

              {/* Gift Name */}
              <span className="text-[9.5px] text-white font-medium truncate w-full text-center leading-tight">
                {gift.name}
              </span>

              {/* Coins Cost */}
              <div className="flex items-center gap-0.5 mt-0.5">
                <Coins className="w-2.5 h-2.5 text-yellow-400" />
                <span className="text-[9px] text-yellow-400 font-bold">{gift.coins}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 4. BOTTOM ACTION ROW WITH COMBO MULTIPLIER & SEND BUTTON */}
      <div className="flex items-center justify-between pt-1.5 border-t border-neutral-800 gap-2">
        {/* Quick Combo Multipliers */}
        <div className="flex items-center gap-1">
          {[1, 5, 10, 50].map((num) => (
            <button
              key={num}
              onClick={() => setComboMultiplier(num)}
              className={`px-2 py-1 rounded-md text-[10px] font-bold cursor-pointer transition-colors ${
                comboMultiplier === num
                  ? 'bg-neutral-700 text-yellow-400 border border-yellow-400/40'
                  : 'bg-neutral-900 text-neutral-400 hover:text-white'
              }`}
            >
              x{num}
            </button>
          ))}
        </div>

        {/* Send Gift Button */}
        <button
          onClick={handleSend}
          disabled={sending}
          className="flex-1 max-w-[150px] h-8 bg-gradient-to-r from-yellow-400 to-amber-500 hover:opacity-95 text-black font-black text-xs rounded-full shadow-md flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all disabled:opacity-50"
        >
          <Send className="w-3 h-3" />
          <span>{sending ? 'Sending...' : `Send (${selectedGift.coins * comboMultiplier})`}</span>
        </button>
      </div>
    </div>
  );
};
