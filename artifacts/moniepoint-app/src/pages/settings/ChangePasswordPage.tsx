import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function ChangePasswordPage() {
  const [, navigate] = useLocation();
  const { updatePassword } = useAuth();
  const [current, setCurrent] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState({ current: false, new: false, confirm: false });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  function validate() {
    if (!current) return 'Enter your current password';
    if (newPass.length < 6) return 'New password must be at least 6 characters';
    if (newPass === current) return 'New password must be different from current';
    if (newPass !== confirm) return 'Passwords do not match';
    return null;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const err = validate();
    if (err) { setError(err); return; }
    setLoading(true);
    setTimeout(() => {
      const res = updatePassword(current, newPass);
      setLoading(false);
      if (res.success) setSuccess(true);
      else setError(res.error ?? 'Failed to update password');
    }, 900);
  }

  if (success) {
    return (
      <div className="fixed inset-0 bg-white flex flex-col items-center justify-center px-6" style={{ fontFamily: "'Inter', sans-serif" }}>
        <div className="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center mb-5">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <p className="text-[22px] font-bold text-[#111] mb-2">Password Updated!</p>
        <p className="text-[13px] text-[#888] text-center mb-8 leading-relaxed">
          Your password has been changed successfully.<br/>Use the new password next time you sign in.
        </p>
        <button onClick={() => navigate('/settings')}
          className="w-full max-w-xs bg-[#162353] rounded-xl h-[52px] text-[15px] font-bold text-white">
          Back to Settings
        </button>
      </div>
    );
  }

  type ShowKey = 'current' | 'new' | 'confirm';
  const fields: { key: ShowKey; label: string; value: string; setter: (v: string) => void; placeholder: string; autocomplete: string }[] = [
    { key: 'current', label: 'Current Password',  value: current, setter: setCurrent, placeholder: 'Enter current password',  autocomplete: 'current-password' },
    { key: 'new',     label: 'New Password',       value: newPass, setter: setNewPass, placeholder: 'At least 6 characters',   autocomplete: 'new-password' },
    { key: 'confirm', label: 'Confirm New Password', value: confirm, setter: setConfirm, placeholder: 'Re-enter new password', autocomplete: 'new-password' },
  ];

  // Password strength
  function strength(p: string) {
    if (!p) return null;
    let s = 0;
    if (p.length >= 6) s++;
    if (p.length >= 10) s++;
    if (/[A-Z]/.test(p)) s++;
    if (/[0-9]/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    if (s <= 1) return { label: 'Weak', color: '#EF4444', bars: 1 };
    if (s <= 3) return { label: 'Fair', color: '#F59E0B', bars: 2 };
    return { label: 'Strong', color: '#16A34A', bars: 3 };
  }
  const str = strength(newPass);

  return (
    <div className="fixed inset-0 bg-[#F2F3F5] flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div className="flex-none flex items-center gap-3 px-4 pb-3 bg-white border-b border-[#E8EBF0]"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}>
        <button onClick={() => navigate('/settings')} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <span className="text-[16px] font-bold text-[#111]">Change Password</span>
      </div>

      <div className="flex-1 overflow-y-auto py-6 px-5" style={{ scrollbarWidth: 'none' }}>
        {/* Icon */}
        <div className="flex flex-col items-center mb-7">
          <div className="w-16 h-16 rounded-2xl bg-[#EFF6FF] flex items-center justify-center mb-3">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#162353" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <p className="text-[15px] font-bold text-[#111]">Update your password</p>
          <p className="text-[12px] text-[#888] text-center mt-1">Choose a strong password to keep your account secure</p>
        </div>

        {error && (
          <div className="mb-5 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-[13px] text-red-600 font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {fields.map(f => (
            <div key={f.key}>
              <label className="text-[12px] font-semibold text-[#444] mb-1.5 block">{f.label}</label>
              <div className="relative">
                <input
                  type={show[f.key] ? 'text' : 'password'}
                  autoComplete={f.autocomplete}
                  placeholder={f.placeholder}
                  value={f.value}
                  onChange={e => { f.setter(e.target.value); setError(''); }}
                  className="w-full h-[50px] rounded-xl border border-[#E2E8F0] bg-[#F8F9FB] px-4 pr-12 text-[14px] text-[#111] placeholder-[#C0C8D4] focus:outline-none focus:border-[#162353] focus:bg-white transition-colors"
                />
                <button type="button"
                  onClick={() => setShow(s => ({ ...s, [f.key]: !s[f.key] }))}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#999] p-1">
                  {show[f.key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Strength meter for new password */}
              {f.key === 'new' && str && (
                <div className="mt-2">
                  <div className="flex gap-1 mb-1">
                    {[1,2,3].map(i => (
                      <div key={i} className="flex-1 h-1.5 rounded-full transition-all"
                        style={{ backgroundColor: i <= str.bars ? str.color : '#E2E8F0' }} />
                    ))}
                  </div>
                  <p className="text-[11px] font-semibold" style={{ color: str.color }}>{str.label} password</p>
                </div>
              )}
            </div>
          ))}

          {/* Tips */}
          <div className="bg-[#F0F4FF] rounded-xl px-4 py-3 mt-2">
            <p className="text-[11px] font-semibold text-[#162353] mb-1.5">Password tips</p>
            {[
              'Use at least 6 characters',
              'Mix uppercase & lowercase letters',
              'Include numbers and symbols',
            ].map((tip, i) => (
              <p key={i} className="text-[11px] text-[#555] flex items-start gap-1.5 mb-0.5">
                <span className="text-[#162353] mt-0.5">•</span> {tip}
              </p>
            ))}
          </div>

          <button type="submit" disabled={loading}
            className="w-full h-[52px] rounded-xl bg-[#162353] text-white text-[15px] font-bold mt-2 disabled:opacity-60 transition-opacity">
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="3" strokeDasharray="40 20" />
                </svg>
                Updating…
              </span>
            ) : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
