import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export interface AccountSecurityState {
  sleepModeActive: boolean;
  sleepModeActivatedAt: string | null;
  freezeActive: boolean;
  freezeActivatedAt: string | null;
}

interface AccountSecurityContextValue {
  state: AccountSecurityState;
  loading: boolean;
  busy: boolean;
  error: string;
  refreshSecurity: () => Promise<void>;
  activateSleepMode: () => Promise<{ success: boolean; error?: string }>;
  activateFreeze: () => Promise<{ success: boolean; error?: string }>;
  requestUnlockCode: () => Promise<{ success: boolean; error?: string }>;
  unlock: (lockType: 'sleep_mode' | 'freeze_account', pin: string, code: string) => Promise<{ success: boolean; error?: string }>;
}

const defaultState: AccountSecurityState = {
  sleepModeActive: false,
  sleepModeActivatedAt: null,
  freezeActive: false,
  freezeActivatedAt: null,
};

const AccountSecurityContext = createContext<AccountSecurityContextValue | null>(null);

function normalizedState(value: Record<string, unknown>): AccountSecurityState {
  return {
    sleepModeActive: Boolean(value.sleepModeActive ?? value.sleep_mode_active),
    sleepModeActivatedAt: (value.sleepModeActivatedAt ?? value.sleep_mode_activated_at ?? null) as string | null,
    freezeActive: Boolean(value.freezeActive ?? value.freeze_active),
    freezeActivatedAt: (value.freezeActivatedAt ?? value.freeze_activated_at ?? null) as string | null,
  };
}

async function securityRequest(path: string, init: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Your session has expired. Please sign in again.');
  const response = await fetch(path, {
    ...init,
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      ...(init.headers ?? {}),
    },
  });
  const body = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (!response.ok) throw new Error(typeof body?.message === 'string' ? body.message : 'Account security request failed');
  return body ?? {};
}

function devicePayload() {
  const ua = navigator.userAgent;
  const isMobile = /Mobile|Android|iPhone|iPad/i.test(ua);
  return {
    deviceName: isMobile ? 'Mobile browser' : 'Web browser',
    deviceType: isMobile ? 'mobile' : 'desktop',
    // The API records the trusted source IP. This timezone is only a coarse
    // browser-provided location hint and is never treated as the source of truth.
    location: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
  };
}

export function AccountSecurityProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = useState<AccountSecurityState>(defaultState);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [unlockRequestId, setUnlockRequestId] = useState<string | null>(null);

  const refreshSecurity = useCallback(async () => {
    if (!user) {
      setState(defaultState);
      setLoading(false);
      return;
    }
    try {
      const body = await securityRequest('/api/security/state');
      setState(normalizedState(body));
      setError('');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not load account security state');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    setLoading(true);
    void refreshSecurity();
    if (!user?.id) return;
    const interval = window.setInterval(() => { void refreshSecurity(); }, 15000);
    return () => window.clearInterval(interval);
  }, [user?.id, refreshSecurity]);

  const mutateLock = async (path: string) => {
    setBusy(true);
    setError('');
    try {
      const body = await securityRequest(path, {
        method: 'POST',
        body: JSON.stringify(devicePayload()),
      });
      setState(normalizedState(body));
      return { success: true };
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'Could not update account security';
      setError(message);
      return { success: false, error: message };
    } finally {
      setBusy(false);
    }
  };

  const requestUnlockCode = async () => {
    setBusy(true);
    setError('');
    try {
      const body = await securityRequest('/api/termii/otp/send', {
        method: 'POST',
        body: JSON.stringify({ purpose: 'sleep_mode_deactivate' }),
      });
      const requestId = typeof body.requestId === 'string' ? body.requestId : null;
      setUnlockRequestId(requestId);
      return { success: Boolean(requestId) };
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'Could not send the verification code';
      setError(message);
      return { success: false, error: message };
    } finally {
      setBusy(false);
    }
  };

  const unlock = async (lockType: 'sleep_mode' | 'freeze_account', pin: string, code: string) => {
    setBusy(true);
    setError('');
    try {
      if (!unlockRequestId) throw new Error('Request a new verification code first');
      const verification = await securityRequest('/api/termii/otp/verify', {
        method: 'POST',
        body: JSON.stringify({ requestId: unlockRequestId, code }),
      });
      if (!verification.verified) throw new Error('That SMS code is invalid or expired');

      const body = await securityRequest(
        lockType === 'sleep_mode' ? '/api/security/sleep-mode/deactivate' : '/api/security/freeze/deactivate',
        {
          method: 'POST',
          body: JSON.stringify({ ...devicePayload(), pin }),
        },
      );
      setState(normalizedState(body));
      setUnlockRequestId(null);
      return { success: true };
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'Could not remove the account lock';
      setError(message);
      return { success: false, error: message };
    } finally {
      setBusy(false);
    }
  };

  return (
    <AccountSecurityContext.Provider value={{
      state,
      loading,
      busy,
      error,
      refreshSecurity,
      activateSleepMode: () => mutateLock('/api/security/sleep-mode/activate'),
      activateFreeze: () => mutateLock('/api/security/freeze/activate'),
      requestUnlockCode,
      unlock,
    }}>
      {children}
    </AccountSecurityContext.Provider>
  );
}

export function useAccountSecurity() {
  const context = useContext(AccountSecurityContext);
  if (!context) throw new Error('useAccountSecurity must be used within AccountSecurityProvider');
  return context;
}