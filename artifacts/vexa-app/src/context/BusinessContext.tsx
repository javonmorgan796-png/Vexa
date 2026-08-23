import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

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
  businessLoading: boolean;
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

/* ── Helpers ──────────────────────────────────────────────────────── */

function genId()     { return Math.random().toString(36).slice(2, 10); }
function genAccNum() { return '8' + Array.from({ length: 9 }, () => Math.floor(Math.random() * 10)).join(''); }
function genRef()    { return 'VBX' + Date.now().toString(36).toUpperCase(); }

function rowToEmployee(r: Record<string, unknown>): Employee {
  return {
    id:            r.id as string,
    name:          r.name as string,
    role:          (r.role ?? '') as string,
    department:    (r.department ?? '') as string,
    salary:        Number(r.salary ?? 0),
    accountNumber: (r.account_number ?? '') as string,
    bankName:      (r.bank_name ?? '') as string,
    email:         (r.email ?? '') as string,
    phone:         (r.phone ?? '') as string,
    startDate:     (r.start_date ?? '') as string,
    appRole:       (r.app_role ?? 'employee') as EmployeeRole,
    active:        Boolean(r.active ?? true),
  };
}

function rowToSchedule(r: Record<string, unknown>): PayrollSchedule {
  return {
    id:            r.id as string,
    name:          r.name as string,
    frequency:     r.frequency as PayrollFrequency,
    nextRunDate:   (r.next_run_date ?? '') as string,
    employeeIds:   (r.employee_ids ?? []) as string[],
    active:        Boolean(r.active ?? true),
  };
}

function rowToTransaction(r: Record<string, unknown>): BusinessTransaction {
  return {
    id:          r.id as string,
    type:        r.type as 'credit' | 'debit',
    description: r.description as string,
    amount:      Number(r.amount ?? 0),
    date:        (r.created_at as string) ?? new Date().toISOString(),
    category:    (r.category ?? 'other') as BusinessTransaction['category'],
    reference:   (r.reference ?? '') as string,
  };
}

function rowToBusiness(r: Record<string, unknown>): BusinessAccount {
  return {
    id:                   r.id as string,
    businessName:         r.business_name as string,
    businessType:         r.business_type as BusinessType,
    industry:             (r.industry ?? '') as string,
    description:          (r.description ?? '') as string,
    accountNumber:        r.account_number as string,
    balance:              Number(r.balance ?? 0),
    ownerName:            r.owner_name as string,
    ownerPhone:           r.owner_phone as string,
    email:                (r.email ?? '') as string,
    address:              (r.address ?? '') as string,
    createdAt:            r.created_at as string,
    twoFAEnabled:         Boolean(r.two_fa_enabled),
    transactionLimit:     Number(r.transaction_limit ?? 5000000),
    notificationsEnabled: Boolean(r.notifications_enabled ?? true),
  };
}

/* ── Provider ─────────────────────────────────────────────────────── */

