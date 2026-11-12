import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from 'wouter';
import { ChevronLeft, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { normalizeLoginPhone } from '@/lib/authSecurity';

const COUNTRY_CODES = [
  { flag: '🇳🇬', code: '+234', name: 'Nigeria' },
];

const LAST_PHONE_KEY = 'vexa_last_login_phone';

function clearLocalLockoutKeys(phone: string) {
  const normalized = normalizeLoginPhone(phone);
  if (!normalized) return;
  try {
    localStorage.removeItem(`vexa_login_fail_${normalized}`);
    localStorage.removeItem(`vexa_passcode_return_lockout_${normalized}`);
  } catch {
    // Ignore storage errors
  }
}

/* Reusable 4- or 6-box PIN/OTP input */
function PinBoxes({
  value,
  onChange,
  disabled,
  masked = false,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  disabled?: boolean;
  masked?: boolean;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const length = value.length;

  function handleDigit(idx: number, val: string) {
    const digit = val.replace(/\D/g, '').slice(-1);
    const next = [...value];
    next[idx] = digit;
    onChange(next);
    if (digit && idx < length - 1) refs.current[idx + 1]?.focus();
  }

  function handleKeyDown(idx: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      if (value[idx]) {
        const next = [...value];
        next[idx] = '';
        onChange(next);
      } else if (idx > 0) {
        refs.current[idx - 1]?.focus();
        const next = [...value];
        next[idx - 1] = '';
        onChange(next);
      }
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    const next = Array.from({ length }, () => '');
    text.split('').forEach((ch, i) => { next[i] = ch; });
    onChange(next);
    const focusIdx = Math.min(text.length, length - 1);
    refs.current[focusIdx]?.focus();
  }

  return (
    <div className={`flex gap-2.5 ${length === 4 ? 'justify-start' : 'justify-between'}`} onPaste={handlePaste}>
      {value.map((digit, idx) => (
        <input
          key={idx}
          ref={el => { refs.current[idx] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          disabled={disabled}
          onChange={e => handleDigit(idx, e.target.value)}
          onKeyDown={e => handleKeyDown(idx, e)}
          className={`theme-field ${masked ? 'passcode-digit' : ''} w-full h-[52px] rounded-xl text-center text-[20px] font-bold focus:outline-none focus:ring-0 transition-colors caret-transparent disabled:opacity-50`}
          style={{ maxWidth: 52 }}
        />
      ))}
    </div>
  );
}

export default function ForgotPasscodePage() {
  const [, navigate] = useLocation();

  const initialPhone = (() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const fromQuery = params.get('phone')?.trim();
      if (fromQuery) return fromQuery;
      return localStorage.getItem(LAST_PHONE_KEY) ?? '';
    } catch {
      return '';
    }
  })();

  const [step, setStep] = useState<'phone' | 'otp' | 'pin_verify' | 'reset' | 'success'>('phone');
  const [phone, setPhone] = useState(initialPhone);
  const [countryCode, setCountryCode] = useState(COUNTRY_CODES[0]);
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  // OTP / verification state
  const [requestId, setRequestId] = useState('');
  const [maskedPhone, setMaskedPhone] = useState('');
  const [isDemoOtp, setIsDemoOtp] = useState(false);
  const [fallbackNotice, setFallbackNotice] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [resendTimer, setResendTimer] = useState(30);

  // Account + PIN fallback verification state
  const [accountNumber, setAccountNumber] = useState('');
  const [txPin, setTxPin] = useState(['', '', '', '']);

  // Reset passcode state
  const [resetToken, setResetToken] = useState('');
  const [newPasscode, setNewPasscode] = useState(['', '', '', '', '', '']);
  const [confirmPasscode, setConfirmPasscode] = useState(['', '', '', '', '', '']);
  const [showPasscode, setShowPasscode] = useState(false);

  // Feedback
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (step !== 'otp' || resendTimer <= 0) return;
    const t = window.setInterval(() => setResendTimer(v => Math.max(0, v - 1)), 1000);
    return () => window.clearInterval(t);
  }, [step, resendTimer]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    }
    if (showPicker) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPicker]);

  function buildFullRecipient(): string | null {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) return null;
    const national = digits.startsWith('234') ? digits.slice(3).replace(/^0/, '') : digits.replace(/^0+/, '');
    if (national.length !== 10) return null;
    return `${countryCode.code}${national}`;
  }

  async function requestVerification(): Promise<'otp' | 'pin_verify' | null> {
    const recipient = buildFullRecipient();
    if (!recipient) {
      setError('Enter a valid 10 or 11-digit Nigerian phone number');
      return null;
    }

    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/auth/forgot-passcode/send-otp', {
        method: 'POST',
        headers: { accept: 'application/json', 'content-type': 'application/json' },
        body: JSON.stringify({ phone: recipient }),
      });
      const data = await response.json().catch(() => null) as {
        mode?: 'otp' | 'pin_verify';
        requestId?: string;
        maskedPhone?: string;
        demo?: boolean;
        notice?: string;
        message?: string;
      } | null;

      if (!response.ok || !data?.requestId) {
        setError(data?.message ?? 'Could not start passcode recovery. Please try again.');
        return null;
      }

      setRequestId(data.requestId);
      setMaskedPhone(data.maskedPhone ?? phone);
      setIsDemoOtp(Boolean(data.demo));
      setFallbackNotice(data.notice ?? '');
      setOtp(['', '', '', '', '', '']);
      setAccountNumber('');
      setTxPin(['', '', '', '']);
      setResendTimer(30);
      return data.mode === 'pin_verify' ? 'pin_verify' : 'otp';
    } catch {
      setError('Network error. Please check your connection and try again.');
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function handlePhoneSubmit(e: React.FormEvent) {
    e.preventDefault();
    const mode = await requestVerification();
    if (mode) setStep(mode);
  }

  async function handleOtpSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const code = otp.join('');
    if (code.length < 6) {
      setError('Enter the 6-digit verification code');
      return;
    }
    if (!requestId) {
      setError('Request a new verification code first');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/auth/forgot-passcode/verify-otp', {
        method: 'POST',
        headers: { accept: 'application/json', 'content-type': 'application/json' },
        body: JSON.stringify({ requestId, code }),
      });
      const data = await response.json().catch(() => null) as {
        verified?: boolean;
        resetToken?: string;
        message?: string;
      } | null;

      if (!response.ok || !data?.verified || !data?.resetToken) {
        setError(data?.message ?? 'Incorrect or expired verification code');
        return;
      }

      setResetToken(data.resetToken);
      setNewPasscode(['', '', '', '', '', '']);
      setConfirmPasscode(['', '', '', '', '', '']);
      setError('');
      setStep('reset');
    } catch {
      setError('Could not verify the code. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handlePinVerifySubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const cleanAcct = accountNumber.replace(/\D/g, '');
    const pinCode = txPin.join('');
    if (cleanAcct.length !== 10) {
      setError('Enter your 10-digit Vexa account number');
      return;
    }
    if (pinCode.length !== 4) {
      setError('Enter your 4-digit Transaction PIN');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/auth/forgot-passcode/verify-account', {
        method: 'POST',
        headers: { accept: 'application/json', 'content-type': 'application/json' },
        body: JSON.stringify({ requestId, accountNumber: cleanAcct, pin: pinCode }),
      });
      const data = await response.json().catch(() => null) as {
        verified?: boolean;
        resetToken?: string;
        message?: string;
      } | null;

      if (!response.ok || !data?.verified || !data?.resetToken) {
        setError(data?.message ?? 'Account number or Transaction PIN is incorrect');
        return;
      }

      setResetToken(data.resetToken);
      setNewPasscode(['', '', '', '', '', '']);
      setConfirmPasscode(['', '', '', '', '', '']);
      setError('');
      setStep('reset');
    } catch {
      setError('Could not verify your account. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResetSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const code = newPasscode.join('');
    const confirm = confirmPasscode.join('');
    if (code.length < 6) {
      setError('Enter a 6-digit new passcode');
      return;
    }
    if (confirm.length < 6) {
      setError('Confirm your new 6-digit passcode');
      return;
    }
    if (code !== confirm) {
      setError('Passcodes do not match');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/auth/forgot-passcode/reset', {
        method: 'POST',
        headers: { accept: 'application/json', 'content-type': 'application/json' },
        body: JSON.stringify({ resetToken, newPasscode: code }),
      });
      const data = await response.json().catch(() => null) as {
        success?: boolean;
        phone?: string;
        message?: string;
      } | null;

      if (!response.ok || !data?.success) {
        setError(data?.message ?? 'Could not reset your passcode. Please try again.');
        return;
      }

      const normalized = normalizeLoginPhone(data.phone || phone);
      clearLocalLockoutKeys(normalized);
      try {
        localStorage.setItem(LAST_PHONE_KEY, normalized);
      } catch {
        // Ignore storage errors
      }
      setStep('success');
    } catch {
      setError('Network error while updating your passcode. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleBack() {
    setError('');
    if (step === 'otp' || step === 'pin_verify') {
      setStep('phone');
    } else if (step === 'reset') {
      setStep('phone');
      setResetToken('');
    } else {
      navigate('/signin');
    }
  }

  /* ── Success screen ── */
  if (step === 'success') {
    return (
      <div className="theme-page fixed inset-0 flex flex-col items-center justify-center px-6" style={{ fontFamily: "'Inter', sans-serif" }}>
        <div className="dark:bg-[#13352D] w-20 h-20 rounded-full bg-green-50 flex items-center justify-center mb-5">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <p className="text-[22px] font-bold text-[#111] mb-2">Passcode Reset!</p>
        <p className="text-[13px] text-[#888] text-center mb-8 leading-relaxed max-w-xs">
          Your Vexa login passcode has been updated. You can now sign in with your new 6-digit passcode.
        </p>
        <button
          type="button"
          onClick={() => navigate('/signin')}
          className="w-full max-w-xs bg-[#F0B90B] hover:bg-[#FCD535] active:bg-[#DDAA09] text-[#181A20] rounded-xl h-[52px] text-[15px] font-bold shadow-sm transition-all active:scale-[0.98]"
        >
          Sign In Now
        </button>
      </div>
    );
  }

  const activeStepNumber = step === 'phone' ? 1 : (step === 'otp' || step === 'pin_verify') ? 2 : 3;

  return (
    <div className="theme-page fixed inset-0 bg-[#F2F3F5] flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Top obsidian header */}
      <div className="bg-[#162353] px-6 pt-12 pb-10 flex flex-col items-center relative">
        <button
          type="button"
          onClick={handleBack}
          aria-label="Go back"
          className="absolute left-4 top-12 w-9 h-9 flex items-center justify-center rounded-full bg-white/10"
        >
          <ChevronLeft className="w-5 h-5 text-white" />
        </button>
        <img src="/assets/aistudio/c4e1e122-cd74-4d18-b5b5-37dafb3a53f6_e2d23c37.png" alt="Vexa" className="h-14 sm:h-16 mb-2.5 object-contain drop-shadow-lg" />
        <p className="text-white/75 text-[13px]">Passcode Recovery</p>
      </div>

      {/* Card */}
      <div
        className="theme-surface flex-1 flex flex-col bg-white mx-0 rounded-t-3xl -mt-4 px-6 pt-7 overflow-y-auto"
        style={{ scrollbarWidth: 'none', paddingBottom: 'max(env(safe-area-inset-bottom), 28px)' }}
      >
        {/* 3-step indicator */}
        <div className="flex items-center gap-2 mb-6">
          {[1, 2, 3].map(n => (
            <div
              key={n}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                n <= activeStepNumber ? 'bg-[#F0B90B]' : 'bg-[#E5E7EB] dark:bg-white/10'
              }`}
            />
          ))}
        </div>

        {/* Step 1: Enter Phone */}
        {step === 'phone' && (
          <>
            <h1 className="text-[22px] font-bold text-[#111] mb-1">Forgot Passcode?</h1>
            <p className="text-[13px] text-[#888] mb-6 leading-relaxed">
              Enter your registered phone number to verify your account and set a new 6-digit passcode.
            </p>

            {error && (
              <div className="mb-5 bg-red-50 rounded-xl px-4 py-3 text-[13px] text-red-600 font-medium">
                {error}
              </div>
            )}

            <form onSubmit={handlePhoneSubmit} className="space-y-5">
              <div>
                <label className="text-[12px] font-semibold text-[#444] mb-1.5 block">Phone Number</label>
                <div className="flex gap-2 relative" ref={pickerRef}>
                  <button
                    type="button"
                    onClick={() => setShowPicker(p => !p)}
                    className="theme-field h-[50px] px-3 rounded-xl flex items-center gap-1.5 shrink-0 hover:bg-[#E8EDF3] focus:outline-none transition-colors"
                  >
                    <span className="text-[18px]">{countryCode.flag}</span>
                    <span className="theme-brand-text text-[13px] font-bold">{countryCode.code}</span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                  {showPicker && (
                    <div className="absolute left-0 top-[54px] z-50 bg-white rounded-2xl shadow-xl overflow-hidden w-52">
                      {COUNTRY_CODES.map(c => (
                        <button
                          key={c.code}
                          type="button"
                          onClick={() => { setCountryCode(c); setShowPicker(false); }}
                          className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#EEF2F7] transition-colors ${c.code === countryCode.code ? 'theme-selected-control' : ''}`}
                        >
                          <span className="text-[18px]">{c.flag}</span>
                          <span className="text-[13px] font-semibold text-[#111]">{c.name}</span>
                          <span className="theme-brand-text ml-auto text-[12px] font-bold">{c.code}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  <input
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    placeholder="08012345678"
                    value={phone}
                    onChange={e => { setPhone(e.target.value); setError(''); }}
                    className="theme-field flex-1 h-[50px] rounded-xl px-4 text-[14px] placeholder-[#8994A5] focus:outline-none focus:ring-0 transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || phone.replace(/\D/g, '').length < 10}
                className="w-full h-[52px] rounded-xl bg-[#F0B90B] hover:bg-[#FCD535] active:bg-[#DDAA09] text-[#181A20] text-[15px] font-bold shadow-sm disabled:opacity-45 transition-all active:scale-[0.98]"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40 20" />
                    </svg>
                    Continuing…
                  </span>
                ) : 'Continue'}
              </button>
            </form>

            <p className="text-center text-[13px] text-[#888] mt-auto pt-8">
              Remember your passcode?{' '}
              <button type="button" onClick={() => navigate('/signin')} className="theme-brand-text font-bold">
                Sign In
              </button>
            </p>
          </>
        )}

        {/* Step 2a: Verify OTP */}
        {step === 'otp' && (
          <>
            <h1 className="text-[22px] font-bold text-[#111] mb-1">Verify your number</h1>
            <p className="text-[13px] text-[#888] mb-1.5">We sent a 6-digit code to</p>
            <p className="text-[14px] font-semibold text-[#111] mb-5">{maskedPhone || phone}</p>

            <div className="theme-control w-full mb-5 rounded-xl px-4 py-3">
              <p className="theme-brand-text text-[11px] font-semibold">
                {isDemoOtp ? 'Test verification mode active' : 'Verification code sent by SMS'}
              </p>
              <p className="text-[10px] text-[#888] mt-1">
                The code expires in 10 minutes. Do not share it with anyone.
              </p>
            </div>

            {error && (
              <div className="mb-5 bg-red-50 rounded-xl px-4 py-3 text-[13px] text-red-600 font-medium">
                {error}
              </div>
            )}

            <form onSubmit={handleOtpSubmit} className="space-y-5">
              <div>
                <label className="text-[12px] font-semibold text-[#444] mb-1.5 block">Enter Verification Code</label>
                <PinBoxes value={otp} onChange={v => { setOtp(v); setError(''); }} disabled={loading} />
              </div>

              <button
                type="submit"
                disabled={loading || otp.some(d => d === '')}
                className="w-full h-[52px] rounded-xl bg-[#F0B90B] hover:bg-[#FCD535] active:bg-[#DDAA09] text-[#181A20] text-[15px] font-bold shadow-sm disabled:opacity-45 transition-all active:scale-[0.98]"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40 20" />
                    </svg>
                    Verifying…
                  </span>
                ) : 'Verify Code'}
              </button>
            </form>

            <div className="mt-5 text-center">
              {resendTimer > 0 ? (
                <p className="text-[12px] text-[#888]">
                  Resend code in <span className="theme-brand-text font-semibold tabular-nums">{resendTimer}s</span>
                </p>
              ) : (
                <button
                  type="button"
                  onClick={() => { void requestVerification(); }}
                  disabled={loading}
                  className="theme-brand-text text-[12px] font-semibold"
                >
                  Resend Verification Code
                </button>
              )}
            </div>
          </>
        )}

        {/* Step 2b: Verify Account Number + Transaction PIN (when SMS is unavailable) */}
        {step === 'pin_verify' && (
          <>
            <h1 className="text-[22px] font-bold text-[#111] mb-1">Verify your account</h1>
            <p className="text-[13px] text-[#888] mb-5 leading-relaxed">
              Account: <span className="font-semibold text-[#111]">{maskedPhone || phone}</span>
            </p>

            {fallbackNotice && (
              <div className="theme-control w-full mb-5 rounded-xl px-4 py-3">
                <p className="theme-brand-text text-[11px] font-semibold">Security Verification</p>
                <p className="text-[11px] text-[#666] mt-1 leading-relaxed">{fallbackNotice}</p>
              </div>
            )}

            {error && (
              <div className="mb-5 bg-red-50 rounded-xl px-4 py-3 text-[13px] text-red-600 font-medium">
                {error}
              </div>
            )}

            <form onSubmit={handlePinVerifySubmit} className="space-y-5">
              <div>
                <label className="text-[12px] font-semibold text-[#444] mb-1.5 block">10-Digit Vexa Account Number</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="9XXXXXXXXX"
                  value={accountNumber}
                  onChange={e => { setAccountNumber(e.target.value.replace(/\D/g, '').slice(0, 10)); setError(''); }}
                  disabled={loading}
                  className="theme-field w-full h-[50px] rounded-xl px-4 text-[15px] font-semibold tracking-wider placeholder-[#8994A5] focus:outline-none focus:ring-0 transition-colors"
                />
              </div>

              <div>
                <label className="text-[12px] font-semibold text-[#444] mb-1.5 block">4-Digit Transaction PIN</label>
                <PinBoxes value={txPin} onChange={v => { setTxPin(v); setError(''); }} disabled={loading} masked />
              </div>

              <button
                type="submit"
                disabled={loading || accountNumber.length !== 10 || txPin.some(d => d === '')}
                className="w-full h-[52px] rounded-xl bg-[#F0B90B] hover:bg-[#FCD535] active:bg-[#DDAA09] text-[#181A20] text-[15px] font-bold shadow-sm disabled:opacity-45 transition-all active:scale-[0.98]"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40 20" />
                    </svg>
                    Verifying…
                  </span>
                ) : 'Verify & Continue'}
              </button>
            </form>
          </>
        )}

        {/* Step 3: Set New Passcode */}
        {step === 'reset' && (
          <>
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="w-5 h-5 text-[#16A34A] shrink-0" />
              <h1 className="text-[22px] font-bold text-[#111]">Create new passcode</h1>
            </div>
            <p className="text-[13px] text-[#888] mb-6 leading-relaxed">
              Identity verified. Enter a new 6-digit login passcode for your Vexa account.
            </p>

            {error && (
              <div className="mb-5 bg-red-50 rounded-xl px-4 py-3 text-[13px] text-red-600 font-medium">
                {error}
              </div>
            )}

            <form onSubmit={handleResetSubmit} className="space-y-5">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[12px] font-semibold text-[#444]">New Passcode</label>
                  <button
                    type="button"
                    onClick={() => setShowPasscode(v => !v)}
                    className="theme-brand-text text-[12px] font-semibold inline-flex items-center gap-1"
                  >
                    {showPasscode ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    {showPasscode ? 'Hide' : 'Show'}
                  </button>
                </div>
                <PinBoxes
                  value={newPasscode}
                  onChange={v => { setNewPasscode(v); setError(''); }}
                  disabled={loading}
                  masked={!showPasscode}
                />
              </div>

              <div>
                <label className="text-[12px] font-semibold text-[#444] mb-1.5 block">Confirm New Passcode</label>
                <PinBoxes
                  value={confirmPasscode}
                  onChange={v => { setConfirmPasscode(v); setError(''); }}
                  disabled={loading}
                  masked={!showPasscode}
                />
              </div>

              <button
                type="submit"
                disabled={loading || newPasscode.some(d => d === '') || confirmPasscode.some(d => d === '')}
                className="w-full h-[52px] rounded-xl bg-[#F0B90B] hover:bg-[#FCD535] active:bg-[#DDAA09] text-[#181A20] text-[15px] font-bold shadow-sm disabled:opacity-45 transition-all active:scale-[0.98]"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40 20" />
                    </svg>
                    Updating Passcode…
                  </span>
                ) : 'Reset Passcode'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
