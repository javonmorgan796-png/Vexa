import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBusinessSecurity } from '@/context/BusinessSecurityContext';
import { useAuth } from '@/context/AuthContext';
import { useLocation } from 'wouter';

type Mode =
  | 'biometric'
  | 'pin'
  | 'locked'
  | 'recovery_passcode'
  | 'recovery_new_pin'
  | 'recovery_confirm';

/* ── helpers ──────────────────────────────────────────────────── */
function fmtCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/* ── Keypad ───────────────────────────────────────────────────── */
function Keypad({
  onDigit,
  onBack,
  disabled = false,
}: {
  onDigit: (k: string) => void;
  onBack: () => void;
  disabled?: boolean;
}) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
  return (
    <div className="grid grid-cols-3 gap-3 w-full max-w-[288px] mx-auto">
      {keys.map(k => (
        <button
          key={k}
          onClick={() => onDigit(k)}
          disabled={disabled}
          className="h-[54px] rounded-2xl bg-white dark:bg-white/10 border border-[#E2E8F0] dark:border-white/15 shadow-xs dark:shadow-none text-[23px] font-semibold text-[#181A20] dark:text-white active:bg-[#F1F5F9] dark:active:bg-white/25 transition-colors disabled:opacity-40 select-none"
        >
          {k}
        </button>
      ))}
      <div />
      <button
        onClick={() => onDigit('0')}
        disabled={disabled}
        className="h-[54px] rounded-2xl bg-white dark:bg-white/10 border border-[#E2E8F0] dark:border-white/15 shadow-xs dark:shadow-none text-[23px] font-semibold text-[#181A20] dark:text-white active:bg-[#F1F5F9] dark:active:bg-white/25 transition-colors disabled:opacity-40 select-none"
      >
        0
      </button>
      <button
        onClick={onBack}
        disabled={disabled}
        className="h-[54px] rounded-2xl bg-white dark:bg-white/10 border border-[#E2E8F0] dark:border-white/15 shadow-xs dark:shadow-none text-[#181A20] dark:text-white flex items-center justify-center active:bg-[#F1F5F9] dark:active:bg-white/25 transition-colors disabled:opacity-40 select-none"
      >
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12H9M15 6l-6 6 6 6" />
        </svg>
      </button>
    </div>
  );
}

/* ── PIN dots (6-digit) ───────────────────────────────────────── */
function PinDots({ value, max = 6, shake }: { value: string; max?: number; shake: boolean }) {
  return (
    <motion.div
      className="flex justify-center gap-4"
      animate={shake ? { x: [0, -8, 8, -6, 6, -4, 4, 0] } : {}}
      transition={{ duration: 0.4 }}
    >
      {Array.from({ length: max }).map((_, i) => (
        <motion.div
          key={i}
          initial={false}
          animate={i < value.length ? { scale: [1, 1.25, 1] } : {}}
          transition={{ duration: 0.15 }}
          className={`w-3.5 h-3.5 rounded-full border-2 transition-all ${
            i < value.length
              ? 'bg-[#F0B90B] border-[#F0B90B] shadow-[0_0_8px_rgba(240,185,11,0.45)]'
              : 'border-[#CBD5E1] bg-transparent dark:bg-white/20'
          }`}
        />
      ))}
    </motion.div>
  );
}

