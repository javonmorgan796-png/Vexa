import { useState } from "react";
import { ArrowLeftRight, WalletCards } from "lucide-react";
import "./_group.css";

type Asset = "BTC" | "ETH" | "USDT";
type Currency = "NGN" | "USD";

const nairaPerUsd = 1328.3;
const assets: Asset[] = ["BTC", "ETH", "USDT"];
const assetMeta: Record<Asset, { name: string; color: string; priceUsd: number; change: number }> = {
  BTC: { name: "Bitcoin", color: "#F7931A", priceUsd: 82480.71, change: 0.32 },
  ETH: { name: "Ethereum", color: "#627EEA", priceUsd: 2435.34, change: 1.34 },
  USDT: { name: "Tether", color: "#26A17B", priceUsd: 1, change: -0.15 },
};

function formatFiat(valueInNaira: number, currency: Currency) {
  const value = currency === "USD" ? valueInNaira / nairaPerUsd : valueInNaira;
  const symbol = currency === "USD" ? "$" : "₦";
  return `${symbol}${value.toLocaleString(currency === "USD" ? "en-US" : "en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function CryptoMark({ asset }: { asset: Asset }) {
  return (
    <span className="flex h-full w-full items-center justify-center text-white">
      {asset === "ETH" ? (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current">
          <path d="M12 1.5 5.5 12.2 12 16l6.5-3.8L12 1.5Zm-6.5 12.9L12 23l6.5-8.6L12 18.2l-6.5-3.8Z" />
        </svg>
      ) : (
        <span className="text-[12px] font-extrabold">{asset === "BTC" ? "₿" : "₮"}</span>
      )}
    </span>
  );
}

export function Current() {
  const [currency, setCurrency] = useState<Currency>("USD");
  const displayFiat = (value: number) => formatFiat(value, currency);
  const portfolioValue = 854.81 * nairaPerUsd;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F2F3F5] p-5" style={{ fontFamily: "Inter, sans-serif" }}>
      <section className="relative w-full max-w-[430px] overflow-hidden rounded-3xl bg-[#0C193F] p-5 text-white shadow-xl">
        <div className="absolute -right-10 -top-12 h-40 w-40 rounded-full bg-[#35C6FF]/20 blur-2xl" />
        <div className="relative">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/60">Exchange balance</p>
              <p className="mt-1 text-[28px] font-extrabold tabular-nums">{displayFiat(11567.53)}</p>
            </div>
            <button
              type="button"
              onClick={() => setCurrency(current => current === "NGN" ? "USD" : "NGN")}
              aria-label={`Switch currency display to ${currency === "NGN" ? "US dollars" : "Naira"}`}
              className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 transition hover:bg-white/20"
            >
              <ArrowLeftRight className="h-5 w-5 text-[#68D9FF]" />
            </button>
          </div>

          <p className="mt-2 text-[11px] text-white/60">Use your Vexa balance to buy, sell, and send supported assets.</p>
          <p className="mt-1 text-[10px] text-white/50">Live sync · Last updated just now</p>

          <div className="mt-4 border-t border-white/10 pt-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-white/60">Crypto holdings value</span>
              <b className="text-[13px] tabular-nums">{displayFiat(portfolioValue)}</b>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {assets.map(asset => (
                <div key={asset} className="rounded-xl bg-white/10 px-2 py-2">
                  <div className="flex items-center gap-1.5">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full" style={{ backgroundColor: assetMeta[asset].color }}>
                      <CryptoMark asset={asset} />
                    </span>
                    <span className="text-[10px] font-bold">{asset}</span>
                  </div>
                  <p className="mt-1 truncate text-[10px] font-bold tabular-nums">
                    {displayFiat(assetMeta[asset].priceUsd * nairaPerUsd)}
                  </p>
                  <p className={`mt-0.5 text-[9px] ${assetMeta[asset].change >= 0 ? "text-[#83F0B7]" : "text-[#FF9A9A]"}`}>
                    {assetMeta[asset].change >= 0 ? "+" : ""}{assetMeta[asset].change.toFixed(2)}%
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 inline-flex items-center gap-2 text-[11px] font-semibold text-[#8BE3FF]">
            <WalletCards className="h-3.5 w-3.5" /> •••• •••• 4827
          </div>
        </div>
      </section>
    </main>
  );
}
