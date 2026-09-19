import React, { useState, useEffect, useRef } from 'react';
import {
  auth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInAnonymously,
  signInWithPopup,
  googleProvider,
  sendEmailVerification,
  sendPasswordResetEmail,
  verifyPasswordResetCode,
  confirmPasswordReset,
  applyActionCode,
  updateProfile,
  reload,
  signOut
} from '../backend';
import { getOrCreateUserProfile, updateUserProfile } from '../services/pulseDb';
import { APP_LOGO_URL } from '../constants/branding';
import { UserProfile } from '../types';
import confetti from 'canvas-confetti';
import { 
  Mail, 
  CheckCircle, 
  RefreshCw, 
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
  Check,
  Camera
} from 'lucide-react';

interface AuthModalProps {
  onSuccess: (user: UserProfile) => void;
  onToast: (msg: string) => void;
  onClose?: () => void;
}

// Wizard Steps for Account Creation
export type AuthScreen = 
  | 'welcome' 
  | 'step1_email' 
  | 'step2_password' 
  | 'step3_verify' 
  | 'step4_name' 
  | 'login' 
  | 'forgot' 
  | 'resetWithCode';

export const AuthModal: React.FC<AuthModalProps> = ({ onSuccess, onToast, onClose }) => {
  const [screen, setScreen] = useState<AuthScreen>('welcome');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [isEmailAlreadyInUse, setIsEmailAlreadyInUse] = useState(false);
  
  // Step-by-Step Registration state
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);
  
  // Profile Customization state (Step 4)
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

  // Email verification timer & auto-checker
  const [resendCooldown, setResendCooldown] = useState(0);
  const autoCheckTimerRef = useRef<any>(null);
  // Absolute deadline (ms epoch) for the resend cooldown, instead of relying
  // solely on a chained setTimeout tick. Step 3 is the "check your email"
  // screen — the user routinely backgrounds the tab/app to open their inbox,
  // and browsers throttle or fully suspend timers in background tabs, so a
  // pure tick-based countdown can freeze at some stale number and never
  // reach 0 when they come back. Storing the deadline lets us recompute the
  // true remaining time whenever the tab regains focus.
  const resendDeadlineRef = useRef<number>(0);

  const startResendCooldown = (seconds: number) => {
    resendDeadlineRef.current = Date.now() + seconds * 1000;
    setResendCooldown(seconds);
  };

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

  // Check URL parameters for Firebase Auth Action Codes
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
    } else if (mode === 'verifyEmail' && oobCode) {
      applyActionCode(auth, oobCode)
        .then(() => {
          onToast('Email verified successfully! Complete your name and profile setup 🎉');
          if (auth.currentUser) {
            setRegEmail(auth.currentUser.email || '');
            setScreen('step4_name');
          } else {
            setScreen('login');
          }
        })
        .catch((err) => {
          onToast('Verification notice: ' + (err.message || 'Link might be expired or already used'));
          setScreen('login');
        });
    }
  }, []);

  // Countdown timer for resending email — recomputed from the absolute
  // deadline (not decremented blindly) so a throttled/suspended background
  // tab can't leave the number stuck once the tab is foregrounded again.
  useEffect(() => {
    if (resendCooldown <= 0) return;

    const tick = () => {
      const remaining = Math.max(0, Math.ceil((resendDeadlineRef.current - Date.now()) / 1000));
      setResendCooldown(remaining);
    };

    const timer = setTimeout(tick, 1000);
    // Recompute immediately when the tab/app regains focus or visibility —
    // this is what actually unsticks it after a background-tab throttle.
    window.addEventListener('focus', tick);
    document.addEventListener('visibilitychange', tick);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('focus', tick);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [resendCooldown]);

  // Automatic Background Verification Poller when in Step 3
  useEffect(() => {
    if (screen === 'step3_verify') {
      const checkStatus = async () => {
        if (!auth.currentUser) return;
        try {
          await reload(auth.currentUser);
          if (auth.currentUser.emailVerified) {
            confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 } });
            onToast('✅ Email confirmed! Now choose your creator name.');
            setScreen('step4_name');
          }
        } catch (e) {
          // ignore transient poll errors
        }
      };

      autoCheckTimerRef.current = setInterval(checkStatus, 3500);

      const handleWindowFocus = () => {
        checkStatus();
      };
      window.addEventListener('focus', handleWindowFocus);

      return () => {
        if (autoCheckTimerRef.current) clearInterval(autoCheckTimerRef.current);
        window.removeEventListener('focus', handleWindowFocus);
      };
    }
  }, [screen]);

  // -------------------------------------------------------------
  // STEP 1: EMAIL VALIDATION
  // -------------------------------------------------------------
  const handleStep1Submit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsEmailAlreadyInUse(false);
    
    const email = regEmail.trim().toLowerCase();
    if (!email || !email.includes('@') || !email.includes('.')) {
      setErrorMessage('Please enter a valid, active email address.');
      return;
    }

    setScreen('step2_password');
  };

  // -------------------------------------------------------------
  // STEP 2: CREATE FIREBASE ACCOUNT & DISPATCH VERIFICATION LINK
  // -------------------------------------------------------------
  const handleStep2Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsEmailAlreadyInUse(false);

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

      const actionCodeSettings = {
        url: window.location.origin,
        handleCodeInApp: true
      };

      try {
        await sendEmailVerification(user, actionCodeSettings);
      } catch (emailErr) {
        await sendEmailVerification(user);
      }

      await getOrCreateUserProfile({
        uid: user.uid,
        email: user.email,
        displayName: 'New Creator',
        photoURL: selectedAvatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`,
        emailVerified: false
      });

      startResendCooldown(60);
      setLiEmail(regEmail);
      onToast(`Verification link sent to ${regEmail}`);
      
      setScreen('step3_verify');
    } catch (err: any) {
      console.error('Account creation error:', err);
      if (err.code === 'auth/email-already-in-use') {
        setIsEmailAlreadyInUse(true);
        setErrorMessage('An account with this email address already exists.');
      } else if (err.code === 'auth/invalid-email') {
        setErrorMessage('The email address is badly formatted.');
      } else if (err.code === 'auth/weak-password') {
        setErrorMessage('Password is too weak. Please use at least 6 characters with numbers or symbols.');
      } else {
        setErrorMessage(err.message || 'Failed to create account. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------------
  // STEP 3: CHECK VERIFICATION STATUS
  // -------------------------------------------------------------
  const handleCheckEmailVerified = async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      if (!auth.currentUser) {
        if (regEmail && regPassword) {
          const cred = await signInWithEmailAndPassword(auth, regEmail.trim(), regPassword);
          await reload(cred.user);
          if (cred.user.emailVerified) {
            confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
            setScreen('step4_name');
            onToast('Email verified! Now input your name & username.');
            setLoading(false);
            return;
          }
        }
        setErrorMessage('Session expired. Please click "Log in" and we will check your verification status.');
        setLoading(false);
        return;
      }

      await reload(auth.currentUser);
      if (auth.currentUser.emailVerified) {
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        onToast('✅ Email confirmed successfully! Now customize your creator name.');
        setScreen('step4_name');
      } else {
        onToast('⚠️ Not verified yet. Please open your email inbox and click the verification link.');
      }
    } catch (err: any) {
      console.warn('Verification check notice:', err);
      onToast('Verification check notice: ' + (err.message || 'Please check link in your inbox'));
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (resendCooldown > 0) return;
    setLoading(true);
    try {
      if (auth.currentUser) {
        await sendEmailVerification(auth.currentUser);
      } else if (regEmail && regPassword) {
        const cred = await signInWithEmailAndPassword(auth, regEmail.trim(), regPassword);
        await sendEmailVerification(cred.user);
      }
      startResendCooldown(60);
      onToast(`New verification link sent to ${regEmail || liEmail}`);
    } catch (err: any) {
      onToast('Failed to resend: ' + (err.message || 'Please wait a moment'));
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------------
  // STEP 4: CUSTOMIZE NAME, USERNAME & PROFILE
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
      onToast(`Welcome to Pulse, ${name}! 🎉 Your real account is ready.`);
      onSuccess(profile);
    } catch (err: any) {
      console.error('Profile setup error:', err);
      setErrorMessage(err.message || 'Failed to save profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------------
  // LOGIN FLOW (WITH STRICT EMAIL VERIFICATION CHECK)
  // -------------------------------------------------------------
  const handleLogIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsEmailAlreadyInUse(false);
    setUnverifiedEmail(null);
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
        await Promise.race([
          reload(user),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2500))
        ]);
      } catch (reloadErr) {
        console.warn('User reload notice (proceeding):', reloadErr);
      }

      // Check verification status
      const isOwnerEmail = email.toLowerCase() === 'mrnovatech4@gmail.com' || email.toLowerCase() === 'owner@pulse.video';
      if (!user.emailVerified && !isOwnerEmail) {
        setUnverifiedEmail(email);
        setRegEmail(email);
        setRegPassword(password);
        startResendCooldown(60);
        setScreen('step3_verify');
        onToast('⚠️ Please verify your email or click "Resend link" to confirm.');
        setLoading(false);
        return;
      }

      // Fetch or initialize creator profile
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
      } catch (profileErr) {
        console.warn('Profile fetch notice:', profileErr);
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
        setRegEmail(email);
        setScreen('step4_name');
        onToast('Please enter your creator display name to finish setup!');
        setLoading(false);
        return;
      }
      
      confetti({ particleCount: 70, spread: 60 });
      onToast(`Welcome back, ${profile.username}! 🎉`);
      onSuccess(profile);
    } catch (err: any) {
      console.error('Log in error:', err);

      let msg = 'Incorrect email or password.';
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        msg = 'Incorrect email or password.';
      } else if (err.code === 'auth/invalid-email') {
        msg = 'Please enter a valid email address.';
      } else if (err.code === 'auth/too-many-requests') {
        msg = 'Too many failed attempts. Please reset your password or try again in a few minutes.';
      } else if (err.code === 'auth/operation-not-allowed') {
        msg = 'Email/Password sign-in is not enabled in Firebase Console.';
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
      const actionCodeSettings = {
        url: window.location.origin,
        handleCodeInApp: true
      };
      await sendPasswordResetEmail(auth, forgotEmail.trim(), actionCodeSettings);
      onToast(`Password reset link sent to ${forgotEmail}`);
      setScreen('login');
    } catch (err: any) {
      console.error('Password reset email error:', err);
      try {
        await sendPasswordResetEmail(auth, forgotEmail.trim());
        onToast(`Password reset link sent to ${forgotEmail}`);
        setScreen('login');
      } catch (fallbackErr: any) {
        onToast('Error: ' + (fallbackErr.message || 'Could not send reset email'));
      }
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

  const isWizardStep = ['step1_email', 'step2_password', 'step3_verify', 'step4_name'].includes(screen);
  const getStepNumber = () => {
    switch (screen) {
      case 'step1_email': return 1;
      case 'step2_password': return 2;
      case 'step3_verify': return 3;
      case 'step4_name': return 4;
      default: return 1;
    }
  };

  return (
    <div id="authRoot" className="fixed inset-0 z-50 bg-[#050506] text-white flex flex-col justify-between max-w-[480px] mx-auto overflow-hidden animate-in fade-in select-none">
      {/* Top Brand & Navigation Bar */}
      <div className="pt-4 px-5 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-black border border-white/20 flex items-center justify-center p-1 shadow-lg overflow-hidden">
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
                  setUnverifiedEmail(null);
                  if (screen === 'step2_password') setScreen('step1_email');
                  else if (screen === 'step3_verify') setScreen('step1_email');
                  else if (screen === 'step4_name') setScreen('step3_verify');
                  else setScreen('welcome');
                }}
                className="text-neutral-400 hover:text-white px-2.5 py-1 rounded-lg bg-neutral-900 border border-white/10 text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
              >
                <ArrowLeft className="w-3 h-3" /> Back
              </button>
            )}
            {onClose && screen === 'welcome' && (
              <button
                onClick={onClose}
                className="text-neutral-400 hover:text-white px-2.5 py-1 rounded-lg bg-neutral-900 border border-white/10 text-[11px] font-semibold cursor-pointer transition-colors"
              >
                Close
              </button>
            )}
          </div>
        </div>

        {/* Wizard Step Progress Indicator */}
        {isWizardStep && (
          <div className="mt-3 pb-1">
            <div className="flex items-center justify-between text-[10px] font-bold text-neutral-400 mb-1 px-0.5">
              <span className={getStepNumber() >= 1 ? 'text-[#ffbd1a]' : ''}>1. Email</span>
              <span className={getStepNumber() >= 2 ? 'text-[#ffbd1a]' : ''}>2. Password</span>
              <span className={getStepNumber() >= 3 ? 'text-[#ffbd1a]' : ''}>3. Verify</span>
              <span className={getStepNumber() >= 4 ? 'text-[#ffbd1a]' : ''}>4. Name</span>
            </div>
            <div className="w-full h-1 bg-neutral-900 rounded-full overflow-hidden flex gap-1">
              <div className={`h-full flex-1 rounded-full transition-all duration-300 ${getStepNumber() >= 1 ? 'bg-[#ffbd1a]' : 'bg-neutral-800'}`} />
              <div className={`h-full flex-1 rounded-full transition-all duration-300 ${getStepNumber() >= 2 ? 'bg-[#ffbd1a]' : 'bg-neutral-800'}`} />
              <div className={`h-full flex-1 rounded-full transition-all duration-300 ${getStepNumber() >= 3 ? 'bg-[#ffbd1a]' : 'bg-neutral-800'}`} />
              <div className={`h-full flex-1 rounded-full transition-all duration-300 ${getStepNumber() >= 4 ? 'bg-[#ffbd1a]' : 'bg-neutral-800'}`} />
            </div>
          </div>
        )}
      </div>

      {/* Screen 0: Welcome / Landing */}
      {screen === 'welcome' && (
        <div className="flex-1 flex flex-col justify-center items-center px-5 py-3 overflow-y-auto text-center">
          <div className="w-20 h-20 mb-3 rounded-2xl bg-black border border-white/20 p-2 shadow-2xl flex items-center justify-center">
            <img
              src={APP_LOGO_URL}
              alt="Pulse Logo"
              className="w-full h-full object-contain rounded-xl"
              decoding="async"
            />
          </div>
          <div className="max-w-[280px] mx-auto mb-4">
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9.5px] font-semibold bg-[#ffbd1a]/15 text-[#ffbd1a] border border-[#ffbd1a]/30 mb-2">
              <Sparkles className="w-2.5 h-2.5" /> 100% Real Community
            </div>
            <h1 className="text-lg font-black tracking-tight mb-1 text-white">
              Real creators. Real videos.
            </h1>
            <p className="text-neutral-400 text-[10.5px] leading-relaxed">
              Every account is verified by email link to ensure authentic creators, verified interactions, and zero spam.
            </p>
          </div>

          <div className="w-full max-w-[240px] mx-auto flex flex-col gap-1.5">
            <button
              id="goSignup"
              onClick={() => {
                setErrorMessage('');
                setIsEmailAlreadyInUse(false);
                setUnverifiedEmail(null);
                setScreen('step1_email');
              }}
              className="w-full py-1.5 px-3 bg-white hover:bg-[#dedee2] text-black font-bold rounded-full shadow-sm transition-all active:scale-95 cursor-pointer text-xs flex items-center justify-center gap-1.5"
            >
              <span>Create Verified Account</span>
              <ArrowRight className="w-3 h-3" />
            </button>
            <button
              id="goLogin"
              onClick={() => {
                setErrorMessage('');
                setIsEmailAlreadyInUse(false);
                setUnverifiedEmail(null);
                setScreen('login');
              }}
              className="w-full py-1.5 px-3 bg-transparent hover:bg-white/[0.06] text-white font-bold rounded-full border border-white/25 transition-all active:scale-95 cursor-pointer text-xs"
            >
              Log in with Email
            </button>

            <div className="my-0.5 flex items-center gap-2">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-[8.5px] text-neutral-500 uppercase tracking-wider font-semibold">Or continue with</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>

            <button
              id="welcomeGoogleBtn"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full py-1.5 px-3 bg-transparent hover:bg-white/[0.06] text-white border border-white/25 font-semibold rounded-full flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50 text-xs active:scale-95"
            >
              <svg viewBox="0 0 48 48" width="12" height="12">
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
        <div className="flex-1 flex flex-col justify-center items-center px-5 py-3 overflow-y-auto w-full max-w-[290px] mx-auto">
          <div className="mb-3 text-center w-full">
            <div className="inline-flex items-center gap-1 text-[9px] font-bold text-[#ffbd1a] uppercase tracking-wider mb-0.5">
              Step 1 of 4
            </div>
            <h2 className="text-sm font-extrabold text-white">What's your email?</h2>
            <p className="text-neutral-400 text-[10px] mt-0.5 leading-snug">
              We'll send a secure activation link to verify your identity.
            </p>
          </div>

          <form onSubmit={handleStep1Submit} className="flex flex-col gap-2 w-full">
            <div>
              <label className="block text-[9.5px] font-semibold text-neutral-400 mb-1">Email Address</label>
              <div className="relative">
                <input
                  id="regEmailInput"
                  type="email"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="name@example.com"
                  autoFocus
                  required
                  className="w-full bg-neutral-900 border border-white/10 rounded-lg px-2.5 py-1.5 pl-7 text-white placeholder:text-neutral-600 focus:outline-none focus:border-[#ffbd1a] transition-colors text-xs"
                />
                <Mail className="w-3 h-3 text-neutral-500 absolute left-2 top-2" />
              </div>
            </div>

            {errorMessage && (
              <div className="text-[#ff2b54] text-[10px] font-medium bg-[#ff2b54]/10 p-1.5 rounded-lg border border-[#ff2b54]/20 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <button
              id="step1SubmitBtn"
              type="submit"
              className="mt-0.5 w-full py-1.5 px-3 bg-white hover:bg-[#dedee2] text-black font-bold rounded-full transition-all shadow-sm cursor-pointer flex items-center justify-center gap-1 text-xs active:scale-95"
            >
              <span>Next: Set Password</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </form>

          <p className="mt-2.5 text-center text-[10px] text-neutral-400">
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
        <div className="flex-1 flex flex-col justify-center items-center px-5 py-3 overflow-y-auto w-full max-w-[290px] mx-auto">
          <div className="mb-3 text-center w-full">
            <div className="inline-flex items-center gap-1 text-[9px] font-bold text-[#ffbd1a] uppercase tracking-wider mb-0.5">
              Step 2 of 4
            </div>
            <h2 className="text-sm font-extrabold text-white">Create a Password</h2>
            <div className="flex items-center justify-center gap-1.5 mt-0.5">
              <span className="text-neutral-400 text-[10px] truncate max-w-[160px]">{regEmail}</span>
              <button
                type="button"
                onClick={() => setScreen('step1_email')}
                className="text-[9.5px] text-[#ffbd1a] hover:underline cursor-pointer font-semibold"
              >
                Change
              </button>
            </div>
          </div>

          <form onSubmit={handleStep2Submit} className="flex flex-col gap-2 w-full">
            <div className="relative">
              <label className="block text-[9.5px] font-semibold text-neutral-400 mb-1">Password (6+ chars)</label>
              <div className="relative">
                <input
                  id="regPasswordInput"
                  type={showRegPassword ? 'text' : 'password'}
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="••••••••"
                  autoFocus
                  required
                  className="w-full bg-neutral-900 border border-white/10 rounded-lg px-2.5 py-1.5 pl-7 pr-7 text-white placeholder:text-neutral-600 focus:outline-none focus:border-[#ffbd1a] transition-colors text-xs"
                />
                <Lock className="w-3 h-3 text-neutral-500 absolute left-2 top-2" />
                <button
                  type="button"
                  onClick={() => setShowRegPassword(!showRegPassword)}
                  className="absolute right-2 top-2 text-neutral-400 hover:text-white cursor-pointer"
                >
                  {showRegPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                </button>
              </div>
            </div>

            <div className="relative">
              <label className="block text-[9.5px] font-semibold text-neutral-400 mb-1">Confirm Password</label>
              <div className="relative">
                <input
                  id="regConfirmPasswordInput"
                  type={showRegConfirmPassword ? 'text' : 'password'}
                  value={regConfirmPassword}
                  onChange={(e) => setRegConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-neutral-900 border border-white/10 rounded-lg px-2.5 py-1.5 pl-7 pr-7 text-white placeholder:text-neutral-600 focus:outline-none focus:border-[#ffbd1a] transition-colors text-xs"
                />
                <ShieldCheck className="w-3 h-3 text-neutral-500 absolute left-2 top-2" />
                <button
                  type="button"
                  onClick={() => setShowRegConfirmPassword(!showRegConfirmPassword)}
                  className="absolute right-2 top-2 text-neutral-400 hover:text-white cursor-pointer"
                >
                  {showRegConfirmPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                </button>
              </div>
            </div>

            {errorMessage && (
              <div className="text-[#ff2b54] text-[10px] font-medium bg-[#ff2b54]/10 p-1.5 rounded-lg border border-[#ff2b54]/20 space-y-1">
                <div className="flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
                {isEmailAlreadyInUse && (
                  <button
                    type="button"
                    onClick={() => {
                      setLiEmail(regEmail);
                      setScreen('login');
                    }}
                    className="w-full mt-0.5 py-1 bg-[#ffbd1a] text-black font-extrabold rounded-md text-[9.5px] hover:bg-[#ffc93f] transition-colors cursor-pointer"
                  >
                    👉 Click here to Log In
                  </button>
                )}
              </div>
            )}

            <button
              id="step2SubmitBtn"
              type="submit"
              disabled={loading}
              className="mt-0.5 w-full py-1.5 px-3 bg-white hover:bg-[#dedee2] text-black font-bold rounded-full transition-all shadow-sm cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1 text-xs active:scale-95"
            >
              {loading ? (
                <div className="w-3 h-3 border-2 border-black border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>Create Account & Send Link</span>
                  <ArrowRight className="w-3 h-3" />
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* STEP 3: Verify Email Link Gate */}
      {screen === 'step3_verify' && (
        <div className="flex-1 flex flex-col justify-center items-center px-5 py-3 overflow-y-auto w-full max-w-[290px] mx-auto">
          <div className="text-center mb-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#ffbd1a]/15 text-[#ffbd1a] flex items-center justify-center mx-auto mb-1.5 border border-[#ffbd1a]/30 shadow animate-pulse">
              <Mail className="w-4 h-4" />
            </div>
            <div className="inline-flex items-center gap-1 text-[9px] font-bold text-[#ffbd1a] uppercase tracking-wider mb-0.5">
              Step 3 of 4: Verify Email Link
            </div>
            <h2 className="text-sm font-extrabold text-white">Check Your Inbox</h2>
            <p className="text-neutral-300 text-[10px] mt-0.5">
              We sent a verification link to:
            </p>
            <div className="inline-block mt-1 px-2 py-0.5 bg-neutral-900 border border-white/10 rounded-md text-[10px] font-mono text-[#ffbd1a] truncate max-w-[220px]">
              {regEmail || liEmail}
            </div>
          </div>

          <div className="bg-neutral-900 border border-white/10 rounded-lg p-2 mb-2.5 text-[10px] text-neutral-300 space-y-1 w-full">
            <div className="flex items-start gap-1.5">
              <div className="w-3 h-3 rounded-md bg-[#ffbd1a]/20 text-[#ffbd1a] flex items-center justify-center text-[8px] font-black shrink-0 mt-0.5">
                1
              </div>
              <span>Open your email app and find the link from Pulse.</span>
            </div>
            <div className="flex items-start gap-1.5">
              <div className="w-3 h-3 rounded-md bg-[#ffbd1a]/20 text-[#ffbd1a] flex items-center justify-center text-[8px] font-black shrink-0 mt-0.5">
                2
              </div>
              <span>Click the verification link to confirm your account.</span>
            </div>
            <div className="flex items-start gap-1.5">
              <div className="w-3 h-3 rounded-md bg-[#ffbd1a]/20 text-[#ffbd1a] flex items-center justify-center text-[8px] font-black shrink-0 mt-0.5">
                3
              </div>
              <span>Return here to choose your username!</span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 w-full">
            <button
              id="checkVerifiedBtn"
              onClick={handleCheckEmailVerified}
              disabled={loading}
              className="w-full py-1.5 px-3 bg-[#ffbd1a] hover:bg-[#ffc93f] text-black font-bold rounded-lg shadow-sm transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1 text-xs"
            >
              {loading ? (
                <div className="w-3 h-3 border-2 border-black border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <RefreshCw className="w-3 h-3" />
                  <span>I've Verified — Continue</span>
                </>
              )}
            </button>

            <button
              id="resendVerificationBtn"
              onClick={handleResendVerification}
              disabled={loading || resendCooldown > 0}
              className="w-full py-1.5 px-3 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 font-semibold rounded-lg border border-white/10 transition-all text-[10px] cursor-pointer disabled:opacity-40"
            >
              {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend link'}
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: Choose Display Name & Username (Only accessible after verification) */}
      {screen === 'step4_name' && (
        <div className="flex-1 flex flex-col justify-center items-center px-5 py-3 overflow-y-auto w-full max-w-[290px] mx-auto">
          <div className="mb-2.5 text-center w-full">
            <div className="inline-flex items-center gap-1 text-[9px] font-bold text-[#ffbd1a] uppercase tracking-wider mb-0.5">
              <Check className="w-2.5 h-2.5 text-[#ffbd1a]" /> Email Verified! Step 4 of 4
            </div>
            <h2 className="text-sm font-extrabold text-white">Choose Your Name</h2>
            <p className="text-neutral-400 text-[10px] mt-0.5">
              Set up your public identity on Pulse.
            </p>
          </div>

          <form onSubmit={handleStep4Submit} className="flex flex-col gap-2 w-full">
            {/* Avatar Picker */}
            <div>
              <label className="block text-[9.5px] font-semibold text-neutral-400 mb-1">Profile Picture</label>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none justify-center">
                <label className="w-7 h-7 rounded-lg bg-neutral-900 border border-dashed border-[#ffbd1a]/60 flex flex-col items-center justify-center text-neutral-300 hover:text-white shrink-0 cursor-pointer overflow-hidden transition-all hover:border-[#ffbd1a]">
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
                  <Camera className="w-2.5 h-2.5 text-[#ffbd1a]" />
                </label>

                {avatarOptions.map((url, idx) => (
                  <div
                    key={idx}
                    onClick={() => setSelectedAvatarUrl(url)}
                    className={`w-7 h-7 rounded-lg overflow-hidden shrink-0 border cursor-pointer transition-all ${
                      selectedAvatarUrl === url ? 'border-[#ffbd1a] scale-105 shadow ring-1 ring-[#ffbd1a]/30' : 'border-white/10 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img src={url} alt="Avatar option" className="w-full h-full object-cover bg-neutral-800" />
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setAvatarSeed(Math.random().toString(36).substring(7))}
                  className="w-6 h-6 rounded-lg bg-neutral-900 border border-white/10 flex items-center justify-center text-[10px] text-neutral-400 hover:text-white shrink-0 cursor-pointer"
                  title="Generate more avatars"
                >
                  <RefreshCw className="w-2.5 h-2.5" />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[9.5px] font-semibold text-neutral-400 mb-1">Display Name</label>
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
                  className="w-full bg-neutral-900 border border-white/10 rounded-lg px-2.5 py-1.5 pl-7 text-white placeholder:text-neutral-600 focus:outline-none focus:border-[#ffbd1a] transition-colors text-xs"
                />
                <User className="w-3 h-3 text-neutral-500 absolute left-2 top-2" />
              </div>
            </div>

            <div>
              <label className="block text-[9.5px] font-semibold text-neutral-400 mb-1">Username Handle</label>
              <div className="relative">
                <input
                  id="customHandleInput"
                  type="text"
                  value={customHandle}
                  onChange={(e) => {
                    let val = e.target.value;
                    if (!val.startsWith('@')) val = '@' + val;
                    setCustomHandle(val.toLowerCase());
                  }}
                  placeholder="@alex_rivera"
                  required
                  className="w-full bg-neutral-900 border border-white/10 rounded-lg px-2.5 py-1.5 pl-7 text-white placeholder:text-neutral-600 focus:outline-none focus:border-[#ffbd1a] transition-colors text-xs"
                />
                <AtSign className="w-3 h-3 text-neutral-500 absolute left-2 top-2" />
              </div>
            </div>

            <div>
              <label className="block text-[9.5px] font-semibold text-neutral-400 mb-1">Bio (Optional)</label>
              <input
                id="customBioInput"
                type="text"
                value={customBio}
                onChange={(e) => setCustomBio(e.target.value)}
                placeholder="Video creator & storyteller ⚡️"
                maxLength={100}
                className="w-full bg-neutral-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-white placeholder:text-neutral-600 focus:outline-none focus:border-[#ffbd1a] transition-colors text-xs"
              />
            </div>

            {errorMessage && (
              <div className="text-[#ff2b54] text-[10px] font-medium bg-[#ff2b54]/10 p-1.5 rounded-lg border border-[#ff2b54]/20 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <button
              id="step4SubmitBtn"
              type="submit"
              disabled={loading}
              className="mt-0.5 w-full py-1.5 px-3 bg-[#ffbd1a] hover:bg-[#ffc93f] text-black font-bold rounded-lg shadow-sm transition-all active:scale-95 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1 text-xs"
            >
              {loading ? (
                <div className="w-3 h-3 border-2 border-black border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>Enter Pulse</span>
                  <Sparkles className="w-3 h-3" />
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* Screen: Log In Form */}
      {screen === 'login' && (
        <div className="flex-1 flex flex-col justify-center items-center px-5 py-3 overflow-y-auto w-full max-w-[290px] mx-auto">
          <div className="mb-3 text-center w-full">
            <h2 className="text-sm font-extrabold text-white">Welcome Back</h2>
            <p className="text-neutral-400 text-[10px] mt-0.5">Log in with your email and password</p>
          </div>

          <form onSubmit={handleLogIn} className="flex flex-col gap-2 w-full">
            <div>
              <label className="block text-[9.5px] font-semibold text-neutral-400 mb-1">Email</label>
              <input
                id="liEmail"
                type="email"
                value={liEmail}
                onChange={(e) => setLiEmail(e.target.value)}
                placeholder="you@domain.com"
                required
                className="w-full bg-neutral-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-white placeholder:text-neutral-600 focus:outline-none focus:border-[#ffbd1a] transition-colors text-xs"
              />
            </div>

            <div className="relative">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[9.5px] font-semibold text-neutral-400">Password</label>
                <button
                  id="openForgot"
                  type="button"
                  onClick={() => {
                    setForgotEmail(liEmail);
                    setScreen('forgot');
                  }}
                  className="text-[9.5px] text-[#ffbd1a] hover:underline cursor-pointer font-semibold"
                >
                  Forgot?
                </button>
              </div>
              <div className="relative">
                <input
                  id="liPassword"
                  type={showLiPassword ? 'text' : 'password'}
                  value={liPassword}
                  onChange={(e) => setLiPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-neutral-900 border border-white/10 rounded-lg px-2.5 py-1.5 pr-7 text-white placeholder:text-neutral-600 focus:outline-none focus:border-[#ffbd1a] transition-colors text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowLiPassword(!showLiPassword)}
                  className="absolute right-2 top-2 text-neutral-400 hover:text-white cursor-pointer"
                >
                  {showLiPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                </button>
              </div>
            </div>

            {errorMessage && (
              <div id="liError" className="text-[#ff2b54] text-[10px] font-medium bg-[#ff2b54]/10 p-1.5 rounded-lg border border-[#ff2b54]/20 space-y-1">
                <div className="flex items-start gap-1">
                  <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              </div>
            )}

            <button
              id="liSubmit"
              type="submit"
              disabled={loading}
              className="mt-0.5 w-full py-1.5 px-3 bg-white hover:bg-[#dedee2] text-black font-bold rounded-full transition-all shadow-sm cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1 text-xs active:scale-95"
            >
              {loading ? (
                <div className="w-3 h-3 border-2 border-black border-t-transparent rounded-full animate-spin" />
              ) : (
                'Log in'
              )}
            </button>
          </form>

          <div className="my-1.5 flex items-center gap-2 w-full max-w-[240px]">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-[8.5px] text-neutral-500 font-semibold uppercase tracking-wider">Or</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          <button
            id="liGoogle"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full max-w-[240px] py-1.5 px-3 bg-transparent hover:bg-white/[0.06] text-white border border-white/25 font-semibold rounded-full flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50 text-xs active:scale-95"
          >
            <svg viewBox="0 0 48 48" width="12" height="12">
              <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l6-6C34 5.1 29.3 3 24 3 12.4 3 3 12.4 3 3 24s9.4 21 21 21 21-9.4 21-21c0-1.4-.1-2.5-.4-3.5z"/>
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.6 18.9 13 24 13c3.1 0 5.8 1.1 8 3l6-6C34 5.1 29.3 3 24 3 16.3 3 9.6 7.3 6.3 14.7z"/>
              <path fill="#4CAF50" d="M24 45c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.4-4.5 2.3-7.2 2.3-5.3 0-9.7-3.4-11.3-8.1l-6.5 5C9.5 40.5 16.2 45 24 45z"/>
              <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.2 5.2C40.9 35.9 45 30.5 45 24c0-1.4-.1-2.5-1.4-3.5z"/>
            </svg>
            <span>Continue with Google</span>
          </button>

          <p className="mt-2.5 text-center text-[10px] text-neutral-400">
            Need an account?{' '}
            <span
              onClick={() => {
                setErrorMessage('');
                setScreen('step1_email');
              }}
              className="text-[#ffbd1a] font-bold cursor-pointer hover:underline"
            >
              Sign up
            </span>
          </p>
        </div>
      )}

      {/* Screen: Forgot Password Request */}
      {screen === 'forgot' && (
        <div className="flex-1 flex flex-col justify-center items-center px-5 py-3 overflow-y-auto w-full max-w-[290px] mx-auto">
          <div className="mb-3 text-center w-full">
            <h2 className="text-sm font-extrabold text-white">Reset Password</h2>
            <p className="text-neutral-400 text-[10px] mt-0.5">Enter your email and we'll send a password reset link</p>
          </div>

          <form onSubmit={handleSendResetPassword} className="flex flex-col gap-2 w-full">
            <div>
              <label className="block text-[9.5px] font-semibold text-neutral-400 mb-1">Email Address</label>
              <input
                id="forgotEmail"
                type="email"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                placeholder="you@domain.com"
                required
                className="w-full bg-neutral-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-white placeholder:text-neutral-600 focus:outline-none focus:border-[#ffbd1a] transition-colors text-xs"
              />
            </div>

            <button
              id="sendResetBtn"
              type="submit"
              disabled={loading}
              className="mt-0.5 w-full py-1.5 px-3 bg-white hover:bg-[#dedee2] text-black font-bold rounded-full transition-all shadow-sm cursor-pointer disabled:opacity-50 text-xs active:scale-95"
            >
              {loading ? 'Sending link...' : 'Send Reset Link'}
            </button>
          </form>

          <p className="mt-2.5 text-center text-[10px] text-neutral-400">
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
        <div className="flex-1 flex flex-col justify-center items-center px-5 py-3 overflow-y-auto w-full max-w-[290px] mx-auto">
          <div className="mb-3 text-center w-full">
            <h2 className="text-sm font-extrabold text-white">Set New Password</h2>
            <p className="text-neutral-400 text-[10px] mt-0.5">
              Enter your new password for {resetEmailAccount || 'your account'}
            </p>
          </div>

          <form onSubmit={handleConfirmResetWithCode} className="flex flex-col gap-2 w-full">
            <div className="relative">
              <label className="block text-[9.5px] font-semibold text-neutral-400 mb-1">New Password (6+ characters)</label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-neutral-900 border border-white/10 rounded-lg px-2.5 py-1.5 pr-7 text-white placeholder:text-neutral-600 focus:outline-none focus:border-[#ffbd1a] transition-colors text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-2 top-2 text-neutral-400 hover:text-white cursor-pointer"
                >
                  {showNewPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                </button>
              </div>
            </div>

            {errorMessage && (
              <div className="text-[#ff2b54] text-[10px] font-medium bg-[#ff2b54]/10 p-1.5 rounded-lg border border-[#ff2b54]/20 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-0.5 w-full py-1.5 px-3 bg-[#ffbd1a] hover:bg-[#ffc93f] text-black font-bold rounded-lg transition-all shadow-sm cursor-pointer disabled:opacity-50 text-xs active:scale-95"
            >
              {loading ? 'Saving new password...' : 'Save Password & Log in'}
            </button>
          </form>
        </div>
      )}

      {/* Footer info */}
      <div className="px-5 pb-4 text-center text-[9px] text-neutral-500">
        Secured by Firebase Authentication & Firestore Cloud Database.
      </div>
    </div>
  );
};
