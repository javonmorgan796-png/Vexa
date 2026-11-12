import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { useAdmin, AdminTab } from './AdminContext';
import {
  LayoutDashboard,
  FileCheck2,
  ArrowLeftRight,
  ArrowDownLeft,
  ArrowUpRight,
  CreditCard,
  Headphones,
  ShieldAlert,
  History,
  Settings,
  Sun,
  Moon,
  ArrowLeft,
  Menu,
  X,
  Bell,
  CheckCircle2,
  Lock,
  BriefcaseBusiness,
  Coins,
  Gift,
  Percent,
  Radio,
  RotateCw,
  Users,
  Webhook,
} from 'lucide-react';

import { OverviewTab } from './tabs/OverviewTab';
import { UserManagementTab } from './tabs/UserManagementTab';
import { BusinessDataTab } from './tabs/BusinessDataTab';
import { CryptoDataTab } from './tabs/CryptoDataTab';
import { CryptoLogsTab } from './tabs/CryptoLogsTab';
import { ReferralsTab } from './tabs/ReferralsTab';
import { CashbackTab } from './tabs/CashbackTab';
import { RewardsDataTab } from './tabs/RewardsDataTab';
import { KycManagementTab } from './tabs/KycManagementTab';
import { TransactionManagementTab } from './tabs/TransactionManagementTab';
import { DepositsTab } from './tabs/DepositsTab';
import { WithdrawalsTab } from './tabs/WithdrawalsTab';
import { CardManagementTab } from './tabs/CardManagementTab';
import { CustomerSupportTab } from './tabs/CustomerSupportTab';
import { SecurityFraudTab } from './tabs/SecurityFraudTab';
import { ApiIntegrationsTab } from './tabs/ApiIntegrationsTab';
import { AuditLogsTab } from './tabs/AuditLogsTab';
import { SystemSettingsTab } from './tabs/SystemSettingsTab';

interface NavItem {
  id: AdminTab;
  label: string;
  icon: React.ReactNode;
  badge?: number;
  permission?: string;
}

