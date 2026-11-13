import React, { useState, useEffect } from 'react';
import { useAdmin } from '../AdminContext';
import { Naira } from '@/components/Naira';
import {
  ArrowDownLeft,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  HelpCircle,
  X,
  RefreshCw,
} from 'lucide-react';

export const DepositsTab: React.FC = () => {
  const { fetchAdminApi, adminTheme, hasPermission, refreshBadgeCounts } = useAdmin();
  const [deposits, setDeposits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [resolveModalOpen, setResolveModalOpen] = useState(false);
  const [selectedDeposit, setSelectedDeposit] = useState<any>(null);
  const [resolveNotes, setResolveNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isDark = adminTheme === 'dark';

  const loadDeposits = async () => {
    try {
      setLoading(true);
      const res = await fetchAdminApi('/api/admin/deposits');
      setDeposits(res.deposits || []);
    } catch (err) {
      console.error('Failed to load deposits:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDeposits();
  }, []);

  const handleResolveDeposit = async () => {
    if (!selectedDeposit) return;
    try {
      setSubmitting(true);
      await fetchAdminApi(`/api/admin/deposits/${selectedDeposit.id}/resolve`, {
        method: 'POST',
        body: JSON.stringify({ action: 'credit_wallet', notes: resolveNotes }),
      });
      setSelectedDeposit((prev: any) => ({ ...prev, status: 'successful' }));
      setResolveModalOpen(false);
      setResolveNotes('');
      await loadDeposits();
      refreshBadgeCounts();
    } catch (err: any) {
      alert(err.message || 'Resolve failed');
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = deposits.filter((d) => {
    return (
      !search ||
      d.reference.toLowerCase().includes(search.toLowerCase()) ||
      d.user.toLowerCase().includes(search.toLowerCase()) ||
      d.phone.includes(search)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Deposit Rails & Gateway Settlement
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Monitor inbound card authorizations, direct virtual account transfers, and investigate disputed deposits.
          </p>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search deposit reference or user..."
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

      <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-[#161A23] border-gray-800' : 'bg-white border-slate-200 shadow-sm'}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className={`border-b ${isDark ? 'border-gray-800 bg-[#12151D]/80 text-gray-400' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono">Gateway Reference</th>
                <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono">Customer</th>
                <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono">Channel</th>
                <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono text-right">Amount</th>
                <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono text-center">Status</th>
                <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono text-right">Timestamp</th>
                <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono text-right">Actions</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-gray-800/60 bg-[#161A23]' : 'divide-slate-100 bg-white'}`}>
              {filtered.map((d) => (
                <tr key={d.id} className={`${isDark ? 'hover:bg-gray-800/20' : 'hover:bg-slate-50/80'} transition-colors`}>
                  <td className="py-4 px-4 sm:px-5 font-mono font-bold text-xs text-[#F0B90B]">{d.reference}</td>
                  <td className="py-4 px-4 sm:px-5">
                    <div className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{d.user}</div>
                    <div className={`text-xs font-mono mt-0.5 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>{d.phone}</div>
                  </td>
                  <td className="py-4 px-4 sm:px-5">
                    <span className={`text-xs font-medium uppercase tracking-wide ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>{d.channel}</span>
                  </td>
                  <td className={`py-4 px-4 sm:px-5 text-right font-mono tabular-nums font-bold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    <span className="inline-flex items-baseline justify-end">
                      <Naira className="mr-0.5 text-xs" />{Number(d.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </td>
                  <td className="py-4 px-4 sm:px-5 text-center">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider font-mono ${
                        d.status === 'successful'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}
                    >
                      {d.status}
                    </span>
                  </td>
                  <td className={`py-4 px-4 sm:px-5 text-right font-mono text-xs ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                    <div>{new Date(d.createdAt).toLocaleDateString(undefined, { dateStyle: 'short' })}</div>
                    <div className={`text-[11px] ${isDark ? 'text-gray-500' : 'text-slate-400'}`}>{new Date(d.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                  </td>
                  <td className="py-4 px-4 sm:px-5 text-right">
                    {d.status === 'failed' && hasPermission('deposits.manage') ? (
                      <button
                        onClick={() => {
                          setSelectedDeposit(d);
                          setResolveModalOpen(true);
                        }}
                        className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-black font-semibold rounded-lg text-xs transition-colors"
                      >
                        Investigate & Credit
                      </button>
                    ) : (
                      <span className={`text-xs font-mono ${isDark ? 'text-gray-500' : 'text-slate-400'}`}>Settled</span>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <p className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-slate-600'}`}>
                      No inbound deposits found
                    </p>
                    <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-slate-400'}`}>
                      Incoming Paystack and bank transfer deposits will appear here.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Investigate Modal */}
      {resolveModalOpen && selectedDeposit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className={`w-full max-w-md rounded-2xl p-6 shadow-2xl border ${isDark ? 'bg-[#161A23] border-gray-800 text-white' : 'bg-white border-slate-200 text-slate-900'}`}>
            <h3 className={`text-base font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>Resolve Failed Inbound Deposit</h3>
            <p className="text-xs text-gray-400 mb-4">
              If the customer payment cleared on the external bank statement or Paystack dashboard, you can authorize a manual wallet credit with audit trail.
            </p>

            <div className={`p-3 rounded-xl border text-xs mb-4 font-mono ${isDark ? 'bg-gray-900 border-gray-800 text-gray-300' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
              <div>Reference: {selectedDeposit.reference}</div>
              <div>Customer: {selectedDeposit.user} ({selectedDeposit.phone})</div>
              <div className="flex items-baseline">Amount: <Naira className="ml-1 mr-0.5 text-xs" />{Number(selectedDeposit.amount).toLocaleString()}</div>
            </div>

            <label className="text-xs text-gray-400 mb-1 block">Resolution Audit Note</label>
            <textarea
              rows={3}
              placeholder="e.g. Verified Paystack transaction ID #8928392 cleared in Zenith Bank merchant account..."
              value={resolveNotes}
              onChange={(e) => setResolveNotes(e.target.value)}
              className={`w-full px-3 py-2 rounded-xl border text-xs focus:border-[#F0B90B] outline-none mb-4 ${
                isDark ? 'bg-gray-900 border-gray-800 text-white' : 'bg-white border-slate-300 text-slate-900'
              }`}
            />

            <div className="flex items-center justify-end space-x-2">
              <button
                onClick={() => setResolveModalOpen(false)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
                  isDark ? 'text-gray-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Cancel
              </button>
              <button
                disabled={submitting}
                onClick={handleResolveDeposit}
                className="px-5 py-2 bg-[#F0B90B] hover:bg-[#d9a606] text-black font-semibold rounded-xl text-xs transition-colors"
              >
                {submitting ? 'Crediting...' : 'Confirm Credit to Customer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
