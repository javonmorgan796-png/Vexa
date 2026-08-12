import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export type CryptoAsset = 'BTC' | 'ETH' | 'USDT';
export type CryptoTransactionKind = 'deposit' | 'buy' | 'sell' | 'transfer_in' | 'transfer_out';

export interface CryptoBalance {
  asset: CryptoAsset;
  amount: number;
}

export interface CryptoTransaction {
  id: string;
  kind: CryptoTransactionKind;
  asset: string;
  amount: number;
  nairaAmount: number;
  rate: number;
  counterpartyAccount?: string;
  note: string;
  createdAt: string;
}

interface VexaFinanceContextValue {
  exchangeNaira: number;
  cryptoBalances: CryptoBalance[];
  cryptoTransactions: CryptoTransaction[];
  loading: boolean;
  error: string;
  refreshFinance: () => Promise<void>;
  transferVexaMoney: (accountNumber: string, amount: number, note: string, pin: string) => Promise<{ success: boolean; error?: string; transactionId?: string; recipientName?: string }>;
  depositToExchange: (amount: number) => Promise<{ success: boolean; error?: string }>;
  exchangeCrypto: (asset: CryptoAsset, side: 'buy' | 'sell', nairaAmount: number, rate: number) => Promise<{ success: boolean; error?: string }>;
  transferCrypto: (accountNumber: string, asset: CryptoAsset, amount: number) => Promise<{ success: boolean; error?: string; recipientName?: string }>;
}

const VexaFinanceContext = createContext<VexaFinanceContextValue | null>(null);

function rpcError(error: { message?: string } | null, fallback: string) {
  const message = error?.message ?? fallback;
  return message.replace(/^.*?:\s*/, '').replace(/\.$/, '');
}

export function VexaFinanceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [exchangeNaira, setExchangeNaira] = useState(0);
  const [cryptoBalances, setCryptoBalances] = useState<CryptoBalance[]>([]);
  const [cryptoTransactions, setCryptoTransactions] = useState<CryptoTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refreshFinance = useCallback(async () => {
    if (!user) {
      setExchangeNaira(0);
      setCryptoBalances([]);
      setCryptoTransactions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [accountRes, balancesRes, transactionsRes] = await Promise.all([
      supabase.from('crypto_accounts').select('naira_balance').eq('user_id', user.id).maybeSingle(),
      supabase.from('crypto_balances').select('asset, amount').eq('user_id', user.id),
      supabase.from('crypto_transactions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(30),
    ]);
    if (accountRes.error && !accountRes.error.message.toLowerCase().includes('does not exist')) {
      setError(accountRes.error.message);
    }
    setExchangeNaira(Number(accountRes.data?.naira_balance ?? 0));
    setCryptoBalances((balancesRes.data ?? []).map(row => ({ asset: row.asset as CryptoAsset, amount: Number(row.amount) })));
    setCryptoTransactions((transactionsRes.data ?? []).map(row => ({
      id: row.id,
      kind: row.kind as CryptoTransactionKind,
      asset: row.asset,
      amount: Number(row.amount),
      nairaAmount: Number(row.naira_amount),
      rate: Number(row.rate),
      counterpartyAccount: row.counterparty_account ?? undefined,
      note: row.note ?? '',
      createdAt: row.created_at,
    })));
    setLoading(false);
  }, [user]);

  useEffect(() => { void refreshFinance(); }, [refreshFinance]);

  const transferVexaMoney = async (accountNumber: string, amount: number, note: string, pin: string) => {
    const { data, error: rpcErr } = await supabase.rpc('transfer_vexa_money', {
      p_recipient_account: accountNumber,
      p_amount: amount,
      p_note: note,
      p_pin: pin,
    });
    if (rpcErr || !data) return { success: false, error: rpcError(rpcErr, 'Transfer failed') };
    await refreshFinance();
    return {
      success: true,
      transactionId: data.transaction_id as string,
      recipientName: data.recipient_name as string,
    };
  };

  const depositToExchange = async (amount: number) => {
    const { error: rpcErr } = await supabase.rpc('deposit_to_crypto', { p_amount: amount });
    if (rpcErr) return { success: false, error: rpcError(rpcErr, 'Deposit failed') };
    await refreshFinance();
    return { success: true };
  };

  const exchangeCrypto = async (asset: CryptoAsset, side: 'buy' | 'sell', nairaAmount: number, rate: number) => {
    const { error: rpcErr } = await supabase.rpc('exchange_crypto', {
      p_asset: asset,
      p_side: side,
      p_naira_amount: nairaAmount,
      p_rate: rate,
    });
    if (rpcErr) return { success: false, error: rpcError(rpcErr, 'Exchange failed') };
    await refreshFinance();
    return { success: true };
  };

  const transferCrypto = async (accountNumber: string, asset: CryptoAsset, amount: number) => {
    const { data, error: rpcErr } = await supabase.rpc('transfer_crypto', {
      p_recipient_account: accountNumber,
      p_asset: asset,
      p_amount: amount,
    });
    if (rpcErr || !data) return { success: false, error: rpcError(rpcErr, 'Crypto transfer failed') };
    await refreshFinance();
    return { success: true, recipientName: data.recipient_name as string };
  };

  return (
    <VexaFinanceContext.Provider value={{
      exchangeNaira, cryptoBalances, cryptoTransactions, loading, error,
      refreshFinance, transferVexaMoney, depositToExchange, exchangeCrypto, transferCrypto,
    }}>
      {children}
    </VexaFinanceContext.Provider>
  );
}

export function useVexaFinance() {
  const context = useContext(VexaFinanceContext);
  if (!context) throw new Error('useVexaFinance must be used within VexaFinanceProvider');
  return context;
}