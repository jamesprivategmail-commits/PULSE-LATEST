import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Volume2 } from 'lucide-react';

interface VoiceNotePlayerProps {
  mediaUrl: string;
  duration?: number;
  isMe?: boolean;
}

export const VoiceNotePlayer: React.FC<VoiceNotePlayerProps> = ({
  mediaUrl,
  duration = 0,
  isMe = false
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Generate pseudo-random consistent waveform bar heights from url string
  const waveformBars = React.useMemo(() => {
    const bars: number[] = [];
    const str = mediaUrl || 'waveform_seed';
    let seed = 0;
    for (let i = 0; i < str.length; i++) {
      seed = (seed << 5) - seed + str.charCodeAt(i);
      seed |= 0;
    }
    const count = 28;
    for (let i = 0; i < count; i++) {
      const val = Math.abs(Math.sin(seed + i * 1.8) * 0.7 + Math.cos(seed * 0.5 + i) * 0.3);
      bars.push(Math.max(0.2, Math.min(1.0, val)));
    }
    return bars;
  }, [mediaUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setTotalDuration(audio.duration);
      }
    };

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
    };
  }, [mediaUrl]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch(err => {
        console.warn('Audio playback error:', err);
      });
    }
  };

  const handleSeek = (index: number) => {
    if (!audioRef.current || totalDuration <= 0) return;
    const seekFraction = index / waveformBars.length;
    const targetTime = seekFraction * totalDuration;
    audioRef.current.currentTime = targetTime;
    setCurrentTime(targetTime);
  };

  const cyclePlaybackRate = () => {
    const nextRate = playbackRate === 1 ? 1.5 : playbackRate === 1.5 ? 2 : 1;
    setPlaybackRate(nextRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressFraction = totalDuration > 0 ? currentTime / totalDuration : 0;
  const activeBarIndex = Math.floor(progressFraction * waveformBars.length);

  return (
    <div className={`flex items-center gap-2.5 p-2 rounded-2xl max-w-[260px] sm:max-w-[290px] select-none ${
      isMe ? 'text-black' : 'text-white'
    }`}>
      <audio ref={audioRef} src={mediaUrl} preload="metadata" />

      {/* Play/Pause Button */}
      <button
        type="button"
        onClick={togglePlay}
        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 cursor-pointer shadow transition-transform active:scale-90 ${
          isMe
            ? 'bg-black text-[#25f4ee] hover:bg-neutral-900'
            : 'bg-[#25f4ee] text-black hover:bg-[#1ee0da]'
        }`}
      >
        {isPlaying ? (
          <Pause className="w-4 h-4 fill-current" />
        ) : (
          <Play className="w-4 h-4 fill-current ml-0.5" />
        )}
      </button>

      {/* Waveform & Duration */}
      <div className="flex-1 flex flex-col justify-center gap-1 min-w-0">
        <div className="flex items-center gap-0.5 h-6 cursor-pointer py-1" onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const clickX = e.clientX - rect.left;
          const fraction = Math.max(0, Math.min(1, clickX / rect.width));
          if (audioRef.current && totalDuration > 0) {
            audioRef.current.currentTime = fraction * totalDuration;
            setCurrentTime(fraction * totalDuration);
          }
        }}>
          {waveformBars.map((heightFraction, idx) => {
            const isPassed = idx <= activeBarIndex;
            return (
              <div
                key={idx}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSeek(idx);
                }}
                className={`flex-1 rounded-full transition-all duration-100 ${
                  isPassed
                    ? isMe
                      ? 'bg-black opacity-90'
                      : 'bg-[#25f4ee]'
                    : isMe
                    ? 'bg-black/25'
                    : 'bg-white/20'
                }`}
                style={{
                  height: `${Math.max(4, heightFraction * 20)}px`
                }}
              />
            );
          })}
        </div>

        <div className="flex items-center justify-between text-[10px] font-mono leading-none opacity-80">
          <span>{formatTime(currentTime > 0 ? currentTime : totalDuration)}</span>
          <button
            type="button"
            onClick={cyclePlaybackRate}
            className={`px-1 rounded text-[9px] font-bold cursor-pointer transition-colors ${
              isMe ? 'hover:bg-black/10' : 'hover:bg-white/10'
            }`}
          >
            {playbackRate}x
          </button>
        </div>
      </div>
    </div>
  );
};
