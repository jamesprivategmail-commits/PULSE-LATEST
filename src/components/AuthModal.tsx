import React, { useState, useEffect } from 'react';
import {
  auth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  googleProvider,
  sendPasswordResetEmail,
  verifyPasswordResetCode,
  confirmPasswordReset,
  updateProfile,
  reload
} from '../backend';
import { getOrCreateUserProfile, updateUserProfile } from '../services/pulseDb';
import { APP_LOGO_URL, APP_NAME } from '../constants/branding';
import { UserProfile } from '../types';
import confetti from 'canvas-confetti';
import { 
  Mail, 
  ArrowLeft, 
  Eye, 
  EyeOff, 
  ShieldCheck, 
  Sparkles, 
  AlertTriangle, 
  Lock, 
  User, 
  AtSign, 
  ArrowRight,
  Camera,
  RefreshCw
} from 'lucide-react';

interface AuthModalProps {
  onSuccess: (user: UserProfile) => void;
  onToast: (msg: string) => void;
  onClose?: () => void;
}

// 3 Clean Steps: Email -> Password -> Profile (No fake email verification stage)
export type AuthScreen = 
  | 'welcome' 
  | 'step1_email' 
  | 'step2_password' 
  | 'step4_name' 
  | 'login' 
  | 'forgot' 
  | 'resetWithCode';

