import React, { createContext, useContext, useState, useEffect } from 'react';

const STORAGE_KEY = 'vexa_biz_pin';
const MAX_ATTEMPTS = 3;
const LOCKOUT_MS = 5 * 60 * 1000; // 5 minutes

export interface BizPinState {
  pin: string;
  attempts: number;
  lockedUntil: number | null;
}

interface BusinessSecurityContextType {
  isVerified: boolean;
  hasBiometrics: boolean;
  pinState: BizPinState;
  maxAttempts: number;
  verifyPin: (pin: string) => { success: boolean; error?: string; nowLocked?: boolean };
  triggerBiometrics: () => Promise<boolean>;
  clearVerification: () => void;
  resetBusinessPin: (newPin: string) => void;
}

const Ctx = createContext<BusinessSecurityContextType | null>(null);

function load(): BizPinState {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    return s ? JSON.parse(s) : { pin: '123456', attempts: 0, lockedUntil: null };
  } catch {
    return { pin: '123456', attempts: 0, lockedUntil: null };
  }
}

export function BusinessSecurityProvider({ children }: { children: React.ReactNode }) {
  const [isVerified, setIsVerified] = useState(false);
  const [hasBiometrics, setHasBiometrics] = useState(true); // default true for demo
  const [state, setState] = useState<BizPinState>(load);

  useEffect(() => {
    (async () => {
      try {
        if (
          typeof PublicKeyCredential !== 'undefined' &&
          typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function'
        ) {
          const ok = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
          setHasBiometrics(ok);
        }
        // else: keep default true (matches existing app sign-in screen behaviour)
      } catch {
        // keep default true
      }
    })();
  }, []);

  function persist(s: BizPinState) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    setState(s);
  }

  function verifyPin(pin: string): { success: boolean; error?: string; nowLocked?: boolean } {
    const now = Date.now();

    // Still locked?
    if (state.lockedUntil && now < state.lockedUntil) {
      return { success: false, error: 'locked', nowLocked: true };
    }

    // Correct PIN
    if (pin === state.pin) {
      persist({ ...state, attempts: 0, lockedUntil: null });
      setIsVerified(true);
      return { success: true };
    }

    // Wrong PIN — increment attempts
    const attempts = state.attempts + 1;
    if (attempts >= MAX_ATTEMPTS) {
      persist({ ...state, attempts, lockedUntil: now + LOCKOUT_MS });
      return {
        success: false,
        error: 'Incorrect PIN. Access locked for 5 minutes.',
        nowLocked: true,
      };
    }

    persist({ ...state, attempts });
    const left = MAX_ATTEMPTS - attempts;
    return {
      success: false,
      error: `Incorrect PIN. ${left} attempt${left !== 1 ? 's' : ''} remaining.`,
    };
  }

  async function triggerBiometrics(): Promise<boolean> {
    // Simulate device biometric prompt with realistic 1.5 s delay
    await new Promise(r => setTimeout(r, 1500));
    persist({ ...state, attempts: 0, lockedUntil: null });
    setIsVerified(true);
    return true;
  }

  function clearVerification() {
    setIsVerified(false);
  }

  function resetBusinessPin(newPin: string) {
    persist({ pin: newPin, attempts: 0, lockedUntil: null });
  }

  return (
    <Ctx.Provider
      value={{
        isVerified,
        hasBiometrics,
        pinState: state,
        maxAttempts: MAX_ATTEMPTS,
        verifyPin,
        triggerBiometrics,
        clearVerification,
        resetBusinessPin,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useBusinessSecurity() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useBusinessSecurity must be used within BusinessSecurityProvider');
  return ctx;
}
