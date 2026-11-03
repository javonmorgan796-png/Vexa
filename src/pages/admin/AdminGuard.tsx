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
  QrCode,
  Copy,
  Check,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Sun,
  Moon,
  LifeBuoy,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

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
  const [showQrModal, setShowQrModal] = useState(false);
  const [totpSetupData, setTotpSetupData] = useState<{ secret: string; uri: string; rescueCode: string; account?: string } | null>(null);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedRescue, setCopiedRescue] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);

  // Status & error handling
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);
  const [lockoutSeconds, setLockoutSeconds] = useState<number | null>(null);

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

  // Fetch TOTP setup metadata on mount
  useEffect(() => {
    fetch('/api/admin/auth/totp-setup')
      .then((res) => res.json())
      .then((data) => setTotpSetupData(data))
      .catch(() => {});
  }, []);

  // Handle Password Submit
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    if (!password.trim()) {
      setErrorMessage('Master password is required.');
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

  const handleUseRescueCode = async () => {
    const rescue = prompt('Enter your 6-digit Emergency Master Rescue Code (Default: 982710):');
    if (!rescue) return;
    try {
      setSubmitting(true);
      setErrorMessage('');
      const res = await fetch('/api/admin/auth/verify-totp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: rescue,
          tempChallengeToken,
          rescueCode: rescue,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Invalid rescue code.');
      }
      elevateAdminSession(data.token);
    } catch (err: any) {
      setErrorMessage(err.message || 'Emergency rescue failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const copyToClipboard = (text: string, type: 'secret' | 'rescue' | 'password') => {
    navigator.clipboard.writeText(text);
    if (type === 'secret') {
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
    } else if (type === 'rescue') {
      setCopiedRescue(true);
      setTimeout(() => setCopiedRescue(false), 2000);
    } else {
      setCopiedPassword(true);
      setTimeout(() => setCopiedPassword(false), 2000);
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
            <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>Authenticating administrative session & privileges...</p>
          </div>
        </div>
      </div>
    );
  }

  // Full-Screen 403 Forbidden Screen
  if (!isAdmin) {
    return (
      <div className={`min-h-screen w-full flex flex-col transition-colors ${isDark ? 'bg-[#0B0E14] text-white' : 'bg-slate-50 text-slate-900'}`}>
        {/* Top Header */}
        <header className={`h-16 px-6 border-b flex items-center justify-between ${isDark ? 'border-gray-800 bg-[#0B0E14]' : 'border-slate-200 bg-white shadow-xs'}`}>
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#F0B90B] to-[#FCD535] flex items-center justify-center text-black font-extrabold text-sm shadow-md">
              V
            </div>
            <span className="font-bold text-sm tracking-tight">VEXA INSTITUTIONAL</span>
          </div>
          <button
            onClick={() => navigate('/settings')}
            className={`py-1.5 px-3 rounded-xl text-xs font-semibold border flex items-center space-x-1.5 transition-colors ${
              isDark
                ? 'border-gray-700 bg-gray-800/60 hover:bg-gray-800 text-gray-200'
                : 'border-slate-300 bg-white hover:bg-slate-100 text-slate-700 shadow-xs'
            }`}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to User App</span>
          </button>
        </header>

        {/* 403 Content Body */}
        <div className="flex-1 flex items-center justify-center p-6">
          <div className={`max-w-md w-full rounded-3xl p-8 text-center border shadow-xl ${isDark ? 'bg-[#161A23] border-red-500/30' : 'bg-white border-rose-200'}`}>
            <div className="w-16 h-16 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-center justify-center mx-auto mb-5 text-red-500">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold mb-2">Access Denied (403 Forbidden)</h2>
            <p className={`text-sm leading-relaxed mb-6 ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>
              Your account does not possess authorized administrative roles to access the Vexa Institutional Terminal.
            </p>
            <div className={`border rounded-xl p-3 text-xs mb-6 font-mono text-left ${isDark ? 'bg-[#0B0E14] border-gray-800 text-gray-500' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
              <div>Incident: ERR_UNAUTHORIZED_ADMIN_ENTRY</div>
              <div>Time: {new Date().toISOString()}</div>
              <div>Security Clearance: High (Attempt logged)</div>
            </div>
            <button
              onClick={() => navigate('/settings')}
              className="w-full py-3.5 px-4 bg-[#F0B90B] hover:bg-[#d9a606] text-black font-semibold rounded-xl text-sm transition-colors flex items-center justify-center space-x-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Return to User Dashboard</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Full-Screen Authentication Challenge (Step 1: Password or Step 2: Google Authenticator)
  if (!isElevated) {
    return (
      <div className={`min-h-screen w-full flex flex-col transition-colors ${isDark ? 'bg-[#0B0E14] text-white' : 'bg-slate-50 text-slate-900'}`}>
        {/* Top Header Bar across full screen */}
        <header
          className={`h-16 px-4 sm:px-8 border-b flex items-center justify-between sticky top-0 z-40 backdrop-blur-md ${
            isDark ? 'bg-[#0B0E14]/90 border-gray-800' : 'bg-white/95 border-slate-200 shadow-xs'
          }`}
        >
          {/* Brand Mark */}
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#F0B90B] to-[#FCD535] flex items-center justify-center text-black font-extrabold text-sm shadow-md">
              V
            </div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-sm tracking-tight">VEXA</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#F0B90B] text-black font-extrabold uppercase">
                Institutional
              </span>
            </div>
            <span className={`hidden md:inline-block text-xs font-mono pl-2 border-l ${isDark ? 'border-gray-800 text-gray-400' : 'border-slate-300 text-slate-500'}`}>
              Security Clearance Terminal
            </span>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center space-x-3">
            {/* Theme Switcher Button */}
            <button
              onClick={toggleAdminTheme}
              className={`py-1.5 px-3 rounded-xl border text-xs font-medium flex items-center space-x-1.5 transition-colors ${
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
              className={`py-1.5 px-3 rounded-xl border text-xs font-semibold flex items-center space-x-1.5 transition-colors ${
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

        {/* Main Full-Screen Layout */}
        <div className="flex-1 w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 min-h-[calc(100vh-64px)]">
          {/* Left Security Telemetry & Credentials Pane */}
          <div
            className={`lg:col-span-5 p-6 sm:p-10 lg:p-12 border-b lg:border-b-0 lg:border-r flex flex-col justify-between ${
              isDark ? 'border-gray-800 bg-[#0E1118]/50' : 'border-slate-200 bg-white/60'
            }`}
          >
            <div className="space-y-6">
              {/* Institutional Badge */}
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-[#F0B90B]/10 border border-[#F0B90B]/30 text-[#F0B90B]">
                <ShieldCheck className="w-4 h-4" />
                <span>Restricted Perimeter · Level 4 Authorization</span>
              </div>

              <div>
                <h1 className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Institutional Gate Clearance
                </h1>
                <p className={`text-xs sm:text-sm mt-2 leading-relaxed ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>
                  Access to customer balances, treasury reserves, corporate payroll dispatches, and settlement routing requires two-step multi-factor authentication.
                </p>
              </div>

              {/* Protocol Spec Checklist */}
              <div className={`rounded-2xl p-4 border space-y-3 ${isDark ? 'bg-[#12151D] border-gray-800/80' : 'bg-slate-50 border-slate-200'}`}>
                <div className={`text-[11px] font-mono font-bold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                  Verification Requirements
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center space-x-2">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${step === 'totp' ? 'bg-emerald-500 text-white' : 'bg-[#F0B90B] text-black'}`}>
                      {step === 'totp' ? '✓' : '1'}
                    </span>
                    <span className={isDark ? 'text-gray-200' : 'text-slate-800'}>
                      Master Administrator Cryptographic Key
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${step === 'totp' ? 'bg-[#F0B90B] text-black' : isDark ? 'bg-gray-800 text-gray-400' : 'bg-slate-200 text-slate-500'}`}>
                      2
                    </span>
                    <span className={step === 'totp' ? isDark ? 'text-white font-semibold' : 'text-slate-900 font-semibold' : isDark ? 'text-gray-400' : 'text-slate-500'}>
                      Google Authenticator 6-Digit Verification Code (RFC 6238)
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick Helper & Preset Credentials Box */}
              <div className={`rounded-2xl p-5 border space-y-3.5 ${isDark ? 'bg-[#12151D] border-gray-800' : 'bg-white border-slate-200 shadow-sm'}`}>
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold uppercase font-mono ${isDark ? 'text-[#F0B90B]' : 'text-[#a17800]'}`}>
                    Super Admin Credentials Preset
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-bold">
                    Primary Super Admin
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  {/* Master Password Preset */}
                  <div className={`p-2.5 rounded-xl border flex items-center justify-between ${isDark ? 'bg-[#0B0E14] border-gray-800' : 'bg-slate-50 border-slate-200'}`}>
                    <div>
                      <div className={`text-[10px] font-mono ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>Master Password:</div>
                      <div className={`font-mono font-semibold ${isDark ? 'text-gray-200' : 'text-slate-800'}`}>VexaAdmin@2026!</div>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      {step === 'password' && (
                        <button
                          type="button"
                          onClick={() => setPassword('VexaAdmin@2026!')}
                          className="px-2 py-1 bg-[#F0B90B] hover:bg-[#d9a606] text-black font-bold text-[10px] rounded-lg transition-colors"
                        >
                          Auto-Fill
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => copyToClipboard('VexaAdmin@2026!', 'password')}
                        className={`p-1.5 rounded-lg border transition-colors ${
                          isDark ? 'border-gray-700 hover:bg-gray-800 text-gray-300' : 'border-slate-200 hover:bg-white text-slate-600'
                        }`}
                        title="Copy Password"
                      >
                        {copiedPassword ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Google Authenticator Secret Preset */}
                  <div className={`p-2.5 rounded-xl border flex items-center justify-between ${isDark ? 'bg-[#0B0E14] border-gray-800' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="min-w-0 pr-2">
                      <div className={`text-[10px] font-mono ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>Google Authenticator Key:</div>
                      <div className={`font-mono font-semibold truncate ${isDark ? 'text-gray-200' : 'text-slate-800'}`}>
                        {totpSetupData?.secret || 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP'}
                      </div>
                    </div>
                    <div className="flex items-center space-x-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setShowQrModal(true)}
                        className="px-2 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 font-bold text-[10px] rounded-lg transition-colors flex items-center space-x-1"
                      >
                        <QrCode className="w-3 h-3" />
                        <span>QR Setup</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(totpSetupData?.secret || 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP', 'secret')}
                        className={`p-1.5 rounded-lg border transition-colors ${
                          isDark ? 'border-gray-700 hover:bg-gray-800 text-gray-300' : 'border-slate-200 hover:bg-white text-slate-600'
                        }`}
                        title="Copy Secret Key"
                      >
                        {copiedSecret ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Emergency Rescue Code */}
                  <div className={`p-2.5 rounded-xl border flex items-center justify-between ${isDark ? 'bg-[#0B0E14] border-gray-800' : 'bg-slate-50 border-slate-200'}`}>
                    <div>
                      <div className={`text-[10px] font-mono ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>Emergency Rescue Code:</div>
                      <div className={`font-mono font-semibold text-emerald-500`}>982710</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard('982710', 'rescue')}
                      className={`p-1.5 rounded-lg border transition-colors ${
                        isDark ? 'border-gray-700 hover:bg-gray-800 text-gray-300' : 'border-slate-200 hover:bg-white text-slate-600'
                      }`}
                      title="Copy Rescue Code"
                    >
                      {copiedRescue ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Security Footer */}
            <div className={`pt-6 border-t mt-6 text-xs font-mono ${isDark ? 'border-gray-800/80 text-gray-500' : 'border-slate-200 text-slate-400'}`}>
              <div>Session Security: TLS 1.3 / End-to-End Cryptography</div>
              <div>Terminal Clearance Engine: Active</div>
            </div>
          </div>

          {/* Right Challenge Form Workspace (Full Viewport Height) */}
          <div className="lg:col-span-7 p-6 sm:p-10 lg:p-16 flex items-center justify-center">
            <div
              className={`w-full max-w-lg rounded-3xl p-6 sm:p-10 border transition-all ${
                isDark
                  ? 'bg-[#12151D] border-gray-800 shadow-2xl'
                  : 'bg-white border-slate-200 shadow-xl'
              }`}
            >
              {/* Step Progression Visual Header */}
              <div className="flex items-center justify-between mb-8 pb-5 border-b border-gray-800/20">
                <div className="flex items-center space-x-3">
                  <div
                    className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-sm ${
                      step === 'password'
                        ? 'bg-[#F0B90B] text-black shadow-md'
                        : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-500'
                    }`}
                  >
                    {step === 'password' ? <KeyRound className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
                  </div>
                  <div>
                    <h2 className={`text-base font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {step === 'password' ? 'Step 1: Master Admin Password' : 'Step 2: Google Verification Code'}
                    </h2>
                    <div className="flex items-center space-x-2 mt-0.5">
                      <span className="w-2 h-2 rounded-full bg-[#F0B90B] animate-pulse" />
                      <span className={`text-[11px] font-mono uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                        {step === 'password' ? 'Stage 1 of 2 · Primary Secret' : 'Stage 2 of 2 · Biometric / TOTP'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-1.5">
                  <div className={`w-2.5 h-2.5 rounded-full ${step === 'password' ? 'bg-[#F0B90B]' : 'bg-emerald-500'}`} />
                  <div className={`w-8 h-1 rounded-full ${step === 'totp' ? 'bg-emerald-500' : isDark ? 'bg-gray-800' : 'bg-slate-200'}`} />
                  <div className={`w-2.5 h-2.5 rounded-full ${step === 'totp' ? 'bg-[#F0B90B]' : isDark ? 'bg-gray-800' : 'bg-slate-200'}`} />
                </div>
              </div>

              {/* Error & Lockout Alerts */}
              {lockoutSeconds ? (
                <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-500 text-xs flex items-start space-x-3">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <div>
                    <p className="font-bold text-red-400">Administrative Gate Locked</p>
                    <p className="mt-0.5 text-red-400/90 leading-relaxed">
                      Security lockout active due to multiple invalid password attempts. Please wait{' '}
                      <span className="font-mono font-bold text-red-300">{lockoutSeconds}</span> seconds.
                    </p>
                  </div>
                </div>
              ) : errorMessage ? (
                <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-500 text-xs flex items-center space-x-3">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span className="font-medium">{errorMessage}</span>
                </div>
              ) : null}

              {/* STEP 1: Full-Screen Master Password Challenge */}
              {step === 'password' && (
                <form onSubmit={handlePasswordSubmit} className="space-y-6">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className={`block text-xs font-bold uppercase tracking-wider font-mono ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>
                        Master Admin Password
                      </label>
                      <button
                        type="button"
                        onClick={() => setPassword('VexaAdmin@2026!')}
                        className="text-xs font-mono font-bold text-[#F0B90B] hover:underline"
                      >
                        Auto-fill Preset
                      </button>
                    </div>

                    <div className="relative">
                      <div className={`absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none ${isDark ? 'text-gray-400' : 'text-slate-400'}`}>
                        <Lock className="w-5 h-5" />
                      </div>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={submitting || Boolean(lockoutSeconds)}
                        placeholder="Enter Master Password..."
                        autoFocus
                        className={`w-full pl-12 pr-12 py-3.5 rounded-2xl text-sm font-medium border transition-all outline-none ${
                          isDark
                            ? 'bg-[#0B0E14] border-gray-700 text-white placeholder-gray-500 focus:border-[#F0B90B] focus:ring-2 focus:ring-[#F0B90B]/20'
                            : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:bg-white focus:border-[#F0B90B] focus:ring-2 focus:ring-[#F0B90B]/20'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className={`absolute inset-y-0 right-0 pr-4 flex items-center transition-colors ${isDark ? 'text-gray-400 hover:text-white' : 'text-slate-400 hover:text-slate-900'}`}
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting || !password.trim() || Boolean(lockoutSeconds)}
                    className="w-full py-4 px-6 bg-[#F0B90B] hover:bg-[#d9a606] disabled:opacity-50 disabled:cursor-not-allowed text-black font-extrabold rounded-2xl text-sm transition-all flex items-center justify-center space-x-2 shadow-lg shadow-[#F0B90B]/10 hover:shadow-xl"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Validating Master Cryptographic Key...</span>
                      </>
                    ) : (
                      <>
                        <span>Authorize Key & Proceed to Google 2FA</span>
                        <Smartphone className="w-4 h-4" />
                      </>
                    )}
                  </button>

                  <div className={`p-4 rounded-2xl border text-xs leading-relaxed space-y-1 ${isDark ? 'bg-[#0B0E14]/60 border-gray-800 text-gray-400' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                    <div className="font-semibold text-emerald-500 flex items-center space-x-1.5">
                      <ShieldCheck className="w-4 h-4" />
                      <span>Zero-Trust Authorization Enforced</span>
                    </div>
                    <p>
                      Password verification unlocks Stage 2 where you will provide your real-time 6-digit Google Authenticator code.
                    </p>
                  </div>
                </form>
              )}

              {/* STEP 2: Full-Screen Google Verification Authentication Code (TOTP) */}
              {step === 'totp' && (
                <div className="space-y-6">
                  <div className="text-center">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto mb-3 text-emerald-400 shadow-sm">
                      <Smartphone className="w-7 h-7" />
                    </div>
                    <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      Google Verification Authentication Code
                    </h3>
                    <p className={`text-xs mt-1.5 max-w-sm mx-auto leading-relaxed ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>
                      Enter the 6-digit rolling verification code from the <b>Google Authenticator</b> app on your phone.
                    </p>
                  </div>

                  {/* 6 Large Digit Boxes */}
                  <div className="flex items-center justify-center gap-2 sm:gap-3 py-2">
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
                        className={`w-12 h-16 sm:w-14 sm:h-18 text-center text-2xl sm:text-3xl font-mono font-extrabold rounded-2xl border transition-all outline-none ${
                          isDark
                            ? 'bg-[#0B0E14] border-gray-700 text-white focus:border-[#F0B90B] focus:ring-2 focus:ring-[#F0B90B]/30'
                            : 'bg-slate-50 border-slate-300 text-slate-900 focus:bg-white focus:border-[#F0B90B] focus:ring-2 focus:ring-[#F0B90B]/30 shadow-xs'
                        }`}
                      />
                    ))}
                  </div>

                  {/* Code Rotation Timer Bar */}
                  <div className={`p-3.5 rounded-2xl border flex items-center justify-between text-xs font-mono ${isDark ? 'bg-[#0B0E14]/80 border-gray-800' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="flex items-center space-x-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className={isDark ? 'text-gray-300' : 'text-slate-700'}>
                        Code rotates in: <strong className="text-emerald-500 font-bold">{secondsRemaining}s</strong>
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowQrModal(true)}
                      className="text-[#F0B90B] hover:underline flex items-center space-x-1 font-semibold"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      <span>Setup / QR Code</span>
                    </button>
                  </div>

                  {/* Submit / Verification Button */}
                  <button
                    type="button"
                    onClick={() => verifyTotpCode()}
                    disabled={submitting || totpDigits.some((d) => !d)}
                    className="w-full py-4 px-6 bg-[#F0B90B] hover:bg-[#d9a606] disabled:opacity-50 disabled:cursor-not-allowed text-black font-extrabold rounded-2xl text-sm transition-all flex items-center justify-center space-x-2 shadow-lg shadow-[#F0B90B]/10 hover:shadow-xl"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Verifying with Google Authenticator...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Complete Authentication & Open Terminal</span>
                      </>
                    )}
                  </button>

                  {/* Auxiliary Actions */}
                  <div className="flex items-center justify-between text-xs pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setStep('password');
                        setPassword('');
                        setTotpDigits(['', '', '', '', '', '']);
                        setErrorMessage('');
                      }}
                      className={`font-medium transition-colors ${isDark ? 'text-gray-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
                    >
                      ← Re-enter Password
                    </button>

                    <button
                      type="button"
                      onClick={handleUseRescueCode}
                      className="text-amber-500 hover:underline font-semibold flex items-center space-x-1"
                    >
                      <LifeBuoy className="w-3.5 h-3.5" />
                      <span>Use Rescue Backup Code</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Google Authenticator QR Code Setup Modal (Full Lite/Dark Theme Compatible) */}
        {showQrModal && totpSetupData && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <div
              className={`max-w-md w-full rounded-3xl p-6 sm:p-8 shadow-2xl border transition-colors relative ${
                isDark ? 'bg-[#161A23] border-gray-700 text-white' : 'bg-white border-slate-200 text-slate-900'
              }`}
            >
              <div className={`flex items-center justify-between pb-3 mb-4 border-b ${isDark ? 'border-gray-800' : 'border-slate-200'}`}>
                <div className="flex items-center space-x-2">
                  <div className="p-1.5 rounded-lg bg-[#F0B90B]/10 text-[#F0B90B]">
                    <QrCode className="w-5 h-5" />
                  </div>
                  <h4 className="text-sm font-bold">Google Authenticator Setup</h4>
                </div>
                <button
                  onClick={() => setShowQrModal(false)}
                  className={`p-1.5 rounded-lg transition-colors ${isDark ? 'text-gray-400 hover:text-white' : 'text-slate-400 hover:text-slate-900'}`}
                >
                  ✕
                </button>
              </div>

              <div className="flex flex-col items-center text-center">
                {/* QR Code Container */}
                <div className="p-4 bg-white rounded-2xl shadow-md border border-slate-200 mb-4">
                  <QRCodeSVG value={totpSetupData.uri} size={180} level="M" />
                </div>

                <p className={`text-xs mb-4 leading-relaxed ${isDark ? 'text-gray-300' : 'text-slate-600'}`}>
                  Open <b>Google Authenticator</b> on your iOS or Android phone, tap <b>+</b>, then choose <b>Scan a QR code</b>.
                </p>

                {/* Base32 Key Box with Copy Button */}
                <div className={`w-full rounded-xl border p-3 flex items-center justify-between font-mono text-xs mb-3 ${isDark ? 'bg-[#0B0E14] border-gray-800 text-gray-300' : 'bg-slate-50 border-slate-200 text-slate-800'}`}>
                  <div className="truncate mr-2 text-left">
                    <div className="text-[10px] text-gray-400 font-sans">Manual Entry Key:</div>
                    <div className="font-bold truncate text-[#F0B90B]">{totpSetupData.secret}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(totpSetupData.secret, 'secret')}
                    className={`p-2 rounded-lg border transition-colors shrink-0 ${
                      isDark ? 'border-gray-700 bg-gray-800 text-gray-300 hover:text-white' : 'border-slate-300 bg-white text-slate-700 hover:text-black'
                    }`}
                    title="Copy Secret Key"
                  >
                    {copiedSecret ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>

                {/* Account & Rescue Code Box */}
                <div className={`w-full p-3 rounded-xl border text-[11px] text-left space-y-1 mb-5 ${isDark ? 'bg-gray-800/40 border-gray-800 text-gray-400' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                  <div><b>Account Name:</b> {totpSetupData.account || 'Vexa Core Admin (09067212032)'}</div>
                  <div><b>Issuer:</b> Vexa Institutional</div>
                  <div><b>Algorithm:</b> Time-based TOTP (30s window)</div>
                  <div className="pt-1 text-emerald-500 font-mono font-bold">
                    Backup Rescue Code: {totpSetupData.rescueCode || '982710'}
                  </div>
                </div>

                <button
                  onClick={() => setShowQrModal(false)}
                  className="w-full py-3 bg-[#F0B90B] hover:bg-[#d9a606] text-black font-bold rounded-xl text-xs transition-colors shadow-md"
                >
                  Done · Return to 6-Digit Code Input
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Once elevated, render the full admin application
  return <>{children}</>;
};
