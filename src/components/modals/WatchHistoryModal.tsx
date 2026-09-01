import React, { useState } from 'react';
import { X, Trash2 } from 'lucide-react';

interface WatchHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const WatchHistoryModal: React.FC<WatchHistoryModalProps> = ({ isOpen, onClose }) => {
  const [history, setHistory] = useState([
    { id: 1, title: 'Amazing Travel Vlog', date: '2 hours ago' },
    { id: 2, title: 'Cooking Tutorial', date: '1 day ago' },
    { id: 3, title: 'Music Video', date: '3 days ago' },
  ]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-96 overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white">
          <h2 className="text-xl font-bold">Watch History</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>
        <div className="divide-y">
          {history.map((item) => (
            <div key={item.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
              <div>
                <h3 className="font-semibold">{item.title}</h3>
                <p className="text-sm text-gray-500">{item.date}</p>
              </div>
              <button className="text-gray-400 hover:text-red-600">
                <Trash2 size={18} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default WatchHistoryModal;