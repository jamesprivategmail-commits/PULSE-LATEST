import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LiveStream, UserProfile } from '../../types';
import { LiveFeedSlide } from './LiveFeedSlide';
import { X } from 'lucide-react';

interface LiveFeedScreenProps {
  isOpen: boolean;
  streams: LiveStream[];
  startIndex: number;
  currentUser: UserProfile | null;
  onClose: () => void;
  onEnterRoom: (stream: LiveStream) => void;
  onRequireAuth: () => void;
}

export const LiveFeedScreen: React.FC<LiveFeedScreenProps> = ({
  isOpen,
  streams,
  startIndex,
  currentUser,
  onClose,
  onEnterRoom,
  onRequireAuth
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  // Only the slide matching this id gets a live WebRTC connection — see
  // useLiveKitViewer / LiveFeedSlide for the reasoning. Instagram/TikTok-
  // style: exactly the on-screen item plays, everything else is paused.
  const [activeStreamId, setActiveStreamId] = useState<string | null>(
    streams[startIndex]?.id || null
  );

  // Jump to the tapped card's slide on open, instantly (no scroll animation).
  // Depends on startIndex too (not just isOpen): if the screen is asked to
  // jump to a different card while already mounted, it should still jump.
  useEffect(() => {
    if (!isOpen || !containerRef.current) return;
    const container = containerRef.current;
    const target = container.children[startIndex] as HTMLElement | undefined;
    if (target) {
      container.scrollTo({ top: target.offsetTop, behavior: 'instant' as ScrollBehavior });
    }
    setActiveStreamId(streams[startIndex]?.id || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, startIndex]);

  // Track which slide is actually visible as the person swipes
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !isOpen) return;

    const slides = container.querySelectorAll('[data-slide-id]');
    if (!slides.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            const id = (entry.target as HTMLElement).dataset.slideId;
            if (id) setActiveStreamId(id);
          }
        });
      },
      { root: container, threshold: [0.6] }
    );

    slides.forEach((slide) => observer.observe(slide));
    return () => observer.disconnect();
  }, [isOpen, streams.length]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[95] bg-black">
      <button
        onClick={onClose}
        className="absolute top-4 right-3 z-20 w-8 h-8 rounded-full bg-black/50 backdrop-blur-md border border-white/10 text-white flex items-center justify-center cursor-pointer active:scale-90 transition-transform"
      >
        <X className="w-4 h-4" />
      </button>

      <div
        ref={containerRef}
        className="w-full h-full overflow-y-auto snap-y snap-mandatory scrollbar-none"
      >
        {streams.map((stream) => (
          <LiveFeedSlide
            key={stream.id}
            stream={stream}
            isActive={stream.id === activeStreamId}
            currentUser={currentUser}
            onEnterRoom={() => onEnterRoom(stream)}
            onRequireAuth={onRequireAuth}
          />
        ))}
      </div>
    </div>,
    document.body
  );
};
