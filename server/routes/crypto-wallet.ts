import { createHmac, createHash, timingSafeEqual } from "node:crypto";
import { Router, type IRouter, type Request } from "express";
import {
  normalizeWebhookUrl,
  resolveEffectiveTatumWebhook,
  resolveRequestBaseUrl,
} from "../lib/systemSettings";

const router: IRouter = Router();
type Asset = "BTC" | "ETH" | "USDT";
type Network = "Bitcoin" | "Ethereum" | "Tron (TRC-20)";
const SUPABASE_URL = (process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"] || "").replace(/\/$/, "");
const SUPABASE_SERVICE_ROLE_KEY = process.env["SUPABASE_SERVICE_ROLE_KEY"] || process.env["SUPABASE_ANON_KEY"] || process.env["VITE_SUPABASE_ANON_KEY"] || "";
const TATUM_API_KEY = process.env["TATUM_API_KEY"];
const TATUM_WEBHOOK_SECRET = process.env["TATUM_WEBHOOK_SECRET"];

async function safeJson<T = any>(res: globalThis.Response): Promise<T | null> {
  try {
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("application/json")) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function parseJwtPayload(token: string): { sub?: string; id?: string } | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const decoded = Buffer.from(parts[1], "base64").toString("utf8");
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

function generateDeterministicVaultAddress(userId: string, asset: Asset): string {
  const hash = createHash("sha256").update(`${userId}:vexa_crypto_vault_${asset}:v1`).digest("hex");
  if (asset === "BTC") {
    return `bc1q${hash.slice(0, 38).toLowerCase()}`;
  }
  if (asset === "ETH") {
    return `0x${hash.slice(0, 40)}`;
  }
  const base58Chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let tronAddr = "T";
  for (let i = 0; i < 33; i++) {
    const byte = parseInt(hash.slice((i * 2) % 62, (i * 2) % 62 + 2), 16);
    tronAddr += base58Chars[byte % base58Chars.length];
  }
  return tronAddr;
}

const IS_TATUM_TESTNET =
  process.env["TATUM_NETWORK"]?.toLowerCase() === "testnet" ||
  Boolean(TATUM_API_KEY?.startsWith("t-"));

function assetConfig(asset: Asset, isTestnet = IS_TATUM_TESTNET): {
  wallet: string;
  address: string;
  network: Network;
  tatumChain: string;
  confirmations: number;
} {
  if (asset === "BTC") {
    return {
      wallet: "bitcoin",
      address: "bitcoin",
      network: "Bitcoin",
      tatumChain: isTestnet ? "bitcoin-testnet" : "bitcoin-mainnet",
      confirmations: 3,
    };
  }
  if (asset === "ETH") {
    return {
      wallet: "ethereum",
      address: "ethereum",
      network: "Ethereum",
      tatumChain: isTestnet ? "ethereum-sepolia" : "ethereum-mainnet",
      confirmations: 12,
    };
  }
  return {
    wallet: "tron",
    address: "tron",
    network: "Tron (TRC-20)",
    tatumChain: isTestnet ? "tron-testnet" : "tron-mainnet",
    confirmations: 20,
  };
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

async function getUserId(token: string): Promise<string | null> {
  if (!token) return null;
  if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const body = await safeJson<{ id?: string }>(response);
        if (body?.id) return body.id;
      }
    } catch {
      // Fall through to JWT payload parse
    }
  }
  const payload = parseJwtPayload(token);
  return payload?.sub || payload?.id || null;
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
  const selectFields = "id,user_id,asset,address,network,created_at,tatum_subscription_id,tatum_subscription_status";
  const response = await supabaseRequest(
    `crypto_deposit_addresses?address=eq.${encodeURIComponent(address)}&select=${selectFields}&limit=1`,
  );
  if (!response.ok) throw new Error("Could not read deposit address storage");
  const rows = (await response.json()) as DepositAddressRow[];
  if (rows[0]) return rows[0];

  if (/^(0x|bc1|tb1)/i.test(address)) {
    const ciResponse = await supabaseRequest(
      `crypto_deposit_addresses?address=ilike.${encodeURIComponent(address)}&select=${selectFields}&limit=1`,
    );
    if (ciResponse.ok) {
      const ciRows = (await ciResponse.json()) as DepositAddressRow[];
      if (ciRows[0]) return ciRows[0];
    }
  }
  return null;
}

