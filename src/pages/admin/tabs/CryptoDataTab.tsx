import React, { useState, useEffect } from 'react';
import { useAdmin } from '../AdminContext';
import { Naira } from '@/components/Naira';
import {
  Coins,
  TrendingUp,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  Search,
  ExternalLink,
  Shield,
  Wallet,
  Globe,
  Copy,
  Check,
  X,
  ChevronRight,
  Download,
  QrCode,
  Eye,
  CheckCircle2,
  Clock,
  Layers,
  ShoppingBag,
  SendHorizontal,
} from 'lucide-react';

type SubView = 'wallets' | 'deposits' | 'buys' | 'sells';
type WalletFilter = 'all' | 'with-addresses' | 'with-balance';

export const CryptoDataTab: React.FC = () => {
  const { fetchAdminApi, adminTheme } = useAdmin();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeSubView, setActiveSubView] = useState<SubView>('wallets');
  const [search, setSearch] = useState('');
  const [assetFilter, setAssetFilter] = useState('ALL');
  const [walletFilter, setWalletFilter] = useState<WalletFilter>('all');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [inspectUser, setInspectUser] = useState<any>(null);
  const [lastSynced, setLastSynced] = useState<Date>(new Date());

  const isDark = adminTheme === 'dark';

  const loadCryptoData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await fetchAdminApi('/api/admin/crypto');
      setData(res);
      setLastSynced(new Date());
    } catch (err) {
      console.error('Failed to load crypto data:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadCryptoData();
    const interval = setInterval(() => loadCryptoData(true), 8000);
    return () => clearInterval(interval);
  }, []);

  const copyToClipboard = (text: string, key: string) => {
    if (!text || text === '—') return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const metrics = data?.metrics || {
    totalTradingVolumeNaira: 0,
    totalCustodyNaira: 0,
    totalOrdersExecuted: 0,
    totalWalletsGenerated: 0,
    totalUsersCount: 0,
    totalBuyOrdersCount: 0,
    totalBuyVolumeNaira: 0,
    totalSellOrdersCount: 0,
    totalSellVolumeNaira: 0,
    totalDepositsCount: 0,
    totalDepositsVolumeNaira: 0,
    activeTradersCount: 0,
  };

  const exchangeRates = data?.exchangeRates || {
    usdtBuyRate: 1655.0,
    usdtSellRate: 1645.0,
    btcUsdRate: 96000.0,
    ethUsdRate: 3400.0,
    solUsdRate: 190.0,
    spreadPercentage: 0.85,
  };

  const custodyHoldings = data?.custodyHoldings || [];
  const userWallets: any[] = data?.userWallets || [];
  const deposits: any[] = data?.deposits || [];
  const buys: any[] = data?.buys || [];
  const sells: any[] = data?.sells || [];

  // Filtered customer wallets (defensive optional chaining to prevent any runtime TypeError)
  const filteredWallets = userWallets.filter((u) => {
    if (!u) return false;
    const nameStr = (u.name || '').toLowerCase();
    const phoneStr = String(u.phone || '');
    const accountStr = String(u.accountNumber || '');
    const emailStr = (u.email || '').toLowerCase();
    const btcAddr = (u.addresses?.btc || '').toLowerCase();
    const ethAddr = (u.addresses?.eth || '').toLowerCase();
    const usdtAddr = (u.addresses?.usdt || '').toLowerCase();
    const searchLower = search.trim().toLowerCase();

    const matchesSearch =
      !searchLower ||
      nameStr.includes(searchLower) ||
      phoneStr.includes(searchLower) ||
      accountStr.includes(searchLower) ||
      emailStr.includes(searchLower) ||
      btcAddr.includes(searchLower) ||
      ethAddr.includes(searchLower) ||
      usdtAddr.includes(searchLower);

    const hasAddresses = Boolean(u.addresses?.btc || u.addresses?.eth || u.addresses?.usdt);
    const btcBal = Number(u.balances?.btc) || 0;
    const ethBal = Number(u.balances?.eth) || 0;
    const usdtBal = Number(u.balances?.usdt) || 0;
    const hasBalance = btcBal > 0 || ethBal > 0 || usdtBal > 0;

    if (walletFilter === 'with-addresses') return matchesSearch && hasAddresses;
    if (walletFilter === 'with-balance') return matchesSearch && hasBalance;
    return matchesSearch;
  });

  // Filtered deposits
  const filteredDeposits = deposits.filter((d) => {
    if (!d) return false;
    const matchesAsset = assetFilter === 'ALL' || d.asset === assetFilter;
    const searchLower = search.trim().toLowerCase();
    const userName = (d.userName || '').toLowerCase();
    const userPhone = String(d.userPhone || '');
    const txHash = (d.txHash || '').toLowerCase();
    const address = (d.address || '').toLowerCase();

    const matchesSearch =
      !searchLower ||
      userName.includes(searchLower) ||
      userPhone.includes(searchLower) ||
      txHash.includes(searchLower) ||
      address.includes(searchLower);
    return matchesAsset && matchesSearch;
  });

  // Filtered buys
  const filteredBuys = buys.filter((b) => {
    if (!b) return false;
    const matchesAsset = assetFilter === 'ALL' || b.asset === assetFilter;
    const searchLower = search.trim().toLowerCase();
    const userName = (b.userName || '').toLowerCase();
    const userPhone = String(b.userPhone || '');
    const txHash = (b.txHash || '').toLowerCase();

    const matchesSearch =
      !searchLower ||
      userName.includes(searchLower) ||
      userPhone.includes(searchLower) ||
      txHash.includes(searchLower);
    return matchesAsset && matchesSearch;
  });

  // Filtered sells
  const filteredSells = sells.filter((s) => {
    if (!s) return false;
    const matchesAsset = assetFilter === 'ALL' || s.asset === assetFilter;
    const searchLower = search.trim().toLowerCase();
    const userName = (s.userName || '').toLowerCase();
    const userPhone = String(s.userPhone || '');
    const txHash = (s.txHash || '').toLowerCase();

    const matchesSearch =
      !searchLower ||
      userName.includes(searchLower) ||
      userPhone.includes(searchLower) ||
      txHash.includes(searchLower);
    return matchesAsset && matchesSearch;
  });

  const exportCsv = (filename: string, rows: any[]) => {
    if (!rows.length) return;
    const headers = Object.keys(rows[0]).join(',');
    const csvContent = [headers, ...rows.map((r) => Object.values(r).map((val) => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getExplorerUrl = (asset: string, hashOrAddress: string) => {
    if (!hashOrAddress || hashOrAddress.length < 10) return null;
    if (asset === 'BTC') return `https://mempool.space/tx/${hashOrAddress}`;
    if (asset === 'ETH') return `https://etherscan.io/tx/${hashOrAddress}`;
    if (asset === 'USDT') return `https://tronscan.org/#/transaction/${hashOrAddress}`;
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-semibold tracking-wider uppercase text-emerald-500 font-mono">
              Live Crypto Gateway · Synced {lastSynced.toLocaleTimeString()}
            </span>
          </div>
          <h1 className={`text-xl font-bold tracking-tight mt-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Crypto Exchange Data & Customer Custody Vaults
          </h1>
          <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
            Independent management of customer on-chain deposit addresses, crypto balances, buy orders, sell liquidations, and blockchain inflows.
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={() => loadCryptoData(false)}
            disabled={loading}
            className={`px-3.5 py-2 border rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors ${
              isDark
                ? 'bg-gray-800 hover:bg-gray-700 text-gray-200 border-gray-700'
                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300 shadow-xs'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Sync Live Ledgers</span>
          </button>
        </div>
      </div>

      {/* Live Market Oracle Ticker Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className={`p-3.5 rounded-xl border ${isDark ? 'bg-gray-900/50 border-gray-800' : 'bg-white border-slate-200 shadow-xs'}`}>
          <div className={`text-[10px] font-mono uppercase ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>USDT / NGN OTC Spread</div>
          <div className="text-base font-bold text-[#F0B90B] font-mono mt-0.5 flex items-center">
            <Naira />{exchangeRates.usdtBuyRate} / <Naira />{exchangeRates.usdtSellRate}
          </div>
          <div className="text-[10px] text-emerald-500 mt-0.5 font-semibold">Spread: {exchangeRates.spreadPercentage}%</div>
        </div>

        <div className={`p-3.5 rounded-xl border ${isDark ? 'bg-gray-900/50 border-gray-800' : 'bg-white border-slate-200 shadow-xs'}`}>
          <div className={`text-[10px] font-mono uppercase ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>Bitcoin (BTC) Index</div>
          <div className={`text-base font-bold font-mono mt-0.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            ${exchangeRates.btcUsdRate.toLocaleString()}
          </div>
          <div className={`text-[10px] mt-0.5 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>Spot Price Oracle</div>
        </div>

        <div className={`p-3.5 rounded-xl border ${isDark ? 'bg-gray-900/50 border-gray-800' : 'bg-white border-slate-200 shadow-xs'}`}>
          <div className={`text-[10px] font-mono uppercase ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>Ethereum (ETH) Index</div>
          <div className={`text-base font-bold font-mono mt-0.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            ${exchangeRates.ethUsdRate.toLocaleString()}
          </div>
          <div className={`text-[10px] mt-0.5 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>ERC-20 Settlement</div>
        </div>

        <div className={`p-3.5 rounded-xl border ${isDark ? 'bg-gray-900/50 border-gray-800' : 'bg-white border-slate-200 shadow-xs'}`}>
          <div className={`text-[10px] font-mono uppercase ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>Total Custody Holding</div>
          <div className="text-base font-bold text-emerald-500 font-mono mt-0.5 flex items-center">
            <Naira />{Number(metrics.totalCustodyNaira).toLocaleString()}
          </div>
          <div className={`text-[10px] mt-0.5 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
            {metrics.totalWalletsGenerated} Assigned Wallets
          </div>
        </div>
      </div>

      {/* 4 Dedicated Sub-Pages / Navigation Tabs */}
      <div className={`p-1.5 rounded-2xl border flex flex-wrap gap-1.5 ${isDark ? 'bg-[#12151D] border-gray-800' : 'bg-slate-100 border-slate-200'}`}>
        <button
          onClick={() => { setActiveSubView('wallets'); setSearch(''); }}
          className={`flex-1 min-w-[170px] py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center space-x-2 transition-all ${
            activeSubView === 'wallets'
              ? 'bg-[#F0B90B] text-black shadow-sm'
              : isDark
              ? 'text-gray-400 hover:text-white hover:bg-gray-800/60'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <Wallet className="w-4 h-4" />
          <span>Customer Wallets & Balances</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono ${activeSubView === 'wallets' ? 'bg-black/15 text-black' : isDark ? 'bg-gray-800 text-gray-400' : 'bg-slate-200 text-slate-700'}`}>
            {userWallets.length}
          </span>
        </button>

        <button
          onClick={() => { setActiveSubView('deposits'); setSearch(''); }}
          className={`flex-1 min-w-[170px] py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center space-x-2 transition-all ${
            activeSubView === 'deposits'
              ? 'bg-[#F0B90B] text-black shadow-sm'
              : isDark
              ? 'text-gray-400 hover:text-white hover:bg-gray-800/60'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <ArrowDownLeft className="w-4 h-4" />
          <span>Deposit Transactions</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono ${activeSubView === 'deposits' ? 'bg-black/15 text-black' : isDark ? 'bg-gray-800 text-gray-400' : 'bg-slate-200 text-slate-700'}`}>
            {deposits.length}
          </span>
        </button>

        <button
          onClick={() => { setActiveSubView('buys'); setSearch(''); }}
          className={`flex-1 min-w-[170px] py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center space-x-2 transition-all ${
            activeSubView === 'buys'
              ? 'bg-[#F0B90B] text-black shadow-sm'
              : isDark
              ? 'text-gray-400 hover:text-white hover:bg-gray-800/60'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <ShoppingBag className="w-4 h-4" />
          <span>Buy Orders</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono ${activeSubView === 'buys' ? 'bg-black/15 text-black' : isDark ? 'bg-gray-800 text-gray-400' : 'bg-slate-200 text-slate-700'}`}>
            {buys.length}
          </span>
        </button>

        <button
          onClick={() => { setActiveSubView('sells'); setSearch(''); }}
          className={`flex-1 min-w-[170px] py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center space-x-2 transition-all ${
            activeSubView === 'sells'
              ? 'bg-[#F0B90B] text-black shadow-sm'
              : isDark
              ? 'text-gray-400 hover:text-white hover:bg-gray-800/60'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <SendHorizontal className="w-4 h-4" />
          <span>Sell Orders</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono ${activeSubView === 'sells' ? 'bg-black/15 text-black' : isDark ? 'bg-gray-800 text-gray-400' : 'bg-slate-200 text-slate-700'}`}>
            {sells.length}
          </span>
        </button>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* SUB-PAGE 1: CUSTOMER CUSTODY WALLETS & BALANCES               */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeSubView === 'wallets' && (
        <div className="space-y-4">
          {/* Sub-page Controls & Action Bar */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            {/* Filter Pills */}
            <div className={`flex items-center space-x-1 p-1 rounded-xl border text-xs ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-slate-100 border-slate-200'}`}>
              <button
                onClick={() => setWalletFilter('all')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  walletFilter === 'all'
                    ? 'bg-[#F0B90B] text-black font-bold shadow-xs'
                    : isDark ? 'text-gray-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Users ({userWallets.length})
              </button>
              <button
                onClick={() => setWalletFilter('with-addresses')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  walletFilter === 'with-addresses'
                    ? 'bg-[#F0B90B] text-black font-bold shadow-xs'
                    : isDark ? 'text-gray-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                With Deposit Addresses ({userWallets.filter((u) => u.hasDepositAddress).length})
              </button>
              <button
                onClick={() => setWalletFilter('with-balance')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  walletFilter === 'with-balance'
                    ? 'bg-[#F0B90B] text-black font-bold shadow-xs'
                    : isDark ? 'text-gray-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                With Crypto Balances ({userWallets.filter((u) => ((Number(u?.balances?.btc) || 0) > 0 || (Number(u?.balances?.eth) || 0) > 0 || (Number(u?.balances?.usdt) || 0) > 0)).length})
              </button>
            </div>

            {/* Actions: Search & Export */}
            <div className="flex items-center space-x-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search user, phone, wallet..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className={`pl-8 pr-3 py-1.5 rounded-xl border text-xs outline-none transition-colors w-64 ${
                    isDark
                      ? 'bg-gray-900 border-gray-800 text-white focus:border-[#F0B90B]'
                      : 'bg-white border-slate-300 text-slate-900 focus:border-[#F0B90B] shadow-xs'
                  }`}
                />
              </div>

              <button
                onClick={() => exportCsv('vexa-customer-crypto-wallets', userWallets.map((u) => ({
                  UserId: u?.userId || '',
                  Name: u?.name || 'Customer',
                  Phone: u?.phone || '',
                  AccountNumber: u?.accountNumber || '',
                  NairaBalance: u?.nairaBalance ?? 0,
                  BtcAddress: u?.addresses?.btc || 'N/A',
                  BtcBalance: u?.balances?.btc ?? 0,
                  EthAddress: u?.addresses?.eth || 'N/A',
                  EthBalance: u?.balances?.eth ?? 0,
                  UsdtAddress: u?.addresses?.usdt || 'N/A',
                  UsdtBalance: u?.balances?.usdt ?? 0,
                  EstimatedCryptoNaira: u?.cryptoEstimatedNaira ?? 0,
                  TotalNetWorthNaira: u?.totalNetWorthNaira ?? 0,
                })))}
                className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center space-x-1.5 transition-colors ${
                  isDark
                    ? 'bg-gray-800 hover:bg-gray-700 text-gray-200 border-gray-700'
                    : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300 shadow-xs'
                }`}
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          {/* Wallets Table */}
          <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-[#161A23] border-gray-800' : 'bg-white border-slate-200 shadow-sm'}`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className={`border-b ${isDark ? 'border-gray-800 bg-[#12151D] text-gray-400' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                    <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono">User / Customer</th>
                    <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono">Assigned Deposit Addresses</th>
                    <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono text-right">Crypto Asset Balances</th>
                    <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono text-right">Crypto Worth (NGN)</th>
                    <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono text-right">Fiat Balance</th>
                    <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono text-right">Action</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDark ? 'divide-gray-800/60 bg-[#161A23]' : 'divide-slate-100 bg-white'}`}>
                  {filteredWallets.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-gray-400 text-xs">
                        <div className="flex flex-col items-center justify-center space-y-2">
                          <Wallet className="w-8 h-8 text-gray-500 mb-1 opacity-60" />
                          <p className="font-semibold text-sm text-gray-300">No customer custody records found matching this filter query.</p>
                          <p className="text-xs text-gray-500">Try clearing your search term or switching the filter view.</p>
                          {(search || walletFilter !== 'all') && (
                            <button
                              type="button"
                              onClick={() => { setSearch(''); setWalletFilter('all'); }}
                              className="mt-2 px-3 py-1.5 rounded-lg bg-[#F0B90B] text-black font-bold text-xs hover:bg-[#d8a609] transition-colors"
                            >
                              Reset Filters & Show All Customers
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredWallets.map((u) => (
                      <tr key={u.userId} className={`${isDark ? 'hover:bg-gray-800/20' : 'hover:bg-slate-50/80'} transition-colors`}>
                        {/* Customer */}
                        <td className="py-4 px-4 sm:px-5">
                          <div className="flex items-center space-x-3">
                            <div className="relative w-9 h-9 rounded-full shrink-0 overflow-hidden bg-[#F0B90B]/10 border border-[#F0B90B]/30 flex items-center justify-center">
                              <span className="text-[#F0B90B] font-bold text-xs uppercase select-none">
                                {u.name.slice(0, 2)}
                              </span>
                              {u.profilePhoto && (
                                <img
                                  src={u.profilePhoto}
                                  alt={u.name}
                                  className="absolute inset-0 w-full h-full object-cover"
                                  onError={(e) => {
                                    (e.currentTarget as HTMLElement).style.display = 'none';
                                  }}
                                />
                              )}
                            </div>
                            <div>
                              <div className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{u.name}</div>
                              <div className="text-xs text-gray-400 font-mono mt-0.5">{u.phone} · Acc: {u.accountNumber}</div>
                            </div>
                          </div>
                        </td>

                        {/* Deposit Addresses */}
                        <td className="py-4 px-4 sm:px-5">
                          {u.hasDepositAddress && u.addresses ? (
                            <div className="space-y-1.5 max-w-xs">
                              {u.addresses.usdt && (
                                <div className="flex items-center justify-between space-x-2 text-[11px] font-mono">
                                  <span className="text-emerald-500 font-semibold shrink-0">USDT (TRC20):</span>
                                  <span className={`truncate ${isDark ? 'text-gray-300' : 'text-slate-600'}`}>{u.addresses.usdt}</span>
                                  <button
                                    onClick={() => copyToClipboard(u.addresses.usdt, `usdt-${u.userId}`)}
                                    className="p-1 text-gray-400 hover:text-white shrink-0"
                                    title="Copy Address"
                                  >
                                    {copiedKey === `usdt-${u.userId}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                  </button>
                                </div>
                              )}
                              {u.addresses.btc && (
                                <div className="flex items-center justify-between space-x-2 text-[11px] font-mono">
                                  <span className="text-amber-500 font-semibold shrink-0">BTC:</span>
                                  <span className={`truncate ${isDark ? 'text-gray-300' : 'text-slate-600'}`}>{u.addresses.btc}</span>
                                  <button
                                    onClick={() => copyToClipboard(u.addresses.btc, `btc-${u.userId}`)}
                                    className="p-1 text-gray-400 hover:text-white shrink-0"
                                    title="Copy Address"
                                  >
                                    {copiedKey === `btc-${u.userId}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                  </button>
                                </div>
                              )}
                              {u.addresses.eth && (
                                <div className="flex items-center justify-between space-x-2 text-[11px] font-mono">
                                  <span className="text-blue-400 font-semibold shrink-0">ETH:</span>
                                  <span className={`truncate ${isDark ? 'text-gray-300' : 'text-slate-600'}`}>{u.addresses.eth}</span>
                                  <button
                                    onClick={() => copyToClipboard(u.addresses.eth, `eth-${u.userId}`)}
                                    className="p-1 text-gray-400 hover:text-white shrink-0"
                                    title="Copy Address"
                                  >
                                    {copiedKey === `eth-${u.userId}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-500 italic">No on-chain address generated yet</span>
                          )}
                        </td>

                        {/* Balances */}
                        <td className="py-4 px-4 sm:px-5 text-right font-mono tabular-nums text-xs">
                          <div className={`font-semibold ${isDark ? 'text-gray-200' : 'text-slate-800'}`}>
                            {Number(u?.balances?.usdt || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} <span className="text-emerald-500">USDT</span>
                          </div>
                          <div className={`mt-0.5 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                            {Number(u?.balances?.btc || 0).toFixed(6)} <span className="text-amber-500">BTC</span>
                          </div>
                          <div className={`mt-0.5 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                            {Number(u?.balances?.eth || 0).toFixed(4)} <span className="text-blue-400">ETH</span>
                          </div>
                        </td>

                        {/* Estimated Crypto NGN */}
                        <td className="py-4 px-4 sm:px-5 text-right font-mono tabular-nums">
                          <div className="font-bold text-sm text-[#F0B90B] flex items-center justify-end">
                            <Naira />{Number(u.cryptoEstimatedNaira).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          <div className="text-[10px] text-gray-400 mt-0.5">Live Valuation</div>
                        </td>

                        {/* Fiat Balance */}
                        <td className="py-4 px-4 sm:px-5 text-right font-mono tabular-nums">
                          <div className={`font-bold text-sm flex items-center justify-end ${isDark ? 'text-white' : 'text-slate-900'}`}>
                            <Naira />{Number(u.nairaBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          <div className="text-[10px] text-emerald-500 font-semibold mt-0.5">Vexa Main Wallet</div>
                        </td>

                        {/* Inspect Action */}
                        <td className="py-4 px-4 sm:px-5 text-right">
                          <button
                            onClick={() => setInspectUser(u)}
                            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center space-x-1.5 ml-auto transition-colors ${
                              isDark
                                ? 'bg-gray-800 hover:bg-gray-700 text-gray-200 border-gray-700'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                            }`}
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Inspect</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* SUB-PAGE 2: DEPOSIT TRANSACTIONS (ON-CHAIN INFLOWS)          */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeSubView === 'deposits' && (
        <div className="space-y-4">
          {/* Quick Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className={`p-4 rounded-xl border ${isDark ? 'bg-gray-900/50 border-gray-800' : 'bg-white border-slate-200 shadow-xs'}`}>
              <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>Total Crypto Deposits Logged</div>
              <div className="text-xl font-bold font-mono text-[#F0B90B] mt-1">{deposits.length} Records</div>
            </div>
            <div className={`p-4 rounded-xl border ${isDark ? 'bg-gray-900/50 border-gray-800' : 'bg-white border-slate-200 shadow-xs'}`}>
              <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>Total Deposited Value (NGN)</div>
              <div className="text-xl font-bold font-mono text-emerald-500 mt-1 flex items-center">
                <Naira />{Number(metrics.totalDepositsVolumeNaira).toLocaleString()}
              </div>
            </div>
            <div className={`p-4 rounded-xl border ${isDark ? 'bg-gray-900/50 border-gray-800' : 'bg-white border-slate-200 shadow-xs'}`}>
              <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>On-Chain Oracle Status</div>
              <div className="text-xl font-bold font-mono text-white flex items-center space-x-1.5 mt-1">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 inline" />
                <span className="text-sm">Mainnet Webhook Auto-Credit Active</span>
              </div>
            </div>
          </div>

          {/* Sub-page Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Asset Selector */}
            <div className={`flex items-center space-x-1 p-1 rounded-xl border text-xs ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-slate-100 border-slate-200'}`}>
              {['ALL', 'USDT', 'BTC', 'ETH'].map((a) => (
                <button
                  key={a}
                  onClick={() => setAssetFilter(a)}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                    assetFilter === a
                      ? 'bg-[#F0B90B] text-black font-bold shadow-xs'
                      : isDark ? 'text-gray-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>

            {/* Actions: Search & Export */}
            <div className="flex items-center space-x-2">
              <input
                type="text"
                placeholder="Search depositor, hash, address..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={`px-3 py-1.5 rounded-xl border text-xs outline-none transition-colors w-64 ${
                  isDark
                    ? 'bg-gray-900 border-gray-800 text-white focus:border-[#F0B90B]'
                    : 'bg-white border-slate-300 text-slate-900 focus:border-[#F0B90B] shadow-xs'
                }`}
              />

              <button
                onClick={() => exportCsv('vexa-crypto-deposits', filteredDeposits)}
                className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center space-x-1.5 transition-colors ${
                  isDark
                    ? 'bg-gray-800 hover:bg-gray-700 text-gray-200 border-gray-700'
                    : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300 shadow-xs'
                }`}
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          {/* Deposits Table */}
          <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-[#161A23] border-gray-800' : 'bg-white border-slate-200 shadow-sm'}`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className={`border-b ${isDark ? 'border-gray-800 bg-[#12151D] text-gray-400' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                    <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono">Depositor</th>
                    <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono">Asset & Network</th>
                    <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono text-right">Inflow Amount</th>
                    <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono text-right">NGN Value</th>
                    <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono">On-Chain Tx Hash</th>
                    <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono text-center">Status</th>
                    <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDark ? 'divide-gray-800/60 bg-[#161A23]' : 'divide-slate-100 bg-white'}`}>
                  {filteredDeposits.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-gray-400 text-xs">
                        No crypto deposits recorded yet. Incoming blockchain deposits will stream here live.
                      </td>
                    </tr>
                  ) : (
                    filteredDeposits.map((d) => (
                      <tr key={d.id} className={`${isDark ? 'hover:bg-gray-800/20' : 'hover:bg-slate-50/80'} transition-colors`}>
                        <td className="py-4 px-4 sm:px-5">
                          <div className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{d.userName}</div>
                          <div className="text-xs text-gray-400 font-mono mt-0.5">{d.userPhone}</div>
                        </td>
                        <td className="py-4 px-4 sm:px-5">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-xs font-mono text-[#F0B90B]">{d.asset}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-md font-mono ${isDark ? 'bg-gray-800 text-gray-300' : 'bg-slate-200 text-slate-700'}`}>
                              {d.asset === 'USDT' ? 'Tron TRC-20' : d.asset === 'BTC' ? 'Bitcoin' : 'Ethereum'}
                            </span>
                          </div>
                        </td>
                        <td className="py-4 px-4 sm:px-5 text-right font-mono tabular-nums font-bold text-sm text-emerald-500">
                          +{Number(d.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })} {d.asset}
                        </td>
                        <td className="py-4 px-4 sm:px-5 text-right font-mono tabular-nums font-bold text-sm text-slate-900 dark:text-white">
                          <span className="inline-flex items-center justify-end"><Naira />{Number(d.nairaAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </td>
                        <td className="py-4 px-4 sm:px-5 font-mono text-xs">
                          <div className="flex items-center space-x-1.5">
                            <span className="truncate max-w-[140px] text-gray-400 font-mono">{d.txHash}</span>
                            {getExplorerUrl(d.asset, d.txHash) ? (
                              <a
                                href={getExplorerUrl(d.asset, d.txHash)!}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[#F0B90B] hover:underline flex items-center space-x-1"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            ) : null}
                          </div>
                        </td>
                        <td className="py-4 px-4 sm:px-5 text-center">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-wide">
                            {d.status}
                          </span>
                        </td>
                        <td className="py-4 px-4 sm:px-5 text-right font-mono text-xs text-gray-400">
                          {new Date(d.createdAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* SUB-PAGE 3: BUY ORDERS                                        */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeSubView === 'buys' && (
        <div className="space-y-4">
          {/* Quick Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className={`p-4 rounded-xl border ${isDark ? 'bg-gray-900/50 border-gray-800' : 'bg-white border-slate-200 shadow-xs'}`}>
              <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>Total Crypto Buy Orders</div>
              <div className="text-xl font-bold font-mono text-[#F0B90B] mt-1">{buys.length} Executed</div>
            </div>
            <div className={`p-4 rounded-xl border ${isDark ? 'bg-gray-900/50 border-gray-800' : 'bg-white border-slate-200 shadow-xs'}`}>
              <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>Total Naira Debited</div>
              <div className="text-xl font-bold font-mono text-emerald-500 mt-1 flex items-center">
                <Naira />{Number(metrics.totalBuyVolumeNaira).toLocaleString()}
              </div>
            </div>
            <div className={`p-4 rounded-xl border ${isDark ? 'bg-gray-900/50 border-gray-800' : 'bg-white border-slate-200 shadow-xs'}`}>
              <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>Current Buy Rate (USDT)</div>
              <div className="text-xl font-bold font-mono text-white mt-1 flex items-center">
                <Naira />{exchangeRates.usdtBuyRate} / USDT
              </div>
            </div>
          </div>

          {/* Sub-page Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Asset Selector */}
            <div className={`flex items-center space-x-1 p-1 rounded-xl border text-xs ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-slate-100 border-slate-200'}`}>
              {['ALL', 'USDT', 'BTC', 'ETH'].map((a) => (
                <button
                  key={a}
                  onClick={() => setAssetFilter(a)}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                    assetFilter === a
                      ? 'bg-[#F0B90B] text-black font-bold shadow-xs'
                      : isDark ? 'text-gray-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>

            {/* Actions: Search & Export */}
            <div className="flex items-center space-x-2">
              <input
                type="text"
                placeholder="Search buyer, phone, ref..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={`px-3 py-1.5 rounded-xl border text-xs outline-none transition-colors w-64 ${
                  isDark
                    ? 'bg-gray-900 border-gray-800 text-white focus:border-[#F0B90B]'
                    : 'bg-white border-slate-300 text-slate-900 focus:border-[#F0B90B] shadow-xs'
                }`}
              />

              <button
                onClick={() => exportCsv('vexa-crypto-buy-orders', filteredBuys)}
                className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center space-x-1.5 transition-colors ${
                  isDark
                    ? 'bg-gray-800 hover:bg-gray-700 text-gray-200 border-gray-700'
                    : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300 shadow-xs'
                }`}
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          {/* Buys Table */}
          <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-[#161A23] border-gray-800' : 'bg-white border-slate-200 shadow-sm'}`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className={`border-b ${isDark ? 'border-gray-800 bg-[#12151D] text-gray-400' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                    <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono">Buyer Customer</th>
                    <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono">Asset Purchased</th>
                    <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono text-right">Crypto Quantity</th>
                    <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono text-right">Execution Rate</th>
                    <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono text-right">Naira Debited</th>
                    <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono">Internal Ref</th>
                    <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDark ? 'divide-gray-800/60 bg-[#161A23]' : 'divide-slate-100 bg-white'}`}>
                  {filteredBuys.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-gray-400 text-xs">
                        No crypto buy orders executed yet.
                      </td>
                    </tr>
                  ) : (
                    filteredBuys.map((b) => (
                      <tr key={b.id} className={`${isDark ? 'hover:bg-gray-800/20' : 'hover:bg-slate-50/80'} transition-colors`}>
                        <td className="py-4 px-4 sm:px-5">
                          <div className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{b.userName}</div>
                          <div className="text-xs text-gray-400 font-mono mt-0.5">{b.userPhone}</div>
                        </td>
                        <td className="py-4 px-4 sm:px-5">
                          <span className="font-bold text-xs font-mono text-emerald-400">{b.asset}</span>
                        </td>
                        <td className="py-4 px-4 sm:px-5 text-right font-mono tabular-nums font-bold text-sm text-slate-900 dark:text-white">
                          {Number(b.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })} {b.asset}
                        </td>
                        <td className="py-4 px-4 sm:px-5 text-right font-mono tabular-nums text-xs text-gray-400">
                          <span className="inline-flex items-center justify-end"><Naira />{Number(b.rate).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </td>
                        <td className="py-4 px-4 sm:px-5 text-right font-mono tabular-nums font-bold text-sm text-rose-500">
                          <span className="inline-flex items-center justify-end">-<Naira />{Number(b.nairaAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </td>
                        <td className="py-4 px-4 sm:px-5 font-mono text-xs text-[#F0B90B] truncate max-w-[120px]">
                          {b.txHash}
                        </td>
                        <td className="py-4 px-4 sm:px-5 text-right font-mono text-xs text-gray-400">
                          {new Date(b.createdAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* SUB-PAGE 4: SELL ORDERS                                       */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeSubView === 'sells' && (
        <div className="space-y-4">
          {/* Quick Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className={`p-4 rounded-xl border ${isDark ? 'bg-gray-900/50 border-gray-800' : 'bg-white border-slate-200 shadow-xs'}`}>
              <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>Total Crypto Sell Orders</div>
              <div className="text-xl font-bold font-mono text-[#F0B90B] mt-1">{sells.length} Executed</div>
            </div>
            <div className={`p-4 rounded-xl border ${isDark ? 'bg-gray-900/50 border-gray-800' : 'bg-white border-slate-200 shadow-xs'}`}>
              <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>Total Naira Disbursed to Users</div>
              <div className="text-xl font-bold font-mono text-emerald-500 mt-1 flex items-baseline">
                <Naira className="mr-0.5 text-lg" />{Number(metrics.totalSellVolumeNaira).toLocaleString()}
              </div>
            </div>
            <div className={`p-4 rounded-xl border ${isDark ? 'bg-gray-900/50 border-gray-800' : 'bg-white border-slate-200 shadow-xs'}`}>
              <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>Current Sell Rate (USDT)</div>
              <div className={`text-xl font-bold font-mono mt-1 flex items-baseline ${isDark ? 'text-white' : 'text-slate-900'}`}>
                <Naira className="mr-0.5 text-lg" />{exchangeRates.usdtSellRate} / USDT
              </div>
            </div>
          </div>

          {/* Sub-page Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Asset Selector */}
            <div className={`flex items-center space-x-1 p-1 rounded-xl border text-xs ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-slate-100 border-slate-200'}`}>
              {['ALL', 'USDT', 'BTC', 'ETH'].map((a) => (
                <button
                  key={a}
                  onClick={() => setAssetFilter(a)}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                    assetFilter === a
                      ? 'bg-[#F0B90B] text-black font-bold shadow-xs'
                      : isDark ? 'text-gray-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>

            {/* Actions: Search & Export */}
            <div className="flex items-center space-x-2">
              <input
                type="text"
                placeholder="Search seller, phone, ref..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={`px-3 py-1.5 rounded-xl border text-xs outline-none transition-colors w-64 ${
                  isDark
                    ? 'bg-gray-900 border-gray-800 text-white focus:border-[#F0B90B]'
                    : 'bg-white border-slate-300 text-slate-900 focus:border-[#F0B90B] shadow-xs'
                }`}
              />

              <button
                onClick={() => exportCsv('vexa-crypto-sell-orders', filteredSells)}
                className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center space-x-1.5 transition-colors ${
                  isDark
                    ? 'bg-gray-800 hover:bg-gray-700 text-gray-200 border-gray-700'
                    : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300 shadow-xs'
                }`}
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          {/* Sells Table */}
          <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-[#161A23] border-gray-800' : 'bg-white border-slate-200 shadow-sm'}`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className={`border-b ${isDark ? 'border-gray-800 bg-[#12151D] text-gray-400' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                    <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono">Seller Customer</th>
                    <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono">Asset Sold</th>
                    <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono text-right">Crypto Quantity</th>
                    <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono text-right">Execution Rate</th>
                    <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono text-right">Naira Credited</th>
                    <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono">Internal Ref</th>
                    <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDark ? 'divide-gray-800/60 bg-[#161A23]' : 'divide-slate-100 bg-white'}`}>
                  {filteredSells.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-gray-400 text-xs">
                        No crypto sell orders executed yet.
                      </td>
                    </tr>
                  ) : (
                    filteredSells.map((s) => (
                      <tr key={s.id} className={`${isDark ? 'hover:bg-gray-800/20' : 'hover:bg-slate-50/80'} transition-colors`}>
                        <td className="py-4 px-4 sm:px-5">
                          <div className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{s.userName}</div>
                          <div className="text-xs text-gray-400 font-mono mt-0.5">{s.userPhone}</div>
                        </td>
                        <td className="py-4 px-4 sm:px-5">
                          <span className="font-bold text-xs font-mono text-rose-400">{s.asset}</span>
                        </td>
                        <td className="py-4 px-4 sm:px-5 text-right font-mono tabular-nums font-bold text-sm text-slate-900 dark:text-white">
                          {Number(s.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })} {s.asset}
                        </td>
                        <td className="py-4 px-4 sm:px-5 text-right font-mono tabular-nums text-xs text-gray-400">
                          <Naira className="mr-0.5 text-xs text-gray-400" />{Number(s.rate).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-4 px-4 sm:px-5 text-right font-mono tabular-nums font-bold text-sm text-emerald-500">
                          +<Naira className="mr-0.5 text-xs text-emerald-500" />{Number(s.nairaAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-4 px-4 sm:px-5 font-mono text-xs text-[#F0B90B] truncate max-w-[120px]">
                          {s.txHash}
                        </td>
                        <td className="py-4 px-4 sm:px-5 text-right font-mono text-xs text-gray-400">
                          {new Date(s.createdAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Customer Wallet Inspection Modal / Drawer */}
      {inspectUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div
            className={`w-full max-w-xl rounded-2xl border p-6 shadow-2xl overflow-y-auto max-h-[90vh] ${
              isDark ? 'bg-[#161A23] border-gray-800 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            {/* Modal Header */}
            <div className={`flex items-center justify-between pb-4 border-b ${isDark ? 'border-gray-800' : 'border-slate-200'}`}>
              <div className="flex items-center space-x-3">
                <div className="relative w-12 h-12 rounded-2xl shrink-0 overflow-hidden bg-[#F0B90B]/10 border border-[#F0B90B]/30 flex items-center justify-center">
                  <span className="text-[#F0B90B] font-bold text-base uppercase select-none">
                    {inspectUser.name.slice(0, 2)}
                  </span>
                  {inspectUser.profilePhoto && (
                    <img
                      src={inspectUser.profilePhoto}
                      alt={inspectUser.name}
                      className="absolute inset-0 w-full h-full object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLElement).style.display = 'none';
                      }}
                    />
                  )}
                </div>
                <div>
                  <h2 className="text-lg font-bold">{inspectUser.name}</h2>
                  <div className="text-xs text-gray-400 font-mono">
                    Phone: {inspectUser.phone} · Account: {inspectUser.accountNumber}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setInspectUser(null)}
                className={`p-2 rounded-xl transition-colors ${
                  isDark ? 'text-gray-400 hover:text-white hover:bg-gray-800' : 'text-slate-400 hover:text-slate-800 hover:bg-slate-100'
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Total Custody Overview */}
            <div className="grid grid-cols-2 gap-3 my-5">
              <div className={`p-3.5 rounded-xl border ${isDark ? 'bg-gray-900/50 border-gray-800' : 'bg-slate-50 border-slate-200'}`}>
                <div className="text-[11px] text-gray-400">Total Crypto Valuation</div>
                <div className="text-lg font-bold text-[#F0B90B] font-mono mt-0.5 flex items-baseline">
                  <Naira className="mr-0.5 text-base" />{Number(inspectUser.cryptoEstimatedNaira).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div className={`p-3.5 rounded-xl border ${isDark ? 'bg-gray-900/50 border-gray-800' : 'bg-slate-50 border-slate-200'}`}>
                <div className="text-[11px] text-gray-400">Main Fiat Balance</div>
                <div className={`text-lg font-bold font-mono mt-0.5 flex items-baseline ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  <Naira className="mr-0.5 text-base" />{Number(inspectUser.nairaBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            {/* Generated Deposit Addresses & Crypto Balances */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 font-mono">
                Assigned Deposit Addresses & Balances
              </h3>

              {/* USDT */}
              <div className={`p-3.5 rounded-xl border ${isDark ? 'bg-gray-900/40 border-gray-800' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-sm text-emerald-500 font-mono">Tether (USDT)</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-md font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Tron TRC-20
                    </span>
                  </div>
                  <div className="text-right font-mono font-bold text-sm text-emerald-400">
                    {Number(inspectUser?.balances?.usdt || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} USDT
                  </div>
                </div>
                <div className="mt-2 text-xs font-mono flex items-center justify-between p-2 rounded-lg bg-black/30 border border-gray-800">
                  <span className="truncate mr-2 text-gray-300">
                    {inspectUser?.addresses?.usdt || 'No address generated yet'}
                  </span>
                  {inspectUser?.addresses?.usdt && (
                    <button
                      onClick={() => copyToClipboard(inspectUser.addresses.usdt, 'modal-usdt')}
                      className="px-2 py-1 bg-[#F0B90B] text-black rounded text-[11px] font-bold flex items-center space-x-1 shrink-0"
                    >
                      {copiedKey === 'modal-usdt' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedKey === 'modal-usdt' ? 'Copied' : 'Copy'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* BTC */}
              <div className={`p-3.5 rounded-xl border ${isDark ? 'bg-gray-900/40 border-gray-800' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-sm text-amber-500 font-mono">Bitcoin (BTC)</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-md font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      Native SegWit
                    </span>
                  </div>
                  <div className="text-right font-mono font-bold text-sm text-amber-400">
                    {Number(inspectUser?.balances?.btc || 0).toFixed(6)} BTC
                  </div>
                </div>
                <div className="mt-2 text-xs font-mono flex items-center justify-between p-2 rounded-lg bg-black/30 border border-gray-800">
                  <span className="truncate mr-2 text-gray-300">
                    {inspectUser?.addresses?.btc || 'No address generated yet'}
                  </span>
                  {inspectUser?.addresses?.btc && (
                    <button
                      onClick={() => copyToClipboard(inspectUser.addresses.btc, 'modal-btc')}
                      className="px-2 py-1 bg-[#F0B90B] text-black rounded text-[11px] font-bold flex items-center space-x-1 shrink-0"
                    >
                      {copiedKey === 'modal-btc' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedKey === 'modal-btc' ? 'Copied' : 'Copy'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* ETH */}
              <div className={`p-3.5 rounded-xl border ${isDark ? 'bg-gray-900/40 border-gray-800' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-sm text-blue-400 font-mono">Ethereum (ETH)</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-md font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      ERC-20
                    </span>
                  </div>
                  <div className="text-right font-mono font-bold text-sm text-blue-400">
                    {Number(inspectUser?.balances?.eth || 0).toFixed(4)} ETH
                  </div>
                </div>
                <div className="mt-2 text-xs font-mono flex items-center justify-between p-2 rounded-lg bg-black/30 border border-gray-800">
                  <span className="truncate mr-2 text-gray-300">
                    {inspectUser?.addresses?.eth || 'No address generated yet'}
                  </span>
                  {inspectUser?.addresses?.eth && (
                    <button
                      onClick={() => copyToClipboard(inspectUser.addresses.eth, 'modal-eth')}
                      className="px-2 py-1 bg-[#F0B90B] text-black rounded text-[11px] font-bold flex items-center space-x-1 shrink-0"
                    >
                      {copiedKey === 'modal-eth' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedKey === 'modal-eth' ? 'Copied' : 'Copy'}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setInspectUser(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#F0B90B] text-black hover:bg-[#d9a606] transition-colors"
              >
                Close Ledger Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