export const AuthModal: React.FC<AuthModalProps> = ({ onSuccess, onToast, onClose }) => {
  const [screen, setScreen] = useState<AuthScreen>('welcome');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isEmailAlreadyInUse, setIsEmailAlreadyInUse] = useState(false);
  const [isOperationNotAllowed, setIsOperationNotAllowed] = useState(false);
  
  // Registration state
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);
  
  // Profile Customization state
  const [customName, setCustomName] = useState('');
  const [customHandle, setCustomHandle] = useState('');
  const [customBio, setCustomBio] = useState('');
  const [avatarSeed, setAvatarSeed] = useState(Math.random().toString(36).substring(7));
  const [selectedAvatarUrl, setSelectedAvatarUrl] = useState('');

  // Login state
  const [liEmail, setLiEmail] = useState('');
  const [liPassword, setLiPassword] = useState('');
  const [showLiPassword, setShowLiPassword] = useState(false);

  // Forgot password & reset with code
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [resetEmailAccount, setResetEmailAccount] = useState('');

  // Suggested Avatar choices
  const avatarOptions = [
    `https://api.dicebear.com/7.x/avataaars/svg?seed=${avatarSeed}_1`,
    `https://api.dicebear.com/7.x/avataaars/svg?seed=${avatarSeed}_2`,
    `https://api.dicebear.com/7.x/avataaars/svg?seed=${avatarSeed}_3`,
    `https://api.dicebear.com/7.x/bottts/svg?seed=${avatarSeed}_4`,
    `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${avatarSeed}_5`
  ];

  useEffect(() => {
    if (!selectedAvatarUrl && avatarOptions.length > 0) {
      setSelectedAvatarUrl(avatarOptions[0]);
    }
  }, [avatarSeed]);

  // Check URL parameters for Firebase Auth Action Codes (password reset links)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode');
    const oobCode = urlParams.get('oobCode');

    if (mode === 'resetPassword' && oobCode) {
      setResetCode(oobCode);
      setScreen('resetWithCode');
      verifyPasswordResetCode(auth, oobCode)
        .then((email) => {
          setResetEmailAccount(email);
        })
        .catch((err) => {
          console.warn('Reset code verification:', err);
        });
    }
  }, []);

  // -------------------------------------------------------------
  // STEP 1: EMAIL VALIDATION
  // -------------------------------------------------------------
  const handleStep1Submit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsEmailAlreadyInUse(false);
    setIsOperationNotAllowed(false);
    
    const email = regEmail.trim().toLowerCase();
    if (!email || !email.includes('@') || !email.includes('.')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    setScreen('step2_password');
  };

  // -------------------------------------------------------------
  // STEP 2: CREATE FIREBASE ACCOUNT (DIRECTLY ADVANCE TO PROFILE SETUP)
  // -------------------------------------------------------------
  const handleStep2Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsEmailAlreadyInUse(false);
    setIsOperationNotAllowed(false);

    if (!regPassword || regPassword.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setErrorMessage('Passwords do not match. Please re-enter your password.');
      return;
    }

    setLoading(true);
    try {
      const userCred = await createUserWithEmailAndPassword(auth, regEmail.trim(), regPassword);
      const user = userCred.user;

      const defaultName = regEmail.split('@')[0] || 'Creator';
      const defaultHandle = '@' + defaultName.toLowerCase().replace(/[^a-z0-9_.]/g, '').slice(0, 20);
      const initialAvatar = selectedAvatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`;

      await getOrCreateUserProfile({
        uid: user.uid,
        email: user.email,
        displayName: defaultName,
        photoURL: initialAvatar,
        emailVerified: true
      });

      setCustomName(defaultName);
      setCustomHandle(defaultHandle);
      onToast('Account created successfully! Choose your profile details 🎉');
      
      // Directly proceed to profile customization (Step 3) - No fake email code check!
      setScreen('step4_name');
    } catch (err: any) {
      console.error('Account creation error:', err);
      if (err.code === 'auth/operation-not-allowed' || err.message?.includes('operation-not-allowed')) {
        setIsOperationNotAllowed(true);
        setErrorMessage('Email/Password registration is not yet enabled in your Firebase project console. Please enable Email/Password under Firebase Console > Authentication > Sign-in method.');
      } else if (err.code === 'auth/email-already-in-use') {
        setIsEmailAlreadyInUse(true);
        setErrorMessage('An account with this email address already exists.');
      } else if (err.code === 'auth/invalid-email') {
        setErrorMessage('The email address is badly formatted.');
      } else if (err.code === 'auth/weak-password') {
        setErrorMessage('Password is too weak. Please use at least 6 characters.');
      } else {
        setErrorMessage(err.message || 'Failed to create account. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------------
  // STEP 3: CUSTOMIZE NAME, USERNAME & PROFILE
  // -------------------------------------------------------------
  const handleStep4Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    
    const name = customName.trim();
    if (!name || name.length < 2) {
      setErrorMessage('Please enter a display name (at least 2 characters).');
      return;
    }

    let handle = customHandle.trim();
    if (!handle) {
      handle = '@' + name.toLowerCase().replace(/[^a-z0-9_.]/g, '').slice(0, 20);
    }
    if (!handle.startsWith('@')) {
      handle = '@' + handle;
    }

    if (handle.length < 3) {
      setErrorMessage('Username handle must be at least 3 characters.');
      return;
    }

    setLoading(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        setErrorMessage('Session expired. Please log in to complete your profile.');
        setScreen('login');
        return;
      }

      const avatar = selectedAvatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`;

      // Update Firebase Auth profile
      await updateProfile(currentUser, {
        displayName: name,
        photoURL: avatar
      });

      // Update Firestore database
      await updateUserProfile(currentUser.uid, {
        username: name,
        handle: handle,
        bio: customBio.trim(),
        photoURL: avatar,
        emailVerified: true
      });

      const profile = await getOrCreateUserProfile({
        uid: currentUser.uid,
        email: currentUser.email,
        displayName: name,
        photoURL: avatar,
        emailVerified: true
      });

      confetti({ particleCount: 120, spread: 80, origin: { y: 0.5 } });
      onToast(`Welcome to Pulse, ${name}! 🎉 Your account is ready.`);
      onSuccess(profile);
    } catch (err: any) {
      console.error('Profile setup error:', err);
      setErrorMessage(err.message || 'Failed to save profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------------
  // LOGIN FLOW (FIREBASE AUTH)
  // -------------------------------------------------------------
  const handleLogIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsEmailAlreadyInUse(false);
    setIsOperationNotAllowed(false);
    const email = liEmail.trim();
    const password = liPassword;

    if (!email || !password) {
      setErrorMessage('Please enter both email and password.');
      return;
    }

    setLoading(true);
    try {
      const userCred = await signInWithEmailAndPassword(auth, email, password);
      const user = userCred.user;
      
      try {
        await reload(user);
      } catch (reloadErr) {
        console.warn('User reload notice (proceeding):', reloadErr);
      }

      // Fetch or initialize creator profile
      const profile = await getOrCreateUserProfile({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        emailVerified: true
      });

      confetti({ particleCount: 70, spread: 60 });
      onToast(`Welcome back, ${profile.username}! 🎉`);
      onSuccess(profile);
    } catch (err: any) {
      console.error('Log in error:', err);

      let msg = 'Incorrect email or password.';
      if (err.code === 'auth/operation-not-allowed' || err.message?.includes('operation-not-allowed')) {
        setIsOperationNotAllowed(true);
        msg = 'Email/Password sign-in has not been enabled in your Firebase project console yet. Please enable Email/Password under Firebase Console > Authentication > Sign-in method.';
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        msg = 'Incorrect email or password.';
      } else if (err.code === 'auth/invalid-email') {
        msg = 'Please enter a valid email address.';
      } else if (err.code === 'auth/too-many-requests') {
        msg = 'Too many failed attempts. Please reset your password or try again in a few minutes.';
      } else if (err.code === 'auth/network-request-failed') {
        msg = 'Network connection issue. Please check your internet connection.';
      } else if (err.message) {
        msg = err.message;
      }
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMessage('');
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      const profile = await getOrCreateUserProfile({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        emailVerified: true
      });
      confetti({ particleCount: 60, spread: 60 });
      onToast(`Signed in with Google as ${profile.username}`);
      onSuccess(profile);
    } catch (err: any) {
      if (
        err?.code === 'auth/popup-closed-by-user' ||
        err?.code === 'auth/cancelled-popup-request' ||
        err?.message?.includes('popup-closed-by-user')
      ) {
        return;
      }
      if (err?.code === 'auth/popup-blocked') {
        setErrorMessage('Popup was blocked by your browser. Please allow popups to sign in with Google.');
        return;
      }
      console.warn('Google Sign In notice:', err?.message || err);
      setErrorMessage(err?.message || 'Failed to sign in with Google.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail || !forgotEmail.includes('@')) {
      onToast('Please enter a valid email address.');
      return;
    }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, forgotEmail.trim());
      onToast(`Password reset link sent to ${forgotEmail}`);
      setScreen('login');
    } catch (err: any) {
      console.error('Password reset email error:', err);
      onToast('Error: ' + (err.message || 'Could not send reset email'));
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmResetWithCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = resetCode.trim();
    if (!code) {
      setErrorMessage('Please provide the reset code from your email link.');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setErrorMessage('New password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    setErrorMessage('');
    try {
      await confirmPasswordReset(auth, code, newPassword);
      confetti({ particleCount: 70, spread: 60 });
      onToast('Password reset successfully! You can now log in with your new password.');
      setLiPassword('');
      setScreen('login');
    } catch (err: any) {
      console.error('Confirm password reset error:', err);
      setErrorMessage(err.message || 'Invalid or expired reset code. Please request a new link.');
    } finally {
      setLoading(false);
    }
  };

  const isWizardStep = ['step1_email', 'step2_password', 'step4_name'].includes(screen);
  const getStepNumber = () => {
    switch (screen) {
      case 'step1_email': return 1;
      case 'step2_password': return 2;
      case 'step4_name': return 3;
      default: return 1;
    }
  };

  return (
    <div id="authRoot" className="fixed inset-0 z-50 bg-[#050506] text-white flex flex-col justify-between max-w-[480px] mx-auto overflow-hidden animate-in fade-in select-none">
      {/* Top Navigation & Brand Header */}
      <div className="pt-4 px-6 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-black border border-white/20 flex items-center justify-center p-1 shadow-lg overflow-hidden">
              <img
                src={APP_LOGO_URL}
                alt="Pulse Logo"
                className="w-full h-full object-contain rounded-md"
                decoding="async"
              />
            </div>
            <span className="font-black text-xl tracking-tighter text-white">
              Pulse
            </span>
          </div>

          <div className="flex items-center gap-2">
            {screen !== 'welcome' && (
              <button
                id="authBackBtn"
                onClick={() => {
                  setErrorMessage('');
                  setIsEmailAlreadyInUse(false);
                  if (screen === 'step2_password') setScreen('step1_email');
                  else if (screen === 'step4_name') setScreen('step2_password');
                  else setScreen('welcome');
                }}
                className="text-neutral-300 hover:text-white px-3 py-1.5 rounded-xl bg-neutral-900 border border-white/10 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </button>
            )}
            {onClose && screen === 'welcome' && (
              <button
                onClick={onClose}
                className="text-neutral-400 hover:text-white px-3 py-1.5 rounded-xl bg-neutral-900 border border-white/10 text-xs font-semibold cursor-pointer transition-colors"
              >
                Close
              </button>
            )}
          </div>
        </div>

        {/* Wizard Step Progress Indicator */}
        {isWizardStep && (
          <div className="mt-4 pb-1">
            <div className="flex items-center justify-between text-xs font-bold text-neutral-400 mb-1.5 px-0.5">
              <span className={getStepNumber() >= 1 ? 'text-[#ffbd1a]' : ''}>1. Email</span>
              <span className={getStepNumber() >= 2 ? 'text-[#ffbd1a]' : ''}>2. Password</span>
              <span className={getStepNumber() >= 3 ? 'text-[#ffbd1a]' : ''}>3. Profile</span>
            </div>
            <div className="w-full h-1.5 bg-neutral-900 rounded-full overflow-hidden flex gap-1.5">
              <div className={`h-full flex-1 rounded-full transition-all duration-300 ${getStepNumber() >= 1 ? 'bg-[#ffbd1a]' : 'bg-neutral-800'}`} />
              <div className={`h-full flex-1 rounded-full transition-all duration-300 ${getStepNumber() >= 2 ? 'bg-[#ffbd1a]' : 'bg-neutral-800'}`} />
              <div className={`h-full flex-1 rounded-full transition-all duration-300 ${getStepNumber() >= 3 ? 'bg-[#ffbd1a]' : 'bg-neutral-800'}`} />
            </div>
          </div>
        )}
      </div>

      {/* Screen 0: Welcome / Landing */}
      {screen === 'welcome' && (
        <div className="flex-1 flex flex-col justify-center items-center px-6 py-6 overflow-y-auto text-center w-full max-w-[360px] mx-auto">
          <div className="w-20 h-20 mb-4 rounded-2xl bg-black border border-white/20 p-2.5 shadow-2xl flex items-center justify-center">
            <img
              src={APP_LOGO_URL}
              alt="Pulse Logo"
              className="w-full h-full object-contain rounded-xl"
              decoding="async"
            />
          </div>
          <div className="w-full mb-6">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#ffbd1a]/15 text-[#ffbd1a] border border-[#ffbd1a]/30 mb-2.5">
              <Sparkles className="w-3.5 h-3.5" /> 100% Real Community
            </div>
            <h1 className="text-2xl font-black tracking-tight mb-2 text-white">
              Real creators. Real videos.
            </h1>
            <p className="text-neutral-400 text-xs leading-relaxed max-w-[280px] mx-auto">
              Join the high-energy vertical video community powered by Firebase. Create, broadcast and connect.
            </p>
          </div>

          {/* Standardized, uniform action buttons */}
          <div className="w-full flex flex-col gap-3">
            <button
              id="goSignup"
              onClick={() => {
                setErrorMessage('');
                setIsEmailAlreadyInUse(false);
                setIsOperationNotAllowed(false);
                setScreen('step1_email');
              }}
              className="w-full h-12 px-4 bg-white hover:bg-neutral-200 text-black font-bold rounded-xl shadow-md transition-all active:scale-[0.98] cursor-pointer text-sm flex items-center justify-center gap-2"
            >
              <span>Create Account with Email</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              id="goLogin"
              onClick={() => {
                setErrorMessage('');
                setIsEmailAlreadyInUse(false);
                setIsOperationNotAllowed(false);
                setScreen('login');
              }}
              className="w-full h-12 px-4 bg-neutral-900 hover:bg-neutral-800 text-white font-bold rounded-xl border border-white/15 transition-all active:scale-[0.98] cursor-pointer text-sm flex items-center justify-center"
            >
              Log in with Email
            </button>

            <div className="my-1 flex items-center gap-3">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-[11px] text-neutral-500 uppercase tracking-wider font-semibold">Or</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>

            <button
              id="welcomeGoogleBtn"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full h-12 px-4 bg-neutral-900 hover:bg-neutral-800 text-white border border-white/15 font-semibold rounded-xl flex items-center justify-center gap-2.5 shadow-sm transition-all cursor-pointer disabled:opacity-50 text-sm active:scale-[0.98]"
            >
              <svg viewBox="0 0 48 48" width="18" height="18">
                <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l6-6C34 5.1 29.3 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21 21-9.4 21-21c0-1.4-.1-2.5-.4-3.5z"/>
                <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.6 18.9 13 24 13c3.1 0 5.8 1.1 8 3l6-6C34 5.1 29.3 3 24 3 16.3 3 9.6 7.3 6.3 14.7z"/>
                <path fill="#4CAF50" d="M24 45c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.4-4.5 2.3-7.2 2.3-5.3 0-9.7-3.4-11.3-8.1l-6.5 5C9.5 40.5 16.2 45 24 45z"/>
                <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.2 5.2C40.9 35.9 45 30.5 45 24c0-1.4-.1-2.5-1.4-3.5z"/>
              </svg>
              <span>Continue with Google</span>
            </button>
          </div>
        </div>
      )}

      {/* STEP 1: Input Email */}
      {screen === 'step1_email' && (
        <div className="flex-1 flex flex-col justify-center items-center px-6 py-6 overflow-y-auto w-full max-w-[360px] mx-auto">
          <div className="mb-6 text-center w-full">
            <div className="inline-flex items-center gap-1 text-xs font-bold text-[#ffbd1a] uppercase tracking-wider mb-1">
              Step 1 of 3
            </div>
            <h2 className="text-xl font-extrabold text-white">What's your email?</h2>
            <p className="text-neutral-400 text-xs mt-1">
              Enter your email to get started on Pulse.
            </p>
          </div>

          <form onSubmit={handleStep1Submit} className="flex flex-col gap-4 w-full">
            <div>
              <label className="block text-xs font-semibold text-neutral-400 mb-1.5">Email Address</label>
              <div className="relative">
                <input
                  id="regEmailInput"
                  type="email"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="name@example.com"
                  autoFocus
                  required
                  className="w-full h-12 bg-neutral-900 border border-white/15 rounded-xl px-4 pl-11 text-white placeholder:text-neutral-500 focus:outline-none focus:border-[#ffbd1a] transition-colors text-sm"
                />
                <Mail className="w-4 h-4 text-neutral-400 absolute left-3.5 top-4" />
              </div>
            </div>

            {errorMessage && (
              <div className="text-[#ff5361] text-xs font-medium bg-[#ff5361]/10 p-3 rounded-xl border border-[#ff5361]/20 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <button
              id="step1SubmitBtn"
              type="submit"
              className="w-full h-12 bg-white hover:bg-neutral-200 text-black font-bold rounded-xl transition-all shadow-md cursor-pointer flex items-center justify-center gap-2 text-sm active:scale-[0.98] mt-1"
            >
              <span>Next: Create Password</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-neutral-400">
            Already have an account?{' '}
            <span
              onClick={() => {
                setErrorMessage('');
                setScreen('login');
              }}
              className="text-[#ffbd1a] font-bold cursor-pointer hover:underline"
            >
              Log in
            </span>
          </p>
        </div>
      )}

      {/* STEP 2: Input Password */}
      {screen === 'step2_password' && (
        <div className="flex-1 flex flex-col justify-center items-center px-6 py-6 overflow-y-auto w-full max-w-[360px] mx-auto">
          <div className="mb-6 text-center w-full">
            <div className="inline-flex items-center gap-1 text-xs font-bold text-[#ffbd1a] uppercase tracking-wider mb-1">
              Step 2 of 3
            </div>
            <h2 className="text-xl font-extrabold text-white">Create a Password</h2>
            <div className="flex items-center justify-center gap-2 mt-1">
              <span className="text-neutral-400 text-xs truncate max-w-[240px]">{regEmail}</span>
              <button 
                type="button" 
                onClick={() => setScreen('step1_email')} 
                className="text-xs text-[#ffbd1a] hover:underline cursor-pointer font-bold"
              >
                Change
              </button>
            </div>
          </div>

          <form onSubmit={handleStep2Submit} className="flex flex-col gap-4 w-full">
            <div>
              <label className="block text-xs font-semibold text-neutral-400 mb-1.5">Password (6+ chars)</label>
              <div className="relative">
                <input
                  id="regPasswordInput"
                  type={showRegPassword ? 'text' : 'password'}
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="••••••••"
                  autoFocus
                  required
                  className="w-full h-12 bg-neutral-900 border border-white/15 rounded-xl px-4 pl-11 pr-11 text-white placeholder:text-neutral-500 focus:outline-none focus:border-[#ffbd1a] transition-colors text-sm"
                />
                <Lock className="w-4 h-4 text-neutral-400 absolute left-3.5 top-4" />
                <button
                  type="button"
                  onClick={() => setShowRegPassword(!showRegPassword)}
                  className="absolute right-3.5 top-3.5 text-neutral-400 hover:text-white cursor-pointer"
                >
                  {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-400 mb-1.5">Confirm Password</label>
              <div className="relative">
                <input
                  id="regConfirmPasswordInput"
                  type={showRegConfirmPassword ? 'text' : 'password'}
                  value={regConfirmPassword}
                  onChange={(e) => setRegConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full h-12 bg-neutral-900 border border-white/15 rounded-xl px-4 pl-11 pr-11 text-white placeholder:text-neutral-500 focus:outline-none focus:border-[#ffbd1a] transition-colors text-sm"
                />
                <ShieldCheck className="w-4 h-4 text-neutral-400 absolute left-3.5 top-4" />
                <button
                  type="button"
                  onClick={() => setShowRegConfirmPassword(!showRegConfirmPassword)}
                  className="absolute right-3.5 top-3.5 text-neutral-400 hover:text-white cursor-pointer"
                >
                  {showRegConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {errorMessage && (
              <div className="text-[#ff5361] text-xs font-medium bg-[#ff5361]/10 p-3.5 rounded-xl border border-[#ff5361]/20 flex flex-col gap-2.5">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
                {isOperationNotAllowed && (
                  <div className="mt-1 flex flex-col gap-2 text-neutral-300 text-xs bg-black/40 p-3 rounded-lg border border-white/10">
                    <p className="font-semibold text-white">How to enable Email/Password in Firebase:</p>
                    <ol className="list-decimal list-inside space-y-1 text-neutral-400 text-[11px]">
                      <li>Open Firebase Console &gt; Authentication &gt; Sign-in method</li>
                      <li>Click <b>Email/Password</b> and toggle <b>Enable</b> to ON</li>
                      <li>Click <b>Save</b></li>
                    </ol>
                    <a
                      href="https://console.firebase.google.com/project/gen-lang-client-0540521297/authentication/providers"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-1.5 w-full py-2 bg-[#ffbd1a] text-black font-bold rounded-lg text-xs hover:bg-[#ffc93f] transition-colors mt-1"
                    >
                      Open Firebase Console Settings ↗
                    </a>
                  </div>
                )}
                {isEmailAlreadyInUse && (
                  <button
                    type="button"
                    onClick={() => {
                      setLiEmail(regEmail);
                      setScreen('login');
                    }}
                    className="self-start text-xs underline font-bold text-[#ffbd1a] cursor-pointer"
                  >
                    Log in instead
                  </button>
                )}
              </div>
            )}

            <button
              id="step2SubmitBtn"
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-white hover:bg-neutral-200 text-black font-bold rounded-xl transition-all shadow-md cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 text-sm active:scale-[0.98] mt-1"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>Create Account</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* STEP 3: Customize Display Name, Username & Profile Picture */}
      {screen === 'step4_name' && (
        <div className="flex-1 flex flex-col justify-center items-center px-6 py-6 overflow-y-auto w-full max-w-[360px] mx-auto">
          <div className="mb-5 text-center w-full">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#ffbd1a] uppercase tracking-wider mb-1">
              <Sparkles className="w-3.5 h-3.5" /> Step 3 of 3: Profile Setup
            </div>
            <h2 className="text-xl font-extrabold text-white">Choose Your Name</h2>
            <p className="text-neutral-400 text-xs mt-1">
              Set up your public identity on Pulse.
            </p>
          </div>

          <form onSubmit={handleStep4Submit} className="flex flex-col gap-3.5 w-full">
            {/* Avatar Picker */}
            <div>
              <label className="block text-xs font-semibold text-neutral-400 mb-2">Profile Picture</label>
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none justify-center">
                <label className="w-10 h-10 rounded-xl bg-neutral-900 border border-dashed border-[#ffbd1a]/60 flex flex-col items-center justify-center text-neutral-300 hover:text-white shrink-0 cursor-pointer overflow-hidden transition-all hover:border-[#ffbd1a]">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          setSelectedAvatarUrl(reader.result as string);
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                  <Camera className="w-4 h-4 text-[#ffbd1a]" />
                </label>

                {avatarOptions.map((url, idx) => (
                  <div
                    key={idx}
                    onClick={() => setSelectedAvatarUrl(url)}
                    className={`w-10 h-10 rounded-xl overflow-hidden shrink-0 border cursor-pointer transition-all ${
                      selectedAvatarUrl === url ? 'border-[#ffbd1a] scale-105 shadow ring-2 ring-[#ffbd1a]/30' : 'border-white/10 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img src={url} alt="Avatar option" className="w-full h-full object-cover bg-neutral-800" />
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setAvatarSeed(Math.random().toString(36).substring(7))}
                  className="w-8 h-8 rounded-xl bg-neutral-900 border border-white/10 flex items-center justify-center text-neutral-400 hover:text-white shrink-0 cursor-pointer"
                  title="Generate more avatars"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-400 mb-1.5">Display Name</label>
              <div className="relative">
                <input
                  id="customNameInput"
                  type="text"
                  value={customName}
                  onChange={(e) => {
                    setCustomName(e.target.value);
                    if (!customHandle || customHandle === '@' + customName.toLowerCase().replace(/[^a-z0-9_.]/g, '').slice(0, 20)) {
                      setCustomHandle('@' + e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, '').slice(0, 20));
                    }
                  }}
                  placeholder="e.g. Alex Rivera"
                  autoFocus
                  required
                  className="w-full h-12 bg-neutral-900 border border-white/15 rounded-xl px-4 pl-11 text-white placeholder:text-neutral-500 focus:outline-none focus:border-[#ffbd1a] transition-colors text-sm"
                />
                <User className="w-4 h-4 text-neutral-400 absolute left-3.5 top-4" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-400 mb-1.5">Username Handle</label>
              <div className="relative">
                <input
                  id="customHandleInput"
                  type="text"
                  value={customHandle}
                  onChange={(e) => {
                    setCustomHandle(e.target.value.replace(/^@+/, '').toLowerCase());
                  }}
                  placeholder="alex_rivera"
                  required
                  className="w-full h-12 bg-neutral-900 border border-white/15 rounded-xl px-4 pl-11 text-white placeholder:text-neutral-500 focus:outline-none focus:border-[#ffbd1a] transition-colors text-sm"
                />
                <AtSign className="w-4 h-4 text-neutral-400 absolute left-3.5 top-4" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-400 mb-1.5">Bio (Optional)</label>
              <input
                id="customBioInput"
                type="text"
                value={customBio}
                onChange={(e) => setCustomBio(e.target.value)}
                placeholder="Video creator & storyteller ⚡️"
                maxLength={100}
                className="w-full h-12 bg-neutral-900 border border-white/15 rounded-xl px-4 text-white placeholder:text-neutral-500 focus:outline-none focus:border-[#ffbd1a] transition-colors text-sm"
              />
            </div>

            {errorMessage && (
              <div className="text-[#ff5361] text-xs font-medium bg-[#ff5361]/10 p-3 rounded-xl border border-[#ff5361]/20 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <button
              id="step4SubmitBtn"
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-[#ffbd1a] hover:bg-[#ffc93f] text-black font-bold rounded-xl shadow-lg transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 text-sm mt-1"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>Complete Setup &amp; Enter Pulse</span>
                  <Sparkles className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* Screen: Log In Form */}
      {screen === 'login' && (
        <div className="flex-1 flex flex-col justify-center items-center px-6 py-6 overflow-y-auto w-full max-w-[360px] mx-auto">
          <div className="w-full mb-6 text-center">
            <div className="w-16 h-16 mx-auto mb-3 overflow-hidden rounded-2xl bg-black border border-white/20 p-2 shadow-xl flex items-center justify-center">
              <img src={APP_LOGO_URL} alt={`${APP_NAME} logo`} className="w-full h-full object-contain rounded-xl" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white">Sign in to {APP_NAME}</h1>
            <p className="text-neutral-400 text-xs mt-1">Welcome back! Access your feed and creators.</p>
          </div>

          <form onSubmit={handleLogIn} className="flex flex-col gap-3.5 w-full">
            <div>
              <label className="block text-xs font-semibold text-neutral-400 mb-1.5">Email</label>
              <div className="relative">
                <input 
                  id="liEmail" 
                  type="email" 
                  value={liEmail} 
                  onChange={(e) => setLiEmail(e.target.value)} 
                  placeholder="name@example.com" 
                  required 
                  autoFocus 
                  className="w-full h-12 bg-neutral-900 border border-white/15 rounded-xl px-4 pl-11 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-[#ffbd1a]" 
                />
                <Mail className="w-4 h-4 text-neutral-400 absolute left-3.5 top-4" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-neutral-400">Password</label>
                <button 
                  type="button" 
                  onClick={() => { setForgotEmail(liEmail); setScreen('forgot'); }} 
                  className="text-xs text-[#ffbd1a] hover:underline cursor-pointer"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input 
                  id="liPassword" 
                  type={showLiPassword ? 'text' : 'password'} 
                  value={liPassword} 
                  onChange={(e) => setLiPassword(e.target.value)} 
                  placeholder="Password" 
                  required 
                  className="w-full h-12 bg-neutral-900 border border-white/15 rounded-xl px-4 pl-11 pr-11 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-[#ffbd1a]" 
                />
                <Lock className="w-4 h-4 text-neutral-400 absolute left-3.5 top-4" />
                <button 
                  type="button" 
                  onClick={() => setShowLiPassword(!showLiPassword)} 
                  className="absolute right-3.5 top-3.5 text-neutral-400 hover:text-white cursor-pointer"
                >
                  {showLiPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {errorMessage && (
              <div id="liError" className="text-[#ff5361] text-xs font-medium bg-[#ff5361]/10 p-3.5 rounded-xl border border-[#ff5361]/20 flex flex-col gap-2.5">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
                {isOperationNotAllowed && (
                  <div className="mt-1 flex flex-col gap-2 text-neutral-300 text-xs bg-black/40 p-3 rounded-lg border border-white/10">
                    <p className="font-semibold text-white">How to enable Email/Password in Firebase:</p>
                    <ol className="list-decimal list-inside space-y-1 text-neutral-400 text-[11px]">
                      <li>Open Firebase Console &gt; Authentication &gt; Sign-in method</li>
                      <li>Click <b>Email/Password</b> and toggle <b>Enable</b> to ON</li>
                      <li>Click <b>Save</b></li>
                    </ol>
                    <a
                      href="https://console.firebase.google.com/project/gen-lang-client-0540521297/authentication/providers"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-1.5 w-full py-2 bg-[#ffbd1a] text-black font-bold rounded-lg text-xs hover:bg-[#ffc93f] transition-colors mt-1"
                    >
                      Open Firebase Console Settings ↗
                    </a>
                  </div>
                )}
              </div>
            )}

            <button 
              id="liSubmit" 
              type="submit" 
              disabled={loading} 
              className="w-full h-12 rounded-xl bg-white hover:bg-neutral-200 text-black font-bold text-sm flex items-center justify-center transition-transform active:scale-[0.98] disabled:opacity-60 cursor-pointer shadow-md mt-1"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
              ) : (
                'Log in to Pulse'
              )}
            </button>
          </form>

          <div className="flex items-center gap-3 my-4 w-full text-xs text-neutral-500">
            <div className="h-px bg-white/10 flex-1" />
            <span>or</span>
            <div className="h-px bg-white/10 flex-1" />
          </div>

          <button 
            id="liGoogle" 
            onClick={handleGoogleSignIn} 
            disabled={loading} 
            className="w-full h-12 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white border border-white/15 font-semibold text-sm flex items-center justify-center gap-2.5 transition-transform active:scale-[0.98] disabled:opacity-60 cursor-pointer shadow-sm"
          >
            <svg viewBox="0 0 48 48" width="18" height="18">
              <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l6-6C34 5.1 29.3 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21 21-9.4 21-21c0-1.4-.1-2.5-.4-3.5z"/>
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.6 18.9 13 24 13c3.1 0 5.8 1.1 8 3l6-6C34 5.1 29.3 3 24 3 16.3 3 9.6 7.3 6.3 14.7z"/>
              <path fill="#4CAF50" d="M24 45c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.4-4.5 2.3-7.2 2.3-5.3 0-9.7-3.4-11.3-8.1l-6.5 5C9.5 40.5 16.2 45 24 45z"/>
              <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.2 5.2C40.9 35.9 45 30.5 45 24c0-1.4-.1-2.5-1.4-3.5z"/>
            </svg>
            <span>Continue with Google</span>
          </button>

          <p className="mt-5 text-center text-xs text-neutral-400">
            Need an account?{' '}
            <button 
              type="button" 
              onClick={() => { setErrorMessage(''); setScreen('step1_email'); }} 
              className="text-[#ffbd1a] font-bold hover:underline cursor-pointer"
            >
              Sign up
            </button>
          </p>
        </div>
      )}

      {/* Screen: Forgot Password Request */}
      {screen === 'forgot' && (
        <div className="flex-1 flex flex-col justify-center items-center px-6 py-6 overflow-y-auto w-full max-w-[360px] mx-auto">
          <div className="mb-6 text-center w-full">
            <h2 className="text-xl font-extrabold text-white">Reset Password</h2>
            <p className="text-neutral-400 text-xs mt-1">Enter your email and we'll send a password reset link.</p>
          </div>

          <form onSubmit={handleSendResetPassword} className="flex flex-col gap-4 w-full">
            <div>
              <label className="block text-xs font-semibold text-neutral-400 mb-1.5">Email Address</label>
              <div className="relative">
                <input
                  id="forgotEmail"
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="you@domain.com"
                  required
                  className="w-full h-12 bg-neutral-900 border border-white/15 rounded-xl px-4 pl-11 text-white placeholder:text-neutral-500 focus:outline-none focus:border-[#ffbd1a] transition-colors text-sm"
                />
                <Mail className="w-4 h-4 text-neutral-400 absolute left-3.5 top-4" />
              </div>
            </div>

            <button
              id="sendResetBtn"
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-white hover:bg-neutral-200 text-black font-bold rounded-xl transition-all shadow-md cursor-pointer disabled:opacity-50 text-sm active:scale-[0.98] mt-1"
            >
              {loading ? 'Sending link...' : 'Send Reset Link'}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-neutral-400">
            Remember your password?{' '}
            <span
              onClick={() => setScreen('login')}
              className="text-[#ffbd1a] font-bold cursor-pointer hover:underline"
            >
              Log in
            </span>
          </p>
        </div>
      )}

      {/* Screen: Reset Password With Code */}
      {screen === 'resetWithCode' && (
        <div className="flex-1 flex flex-col justify-center items-center px-6 py-6 overflow-y-auto w-full max-w-[360px] mx-auto">
          <div className="mb-6 text-center w-full">
            <h2 className="text-xl font-extrabold text-white">Set New Password</h2>
            <p className="text-neutral-400 text-xs mt-1">
              Enter your new password for {resetEmailAccount || 'your account'}
            </p>
          </div>

          <form onSubmit={handleConfirmResetWithCode} className="flex flex-col gap-4 w-full">
            <div>
              <label className="block text-xs font-semibold text-neutral-400 mb-1.5">New Password (6+ characters)</label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full h-12 bg-neutral-900 border border-white/15 rounded-xl px-4 pl-11 pr-11 text-white placeholder:text-neutral-500 focus:outline-none focus:border-[#ffbd1a] transition-colors text-sm"
                />
                <Lock className="w-4 h-4 text-neutral-400 absolute left-3.5 top-4" />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3.5 top-3.5 text-neutral-400 hover:text-white cursor-pointer"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {errorMessage && (
              <div className="text-[#ff5361] text-xs font-medium bg-[#ff5361]/10 p-3 rounded-xl border border-[#ff5361]/20 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-[#ffbd1a] hover:bg-[#ffc93f] text-black font-bold rounded-xl transition-all shadow-md cursor-pointer disabled:opacity-50 text-sm active:scale-[0.98] mt-1"
            >
              {loading ? 'Saving new password...' : 'Save Password & Log in'}
            </button>
          </form>
        </div>
      )}

      {/* Footer info */}
      <div className="px-6 pb-4 text-center text-[10px] text-neutral-500">
        Secured by Firebase Authentication &amp; Cloud Firestore.
      </div>
    </div>
  );
};
