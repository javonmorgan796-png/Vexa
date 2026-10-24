import { useState } from "react";
import { ArrowLeftRight, Check, WalletCards } from "lucide-react";
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

export function Redesign() {
  const [currency, setCurrency] = useState<Currency>("NGN");
  const displayFiat = (value: number) => formatFiat(value, currency);
  const portfolioValue = 854.81 * nairaPerUsd;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F2F3F5] p-5" style={{ fontFamily: "Inter, sans-serif" }}>
      <section className="relative w-full max-w-[430px] overflow-hidden rounded-[26px] bg-gradient-to-br from-[#0C193F] via-[#10234C] to-[#0D3F50] p-[18px] text-white shadow-[0_18px_40px_-22px_rgba(12,25,63,0.75)]">
        <div className="pointer-events-none absolute -right-12 -top-16 h-40 w-40 rounded-full bg-[#36D5D0]/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-20 h-32 w-48 rounded-full bg-[#2586B8]/15 blur-3xl" />
        <div className="relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-[#72E6B5] shadow-[0_0_0_4px_rgba(114,230,181,0.12)]" />
              <span className="text-[10px] font-bold uppercase tracking-[0.17em] text-white/65">Vexa exchange</span>
            </div>
            <button
              type="button"
              onClick={() => setCurrency(current => current === "NGN" ? "USD" : "NGN")}
              aria-label={`Switch currency display to ${currency === "NGN" ? "US dollars" : "Naira"}`}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.08] text-[#8DE8F4] transition hover:bg-white/[0.15]"
            >
              <ArrowLeftRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-3 flex items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] font-medium text-white/55">Available balance</p>
              <p className="mt-0.5 truncate text-[30px] font-extrabold leading-none tracking-[-0.04em] tabular-nums">
                {displayFiat(11567.53)}
              </p>
            </div>
            <p className="mb-0.5 shrink-0 rounded-full bg-white/[0.08] px-2.5 py-1 text-[9px] font-medium text-white/65">
              Buy · sell · transfer
            </p>
          </div>

          <div className="mt-3 flex items-center gap-1.5 text-[10px] text-white/55">
            <Check className="h-3 w-3 text-[#72E6B5]" />
            <span>Synced just now</span>
            <span className="mx-1 h-0.5 w-0.5 rounded-full bg-white/35" />
            <span>Crypto holdings</span>
            <b className="ml-auto text-[12px] font-bold text-white tabular-nums">{displayFiat(portfolioValue)}</b>
          </div>

          <div className="mt-3 grid grid-cols-3 overflow-hidden rounded-2xl border border-white/[0.09] bg-white/[0.055]">
            {assets.map((asset, index) => (
              <div
                key={asset}
                className={`min-w-0 px-2.5 py-2.5 ${index > 0 ? "border-l border-white/[0.09]" : ""}`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: assetMeta[asset].color }}>
                    <CryptoMark asset={asset} />
                  </span>
                  <span className="text-[10px] font-bold tracking-wide">{asset}</span>
                </div>
                <p className="mt-1.5 truncate text-[11px] font-semibold tabular-nums">
                  {displayFiat(assetMeta[asset].priceUsd * nairaPerUsd)}
                </p>
                <p className={`mt-0.5 text-[9px] font-medium ${assetMeta[asset].change >= 0 ? "text-[#8FE8BB]" : "text-[#FFB6B6]"}`}>
                  {assetMeta[asset].change >= 0 ? "+" : ""}{assetMeta[asset].change.toFixed(2)}%
                </p>
              </div>
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-white/[0.10] pt-2.5">
            <div className="flex items-center gap-2 text-white/60">
              <WalletCards className="h-3.5 w-3.5 text-[#8DE8F4]" />
              <span className="text-[10px] font-medium">Vexa account</span>
            </div>
            <span className="text-[11px] font-semibold tracking-[0.06em] text-white/90">•••• •••• 4827</span>
          </div>
        </div>
      </section>
    </main>
  );
}
