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

  const [balance, setBalance]                 = useState(0);
  const [balanceLoading, setBalanceLoading]   = useState(true);

  const [cashbackHistory, setCashbackHistory] = useState<CashbackItem[]>([]);
  const [cashbackLoading, setCashbackLoading] = useState(true);

  const [referrals, setReferrals]             = useState<Referral[]>([]);
  const [referralsLoading, setReferralsLoading] = useState(true);

  /* Fetch helpers */

  const fetchBalance = useCallback(async () => {
    if (!user) { setBalance(0); setBalanceLoading(false); return; }
    setBalanceLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('balance')
      .eq('id', user.id)
      .single();
    if (data) setBalance(Number(data.balance));
    setBalanceLoading(false);
  }, [user]);

  const fetchCashback = useCallback(async () => {
    if (!user) { setCashbackHistory([]); setCashbackLoading(false); return; }
    setCashbackLoading(true);
    const { data } = await supabase
      .from('cashback_history')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (data) {
      setCashbackHistory(data.map(d => ({
        id:     d.id,
        desc:   d.description,
        date:   d.date,
        rate:   d.rate,
        earned: Number(d.earned),
        status: d.status as CashbackItem['status'],
      })));
    }
    setCashbackLoading(false);
  }, [user]);

  const fetchReferrals = useCallback(async () => {
    if (!user) { setReferrals([]); setReferralsLoading(false); return; }
    setReferralsLoading(true);
    const { data } = await supabase
      .from('referrals')
      .select('*')
      .eq('referrer_id', user.id)
      .order('created_at', { ascending: false });
    if (data) {
      setReferrals(data.map(d => ({
        id:     d.id,
        name:   d.referred_name,
        phone:  d.referred_phone,
        date:   d.date,
        earned: Number(d.earned),
        status: d.status as Referral['status'],
      })));
    }
    setReferralsLoading(false);
  }, [user]);

  const refreshAll = useCallback(() => {
    fetchBalance();
    fetchCashback();
    fetchReferrals();
  }, [fetchBalance, fetchCashback, fetchReferrals]);

  useEffect(() => {
    if (user) {
      refreshAll();
    } else {
      setBalance(0);
      setCashbackHistory([]);
      setReferrals([]);
      setBalanceLoading(false);
      setCashbackLoading(false);
      setReferralsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  /* Derived cashback totals */
  const cashbackRedeemable = cashbackHistory
    .filter(c => c.status === 'cleared')
    .reduce((s, c) => s + c.earned, 0);

  const cashbackPending = cashbackHistory
    .filter(c => c.status === 'pending')
    .reduce((s, c) => s + c.earned, 0);

  const cashbackTotal = cashbackHistory
    .filter(c => c.status !== 'redeemed')
    .reduce((s, c) => s + c.earned, 0);

  /* Derived referral totals */
  const referralCode         = user ? 'VEXA-' + (user.accountNumber?.slice(-4) ?? '0000') : '';
  const referralTotalEarned  = referrals.filter(r => r.status === 'paid').reduce((s, r) => s + r.earned, 0);
  const referralTotalPending = referrals.filter(r => r.status === 'pending').reduce((s, r) => s + r.earned, 0);

  /* Actions */

  const redeemCashback = async () => {
    if (!user || cashbackRedeemable <= 0) return;

    const newBalance = balance + cashbackRedeemable;

    const [balRes, histRes] = await Promise.all([
      supabase.from('profiles').update({ balance: newBalance }).eq('id', user.id),
      supabase
        .from('cashback_history')
        .update({ status: 'redeemed' })
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

  return (
    <UserDataContext.Provider value={{
      balance, balanceLoading,
      cashbackTotal, cashbackPending, cashbackRedeemable,
      cashbackHistory, cashbackLoading,
      referrals, referralCode, referralTotalEarned, referralTotalPending, referralsLoading,
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
