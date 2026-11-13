import { Router, type IRouter, type Request, type Response } from "express";
import {
  extractBearerToken,
  isSupabaseAdminConfigured,
  isUuid,
  normalizeNigerianPhone,
  supabaseAuthAdmin,
  supabaseRest,
  supabaseRpc,
  verifySupabasePassword,
  verifySupabaseUser,
} from "../lib/supabaseAdmin";
import {
  hasCustomTransactionPin,
  hashPin,
  verifyUserTransactionPin,
} from "../lib/pinSecurity";
import { authRateLimiter, pinRateLimiter } from "../lib/rateLimit";
import { getLiveCryptoPricesNgn, type Asset } from "../lib/cryptoPrices";
import { getSystemSettings } from "../lib/systemSettings";

const router: IRouter = Router();

const MAX_TRANSFER_AMOUNT_NGN = 50_000_000;
const MAX_CRYPTO_AMOUNT = 100_000;

function roundMoney(v: number): number {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

function roundCrypto(v: number): number {
  return Math.round((v + Number.EPSILON) * 1e10) / 1e10;
}

function isMissingRpcError(status: number, body: { code?: string; message?: string } | null): boolean {
  const msg = String(body?.message || "").toLowerCase();
  return status === 404 || body?.code === "PGRST202" || body?.code === "42883" || msg.includes("could not find the function");
}

async function requireAuth(req: Request, res: Response) {
  if (!isSupabaseAdminConfigured()) {
    res.status(503).json({ message: "Database admin service is not configured" });
    return null;
  }
  const user = await verifySupabaseUser(extractBearerToken(req));
  if (!user) {
    res.status(401).json({ message: "Your session has expired. Please sign in again." });
    return null;
  }
  return user;
}

async function checkAccountNotRestricted(userId: string): Promise<{ ok: boolean; error?: string; status?: number }> {
  const [profileRes, secRes] = await Promise.all([
    supabaseRest(`profiles?id=eq.${encodeURIComponent(userId)}&select=id,is_suspended,suspension_reason&limit=1`),
    supabaseRest(`account_security_state?user_id=eq.${encodeURIComponent(userId)}&select=sleep_mode_active,freeze_active&limit=1`),
  ]);

  if (profileRes.ok) {
    const rows = (await profileRes.json().catch(() => [])) as Array<{ is_suspended?: boolean; suspension_reason?: string | null }>;
    if (rows[0]?.is_suspended) {
      return {
        ok: false,
        status: 403,
        error: rows[0].suspension_reason
          ? `Account suspended: ${rows[0].suspension_reason}`
          : "Your account is currently suspended. Contact support.",
      };
    }
  }

  if (secRes.ok) {
    const secRows = (await secRes.json().catch(() => [])) as Array<{ sleep_mode_active?: boolean; freeze_active?: boolean }>;
    if (secRows[0]?.freeze_active) {
      return { ok: false, status: 403, error: "Freeze Account is active. Money movement is blocked." };
    }
    if (secRows[0]?.sleep_mode_active) {
      return { ok: false, status: 403, error: "Sleep Mode is active. Money movement is blocked." };
    }
  }

  return { ok: true };
}

function serializeSafeProfile(row: Record<string, unknown>, fallbackEmail: string) {
  const hasPin = hasCustomTransactionPin({
    pin_hash: typeof row.pin_hash === "string" ? row.pin_hash : null,
    pin: typeof row.pin === "string" ? row.pin : null,
  });
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? "Vexa User"),
    email: String(row.email || fallbackEmail || ""),
    phone: String(row.phone ?? ""),
    balance: Number(row.balance ?? 0),
    accountNumber: String(row.account_number ?? ""),
    referralCode: String(row.referral_code ?? ""),
    hasPin,
    level: Number(row.level ?? 1),
    verified: Boolean(row.verified),
    twoFactorEnabled: Boolean(row.two_factor_enabled),
    profilePhoto: typeof row.profile_photo === "string" ? row.profile_photo : null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. User Profile, Security & PIN Endpoints (Zero PIN Exposure)
// ─────────────────────────────────────────────────────────────────────────────

router.get("/auth/profile", async (req: Request, res: Response) => {
  const authUser = await requireAuth(req, res);
  if (!authUser) return;

  try {
    const selectFull =
      "id,name,email,phone,balance,account_number,referral_code,pin,pin_hash,level,verified,two_factor_enabled,profile_photo";
    let resp = await supabaseRest(`profiles?id=eq.${encodeURIComponent(authUser.id)}&select=${selectFull}&limit=1`);
    if (!resp.ok) {
      resp = await supabaseRest(
        `profiles?id=eq.${encodeURIComponent(authUser.id)}&select=id,name,email,phone,balance,account_number,referral_code,pin,level,verified,two_factor_enabled,profile_photo&limit=1`,
      );
    }

    if (!resp.ok) {
      return res.status(503).json({ message: "Could not load your profile." });
    }

    let rows = (await resp.json().catch(() => [])) as Array<Record<string, unknown>>;
    if (!rows[0]) {
      // Backfill profile for users created before trigger or if trigger missed metadata
      const acc = "9" + Math.floor(100_000_000 + Math.random() * 900_000_000).toString();
      const rawPhone =
        typeof authUser.userMetadata?.phone === "string"
          ? normalizeNigerianPhone(authUser.userMetadata.phone)
          : authUser.email.endsWith("@vexa.app")
            ? normalizeNigerianPhone(authUser.email.split("@")[0])
            : normalizeNigerianPhone(authUser.phone);
      const acctNum =
        typeof authUser.userMetadata?.account_number === "string" && /^\d{10}$/.test(authUser.userMetadata.account_number)
          ? authUser.userMetadata.account_number
          : acc;
      const refCode =
        typeof authUser.userMetadata?.referral_code === "string" && authUser.userMetadata.referral_code
          ? authUser.userMetadata.referral_code
          : `VEXA-${acctNum.slice(-4)}`;

      const createRes = await supabaseRest("profiles", {
        method: "POST",
        headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
        body: JSON.stringify({
          id: authUser.id,
          name: typeof authUser.userMetadata?.name === "string" && authUser.userMetadata.name.trim()
            ? authUser.userMetadata.name.trim()
            : "Vexa User",
          email: authUser.email || "",
          phone: rawPhone || "",
          account_number: acctNum,
          pin: "",
          level: 1,
          verified: false,
          balance: 0,
          referral_code: refCode,
        }),
      });
      if (createRes.ok) {
        rows = (await createRes.json().catch(() => [])) as Array<Record<string, unknown>>;
      }
    }

    if (!rows[0]) {
      return res.status(404).json({ message: "Account profile could not be loaded." });
    }

    return res.json({ profile: serializeSafeProfile(rows[0], authUser.email) });
  } catch (err) {
    req.log?.error({ err }, "Profile fetch failed");
    return res.status(503).json({ message: "Could not load your profile." });
  }
});

router.post("/auth/profile/update", authRateLimiter, async (req: Request, res: Response) => {
  const authUser = await requireAuth(req, res);
  if (!authUser) return;

  const name = typeof req.body?.name === "string" ? req.body.name.trim().slice(0, 100) : "";
  const email = typeof req.body?.email === "string" ? req.body.email.trim().slice(0, 160) : "";
  const rawPhone = typeof req.body?.phone === "string" ? req.body.phone.trim() : "";
  const phone = normalizeNigerianPhone(rawPhone);

  if (!name || name.length < 2) {
    return res.status(400).json({ message: "Enter a valid full name." });
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ message: "Enter a valid email address." });
  }
  if (!/^0\d{10}$/.test(phone)) {
    return res.status(400).json({ message: "Enter a valid 11-digit Nigerian phone number." });
  }

  try {
    const patchRes = await supabaseRest(`profiles?id=eq.${encodeURIComponent(authUser.id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ name, email, phone }),
    });
    if (!patchRes.ok) {
      return res.status(500).json({ message: "Failed to save profile. Please try again." });
    }

    await supabaseAuthAdmin(`users/${encodeURIComponent(authUser.id)}`, {
      method: "PUT",
      body: JSON.stringify({
        user_metadata: {
          ...(authUser.userMetadata || {}),
          name,
          phone,
        },
      }),
    }).catch(() => {});

    return res.json({ success: true, name, email, phone });
  } catch (err) {
    req.log?.error({ err }, "Profile update failed");
    return res.status(500).json({ message: "Failed to save profile." });
  }
});

router.post("/auth/profile/photo", authRateLimiter, async (req: Request, res: Response) => {
  const authUser = await requireAuth(req, res);
  if (!authUser) return;

  const photo = req.body?.photo;
  if (photo !== null && (typeof photo !== "string" || photo.length > 500_000)) {
    return res.status(400).json({ message: "Invalid profile photo payload." });
  }

  const patchRes = await supabaseRest(`profiles?id=eq.${encodeURIComponent(authUser.id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ profile_photo: photo }),
  });
  if (!patchRes.ok) {
    return res.status(500).json({ message: "Failed to save profile photo." });
  }
  return res.json({ success: true });
});

