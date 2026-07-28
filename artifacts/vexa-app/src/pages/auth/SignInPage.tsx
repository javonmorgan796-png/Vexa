import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/context/AuthContext';

const COUNTRY_CODES = [
  { flag: '🇳🇬', code: '+234', name: 'Nigeria' },
];

export default function SignInPage() {
  const [, navigate] = useLocation();
  const { signIn } = useAuth();
  const [phone, setPhone] = useState('');
  const [countryCode, setCountryCode] = useState(COUNTRY_CODES[0]);
  const [showPicker, setShowPicker] = useState(false);
  const [passcode, setPasscode] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [fingerprintLoading, setFingerprintLoading] = useState(false);
  const [fingerprintSuccess, setFingerprintSuccess] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    }
    if (showPicker) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPicker]);

  function handleDigit(idx: number, val: string) {
    const digit = val.replace(/\D/g, '').slice(-1);
    const next = [...passcode];
    next[idx] = digit;
    setPasscode(next);
    setError('');
    if (digit && idx < 5) {
      inputRefs.current[idx + 1]?.focus();
    }
  }

  function handleKeyDown(idx: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      if (passcode[idx]) {
        const next = [...passcode];
        next[idx] = '';
        setPasscode(next);
      } else if (idx > 0) {
        inputRefs.current[idx - 1]?.focus();
        const next = [...passcode];
        next[idx - 1] = '';
        setPasscode(next);
      }
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const next = ['', '', '', '', '', ''];
    text.split('').forEach((ch, i) => { next[i] = ch; });
    setPasscode(next);
    const focusIdx = Math.min(text.length, 5);
    inputRefs.current[focusIdx]?.focus();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) { setError('Enter a valid phone number'); return; }
    const code = passcode.join('');
    if (code.length < 6) { setError('Enter your 6-digit passcode'); return; }
    setLoading(true);
    setTimeout(() => {
      const res = signIn(phone, code);
      setLoading(false);
      if (res.success) navigate('/');
      else setError(res.error ?? 'Sign in failed');
    }, 900);
  }

  function handleFingerprint() {
    setFingerprintLoading(true);
    setTimeout(() => {
      setFingerprintLoading(false);
      setFingerprintSuccess(true);
      setTimeout(() => {
        const res = signIn('08067212032', '123456');
        if (res.success) navigate('/');
        else setFingerprintSuccess(false);
      }, 800);
    }, 1400);
  }

  const passcodeComplete = passcode.every(d => d !== '');

  return (
    <div className="fixed inset-0 bg-[#F2F3F5] flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Top navy header */}
      <div className="bg-[#162353] px-6 pt-14 pb-10 flex flex-col items-center">
        <img src="/vexa-logo.png" alt="Vexa" className="h-28 mb-3 object-contain drop-shadow-lg" />
        <p className="text-white/70 text-[13px]">Sign in to your account</p>
      </div>

      {/* Card */}
      <div className="flex-1 bg-white mx-0 rounded-t-3xl -mt-4 px-6 pt-8 pb-10 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        <h1 className="text-[22px] font-bold text-[#111] mb-1">Welcome back 👋</h1>
        <p className="text-[13px] text-[#888] mb-7">Enter your credentials to continue</p>

        {error && (
          <div className="mb-5 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-[13px] text-red-600 font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Phone Number with country picker */}
          <div>
            <label className="text-[12px] font-semibold text-[#444] mb-1.5 block">Phone Number</label>
            <div className="flex gap-2 relative" ref={pickerRef}>
              {/* Country code button */}
              <button
                type="button"
                onClick={() => setShowPicker(p => !p)}
                className="h-[50px] px-3 rounded-xl border border-[#E2E8F0] bg-[#F8F9FB] flex items-center gap-1.5 shrink-0 hover:border-[#162353] transition-colors"
              >
                <span className="text-[18px]">{countryCode.flag}</span>
                <span className="text-[13px] font-bold text-[#162353]">{countryCode.code}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
              </button>

              {/* Dropdown */}
              {showPicker && (
                <div className="absolute left-0 top-[54px] z-50 bg-white rounded-2xl border border-[#E2E8F0] shadow-xl overflow-hidden w-52">
                  {COUNTRY_CODES.map(c => (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => { setCountryCode(c); setShowPicker(false); }}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#F8F9FB] transition-colors ${c.code === countryCode.code ? 'bg-[#F0F4FF]' : ''}`}
                    >
                      <span className="text-[18px]">{c.flag}</span>
                      <span className="text-[13px] font-semibold text-[#111]">{c.name}</span>
                      <span className="ml-auto text-[12px] font-bold text-[#162353]">{c.code}</span>
                    </button>
                  ))}
                </div>
              )}

              <input
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                placeholder="Phone Number"
                value={phone}
                onChange={e => { setPhone(e.target.value); setError(''); }}
                className="flex-1 h-[50px] rounded-xl border border-[#E2E8F0] bg-[#F8F9FB] px-4 text-[14px] text-[#111] placeholder-[#C0C8D4] focus:outline-none focus:border-[#162353] focus:bg-white transition-colors"
              />
            </div>
          </div>

          {/* 6-digit Passcode */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[12px] font-semibold text-[#444]">Passcode</label>
              <button type="button" className="text-[12px] text-[#162353] font-semibold">
                Forgot Passcode?
              </button>
            </div>
            <div className="flex gap-2.5 justify-between" onPaste={handlePaste}>
              {passcode.map((digit, idx) => (
                <input
                  key={idx}
                  ref={el => { inputRefs.current[idx] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={e => handleDigit(idx, e.target.value)}
                  onKeyDown={e => handleKeyDown(idx, e)}
                  className="w-full h-[52px] rounded-xl border-2 border-[#E2E8F0] bg-[#F8F9FB] text-center text-[20px] font-bold text-[#111] focus:outline-none focus:border-[#162353] focus:bg-white transition-colors caret-transparent"
                  style={{ maxWidth: 52 }}
                />
              ))}
            </div>
          </div>

          {/* CTA */}
          <button
            type="submit"
            disabled={loading || !passcodeComplete}
            className="w-full h-[52px] rounded-xl bg-[#162353] text-white text-[15px] font-bold mt-2 disabled:opacity-60 transition-opacity active:scale-[0.98]"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="3" strokeDasharray="40 20" />
                </svg>
                Signing in…
              </span>
            ) : 'Sign In'}
          </button>
        </form>

        {/* Fingerprint Sign In */}
        <button
          type="button"
          onClick={handleFingerprint}
          disabled={fingerprintLoading || fingerprintSuccess}
          className="w-full h-[52px] mt-4 rounded-xl border-2 border-[#162353] flex items-center justify-center gap-3 text-[#162353] text-[14px] font-semibold transition-all active:scale-[0.98] disabled:opacity-70"
        >
          {fingerprintLoading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin w-5 h-5 text-[#162353]" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="#162353" strokeWidth="3" strokeDasharray="40 20" />
              </svg>
              Scanning…
            </span>
          ) : fingerprintSuccess ? (
            <span className="flex items-center gap-2 text-green-600">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              Verified!
            </span>
          ) : (
            <>
              <i className="fa-solid fa-fingerprint text-[22px] text-[#162353]" />
              Sign in with Fingerprint
            </>
          )}
        </button>

        {/* Demo hint */}
        <div className="mt-6 bg-[#F0F4FF] rounded-xl px-4 py-3">
          <p className="text-[11px] text-[#162353] font-semibold mb-0.5">Demo credentials</p>
          <p className="text-[11px] text-[#555]">Phone: 08067212032</p>
          <p className="text-[11px] text-[#555]">Passcode: 123456</p>
        </div>

        {/* Sign up link */}
        <p className="text-center text-[13px] text-[#888] mt-6">
          Don't have an account?{' '}
          <button onClick={() => navigate('/signup')} className="text-[#162353] font-bold">
            Create Account
          </button>
        </p>
      </div>
    </div>
  );
}
