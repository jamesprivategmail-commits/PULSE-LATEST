import React, { useState } from 'react';
import { UserProfile } from '../types';
import { 
  sendFeedbackToOwner, 
  OWNER_EMAIL, 
  OWNER_HANDLE, 
  OWNER_USERNAME 
} from '../services/pulseDb';
import { 
  X, 
  Send, 
  Bug, 
  MessageSquare, 
  Lightbulb, 
  HelpCircle, 
  ShieldCheck, 
  UploadCloud, 
  CheckCircle2, 
  Laptop, 
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { VerifiedBadge } from './VerifiedBadge';

interface FeedbackOwnerModalProps {
  isOpen: boolean;
  currentUser: UserProfile | null;
  onClose: () => void;
  onToast: (msg: string) => void;
  onRequireAuth: () => void;
  onDirectMessageOwner: () => void;
}

export const FeedbackOwnerModal: React.FC<FeedbackOwnerModalProps> = ({
  isOpen,
  currentUser,
  onClose,
  onToast,
  onRequireAuth,
  onDirectMessageOwner
}) => {
  const [feedbackType, setFeedbackType] = useState<'feedback' | 'bug_report' | 'feature_request' | 'support'>('feedback');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Video Player & Feed');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      onRequireAuth();
      return;
    }
    if (!subject.trim() || !description.trim()) {
      onToast('Please provide a subject and details');
      return;
    }

    setSubmitting(true);
    try {
      await sendFeedbackToOwner({
        uid: currentUser.uid,
        handle: currentUser.handle,
        username: currentUser.username,
        email: currentUser.email || OWNER_EMAIL,
        type: feedbackType,
        subject: subject.trim(),
        description: description.trim(),
        category,
        systemDiagnostics: {
          browser: navigator.userAgent.includes('Chrome') ? 'Chrome' : 'Standard Web',
          os: navigator.platform || 'Web',
          screenResolution: `${window.innerWidth}x${window.innerHeight}`,
          timestamp: Date.now(),
          url: window.location.href
        }
      });

      setSubmitted(true);
      onToast('Message successfully dispatched to platform architect @mrnovatech! 🚀');
    } catch (err: any) {
      onToast('Failed to submit: ' + (err.message || 'Error'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 max-w-[540px] mx-auto animate-in fade-in select-none">
      <div className="w-full max-h-[90vh] bg-[#121316] border border-white/15 rounded-3xl flex flex-col shadow-2xl overflow-hidden text-white">
        
        {/* Top Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-[#171920] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-[#25f4ee] to-[#ff2b54] flex items-center justify-center shadow-lg">
              <Sparkles className="w-5 h-5 text-black" />
            </div>
            <div>
              <h2 className="text-base font-black text-white flex items-center gap-1.5">
                Owner Direct Channel
              </h2>
              <p className="text-[11px] text-neutral-400">Direct link to @mrnovatech &amp; Engineering Team</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-neutral-400 hover:text-white hover:bg-white/10 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Founder Card Banner */}
        <div className="p-4 bg-gradient-to-r from-neutral-900 to-black border-b border-white/10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative">
              <img
                src="https://api.dicebear.com/7.x/bottts/svg?seed=mrnovatech"
                alt="mrnovatech"
                className="w-12 h-12 rounded-2xl border-2 border-[#25f4ee] object-cover bg-neutral-950 p-1 shadow-lg"
              />
              <span className="w-3 h-3 rounded-full bg-emerald-400 border-2 border-black absolute -bottom-0.5 -right-0.5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-black text-white">mrnovatech</span>
                <VerifiedBadge />
              </div>
              <span className="text-[11px] text-[#25f4ee] font-mono block">mrnovatech4@gmail.com</span>
              <span className="text-[10px] text-neutral-400">Platform Founder &amp; Lead Architect</span>
            </div>
          </div>

          <button
            onClick={() => {
              onClose();
              onDirectMessageOwner();
            }}
            className="px-3 py-2 bg-gradient-to-r from-[#25f4ee] to-[#ff2b54] hover:opacity-90 text-black font-black text-xs rounded-xl shadow-lg cursor-pointer flex items-center gap-1.5 transition-transform active:scale-95 shrink-0"
          >
            <MessageSquare className="w-3.5 h-3.5" /> Direct DM
          </button>
        </div>

        {/* Main Body Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {submitted ? (
            <div className="text-center py-12 space-y-3 bg-neutral-900/60 rounded-2xl border border-white/10 p-6">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto animate-bounce" />
              <h3 className="text-base font-black text-white">Dispatched to @mrnovatech</h3>
              <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                Thank you for helping make Pulse the world's highest performance video platform. Your report has been delivered directly to the core engineering desk.
              </p>
              <button
                onClick={() => {
                  setSubmitted(false);
                  setSubject('');
                  setDescription('');
                }}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-bold rounded-xl cursor-pointer"
              >
                Send Another Note
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3.5">
              {/* Type Switcher */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { type: 'feedback', label: 'Feedback', icon: MessageSquare },
                  { type: 'bug_report', label: 'Bug Report', icon: Bug },
                  { type: 'feature_request', label: 'New Idea', icon: Lightbulb },
                  { type: 'support', label: 'Support', icon: HelpCircle }
                ].map(item => {
                  const Icon = item.icon;
                  const isSelected = feedbackType === item.type;
                  return (
                    <button
                      key={item.type}
                      type="button"
                      onClick={() => setFeedbackType(item.type as any)}
                      className={`p-2.5 rounded-2xl border flex flex-col items-center gap-1 text-xs font-bold cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-[#25f4ee]/15 border-[#25f4ee] text-white shadow-md'
                          : 'bg-neutral-900 border-white/10 text-neutral-400 hover:text-white'
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${isSelected ? 'text-[#25f4ee]' : ''}`} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-bold text-neutral-300 mb-1">Module Area</label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="w-full bg-neutral-900 border border-white/15 rounded-2xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#25f4ee]"
                >
                  <option value="Video Player & Feed">🎬 Video Player &amp; Vertical 9:16 Feed</option>
                  <option value="Live Streaming & Battles">🔴 Live Streaming, Battles &amp; Multi-Guest</option>
                  <option value="Stories & Highlights">⭕ Stories &amp; Highlights</option>
                  <option value="Direct Messaging & Chat">💬 Direct Messaging &amp; Voice Notes</option>
                  <option value="Creator Studio & Analytics">📊 Creator Studio &amp; Uploads</option>
                  <option value="Account & Security">🔒 Account Security &amp; Settings</option>
                </select>
              </div>

              {/* Subject */}
              <div>
                <label className="block text-xs font-bold text-neutral-300 mb-1">Subject</label>
                <input
                  type="text"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  placeholder="Summary of your feedback or bug..."
                  className="w-full bg-neutral-900 border border-white/15 rounded-2xl px-3.5 py-2.5 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-[#25f4ee]"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-neutral-300 mb-1">Detailed Explanation</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={4}
                  placeholder="Describe what happened, suggestions for improvement, or steps to reproduce..."
                  className="w-full bg-neutral-900 border border-white/15 rounded-2xl p-3.5 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-[#25f4ee] resize-none leading-relaxed"
                />
              </div>

              {/* Device Auto-diagnostic preview */}
              <div className="p-3 bg-neutral-950/80 border border-white/10 rounded-2xl flex items-center justify-between text-[11px] text-neutral-400">
                <span className="flex items-center gap-1.5">
                  <Laptop className="w-3.5 h-3.5 text-[#25f4ee]" /> Device &amp; Session telemetry included
                </span>
                <span className="font-mono text-neutral-500">Auto-Attached</span>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 bg-gradient-to-r from-[#25f4ee] to-[#ff2b54] text-black font-black text-xs rounded-2xl shadow-xl transition-transform active:scale-95 cursor-pointer flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4 text-black" />
                <span>{submitting ? 'Submitting to @mrnovatech...' : 'Send to Platform Architect'}</span>
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-[#131418] border-t border-white/10 flex items-center justify-between text-[11px] text-neutral-400 shrink-0">
          <span>Pulse Platform Engineering</span>
          <span className="text-neutral-500">Confidential Desk</span>
        </div>
      </div>
    </div>
  );
};