router.post("/auth/2fa", authRateLimiter, async (req: Request, res: Response) => {
  const authUser = await requireAuth(req, res);
  if (!authUser) return;

  const enabled = Boolean(req.body?.enabled);
  const profileRes = await supabaseRest(`profiles?id=eq.${encodeURIComponent(authUser.id)}&select=phone&limit=1`);
  const rows = profileRes.ok ? ((await profileRes.json().catch(() => [])) as Array<{ phone?: string }>) : [];
  const phone = rows[0]?.phone || authUser.phone || null;

  const patchRes = await supabaseRest(`profiles?id=eq.${encodeURIComponent(authUser.id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      two_factor_enabled: enabled,
      two_factor_phone: enabled ? phone : null,
    }),
  });
  if (!patchRes.ok) {
    return res.status(500).json({ message: "Could not update two-factor authentication." });
  }
  return res.json({ success: true, twoFactorEnabled: enabled });
});

router.post("/auth/pin/set", pinRateLimiter, async (req: Request, res: Response) => {
  const authUser = await requireAuth(req, res);
  if (!authUser) return;

  const newPin = typeof req.body?.newPin === "string" ? req.body.newPin.trim() : "";
  if (!/^\d{4}$/.test(newPin) || newPin === "0000") {
    return res.status(400).json({ message: "Choose a secure 4-digit PIN (cannot be 0000)." });
  }

  let hasHashCol = true;
  let profileRes = await supabaseRest(
    `profiles?id=eq.${encodeURIComponent(authUser.id)}&select=id,pin,pin_hash&limit=1`,
  );
  if (!profileRes.ok) {
    hasHashCol = false;
    profileRes = await supabaseRest(
      `profiles?id=eq.${encodeURIComponent(authUser.id)}&select=id,pin&limit=1`,
    );
  }
  if (!profileRes.ok) {
    return res.status(503).json({ message: "Could not verify your PIN status." });
  }
  const rows = (await profileRes.json().catch(() => [])) as Array<{ pin?: string | null; pin_hash?: string | null }>;
  const row = rows[0];
  if (!row) return res.status(404).json({ message: "Account profile not found." });

  if (hasCustomTransactionPin(row)) {
    return res.status(400).json({ message: "Use Change PIN to update an existing transaction PIN." });
  }

  const patchBody = hasHashCol
    ? { pin_hash: hashPin(newPin), pin: "", pin_failed_attempts: 0, pin_locked_until: null }
    : { pin: newPin };

  const patchRes = await supabaseRest(`profiles?id=eq.${encodeURIComponent(authUser.id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(patchBody),
  });
  if (!patchRes.ok) {
    return res.status(500).json({ message: "Failed to save PIN. Please try again." });
  }

  return res.json({ success: true, hasPin: true });
});

router.post("/auth/pin/change", pinRateLimiter, async (req: Request, res: Response) => {
  const authUser = await requireAuth(req, res);
  if (!authUser) return;

  const oldPin = typeof req.body?.oldPin === "string" ? req.body.oldPin.trim() : "";
  const newPin = typeof req.body?.newPin === "string" ? req.body.newPin.trim() : "";

  if (!/^\d{4}$/.test(newPin) || newPin === "0000") {
    return res.status(400).json({ message: "Choose a valid 4-digit PIN other than 0000." });
  }
  if (oldPin === newPin) {
    return res.status(400).json({ message: "New PIN must be different from your current PIN." });
  }

  const check = await verifyUserTransactionPin(authUser.id, oldPin);
  if (!check.ok) {
    return res.status(check.nowLocked ? 429 : 422).json({
      message: check.error || "Current PIN is incorrect.",
    });
  }

  const patchRes = await supabaseRest(`profiles?id=eq.${encodeURIComponent(authUser.id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      pin_hash: hashPin(newPin),
      pin: "",
      pin_failed_attempts: 0,
      pin_locked_until: null,
    }),
  });
  if (!patchRes.ok) {
    // Fallback if migration columns not applied yet
    const legacyPatch = await supabaseRest(`profiles?id=eq.${encodeURIComponent(authUser.id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ pin: newPin }),
    });
    if (!legacyPatch.ok) {
      return res.status(500).json({ message: "Failed to update PIN." });
    }
  }

  return res.json({ success: true, hasPin: true });
});

