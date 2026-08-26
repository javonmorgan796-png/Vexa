import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { useBusiness } from '@/context/BusinessContext';

function fmt(n: number) { return '₦' + n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

const BILL_CATEGORIES = [
  { id: 'electricity', label: 'Electricity', icon: '⚡', providers: ['EKEDC', 'IKEDC', 'PHED', 'AEDC', 'EEDC'] },
  { id: 'internet', label: 'Internet', icon: '🌐', providers: ['Spectranet', 'SWIFT', 'Smile', 'ipNX', 'MTN Fixed'] },
  { id: 'water', label: 'Water', icon: '💧', providers: ['Lagos Water', 'FCT Water', 'Rivers Water'] },
  { id: 'office', label: 'Office Lines', icon: '📞', providers: ['MTN', 'Airtel', 'Glo', '9mobile'] },
  { id: 'insurance', label: 'Insurance', icon: '🛡️', providers: ['AXA Mansard', 'Leadway', 'Sovereign Trust', 'Zenith Insurance'] },
  { id: 'tax', label: 'Tax Payment', icon: '🏛️', providers: ['FIRS', 'LIRS', 'PAYE', 'VAT'] },
];

type Step = 'categories' | 'details' | 'confirm' | 'success';

export default function BusinessBills() {
  const [, navigate] = useLocation();
  const { business, addTransaction } = useBusiness();
  const [step, setStep] = useState<Step>('categories');
  const [selectedCat, setSelectedCat] = useState<typeof BILL_CATEGORIES[0] | null>(null);
  const [provider, setProvider] = useState('');
  const [meterNumber, setMeterNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);

  function handlePay() {
    setError('');
    const num = parseFloat(amount);
    if (!provider) { setError('Select a provider'); return; }
    if (!amount || isNaN(num) || num <= 0) { setError('Enter a valid amount'); return; }
    if (!business || business.balance < num) { setError('Insufficient business balance'); return; }
    setStep('confirm');
  }

  function handleConfirm() {
    const num = parseFloat(amount);
    setProcessing(true);
    setTimeout(() => {
      addTransaction({ type: 'debit', description: `${selectedCat?.label} - ${provider}`, amount: num, category: 'bills' });
      setProcessing(false);
      setStep('success');
    }, 1500);
  }

  function reset() { setStep('categories'); setSelectedCat(null); setProvider(''); setMeterNumber(''); setAmount(''); setError(''); }

  return (
    <div className="fixed inset-0 bg-[#F2F3F5] flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="flex-none bg-[#162353]" style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}>
        <div className="flex items-center gap-3 px-5 pb-5">
          <button onClick={() => step === 'categories' ? navigate('/business') : step === 'details' ? setStep('categories') : setStep('details')}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          </button>
          <p className="text-white text-[16px] font-bold">Business Bills & Utilities</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3" style={{ scrollbarWidth: 'none' }}>
        {business && (
          <div className="bg-[#162353] rounded-xl px-4 py-3 flex items-center justify-between">
            <span className="text-white/60 text-[12px]">Business Balance</span>
            <span className="text-white font-bold text-[14px]">{fmt(business.balance)}</span>
          </div>
        )}

        {error && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-[12px] text-red-600 font-medium">{error}</div>}

        {step === 'categories' && (
          <>
            <p className="text-[13px] font-semibold text-[#888] px-1">Select Bill Type</p>
            <div className="grid grid-cols-3 gap-3">
              {BILL_CATEGORIES.map(cat => (
                <button key={cat.id} onClick={() => { setSelectedCat(cat); setProvider(''); setStep('details'); }}
                  className="bg-white rounded-2xl border border-[#F0F0F0] p-4 flex flex-col items-center gap-2 hover:shadow-sm transition-shadow active:scale-[0.97]">
                  <span className="text-[28px]">{cat.icon}</span>
                  <span className="text-[11px] font-semibold text-[#111] text-center leading-tight">{cat.label}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {step === 'details' && selectedCat && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-[#F0F0F0] p-4 flex items-center gap-3">
              <span className="text-[32px]">{selectedCat.icon}</span>
              <div>
                <p className="text-[14px] font-bold text-[#111]">{selectedCat.label}</p>
                <p className="text-[11px] text-[#888]">Select provider and enter details</p>
              </div>
            </div>

            <div>
              <p className="text-[12px] font-semibold text-[#444] mb-2">Provider</p>
              <div className="space-y-2">
                {selectedCat.providers.map(p => (
                  <button key={p} onClick={() => setProvider(p)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all ${provider === p ? 'border-[#162353] bg-[#F0F4FF]' : 'border-[#E2E8F0] bg-white'}`}>
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${provider === p ? 'border-[#162353]' : 'border-[#CCC]'}`}>
                      {provider === p && <div className="w-2 h-2 rounded-full bg-[#162353]" />}
                    </div>
                    <span className="text-[13px] font-semibold text-[#111]">{p}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[12px] font-semibold text-[#444] mb-1.5">Reference / Account Number</p>
              <input type="text" placeholder="e.g. Meter number, account ID…" value={meterNumber} onChange={e => setMeterNumber(e.target.value)}
                className="w-full h-[48px] rounded-xl border border-[#E2E8F0] bg-white px-4 text-[14px] text-[#111] placeholder-[#C0C8D4] focus:outline-none focus:border-[#162353] transition-colors" />
            </div>

            <div>
              <p className="text-[12px] font-semibold text-[#444] mb-1.5">Amount (₦)</p>
              <input type="number" placeholder="0.00" value={amount} onChange={e => { setAmount(e.target.value); setError(''); }}
                className="w-full h-[56px] rounded-xl border border-[#E2E8F0] bg-white px-4 text-[20px] font-bold text-[#111] placeholder-[#C0C8D4] focus:outline-none focus:border-[#162353] transition-colors" />
              <div className="flex gap-2 mt-2">
                {[10000, 25000, 50000, 100000].map(v => (
                  <button key={v} onClick={() => setAmount(String(v))} className="flex-1 py-1.5 bg-white border border-[#E2E8F0] rounded-lg text-[11px] font-semibold text-[#555]">
                    ₦{(v/1000).toFixed(0)}k
                  </button>
                ))}
              </div>
            </div>

            <button onClick={handlePay} className="w-full h-[52px] rounded-xl bg-[#162353] text-white text-[15px] font-bold">Proceed</button>
          </div>
        )}

        {step === 'confirm' && selectedCat && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-[#F0F0F0] overflow-hidden">
              <div className="bg-[#162353] px-5 py-5 text-center">
                <span className="text-[36px] block mb-2">{selectedCat.icon}</span>
                <p className="text-white/60 text-[12px]">Payment Amount</p>
                <p className="text-white text-[28px] font-extrabold">{fmt(parseFloat(amount))}</p>
              </div>
              <div className="px-5 py-4 space-y-3">
                {[
                  ['Bill Type', selectedCat.label],
                  ['Provider', provider],
                  ['Reference', meterNumber || 'N/A'],
                  ['From', `${business?.businessName} (${business?.accountNumber})`],
                ].map(([label, val]) => (
                  <div key={label} className="flex justify-between">
                    <span className="text-[12px] text-[#888]">{label}</span>
                    <span className="text-[12px] font-semibold text-[#111]">{val}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep('details')} className="flex-1 h-[52px] rounded-xl border-2 border-[#E2E8F0] text-[#555] text-[14px] font-semibold">Back</button>
              <button onClick={handleConfirm} disabled={processing} className="flex-1 h-[52px] rounded-xl bg-[#162353] text-white text-[14px] font-bold disabled:opacity-60">
                {processing ? <span className="flex items-center justify-center gap-2"><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="white" strokeWidth="3" strokeDasharray="40 20"/></svg>Processing…</span> : 'Pay Now'}
              </button>
            </div>
          </div>
        )}

        {step === 'success' && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-5">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <p className="text-[22px] font-extrabold text-[#111] mb-2">Payment Successful!</p>
            <p className="text-[13px] text-[#888] mb-8">{selectedCat?.label} via {provider} paid successfully</p>
            <button onClick={reset} className="w-full h-[52px] rounded-xl bg-[#162353] text-white text-[15px] font-bold">Pay Another Bill</button>
            <button onClick={() => navigate('/business')} className="w-full h-[48px] rounded-xl border-2 border-[#E2E8F0] text-[#555] text-[14px] font-semibold mt-3">Back to Dashboard</button>
          </div>
        )}
        <div className="pb-6" />
      </div>
    </div>
  );
}
