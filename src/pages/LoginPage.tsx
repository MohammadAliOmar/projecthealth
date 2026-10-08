import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  Lock,
  Mail,
  KeyRound,
  ShieldAlert,
  AlertCircle,
  Eye,
  EyeOff,
  LogIn,
  RotateCcw,
  Sparkles
} from 'lucide-react';
import { login } from '../services/api';
import { useToast } from '../hooks/useToast';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();
  const { success, error } = useToast();

  // Prototype-level client-side lockout control stored in localStorage as specified in requirements
  const [failedAttempts, setFailedAttempts] = useState<number>(() => {
    const saved = localStorage.getItem('auth_failed_attempts');
    return saved ? parseInt(saved, 10) : 0;
  });

  const [lockoutUntil, setLockoutUntil] = useState<number | null>(() => {
    const saved = localStorage.getItem('auth_lockout_until');
    return saved ? parseInt(saved, 10) : null;
  });

  const [remainingTime, setRemainingTime] = useState<string>('');

  // Lockout countdown timer
  useEffect(() => {
    if (!lockoutUntil) return;

    const interval = setInterval(() => {
      const diff = lockoutUntil - Date.now();
      if (diff <= 0) {
        setLockoutUntil(null);
        setFailedAttempts(0);
        localStorage.removeItem('auth_lockout_until');
        localStorage.removeItem('auth_failed_attempts');
        clearInterval(interval);
      } else {
        const mins = Math.floor(diff / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        setRemainingTime(`${mins}:${secs < 10 ? '0' : ''}${secs}`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [lockoutUntil]);

  const validateEmail = (val: string) => {
    setEmail(val);
    if (!val) {
      setEmailError('Email address is required.');
    } else if (!EMAIL_REGEX.test(val.trim())) {
      setEmailError('Please enter a valid academic email address.');
    } else {
      setEmailError(null);
    }
  };

  const handleFillDemo = () => {
    setEmail('demo.lecturer@university.edu.au');
    setPassword('Demo@12345');
    setEmailError(null);
    setErrorMessage(null);
  };

  const handleResetLockout = () => {
    setFailedAttempts(0);
    setLockoutUntil(null);
    localStorage.removeItem('auth_lockout_until');
    localStorage.removeItem('auth_failed_attempts');
    setErrorMessage(null);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // 1. Check client-side lockout status
    if (lockoutUntil && Date.now() < lockoutUntil) {
      setErrorMessage(`Authentication Locked: Please wait ${remainingTime} before retrying.`);
      return;
    }

    // 2. Validate email format
    if (!EMAIL_REGEX.test(email.trim())) {
      setEmailError('Please enter a valid email format (e.g. lecturer@university.edu.au).');
      return;
    }

    setIsLoading(true);

    try {
      await login(email, password);
      // Reset lockout counter on success
      setFailedAttempts(0);
      localStorage.removeItem('auth_failed_attempts');
      localStorage.removeItem('auth_lockout_until');

      success('Welcome Back', `Authenticated as university capstone lecturer.`);
      navigate('/');
    } catch (err: any) {
      const newAttempts = failedAttempts + 1;
      setFailedAttempts(newAttempts);
      localStorage.setItem('auth_failed_attempts', newAttempts.toString());

      if (newAttempts >= MAX_FAILED_ATTEMPTS) {
        const lockTime = Date.now() + LOCKOUT_MINUTES * 60 * 1000;
        setLockoutUntil(lockTime);
        localStorage.setItem('auth_lockout_until', lockTime.toString());
        setErrorMessage(
          `Security Lockout: Account temporarily locked for 15 minutes due to 5 consecutive failed login attempts.`
        );
      } else {
        const remaining = MAX_FAILED_ATTEMPTS - newAttempts;
        const msg = err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found'
          ? `Invalid credentials. (${remaining} attempt${remaining === 1 ? '' : 's'} remaining before lockout). If testing, click the Demo Access button below.`
          : err.message || 'Authentication error. Please check your network and credentials.';
        setErrorMessage(msg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const isLocked = lockoutUntil !== null && Date.now() < lockoutUntil;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative selection:bg-indigo-100 selection:text-indigo-900">
      {/* Background Subtle Gradient Accents */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 text-white mb-3 shadow-md shadow-indigo-600/30">
            <Activity className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            ProjectHealth <span className="text-indigo-600">AI</span>
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500">
            University IT Capstone Student Group Early Warning System
          </p>
        </div>

        <div className="mt-6 bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 shadow-xl">
          {/* Demo Access Hint Card */}
          <div className="mb-5 p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-200/80 text-xs flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="font-semibold text-indigo-950 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                <span>Capstone Demo Access Credentials:</span>
              </div>
              <div className="font-mono text-[11px] text-slate-700">
                demo.lecturer@university.edu.au / Demo@12345
              </div>
            </div>
            <button
              type="button"
              onClick={handleFillDemo}
              className="shrink-0 px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 transition-colors cursor-pointer shadow-2xs"
            >
              Quick Fill
            </button>
          </div>

          {/* Lockout Warning Banner */}
          {isLocked ? (
            <div className="mb-5 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold text-rose-800">
                <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Authentication Form Locked (15 Minutes)</span>
              </div>
              <p className="text-[11px] text-rose-700 leading-relaxed">
                Maximum 5 consecutive failed login attempts exceeded. Lockout expires in: <strong className="font-mono">{remainingTime}</strong>.
              </p>
              <button
                type="button"
                onClick={handleResetLockout}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 hover:text-rose-900 underline cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" /> Reset Prototype Lockout
              </button>
            </div>
          ) : errorMessage ? (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <p className="leading-relaxed text-[11px]">{errorMessage}</p>
            </div>
          ) : null}

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="lecturer-email" className="block text-xs font-semibold text-slate-700 mb-1">
                Lecturer Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="lecturer-email"
                  type="email"
                  required
                  disabled={isLocked || isLoading}
                  value={email}
                  onChange={(e) => validateEmail(e.target.value)}
                  placeholder="name@university.edu.au"
                  className={`w-full pl-9 pr-3 py-2 bg-white border rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all ${
                    emailError ? 'border-rose-400 focus:border-rose-400' : 'border-slate-300 focus:border-indigo-500'
                  }`}
                />
              </div>
              {emailError && (
                <p className="mt-1 text-[11px] text-rose-600 font-medium">{emailError}</p>
              )}
            </div>

            <div>
              <label htmlFor="lecturer-password" className="block text-xs font-semibold text-slate-700 mb-1">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  id="lecturer-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  disabled={isLocked || isLoading}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-9 pr-10 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLocked || isLoading}
              className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 transition-all shadow-md shadow-indigo-600/20 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Authenticating Session...</span>
                </>
              ) : isLocked ? (
                <span>Form Locked ({remainingTime})</span>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Sign In as Lecturer</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-slate-100 text-center text-[11px] text-slate-400">
            Protected by Firebase Authentication &amp; Firestore Security Rules.
          </div>
        </div>

        <div className="mt-6 text-center text-xs text-slate-500">
          Faculty of Information Technology • Software Engineering Capstone
        </div>
      </div>
    </div>
  );
};
