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
  createBusiness: (data: Omit<BusinessAccount, 'id' | 'accountNumber' | 'balance' | 'createdAt' | 'twoFAEnabled' | 'transactionLimit' | 'notificationsEnabled'>) => Promise<{ success: boolean; error?: string }>;
  updateBusiness: (data: Partial<BusinessAccount>) => Promise<{ success: boolean; error?: string }>;
  addEmployee: (emp: Omit<Employee, 'id'>) => Promise<void>;
  updateEmployee: (id: string, data: Partial<Employee>) => Promise<void>;
  deleteEmployee: (id: string) => Promise<void>;
  addPayrollSchedule: (schedule: Omit<PayrollSchedule, 'id'>) => Promise<void>;
  updatePayrollSchedule: (id: string, data: Partial<PayrollSchedule>) => Promise<void>;
  deletePayrollSchedule: (id: string) => Promise<void>;
  runPayroll: (scheduleId: string) => Promise<{ success: boolean; message: string }>;
  runBulkPayroll: (employeeIds: string[]) => Promise<{ success: boolean; message: string }>;
  transferBusinessMoney: (input: { pin: string; amount: number; recipientName: string }) => Promise<{ success: boolean; error?: string }>;
  payBusinessBill: (input: { categoryLabel: string; provider: string; amount: number }) => Promise<{ success: boolean; error?: string }>;
}

const BusinessContext = createContext<BusinessContextType | null>(null);

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

async function authedBusinessFetch<T = Record<string, unknown>>(
  path: string,
  method: 'POST' | 'PATCH' | 'DELETE',
  body?: Record<string, unknown>,
): Promise<{ ok: boolean; data: T | null; error?: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    return { ok: false, data: null, error: 'Your session has expired. Please sign in again.' };
  }
  const resp = await fetch(path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const payload = await resp.json().catch(() => null) as (T & { message?: string }) | null;
  if (!resp.ok) {
    return { ok: false, data: payload, error: payload?.message || 'Request failed' };
  }
  return { ok: true, data: payload };
}

