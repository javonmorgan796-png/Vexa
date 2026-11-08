import React, { useState, useEffect } from 'react';
import { useAdmin } from '../AdminContext';
import { Naira } from '@/components/Naira';
import {
  BriefcaseBusiness,
  Building2,
  Users,
  Wallet,
  ArrowUpRight,
  Search,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Unlock,
  X,
  CreditCard,
  FileText,
} from 'lucide-react';

export const BusinessDataTab: React.FC = () => {
  const { fetchAdminApi, adminTheme, hasPermission } = useAdmin();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedBiz, setSelectedBiz] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  const isDark = adminTheme === 'dark';

  const loadBusinessData = async () => {
    try {
      setLoading(true);
      const res = await fetchAdminApi('/api/admin/business');
      setData(res);
    } catch (err) {
      console.error('Failed to load business data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBusinessData();
  }, []);

  const handleToggleStatus = async (biz: any) => {
    const nextStatus = biz.status === 'suspended' ? 'active' : 'suspended';
    try {
      setSubmitting(true);
      await fetchAdminApi(`/api/admin/business/${biz.id}/status`, {
        method: 'POST',
        body: JSON.stringify({
          status: nextStatus,
          reason: `Admin status update to ${nextStatus}`,
        }),
      });
      setSelectedBiz((prev: any) => (prev ? { ...prev, status: nextStatus } : null));
      loadBusinessData();
    } catch (err: any) {
      alert(err.message || 'Status update failed');
    } finally {
      setSubmitting(false);
    }
  };

  const metrics = data?.metrics || {
    totalBusinesses: 0,
    totalCorporateBalance: 0,
    totalEmployeesManaged: 0,
    monthlyPayrollVolume: 0,
  };

  const businesses = (data?.businesses || []).filter((b: any) => {
    return (
      !search ||
      b.businessName.toLowerCase().includes(search.toLowerCase()) ||
      b.ownerName.toLowerCase().includes(search.toLowerCase()) ||
      b.ownerPhone.includes(search) ||
      b.accountNumber.includes(search)
    );
  });

  const corporateTransactions = data?.corporateTransactions || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Business Banking, Corporate Accounts & Payroll
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Audit registered enterprise entities, merchant settlements, corporate treasury balances, and bulk payroll disbursements.
          </p>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search business name, RC, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`w-64 sm:w-80 pl-9 pr-3 py-2 rounded-xl text-xs border outline-none ${
              isDark
                ? 'bg-[#161A23] border-gray-800 text-white placeholder-gray-500 focus:border-[#F0B90B]'
                : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-[#F0B90B]'
            }`}
          />
        </div>
      </div>

      {/* Corporate Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={`p-5 rounded-2xl border ${isDark ? 'bg-[#161A23] border-gray-800' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-400">Total Registered Businesses</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
          <div className={`text-2xl font-bold mt-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {metrics.totalBusinesses}
          </div>
          <div className="text-xs text-gray-400 mt-2">Active Commercial Entities</div>
        </div>

        <div className={`p-5 rounded-2xl border ${isDark ? 'bg-[#161A23] border-gray-800' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-400">Total Corporate Treasury</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-[#F0B90B]">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className={`text-2xl font-bold mt-2 flex items-baseline ${isDark ? 'text-white' : 'text-gray-900'}`}>
            <Naira className="mr-0.5 text-xl" />{Number(metrics.totalCorporateBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-emerald-500 mt-2 font-semibold">Institutional Vault Balance</div>
        </div>

        <div className={`p-5 rounded-2xl border ${isDark ? 'bg-[#161A23] border-gray-800' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-400">Employees Enrolled</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-500">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className={`text-2xl font-bold mt-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {metrics.totalEmployeesManaged}
          </div>
          <div className="text-xs text-gray-400 mt-2">Active On Payroll Schedules</div>
        </div>

        <div className={`p-5 rounded-2xl border ${isDark ? 'bg-[#161A23] border-gray-800' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-400">Monthly Payroll Run</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
              <ArrowUpRight className="w-5 h-5" />
            </div>
          </div>
          <div className={`text-2xl font-bold mt-2 flex items-baseline ${isDark ? 'text-white' : 'text-gray-900'}`}>
            <Naira className="mr-0.5 text-xl" />{Number(metrics.monthlyPayrollVolume).toLocaleString()}
          </div>
          <div className="text-xs text-gray-400 mt-2 font-mono">Disbursed Automated</div>
        </div>
      </div>

      {/* Business Entities Table */}
      <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-[#161A23] border-gray-800' : 'bg-white border-slate-200 shadow-sm'}`}>
        <div className={`p-4 border-b flex items-center justify-between ${isDark ? 'border-gray-800/60' : 'border-slate-200'}`}>
          <h2 className={`text-sm font-bold flex items-center space-x-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            <BriefcaseBusiness className="w-4 h-4 text-[#F0B90B]" />
            <span>Corporate Banking Accounts Directory</span>
          </h2>
          <span className={`text-xs font-mono ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>{businesses.length} Businesses</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className={`border-b ${isDark ? 'border-gray-800 bg-[#0E1118] text-gray-400' : 'border-slate-200 bg-slate-100/80 text-slate-500'}`}>
                <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono">Business Entity</th>
                <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono">Industry / Category</th>
                <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono">Account Number</th>
                <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono text-right">Corporate Balance</th>
                <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono">Staff & Payroll</th>
                <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono text-center">Status</th>
                <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono text-right">Actions</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-gray-800/60' : 'divide-slate-100'}`}>
              {businesses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 px-4 text-center font-sans">
                    <p className={`text-sm font-semibold ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>
                      No business or corporate accounts registered yet.
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Enterprise onboarding submissions will appear here for administrative verification.
                    </p>
                  </td>
                </tr>
              ) : (
                businesses.map((biz: any) => (
                  <tr key={biz.id} className={`${isDark ? 'hover:bg-gray-800/30' : 'hover:bg-slate-50'} transition-colors`}>
                    <td className="py-4 px-4 sm:px-5 font-sans">
                      <div className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{biz.businessName}</div>
                      <div className={`text-xs font-mono mt-0.5 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                        Owner: {biz.ownerName} ({biz.ownerPhone})
                      </div>
                    </td>
                    <td className="py-4 px-4 sm:px-5 font-sans">
                      <span className={`px-2.5 py-1 rounded-md text-[11px] font-semibold ${isDark ? 'bg-gray-800 text-gray-300 border border-gray-700' : 'bg-slate-100 text-slate-700 border border-slate-200'}`}>
                        {biz.industry}
                      </span>
                    </td>
                    <td className="py-4 px-4 sm:px-5 text-[#F0B90B] font-mono font-bold text-xs">
                      {biz.accountNumber}
                    </td>
                    <td className={`py-4 px-4 sm:px-5 text-right font-mono tabular-nums font-bold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      <span className="inline-flex items-baseline justify-end">
                        <Naira className="mr-0.5 text-xs" />{Number(biz.balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td className="py-4 px-4 sm:px-5 font-sans">
                      <div className={`text-xs font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{biz.employeeCount} Employees</div>
                      <div className={`text-[11px] font-mono mt-0.5 flex items-baseline ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                        <Naira className="mr-0.5 text-[10px]" />{Number(biz.monthlyPayroll).toLocaleString()}/mo
                      </div>
                    </td>
                    <td className="py-4 px-4 sm:px-5 text-center">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider ${
                          biz.status === 'active'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {biz.status}
                      </span>
                    </td>
                    <td className="py-4 px-4 sm:px-5 text-right font-sans">
                      <button
                        onClick={() => setSelectedBiz(biz)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                          isDark ? 'bg-gray-800 hover:bg-gray-700 text-gray-200 border-gray-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                        }`}
                      >
                        Audit Entity
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Corporate Transactions Ledger */}
      <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-[#12151D] border-gray-800' : 'bg-white border-slate-200 shadow-sm'}`}>
        <div className={`p-4 border-b ${isDark ? 'border-gray-800/60' : 'border-slate-200'}`}>
          <h2 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Recent Enterprise Dispatches & Payroll Events</h2>
          <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>Corporate high-value transactions and automated scheduled disbursements.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className={`border-b ${isDark ? 'border-gray-800 bg-[#0E1118] text-gray-400' : 'border-slate-200 bg-slate-100/80 text-slate-500'}`}>
                <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono">Reference</th>
                <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono">Corporate Entity</th>
                <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono">Dispatch Type</th>
                <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono text-right">Total Amount</th>
                <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono text-center">Status</th>
                <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono text-right">Execution Time</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-gray-800/60' : 'divide-slate-100'}`}>
              {corporateTransactions.map((tx: any) => (
                <tr key={tx.id} className={`${isDark ? 'hover:bg-gray-800/30' : 'hover:bg-slate-50'} transition-colors`}>
                  <td className="py-4 px-4 sm:px-5 font-mono text-xs font-semibold text-[#F0B90B]">{tx.reference}</td>
                  <td className={`py-4 px-4 sm:px-5 font-sans font-semibold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>{tx.businessName}</td>
                  <td className={`py-4 px-4 sm:px-5 font-sans text-xs ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>
                    {tx.type} {tx.recipientsCount > 1 && `(${tx.recipientsCount} staff)`}
                  </td>
                  <td className={`py-4 px-4 sm:px-5 text-right font-mono tabular-nums font-bold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    <span className="inline-flex items-baseline justify-end">
                      <Naira className="mr-0.5 text-xs" />{Number(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </td>
                  <td className="py-4 px-4 sm:px-5 text-center">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-wide">
                      {tx.status}
                    </span>
                  </td>
                  <td className={`py-4 px-4 sm:px-5 text-right font-mono text-xs ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                    {new Date(tx.timestamp).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inspect Business Drawer / Modal */}
      {selectedBiz && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className={`w-full max-w-lg rounded-2xl p-6 shadow-2xl border ${isDark ? 'bg-[#161A23] border-gray-800 text-white' : 'bg-white border-slate-200 text-slate-900'}`}>
            <div className={`flex items-center justify-between pb-3 border-b ${isDark ? 'border-gray-800' : 'border-slate-200'}`}>
              <h3 className="text-base font-bold flex items-center space-x-2">
                <Building2 className="w-5 h-5 text-[#F0B90B]" />
                <span>Enterprise Profile Audit: {selectedBiz.businessName}</span>
              </h3>
              <button onClick={() => setSelectedBiz(null)} className={isDark ? 'text-gray-400 hover:text-white' : 'text-slate-400 hover:text-slate-700'}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="my-4 space-y-3 text-xs font-mono">
              <div className={`p-3 rounded-xl border space-y-1 ${isDark ? 'bg-gray-900 border-gray-800 text-gray-300' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                <div>Corporate Account: <strong className="text-[#F0B90B]">{selectedBiz.accountNumber}</strong></div>
                <div className="flex items-baseline">Treasury Balance: <strong className="ml-1 inline-flex items-baseline"><Naira className="mr-0.5 text-xs font-bold" />{Number(selectedBiz.balance).toLocaleString()}</strong></div>
                <div>Industry: {selectedBiz.industry}</div>
                <div>Owner/Signatory: {selectedBiz.ownerName} ({selectedBiz.ownerPhone})</div>
                <div>Email: {selectedBiz.email}</div>
                <div className="flex items-baseline">Single Transfer Limit: <span className="ml-1 inline-flex items-baseline"><Naira className="mr-0.5 text-xs font-bold" />{Number(selectedBiz.transactionLimit).toLocaleString()}</span></div>
              </div>

              <div className={`p-3 rounded-xl border space-y-1 ${isDark ? 'bg-gray-900/60 border-gray-800 text-gray-300' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                <div>Enrolled Employees: {selectedBiz.employeeCount}</div>
                <div className="flex items-baseline">Payroll Budget: <span className="mx-1 inline-flex items-baseline"><Naira className="mr-0.5 text-xs font-bold" />{Number(selectedBiz.monthlyPayroll).toLocaleString()}</span> / month</div>
                <div>Status: <span className="uppercase text-emerald-500 font-bold">{selectedBiz.status}</span></div>
              </div>
            </div>

            <div className={`flex items-center justify-between pt-3 border-t ${isDark ? 'border-gray-800' : 'border-slate-200'}`}>
              <button
                disabled={submitting}
                onClick={() => handleToggleStatus(selectedBiz)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-colors flex items-center space-x-1.5 ${
                  selectedBiz.status === 'suspended'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20'
                }`}
              >
                {selectedBiz.status === 'suspended' ? (
                  <>
                    <Unlock className="w-3.5 h-3.5" />
                    <span>Unfreeze Business Account</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5" />
                    <span>Freeze Corporate Account</span>
                  </>
                )}
              </button>

              <button
                onClick={() => setSelectedBiz(null)}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-xl text-xs font-semibold"
              >
                Close Audit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
