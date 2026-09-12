import React, { useState } from 'react';
import { ArrowLeftRight, CheckCircle2, ChevronLeft, Send } from 'lucide-react';
import { useLocation } from 'wouter';
import { useAuth } from '@/context/AuthContext';
import { useUserData } from '@/context/UserDataContext';
import { useVexaFinance } from '@/context/VexaFinanceContext';

export default function VexaTransferPage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { refreshAll } = useUserData();
  const { transferVexaMoney } = useVexaFinance();
  const [accountNumber, setAccountNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<{ name: string; amount: number } | null>(null);

  const submit = async () => {
    const numericAmount = Number(amount.replace(/,/g, ''));
    if (!/^\d{10}$/.test(accountNumber)) return setError('Enter the recipient’s 10-digit Vexa account number');
    if (!numericAmount || numericAmount <= 0) return setError('Enter a valid amount');
    if (accountNumber === user?.accountNumber) return setError('You cannot transfer to your own account');
    if (user?.pin === '0000') return setError('Set your transaction PIN in Settings before sending money');
    if (pin.length !== 4) return setError('Enter your 4-digit transaction PIN');
    setBusy(true); setError('');
    const result = await transferVexaMoney(accountNumber, numericAmount, note, pin);
    setBusy(false);
    if (!result.success) return setError(result.error ?? 'Transfer failed');
    await refreshAll();
    setSuccess({ name: result.recipientName ?? 'Vexa user', amount: numericAmount });
  };

  if (success) {
    return (
      <div className="fixed inset-0 bg-[#F2F3F5] flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>
        <div className="flex-none flex items-center gap-3 px-4 pb-3 bg-white border-b border-[#E8EBF0]" style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}>
          <button onClick={() => navigate('/')} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"><ChevronLeft className="w-5 h-5" /></button>
          <span className="text-[16px] font-bold text-[#111]">Transfer complete</span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <CheckCircle2 className="w-16 h-16 text-[#16A34A]" />
          <p className="text-[22px] font-extrabold text-[#111] mt-5">Money sent</p>
          <p className="text-[14px] text-[#666] mt-2">₦{success.amount.toLocaleString('en-NG', { minimumFractionDigits: 2 })} was delivered to {success.name}.</p>
          <button onClick={() => { setSuccess(null); setAccountNumber(''); setAmount(''); setNote(''); }} className="w-full max-w-sm mt-8 rounded-xl bg-[#162353] text-white py-3.5 text-[13px] font-bold">Send another transfer</button>
          <button onClick={() => navigate('/')} className="mt-3 text-[#2563EB] text-[13px] font-semibold">Back to home</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-[#F2F3F5] flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="flex-none flex items-center gap-3 px-4 pb-3 bg-white border-b border-[#E8EBF0]" style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}>
        <button onClick={() => navigate('/transfer')} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"><ChevronLeft className="w-5 h-5" /></button>
        <span className="text-[16px] font-bold text-[#111]">Transfer to Vexa user</span>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4" style={{ scrollbarWidth: 'none' }}>
        <div className="rounded-2xl bg-[#162353] text-white p-5">
          <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center"><ArrowLeftRight className="w-5 h-5 text-[#8BE3FF]" /></div><div><p className="text-[14px] font-bold">Instant Vexa transfer</p><p className="text-[11px] text-white/60 mt-0.5">No fee · settles directly to their balance</p></div></div>
        </div>
        {error && <div className="rounded-2xl bg-red-50 border border-red-200 px-4 py-3 text-[12px] text-red-600">{error}</div>}
        <div className="bg-white rounded-2xl border border-[#F0F0F0] p-5 space-y-4">
          <div><label className="block text-[11px] font-bold text-[#555] mb-1.5">Recipient account number</label><input value={accountNumber} onChange={e => setAccountNumber(e.target.value.replace(/\D/g, '').slice(0, 10))} inputMode="numeric" placeholder="10-digit Vexa account" className="w-full border border-[#E0E0E0] rounded-xl px-4 py-3.5 text-[16px] tracking-[0.12em] outline-none focus:border-[#162353]" /></div>
          <div><label className="block text-[11px] font-bold text-[#555] mb-1.5">Amount</label><div className="flex items-center border border-[#E0E0E0] rounded-xl px-4 focus-within:border-[#162353]"><span className="text-[18px] font-bold text-[#555]">₦</span><input value={amount} onChange={e => setAmount(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" placeholder="0.00" className="w-full px-3 py-3.5 text-[18px] font-semibold outline-none" /></div></div>
          <div><label className="block text-[11px] font-bold text-[#555] mb-1.5">Note <span className="font-normal text-[#999]">(optional)</span></label><input value={note} onChange={e => setNote(e.target.value.slice(0, 120))} placeholder="What’s this for?" className="w-full border border-[#E0E0E0] rounded-xl px-4 py-3.5 text-[14px] outline-none focus:border-[#162353]" /></div>
          <div><label className="block text-[11px] font-bold text-[#555] mb-1.5">Transaction PIN</label><input value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))} type="password" inputMode="numeric" placeholder="4-digit PIN" className="w-full border border-[#E0E0E0] rounded-xl px-4 py-3.5 text-[16px] tracking-[0.4em] outline-none focus:border-[#162353]" /></div>
        </div>
        <p className="text-[11px] text-[#888] text-center">Your transfer PIN is required in the standard transfer flow. Vexa-to-Vexa transfers are recorded in both users’ histories.</p>
      </div>
      <div className="flex-none px-4 pb-6 pt-2"><button disabled={busy} onClick={() => void submit()} className="w-full rounded-xl bg-[#162353] text-white py-3.5 text-[13px] font-bold disabled:opacity-50"><span className="inline-flex items-center gap-2">{busy ? 'Sending…' : <><Send className="w-4 h-4" /> Send money</>}</span></button></div>
    </div>
  );
}