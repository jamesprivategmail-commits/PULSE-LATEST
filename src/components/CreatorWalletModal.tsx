import React, { useState, useEffect } from 'react';
import { UserProfile, GiftTransaction } from '../types';
import { COIN_PACKAGES, CoinRechargePackage, OPAY_PAYMENT_CONFIG } from '../constants/gifts';
import { rechargeWalletCoins, withdrawCreatorDiamonds } from '../services/pulseDb';
import { 
  X, 
  Coins, 
  Gem, 
  DollarSign, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Sparkles, 
  CreditCard, 
  ShieldCheck, 
  CheckCircle, 
  TrendingUp, 
  History, 
  Award, 
  RefreshCw,
  Copy,
  Check,
  Building2,
  User,
  Smartphone,
  ChevronLeft,
  Info,
  Send,
  ExternalLink
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface CreatorWalletModalProps {
  isOpen: boolean;
  currentUser: UserProfile;
  onClose: () => void;
  onToast: (msg: string) => void;
  onUpdateUser?: (updated: Partial<UserProfile>) => void;
}

export const CreatorWalletModal: React.FC<CreatorWalletModalProps> = ({
  isOpen,
  currentUser,
  onClose,
  onToast,
  onUpdateUser
}) => {
  const [activeTab, setActiveTab] = useState<'recharge' | 'withdraw' | 'history'>('recharge');
  const [selectedPack, setSelectedPack] = useState<CoinRechargePackage>(COIN_PACKAGES[1]);
  const [processing, setProcessing] = useState(false);
  const [withdrawDiamonds, setWithdrawDiamonds] = useState(1000);
  const [payoutMethod, setPayoutMethod] = useState<'opay' | 'paypal' | 'bank' | 'crypto'>('opay');
  const [payoutAddress, setPayoutAddress] = useState('');
  
  // OPay Payment Modal State
  const [showOpayTransferScreen, setShowOpayTransferScreen] = useState(false);
  const [copiedAccount, setCopiedAccount] = useState(false);
  const [senderNameInput, setSenderNameInput] = useState(currentUser.username || currentUser.handle || '');
  const [senderRefInput, setSenderRefInput] = useState('');
  const [lastTelegramLink, setLastTelegramLink] = useState<string | null>(null);

  if (!isOpen) return null;

  const coinsBalance = currentUser.walletCoins || 0;
  const diamondsBalance = currentUser.walletDiamonds || 0;
  const earnedUSD = Number((diamondsBalance * 0.005).toFixed(2)); // 1000 diamonds = $5.00

  // Copy Account Number
  const handleCopyAccount = () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(OPAY_PAYMENT_CONFIG.accountNumber);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = OPAY_PAYMENT_CONFIG.accountNumber;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedAccount(true);
      onToast('OPay Account Number copied to clipboard! 📋');
      setTimeout(() => setCopiedAccount(false), 3000);
    } catch (e) {
      onToast('Account number: 8116324053');
    }
  };

  // Handle OPay Transfer Confirmation -> Redirect to Telegram @nova_tech_1
  const handleConfirmOpayTransfer = async () => {
    try {
      setProcessing(true);
      const totalCoins = selectedPack.coins + selectedPack.bonusCoins;
      const refId = senderRefInput.trim() || 'OPAY_' + Date.now().toString().slice(-6);

      // Record top-up request to Firestore
      await rechargeWalletCoins(currentUser.uid, totalCoins, {
        method: 'opay_transfer',
        amountNGN: selectedPack.priceNGN,
        amountUSD: selectedPack.priceUSD,
        senderName: senderNameInput || currentUser.handle || currentUser.username,
        reference: refId
      });

      // Prepare Telegram pre-filled message for @nova_tech_1
      const messageText = `Hello @${OPAY_PAYMENT_CONFIG.adminTelegram}, I have sent ₦${selectedPack.priceNGN.toLocaleString()} via OPay for ${totalCoins.toLocaleString()} Pulse Coins.\n\n👤 Pulse Username: ${currentUser.handle || '@' + currentUser.username}\n🆔 User UID: ${currentUser.uid}\n💰 Amount Paid: ₦${selectedPack.priceNGN.toLocaleString()}\n🪙 Coins Expected: ${totalCoins.toLocaleString()} Coins\n📝 Sender Name: ${senderNameInput || 'N/A'}\n🔢 Ref / Session ID: ${refId}\n\nPlease verify and use your admin bot to grant my coins.`;
      
      const telegramUrl = `https://t.me/${OPAY_PAYMENT_CONFIG.adminTelegram}?text=${encodeURIComponent(messageText)}`;
      setLastTelegramLink(telegramUrl);

      // Open Telegram
      try {
        window.open(telegramUrl, '_blank');
      } catch (e) {
        window.location.href = telegramUrl;
      }

      onToast(`Redirecting to @${OPAY_PAYMENT_CONFIG.adminTelegram} on Telegram... ✈️`);
    } catch (err: any) {
      onToast(err.message || 'Payment submission failed');
    } finally {
      setProcessing(false);
    }
  };

  // Handle Standard USD Card / Demo Recharge
  const handleDirectRecharge = async () => {
    try {
      setProcessing(true);
      const totalCoins = selectedPack.coins + selectedPack.bonusCoins;
      const newCoins = await rechargeWalletCoins(currentUser.uid, totalCoins, {
        method: 'card_usd',
        amountUSD: selectedPack.priceUSD
      });
      
      if (onUpdateUser) {
        onUpdateUser({ walletCoins: newCoins });
      }

      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
      onToast(`Successfully added ${totalCoins} Pulse Coins! 🪙`);
    } catch (err: any) {
      onToast(err.message || 'Recharge failed');
    } finally {
      setProcessing(false);
    }
  };

  // Handle Creator Diamonds Cashout -> Record & Redirect to Telegram @nova_tech_1
  const handleWithdraw = async () => {
    if (diamondsBalance < withdrawDiamonds || withdrawDiamonds < 500) {
      onToast('Minimum withdrawal is 500 Diamonds ($2.50 USD)');
      return;
    }
    if (!payoutAddress.trim()) {
      onToast('Please enter your payout account details');
      return;
    }

    try {
      setProcessing(true);
      const res = await withdrawCreatorDiamonds(currentUser.uid, withdrawDiamonds, payoutMethod, payoutAddress);
      
      const updatedDiamonds = Math.max(0, diamondsBalance - withdrawDiamonds);
      if (onUpdateUser) {
        onUpdateUser({ walletDiamonds: updatedDiamonds });
      }

      const usdVal = (withdrawDiamonds * 0.005).toFixed(2);
      const ngnVal = (withdrawDiamonds * 7.5).toLocaleString();
      const messageText = `Hello @${OPAY_PAYMENT_CONFIG.adminTelegram}, I have submitted a Cashout request for ${withdrawDiamonds.toLocaleString()} Diamonds (≈ $${usdVal} USD / ₦${ngnVal}).\n\n👤 Pulse Creator: ${currentUser.handle || '@' + currentUser.username}\n🆔 User UID: ${currentUser.uid}\n🏦 Payout Method: ${payoutMethod.toUpperCase()}\n📍 Destination Details: ${payoutAddress}\n\nPlease process my cashout transfer.`;

      const telegramUrl = `https://t.me/${OPAY_PAYMENT_CONFIG.adminTelegram}?text=${encodeURIComponent(messageText)}`;
      
      try {
        window.open(telegramUrl, '_blank');
      } catch (e) {
        window.location.href = telegramUrl;
      }

      confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
      onToast(`Cashout submitted! Opening @${OPAY_PAYMENT_CONFIG.adminTelegram} on Telegram... 💸`);
      setPayoutAddress('');
    } catch (err: any) {
      onToast(err.message || 'Withdrawal failed');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 select-none animate-in fade-in">
      <div className="bg-neutral-950 border border-neutral-800 w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* TOP BAR */}
        <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-neutral-800">
          <div className="flex items-center gap-1.5">
            {showOpayTransferScreen ? (
              <button
                onClick={() => {
                  setShowOpayTransferScreen(false);
                  setLastTelegramLink(null);
                }}
                className="w-6 h-6 rounded-full bg-neutral-900 text-neutral-300 hover:text-white flex items-center justify-center cursor-pointer mr-1"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            ) : null}
            <Coins className="w-4 h-4 text-yellow-400" />
            <h2 className="text-sm font-bold text-white">
              {showOpayTransferScreen ? 'Pay with OPay Transfer' : 'Creator Wallet & Tipping'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-6 h-6 rounded-full bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* BALANCE CARDS (Pulse Coins & Diamonds) - Hide during OPay checkout for focus */}
        {!showOpayTransferScreen && (
          <div className="p-3 bg-gradient-to-b from-neutral-900/80 to-neutral-950 border-b border-neutral-800">
            <div className="grid grid-cols-2 gap-2">
              {/* Coins Card */}
              <div className="bg-neutral-900/90 border border-yellow-500/20 rounded-xl p-2.5 relative overflow-hidden">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-neutral-400 font-medium">Pulse Coins</span>
                  <Coins className="w-3.5 h-3.5 text-yellow-400" />
                </div>
                <p className="text-lg font-black text-yellow-400 leading-none">
                  {coinsBalance.toLocaleString()}
                </p>
                <span className="text-[9px] text-neutral-400 mt-1 block">For sending gifts &amp; tips</span>
              </div>

              {/* Diamonds / Earnings Card */}
              <div className="bg-neutral-900/90 border border-[#25f4ee]/20 rounded-xl p-2.5 relative overflow-hidden">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-neutral-400 font-medium">Diamonds</span>
                  <Gem className="w-3.5 h-3.5 text-[#25f4ee]" />
                </div>
                <p className="text-lg font-black text-[#25f4ee] leading-none">
                  {diamondsBalance.toLocaleString()}
                </p>
                <span className="text-[9px] text-emerald-400 font-semibold mt-1 block">
                  ≈ ${earnedUSD} USD
                </span>
              </div>
            </div>
          </div>
        )}

        {/* TABS NAVIGATION */}
        {!showOpayTransferScreen && (
          <div className="flex border-b border-neutral-800 px-3 bg-neutral-950">
            <button
              onClick={() => setActiveTab('recharge')}
              className={`flex-1 py-2 text-[11px] font-bold border-b-2 transition-colors cursor-pointer ${
                activeTab === 'recharge'
                  ? 'border-yellow-400 text-yellow-400'
                  : 'border-transparent text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Buy Coins
            </button>
            <button
              onClick={() => setActiveTab('withdraw')}
              className={`flex-1 py-2 text-[11px] font-bold border-b-2 transition-colors cursor-pointer ${
                activeTab === 'withdraw'
                  ? 'border-[#25f4ee] text-[#25f4ee]'
                  : 'border-transparent text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Cash Out ($)
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex-1 py-2 text-[11px] font-bold border-b-2 transition-colors cursor-pointer ${
                activeTab === 'history'
                  ? 'border-pink-500 text-pink-400'
                  : 'border-transparent text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Top Gifters
            </button>
          </div>
        )}

        {/* TAB CONTENTS */}
        <div className="p-3 flex-1 overflow-y-auto space-y-3">
          {/* TAB 1: COIN RECHARGE */}
          {activeTab === 'recharge' && !showOpayTransferScreen && (
            <div className="space-y-2.5">
              <div className="grid grid-cols-2 gap-2">
                {COIN_PACKAGES.map((pack) => {
                  const isSelected = selectedPack.id === pack.id;
                  return (
                    <div
                      key={pack.id}
                      onClick={() => setSelectedPack(pack)}
                      className={`relative p-2.5 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-yellow-500/10 border-yellow-400 shadow-md shadow-yellow-500/10'
                          : 'bg-neutral-900/60 border-neutral-800 hover:border-neutral-700'
                      }`}
                    >
                      {pack.isPopular && (
                        <span className="absolute -top-1.5 right-2 px-1.5 py-0.2 bg-gradient-to-r from-pink-500 to-rose-500 text-[8px] font-black text-white rounded-full uppercase">
                          Popular
                        </span>
                      )}
                      {pack.isBestValue && (
                        <span className="absolute -top-1.5 right-2 px-1.5 py-0.2 bg-gradient-to-r from-emerald-500 to-teal-500 text-[8px] font-black text-white rounded-full uppercase">
                          Best Value
                        </span>
                      )}

                      <div className="flex items-center gap-1">
                        <Coins className="w-3.5 h-3.5 text-yellow-400" />
                        <span className="text-xs font-black text-white">{pack.coins}</span>
                        {pack.bonusCoins > 0 && (
                          <span className="text-[9px] text-emerald-400 font-bold">+{pack.bonusCoins}</span>
                        )}
                      </div>

                      <div className="mt-1 flex items-baseline justify-between">
                        <p className="text-[11px] font-black text-[#00c853]">
                          ₦{pack.priceNGN.toLocaleString()}
                        </p>
                        <span className="text-[9px] text-neutral-500">
                          ${pack.priceUSD}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* PAYMENT ACTION BUTTONS */}
              <div className="pt-2 space-y-2">
                {/* Primary: Direct OPay Bank Transfer */}
                <button
                  onClick={() => setShowOpayTransferScreen(true)}
                  className="w-full h-9 bg-gradient-to-r from-[#00c853] to-[#009624] hover:opacity-95 text-white font-black text-xs rounded-xl shadow-md flex items-center justify-center gap-2 active:scale-98 transition-all cursor-pointer border border-emerald-400/30"
                >
                  <Building2 className="w-3.5 h-3.5 text-emerald-200" />
                  <span>Pay ₦{selectedPack.priceNGN.toLocaleString()} via OPay Account</span>
                </button>

                {/* Instant Card / USD Checkout */}
                <button
                  onClick={handleDirectRecharge}
                  disabled={processing}
                  className="w-full h-8 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-300 font-bold text-[11px] rounded-xl flex items-center justify-center gap-1.5 active:scale-98 transition-all cursor-pointer"
                >
                  {processing ? (
                    <RefreshCw className="w-3 h-3 animate-spin" />
                  ) : (
                    <>
                      <CreditCard className="w-3 h-3 text-neutral-400" />
                      <span>Instant Card Checkout (${selectedPack.priceUSD} USD)</span>
                    </>
                  )}
                </button>

                <div className="flex items-center justify-center gap-1.5 text-[9.5px] text-neutral-500 pt-0.5">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  <span>Direct transfer to OPay merchant with Telegram verification</span>
                </div>
              </div>
            </div>
          )}

          {/* OPay TRANSFER CHECKOUT SCREEN */}
          {activeTab === 'recharge' && showOpayTransferScreen && (
            <div className="space-y-3 animate-in fade-in slide-in-from-right-2">
              {/* Selected Amount Banner */}
              <div className="p-2.5 rounded-xl bg-gradient-to-r from-[#00c853]/15 to-[#009624]/10 border border-[#00c853]/30 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-emerald-400 font-bold block">Package Selected</span>
                  <div className="flex items-center gap-1">
                    <Coins className="w-3.5 h-3.5 text-yellow-400" />
                    <span className="text-xs font-black text-white">
                      {selectedPack.coins + selectedPack.bonusCoins} Pulse Coins
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-neutral-400 font-medium block">Total Amount</span>
                  <span className="text-sm font-black text-[#00c853]">
                    ₦{selectedPack.priceNGN.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* OPay Account Details Card */}
              <div className="p-3 rounded-xl bg-neutral-900/90 border border-neutral-800 space-y-2.5">
                <div className="flex items-center justify-between pb-1.5 border-b border-neutral-800">
                  <span className="text-[10.5px] font-bold text-neutral-300">OPay Account Details</span>
                  <span className="px-1.5 py-0.5 bg-[#00c853]/20 text-[#00c853] text-[9px] font-black rounded-md">
                    Instant Bank Transfer
                  </span>
                </div>

                {/* Bank Name */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-400 flex items-center gap-1 text-[11px]">
                    <Building2 className="w-3 h-3 text-neutral-500" /> Bank Name:
                  </span>
                  <span className="font-bold text-white">{OPAY_PAYMENT_CONFIG.bankName}</span>
                </div>

                {/* Account Number with Copy Button */}
                <div className="p-2 rounded-lg bg-black/60 border border-neutral-800 flex items-center justify-between">
                  <div>
                    <span className="text-[9px] text-neutral-400 uppercase font-semibold block">Account Number</span>
                    <span className="text-base font-mono font-black text-yellow-400 tracking-wider">
                      {OPAY_PAYMENT_CONFIG.accountNumber}
                    </span>
                  </div>
                  <button
                    onClick={handleCopyAccount}
                    className={`px-2.5 py-1.5 rounded-lg text-[10.5px] font-bold flex items-center gap-1 cursor-pointer transition-all active:scale-95 ${
                      copiedAccount 
                        ? 'bg-emerald-500 text-black' 
                        : 'bg-yellow-400 hover:bg-yellow-300 text-black'
                    }`}
                  >
                    {copiedAccount ? (
                      <>
                        <Check className="w-3 h-3" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Account Name */}
                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-neutral-400 flex items-center gap-1 text-[11px]">
                    <User className="w-3 h-3 text-neutral-500" /> Account Name:
                  </span>
                  <span className="font-bold text-white text-[11.5px] text-right">
                    {OPAY_PAYMENT_CONFIG.accountName}
                  </span>
                </div>
              </div>

              {/* Payment Verification Details */}
              <div className="space-y-2 bg-neutral-900/50 p-2.5 rounded-xl border border-neutral-800/80">
                <div className="flex items-center gap-1 text-[10px] text-neutral-300">
                  <Info className="w-3 h-3 text-blue-400 shrink-0" />
                  <span>Transfer <b>₦{selectedPack.priceNGN.toLocaleString()}</b>, then tap Next:</span>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-neutral-300 mb-0.5">
                    Your Name / Sender Name (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. John Doe / OPay Name"
                    value={senderNameInput}
                    onChange={(e) => setSenderNameInput(e.target.value)}
                    className="w-full h-7.5 px-2 bg-black/70 border border-neutral-800 rounded-lg text-white text-[11px] focus:outline-none focus:border-[#00c853]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-neutral-300 mb-0.5">
                    Session ID / Transfer Reference (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 2608310001..."
                    value={senderRefInput}
                    onChange={(e) => setSenderRefInput(e.target.value)}
                    className="w-full h-7.5 px-2 bg-black/70 border border-neutral-800 rounded-lg text-white text-[11px] focus:outline-none focus:border-[#00c853]"
                  />
                </div>
              </div>

              {/* Telegram fallback banner if opened */}
              {lastTelegramLink && (
                <a
                  href={lastTelegramLink}
                  target="_blank"
                  rel="noreferrer"
                  className="p-2 bg-[#229ED9]/15 border border-[#229ED9]/40 rounded-xl flex items-center justify-between text-xs text-[#229ED9] hover:bg-[#229ED9]/25 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <Send className="w-3.5 h-3.5" />
                    <span className="font-bold">Tap here to open @{OPAY_PAYMENT_CONFIG.adminTelegram}</span>
                  </div>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}

              {/* Confirm Transfer Button -> Telegram Redirect */}
              <div className="pt-1 space-y-1.5">
                <button
                  onClick={handleConfirmOpayTransfer}
                  disabled={processing}
                  className="w-full h-9 bg-gradient-to-r from-[#229ED9] to-[#0088cc] hover:opacity-95 text-white font-black text-xs rounded-xl shadow-lg shadow-sky-950/40 flex items-center justify-center gap-2 active:scale-98 transition-all cursor-pointer disabled:opacity-50"
                >
                  {processing ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5 text-white fill-white" />
                      <span>Next: Message @{OPAY_PAYMENT_CONFIG.adminTelegram} on Telegram</span>
                    </>
                  )}
                </button>

                <p className="text-[9px] text-neutral-400 text-center flex items-center justify-center gap-1">
                  <ShieldCheck className="w-2.5 h-2.5 text-emerald-400" />
                  Admin will grant coins directly to your wallet via secret bot
                </p>

                <button
                  onClick={() => {
                    setShowOpayTransferScreen(false);
                    setLastTelegramLink(null);
                  }}
                  className="w-full text-center text-[10px] text-neutral-400 hover:text-white py-1 cursor-pointer"
                >
                  Cancel &amp; change package
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: CREATOR CASHOUT */}
          {activeTab === 'withdraw' && (
            <div className="space-y-3">
              <div>
                <label className="block text-[10.5px] font-semibold text-neutral-300 mb-1">
                  Diamonds to Cash Out
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="500"
                    step="100"
                    max={diamondsBalance}
                    value={withdrawDiamonds}
                    onChange={(e) => setWithdrawDiamonds(Number(e.target.value))}
                    className="w-full h-8 px-2.5 bg-neutral-900 border border-neutral-800 rounded-lg text-white text-xs focus:outline-none focus:border-[#25f4ee]"
                  />
                  <span className="absolute right-2.5 top-2 text-[10px] text-emerald-400 font-bold">
                    = ${(withdrawDiamonds * 0.005).toFixed(2)} USD (≈ ₦{(withdrawDiamonds * 7.5).toLocaleString()})
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[10.5px] font-semibold text-neutral-300 mb-1">
                  Payout Method
                </label>
                <div className="grid grid-cols-4 gap-1">
                  {(['opay', 'paypal', 'bank', 'crypto'] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setPayoutMethod(m)}
                      className={`py-1.5 px-1 rounded-lg text-[10px] font-bold capitalize transition-colors cursor-pointer border ${
                        payoutMethod === m
                          ? 'bg-[#25f4ee]/20 border-[#25f4ee] text-[#25f4ee]'
                          : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white'
                      }`}
                    >
                      {m === 'opay' ? 'OPay (NGN)' : m}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10.5px] font-semibold text-neutral-300 mb-1">
                  {payoutMethod === 'opay' 
                    ? 'OPay Phone Number & Account Name' 
                    : payoutMethod === 'paypal' 
                    ? 'PayPal Email Address' 
                    : payoutMethod === 'crypto' 
                    ? 'USDT (TRC20) Wallet Address' 
                    : 'Bank Account Number & Name'}
                </label>
                <input
                  type="text"
                  placeholder={
                    payoutMethod === 'opay' 
                      ? '08123456789 (Your Full Name)' 
                      : payoutMethod === 'paypal' 
                      ? 'creator@gmail.com' 
                      : payoutMethod === 'crypto' 
                      ? 'T...' 
                      : '0123456789 - Access Bank - John Doe'
                  }
                  value={payoutAddress}
                  onChange={(e) => setPayoutAddress(e.target.value)}
                  className="w-full h-8 px-2.5 bg-neutral-900 border border-neutral-800 rounded-lg text-white text-xs focus:outline-none focus:border-[#25f4ee]"
                />
              </div>

              <button
                onClick={handleWithdraw}
                disabled={processing || diamondsBalance < 500}
                className="w-full h-9 bg-gradient-to-r from-[#229ED9] to-[#0088cc] text-white font-black text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 hover:opacity-95 active:scale-98 transition-all cursor-pointer disabled:opacity-50"
              >
                {processing ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5 fill-white" />
                    <span>Submit &amp; Contact @{OPAY_PAYMENT_CONFIG.adminTelegram} on Telegram</span>
                  </>
                )}
              </button>

              <p className="text-[9.5px] text-neutral-400 text-center">
                Submits request &amp; connects you directly to Telegram admin for fast payout.
              </p>
            </div>
          )}

          {/* TAB 3: TOP GIFTERS LEADERBOARD */}
          {activeTab === 'history' && (
            <div className="space-y-2">
              <p className="text-[10px] text-neutral-400 mb-2">
                Top supporters and gifters this week on Pulse:
              </p>

              {[
                { rank: 1, handle: '@mrnovatech', coins: 45200, avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=mrnovatech', badge: '👑' },
                { rank: 2, handle: '@sarah_live', coins: 28400, avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=sarah', badge: '🥈' },
                { rank: 3, handle: '@alex_beats', coins: 15600, avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=alex', badge: '🥉' },
                { rank: 4, handle: '@neon_dancer', coins: 8900, avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=neon' },
                { rank: 5, handle: '@vibe_master', coins: 5200, avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=vibe' }
              ].map((gifter) => (
                <div
                  key={gifter.rank}
                  className="flex items-center justify-between p-2 rounded-xl bg-neutral-900/60 border border-neutral-800"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-neutral-400 w-4 text-center">
                      {gifter.badge || gifter.rank}
                    </span>
                    <div className="w-7 h-7 rounded-full overflow-hidden border border-neutral-700">
                      <img src={gifter.avatar} alt={gifter.handle} className="w-full h-full object-cover" />
                    </div>
                    <span className="text-[11px] font-bold text-white">{gifter.handle}</span>
                  </div>

                  <div className="flex items-center gap-1 text-yellow-400 font-black text-xs">
                    <Coins className="w-3 h-3" />
                    <span>{gifter.coins.toLocaleString()}</span>
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

