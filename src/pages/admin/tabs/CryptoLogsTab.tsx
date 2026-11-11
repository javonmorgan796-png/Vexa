import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAdmin } from '../AdminContext';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Eye,
  RefreshCw,
  Search,
  ShieldAlert,
  Trash2,
  Webhook,
  X,
} from 'lucide-react';

type WebhookOutcome =
  | 'credited'
  | 'pending'
  | 'already_processed'
  | 'ignored'
  | 'rejected_signature'
  | 'invalid_payload'
  | 'error';

interface CryptoWebhookLogEntry {
  id: string;
  receivedAt: string;
  method: string;
  path: string;
  sourceIp: string;
  contentType: string;
  headers: Record<string, string>;
  hasPayloadHash: boolean;
  signatureValid: boolean | null;
  verifiedOnChain: boolean;
  httpStatus: number;
  outcome: WebhookOutcome;
  outcomeReason: string;
  durationMs: number;
  parsed: {
    asset: string | null;
    chain: string | null;
    address: string | null;
    txHash: string | null;
    amount: string | null;
    confirmations: number | null;
    type: string | null;
    subscriptionType: string | null;
    userId: string | null;
  };
  rawBody: string;
  rawJson: Record<string, unknown> | null;
  responsePayload: Record<string, unknown>;
}

interface DepositEventRow {
  id: string;
  deposit_reference: string;
  user_id: string;
  asset: string;
  network: string;
  address: string;
  transaction_hash: string;
  amount: number;
  confirmations: number;
  required_confirmations: number;
  status: 'pending' | 'credited';
  created_at: string;
  credited_at: string | null;
}

interface CryptoLogsResponse {
  logs: CryptoWebhookLogEntry[];
  depositEvents: DepositEventRow[];
  webhookConfig: {
    url: string;
    source: string;
    hasTatumApiKey: boolean;
    hasWebhookSecret: boolean;
    networkMode: 'mainnet' | 'testnet';
  };
}

type LogViewMode = 'webhooks' | 'deposit-events';
type OutcomeFilter = 'all' | 'credited' | 'pending' | 'ignored' | 'rejected';

function outcomeMeta(outcome: WebhookOutcome) {
  switch (outcome) {
    case 'credited':
    case 'already_processed':
      return {
        label: outcome === 'already_processed' ? 'Duplicate' : 'Credited',
        colorClass: 'text-emerald-600 dark:text-emerald-400',
        Icon: CheckCircle2,
      };
    case 'pending':
      return {
        label: 'Pending Conf.',
        colorClass: 'text-amber-600 dark:text-amber-400',
        Icon: Clock,
      };
    case 'ignored':
      return {
        label: 'Ignored',
        colorClass: 'text-slate-500 dark:text-slate-400',
        Icon: AlertTriangle,
      };
    case 'rejected_signature':
      return {
        label: '401 Rejected',
        colorClass: 'text-rose-600 dark:text-rose-400',
        Icon: ShieldAlert,
      };
    case 'invalid_payload':
    case 'error':
    default:
      return {
        label: outcome === 'invalid_payload' ? 'Invalid Payload' : 'Error',
        colorClass: 'text-rose-600 dark:text-rose-400',
        Icon: AlertTriangle,
      };
  }
}

