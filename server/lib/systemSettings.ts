import type { Request } from "express";

const SUPABASE_URL = (process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"] || "").replace(/\/$/, "");
const SUPABASE_SERVICE_ROLE_KEY =
  process.env["SUPABASE_SERVICE_ROLE_KEY"] ||
  process.env["SUPABASE_ANON_KEY"] ||
  process.env["VITE_SUPABASE_ANON_KEY"] ||
  "";

export const TATUM_WEBHOOK_PATH = "/api/crypto/webhooks/tatum";

export interface SystemSettingsState {
  maintenance_mode: boolean;
  allow_new_signups: boolean;
  allow_transfers: boolean;
  allow_crypto_exchange: boolean;
  allow_bill_payments: boolean;
  tier1_daily_limit: number;
  tier2_daily_limit: number;
  tier3_daily_limit: number;
  transfer_fee_flat: number;
  instant_withdrawal_fee_pct: number;
  session_timeout_minutes: number;
  enforce_device_binding: boolean;
  suspicious_amount_threshold: number;
  tatum_webhook_url: string;
  [key: string]: unknown;
}

export const DEFAULT_SYSTEM_SETTINGS: SystemSettingsState = {
  maintenance_mode: false,
  allow_new_signups: true,
  allow_transfers: true,
  allow_crypto_exchange: true,
  allow_bill_payments: true,
  tier1_daily_limit: 50000,
  tier2_daily_limit: 500000,
  tier3_daily_limit: 5000000,
  transfer_fee_flat: 10.0,
  instant_withdrawal_fee_pct: 0.5,
  session_timeout_minutes: 30,
  enforce_device_binding: true,
  suspicious_amount_threshold: 1000000,
  tatum_webhook_url: "",
};

let cachedSettings: SystemSettingsState = { ...DEFAULT_SYSTEM_SETTINGS };
let lastLoadedAt = 0;
const SETTINGS_CACHE_TTL_MS = 15_000;

export function normalizeWebhookUrl(value: string | undefined | null, fallbackBaseUrl?: string): string {
  const raw = typeof value === "string" ? value.trim() : "";
  const defaultAppUrl = process.env["APP_URL"]
    ? `${process.env["APP_URL"].replace(/\/$/, "")}${TATUM_WEBHOOK_PATH}`
    : "";
  const candidate = raw || (fallbackBaseUrl ? `${fallbackBaseUrl.replace(/\/$/, "")}${TATUM_WEBHOOK_PATH}` : defaultAppUrl);
  if (!candidate) return "";
  try {
    const parsed = new URL(candidate);
    if (parsed.pathname === "/" || !parsed.pathname) {
      parsed.pathname = TATUM_WEBHOOK_PATH;
    }
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return candidate;
  }
}

export function resolveRequestBaseUrl(req?: Request): string {
  if (process.env["APP_URL"]?.trim()) {
    return process.env["APP_URL"].trim().replace(/\/$/, "");
  }
  if (!req) return "";
  const forwardedProto = req.header("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol = forwardedProto || req.protocol || "https";
  const host = req.header("x-forwarded-host")?.split(",")[0]?.trim() || req.get("host") || "";
  return host ? `${protocol}://${host}` : "";
}

export async function getSystemSettings(forceRefresh = false): Promise<{
  settings: SystemSettingsState;
  persistedInDb: boolean;
}> {
  const now = Date.now();
  if (!forceRefresh && lastLoadedAt > 0 && now - lastLoadedAt < SETTINGS_CACHE_TTL_MS) {
    return { settings: { ...cachedSettings }, persistedInDb: Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) };
  }

  if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const resp = await fetch(
        `${SUPABASE_URL}/rest/v1/system_settings?id=eq.global&select=settings,updated_at,updated_by&limit=1`,
        {
          headers: {
            apikey: SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
        },
      );
      if (resp.ok) {
        const rows = (await resp.json()) as Array<{ settings?: Record<string, unknown> }>;
        if (Array.isArray(rows) && rows[0]?.settings && typeof rows[0].settings === "object") {
          cachedSettings = {
            ...DEFAULT_SYSTEM_SETTINGS,
            ...cachedSettings,
            ...rows[0].settings,
            tatum_webhook_url:
              typeof rows[0].settings.tatum_webhook_url === "string"
                ? rows[0].settings.tatum_webhook_url.trim()
                : cachedSettings.tatum_webhook_url,
          };
          lastLoadedAt = now;
          return { settings: { ...cachedSettings }, persistedInDb: true };
        }
        lastLoadedAt = now;
        return { settings: { ...cachedSettings }, persistedInDb: true };
      }
    } catch {
      // Fall back to in-memory cached settings if DB is temporarily unreachable
    }
  }

  lastLoadedAt = now;
  return { settings: { ...cachedSettings }, persistedInDb: false };
}

