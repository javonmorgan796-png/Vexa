import React, { useState, useEffect } from 'react';
import { Route, Switch, Router as WouterRouter, useLocation } from 'wouter';
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
          className="vexa-logo w-[220px]"
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
              <span>9067212032 | Chibuzor Emmanuel Dike</span>
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
              <span className="text-[12px] font-semibold text-[#111]">Services</span>
              <button className="text-[#2563EB] text-[11px] font-semibold">Edit</button>
            </div>

            {/* grid: 4 cols, gap 8px; tile h ~85px */}
            <div className="grid grid-cols-4 gap-2">
              {services.map(({ label, Icon }) => (
                <button
                  key={label}
                  onClick={() => { if (label === 'Transfer') navigate('/transfer'); }}
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
              <span className="text-[12px] font-semibold text-[#111]">Recent transactions</span>
              <button className="text-[#2563EB] text-[11px] font-semibold">View All</button>
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
        </div>

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
    } else {
      setResolvedName('');
    }
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

function Router() {
  return (
    <Switch>
      <Route path="/" component={MoniepointHome} />
      <Route path="/deposit" component={DepositPage} />
      <Route path="/transfer" component={TransferPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [showSplash, setShowSplash] = useState(true);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        {showSplash && <SplashScreen onDone={() => setShowSplash(false)} />}
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
