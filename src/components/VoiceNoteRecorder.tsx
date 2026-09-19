import React, { useState, useEffect, useRef } from 'react';
import { Mic, Square, Trash2, Send, Play, Pause, RefreshCw } from 'lucide-react';

interface VoiceNoteRecorderProps {
  onSend: (audioBlob: Blob, durationSeconds: number) => Promise<void>;
  onCancel: () => void;
  onToast: (msg: string) => void;
}

export const VoiceNoteRecorder: React.FC<VoiceNoteRecorderProps> = ({
  onSend,
  onCancel,
  onToast
}) => {
  const [isRecording, setIsRecording] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [audioLevels, setAudioLevels] = useState<number[]>([10, 20, 15, 30, 25, 40, 20, 35]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Start recording on mount
  useEffect(() => {
    let active = true;

    async function startAudioRecording() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });

        if (!active) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        streamRef.current = stream;

        // Web Audio Analyser for live frequency / volume visualization
        try {
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          const ctx = new AudioContextClass();
          audioContextRef.current = ctx;
          const source = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 64;
          source.connect(analyser);
          analyserRef.current = analyser;

          const bufferLength = analyser.frequencyBinCount;
          const dataArray = new Uint8Array(bufferLength);

          const updateLevels = () => {
            if (!analyserRef.current || !active) return;
            analyserRef.current.getByteFrequencyData(dataArray);
            
            // Sample 12 frequency bins
            const samples: number[] = [];
            const step = Math.floor(bufferLength / 12);
            for (let i = 0; i < 12; i++) {
              const val = dataArray[i * step] || 0;
              samples.push(Math.max(6, Math.min(32, (val / 255) * 32)));
            }
            setAudioLevels(samples);
            animationFrameRef.current = requestAnimationFrame(updateLevels);
          };

          updateLevels();
        } catch (audioCtxErr) {
          console.warn('AudioContext visualization setup notice:', audioCtxErr);
        }

        // Setup MediaRecorder
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : '';

        const options = mimeType ? { mimeType } : undefined;
        const recorder = new MediaRecorder(stream, options);
        mediaRecorderRef.current = recorder;
        audioChunksRef.current = [];

        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        recorder.onstop = () => {
          const blobType = mimeType || 'audio/webm';
          const blob = new Blob(audioChunksRef.current, { type: blobType });
          setAudioBlob(blob);
          const url = URL.createObjectURL(blob);
          setPreviewUrl(url);
        };

        recorder.start(100); // 100ms time slice
        setIsRecording(true);
      } catch (err: any) {
        console.error('Microphone access error:', err);
        onToast('Microphone access denied or unavailable.');
        onCancel();
      }
    }

    startAudioRecording();

    return () => {
      active = false;
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  // Timer counter
  useEffect(() => {
    if (!isRecording || isPaused) return;
    const interval = setInterval(() => {
      setSeconds(s => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isRecording, isPaused]);

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    setIsRecording(false);
  };

  const handleTogglePreviewPlay = () => {
    if (!previewAudioRef.current) return;
    if (isPreviewPlaying) {
      previewAudioRef.current.pause();
      setIsPreviewPlaying(false);
    } else {
      previewAudioRef.current.play().then(() => {
        setIsPreviewPlaying(true);
      }).catch(() => {});
    }
  };

  const handleSendVoice = async () => {
    if (isRecording) {
      // stop first and wait for onstop
      handleStopRecording();
    }

    // If we have blob or can generate from current chunks
    let finalBlob = audioBlob;
    if (!finalBlob && audioChunksRef.current.length > 0) {
      finalBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
    }

    if (!finalBlob) {
      onToast('No audio recorded');
      onCancel();
      return;
    }

    const duration = Math.max(1, seconds);
    setIsSending(true);
    try {
      await onSend(finalBlob, duration);
    } catch (e) {
      onToast('Failed to upload voice note');
    } finally {
      setIsSending(false);
    }
  };

  const formatTimer = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec < 10 ? '0' : ''}${sec}`;
  };

  return (
    <div className="p-3 bg-neutral-950 border-t border-[#25f4ee]/30 flex flex-col gap-2 shrink-0 animate-in slide-in-from-bottom-2 select-none shadow-2xl">
      {previewUrl && (
        <audio
          ref={previewAudioRef}
          src={previewUrl}
          onEnded={() => setIsPreviewPlaying(false)}
          className="hidden"
        />
      )}

      <div className="flex items-center justify-between">
        {/* Left Status & Timer */}
        <div className="flex items-center gap-2">
          {isRecording ? (
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
              <span className="text-xs font-mono font-bold text-red-400">
                REC {formatTimer(seconds)}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleTogglePreviewPlay}
                className="w-7 h-7 rounded-full bg-[#25f4ee] text-black flex items-center justify-center cursor-pointer shadow"
              >
                {isPreviewPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
              </button>
              <span className="text-xs font-mono font-bold text-white">
                Preview ({formatTimer(seconds)})
              </span>
            </div>
          )}
        </div>

        {/* Live Audio Visualizer Bars */}
        {isRecording ? (
          <div className="flex items-center gap-1 h-8 px-2">
            {audioLevels.map((lvl, i) => (
              <div
                key={i}
                className="w-1 bg-[#25f4ee] rounded-full transition-all duration-75"
                style={{ height: `${lvl}px` }}
              />
            ))}
          </div>
        ) : (
          <div className="text-[11px] text-neutral-400 font-medium">
            Ready to send
          </div>
        )}

        {/* Right Action Controls */}
        <div className="flex items-center gap-2">
          {/* Cancel button */}
          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 rounded-xl bg-neutral-900 text-neutral-400 hover:text-red-400 hover:bg-neutral-800 cursor-pointer transition-colors"
            title="Delete / Cancel"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          {/* Stop / Finish recording button */}
          {isRecording && (
            <button
              type="button"
              onClick={handleStopRecording}
              className="p-1.5 rounded-xl bg-neutral-800 text-white hover:bg-neutral-700 cursor-pointer transition-colors"
              title="Stop & Preview"
            >
              <Square className="w-4 h-4 text-[#25f4ee]" />
            </button>
          )}

          {/* Send button */}
          <button
            type="button"
            onClick={handleSendVoice}
            disabled={isSending}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#25f4ee] to-[#00b4d8] text-black font-bold text-xs shadow-lg hover:opacity-90 active:scale-95 cursor-pointer disabled:opacity-50 transition-all"
          >
            {isSending ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <>
                <Send className="w-3.5 h-3.5 fill-current" />
                <span>Send</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
