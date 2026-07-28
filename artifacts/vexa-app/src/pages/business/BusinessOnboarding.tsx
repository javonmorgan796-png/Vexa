import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/context/AuthContext';
import { useBusiness, BusinessType } from '@/context/BusinessContext';

const BUSINESS_TYPES: { value: BusinessType; label: string; desc: string }[] = [
  { value: 'sole_proprietorship', label: 'Sole Proprietorship', desc: 'Owned and run by one person' },
  { value: 'partnership', label: 'Partnership', desc: 'Two or more co-owners' },
  { value: 'llc', label: 'LLC', desc: 'Limited liability company' },
  { value: 'corporation', label: 'Corporation', desc: 'Large structured company' },
];

const INDUSTRIES = ['Technology', 'Retail & E-commerce', 'Healthcare', 'Education', 'Finance & Banking', 'Agriculture', 'Construction', 'Manufacturing', 'Media & Entertainment', 'Transportation', 'Real Estate', 'Food & Beverage', 'Consulting', 'Other'];

export default function BusinessOnboarding() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { createBusiness } = useBusiness();
  const [step, setStep] = useState(1);

  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState<BusinessType | ''>('');
  const [industry, setIndustry] = useState('');
  const [description, setDescription] = useState('');
  const [email, setEmail] = useState(user?.email || '');
  const [address, setAddress] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const totalSteps = 3;

  function nextStep() {
    setError('');
    if (step === 1) {
      if (!businessName.trim()) { setError('Business name is required'); return; }
      if (!businessType) { setError('Select a business type'); return; }
    }
    if (step === 2) {
      if (!industry) { setError('Select an industry'); return; }
    }
    if (step === 3) {
      if (!address.trim()) { setError('Business address is required'); return; }
      handleSubmit(); return;
    }
    setStep(s => s + 1);
  }

  function handleSubmit() {
    setLoading(true);
    setTimeout(() => {
      createBusiness({
        businessName: businessName.trim(),
        businessType: businessType as BusinessType,
        industry,
        description: description.trim(),
        ownerName: user?.name || '',
        ownerPhone: user?.phone || '',
        email: email.trim(),
        address: address.trim(),
      });
      setLoading(false);
      navigate('/business');
    }, 1200);
  }

  return (
    <div className="fixed inset-0 bg-[#F2F3F5] flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div className="flex-none bg-[#162353] px-6 flex flex-col items-center" style={{ paddingTop: 'max(env(safe-area-inset-top), 20px)', paddingBottom: 28 }}>
        <div className="w-full flex items-center mb-5">
          <button onClick={() => step > 1 ? setStep(s => s - 1) : navigate('/')}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          </button>
        </div>

        {/* Icon */}
        <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center mb-4">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
            <line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/>
          </svg>
        </div>
        <p className="text-white text-[18px] font-bold mb-1">Set Up Vexa Business</p>
        <p className="text-white/60 text-[12px]">Step {step} of {totalSteps}</p>

        {/* Progress bar */}
        <div className="w-full mt-4 h-1 bg-white/20 rounded-full overflow-hidden">
          <div className="h-full bg-white rounded-full transition-all duration-500" style={{ width: `${(step / totalSteps) * 100}%` }} />
        </div>
      </div>

      {/* Card */}
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        <div className="bg-white mx-0 rounded-t-3xl -mt-4 px-6 pt-8 pb-10 min-h-full">

          {error && (
            <div className="mb-5 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-[13px] text-red-600 font-medium">{error}</div>
          )}

          {/* Step 1: Business Info */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-[20px] font-bold text-[#111] mb-1">Business Details</h2>
                <p className="text-[13px] text-[#888]">Tell us about your business</p>
              </div>
              <div>
                <label className="text-[12px] font-semibold text-[#444] mb-1.5 block">Business Name *</label>
                <input type="text" placeholder="e.g. Dike Tech Solutions Ltd"
                  value={businessName} onChange={e => { setBusinessName(e.target.value); setError(''); }}
                  className="w-full h-[50px] rounded-xl border border-[#E2E8F0] bg-[#F8F9FB] px-4 text-[14px] text-[#111] placeholder-[#C0C8D4] focus:outline-none focus:border-[#162353] focus:bg-white transition-colors" />
              </div>
              <div>
                <label className="text-[12px] font-semibold text-[#444] mb-2 block">Business Type *</label>
                <div className="space-y-2">
                  {BUSINESS_TYPES.map(bt => (
                    <button key={bt.value} type="button" onClick={() => { setBusinessType(bt.value); setError(''); }}
                      className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 text-left transition-all ${businessType === bt.value ? 'border-[#162353] bg-[#F0F4FF]' : 'border-[#E2E8F0] bg-[#F8F9FB]'}`}>
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${businessType === bt.value ? 'border-[#162353]' : 'border-[#CCC]'}`}>
                        {businessType === bt.value && <div className="w-2 h-2 rounded-full bg-[#162353]" />}
                      </div>
                      <div>
                        <p className="text-[13px] font-semibold text-[#111]">{bt.label}</p>
                        <p className="text-[11px] text-[#888]">{bt.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Industry */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-[20px] font-bold text-[#111] mb-1">Industry & Description</h2>
                <p className="text-[13px] text-[#888]">What sector does your business operate in?</p>
              </div>
              <div>
                <label className="text-[12px] font-semibold text-[#444] mb-2 block">Industry *</label>
                <div className="grid grid-cols-2 gap-2">
                  {INDUSTRIES.map(ind => (
                    <button key={ind} type="button" onClick={() => { setIndustry(ind); setError(''); }}
                      className={`px-3 py-2.5 rounded-xl border-2 text-[12px] font-semibold text-left transition-all ${industry === ind ? 'border-[#162353] bg-[#F0F4FF] text-[#162353]' : 'border-[#E2E8F0] bg-[#F8F9FB] text-[#555]'}`}>
                      {ind}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[12px] font-semibold text-[#444] mb-1.5 block">Description (optional)</label>
                <textarea placeholder="Briefly describe what your business does…"
                  value={description} onChange={e => setDescription(e.target.value)} rows={3}
                  className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8F9FB] px-4 py-3 text-[14px] text-[#111] placeholder-[#C0C8D4] focus:outline-none focus:border-[#162353] focus:bg-white transition-colors resize-none" />
              </div>
            </div>
          )}

          {/* Step 3: Contact */}
          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-[20px] font-bold text-[#111] mb-1">Contact & Location</h2>
                <p className="text-[13px] text-[#888]">Where is your business located?</p>
              </div>
              <div className="bg-[#F0F4FF] rounded-xl px-4 py-3 flex items-center gap-3 border border-[#C7D7FF]">
                <div className="w-9 h-9 rounded-full bg-[#162353] flex items-center justify-center shrink-0 text-white text-[13px] font-bold">
                  {(user?.name || 'U').split(' ').map(p => p[0]).slice(0, 2).join('')}
                </div>
                <div>
                  <p className="text-[13px] font-bold text-[#111]">{user?.name}</p>
                  <p className="text-[11px] text-[#888]">Business Owner · {user?.phone}</p>
                </div>
              </div>
              <div>
                <label className="text-[12px] font-semibold text-[#444] mb-1.5 block">Business Email</label>
                <input type="email" placeholder="business@company.com"
                  value={email} onChange={e => setEmail(e.target.value)}
                  className="w-full h-[50px] rounded-xl border border-[#E2E8F0] bg-[#F8F9FB] px-4 text-[14px] text-[#111] placeholder-[#C0C8D4] focus:outline-none focus:border-[#162353] focus:bg-white transition-colors" />
              </div>
              <div>
                <label className="text-[12px] font-semibold text-[#444] mb-1.5 block">Business Address *</label>
                <textarea placeholder="Enter your business address…"
                  value={address} onChange={e => { setAddress(e.target.value); setError(''); }} rows={3}
                  className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8F9FB] px-4 py-3 text-[14px] text-[#111] placeholder-[#C0C8D4] focus:outline-none focus:border-[#162353] focus:bg-white transition-colors resize-none" />
              </div>
            </div>
          )}

          {/* CTA */}
          <button onClick={nextStep} disabled={loading}
            className="w-full h-[52px] rounded-xl bg-[#162353] text-white text-[15px] font-bold mt-8 disabled:opacity-60 transition-opacity active:scale-[0.98]">
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="white" strokeWidth="3" strokeDasharray="40 20"/></svg>
                Creating account…
              </span>
            ) : step === totalSteps ? 'Create Business Account' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
