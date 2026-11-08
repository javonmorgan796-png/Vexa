import React, { useState, useEffect } from 'react';
import { useAdmin } from '../AdminContext';
import { Naira } from '@/components/Naira';
import {
  Search,
  Filter,
  UserCheck,
  UserX,
  Shield,
  CreditCard,
  History,
  MoreVertical,
  X,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle2,
  Lock,
  Unlock,
} from 'lucide-react';

export const UserManagementTab: React.FC = () => {
  const { fetchAdminApi, adminTheme, hasPermission } = useAdmin();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Selected user for modal inspection
  const [selectedUser, setSelectedUser] = useState<any>(null);

  // Balance Adjustment State
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [adjustType, setAdjustType] = useState<'credit' | 'debit'>('credit');
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustSubmitting, setAdjustSubmitting] = useState(false);
  const [adjustSuccessMessage, setAdjustSuccessMessage] = useState('');

  // Suspension Modal State
  const [suspendModalOpen, setSuspendModalOpen] = useState(false);
  const [suspendReason, setSuspendReason] = useState('');
  const [suspendSubmitting, setSuspendSubmitting] = useState(false);

  const isDark = adminTheme === 'dark';

  const loadUsers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchQuery) params.set('query', searchQuery);
      if (statusFilter !== 'all') params.set('status', statusFilter);

      const res = await fetchAdminApi(`/api/admin/users?${params.toString()}`);
      setUsers(res.users || []);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadUsers();
  };

  const handleAdjustBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !adjustAmount || !adjustReason) return;
    try {
      setAdjustSubmitting(true);
      const res = await fetchAdminApi(`/api/admin/users/${selectedUser.id}/adjust-balance`, {
        method: 'POST',
        body: JSON.stringify({
          type: adjustType,
          amount: parseFloat(adjustAmount),
          reason: adjustReason,
        }),
      });
      setAdjustSuccessMessage(res.message);
      // update local state
      const num = parseFloat(adjustAmount);
      setSelectedUser((prev: any) => ({
        ...prev,
        balance: adjustType === 'credit' ? prev.balance + num : Math.max(0, prev.balance - num),
      }));
      setAdjustAmount('');
      setAdjustReason('');
      loadUsers();
    } catch (err: any) {
      alert(err.message || 'Balance adjustment failed');
    } finally {
      setAdjustSubmitting(false);
    }
  };

  const handleToggleSuspension = async () => {
    if (!selectedUser) return;
    const willSuspend = !selectedUser.isSuspended;
    if (willSuspend && !suspendReason) {
      alert('Suspension reason is mandatory.');
      return;
    }

    try {
      setSuspendSubmitting(true);
      await fetchAdminApi(`/api/admin/users/${selectedUser.id}/status`, {
        method: 'POST',
        body: JSON.stringify({
          suspend: willSuspend,
          reason: suspendReason,
        }),
      });

      setSelectedUser((prev: any) => ({
        ...prev,
        isSuspended: willSuspend,
        suspensionReason: willSuspend ? suspendReason : null,
      }));
      setSuspendModalOpen(false);
      setSuspendReason('');
      loadUsers();
    } catch (err: any) {
      alert(err.message || 'Status update failed');
    } finally {
      setSuspendSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Search Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Customer User Management
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Directory of registered consumer and merchant accounts, balances, and governance controls.
          </p>
        </div>

        <form onSubmit={handleSearchSubmit} className="flex items-center space-x-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, phone, account #..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-64 sm:w-80 pl-9 pr-3 py-2 rounded-xl text-xs border transition-colors outline-none ${
                isDark
                  ? 'bg-[#161A23] border-gray-800 text-white placeholder-gray-500 focus:border-[#F0B90B]'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-[#F0B90B]'
              }`}
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-[#F0B90B] hover:bg-[#d9a606] text-black font-semibold rounded-xl text-xs transition-colors"
          >
            Filter
          </button>
        </form>
      </div>

      {/* Status Filter Badges */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-1 text-xs">
        {[
          { id: 'all', label: 'All Users' },
          { id: 'active', label: 'Active Only' },
          { id: 'suspended', label: 'Suspended' },
          { id: 'verified', label: 'Tier Verified' },
          { id: 'unverified', label: 'Unverified' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setStatusFilter(tab.id)}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all whitespace-nowrap ${
              statusFilter === tab.id
                ? 'bg-[#F0B90B] text-black'
                : isDark
                ? 'bg-gray-800/60 text-gray-400 hover:text-white'
                : 'bg-gray-100 text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Users Table */}
      <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-[#12151D] border-gray-800' : 'bg-white border-slate-200 shadow-sm'}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className={`border-b ${isDark ? 'border-gray-800 bg-[#0E1118] text-gray-400' : 'border-slate-200 bg-slate-100/80 text-slate-500'}`}>
                <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono">Customer</th>
                <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono">Account Number</th>
                <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono text-right">Wallet Balance</th>
                <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono text-center">Tier & KYC</th>
                <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono text-center">Account Status</th>
                <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono text-right">Actions</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-gray-800/60' : 'divide-slate-100'}`}>
              {users.map((u) => (
                <tr key={u.id} className={`${isDark ? 'hover:bg-gray-800/30' : 'hover:bg-slate-50'} transition-colors`}>
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
                        <div className="text-xs text-gray-400 font-mono mt-0.5">{u.phone}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4 sm:px-5">
                    <span className={`font-mono text-xs font-semibold ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>
                      {u.accountNumber}
                    </span>
                  </td>
                  <td className="py-4 px-4 sm:px-5 text-right">
                    <div className={`font-bold font-mono text-sm tabular-nums flex items-baseline justify-end ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      <Naira className="mr-0.5 text-xs" />{Number(u.balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                  </td>
                  <td className="py-4 px-4 sm:px-5 text-center">
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-semibold ${
                        u.verified
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : isDark ? 'bg-gray-800 text-gray-400 border border-gray-700' : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}
                    >
                      Tier {u.level} · {u.verified ? 'Verified' : 'Basic'}
                    </span>
                  </td>
                  <td className="py-4 px-4 sm:px-5 text-center">
                    {u.isSuspended ? (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 uppercase tracking-wide">
                        Restricted / Frozen
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-wide">
                        Active Normal
                      </span>
                    )}
                  </td>
                  <td className="py-4 px-4 sm:px-5 text-right">
                    <button
                      onClick={() => {
                        setSelectedUser(u);
                        setAdjustSuccessMessage('');
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                        isDark
                          ? 'bg-gray-800 hover:bg-gray-700 text-gray-200 border-gray-700'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
                      }`}
                    >
                      Inspect Profile
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-500">
                    No users matching criteria found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* User Details & Action Modal / Drawer */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div
            className={`w-full max-w-2xl rounded-2xl border p-6 shadow-2xl overflow-y-auto max-h-[90vh] ${
              isDark ? 'bg-[#161A23] border-gray-800 text-white' : 'bg-white border-slate-200 text-slate-900 shadow-2xl'
            }`}
          >
            {/* Modal Header */}
            <div className={`flex items-center justify-between pb-4 border-b ${isDark ? 'border-gray-800' : 'border-slate-200'}`}>
              <div className="flex items-center space-x-3">
                <div className="relative w-12 h-12 rounded-2xl shrink-0 overflow-hidden bg-[#F0B90B]/10 border border-[#F0B90B]/30 flex items-center justify-center">
                  <span className="text-[#F0B90B] font-bold text-base uppercase select-none">
                    {selectedUser.name.slice(0, 2)}
                  </span>
                  {selectedUser.profilePhoto && (
                    <img
                      src={selectedUser.profilePhoto}
                      alt={selectedUser.name}
                      className="absolute inset-0 w-full h-full object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLElement).style.display = 'none';
                      }}
                    />
                  )}
                </div>
                <div>
                  <h2 className="text-lg font-bold">{selectedUser.name}</h2>
                  <div className="text-xs text-gray-400 font-mono">
                    Phone: {selectedUser.phone} · Acc: {selectedUser.accountNumber}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedUser(null)}
                className={`p-2 rounded-xl transition-colors ${isDark ? 'text-gray-400 hover:text-white hover:bg-gray-800' : 'text-slate-400 hover:text-slate-800 hover:bg-slate-100'}`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Account Quick Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-5">
              <div className={`p-3.5 rounded-xl border ${isDark ? 'bg-gray-900/50 border-gray-800' : 'bg-slate-50 border-slate-200'}`}>
                <div className="text-[11px] text-gray-400">Ledger Balance</div>
                <div className="text-lg font-bold text-[#F0B90B] font-mono mt-0.5 flex items-baseline">
                  <Naira className="mr-0.5 text-base" />{Number(selectedUser.balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div className={`p-3.5 rounded-xl border ${isDark ? 'bg-gray-900/50 border-gray-800' : 'bg-slate-50 border-slate-200'}`}>
                <div className="text-[11px] text-gray-400">KYC Status</div>
                <div className={`text-sm font-bold mt-0.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Tier {selectedUser.level} · {selectedUser.verified ? 'Verified' : 'Unverified'}
                </div>
              </div>
              <div className={`p-3.5 rounded-xl border ${isDark ? 'bg-gray-900/50 border-gray-800' : 'bg-slate-50 border-slate-200'}`}>
                <div className="text-[11px] text-gray-400">Account Standing</div>
                <div className={`text-sm font-bold mt-0.5 ${selectedUser.isSuspended ? 'text-rose-500' : 'text-emerald-500'}`}>
                  {selectedUser.isSuspended ? 'Restricted' : 'In Good Standing'}
                </div>
              </div>
            </div>

            {selectedUser.isSuspended && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-400 mb-5 flex items-start space-x-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Suspension Notice: </span>
                  {selectedUser.suspensionReason || 'Account restricted by Compliance team.'}
                </div>
              </div>
            )}

            {adjustSuccessMessage && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-400 mb-5 flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>{adjustSuccessMessage}</span>
              </div>
            )}

            {/* Governance Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 mb-6">
              {hasPermission('users.adjust_balance') && (
                <button
                  onClick={() => setAdjustModalOpen(true)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-[#F0B90B] hover:bg-[#d9a606] text-black transition-colors flex items-center space-x-2 shadow-sm"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Adjust Ledger Balance</span>
                </button>
              )}

              {hasPermission('users.suspend') && (
                <button
                  onClick={() => setSuspendModalOpen(true)}
                  className={`px-4 py-2.5 rounded-xl text-xs font-semibold border transition-colors flex items-center space-x-2 ${
                    selectedUser.isSuspended
                      ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                      : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border-rose-500/30'
                  }`}
                >
                  {selectedUser.isSuspended ? (
                    <>
                      <Unlock className="w-4 h-4" />
                      <span>Reactivate Account</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      <span>Restrict Account</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Profile Detail Fields */}
            <div className={`space-y-3 text-xs border-t pt-4 ${isDark ? 'border-gray-800' : 'border-slate-200'}`}>
              <h3 className={`font-bold ${isDark ? 'text-gray-300' : 'text-slate-800'}`}>Detailed Profile Information</h3>
              <div className="grid grid-cols-2 gap-3 font-mono">
                <div>
                  <span className="text-gray-500">System User ID:</span>
                  <div className={`break-all ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>{selectedUser.id}</div>
                </div>
                <div>
                  <span className="text-gray-500">Email Identifier:</span>
                  <div className={`${isDark ? 'text-gray-300' : 'text-slate-700'}`}>{selectedUser.email}</div>
                </div>
                <div>
                  <span className="text-gray-500">Registration Date:</span>
                  <div className={`${isDark ? 'text-gray-300' : 'text-slate-700'}`}>{selectedUser.createdAt ? new Date(selectedUser.createdAt).toLocaleString() : 'N/A'}</div>
                </div>
                <div>
                  <span className="text-gray-500">Security Binding:</span>
                  <div className="text-emerald-500 font-sans">SMS 2FA Enabled</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Balance Adjustment Modal */}
      {adjustModalOpen && selectedUser && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className={`w-full max-w-md rounded-2xl p-6 shadow-2xl border ${isDark ? 'bg-[#161A23] border-gray-800 text-white' : 'bg-white border-slate-200 text-slate-900'}`}>
            <div className={`flex items-center justify-between pb-3 border-b ${isDark ? 'border-gray-800' : 'border-slate-200'}`}>
              <h3 className="text-base font-bold flex items-center space-x-2">
                <CreditCard className="w-4 h-4 text-[#F0B90B]" />
                <span>Adjust Customer Ledger Balance</span>
              </h3>
              <button onClick={() => setAdjustModalOpen(false)} className={`transition-colors ${isDark ? 'text-gray-400 hover:text-white' : 'text-slate-400 hover:text-slate-700'}`}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAdjustBalance} className="space-y-4 mt-4">
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">Operation Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustType('credit')}
                    className={`py-2 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 border transition-all ${
                      adjustType === 'credit'
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                        : isDark ? 'bg-gray-900 border-gray-800 text-gray-400' : 'bg-slate-100 border-slate-200 text-slate-600'
                    }`}
                  >
                    <ArrowDownLeft className="w-4 h-4" />
                    <span>Credit (Deposit)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustType('debit')}
                    className={`py-2 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 border transition-all ${
                      adjustType === 'debit'
                        ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                        : isDark ? 'bg-gray-900 border-gray-800 text-gray-400' : 'bg-slate-100 border-slate-200 text-slate-600'
                    }`}
                  >
                    <ArrowUpRight className="w-4 h-4" />
                    <span>Debit (Deduct)</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-400 mb-1 block">Amount (NGN)</label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  required
                  placeholder="e.g. 50000"
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value)}
                  className={`w-full px-3 py-2.5 rounded-xl border text-sm font-mono focus:border-[#F0B90B] outline-none ${
                    isDark ? 'bg-gray-900 border-gray-800 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div>
                <label className="text-xs text-gray-400 mb-1 block">Mandatory Compliance Justification</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Provide precise ticket number, dispute resolution reference, or authorization note..."
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl border text-xs focus:border-[#F0B90B] outline-none ${
                    isDark ? 'bg-gray-900 border-gray-800 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[11px] text-amber-500">
                Warning: This creates an immutable administrative audit log and updates the real customer ledger.
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAdjustModalOpen(false)}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
                    isDark ? 'text-gray-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adjustSubmitting}
                  className="px-5 py-2 bg-[#F0B90B] hover:bg-[#d9a606] text-black font-semibold rounded-xl text-xs transition-colors"
                >
                  {adjustSubmitting ? 'Executing Ledger Write...' : 'Confirm Ledger Adjustment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Suspension Modal */}
      {suspendModalOpen && selectedUser && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className={`w-full max-w-md rounded-2xl p-6 shadow-2xl border ${isDark ? 'bg-[#161A23] border-gray-800 text-white' : 'bg-white border-slate-200 text-slate-900'}`}>
            <h3 className={`text-base font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {selectedUser.isSuspended ? 'Reactivate Customer Account' : 'Restrict & Freeze Customer Account'}
            </h3>
            <p className="text-xs text-gray-400 mb-4">
              {selectedUser.isSuspended
                ? 'Reactivating this account will restore standard wallet capabilities, outbound transfers, and card transactions.'
                : 'Freezing this account immediately halts all inbound and outbound funds transfers and disables card operations.'}
            </p>

            {!selectedUser.isSuspended && (
              <div className="mb-4">
                <label className="text-xs text-gray-400 mb-1 block">Reason for Suspension (Mandatory)</label>
                <textarea
                  rows={3}
                  placeholder="e.g. Unusual login velocity from foreign IP / Suspicious withdrawal attempt..."
                  value={suspendReason}
                  onChange={(e) => setSuspendReason(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl border text-xs focus:border-[#F0B90B] outline-none ${
                    isDark ? 'bg-gray-900 border-gray-800 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
              </div>
            )}

            <div className="flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setSuspendModalOpen(false)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
                  isDark ? 'text-gray-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleToggleSuspension}
                disabled={suspendSubmitting}
                className={`px-5 py-2 rounded-xl text-xs font-semibold font-sans transition-colors ${
                  selectedUser.isSuspended
                    ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                    : 'bg-rose-500 hover:bg-rose-600 text-white'
                }`}
              >
                {suspendSubmitting ? 'Processing...' : selectedUser.isSuspended ? 'Confirm Reactivation' : 'Freeze Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