export interface TatumSubscriptionRecord {
  id: string;
  type?: string;
  attr?: {
    chain?: string;
    address?: string;
    url?: string;
  };
}

export async function listTatumSubscriptions(): Promise<TatumSubscriptionRecord[]> {
  if (!TATUM_API_KEY) return [];
  try {
    const resp = await fetch("https://api.tatum.io/v4/subscription?pageSize=50", {
      headers: { accept: "application/json", "x-api-key": TATUM_API_KEY },
    });
    if (!resp.ok) return [];
    const data = await resp.json().catch(() => null);
    return Array.isArray(data) ? (data as TatumSubscriptionRecord[]) : [];
  } catch {
    return [];
  }
}

export async function deleteTatumSubscription(subscriptionId: string): Promise<boolean> {
  if (!TATUM_API_KEY || !subscriptionId) return false;
  try {
    const resp = await fetch(`https://api.tatum.io/v4/subscription/${encodeURIComponent(subscriptionId)}`, {
      method: "DELETE",
      headers: { accept: "application/json", "x-api-key": TATUM_API_KEY },
    });
    return resp.ok || resp.status === 404;
  } catch {
    return false;
  }
}

export async function createTatumSubscription(row: DepositAddressRow, reqOrWebhookUrl?: Request | string) {
  if (!TATUM_API_KEY) throw new Error("Tatum wallet provider is not configured");
  let targetWebhookUrl = "";
  if (typeof reqOrWebhookUrl === "string" && reqOrWebhookUrl.trim()) {
    targetWebhookUrl = normalizeWebhookUrl(reqOrWebhookUrl);
  } else {
    const resolved = await resolveEffectiveTatumWebhook(typeof reqOrWebhookUrl === "string" ? undefined : reqOrWebhookUrl);
    targetWebhookUrl = resolved.url;
  }
  if (!targetWebhookUrl) throw new Error("Tatum webhook URL is not configured");
  const addressLooksTestnet = row.asset === "BTC" && /^(tb1|[mn2])/i.test(row.address);
  const config = assetConfig(row.asset, IS_TATUM_TESTNET || addressLooksTestnet);
  if (row.tatum_subscription_id) {
    const existing = await fetch(`https://api.tatum.io/v4/subscription/${encodeURIComponent(row.tatum_subscription_id)}`, {
      headers: { accept: "application/json", "x-api-key": TATUM_API_KEY },
    });
    if (existing.ok) {
      const details = (await existing.json().catch(() => null)) as Record<string, unknown> | null;
      const attr =
        details?.attr && typeof details.attr === "object" && !Array.isArray(details.attr)
          ? (details.attr as Record<string, unknown>)
          : details;
      const existingChain = stringValue(attr?.chain);
      const existingUrl = stringValue(attr?.url);
      const isCurrent =
        (!existingChain || existingChain === config.tatumChain) &&
        (!existingUrl || normalizeWebhookUrl(existingUrl) === targetWebhookUrl);

      if (isCurrent) return row.tatum_subscription_id;

      const deleted = await deleteTatumSubscription(row.tatum_subscription_id);
      if (!deleted) {
        throw new Error("Could not replace the stale Tatum subscription");
      }

      const cleared = await supabaseRequest(`crypto_deposit_addresses?id=eq.${encodeURIComponent(row.id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ tatum_subscription_id: null, tatum_subscription_status: "pending" }),
      });
      if (!cleared.ok) throw new Error("Could not clear the stale Tatum subscription");
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
  } else {
    // Check if Tatum already has an active subscription for this address/chain so we don't consume extra quota slots
    const existingList = await listTatumSubscriptions();
    const matching = existingList.filter(
      (sub) =>
        sub.type === "ADDRESS_EVENT" &&
        sub.attr?.address?.toLowerCase() === row.address.toLowerCase() &&
        (!sub.attr?.chain || sub.attr.chain === config.tatumChain),
    );
    const exactMatch = matching.find((sub) => sub.attr?.url && normalizeWebhookUrl(sub.attr.url) === targetWebhookUrl);
    if (exactMatch?.id) {
      await supabaseRequest(`crypto_deposit_addresses?id=eq.${encodeURIComponent(row.id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ tatum_subscription_id: exactMatch.id, tatum_subscription_status: "active" }),
      });
      return exactMatch.id;
    }
    for (const stale of matching) {
      if (stale.id) await deleteTatumSubscription(stale.id);
    }
  }

  // Claim the row before calling Tatum. This prevents two simultaneous
  // address requests from creating two subscriptions for the same address.
  const claimFilter =
    typeof reqOrWebhookUrl === "string"
      ? `crypto_deposit_addresses?id=eq.${encodeURIComponent(row.id)}&tatum_subscription_id=is.null`
      : `crypto_deposit_addresses?id=eq.${encodeURIComponent(row.id)}&tatum_subscription_id=is.null&or=(tatum_subscription_status.is.null,tatum_subscription_status.eq.pending)`;
  const claim = await supabaseRequest(claimFilter, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ tatum_subscription_status: "creating" }),
  });
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
          url: targetWebhookUrl,
        },
      }),
    });
    const responseText = await response.text();
    let responseBody: Record<string, unknown> = {};
    try {
      responseBody = responseText ? (JSON.parse(responseText) as Record<string, unknown>) : {};
    } catch {
      responseBody = {};
    }
    if (!response.ok) {
      const providerCode = typeof responseBody.errorCode === "string" ? responseBody.errorCode : "";
      if (providerCode === "subscription.plan.exceeded") {
        throw new Error(
          "Tatum Free plan supports up to 5 active webhook subscriptions total. Upgrade your Tatum plan or remove unused subscriptions to add more deposit addresses.",
        );
      }
      const providerMessage = typeof responseBody.message === "string" ? responseBody.message : responseText.trim();
      const providerData =
        responseBody.data === undefined
          ? ""
          : typeof responseBody.data === "string"
            ? responseBody.data
            : JSON.stringify(responseBody.data);
      const detail = [providerCode, providerMessage, providerData].filter(Boolean).join(": ");
      throw new Error(
        `Tatum subscription creation failed (${response.status})${detail ? `: ${detail.slice(0, 300)}` : ""}`,
      );
    }
    const body = responseBody as { id?: string };
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

