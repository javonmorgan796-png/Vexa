import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { useBusiness, Employee, EmployeeRole } from '@/context/BusinessContext';

const DEPARTMENTS = ['Engineering', 'Product', 'Design', 'Marketing', 'Sales', 'Finance', 'HR', 'Operations', 'Legal', 'Other'];
const APP_ROLES: { value: EmployeeRole; label: string; desc: string }[] = [
  { value: 'admin', label: 'Admin', desc: 'Full access' },
  { value: 'manager', label: 'Manager', desc: 'Manage team' },
  { value: 'employee', label: 'Employee', desc: 'View only' },
  { value: 'viewer', label: 'Viewer', desc: 'Read-only' },
];
const BANKS = ['Access Bank', 'GTBank', 'Zenith Bank', 'UBA', 'First Bank', 'Polaris Bank', 'Stanbic IBTC', 'Wema Bank', 'Keystone Bank', 'Fidelity Bank'];

type ModalMode = 'add' | 'edit' | null;
const blank = (): Omit<Employee, 'id'> => ({ name: '', role: '', department: '', salary: 0, accountNumber: '', bankName: 'Access Bank', email: '', phone: '', startDate: new Date().toISOString().slice(0, 10), appRole: 'employee', active: true });

export default function EmployeeManagement() {
  const [, navigate] = useLocation();
  const { employees, addEmployee, updateEmployee, deleteEmployee } = useBusiness();
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('All');
  const [modal, setModal] = useState<ModalMode>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(blank());
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const departments = ['All', ...Array.from(new Set(employees.map(e => e.department)))];

  const filtered = employees.filter(e => {
    const matchSearch = e.name.toLowerCase().includes(search.toLowerCase()) || e.role.toLowerCase().includes(search.toLowerCase());
    const matchDept = deptFilter === 'All' || e.department === deptFilter;
    return matchSearch && matchDept;
  });

  function openAdd() { setForm(blank()); setError(''); setModal('add'); }
  function openEdit(e: Employee) { setForm({ name: e.name, role: e.role, department: e.department, salary: e.salary, accountNumber: e.accountNumber, bankName: e.bankName, email: e.email, phone: e.phone, startDate: e.startDate, appRole: e.appRole, active: e.active }); setEditId(e.id); setError(''); setModal('edit'); }

  function validate() {
    if (!form.name.trim()) return 'Full name is required';
    if (!form.role.trim()) return 'Job title is required';
    if (!form.department) return 'Department is required';
    if (!form.salary || form.salary <= 0) return 'Enter a valid salary';
    if (!form.accountNumber.trim() || form.accountNumber.replace(/\D/g, '').length < 10) return 'Enter a valid 10-digit account number';
    return null;
  }

  function handleSave() {
    const err = validate();
    if (err) { setError(err); return; }
    if (modal === 'add') addEmployee(form);
    else if (modal === 'edit' && editId) updateEmployee(editId, form);
    setModal(null);
    setSuccess(modal === 'add' ? 'Employee added successfully!' : 'Employee updated!');
    setTimeout(() => setSuccess(''), 3000);
  }

  function handleDelete() {
    if (deleteId) { deleteEmployee(deleteId); setDeleteId(null); setSuccess('Employee removed.'); setTimeout(() => setSuccess(''), 3000); }
  }

  const roleColor: Record<EmployeeRole, string> = { admin: '#7C3AED', manager: '#2563EB', employee: '#16A34A', viewer: '#888' };

  return (
    <div className="fixed inset-0 bg-[#F2F3F5] flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div className="flex-none bg-white border-b border-[#E8EBF0]" style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}>
        <div className="flex items-center justify-between px-4 pb-3">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/business')} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
            </button>
            <div>
              <p className="text-[16px] font-bold text-[#111]">Employees</p>
              <p className="text-[11px] text-[#888]">{employees.filter(e => e.active).length} active members</p>
            </div>
          </div>
          <button onClick={openAdd} className="h-9 px-4 bg-[#162353] text-white text-[12px] font-bold rounded-xl flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add
          </button>
        </div>

        {/* Search */}
        <div className="px-4 pb-2">
          <div className="flex items-center gap-2 bg-[#F2F3F5] rounded-xl px-3 py-2.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" placeholder="Search employees…" value={search} onChange={e => setSearch(e.target.value)}
              className="flex-1 text-[13px] text-[#111] outline-none bg-transparent placeholder:text-[#9CA3AF]" />
          </div>
        </div>

        {/* Dept filter */}
        <div className="flex gap-2 px-4 pb-3 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {departments.map(d => (
            <button key={d} onClick={() => setDeptFilter(d)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all ${deptFilter === d ? 'bg-[#162353] text-white' : 'bg-[#F2F3F5] text-[#555]'}`}>
              {d}
            </button>
          ))}
        </div>
      </div>

      {success && <div className="mx-4 mt-3 bg-green-50 border border-green-200 rounded-xl px-4 py-2.5 text-[12px] text-green-700 font-medium">{success}</div>}

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2" style={{ scrollbarWidth: 'none' }}>
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="text-4xl mb-3">👥</div>
            <p className="text-[14px] font-bold text-[#333]">No employees found</p>
            <p className="text-[12px] text-[#888] mt-1">Tap "Add" to add your first team member</p>
          </div>
        ) : filtered.map(emp => (
          <div key={emp.id} className="bg-white rounded-2xl border border-[#F0F0F0] px-4 py-4 flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-[#EFF6FF] flex items-center justify-center shrink-0 text-[14px] font-bold text-[#2563EB]">
              {emp.name.split(' ').map(p => p[0]).slice(0, 2).join('')}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-[13px] font-bold text-[#111] truncate">{emp.name}</p>
                {!emp.active && <span className="text-[9px] bg-red-100 text-red-600 font-semibold px-1.5 py-0.5 rounded-full">Inactive</span>}
              </div>
              <p className="text-[11px] text-[#888] truncate">{emp.role} · {emp.department}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: roleColor[emp.appRole] + '20', color: roleColor[emp.appRole] }}>
                  {emp.appRole}
                </span>
                <span className="text-[11px] font-semibold text-[#111]">₦{emp.salary.toLocaleString()}/mo</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => openEdit(emp)} className="w-8 h-8 flex items-center justify-center rounded-full bg-[#F2F3F5] hover:bg-[#E8EBF0] transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button onClick={() => setDeleteId(emp.id)} className="w-8 h-8 flex items-center justify-center rounded-full bg-[#FEF2F2] hover:bg-[#FEE2E2] transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
              </button>
            </div>
          </div>
        ))}
        <div className="pb-4" />
      </div>

      {/* Add/Edit Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="bg-white w-full rounded-t-3xl px-5 pt-5 pb-8 max-h-[90vh] overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
            <div className="w-10 h-1 bg-[#DDD] rounded-full mx-auto mb-5" />
            <p className="text-[17px] font-bold text-[#111] mb-5">{modal === 'add' ? 'Add Employee' : 'Edit Employee'}</p>
            {error && <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-[12px] text-red-600 font-medium">{error}</div>}
            <div className="space-y-4">
              {[
                { label: 'Full Name *', key: 'name', placeholder: 'e.g. Ngozi Adeyemi', type: 'text' },
                { label: 'Job Title *', key: 'role', placeholder: 'e.g. Software Engineer', type: 'text' },
                { label: 'Email', key: 'email', placeholder: 'employee@company.com', type: 'email' },
                { label: 'Phone', key: 'phone', placeholder: '080XXXXXXXX', type: 'tel' },
                { label: 'Account Number *', key: 'accountNumber', placeholder: '10-digit account number', type: 'tel' },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-[11px] font-semibold text-[#444] mb-1 block">{f.label}</label>
                  <input type={f.type} placeholder={f.placeholder} value={(form as any)[f.key]} onChange={e => { setForm(p => ({ ...p, [f.key]: e.target.value })); setError(''); }}
                    className="w-full h-[46px] rounded-xl border border-[#E2E8F0] bg-[#F8F9FB] px-4 text-[13px] text-[#111] placeholder-[#C0C8D4] focus:outline-none focus:border-[#162353] focus:bg-white transition-colors" />
                </div>
              ))}
              <div>
                <label className="text-[11px] font-semibold text-[#444] mb-1 block">Monthly Salary (₦) *</label>
                <input type="number" placeholder="e.g. 250000" value={form.salary || ''} onChange={e => { setForm(p => ({ ...p, salary: Number(e.target.value) })); setError(''); }}
                  className="w-full h-[46px] rounded-xl border border-[#E2E8F0] bg-[#F8F9FB] px-4 text-[13px] text-[#111] placeholder-[#C0C8D4] focus:outline-none focus:border-[#162353] focus:bg-white transition-colors" />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[#444] mb-1 block">Department *</label>
                <div className="flex flex-wrap gap-1.5">
                  {DEPARTMENTS.map(d => (
                    <button key={d} type="button" onClick={() => { setForm(p => ({ ...p, department: d })); setError(''); }}
                      className={`px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all ${form.department === d ? 'bg-[#162353] text-white' : 'bg-[#F2F3F5] text-[#555]'}`}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[#444] mb-1 block">Bank</label>
                <div className="flex flex-wrap gap-1.5">
                  {BANKS.map(b => (
                    <button key={b} type="button" onClick={() => setForm(p => ({ ...p, bankName: b }))}
                      className={`px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all ${form.bankName === b ? 'bg-[#162353] text-white' : 'bg-[#F2F3F5] text-[#555]'}`}>
                      {b}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[#444] mb-1 block">App Role</label>
                <div className="grid grid-cols-2 gap-2">
                  {APP_ROLES.map(r => (
                    <button key={r.value} type="button" onClick={() => setForm(p => ({ ...p, appRole: r.value }))}
                      className={`px-3 py-2.5 rounded-xl border-2 text-left transition-all ${form.appRole === r.value ? 'border-[#162353] bg-[#F0F4FF]' : 'border-[#E2E8F0]'}`}>
                      <p className="text-[12px] font-bold text-[#111]">{r.label}</p>
                      <p className="text-[10px] text-[#888]">{r.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between pt-1">
                <div>
                  <p className="text-[13px] font-semibold text-[#111]">Active Employee</p>
                  <p className="text-[11px] text-[#888]">Include in payroll runs</p>
                </div>
                <button type="button" onClick={() => setForm(p => ({ ...p, active: !p.active }))}
                  className={`w-11 h-6 rounded-full transition-colors ${form.active ? 'bg-[#162353]' : 'bg-[#CCC]'}`}>
                  <div className={`w-4 h-4 bg-white rounded-full mx-1 transition-transform ${form.active ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setModal(null)} className="flex-1 h-[48px] rounded-xl border-2 border-[#E2E8F0] text-[#555] text-[14px] font-semibold">Cancel</button>
              <button onClick={handleSave} className="flex-1 h-[48px] rounded-xl bg-[#162353] text-white text-[14px] font-bold">{modal === 'add' ? 'Add Employee' : 'Save Changes'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-6">
          <div className="bg-white rounded-2xl p-6 w-full">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
            </div>
            <p className="text-[16px] font-bold text-[#111] text-center mb-1">Remove Employee?</p>
            <p className="text-[13px] text-[#888] text-center mb-6">This employee will be removed from your team and all payroll schedules.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 h-[48px] rounded-xl border-2 border-[#E2E8F0] text-[#555] text-[14px] font-semibold">Cancel</button>
              <button onClick={handleDelete} className="flex-1 h-[48px] rounded-xl bg-red-600 text-white text-[14px] font-bold">Remove</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
