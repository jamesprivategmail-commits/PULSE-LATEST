import React, { useState } from 'react';
import { Play, Pause, Volume2 } from 'lucide-react';

interface VoiceNotePlayerProps {
  duration: number;
  onPlay?: () => void;
  onPause?: () => void;
}

const VoiceNotePlayer: React.FC<VoiceNotePlayerProps> = ({ duration, onPlay, onPause }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
    if (!isPlaying) onPlay?.();
    else onPause?.();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-3 p-3 bg-gray-100 rounded-lg">
      <button
        onClick={handlePlayPause}
        className="flex-shrink-0 p-2 bg-blue-500 text-white rounded-full hover:bg-blue-600"
      >
        {isPlaying ? <Pause size={18} /> : <Play size={18} />}
      </button>
      <div className="flex-1">
        <div className="bg-gray-300 rounded-full h-2">
          <div
            className="bg-blue-500 h-2 rounded-full"
            style={{ width: `${(progress / duration) * 100}%` }}
          ></div>
        </div>
      </div>
      <span className="text-sm text-gray-600 flex-shrink-0">
        {formatTime(progress)} / {formatTime(duration)}
      </span>
      <Volume2 size={18} className="text-gray-600" />
    </div>
  );
};

export default VoiceNotePlayer;