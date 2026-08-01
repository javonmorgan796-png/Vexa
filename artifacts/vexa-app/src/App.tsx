import React, { useState, useEffect, useRef } from 'react';
import { Route, Switch, Router as WouterRouter, useLocation } from 'wouter';
import {
  Headphones, Bell, Copy, EyeOff, Eye, Clock,
  ArrowLeftRight, PhoneCall, Tablet, Target,
  PiggyBank, BookOpen, FileText, LayoutGrid,
  Trophy, CreditCard, Home, ArrowDown, Settings,
  ArrowUp, ChevronRight, Shield, Fingerprint, BriefcaseBusiness,
  BellRing, HelpCircle, Info, LogOut, User, Lock,
  MessageCircle, Phone, Mail, ExternalLink, Star, ChevronDown,
  Send, X, Bot, CheckCheck, Wifi, Paperclip, ImagePlus, FileUp, FileText as FileIcon,
  Gift, Users, Share2, Percent, TrendingUp, BadgeCheck, ChevronUp,
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
import { BusinessProvider } from '@/context/BusinessContext';
import BusinessDashboard from '@/pages/business/BusinessDashboard';
import BusinessOnboarding from '@/pages/business/BusinessOnboarding';
import BusinessAnalytics from '@/pages/business/BusinessAnalytics';
import BusinessBills from '@/pages/business/BusinessBills';
import BusinessSettings from '@/pages/business/BusinessSettings';
import BusinessTransactionHistory from '@/pages/business/BusinessTransactionHistory';
import BusinessTransfers from '@/pages/business/BusinessTransfers';
import EmployeeManagement from '@/pages/business/EmployeeManagement';
import PayrollManagement from '@/pages/business/PayrollManagement';
import { BusinessSecurityProvider, useBusinessSecurity } from '@/context/BusinessSecurityContext';
import BusinessSecurityScreen from '@/pages/business/BusinessSecurityScreen';

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

/* ─── Promo Banner Carousel ──────────────────────────────────────────── */
const PROMO_BANNERS = [
  {
    id: 'moneyworld',
    bg: '#F0EFFF',
    accent: '#7C3AED',
    badge: '🌍 MoneyWorld',
    title: 'Earn big with MonieWorld',
    body: 'Refer your UK friends and earn ₦10,000 when they send at least £100.',
    cta: 'Refer Now',
    illustration: (
      <svg viewBox="0 0 80 65" width="80" height="65" xmlns="http://www.w3.org/2000/svg">
        <rect x="8" y="24" width="62" height="36" rx="4" fill="#2E8B57" transform="rotate(-8 39 42)"/>
        <rect x="8" y="20" width="62" height="36" rx="4" fill="#3CB371" transform="rotate(-3 39 38)"/>
        <rect x="8" y="16" width="62" height="36" rx="4" fill="#4CAF50"/>
        <rect x="14" y="22" width="20" height="2" rx="1" fill="rgba(255,255,255,0.4)"/>
        <rect x="14" y="27" width="36" height="1.5" rx="0.75" fill="rgba(255,255,255,0.25)"/>
        <rect x="14" y="31" width="28" height="1.5" rx="0.75" fill="rgba(255,255,255,0.25)"/>
        <circle cx="55" cy="28" r="8" fill="rgba(255,255,255,0.15)"/>
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
    ),
  },
  {
    id: 'cashback',
    bg: '#FFF4E6',
    accent: '#EA580C',
    badge: '🔥 Limited Offer',
    title: '5% Cashback on Transfers',
    body: 'Send money to any bank and earn 5% cashback — up to ₦2,500 per transfer this week.',
    cta: 'Transfer Now',
    illustration: (
      <svg viewBox="0 0 80 65" width="80" height="65" xmlns="http://www.w3.org/2000/svg">
        {/* coin stack */}
        <ellipse cx="40" cy="54" rx="26" ry="8" fill="#F59E0B" opacity="0.4"/>
        <rect x="14" y="38" width="52" height="16" rx="8" fill="#F59E0B"/>
        <ellipse cx="40" cy="38" rx="26" ry="8" fill="#FBBF24"/>
        <rect x="14" y="24" width="52" height="16" rx="8" fill="#FBBF24"/>
        <ellipse cx="40" cy="24" rx="26" ry="8" fill="#FCD34D"/>
        <rect x="14" y="12" width="52" height="14" rx="7" fill="#FCD34D"/>
        <ellipse cx="40" cy="12" rx="26" ry="7" fill="#FEF08A"/>
        <text x="40" y="16" textAnchor="middle" fill="#92400E" fontSize="9" fontWeight="bold">₦</text>
        {/* sparkle */}
        <circle cx="66" cy="8" r="4" fill="#EA580C" opacity="0.8"/>
        <text x="66" y="11" textAnchor="middle" fill="white" fontSize="6" fontWeight="bold">%</text>
      </svg>
    ),
  },
  {
    id: 'savings',
    bg: '#E8F5F0',
    accent: '#059669',
    badge: '📈 Up to 15% p.a.',
    title: 'Grow Your Savings Faster',
    body: 'Lock your funds in a Fixed Deposit and earn up to 15% annual interest — guaranteed.',
    cta: 'Start Saving',
    illustration: (
      <svg viewBox="0 0 80 65" width="80" height="65" xmlns="http://www.w3.org/2000/svg">
        {/* bar chart */}
        <rect x="10" y="44" width="12" height="16" rx="3" fill="#34D399" opacity="0.5"/>
        <rect x="26" y="32" width="12" height="28" rx="3" fill="#10B981" opacity="0.7"/>
        <rect x="42" y="20" width="12" height="40" rx="3" fill="#059669"/>
        <rect x="58" y="10" width="12" height="50" rx="3" fill="#047857"/>
        {/* upward trend line */}
        <polyline points="16,44 32,32 48,20 64,10" fill="none" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="64" cy="10" r="4" fill="#F59E0B"/>
        <text x="64" y="7" textAnchor="middle" fill="#92400E" fontSize="6" fontWeight="bold">↑</text>
      </svg>
    ),
  },
];

function PromoBannerCarousel() {
  const [current, setCurrent] = useState(0);
  const [animDir, setAnimDir] = useState<'left'|'right'>('left');
  const [isAnimating, setIsAnimating] = useState(false);
  const touchStart = React.useRef<number | null>(null);
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const goTo = (idx: number, dir: 'left' | 'right') => {
    if (isAnimating) return;
    setAnimDir(dir);
    setIsAnimating(true);
    setTimeout(() => {
      setCurrent(idx);
      setIsAnimating(false);
    }, 280);
  };

  const next = () => goTo((current + 1) % PROMO_BANNERS.length, 'left');
  const prev = () => goTo((current - 1 + PROMO_BANNERS.length) % PROMO_BANNERS.length, 'right');

  // Auto-advance every 4 s
  useEffect(() => {
    timerRef.current = setInterval(next, 4000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [current, isAnimating]);

  const b = PROMO_BANNERS[current];

  const handleTouchStart = (e: React.TouchEvent) => { touchStart.current = e.touches[0].clientX; };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStart.current;
    touchStart.current = null;
    if (dx < -40) next();
    else if (dx > 40) prev();
  };

  return (
    <div className="px-4 mt-4 mb-4">
      <span className="text-[12px] font-normal text-[#888] block mb-2">Do more with Vexa</span>

      {/* Card */}
      <div
        className="rounded-xl p-4 flex items-center justify-between overflow-hidden relative select-none"
        style={{
          background: b.bg,
          opacity: isAnimating ? 0 : 1,
          transform: isAnimating ? (animDir === 'left' ? 'translateX(-8px)' : 'translateX(8px)') : 'translateX(0)',
          transition: 'opacity 0.28s ease, transform 0.28s ease, background 0.3s ease',
        } as React.CSSProperties}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="flex-1 pr-3">
          {/* Badge */}
          <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mb-1.5"
            style={{ background: `${b.accent}18`, color: b.accent }}>
            {b.badge}
          </span>
          <div className="text-[14px] font-bold text-[#111] mb-1 leading-snug">{b.title}</div>
          <div className="text-[11px] text-[#555] leading-relaxed mb-2">{b.body}</div>
          <button className="text-[11px] font-bold px-3 py-1 rounded-lg text-white"
            style={{ background: b.accent }}>
            {b.cta} →
          </button>
        </div>
        {/* Illustration */}
        <div className="w-[80px] h-[65px] shrink-0">{b.illustration}</div>
      </div>

      {/* Dots */}
      <div className="flex justify-center gap-1.5 mt-2.5">
        {PROMO_BANNERS.map((_, i) => (
          <button key={i} onClick={() => goTo(i, i > current ? 'left' : 'right')}
            className="rounded-full transition-all"
            style={{
              width: i === current ? 18 : 6,
              height: 6,
              background: i === current ? PROMO_BANNERS[current].accent : '#D1D5DB',
            }} />
        ))}
      </div>
    </div>
  );
}

/* ─── Passcode Lock Screen (shown on app-return if setting is ON) ──── */
const PASSCODE_RETURN_KEY = 'vexa_passcode_on_return';

/* ── Lock-timestamp helpers (localStorage so full-reload is covered) ── */
const LOCK_HIDDEN_AT_KEY  = 'vexa_lock_hidden_at';   // ms timestamp written on hide
const LOCK_TIMEOUT_MS     = 5 * 60 * 1000;           // 5 minutes

function writeLockTimestamp() {
  localStorage.setItem(LOCK_HIDDEN_AT_KEY, String(Date.now()));
}
function clearLockTimestamp() {
  localStorage.removeItem(LOCK_HIDDEN_AT_KEY);
}
/** Returns true when the stored timestamp is ≥ 5 min old (or missing). */
function shouldLockNow(): boolean {
  const raw = localStorage.getItem(LOCK_HIDDEN_AT_KEY);
  if (!raw) return false;
  return Date.now() - Number(raw) >= LOCK_TIMEOUT_MS;
}

/* ── Passcode Lock Screen ─────────────────────────────────────────────── */
const MAX_LOCK_ATTEMPTS = 5;

function PasscodeLockScreen({ onUnlock, onSignOut }: { onUnlock: () => void; onSignOut: () => void }) {
  const { user, profilePhoto } = useAuth();
  const [pin, setPin]           = useState('');
  const [shake, setShake]       = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [lockedOut, setLockedOut] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // Progressive lockout: 30 s after MAX_LOCK_ATTEMPTS wrong tries
  useEffect(() => {
    if (!lockedOut) return;
    setCountdown(30);
    const id = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { clearInterval(id); setLockedOut(false); setAttempts(0); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [lockedOut]);

  function addDigit(d: string) {
    if (lockedOut || pin.length >= 6) return;
    const next = pin + d;
    setPin(next);
    setErrorMsg('');
    if (next.length === 6) setTimeout(() => verify(next), 80);
  }

  function removeDigit() {
    if (lockedOut) return;
    setPin(p => p.slice(0, -1));
    setErrorMsg('');
  }

  function verify(code: string) {
    if (user && code === user.password) {
      clearLockTimestamp();
      onUnlock();
      return;
    }
    const newAttempts = attempts + 1;
    setAttempts(newAttempts);
    setShake(true);
    setTimeout(() => { setShake(false); setPin(''); }, 500);

    if (newAttempts >= MAX_LOCK_ATTEMPTS) {
      setLockedOut(true);
      setErrorMsg('Too many attempts — locked for 30 s');
    } else {
      setErrorMsg(`Incorrect passcode · ${MAX_LOCK_ATTEMPTS - newAttempts} attempt${MAX_LOCK_ATTEMPTS - newAttempts !== 1 ? 's' : ''} left`);
    }
  }

  const firstName = user?.name?.split(' ')[0] ?? 'there';
  const initials  = (user?.name ?? 'U').split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col"
      style={{ background: 'linear-gradient(170deg,#0b1730 0%,#05101f 60%,#020a18 100%)', fontFamily:"'Inter',sans-serif" }}
    >
      {/* Header area */}
      <div className="flex flex-col items-center pt-16 pb-4 px-6">
        {/* Lock icon */}
        <div className="w-12 h-12 rounded-full flex items-center justify-center mb-5"
          style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.12)' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="5" y="11" width="14" height="10" rx="2"/>
            <path d="M8 11V7a4 4 0 0 1 8 0v4"/>
            <circle cx="12" cy="16" r="1.3" fill="rgba(255,255,255,0.5)"/>
          </svg>
        </div>

        {/* Avatar */}
        <div className="w-[72px] h-[72px] rounded-full border-2 border-white/20 overflow-hidden flex items-center justify-center text-white text-[24px] font-bold mb-3 shrink-0"
          style={{ background:'rgba(255,255,255,0.1)' }}>
          {profilePhoto
            ? <img src={profilePhoto} alt="" className="w-full h-full object-cover" />
            : initials}
        </div>

        <p className="text-white/50 text-[13px] font-medium">Welcome back, {firstName}</p>
        <p className="text-white text-[20px] font-bold mt-1 mb-0.5">Verify it's you</p>
        <p className="text-white/35 text-[12px]">Session locked · enter your login passcode</p>
      </div>

      {/* PIN dots + error */}
      <div className="flex flex-col items-center gap-4 py-4">
        <div
          className="flex gap-4"
          style={{ animation: shake ? 'lockShake 0.45s ease' : 'none' }}
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={`w-[15px] h-[15px] rounded-full border-2 transition-all duration-150 ${
              i < pin.length
                ? 'bg-white border-white shadow-[0_0_8px_rgba(255,255,255,0.5)] scale-110'
                : 'border-white/25 bg-transparent'
            }`} />
          ))}
        </div>

        <div className="h-5">
          {lockedOut ? (
            <p className="text-orange-400 text-[12px] font-medium">
              Locked — try again in <span className="font-bold tabular-nums">{countdown}s</span>
            </p>
          ) : errorMsg ? (
            <p className="text-[#FF6B6B] text-[12px] font-medium">{errorMsg}</p>
          ) : null}
        </div>
      </div>

      {/* Keypad */}
      <div className="flex-1 flex flex-col justify-end pb-10 px-8">
        <div className="grid grid-cols-3 gap-3 mb-3">
          {['1','2','3','4','5','6','7','8','9'].map(k => (
            <button key={k} onClick={() => addDigit(k)} disabled={lockedOut}
              className="h-[62px] rounded-2xl text-[26px] font-semibold text-white transition-all active:scale-95 disabled:opacity-40"
              style={{ background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.1)' }}>
              {k}
            </button>
          ))}

          {/* Bottom row: empty · 0 · backspace */}
          <div />

          <button onClick={() => addDigit('0')} disabled={lockedOut}
            className="h-[62px] rounded-2xl text-[26px] font-semibold text-white transition-all active:scale-95 disabled:opacity-40"
            style={{ background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.1)' }}>
            0
          </button>

          <button onClick={removeDigit} disabled={lockedOut}
            className="h-[62px] rounded-2xl flex items-center justify-center transition-all active:scale-95 disabled:opacity-40"
            style={{ background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.1)' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M20 12H8" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
              <path d="M13 7l-5 5 5 5" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        {/* Sign out link */}
        <button onClick={onSignOut}
          className="mt-4 text-white/30 text-[13px] font-medium underline underline-offset-2 text-center">
          Not you? Sign in with a different account
        </button>
      </div>

      <style>{`
        @keyframes lockShake {
          0%,100%{transform:translateX(0)}
          15%{transform:translateX(-12px)}
          35%{transform:translateX(12px)}
          55%{transform:translateX(-8px)}
          75%{transform:translateX(8px)}
          90%{transform:translateX(-4px)}
        }
      `}</style>
    </div>
  );
}

function MoniepointHome() {
  const [balanceHidden, setBalanceHidden] = useState(false);
  const [, navigate] = useLocation();
  const { user, profilePhoto } = useAuth();
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
            <div className="w-10 h-10 rounded-full bg-[#3A3530] flex items-center justify-center text-white text-[15px] font-bold shrink-0 overflow-hidden">
              {profilePhoto ? <img src={profilePhoto} alt="" className="w-full h-full object-cover" /> : initials}
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
            <button onClick={() => navigate('/help-support')} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
              <Headphones className="w-6 h-6 text-[#222]" strokeWidth={1.75} />
            </button>
            <button onClick={() => navigate('/notifications')} className="relative w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
              <Bell className="w-6 h-6 text-[#222]" strokeWidth={1.75} />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border border-white" />
            </button>
          </div>
        </div>

        {/* ── Scrollable body ─────────────────────────────────────────── */}
        <div
          className="flex-1 overflow-y-auto pb-[76px]"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >

          {/* ── Account card ────────────────────────────────────────── */}
          {/* mx 12px, mt 12px, rounded-2xl (20px), p-5 */}
          <div className="mx-3 mt-3 bg-[#162353] rounded-[20px] px-4 py-3 text-white relative overflow-hidden">

            {/* Vexa logo — visible top-right */}
            <div className="absolute top-3 right-4 pointer-events-none select-none flex flex-col items-center gap-1">
              <img
                src="/vexa-icon.png"
                alt=""
                className="w-10 h-10 object-contain"
                style={{ opacity: 0.85 }}
              />
              <span className="text-[9px] font-bold tracking-widest text-white/50 uppercase">Vexa</span>
            </div>

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

          {/* ── Vexa Business ─────────────────────────────────────────── */}
          <div className="px-4 mt-4">
            <button
              onClick={() => navigate('/business')}
              className="w-full bg-[#162353] rounded-2xl px-4 py-3.5 flex items-center gap-3 text-left active:scale-[0.99] transition-transform"
            >
              <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center shrink-0">
                <BriefcaseBusiness className="w-5 h-5 text-white" strokeWidth={1.8} />
              </div>
              <div className="flex-1">
                <p className="text-white text-[13px] font-bold">Vexa Business</p>
                <p className="text-white/60 text-[11px] mt-0.5">Manage your business finances</p>
              </div>
              <ChevronRight className="w-4 h-4 text-white/60" />
            </button>
          </div>

          {/* ── Rewards ──────────────────────────────────────────────── */}
          {/* mt 16px, px 16px */}
          <div className="px-4 mt-4">
            <span className="text-[14px] font-semibold text-[#111] block mb-2.5">Rewards</span>

            <div className="grid grid-cols-2 gap-2">
              {/* Cashback */}
              <button
                onClick={() => navigate('/cashback')}
                className="bg-white rounded-xl p-3.5 border border-[#F0F0F0] flex items-center gap-3 active:bg-[#F8F9FB] transition-colors text-left"
              >
                <div className="w-9 h-9 shrink-0 flex items-center justify-center text-[26px] leading-none select-none">
                  🪙
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-medium text-[#888] mb-0.5">Cashback</div>
                  <div className="text-[14px] font-bold text-[#111]">₦1,450.00</div>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-[#CBD5E1] shrink-0" />
              </button>
              {/* Referrals */}
              <button
                onClick={() => navigate('/referrals')}
                className="bg-white rounded-xl p-3.5 border border-[#F0F0F0] flex items-center gap-3 active:bg-[#F8F9FB] transition-colors text-left"
              >
                <div className="w-9 h-9 shrink-0 flex items-center justify-center text-[26px] leading-none select-none">
                  📣
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-medium text-[#888] mb-0.5">Referrals</div>
                  <div className="text-[14px] font-bold text-[#111]">₦40,000.00</div>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-[#CBD5E1] shrink-0" />
              </button>
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

          {/* ── Promotional Banner Carousel ───────────────────────────── */}
          <PromoBannerCarousel />

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
  const { user, signOut, profilePhoto } = useAuth();
  const [biometrics, setBiometrics] = useState(true);
  const [notifs, setNotifs] = useState(true);
  const [passcodeOnReturn, setPasscodeOnReturn] = useState(() =>
    localStorage.getItem(PASSCODE_RETURN_KEY) === 'true'
  );

  function togglePasscodeOnReturn() {
    const next = !passcodeOnReturn;
    setPasscodeOnReturn(next);
    localStorage.setItem(PASSCODE_RETURN_KEY, String(next));
  }

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
        { icon: <Fingerprint className="w-5 h-5" />, label: 'Biometric Login',        sub: biometrics ? 'On' : 'Off' },
        { icon: <Lock className="w-5 h-5" />,        label: 'Change Password',        action: () => navigate('/change-password') },
        { icon: <Shield className="w-5 h-5" />,      label: 'Passcode on App Return', sub: passcodeOnReturn ? 'On · locks when you leave' : 'Off' },
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
          <div className="w-14 h-14 rounded-full bg-[#3A3530] flex items-center justify-center text-white text-[20px] font-bold shrink-0 overflow-hidden">
            {profilePhoto ? <img src={profilePhoto} alt="" className="w-full h-full object-cover" /> : initials}
          </div>
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
                const isPCR  = item.label === 'Passcode on App Return';
                const isToggle = isBio || isNot || isPCR;
                const toggleState = isBio ? biometrics : isNot ? notifs : passcodeOnReturn;
                return (
                  <button key={ii}
                    onClick={() => {
                      if (isBio) setBiometrics(v => !v);
                      else if (isNot) setNotifs(v => !v);
                      else if (isPCR) togglePasscodeOnReturn();
                      else if (item.action) item.action();
                    }}
                    className={`w-full flex items-center gap-3.5 px-4 py-4 text-left transition-colors hover:bg-[#F8F9FB] ${ii < section.items.length - 1 ? 'border-b border-[#F5F5F5]' : ''}`}
                  >
                    <span className={item.danger ? 'text-red-500' : 'text-[#555]'}>{item.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-[14px] font-semibold ${item.danger ? 'text-red-500' : 'text-[#111]'}`}>{item.label}</p>
                      {item.sub && <p className="text-[11px] text-[#888] mt-0.5 truncate">{item.sub}</p>}
                    </div>
                    {isToggle ? (
                      <div className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${toggleState ? 'bg-[#162353]' : 'bg-[#D1D5DB]'}`}>
                        <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${toggleState ? 'left-5' : 'left-0.5'}`} />
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

/* ─── Live Chat Modal ────────────────────────────────────────────────── */
type ChatAttachment = {
  kind: 'image' | 'file';
  name: string;
  url: string;   // object URL
  size: string;
};

type ChatMessage = {
  id: string;
  from: 'ai' | 'agent' | 'user';
  text: string;
  time: string;
  attachment?: ChatAttachment;
};

const AI_FAQ_MAP: { keywords: string[]; answer: string }[] = [
  { keywords: ['transfer', 'send money', 'send'],
    answer: 'To transfer money, go to the home screen and tap "Transfer". Enter the recipient\'s account number, select their bank, enter the amount, and confirm with your transaction PIN.' },
  { keywords: ['limit', 'daily limit', 'how much'],
    answer: 'Level 1 accounts can transfer up to ₦50,000/day. Level 2 up to ₦200,000/day. Level 3 verified accounts enjoy a ₦5,000,000 daily limit.' },
  { keywords: ['airtime', 'data', 'recharge'],
    answer: 'Tap "Airtime" or "Data" on the home screen, choose your network, enter the phone number and amount, then confirm.' },
  { keywords: ['passcode', 'forgot', 'password', 'pin'],
    answer: 'On the Sign In screen tap "Forgot Passcode?" and reset it via your registered phone number and OTP.' },
  { keywords: ['upgrade', 'verification', 'bvn', 'level'],
    answer: 'Go to Settings → Limits & Verification. You\'ll find requirements for each account level, including BVN and ID verification.' },
  { keywords: ['safe', 'security', 'secure', 'insured', 'ndic'],
    answer: 'Absolutely. Vexa uses 256-bit encryption and multi-factor authentication. All deposits are protected by the NDIC insurance scheme.' },
  { keywords: ['balance', 'account', 'number'],
    answer: 'Your account number and balance are displayed on your home dashboard. Tap the eye icon to show or hide your balance.' },
  { keywords: ['card', 'debit', 'virtual card'],
    answer: 'You can manage your Vexa debit card from the "Card" section on the home screen. You can freeze, unfreeze, or request a new card there.' },
];

function getAIReply(userText: string): string {
  const lower = userText.toLowerCase();
  for (const entry of AI_FAQ_MAP) {
    if (entry.keywords.some(k => lower.includes(k))) return entry.answer;
  }
  return "I'm not sure about that one. I can connect you with a live agent who can help right away — tap the button below.";
}

function nowTime() {
  return new Date().toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });
}

const AGENT = {
  name: 'Adaeze Okonkwo',
  role: 'Customer Support Specialist',
  avatar: 'AO',
  avatarBg: '#1E3A6E',
  online: true,
  responseTime: 'Usually replies in < 2 min',
};

const QUICK_REPLIES = [
  'How do I transfer money?',
  'What are my transfer limits?',
  'How do I buy airtime?',
  'Is my money safe?',
];

function LiveChatModal({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<'ai' | 'live'>('ai');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      from: 'ai',
      text: "Hi! I'm Vexa AI 👋 I can answer most questions instantly. What do you need help with today?",
      time: nowTime(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  function addMessage(msg: Omit<ChatMessage, 'id'>) {
    setMessages(prev => [...prev, { ...msg, id: String(Date.now()) }]);
  }

  function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setShowAttachMenu(false);
    const url = URL.createObjectURL(file);
    const isImage = file.type.startsWith('image/');
    const attachment: ChatAttachment = {
      kind: isImage ? 'image' : 'file',
      name: file.name,
      url,
      size: formatBytes(file.size),
    };
    addMessage({ from: 'user', text: '', time: nowTime(), attachment });
    // reset input
    e.target.value = '';
    // agent/AI acknowledgement
    setIsTyping(true);
    const ackReplies = isImage
      ? ["Got your photo! I can see it clearly. Let me take a look...", "Thanks for sending that image. Reviewing it now."]
      : ["I've received your file. Give me a moment to review it.", "Thanks for sending that document. I'll check it right away."];
    setTimeout(() => {
      setIsTyping(false);
      addMessage({
        from: mode === 'ai' ? 'ai' : 'agent',
        text: ackReplies[Math.floor(Math.random() * ackReplies.length)],
        time: nowTime(),
      });
    }, 1400 + Math.random() * 600);
  }

  function handleSend(text?: string) {
    const txt = (text ?? inputText).trim();
    if (!txt) return;
    setInputText('');
    addMessage({ from: 'user', text: txt, time: nowTime() });

    if (mode === 'ai') {
      setIsTyping(true);
      setTimeout(() => {
        setIsTyping(false);
        addMessage({ from: 'ai', text: getAIReply(txt), time: nowTime() });
      }, 1100 + Math.random() * 600);
    } else {
      // Live agent — simulate reply
      setIsTyping(true);
      setTimeout(() => {
        setIsTyping(false);
        const agentReplies = [
          "Thanks for sharing that! Let me look into this for you right away.",
          "I can see your account details. Give me a moment to resolve this.",
          "Got it! I've noted your concern and will escalate if needed. Is there anything else?",
          "That's been resolved on our end. Please try again and let me know if the issue persists.",
        ];
        addMessage({ from: 'agent', text: agentReplies[Math.floor(Math.random() * agentReplies.length)], time: nowTime() });
      }, 1500 + Math.random() * 1000);
    }
  }

  function handleTransferToAgent() {
    setTransferring(true);
    setIsTyping(true);
    setTimeout(() => {
      setTransferring(false);
      setIsTyping(false);
      setMode('live');
      addMessage({
        from: 'agent',
        text: `Hi! I'm ${AGENT.name} from Vexa Support 😊 I've reviewed your conversation and I'm here to help. What can I do for you?`,
        time: nowTime(),
      });
    }, 2000);
  }

  const isAiMode = mode === 'ai';

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-[#F2F3F5]"
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      {/* ── Header ── */}
      <div
        className="flex-none bg-[#162353] px-4 pb-4"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 14px)' }}
      >
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/15 active:bg-white/25 transition-colors"
          >
            <X className="w-4 h-4 text-white" />
          </button>
          <span className="text-white font-bold text-[15px]">Live Chat</span>
          <div className="w-8" />
        </div>

        {/* Agent / AI profile card */}
        {isAiMode ? (
          <div className="flex items-center gap-3 bg-white/10 rounded-2xl px-4 py-3">
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#00C6FF] to-[#0072FF] flex items-center justify-center flex-shrink-0">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-white font-bold text-[14px]">Vexa AI Assistant</p>
              <p className="text-white/60 text-[11px]">Instant answers · Always available</p>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse" />
              <span className="text-[10px] font-semibold text-[#22C55E]">Online</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 bg-white/10 rounded-2xl px-4 py-3">
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-[14px] flex-shrink-0"
              style={{ background: 'linear-gradient(135deg,#1E3A6E,#2563EB)' }}
            >
              {AGENT.avatar}
            </div>
            <div className="flex-1">
              <p className="text-white font-bold text-[14px]">{AGENT.name}</p>
              <p className="text-white/60 text-[11px]">{AGENT.role}</p>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-1.5 justify-end mb-0.5">
                <div className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse" />
                <span className="text-[10px] font-semibold text-[#22C55E]">Online</span>
              </div>
              <p className="text-[10px] text-white/50">{AGENT.responseTime}</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Messages ── */}
      <div
        className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
        style={{ scrollbarWidth: 'none' }}
      >
        {/* Mode banner */}
        {!isAiMode && (
          <div className="flex items-center gap-2 justify-center">
            <div className="flex-1 h-px bg-[#E2E8F0]" />
            <span className="text-[11px] text-[#94A3B8] font-medium px-2">Transferred to Live Agent</span>
            <div className="flex-1 h-px bg-[#E2E8F0]" />
          </div>
        )}

        {messages.map((msg) => {
          const isUser = msg.from === 'user';
          const isBot = msg.from === 'ai';

          return (
            <div key={msg.id} className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
              {/* Avatar */}
              {!isUser && (
                <div className="flex-shrink-0 mt-auto">
                  {isBot ? (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#00C6FF] to-[#0072FF] flex items-center justify-center">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                  ) : (
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-[11px]"
                      style={{ background: 'linear-gradient(135deg,#1E3A6E,#2563EB)' }}
                    >
                      {AGENT.avatar}
                    </div>
                  )}
                </div>
              )}

              <div className={`flex flex-col max-w-[78%] ${isUser ? 'items-end' : 'items-start'}`}>
                {!isUser && (
                  <p className="text-[10px] font-semibold text-[#64748B] mb-1 px-1">
                    {isBot ? 'Vexa AI' : AGENT.name}
                  </p>
                )}

                {/* Attachment bubble */}
                {msg.attachment && (
                  <div className={`rounded-2xl overflow-hidden mb-1 ${isUser ? 'rounded-br-sm' : 'rounded-bl-sm'}`}
                    style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.10)', maxWidth: 220 }}>
                    {msg.attachment.kind === 'image' ? (
                      <img
                        src={msg.attachment.url}
                        alt={msg.attachment.name}
                        className="w-full object-cover"
                        style={{ maxHeight: 200 }}
                      />
                    ) : (
                      <div className={`flex items-center gap-3 px-4 py-3 ${isUser ? 'bg-[#162353]' : 'bg-white border border-[#F0F0F0]'}`}>
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isUser ? 'bg-white/15' : 'bg-[#EFF6FF]'}`}>
                          <FileIcon className={`w-4 h-4 ${isUser ? 'text-white' : 'text-[#2563EB]'}`} />
                        </div>
                        <div className="min-w-0">
                          <p className={`text-[12px] font-semibold truncate ${isUser ? 'text-white' : 'text-[#1E293B]'}`}>{msg.attachment.name}</p>
                          <p className={`text-[11px] mt-0.5 ${isUser ? 'text-white/60' : 'text-[#94A3B8]'}`}>{msg.attachment.size}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Text bubble (skip if empty attachment-only message) */}
                {msg.text && (
                  <div
                    className={`px-4 py-3 rounded-2xl text-[13px] leading-relaxed ${
                      isUser
                        ? 'bg-[#162353] text-white rounded-br-sm'
                        : 'bg-white text-[#1E293B] rounded-bl-sm border border-[#F0F0F0]'
                    }`}
                    style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
                  >
                    {msg.text}
                  </div>
                )}

                <div className={`flex items-center gap-1 mt-1 px-1 ${isUser ? 'flex-row-reverse' : ''}`}>
                  <span className="text-[10px] text-[#CBD5E1]">{msg.time}</span>
                  {isUser && <CheckCheck className="w-3 h-3 text-[#22C55E]" />}
                </div>
              </div>
            </div>
          );
        })}

        {/* Typing indicator */}
        {isTyping && (
          <div className="flex gap-2.5 flex-row">
            <div className="flex-shrink-0 mt-auto">
              {isAiMode ? (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#00C6FF] to-[#0072FF] flex items-center justify-center">
                  <Bot className="w-4 h-4 text-white" />
                </div>
              ) : (
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-[11px]"
                  style={{ background: 'linear-gradient(135deg,#1E3A6E,#2563EB)' }}
                >
                  {AGENT.avatar}
                </div>
              )}
            </div>
            <div className="bg-white border border-[#F0F0F0] rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1.5" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              {[0, 1, 2].map(i => (
                <span
                  key={i}
                  className="w-1.5 h-1.5 bg-[#94A3B8] rounded-full inline-block"
                  style={{ animation: `typingDot 1.2s ${i * 0.2}s infinite ease-in-out` }}
                />
              ))}
            </div>
          </div>
        )}

        {/* "Talk to a Live Agent" button — only in AI mode after ≥2 exchanges */}
        {isAiMode && messages.length >= 2 && !isTyping && (
          <div className="flex justify-center pt-1">
            <button
              onClick={handleTransferToAgent}
              disabled={transferring}
              className="flex items-center gap-2 bg-white border border-[#E2E8F0] rounded-full px-5 py-2.5 text-[12px] font-semibold text-[#162353] active:bg-[#F1F5F9] transition-colors disabled:opacity-60"
              style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}
            >
              <Wifi className="w-3.5 h-3.5" />
              {transferring ? 'Connecting...' : 'Talk to a Live Agent'}
            </button>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Quick replies (AI mode only, when no user message yet) ── */}
      {isAiMode && messages.length === 1 && (
        <div className="flex-none px-4 pb-2">
          <p className="text-[11px] text-[#94A3B8] font-medium mb-2">Suggested questions</p>
          <div className="flex flex-wrap gap-2">
            {QUICK_REPLIES.map((q) => (
              <button
                key={q}
                onClick={() => handleSend(q)}
                className="bg-white border border-[#E2E8F0] rounded-full px-3.5 py-1.5 text-[12px] font-medium text-[#334155] active:bg-[#F1F5F9] transition-colors"
                style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Attach menu popup ── */}
      {showAttachMenu && (
        <div className="flex-none bg-white border-t border-[#E8EBF0] px-4 pt-3 pb-2">
          <div className="flex gap-3">
            {/* Camera / Photo */}
            <button
              onClick={() => { setShowAttachMenu(false); cameraInputRef.current?.click(); }}
              className="flex-1 flex flex-col items-center gap-2 bg-[#F8F9FB] rounded-2xl py-4 active:bg-[#EEF2F7] transition-colors border border-[#E8EBF0]"
            >
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#00C6FF] to-[#0072FF] flex items-center justify-center">
                <ImagePlus className="w-5 h-5 text-white" />
              </div>
              <span className="text-[12px] font-semibold text-[#334155]">Photo / Camera</span>
            </button>
            {/* File */}
            <button
              onClick={() => { setShowAttachMenu(false); fileInputRef.current?.click(); }}
              className="flex-1 flex flex-col items-center gap-2 bg-[#F8F9FB] rounded-2xl py-4 active:bg-[#EEF2F7] transition-colors border border-[#E8EBF0]"
            >
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#4F46E5] flex items-center justify-center">
                <FileUp className="w-5 h-5 text-white" />
              </div>
              <span className="text-[12px] font-semibold text-[#334155]">Document / File</span>
            </button>
          </div>
          <button
            onClick={() => setShowAttachMenu(false)}
            className="w-full mt-2 py-2 text-[12px] font-semibold text-[#94A3B8] active:text-[#64748B]"
          >
            Cancel
          </button>
        </div>
      )}

      {/* ── Input bar ── */}
      <div
        className="flex-none bg-white border-t border-[#E8EBF0] px-4 py-3 flex items-end gap-2"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 12px)' }}
      >
        {/* Attachment button */}
        <button
          onClick={() => setShowAttachMenu(v => !v)}
          className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 border transition-colors ${
            showAttachMenu
              ? 'bg-[#162353] border-[#162353]'
              : 'bg-[#F8F9FB] border-[#E8EBF0] active:bg-[#EEF2F7]'
          }`}
        >
          <Paperclip className={`w-4 h-4 ${showAttachMenu ? 'text-white' : 'text-[#64748B]'}`} />
        </button>

        {/* Text input */}
        <div className="flex-1 bg-[#F8F9FB] rounded-2xl border border-[#E8EBF0] flex items-end px-4 py-2.5">
          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder={isAiMode ? 'Ask Vexa AI anything…' : `Message ${AGENT.name.split(' ')[0]}…`}
            className="flex-1 bg-transparent text-[13px] text-[#1E293B] placeholder-[#94A3B8] outline-none resize-none"
          />
        </div>

        {/* Send button */}
        <button
          onClick={() => handleSend()}
          disabled={!inputText.trim()}
          className="w-10 h-10 rounded-full bg-[#162353] flex items-center justify-center flex-shrink-0 transition-opacity disabled:opacity-40 active:opacity-70"
        >
          <Send className="w-4 h-4 text-white" />
        </button>
      </div>

      {/* Hidden file inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileSelected}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
        className="hidden"
        onChange={handleFileSelected}
      />

      <style>{`
        @keyframes typingDot {
          0%,80%,100% { transform: scale(0.8); opacity: 0.4; }
          40%          { transform: scale(1.2); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

/* ─── Help & Support Page ────────────────────────────────────────────── */
function HelpSupportPage() {
  const [, navigate] = useLocation();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [showChat, setShowChat] = useState(false);

  const faqs = [
    { q: 'How do I transfer money?', a: 'Go to the home screen and tap "Transfer". Enter the recipient\'s account number, select their bank, enter the amount, and confirm with your transaction PIN.' },
    { q: 'What are the transfer limits?', a: 'Level 1 accounts can transfer up to ₦50,000 per day. Level 2 accounts can transfer up to ₦200,000 per day. Level 3 verified accounts have a ₦5,000,000 daily limit.' },
    { q: 'How do I buy airtime or data?', a: 'From the home screen, tap "Airtime" or "Data", select your network provider, enter the phone number and amount, then confirm the purchase.' },
    { q: 'I forgot my passcode. What do I do?', a: 'On the Sign In screen, tap "Forgot Passcode?" and follow the steps to reset it using your registered phone number and OTP verification.' },
    { q: 'How do I upgrade my account level?', a: 'Go to Settings → Limits & Verification. You will find the requirements for upgrading to higher account levels, including BVN and ID verification.' },
    { q: 'Is my money safe with Vexa?', a: 'Yes. Vexa uses 256-bit encryption and multi-factor authentication to keep your account secure. All deposits are protected by the NDIC insurance scheme.' },
  ];

  return (
    <>
      {showChat && <LiveChatModal onClose={() => setShowChat(false)} />}

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
              <button
                onClick={() => setShowChat(true)}
                className="flex-1 bg-white/25 border border-white/30 rounded-xl py-3 flex flex-col items-center gap-1.5 active:bg-white/35 transition-colors"
              >
                <MessageCircle className="w-5 h-5 text-white" />
                <span className="text-[11px] font-semibold text-white">Live Chat</span>
              </button>
              <button className="flex-1 bg-white/15 rounded-xl py-3 flex flex-col items-center gap-1.5 active:bg-white/25 transition-colors">
                <Mail className="w-5 h-5 text-white" />
                <span className="text-[11px] font-semibold text-white">Email Us</span>
              </button>
            </div>
          </div>

          {/* Live chat promo card */}
          <button
            onClick={() => setShowChat(true)}
            className="w-full bg-white rounded-2xl border border-[#E8EBF0] px-4 py-4 flex items-center gap-4 active:bg-[#F8F9FB] transition-colors"
            style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
          >
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#00C6FF] to-[#0072FF] flex items-center justify-center flex-shrink-0">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-[14px] font-bold text-[#111]">Chat with Vexa AI</p>
              <p className="text-[12px] text-[#888] mt-0.5">Instant answers, or connect to a live agent</p>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse" />
              <span className="text-[11px] font-semibold text-[#22C55E]">Online</span>
            </div>
          </button>

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
    </>
  );
}

/* ─── Notifications Page ─────────────────────────────────────────────── */
function NotificationsPage() {
  const [, navigate] = useLocation();
  const [notifications, setNotifications] = useState([
    { id: 1, type: 'credit',   title: 'Money Received',       body: 'You received ₦15,000 from Tunde Bakare.',           time: '2 min ago',  read: false },
    { id: 2, type: 'debit',    title: 'Transfer Successful',  body: 'Transfer of ₦5,000 to GTB •••7892 was successful.', time: '1 hr ago',   read: false },
    { id: 3, type: 'security', title: 'New Login Detected',   body: 'Your account was accessed from a new device.',      time: '3 hrs ago',  read: false },
    { id: 4, type: 'info',     title: 'Airtime Purchase',     body: 'You purchased ₦1,000 airtime for 08012345678.',     time: '5 hrs ago',  read: true  },
    { id: 5, type: 'promo',    title: 'Cashback Earned!',     body: 'You earned ₦200 cashback on your last transfer.',   time: 'Yesterday',  read: true  },
    { id: 6, type: 'credit',   title: 'Salary Credited',      body: 'Salary of ₦52,000 has been credited.',             time: '2 days ago', read: true  },
    { id: 7, type: 'info',     title: 'Data Purchase',        body: 'You purchased 2GB data for 08067212032.',           time: '3 days ago', read: true  },
  ]);

  const unreadCount = notifications.filter(n => !n.read).length;
  const markAllRead = () => setNotifications(ns => ns.map(n => ({ ...n, read: true })));
  const markRead   = (id: number) => setNotifications(ns => ns.map(n => n.id === id ? { ...n, read: true } : n));

  function dotColor(type: string) {
    switch (type) {
      case 'credit':   return { bg: '#DCFCE7', stroke: '#16A34A' };
      case 'debit':    return { bg: '#FEE2E2', stroke: '#DC2626' };
      case 'security': return { bg: '#FEF3C7', stroke: '#D97706' };
      case 'promo':    return { bg: '#F3E8FF', stroke: '#9333EA' };
      default:         return { bg: '#EFF6FF', stroke: '#2563EB' };
    }
  }

  return (
    <div className="fixed inset-0 bg-[#F2F3F5] flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div className="flex-none flex items-center justify-between px-4 pb-3 bg-white border-b border-[#E8EBF0]"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          </button>
          <span className="text-[16px] font-bold text-[#111]">Notifications</span>
          {unreadCount > 0 && (
            <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{unreadCount}</span>
          )}
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllRead} className="text-[12px] text-[#162353] font-semibold">Mark all read</button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto py-4 px-4 space-y-3" style={{ scrollbarWidth: 'none' }}>
        {unreadCount > 0 && (
          <p className="text-[11px] font-semibold text-[#888] uppercase tracking-wide px-1">New</p>
        )}
        {notifications.filter(n => !n.read).map(n => {
          const c = dotColor(n.type);
          return (
            <button key={n.id} onClick={() => markRead(n.id)}
              className="w-full bg-white rounded-2xl border border-[#E8F0FE] px-4 py-4 flex items-start gap-3 text-left hover:bg-[#F8F9FB] transition-colors shadow-sm">
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: c.bg }}>
                <Bell className="w-5 h-5" style={{ color: c.stroke }} strokeWidth={1.8} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <p className="text-[13px] font-bold text-[#111]">{n.title}</p>
                  <span className="text-[10px] text-[#888] shrink-0">{n.time}</span>
                </div>
                <p className="text-[12px] text-[#555] leading-relaxed">{n.body}</p>
              </div>
              <span className="w-2 h-2 rounded-full bg-[#162353] shrink-0 mt-1.5" />
            </button>
          );
        })}

        {notifications.some(n => n.read) && (
          <p className="text-[11px] font-semibold text-[#888] uppercase tracking-wide px-1 pt-1">Earlier</p>
        )}
        {notifications.filter(n => n.read).map(n => {
          const c = dotColor(n.type);
          return (
            <div key={n.id} className="bg-white rounded-2xl border border-[#F0F0F0] px-4 py-4 flex items-start gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: c.bg + '80' }}>
                <Bell className="w-5 h-5" style={{ color: c.stroke + '99' }} strokeWidth={1.8} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <p className="text-[13px] font-semibold text-[#666]">{n.title}</p>
                  <span className="text-[10px] text-[#AAA] shrink-0">{n.time}</span>
                </div>
                <p className="text-[12px] text-[#888] leading-relaxed">{n.body}</p>
              </div>
            </div>
          );
        })}
        <div className="pb-4" />
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
type SavingsGoal = {
  id: string; name: string; emoji: string; target: number; saved: number;
  frequency: string; dueDate: string; autoSave: boolean; color: string;
};

const INIT_GOALS: SavingsGoal[] = [
  { id:'1', name:'Emergency Fund', emoji:'🛡️', target:200000, saved:45000,  frequency:'Monthly', dueDate:'Dec 2026', autoSave:true,  color:'#162353' },
  { id:'2', name:'New Laptop',     emoji:'💻', target:350000, saved:120000, frequency:'Weekly',  dueDate:'Sep 2026', autoSave:false, color:'#0F6CBD' },
  { id:'3', name:'Vacation Fund',  emoji:'✈️', target:500000, saved:87500,  frequency:'Weekly',  dueDate:'Jun 2027', autoSave:true,  color:'#6D28D9' },
];

function SavingsPage() {
  const [, navigate] = useLocation();
  const [goals, setGoals] = useState<SavingsGoal[]>(INIT_GOALS);
  const [activeTab, setActiveTab] = useState<'goals' | 'plans'>('goals');
  const [showCreate, setShowCreate] = useState(false);
  const [goalName, setGoalName]     = useState('');
  const [goalAmt, setGoalAmt]       = useState('');
  const [frequency, setFreq]        = useState('Monthly');
  const [dueDate, setDueDate]       = useState('');
  const [autoSave, setAutoSave]     = useState(false);
  const [topUpGoalId, setTopUpGoalId] = useState<string | null>(null);
  const [topUpAmt, setTopUpAmt]     = useState('');
  const [created, setCreated]       = useState(false);
  const [topUpDone, setTopUpDone]   = useState(false);

  const totalSaved = goals.reduce((s,g) => s + g.saved, 0);
  const totalTarget = goals.reduce((s,g) => s + g.target, 0);
  const overallPct = Math.round((totalSaved / totalTarget) * 100);

  if (created) return <SuccessBanner title="Savings Goal Created!" sub={`You're saving ₦${goalAmt} towards "${goalName}"`} onHome={() => { setCreated(false); }} />;
  if (topUpDone) return <SuccessBanner title="Top-up Successful!" sub={`₦${topUpAmt} added to your goal`} onHome={() => { setTopUpDone(false); setTopUpGoalId(null); setTopUpAmt(''); }} />;

  const SAVINGS_PLANS = [
    { name:'Flexi Save',    rate:'8% p.a.',  min:'₦1,000',   lock:'None',      tag:'Popular',  color:'#162353', desc:'Save anytime, withdraw anytime.' },
    { name:'Target Save',   rate:'12% p.a.', min:'₦5,000',   lock:'3 months',  tag:'Best Rate',color:'#0F6CBD', desc:'Lock funds, earn higher returns.' },
    { name:'Fixed Deposit', rate:'15% p.a.', min:'₦50,000',  lock:'6 months',  tag:'Highest',  color:'#6D28D9', desc:'Maximum interest for committed savers.' },
  ];

  return (
    <PageShell title="Savings" back="/">
      <div className="flex-1 overflow-y-auto pb-6" style={{ scrollbarWidth: 'none' }}>

        {/* Summary Hero */}
        <div className="mx-4 mt-4 rounded-2xl overflow-hidden relative"
          style={{ background: 'linear-gradient(135deg, #162353 0%, #1E3A6E 50%, #0a4fa3 100%)' }}>
          {/* Decorative arc */}
          <svg className="absolute right-0 top-0 opacity-10" width="160" height="120" viewBox="0 0 160 120">
            <circle cx="140" cy="20" r="90" fill="white"/>
          </svg>
          <div className="px-5 py-5 relative z-10">
            <p className="text-white/60 text-[11px] font-semibold uppercase tracking-wider mb-1">Total Savings</p>
            <p className="text-white text-[30px] font-extrabold tracking-tight">₦{totalSaved.toLocaleString('en-NG')}.00</p>
            <p className="text-white/50 text-[11px] mt-0.5">Target: ₦{totalTarget.toLocaleString('en-NG')} across {goals.length} goals</p>

            {/* Overall progress */}
            <div className="mt-3">
              <div className="flex justify-between items-center mb-1">
                <p className="text-white/60 text-[10px]">Overall progress</p>
                <p className="text-white text-[11px] font-bold">{overallPct}%</p>
              </div>
              <div className="h-2 bg-white/15 rounded-full overflow-hidden">
                <div className="h-full bg-white rounded-full transition-all" style={{ width: `${overallPct}%` }} />
              </div>
            </div>

            {/* Stats row */}
            <div className="flex gap-3 mt-4">
              <div className="flex-1 bg-white/10 rounded-xl px-3 py-2.5">
                <p className="text-white/50 text-[9px] font-semibold uppercase tracking-wider">Earned Interest</p>
                <p className="text-white text-[13px] font-bold mt-0.5">₦4,320.00</p>
              </div>
              <div className="flex-1 bg-white/10 rounded-xl px-3 py-2.5">
                <p className="text-white/50 text-[9px] font-semibold uppercase tracking-wider">This Month</p>
                <p className="text-white text-[13px] font-bold mt-0.5">+₦18,500</p>
              </div>
              <div className="flex-1 bg-white/10 rounded-xl px-3 py-2.5">
                <p className="text-white/50 text-[9px] font-semibold uppercase tracking-wider">Active Goals</p>
                <p className="text-white text-[13px] font-bold mt-0.5">{goals.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex mx-4 mt-4 bg-[#F0F0F0] rounded-xl p-1">
          {(['goals','plans'] as const).map(t => (
            <button key={t} onClick={() => setActiveTab(t)}
              className={`flex-1 py-2 rounded-lg text-[13px] font-bold transition-all capitalize ${activeTab===t ? 'bg-white text-[#162353] shadow-sm' : 'text-[#888]'}`}>
              {t === 'goals' ? '🎯 My Goals' : '📈 Savings Plans'}
            </button>
          ))}
        </div>

        {/* Goals Tab */}
        {activeTab === 'goals' && (
          <div className="px-4 mt-4 space-y-3">
            {goals.map(g => {
              const pct = Math.round((g.saved / g.target) * 100);
              const remaining = g.target - g.saved;
              return (
                <div key={g.id} className="bg-white rounded-2xl overflow-hidden border border-[#F0F0F0]">
                  {/* Color header strip */}
                  <div className="px-4 py-3 flex items-center gap-3" style={{ background: g.color }}>
                    <span className="text-[22px]">{g.emoji}</span>
                    <div className="flex-1">
                      <p className="text-white font-bold text-[14px]">{g.name}</p>
                      <p className="text-white/60 text-[11px]">Due {g.dueDate} · {g.frequency}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-white font-extrabold text-[18px]">{pct}%</p>
                      <p className="text-white/60 text-[10px]">complete</p>
                    </div>
                  </div>
                  <div className="px-4 pt-3 pb-4">
                    {/* Progress bar */}
                    <div className="h-2.5 bg-[#F0F0F0] rounded-full overflow-hidden mb-3">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: g.color }} />
                    </div>
                    {/* Amounts */}
                    <div className="flex justify-between mb-3">
                      <div>
                        <p className="text-[10px] text-[#888]">Saved</p>
                        <p className="text-[13px] font-bold text-[#111]">₦{g.saved.toLocaleString('en-NG')}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] text-[#888]">Remaining</p>
                        <p className="text-[13px] font-bold text-[#555]">₦{remaining.toLocaleString('en-NG')}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-[#888]">Target</p>
                        <p className="text-[13px] font-bold text-[#111]">₦{g.target.toLocaleString('en-NG')}</p>
                      </div>
                    </div>
                    {/* Auto-save badge + top-up */}
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${g.autoSave ? 'bg-green-100 text-green-700' : 'bg-[#F5F5F5] text-[#888]'}`}>
                        {g.autoSave ? '⚡ Auto-save on' : '⚡ Auto-save off'}
                      </span>
                      <button onClick={() => { setTopUpGoalId(g.id); setTopUpAmt(''); }}
                        className="text-[11px] font-bold px-3 py-1.5 rounded-lg text-white transition-all active:scale-95"
                        style={{ background: g.color }}>
                        + Top Up
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Create new goal form */}
            {showCreate && (
              <div className="bg-white rounded-2xl p-5 border-2 border-[#162353] space-y-3">
                <p className="text-[14px] font-bold text-[#111]">New Savings Goal</p>
                <input type="text" placeholder="Goal name (e.g. MacBook Pro)" value={goalName} onChange={e => setGoalName(e.target.value)}
                  className="w-full border border-[#E0E0E0] rounded-xl px-4 py-3 text-[14px] outline-none focus:border-[#162353] placeholder:text-[#CCC]" />
                <div className="flex items-center gap-2 border border-[#E0E0E0] rounded-xl px-4 py-3 focus-within:border-[#162353]">
                  <span className="text-[16px] font-bold text-[#444]">₦</span>
                  <input type="text" inputMode="numeric" placeholder="Target amount" value={goalAmt} onChange={e => setGoalAmt(formatAmt(e.target.value))}
                    className="flex-1 text-[16px] font-semibold text-[#111] outline-none bg-transparent placeholder:text-[#CCC] placeholder:font-normal" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-[#444] mb-1.5">Auto-save frequency</p>
                  <div className="flex gap-2">
                    {['Daily','Weekly','Monthly'].map(f => (
                      <button key={f} onClick={() => setFreq(f)}
                        className={`flex-1 py-2 rounded-xl text-[12px] font-semibold border-2 transition-all ${frequency===f ? 'bg-[#162353] text-white border-[#162353]' : 'border-[#E0E0E0] text-[#444]'}`}>
                        {f}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between bg-[#F8F9FB] rounded-xl px-4 py-3">
                  <div>
                    <p className="text-[13px] font-semibold text-[#111]">Enable Auto-save</p>
                    <p className="text-[11px] text-[#888]">Automatically deduct on schedule</p>
                  </div>
                  <button onClick={() => setAutoSave(v=>!v)}
                    className={`w-11 h-6 rounded-full transition-colors relative ${autoSave ? 'bg-[#162353]' : 'bg-[#D1D5DB]'}`}>
                    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${autoSave ? 'left-5' : 'left-0.5'}`} />
                  </button>
                </div>
                <input type="text" placeholder="Target date (e.g. Dec 2026)" value={dueDate} onChange={e => setDueDate(e.target.value)}
                  className="w-full border border-[#E0E0E0] rounded-xl px-4 py-3 text-[14px] outline-none focus:border-[#162353] placeholder:text-[#CCC]" />
                <div className="flex gap-2">
                  <button onClick={() => setShowCreate(false)}
                    className="flex-1 h-[44px] rounded-xl border-2 border-[#E0E0E0] text-[13px] font-semibold text-[#555]">
                    Cancel
                  </button>
                  <button onClick={() => {
                    if (!goalName || !goalAmt) return;
                    const num = parseFloat(goalAmt.replace(/,/g,''));
                    if (isNaN(num) || num <= 0) return;
                    setGoals(prev => [...prev, {
                      id: String(Date.now()), name: goalName, emoji: '🎯',
                      target: num, saved: 0, frequency, dueDate: dueDate || 'TBD',
                      autoSave, color: '#162353'
                    }]);
                    setShowCreate(false);
                    setCreated(true);
                  }} className="flex-1 h-[44px] bg-[#162353] rounded-xl text-[13px] font-semibold text-white">
                    Create Goal
                  </button>
                </div>
              </div>
            )}

            {!showCreate && (
              <button onClick={() => setShowCreate(true)}
                className="w-full h-[50px] rounded-xl border-2 border-dashed border-[#162353]/30 text-[13px] font-semibold text-[#162353] flex items-center justify-center gap-2">
                <span className="text-[18px]">+</span> Create New Goal
              </button>
            )}
          </div>
        )}

        {/* Plans Tab */}
        {activeTab === 'plans' && (
          <div className="px-4 mt-4 space-y-3">
            <p className="text-[12px] text-[#888]">Choose a savings plan that suits your lifestyle</p>
            {SAVINGS_PLANS.map(plan => (
              <div key={plan.name} className="bg-white rounded-2xl overflow-hidden border border-[#F0F0F0]">
                <div className="px-4 py-3 flex items-center justify-between" style={{ background: plan.color }}>
                  <p className="text-white font-bold text-[15px]">{plan.name}</p>
                  <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-white/20 text-white border border-white/30">{plan.tag}</span>
                </div>
                <div className="px-4 py-4">
                  <p className="text-[12px] text-[#888] mb-3">{plan.desc}</p>
                  <div className="flex gap-3 mb-4">
                    <div className="flex-1 bg-[#F8F9FB] rounded-xl px-3 py-2.5 text-center">
                      <p className="text-[10px] text-[#888] font-medium">Interest Rate</p>
                      <p className="text-[16px] font-extrabold text-[#162353] mt-0.5">{plan.rate}</p>
                    </div>
                    <div className="flex-1 bg-[#F8F9FB] rounded-xl px-3 py-2.5 text-center">
                      <p className="text-[10px] text-[#888] font-medium">Minimum</p>
                      <p className="text-[14px] font-bold text-[#111] mt-0.5">{plan.min}</p>
                    </div>
                    <div className="flex-1 bg-[#F8F9FB] rounded-xl px-3 py-2.5 text-center">
                      <p className="text-[10px] text-[#888] font-medium">Lock Period</p>
                      <p className="text-[12px] font-bold text-[#111] mt-0.5">{plan.lock}</p>
                    </div>
                  </div>
                  <button className="w-full h-[40px] rounded-xl text-[13px] font-bold text-white transition-all active:scale-[0.98]"
                    style={{ background: plan.color }}>
                    Start This Plan
                  </button>
                </div>
              </div>
            ))}

            <div className="bg-[#F0F4FF] border border-[#C7D7FF] rounded-2xl px-4 py-4 mt-2">
              <p className="text-[12px] font-bold text-[#162353] mb-1">💡 Did you know?</p>
              <p className="text-[11px] text-[#555] leading-relaxed">Consistent savings of ₦5,000/week grows to over ₦1.4M in 5 years with compound interest at 12% p.a.</p>
            </div>
          </div>
        )}
      </div>

      {/* Top-up modal */}
      {topUpGoalId && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setTopUpGoalId(null)} />
          <div className="relative bg-white rounded-t-3xl px-6 pt-5 pb-10 z-10">
            <div className="w-10 h-1 bg-[#E2E8F0] rounded-full mx-auto mb-4" />
            <p className="text-[16px] font-bold text-[#111] mb-1">
              Top Up: {goals.find(g=>g.id===topUpGoalId)?.name}
            </p>
            <p className="text-[12px] text-[#888] mb-4">How much would you like to add?</p>
            <div className="flex items-center gap-2 border-2 border-[#E0E0E0] rounded-xl px-4 py-3 focus-within:border-[#162353] mb-3">
              <span className="text-[20px] font-bold text-[#444]">₦</span>
              <input type="text" inputMode="numeric" placeholder="0.00" value={topUpAmt}
                onChange={e => setTopUpAmt(formatAmt(e.target.value))}
                autoFocus
                className="flex-1 text-[22px] font-bold text-[#111] outline-none bg-transparent placeholder:text-[#CCC] placeholder:font-normal" />
            </div>
            <div className="flex gap-2 mb-4">
              {[1000,2000,5000,10000].map(v => (
                <button key={v} onClick={() => setTopUpAmt(v.toLocaleString('en-NG'))}
                  className="flex-1 py-2 bg-[#F8F9FB] border border-[#E0E0E0] rounded-lg text-[11px] font-semibold text-[#555]">
                  ₦{v>=1000?(v/1000)+'k':v}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setTopUpGoalId(null)}
                className="flex-1 h-[48px] rounded-xl border-2 border-[#E2E8F0] text-[13px] font-semibold text-[#444]">Cancel</button>
              <button onClick={() => {
                const num = parseFloat(topUpAmt.replace(/,/g,''));
                if (!num || num <= 0) return;
                setGoals(prev => prev.map(g => g.id === topUpGoalId ? { ...g, saved: g.saved + num } : g));
                setTopUpGoalId(null);
                setTopUpDone(true);
              }} className="flex-1 h-[48px] rounded-xl bg-[#162353] text-[13px] font-semibold text-white">
                Add Funds
              </button>
            </div>
          </div>
        </div>
      )}
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
  const { user } = useAuth();
  const [frozen, setFrozen]     = useState(false);
  const [showNum, setShowNum]   = useState(false);
  const [activeTab, setCardTab] = useState<'details'|'transactions'|'limits'>('details');
  const [onlinePayments, setOnline] = useState(true);
  const [contactless, setContactless] = useState(true);
  const [intlPayments, setIntl] = useState(false);

  const cardName = user ? user.name.split(' ').slice(0, 2).map(p => p.toUpperCase()).join(' ') : 'CHIBUZOR E DIKE';

  const CARD_TXS = [
    { icon:'🛒', name:'Shoprite', date:'Today, 2:14 PM',    amount:'-₦4,500', color:'#EF4444' },
    { icon:'🍔', name:'KFC Nigeria', date:'Yesterday, 7:33 PM', amount:'-₦2,800', color:'#EF4444' },
    { icon:'📱', name:'Jumia Pay',   date:'25 Jul, 11:00 AM',   amount:'-₦12,000', color:'#EF4444' },
    { icon:'🎬', name:'Netflix',     date:'23 Jul, 12:01 AM',   amount:'-₦4,600',  color:'#EF4444' },
    { icon:'⛽', name:'MRS Fuel',    date:'20 Jul, 08:45 AM',   amount:'-₦8,000',  color:'#EF4444' },
  ];

  return (
    <div className="fixed inset-0 bg-[#F2F3F5] flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div className="flex-none flex items-center justify-between px-4 pb-3 bg-white border-b border-[#E8EBF0]"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}>
        <button onClick={() => navigate('/')} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <span className="text-[16px] font-bold text-[#111]">Vexa Virtual Card</span>
        <div className="w-8" />
      </div>

      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        {/* Premium Card Visual */}
        <div className="px-4 pt-5 pb-2">
          <div className="rounded-3xl p-5 text-white relative overflow-hidden select-none"
            style={{
              background: frozen
                ? 'linear-gradient(135deg, #374151 0%, #1F2937 60%, #111827 100%)'
                : 'linear-gradient(135deg, #162353 0%, #1E3A8A 45%, #1e40af 75%, #0369a1 100%)',
              minHeight: 200,
              transition: 'background 0.5s ease',
            }}>
            {/* Holographic shimmer overlay */}
            <div className="absolute inset-0 opacity-[0.06]" style={{
              background: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(255,255,255,0.5) 2px, rgba(255,255,255,0.5) 4px)',
            }} />
            {/* Top row */}
            <div className="relative z-10 flex justify-between items-start mb-6">
              <div>
                <p className="text-[10px] text-white/50 font-semibold uppercase tracking-widest">Vexa Bank</p>
                <p className="text-[11px] text-white/80 font-medium mt-0.5">Virtual Debit Card</p>
              </div>
              {/* Chip */}
              <div className="w-10 h-7 rounded-md bg-gradient-to-br from-yellow-300 to-yellow-500 relative overflow-hidden shadow-lg">
                <div className="absolute inset-0 grid grid-cols-3 gap-px p-0.5 opacity-60">
                  {Array.from({length:9}).map((_,i) => <div key={i} className="bg-yellow-700/50 rounded-[1px]"/>)}
                </div>
              </div>
            </div>
            {/* NFC icon */}
            <div className="relative z-10 mb-4">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5">
                <path d="M12 2a10 10 0 0 1 0 20" strokeLinecap="round"/>
                <path d="M12 6a6 6 0 0 1 0 12" strokeLinecap="round"/>
                <path d="M12 10a2 2 0 0 1 0 4" strokeLinecap="round"/>
              </svg>
            </div>
            {/* Card number */}
            <p className="relative z-10 text-[19px] font-bold tracking-[5px] mb-5 font-mono">
              {showNum ? '5399 1234 5678 9012' : '•••• •••• •••• 9012'}
            </p>
            {/* Bottom row */}
            <div className="relative z-10 flex items-end justify-between">
              <div>
                <p className="text-[9px] text-white/40 uppercase tracking-widest font-semibold">Card Holder</p>
                <p className="text-[13px] font-bold tracking-wide mt-0.5">{cardName}</p>
              </div>
              <div>
                <p className="text-[9px] text-white/40 uppercase tracking-widest font-semibold">Expires</p>
                <p className="text-[13px] font-bold mt-0.5">08/29</p>
              </div>
              {/* Mastercard circles */}
              <div className="flex items-center">
                <div className="w-9 h-9 rounded-full opacity-90" style={{ background:'#EB001B' }} />
                <div className="w-9 h-9 rounded-full -ml-4 opacity-90" style={{ background:'#F79E1B', mixBlendMode:'multiply' }} />
              </div>
            </div>
            {/* Frozen overlay */}
            {frozen && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-3xl"
                style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)' }}>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="2" x2="12" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                </svg>
                <p className="text-white font-bold text-[15px] tracking-wide">❄️ Card Frozen</p>
                <p className="text-white/60 text-[11px]">Tap Unfreeze to re-enable</p>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-4 gap-2.5 px-4 pb-2 pt-1">
          {[
            { label: showNum ? 'Hide' : 'Show', icon: showNum ? '🙈' : '👁️', action: () => setShowNum(v=>!v), active: showNum },
            { label: frozen ? 'Unfreeze' : 'Freeze', icon: frozen ? '🔓' : '❄️', action: () => setFrozen(v=>!v), active: frozen },
            { label: 'Change PIN', icon: '🔑', action: () => navigate('/change-pin'), active: false },
            { label: 'Block Card', icon: '🚫', action: () => {}, active: false },
          ].map(a => (
            <button key={a.label} onClick={a.action}
              className={`rounded-2xl py-3.5 flex flex-col items-center gap-1.5 border transition-all active:scale-95 ${
                a.active ? 'bg-[#162353] border-[#162353]' : 'bg-white border-[#F0F0F0]'
              }`}>
              <span className="text-[20px]">{a.icon}</span>
              <span className={`text-[10px] font-semibold text-center leading-tight ${a.active ? 'text-white' : 'text-[#333]'}`}>{a.label}</span>
            </button>
          ))}
        </div>

        {/* Spending summary strip */}
        <div className="mx-4 mb-3 bg-white rounded-2xl border border-[#F0F0F0] px-4 py-3 flex gap-4">
          <div className="flex-1 text-center">
            <p className="text-[10px] text-[#888] font-medium">Spent Today</p>
            <p className="text-[15px] font-extrabold text-[#EF4444] mt-0.5">₦7,300</p>
          </div>
          <div className="w-px bg-[#F0F0F0]" />
          <div className="flex-1 text-center">
            <p className="text-[10px] text-[#888] font-medium">This Month</p>
            <p className="text-[15px] font-extrabold text-[#EF4444] mt-0.5">₦31,900</p>
          </div>
          <div className="w-px bg-[#F0F0F0]" />
          <div className="flex-1 text-center">
            <p className="text-[10px] text-[#888] font-medium">Daily Limit</p>
            <p className="text-[15px] font-extrabold text-[#162353] mt-0.5">₦500k</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex mx-4 mb-3 bg-[#F0F0F0] rounded-xl p-1">
          {([['details','Details'],['transactions','Transactions'],['limits','Controls']] as const).map(([k,label]) => (
            <button key={k} onClick={() => setCardTab(k)}
              className={`flex-1 py-1.5 rounded-lg text-[12px] font-bold transition-all ${activeTab===k ? 'bg-white text-[#162353] shadow-sm' : 'text-[#888]'}`}>
              {label}
            </button>
          ))}
        </div>

        {/* Details Tab */}
        {activeTab === 'details' && (
          <div className="px-4 space-y-3 pb-6">
            <div className="bg-white rounded-2xl border border-[#F0F0F0] overflow-hidden">
              {[
                { label:'Card Type',      val:'Mastercard Virtual Debit' },
                { label:'Card Status',    val: frozen ? '❄️ Frozen' : '✅ Active' },
                { label:'Card Number',    val: showNum ? '5399 1234 5678 9012' : '•••• •••• •••• 9012' },
                { label:'CVV',            val: showNum ? '742' : '•••' },
                { label:'Expiry Date',    val:'08/29' },
                { label:'Billing Address',val:'Lagos, Nigeria' },
              ].map((d, i, arr) => (
                <div key={d.label} className={`flex items-center justify-between px-4 py-3.5 ${i < arr.length-1 ? 'border-b border-[#F5F5F5]' : ''}`}>
                  <span className="text-[12px] text-[#888]">{d.label}</span>
                  <span className="text-[13px] font-semibold text-[#111] font-mono">{d.val}</span>
                </div>
              ))}
            </div>

            <div className="bg-[#EEF2FF] rounded-2xl p-4 flex items-center justify-between border border-[#C7D7F5]">
              <div>
                <p className="text-[13px] font-bold text-[#162353]">Get a Physical Card</p>
                <p className="text-[11px] text-[#555] mt-0.5">Delivered in 3–5 business days · Free</p>
              </div>
              <button className="bg-[#162353] text-white text-[11px] font-semibold px-3 py-2 rounded-xl">Request</button>
            </div>
          </div>
        )}

        {/* Transactions Tab */}
        {activeTab === 'transactions' && (
          <div className="px-4 pb-6 space-y-2">
            <p className="text-[11px] font-semibold text-[#888] uppercase tracking-wide px-1 mb-3">Recent Card Transactions</p>
            <div className="bg-white rounded-2xl border border-[#F0F0F0] overflow-hidden">
              {CARD_TXS.map((tx, i) => (
                <div key={tx.name} className={`flex items-center gap-3 px-4 py-3.5 ${i < CARD_TXS.length-1 ? 'border-b border-[#F5F5F5]' : ''}`}>
                  <div className="w-10 h-10 rounded-full bg-[#F8F9FB] flex items-center justify-center text-[20px] shrink-0">{tx.icon}</div>
                  <div className="flex-1">
                    <p className="text-[13px] font-semibold text-[#111]">{tx.name}</p>
                    <p className="text-[11px] text-[#888]">{tx.date}</p>
                  </div>
                  <span className="text-[13px] font-bold text-[#EF4444]">{tx.amount}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Controls Tab */}
        {activeTab === 'limits' && (
          <div className="px-4 pb-6 space-y-3">
            <p className="text-[11px] font-semibold text-[#888] uppercase tracking-wide px-1">Payment Controls</p>
            <div className="bg-white rounded-2xl border border-[#F0F0F0] overflow-hidden">
              {[
                { label:'Online Payments',   sub:'E-commerce & web transactions', state: onlinePayments,  toggle: () => setOnline(v=>!v) },
                { label:'Contactless / NFC', sub:'Tap-to-pay at terminals',       state: contactless,    toggle: () => setContactless(v=>!v) },
                { label:'International',     sub:'Transactions outside Nigeria',  state: intlPayments,   toggle: () => setIntl(v=>!v) },
              ].map((item, i, arr) => (
                <div key={item.label} className={`flex items-center gap-3 px-4 py-4 ${i < arr.length-1 ? 'border-b border-[#F5F5F5]' : ''}`}>
                  <div className="flex-1">
                    <p className="text-[13px] font-semibold text-[#111]">{item.label}</p>
                    <p className="text-[11px] text-[#888] mt-0.5">{item.sub}</p>
                  </div>
                  <button onClick={item.toggle}
                    className={`w-11 h-6 rounded-full transition-colors relative ${item.state ? 'bg-[#162353]' : 'bg-[#D1D5DB]'}`}>
                    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${item.state ? 'left-5' : 'left-0.5'}`} />
                  </button>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-2xl border border-[#F0F0F0] overflow-hidden">
              <div className="px-4 py-3 border-b border-[#F5F5F5]">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-[13px] font-semibold text-[#111]">Daily Spend Limit</p>
                    <p className="text-[11px] text-[#888] mt-0.5">Maximum per day</p>
                  </div>
                  <p className="text-[14px] font-bold text-[#162353]">₦500,000</p>
                </div>
                <div className="mt-3 h-2 bg-[#F0F0F0] rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-[#162353]" style={{ width:'6.38%' }} />
                </div>
                <p className="text-[10px] text-[#888] mt-1">₦31,900 used · ₦468,100 remaining</p>
              </div>
              <div className="px-4 py-3">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-[13px] font-semibold text-[#111]">Monthly Limit</p>
                    <p className="text-[11px] text-[#888] mt-0.5">Maximum per month</p>
                  </div>
                  <p className="text-[14px] font-bold text-[#162353]">₦2,000,000</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
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

/* ─── Cashback Page ──────────────────────────────────────────────────── */
function CashbackPage() {
  const [, navigate] = useLocation();
  const [redeemed, setRedeemed] = useState(false);

  const totalEarned = 1450;
  const pending     = 200;
  const redeemable  = totalEarned - pending;

  const history = [
    { id: 1, desc: 'Transfer to GTB •••7892',   date: '28 Jul 2026', rate: '2%', earned: 100 },
    { id: 2, desc: 'Airtime – MTN ₦2,000',      date: '25 Jul 2026', rate: '5%', earned: 100 },
    { id: 3, desc: 'Data – Airtel 5GB',          date: '22 Jul 2026', rate: '5%', earned: 250 },
    { id: 4, desc: 'Transfer to Access •••3301', date: '19 Jul 2026', rate: '2%', earned: 200 },
    { id: 5, desc: 'Education – UNILAG fees',    date: '14 Jul 2026', rate: '3%', earned: 600 },
    { id: 6, desc: 'Betting – Betway wallet',    date: '10 Jul 2026', rate: '1%', earned: 200 },
  ];

  const rates = [
    { label: 'Transfers',  rate: '2%', icon: '↗' },
    { label: 'Airtime',    rate: '5%', icon: '📶' },
    { label: 'Data',       rate: '5%', icon: '🌐' },
    { label: 'Education',  rate: '3%', icon: '🎓' },
    { label: 'Betting',    rate: '1%', icon: '🎲' },
    { label: 'Savings',    rate: '4%', icon: '🏦' },
  ];

  if (redeemed) {
    return (
      <div className="fixed inset-0 bg-white flex flex-col items-center justify-center px-6" style={{ fontFamily: "'Inter', sans-serif" }}>
        <div className="w-20 h-20 rounded-full bg-yellow-50 flex items-center justify-center mb-5 text-[36px]">🪙</div>
        <p className="text-[20px] font-bold text-[#111] mb-1">Cashback Redeemed!</p>
        <p className="text-[13px] text-[#888] text-center mb-8">₦{redeemable.toLocaleString('en-NG')}.00 has been added to your Vexa wallet.</p>
        <button onClick={() => navigate('/')} className="w-full max-w-xs bg-[#162353] rounded-xl h-[50px] text-[14px] font-semibold text-white">Back to Home</button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-[#F2F3F5] flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div className="flex-none flex items-center gap-3 px-4 pb-3 bg-white border-b border-[#E8EBF0]"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}>
        <button onClick={() => navigate('/')} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <span className="text-[16px] font-bold text-[#111]">Cashback</span>
      </div>

      <div className="flex-1 overflow-y-auto py-4 px-4 space-y-4" style={{ scrollbarWidth: 'none' }}>

        {/* Hero balance card */}
        <div className="bg-[#162353] rounded-2xl px-5 py-5 relative overflow-hidden">
          <div className="absolute -top-4 -right-4 w-24 h-24 rounded-full opacity-10 bg-white" />
          <div className="absolute bottom-[-20px] right-[40px] w-16 h-16 rounded-full opacity-5 bg-white" />
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-full bg-yellow-400/20 flex items-center justify-center">
              <span className="text-[14px]">🪙</span>
            </div>
            <span className="text-white/70 text-[12px] font-medium">Total Earned</span>
          </div>
          <p className="text-[28px] font-extrabold text-white mb-1">₦{totalEarned.toLocaleString('en-NG')}.00</p>
          <div className="flex gap-4 mt-3">
            <div className="bg-white/10 rounded-xl px-4 py-2.5 flex-1">
              <p className="text-[10px] text-white/60 mb-0.5">Redeemable</p>
              <p className="text-[15px] font-bold text-white">₦{redeemable.toLocaleString('en-NG')}.00</p>
            </div>
            <div className="bg-white/10 rounded-xl px-4 py-2.5 flex-1">
              <p className="text-[10px] text-white/60 mb-0.5">Pending</p>
              <p className="text-[15px] font-bold text-yellow-300">₦{pending.toLocaleString('en-NG')}.00</p>
            </div>
          </div>
          <button
            onClick={() => setRedeemed(true)}
            className="mt-4 w-full bg-yellow-400 rounded-xl h-[42px] text-[13px] font-bold text-[#111] active:bg-yellow-300 transition-colors flex items-center justify-center gap-2"
          >
            <Gift className="w-4 h-4" />
            Redeem ₦{redeemable.toLocaleString('en-NG')}.00 to Wallet
          </button>
        </div>

        {/* Cashback rates */}
        <div>
          <p className="text-[11px] font-semibold text-[#888] uppercase tracking-wide mb-2 px-1">Cashback Rates</p>
          <div className="grid grid-cols-3 gap-2">
            {rates.map(r => (
              <div key={r.label} className="bg-white rounded-2xl border border-[#F0F0F0] px-3 py-3 flex flex-col items-center gap-1.5" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <span className="text-[20px]">{r.icon}</span>
                <span className="text-[12px] font-bold text-[#162353]">{r.rate}</span>
                <span className="text-[10px] text-[#888] font-medium">{r.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Earning history */}
        <div>
          <p className="text-[11px] font-semibold text-[#888] uppercase tracking-wide mb-2 px-1">Earning History</p>
          <div className="bg-white rounded-2xl border border-[#F0F0F0] overflow-hidden">
            {history.map((item, i) => (
              <div key={item.id} className={`flex items-center gap-3.5 px-4 py-3.5 ${i < history.length - 1 ? 'border-b border-[#F5F5F5]' : ''}`}>
                <div className="w-9 h-9 rounded-full bg-yellow-50 flex items-center justify-center flex-shrink-0">
                  <Percent className="w-4 h-4 text-yellow-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-[#111] truncate">{item.desc}</p>
                  <p className="text-[11px] text-[#888] mt-0.5">{item.date} · {item.rate} cashback</p>
                </div>
                <span className="text-[13px] font-bold text-[#16A34A] flex-shrink-0">+₦{item.earned}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Info note */}
        <div className="bg-[#F0F4FF] border border-[#C7D7FF] rounded-2xl px-4 py-4">
          <p className="text-[12px] font-bold text-[#162353] mb-1 flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5" /> How it works
          </p>
          <p className="text-[11px] text-[#555] leading-relaxed">Earn cashback on every transaction. Pending cashback clears after 7 days and can then be redeemed to your Vexa wallet instantly.</p>
        </div>

        <div className="pb-2" />
      </div>
    </div>
  );
}

/* ─── Referrals Page ─────────────────────────────────────────────────── */
function ReferralsPage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);

  const refCode = 'VEXA-' + (user?.accountNumber?.slice(-4) ?? '2032');

  const referrals = [
    { name: 'Amara Okafor',    phone: '080***4521', date: '25 Jul 2026', earned: 10000, status: 'paid' },
    { name: 'Emeka Nwosu',     phone: '081***9034', date: '18 Jul 2026', earned: 10000, status: 'paid' },
    { name: 'Fatima Bello',    phone: '090***1122', date: '10 Jul 2026', earned: 10000, status: 'paid' },
    { name: 'Tunde Bakare',    phone: '080***7743', date: '2 Jul 2026',  earned: 10000, status: 'pending' },
    { name: 'Ngozi Eze',       phone: '081***3308', date: '24 Jun 2026', earned: 10000, status: 'paid' },
  ];

  const totalEarned  = referrals.filter(r => r.status === 'paid').length * 10000;
  const totalPending = referrals.filter(r => r.status === 'pending').length * 10000;

  function copyCode() {
    navigator.clipboard.writeText(refCode).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function shareCode() {
    if (navigator.share) {
      navigator.share({ title: 'Join Vexa!', text: `Use my referral code ${refCode} on Vexa and we both earn ₦10,000 when you make your first transfer. Download at vexa.app` });
    } else {
      copyCode();
    }
  }

  return (
    <div className="fixed inset-0 bg-[#F2F3F5] flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div className="flex-none flex items-center gap-3 px-4 pb-3 bg-white border-b border-[#E8EBF0]"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}>
        <button onClick={() => navigate('/')} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <span className="text-[16px] font-bold text-[#111]">Refer & Earn</span>
      </div>

      <div className="flex-1 overflow-y-auto py-4 px-4 space-y-4" style={{ scrollbarWidth: 'none' }}>

        {/* Hero */}
        <div className="bg-[#162353] rounded-2xl px-5 py-5 relative overflow-hidden">
          <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full opacity-10 bg-white" />
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-full bg-green-400/20 flex items-center justify-center">
              <Users className="w-4 h-4 text-green-300" />
            </div>
            <span className="text-white/70 text-[12px] font-medium">{referrals.length} friends referred</span>
          </div>
          <p className="text-[12px] text-white/60 mb-0.5">Total Earned</p>
          <p className="text-[28px] font-extrabold text-white mb-3">₦{totalEarned.toLocaleString('en-NG')}.00</p>

          {totalPending > 0 && (
            <div className="bg-white/10 rounded-xl px-4 py-2 mb-3 flex items-center justify-between">
              <span className="text-[12px] text-white/70">Pending (awaiting 1st transfer)</span>
              <span className="text-[13px] font-bold text-yellow-300">₦{totalPending.toLocaleString('en-NG')}</span>
            </div>
          )}

          {/* Referral code */}
          <div className="bg-white/15 rounded-xl px-4 py-3 flex items-center justify-between mb-3">
            <div>
              <p className="text-[10px] text-white/60 mb-0.5">Your referral code</p>
              <p className="text-[18px] font-extrabold text-white tracking-widest">{refCode}</p>
            </div>
            <button onClick={copyCode} className="flex items-center gap-1.5 bg-white/20 rounded-lg px-3 py-2 active:bg-white/30 transition-colors">
              {copied
                ? <BadgeCheck className="w-4 h-4 text-green-300" />
                : <Copy className="w-4 h-4 text-white" />}
              <span className="text-[11px] font-semibold text-white">{copied ? 'Copied!' : 'Copy'}</span>
            </button>
          </div>

          {/* Share button */}
          <button
            onClick={shareCode}
            className="w-full bg-green-400 rounded-xl h-[42px] text-[13px] font-bold text-[#111] active:bg-green-300 transition-colors flex items-center justify-center gap-2"
          >
            <Share2 className="w-4 h-4" />
            Share &amp; Earn ₦10,000 per Referral
          </button>
        </div>

        {/* How it works steps */}
        <div>
          <p className="text-[11px] font-semibold text-[#888] uppercase tracking-wide mb-2 px-1">How it works</p>
          <div className="bg-white rounded-2xl border border-[#F0F0F0] overflow-hidden">
            {[
              { step: '1', title: 'Share your code', desc: 'Send your unique code to friends and family.', icon: Share2 },
              { step: '2', title: 'They sign up',     desc: 'Your friend creates a Vexa account using your code.', icon: Users },
              { step: '3', title: 'Both earn ₦10,000', desc: 'You both get ₦10,000 when they complete their first transfer.', icon: Gift },
            ].map((s, i, arr) => {
              const Icon = s.icon;
              return (
                <div key={s.step} className={`flex items-start gap-3.5 px-4 py-4 ${i < arr.length - 1 ? 'border-b border-[#F5F5F5]' : ''}`}>
                  <div className="w-8 h-8 rounded-full bg-[#162353] flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Icon className="w-3.5 h-3.5 text-white" />
                  </div>
                  <div>
                    <p className="text-[13px] font-bold text-[#111]">{s.title}</p>
                    <p className="text-[12px] text-[#888] mt-0.5 leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Referred friends list */}
        <div>
          <p className="text-[11px] font-semibold text-[#888] uppercase tracking-wide mb-2 px-1">Referred Friends</p>
          <div className="bg-white rounded-2xl border border-[#F0F0F0] overflow-hidden">
            {referrals.map((r, i) => (
              <div key={r.name} className={`flex items-center gap-3.5 px-4 py-3.5 ${i < referrals.length - 1 ? 'border-b border-[#F5F5F5]' : ''}`}>
                <div className="w-9 h-9 rounded-full bg-[#EEF2FF] flex items-center justify-center flex-shrink-0">
                  <span className="text-[13px] font-bold text-[#162353]">{r.name[0]}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-[#111]">{r.name}</p>
                  <p className="text-[11px] text-[#888] mt-0.5">{r.phone} · {r.date}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[13px] font-bold text-[#16A34A]">+₦{r.earned.toLocaleString('en-NG')}</p>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${r.status === 'paid' ? 'bg-green-50 text-green-600' : 'bg-yellow-50 text-yellow-600'}`}>
                    {r.status === 'paid' ? 'Paid' : 'Pending'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="pb-2" />
      </div>
    </div>
  );
}

/* ── Business security gate ─────────────────────────────────────────── */
function BusinessSecurityGate({ children }: { children: React.ReactNode }) {
  const { isVerified } = useBusinessSecurity();
  if (!isVerified) return <BusinessSecurityScreen />;
  return <>{children}</>;
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
      <Route path="/notifications" component={NotificationsPage} />
      <Route path="/about-vexa" component={AboutVexaPage} />
      <Route path="/cashback" component={CashbackPage} />
      <Route path="/referrals" component={ReferralsPage} />
      {/* Vexa Business — onboarding is unguarded; all other routes require security verification */}
      <Route path="/business/onboarding" component={BusinessOnboarding} />
      <Route path="/business">
        <BusinessSecurityGate><BusinessDashboard /></BusinessSecurityGate>
      </Route>
      <Route path="/business/transfers">
        <BusinessSecurityGate><BusinessTransfers /></BusinessSecurityGate>
      </Route>
      <Route path="/business/receive">
        <BusinessSecurityGate><BusinessTransfers /></BusinessSecurityGate>
      </Route>
      <Route path="/business/bills">
        <BusinessSecurityGate><BusinessBills /></BusinessSecurityGate>
      </Route>
      <Route path="/business/employees">
        <BusinessSecurityGate><EmployeeManagement /></BusinessSecurityGate>
      </Route>
      <Route path="/business/payroll">
        <BusinessSecurityGate><PayrollManagement /></BusinessSecurityGate>
      </Route>
      <Route path="/business/analytics">
        <BusinessSecurityGate><BusinessAnalytics /></BusinessSecurityGate>
      </Route>
      <Route path="/business/settings">
        <BusinessSecurityGate><BusinessSettings /></BusinessSecurityGate>
      </Route>
      <Route path="/business/transactions">
        <BusinessSecurityGate><BusinessTransactionHistory /></BusinessSecurityGate>
      </Route>
      <Route path="/business/notifications">
        <BusinessSecurityGate><NotificationsPage /></BusinessSecurityGate>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

/* Handles post-splash redirect — must live inside WouterRouter + AuthProvider */
function AppShell() {
  const [showSplash, setShowSplash] = useState(true);
  const [splashDone, setSplashDone] = useState(false);
  const { isAuthenticated, signOut } = useAuth();
  const [path, navigate] = useLocation();
  const { clearVerification } = useBusinessSecurity();
  const prevPathRef = React.useRef('');

  // ── Passcode-on-return lock ──────────────────────────────────────────
  // Initialise locked state: if a lock timestamp is already in localStorage
  // AND it's ≥ 5 min old AND the pref is on, lock immediately on mount.
  const [locked, setLocked] = useState(() => {
    const pref = localStorage.getItem(PASSCODE_RETURN_KEY) === 'true';
    return pref && shouldLockNow();
  });

  // Write the "hidden at" timestamp whenever the page is hidden / unloaded.
  // Read it back whenever the page becomes visible again.
  useEffect(() => {
    function onHide() {
      if (localStorage.getItem(PASSCODE_RETURN_KEY) === 'true') {
        writeLockTimestamp();
      }
    }

    function onShow() {
      const pref = localStorage.getItem(PASSCODE_RETURN_KEY) === 'true';
      if (pref && isAuthenticated && splashDone && shouldLockNow()) {
        setLocked(true);
      }
      // Whether we lock or not, clear the stored timestamp so a quick
      // background → foreground within the same page cycle doesn't re-fire.
      clearLockTimestamp();
    }

    // visibilitychange: tab switch, minimise, screen-off on mobile
    function handleVisibility() {
      if (document.hidden) onHide(); else onShow();
    }

    // pagehide / pageshow: full page unload / back-forward cache restore
    // (iOS Safari & some Android browsers fire these instead of visibilitychange)
    function handlePageHide()  { onHide(); }
    function handlePageShow(e: PageTransitionEvent) {
      // persisted == came from BFCache (page was fully frozen)
      if (e.persisted) onShow();
    }

    // beforeunload: user closes the tab entirely
    function handleBeforeUnload() { onHide(); }

    // focus / blur on the window itself (desktop tab switch fallback)
    function handleBlur()  { onHide(); }
    function handleFocus() { onShow(); }

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pagehide',     handlePageHide);
    window.addEventListener('pageshow',     handlePageShow as EventListener);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('blur',         handleBlur);
    window.addEventListener('focus',        handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pagehide',     handlePageHide);
      window.removeEventListener('pageshow',     handlePageShow as EventListener);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('blur',         handleBlur);
      window.removeEventListener('focus',        handleFocus);
    };
  }, [isAuthenticated, splashDone]);

  useEffect(() => {
    if (splashDone && !isAuthenticated) {
      navigate('/signin');
    }
  }, [splashDone, isAuthenticated]);

  // Clear business verification when the user navigates away from the business section
  useEffect(() => {
    const wasOnBusiness = prevPathRef.current.startsWith('/business');
    const isOnBusiness = path.startsWith('/business');
    if (wasOnBusiness && !isOnBusiness) {
      clearVerification();
    }
    prevPathRef.current = path;
  }, [path]);

  return (
    <>
      {showSplash && (
        <SplashScreen onDone={() => {
          setShowSplash(false);
          setSplashDone(true);
        }} />
      )}
      <Router />
      {locked && (
        <PasscodeLockScreen
          onUnlock={() => { clearLockTimestamp(); setLocked(false); }}
          onSignOut={() => { clearLockTimestamp(); setLocked(false); signOut(); navigate('/signin'); }}
        />
      )}
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BusinessProvider>
          <BusinessSecurityProvider>
            <TooltipProvider>
              <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
                <AppShell />
              </WouterRouter>
              <Toaster />
            </TooltipProvider>
          </BusinessSecurityProvider>
        </BusinessProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
