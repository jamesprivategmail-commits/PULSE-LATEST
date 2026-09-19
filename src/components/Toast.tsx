import React from 'react';

interface ToastProps {
  message: string | null;
}

export const Toast: React.FC<ToastProps> = ({ message }) => {
  if (!message) return null;

  return (
    <div
      id="pulseToast"
      className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-3.5 py-1.5 bg-neutral-900/95 text-white text-[11px] font-semibold rounded-full shadow-lg backdrop-blur-md border border-white/10 pointer-events-none transition-all duration-200 animate-in fade-in slide-in-from-bottom-2 text-center max-w-[85vw] truncate"
    >
      {message}
    </div>
  );
};
