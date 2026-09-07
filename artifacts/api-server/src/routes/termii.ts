import { Router, type IRouter, type Request } from "express";

const router: IRouter = Router();
const TERMII_API_KEY = process.env["TERMII_API_KEY"]?.trim();
const TERMII_SENDER_ID = process.env["TERMII_SENDER_ID"]?.trim() || "N-Alert";
const TERMII_BASE_URL = "https://v3.api.termii.com/api/sms/otp";
const CHALLENGE_TTL_MS = 10 * 60 * 1000;

type ChallengePurpose = "signup" | "2fa";

type PendingChallenge = {
  pinId: string;
  purpose: ChallengePurpose;
  userId?: string;
  expiresAt: number;
};

const pendingChallenges = new Map<string, PendingChallenge>();

const SUPABASE_URL = process.env["SUPABASE_URL"]?.replace(/\/$/, "");
const SUPABASE_SERVICE_ROLE_KEY = process.env["SUPABASE_SERVICE_ROLE_KEY"];

function bearer(req: Request) {
  const value = req.header("authorization") ?? "";
  return value.startsWith("Bearer ") ? value.slice(7) : "";
}

async function getUserId(token: string) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !token) return null;
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) return null;
  const body = (await response.json().catch(() => null)) as { id?: string } | null;
  return body?.id ?? null;
}

async function getProfilePhone(userId: string) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Account storage is not configured");
  }
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=phone&limit=1`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
    },
  );
  if (!response.ok) throw new Error("Could not load the account phone number");
  const rows = (await response.json().catch(() => [])) as Array<{ phone?: string | null }>;
  return rows[0]?.phone ?? "";
}

function termiiPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("234")) return digits;
  if (digits.startsWith("0")) return `234${digits.slice(1)}`;
  return digits;
}

function pruneChallenges() {
  const now = Date.now();
  for (const [pinId, challenge] of pendingChallenges) {
    if (challenge.expiresAt <= now) pendingChallenges.delete(pinId);
  }
}

async function termiiRequest(
  path: "send" | "verify",
  payload: Record<string, unknown>,
) {
  if (!TERMII_API_KEY) throw new Error("Termii is not configured");

  const response = await fetch(`${TERMII_BASE_URL}/${path}`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      api_key: TERMII_API_KEY,
      ...payload,
    }),
  });
  const body = (await response.json().catch(() => null)) as {
    pinId?: string;
    pin_id?: string;
    verified?: boolean;
    status?: boolean | string;
    message?: string;
  } | null;

  if (!response.ok) {
    throw new Error(body?.message || `Termii returned ${response.status}`);
  }
  return body;
}

router.post("/termii/otp/send", async (req, res) => {
  pruneChallenges();
  const purpose: ChallengePurpose = req.body?.purpose === "signup" ? "signup" : "2fa";
  const token = bearer(req);
  const userId = token ? await getUserId(token) : null;

  if (purpose === "2fa" && !userId) {
    res.status(401).json({ message: "Your session has expired. Please sign in again." });
    return;
  }
  if (token && !userId) {
    res.status(401).json({ message: "Your session has expired. Please sign in again." });
    return;
  }

  try {
    const phone = userId
      ? await getProfilePhone(userId)
      : typeof req.body?.phone === "string" ? req.body.phone : "";
    const recipient = termiiPhone(phone);
    if (!/^234\d{10}$/.test(recipient)) {
      res.status(400).json({ message: "A valid Nigerian phone number is required" });
      return;
    }

    const body = await termiiRequest("send", {
      pin_type: "NUMERIC",
      to: recipient,
      from: TERMII_SENDER_ID,
      channel: "generic",
      pin_attempts: 5,
      pin_time_to_live: 10,
      pin_length: 6,
      pin_placeholder: "< 123456 >",
      message_text: "Your Vexa verification code is < 123456 >. It expires in 10 minutes.",
    });
    const pinId = body?.pinId ?? body?.pin_id;
    if (!pinId) throw new Error("Termii did not return a verification request ID");

    pendingChallenges.set(pinId, {
      pinId,
      purpose,
      ...(userId ? { userId } : {}),
      expiresAt: Date.now() + CHALLENGE_TTL_MS,
    });
    res.json({ requestId: pinId, expiresInSeconds: CHALLENGE_TTL_MS / 1000 });
  } catch (error) {
    req.log.error({ err: error }, "Termii OTP send failed");
    res.status(502).json({ message: "Could not send the verification code. Please try again." });
  }
});

router.post("/termii/otp/verify", async (req, res) => {
  pruneChallenges();
  const pinId = typeof req.body?.requestId === "string" ? req.body.requestId.trim() : "";
  const pin = typeof req.body?.code === "string" ? req.body.code.trim() : "";
  const challenge = pendingChallenges.get(pinId);

  if (!pinId || !/^\d{6}$/.test(pin) || !challenge) {
    res.status(400).json({ message: "That verification code is invalid or expired" });
    return;
  }

  if (challenge.purpose === "2fa") {
    const userId = await getUserId(bearer(req));
    if (!userId || userId !== challenge.userId) {
      res.status(401).json({ message: "Your session has expired. Please sign in again." });
      return;
    }
  }

  try {
    const body = await termiiRequest("verify", { pin_id: pinId, pin });
    const verified =
      body?.verified === true ||
      body?.status === true ||
      body?.status === "success" ||
      body?.message?.toLowerCase().includes("verified");
    if (!verified) {
      res.status(422).json({ message: "That verification code is invalid or expired" });
      return;
    }
    pendingChallenges.delete(pinId);
    res.json({ verified: true, purpose: challenge.purpose });
  } catch (error) {
    req.log.warn({ err: error }, "Termii OTP verification failed");
    res.status(422).json({ message: "That verification code is invalid or expired" });
  }
});

export default router;