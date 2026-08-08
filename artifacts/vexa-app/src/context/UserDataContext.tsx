import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

/* ── Types ─────────────────────────────────────────────────────────── */

export interface CashbackItem {
  id: string;
  desc: string;
  date: string;
  rate: string;
  earned: number;
  status: 'pending' | 'cleared' | 'redeemed';
}

export interface Referral {
  id: string;
  name: string;
  phone: string;
  date: string;
  earned: number;
  status: 'pending' | 'paid';
}

export interface AppNotification {
  id: string;
  type: 'credit' | 'debit' | 'security' | 'promo' | 'info';
  title: string;
  body: string;
  read: boolean;
  time: string;
}

export interface AppTransaction {
  id: string;
  type: 'in' | 'out';
  name: string;
  date: string;
  amount: string;    // formatted: '1,000.00'
  note: string;
  raw_amount: number;
}

/* ── Helpers ────────────────────────────────────────────────────────── */

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  const h = Math.floor(ms / 3600000);
  const d = Math.floor(ms / 86400000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m} min ago`;
  if (h < 24) return `${h} hr${h !== 1 ? 's' : ''} ago`;
  if (d === 1) return 'Yesterday';
  return `${d} days ago`;
}

function fmtTxDate(iso: string): string {
  return new Date(iso).toLocaleString('en-NG', {
    day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

function fmtAmount(raw: number): string {
  return raw.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type DashboardCache = {
  userId: string;
  balance: number;
  cashbackHistory: CashbackItem[];
  referrals: Referral[];
  notifications: AppNotification[];
  transactions: AppTransaction[];
};

function dashboardCacheKey(userId: string) {
  return `vexa_dashboard_cache_${userId}`;
}

function readDashboardCache(userId?: string): DashboardCache | null {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(dashboardCacheKey(userId));
    if (!raw) return null;
    const cached = JSON.parse(raw);
    return cached?.userId === userId ? cached : null;
  } catch {
    return null;
  }
}

function saveDashboardCache(userId: string, patch: Partial<DashboardCache>) {
  try {
    const current = readDashboardCache(userId) ?? {
      userId,
      balance: 0,
      cashbackHistory: [],
      referrals: [],
      notifications: [],
      transactions: [],
    };
    localStorage.setItem(dashboardCacheKey(userId), JSON.stringify({ ...current, ...patch }));
  } catch {
    // Cached data is only an instant-render optimization.
  }
}

/* ── Context type ───────────────────────────────────────────────────── */

interface UserDataContextType {
  /* Balance */
  balance: number;
  balanceLoading: boolean;
  /* Cashback */
  cashbackTotal: number;
  cashbackPending: number;
  cashbackRedeemable: number;
  cashbackHistory: CashbackItem[];
  cashbackLoading: boolean;
  /* Referrals */
  referrals: Referral[];
  referralCode: string;
  referralTotalEarned: number;
  referralTotalPending: number;
  referralsLoading: boolean;
  /* Notifications */
  notifications: AppNotification[];
  notificationsLoading: boolean;
  unreadNotificationsCount: number;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  addNotification: (n: Omit<AppNotification, 'id' | 'time' | 'read'>) => Promise<void>;
  /* Transactions */
  transactions: AppTransaction[];
  transactionsLoading: boolean;
  addTransaction: (t: Omit<AppTransaction, 'id'>) => Promise<void>;
  /* Actions */
  redeemCashback: () => Promise<void>;
  refreshAll: () => void;
  creditBalance: (amount: number) => Promise<void>;
  debitBalance: (amount: number) => Promise<boolean>;
}

const UserDataContext = createContext<UserDataContextType | null>(null);

/* ── Provider ───────────────────────────────────────────────────────── */

export function UserDataProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const initialCache = readDashboardCache(user?.id);

  const [balance, setBalance]                       = useState(initialCache?.balance ?? user?.balance ?? 0);
  const [balanceLoading, setBalanceLoading]         = useState(!initialCache && !user?.balance);

  const [cashbackHistory, setCashbackHistory]       = useState<CashbackItem[]>(initialCache?.cashbackHistory ?? []);
  const [cashbackLoading, setCashbackLoading]       = useState(!initialCache);

  const [referrals, setReferrals]                   = useState<Referral[]>(initialCache?.referrals ?? []);
  const [referralsLoading, setReferralsLoading]     = useState(!initialCache);

  const [notifications, setNotifications]           = useState<AppNotification[]>(initialCache?.notifications ?? []);
  const [notificationsLoading, setNotificationsLoading] = useState(!initialCache);

  const [transactions, setTransactions]             = useState<AppTransaction[]>(initialCache?.transactions ?? []);
  const [transactionsLoading, setTransactionsLoading] = useState(!initialCache);

  /* ── Fetch helpers ─────────────────────────────────────────────── */

  const fetchBalance = useCallback(async () => {
    if (!user) { setBalance(0); setBalanceLoading(false); return; }
    setBalanceLoading(true);
    const { data } = await supabase.from('profiles').select('balance').eq('id', user.id).single();
    if (data) {
      const nextBalance = Number(data.balance);
      setBalance(nextBalance);
      saveDashboardCache(user.id, { balance: nextBalance });
    }
    setBalanceLoading(false);
  }, [user]);

  const fetchCashback = useCallback(async () => {
    if (!user) { setCashbackHistory([]); setCashbackLoading(false); return; }
    setCashbackLoading(true);
    const { data } = await supabase
      .from('cashback_history').select('*').eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (data) {
      const nextCashback = data.map(d => ({
        id: d.id, desc: d.description, date: d.date,
        rate: d.rate, earned: Number(d.earned),
        status: d.status as CashbackItem['status'],
      }));
      setCashbackHistory(nextCashback);
      saveDashboardCache(user.id, { cashbackHistory: nextCashback });
    }
    setCashbackLoading(false);
  }, [user]);

  const fetchReferrals = useCallback(async () => {
    if (!user) { setReferrals([]); setReferralsLoading(false); return; }
    setReferralsLoading(true);
    const { data } = await supabase
      .from('referrals').select('*').eq('referrer_id', user.id)
      .order('created_at', { ascending: false });
    if (data) {
      const nextReferrals = data.map(d => ({
        id: d.id, name: d.referred_name, phone: d.referred_phone,
        date: d.date, earned: Number(d.earned),
        status: d.status as Referral['status'],
      }));
      setReferrals(nextReferrals);
      saveDashboardCache(user.id, { referrals: nextReferrals });
    }
    setReferralsLoading(false);
  }, [user]);

  const fetchNotifications = useCallback(async () => {
    if (!user) { setNotifications([]); setNotificationsLoading(false); return; }
    setNotificationsLoading(true);
    const { data } = await supabase
      .from('notifications').select('*').eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (data) {
      const nextNotifications = data.map(d => ({
        id: d.id,
        type: d.type as AppNotification['type'],
        title: d.title,
        body: d.body,
        read: d.read,
        time: timeAgo(d.created_at),
      }));
      setNotifications(nextNotifications);
      saveDashboardCache(user.id, { notifications: nextNotifications });
    }
    setNotificationsLoading(false);
  }, [user]);

  const fetchTransactions = useCallback(async () => {
    if (!user) { setTransactions([]); setTransactionsLoading(false); return; }
    setTransactionsLoading(true);
    const { data } = await supabase
      .from('transactions').select('*').eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (data) {
      const nextTransactions = data.map(d => ({
        id: d.id,
        type: d.type as 'in' | 'out',
        name: d.name,
        date: fmtTxDate(d.created_at),
        amount: fmtAmount(Number(d.amount)),
        note: d.note,
        raw_amount: Number(d.amount),
      }));
      setTransactions(nextTransactions);
      saveDashboardCache(user.id, { transactions: nextTransactions });
    }
    setTransactionsLoading(false);
  }, [user]);

  const refreshAll = useCallback(() => {
    fetchBalance();
    fetchCashback();
    fetchReferrals();
    fetchNotifications();
    fetchTransactions();
  }, [fetchBalance, fetchCashback, fetchReferrals, fetchNotifications, fetchTransactions]);

  useEffect(() => {
    if (user) {
      // The profile query already returns the wallet balance. Show it
      // immediately. Load only secondary dashboard collections here; making
      // another profiles request during login delayed the balance render.
      setBalance(user.balance);
      setBalanceLoading(false);
      const cached = readDashboardCache(user.id);
      if (cached) {
        setCashbackHistory(cached.cashbackHistory);
        setReferrals(cached.referrals);
        setNotifications(cached.notifications);
        setTransactions(cached.transactions);
        setCashbackLoading(false);
        setReferralsLoading(false);
        setNotificationsLoading(false);
        setTransactionsLoading(false);
      }
      fetchCashback();
      fetchReferrals();
      fetchNotifications();
      fetchTransactions();
    } else {
      setBalance(0); setCashbackHistory([]); setReferrals([]);
      setNotifications([]); setTransactions([]);
      setBalanceLoading(false); setCashbackLoading(false);
      setReferralsLoading(false); setNotificationsLoading(false);
      setTransactionsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  /* ── Derived cashback totals ─────────────────────────────────── */

  const cashbackRedeemable = cashbackHistory
    .filter(c => c.status === 'cleared').reduce((s, c) => s + c.earned, 0);
  const cashbackPending = cashbackHistory
    .filter(c => c.status === 'pending').reduce((s, c) => s + c.earned, 0);
  const cashbackTotal = cashbackHistory
    .filter(c => c.status !== 'redeemed').reduce((s, c) => s + c.earned, 0);

  /* ── Derived referral totals ─────────────────────────────────── */

  const referralCode         = user?.referralCode || (user ? 'VEXA-' + (user.accountNumber?.slice(-4) ?? '0000') : '');
  const referralTotalEarned  = referrals.filter(r => r.status === 'paid').reduce((s, r) => s + r.earned, 0);
  const referralTotalPending = referrals.filter(r => r.status === 'pending').reduce((s, r) => s + r.earned, 0);

  /* ── Notification counts ─────────────────────────────────────── */

  const unreadNotificationsCount = notifications.filter(n => !n.read).length;

  /* ── Actions ──────────────────────────────────────────────────── */

  const redeemCashback = async () => {
    if (!user || cashbackRedeemable <= 0) return;
    const newBalance = balance + cashbackRedeemable;
    const [balRes, histRes] = await Promise.all([
      supabase.from('profiles').update({ balance: newBalance }).eq('id', user.id),
      supabase.from('cashback_history').update({ status: 'redeemed' })
        .in('id', cashbackHistory.filter(c => c.status === 'cleared').map(c => c.id)),
    ]);
    if (!balRes.error && !histRes.error) {
      setBalance(newBalance);
      await fetchCashback();
    }
  };

  const creditBalance = async (amount: number) => {
    if (!user) return;
    const newBalance = balance + amount;
    const { error } = await supabase.from('profiles').update({ balance: newBalance }).eq('id', user.id);
    if (!error) setBalance(newBalance);
  };

  const debitBalance = async (amount: number): Promise<boolean> => {
    if (!user || balance < amount) return false;
    const newBalance = balance - amount;
    const { error } = await supabase.from('profiles').update({ balance: newBalance }).eq('id', user.id);
    if (!error) { setBalance(newBalance); return true; }
    return false;
  };

  const markNotificationRead = async (id: string) => {
    await supabase.from('notifications').update({ read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllNotificationsRead = async () => {
    if (!user) return;
    await supabase.from('notifications').update({ read: true })
      .eq('user_id', user.id).eq('read', false);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const addNotification = async (n: Omit<AppNotification, 'id' | 'time' | 'read'>) => {
    if (!user) return;
    const { data } = await supabase.from('notifications').insert({
      user_id: user.id, type: n.type, title: n.title, body: n.body, read: false,
    }).select().single();
    if (data) {
      setNotifications(prev => [{
        id: data.id, type: data.type, title: data.title,
        body: data.body, read: false, time: 'Just now',
      }, ...prev]);
    }
  };

  const addTransaction = async (t: Omit<AppTransaction, 'id'>) => {
    if (!user) return;
    const { data } = await supabase.from('transactions').insert({
      user_id: user.id, type: t.type, name: t.name,
      amount: t.raw_amount, note: t.note,
    }).select().single();
    if (data) {
      setTransactions(prev => [{
        id: data.id, type: t.type, name: t.name,
        date: fmtTxDate(data.created_at),
        amount: fmtAmount(Number(data.amount)),
        note: t.note, raw_amount: Number(data.amount),
      }, ...prev]);
    }
  };

  return (
    <UserDataContext.Provider value={{
      balance, balanceLoading,
      cashbackTotal, cashbackPending, cashbackRedeemable,
      cashbackHistory, cashbackLoading,
      referrals, referralCode, referralTotalEarned, referralTotalPending, referralsLoading,
      notifications, notificationsLoading, unreadNotificationsCount,
      markNotificationRead, markAllNotificationsRead, addNotification,
      transactions, transactionsLoading, addTransaction,
      redeemCashback, refreshAll, creditBalance, debitBalance,
    }}>
      {children}
    </UserDataContext.Provider>
  );
}

export function useUserData() {
  const ctx = useContext(UserDataContext);
  if (!ctx) throw new Error('useUserData must be used within UserDataProvider');
  return ctx;
}