export function BusinessProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  const [business, setBusiness]               = useState<BusinessAccount | null>(null);
  const [employees, setEmployees]             = useState<Employee[]>([]);
  const [payrollSchedules, setSchedules]      = useState<PayrollSchedule[]>([]);
  const [transactions, setTransactions]       = useState<BusinessTransaction[]>([]);
  const [businessLoading, setBusinessLoading] = useState(true);

  /* Load all business data on mount / user change */
  const loadBusiness = useCallback(async () => {
    if (!user) { setBusiness(null); setBusinessLoading(false); return; }
    setBusinessLoading(true);

    const { data: bizData } = await supabase
      .from('business_accounts')
      .select('*')
      .eq('owner_id', user.id)
      .maybeSingle();

    if (!bizData) { setBusinessLoading(false); return; }

    const biz = rowToBusiness(bizData as Record<string, unknown>);
    setBusiness(biz);

    const [empRes, schedRes, txRes] = await Promise.all([
      supabase.from('employees').select('*').eq('business_id', biz.id),
      supabase.from('payroll_schedules').select('*').eq('business_id', biz.id),
      supabase.from('business_transactions').select('*').eq('business_id', biz.id).order('created_at', { ascending: false }),
    ]);

    if (empRes.data)   setEmployees(empRes.data.map(r => rowToEmployee(r as Record<string, unknown>)));
    if (schedRes.data) setSchedules(schedRes.data.map(r => rowToSchedule(r as Record<string, unknown>)));
    if (txRes.data)    setTransactions(txRes.data.map(r => rowToTransaction(r as Record<string, unknown>)));

    setBusinessLoading(false);
  }, [user?.id]);

  useEffect(() => { loadBusiness(); }, [loadBusiness]);

  /* ── Mutations (optimistic local + async Supabase) ─────────────── */

  function createBusiness(data: Omit<BusinessAccount, 'id' | 'accountNumber' | 'balance' | 'createdAt' | 'twoFAEnabled' | 'transactionLimit' | 'notificationsEnabled'>) {
    if (!user) return;
    const acct: BusinessAccount = {
      ...data,
      id:                   genId(),
      accountNumber:        genAccNum(),
      balance:              0,
      createdAt:            new Date().toISOString(),
      twoFAEnabled:         false,
      transactionLimit:     5000000,
      notificationsEnabled: true,
    };
    setBusiness(acct);
    setEmployees([]);
    setSchedules([]);
    setTransactions([]);

    // Persist to Supabase
    supabase.from('business_accounts').insert({
      id:                   acct.id,
      owner_id:             user.id,
      business_name:        acct.businessName,
      business_type:        acct.businessType,
      industry:             acct.industry,
      description:          acct.description,
      account_number:       acct.accountNumber,
      balance:              0,
      owner_name:           acct.ownerName,
      owner_phone:          acct.ownerPhone,
      email:                acct.email,
      address:              acct.address,
      two_fa_enabled:       false,
      transaction_limit:    5000000,
      notifications_enabled: true,
    }).then(({ error }) => { if (error) console.error('[Business] createBusiness:', error.message); });
  }

  function updateBusiness(data: Partial<BusinessAccount>) {
    setBusiness(b => b ? { ...b, ...data } : b);
    if (!business) return;

    const patch: Record<string, unknown> = {};
    if (data.businessName  != null) patch.business_name         = data.businessName;
    if (data.businessType  != null) patch.business_type         = data.businessType;
    if (data.industry      != null) patch.industry              = data.industry;
    if (data.description   != null) patch.description           = data.description;
    if (data.balance       != null) patch.balance               = data.balance;
    if (data.email         != null) patch.email                 = data.email;
    if (data.address       != null) patch.address               = data.address;
    if (data.twoFAEnabled  != null) patch.two_fa_enabled        = data.twoFAEnabled;
    if (data.transactionLimit != null) patch.transaction_limit  = data.transactionLimit;
    if (data.notificationsEnabled != null) patch.notifications_enabled = data.notificationsEnabled;

    supabase.from('business_accounts').update(patch).eq('id', business.id)
      .then(({ error }) => { if (error) console.error('[Business] updateBusiness:', error.message); });
  }

  function addEmployee(emp: Omit<Employee, 'id'>) {
    const newEmp: Employee = { ...emp, id: genId() };
    setEmployees(es => [...es, newEmp]);
    if (!business) return;

    supabase.from('employees').insert({
      id:             newEmp.id,
      business_id:    business.id,
      name:           newEmp.name,
      role:           newEmp.role,
      department:     newEmp.department,
      salary:         newEmp.salary,
      account_number: newEmp.accountNumber,
      bank_name:      newEmp.bankName,
      email:          newEmp.email,
      phone:          newEmp.phone,
      start_date:     newEmp.startDate,
      app_role:       newEmp.appRole,
      active:         newEmp.active,
    }).then(({ error }) => { if (error) console.error('[Business] addEmployee:', error.message); });
  }

  function updateEmployee(id: string, data: Partial<Employee>) {
    setEmployees(es => es.map(e => e.id === id ? { ...e, ...data } : e));

    const patch: Record<string, unknown> = {};
    if (data.name          != null) patch.name           = data.name;
    if (data.role          != null) patch.role           = data.role;
    if (data.department    != null) patch.department     = data.department;
    if (data.salary        != null) patch.salary         = data.salary;
    if (data.accountNumber != null) patch.account_number = data.accountNumber;
    if (data.bankName      != null) patch.bank_name      = data.bankName;
    if (data.email         != null) patch.email          = data.email;
    if (data.phone         != null) patch.phone          = data.phone;
    if (data.startDate     != null) patch.start_date     = data.startDate;
    if (data.appRole       != null) patch.app_role       = data.appRole;
    if (data.active        != null) patch.active         = data.active;

    supabase.from('employees').update(patch).eq('id', id)
      .then(({ error }) => { if (error) console.error('[Business] updateEmployee:', error.message); });
  }

  function deleteEmployee(id: string) {
    setEmployees(es => es.filter(e => e.id !== id));
    supabase.from('employees').delete().eq('id', id)
      .then(({ error }) => { if (error) console.error('[Business] deleteEmployee:', error.message); });
  }

  function addPayrollSchedule(schedule: Omit<PayrollSchedule, 'id'>) {
    const newSched: PayrollSchedule = { ...schedule, id: genId() };
    setSchedules(ps => [...ps, newSched]);
    if (!business) return;

    supabase.from('payroll_schedules').insert({
      id:             newSched.id,
      business_id:    business.id,
      name:           newSched.name,
      frequency:      newSched.frequency,
      next_run_date:  newSched.nextRunDate,
      employee_ids:   newSched.employeeIds,
      active:         newSched.active,
    }).then(({ error }) => { if (error) console.error('[Business] addPayrollSchedule:', error.message); });
  }

  function updatePayrollSchedule(id: string, data: Partial<PayrollSchedule>) {
    setSchedules(ps => ps.map(s => s.id === id ? { ...s, ...data } : s));

    const patch: Record<string, unknown> = {};
    if (data.name         != null) patch.name          = data.name;
    if (data.frequency    != null) patch.frequency     = data.frequency;
    if (data.nextRunDate  != null) patch.next_run_date = data.nextRunDate;
    if (data.employeeIds  != null) patch.employee_ids  = data.employeeIds;
    if (data.active       != null) patch.active        = data.active;

    supabase.from('payroll_schedules').update(patch).eq('id', id)
      .then(({ error }) => { if (error) console.error('[Business] updatePayrollSchedule:', error.message); });
  }

  function deletePayrollSchedule(id: string) {
    setSchedules(ps => ps.filter(s => s.id !== id));
    supabase.from('payroll_schedules').delete().eq('id', id)
      .then(({ error }) => { if (error) console.error('[Business] deletePayrollSchedule:', error.message); });
  }

  function runPayroll(scheduleId: string): { success: boolean; message: string } {
    const schedule = payrollSchedules.find(s => s.id === scheduleId);
    if (!schedule) return { success: false, message: 'Schedule not found' };

    const scheduleEmployees = employees.filter(e => schedule.employeeIds.includes(e.id) && e.active);
    const total = scheduleEmployees.reduce((sum, e) => sum + e.salary, 0);

    if (!business || business.balance < total) return { success: false, message: 'Insufficient balance' };

    const newBalance = business.balance - total;
    const tx: BusinessTransaction = {
      id:          genId(),
      type:        'debit',
      description: `Payroll Run - ${schedule.name}`,
      amount:      total,
      date:        new Date().toISOString(),
      category:    'payroll',
      reference:   genRef(),
    };

    setBusiness(b => b ? { ...b, balance: newBalance } : b);
    setTransactions(ts => [tx, ...ts]);

    // Persist
    if (business) {
      Promise.all([
        supabase.from('business_accounts').update({ balance: newBalance }).eq('id', business.id),
        supabase.from('business_transactions').insert({
          id:          tx.id,
          business_id: business.id,
          type:        tx.type,
          description: tx.description,
          amount:      tx.amount,
          category:    tx.category,
          reference:   tx.reference,
        }),
      ]).then(([r1, r2]) => {
        if (r1.error) console.error('[Business] runPayroll balance:', r1.error.message);
        if (r2.error) console.error('[Business] runPayroll tx:', r2.error.message);
      });
    }

    return { success: true, message: `₦${total.toLocaleString()} paid to ${scheduleEmployees.length} employees` };
  }

  function addTransaction(txInput: Omit<BusinessTransaction, 'id' | 'date' | 'reference'>) {
    const tx: BusinessTransaction = {
      ...txInput,
      id:        genId(),
      date:      new Date().toISOString(),
      reference: genRef(),
    };
    setTransactions(ts => [tx, ...ts]);

    const newBalance = business
      ? txInput.type === 'credit'
        ? business.balance + txInput.amount
        : business.balance - txInput.amount
      : 0;

    if (business) {
      setBusiness(b => b ? { ...b, balance: newBalance } : b);
      Promise.all([
        supabase.from('business_accounts').update({ balance: newBalance }).eq('id', business.id),
        supabase.from('business_transactions').insert({
          id:          tx.id,
          business_id: business.id,
          type:        tx.type,
          description: tx.description,
          amount:      tx.amount,
          category:    tx.category,
          reference:   tx.reference,
        }),
      ]).then(([r1, r2]) => {
        if (r1.error) console.error('[Business] addTransaction balance:', r1.error.message);
        if (r2.error) console.error('[Business] addTransaction tx:', r2.error.message);
      });
    }
  }

  return (
    <BusinessContext.Provider value={{
      business, employees, payrollSchedules, transactions, businessLoading,
      createBusiness, updateBusiness,
      addEmployee, updateEmployee, deleteEmployee,
      addPayrollSchedule, updatePayrollSchedule, deletePayrollSchedule,
      runPayroll, addTransaction,
    }}>
      {children}
    </BusinessContext.Provider>
  );
}

export function useBusiness() {
  const ctx = useContext(BusinessContext);
  if (!ctx) throw new Error('useBusiness must be used within BusinessProvider');
  return ctx;
}
