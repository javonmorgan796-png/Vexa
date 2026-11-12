import { createHmac, timingSafeEqual } from "node:crypto";
import { Router, type IRouter, type Request, type Response } from "express";
import {
  extractBearerToken,
  isSupabaseAdminConfigured,
  isUuid,
  supabaseRest,
  supabaseRpc,
  verifySupabaseUser,
} from "../lib/supabaseAdmin";
import { resolveAccountRateLimiter } from "../lib/rateLimit";

const router: IRouter = Router();
const PAYSTACK_SECRET_KEY = process.env["PAYSTACK_SECRET_KEY"]?.trim();
const LOGO_DEV_TOKEN = process.env["LOGO_DEV_TOKEN"]?.trim();
const PAYSTACK_TEST_MODE = PAYSTACK_SECRET_KEY?.startsWith("sk_test_") === true;
const PAYSTACK_TEST_BANK_CODE = "001";
const PAYSTACK_BANKS_URL = "https://api.paystack.co/bank";
const PAYSTACK_CACHE_TTL_MS = 10 * 60 * 1000;

type PaystackBank = {
  name: string;
  slug: string;
  code: string;
  active: boolean;
  country: string;
  currency: string;
  type: string;
  is_deleted?: boolean;
};

type CachedBanks = {
  banks: Array<{
    name: string;
    slug: string;
    code: string;
    logoUrl: string | null;
  }>;
  fetchedAt: number;
};

let cachedBanks: CachedBanks | null = null;

function logoUrl(name: string) {
  if (!LOGO_DEV_TOKEN) return null;
  return `https://img.logo.dev/name/${encodeURIComponent(name)}?token=${encodeURIComponent(LOGO_DEV_TOKEN)}&size=64&format=png`;
}

async function paystackRequest(path: string) {
  if (!PAYSTACK_SECRET_KEY) {
    throw new Error("Paystack is not configured");
  }
  if (!PAYSTACK_SECRET_KEY.startsWith("sk_")) {
    throw new Error("Paystack secret key must start with sk_");
  }

  const response = await fetch(`https://api.paystack.co${path}`, {
    headers: {
      accept: "application/json",
      Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
    },
  });

  const body = (await response.json().catch(() => null)) as {
    status?: boolean;
    message?: string;
    data?: unknown;
  } | null;

  if (!response.ok || body?.status !== true) {
    throw new Error(body?.message || `Paystack returned ${response.status}`);
  }

  return body;
}

router.get("/paystack/resolve-account", resolveAccountRateLimiter, async (req, res) => {
  const user = await verifySupabaseUser(extractBearerToken(req));
  if (!user) {
    res.status(401).json({ message: "Authentication required to verify bank accounts" });
    return;
  }

  const accountNumber = String(req.query.accountNumber ?? "").replace(/\D/g, "");
  const requestedBankCode = String(req.query.bankCode ?? "").trim();
  // Paystack's test environment only allows the dedicated test bank for
  // account-name lookups. Keep the user's selected bank for the UI and the
  // eventual transfer record, but use 001 for the provider lookup.
  const bankCode = PAYSTACK_TEST_MODE ? PAYSTACK_TEST_BANK_CODE : requestedBankCode;

  if (!/^\d{10}$/.test(accountNumber)) {
    res.status(400).json({ message: "Enter a valid 10-digit account number" });
    return;
  }
  if (!/^[A-Za-z0-9_-]{2,20}$/.test(requestedBankCode)) {
    res.status(400).json({ message: "Select a valid bank before verifying the account" });
    return;
  }

  try {
    const body = await paystackRequest(
      `/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`,
    );
    const data = body.data as { account_name?: unknown; account_number?: unknown } | null;
    const accountName = typeof data?.account_name === "string" ? data.account_name.trim() : "";

    if (!accountName) {
      res.status(502).json({ message: "Paystack did not return an account name for those details" });
      return;
    }

    res.json({
      accountName,
      accountNumber: typeof data?.account_number === "string" ? data.account_number : accountNumber,
    });
  } catch (error) {
    req.log.error({ err: error }, "Paystack account resolve request failed");
    res.status(502).json({
      message: error instanceof Error ? error.message : "Could not verify the bank account",
    });
  }
});

