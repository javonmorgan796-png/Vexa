import { timingSafeEqual } from "node:crypto";
import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();
const SUPABASE_URL = process.env["SUPABASE_URL"]?.replace(/\/$/, "");
const SUPABASE_SERVICE_ROLE_KEY = process.env["SUPABASE_SERVICE_ROLE_KEY"];

const telecomPinAttempts = new Map<string, { attempts: number; lockedUntil?: number }>();

setInterval(() => {
  const now = Date.now();
  for (const [id, tracker] of telecomPinAttempts) {
    if (tracker.lockedUntil && tracker.lockedUntil <= now) {
      telecomPinAttempts.delete(id);
    }
  }
}, 60_000).unref();

function extractBearer(req: Request): string {
  const value = req.header("authorization") ?? "";
  return value.startsWith("Bearer ") ? value.slice(7).trim() : "";
}

async function getAuthenticatedUserId(token: string): Promise<string | null> {
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

async function supabaseRest(path: string, init: RequestInit = {}) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Database storage is not configured");
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

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function formatNaira(value: number): string {
  return roundMoney(value).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatCashbackDate(): string {
  return new Date().toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

async function verifyUserPin(
  userId: string,
  suppliedPin: unknown,
  savedPin: string | null | undefined,
): Promise<{ ok: boolean; error?: string }> {
  const now = Date.now();
  const tracker = telecomPinAttempts.get(userId);
  if (tracker?.lockedUntil && tracker.lockedUntil > now) {
    const waitSec = Math.ceil((tracker.lockedUntil - now) / 1000);
    return {
      ok: false,
      error: `Too many incorrect PIN attempts. Try again in ${waitSec}s.`,
    };
  }

  if (typeof suppliedPin !== "string" || !/^\d{4}$/.test(suppliedPin)) {
    return { ok: false, error: "Enter a valid 4-digit transaction PIN." };
  }

  const expectedStr = typeof savedPin === "string" ? savedPin : "";
  const provided = Buffer.from(suppliedPin);
  const expected = Buffer.from(expectedStr);
  const matches =
    expected.length === 4 &&
    provided.length === expected.length &&
    timingSafeEqual(provided, expected);

  if (!matches) {
    const current = (tracker?.attempts ?? 0) + 1;
    if (current >= 5) {
      telecomPinAttempts.set(userId, {
        attempts: current,
        lockedUntil: now + 15 * 60 * 1000,
      });
      return {
        ok: false,
        error: "Too many incorrect PIN attempts. Locked for 15 minutes.",
      };
    }
    telecomPinAttempts.set(userId, { attempts: current });
    return { ok: false, error: "Incorrect transaction PIN." };
  }

  telecomPinAttempts.delete(userId);
  return { ok: true };
}

router.post("/telecom/purchase", async (req: Request, res: Response) => {
  try {
    const token = extractBearer(req);
    const userId = await getAuthenticatedUserId(token);
    if (!userId) {
      return res.status(401).json({ message: "Your session has expired. Please sign in again." });
    }

    const {
      productType,
      networkName,
      phone,
      dataBundle,
      amount,
      useCashback,
      pin,
    } = req.body ?? {};

    if (productType !== "airtime" && productType !== "data") {
      return res.status(400).json({ message: "Invalid telecom product type." });
    }

    const cleanNetwork = typeof networkName === "string" ? networkName.trim().slice(0, 40) : "";
    if (!cleanNetwork) {
      return res.status(400).json({ message: "Please select a network provider." });
    }

    const cleanPhone = typeof phone === "string" ? phone.replace(/\D/g, "") : "";
    if (cleanPhone.length < 10 || cleanPhone.length > 13) {
      return res.status(400).json({ message: "Enter a valid recipient mobile number." });
    }

    const numAmount = roundMoney(Number(amount));
    if (!Number.isFinite(numAmount) || numAmount <= 0 || numAmount > 500_000) {
      return res.status(400).json({ message: "Enter a valid purchase amount." });
    }

    const cleanBundle = typeof dataBundle === "string" ? dataBundle.trim().slice(0, 80) : "";

    // 1. Check account security lock state
    const secResp = await supabaseRest(
      `account_security_state?user_id=eq.${encodeURIComponent(userId)}&select=sleep_mode_active,freeze_active&limit=1`,
    );
    if (secResp.ok) {
      const secRows = (await secResp.json().catch(() => [])) as Array<{
        sleep_mode_active?: boolean;
        freeze_active?: boolean;
      }>;
      if (secRows[0]?.freeze_active) {
        return res.status(403).json({ message: "Freeze Account is active. Money movement is blocked." });
      }
      if (secRows[0]?.sleep_mode_active) {
        return res.status(403).json({ message: "Sleep Mode is active. Money movement is blocked." });
      }
    }

    // 2. Load user's profile (balance & PIN)
    const profileResp = await supabaseRest(
      `profiles?id=eq.${encodeURIComponent(userId)}&select=id,balance,pin&limit=1`,
    );
    if (!profileResp.ok) {
      return res.status(503).json({ message: "Could not load your account profile." });
    }
    const profileRows = (await profileResp.json().catch(() => [])) as Array<{
      id: string;
      balance: number | string;
      pin?: string | null;
    }>;
    const profile = profileRows[0];
    if (!profile) {
      return res.status(404).json({ message: "User profile not found." });
    }

    // 3. Verify transaction PIN
    const pinCheck = await verifyUserPin(userId, pin, profile.pin);
    if (!pinCheck.ok) {
      return res.status(422).json({ message: pinCheck.error || "Incorrect transaction PIN." });
    }

    // 4. Read redeemable ("cleared") cashback rows
    const shouldUseCashback = Boolean(useCashback);
    let cashbackRows: Array<{ id: string; earned: number | string }> = [];
    if (shouldUseCashback) {
      const cbResp = await supabaseRest(
        `cashback_history?user_id=eq.${encodeURIComponent(userId)}&status=eq.cleared&select=id,earned&order=created_at.asc`,
      );
      if (!cbResp.ok) {
        return res.status(503).json({ message: "Could not read your cashback balance." });
      }
      cashbackRows = (await cbResp.json().catch(() => [])) as Array<{
        id: string;
        earned: number | string;
      }>;
    }

    const totalClearedCashback = roundMoney(
      cashbackRows.reduce((sum, row) => sum + Math.max(0, Number(row.earned) || 0), 0),
    );
    const cashbackUsed = shouldUseCashback
      ? roundMoney(Math.min(numAmount, totalClearedCashback))
      : 0;
    const payableAmount = roundMoney(Math.max(0, numAmount - cashbackUsed));

    const currentBalance = Number(profile.balance ?? 0);
    if (payableAmount > currentBalance) {
      return res.status(400).json({ message: "Insufficient wallet balance for this purchase." });
    }

    // 5. Optimistically debit wallet balance (CAS on current balance)
    const newBalance = roundMoney(currentBalance - payableAmount);
    if (payableAmount > 0) {
      const debitResp = await supabaseRest(
        `profiles?id=eq.${encodeURIComponent(userId)}&balance=eq.${encodeURIComponent(String(profile.balance))}`,
        {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({ balance: newBalance }),
        },
      );
      if (!debitResp.ok) {
        return res.status(503).json({ message: "Could not debit your wallet balance." });
      }
      const updatedProfiles = (await debitResp.json().catch(() => [])) as Array<{ id: string }>;
      if (updatedProfiles.length === 0) {
        return res.status(409).json({ message: "Your balance changed. Please try again." });
      }
    }

    // 6. Consume applied cashback from cleared rows
    const dateLabel = formatCashbackDate();
    if (cashbackUsed > 0) {
      let remainingToConsume = cashbackUsed;
      for (const row of cashbackRows) {
        if (remainingToConsume <= 0) break;
        const rowEarned = roundMoney(Math.max(0, Number(row.earned) || 0));
        if (rowEarned <= 0) continue;

        if (rowEarned <= remainingToConsume + 0.001) {
          await supabaseRest(`cashback_history?id=eq.${encodeURIComponent(row.id)}`, {
            method: "PATCH",
            body: JSON.stringify({ status: "redeemed" }),
          });
          remainingToConsume = roundMoney(Math.max(0, remainingToConsume - rowEarned));
        } else {
          const leftover = roundMoney(rowEarned - remainingToConsume);
          await supabaseRest(`cashback_history?id=eq.${encodeURIComponent(row.id)}`, {
            method: "PATCH",
            body: JSON.stringify({ earned: leftover }),
          });
          await supabaseRest("cashback_history", {
            method: "POST",
            body: JSON.stringify({
              user_id: userId,
              description: `Applied to ${cleanNetwork} ${productType === "data" ? "Data" : "Airtime"} (${cleanPhone})`,
              date: dateLabel,
              rate: "Applied",
              earned: remainingToConsume,
              status: "redeemed",
            }),
          });
          remainingToConsume = 0;
        }
      }
    }

    // 7. Credit 5% cashback reward on the purchase
    const cashbackEarned = roundMoney(numAmount * 0.05);
    if (cashbackEarned > 0) {
      await supabaseRest("cashback_history", {
        method: "POST",
        body: JSON.stringify({
          user_id: userId,
          description: `${cleanNetwork} ${productType === "data" ? "Data" : "Airtime"} · ${cleanPhone}`,
          date: dateLabel,
          rate: "5%",
          earned: cashbackEarned,
          status: "cleared",
        }),
      });
    }

    // 8. Record transaction history
    const txName = `${cleanNetwork} ${productType === "data" ? "Mobile Data" : "Airtime"}`;
    const noteParts = [
      productType === "data" && cleanBundle ? cleanBundle : null,
      cleanPhone,
      cashbackUsed > 0 ? `Cashback used -₦${formatNaira(cashbackUsed)}` : null,
    ].filter(Boolean);

    await supabaseRest("transactions", {
      method: "POST",
      body: JSON.stringify({
        user_id: userId,
        type: "out",
        name: txName,
        amount: payableAmount,
        note: noteParts.join(" · "),
      }),
    });

    // 9. Record user notification
    const notifTitle =
      productType === "data" ? `${cleanNetwork} Data Activated` : `${cleanNetwork} Airtime Sent`;
    const notifBody =
      productType === "data"
        ? `${cleanBundle || `₦${formatNaira(numAmount)} data`} sent to ${cleanPhone}. Paid ₦${formatNaira(payableAmount)}${cashbackUsed > 0 ? ` (₦${formatNaira(cashbackUsed)} cashback used)` : ""}${cashbackEarned > 0 ? ` · +₦${formatNaira(cashbackEarned)} cashback earned` : ""}.`
        : `₦${formatNaira(numAmount)} airtime sent to ${cleanPhone}. Paid ₦${formatNaira(payableAmount)}${cashbackUsed > 0 ? ` (₦${formatNaira(cashbackUsed)} cashback used)` : ""}${cashbackEarned > 0 ? ` · +₦${formatNaira(cashbackEarned)} cashback earned` : ""}.`;

    await supabaseRest("notifications", {
      method: "POST",
      body: JSON.stringify({
        user_id: userId,
        type: "debit",
        title: notifTitle,
        body: notifBody,
        read: false,
      }),
    });

    return res.json({
      success: true,
      newBalance,
      payableAmount,
      cashbackUsed,
      cashbackEarned,
    });
  } catch (error) {
    req.log?.error({ err: error }, "telecom purchase failed");
    return res.status(500).json({
      message: error instanceof Error ? error.message : "Could not complete purchase.",
    });
  }
});

export default router;
