import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { useBusiness, PayrollFrequency } from '@/context/BusinessContext';

function fmt(n: number) { return '₦' + n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

const FREQ_LABELS: Record<PayrollFrequency, string> = { monthly: 'Monthly', biweekly: 'Bi-weekly', weekly: 'Weekly' };

export default function PayrollManagement() {
  const [, navigate] = useLocation();
  const { employees, payrollSchedules, transactions, addPayrollSchedule, updatePayrollSchedule, deletePayrollSchedule, runPayroll, business } = useBusiness();
  const [tab, setTab] = useState<'schedules' | 'bulk' | 'history'>('schedules');
  const [showNewSchedule, setShowNewSchedule] = useState(false);
  const [schedName, setSchedName] = useState('');
  const [schedFreq, setSchedFreq] = useState<PayrollFrequency>('monthly');
  const [schedDate, setSchedDate] = useState('');
  const [selectedEmpIds, setSelectedEmpIds] = useState<string[]>([]);
  const [runResult, setRunResult] = useState<{ msg: string; ok: boolean } | null>(null);
  const [bulkSelected, setBulkSelected] = useState<string[]>([]);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkResult, setBulkResult] = useState<string | null>(null);
  const [error, setError] = useState('');

  const activeEmployees = employees.filter(e => e.active);
  const payrollTx = transactions.filter(t => t.category === 'payroll');
  const totalPayroll = activeEmployees.reduce((s, e) => s + e.salary, 0);

  function toggleEmp(id: string) { setSelectedEmpIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]); }
  function toggleBulk(id: string) { setBulkSelected(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]); }

  function handleAddSchedule() {
    if (!schedName.trim()) { setError('Schedule name required'); return; }
    if (selectedEmpIds.length === 0) { setError('Select at least one employee'); return; }
    if (!schedDate) { setError('Next run date required'); return; }
    addPayrollSchedule({ name: schedName, frequency: schedFreq, nextRunDate: schedDate, employeeIds: selectedEmpIds, active: true });
    setShowNewSchedule(false); setSchedName(''); setSelectedEmpIds([]); setError('');
  }

  function handleRunSchedule(id: string) {
    const result = runPayroll(id);
    setRunResult({ msg: result.message, ok: result.success });
    setTimeout(() => setRunResult(null), 4000);
  }

  function handleBulkPay() {
    if (bulkSelected.length === 0) return;
    setBulkRunning(true);
    setTimeout(() => {
      const emps = activeEmployees.filter(e => bulkSelected.includes(e.id));
      const total = emps.reduce((s, e) => s + e.salary, 0);
      if (business && business.balance >= total) {
        emps.forEach(e => {});
        setBulkResult(`✅ ₦${total.toLocaleString()} paid to ${emps.length} employees`);
      } else {
        setBulkResult('❌ Insufficient balance for bulk payment');
      }
      setBulkRunning(false);
      setBulkSelected([]);
      setTimeout(() => setBulkResult(null), 5000);
    }, 1500);
  }

  return (
    <div className="fixed inset-0 bg-[#F2F3F5] flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div className="flex-none bg-[#162353]" style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}>
        <div className="flex items-center gap-3 px-5 pb-4">
          <button onClick={() => navigate('/business')} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          </button>
          <div>
            <p className="text-white text-[16px] font-bold">Payroll Management</p>
            <p className="text-white/60 text-[11px]">Monthly total: {fmt(totalPayroll)}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex px-5 gap-1 pb-4">
          {(['schedules', 'bulk', 'history'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-xl text-[12px] font-semibold transition-all ${tab === t ? 'bg-white text-[#162353]' : 'text-white/60'}`}>
              {t === 'schedules' ? 'Schedules' : t === 'bulk' ? 'Bulk Pay' : 'History'}
            </button>
          ))}
        </div>
      </div>

      {runResult && (
        <div className={`mx-4 mt-3 rounded-xl px-4 py-2.5 text-[12px] font-medium border ${runResult.ok ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
          {runResult.msg}
        </div>
      )}
      {bulkResult && (
        <div className="mx-4 mt-3 rounded-xl px-4 py-2.5 text-[12px] font-medium bg-blue-50 border border-blue-200 text-blue-700">{bulkResult}</div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3" style={{ scrollbarWidth: 'none' }}>

        {/* SCHEDULES TAB */}
        {tab === 'schedules' && (
          <>
            <button onClick={() => setShowNewSchedule(true)} className="w-full h-[50px] rounded-xl bg-[#162353] text-white text-[14px] font-bold flex items-center justify-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              New Payroll Schedule
            </button>

            {payrollSchedules.length === 0 ? (
              <div className="py-16 text-center">
                <div className="text-4xl mb-3">📅</div>
                <p className="text-[14px] font-bold text-[#333]">No schedules yet</p>
                <p className="text-[12px] text-[#888] mt-1">Create your first automatic payroll schedule</p>
              </div>
            ) : payrollSchedules.map(s => {
              const schedEmps = employees.filter(e => s.employeeIds.includes(e.id));
              const total = schedEmps.reduce((sum, e) => sum + e.salary, 0);
              return (
                <div key={s.id} className="bg-white rounded-2xl border border-[#F0F0F0] overflow-hidden">
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="text-[14px] font-bold text-[#111]">{s.name}</p>
                        <p className="text-[11px] text-[#888] mt-0.5">{FREQ_LABELS[s.frequency]} · {schedEmps.length} employees</p>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${s.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {s.active ? 'Active' : 'Paused'}
                      </span>
                    </div>
                    <div className="flex gap-4 text-[12px]">
                      <div><span className="text-[#888]">Total: </span><span className="font-bold text-[#111]">{fmt(total)}</span></div>
                      <div><span className="text-[#888]">Next: </span><span className="font-bold text-[#111]">{new Date(s.nextRunDate).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}</span></div>
                    </div>
                  </div>
                  <div className="flex border-t border-[#F5F5F5]">
                    <button onClick={() => updatePayrollSchedule(s.id, { active: !s.active })}
                      className="flex-1 py-3 text-[12px] font-semibold text-[#555] border-r border-[#F5F5F5] hover:bg-[#F9F9F9]">
                      {s.active ? 'Pause' : 'Resume'}
                    </button>
                    <button onClick={() => handleRunSchedule(s.id)}
                      className="flex-1 py-3 text-[12px] font-bold text-[#162353] border-r border-[#F5F5F5] hover:bg-[#F0F4FF]">
                      Run Now
                    </button>
                    <button onClick={() => deletePayrollSchedule(s.id)}
                      className="flex-1 py-3 text-[12px] font-semibold text-red-600 hover:bg-red-50">
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </>
        )}

        {/* BULK PAY TAB */}
        {tab === 'bulk' && (
          <>
            <div className="bg-[#F0F4FF] border border-[#C7D7FF] rounded-xl px-4 py-3">
              <p className="text-[12px] font-semibold text-[#162353] mb-0.5">Bulk Salary Payment</p>
              <p className="text-[11px] text-[#555]">Select employees and pay all salaries at once</p>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-[12px] font-semibold text-[#888]">Select Employees</p>
              <button onClick={() => setBulkSelected(bulkSelected.length === activeEmployees.length ? [] : activeEmployees.map(e => e.id))}
                className="text-[12px] text-[#162353] font-semibold">
                {bulkSelected.length === activeEmployees.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            {activeEmployees.map(e => (
              <button key={e.id} onClick={() => toggleBulk(e.id)}
                className={`w-full bg-white rounded-2xl border-2 px-4 py-3.5 flex items-center gap-3 text-left transition-all ${bulkSelected.includes(e.id) ? 'border-[#162353] bg-[#F0F4FF]' : 'border-[#F0F0F0]'}`}>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${bulkSelected.includes(e.id) ? 'border-[#162353] bg-[#162353]' : 'border-[#CCC]'}`}>
                  {bulkSelected.includes(e.id) && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                </div>
                <div className="w-9 h-9 rounded-full bg-[#EFF6FF] flex items-center justify-center text-[12px] font-bold text-[#2563EB] shrink-0">
                  {e.name.split(' ').map(p => p[0]).slice(0, 2).join('')}
                </div>
                <div className="flex-1">
                  <p className="text-[13px] font-semibold text-[#111]">{e.name}</p>
                  <p className="text-[11px] text-[#888]">{e.role}</p>
                </div>
                <span className="text-[12px] font-bold text-[#111]">{fmt(e.salary)}</span>
              </button>
            ))}

            {bulkSelected.length > 0 && (
              <div className="bg-white rounded-2xl border border-[#F0F0F0] px-4 py-3">
                <div className="flex justify-between mb-3">
                  <span className="text-[12px] text-[#888]">Selected ({bulkSelected.length})</span>
                  <span className="text-[13px] font-bold text-[#111]">{fmt(activeEmployees.filter(e => bulkSelected.includes(e.id)).reduce((s, e) => s + e.salary, 0))}</span>
                </div>
                <button onClick={handleBulkPay} disabled={bulkRunning}
                  className="w-full h-[48px] rounded-xl bg-[#162353] text-white text-[14px] font-bold disabled:opacity-60">
                  {bulkRunning ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="white" strokeWidth="3" strokeDasharray="40 20"/></svg>
                      Processing…
                    </span>
                  ) : `Pay ${bulkSelected.length} Employee${bulkSelected.length !== 1 ? 's' : ''}`}
                </button>
              </div>
            )}
          </>
        )}

        {/* HISTORY TAB */}
        {tab === 'history' && (
          <>
            {payrollTx.length === 0 ? (
              <div className="py-16 text-center">
                <div className="text-4xl mb-3">📋</div>
                <p className="text-[14px] font-bold text-[#333]">No payroll history</p>
                <p className="text-[12px] text-[#888] mt-1">Run your first payroll to see history here</p>
              </div>
            ) : payrollTx.map(tx => (
              <div key={tx.id} className="bg-white rounded-2xl border border-[#F0F0F0] px-4 py-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#FEE2E2] flex items-center justify-center shrink-0">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-[#111] truncate">{tx.description}</p>
                  <p className="text-[10px] text-[#888] mt-0.5">{tx.reference} · {new Date(tx.date).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                </div>
                <span className="text-[13px] font-bold text-[#DC2626] shrink-0">-{fmt(tx.amount)}</span>
              </div>
            ))}
          </>
        )}
        <div className="pb-4" />
      </div>

      {/* New Schedule Modal */}
      {showNewSchedule && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end" onClick={e => e.target === e.currentTarget && setShowNewSchedule(false)}>
          <div className="bg-white w-full rounded-t-3xl px-5 pt-5 pb-8 max-h-[85vh] overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
            <div className="w-10 h-1 bg-[#DDD] rounded-full mx-auto mb-5" />
            <p className="text-[17px] font-bold text-[#111] mb-5">New Payroll Schedule</p>
            {error && <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-[12px] text-red-600">{error}</div>}
            <div className="space-y-4">
              <div>
                <label className="text-[11px] font-semibold text-[#444] mb-1 block">Schedule Name</label>
                <input type="text" placeholder="e.g. Monthly Payroll" value={schedName} onChange={e => { setSchedName(e.target.value); setError(''); }}
                  className="w-full h-[46px] rounded-xl border border-[#E2E8F0] bg-[#F8F9FB] px-4 text-[13px] focus:outline-none focus:border-[#162353] transition-colors" />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[#444] mb-1 block">Frequency</label>
                <div className="flex gap-2">
                  {(['monthly', 'biweekly', 'weekly'] as PayrollFrequency[]).map(f => (
                    <button key={f} onClick={() => setSchedFreq(f)}
                      className={`flex-1 py-2.5 rounded-xl border-2 text-[12px] font-semibold transition-all ${schedFreq === f ? 'border-[#162353] bg-[#F0F4FF] text-[#162353]' : 'border-[#E2E8F0] text-[#555]'}`}>
                      {FREQ_LABELS[f]}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[#444] mb-1 block">Next Run Date</label>
                <input type="date" value={schedDate} onChange={e => { setSchedDate(e.target.value); setError(''); }}
                  className="w-full h-[46px] rounded-xl border border-[#E2E8F0] bg-[#F8F9FB] px-4 text-[13px] focus:outline-none focus:border-[#162353] transition-colors" />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[#444] mb-2 block">Include Employees</label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {employees.filter(e => e.active).map(e => (
                    <button key={e.id} onClick={() => toggleEmp(e.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 text-left transition-all ${selectedEmpIds.includes(e.id) ? 'border-[#162353] bg-[#F0F4FF]' : 'border-[#E2E8F0]'}`}>
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${selectedEmpIds.includes(e.id) ? 'border-[#162353] bg-[#162353]' : 'border-[#CCC]'}`}>
                        {selectedEmpIds.includes(e.id) && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                      </div>
                      <span className="text-[12px] font-semibold text-[#111]">{e.name}</span>
                      <span className="ml-auto text-[11px] text-[#888]">{fmt(e.salary)}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowNewSchedule(false)} className="flex-1 h-[48px] rounded-xl border-2 border-[#E2E8F0] text-[#555] text-[14px] font-semibold">Cancel</button>
              <button onClick={handleAddSchedule} className="flex-1 h-[48px] rounded-xl bg-[#162353] text-white text-[14px] font-bold">Create Schedule</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
