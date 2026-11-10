import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDownToLine, ArrowLeft, ArrowUpRight, Check, ChevronRight, RefreshCw } from 'lucide-react';
import { useLocation } from 'wouter';
import { useVexaFinance, type CryptoAsset, type CryptoTransaction } from '@/context/VexaFinanceContext';
import {
  CRYPTO_ASSET_META,
  CryptoActivityDetailsModal,
  CryptoAssetLogo,
  FALLBACK_CRYPTO_RATES,
  formatCryptoAmount,
} from '@/components/crypto/CryptoActivityDetailsModal';

type Direction = 'incoming' | 'outgoing';

function formatDate(value: string) {
  return new Date(value).toLocaleString('en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function labelFor(kind: CryptoTransaction['kind'], direction: Direction) {
  if (kind === 'deposit') return 'Blockchain deposit';
  if (kind === 'transfer_in') return 'Vexa transfer received';
  if (kind === 'transfer_out') return 'Vexa transfer sent';
  if (kind === 'buy') return direction === 'incoming' ? 'Crypto purchased' : 'Crypto buy';
  return 'Crypto sold';
}

function belongsToDirection(item: CryptoTransaction, direction: Direction) {
  if (!['BTC', 'ETH', 'USDT'].includes(item.asset)) return false;
  if (direction === 'incoming') return item.kind === 'deposit' || item.kind === 'transfer_in' || item.kind === 'buy';
  return item.kind === 'transfer_out' || item.kind === 'sell';
}

export default function CryptoHistoryPage({ direction }: { direction: Direction }) {
  const [, navigate] = useLocation();
  const { cryptoTransactions, loading, error, refreshFinance } = useVexaFinance();
  const [assetFilter, setAssetFilter] = useState<'ALL' | CryptoAsset>('ALL');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<CryptoTransaction | null>(null);
  const [rates, setRates] = useState<Record<CryptoAsset, number>>(FALLBACK_CRYPTO_RATES);

  useEffect(() => {
    let active = true;
    const loadRates = async () => {
      try {
        const response = await fetch('/api/crypto/prices', {
          headers: { accept: 'application/json' },
        });
        if (!response.ok) return;
        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) return;
        const body = (await response.json()) as {
          prices?: Partial<Record<CryptoAsset, { ngn?: number }>>;
        };
        if (!body.prices || !active) return;
        setRates(prev => ({
          BTC: Number(body.prices?.BTC?.ngn) || prev.BTC,
          ETH: Number(body.prices?.ETH?.ngn) || prev.ETH,
          USDT: Number(body.prices?.USDT?.ngn) || prev.USDT,
        }));
      } catch {
        // Keep fallback rates if offline
      }
    };
    void loadRates();
    return () => {
      active = false;
    };
  }, []);

  const items = useMemo(
    () =>
      cryptoTransactions.filter(
        item =>
          belongsToDirection(item, direction) &&
          (assetFilter === 'ALL' || item.asset === assetFilter),
      ),
    [assetFilter, cryptoTransactions, direction],
  );

  const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);
  const title = direction === 'incoming' ? 'Incoming crypto' : 'Outgoing crypto';
  const subtitle =
    direction === 'incoming'
      ? 'Blockchain deposits and crypto received from Vexa users'
      : 'Crypto sent to Vexa users and sold to your exchange balance';

  async function handleRefresh() {
    setRefreshing(true);
    await refreshFinance();
    setRefreshing(false);
  }

  return (
    <div className="theme-page fixed inset-0 flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div
        className="theme-surface theme-border flex-none flex items-center justify-between gap-3 border-b px-4 pb-3"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}
      >
        <button
          type="button"
          onClick={() => navigate('/crypto')}
          className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-[#2B313A]"
          aria-label="Back to crypto exchange"
        >
          <ArrowLeft className="h-5 w-5 theme-text-primary" />
        </button>
        <span className="text-[16px] font-bold theme-text-primary">{title}</span>
        <button
          type="button"
          onClick={() => void handleRefresh()}
          disabled={refreshing || loading}
          className="flex h-10 w-10 items-center justify-center rounded-full text-[#B7791F] dark:text-[#F0B90B] disabled:opacity-50"
          aria-label="Refresh crypto activity"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4" style={{ scrollbarWidth: 'none' }}>
        <div className="relative overflow-hidden rounded-3xl bg-[#181A20] border border-[#2B313A] p-5 text-[#EAECEF] shadow-lg">
          <div
            className={`pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full blur-3xl ${
              direction === 'incoming' ? 'bg-[#0ECB81]/15' : 'bg-[#F0B90B]/15'
            }`}
          />
          <p className="text-[11px] uppercase tracking-[0.2em] text-[#848E9C]">
            {direction === 'incoming' ? 'Received' : 'Sent'}
          </p>
          <p
            className={`mt-2 text-[24px] font-extrabold tabular-nums ${
              direction === 'incoming' ? 'text-[#0ECB81]' : 'text-[#F0B90B]'
            }`}
          >
            {formatCryptoAmount(totalAmount)} crypto
          </p>
          <p className="mt-2 text-[11px] text-[#848E9C]">{subtitle}</p>
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {(['ALL', 'BTC', 'ETH', 'USDT'] as const).map(item => (
            <button
              key={item}
              type="button"
              onClick={() => setAssetFilter(item)}
              className={`shrink-0 rounded-xl px-4 py-2.5 text-[11px] font-bold transition-colors ${
                assetFilter === item
                  ? 'bg-[#F0B90B] text-[#181A20] shadow-xs'
                  : 'theme-surface theme-border border theme-text-secondary'
              }`}
            >
              {item === 'ALL' ? 'All assets' : item}
            </button>
          ))}
        </div>

        {error && (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] text-amber-700">
            {error}
          </div>
        )}

        <div className="theme-surface theme-border mt-4 overflow-hidden rounded-2xl border divide-y divide-[#F0F1F4] dark:divide-[#2B313A]">
          {items.length === 0 && (
            <div className="px-4 py-12 text-center">
              <div className="theme-surface-alt mx-auto flex h-12 w-12 items-center justify-center rounded-full">
                {direction === 'incoming' ? (
                  <ArrowDownToLine className="h-5 w-5 text-[#059669] dark:text-[#0ECB81]" />
                ) : (
                  <ArrowUpRight className="h-5 w-5 text-[#B7791F] dark:text-[#F0B90B]" />
                )}
              </div>
              <p className="mt-3 text-[13px] font-semibold theme-text-primary">No {direction} crypto yet</p>
              <p className="mt-1 text-[11px] theme-text-secondary">
                {direction === 'incoming'
                  ? 'Received crypto activity will appear here.'
                  : 'Sent crypto activity will appear here.'}
              </p>
            </div>
          )}

          {items.map(item => {
            const asset = item.asset as CryptoAsset;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedActivity(item)}
                className="w-full flex items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-[#FAFBFD] dark:hover:bg-[#1E2329] active:bg-[#F5F6F8] dark:active:bg-[#232933]"
              >
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-full shrink-0"
                  style={{ backgroundColor: CRYPTO_ASSET_META[asset].color }}
                >
                  <CryptoAssetLogo asset={asset} size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-semibold theme-text-primary truncate">
                    {labelFor(item.kind, direction)}
                  </p>
                  <p className="mt-1 text-[10px] theme-text-secondary">{formatDate(item.createdAt)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p
                    className={`text-[12px] font-bold tabular-nums ${
                      direction === 'incoming'
                        ? 'text-[#059669] dark:text-[#0ECB81]'
                        : 'text-[#D44A4A] dark:text-[#F6465D]'
                    }`}
                  >
                    {direction === 'incoming' ? '+' : '-'}
                    {formatCryptoAmount(item.amount)} {asset}
                  </p>
                  <p className="mt-1 inline-flex items-center gap-1 text-[10px] text-[#059669] dark:text-[#0ECB81]">
                    <Check className="h-3 w-3" /> Completed
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-[#C0C6D0] dark:text-[#5E6673]" aria-hidden="true" />
              </button>
            );
          })}
        </div>
      </div>

      {selectedActivity && (
        <CryptoActivityDetailsModal
          transaction={selectedActivity}
          nairaPerUsd={rates.USDT}
          liveRates={rates}
          onClose={() => setSelectedActivity(null)}
        />
      )}
    </div>
  );
}

export function IncomingCryptoPage() {
  return <CryptoHistoryPage direction="incoming" />;
}

export function OutgoingCryptoPage() {
  return <CryptoHistoryPage direction="outgoing" />;
}