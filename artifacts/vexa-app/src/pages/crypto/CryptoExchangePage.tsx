import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDownToLine, ArrowLeftRight, ArrowUpRight, Check, Copy, RefreshCw, Send, WalletCards, X } from 'lucide-react';
import { FaBitcoin, FaEthereum } from 'react-icons/fa6';
import { SiTether } from 'react-icons/si';
import type { IconType } from 'react-icons';
import { useLocation } from 'wouter';
import { useAuth } from '@/context/AuthContext';
import { useAccountSecurity } from '@/context/AccountSecurityContext';
import { useVexaFinance, type CryptoAsset, type CryptoTransaction } from '@/context/VexaFinanceContext';
import { supabase } from '@/lib/supabase';
import { QRCodeSVG } from 'qrcode.react';

const FALLBACK_RATES: Record<CryptoAsset, number> = {
  BTC: 155_000_000,
  ETH: 5_800_000,
  USDT: 1_620,
};

const ASSET_META: Record<CryptoAsset, { name: string; color: string; description: string; logo: IconType }> = {
  BTC: { name: 'Bitcoin', color: '#F7931A', description: 'Store of value', logo: FaBitcoin },
  ETH: { name: 'Ethereum', color: '#627EEA', description: 'Smart contracts', logo: FaEthereum },
  USDT: { name: 'Tether', color: '#26A17B', description: 'Dollar-backed stablecoin', logo: SiTether },
};

type FiatCurrency = 'NGN' | 'USD';

