import React, { useState, useEffect } from 'react';
import { useAdmin } from '../AdminContext';
import { Naira } from '@/components/Naira';
import {
  Search,
  ArrowDownLeft,
  ArrowUpRight,
  Filter,
  CheckCircle2,
  Clock,
  XCircle,
  Copy,
  Check,
  X,
  ExternalLink,
} from 'lucide-react';

export const TransactionManagementTab: React.FC = () => {
  const { fetchAdminApi, adminTheme } = useAdmin();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchRef, setSearchRef] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedTx, setSelectedTx] = useState<any>(null);
  const [copiedRef, setCopiedRef] = useState(false);

  const isDark = adminTheme === 'dark';

  const loadTransactions = async () => {
    try {
      setLoading(true);
      const res = await fetchAdminApi('/api/admin/transactions');
      setTransactions(res.transactions || []);
    } catch (err) {
      console.error('Failed to load transactions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTransactions();
  }, []);

  const filtered = transactions.filter((tx) => {
    const matchesSearch =
      !searchRef ||
      tx.reference.toLowerCase().includes(searchRef.toLowerCase()) ||
      tx.user.toLowerCase().includes(searchRef.toLowerCase()) ||
      tx.phone.includes(searchRef);

    const matchesStatus = statusFilter === 'all' || tx.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const copyReference = (ref: string) => {
    navigator.clipboard.writeText(ref);
    setCopiedRef(true);
    setTimeout(() => setCopiedRef(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Transaction Ledger & Auditing
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Institutional ledger of all deposits, interbank transfers, crypto settlement, and bill debits.
          </p>
        </div>

        {/* Search */}
        <div className="flex items-center space-x-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Filter by reference (e.g. VX-TRF-...), name, phone..."
              value={searchRef}
              onChange={(e) => setSearchRef(e.target.value)}
              className={`w-72 sm:w-80 pl-9 pr-3 py-2 rounded-xl text-xs border outline-none ${
                isDark
                  ? 'bg-[#161A23] border-gray-800 text-white placeholder-gray-500 focus:border-[#F0B90B]'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-[#F0B90B]'
              }`}
            />
          </div>
        </div>
      </div>

      {/* Status Filters */}
      <div className="flex items-center space-x-2 text-xs">
        {['all', 'successful', 'pending', 'failed'].map((st) => (
          <button
            key={st}
            onClick={() => setStatusFilter(st)}
            className={`px-3 py-1.5 rounded-lg font-semibold capitalize transition-all ${
              statusFilter === st
                ? 'bg-[#F0B90B] text-black'
                : isDark
                ? 'bg-gray-800/60 text-gray-400 hover:text-white'
                : 'bg-gray-100 text-gray-600 hover:text-gray-900'
            }`}
          >
            {st} ({transactions.filter((t) => (st === 'all' ? true : t.status === st)).length})
          </button>
        ))}
      </div>

      {/* Ledger Table */}
      <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-[#12151D] border-gray-800' : 'bg-white border-slate-200 shadow-sm'}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className={`border-b ${isDark ? 'border-gray-800 bg-[#0E1118] text-gray-400' : 'border-slate-200 bg-slate-100/80 text-slate-500'}`}>
                <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono">Reference</th>
                <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono">Customer</th>
                <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono">Category / Type</th>
                <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono text-right">Amount & Fee</th>
                <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono">Beneficiary / Target</th>
                <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono text-center">Status</th>
                <th className="py-3.5 px-4 sm:px-5 text-[11px] font-bold uppercase tracking-wider font-mono text-right">Details</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-gray-800/60' : 'divide-slate-100'}`}>
              {filtered.map((tx) => (
                <tr key={tx.id} className={`${isDark ? 'hover:bg-gray-800/30' : 'hover:bg-slate-50'} transition-colors`}>
                  <td className="py-4 px-4 sm:px-5 font-mono text-xs font-semibold text-[#F0B90B]">{tx.reference}</td>
                  <td className="py-4 px-4 sm:px-5 font-sans">
                    <div className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{tx.user}</div>
                    <div className="text-xs text-gray-400 font-mono mt-0.5">{tx.phone}</div>
                  </td>
                  <td className="py-4 px-4 sm:px-5 font-sans">
                    <span className={`inline-flex items-center space-x-1.5 text-xs font-medium ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>
                      {tx.type.includes('Transfer') || tx.type.includes('Withdrawal') ? (
                        <ArrowUpRight className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      ) : (
                        <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      )}
                      <span>{tx.type}</span>
                    </span>
                  </td>
                  <td className="py-4 px-4 sm:px-5 text-right font-mono tabular-nums">
                    <div className={`font-bold text-sm flex items-baseline justify-end ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      <Naira className="mr-0.5 text-xs" />{Number(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-[11px] text-gray-400 font-sans mt-0.5 flex items-baseline justify-end">
                      Fee: <Naira className="ml-1 mr-0.5 text-[10px]" />{Number(tx.fee).toFixed(2)}
                    </div>
                  </td>
                  <td className={`py-4 px-4 sm:px-5 font-sans text-xs max-w-xs truncate ${isDark ? 'text-gray-300' : 'text-slate-600'}`}>
                    {tx.recipient}
                  </td>
                  <td className="py-4 px-4 sm:px-5 text-center">
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider ${
                        tx.status === 'successful'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : tx.status === 'pending'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}
                    >
                      {tx.status}
                    </span>
                  </td>
                  <td className="py-4 px-4 sm:px-5 text-right">
                    <button
                      onClick={() => setSelectedTx(tx)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors font-sans ${
                        isDark
                          ? 'bg-gray-800 hover:bg-gray-700 text-gray-200 border-gray-700'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
                      }`}
                    >
                      Audit
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-500 font-sans">
                    No transactions matching filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transaction Audit Modal */}
      {selectedTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className={`w-full max-w-lg rounded-2xl p-6 shadow-2xl border ${isDark ? 'bg-[#161A23] border-gray-800 text-white' : 'bg-white border-slate-200 text-slate-900'}`}>
            <div className={`flex items-center justify-between pb-3 border-b ${isDark ? 'border-gray-800' : 'border-slate-200'}`}>
              <h2 className="text-base font-bold">Transaction Record Audit</h2>
              <button onClick={() => setSelectedTx(null)} className={`transition-colors ${isDark ? 'text-gray-400 hover:text-white' : 'text-slate-400 hover:text-slate-700'}`}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className={`my-5 p-4 rounded-xl border text-center ${isDark ? 'bg-gray-900/60 border-gray-800' : 'bg-slate-50 border-slate-200'}`}>
              <div className="text-xs text-gray-400">Total Settlement Value</div>
              <div className={`text-2xl font-bold font-mono mt-1 flex items-baseline justify-center ${isDark ? 'text-white' : 'text-slate-900'}`}>
                <Naira className="mr-0.5 text-xl" />{Number(selectedTx.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-emerald-500 font-semibold uppercase mt-1 tracking-wider">
                Status: {selectedTx.status}
              </div>
            </div>

            <div className="space-y-3 text-xs font-mono">
              <div className={`flex items-center justify-between py-2 border-b ${isDark ? 'border-gray-800/60' : 'border-slate-200'}`}>
                <span className="text-gray-400 font-sans">Session Reference:</span>
                <div className="flex items-center space-x-1">
                  <span className="text-[#F0B90B] font-bold">{selectedTx.reference}</span>
                  <button
                    onClick={() => copyReference(selectedTx.reference)}
                    className="p-1 hover:text-white text-gray-400"
                  >
                    {copiedRef ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
              <div className={`flex items-center justify-between py-2 border-b ${isDark ? 'border-gray-800/60' : 'border-slate-200'}`}>
                <span className="text-gray-400 font-sans">Sender / Origin:</span>
                <span className={`font-sans ${isDark ? 'text-white' : 'text-slate-900'}`}>{selectedTx.user} ({selectedTx.phone})</span>
              </div>
              <div className={`flex items-center justify-between py-2 border-b ${isDark ? 'border-gray-800/60' : 'border-slate-200'}`}>
                <span className="text-gray-400 font-sans">Beneficiary Target:</span>
                <span className={`font-sans ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>{selectedTx.recipient}</span>
              </div>
              <div className={`flex items-center justify-between py-2 border-b ${isDark ? 'border-gray-800/60' : 'border-slate-200'}`}>
                <span className="text-gray-400 font-sans">Timestamp:</span>
                <span className="text-gray-500">{new Date(selectedTx.timestamp).toUTCString()}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-gray-400 font-sans">NIBSS / Gateway Fee:</span>
                <span className={`flex items-baseline ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>
                  <Naira className="mr-0.5 text-xs" />{Number(selectedTx.fee).toFixed(2)}
                </span>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSelectedTx(null)}
                className={`px-5 py-2 rounded-xl text-xs font-semibold font-sans border transition-colors ${
                  isDark
                    ? 'bg-gray-800 hover:bg-gray-700 text-white border-gray-700'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
                }`}
              >
                Close Audit Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
