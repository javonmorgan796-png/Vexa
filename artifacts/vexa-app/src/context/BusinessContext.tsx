import React, { createContext, useContext, useState, useEffect } from 'react';

export type BusinessType = 'sole_proprietorship' | 'partnership' | 'llc' | 'corporation';
export type EmployeeRole = 'admin' | 'manager' | 'employee' | 'viewer';
export type PayrollFrequency = 'monthly' | 'biweekly' | 'weekly';

export interface Employee {
  id: string;
  name: string;
  role: string;
  department: string;
  salary: number;
  accountNumber: string;
  bankName: string;
  email: string;
  phone: string;
  startDate: string;
  appRole: EmployeeRole;
  active: boolean;
}

export interface PayrollSchedule {
  id: string;
  name: string;
  frequency: PayrollFrequency;
  nextRunDate: string;
  employeeIds: string[];
  active: boolean;
}

export interface BusinessTransaction {
  id: string;
  type: 'credit' | 'debit';
  description: string;
  amount: number;
  date: string;
  category: 'payroll' | 'transfer' | 'bills' | 'income' | 'other';
  reference: string;
}

export interface BusinessAccount {
  id: string;
  businessName: string;
  businessType: BusinessType;
  industry: string;
  description: string;
  accountNumber: string;
  balance: number;
  ownerName: string;
  ownerPhone: string;
  email: string;
  address: string;
  createdAt: string;
  twoFAEnabled: boolean;
  transactionLimit: number;
  notificationsEnabled: boolean;
}

interface BusinessContextType {
  business: BusinessAccount | null;
  employees: Employee[];
  payrollSchedules: PayrollSchedule[];
  transactions: BusinessTransaction[];
  createBusiness: (data: Omit<BusinessAccount, 'id' | 'accountNumber' | 'balance' | 'createdAt' | 'twoFAEnabled' | 'transactionLimit' | 'notificationsEnabled'>) => void;
  updateBusiness: (data: Partial<BusinessAccount>) => void;
  addEmployee: (emp: Omit<Employee, 'id'>) => void;
  updateEmployee: (id: string, data: Partial<Employee>) => void;
  deleteEmployee: (id: string) => void;
  addPayrollSchedule: (schedule: Omit<PayrollSchedule, 'id'>) => void;
  updatePayrollSchedule: (id: string, data: Partial<PayrollSchedule>) => void;
  deletePayrollSchedule: (id: string) => void;
  runPayroll: (scheduleId: string) => { success: boolean; message: string };
  addTransaction: (tx: Omit<BusinessTransaction, 'id' | 'date' | 'reference'>) => void;
}

const BusinessContext = createContext<BusinessContextType | null>(null);

const STORAGE_KEY = 'vexa_business';

function genId() { return Math.random().toString(36).slice(2, 10); }
function genAccNum() { return '8' + Array.from({ length: 9 }, () => Math.floor(Math.random() * 10)).join(''); }
function genRef() { return 'VBX' + Date.now().toString(36).toUpperCase(); }

const DEMO_EMPLOYEES: Employee[] = [
  { id: 'e1', name: 'Ada Okonkwo', role: 'Software Engineer', department: 'Engineering', salary: 250000, accountNumber: '2098765432', bankName: 'Access Bank', email: 'ada@example.com', phone: '08023456789', startDate: '2023-01-15', appRole: 'manager', active: true },
  { id: 'e2', name: 'Emeka Nwosu', role: 'Product Manager', department: 'Product', salary: 300000, accountNumber: '3087654321', bankName: 'GTBank', email: 'emeka@example.com', phone: '08034567890', startDate: '2022-08-01', appRole: 'manager', active: true },
  { id: 'e3', name: 'Ngozi Eze', role: 'UI Designer', department: 'Design', salary: 180000, accountNumber: '1076543210', bankName: 'Zenith Bank', email: 'ngozi@example.com', phone: '08045678901', startDate: '2023-06-01', appRole: 'employee', active: true },
  { id: 'e4', name: 'Tunde Bakare', role: 'DevOps Engineer', department: 'Engineering', salary: 220000, accountNumber: '0065432109', bankName: 'UBA', email: 'tunde@example.com', phone: '08056789012', startDate: '2023-03-10', appRole: 'employee', active: true },
];

const DEMO_TRANSACTIONS: BusinessTransaction[] = [
  { id: 't1', type: 'credit', description: 'Client Payment - Oluwaseun Ltd', amount: 500000, date: '2026-07-20T09:00:00Z', category: 'income', reference: 'VBX1A2B3C' },
  { id: 't2', type: 'debit', description: 'Payroll - July 2026', amount: 950000, date: '2026-07-25T08:00:00Z', category: 'payroll', reference: 'VBX4D5E6F' },
  { id: 't3', type: 'credit', description: 'Client Payment - TechCorp NG', amount: 750000, date: '2026-07-15T11:30:00Z', category: 'income', reference: 'VBX7G8H9I' },
  { id: 't4', type: 'debit', description: 'EKEDC Office Electricity', amount: 45000, date: '2026-07-10T10:00:00Z', category: 'bills', reference: 'VBXJKLMNO' },
  { id: 't5', type: 'debit', description: 'Transfer - Vendor Payment', amount: 120000, date: '2026-07-08T14:00:00Z', category: 'transfer', reference: 'VBXPQRSTU' },
  { id: 't6', type: 'credit', description: 'Service Fee - Freelance', amount: 200000, date: '2026-07-05T16:00:00Z', category: 'income', reference: 'VBXVWXYZ1' },
];

