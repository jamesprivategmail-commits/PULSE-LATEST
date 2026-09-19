import React, { useState } from 'react';
import { UserProfile } from '../types';
import { submitReport } from '../services/pulseDb';
import { X, Flag, AlertTriangle, Check } from 'lucide-react';

interface ReportModalProps {
  isOpen: boolean;
  type: 'user' | 'video' | 'comment';
  targetId: string;
  targetHandle?: string;
  currentUser: UserProfile;
  onClose: () => void;
  onToast: (msg: string) => void;
}

const REPORT_REASONS = [
  'Inappropriate or adult content',
  'Harassment or hate speech',
  'Spam or misleading information',
  'Copyright or intellectual property violation',
  'Impersonation or fake account',
  'Violence or dangerous content',
  'Other'
];

export const ReportModal: React.FC<ReportModalProps> = ({
  isOpen,
  type,
  targetId,
  targetHandle,
  currentUser,
  onClose,
  onToast
}) => {
  const [selectedReason, setSelectedReason] = useState(REPORT_REASONS[0]);
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await submitReport(type, targetId, selectedReason, currentUser, details.trim(), targetHandle);
      onToast('Report submitted. Our moderation team will review it.');
      onClose();
    } catch (err: any) {
      onToast('Failed to submit report: ' + (err.message || 'Error'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 max-w-[480px] mx-auto animate-in fade-in select-none">
      <div className="w-full bg-[#111214] border border-white/10 rounded-2xl p-5 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2 text-white">
            <div className="w-8 h-8 rounded-full bg-[#ff2b54]/20 text-[#ff2b54] flex items-center justify-center">
              <Flag className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm capitalize">Report {type}</h3>
              {targetHandle && (
                <span className="text-[11px] text-neutral-400 font-mono">{targetHandle}</span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-neutral-400 hover:text-white hover:bg-white/10 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-2">
              Why are you reporting this {type}?
            </label>
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {REPORT_REASONS.map((reason) => (
                <button
                  key={reason}
                  type="button"
                  onClick={() => setSelectedReason(reason)}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between border transition-all cursor-pointer ${
                    selectedReason === reason
                      ? 'bg-[#ff2b54]/15 border-[#ff2b54] text-white font-bold'
                      : 'bg-neutral-900 border-white/5 text-neutral-400 hover:border-white/20'
                  }`}
                >
                  <span>{reason}</span>
                  {selectedReason === reason && <Check className="w-3.5 h-3.5 text-[#ff2b54]" />}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1">
              Additional Details (Optional)
            </label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={2}
              placeholder="Provide any additional context for the moderators..."
              className="w-full bg-neutral-900 border border-white/10 rounded-xl p-2.5 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-[#ff2b54] resize-none"
            />
          </div>

          <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl p-2.5 text-[11px] text-amber-300">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Reports are investigated anonymously by the moderation team.</span>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 font-bold rounded-xl border border-white/10 text-xs cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2.5 bg-[#ff2b54] hover:bg-[#ff1a47] text-white font-extrabold rounded-xl text-xs shadow-lg cursor-pointer flex items-center justify-center gap-1.5"
            >
              {submitting ? 'Submitting...' : 'Submit Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