/* ── Biometric icon ───────────────────────────────────────────── */
function BiometricIcon({ loading }: { loading: boolean }) {
  return (
    <div className="relative flex items-center justify-center">
      {/* Outer pulse rings */}
      {!loading && (
        <>
          <motion.div
            className="absolute w-32 h-32 rounded-full"
            style={{ boxShadow: '0 0 0 1px rgba(240, 185, 11, 0.25)' }}
            animate={{ scale: [1, 1.5, 1.5], opacity: [0.5, 0, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
          />
          <motion.div
            className="absolute w-32 h-32 rounded-full"
            style={{ boxShadow: '0 0 0 1px rgba(240, 185, 11, 0.35)' }}
            animate={{ scale: [1, 1.35, 1.35], opacity: [0.6, 0, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeOut', delay: 0.4 }}
          />
        </>
      )}
      {/* Icon container */}
      <motion.div
        className="w-24 h-24 rounded-full flex items-center justify-center relative z-10"
        style={{ background: 'linear-gradient(135deg, rgba(240,185,11,0.16) 0%, rgba(240,185,11,0.06) 100%)', border: '1px solid rgba(217,155,0,0.4)' }}
        animate={loading ? { scale: [1, 1.05, 1] } : {}}
        transition={{ duration: 0.8, repeat: Infinity }}
      >
        {loading ? (
          <svg className="animate-spin w-10 h-10 text-[#B7791F] dark:text-[#F0B90B]" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="rgba(240,185,11,0.25)" strokeWidth="2.5" />
            <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        ) : (
          <i className="fa-solid fa-fingerprint text-[40px] text-[#B7791F] dark:text-[#F0B90B]" />
        )}
      </motion.div>
    </div>
  );
}

/* ── Main component ───────────────────────────────────────────── */
export default function BusinessSecurityScreen() {
  const { hasBiometrics, pinState, maxAttempts, verifyPin, triggerBiometrics, resetBusinessPin } = useBusinessSecurity();
  const { user, verifyPasscode } = useAuth();
  const [, navigate] = useLocation();

  /* Which UI to show */
  const [mode, setMode] = useState<Mode>(() => {
    const now = Date.now();
    if (pinState.lockedUntil && now < pinState.lockedUntil) return 'locked';
    return hasBiometrics ? 'biometric' : 'pin';
  });

  /* PIN entry */
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [shake, setShake] = useState(false);

  /* Biometric */
  const [bioLoading, setBioLoading] = useState(false);
  const [bioFailed, setBioFailed] = useState(false);

  /* Lockout countdown */
  const [countdown, setCountdown] = useState('');

  /* Recovery flow */
  const [recoveryInput, setRecoveryInput] = useState('');
  const [recoveryError, setRecoveryError] = useState('');
  const [newPinValue, setNewPinValue] = useState('');
  const [confirmPinValue, setConfirmPinValue] = useState('');
  const [recoveryShake, setRecoveryShake] = useState(false);

  /* ── Effects ─────────────────────────── */

  // Sync mode when biometrics check resolves
  useEffect(() => {
    if (mode === 'biometric' && !hasBiometrics) setMode('pin');
  }, [hasBiometrics]);

  // No auto-trigger — user must tap the biometric button explicitly

  // Lockout countdown ticker
  useEffect(() => {
    if (mode !== 'locked') return;
    function tick() {
      const now = Date.now();
      const until = pinState.lockedUntil ?? 0;
      if (now >= until) {
        setMode('pin');
        return;
      }
      setCountdown(fmtCountdown(until - now));
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [mode, pinState.lockedUntil]);

  /* ── Biometric handler ───────────────── */
  async function handleBiometrics() {
    if (bioLoading) return;
    setBioLoading(true);
    setBioFailed(false);
    try {
      await triggerBiometrics();
      // context sets isVerified=true → gate unmounts this screen
    } catch {
      setBioLoading(false);
      setBioFailed(true);
    }
  }

  /* ── PIN handlers ────────────────────── */
  function addDigit(k: string) {
    if (pin.length >= 6) return;
    const next = pin + k;
    setPin(next);
    setPinError('');
    if (next.length === 6) {
      setTimeout(() => submitPin(next), 80);
    }
  }

  function removeDigit() {
    setPin(p => p.slice(0, -1));
    setPinError('');
  }

  function submitPin(p: string) {
    const result = verifyPin(p);
    if (result.success) return; // gate unmounts
    triggerShake();
    setPin('');
    if (result.nowLocked) {
      setMode('locked');
    } else {
      setPinError(result.error ?? 'Incorrect PIN');
    }
  }

  function triggerShake() {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  }

  /* ── Recovery handlers ───────────────── */
  function addRecoveryDigit(k: string) {
    const mode2 = mode;
    if (mode2 === 'recovery_passcode') {
      if (recoveryInput.length >= 6) return;
      const next = recoveryInput + k;
      setRecoveryInput(next);
      setRecoveryError('');
      if (next.length === 6) setTimeout(() => submitRecoveryPasscode(next), 80);
    } else if (mode2 === 'recovery_new_pin') {
      if (newPinValue.length >= 6) return;
      const next = newPinValue + k;
      setNewPinValue(next);
      if (next.length === 6) setTimeout(() => setMode('recovery_confirm'), 80);
    } else if (mode2 === 'recovery_confirm') {
      if (confirmPinValue.length >= 6) return;
      const next = confirmPinValue + k;
      setConfirmPinValue(next);
      setRecoveryError('');
      if (next.length === 6) setTimeout(() => submitRecoveryConfirm(next), 80);
    }
  }

  function removeRecoveryDigit() {
    if (mode === 'recovery_passcode') setRecoveryInput(p => p.slice(0, -1));
    else if (mode === 'recovery_new_pin') setNewPinValue(p => p.slice(0, -1));
    else if (mode === 'recovery_confirm') setConfirmPinValue(p => p.slice(0, -1));
    setRecoveryError('');
  }

  async function submitRecoveryPasscode(code: string) {
    if (!user || !(await verifyPasscode(code))) {
      setRecoveryShake(true);
      setTimeout(() => setRecoveryShake(false), 500);
      setRecoveryInput('');
      setRecoveryError('Incorrect account passcode. Try again.');
      return;
    }
    setMode('recovery_new_pin');
  }

  function submitRecoveryConfirm(confirm: string) {
    if (confirm !== newPinValue) {
      setRecoveryShake(true);
      setTimeout(() => setRecoveryShake(false), 500);
      setConfirmPinValue('');
      setRecoveryError('PINs do not match. Try again.');
      setMode('recovery_new_pin');
      setNewPinValue('');
      return;
    }
    resetBusinessPin(newPinValue);
    // Reset recovery state and go back to PIN mode (now verified)
    setRecoveryInput('');
    setNewPinValue('');
    setConfirmPinValue('');
    // Auto-verify after successful reset
    verifyPin(newPinValue);
  }

  function startRecovery() {
    setRecoveryInput('');
    setRecoveryError('');
    setNewPinValue('');
    setConfirmPinValue('');
    setMode('recovery_passcode');
  }

  /* ── Recovery active input & dots ───── */
  const recoveryActiveValue =
    mode === 'recovery_passcode' ? recoveryInput :
    mode === 'recovery_new_pin' ? newPinValue :
    confirmPinValue;

  /* ── Render ──────────────────────────── */
  return (
    <div
      className="vexa-security-screen fixed inset-0 flex flex-col"
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      {/* Font Awesome (already loaded via index.html CDN or inline) */}
      <style>{`
        @keyframes bizShieldPulse {
          0%, 100% { filter: drop-shadow(0 0 0px rgba(240,185,11,0)); }
          50%       { filter: drop-shadow(0 0 16px rgba(240,185,11,0.35)); }
        }
        .biz-shield { animation: bizShieldPulse 3s ease-in-out infinite; }
      `}</style>

      {/* Top bar */}
      <div
        className="flex-none flex items-center justify-between px-5"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 16px)', paddingBottom: 12 }}
      >
        <button
          onClick={() => navigate('/')}
          className="w-9 h-9 rounded-full bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15 text-[#181A20] dark:text-white flex items-center justify-center active:scale-95 transition-all"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
        </button>

        <p className="text-[#181A20]/80 dark:text-white/80 text-[13px] font-semibold tracking-wide">Vexa Business</p>

        <div className="w-9" />
      </div>

      {/* Shield + title */}
      <div className="flex-none flex flex-col items-center pt-4 pb-6 px-6">
        <div className="biz-shield mb-3">
          <svg width="52" height="52" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z"
              fill="url(#shieldGrad)"
              stroke="rgba(217,155,0,0.65)"
              strokeWidth="1"
            />
            <defs>
              <linearGradient id="shieldGrad" x1="12" y1="2" x2="12" y2="23" gradientUnits="userSpaceOnUse">
                <stop stopColor="rgba(240,185,11,0.32)" />
                <stop offset="1" stopColor="rgba(240,185,11,0.1)" />
              </linearGradient>
            </defs>
            <path d="M9 12l2 2 4-4" stroke="#B7791F" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="dark:stroke-[#F0B90B]" />
          </svg>
        </div>
        <p className="text-[#181A20] dark:text-white text-[20px] font-bold tracking-tight">Business Security</p>
        <p className="text-[#64748B] dark:text-white/50 text-[12px] mt-1 text-center">Verify your identity to access Vexa Business</p>
      </div>

      {/* Mode content */}
      <div className="flex-1 flex flex-col px-6 overflow-hidden">
        <AnimatePresence mode="wait">

          {/* ── BIOMETRIC ── */}
          {mode === 'biometric' && (
            <motion.div
              key="biometric"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.25 }}
              className="flex-1 flex flex-col items-center justify-center gap-6 pb-8"
            >
              <button
                onClick={handleBiometrics}
                disabled={bioLoading}
                className="flex flex-col items-center gap-5 active:scale-95 transition-transform disabled:cursor-default"
              >
                <BiometricIcon loading={bioLoading} />
                <div className="text-center">
                  <p className="text-[#181A20] dark:text-white text-[15px] font-semibold">
                    {bioLoading ? 'Scanning…' : bioFailed ? 'Verification failed' : 'Use Face ID or Fingerprint'}
                  </p>
                  <p className="text-[#64748B] dark:text-white/40 text-[12px] mt-1">
                    {bioLoading ? 'Hold still and look at your device' : bioFailed ? 'Tap to try again' : 'Tap to authenticate'}
                  </p>
                </div>
              </button>

              <button
                onClick={() => { setMode('pin'); }}
                className="text-[#9A6800] hover:text-[#7A5200] dark:text-[#F0B90B] dark:hover:text-[#FCD535] text-[13px] font-semibold py-2 transition-colors"
              >
                Use PIN instead
              </button>
            </motion.div>
          )}

          {/* ── PIN ENTRY ── */}
          {mode === 'pin' && (
            <motion.div
              key="pin"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.25 }}
              className="flex-1 flex flex-col"
            >
              <div className="flex-1 flex flex-col items-center justify-center gap-5">
                <div className="text-center">
                  <p className="text-[#181A20] dark:text-white text-[16px] font-semibold">Enter Business PIN</p>
                  <p className="text-[#64748B] dark:text-white/40 text-[12px] mt-1">Enter your 6-digit Business PIN</p>
                </div>

                <PinDots value={pin} max={6} shake={shake} />

                <AnimatePresence>
                  {pinError && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="text-[#DC2626] dark:text-[#ff6b6b] text-[12px] font-medium text-center px-4"
                    >
                      {pinError}
                    </motion.p>
                  )}
                </AnimatePresence>

                {/* Attempt indicator dots */}
                {pinState.attempts > 0 && (
                  <div className="flex gap-2">
                    {Array.from({ length: maxAttempts }).map((_, i) => (
                      <div
                        key={i}
                        className={`w-2 h-2 rounded-full ${
                          i < pinState.attempts ? 'bg-[#EF4444]' : 'bg-[#CBD5E1] dark:bg-white/20'
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>

              <div className="pb-6 space-y-4">
                <Keypad onDigit={addDigit} onBack={removeDigit} />

                <div className="flex justify-between items-center pt-1">
                  {hasBiometrics ? (
                    <button
                      onClick={() => { setMode('biometric'); setBioFailed(false); }}
                      className="flex items-center gap-1.5 text-[#9A6800] hover:text-[#7A5200] dark:text-[#F0B90B] dark:hover:text-[#FCD535] text-[12px] font-medium transition-colors"
                    >
                      <i className="fa-solid fa-fingerprint text-[16px]" />
                      Use biometrics
                    </button>
                  ) : <div />}

                  <button
                    onClick={startRecovery}
                    className="text-[#64748B] dark:text-white/50 text-[12px] font-medium"
                  >
                    Forgot Business PIN?
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── LOCKED ── */}
          {mode === 'locked' && (
            <motion.div
              key="locked"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="flex-1 flex flex-col items-center justify-center gap-6 px-2"
            >
              <motion.div
                className="w-20 h-20 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(255,107,107,0.15)', border: '1px solid rgba(255,107,107,0.4)' }}
                animate={{ scale: [1, 1.04, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
                  <rect x="5" y="11" width="14" height="10" rx="2" fill="rgba(255,107,107,0.2)" stroke="#ef4444" strokeWidth="1.8" />
                  <path d="M8 11V7a4 4 0 0 1 8 0v4" stroke="#ef4444" strokeWidth="1.8" strokeLinecap="round" />
                  <circle cx="12" cy="16" r="1.5" fill="#ef4444" />
                </svg>
              </motion.div>

              <div className="text-center">
                <p className="text-[#181A20] dark:text-white text-[18px] font-bold">Access Temporarily Locked</p>
                <p className="text-[#64748B] dark:text-white/50 text-[12px] mt-2 leading-relaxed px-4">
                  Too many incorrect PIN attempts. For your security, Business access has been locked.
                </p>
              </div>

              <div
                className="rounded-2xl px-8 py-5 text-center"
                style={{ background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.25)' }}
              >
                <p className="text-[#64748B] dark:text-white/50 text-[11px] font-medium uppercase tracking-widest mb-1">Try again in</p>
                <p className="text-[#DC2626] dark:text-[#ff6b6b] text-[36px] font-bold tracking-tight font-mono">{countdown}</p>
              </div>

              <button
                onClick={startRecovery}
                className="text-[#9A6800] hover:text-[#7A5200] dark:text-[#F0B90B] dark:hover:text-[#FCD535] text-[13px] font-semibold py-2 transition-colors"
              >
                Forgot Business PIN? Recover now
              </button>
            </motion.div>
          )}

          {/* ── RECOVERY: VERIFY PASSCODE ── */}
          {mode === 'recovery_passcode' && (
            <motion.div
              key="recovery_passcode"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.25 }}
              className="flex-1 flex flex-col"
            >
              <div className="flex-1 flex flex-col items-center justify-center gap-5">
                <div className="text-center">
                  <p className="text-[#64748B] dark:text-white/50 text-[11px] font-semibold uppercase tracking-widest mb-2">PIN Recovery · Step 1 of 3</p>
                  <p className="text-[#181A20] dark:text-white text-[16px] font-semibold">Verify Your Identity</p>
                  <p className="text-[#64748B] dark:text-white/40 text-[12px] mt-1">Enter your Vexa account passcode</p>
                </div>

                <PinDots value={recoveryInput} max={6} shake={recoveryShake} />

                <AnimatePresence>
                  {recoveryError && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="text-[#DC2626] dark:text-[#ff6b6b] text-[12px] font-medium text-center px-4"
                    >
                      {recoveryError}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              <div className="pb-6 space-y-4">
                <Keypad onDigit={addRecoveryDigit} onBack={removeRecoveryDigit} />
                <div className="flex justify-center pt-1">
                  <button onClick={() => setMode('pin')} className="text-[#64748B] dark:text-white/40 text-[12px] font-medium">
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── RECOVERY: NEW PIN ── */}
          {mode === 'recovery_new_pin' && (
            <motion.div
              key="recovery_new_pin"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.25 }}
              className="flex-1 flex flex-col"
            >
              <div className="flex-1 flex flex-col items-center justify-center gap-5">
                <div className="text-center">
                  <p className="text-[#64748B] dark:text-white/50 text-[11px] font-semibold uppercase tracking-widest mb-2">PIN Recovery · Step 2 of 3</p>
                  <p className="text-[#181A20] dark:text-white text-[16px] font-semibold">Set New Business PIN</p>
                  <p className="text-[#64748B] dark:text-white/40 text-[12px] mt-1">Choose a new 6-digit Business PIN</p>
                </div>
                <PinDots value={newPinValue} max={6} shake={false} />
              </div>
              <div className="pb-6 space-y-4">
                <Keypad onDigit={addRecoveryDigit} onBack={removeRecoveryDigit} />
                <div className="flex justify-center pt-1">
                  <button onClick={() => { setMode('recovery_passcode'); setNewPinValue(''); }} className="text-[#64748B] dark:text-white/40 text-[12px] font-medium">
                    Back
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── RECOVERY: CONFIRM PIN ── */}
          {mode === 'recovery_confirm' && (
            <motion.div
              key="recovery_confirm"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.25 }}
              className="flex-1 flex flex-col"
            >
              <div className="flex-1 flex flex-col items-center justify-center gap-5">
                <div className="text-center">
                  <p className="text-[#64748B] dark:text-white/50 text-[11px] font-semibold uppercase tracking-widest mb-2">PIN Recovery · Step 3 of 3</p>
                  <p className="text-[#181A20] dark:text-white text-[16px] font-semibold">Confirm New PIN</p>
                  <p className="text-[#64748B] dark:text-white/40 text-[12px] mt-1">Re-enter your new Business PIN</p>
                </div>
                <PinDots value={confirmPinValue} max={6} shake={recoveryShake} />
                <AnimatePresence>
                  {recoveryError && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="text-[#DC2626] dark:text-[#ff6b6b] text-[12px] font-medium text-center"
                    >
                      {recoveryError}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
              <div className="pb-6 space-y-4">
                <Keypad onDigit={addRecoveryDigit} onBack={removeRecoveryDigit} />
                <div className="flex justify-center pt-1">
                  <button onClick={() => { setMode('recovery_new_pin'); setConfirmPinValue(''); setNewPinValue(''); }} className="text-[#64748B] dark:text-white/40 text-[12px] font-medium">
                    Back
                  </button>
                </div>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
