import { createHmac, timingSafeEqual } from "node:crypto";
import { Router, type IRouter, type Request } from "express";

const router: IRouter = Router();
type Asset = "BTC" | "ETH" | "USDT";
type Network = "Bitcoin Testnet" | "Ethereum Sepolia Testnet" | "Tron Shasta Testnet (TRC-20)";
const SUPABASE_URL = process.env["SUPABASE_URL"]?.replace(/\/$/, "");
const SUPABASE_SERVICE_ROLE_KEY = process.env["SUPABASE_SERVICE_ROLE_KEY"];
const TATUM_API_KEY = process.env["TATUM_API_KEY"];
const TATUM_WEBHOOK_SECRET = process.env["TATUM_WEBHOOK_SECRET"];
const TATUM_WEBHOOK_URL = process.env["TATUM_WEBHOOK_URL"];

function assetConfig(asset: Asset): { wallet: string; address: string; network: Network; tatumChain: string; confirmations: number; finality?: "final" } {
  if (asset === "BTC") return { wallet: "bitcoin", address: "bitcoin", network: "Bitcoin Testnet", tatumChain: "bitcoin-testnet", confirmations: 3 };
  if (asset === "ETH") return { wallet: "ethereum", address: "ethereum", network: "Ethereum Sepolia Testnet", tatumChain: "ethereum-sepolia", confirmations: 12, finality: "final" };
  return { wallet: "tron", address: "tron", network: "Tron Shasta Testnet (TRC-20)", tatumChain: "tron-testnet", confirmations: 20, finality: "final" };
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

type DepositAddressRow = {
  id: string;
  user_id: string;
  asset: Asset;
  address: string;
  network: Network;
  created_at: string;
  tatum_subscription_id?: string | null;
  tatum_subscription_status?: string | null;
};

async function findAddress(address: string) {
  const response = await supabaseRequest(
    `crypto_deposit_addresses?address=eq.${encodeURIComponent(address)}&select=id,user_id,asset,address,network,created_at,tatum_subscription_id,tatum_subscription_status&limit=1`,
  );
  if (!response.ok) throw new Error("Could not read deposit address storage");
  const rows = (await response.json()) as DepositAddressRow[];
  return rows[0] ?? null;
}

async function createTatumSubscription(row: DepositAddressRow) {
  if (!TATUM_API_KEY) throw new Error("Tatum wallet provider is not configured");
  if (!TATUM_WEBHOOK_URL) throw new Error("Tatum webhook URL is not configured");
  const config = assetConfig(row.asset);
  if (row.tatum_subscription_id) {
    const existing = await fetch(`https://api.tatum.io/v4/subscription/${encodeURIComponent(row.tatum_subscription_id)}`, {
      headers: { accept: "application/json", "x-api-key": TATUM_API_KEY },
    });
    if (existing.ok) {
      const details = (await existing.json().catch(() => null)) as {
        attr?: { chain?: string };
        chain?: string;
      } | null;
      const existingChain = details?.attr?.chain ?? details?.chain;
      if (!existingChain || existingChain === config.tatumChain) return row.tatum_subscription_id;

      // A previous deployment could have registered BTC on testnet. Remove
      // that subscription before creating the mainnet replacement so the same
      // persisted address never has two competing webhook subscriptions.
      const removed = await fetch(`https://api.tatum.io/v4/subscription/${encodeURIComponent(row.tatum_subscription_id)}`, {
        method: "DELETE",
        headers: { accept: "application/json", "x-api-key": TATUM_API_KEY },
      });
      if (!removed.ok && removed.status !== 404) {
        throw new Error(`Could not replace the old Tatum ${existingChain} subscription (${removed.status})`);
      }
      const cleared = await supabaseRequest(`crypto_deposit_addresses?id=eq.${encodeURIComponent(row.id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ tatum_subscription_id: null, tatum_subscription_status: "pending" }),
      });
      if (!cleared.ok) throw new Error("Could not clear the old Tatum subscription");
    } else {
      const details = (await existing.json().catch(() => null)) as { errorCode?: string } | null;
      if (existing.status !== 404 && details?.errorCode !== "subscription.not.exists") {
        throw new Error(`Could not verify Tatum subscription (${existing.status})`);
      }

      const cleared = await supabaseRequest(`crypto_deposit_addresses?id=eq.${encodeURIComponent(row.id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ tatum_subscription_id: null, tatum_subscription_status: "pending" }),
      });
      if (!cleared.ok) throw new Error("Could not clear the stale Tatum subscription");
    }
  }

  // Claim the row before calling Tatum. This prevents two simultaneous
  // address requests from creating two subscriptions for the same address.
  const claim = await supabaseRequest(
    `crypto_deposit_addresses?id=eq.${encodeURIComponent(row.id)}&tatum_subscription_id=is.null&or=(tatum_subscription_status.is.null,tatum_subscription_status.eq.pending)`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ tatum_subscription_status: "creating" }),
    },
  );
  if (!claim.ok) throw new Error("Could not reserve the Tatum subscription");
  const claimedRows = (await claim.json()) as DepositAddressRow[];
  if (!claimedRows[0]) {
    const current = await findAddress(row.address);
    if (current?.tatum_subscription_id) return current.tatum_subscription_id;
    throw new Error("Tatum subscription is already being created");
  }

  try {
    const response = await fetch("https://api.tatum.io/v4/subscription", {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json", "x-api-key": TATUM_API_KEY },
      body: JSON.stringify({
        type: "ADDRESS_EVENT",
        attr: {
          chain: config.tatumChain,
          address: row.address,
          url: TATUM_WEBHOOK_URL,
          ...(config.finality ? { finality: config.finality } : {}),
        },
      }),
    });
    if (!response.ok) {
      const providerError = (await response.json().catch(() => null)) as {
        errorCode?: unknown;
        message?: unknown;
      } | null;
      const errorCode = typeof providerError?.errorCode === "string" ? providerError.errorCode : "";
      const message = typeof providerError?.message === "string" ? providerError.message : "";
      const detail = [errorCode, message].filter(Boolean).join(": ");
      throw new Error(`Tatum subscription creation failed (${response.status})${detail ? `: ${detail}` : ""}`);
    }
    const body = (await response.json()) as { id?: string };
    if (!body.id) throw new Error("Tatum did not return a subscription ID");

    const saved = await supabaseRequest(`crypto_deposit_addresses?id=eq.${encodeURIComponent(row.id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ tatum_subscription_id: body.id, tatum_subscription_status: "active" }),
    });
    if (!saved.ok) throw new Error("Tatum subscription was created but could not be saved");
    return body.id;
  } catch (error) {
    await supabaseRequest(`crypto_deposit_addresses?id=eq.${encodeURIComponent(row.id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ tatum_subscription_status: "pending" }),
    });
    throw error;
  }
}

