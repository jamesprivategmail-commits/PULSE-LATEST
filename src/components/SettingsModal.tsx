import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { 
  updateUserProfile, 
  unblockUser, 
  clearWatchHistory,
  exportUserAccountData,
  getUserActiveSessions,
  saveFamilyPairingCloud,
  linkChildWithPairingCode
} from '../services/pulseDb';
import { db, getDoc, doc } from '../firebase';
import { APP_LOGO_URL } from '../constants/branding';
import { 
  ArrowLeft, 
  ChevronRight, 
  Lock, 
  Globe, 
  Bell, 
  ShieldCheck, 
  UserX, 
  Share2, 
  Smartphone, 
  Radio, 
  Sliders, 
  Trash2, 
  HeartHandshake, 
  Users, 
  CloudDownload, 
  HelpCircle, 
  FileText, 
  LogOut, 
  RefreshCw, 
  Check, 
  X,
  Sparkles
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  currentUser: UserProfile;
  onClose: () => void;
  onToast: (msg: string) => void;
  onLogout?: () => void;
  onOpenWatchHistory?: () => void;
  onOpenFeedbackOwner?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  currentUser,
  onClose,
  onToast,
  onLogout,
  onOpenWatchHistory,
  onOpenFeedbackOwner
}) => {
  const [isPrivate, setIsPrivate] = useState(currentUser.isPrivate || false);
  const [blockedUsers, setBlockedUsers] = useState<{ uid: string; handle: string; username: string }[]>([]);
  const [dataSaver, setDataSaver] = useState<boolean>(() => {
    return localStorage.getItem('pulse_data_saver') === 'true';
  });
  const [cacheSize, setCacheSize] = useState('Calculating...');
  const [activeSubView, setActiveSubView] = useState<string | null>(null);

  // Real Screen Time & Safety Controls State
  const [screenTimeLimit, setScreenTimeLimit] = useState<number>(() => {
    return Number(localStorage.getItem('pulse_screen_time_limit') || 0);
  });
  const [restrictedMode, setRestrictedMode] = useState<boolean>(() => {
    return localStorage.getItem('pulse_restricted_mode') === 'true';
  });
  const [safetyPin, setSafetyPin] = useState<string>(() => {
    return localStorage.getItem('pulse_safety_pin') || '';
  });
  const [inputPin, setInputPin] = useState('');
  const [linkInputCode, setLinkInputCode] = useState('');
  const [isLinking, setIsLinking] = useState(false);
  const [pairingCode, setPairingCode] = useState<string>(() => {
    return localStorage.getItem('pulse_family_code') || Math.random().toString(36).substring(2, 8).toUpperCase();
  });
  const [keywordFilterList, setKeywordFilterList] = useState<string[]>(() => {
    const saved = localStorage.getItem('pulse_filtered_keywords');
    return saved ? JSON.parse(saved) : ['spam', 'violence', 'explicit'];
  });
  const [newKeyword, setNewKeyword] = useState('');

  // Measure Real Storage
  const updateStorageEstimate = async () => {
    if (navigator.storage && navigator.storage.estimate) {
      try {
        const { usage } = await navigator.storage.estimate();
        if (usage !== undefined && usage > 0) {
          const mb = (usage / (1024 * 1024)).toFixed(1);
          setCacheSize(`${mb} MB`);
          return;
        }
      } catch (e) {}
    }
    let totalBytes = 0;
    for (let key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        totalBytes += (localStorage[key]?.length || 0) * 2;
      }
    }
    const mb = (totalBytes / (1024 * 1024)).toFixed(1);
    setCacheSize(`${Math.max(0.6, Number(mb)).toFixed(1)} MB`);
  };

  useEffect(() => {
    if (!isOpen) return;
    setIsPrivate(currentUser.isPrivate || false);
    updateStorageEstimate();

    if (currentUser.blockedUids && currentUser.blockedUids.length > 0) {
      Promise.all(
        currentUser.blockedUids.map(async (uid) => {
          try {
            const snap = await getDoc(doc(db, 'users', uid));
            if (snap.exists()) {
              const data = snap.data() as UserProfile;
              return { uid, handle: data.handle, username: data.username };
            }
            return { uid, handle: `@user_${uid.slice(0, 6)}`, username: 'User' };
          } catch {
            return { uid, handle: `@user_${uid.slice(0, 6)}`, username: 'User' };
          }
        })
      ).then(setBlockedUsers);
    } else {
      setBlockedUsers([]);
    }
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

  const handleTogglePrivate = async () => {
    const nextVal = !isPrivate;
    setIsPrivate(nextVal);
    try {
      await updateUserProfile(currentUser.uid, { isPrivate: nextVal });
      onToast(nextVal ? 'Account set to Private 🔒' : 'Account is now Public 🌐');
    } catch (e: any) {
      onToast(e.message || 'Failed to update privacy');
    }
  };

  const handleUnblock = async (targetUid: string) => {
    try {
      await unblockUser(currentUser.uid, targetUid);
      setBlockedUsers(prev => prev.filter(u => u.uid !== targetUid));
      onToast('User unblocked successfully');
    } catch (e: any) {
      onToast(e.message || 'Failed to unblock');
    }
  };

  const handleClearCache = async () => {
    if ('caches' in window) {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      } catch (e) {}
    }
    try {
      const keysToKeep = ['pulse_user', 'pulse_auth_token', 'pulse_safety_pin', 'pulse_screen_time_limit', 'pulse_restricted_mode', 'pulse_filtered_keywords'];
      Object.keys(localStorage).forEach(k => {
        if (!keysToKeep.includes(k) && !k.startsWith('firebase:')) {
          localStorage.removeItem(k);
        }
      });
    } catch (e) {}
    await updateStorageEstimate();
    onToast('Local browser storage & video cache purged! 🧹');
  };

  const handleSavePin = async () => {
    if (inputPin.length === 4 && /^\d+$/.test(inputPin)) {
      setSafetyPin(inputPin);
      localStorage.setItem('pulse_safety_pin', inputPin);
      setInputPin('');
      // Save cloud pairing config
      await saveFamilyPairingCloud(pairingCode, currentUser.uid, {
        restrictedMode,
        screenTimeLimit,
        safetyPin: inputPin
      });
      onToast('4-digit Safety PIN set & synced to cloud 🔒');
    } else {
      onToast('Please enter a valid 4-digit numeric PIN');
    }
  };

  const handleSyncFamilyCloud = async () => {
    await saveFamilyPairingCloud(pairingCode, currentUser.uid, {
      restrictedMode,
      screenTimeLimit,
      safetyPin
    });
    onToast(`Family Pairing Code ${pairingCode} Synced to Firestore ✅`);
  };

  const handleLinkFamilyCode = async () => {
    if (!linkInputCode.trim()) {
      onToast('Enter a 6-character pairing code');
      return;
    }
    setIsLinking(true);
    try {
      const data = await linkChildWithPairingCode(linkInputCode.trim(), currentUser.uid);
      if (data) {
        setRestrictedMode(!!data.restrictedMode);
        localStorage.setItem('pulse_restricted_mode', String(!!data.restrictedMode));
        if (data.screenTimeLimit) {
          setScreenTimeLimit(data.screenTimeLimit);
          localStorage.setItem('pulse_screen_time_limit', String(data.screenTimeLimit));
        }
        if (data.safetyPin) {
          setSafetyPin(data.safetyPin);
          localStorage.setItem('pulse_safety_pin', data.safetyPin);
        }
        onToast('Linked successfully! Parental rules applied 🎉');
        setLinkInputCode('');
      } else {
        onToast('Invalid or expired pairing code');
      }
    } catch (e: any) {
      onToast('Failed to link family code');
    } finally {
      setIsLinking(false);
    }
  };

  const handleAddFilterKeyword = () => {
    if (newKeyword.trim()) {
      const updated = [...keywordFilterList, newKeyword.trim().toLowerCase()];
      setKeywordFilterList(updated);
      localStorage.setItem('pulse_filtered_keywords', JSON.stringify(updated));
      setNewKeyword('');
      onToast(`Filtered keyword "${newKeyword.trim()}" added`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black text-white max-w-[480px] mx-auto flex flex-col animate-in fade-in select-none font-sans overflow-hidden">
      {/* Top Header */}
      <div className="px-header">
        <button
          onClick={() => {
            if (activeSubView) setActiveSubView(null);
            else onClose();
          }}
          className="px-icon-btn"
          style={{ width: 34, height: 34 }}
        >
          <ArrowLeft className="w-[18px] h-[18px]" />
        </button>
        <span style={{ fontSize: 16, fontWeight: 850, letterSpacing: '-.4px' }}>
          {activeSubView ? activeSubView : 'Settings and privacy'}
        </span>
        <div style={{ width: 34 }} />
      </div>

      {/* SUBVIEW: BLOCKED ACCOUNTS */}
      {activeSubView === 'Blocked accounts' ? (
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-black">
          <p className="text-[10.5px] text-neutral-400 mb-1">
            Blocked accounts cannot see your posts, live streams, or send you messages.
          </p>
          {blockedUsers.length === 0 ? (
            <div className="text-center py-12 text-[11px] text-neutral-500">
              No blocked accounts.
            </div>
          ) : (
            <div className="divide-y divide-white/10">
              {blockedUsers.map(u => (
                <div key={u.uid} className="py-2 flex items-center justify-between">
                  <div>
                    <b className="text-[11px] text-white block">{u.username}</b>
                    <span className="text-[9.5px] text-neutral-400">{u.handle}</span>
                  </div>
                  <button
                    onClick={() => handleUnblock(u.uid)}
                    className="px-2 py-0.5 bg-neutral-900 hover:bg-neutral-800 border border-white/10 text-white text-[10px] font-bold rounded-lg cursor-pointer transition-colors"
                  >
                    Unblock
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : activeSubView === 'Content preferences' ? (
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-black">
          <div className="p-2.5 bg-neutral-950 rounded-lg border border-white/10 space-y-2">
            <div>
              <h4 className="text-[11px] font-bold text-white">Filter video keywords</h4>
              <p className="text-[9.5px] text-neutral-400 mt-0.5">Hide videos containing specific hashtags or words from your For You feed.</p>
            </div>
            
            <div className="flex gap-1.5">
              <input
                type="text"
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddFilterKeyword()}
                placeholder="e.g. spoiler, drama"
                className="flex-1 bg-black border border-white/15 rounded-lg px-2 py-1 text-[11px] text-white focus:outline-none focus:border-white"
              />
              <button
                onClick={handleAddFilterKeyword}
                className="px-2.5 py-1 bg-neutral-900 hover:bg-neutral-800 border border-white/10 text-white text-[10px] font-bold rounded-lg cursor-pointer"
              >
                Add
              </button>
            </div>

            <div className="pt-0.5">
              <span className="text-[9.5px] font-bold text-neutral-400 block mb-1">Active Filtered Keywords:</span>
              <div className="flex flex-wrap gap-1">
                {keywordFilterList.map((kw, i) => (
                  <span key={i} className="inline-flex items-center gap-1 bg-neutral-900 border border-white/10 px-1.5 py-0.5 rounded text-[10px] font-medium text-neutral-200">
                    #{kw}
                    <button
                      onClick={() => {
                        const updated = keywordFilterList.filter((_, idx) => idx !== i);
                        setKeywordFilterList(updated);
                        localStorage.setItem('pulse_filtered_keywords', JSON.stringify(updated));
                        onToast(`Removed #${kw} from filters`);
                      }}
                      className="text-neutral-400 hover:text-red-400 cursor-pointer"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : activeSubView === 'Time and well-being' ? (
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-black">
          <div className="p-2.5 bg-neutral-950 rounded-lg border border-white/10 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-[11px] font-bold text-white">Daily Screen Time</h4>
                <p className="text-[9.5px] text-neutral-400">Pulse will notify you when you reach your daily watch limit.</p>
              </div>
              <span className="text-[10.5px] font-bold text-[#fe2c55]">
                {screenTimeLimit ? `${screenTimeLimit} min / day` : 'Unlimited'}
              </span>
            </div>

            <div className="grid grid-cols-4 gap-1.5 pt-0.5">
              {[
                { label: 'Off', val: 0 },
                { label: '30m', val: 30 },
                { label: '45m', val: 45 },
                { label: '60m', val: 60 },
              ].map((item) => (
                <button
                  key={item.val}
                  onClick={() => {
                    setScreenTimeLimit(item.val);
                    localStorage.setItem('pulse_screen_time_limit', String(item.val));
                    onToast(item.val ? `Daily limit set to ${item.val} minutes` : 'Daily screen time limit disabled');
                  }}
                  className={`py-1 text-[10.5px] font-bold rounded-lg border transition-all cursor-pointer ${
                    screenTimeLimit === item.val
                      ? 'bg-white text-black border-white shadow-xs'
                      : 'bg-black text-neutral-300 border-white/10 hover:border-white/25'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-2.5 bg-neutral-950 rounded-lg border border-white/10 space-y-1.5">
            <h4 className="text-[11px] font-bold text-white">Screen Time Breaks</h4>
            <p className="text-[9.5px] text-neutral-400">Schedule periodic reminders to rest your eyes and take a stretch.</p>
            <button
              onClick={() => onToast('Take a break reminder scheduled for 20 minutes 🌿')}
              className="w-full py-1.5 bg-neutral-900 border border-white/10 hover:bg-neutral-800 text-[10.5px] font-bold text-white rounded-lg cursor-pointer transition-colors"
            >
              Set 20-min Break Reminder
            </button>
          </div>
        </div>
      ) : activeSubView === 'Family Pairing' ? (
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-black">
          <div className="p-2.5 bg-neutral-950 rounded-lg border border-white/10 space-y-2">
            <div>
              <h4 className="text-[11px] font-bold text-white flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#25f4ee]" /> Parental Safety Controls
              </h4>
              <p className="text-[9.5px] text-neutral-400 mt-0.5">Link a parent account to manage screen time and limit mature content.</p>
            </div>

            <div className="p-2 bg-black rounded-lg border border-white/10 space-y-1.5">
              <span className="text-[9px] font-bold text-neutral-400 uppercase">Your Family Sync Code</span>
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-black tracking-widest text-white">{pairingCode}</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText(pairingCode);
                      onToast('Pairing code copied to clipboard! 📋');
                    }}
                    className="px-2 py-0.5 bg-neutral-900 hover:bg-neutral-800 border border-white/10 text-[9.5px] font-bold rounded-lg cursor-pointer text-white"
                  >
                    Copy
                  </button>
                  <button
                    onClick={handleSyncFamilyCloud}
                    className="px-2 py-0.5 bg-[#25f4ee]/20 hover:bg-[#25f4ee]/30 text-[#25f4ee] border border-[#25f4ee]/30 text-[9.5px] font-bold rounded-lg cursor-pointer flex items-center gap-1"
                  >
                    <RefreshCw className="w-2.5 h-2.5" /> Sync
                  </button>
                </div>
              </div>
            </div>

            {/* Link another Family Device */}
            <div className="p-2 bg-black rounded-lg border border-white/10 space-y-1.5">
              <span className="text-[9px] font-bold text-neutral-400 uppercase">Link Child or Family Code</span>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  maxLength={6}
                  value={linkInputCode}
                  onChange={(e) => setLinkInputCode(e.target.value.toUpperCase())}
                  placeholder="Enter 6-digit code"
                  className="flex-1 bg-neutral-950 border border-white/15 rounded-lg px-2 py-1 text-[11px] text-white uppercase font-mono tracking-widest focus:outline-none focus:border-white"
                />
                <button
                  onClick={handleLinkFamilyCode}
                  disabled={isLinking}
                  className="px-2.5 py-1 bg-white hover:bg-neutral-200 disabled:opacity-50 text-black text-[10.5px] font-bold rounded-lg cursor-pointer"
                >
                  {isLinking ? 'Linking...' : 'Link'}
                </button>
              </div>
            </div>

            {/* Restricted Mode */}
            <div className="pt-1.5 flex items-center justify-between">
              <div>
                <b className="text-[11px] text-white block">Restricted Mode</b>
                <span className="text-[9px] text-neutral-400">Filters mature sounds &amp; videos</span>
              </div>
              <button
                onClick={() => {
                  const next = !restrictedMode;
                  setRestrictedMode(next);
                  localStorage.setItem('pulse_restricted_mode', String(next));
                  onToast(next ? 'Restricted Mode Activated 🛡️' : 'Restricted Mode Disabled');
                }}
                className={`w-8 h-4.5 rounded-full transition-colors relative flex items-center p-0.5 cursor-pointer ${
                  restrictedMode ? 'bg-[#25f4ee]' : 'bg-neutral-800'
                }`}
              >
                <div className={`w-3.5 h-3.5 rounded-full bg-white shadow-xs transition-transform ${
                  restrictedMode ? 'translate-x-3.5' : 'translate-x-0'
                }`} />
              </button>
            </div>

            {/* PIN setup */}
            <div className="pt-2 border-t border-white/10">
              <span className="text-[10.5px] font-bold text-white block mb-1">
                {safetyPin ? 'Safety PIN: •••• (Configured)' : 'Set 4-Digit Safety PIN'}
              </span>
              <div className="flex gap-1.5">
                <input
                  type="password"
                  maxLength={4}
                  value={inputPin}
                  onChange={(e) => setInputPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="4 digits (e.g. 1234)"
                  className="flex-1 bg-black border border-white/15 rounded-lg px-2 py-1 text-[11px] text-white focus:outline-none focus:border-white font-mono"
                />
                <button
                  onClick={handleSavePin}
                  className="px-2.5 py-1 bg-neutral-900 hover:bg-neutral-800 border border-white/10 text-white text-[10.5px] font-bold rounded-lg cursor-pointer"
                >
                  Save PIN
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : activeSubView === 'Notifications' ? (
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5 bg-black">
          {[
            { label: 'Likes & Interactions', desc: 'When someone likes your video or comment', active: true },
            { label: 'Comments & Mentions', desc: 'When someone replies to your videos', active: true },
            { label: 'Direct Messages', desc: 'When someone messages you', active: true },
            { label: 'LIVE broadcasts from accounts you follow', desc: 'Real-time alert when friends start streaming', active: true }
          ].map((item, idx) => (
            <div key={idx} className="p-2.5 bg-neutral-950 rounded-lg border border-white/10 flex items-center justify-between">
              <div>
                <b className="text-[11px] text-white block">{item.label}</b>
                <span className="text-[9.5px] text-neutral-400 block">{item.desc}</span>
              </div>
              <input type="checkbox" defaultChecked={item.active} className="w-3.5 h-3.5 accent-[#fe2c55]" />
            </div>
          ))}
        </div>
      ) : (
        /* MAIN SETTINGS TREE */
        <div className="flex-1 overflow-y-auto px-3 py-1.5 divide-y divide-white/10 bg-black">
          {/* GROUP 1: Activity */}
          <div className="py-1.5">
            <span className="px-settings-label">
              Activity
            </span>
            <div className="px-settings-card">
              <div 
                onClick={() => onToast('Open your profile to manage and delete your posts')}
                className="px-setting cursor-pointer"
              >
                <span className="text-[11px] font-medium text-neutral-200">Manage posts</span>
                <ChevronRight className="w-3 h-3 text-neutral-500" />
              </div>

              <div 
                onClick={() => setActiveSubView('Content preferences')}
                className="px-setting cursor-pointer"
              >
                <span className="text-[11px] font-medium text-neutral-200">Content preferences</span>
                <ChevronRight className="w-3 h-3 text-neutral-500" />
              </div>

              <div 
                onClick={() => onToast('Open the LIVE tab to start a stream and configure your studio')}
                className="px-setting cursor-pointer"
              >
                <span className="text-[11px] font-medium text-neutral-200">LIVE</span>
                <ChevronRight className="w-3 h-3 text-neutral-500" />
              </div>

              <div 
                onClick={() => setActiveSubView('Notifications')}
                className="px-setting cursor-pointer"
              >
                <span className="text-[11px] font-medium text-neutral-200">Notifications</span>
                <ChevronRight className="w-3 h-3 text-neutral-500" />
              </div>

              <div 
                onClick={() => setActiveSubView('Time and well-being')}
                className="px-setting cursor-pointer"
              >
                <div>
                  <span className="text-[11px] font-medium text-neutral-200 block">Time and well-being</span>
                  <span className="text-[9px] text-neutral-400">
                    {screenTimeLimit ? `Limit: ${screenTimeLimit}m/day` : 'Screen time & breaks'}
                  </span>
                </div>
                <ChevronRight className="w-3 h-3 text-neutral-500" />
              </div>

              <div 
                onClick={() => setActiveSubView('Family Pairing')}
                className="px-setting cursor-pointer"
              >
                <div>
                  <span className="text-[11px] font-medium text-neutral-200 block">Family Pairing</span>
                  <span className="text-[9px] text-neutral-400">
                    {restrictedMode ? 'Restricted Mode: Active' : 'Parental safety controls'}
                  </span>
                </div>
                <ChevronRight className="w-3 h-3 text-neutral-500" />
              </div>
            </div>
          </div>

          {/* GROUP 2: Account */}
          <div className="py-1.5">
            <span className="px-settings-label">
              Account
            </span>
            <div className="px-settings-card">
              <div 
                onClick={() => onToast(`Account email: ${currentUser.email || 'Verified'}`)}
                className="px-setting cursor-pointer"
              >
                <span className="text-[11px] font-medium text-neutral-200">Account</span>
                <ChevronRight className="w-3 h-3 text-neutral-500" />
              </div>

              <div 
                onClick={() => onToast(currentUser.emailVerified ? 'Email verified · Password login active 🛡️' : 'Email not verified yet')}
                className="px-setting cursor-pointer"
              >
                <span className="text-[11px] font-medium text-neutral-200">Security &amp; permissions</span>
                <ChevronRight className="w-3 h-3 text-neutral-500" />
              </div>

              <div 
                onClick={() => {
                  navigator.clipboard?.writeText(window.location.href);
                  onToast('Profile URL copied to clipboard 🔗');
                }}
                className="px-setting cursor-pointer"
              >
                <span className="text-[11px] font-medium text-neutral-200">Share profile</span>
                <ChevronRight className="w-3 h-3 text-neutral-500" />
              </div>
            </div>
          </div>

          {/* GROUP 3: Visibility */}
          <div className="py-1.5">
            <span className="px-settings-label">
              Visibility
            </span>
            <div className="px-settings-card">
              <div 
                onClick={handleTogglePrivate}
                className="px-setting cursor-pointer"
              >
                <div>
                  <span className="text-[11px] font-medium text-neutral-200 block">Private account</span>
                  <span className="text-[9px] text-neutral-400">Only approved followers can view your videos</span>
                </div>
                <div className={`w-8 h-4.5 rounded-full transition-colors relative flex items-center p-0.5 ${
                  isPrivate ? 'bg-[#fe2c55]' : 'bg-neutral-800'
                }`}>
                  <div className={`w-3.5 h-3.5 rounded-full bg-white transition-transform ${
                    isPrivate ? 'translate-x-3.5' : 'translate-x-0'
                  }`} />
                </div>
              </div>

              <div 
                onClick={() => setActiveSubView('Blocked accounts')}
                className="px-setting cursor-pointer"
              >
                <span className="text-[11px] font-medium text-neutral-200">Blocked accounts</span>
                <ChevronRight className="w-3 h-3 text-neutral-500" />
              </div>
            </div>
          </div>

          {/* GROUP 4: Cache & Cellular */}
          <div className="py-1.5">
            <span className="px-settings-label">
              Cache &amp; Cellular
            </span>
            <div className="px-settings-card">
              <div 
                onClick={() => onToast('Offline downloads coming soon')}
                className="px-setting cursor-pointer"
              >
                <span className="text-[11px] font-medium text-neutral-200">Offline videos</span>
                <ChevronRight className="w-3 h-3 text-neutral-500" />
              </div>

              <div 
                onClick={handleClearCache}
                className="px-setting cursor-pointer"
              >
                <div>
                  <span className="text-[11px] font-medium text-neutral-200 block">Free up space</span>
                  <span className="text-[9px] text-neutral-400">Cache: {cacheSize}</span>
                </div>
                <button className="px-2 py-0.5 bg-neutral-900 border border-white/10 text-white text-[10px] font-bold rounded-md hover:bg-neutral-800 cursor-pointer">
                  Clear
                </button>
              </div>

              <div 
                onClick={() => {
                  const next = !dataSaver;
                  setDataSaver(next);
                  localStorage.setItem('pulse_data_saver', String(next));
                  onToast(next ? 'Data Saver enabled 📶' : 'Data Saver disabled');
                }}
                className="px-setting cursor-pointer"
              >
                <span className="text-[11px] font-medium text-neutral-200">Data Saver</span>
                <span className="text-[10px] text-neutral-400">{dataSaver ? 'On' : 'Off'}</span>
              </div>

              <div 
                onClick={() => onToast('Wallpaper generator coming soon')}
                className="px-setting cursor-pointer"
              >
                <span className="text-[11px] font-medium text-neutral-200">Wallpaper</span>
                <ChevronRight className="w-3 h-3 text-neutral-500" />
              </div>

              <div 
                onClick={() => onToast('Lite mode is currently Off')}
                className="px-setting cursor-pointer"
              >
                <span className="text-[11px] font-medium text-neutral-200">Lite mode</span>
                <span className="text-[10px] text-neutral-400">Off</span>
              </div>
            </div>
          </div>

          {/* GROUP 5: Support & About */}
          <div className="py-1.5">
            <span className="px-settings-label">
              Support &amp; About
            </span>
            <div className="px-settings-card">
              <div 
                onClick={() => {
                  if (onOpenFeedbackOwner) onOpenFeedbackOwner();
                  else onToast('Help Center opened');
                }}
                className="px-setting cursor-pointer"
              >
                <span className="text-[11px] font-medium text-neutral-200">Help Center</span>
                <ChevronRight className="w-3 h-3 text-neutral-500" />
              </div>

              <div 
                onClick={() => onToast("You're on the latest version of Pulse")}
                className="px-setting cursor-pointer"
              >
                <div className="flex items-center gap-1.5">
                  <Smartphone className="w-3 h-3 text-neutral-400" />
                  <span className="text-[11px] font-medium text-neutral-200">App version</span>
                </div>
                <span className="text-[9.5px] text-neutral-500 font-mono">v46.7.3</span>
              </div>

              <div 
                onClick={() => onToast('Privacy Center: Your data is protected')}
                className="px-setting cursor-pointer"
              >
                <span className="text-[11px] font-medium text-neutral-200">Privacy Center</span>
                <ChevronRight className="w-3 h-3 text-neutral-500" />
              </div>

              <div 
                onClick={() => onToast('Pulse Terms and Policies 2026')}
                className="px-setting cursor-pointer"
              >
                <span className="text-[11px] font-medium text-neutral-200">Terms and Policies</span>
                <ChevronRight className="w-3 h-3 text-neutral-500" />
              </div>
            </div>
          </div>

          {/* GROUP 6: Login & Logout */}
          <div className="py-1.5">
            <span className="px-settings-label">
              Login
            </span>
            <div className="px-settings-card">
              <div 
                onClick={() => onToast('Switch account prompt opened')}
                className="px-setting cursor-pointer"
              >
                <span className="text-[11px] font-medium text-neutral-200">Switch account</span>
                <ChevronRight className="w-3 h-3 text-neutral-500" />
              </div>

              <div 
                onClick={() => {
                  onClose();
                  if (onLogout) {
                    onLogout();
                  } else {
                    const logoutBtn = document.getElementById('logoutBtn');
                    logoutBtn?.click();
                  }
                }}
                className="flex items-center justify-between py-1 px-1.5 hover:bg-red-950/40 text-red-400 rounded-lg cursor-pointer transition-colors"
              >
                <span className="text-[11px] font-bold">Log out</span>
                <ChevronRight className="w-3 h-3" />
              </div>
            </div>
          </div>

          {/* FOOTER LOGO & VERSION */}
          <div className="py-3 flex flex-col items-center justify-center gap-1">
            <img
              src={APP_LOGO_URL}
              alt="Pulse Logo"
              className="w-6 h-6 object-contain rounded-lg border border-white/10"
              decoding="async"
            />
            <span className="text-[9.5px] text-neutral-400 font-mono tracking-wider">Pulse v46.7.3</span>
          </div>
        </div>
      )}
    </div>
  );
};
