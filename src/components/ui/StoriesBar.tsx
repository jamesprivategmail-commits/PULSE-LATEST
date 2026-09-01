import React, { useState } from 'react';
import { ChevronRight, Plus } from 'lucide-react';

interface Story {
  id: number;
  author: string;
  avatar: string;
  hasViewed: boolean;
}

interface StoriesBarProps {
  onStoryClick?: (storyId: number) => void;
}

const StoriesBar: React.FC<StoriesBarProps> = ({ onStoryClick }) => {
  const [stories, setStories] = useState<Story[]>([
    { id: 1, author: 'Your Story', avatar: '➕', hasViewed: false },
    { id: 2, author: 'John Doe', avatar: '👨', hasViewed: false },
    { id: 3, author: 'Jane Smith', avatar: '👩', hasViewed: true },
    { id: 4, author: 'Bob Johnson', avatar: '👨‍🦰', hasViewed: false },
  ]);

  return (
    <div className="flex items-center gap-4 p-4 bg-white rounded-lg shadow overflow-x-auto">
      {stories.map((story) => (
        <div
          key={story.id}
          onClick={() => onStoryClick?.(story.id)}
          className="flex-shrink-0 cursor-pointer group"
        >
          <div
            className={`w-16 h-16 rounded-full flex items-center justify-center text-3xl border-2 ${
              story.hasViewed ? 'border-gray-400' : 'border-blue-500'
            } group-hover:opacity-80 transition`}
          >
            {story.avatar}
          </div>
          <p className="text-xs text-center mt-2 max-w-16 truncate">{story.author}</p>
        </div>
      ))}
      <ChevronRight className="flex-shrink-0 text-gray-400" />
    </div>
  );
};

export default StoriesBar;