export const AdminLayout: React.FC = () => {
  const {
    adminUser,
    activeTab,
    setActiveTab,
    adminTheme,
    toggleAdminTheme,
    hasPermission,
    lockAdminSession,
    badgeCounts,
    adminNotifications,
    refreshBadgeCounts,
  } = useAdmin();
  const [, navigate] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const notifDropdownRef = React.useRef<HTMLDivElement>(null);

  // Close notifications dropdown on outside click
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifDropdownRef.current && !notifDropdownRef.current.contains(e.target as Node)) {
        setNotificationsOpen(false);
      }
    };
    if (notificationsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [notificationsOpen]);

  const isDark = adminTheme === 'dark';

  const navItems: NavItem[] = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'users', label: 'User Management', icon: <Users className="w-4 h-4" />, permission: 'users.view' },
    { id: 'business', label: 'Business Data', icon: <BriefcaseBusiness className="w-4 h-4 text-emerald-400" />, permission: 'users.view' },
    { id: 'crypto', label: 'Crypto Exchange Data', icon: <Coins className="w-4 h-4 text-amber-400" />, permission: 'transactions.view' },
    { id: 'crypto-logs', label: 'Crypto Logs', icon: <Webhook className="w-4 h-4 text-cyan-400" />, permission: 'transactions.view' },
    { id: 'referrals', label: 'Referral Program', icon: <Gift className="w-4 h-4 text-purple-400" />, permission: 'transactions.view' },
    { id: 'cashback', label: 'Cashback History', icon: <Percent className="w-4 h-4 text-emerald-400" />, permission: 'transactions.view' },
    { id: 'kyc', label: 'KYC Management', icon: <FileCheck2 className="w-4 h-4" />, badge: badgeCounts.kyc, permission: 'kyc.view' },
    { id: 'transactions', label: 'Transactions', icon: <ArrowLeftRight className="w-4 h-4" />, permission: 'transactions.view' },
    { id: 'deposits', label: 'Deposits', icon: <ArrowDownLeft className="w-4 h-4" />, badge: badgeCounts.deposits, permission: 'deposits.view' },
    { id: 'withdrawals', label: 'Withdrawals', icon: <ArrowUpRight className="w-4 h-4" />, badge: badgeCounts.withdrawals, permission: 'withdrawals.view' },
    { id: 'cards', label: 'Card Management', icon: <CreditCard className="w-4 h-4" />, permission: 'cards.view' },
    { id: 'support', label: 'Customer Support', icon: <Headphones className="w-4 h-4" />, badge: badgeCounts.support, permission: 'support.view' },
    { id: 'security', label: 'Security & Fraud', icon: <ShieldAlert className="w-4 h-4 text-rose-400" />, badge: badgeCounts.security, permission: 'security.view' },
    { id: 'integrations', label: 'API Integrations Hub', icon: <Radio className="w-4 h-4 text-cyan-400" />, permission: 'settings.view' },
    { id: 'audit-logs', label: 'Audit Logs', icon: <History className="w-4 h-4" />, permission: 'audit.view' },
    { id: 'system-settings', label: 'System Settings', icon: <Settings className="w-4 h-4" />, permission: 'settings.view' },
  ];

  const filteredNavItems = navItems.filter((item) => !item.permission || hasPermission(item.permission));

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'overview':
        return <OverviewTab />;
      case 'users':
        return <UserManagementTab />;
      case 'business':
        return <BusinessDataTab />;
      case 'crypto':
        return <CryptoDataTab />;
      case 'crypto-logs':
        return <CryptoLogsTab />;
      case 'referrals':
        return <ReferralsTab />;
      case 'cashback':
        return <CashbackTab />;
      case 'rewards':
        return <RewardsDataTab />;
      case 'kyc':
        return <KycManagementTab />;
      case 'transactions':
        return <TransactionManagementTab />;
      case 'deposits':
        return <DepositsTab />;
      case 'withdrawals':
        return <WithdrawalsTab />;
      case 'cards':
        return <CardManagementTab />;
      case 'support':
        return <CustomerSupportTab />;
      case 'security':
        return <SecurityFraudTab />;
      case 'integrations':
        return <ApiIntegrationsTab />;
      case 'audit-logs':
        return <AuditLogsTab />;
      case 'system-settings':
        return <SystemSettingsTab />;
      default:
        return <OverviewTab />;
    }
  };

  const handleSelectTab = (tab: AdminTab) => {
    setActiveTab(tab);
    setSidebarOpen(false);
    navigate(tab === 'overview' ? '/admin' : `/admin/${tab}`);
  };

  return (
    <div className={`h-screen w-full overflow-hidden flex ${isDark ? 'bg-[#0B0E14] text-gray-200' : 'bg-slate-50 text-slate-800'}`}>
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-50 h-screen w-64 border-r flex flex-col transition-transform duration-200 ${
          isDark ? 'bg-[#12151D] border-gray-800' : 'bg-white border-slate-200 shadow-sm'
        } ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Brand Header */}
        <div className={`h-16 px-5 border-b flex items-center justify-between ${isDark ? 'border-gray-800/60' : 'border-slate-200'}`}>
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#181A20] border border-[#F0B90B]/30 flex items-center justify-center p-1 shadow-md shrink-0">
              <img src="/assets/aistudio/fe78fa28-9eb7-49b5-a568-6e1afbae67cb_ac4d9ede.png" alt="Vexa" className="w-full h-full object-contain" />
            </div>
            <div>
              <div className={`font-bold text-sm tracking-tight flex items-center space-x-1.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                <span>VEXA</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#F0B90B] text-black font-extrabold uppercase">
                  Institutional
                </span>
              </div>
              <div className={`text-[10px] font-mono ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>Terminal v2.4.0</div>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className={`lg:hidden p-1.5 rounded-lg ${isDark ? 'text-gray-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Section */}
        <div className="flex-1 py-4 px-3 overflow-y-auto space-y-1">
          <div className={`px-3 pb-2 text-[10px] font-extrabold uppercase tracking-wider font-mono ${isDark ? 'text-gray-500' : 'text-slate-400'}`}>
            Administration Modules
          </div>
          {filteredNavItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleSelectTab(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-[#F0B90B] text-black shadow-sm font-bold'
                    : isDark
                    ? 'text-gray-300 hover:bg-gray-800/60 hover:text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <span className={isActive ? 'text-black' : isDark ? 'text-gray-400' : 'text-slate-400'}>{item.icon}</span>
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && item.badge > 0 && (
                  <span
                    className={`px-2 py-0.5 min-w-[20px] text-center rounded-full text-[10px] font-mono font-bold transition-all ${
                      isActive
                        ? 'bg-black text-[#F0B90B]'
                        : 'bg-rose-500/15 text-rose-500 border border-rose-500/25'
                    }`}
                  >
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* User Card & Exit Button */}
        <div className={`p-4 border-t ${isDark ? 'border-gray-800/80 bg-gray-900/30' : 'border-slate-200 bg-slate-50/80'}`}>
          <div className="flex items-center space-x-2.5 mb-3">
            <div className="w-8 h-8 rounded-full bg-[#F0B90B]/10 border border-[#F0B90B]/30 flex items-center justify-center text-[#F0B90B] font-bold text-xs uppercase">
              {adminUser?.name?.slice(0, 2) || 'AD'}
            </div>
            <div className="flex-1 min-w-0">
              <div className={`text-xs font-bold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>{adminUser?.name}</div>
              <div className={`text-[10px] font-mono ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>{adminUser?.phone}</div>
            </div>
          </div>

          <button
            onClick={() => navigate('/settings')}
            className={`w-full py-2 px-3 rounded-xl text-xs font-semibold border flex items-center justify-center space-x-1.5 transition-colors ${
              isDark
                ? 'border-gray-700 bg-gray-800/50 hover:bg-gray-800 text-gray-300'
                : 'border-slate-300 bg-white hover:bg-slate-100 text-slate-700 shadow-xs'
            }`}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to User App</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Top Navigation Bar */}
        <header
          className={`h-16 shrink-0 px-4 sm:px-6 border-b flex items-center justify-between sticky top-0 z-30 backdrop-blur-md ${
            isDark ? 'bg-[#0B0E14]/80 border-gray-800' : 'bg-white/90 border-slate-200 shadow-xs'
          }`}
        >
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className={`lg:hidden p-2 rounded-xl ${isDark ? 'text-gray-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className={`hidden sm:flex items-center space-x-2 text-xs font-mono ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
              <span>Terminal</span>
              <span>/</span>
              <span className={`font-semibold capitalize font-sans ${isDark ? 'text-white' : 'text-slate-900'}`}>{activeTab.replace('-', ' ')}</span>
            </div>
          </div>

          {/* Right Header Badges & Actions */}
          <div className="flex items-center space-x-2.5">
            {/* 2FA Security Pill */}
            <div className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-mono font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>2FA Verified</span>
            </div>

            {/* Role Badge */}
            <div className="px-2.5 py-1 rounded-lg bg-[#F0B90B]/10 border border-[#F0B90B]/30 text-[#F0B90B] font-bold text-[10px] tracking-wider uppercase font-mono">
              {adminUser?.role?.replace('_', ' ')}
            </div>

            {/* Real-Time Live Notification Bell & Dropdown */}
            <div className="relative" ref={notifDropdownRef}>
              <button
                onClick={() => setNotificationsOpen((prev) => !prev)}
                className={`relative p-2 rounded-xl border transition-colors ${
                  notificationsOpen
                    ? 'bg-[#F0B90B] text-black border-[#F0B90B] shadow-xs'
                    : isDark
                    ? 'bg-gray-800/60 border-gray-700 text-gray-300 hover:text-white'
                    : 'bg-slate-100 border-slate-300 text-slate-700 hover:text-black shadow-xs'
                }`}
                title="Real-Time Admin Alerts"
                aria-label={`Real-Time Alerts (${badgeCounts.total} pending)`}
              >
                <Bell className="w-4 h-4" />
                {badgeCounts.total > 0 && (
                  <span className={`absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold font-mono rounded-full flex items-center justify-center border-2 ${isDark ? 'border-[#0B0E14]' : 'border-white'} shadow-xs animate-in zoom-in-75`}>
                    {badgeCounts.total > 99 ? '99+' : badgeCounts.total}
                  </span>
                )}
              </button>

              {/* Real-Time Dropdown Panel */}
              {notificationsOpen && (
                <div
                  className={`absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 ${
                    isDark ? 'bg-[#161A23] border-gray-800 text-white' : 'bg-white border-slate-200 text-slate-900 shadow-xl'
                  }`}
                >
                  <div className={`p-3.5 border-b flex items-center justify-between ${isDark ? 'border-gray-800/80 bg-gray-900/40' : 'border-slate-200 bg-slate-50'}`}>
                    <div className="flex items-center space-x-2">
                      <div className="p-1.5 rounded-lg bg-[#F0B90B]/10 text-[#F0B90B]">
                        <Bell className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wider font-mono">Live Action Queue</div>
                        <div className="text-[10px] text-slate-400 dark:text-gray-400">Real-time terminal alerts</div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-red-500/10 text-red-500 dark:text-red-400 border border-red-500/20">
                        {badgeCounts.total} pending
                      </span>
                      <button
                        onClick={() => refreshBadgeCounts()}
                        className={`p-1.5 rounded-lg transition-colors ${isDark ? 'text-gray-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
                        title="Refresh live queues now"
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Summary Metric Counters */}
                  <div className={`grid grid-cols-4 gap-1 p-2 border-b text-[10px] font-mono ${isDark ? 'border-gray-800/60 bg-gray-900/20' : 'border-slate-100 bg-slate-50/60'}`}>
                    <button
                      onClick={() => { handleSelectTab('kyc'); setNotificationsOpen(false); }}
                      className={`p-1.5 rounded-lg text-center transition-colors ${badgeCounts.kyc > 0 ? (isDark ? 'bg-amber-500/10 text-amber-400 font-bold border border-amber-500/20' : 'bg-amber-50 text-amber-700 font-bold border border-amber-200') : 'text-gray-400 opacity-60'}`}
                    >
                      <div>KYC</div>
                      <div className="text-xs font-bold font-mono">{badgeCounts.kyc}</div>
                    </button>
                    <button
                      onClick={() => { handleSelectTab('withdrawals'); setNotificationsOpen(false); }}
                      className={`p-1.5 rounded-lg text-center transition-colors ${badgeCounts.withdrawals > 0 ? (isDark ? 'bg-rose-500/10 text-rose-400 font-bold border border-rose-500/20' : 'bg-rose-50 text-rose-700 font-bold border border-rose-200') : 'text-gray-400 opacity-60'}`}
                    >
                      <div>Payouts</div>
                      <div className="text-xs font-bold font-mono">{badgeCounts.withdrawals}</div>
                    </button>
                    <button
                      onClick={() => { handleSelectTab('support'); setNotificationsOpen(false); }}
                      className={`p-1.5 rounded-lg text-center transition-colors ${badgeCounts.support > 0 ? (isDark ? 'bg-blue-500/10 text-blue-400 font-bold border border-blue-500/20' : 'bg-blue-50 text-blue-700 font-bold border border-blue-200') : 'text-gray-400 opacity-60'}`}
                    >
                      <div>Support</div>
                      <div className="text-xs font-bold font-mono">{badgeCounts.support}</div>
                    </button>
                    <button
                      onClick={() => { handleSelectTab('security'); setNotificationsOpen(false); }}
                      className={`p-1.5 rounded-lg text-center transition-colors ${badgeCounts.security > 0 ? (isDark ? 'bg-purple-500/10 text-purple-400 font-bold border border-purple-500/20' : 'bg-purple-50 text-purple-700 font-bold border border-purple-200') : 'text-gray-400 opacity-60'}`}
                    >
                      <div>Threats</div>
                      <div className="text-xs font-bold font-mono">{badgeCounts.security}</div>
                    </button>
                  </div>

                  {/* Alerts Feed List */}
                  <div className={`max-h-72 overflow-y-auto divide-y ${isDark ? 'divide-gray-800/40' : 'divide-slate-100'}`}>
                    {adminNotifications.length === 0 ? (
                      <div className="py-8 px-4 text-center">
                        <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500 opacity-80" />
                        <p className={`text-xs font-semibold ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>All Queues Clear</p>
                        <p className="text-[11px] text-gray-500 mt-0.5">Real-time alerts will stream here as customers submit requests.</p>
                      </div>
                    ) : (
                      adminNotifications.map((notif) => (
                        <div
                          key={notif.id}
                          onClick={() => {
                            handleSelectTab(notif.targetTab);
                            setNotificationsOpen(false);
                          }}
                          className={`p-3 flex items-start space-x-3 cursor-pointer transition-colors ${
                            isDark ? 'hover:bg-gray-800/40' : 'hover:bg-slate-50'
                          }`}
                        >
                          <span
                            className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                              notif.severity === 'critical' ? 'bg-rose-500' : notif.severity === 'warning' ? 'bg-amber-500' : 'bg-blue-500'
                            }`}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold truncate">{notif.title}</span>
                              <span className="text-[10px] text-gray-400 font-mono shrink-0 ml-2">
                                {new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className={`text-[11px] mt-0.5 line-clamp-1 ${isDark ? 'text-gray-300' : 'text-slate-600'}`}>{notif.description}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Theme Toggle */}
            <button
              onClick={toggleAdminTheme}
              className={`p-2 rounded-xl border transition-colors ${
                isDark
                  ? 'bg-gray-800/60 border-gray-700 text-gray-300 hover:text-white'
                  : 'bg-slate-100 border-slate-300 text-slate-700 hover:text-black shadow-xs'
              }`}
              title="Toggle Theme"
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
            </button>

            {/* Lock Console Button */}
            <button
              onClick={lockAdminSession}
              className={`py-1.5 px-2.5 rounded-xl border text-xs font-semibold flex items-center space-x-1.5 transition-colors ${
                isDark
                  ? 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20'
                  : 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100'
              }`}
              title="Lock Admin Terminal Immediately"
            >
              <Lock className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Lock Console</span>
            </button>
          </div>
        </header>

        {/* Tab Content Canvas with smooth scrolling */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto animate-fade-in" style={{ scrollbarGutter: 'stable', WebkitOverflowScrolling: 'touch' }}>
          {renderActiveTab()}
        </main>
      </div>
    </div>
  );
};