async function supabaseRpc(name: string, body: Record<string, unknown>) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Deposit storage is not configured");
  return fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function verifyTatumSignature(eventBody: Record<string, unknown>, suppliedHash: string | undefined) {
  if (!TATUM_WEBHOOK_SECRET || !suppliedHash) return false;
  const expected = createHmac("sha512", TATUM_WEBHOOK_SECRET)
    .update(JSON.stringify(eventBody))
    .digest("base64");
  const expectedBuffer = Buffer.from(expected, "utf8");
  const suppliedBuffer = Buffer.from(suppliedHash, "utf8");
  return expectedBuffer.length === suppliedBuffer.length && timingSafeEqual(expectedBuffer, suppliedBuffer);
}

function nestedWebhookEvent(payload: Record<string, unknown>) {
  const nested = payload.event;
  if (
    !nested ||
    typeof nested !== "object" ||
    !("body" in nested) ||
    !nested.body ||
    typeof nested.body !== "object" ||
    Array.isArray(nested.body)
  ) {
    return null;
  }
  return nested.body as Record<string, unknown>;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function chainMatchesAsset(asset: Asset, chain: string | null) {
  if (!chain) return true;
  const normalized = chain.toLowerCase().replace(/[-_]/g, "");
  if (asset === "BTC") return normalized.includes("btc") || normalized.includes("bitcoin");
  if (asset === "ETH") return normalized.includes("eth") || normalized.includes("ethereum");
  return normalized.includes("tron") || normalized === "trx";
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
      `crypto_deposit_addresses?user_id=eq.${encodeURIComponent(userId)}&asset=eq.${asset}&select=id,user_id,asset,address,network,created_at,tatum_subscription_id,tatum_subscription_status&limit=1`,
    );
    if (!existing.ok) throw new Error("Could not read wallet storage");
    const rows = (await existing.json()) as DepositAddressRow[];
    if (rows[0]) {
      await createTatumSubscription(rows[0]);
      res.json({ asset: rows[0].asset, address: rows[0].address, network: assetConfig(rows[0].asset).network, createdAt: rows[0].created_at });
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
    const saved = (await insert.json()) as DepositAddressRow[];
    if (!saved[0]) throw new Error("Could not read the saved deposit address");
    await createTatumSubscription(saved[0]);
    res.status(201).json({ asset, address: addressBody.address, network: config.network, createdAt: saved[0]?.created_at ?? new Date().toISOString() });
  } catch (error) {
    req.log.error({ err: error, asset }, "crypto deposit address request failed");
    res.status(503).json({ message: error instanceof Error ? error.message : "Deposit wallet is temporarily unavailable" });
  }
});

