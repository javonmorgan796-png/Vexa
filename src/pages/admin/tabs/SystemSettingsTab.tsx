import React, { useState, useEffect } from 'react';
import { useAdmin } from '../AdminContext';
import {
  Settings,
  Shield,
  Sliders,
  DollarSign,
  AlertTriangle,
  Save,
  CheckCircle2,
  RefreshCw,
  Power,
} from 'lucide-react';

export const SystemSettingsTab: React.FC = () => {
  const { fetchAdminApi, adminTheme, hasPermission, isSuperAdmin } = useAdmin();
  const [settings, setSettings] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const isDark = adminTheme === 'dark';

  const loadSettings = async () => {
    try {
      setLoading(true);
      const res = await fetchAdminApi('/api/admin/settings');
      setSettings(res.settings || {});
    } catch (err) {
      console.error('Failed to load system settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleToggle = (key: string) => {
    setSettings((prev: any) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleChange = (key: string, value: any) => {
    setSettings((prev: any) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setSaveSuccess(false);
      await fetchAdminApi('/api/admin/settings/update', {
        method: 'POST',
        body: JSON.stringify(settings),
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      alert(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            System Architecture & Financial Rule Engine
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Configure transaction limits, regulatory KYC caps, platform switches, and fraud thresholds.
          </p>
        </div>

        {hasPermission('settings.manage') && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 bg-[#F0B90B] hover:bg-[#d9a606] text-black font-semibold rounded-xl text-xs transition-colors flex items-center space-x-2 shadow-sm"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Persisting Parameters...' : 'Save Configuration'}</span>
          </button>
        )}
      </div>

      {saveSuccess && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-400 flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>System parameters updated successfully. New rules applied to transaction execution engine.</span>
        </div>
      )}

      {settings.maintenance_mode && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-400 flex items-center space-x-3">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <div>
            <span className="font-bold">SYSTEM MAINTENANCE ACTIVE: </span>
            Customer client logins and transaction dispatches are temporarily halted for core database synchronization.
          </div>
        </div>
      )}

      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tier Limits */}
        <div className={`p-6 rounded-2xl border ${isDark ? 'bg-[#161A23] border-gray-800' : 'bg-white border-slate-200 shadow-sm'} space-y-4`}>
          <div className={`flex items-center space-x-2 pb-3 border-b ${isDark ? 'border-gray-800' : 'border-slate-200'}`}>
            <Sliders className="w-4 h-4 text-[#F0B90B]" />
            <h2 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Customer Tier Daily Limits (NGN)</h2>
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-1">Tier 1 Daily Transfer Limit (Basic KYC)</label>
            <input
              type="number"
              value={settings.tier1_daily_limit ?? 50000}
              onChange={(e) => handleChange('tier1_daily_limit', Number(e.target.value))}
              className={`w-full px-3 py-2 rounded-xl border text-xs font-mono outline-none focus:border-[#F0B90B] ${
                isDark ? 'bg-gray-900 border-gray-800 text-white' : 'bg-white border-slate-300 text-slate-900'
              }`}
            />
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-1">Tier 2 Daily Transfer Limit (Verified NIN/BVN)</label>
            <input
              type="number"
              value={settings.tier2_daily_limit ?? 500000}
              onChange={(e) => handleChange('tier2_daily_limit', Number(e.target.value))}
              className={`w-full px-3 py-2 rounded-xl border text-xs font-mono outline-none focus:border-[#F0B90B] ${
                isDark ? 'bg-gray-900 border-gray-800 text-white' : 'bg-white border-slate-300 text-slate-900'
              }`}
            />
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-1">Tier 3 Daily Transfer Limit (Full Corporate/Address)</label>
            <input
              type="number"
              value={settings.tier3_daily_limit ?? 5000000}
              onChange={(e) => handleChange('tier3_daily_limit', Number(e.target.value))}
              className={`w-full px-3 py-2 rounded-xl border text-xs font-mono outline-none focus:border-[#F0B90B] ${
                isDark ? 'bg-gray-900 border-gray-800 text-white' : 'bg-white border-slate-300 text-slate-900'
              }`}
            />
          </div>
        </div>

        {/* Fees & Risk Controls */}
        <div className={`p-6 rounded-2xl border ${isDark ? 'bg-[#161A23] border-gray-800' : 'bg-white border-slate-200 shadow-sm'} space-y-4`}>
          <div className={`flex items-center space-x-2 pb-3 border-b ${isDark ? 'border-gray-800' : 'border-slate-200'}`}>
            <DollarSign className="w-4 h-4 text-[#F0B90B]" />
            <h2 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Fee Structure & Risk Thresholds</h2>
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-1">Interbank Outbound Flat Fee (NGN)</label>
            <input
              type="number"
              step="0.1"
              value={settings.transfer_fee_flat ?? 10.0}
              onChange={(e) => handleChange('transfer_fee_flat', Number(e.target.value))}
              className={`w-full px-3 py-2 rounded-xl border text-xs font-mono outline-none focus:border-[#F0B90B] ${
                isDark ? 'bg-gray-900 border-gray-800 text-white' : 'bg-white border-slate-300 text-slate-900'
              }`}
            />
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-1">Instant Withdrawal Surcharge (%)</label>
            <input
              type="number"
              step="0.01"
              value={settings.instant_withdrawal_fee_pct ?? 0.5}
              onChange={(e) => handleChange('instant_withdrawal_fee_pct', Number(e.target.value))}
              className={`w-full px-3 py-2 rounded-xl border text-xs font-mono outline-none focus:border-[#F0B90B] ${
                isDark ? 'bg-gray-900 border-gray-800 text-white' : 'bg-white border-slate-300 text-slate-900'
              }`}
            />
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-1">Heuristic High-Risk Amount Threshold (NGN)</label>
            <input
              type="number"
              value={settings.suspicious_amount_threshold ?? 1000000}
              onChange={(e) => handleChange('suspicious_amount_threshold', Number(e.target.value))}
              className={`w-full px-3 py-2 rounded-xl border text-xs font-mono outline-none focus:border-[#F0B90B] ${
                isDark ? 'bg-gray-900 border-gray-800 text-white' : 'bg-white border-slate-300 text-slate-900'
              }`}
            />
          </div>
        </div>

        {/* Platform Core Service Toggles */}
        <div className={`p-6 rounded-2xl border lg:col-span-2 ${isDark ? 'bg-[#161A23] border-gray-800' : 'bg-white border-slate-200 shadow-sm'} space-y-4`}>
          <div className={`flex items-center space-x-2 pb-3 border-b ${isDark ? 'border-gray-800' : 'border-slate-200'}`}>
            <Power className="w-4 h-4 text-[#F0B90B]" />
            <h2 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Service Master Kill-Switches</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                key: 'maintenance_mode',
                label: 'Maintenance Mode',
                desc: 'Halt all customer logins and non-admin operations.',
                danger: true,
              },
              {
                key: 'allow_new_signups',
                label: 'New Customer Signups',
                desc: 'Allow new phone account registration.',
              },
              {
                key: 'allow_transfers',
                label: 'Outbound Bank Transfers',
                desc: 'Allow NIP interbank transfer dispatches.',
              },
              {
                key: 'allow_crypto_exchange',
                label: 'Crypto Exchange Module',
                desc: 'Allow USDT purchase, sale and deposits.',
              },
              {
                key: 'allow_bill_payments',
                label: 'Utility & Bill Payments',
                desc: 'Allow airtime, electricity, and cable topups.',
              },
              {
                key: 'enforce_device_binding',
                label: 'Enforce Device Binding',
                desc: 'Require biometric/passcode on new browser hardware.',
              },
            ].map((item) => (
              <div
                key={item.key}
                onClick={() => handleToggle(item.key)}
                className={`p-4 rounded-xl border cursor-pointer transition-all flex items-start justify-between ${
                  settings[item.key]
                    ? item.danger
                      ? 'bg-rose-500/10 border-rose-500/30'
                      : 'bg-emerald-500/10 border-emerald-500/30'
                    : isDark ? 'bg-gray-900/40 border-gray-800' : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                }`}
              >
                <div>
                  <div className={`text-xs font-bold mb-0.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>{item.label}</div>
                  <div className="text-[11px] text-gray-400">{item.desc}</div>
                </div>

                <div
                  className={`w-10 h-5 rounded-full p-0.5 transition-colors shrink-0 ${
                    settings[item.key] ? (item.danger ? 'bg-rose-500' : 'bg-[#F0B90B]') : isDark ? 'bg-gray-800' : 'bg-slate-300'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-black transition-transform ${
                      settings[item.key] ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </form>
    </div>
  );
};
