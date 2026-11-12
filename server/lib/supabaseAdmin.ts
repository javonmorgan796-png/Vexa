import type { Request } from "express";

function readSupabaseUrl(): string {
  return (process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"] || "").trim().replace(/\/$/, "");
}

function readServiceRoleKey(): string {
  return (process.env["SUPABASE_SERVICE_ROLE_KEY"] || "").trim();
}

function readAnonKey(): string {
  return (process.env["SUPABASE_ANON_KEY"] || process.env["VITE_SUPABASE_ANON_KEY"] || "").trim();
}

export function isSupabaseAdminConfigured(): boolean {
  return Boolean(readSupabaseUrl() && readServiceRoleKey());
}

export function getSupabaseAdminConfig(): { url: string; serviceKey: string } {
  const url = readSupabaseUrl();
  const serviceKey = readServiceRoleKey();
  if (!url || !serviceKey) {
    throw new Error("Database admin service is not configured");
  }
  return { url, serviceKey };
}

export function extractBearerToken(req: Request): string {
  const value = req.header("authorization") ?? "";
  return value.startsWith("Bearer ") ? value.slice(7).trim() : "";
}

export interface VerifiedSupabaseUser {
  id: string;
  email: string;
  phone: string;
  userMetadata: Record<string, unknown>;
}

export async function verifySupabaseUser(token: string): Promise<VerifiedSupabaseUser | null> {
  if (!token || !isSupabaseAdminConfigured()) return null;
  const { url, serviceKey } = getSupabaseAdminConfig();
  try {
    const resp = await fetch(`${url}/auth/v1/user`, {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!resp.ok) return null;
    const data = (await resp.json().catch(() => null)) as {
      id?: string;
      email?: string | null;
      phone?: string | null;
      user_metadata?: Record<string, unknown> | null;
    } | null;
    if (!data?.id) return null;
    const meta = data.user_metadata && typeof data.user_metadata === "object" ? data.user_metadata : {};
    const metaPhone = typeof meta.phone === "string" ? meta.phone : "";
    return {
      id: data.id,
      email: typeof data.email === "string" ? data.email : "",
      phone: typeof data.phone === "string" && data.phone ? data.phone : metaPhone,
      userMetadata: meta,
    };
  } catch {
    return null;
  }
}

export async function supabaseRest(path: string, init: RequestInit = {}): Promise<Response> {
  const { url, serviceKey } = getSupabaseAdminConfig();
  return fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

export async function supabaseRpc(name: string, body: Record<string, unknown>): Promise<Response> {
  return supabaseRest(`rpc/${name}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function supabaseAuthAdmin(path: string, init: RequestInit = {}): Promise<Response> {
  const { url, serviceKey } = getSupabaseAdminConfig();
  const cleanPath = path.startsWith("/") ? path.slice(1) : path;
  return fetch(`${url}/auth/v1/admin/${cleanPath}`, {
    ...init,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

export async function verifySupabasePassword(email: string, password: string): Promise<boolean> {
  const url = readSupabaseUrl();
  const apiKey = readAnonKey() || readServiceRoleKey();
  if (!url || !apiKey || !email || !password) return false;
  try {
    const resp = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        apikey: apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

export function normalizeNigerianPhone(phone: string): string {
  const digits = (phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("234")) {
    return `0${digits.slice(3).replace(/^0/, "")}`;
  }
  return digits.startsWith("0") ? digits : `0${digits}`;
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
