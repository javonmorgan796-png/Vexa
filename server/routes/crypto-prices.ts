import { Router, type IRouter } from "express";

const router: IRouter = Router();

type Asset = "BTC" | "ETH" | "USDT";
type Price = { ngn: number; change24h: number };

type CachedPrices = {
  prices: Record<Asset, Price>;
  fetchedAt: string;
};

const COINGECKO_URL =
  "https://api.coingecko.com/api/v3/simple/price" +
  "?ids=bitcoin,ethereum,tether" +
  "&vs_currencies=ngn" +
  "&include_24hr_change=true";

let cachedPrices: CachedPrices | null = null;
const CACHE_TTL_MS = 20_000;

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

router.get("/crypto/prices", async (req, res) => {
  if (
    cachedPrices &&
    Date.now() - new Date(cachedPrices.fetchedAt).getTime() < CACHE_TTL_MS
  ) {
    res.json({ ...cachedPrices, stale: false });
    return;
  }

  try {
    const response = await fetch(COINGECKO_URL, {
      headers: { accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(`Market data provider returned ${response.status}`);
    }

    const body = (await response.json()) as Record<
      string,
      { ngn?: unknown; ngn_24h_change?: unknown }
    >;

    const prices: Record<Asset, Price> = {
      BTC: {
        ngn: Number(body.bitcoin?.ngn),
        change24h: Number(body.bitcoin?.ngn_24h_change ?? 0),
      },
      ETH: {
        ngn: Number(body.ethereum?.ngn),
        change24h: Number(body.ethereum?.ngn_24h_change ?? 0),
      },
      USDT: {
        ngn: Number(body.tether?.ngn),
        change24h: Number(body.tether?.ngn_24h_change ?? 0),
      },
    };

    if (
      !isNumber(prices.BTC.ngn) ||
      !isNumber(prices.ETH.ngn) ||
      !isNumber(prices.USDT.ngn)
    ) {
      throw new Error("Market data provider returned incomplete prices");
    }

    cachedPrices = {
      prices,
      fetchedAt: new Date().toISOString(),
    };
    res.json({ ...cachedPrices, stale: false });
  } catch (error) {
    req.log.error({ err: error }, "crypto price request failed");

    if (cachedPrices) {
      res.json({ ...cachedPrices, stale: true });
      return;
    }

    res.status(503).json({
      message: "Live crypto prices are temporarily unavailable",
    });
  }
});

export default router;