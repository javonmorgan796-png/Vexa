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
  HelpCircle,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

export const AdminGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAdmin, loading, isElevated, elevateAdminSession } = useAdmin();
  const [, navigate] = useLocation();

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
      }, 100);
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
    const rescue = prompt('Enter your 6-digit Emergency Master Rescue Code:');
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

  const copyToClipboard = (text: string, type: 'secret' | 'rescue') => {
    navigator.clipboard.writeText(text);
    if (type === 'secret') {
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
    } else {
      setCopiedRescue(true);
      setTimeout(() => setCopiedRescue(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0B0E14] text-white">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-[#F0B90B]/10 border border-[#F0B90B]/30 flex items-center justify-center">
            <Loader2 className="w-7 h-7 text-[#F0B90B] animate-spin" />
          </div>
          <div className="text-center">
            <h2 className="text-lg font-bold tracking-tight text-white">Vexa Core Administration</h2>
            <p className="text-xs text-gray-400 mt-1">Authenticating administrative session & privileges...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0B0E14] text-white p-6">
        <div className="max-w-md w-full bg-[#161A23] border border-red-500/20 rounded-2xl p-8 text-center shadow-2xl">
          <div className="w-16 h-16 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-center justify-center mx-auto mb-5 text-red-500">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Access Denied (403 Forbidden)</h2>
          <p className="text-sm text-gray-400 leading-relaxed mb-6">
            Your account does not possess authorized administrative roles to access the Vexa Institutional Terminal.
          </p>
          <div className="bg-[#0B0E14] border border-gray-800 rounded-xl p-3 text-xs text-gray-500 mb-6 font-mono text-left">
            <div>Incident Reference: ERR_UNAUTHORIZED_ADMIN_ENTRY</div>
            <div>Time: {new Date().toISOString()}</div>
            <div>Security Level: High (Attempt logged)</div>
          </div>
          <button
            onClick={() => navigate('/settings')}
            className="w-full py-3 px-4 bg-[#F0B90B] hover:bg-[#d9a606] text-black font-semibold rounded-xl text-sm transition-colors flex items-center justify-center space-x-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to User Dashboard</span>
          </button>
        </div>
      </div>
    );
  }

  // If Admin is NOT elevated, prompt with the 2-step security login gate
  if (!isElevated) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0B0E14] text-white p-4 overflow-y-auto">
        <div className="max-w-md w-full bg-[#161A23] border border-gray-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative my-auto">
          {/* Header Branding */}
          <div className="flex items-center justify-between mb-6 pb-5 border-b border-gray-800/80">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-[#F0B90B]/10 border border-[#F0B90B]/30 flex items-center justify-center text-[#F0B90B]">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white tracking-tight">Institutional Terminal Gate</h2>
                <div className="flex items-center space-x-2 mt-0.5">
                  <span className="w-2 h-2 rounded-full bg-[#F0B90B] animate-pulse" />
                  <span className="text-[11px] font-mono text-gray-400 uppercase tracking-wider">
                    {step === 'password' ? 'Step 1 of 2 · Master Password' : 'Step 2 of 2 · Google Authenticator'}
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={() => navigate('/settings')}
              className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800/60 transition-colors"
              title="Return to user settings"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          </div>

          {/* Error & Lockout Notifications */}
          {lockoutSeconds ? (
            <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 shrink-0 text-red-500" />
              <div>
                <p className="font-semibold text-red-300">Administrative Gate Locked</p>
                <p className="mt-0.5 text-red-400/90 leading-relaxed">
                  Too many incorrect password attempts. Security lockout active for{' '}
                  <span className="font-mono font-bold text-red-200">{lockoutSeconds}</span> seconds.
                </p>
              </div>
            </div>
          ) : errorMessage ? (
            <div className="mb-5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center space-x-2.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          ) : null}

          {/* STEP 1: Master Admin Password Challenge */}
          {step === 'password' && (
            <form onSubmit={handlePasswordSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-2">
                  Master Administrator Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={submitting || Boolean(lockoutSeconds)}
                    placeholder="Enter Master Admin Password..."
                    className="w-full pl-10 pr-10 py-3 rounded-xl bg-[#0B0E14] border border-gray-700/80 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-[#F0B90B] focus:ring-1 focus:ring-[#F0B90B] transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Password strength & default assistance */}
              <div className="bg-[#0B0E14]/80 border border-gray-800 rounded-xl p-3 text-xs space-y-1.5">
                <div className="flex items-center justify-between text-gray-400">
                  <span>Cryptographic Key Preset:</span>
                  <button
                    type="button"
                    onClick={() => setPassword('VexaAdmin@2026!')}
                    className="text-[#F0B90B] hover:underline font-mono text-[11px]"
                  >
                    Auto-Fill Default Key
                  </button>
                </div>
                <div className="font-mono text-[11px] text-gray-500 truncate">
                  Key: <span className="text-gray-300">VexaAdmin@2026!</span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting || !password.trim() || Boolean(lockoutSeconds)}
                  className="w-full py-3.5 px-4 bg-[#F0B90B] hover:bg-[#d9a606] disabled:opacity-50 disabled:cursor-not-allowed text-black font-semibold rounded-xl text-sm transition-all flex items-center justify-center space-x-2 shadow-lg shadow-[#F0B90B]/10"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Validating Master Key...</span>
                    </>
                  ) : (
                    <>
                      <span>Verify & Proceed to Google Authenticator</span>
                      <Smartphone className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* STEP 2: Google Verification Authentication Code (TOTP) */}
          {step === 'totp' && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto mb-3 text-emerald-400">
                  <Smartphone className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-white">Google Verification Code</h3>
                <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">
                  Enter the 6-digit verification code from your Google Authenticator app for Vexa Admin.
                </p>
              </div>

              {/* 6-box OTP Input */}
              <div className="flex items-center justify-center gap-2 sm:gap-2.5">
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
                    className="w-11 h-13 sm:w-12 sm:h-14 text-center text-xl sm:text-2xl font-mono font-bold rounded-xl bg-[#0B0E14] border border-gray-700 text-white focus:outline-none focus:border-[#F0B90B] focus:ring-1 focus:ring-[#F0B90B] transition-all"
                  />
                ))}
              </div>

              {/* Countdown and Refresh helper */}
              <div className="flex items-center justify-between text-xs text-gray-400 px-1 font-mono">
                <div className="flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Code rotates in: {secondsRemaining}s</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowQrModal(true)}
                  className="text-[#F0B90B] hover:underline flex items-center space-x-1"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>Scan QR / Setup Key</span>
                </button>
              </div>

              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={() => verifyTotpCode()}
                  disabled={submitting || totpDigits.some((d) => !d)}
                  className="w-full py-3.5 px-4 bg-[#F0B90B] hover:bg-[#d9a606] disabled:opacity-50 disabled:cursor-not-allowed text-black font-semibold rounded-xl text-sm transition-all flex items-center justify-center space-x-2 shadow-lg shadow-[#F0B90B]/10"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Verifying with Google Authenticator...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Authenticate & Open Terminal</span>
                    </>
                  )}
                </button>

                <div className="flex items-center justify-between text-xs text-gray-500 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setStep('password');
                      setPassword('');
                      setTotpDigits(['', '', '', '', '', '']);
                    }}
                    className="hover:text-gray-300 transition-colors"
                  >
                    ← Re-enter Password
                  </button>
                  <button
                    type="button"
                    onClick={handleUseRescueCode}
                    className="hover:text-[#F0B90B] transition-colors"
                  >
                    Emergency Rescue Code
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Google Authenticator QR Code Setup Modal */}
          {showQrModal && totpSetupData && (
            <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="max-w-sm w-full bg-[#161A23] border border-gray-700 rounded-2xl p-6 shadow-2xl relative">
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-800">
                  <div className="flex items-center space-x-2">
                    <QrCode className="w-5 h-5 text-[#F0B90B]" />
                    <h4 className="text-sm font-bold text-white">Google Authenticator Setup</h4>
                  </div>
                  <button
                    onClick={() => setShowQrModal(false)}
                    className="text-gray-400 hover:text-white p-1"
                  >
                    ✕
                  </button>
                </div>

                <div className="flex flex-col items-center text-center">
                  <div className="p-3 bg-white rounded-xl shadow mb-4">
                    <QRCodeSVG value={totpSetupData.uri} size={170} level="M" />
                  </div>
                  <p className="text-xs text-gray-300 mb-3">
                    Scan this QR code in the <b>Google Authenticator</b> app on your phone, or enter the secret key manually:
                  </p>

                  <div className="w-full bg-[#0B0E14] border border-gray-800 rounded-xl p-3 flex items-center justify-between font-mono text-xs text-gray-300 mb-4">
                    <span className="truncate mr-2">{totpSetupData.secret}</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(totpSetupData.secret, 'secret')}
                      className="p-1.5 hover:bg-gray-800 rounded text-gray-400 hover:text-white shrink-0"
                      title="Copy Key"
                    >
                      {copiedSecret ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>

                  <div className="w-full p-2.5 rounded-lg bg-gray-800/40 border border-gray-800 text-[11px] text-gray-400 text-left">
                    <div><b>Account:</b> {totpSetupData.account}</div>
                    <div><b>Type:</b> Time-based (RFC 6238 / 30s)</div>
                    <div className="mt-1 text-emerald-400/90 font-mono">
                      Rescue Backup Code: {totpSetupData.rescueCode}
                    </div>
                  </div>

                  <button
                    onClick={() => setShowQrModal(false)}
                    className="mt-5 w-full py-2.5 bg-[#F0B90B] hover:bg-[#d9a606] text-black font-semibold rounded-xl text-xs transition-colors"
                  >
                    Done · Return to Input Code
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Once authenticated and elevated, render the full admin application
  return <>{children}</>;
};