export async function updateSystemSettings(
  patch: Record<string, unknown>,
  updatedBy = "admin",
): Promise<{
  settings: SystemSettingsState;
  persistedInDb: boolean;
  dbError?: string;
}> {
  const { settings: current } = await getSystemSettings(true);
  const nextSettings: SystemSettingsState = {
    ...current,
    ...patch,
  };

  if (typeof nextSettings.tatum_webhook_url === "string") {
    const trimmed = nextSettings.tatum_webhook_url.trim();
    nextSettings.tatum_webhook_url = trimmed ? normalizeWebhookUrl(trimmed) : "";
  } else {
    nextSettings.tatum_webhook_url = "";
  }

  cachedSettings = nextSettings;
  lastLoadedAt = Date.now();

  if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const resp = await fetch(`${SUPABASE_URL}/rest/v1/system_settings?on_conflict=id`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=representation",
        },
        body: JSON.stringify({
          id: "global",
          settings: nextSettings,
          updated_by: updatedBy,
          updated_at: new Date().toISOString(),
        }),
      });

      if (resp.ok) {
        return { settings: { ...nextSettings }, persistedInDb: true };
      }
      const errText = await resp.text().catch(() => "");
      return {
        settings: { ...nextSettings },
        persistedInDb: false,
        dbError: errText || `Database returned status ${resp.status}`,
      };
    } catch (err) {
      return {
        settings: { ...nextSettings },
        persistedInDb: false,
        dbError: err instanceof Error ? err.message : "Database write failed",
      };
    }
  }

  return {
    settings: { ...nextSettings },
    persistedInDb: false,
    dbError: "Supabase credentials are not configured",
  };
}

export async function resolveEffectiveTatumWebhook(req?: Request): Promise<{
  url: string;
  storedUrl: string;
  source: "database" | "environment" | "auto" | "unconfigured";
  suggestedUrl: string;
}> {
  const { settings } = await getSystemSettings();
  const storedUrl = typeof settings.tatum_webhook_url === "string" ? settings.tatum_webhook_url.trim() : "";
  const requestBaseUrl = resolveRequestBaseUrl(req);
  const suggestedUrl = requestBaseUrl ? `${requestBaseUrl}${TATUM_WEBHOOK_PATH}` : "";

  if (storedUrl) {
    return {
      url: normalizeWebhookUrl(storedUrl),
      storedUrl,
      source: "database",
      suggestedUrl,
    };
  }

  const envWebhook = process.env["TATUM_WEBHOOK_URL"]?.trim();
  if (envWebhook) {
    return {
      url: normalizeWebhookUrl(envWebhook),
      storedUrl: "",
      source: "environment",
      suggestedUrl,
    };
  }

  const fallback = normalizeWebhookUrl(undefined, requestBaseUrl);
  if (fallback) {
    return {
      url: fallback,
      storedUrl: "",
      source: "auto",
      suggestedUrl,
    };
  }

  return {
    url: "",
    storedUrl: "",
    source: "unconfigured",
    suggestedUrl,
  };
}