function verifyTatumSignature(
  rawBody: Buffer,
  eventBody: Record<string, unknown>,
  suppliedHash: string | undefined,
) {
  if (!TATUM_WEBHOOK_SECRET || !suppliedHash) return false;
  const suppliedBuffer = Buffer.from(suppliedHash, "utf8");
  const candidates = [rawBody.toString("utf8"), JSON.stringify(eventBody)];
  return candidates.some((candidate) => {
    const expected = createHmac("sha512", TATUM_WEBHOOK_SECRET)
      .update(candidate)
      .digest("base64");
    const expectedBuffer = Buffer.from(expected, "utf8");
    return expectedBuffer.length === suppliedBuffer.length && timingSafeEqual(expectedBuffer, suppliedBuffer);
  });
}

function nestedWebhookEvent(payload: Record<string, unknown>) {
  const nested = payload.event;
  if (nested && typeof nested === "object" && "body" in nested) {
    const body = nested.body;
    if (body && typeof body === "object" && !Array.isArray(body)) {
      return body as Record<string, unknown>;
    }
  }

  const data = payload.data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    return data as Record<string, unknown>;
  }

  if (stringValue(payload.address) || stringValue(payload.to)) {
    return payload;
  }

  return null;
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

const KNOWN_TRON_USDT_CONTRACTS = new Set(
  [
    "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t", // Tron Mainnet USDT (TRC-20)
    "TG3XXyExBkPp9nED72x684uK8a8eX9t9mD", // Tron Shasta Testnet USDT
    "TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf", // Tron Nile Testnet USDT
    process.env["TATUM_TRON_USDT_CONTRACT"] || "",
  ]
    .map((v) => v.trim().toUpperCase())
    .filter(Boolean),
);

