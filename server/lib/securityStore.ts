import { createHash } from "node:crypto";
import { isSupabaseAdminConfigured, supabaseRest, supabaseRpc } from "./supabaseAdmin";

interface LocalRateBucket {
  count: number;
  resetAt: number;
}

interface LocalSessionEntry {
  expiresAt: number;
  payload: unknown;
}

const localRateBuckets = new Map<string, LocalRateBucket>();
const localSessions = new Map<string, LocalSessionEntry>();
const MAX_LOCAL_ENTRIES = 10_000;

let warnedMissingRateTable = false;
let warnedMissingSessionTable = false;

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of localRateBuckets) {
    if (v.resetAt <= now) localRateBuckets.delete(k);
  }
  for (const [k, v] of localSessions) {
    if (v.expiresAt <= now) localSessions.delete(k);
  }
}, 60_000).unref();

export function hashSecurityKey(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function isMissingDbObject(status: number, bodyText: string): boolean {
  const lower = bodyText.toLowerCase();
  return (
    status === 404 ||
    lower.includes("pgrst202") ||
    lower.includes("pgrst205") ||
    lower.includes("42p01") ||
    lower.includes("42883") ||
    lower.includes("could not find the function") ||
    lower.includes("could not find the table") ||
    lower.includes("does not exist")
  );
}

function consumeLocalRateLimit(
  bucketKey: string,
  maxHits: number,
  windowMs: number,
): { allowed: boolean; count: number; retryAfterSec: number } {
  const now = Date.now();
  if (localRateBuckets.size >= MAX_LOCAL_ENTRIES) {
    for (const [k, v] of localRateBuckets) {
      if (v.resetAt <= now) localRateBuckets.delete(k);
    }
  }

  const existing = localRateBuckets.get(bucketKey);
  if (!existing || existing.resetAt <= now) {
    localRateBuckets.set(bucketKey, { count: 1, resetAt: now + windowMs });
    return { allowed: true, count: 1, retryAfterSec: Math.ceil(windowMs / 1000) };
  }

  if (existing.count >= maxHits) {
    return {
      allowed: false,
      count: existing.count,
      retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  return {
    allowed: true,
    count: existing.count,
    retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
  };
}

export async function consumeDistributedRateLimit(
  bucketKey: string,
  maxHits: number,
  windowMs: number,
): Promise<{ allowed: boolean; count: number; retryAfterSec: number }> {
  const now = Date.now();
  const windowSec = Math.max(1, Math.ceil(windowMs / 1000));
  const cached = localRateBuckets.get(bucketKey);
  if (cached && cached.resetAt > now && cached.count >= maxHits) {
    return {
      allowed: false,
      count: cached.count,
      retryAfterSec: Math.max(1, Math.ceil((cached.resetAt - now) / 1000)),
    };
  }

  if (isSupabaseAdminConfigured()) {
    try {
      const resp = await supabaseRpc("consume_rate_limit_srv", {
        p_bucket_key: hashSecurityKey(bucketKey),
        p_max_hits: maxHits,
        p_window_seconds: windowSec,
      });

      if (resp.ok) {
        const data = (await resp.json().catch(() => null)) as {
          allowed?: boolean;
          count?: number;
          retry_after_seconds?: number;
        } | null;

        if (data && typeof data.allowed === "boolean") {
          const retryAfterSec = Math.max(1, Number(data.retry_after_seconds ?? windowSec));
          const count = Number(data.count ?? 1);
          localRateBuckets.set(bucketKey, {
            count,
            resetAt: now + retryAfterSec * 1000,
          });
          return { allowed: data.allowed, count, retryAfterSec };
        }
      } else {
        const errText = await resp.text().catch(() => "");
        if (isMissingDbObject(resp.status, errText)) {
          if (!warnedMissingRateTable) {
            warnedMissingRateTable = true;
            console.warn(
              "[SecurityStore] Distributed rate-limit RPC unavailable; run supabase-security-migration.sql Section 10. Falling back to local limiter.",
            );
          }
        }
      }
    } catch {
      // Fall back to local bucket when network is transiently unavailable
    }
  }

  return consumeLocalRateLimit(bucketKey, maxHits, windowMs);
}

function sessionHash(namespace: string, rawToken: string): string {
  return hashSecurityKey(`${namespace}:${rawToken}`);
}

export async function putSecuritySession<T>(
  namespace: string,
  rawToken: string,
  payload: T,
  ttlMs: number,
): Promise<void> {
  const key = sessionHash(namespace, rawToken);
  const expiresAt = Date.now() + ttlMs;
  if (localSessions.size >= MAX_LOCAL_ENTRIES) {
    const now = Date.now();
    for (const [k, v] of localSessions) {
      if (v.expiresAt <= now) localSessions.delete(k);
    }
  }
  localSessions.set(key, { expiresAt, payload });

  if (!isSupabaseAdminConfigured()) return;
  try {
    const resp = await supabaseRest("auth_security_sessions?on_conflict=token_hash", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({
        token_hash: key,
        namespace,
        payload,
        expires_at: new Date(expiresAt).toISOString(),
        updated_at: new Date().toISOString(),
      }),
    });
    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      if (isMissingDbObject(resp.status, errText) && !warnedMissingSessionTable) {
        warnedMissingSessionTable = true;
        console.warn(
          "[SecurityStore] auth_security_sessions table unavailable; run supabase-security-migration.sql Section 10. Using process memory fallback.",
        );
      }
    }
  } catch {
    // Keep local entry
  }
}

export async function getSecuritySession<T>(
  namespace: string,
  rawToken: string,
): Promise<{ payload: T; expiresAt: number } | null> {
  if (!rawToken) return null;
  const key = sessionHash(namespace, rawToken);
  const now = Date.now();
  const local = localSessions.get(key);
  if (local) {
    if (local.expiresAt <= now) {
      localSessions.delete(key);
    } else if (!isSupabaseAdminConfigured()) {
      return { payload: local.payload as T, expiresAt: local.expiresAt };
    }
  }

  if (isSupabaseAdminConfigured()) {
    try {
      const resp = await supabaseRest(
        `auth_security_sessions?token_hash=eq.${encodeURIComponent(key)}&namespace=eq.${encodeURIComponent(namespace)}&select=payload,expires_at&limit=1`,
      );
      if (resp.ok) {
        const rows = (await resp.json().catch(() => [])) as Array<{
          payload?: T;
          expires_at?: string;
        }>;
        const row = rows[0];
        if (!row || !row.expires_at) {
          localSessions.delete(key);
          return null;
        }
        const expiresAt = new Date(row.expires_at).getTime();
        if (!Number.isFinite(expiresAt) || expiresAt <= now) {
          localSessions.delete(key);
          await deleteSecuritySession(namespace, rawToken);
          return null;
        }
        localSessions.set(key, { expiresAt, payload: row.payload });
        return { payload: row.payload as T, expiresAt };
      }
      const errText = await resp.text().catch(() => "");
      if (isMissingDbObject(resp.status, errText) && !warnedMissingSessionTable) {
        warnedMissingSessionTable = true;
        console.warn(
          "[SecurityStore] auth_security_sessions table unavailable; run supabase-security-migration.sql Section 10.",
        );
      }
    } catch {
      // Fall back to local cache below if available
    }
  }

  if (local && local.expiresAt > now) {
    return { payload: local.payload as T, expiresAt: local.expiresAt };
  }
  return null;
}

export async function updateSecuritySessionPayload<T>(
  namespace: string,
  rawToken: string,
  payload: T,
  expiresAtMs: number,
): Promise<void> {
  const remaining = expiresAtMs - Date.now();
  if (remaining <= 0) {
    await deleteSecuritySession(namespace, rawToken);
    return;
  }
  const key = sessionHash(namespace, rawToken);
  localSessions.set(key, { expiresAt: expiresAtMs, payload });

  if (!isSupabaseAdminConfigured()) return;
  try {
    await supabaseRest(
      `auth_security_sessions?token_hash=eq.${encodeURIComponent(key)}&namespace=eq.${encodeURIComponent(namespace)}`,
      {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          payload,
          updated_at: new Date().toISOString(),
        }),
      },
    );
  } catch {
    // Local cache already updated
  }
}

