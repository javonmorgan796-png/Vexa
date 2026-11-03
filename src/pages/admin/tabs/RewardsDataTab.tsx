import React, { useState, useEffect } from 'react';
import { useAdmin } from '../AdminContext';
import {
  Gift,
  Percent,
  Users,
  CheckCircle2,
  Clock,
  Search,
  ArrowDownLeft,
  Sparkles,
} from 'lucide-react';

export const RewardsDataTab: React.FC = () => {
  const { fetchAdminApi, adminTheme } = useAdmin();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState<'cashback' | 'referrals'>('cashback');
  const [search, setSearch] = useState('');

  const isDark = adminTheme === 'dark';

  const loadRewardsData = async () => {
    try {
      setLoading(true);
      const res = await fetchAdminApi('/api/admin/rewards');
      setData(res);
    } catch (err) {
      console.error('Failed to load rewards data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRewardsData();
  }, []);

  const metrics = data?.metrics || {
    totalCashbackDisbursed: 0,
    totalReferralBonusesPaid: 0,
    totalReferralsCount: 0,
    pendingReferralsCount: 0,
  };

  const cashbackHistory = (data?.cashbackHistory || []).filter((c: any) => {
    return (
      !search ||
      c.userName.toLowerCase().includes(search.toLowerCase()) ||
      c.description.toLowerCase().includes(search.toLowerCase()) ||
      c.userPhone.includes(search)
    );
  });

  const referrals = (data?.referrals || []).filter((r: any) => {
    return (
      !search ||
      r.referrerName.toLowerCase().includes(search.toLowerCase()) ||
      r.refereeName.toLowerCase().includes(search.toLowerCase()) ||
      r.referralCode.toLowerCase().includes(search.toLowerCase()) ||
      r.referrerPhone.includes(search)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Referral Program & Cashback History Ledger
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Audit customer reward disbursements, airtime/bill cashback percentages, and multi-tier referral bonuses.
          </p>
        </div>

        {/* Sub-tab switcher */}
        <div className={`flex items-center space-x-1 p-1 rounded-xl border ${isDark ? 'bg-gray-900/40 border-gray-800' : 'bg-slate-100 border-slate-200'}`}>
          <button
            onClick={() => setActiveSubTab('cashback')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeSubTab === 'cashback'
                ? 'bg-[#F0B90B] text-black shadow-sm font-bold'
                : isDark
                ? 'text-gray-400 hover:text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Cashback History ({cashbackHistory.length})
          </button>
          <button
            onClick={() => setActiveSubTab('referrals')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeSubTab === 'referrals'
                ? 'bg-[#F0B90B] text-black shadow-sm font-bold'
                : isDark
                ? 'text-gray-400 hover:text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Referral Program ({referrals.length})
          </button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={`p-5 rounded-2xl border ${isDark ? 'bg-[#161A23] border-gray-800' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-400">Total Cashback Disbursed</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
              <Percent className="w-5 h-5" />
            </div>
          </div>
          <div className={`text-2xl font-bold mt-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            ₦{Number(metrics.totalCashbackDisbursed).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-emerald-400 mt-2 font-mono">Credited To User Wallets</div>
        </div>

        <div className={`p-5 rounded-2xl border ${isDark ? 'bg-[#161A23] border-gray-800' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-400">Referral Bonuses Paid</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-[#F0B90B]">
              <Gift className="w-5 h-5" />
            </div>
          </div>
          <div className={`text-2xl font-bold mt-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            ₦{Number(metrics.totalReferralBonusesPaid).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-gray-400 mt-2 font-mono">₦1,000 / Activated Referee</div>
        </div>

        <div className={`p-5 rounded-2xl border ${isDark ? 'bg-[#161A23] border-gray-800' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-400">Total Referrals Enrolled</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className={`text-2xl font-bold mt-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {metrics.totalReferralsCount}
          </div>
          <div className="text-xs text-gray-400 mt-2">Invited Customers</div>
        </div>

        <div className={`p-5 rounded-2xl border ${isDark ? 'bg-[#161A23] border-gray-800' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-400">Pending Referral Qualification</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-500">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className={`text-2xl font-bold mt-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {metrics.pendingReferralsCount}
          </div>
          <div className="text-xs text-amber-400 mt-2">Awaiting First Wallet Deposit</div>
        </div>
      </div>

      {/* Main Table for Active SubTab */}
      <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-[#161A23] border-gray-800' : 'bg-white border-slate-200 shadow-sm'}`}>
        <div className={`p-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${isDark ? 'border-gray-800/60' : 'border-slate-200'}`}>
          <div className="flex items-center space-x-2">
            <h2 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {activeSubTab === 'cashback' ? 'Cashback Event History' : 'Referral Commission Registry'}
            </h2>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search user, phone, code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`pl-9 pr-3 py-1.5 rounded-xl border text-xs outline-none w-64 transition-colors ${
                isDark
                  ? 'bg-gray-900 border-gray-800 text-white focus:border-[#F0B90B]'
                  : 'bg-white border-slate-300 text-slate-900 focus:border-[#F0B90B] shadow-xs'
              }`}
            />
          </div>
        </div>

        {activeSubTab === 'cashback' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className={`border-b ${isDark ? 'border-gray-800 bg-gray-900/30 text-gray-400' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
                  <th className="py-3 px-4 font-semibold">Customer</th>
                  <th className="py-3 px-4 font-semibold">Eligible Transaction Description</th>
                  <th className="py-3 px-4 font-semibold">Cashback Rate</th>
                  <th className="py-3 px-4 font-semibold">Earned Reward</th>
                  <th className="py-3 px-4 font-semibold">Settlement Status</th>
                  <th className="py-3 px-4 font-semibold">Date</th>
                </tr>
              </thead>
              <tbody className={`divide-y font-mono ${isDark ? 'divide-gray-800/40' : 'divide-slate-100'}`}>
                {cashbackHistory.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center font-sans">
                      <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                        No cashback rewards disbursed yet.
                      </p>
                      <p className="text-[11px] text-gray-500 mt-1">
                        Cashback credits earned from bill payments and card transactions will appear here.
                      </p>
                    </td>
                  </tr>
                ) : (
                  cashbackHistory.map((c: any) => (
                    <tr key={c.id} className={`${isDark ? 'hover:bg-gray-800/20' : 'hover:bg-slate-50/80'} transition-colors`}>
                      <td className="py-3.5 px-4 font-sans">
                        <div className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{c.userName}</div>
                        <div className={`text-[11px] font-mono ${isDark ? 'text-gray-400' : 'text-slate-400'}`}>{c.userPhone}</div>
                      </td>
                      <td className={`py-3.5 px-4 font-sans ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>{c.description}</td>
                      <td className="py-3.5 px-4 text-[#F0B90B] font-bold">{c.rate}</td>
                      <td className="py-3.5 px-4 font-bold text-emerald-500 text-sm">
                        +₦{Number(c.earned).toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                            c.status === 'cleared'
                              ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                              : 'bg-purple-500/10 text-purple-500 border border-purple-500/20'
                          }`}
                        >
                          {c.status}
                        </span>
                      </td>
                      <td className={`py-3.5 px-4 text-[11px] ${isDark ? 'text-gray-400' : 'text-slate-400'}`}>{c.date}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className={`border-b ${isDark ? 'border-gray-800 bg-gray-900/30 text-gray-400' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
                  <th className="py-3 px-4 font-semibold">Referrer (Inviter)</th>
                  <th className="py-3 px-4 font-semibold">Referred Customer (Referee)</th>
                  <th className="py-3 px-4 font-semibold">Referral Code</th>
                  <th className="py-3 px-4 font-semibold">Reward Bonus</th>
                  <th className="py-3 px-4 font-semibold">Payout Status</th>
                  <th className="py-3 px-4 font-semibold">Enrollment Date</th>
                </tr>
              </thead>
              <tbody className={`divide-y font-mono ${isDark ? 'divide-gray-800/40' : 'divide-slate-100'}`}>
                {referrals.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center font-sans">
                      <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                        No referral rewards or invites recorded yet.
                      </p>
                      <p className="text-[11px] text-gray-500 mt-1">
                        Completed peer referrals and onboarding bonuses will stream here.
                      </p>
                    </td>
                  </tr>
                ) : (
                  referrals.map((r: any) => (
                    <tr key={r.id} className={`${isDark ? 'hover:bg-gray-800/20' : 'hover:bg-slate-50/80'} transition-colors`}>
                      <td className="py-3.5 px-4 font-sans">
                        <div className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{r.referrerName}</div>
                        <div className={`text-[11px] font-mono ${isDark ? 'text-gray-400' : 'text-slate-400'}`}>{r.referrerPhone}</div>
                      </td>
                      <td className="py-3.5 px-4 font-sans">
                        <div className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{r.refereeName}</div>
                        <div className={`text-[11px] font-mono ${isDark ? 'text-gray-400' : 'text-slate-400'}`}>{r.refereePhone}</div>
                      </td>
                      <td className="py-3.5 px-4 text-[#F0B90B] font-bold">{r.referralCode}</td>
                      <td className="py-3.5 px-4 font-bold text-emerald-500 text-sm">
                        ₦{Number(r.bonusAmount).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                            r.status === 'paid'
                              ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                              : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                          }`}
                        >
                          {r.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className={`py-3.5 px-4 text-[11px] ${isDark ? 'text-gray-400' : 'text-slate-400'}`}>
                        {new Date(r.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