export function cleanBankName(raw: string): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  const lower = trimmed.toLowerCase();

  // Primary consumer brand names for major fintechs and banks
  if (lower.includes("opay") || lower.includes("paycom")) return "OPay";
  if (lower.includes("palmpay")) return "PalmPay";
  if (lower.includes("kuda")) return "Kuda Bank";
  if (lower.includes("moniepoint")) return "Moniepoint";
  if (lower === "united bank for africa" || lower.startsWith("united bank for africa") || lower.includes("uba plc") || lower === "uba") return "UBA";
  if (lower.includes("guaranty trust") || lower.includes("gtbank")) return "GTBank";
  if (lower.includes("first bank of nigeria") || lower === "first bank") return "First Bank";
  if (lower.includes("first city monument bank") || lower === "fcmb") return "FCMB";
  if (lower.includes("stanbic ibtc")) return "Stanbic IBTC";
  if (lower.includes("standard chartered")) return "Standard Chartered";
  if (lower.includes("fairmoney")) return "FairMoney";
  if (lower.includes("vfd microfinance") || lower.includes("vfd bank")) return "VFD Bank";
  if (lower.includes("rubies")) return "Rubies Bank";
  if (lower.includes("sparkle")) return "Sparkle";
  if (lower.includes("carbon")) return "Carbon";
  if (lower.includes("paga")) return "Paga";
  if (lower.includes("providus")) return "Providus Bank";
  if (lower.includes("titan trust")) return "Titan Trust Bank";
  if (lower.includes("citibank")) return "Citibank";
  if (lower.includes("access bank")) return "Access Bank";
  if (lower.includes("zenith bank")) return "Zenith Bank";
  if (lower.includes("sterling bank")) return "Sterling Bank";
  if (lower.includes("union bank")) return "Union Bank";
  if (lower.includes("wema bank")) return "Wema Bank";
  if (lower.includes("fidelity bank")) return "Fidelity Bank";
  if (lower.includes("polaris bank")) return "Polaris Bank";
  if (lower.includes("keystone bank")) return "Keystone Bank";
  if (lower.includes("jaiz bank")) return "Jaiz Bank";
  if (lower.includes("taj bank")) return "TAJ Bank";
  if (lower.includes("lotus bank")) return "Lotus Bank";
  if (lower.includes("heritage bank")) return "Heritage Bank";
  if (lower.includes("unity bank")) return "Unity Bank";

  // General corporate legal title stripping
  let name = trimmed
    .replace(/\s*\([^)]*\)/g, "") // remove (MFB), (NIGERIA), etc.
    .replace(/\b(plc|limited|ltd|mortgage bank|payment service bank|psb)\b/gi, "")
    .replace(/\b(microfinance bank|mfb)\b/gi, "Bank")
    .replace(/\b(of nigeria|nigeria)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  // Convert ALL-CAPS to friendly Title Case
  if (name === name.toUpperCase()) {
    name = name
      .toLowerCase()
      .split(" ")
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }

  // Ensure clean single "Bank" suffix
  name = name.replace(/\bBank Bank\b/gi, "Bank").trim();

  return name || trimmed;
}

async function fetchBanks() {
  if (cachedBanks && Date.now() - cachedBanks.fetchedAt < PAYSTACK_CACHE_TTL_MS) {
    return cachedBanks;
  }

  const body = await paystackRequest("/bank?country=nigeria&currency=NGN&perPage=100");
  const banks = Array.isArray(body.data)
    ? (body.data as PaystackBank[])
        .filter(bank =>
          bank.active &&
          !bank.is_deleted &&
          bank.country.toLowerCase() === "nigeria" &&
          bank.currency.toUpperCase() === "NGN" &&
          bank.type === "nuban",
        )
        .map(bank => {
          const cleanName = cleanBankName(bank.name);
          return {
            name: cleanName,
            legalName: bank.name,
            slug: bank.slug,
            code: bank.code,
            logoUrl: logoUrl(cleanName || bank.name),
          };
        })
        .filter((bank, index, all) => all.findIndex(item => item.code === bank.code) === index)
        .sort((a, b) => a.name.localeCompare(b.name))
    : [];

  if (!banks.length) throw new Error("Paystack returned no active Nigerian banks");
  cachedBanks = { banks, fetchedAt: Date.now() };
  return cachedBanks;
}

