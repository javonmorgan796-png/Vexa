import React, { useState, useEffect } from 'react';
import { useAdmin } from '../AdminContext';
import {
  ShieldCheck,
  UserPlus,
  Lock,
  Unlock,
  Key,
  CheckCircle2,
  AlertTriangle,
  X,
  Users,
} from 'lucide-react';

export const AdminManagementTab: React.FC = () => {
  const { fetchAdminApi, adminTheme, hasPermission, isSuperAdmin } = useAdmin();
  const [admins, setAdmins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newAdmin, setNewAdmin] = useState({
    name: '',
    phone: '',
    role: 'admin',
  });
  const [submitting, setSubmitting] = useState(false);

  const isDark = adminTheme === 'dark';

  const loadAdmins = async () => {
    try {
      setLoading(true);
      const res = await fetchAdminApi('/api/admin/admins');
      setAdmins(res.admins || []);
    } catch (err) {
      console.error('Failed to load admins:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdmins();
  }, []);

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await fetchAdminApi('/api/admin/admins/add', {
        method: 'POST',
        body: JSON.stringify(newAdmin),
      });
      setAddModalOpen(false);
      setNewAdmin({ name: '', phone: '', role: 'admin' });
      loadAdmins();
    } catch (err: any) {
      alert(err.message || 'Failed to add admin');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleAdminStatus = async (id: string) => {
    try {
      await fetchAdminApi(`/api/admin/admins/${id}/status`, { method: 'POST' });
      loadAdmins();
    } catch (err: any) {
      alert(err.message || 'Status toggle failed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Administrative Roles & Access Governance
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Role-based privilege delegation across Super Admins, Finance Managers, Support Agents, and Auditors.
          </p>
        </div>

        {isSuperAdmin && (
          <button
            onClick={() => setAddModalOpen(true)}
            className="px-4 py-2 bg-[#F0B90B] hover:bg-[#d9a606] text-black font-semibold rounded-xl text-xs transition-colors flex items-center space-x-1.5 shadow-sm"
          >
            <UserPlus className="w-4 h-4" />
            <span>Enroll Administrator</span>
          </button>
        )}
      </div>

      {/* Role Explainer Matrix */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { role: 'Super Admin', desc: 'Full root privileges across finance, security, and staff.' },
          { role: 'Admin', desc: 'General operations, user management, and KYC reviews.' },
          { role: 'Finance Manager', desc: 'Settlements, withdrawal authorization, and ledger adjustments.' },
          { role: 'Support Agent', desc: 'Customer inquiries, dispute chat, and read-only tickets.' },
          { role: 'Auditor', desc: 'Read-only immutable logs and compliance inspection.' },
        ].map((item) => (
          <div key={item.role} className={`p-3.5 rounded-xl border text-xs ${isDark ? 'bg-gray-900/40 border-gray-800' : 'bg-slate-50 border-slate-200'}`}>
            <div className="font-bold text-[#F0B90B] mb-1">{item.role}</div>
            <div className="text-[11px] text-gray-400">{item.desc}</div>
          </div>
        ))}
      </div>

      {/* Admins Table */}
      <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-[#161A23] border-gray-800' : 'bg-white border-slate-200 shadow-sm'}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className={`border-b ${isDark ? 'border-gray-800 bg-[#12151D]/80 text-gray-400' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono">Administrator</th>
                <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono">Authorized Phone</th>
                <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono text-center">Role Designation</th>
                <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono">Permissions Scope</th>
                <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono text-center">Status</th>
                <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono text-right">Actions</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-gray-800/60 bg-[#161A23]' : 'divide-slate-100 bg-white'}`}>
              {admins.map((admin) => (
                <tr key={admin.id} className={`${isDark ? 'hover:bg-gray-800/20' : 'hover:bg-slate-50/80'} transition-colors`}>
                  <td className="py-4 px-4 sm:px-5">
                    <div className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{admin.name}</div>
                    <div className="text-xs text-slate-400 dark:text-gray-500 font-mono mt-0.5">ID: {admin.id}</div>
                  </td>
                  <td className="py-4 px-4 sm:px-5 font-mono font-bold text-xs text-[#F0B90B]">{admin.phone}</td>
                  <td className="py-4 px-4 sm:px-5 text-center">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider font-mono ${
                        admin.role === 'super_admin'
                          ? 'bg-amber-500/20 text-amber-500 border border-amber-500/40'
                          : admin.role === 'finance_manager'
                          ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/40'
                          : 'bg-blue-500/20 text-blue-500 border border-blue-500/40'
                      }`}
                    >
                      {admin.role.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-4 px-4 sm:px-5 font-mono text-xs text-slate-500 dark:text-gray-400">
                    {admin.role === 'super_admin' ? (
                      <span className="text-emerald-500 font-bold">Full Root Authorization (*)</span>
                    ) : (
                      <span>{admin.permissions?.length || 0} policy scopes</span>
                    )}
                  </td>
                  <td className="py-4 px-4 sm:px-5 text-center">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider font-mono ${
                        admin.isActive
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}
                    >
                      {admin.isActive ? 'Active' : 'Suspended'}
                    </span>
                  </td>
                  <td className="py-4 px-4 sm:px-5 text-right">
                    {isSuperAdmin && admin.role !== 'super_admin' ? (
                      <button
                        onClick={() => handleToggleAdminStatus(admin.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                          admin.isActive
                            ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border-rose-500/30'
                            : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                        }`}
                      >
                        {admin.isActive ? 'Suspend Access' : 'Reactivate'}
                      </button>
                    ) : (
                      <span className="text-xs font-mono text-slate-400 dark:text-gray-500">Protected</span>
                    )}
                  </td>
                </tr>
              ))}
              {admins.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <p className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-slate-600'}`}>
                      No administrative accounts configured
                    </p>
                    <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-slate-400'}`}>
                      Enrolled staff and role permissions will be listed here.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Enroll Admin Modal */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className={`w-full max-w-md rounded-2xl p-6 shadow-2xl border ${isDark ? 'bg-[#161A23] border-gray-800 text-white' : 'bg-white border-slate-200 text-slate-900'}`}>
            <div className={`flex items-center justify-between pb-3 border-b ${isDark ? 'border-gray-800' : 'border-slate-200'}`}>
              <h3 className="text-base font-bold flex items-center space-x-2">
                <UserPlus className="w-4 h-4 text-[#F0B90B]" />
                <span>Enroll New Administrator</span>
              </h3>
              <button onClick={() => setAddModalOpen(false)} className={`transition-colors ${isDark ? 'text-gray-400 hover:text-white' : 'text-slate-400 hover:text-slate-700'}`}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddAdmin} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="text-gray-400 mb-1 block">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Adeola Johnson"
                  value={newAdmin.name}
                  onChange={(e) => setNewAdmin({ ...newAdmin, name: e.target.value })}
                  className={`w-full px-3 py-2 rounded-xl border outline-none focus:border-[#F0B90B] ${
                    isDark ? 'bg-gray-900 border-gray-800 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div>
                <label className="text-gray-400 mb-1 block">Registered Nigerian Phone Number</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 08012345678"
                  value={newAdmin.phone}
                  onChange={(e) => setNewAdmin({ ...newAdmin, phone: e.target.value })}
                  className={`w-full px-3 py-2 rounded-xl border outline-none focus:border-[#F0B90B] font-mono ${
                    isDark ? 'bg-gray-900 border-gray-800 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div>
                <label className="text-gray-400 mb-1 block">Assigned Role</label>
                <select
                  value={newAdmin.role}
                  onChange={(e) => setNewAdmin({ ...newAdmin, role: e.target.value })}
                  className={`w-full px-3 py-2 rounded-xl border outline-none focus:border-[#F0B90B] font-semibold ${
                    isDark ? 'bg-gray-900 border-gray-800 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                >
                  <option value="admin">Admin (Operations & KYC)</option>
                  <option value="finance_manager">Finance Manager (Settlements & Ledger)</option>
                  <option value="support_agent">Support Agent (Inquiries & Tickets)</option>
                  <option value="auditor">Auditor (Read-Only Logs)</option>
                  <option value="super_admin">Super Admin (Full Root Privileges)</option>
                </select>
              </div>

              <div className={`p-3 rounded-xl border text-[11px] text-gray-400 ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-slate-50 border-slate-200'}`}>
                The enrolled administrator will be able to access the Admin Dashboard from their Settings screen after logging in with their phone and passcode.
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className={`px-4 py-2 rounded-xl font-semibold transition-colors ${
                    isDark ? 'text-gray-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-[#F0B90B] hover:bg-[#d9a606] text-black font-semibold rounded-xl transition-colors"
                >
                  {submitting ? 'Enrolling...' : 'Grant Administrative Role'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
