import React, { useState, useEffect } from 'react';
import {
  auth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInAnonymously,
  applyActionCode,
  updateProfile,
  reload,
  signOut
} from '../backend';
import { getOrCreateUserProfile, updateUserProfile } from '../services/pulseDb';
import { APP_LOGO_URL, APP_NAME } from '../constants/branding';
import { UserProfile } from '../types';
import confetti from 'canvas-confetti';
import { Eye, EyeOff, AlertTriangle, Mail, Lock, User, AtSign, ArrowRight } from 'lucide-react';

interface AuthModalProps {
  onSuccess: (user: UserProfile) => void;
  onToast: (msg: string) => void;
  onClose?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onSuccess, onToast, onClose }) => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Shared fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Signup-only fields
  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');

  // Handle email-verification redirect links (/?mode=verifyEmail&oobCode=...)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const verifyMode = urlParams.get('mode');
    const oobCode = urlParams.get('oobCode');
    if (verifyMode === 'verifyEmail' && oobCode) {
      applyActionCode(auth, oobCode)
        .then(() => onToast('Email verified! You can log in now.'))
        .catch(() => {});
    }
  }, []);

  const switchMode = (next: 'login' | 'signup') => {
    setMode(next);
    setErrorMessage('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!email.trim() || !password) {
      setErrorMessage('Please enter your email and password.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'signup') {
        if (password.length < 6) {
          setErrorMessage('Password must be at least 6 characters.');
          setLoading(false);
          return;
        }
        if (!name.trim() || name.trim().length < 2) {
          setErrorMessage('Please enter a display name (at least 2 characters).');
          setLoading(false);
          return;
        }

        const userCred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        const user = userCred.user;

        let cleanHandle = handle.trim().replace(/^@/, '').toLowerCase();
        if (!cleanHandle) {
          cleanHandle = name.trim().toLowerCase().replace(/[^a-z0-9_.]/g, '').slice(0, 20);
        }

        const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user.uid)}`;

        await updateProfile(user, { displayName: name.trim(), photoURL: avatar });
        await updateUserProfile(user.uid, {
          username: name.trim(),
          handle: '@' + cleanHandle,
          photoURL: avatar,
          emailVerified: true
        });

        const profile = await getOrCreateUserProfile({
          uid: user.uid,
          email: user.email,
          displayName: name.trim(),
          photoURL: avatar,
          emailVerified: true
        });

        confetti({ particleCount: 120, spread: 80, origin: { y: 0.5 } });
        onToast(`Welcome to ${APP_NAME}, ${name.trim()}! 🎉`);
        onSuccess(profile);
      } else {
        const userCred = await signInWithEmailAndPassword(auth, email.trim(), password);
        const user = userCred.user;

        try {
          await Promise.race([
            reload(user),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2500))
          ]);
        } catch {}

        let profile: UserProfile;
        try {
          profile = await Promise.race([
            getOrCreateUserProfile({
              uid: user.uid,
              email: user.email,
              displayName: user.displayName,
              photoURL: user.photoURL,
              emailVerified: true
            }),
            new Promise<UserProfile>((resolve) =>
              setTimeout(() => resolve({
                uid: user.uid,
                email: user.email || email,
                username: user.displayName || email.split('@')[0],
                handle: '@' + (user.displayName || email.split('@')[0]).toLowerCase().replace(/[^a-z0-9_.]/g, ''),
                photoURL: user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`,
                bio: '',
                followers: 0,
                following: 0,
                likesReceived: 0,
                createdAt: Date.now(),
                emailVerified: true,
                verified: false
              }), 3000)
            )
          ]);
        } catch {
          profile = {
            uid: user.uid,
            email: user.email || email,
            username: user.displayName || email.split('@')[0],
            handle: '@' + (user.displayName || email.split('@')[0]).toLowerCase().replace(/[^a-z0-9_.]/g, ''),
            photoURL: user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`,
            bio: '',
            followers: 0,
            following: 0,
            likesReceived: 0,
            createdAt: Date.now(),
            emailVerified: true,
            verified: false
          };
        }

        if (!profile.username || profile.username === 'New Creator' || profile.username === 'Creator') {
          // First login without a saved name — switch to signup to capture name
          setName(email.split('@')[0]);
          setMode('signup');
          onToast('Please enter your display name to finish setup!');
          setLoading(false);
          return;
        }

        confetti({ particleCount: 70, spread: 60 });
        onToast(`Welcome back, ${profile.username}! 🎉`);
        onSuccess(profile);
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      let msg = 'Something went wrong. Please try again.';
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        msg = 'Incorrect email or password.';
      } else if (err.code === 'auth/invalid-email') {
        msg = 'Please enter a valid email address.';
      } else if (err.code === 'auth/email-already-in-use') {
        msg = 'An account with this email already exists. Try logging in.';
      } else if (err.code === 'auth/weak-password') {
        msg = 'Password is too weak. Use at least 6 characters.';
      } else if (err.code === 'auth/too-many-requests') {
        msg = 'Too many attempts. Please try again in a few minutes.';
      } else if (err.message) {
        msg = err.message;
      }
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGuest = async () => {
    setErrorMessage('');
    setLoading(true);
    try {
      const result = await signInAnonymously(auth);
      const profile = await getOrCreateUserProfile({
        uid: result.user.uid,
        email: result.user.email,
        displayName: result.user.displayName || 'Guest',
        photoURL: result.user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${result.user.uid}`,
        emailVerified: false
      });
      onToast('Browsing as guest 🎈');
      onSuccess(profile);
    } catch (err: any) {
      setErrorMessage(err.message || 'Unable to continue as guest.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black text-white flex flex-col max-w-[480px] mx-auto overflow-hidden select-none">
      {/* Close button */}
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-9 h-9 flex items-center justify-center rounded-full bg-white/10 text-neutral-300 hover:text-white hover:bg-white/20 transition-colors"
          aria-label="Close"
        >
          ✕
        </button>
      )}

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-8 overflow-y-auto">
        <div className="w-full max-w-[390px]">
          {/* Logo */}
          <div className="w-14 h-14 mb-9 overflow-hidden rounded-[14px] bg-[#111] border border-white/10 shadow-xl">
            <img src={APP_LOGO_URL} alt={`${APP_NAME} logo`} className="w-full h-full object-cover" />
          </div>

          {/* Title */}
          <h1 className="text-[36px] sm:text-[42px] leading-[1.08] tracking-[-1.8px] font-extrabold mb-8">
            {mode === 'login' ? `Sign in to ${APP_NAME}` : `Create your ${APP_NAME} account`}
          </h1>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            {mode === 'signup' && (
              <>
                <div className="relative">
                  <User className="w-5 h-5 text-neutral-500 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Display name"
                    autoFocus
                    className="w-full h-[52px] rounded-full bg-[#111113] border border-white/[.12] pl-12 pr-5 text-[15px] text-white placeholder:text-[#71767b] focus:outline-none focus:border-[#ffbd1a] transition-colors"
                  />
                </div>
                <div className="relative">
                  <AtSign className="w-5 h-5 text-neutral-500 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={handle}
                    onChange={(e) => setHandle(e.target.value.replace(/^@/, '').toLowerCase())}
                    placeholder="@username (optional)"
                    className="w-full h-[52px] rounded-full bg-[#111113] border border-white/[.12] pl-12 pr-5 text-[15px] text-white placeholder:text-[#71767b] focus:outline-none focus:border-[#ffbd1a] transition-colors"
                  />
                </div>
              </>
            )}

            <div className="relative">
              <Mail className="w-5 h-5 text-neutral-500 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                autoFocus={mode === 'login'}
                required
                className="w-full h-[52px] rounded-full bg-[#111113] border border-white/[.12] pl-12 pr-5 text-[15px] text-white placeholder:text-[#71767b] focus:outline-none focus:border-[#ffbd1a] transition-colors"
              />
            </div>

            <div className="relative">
              <Lock className="w-5 h-5 text-neutral-500 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                required
                className="w-full h-[52px] rounded-full bg-[#111113] border border-white/[.12] pl-12 pr-12 text-[15px] text-white placeholder:text-[#71767b] focus:outline-none focus:border-[#ffbd1a] transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            {errorMessage && (
              <div className="text-[#ff5361] text-[13px] bg-[#ff5361]/10 px-4 py-3 rounded-2xl border border-[#ff5361]/20 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Primary button — big, well-designed */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-[52px] rounded-full bg-white hover:bg-[#e6e6e6] text-[#0f1419] font-bold text-[15px] flex items-center justify-center gap-2 transition-transform active:scale-[.985] disabled:opacity-65 mt-1"
            >
              {loading ? (
                <span className="w-[18px] h-[18px] border-2 border-black/20 border-t-black rounded-full animate-spin" />
              ) : (
                <>
                  {mode === 'login' ? 'Log in' : 'Create account'}
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6 text-[13px] text-[#71767b]">
            <div className="h-px bg-[#2f3336] flex-1" />
            <span>or</span>
            <div className="h-px bg-[#2f3336] flex-1" />
          </div>

          {/* Guest button — same big style */}
          <button
            onClick={handleGuest}
            disabled={loading}
            className="w-full h-[52px] rounded-full bg-transparent border border-white/25 text-white font-bold text-[15px] flex items-center justify-center hover:bg-white/[0.06] transition-colors active:scale-[.985] disabled:opacity-65"
          >
            Continue as guest
          </button>

          {/* Toggle login / signup */}
          <p className="mt-7 text-[14px] leading-5 text-[#71767b]">
            {mode === 'login' ? (
              <>Need an account?{' '}
                <button type="button" onClick={() => switchMode('signup')} className="text-[#a8adb1] hover:text-white font-semibold underline-offset-2 hover:underline">Sign up</button>
              </>
            ) : (
              <>Already have an account?{' '}
                <button type="button" onClick={() => switchMode('login')} className="text-[#a8adb1] hover:text-white font-semibold underline-offset-2 hover:underline">Log in</button>
              </>
            )}
          </p>

          {/* Terms */}
          <p className="mt-5 text-[12px] leading-5 text-[#71767b]">
            By continuing, you agree to {APP_NAME}'s{' '}
            <a href="#" className="text-[#a8adb1] hover:underline">Terms</a> and{' '}
            <a href="#" className="text-[#a8adb1] hover:underline">Privacy Policy</a>.
          </p>
        </div>
      </main>
    </div>
  );
};
