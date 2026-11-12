import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useUserData } from '@/context/UserDataContext';
import { emitCryptoDepositToast } from '@/components/crypto/CryptoDepositToast';

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
  lastUpdatedAt: string | null;
  refreshFinance: (options?: { silent?: boolean }) => Promise<void>;
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

function fmtNaira(value: number) {
  return `₦${value.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtCryptoQty(value: number) {
  return value.toLocaleString('en-NG', { maximumFractionDigits: 8 });
}

export function VexaFinanceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { addNotification, refreshAll } = useUserData();
  const [exchangeNaira, setExchangeNaira] = useState(0);
  const [cryptoBalances, setCryptoBalances] = useState<CryptoBalance[]>([]);
  const [cryptoTransactions, setCryptoTransactions] = useState<CryptoTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const seenIncomingTxIdsRef = useRef<Set<string> | null>(null);
  const seenUserIdRef = useRef<string | null>(null);

  const refreshFinance = useCallback(async (options?: { silent?: boolean }) => {
    if (!user) {
      setExchangeNaira(0);
      setCryptoBalances([]);
      setCryptoTransactions([]);
      setLastUpdatedAt(null);
      seenIncomingTxIdsRef.current = null;
      seenUserIdRef.current = null;
      setLoading(false);
      return;
    }
    if (seenUserIdRef.current !== user.id) {
      seenIncomingTxIdsRef.current = null;
      seenUserIdRef.current = user.id;
    }
    if (!options?.silent) setLoading(true);
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
    const mappedTransactions: CryptoTransaction[] = (transactionsRes.data ?? []).map(row => ({
      id: row.id,
      kind: row.kind as CryptoTransactionKind,
      asset: row.asset,
      amount: Number(row.amount),
      nairaAmount: Number(row.naira_amount),
      rate: Number(row.rate),
      counterpartyAccount: row.counterparty_account ?? undefined,
      note: row.note ?? '',
      createdAt: row.created_at,
    }));

    const seenIds = seenIncomingTxIdsRef.current;
    if (seenIds === null) {
      seenIncomingTxIdsRef.current = new Set(mappedTransactions.map(item => item.id));
    } else {
      const now = Date.now();
      for (const tx of mappedTransactions) {
        if (seenIds.has(tx.id)) continue;
        seenIds.add(tx.id);
        if (tx.kind !== 'deposit' && tx.kind !== 'transfer_in') continue;
        const assetUpper = tx.asset.toUpperCase();
        if (assetUpper !== 'BTC' && assetUpper !== 'ETH' && assetUpper !== 'USDT') continue;
        const createdMs = new Date(tx.createdAt).getTime();
        if (Number.isFinite(createdMs) && now - createdMs > 10 * 60 * 1000) continue;
        const hashMatch = tx.note.match(/\b(0x[a-f0-9]{6,}|[a-f0-9]{10,})\b/i);
        emitCryptoDepositToast({
          asset: assetUpper as CryptoAsset,
          amount: fmtCryptoQty(tx.amount),
          status: 'credited',
          txHash: hashMatch?.[1],
          dedupeKey: `tx:${tx.id}`,
          subtitle:
            tx.kind === 'transfer_in'
              ? tx.counterpartyAccount
                ? `Received from account ${tx.counterpartyAccount}`
                : 'Received in Exchange wallet'
              : 'Credited to your Exchange wallet',
        });
      }
    }

    setCryptoTransactions(mappedTransactions);
    setLastUpdatedAt(new Date().toISOString());
    setLoading(false);
  }, [user]);

  useEffect(() => { void refreshFinance(); }, [refreshFinance]);

  // Keep the exchange current when another session changes a wallet, balance,
  // or transaction. Polling keeps it fresh even before Realtime is enabled
  // for these tables in the Supabase project.
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`vexa-finance:${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'crypto_accounts', filter: `user_id=eq.${user.id}` },
        () => { void refreshFinance({ silent: true }); },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'crypto_balances', filter: `user_id=eq.${user.id}` },
        () => { void refreshFinance({ silent: true }); },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'crypto_transactions', filter: `user_id=eq.${user.id}` },
        () => {
          void refreshFinance({ silent: true });
          refreshAll();
        },
      )
      .subscribe();

    const interval = window.setInterval(() => {
      void refreshFinance({ silent: true });
    }, 15000);

    return () => {
      window.clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [user?.id, refreshFinance, refreshAll]);

  async function authedPost<T = Record<string, unknown>>(path: string, body: Record<string, unknown>): Promise<{ ok: boolean; data: T | null; error?: string }> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      return { ok: false, data: null, error: 'Your session has expired. Please sign in again.' };
    }
    const resp = await fetch(path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(body),
    });
    const payload = await resp.json().catch(() => null) as (T & { message?: string }) | null;
    if (!resp.ok) {
      return { ok: false, data: payload, error: payload?.message || 'Request failed' };
    }
    return { ok: true, data: payload };
  }

  const transferVexaMoney = async (accountNumber: string, amount: number, note: string, pin: string) => {
    const res = await authedPost<{ transactionId?: string; recipientName?: string }>('/api/wallet/transfer/vexa', {
      accountNumber,
      amount,
      note,
      pin,
    });
    if (!res.ok || !res.data) return { success: false, error: res.error ?? 'Transfer failed' };
    await refreshFinance();
    refreshAll();
    return {
      success: true,
      transactionId: res.data.transactionId,
      recipientName: res.data.recipientName,
    };
  };

  const depositToExchange = async (amount: number) => {
    const res = await authedPost('/api/wallet/crypto/deposit-fiat', { amount });
    if (!res.ok) return { success: false, error: res.error ?? 'Deposit failed' };
    await refreshFinance();
    refreshAll();
    return { success: true };
  };

  const exchangeCrypto = async (asset: CryptoAsset, side: 'buy' | 'sell', nairaAmount: number, _rate: number) => {
    // Note: Exchange rate is computed authoritatively on the backend live oracle
    const res = await authedPost('/api/wallet/crypto/exchange', {
      asset,
      side,
      nairaAmount,
    });
    if (!res.ok) return { success: false, error: res.error ?? 'Exchange failed' };
    await refreshFinance();
    refreshAll();
    return { success: true };
  };

  const transferCrypto = async (accountNumber: string, asset: CryptoAsset, amount: number) => {
    const res = await authedPost<{ recipient_name?: string }>('/api/wallet/crypto/transfer', {
      accountNumber,
      asset,
      amount,
    });
    if (!res.ok || !res.data) return { success: false, error: res.error ?? 'Crypto transfer failed' };
    await refreshFinance();
    refreshAll();
    return { success: true, recipientName: res.data.recipient_name };
  };

  return (
    <VexaFinanceContext.Provider value={{
      exchangeNaira, cryptoBalances, cryptoTransactions, loading, error,
      lastUpdatedAt,
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