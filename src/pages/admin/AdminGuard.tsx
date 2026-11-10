import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { useAdmin } from './AdminContext';
import {
  ShieldAlert,
  ArrowLeft,
  Loader2,
  Lock,
  Eye,
  EyeOff,
  KeyRound,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Sun,
  Moon,
  LifeBuoy,
} from 'lucide-react';

export const AdminGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAdmin, loading, isElevated, elevateAdminSession, adminTheme, toggleAdminTheme } = useAdmin();
  const [, navigate] = useLocation();

  const isDark = adminTheme === 'dark';

  // Multi-step challenge state
  const [step, setStep] = useState<'password' | 'totp'>('password');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [tempChallengeToken, setTempChallengeToken] = useState('');
  const [totpDigits, setTotpDigits] = useState<string[]>(['', '', '', '', '', '']);

  // Status & error handling
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);
  const [lockoutSeconds, setLockoutSeconds] = useState<number | null>(null);

  // Rescue code modal state
  const [showRescueModal, setShowRescueModal] = useState(false);
  const [rescueCodeInput, setRescueCodeInput] = useState('');

  // TOTP Countdown timer (30s window)
  const [secondsRemaining, setSecondsRemaining] = useState(30 - (Math.floor(Date.now() / 1000) % 30));

  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsRemaining(30 - (Math.floor(Date.now() / 1000) % 30));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Lockout countdown
  useEffect(() => {
    if (!lockoutSeconds || lockoutSeconds <= 0) return;
    const interval = setInterval(() => {
      setLockoutSeconds((prev) => (prev && prev > 1 ? prev - 1 : null));
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutSeconds]);

  // Handle Password Submit
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    if (!password.trim()) {
      setErrorMessage('Master administrator password is required.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch('/api/admin/auth/verify-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.lockoutSeconds) {
          setLockoutSeconds(data.lockoutSeconds);
        }
        if (data.remainingAttempts !== undefined) {
          setRemainingAttempts(data.remainingAttempts);
        }
        throw new Error(data.message || data.error || 'Password verification failed.');
      }

      // Password accepted! Transition to Google Authenticator Step
      setTempChallengeToken(data.tempChallengeToken);
      setStep('totp');
      setErrorMessage('');
      setTimeout(() => {
        otpInputRefs.current[0]?.focus();
      }, 150);
    } catch (err: any) {
      setErrorMessage(err.message || 'Administrative verification error.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle TOTP input changes
  const handleOtpChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const updated = [...totpDigits];
    updated[index] = digit;
    setTotpDigits(updated);

    if (digit && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }

    // Auto verify if all 6 digits entered
    if (digit && index === 5 && updated.every((d) => d !== '')) {
      verifyTotpCode(updated.join(''));
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !totpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;

    const updated = [...totpDigits];
    for (let i = 0; i < pasted.length; i++) {
      updated[i] = pasted[i];
    }
    setTotpDigits(updated);

    if (pasted.length === 6) {
      otpInputRefs.current[5]?.focus();
      verifyTotpCode(pasted);
    } else {
      otpInputRefs.current[pasted.length]?.focus();
    }
  };

  const verifyTotpCode = async (codeToVerify?: string) => {
    const code = codeToVerify || totpDigits.join('');
    if (code.length !== 6) {
      setErrorMessage('Please enter the full 6-digit Google Authenticator code.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage('');
      const res = await fetch('/api/admin/auth/verify-totp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          tempChallengeToken,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Invalid 2FA authentication code.');
      }

      // Elevation granted!
      elevateAdminSession(data.token);
    } catch (err: any) {
      setErrorMessage(err.message || 'Google Authenticator verification failed.');
      setTotpDigits(['', '', '', '', '', '']);
      otpInputRefs.current[0]?.focus();
    } finally {
      setSubmitting(false);
    }
  };

  const handleRescueSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rescueCodeInput.trim()) return;

    try {
      setSubmitting(true);
      setErrorMessage('');
      const res = await fetch('/api/admin/auth/verify-totp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: rescueCodeInput.trim(),
          tempChallengeToken,
          rescueCode: rescueCodeInput.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Invalid rescue code.');
      }
      setShowRescueModal(false);
      elevateAdminSession(data.token);
    } catch (err: any) {
      setErrorMessage(err.message || 'Emergency rescue failed.');
    } finally {
      setSubmitting(false);
    }
  };

  // Full-Screen Loading Screen
  if (loading) {
    return (
      <div className={`min-h-screen w-full flex flex-col items-center justify-center transition-colors ${isDark ? 'bg-[#0B0E14] text-white' : 'bg-slate-50 text-slate-900'}`}>
        <div className="flex flex-col items-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-[#F0B90B]/10 border border-[#F0B90B]/30 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-[#F0B90B] animate-spin" />
          </div>
          <div className="text-center">
            <h2 className="text-xl font-bold tracking-tight">Vexa Institutional Core</h2>
            <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
              Authenticating administrative session & privileges...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Full-Screen 403 Forbidden Screen
  if (!isAdmin) {
    return (
      <div className={`min-h-screen w-full flex flex-col justify-between transition-colors ${isDark ? 'bg-[#0B0E14] text-white' : 'bg-slate-50 text-slate-900'}`}>
        <header className={`h-16 px-6 sm:px-10 border-b flex items-center justify-between ${isDark ? 'border-gray-800 bg-[#0B0E14]' : 'border-slate-200 bg-white shadow-xs'}`}>
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-xl bg-[#181A20] border border-[#F0B90B]/30 flex items-center justify-center p-1 shadow-md shrink-0">
              <img src="/assets/aistudio/fe78fa28-9eb7-49b5-a568-6e1afbae67cb_ac4d9ede.png" alt="Vexa" className="w-full h-full object-contain" />
            </div>
            <span className="font-bold text-sm tracking-tight">VEXA INSTITUTIONAL</span>
          </div>
          <button
            onClick={() => navigate('/settings')}
            className={`py-2 px-4 rounded-xl text-xs font-semibold border flex items-center space-x-1.5 transition-colors ${
              isDark
                ? 'border-gray-700 bg-gray-800/60 hover:bg-gray-800 text-gray-200'
                : 'border-slate-300 bg-white hover:bg-slate-100 text-slate-700 shadow-xs'
            }`}
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to User App</span>
          </button>
        </header>

        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-lg text-center space-y-6">
            <div className="w-20 h-20 bg-red-500/10 border border-red-500/30 rounded-3xl flex items-center justify-center mx-auto text-red-500">
              <ShieldAlert className="w-10 h-10" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Access Denied (403 Forbidden)</h1>
              <p className={`text-sm mt-2 max-w-md mx-auto leading-relaxed ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>
                Your user profile does not possess authorized administrator privileges for the Vexa Institutional Terminal.
              </p>
            </div>

            <div className={`p-4 rounded-2xl border text-xs font-mono text-left max-w-md mx-auto ${isDark ? 'bg-[#12151D] border-gray-800 text-gray-400' : 'bg-white border-slate-200 text-slate-600'}`}>
              <div>Security Incident: ERR_UNAUTHORIZED_ADMIN_ENTRY</div>
              <div>Audit Timestamp: {new Date().toISOString()}</div>
              <div>Security State: Encrypted Logging Active</div>
            </div>

            <div className="pt-2 max-w-md mx-auto">
              <button
                onClick={() => navigate('/settings')}
                className="w-full py-4 px-6 bg-[#F0B90B] hover:bg-[#d9a606] text-black font-bold rounded-2xl text-sm transition-colors flex items-center justify-center space-x-2 shadow-md"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Return to User Dashboard</span>
              </button>
            </div>
          </div>
        </div>

        <footer className={`py-4 border-t text-center text-xs font-mono opacity-50 ${isDark ? 'border-gray-800 text-gray-500' : 'border-slate-200 text-slate-400'}`}>
          Vexa Institutional Security Perimeter · Unauthorized Access Prohibited
        </footer>
      </div>
    );
  }

  // Full-Screen Authentication Gate (Step 1: Password or Step 2: Google Authenticator)
  // Clean, expansive full-screen interface without card enclosures
  if (!isElevated) {
    return (
      <div className={`min-h-screen w-full flex flex-col justify-between transition-colors ${isDark ? 'bg-[#0B0E14] text-white' : 'bg-slate-50 text-slate-900'}`}>
        {/* Top Header Bar across full screen */}
        <header
          className={`h-16 px-4 sm:px-8 lg:px-12 border-b flex items-center justify-between sticky top-0 z-40 backdrop-blur-md ${
            isDark ? 'bg-[#0B0E14]/90 border-gray-800' : 'bg-white/95 border-slate-200 shadow-xs'
          }`}
        >
          {/* Brand Mark */}
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-xl bg-[#181A20] border border-[#F0B90B]/30 flex items-center justify-center p-1 shadow-md shrink-0">
              <img src="/assets/aistudio/fe78fa28-9eb7-49b5-a568-6e1afbae67cb_ac4d9ede.png" alt="Vexa" className="w-full h-full object-contain" />
            </div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-sm tracking-tight">VEXA</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#F0B90B] text-black font-extrabold uppercase">
                Institutional
              </span>
            </div>
            <span className={`hidden md:inline-block text-xs font-mono pl-3 border-l ${isDark ? 'border-gray-800 text-gray-400' : 'border-slate-300 text-slate-500'}`}>
              High-Assurance Administrative Terminal
            </span>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center space-x-3">
            {/* Theme Toggle Button */}
            <button
              onClick={toggleAdminTheme}
              className={`py-1.5 px-3.5 rounded-xl border text-xs font-medium flex items-center space-x-2 transition-colors ${
                isDark
                  ? 'bg-gray-800/80 border-gray-700 text-gray-200 hover:text-white hover:bg-gray-700'
                  : 'bg-white border-slate-300 text-slate-700 hover:text-black hover:bg-slate-100 shadow-xs'
              }`}
              title="Toggle Light / Dark mode"
            >
              {isDark ? (
                <>
                  <Sun className="w-4 h-4 text-amber-400" />
                  <span className="hidden sm:inline">Lite Mode</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-slate-700" />
                  <span className="hidden sm:inline">Dark Mode</span>
                </>
              )}
            </button>

            {/* Return to User Settings */}
            <button
              onClick={() => navigate('/settings')}
              className={`py-1.5 px-3.5 rounded-xl border text-xs font-semibold flex items-center space-x-1.5 transition-colors ${
                isDark
                  ? 'border-gray-700 bg-gray-800/50 hover:bg-gray-800 text-gray-300'
                  : 'border-slate-300 bg-white hover:bg-slate-100 text-slate-700 shadow-xs'
              }`}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Return to User App</span>
            </button>
          </div>
        </header>

        {/* Central Full-Screen Input Canvas */}
        <main className="flex-1 flex flex-col justify-center items-center px-4 sm:px-8 py-8 sm:py-16 w-full max-w-3xl mx-auto">
          {/* STEP 1: Full-Screen Master Administrator Password */}
          {step === 'password' && (
            <div className="w-full space-y-8 animate-fade-in">
              {/* Stage & Title */}
              <div className="text-center space-y-3">
                <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-[#F0B90B]/10 border border-[#F0B90B]/30 text-[#F0B90B]">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Security Clearance · Step 1 of 2</span>
                </div>

                <h1 className={`text-2xl sm:text-4xl font-extrabold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Master Administrator Authorization
                </h1>

                <p className={`text-sm sm:text-base max-w-xl mx-auto leading-relaxed ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>
                  Enter your encrypted master administrative password to proceed to Google Authenticator verification.
                </p>
              </div>

              {/* Lockout / Error Alerts */}
              {lockoutSeconds ? (
                <div className="p-4 sm:p-5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-500 text-xs sm:text-sm flex items-start space-x-3 max-w-2xl mx-auto">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-red-400">Terminal Gate Locked</p>
                    <p className="mt-0.5 text-red-400/90 leading-relaxed">
                      Multiple incorrect attempts detected. Terminal access locked for{' '}
                      <span className="font-mono font-bold text-red-300">{lockoutSeconds}</span> seconds.
                    </p>
                  </div>
                </div>
              ) : errorMessage ? (
                <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-500 text-xs sm:text-sm flex items-center space-x-3 max-w-2xl mx-auto">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <span className="font-medium">{errorMessage}</span>
                </div>
              ) : null}

              {/* Password Input Form */}
              <form onSubmit={handlePasswordSubmit} className="space-y-6 max-w-2xl mx-auto w-full">
                <div className="space-y-2">
                  <label className={`block text-xs sm:text-sm font-bold uppercase tracking-wider font-mono ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>
                    Master Password
                  </label>

                  <div className="relative">
                    <div className={`absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none ${isDark ? 'text-gray-400' : 'text-slate-400'}`}>
                      <Lock className="w-6 h-6" />
                    </div>

                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={submitting || Boolean(lockoutSeconds)}
                      placeholder="Enter administrator password..."
                      autoFocus
                      className={`w-full pl-14 pr-14 h-16 sm:h-20 text-lg sm:text-xl font-medium rounded-2xl border transition-all outline-none ${
                        isDark
                          ? 'bg-[#12151D] border-gray-700 text-white placeholder-gray-500 focus:border-[#F0B90B] focus:ring-4 focus:ring-[#F0B90B]/15'
                          : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 shadow-sm focus:border-[#F0B90B] focus:ring-4 focus:ring-[#F0B90B]/15'
                      }`}
                    />

                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className={`absolute inset-y-0 right-0 pr-5 flex items-center transition-colors ${isDark ? 'text-gray-400 hover:text-white' : 'text-slate-400 hover:text-slate-900'}`}
                    >
                      {showPassword ? <EyeOff className="w-6 h-6" /> : <Eye className="w-6 h-6" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting || !password.trim() || Boolean(lockoutSeconds)}
                  className="w-full h-14 sm:h-16 bg-[#F0B90B] hover:bg-[#d9a606] disabled:opacity-50 disabled:cursor-not-allowed text-black font-extrabold rounded-2xl text-base sm:text-lg transition-all flex items-center justify-center space-x-3 shadow-lg shadow-[#F0B90B]/10 hover:shadow-xl"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Verifying Master Credentials...</span>
                    </>
                  ) : (
                    <>
                      <span>Proceed to Google Authenticator Verification</span>
                      <Smartphone className="w-5 h-5" />
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* STEP 2: Full-Screen Google Verification Authentication Code (TOTP) */}
          {step === 'totp' && (
            <div className="w-full space-y-8 animate-fade-in text-center">
              {/* Stage & Title */}
              <div className="space-y-3">
                <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-500">
                  <Smartphone className="w-4 h-4" />
                  <span>Security Clearance · Step 2 of 2</span>
                </div>

                <h1 className={`text-2xl sm:text-4xl font-extrabold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Google Verification Authentication Code
                </h1>

                <p className={`text-sm sm:text-base max-w-xl mx-auto leading-relaxed ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>
                  Enter the 6-digit rolling verification code from the <b>Google Authenticator</b> app on your mobile device.
                </p>
              </div>

              {/* Error Alert */}
              {errorMessage && (
                <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-500 text-xs sm:text-sm flex items-center justify-center space-x-2 max-w-xl mx-auto">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span className="font-medium">{errorMessage}</span>
                </div>
              )}

              {/* 6 Large OTP Digit Boxes (Adaptive for Phone, Tablet, Laptop) */}
              <div className="flex items-center justify-center gap-2 sm:gap-4 py-4">
                {totpDigits.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => {
                      otpInputRefs.current[idx] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(idx, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                    onPaste={handleOtpPaste}
                    disabled={submitting}
                    className={`w-12 h-16 sm:w-16 sm:h-22 md:w-20 md:h-24 text-center text-3xl sm:text-4xl md:text-5xl font-mono font-extrabold rounded-2xl border transition-all outline-none ${
                      isDark
                        ? 'bg-[#12151D] border-gray-700 text-white focus:border-[#F0B90B] focus:ring-4 focus:ring-[#F0B90B]/20'
                        : 'bg-white border-slate-300 text-slate-900 shadow-sm focus:border-[#F0B90B] focus:ring-4 focus:ring-[#F0B90B]/20'
                    }`}
                  />
                ))}
              </div>

              {/* Rotation Countdown */}
              <div className="flex items-center justify-center space-x-2 text-xs sm:text-sm font-mono">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className={isDark ? 'text-gray-300' : 'text-slate-600'}>
                  Code rotates in <strong className="text-emerald-500 font-bold">{secondsRemaining}s</strong>
                </span>
              </div>

              {/* Action Button & Auxiliary Navigation */}
              <div className="max-w-xl mx-auto space-y-4 pt-2">
                <button
                  type="button"
                  onClick={() => verifyTotpCode()}
                  disabled={submitting || totpDigits.some((d) => !d)}
                  className="w-full h-14 sm:h-16 bg-[#F0B90B] hover:bg-[#d9a606] disabled:opacity-50 disabled:cursor-not-allowed text-black font-extrabold rounded-2xl text-base sm:text-lg transition-all flex items-center justify-center space-x-3 shadow-lg shadow-[#F0B90B]/10 hover:shadow-xl"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Verifying Authentication Code...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      <span>Complete Authentication & Launch Terminal</span>
                    </>
                  )}
                </button>

                <div className="flex items-center justify-between text-xs sm:text-sm pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setStep('password');
                      setPassword('');
                      setTotpDigits(['', '', '', '', '', '']);
                      setErrorMessage('');
                    }}
                    className={`font-semibold transition-colors ${isDark ? 'text-gray-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
                  >
                    ← Re-enter Password
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowRescueModal(true)}
                    className="text-amber-500 hover:underline font-semibold flex items-center space-x-1"
                  >
                    <LifeBuoy className="w-4 h-4" />
                    <span>Emergency Rescue Code</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Quiet Security Footer */}
        <footer className={`py-4 border-t text-center text-xs font-mono opacity-60 ${isDark ? 'border-gray-800 text-gray-500' : 'border-slate-200 text-slate-400'}`}>
          Vexa Institutional Terminal · End-to-End Cryptographic Clearance · PBKDF2 & AES-256-GCM Verified via Supabase
        </footer>

        {/* Emergency Rescue Code Modal */}
        {showRescueModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <div
              className={`max-w-md w-full rounded-3xl p-6 sm:p-8 shadow-2xl border transition-colors ${
                isDark ? 'bg-[#12151D] border-gray-700 text-white' : 'bg-white border-slate-200 text-slate-900'
              }`}
            >
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-800/20">
                <div className="flex items-center space-x-2">
                  <LifeBuoy className="w-5 h-5 text-amber-500" />
                  <h4 className="text-sm font-bold">Emergency Rescue Authorization</h4>
                </div>
                <button
                  onClick={() => setShowRescueModal(false)}
                  className={`p-1.5 rounded-lg transition-colors ${isDark ? 'text-gray-400 hover:text-white' : 'text-slate-400 hover:text-slate-900'}`}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleRescueSubmit} className="space-y-4">
                <p className={`text-xs leading-relaxed ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>
                  If your Google Authenticator device is unavailable, enter your 6-digit Emergency Master Rescue Code.
                </p>

                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={rescueCodeInput}
                  onChange={(e) => setRescueCodeInput(e.target.value.replace(/\D/g, ''))}
                  placeholder="Enter 6-digit rescue code..."
                  autoFocus
                  className={`w-full py-3 px-4 text-center text-2xl font-mono font-bold rounded-xl border outline-none ${
                    isDark
                      ? 'bg-[#0B0E14] border-gray-700 text-white focus:border-[#F0B90B]'
                      : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-[#F0B90B]'
                  }`}
                />

                <button
                  type="submit"
                  disabled={submitting || rescueCodeInput.length !== 6}
                  className="w-full py-3.5 bg-[#F0B90B] hover:bg-[#d9a606] disabled:opacity-50 text-black font-bold rounded-xl text-sm transition-colors shadow-md"
                >
                  Verify Emergency Code & Enter
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Once elevated, render the full admin application
  return <>{children}</>;
};
