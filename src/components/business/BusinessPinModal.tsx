import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBusinessSecurity } from '@/context/BusinessSecurityContext';

export function BusinessPinModal({
  title = 'Enter Business PIN',
  subtitle = 'Confirm with your 6-digit Business PIN',
  confirmLabel = 'Confirm',
  onSuccess,
  onClose,
}: {
  title?: string;
  subtitle?: string;
  confirmLabel?: string;
  onSuccess: (pin: string) => Promise<void> | void;
  onClose: () => void;
}) {
  const { verifyPin } = useBusinessSecurity();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [shake, setShake] = useState(false);

  function addKey(k: string) {
    if (submitting) return;
    const digits = pin.replace(/\s/g, '');
    if (digits.length >= 6) return;
    const next = digits + k;
    setPin(next);
    setError('');
    if (next.length === 6) {
      setTimeout(() => {
        void submitPin(next);
      }, 80);
    }
  }

  function removeKey() {
    if (submitting) return;
    setPin(prev => prev.slice(0, -1));
  }

  async function submitPin(p: string) {
    if (submitting) return;
    setSubmitting(true);
    setError('');
    const result = await verifyPin(p);
    if (result.success) {
      await onSuccess(p);
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
    setShake(true);
    setPin('');
    setTimeout(() => setShake(false), 500);
    setError(result.nowLocked ? 'Too many attempts. Business locked.' : result.error ?? 'Incorrect PIN');
  }

  function handleManualSubmit() {
    const clean = pin.replace(/\s/g, '');
    if (clean.length < 6) {
      setError('Enter your 6-digit Business PIN');
      return;
    }
    void submitPin(clean);
  }

  const digits = pin.replace(/\s/g, '');

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: 'spring', damping: 22, stiffness: 300 }}
        className="theme-surface relative rounded-t-3xl overflow-hidden z-10 bg-white dark:bg-[#181A20] shadow-2xl"
      >
        <div className="w-10 h-1 bg-[#D9DDE5] dark:bg-white/20 rounded-full mx-auto mt-3 mb-5" />

        <div className="px-6 pb-3">
          <div className="flex flex-col items-center mb-5">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center mb-3"
              style={{ background: 'rgba(240,185,11,0.14)', border: '1px solid rgba(217,155,0,0.4)' }}
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                <rect x="5" y="11" width="14" height="10" rx="2" fill="none" stroke="#B7791F" strokeWidth="1.8" className="dark:stroke-[#F0B90B]" />
                <path d="M8 11V7a4 4 0 0 1 8 0v4" stroke="#B7791F" strokeWidth="1.8" strokeLinecap="round" className="dark:stroke-[#F0B90B]" />
                <circle cx="12" cy="16" r="1.5" fill="#B7791F" className="dark:fill-[#F0B90B]" />
              </svg>
            </div>
            <p className="text-[#181A20] dark:text-white text-[16px] font-bold">{title}</p>
            <p className="text-[#64748B] dark:text-white/50 text-[12px] mt-1">{subtitle}</p>
          </div>

          <motion.div
            className="flex justify-center gap-3 mb-4"
            animate={shake ? { x: [0, -8, 8, -6, 6, -4, 4, 0] } : {}}
            transition={{ duration: 0.4 }}
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className={`w-4 h-4 rounded-full border-2 transition-all ${
                  i < digits.length
                    ? 'bg-[#F0B90B] border-[#F0B90B]'
                    : 'border-[#CBD5E1] bg-transparent dark:bg-white/20'
                }`}
              />
            ))}
          </motion.div>

          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-[#DC2626] dark:text-[#ff6b6b] text-[12px] font-medium text-center mb-3"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          <div className="grid grid-cols-3 gap-2.5 w-full max-w-[288px] mx-auto mb-3">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(k => (
              <button
                key={k}
                type="button"
                onClick={() => addKey(k)}
                className="h-[50px] rounded-2xl bg-[#F4F5F7] dark:bg-white/10 border border-[#E2E8F0] dark:border-white/10 text-[21px] font-semibold text-[#181A20] dark:text-white active:bg-[#E5E7EB] dark:active:bg-white/25 transition-colors select-none"
              >
                {k}
              </button>
            ))}
            <div />
            <button
              type="button"
              onClick={() => addKey('0')}
              className="h-[50px] rounded-2xl bg-[#F4F5F7] dark:bg-white/10 border border-[#E2E8F0] dark:border-white/10 text-[21px] font-semibold text-[#181A20] dark:text-white active:bg-[#E5E7EB] dark:active:bg-white/25 transition-colors select-none"
            >
              0
            </button>
            <button
              type="button"
              onClick={removeKey}
              className="h-[50px] rounded-2xl bg-[#F4F5F7] dark:bg-white/10 border border-[#E2E8F0] dark:border-white/10 text-[#181A20] dark:text-white flex items-center justify-center active:bg-[#E5E7EB] dark:active:bg-white/25 transition-colors select-none"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12H9M15 6l-6 6 6 6" />
              </svg>
            </button>
          </div>

          <button
            type="button"
            onClick={handleManualSubmit}
            disabled={digits.length < 6 || submitting}
            className="w-full h-[48px] rounded-xl bg-[#F0B90B] hover:bg-[#FCD535] active:bg-[#DDAA09] text-[#181A20] text-[14px] font-bold mb-3 disabled:opacity-40 transition-all"
          >
            {submitting ? 'Authorizing…' : confirmLabel}
          </button>

          <button type="button" onClick={onClose} className="w-full text-[#64748B] dark:text-white/40 text-[13px] py-2 mb-2">
            Cancel
          </button>
        </div>
      </motion.div>
    </div>
  );
}
