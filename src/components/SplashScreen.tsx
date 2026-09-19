import React, { useEffect, useState } from 'react';
import { APP_LOGO_URL } from '../constants/branding';

interface SplashScreenProps {
  onFinish?: () => void;
  durationMs?: number;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ 
  onFinish, 
  durationMs = 2000 
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    // Show solid for 2s, then smooth 250ms transition
    const fadeTimer = setTimeout(() => {
      setIsFadingOut(true);
    }, Math.max(100, durationMs - 250));

    const removeTimer = setTimeout(() => {
      setIsVisible(false);
      if (onFinish) onFinish();
    }, durationMs);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, [durationMs, onFinish]);

  if (!isVisible) return null;

  return (
    <div
      id="splashScreen"
      className={`fixed inset-0 z-[999999] bg-black flex flex-col items-center justify-center select-none transition-opacity duration-300 ${
        isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{ willChange: 'opacity' }}
    >
      {/* Centered Logo with subtle ambient glow */}
      <div className="relative flex flex-col items-center justify-center">
        {/* Ambient glow */}
        <div className="absolute w-36 h-36 rounded-full bg-gradient-to-tr from-[#25f4ee]/20 to-[#ff2b54]/20 blur-2xl" />
        
        {/* Instant Local App Logo */}
        <div className="relative z-10 w-24 h-24 sm:w-28 sm:h-28 flex items-center justify-center drop-shadow-[0_10px_25px_rgba(0,0,0,0.8)]">
          <img
            src={APP_LOGO_URL}
            alt="Pulse Logo"
            className="w-full h-full object-contain rounded-2xl"
            decoding="sync"
            loading="eager"
          />
        </div>

        {/* Minimalist smooth loader bar */}
        <div className="mt-7 w-32 h-1 bg-neutral-900 rounded-full overflow-hidden relative">
          <div className="h-full bg-gradient-to-r from-[#25f4ee] via-white to-[#ff2b54] rounded-full animate-[progress_2s_ease-in-out_forwards]" />
        </div>
      </div>
    </div>
  );
};

