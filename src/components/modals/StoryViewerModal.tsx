import React, { useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

interface StoryViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const StoryViewerModal: React.FC<StoryViewerModalProps> = ({ isOpen, onClose }) => {
  const [currentStory, setCurrentStory] = useState(0);
  const stories = [
    { id: 1, author: 'John Doe', content: 'Just had an amazing day!' },
    { id: 2, author: 'Jane Smith', content: 'Check out this sunset!' },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
      <button onClick={onClose} className="absolute top-4 right-4 text-white">
        <X size={32} />
      </button>
      <button
        onClick={() => setCurrentStory(Math.max(0, currentStory - 1))}
        className="absolute left-4 text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-full"
      >
        <ChevronLeft size={32} />
      </button>
      <div className="bg-gray-900 rounded-lg max-w-md w-full mx-4">
        <div className="aspect-video bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
          <p className="text-white text-center">{stories[currentStory].content}</p>
        </div>
        <div className="p-4 text-white">
          <p className="font-semibold">{stories[currentStory].author}</p>
          <p className="text-sm text-gray-400">Story {currentStory + 1} of {stories.length}</p>
        </div>
      </div>
      <button
        onClick={() => setCurrentStory(Math.min(stories.length - 1, currentStory + 1))}
        className="absolute right-4 text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-full"
      >
        <ChevronRight size={32} />
      </button>
    </div>
  );
};

export default StoryViewerModal;