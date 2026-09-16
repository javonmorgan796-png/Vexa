import { Router, type IRouter } from "express";

const router: IRouter = Router();
const PAYSTACK_SECRET_KEY = process.env["PAYSTACK_SECRET_KEY"]?.trim();
const LOGO_DEV_TOKEN = process.env["LOGO_DEV_TOKEN"]?.trim();
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
  const bankCode = String(req.query.bankCode ?? "").trim();

  if (!/^\d{10}$/.test(accountNumber)) {
    res.status(400).json({ message: "Enter a valid 10-digit account number" });
    return;
  }
  if (!/^[A-Za-z0-9_-]{2,20}$/.test(bankCode)) {
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
        .map(bank => ({
          name: bank.name,
          slug: bank.slug,
          code: bank.code,
          logoUrl: logoUrl(bank.name),
        }))
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