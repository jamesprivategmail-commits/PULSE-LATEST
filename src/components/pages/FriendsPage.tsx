import React, { useState } from 'react';
import { UserPlus, MessageCircle, MoreVertical } from 'lucide-react';

const FriendsPage: React.FC = () => {
  const [friends, setFriends] = useState([
    { id: 1, name: 'John Doe', status: 'online', avatar: '👨' },
    { id: 2, name: 'Jane Smith', status: 'offline', avatar: '👩' },
    { id: 3, name: 'Bob Johnson', status: 'online', avatar: '👨‍🦰' },
  ]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Friends</h1>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
          <UserPlus size={20} />
          Add Friend
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {friends.map((friend) => (
          <div key={friend.id} className="p-4 border rounded-lg hover:shadow-md">
            <div className="flex items-center gap-4 mb-4">
              <div className="text-4xl">{friend.avatar}</div>
              <div className="flex-1">
                <h3 className="font-semibold">{friend.name}</h3>
                <p className={`text-sm ${friend.status === 'online' ? 'text-green-600' : 'text-gray-500'}`}>
                  {friend.status}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border rounded-lg hover:bg-gray-50">
                <MessageCircle size={18} />
                Message
              </button>
              <button className="px-3 py-2 border rounded-lg hover:bg-gray-50">
                <MoreVertical size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FriendsPage;