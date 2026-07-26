import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/context/AuthContext';

type Step = 'current' | 'new' | 'confirm' | 'success';

export default function ChangePinPage() {
  const [, navigate] = useLocation();
  const { updatePin } = useAuth();
  const [step, setStep] = useState<Step>('current');
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);

  const activePin = step === 'current' ? currentPin : step === 'new' ? newPin : confirmPin;
  const setActivePin = step === 'current' ? setCurrentPin : step === 'new' ? setNewPin : setConfirmPin;

  function handleKey(k: string) {
    if (activePin.length < 4) setActivePin(p => p + k);
  }
  function handleBack() { setActivePin(p => p.slice(0, -1)); setError(''); }

  function handleNext() {
    if (step === 'current') {
      if (currentPin.length < 4) return;
      setStep('new');
    } else if (step === 'new') {
      if (newPin.length < 4) return;
      setStep('confirm');
    } else if (step === 'confirm') {
      if (confirmPin.length < 4) return;
      if (newPin !== confirmPin) { setError('PINs do not match. Try again.'); setConfirmPin(''); return; }
      setProcessing(true);
      setTimeout(() => {
        const res = updatePin(currentPin, newPin);
        setProcessing(false);
        if (res.success) setStep('success');
        else { setError(res.error ?? 'Failed'); setStep('current'); setCurrentPin(''); setNewPin(''); setConfirmPin(''); }
      }, 1000);
    }
  }

  const STEP_META: Record<Step, { title: string; subtitle: string }> = {
    current: { title: 'Enter Current PIN', subtitle: 'Enter your 4-digit transaction PIN' },
    new:     { title: 'Enter New PIN',     subtitle: 'Choose a new 4-digit PIN' },
    confirm: { title: 'Confirm New PIN',   subtitle: 'Re-enter your new PIN to confirm' },
    success: { title: '',                  subtitle: '' },
  };

  if (step === 'success') {
    return (
      <div className="fixed inset-0 bg-white flex flex-col items-center justify-center px-6" style={{ fontFamily: "'Inter', sans-serif" }}>
        <div className="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center mb-5">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <p className="text-[22px] font-bold text-[#111] mb-2">PIN Changed!</p>
        <p className="text-[13px] text-[#888] text-center mb-8 leading-relaxed">
          Your transaction PIN has been updated successfully.
        </p>
        <button onClick={() => navigate('/settings')}
          className="w-full max-w-xs bg-[#162353] rounded-xl h-[52px] text-[15px] font-bold text-white">
          Back to Settings
        </button>
      </div>
    );
  }

  const meta = STEP_META[step];

  // Step indicator dots
  const stepIndex = step === 'current' ? 0 : step === 'new' ? 1 : 2;

  return (
    <div className="fixed inset-0 bg-[#F2F3F5] flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div className="flex-none flex items-center gap-3 px-4 pb-3 bg-white border-b border-[#E8EBF0]"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}>
        <button onClick={() => step === 'current' ? navigate('/settings') : setStep(step === 'confirm' ? 'new' : 'current')}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <span className="text-[16px] font-bold text-[#111]">Change Transaction PIN</span>
      </div>

      <div className="flex-1 flex flex-col px-6 pt-8">
        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-8">
          {[0, 1, 2].map(i => (
            <div key={i} className={`h-2 rounded-full transition-all ${i === stepIndex ? 'w-6 bg-[#162353]' : i < stepIndex ? 'w-2 bg-[#162353]/40' : 'w-2 bg-[#E2E8F0]'}`} />
          ))}
        </div>

        <p className="text-[20px] font-bold text-[#111] text-center mb-1">{meta.title}</p>
        <p className="text-[13px] text-[#888] text-center mb-8">{meta.subtitle}</p>

        {/* PIN dots */}
        <div className="flex justify-center gap-5 mb-4">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className={`w-4 h-4 rounded-full border-2 transition-all ${i < activePin.length ? 'bg-[#162353] border-[#162353]' : 'border-[#CBD5E1]'}`} />
          ))}
        </div>

        {error && (
          <p className="text-center text-[13px] text-red-500 font-medium mb-4">{error}</p>
        )}

        <div className="flex-1" />

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {['1','2','3','4','5','6','7','8','9'].map(k => (
            <button key={k} onClick={() => handleKey(k)}
              className="h-[56px] rounded-2xl bg-white border border-[#F0F0F0] text-[22px] font-semibold text-[#111] active:bg-[#E2E5EA] shadow-sm transition-colors">
              {k}
            </button>
          ))}
          <div />
          <button onClick={() => handleKey('0')}
            className="h-[56px] rounded-2xl bg-white border border-[#F0F0F0] text-[22px] font-semibold text-[#111] active:bg-[#E2E5EA] shadow-sm transition-colors">
            0
          </button>
          <button onClick={handleBack}
            className="h-[56px] rounded-2xl bg-white border border-[#F0F0F0] flex items-center justify-center active:bg-[#E2E5EA] shadow-sm transition-colors">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12H9M15 6l-6 6 6 6"/></svg>
          </button>
        </div>

        <button onClick={handleNext}
          disabled={activePin.length < 4 || processing}
          className="w-full h-[52px] rounded-xl bg-[#162353] text-white text-[15px] font-bold mb-6 disabled:opacity-40 transition-opacity">
          {processing ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="3" strokeDasharray="40 20" />
              </svg>
              Updating…
            </span>
          ) : step === 'confirm' ? 'Confirm PIN' : 'Continue'}
        </button>
      </div>
    </div>
  );
}