router.get("/paystack/banks", async (req, res) => {
  try {
    const result = await fetchBanks();
    res.json({
      banks: result.banks,
      fetchedAt: new Date(result.fetchedAt).toISOString(),
      stale: false,
    });
  } catch (error) {
    req.log.error({ err: error }, "Paystack bank list request failed");
    if (cachedBanks) {
      res.json({
        banks: cachedBanks.banks,
        fetchedAt: new Date(cachedBanks.fetchedAt).toISOString(),
        stale: true,
      });
      return;
    }
    res.status(503).json({
      message: error instanceof Error ? error.message : "Bank list is temporarily unavailable",
    });
  }
});

function verifyPaystackSignature(rawBody: Buffer, signatureHeader: string | undefined): boolean {
  if (!PAYSTACK_SECRET_KEY || !signatureHeader) return false;
  const supplied = signatureHeader.trim().toLowerCase();
  if (!/^[a-f0-9]{128}$/.test(supplied)) return false;
  const expected = createHmac("sha512", PAYSTACK_SECRET_KEY).update(rawBody).digest("hex").toLowerCase();
  const a = Buffer.from(supplied, "utf8");
  const b = Buffer.from(expected, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

router.post("/paystack/webhooks", async (req: Request, res: Response) => {
  if (!PAYSTACK_SECRET_KEY) {
    return res.status(503).json({ message: "Paystack webhook verification key is not configured" });
  }
  if (!isSupabaseAdminConfigured()) {
    return res.status(503).json({ message: "Database admin service is not configured" });
  }

  const rawBuffer = Buffer.isBuffer(req.body)
    ? req.body
    : typeof req.body === "string"
      ? Buffer.from(req.body, "utf8")
      : Buffer.from("");

  if (rawBuffer.length === 0) {
    return res.status(400).json({ message: "Empty webhook payload" });
  }

  const sig = req.header("x-paystack-signature");
  if (!verifyPaystackSignature(rawBuffer, sig)) {
    req.log?.warn?.("Rejected Paystack webhook due to invalid signature");
    return res.status(401).json({ message: "Invalid webhook signature" });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBuffer.toString("utf8")) as Record<string, unknown>;
  } catch {
    return res.status(400).json({ message: "Invalid JSON webhook payload" });
  }

  const eventName = typeof payload.event === "string" ? payload.event : "";
  if (eventName !== "charge.success") {
    return res.status(200).json({ received: true, ignored: true, reason: "non_charge_success_event" });
  }

  const data = (payload.data && typeof payload.data === "object" && !Array.isArray(payload.data)
    ? payload.data
    : null) as Record<string, unknown> | null;
  if (!data) {
    return res.status(400).json({ message: "Missing Paystack charge data" });
  }

  const status = typeof data.status === "string" ? data.status.toLowerCase() : "";
  const currency = typeof data.currency === "string" ? data.currency.toUpperCase() : "NGN";
  const reference = typeof data.reference === "string" ? data.reference.trim() : "";
  const amountKobo = Number(data.amount);

  if (status !== "success" || currency !== "NGN" || !reference || !Number.isFinite(amountKobo) || amountKobo <= 0) {
    return res.status(400).json({ message: "Invalid or non-NGN charge event" });
  }

  const amountNaira = Math.round(amountKobo) / 100;
  const meta = (data.metadata && typeof data.metadata === "object" ? data.metadata : {}) as Record<string, unknown>;
  const customer = (data.customer && typeof data.customer === "object" ? data.customer : {}) as Record<string, unknown>;

  let targetUserId = typeof meta.user_id === "string" && isUuid(meta.user_id.trim()) ? meta.user_id.trim() : "";
  const customerEmail = typeof customer.email === "string" ? customer.email.trim().toLowerCase() : "";

  try {
    if (!targetUserId && customerEmail) {
      const pRes = await supabaseRest(
        `profiles?email=ilike.${encodeURIComponent(customerEmail)}&select=id&limit=1`,
      );
      if (pRes.ok) {
        const rows = (await pRes.json().catch(() => [])) as Array<{ id?: string }>;
        if (rows[0]?.id) targetUserId = rows[0].id;
      }
    }

    if (!targetUserId) {
      req.log?.warn?.({ reference }, "Paystack charge.success user not matched");
      return res.status(200).json({ received: true, ignored: true, reason: "user_not_found" });
    }

    // Prefer atomic idempotent Postgres RPC
    const rpcRes = await supabaseRpc("process_paystack_deposit", {
      p_reference: reference,
      p_user_id: targetUserId,
      p_amount_ngn: amountNaira,
      p_channel: typeof data.channel === "string" ? data.channel : "paystack",
    });

    if (rpcRes.ok) {
      const result = (await rpcRes.json().catch(() => ({}))) as Record<string, unknown>;
      return res.status(200).json({ received: true, ...result });
    }

    const errBody = (await rpcRes.json().catch(() => null)) as { code?: string; message?: string } | null;
    const isMissingFn =
      rpcRes.status === 404 ||
      errBody?.code === "PGRST202" ||
      errBody?.code === "42883" ||
      String(errBody?.message || "").toLowerCase().includes("could not find the function");

    if (!isMissingFn) {
      return res.status(500).json({ message: errBody?.message || "Failed to credit deposit" });
    }

    // Idempotent CAS fallback when process_paystack_deposit RPC isn't migrated yet
    const refTag = `Paystack Ref: ${reference}`;
    const dupCheck = await supabaseRest(
      `transactions?user_id=eq.${encodeURIComponent(targetUserId)}&note=eq.${encodeURIComponent(refTag)}&select=id&limit=1`,
    );
    if (dupCheck.ok) {
      const existing = (await dupCheck.json().catch(() => [])) as Array<unknown>;
      if (existing.length > 0) {
        return res.status(200).json({ received: true, status: "already_processed" });
      }
    }

    const pRes = await supabaseRest(`profiles?id=eq.${encodeURIComponent(targetUserId)}&select=id,balance&limit=1`);
    const pRows = pRes.ok ? ((await pRes.json().catch(() => [])) as Array<{ balance: number }>) : [];
    if (!pRows[0]) return res.status(200).json({ received: true, ignored: true, reason: "user_not_found" });

    const newBalance = Math.round((Number(pRows[0].balance) + amountNaira) * 100) / 100;
    await supabaseRest(`profiles?id=eq.${encodeURIComponent(targetUserId)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ balance: newBalance }),
    });

    await Promise.all([
      supabaseRest("transactions", {
        method: "POST",
        body: JSON.stringify({
          user_id: targetUserId,
          type: "in",
          name: "Wallet Deposit (Paystack)",
          amount: amountNaira,
          note: refTag,
        }),
      }),
      supabaseRest("notifications", {
        method: "POST",
        body: JSON.stringify({
          user_id: targetUserId,
          type: "credit",
          title: "Deposit received",
          body: `₦${amountNaira.toLocaleString("en-NG", { minimumFractionDigits: 2 })} added to your Vexa wallet.`,
          read: false,
        }),
      }),
    ]);

    return res.status(200).json({ received: true, status: "credited" });
  } catch (error) {
    req.log?.error?.({ err: error, reference }, "Paystack webhook processing failed");
    return res.status(500).json({ message: "Failed to process webhook" });
  }
});

export default router;