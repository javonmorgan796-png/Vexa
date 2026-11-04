import React, { useState, useEffect } from 'react';
import { useAdmin } from '../AdminContext';
import {
  ArrowUpRight,
  ShieldAlert,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Search,
  Check,
  X,
  ExternalLink,
} from 'lucide-react';

export const WithdrawalsTab: React.FC = () => {
  const { fetchAdminApi, adminTheme, hasPermission, refreshBadgeCounts } = useAdmin();
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    item: any | null;
    action: 'approve' | 'reject';
    reason: string;
  }>({ open: false, item: null, action: 'approve', reason: '' });

  const isDark = adminTheme === 'dark';

  const loadWithdrawals = async () => {
    try {
      setLoading(true);
      const res = await fetchAdminApi('/api/admin/withdrawals');
      setWithdrawals(res.withdrawals || []);
    } catch (err) {
      console.error('Failed to load withdrawals:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWithdrawals();
  }, []);

  const handleAction = async () => {
    if (!confirmModal.item) return;
    try {
      setSubmitting(true);
      await fetchAdminApi(`/api/admin/withdrawals/${confirmModal.item.id}/review`, {
        method: 'POST',
        body: JSON.stringify({
          action: confirmModal.action,
          reason: confirmModal.reason,
        }),
      });
      setConfirmModal({ open: false, item: null, action: 'approve', reason: '' });
      await loadWithdrawals();
      refreshBadgeCounts();
    } catch (err: any) {
      alert(err.message || 'Withdrawal review failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Outbound Withdrawals & Settlement Queue
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Interbank transfer requests with automated algorithmic fraud scoring and manual compliance approval.
          </p>
        </div>
      </div>

      <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-[#161A23] border-gray-800' : 'bg-white border-slate-200 shadow-sm'}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className={`border-b ${isDark ? 'border-gray-800 bg-[#12151D]/80 text-gray-400' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono">Reference</th>
                <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono">Customer</th>
                <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono">Beneficiary Account</th>
                <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono text-right">Amount</th>
                <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono text-center">Risk Analysis</th>
                <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono text-center">Status</th>
                <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono text-right">Actions</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-gray-800/60 bg-[#161A23]' : 'divide-slate-100 bg-white'}`}>
              {withdrawals.map((w) => (
                <tr key={w.id} className={`${isDark ? 'hover:bg-gray-800/20' : 'hover:bg-slate-50/80'} transition-colors`}>
                  <td className="py-4 px-4 sm:px-5 font-mono font-bold text-xs text-[#F0B90B]">{w.reference}</td>
                  <td className="py-4 px-4 sm:px-5">
                    <div className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{w.userName}</div>
                    <div className={`text-xs font-mono mt-0.5 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>{w.userPhone}</div>
                  </td>
                  <td className="py-4 px-4 sm:px-5">
                    <div className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>{w.recipientName}</div>
                    <div className={`text-xs font-mono mt-0.5 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                      {w.bankName} · {w.recipientAccount}
                    </div>
                  </td>
                  <td className="py-4 px-4 sm:px-5 text-right font-mono tabular-nums font-bold text-sm text-slate-900 dark:text-white">
                    ₦{Number(w.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-4 px-4 sm:px-5 text-center">
                    <div className="flex flex-col items-center">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider font-mono ${
                          w.riskScore === 'high'
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                            : w.riskScore === 'medium'
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                            : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        }`}
                      >
                        Risk: {w.riskScore}
                      </span>
                      {w.riskNotes && (
                        <div className="text-[11px] text-slate-400 dark:text-gray-500 mt-1 max-w-xs truncate">
                          {w.riskNotes}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-4 sm:px-5 text-center">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider font-mono ${
                        w.status === 'approved'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : w.status === 'pending'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}
                    >
                      {w.status}
                    </span>
                  </td>
                  <td className="py-4 px-4 sm:px-5 text-right">
                    {w.status === 'pending' && hasPermission('withdrawals.manage') ? (
                      <div className="flex items-center justify-end space-x-1.5">
                        <button
                          onClick={() => setConfirmModal({ open: true, item: w, action: 'reject', reason: '' })}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-colors"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => setConfirmModal({ open: true, item: w, action: 'approve', reason: '' })}
                          className="px-3 py-1 rounded-lg text-xs font-semibold bg-emerald-500 hover:bg-emerald-600 text-black font-semibold transition-colors"
                        >
                          Approve
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs font-mono text-slate-400 dark:text-gray-500">
                        {w.reviewedBy || 'Settled'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {withdrawals.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <p className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-slate-600'}`}>
                      No outbound withdrawal requests pending
                    </p>
                    <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-slate-400'}`}>
                      Customer interbank withdrawal requests will appear here for security review.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmModal.open && confirmModal.item && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className={`w-full max-w-md rounded-2xl p-6 shadow-2xl border ${isDark ? 'bg-[#161A23] border-gray-800 text-white' : 'bg-white border-slate-200 text-slate-900'}`}>
            <h3 className={`text-base font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {confirmModal.action === 'approve'
                ? 'Authorize Interbank Withdrawal Settlement'
                : 'Reject Withdrawal Request'}
            </h3>
            <p className="text-xs text-gray-400 mb-4">
              {confirmModal.action === 'approve'
                ? `You are authorizing outbound dispatch of ₦${Number(confirmModal.item.amount).toLocaleString()} to ${confirmModal.item.bankName} (${confirmModal.item.recipientAccount}).`
                : 'Rejecting this withdrawal will cancel settlement and notify customer security.'}
            </p>

            <div className={`p-3 rounded-xl border text-xs mb-4 font-mono space-y-1 ${isDark ? 'bg-gray-900 border-gray-800 text-gray-300' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
              <div>Customer: {confirmModal.item.userName}</div>
              <div>Beneficiary: {confirmModal.item.recipientName}</div>
              <div>Bank: {confirmModal.item.bankName}</div>
              <div className="text-amber-500 font-bold">Risk Assessment: {confirmModal.item.riskScore.toUpperCase()}</div>
            </div>

            {confirmModal.action === 'reject' && (
              <div className="mb-4">
                <label className="text-xs text-gray-400 mb-1 block">Rejection Reason</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Beneficiary name mismatch with regulatory KYC record..."
                  value={confirmModal.reason}
                  onChange={(e) => setConfirmModal((prev) => ({ ...prev, reason: e.target.value }))}
                  className={`w-full px-3 py-2 rounded-xl border text-xs focus:border-[#F0B90B] outline-none ${
                    isDark ? 'bg-gray-900 border-gray-800 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
              </div>
            )}

            <div className="flex items-center justify-end space-x-2">
              <button
                onClick={() => setConfirmModal({ open: false, item: null, action: 'approve', reason: '' })}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
                  isDark ? 'text-gray-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Cancel
              </button>
              <button
                disabled={submitting}
                onClick={handleAction}
                className={`px-5 py-2 rounded-xl text-xs font-semibold transition-colors ${
                  confirmModal.action === 'approve'
                    ? 'bg-emerald-500 hover:bg-emerald-600 text-black'
                    : 'bg-rose-500 hover:bg-rose-600 text-white'
                }`}
              >
                {submitting ? 'Executing...' : confirmModal.action === 'approve' ? 'Confirm Approval' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
