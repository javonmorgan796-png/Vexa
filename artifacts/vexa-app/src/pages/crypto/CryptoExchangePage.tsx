import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDownToLine, ArrowLeftRight, ArrowUpRight, ChevronRight, Copy, RefreshCw, Send, WalletCards } from 'lucide-react';
import { FaBitcoin, FaEthereum } from 'react-icons/fa6';
import { SiTether } from 'react-icons/si';
import type { IconType } from 'react-icons';
import { useLocation } from 'wouter';
import { useAuth } from '@/context/AuthContext';
import { useVexaFinance, type CryptoAsset } from '@/context/VexaFinanceContext';
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

function money(value: number) {
  return `₦${value.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

export default function CryptoExchangePage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { exchangeNaira, cryptoBalances, cryptoTransactions, loading, error, lastUpdatedAt, refreshFinance, depositToExchange, exchangeCrypto, transferCrypto } = useVexaFinance();
  const [rates, setRates] = useState<Record<CryptoAsset, number>>(FALLBACK_RATES);
  const [priceChanges, setPriceChanges] = useState<Record<CryptoAsset, number>>({ BTC: 0, ETH: 0, USDT: 0 });
  const [priceUpdatedAt, setPriceUpdatedAt] = useState<string | null>(null);
  const [priceError, setPriceError] = useState('');
  const [priceStale, setPriceStale] = useState(false);
  const [tab, setTab] = useState<'overview' | 'exchange' | 'transfer' | 'receive'>('overview');
  const [depositAmount, setDepositAmount] = useState('');
  const [asset, setAsset] = useState<CryptoAsset>('BTC');
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [exchangeAmount, setExchangeAmount] = useState('');
  const [recipient, setRecipient] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [formError, setFormError] = useState('');
  const [depositAddress, setDepositAddress] = useState<DepositAddress | null>(null);
  const [addressLoading, setAddressLoading] = useState(false);

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
  const livePricesReady = Boolean(priceUpdatedAt && !priceStale);

  const selectedBalance = useMemo(
    () => cryptoBalances.find(item => item.asset === asset)?.amount ?? 0,
    [asset, cryptoBalances],
  );

  const loadDepositAddress = useCallback(async () => {
    setAddressLoading(true);
    setFormError('');
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
  }, [asset]);

  useEffect(() => {
    if (tab === 'receive') void loadDepositAddress();
  }, [tab, loadDepositAddress]);

  const submitDeposit = async () => {
    const amount = Number(depositAmount.replace(/,/g, ''));
    if (!amount || amount <= 0) return setFormError('Enter a valid Naira amount');
    setBusy(true); setFormError(''); setMessage('');
    const result = await depositToExchange(amount);
    setBusy(false);
    if (!result.success) return setFormError(result.error ?? 'Deposit failed');
    setDepositAmount(''); setMessage(`${money(amount)} moved into your exchange balance.`);
  };

  const submitExchange = async () => {
    const amount = Number(exchangeAmount.replace(/,/g, ''));
    if (!amount || amount <= 0) return setFormError('Enter a valid Naira amount');
    if (!livePricesReady) return setFormError('Live crypto rates are not available yet. Please try again shortly.');
    if (side === 'sell' && amount > selectedBalance * rates[asset]) return setFormError(`Your ${asset} balance is too low`);
    setBusy(true); setFormError(''); setMessage('');
    const result = await exchangeCrypto(asset, side, amount, rates[asset]);
    setBusy(false);
    if (!result.success) return setFormError(result.error ?? 'Exchange failed');
    setExchangeAmount('');
    setMessage(`${side === 'buy' ? 'Bought' : 'Sold'} ${asset} successfully.`);
  };

  const submitTransfer = async () => {
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
      <PageHeader title="Vexa Exchange" onBack={() => navigate('/')} />
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4" style={{ scrollbarWidth: 'none' }}>
        <div className="rounded-3xl bg-[#0C193F] text-white p-5 relative overflow-hidden">
          <div className="absolute -right-10 -top-12 w-40 h-40 rounded-full bg-[#35C6FF]/20 blur-2xl" />
          <div className="relative">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-[11px] uppercase tracking-[0.18em]">Exchange balance</p>
            <p className="text-[28px] font-extrabold mt-1">{money(exchangeNaira)}</p>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-white/10 flex items-center justify-center">
                <ArrowLeftRight className="w-5 h-5 text-[#68D9FF]" />
              </div>
            </div>
            <p className="text-white/60 text-[11px] mt-2">Use your Vexa balance to buy, sell, and send supported assets.</p>
            <p className="text-white/50 text-[10px] mt-1">
              Live sync · Last updated {lastUpdatedAt ? timeSince(lastUpdatedAt) : 'updating…'}
            </p>
            <div className="mt-4 border-t border-white/10 pt-3">
              <div className="flex items-center justify-between">
                <span className="text-white/60 text-[10px]">Crypto holdings value</span>
                <b className="text-[13px]">{money(portfolioValue)}</b>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-3">
                {(Object.keys(ASSET_META) as CryptoAsset[]).map(item => (
                  <div key={item} className="rounded-xl bg-white/10 px-2 py-2">
                    <div className="flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: ASSET_META[item].color }}>
                        <CryptoLogo asset={item} size={11} />
                      </span>
                      <span className="text-[10px] font-bold">{item}</span>
                    </div>
                    <p className="text-[10px] font-bold mt-1 truncate">{money(rates[item])}</p>
                    <p className={`text-[9px] mt-0.5 ${priceChanges[item] >= 0 ? 'text-[#83F0B7]' : 'text-[#FF9A9A]'}`}>
                      {signedPercent(priceChanges[item])}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            <button onClick={() => setTab('overview')} className="mt-4 inline-flex items-center gap-2 text-[11px] font-semibold text-[#8BE3FF]">
              <WalletCards className="w-3.5 h-3.5" /> {user?.accountNumber ?? 'Vexa account'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2 bg-white rounded-2xl p-1 border border-[#ECEEF2]">
          {(['overview', 'exchange', 'transfer', 'receive'] as const).map(item => (
            <button key={item} onClick={() => { setTab(item); setMessage(''); setFormError(''); }}
              className={`rounded-xl py-2.5 text-[11px] font-bold capitalize transition-colors ${tab === item ? 'bg-[#162353] text-white' : 'text-[#777]'}`}>
               {item === 'receive' ? 'Receive' : item}
            </button>
          ))}
        </div>

         {error && <div className="rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3 text-[12px] text-amber-700">{error}. Run the latest supabase-schema.sql migration to enable exchange data.</div>}
         {priceError && <div className="rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3 text-[12px] text-amber-700">{priceError}</div>}
        {formError && <div className="rounded-2xl bg-red-50 border border-red-200 px-4 py-3 text-[12px] text-red-600">{formError}</div>}
        {message && <div className="rounded-2xl bg-green-50 border border-green-200 px-4 py-3 text-[12px] text-green-700">{message}</div>}

        {tab === 'overview' && (
          <>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[16px] font-bold text-[#111]">Your assets</p>
                <p className="text-[11px] text-[#888] mt-0.5">Reference rates in Naira</p>
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
                       <p className="text-[13px] font-bold text-[#111]">{money(amount * rates[item])}</p>
                       <p className="text-[10px] text-[#999]">₦{rates[item].toLocaleString('en-NG')} / {item}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="bg-white rounded-2xl border border-[#F0F0F0] p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-[#EAFBF4] flex items-center justify-center"><ArrowDownToLine className="w-4 h-4 text-[#159669]" /></div>
                <div><p className="text-[13px] font-bold text-[#111]">Fund exchange wallet</p><p className="text-[11px] text-[#888]">Move Naira from your Vexa balance</p></div>
              </div>
              <div className="flex items-center gap-2">
                <input value={depositAmount} onChange={e => setDepositAmount(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" placeholder="Amount in Naira" className="flex-1 border border-[#E0E0E0] rounded-xl px-3 py-3 text-[13px] outline-none focus:border-[#162353]" />
                <button disabled={busy || loading} onClick={() => void submitDeposit()} className="rounded-xl bg-[#162353] text-white text-[12px] font-bold px-4 py-3 disabled:opacity-50">{busy ? 'Working…' : 'Deposit'}</button>
              </div>
            </div>
            <div>
              <p className="text-[11px] font-bold text-[#888] uppercase tracking-wide mb-2">Recent activity</p>
              <div className="bg-white rounded-2xl border border-[#F0F0F0] overflow-hidden">
                {cryptoTransactions.length === 0 && <p className="px-4 py-5 text-[12px] text-[#888]">No exchange activity yet.</p>}
                {cryptoTransactions.slice(0, 5).map(item => (
                  <div key={item.id} className="px-4 py-3 border-b border-[#F5F5F5] last:border-0 flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${item.kind === 'transfer_in' ? 'bg-green-50 text-green-600' : 'bg-[#EEF2FF] text-[#2563EB]'}`}>
                      {item.kind === 'transfer_out' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownToLine className="w-4 h-4" />}
                    </div>
                    <div className="flex-1"><p className="text-[12px] font-semibold text-[#222] capitalize">{item.kind.replace('_', ' ')}</p><p className="text-[10px] text-[#999]">{new Date(item.createdAt).toLocaleString('en-NG')}</p></div>
                    <p className="text-[12px] font-bold text-[#333]">{crypto(item.amount)} {item.asset}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {tab === 'exchange' && (
          <div className="bg-white rounded-2xl border border-[#F0F0F0] p-5 space-y-4">
            <div>
              <p className="text-[16px] font-bold text-[#111]">Exchange Naira</p>
              <p className="text-[11px] text-[#888] mt-1">Use the current reference rate to buy or sell assets inside Vexa.</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(['buy', 'sell'] as const).map(item => <button key={item} onClick={() => setSide(item)} className={`py-3 rounded-xl text-[12px] font-bold capitalize ${side === item ? 'bg-[#162353] text-white' : 'bg-[#F5F6F8] text-[#555]'}`}>{item}</button>)}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(ASSET_META) as CryptoAsset[]).map(item => <button key={item} onClick={() => setAsset(item)} className={`py-2.5 rounded-xl text-[12px] font-bold flex items-center justify-center gap-1.5 ${asset === item ? 'bg-[#EAF2FF] text-[#1D4ED8] border border-[#BFD7FF]' : 'bg-[#F8F9FB] text-[#555]'}`}><span className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: ASSET_META[item].color }}><CryptoLogo asset={item} size={12} /></span>{item}</button>)}
            </div>
             <div className="rounded-xl bg-[#F8F9FB] px-4 py-3 flex justify-between text-[12px]"><span className="text-[#777]">Live rate {priceUpdatedAt ? `· ${timeSince(priceUpdatedAt)}` : ''}</span><b>{money(rates[asset])} / {asset}</b></div>
            <input value={exchangeAmount} onChange={e => setExchangeAmount(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" placeholder={side === 'buy' ? 'Naira amount' : `Naira value to sell (${crypto(selectedBalance)} ${asset} available)`} className="w-full border border-[#E0E0E0] rounded-xl px-4 py-3 text-[14px] outline-none focus:border-[#162353]" />
             <button disabled={busy || !livePricesReady} onClick={() => void submitExchange()} className="w-full rounded-xl bg-[#162353] text-white py-3.5 text-[13px] font-bold disabled:opacity-50">{busy ? 'Processing…' : !livePricesReady ? 'Waiting for live rate…' : `${side === 'buy' ? 'Buy' : 'Sell'} ${asset}`}</button>
          </div>
        )}

        {tab === 'transfer' && (
          <div className="bg-white rounded-2xl border border-[#F0F0F0] p-5 space-y-4">
            <div><p className="text-[16px] font-bold text-[#111]">Send crypto to a Vexa user</p><p className="text-[11px] text-[#888] mt-1">Transfers settle instantly to their Vexa exchange balance.</p></div>
            <div className="grid grid-cols-3 gap-2">{(Object.keys(ASSET_META) as CryptoAsset[]).map(item => <button key={item} onClick={() => setAsset(item)} className={`py-2.5 rounded-xl text-[12px] font-bold flex items-center justify-center gap-1.5 ${asset === item ? 'bg-[#EAF2FF] text-[#1D4ED8] border border-[#BFD7FF]' : 'bg-[#F8F9FB] text-[#555]'}`}><span className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: ASSET_META[item].color }}><CryptoLogo asset={item} size={12} /></span>{item}</button>)}</div>
            <div><label className="block text-[11px] font-bold text-[#555] mb-1.5">Recipient account number</label><input value={recipient} onChange={e => setRecipient(e.target.value.replace(/\D/g, '').slice(0, 10))} inputMode="numeric" placeholder="10-digit Vexa account" className="w-full border border-[#E0E0E0] rounded-xl px-4 py-3 text-[14px] outline-none focus:border-[#162353]" /></div>
            <div><label className="block text-[11px] font-bold text-[#555] mb-1.5">Amount ({asset})</label><input value={transferAmount} onChange={e => setTransferAmount(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" placeholder={`Available: ${crypto(selectedBalance)} ${asset}`} className="w-full border border-[#E0E0E0] rounded-xl px-4 py-3 text-[14px] outline-none focus:border-[#162353]" /></div>
            <button disabled={busy} onClick={() => void submitTransfer()} className="w-full rounded-xl bg-[#162353] text-white py-3.5 text-[13px] font-bold disabled:opacity-50"><span className="inline-flex items-center gap-2">{busy ? 'Sending…' : <><Send className="w-4 h-4" /> Send {asset}</>}</span></button>
          </div>
        )}

        {tab === 'receive' && (
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
    </div>
  );
}