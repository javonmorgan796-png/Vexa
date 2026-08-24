import React, { useEffect, useState } from 'react';
import { CheckCircle2, ChevronLeft, LockKeyhole, MessageSquareText, ShieldCheck } from 'lucide-react';
import { useLocation } from 'wouter';
import { useAuth } from '@/context/AuthContext';

export default function TwoFactorSettingsPage() {
  const [, navigate] = useLocation();
  const { user, sendTwoFactorCode, verifyTwoFactorCode, updateTwoFactorEnabled } = useAuth();
  const [step, setStep] = useState<'idle' | 'code'>('idle');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    setStep('idle');
    setCode('');
    setError('');
  }, [user?.twoFactorEnabled]);

  const enable = async () => {
    setBusy(true); setError(''); setMessage('');
    const result = await sendTwoFactorCode();
    setBusy(false);
    if (!result.success) return setError(result.error ?? 'SMS could not be sent');
    setStep('code');
    setMessage(`We sent a verification code to ${user?.phone ?? 'your phone'}.`);
  };

  const verify = async () => {
    if (code.length !== 6) return setError('Enter the 6-digit SMS code');
    setBusy(true); setError('');
    const verification = await verifyTwoFactorCode(code);
    if (!verification.success) {
      setBusy(false);
      return setError(verification.error ?? 'Verification failed');
    }
    const saved = await updateTwoFactorEnabled(true);
    setBusy(false);
    if (!saved.success) return setError(saved.error ?? 'Could not enable two-factor authentication');
    setMessage('Two-factor authentication is now enabled for this account.');
    setStep('idle');
    setCode('');
  };

  const disable = async () => {
    setBusy(true); setError('');
    const result = await updateTwoFactorEnabled(false);
    setBusy(false);
    if (!result.success) return setError(result.error ?? 'Could not disable two-factor authentication');
    setMessage('Two-factor authentication has been disabled.');
  };

  return (
    <div className="fixed inset-0 bg-[#F2F3F5] flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="flex-none flex items-center gap-3 px-4 pb-3 bg-white border-b border-[#E8EBF0]" style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}>
        <button onClick={() => navigate('/settings')} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"><ChevronLeft className="w-5 h-5" /></button>
        <span className="text-[16px] font-bold text-[#111]">Two-factor authentication</span>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4" style={{ scrollbarWidth: 'none' }}>
        <div className="rounded-3xl bg-[#162353] text-white p-5">
          <div className="flex items-center gap-3"><div className="w-11 h-11 rounded-2xl bg-white/10 flex items-center justify-center"><i className="fa-solid fa-key text-[22px] text-[#8BE3FF]" aria-hidden="true" /></div><div><p className="text-[16px] font-bold">Protect your Vexa account</p><p className="text-[11px] text-white/60 mt-1">A one-time SMS code will be required when you sign in.</p></div></div>
        </div>
        {error && <div className="rounded-2xl bg-red-50 border border-red-200 px-4 py-3 text-[12px] text-red-600">{error}</div>}
        {message && <div className="rounded-2xl bg-green-50 border border-green-200 px-4 py-3 text-[12px] text-green-700">{message}</div>}
        <div className="bg-white rounded-2xl border border-[#F0F0F0] p-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#EEF2FF] text-[#162353] flex items-center justify-center"><MessageSquareText className="w-5 h-5" /></div>
            <div className="flex-1"><p className="text-[14px] font-bold text-[#111]">SMS verification</p><p className="text-[12px] text-[#777] mt-1">Codes will be sent to <b>{user?.phone || 'your saved phone number'}</b>.</p></div>
            <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${user?.twoFactorEnabled ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{user?.twoFactorEnabled ? 'On' : 'Off'}</span>
          </div>
          {!user?.twoFactorEnabled && step === 'idle' && <button disabled={busy} onClick={() => void enable()} className="w-full mt-5 rounded-xl bg-[#162353] text-white py-3.5 text-[13px] font-bold disabled:opacity-50">{busy ? 'Sending code…' : 'Enable SMS 2FA'}</button>}
          {!user?.twoFactorEnabled && step === 'code' && (
            <div className="mt-5 space-y-3">
              <div className="flex items-center gap-2"><LockKeyhole className="w-4 h-4 text-[#2563EB]" /><p className="text-[12px] font-semibold text-[#444]">Enter the 6-digit code</p></div>
              <input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoFocus placeholder="000000" className="w-full text-center tracking-[0.5em] text-[22px] font-bold border border-[#E0E0E0] rounded-xl px-4 py-3 outline-none focus:border-[#162353]" />
              <button disabled={busy || code.length !== 6} onClick={() => void verify()} className="w-full rounded-xl bg-[#162353] text-white py-3.5 text-[13px] font-bold disabled:opacity-50">{busy ? 'Verifying…' : 'Verify and enable'}</button>
              <button disabled={busy} onClick={() => void enable()} className="w-full text-[#2563EB] text-[12px] font-semibold">Resend code</button>
            </div>
          )}
          {user?.twoFactorEnabled && <div className="mt-5 flex items-center gap-2 text-[12px] text-green-700 font-semibold"><CheckCircle2 className="w-4 h-4" /> SMS 2FA is active</div>}
          {user?.twoFactorEnabled && <button disabled={busy} onClick={() => void disable()} className="w-full mt-5 rounded-xl border border-red-200 text-red-600 py-3.5 text-[13px] font-bold disabled:opacity-50">{busy ? 'Updating…' : 'Disable SMS 2FA'}</button>}
        </div>
        <div className="rounded-2xl bg-white border border-[#F0F0F0] px-4 py-4 text-[11px] text-[#777] leading-relaxed">SMS delivery must be enabled for your Supabase project under Authentication → Providers → Phone. If it is not configured, Vexa will not enable the setting and no code is stored in the browser.</div>
      </div>
    </div>
  );
}