function eventMatchesDepositAsset(depositAsset: Asset, event: Record<string, unknown>): boolean {
  const eventType = (stringValue(event.type) ?? "").toLowerCase();
  const eventAsset = (stringValue(event.asset) ?? stringValue(event.tokenSymbol) ?? "").trim();
  const contractAddress = (stringValue(event.contractAddress) ?? "").trim();

  if (depositAsset === "BTC") {
    if (eventType && !["native", "utxo", "incoming", "coin"].includes(eventType)) return false;
    if (eventAsset && !["btc", "bitcoin", "tbtc"].includes(eventAsset.toLowerCase())) return false;
    return true;
  }

  if (depositAsset === "ETH") {
    if (["token", "erc20", "trc20", "bep20", "nft", "erc721", "erc1155"].includes(eventType)) return false;
    if (contractAddress) return false;
    if (eventAsset && !["eth", "ethereum", "seth"].includes(eventAsset.toLowerCase())) return false;
    return true;
  }

  // USDT on Tron (TRC-20)
  if (eventType === "native" || eventAsset.toUpperCase() === "TRX") return false;
  const candidateContract = contractAddress || eventAsset;
  if (!candidateContract) return true;
  const upper = candidateContract.toUpperCase();
  if (upper === "USDT" || upper === "USDT_TRON") return true;
  return KNOWN_TRON_USDT_CONTRACTS.has(upper);
}

