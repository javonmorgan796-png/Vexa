import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { useLocation } from 'wouter';

interface PaystackBank {
  name: string;
  legalName?: string;
  slug: string;
  code: string;
  logoUrl: string | null;
}

const RECENT_BANKS_KEY = 'vexa.recentBanks';
const SELECTED_BANK_KEY = 'vexa.selectedBank';

export function cleanBankName(raw: string): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  const lower = trimmed.toLowerCase();

  // Primary consumer brand names for major fintechs and banks
  if (lower.includes('opay') || lower.includes('paycom')) return 'OPay';
  if (lower.includes('palmpay')) return 'PalmPay';
  if (lower.includes('kuda')) return 'Kuda Bank';
  if (lower.includes('moniepoint')) return 'Moniepoint';
  if (lower === 'united bank for africa' || lower.startsWith('united bank for africa') || lower.includes('uba plc') || lower === 'uba') return 'UBA';
  if (lower.includes('guaranty trust') || lower.includes('gtbank')) return 'GTBank';
  if (lower.includes('first bank of nigeria') || lower === 'first bank') return 'First Bank';
  if (lower.includes('first city monument bank') || lower === 'fcmb') return 'FCMB';
  if (lower.includes('stanbic ibtc')) return 'Stanbic IBTC';
  if (lower.includes('standard chartered')) return 'Standard Chartered';
  if (lower.includes('fairmoney')) return 'FairMoney';
  if (lower.includes('vfd microfinance') || lower.includes('vfd bank')) return 'VFD Bank';
  if (lower.includes('rubies')) return 'Rubies Bank';
  if (lower.includes('sparkle')) return 'Sparkle';
  if (lower.includes('carbon')) return 'Carbon';
  if (lower.includes('paga')) return 'Paga';
  if (lower.includes('providus')) return 'Providus Bank';
  if (lower.includes('titan trust')) return 'Titan Trust Bank';
  if (lower.includes('citibank')) return 'Citibank';
  if (lower.includes('access bank')) return 'Access Bank';
  if (lower.includes('zenith bank')) return 'Zenith Bank';
  if (lower.includes('sterling bank')) return 'Sterling Bank';
  if (lower.includes('union bank')) return 'Union Bank';
  if (lower.includes('wema bank')) return 'Wema Bank';
  if (lower.includes('fidelity bank')) return 'Fidelity Bank';
  if (lower.includes('polaris bank')) return 'Polaris Bank';
  if (lower.includes('keystone bank')) return 'Keystone Bank';
  if (lower.includes('jaiz bank')) return 'Jaiz Bank';
  if (lower.includes('taj bank')) return 'TAJ Bank';
  if (lower.includes('lotus bank')) return 'Lotus Bank';
  if (lower.includes('heritage bank')) return 'Heritage Bank';
  if (lower.includes('unity bank')) return 'Unity Bank';

  // General corporate legal title stripping
  let name = trimmed
    .replace(/\s*\([^)]*\)/g, '') // remove (MFB), (NIGERIA), etc.
    .replace(/\b(plc|limited|ltd|mortgage bank|payment service bank|psb)\b/gi, '')
    .replace(/\b(microfinance bank|mfb)\b/gi, 'Bank')
    .replace(/\b(of nigeria|nigeria)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Convert ALL-CAPS to friendly Title Case
  if (name === name.toUpperCase()) {
    name = name
      .toLowerCase()
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  name = name.replace(/\bBank Bank\b/gi, 'Bank').trim();
  return name || trimmed;
}

function readRecentBanks(): PaystackBank[] {
  try {
    const value = JSON.parse(localStorage.getItem(RECENT_BANKS_KEY) ?? '[]');
    return Array.isArray(value)
      ? value.slice(0, 4).map((b: PaystackBank) => ({ ...b, name: cleanBankName(b.name) }))
      : [];
  } catch {
    return [];
  }
}

import { BankLogoBadge } from '@/components/BankLogoBadge';

function BankLogo({ bank, size = 'normal' }: { bank: PaystackBank; size?: 'small' | 'normal' }) {
  const displayName = cleanBankName(bank.name);
  return (
    <BankLogoBadge
      bankName={displayName}
      bankLogo={bank.logoUrl}
      size={size === 'small' ? 'sm' : 'md'}
    />
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
        const body = (await response.json().catch(() => null)) as { banks?: PaystackBank[]; message?: string } | null;
        if (!response.ok) throw new Error(body?.message || 'Could not load the bank list');
        return body?.banks ?? [];
      })
      .then(nextBanks => {
        if (!mounted) return;
        const normalized = nextBanks.map(b => ({
          ...b,
          name: cleanBankName(b.name),
          legalName: b.legalName || b.name,
        }));
        // Deduplicate by clean name + code
        const deduped: PaystackBank[] = [];
        const seen = new Set<string>();
        for (const b of normalized) {
          const key = `${b.name.toLowerCase()}-${b.code}`;
          if (!seen.has(key)) {
            seen.add(key);
            deduped.push(b);
          }
        }
        setBanks(deduped);
        setLoading(false);
      })
      .catch(fetchError => {
        if (!mounted) return;
        setError(fetchError instanceof Error ? fetchError.message : 'Could not load the bank list');
        setLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  // Prominent everyday Nigerian financial institutions
  const popularBanks = useMemo(() => {
    const popularNames = ['OPay', 'PalmPay', 'Moniepoint', 'Kuda Bank', 'GTBank', 'Access Bank', 'Zenith Bank', 'UBA', 'First Bank', 'FCMB'];
    const matched: PaystackBank[] = [];
    const seen = new Set<string>();

    for (const name of popularNames) {
      const found = banks.find(b => b.name.toLowerCase() === name.toLowerCase());
      if (found && !seen.has(found.code)) {
        seen.add(found.code);
        matched.push(found);
      }
    }
    return matched;
  }, [banks]);

  const filteredBanks = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return banks;
    return banks.filter(bank =>
      bank.name.toLowerCase().includes(query) ||
      (bank.legalName && bank.legalName.toLowerCase().includes(query)) ||
      bank.code.includes(query)
    );
  }, [banks, search]);

  function chooseBank(bank: PaystackBank) {
    const cleanedBank = { ...bank, name: cleanBankName(bank.name) };
    try {
      sessionStorage.setItem(SELECTED_BANK_KEY, JSON.stringify(cleanedBank));
      const nextRecent = [cleanedBank, ...recentBanks.filter(item => item.code !== bank.code)].slice(0, 4);
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
          <button onClick={() => navigate(returnTo)} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[#EEF1F5]" aria-label="Go back">
            <ChevronLeft className="w-6 h-6 text-[#0f4f5c]" strokeWidth={2.2} />
          </button>
          <span className="text-[17px] font-bold text-[#111]">Select Bank</span>
          <div className="w-9" />
        </div>
        <div className="mt-3 flex items-center gap-3 rounded-xl bg-[#F1F2F7] px-4 h-[52px]">
          <Search className="w-5 h-5 text-[#8D929C]" strokeWidth={2} />
          <input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Search bank name or code (e.g. OPay, GTBank)"
            className="flex-1 bg-transparent outline-none text-[15px] text-[#222] placeholder:text-[#8D929C]"
            autoFocus
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-8" style={{ scrollbarWidth: 'none' }}>
        {recentBanks.length > 0 && !search && (
          <section className="pt-3">
            <h2 className="text-[13px] font-bold uppercase tracking-wider text-[#888] mb-3">Recent</h2>
            <div className="grid grid-cols-4 gap-2">
              {recentBanks.map(bank => (
                <button
                  key={`recent-${bank.code}`}
                  onClick={() => chooseBank(bank)}
                  className="min-w-0 flex flex-col items-center gap-2 p-2 rounded-xl bg-white border-0 outline-none ring-0 hover:bg-slate-50 transition-colors shadow-2xs"
                >
                  <BankLogo bank={bank} size="small" />
                  <span className="w-full truncate text-center text-[11px] font-semibold text-[#222]">{bank.name}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {!search && popularBanks.length > 0 && (
          <section className="pt-5">
            <h2 className="text-[13px] font-bold uppercase tracking-wider text-[#888] mb-3">Popular Banks</h2>
            <div className="grid grid-cols-5 gap-2">
              {popularBanks.map(bank => (
                <button
                  key={`pop-${bank.code}`}
                  onClick={() => chooseBank(bank)}
                  className="min-w-0 flex flex-col items-center gap-1.5 p-2 rounded-xl bg-white border-0 outline-none ring-0 hover:bg-slate-50 transition-colors shadow-2xs"
                >
                  <BankLogo bank={bank} size="small" />
                  <span className="w-full truncate text-center text-[10.5px] font-bold text-[#111]">{bank.name}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="pt-5">
          <h2 className="text-[13px] font-bold uppercase tracking-wider text-[#888] mb-3">
            {search ? `Search Results (${filteredBanks.length})` : 'All Institutions'}
          </h2>
          {loading && <p className="py-8 text-center text-[13px] text-[#888]">Loading banks…</p>}
          {error && <p className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-[12px] text-red-600">{error}</p>}
          {!loading && !error && filteredBanks.length === 0 && (
            <p className="py-8 text-center text-[13px] text-[#888]">No banks found matching "{search}"</p>
          )}
          {!loading && !error && filteredBanks.map(bank => (
            <button
              key={bank.code}
              onClick={() => chooseBank(bank)}
              className="w-full flex items-center gap-3.5 py-3.5 border-0 outline-none ring-0 text-left hover:bg-white/60 px-2 rounded-xl transition-colors"
            >
              <BankLogo bank={bank} />
              <div className="flex-1 min-w-0">
                <p className="truncate text-[15px] font-semibold text-[#111]">{bank.name}</p>
                {bank.legalName && bank.legalName.toLowerCase() !== bank.name.toLowerCase() && (
                  <p className="truncate text-[11px] text-[#8D929C] mt-0.5">{bank.legalName}</p>
                )}
              </div>
              <ChevronRight className="w-5 h-5 text-[#8D929C] shrink-0" strokeWidth={2} />
            </button>
          ))}
        </section>
      </div>
    </div>
  );
}