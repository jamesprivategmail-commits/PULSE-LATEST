import React, { useState } from 'react';
import { MessageCircle, UserPlus, Share2, MoreVertical } from 'lucide-react';

const OtherProfilePage: React.FC = () => {
  const [user, setUser] = useState({
    name: 'John Doe',
    bio: 'Content creator & photographer',
    followers: 15420,
    following: 342,
    posts: 128,
    avatar: '👨',
  });

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        {/* Profile Header */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg h-32 mb-8"></div>

        {/* Profile Info */}
        <div className="flex items-start justify-between mb-8">
          <div className="flex items-end gap-4">
            <div className="text-6xl -mt-20">{user.avatar}</div>
            <div>
              <h1 className="text-3xl font-bold">{user.name}</h1>
              <p className="text-gray-600">{user.bio}</p>
            </div>
          </div>
          <button className="text-gray-500 hover:text-gray-700">
            <MoreVertical size={24} />
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8 text-center">
          <div>
            <p className="text-2xl font-bold">{user.posts}</p>
            <p className="text-gray-600">Posts</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{user.followers.toLocaleString()}</p>
            <p className="text-gray-600">Followers</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{user.following}</p>
            <p className="text-gray-600">Following</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 mb-8">
          <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
            <MessageCircle size={20} />
            Message
          </button>
          <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50">
            <UserPlus size={20} />
            Follow
          </button>
          <button className="px-4 py-2 border rounded-lg hover:bg-gray-50">
            <Share2 size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default OtherProfilePage;