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

function formatNaira(v: number): string {
  return roundMoney(v).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatCrypto(v: number): string {
  return Number(v.toFixed(8)).toString();
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
    if (!isMissingRpcError(rpcRes.status, errBody)) {
      return res.status(400).json({ message: errBody?.message || "Could not redeem cashback." });
    }

    // Fallback atomic REST path (backend service_role only)
    const [profileRes, cbRes] = await Promise.all([
      supabaseRest(`profiles?id=eq.${encodeURIComponent(authUser.id)}&select=id,balance&limit=1`),
      supabaseRest(`cashback_history?user_id=eq.${encodeURIComponent(authUser.id)}&status=eq.cleared&select=id,earned`),
    ]);
    if (!profileRes.ok || !cbRes.ok) {
      return res.status(503).json({ message: "Could not load cashback balance." });
    }
    const profiles = (await profileRes.json().catch(() => [])) as Array<{ id: string; balance: number }>;
    const cbRows = (await cbRes.json().catch(() => [])) as Array<{ id: string; earned: number }>;
    const profile = profiles[0];
    if (!profile) return res.status(404).json({ message: "Profile not found." });

    const redeemable = roundMoney(cbRows.reduce((s, r) => s + Math.max(0, Number(r.earned) || 0), 0));
    if (redeemable <= 0) {
      return res.status(400).json({ message: "No cleared cashback available to redeem." });
    }

    const newBalance = roundMoney(Number(profile.balance) + redeemable);
    const debitCb = await supabaseRest(
      `cashback_history?user_id=eq.${encodeURIComponent(authUser.id)}&status=eq.cleared`,
      {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ status: "redeemed" }),
      },
    );
    if (!debitCb.ok) return res.status(500).json({ message: "Could not update cashback status." });
    const updatedRows = (await debitCb.json().catch(() => [])) as Array<unknown>;
    if (updatedRows.length === 0) return res.status(409).json({ message: "Cashback already redeemed." });

    await supabaseRest(
      `profiles?id=eq.${encodeURIComponent(authUser.id)}&balance=eq.${encodeURIComponent(String(profile.balance))}`,
      {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ balance: newBalance }),
      },
    );

    await Promise.all([
      supabaseRest("transactions", {
        method: "POST",
        body: JSON.stringify({
          user_id: authUser.id,
          type: "in",
          name: "Cashback Redemption",
          amount: redeemable,
          note: "Redeemed cleared cashback rewards to Vexa balance",
        }),
      }),
      supabaseRest("notifications", {
        method: "POST",
        body: JSON.stringify({
          user_id: authUser.id,
          type: "credit",
          title: "Cashback Redeemed",
          body: `₦${formatNaira(redeemable)} cashback was added to your Vexa balance.`,
          read: false,
        }),
      }),
    ]);

    return res.json({ success: true, balance: newBalance, redeemed: redeemable });
  } catch (err) {
    req.log?.error({ err }, "redeem-cashback failed");
    return res.status(500).json({ message: "Could not redeem cashback." });
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
    if (!isMissingRpcError(rpcRes.status, errBody)) {
      return res.status(400).json({ message: errBody?.message || "Transfer failed." });
    }

    // Atomic CAS fallback
    const profileRes = await supabaseRest(
      `profiles?id=eq.${encodeURIComponent(authUser.id)}&select=id,name,account_number,balance&limit=1`,
    );
    const profiles = profileRes.ok ? ((await profileRes.json().catch(() => [])) as Array<Record<string, unknown>>) : [];
    const sender = profiles[0];
    if (!sender) return res.status(404).json({ message: "Sender account not found." });

    const fee = 10.75;
    const totalDebit = roundMoney(amount + fee);
    const currentBal = Number(sender.balance ?? 0);
    if (currentBal < totalDebit) {
      return res.status(400).json({ message: "Insufficient Vexa balance (including ₦10.75 fee)." });
    }

    const nextBal = roundMoney(currentBal - totalDebit);
    const debitRes = await supabaseRest(
      `profiles?id=eq.${encodeURIComponent(authUser.id)}&balance=eq.${encodeURIComponent(String(sender.balance))}`,
      {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ balance: nextBal }),
      },
    );
    if (!debitRes.ok) return res.status(503).json({ message: "Could not debit wallet." });
    const updated = (await debitRes.json().catch(() => [])) as Array<unknown>;
    if (updated.length === 0) return res.status(409).json({ message: "Balance changed. Please retry." });

    const txRes = await supabaseRest("transactions", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        user_id: authUser.id,
        type: "out",
        name: recipientName,
        amount,
        note,
        recipient_bank: recipientBank,
        recipient_account: recipientAccount,
        sender_name: String(sender.name || "Vexa User"),
        sender_account: String(sender.account_number || ""),
      }),
    });
    const txRows = txRes.ok ? ((await txRes.json().catch(() => [])) as Array<Record<string, unknown>>) : [];

    await supabaseRest("notifications", {
      method: "POST",
      body: JSON.stringify({
        user_id: authUser.id,
        type: "debit",
        title: "Bank transfer sent",
        body: `₦${formatNaira(amount)} sent to ${recipientName} (${recipientBank}).`,
        read: false,
      }),
    }).catch(() => {});

    return res.json({ success: true, transaction: txRows[0] ?? null });
  } catch (err) {
    req.log?.error({ err }, "bank transfer failed");
    return res.status(500).json({ message: "Transfer could not be completed." });
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
    if (!isMissingRpcError(rpcRes.status, errBody)) {
      return res.status(400).json({ message: errBody?.message || "Transfer failed." });
    }

    // Atomic CAS fallback
    const [senderRes, recRes] = await Promise.all([
      supabaseRest(`profiles?id=eq.${encodeURIComponent(authUser.id)}&select=id,name,account_number,balance&limit=1`),
      supabaseRest(`profiles?account_number=eq.${encodeURIComponent(recipientAccount)}&select=id,name,account_number,balance&limit=1`),
    ]);
    const senders = senderRes.ok ? ((await senderRes.json().catch(() => [])) as Array<Record<string, unknown>>) : [];
    const recipients = recRes.ok ? ((await recRes.json().catch(() => [])) as Array<Record<string, unknown>>) : [];
    const sender = senders[0];
    const recipient = recipients[0];

    if (!sender) return res.status(404).json({ message: "Sender account not found." });
    if (!recipient) return res.status(404).json({ message: "No Vexa user was found for that account number." });
    if (sender.id === recipient.id) return res.status(400).json({ message: "You cannot transfer money to your own account." });

    const senderBal = Number(sender.balance ?? 0);
    if (senderBal < amount) return res.status(400).json({ message: "Insufficient Vexa balance." });

    const debitRes = await supabaseRest(
      `profiles?id=eq.${encodeURIComponent(String(sender.id))}&balance=eq.${encodeURIComponent(String(sender.balance))}`,
      {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ balance: roundMoney(senderBal - amount) }),
      },
    );
    const updatedSender = debitRes.ok ? ((await debitRes.json().catch(() => [])) as Array<unknown>) : [];
    if (updatedSender.length === 0) return res.status(409).json({ message: "Balance changed. Please retry." });

    await supabaseRest(`profiles?id=eq.${encodeURIComponent(String(recipient.id))}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ balance: roundMoney(Number(recipient.balance ?? 0) + amount) }),
    });

    const peerRes = await supabaseRest("transactions", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify([
        {
          user_id: sender.id,
          type: "out",
          name: String(recipient.name || "Vexa user"),
          amount,
          note: note || "Vexa-to-Vexa transfer",
          recipient_bank: "Vexa",
          recipient_account: String(recipient.account_number || ""),
          sender_name: String(sender.name || "Vexa user"),
          sender_account: String(sender.account_number || ""),
        },
        {
          user_id: recipient.id,
          type: "in",
          name: String(sender.name || "Vexa user"),
          amount,
          note: note || "Received from Vexa user",
          recipient_bank: "Vexa",
          recipient_account: String(recipient.account_number || ""),
          sender_name: String(sender.name || "Vexa user"),
          sender_account: String(sender.account_number || ""),
        },
      ]),
    });
    const insertedTxs = peerRes.ok ? ((await peerRes.json().catch(() => [])) as Array<{ id?: string }>) : [];

    await supabaseRest("notifications", {
      method: "POST",
      body: JSON.stringify([
        {
          user_id: sender.id,
          type: "debit",
          title: "Vexa transfer sent",
          body: `₦${formatNaira(amount)} sent to ${String(recipient.name || "Vexa user")}`,
          read: false,
        },
        {
          user_id: recipient.id,
          type: "credit",
          title: "Money received",
          body: `₦${formatNaira(amount)} received from ${String(sender.name || "Vexa user")}`,
          read: false,
        },
      ]),
    }).catch(() => {});

    return res.json({
      success: true,
      transactionId: insertedTxs[0]?.id ?? "",
      recipientName: String(recipient.name || "Vexa user"),
    });
  } catch (err) {
    req.log?.error({ err }, "vexa transfer failed");
    return res.status(500).json({ message: "Transfer could not be completed." });
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
    if (!isMissingRpcError(rpcRes.status, errBody)) {
      return res.status(400).json({ message: errBody?.message || "Deposit failed." });
    }

    // CAS fallback
    const profileRes = await supabaseRest(`profiles?id=eq.${encodeURIComponent(authUser.id)}&select=id,balance&limit=1`);
    const profiles = profileRes.ok ? ((await profileRes.json().catch(() => [])) as Array<{ balance: number }>) : [];
    const profile = profiles[0];
    if (!profile) return res.status(404).json({ message: "Profile not found." });
    if (Number(profile.balance) < amount) return res.status(400).json({ message: "Insufficient Vexa balance." });

    const debit = await supabaseRest(
      `profiles?id=eq.${encodeURIComponent(authUser.id)}&balance=eq.${encodeURIComponent(String(profile.balance))}`,
      {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ balance: roundMoney(Number(profile.balance) - amount) }),
      },
    );
    const updated = debit.ok ? ((await debit.json().catch(() => [])) as Array<unknown>) : [];
    if (updated.length === 0) return res.status(409).json({ message: "Balance changed. Please retry." });

    const acctRes = await supabaseRest(
      `crypto_accounts?user_id=eq.${encodeURIComponent(authUser.id)}&select=naira_balance&limit=1`,
    );
    const acctRows = acctRes.ok ? ((await acctRes.json().catch(() => [])) as Array<{ naira_balance: number }>) : [];
    if (acctRows[0]) {
      await supabaseRest(`crypto_accounts?user_id=eq.${encodeURIComponent(authUser.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ naira_balance: roundMoney(Number(acctRows[0].naira_balance) + amount) }),
      });
    } else {
      await supabaseRest("crypto_accounts", {
        method: "POST",
        body: JSON.stringify({ user_id: authUser.id, naira_balance: amount }),
      });
    }

    await Promise.all([
      supabaseRest("crypto_transactions", {
        method: "POST",
        body: JSON.stringify({
          user_id: authUser.id,
          kind: "deposit",
          asset: "NGN",
          amount,
          naira_amount: amount,
          note: "Funded from Vexa balance",
        }),
      }),
      supabaseRest("notifications", {
        method: "POST",
        body: JSON.stringify({
          user_id: authUser.id,
          type: "crypto",
          title: "Exchange wallet funded",
          body: `₦${formatNaira(amount)} moved from your Vexa balance to your Exchange wallet.`,
          read: false,
        }),
      }),
    ]);

    return res.json({ success: true });
  } catch (err) {
    req.log?.error({ err }, "crypto deposit-fiat failed");
    return res.status(500).json({ message: "Deposit failed." });
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
    if (!isMissingRpcError(rpcRes.status, errBody)) {
      return res.status(400).json({ message: errBody?.message || "Exchange failed." });
    }

    // CAS fallback
    const [acctRes, balRes] = await Promise.all([
      supabaseRest(`crypto_accounts?user_id=eq.${encodeURIComponent(authUser.id)}&select=naira_balance&limit=1`),
      supabaseRest(`crypto_balances?user_id=eq.${encodeURIComponent(authUser.id)}&asset=eq.${asset}&select=amount&limit=1`),
    ]);
    const acctRows = acctRes.ok ? ((await acctRes.json().catch(() => [])) as Array<{ naira_balance: number }>) : [];
    const balRows = balRes.ok ? ((await balRes.json().catch(() => [])) as Array<{ amount: number }>) : [];

    const walletNaira = Number(acctRows[0]?.naira_balance ?? 0);
    const assetBal = Number(balRows[0]?.amount ?? 0);
    const cryptoAmount = roundCrypto(nairaAmount / authoritativeRate);

    if (side === "buy") {
      if (walletNaira < nairaAmount) return res.status(400).json({ message: "Insufficient exchange Naira balance." });
      const patchAcct = await supabaseRest(
        `crypto_accounts?user_id=eq.${encodeURIComponent(authUser.id)}&naira_balance=eq.${encodeURIComponent(String(acctRows[0].naira_balance))}`,
        {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({ naira_balance: roundMoney(walletNaira - nairaAmount) }),
        },
      );
      const updatedAcct = patchAcct.ok ? ((await patchAcct.json().catch(() => [])) as Array<unknown>) : [];
      if (updatedAcct.length === 0) return res.status(409).json({ message: "Balance changed. Please retry." });

      if (balRows[0]) {
        await supabaseRest(`crypto_balances?user_id=eq.${encodeURIComponent(authUser.id)}&asset=eq.${asset}`, {
          method: "PATCH",
          body: JSON.stringify({ amount: roundCrypto(assetBal + cryptoAmount), updated_at: new Date().toISOString() }),
        });
      } else {
        await supabaseRest("crypto_balances", {
          method: "POST",
          body: JSON.stringify({ user_id: authUser.id, asset, amount: cryptoAmount }),
        });
      }
    } else {
      if (assetBal < cryptoAmount || !balRows[0]) return res.status(400).json({ message: "Insufficient crypto balance." });
      const patchBal = await supabaseRest(
        `crypto_balances?user_id=eq.${encodeURIComponent(authUser.id)}&asset=eq.${asset}&amount=eq.${encodeURIComponent(String(balRows[0].amount))}`,
        {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({ amount: roundCrypto(assetBal - cryptoAmount), updated_at: new Date().toISOString() }),
        },
      );
      const updatedBal = patchBal.ok ? ((await patchBal.json().catch(() => [])) as Array<unknown>) : [];
      if (updatedBal.length === 0) return res.status(409).json({ message: "Balance changed. Please retry." });

      if (acctRows[0]) {
        await supabaseRest(`crypto_accounts?user_id=eq.${encodeURIComponent(authUser.id)}`, {
          method: "PATCH",
          body: JSON.stringify({ naira_balance: roundMoney(walletNaira + nairaAmount) }),
        });
      } else {
        await supabaseRest("crypto_accounts", {
          method: "POST",
          body: JSON.stringify({ user_id: authUser.id, naira_balance: nairaAmount }),
        });
      }
    }

    await Promise.all([
      supabaseRest("crypto_transactions", {
        method: "POST",
        body: JSON.stringify({
          user_id: authUser.id,
          kind: side,
          asset,
          amount: cryptoAmount,
          naira_amount: nairaAmount,
          rate: authoritativeRate,
          note: side === "buy" ? "Bought with exchange balance" : "Sold to exchange balance",
        }),
      }),
      supabaseRest("notifications", {
        method: "POST",
        body: JSON.stringify({
          user_id: authUser.id,
          type: "crypto",
          title: side === "buy" ? `${asset} purchase successful` : `${asset} sale successful`,
          body:
            side === "buy"
              ? `Bought ${formatCrypto(cryptoAmount)} ${asset} for ₦${formatNaira(nairaAmount)}.`
              : `Sold ${formatCrypto(cryptoAmount)} ${asset} for ₦${formatNaira(nairaAmount)} to your Exchange balance.`,
          read: false,
        }),
      }),
    ]);

    return res.json({ success: true, asset_amount: cryptoAmount, rate: authoritativeRate });
  } catch (err) {
    req.log?.error({ err }, "crypto exchange failed");
    return res.status(500).json({ message: "Exchange failed." });
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
    if (!isMissingRpcError(rpcRes.status, errBody)) {
      return res.status(400).json({ message: errBody?.message || "Crypto transfer failed." });
    }

    // CAS fallback
    const [senderRes, recRes, balRes] = await Promise.all([
      supabaseRest(`profiles?id=eq.${encodeURIComponent(authUser.id)}&select=id,name,account_number&limit=1`),
      supabaseRest(`profiles?account_number=eq.${encodeURIComponent(accountNumber)}&select=id,name,account_number&limit=1`),
      supabaseRest(`crypto_balances?user_id=eq.${encodeURIComponent(authUser.id)}&asset=eq.${asset}&select=amount&limit=1`),
    ]);

    const senders = senderRes.ok ? ((await senderRes.json().catch(() => [])) as Array<Record<string, unknown>>) : [];
    const recipients = recRes.ok ? ((await recRes.json().catch(() => [])) as Array<Record<string, unknown>>) : [];
    const balRows = balRes.ok ? ((await balRes.json().catch(() => [])) as Array<{ amount: number }>) : [];
    const sender = senders[0];
    const recipient = recipients[0];

    if (!sender) return res.status(404).json({ message: "Sender account not found." });
    if (!recipient) return res.status(404).json({ message: "No Vexa user was found for that account number." });
    if (sender.id === recipient.id) return res.status(400).json({ message: "You cannot transfer to your own account." });

    const senderBal = Number(balRows[0]?.amount ?? 0);
    if (!balRows[0] || senderBal < amount) {
      return res.status(400).json({ message: "Insufficient crypto balance." });
    }

    const debit = await supabaseRest(
      `crypto_balances?user_id=eq.${encodeURIComponent(authUser.id)}&asset=eq.${asset}&amount=eq.${encodeURIComponent(String(balRows[0].amount))}`,
      {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ amount: roundCrypto(senderBal - amount), updated_at: new Date().toISOString() }),
      },
    );
    const debitedRows = debit.ok ? ((await debit.json().catch(() => [])) as Array<unknown>) : [];
    if (debitedRows.length === 0) return res.status(409).json({ message: "Balance changed. Please retry." });

    const recBalRes = await supabaseRest(
      `crypto_balances?user_id=eq.${encodeURIComponent(String(recipient.id))}&asset=eq.${asset}&select=amount&limit=1`,
    );
    const recBalRows = recBalRes.ok ? ((await recBalRes.json().catch(() => [])) as Array<{ amount: number }>) : [];
    if (recBalRows[0]) {
      await supabaseRest(
        `crypto_balances?user_id=eq.${encodeURIComponent(String(recipient.id))}&asset=eq.${asset}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            amount: roundCrypto(Number(recBalRows[0].amount) + amount),
            updated_at: new Date().toISOString(),
          }),
        },
      );
    } else {
      await supabaseRest("crypto_balances", {
        method: "POST",
        body: JSON.stringify({ user_id: recipient.id, asset, amount }),
      });
    }

    await Promise.all([
      supabaseRest("crypto_transactions", {
        method: "POST",
        body: JSON.stringify([
          {
            user_id: authUser.id,
            kind: "transfer_out",
            asset,
            amount,
            counterparty_account: String(recipient.account_number || ""),
            note: "Crypto sent to Vexa user",
          },
          {
            user_id: recipient.id,
            kind: "transfer_in",
            asset,
            amount,
            counterparty_account: String(sender.account_number || ""),
            note: "Crypto received from Vexa user",
          },
        ]),
      }),
      supabaseRest("notifications", {
        method: "POST",
        body: JSON.stringify([
          {
            user_id: authUser.id,
            type: "crypto",
            title: `${asset} transfer sent`,
            body: `${formatCrypto(amount)} ${asset} sent to ${String(recipient.name || "Vexa user")} (${String(recipient.account_number || accountNumber)}).`,
            read: false,
          },
          {
            user_id: recipient.id,
            type: "crypto",
            title: `${asset} received`,
            body: `${formatCrypto(amount)} ${asset} received from ${String(sender.name || "Vexa user")}.`,
            read: false,
          },
        ]),
      }),
    ]);

    return res.json({
      success: true,
      recipient_name: String(recipient.name || "Vexa user"),
      recipient_account: String(recipient.account_number || accountNumber),
    });
  } catch (err) {
    req.log?.error({ err }, "crypto transfer failed");
    return res.status(500).json({ message: "Crypto transfer failed." });
  }
});

// Keep isUuid imported for external route helpers if needed
export { isUuid };
export default router;
