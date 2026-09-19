import React, { useState } from 'react';
import { UserProfile } from '../types';
import { submitBanAppeal } from '../services/pulseDb';
import { AlertOctagon, Send, CheckCircle, LogOut, MessageSquare, ShieldAlert, Sparkles } from 'lucide-react';

interface BannedScreenProps {
  currentUser: UserProfile;
  onLogout: () => void;
  onToast: (msg: string) => void;
}

export const BannedScreen: React.FC<BannedScreenProps> = ({
  currentUser,
  onLogout,
  onToast
}) => {
  const [appealText, setAppealText] = useState('');
  const [contactInfo, setContactInfo] = useState(currentUser.email || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmitAppeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appealText.trim() || appealText.trim().length < 10) {
      onToast('Please provide a detailed appeal explanation (at least 10 characters).');
      return;
    }

    setIsSubmitting(true);
    try {
      await submitBanAppeal({
        uid: currentUser.uid,
        username: currentUser.username,
        handle: currentUser.handle,
        email: currentUser.email,
        reason: currentUser.banReason || 'Account suspended by Administration',
        appealText: appealText.trim(),
        contactInfo: contactInfo.trim()
      });

      setIsSubmitted(true);
      onToast('Appeal submitted successfully! Admin notified via Telegram.');
    } catch (err: any) {
      console.error('Appeal error:', err);
      onToast('Failed to submit appeal: ' + (err.message || 'Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const banDateFormatted = currentUser.bannedAt
    ? new Date(currentUser.bannedAt).toLocaleString()
    : 'Recently';

  return (
    <div className="fixed inset-0 z-50 bg-[#0c0d0f] text-white flex flex-col justify-between max-w-[480px] mx-auto overflow-y-auto p-6 select-none animate-in fade-in">
      {/* Header */}
      <div className="pt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#25f4ee] to-[#ff2b54] flex items-center justify-center font-black text-black text-lg">
              P
            </div>
            <span className="font-extrabold text-2xl tracking-tighter bg-gradient-to-r from-[#25f4ee] to-[#ff2b54] bg-clip-text text-transparent">
              Pulse
            </span>
          </div>

          <button
            onClick={onLogout}
            className="text-neutral-400 hover:text-red-400 px-3 py-1.5 rounded-lg bg-neutral-900 border border-white/10 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" /> Log Out
          </button>
        </div>
      </div>

      {/* Main Body */}
      <div className="my-auto py-8">
        <div className="w-16 h-16 rounded-3xl bg-[#ff2b54]/20 border border-[#ff2b54]/40 text-[#ff2b54] flex items-center justify-center mx-auto mb-4 shadow-xl">
          <AlertOctagon className="w-8 h-8" />
        </div>

        <h1 className="text-2xl font-black text-center text-white">
          Account Suspended
        </h1>
        <p className="text-neutral-400 text-xs text-center max-w-[320px] mx-auto mt-1.5">
          Your account <span className="text-[#25f4ee] font-bold">{currentUser.handle}</span> has been restricted from posting, commenting, and interacting.
        </p>

        {/* Reason Card */}
        <div className="mt-5 bg-neutral-900/90 border border-[#ff2b54]/30 rounded-2xl p-4 text-xs space-y-2 shadow-inner">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="font-semibold text-neutral-300 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-[#ff2b54]" /> Ban Reason:
            </span>
            <span className="text-[10px] text-neutral-500">{banDateFormatted}</span>
          </div>
          <p className="text-white font-medium pl-5 bg-[#ff2b54]/10 py-2 px-3 rounded-lg border border-[#ff2b54]/20">
            {currentUser.banReason || 'Violation of community safety and guidelines.'}
          </p>
          {!!currentUser.suspendedUntil && currentUser.suspendedUntil > Date.now() && (
            <p className="text-[10px] text-neutral-400 pl-5">
              This is a temporary suspension — your account will be restored automatically on {new Date(currentUser.suspendedUntil).toLocaleString()}.
            </p>
          )}
        </div>

        {/* Appeal Form Section */}
        {!isSubmitted ? (
          <div className="mt-6 bg-neutral-900/60 border border-white/10 rounded-2xl p-5 shadow-lg">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare className="w-4 h-4 text-[#25f4ee]" />
              <h2 className="text-sm font-bold text-white">Submit an Unban Appeal</h2>
            </div>
            <p className="text-xs text-neutral-400 mb-4 leading-relaxed">
              If you believe this action was taken in error or want your account reviewed by the Telegram administrator (<span className="text-[#25f4ee] font-mono font-bold">@nova_tech_1</span>), submit your explanation below.
            </p>

            <form onSubmit={handleSubmitAppeal} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-neutral-400 mb-1">
                  Why should your account be reinstated?
                </label>
                <textarea
                  rows={4}
                  value={appealText}
                  onChange={(e) => setAppealText(e.target.value)}
                  placeholder="Explain the situation clearly and respectfully..."
                  required
                  className="w-full bg-black/60 border border-white/10 rounded-xl p-3 text-xs text-white placeholder:text-neutral-600 focus:outline-none focus:border-[#25f4ee] transition-colors resize-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-neutral-400 mb-1">
                  Contact Info / Telegram Username (Optional)
                </label>
                <input
                  type="text"
                  value={contactInfo}
                  onChange={(e) => setContactInfo(e.target.value)}
                  placeholder="@your_telegram or email address"
                  className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-neutral-600 focus:outline-none focus:border-[#25f4ee]"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 bg-[#25f4ee] hover:bg-[#1ee0da] text-black font-extrabold rounded-xl text-xs shadow-lg transition-all active:scale-[0.99] cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
              >
                {isSubmitting ? (
                  <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" /> Submit Appeal to Admin Bot
                  </>
                )}
              </button>
            </form>
          </div>
        ) : (
          <div className="mt-6 bg-[#25f4ee]/10 border border-[#25f4ee]/30 rounded-2xl p-6 text-center space-y-3 animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-full bg-[#25f4ee]/20 text-[#25f4ee] flex items-center justify-center mx-auto">
              <CheckCircle className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-white">Appeal Transmitted to Telegram Bot</h3>
            <p className="text-xs text-neutral-300 leading-relaxed max-w-[280px] mx-auto">
              Your appeal has been received and dispatched to administrator <span className="text-[#25f4ee] font-bold">@nova_tech_1</span>. You will be unbanned once approved.
            </p>
            <div className="pt-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-white/10 text-neutral-300">
                <Sparkles className="w-3.5 h-3.5 text-[#25f4ee]" /> Status: Pending Review
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="text-center text-[10px] text-neutral-600 pb-2">
        Pulse Platform Security &amp; Moderation • Controlled via Telegram Bot
      </div>
    </div>
  );
};
