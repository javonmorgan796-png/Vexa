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

  const [balance, setBalance]                       = useState(0);
  const [balanceLoading, setBalanceLoading]         = useState(true);

  const [cashbackHistory, setCashbackHistory]       = useState<CashbackItem[]>([]);
  const [cashbackLoading, setCashbackLoading]       = useState(true);

  const [referrals, setReferrals]                   = useState<Referral[]>([]);
  const [referralsLoading, setReferralsLoading]     = useState(true);

  const [notifications, setNotifications]           = useState<AppNotification[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(true);

  const [transactions, setTransactions]             = useState<AppTransaction[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(true);

  /* ── Fetch helpers ─────────────────────────────────────────────── */

  const fetchBalance = useCallback(async () => {
    if (!user) { setBalance(0); setBalanceLoading(false); return; }
    setBalanceLoading(true);
    const { data } = await supabase.from('profiles').select('balance').eq('id', user.id).single();
    if (data) setBalance(Number(data.balance));
    setBalanceLoading(false);
  }, [user]);

  const fetchCashback = useCallback(async () => {
    if (!user) { setCashbackHistory([]); setCashbackLoading(false); return; }
    setCashbackLoading(true);
    const { data } = await supabase
      .from('cashback_history').select('*').eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (data) {
      setCashbackHistory(data.map(d => ({
        id: d.id, desc: d.description, date: d.date,
        rate: d.rate, earned: Number(d.earned),
        status: d.status as CashbackItem['status'],
      })));
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
      setReferrals(data.map(d => ({
        id: d.id, name: d.referred_name, phone: d.referred_phone,
        date: d.date, earned: Number(d.earned),
        status: d.status as Referral['status'],
      })));
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
      setNotifications(data.map(d => ({
        id: d.id,
        type: d.type as AppNotification['type'],
        title: d.title,
        body: d.body,
        read: d.read,
        time: timeAgo(d.created_at),
      })));
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
      setTransactions(data.map(d => ({
        id: d.id,
        type: d.type as 'in' | 'out',
        name: d.name,
        date: fmtTxDate(d.created_at),
        amount: fmtAmount(Number(d.amount)),
        note: d.note,
        raw_amount: Number(d.amount),
      })));
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
      refreshAll();
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

  const referralCode         = user ? 'VEXA-' + (user.accountNumber?.slice(-4) ?? '0000') : '';
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