export function BusinessProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  const [business, setBusiness]               = useState<BusinessAccount | null>(null);
  const [employees, setEmployees]             = useState<Employee[]>([]);
  const [payrollSchedules, setSchedules]      = useState<PayrollSchedule[]>([]);
  const [transactions, setTransactions]       = useState<BusinessTransaction[]>([]);
  const [businessLoading, setBusinessLoading] = useState(true);

  const loadBusiness = useCallback(async () => {
    if (!user) { setBusiness(null); setBusinessLoading(false); return; }
    setBusinessLoading(true);

    const { data: bizData } = await supabase
      .from('business_accounts')
      .select('*')
      .eq('owner_id', user.id)
      .maybeSingle();

    if (!bizData) {
      setBusiness(null);
      setEmployees([]);
      setSchedules([]);
      setTransactions([]);
      setBusinessLoading(false);
      return;
    }

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

  useEffect(() => { void loadBusiness(); }, [loadBusiness]);

  async function createBusiness(
    data: Omit<BusinessAccount, 'id' | 'accountNumber' | 'balance' | 'createdAt' | 'twoFAEnabled' | 'transactionLimit' | 'notificationsEnabled'>,
  ): Promise<{ success: boolean; error?: string }> {
    if (!user) return { success: false, error: 'You must be signed in to create a business account.' };
    const res = await authedBusinessFetch<{ business?: Record<string, unknown> }>('/api/business/create', 'POST', data as unknown as Record<string, unknown>);
    if (!res.ok || !res.data?.business) {
      return { success: false, error: res.error || 'Business account could not be saved.' };
    }
    setBusiness(rowToBusiness(res.data.business));
    setEmployees([]);
    setSchedules([]);
    setTransactions([]);
    return { success: true };
  }

  async function updateBusiness(data: Partial<BusinessAccount>): Promise<{ success: boolean; error?: string }> {
    if (!business) return { success: false, error: 'No business account found.' };
    const safePatch: Record<string, unknown> = {};
    if (data.businessName != null) safePatch.businessName = data.businessName;
    if (data.industry != null) safePatch.industry = data.industry;
    if (data.description != null) safePatch.description = data.description;
    if (data.email != null) safePatch.email = data.email;
    if (data.address != null) safePatch.address = data.address;
    if (data.twoFAEnabled != null) safePatch.twoFAEnabled = data.twoFAEnabled;
    if (data.transactionLimit != null) safePatch.transactionLimit = data.transactionLimit;
    if (data.notificationsEnabled != null) safePatch.notificationsEnabled = data.notificationsEnabled;

    const res = await authedBusinessFetch<{ business?: Record<string, unknown> }>('/api/business/update', 'PATCH', safePatch);
    if (!res.ok) return { success: false, error: res.error };
    if (res.data?.business) {
      setBusiness(rowToBusiness(res.data.business));
    } else {
      setBusiness(b => b ? { ...b, ...data } : b);
    }
    return { success: true };
  }

  async function addEmployee(emp: Omit<Employee, 'id'>) {
    const res = await authedBusinessFetch<{ employee?: Record<string, unknown> }>('/api/business/employees', 'POST', emp as unknown as Record<string, unknown>);
    if (res.ok && res.data?.employee) {
      setEmployees(es => [...es, rowToEmployee(res.data!.employee!)]);
    }
  }

  async function updateEmployee(id: string, data: Partial<Employee>) {
    const res = await authedBusinessFetch<{ employee?: Record<string, unknown> }>(`/api/business/employees/${encodeURIComponent(id)}`, 'PATCH', data as Record<string, unknown>);
    if (res.ok) {
      if (res.data?.employee) {
        const mapped = rowToEmployee(res.data.employee);
        setEmployees(es => es.map(e => e.id === id ? mapped : e));
      } else {
        setEmployees(es => es.map(e => e.id === id ? { ...e, ...data } : e));
      }
    }
  }

  async function deleteEmployee(id: string) {
    const res = await authedBusinessFetch(`/api/business/employees/${encodeURIComponent(id)}`, 'DELETE');
    if (res.ok) {
      setEmployees(es => es.filter(e => e.id !== id));
    }
  }

  async function addPayrollSchedule(schedule: Omit<PayrollSchedule, 'id'>) {
    const res = await authedBusinessFetch<{ schedule?: Record<string, unknown> }>('/api/business/schedules', 'POST', schedule as unknown as Record<string, unknown>);
    if (res.ok && res.data?.schedule) {
      setSchedules(ps => [...ps, rowToSchedule(res.data!.schedule!)]);
    }
  }

  async function updatePayrollSchedule(id: string, data: Partial<PayrollSchedule>) {
    const res = await authedBusinessFetch<{ schedule?: Record<string, unknown> }>(`/api/business/schedules/${encodeURIComponent(id)}`, 'PATCH', data as Record<string, unknown>);
    if (res.ok) {
      if (res.data?.schedule) {
        const mapped = rowToSchedule(res.data.schedule);
        setSchedules(ps => ps.map(s => s.id === id ? mapped : s));
      } else {
        setSchedules(ps => ps.map(s => s.id === id ? { ...s, ...data } : s));
      }
    }
  }

  async function deletePayrollSchedule(id: string) {
    const res = await authedBusinessFetch(`/api/business/schedules/${encodeURIComponent(id)}`, 'DELETE');
    if (res.ok) {
      setSchedules(ps => ps.filter(s => s.id !== id));
    }
  }

  async function runPayroll(scheduleId: string): Promise<{ success: boolean; message: string }> {
    const res = await authedBusinessFetch<{ balance?: number; message?: string; transaction?: Record<string, unknown> }>(
      '/api/business/payroll/run',
      'POST',
      { scheduleId },
    );
    if (!res.ok || !res.data) {
      return { success: false, message: res.error || 'Payroll run failed' };
    }
    if (typeof res.data.balance === 'number') {
      setBusiness(b => b ? { ...b, balance: res.data!.balance! } : b);
    }
    if (res.data.transaction) {
      setTransactions(ts => [rowToTransaction(res.data!.transaction!), ...ts]);
    }
    return { success: true, message: res.data.message || 'Payroll completed' };
  }

  async function runBulkPayroll(employeeIds: string[]): Promise<{ success: boolean; message: string }> {
    const res = await authedBusinessFetch<{ balance?: number; message?: string; transaction?: Record<string, unknown> }>(
      '/api/business/payroll/bulk',
      'POST',
      { employeeIds },
    );
    if (!res.ok || !res.data) {
      return { success: false, message: res.error || 'Bulk payroll failed' };
    }
    if (typeof res.data.balance === 'number') {
      setBusiness(b => b ? { ...b, balance: res.data!.balance! } : b);
    }
    if (res.data.transaction) {
      setTransactions(ts => [rowToTransaction(res.data!.transaction!), ...ts]);
    }
    return { success: true, message: res.data.message || 'Bulk payroll completed' };
  }

  async function transferBusinessMoney(input: { pin: string; amount: number; recipientName: string }): Promise<{ success: boolean; error?: string }> {
    const res = await authedBusinessFetch<{ balance?: number; transaction?: Record<string, unknown> }>(
      '/api/business/transfer',
      'POST',
      input,
    );
    if (!res.ok || !res.data) {
      return { success: false, error: res.error || 'Business transfer failed' };
    }
    if (typeof res.data.balance === 'number') {
      setBusiness(b => b ? { ...b, balance: res.data!.balance! } : b);
    }
    if (res.data.transaction) {
      setTransactions(ts => [rowToTransaction(res.data!.transaction!), ...ts]);
    }
    return { success: true };
  }

  async function payBusinessBill(input: { categoryLabel: string; provider: string; amount: number }): Promise<{ success: boolean; error?: string }> {
    const res = await authedBusinessFetch<{ balance?: number; transaction?: Record<string, unknown> }>(
      '/api/business/bills/pay',
      'POST',
      input,
    );
    if (!res.ok || !res.data) {
      return { success: false, error: res.error || 'Bill payment failed' };
    }
    if (typeof res.data.balance === 'number') {
      setBusiness(b => b ? { ...b, balance: res.data!.balance! } : b);
    }
    if (res.data.transaction) {
      setTransactions(ts => [rowToTransaction(res.data!.transaction!), ...ts]);
    }
    return { success: true };
  }

  return (
    <BusinessContext.Provider value={{
      business, employees, payrollSchedules, transactions, businessLoading,
      createBusiness, updateBusiness,
      addEmployee, updateEmployee, deleteEmployee,
      addPayrollSchedule, updatePayrollSchedule, deletePayrollSchedule,
      runPayroll, runBulkPayroll, transferBusinessMoney, payBusinessBill,
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
