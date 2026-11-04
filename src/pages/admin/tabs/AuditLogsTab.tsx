import React, { useState, useEffect } from 'react';
import { useAdmin } from '../AdminContext';
import {
  History,
  Search,
  Shield,
  Clock,
  Eye,
  FileCode,
  X,
  User,
  Filter,
} from 'lucide-react';

export const AuditLogsTab: React.FC = () => {
  const { fetchAdminApi, adminTheme } = useAdmin();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [targetFilter, setTargetFilter] = useState('all');
  const [selectedLog, setSelectedLog] = useState<any>(null);

  const isDark = adminTheme === 'dark';

  const loadAuditLogs = async () => {
    try {
      setLoading(true);
      const res = await fetchAdminApi('/api/admin/audit-logs');
      setLogs(res.logs || []);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAuditLogs();
  }, []);

  const filtered = logs.filter((log) => {
    const matchesSearch =
      !search ||
      log.action.toLowerCase().includes(search.toLowerCase()) ||
      log.adminName.toLowerCase().includes(search.toLowerCase()) ||
      log.adminPhone.includes(search) ||
      (log.targetId && log.targetId.toLowerCase().includes(search.toLowerCase()));

    const matchesTarget = targetFilter === 'all' || log.targetType === targetFilter;

    return matchesSearch && matchesTarget;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Immutable Audit Trail & Regulatory Logs
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Cryptographic ledger tracking all staff actions, balance adjustments, account status modifications, and risk overrides.
          </p>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search action, staff member, target ID..."
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

      {/* Target Filter Tabs */}
      <div className="flex items-center space-x-2 text-xs overflow-x-auto pb-1">
        {['all', 'user', 'kyc', 'withdrawal', 'card', 'deposit', 'admin', 'system'].map((t) => (
          <button
            key={t}
            onClick={() => setTargetFilter(t)}
            className={`px-3 py-1.5 rounded-lg font-semibold uppercase tracking-wider transition-all whitespace-nowrap ${
              targetFilter === t
                ? 'bg-[#F0B90B] text-black'
                : isDark
                ? 'bg-gray-800/60 text-gray-400 hover:text-white'
                : 'bg-gray-100 text-gray-600 hover:text-gray-900'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Logs Table */}
      <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-[#161A23] border-gray-800' : 'bg-white border-slate-200 shadow-sm'}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className={`border-b ${isDark ? 'border-gray-800 bg-[#12151D]/80 text-gray-400' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono">Timestamp</th>
                <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono">Operator (Admin)</th>
                <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono text-center">Action Trigger</th>
                <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono">Target Entity</th>
                <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono">IP Address</th>
                <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono text-right">Payload</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-gray-800/60 bg-[#161A23]' : 'divide-slate-100 bg-white'}`}>
              {filtered.map((log) => (
                <tr key={log.id} className={`${isDark ? 'hover:bg-gray-800/20' : 'hover:bg-slate-50/80'} transition-colors`}>
                  <td className="py-4 px-4 sm:px-5 font-mono text-xs text-slate-500 dark:text-gray-400">
                    <div>{new Date(log.createdAt).toLocaleDateString(undefined, { dateStyle: 'short' })}</div>
                    <div className="text-[11px] text-slate-400 dark:text-gray-500">{new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
                  </td>
                  <td className="py-4 px-4 sm:px-5">
                    <div className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{log.adminName}</div>
                    <div className="text-xs text-[#F0B90B] font-mono mt-0.5">{log.adminPhone}</div>
                  </td>
                  <td className="py-4 px-4 sm:px-5 text-center">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold font-mono uppercase tracking-wider ${
                      isDark ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-amber-50 text-amber-800 border border-amber-200'
                    }`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="py-4 px-4 sm:px-5">
                    <span className="uppercase text-[10px] font-bold text-slate-400 dark:text-gray-500 font-mono">[{log.targetType}] </span>
                    <span className={`font-mono text-xs font-semibold ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>{log.targetId || '—'}</span>
                  </td>
                  <td className="py-4 px-4 sm:px-5 font-mono text-xs text-slate-500 dark:text-gray-400">{log.ipAddress}</td>
                  <td className="py-4 px-4 sm:px-5 text-right">
                    <button
                      onClick={() => setSelectedLog(log)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center space-x-1.5 border transition-colors ${
                        isDark
                          ? 'bg-gray-800 hover:bg-gray-700 text-gray-200 border-gray-700'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
                      }`}
                    >
                      <FileCode className="w-3.5 h-3.5" />
                      <span>Inspect Diff</span>
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <p className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-slate-600'}`}>
                      No audit records found matching query
                    </p>
                    <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-slate-400'}`}>
                      Administrative actions, compliance changes, and security events will log here.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Diff Inspector Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className={`w-full max-w-2xl rounded-2xl p-6 shadow-2xl border ${isDark ? 'bg-[#161A23] border-gray-800 text-white' : 'bg-white border-slate-200 text-slate-900'}`}>
            <div className={`flex items-center justify-between pb-3 border-b ${isDark ? 'border-gray-800' : 'border-slate-200'}`}>
              <div className="flex items-center space-x-2">
                <FileCode className="w-5 h-5 text-[#F0B90B]" />
                <h3 className="text-base font-bold">Audit Event Payload Inspection</h3>
              </div>
              <button onClick={() => setSelectedLog(null)} className={`transition-colors ${isDark ? 'text-gray-400 hover:text-white' : 'text-slate-400 hover:text-slate-700'}`}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className={`my-4 p-3 rounded-xl border text-xs font-mono space-y-1 ${isDark ? 'bg-gray-900 border-gray-800 text-gray-300' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
              <div>Event ID: {selectedLog.id}</div>
              <div>Action: <strong className="text-[#F0B90B]">{selectedLog.action}</strong></div>
              <div>Admin: {selectedLog.adminName} ({selectedLog.adminPhone})</div>
              <div>Target: {selectedLog.targetType} / {selectedLog.targetId}</div>
              <div>Timestamp: {new Date(selectedLog.createdAt).toUTCString()}</div>
            </div>

            <div className="space-y-3 text-xs font-mono">
              <div>
                <span className="text-gray-400 block mb-1 font-sans">Event Details:</span>
                <pre className={`p-3 rounded-xl border text-[11px] overflow-x-auto max-h-36 ${isDark ? 'bg-black/60 border-gray-800 text-emerald-400' : 'bg-slate-900 text-emerald-300 border-slate-800'}`}>
                  {JSON.stringify(selectedLog.details, null, 2)}
                </pre>
              </div>

              {(selectedLog.previousValue || selectedLog.newValue) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <span className="text-rose-500 block mb-1 font-sans font-bold">Previous State:</span>
                    <pre className={`p-3 rounded-xl border text-[11px] overflow-x-auto max-h-36 ${isDark ? 'bg-black/60 border-gray-800 text-rose-300' : 'bg-slate-900 text-rose-300 border-slate-800'}`}>
                      {JSON.stringify(selectedLog.previousValue ?? 'None', null, 2)}
                    </pre>
                  </div>
                  <div>
                    <span className="text-emerald-500 block mb-1 font-sans font-bold">New State:</span>
                    <pre className={`p-3 rounded-xl border text-[11px] overflow-x-auto max-h-36 ${isDark ? 'bg-black/60 border-gray-800 text-emerald-300' : 'bg-slate-900 text-emerald-300 border-slate-800'}`}>
                      {JSON.stringify(selectedLog.newValue ?? 'None', null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className={`px-5 py-2 rounded-xl text-xs font-sans font-semibold border transition-colors ${
                  isDark ? 'bg-gray-800 hover:bg-gray-700 text-white border-gray-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
                }`}
              >
                Close Audit View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
