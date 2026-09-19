import React from 'react';
import { UserProfile, StoryItem } from '../types';
import { Plus } from 'lucide-react';

interface StoriesBarProps {
  currentUser: UserProfile | null;
  stories: StoryItem[];
  onOpenStory: (index: number) => void;
  onAddStory: () => void;
  onOpenProfile?: (handle: string, uid: string) => void;
  onOpenChat?: (user: { uid: string; handle: string; avatar: string }) => void;
}

export const StoriesBar: React.FC<StoriesBarProps> = ({
  currentUser,
  stories,
  onOpenStory,
  onAddStory,
  onOpenProfile,
  onOpenChat
}) => {
  // Group stories by owner
  const userStories = currentUser ? stories.filter(s => s.ownerUid === currentUser.uid) : [];
  
  // Unique creators with active stories
  const uniqueCreatorStories: StoryItem[] = [];
  const seenUids = new Set<string>();

  stories.forEach((s) => {
    if (!seenUids.has(s.ownerUid)) {
      seenUids.add(s.ownerUid);
      uniqueCreatorStories.push(s);
    }
  });

  return (
    <div className="w-full overflow-x-auto scrollbar-none pt-1 pb-3 px-3.5 flex items-center gap-4">
      {/* Current User Add / View Story Avatar */}
      <div className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer group">
        <div className="relative">
          <div
            onClick={userStories.length > 0 ? () => onOpenStory(0) : onAddStory}
            className={`w-16 h-16 rounded-full p-0.5 transition-transform active:scale-95 group-hover:scale-105 ${
              userStories.length > 0
                ? 'bg-gradient-to-tr from-[#ffbd1a] via-[#ff4e70] to-[#925fff]'
                : 'border-2 border-dashed border-white/25'
            }`}
          >
            <img
              src={currentUser?.photoURL || 'https://api.dicebear.com/7.x/avataaars/svg?seed=me'}
              alt="My Story"
              className="w-full h-full rounded-full object-cover border-[3px] border-black"
            />
          </div>

          {/* Plus Badge */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAddStory();
            }}
            className="absolute -right-0.5 -bottom-0.5 w-[22px] h-[22px] bg-[#25f4ee] text-black font-extrabold rounded-full flex items-center justify-center border-[3px] border-black shadow-md hover:scale-110 active:scale-95 transition-transform cursor-pointer"
            title="Create Story"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={3.5} />
          </button>
        </div>
        <span className="text-[11px] text-neutral-400 font-medium truncate max-w-[64px]">
          {userStories.length > 0 ? 'Your Story' : 'Add Story'}
        </span>
      </div>

      {/* Friends & Creators Stories */}
      {uniqueCreatorStories.map((story) => {
        if (currentUser && story.ownerUid === currentUser.uid) return null;
        const storyIdx = stories.findIndex(s => s.id === story.id);

        return (
          <div
            key={story.id}
            className="flex flex-col items-center gap-1.5 shrink-0 group"
          >
            <div 
              onClick={() => onOpenStory(storyIdx)}
              className="w-16 h-16 rounded-full p-0.5 bg-gradient-to-tr from-[#ffbd1a] via-[#ff4e70] to-[#925fff] transition-transform active:scale-95 group-hover:scale-105 cursor-pointer"
              title="Watch Story"
            >
              <img
                onClick={(e) => {
                  if (onOpenProfile) {
                    e.stopPropagation();
                    onOpenProfile(story.ownerHandle, story.ownerUid);
                  }
                }}
                src={story.ownerAvatar}
                alt={story.ownerHandle}
                className="w-full h-full rounded-full object-cover border-[3px] border-black hover:opacity-90"
              />
            </div>
            {/* Tapping on creator name goes directly to chat with them */}
            <span 
              onClick={() => {
                if (onOpenChat) {
                  onOpenChat({ uid: story.ownerUid, handle: story.ownerHandle, avatar: story.ownerAvatar });
                } else if (onOpenProfile) {
                  onOpenProfile(story.ownerHandle, story.ownerUid);
                }
              }}
              className="text-[11px] text-neutral-400 font-medium truncate max-w-[66px] hover:text-[#25f4ee] cursor-pointer transition-colors"
              title="Chat with creator"
            >
              {story.ownerHandle.replace(/^@/, '')}
            </span>
          </div>
        );
      })}
    </div>
  );
};
