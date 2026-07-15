import React, { useState } from 'react';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import {
  Headphones, Bell, Copy, EyeOff, Eye, Clock,
  ArrowLeftRight, PhoneCall, Tablet, Target,
  PiggyBank, BookOpen, FileText, LayoutGrid,
  Trophy, CreditCard, Home, ArrowDown,
} from 'lucide-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();

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
  return (
    <div className="fixed inset-0 bg-[#F2F3F5]">
      <div
        className="w-full h-full bg-[#F2F3F5] flex flex-col relative overflow-hidden"
        style={{ fontFamily: "'Inter', sans-serif" }}
      >

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex-none flex justify-between items-center px-4 pb-2.5 bg-white border-b border-[#E8EBF0]" style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}>
          <div className="flex items-center gap-2.5">
            {/* avatar: 40×40, dark circle, letter C */}
            <div className="w-10 h-10 rounded-full bg-[#3A3530] flex items-center justify-center text-white text-[15px] font-bold shrink-0">
              C
            </div>
            {/* Level 3 tag */}
            <span className="text-[13px] font-semibold text-[#444]">Level 3</span>
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
          <div className="mx-3 mt-3 bg-[#162353] rounded-[20px] p-5 text-white">

            {/* account number row */}
            <div className="flex items-center gap-1.5 text-[12px] font-normal text-white/50 mb-4">
              <span>9067212032 | Chibuzor Emmanuel Dike</span>
              <Copy className="w-3.5 h-3.5 text-white/60 shrink-0" />
            </div>

            {/* balance */}
            <div className="flex items-center gap-2.5 mb-1">
              <span className="text-[22px] font-bold tracking-tight leading-none">
                {balanceHidden ? '* * * * *' : '₦1,000.00'}
              </span>
              <button onClick={() => setBalanceHidden(v => !v)} className="focus:outline-none">
                {balanceHidden
                  ? <Eye className="w-[18px] h-[18px] text-white/60 mt-0.5" strokeWidth={2} />
                  : <EyeOff className="w-[18px] h-[18px] text-white/60 mt-0.5" strokeWidth={2} />
                }
              </button>
            </div>

            {/* last updated */}
            <p className="text-[11px] text-white/50 font-normal mb-5">
              Last updated 4 minutes ago
            </p>

            {/* action buttons — content-width pills, left-aligned */}
            <div className="flex gap-3">
              <button className="bg-[#1E3A6E] rounded-full h-[30px] px-4 flex items-center gap-1.5 text-[11px] font-semibold text-white">
                <span className="text-[14px] leading-none font-light">+</span>
                Add Money
              </button>
              <button className="bg-[#1E3A6E] rounded-full h-[30px] px-4 flex items-center gap-1.5 text-[11px] font-semibold text-white">
                <Clock className="w-3 h-3" strokeWidth={2} />
                History
              </button>
            </div>
          </div>

          {/* ── Services ─────────────────────────────────────────────── */}
          {/* mt 16px, px 16px */}
          <div className="px-4 mt-4">
            <div className="flex justify-between items-center mb-2.5">
              <span className="text-[14px] font-semibold text-[#111]">Services</span>
              <button className="text-[#2563EB] text-[13px] font-semibold">Edit</button>
            </div>

            {/* grid: 4 cols, gap 8px; tile h ~85px */}
            <div className="grid grid-cols-4 gap-2">
              {services.map(({ label, Icon }) => (
                <button
                  key={label}
                  className="bg-white rounded-xl py-3.5 px-1 flex flex-col items-center justify-center gap-2 border border-[#F0F0F0]"
                >
                  {/* icon: plain dark gray, 22px, no circle */}
                  <Icon className="text-[#1a1a1a]" size={22} strokeWidth={1.75} />
                  <span className="text-[11px] font-medium text-[#333] text-center leading-tight">{label}</span>
                </button>
              ))}
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
              <span className="text-[14px] font-semibold text-[#111]">Recent transactions</span>
              <button className="text-[#2563EB] text-[13px] font-semibold">View All</button>
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
            <button className="flex flex-col items-center gap-1 min-w-[56px]">
              <CreditCard className="w-6 h-6 text-[#9CA3AF]" strokeWidth={1.75} />
              <span className="text-[11px] font-medium text-[#9CA3AF]">Card</span>
            </button>
            {/* Services */}
            <button className="flex flex-col items-center gap-1 min-w-[56px]">
              <LayoutGrid className="w-6 h-6 text-[#9CA3AF]" strokeWidth={1.75} />
              <span className="text-[11px] font-medium text-[#9CA3AF]">Services</span>
            </button>
            {/* Rewards */}
            <button className="flex flex-col items-center gap-1 min-w-[56px]">
              <Trophy className="w-6 h-6 text-[#9CA3AF]" strokeWidth={1.75} />
              <span className="text-[11px] font-medium text-[#9CA3AF]">Rewards</span>
            </button>
          </div>
          {/* iOS home indicator */}
          <div className="mt-2 mx-auto w-28 h-[5px] bg-black/20 rounded-full" />
        </div>

      </div>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={MoniepointHome} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
