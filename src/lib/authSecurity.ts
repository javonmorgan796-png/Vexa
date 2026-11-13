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