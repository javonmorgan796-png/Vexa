import React, { useState } from 'react';
import { Check, Copy, X } from 'lucide-react';
import { FaBitcoin, FaEthereum } from 'react-icons/fa6';
import { SiTether } from 'react-icons/si';
import type { IconType } from 'react-icons';
import type { CryptoAsset, CryptoTransaction } from '@/context/VexaFinanceContext';

export const FALLBACK_CRYPTO_RATES: Record<CryptoAsset, number> = {
  BTC: 155_000_000,
  ETH: 5_800_000,
  USDT: 1_620,
};

export const CRYPTO_ASSET_META: Record<
  CryptoAsset,
  { name: string; color: string; description: string; logo: IconType }
> = {
  BTC: { name: 'Bitcoin', color: '#F7931A', description: 'Store of value', logo: FaBitcoin },
  ETH: { name: 'Ethereum', color: '#627EEA', description: 'Smart contracts', logo: FaEthereum },
  USDT: { name: 'Tether', color: '#26A17B', description: 'Dollar-backed stablecoin', logo: SiTether },
};

export type CryptoFiatCurrency = 'NGN' | 'USD';

export function formatCryptoFiat(
  valueInNaira: number,
  currency: CryptoFiatCurrency,
  nairaPerUsd = FALLBACK_CRYPTO_RATES.USDT,
) {
  const safeUsd = nairaPerUsd > 0 ? nairaPerUsd : FALLBACK_CRYPTO_RATES.USDT;
  const value = currency === 'USD' ? valueInNaira / safeUsd : valueInNaira;
  const symbol = currency === 'USD' ? '$' : '₦';
  const locale = currency === 'USD' ? 'en-US' : 'en-NG';
  return `${symbol}${value.toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatCryptoAmount(value: number) {
  return value.toLocaleString('en-NG', { maximumFractionDigits: 8 });
}

export function CryptoAssetLogo({ asset, size = 22 }: { asset: CryptoAsset; size?: number }) {
  const Logo = CRYPTO_ASSET_META[asset].logo;
  return <Logo size={size} color="#fff" aria-hidden="true" />;
}

export function CryptoActivityDetailsModal({
  transaction,
  currency = 'NGN',
  nairaPerUsd = FALLBACK_CRYPTO_RATES.USDT,
  liveRates = FALLBACK_CRYPTO_RATES,
  onClose,
}: {
  transaction: NonNullable<CryptoTransaction>;
  currency?: CryptoFiatCurrency;
  nairaPerUsd?: number;
  liveRates?: Partial<Record<CryptoAsset, number>>;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const assetKey = (['BTC', 'ETH', 'USDT'].includes(transaction.asset)
    ? transaction.asset
    : 'BTC') as CryptoAsset;
  const meta = CRYPTO_ASSET_META[assetKey];
  const isOutgoing = transaction.kind === 'transfer_out' || transaction.kind === 'sell';
  const kindLabel = transaction.kind.replace('_', ' ');

  const fallbackRate = liveRates[assetKey] ?? FALLBACK_CRYPTO_RATES[assetKey];
  const effectiveRate = transaction.rate > 0 ? transaction.rate : fallbackRate;
  const effectiveNairaAmount =
    transaction.nairaAmount > 0
      ? transaction.nairaAmount
      : transaction.asset === 'NGN'
        ? transaction.amount
        : transaction.amount * effectiveRate;

  const copyId = async () => {
    await navigator.clipboard?.writeText(transaction.id);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-hidden bg-black/65 dark:bg-black/75 backdrop-blur-[2px] px-0 sm:items-center sm:px-4"
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="crypto-receipt-title"
        className="w-full min-w-0 max-w-[430px] max-h-[88vh] overflow-y-auto overflow-x-hidden rounded-t-3xl bg-white dark:bg-[#181A20] px-5 pt-4 shadow-2xl dark:shadow-[0_-12px_40px_rgba(0,0,0,0.75)] sm:rounded-3xl"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 28px)' }}
        onClick={event => event.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[#D9DDE5] dark:bg-[#3A4556] sm:hidden" />
        <div className="flex items-center justify-between gap-3">
          <p id="crypto-receipt-title" className="text-[16px] font-bold text-[#111] dark:text-[#EAECEF]">
            Activity details
          </p>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F5F6F8] dark:bg-[#2B313A] text-[#555] dark:text-[#EAECEF] transition hover:opacity-80"
            aria-label="Close activity details"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 rounded-2xl bg-[#F7F9FC] dark:bg-[#1E2329] px-4 py-5 text-center">
          <div
            className="mx-auto flex h-12 w-12 items-center justify-center rounded-full"
            style={{ backgroundColor: meta.color }}
          >
            <CryptoAssetLogo asset={assetKey} size={25} />
          </div>
          <p className="mt-3 text-[13px] font-semibold capitalize text-[#555] dark:text-[#848E9C]">
            {kindLabel}
          </p>
          <p
            className={`mt-1 break-words text-[28px] font-extrabold tabular-nums ${
              isOutgoing ? 'text-[#D44A4A] dark:text-[#F6465D]' : 'text-[#159669] dark:text-[#0ECB81]'
            }`}
          >
            {isOutgoing ? '-' : '+'}
            {formatCryptoAmount(transaction.amount)} {transaction.asset}
          </p>
          <p className="mt-1 text-[12px] text-[#888] dark:text-[#848E9C]">
            {new Date(transaction.createdAt).toLocaleString('en-NG', {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          </p>
        </div>

        <div className="mt-4 rounded-2xl bg-[#F7F9FC] dark:bg-[#1E2329] px-4 divide-y divide-[#ECEEF2] dark:divide-[#2B313A]">
          <div className="flex items-center justify-between gap-4 py-3.5 min-w-0">
            <span className="shrink-0 text-[12px] text-[#888] dark:text-[#848E9C]">Status</span>
            <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#159669] dark:text-[#0ECB81]">
              <Check className="h-3.5 w-3.5" /> Completed
            </span>
          </div>
          <div className="flex items-center justify-between gap-4 py-3.5 min-w-0">
            <span className="shrink-0 text-[12px] text-[#888] dark:text-[#848E9C]">
              {currency === 'USD' ? 'USD value' : 'Naira value'}
            </span>
            <span className="min-w-0 text-right text-[12px] font-semibold text-[#222] dark:text-[#EAECEF] tabular-nums">
              {formatCryptoFiat(effectiveNairaAmount, currency, nairaPerUsd)}
            </span>
          </div>
          {transaction.asset !== 'NGN' && (
            <div className="flex items-center justify-between gap-4 py-3.5 min-w-0">
              <span className="shrink-0 text-[12px] text-[#888] dark:text-[#848E9C]">Exchange rate</span>
              <span className="min-w-0 text-right text-[12px] font-semibold text-[#222] dark:text-[#EAECEF] tabular-nums">
                {formatCryptoFiat(effectiveRate, currency, nairaPerUsd)} / {transaction.asset}
              </span>
            </div>
          )}
          {transaction.counterpartyAccount && (
            <div className="flex items-start justify-between gap-4 py-3.5 min-w-0">
              <span className="shrink-0 text-[12px] text-[#888] dark:text-[#848E9C]">
                {transaction.kind === 'transfer_in' ? 'From account' : 'To account'}
              </span>
              <span className="min-w-0 flex-1 text-right text-[12px] font-semibold text-[#222] dark:text-[#EAECEF] [overflow-wrap:anywhere]">
                {transaction.counterpartyAccount}
              </span>
            </div>
          )}
          {transaction.note && (
            <div className="flex items-start justify-between gap-4 py-3.5 min-w-0">
              <span className="shrink-0 text-[12px] text-[#888] dark:text-[#848E9C]">Note</span>
              <span className="min-w-0 flex-1 text-right text-[12px] font-semibold text-[#222] dark:text-[#EAECEF] [overflow-wrap:anywhere]">
                {transaction.note}
              </span>
            </div>
          )}
        </div>

        <div className="mt-4 rounded-2xl bg-[#F7F9FC] dark:bg-[#1E2329] px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#999] dark:text-[#848E9C]">
            Transaction ID
          </p>
          <div className="mt-1 flex items-center gap-2 min-w-0">
            <p className="min-w-0 flex-1 break-all font-mono text-[10px] text-[#444] dark:text-[#EAECEF]">
              {transaction.id}
            </p>
            <button
              type="button"
              onClick={() => void copyId()}
              className="shrink-0 rounded-lg p-2 text-[#B7791F] dark:text-[#F0B90B] hover:bg-black/5 dark:hover:bg-[#2B313A] transition-colors"
              aria-label="Copy transaction ID"
            >
              {copied ? <Check className="h-4 w-4 text-[#0ECB81]" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
          {copied && (
            <p className="mt-1 text-[10px] text-[#059669] dark:text-[#0ECB81]">Transaction ID copied.</p>
          )}
        </div>
      </section>
    </div>
  );
}
