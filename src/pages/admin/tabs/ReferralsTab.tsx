import React, { useState, useEffect } from 'react';
import { useAdmin } from '../AdminContext';
import { Naira } from '@/components/Naira';
import {
  Gift,
  Users,
  Clock,
  Search,
  Sparkles,
  TrendingUp,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  UserCheck,
} from 'lucide-react';

export const ReferralsTab: React.FC = () => {
  const { fetchAdminApi, adminTheme } = useAdmin();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'pending'>('all');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const isDark = adminTheme === 'dark';

  const loadReferralsData = async () => {
    try {
      setLoading(true);
      const res = await fetchAdminApi('/api/admin/referrals');
      setData(res);
    } catch {
      try {
        // Fallback to legacy endpoint if needed
        const fallbackRes = await fetchAdminApi('/api/admin/rewards');
        setData(fallbackRes);
      } catch (err) {
        console.error('Failed to load referrals data:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReferralsData();
  }, []);

  const copyToClipboard = (text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedCode(text);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const metrics = data?.metrics || {
    totalReferralBonusesPaid: 0,
    totalReferralsCount: 0,
    pendingReferralsCount: 0,
  };

  const allReferrals = data?.referrals || [];
  const paidCount = allReferrals.filter((r: any) => r.status === 'paid').length;
  const pendingCount = allReferrals.filter((r: any) => r.status !== 'paid').length;
  const conversionRate = allReferrals.length > 0 
    ? Math.round((paidCount / allReferrals.length) * 100) 
    : 0;

  const filteredReferrals = allReferrals.filter((r: any) => {
    const matchesSearch =
      !search ||
      r.referrerName?.toLowerCase().includes(search.toLowerCase()) ||
      r.refereeName?.toLowerCase().includes(search.toLowerCase()) ||
      r.referralCode?.toLowerCase().includes(search.toLowerCase()) ||
      r.referrerPhone?.includes(search) ||
      r.refereePhone?.includes(search);

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'paid' && r.status === 'paid') ||
      (statusFilter === 'pending' && r.status !== 'paid');

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Gift className="w-5 h-5" />
            </div>
            <div>
              <h1 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Referral Program Management
              </h1>
              <p className="text-xs text-gray-400 mt-0.5">
                Monitor customer peer invites, referral bonuses, conversion rates, and referee onboarding qualification.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadReferralsData}
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
            <span className="text-xs font-medium text-gray-400">Total Bonuses Paid</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-[#F0B90B]">
              <Gift className="w-5 h-5" />
            </div>
          </div>
          <div className={`text-2xl font-bold mt-2 flex items-baseline ${isDark ? 'text-white' : 'text-gray-900'}`}>
            <Naira className="mr-0.5 text-xl" />{Number(metrics.totalReferralBonusesPaid).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-gray-400 mt-2 font-mono flex items-baseline">
            <Naira className="mr-0.5 text-xs" />1,000 / Activated Referee
          </div>
        </div>

        <div className={`p-5 rounded-2xl border ${isDark ? 'bg-[#161A23] border-gray-800' : 'bg-white border-gray-200 shadow-sm'}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-400">Total Referrals Enrolled</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className={`text-2xl font-bold mt-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {metrics.totalReferralsCount}
          </div>
          <div className="text-xs text-gray-400 mt-2">Invited Customer Accounts</div>
        </div>

        <div className={`p-5 rounded-2xl border ${isDark ? 'bg-[#161A23] border-gray-800' : 'bg-white border-gray-200 shadow-sm'}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-400">Pending Qualification</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className={`text-2xl font-bold mt-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {metrics.pendingReferralsCount}
          </div>
          <div className="text-xs text-amber-400 mt-2">Awaiting First Wallet Deposit</div>
        </div>

        <div className={`p-5 rounded-2xl border ${isDark ? 'bg-[#161A23] border-gray-800' : 'bg-white border-gray-200 shadow-sm'}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-400">Conversion Rate</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className={`text-2xl font-bold mt-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {conversionRate}%
          </div>
          <div className="text-xs text-emerald-400 mt-2">Qualified vs Enrolled</div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-[#161A23] border-gray-800' : 'bg-white border-slate-200 shadow-sm'}`}>
        <div className={`p-4 border-b flex flex-col md:flex-row md:items-center justify-between gap-3 ${isDark ? 'border-gray-800/60' : 'border-slate-200'}`}>
          <div className="flex items-center gap-3">
            <h2 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Referral Commission Registry
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
                All ({allReferrals.length})
              </button>
              <button
                onClick={() => setStatusFilter('paid')}
                className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                  statusFilter === 'paid'
                    ? 'bg-emerald-500 text-white font-bold shadow-xs'
                    : isDark ? 'text-gray-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Paid ({paidCount})
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
              placeholder="Search referrer, referee, code, phone..."
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
                <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono">Referrer (Inviter)</th>
                <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono">Referred Customer</th>
                <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono text-center">Referral Code</th>
                <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono text-right">Commission Bonus</th>
                <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono text-center">Payout Status</th>
                <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono text-right">Enrollment Date</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-gray-800/60 bg-[#161A23]' : 'divide-slate-100 bg-white'}`}>
              {filteredReferrals.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center mx-auto mb-3">
                      <Gift className="w-6 h-6" />
                    </div>
                    <p className={`text-sm font-semibold ${isDark ? 'text-gray-200' : 'text-slate-800'}`}>
                      No referral records found
                    </p>
                    <p className={`text-xs mt-1 max-w-sm mx-auto ${isDark ? 'text-gray-500' : 'text-slate-400'}`}>
                      {search ? 'Try adjusting your search keywords or status filter.' : 'When customers share their referral link and onboard friends, entries will appear here.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredReferrals.map((r: any) => (
                  <tr key={r.id} className={`${isDark ? 'hover:bg-gray-800/20' : 'hover:bg-slate-50/80'} transition-colors`}>
                    <td className="py-4 px-4 sm:px-5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center text-xs font-bold shrink-0">
                          {r.referrerName?.charAt(0) || 'U'}
                        </div>
                        <div>
                          <div className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{r.referrerName}</div>
                          <div className={`text-xs font-mono mt-0.5 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>{r.referrerPhone}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 sm:px-5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-bold shrink-0">
                          {r.refereeName?.charAt(0) || 'R'}
                        </div>
                        <div>
                          <div className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{r.refereeName}</div>
                          <div className={`text-xs font-mono mt-0.5 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>{r.refereePhone}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 sm:px-5 text-center">
                      <button
                        onClick={() => copyToClipboard(r.referralCode)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-mono font-bold text-xs transition-all ${
                          isDark
                            ? 'bg-gray-900 border border-gray-800 text-[#F0B90B] hover:border-[#F0B90B]/50'
                            : 'bg-slate-100 border border-slate-200 text-[#181A20] hover:border-[#F0B90B]'
                        }`}
                        title="Click to copy referral code"
                      >
                        {r.referralCode}
                        {copiedCode === r.referralCode ? (
                          <Check className="w-3 h-3 text-emerald-500" />
                        ) : (
                          <Copy className="w-3 h-3 text-gray-400" />
                        )}
                      </button>
                    </td>
                    <td className="py-4 px-4 sm:px-5 text-right font-mono tabular-nums font-bold text-sm text-emerald-600 dark:text-emerald-400">
                      <span className="inline-flex items-baseline justify-end">
                        <Naira className="mr-0.5 text-xs text-emerald-600 dark:text-emerald-400" />
                        {Number(r.bonusAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td className="py-4 px-4 sm:px-5 text-center">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider font-mono ${
                          r.status === 'paid'
                            ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                        }`}
                      >
                        {r.status === 'paid' ? 'Paid' : 'Pending Deposit'}
                      </span>
                    </td>
                    <td className="py-4 px-4 sm:px-5 text-right font-mono text-xs text-slate-500 dark:text-gray-400">
                      {new Date(r.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
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
