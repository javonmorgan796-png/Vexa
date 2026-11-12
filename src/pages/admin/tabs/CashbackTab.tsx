import React, { useState, useEffect } from 'react';
import { useAdmin } from '../AdminContext';
import { Naira } from '@/components/Naira';
import {
  Percent,
  Coins,
  Search,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  Receipt,
  Smartphone,
  CreditCard,
  Zap,
  TrendingUp,
} from 'lucide-react';

export const CashbackTab: React.FC = () => {
  const { fetchAdminApi, adminTheme } = useAdmin();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'cleared' | 'pending'>('all');

  const isDark = adminTheme === 'dark';

  const loadCashbackData = async () => {
    try {
      setLoading(true);
      const res = await fetchAdminApi('/api/admin/cashback');
      setData(res);
    } catch {
      try {
        // Fallback to rewards endpoint if needed
        const fallbackRes = await fetchAdminApi('/api/admin/rewards');
        setData(fallbackRes);
      } catch (err) {
        console.error('Failed to load cashback data:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCashbackData();
  }, []);

  const metrics = data?.metrics || {
    totalCashbackDisbursed: 0,
  };

  const allCashback = data?.cashbackHistory || [];
  const clearedCount = allCashback.filter((c: any) => c.status === 'cleared').length;
  const pendingCount = allCashback.filter((c: any) => c.status !== 'cleared').length;

  const totalDisbursed = Number(metrics.totalCashbackDisbursed) || 
    allCashback.reduce((sum: number, c: any) => sum + (Number(c.earned) || 0), 0);

  const filteredCashback = allCashback.filter((c: any) => {
    const matchesSearch =
      !search ||
      c.userName?.toLowerCase().includes(search.toLowerCase()) ||
      c.description?.toLowerCase().includes(search.toLowerCase()) ||
      c.userPhone?.includes(search) ||
      c.rate?.toLowerCase().includes(search.toLowerCase());

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'cleared' && c.status === 'cleared') ||
      (statusFilter === 'pending' && c.status !== 'cleared');

    return matchesSearch && matchesStatus;
  });

  const getServiceIcon = (description: string) => {
    const lower = description.toLowerCase();
    if (lower.includes('data') || lower.includes('airtime') || lower.includes('telecom')) {
      return <Smartphone className="w-3.5 h-3.5 text-amber-500" />;
    }
    if (lower.includes('card')) {
      return <CreditCard className="w-3.5 h-3.5 text-blue-500" />;
    }
    if (lower.includes('electric') || lower.includes('power') || lower.includes('bill')) {
      return <Zap className="w-3.5 h-3.5 text-purple-500" />;
    }
    return <Receipt className="w-3.5 h-3.5 text-emerald-500" />;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Percent className="w-5 h-5" />
            </div>
            <div>
              <h1 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Cashback Rewards Ledger
              </h1>
              <p className="text-xs text-gray-400 mt-0.5">
                Audit customer cashback disbursements, airtime/data reward percentages, bill rebates, and wallet credits.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadCashbackData}
            disabled={loading}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
              isDark
                ? 'bg-gray-900/60 border-gray-800 text-gray-300 hover:text-white hover:bg-gray-800/80'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-xs'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={`p-5 rounded-2xl border ${isDark ? 'bg-[#161A23] border-gray-800' : 'bg-white border-gray-200 shadow-sm'}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-400">Total Cashback Disbursed</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
              <Percent className="w-5 h-5" />
            </div>
          </div>
          <div className={`text-2xl font-bold mt-2 flex items-baseline ${isDark ? 'text-white' : 'text-gray-900'}`}>
            <Naira className="mr-0.5 text-xl" />{Number(totalDisbursed).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-emerald-400 mt-2 font-mono">Credited To User Wallets</div>
        </div>

        <div className={`p-5 rounded-2xl border ${isDark ? 'bg-[#161A23] border-gray-800' : 'bg-white border-gray-200 shadow-sm'}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-400">Cashback Events</span>
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400">
              <Coins className="w-5 h-5" />
            </div>
          </div>
          <div className={`text-2xl font-bold mt-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {allCashback.length}
          </div>
          <div className="text-xs text-gray-400 mt-2">Qualified Transaction Rebates</div>
        </div>

        <div className={`p-5 rounded-2xl border ${isDark ? 'bg-[#161A23] border-gray-800' : 'bg-white border-gray-200 shadow-sm'}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-400">Cashback Rates</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-[#F0B90B]">
              <Sparkles className="w-5 h-5" />
            </div>
          </div>
          <div className={`text-2xl font-bold mt-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            1.0% – 3.0%
          </div>
          <div className="text-xs text-[#F0B90B] mt-2">Airtime, Data & Bill Payments</div>
        </div>

        <div className={`p-5 rounded-2xl border ${isDark ? 'bg-[#161A23] border-gray-800' : 'bg-white border-gray-200 shadow-sm'}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-400">Settlement Speed</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className={`text-2xl font-bold mt-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Instant
          </div>
          <div className="text-xs text-emerald-400 mt-2">Automated Ledger Credit</div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-[#161A23] border-gray-800' : 'bg-white border-slate-200 shadow-sm'}`}>
        <div className={`p-4 border-b flex flex-col md:flex-row md:items-center justify-between gap-3 ${isDark ? 'border-gray-800/60' : 'border-slate-200'}`}>
          <div className="flex items-center gap-3">
            <h2 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Cashback Event History
            </h2>
            <div className={`flex items-center p-0.5 rounded-lg border text-xs ${isDark ? 'bg-gray-900/60 border-gray-800' : 'bg-slate-100 border-slate-200'}`}>
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                  statusFilter === 'all'
                    ? 'bg-[#F0B90B] text-black font-bold shadow-xs'
                    : isDark ? 'text-gray-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All ({allCashback.length})
              </button>
              <button
                onClick={() => setStatusFilter('cleared')}
                className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                  statusFilter === 'cleared'
                    ? 'bg-emerald-500 text-white font-bold shadow-xs'
                    : isDark ? 'text-gray-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Cleared ({clearedCount})
              </button>
              <button
                onClick={() => setStatusFilter('pending')}
                className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                  statusFilter === 'pending'
                    ? 'bg-amber-500 text-black font-bold shadow-xs'
                    : isDark ? 'text-gray-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Pending ({pendingCount})
              </button>
            </div>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search customer, phone, description, rate..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`pl-9 pr-3 py-1.5 rounded-xl border text-xs outline-none w-full sm:w-72 transition-colors ${
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
                <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono">Customer</th>
                <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono">Eligible Transaction</th>
                <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono text-right">Cashback Rate</th>
                <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono text-right">Earned Reward</th>
                <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono text-center">Settlement Status</th>
                <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono text-right">Date & Time</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-gray-800/60 bg-[#161A23]' : 'divide-slate-100 bg-white'}`}>
              {filteredCashback.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto mb-3">
                      <Percent className="w-6 h-6" />
                    </div>
                    <p className={`text-sm font-semibold ${isDark ? 'text-gray-200' : 'text-slate-800'}`}>
                      No cashback rewards recorded
                    </p>
                    <p className={`text-xs mt-1 max-w-sm mx-auto ${isDark ? 'text-gray-500' : 'text-slate-400'}`}>
                      {search ? 'Try adjusting your search criteria.' : 'Cashback credits earned from mobile data, airtime, and bill transactions will appear here.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredCashback.map((c: any) => (
                  <tr key={c.id} className={`${isDark ? 'hover:bg-gray-800/20' : 'hover:bg-slate-50/80'} transition-colors`}>
                    <td className="py-4 px-4 sm:px-5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold shrink-0">
                          {c.userName?.charAt(0) || 'C'}
                        </div>
                        <div>
                          <div className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{c.userName}</div>
                          <div className={`text-xs font-mono mt-0.5 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>{c.userPhone}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 sm:px-5">
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-lg ${isDark ? 'bg-gray-900 border border-gray-800' : 'bg-slate-100'}`}>
                          {getServiceIcon(c.description || '')}
                        </div>
                        <span className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-slate-800'}`}>
                          {c.description}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4 sm:px-5 text-right font-mono font-bold text-xs text-[#F0B90B]">
                      {c.rate || '1.0%'}
                    </td>
                    <td className="py-4 px-4 sm:px-5 text-right font-mono tabular-nums font-bold text-sm text-emerald-600 dark:text-emerald-400">
                      <span className="inline-flex items-baseline justify-end">
                        +<Naira className="mr-0.5 text-xs text-emerald-600 dark:text-emerald-400" />
                        {Number(c.earned).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td className="py-4 px-4 sm:px-5 text-center">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider font-mono ${
                          c.status === 'cleared'
                            ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                        }`}
                      >
                        {c.status || 'cleared'}
                      </span>
                    </td>
                    <td className="py-4 px-4 sm:px-5 text-right font-mono text-xs text-slate-500 dark:text-gray-400">
                      {c.date}
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
