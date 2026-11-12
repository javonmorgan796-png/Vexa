import { pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";
import { supabaseRest, supabaseRpc } from "./supabaseAdmin";

const PBKDF2_PREFIX = "pbkdf2_sha512$";
const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_KEYLEN = 64;

interface AttemptRecord {
  attempts: number;
  lockedUntil?: number;
}

const memoryPinAttempts = new Map<string, AttemptRecord>();

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of memoryPinAttempts) {
    if (v.lockedUntil && v.lockedUntil <= now) memoryPinAttempts.delete(k);
  }
}, 60_000).unref();

export function hashPin(pin: string): string {
  const salt = randomBytes(16).toString("hex");
  const digest = pbkdf2Sync(pin, salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, "sha512").toString("hex");
  return `${PBKDF2_PREFIX}${salt}$${digest}`;
}

export function verifyPbkdf2Hash(plain: string, stored: string): boolean {
  if (!stored.startsWith(PBKDF2_PREFIX)) return false;
  const parts = stored.split("$");
  if (parts.length !== 3) return false;
  const [, salt, hexDigest] = parts;
  if (!salt || !hexDigest) return false;
  try {
    const computed = pbkdf2Sync(plain, salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, "sha512");
    const expected = Buffer.from(hexDigest, "hex");
    return computed.length === expected.length && timingSafeEqual(computed, expected);
  } catch {
    return false;
  }
}