router.get("/crypto/deposit-address", async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  const asset = String(req.query.asset ?? "").toUpperCase() as Asset;
  if (!["BTC", "ETH", "USDT"].includes(asset)) {
    return res.status(400).json({ message: "Unsupported crypto asset" });
  }

  try {
    let userId = await getUserId(bearer(req));
    if (!userId && typeof req.query.userId === "string" && req.query.userId.trim()) {
      userId = req.query.userId.trim();
    }
    const effectiveUserId = userId || "vexa_custody_customer";

    const requestBaseUrl = resolveRequestBaseUrl(req);
    const webhookConfig = await resolveEffectiveTatumWebhook(req);
    const webhookUrl = webhookConfig.url;
    const missingConfig: string[] = [];
    if (!TATUM_API_KEY) missingConfig.push("TATUM_API_KEY");
    if (!TATUM_WEBHOOK_SECRET) missingConfig.push("TATUM_WEBHOOK_SECRET");
    if (!SUPABASE_URL) missingConfig.push("SUPABASE_URL");
    if (!process.env["SUPABASE_SERVICE_ROLE_KEY"]) missingConfig.push("SUPABASE_SERVICE_ROLE_KEY");

    const config = assetConfig(asset);

    // 1. Check existing address in Supabase
    if (userId && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const existing = await supabaseRequest(
          `crypto_deposit_addresses?user_id=eq.${encodeURIComponent(userId)}&asset=eq.${asset}&select=id,user_id,asset,address,network,created_at,tatum_subscription_id,tatum_subscription_status&limit=1`,
        );
        if (existing.ok) {
          const rows = await safeJson<DepositAddressRow[]>(existing);
          if (rows && rows[0]?.address) {
            let subscriptionStatus = rows[0].tatum_subscription_status || "pending";
            let activeSubId = rows[0].tatum_subscription_id || null;
            let subscriptionError: string | undefined;
            if (TATUM_API_KEY) {
              try {
                activeSubId = await createTatumSubscription(rows[0], webhookUrl || req);
                subscriptionStatus = "active";
              } catch (subErr) {
                subscriptionError = subErr instanceof Error ? subErr.message : "Tatum subscription failed";
                req.log?.warn?.({ err: subErr }, "Tatum subscription sync note");
              }
            }
            const isTestnetAddr = IS_TATUM_TESTNET || (rows[0].asset === "BTC" && /^(tb1|[mn2])/i.test(rows[0].address));
            return res.json({
              asset: rows[0].asset,
              address: rows[0].address,
              network: rows[0].network,
              createdAt: rows[0].created_at,
              provider: TATUM_API_KEY && activeSubId ? "tatum" : "unconfigured",
              networkMode: isTestnetAddr ? "testnet" : "mainnet",
              liveDepositEnabled: missingConfig.length === 0 && Boolean(webhookUrl) && Boolean(activeSubId),
              subscriptionStatus,
              subscriptionError,
              webhookUrl: webhookUrl || undefined,
              webhookSource: webhookConfig.source,
              missingConfig,
            });
          }
        }
      } catch (err) {
        req.log?.warn?.({ err }, "Supabase existing address check note");
      }
    }

    // 2. Generate new real address via Tatum if configured
    let generatedAddress = "";
    let generatedFromTatum = false;
    if (TATUM_API_KEY) {
      try {
        const walletResponse = await fetch(`https://api.tatum.io/v3/${config.wallet}/wallet`, {
          headers: { accept: "application/json", "x-api-key": TATUM_API_KEY },
        });
        const wallet = await safeJson<{ xpub?: string }>(walletResponse);
        if (wallet?.xpub) {
          const addressResponse = await fetch(`https://api.tatum.io/v3/${config.address}/address/${encodeURIComponent(wallet.xpub)}/0`, {
            headers: { accept: "application/json", "x-api-key": TATUM_API_KEY },
          });
          const addressBody = await safeJson<{ address?: string }>(addressResponse);
          if (addressBody?.address) {
            generatedAddress = addressBody.address;
            generatedFromTatum = true;
          }
        }
      } catch (tatumErr) {
        req.log?.warn?.({ err: tatumErr }, "Tatum address generation skipped");
      }
    }

    // 3. Fallback preview address when Tatum is not configured (do not persist as active Tatum vault)
    if (!generatedAddress) {
      generatedAddress = generateDeterministicVaultAddress(effectiveUserId, asset);
    }

    // 4. Only persist real Tatum-backed addresses to database
    let savedRow: DepositAddressRow | null = null;
    let subscriptionStatus = "pending";
    if (generatedFromTatum && userId && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const insert = await supabaseRequest("crypto_deposit_addresses", {
          method: "POST",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({
            user_id: userId,
            asset,
            address: generatedAddress,
            network: config.network,
          }),
        });
        if (insert.ok) {
          const saved = await safeJson<DepositAddressRow[]>(insert);
          if (saved && saved[0]) savedRow = saved[0];
        }
      } catch (insertErr) {
        req.log?.warn?.({ err: insertErr }, "Could not persist deposit address to Supabase");
      }
    }

    let subscriptionError: string | undefined;
    if (savedRow && TATUM_API_KEY) {
      try {
        await createTatumSubscription(savedRow, webhookUrl || req);
        subscriptionStatus = "active";
      } catch (subErr) {
        subscriptionError = subErr instanceof Error ? subErr.message : "Tatum subscription failed";
        req.log?.warn?.({ err: subErr }, "Tatum subscription creation note");
      }
    }
    if (savedRow && userId) {
      await insertCryptoNotification(
        userId,
        `${asset} receive address ready`,
        `Your ${config.network} receive address (${generatedAddress.slice(0, 8)}…${generatedAddress.slice(-6)}) is ready for incoming ${asset} deposits.`,
        config.network,
      );
    }

    const isTestnetAddr = IS_TATUM_TESTNET || (asset === "BTC" && /^(tb1|[mn2])/i.test(generatedAddress));
    return res.status(200).json({
      asset,
      address: generatedAddress,
      network: config.network,
      createdAt: savedRow?.created_at ?? new Date().toISOString(),
      provider: generatedFromTatum ? "tatum" : "unconfigured",
      networkMode: isTestnetAddr ? "testnet" : "mainnet",
      liveDepositEnabled: generatedFromTatum && missingConfig.length === 0 && Boolean(webhookUrl),
      subscriptionStatus,
      subscriptionError,
      webhookUrl: webhookUrl || undefined,
      webhookSource: webhookConfig.source,
      missingConfig,
    });
  } catch (error) {
    req.log?.error?.({ err: error, asset }, "crypto deposit address error");
    return res.status(500).json({
      message: error instanceof Error ? error.message : "Deposit wallet is temporarily unavailable",
    });
  }
});

