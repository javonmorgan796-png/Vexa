import React, { useState, useEffect } from 'react';
import { Route, Switch, Router as WouterRouter, useLocation } from 'wouter';
import {
  Headphones, Bell, Copy, EyeOff, Eye, Clock,
  ArrowLeftRight, PhoneCall, Tablet, Target,
  PiggyBank, BookOpen, FileText, LayoutGrid,
  Trophy, CreditCard, Home, ArrowDown, Settings,
  ArrowUp, ChevronRight, Shield, Fingerprint,
  BellRing, HelpCircle, Info, LogOut, User, Lock,
  MessageCircle, Phone, Mail, ExternalLink, Star, ChevronDown,
} from 'lucide-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import SignInPage from '@/pages/auth/SignInPage';
import SignUpPage from '@/pages/auth/SignUpPage';
import ProfilePage from '@/pages/settings/ProfilePage';
import LimitsPage from '@/pages/settings/LimitsPage';
import ChangePinPage from '@/pages/settings/ChangePinPage';
import ChangePasswordPage from '@/pages/settings/ChangePasswordPage';

const queryClient = new QueryClient();

/* ─── Splash / Loading screen ───────────────────────────────────────── */
function SplashScreen({ onDone }: { onDone: () => void }) {
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    // Start fade-out after 2.2s, call onDone after fade completes
    const fadeTimer = setTimeout(() => setFadeOut(true), 6800);
    const doneTimer = setTimeout(() => onDone(), 7400);
    return () => { clearTimeout(fadeTimer); clearTimeout(doneTimer); };
  }, [onDone]);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{
        backgroundColor: '#021029',
        transition: 'opacity 0.6s ease',
        opacity: fadeOut ? 0 : 1,
        pointerEvents: fadeOut ? 'none' : 'auto',
      }}
    >
      <style>{`
        @keyframes vexaPulse {
          0%   { transform: scale(0.82); opacity: 0; }
          40%  { transform: scale(1.06); opacity: 1; }
          60%  { transform: scale(0.97); opacity: 1; }
          80%  { transform: scale(1.03); opacity: 1; }
          100% { transform: scale(1);   opacity: 1; }
        }
        @keyframes vexaGlow {
          0%, 100% { filter: drop-shadow(0 0 0px #00c6ff); }
          50%       { filter: drop-shadow(0 0 22px #00c6ff) drop-shadow(0 0 40px #0072ff88); }
        }
        @keyframes vexaShimmer {
          0%   { background-position: -200% center; }
          100% { background-position:  200% center; }
        }
        .vexa-logo {
          animation: vexaPulse 1s cubic-bezier(.22,.61,.36,1) forwards,
                     vexaGlow   2s ease-in-out 0.8s infinite;
        }
        .vexa-tagline {
          animation: vexaPulse 1s cubic-bezier(.22,.61,.36,1) 0.3s both;
          background: linear-gradient(90deg, #ffffff 0%, #00c6ff 40%, #ffffff 60%, #ffffff 100%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: vexaPulse 1s cubic-bezier(.22,.61,.36,1) 0.3s both,
                     vexaShimmer 1.8s linear 1s infinite;
        }
      `}</style>

      <div className="flex flex-col items-center gap-5">
        <img
          src="/vexa-logo.png"
          alt="Vexa"
          className="vexa-logo w-[320px]"
        />
      </div>
    </div>
  );
}

/* ─── tiny SVG icons that exactly match the screenshot ──────────────── */

/** Transfer: two diagonal crossing arrows (↗ ↙) */
function IconTransfer({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 16L17 6" /><path d="M7 6h10v10" />
      <path d="M17 18L7 18" /><path d="M17 14v4" />
    </svg>
  );
}

/** Savings: small safe / cash‑box icon */
function IconSavings({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="12" cy="12" r="3" />
      <line x1="12" y1="3" x2="12" y2="5" />
    </svg>
  );
}