export const CryptoLogsTab: React.FC = () => {
  const { fetchAdminApi, adminTheme } = useAdmin();
  const isDark = adminTheme === 'dark';

  const [data, setData] = useState<CryptoLogsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [viewMode, setViewMode] = useState<LogViewMode>('webhooks');
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>('all');
  const [assetFilter, setAssetFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [selectedLog, setSelectedLog] = useState<CryptoWebhookLogEntry | null>(null);
  const [rawViewMode, setRawViewMode] = useState<'pretty' | 'wire'>('pretty');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  const loadLogs = useCallback(
    async (silent = false) => {
      try {
        if (!silent) setLoading(true);
        else setRefreshing(true);
        setError('');
        const res = await fetchAdminApi<CryptoLogsResponse>('/api/admin/crypto/logs');
        setData(res);
        setLastSyncedAt(new Date());
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load crypto webhook logs.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [fetchAdminApi],
  );

  useEffect(() => {
    void loadLogs(false);
  }, [loadLogs]);

  useEffect(() => {
    if (!autoRefresh) return undefined;
    const timer = window.setInterval(() => {
      void loadLogs(true);
    }, 6000);
    return () => window.clearInterval(timer);
  }, [autoRefresh, loadLogs]);

  const handleClearLogs = async () => {
    setClearing(true);
    setError('');
    try {
      await fetchAdminApi('/api/admin/crypto/logs', { method: 'DELETE' });
      setSelectedLog(null);
      await loadLogs(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear webhook logs.');
    } finally {
      setClearing(false);
    }
  };

  const copyText = (text: string, key: string) => {
    if (!text) return;
    void navigator.clipboard?.writeText(text);
    setCopiedId(key);
    window.setTimeout(() => setCopiedId(null), 1800);
  };

  const logs = data?.logs ?? [];
  const depositEvents = data?.depositEvents ?? [];
  const webhookConfig = data?.webhookConfig;

  const summary = useMemo(() => {
    const credited = logs.filter((l) => l.outcome === 'credited' || l.outcome === 'already_processed').length;
    const pending = logs.filter((l) => l.outcome === 'pending').length;
    const rejectedOrFailed = logs.filter(
      (l) => l.outcome === 'rejected_signature' || l.outcome === 'invalid_payload' || l.outcome === 'error',
    ).length;
    return { total: logs.length, credited, pending, rejectedOrFailed };
  }, [logs]);

  const filteredLogs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return logs.filter((entry) => {
      if (outcomeFilter === 'credited' && entry.outcome !== 'credited' && entry.outcome !== 'already_processed') {
        return false;
      }
      if (outcomeFilter === 'pending' && entry.outcome !== 'pending') {
        return false;
      }
      if (outcomeFilter === 'ignored' && entry.outcome !== 'ignored') {
        return false;
      }
      if (
        outcomeFilter === 'rejected' &&
        entry.outcome !== 'rejected_signature' &&
        entry.outcome !== 'invalid_payload' &&
        entry.outcome !== 'error'
      ) {
        return false;
      }

      if (assetFilter !== 'ALL') {
        const assetStr = (entry.parsed.asset || '').toUpperCase();
        const chainStr = (entry.parsed.chain || '').toUpperCase();
        if (assetFilter === 'BTC' && !assetStr.includes('BTC') && !chainStr.includes('BITCOIN')) return false;
        if (assetFilter === 'ETH' && !assetStr.includes('ETH') && !chainStr.includes('ETH')) return false;
        if (assetFilter === 'USDT' && !assetStr.includes('USDT') && !chainStr.includes('TRON')) return false;
      }

      if (!q) return true;
      return (
        (entry.parsed.address || '').toLowerCase().includes(q) ||
        (entry.parsed.txHash || '').toLowerCase().includes(q) ||
        (entry.parsed.chain || '').toLowerCase().includes(q) ||
        entry.outcomeReason.toLowerCase().includes(q) ||
        entry.sourceIp.toLowerCase().includes(q) ||
        entry.rawBody.toLowerCase().includes(q)
      );
    });
  }, [assetFilter, logs, outcomeFilter, search]);

  const filteredEvents = useMemo(() => {
    const q = search.trim().toLowerCase();
    return depositEvents.filter((ev) => {
      if (assetFilter !== 'ALL' && ev.asset !== assetFilter) return false;
      if (!q) return true;
      return (
        ev.address.toLowerCase().includes(q) ||
        ev.transaction_hash.toLowerCase().includes(q) ||
        ev.network.toLowerCase().includes(q) ||
        ev.status.toLowerCase().includes(q)
      );
    });
  }, [assetFilter, depositEvents, search]);

  const surfaceClass = isDark
    ? 'bg-[#161A23] border-gray-800 text-gray-100'
    : 'bg-white border-slate-200 text-slate-900 shadow-xs';
  const mutedText = isDark ? 'text-gray-400' : 'text-slate-500';
  const dividerClass = isDark ? 'border-gray-800' : 'border-slate-200';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className={`text-xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Crypto Logs
          </h1>
          <p className={`text-xs mt-1 ${mutedText}`}>
            Raw incoming Tatum webhook payloads, signature checks, and confirmation states for debugging BTC, ETH, and USDT deposits.
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setAutoRefresh((v) => !v)}
            className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 ${
              autoRefresh
                ? 'bg-[#F0B90B]/15 border-[#F0B90B]/40 text-[#B7791F] dark:text-[#F0B90B]'
                : isDark
                  ? 'bg-gray-800/60 border-gray-700 text-gray-300'
                  : 'bg-white border-slate-300 text-slate-700'
            }`}
          >
            {autoRefresh ? 'Auto-refresh On (6s)' : 'Auto-refresh Off'}
          </button>

          <button
            type="button"
            onClick={() => void loadLogs(true)}
            disabled={refreshing}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold border inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
              isDark
                ? 'bg-gray-800 border-gray-700 text-gray-200 hover:bg-gray-700'
                : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => void handleClearLogs()}
            disabled={clearing || logs.length === 0}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold border inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 disabled:opacity-40 ${
              isDark
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20'
                : 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{clearing ? 'Clearing…' : 'Clear Logs'}</span>
          </button>
        </div>
      </div>

      {/* Endpoint & Config Diagnostic Strip */}
      <div className={`rounded-xl border px-4 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3 ${surfaceClass}`}>
        <div className="min-w-0 flex-1 space-y-1">
          <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-xs ${mutedText}`}>
            <span className={`font-semibold ${isDark ? 'text-gray-200' : 'text-slate-800'}`}>
              Active Webhook Endpoint
            </span>
            <span aria-hidden="true">·</span>
            <span className={webhookConfig?.networkMode === 'testnet' ? 'text-amber-500 font-semibold' : 'text-emerald-500 font-semibold'}>
              {webhookConfig?.networkMode === 'testnet' ? 'Tatum Testnet' : 'Tatum Mainnet'}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              HMAC Secret: {webhookConfig?.hasWebhookSecret ? 'Configured' : 'Missing'}
            </span>
            {lastSyncedAt && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  Synced {lastSyncedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <code className={`text-xs font-mono truncate ${isDark ? 'text-cyan-300' : 'text-slate-700'}`}>
              {webhookConfig?.url || '/api/crypto/webhooks/tatum'}
            </code>
            {webhookConfig?.url && (
              <button
                type="button"
                onClick={() => copyText(webhookConfig.url, 'webhook-url')}
                className={`p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 ${mutedText}`}
                title="Copy webhook URL"
              >
                {copiedId === 'webhook-url' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>
        </div>

        {/* Sub-view Switcher */}
        <div className={`flex items-center gap-1 p-1 rounded-lg border shrink-0 ${isDark ? 'bg-[#0F131B] border-gray-800' : 'bg-slate-100 border-slate-200'}`}>
          <button
            type="button"
            onClick={() => setViewMode('webhooks')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              viewMode === 'webhooks'
                ? 'bg-[#F0B90B] text-black shadow-xs'
                : isDark
                  ? 'text-gray-400 hover:text-white'
                  : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Incoming Webhooks ({logs.length})
          </button>
          <button
            type="button"
            onClick={() => setViewMode('deposit-events')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              viewMode === 'deposit-events'
                ? 'bg-[#F0B90B] text-black shadow-xs'
                : isDark
                  ? 'text-gray-400 hover:text-white'
                  : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Deposit Ledger Events ({depositEvents.length})
          </button>
        </div>
      </div>

      {/* 4-Column Metric Strip */}
      <div className={`grid grid-cols-2 lg:grid-cols-4 rounded-xl border divide-y lg:divide-y-0 lg:divide-x ${surfaceClass} ${isDark ? 'divide-gray-800' : 'divide-slate-200'}`}>
        <div className="p-4">
          <div className={`text-xs font-medium ${mutedText}`}>Captured Webhooks</div>
          <div className="mt-1 text-2xl font-bold font-mono tabular-nums">{summary.total}</div>
        </div>
        <div className="p-4">
          <div className={`text-xs font-medium ${mutedText}`}>Credited / Matched</div>
          <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-emerald-500">{summary.credited}</div>
        </div>
        <div className="p-4">
          <div className={`text-xs font-medium ${mutedText}`}>Pending Confirmations</div>
          <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-amber-500">{summary.pending}</div>
        </div>
        <div className="p-4">
          <div className={`text-xs font-medium ${mutedText}`}>Rejected / Errors</div>
          <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-rose-500">{summary.rejectedOrFailed}</div>
        </div>
      </div>

      {error && (
        <div className={`rounded-xl border px-4 py-3 text-xs flex items-center justify-between ${isDark ? 'bg-rose-500/10 border-rose-500/30 text-rose-300' : 'bg-rose-50 border-rose-200 text-rose-700'}`}>
          <span>{error}</span>
          <button type="button" onClick={() => void loadLogs(false)} className="font-semibold underline ml-4">
            Retry
          </button>
        </div>
      )}

      {/* Search & Filters Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center flex-wrap gap-2">
          {viewMode === 'webhooks' && (
            <div className={`flex items-center gap-1 p-1 rounded-lg border ${isDark ? 'bg-[#12151D] border-gray-800' : 'bg-slate-100 border-slate-200'}`}>
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'credited', label: 'Credited' },
                  { id: 'pending', label: 'Pending' },
                  { id: 'ignored', label: 'Ignored' },
                  { id: 'rejected', label: 'Rejected / Err' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setOutcomeFilter(tab.id)}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    outcomeFilter === tab.id
                      ? isDark
                        ? 'bg-[#F0B90B] text-black'
                        : 'bg-white text-slate-900 shadow-xs'
                      : mutedText
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          <div className={`flex items-center gap-1 p-1 rounded-lg border ${isDark ? 'bg-[#12151D] border-gray-800' : 'bg-slate-100 border-slate-200'}`}>
            {['ALL', 'BTC', 'ETH', 'USDT'].map((asset) => (
              <button
                key={asset}
                type="button"
                onClick={() => setAssetFilter(asset)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  assetFilter === asset
                    ? isDark
                      ? 'bg-[#F0B90B] text-black'
                      : 'bg-white text-slate-900 shadow-xs'
                    : mutedText
                }`}
              >
                {asset}
              </button>
            ))}
          </div>
        </div>

        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by address, tx hash, JSON, reason..."
            className={`w-full pl-9 pr-3 py-2 rounded-lg text-xs border outline-none ${
              isDark
                ? 'bg-[#161A23] border-gray-800 text-white placeholder-gray-500 focus:border-[#F0B90B]'
                : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-[#F0B90B]'
            }`}
          />
        </div>
      </div>

      {/* Main Data Table */}
      <div className={`rounded-xl border overflow-hidden ${surfaceClass}`}>
        {loading ? (
          <div className="divide-y divide-gray-800/40">
            {[0, 1, 2, 3].map((row) => (
              <div key={row} className="px-4 py-3.5 flex items-center justify-between gap-4 animate-pulse">
                <div className={`h-4 w-32 rounded ${isDark ? 'bg-gray-800' : 'bg-slate-200'}`} />
                <div className={`h-4 w-24 rounded ${isDark ? 'bg-gray-800' : 'bg-slate-200'}`} />
                <div className={`h-4 w-56 rounded ${isDark ? 'bg-gray-800' : 'bg-slate-200'}`} />
                <div className={`h-4 w-20 rounded ${isDark ? 'bg-gray-800' : 'bg-slate-200'}`} />
              </div>
            ))}
          </div>
        ) : viewMode === 'webhooks' ? (
          filteredLogs.length === 0 ? (
            <div className="py-14 px-6 text-center">
              <Webhook className={`w-9 h-9 mx-auto mb-3 ${mutedText}`} />
              <p className="text-sm font-semibold">
                {logs.length === 0 ? 'No incoming Tatum webhooks captured yet' : 'No webhook logs match your current filters'}
              </p>
              <p className={`text-xs mt-1 max-w-md mx-auto ${mutedText}`}>
                {logs.length === 0
                  ? 'Every POST request received at /api/crypto/webhooks/tatum (including rejected 401/400 payloads and processed deposits) will appear here with its raw JSON and headers.'
                  : 'Try clearing the search query or switching back to All outcomes.'}
              </p>
              {logs.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setOutcomeFilter('all');
                    setAssetFilter('ALL');
                    setSearch('');
                  }}
                  className="mt-4 px-4 py-2 rounded-lg bg-[#F0B90B] text-black text-xs font-semibold"
                >
                  Reset Filters
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className={`border-b text-[11px] font-semibold uppercase tracking-wider ${dividerClass} ${isDark ? 'bg-[#12151D] text-gray-400' : 'bg-slate-50 text-slate-500'}`}>
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Outcome</th>
                    <th className="py-3 px-4">Asset · Chain</th>
                    <th className="py-3 px-4">Address & Tx Hash</th>
                    <th className="py-3 px-4 text-right">Amount · Conf</th>
                    <th className="py-3 px-4">Auth / Verify</th>
                    <th className="py-3 px-4 text-right">Payload</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDark ? 'divide-gray-800/60' : 'divide-slate-100'}`}>
                  {filteredLogs.map((entry) => {
                    const meta = outcomeMeta(entry.outcome);
                    const StatusIcon = meta.Icon;
                    return (
                      <tr
                        key={entry.id}
                        onClick={() => setSelectedLog(entry)}
                        className={`cursor-pointer transition-colors ${isDark ? 'hover:bg-gray-800/30' : 'hover:bg-slate-50'}`}
                      >
                        <td className="py-3 px-4 font-mono tabular-nums text-xs whitespace-nowrap">
                          <div>{new Date(entry.receivedAt).toLocaleDateString(undefined, { dateStyle: 'short' })}</div>
                          <div className={`text-[11px] ${mutedText}`}>
                            {new Date(entry.receivedAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}{' '}
                            · {entry.durationMs}ms
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <div className={`flex items-center gap-1.5 text-xs font-semibold ${meta.colorClass}`}>
                            <StatusIcon className="w-3.5 h-3.5 shrink-0" />
                            <span>{meta.label}</span>
                            <span className={`font-mono text-[11px] ${mutedText}`}>({entry.httpStatus})</span>
                          </div>
                          <p className={`text-[11px] mt-0.5 line-clamp-1 max-w-[230px] ${mutedText}`} title={entry.outcomeReason}>
                            {entry.outcomeReason}
                          </p>
                        </td>

                        <td className="py-3 px-4 text-xs">
                          <div className="font-semibold">{entry.parsed.asset || 'Unknown'}</div>
                          <div className={`text-[11px] font-mono ${mutedText}`}>{entry.parsed.chain || '—'}</div>
                        </td>

                        <td className="py-3 px-4 font-mono text-xs">
                          <div className="truncate max-w-[200px]" title={entry.parsed.address || ''}>
                            {entry.parsed.address || '—'}
                          </div>
                          <div className={`text-[11px] truncate max-w-[200px] ${mutedText}`} title={entry.parsed.txHash || ''}>
                            {entry.parsed.txHash ? `Tx: ${entry.parsed.txHash}` : 'Tx: —'}
                          </div>
                        </td>

                        <td className="py-3 px-4 text-right font-mono tabular-nums text-xs whitespace-nowrap">
                          <div className="font-semibold">
                            {entry.parsed.amount ? `${entry.parsed.amount} ${entry.parsed.asset || ''}`.trim() : '—'}
                          </div>
                          <div className={`text-[11px] ${mutedText}`}>
                            {entry.parsed.confirmations !== null ? `${entry.parsed.confirmations} confs` : 'confs: —'}
                          </div>
                        </td>

                        <td className="py-3 px-4 text-xs">
                          <div>
                            HMAC:{' '}
                            <span className={entry.signatureValid ? 'text-emerald-500 font-semibold' : 'text-amber-500 font-semibold'}>
                              {entry.signatureValid === true ? 'Valid' : entry.hasPayloadHash ? 'Mismatch' : 'Absent'}
                            </span>
                          </div>
                          <div className={`text-[11px] ${mutedText}`}>
                            On-chain: {entry.verifiedOnChain ? 'Verified' : 'Not used'}
                          </div>
                        </td>

                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedLog(entry);
                            }}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border inline-flex items-center gap-1 whitespace-nowrap shrink-0 ${
                              isDark
                                ? 'bg-gray-800 border-gray-700 text-gray-200 hover:border-[#F0B90B]'
                                : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Raw</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : filteredEvents.length === 0 ? (
          <div className="py-14 px-6 text-center">
            <Clock className={`w-9 h-9 mx-auto mb-3 ${mutedText}`} />
            <p className="text-sm font-semibold">No deposit ledger events found</p>
            <p className={`text-xs mt-1 ${mutedText}`}>
              Records in crypto_deposit_events created by webhooks or direct on-chain sync will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className={`border-b text-[11px] font-semibold uppercase tracking-wider ${dividerClass} ${isDark ? 'bg-[#12151D] text-gray-400' : 'bg-slate-50 text-slate-500'}`}>
                  <th className="py-3 px-4">Created</th>
                  <th className="py-3 px-4">Asset · Network</th>
                  <th className="py-3 px-4">Address & Tx Hash</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4 text-right">Confirmations</th>
                  <th className="py-3 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-gray-800/60' : 'divide-slate-100'}`}>
                {filteredEvents.map((ev) => (
                  <tr key={ev.id} className={isDark ? 'hover:bg-gray-800/30' : 'hover:bg-slate-50'}>
                    <td className="py-3 px-4 font-mono tabular-nums text-xs whitespace-nowrap">
                      {new Date(ev.created_at).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-xs">
                      <div className="font-semibold">{ev.asset}</div>
                      <div className={`text-[11px] ${mutedText}`}>{ev.network}</div>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs">
                      <div className="truncate max-w-[220px]">{ev.address}</div>
                      <div className={`text-[11px] truncate max-w-[220px] ${mutedText}`}>{ev.transaction_hash}</div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-xs font-semibold">
                      {ev.amount} {ev.asset}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-xs">
                      {ev.confirmations} / {ev.required_confirmations}
                    </td>
                    <td className="py-3 px-4 text-right text-xs font-semibold">
                      <span className={ev.status === 'credited' ? 'text-emerald-500' : 'text-amber-500'}>
                        {ev.status === 'credited' ? 'Credited' : 'Pending'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Raw Payload Inspector Modal */}
      {selectedLog && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setSelectedLog(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-3xl max-h-[88vh] rounded-2xl border flex flex-col overflow-hidden ${surfaceClass}`}
          >
            <div className={`px-5 py-4 border-b flex items-center justify-between gap-4 ${dividerClass}`}>
              <div className="min-w-0">
                <h2 className="text-sm font-bold truncate">
                  Raw Incoming Tatum Webhook · {selectedLog.httpStatus} ({outcomeMeta(selectedLog.outcome).label})
                </h2>
                <p className={`text-xs font-mono mt-0.5 ${mutedText}`}>
                  {new Date(selectedLog.receivedAt).toISOString()} · IP {selectedLog.sourceIp} · {selectedLog.durationMs}ms
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className={`p-1.5 rounded-lg border ${dividerClass} ${mutedText} hover:text-white`}
                aria-label="Close raw webhook viewer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
              <div className={`rounded-xl border p-3.5 space-y-2 ${isDark ? 'bg-[#12151D] border-gray-800' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">Diagnostic Result</span>
                  <span className={`font-mono ${outcomeMeta(selectedLog.outcome).colorClass}`}>
                    {selectedLog.outcomeReason}
                  </span>
                </div>
                <div className={`grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t ${dividerClass} font-mono text-[11px]`}>
                  <div>Asset: {selectedLog.parsed.asset || '—'}</div>
                  <div>Chain: {selectedLog.parsed.chain || '—'}</div>
                  <div>Amount: {selectedLog.parsed.amount || '—'}</div>
                  <div className="col-span-2 sm:col-span-3 truncate">Address: {selectedLog.parsed.address || '—'}</div>
                  <div className="col-span-2 sm:col-span-3 truncate">TxHash: {selectedLog.parsed.txHash || '—'}</div>
                  <div>HMAC: {selectedLog.signatureValid ? 'Valid' : selectedLog.hasPayloadHash ? 'Mismatch' : 'Missing'}</div>
                  <div>On-chain: {selectedLog.verifiedOnChain ? 'Verified' : 'No'}</div>
                  <div>Confs: {selectedLog.parsed.confirmations ?? '—'}</div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold">Raw Incoming Tatum Payload</span>
                  <div className="flex items-center gap-2">
                    <div className={`flex items-center p-0.5 rounded-md border ${dividerClass}`}>
                      <button
                        type="button"
                        onClick={() => setRawViewMode('pretty')}
                        className={`px-2 py-1 rounded text-[11px] font-semibold ${
                          rawViewMode === 'pretty' ? 'bg-[#F0B90B] text-black' : mutedText
                        }`}
                      >
                        Formatted JSON
                      </button>
                      <button
                        type="button"
                        onClick={() => setRawViewMode('wire')}
                        className={`px-2 py-1 rounded text-[11px] font-semibold ${
                          rawViewMode === 'wire' ? 'bg-[#F0B90B] text-black' : mutedText
                        }`}
                      >
                        Raw Wire Body
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        copyText(
                          rawViewMode === 'pretty' && selectedLog.rawJson
                            ? JSON.stringify(selectedLog.rawJson, null, 2)
                            : selectedLog.rawBody,
                          'modal-payload',
                        )
                      }
                      className={`px-2.5 py-1 rounded-md border text-[11px] font-semibold inline-flex items-center gap-1 ${dividerClass}`}
                    >
                      {copiedId === 'modal-payload' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                      <span>Copy</span>
                    </button>
                  </div>
                </div>
                <pre
                  className={`rounded-xl border p-3.5 overflow-x-auto font-mono text-[11px] leading-relaxed max-h-64 ${
                    isDark ? 'bg-[#0B0E14] border-gray-800 text-cyan-200' : 'bg-slate-900 border-slate-800 text-cyan-100'
                  }`}
                >
                  {rawViewMode === 'pretty' && selectedLog.rawJson
                    ? JSON.stringify(selectedLog.rawJson, null, 2)
                    : selectedLog.rawBody || '(empty body)'}
                </pre>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="font-semibold mb-1.5">Request Headers</div>
                  <pre
                    className={`rounded-xl border p-3 overflow-x-auto font-mono text-[11px] leading-relaxed max-h-40 ${
                      isDark ? 'bg-[#0B0E14] border-gray-800 text-gray-300' : 'bg-slate-900 border-slate-800 text-slate-200'
                    }`}
                  >
                    {JSON.stringify(selectedLog.headers, null, 2)}
                  </pre>
                </div>
                <div>
                  <div className="font-semibold mb-1.5">Server Response Returned</div>
                  <pre
                    className={`rounded-xl border p-3 overflow-x-auto font-mono text-[11px] leading-relaxed max-h-40 ${
                      isDark ? 'bg-[#0B0E14] border-gray-800 text-emerald-200' : 'bg-slate-900 border-slate-800 text-emerald-100'
                    }`}
                  >
                    {JSON.stringify(selectedLog.responsePayload, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