async function insertCryptoNotification(
  userId: string,
  title: string,
  body: string,
  dedupeFragment?: string,
) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !userId) return;
  try {
    if (dedupeFragment) {
      const checkRes = await supabaseRequest(
        `notifications?user_id=eq.${encodeURIComponent(userId)}&type=eq.crypto&title=eq.${encodeURIComponent(title)}&body=ilike.*${encodeURIComponent(dedupeFragment)}*&select=id&limit=1`,
      );
      if (checkRes.ok) {
        const existing = (await safeJson<Array<{ id: string }>>(checkRes)) ?? [];
        if (existing.length > 0) return;
      }
    }
    await supabaseRequest("notifications", {
      method: "POST",
      body: JSON.stringify({
        user_id: userId,
        type: "crypto",
        title,
        body,
        read: false,
      }),
    });
  } catch {
    // Non-blocking: do not break webhook or transfer settlement if notification write fails
  }
}

function formatCryptoAmountDisplay(raw: string | number) {
  const num = Number(raw);
  if (!Number.isFinite(num)) return String(raw);
  return num.toLocaleString("en-US", { maximumFractionDigits: 8 });
}

router.post("/crypto/notify-transfer-recipient", async (req, res) => {
  try {
    const token = bearer(req);
    const senderId = await getUserId(token);
    if (!senderId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const body = (req.body ?? {}) as { recipientAccount?: string; asset?: string; amount?: number | string };
    const recipientAccount = String(body.recipientAccount ?? "").trim();
    const asset = String(body.asset ?? "").trim().toUpperCase();
    const amount = Number(body.amount);
    if (!recipientAccount || !["BTC", "ETH", "USDT"].includes(asset) || !Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ message: "Invalid notification payload" });
    }

    const txRes = await supabaseRequest(
      `crypto_transactions?user_id=eq.${encodeURIComponent(senderId)}&kind=eq.transfer_out&asset=eq.${encodeURIComponent(asset)}&counterparty_account=eq.${encodeURIComponent(recipientAccount)}&order=created_at.desc&limit=1`,
    );
    if (!txRes.ok) return res.status(200).json({ ok: false });
    const txs = (await safeJson<Array<{ id: string; amount: number; created_at: string }>>(txRes)) ?? [];
    const latestTx = txs[0];
    if (!latestTx || Date.now() - new Date(latestTx.created_at).getTime() > 5 * 60 * 1000) {
      return res.status(200).json({ ok: false });
    }

    const [senderRes, recipientRes] = await Promise.all([
      supabaseRequest(`profiles?id=eq.${encodeURIComponent(senderId)}&select=id,name,account_number&limit=1`),
      supabaseRequest(`profiles?account_number=eq.${encodeURIComponent(recipientAccount)}&select=id,name,account_number&limit=1`),
    ]);
    const senders = senderRes.ok ? (await safeJson<Array<{ id: string; name?: string; account_number?: string }>>(senderRes)) ?? [] : [];
    const recipients = recipientRes.ok ? (await safeJson<Array<{ id: string; name?: string; account_number?: string }>>(recipientRes)) ?? [] : [];
    const sender = senders[0];
    const recipient = recipients[0];
    if (!recipient?.id) return res.status(200).json({ ok: false });

    const displayAmt = formatCryptoAmountDisplay(latestTx.amount ?? amount);
    const refTag = latestTx.id.slice(0, 8);
    await insertCryptoNotification(
      recipient.id,
      `${asset} received`,
      `${displayAmt} ${asset} received from ${sender?.name || "Vexa user"} (Ref ${refTag}).`,
      refTag,
    );
    return res.status(200).json({ ok: true });
  } catch (error) {
    req.log?.warn?.({ err: error }, "Transfer recipient notification fallback note");
    return res.status(200).json({ ok: false });
  }
});

