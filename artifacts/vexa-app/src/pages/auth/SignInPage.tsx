import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function SignInPage() {
  const [, navigate] = useLocation();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!email.trim()) { setError('Please enter your email'); return; }
    if (!password) { setError('Please enter your password'); return; }
    setLoading(true);
    setTimeout(() => {
      const res = signIn(email.trim(), password);
      setLoading(false);
      if (res.success) navigate('/');
      else setError(res.error ?? 'Sign in failed');
    }, 900);
  }

  return (
    <div className="fixed inset-0 bg-[#F2F3F5] flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Top navy header */}
      <div className="bg-[#162353] px-6 pt-14 pb-10 flex flex-col items-center">
        <img src="/vexa-logo.png" alt="Vexa" className="h-10 mb-3 object-contain" />
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

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div>
            <label className="text-[12px] font-semibold text-[#444] mb-1.5 block">Email Address</label>
            <input
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => { setEmail(e.target.value); setError(''); }}
              className="w-full h-[50px] rounded-xl border border-[#E2E8F0] bg-[#F8F9FB] px-4 text-[14px] text-[#111] placeholder-[#C0C8D4] focus:outline-none focus:border-[#162353] focus:bg-white transition-colors"
            />
          </div>

          {/* Password */}
          <div>
            <label className="text-[12px] font-semibold text-[#444] mb-1.5 block">Password</label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }}
                className="w-full h-[50px] rounded-xl border border-[#E2E8F0] bg-[#F8F9FB] px-4 pr-12 text-[14px] text-[#111] placeholder-[#C0C8D4] focus:outline-none focus:border-[#162353] focus:bg-white transition-colors"
              />
              <button type="button" onClick={() => setShowPass(v => !v)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#999] p-1">
                {showPass ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
              </button>
            </div>
            <div className="flex justify-end mt-1.5">
              <button type="button" className="text-[12px] text-[#162353] font-semibold">
                Forgot password?
              </button>
            </div>
          </div>

          {/* CTA */}
          <button type="submit" disabled={loading}
            className="w-full h-[52px] rounded-xl bg-[#162353] text-white text-[15px] font-bold mt-2 disabled:opacity-60 transition-opacity active:scale-[0.98]">
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

        {/* Demo hint */}
        <div className="mt-6 bg-[#F0F4FF] rounded-xl px-4 py-3">
          <p className="text-[11px] text-[#162353] font-semibold mb-0.5">Demo credentials</p>
          <p className="text-[11px] text-[#555]">Email: chibuzor@vexa.com</p>
          <p className="text-[11px] text-[#555]">Password: vexa1234</p>
        </div>

        {/* Sign up link */}
        <p className="text-center text-[13px] text-[#888] mt-7">
          Don't have an account?{' '}
          <button onClick={() => navigate('/signup')} className="text-[#162353] font-bold">
            Create Account
          </button>
        </p>
      </div>
    </div>
  );
}
