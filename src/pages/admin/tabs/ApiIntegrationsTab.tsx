import React, { useState, useEffect } from 'react';
import { useAdmin } from '../AdminContext';
import {
  Radio,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Search,
  ExternalLink,
  Shield,
  Zap,
  Server,
  Key,
  Globe,
  Database,
  Smartphone,
  Coins,
  Bot,
  CreditCard,
  Building2,
  Lock,
  Copy,
  Check,
  Activity,
  Sliders,
} from 'lucide-react';

interface IntegrationApi {
  id: string;
  name: string;
  provider: string;
  category: string;
  status: 'connected' | 'disconnected' | 'degraded';
  statusLabel: string;
  description: string;
  endpoint: string;
  credentialStatus: string;
  envVar: string;
  latencyMs: number;
  lastChecked: string;
  docsUrl: string;
  version: string;
  features: string[];
}

export const ApiIntegrationsTab: React.FC = () => {
  const { fetchAdminApi, adminTheme, setActiveTab } = useAdmin();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, { success: boolean; latencyMs: number; message: string }>>({});
  const [filterStatus, setFilterStatus] = useState<'all' | 'connected' | 'disconnected' | 'degraded'>('all');
  const [search, setSearch] = useState('');
  const [copiedEndpoint, setCopiedEndpoint] = useState<string | null>(null);
  const [selectedApi, setSelectedApi] = useState<IntegrationApi | null>(null);

  const isDark = adminTheme === 'dark';

  const loadIntegrations = async () => {
    try {
      setLoading(true);
      const res = await fetchAdminApi('/api/admin/integrations');
      setData(res);
    } catch (err) {
      console.error('Failed to load integrations status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIntegrations();
  }, []);

  const handleTestConnection = async (api: IntegrationApi) => {
    try {
      setTestingId(api.id);
      const res = await fetchAdminApi(`/api/admin/integrations/${api.id}/test`, {
        method: 'POST',
      });
      setTestResult((prev) => ({
        ...prev,
        [api.id]: {
          success: res.success,
          latencyMs: res.latencyMs,
          message: res.message,
        },
      }));
      // Refresh list to update latencies
      loadIntegrations();
    } catch (err: any) {
      setTestResult((prev) => ({
        ...prev,
        [api.id]: {
          success: false,
          latencyMs: 0,
          message: err.message || 'Connection failed',
        },
      }));
    } finally {
      setTestingId(null);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedEndpoint(id);
    setTimeout(() => setCopiedEndpoint(null), 2000);
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Payments & Banking':
        return <Building2 className="w-4 h-4 text-emerald-500" />;
      case 'Database & Identity':
        return <Database className="w-4 h-4 text-blue-500" />;
      case 'Telecom & 2FA SMS':
        return <Smartphone className="w-4 h-4 text-amber-500" />;
      case 'Crypto & Blockchain':
        return <Coins className="w-4 h-4 text-purple-500" />;
      case 'Market Data Oracle':
        return <Activity className="w-4 h-4 text-cyan-500" />;
      case 'AI & Smart Automation':
        return <Bot className="w-4 h-4 text-rose-500" />;
      case 'Card Issuance & Payments':
        return <CreditCard className="w-4 h-4 text-indigo-500" />;
      case 'Regulatory & Compliance':
        return <Shield className="w-4 h-4 text-emerald-600" />;
      default:
        return <Server className="w-4 h-4 text-gray-400" />;
    }
  };

  const metrics = data?.metrics || {
    totalApis: 9,
    connectedCount: 6,
    disconnectedCount: 2,
    degradedCount: 1,
    avgLatencyMs: 64,
    systemHealthPct: 78,
  };

  const integrations: IntegrationApi[] = (data?.integrations || []).filter((item: IntegrationApi) => {
    const matchesFilter = filterStatus === 'all' || item.status === filterStatus;
    const matchesSearch =
      !search ||
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.provider.toLowerCase().includes(search.toLowerCase()) ||
      item.category.toLowerCase().includes(search.toLowerCase()) ||
      item.envVar.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div
        className={`p-6 rounded-2xl border transition-all ${
          isDark
            ? 'bg-gradient-to-r from-[#161A23] to-[#12151D] border-gray-800'
            : 'bg-white border-slate-200 shadow-sm'
        } flex flex-col lg:flex-row lg:items-center justify-between gap-4`}
      >
        <div>
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-semibold tracking-wider uppercase text-emerald-500 font-mono">
              Live Gateway Health & Handshake Monitor
            </span>
          </div>
          <h1 className={`text-2xl font-bold tracking-tight mt-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Connected APIs & Integration Status
          </h1>
          <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
            Real-time audit of active and disconnected financial gateways, telecom OTP rails, crypto nodes, database clusters, and oracles.
          </p>
        </div>

        <div className="flex items-center space-x-3 self-start lg:self-auto">
          <button
            onClick={() => setActiveTab('system-settings')}
            className="px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center space-x-2 bg-[#F0B90B] hover:bg-[#d9a606] text-black transition-colors shadow-sm whitespace-nowrap shrink-0"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Configure Webhook URL</span>
          </button>
          <button
            onClick={loadIntegrations}
            disabled={loading}
            className={`px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center space-x-2 border transition-colors whitespace-nowrap shrink-0 ${
              isDark
                ? 'bg-gray-800/60 hover:bg-gray-800 text-gray-200 border-gray-700'
                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300 shadow-sm'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Ping All Gateways</span>
          </button>
        </div>
      </div>

      {/* Overview Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Connected */}
        <div
          className={`p-5 rounded-2xl border transition-all ${
            isDark ? 'bg-[#161A23] border-gray-800' : 'bg-white border-slate-200 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
              Connected & Active APIs
            </span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className={`text-3xl font-extrabold mt-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {metrics.connectedCount}{' '}
            <span className={`text-sm font-normal ${isDark ? 'text-gray-500' : 'text-slate-400'}`}>
              / {metrics.totalApis}
            </span>
          </div>
          <div className="flex items-center text-xs text-emerald-500 mt-2 font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block mr-1.5 animate-pulse" />
            <span>Core Banking Infrastructure Live</span>
          </div>
        </div>

        {/* Disconnected APIs */}
        <div
          className={`p-5 rounded-2xl border transition-all ${
            isDark ? 'bg-[#161A23] border-gray-800' : 'bg-white border-slate-200 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
              Disconnected Gateways
            </span>
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-500">
              <XCircle className="w-5 h-5" />
            </div>
          </div>
          <div className={`text-3xl font-extrabold mt-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {metrics.disconnectedCount}
          </div>
          <div className="text-xs text-rose-500 mt-2 font-semibold">
            {metrics.disconnectedCount > 0 ? 'Requires API Key / Provider Link' : 'All Critical Services Connected'}
          </div>
        </div>

        {/* Degraded / Sandbox */}
        <div
          className={`p-5 rounded-2xl border transition-all ${
            isDark ? 'bg-[#161A23] border-gray-800' : 'bg-white border-slate-200 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
              Degraded / Mock Mode
            </span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className={`text-3xl font-extrabold mt-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {metrics.degradedCount}
          </div>
          <div className="text-xs text-amber-500 mt-2 font-semibold">
            <span>Fallback Emulators Operating</span>
          </div>
        </div>

        {/* Average Latency */}
        <div
          className={`p-5 rounded-2xl border transition-all ${
            isDark ? 'bg-[#161A23] border-gray-800' : 'bg-white border-slate-200 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
              Average Gateway Latency
            </span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
              <Zap className="w-5 h-5" />
            </div>
          </div>
          <div className={`text-3xl font-extrabold font-mono mt-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {metrics.avgLatencyMs} <span className="text-sm font-sans font-normal text-gray-400">ms</span>
          </div>
          <div className="flex items-center text-xs text-emerald-500 mt-2 font-semibold">
            <Activity className="w-3.5 h-3.5 mr-1" />
            <span>Health Score: {metrics.systemHealthPct}%</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Status Pill Tabs */}
        <div
          className={`flex items-center space-x-1 p-1 rounded-xl border ${
            isDark ? 'bg-gray-900/40 border-gray-800' : 'bg-slate-100 border-slate-200'
          }`}
        >
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filterStatus === 'all'
                ? 'bg-[#F0B90B] text-black shadow-sm font-bold'
                : isDark
                ? 'text-gray-400 hover:text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All APIs ({data?.integrations?.length || 9})
          </button>
          <button
            onClick={() => setFilterStatus('connected')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all ${
              filterStatus === 'connected'
                ? 'bg-emerald-500 text-white shadow-sm font-bold'
                : isDark
                ? 'text-gray-400 hover:text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Connected ({metrics.connectedCount})</span>
          </button>
          <button
            onClick={() => setFilterStatus('disconnected')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all ${
              filterStatus === 'disconnected'
                ? 'bg-rose-500 text-white shadow-sm font-bold'
                : isDark
                ? 'text-gray-400 hover:text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
            <span>Disconnected ({metrics.disconnectedCount})</span>
          </button>
          <button
            onClick={() => setFilterStatus('degraded')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all ${
              filterStatus === 'degraded'
                ? 'bg-amber-500 text-black shadow-sm font-bold'
                : isDark
                ? 'text-gray-400 hover:text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span>Degraded ({metrics.degradedCount})</span>
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search API name, key or provider..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`w-full sm:w-72 pl-9 pr-3 py-2 rounded-xl text-xs border outline-none transition-colors ${
              isDark
                ? 'bg-[#161A23] border-gray-800 text-white placeholder-gray-500 focus:border-[#F0B90B]'
                : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-[#F0B90B] shadow-sm'
            }`}
          />
        </div>
      </div>

      {/* API Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {integrations.map((api) => {
          const isConnected = api.status === 'connected';
          const isDisconnected = api.status === 'disconnected';
          const isDegraded = api.status === 'degraded';
          const isTesting = testingId === api.id;
          const pingResult = testResult[api.id];

          return (
            <div
              key={api.id}
              className={`p-5 rounded-2xl border flex flex-col justify-between transition-all ${
                isDark
                  ? 'bg-[#161A23] border-gray-800 hover:border-gray-700'
                  : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
              }`}
            >
              <div>
                {/* Header: Icon, Name, Status Badge */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center space-x-3">
                    <div
                      className={`p-2.5 rounded-xl border ${
                        isDark ? 'bg-gray-800/80 border-gray-700' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      {getCategoryIcon(api.category)}
                    </div>
                    <div>
                      <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {api.name}
                      </h3>
                      <div className={`text-[11px] ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                        {api.provider} · {api.category}
                      </div>
                    </div>
                  </div>

                  {/* Status Pill */}
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase font-mono shrink-0 ${
                      isConnected
                        ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/30'
                        : isDisconnected
                        ? 'bg-rose-500/10 text-rose-500 border border-rose-500/30'
                        : 'bg-amber-500/10 text-amber-500 border border-amber-500/30'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                        isConnected
                          ? 'bg-emerald-500 animate-pulse'
                          : isDisconnected
                          ? 'bg-rose-500'
                          : 'bg-amber-500 animate-pulse'
                      }`}
                    />
                    {api.status}
                  </span>
                </div>

                {/* Description */}
                <p className={`text-xs mb-4 leading-relaxed ${isDark ? 'text-gray-300' : 'text-slate-600'}`}>
                  {api.description}
                </p>

                {/* Diagnostic Details Box */}
                <div
                  className={`p-3 rounded-xl border text-xs space-y-2 mb-4 font-mono ${
                    isDark ? 'bg-gray-900/50 border-gray-800/80' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-[11px] ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                      Credential:
                    </span>
                    <span
                      className={`text-[11px] font-semibold ${
                        api.credentialStatus.includes('••••')
                          ? 'text-emerald-500'
                          : isConnected
                          ? isDark
                            ? 'text-white'
                            : 'text-slate-800'
                          : 'text-rose-500'
                      }`}
                    >
                      {api.credentialStatus}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className={`text-[11px] ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                      Environment Var:
                    </span>
                    <span className="text-[11px] text-[#F0B90B] font-bold">{api.envVar}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className={`text-[11px] ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                      Latency:
                    </span>
                    <span
                      className={`text-[11px] font-bold ${
                        api.latencyMs > 0 ? 'text-emerald-500' : 'text-rose-500'
                      }`}
                    >
                      {api.latencyMs > 0 ? `${api.latencyMs} ms` : 'Offline / Missing'}
                    </span>
                  </div>

                  {/* Endpoint with Copy */}
                  <div className="pt-1.5 border-t border-gray-700/20 flex items-center justify-between">
                    <span
                      className={`text-[10px] truncate max-w-[200px] ${
                        isDark ? 'text-gray-400' : 'text-slate-500'
                      }`}
                      title={api.endpoint}
                    >
                      {api.endpoint}
                    </span>
                    <button
                      onClick={() => handleCopy(api.endpoint, api.id)}
                      className={`p-1 rounded text-gray-400 hover:text-white transition-colors ${
                        copiedEndpoint === api.id ? 'text-emerald-500' : ''
                      }`}
                      title="Copy endpoint"
                    >
                      {copiedEndpoint === api.id ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>

                {/* Feature Tags */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {api.features.map((feat) => (
                    <span
                      key={feat}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                        isDark ? 'bg-gray-800/60 text-gray-300' : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {feat}
                    </span>
                  ))}
                </div>

                {/* Live Ping Output */}
                {pingResult && (
                  <div
                    className={`p-2.5 rounded-xl border text-[11px] font-mono mb-4 flex items-center space-x-2 ${
                      pingResult.success
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                    }`}
                  >
                    {pingResult.success ? (
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 shrink-0" />
                    )}
                    <span className="truncate">{pingResult.message}</span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-gray-700/20 flex items-center justify-between gap-2">
                <button
                  onClick={() => setSelectedApi(api)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                    isDark
                      ? 'border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  Diagnostics
                </button>

                <div className="flex items-center space-x-2">
                  <a
                    href={api.docsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={`p-1.5 rounded-xl text-gray-400 hover:text-white transition-colors ${
                      isDark ? 'hover:bg-gray-800' : 'hover:bg-slate-100'
                    }`}
                    title="API Docs"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>

                  <button
                    onClick={() => handleTestConnection(api)}
                    disabled={isTesting}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-all shadow-sm ${
                      isConnected
                        ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                        : isDegraded
                        ? 'bg-amber-500 hover:bg-amber-600 text-black'
                        : 'bg-gray-700 hover:bg-gray-600 text-white'
                    }`}
                  >
                    <RefreshCw className={`w-3 h-3 ${isTesting ? 'animate-spin' : ''}`} />
                    <span>{isTesting ? 'Pinging…' : 'Test Handshake'}</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Diagnostics Modal */}
      {selectedApi && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div
            className={`w-full max-w-lg rounded-2xl border p-6 shadow-2xl transition-all ${
              isDark ? 'bg-[#161A23] border-gray-800 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between pb-4 border-b border-gray-700/30">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-xl bg-[#F0B90B]/10 border border-[#F0B90B]/30 text-[#F0B90B]">
                  {getCategoryIcon(selectedApi.category)}
                </div>
                <div>
                  <h2 className="text-base font-bold">{selectedApi.name}</h2>
                  <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                    {selectedApi.provider} · {selectedApi.version}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedApi(null)}
                className={`p-1.5 rounded-xl transition-colors ${
                  isDark ? 'text-gray-400 hover:text-white hover:bg-gray-800' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                }`}
              >
                ✕
              </button>
            </div>

            <div className="py-4 space-y-4 text-xs">
              <div>
                <label className={`font-semibold uppercase tracking-wider text-[10px] ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                  Operational Status
                </label>
                <div className="mt-1 flex items-center space-x-2">
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-full font-bold uppercase text-[11px] ${
                      selectedApi.status === 'connected'
                        ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/30'
                        : selectedApi.status === 'disconnected'
                        ? 'bg-rose-500/10 text-rose-500 border border-rose-500/30'
                        : 'bg-amber-500/10 text-amber-500 border border-amber-500/30'
                    }`}
                  >
                    {selectedApi.statusLabel}
                  </span>
                  <span className={`text-[11px] ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                    Last checked: {new Date(selectedApi.lastChecked).toLocaleTimeString()}
                  </span>
                </div>
              </div>

              <div>
                <label className={`font-semibold uppercase tracking-wider text-[10px] ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                  Environment Secret Keys
                </label>
                <div className={`mt-1 p-3 rounded-xl border font-mono ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-gray-400">Environment Variable:</span>
                    <span className="text-[#F0B90B] font-bold">{selectedApi.envVar}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Detected State:</span>
                    <span className={selectedApi.credentialStatus.includes('••••') ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                      {selectedApi.credentialStatus}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className={`font-semibold uppercase tracking-wider text-[10px] ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                  Service Gateway Endpoint
                </label>
                <div className={`mt-1 p-3 rounded-xl border font-mono text-[11px] flex items-center justify-between ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-slate-50 border-slate-200'}`}>
                  <span className="truncate">{selectedApi.endpoint}</span>
                  <button
                    onClick={() => handleCopy(selectedApi.endpoint, 'modal')}
                    className="ml-2 text-gray-400 hover:text-white"
                  >
                    {copiedEndpoint === 'modal' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className={`font-semibold uppercase tracking-wider text-[10px] ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                  Integrated Features
                </label>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {selectedApi.features.map((f) => (
                    <span
                      key={f}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                        isDark ? 'bg-gray-800 text-gray-300' : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      ✓ {f}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-700/30 flex justify-end space-x-3">
              <button
                onClick={() => setSelectedApi(null)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold ${
                  isDark ? 'bg-gray-800 text-gray-300 hover:text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Close
              </button>
              <button
                onClick={() => {
                  handleTestConnection(selectedApi);
                }}
                disabled={testingId === selectedApi.id}
                className="px-4 py-2 bg-[#F0B90B] hover:bg-[#d9a606] text-black font-semibold rounded-xl text-xs flex items-center space-x-1.5 shadow-sm"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${testingId === selectedApi.id ? 'animate-spin' : ''}`} />
                <span>Test Connection</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