const DEMO_SCHEDULES: PayrollSchedule[] = [
  { id: 'ps1', name: 'Monthly Payroll', frequency: 'monthly', nextRunDate: '2026-08-25', employeeIds: ['e1', 'e2', 'e3', 'e4'], active: true },
];

export function BusinessProvider({ children }: { children: React.ReactNode }) {
  const [business, setBusiness] = useState<BusinessAccount | null>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY + '_account') || 'null'); } catch { return null; }
  });
  const [employees, setEmployees] = useState<Employee[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY + '_employees') || 'null') ?? []; } catch { return []; }
  });
  const [payrollSchedules, setPayrollSchedules] = useState<PayrollSchedule[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY + '_schedules') || 'null') ?? []; } catch { return []; }
  });
  const [transactions, setTransactions] = useState<BusinessTransaction[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY + '_transactions') || 'null') ?? []; } catch { return []; }
  });

  useEffect(() => { if (business) localStorage.setItem(STORAGE_KEY + '_account', JSON.stringify(business)); else localStorage.removeItem(STORAGE_KEY + '_account'); }, [business]);
  useEffect(() => { localStorage.setItem(STORAGE_KEY + '_employees', JSON.stringify(employees)); }, [employees]);
  useEffect(() => { localStorage.setItem(STORAGE_KEY + '_schedules', JSON.stringify(payrollSchedules)); }, [payrollSchedules]);
  useEffect(() => { localStorage.setItem(STORAGE_KEY + '_transactions', JSON.stringify(transactions)); }, [transactions]);

  function createBusiness(data: Omit<BusinessAccount, 'id' | 'accountNumber' | 'balance' | 'createdAt' | 'twoFAEnabled' | 'transactionLimit' | 'notificationsEnabled'>) {
    const acct: BusinessAccount = { ...data, id: genId(), accountNumber: genAccNum(), balance: 2650000, createdAt: new Date().toISOString(), twoFAEnabled: false, transactionLimit: 5000000, notificationsEnabled: true };
    setBusiness(acct);
    setEmployees(DEMO_EMPLOYEES);
    setPayrollSchedules(DEMO_SCHEDULES);
    setTransactions(DEMO_TRANSACTIONS);
  }

  function updateBusiness(data: Partial<BusinessAccount>) { setBusiness(b => b ? { ...b, ...data } : b); }

  function addEmployee(emp: Omit<Employee, 'id'>) { setEmployees(es => [...es, { ...emp, id: genId() }]); }
  function updateEmployee(id: string, data: Partial<Employee>) { setEmployees(es => es.map(e => e.id === id ? { ...e, ...data } : e)); }
  function deleteEmployee(id: string) { setEmployees(es => es.filter(e => e.id !== id)); }

  function addPayrollSchedule(s: Omit<PayrollSchedule, 'id'>) { setPayrollSchedules(ps => [...ps, { ...s, id: genId() }]); }
  function updatePayrollSchedule(id: string, data: Partial<PayrollSchedule>) { setPayrollSchedules(ps => ps.map(s => s.id === id ? { ...s, ...data } : s)); }
  function deletePayrollSchedule(id: string) { setPayrollSchedules(ps => ps.filter(s => s.id !== id)); }

  function runPayroll(scheduleId: string) {
    const schedule = payrollSchedules.find(s => s.id === scheduleId);
    if (!schedule) return { success: false, message: 'Schedule not found' };
    const scheduleEmployees = employees.filter(e => schedule.employeeIds.includes(e.id) && e.active);
    const total = scheduleEmployees.reduce((sum, e) => sum + e.salary, 0);
    if (!business || business.balance < total) return { success: false, message: 'Insufficient balance' };
    setBusiness(b => b ? { ...b, balance: b.balance - total } : b);
    setTransactions(ts => [{ id: genId(), type: 'debit', description: `Payroll Run - ${schedule.name}`, amount: total, date: new Date().toISOString(), category: 'payroll', reference: genRef() }, ...ts]);
    return { success: true, message: `₦${total.toLocaleString()} paid to ${scheduleEmployees.length} employees` };
  }

  function addTransaction(tx: Omit<BusinessTransaction, 'id' | 'date' | 'reference'>) {
    const full: BusinessTransaction = { ...tx, id: genId(), date: new Date().toISOString(), reference: genRef() };
    setTransactions(ts => [full, ...ts]);
    if (business) setBusiness(b => b ? { ...b, balance: tx.type === 'credit' ? b.balance + tx.amount : b.balance - tx.amount } : b);
  }

  return (
    <BusinessContext.Provider value={{ business, employees, payrollSchedules, transactions, createBusiness, updateBusiness, addEmployee, updateEmployee, deleteEmployee, addPayrollSchedule, updatePayrollSchedule, deletePayrollSchedule, runPayroll, addTransaction }}>
      {children}
    </BusinessContext.Provider>
  );
}

export function useBusiness() {
  const ctx = useContext(BusinessContext);
  if (!ctx) throw new Error('useBusiness must be used within BusinessProvider');
  return ctx;
}
