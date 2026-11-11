import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownToLine, ArrowLeft, ArrowLeftRight, ArrowUpRight, Check, ChevronRight, Copy, RefreshCw, Send, WalletCards } from 'lucide-react';
import { useLocation } from 'wouter';
import { useAuth } from '@/context/AuthContext';
import { useAccountSecurity } from '@/context/AccountSecurityContext';
import { useVexaFinance, type CryptoAsset, type CryptoTransaction } from '@/context/VexaFinanceContext';
import { supabase } from '@/lib/supabase';
import { QRCodeSVG } from 'qrcode.react';
import {
  CRYPTO_ASSET_META as ASSET_META,
  CryptoActivityDetailsModal,
  CryptoAssetLogo as CryptoLogo,
  FALLBACK_CRYPTO_RATES as FALLBACK_RATES,
  formatCryptoAmount as crypto,
  formatCryptoFiat as formatFiat,
  type CryptoFiatCurrency as FiatCurrency,
} from '@/components/crypto/CryptoActivityDetailsModal';



function useCountUp(targetValue: number, durationMs = 2000) {
  const [animatedValue, setAnimatedValue] = useState(0);
  const currentValue = useRef(0);

  useEffect(() => {
    const target = Number.isFinite(targetValue) ? targetValue : 0;
    const start = currentValue.current;
    if (target === start) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      currentValue.current = target;
      setAnimatedValue(target);
      return;
    }

    let frameId = 0;
    let startTime: number | null = null;

    const animate = (timestamp: number) => {
      startTime ??= timestamp;
      const progress = Math.min((timestamp - startTime) / durationMs, 1);
      const easedProgress = progress < 0.5
        ? 4 * Math.pow(progress, 3)
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;
      const nextValue = start + (target - start) * easedProgress;
      currentValue.current = nextValue;
      setAnimatedValue(nextValue);

      if (progress < 1) {
        frameId = window.requestAnimationFrame(animate);
      } else {
        currentValue.current = target;
        setAnimatedValue(target);
      }
    };

    frameId = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frameId);
  }, [targetValue, durationMs]);

  return animatedValue;
}

function AnimatedFiatAmount({
  valueInNaira,
  currency,
  nairaPerUsd,
}: {
  valueInNaira: number;
  currency: FiatCurrency;
  nairaPerUsd: number;
}) {
  const animatedValue = useCountUp(valueInNaira);
  return <>{formatFiat(animatedValue, currency, nairaPerUsd)}</>;
}

function money(value: number) {
  return formatFiat(value, 'NGN');
}

function formatAmountInput(value: string) {
  const sanitized = value.replace(/,/g, '').replace(/[^\d.]/g, '');
  const decimalIndex = sanitized.indexOf('.');
  const integerPart = (decimalIndex === -1 ? sanitized : sanitized.slice(0, decimalIndex))
    .replace(/^0+(?=\d)/, '');
  const groupedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  if (decimalIndex === -1) return groupedInteger;
  const decimalPart = sanitized.slice(decimalIndex + 1).replace(/\./g, '');
  return `${groupedInteger}.${decimalPart}`;
}

