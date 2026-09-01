import React, { useMemo, useState } from 'react';
import { ArrowDownToLine, ArrowLeft, ArrowUpRight, Check, RefreshCw } from 'lucide-react';
import { useLocation } from 'wouter';
import { useVexaFinance, type CryptoAsset, type CryptoTransaction } from '@/context/VexaFinanceContext';
import { FaBitcoin, FaEthereum } from 'react-icons/fa6';
import { SiTether } from 'react-icons/si';

type Direction = 'incoming' | 'outgoing';

const ASSET_COLORS: Record<CryptoAsset, string> = {
  BTC: '#F7931A',
  ETH: '#627EEA',
  USDT: '#26A17B',
};

const ASSET_ICONS: Record<CryptoAsset, React.ComponentType<{ size?: number; color?: string }>> = {
  BTC: FaBitcoin,
  ETH: FaEthereum,
  USDT: SiTether,
};

function formatCrypto(value: number) {
  return value.toLocaleString('en-NG', { maximumFractionDigits: 8 });
}

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

  const items = useMemo(
    () => cryptoTransactions.filter(item =>
      belongsToDirection(item, direction) &&
      (assetFilter === 'ALL' || item.asset === assetFilter),
    ),
    [assetFilter, cryptoTransactions, direction],
  );

  const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);
  const title = direction === 'incoming' ? 'Incoming crypto' : 'Outgoing crypto';
  const subtitle = direction === 'incoming'
    ? 'Blockchain deposits and crypto received from Vexa users'
    : 'Crypto sent to Vexa users and sold to your exchange balance';

  async function handleRefresh() {
    setRefreshing(true);
    await refreshFinance();
    setRefreshing(false);
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-[#F2F3F5]" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div
        className="flex-none flex items-center justify-between gap-3 border-b border-[#E8EBF0] bg-white px-4 pb-3"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}
      >
        <button
          onClick={() => navigate('/crypto')}
          className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100"
          aria-label="Back to crypto exchange"
        >
          <ArrowLeft className="h-5 w-5 text-[#222]" />
        </button>
        <span className="text-[16px] font-bold text-[#111]">{title}</span>
        <button
          onClick={() => void handleRefresh()}
          disabled={refreshing || loading}
          className="flex h-8 w-8 items-center justify-center rounded-full text-[#2563EB] disabled:opacity-50"
          aria-label="Refresh crypto activity"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4" style={{ scrollbarWidth: 'none' }}>
        <div
          className={`rounded-3xl p-5 text-white ${
            direction === 'incoming'
              ? 'bg-gradient-to-br from-[#0B6B4F] via-[#087A63] to-[#064E3B]'
              : 'bg-gradient-to-br from-[#162353] via-[#1E3A6E] to-[#0F6CBD]'
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/60">
                {direction === 'incoming' ? 'Total received' : 'Total sent'}
              </p>
              <p className="mt-1 text-[28px] font-extrabold">{formatCrypto(totalAmount)}</p>
              <p className="mt-1 text-[11px] text-white/60">
                {items.length} {items.length === 1 ? 'transaction' : 'transactions'}
              </p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15">
              {direction === 'incoming'
                ? <ArrowDownToLine className="h-5 w-5 text-[#9AF4D1]" />
                : <ArrowUpRight className="h-5 w-5 text-[#A9D9FF]" />}
            </div>
          </div>
          <p className="mt-4 text-[11px] leading-relaxed text-white/60">{subtitle}</p>
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {(['ALL', 'BTC', 'ETH', 'USDT'] as const).map(item => (
            <button
              key={item}
              onClick={() => setAssetFilter(item)}
              className={`shrink-0 rounded-full px-4 py-2 text-[11px] font-bold transition-colors ${
                assetFilter === item
                  ? 'bg-[#162353] text-white'
                  : 'border border-[#E2E5EA] bg-white text-[#666]'
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

        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between px-1">
            <p className="text-[11px] font-bold uppercase tracking-wide text-[#888]">Activity</p>
            <p className="text-[10px] text-[#999]">Updates automatically</p>
          </div>

          {loading && cryptoTransactions.length === 0 && (
            <div className="rounded-2xl border border-[#F0F0F0] bg-white px-4 py-8 text-center text-[12px] text-[#888]">
              Loading activity…
            </div>
          )}

          {!loading && items.length === 0 && (
            <div className="rounded-2xl border border-[#F0F0F0] bg-white px-5 py-10 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#F4F6FA]">
                {direction === 'incoming'
                  ? <ArrowDownToLine className="h-5 w-5 text-[#159669]" />
                  : <ArrowUpRight className="h-5 w-5 text-[#2563EB]" />}
              </div>
              <p className="mt-3 text-[14px] font-bold text-[#222]">
                No {direction} transactions yet
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-[#888]">
                {direction === 'incoming'
                  ? 'Your confirmed blockchain deposits and received transfers will appear here.'
                  : 'Crypto transfers you send and assets you sell will appear here.'}
              </p>
              <button
                onClick={() => navigate('/crypto')}
                className="mt-4 rounded-xl bg-[#162353] px-4 py-2.5 text-[12px] font-bold text-white"
              >
                Go to Vexa Exchange
              </button>
            </div>
          )}

          {items.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-[#F0F0F0] bg-white">
              {items.map((item, index) => {
                const asset = item.asset as CryptoAsset;
                const Icon = ASSET_ICONS[asset] ?? FaBitcoin;
                const iconColor = ASSET_COLORS[asset] ?? ASSET_COLORS.BTC;
                const isIncoming = direction === 'incoming';
                return (
                  <div
                    key={item.id}
                    className={`flex items-center gap-3 px-4 py-4 ${
                      index < items.length - 1 ? 'border-b border-[#F3F4F6]' : ''
                    }`}
                  >
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                      style={{ backgroundColor: iconColor }}
                    >
                      <Icon size={20} color="#fff" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-bold text-[#222]">
                        {labelFor(item.kind, direction)}
                      </p>
                      <p className="mt-0.5 text-[10px] text-[#999]">{formatDate(item.createdAt)}</p>
                      {item.counterpartyAccount && (
                        <p className="mt-0.5 truncate text-[10px] text-[#999]">
                          {isIncoming ? 'From' : 'To'} account {item.counterpartyAccount}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={`text-[13px] font-extrabold ${isIncoming ? 'text-[#159669]' : 'text-[#D44A4A]'}`}>
                        {isIncoming ? '+' : '-'}{formatCrypto(item.amount)} {asset}
                      </p>
                      <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-[#159669]">
                        <Check className="h-3 w-3" /> Confirmed
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function IncomingCryptoPage() {
  return <CryptoHistoryPage direction="incoming" />;
}

export function OutgoingCryptoPage() {
  return <CryptoHistoryPage direction="outgoing" />;
}