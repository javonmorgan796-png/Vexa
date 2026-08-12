import React, { useEffect, useState } from 'react';
import { LockKeyhole, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function TwoFactorChallenge() {
  const { user, sendTwoFactorCode, verifyTwoFactorCode, signOut } = useAuth();
  const [code, setCode] = useState('');
  const [status, setStatus] = useState('Sending a verification code…');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void sendTwoFactorCode().then(result => {
      setStatus(result.success ? `Enter the code sent to ${user?.phone ?? 'your phone'}.` : '');
      if (!result.success) setError(result.error ?? 'SMS could not be sent');
    });
  }, []);

  const verify = async () => {
    setBusy(true); setError('');
    const result = await verifyTwoFactorCode(code);
    setBusy(false);
    if (!result.success) setError(result.error ?? 'Verification failed');
  };

  return (
    <div className="fixed inset-0 z-[60] bg-[#F2F3F5] flex items-center justify-center px-5" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="w-full max-w-sm bg-white rounded-3xl border border-[#E8EBF0] p-6 shadow-xl">
        <div className="w-14 h-14 rounded-2xl bg-[#EEF2FF] text-[#162353] flex items-center justify-center mb-5"><ShieldCheck className="w-7 h-7" /></div>
        <p className="text-[21px] font-extrabold text-[#111]">Verify it’s you</p>
        <p className="text-[13px] text-[#777] mt-2 leading-relaxed">{status || 'SMS delivery is not configured for this account.'}</p>
        {error && <div className="mt-4 rounded-xl bg-red-50 border border-red-200 px-3 py-2.5 text-[12px] text-red-600">{error}</div>}
        <div className="mt-5 flex items-center gap-2 border border-[#E0E0E0] rounded-xl px-3 focus-within:border-[#162353]"><LockKeyhole className="w-4 h-4 text-[#999]" /><input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" placeholder="6-digit code" className="w-full py-3.5 text-[16px] tracking-[0.35em] font-bold outline-none" /></div>
        <button disabled={busy || code.length !== 6} onClick={() => void verify()} className="w-full mt-4 rounded-xl bg-[#162353] text-white py-3.5 text-[13px] font-bold disabled:opacity-50">{busy ? 'Checking…' : 'Continue securely'}</button>
        <button onClick={() => void signOut()} className="w-full mt-3 text-[#777] text-[12px] font-semibold">Sign out</button>
      </div>
    </div>
  );
}