export async function deleteSecuritySession(namespace: string, rawToken: string): Promise<void> {
  if (!rawToken) return;
  const key = sessionHash(namespace, rawToken);
  localSessions.delete(key);
  if (!isSupabaseAdminConfigured()) return;
  try {
    await supabaseRest(
      `auth_security_sessions?token_hash=eq.${encodeURIComponent(key)}&namespace=eq.${encodeURIComponent(namespace)}`,
      {
        method: "DELETE",
        headers: { Prefer: "return=minimal" },
      },
    );
  } catch {
    // Non-fatal
  }
}

export async function consumeSecuritySession<T>(
  namespace: string,
  rawToken: string,
): Promise<{ payload: T; expiresAt: number } | null> {
  if (!rawToken) return null;
  const key = sessionHash(namespace, rawToken);
  const now = Date.now();
  const local = localSessions.get(key);
  localSessions.delete(key);

  if (isSupabaseAdminConfigured()) {
    try {
      const resp = await supabaseRest(
        `auth_security_sessions?token_hash=eq.${encodeURIComponent(key)}&namespace=eq.${encodeURIComponent(namespace)}&expires_at=gt.${encodeURIComponent(new Date(now).toISOString())}`,
        {
          method: "DELETE",
          headers: { Prefer: "return=representation" },
        },
      );
      if (resp.ok) {
        const rows = (await resp.json().catch(() => [])) as Array<{
          payload?: T;
          expires_at?: string;
        }>;
        const row = rows[0];
        if (!row || !row.expires_at) return null;
        const expiresAt = new Date(row.expires_at).getTime();
        if (!Number.isFinite(expiresAt) || expiresAt <= now) return null;
        return { payload: row.payload as T, expiresAt };
      }
      const errText = await resp.text().catch(() => "");
      if (!isMissingDbObject(resp.status, errText)) {
        return null;
      }
    } catch {
      // Fallback only if DB table isn't provisioned yet
    }
  }

  if (local && local.expiresAt > now) {
    return { payload: local.payload as T, expiresAt: local.expiresAt };
  }
  return null;
}
