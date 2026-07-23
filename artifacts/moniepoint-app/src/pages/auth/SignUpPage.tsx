import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { Eye, EyeOff, ChevronLeft } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function SignUpPage() {
  const [, navigate] = useLocation();
  const { signUp } = useAuth();
  const [step, setStep] = useState<'form' | 'success'>('form');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showConf, setShowConf] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function validate() {
    if (!name.trim()) return 'Full name is required';
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Enter a valid email address';
    if (!phone.trim() || phone.replace(/\D/g,'').length < 10) return 'Enter a valid phone number';
    if (password.length < 6) return 'Password must be at least 6 characters';
    if (password !== confirm) return 'Passwords do not match';
    return null;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const err = validate();
    if (err) { setError(err); return; }
    setLoading(true);
    setTimeout(() => {
      const res = signUp(name.trim(), email.trim(), phone.trim(), password);
      setLoading(false);
      if (res.success) setStep('success');
      else setError(res.error ?? 'Registration failed');
    }, 1000);
  }

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

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Full Name */}
          <div>
            <label className="text-[12px] font-semibold text-[#444] mb-1.5 block">Full Name</label>
            <input type="text" autoComplete="name" placeholder="e.g. Chidi Emmanuel Obi"
              value={name} onChange={e => { setName(e.target.value); setError(''); }}
              className="w-full h-[50px] rounded-xl border border-[#E2E8F0] bg-[#F8F9FB] px-4 text-[14px] text-[#111] placeholder-[#C0C8D4] focus:outline-none focus:border-[#162353] focus:bg-white transition-colors" />
          </div>

          {/* Email */}
          <div>
            <label className="text-[12px] font-semibold text-[#444] mb-1.5 block">Email Address</label>
            <input type="email" autoComplete="email" placeholder="you@example.com"
              value={email} onChange={e => { setEmail(e.target.value); setError(''); }}
              className="w-full h-[50px] rounded-xl border border-[#E2E8F0] bg-[#F8F9FB] px-4 text-[14px] text-[#111] placeholder-[#C0C8D4] focus:outline-none focus:border-[#162353] focus:bg-white transition-colors" />
          </div>

          {/* Phone */}
          <div>
            <label className="text-[12px] font-semibold text-[#444] mb-1.5 block">Phone Number</label>
            <input type="tel" autoComplete="tel" placeholder="080XXXXXXXX"
              value={phone} onChange={e => { setPhone(e.target.value); setError(''); }}
              className="w-full h-[50px] rounded-xl border border-[#E2E8F0] bg-[#F8F9FB] px-4 text-[14px] text-[#111] placeholder-[#C0C8D4] focus:outline-none focus:border-[#162353] focus:bg-white transition-colors" />
          </div>

          {/* Password */}
          <div>
            <label className="text-[12px] font-semibold text-[#444] mb-1.5 block">Password</label>
            <div className="relative">
              <input type={showPass ? 'text' : 'password'} autoComplete="new-password"
                placeholder="At least 6 characters"
                value={password} onChange={e => { setPassword(e.target.value); setError(''); }}
                className="w-full h-[50px] rounded-xl border border-[#E2E8F0] bg-[#F8F9FB] px-4 pr-12 text-[14px] text-[#111] placeholder-[#C0C8D4] focus:outline-none focus:border-[#162353] focus:bg-white transition-colors" />
              <button type="button" onClick={() => setShowPass(v => !v)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#999] p-1">
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="text-[12px] font-semibold text-[#444] mb-1.5 block">Confirm Password</label>
            <div className="relative">
              <input type={showConf ? 'text' : 'password'} autoComplete="new-password"
                placeholder="Re-enter your password"
                value={confirm} onChange={e => { setConfirm(e.target.value); setError(''); }}
                className="w-full h-[50px] rounded-xl border border-[#E2E8F0] bg-[#F8F9FB] px-4 pr-12 text-[14px] text-[#111] placeholder-[#C0C8D4] focus:outline-none focus:border-[#162353] focus:bg-white transition-colors" />
              <button type="button" onClick={() => setShowConf(v => !v)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#999] p-1">
                {showConf ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
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
                Creating account…
              </span>
            ) : 'Create Account'}
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
