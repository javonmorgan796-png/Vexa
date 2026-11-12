import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

const MAX_ATTEMPTS = 3;

export interface BizPinState {
  hasCustomPin: boolean;
  attempts: number;
  lockedUntil: number | null;
}

interface BusinessSecurityContextType {
  isVerified: boolean;
  hasBiometrics: boolean;
  pinState: BizPinState;
  maxAttempts: number;
  verifyPin: (pin: string) => Promise<{ success: boolean; error?: string; nowLocked?: boolean }>;
  triggerBiometrics: () => Promise<boolean>;
  clearVerification: () => void;
  resetBusinessPin: (newPin: string, passcode: string) => Promise<{ success: boolean; error?: string }>;
}

const Ctx = createContext<BusinessSecurityContextType | null>(null);

const DEFAULT_STATE: BizPinState = { hasCustomPin: false, attempts: 0, lockedUntil: null };

export function BusinessSecurityProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  const [isVerified, setIsVerified] = useState(false);
  const [hasBiometrics, setHasBiometrics] = useState(true);
  const [state, setState] = useState<BizPinState>(DEFAULT_STATE);

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

  const loadState = useCallback(async () => {
    if (!user) {
      setState(DEFAULT_STATE);
      return;
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;

    try {
      const resp = await fetch('/api/business/security/status', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!resp.ok) return;
      const body = await resp.json().catch(() => null) as {
        hasCustomPin?: boolean;
        attempts?: number;
        lockedUntil?: number | null;
      } | null;
      if (body) {
        setState({
          hasCustomPin: Boolean(body.hasCustomPin),
          attempts: Number(body.attempts ?? 0),
          lockedUntil: typeof body.lockedUntil === 'number' ? body.lockedUntil : null,
        });
      }
    } catch {
      // Ignore transient network errors
    }
  }, [user?.id]);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  async function verifyPin(pin: string): Promise<{ success: boolean; error?: string; nowLocked?: boolean }> {
    const now = Date.now();
    if (state.lockedUntil && now < state.lockedUntil) {
      return { success: false, error: 'locked', nowLocked: true };
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      return { success: false, error: 'Session expired. Please sign in again.' };
    }

    const resp = await fetch('/api/business/security/verify-pin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ pin }),
    });
    const body = await resp.json().catch(() => null) as {
      success?: boolean;
      error?: string;
      attempts?: number;
      lockedUntil?: number | null;
      nowLocked?: boolean;
    } | null;

    if (!resp.ok || !body?.success) {
      setState(prev => ({
        ...prev,
        attempts: typeof body?.attempts === 'number' ? body.attempts : prev.attempts,
        lockedUntil: typeof body?.lockedUntil === 'number' ? body.lockedUntil : prev.lockedUntil,
      }));
      return {
        success: false,
        error: body?.error || 'Incorrect PIN.',
        nowLocked: Boolean(body?.nowLocked),
      };
    }

    setState(prev => ({ ...prev, hasCustomPin: true, attempts: 0, lockedUntil: null }));
    setIsVerified(true);
    return { success: true };
  }

  async function triggerBiometrics(): Promise<boolean> {
    if (!state.hasCustomPin) {
      throw new Error('Set your 6-digit Business PIN before using biometrics.');
    }
    await new Promise(r => setTimeout(r, 800));
    setState(prev => ({ ...prev, attempts: 0, lockedUntil: null }));
    setIsVerified(true);
    return true;
  }

  function clearVerification() {
    setIsVerified(false);
  }

  async function resetBusinessPin(
    newPin: string,
    passcode: string,
  ): Promise<{ success: boolean; error?: string }> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      return { success: false, error: 'Session expired. Please sign in again.' };
    }
    const resp = await fetch('/api/business/security/reset-pin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ newPin, passcode }),
    });
    const body = await resp.json().catch(() => null) as { success?: boolean; message?: string } | null;
    if (!resp.ok || !body?.success) {
      return { success: false, error: body?.message || 'Could not reset Business PIN.' };
    }
    setState({ hasCustomPin: true, attempts: 0, lockedUntil: null });
    return { success: true };
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
