import { Router, type IRouter, type Request } from "express";

const router: IRouter = Router();
type Asset = "BTC" | "ETH" | "USDT";
const SUPABASE_URL = process.env["SUPABASE_URL"]?.replace(/\/$/, "");
const SUPABASE_SERVICE_ROLE_KEY = process.env["SUPABASE_SERVICE_ROLE_KEY"];
const TATUM_API_KEY = process.env["TATUM_API_KEY"];

function assetConfig(asset: Asset) {
  if (asset === "BTC") return { wallet: "bitcoin", address: "bitcoin", network: "Bitcoin" };
  if (asset === "ETH") return { wallet: "ethereum", address: "ethereum", network: "Ethereum" };
  return { wallet: "tron", address: "tron", network: "Tron (TRC-20)" };
}

function bearer(req: Request) {
  const value = req.header("authorization") ?? "";
  return value.startsWith("Bearer ") ? value.slice(7) : "";
}

async function supabaseRequest(path: string, init: RequestInit = {}) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Wallet storage is not configured");
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

async function getUserId(token: string) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !token) return null;
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${token}` },
  });
  if (!response.ok) return null;
  const body = (await response.json()) as { id?: string };
  return body.id ?? null;
}

router.get("/crypto/deposit-address", async (req, res) => {
  const asset = String(req.query.asset ?? "").toUpperCase() as Asset;
  if (!["BTC", "ETH", "USDT"].includes(asset)) {
    res.status(400).json({ message: "Unsupported crypto asset" });
    return;
  }

  try {
    const userId = await getUserId(bearer(req));
    if (!userId) {
      res.status(401).json({ message: "You must be signed in" });
      return;
    }
    const existing = await supabaseRequest(
      `crypto_deposit_addresses?user_id=eq.${encodeURIComponent(userId)}&asset=eq.${asset}&select=asset,address,network,created_at&limit=1`,
    );
    if (!existing.ok) throw new Error("Could not read wallet storage");
    const rows = (await existing.json()) as Array<{ asset: Asset; address: string; network: string; created_at: string }>;
    if (rows[0]) {
      res.json({ asset: rows[0].asset, address: rows[0].address, network: rows[0].network, createdAt: rows[0].created_at });
      return;
    }
    if (!TATUM_API_KEY) throw new Error("Tatum wallet provider is not configured");

    const config = assetConfig(asset);
    const walletResponse = await fetch(`https://api.tatum.io/v3/${config.wallet}/wallet`, {
      headers: { accept: "application/json", "x-api-key": TATUM_API_KEY },
    });
    if (!walletResponse.ok) throw new Error(`Tatum wallet creation failed (${walletResponse.status})`);
    const wallet = (await walletResponse.json()) as { xpub?: string };
    if (!wallet.xpub) throw new Error("Tatum did not return a wallet key");

    const addressResponse = await fetch(`https://api.tatum.io/v3/${config.address}/address/${encodeURIComponent(wallet.xpub)}/0`, {
      headers: { accept: "application/json", "x-api-key": TATUM_API_KEY },
    });
    if (!addressResponse.ok) throw new Error(`Tatum address creation failed (${addressResponse.status})`);
    const addressBody = (await addressResponse.json()) as { address?: string };
    if (!addressBody.address) throw new Error("Tatum did not return a deposit address");

    const insert = await supabaseRequest("crypto_deposit_addresses", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        user_id: userId,
        asset,
        address: addressBody.address,
        network: config.network,
      }),
    });
    if (!insert.ok) throw new Error("Could not save the deposit address");
    const saved = (await insert.json()) as Array<{ created_at: string }>;
    res.status(201).json({ asset, address: addressBody.address, network: config.network, createdAt: saved[0]?.created_at ?? new Date().toISOString() });
  } catch (error) {
    req.log.error({ err: error, asset }, "crypto deposit address request failed");
    res.status(503).json({ message: error instanceof Error ? error.message : "Deposit wallet is temporarily unavailable" });
  }
});

export default router;