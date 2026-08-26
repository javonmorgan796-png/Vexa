import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { useBusiness } from '@/context/BusinessContext';

function fmt(n: number) { return '₦' + n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

const CATEGORIES = ['all', 'payroll', 'transfer', 'bills', 'income', 'other'] as const;
type Cat = typeof CATEGORIES[number];

const catLabels: Record<Cat, string> = { all: 'All', payroll: 'Payroll', transfer: 'Transfers', bills: 'Bills', income: 'Income', other: 'Other' };
const catColors: Record<string, { bg: string; stroke: string }> = {
  payroll:  { bg: '#EDE9FE', stroke: '#7C3AED' },
  transfer: { bg: '#EFF6FF', stroke: '#2563EB' },
  bills:    { bg: '#FFF7ED', stroke: '#EA580C' },
  income:   { bg: '#DCFCE7', stroke: '#16A34A' },
  other:    { bg: '#F3F4F6', stroke: '#6B7280' },
};

export default function BusinessTransactionHistory() {
  const [, navigate] = useLocation();
  const { transactions } = useBusiness();
  const [filter, setFilter] = useState<Cat>('all');
  const [search, setSearch] = useState('');

  const filtered = transactions.filter(tx => {
    const matchCat = filter === 'all' || tx.category === filter;
    const matchSearch = tx.description.toLowerCase().includes(search.toLowerCase()) || tx.reference.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const totalIn  = transactions.filter(t => t.type === 'credit').reduce((s, t) => s + t.amount, 0);
  const totalOut = transactions.filter(t => t.type === 'debit').reduce((s, t) => s + t.amount, 0);

  return (
    <div className="fixed inset-0 bg-[#F2F3F5] flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div className="flex-none bg-white border-b border-[#E8EBF0]" style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}>
        <div className="flex items-center justify-between px-4 pb-3">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/business')} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
            </button>
            <p className="text-[16px] font-bold text-[#111]">Transaction History</p>
          </div>
        </div>

        {/* Summary */}
        <div className="flex gap-3 px-4 pb-3">
          <div className="flex-1 bg-[#DCFCE7] rounded-xl px-3 py-2 text-center">
            <p className="text-[9px] text-green-700 font-semibold uppercase">Total In</p>
            <p className="text-[13px] font-bold text-green-700">+{fmt(totalIn)}</p>
          </div>
          <div className="flex-1 bg-[#FEE2E2] rounded-xl px-3 py-2 text-center">
            <p className="text-[9px] text-red-600 font-semibold uppercase">Total Out</p>
            <p className="text-[13px] font-bold text-red-600">-{fmt(totalOut)}</p>
          </div>
        </div>

        {/* Search */}
        <div className="px-4 pb-2">
          <div className="flex items-center gap-2 bg-[#F2F3F5] rounded-xl px-3 py-2.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" placeholder="Search transactions…" value={search} onChange={e => setSearch(e.target.value)}
              className="flex-1 text-[13px] text-[#111] outline-none bg-transparent placeholder:text-[#9CA3AF]" />
          </div>
        </div>

        {/* Category filter */}
        <div className="flex gap-2 px-4 pb-3 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setFilter(c)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all ${filter === c ? 'bg-[#162353] text-white' : 'bg-[#F2F3F5] text-[#555]'}`}>
              {catLabels[c]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2" style={{ scrollbarWidth: 'none' }}>
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="text-4xl mb-3">📋</div>
            <p className="text-[14px] font-bold text-[#333]">No transactions found</p>
          </div>
        ) : filtered.map(tx => {
          const colors = catColors[tx.category] || catColors.other;
          return (
            <div key={tx.id} className="bg-white rounded-2xl border border-[#F0F0F0] px-4 py-3.5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: colors.bg }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.stroke} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  {tx.type === 'credit' ? <><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></> : <><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></>}
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-[#111] truncate">{tx.description}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full capitalize" style={{ backgroundColor: colors.bg, color: colors.stroke }}>{tx.category}</span>
                  <span className="text-[10px] text-[#AAA]">{new Date(tx.date).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}</span>
                </div>
              </div>
              <span className={`text-[13px] font-bold shrink-0 ${tx.type === 'credit' ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>
                {tx.type === 'credit' ? '+' : '-'}{fmt(tx.amount)}
              </span>
            </div>
          );
        })}
        <div className="pb-4" />
      </div>
    </div>
  );
}
