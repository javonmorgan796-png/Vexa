import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { useAdmin, AdminTab } from './AdminContext';
import {
  LayoutDashboard,
  Users,
  FileCheck2,
  ArrowLeftRight,
  ArrowDownLeft,
  ArrowUpRight,
  CreditCard,
  Headphones,
  ShieldAlert,
  UserCog,
  History,
  Settings,
  Sun,
  Moon,
  LogOut,
  ArrowLeft,
  Menu,
  X,
  Search,
  Bell,
  CheckCircle2,
  Lock,
  BriefcaseBusiness,
  Coins,
  Gift,
  Radio,
} from 'lucide-react';

import { OverviewTab } from './tabs/OverviewTab';
import { UserManagementTab } from './tabs/UserManagementTab';
import { BusinessDataTab } from './tabs/BusinessDataTab';
import { CryptoDataTab } from './tabs/CryptoDataTab';
import { RewardsDataTab } from './tabs/RewardsDataTab';
import { KycManagementTab } from './tabs/KycManagementTab';
import { TransactionManagementTab } from './tabs/TransactionManagementTab';
import { DepositsTab } from './tabs/DepositsTab';
import { WithdrawalsTab } from './tabs/WithdrawalsTab';
import { CardManagementTab } from './tabs/CardManagementTab';
import { CustomerSupportTab } from './tabs/CustomerSupportTab';
import { SecurityFraudTab } from './tabs/SecurityFraudTab';
import { AdminManagementTab } from './tabs/AdminManagementTab';
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
  const { adminUser, activeTab, setActiveTab, adminTheme, toggleAdminTheme, hasPermission } = useAdmin();
  const [, navigate] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [quickQuery, setQuickQuery] = useState('');

  const isDark = adminTheme === 'dark';

  const navItems: NavItem[] = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'users', label: 'User Management', icon: <Users className="w-4 h-4" />, permission: 'users.view' },
    { id: 'business', label: 'Business Data', icon: <BriefcaseBusiness className="w-4 h-4 text-emerald-400" />, permission: 'users.view' },
    { id: 'crypto', label: 'Crypto Exchange Data', icon: <Coins className="w-4 h-4 text-amber-400" />, permission: 'transactions.view' },
    { id: 'rewards', label: 'Referral & Cashback History', icon: <Gift className="w-4 h-4 text-purple-400" />, permission: 'transactions.view' },
    { id: 'kyc', label: 'KYC Management', icon: <FileCheck2 className="w-4 h-4" />, badge: 2, permission: 'kyc.view' },
    { id: 'transactions', label: 'Transactions', icon: <ArrowLeftRight className="w-4 h-4" />, permission: 'transactions.view' },
    { id: 'deposits', label: 'Deposits', icon: <ArrowDownLeft className="w-4 h-4" />, permission: 'deposits.view' },
    { id: 'withdrawals', label: 'Withdrawals', icon: <ArrowUpRight className="w-4 h-4" />, badge: 1, permission: 'withdrawals.view' },
    { id: 'cards', label: 'Card Management', icon: <CreditCard className="w-4 h-4" />, permission: 'cards.view' },
    { id: 'support', label: 'Customer Support', icon: <Headphones className="w-4 h-4" />, badge: 1, permission: 'support.view' },
    { id: 'security', label: 'Security & Fraud', icon: <ShieldAlert className="w-4 h-4 text-rose-400" />, badge: 1, permission: 'security.view' },
    { id: 'integrations', label: 'API Integrations Hub', icon: <Radio className="w-4 h-4 text-cyan-400" />, badge: 2, permission: 'settings.view' },
    { id: 'management', label: 'Admin Management', icon: <UserCog className="w-4 h-4" />, permission: 'admins.view' },
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
      case 'management':
        return <AdminManagementTab />;
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
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#F0B90B] to-[#FCD535] flex items-center justify-center text-black font-extrabold text-sm shadow-md">
              V
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
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                      isActive ? 'bg-black text-[#F0B90B]' : 'bg-[#F0B90B]/20 text-[#F0B90B]'
                    }`}
                  >
                    {item.badge}
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
          <div className="flex items-center space-x-3">
            {/* Live Status Pill */}
            <div className="hidden md:flex items-center space-x-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[11px] font-mono font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>TPS: 184 · Core Synced</span>
            </div>

            {/* Role Badge */}
            <div className="px-2.5 py-1 rounded-lg bg-[#F0B90B]/10 border border-[#F0B90B]/30 text-[#F0B90B] font-bold text-[10px] tracking-wider uppercase font-mono">
              {adminUser?.role?.replace('_', ' ')}
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
