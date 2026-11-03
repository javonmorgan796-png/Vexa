import React, { useState, useEffect } from 'react';
import { useAdmin, AdminTab } from '../AdminContext';
import {
  Users,
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  TrendingUp,
  ShieldAlert,
  FileCheck2,
  Headphones,
  CheckCircle2,
  Clock,
  ChevronRight,
  RefreshCw,
  Search,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

export const OverviewTab: React.FC = () => {
  const { fetchAdminApi, setActiveTab, adminTheme } = useAdmin();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [chartRange, setChartRange] = useState<'daily' | 'weekly' | 'monthly'>('weekly');

  const loadOverview = async () => {
    try {
      setLoading(true);
      const res = await fetchAdminApi('/api/admin/overview');
      setData(res);
    } catch (err) {
      console.error('Failed to load admin overview:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOverview();
  }, []);

  const isDark = adminTheme === 'dark';
  const metrics = data?.metrics || {
    totalUsers: 1420,
    activeUsers: 1388,
    suspendedUsers: 32,
    totalBalances: 84520930.5,
    totalDepositsVolume: 124500000,
    totalWithdrawalsVolume: 48200000,
    totalTransactions: 8940,
    pendingKyc: 2,
    openTickets: 1,
    unresolvedAlerts: 1,
  };

  const chartData = data?.chartData || [
    { name: 'Mon', deposits: 4200000, withdrawals: 1800000, volume: 6000000 },
    { name: 'Tue', deposits: 6100000, withdrawals: 2400000, volume: 8500000 },
    { name: 'Wed', deposits: 5800000, withdrawals: 2900000, volume: 8700000 },
    { name: 'Thu', deposits: 7900000, withdrawals: 3100000, volume: 11000000 },
    { name: 'Fri', deposits: 9400000, withdrawals: 4600000, volume: 14000000 },
    { name: 'Sat', deposits: 8200000, withdrawals: 3800000, volume: 12000000 },
    { name: 'Sun', deposits: 6900000, withdrawals: 2700000, volume: 9600000 },
  ];

  const recentTransactions = data?.recentTransactions || [];

  return (
    <div className="space-y-6">
      {/* Welcome Banner & System Status */}
      <div
        className={`p-6 rounded-2xl border ${
          isDark
            ? 'bg-gradient-to-r from-[#161A23] to-[#12151D] border-gray-800'
            : 'bg-gradient-to-r from-white to-gray-50 border-gray-200'
        } flex flex-col lg:flex-row lg:items-center justify-between gap-4`}
      >
        <div>
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-semibold tracking-wider uppercase text-emerald-500 font-mono">
              Core Ledger Online · Mainnet Node Active
            </span>
          </div>
          <h1 className={`text-2xl font-bold tracking-tight mt-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Financial Operations & Ecosystem Command
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Real-time monitoring of customer wallets, settlement rails, risk heuristics, and regulatory compliance.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={loadOverview}
            disabled={loading}
            className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center space-x-2 border transition-all ${
              isDark
                ? 'bg-gray-800/60 hover:bg-gray-800 text-gray-200 border-gray-700'
                : 'bg-white hover:bg-gray-100 text-gray-700 border-gray-300'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Ledger</span>
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#F0B90B] hover:bg-[#d9a606] text-black shadow-sm flex items-center space-x-1.5 transition-colors"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Search Customer</span>
          </button>
        </div>
      </div>

      {/* Action Alerts Ribbon */}
      {(metrics.pendingKyc > 0 || metrics.unresolvedAlerts > 0 || metrics.openTickets > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {metrics.pendingKyc > 0 && (
            <div
              onClick={() => setActiveTab('kyc')}
              className={`p-4 rounded-xl border flex items-center justify-between cursor-pointer transition-all hover:translate-y-[-2px] ${
                isDark ? 'bg-amber-500/10 border-amber-500/30' : 'bg-amber-50 border-amber-200'
              }`}
            >
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-lg bg-amber-500/20 text-amber-500">
                  <FileCheck2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-amber-600 uppercase tracking-wider">KYC Verification</div>
                  <div className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {metrics.pendingKyc} Pending Customer Submissions
                  </div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-amber-500" />
            </div>
          )}

          {metrics.unresolvedAlerts > 0 && (
            <div
              onClick={() => setActiveTab('security')}
              className={`p-4 rounded-xl border flex items-center justify-between cursor-pointer transition-all hover:translate-y-[-2px] ${
                isDark ? 'bg-rose-500/10 border-rose-500/30' : 'bg-rose-50 border-rose-200'
              }`}
            >
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-lg bg-rose-500/20 text-rose-500">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-rose-600 uppercase tracking-wider">Fraud Monitoring</div>
                  <div className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {metrics.unresolvedAlerts} Critical Risk Anomalies
                  </div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-rose-500" />
            </div>
          )}

          {metrics.openTickets > 0 && (
            <div
              onClick={() => setActiveTab('support')}
              className={`p-4 rounded-xl border flex items-center justify-between cursor-pointer transition-all hover:translate-y-[-2px] ${
                isDark ? 'bg-blue-500/10 border-blue-500/30' : 'bg-blue-50 border-blue-200'
              }`}
            >
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-lg bg-blue-500/20 text-blue-500">
                  <Headphones className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-blue-600 uppercase tracking-wider">Customer Support</div>
                  <div className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {metrics.openTickets} Open Support Inquiries
                  </div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-blue-500" />
            </div>
          )}
        </div>
      )}

      {/* Key Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Wallet Balances */}
        <div className={`p-5 rounded-2xl border ${isDark ? 'bg-[#161A23] border-gray-800' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-400">Total Vault Balances</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-[#F0B90B]">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className={`text-2xl font-bold mt-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            ₦{Number(metrics.totalBalances).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div className="flex items-center justify-between text-xs text-gray-400 mt-3 pt-3 border-t border-gray-800/50">
            <span>Customer Holdings</span>
            <span className="text-emerald-500 font-semibold flex items-center">
              <TrendingUp className="w-3 h-3 mr-0.5" /> +12.4% MoM
            </span>
          </div>
        </div>

        {/* Registered Users */}
        <div className={`p-5 rounded-2xl border ${isDark ? 'bg-[#161A23] border-gray-800' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-400">Total Registered Users</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className={`text-2xl font-bold mt-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {Number(metrics.totalUsers).toLocaleString()}
          </div>
          <div className="flex items-center justify-between text-xs text-gray-400 mt-3 pt-3 border-t border-gray-800/50">
            <span className="text-emerald-500">{metrics.activeUsers} Active</span>
            <span className="text-rose-500">{metrics.suspendedUsers} Restricted</span>
          </div>
        </div>

        {/* Total Deposits */}
        <div className={`p-5 rounded-2xl border ${isDark ? 'bg-[#161A23] border-gray-800' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-400">Inbound Deposits</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
              <ArrowDownLeft className="w-5 h-5" />
            </div>
          </div>
          <div className={`text-2xl font-bold mt-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            ₦{Number(metrics.totalDepositsVolume).toLocaleString()}
          </div>
          <div className="flex items-center justify-between text-xs text-gray-400 mt-3 pt-3 border-t border-gray-800/50">
            <span>Paystack & Bank Gateway</span>
            <span className="text-emerald-500 font-semibold font-mono">99.8% Success</span>
          </div>
        </div>

        {/* Total Withdrawals */}
        <div className={`p-5 rounded-2xl border ${isDark ? 'bg-[#161A23] border-gray-800' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-400">Outbound Withdrawals</span>
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-500">
              <ArrowUpRight className="w-5 h-5" />
            </div>
          </div>
          <div className={`text-2xl font-bold mt-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            ₦{Number(metrics.totalWithdrawalsVolume).toLocaleString()}
          </div>
          <div className="flex items-center justify-between text-xs text-gray-400 mt-3 pt-3 border-t border-gray-800/50">
            <span>Interbank NIP Rails</span>
            <span className="text-gray-400 font-mono">{metrics.totalTransactions} Total Events</span>
          </div>
        </div>
      </div>

      {/* Main Chart Section: Volume Analytics */}
      <div className={`p-6 rounded-2xl border ${isDark ? 'bg-[#161A23] border-gray-800' : 'bg-white border-gray-200'}`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h2 className={`text-base font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Settlement Volume & Liquidity Flow
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Comparative visualization of daily deposit inflows versus outbound withdrawals.
            </p>
          </div>
          <div className={`flex items-center space-x-1 p-1 rounded-xl border ${isDark ? 'bg-gray-900/40 border-gray-800' : 'bg-slate-100 border-slate-200'}`}>
            {(['daily', 'weekly', 'monthly'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setChartRange(r)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                  chartRange === r
                    ? 'bg-[#F0B90B] text-black shadow-sm font-bold'
                    : isDark
                    ? 'text-gray-400 hover:text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="depositGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="withdrawalGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F43F5E" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#F43F5E" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#262A35' : '#E2E8F0'} vertical={false} />
              <XAxis dataKey="name" stroke="#6B7280" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis
                stroke="#6B7280"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => `₦${(val / 1000000).toFixed(1)}M`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: isDark ? '#1F2430' : '#FFFFFF',
                  borderColor: isDark ? '#374151' : '#E5E7EB',
                  borderRadius: '12px',
                  boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)',
                  fontSize: '12px',
                }}
                formatter={(val: any) => [`₦${Number(val).toLocaleString()}`, '']}
              />
              <Area
                type="monotone"
                dataKey="deposits"
                name="Deposits (Inflow)"
                stroke="#10B981"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#depositGradient)"
              />
              <Area
                type="monotone"
                dataKey="withdrawals"
                name="Withdrawals (Outflow)"
                stroke="#F43F5E"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#withdrawalGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="flex items-center justify-center space-x-8 mt-4 pt-4 border-t border-gray-800/40 text-xs">
          <div className="flex items-center space-x-2">
            <span className="w-3 h-3 rounded-full bg-emerald-500" />
            <span className="text-gray-400">Inbound Deposits</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-3 h-3 rounded-full bg-rose-500" />
            <span className="text-gray-400">Outbound Withdrawals</span>
          </div>
        </div>
      </div>

      {/* Live Transaction Stream Table */}
      <div className={`p-6 rounded-2xl border ${isDark ? 'bg-[#161A23] border-gray-800' : 'bg-white border-gray-200'}`}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className={`text-base font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Real-Time Settlement Feed
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">Most recent banking and digital transfer events.</p>
          </div>
          <button
            onClick={() => setActiveTab('transactions')}
            className="text-xs font-semibold text-[#F0B90B] hover:underline flex items-center space-x-1"
          >
            <span>View All Transactions</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className={`border-b ${isDark ? 'border-gray-800 text-gray-400' : 'border-slate-200 text-slate-500 bg-slate-50'}`}>
                <th className="py-3 px-2 font-semibold">Reference</th>
                <th className="py-3 px-2 font-semibold">User</th>
                <th className="py-3 px-2 font-semibold">Transaction Type</th>
                <th className="py-3 px-2 font-semibold">Amount</th>
                <th className="py-3 px-2 font-semibold">Status</th>
                <th className="py-3 px-2 font-semibold">Timestamp</th>
              </tr>
            </thead>
            <tbody className={`divide-y font-mono ${isDark ? 'divide-gray-800/40' : 'divide-slate-100'}`}>
              {recentTransactions.map((tx: any) => (
                <tr key={tx.id} className={`${isDark ? 'hover:bg-gray-800/20' : 'hover:bg-slate-50/80'} transition-colors`}>
                  <td className={`py-3 px-2 font-medium ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>{tx.reference}</td>
                  <td className="py-3 px-2 font-sans">
                    <div className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{tx.user}</div>
                    <div className={`text-[11px] ${isDark ? 'text-gray-500' : 'text-slate-400'}`}>{tx.phone}</div>
                  </td>
                  <td className={`py-3 px-2 font-sans ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>{tx.type}</td>
                  <td className={`py-3 px-2 font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>₦{Number(tx.amount).toLocaleString()}</td>
                  <td className="py-3 px-2">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                        tx.status === 'successful'
                          ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                          : tx.status === 'pending'
                          ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                          : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                      }`}
                    >
                      {tx.status}
                    </span>
                  </td>
                  <td className={`py-3 px-2 ${isDark ? 'text-gray-500' : 'text-slate-400'} text-[11px]`}>
                    {new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
