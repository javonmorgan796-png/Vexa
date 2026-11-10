import React, { useState, useEffect, useCallback } from 'react';
import { useAdmin } from '../AdminContext';
import {
  Sliders,
  DollarSign,
  AlertTriangle,
  Save,
  CheckCircle2,
  RefreshCw,
  Power,
  Webhook,
  Copy,
  Check,
  Database,
  Globe,
} from 'lucide-react';

interface SystemSettingsData {
  maintenance_mode?: boolean;
  allow_new_signups?: boolean;
  allow_transfers?: boolean;
  allow_crypto_exchange?: boolean;
  allow_bill_payments?: boolean;
  tier1_daily_limit?: number;
  tier2_daily_limit?: number;
  tier3_daily_limit?: number;
  transfer_fee_flat?: number;
  instant_withdrawal_fee_pct?: number;
  session_timeout_minutes?: number;
  enforce_device_binding?: boolean;
  suspicious_amount_threshold?: number;
  tatum_webhook_url?: string;
}

type WebhookSource = 'database' | 'environment' | 'auto' | 'unconfigured';

export const SystemSettingsTab: React.FC = () => {
  const { fetchAdminApi, adminTheme, hasPermission } = useAdmin();
  const [settings, setSettings] = useState<SystemSettingsData>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resyncing, setResyncing] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [effectiveWebhookUrl, setEffectiveWebhookUrl] = useState('');
  const [webhookSource, setWebhookSource] = useState<WebhookSource>('unconfigured');
  const [suggestedWebhookUrl, setSuggestedWebhookUrl] = useState('');
  const [persistedInDb, setPersistedInDb] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  const isDark = adminTheme === 'dark';

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      setSaveError(null);
      const res = await fetchAdminApi('/api/admin/settings');
      setSettings(res.settings || {});
      setEffectiveWebhookUrl(res.effectiveTatumWebhookUrl || '');
      setWebhookSource(res.webhookSource || 'unconfigured');
      setSuggestedWebhookUrl(
        res.suggestedWebhookUrl || `${window.location.origin}/api/crypto/webhooks/tatum`,
      );
      setPersistedInDb(Boolean(res.persistedInDb));
    } catch (err: any) {
      setSaveError(err.message || 'Failed to load system settings.');
    } finally {
      setLoading(false);
    }
  }, [fetchAdminApi]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const handleToggle = (key: keyof SystemSettingsData) => {
    setSettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleChange = (key: keyof SystemSettingsData, value: unknown) => {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const validateWebhookInput = (value: string): string | null => {
    const trimmed = value.trim();
    if (!trimmed) return null;
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        return 'Tatum Webhook URL must start with https:// or http://.';
      }
      return null;
    } catch {
      return 'Enter a valid URL (for example, https://your-app.run.app/api/crypto/webhooks/tatum).';
    }
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const webhookValidationError = validateWebhookInput(settings.tatum_webhook_url || '');
    if (webhookValidationError) {
      setSaveError(webhookValidationError);
      setSaveSuccess(null);
      return;
    }

    try {
      setSaving(true);
      setSaveSuccess(null);
      setSaveError(null);
      const res = await fetchAdminApi('/api/admin/settings/update', {
        method: 'POST',
        body: JSON.stringify(settings),
      });
      if (res.settings) setSettings(res.settings);
      setEffectiveWebhookUrl(res.effectiveTatumWebhookUrl || '');
      setWebhookSource(res.webhookSource || 'unconfigured');
      setPersistedInDb(Boolean(res.persistedInDb));

      if (res.dbError) {
        setSaveError(`Saved in active server memory, but database write reported: ${res.dbError}`);
      } else {
        setSaveSuccess('System parameters and Tatum Webhook routing saved to the database.');
      }
      setTimeout(() => setSaveSuccess(null), 5000);
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save configuration.');
    } finally {
      setSaving(false);
    }
  };

  const handleResyncSubscriptions = async () => {
    try {
      setResyncing(true);
      setSaveError(null);
      setSaveSuccess(null);

      // Save current settings first if there's an unsaved valid webhook URL
      const webhookValidationError = validateWebhookInput(settings.tatum_webhook_url || '');
      if (webhookValidationError) {
        setSaveError(webhookValidationError);
        return;
      }

      await fetchAdminApi('/api/admin/settings/update', {
        method: 'POST',
        body: JSON.stringify({ tatum_webhook_url: (settings.tatum_webhook_url || '').trim() }),
      });

      const res = await fetchAdminApi('/api/admin/crypto/resync-webhooks', {
        method: 'POST',
      });

      if (res.webhookUrl) {
        setEffectiveWebhookUrl(res.webhookUrl);
      }
      if (res.webhookSource) {
        setWebhookSource(res.webhookSource);
      }

      if (!res.success && res.failed > 0) {
        const firstFailure = res.failures?.[0]?.error || 'One or more subscriptions failed to update.';
        setSaveError(`${res.message} (${firstFailure})`);
      } else {
        setSaveSuccess(res.message || 'Tatum deposit subscriptions re-synced successfully.');
      }
    } catch (err: any) {
      setSaveError(err.message || 'Failed to re-sync Tatum deposit subscriptions.');
    } finally {
      setResyncing(false);
    }
  };

  const handleCopyEffectiveUrl = () => {
    if (!effectiveWebhookUrl) return;
    navigator.clipboard.writeText(effectiveWebhookUrl);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  const sourceLabel =
    webhookSource === 'database'
      ? 'Database Override Active'
      : webhookSource === 'environment'
      ? 'Environment Variable (TATUM_WEBHOOK_URL)'
      : webhookSource === 'auto'
      ? 'Auto-Detected Host Fallback'
      : 'Not Configured';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            System Settings & Tatum Webhook Routing
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Configure blockchain webhook routing, transaction limits, KYC caps, and platform controls persisted in Supabase.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => void loadSettings()}
            disabled={loading}
            className={`px-3.5 py-2.5 rounded-xl border text-xs font-semibold flex items-center space-x-2 transition-colors whitespace-nowrap shrink-0 ${
              isDark
                ? 'border-gray-700 bg-gray-800/60 text-gray-200 hover:bg-gray-800'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 shadow-xs'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Reload</span>
          </button>

          {hasPermission('settings.manage') && (
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving || loading}
              className="px-5 py-2.5 bg-[#F0B90B] hover:bg-[#d9a606] disabled:opacity-50 text-black font-semibold rounded-xl text-xs transition-colors flex items-center space-x-2 shadow-sm whitespace-nowrap shrink-0"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Save Configuration'}</span>
            </button>
          )}
        </div>
      </div>

      {saveSuccess && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-500 flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{saveSuccess}</span>
        </div>
      )}

      {saveError && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-500 flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{saveError}</span>
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
        {/* Tatum Blockchain Webhook Routing (Full-Width Priority Section) */}
        <div
          className={`p-6 rounded-2xl border lg:col-span-2 ${
            isDark ? 'bg-[#161A23] border-gray-800' : 'bg-white border-slate-200 shadow-sm'
          } space-y-5`}
        >
          <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b ${isDark ? 'border-gray-800' : 'border-slate-200'}`}>
            <div className="flex items-center space-x-2.5">
              <div className="p-2 rounded-xl bg-[#F0B90B]/10 border border-[#F0B90B]/25 text-[#F0B90B]">
                <Webhook className="w-4 h-4" />
              </div>
              <div>
                <h2 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Tatum Webhook URL & Deposit Routing
                </h2>
                <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                  Stored in Supabase <span className="font-mono">system_settings</span> and used dynamically whenever Tatum deposit subscriptions are created or refreshed.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs font-mono tabular-nums">
              <span className="inline-flex items-center gap-1.5 text-emerald-500 font-semibold">
                <Database className="w-3.5 h-3.5" />
                <span>{persistedInDb ? 'DB Synced' : 'Cache Fallback'}</span>
              </span>
              <span aria-hidden="true" className="text-gray-500">·</span>
              <span className={isDark ? 'text-gray-300' : 'text-slate-600'}>{sourceLabel}</span>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label
                htmlFor="tatum-webhook-url-input"
                className={`text-xs font-semibold ${isDark ? 'text-gray-200' : 'text-slate-700'}`}
              >
                Tatum Webhook URL
              </label>
              {suggestedWebhookUrl && (
                <button
                  type="button"
                  onClick={() => handleChange('tatum_webhook_url', suggestedWebhookUrl)}
                  className="text-xs font-semibold text-[#F0B90B] hover:underline self-start sm:self-auto"
                >
                  Use current app endpoint ({suggestedWebhookUrl})
                </button>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Globe className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  id="tatum-webhook-url-input"
                  type="url"
                  value={settings.tatum_webhook_url ?? ''}
                  onChange={(e) => handleChange('tatum_webhook_url', e.target.value)}
                  placeholder="https://your-public-domain.com/api/crypto/webhooks/tatum"
                  disabled={!hasPermission('settings.manage') || loading}
                  className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-xs font-mono outline-none transition-colors focus:border-[#F0B90B] ${
                    isDark
                      ? 'bg-gray-900 border-gray-800 text-white placeholder-gray-500'
                      : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
                  }`}
                />
              </div>

              {hasPermission('settings.manage') && (
                <button
                  type="submit"
                  disabled={saving || loading}
                  className="px-4 py-2.5 bg-[#F0B90B] hover:bg-[#d9a606] disabled:opacity-50 text-black font-semibold rounded-xl text-xs transition-colors flex items-center justify-center space-x-2 whitespace-nowrap shrink-0"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{saving ? 'Saving URL...' : 'Save Webhook URL'}</span>
                </button>
              )}
            </div>

            <p className={`text-[11px] leading-relaxed ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
              Enter your public HTTPS endpoint (for example, your deployed Cloud Run URL ending in{' '}
              <span className="font-mono">/api/crypto/webhooks/tatum</span>). Leaving this blank falls back to the server environment variable{' '}
              <span className="font-mono">TATUM_WEBHOOK_URL</span> or <span className="font-mono">APP_URL</span>.
            </p>
          </div>

          <div
            className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${
              isDark ? 'bg-gray-900/50 border-gray-800' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div className="min-w-0 flex-1 space-y-1">
              <div className={`text-[11px] font-semibold ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                Active Routing Target ({sourceLabel})
              </div>
              <div className="flex items-center gap-2">
                <code className={`text-xs font-mono truncate ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
                  {effectiveWebhookUrl || 'No active webhook URL resolved'}
                </code>
                {effectiveWebhookUrl && (
                  <button
                    type="button"
                    onClick={handleCopyEffectiveUrl}
                    className={`p-1 rounded-lg transition-colors ${isDark ? 'text-gray-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
                    title="Copy active webhook URL"
                  >
                    {copiedWebhook ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>
            </div>

            {hasPermission('settings.manage') && (
              <button
                type="button"
                onClick={() => void handleResyncSubscriptions()}
                disabled={resyncing || loading}
                className={`px-4 py-2 rounded-xl border text-xs font-semibold flex items-center justify-center space-x-2 transition-colors whitespace-nowrap shrink-0 ${
                  isDark
                    ? 'border-gray-700 bg-gray-800 hover:bg-gray-700 text-white'
                    : 'border-slate-300 bg-white hover:bg-slate-100 text-slate-800 shadow-xs'
                }`}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${resyncing ? 'animate-spin' : ''}`} />
                <span>{resyncing ? 'Re-syncing Subscriptions...' : 'Re-sync Deposit Subscriptions'}</span>
              </button>
            )}
          </div>
        </div>

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
              className={`w-full px-3 py-2 rounded-xl border text-xs font-mono tabular-nums outline-none focus:border-[#F0B90B] ${
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
              className={`w-full px-3 py-2 rounded-xl border text-xs font-mono tabular-nums outline-none focus:border-[#F0B90B] ${
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
              className={`w-full px-3 py-2 rounded-xl border text-xs font-mono tabular-nums outline-none focus:border-[#F0B90B] ${
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
              className={`w-full px-3 py-2 rounded-xl border text-xs font-mono tabular-nums outline-none focus:border-[#F0B90B] ${
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
              className={`w-full px-3 py-2 rounded-xl border text-xs font-mono tabular-nums outline-none focus:border-[#F0B90B] ${
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
              className={`w-full px-3 py-2 rounded-xl border text-xs font-mono tabular-nums outline-none focus:border-[#F0B90B] ${
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
                key: 'maintenance_mode' as const,
                label: 'Maintenance Mode',
                desc: 'Halt all customer logins and non-admin operations.',
                danger: true,
              },
              {
                key: 'allow_new_signups' as const,
                label: 'New Customer Signups',
                desc: 'Allow new phone account registration.',
              },
              {
                key: 'allow_transfers' as const,
                label: 'Outbound Bank Transfers',
                desc: 'Allow NIP interbank transfer dispatches.',
              },
              {
                key: 'allow_crypto_exchange' as const,
                label: 'Crypto Exchange Module',
                desc: 'Allow USDT purchase, sale and deposits.',
              },
              {
                key: 'allow_bill_payments' as const,
                label: 'Utility & Bill Payments',
                desc: 'Allow airtime, electricity, and cable topups.',
              },
              {
                key: 'enforce_device_binding' as const,
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
                    : isDark
                    ? 'bg-gray-900/40 border-gray-800'
                    : 'bg-slate-50 border-slate-200 hover:border-slate-300'
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