router.post("/crypto/webhooks/tatum", async (req, res) => {
  const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from("");
  try {
    const payload = JSON.parse(rawBody.toString("utf8")) as Record<string, unknown>;
    const event = nestedWebhookEvent(payload) ?? payload;
    // Tatum signs JSON.stringify(event.body), not the outer notification
    // envelope. Keep this aligned with Tatum's current webhook HMAC contract.
    if (!verifyTatumSignature(event, req.header("x-payload-hash"))) {
      res.status(401).json({ message: "Invalid webhook signature" });
      return;
    }
    const address = stringValue(event.address) ?? stringValue(event.to) ?? stringValue(event.destinationAddress);
    const txHash = stringValue(event.txId) ?? stringValue(event.txHash) ?? stringValue(event.hash);
    const amount = stringValue(event.amount) ?? (numberValue(event.amount)?.toString() ?? null);
    if (!address || !txHash || !amount || Number(amount) <= 0) {
      res.status(400).json({ message: "Webhook is missing transaction details" });
      return;
    }

    const depositAddress = await findAddress(address);
    if (!depositAddress) {
      req.log.warn({ address }, "Tatum webhook address is not a Vexa deposit address");
      res.status(200).json({ received: true, ignored: true });
      return;
    }
    const config = assetConfig(depositAddress.asset);
    const chain = stringValue(event.chain);
    if (!chainMatchesAsset(depositAddress.asset, chain)) {
      req.log.warn({ address, chain, asset: depositAddress.asset }, "Tatum webhook chain does not match deposit address");
      res.status(400).json({ message: "Webhook chain does not match deposit address" });
      return;
    }
    const finality = stringValue(event.finality) ?? stringValue(event.status);
    const confirmations =
      numberValue(event.confirmations) ??
      numberValue(event.confirmationCount) ??
      (finality === "final" || event.confirmed === true ? config.confirmations : 0);
    const result = await supabaseRpc("process_tatum_crypto_deposit", {
      p_deposit_reference: `${depositAddress.network}:${txHash}:${depositAddress.address}:${depositAddress.asset}`,
      p_user_id: depositAddress.user_id,
      p_asset: depositAddress.asset,
      p_network: depositAddress.network,
      p_address: depositAddress.address,
      p_transaction_hash: txHash,
      p_amount: amount,
      p_confirmations: Math.max(0, Math.floor(confirmations)),
      p_required_confirmations: config.confirmations,
    });
    if (!result.ok) throw new Error(`Deposit processing failed (${result.status})`);
    const body = (await result.json()) as { status?: string };
    res.status(200).json({ received: true, status: body.status ?? "processed" });
  } catch (error) {
    req.log.error({ err: error }, "Tatum webhook processing failed");
    res.status(503).json({ message: "Deposit processing is temporarily unavailable" });
  }
});

export default router;