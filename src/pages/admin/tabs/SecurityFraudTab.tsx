import React, { useState, useEffect } from 'react';
import { useAdmin } from '../AdminContext';
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  Lock,
  Globe,
  Radio,
  X,
} from 'lucide-react';

export const SecurityFraudTab: React.FC = () => {
  const { fetchAdminApi, adminTheme, hasPermission } = useAdmin();
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAlert, setSelectedAlert] = useState<any>(null);
  const [resolveNotes, setResolveNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isDark = adminTheme === 'dark';

  const loadAlerts = async () => {
    try {
      setLoading(true);
      const res = await fetchAdminApi('/api/admin/security/alerts');
      setAlerts(res.alerts || []);
    } catch (err) {
      console.error('Failed to load fraud alerts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts();
  }, []);

  const handleResolveAlert = async (action: 'resolve' | 'dismiss') => {
    if (!selectedAlert) return;
    try {
      setSubmitting(true);
      await fetchAdminApi('/api/admin/security/resolve', {
        method: 'POST',
        body: JSON.stringify({
          alertId: selectedAlert.id,
          action,
          notes: resolveNotes,
        }),
      });
      setSelectedAlert(null);
      setResolveNotes('');
      loadAlerts();
    } catch (err: any) {
      alert(err.message || 'Alert update failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Security, AML & Fraud Heuristics
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Automated behavioural threat intelligence, login anomaly triggers, and rapid velocity enforcement.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <span className="flex h-2.5 w-2.5 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
          </span>
          <span className="text-xs font-mono text-rose-400 font-semibold uppercase">
            Heuristic Engine Monitoring Active
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className={`p-5 rounded-2xl border transition-all ${
              alert.severity === 'critical'
                ? 'bg-rose-500/5 border-rose-500/30'
                : alert.severity === 'high'
                ? 'bg-amber-500/5 border-amber-500/30'
                : isDark
                ? 'bg-[#161A23] border-gray-800'
                : 'bg-white border-slate-200 shadow-sm'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div className="flex items-center space-x-2.5">
                <div
                  className={`p-2 rounded-xl ${
                    alert.severity === 'critical'
                      ? 'bg-rose-500/20 text-rose-400'
                      : alert.severity === 'high'
                      ? 'bg-amber-500/20 text-amber-400'
                      : 'bg-blue-500/20 text-blue-400'
                  }`}
                >
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className={`text-xs font-bold uppercase font-mono ${isDark ? 'text-white' : 'text-slate-900'}`}>{alert.alertType}</span>
                    <span
                      className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                        alert.severity === 'critical'
                          ? 'bg-rose-500 text-white'
                          : alert.severity === 'high'
                          ? 'bg-amber-500 text-black'
                          : 'bg-blue-500 text-white'
                      }`}
                    >
                      {alert.severity}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    Impacted User: <strong className={isDark ? 'text-white' : 'text-slate-900'}>{alert.userName}</strong> ({alert.userPhone})
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <span
                  className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-md font-mono ${
                    alert.status === 'resolved'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : isDark
                      ? 'bg-gray-800 text-gray-300'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {alert.status}
                </span>
                <button
                  onClick={() => setSelectedAlert(alert)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                    isDark
                      ? 'bg-gray-800 hover:bg-gray-700 text-white border-gray-700'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
                  }`}
                >
                  Inspect Anomaly
                </button>
              </div>
            </div>

            <p className={`text-xs leading-relaxed font-sans ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>{alert.description}</p>

            <div className={`mt-3 pt-3 border-t flex flex-wrap items-center justify-between text-[11px] text-gray-500 font-mono ${isDark ? 'border-gray-800/60' : 'border-slate-200'}`}>
              <div>Incident ID: {alert.id}</div>
              <div>Detected: {new Date(alert.createdAt).toLocaleString()}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Inspection & Resolution Modal */}
      {selectedAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className={`w-full max-w-lg rounded-2xl p-6 shadow-2xl border ${isDark ? 'bg-[#161A23] border-gray-800 text-white' : 'bg-white border-slate-200 text-slate-900'}`}>
            <div className={`flex items-center justify-between pb-3 border-b ${isDark ? 'border-gray-800' : 'border-slate-200'}`}>
              <h3 className={`text-base font-bold flex items-center space-x-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                <ShieldAlert className="w-5 h-5 text-rose-500" />
                <span>Security Threat Analysis</span>
              </h3>
              <button onClick={() => setSelectedAlert(null)} className={`transition-colors ${isDark ? 'text-gray-400 hover:text-white' : 'text-slate-400 hover:text-slate-700'}`}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="my-4 space-y-3 text-xs">
              <div className={`p-3 rounded-xl border font-mono space-y-1 ${isDark ? 'bg-gray-900 border-gray-800 text-gray-300' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                <div>User: {selectedAlert.userName} ({selectedAlert.userPhone})</div>
                <div>Trigger Type: {selectedAlert.alertType}</div>
                <div>Severity Rating: {selectedAlert.severity.toUpperCase()}</div>
                <div>Status: {selectedAlert.status.toUpperCase()}</div>
              </div>

              <div>
                <span className="text-gray-400 block mb-1">Diagnostic Heuristics Metadata:</span>
                <pre className={`p-3 rounded-xl border font-mono text-[11px] overflow-x-auto ${isDark ? 'bg-black/50 border-gray-800 text-emerald-400' : 'bg-slate-900 text-emerald-300 border-slate-800'}`}>
                  {JSON.stringify(selectedAlert.metadata, null, 2)}
                </pre>
              </div>

              <div>
                <label className="text-gray-400 block mb-1">Resolution Compliance Notes</label>
                <textarea
                  rows={2}
                  placeholder="Explain actions taken (e.g. user phone verified via biometric call)..."
                  value={resolveNotes}
                  onChange={(e) => setResolveNotes(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl border text-xs outline-none focus:border-[#F0B90B] ${
                    isDark ? 'bg-gray-900 border-gray-800 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
              </div>
            </div>

            <div className={`flex items-center justify-end space-x-2 pt-2 border-t ${isDark ? 'border-gray-800' : 'border-slate-200'}`}>
              <button
                onClick={() => setSelectedAlert(null)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${isDark ? 'text-gray-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Close
              </button>
              {selectedAlert.status !== 'resolved' && (
                <>
                  <button
                    disabled={submitting}
                    onClick={() => handleResolveAlert('dismiss')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                      isDark ? 'bg-gray-800 hover:bg-gray-700 text-gray-300 border-gray-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                    }`}
                  >
                    Dismiss As False Positive
                  </button>
                  <button
                    disabled={submitting}
                    onClick={() => handleResolveAlert('resolve')}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-black font-semibold rounded-xl text-xs transition-colors"
                  >
                    {submitting ? 'Updating...' : 'Mark Threat Resolved'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
