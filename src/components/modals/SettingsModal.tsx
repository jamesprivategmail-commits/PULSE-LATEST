import React, { useState } from 'react';
import { X, Bell, Lock, User, LogOut } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [settings, setSettings] = useState({
    notifications: true,
    privacy: 'public',
    language: 'en',
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold">Settings</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>
        <div className="divide-y">
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bell size={20} />
              <span>Notifications</span>
            </div>
            <input
              type="checkbox"
              checked={settings.notifications}
              onChange={(e) => setSettings({ ...settings, notifications: e.target.checked })}
              className="w-5 h-5"
            />
          </div>
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Lock size={20} />
              <span>Privacy</span>
            </div>
            <select
              value={settings.privacy}
              onChange={(e) => setSettings({ ...settings, privacy: e.target.value })}
              className="px-3 py-1 border rounded-lg"
            >
              <option>Public</option>
              <option>Private</option>
            </select>
          </div>
          <div className="p-4 flex items-center gap-3 text-red-600 cursor-pointer hover:bg-red-50">
            <LogOut size={20} />
            <span>Logout</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;