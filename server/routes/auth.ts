import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { Router, type IRouter } from "express";
import { authRateLimiter, otpRateLimiter, pinRateLimiter } from "../lib/rateLimit";
import { hasCustomTransactionPin, verifyUserTransactionPin } from "../lib/pinSecurity";

const router: IRouter = Router();

const SUPABASE_URL = (process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"] || "").replace(/\/$/, "");
const SUPABASE_SERVICE_ROLE_KEY = process.env["SUPABASE_SERVICE_ROLE_KEY"]?.trim();
const TERMII_API_KEY = process.env["TERMII_API_KEY"]?.trim();
const TERMII_SENDER_ID = process.env["TERMII_SENDER_ID"]?.trim() || "N-Alert";
const TERMII_BASE_URL = "https://v3.api.termii.com/api/sms/otp";
const CHALLENGE_TTL_MS = 10 * 60 * 1000;
const RESET_TOKEN_TTL_MS = 10 * 60 * 1000;
const SEND_COOLDOWN_MS = 30 * 1000;
const SEND_WINDOW_MS = 15 * 60 * 1000;
const MAX_SENDS_PER_WINDOW = 5;
const MAX_VERIFY_ATTEMPTS = 5;

const DEMO_OTP_CODE = process.env["DEMO_OTP_CODE"]?.trim() || "";
const DEMO_OTP_ENABLED =
  process.env["NODE_ENV"] !== "production" &&
  process.env["DEMO_OTP_ENABLED"] === "true" &&
  /^\d{6}$/.test(DEMO_OTP_CODE);

interface ForgotChallenge {
  requestId: string;
  mode: "otp" | "pin_verify";
  userId: string;
  localPhone: string;
  recipient: string;
  expiresAt: number;
  attempts: number;
  demo?: boolean;
}

interface ResetTokenRecord {
  token: string;
  userId: string;
  localPhone: string;
  expiresAt: number;
}

interface SendRateLimitRecord {
  lastSentAt: number;
  windowStart: number;
  count: number;
}

interface AccountLookupResult {
  userId: string;
  localPhone: string;
  hasCustomPin: boolean;
}

const pendingChallenges = new Map<string, ForgotChallenge>();
const pendingResetTokens = new Map<string, ResetTokenRecord>();
const sendRateLimits = new Map<string, SendRateLimitRecord>();

function pruneExpiredState() {
  const now = Date.now();
  for (const [id, item] of pendingChallenges) {
    if (item.expiresAt <= now) pendingChallenges.delete(id);
  }
  for (const [token, item] of pendingResetTokens) {
    if (item.expiresAt <= now) pendingResetTokens.delete(token);
  }
  for (const [key, item] of sendRateLimits) {
    if (now - item.windowStart > SEND_WINDOW_MS) sendRateLimits.delete(key);
  }
}

setInterval(pruneExpiredState, 60_000).unref();

function normalizePhoneVariants(rawPhone: string) {
  const digits = rawPhone.replace(/\D/g, "");
  let national = "";
  if (digits.startsWith("234")) {
    national = digits.slice(3).replace(/^0/, "");
  } else {
    national = digits.replace(/^0+/, "");
  }
  const localPhone = national ? `0${national}` : "";
  const recipient = national ? `234${national}` : "";
  return { digits, national, localPhone, recipient };
}

function maskPhone(localPhone: string): string {
  if (localPhone.length < 7) return localPhone;
  return `${localPhone.slice(0, 4)}****${localPhone.slice(-3)}`;
}

function safeEqualText(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

async function supabaseAdminFetch(path: string, init: RequestInit = {}) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Account service is not configured");
  }
  return fetch(`${SUPABASE_URL}${path}`, {
    ...init,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

async function findUserByPhone(rawPhone: string): Promise<AccountLookupResult | null> {
  const { digits, national, localPhone, recipient } = normalizePhoneVariants(rawPhone);
  if (!/^234\d{10}$/.test(recipient)) return null;

  const phoneCandidates = Array.from(
    new Set([localPhone, recipient, `+${recipient}`, national, digits].filter(Boolean)),
  );
  const emailCandidates = Array.from(
    new Set(
      [
        `${localPhone}@vexa.app`,
        `${national}@vexa.app`,
        `${recipient}@vexa.app`,
        `${digits}@vexa.app`,
      ].filter(Boolean),
    ),
  );

  const orClauses = [
    ...phoneCandidates.map((p) => `phone.eq.${encodeURIComponent(p)}`),
    ...emailCandidates.map((e) => `email.eq.${encodeURIComponent(e)}`),
  ];

  let profileRes = await supabaseAdminFetch(
    `/rest/v1/profiles?or=(${orClauses.join(",")})&select=id,phone,pin,pin_hash&limit=1`,
  );
  if (!profileRes.ok) {
    profileRes = await supabaseAdminFetch(
      `/rest/v1/profiles?or=(${orClauses.join(",")})&select=id,phone,pin&limit=1`,
    );
  }
  if (profileRes.ok) {
    const rows = (await profileRes.json().catch(() => [])) as Array<{
      id?: string;
      phone?: string | null;
      pin?: string | null;
      pin_hash?: string | null;
    }>;
    if (rows[0]?.id) {
      return {
        userId: rows[0].id,
        localPhone,
        hasCustomPin: hasCustomTransactionPin(rows[0]),
      };
    }
  }

  // Fallback: inspect Supabase Auth users if profile phone formatting differed
  const authRes = await supabaseAdminFetch(`/auth/v1/admin/users?page=1&per_page=1000`);
  if (authRes.ok) {
    const payload = (await authRes.json().catch(() => null)) as {
      users?: Array<{ id?: string; email?: string; phone?: string; user_metadata?: { phone?: string } }>;
    } | null;
    const candidateEmailSet = new Set(emailCandidates.map((e) => e.toLowerCase()));
    const candidatePhoneSet = new Set(phoneCandidates);
    const match = (payload?.users ?? []).find((u) => {
      if (u.email && candidateEmailSet.has(u.email.toLowerCase())) return true;
      if (u.phone && candidatePhoneSet.has(u.phone)) return true;
      const metaPhone = typeof u.user_metadata?.phone === "string"
        ? normalizePhoneVariants(u.user_metadata.phone).localPhone
        : "";
      return Boolean(metaPhone && metaPhone === localPhone);
    });
    if (match?.id) {
      let hasCustomPin = false;
      let pRes = await supabaseAdminFetch(
        `/rest/v1/profiles?id=eq.${encodeURIComponent(match.id)}&select=pin,pin_hash&limit=1`,
      );
      if (!pRes.ok) {
        pRes = await supabaseAdminFetch(
          `/rest/v1/profiles?id=eq.${encodeURIComponent(match.id)}&select=pin&limit=1`,
        );
      }
      if (pRes.ok) {
        const pRows = (await pRes.json().catch(() => [])) as Array<{ pin?: string | null; pin_hash?: string | null }>;
        hasCustomPin = hasCustomTransactionPin(pRows[0]);
      }
      return { userId: match.id, localPhone, hasCustomPin };
    }
  }

  return null;
}

async function termiiRequest(path: "send" | "verify", payload: Record<string, unknown>) {
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

function publicTermiiError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const normalized = message.toLowerCase();

  if (normalized.includes("country inactive")) {
    return "SMS delivery is not enabled for Nigeria on the Termii account yet. Activate Nigeria in Termii or set a custom Transaction PIN first.";
  }
  if (normalized.includes("sender") && normalized.includes("id")) {
    return "The Termii sender ID is not approved yet. Please try again later.";
  }
  if (normalized.includes("api key") || normalized.includes("unauthorized")) {
    return "SMS delivery is currently unavailable. Please contact support.";
  }
  return "Could not send the verification code. Please try again.";
}

async function clearServerLoginLockout(localPhone: string) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return;
  const hash = createHash("sha256").update(localPhone.toLowerCase().trim()).digest("hex");
  await supabaseAdminFetch(`/rest/v1/login_security?identifier_hash=eq.${encodeURIComponent(hash)}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  }).catch(() => {});
}

function recordSendRateLimit(localPhone: string, now: number, previous?: SendRateLimitRecord) {
  sendRateLimits.set(localPhone, {
    lastSentAt: now,
    windowStart: previous && now - previous.windowStart <= SEND_WINDOW_MS ? previous.windowStart : now,
    count: previous && now - previous.windowStart <= SEND_WINDOW_MS ? previous.count + 1 : 1,
  });
}

router.post("/auth/forgot-passcode/send-otp", otpRateLimiter, async (req, res) => {
  pruneExpiredState();
  const rawPhone = typeof req.body?.phone === "string" ? req.body.phone.trim() : "";
  const { localPhone, recipient } = normalizePhoneVariants(rawPhone);

  if (!/^234\d{10}$/.test(recipient)) {
    res.status(400).json({ message: "Enter a valid Nigerian phone number" });
    return;
  }

  const now = Date.now();
  const limit = sendRateLimits.get(localPhone);
  if (limit) {
    if (now - limit.lastSentAt < SEND_COOLDOWN_MS) {
      const waitSec = Math.ceil((SEND_COOLDOWN_MS - (now - limit.lastSentAt)) / 1000);
      res.status(429).json({ message: `Please wait ${waitSec}s before requesting another code.` });
      return;
    }
    if (now - limit.windowStart <= SEND_WINDOW_MS && limit.count >= MAX_SENDS_PER_WINDOW) {
      res.status(429).json({ message: "Too many OTP requests. Please try again in 15 minutes." });
      return;
    }
  }

  let account: AccountLookupResult | null = null;
  try {
    account = await findUserByPhone(rawPhone);
  } catch (error) {
    req.log.warn({ err: error }, "Forgot passcode account lookup failed");
    res.status(503).json({ message: "Account service is temporarily unavailable. Please try again." });
    return;
  }

  if (!account) {
    res.status(404).json({ message: "No Vexa account was found with this phone number" });
    return;
  }

  const issueFallbackChallenge = (termiiError?: unknown) => {
    if (DEMO_OTP_ENABLED) {
      const requestId = `demo-reset-${randomUUID()}`;
      pendingChallenges.set(requestId, {
        requestId,
        mode: "otp",
        userId: account!.userId,
        localPhone: account!.localPhone,
        recipient,
        expiresAt: now + CHALLENGE_TTL_MS,
        attempts: 0,
        demo: true,
      });
      recordSendRateLimit(localPhone, now, limit);
      res.json({
        mode: "otp",
        requestId,
        expiresInSeconds: CHALLENGE_TTL_MS / 1000,
        maskedPhone: maskPhone(account!.localPhone),
        demo: true,
      });
      return;
    }

    if (account!.hasCustomPin) {
      const requestId = `pin-reset-${randomUUID()}`;
      pendingChallenges.set(requestId, {
        requestId,
        mode: "pin_verify",
        userId: account!.userId,
        localPhone: account!.localPhone,
        recipient,
        expiresAt: now + CHALLENGE_TTL_MS,
        attempts: 0,
      });
      recordSendRateLimit(localPhone, now, limit);
      res.json({
        mode: "pin_verify",
        requestId,
        expiresInSeconds: CHALLENGE_TTL_MS / 1000,
        maskedPhone: maskPhone(account!.localPhone),
        notice: "SMS delivery is currently unavailable. Verify using your Vexa Account Number and 4-digit Transaction PIN.",
      });
      return;
    }

    res.status(422).json({ message: publicTermiiError(termiiError) });
  };

  if (!TERMII_API_KEY) {
    issueFallbackChallenge(new Error("Termii is not configured"));
    return;
  }

  try {
    const body = await termiiRequest("send", {
      pin_type: "NUMERIC",
      to: recipient,
      from: TERMII_SENDER_ID,
      channel: "generic",
      pin_attempts: MAX_VERIFY_ATTEMPTS,
      pin_time_to_live: 10,
      pin_length: 6,
      pin_placeholder: "< 123456 >",
      message_text: "Your Vexa passcode reset code is < 123456 >. It expires in 10 minutes.",
    });

    const requestId = body?.pinId ?? body?.pin_id;
    if (!requestId) {
      throw new Error("Termii did not return a verification request ID");
    }

    pendingChallenges.set(requestId, {
      requestId,
      mode: "otp",
      userId: account.userId,
      localPhone: account.localPhone,
      recipient,
      expiresAt: now + CHALLENGE_TTL_MS,
      attempts: 0,
    });

    recordSendRateLimit(localPhone, now, limit);

    res.json({
      mode: "otp",
      requestId,
      expiresInSeconds: CHALLENGE_TTL_MS / 1000,
      maskedPhone: maskPhone(account.localPhone),
    });
  } catch (error) {
    req.log.warn(
      { reason: error instanceof Error ? error.message : String(error) },
      "Termii SMS OTP unavailable for forgot-passcode; using fallback verification",
    );
    issueFallbackChallenge(error);
  }
});

router.post("/auth/forgot-passcode/verify-otp", authRateLimiter, async (req, res) => {
  pruneExpiredState();
  const requestId = typeof req.body?.requestId === "string" ? req.body.requestId.trim() : "";
  const code = typeof req.body?.code === "string" ? req.body.code.trim() : "";
  const challenge = pendingChallenges.get(requestId);

  if (!requestId || !/^\d{6}$/.test(code) || !challenge || challenge.mode !== "otp") {
    res.status(400).json({ message: "That verification code is invalid or expired" });
    return;
  }

  if (challenge.expiresAt <= Date.now()) {
    pendingChallenges.delete(requestId);
    res.status(400).json({ message: "That verification code has expired. Please request a new one." });
    return;
  }

  if (challenge.attempts >= MAX_VERIFY_ATTEMPTS) {
    pendingChallenges.delete(requestId);
    res.status(429).json({ message: "Too many incorrect codes. Please request a new verification code." });
    return;
  }

  try {
    let verified = false;
    if (challenge.demo && DEMO_OTP_ENABLED) {
      verified = safeEqualText(code, DEMO_OTP_CODE);
    } else {
      const body = await termiiRequest("verify", { pin_id: requestId, pin: code });
      verified = Boolean(
        body?.verified === true ||
          body?.status === true ||
          body?.status === "success" ||
          body?.message?.toLowerCase().includes("verified"),
      );
    }

    if (!verified) {
      challenge.attempts += 1;
      if (challenge.attempts >= MAX_VERIFY_ATTEMPTS) {
        pendingChallenges.delete(requestId);
        res.status(429).json({ message: "Too many incorrect codes. Please request a new verification code." });
        return;
      }
      res.status(422).json({ message: "Incorrect or expired verification code" });
      return;
    }

    pendingChallenges.delete(requestId);
    const resetToken = randomBytes(32).toString("hex");
    pendingResetTokens.set(resetToken, {
      token: resetToken,
      userId: challenge.userId,
      localPhone: challenge.localPhone,
      expiresAt: Date.now() + RESET_TOKEN_TTL_MS,
    });

    res.json({
      verified: true,
      resetToken,
      expiresInSeconds: RESET_TOKEN_TTL_MS / 1000,
    });
  } catch (error) {
    req.log.warn({ err: error }, "Forgot passcode OTP verify failed");
    challenge.attempts += 1;
    if (challenge.attempts >= MAX_VERIFY_ATTEMPTS) {
      pendingChallenges.delete(requestId);
    }
    res.status(422).json({ message: "Incorrect or expired verification code" });
  }
});

router.post("/auth/forgot-passcode/verify-account", pinRateLimiter, async (req, res) => {
  pruneExpiredState();
  const requestId = typeof req.body?.requestId === "string" ? req.body.requestId.trim() : "";
  const accountNumber = typeof req.body?.accountNumber === "string" ? req.body.accountNumber.replace(/\D/g, "") : "";
  const pin = typeof req.body?.pin === "string" ? req.body.pin.trim() : "";
  const challenge = pendingChallenges.get(requestId);

  if (!requestId || !challenge || challenge.mode !== "pin_verify") {
    res.status(400).json({ message: "Your verification session is invalid or expired. Please start again." });
    return;
  }

  if (challenge.expiresAt <= Date.now()) {
    pendingChallenges.delete(requestId);
    res.status(400).json({ message: "Your verification session has expired. Please start again." });
    return;
  }

  if (challenge.attempts >= MAX_VERIFY_ATTEMPTS) {
    pendingChallenges.delete(requestId);
    res.status(429).json({ message: "Too many failed verification attempts. Please start again." });
    return;
  }

  if (!/^\d{10}$/.test(accountNumber) || !/^\d{4}$/.test(pin)) {
    res.status(400).json({ message: "Enter your 10-digit account number and 4-digit Transaction PIN" });
    return;
  }

  try {
    let profileRes = await supabaseAdminFetch(
      `/rest/v1/profiles?id=eq.${encodeURIComponent(challenge.userId)}&select=account_number,pin,pin_hash&limit=1`,
    );
    if (!profileRes.ok) {
      profileRes = await supabaseAdminFetch(
        `/rest/v1/profiles?id=eq.${encodeURIComponent(challenge.userId)}&select=account_number,pin&limit=1`,
      );
    }
    if (!profileRes.ok) {
      res.status(503).json({ message: "Could not verify your account right now. Please try again." });
      return;
    }

    const rows = (await profileRes.json().catch(() => [])) as Array<{
      account_number?: string | null;
      pin?: string | null;
      pin_hash?: string | null;
    }>;
    const savedAccountNumber = String(rows[0]?.account_number ?? "").replace(/\D/g, "");

    if (!savedAccountNumber || !hasCustomTransactionPin(rows[0])) {
      pendingChallenges.delete(requestId);
      res.status(422).json({ message: "Account PIN verification is not available for this profile." });
      return;
    }

    const accountMatches = safeEqualText(accountNumber, savedAccountNumber);
    const pinResult = accountMatches ? await verifyUserTransactionPin(challenge.userId, pin) : { ok: false };

    if (!accountMatches || !pinResult.ok) {
      challenge.attempts += 1;
      if (challenge.attempts >= MAX_VERIFY_ATTEMPTS || pinResult.nowLocked) {
        pendingChallenges.delete(requestId);
        res.status(429).json({ message: "Too many incorrect details. Please restart passcode recovery." });
        return;
      }
      const left = MAX_VERIFY_ATTEMPTS - challenge.attempts;
      res.status(422).json({
        message: `Account number or Transaction PIN is incorrect (${left} attempt${left !== 1 ? "s" : ""} left)`,
      });
      return;
    }

    pendingChallenges.delete(requestId);
    const resetToken = randomBytes(32).toString("hex");
    pendingResetTokens.set(resetToken, {
      token: resetToken,
      userId: challenge.userId,
      localPhone: challenge.localPhone,
      expiresAt: Date.now() + RESET_TOKEN_TTL_MS,
    });

    res.json({
      verified: true,
      resetToken,
      expiresInSeconds: RESET_TOKEN_TTL_MS / 1000,
    });
  } catch (error) {
    req.log.warn({ err: error }, "Forgot passcode account verify failed");
    res.status(503).json({ message: "Could not verify your account right now. Please try again." });
  }
});

router.post("/auth/forgot-passcode/reset", authRateLimiter, async (req, res) => {
  pruneExpiredState();
  const resetToken = typeof req.body?.resetToken === "string" ? req.body.resetToken.trim() : "";
  const newPasscode = typeof req.body?.newPasscode === "string" ? req.body.newPasscode.trim() : "";

  if (!resetToken) {
    res.status(400).json({ message: "Your verification session is missing. Please restart passcode recovery." });
    return;
  }
  if (!/^\d{6}$/.test(newPasscode)) {
    res.status(400).json({ message: "Passcode must be exactly 6 digits" });
    return;
  }

  const record = pendingResetTokens.get(resetToken);
  if (!record || record.expiresAt <= Date.now()) {
    pendingResetTokens.delete(resetToken);
    res.status(401).json({ message: "Your verification session has expired. Please verify your phone again." });
    return;
  }

  // Consume token immediately so it can only be used once
  pendingResetTokens.delete(resetToken);

  try {
    const updateRes = await supabaseAdminFetch(
      `/auth/v1/admin/users/${encodeURIComponent(record.userId)}`,
      {
        method: "PUT",
        body: JSON.stringify({ password: newPasscode }),
      },
    );

    if (!updateRes.ok) {
      const errBody = (await updateRes.json().catch(() => null)) as { msg?: string; message?: string } | null;
      req.log.warn({ status: updateRes.status, errBody }, "Supabase admin password update failed");
      res.status(422).json({
        message: errBody?.message || errBody?.msg || "Could not update your passcode. Please try again.",
      });
      return;
    }

    await clearServerLoginLockout(record.localPhone);

    // Best-effort security notification
    await supabaseAdminFetch("/rest/v1/notifications", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        user_id: record.userId,
        type: "security",
        title: "Passcode Reset",
        body: "Your Vexa login passcode was reset. If you did not authorize this, freeze your account immediately.",
        read: false,
      }),
    }).catch(() => {});

    res.json({
      success: true,
      phone: record.localPhone,
    });
  } catch (error) {
    req.log.warn({ err: error }, "Forgot passcode reset error");
    res.status(500).json({ message: "Could not reset your passcode. Please try again." });
  }
});

export default router;
