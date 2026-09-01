import React, { useState } from 'react';
import { X, Send, Heart, Share2 } from 'lucide-react';

interface LiveStreamRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const LiveStreamRoomModal: React.FC<LiveStreamRoomModalProps> = ({ isOpen, onClose }) => {
  const [message, setMessage] = useState('');
  const [viewers, setViewers] = useState(1250);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4">
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-bold">Live Stream</h2>
            <p className="text-sm text-gray-500">{viewers.toLocaleString()} viewers</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>
        <div className="aspect-video bg-black flex items-center justify-center">
          <p className="text-white">Live Stream Video Feed</p>
        </div>
        <div className="p-4 border-t">
          <div className="flex gap-3 mb-4">
            <button className="flex items-center gap-2 text-red-600 hover:text-red-700">
              <Heart size={20} />
              <span>Like</span>
            </button>
            <button className="flex items-center gap-2 text-blue-600 hover:text-blue-700">
              <Share2 size={20} />
              <span>Share</span>
            </button>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write a comment..."
              className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
              <Send size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveStreamRoomModal;