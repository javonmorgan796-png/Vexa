import React, { useState, useEffect, useCallback } from 'react';
import { useAdmin } from '../AdminContext';
import { Naira } from '@/components/Naira';
import {
  Search,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  Ban,
  Plus,
  Minus,
  Eye,
  X,
  AlertTriangle,
  UserCheck,
  Users,
} from 'lucide-react';

interface ManagedUser {
  id: string;
  name: string;
  phone: string;
  email: string;
  accountNumber: string;
  balance: number;
  level: number;
  verified: boolean;
  profilePhoto?: string;
  isSuspended: boolean;
  suspensionReason?: string | null;
  createdAt: string;
}

type StatusFilter = 'all' | 'active' | 'suspended' | 'verified' | 'unverified';

function UserAvatar({
  name,
  profilePhoto,
  size = 'md',
}: {
  name: string;
  profilePhoto?: string;
  size?: 'md' | 'lg';
}) {
  const dimensions = size === 'lg' ? 'w-14 h-14 rounded-2xl text-base' : 'w-10 h-10 rounded-full text-xs';
  const initials = (name || 'VU').trim().slice(0, 2).toUpperCase();

  return (
    <div
      className={`relative ${dimensions} shrink-0 overflow-hidden bg-[#F0B90B]/10 border border-[#F0B90B]/30 flex items-center justify-center`}
    >
      <span className="text-[#F0B90B] font-bold uppercase select-none">{initials}</span>
      {profilePhoto && (
        <img
          src={profilePhoto}
          alt={name}
          className="absolute inset-0 w-full h-full object-cover"
          onError={(e) => {
            (e.currentTarget as HTMLElement).style.display = 'none';
          }}
        />
      )}
    </div>
  );
}

