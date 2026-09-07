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