import { Router, type IRouter } from "express";
import { getLiveCryptoPricesNgn, type Asset } from "../lib/cryptoPrices";

const router: IRouter = Router();

router.get("/crypto/prices", async (req, res) => {
  try {
    const result = await getLiveCryptoPricesNgn();
    res.json(result);
  } catch (error) {
    req.log.error({ err: error }, "crypto price request failed");
    res.status(503).json({
      message: "Live crypto prices are temporarily unavailable",
    });
  }
});

type CoinLogoInfo = {
  asset: Asset;
  name: string;
  logoUrl: string | null;
};

type CachedLogos = {
  logos: Record<Asset, CoinLogoInfo>;
  fetchedAt: string;
};

const COINGECKO_MARKETS_URL =
  "https://api.coingecko.com/api/v3/coins/markets" +
  "?vs_currency=ngn" +
  "&ids=bitcoin,ethereum,tether" +
  "&order=market_cap_desc" +
  "&per_page=10&page=1&sparkline=false";

const LOGO_DEV_TOKEN = process.env["LOGO_DEV_TOKEN"]?.trim();
const LOGOS_CACHE_TTL_MS = 5 * 60_000;
let cachedLogos: CachedLogos | null = null;

function fallbackCoinLogos(): Record<Asset, CoinLogoInfo> {
  const domainLogo = (domain: string) =>
    LOGO_DEV_TOKEN
      ? `https://img.logo.dev/${encodeURIComponent(domain)}?token=${encodeURIComponent(LOGO_DEV_TOKEN)}&size=96&format=png`
      : null;

  return {
    BTC: { asset: "BTC", name: "Bitcoin", logoUrl: domainLogo("bitcoin.org") },
    ETH: { asset: "ETH", name: "Ethereum", logoUrl: domainLogo("ethereum.org") },
    USDT: { asset: "USDT", name: "Tether", logoUrl: domainLogo("tether.to") },
  };
}

router.get("/crypto/logos", async (_req, res) => {
  res.setHeader("Content-Type", "application/json");

  if (
    cachedLogos &&
    Date.now() - new Date(cachedLogos.fetchedAt).getTime() < LOGOS_CACHE_TTL_MS
  ) {
    res.json({ ...cachedLogos, stale: false });
    return;
  }

  try {
    const response = await fetch(COINGECKO_MARKETS_URL, {
      headers: { accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(`Coin metadata provider returned ${response.status}`);
    }

    const rows = (await response.json()) as Array<{
      id?: string;
      symbol?: string;
      name?: string;
      image?: string;
    }>;

    const byId = new Map(rows.map((row) => [String(row.id ?? "").toLowerCase(), row]));
    const fallback = fallbackCoinLogos();

    const logos: Record<Asset, CoinLogoInfo> = {
      BTC: {
        asset: "BTC",
        name: byId.get("bitcoin")?.name || "Bitcoin",
        logoUrl: byId.get("bitcoin")?.image || fallback.BTC.logoUrl,
      },
      ETH: {
        asset: "ETH",
        name: byId.get("ethereum")?.name || "Ethereum",
        logoUrl: byId.get("ethereum")?.image || fallback.ETH.logoUrl,
      },
      USDT: {
        asset: "USDT",
        name: byId.get("tether")?.name || "Tether",
        logoUrl: byId.get("tether")?.image || fallback.USDT.logoUrl,
      },
    };

    cachedLogos = {
      logos,
      fetchedAt: new Date().toISOString(),
    };
    res.json({ ...cachedLogos, stale: false });
  } catch {
    if (cachedLogos) {
      res.json({ ...cachedLogos, stale: true });
      return;
    }
    res.json({
      logos: fallbackCoinLogos(),
      fetchedAt: new Date().toISOString(),
      stale: true,
    });
  }
});

export default router;