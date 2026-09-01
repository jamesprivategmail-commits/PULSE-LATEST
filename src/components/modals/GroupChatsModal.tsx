import React, { useState } from 'react';
import { X, Plus, Search } from 'lucide-react';

interface GroupChatsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const GroupChatsModal: React.FC<GroupChatsModalProps> = ({ isOpen, onClose }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [groups, setGroups] = useState([
    { id: 1, name: 'Development Team', members: 8 },
    { id: 2, name: 'Marketing', members: 5 },
  ]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-96 overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white">
          <h2 className="text-xl font-bold">Group Chats</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>
        <div className="p-4 border-b">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search groups..."
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div className="divide-y">
          {groups.map((group) => (
            <div key={group.id} className="p-4 hover:bg-gray-50 cursor-pointer">
              <h3 className="font-semibold">{group.name}</h3>
              <p className="text-sm text-gray-500">{group.members} members</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default GroupChatsModal;