router.post("/auth/pin/verify", pinRateLimiter, async (req: Request, res: Response) => {
  const authUser = await requireAuth(req, res);
  if (!authUser) return;

  const pin = typeof req.body?.pin === "string" ? req.body.pin.trim() : "";
  const check = await verifyUserTransactionPin(authUser.id, pin);
  if (!check.ok) {
    return res.status(check.nowLocked ? 429 : 422).json({
      verified: false,
      message: check.error || "Incorrect transaction PIN.",
    });
  }
  return res.json({ verified: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Naira Wallet & Transfer Endpoints (Server-Side Authorized)
// ─────────────────────────────────────────────────────────────────────────────

router.post("/wallet/redeem-cashback", async (req: Request, res: Response) => {
  const authUser = await requireAuth(req, res);
  if (!authUser) return;

  const restriction = await checkAccountNotRestricted(authUser.id);
  if (!restriction.ok) {
    return res.status(restriction.status || 403).json({ message: restriction.error });
  }

  try {
    const rpcRes = await supabaseRpc("redeem_cashback_srv", { p_user_id: authUser.id });
    if (rpcRes.ok) {
      const payload = (await rpcRes.json().catch(() => null)) as Record<string, unknown> | null;
      return res.json({ success: true, balance: Number(payload?.balance ?? 0), redeemed: Number(payload?.redeemed ?? 0) });
    }

    const errBody = (await rpcRes.json().catch(() => null)) as { code?: string; message?: string } | null;
    if (isMissingRpcError(rpcRes.status, errBody) || rpcRes.status >= 500) {
      req.log?.error({ status: rpcRes.status, code: errBody?.code }, "redeem_cashback_srv unavailable");
      return res.status(503).json({ message: "Cashback service is temporarily unavailable. Please try again later." });
    }
    return res.status(400).json({ message: errBody?.message || "Could not redeem cashback." });
  } catch (err) {
    req.log?.error({ err }, "redeem-cashback failed");
    return res.status(503).json({ message: "Cashback service is temporarily unavailable. Please try again later." });
  }
});

router.post("/wallet/transfer/bank", pinRateLimiter, async (req: Request, res: Response) => {
  const authUser = await requireAuth(req, res);
  if (!authUser) return;

  const { settings } = await getSystemSettings();
  if (settings.allow_transfers === false) {
    return res.status(403).json({ message: "Outbound transfers are temporarily disabled by maintenance policy." });
  }

  const restriction = await checkAccountNotRestricted(authUser.id);
  if (!restriction.ok) {
    return res.status(restriction.status || 403).json({ message: restriction.error });
  }

  const amount = roundMoney(Number(req.body?.amount));
  const pin = typeof req.body?.pin === "string" ? req.body.pin.trim() : "";
  const recipientName = typeof req.body?.recipientName === "string" ? req.body.recipientName.trim().slice(0, 120) : "";
  const recipientBank = typeof req.body?.recipientBank === "string" ? req.body.recipientBank.trim().slice(0, 120) : "";
  const recipientAccount = typeof req.body?.recipientAccount === "string" ? req.body.recipientAccount.replace(/\D/g, "") : "";
  const note = typeof req.body?.note === "string" ? req.body.note.trim().slice(0, 120) : "Transfer";

  if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_TRANSFER_AMOUNT_NGN) {
    return res.status(400).json({ message: "Enter a valid transfer amount." });
  }
  if (!recipientName || !recipientBank || !/^\d{10}$/.test(recipientAccount)) {
    return res.status(400).json({ message: "Valid recipient bank and 10-digit account details are required." });
  }

  const pinCheck = await verifyUserTransactionPin(authUser.id, pin);
  if (!pinCheck.ok) {
    return res.status(pinCheck.nowLocked ? 429 : 422).json({ message: pinCheck.error || "Incorrect PIN." });
  }

  try {
    const rpcRes = await supabaseRpc("complete_bank_transfer_srv", {
      p_user_id: authUser.id,
      p_amount: amount,
      p_recipient_name: recipientName,
      p_recipient_bank: recipientBank,
      p_recipient_account: recipientAccount,
      p_note: note,
    });

    if (rpcRes.ok) {
      const tx = await rpcRes.json();
      return res.json({ success: true, transaction: tx });
    }

    const errBody = (await rpcRes.json().catch(() => null)) as { code?: string; message?: string } | null;
    if (isMissingRpcError(rpcRes.status, errBody) || rpcRes.status >= 500) {
      req.log?.error({ status: rpcRes.status, code: errBody?.code }, "complete_bank_transfer_srv unavailable");
      return res.status(503).json({ message: "Transfer service is temporarily unavailable. Please try again later." });
    }
    return res.status(400).json({ message: errBody?.message || "Transfer failed." });
  } catch (err) {
    req.log?.error({ err }, "bank transfer failed");
    return res.status(503).json({ message: "Transfer service is temporarily unavailable. Please try again later." });
  }
});

router.post("/wallet/transfer/vexa", pinRateLimiter, async (req: Request, res: Response) => {
  const authUser = await requireAuth(req, res);
  if (!authUser) return;

  const { settings } = await getSystemSettings();
  if (settings.allow_transfers === false) {
    return res.status(403).json({ message: "Transfers are temporarily paused." });
  }

  const restriction = await checkAccountNotRestricted(authUser.id);
  if (!restriction.ok) {
    return res.status(restriction.status || 403).json({ message: restriction.error });
  }

  const recipientAccount = typeof req.body?.accountNumber === "string" ? req.body.accountNumber.replace(/\D/g, "") : "";
  const amount = roundMoney(Number(req.body?.amount));
  const note = typeof req.body?.note === "string" ? req.body.note.trim().slice(0, 120) : "";
  const pin = typeof req.body?.pin === "string" ? req.body.pin.trim() : "";

  if (!/^\d{10}$/.test(recipientAccount)) {
    return res.status(400).json({ message: "Enter a valid 10-digit Vexa account number." });
  }
  if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_TRANSFER_AMOUNT_NGN) {
    return res.status(400).json({ message: "Enter a valid transfer amount." });
  }

  const pinCheck = await verifyUserTransactionPin(authUser.id, pin);
  if (!pinCheck.ok) {
    return res.status(pinCheck.nowLocked ? 429 : 422).json({ message: pinCheck.error || "Incorrect PIN." });
  }

  try {
    const rpcRes = await supabaseRpc("transfer_vexa_money_srv", {
      p_sender_id: authUser.id,
      p_recipient_account: recipientAccount,
      p_amount: amount,
      p_note: note,
    });
    if (rpcRes.ok) {
      const data = (await rpcRes.json().catch(() => ({}))) as Record<string, unknown>;
      return res.json({
        success: true,
        transactionId: data.transaction_id,
        recipientName: data.recipient_name,
      });
    }

    const errBody = (await rpcRes.json().catch(() => null)) as { code?: string; message?: string } | null;
    if (isMissingRpcError(rpcRes.status, errBody) || rpcRes.status >= 500) {
      req.log?.error({ status: rpcRes.status, code: errBody?.code }, "transfer_vexa_money_srv unavailable");
      return res.status(503).json({ message: "Transfer service is temporarily unavailable. Please try again later." });
    }
    return res.status(400).json({ message: errBody?.message || "Transfer failed." });
  } catch (err) {
    req.log?.error({ err }, "vexa transfer failed");
    return res.status(503).json({ message: "Transfer service is temporarily unavailable. Please try again later." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Crypto Exchange Endpoints (Server-Side Verified Market Prices)
// ─────────────────────────────────────────────────────────────────────────────

router.post("/wallet/crypto/deposit-fiat", async (req: Request, res: Response) => {
  const authUser = await requireAuth(req, res);
  if (!authUser) return;

  const { settings } = await getSystemSettings();
  if (settings.allow_crypto_exchange === false) {
    return res.status(403).json({ message: "Crypto Exchange is temporarily disabled." });
  }

  const restriction = await checkAccountNotRestricted(authUser.id);
  if (!restriction.ok) {
    return res.status(restriction.status || 403).json({ message: restriction.error });
  }

  const amount = roundMoney(Number(req.body?.amount));
  if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_TRANSFER_AMOUNT_NGN) {
    return res.status(400).json({ message: "Enter a valid deposit amount." });
  }

  try {
    const rpcRes = await supabaseRpc("deposit_to_crypto_srv", {
      p_user_id: authUser.id,
      p_amount: amount,
    });
    if (rpcRes.ok) {
      const data = await rpcRes.json().catch(() => ({}));
      return res.json({ success: true, ...data });
    }

    const errBody = (await rpcRes.json().catch(() => null)) as { code?: string; message?: string } | null;
    if (isMissingRpcError(rpcRes.status, errBody) || rpcRes.status >= 500) {
      req.log?.error({ status: rpcRes.status, code: errBody?.code }, "deposit_to_crypto_srv unavailable");
      return res.status(503).json({ message: "Crypto deposit service is temporarily unavailable. Please try again later." });
    }
    return res.status(400).json({ message: errBody?.message || "Deposit failed." });
  } catch (err) {
    req.log?.error({ err }, "crypto deposit-fiat failed");
    return res.status(503).json({ message: "Crypto deposit service is temporarily unavailable. Please try again later." });
  }
});

router.post("/wallet/crypto/exchange", async (req: Request, res: Response) => {
  const authUser = await requireAuth(req, res);
  if (!authUser) return;

  const { settings } = await getSystemSettings();
  if (settings.allow_crypto_exchange === false) {
    return res.status(403).json({ message: "Crypto Exchange is temporarily disabled." });
  }

  const restriction = await checkAccountNotRestricted(authUser.id);
  if (!restriction.ok) {
    return res.status(restriction.status || 403).json({ message: restriction.error });
  }

  const asset = String(req.body?.asset ?? "").trim().toUpperCase() as Asset;
  const side = String(req.body?.side ?? "").trim().toLowerCase();
  const nairaAmount = roundMoney(Number(req.body?.nairaAmount));

  if (!["BTC", "ETH", "USDT"].includes(asset)) {
    return res.status(400).json({ message: "Unsupported asset." });
  }
  if (side !== "buy" && side !== "sell") {
    return res.status(400).json({ message: "Unsupported exchange side." });
  }
  if (!Number.isFinite(nairaAmount) || nairaAmount <= 0 || nairaAmount > MAX_TRANSFER_AMOUNT_NGN) {
    return res.status(400).json({ message: "Enter a valid exchange amount." });
  }

  // CRITICAL SECURITY FIX: Always obtain the exchange rate from the server's live
  // price oracle, never trusting client-supplied rates.
  let authoritativeRate: number;
  try {
    const live = await getLiveCryptoPricesNgn();
    authoritativeRate = Number(live.prices[asset]?.ngn);
    if (!Number.isFinite(authoritativeRate) || authoritativeRate <= 0) {
      throw new Error("Invalid market rate");
    }
  } catch {
    return res.status(503).json({ message: "Live market rates are temporarily unavailable. Please try again." });
  }

  try {
    const rpcRes = await supabaseRpc("exchange_crypto_srv", {
      p_user_id: authUser.id,
      p_asset: asset,
      p_side: side,
      p_naira_amount: nairaAmount,
      p_rate: authoritativeRate,
    });
    if (rpcRes.ok) {
      const data = (await rpcRes.json().catch(() => ({}))) as Record<string, unknown>;
      return res.json({ success: true, rate: authoritativeRate, ...data });
    }

    const errBody = (await rpcRes.json().catch(() => null)) as { code?: string; message?: string } | null;
    if (isMissingRpcError(rpcRes.status, errBody) || rpcRes.status >= 500) {
      req.log?.error({ status: rpcRes.status, code: errBody?.code }, "exchange_crypto_srv unavailable");
      return res.status(503).json({ message: "Crypto exchange service is temporarily unavailable. Please try again later." });
    }
    return res.status(400).json({ message: errBody?.message || "Exchange failed." });
  } catch (err) {
    req.log?.error({ err }, "crypto exchange failed");
    return res.status(503).json({ message: "Crypto exchange service is temporarily unavailable. Please try again later." });
  }
});

router.post("/wallet/crypto/transfer", async (req: Request, res: Response) => {
  const authUser = await requireAuth(req, res);
  if (!authUser) return;

  const { settings } = await getSystemSettings();
  if (settings.allow_crypto_exchange === false) {
    return res.status(403).json({ message: "Crypto transfers are temporarily disabled." });
  }

  const restriction = await checkAccountNotRestricted(authUser.id);
  if (!restriction.ok) {
    return res.status(restriction.status || 403).json({ message: restriction.error });
  }

  const accountNumber = typeof req.body?.accountNumber === "string" ? req.body.accountNumber.replace(/\D/g, "") : "";
  const asset = String(req.body?.asset ?? "").trim().toUpperCase() as Asset;
  const amount = roundCrypto(Number(req.body?.amount));

  if (!/^\d{10}$/.test(accountNumber)) {
    return res.status(400).json({ message: "Enter a valid 10-digit Vexa account number." });
  }
  if (!["BTC", "ETH", "USDT"].includes(asset)) {
    return res.status(400).json({ message: "Unsupported asset." });
  }
  if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_CRYPTO_AMOUNT) {
    return res.status(400).json({ message: "Enter a valid crypto amount." });
  }

  try {
    const rpcRes = await supabaseRpc("transfer_crypto_srv", {
      p_sender_id: authUser.id,
      p_recipient_account: accountNumber,
      p_asset: asset,
      p_amount: amount,
    });
    if (rpcRes.ok) {
      const data = (await rpcRes.json().catch(() => ({}))) as Record<string, unknown>;
      return res.json({ success: true, ...data });
    }

    const errBody = (await rpcRes.json().catch(() => null)) as { code?: string; message?: string } | null;
    if (isMissingRpcError(rpcRes.status, errBody) || rpcRes.status >= 500) {
      req.log?.error({ status: rpcRes.status, code: errBody?.code }, "transfer_crypto_srv unavailable");
      return res.status(503).json({ message: "Crypto transfer service is temporarily unavailable. Please try again later." });
    }
    return res.status(400).json({ message: errBody?.message || "Crypto transfer failed." });
  } catch (err) {
    req.log?.error({ err }, "crypto transfer failed");
    return res.status(503).json({ message: "Crypto transfer service is temporarily unavailable. Please try again later." });
  }
});

// Keep isUuid imported for external route helpers if needed
export { isUuid };
export default router;
