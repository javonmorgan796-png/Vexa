import React, { useState, useEffect } from 'react';
import { useAdmin } from '../AdminContext';
import {
  FileCheck2,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  AlertCircle,
  X,
  ExternalLink,
  Shield,
} from 'lucide-react';

export const KycManagementTab: React.FC = () => {
  const { fetchAdminApi, adminTheme, hasPermission } = useAdmin();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected'>('pending');

  const [inspectRequest, setInspectRequest] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isDark = adminTheme === 'dark';

  const loadKyc = async () => {
    try {
      setLoading(true);
      const res = await fetchAdminApi('/api/admin/kyc');
      setRequests(res.requests || []);
    } catch (err) {
      console.error('Failed to load KYC requests:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadKyc();
  }, []);

  const filtered = requests.filter((r) => r.status === activeTab);

  const handleReview = async (id: string, action: 'approve' | 'reject', reason?: string) => {
    try {
      setSubmitting(true);
      await fetchAdminApi(`/api/admin/kyc/${id}/review`, {
        method: 'POST',
        body: JSON.stringify({ action, reason }),
      });
      setInspectRequest(null);
      setRejectModalOpen(false);
      setRejectReason('');
      loadKyc();
    } catch (err: any) {
      alert(err.message || 'Review failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            KYC & Identity Verification Desk
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Audit customer government identity documents, biometrics, and Tier 2/3 upgrade requests.
          </p>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center space-x-1 p-1 bg-gray-900/40 rounded-xl border border-gray-800">
          {(['pending', 'approved', 'rejected'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                activeTab === tab
                  ? 'bg-[#F0B90B] text-black shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {tab} ({requests.filter((r) => r.status === tab).length})
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-[#161A23] border-gray-800' : 'bg-white border-slate-200 shadow-sm'}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className={`border-b ${isDark ? 'border-gray-800 bg-[#12151D]/80 text-gray-400' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono">Applicant</th>
                <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono text-center">Document Type</th>
                <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono">Identification Number</th>
                <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono text-right">Submitted</th>
                <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono text-center">Status</th>
                <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono text-right">Actions</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-gray-800/60 bg-[#161A23]' : 'divide-slate-100 bg-white'}`}>
              {filtered.map((r) => (
                <tr key={r.id} className={`${isDark ? 'hover:bg-gray-800/20' : 'hover:bg-slate-50/80'} transition-colors`}>
                  <td className="py-4 px-4 sm:px-5">
                    <div className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{r.userName}</div>
                    <div className={`text-xs font-mono mt-0.5 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>{r.userPhone}</div>
                  </td>
                  <td className="py-4 px-4 sm:px-5 text-center">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-mono font-medium ${
                      isDark ? 'bg-gray-800 text-gray-300' : 'bg-slate-100 text-slate-700'
                    }`}>
                      {r.idType}
                    </span>
                  </td>
                  <td className="py-4 px-4 sm:px-5 font-mono font-bold text-xs text-[#F0B90B]">
                    {r.idNumber}
                  </td>
                  <td className="py-4 px-4 sm:px-5 text-right font-mono text-xs text-slate-500 dark:text-gray-400">
                    <div>{new Date(r.createdAt).toLocaleDateString(undefined, { dateStyle: 'short' })}</div>
                    <div className="text-[11px] text-slate-400 dark:text-gray-500">{new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                  </td>
                  <td className="py-4 px-4 sm:px-5 text-center">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider font-mono ${
                        r.status === 'approved'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : r.status === 'pending'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="py-4 px-4 sm:px-5 text-right">
                    <button
                      onClick={() => setInspectRequest(r)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors inline-flex items-center space-x-1.5 ${
                        isDark
                          ? 'bg-gray-800 hover:bg-gray-700 text-gray-200 border-gray-700'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
                      }`}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Review Docs</span>
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <p className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-slate-600'}`}>
                      No KYC requests under {activeTab} status
                    </p>
                    <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-slate-400'}`}>
                      Incoming customer verification submissions will appear here.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Document Review Modal */}
      {inspectRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className={`w-full max-w-2xl rounded-2xl p-6 shadow-2xl overflow-y-auto max-h-[90vh] border ${
            isDark ? 'bg-[#161A23] border-gray-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className={`flex items-center justify-between pb-3 border-b ${isDark ? 'border-gray-800' : 'border-slate-200'}`}>
              <div className="flex items-center space-x-2">
                <FileCheck2 className="w-5 h-5 text-[#F0B90B]" />
                <h2 className="text-base font-bold">Review KYC Verification Document</h2>
              </div>
              <button onClick={() => setInspectRequest(null)} className={`transition-colors ${isDark ? 'text-gray-400 hover:text-white' : 'text-slate-400 hover:text-slate-700'}`}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className={`grid grid-cols-2 gap-4 my-4 p-4 rounded-xl border text-xs font-mono ${
              isDark ? 'bg-gray-900/60 border-gray-800' : 'bg-slate-50 border-slate-200'
            }`}>
              <div>
                <span className="text-gray-400 font-sans">Customer Name:</span>
                <div className={`font-bold text-sm mt-0.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>{inspectRequest.userName}</div>
              </div>
              <div>
                <span className="text-gray-400 font-sans">Customer Phone:</span>
                <div className={`font-bold text-sm mt-0.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>{inspectRequest.userPhone}</div>
              </div>
              <div>
                <span className="text-gray-400 font-sans">ID Document Category:</span>
                <div className="text-[#F0B90B] font-bold mt-0.5">{inspectRequest.idType}</div>
              </div>
              <div>
                <span className="text-gray-400 font-sans">Document / NIN Number:</span>
                <div className="text-emerald-500 font-bold mt-0.5">{inspectRequest.idNumber}</div>
              </div>
            </div>

            {/* Document Preview Images */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div>
                <div className={`text-xs font-semibold mb-2 ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>Government Issued ID</div>
                <div className={`rounded-xl border overflow-hidden h-48 flex items-center justify-center ${
                  isDark ? 'border-gray-800 bg-black/40' : 'border-slate-200 bg-slate-100'
                }`}>
                  <img
                    src={inspectRequest.documentUrl}
                    alt="ID Document"
                    className="w-full h-full object-cover hover:scale-105 transition-transform cursor-pointer"
                  />
                </div>
              </div>
              <div>
                <div className={`text-xs font-semibold mb-2 ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>Facial Biometric Selfie</div>
                <div className={`rounded-xl border overflow-hidden h-48 flex items-center justify-center ${
                  isDark ? 'border-gray-800 bg-black/40' : 'border-slate-200 bg-slate-100'
                }`}>
                  <img
                    src={inspectRequest.selfieUrl}
                    alt="Selfie"
                    className="w-full h-full object-cover hover:scale-105 transition-transform cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {inspectRequest.rejectionReason && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400 mb-4">
                <span className="font-bold">Prior Rejection Reason: </span>
                {inspectRequest.rejectionReason}
              </div>
            )}

            {/* Action Buttons */}
            {inspectRequest.status === 'pending' && hasPermission('kyc.manage') && (
              <div className={`flex items-center justify-end space-x-3 pt-3 border-t ${isDark ? 'border-gray-800' : 'border-slate-200'}`}>
                <button
                  type="button"
                  onClick={() => setRejectModalOpen(true)}
                  disabled={submitting}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-colors flex items-center space-x-1.5"
                >
                  <XCircle className="w-4 h-4" />
                  <span>Reject Application</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleReview(inspectRequest.id, 'approve')}
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-emerald-500 hover:bg-emerald-600 text-black transition-colors flex items-center space-x-1.5 shadow-sm"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>{submitting ? 'Approving...' : 'Approve & Upgrade Tier'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reject Reason Dialog */}
      {rejectModalOpen && inspectRequest && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className={`w-full max-w-md rounded-2xl p-6 shadow-2xl border ${
            isDark ? 'bg-[#161A23] border-gray-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <h3 className="text-base font-bold text-rose-500 mb-2">Reject KYC Submission</h3>
            <p className="text-xs text-gray-400 mb-4">
              Specify the exact reason for rejecting this document so the customer is notified and can re-upload correctly.
            </p>
            <textarea
              required
              rows={3}
              placeholder="e.g. Document image is blurry / NIN number does not match name / selfie face obscured..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className={`w-full px-3 py-2 rounded-xl border text-xs focus:border-rose-500 outline-none mb-4 ${
                isDark ? 'bg-gray-900 border-gray-800 text-white' : 'bg-white border-slate-300 text-slate-900'
              }`}
            />
            <div className="flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setRejectModalOpen(false)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
                  isDark ? 'text-gray-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!rejectReason || submitting}
                onClick={() => handleReview(inspectRequest.id, 'reject', rejectReason)}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-rose-500 hover:bg-rose-600 text-white transition-colors"
              >
                {submitting ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