export const UserManagementTab: React.FC = () => {
  const { fetchAdminApi, adminTheme, hasPermission } = useAdmin();
  const isDark = adminTheme === 'dark';

  const [allUsers, setAllUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [selectedUser, setSelectedUser] = useState<ManagedUser | null>(null);
  const [balanceModalUser, setBalanceModalUser] = useState<ManagedUser | null>(null);
  const [adjustType, setAdjustType] = useState<'credit' | 'debit'>('credit');
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');

  const [suspendModalUser, setSuspendModalUser] = useState<ManagedUser | null>(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canAdjustBalance = hasPermission('users.adjust_balance');
  const canSuspend = hasPermission('users.suspend');

  const loadUsers = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await fetchAdminApi<{ users?: ManagedUser[] }>('/api/admin/users');
      setAllUsers(Array.isArray(res?.users) ? res.users : []);
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'Failed to load user directory' });
    } finally {
      if (!silent) setLoading(false);
    }
  }, [fetchAdminApi]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const filtered = allUsers.filter((u) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      u.name.toLowerCase().includes(q) ||
      u.phone.toLowerCase().includes(q) ||
      u.accountNumber.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q);

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && !u.isSuspended) ||
      (statusFilter === 'suspended' && u.isSuspended) ||
      (statusFilter === 'verified' && u.verified) ||
      (statusFilter === 'unverified' && !u.verified);

    return matchesSearch && matchesStatus;
  });

  const statusCount = (status: StatusFilter) => {
    if (status === 'all') return allUsers.length;
    if (status === 'active') return allUsers.filter((u) => !u.isSuspended).length;
    if (status === 'suspended') return allUsers.filter((u) => u.isSuspended).length;
    if (status === 'verified') return allUsers.filter((u) => u.verified).length;
    return allUsers.filter((u) => !u.verified).length;
  };

  const handleAdjustBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!balanceModalUser) return;
    const numeric = Number(adjustAmount);
    if (!numeric || numeric <= 0) {
      setFeedback({ type: 'error', text: 'Enter a valid adjustment amount greater than 0.' });
      return;
    }
    if (adjustReason.trim().length < 5) {
      setFeedback({ type: 'error', text: 'Please provide an audit justification (at least 5 characters).' });
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetchAdminApi<{ message?: string }>(
        `/api/admin/users/${encodeURIComponent(balanceModalUser.id)}/adjust-balance`,
        {
          method: 'POST',
          body: JSON.stringify({
            type: adjustType,
            amount: numeric,
            reason: adjustReason.trim(),
          }),
        },
      );
      setFeedback({
        type: 'success',
        text: res?.message || 'Wallet balance updated successfully.',
      });
      setBalanceModalUser(null);
      setAdjustAmount('');
      setAdjustReason('');
      await loadUsers(true);
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'Balance adjustment failed.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleSuspend = async (user: ManagedUser, suspend: boolean, reason?: string) => {
    if (suspend && (!reason || reason.trim().length < 3)) {
      setFeedback({ type: 'error', text: 'Suspension reason is mandatory for audit records.' });
      return;
    }
    try {
      setSubmitting(true);
      const res = await fetchAdminApi<{ message?: string }>(
        `/api/admin/users/${encodeURIComponent(user.id)}/status`,
        {
          method: 'POST',
          body: JSON.stringify({
            suspend,
            reason: suspend ? reason?.trim() : undefined,
          }),
        },
      );
      setFeedback({
        type: 'success',
        text: res?.message || `Account ${suspend ? 'suspended' : 'reactivated'}.`,
      });
      setSuspendModalUser(null);
      setSuspendReason('');
      setSelectedUser(null);
      await loadUsers(true);
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'Status update failed.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Search */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            User Management & Customer Accounts
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Inspect customer profiles, KYC tiers, wallet balances, and enforce security controls.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search name, phone, or account..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-64 sm:w-80 pl-9 pr-3 py-2 rounded-xl text-xs border outline-none ${
                isDark
                  ? 'bg-[#161A23] border-gray-800 text-white placeholder-gray-500 focus:border-[#F0B90B]'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-[#F0B90B]'
              }`}
            />
          </div>
          <button
            onClick={() => void loadUsers(false)}
            disabled={loading}
            className={`p-2 rounded-xl border transition-colors ${
              isDark
                ? 'bg-[#161A23] border-gray-800 text-gray-300 hover:text-white'
                : 'bg-white border-gray-300 text-gray-700 hover:text-black'
            }`}
            title="Refresh User Directory"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`rounded-xl border px-4 py-3 text-xs flex items-center justify-between gap-3 ${
            feedback.type === 'success'
              ? isDark
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : isDark
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <span className="font-medium">{feedback.text}</span>
          <button onClick={() => setFeedback(null)} className="opacity-70 hover:opacity-100" aria-label="Dismiss">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Status Filter Pills */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {(['all', 'active', 'suspended', 'verified', 'unverified'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-3 py-1.5 rounded-lg font-semibold capitalize transition-all ${
              statusFilter === status
                ? 'bg-[#F0B90B] text-black'
                : isDark
                  ? 'bg-gray-800/60 text-gray-400 hover:text-white'
                  : 'bg-gray-100 text-gray-600 hover:text-gray-900'
            }`}
          >
            {status} ({statusCount(status)})
          </button>
        ))}
      </div>

      {/* Institutional Users Table */}
      <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-[#161A23] border-gray-800' : 'bg-white border-slate-200 shadow-sm'}`}>
        <div className={`p-4 border-b flex items-center justify-between ${isDark ? 'border-gray-800/60' : 'border-slate-200'}`}>
          <h2 className={`text-sm font-bold flex items-center space-x-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            <Users className="w-4 h-4 text-[#F0B90B]" />
            <span>Registered Customers</span>
          </h2>
          <span className={`text-xs font-mono ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
            {filtered.length} {filtered.length === 1 ? 'User' : 'Users'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className={`border-b ${isDark ? 'border-gray-800 bg-[#12151D]/80 text-gray-400' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono">Customer</th>
                <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono">Account / Phone</th>
                <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono text-center">KYC Tier</th>
                <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono text-right">Wallet Balance</th>
                <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono text-center">Status</th>
                <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono text-right">Joined</th>
                <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono text-right">Actions</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-gray-800/60 bg-[#161A23]' : 'divide-slate-100 bg-white'}`}>
              {filtered.map((u) => (
                <tr key={u.id} className={`${isDark ? 'hover:bg-gray-800/20' : 'hover:bg-slate-50/80'} transition-colors`}>
                  <td className="py-4 px-4 sm:px-5">
                    <div className="flex items-center space-x-3">
                      <UserAvatar name={u.name} profilePhoto={u.profilePhoto} />
                      <div className="min-w-0">
                        <div className={`text-sm font-semibold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          {u.name}
                        </div>
                        <div className="text-xs text-gray-400 truncate max-w-[200px]">{u.email}</div>
                      </div>
                    </div>
                  </td>

                  <td className="py-4 px-4 sm:px-5">
                    <div className="font-mono font-bold text-xs text-[#F0B90B]">{u.accountNumber}</div>
                    <div className={`text-xs font-mono mt-0.5 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>{u.phone}</div>
                  </td>

                  <td className="py-4 px-4 sm:px-5 text-center">
                    <div className="inline-flex items-center space-x-1">
                      <span className={`px-2.5 py-0.5 rounded-md text-xs font-mono font-medium ${
                        isDark ? 'bg-gray-800 text-gray-300' : 'bg-slate-100 text-slate-700'
                      }`}>
                        Tier {u.level}
                      </span>
                      {u.verified && <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" aria-label="Verified" />}
                    </div>
                  </td>

                  <td className="py-4 px-4 sm:px-5 text-right font-mono tabular-nums font-bold text-sm">
                    <span className={`inline-flex items-baseline justify-end ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      <Naira className="mr-0.5 text-xs" />
                      {Number(u.balance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </td>

                  <td className="py-4 px-4 sm:px-5 text-center">
                    <span
                      title={u.isSuspended && u.suspensionReason ? u.suspensionReason : undefined}
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider font-mono ${
                        u.isSuspended
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}
                    >
                      {u.isSuspended ? 'Suspended' : 'Active'}
                    </span>
                  </td>

                  <td className="py-4 px-4 sm:px-5 text-right font-mono text-xs text-slate-500 dark:text-gray-400">
                    <div>{new Date(u.createdAt).toLocaleDateString(undefined, { dateStyle: 'short' })}</div>
                    <div className="text-[11px] text-slate-400 dark:text-gray-500">
                      {new Date(u.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </td>

                  <td className="py-4 px-4 sm:px-5 text-right">
                    <div className="inline-flex items-center justify-end space-x-1.5">
                      <button
                        onClick={() => setSelectedUser(u)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors inline-flex items-center space-x-1 ${
                          isDark
                            ? 'bg-gray-800 hover:bg-gray-700 text-gray-200 border-gray-700'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
                        }`}
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View</span>
                      </button>

                      {canAdjustBalance && (
                        <button
                          onClick={() => {
                            setBalanceModalUser(u);
                            setAdjustType('credit');
                            setAdjustAmount('');
                            setAdjustReason('');
                          }}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-[#F0B90B] hover:bg-[#d9a606] text-black transition-colors"
                        >
                          Adjust
                        </button>
                      )}

                      {canSuspend && (
                        <button
                          onClick={() => {
                            if (u.isSuspended) {
                              void handleToggleSuspend(u, false);
                            } else {
                              setSuspendModalUser(u);
                              setSuspendReason('');
                            }
                          }}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                            u.isSuspended
                              ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                              : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border-rose-500/30'
                          }`}
                        >
                          {u.isSuspended ? 'Restore' : 'Suspend'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-xs text-gray-400">
                    No customer accounts matched your search or filter.
                  </td>
                </tr>
              )}
              {loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-xs text-gray-400">
                    Loading Vexa customer accounts...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inspect Profile Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-lg rounded-2xl border p-6 shadow-2xl space-y-5 ${
            isDark ? 'bg-[#161A23] border-gray-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className={`flex items-center justify-between pb-4 border-b ${isDark ? 'border-gray-800' : 'border-slate-200'}`}>
              <div className="flex items-center space-x-3.5">
                <UserAvatar name={selectedUser.name} profilePhoto={selectedUser.profilePhoto} size="lg" />
                <div>
                  <h2 className="text-lg font-bold flex items-center space-x-1.5">
                    <span>{selectedUser.name}</span>
                    {selectedUser.verified && <ShieldCheck className="w-4 h-4 text-emerald-500" />}
                  </h2>
                  <p className="text-xs text-gray-400 font-mono">
                    {selectedUser.phone} · Acc: {selectedUser.accountNumber}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedUser(null)}
                className={`p-2 rounded-xl transition-colors ${
                  isDark ? 'text-gray-400 hover:text-white hover:bg-gray-800' : 'text-slate-400 hover:text-slate-800 hover:bg-slate-100'
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className={`p-3.5 rounded-xl border ${isDark ? 'bg-gray-900/50 border-gray-800' : 'bg-slate-50 border-slate-200'}`}>
                <div className="text-[11px] text-gray-400">Available Wallet Balance</div>
                <div className="text-lg font-bold text-[#F0B90B] font-mono mt-0.5 flex items-baseline">
                  <Naira className="mr-0.5 text-base" />
                  {Number(selectedUser.balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div className={`p-3.5 rounded-xl border ${isDark ? 'bg-gray-900/50 border-gray-800' : 'bg-slate-50 border-slate-200'}`}>
                <div className="text-[11px] text-gray-400">Account Tier & Status</div>
                <div className="text-sm font-bold mt-1 flex items-center space-x-2">
                  <span>Tier {selectedUser.level}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono uppercase ${
                    selectedUser.isSuspended ? 'bg-rose-500/15 text-rose-400' : 'bg-emerald-500/15 text-emerald-400'
                  }`}>
                    {selectedUser.isSuspended ? 'Suspended' : 'Active'}
                  </span>
                </div>
              </div>
            </div>

            <div className={`rounded-xl border p-4 space-y-2.5 text-xs ${
              isDark ? 'bg-[#0B0E14] border-gray-800' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex justify-between">
                <span className="text-gray-400">User ID</span>
                <span className="font-mono text-[11px]">{selectedUser.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Email</span>
                <span className="font-medium truncate max-w-[260px]">{selectedUser.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Verified Identity</span>
                <span className="font-semibold">{selectedUser.verified ? 'Yes' : 'No'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Registered On</span>
                <span className="font-mono">{new Date(selectedUser.createdAt).toLocaleString()}</span>
              </div>
              {selectedUser.isSuspended && (
                <div className="pt-2 border-t border-rose-500/20 text-rose-400 flex items-start space-x-2">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>Suspension reason: {selectedUser.suspensionReason || 'Administrative restriction'}</span>
                </div>
              )}
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              {canAdjustBalance && (
                <button
                  onClick={() => {
                    const target = selectedUser;
                    setSelectedUser(null);
                    setBalanceModalUser(target);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-[#F0B90B] text-black hover:bg-[#d9a606]"
                >
                  Adjust Balance
                </button>
              )}
              {canSuspend && (
                <button
                  onClick={() => {
                    if (selectedUser.isSuspended) {
                      void handleToggleSuspend(selectedUser, false);
                    } else {
                      const target = selectedUser;
                      setSelectedUser(null);
                      setSuspendModalUser(target);
                      setSuspendReason('');
                    }
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-bold border ${
                    selectedUser.isSuspended
                      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                      : 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                  }`}
                >
                  {selectedUser.isSuspended ? (
                    <span className="inline-flex items-center space-x-1"><UserCheck className="w-3.5 h-3.5" /><span>Reactivate</span></span>
                  ) : (
                    <span className="inline-flex items-center space-x-1"><Ban className="w-3.5 h-3.5" /><span>Suspend</span></span>
                  )}
                </button>
              )}
              <button
                onClick={() => setSelectedUser(null)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold border ${
                  isDark ? 'border-gray-700 text-gray-300' : 'border-slate-300 text-slate-700'
                }`}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Adjust Balance Modal */}
      {balanceModalUser && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleAdjustBalance}
            className={`w-full max-w-md rounded-2xl border p-6 space-y-4 ${
              isDark ? 'bg-[#161A23] border-gray-800 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <UserAvatar name={balanceModalUser.name} profilePhoto={balanceModalUser.profilePhoto} />
                <div>
                  <h3 className="text-base font-bold">Adjust Customer Wallet</h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {balanceModalUser.name} · {balanceModalUser.accountNumber}
                  </p>
                </div>
              </div>
              <button type="button" onClick={() => setBalanceModalUser(null)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAdjustType('credit')}
                className={`py-2.5 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 border ${
                  adjustType === 'credit'
                    ? 'bg-emerald-500/15 border-emerald-500 text-emerald-400'
                    : isDark
                      ? 'bg-[#0B0E14] border-gray-800 text-gray-400'
                      : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Credit Naira</span>
              </button>
              <button
                type="button"
                onClick={() => setAdjustType('debit')}
                className={`py-2.5 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 border ${
                  adjustType === 'debit'
                    ? 'bg-rose-500/15 border-rose-500 text-rose-400'
                    : isDark
                      ? 'bg-[#0B0E14] border-gray-800 text-gray-400'
                      : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}
              >
                <Minus className="w-3.5 h-3.5" />
                <span>Debit Naira</span>
              </button>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-400 mb-1.5">Amount (NGN)</label>
              <input
                type="number"
                min="1"
                step="0.01"
                required
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(e.target.value)}
                placeholder="e.g. 5000"
                className={`w-full px-3.5 py-2.5 rounded-xl text-xs border outline-none ${
                  isDark ? 'bg-[#0B0E14] border-gray-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                }`}
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-400 mb-1.5">Audit Justification</label>
              <textarea
                rows={3}
                required
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder="Reason for manual ledger adjustment (logged in Audit Trail)..."
                className={`w-full px-3.5 py-2.5 rounded-xl text-xs border outline-none resize-none ${
                  isDark ? 'bg-[#0B0E14] border-gray-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                }`}
              />
            </div>

            <div className="flex justify-end space-x-2 pt-1">
              <button
                type="button"
                onClick={() => setBalanceModalUser(null)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold border ${
                  isDark ? 'border-gray-700 text-gray-300' : 'border-slate-300 text-slate-700'
                }`}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#F0B90B] text-black hover:bg-[#d9a606] disabled:opacity-50"
              >
                {submitting ? 'Applying...' : `Confirm ${adjustType === 'credit' ? 'Credit' : 'Debit'}`}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Suspend User Modal */}
      {suspendModalUser && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-md rounded-2xl border p-6 space-y-4 ${
            isDark ? 'bg-[#161A23] border-gray-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="flex items-start space-x-3">
              <div className="p-2.5 rounded-xl bg-rose-500/15 text-rose-500">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold">Suspend Customer Account</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Restricting {suspendModalUser.name} ({suspendModalUser.accountNumber}) blocks outbound account activity.
                </p>
              </div>
              <button onClick={() => setSuspendModalUser(null)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-400 mb-1.5">Mandatory Suspension Reason</label>
              <textarea
                rows={3}
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                placeholder="State compliance or risk reason for suspending this account..."
                className={`w-full px-3.5 py-2.5 rounded-xl text-xs border outline-none resize-none ${
                  isDark ? 'bg-[#0B0E14] border-gray-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                }`}
              />
            </div>

            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setSuspendModalUser(null)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold border ${
                  isDark ? 'border-gray-700 text-gray-300' : 'border-slate-300 text-slate-700'
                }`}
              >
                Cancel
              </button>
              <button
                disabled={submitting}
                onClick={() => void handleToggleSuspend(suspendModalUser, true, suspendReason)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white flex items-center space-x-1.5 disabled:opacity-50"
              >
                <Ban className="w-3.5 h-3.5" />
                <span>{submitting ? 'Suspending...' : 'Confirm Suspension'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