function formatFiat(valueInNaira: number, currency: FiatCurrency, nairaPerUsd = FALLBACK_RATES.USDT) {
  const value = currency === 'USD' ? valueInNaira / nairaPerUsd : valueInNaira;
  const symbol = currency === 'USD' ? '$' : '₦';
  const locale = currency === 'USD' ? 'en-US' : 'en-NG';
  return `${symbol}${value.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function money(value: number) {
  return formatFiat(value, 'NGN');
}

function crypto(value: number) {
  return value.toLocaleString('en-NG', { maximumFractionDigits: 8 });
}

function timeSince(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes === 1) return '1 minute ago';
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours === 1) return '1 hour ago';
  return `${hours} hours ago`;
}

function signedPercent(value: number) {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

type DepositAddress = { asset: CryptoAsset; address: string; network: string; createdAt: string };
type CryptoPageView = 'overview' | 'exchange' | 'transfer' | 'receive';

function CryptoLogo({ asset, size = 22 }: { asset: CryptoAsset; size?: number }) {
  const Logo = ASSET_META[asset].logo;
  return <Logo size={size} color="#fff" aria-hidden="true" />;
}

function PageHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex-none flex items-center gap-3 px-4 pb-3 bg-white border-b border-[#E8EBF0]"
      style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}>
      <button onClick={onBack} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100" aria-label="Go back">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7-7-7"/></svg>
      </button>
      <span className="text-[16px] font-bold text-[#111]">{title}</span>
    </div>
  );
}

function CryptoActivityDetails({
  transaction,
  currency,
  nairaPerUsd,
  onClose,
}: {
  transaction: NonNullable<CryptoTransaction>;
  currency: FiatCurrency;
  nairaPerUsd: number;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const meta = ASSET_META[transaction.asset as CryptoAsset] ?? ASSET_META.BTC;
  const isOutgoing = transaction.kind === 'transfer_out' || transaction.kind === 'sell';
  const kindLabel = transaction.kind.replace('_', ' ');

  const copyId = async () => {
    await navigator.clipboard?.writeText(transaction.id);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#07122B]/55 px-0 sm:items-center sm:px-4" onClick={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="crypto-receipt-title"
        className="w-full max-w-[430px] max-h-[88vh] overflow-y-auto rounded-t-3xl bg-white px-5 pb-7 pt-4 shadow-2xl sm:rounded-3xl"
        onClick={event => event.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[#D9DDE5] sm:hidden" />
        <div className="flex items-center justify-between">
          <p id="crypto-receipt-title" className="text-[16px] font-bold text-[#111]">Activity details</p>
          <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F5F6F8] text-[#555]" aria-label="Close activity details">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 rounded-2xl bg-[#F7F9FC] px-4 py-5 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: meta.color }}>
            <CryptoLogo asset={transaction.asset as CryptoAsset} size={25} />
          </div>
          <p className="mt-3 text-[13px] font-semibold capitalize text-[#555]">{kindLabel}</p>
          <p className={`mt-1 text-[28px] font-extrabold ${isOutgoing ? 'text-[#D44A4A]' : 'text-[#159669]'}`}>
            {isOutgoing ? '-' : '+'}{crypto(transaction.amount)} {transaction.asset}
          </p>
          <p className="mt-1 text-[12px] text-[#888]">{new Date(transaction.createdAt).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })}</p>
        </div>

        <div className="mt-5 divide-y divide-[#F0F1F4] rounded-2xl border border-[#ECEEF2] px-4">
          <div className="flex items-center justify-between py-3">
            <span className="text-[12px] text-[#888]">Status</span>
            <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#159669]"><Check className="h-3.5 w-3.5" /> Completed</span>
          </div>
          <div className="flex items-center justify-between gap-4 py-3">
            <span className="text-[12px] text-[#888]">Naira value</span>
            <span className="text-right text-[12px] font-semibold text-[#222]">{formatFiat(transaction.nairaAmount, currency, nairaPerUsd)}</span>
          </div>
          <div className="flex items-center justify-between gap-4 py-3">
            <span className="text-[12px] text-[#888]">Exchange rate</span>
            <span className="text-right text-[12px] font-semibold text-[#222]">{formatFiat(transaction.rate, currency, nairaPerUsd)} / {transaction.asset}</span>
          </div>
          {transaction.counterpartyAccount && (
            <div className="flex items-center justify-between gap-4 py-3">
              <span className="text-[12px] text-[#888]">{transaction.kind === 'transfer_in' ? 'From account' : 'To account'}</span>
              <span className="text-right text-[12px] font-semibold text-[#222]">{transaction.counterpartyAccount}</span>
            </div>
          )}
          {transaction.note && (
            <div className="flex items-start justify-between gap-4 py-3">
              <span className="text-[12px] text-[#888]">Note</span>
              <span className="max-w-[62%] text-right text-[12px] font-semibold text-[#222]">{transaction.note}</span>
            </div>
          )}
        </div>

        <div className="mt-4 rounded-2xl bg-[#F7F9FC] px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#999]">Transaction ID</p>
          <div className="mt-1 flex items-center gap-2">
            <p className="min-w-0 flex-1 break-all font-mono text-[10px] text-[#444]">{transaction.id}</p>
            <button onClick={() => void copyId()} className="shrink-0 rounded-lg p-2 text-[#2563EB] hover:bg-white" aria-label="Copy transaction ID">
              {copied ? <Check className="h-4 w-4 text-[#159669]" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
          {copied && <p className="mt-1 text-[10px] text-[#159669]">Transaction ID copied.</p>}
        </div>
      </section>
    </div>
  );
}

export default function CryptoExchangePage({ view = 'overview' }: { view?: CryptoPageView }) {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { state: securityState } = useAccountSecurity();
  const { exchangeNaira, cryptoBalances, cryptoTransactions, loading, error, lastUpdatedAt, refreshFinance, depositToExchange, exchangeCrypto, transferCrypto } = useVexaFinance();
  const [rates, setRates] = useState<Record<CryptoAsset, number>>(FALLBACK_RATES);
  const [priceChanges, setPriceChanges] = useState<Record<CryptoAsset, number>>({ BTC: 0, ETH: 0, USDT: 0 });
  const [priceUpdatedAt, setPriceUpdatedAt] = useState<string | null>(null);
  const [priceError, setPriceError] = useState('');
  const [priceStale, setPriceStale] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [asset, setAsset] = useState<CryptoAsset>('BTC');
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [fiatCurrency, setFiatCurrency] = useState<FiatCurrency>('NGN');
  const [exchangeAmount, setExchangeAmount] = useState('');
  const [recipient, setRecipient] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [formError, setFormError] = useState('');
  const [depositAddress, setDepositAddress] = useState<DepositAddress | null>(null);
  const [addressLoading, setAddressLoading] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<CryptoTransaction | null>(null);

  const fetchPrices = useCallback(async () => {
    try {
      const response = await fetch('/api/crypto/prices', {
        headers: { accept: 'application/json' },
      });
      const body = (await response.json()) as {
        prices?: Partial<Record<CryptoAsset, { ngn?: number; change24h?: number }>>;
        fetchedAt?: string;
        stale?: boolean;
        message?: string;
      };
      if (!response.ok || !body.prices || !body.fetchedAt) {
        throw new Error(body.message ?? 'Live crypto prices are unavailable');
      }

      const nextRates = {} as Record<CryptoAsset, number>;
      const nextChanges = {} as Record<CryptoAsset, number>;
      (Object.keys(ASSET_META) as CryptoAsset[]).forEach(item => {
        const price = body.prices?.[item];
        if (!price?.ngn || !Number.isFinite(price.ngn)) {
          throw new Error('Live crypto prices are incomplete');
        }
        nextRates[item] = price.ngn;
        nextChanges[item] = Number(price.change24h ?? 0);
      });
      setRates(nextRates);
      setPriceChanges(nextChanges);
      setPriceUpdatedAt(body.fetchedAt);
      setPriceStale(Boolean(body.stale));
      setPriceError(body.stale ? 'Live provider is unavailable. Showing the last received rates.' : '');
    } catch (priceFetchError) {
      setPriceError(priceFetchError instanceof Error ? priceFetchError.message : 'Live crypto prices are unavailable');
    }
  }, []);

  useEffect(() => {
    void fetchPrices();
    const interval = window.setInterval(() => { void fetchPrices(); }, 30000);
    return () => window.clearInterval(interval);
  }, [fetchPrices]);

  const portfolioValue = useMemo(
    () => cryptoBalances.reduce((total, item) => total + item.amount * rates[item.asset], 0),
    [cryptoBalances, rates],
  );
  const nairaPerUsd = rates.USDT > 0 ? rates.USDT : FALLBACK_RATES.USDT;
  const fiatLabel = fiatCurrency === 'USD' ? 'Dollars' : 'Naira';
  const displayFiat = (valueInNaira: number) => formatFiat(valueInNaira, fiatCurrency, nairaPerUsd);
  const toNaira = (value: number) => fiatCurrency === 'USD' ? value * nairaPerUsd : value;
  const livePricesReady = Boolean(priceUpdatedAt && !priceStale);
  const moneyMovementLocked = securityState.sleepModeActive || securityState.freezeActive;

  const selectedBalance = useMemo(
    () => cryptoBalances.find(item => item.asset === asset)?.amount ?? 0,
    [asset, cryptoBalances],
  );
  const parsedExchangeAmount = Number(exchangeAmount);
  const hasExchangeAmount = exchangeAmount.trim() !== ''
    && Number.isFinite(parsedExchangeAmount)
    && parsedExchangeAmount > 0;
  const exchangeNairaAmount = side === 'buy'
    ? toNaira(parsedExchangeAmount)
    : parsedExchangeAmount * rates[asset];
  const estimatedCryptoAmount = side === 'buy'
    ? exchangeNairaAmount / rates[asset]
    : parsedExchangeAmount;
  const maxExchangeAmount = side === 'buy'
    ? (fiatCurrency === 'USD' ? exchangeNaira / nairaPerUsd : exchangeNaira)
    : selectedBalance;

  const loadDepositAddress = useCallback(async () => {
    setAddressLoading(true);
    setFormError('');
    if (moneyMovementLocked) {
      setDepositAddress(null);
      setFormError(securityState.freezeActive
        ? 'Freeze Account is active. Crypto deposits are blocked until the freeze is removed.'
        : 'Sleep Mode is active. Crypto deposits are blocked until Sleep Mode is deactivated.');
      setAddressLoading(false);
      return;
    }
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Your session has expired. Please sign in again.');
      const response = await fetch(`/api/crypto/deposit-address?asset=${asset}`, {
        headers: { accept: 'application/json', Authorization: `Bearer ${session.access_token}` },
      });
      const body = await response.json() as DepositAddress & { message?: string };
      if (!response.ok || !body.address) throw new Error(body.message ?? 'Could not load your deposit address');
      setDepositAddress(body);
    } catch (addressError) {
      setDepositAddress(null);
      setFormError(addressError instanceof Error ? addressError.message : 'Could not load your deposit address');
    } finally {
      setAddressLoading(false);
    }
  }, [asset, moneyMovementLocked, securityState.freezeActive]);

  useEffect(() => {
    if (view === 'receive') void loadDepositAddress();
  }, [view, loadDepositAddress]);

  const submitDeposit = async () => {
    if (moneyMovementLocked) return setFormError('Money movement is blocked by account security.');
    const enteredAmount = Number(depositAmount.replace(/,/g, ''));
    const amountInNaira = toNaira(enteredAmount);
    if (!enteredAmount || enteredAmount <= 0) return setFormError(`Enter a valid ${fiatLabel} amount`);
    setBusy(true); setFormError(''); setMessage('');
    const result = await depositToExchange(amountInNaira);
    setBusy(false);
    if (!result.success) return setFormError(result.error ?? 'Deposit failed');
    setDepositAmount(''); setMessage(`${displayFiat(amountInNaira)} moved into your exchange balance.`);
  };

  const submitExchange = async () => {
    if (moneyMovementLocked) return setFormError('Money movement is blocked by account security.');
    const enteredAmount = Number(exchangeAmount.replace(/,/g, ''));
    if (!enteredAmount || enteredAmount <= 0) {
      return setFormError(side === 'buy' ? `Enter a valid ${fiatLabel} amount` : `Enter a valid ${asset} amount`);
    }
    if (!livePricesReady) return setFormError('Live crypto rates are not available yet. Please try again shortly.');
    if (side === 'sell' && enteredAmount > selectedBalance) return setFormError(`Your ${asset} balance is too low`);
    const amountInNaira = side === 'buy' ? toNaira(enteredAmount) : enteredAmount * rates[asset];
    setBusy(true); setFormError(''); setMessage('');
    const result = await exchangeCrypto(asset, side, amountInNaira, rates[asset]);
    setBusy(false);
    if (!result.success) return setFormError(result.error ?? 'Exchange failed');
    setExchangeAmount('');
    setMessage(side === 'buy'
      ? `Bought ${(amountInNaira / rates[asset]).toLocaleString('en-NG', { maximumFractionDigits: 8 })} ${asset} for ${displayFiat(amountInNaira)}.`
      : `Sold ${crypto(enteredAmount)} ${asset} for ${formatFiat(amountInNaira, 'NGN', nairaPerUsd)}.`);
  };

  const submitTransfer = async () => {
    if (moneyMovementLocked) return setFormError('Money movement is blocked by account security.');
    const amount = Number(transferAmount);
    if (!recipient.trim()) return setFormError('Enter the recipient account number');
    if (!amount || amount <= 0) return setFormError('Enter a valid crypto amount');
    setBusy(true); setFormError(''); setMessage('');
    const result = await transferCrypto(recipient.trim(), asset, amount);
    setBusy(false);
    if (!result.success) return setFormError(result.error ?? 'Crypto transfer failed');
    setRecipient(''); setTransferAmount('');
    setMessage(`${crypto(amount)} ${asset} sent to ${result.recipientName ?? 'the Vexa user'}.`);
  };

  return (
    <div className="fixed inset-0 bg-[#F2F3F5] flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>
      <PageHeader
        title={view === 'overview' ? 'Vexa Exchange' : view === 'exchange' ? 'Exchange' : view === 'transfer' ? 'Crypto Transfer' : 'Receive Crypto'}
        onBack={() => navigate(view === 'overview' ? '/' : '/crypto')}
      />
      <div
        className={`flex-1 overflow-y-auto px-4 ${view === 'exchange' || view === 'transfer' ? 'py-3 space-y-3' : 'py-4 space-y-4'}`}
        style={{ scrollbarWidth: 'none' }}
      >
        {view === 'overview' ? (
          <div className="relative overflow-hidden rounded-[26px] bg-gradient-to-br from-[#0C193F] via-[#10234C] to-[#0D3F50] p-[18px] text-white shadow-[0_18px_40px_-22px_rgba(12,25,63,0.75)]">
            <div className="pointer-events-none absolute -right-12 -top-16 h-40 w-40 rounded-full bg-[#36D5D0]/15 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 left-20 h-32 w-48 rounded-full bg-[#2586B8]/15 blur-3xl" />
            <div className="relative">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[#72E6B5] shadow-[0_0_0_4px_rgba(114,230,181,0.12)]" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.17em] text-white/65">Vexa exchange</span>
                </div>
                <button
                  type="button"
                  onClick={() => setFiatCurrency(current => current === 'NGN' ? 'USD' : 'NGN')}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.08] text-[#8DE8F4] transition hover:bg-white/[0.15] active:scale-95"
                  aria-label={`Switch currency display to ${fiatCurrency === 'NGN' ? 'US dollars' : 'Naira'}`}
                  title={`Switch to ${fiatCurrency === 'NGN' ? 'USD' : 'NGN'}`}
                >
                  <ArrowLeftRight className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-3 flex items-end justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[10px] font-medium text-white/55">Available balance</p>
                  <p className="mt-0.5 truncate text-[30px] font-extrabold leading-none tracking-[-0.04em] tabular-nums">
                    {displayFiat(exchangeNaira)}
                  </p>
                </div>
                <p className="mb-0.5 shrink-0 rounded-full bg-white/[0.08] px-2.5 py-1 text-[9px] font-medium text-white/65">
                  Buy · sell · transfer
                </p>
              </div>

              <div className="mt-3 flex items-center gap-1.5 text-[10px] text-white/55">
                {lastUpdatedAt
                  ? <Check className="h-3 w-3 shrink-0 text-[#72E6B5]" />
                  : <RefreshCw className="h-3 w-3 shrink-0 animate-spin text-[#8DE8F4]" />}
                <span className="shrink-0">{lastUpdatedAt ? `Synced ${timeSince(lastUpdatedAt)}` : 'Syncing now'}</span>
                <span className="mx-1 h-0.5 w-0.5 shrink-0 rounded-full bg-white/35" />
                <span className="truncate">Crypto holdings</span>
                <b className="ml-auto shrink-0 text-[12px] font-bold text-white tabular-nums">{displayFiat(portfolioValue)}</b>
              </div>

              <div className="mt-3 grid grid-cols-3 overflow-hidden rounded-2xl border border-white/[0.09] bg-white/[0.055]">
                {(Object.keys(ASSET_META) as CryptoAsset[]).map((item, index) => (
                  <div
                    key={item}
                    className={`min-w-0 px-2.5 py-2.5 ${index > 0 ? 'border-l border-white/[0.09]' : ''}`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: ASSET_META[item].color }}>
                        <CryptoLogo asset={item} size={11} />
                      </span>
                      <span className="text-[10px] font-bold tracking-wide">{item}</span>
                    </div>
                    <p className="mt-1.5 truncate text-[10px] font-semibold tabular-nums">{displayFiat(rates[item])}</p>
                    <p className={`mt-0.5 text-[9px] font-medium ${priceChanges[item] >= 0 ? 'text-[#8FE8BB]' : 'text-[#FFB6B6]'}`}>
                      {signedPercent(priceChanges[item])}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-white/[0.10] pt-2.5">
                <div className="flex items-center gap-2 text-white/60">
                  <WalletCards className="h-3.5 w-3.5 text-[#8DE8F4]" />
                  <span className="text-[10px] font-medium">Vexa account</span>
                </div>
                <span className="text-[11px] font-semibold tracking-[0.06em] text-white/90">{user?.accountNumber ?? 'Set up account'}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl bg-[#0C193F] px-4 py-3.5 text-white flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-white/60">Exchange balance</p>
              <p className="mt-0.5 text-[18px] font-extrabold">{displayFiat(exchangeNaira)}</p>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full" style={{ backgroundColor: ASSET_META[asset].color }}>
                <CryptoLogo asset={asset} size={14} />
              </span>
              <div>
                <p className="text-[9px] text-white/60">Available</p>
                <p className="text-[11px] font-bold">{crypto(selectedBalance)} {asset}</p>
              </div>
            </div>
          </div>
        )}

        {view === 'overview' && (
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Exchange', path: '/crypto/exchange', icon: <ArrowLeftRight className="w-5 h-5" /> },
            { label: 'Transfer', path: '/crypto/transfer', icon: <Send className="w-5 h-5" /> },
            { label: 'Receive', path: '/crypto/receive', icon: <ArrowDownToLine className="w-5 h-5" /> },
          ].map(action => (
            <button key={action.path} onClick={() => navigate(action.path)}
              className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-white px-3 py-4 text-[#162353] shadow-sm transition-colors hover:bg-[#F8F9FB] active:scale-[0.98]">
              {action.icon}
              <span className="text-[11px] font-bold">{action.label}</span>
            </button>
          ))}
        </div>
        )}

         {error && <div className="rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3 text-[12px] text-amber-700">{error}. Run the latest supabase-schema.sql migration to enable exchange data.</div>}
         {priceError && <div className="rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3 text-[12px] text-amber-700">{priceError}</div>}
         {moneyMovementLocked && (
           <div className="rounded-2xl border border-[#F2C5C5] bg-[#FFF5F5] px-4 py-3 text-[12px] text-[#A33A3A]">
             <b>{securityState.freezeActive ? 'Freeze Account Active' : 'Sleep Mode Active'}.</b> Your exchange balance and crypto history remain readable, but deposits, trades, and transfers are blocked.
           </div>
         )}
         {formError && <div className="rounded-2xl bg-red-50 border border-red-200 px-4 py-3 text-[12px] text-red-600">{formError}</div>}
        {message && <div className="rounded-2xl bg-green-50 border border-green-200 px-4 py-3 text-[12px] text-green-700">{message}</div>}

        {view === 'overview' && (
          <>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[16px] font-bold text-[#111]">Your assets</p>
                 <p className="text-[11px] text-[#888] mt-0.5">Reference rates in {fiatCurrency === 'NGN' ? 'Naira' : 'US Dollars'}</p>
              </div>
              <button onClick={() => void refreshFinance()} className="text-[#2563EB] p-2" aria-label="Refresh exchange balance"><RefreshCw className="w-4 h-4" /></button>
            </div>
            <div className="space-y-2">
              {(Object.keys(ASSET_META) as CryptoAsset[]).map(item => {
                const meta = ASSET_META[item];
                const amount = cryptoBalances.find(balance => balance.asset === item)?.amount ?? 0;
                return (
                   <div key={item} className="bg-white rounded-2xl border border-[#F0F0F0] px-4 py-4 flex items-center gap-3">
                     <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: meta.color }}><CryptoLogo asset={item} size={22} /></div>
                    <div className="flex-1">
                      <p className="text-[14px] font-bold text-[#111]">{meta.name}</p>
                      <p className="text-[11px] text-[#888]">{amount ? crypto(amount) : '0'} {item} · {meta.description}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[13px] font-bold text-[#111]">{displayFiat(amount * rates[item])}</p>
                        <p className="text-[10px] text-[#999]">{displayFiat(rates[item])} / {item}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="bg-white rounded-2xl border border-[#F0F0F0] p-4">
                 <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-[#EAFBF4] flex items-center justify-center"><ArrowDownToLine className="w-4 h-4 text-[#159669]" /></div>
                 <div><p className="text-[13px] font-bold text-[#111]">Fund exchange wallet</p><p className="text-[11px] text-[#888]">Move funds from your Vexa balance</p></div>
              </div>
              <div className="flex items-center gap-2">
                 <input value={depositAmount} onChange={e => setDepositAmount(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" placeholder={`Amount in ${fiatLabel}`} className="flex-1 border border-[#E0E0E0] rounded-xl px-3 py-3 text-[13px] outline-none focus:border-[#162353]" />
                 <button disabled={busy || loading || moneyMovementLocked} onClick={() => void submitDeposit()} className="rounded-xl bg-[#162353] text-white text-[12px] font-bold px-4 py-3 disabled:opacity-50">{busy ? 'Working…' : 'Deposit'}</button>
              </div>
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between px-1">
                <p className="text-[11px] font-bold text-[#888] uppercase tracking-wide">Recent activity</p>
                <div className="flex gap-2">
                  <button onClick={() => navigate('/crypto/incoming')} className="text-[10px] font-bold text-[#159669]">Incoming</button>
                  <span className="text-[10px] text-[#D5D8DE]">·</span>
                  <button onClick={() => navigate('/crypto/outgoing')} className="text-[10px] font-bold text-[#2563EB]">Outgoing</button>
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-[#F0F0F0] overflow-hidden">
                {cryptoTransactions.length === 0 && <p className="px-4 py-5 text-[12px] text-[#888]">No exchange activity yet.</p>}
                {cryptoTransactions.slice(0, 5).map(item => (
                  <button key={item.id} onClick={() => setSelectedActivity(item)} className="w-full px-4 py-3 border-b border-[#F5F5F5] last:border-0 flex items-center gap-3 text-left hover:bg-[#FAFBFD] active:bg-[#F5F6F8]">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${item.kind === 'transfer_in' ? 'bg-green-50 text-green-600' : 'bg-[#EEF2FF] text-[#2563EB]'}`}>
                      {item.kind === 'transfer_out' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownToLine className="w-4 h-4" />}
                    </div>
                    <div className="flex-1"><p className="text-[12px] font-semibold text-[#222] capitalize">{item.kind.replace('_', ' ')}</p><p className="text-[10px] text-[#999]">{new Date(item.createdAt).toLocaleString('en-NG')}</p></div>
                    <p className="text-[12px] font-bold text-[#333]">{crypto(item.amount)} {item.asset}</p>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {view === 'exchange' && (
          <div className="space-y-3">
            <div className="pt-1">
              <p className="text-[16px] font-bold text-[#111]">Exchange Naira</p>
              <p className="text-[11px] text-[#888] mt-1">Buy crypto or sell it back to your exchange balance.</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(['buy', 'sell'] as const).map(item => (
                <button
                  key={item}
                  type="button"
                  onClick={() => { setSide(item); setExchangeAmount(''); setFormError(''); setMessage(''); }}
                  className={`py-3 rounded-xl text-[12px] font-bold capitalize transition-colors ${side === item ? 'bg-[#10535B] text-white' : 'bg-white/70 text-[#555]'}`}
                >
                  {item}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(ASSET_META) as CryptoAsset[]).map(item => (
                <button
                  key={item}
                  type="button"
                  onClick={() => { setAsset(item); setExchangeAmount(''); setFormError(''); setMessage(''); }}
                  className={`py-2.5 rounded-xl text-[12px] font-bold flex items-center justify-center gap-1.5 transition-colors ${asset === item ? 'bg-[#EAF2FF] text-[#1D4ED8]' : 'bg-white/70 text-[#555]'}`}
                >
                  <span className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: ASSET_META[item].color }}>
                    <CryptoLogo asset={item} size={12} />
                  </span>
                  {item}
                </button>
              ))}
            </div>
            <div className="rounded-xl bg-white/70 px-4 py-3 flex justify-between text-[12px]">
              <span className="text-[#777]">Live rate {priceUpdatedAt ? `· ${timeSince(priceUpdatedAt)}` : ''}</span>
              <b>{displayFiat(rates[asset])} / {asset}</b>
            </div>
            <div>
              <label htmlFor="exchange-amount" className="block text-[11px] font-bold text-[#555] mb-1.5">
                {side === 'buy' ? `Amount to spend (${fiatLabel})` : `Amount to sell (${asset})`}
              </label>
              <div className="flex items-center rounded-xl border border-[#B9C9CA] bg-white px-1.5 focus-within:border-[#10535B]">
                <input
                  id="exchange-amount"
                  value={exchangeAmount}
                  onChange={event => { setExchangeAmount(event.target.value.replace(/[^\d.]/g, '')); setFormError(''); }}
                  inputMode="decimal"
                  placeholder={side === 'buy' ? `Enter ${fiatLabel.toLowerCase()} amount` : `Enter ${asset} amount`}
                  className="min-w-0 flex-1 bg-transparent px-3 py-3 text-[14px] outline-none"
                />
                <button
                  type="button"
                  disabled={!maxExchangeAmount || busy}
                  onClick={() => {
                    setExchangeAmount(side === 'buy' ? maxExchangeAmount.toFixed(2) : String(maxExchangeAmount));
                    setFormError('');
                  }}
                  className="rounded-lg px-3 py-2 text-[11px] font-extrabold text-[#10535B] disabled:opacity-40"
                >
                  MAX
                </button>
              </div>
            </div>
            <div className="rounded-xl bg-white/70 px-4 py-3.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#858B96]">
                {side === 'buy' ? 'Estimated crypto to receive' : 'Estimated naira to receive'}
              </p>
              <p className="mt-1 text-[17px] font-extrabold text-[#111]">
                {!livePricesReady
                  ? 'Waiting for live rate…'
                  : !hasExchangeAmount
                    ? 'Enter an amount to see estimate'
                    : side === 'buy'
                      ? `${crypto(estimatedCryptoAmount)} ${asset}`
                      : formatFiat(exchangeNairaAmount, 'NGN', nairaPerUsd)}
              </p>
              {side === 'buy' && hasExchangeAmount && livePricesReady && (
                <p className="mt-1 text-[10px] text-[#858B96]">Approximately {formatFiat(exchangeNairaAmount, 'NGN', nairaPerUsd)} at the current rate.</p>
              )}
            </div>
          </div>
        )}

        {view === 'transfer' && (
          <div className="space-y-3">
            <div className="pt-1">
              <p className="text-[16px] font-bold text-[#111]">Send crypto to a Vexa user</p>
              <p className="text-[11px] text-[#888] mt-1">Transfers settle instantly to their exchange balance.</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(ASSET_META) as CryptoAsset[]).map(item => (
                <button
                  key={item}
                  type="button"
                  onClick={() => { setAsset(item); setTransferAmount(''); setFormError(''); setMessage(''); }}
                  className={`py-2.5 rounded-xl text-[12px] font-bold flex items-center justify-center gap-1.5 transition-colors ${asset === item ? 'bg-[#EAF2FF] text-[#1D4ED8]' : 'bg-white/70 text-[#555]'}`}
                >
                  <span className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: ASSET_META[item].color }}>
                    <CryptoLogo asset={item} size={12} />
                  </span>
                  {item}
                </button>
              ))}
            </div>
            <div>
              <label htmlFor="crypto-recipient" className="block text-[11px] font-bold text-[#555] mb-1.5">Recipient account number</label>
              <input
                id="crypto-recipient"
                value={recipient}
                onChange={event => { setRecipient(event.target.value.replace(/\D/g, '').slice(0, 10)); setFormError(''); }}
                inputMode="numeric"
                placeholder="10-digit Vexa account"
                className="w-full rounded-xl border border-[#B9C9CA] bg-white px-4 py-3 text-[14px] outline-none focus:border-[#10535B]"
              />
            </div>
            <div>
              <label htmlFor="crypto-transfer-amount" className="block text-[11px] font-bold text-[#555] mb-1.5">Amount ({asset})</label>
              <div className="flex items-center rounded-xl border border-[#B9C9CA] bg-white px-1.5 focus-within:border-[#10535B]">
                <input
                  id="crypto-transfer-amount"
                  value={transferAmount}
                  onChange={event => { setTransferAmount(event.target.value.replace(/[^\d.]/g, '')); setFormError(''); }}
                  inputMode="decimal"
                  placeholder={`Available: ${crypto(selectedBalance)} ${asset}`}
                  className="min-w-0 flex-1 bg-transparent px-3 py-3 text-[14px] outline-none"
                />
                <button
                  type="button"
                  disabled={!selectedBalance || busy}
                  onClick={() => { setTransferAmount(String(selectedBalance)); setFormError(''); }}
                  className="rounded-lg px-3 py-2 text-[11px] font-extrabold text-[#10535B] disabled:opacity-40"
                >
                  MAX
                </button>
              </div>
            </div>
          </div>
        )}

        {view === 'receive' && (
          <div className="bg-white rounded-2xl border border-[#F0F0F0] p-5 space-y-4">
            <div>
              <p className="text-[16px] font-bold text-[#111]">Receive crypto</p>
              <p className="text-[11px] text-[#888] mt-1">Send only the selected asset to this address. Your address is unique to your Vexa account.</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(ASSET_META) as CryptoAsset[]).map(item => (
                <button key={item} onClick={() => { setAsset(item); setDepositAddress(null); }} className={`py-2.5 rounded-xl text-[12px] font-bold flex items-center justify-center gap-1.5 ${asset === item ? 'bg-[#EAF2FF] text-[#1D4ED8] border border-[#BFD7FF]' : 'bg-[#F8F9FB] text-[#555]'}`}>
                  <span className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: ASSET_META[item].color }}><CryptoLogo asset={item} size={12} /></span>{item}
                </button>
              ))}
            </div>
            {addressLoading && <div className="rounded-2xl bg-[#F8F9FB] py-10 text-center text-[12px] text-[#777]">Creating your secure {asset} address…</div>}
            {depositAddress && !addressLoading && (
              <div className="rounded-2xl bg-[#F8F9FB] p-4 text-center">
                <div className="inline-flex rounded-2xl bg-white p-3 border border-[#E8EBF0]"><QRCodeSVG value={depositAddress.address} size={180} includeMargin /></div>
                <p className="text-[12px] font-bold text-[#111] mt-3">{depositAddress.network}</p>
                <p className="text-[10px] text-[#888] mt-1">Scan to receive {asset}</p>
                <div className="mt-3 flex items-center gap-2 rounded-xl bg-white border border-[#E8EBF0] px-3 py-2 text-left">
                  <p className="flex-1 break-all text-[11px] text-[#333] font-mono">{depositAddress.address}</p>
                  <button onClick={() => { void navigator.clipboard?.writeText(depositAddress.address); setMessage('Deposit address copied.'); }} className="shrink-0 p-2 text-[#2563EB]" aria-label="Copy deposit address"><Copy className="w-4 h-4" /></button>
                </div>
                <p className="text-[10px] text-amber-700 mt-3">Only send {asset} on the {depositAddress.network} network. Sending another asset or network may permanently lose funds.</p>
              </div>
            )}
          </div>
        )}
      </div>
      {(view === 'exchange' || view === 'transfer') && (
        <div
          className="flex-none bg-[#F2F3F5] px-4 pt-2"
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}
        >
          <button
            type="button"
            disabled={view === 'exchange'
              ? busy || !livePricesReady || moneyMovementLocked
              : busy || moneyMovementLocked}
            onClick={() => { if (view === 'exchange') void submitExchange(); else void submitTransfer(); }}
            className="w-full h-[52px] rounded-xl bg-[#10535B] text-white text-[13px] font-bold disabled:opacity-50 active:scale-[0.99] transition-transform"
          >
            {view === 'exchange'
              ? busy
                ? 'Processing…'
                : !livePricesReady
                  ? 'Waiting for live rate…'
                  : `${side === 'buy' ? 'Buy' : 'Sell'} ${asset}`
              : busy
                ? 'Sending…'
                : <span className="inline-flex items-center gap-2"><Send className="w-4 h-4" /> Send {asset}</span>}
          </button>
        </div>
      )}
       {selectedActivity && (
         <CryptoActivityDetails
           transaction={selectedActivity}
           currency={fiatCurrency}
           nairaPerUsd={nairaPerUsd}
           onClose={() => setSelectedActivity(null)}
         />
       )}
    </div>
  );
}