import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { useBusiness } from '@/context/BusinessContext';

function fmt(n: number) { return '₦' + n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

const QUICK_ACTIONS = [
  { label: 'Transfer', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>, route: '/business/transfers' },
  { label: 'Receive', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>, route: '/business/receive' },
  { label: 'Payroll', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>, route: '/business/payroll' },
  { label: 'Bills', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="12" y2="17"/></svg>, route: '/business/bills' },
];

const FEATURE_CARDS = [
  { label: 'Employees', sub: 'Manage your team', icon: '👥', route: '/business/employees', color: '#EFF6FF', accent: '#2563EB' },
  { label: 'Payroll', sub: 'Salary & scheduling', icon: '💰', route: '/business/payroll', color: '#F0FDF4', accent: '#16A34A' },
  { label: 'Analytics', sub: 'Insights & reports', icon: '📊', route: '/business/analytics', color: '#FFF7ED', accent: '#EA580C' },
  { label: 'Settings', sub: 'Roles & security', icon: '⚙️', route: '/business/settings', color: '#F5F3FF', accent: '#7C3AED' },
];

export default function BusinessDashboard() {
  const [, navigate] = useLocation();
  const { business, transactions, employees } = useBusiness();
  const [balanceHidden, setBalanceHidden] = useState(false);

  if (!business) { navigate('/business/onboarding'); return null; }

  const activeCount = employees.filter(e => e.active).length;
  const recentTx = transactions.slice(0, 5);
  const monthlyIncome = transactions.filter(t => t.type === 'credit').reduce((s, t) => s + t.amount, 0);
  const monthlyExpense = transactions.filter(t => t.type === 'debit').reduce((s, t) => s + t.amount, 0);

  return (
    <div className="fixed inset-0 bg-[#F2F3F5] flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div className="flex-none bg-[#162353]" style={{ paddingTop: 'max(env(safe-area-inset-top), 16px)' }}>
        <div className="flex items-center justify-between px-5 pb-4">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/')} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
            </button>
            <div>
              <p className="text-white/60 text-[11px] font-medium">Vexa Business</p>
              <p className="text-white text-[14px] font-bold leading-tight">{business.businessName}</p>
            </div>
          </div>
          <button onClick={() => navigate('/business/notifications')} className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 relative">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-[#162353]" />
          </button>
        </div>

        {/* Balance Card */}
        <div className="mx-5 mb-5 bg-white/10 border border-white/20 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-1">
            <p className="text-white/60 text-[11px] font-medium">Business Balance</p>
            <button onClick={() => setBalanceHidden(h => !h)} className="text-white/60">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {balanceHidden ? <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></> : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>}
              </svg>
            </button>
          </div>
          <p className="text-white text-[28px] font-extrabold tracking-tight">
            {balanceHidden ? '₦ ••••••' : fmt(business.balance)}
          </p>
          <p className="text-white/50 text-[11px] mt-1">Acc: {business.accountNumber} · Vexa Business Bank</p>

          <div className="flex gap-4 mt-4 pt-4 border-t border-white/10">
            <div>
              <p className="text-white/50 text-[10px]">Total Income</p>
              <p className="text-[#4ADE80] text-[13px] font-bold">+{fmt(monthlyIncome)}</p>
            </div>
            <div className="w-px bg-white/10" />
            <div>
              <p className="text-white/50 text-[10px]">Total Expenses</p>
              <p className="text-[#F87171] text-[13px] font-bold">-{fmt(monthlyExpense)}</p>
            </div>
            <div className="w-px bg-white/10" />
            <div>
              <p className="text-white/50 text-[10px]">Employees</p>
              <p className="text-white text-[13px] font-bold">{activeCount} active</p>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex justify-around pb-5 px-5">
          {QUICK_ACTIONS.map(a => (
            <button key={a.label} onClick={() => navigate(a.route)}
              className="flex flex-col items-center gap-1.5">
              <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-white">
                {a.icon}
              </div>
              <span className="text-white/70 text-[11px] font-medium">{a.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4" style={{ scrollbarWidth: 'none' }}>

        {/* Feature Cards */}
        <div className="grid grid-cols-2 gap-3">
          {FEATURE_CARDS.map(fc => (
            <button key={fc.label} onClick={() => navigate(fc.route)}
              className="bg-white rounded-2xl p-4 border border-[#F0F0F0] text-left hover:shadow-sm transition-shadow active:scale-[0.97]">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-[22px] mb-3" style={{ backgroundColor: fc.color }}>
                {fc.icon}
              </div>
              <p className="text-[13px] font-bold text-[#111]">{fc.label}</p>
              <p className="text-[11px] text-[#888] mt-0.5">{fc.sub}</p>
            </button>
          ))}
        </div>

        {/* Recent Transactions */}
        <div className="bg-white rounded-2xl border border-[#F0F0F0] overflow-hidden">
          <div className="flex justify-between items-center px-4 py-3.5 border-b border-[#F5F5F5]">
            <p className="text-[13px] font-bold text-[#111]">Recent Transactions</p>
            <button onClick={() => navigate('/business/transactions')} className="text-[11px] text-[#2563EB] font-semibold">View All</button>
          </div>
          {recentTx.length === 0 ? (
            <div className="py-10 text-center text-[#888] text-[13px]">No transactions yet</div>
          ) : (
            recentTx.map(tx => (
              <div key={tx.id} className="flex items-center gap-3 px-4 py-3.5 border-b border-[#F9F9F9] last:border-0">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${tx.type === 'credit' ? 'bg-[#DCFCE7]' : 'bg-[#FEE2E2]'}`}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={tx.type === 'credit' ? '#16A34A' : '#DC2626'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    {tx.type === 'credit' ? <><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></> : <><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></>}
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold text-[#111] truncate">{tx.description}</p>
                  <p className="text-[10px] text-[#888]">{new Date(tx.date).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                </div>
                <span className={`text-[12px] font-bold shrink-0 ${tx.type === 'credit' ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>
                  {tx.type === 'credit' ? '+' : '-'}{fmt(tx.amount)}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Business Info Footer */}
        <div className="bg-white rounded-2xl border border-[#F0F0F0] px-4 py-4">
          <p className="text-[11px] font-bold text-[#888] uppercase tracking-wide mb-3">Business Info</p>
          <div className="space-y-2.5">
            <div className="flex justify-between">
              <span className="text-[12px] text-[#888]">Industry</span>
              <span className="text-[12px] font-semibold text-[#111]">{business.industry}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[12px] text-[#888]">Business Type</span>
              <span className="text-[12px] font-semibold text-[#111] capitalize">{business.businessType.replace('_', ' ')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[12px] text-[#888]">Owner</span>
              <span className="text-[12px] font-semibold text-[#111]">{business.ownerName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[12px] text-[#888]">Member Since</span>
              <span className="text-[12px] font-semibold text-[#111]">{new Date(business.createdAt).toLocaleDateString('en-NG', { month: 'long', year: 'numeric' })}</span>
            </div>
          </div>
        </div>

        <div className="pb-4" />
      </div>
    </div>
  );
}
