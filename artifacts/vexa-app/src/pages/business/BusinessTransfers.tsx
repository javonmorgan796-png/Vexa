import React, { useState, useRef } from 'react';
import { useLocation } from 'wouter';
import { useBusiness } from '@/context/BusinessContext';
import { useBusinessSecurity } from '@/context/BusinessSecurityContext';
import { motion, AnimatePresence } from 'framer-motion';

function fmt(n: number) { return '₦' + n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

const BANKS = ['Access Bank', 'GTBank', 'Zenith Bank', 'UBA', 'First Bank', 'Polaris Bank', 'Stanbic IBTC', 'Wema Bank', 'Fidelity Bank', 'Ecobank'];

type Step = 'form' | 'confirm' | 'pin' | 'success';

/* ── Transfer PIN Modal ──────────────────────────────────────── */
function TransferPinModal({ onSuccess, onClose }: { onSuccess: () => void; onClose: () => void }) {
  const { verifyPin } = useBusinessSecurity();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  function handleDigit(idx: number, val: string) {
    const digit = val.replace(/\D/g, '').slice(-1);
    const next = pin.slice(0, idx) + digit + pin.slice(idx + 1);
    const filled = next.padEnd(6, '').slice(0, 6);
    // build array-style
    const arr = pin.split('').concat(Array(6).fill('')).slice(0, 6);
    arr[idx] = digit;
    const newPin = arr.join('');
    setPin(newPin.slice(0, 6));
    setError('');
    if (digit && idx < 5) inputRefs.current[idx + 1]?.focus();
    if (newPin.replace('', '').length === 6 && !newPin.includes('')) {
      // auto submit when 6 digits
    }
  }

  function handleKey(idx: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      const arr = (pin + '      ').slice(0, 6).split('');
      if (arr[idx]) { arr[idx] = ''; setPin(arr.join('')); }
      else if (idx > 0) { arr[idx - 1] = ''; setPin(arr.join('')); inputRefs.current[idx - 1]?.focus(); }
    }
  }

  function addKey(k: string) {
    const len = pin.replace(/\s/g, '').length;
    if (len >= 6) return;
    // find first empty slot
    const arr = (pin + '      ').slice(0, 6).split('');
    const idx = arr.findIndex(c => c === ' ' || c === '');
    if (idx === -1) return;
    arr[idx] = k;
    const newPin = arr.join('');
    setPin(newPin);
    setError('');
    inputRefs.current[Math.min(idx + 1, 5)]?.focus();
    if (newPin.replace(/\s/g,'').length === 6) {
      setTimeout(() => submitPin(newPin.replace(/\s/g,'')), 80);
    }
  }

  function removeKey() {
    const arr = (pin + '      ').slice(0, 6).split('');
    for (let i = 5; i >= 0; i--) {
      if (arr[i] !== ' ' && arr[i] !== '') { arr[i] = ''; setPin(arr.join('')); inputRefs.current[i]?.focus(); break; }
    }
  }

  function submitPin(p: string) {
    const result = verifyPin(p);
    if (result.success) { onSuccess(); return; }
    setShake(true);
    setPin('');
    setTimeout(() => setShake(false), 500);
    setError(result.nowLocked ? 'Too many attempts. Business locked.' : result.error ?? 'Incorrect PIN');
  }

  function handleManualSubmit() {
    const clean = pin.replace(/\s/g, '');
    if (clean.length < 6) { setError('Enter your 6-digit transfer PIN'); return; }
    submitPin(clean);
  }

  const pinArr = (pin + '      ').slice(0, 6).split('');
  const digits = pin.replace(/\s/g, '');

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: 'spring', damping: 22, stiffness: 300 }}
        className="relative rounded-t-3xl overflow-hidden z-10"
        style={{ background: 'linear-gradient(180deg, #0a1a3d 0%, #021029 100%)' }}
      >
        {/* Handle */}
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mt-3 mb-5" />

        <div className="px-6 pb-3">
          {/* Icon */}
          <div className="flex flex-col items-center mb-5">
            <div className="w-14 h-14 rounded-full flex items-center justify-center mb-3"
              style={{ background: 'rgba(0,198,255,0.12)', border: '1px solid rgba(0,198,255,0.3)' }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                <rect x="5" y="11" width="14" height="10" rx="2" fill="none" stroke="#00c6ff" strokeWidth="1.8"/>
                <path d="M8 11V7a4 4 0 0 1 8 0v4" stroke="#00c6ff" strokeWidth="1.8" strokeLinecap="round"/>
                <circle cx="12" cy="16" r="1.5" fill="#00c6ff"/>
              </svg>
            </div>
            <p className="text-white text-[16px] font-bold">Enter Transfer PIN</p>
            <p className="text-white/50 text-[12px] mt-1">Confirm with your 6-digit Business PIN</p>
          </div>

          {/* PIN dots */}
          <motion.div
            className="flex justify-center gap-3 mb-4"
            animate={shake ? { x: [0, -8, 8, -6, 6, -4, 4, 0] } : {}}
            transition={{ duration: 0.4 }}
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={`w-4 h-4 rounded-full border-2 transition-all ${
                i < digits.length ? 'bg-[#00c6ff] border-[#00c6ff]' : 'border-white/30 bg-transparent'
              }`} />
            ))}
          </motion.div>

          <AnimatePresence>
            {error && (
              <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="text-[#ff6b6b] text-[12px] font-medium text-center mb-3">
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          {/* Keypad */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            {['1','2','3','4','5','6','7','8','9'].map(k => (
              <button key={k} onClick={() => addKey(k)}
                className="h-[52px] rounded-2xl bg-white/10 border border-white/10 text-[22px] font-semibold text-white active:bg-white/25 transition-colors select-none">
                {k}
              </button>
            ))}
            <div />
            <button onClick={() => addKey('0')}
              className="h-[52px] rounded-2xl bg-white/10 border border-white/10 text-[22px] font-semibold text-white active:bg-white/25 transition-colors select-none">
              0
            </button>
            <button onClick={removeKey}
              className="h-[52px] rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center active:bg-white/25 transition-colors select-none">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12H9M15 6l-6 6 6 6"/>
              </svg>
            </button>
          </div>

          <button onClick={handleManualSubmit} disabled={digits.length < 6}
            className="w-full h-[48px] rounded-xl bg-[#00c6ff]/20 border border-[#00c6ff]/40 text-[#00c6ff] text-[14px] font-bold mb-3 disabled:opacity-40 transition-opacity">
            Confirm Transfer
          </button>

          <button onClick={onClose} className="w-full text-white/40 text-[13px] py-2 mb-2">Cancel</button>
        </div>
      </motion.div>
    </div>
  );
}

export default function BusinessTransfers() {
  const [, navigate] = useLocation();
  const { business, employees, addTransaction } = useBusiness();
  const [mode, setMode] = useState<'send' | 'receive'>('send');
  const [step, setStep] = useState<Step>('form');
  const [recipientType, setRecipientType] = useState<'employee' | 'external'>('external');
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [bankName, setBankName] = useState('GTBank');
  const [recipientName, setRecipientName] = useState('');
  const [amount, setAmount] = useState('');
  const [narration, setNarration] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const activeEmployees = employees.filter(e => e.active);

  function handleSend() {
    setError('');
    const num = parseFloat(amount.replace(/,/g, ''));
    if (!amount || isNaN(num) || num <= 0) { setError('Enter a valid amount'); return; }
    if (recipientType === 'employee' && !selectedEmpId) { setError('Select an employee'); return; }
    if (recipientType === 'external') {
      if (!accountNumber || accountNumber.replace(/\D/g, '').length < 10) { setError('Enter a valid account number'); return; }
      if (!recipientName.trim()) { setError('Enter recipient name'); return; }
    }
    if (!business || business.balance < num) { setError('Insufficient business balance'); return; }
    setStep('confirm');
  }

  function handleConfirm() {
    const num = parseFloat(amount.replace(/,/g, ''));
    const empName = recipientType === 'employee' ? employees.find(e => e.id === selectedEmpId)?.name : recipientName;
    addTransaction({ type: 'debit', description: `Transfer to ${empName}`, amount: num, category: 'transfer' });
    setStep('success');
  }

  function reset() { setStep('form'); setAmount(''); setNarration(''); setRecipientName(''); setAccountNumber(''); setSelectedEmpId(''); setError(''); }

  if (!business) return null;
  const emp = employees.find(e => e.id === selectedEmpId);
  const sendAmount = parseFloat(amount.replace(/,/g, '')) || 0;

  return (
    <div className="fixed inset-0 bg-[#F2F3F5] flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div className="flex-none bg-[#162353]" style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}>
        <div className="flex items-center gap-3 px-5 pb-4">
          <button onClick={() => navigate('/business')} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          </button>
          <p className="text-white text-[16px] font-bold">Business Transfers</p>
        </div>

        {/* Mode toggle */}
        <div className="flex mx-5 mb-5 bg-white/10 rounded-xl p-1">
          {(['send', 'receive'] as const).map(m => (
            <button key={m} onClick={() => { setMode(m); reset(); }}
              className={`flex-1 py-2 rounded-lg text-[13px] font-bold transition-all ${mode === m ? 'bg-white text-[#162353]' : 'text-white/60'}`}>
              {m === 'send' ? '↑ Send Money' : '↓ Receive Money'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4" style={{ scrollbarWidth: 'none' }}>

        {/* SEND FLOW */}
        {mode === 'send' && step === 'form' && (
          <div className="space-y-4">
            {/* Balance pill */}
            <div className="bg-[#162353] rounded-xl px-4 py-3 flex items-center justify-between">
              <span className="text-white/60 text-[12px]">Available Balance</span>
              <span className="text-white font-bold text-[14px]">{fmt(business.balance)}</span>
            </div>

            {error && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-[12px] text-red-600 font-medium">{error}</div>}

            {/* Recipient type */}
            <div>
              <p className="text-[12px] font-semibold text-[#444] mb-2">Send To</p>
              <div className="flex gap-2">
                {(['external', 'employee'] as const).map(rt => (
                  <button key={rt} onClick={() => { setRecipientType(rt); setSelectedEmpId(''); setAccountNumber(''); setRecipientName(''); setError(''); }}
                    className={`flex-1 py-3 rounded-xl border-2 text-[12px] font-semibold transition-all ${recipientType === rt ? 'border-[#162353] bg-[#F0F4FF] text-[#162353]' : 'border-[#E2E8F0] bg-white text-[#555]'}`}>
                    {rt === 'external' ? '🏦 External Account' : '👤 Employee'}
                  </button>
                ))}
              </div>
            </div>

            {recipientType === 'employee' ? (
              <div>
                <p className="text-[12px] font-semibold text-[#444] mb-2">Select Employee</p>
                <div className="space-y-2">
                  {activeEmployees.map(e => (
                    <button key={e.id} onClick={() => setSelectedEmpId(e.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all ${selectedEmpId === e.id ? 'border-[#162353] bg-[#F0F4FF]' : 'border-[#E2E8F0] bg-white'}`}>
                      <div className="w-9 h-9 rounded-full bg-[#EFF6FF] flex items-center justify-center text-[12px] font-bold text-[#2563EB] shrink-0">
                        {e.name.split(' ').map(p => p[0]).slice(0, 2).join('')}
                      </div>
                      <div className="flex-1">
                        <p className="text-[13px] font-semibold text-[#111]">{e.name}</p>
                        <p className="text-[10px] text-[#888]">{e.bankName} · {e.accountNumber}</p>
                      </div>
                      {selectedEmpId === e.id && <div className="w-4 h-4 rounded-full bg-[#162353] flex items-center justify-center"><svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <p className="text-[12px] font-semibold text-[#444] mb-1.5">Bank</p>
                  <div className="flex flex-wrap gap-1.5">
                    {BANKS.map(b => (
                      <button key={b} onClick={() => setBankName(b)}
                        className={`px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all ${bankName === b ? 'bg-[#162353] text-white' : 'bg-white border border-[#E2E8F0] text-[#555]'}`}>
                        {b}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[12px] font-semibold text-[#444] mb-1.5">Account Number</p>
                  <input type="tel" inputMode="numeric" placeholder="10-digit account number" maxLength={10} value={accountNumber} onChange={e => { setAccountNumber(e.target.value.replace(/\D/g, '')); setError(''); }}
                    className="w-full h-[48px] rounded-xl border border-[#E2E8F0] bg-white px-4 text-[14px] text-[#111] placeholder-[#C0C8D4] focus:outline-none focus:border-[#162353] transition-colors" />
                </div>
                <div>
                  <p className="text-[12px] font-semibold text-[#444] mb-1.5">Recipient Name</p>
                  <input type="text" placeholder="e.g. Oluwaseun Adeyemi" value={recipientName} onChange={e => { setRecipientName(e.target.value); setError(''); }}
                    className="w-full h-[48px] rounded-xl border border-[#E2E8F0] bg-white px-4 text-[14px] text-[#111] placeholder-[#C0C8D4] focus:outline-none focus:border-[#162353] transition-colors" />
                </div>
              </div>
            )}

            {/* Amount */}
            <div>
              <p className="text-[12px] font-semibold text-[#444] mb-1.5">Amount (₦)</p>
              <input type="number" placeholder="0.00" value={amount} onChange={e => { setAmount(e.target.value); setError(''); }}
                className="w-full h-[56px] rounded-xl border border-[#E2E8F0] bg-white px-4 text-[20px] font-bold text-[#111] placeholder-[#C0C8D4] focus:outline-none focus:border-[#162353] transition-colors" />
              <div className="flex gap-2 mt-2">
                {[5000, 10000, 50000, 100000].map(v => (
                  <button key={v} onClick={() => setAmount(String(v))} className="flex-1 py-1.5 bg-white border border-[#E2E8F0] rounded-lg text-[11px] font-semibold text-[#555]">
                    ₦{(v/1000).toFixed(0)}k
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[12px] font-semibold text-[#444] mb-1.5">Narration (optional)</p>
              <input type="text" placeholder="What's this for?" value={narration} onChange={e => setNarration(e.target.value)}
                className="w-full h-[48px] rounded-xl border border-[#E2E8F0] bg-white px-4 text-[14px] text-[#111] placeholder-[#C0C8D4] focus:outline-none focus:border-[#162353] transition-colors" />
            </div>

            <button onClick={handleSend} className="w-full h-[52px] rounded-xl bg-[#162353] text-white text-[15px] font-bold mt-2">
              Continue
            </button>
          </div>
        )}

        {/* Confirm */}
        {mode === 'send' && step === 'confirm' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-[#F0F0F0] overflow-hidden">
              <div className="bg-[#162353] px-5 py-5 text-center">
                <p className="text-white/60 text-[12px] mb-1">You are sending</p>
                <p className="text-white text-[32px] font-extrabold">{fmt(sendAmount)}</p>
              </div>
              <div className="px-5 py-4 space-y-3">
                {[
                  ['To', recipientType === 'employee' ? emp?.name : recipientName],
                  ['Account', recipientType === 'employee' ? emp?.accountNumber : accountNumber],
                  ['Bank', recipientType === 'employee' ? emp?.bankName : bankName],
                  ['Narration', narration || 'Business Transfer'],
                  ['From', `${business.businessName} (${business.accountNumber})`],
                ].map(([label, val]) => (
                  <div key={label} className="flex justify-between">
                    <span className="text-[12px] text-[#888]">{label}</span>
                    <span className="text-[12px] font-semibold text-[#111] text-right max-w-[55%]">{val}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep('form')} className="flex-1 h-[52px] rounded-xl border-2 border-[#E2E8F0] text-[#555] text-[14px] font-semibold">Back</button>
              <button onClick={() => setStep('pin')} className="flex-1 h-[52px] rounded-xl bg-[#162353] text-white text-[15px] font-bold">Enter PIN</button>
            </div>
          </div>
        )}

        {/* PIN Verification */}
        {mode === 'send' && step === 'pin' && (
          <AnimatePresence>
            <TransferPinModal
              onSuccess={() => { handleConfirm(); setStep('success'); }}
              onClose={() => setStep('confirm')}
            />
          </AnimatePresence>
        )}

        {/* Success */}
        {mode === 'send' && step === 'success' && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-5">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <p className="text-[22px] font-extrabold text-[#111] mb-2">Transfer Successful!</p>
            <p className="text-[13px] text-[#888] mb-1">{fmt(sendAmount)} sent successfully</p>
            <p className="text-[12px] text-[#888] mb-8">New balance: {fmt(business.balance)}</p>
            <button onClick={reset} className="w-full h-[52px] rounded-xl bg-[#162353] text-white text-[15px] font-bold">Make Another Transfer</button>
            <button onClick={() => navigate('/business')} className="w-full h-[48px] rounded-xl border-2 border-[#E2E8F0] text-[#555] text-[14px] font-semibold mt-3">Back to Dashboard</button>
          </div>
        )}

        {/* RECEIVE */}
        {mode === 'receive' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-[#F0F0F0] p-5 text-center">
              <div className="w-16 h-16 rounded-full bg-[#EFF6FF] flex items-center justify-center mx-auto mb-4">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
              </div>
              <p className="text-[18px] font-extrabold text-[#111] mb-1">{business.businessName}</p>
              <p className="text-[13px] text-[#888] mb-4">Share these details to receive payments</p>

              <div className="space-y-3 text-left">
                {[
                  { label: 'Account Number', value: business.accountNumber },
                  { label: 'Bank Name', value: 'Vexa Business Bank' },
                  { label: 'Account Name', value: business.businessName },
                ].map(row => (
                  <div key={row.label} className="flex items-center justify-between bg-[#F8F9FB] rounded-xl px-4 py-3">
                    <div>
                      <p className="text-[10px] text-[#888] font-medium">{row.label}</p>
                      <p className="text-[14px] font-bold text-[#111]">{row.value}</p>
                    </div>
                    <button onClick={() => { navigator.clipboard?.writeText(row.value); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                      className="w-8 h-8 flex items-center justify-center rounded-full bg-[#EFF6FF]">
                      {copied ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[#F0F4FF] border border-[#C7D7FF] rounded-xl px-4 py-3">
              <p className="text-[12px] font-semibold text-[#162353] mb-0.5">💡 Tip</p>
              <p className="text-[11px] text-[#555]">Share your business account details with clients and partners to receive payments directly into your Vexa Business account.</p>
            </div>
          </div>
        )}
        <div className="pb-6" />
      </div>
    </div>
  );
}
