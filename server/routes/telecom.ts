import { Router, type IRouter, type Request, type Response } from "express";
import { verifyUserTransactionPin } from "../lib/pinSecurity";
import { pinRateLimiter } from "../lib/rateLimit";
import {
  extractBearerToken,
  isSupabaseAdminConfigured,
  supabaseRest,
  supabaseRpc,
  verifySupabaseUser,
} from "../lib/supabaseAdmin";

const router: IRouter = Router();

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

router.post("/telecom/purchase", pinRateLimiter, async (req: Request, res: Response) => {
  try {
    if (!isSupabaseAdminConfigured()) {
      return res.status(503).json({ message: "Database storage is not configured." });
    }

    const token = extractBearerToken(req);
    const verifiedUser = await verifySupabaseUser(token);
    if (!verifiedUser) {
      return res.status(401).json({ message: "Your session has expired. Please sign in again." });
    }
    const userId = verifiedUser.id;

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

    // 1. Pre-check profile existence, suspension, and account security lock state
    const [profileResp, secResp] = await Promise.all([
      supabaseRest(`profiles?id=eq.${encodeURIComponent(userId)}&select=id,is_suspended&limit=1`),
      supabaseRest(`account_security_state?user_id=eq.${encodeURIComponent(userId)}&select=sleep_mode_active,freeze_active&limit=1`),
    ]);

    if (!profileResp.ok) {
      return res.status(503).json({ message: "Could not load your account profile." });
    }
    const profileRows = (await profileResp.json().catch(() => [])) as Array<{
      id: string;
      is_suspended?: boolean;
    }>;
    const profile = profileRows[0];
    if (!profile) {
      return res.status(404).json({ message: "User profile not found." });
    }
    if (profile.is_suspended) {
      return res.status(403).json({ message: "Your Vexa account is currently suspended." });
    }

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

    // 2. Verify hashed transaction PIN with lockout enforcement
    const pinCheck = await verifyUserTransactionPin(userId, pin);
    if (!pinCheck.ok) {
      return res.status(pinCheck.nowLocked ? 429 : 422).json({
        message: pinCheck.error || "Incorrect transaction PIN.",
      });
    }

    // 3. Execute single atomic database transaction via service_role RPC (fails closed if missing)
    const rpcResp = await supabaseRpc("telecom_purchase_srv", {
      p_user_id: userId,
      p_product_type: productType,
      p_network_name: cleanNetwork,
      p_phone: cleanPhone,
      p_data_bundle: cleanBundle,
      p_amount: numAmount,
      p_use_cashback: Boolean(useCashback),
    });

    if (!rpcResp.ok) {
      const errBody = (await rpcResp.json().catch(() => null)) as {
        message?: string;
        code?: string;
        details?: string;
      } | null;
      const errMsg = errBody?.message || "Could not complete purchase.";
      const lower = errMsg.toLowerCase();

      if (
        rpcResp.status === 404 ||
        errBody?.code === "PGRST202" ||
        errBody?.code === "42883" ||
        lower.includes("could not find the function")
      ) {
        req.log?.error({ err: errBody }, "telecom_purchase_srv RPC is not provisioned");
        return res.status(503).json({
          message: "Atomic telecom settlement RPC is not provisioned yet. Please run supabase-security-migration.sql.",
        });
      }

      if (lower.includes("suspended") || lower.includes("freeze") || lower.includes("sleep")) {
        return res.status(403).json({ message: errMsg });
      }
      if (lower.includes("insufficient") || lower.includes("invalid") || lower.includes("valid")) {
        return res.status(400).json({ message: errMsg });
      }
      return res.status(422).json({ message: errMsg });
    }

    const data = (await rpcResp.json().catch(() => null)) as {
      new_balance?: number;
      payable_amount?: number;
      cashback_used?: number;
      cashback_earned?: number;
    } | null;

    return res.json({
      success: true,
      newBalance: Number(data?.new_balance ?? 0),
      payableAmount: Number(data?.payable_amount ?? 0),
      cashbackUsed: Number(data?.cashback_used ?? 0),
      cashbackEarned: Number(data?.cashback_earned ?? 0),
    });
  } catch (error) {
    req.log?.error({ err: error }, "telecom purchase failed");
    return res.status(500).json({
      message: error instanceof Error ? error.message : "Could not complete purchase.",
    });
  }
});

export default router;
