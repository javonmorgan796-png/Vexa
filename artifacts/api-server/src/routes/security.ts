import { timingSafeEqual } from "node:crypto";
import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();
const SUPABASE_URL = process.env["SUPABASE_URL"]?.replace(/\/$/, "");
const SUPABASE_SERVICE_ROLE_KEY = process.env["SUPABASE_SERVICE_ROLE_KEY"];

type LockType = "sleep_mode" | "freeze_account";

function bearer(req: Request) {
  const value = req.header("authorization") ?? "";
  return value.startsWith("Bearer ") ? value.slice(7) : "";
}

async function getUserId(token: string) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !token) return null;
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${token}` },
  });
  if (!response.ok) return null;
  const body = (await response.json().catch(() => null)) as { id?: string } | null;
  return body?.id ?? null;
}

async function supabaseRequest(path: string, init: RequestInit = {}) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Account security storage is not configured");
  }
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

async function supabaseRpc(name: string, body: Record<string, unknown>) {
  return supabaseRequest(`rpc/${name}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function deviceDetails(req: Request) {
  const userAgent = req.header("user-agent") ?? "";
  const requestedName = typeof req.body?.deviceName === "string" ? req.body.deviceName.trim() : "";
  const requestedType = typeof req.body?.deviceType === "string" ? req.body.deviceType.trim() : "";
  const location = typeof req.body?.location === "string" ? req.body.location.trim() : "";
  return {
    deviceName: (requestedName || (userAgent.includes("Mobile") ? "Mobile browser" : "Web browser")).slice(0, 120),
    deviceType: (requestedType || (userAgent.includes("Mobile") ? "mobile" : "desktop")).slice(0, 40),
    location: location.slice(0, 160),
  };
}

function ipAddress(req: Request) {
  const forwarded = req.header("x-forwarded-for")?.split(",")[0]?.trim();
  return (forwarded || req.ip || "").slice(0, 120);
}

async function authenticatedUser(req: Request, res: Response) {
  const userId = await getUserId(bearer(req));
  if (!userId) {
    res.status(401).json({ message: "Your session has expired. Please sign in again." });
    return null;
  }
  return userId;
}

async function readState(userId: string) {
  const response = await supabaseRequest(
    `account_security_state?user_id=eq.${encodeURIComponent(userId)}&select=*&limit=1`,
  );
  if (!response.ok) throw new Error("Could not read account security state");
  const rows = (await response.json().catch(() => [])) as Array<Record<string, unknown>>;
  const state = rows[0] ?? {};
  return {
    sleepModeActive: Boolean(state.sleep_mode_active),
    sleepModeActivatedAt: typeof state.sleep_mode_activated_at === "string" ? state.sleep_mode_activated_at : null,
    freezeActive: Boolean(state.freeze_active),
    freezeActivatedAt: typeof state.freeze_activated_at === "string" ? state.freeze_activated_at : null,
  };
}

async function setLock(
  userId: string,
  lockType: LockType,
  enabled: boolean,
  req: Request,
  authMethod: string,
) {
  const details = deviceDetails(req);
  const response = await supabaseRpc("set_account_security_lock", {
    p_user_id: userId,
    p_lock_type: lockType,
    p_enabled: enabled,
    p_device_name: details.deviceName,
    p_device_type: details.deviceType,
    p_ip_address: ipAddress(req),
    p_location: details.location || null,
    p_auth_method: authMethod,
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string; hint?: string } | null;
    throw new Error(body?.message || body?.hint || "Could not update account security");
  }
  return response.json();
}

async function verifyPin(userId: string, suppliedPin: unknown) {
  if (typeof suppliedPin !== "string" || !/^\d{4}$/.test(suppliedPin)) return false;
  const response = await supabaseRequest(
    `profiles?id=eq.${encodeURIComponent(userId)}&select=pin&limit=1`,
  );
  if (!response.ok) throw new Error("Could not verify your transaction PIN");
  const rows = (await response.json().catch(() => [])) as Array<{ pin?: string | null }>;
  const savedPin = rows[0]?.pin ?? "";
  const provided = Buffer.from(suppliedPin);
  const expected = Buffer.from(savedPin);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

async function consumeOtpProof(userId: string) {
  const response = await supabaseRpc("consume_security_verification", {
    p_user_id: userId,
    p_purpose: "sleep_mode_deactivate",
  });
  if (!response.ok) return false;
  return (await response.json().catch(() => false)) === true;
}

router.get("/security/state", async (req, res) => {
  const userId = await authenticatedUser(req, res);
  if (!userId) return;
  try {
    res.json(await readState(userId));
  } catch (error) {
    req.log.error({ err: error }, "account security state request failed");
    res.status(503).json({ message: error instanceof Error ? error.message : "Could not read account security state" });
  }
});

router.post("/security/sleep-mode/activate", async (req, res) => {
  const userId = await authenticatedUser(req, res);
  if (!userId) return;
  try {
    res.json(await setLock(userId, "sleep_mode", true, req, "authenticated_session"));
  } catch (error) {
    req.log.error({ err: error }, "sleep mode activation failed");
    res.status(503).json({ message: error instanceof Error ? error.message : "Could not activate Sleep Mode" });
  }
});

router.post("/security/sleep-mode/deactivate", async (req, res) => {
  const userId = await authenticatedUser(req, res);
  if (!userId) return;
  try {
    if (!(await verifyPin(userId, req.body?.pin))) {
      res.status(422).json({ message: "The transaction PIN is incorrect" });
      return;
    }
    if (!(await consumeOtpProof(userId))) {
      res.status(422).json({ message: "Complete SMS verification before deactivating Sleep Mode" });
      return;
    }
    res.json(await setLock(userId, "sleep_mode", false, req, "transaction_pin_and_sms_otp"));
  } catch (error) {
    req.log.error({ err: error }, "sleep mode deactivation failed");
    res.status(503).json({ message: error instanceof Error ? error.message : "Could not deactivate Sleep Mode" });
  }
});

router.post("/security/freeze/activate", async (req, res) => {
  const userId = await authenticatedUser(req, res);
  if (!userId) return;
  try {
    res.json(await setLock(userId, "freeze_account", true, req, "authenticated_session"));
  } catch (error) {
    req.log.error({ err: error }, "account freeze activation failed");
    res.status(503).json({ message: error instanceof Error ? error.message : "Could not freeze account" });
  }
});

router.post("/security/freeze/deactivate", async (req, res) => {
  const userId = await authenticatedUser(req, res);
  if (!userId) return;
  try {
    if (!(await verifyPin(userId, req.body?.pin))) {
      res.status(422).json({ message: "The transaction PIN is incorrect" });
      return;
    }
    if (!(await consumeOtpProof(userId))) {
      res.status(422).json({ message: "Complete SMS verification before removing the account freeze" });
      return;
    }
    res.json(await setLock(userId, "freeze_account", false, req, "transaction_pin_and_sms_otp"));
  } catch (error) {
    req.log.error({ err: error }, "account freeze removal failed");
    res.status(503).json({ message: error instanceof Error ? error.message : "Could not remove account freeze" });
  }
});

export default router;