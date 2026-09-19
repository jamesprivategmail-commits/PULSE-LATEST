import React from 'react';
import { CallSession } from '../types';
import { Phone, PhoneOff, Video, Sparkles } from 'lucide-react';
import { VerifiedBadge } from './VerifiedBadge';

interface IncomingCallBannerProps {
  incomingCall: CallSession | null;
  onAnswer: (call: CallSession) => void;
  onDecline: (call: CallSession) => void;
}

export const IncomingCallBanner: React.FC<IncomingCallBannerProps> = ({
  incomingCall,
  onAnswer,
  onDecline
}) => {
  if (!incomingCall || incomingCall.status !== 'ringing') return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[110] w-[94%] max-w-[440px] bg-neutral-900/95 backdrop-blur-xl border border-[#25f4ee]/40 rounded-3xl p-3.5 shadow-2xl shadow-black/80 flex items-center justify-between animate-in slide-in-from-top-4 duration-300 select-none">
      {/* Caller Details */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="relative shrink-0">
          <img
            src={incomingCall.callerAvatar}
            alt={incomingCall.callerHandle}
            className="w-12 h-12 rounded-full object-cover border-2 border-[#25f4ee] shadow"
          />
          <span className="w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-black absolute -bottom-0.5 -right-0.5 animate-ping" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <span className="text-sm font-black text-white truncate">{incomingCall.callerUsername}</span>
            {incomingCall.callerVerified && <VerifiedBadge size="xs" />}
          </div>
          <p className="text-xs text-neutral-400 truncate">{incomingCall.callerHandle}</p>
          <div className="flex items-center gap-1 text-[11px] font-bold text-[#25f4ee] mt-0.5">
            {incomingCall.callType === 'video' ? (
              <Video className="w-3 h-3 text-[#25f4ee]" />
            ) : (
              <Phone className="w-3 h-3 text-[#25f4ee]" />
            )}
            <span className="animate-pulse">
              Incoming {incomingCall.callType === 'video' ? 'Video' : 'Voice'} Call...
            </span>
          </div>
        </div>
      </div>

      {/* Answer & Decline Action Buttons */}
      <div className="flex items-center gap-1.5 shrink-0 ml-2">
        <button
          type="button"
          onClick={() => onDecline(incomingCall)}
          className="w-7 h-7 rounded-full bg-red-600/90 hover:bg-red-500 text-white flex items-center justify-center cursor-pointer shadow-xs transition-transform active:scale-90"
          title="Decline"
        >
          <PhoneOff className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={() => onAnswer(incomingCall)}
          className="w-7 h-7 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white flex items-center justify-center cursor-pointer shadow-xs animate-pulse transition-transform active:scale-90"
          title="Answer"
        >
          {incomingCall.callType === 'video' ? <Video className="w-3.5 h-3.5" /> : <Phone className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
};