export function safeEqualString(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

export function hasCustomTransactionPin(row: {
  pin_hash?: string | null;
  pin?: string | null;
} | null | undefined): boolean {
  if (!row) return false;
  if (typeof row.pin_hash === "string" && row.pin_hash.trim().length > 0) return true;
  const legacyPin = typeof row.pin === "string" ? row.pin.trim() : "";
  return /^\d{4}$/.test(legacyPin) && legacyPin !== "0000";
}

export function hasCustomBusinessPin(row: {
  pin_hash?: string | null;
  pin?: string | null;
} | null | undefined): boolean {
  if (!row) return false;
  if (typeof row.pin_hash === "string" && row.pin_hash.trim().length > 0) return true;
  const legacyPin = typeof row.pin === "string" ? row.pin.trim() : "";
  return /^\d{6}$/.test(legacyPin) && legacyPin !== "123456";
}

async function verifyStoredSecret(plain: string, storedHash?: string | null, legacyPlain?: string | null): Promise<{
  matched: boolean;
  needsPbkdf2Upgrade: boolean;
}> {
  const hash = typeof storedHash === "string" ? storedHash.trim() : "";
  if (hash) {
    if (hash.startsWith(PBKDF2_PREFIX)) {
      return { matched: verifyPbkdf2Hash(plain, hash), needsPbkdf2Upgrade: false };
    }
    if (hash.startsWith("$2")) {
      const rpcRes = await supabaseRpc("verify_pgcrypto_hash", { p_plain: plain, p_hash: hash }).catch(() => null);
      if (rpcRes?.ok) {
        const ok = (await rpcRes.json().catch(() => false)) === true;
        return { matched: ok, needsPbkdf2Upgrade: ok };
      }
      return { matched: false, needsPbkdf2Upgrade: false };
    }
  }

  const legacy = typeof legacyPlain === "string" ? legacyPlain.trim() : "";
  if (legacy && safeEqualString(plain, legacy)) {
    return { matched: true, needsPbkdf2Upgrade: true };
  }
  return { matched: false, needsPbkdf2Upgrade: false };
}

export async function verifyUserTransactionPin(
  userId: string,
  suppliedPin: unknown,
  options: { maxAttempts?: number; lockMs?: number } = {},
): Promise<{
  ok: boolean;
  error?: string;
  lockedUntil?: number;
  nowLocked?: boolean;
}> {
  const maxAttempts = options.maxAttempts ?? 5;
  const lockMs = options.lockMs ?? 15 * 60 * 1000;
  const lockKey = `tx:${userId}`;
  const now = Date.now();
  const tracker = memoryPinAttempts.get(lockKey);

  if (tracker?.lockedUntil && tracker.lockedUntil > now) {
    const waitSec = Math.ceil((tracker.lockedUntil - now) / 1000);
    return {
      ok: false,
      lockedUntil: tracker.lockedUntil,
      nowLocked: true,
      error: `Too many incorrect PIN attempts. Try again in ${waitSec} seconds.`,
    };
  }

  if (typeof suppliedPin !== "string" || !/^\d{4}$/.test(suppliedPin)) {
    return { ok: false, error: "Enter a valid 4-digit transaction PIN." };
  }

  const res = await supabaseRest(
    `profiles?id=eq.${encodeURIComponent(userId)}&select=id,pin,pin_hash,pin_failed_attempts,pin_locked_until&limit=1`,
  );
  if (!res.ok) {
    // Fallback if migration columns don't exist yet on Supabase
    const legacyRes = await supabaseRest(
      `profiles?id=eq.${encodeURIComponent(userId)}&select=id,pin&limit=1`,
    );
    if (!legacyRes.ok) {
      return { ok: false, error: "Could not verify your transaction PIN right now." };
    }
    const legacyRows = (await legacyRes.json().catch(() => [])) as Array<{ id: string; pin?: string | null }>;
    const row = legacyRows[0];
    if (!row) return { ok: false, error: "Account profile not found." };
    const legacyPin = typeof row.pin === "string" ? row.pin.trim() : "";
    if (!legacyPin || legacyPin === "0000") {
      return { ok: false, error: "Set your transaction PIN before sending money." };
    }
    if (!safeEqualString(suppliedPin, legacyPin)) {
      const next = (tracker?.attempts ?? 0) + 1;
      if (next >= maxAttempts) {
        const lu = now + lockMs;
        memoryPinAttempts.set(lockKey, { attempts: next, lockedUntil: lu });
        return { ok: false, nowLocked: true, lockedUntil: lu, error: "Too many incorrect PIN attempts. Locked for 15 minutes." };
      }
      memoryPinAttempts.set(lockKey, { attempts: next });
      return { ok: false, error: "Incorrect transaction PIN." };
    }
    memoryPinAttempts.delete(lockKey);
    return { ok: true };
  }

  const rows = (await res.json().catch(() => [])) as Array<{
    id: string;
    pin?: string | null;
    pin_hash?: string | null;
    pin_failed_attempts?: number | null;
    pin_locked_until?: string | null;
  }>;
  const row = rows[0];
  if (!row) return { ok: false, error: "Account profile not found." };

  const dbLockedUntil = row.pin_locked_until ? new Date(row.pin_locked_until).getTime() : 0;
  if (dbLockedUntil > now) {
    const waitSec = Math.ceil((dbLockedUntil - now) / 1000);
    return {
      ok: false,
      lockedUntil: dbLockedUntil,
      nowLocked: true,
      error: `Too many incorrect PIN attempts. Try again in ${waitSec} seconds.`,
    };
  }

  if (!hasCustomTransactionPin(row)) {
    return { ok: false, error: "Set your transaction PIN before sending money." };
  }

  const legacyNonDefault = row.pin && row.pin !== "0000" ? row.pin : null;
  const { matched, needsPbkdf2Upgrade } = await verifyStoredSecret(suppliedPin, row.pin_hash, legacyNonDefault);

  if (!matched) {
    const prevAttempts = Math.max(tracker?.attempts ?? 0, Number(row.pin_failed_attempts ?? 0));
    const nextAttempts = prevAttempts + 1;
    if (nextAttempts >= maxAttempts) {
      const lu = now + lockMs;
      memoryPinAttempts.set(lockKey, { attempts: nextAttempts, lockedUntil: lu });
      await supabaseRest(`profiles?id=eq.${encodeURIComponent(userId)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          pin_failed_attempts: nextAttempts,
          pin_locked_until: new Date(lu).toISOString(),
        }),
      }).catch(() => {});
      return {
        ok: false,
        nowLocked: true,
        lockedUntil: lu,
        error: "Too many incorrect PIN attempts. Locked for 15 minutes.",
      };
    }
    memoryPinAttempts.set(lockKey, { attempts: nextAttempts });
    await supabaseRest(`profiles?id=eq.${encodeURIComponent(userId)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ pin_failed_attempts: nextAttempts }),
    }).catch(() => {});
    const remaining = maxAttempts - nextAttempts;
    return {
      ok: false,
      error: `Incorrect transaction PIN. ${remaining} attempt${remaining !== 1 ? "s" : ""} remaining.`,
    };
  }

  memoryPinAttempts.delete(lockKey);
  const patch: Record<string, unknown> = {
    pin_failed_attempts: 0,
    pin_locked_until: null,
  };
  if (needsPbkdf2Upgrade) {
    patch.pin_hash = hashPin(suppliedPin);
    patch.pin = "";
  }
  await supabaseRest(`profiles?id=eq.${encodeURIComponent(userId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(patch),
  }).catch(() => {});

  return { ok: true };
}

export async function verifyBusinessPin(
  userId: string,
  suppliedPin: unknown,
): Promise<{
  ok: boolean;
  error?: string;
  attempts: number;
  lockedUntil: number | null;
  nowLocked?: boolean;
}> {
  const MAX_ATTEMPTS = 3;
  const LOCKOUT_MS = 5 * 60 * 1000;
  const now = Date.now();

  if (typeof suppliedPin !== "string" || !/^\d{6}$/.test(suppliedPin)) {
    return { ok: false, error: "Enter a valid 6-digit Business PIN.", attempts: 0, lockedUntil: null };
  }

  // Try modern column projection first; fall back seamlessly if migration wasn't applied yet
  let hasHashCol = true;
  let res = await supabaseRest(
    `business_security?user_id=eq.${encodeURIComponent(userId)}&select=id,pin,pin_hash,attempts,locked_until&limit=1`,
  );
  if (!res.ok) {
    hasHashCol = false;
    res = await supabaseRest(
      `business_security?user_id=eq.${encodeURIComponent(userId)}&select=id,pin,attempts,locked_until&limit=1`,
    );
  }
  if (!res.ok) {
    return { ok: false, error: "Could not verify Business PIN right now.", attempts: 0, lockedUntil: null };
  }

  const rows = (await res.json().catch(() => [])) as Array<{
    id?: string;
    pin?: string | null;
    pin_hash?: string | null;
    attempts?: number | null;
    locked_until?: string | null;
  }>;
  const row = rows[0];

  if (!row || !hasCustomBusinessPin(row)) {
    return {
      ok: false,
      error: "Business PIN is not set yet. Tap 'Forgot Business PIN?' to set your 6-digit PIN.",
      attempts: Number(row?.attempts ?? 0),
      lockedUntil: null,
    };
  }

  const currentLockedUntil = row.locked_until ? new Date(row.locked_until).getTime() : null;
  if (currentLockedUntil && currentLockedUntil > now) {
    return {
      ok: false,
      error: "locked",
      attempts: Number(row.attempts ?? MAX_ATTEMPTS),
      lockedUntil: currentLockedUntil,
      nowLocked: true,
    };
  }

  const effectiveLegacyPin =
    typeof row.pin === "string" && row.pin.trim() && row.pin.trim() !== "123456" ? row.pin.trim() : null;
  const { matched, needsPbkdf2Upgrade } = await verifyStoredSecret(suppliedPin, row.pin_hash, effectiveLegacyPin);

  if (!matched) {
    const currentAttempts = currentLockedUntil && currentLockedUntil <= now ? 0 : Number(row.attempts ?? 0);
    const nextAttempts = currentAttempts + 1;
    const lockedUntil = nextAttempts >= MAX_ATTEMPTS ? now + LOCKOUT_MS : null;

    await supabaseRest(`business_security?user_id=eq.${encodeURIComponent(userId)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        attempts: nextAttempts,
        locked_until: lockedUntil ? new Date(lockedUntil).toISOString() : null,
      }),
    }).catch(() => {});

    if (lockedUntil) {
      return {
        ok: false,
        error: "Incorrect PIN. Access locked for 5 minutes.",
        attempts: nextAttempts,
        lockedUntil,
        nowLocked: true,
      };
    }

    const left = MAX_ATTEMPTS - nextAttempts;
    return {
      ok: false,
      error: `Incorrect PIN. ${left} attempt${left !== 1 ? "s" : ""} remaining.`,
      attempts: nextAttempts,
      lockedUntil: null,
    };
  }

  const patch: Record<string, unknown> = { attempts: 0, locked_until: null };
  if (hasHashCol && needsPbkdf2Upgrade) {
    patch.pin_hash = hashPin(suppliedPin);
    patch.pin = "";
  }
  await supabaseRest(`business_security?user_id=eq.${encodeURIComponent(userId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(patch),
  }).catch(() => {});

  return { ok: true, attempts: 0, lockedUntil: null };
}
