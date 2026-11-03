import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { useLocation } from 'wouter';

interface PaystackBank {
  name: string;
  slug: string;
  code: string;
  logoUrl: string | null;
}

const RECENT_BANKS_KEY = 'vexa.recentBanks';
const SELECTED_BANK_KEY = 'vexa.selectedBank';

function readRecentBanks(): PaystackBank[] {
  try {
    const value = JSON.parse(localStorage.getItem(RECENT_BANKS_KEY) ?? '[]');
    return Array.isArray(value) ? value.slice(0, 4) : [];
  } catch {
    return [];
  }
}

function BankLogo({ bank, size = 'normal' }: { bank: PaystackBank; size?: 'small' | 'normal' }) {
  return (
    <span className={`${size === 'small' ? 'w-10 h-10' : 'w-11 h-11'} rounded-full bg-[#EEF4FF] flex items-center justify-center overflow-hidden shrink-0`}>
      {bank.logoUrl ? (
        <img src={bank.logoUrl} alt="" className={`${size === 'small' ? 'w-9 h-9' : 'w-10 h-10'} object-contain`} />
      ) : (
        <span className="text-[#0f4f5c] text-[18px] font-bold">{bank.name.slice(0, 1)}</span>
      )}
    </span>
  );
}

export default function BankSelectionPage() {
  const [, navigate] = useLocation();
  const [banks, setBanks] = useState<PaystackBank[]>([]);
  const [recentBanks, setRecentBanks] = useState<PaystackBank[]>(readRecentBanks);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const returnTo = new URLSearchParams(window.location.search).get('returnTo') || '/transfer';

  useEffect(() => {
    let mounted = true;
    void fetch('/api/paystack/banks')
      .then(async response => {
        const body = await response.json().catch(() => null) as { banks?: PaystackBank[]; message?: string } | null;
        if (!response.ok) throw new Error(body?.message || 'Could not load the bank list');
        return body?.banks ?? [];
      })
      .then(nextBanks => {
        if (!mounted) return;
        setBanks(nextBanks);
        setLoading(false);
      })
      .catch(fetchError => {
        if (!mounted) return;
        setError(fetchError instanceof Error ? fetchError.message : 'Could not load the bank list');
        setLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  const filteredBanks = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return banks;
    return banks.filter(bank => bank.name.toLowerCase().includes(query));
  }, [banks, search]);

  function chooseBank(bank: PaystackBank) {
    try {
      sessionStorage.setItem(SELECTED_BANK_KEY, JSON.stringify(bank));
      const nextRecent = [bank, ...recentBanks.filter(item => item.code !== bank.code)].slice(0, 4);
      localStorage.setItem(RECENT_BANKS_KEY, JSON.stringify(nextRecent));
      setRecentBanks(nextRecent);
    } catch {
      // The transfer screen can still use the in-memory navigation fallback.
    }
    navigate(returnTo);
  }

  return (
    <div className="fixed inset-0 bg-[#F8F8FA] flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="flex-none bg-[#F8F8FA] px-4 pb-3" style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}>
        <div className="flex items-center justify-between h-12">
          <button onClick={() => navigate(returnTo)} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[#EEF1F5]">
            <ChevronLeft className="w-6 h-6 text-[#0f4f5c]" strokeWidth={2.2} />
          </button>
          <span className="text-[17px] font-bold text-[#111]">Banks</span>
          <div className="w-9" />
        </div>
        <div className="mt-3 flex items-center gap-3 rounded-xl bg-[#F1F2F7] px-4 h-[52px]">
          <Search className="w-5 h-5 text-[#8D929C]" strokeWidth={2} />
          <input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Search all banks"
            className="flex-1 bg-transparent outline-none text-[15px] text-[#222] placeholder:text-[#8D929C]"
            autoFocus
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-8" style={{ scrollbarWidth: 'none' }}>
        {recentBanks.length > 0 && !search && (
          <section className="pt-4">
            <h2 className="text-[15px] font-bold text-[#222] mb-3">Recent</h2>
            <div className="grid grid-cols-4 gap-2">
              {recentBanks.map(bank => (
                <button key={bank.code} onClick={() => chooseBank(bank)} className="min-w-0 flex flex-col items-center gap-2">
                  <BankLogo bank={bank} size="small" />
                  <span className="w-full truncate text-center text-[11px] text-[#222]">{bank.name}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        <section className={`${recentBanks.length > 0 && !search ? 'pt-8' : 'pt-5'}`}>
          <h2 className="text-[15px] font-bold text-[#222] mb-4">All Institutions</h2>
          {loading && <p className="py-8 text-center text-[13px] text-[#888]">Loading banks…</p>}
          {error && <p className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-[12px] text-red-600">{error}</p>}
          {!loading && !error && filteredBanks.length === 0 && (
            <p className="py-8 text-center text-[13px] text-[#888]">No banks found</p>
          )}
          {!loading && !error && filteredBanks.map(bank => (
            <button
              key={bank.code}
              onClick={() => chooseBank(bank)}
              className="w-full flex items-center gap-4 py-3.5 border-b border-[#EDEEF1] text-left"
            >
              <BankLogo bank={bank} />
              <span className="flex-1 min-w-0 truncate text-[15px] font-medium text-[#222]">{bank.name}</span>
              <ChevronRight className="w-5 h-5 text-[#111] shrink-0" strokeWidth={2} />
            </button>
          ))}
        </section>
      </div>
    </div>
  );
}