router.post("/crypto/webhooks/tatum", async (req, res) => {
  const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from("");
  try {
    const payload = JSON.parse(rawBody.toString("utf8")) as Record<string, unknown>;
    const event = nestedWebhookEvent(payload);
    if (!event || !verifyTatumSignature(rawBody, event, req.header("x-payload-hash"))) {
      res.status(401).json({ message: "Invalid webhook signature" });
      return;
    }
    const address = stringValue(event.address) ?? stringValue(event.to) ?? stringValue(event.destinationAddress);
    const txHash =
      stringValue(event.txId) ??
      stringValue(event.txHash) ??
      stringValue(event.transactionHash) ??
      stringValue(event.hash);
    const amount =
      stringValue(event.amount) ??
      stringValue(event.value) ??
      (numberValue(event.amount)?.toString() ?? numberValue(event.value)?.toString() ?? null);
    if (!address || !txHash || !amount) {
      res.status(400).json({ message: "Webhook is missing transaction details" });
      return;
    }

    const numericAmount = Number(amount);
    const direction = (stringValue(event.direction) ?? "").toLowerCase();
    const fromAddr = stringValue(event.from);
    const toAddr = stringValue(event.to) ?? stringValue(event.destinationAddress);
    if (
      !Number.isFinite(numericAmount) ||
      numericAmount <= 0 ||
      direction === "outgoing" ||
      (fromAddr && toAddr && fromAddr.toLowerCase() === address.toLowerCase() && toAddr.toLowerCase() !== address.toLowerCase())
    ) {
      res.status(200).json({ received: true, ignored: true, reason: "non_incoming_transfer" });
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
    if (!eventMatchesDepositAsset(depositAddress.asset, event)) {
      req.log.warn(
        { address, asset: depositAddress.asset, eventAsset: event.asset, eventType: event.type },
        "Tatum webhook asset/token does not match deposit address",
      );
      res.status(200).json({ received: true, ignored: true, reason: "asset_mismatch" });
      return;
    }
    const finality = stringValue(event.finality) ?? stringValue(event.status);
    const blockNumber = numberValue(event.blockNumber);
    const isMempool = event.mempool === true;
    const confirmations =
      numberValue(event.confirmations) ??
      numberValue(event.confirmationCount) ??
      (isMempool
        ? 0
        : finality === "final" || event.confirmed === true || (blockNumber !== null && blockNumber > 0)
          ? config.confirmations
          : 0);
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
    const body = (await result.json()) as {
      status?: string;
      confirmations?: number;
      required_confirmations?: number;
      notified?: boolean;
    };

    if (!body.notified) {
      const txShort = txHash.slice(0, 10);
      const displayAmount = formatCryptoAmountDisplay(amount);
      if (body.status === "pending") {
        await insertCryptoNotification(
          depositAddress.user_id,
          `${depositAddress.asset} deposit incoming`,
          `${displayAmount} ${depositAddress.asset} detected on ${depositAddress.network} (${body.confirmations ?? 0}/${body.required_confirmations ?? config.confirmations} confirmations · Tx ${txShort}…).`,
          txShort,
        );
      } else if (body.status === "credited") {
        await insertCryptoNotification(
          depositAddress.user_id,
          `${depositAddress.asset} deposit received`,
          `${displayAmount} ${depositAddress.asset} received on ${depositAddress.network} and credited to your Exchange wallet (Tx ${txShort}…).`,
          txShort,
        );
      }
    }

    res.status(200).json({ received: true, status: body.status ?? "processed" });
  } catch (error) {
    req.log.error({ err: error }, "Tatum webhook processing failed");
    res.status(503).json({ message: "Deposit processing is temporarily unavailable" });
  }
});

export default router;