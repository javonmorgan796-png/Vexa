import React, { useState, useEffect } from 'react';
import { useAdmin } from '../AdminContext';
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
} from 'lucide-react';

export const CryptoDataTab: React.FC = () => {
  const { fetchAdminApi, adminTheme } = useAdmin();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [assetFilter, setAssetFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  const isDark = adminTheme === 'dark';

  const loadCryptoData = async () => {
    try {
      setLoading(true);
      const res = await fetchAdminApi('/api/admin/crypto');
      setData(res);
    } catch (err) {
      console.error('Failed to load crypto data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCryptoData();
  }, []);

  const metrics = data?.metrics || {
    totalTradingVolumeNaira: 0,
    totalCustodyNaira: 0,
    totalOrdersExecuted: 0,
    activeTradersCount: 0,
  };

  const custodyHoldings = data?.custodyHoldings || [];
  const exchangeRates = data?.exchangeRates || {
    usdtBuyRate: 1655.0,
    usdtSellRate: 1645.0,
    btcUsdRate: 96000.0,
    ethUsdRate: 3400.0,
    solUsdRate: 190.0,
    spreadPercentage: 0.85,
  };

  const orders = (data?.exchangeOrders || []).filter((o: any) => {
    const matchesAsset = assetFilter === 'ALL' || o.asset === assetFilter;
    const matchesSearch =
      !search ||
      o.userName.toLowerCase().includes(search.toLowerCase()) ||
      o.userPhone.includes(search) ||
      o.txHash.toLowerCase().includes(search.toLowerCase());
    return matchesAsset && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Crypto Exchange & Digital Asset Custody Ledger
          </h1>
          <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
            Internal Vexa Exchange order book, OTC settlement spreads, on-chain deposit addresses, and multi-chain vault balances.
          </p>
        </div>

        <button
          onClick={loadCryptoData}
          disabled={loading}
          className={`px-3.5 py-2 border rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors self-start sm:self-auto ${
            isDark
              ? 'bg-gray-800 hover:bg-gray-700 text-gray-200 border-gray-700'
              : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300 shadow-sm'
          }`}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Sync Exchange Feeds</span>
        </button>
      </div>

      {/* Exchange Rate Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className={`p-3.5 rounded-xl border ${isDark ? 'bg-gray-900/50 border-gray-800' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className={`text-[10px] font-mono uppercase ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>USDT / NGN OTC Spread</div>
          <div className="text-base font-bold text-[#F0B90B] font-mono mt-0.5">
            ₦{exchangeRates.usdtBuyRate} / ₦{exchangeRates.usdtSellRate}
          </div>
          <div className="text-[10px] text-emerald-500 mt-0.5 font-semibold">Spread: {exchangeRates.spreadPercentage}%</div>
        </div>

        <div className={`p-3.5 rounded-xl border ${isDark ? 'bg-gray-900/50 border-gray-800' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className={`text-[10px] font-mono uppercase ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>Bitcoin (BTC) Index</div>
          <div className={`text-base font-bold font-mono mt-0.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            ${exchangeRates.btcUsdRate.toLocaleString()}
          </div>
          <div className={`text-[10px] mt-0.5 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>Real-time Spot Oracle</div>
        </div>

        <div className={`p-3.5 rounded-xl border ${isDark ? 'bg-gray-900/50 border-gray-800' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className={`text-[10px] font-mono uppercase ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>Ethereum (ETH) Index</div>
          <div className={`text-base font-bold font-mono mt-0.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            ${exchangeRates.ethUsdRate.toLocaleString()}
          </div>
          <div className={`text-[10px] mt-0.5 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>ERC-20 Settlement</div>
        </div>

        <div className={`p-3.5 rounded-xl border ${isDark ? 'bg-gray-900/50 border-gray-800' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className={`text-[10px] font-mono uppercase ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>Solana (SOL) Index</div>
          <div className={`text-base font-bold font-mono mt-0.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            ${exchangeRates.solUsdRate.toLocaleString()}
          </div>
          <div className={`text-[10px] mt-0.5 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>SPL Network Active</div>
        </div>
      </div>

      {/* Multi-chain Custody Vault Holdings */}
      <div className={`rounded-2xl border p-5 ${isDark ? 'bg-[#161A23] border-gray-800' : 'bg-white border-slate-200 shadow-sm'}`}>
        <div className={`flex items-center justify-between mb-4 pb-3 border-b ${isDark ? 'border-gray-800' : 'border-slate-200'}`}>
          <div className="flex items-center space-x-2">
            <Coins className="w-5 h-5 text-[#F0B90B]" />
            <h2 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Vexa Custody Hot-Wallets & Treasury Reserves</h2>
          </div>
          <div className="text-xs font-mono font-bold text-emerald-500">
            Total Custody: ₦{Number(metrics.totalCustodyNaira).toLocaleString()}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {custodyHoldings.map((c: any) => (
            <div key={c.asset} className={`p-4 rounded-xl border ${isDark ? 'bg-gray-900/40 border-gray-800/80' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex items-center justify-between">
                <span className={`font-bold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>{c.asset}</span>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md ${isDark ? 'bg-gray-800 text-gray-300' : 'bg-slate-200 text-slate-700 font-semibold'}`}>
                  {c.network}
                </span>
              </div>
              <div className="text-lg font-bold text-[#F0B90B] font-mono mt-2">
                {Number(c.totalAmount).toLocaleString()} {c.symbol}
              </div>
              <div className={`text-xs font-mono mt-1 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                ≈ ${Number(c.usdValue).toLocaleString()} (<span className="text-emerald-500 font-semibold">₦{Number(c.nairaValue).toLocaleString()}</span>)
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Exchange Orders Table */}
      <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-[#161A23] border-gray-800' : 'bg-white border-slate-200 shadow-sm'}`}>
        <div className={`p-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${isDark ? 'border-gray-800/60' : 'border-slate-200'}`}>
          <div className="flex items-center space-x-2">
            <h2 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Exchange Order Execution Ledger</h2>
            <span className={`text-xs font-mono ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>({orders.length} orders)</span>
          </div>

          <div className="flex items-center space-x-2">
            {/* Asset Filter Badges */}
            <div className={`flex items-center space-x-1 p-1 rounded-xl border text-xs ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-slate-100 border-slate-200'}`}>
              {['ALL', 'USDT', 'BTC', 'ETH'].map((a) => (
                <button
                  key={a}
                  onClick={() => setAssetFilter(a)}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                    assetFilter === a
                      ? 'bg-[#F0B90B] text-black font-bold shadow-xs'
                      : isDark
                      ? 'text-gray-400 hover:text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>

            <input
              type="text"
              placeholder="Search trader, hash..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`px-3 py-1.5 rounded-xl border text-xs outline-none transition-colors ${
                isDark
                  ? 'bg-gray-900 border-gray-800 text-white focus:border-[#F0B90B]'
                  : 'bg-white border-slate-300 text-slate-900 focus:border-[#F0B90B] shadow-xs'
              }`}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className={`border-b ${isDark ? 'border-gray-800 bg-[#12151D]/80 text-gray-400' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono">Trader</th>
                <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono text-center">Order Type</th>
                <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono text-right">Crypto Amount</th>
                <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono text-right">Naira Valuation</th>
                <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono text-right">Execution Rate</th>
                <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono">Tx Hash / Ledger</th>
                <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-gray-800/60 bg-[#161A23]' : 'divide-slate-100 bg-white'}`}>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <p className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-slate-600'}`}>
                      No crypto exchange orders executed yet
                    </p>
                    <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-slate-400'}`}>
                      User swap and custody orders will stream here with cryptographic hash references.
                    </p>
                  </td>
                </tr>
              ) : (
                orders.map((o: any) => (
                  <tr key={o.id} className={`${isDark ? 'hover:bg-gray-800/20' : 'hover:bg-slate-50/80'} transition-colors`}>
                    <td className="py-4 px-4 sm:px-5">
                      <div className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{o.userName}</div>
                      <div className={`text-xs font-mono mt-0.5 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>{o.userPhone}</div>
                    </td>
                    <td className="py-4 px-4 sm:px-5 text-center">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider font-mono ${
                          o.kind === 'buy' || o.kind === 'deposit'
                            ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                        }`}
                      >
                        {o.kind.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-4 px-4 sm:px-5 text-right font-mono tabular-nums font-bold text-sm text-slate-900 dark:text-white">
                      {Number(o.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })} {o.asset}
                    </td>
                    <td className="py-4 px-4 sm:px-5 text-right font-mono tabular-nums font-bold text-sm text-emerald-600 dark:text-emerald-400">
                      ₦{Number(o.nairaAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-4 px-4 sm:px-5 text-right font-mono tabular-nums text-xs text-slate-600 dark:text-gray-300">
                      ₦{Number(o.rate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-4 px-4 sm:px-5 font-mono text-xs font-semibold text-[#F0B90B] truncate max-w-[150px]">
                      {o.txHash}
                    </td>
                    <td className="py-4 px-4 sm:px-5 text-right font-mono text-xs text-slate-500 dark:text-gray-400">
                      {new Date(o.createdAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
