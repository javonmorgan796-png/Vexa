import { supabase } from '@/lib/supabase';

export const LOGIN_FAILURE_LIMIT = 3;
export const LOGIN_LOCKOUT_MS = 5 * 60 * 1000;

export type LoginLockoutResult = {
  lockedUntil?: number;
  failedAttempts?: number;
};

export function normalizeLoginPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('234')) {
    return `0${digits.slice(3).replace(/^0/, '')}`;
  }
  return digits.startsWith('0') ? digits : `0${digits}`;
}

function parseLockout(data: { locked_until?: string | null; failed_attempts?: number } | null): LoginLockoutResult {
  const lockedUntil = data?.locked_until ? new Date(data.locked_until).getTime() : undefined;
  return {
    lockedUntil: lockedUntil && Number.isFinite(lockedUntil) ? lockedUntil : undefined,
    failedAttempts: typeof data?.failed_attempts === 'number' ? data.failed_attempts : undefined,
  };
}

export async function checkRemoteLoginLockout(phone: string): Promise<LoginLockoutResult> {
  try {
    const { data, error } = await supabase.rpc('check_login_lockout', {
      p_identifier: normalizeLoginPhone(phone),
    });
    if (error) return {};
    return parseLockout(data);
  } catch {
    // The local lock remains active if the optional security migration has
    // not been run in Supabase yet.
    return {};
  }
}

export async function recordRemoteLoginFailure(phone: string): Promise<LoginLockoutResult> {
  try {
    const { data, error } = await supabase.rpc('record_login_failure', {
      p_identifier: normalizeLoginPhone(phone),
    });
    if (error) return {};
    return parseLockout(data);
  } catch {
    return {};
  }
}

export async function clearRemoteLoginFailures(phone: string): Promise<void> {
  try {
    await supabase.rpc('clear_login_lockout', {
      p_identifier: normalizeLoginPhone(phone),
    });
  } catch {
    // A successful login should never be blocked by cleanup of the counter.
  }
}