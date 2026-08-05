import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

const MAX_ATTEMPTS = 3;
const LOCKOUT_MS   = 5 * 60 * 1000; // 5 minutes

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

const DEFAULT_STATE: BizPinState = { pin: '123456', attempts: 0, lockedUntil: null };

export function BusinessSecurityProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  const [isVerified, setIsVerified] = useState(false);
  const [hasBiometrics, setHasBiometrics] = useState(true);
  const [state, setState] = useState<BizPinState>(DEFAULT_STATE);
  const [loaded, setLoaded] = useState(false);

  /* Detect biometrics */
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
      } catch { /* keep default true */ }
    })();
  }, []);

  /* Load PIN state from Supabase */
  const loadState = useCallback(async () => {
    if (!user) { setState(DEFAULT_STATE); setLoaded(true); return; }

    const { data } = await supabase
      .from('business_security')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (data) {
      setState({
        pin:         data.pin,
        attempts:    data.attempts,
        lockedUntil: data.locked_until ? new Date(data.locked_until).getTime() : null,
      });
    } else {
      // Row doesn't exist yet — create it
      await supabase.from('business_security').insert({
        user_id:      user.id,
        pin:          '123456',
        attempts:     0,
        locked_until: null,
      });
      setState(DEFAULT_STATE);
    }
    setLoaded(true);
  }, [user?.id]);

  useEffect(() => { loadState(); }, [loadState]);

  async function persist(s: BizPinState) {
    setState(s);
    if (!user) return;
    await supabase.from('business_security').upsert({
      user_id:      user.id,
      pin:          s.pin,
      attempts:     s.attempts,
      locked_until: s.lockedUntil ? new Date(s.lockedUntil).toISOString() : null,
    }, { onConflict: 'user_id' });
  }

  function verifyPin(pin: string): { success: boolean; error?: string; nowLocked?: boolean } {
    const now = Date.now();

    if (state.lockedUntil && now < state.lockedUntil) {
      return { success: false, error: 'locked', nowLocked: true };
    }

    if (pin === state.pin) {
      persist({ ...state, attempts: 0, lockedUntil: null });
      setIsVerified(true);
      return { success: true };
    }

    const attempts = state.attempts + 1;
    if (attempts >= MAX_ATTEMPTS) {
      persist({ ...state, attempts, lockedUntil: now + LOCKOUT_MS });
      return { success: false, error: 'Incorrect PIN. Access locked for 5 minutes.', nowLocked: true };
    }

    persist({ ...state, attempts });
    const left = MAX_ATTEMPTS - attempts;
    return { success: false, error: `Incorrect PIN. ${left} attempt${left !== 1 ? 's' : ''} remaining.` };
  }

  async function triggerBiometrics(): Promise<boolean> {
    await new Promise(r => setTimeout(r, 1500));
    persist({ ...state, attempts: 0, lockedUntil: null });
    setIsVerified(true);
    return true;
  }

  function clearVerification() { setIsVerified(false); }

  function resetBusinessPin(newPin: string) {
    persist({ pin: newPin, attempts: 0, lockedUntil: null });
  }

  if (!loaded) {
    // Render children anyway — verifyPin will use default state
  }

  return (
    <Ctx.Provider value={{
      isVerified, hasBiometrics,
      pinState: state, maxAttempts: MAX_ATTEMPTS,
      verifyPin, triggerBiometrics,
      clearVerification, resetBusinessPin,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useBusinessSecurity() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useBusinessSecurity must be used within BusinessSecurityProvider');
  return ctx;
}