/** Statement: document with lines */
function IconStatement({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="2" width="14" height="20" rx="2" />
      <line x1="9" y1="8" x2="15" y2="8" />
      <line x1="9" y1="12" x2="15" y2="12" />
      <line x1="9" y1="16" x2="13" y2="16" />
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────────────── */

const services = [
  { label: 'Transfer',  Icon: ArrowLeftRight },
  { label: 'Airtime',   Icon: PhoneCall       },
  { label: 'Data',      Icon: Tablet          },
  { label: 'Betting',   Icon: Target          },
  { label: 'Savings',   Icon: PiggyBank       },
  { label: 'Education', Icon: BookOpen        },
  { label: 'Statement', Icon: FileText        },
  { label: 'More',      Icon: LayoutGrid      },
];

function MoniepointHome() {
  const [balanceHidden, setBalanceHidden] = useState(false);
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const initials = (user?.name ?? 'C').split(' ').map((p: string) => p[0]).slice(0, 2).join('').toUpperCase();
  const displayName = user?.name ?? 'Chibuzor Emmanuel Dike';
  const accountNumber = user?.accountNumber ?? '9067212032';
  return (
    <div className="fixed inset-0 bg-[#F2F3F5]">
      <div
        className="w-full h-full bg-[#F2F3F5] flex flex-col relative overflow-hidden"
        style={{ fontFamily: "'Inter', sans-serif" }}
      >

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex-none flex justify-between items-center px-4 pb-2.5 bg-white border-b border-[#E8EBF0]" style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}>
          <div className="flex items-center gap-2.5">
            {/* avatar */}
            <div className="w-10 h-10 rounded-full bg-[#3A3530] flex items-center justify-center text-white text-[15px] font-bold shrink-0">
              {initials}
            </div>
            {/* dynamic greeting */}
            <span className="text-[13px] font-semibold text-[#444]">
              {(() => {
                const h = new Date().getHours();
                if (h < 12) return 'Good Morning ☀️';
                if (h < 17) return 'Good Afternoon 🌤️';
                return 'Good Evening 🌙';
              })()}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Headphones className="w-6 h-6 text-[#222]" strokeWidth={1.75} />
            <div className="relative">
              <Bell className="w-6 h-6 text-[#222]" strokeWidth={1.75} />
              {/* red notification dot */}
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full border border-white" />
            </div>
          </div>
        </div>

        {/* ── Scrollable body ─────────────────────────────────────────── */}
        <div
          className="flex-1 overflow-y-auto pb-[76px]"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >

          {/* ── Account card ────────────────────────────────────────── */}
          {/* mx 12px, mt 12px, rounded-2xl (20px), p-5 */}
          <div className="mx-3 mt-3 bg-[#162353] rounded-[20px] px-4 py-3 text-white">

            {/* account number row */}
            <div className="flex items-center gap-1.5 text-[12px] font-normal text-white mb-2">
              <span>{accountNumber} | {displayName}</span>
              <Copy className="w-3.5 h-3.5 text-white/60 shrink-0" />
            </div>

            {/* balance */}
            <div className="flex items-center gap-2.5 mb-0.5">
              <span className="text-[22px] font-bold tracking-tight leading-none">
                {balanceHidden ? '* * * * *' : '₦73,000.00'}
              </span>
              <button onClick={() => setBalanceHidden(v => !v)} className="focus:outline-none">
                {balanceHidden
                  ? <Eye className="w-[18px] h-[18px] text-white/60 mt-0.5" strokeWidth={2} />
                  : <EyeOff className="w-[18px] h-[18px] text-white/60 mt-0.5" strokeWidth={2} />
                }
              </button>
            </div>

            {/* last updated */}
            <p className="text-[11px] text-white font-normal mb-3">
              Last updated 4 minutes ago
            </p>

            {/* action buttons — content-width pills, left-aligned */}
            <div className="flex gap-3">
              <button onClick={() => navigate('/deposit')} className="bg-[#1E3A6E] rounded-full h-[30px] px-4 flex items-center gap-1.5 text-[11px] font-semibold text-white">
                <span className="text-[14px] leading-none font-light">+</span>
                Deposit
              </button>
              <button onClick={() => navigate('/history')} className="bg-[#1E3A6E] rounded-full h-[30px] px-4 flex items-center gap-1.5 text-[11px] font-semibold text-white">
                <Clock className="w-3 h-3" strokeWidth={2} />
                History
              </button>
            </div>
          </div>

          {/* ── Services ─────────────────────────────────────────────── */}
          {/* mt 16px, px 16px */}
          <div className="px-4 mt-4">
            <div className="flex justify-between items-center mb-2.5">
              <span className="text-[12px] font-semibold text-[#111]">Services</span>
              <button className="text-[#2563EB] text-[11px] font-semibold">Edit</button>
            </div>

            {/* grid: 4 cols, gap 8px; tile h ~85px */}
            <div className="grid grid-cols-4 gap-2">
              {services.map(({ label, Icon }) => {
                const routes: Record<string,string> = {
                  Transfer:'/transfer', Airtime:'/airtime', Data:'/data',
                  Betting:'/betting', Savings:'/savings', Education:'/education',
                  Statement:'/statement', More:'/more',
                };
                return (
                  <button
                    key={label}
                    onClick={() => navigate(routes[label] ?? '/')}
                    className="bg-white rounded-xl py-3.5 px-1 flex flex-col items-center justify-center gap-2 border border-[#F0F0F0] active:bg-[#F2F3F5]"
                  >
                    <Icon className="text-[#1a1a1a]" size={22} strokeWidth={1.75} />
                    <span className="text-[11px] font-medium text-[#333] text-center leading-tight">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Rewards ──────────────────────────────────────────────── */}
          {/* mt 16px, px 16px */}
          <div className="px-4 mt-4">
            <span className="text-[14px] font-semibold text-[#111] block mb-2.5">Rewards</span>

            <div className="grid grid-cols-2 gap-2">
              {/* Cashback */}
              <div className="bg-white rounded-xl p-3.5 border border-[#F0F0F0] flex items-center gap-3">
                {/* coins image: ~36×36 */}
                <div className="w-9 h-9 shrink-0 flex items-center justify-center text-[26px] leading-none select-none">
                  🪙
                </div>
                <div>
                  <div className="text-[11px] font-medium text-[#888] mb-0.5">Cashback</div>
                  <div className="text-[14px] font-bold text-[#111]">₦0.00</div>
                </div>
              </div>
              {/* Referrals */}
              <div className="bg-white rounded-xl p-3.5 border border-[#F0F0F0] flex items-center gap-3">
                <div className="w-9 h-9 shrink-0 flex items-center justify-center text-[26px] leading-none select-none">
                  📣
                </div>
                <div>
                  <div className="text-[11px] font-medium text-[#888] mb-0.5">Referrals</div>
                  <div className="text-[14px] font-bold text-[#111]">₦0.00</div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Recent transactions ──────────────────────────────────── */}
          {/* mt 16px, px 16px */}
          <div className="px-4 mt-4">
            <div className="flex justify-between items-center mb-2.5">
              <span className="text-[12px] font-semibold text-[#111]">Recent transactions</span>
              <button onClick={() => navigate('/history')} className="text-[#2563EB] text-[11px] font-semibold">View All</button>
            </div>

            <div className="bg-white rounded-xl p-4 border border-[#F0F0F0] flex items-center justify-between">
              {/* left: icon + name + date */}
              <div className="flex items-center gap-3">
                {/* blue circle ~36px with down arrow */}
                <div className="w-9 h-9 rounded-full bg-[#EBF2FF] flex items-center justify-center shrink-0">
                  <ArrowDown className="w-4 h-4 text-[#2563EB]" strokeWidth={2.5} />
                </div>
                <div>
                  <div className="text-[13px] font-semibold text-[#111] leading-snug">
                    Chibuzor Emmanuel Dike
                  </div>
                  <div className="text-[11px] text-[#888] font-normal mt-0.5">14 Jul, 06:39 PM</div>
                </div>
              </div>
              {/* right: amount */}
              <span className="text-[13px] font-bold text-[#16A34A]">+₦1,000.00</span>
            </div>
          </div>

          {/* ── Do more with Moniepoint ───────────────────────────────── */}
          {/* mt 16px, px 16px */}
          <div className="px-4 mt-4 mb-4">
            <span className="text-[12px] font-normal text-[#888] block mb-2">
              Do more with Moniepoint
            </span>

            {/* banner card: light lavender bg #F0EFFF, rounded-xl */}
            <div className="bg-[#F0EFFF] rounded-xl p-4 flex items-center justify-between overflow-hidden">
              <div className="flex-1 pr-4">
                <div className="text-[14px] font-bold text-[#111] mb-1 leading-snug">
                  Earn big with MonieWorld
                </div>
                <div className="text-[11px] text-[#555] leading-relaxed font-normal">
                  Refer your UK friends and earn ₦10,000<br />
                  when they send at least £100.
                </div>
              </div>
              {/* illustration: green banknotes with UK flag */}
              <div className="w-[80px] h-[65px] shrink-0 relative">
                {/* stacked green notes */}
                <svg viewBox="0 0 80 65" width="80" height="65" xmlns="http://www.w3.org/2000/svg">
                  {/* bottom note - lighter */}
                  <rect x="8" y="24" width="62" height="36" rx="4" fill="#2E8B57" transform="rotate(-8 39 42)"/>
                  {/* middle note */}
                  <rect x="8" y="20" width="62" height="36" rx="4" fill="#3CB371" transform="rotate(-3 39 38)"/>
                  {/* top note */}
                  <rect x="8" y="16" width="62" height="36" rx="4" fill="#4CAF50"/>
                  {/* note lines */}
                  <rect x="14" y="22" width="20" height="2" rx="1" fill="rgba(255,255,255,0.4)"/>
                  <rect x="14" y="27" width="36" height="1.5" rx="0.75" fill="rgba(255,255,255,0.25)"/>
                  <rect x="14" y="31" width="28" height="1.5" rx="0.75" fill="rgba(255,255,255,0.25)"/>
                  <circle cx="55" cy="28" r="8" fill="rgba(255,255,255,0.15)"/>
                  {/* UK flag - small envelope / flag overlay at top-right */}
                  <rect x="48" y="2" width="28" height="18" rx="3" fill="#012169"/>
                  <line x1="48" y1="2" x2="76" y2="20" stroke="white" strokeWidth="2.5"/>
                  <line x1="76" y1="2" x2="48" y2="20" stroke="white" strokeWidth="2.5"/>
                  <line x1="48" y1="11" x2="76" y2="11" stroke="white" strokeWidth="3"/>
                  <line x1="62" y1="2" x2="62" y2="20" stroke="white" strokeWidth="3"/>
                  <line x1="48" y1="2" x2="76" y2="20" stroke="#C8102E" strokeWidth="1.5"/>
                  <line x1="76" y1="2" x2="48" y2="20" stroke="#C8102E" strokeWidth="1.5"/>
                  <line x1="48" y1="11" x2="76" y2="11" stroke="#C8102E" strokeWidth="2"/>
                  <line x1="62" y1="2" x2="62" y2="20" stroke="#C8102E" strokeWidth="2"/>
                </svg>
              </div>
            </div>
          </div>

        </div>

        {/* ── Bottom tab bar ───────────────────────────────────────────── */}
        {/* height ~56px + ~20px iOS home indicator = 76px total padding-bottom */}
        <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-[#E8EBF0] pt-2.5 pb-5 z-20">
          <div className="flex justify-around items-center px-4">
            {/* Home – active */}
            <button className="flex flex-col items-center gap-1 min-w-[56px]">
              <Home className="w-6 h-6 text-[#2563EB]" strokeWidth={2} />
              <span className="text-[11px] font-semibold text-[#2563EB]">Home</span>
            </button>
            {/* Card */}
            <button onClick={() => navigate('/card')} className="flex flex-col items-center gap-1 min-w-[56px]">
              <CreditCard className="w-6 h-6 text-[#9CA3AF]" strokeWidth={1.75} />
              <span className="text-[11px] font-medium text-[#9CA3AF]">Card</span>
            </button>
            {/* Services */}
            <button onClick={() => navigate('/services')} className="flex flex-col items-center gap-1 min-w-[56px]">
              <LayoutGrid className="w-6 h-6 text-[#9CA3AF]" strokeWidth={1.75} />
              <span className="text-[11px] font-medium text-[#9CA3AF]">Services</span>
            </button>
            {/* Settings */}
            <button onClick={() => navigate('/settings')} className="flex flex-col items-center gap-1 min-w-[56px]">
              <Settings className="w-6 h-6 text-[#9CA3AF]" strokeWidth={1.75} />
              <span className="text-[11px] font-medium text-[#9CA3AF]">Settings</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

/* ─── History Page ───────────────────────────────────────────────────── */
const ALL_TRANSACTIONS = [
  { id: 1, type: 'in',  name: 'Chibuzor Emmanuel Dike', date: '17 Jul, 09:12 AM', amount: '1,000.00',  note: 'Salary' },
  { id: 2, type: 'out', name: 'Ada Okonkwo',             date: '16 Jul, 07:44 PM', amount: '5,500.00',  note: 'Transfer' },
  { id: 3, type: 'out', name: 'Emeka Nwosu',             date: '15 Jul, 02:30 PM', amount: '2,000.00',  note: 'Data subscription' },
  { id: 4, type: 'in',  name: 'Tunde Bakare',            date: '14 Jul, 06:39 PM', amount: '10,000.00', note: 'Payment received' },
  { id: 5, type: 'out', name: 'MTN Nigeria',             date: '13 Jul, 11:05 AM', amount: '500.00',    note: 'Airtime' },
  { id: 6, type: 'in',  name: 'Vexa Cashback',           date: '12 Jul, 08:00 AM', amount: '150.00',    note: 'Cashback reward' },
  { id: 7, type: 'out', name: 'Bet9ja',                  date: '11 Jul, 04:22 PM', amount: '3,000.00',  note: 'Betting' },
  { id: 8, type: 'in',  name: 'Oluwaseun Adeyemi',       date: '10 Jul, 01:17 PM', amount: '7,500.00',  note: 'Refund' },
  { id: 9, type: 'out', name: 'EKEDC',                   date: '09 Jul, 10:00 AM', amount: '4,200.00',  note: 'Electricity bill' },
  { id: 10,type: 'in',  name: 'Freelance Client',        date: '08 Jul, 05:50 PM', amount: '25,000.00', note: 'Design payment' },
];

type TxFilter = 'all' | 'in' | 'out';

function HistoryPage() {
  const [, navigate] = useLocation();
  const [filter, setFilter] = useState<TxFilter>('all');
  const [search, setSearch] = useState('');

  const filtered = ALL_TRANSACTIONS.filter(tx => {
    const matchFilter = filter === 'all' || tx.type === filter;
    const matchSearch = tx.name.toLowerCase().includes(search.toLowerCase()) || tx.note.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  return (
    <div className="fixed inset-0 bg-[#F2F3F5] flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div className="flex-none bg-white border-b border-[#E8EBF0]" style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}>
        <div className="flex items-center gap-3 px-4 pb-3">
          <button onClick={() => navigate('/')} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          </button>
          <span className="text-[16px] font-bold text-[#111]">Transaction History</span>
        </div>

        {/* Search */}
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2 bg-[#F2F3F5] rounded-xl px-3 py-2.5">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" placeholder="Search transactions…" value={search} onChange={e => setSearch(e.target.value)}
              className="flex-1 text-[13px] text-[#111] outline-none bg-transparent placeholder:text-[#9CA3AF]" />
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 px-4 pb-3">
          {(['all','in','out'] as TxFilter[]).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-full text-[12px] font-semibold transition-all ${filter === f ? 'bg-[#162353] text-white' : 'bg-[#F2F3F5] text-[#555]'}`}>
              {f === 'all' ? 'All' : f === 'in' ? 'Money In' : 'Money Out'}
            </button>
          ))}
        </div>
      </div>

      {/* Transaction list */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2" style={{ scrollbarWidth: 'none' }}>
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-[#888]">
            <Clock className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-[13px]">No transactions found</p>
          </div>
        )}
        {filtered.map(tx => (
          <div key={tx.id} className="bg-white rounded-2xl px-4 py-3.5 border border-[#F0F0F0] flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${tx.type === 'in' ? 'bg-[#DCFCE7]' : 'bg-[#FEE2E2]'}`}>
              {tx.type === 'in'
                ? <ArrowDown className="w-4 h-4 text-[#16A34A]" strokeWidth={2.5} />
                : <ArrowUp   className="w-4 h-4 text-[#DC2626]" strokeWidth={2.5} />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-[#111] truncate">{tx.name}</p>
              <p className="text-[11px] text-[#888] mt-0.5">{tx.note} · {tx.date}</p>
            </div>
            <span className={`text-[13px] font-bold shrink-0 ${tx.type === 'in' ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>
              {tx.type === 'in' ? '+' : '-'}₦{tx.amount}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Settings Page ──────────────────────────────────────────────────── */
type SettingsSection = { heading: string; items: { icon: React.ReactNode; label: string; sub?: string; danger?: boolean; action?: () => void }[] };

function SettingsPage() {
  const [, navigate] = useLocation();
  const { user, signOut } = useAuth();
  const [biometrics, setBiometrics] = useState(true);
  const [notifs, setNotifs] = useState(true);

  const userName = user?.name ?? 'Chibuzor Emmanuel Dike';
  const accountNumber = user?.accountNumber ?? '9067212032';
  const levelLabel = user ? `Level ${user.level} · ${user.verified ? 'Verified' : 'Unverified'}` : 'Level 3 · Verified';
  const initials = userName.split(' ').map((p: string) => p[0]).slice(0, 2).join('').toUpperCase();

  const sections: SettingsSection[] = [
    {
      heading: 'Account',
      items: [
        { icon: <User className="w-5 h-5" />,   label: 'Profile',               sub: userName,    action: () => navigate('/profile') },
        { icon: <Shield className="w-5 h-5" />, label: 'Limits & Verification', sub: levelLabel,  action: () => navigate('/limits') },
      ],
    },
    {
      heading: 'Security',
      items: [
        { icon: <Lock className="w-5 h-5" />,        label: 'Change Transaction PIN', action: () => navigate('/change-pin') },
        { icon: <Fingerprint className="w-5 h-5" />, label: 'Biometric Login',   sub: biometrics ? 'On' : 'Off' },
        { icon: <Lock className="w-5 h-5" />,        label: 'Change Password',        action: () => navigate('/change-password') },
      ],
    },
    {
      heading: 'Preferences',
      items: [
        { icon: <BellRing className="w-5 h-5" />, label: 'Notifications', sub: notifs ? 'Enabled' : 'Disabled' },
      ],
    },
    {
      heading: 'Support',
      items: [
        { icon: <HelpCircle className="w-5 h-5" />, label: 'Help & Support', action: () => navigate('/help-support') },
        { icon: <Info className="w-5 h-5" />,        label: 'About Vexa',   sub: 'Version 1.0.0', action: () => navigate('/about-vexa') },
      ],
    },
    {
      heading: '',
      items: [
        { icon: <LogOut className="w-5 h-5" />, label: 'Log Out', danger: true, action: () => { signOut(); navigate('/signin'); } },
      ],
    },
  ];

  return (
    <div className="fixed inset-0 bg-[#F2F3F5] flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div className="flex-none flex items-center gap-3 px-4 pb-3 bg-white border-b border-[#E8EBF0]"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}>
        <button onClick={() => navigate('/')} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <span className="text-[16px] font-bold text-[#111]">Settings</span>
      </div>

      <div className="flex-1 overflow-y-auto py-4 px-4 space-y-4" style={{ scrollbarWidth: 'none' }}>

        {/* Profile hero card */}
        <div className="bg-[#162353] rounded-2xl px-5 py-4 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-[#3A3530] flex items-center justify-center text-white text-[20px] font-bold shrink-0">{initials}</div>
          <div>
            <p className="text-white font-bold text-[15px]">{userName}</p>
            <p className="text-white/60 text-[12px] mt-0.5">{accountNumber} · Vexa Bank</p>
            {user?.verified && <span className="inline-block mt-1.5 bg-white/20 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">✓ Verified</span>}
          </div>
        </div>

        {/* Settings sections */}
        {sections.map((section, si) => (
          <div key={si}>
            {section.heading && <p className="text-[11px] font-semibold text-[#888] uppercase tracking-wide mb-2 px-1">{section.heading}</p>}
            <div className="bg-white rounded-2xl border border-[#F0F0F0] overflow-hidden">
              {section.items.map((item, ii) => {
                const isBio  = item.label === 'Biometric Login';
                const isNot  = item.label === 'Notifications';
                return (
                  <button key={ii}
                    onClick={() => {
                      if (isBio) setBiometrics(v => !v);
                      else if (isNot) setNotifs(v => !v);
                      else if (item.action) item.action();
                    }}
                    className={`w-full flex items-center gap-3.5 px-4 py-4 text-left transition-colors hover:bg-[#F8F9FB] ${ii < section.items.length - 1 ? 'border-b border-[#F5F5F5]' : ''}`}
                  >
                    <span className={item.danger ? 'text-red-500' : 'text-[#555]'}>{item.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-[14px] font-semibold ${item.danger ? 'text-red-500' : 'text-[#111]'}`}>{item.label}</p>
                      {item.sub && <p className="text-[11px] text-[#888] mt-0.5 truncate">{item.sub}</p>}
                    </div>
                    {(isBio || isNot) ? (
                      <div className={`w-11 h-6 rounded-full transition-colors relative ${(isBio ? biometrics : notifs) ? 'bg-[#162353]' : 'bg-[#D1D5DB]'}`}>
                        <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${(isBio ? biometrics : notifs) ? 'left-5' : 'left-0.5'}`} />
                      </div>
                    ) : !item.danger ? (
                      <ChevronRight className="w-4 h-4 text-[#CBD5E1] shrink-0" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        <p className="text-center text-[11px] text-[#CCC] pb-2">Vexa Bank · v1.0.0</p>
      </div>
    </div>
  );
}

/* ─── Help & Support Page ────────────────────────────────────────────── */
function HelpSupportPage() {
  const [, navigate] = useLocation();
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const faqs = [
    { q: 'How do I transfer money?', a: 'Go to the home screen and tap "Transfer". Enter the recipient\'s account number, select their bank, enter the amount, and confirm with your transaction PIN.' },
    { q: 'What are the transfer limits?', a: 'Level 1 accounts can transfer up to ₦50,000 per day. Level 2 accounts can transfer up to ₦200,000 per day. Level 3 verified accounts have a ₦5,000,000 daily limit.' },
    { q: 'How do I buy airtime or data?', a: 'From the home screen, tap "Airtime" or "Data", select your network provider, enter the phone number and amount, then confirm the purchase.' },
    { q: 'I forgot my passcode. What do I do?', a: 'On the Sign In screen, tap "Forgot Passcode?" and follow the steps to reset it using your registered phone number and OTP verification.' },
    { q: 'How do I upgrade my account level?', a: 'Go to Settings → Limits & Verification. You will find the requirements for upgrading to higher account levels, including BVN and ID verification.' },
    { q: 'Is my money safe with Vexa?', a: 'Yes. Vexa uses 256-bit encryption and multi-factor authentication to keep your account secure. All deposits are protected by the NDIC insurance scheme.' },
  ];

  return (
    <div className="fixed inset-0 bg-[#F2F3F5] flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div className="flex-none flex items-center gap-3 px-4 pb-3 bg-white border-b border-[#E8EBF0]"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}>
        <button onClick={() => navigate('/settings')} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <span className="text-[16px] font-bold text-[#111]">Help & Support</span>
      </div>

      <div className="flex-1 overflow-y-auto py-4 px-4 space-y-4" style={{ scrollbarWidth: 'none' }}>

        {/* Contact options */}
        <div className="bg-[#162353] rounded-2xl px-5 py-5">
          <p className="text-white font-bold text-[15px] mb-1">Need help?</p>
          <p className="text-white/60 text-[12px] mb-4">Our support team is available 24/7 to assist you.</p>
          <div className="flex gap-3">
            <button className="flex-1 bg-white/15 rounded-xl py-3 flex flex-col items-center gap-1.5 active:bg-white/25 transition-colors">
              <Phone className="w-5 h-5 text-white" />
              <span className="text-[11px] font-semibold text-white">Call Us</span>
            </button>
            <button className="flex-1 bg-white/15 rounded-xl py-3 flex flex-col items-center gap-1.5 active:bg-white/25 transition-colors">
              <MessageCircle className="w-5 h-5 text-white" />
              <span className="text-[11px] font-semibold text-white">Live Chat</span>
            </button>
            <button className="flex-1 bg-white/15 rounded-xl py-3 flex flex-col items-center gap-1.5 active:bg-white/25 transition-colors">
              <Mail className="w-5 h-5 text-white" />
              <span className="text-[11px] font-semibold text-white">Email Us</span>
            </button>
          </div>
        </div>

        {/* Contact details */}
        <div>
          <p className="text-[11px] font-semibold text-[#888] uppercase tracking-wide mb-2 px-1">Contact Details</p>
          <div className="bg-white rounded-2xl border border-[#F0F0F0] overflow-hidden">
            {[
              { icon: <Phone className="w-5 h-5" />, label: 'Phone Support', sub: '+234 800 839 2600' },
              { icon: <Mail className="w-5 h-5" />, label: 'Email Support', sub: 'support@vexa.com' },
              { icon: <MessageCircle className="w-5 h-5" />, label: 'WhatsApp', sub: '+234 800 839 2600' },
            ].map((item, i, arr) => (
              <div key={i} className={`flex items-center gap-3.5 px-4 py-4 ${i < arr.length - 1 ? 'border-b border-[#F5F5F5]' : ''}`}>
                <span className="text-[#555]">{item.icon}</span>
                <div className="flex-1">
                  <p className="text-[14px] font-semibold text-[#111]">{item.label}</p>
                  <p className="text-[12px] text-[#888] mt-0.5">{item.sub}</p>
                </div>
                <ExternalLink className="w-4 h-4 text-[#CBD5E1]" />
              </div>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div>
          <p className="text-[11px] font-semibold text-[#888] uppercase tracking-wide mb-2 px-1">Frequently Asked Questions</p>
          <div className="bg-white rounded-2xl border border-[#F0F0F0] overflow-hidden">
            {faqs.map((faq, i) => (
              <div key={i} className={i < faqs.length - 1 ? 'border-b border-[#F5F5F5]' : ''}>
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center gap-3.5 px-4 py-4 text-left hover:bg-[#F8F9FB] transition-colors"
                >
                  <div className="flex-1">
                    <p className="text-[13px] font-semibold text-[#111]">{faq.q}</p>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-[#CBD5E1] shrink-0 transition-transform ${openFaq === i ? 'rotate-180' : ''}`} />
                </button>
                {openFaq === i && (
                  <div className="px-4 pb-4">
                    <p className="text-[13px] text-[#666] leading-relaxed">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <p className="text-center text-[11px] text-[#CCC] pb-2">Response time: usually within 5 minutes</p>
      </div>
    </div>
  );
}

/* ─── About Vexa Page ────────────────────────────────────────────────── */
function AboutVexaPage() {
  const [, navigate] = useLocation();

  const features = [
    { icon: <Shield className="w-5 h-5" />, title: 'Bank-grade Security', desc: '256-bit encryption and biometric authentication protect your account.' },
    { icon: <Star className="w-5 h-5" />, title: 'Instant Transfers', desc: 'Send money to any Nigerian bank account in seconds, 24/7.' },
    { icon: <PhoneCall className="w-5 h-5" />, title: 'Bills & Payments', desc: 'Airtime, data, electricity, cable TV and more — all in one place.' },
    { icon: <Lock className="w-5 h-5" />, title: 'NDIC Insured', desc: 'Your deposits are insured by the Nigeria Deposit Insurance Corporation.' },
  ];

  const legal = [
    { label: 'Terms of Service', icon: <ExternalLink className="w-4 h-4 text-[#CBD5E1]" /> },
    { label: 'Privacy Policy', icon: <ExternalLink className="w-4 h-4 text-[#CBD5E1]" /> },
    { label: 'Cookie Policy', icon: <ExternalLink className="w-4 h-4 text-[#CBD5E1]" /> },
    { label: 'Licenses', icon: <ExternalLink className="w-4 h-4 text-[#CBD5E1]" /> },
  ];

  return (
    <div className="fixed inset-0 bg-[#F2F3F5] flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div className="flex-none flex items-center gap-3 px-4 pb-3 bg-white border-b border-[#E8EBF0]"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}>
        <button onClick={() => navigate('/settings')} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <span className="text-[16px] font-bold text-[#111]">About Vexa</span>
      </div>

      <div className="flex-1 overflow-y-auto py-4 px-4 space-y-4" style={{ scrollbarWidth: 'none' }}>

        {/* Brand card */}
        <div className="bg-[#162353] rounded-2xl px-5 py-6 flex flex-col items-center text-center">
          <img src="/vexa-logo.png" alt="Vexa" className="h-12 object-contain mb-3" />
          <p className="text-white font-bold text-[18px]">Vexa Bank</p>
          <p className="text-white/60 text-[12px] mt-1">Your money, your way</p>
          <div className="flex items-center gap-2 mt-3">
            <span className="bg-white/20 text-white text-[10px] font-semibold px-2.5 py-1 rounded-full">Version 1.0.0</span>
            <span className="bg-white/20 text-white text-[10px] font-semibold px-2.5 py-1 rounded-full">CBN Licensed</span>
          </div>
        </div>

        {/* About text */}
        <div className="bg-white rounded-2xl border border-[#F0F0F0] px-5 py-5">
          <p className="text-[13px] text-[#555] leading-relaxed">
            Vexa is a modern digital banking platform built to make financial services fast, safe, and accessible to every Nigerian. From instant money transfers to bill payments, we put the power of a full bank in your pocket.
          </p>
          <p className="text-[13px] text-[#555] leading-relaxed mt-3">
            Regulated by the Central Bank of Nigeria (CBN) and insured by the NDIC, Vexa gives you peace of mind alongside a world-class banking experience.
          </p>
        </div>

        {/* Features */}
        <div>
          <p className="text-[11px] font-semibold text-[#888] uppercase tracking-wide mb-2 px-1">Why Vexa</p>
          <div className="bg-white rounded-2xl border border-[#F0F0F0] overflow-hidden">
            {features.map((f, i) => (
              <div key={i} className={`flex items-start gap-3.5 px-4 py-4 ${i < features.length - 1 ? 'border-b border-[#F5F5F5]' : ''}`}>
                <span className="text-[#162353] mt-0.5">{f.icon}</span>
                <div className="flex-1">
                  <p className="text-[14px] font-semibold text-[#111]">{f.title}</p>
                  <p className="text-[12px] text-[#888] mt-0.5 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Legal */}
        <div>
          <p className="text-[11px] font-semibold text-[#888] uppercase tracking-wide mb-2 px-1">Legal</p>
          <div className="bg-white rounded-2xl border border-[#F0F0F0] overflow-hidden">
            {legal.map((item, i) => (
              <button key={i} className={`w-full flex items-center gap-3.5 px-4 py-4 text-left hover:bg-[#F8F9FB] transition-colors ${i < legal.length - 1 ? 'border-b border-[#F5F5F5]' : ''}`}>
                <p className="flex-1 text-[14px] font-semibold text-[#111]">{item.label}</p>
                {item.icon}
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-white rounded-2xl border border-[#F0F0F0] px-5 py-4 text-center">
          <p className="text-[12px] text-[#888]">Registered with CBN · RC 1234567</p>
          <p className="text-[12px] text-[#888] mt-0.5">© 2025 Vexa Financial Services Ltd.</p>
          <p className="text-[11px] text-[#BBB] mt-2">All rights reserved</p>
        </div>

        <p className="text-center text-[11px] text-[#CCC] pb-2">Vexa Bank · v1.0.0</p>
      </div>
    </div>
  );
}

/* ─── Deposit Page ───────────────────────────────────────────────────── */
function DepositPage() {
  const [, navigate] = useLocation();
  const [amount, setAmount] = useState('');

  function handleAmountChange(e: React.ChangeEvent<HTMLInputElement>) {
    // Strip everything except digits and one decimal point
    const raw = e.target.value.replace(/,/g, '').replace(/[^0-9.]/g, '');
    const parts = raw.split('.');
    const intPart = parts[0];
    const decPart = parts.length > 1 ? '.' + parts[1] : '';
    // Add commas to integer part if > 999
    const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    setAmount(formatted + decPart);
  }
  const [copied, setCopied] = useState(false);

  const accountNumber = '9067212032';
  const accountName   = 'Chibuzor Emmanuel Dike';
  const bankName      = 'Vexa Bank';

  function copyAccount() {
    navigator.clipboard.writeText(accountNumber).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 bg-[#F2F3F5] flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* Header */}
      <div
        className="flex-none flex items-center gap-3 px-4 pb-3 bg-white border-b border-[#E8EBF0]"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}
      >
        <button onClick={() => navigate('/')} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
        </button>
        <span className="text-[16px] font-bold text-[#111]">Deposit</span>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-5" style={{ scrollbarWidth: 'none' }}>

        {/* Info banner */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-5 flex items-start gap-2.5">
          <svg className="shrink-0 mt-0.5" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <p className="text-[12px] text-blue-700 leading-relaxed">
            Transfer money to the account below from any bank. Your balance will be credited instantly.
          </p>
        </div>

        {/* Account card */}
        <div className="bg-white rounded-2xl p-5 mb-4 shadow-sm border border-[#F0F0F0]">
          <p className="text-[11px] font-medium text-[#888] mb-3 uppercase tracking-wide">Your Deposit Account</p>

          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[11px] text-[#888] mb-0.5">Bank</p>
              <p className="text-[14px] font-semibold text-[#111]">{bankName}</p>
            </div>
            <img src="/vexa-icon.png" alt="Vexa" className="w-10 h-10 rounded-full object-cover" />
          </div>

          <div className="h-px bg-[#F0F0F0] mb-4" />

          <div className="mb-4">
            <p className="text-[11px] text-[#888] mb-0.5">Account Number</p>
            <div className="flex items-center justify-between">
              <p className="text-[22px] font-bold text-[#111] tracking-widest">{accountNumber}</p>
              <button
                onClick={copyAccount}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all ${copied ? 'bg-green-100 text-green-600' : 'bg-[#EEF2FF] text-[#2563EB]'}`}
              >
                {copied ? (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    Copied!
                  </>
                ) : (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                    Copy
                  </>
                )}
              </button>
            </div>
          </div>

          <div>
            <p className="text-[11px] text-[#888] mb-0.5">Account Name</p>
            <p className="text-[14px] font-semibold text-[#111]">{accountName}</p>
          </div>
        </div>

        {/* Amount input (optional) */}
        <div className="bg-white rounded-2xl p-5 mb-5 shadow-sm border border-[#F0F0F0]">
          <p className="text-[12px] font-semibold text-[#444] mb-3">Enter Amount <span className="text-[#888] font-normal">(optional)</span></p>
          <div className="flex items-center gap-2 border border-[#E0E0E0] rounded-xl px-4 py-3 focus-within:border-[#2563EB] transition-colors">
            <span className="text-[18px] font-bold text-[#444]">₦</span>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={handleAmountChange}
              className="flex-1 text-[18px] font-semibold text-[#111] outline-none bg-transparent placeholder:text-[#CCC]"
            />
          </div>
          <p className="text-[11px] text-[#888] mt-2">Enter a specific amount to share with the sender.</p>
        </div>

        {/* Share button */}
        <button
          onClick={() => {
            const text = `Bank: ${bankName}\nAccount Number: ${accountNumber}\nAccount Name: ${accountName}${amount ? `\nAmount: ₦${amount}` : ''}`;
            if (navigator.share) {
              navigator.share({ title: 'Vexa Bank Account Details', text }).catch(() => {});
            } else {
              navigator.clipboard.writeText(text).catch(() => {});
              alert('Account details copied to clipboard!');
            }
          }}
          className="w-full bg-[#162353] rounded-xl h-[50px] flex items-center justify-center gap-2 text-[14px] font-semibold text-white active:opacity-80 transition-opacity"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
          </svg>
          Share Account Details
        </button>

      </div>
    </div>
  );
}

/* ─── Transfer Page ──────────────────────────────────────────────────── */
const BANKS = [
  'Access Bank', 'First Bank', 'GTBank', 'Zenith Bank', 'UBA',
  'Fidelity Bank', 'Sterling Bank', 'Polaris Bank', 'Kuda Bank',
  'Opay', 'PalmPay', 'Moniepoint MFB', 'Vexa Bank',
];

// Simulated account lookup: known acc numbers → names
const KNOWN_ACCOUNTS: Record<string, string> = {
  '0000000001': 'Ada Okonkwo',
  '0000000002': 'Emeka Nwosu',
  '1234567890': 'Tunde Bakare',
  '9067212032': 'Chibuzor Emmanuel Dike',
};

type TxStep = 'details' | 'amount' | 'pin' | 'success';

function formatAmt(raw: string) {
  const clean = raw.replace(/,/g, '').replace(/[^0-9.]/g, '');
  const [intP, ...rest] = clean.split('.');
  const dec = rest.length ? '.' + rest.join('') : '';
  return intP.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + dec;
}

function TransferPage() {
  const [, navigate] = useLocation();
  const [step, setStep]           = useState<TxStep>('details');
  const [bank, setBank]           = useState('');
  const [showBankList, setShowBankList] = useState(false);
  const [bankSearch, setBankSearch] = useState('');
  const [acctNo, setAcctNo]       = useState('');
  const [resolvedName, setResolvedName] = useState('');
  const [lookingUp, setLookingUp] = useState(false);
  const [amount, setAmount]       = useState('');
  const [narration, setNarration] = useState('');
  const [pin, setPin]             = useState('');
  const [pinError, setPinError]   = useState(false);
  const [processing, setProcessing] = useState(false);

  // Simulate account name lookup when 10-digit acc entered + bank chosen
  useEffect(() => {
    if (acctNo.length === 10 && bank) {
      setLookingUp(true);
      setResolvedName('');
      const t = setTimeout(() => {
        const name = KNOWN_ACCOUNTS[acctNo] ?? 'Account Holder';
        setResolvedName(name);
        setLookingUp(false);
      }, 1200);
      return () => clearTimeout(t);
    }
    setResolvedName('');
    return undefined;
  }, [acctNo, bank]);

  function handlePinKey(k: string) {
    if (pin.length < 4) setPin(p => p + k);
  }
  function handlePinBack() { setPin(p => p.slice(0, -1)); }

  function submitPin() {
    if (pin.length < 4) return;
    setProcessing(true);
    setTimeout(() => {
      setProcessing(false);
      // Accept any 4-digit PIN for demo
      setStep('success');
    }, 1800);
  }

  const filteredBanks = BANKS.filter(b =>
    b.toLowerCase().includes(bankSearch.toLowerCase())
  );

  const amtNum = parseFloat(amount.replace(/,/g, '') || '0');

  // ── Back arrow logic per step
  function goBack() {
    if (step === 'details') navigate('/');
    else if (step === 'amount') setStep('details');
    else if (step === 'pin') setStep('amount');
  }

  /* ── STEP: SUCCESS ─────────────────────────────────── */
  if (step === 'success') {
    return (
      <div className="fixed inset-0 bg-white flex flex-col items-center justify-center px-6" style={{ fontFamily: "'Inter', sans-serif" }}>
        <div className="flex flex-col items-center gap-5 w-full max-w-xs">
          {/* Green check circle */}
          <div className="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <div className="text-center">
            <p className="text-[20px] font-bold text-[#111] mb-1">Transfer Successful</p>
            <p className="text-[13px] text-[#888]">You sent</p>
            <p className="text-[28px] font-extrabold text-[#111] my-1">₦{amount}</p>
            <p className="text-[13px] text-[#555]">to <span className="font-semibold">{resolvedName}</span></p>
            <p className="text-[12px] text-[#888] mt-0.5">{bank} · {acctNo}</p>
          </div>
          {/* Receipt card */}
          <div className="w-full bg-[#F8F9FB] rounded-2xl p-4 text-[12px] text-[#555] space-y-2 border border-[#F0F0F0]">
            {[
              ['Date', new Date().toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })],
              ['Reference', 'VX' + Date.now().toString().slice(-8)],
              ['Narration', narration || 'Transfer'],
              ['Status', '✅ Completed'],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <span className="text-[#888]">{k}</span>
                <span className="font-semibold text-[#111] text-right max-w-[55%]">{v}</span>
              </div>
            ))}
          </div>
          <button
            onClick={() => navigate('/')}
            className="w-full bg-[#162353] rounded-xl h-[50px] text-[14px] font-semibold text-white"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  /* ── STEP: PIN ─────────────────────────────────────── */
  if (step === 'pin') {
    return (
      <div className="fixed inset-0 bg-white flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>
        {/* Header */}
        <div className="flex-none flex items-center gap-3 px-4 pb-3 bg-white border-b border-[#E8EBF0]"
          style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}>
          <button onClick={goBack} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          </button>
          <span className="text-[16px] font-bold text-[#111]">Enter PIN</span>
        </div>

        <div className="flex-1 flex flex-col items-center justify-between px-6 py-8">
          <div className="flex flex-col items-center gap-6 w-full">
            {/* Summary */}
            <div className="bg-[#F8F9FB] rounded-2xl p-4 w-full text-center border border-[#F0F0F0]">
              <p className="text-[12px] text-[#888] mb-1">Sending to {resolvedName}</p>
              <p className="text-[26px] font-extrabold text-[#111]">₦{amount}</p>
              <p className="text-[11px] text-[#888] mt-0.5">{bank}</p>
            </div>

            <p className="text-[13px] text-[#555]">Enter your 4-digit transaction PIN</p>

            {/* PIN dots */}
            <div className="flex gap-5">
              {[0,1,2,3].map(i => (
                <div key={i} className={`w-4 h-4 rounded-full border-2 transition-all ${i < pin.length ? 'bg-[#162353] border-[#162353]' : 'border-[#CBD5E1] bg-transparent'}`} />
              ))}
            </div>
            {pinError && <p className="text-[12px] text-red-500 -mt-2">Incorrect PIN. Please try again.</p>}
          </div>

          {/* Keypad */}
          <div className="w-full max-w-xs">
            <div className="grid grid-cols-3 gap-3 mb-4">
              {['1','2','3','4','5','6','7','8','9'].map(k => (
                <button key={k} onClick={() => handlePinKey(k)}
                  className="h-14 rounded-2xl bg-[#F2F3F5] text-[20px] font-semibold text-[#111] active:bg-[#E2E5EA] transition-colors">
                  {k}
                </button>
              ))}
              <div />
              <button onClick={() => handlePinKey('0')}
                className="h-14 rounded-2xl bg-[#F2F3F5] text-[20px] font-semibold text-[#111] active:bg-[#E2E5EA] transition-colors">
                0
              </button>
              <button onClick={handlePinBack}
                className="h-14 rounded-2xl bg-[#F2F3F5] flex items-center justify-center active:bg-[#E2E5EA] transition-colors">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12H9M15 6l-6 6 6 6"/>
                </svg>
              </button>
            </div>
            <button
              onClick={submitPin}
              disabled={pin.length < 4 || processing}
              className={`w-full h-[50px] rounded-xl text-[14px] font-semibold text-white transition-all ${pin.length === 4 && !processing ? 'bg-[#162353] active:opacity-80' : 'bg-[#162353]/40'}`}
            >
              {processing ? 'Processing…' : 'Confirm Transfer'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── STEP: AMOUNT ──────────────────────────────────── */
  if (step === 'amount') {
    return (
      <div className="fixed inset-0 bg-[#F2F3F5] flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>
        <div className="flex-none flex items-center gap-3 px-4 pb-3 bg-white border-b border-[#E8EBF0]"
          style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}>
          <button onClick={goBack} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          </button>
          <span className="text-[16px] font-bold text-[#111]">Transfer</span>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4" style={{ scrollbarWidth: 'none' }}>

          {/* Recipient summary */}
          <div className="bg-white rounded-2xl px-5 py-4 border border-[#F0F0F0] flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#EEF2FF] flex items-center justify-center text-[#2563EB] font-bold text-[15px] shrink-0">
              {resolvedName.charAt(0)}
            </div>
            <div>
              <p className="text-[14px] font-semibold text-[#111]">{resolvedName}</p>
              <p className="text-[11px] text-[#888]">{acctNo} · {bank}</p>
            </div>
          </div>

          {/* Amount */}
          <div className="bg-white rounded-2xl p-5 border border-[#F0F0F0]">
            <p className="text-[12px] font-semibold text-[#444] mb-3">Amount</p>
            <div className="flex items-center gap-2 border border-[#E0E0E0] rounded-xl px-4 py-3 focus-within:border-[#2563EB] transition-colors">
              <span className="text-[20px] font-bold text-[#444]">₦</span>
              <input
                type="text" inputMode="decimal" placeholder="0.00"
                value={amount} onChange={e => setAmount(formatAmt(e.target.value))}
                className="flex-1 text-[20px] font-semibold text-[#111] outline-none bg-transparent placeholder:text-[#CCC]"
                autoFocus
              />
            </div>
            {/* Quick amount pills */}
            <div className="flex gap-2 mt-3 flex-wrap">
              {['1,000','5,000','10,000','20,000','50,000'].map(q => (
                <button key={q} onClick={() => setAmount(q)}
                  className={`px-3 py-1 rounded-full text-[11px] font-semibold border transition-all ${amount === q ? 'bg-[#162353] text-white border-[#162353]' : 'border-[#E0E0E0] text-[#444] bg-white'}`}>
                  ₦{q}
                </button>
              ))}
            </div>
          </div>

          {/* Narration */}
          <div className="bg-white rounded-2xl p-5 border border-[#F0F0F0]">
            <p className="text-[12px] font-semibold text-[#444] mb-3">Narration <span className="text-[#888] font-normal">(optional)</span></p>
            <input
              type="text" placeholder="e.g. School fees, Rent…"
              value={narration} onChange={e => setNarration(e.target.value)}
              maxLength={50}
              className="w-full border border-[#E0E0E0] rounded-xl px-4 py-3 text-[14px] text-[#111] outline-none focus:border-[#2563EB] transition-colors placeholder:text-[#CCC]"
            />
          </div>

          {/* Fee note */}
          <p className="text-[11px] text-[#888] text-center">
            Transaction fee: <span className="font-semibold text-[#555]">₦10.75</span> — waived for Vexa-to-Vexa transfers
          </p>

        </div>

        <div className="flex-none px-4 pb-6 pt-2 bg-[#F2F3F5]">
          <button
            onClick={() => { if (amtNum > 0) setStep('pin'); }}
            disabled={amtNum <= 0}
            className={`w-full h-[50px] rounded-xl text-[14px] font-semibold text-white transition-all ${amtNum > 0 ? 'bg-[#162353] active:opacity-80' : 'bg-[#162353]/40'}`}
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  /* ── STEP: DETAILS ─────────────────────────────────── */
  return (
    <div className="fixed inset-0 bg-[#F2F3F5] flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div className="flex-none flex items-center gap-3 px-4 pb-3 bg-white border-b border-[#E8EBF0]"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}>
        <button onClick={goBack} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <span className="text-[16px] font-bold text-[#111]">Transfer</span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4" style={{ scrollbarWidth: 'none' }}>

        {/* Bank picker */}
        <div className="bg-white rounded-2xl p-5 border border-[#F0F0F0]">
          <p className="text-[12px] font-semibold text-[#444] mb-3">Select Bank</p>
          <button
            onClick={() => setShowBankList(v => !v)}
            className="w-full flex items-center justify-between border border-[#E0E0E0] rounded-xl px-4 py-3 focus:border-[#2563EB] transition-colors"
          >
            <span className={`text-[14px] ${bank ? 'text-[#111] font-semibold' : 'text-[#CCC]'}`}>
              {bank || 'Choose bank…'}
            </span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points={showBankList ? '18 15 12 9 6 15' : '6 9 12 15 18 9'}/>
            </svg>
          </button>

          {showBankList && (
            <div className="mt-2 border border-[#E0E0E0] rounded-xl overflow-hidden">
              <div className="px-3 py-2 border-b border-[#F0F0F0]">
                <input
                  type="text" placeholder="Search bank…"
                  value={bankSearch} onChange={e => setBankSearch(e.target.value)}
                  className="w-full text-[13px] outline-none placeholder:text-[#CCC]"
                  autoFocus
                />
              </div>
              <div className="max-h-[180px] overflow-y-auto">
                {filteredBanks.map(b => (
                  <button key={b} onClick={() => { setBank(b); setShowBankList(false); setBankSearch(''); }}
                    className={`w-full text-left px-4 py-3 text-[13px] hover:bg-[#F8F9FB] transition-colors border-b border-[#F8F9FB] last:border-0 ${bank === b ? 'font-semibold text-[#162353]' : 'text-[#333]'}`}>
                    {b}
                  </button>
                ))}
                {filteredBanks.length === 0 && (
                  <p className="px-4 py-3 text-[12px] text-[#888]">No banks found</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Account number */}
        <div className="bg-white rounded-2xl p-5 border border-[#F0F0F0]">
          <p className="text-[12px] font-semibold text-[#444] mb-3">Account Number</p>
          <input
            type="text" inputMode="numeric" placeholder="10-digit account number"
            value={acctNo}
            onChange={e => setAcctNo(e.target.value.replace(/\D/g, '').slice(0, 10))}
            className="w-full border border-[#E0E0E0] rounded-xl px-4 py-3 text-[16px] font-semibold tracking-widest text-[#111] outline-none focus:border-[#2563EB] transition-colors placeholder:text-[#CCC] placeholder:tracking-normal placeholder:font-normal"
          />

          {/* Resolved name */}
          <div className="mt-3 min-h-[28px] flex items-center">
            {lookingUp && (
              <div className="flex items-center gap-2 text-[12px] text-[#888]">
                <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2.5"><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeOpacity=".3"/><path d="M21 12a9 9 0 00-9-9"/></svg>
                Looking up account…
              </div>
            )}
            {!lookingUp && resolvedName && (
              <div className="flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                <span className="text-[13px] font-semibold text-[#16A34A]">{resolvedName}</span>
              </div>
            )}
          </div>
        </div>

        {/* Recent recipients */}
        <div className="bg-white rounded-2xl p-5 border border-[#F0F0F0]">
          <p className="text-[12px] font-semibold text-[#444] mb-3">Recent Recipients</p>
          <div className="space-y-3">
            {[
              { name: 'Ada Okonkwo',  acct: '0000000001', bank: 'Zenith Bank'  },
              { name: 'Emeka Nwosu',  acct: '0000000002', bank: 'GTBank'       },
              { name: 'Tunde Bakare', acct: '1234567890', bank: 'Access Bank'  },
            ].map(r => (
              <button key={r.acct} onClick={() => { setBank(r.bank); setAcctNo(r.acct); setResolvedName(r.name); }}
                className="w-full flex items-center gap-3 hover:bg-[#F8F9FB] rounded-xl p-2 -mx-2 transition-colors">
                <div className="w-9 h-9 rounded-full bg-[#EEF2FF] flex items-center justify-center text-[#2563EB] font-bold text-[13px] shrink-0">
                  {r.name.charAt(0)}
                </div>
                <div className="text-left">
                  <p className="text-[13px] font-semibold text-[#111]">{r.name}</p>
                  <p className="text-[11px] text-[#888]">{r.acct} · {r.bank}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

      </div>

      <div className="flex-none px-4 pb-6 pt-2 bg-[#F2F3F5]">
        <button
          onClick={() => { if (bank && resolvedName) setStep('amount'); }}
          disabled={!bank || !resolvedName}
          className={`w-full h-[50px] rounded-xl text-[14px] font-semibold text-white transition-all ${bank && resolvedName ? 'bg-[#162353] active:opacity-80' : 'bg-[#162353]/40'}`}
        >
          Continue
        </button>
      </div>
    </div>
  );
}

/* ─── Shared helpers ────────────────────────────────────────────────── */
function PageShell({ title, back, children }: { title: string; back: string; children: React.ReactNode }) {
  const [, navigate] = useLocation();
  return (
    <div className="fixed inset-0 bg-[#F2F3F5] flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="flex-none flex items-center gap-3 px-4 pb-3 bg-white border-b border-[#E8EBF0]"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}>
        <button onClick={() => navigate(back)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <span className="text-[16px] font-bold text-[#111]">{title}</span>
      </div>
      {children}
    </div>
  );
}

function PinModal({ amount, label, onSuccess, onClose }: { amount: string; label: string; onSuccess: () => void; onClose: () => void }) {
  const [pin, setPin] = useState('');
  const [processing, setProcessing] = useState(false);
  function submit() {
    if (pin.length < 4) return;
    setProcessing(true);
    setTimeout(() => { setProcessing(false); onSuccess(); }, 1500);
  }
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
      <div className="bg-white w-full rounded-t-3xl px-6 pt-6 pb-8">
        <div className="flex items-center justify-between mb-5">
          <p className="text-[16px] font-bold text-[#111]">Confirm with PIN</p>
          <button onClick={onClose} className="text-[#888]">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="bg-[#F8F9FB] rounded-xl p-3 text-center mb-5">
          <p className="text-[11px] text-[#888]">{label}</p>
          <p className="text-[22px] font-extrabold text-[#111]">₦{amount}</p>
        </div>
        <div className="flex justify-center gap-5 mb-6">
          {[0,1,2,3].map(i => (
            <div key={i} className={`w-4 h-4 rounded-full border-2 transition-all ${i < pin.length ? 'bg-[#162353] border-[#162353]' : 'border-[#CBD5E1]'}`} />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-3 mb-4">
          {['1','2','3','4','5','6','7','8','9'].map(k => (
            <button key={k} onClick={() => pin.length < 4 && setPin(p => p + k)}
              className="h-13 py-3.5 rounded-2xl bg-[#F2F3F5] text-[20px] font-semibold text-[#111] active:bg-[#E2E5EA]">{k}</button>
          ))}
          <div />
          <button onClick={() => pin.length < 4 && setPin(p => p + '0')}
            className="h-13 py-3.5 rounded-2xl bg-[#F2F3F5] text-[20px] font-semibold text-[#111] active:bg-[#E2E5EA]">0</button>
          <button onClick={() => setPin(p => p.slice(0, -1))}
            className="h-13 py-3.5 rounded-2xl bg-[#F2F3F5] flex items-center justify-center active:bg-[#E2E5EA]">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12H9M15 6l-6 6 6 6"/></svg>
          </button>
        </div>
        <button onClick={submit} disabled={pin.length < 4 || processing}
          className={`w-full h-[50px] rounded-xl text-[14px] font-semibold text-white ${pin.length === 4 && !processing ? 'bg-[#162353]' : 'bg-[#162353]/40'}`}>
          {processing ? 'Processing…' : 'Pay Now'}
        </button>
      </div>
    </div>
  );
}

function SuccessBanner({ title, sub, onHome }: { title: string; sub: string; onHome: () => void }) {
  return (
    <div className="fixed inset-0 bg-white flex flex-col items-center justify-center px-6" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center mb-5">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <p className="text-[20px] font-bold text-[#111] mb-1">{title}</p>
      <p className="text-[13px] text-[#888] text-center mb-8">{sub}</p>
      <button onClick={onHome} className="w-full max-w-xs bg-[#162353] rounded-xl h-[50px] text-[14px] font-semibold text-white">Back to Home</button>
    </div>
  );
}

/* ─── Airtime Page ───────────────────────────────────────────────────── */
const NETWORKS = [
  { id: 'mtn',    name: 'MTN',     color: '#FFD700', text: '#000' },
  { id: 'airtel', name: 'Airtel',  color: '#DC2626', text: '#fff' },
  { id: 'glo',    name: 'Glo',     color: '#16A34A', text: '#fff' },
  { id: '9mobile',name: '9mobile', color: '#1D7F3E', text: '#fff' },
];
const AIRTIME_AMOUNTS = ['100','200','500','1,000','2,000','5,000'];

function AirtimePage() {
  const [, navigate] = useLocation();
  const [network, setNetwork] = useState('');
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [done, setDone] = useState(false);

  if (done) return <SuccessBanner title="Airtime Purchased!" sub={`₦${amount} airtime sent to ${phone}`} onHome={() => navigate('/')} />;

  const canProceed = network && phone.length >= 10 && amount;

  return (
    <PageShell title="Buy Airtime" back="/">
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4" style={{ scrollbarWidth: 'none' }}>
        {/* Network */}
        <div className="bg-white rounded-2xl p-5 border border-[#F0F0F0]">
          <p className="text-[12px] font-semibold text-[#444] mb-3">Select Network</p>
          <div className="grid grid-cols-4 gap-2">
            {NETWORKS.map(n => (
              <button key={n.id} onClick={() => setNetwork(n.id)}
                className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 transition-all ${network === n.id ? 'border-[#162353]' : 'border-[#F0F0F0]'}`}>
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-black" style={{ background: n.color, color: n.text }}>{n.name.slice(0,3)}</div>
                <span className="text-[10px] text-[#555] font-medium">{n.name}</span>
              </button>
            ))}
          </div>
        </div>
        {/* Phone */}
        <div className="bg-white rounded-2xl p-5 border border-[#F0F0F0]">
          <p className="text-[12px] font-semibold text-[#444] mb-3">Phone Number</p>
          <input type="tel" inputMode="tel" placeholder="08012345678" value={phone}
            onChange={e => setPhone(e.target.value.replace(/\D/g,'').slice(0,11))}
            className="w-full border border-[#E0E0E0] rounded-xl px-4 py-3 text-[16px] font-semibold tracking-wider outline-none focus:border-[#2563EB] transition-colors placeholder:text-[#CCC] placeholder:font-normal placeholder:tracking-normal" />
        </div>
        {/* Amount */}
        <div className="bg-white rounded-2xl p-5 border border-[#F0F0F0]">
          <p className="text-[12px] font-semibold text-[#444] mb-3">Amount</p>
          <div className="flex items-center gap-2 border border-[#E0E0E0] rounded-xl px-4 py-3 focus-within:border-[#2563EB] mb-3">
            <span className="text-[18px] font-bold text-[#444]">₦</span>
            <input type="text" inputMode="numeric" placeholder="0" value={amount}
              onChange={e => setAmount(formatAmt(e.target.value))}
              className="flex-1 text-[18px] font-semibold text-[#111] outline-none bg-transparent placeholder:text-[#CCC]" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            {AIRTIME_AMOUNTS.map(a => (
              <button key={a} onClick={() => setAmount(a)}
                className={`py-2 rounded-xl text-[12px] font-semibold border transition-all ${amount===a ? 'bg-[#162353] text-white border-[#162353]' : 'border-[#E0E0E0] text-[#444]'}`}>
                ₦{a}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="flex-none px-4 pb-6 pt-2">
        <button onClick={() => canProceed && setShowPin(true)} disabled={!canProceed}
          className={`w-full h-[50px] rounded-xl text-[14px] font-semibold text-white ${canProceed ? 'bg-[#162353]' : 'bg-[#162353]/40'}`}>
          Continue
        </button>
      </div>
      {showPin && <PinModal amount={amount} label={`Airtime for ${phone}`} onSuccess={() => { setShowPin(false); setDone(true); }} onClose={() => setShowPin(false)} />}
    </PageShell>
  );
}

/* ─── Data Page ──────────────────────────────────────────────────────── */
const DATA_PLANS: Record<string, {size:string; price:string; validity:string}[]> = {
  mtn:    [{size:'100MB',price:'100',validity:'1 day'},{size:'500MB',price:'300',validity:'7 days'},{size:'1GB',price:'500',validity:'30 days'},{size:'2GB',price:'1,000',validity:'30 days'},{size:'5GB',price:'2,000',validity:'30 days'},{size:'10GB',price:'3,000',validity:'30 days'}],
  airtel: [{size:'150MB',price:'100',validity:'1 day'},{size:'750MB',price:'300',validity:'7 days'},{size:'1.5GB',price:'500',validity:'30 days'},{size:'3GB',price:'1,000',validity:'30 days'},{size:'6GB',price:'2,000',validity:'30 days'},{size:'15GB',price:'3,500',validity:'30 days'}],
  glo:    [{size:'200MB',price:'100',validity:'1 day'},{size:'1GB',price:'300',validity:'7 days'},{size:'2GB',price:'500',validity:'30 days'},{size:'5GB',price:'1,000',validity:'30 days'},{size:'10GB',price:'2,000',validity:'30 days'},{size:'20GB',price:'4,000',validity:'30 days'}],
  '9mobile':[{size:'50MB',price:'50',validity:'1 day'},{size:'500MB',price:'200',validity:'7 days'},{size:'1GB',price:'400',validity:'30 days'},{size:'2.5GB',price:'1,000',validity:'30 days'},{size:'5GB',price:'2,000',validity:'30 days'},{size:'11.5GB',price:'3,000',validity:'30 days'}],
};

function DataPage() {
  const [, navigate] = useLocation();
  const [network, setNetwork] = useState('');
  const [phone, setPhone]     = useState('');
  const [plan, setPlan]       = useState('');
  const [showPin, setShowPin] = useState(false);
  const [done, setDone]       = useState(false);

  if (done) return <SuccessBanner title="Data Activated!" sub={`${plan} sent to ${phone}`} onHome={() => navigate('/')} />;

  const plans = network ? DATA_PLANS[network] : [];
  const selectedPlan = plans.find(p => p.size === plan);
  const canProceed = network && phone.length >= 10 && plan;

  return (
    <PageShell title="Buy Data" back="/">
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4" style={{ scrollbarWidth: 'none' }}>
        <div className="bg-white rounded-2xl p-5 border border-[#F0F0F0]">
          <p className="text-[12px] font-semibold text-[#444] mb-3">Select Network</p>
          <div className="grid grid-cols-4 gap-2">
            {NETWORKS.map(n => (
              <button key={n.id} onClick={() => { setNetwork(n.id); setPlan(''); }}
                className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 transition-all ${network===n.id ? 'border-[#162353]' : 'border-[#F0F0F0]'}`}>
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-black" style={{ background: n.color, color: n.text }}>{n.name.slice(0,3)}</div>
                <span className="text-[10px] text-[#555] font-medium">{n.name}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-[#F0F0F0]">
          <p className="text-[12px] font-semibold text-[#444] mb-3">Phone Number</p>
          <input type="tel" inputMode="tel" placeholder="08012345678" value={phone}
            onChange={e => setPhone(e.target.value.replace(/\D/g,'').slice(0,11))}
            className="w-full border border-[#E0E0E0] rounded-xl px-4 py-3 text-[16px] font-semibold tracking-wider outline-none focus:border-[#2563EB] transition-colors placeholder:text-[#CCC] placeholder:font-normal placeholder:tracking-normal" />
        </div>
        {network && (
          <div className="bg-white rounded-2xl p-5 border border-[#F0F0F0]">
            <p className="text-[12px] font-semibold text-[#444] mb-3">Select Plan</p>
            <div className="space-y-2">
              {plans.map(p => (
                <button key={p.size} onClick={() => setPlan(p.size)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all ${plan===p.size ? 'border-[#162353] bg-[#EEF2FF]' : 'border-[#F0F0F0]'}`}>
                  <div className="text-left">
                    <p className="text-[14px] font-bold text-[#111]">{p.size}</p>
                    <p className="text-[11px] text-[#888]">Valid for {p.validity}</p>
                  </div>
                  <p className="text-[14px] font-bold text-[#162353]">₦{p.price}</p>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="flex-none px-4 pb-6 pt-2">
        <button onClick={() => canProceed && setShowPin(true)} disabled={!canProceed}
          className={`w-full h-[50px] rounded-xl text-[14px] font-semibold text-white ${canProceed ? 'bg-[#162353]' : 'bg-[#162353]/40'}`}>
          Continue
        </button>
      </div>
      {showPin && selectedPlan && (
        <PinModal amount={selectedPlan.price} label={`${plan} data for ${phone}`}
          onSuccess={() => { setShowPin(false); setDone(true); }} onClose={() => setShowPin(false)} />
      )}
    </PageShell>
  );
}

/* ─── Betting Page ───────────────────────────────────────────────────── */
const BETTING_PLATFORMS = [
  { id:'bet9ja',   name:'Bet9ja',    color:'#006400' },
  { id:'sporty',   name:'SportyBet', color:'#1D4ED8' },
  { id:'betking',  name:'BetKing',   color:'#7C3AED' },
  { id:'1xbet',    name:'1xBet',     color:'#EF4444' },
  { id:'nairabet', name:'NairaBet',  color:'#F59E0B' },
  { id:'msport',   name:'MSport',    color:'#0EA5E9'  },
];

function BettingPage() {
  const [, navigate] = useLocation();
  const [platform, setPlatform] = useState('');
  const [userId, setUserId]     = useState('');
  const [amount, setAmount]     = useState('');
  const [showPin, setShowPin]   = useState(false);
  const [done, setDone]         = useState(false);

  if (done) return <SuccessBanner title="Wallet Funded!" sub={`₦${amount} added to ${platform} account ${userId}`} onHome={() => navigate('/')} />;

  const canProceed = platform && userId && parseFloat(amount.replace(/,/g,'')) > 0;

  return (
    <PageShell title="Betting" back="/">
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4" style={{ scrollbarWidth: 'none' }}>
        <div className="bg-white rounded-2xl p-5 border border-[#F0F0F0]">
          <p className="text-[12px] font-semibold text-[#444] mb-3">Select Platform</p>
          <div className="grid grid-cols-3 gap-2">
            {BETTING_PLATFORMS.map(b => (
              <button key={b.id} onClick={() => setPlatform(b.name)}
                className={`py-3 rounded-xl border-2 text-[12px] font-bold transition-all ${platform===b.name ? 'border-[#162353]' : 'border-[#F0F0F0]'}`}
                style={{ color: b.color }}>
                {b.name}
              </button>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-[#F0F0F0]">
          <p className="text-[12px] font-semibold text-[#444] mb-3">User ID / Username</p>
          <input type="text" placeholder="Enter your betting user ID" value={userId}
            onChange={e => setUserId(e.target.value)}
            className="w-full border border-[#E0E0E0] rounded-xl px-4 py-3 text-[14px] outline-none focus:border-[#2563EB] transition-colors placeholder:text-[#CCC]" />
        </div>
        <div className="bg-white rounded-2xl p-5 border border-[#F0F0F0]">
          <p className="text-[12px] font-semibold text-[#444] mb-3">Amount</p>
          <div className="flex items-center gap-2 border border-[#E0E0E0] rounded-xl px-4 py-3 focus-within:border-[#2563EB] mb-3">
            <span className="text-[18px] font-bold text-[#444]">₦</span>
            <input type="text" inputMode="numeric" placeholder="0.00" value={amount}
              onChange={e => setAmount(formatAmt(e.target.value))}
              className="flex-1 text-[18px] font-semibold text-[#111] outline-none bg-transparent placeholder:text-[#CCC]" />
          </div>
          <div className="flex gap-2 flex-wrap">
            {['500','1,000','2,000','5,000','10,000'].map(a => (
              <button key={a} onClick={() => setAmount(a)}
                className={`px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-all ${amount===a ? 'bg-[#162353] text-white border-[#162353]' : 'border-[#E0E0E0] text-[#444]'}`}>
                ₦{a}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="flex-none px-4 pb-6 pt-2">
        <button onClick={() => canProceed && setShowPin(true)} disabled={!canProceed}
          className={`w-full h-[50px] rounded-xl text-[14px] font-semibold text-white ${canProceed ? 'bg-[#162353]' : 'bg-[#162353]/40'}`}>
          Fund Wallet
        </button>
      </div>
      {showPin && <PinModal amount={amount} label={`Fund ${platform} · ${userId}`} onSuccess={() => { setShowPin(false); setDone(true); }} onClose={() => setShowPin(false)} />}
    </PageShell>
  );
}

/* ─── Savings Page ───────────────────────────────────────────────────── */
const SAVINGS_GOALS = [
  { name: 'Emergency Fund', target: '200,000', saved: '45,000',  pct: 22, emoji: '🛡️' },
  { name: 'New Laptop',     target: '350,000', saved: '120,000', pct: 34, emoji: '💻' },
];

function SavingsPage() {
  const [, navigate] = useLocation();
  const [showCreate, setShowCreate] = useState(false);
  const [goalName, setGoalName]     = useState('');
  const [goalAmt, setGoalAmt]       = useState('');
  const [frequency, setFreq]        = useState('Weekly');
  const [created, setCreated]       = useState(false);

  if (created) return <SuccessBanner title="Savings Goal Created!" sub={`You're saving ₦${goalAmt} towards ${goalName}`} onHome={() => navigate('/')} />;

  return (
    <PageShell title="Savings" back="/">
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4" style={{ scrollbarWidth: 'none' }}>
        {/* Total saved */}
        <div className="bg-[#162353] rounded-2xl px-5 py-4 text-white">
          <p className="text-[12px] text-white/60 mb-1">Total Saved</p>
          <p className="text-[28px] font-extrabold">₦165,000.00</p>
          <p className="text-[11px] text-white/60 mt-1">Across {SAVINGS_GOALS.length} goals</p>
        </div>
        {/* Goals */}
        {SAVINGS_GOALS.map(g => (
          <div key={g.name} className="bg-white rounded-2xl p-5 border border-[#F0F0F0]">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">{g.emoji}</span>
              <div className="flex-1">
                <p className="text-[14px] font-semibold text-[#111]">{g.name}</p>
                <p className="text-[11px] text-[#888]">₦{g.saved} of ₦{g.target}</p>
              </div>
              <span className="text-[13px] font-bold text-[#162353]">{g.pct}%</span>
            </div>
            <div className="h-2 bg-[#F0F0F0] rounded-full overflow-hidden">
              <div className="h-full bg-[#162353] rounded-full" style={{ width: `${g.pct}%` }} />
            </div>
          </div>
        ))}
        {/* Create new */}
        {showCreate && (
          <div className="bg-white rounded-2xl p-5 border border-[#162353] space-y-3">
            <p className="text-[13px] font-bold text-[#111]">New Savings Goal</p>
            <input type="text" placeholder="Goal name (e.g. Vacation)" value={goalName} onChange={e => setGoalName(e.target.value)}
              className="w-full border border-[#E0E0E0] rounded-xl px-4 py-3 text-[14px] outline-none focus:border-[#2563EB] placeholder:text-[#CCC]" />
            <div className="flex items-center gap-2 border border-[#E0E0E0] rounded-xl px-4 py-3 focus-within:border-[#2563EB]">
              <span className="text-[16px] font-bold text-[#444]">₦</span>
              <input type="text" inputMode="numeric" placeholder="Target amount" value={goalAmt} onChange={e => setGoalAmt(formatAmt(e.target.value))}
                className="flex-1 text-[16px] font-semibold text-[#111] outline-none bg-transparent placeholder:text-[#CCC] placeholder:font-normal" />
            </div>
            <div className="flex gap-2">
              {['Daily','Weekly','Monthly'].map(f => (
                <button key={f} onClick={() => setFreq(f)}
                  className={`flex-1 py-2 rounded-xl text-[12px] font-semibold border transition-all ${frequency===f ? 'bg-[#162353] text-white border-[#162353]' : 'border-[#E0E0E0] text-[#444]'}`}>
                  {f}
                </button>
              ))}
            </div>
            <button onClick={() => goalName && goalAmt && setCreated(true)}
              className="w-full h-[44px] bg-[#162353] rounded-xl text-[14px] font-semibold text-white">
              Create Goal
            </button>
          </div>
        )}
      </div>
      <div className="flex-none px-4 pb-6 pt-2">
        <button onClick={() => setShowCreate(v => !v)}
          className="w-full h-[50px] rounded-xl text-[14px] font-semibold text-white bg-[#162353]">
          {showCreate ? 'Cancel' : '+ Create New Goal'}
        </button>
      </div>
    </PageShell>
  );
}

/* ─── Education Page ─────────────────────────────────────────────────── */
const EDU_TYPES = ['University','Polytechnic','Secondary School','Primary School','Nursery'];
function EducationPage() {
  const [, navigate] = useLocation();
  const [type, setType]       = useState('');
  const [school, setSchool]   = useState('');
  const [studentId, setId]    = useState('');
  const [amount, setAmount]   = useState('');
  const [showPin, setShowPin] = useState(false);
  const [done, setDone]       = useState(false);

  if (done) return <SuccessBanner title="Payment Successful!" sub={`School fees paid for ${studentId} at ${school}`} onHome={() => navigate('/')} />;

  const canProceed = type && school && studentId && parseFloat(amount.replace(/,/g,'')) > 0;

  return (
    <PageShell title="Education" back="/">
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4" style={{ scrollbarWidth: 'none' }}>
        <div className="bg-white rounded-2xl p-5 border border-[#F0F0F0]">
          <p className="text-[12px] font-semibold text-[#444] mb-3">Institution Type</p>
          <div className="space-y-2">
            {EDU_TYPES.map(t => (
              <button key={t} onClick={() => setType(t)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 text-[14px] font-medium transition-all ${type===t ? 'border-[#162353] bg-[#EEF2FF] text-[#162353]' : 'border-[#F0F0F0] text-[#333]'}`}>
                {t}
                {type===t && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
              </button>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-[#F0F0F0] space-y-3">
          <div>
            <p className="text-[12px] font-semibold text-[#444] mb-2">School Name</p>
            <input type="text" placeholder="Enter school / institution name" value={school} onChange={e => setSchool(e.target.value)}
              className="w-full border border-[#E0E0E0] rounded-xl px-4 py-3 text-[14px] outline-none focus:border-[#2563EB] placeholder:text-[#CCC]" />
          </div>
          <div>
            <p className="text-[12px] font-semibold text-[#444] mb-2">Student / Matric No.</p>
            <input type="text" placeholder="e.g. UNI/2021/0042" value={studentId} onChange={e => setId(e.target.value)}
              className="w-full border border-[#E0E0E0] rounded-xl px-4 py-3 text-[14px] outline-none focus:border-[#2563EB] placeholder:text-[#CCC]" />
          </div>
          <div>
            <p className="text-[12px] font-semibold text-[#444] mb-2">Amount</p>
            <div className="flex items-center gap-2 border border-[#E0E0E0] rounded-xl px-4 py-3 focus-within:border-[#2563EB]">
              <span className="text-[18px] font-bold text-[#444]">₦</span>
              <input type="text" inputMode="numeric" placeholder="0.00" value={amount} onChange={e => setAmount(formatAmt(e.target.value))}
                className="flex-1 text-[18px] font-semibold text-[#111] outline-none bg-transparent placeholder:text-[#CCC]" />
            </div>
          </div>
        </div>
      </div>
      <div className="flex-none px-4 pb-6 pt-2">
        <button onClick={() => canProceed && setShowPin(true)} disabled={!canProceed}
          className={`w-full h-[50px] rounded-xl text-[14px] font-semibold text-white ${canProceed ? 'bg-[#162353]' : 'bg-[#162353]/40'}`}>
          Pay School Fees
        </button>
      </div>
      {showPin && <PinModal amount={amount} label={`Fees for ${studentId}`} onSuccess={() => { setShowPin(false); setDone(true); }} onClose={() => setShowPin(false)} />}
    </PageShell>
  );
}

/* ─── Statement Page ─────────────────────────────────────────────────── */
const STMT_PERIODS = ['Last 7 days','Last 30 days','Last 3 months','Last 6 months','Custom'];
function StatementPage() {
  const [, navigate] = useLocation();
  const [period, setPeriod]   = useState('Last 30 days');
  const [format, setFormat]   = useState('PDF');
  const [email, setEmail]     = useState('chibuzor@vexa.com');
  const [generating, setGen]  = useState(false);
  const [done, setDone]       = useState(false);

  function generate() {
    setGen(true);
    setTimeout(() => { setGen(false); setDone(true); }, 2000);
  }

  return (
    <PageShell title="Account Statement" back="/">
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4" style={{ scrollbarWidth: 'none' }}>
        {done && (
          <div className="bg-green-50 border border-green-200 rounded-2xl px-4 py-3 flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            <p className="text-[12px] text-green-700 font-semibold">Statement sent to {email}</p>
          </div>
        )}
        <div className="bg-white rounded-2xl p-5 border border-[#F0F0F0]">
          <p className="text-[12px] font-semibold text-[#444] mb-3">Period</p>
          <div className="space-y-2">
            {STMT_PERIODS.map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 text-[14px] font-medium transition-all ${period===p ? 'border-[#162353] bg-[#EEF2FF] text-[#162353]' : 'border-[#F0F0F0] text-[#333]'}`}>
                {p}
                {period===p && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
              </button>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-[#F0F0F0]">
          <p className="text-[12px] font-semibold text-[#444] mb-3">Format</p>
          <div className="flex gap-2">
            {['PDF','Excel','CSV'].map(f => (
              <button key={f} onClick={() => setFormat(f)}
                className={`flex-1 py-3 rounded-xl text-[13px] font-semibold border-2 transition-all ${format===f ? 'bg-[#162353] text-white border-[#162353]' : 'border-[#E0E0E0] text-[#444]'}`}>
                {f}
              </button>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-[#F0F0F0]">
          <p className="text-[12px] font-semibold text-[#444] mb-2">Send to Email</p>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            className="w-full border border-[#E0E0E0] rounded-xl px-4 py-3 text-[14px] outline-none focus:border-[#2563EB] placeholder:text-[#CCC]" />
        </div>
        {/* Recent statements */}
        <div className="bg-white rounded-2xl p-5 border border-[#F0F0F0]">
          <p className="text-[12px] font-semibold text-[#444] mb-3">Recent Statements</p>
          {[
            { label:'June 2026 Statement', date:'01 Jul 2026', fmt:'PDF' },
            { label:'May 2026 Statement',  date:'01 Jun 2026', fmt:'PDF' },
          ].map(s => (
            <div key={s.label} className="flex items-center justify-between py-3 border-b border-[#F5F5F5] last:border-0">
              <div>
                <p className="text-[13px] font-semibold text-[#111]">{s.label}</p>
                <p className="text-[11px] text-[#888]">Generated {s.date} · {s.fmt}</p>
              </div>
              <button className="text-[#2563EB] text-[12px] font-semibold">Download</button>
            </div>
          ))}
        </div>
      </div>
      <div className="flex-none px-4 pb-6 pt-2">
        <button onClick={generate} disabled={generating}
          className="w-full h-[50px] rounded-xl text-[14px] font-semibold text-white bg-[#162353] disabled:opacity-60">
          {generating ? 'Generating…' : 'Generate Statement'}
        </button>
      </div>
    </PageShell>
  );
}

/* ─── More Services Page ─────────────────────────────────────────────── */
const MORE_SERVICES = [
  { label:'Transfer',  emoji:'↔️',  path:'/transfer'  },
  { label:'Airtime',   emoji:'📱',  path:'/airtime'   },
  { label:'Data',      emoji:'📶',  path:'/data'      },
  { label:'Betting',   emoji:'🎯',  path:'/betting'   },
  { label:'Savings',   emoji:'🐷',  path:'/savings'   },
  { label:'Education', emoji:'📚',  path:'/education' },
  { label:'Statement', emoji:'📄',  path:'/statement' },
  { label:'Deposit',   emoji:'💰',  path:'/deposit'   },
  { label:'History',   emoji:'🕐',  path:'/history'   },
  { label:'Settings',  emoji:'⚙️',  path:'/settings'  },
  { label:'Card',      emoji:'💳',  path:'/card'      },
];

function MorePage() {
  const [, navigate] = useLocation();
  return (
    <PageShell title="All Services" back="/">
      <div className="flex-1 overflow-y-auto px-4 py-5" style={{ scrollbarWidth: 'none' }}>
        <div className="grid grid-cols-4 gap-3">
          {MORE_SERVICES.map(s => (
            <button key={s.label} onClick={() => navigate(s.path)}
              className="bg-white rounded-xl py-4 px-1 flex flex-col items-center justify-center gap-2 border border-[#F0F0F0] active:bg-[#F2F3F5]">
              <span className="text-[26px] leading-none">{s.emoji}</span>
              <span className="text-[10px] font-medium text-[#333] text-center leading-tight">{s.label}</span>
            </button>
          ))}
        </div>
      </div>
    </PageShell>
  );
}

/* ─── Card Page ──────────────────────────────────────────────────────── */
function CardPage() {
  const [, navigate] = useLocation();
  const [frozen, setFrozen]   = useState(false);
  const [showNum, setShowNum] = useState(false);

  return (
    <PageShell title="My Card" back="/">
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4" style={{ scrollbarWidth: 'none' }}>
        {/* Card visual */}
        <div className="rounded-3xl p-5 text-white relative overflow-hidden" style={{ background: 'linear-gradient(135deg,#162353 0%,#1E3A6E 60%,#0a4fa3 100%)', minHeight: 190 }}>
          <div className="flex justify-between items-start mb-8">
            <div>
              <p className="text-[11px] text-white/60 mb-0.5">Virtual Card</p>
              <p className="text-[13px] font-bold">Vexa Bank</p>
            </div>
            <img src="/vexa-icon.png" alt="Vexa" className="w-9 h-9 rounded-full" />
          </div>
          <p className="text-[20px] font-bold tracking-[4px] mb-5">
            {showNum ? '5399 1234 5678 9012' : '•••• •••• •••• 9012'}
          </p>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[10px] text-white/50">CARD HOLDER</p>
              <p className="text-[13px] font-semibold">CHIBUZOR E DIKE</p>
            </div>
            <div>
              <p className="text-[10px] text-white/50">EXPIRES</p>
              <p className="text-[13px] font-semibold">08/29</p>
            </div>
            <div className="flex gap-1">
              <div className="w-8 h-8 rounded-full bg-red-500/80" />
              <div className="w-8 h-8 rounded-full bg-yellow-400/80 -ml-4" />
            </div>
          </div>
          {frozen && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-3xl">
              <div className="text-center">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-1"><path d="M12 2v20M4.93 4.93l14.14 14.14M2 12h20M4.93 19.07l14.14-14.14"/></svg>
                <p className="text-white font-bold text-[13px]">Card Frozen</p>
              </div>
            </div>
          )}
        </div>

        {/* Card actions */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: showNum ? 'Hide Number' : 'Show Number', icon:'👁️', action: () => setShowNum(v=>!v) },
            { label: frozen ? 'Unfreeze' : 'Freeze Card', icon: frozen ? '🔓' : '🧊', action: () => setFrozen(v=>!v) },
            { label:'Change PIN', icon:'🔑', action: () => {} },
          ].map(a => (
            <button key={a.label} onClick={a.action}
              className="bg-white rounded-2xl py-4 flex flex-col items-center gap-2 border border-[#F0F0F0] active:bg-[#F2F3F5]">
              <span className="text-2xl">{a.icon}</span>
              <span className="text-[11px] font-medium text-[#333] text-center leading-tight">{a.label}</span>
            </button>
          ))}
        </div>

        {/* Card details */}
        <div className="bg-white rounded-2xl p-5 border border-[#F0F0F0] space-y-3">
          <p className="text-[12px] font-semibold text-[#444]">Card Details</p>
          {[
            { label:'Card Type',    val:'Mastercard Virtual' },
            { label:'Card Status',  val: frozen ? '❄️ Frozen' : '✅ Active' },
            { label:'Daily Limit',  val:'₦500,000' },
            { label:'Billing Address', val:'Lagos, Nigeria' },
          ].map(d => (
            <div key={d.label} className="flex justify-between text-[13px] py-2 border-b border-[#F5F5F5] last:border-0">
              <span className="text-[#888]">{d.label}</span>
              <span className="font-semibold text-[#111]">{d.val}</span>
            </div>
          ))}
        </div>

        {/* Request physical card */}
        <div className="bg-[#EEF2FF] rounded-2xl p-4 flex items-center justify-between border border-[#C7D7F5]">
          <div>
            <p className="text-[13px] font-bold text-[#162353]">Get a Physical Card</p>
            <p className="text-[11px] text-[#555]">Delivered to you in 3–5 business days</p>
          </div>
          <button className="bg-[#162353] text-white text-[11px] font-semibold px-3 py-2 rounded-xl">Request</button>
        </div>
      </div>
    </PageShell>
  );
}

/* ─── Services Tab Page ──────────────────────────────────────────────── */
const SERVICE_GROUPS = [
  { heading:'Payments', items:[
    { label:'Transfer',  emoji:'↔️',  path:'/transfer'  },
    { label:'Deposit',   emoji:'💰',  path:'/deposit'   },
    { label:'History',   emoji:'🕐',  path:'/history'   },
  ]},
  { heading:'Top Up', items:[
    { label:'Airtime',   emoji:'📱',  path:'/airtime'   },
    { label:'Data',      emoji:'📶',  path:'/data'      },
    { label:'Betting',   emoji:'🎯',  path:'/betting'   },
  ]},
  { heading:'Lifestyle', items:[
    { label:'Education', emoji:'📚',  path:'/education' },
    { label:'Savings',   emoji:'🐷',  path:'/savings'   },
  ]},
  { heading:'Account', items:[
    { label:'Statement', emoji:'📄',  path:'/statement' },
    { label:'Card',      emoji:'💳',  path:'/card'      },
    { label:'Settings',  emoji:'⚙️',  path:'/settings'  },
  ]},
];

function ServicesTabPage() {
  const [, navigate] = useLocation();
  return (
    <div className="fixed inset-0 bg-[#F2F3F5] flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="flex-none px-4 pb-3 bg-white border-b border-[#E8EBF0]"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}>
        <p className="text-[18px] font-extrabold text-[#111]">Services</p>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5 pb-24" style={{ scrollbarWidth: 'none' }}>
        {SERVICE_GROUPS.map(g => (
          <div key={g.heading}>
            <p className="text-[11px] font-semibold text-[#888] uppercase tracking-wide mb-2 px-1">{g.heading}</p>
            <div className="grid grid-cols-4 gap-3">
              {g.items.map(s => (
                <button key={s.label} onClick={() => navigate(s.path)}
                  className="bg-white rounded-xl py-4 flex flex-col items-center gap-2 border border-[#F0F0F0] active:bg-[#F2F3F5]">
                  <span className="text-[24px] leading-none">{s.emoji}</span>
                  <span className="text-[10px] font-medium text-[#333] text-center leading-tight">{s.label}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      {/* Bottom tab bar */}
      <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-[#E8EBF0] pt-2.5 pb-5 z-20">
        <div className="flex justify-around items-center px-4">
          <button onClick={() => navigate('/')} className="flex flex-col items-center gap-1 min-w-[56px]">
            <Home className="w-6 h-6 text-[#9CA3AF]" strokeWidth={1.75} />
            <span className="text-[11px] font-medium text-[#9CA3AF]">Home</span>
          </button>
          <button onClick={() => navigate('/card')} className="flex flex-col items-center gap-1 min-w-[56px]">
            <CreditCard className="w-6 h-6 text-[#9CA3AF]" strokeWidth={1.75} />
            <span className="text-[11px] font-medium text-[#9CA3AF]">Card</span>
          </button>
          <button className="flex flex-col items-center gap-1 min-w-[56px]">
            <LayoutGrid className="w-6 h-6 text-[#2563EB]" strokeWidth={2} />
            <span className="text-[11px] font-semibold text-[#2563EB]">Services</span>
          </button>
          <button onClick={() => navigate('/settings')} className="flex flex-col items-center gap-1 min-w-[56px]">
            <Settings className="w-6 h-6 text-[#9CA3AF]" strokeWidth={1.75} />
            <span className="text-[11px] font-medium text-[#9CA3AF]">Settings</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={MoniepointHome} />
      <Route path="/deposit" component={DepositPage} />
      <Route path="/transfer" component={TransferPage} />
      <Route path="/history" component={HistoryPage} />
      <Route path="/settings" component={SettingsPage} />
      <Route path="/airtime" component={AirtimePage} />
      <Route path="/data" component={DataPage} />
      <Route path="/betting" component={BettingPage} />
      <Route path="/savings" component={SavingsPage} />
      <Route path="/education" component={EducationPage} />
      <Route path="/statement" component={StatementPage} />
      <Route path="/more" component={MorePage} />
      <Route path="/card" component={CardPage} />
      <Route path="/services" component={ServicesTabPage} />
      {/* Auth routes */}
      <Route path="/signin" component={SignInPage} />
      <Route path="/signup" component={SignUpPage} />
      {/* Settings sub-pages */}
      <Route path="/profile" component={ProfilePage} />
      <Route path="/limits" component={LimitsPage} />
      <Route path="/change-pin" component={ChangePinPage} />
      <Route path="/change-password" component={ChangePasswordPage} />
      <Route path="/help-support" component={HelpSupportPage} />
      <Route path="/about-vexa" component={AboutVexaPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

/* Handles post-splash redirect — must live inside WouterRouter + AuthProvider */
function AppShell() {
  const [showSplash, setShowSplash] = useState(true);
  const [splashDone, setSplashDone] = useState(false);
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (splashDone && !isAuthenticated) {
      navigate('/signin');
    }
  }, [splashDone, isAuthenticated]);

  return (
    <>
      {showSplash && (
        <SplashScreen onDone={() => {
          setShowSplash(false);
          setSplashDone(true);
        }} />
      )}
      <Router />
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <AppShell />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
