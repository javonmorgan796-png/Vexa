import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from 'wouter';
import { ChevronLeft } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

/* Reusable 6-box PIN input */
function PinBoxes({
  value,
  onChange,
  disabled,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  disabled?: boolean;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  function handleDigit(idx: number, val: string) {
    const digit = val.replace(/\D/g, '').slice(-1);
    const next = [...value];
    next[idx] = digit;
    onChange(next);
    if (digit && idx < 5) refs.current[idx + 1]?.focus();
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
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const next = ['', '', '', '', '', ''];
    text.split('').forEach((ch, i) => { next[i] = ch; });
    onChange(next);
    const focusIdx = Math.min(text.length, 5);
    refs.current[focusIdx]?.focus();
  }

  return (
    <div className="flex gap-2.5 justify-between" onPaste={handlePaste}>
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
          className="w-full h-[52px] rounded-xl border-2 border-[#E2E8F0] bg-[#F8F9FB] text-center text-[20px] font-bold text-[#111] focus:outline-none focus:border-[#162353] focus:bg-white transition-colors caret-transparent disabled:opacity-50"
          style={{ maxWidth: 52 }}
        />
      ))}
    </div>
  );
}

export default function SignUpPage() {
  const [, navigate] = useLocation();
  const { signUp } = useAuth();
  const [step, setStep] = useState<'form' | 'otp' | 'success'>('form');

  // Form fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [passcode, setPasscode] = useState(['', '', '', '', '', '']);
  const [confirmPasscode, setConfirmPasscode] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // OTP step
  const [otpCode] = useState(() => String(Math.floor(100000 + Math.random() * 900000)));
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [otpError, setOtpError] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(30);

  useEffect(() => {
    if (step !== 'otp') return;
    if (resendTimer <= 0) return;
    const t = setInterval(() => setResendTimer(v => v - 1), 1000);
    return () => clearInterval(t);
  }, [step, resendTimer]);

  function validate() {
    if (!name.trim()) return 'Full name is required';
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) return 'Enter a valid phone number';
    if (passcode.some(d => d === '')) return 'Enter a 6-digit passcode';
    if (confirmPasscode.some(d => d === '')) return 'Confirm your passcode';
    if (passcode.join('') !== confirmPasscode.join('')) return 'Passcodes do not match';
    return null;
  }

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const err = validate();
    if (err) { setError(err); return; }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setResendTimer(30);
      setStep('otp');
    }, 800);
  }

  function handleOtpSubmit(e: React.FormEvent) {
    e.preventDefault();
    setOtpError('');
    const entered = otp.join('');
    if (entered.length < 6) { setOtpError('Enter the 6-digit OTP'); return; }
    if (entered !== otpCode) { setOtpError('Incorrect OTP. Please try again.'); return; }
    setOtpLoading(true);
    setTimeout(() => {
      const res = signUp(name.trim(), phone.trim(), passcode.join(''));
      setOtpLoading(false);
      if (res.success) setStep('success');
      else setOtpError(res.error ?? 'Registration failed');
    }, 1000);
  }

  /* ── Success screen ── */
  if (step === 'success') {
    return (
      <div className="fixed inset-0 bg-white flex flex-col items-center justify-center px-6" style={{ fontFamily: "'Inter', sans-serif" }}>
        <div className="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center mb-5">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <p className="text-[22px] font-bold text-[#111] mb-2">Account Created!</p>
        <p className="text-[13px] text-[#888] text-center mb-8 leading-relaxed">
          Welcome to Vexa, {name.split(' ')[0]}!<br/>Your account is ready to use.
        </p>
        <button onClick={() => navigate('/')}
          className="w-full max-w-xs bg-[#162353] rounded-xl h-[52px] text-[15px] font-bold text-white">
          Go to Dashboard
        </button>
      </div>
    );
  }

  /* ── OTP verification screen ── */
  if (step === 'otp') {
    return (
      <div className="fixed inset-0 bg-[#F2F3F5] flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>
        {/* Top navy header */}
        <div className="bg-[#162353] px-6 pt-12 pb-10 flex flex-col items-center relative">
          <button onClick={() => setStep('form')}
            className="absolute left-4 top-12 w-9 h-9 flex items-center justify-center rounded-full bg-white/10">
            <ChevronLeft className="w-5 h-5 text-white" />
          </button>
          <img src="/vexa-logo.png" alt="Vexa" className="h-10 mb-3 object-contain" />
          <p className="text-white/70 text-[13px]">Phone Verification</p>
        </div>

        <div className="flex-1 bg-white mx-0 rounded-t-3xl -mt-4 px-6 pt-8 pb-10 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
          <h1 className="text-[22px] font-bold text-[#111] mb-1">Verify your number</h1>
          <p className="text-[13px] text-[#888] mb-2">
            We sent a 6-digit code to
          </p>
          <p className="text-[14px] font-semibold text-[#111] mb-6">{phone}</p>

          {/* Demo OTP banner */}
          <div className="mb-6 bg-[#F0F4FF] border border-[#C7D7FF] rounded-xl px-4 py-3">
            <p className="text-[11px] text-[#162353] font-semibold mb-0.5">Demo — your OTP</p>
            <p className="text-[22px] font-extrabold text-[#162353] tracking-[0.2em]">{otpCode}</p>
            <p className="text-[10px] text-[#888] mt-0.5">In a real app this would be sent via SMS</p>
          </div>

          {otpError && (
            <div className="mb-5 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-[13px] text-red-600 font-medium">
              {otpError}
            </div>
          )}

          <form onSubmit={handleOtpSubmit} className="space-y-5">
            <div>
              <label className="text-[12px] font-semibold text-[#444] mb-1.5 block">Enter OTP</label>
              <PinBoxes value={otp} onChange={v => { setOtp(v); setOtpError(''); }} />
            </div>

            <button type="submit" disabled={otpLoading || otp.some(d => d === '')}
              className="w-full h-[52px] rounded-xl bg-[#162353] text-white text-[15px] font-bold disabled:opacity-60 transition-opacity active:scale-[0.98]">
              {otpLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="3" strokeDasharray="40 20" />
                  </svg>
                  Verifying…
                </span>
              ) : 'Verify & Create Account'}
            </button>
          </form>

          <div className="mt-5 text-center">
            {resendTimer > 0 ? (
              <p className="text-[12px] text-[#888]">Resend OTP in <span className="font-semibold text-[#162353]">{resendTimer}s</span></p>
            ) : (
              <button
                onClick={() => { setResendTimer(30); setOtp(['', '', '', '', '', '']); setOtpError(''); }}
                className="text-[12px] text-[#162353] font-semibold"
              >
                Resend OTP
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ── Registration form ── */
  return (
    <div className="fixed inset-0 bg-[#F2F3F5] flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Top navy header */}
      <div className="bg-[#162353] px-6 pt-12 pb-10 flex flex-col items-center relative">
        <button onClick={() => navigate('/signin')}
          className="absolute left-4 top-12 w-9 h-9 flex items-center justify-center rounded-full bg-white/10">
          <ChevronLeft className="w-5 h-5 text-white" />
        </button>
        <img src="/vexa-logo.png" alt="Vexa" className="h-10 mb-3 object-contain" />
        <p className="text-white/70 text-[13px]">Create your account</p>
      </div>

      {/* Card */}
      <div className="flex-1 bg-white mx-0 rounded-t-3xl -mt-4 px-6 pt-8 pb-10 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        <h1 className="text-[22px] font-bold text-[#111] mb-1">Join Vexa ✨</h1>
        <p className="text-[13px] text-[#888] mb-7">Fill in your details to get started</p>

        {error && (
          <div className="mb-5 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-[13px] text-red-600 font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleFormSubmit} className="space-y-5">
          {/* Full Name */}
          <div>
            <label className="text-[12px] font-semibold text-[#444] mb-1.5 block">Full Name</label>
            <input type="text" autoComplete="name" placeholder="e.g. Chidi Emmanuel Obi"
              value={name} onChange={e => { setName(e.target.value); setError(''); }}
              className="w-full h-[50px] rounded-xl border border-[#E2E8F0] bg-[#F8F9FB] px-4 text-[14px] text-[#111] placeholder-[#C0C8D4] focus:outline-none focus:border-[#162353] focus:bg-white transition-colors" />
          </div>

          {/* Phone Number */}
          <div>
            <label className="text-[12px] font-semibold text-[#444] mb-1.5 block">Phone Number</label>
            <input type="tel" inputMode="numeric" autoComplete="tel" placeholder="Phone Number"
              value={phone} onChange={e => { setPhone(e.target.value); setError(''); }}
              className="w-full h-[50px] rounded-xl border border-[#E2E8F0] bg-[#F8F9FB] px-4 text-[14px] text-[#111] placeholder-[#C0C8D4] focus:outline-none focus:border-[#162353] focus:bg-white transition-colors" />
          </div>

          {/* 6-digit Passcode */}
          <div>
            <label className="text-[12px] font-semibold text-[#444] mb-1.5 block">Create Passcode</label>
            <PinBoxes value={passcode} onChange={v => { setPasscode(v); setError(''); }} />
          </div>

          {/* Confirm Passcode */}
          <div>
            <label className="text-[12px] font-semibold text-[#444] mb-1.5 block">Confirm Passcode</label>
            <PinBoxes value={confirmPasscode} onChange={v => { setConfirmPasscode(v); setError(''); }} />
          </div>

          {/* T&C note */}
          <p className="text-[11px] text-[#999] leading-relaxed">
            By creating an account you agree to Vexa's{' '}
            <span className="text-[#162353] font-semibold">Terms of Service</span> and{' '}
            <span className="text-[#162353] font-semibold">Privacy Policy</span>.
          </p>

          {/* CTA */}
          <button type="submit" disabled={loading}
            className="w-full h-[52px] rounded-xl bg-[#162353] text-white text-[15px] font-bold mt-1 disabled:opacity-60 transition-opacity active:scale-[0.98]">
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="3" strokeDasharray="40 20" />
                </svg>
                Sending OTP…
              </span>
            ) : 'Continue'}
          </button>
        </form>

        <p className="text-center text-[13px] text-[#888] mt-6">
          Already have an account?{' '}
          <button onClick={() => navigate('/signin')} className="text-[#162353] font-bold">Sign In</button>
        </p>
      </div>
    </div>
  );
}
