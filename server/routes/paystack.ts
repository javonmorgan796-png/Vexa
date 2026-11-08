import { Router, type IRouter } from "express";

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

router.get("/paystack/resolve-account", async (req, res) => {
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

export default router;