function formattedAmountCaret(rawValue: string, rawPosition: number, formattedValue: string) {
  const meaningfulCharactersBefore = rawValue
    .slice(0, rawPosition)
    .replace(/,/g, '')
    .replace(/[^\d.]/g, '')
    .length;
  if (meaningfulCharactersBefore === 0) return 0;

  let seenCharacters = 0;
  for (let index = 0; index < formattedValue.length; index += 1) {
    if (/[\d.]/.test(formattedValue[index])) seenCharacters += 1;
    if (seenCharacters >= meaningfulCharactersBefore) return index + 1;
  }
  return formattedValue.length;
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

type DepositAddress = {
  asset: CryptoAsset;
  address: string;
  network: string;
  createdAt: string;
  provider?: 'tatum' | 'unconfigured';
  networkMode?: 'mainnet' | 'testnet';
  liveDepositEnabled?: boolean;
  directSyncEnabled?: boolean;
  subscriptionStatus?: string;
  subscriptionError?: string;
  missingConfig?: string[];
};
type CryptoPageView = 'overview' | 'exchange' | 'transfer' | 'receive' | 'fund';

export function generateDeterministicDepositAddress(userIdOrAccount: string, asset: CryptoAsset): DepositAddress {
  const seed = `${userIdOrAccount || 'vexa_customer'}:${asset}:vexa_custody_v1`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  const hexPart1 = Math.abs(hash).toString(16).padStart(8, '0');
  const hexPart2 = Math.abs(hash * 37 + 0x1234567).toString(16).padStart(8, '0');
  const hexPart3 = Math.abs(hash * 73 + 0x7654321).toString(16).padStart(8, '0');
  const fullHex = (hexPart1 + hexPart2 + hexPart3 + '92c50b4ecustodyvault').toLowerCase();

  if (asset === 'BTC') {
    return {
      asset: 'BTC',
      address: `bc1q${fullHex.slice(0, 38)}`,
      network: 'Bitcoin',
      createdAt: new Date().toISOString(),
    };
  }
  if (asset === 'ETH') {
    return {
      asset: 'ETH',
      address: `0x${fullHex.slice(0, 40)}`,
      network: 'Ethereum',
      createdAt: new Date().toISOString(),
    };
  }
  // USDT TRC-20
  const base58Chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let tronAddr = 'T';
  for (let i = 0; i < 33; i++) {
    const val = Math.abs((hash * (i + 13)) ^ (i * 31));
    tronAddr += base58Chars[val % base58Chars.length];
  }
  return {
    asset: 'USDT',
    address: tronAddr,
    network: 'Tron (TRC-20)',
    createdAt: new Date().toISOString(),
  };
}



function PageHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="theme-surface theme-text-primary theme-border flex-none flex items-center gap-3 px-4 pb-3 border-b"
      style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}>
      <button type="button" onClick={onBack} data-testid="button-go-back" className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-[#2B313A]" aria-label="Go back">
        <ArrowLeft className="h-5 w-5" aria-hidden="true" />
      </button>
      <span className="text-[16px] font-bold theme-text-primary">{title}</span>
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
  const userIdentifier = user?.id || user?.accountNumber || 'vexa_customer';
  const [depositAddress, setDepositAddress] = useState<DepositAddress>(() =>
    generateDeterministicDepositAddress(userIdentifier, 'BTC')
  );
  const [addressLoading, setAddressLoading] = useState(false);
  const [syncingDeposits, setSyncingDeposits] = useState(false);
  const [syncNotice, setSyncNotice] = useState('');
  const [selectedActivity, setSelectedActivity] = useState<CryptoTransaction | null>(null);

  const fetchPrices = useCallback(async () => {
    try {
      const response = await fetch('/api/crypto/prices', {
        headers: { accept: 'application/json' },
      });
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        // Dev server, proxy, or upstream returned non-JSON. Keep using reference rates without crashing.
        return;
      }
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
      setPriceError('');
    } catch (priceFetchError) {
      const msg = priceFetchError instanceof Error ? priceFetchError.message : '';
      // Filter out raw JSON syntax / HTML parse errors so users never see "<!doctype"
      if (msg.includes('<!doctype') || msg.includes('Unexpected token') || msg.includes('JSON')) {
        setPriceError('');
      } else {
        setPriceError(msg || 'Live crypto prices are unavailable');
      }
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

  const loadDepositAddress = useCallback(async (targetAsset: CryptoAsset = asset) => {
    setAddressLoading(true);
    setFormError('');

    const fallbackAddr = generateDeterministicDepositAddress(userIdentifier, targetAsset);
    setDepositAddress(prev => (prev?.asset === targetAsset ? prev : fallbackAddr));

    if (moneyMovementLocked) {
      setFormError(securityState.freezeActive
        ? 'Freeze Account is active. Crypto deposits are blocked until the freeze is removed.'
        : 'Sleep Mode is active. Crypto deposits are blocked until Sleep Mode is deactivated.');
      setAddressLoading(false);
      return;
    }

    try {
      // 1. Always query backend API first so Tatum wallet & webhook subscription are synced
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const headers: Record<string, string> = { accept: 'application/json' };
        if (session?.access_token) {
          headers.Authorization = `Bearer ${session.access_token}`;
        }

        const response = await fetch(`/api/crypto/deposit-address?asset=${targetAsset}&userId=${encodeURIComponent(user?.id || '')}`, { headers });
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const body = await response.json();
          if (body?.address) {
            setDepositAddress(body);
            setAddressLoading(false);
            return;
          }
        }
      } catch (apiErr) {
        console.warn('[Crypto] API address fetch note:', apiErr);
      }

      // 2. Fallback: read existing verified address from Supabase if API is temporarily unreachable
      if (user?.id) {
        try {
          const { data: directAddr } = await supabase
            .from('crypto_deposit_addresses')
            .select('asset, address, network, created_at, tatum_subscription_id, tatum_subscription_status')
            .eq('user_id', user.id)
            .eq('asset', targetAsset)
            .maybeSingle();

          if (directAddr?.address) {
            setDepositAddress({
              asset: directAddr.asset as CryptoAsset,
              address: directAddr.address,
              network: directAddr.network,
              createdAt: directAddr.created_at,
              provider: directAddr.tatum_subscription_id ? 'tatum' : 'unconfigured',
              liveDepositEnabled: directAddr.tatum_subscription_status === 'active',
              subscriptionStatus: directAddr.tatum_subscription_status,
            });
            setAddressLoading(false);
            return;
          }
        } catch (directErr) {
          console.warn('[Crypto] Direct Supabase check note:', directErr);
        }
      }

      // 3. Preview fallback when offline / unconfigured (do not write synthetic address to DB)
      setDepositAddress({ ...fallbackAddr, provider: 'unconfigured', liveDepositEnabled: false });
    } catch (addressError) {
      console.error('[Crypto] Deposit address error:', addressError);
      setDepositAddress({ ...fallbackAddr, provider: 'unconfigured', liveDepositEnabled: false });
    } finally {
      setAddressLoading(false);
    }
  }, [asset, moneyMovementLocked, securityState.freezeActive, user?.id, userIdentifier]);

  const syncDeposits = useCallback(async (targetAsset?: CryptoAsset, manual = false) => {
    if (moneyMovementLocked || !user?.id) return;
    setSyncingDeposits(true);
    if (manual) {
      setSyncNotice('');
      setFormError('');
      setMessage('');
    }
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      const response = await fetch('/api/crypto/sync-deposits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(targetAsset ? { asset: targetAsset } : {}),
      });
      if (!response.ok) {
        if (manual) {
          const errBody = await response.json().catch(() => null);
          setFormError(errBody?.message || 'Could not check blockchain deposits right now.');
        }
        return;
      }
      const result = (await response.json()) as {
        creditedCount?: number;
        pendingCount?: number;
        newlyCredited?: Array<{ asset: CryptoAsset; amount: string }>;
        pendingDeposits?: Array<{ asset: CryptoAsset; amount: string; confirmations: number; requiredConfirmations: number }>;
      };
      if ((result.creditedCount ?? 0) > 0) {
        const creditedSummary = (result.newlyCredited ?? [])
          .map(item => `${item.amount} ${item.asset}`)
          .join(', ');
        setMessage(`Deposit credited: ${creditedSummary} added to your Exchange wallet.`);
        setSyncNotice('');
        await refreshFinance();
      } else if ((result.pendingCount ?? 0) > 0 && result.pendingDeposits?.[0]) {
        const firstPending = result.pendingDeposits[0];
        setSyncNotice(
          `${firstPending.amount} ${firstPending.asset} detected (${firstPending.confirmations}/${firstPending.requiredConfirmations} confirmations). It will credit automatically once confirmed.`,
        );
      } else if (manual) {
        setSyncNotice(
          targetAsset
            ? `Checked blockchain for ${targetAsset} deposits — none detected on this address yet.`
            : 'Checked blockchain for BTC, ETH & USDT deposits — no new transactions detected yet.',
        );
      }
    } catch {
      if (manual) {
        setFormError('Could not check blockchain deposits right now.');
      }
    } finally {
      setSyncingDeposits(false);
    }
  }, [moneyMovementLocked, refreshFinance, user?.id]);

  useEffect(() => {
    if (view === 'receive') void loadDepositAddress(asset);
  }, [view, asset, loadDepositAddress]);

  useEffect(() => {
    if ((view === 'overview' || view === 'receive') && user?.id && !moneyMovementLocked) {
      const targetAsset = view === 'receive' ? asset : undefined;
      void syncDeposits(targetAsset, false);
      const timer = window.setInterval(() => {
        void syncDeposits(targetAsset, false);
      }, 20000);
      return () => window.clearInterval(timer);
    }
    return undefined;
  }, [asset, moneyMovementLocked, syncDeposits, user?.id, view]);

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
    <div className="theme-page fixed inset-0 bg-[#F2F3F5] flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>
      <PageHeader
        title={view === 'overview' ? 'Vexa Exchange' : view === 'exchange' ? 'Exchange' : view === 'transfer' ? 'Crypto Transfer' : view === 'fund' ? 'Fund exchange wallet' : 'Receive Crypto'}
        onBack={() => navigate(view === 'overview' ? '/' : '/crypto')}
      />
      <div
        className={`flex-1 overflow-y-auto px-4 ${view === 'exchange' || view === 'transfer' ? 'py-3 space-y-3' : view === 'fund' ? 'py-5 space-y-4' : 'py-4 space-y-4'}`}
        style={{ scrollbarWidth: 'none' }}
      >
        {view === 'overview' ? (
          <div className="relative overflow-hidden rounded-[24px] bg-[#181A20] border border-[#2B313A] p-[18px] text-[#EAECEF] shadow-lg">
            <div className="pointer-events-none absolute -right-12 -top-16 h-40 w-40 rounded-full bg-[#F0B90B]/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 left-20 h-32 w-48 rounded-full bg-[#F0B90B]/5 blur-3xl" />
            <div className="relative">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[#0ECB81] shadow-[0_0_0_4px_rgba(14,203,129,0.14)]" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.17em] text-[#848E9C]">Vexa exchange</span>
                </div>
                <button
                  type="button"
                  onClick={() => setFiatCurrency(current => current === 'NGN' ? 'USD' : 'NGN')}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#2B313A] bg-[#2B313A]/80 text-[#F0B90B] transition hover:bg-[#363D47] active:scale-95"
                  aria-label={`Switch currency display to ${fiatCurrency === 'NGN' ? 'US dollars' : 'Naira'}`}
                  title={`Switch to ${fiatCurrency === 'NGN' ? 'USD' : 'NGN'}`}
                >
                  <ArrowLeftRight className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-3 flex items-end justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[10px] font-medium text-[#848E9C]">Available balance</p>
                  <p className="mt-0.5 truncate text-[30px] font-extrabold leading-none tracking-[-0.04em] text-white tabular-nums">
                    <AnimatedFiatAmount valueInNaira={exchangeNaira} currency={fiatCurrency} nairaPerUsd={nairaPerUsd} />
                  </p>
                </div>
                <p className="mb-0.5 shrink-0 text-[10px] font-medium text-[#848E9C]">
                  Buy · sell · transfer
                </p>
              </div>

              <div className="mt-3 flex items-center gap-1.5 text-[10px] text-[#848E9C]">
                {lastUpdatedAt
                  ? <Check className="h-3 w-3 shrink-0 text-[#0ECB81]" />
                  : <RefreshCw className="h-3 w-3 shrink-0 animate-spin text-[#F0B90B]" />}
                <span className="shrink-0">{lastUpdatedAt ? `Synced ${timeSince(lastUpdatedAt)}` : 'Syncing now'}</span>
                <span className="mx-1 h-0.5 w-0.5 shrink-0 rounded-full bg-[#848E9C]/50" />
                <span className="truncate">Crypto holdings</span>
                <b className="ml-auto shrink-0 text-[12px] font-bold text-[#EAECEF] tabular-nums">
                  <AnimatedFiatAmount valueInNaira={portfolioValue} currency={fiatCurrency} nairaPerUsd={nairaPerUsd} />
                </b>
              </div>

              <div className="mt-3 grid grid-cols-3 overflow-hidden rounded-2xl border border-[#2B313A] bg-[#1E2329]">
                {(Object.keys(ASSET_META) as CryptoAsset[]).map((item, index) => (
                  <div
                    key={item}
                    className={`min-w-0 px-2.5 py-2.5 ${index > 0 ? 'border-l border-[#2B313A]' : ''}`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: ASSET_META[item].color }}>
                        <CryptoLogo asset={item} size={11} />
                      </span>
                      <span className="text-[10px] font-bold tracking-wide text-[#EAECEF]">{item}</span>
                    </div>
                    <p className="mt-1.5 truncate text-[10px] font-semibold text-[#EAECEF] tabular-nums">{displayFiat(rates[item])}</p>
                    <p className={`mt-0.5 text-[9px] font-semibold tabular-nums ${priceChanges[item] >= 0 ? 'text-[#0ECB81]' : 'text-[#F6465D]'}`}>
                      {signedPercent(priceChanges[item])}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-[#2B313A] pt-2.5">
                <div className="flex items-center gap-2 text-[#848E9C]">
                  <WalletCards className="h-3.5 w-3.5 text-[#F0B90B]" />
                  <span className="text-[10px] font-medium">Vexa account</span>
                </div>
                <span className="text-[11px] font-mono font-semibold tracking-[0.06em] text-[#EAECEF]">{user?.accountNumber ?? 'Set up account'}</span>
              </div>
            </div>
          </div>
        ) : view !== 'fund' ? (
          <div className="rounded-2xl bg-[#181A20] border border-[#2B313A] px-4 py-3.5 text-[#EAECEF] flex items-center justify-between gap-3 shadow-sm">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-[#848E9C]">Exchange balance</p>
              <p className="mt-0.5 text-[18px] font-extrabold text-white tabular-nums">{displayFiat(exchangeNaira)}</p>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-[#2B313A] px-3 py-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full" style={{ backgroundColor: ASSET_META[asset].color }}>
                <CryptoLogo asset={asset} size={14} />
              </span>
              <div>
                <p className="text-[9px] text-[#848E9C]">Available</p>
                <p className="text-[11px] font-bold text-[#EAECEF] tabular-nums">{crypto(selectedBalance)} {asset}</p>
              </div>
            </div>
          </div>
        ) : null}

        {view === 'overview' && (
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Exchange', path: '/crypto/exchange', icon: <ArrowLeftRight className="w-5 h-5" /> },
            { label: 'Transfer', path: '/crypto/transfer', icon: <Send className="w-5 h-5" /> },
            { label: 'Receive', path: '/crypto/receive', icon: <ArrowDownToLine className="w-5 h-5" /> },
          ].map(action => (
            <button key={action.path} onClick={() => navigate(action.path)}
              className="theme-surface theme-border theme-text-primary flex flex-col items-center justify-center gap-2 rounded-2xl border px-3 py-4 shadow-sm transition-colors hover:bg-[#F8F9FB] dark:hover:bg-[#1E2329] active:scale-[0.98]">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F0B90B]/15 text-[#B7791F] dark:text-[#F0B90B]">
                {action.icon}
              </span>
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
         {formError && !formError.includes('Unexpected token') && !formError.includes('<!doctype') && (
           <div className="rounded-2xl bg-red-50 border border-red-200 px-4 py-3 text-[12px] text-red-600">{formError}</div>
         )}
        {message && <div className="rounded-2xl bg-green-50 border border-green-200 px-4 py-3 text-[12px] text-green-700">{message}</div>}

        {view === 'overview' && (
          <>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[16px] font-bold theme-text-primary">Your assets</p>
                 <p className="text-[11px] theme-text-secondary mt-0.5">Reference rates in {fiatCurrency === 'NGN' ? 'Naira' : 'US Dollars'}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  void refreshFinance();
                  void syncDeposits(undefined, false);
                }}
                className="text-[#B7791F] dark:text-[#F0B90B] p-2.5 rounded-full hover:bg-black/5 dark:hover:bg-[#2B313A]"
                aria-label="Refresh exchange balance"
              >
                <RefreshCw className={`w-4 h-4 ${syncingDeposits ? 'animate-spin' : ''}`} />
              </button>
            </div>
            <div className="space-y-2">
              {(Object.keys(ASSET_META) as CryptoAsset[]).map(item => {
                const meta = ASSET_META[item];
                const amount = cryptoBalances.find(balance => balance.asset === item)?.amount ?? 0;
                return (
                   <div key={item} className="theme-surface theme-border rounded-2xl border px-4 py-4 flex items-center gap-3">
                     <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: meta.color }}><CryptoLogo asset={item} size={22} /></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-bold theme-text-primary">{meta.name}</p>
                      <p className="text-[11px] theme-text-secondary tabular-nums">{amount ? crypto(amount) : '0'} {item} · {meta.description}</p>
                    </div>
                    <div className="text-right shrink-0">
                        <p className="text-[13px] font-bold theme-text-primary tabular-nums">{displayFiat(amount * rates[item])}</p>
                        <p className="text-[10px] theme-text-secondary tabular-nums">{displayFiat(rates[item])} / {item}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => navigate('/crypto/fund')}
              data-testid="button-open-fund-exchange"
              className="theme-surface theme-border theme-text-primary flex w-full items-center gap-3 rounded-2xl border p-4 text-left shadow-sm transition active:scale-[0.99]"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EAFBF4] dark:bg-[#15352D]">
                <span role="img" aria-label="Nigeria flag" className="text-[21px] leading-none">🇳🇬</span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-bold">Fund exchange wallet</span>
                <span className="theme-text-secondary mt-0.5 block text-[11px]">Move funds from your Vexa balance</span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-[#8B929D]" aria-hidden="true" />
            </button>
            <div>
              <div className="mb-2 flex items-center justify-between px-1">
                <p className="text-[11px] font-bold theme-text-secondary uppercase tracking-wide">Recent activity</p>
                <div className="flex gap-2">
                  <button onClick={() => navigate('/crypto/incoming')} className="text-[10px] font-bold text-[#059669] dark:text-[#0ECB81]">Incoming</button>
                  <span className="text-[10px] text-[#D5D8DE] dark:text-[#2B313A]">·</span>
                  <button onClick={() => navigate('/crypto/outgoing')} className="text-[10px] font-bold text-[#B7791F] dark:text-[#F0B90B]">Outgoing</button>
                </div>
              </div>
              <div className="theme-surface theme-border rounded-2xl border overflow-hidden divide-y divide-[#F0F1F4] dark:divide-[#2B313A]">
                {cryptoTransactions.length === 0 && <p className="px-4 py-5 text-[12px] theme-text-secondary">No exchange activity yet.</p>}
                {cryptoTransactions.slice(0, 5).map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedActivity(item)}
                    className="w-full px-4 py-3 flex items-center gap-3 text-left transition-colors hover:bg-[#FAFBFD] dark:hover:bg-[#1E2329] active:bg-[#F5F6F8] dark:active:bg-[#232933]"
                  >
                    <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center ${item.kind === 'transfer_in' || item.kind === 'deposit' ? 'bg-green-50 text-green-600 dark:bg-[#15352D] dark:text-[#0ECB81]' : 'bg-[#F0B90B]/15 text-[#B7791F] dark:text-[#F0B90B]'}`}>
                      {item.kind === 'transfer_out' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownToLine className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-semibold theme-text-primary capitalize truncate">{item.kind.replace('_', ' ')}</p>
                      <p className="text-[10px] theme-text-secondary">{new Date(item.createdAt).toLocaleString('en-NG')}</p>
                    </div>
                    <p className="text-[12px] font-bold theme-text-primary tabular-nums shrink-0">{crypto(item.amount)} {item.asset}</p>
                    <ChevronRight className="h-4 w-4 shrink-0 text-[#C0C6D0] dark:text-[#5E6673]" aria-hidden="true" />
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {view === 'fund' && (
          <>
            <div className="relative overflow-hidden rounded-2xl bg-[#181A20] border border-[#2B313A] p-5 text-[#EAECEF] shadow-lg">
              <div className="pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full bg-[#F0B90B]/10 blur-3xl" />
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#848E9C]">Current exchange balance</p>
              <p data-testid="text-current-exchange-balance" className="mt-2 text-[28px] font-extrabold leading-tight tracking-[-0.03em] text-white tabular-nums">{displayFiat(exchangeNaira)}</p>
              <p className="mt-2 text-[11px] text-[#848E9C]">{lastUpdatedAt ? `Synced ${timeSince(lastUpdatedAt)}` : 'Syncing your balance'}</p>
            </div>

            <section className="theme-surface theme-border theme-text-primary rounded-2xl border p-4 shadow-sm">
              <div className="mb-5 flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EAFBF4] dark:bg-[#15352D]">
                  <span role="img" aria-label="Nigeria flag" className="text-[21px] leading-none">🇳🇬</span>
                </span>
                <div>
                  <h2 className="text-[15px] font-bold">Add money to exchange</h2>
                  <p className="theme-text-secondary mt-0.5 text-[11px]">Funds move from your Vexa balance.</p>
                </div>
              </div>

              <div className="mb-2 flex items-center justify-between gap-3">
                <label htmlFor="exchange-fund-amount" className="theme-text-secondary text-[11px] font-bold">Amount in {fiatLabel}</label>
                <button
                  type="button"
                  onClick={() => setFiatCurrency(current => current === 'NGN' ? 'USD' : 'NGN')}
                  data-testid="button-toggle-fund-currency"
                  aria-label={`Switch amount to ${fiatCurrency === 'NGN' ? 'US dollars' : 'Naira'}`}
                  className="text-[#B7791F] dark:text-[#F0B90B] rounded-lg px-2 py-1 text-[10px] font-bold"
                >
                  {fiatCurrency === 'NGN' ? '₦ NGN' : '$ USD'}
                </button>
              </div>
              <div className="theme-field theme-border flex items-center rounded-xl border px-3 focus-within:border-[#F0B90B]">
                <span className="theme-text-secondary pr-2 text-[14px] font-semibold">{fiatCurrency === 'NGN' ? '₦' : '$'}</span>
                <input
                  id="exchange-fund-amount"
                  data-testid="input-exchange-fund-amount"
                  value={depositAmount}
                  onChange={event => {
                    const input = event.currentTarget;
                    const rawValue = input.value;
                    const rawStart = input.selectionStart ?? rawValue.length;
                    const rawEnd = input.selectionEnd ?? rawStart;
                    const formattedValue = formatAmountInput(rawValue);
                    const formattedStart = formattedAmountCaret(rawValue, rawStart, formattedValue);
                    const formattedEnd = formattedAmountCaret(rawValue, rawEnd, formattedValue);
                    setDepositAmount(formattedValue);
                    setFormError('');
                    window.requestAnimationFrame(() => {
                      if (document.activeElement === input) input.setSelectionRange(formattedStart, formattedEnd);
                    });
                  }}
                  inputMode="decimal"
                  placeholder="0.00"
                  className="min-w-0 flex-1 bg-transparent py-3 text-[14px] outline-none placeholder:text-[var(--theme-secondary-text)]"
                />
              </div>
              <p className="theme-text-secondary mt-3 text-[10px] leading-relaxed">Your amount will be added to your exchange balance after it is taken from your Vexa balance.</p>
            </section>
          </>
        )}

        {view === 'exchange' && (
          <div className="space-y-3">
            <div className="pt-1">
              <p className="text-[16px] font-bold theme-text-primary">Exchange Naira</p>
              <p className="text-[11px] theme-text-secondary mt-1">Buy crypto or sell it back to your exchange balance.</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(['buy', 'sell'] as const).map(item => (
                <button
                  key={item}
                  type="button"
                  onClick={() => { setSide(item); setExchangeAmount(''); setFormError(''); setMessage(''); }}
                  className={`py-3 rounded-xl text-[12px] font-bold capitalize transition-colors ${side === item ? 'bg-[#F0B90B] text-[#181A20] shadow-xs' : 'theme-control theme-text-secondary'}`}
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
                  className={`py-2.5 rounded-xl text-[12px] font-bold flex items-center justify-center gap-1.5 transition-colors ${asset === item ? 'bg-[#181A20] text-[#F0B90B] dark:bg-[#3A2F12] dark:text-[#F0B90B] shadow-xs' : 'theme-control theme-text-secondary'}`}
                >
                  <span className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: ASSET_META[item].color }}>
                    <CryptoLogo asset={item} size={12} />
                  </span>
                  {item}
                </button>
              ))}
            </div>
            <div className="theme-surface-alt theme-border rounded-xl border px-4 py-3 flex justify-between text-[12px]">
              <span className="theme-text-secondary">Live rate {priceUpdatedAt ? `· ${timeSince(priceUpdatedAt)}` : ''}</span>
              <b className="theme-text-primary tabular-nums">{displayFiat(rates[asset])} / {asset}</b>
            </div>
            <div>
              <label htmlFor="exchange-amount" className="block text-[11px] font-bold theme-text-secondary mb-1.5">
                {side === 'buy' ? `Amount to spend (${fiatLabel})` : `Amount to sell (${asset})`}
              </label>
              <div className="theme-field theme-border flex items-center rounded-xl border px-1.5 focus-within:border-[#F0B90B]">
                <input
                  id="exchange-amount"
                  value={exchangeAmount}
                  onChange={event => { setExchangeAmount(event.target.value.replace(/[^\d.]/g, '')); setFormError(''); }}
                  inputMode="decimal"
                  placeholder={side === 'buy' ? `Enter ${fiatLabel.toLowerCase()} amount` : `Enter ${asset} amount`}
                  className="min-w-0 flex-1 bg-transparent px-3 py-3 text-[14px] outline-none placeholder:text-[var(--theme-secondary-text)]"
                />
                <button
                  type="button"
                  disabled={!maxExchangeAmount || busy}
                  onClick={() => {
                    setExchangeAmount(side === 'buy' ? maxExchangeAmount.toFixed(2) : String(maxExchangeAmount));
                    setFormError('');
                  }}
                  className="text-[#B7791F] dark:text-[#F0B90B] rounded-lg px-3 py-2 text-[11px] font-extrabold disabled:opacity-40"
                >
                  MAX
                </button>
              </div>
            </div>
            <div className="theme-surface-alt theme-border rounded-xl border px-4 py-3.5">
              <p className="theme-text-secondary text-[10px] font-semibold uppercase tracking-wide">
                {side === 'buy' ? 'Estimated crypto to receive' : 'Estimated naira to receive'}
              </p>
              <p className={`mt-1 font-extrabold tabular-nums ${
                !livePricesReady
                  ? 'text-[17px] theme-text-primary'
                  : !hasExchangeAmount
                    ? 'text-[14px] text-[#059669] dark:text-[#0ECB81]'
                    : 'text-[17px] text-[#059669] dark:text-[#0ECB81]'
              }`}>
                {!livePricesReady
                  ? 'Waiting for live rate…'
                  : !hasExchangeAmount
                    ? 'Enter an amount to see estimate'
                    : side === 'buy'
                      ? `${crypto(estimatedCryptoAmount)} ${asset}`
                      : formatFiat(exchangeNairaAmount, 'NGN', nairaPerUsd)}
              </p>
              {side === 'buy' && hasExchangeAmount && livePricesReady && (
                <p className="theme-text-secondary mt-1 text-[10px]">Approximately {formatFiat(exchangeNairaAmount, 'NGN', nairaPerUsd)} at the current rate.</p>
              )}
            </div>
          </div>
        )}

        {view === 'transfer' && (
          <div className="space-y-3">
            <div className="pt-1">
              <p className="text-[16px] font-bold theme-text-primary">Send crypto to a Vexa user</p>
              <p className="text-[11px] theme-text-secondary mt-1">Transfers settle instantly to their exchange balance.</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(ASSET_META) as CryptoAsset[]).map(item => (
                <button
                  key={item}
                  type="button"
                  onClick={() => { setAsset(item); setTransferAmount(''); setFormError(''); setMessage(''); }}
                  className={`py-2.5 rounded-xl text-[12px] font-bold flex items-center justify-center gap-1.5 transition-colors ${asset === item ? 'bg-[#181A20] text-[#F0B90B] dark:bg-[#3A2F12] dark:text-[#F0B90B] shadow-xs' : 'theme-control theme-text-secondary'}`}
                >
                  <span className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: ASSET_META[item].color }}>
                    <CryptoLogo asset={item} size={12} />
                  </span>
                  {item}
                </button>
              ))}
            </div>
            <div>
              <label htmlFor="crypto-recipient" className="block text-[11px] font-bold theme-text-secondary mb-1.5">Recipient account number</label>
              <input
                id="crypto-recipient"
                value={recipient}
                onChange={event => { setRecipient(event.target.value.replace(/\D/g, '').slice(0, 10)); setFormError(''); }}
                inputMode="numeric"
                placeholder="10-digit Vexa account"
                className="theme-field theme-border w-full rounded-xl border px-4 py-3 text-[14px] outline-none focus:border-[#F0B90B] placeholder:text-[var(--theme-secondary-text)]"
              />
            </div>
            <div>
              <label htmlFor="crypto-transfer-amount" className="block text-[11px] font-bold theme-text-secondary mb-1.5">Amount ({asset})</label>
              <div className="theme-field theme-border flex items-center rounded-xl border px-1.5 focus-within:border-[#F0B90B]">
                <input
                  id="crypto-transfer-amount"
                  value={transferAmount}
                  onChange={event => { setTransferAmount(event.target.value.replace(/[^\d.]/g, '')); setFormError(''); }}
                  inputMode="decimal"
                  placeholder={`Available: ${crypto(selectedBalance)} ${asset}`}
                  className="min-w-0 flex-1 bg-transparent px-3 py-3 text-[14px] outline-none placeholder:text-[var(--theme-secondary-text)]"
                />
                <button
                  type="button"
                  disabled={!selectedBalance || busy}
                  onClick={() => { setTransferAmount(String(selectedBalance)); setFormError(''); }}
                  className="text-[#B7791F] dark:text-[#F0B90B] rounded-lg px-3 py-2 text-[11px] font-extrabold disabled:opacity-40"
                >
                  MAX
                </button>
              </div>
            </div>
          </div>
        )}

        {view === 'receive' && (
          <div className="theme-surface theme-border rounded-2xl border p-5 space-y-4">
            <div>
              <p className="text-[16px] font-bold theme-text-primary">Receive crypto</p>
              <p className="text-[11px] theme-text-secondary mt-1">Send only the selected asset to this address. Your address is unique to your Vexa account.</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(ASSET_META) as CryptoAsset[]).map(item => (
                <button
                  key={item}
                  onClick={() => {
                    setAsset(item);
                    setDepositAddress(generateDeterministicDepositAddress(userIdentifier, item));
                    void loadDepositAddress(item);
                  }}
                  className={`py-2.5 rounded-xl text-[12px] font-bold flex items-center justify-center gap-1.5 transition-all ${
                    asset === item
                      ? 'bg-[#181A20] text-[#F0B90B] dark:bg-[#3A2F12] dark:text-[#F0B90B] shadow-xs'
                      : 'theme-control theme-text-secondary hover:bg-[#F0F2F6] dark:hover:bg-[#2B313A]'
                  }`}
                >
                  <span className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: ASSET_META[item].color }}>
                    <CryptoLogo asset={item} size={12} />
                  </span>
                  {item}
                </button>
              ))}
            </div>
            {depositAddress && (
              <div className="theme-surface-alt theme-border rounded-2xl border p-4 text-center">
                <div className="inline-flex rounded-2xl bg-white p-3 border border-[#E8EBF0] shadow-xs">
                  <QRCodeSVG value={depositAddress.address} size={180} includeMargin />
                </div>
                <div className="mt-3 flex items-center justify-center gap-2 flex-wrap">
                  <p className="text-[12px] font-bold theme-text-primary">{depositAddress.network}</p>
                  {depositAddress.networkMode === 'testnet' ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 dark:bg-[#362918] dark:text-[#FCD38A] px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-700/40">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      Testnet Mode
                    </span>
                  ) : depositAddress.liveDepositEnabled || depositAddress.directSyncEnabled ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#159669] bg-emerald-50 dark:bg-[#15352D] dark:text-[#0ECB81] px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/40">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#0ECB81]" />
                      Custody Vault
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 dark:bg-[#362918] dark:text-[#FCD38A] px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-700/40">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      Deposit Listener Inactive
                    </span>
                  )}
                </div>
                <p className="text-[10px] theme-text-secondary mt-1">Scan QR or copy address to receive {asset}</p>
                <div className="theme-surface theme-border mt-3 flex items-center gap-2 rounded-xl border px-3 py-2 text-left">
                  <p className="flex-1 break-all text-[11px] theme-text-primary font-mono select-all">{depositAddress.address}</p>
                  <button
                    onClick={() => {
                      void navigator.clipboard?.writeText(depositAddress.address);
                      setMessage(`${asset} deposit address copied to clipboard.`);
                    }}
                    className="shrink-0 p-2 text-[#B7791F] dark:text-[#F0B90B] hover:bg-black/5 dark:hover:bg-[#2B313A] rounded-lg transition-colors"
                    aria-label="Copy deposit address"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
                <button
                  type="button"
                  disabled={syncingDeposits || addressLoading || moneyMovementLocked}
                  onClick={() => void syncDeposits(asset, true)}
                  data-testid="button-check-deposit"
                  className="mt-3 w-full py-2.5 px-3 rounded-xl border theme-border theme-surface hover:bg-[#F5F7FA] dark:hover:bg-[#232933] text-[12px] font-bold theme-text-primary inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-[#B7791F] dark:text-[#F0B90B] ${syncingDeposits ? 'animate-spin' : ''}`} />
                  {syncingDeposits ? `Checking ${asset} blockchain…` : `Check for ${asset} Deposit`}
                </button>
                {syncNotice && (
                  <p className="mt-2.5 rounded-xl bg-blue-50 dark:bg-[#172636] border border-blue-200 dark:border-blue-800/40 px-3 py-2 text-left text-[11px] text-blue-800 dark:text-blue-200">
                    {syncNotice}
                  </p>
                )}
                {addressLoading && (
                  <p className="text-[10px] text-[#B7791F] dark:text-[#F0B90B] mt-2 font-medium">Syncing custody vault verification…</p>
                )}
                {!addressLoading && (!depositAddress.liveDepositEnabled || depositAddress.networkMode === 'testnet' || depositAddress.subscriptionError) && (
                  <div className="mt-3 rounded-xl bg-amber-50 dark:bg-[#362918] border border-amber-200 dark:border-amber-700/40 px-3 py-2.5 text-left text-[10.5px] text-amber-800 dark:text-[#FCD38A] leading-relaxed">
                    {depositAddress.networkMode === 'testnet' ? (
                      <>
                        <b>Testnet API Key Active:</b> Your server is using a Tatum Testnet key (<code>t-...</code>). Only Testnet coins (Bitcoin Testnet <code>tb1q...</code>, Ethereum Sepolia, Tron Shasta/Nile) can arrive here. Real mainnet coins sent from live exchanges will not appear until you switch <code>TATUM_API_KEY</code> to a Tatum Mainnet key.
                      </>
                    ) : !depositAddress.liveDepositEnabled ? (
                      <>
                        <b>Automatic webhook pending</b>
                        {depositAddress.missingConfig && depositAddress.missingConfig.length > 0
                          ? ` (missing server secrets: ${depositAddress.missingConfig.join(', ')}). `
                          : depositAddress.subscriptionError
                            ? ` (${depositAddress.subscriptionError}). `
                            : '. '}
                        {depositAddress.directSyncEnabled && 'Use "Check for Deposit" above after sending to verify and credit your deposit directly from the blockchain.'}
                      </>
                    ) : (
                      <>
                        <b>Webhook Sync Note:</b> {depositAddress.subscriptionError}
                      </>
                    )}
                  </div>
                )}
                <p className="text-[10px] text-amber-700 dark:text-[#FCD38A] mt-3 leading-relaxed">
                  Only send <b>{asset}</b> on the <b>{depositAddress.network}</b> network. Sending another asset or using an incorrect network may result in loss of funds.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
      {(view === 'exchange' || view === 'transfer' || view === 'fund') && (
        <div
          className="theme-page flex-none px-4 pt-2"
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}
        >
          <button
            type="button"
            disabled={view === 'exchange'
              ? busy || !livePricesReady || moneyMovementLocked
              : view === 'fund'
                ? busy || loading || moneyMovementLocked
                : busy || moneyMovementLocked}
            onClick={() => {
              if (view === 'exchange') void submitExchange();
              else if (view === 'transfer') void submitTransfer();
              else void submitDeposit();
            }}
            data-testid={view === 'fund' ? 'button-submit-exchange-fund' : `button-submit-${view}`}
            className="w-full h-[52px] rounded-xl bg-[#F0B90B] hover:bg-[#FCD535] active:bg-[#DDAA09] text-[#181A20] text-[14px] font-bold shadow-sm disabled:opacity-50 active:scale-[0.99] transition-all"
          >
            {view === 'fund'
              ? busy
                ? 'Processing…'
                : 'Deposit to exchange'
              : view === 'exchange'
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
         <CryptoActivityDetailsModal
           transaction={selectedActivity}
           currency={fiatCurrency}
           nairaPerUsd={nairaPerUsd}
           liveRates={rates}
           onClose={() => setSelectedActivity(null)}
         />
       )}
    </div>
  );
}