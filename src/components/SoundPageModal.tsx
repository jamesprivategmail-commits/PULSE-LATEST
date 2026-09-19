import React, { useState, useEffect, useRef } from 'react';
import { VideoPost } from '../types';
import { 
  X, 
  Music, 
  Play, 
  Pause, 
  Bookmark, 
  Video, 
  Share2, 
  Sparkles, 
  Heart,
  Volume2,
  Radio,
  Sliders
} from 'lucide-react';
import { VerifiedBadge } from './VerifiedBadge';

interface SoundPageModalProps {
  isOpen: boolean;
  soundTitle: string;
  creatorHandle?: string;
  creatorAvatar?: string;
  allVideos: VideoPost[];
  onClose: () => void;
  onSelectVideo: (videoId: string) => void;
  onUseSound: (soundTitle: string) => void;
  onToast: (msg: string) => void;
}

type SoundPreset = 'lofi' | 'drill' | 'synthwave' | 'pop';

export const SoundPageModal: React.FC<SoundPageModalProps> = ({
  isOpen,
  soundTitle,
  creatorHandle,
  creatorAvatar,
  allVideos,
  onClose,
  onSelectVideo,
  onUseSound,
  onToast
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [activePreset, setActivePreset] = useState<SoundPreset>('lofi');
  const [bpm, setBpm] = useState(120);

  const audioContextRef = useRef<AudioContext | null>(null);
  const timerIntervalRef = useRef<number | null>(null);
  const stepRef = useRef<number>(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Filter videos using this sound or related
  const soundVideos = allVideos.filter(
    v => v.sound && soundTitle && v.sound.toLowerCase().includes(soundTitle.toLowerCase().slice(0, 15))
  );
  const displayVideos = soundVideos.length > 0 ? soundVideos : allVideos.slice(0, 6);

  const totalVideosCount = soundVideos.length > 0 ? soundVideos.length * 1420 + 850 : 24300;

  // Chord notes mapping in Hz
  const CHORD_PRESETS: Record<SoundPreset, number[][]> = {
    lofi: [
      [261.63, 329.63, 392.00, 493.88], // Cmaj7
      [220.00, 261.63, 329.63, 392.00], // Amin7
      [174.61, 220.00, 261.63, 329.63], // Fmaj7
      [196.00, 246.94, 293.66, 349.23]  // G7
    ],
    drill: [
      [146.83, 174.61, 220.00],         // Dm
      [130.81, 164.81, 196.00],         // C
      [116.54, 146.83, 174.61],         // Bb
      [110.00, 138.59, 164.81]          // A
    ],
    synthwave: [
      [220.00, 277.18, 329.63, 415.30], // A maj7
      [174.61, 220.00, 261.63, 329.63], // F maj7
      [130.81, 164.81, 196.00, 246.94], // C maj7
      [196.00, 246.94, 293.66, 369.99]  // G maj7
    ],
    pop: [
      [261.63, 329.63, 392.00],         // C
      [196.00, 246.94, 293.66],         // G
      [220.00, 261.63, 329.63],         // Am
      [174.61, 220.00, 261.63]          // F
    ]
  };

  const playStep = (ctx: AudioContext, step: number) => {
    const chordIdx = Math.floor(step / 4) % 4;
    const notes = CHORD_PRESETS[activePreset][chordIdx];
    const isKick = step % 4 === 0;
    const isSnare = step % 4 === 2;
    const isHiHat = step % 2 === 1;

    // Play chord voices
    notes.forEach((freq) => {
      try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = activePreset === 'synthwave' ? 'sawtooth' : 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);

        gain.gain.setValueAtTime(0.04, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + 0.4);
      } catch (e) {}
    });

    // Synthesize Kick Drum
    if (isKick) {
      try {
        const kickOsc = ctx.createOscillator();
        const kickGain = ctx.createGain();
        kickOsc.frequency.setValueAtTime(140, ctx.currentTime);
        kickOsc.frequency.exponentialRampToValueAtTime(38, ctx.currentTime + 0.12);

        kickGain.gain.setValueAtTime(0.3, ctx.currentTime);
        kickGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

        kickOsc.connect(kickGain);
        kickGain.connect(ctx.destination);
        kickOsc.start();
        kickOsc.stop(ctx.currentTime + 0.16);
      } catch (e) {}
    }

    // Synthesize Snare / Clap
    if (isSnare) {
      try {
        const snareNoise = ctx.createOscillator();
        const snareGain = ctx.createGain();
        snareNoise.type = 'triangle';
        snareNoise.frequency.setValueAtTime(280, ctx.currentTime);

        snareGain.gain.setValueAtTime(0.12, ctx.currentTime);
        snareGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09);

        snareNoise.connect(snareGain);
        snareGain.connect(ctx.destination);
        snareNoise.start();
        snareNoise.stop(ctx.currentTime + 0.1);
      } catch (e) {}
    }

    // Synthesize Hi-Hat
    if (isHiHat) {
      try {
        const hatOsc = ctx.createOscillator();
        const hatGain = ctx.createGain();
        hatOsc.type = 'square';
        hatOsc.frequency.setValueAtTime(1200, ctx.currentTime);

        hatGain.gain.setValueAtTime(0.02, ctx.currentTime);
        hatGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);

        hatOsc.connect(hatGain);
        hatGain.connect(ctx.destination);
        hatOsc.start();
        hatOsc.stop(ctx.currentTime + 0.05);
      } catch (e) {}
    }
  };

  const stopMusic = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (audioContextRef.current) {
      try { audioContextRef.current.close(); } catch (e) {}
      audioContextRef.current = null;
    }
    setIsPlaying(false);
  };

  const startMusic = () => {
    stopMusic();
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;

      stepRef.current = 0;
      const stepIntervalMs = (60 / bpm / 2) * 1000;

      playStep(ctx, stepRef.current);
      timerIntervalRef.current = window.setInterval(() => {
        stepRef.current = (stepRef.current + 1) % 16;
        if (audioContextRef.current) {
          playStep(audioContextRef.current, stepRef.current);
        }
      }, stepIntervalMs);

      setIsPlaying(true);
    } catch (e) {
      console.warn('Synth startup note:', e);
    }
  };

  const toggleSoundPreview = () => {
    if (isPlaying) {
      stopMusic();
    } else {
      startMusic();
    }
  };

  // Canvas visualizer loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let phase = 0;
    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const barCount = 28;
      const barWidth = canvas.width / barCount - 2;

      for (let i = 0; i < barCount; i++) {
        const heightMultiplier = isPlaying 
          ? Math.sin(phase + i * 0.4) * 0.4 + Math.cos(phase * 1.5 + i * 0.2) * 0.3 + 0.5
          : 0.15;
        const h = Math.max(3, heightMultiplier * canvas.height * 0.85);
        const x = i * (barWidth + 2);
        const y = canvas.height - h;

        const grad = ctx.createLinearGradient(0, y, 0, canvas.height);
        grad.addColorStop(0, '#25f4ee');
        grad.addColorStop(1, '#ff2b54');

        ctx.fillStyle = isPlaying ? grad : '#333339';
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, h, [3, 3, 0, 0]);
        ctx.fill();
      }

      phase += isPlaying ? 0.12 : 0.02;
      animFrameRef.current = requestAnimationFrame(render);
    };

    render();
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying]);

  useEffect(() => {
    return () => {
      stopMusic();
    };
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 animate-in fade-in select-none">
      <div className="w-full max-w-xl max-h-[90vh] bg-[#101114] border border-white/10 rounded-3xl overflow-hidden flex flex-col shadow-2xl relative">
        {/* Top Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <Music className="w-5 h-5 text-[#25f4ee]" />
            <span className="font-black text-white text-base">Sound Details</span>
          </div>
          <button
            onClick={() => {
              stopMusic();
              onClose();
            }}
            className="p-1.5 rounded-full text-neutral-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Sound Card Banner */}
          <div className="flex items-center gap-4 bg-gradient-to-r from-neutral-900 via-[#14151b] to-[#1a1b24] p-4 rounded-2xl border border-white/10">
            {/* Spinning Album Disc */}
            <div 
              onClick={toggleSoundPreview}
              className="relative w-20 h-20 rounded-2xl bg-neutral-800 overflow-hidden border border-white/20 shrink-0 cursor-pointer group shadow-xl"
            >
              <img 
                src={creatorAvatar || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=150&auto=format&fit=crop&q=80'} 
                alt="Sound Art" 
                className={`w-full h-full object-cover ${isPlaying ? 'animate-[spin_4s_linear_infinite]' : ''}`}
              />
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center group-hover:bg-black/20 transition-colors">
                {isPlaying ? (
                  <Pause className="w-7 h-7 text-[#25f4ee] fill-[#25f4ee]" />
                ) : (
                  <Play className="w-7 h-7 text-white fill-white ml-0.5" />
                )}
              </div>
            </div>

            {/* Sound Meta */}
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-black text-white truncate drop-shadow">
                {soundTitle || 'Original Sound — Pulse'}
              </h2>
              <div className="flex items-center gap-1.5 text-xs text-neutral-300 mt-1">
                <span className="font-semibold">{creatorHandle || '@pulse_creator'}</span>
                <VerifiedBadge size="sm" />
              </div>
              <p className="text-[11px] text-neutral-400 mt-1">
                {totalVideosCount.toLocaleString()} videos created with this sound
              </p>
            </div>
          </div>

          {/* Real Audio Synthesizer Controls & Live Waveform */}
          <div className="bg-neutral-900/90 border border-white/10 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Radio className={`w-3.5 h-3.5 ${isPlaying ? 'text-[#25f4ee] animate-pulse' : 'text-neutral-400'}`} /> 
                Audio Waveform Visualizer
              </span>
              <span className="text-[11px] text-neutral-400 font-mono font-bold">
                {bpm} BPM • {activePreset.toUpperCase()}
              </span>
            </div>

            {/* Canvas Visualizer */}
            <div className="h-14 bg-black/60 rounded-xl overflow-hidden p-1 flex items-center justify-center border border-white/5">
              <canvas ref={canvasRef} width={360} height={48} className="w-full h-full" />
            </div>

            {/* Sound Preset Switcher */}
            <div className="grid grid-cols-4 gap-1.5 pt-1">
              {[
                { id: 'lofi', label: '☕️ Lo-Fi' },
                { id: 'drill', label: '🔥 Drill' },
                { id: 'synthwave', label: '⚡️ Synth' },
                { id: 'pop', label: '✨ Pop' }
              ].map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => {
                    setActivePreset(preset.id as SoundPreset);
                    if (isPlaying) {
                      setTimeout(startMusic, 50);
                    }
                  }}
                  className={`py-1.5 text-[11px] font-bold rounded-lg border transition-all cursor-pointer ${
                    activePreset === preset.id
                      ? 'bg-[#25f4ee] text-black border-[#25f4ee] shadow-sm'
                      : 'bg-neutral-800 text-neutral-300 border-white/5 hover:border-white/20'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => {
                stopMusic();
                onUseSound(soundTitle);
                onClose();
              }}
              className="flex-1 py-3 bg-[#ff2b54] hover:bg-[#ff1a47] text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg cursor-pointer transition-all active:scale-[0.99]"
            >
              <Video className="w-4 h-4" /> Use This Sound
            </button>
            <button
              onClick={() => {
                setIsSaved(!isSaved);
                onToast(!isSaved ? 'Sound saved to favorites! 🎵' : 'Removed from favorites');
              }}
              className={`px-4 py-3 rounded-xl border text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
                isSaved 
                  ? 'bg-[#ffd54a]/20 border-[#ffd54a] text-[#ffd54a]' 
                  : 'bg-neutral-900 border-white/10 text-neutral-300 hover:text-white'
              }`}
            >
              <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-[#ffd54a]' : ''}`} />
              {isSaved ? 'Saved' : 'Save'}
            </button>
          </div>

          {/* Videos using this sound */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-black text-neutral-300 tracking-wide uppercase">
                Trending Videos ({displayVideos.length})
              </span>
              <span className="text-[11px] text-[#25f4ee] font-semibold">Tap to watch</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {displayVideos.map((vid) => (
                <div
                  key={vid.id}
                  onClick={() => {
                    stopMusic();
                    onSelectVideo(vid.id);
                    onClose();
                  }}
                  className="aspect-[9/16] bg-neutral-900 rounded-xl overflow-hidden border border-white/10 relative group cursor-pointer hover:border-[#25f4ee]/60 transition-all"
                >
                  <video 
                    src={vid.src} 
                    muted 
                    playsInline 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-2">
                    <div className="flex items-center gap-1 text-[10px] text-white font-bold drop-shadow">
                      <Play className="w-2.5 h-2.5 fill-white" />
                      <span>{((vid.views || 45000) / 1000).toFixed(0)}k</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
