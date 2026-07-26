import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { useBusiness } from '@/context/BusinessContext';

function fmt(n: number) { return '₦' + n.toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 }); }

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'];

// Simulated monthly data
const MONTHLY_INCOME  = [320000, 410000, 380000, 500000, 450000, 620000, 750000];
const MONTHLY_EXPENSE = [180000, 250000, 210000, 310000, 280000, 400000, 950000];

export default function BusinessAnalytics() {
  const [, navigate] = useLocation();
  const { transactions, employees, business } = useBusiness();
  const [tab, setTab] = useState<'overview' | 'payroll' | 'reports'>('overview');

  const totalIncome  = transactions.filter(t => t.type === 'credit').reduce((s, t) => s + t.amount, 0);
  const totalExpense = transactions.filter(t => t.type === 'debit').reduce((s, t) => s + t.amount, 0);
  const netProfit    = totalIncome - totalExpense;

  // Category breakdown
  const categories: Record<string, number> = {};
  transactions.filter(t => t.type === 'debit').forEach(t => { categories[t.category] = (categories[t.category] || 0) + t.amount; });
  const catEntries = Object.entries(categories).sort((a, b) => b[1] - a[1]);
  const maxCat = Math.max(...catEntries.map(e => e[1]), 1);

  const catColors: Record<string, string> = { payroll: '#162353', transfer: '#2563EB', bills: '#EA580C', income: '#16A34A', other: '#9CA3AF' };
  const catLabels: Record<string, string> = { payroll: 'Payroll', transfer: 'Transfers', bills: 'Bills', income: 'Income', other: 'Other' };

  // Bar chart dimensions
  const maxBar = Math.max(...MONTHLY_INCOME, ...MONTHLY_EXPENSE, 1);
  const barH   = 100;

  // Payroll breakdown
  const activeEmps  = employees.filter(e => e.active);
  const deptPayroll: Record<string, number> = {};
  activeEmps.forEach(e => { deptPayroll[e.department] = (deptPayroll[e.department] || 0) + e.salary; });
  const deptEntries = Object.entries(deptPayroll).sort((a, b) => b[1] - a[1]);
  const totalPayroll = activeEmps.reduce((s, e) => s + e.salary, 0);

  return (
    <div className="fixed inset-0 bg-[#F2F3F5] flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div className="flex-none bg-[#162353]" style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}>
        <div className="flex items-center gap-3 px-5 pb-4">
          <button onClick={() => navigate('/business')} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          </button>
          <div>
            <p className="text-white text-[16px] font-bold">Analytics & Reports</p>
            <p className="text-white/60 text-[11px]">{business?.businessName}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex px-5 gap-1 pb-4">
          {(['overview', 'payroll', 'reports'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-xl text-[12px] font-semibold transition-all ${tab === t ? 'bg-white text-[#162353]' : 'text-white/60'}`}>
              {t === 'overview' ? 'Overview' : t === 'payroll' ? 'Payroll' : 'Reports'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4" style={{ scrollbarWidth: 'none' }}>

        {/* OVERVIEW */}
        {tab === 'overview' && (
          <>
            {/* KPI row */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Total Income', value: fmt(totalIncome), color: '#16A34A', bg: '#DCFCE7' },
                { label: 'Total Expenses', value: fmt(totalExpense), color: '#DC2626', bg: '#FEE2E2' },
                { label: 'Net Profit', value: fmt(netProfit), color: netProfit >= 0 ? '#16A34A' : '#DC2626', bg: netProfit >= 0 ? '#DCFCE7' : '#FEE2E2' },
              ].map(k => (
                <div key={k.label} className="bg-white rounded-2xl border border-[#F0F0F0] p-3 text-center">
                  <p className="text-[9px] font-semibold text-[#888] uppercase tracking-wide mb-1">{k.label}</p>
                  <p className="text-[12px] font-extrabold" style={{ color: k.color }}>{k.value}</p>
                </div>
              ))}
            </div>

            {/* Bar chart */}
            <div className="bg-white rounded-2xl border border-[#F0F0F0] p-4">
              <p className="text-[13px] font-bold text-[#111] mb-1">Revenue vs Expenses</p>
              <p className="text-[10px] text-[#888] mb-4">Monthly breakdown (₦)</p>

              <div className="flex items-end justify-between gap-1" style={{ height: barH + 20 }}>
                {MONTH_LABELS.map((m, i) => {
                  const incH = (MONTHLY_INCOME[i] / maxBar) * barH;
                  const expH = (MONTHLY_EXPENSE[i] / maxBar) * barH;
                  return (
                    <div key={m} className="flex-1 flex flex-col items-center gap-0.5">
                      <div className="flex items-end gap-0.5 w-full justify-center" style={{ height: barH }}>
                        <div className="w-2.5 rounded-t-sm" style={{ height: incH, backgroundColor: '#162353', minHeight: 2 }} />
                        <div className="w-2.5 rounded-t-sm" style={{ height: expH, backgroundColor: '#EF4444', minHeight: 2 }} />
                      </div>
                      <span className="text-[9px] text-[#888]">{m}</span>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center gap-4 mt-3">
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-[#162353]" /><span className="text-[10px] text-[#888]">Income</span></div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-[#EF4444]" /><span className="text-[10px] text-[#888]">Expenses</span></div>
              </div>
            </div>

            {/* Category breakdown */}
            <div className="bg-white rounded-2xl border border-[#F0F0F0] p-4">
              <p className="text-[13px] font-bold text-[#111] mb-4">Expense Breakdown</p>
              {catEntries.length === 0 ? (
                <p className="text-[12px] text-[#888] text-center py-4">No expense data yet</p>
              ) : catEntries.map(([cat, amt]) => (
                <div key={cat} className="mb-3 last:mb-0">
                  <div className="flex justify-between mb-1">
                    <span className="text-[12px] font-semibold text-[#111]">{catLabels[cat] || cat}</span>
                    <span className="text-[12px] font-bold text-[#111]">{fmt(amt)}</span>
                  </div>
                  <div className="h-2 bg-[#F2F3F5] rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(amt / maxCat) * 100}%`, backgroundColor: catColors[cat] || '#888' }} />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* PAYROLL ANALYTICS */}
        {tab === 'payroll' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-2xl border border-[#F0F0F0] p-4 text-center">
                <p className="text-[9px] font-semibold text-[#888] uppercase tracking-wide mb-1">Active Employees</p>
                <p className="text-[28px] font-extrabold text-[#162353]">{activeEmps.length}</p>
              </div>
              <div className="bg-white rounded-2xl border border-[#F0F0F0] p-4 text-center">
                <p className="text-[9px] font-semibold text-[#888] uppercase tracking-wide mb-1">Monthly Payroll</p>
                <p className="text-[18px] font-extrabold text-[#111]">{fmt(totalPayroll)}</p>
              </div>
            </div>

            {/* Payroll by department */}
            <div className="bg-white rounded-2xl border border-[#F0F0F0] p-4">
              <p className="text-[13px] font-bold text-[#111] mb-4">Payroll by Department</p>
              {deptEntries.map(([dept, total], i) => {
                const colors = ['#162353', '#2563EB', '#7C3AED', '#EA580C', '#16A34A', '#0891B2'];
                const pct = totalPayroll > 0 ? (total / totalPayroll) * 100 : 0;
                return (
                  <div key={dept} className="mb-4 last:mb-0">
                    <div className="flex justify-between mb-1">
                      <span className="text-[12px] font-semibold text-[#111]">{dept}</span>
                      <div className="text-right">
                        <span className="text-[12px] font-bold text-[#111]">{fmt(total)}</span>
                        <span className="text-[10px] text-[#888] ml-1">({pct.toFixed(0)}%)</span>
                      </div>
                    </div>
                    <div className="h-2.5 bg-[#F2F3F5] rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: colors[i % colors.length] }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Top earners */}
            <div className="bg-white rounded-2xl border border-[#F0F0F0] overflow-hidden">
              <div className="px-4 py-3.5 border-b border-[#F5F5F5]">
                <p className="text-[13px] font-bold text-[#111]">Employee Salaries</p>
              </div>
              {activeEmps.sort((a, b) => b.salary - a.salary).map((e, i) => (
                <div key={e.id} className="flex items-center gap-3 px-4 py-3 border-b border-[#F9F9F9] last:border-0">
                  <span className="text-[11px] font-bold text-[#888] w-4">{i + 1}</span>
                  <div className="w-8 h-8 rounded-full bg-[#EFF6FF] flex items-center justify-center text-[11px] font-bold text-[#2563EB] shrink-0">
                    {e.name.split(' ').map(p => p[0]).slice(0, 2).join('')}
                  </div>
                  <div className="flex-1">
                    <p className="text-[12px] font-semibold text-[#111]">{e.name}</p>
                    <p className="text-[10px] text-[#888]">{e.department}</p>
                  </div>
                  <span className="text-[12px] font-bold text-[#111]">{fmt(e.salary)}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* REPORTS */}
        {tab === 'reports' && (
          <>
            <div className="bg-[#F0F4FF] border border-[#C7D7FF] rounded-xl px-4 py-3">
              <p className="text-[12px] font-semibold text-[#162353] mb-0.5">📊 Business Reports</p>
              <p className="text-[11px] text-[#555]">Download and share financial reports for your business</p>
            </div>

            {[
              { title: 'Monthly P&L Statement', desc: 'July 2026', icon: '📈', tag: 'Ready' },
              { title: 'Payroll Report', desc: 'July 2026 · ' + activeEmps.length + ' employees', icon: '💰', tag: 'Ready' },
              { title: 'Transaction History', desc: `${transactions.length} transactions`, icon: '📋', tag: 'Ready' },
              { title: 'Employee Summary', desc: `${employees.length} total employees`, icon: '👥', tag: 'Ready' },
              { title: 'Expense Analysis', desc: 'Breakdown by category', icon: '📊', tag: 'Ready' },
              { title: 'Annual Report', desc: '2025–2026', icon: '🗂️', tag: 'Generating…' },
            ].map(r => (
              <div key={r.title} className="bg-white rounded-2xl border border-[#F0F0F0] px-4 py-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#F2F3F5] flex items-center justify-center text-[20px] shrink-0">{r.icon}</div>
                <div className="flex-1">
                  <p className="text-[13px] font-bold text-[#111]">{r.title}</p>
                  <p className="text-[11px] text-[#888]">{r.desc}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${r.tag === 'Ready' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{r.tag}</span>
                  {r.tag === 'Ready' && (
                    <button className="w-8 h-8 flex items-center justify-center rounded-full bg-[#EFF6FF]">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </>
        )}

        <div className="pb-4" />
      </div>
    </div>
  );
}
