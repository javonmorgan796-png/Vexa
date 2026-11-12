import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Route, Switch, Router as WouterRouter, useLocation, useRoute } from 'wouter';
import {
  Headphones, Bell, Copy, EyeOff, Eye, Clock,
  ArrowLeftRight, PhoneCall, Tablet,
  PiggyBank, BookOpen, FileText, LayoutGrid,
  Trophy, CreditCard, Home, ArrowDown, Settings,
  ArrowUp, ChevronRight, Shield, TriangleAlert, Fingerprint, BriefcaseBusiness,
  BellRing, Volume2, VolumeX, HelpCircle, Info, LogOut, User, Lock,
  MessageCircle, Phone, Mail, ExternalLink, Star, ChevronDown,
  Send, X, Bot, CheckCheck, Wifi, Paperclip, ImagePlus, FileUp, FileText as FileIcon,
  Gift, Users, Share2, Percent, TrendingUp, BadgeCheck, ChevronUp,
  WalletCards, Plus, Trash2, Check, Coins,
  Sun, Moon, Smartphone, ShieldCheck,
} from 'lucide-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import AdminDashboardPage from '@/pages/admin/AdminDashboardPage';
import SignInPage from '@/pages/auth/SignInPage';
import SignUpPage from '@/pages/auth/SignUpPage';
import ForgotPasscodePage from '@/pages/auth/ForgotPasscodePage';
import ProfilePage from '@/pages/settings/ProfilePage';
import LimitsPage from '@/pages/settings/LimitsPage';
import ChangePinPage from '@/pages/settings/ChangePinPage';
import ChangePasswordPage from '@/pages/settings/ChangePasswordPage';
import TwoFactorSettingsPage from '@/pages/settings/TwoFactorSettingsPage';
import TwoFactorChallenge from '@/pages/settings/TwoFactorChallenge';
import CryptoExchangePage from '@/pages/crypto/CryptoExchangePage';
import { IncomingCryptoPage, OutgoingCryptoPage } from '@/pages/crypto/CryptoHistoryPage';
import VexaTransferPage from '@/pages/transfer/VexaTransferPage';
import BankSelectionPage from '@/pages/transfer/BankSelectionPage';
import { TransferConfirmationModal, PaymentPinModal } from '@/components/transfer/TransferModals';
import { BankLogoBadge, resolveBankLogoUrl } from '@/components/BankLogoBadge';
import { BankingTransferReceipt } from '@/components/transfer/BankingTransferReceipt';
import { InsufficientFundsModal, TransferSuccessfulModal } from '@/components/common/BankingStatusModals';
import { TelecomCheckoutModal } from '@/components/telecom/TelecomCheckoutModal';
import { CryptoDepositToastContainer } from '@/components/crypto/CryptoDepositToast';
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
import { UserDataProvider, useUserData } from '@/context/UserDataContext';
import { VexaFinanceProvider, type CryptoAsset } from '@/context/VexaFinanceContext';
import { AccountSecurityProvider, useAccountSecurity } from '@/context/AccountSecurityContext';
import type { AppNotification, AppTransaction } from '@/context/UserDataContext';
import { CRYPTO_ASSET_META, CryptoAssetLogo } from '@/components/crypto/CryptoActivityDetailsModal';
import BusinessSecurityScreen from '@/pages/business/BusinessSecurityScreen';
import {
  LOGIN_FAILURE_LIMIT,
  LOGIN_LOCKOUT_MS,
  normalizeLoginPhone,
} from '@/lib/authSecurity';

const queryClient = new QueryClient();

type ThemeMode = 'light' | 'dark' | 'system';
const THEME_MODE_KEY = 'vexa_theme_mode';
const ThemeModeContext = React.createContext<{
  themeMode: ThemeMode;
  resolvedThemeMode: 'light' | 'dark';
  setThemeMode: (mode: ThemeMode) => void;
} | null>(null);

function ThemeModeProvider({ children }: { children: React.ReactNode }) {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => {
    const stored = localStorage.getItem(THEME_MODE_KEY);
    return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
  });
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(() => (
    window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  ));
  const resolvedThemeMode = themeMode === 'system' ? systemTheme : themeMode;

  const setThemeMode = useCallback((mode: ThemeMode) => {
    setThemeModeState(mode);
    localStorage.setItem(THEME_MODE_KEY, mode);
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemThemeChange = (event: MediaQueryListEvent) => {
      setSystemTheme(event.matches ? 'dark' : 'light');
    };
    setSystemTheme(mediaQuery.matches ? 'dark' : 'light');
    mediaQuery.addEventListener('change', handleSystemThemeChange);
    return () => mediaQuery.removeEventListener('change', handleSystemThemeChange);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolvedThemeMode === 'dark');
    document.documentElement.style.colorScheme = resolvedThemeMode;
  }, [resolvedThemeMode]);

  return (
    <ThemeModeContext.Provider value={{ themeMode, resolvedThemeMode, setThemeMode }}>
      {children}
    </ThemeModeContext.Provider>
  );
}

function useThemeMode() {
  const context = React.useContext(ThemeModeContext);
  if (!context) throw new Error('useThemeMode must be used inside ThemeModeProvider');
  return context;
}

function timeSince(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes === 1) return '1 minute ago';
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours === 1) return '1 hour ago';
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

/* ─── Splash / Loading screen ───────────────────────────────────────── */
function SplashScreen({ onDone }: { onDone: () => void }) {
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    // Keep the branded intro brief so returning users reach the app quickly.
    const fadeTimer = setTimeout(() => setFadeOut(true), 650);
    const doneTimer = setTimeout(() => onDone(), 1050);
    return () => { clearTimeout(fadeTimer); clearTimeout(doneTimer); };
  }, [onDone]);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{
        background: 'radial-gradient(circle at 50% 42%, #22262F 0%, #181A20 58%, #0B0E11 100%)',
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
          0%, 100% { filter: drop-shadow(0 0 0px rgba(240, 185, 11, 0)); }
          50%       { filter: drop-shadow(0 0 22px rgba(240, 185, 11, 0.35)) drop-shadow(0 0 40px rgba(240, 185, 11, 0.16)); }
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
          background: linear-gradient(90deg, #EAECEF 0%, #F0B90B 40%, #EAECEF 60%, #EAECEF 100%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: vexaPulse 1s cubic-bezier(.22,.61,.36,1) 0.3s both,
                     vexaShimmer 1.8s linear 1s infinite;
        }
      `}</style>

      <div className="flex flex-col items-center gap-5">
        <img
          src="/assets/aistudio/c4e1e122-cd74-4d18-b5b5-37dafb3a53f6_e2d23c37.png"
          alt="Vexa"
          className="vexa-logo w-[210px] sm:w-[240px] max-w-[65vw] object-contain"
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

function BettingBasketballIcon({
  className = '',
  size = 22,
}: {
  className?: string;
  size?: number;
  strokeWidth?: number;
}) {
  return (
    <i
      className={`fa-solid fa-basketball inline-flex items-center justify-center ${className}`}
      style={{ fontSize: `${size}px`, lineHeight: 1 }}
      aria-hidden="true"
    />
  );
}

const services = [
  { label: 'Transfer',  Icon: ArrowLeftRight },
  { label: 'Airtime',   Icon: PhoneCall       },
  { label: 'Data',      Icon: Tablet          },
  { label: 'Betting',   Icon: BettingBasketballIcon },
  { label: 'Savings',   Icon: PiggyBank       },
  { label: 'Investments', Icon: TrendingUp    },
  { label: 'Budget',    Icon: WalletCards     },
  { label: 'Education', Icon: BookOpen        },
  { label: 'Statement', Icon: FileText        },
  { label: 'Crypto',    Icon: Coins           },
  { label: 'More',      Icon: LayoutGrid      },
];

/* ─── Promo Banner Carousel ──────────────────────────────────────────── */
const PROMO_BANNERS = [
  {
    id: 'moneyworld',
    bg: '#F0EFFF',
    darkBg: '#211F3B',
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
    darkBg: '#382719',
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
    darkBg: '#12372E',
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
  const { resolvedThemeMode } = useThemeMode();
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
  const isDark = resolvedThemeMode === 'dark';

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
          background: isDark ? b.darkBg : b.bg,
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
            style={{ background: `${b.accent}${isDark ? '35' : '18'}`, color: b.accent }}>
            {b.badge}
          </span>
          <div className="theme-text-primary text-[14px] font-bold mb-1 leading-snug">{b.title}</div>
          <div className="theme-text-secondary text-[11px] leading-relaxed mb-2">{b.body}</div>
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
              background: i === current ? PROMO_BANNERS[current].accent : isDark ? 'var(--theme-border)' : '#D1D5DB',
            }} />
        ))}
      </div>
    </div>
  );
}

/* ─── Passcode Lock Screen (shown on app-return if setting is ON) ──── */
const PASSCODE_RETURN_KEY = 'vexa_passcode_on_return';
const RETURN_LOCKOUT_KEY = 'vexa_passcode_return_lockout';

type ReturnLockoutRecord = {
  attempts: number;
  lockedUntil: number | null;
};

function returnLockoutKey(phone: string | undefined) {
  return phone ? `${RETURN_LOCKOUT_KEY}_${normalizeLoginPhone(phone)}` : RETURN_LOCKOUT_KEY;
}

function loadReturnLockout(phone: string | undefined): ReturnLockoutRecord {
  try {
    const raw = localStorage.getItem(returnLockoutKey(phone));
    if (!raw) return { attempts: 0, lockedUntil: null };
    const parsed = JSON.parse(raw) as Partial<ReturnLockoutRecord>;
    return {
      attempts: typeof parsed.attempts === 'number' ? parsed.attempts : 0,
      lockedUntil: typeof parsed.lockedUntil === 'number' ? parsed.lockedUntil : null,
    };
  } catch {
    return { attempts: 0, lockedUntil: null };
  }
}

function saveReturnLockout(phone: string | undefined, record: ReturnLockoutRecord) {
  localStorage.setItem(returnLockoutKey(phone), JSON.stringify(record));
}

function clearReturnLockout(phone: string | undefined) {
  localStorage.removeItem(returnLockoutKey(phone));
}

/* ── Passcode Lock Screen ─────────────────────────────────────────────── */
function PasscodeLockScreen({
  onUnlock,
  onSignOut,
  onForgotPasscode,
}: {
  onUnlock: () => void;
  onSignOut: () => void;
  onForgotPasscode: () => void;
}) {
  const { user, profilePhoto, verifyPasscodeForAppReturn } = useAuth();
  const [pin, setPin]           = useState('');
  const [shake, setShake]       = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [attempts, setAttempts] = useState(() => loadReturnLockout(user?.phone).attempts);
  const [lockedUntil, setLockedUntil] = useState(() => loadReturnLockout(user?.phone).lockedUntil ?? 0);
  const [now, setNow] = useState(() => Date.now());
  const lockedOut = lockedUntil > now;
  const countdown = Math.max(0, lockedUntil - now);

  // Keep the local countdown refresh-safe even if the optional security
  // migration has not been installed yet. The RPC is still checked below
  // whenever it is available, so another device cannot bypass the delay.
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (lockedUntil > 0 && lockedUntil <= now) {
      clearReturnLockout(user?.phone);
      setLockedUntil(0);
      setAttempts(0);
      setErrorMsg('');
    }
  }, [lockedUntil, now, user?.phone]);

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

  async function verify(code: string) {
    if (lockedOut) {
      setErrorMsg('Too many failed attempts. Please wait for the security delay to finish.');
      return;
    }

    if (user) {
      const result = await verifyPasscodeForAppReturn(code);
      if (result.success) {
        clearReturnLockout(user.phone);
        setAttempts(0);
        setLockedUntil(0);
        onUnlock();
        return;
      }

      const previous = loadReturnLockout(user.phone);
      const nextAttempts = result.lockedUntil ? LOGIN_FAILURE_LIMIT : previous.attempts + 1;
      const nextLockedUntil = result.lockedUntil && result.lockedUntil > Date.now()
        ? result.lockedUntil
        : nextAttempts >= LOGIN_FAILURE_LIMIT
          ? Date.now() + LOGIN_LOCKOUT_MS
          : null;
      saveReturnLockout(user.phone, { attempts: nextAttempts, lockedUntil: nextLockedUntil });
      setAttempts(nextAttempts);
      setLockedUntil(nextLockedUntil ?? 0);
      setShake(true);
      setTimeout(() => { setShake(false); setPin(''); }, 500);

      if (nextLockedUntil) {
        setErrorMsg('Too many attempts — locked for 5 minutes');
      } else {
        setErrorMsg(`Incorrect passcode · ${LOGIN_FAILURE_LIMIT - nextAttempts} attempt${LOGIN_FAILURE_LIMIT - nextAttempts !== 1 ? 's' : ''} left`);
      }
      return;
    }
  }

  const firstName = user?.name?.split(' ')[0] ?? 'there';
  const initials  = (user?.name ?? 'U').split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div
      className="vexa-security-screen fixed inset-0 z-[9999] flex flex-col"
      style={{ fontFamily:"'Inter',sans-serif" }}
    >
      {/* Header area */}
      <div className="flex flex-col items-center pt-16 pb-4 px-6">
        {/* Avatar */}
        <div className="w-[76px] h-[76px] rounded-full bg-[#E8ECF2] dark:bg-white/10 shadow-[0_0_0_2px_rgba(217,155,0,0.45)] dark:shadow-[0_0_0_2px_rgba(240,185,11,0.45)] overflow-hidden flex items-center justify-center text-[#181A20] dark:text-white text-[24px] font-bold mb-4 shrink-0">
          {profilePhoto
            ? <img src={profilePhoto} alt="" className="w-full h-full object-cover" />
            : initials}
        </div>

        <p className="text-[#64748B] dark:text-[#848E9C] text-[13px] font-medium">Welcome back, {firstName}</p>
        <p className="text-[#181A20] dark:text-[#EAECEF] text-[20px] font-bold mt-1 mb-0.5">Verify it's you</p>
        <p className="text-[#64748B] dark:text-[#848E9C] text-[12px]">Session locked · enter your login passcode</p>
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
                ? 'bg-[#F0B90B] border-[#F0B90B] shadow-[0_0_8px_rgba(240,185,11,0.5)] scale-110'
                : 'border-[#CBD5E1] bg-transparent dark:bg-white/20'
            }`} />
          ))}
        </div>

        <div className="h-5">
          {lockedOut ? (
            <p className="text-orange-600 dark:text-orange-400 text-[12px] font-medium">
              Locked — try again in <span className="font-bold tabular-nums">{Math.ceil(countdown / 1000)}s</span>
            </p>
          ) : errorMsg ? (
            <p className="text-[#DC2626] dark:text-[#FF6B6B] text-[12px] font-medium">{errorMsg}</p>
          ) : null}
        </div>
      </div>

      {/* Keypad */}
      <div className="flex-1 flex flex-col justify-end pb-10 px-6">
        <div className="grid grid-cols-3 gap-3 w-full max-w-[288px] mx-auto mb-3">
          {['1','2','3','4','5','6','7','8','9'].map(k => (
            <button key={k} onClick={() => addDigit(k)} disabled={lockedOut}
              className="h-[56px] rounded-2xl text-[24px] font-semibold bg-white dark:bg-white/10 border border-[#E2E8F0] dark:border-white/10 text-[#181A20] dark:text-white shadow-xs dark:shadow-none active:bg-[#F1F5F9] dark:active:bg-white/20 transition-all active:scale-95 disabled:opacity-40">
              {k}
            </button>
          ))}

          {/* Bottom row: empty · 0 · backspace */}
          <div />

          <button onClick={() => addDigit('0')} disabled={lockedOut}
            className="h-[56px] rounded-2xl text-[24px] font-semibold bg-white dark:bg-white/10 border border-[#E2E8F0] dark:border-white/10 text-[#181A20] dark:text-white shadow-xs dark:shadow-none active:bg-[#F1F5F9] dark:active:bg-white/20 transition-all active:scale-95 disabled:opacity-40">
            0
          </button>

          <button onClick={removeDigit} disabled={lockedOut}
            className="h-[56px] rounded-2xl flex items-center justify-center bg-white dark:bg-white/10 border border-[#E2E8F0] dark:border-white/10 text-[#181A20] dark:text-white shadow-xs dark:shadow-none active:bg-[#F1F5F9] dark:active:bg-white/20 transition-all active:scale-95 disabled:opacity-40">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M20 12H8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
              <path d="M13 7l-5 5 5 5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        {/* Recovery & sign out links */}
        <div className="mt-4 flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={onForgotPasscode}
            className="text-[#9A6800] hover:text-[#7A5200] dark:text-[#F0B90B] dark:hover:text-[#FCD535] text-[13px] font-semibold text-center"
          >
            Forgot Passcode?
          </button>
          <button
            type="button"
            onClick={onSignOut}
            className="text-[#64748B] hover:text-[#181A20] dark:text-white/60 dark:hover:text-white/85 text-[12px] font-medium underline underline-offset-2 text-center"
          >
            Not you? Sign in with a different account
          </button>
        </div>
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

function TwoFactorWarningCard({ onEnable }: { onEnable: () => void }) {
  const { user } = useAuth();
  if (!user || user.twoFactorEnabled) return null;
  return (
    <div className="mx-3 mt-3">
      <button
        onClick={onEnable}
        className="w-full flex items-center gap-2.5 text-left bg-[#FFF8E8] rounded-xl px-3 py-2 border-0 outline-none ring-0 shadow-sm focus:outline-none focus:ring-0"
      >
        <div className="w-8 h-8 rounded-full bg-[#FDE7A9] flex items-center justify-center shrink-0">
          <TriangleAlert className="w-4 h-4 text-[#9A6800]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold text-[#6F4A00]">Secure your account</p>
          <p className="text-[10px] text-[#8A6A2C] mt-0.5">Enable 2FA to protect your balance</p>
        </div>
        <ChevronRight className="w-3.5 h-3.5 text-[#9A6800] shrink-0" />
      </button>
    </div>
  );
}

function MoniepointHome() {
  const [balanceHidden, setBalanceHidden] = useState(false);
  const [accountCopyStatus, setAccountCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const accountCopyTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [, navigate] = useLocation();
  const { user, profilePhoto } = useAuth();
  const { balance, lastBalanceUpdatedAt, cashbackTotal, referralTotalEarned, unreadNotificationsCount, transactions } = useUserData();
  const initials = (user?.name ?? 'C').split(' ').map((p: string) => p[0]).slice(0, 2).join('').toUpperCase();
  const displayName = user?.name ?? 'Your account';
  const accountNumber = user?.accountNumber ?? '—';

  useEffect(() => () => {
    if (accountCopyTimeout.current) clearTimeout(accountCopyTimeout.current);
  }, []);

  async function copyAccountNumber() {
    let copied = false;
    try {
      if (accountNumber && accountNumber !== '—' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(accountNumber);
        copied = true;
      }
    } catch {
      // Fall back to the legacy clipboard API when clipboard permissions are denied.
    }

    if (!copied && accountNumber && accountNumber !== '—') {
      let input: HTMLTextAreaElement | null = null;
      try {
        input = document.createElement('textarea');
        input.value = accountNumber;
        input.setAttribute('readonly', '');
        input.style.position = 'fixed';
        input.style.opacity = '0';
        document.body.appendChild(input);
        input.select();
        copied = document.execCommand('copy');
      } catch {
        copied = false;
      } finally {
        input?.remove();
      }
    }

    setAccountCopyStatus(copied ? 'copied' : 'error');
    if (accountCopyTimeout.current) clearTimeout(accountCopyTimeout.current);
    accountCopyTimeout.current = setTimeout(() => {
      setAccountCopyStatus('idle');
      accountCopyTimeout.current = null;
    }, 1800);
  }

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
            <button
              onClick={() => navigate('/notifications')}
              className="relative w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
              aria-label={`Notifications (${unreadNotificationsCount} unread)`}
            >
              <Bell className="w-6 h-6 text-[#222]" strokeWidth={1.75} />
              {unreadNotificationsCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold font-mono rounded-full flex items-center justify-center border-2 border-white shadow-xs animate-in zoom-in-75">
                  {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* ── Scrollable body ─────────────────────────────────────────── */}
        <div
          className="flex-1 overflow-y-auto pb-[76px]"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >

          <TwoFactorWarningCard onEnable={() => navigate('/two-factor')} />

          {/* ── Binance Themed Account Card ────────────────────────── */}
          <div className="mx-3 mt-3 bg-[#181A20] rounded-[20px] px-4 pt-3.5 pb-4 text-white relative overflow-hidden border border-[#2B313A] shadow-lg">

            {/* account number row */}
            <div className="relative z-10 mb-4 inline-flex max-w-full items-center gap-1.5 text-[12px] leading-4 font-normal text-[#848E9C]">
              <span className="font-mono text-[#EAECEF] font-semibold">{accountNumber}</span>
              <span className="text-[#848E9C]/60">|</span>
              <span className="min-w-0 truncate text-[#848E9C]">{displayName}</span>
              <button
                type="button"
                onClick={() => void copyAccountNumber()}
                disabled={!accountNumber || accountNumber === '—'}
                aria-label={accountCopyStatus === 'copied' ? 'Account number copied' : accountCopyStatus === 'error' ? 'Could not copy account number' : 'Copy account number'}
                title={accountCopyStatus === 'copied' ? 'Copied!' : 'Copy account number'}
                className="relative shrink-0 rounded p-0.5 text-[#F0B90B] hover:text-[#FCD535] transition-colors disabled:opacity-50"
              >
                {accountCopyStatus === 'copied'
                  ? <Check className="h-3.5 w-3.5 text-[#0ECB81]" />
                  : accountCopyStatus === 'error'
                    ? <X className="h-3.5 w-3.5 text-[#F6465D]" />
                    : <Copy className="h-3.5 w-3.5" />}
                {accountCopyStatus !== 'idle' && (
                  <span className={`absolute left-1/2 top-full z-20 mt-1 -translate-x-1/2 whitespace-nowrap rounded px-1.5 py-0.5 text-[9px] font-semibold ${accountCopyStatus === 'copied' ? 'bg-[#0ECB81] text-white' : 'bg-[#F6465D] text-white'}`}>
                    {accountCopyStatus === 'copied' ? 'Copied' : 'Copy failed'}
                  </span>
                )}
              </button>
              <span className="sr-only" aria-live="polite">
                {accountCopyStatus === 'copied' ? 'Account number copied to clipboard.' : accountCopyStatus === 'error' ? 'Could not copy account number.' : ''}
              </span>
            </div>

            {/* balance */}
            <div className="relative z-10 flex items-center gap-2.5 mb-1">
              <span className="text-[23px] font-bold tracking-tight leading-none text-white">
                {balanceHidden ? '* * * * *' : `₦${balance.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              </span>
              <button onClick={() => setBalanceHidden(v => !v)} className="focus:outline-none">
                {balanceHidden
                  ? <Eye className="w-[18px] h-[18px] text-[#848E9C] mt-0.5 hover:text-white transition-colors" strokeWidth={2} />
                  : <EyeOff className="w-[18px] h-[18px] text-[#848E9C] mt-0.5 hover:text-white transition-colors" strokeWidth={2} />
                }
              </button>
            </div>

            {/* last updated */}
            <p className="relative z-10 text-[11px] text-[#848E9C] font-normal mb-4 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0ECB81]" />
              Last updated {lastBalanceUpdatedAt ? timeSince(lastBalanceUpdatedAt) : 'updating…'}
            </p>

            {/* action buttons — Binance Yellow Deposit & Binance Dark History */}
            <div className="relative z-10 flex gap-3">
              <button
                onClick={() => navigate('/deposit')}
                className="home-deposit-button rounded-full h-9 px-4 inline-flex items-center gap-1.5 bg-[#F0B90B] hover:bg-[#FCD535] text-[#181A20] shadow-sm text-[12px] font-bold transition-all active:scale-[0.97]"
              >
                <span className="text-[17px] leading-none font-black">+</span>
                Deposit
              </button>
              <button
                onClick={() => navigate('/history')}
                className="rounded-full h-9 px-4 inline-flex items-center gap-1.5 bg-[#2B313A] hover:bg-[#363D47] text-[#EAECEF] shadow-sm text-[12px] font-semibold backdrop-blur-sm transition-all active:scale-[0.97]"
              >
                <Clock className="w-3.5 h-3.5 text-[#848E9C]" strokeWidth={2} />
                History
              </button>
            </div>
          </div>

          {/* ── Services ─────────────────────────────────────────────── */}
          {/* mt 16px, px 16px */}
          <div className="px-4 mt-4">
            <div className="flex justify-between items-center mb-2.5">
              <span className="theme-text-primary text-[12px] font-semibold">Services</span>
              <button className="text-[#2563EB] text-[11px] font-semibold">Edit</button>
            </div>

            {/* grid: 4 cols, gap 8px; tile h ~85px */}
            <div className="grid grid-cols-4 gap-2">
              {services.map(({ label, Icon }) => {
                const routes: Record<string,string> = {
                  Transfer:'/transfer', Airtime:'/airtime', Data:'/data',
                  Betting:'/betting', Savings:'/savings', Investments:'/investments', Education:'/education', Crypto:'/crypto',
                  Budget:'/budget', Statement:'/statement', More:'/more',
                };
                return (
                  <button
                    key={label}
                    data-testid={`button-home-service-${label.toLowerCase()}`}
                    onClick={() => navigate(routes[label] ?? '/')}
                    className="theme-surface theme-border rounded-xl py-3.5 px-1 flex flex-col items-center justify-center gap-2 border active:bg-[#F2F3F5]"
                  >
                    <Icon className="theme-icon" size={22} strokeWidth={1.75} />
                    <span className="theme-text-primary text-[11px] font-medium text-center leading-tight">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Vexa Business ─────────────────────────────────────────── */}
          <div className="px-4 mt-4">
            <button
              onClick={() => navigate('/business')}
              className="w-full bg-[#1E2329] rounded-2xl px-4 py-3.5 flex items-center gap-3 text-left border border-[#2B313A] active:scale-[0.99] transition-transform shadow-xs"
            >
              <div className="w-10 h-10 rounded-xl bg-[#F0B90B]/15 border border-[#F0B90B]/30 flex items-center justify-center shrink-0">
                <BriefcaseBusiness className="w-5 h-5 text-[#F0B90B]" strokeWidth={1.8} />
              </div>
              <div className="flex-1">
                <p className="text-[#EAECEF] text-[13px] font-bold">Vexa Business</p>
                <p className="text-[#848E9C] text-[11px] mt-0.5">Manage your business finances</p>
              </div>
              <ChevronRight className="w-4 h-4 text-[#848E9C]" />
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
                  <div className="text-[14px] font-bold text-[#111]">₦{cashbackTotal.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
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
                  <div className="text-[14px] font-bold text-[#111]">₦{referralTotalEarned.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-[#CBD5E1] shrink-0" />
              </button>
            </div>
          </div>

          {/* ── Recent transactions ──────────────────────────────────── */}
          <div className="px-4 mt-4">
            <div className="flex justify-between items-center mb-2.5">
              <span className="text-[12px] font-semibold text-[#111]">Recent transactions</span>
              <button onClick={() => navigate('/history')} className="text-[#2563EB] text-[11px] font-semibold">View All</button>
            </div>

            {transactions.length === 0 ? (
              <div className="bg-white rounded-xl p-4 border border-[#F0F0F0] flex items-center justify-center text-[#888]">
                <p className="text-[12px]">No transactions yet</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl p-4 border border-[#F0F0F0] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${transactions[0].type === 'in' ? 'bg-[#DCFCE7]' : 'bg-[#FEE2E2]'}`}>
                    {transactions[0].type === 'in'
                      ? <ArrowDown className="w-4 h-4 text-[#16A34A]" strokeWidth={2.5} />
                      : <ArrowUp   className="w-4 h-4 text-[#DC2626]" strokeWidth={2.5} />}
                  </div>
                  <div>
                    <div className="text-[13px] font-semibold text-[#111] leading-snug truncate max-w-[160px]">
                      {transactions[0].name}
                    </div>
                    <div className="text-[11px] text-[#888] font-normal mt-0.5">{transactions[0].date}</div>
                  </div>
                </div>
                <span className={`text-[13px] font-bold shrink-0 ${transactions[0].type === 'in' ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>
                  {transactions[0].type === 'in' ? '+' : '-'}₦{transactions[0].amount}
                </span>
              </div>
            )}
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
type TxFilter = 'all' | 'in' | 'out';

function HistoryPage() {
  const [, navigate] = useLocation();
  const [filter, setFilter] = useState<TxFilter>('all');
  const [search, setSearch] = useState('');
  const { transactions, transactionsLoading } = useUserData();

  const filtered = transactions.filter(tx => {
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
              className={`px-4 py-1.5 rounded-full text-[12px] font-semibold transition-all ${filter === f ? 'bg-[#F0B90B] text-[#181A20] shadow-xs' : 'bg-[#F2F3F5] text-[#555]'}`}>
              {f === 'all' ? 'All' : f === 'in' ? 'Money In' : 'Money Out'}
            </button>
          ))}
        </div>
      </div>

      {/* Transaction list */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2" style={{ scrollbarWidth: 'none' }}>
        {transactionsLoading && (
          <div className="flex justify-center py-16">
            <svg className="animate-spin w-6 h-6 text-[#162353]" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40 20" />
            </svg>
          </div>
        )}
        {!transactionsLoading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-[#888]">
            <Clock className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-[13px]">{transactions.length === 0 ? 'No transactions yet' : 'No transactions found'}</p>
          </div>
        )}
        {filtered.map(tx => (
          <button
            key={tx.id}
            onClick={() => navigate(`/receipt/${tx.id}`)}
            className="w-full text-left bg-white rounded-2xl px-4 py-3.5 border border-[#F0F0F0] flex items-center gap-3 hover:border-[#C7D7FF] active:bg-[#F8F9FB] transition-colors"
            aria-label={`View receipt for ${tx.name}`}
          >
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
            <ChevronRight className="w-4 h-4 text-[#B5BBC8] shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── Settings Page ──────────────────────────────────────────────────── */
type SettingsSection = { heading: string; items: { icon: React.ReactNode; label: string; sub?: string; danger?: boolean; action?: () => void }[] };

function SettingsPage() {
  const [, navigate] = useLocation();
  const { user, session, loading, signOut, profilePhoto } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!user || !session?.access_token) {
      setIsAdmin(false);
      return;
    }

    let cancelled = false;
    fetch('/api/admin/auth/check', {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    })
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) {
          setIsAdmin(Boolean(d?.isAdmin));
        }
      })
      .catch(() => {
        if (!cancelled) setIsAdmin(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user, session]);

  const { themeMode, resolvedThemeMode } = useThemeMode();
  const {
    state: securityState,
    busy: securityBusy,
    error: securityError,
    activateSleepMode,
    activateFreeze,
    requestUnlockCode,
    unlock,
  } = useAccountSecurity();
  const [biometrics, setBiometrics] = useState(true);
  const [notifs, setNotifs] = useState(true);
  const [notificationSound, setNotificationSound] = useState(() =>
    localStorage.getItem('vexa.notificationSound') !== 'false'
  );
  const [passcodeOnReturn, setPasscodeOnReturn] = useState(() =>
    localStorage.getItem(PASSCODE_RETURN_KEY) === 'true'
  );
  const [securityAction, setSecurityAction] = useState<'sleep_mode' | 'freeze_account' | null>(null);
  const [unlockPin, setUnlockPin] = useState('');
  const [unlockCode, setUnlockCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [securityMessage, setSecurityMessage] = useState('');

  function togglePasscodeOnReturn() {
    const next = !passcodeOnReturn;
    setPasscodeOnReturn(next);
    localStorage.setItem(PASSCODE_RETURN_KEY, String(next));
  }

  function toggleNotificationSound() {
    const next = !notificationSound;
    setNotificationSound(next);
    localStorage.setItem('vexa.notificationSound', String(next));
  }

  const userName = user?.name ?? 'Your account';
  const accountNumber = user?.accountNumber ?? '—';
  const levelLabel = user ? `Level ${user.level} · ${user.verified ? 'Verified' : 'Unverified'}` : 'Loading…';
  const initials = userName.split(' ').map((p: string) => p[0]).slice(0, 2).join('').toUpperCase();

  const sections: SettingsSection[] = [
    ...(isAdmin
      ? [
          {
            heading: 'Administrative Terminal',
            items: [
              {
                icon: <ShieldCheck className="w-5 h-5 text-[#F0B90B]" />,
                label: 'Admin Dashboard',
                sub: 'Institutional Operations & Financial Terminal',
                action: () => navigate('/admin'),
              },
            ],
          },
        ]
      : []),
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
         { icon: <i className="fa-solid fa-key text-[17px]" aria-hidden="true" />, label: 'Two-Factor Authentication', sub: user?.twoFactorEnabled ? 'Enabled via SMS' : 'Off', action: () => navigate('/two-factor') },
        { icon: <Lock className="w-5 h-5" />, label: 'Sleep Mode', sub: securityState.sleepModeActive ? 'Active · money movement blocked' : 'Pause all money movement', action: () => { setSecurityMessage(''); setSecurityAction('sleep_mode'); } },
        { icon: <TriangleAlert className="w-5 h-5" />, label: 'Emergency Freeze Account', sub: securityState.freezeActive ? 'Active · strongest account lock' : 'Block all account activity', action: () => { setSecurityMessage(''); setSecurityAction('freeze_account'); } },
      ],
    },
    {
      heading: 'Preferences',
      items: [
        { icon: <BellRing className="w-5 h-5" />, label: 'Notifications', sub: notifs ? 'Enabled' : 'Disabled' },
        { icon: notificationSound ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />, label: 'Notification Sound', sub: notificationSound ? 'On' : 'Off' },
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
    <div className="theme-page fixed inset-0 flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div className="theme-surface theme-border flex-none flex items-center gap-3 px-4 pb-3 border-b"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}>
        <button onClick={() => navigate('/')} className="theme-icon w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <span className="theme-text-primary text-[16px] font-bold">Settings</span>
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

        {/* Appearance */}
        <div>
          <p className="theme-text-secondary text-[11px] font-semibold uppercase tracking-wide mb-2 px-1">Appearance</p>
          <button
            type="button"
            onClick={() => navigate('/app-theme')}
            className="theme-surface theme-text-primary w-full rounded-2xl px-4 py-4 text-left transition-colors hover:bg-[#F8F9FB]"
          >
            <div className="flex items-center gap-3">
               <span className="theme-icon flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF2FF] text-[#1769C2]">
                {themeMode === 'system'
                  ? <Smartphone className="h-5 w-5" />
                  : resolvedThemeMode === 'dark' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="theme-text-primary text-[14px] font-semibold">App theme</p>
                <p className="theme-text-secondary mt-0.5 text-[11px]">
                  {themeMode === 'system' ? 'Phone default' : resolvedThemeMode === 'dark' ? 'Dark mode' : 'Light mode'}
                </p>
              </div>
              <ChevronRight className="theme-text-secondary h-4 w-4 shrink-0" />
            </div>
          </button>
        </div>

        {/* Settings sections */}
        {sections.map((section, si) => (
          <div key={si}>
            {section.heading && <p className="theme-text-secondary text-[11px] font-semibold uppercase tracking-wide mb-2 px-1">{section.heading}</p>}
            <div className="theme-surface rounded-2xl overflow-hidden">
              {section.items.map((item, ii) => {
                const isBio  = item.label === 'Biometric Login';
                const isNot  = item.label === 'Notifications';
                const isSound = item.label === 'Notification Sound';
                const isPCR  = item.label === 'Passcode on App Return';
                const isToggle = isBio || isNot || isPCR || isSound;
                const toggleState = isBio ? biometrics : isNot ? notifs : isPCR ? passcodeOnReturn : notificationSound;
                return (
                  <button key={ii}
                    onClick={() => {
                      if (isBio) setBiometrics(v => !v);
                      else if (isNot) setNotifs(v => !v);
                      else if (isPCR) togglePasscodeOnReturn();
                      else if (isSound) toggleNotificationSound();
                      else if (item.action) item.action();
                    }}
                      className="theme-text-primary w-full flex items-center gap-3.5 px-4 py-4 text-left transition-colors hover:bg-[#F8F9FB]"
                  >
                     <span className={item.danger ? 'text-red-500' : 'theme-icon'}>{item.icon}</span>
                    <div className="flex-1 min-w-0">
                       <p className={`text-[14px] font-semibold ${item.danger ? 'text-red-500' : 'theme-text-primary'}`}>{item.label}</p>
                       {item.sub && <p className="theme-text-secondary text-[11px] mt-0.5 truncate">{item.sub}</p>}
                    </div>
                    {isToggle ? (
                      <div className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${toggleState ? 'bg-[#F0B90B]' : 'bg-[#D1D5DB] dark:bg-[#3A4556]'}`}>
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

         <p className="theme-text-secondary text-center text-[11px] opacity-60 pb-2">Vexa Bank · v1.0.0</p>
      </div>
      {securityAction && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-[#07122B]/55 px-4 pb-4 sm:items-center">
          <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${securityAction === 'freeze_account' ? 'bg-red-50 text-red-600' : 'bg-[#EAF2FF] text-[#162353]'}`}>
                {securityAction === 'freeze_account' ? <TriangleAlert className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
              </div>
              <div className="min-w-0">
                <p className="text-[17px] font-extrabold text-[#111]">
                  {securityAction === 'freeze_account' ? 'Emergency Freeze Account' : 'Sleep Mode'}
                </p>
                <p className="mt-1 text-[12px] leading-relaxed text-[#667085]">
                  {((securityAction === 'sleep_mode' && securityState.sleepModeActive) || (securityAction === 'freeze_account' && securityState.freezeActive))
                    ? 'Removing this lock requires your transaction PIN and a fresh SMS verification code.'
                    : securityAction === 'freeze_account'
                      ? 'This is stronger than Sleep Mode and blocks all money movement until you remove it.'
                      : 'Your balance and transaction history stay visible, but every money movement is blocked.'}
                </p>
              </div>
            </div>

            {((securityAction === 'sleep_mode' && securityState.sleepModeActive) || (securityAction === 'freeze_account' && securityState.freezeActive)) ? (
              <div className="mt-5 space-y-3">
                <input
                  value={unlockPin}
                  onChange={event => setUnlockPin(event.target.value.replace(/\D/g, '').slice(0, 4))}
                  type="password"
                  inputMode="numeric"
                  placeholder="4-digit transaction PIN"
                  className="w-full rounded-xl border border-[#D8E0EA] px-4 py-3.5 text-[14px] outline-none focus:border-[#162353]"
                />
                <div className="flex gap-2">
                  <input
                    value={unlockCode}
                    onChange={event => setUnlockCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                    inputMode="numeric"
                    placeholder="SMS code"
                    className="min-w-0 flex-1 rounded-xl border border-[#D8E0EA] px-4 py-3.5 text-[14px] outline-none focus:border-[#162353]"
                  />
                  <button
                    type="button"
                    disabled={securityBusy}
                    onClick={() => void requestUnlockCode().then(result => { if (result.success) setCodeSent(true); })}
                    className="theme-control theme-brand-text shrink-0 rounded-xl border border-[#162353] px-3 text-[11px] font-bold disabled:opacity-50"
                  >
                    {codeSent ? 'Resend code' : 'Send code'}
                  </button>
                </div>
                {securityMessage && <p className="text-[12px] text-red-600">{securityMessage}</p>}
                {securityError && <p className="text-[12px] text-red-600">{securityError}</p>}
                <button
                  type="button"
                  disabled={securityBusy || unlockPin.length !== 4 || unlockCode.length !== 6}
                  onClick={() => void unlock(securityAction, unlockPin, unlockCode).then(result => {
                    if (result.success) {
                      setSecurityAction(null);
                      setUnlockPin('');
                      setUnlockCode('');
                      setCodeSent(false);
                    }
                  })}
                  className="w-full rounded-xl bg-[#F0B90B] hover:bg-[#FCD535] active:bg-[#DDAA09] py-3.5 text-[13px] font-bold text-[#181A20] shadow-sm disabled:opacity-45 transition-all"
                >
                  {securityBusy ? 'Verifying…' : 'Remove lock'}
                </button>
              </div>
            ) : (
              <div className="mt-5">
                {securityMessage && <p className="mb-3 text-[12px] text-red-600">{securityMessage}</p>}
                {securityError && <p className="mb-3 text-[12px] text-red-600">{securityError}</p>}
                <button
                  type="button"
                  disabled={securityBusy}
                  onClick={() => void (securityAction === 'freeze_account' ? activateFreeze() : activateSleepMode()).then(result => {
                    if (result.success) setSecurityAction(null);
                    else setSecurityMessage(result.error ?? 'Could not update account security');
                  })}
                  className={`w-full rounded-xl py-3.5 text-[13px] font-bold shadow-sm disabled:opacity-45 transition-all ${securityAction === 'freeze_account' ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-[#F0B90B] hover:bg-[#FCD535] active:bg-[#DDAA09] text-[#181A20]'}`}
                >
                  {securityBusy ? 'Updating…' : securityAction === 'freeze_account' ? 'Freeze account' : 'Activate Sleep Mode'}
                </button>
              </div>
            )}
            <button type="button" onClick={() => { setSecurityAction(null); setSecurityMessage(''); }} className="mt-3 w-full py-2 text-[12px] font-semibold text-[#667085]">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AppThemePage() {
  const [, navigate] = useLocation();
  const { themeMode, resolvedThemeMode, setThemeMode } = useThemeMode();
  const options: { mode: ThemeMode; label: string; description: string; Icon: typeof Sun }[] = [
    { mode: 'light', label: 'Light mode', description: 'Use a bright appearance throughout the app.', Icon: Sun },
    { mode: 'dark', label: 'Dark mode', description: 'Use a darker appearance that is easier on the eyes in low light.', Icon: Moon },
    { mode: 'system', label: 'Phone default', description: 'Match the appearance setting on your phone.', Icon: Smartphone },
  ];

  return (
    <div className="theme-page fixed inset-0 flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div
        className="theme-surface theme-border flex-none flex items-center gap-3 border-b px-4 pb-3"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}
      >
        <button
          type="button"
          onClick={() => navigate('/settings')}
          aria-label="Back to settings"
          className="theme-icon flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <span className="theme-text-primary text-[16px] font-bold">App theme</span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6" style={{ scrollbarWidth: 'none' }}>
        <div className="mb-5">
          <h1 className="theme-text-primary text-[20px] font-bold">Choose your appearance</h1>
          <p className="theme-text-secondary mt-1 text-[13px]">Select how Vexa should look on this device.</p>
        </div>
        <div className="space-y-3">
          {options.map(({ mode, label, description, Icon }) => {
            const selected = themeMode === mode;
            return (
              <button
                key={mode}
                type="button"
                onClick={() => setThemeMode(mode)}
                aria-pressed={selected}
                className={`theme-border flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition-colors ${selected ? 'theme-selected-control' : 'theme-surface theme-text-primary hover:bg-[#F8F9FB]'}`}
              >
                <span className={`theme-icon flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${selected ? 'theme-control-active' : 'theme-control'}`}>
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="theme-text-primary block text-[14px] font-semibold">{label}</span>
                  <span className="theme-text-secondary mt-1 block text-[11px] leading-relaxed">{description}</span>
                  {mode === 'system' && selected && (
                    <span className="theme-text-secondary mt-1 block text-[10px]">
                      Your phone is currently using {resolvedThemeMode} mode.
                    </span>
                  )}
                </span>
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${selected ? 'border-current' : 'theme-border'}`}>
                  {selected && <Check className="h-3.5 w-3.5" />}
                </span>
              </button>
            );
          })}
        </div>
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
  actions?: { label: string; path: string }[];
};

const AI_FAQ_MAP: { keywords: string[]; answer: string; actions?: { label: string; path: string }[] }[] = [
  { keywords: ['vexa user', 'vexa-to-vexa', 'vexa to vexa', 'vexa transfer'],
    answer: 'To send to another Vexa user, open Vexa to Vexa, enter their 10-digit account number or scan their QR code, verify the recipient, enter the amount, and confirm with your transaction PIN. No bank selection is needed.',
    actions: [{ label: 'Open Vexa transfers', path: '/vexa-transfer' }] },
  { keywords: ['scan qr', 'scan code', 'qr code', 'qr'],
    answer: 'Open Vexa to Vexa and choose Scan QR. Allow camera access, scan the recipient’s code, check the account number, then enter the amount and PIN. If the camera does not work, enter the 10-digit Vexa account number instead.',
    actions: [{ label: 'Open Scan QR', path: '/vexa-transfer' }] },
  { keywords: ['receive money', 'receive payment', 'get paid', 'someone send'],
    answer: 'Open Vexa to Vexa and choose My QR code. Show or share that code with the other Vexa user. It contains only your Vexa account identifier; never share your PIN or OTP.',
    actions: [{ label: 'Open My QR code', path: '/vexa-transfer?mode=my-qr' }] },
  { keywords: ['qr not working', 'camera not working', 'cannot scan', 'can’t scan'],
    answer: 'Increase your screen brightness, hold the camera steady, and try again. If camera permission was denied, enable it in your browser or phone settings. You can always use the 10-digit account number field instead.',
    actions: [{ label: 'Use manual transfer', path: '/vexa-transfer' }] },
  { keywords: ['transfer', 'send money', 'send'],
    answer: 'For a bank transfer, go to Transfer, select the recipient’s bank, enter their 10-digit account number, wait for the account name to resolve, enter the amount, and confirm with your transaction PIN. For another Vexa user, choose Vexa to Vexa instead.',
    actions: [{ label: 'Open transfers', path: '/transfer' }] },
  { keywords: ['account name', 'resolve account', 'paystack', 'bank account'],
    answer: 'For a bank recipient, choose the bank first and enter the 10-digit account number. Vexa checks the account name through Paystack before you can continue. If the name does not load, check the bank and number and try again.' },
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

function getAIReply(userText: string): { text: string; actions?: { label: string; path: string }[] } {
  const lower = userText.toLowerCase();
  for (const entry of AI_FAQ_MAP) {
    if (entry.keywords.some(k => lower.includes(k))) {
      return { text: entry.answer, actions: entry.actions };
    }
  }
  return {
    text: "I'm not sure about that one. I can connect you with a live agent who can help right away — tap the button below.",
  };
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
  'How do I send to a Vexa user?',
  'How do I scan a Vexa QR?',
  'How do I receive money?',
  'What if my QR is not working?',
];

function LiveChatModal({ onClose }: { onClose: () => void }) {
  const [, navigate] = useLocation();
  const [mode, setMode] = useState<'ai' | 'live'>('ai');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      from: 'ai',
      text: "Hi! I'm Vexa AI. I can answer questions about bank transfers, Vexa-to-Vexa transfers, QR codes, account access, and more. What do you need help with today?",
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
        const reply = getAIReply(txt);
        addMessage({ from: 'ai', text: reply.text, actions: reply.actions, time: nowTime() });
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
        text: `Hi! I'm ${AGENT.name} from Vexa Support. I've reviewed your conversation and I'm here to help. What can I do for you?`,
        time: nowTime(),
      });
    }, 2000);
  }

  const isAiMode = mode === 'ai';

  return (
    <div
      className="theme-page fixed inset-0 z-50 flex flex-col"
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
              className="w-11 h-11 rounded-full flex items-center justify-center text-[#F0B90B] font-bold text-[14px] flex-shrink-0"
              style={{ background: 'linear-gradient(135deg,#181A20,#2B313A)' }}
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
                      className="w-8 h-8 rounded-full flex items-center justify-center text-[#F0B90B] font-bold text-[11px]"
                      style={{ background: 'linear-gradient(135deg,#181A20,#2B313A)' }}
                    >
                      {AGENT.avatar}
                    </div>
                  )}
                </div>
              )}

              <div className={`flex flex-col max-w-[78%] ${isUser ? 'items-end' : 'items-start'}`}>
                {!isUser && (
                  <p className="theme-text-secondary text-[10px] font-semibold mb-1 px-1">
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
                      <div className={`flex items-center gap-3 px-4 py-3 ${isUser ? 'bg-[#162353]' : 'theme-surface theme-border border'}`}>
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isUser ? 'bg-white/15' : 'bg-[#EFF6FF]'}`}>
                          <FileIcon className={`w-4 h-4 ${isUser ? 'text-white' : 'text-[#2563EB]'}`} />
                        </div>
                        <div className="min-w-0">
                          <p className={`text-[12px] font-semibold truncate ${isUser ? 'text-white' : 'theme-text-primary'}`}>{msg.attachment.name}</p>
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
                        : 'theme-surface theme-text-primary rounded-bl-sm theme-border border'
                    }`}
                    style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
                  >
                    {msg.text}
                  </div>
                )}
                {msg.actions && msg.actions.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {msg.actions.map(action => (
                      <button
                        key={action.path}
                        onClick={() => { onClose(); navigate(action.path); }}
                        className="rounded-full bg-[#EAF2FF] border border-[#CFE0FF] px-3.5 py-2 text-[11px] font-bold text-[#1D4ED8] active:bg-[#DCEBFF]"
                      >
                        {action.label}
                      </button>
                    ))}
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
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[#F0B90B] font-bold text-[11px]"
                  style={{ background: 'linear-gradient(135deg,#181A20,#2B313A)' }}
                >
                  {AGENT.avatar}
                </div>
              )}
            </div>
            <div className="theme-surface theme-border border rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1.5" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
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
              className="theme-surface theme-border border flex items-center gap-2 rounded-full px-5 py-2.5 text-[12px] font-semibold theme-text-primary active:bg-[#F1F5F9] transition-colors disabled:opacity-60"
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
                className="theme-surface theme-border border rounded-full px-3.5 py-1.5 text-[12px] font-medium theme-text-primary active:bg-[#F1F5F9] transition-colors"
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
        <div className="theme-surface theme-border flex-none border-t px-4 pt-3 pb-2">
          <div className="flex gap-3">
            {/* Camera / Photo */}
            <button
              onClick={() => { setShowAttachMenu(false); cameraInputRef.current?.click(); }}
              className="theme-surface theme-border flex-1 flex flex-col items-center gap-2 rounded-2xl py-4 active:bg-[#EEF2F7] transition-colors border"
            >
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#00C6FF] to-[#0072FF] flex items-center justify-center">
                <ImagePlus className="w-5 h-5 text-white" />
              </div>
              <span className="theme-text-primary text-[12px] font-semibold">Photo / Camera</span>
            </button>
            {/* File */}
            <button
              onClick={() => { setShowAttachMenu(false); fileInputRef.current?.click(); }}
              className="theme-surface theme-border flex-1 flex flex-col items-center gap-2 rounded-2xl py-4 active:bg-[#EEF2F7] transition-colors border"
            >
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#4F46E5] flex items-center justify-center">
                <FileUp className="w-5 h-5 text-white" />
              </div>
              <span className="theme-text-primary text-[12px] font-semibold">Document / File</span>
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
        className="theme-surface theme-border flex-none border-t px-4 py-3 flex items-end gap-2"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 12px)' }}
      >
        {/* Attachment button */}
        <button
          onClick={() => setShowAttachMenu(v => !v)}
          className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 border transition-colors ${
            showAttachMenu
              ? 'bg-[#F0B90B] border-[#F0B90B]'
              : 'theme-control border-[#E8EBF0] active:bg-[#EEF2F7]'
          }`}
        >
          <Paperclip className={`w-4 h-4 ${showAttachMenu ? 'text-[#181A20]' : 'text-[#64748B]'}`} />
        </button>

        {/* Text input */}
        <div className="theme-control theme-border flex-1 rounded-2xl border flex items-end px-4 py-2.5">
          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder={isAiMode ? 'Ask Vexa AI anything…' : `Message ${AGENT.name.split(' ')[0]}…`}
            className="theme-text-primary flex-1 bg-transparent text-[13px] placeholder-[#94A3B8] outline-none resize-none"
          />
        </div>

        {/* Send button */}
        <button
          onClick={() => handleSend()}
          disabled={!inputText.trim()}
          className="w-10 h-10 rounded-full bg-[#F0B90B] hover:bg-[#FCD535] flex items-center justify-center flex-shrink-0 transition-opacity disabled:opacity-40 active:opacity-70"
        >
          <Send className="w-4 h-4 text-[#181A20]" />
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
    { q: 'How do I send money to another Vexa user?', a: 'Open Transfer → Vexa to Vexa. Enter the recipient’s 10-digit Vexa account number or scan their QR code, verify the recipient, enter the amount, and confirm with your transaction PIN. No bank selection is needed.' },
    { q: 'How do I scan a Vexa QR code?', a: 'Open Transfer → Vexa to Vexa → Scan QR. Allow camera access, scan the code shown by the recipient, check the account number, then continue with the amount and PIN. Manual account entry is always available.' },
    { q: 'How do I receive money with a QR code?', a: 'Open Transfer → Vexa to Vexa → My QR code. Show or share the QR code with another Vexa user. It contains only your Vexa account identifier. Never share your PIN or OTP.' },
    { q: 'What if my QR code is not working?', a: 'Increase screen brightness, hold the camera steady, and try again. If camera permission was denied, enable it in your browser or phone settings. You can also enter the 10-digit Vexa account number manually.' },
    { q: 'How do I transfer money to a bank account?', a: 'Go to the home screen and tap Transfer. Select the recipient’s bank, enter their account number, wait for the Paystack account-name check, enter the amount, and confirm with your transaction PIN.' },
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
              <a href="tel:+2348008392600" className="flex-1 bg-white/15 rounded-xl py-3 flex flex-col items-center gap-1.5 active:bg-white/25 transition-colors">
                <Phone className="w-5 h-5 text-white" />
                <span className="text-[11px] font-semibold text-white">Call Us</span>
              </a>
              <button
                onClick={() => setShowChat(true)}
                className="flex-1 bg-white/25 border border-white/30 rounded-xl py-3 flex flex-col items-center gap-1.5 active:bg-white/35 transition-colors"
              >
                <MessageCircle className="w-5 h-5 text-white" />
                <span className="text-[11px] font-semibold text-white">Live Chat</span>
              </button>
              <a href="mailto:support@vexa.com" className="flex-1 bg-white/15 rounded-xl py-3 flex flex-col items-center gap-1.5 active:bg-white/25 transition-colors">
                <Mail className="w-5 h-5 text-white" />
                <span className="text-[11px] font-semibold text-white">Email Us</span>
              </a>
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
                  { icon: <Phone className="w-5 h-5" />, label: 'Phone Support', sub: '+234 800 839 2600', href: 'tel:+2348008392600' },
                  { icon: <Mail className="w-5 h-5" />, label: 'Email Support', sub: 'support@vexa.com', href: 'mailto:support@vexa.com' },
                  { icon: <MessageCircle className="w-5 h-5" />, label: 'WhatsApp', sub: '+234 800 839 2600', href: 'https://wa.me/2348008392600' },
              ].map((item, i, arr) => (
                  <a key={i} href={item.href} className={`flex items-center gap-3.5 px-4 py-4 hover:bg-[#F8F9FB] ${i < arr.length - 1 ? 'border-b border-[#F5F5F5]' : ''}`}>
                  <span className="text-[#555]">{item.icon}</span>
                  <div className="flex-1">
                    <p className="text-[14px] font-semibold text-[#111]">{item.label}</p>
                    <p className="text-[12px] text-[#888] mt-0.5">{item.sub}</p>
                  </div>
                  <ExternalLink className="w-4 h-4 text-[#CBD5E1]" />
                  </a>
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
function extractNotificationCoinAsset(notification: AppNotification): CryptoAsset | null {
  const haystack = `${notification.title} ${notification.body}`;
  const isCryptoRelated =
    notification.type === 'crypto' ||
    /\b(BTC|ETH|USDT|Bitcoin|Ethereum|Tether)\b/i.test(haystack);

  if (!isCryptoRelated) return null;
  if (/\b(BTC|Bitcoin)\b/i.test(haystack)) return 'BTC';
  if (/\b(ETH|Ethereum)\b/i.test(haystack)) return 'ETH';
  if (/\b(USDT|Tether)\b/i.test(haystack)) return 'USDT';
  return null;
}

function useCryptoCoinLogos() {
  const [logos, setLogos] = useState<Partial<Record<CryptoAsset, string | null>>>({});

  useEffect(() => {
    let active = true;
    void fetch('/api/crypto/logos', { headers: { accept: 'application/json' } })
      .then(async (res) => {
        if (!res.ok) return null;
        return (await res.json()) as {
          logos?: Record<string, { asset?: string; logoUrl?: string | null }>;
        };
      })
      .then((body) => {
        if (!active || !body?.logos) return;
        setLogos({
          BTC: body.logos.BTC?.logoUrl ?? null,
          ETH: body.logos.ETH?.logoUrl ?? null,
          USDT: body.logos.USDT?.logoUrl ?? null,
        });
      })
      .catch(() => {
        // Keep SVG asset badge fallback silently
      });
    return () => {
      active = false;
    };
  }, []);

  return logos;
}

function NotificationCoinAvatar({
  asset,
  logoUrl,
}: {
  asset: CryptoAsset;
  logoUrl?: string | null;
}) {
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [logoUrl, asset]);

  const meta = CRYPTO_ASSET_META[asset];

  if (logoUrl && !imgFailed) {
    return (
      <div className="w-10 h-10 rounded-full bg-white border border-slate-200 dark:border-[#2B313A] flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
        <img
          src={logoUrl}
          alt={`${meta.name} (${asset}) logo`}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover rounded-full"
          onError={() => setImgFailed(true)}
        />
      </div>
    );
  }

  return (
    <div
      className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-xs"
      style={{ backgroundColor: meta.color }}
    >
      <CryptoAssetLogo asset={asset} size={20} />
    </div>
  );
}

function NotificationsPage() {
  const [, navigate] = useLocation();
  const {
    notifications,
    notificationsLoading,
    unreadNotificationsCount: unreadCount,
    markNotificationRead: markRead,
    markAllNotificationsRead: markAllRead,
  } = useUserData();
  const [filter, setFilter] = useState<'all' | 'unread' | 'crypto'>('all');
  const coinLogos = useCryptoCoinLogos();

  function dotColor(type: string) {
    switch (type) {
      case 'credit':   return { bg: '#DCFCE7', stroke: '#16A34A' };
      case 'debit':    return { bg: '#FEE2E2', stroke: '#DC2626' };
      case 'security': return { bg: '#FEF3C7', stroke: '#D97706' };
      case 'promo':    return { bg: '#F3E8FF', stroke: '#9333EA' };
      case 'crypto':   return { bg: 'rgba(240, 185, 11, 0.18)', stroke: '#F0B90B' };
      default:         return { bg: '#EFF6FF', stroke: '#2563EB' };
    }
  }

  function renderLeadingAvatar(notification: AppNotification) {
    const coinAsset = extractNotificationCoinAsset(notification);
    if (coinAsset) {
      return <NotificationCoinAvatar asset={coinAsset} logoUrl={coinLogos[coinAsset]} />;
    }
    const c = dotColor(notification.type);
    return (
      <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: c.bg }}>
        {notification.type === 'crypto' ? (
          <Coins className="w-5 h-5" style={{ color: c.stroke }} strokeWidth={1.9} />
        ) : notification.type === 'security' ? (
          <Shield className="w-5 h-5" style={{ color: c.stroke }} strokeWidth={1.9} />
        ) : (
          <Bell className="w-5 h-5" style={{ color: c.stroke }} strokeWidth={1.8} />
        )}
      </div>
    );
  }

  const cryptoCount = notifications.filter(n => n.type === 'crypto').length;
  const visibleNotifications = notifications.filter(n => {
    if (filter === 'unread') return !n.read;
    if (filter === 'crypto') return n.type === 'crypto';
    return true;
  });
  const unreadVisible = visibleNotifications.filter(n => !n.read);
  const readVisible = visibleNotifications.filter(n => n.read);

  return (
    <div className="theme-page fixed inset-0 bg-[#F2F3F5] flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div className="theme-surface theme-border flex-none border-b border-[#E8EBF0] px-4 pb-3"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/')} className="theme-text-primary w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/5">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
            </button>
            <span className="theme-text-primary text-[16px] font-bold">Notifications</span>
            {unreadCount > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{unreadCount}</span>
            )}
          </div>
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="theme-brand-text text-[12px] font-semibold">Mark all read</button>
          )}
        </div>

        {/* Filter pills */}
        <div className="mt-3 flex items-center gap-2">
          {([
            { id: 'all', label: `All (${notifications.length})` },
            { id: 'crypto', label: `Crypto (${cryptoCount})` },
            { id: 'unread', label: `Unread (${unreadCount})` },
          ] as const).map(tab => {
            const active = filter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`rounded-xl px-3 py-1.5 text-[11px] font-bold transition-colors ${
                  active
                    ? 'bg-[#F0B90B] text-[#181A20]'
                    : 'theme-surface-alt theme-text-secondary border border-black/5'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-4 px-4 space-y-3" style={{ scrollbarWidth: 'none' }}>
        {notificationsLoading && (
          <div className="flex justify-center py-16">
            <svg className="animate-spin w-6 h-6 text-[#F0B90B]" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40 20" />
            </svg>
          </div>
        )}
        {!notificationsLoading && visibleNotifications.length === 0 && (
          <div className="theme-text-secondary flex flex-col items-center justify-center py-20">
            {filter === 'crypto'
              ? <Coins className="w-10 h-10 mb-3 opacity-30 text-[#F0B90B]" />
              : <Bell className="w-10 h-10 mb-3 opacity-20" />}
            <p className="text-[13px]">
              {filter === 'crypto'
                ? 'No crypto notifications yet'
                : filter === 'unread'
                  ? 'No unread notifications'
                  : 'No notifications yet'}
            </p>
          </div>
        )}
        {!notificationsLoading && unreadVisible.length > 0 && (
          <p className="theme-text-secondary text-[11px] font-semibold uppercase tracking-wide px-1">New</p>
        )}
        {unreadVisible.map(n => (
          <button key={n.id} onClick={() => markRead(n.id)}
            className="theme-surface theme-border w-full rounded-2xl border px-4 py-4 flex items-start gap-3 text-left transition-colors shadow-sm">
            {renderLeadingAvatar(n)}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-0.5">
                <div className="flex items-center gap-2 min-w-0">
                  <p className="theme-text-primary text-[13px] font-bold truncate">{n.title}</p>
                  {n.type === 'crypto' && (
                    <span className="shrink-0 rounded-md bg-[#F0B90B]/15 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-[#B7791F] dark:text-[#F0B90B]">
                      Crypto
                    </span>
                  )}
                </div>
                <span className="theme-text-secondary text-[10px] shrink-0">{n.time}</span>
              </div>
              <p className="theme-text-secondary text-[12px] leading-relaxed">{n.body}</p>
            </div>
            <span className="w-2 h-2 rounded-full bg-red-500 shrink-0 mt-1.5" />
          </button>
        ))}

        {readVisible.length > 0 && (
          <p className="theme-text-secondary text-[11px] font-semibold uppercase tracking-wide px-1 pt-1">Earlier</p>
        )}
        {readVisible.map(n => (
          <div key={n.id} className="theme-surface theme-border rounded-2xl border px-4 py-4 flex items-start gap-3 opacity-85">
            {renderLeadingAvatar(n)}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-0.5">
                <div className="flex items-center gap-2 min-w-0">
                  <p className="theme-text-primary text-[13px] font-semibold truncate">{n.title}</p>
                  {n.type === 'crypto' && (
                    <span className="shrink-0 rounded-md bg-[#F0B90B]/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#B7791F] dark:text-[#F0B90B]">
                      Crypto
                    </span>
                  )}
                </div>
                <span className="theme-text-secondary text-[10px] shrink-0">{n.time}</span>
              </div>
              <p className="theme-text-secondary text-[12px] leading-relaxed">{n.body}</p>
            </div>
          </div>
        ))}
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
          <img src="/assets/aistudio/c4e1e122-cd74-4d18-b5b5-37dafb3a53f6_e2d23c37.png" alt="Vexa" className="h-12 object-contain mb-3" />
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
  const { user } = useAuth();
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

  const accountNumber = user?.accountNumber ?? '—';
  const accountName   = user?.name ?? 'Your account';
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
            <img src="/assets/aistudio/fe78fa28-9eb7-49b5-a568-6e1afbae67cb_ac4d9ede.png" alt="Vexa" className="w-8 h-8 rounded-lg object-contain" />
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
          className="w-full bg-[#F0B90B] hover:bg-[#FCD535] active:bg-[#DDAA09] rounded-xl h-[50px] flex items-center justify-center gap-2 text-[14px] font-bold text-[#181A20] shadow-sm transition-all"
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
interface PaystackBank {
  name: string;
  slug: string;
  code: string;
  logoUrl: string | null;
}

type TxStep = 'details' | 'amount' | 'create_pin' | 'pin' | 'success';

export interface TransferReceiptData {
  transaction: AppTransaction;
  recipientName: string;
  bank: string;
  bankLogo?: string | null;
  accountNumber: string;
  senderName: string;
  senderAccountNumber: string;
  balanceBefore?: number;
  balanceAfter?: number;
}

function formatAmt(raw: string) {
  const clean = raw.replace(/,/g, '').replace(/[^0-9.]/g, '');
  const [intP, ...rest] = clean.split('.');
  const dec = rest.length ? '.' + rest.join('') : '';
  return intP.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + dec;
}

function ordinalDay(day: number) {
  const suffix = day % 100 >= 11 && day % 100 <= 13
    ? 'th'
    : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[day % 10] ?? 'th';
  return `${day}${suffix}`;
}

export function formatReceiptDate(transaction: AppTransaction) {
  if (!transaction.createdAt) return transaction.date;
  const date = new Date(transaction.createdAt);
  if (Number.isNaN(date.getTime())) return transaction.date;
  return new Intl.DateTimeFormat('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function formatReceiptTime(transaction: AppTransaction) {
  if (!transaction.createdAt) return '';
  const date = new Date(transaction.createdAt);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-NG', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(date);
}

function drawReceiptWrappedText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (context.measureText(candidate).width <= maxWidth || !line) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);

  lines.forEach((lineText, index) => context.fillText(lineText, x, y + index * lineHeight));
  return y + lines.length * lineHeight;
}

export async function createTransferReceiptImage(receipt: TransferReceiptData, reference: string): Promise<File> {
  const canvas = document.createElement('canvas');
  const scale = 2;
  const width = 640;
  const height = 980;
  canvas.width = width * scale;
  canvas.height = height * scale;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Receipt image could not be created');
  ctx.scale(scale, scale);

  // Background
  ctx.fillStyle = '#F4F6F9';
  ctx.fillRect(0, 0, width, height);

  // Card Container
  const cardX = 24;
  const cardY = 28;
  const cardW = width - cardX * 2;
  const cardH = height - cardY * 2;

  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, 24);
  ctx.fill();

  // Header Brand Bar
  ctx.fillStyle = '#181A20';
  ctx.beginPath();
  ctx.roundRect(cardX + 24, cardY + 24, 38, 38, 10);
  ctx.fill();

  try {
    const logoImg = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = '/assets/aistudio/fe78fa28-9eb7-49b5-a568-6e1afbae67cb_ac4d9ede.png';
    });
    ctx.drawImage(logoImg, cardX + 28, cardY + 29, 30, 28);
  } catch {
    ctx.fillStyle = '#F0B90B';
    ctx.font = '900 20px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('V', cardX + 43, cardY + 43);
  }

  ctx.textAlign = 'left';
  ctx.fillStyle = '#181A20';
  ctx.font = '900 18px Inter, sans-serif';
  ctx.fillText('VEXA BANK', cardX + 72, cardY + 36);

  ctx.fillStyle = '#8E9AA8';
  ctx.font = '600 10px Inter, sans-serif';
  ctx.fillText('LICENSED BY THE CBN · NDIC INSURED', cardX + 72, cardY + 52);

  // Official pill badge
  ctx.textAlign = 'right';
  ctx.fillStyle = '#E8F5E9';
  ctx.beginPath();
  ctx.roundRect(cardX + cardW - 110, cardY + 30, 86, 26, 6);
  ctx.fill();
  ctx.fillStyle = '#2E7D32';
  ctx.font = '700 10px Inter, sans-serif';
  ctx.fillText('OFFICIAL', cardX + cardW - 36, cardY + 43);

  // Divider
  ctx.strokeStyle = '#F1F3F5';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cardX + 24, cardY + 76);
  ctx.lineTo(cardX + cardW - 24, cardY + 76);
  ctx.stroke();

  // Success Circle
  const checkY = cardY + 120;
  ctx.fillStyle = '#E8F5E9';
  ctx.beginPath();
  ctx.arc(width / 2, checkY, 28, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#16A34A';
  ctx.font = '900 24px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('✓', width / 2, checkY);

  ctx.font = '800 13px Inter, sans-serif';
  ctx.fillText('TRANSFER SUCCESSFUL', width / 2, checkY + 42);

  // Amount
  const amtNum = Number(receipt.transaction.raw_amount) || Number(receipt.transaction.amount.replace(/,/g, '')) || 0;
  const formattedAmt = `₦${amtNum.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  ctx.fillStyle = '#111827';
  ctx.font = '900 40px Inter, sans-serif';
  ctx.fillText(formattedAmt, width / 2, checkY + 76);

  ctx.fillStyle = '#6B7280';
  ctx.font = '500 12px Inter, sans-serif';
  const timeText = `${formatReceiptDate(receipt.transaction)} · ${formatReceiptTime(receipt.transaction)}`;
  ctx.fillText(timeText, width / 2, checkY + 105);

  // Perforated Dashed Line
  const dashY = checkY + 130;
  ctx.strokeStyle = '#E5E7EB';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.moveTo(cardX + 24, dashY);
  ctx.lineTo(cardX + cardW - 24, dashY);
  ctx.stroke();
  ctx.setLineDash([]); // reset

  // Notches
  ctx.fillStyle = '#F4F6F9';
  ctx.beginPath();
  ctx.arc(cardX, dashY, 10, -Math.PI / 2, Math.PI / 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cardX + cardW, dashY, 10, Math.PI / 2, -Math.PI / 2);
  ctx.fill();

  // Attempt to load real-time bank logo image
  let bankLogoImg: HTMLImageElement | null = null;
  const resolvedBankLogo = receipt.bankLogo || resolveBankLogoUrl(receipt.bank);
  if (resolvedBankLogo) {
    try {
      bankLogoImg = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = resolvedBankLogo;
      });
    } catch {
      bankLogoImg = null;
    }
  }

  // Details Table
  let currentY = dashY + 30;
  const rowLeft = cardX + 28;
  const rowRight = cardX + cardW - 28;
  const rowH = 34;

  const drawRow = (label: string, value: string, isBold = false, valColor = '#111827') => {
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#6B7280';
    ctx.font = '500 13px Inter, sans-serif';
    ctx.fillText(label, rowLeft, currentY);

    ctx.textAlign = 'right';
    ctx.fillStyle = valColor;
    ctx.font = isBold ? '800 13.5px Inter, sans-serif' : '600 13px Inter, sans-serif';
    ctx.fillText(value, rowRight, currentY);

    currentY += rowH;
  };

  drawRow('Recipient Name', receipt.recipientName.toUpperCase(), true);

  // Recipient Bank with Real-Time Bank Logo
  {
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#6B7280';
    ctx.font = '500 13px Inter, sans-serif';
    ctx.fillText('Recipient Bank', rowLeft, currentY);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#111827';
    ctx.font = '800 13.5px Inter, sans-serif';
    const bankText = receipt.bank.toUpperCase();
    ctx.fillText(bankText, rowRight, currentY);

    const bankTextWidth = ctx.measureText(bankText).width;
    const logoSize = 18;
    const logoX = rowRight - bankTextWidth - logoSize - 8;
    const logoY = currentY - logoSize / 2;

    if (bankLogoImg) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(bankLogoImg, logoX, logoY, logoSize, logoSize);
      ctx.restore();
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#162353';
      ctx.beginPath();
      ctx.arc(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '700 9px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText((receipt.bank[0] || 'B').toUpperCase(), logoX + logoSize / 2, currentY);
    }

    currentY += rowH;
  }

  drawRow('Account Number', receipt.accountNumber, false, '#111827');
  drawRow('Sender Name', (receipt.senderName || 'Account Holder').toUpperCase(), true);
  drawRow('Sender Account', `Vexa · ${receipt.senderAccountNumber || 'Main'}`, false);
  drawRow('Transaction Type', 'NIP Instant Electronic Transfer', false);
  drawRow('Payment Amount', formattedAmt, false);
  drawRow('Fee', receipt.transaction.fee ? `₦${receipt.transaction.fee.toFixed(2)}` : '₦0.00 (Waived)', false);
  drawRow('Total Debit', formattedAmt, true, '#162353');
  drawRow('Transaction Reference', reference, true, '#162353');
  drawRow('Narration', receipt.transaction.note || `Transfer to ${receipt.recipientName}`, false);
  drawRow('Payment Status', 'SUCCESSFUL', true, '#16A34A');

  // Bottom Security Footer
  ctx.strokeStyle = '#F1F3F5';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cardX + 24, currentY + 10);
  ctx.lineTo(cardX + cardW - 24, currentY + 10);
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#9CA3AF';
  ctx.font = '700 10.5px Inter, sans-serif';
  ctx.fillText('NIBSS INSTANT PAYMENT GUARANTEED · CENTRAL CLEARING HOUSE', width / 2, currentY + 30);

  ctx.font = '400 9.5px Inter, sans-serif';
  ctx.fillText('Generated by Vexa Core Banking. Conclusive proof of payment settled to the beneficiary.', width / 2, currentY + 46);

  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Receipt image could not be created');
  return new File([blob], `vexa-receipt-${reference}.png`, { type: 'image/png' });
}

function storedSelectedBank(): PaystackBank | null {
  try {
    const value = JSON.parse(sessionStorage.getItem('vexa.selectedBank') ?? 'null') as PaystackBank | null;
    return value?.name && value.code ? value : null;
  } catch {
    return null;
  }
}

function TransferPage() {
  const [, navigate] = useLocation();
  const { user, setInitialTransferPin } = useAuth();
  const { balance, completeBankTransfer } = useUserData();
  const [step, setStep]           = useState<TxStep>('details');
  const initialBank = storedSelectedBank();
  const [bank, setBank]           = useState(initialBank?.name ?? '');
  const [bankCode, setBankCode]   = useState(initialBank?.code ?? '');
  const [bankLogo, setBankLogo]   = useState<string | null>(initialBank?.logoUrl ?? null);
  const [acctNo, setAcctNo]       = useState('');
  const [resolvedName, setResolvedName] = useState('');
  const [lookingUp, setLookingUp] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [amount, setAmount]       = useState('');
  const [narration, setNarration] = useState('');
  const [pin, setPin]             = useState('');
  const [pinError, setPinError]   = useState(false);
  const [processing, setProcessing] = useState(false);
  /* Create-PIN state */
  const [newPinEntry, setNewPinEntry]         = useState('');
  const [confirmPinEntry, setConfirmPinEntry] = useState('');
  const [createPinError, setCreatePinError]   = useState('');
  const [savingPin, setSavingPin]             = useState(false);
  const [submitError, setSubmitError]         = useState('');
  const [receipt, setReceipt]                 = useState<TransferReceiptData | null>(null);
  const [showConfirmPopup, setShowConfirmPopup] = useState(false);
  const [showPinPopup, setShowPinPopup]       = useState(false);
  const [pinModalError, setPinModalError]     = useState('');
  const [showInsufficientPopup, setShowInsufficientPopup] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);

  // Resolve the destination account through the API server so Paystack's
  // secret key never reaches the browser.
  useEffect(() => {
    const controller = new AbortController();
    if (acctNo.length !== 10 || !bankCode) {
      setResolvedName('');
      setLookupError('');
      setLookingUp(false);
      return () => controller.abort();
    }

    setLookingUp(true);
    setResolvedName('');
    setLookupError('');
    const timer = window.setTimeout(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const params = new URLSearchParams({ accountNumber: acctNo, bankCode });
        const headers: Record<string, string> = {};
        if (session?.access_token) {
          headers.Authorization = `Bearer ${session.access_token}`;
        }
        const response = await fetch(`/api/paystack/resolve-account?${params.toString()}`, {
          headers,
          signal: controller.signal,
        });
        const body = await response.json().catch(() => null) as { accountName?: string; message?: string } | null;
        if (!response.ok) throw new Error(body?.message || 'Could not verify the bank account');
        if (!body?.accountName) throw new Error('Paystack did not return an account name');
        setResolvedName(body.accountName);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLookupError(error instanceof Error ? error.message : 'Could not verify the bank account');
      } finally {
        if (!controller.signal.aborted) setLookingUp(false);
      }
    }, 400);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [acctNo, bankCode]);

  function handlePinKey(k: string) {
    if (pin.length < 4) setPin(p => p + k);
  }
  function handlePinBack() { setPin(p => p.slice(0, -1)); }

  async function submitPin() {
    if (pin.length < 4) return;
    const amtValue = parseFloat(amount.replace(/,/g, '') || '0');
    if (amtValue + 10.75 > balance) {
      setShowInsufficientPopup(true);
      return;
    }
    setProcessing(true);
    setSubmitError('');
    const balanceBeforeTransfer = balance;
    const result = await completeBankTransfer({
      amount: amtValue,
      pin,
      recipientName: resolvedName,
      recipientBank: bank,
      recipientAccount: acctNo,
      note: narration || 'Transfer',
    });
    if (!result.success || !result.transaction) {
      setProcessing(false);
      setPinError(true);
      setSubmitError(result.error ?? 'Transfer could not be completed. Your balance was not changed.');
      setPin('');
      return;
    }

    setProcessing(false);
    setReceipt({
      transaction: result.transaction,
      recipientName: resolvedName,
      bank,
      accountNumber: acctNo,
      senderName: user?.name ?? 'Vexa account',
      senderAccountNumber: user?.accountNumber ?? '—',
      balanceBefore: balanceBeforeTransfer,
      balanceAfter: Math.max(0, balanceBeforeTransfer - amtValue),
    });
    setShowSuccessPopup(true);
  }

  async function handleModalPin(enteredPin: string) {
    if (enteredPin.length < 4) return;
    const amtValue = parseFloat(amount.replace(/,/g, '') || '0');
    if (amtValue + 10.75 > balance) {
      setShowPinPopup(false);
      setShowConfirmPopup(false);
      setShowInsufficientPopup(true);
      return;
    }
    setPinModalError('');
    setProcessing(true);
    setSubmitError('');
    const balanceBeforeTransfer = balance;
    const result = await completeBankTransfer({
      amount: amtValue,
      pin: enteredPin,
      recipientName: resolvedName,
      recipientBank: bank,
      recipientAccount: acctNo,
      note: narration || 'Transfer',
    });
    setProcessing(false);
    if (!result.success || !result.transaction) {
      setPinModalError(result.error ?? 'Transfer could not be completed.');
      return;
    }

    setShowPinPopup(false);
    setShowConfirmPopup(false);
    setReceipt({
      transaction: result.transaction,
      recipientName: resolvedName,
      bank,
      bankLogo: bankLogo || initialBank?.logoUrl || resolveBankLogoUrl(bank),
      accountNumber: acctNo,
      senderName: user?.name ?? 'Vexa account',
      senderAccountNumber: user?.accountNumber ?? '—',
      balanceBefore: balanceBeforeTransfer,
      balanceAfter: Math.max(0, balanceBeforeTransfer - amtValue),
    });
    setShowSuccessPopup(true);
  }

  const amtNum = parseFloat(amount.replace(/,/g, '') || '0');

  // ── Back arrow logic per step
  function goBack() {
    if (step === 'details') navigate('/');
    else if (step === 'amount') setStep('details');
    else if (step === 'create_pin') setStep('amount');
    else if (step === 'pin') setStep('amount');
  }

  /* ── STEP: SUCCESS ─────────────────────────────────── */
  if (step === 'success' && receipt) {
    return (
      <TransferReceipt
        receipt={receipt}
        onHome={() => navigate('/')}
        onTransferAgain={() => {
          setReceipt(null);
          setPin('');
          setStep('details');
        }}
      />
    );
  }

  /* ── STEP: CREATE TRANSFER PIN ─────────────────────── */
  if (step === 'create_pin') {
    return (
      <div className="fixed inset-0 bg-white flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>
        <div className="flex-none flex items-center gap-3 px-4 pb-3 bg-white border-b border-[#E8EBF0]"
          style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}>
          <button onClick={goBack} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          </button>
          <span className="text-[16px] font-bold text-[#111]">Create Transfer PIN</span>
        </div>
        <div className="flex-1 flex flex-col items-center px-6 py-8 gap-5 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
          <div className="w-16 h-16 rounded-full bg-[#EEF2FF] flex items-center justify-center">
            <Lock className="w-8 h-8 text-[#162353]" />
          </div>
          <div className="text-center">
            <p className="text-[18px] font-bold text-[#111] mb-1">Set your Transfer PIN</p>
            <p className="text-[13px] text-[#888] leading-relaxed max-w-xs">
              You need a 4-digit PIN to authorise every transfer. You'll enter it each time you send money.
            </p>
          </div>
          {createPinError && (
            <div className="w-full bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-[13px] text-red-600 font-medium">
              {createPinError}
            </div>
          )}
          <div className="w-full space-y-4">
            <div>
              <label className="text-[12px] font-semibold text-[#444] mb-1.5 block">New 4-digit PIN</label>
              <input
                type="password" inputMode="numeric" maxLength={4}
                value={newPinEntry}
                onChange={e => setNewPinEntry(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="• • • •"
                className="w-full text-center text-[24px] tracking-[0.5em] border border-[#E0E0E0] rounded-xl px-4 py-3 outline-none focus:border-[#162353] transition-colors placeholder:text-[#CCC]"
              />
            </div>
            <div>
              <label className="text-[12px] font-semibold text-[#444] mb-1.5 block">Confirm PIN</label>
              <input
                type="password" inputMode="numeric" maxLength={4}
                value={confirmPinEntry}
                onChange={e => setConfirmPinEntry(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="• • • •"
                className="w-full text-center text-[24px] tracking-[0.5em] border border-[#E0E0E0] rounded-xl px-4 py-3 outline-none focus:border-[#162353] transition-colors placeholder:text-[#CCC]"
              />
            </div>
          </div>
          <button
            disabled={newPinEntry.length < 4 || confirmPinEntry.length < 4 || savingPin}
            onClick={async () => {
              setCreatePinError('');
              if (newPinEntry !== confirmPinEntry) {
                setCreatePinError('PINs do not match. Please try again.');
                setConfirmPinEntry('');
                return;
              }
              setSavingPin(true);
              const res = await setInitialTransferPin(newPinEntry);
              setSavingPin(false);
              if (res.success) {
                setNewPinEntry(''); setConfirmPinEntry('');
                setStep('pin');
              } else {
                setCreatePinError(res.error ?? 'Failed to save PIN. Try again.');
              }
            }}
            className="w-full h-[50px] rounded-xl bg-[#F0B90B] hover:bg-[#FCD535] active:bg-[#DDAA09] text-[#181A20] text-[14px] font-bold shadow-sm disabled:opacity-45 transition-all"
          >
            {savingPin ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40 20" />
                </svg>
                Saving…
              </span>
            ) : 'Save Transfer PIN'}
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
                <div key={i} className={`w-4 h-4 rounded-full border-2 transition-all ${i < pin.length ? 'bg-[#F0B90B] border-[#F0B90B] scale-110 shadow-xs' : 'border-[#CBD5E1] bg-transparent dark:bg-[#2B313A]'}`} />
              ))}
            </div>
            {(pinError || submitError) && (
              <p className="text-[12px] text-red-500 -mt-2 text-center">
                {submitError || 'Incorrect PIN. Please try again.'}
              </p>
            )}
          </div>

          {/* Keypad */}
          <div className="w-full max-w-[288px]">
            <div className="grid grid-cols-3 gap-3 mb-4">
              {['1','2','3','4','5','6','7','8','9'].map(k => (
                <button key={k} onClick={() => handlePinKey(k)}
                  className="h-[54px] rounded-2xl bg-[#F2F3F5] text-[20px] font-semibold text-[#111] active:bg-[#E2E5EA] transition-colors">
                  {k}
                </button>
              ))}
              <div />
              <button onClick={() => handlePinKey('0')}
                className="h-[54px] rounded-2xl bg-[#F2F3F5] text-[20px] font-semibold text-[#111] active:bg-[#E2E5EA] transition-colors">
                0
              </button>
              <button onClick={handlePinBack}
                className="h-[54px] rounded-2xl bg-[#F2F3F5] text-[#333] flex items-center justify-center active:bg-[#E2E5EA] transition-colors">
                <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12H9M15 6l-6 6 6 6"/>
                </svg>
              </button>
            </div>
            <button
              onClick={submitPin}
              disabled={pin.length < 4 || processing}
              className={`w-full h-[50px] rounded-xl text-[14px] font-bold transition-all shadow-sm ${pin.length === 4 && !processing ? 'bg-[#F0B90B] hover:bg-[#FCD535] text-[#181A20] active:scale-[0.99]' : 'bg-[#F0B90B]/40 text-[#181A20]/40'}`}
            >
              {processing ? 'Processing…' : 'Confirm Transfer'}
            </button>
          </div>
        </div>

        {/* Insufficient Funds Modal matching user reference screenshot */}
        <InsufficientFundsModal
          isOpen={showInsufficientPopup}
          onClose={() => setShowInsufficientPopup(false)}
          amount={amtNum + 10.75}
          action="send money"
          accountNumber={user?.accountNumber || '—'}
          accountName={user?.name?.toUpperCase() || 'VEXA USER'}
          bankName="Vexa"
        />

        {/* Transfer Successful Modal matching user reference screenshot */}
        <TransferSuccessfulModal
          isOpen={showSuccessPopup}
          onClose={() => {
            setShowSuccessPopup(false);
            navigate('/');
          }}
          onViewReceipt={() => {
            setShowSuccessPopup(false);
            setStep('success');
          }}
          amount={amtNum}
          recipientName={resolvedName}
          recipientAccount={acctNo}
          recipientBank={bank}
          reference={receipt?.transaction?.id ? `VX${receipt.transaction.id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10).toUpperCase()}` : undefined}
        />
      </div>
    );
  }

  /* ── STEP: AMOUNT ──────────────────────────────────── */
  if (step === 'amount') {
    return (
      <div className="fixed inset-0 bg-[#F2F3F5] flex flex-col w-full max-w-full overflow-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>
        <div className="flex-none flex items-center gap-3 px-4 pb-3 bg-white w-full shadow-xs"
          style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}>
          <button onClick={goBack} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          </button>
          <span className="text-[16px] font-bold text-[#111]">Transfer</span>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden w-full max-w-full px-4 py-5 space-y-4" style={{ scrollbarWidth: 'none' }}>

          {/* Recipient summary without outline */}
          <div className="bg-white rounded-2xl px-5 py-4 border-0 shadow-sm flex items-center gap-3 w-full min-w-0">
            <BankLogoBadge bankName={bank} bankLogo={bankLogo} size="md" fallbackInitial={resolvedName.charAt(0)} />
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold text-[#111] truncate">{resolvedName}</p>
              <p className="text-[11px] text-[#888] truncate">{acctNo} · {bank}</p>
            </div>
          </div>

          {/* Amount without outlines */}
          <div className="bg-white rounded-2xl p-5 border-0 shadow-sm w-full min-w-0">
            <p className="text-[12px] font-semibold text-[#888] mb-1">Amount</p>
            <div className="flex items-center gap-2 border-0 outline-none ring-0 py-2 w-full min-w-0">
              <span className="text-[32px] font-extrabold text-[#111] select-none shrink-0">₦</span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={e => setAmount(formatAmt(e.target.value))}
                className="flex-1 min-w-0 w-full text-[36px] font-extrabold text-[#111] outline-none border-0 ring-0 focus:outline-none focus:ring-0 bg-transparent placeholder:text-[#CBD5E1]"
              />
            </div>
            {/* Quick amount pills without outlines */}
            <div className="flex gap-2 mt-3 flex-wrap w-full">
              {['1,000','5,000','10,000','20,000','50,000'].map(q => (
                <button key={q} onClick={() => setAmount(q)}
                  className={`px-3.5 py-1.5 rounded-full text-[12px] font-semibold transition-all border-0 outline-none ring-0 ${amount === q ? 'bg-[#F0B90B] text-[#181A20] shadow-xs' : 'bg-[#F2F4F7] text-[#444] hover:bg-[#E5E7EB]'}`}>
                  ₦{q}
                </button>
              ))}
            </div>
          </div>

          {/* Narration without outlines */}
          <div className="bg-white rounded-2xl p-5 border-0 shadow-sm w-full min-w-0">
            <p className="text-[12px] font-semibold text-[#444] mb-3">Narration <span className="text-[#888] font-normal">(optional)</span></p>
            <input
              type="text" placeholder="e.g. School fees, Rent…"
              value={narration} onChange={e => setNarration(e.target.value)}
              maxLength={50}
              className="w-full bg-[#F8FAFC] border-0 outline-none ring-0 focus:outline-none focus:ring-0 rounded-xl px-4 py-3 text-[14px] text-[#111] transition-colors placeholder:text-[#94A3B8]"
            />
          </div>

          {/* Fee note */}
          <p className="text-[11px] text-[#888] text-center w-full">
            Transaction fee: <span className="font-semibold text-[#555]">₦10.75</span> — waived for Vexa-to-Vexa transfers
          </p>

        </div>

        <div className="flex-none px-4 pb-6 pt-2 bg-[#F2F3F5] w-full max-w-full">
          <button
            onClick={() => {
              if (amtNum > 0) {
                if (amtNum + 10.75 > balance) {
                  setShowInsufficientPopup(true);
                  return;
                }
                if (!user?.hasPin) {
                  setStep('create_pin');
                } else {
                  setShowConfirmPopup(true);
                }
              }
            }}
            disabled={amtNum <= 0}
            className={`w-full h-[50px] rounded-xl text-[14px] font-bold transition-all shadow-sm ${amtNum > 0 ? 'bg-[#F0B90B] hover:bg-[#FCD535] text-[#181A20] active:scale-[0.99]' : 'bg-[#F0B90B]/40 text-[#181A20]/40'}`}
          >
            Continue
          </button>
        </div>

        {/* OPay-style Transfer Confirmation Bottom Sheet Popup */}
        <TransferConfirmationModal
          isOpen={showConfirmPopup}
          onClose={() => setShowConfirmPopup(false)}
          onProceedToPin={() => {
            setShowConfirmPopup(false);
            setShowPinPopup(true);
            setPinModalError('');
          }}
          onInsufficientFunds={() => {
            setShowConfirmPopup(false);
            setShowInsufficientPopup(true);
          }}
          bankName={bank}
          bankLogo={bankLogo}
          accountNumber={acctNo}
          recipientName={resolvedName}
          amount={amtNum}
          userBalance={balance}
          onAddMoney={() => navigate('/')}
          fee={10.0}
          vat={0.75}
        />

        {/* Enter PIN Bottom Sheet Popup matching same sleek design */}
        <PaymentPinModal
          isOpen={showPinPopup}
          onClose={() => setShowPinPopup(false)}
          onSuccessPin={handleModalPin}
          amount={amtNum + 10.75}
          recipientName={resolvedName}
          bankName={bank}
          error={pinModalError}
          processing={processing}
        />

        {/* Insufficient Funds Modal matching user reference screenshot */}
        <InsufficientFundsModal
          isOpen={showInsufficientPopup}
          onClose={() => setShowInsufficientPopup(false)}
          amount={amtNum + 10.75}
          action="send money"
          accountNumber={user?.accountNumber || '—'}
          accountName={user?.name?.toUpperCase() || 'VEXA USER'}
          bankName="Vexa"
        />

        {/* Transfer Successful Modal matching user reference screenshot */}
        <TransferSuccessfulModal
          isOpen={showSuccessPopup}
          onClose={() => {
            setShowSuccessPopup(false);
            navigate('/');
          }}
          onViewReceipt={() => {
            setShowSuccessPopup(false);
            setStep('success');
          }}
          amount={amtNum}
          recipientName={resolvedName}
          recipientAccount={acctNo}
          recipientBank={bank}
          reference={receipt?.transaction?.id ? `VX${receipt.transaction.id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10).toUpperCase()}` : undefined}
        />
      </div>
    );
  }

  /* ── STEP: DETAILS ─────────────────────────────────── */
  return (
    <div className="fixed inset-0 bg-[#F2F3F5] flex flex-col w-full max-w-full overflow-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div className="flex-none flex items-center gap-3 px-4 pb-3 bg-white w-full shadow-xs"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}>
        <button onClick={goBack} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <span className="text-[16px] font-bold text-[#111]">Transfer</span>
        <button onClick={() => navigate('/vexa-transfer')} className="ml-auto rounded-full bg-[#EAF2FF] text-[#2563EB] px-3 py-1.5 text-[10px] font-bold border-0 outline-none">Vexa to Vexa</button>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden w-full max-w-full px-4 py-5 space-y-4" style={{ scrollbarWidth: 'none' }}>

        {/* Bank picker */}
        <div className="bg-white rounded-2xl p-5 border-0 shadow-sm">
          <p className="text-[12px] font-semibold text-[#444] mb-3">Select Bank</p>
          <button
            onClick={() => navigate('/bank-selection?returnTo=/transfer')}
            className="w-full flex items-center justify-between bg-[#F8FAFC] border-0 outline-none ring-0 focus:outline-none focus:ring-0 rounded-xl px-4 py-3 transition-colors disabled:opacity-60"
          >
            <span className="flex min-w-0 items-center gap-2">
              {bank ? (
                <span className="w-7 h-7 rounded-full bg-[#F2F3F5] flex items-center justify-center overflow-hidden shrink-0">
                  {bankLogo ? (
                    <img
                      src={bankLogo}
                      alt=""
                      className="w-6 h-6 object-contain"
                    />
                  ) : (
                    <span className="text-[10px] font-bold text-[#162353]">{bank.slice(0, 1)}</span>
                  )}
                </span>
              ) : null}
              <span className={`truncate text-[14px] ${bank ? 'text-[#111] font-semibold' : 'text-[#CCC]'}`}>
                {bank || 'Choose bank…'}
              </span>
            </span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
        </div>

        {/* Account number */}
        <div className="bg-white rounded-2xl p-5 border-0 shadow-sm">
          <p className="text-[12px] font-semibold text-[#444] mb-3">Account Number</p>
          <input
            type="text" inputMode="numeric" placeholder="10-digit account number"
            value={acctNo}
            onChange={e => setAcctNo(e.target.value.replace(/\D/g, '').slice(0, 10))}
            className="w-full bg-[#F8FAFC] border-0 outline-none ring-0 focus:outline-none focus:ring-0 rounded-xl px-4 py-3 text-[16px] font-semibold tracking-widest text-[#111] transition-colors placeholder:text-[#94A3B8] placeholder:tracking-normal placeholder:font-normal"
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
            {!lookingUp && !resolvedName && submitError && (
              <span className="text-[12px] text-red-500">{submitError}</span>
            )}
            {!lookingUp && !resolvedName && lookupError && (
              <span className="text-[12px] text-red-500">{lookupError}</span>
            )}
          </div>
        </div>

      </div>

      <div className="flex-none px-4 pb-6 pt-2 bg-[#F2F3F5]">
        <button
           onClick={() => { if (bank && bankCode && resolvedName) setStep('amount'); }}
           disabled={!bank || !bankCode || !resolvedName}
           className={`w-full h-[50px] rounded-xl text-[14px] font-bold transition-all shadow-sm ${bank && bankCode && resolvedName ? 'bg-[#F0B90B] hover:bg-[#FCD535] text-[#181A20] active:scale-[0.99]' : 'bg-[#F0B90B]/40 text-[#181A20]/40'}`}
        >
          Continue
        </button>
      </div>
    </div>
  );
}

function TransferReceipt({
  receipt,
  onHome,
  onTransferAgain,
}: {
  receipt: TransferReceiptData;
  onHome: () => void;
  onTransferAgain?: () => void;
}) {
  return (
    <BankingTransferReceipt
      receipt={receipt}
      onHome={onHome}
      onTransferAgain={onTransferAgain}
      createReceiptImageFn={createTransferReceiptImage}
    />
  );
}

function TransactionReceiptPage() {
  const [, navigate] = useLocation();
  const [, params] = useRoute('/receipt/:transactionId');
  const { user } = useAuth();
  const { balance, transactions, transactionsLoading } = useUserData();
  const transaction = transactions.find(tx => tx.id === params?.transactionId);

  if (transactionsLoading) {
    return (
      <div className="fixed inset-0 bg-white flex items-center justify-center">
        <svg className="animate-spin w-7 h-7 text-[#162353]" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40 20" />
        </svg>
      </div>
    );
  }

  if (!transaction) {
    return (
      <div className="fixed inset-0 bg-[#F2F3F5] flex flex-col items-center justify-center px-6 text-center">
        <div className="w-16 h-16 rounded-full bg-[#EEF2FF] flex items-center justify-center mb-4">
          <FileText className="w-7 h-7 text-[#162353]" />
        </div>
        <p className="text-[18px] font-bold text-[#111]">Receipt not found</p>
        <p className="text-[13px] text-[#888] mt-2 mb-6">This transaction is not available in your account history.</p>
        <button onClick={() => navigate('/history')} className="w-full max-w-xs h-[48px] rounded-xl bg-[#F0B90B] hover:bg-[#FCD535] active:bg-[#DDAA09] text-[#181A20] text-[14px] font-bold shadow-sm transition-all">
          Back to History
        </button>
      </div>
    );
  }

  const receipt: TransferReceiptData = {
    transaction,
    recipientName: transaction.name,
    bank: transaction.recipient_bank ?? 'Bank transfer',
    bankLogo: resolveBankLogoUrl(transaction.recipient_bank ?? ''),
    accountNumber: transaction.recipient_account ?? 'Not recorded',
    senderName: transaction.sender_name ?? user?.name ?? 'Vexa account',
    senderAccountNumber: transaction.sender_account ?? user?.accountNumber ?? '—',
    balanceAfter: balance,
    balanceBefore: balance + transaction.raw_amount,
  };

  return (
    <TransferReceipt
      receipt={receipt}
      onHome={() => navigate('/')}
      onTransferAgain={() => navigate('/transfer')}
    />
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

function PinModal({
  amount,
  label,
  onSuccess,
  onAuthorize,
  onClose,
}: {
  amount: string;
  label: string;
  onSuccess: () => void;
  onAuthorize?: (pin: string) => Promise<{ success: boolean; error?: string }>;
  onClose: () => void;
}) {
  const { user, verifyTransactionPin } = useAuth();
  const { balance } = useUserData();
  const { state: securityState } = useAccountSecurity();
  const [pin, setPin] = useState('');
  const [processing, setProcessing] = useState(false);
  const [blockedMessage, setBlockedMessage] = useState('');
  const [showInsufficient, setShowInsufficient] = useState(false);
  const movementBlocked = securityState.sleepModeActive || securityState.freezeActive;
  const numAmt = parseFloat(amount.replace(/,/g, '') || '0');
  const availableBalance = balance ?? user?.balance ?? 0;

  async function submit() {
    if (pin.length < 4 || processing) return;
    setBlockedMessage('');
    if (movementBlocked) {
      setBlockedMessage(securityState.freezeActive
        ? 'Freeze Account is active. Money movement is blocked.'
        : 'Sleep Mode is active. Money movement is blocked.');
      return;
    }
    if (numAmt > availableBalance) {
      setShowInsufficient(true);
      return;
    }
    if (onAuthorize) {
      setProcessing(true);
      try {
        const result = await onAuthorize(pin);
        setProcessing(false);
        if (!result.success) {
          setBlockedMessage(result.error || 'Could not authorize payment.');
          setPin('');
          return;
        }
        onSuccess();
      } catch {
        setProcessing(false);
        setBlockedMessage('Network error. Please try again.');
      }
      return;
    }
    setProcessing(true);
    try {
      const check = await verifyTransactionPin(pin);
      setProcessing(false);
      if (!check.verified) {
        setBlockedMessage(check.message || 'Incorrect transaction PIN.');
        setPin('');
        return;
      }
      onSuccess();
    } catch {
      setProcessing(false);
      setBlockedMessage('Network error. Please try again.');
    }
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
        {blockedMessage && <p className="mb-4 rounded-xl bg-red-50 px-3 py-2.5 text-center text-[12px] font-semibold text-red-600">{blockedMessage}</p>}
        <div className="flex justify-center gap-5 mb-6">
          {[0,1,2,3].map(i => (
            <div key={i} className={`w-4 h-4 rounded-full border-2 transition-all ${i < pin.length ? 'bg-[#F0B90B] border-[#F0B90B] scale-110' : 'border-[#CBD5E1] bg-transparent dark:bg-[#2B313A]'}`} />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2.5 w-full max-w-[288px] mx-auto mb-4">
          {['1','2','3','4','5','6','7','8','9'].map(k => (
            <button key={k} onClick={() => !processing && pin.length < 4 && setPin(p => p + k)}
              className="h-[52px] rounded-2xl bg-[#F2F3F5] text-[20px] font-semibold text-[#111] active:bg-[#E2E5EA]">{k}</button>
          ))}
          <div />
          <button onClick={() => !processing && pin.length < 4 && setPin(p => p + '0')}
            className="h-[52px] rounded-2xl bg-[#F2F3F5] text-[20px] font-semibold text-[#111] active:bg-[#E2E5EA]">0</button>
          <button onClick={() => !processing && setPin(p => p.slice(0, -1))}
            className="h-[52px] rounded-2xl bg-[#F2F3F5] text-[#333] flex items-center justify-center active:bg-[#E2E5EA]">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12H9M15 6l-6 6 6 6"/></svg>
          </button>
        </div>
        <button onClick={() => { void submit(); }} disabled={pin.length < 4 || processing || movementBlocked}
          className={`w-full h-[50px] rounded-xl text-[14px] font-bold transition-all shadow-sm ${pin.length === 4 && !processing && !movementBlocked ? 'bg-[#F0B90B] hover:bg-[#FCD535] active:bg-[#DDAA09] text-[#181A20]' : 'bg-[#F0B90B]/40 text-[#181A20]/50'}`}>
          {movementBlocked ? 'Money movement blocked' : processing ? 'Processing…' : 'Pay Now'}
        </button>
      </div>

      <InsufficientFundsModal
        isOpen={showInsufficient}
        onClose={() => setShowInsufficient(false)}
        amount={amount}
        action={label.toLowerCase()}
        accountNumber={user?.accountNumber || '—'}
        accountName={user?.name?.toUpperCase() || 'VEXA USER'}
        bankName="Vexa"
      />
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
      <button onClick={onHome} className="w-full max-w-xs bg-[#F0B90B] hover:bg-[#FCD535] active:bg-[#DDAA09] rounded-xl h-[50px] text-[14px] font-bold text-[#181A20] shadow-sm transition-all">Back to Home</button>
    </div>
  );
}

/* ─── Airtime & Data Networks ────────────────────────────────────────── */
type TelecomNetwork = {
  id: string;
  name: string;
  domain: string;
  color: string;
  text: string;
  logoUrl?: string | null;
};

const NETWORKS: TelecomNetwork[] = [
  { id: 'mtn',     name: 'MTN',     domain: 'mtn.ng',         color: '#FFD700', text: '#000' },
  { id: 'airtel',  name: 'Airtel',  domain: 'airtel.com.ng',  color: '#DC2626', text: '#fff' },
  { id: 'glo',     name: 'Glo',     domain: 'gloworld.com',   color: '#16A34A', text: '#fff' },
  { id: '9mobile', name: '9mobile', domain: '9mobile.com.ng', color: '#1D7F3E', text: '#fff' },
];
const AIRTIME_AMOUNTS = ['100','200','500','1,000','2,000','5,000'];

function TelecomNetworkLogo({ item }: { item: TelecomNetwork }) {
  const [imgFailed, setImgFailed] = useState(false);

  if (item.logoUrl && !imgFailed) {
    return (
      <span className="w-10 h-10 rounded-full bg-white border border-slate-200 dark:border-[#2B313A] flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
        <img
          src={item.logoUrl}
          alt={`${item.name} logo`}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover rounded-full"
          onError={() => setImgFailed(true)}
        />
      </span>
    );
  }

  return (
    <span
      className="w-10 h-10 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 shadow-xs"
      style={{ background: item.color, color: item.text }}
      aria-hidden="true"
    >
      {item.name.slice(0, 3)}
    </span>
  );
}

function useTelecomNetworks() {
  const [networks, setNetworks] = useState<TelecomNetwork[]>(NETWORKS);

  useEffect(() => {
    let active = true;
    void fetch('/api/telecom/networks', { headers: { accept: 'application/json' } })
      .then(async (res) => {
        if (!res.ok) return null;
        return (await res.json()) as { networks?: TelecomNetwork[] };
      })
      .then((body) => {
        if (active && Array.isArray(body?.networks) && body.networks.length > 0) {
          setNetworks(body.networks);
        }
      })
      .catch(() => {
        // Keep fallback network list silently
      });
    return () => {
      active = false;
    };
  }, []);

  return networks;
}

async function executeTelecomPurchase(
  accessToken: string | undefined,
  payload: {
    productType: 'airtime' | 'data';
    networkName: string;
    phone: string;
    dataBundle?: string;
    amount: number;
    useCashback: boolean;
    pin: string;
  },
): Promise<{ success: boolean; error?: string; cashbackUsed?: number; cashbackEarned?: number; payableAmount?: number }> {
  if (!accessToken) {
    return { success: false, error: 'Your session expired. Please sign in again.' };
  }
  const resp = await fetch('/api/telecom/purchase', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });
  const body = (await resp.json().catch(() => null)) as {
    message?: string;
    cashbackUsed?: number;
    cashbackEarned?: number;
    payableAmount?: number;
  } | null;
  if (!resp.ok) {
    return { success: false, error: body?.message || 'Could not complete purchase.' };
  }
  return {
    success: true,
    cashbackUsed: body?.cashbackUsed ?? 0,
    cashbackEarned: body?.cashbackEarned ?? 0,
    payableAmount: body?.payableAmount ?? payload.amount,
  };
}

function AirtimePage() {
  const { user, session, refreshProfile } = useAuth();
  const { balance, cashbackRedeemable, cashbackPending, refreshAll } = useUserData();
  const [, navigate] = useLocation();
  const networks = useTelecomNetworks();
  const [network, setNetwork] = useState('');
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [showCheckout, setShowCheckout] = useState(false);
  const [checkoutMeta, setCheckoutMeta] = useState<{ payableAmtStr: string; useCashback: boolean }>({
    payableAmtStr: '',
    useCashback: false,
  });
  const [receiptMeta, setReceiptMeta] = useState<{ cashbackUsed: number; cashbackEarned: number }>({
    cashbackUsed: 0,
    cashbackEarned: 0,
  });
  const [showPin, setShowPin] = useState(false);
  const [done, setDone] = useState(false);

  if (done) {
    const cbParts: string[] = [];
    if (receiptMeta.cashbackUsed > 0) cbParts.push(`₦${receiptMeta.cashbackUsed.toFixed(2)} cashback applied`);
    if (receiptMeta.cashbackEarned > 0) cbParts.push(`earned ₦${receiptMeta.cashbackEarned.toFixed(2)} cashback`);
    const extra = cbParts.length > 0 ? ` (${cbParts.join(' · ')})` : '';
    return (
      <SuccessBanner
        title="Airtime Purchased!"
        sub={`₦${amount} airtime sent to ${phone}${extra}`}
        onHome={() => navigate('/')}
      />
    );
  }

  const parsedAmount = parseFloat(amount.replace(/,/g, '') || '0');
  const canProceed = Boolean(network && phone.length >= 10 && parsedAmount > 0);
  const selectedNetworkObj = networks.find(n => n.id === network) ?? networks[0] ?? NETWORKS[0];

  const handleContinue = () => {
    if (!canProceed) return;
    setShowCheckout(true);
  };

  return (
    <PageShell title="Buy Airtime" back="/">
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4" style={{ scrollbarWidth: 'none' }}>
        {/* Network */}
        <div className="theme-surface theme-border rounded-2xl p-5 border">
          <p className="text-[12px] font-semibold theme-text-secondary mb-3">Select Network</p>
          <div className="grid grid-cols-4 gap-2">
            {networks.map(n => (
              <button key={n.id} type="button" onClick={() => setNetwork(n.id)}
                className={`flex flex-col items-center gap-1.5 py-3 px-1 rounded-xl border-2 transition-all ${network === n.id ? 'theme-selected-control border-[#F0B90B] dark:border-[#F0B90B]' : 'theme-border hover:border-[#D0D5DD] dark:hover:border-[#3A414D]'}`}>
                <TelecomNetworkLogo item={n} />
                <span className="text-[10px] theme-text-primary font-semibold truncate max-w-full">{n.name}</span>
              </button>
            ))}
          </div>
        </div>
        {/* Phone */}
        <div className="theme-surface theme-border rounded-2xl p-5 border">
          <p className="text-[12px] font-semibold theme-text-secondary mb-3">Phone Number</p>
          <input type="tel" inputMode="tel" placeholder="08012345678" value={phone}
            onChange={e => setPhone(e.target.value.replace(/\D/g,'').slice(0,11))}
            className="theme-field theme-border w-full border rounded-xl px-4 py-3 text-[16px] font-semibold tracking-wider theme-text-primary outline-none focus:border-[#F0B90B] transition-colors placeholder:text-[var(--theme-secondary-text)] placeholder:font-normal placeholder:tracking-normal" />
        </div>
        {/* Amount */}
        <div className="theme-surface theme-border rounded-2xl p-5 border">
          <p className="text-[12px] font-semibold theme-text-secondary mb-3">Amount</p>
          <div className="theme-field theme-border flex items-center gap-2 border rounded-xl px-4 py-3 focus-within:border-[#F0B90B] mb-3">
            <span className="text-[18px] font-bold theme-text-secondary">₦</span>
            <input type="text" inputMode="numeric" placeholder="0" value={amount}
              onChange={e => setAmount(formatAmt(e.target.value))}
              className="flex-1 text-[18px] font-semibold theme-text-primary outline-none bg-transparent placeholder:text-[var(--theme-secondary-text)]" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            {AIRTIME_AMOUNTS.map(a => (
              <button key={a} type="button" onClick={() => setAmount(a)}
                className={`py-2 rounded-xl text-[12px] font-semibold border transition-all ${amount===a ? 'bg-[#F0B90B] text-[#181A20] border-[#F0B90B] shadow-xs' : 'theme-border theme-text-secondary'}`}>
                ₦{a}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="flex-none px-4 pb-6 pt-2">
        <button onClick={handleContinue} disabled={!canProceed}
          className={`w-full h-[50px] rounded-xl text-[14px] font-bold transition-all shadow-sm ${canProceed ? 'bg-[#F0B90B] hover:bg-[#FCD535] active:bg-[#DDAA09] text-[#181A20]' : 'bg-[#F0B90B]/40 text-[#181A20]/50'}`}>
          Continue
        </button>
      </div>
      <TelecomCheckoutModal
        isOpen={showCheckout}
        onClose={() => setShowCheckout(false)}
        productType="airtime"
        network={selectedNetworkObj}
        phone={phone}
        amount={parsedAmount}
        availableBalance={balance ?? user?.balance ?? 0}
        cashbackBalance={cashbackRedeemable}
        pendingCashbackBalance={cashbackPending}
        onPay={(payableAmount, _cashbackUsed, useCashback) => {
          setShowCheckout(false);
          setCheckoutMeta({
            payableAmtStr: payableAmount.toLocaleString('en-NG', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }),
            useCashback,
          });
          setShowPin(true);
        }}
        onAddMoney={() => {
          setShowCheckout(false);
          navigate('/deposit');
        }}
      />
      {showPin && (
        <PinModal
          amount={checkoutMeta.payableAmtStr || amount}
          label={`Airtime for ${phone}${checkoutMeta.useCashback ? ' (Cashback applied)' : ''}`}
          onAuthorize={async (pin) => {
            const res = await executeTelecomPurchase(session?.access_token, {
              productType: 'airtime',
              networkName: selectedNetworkObj.name,
              phone,
              amount: parsedAmount,
              useCashback: checkoutMeta.useCashback,
              pin,
            });
            if (res.success) {
              setReceiptMeta({
                cashbackUsed: res.cashbackUsed ?? 0,
                cashbackEarned: res.cashbackEarned ?? 0,
              });
              refreshAll();
              void refreshProfile();
            }
            return res;
          }}
          onSuccess={() => {
            setShowPin(false);
            setDone(true);
          }}
          onClose={() => setShowPin(false)}
        />
      )}
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
  const { user, session, refreshProfile } = useAuth();
  const { balance, cashbackRedeemable, cashbackPending, refreshAll } = useUserData();
  const [, navigate] = useLocation();
  const networks = useTelecomNetworks();
  const [network, setNetwork] = useState('');
  const [phone, setPhone]     = useState('');
  const [plan, setPlan]       = useState('');
  const [showCheckout, setShowCheckout] = useState(false);
  const [checkoutMeta, setCheckoutMeta] = useState<{ payableAmtStr: string; useCashback: boolean }>({
    payableAmtStr: '',
    useCashback: false,
  });
  const [receiptMeta, setReceiptMeta] = useState<{ cashbackUsed: number; cashbackEarned: number }>({
    cashbackUsed: 0,
    cashbackEarned: 0,
  });
  const [showPin, setShowPin] = useState(false);
  const [done, setDone]       = useState(false);

  if (done) {
    const cbParts: string[] = [];
    if (receiptMeta.cashbackUsed > 0) cbParts.push(`₦${receiptMeta.cashbackUsed.toFixed(2)} cashback applied`);
    if (receiptMeta.cashbackEarned > 0) cbParts.push(`earned ₦${receiptMeta.cashbackEarned.toFixed(2)} cashback`);
    const extra = cbParts.length > 0 ? ` (${cbParts.join(' · ')})` : '';
    return (
      <SuccessBanner
        title="Data Activated!"
        sub={`${plan} sent to ${phone}${extra}`}
        onHome={() => navigate('/')}
      />
    );
  }

  const plans = network ? DATA_PLANS[network] : [];
  const selectedPlan = plans.find(p => p.size === plan);
  const selectedNetworkObj = networks.find(n => n.id === network) ?? networks[0] ?? NETWORKS[0];
  const parsedPlanPrice = parseFloat(selectedPlan?.price.replace(/,/g, '') || '0');
  const canProceed = Boolean(network && phone.length >= 10 && selectedPlan && parsedPlanPrice > 0);

  const handleContinue = () => {
    if (!canProceed) return;
    setShowCheckout(true);
  };

  return (
    <PageShell title="Buy Data" back="/">
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4" style={{ scrollbarWidth: 'none' }}>
        <div className="theme-surface theme-border rounded-2xl p-5 border">
          <p className="text-[12px] font-semibold theme-text-secondary mb-3">Select Network</p>
          <div className="grid grid-cols-4 gap-2">
            {networks.map(n => (
              <button key={n.id} type="button" onClick={() => { setNetwork(n.id); setPlan(''); }}
                className={`flex flex-col items-center gap-1.5 py-3 px-1 rounded-xl border-2 transition-all ${network===n.id ? 'theme-selected-control border-[#F0B90B] dark:border-[#F0B90B]' : 'theme-border hover:border-[#D0D5DD] dark:hover:border-[#3A414D]'}`}>
                <TelecomNetworkLogo item={n} />
                <span className="text-[10px] theme-text-primary font-semibold truncate max-w-full">{n.name}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="theme-surface theme-border rounded-2xl p-5 border">
          <p className="text-[12px] font-semibold theme-text-secondary mb-3">Phone Number</p>
          <input type="tel" inputMode="tel" placeholder="08012345678" value={phone}
            onChange={e => setPhone(e.target.value.replace(/\D/g,'').slice(0,11))}
            className="theme-field theme-border w-full border rounded-xl px-4 py-3 text-[16px] font-semibold tracking-wider theme-text-primary outline-none focus:border-[#F0B90B] transition-colors placeholder:text-[var(--theme-secondary-text)] placeholder:font-normal placeholder:tracking-normal" />
        </div>
        {network && (
          <div className="theme-surface theme-border rounded-2xl p-5 border">
            <p className="text-[12px] font-semibold theme-text-secondary mb-3">Select Plan</p>
            <div className="space-y-2">
              {plans.map(p => (
                <button key={p.size} type="button" onClick={() => setPlan(p.size)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all ${plan===p.size ? 'theme-selected-control border-[#F0B90B] dark:border-[#F0B90B]' : 'theme-border'}`}>
                  <div className="text-left">
                    <p className="text-[14px] font-bold theme-text-primary">{p.size}</p>
                    <p className="text-[11px] theme-text-secondary">Valid for {p.validity}</p>
                  </div>
                  <p className="text-[14px] font-bold text-[#B7791F] dark:text-[#F0B90B]">₦{p.price}</p>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="flex-none px-4 pb-6 pt-2">
        <button onClick={handleContinue} disabled={!canProceed}
          className={`w-full h-[50px] rounded-xl text-[14px] font-bold transition-all shadow-sm ${canProceed ? 'bg-[#F0B90B] hover:bg-[#FCD535] active:bg-[#DDAA09] text-[#181A20]' : 'bg-[#F0B90B]/40 text-[#181A20]/50'}`}>
          Continue
        </button>
      </div>
      <TelecomCheckoutModal
        isOpen={showCheckout && Boolean(selectedPlan)}
        onClose={() => setShowCheckout(false)}
        productType="data"
        network={selectedNetworkObj}
        phone={phone}
        dataBundle={selectedPlan ? `${selectedPlan.size} (${selectedPlan.validity})` : undefined}
        amount={parsedPlanPrice}
        availableBalance={balance ?? user?.balance ?? 0}
        cashbackBalance={cashbackRedeemable}
        pendingCashbackBalance={cashbackPending}
        onPay={(payableAmount, _cashbackUsed, useCashback) => {
          setShowCheckout(false);
          setCheckoutMeta({
            payableAmtStr: payableAmount.toLocaleString('en-NG', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }),
            useCashback,
          });
          setShowPin(true);
        }}
        onAddMoney={() => {
          setShowCheckout(false);
          navigate('/deposit');
        }}
      />
      {showPin && selectedPlan && (
        <PinModal
          amount={checkoutMeta.payableAmtStr || selectedPlan.price}
          label={`${plan} data for ${phone}${checkoutMeta.useCashback ? ' (Cashback applied)' : ''}`}
          onAuthorize={async (pin) => {
            const res = await executeTelecomPurchase(session?.access_token, {
              productType: 'data',
              networkName: selectedNetworkObj.name,
              phone,
              dataBundle: `${selectedPlan.size} (${selectedPlan.validity})`,
              amount: parsedPlanPrice,
              useCashback: checkoutMeta.useCashback,
              pin,
            });
            if (res.success) {
              setReceiptMeta({
                cashbackUsed: res.cashbackUsed ?? 0,
                cashbackEarned: res.cashbackEarned ?? 0,
              });
              refreshAll();
              void refreshProfile();
            }
            return res;
          }}
          onSuccess={() => {
            setShowPin(false);
            setDone(true);
          }}
          onClose={() => setShowPin(false)}
        />
      )}
    </PageShell>
  );
}

/* ─── Betting Page ───────────────────────────────────────────────────── */
type BettingPlatform = {
  id: string;
  name: string;
  domain: string;
  color: string;
  logoUrl?: string | null;
};

const BETTING_PLATFORMS: BettingPlatform[] = [
  { id: 'bet9ja',   name: 'Bet9ja',    domain: 'bet9ja.com',   color: '#006400' },
  { id: 'sporty',   name: 'SportyBet', domain: 'sportybet.com', color: '#E11D48' },
  { id: 'betking',  name: 'BetKing',   domain: 'betking.com',  color: '#1D4ED8' },
  { id: '1xbet',    name: '1xBet',     domain: '1xbet.com',    color: '#0284C7' },
  { id: 'nairabet', name: 'NairaBet',  domain: 'nairabet.com', color: '#15803D' },
  { id: 'msport',   name: 'MSport',    domain: 'msport.com',   color: '#D97706' },
];

function BettingPlatformLogo({ item }: { item: BettingPlatform }) {
  const [imgFailed, setImgFailed] = useState(false);

  if (item.logoUrl && !imgFailed) {
    return (
      <span className="w-10 h-10 rounded-full bg-white border border-slate-200 dark:border-[#2B313A] flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
        <img
          src={item.logoUrl}
          alt={`${item.name} logo`}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover rounded-full"
          onError={() => setImgFailed(true)}
        />
      </span>
    );
  }

  return (
    <span
      className="w-10 h-10 rounded-full flex items-center justify-center text-[11px] font-black text-white shrink-0 shadow-xs"
      style={{ backgroundColor: item.color }}
      aria-hidden="true"
    >
      {item.name.slice(0, 2).toUpperCase()}
    </span>
  );
}

function BettingPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [platforms, setPlatforms] = useState<BettingPlatform[]>(BETTING_PLATFORMS);
  const [platform, setPlatform] = useState('');
  const [userId, setUserId]     = useState('');
  const [amount, setAmount]     = useState('');
  const [showPin, setShowPin]   = useState(false);
  const [showInsufficient, setShowInsufficient] = useState(false);
  const [done, setDone]         = useState(false);

  useEffect(() => {
    let active = true;
    void fetch('/api/betting/platforms', { headers: { accept: 'application/json' } })
      .then(async (res) => {
        if (!res.ok) return null;
        return (await res.json()) as { platforms?: BettingPlatform[] };
      })
      .then((body) => {
        if (active && Array.isArray(body?.platforms) && body.platforms.length > 0) {
          setPlatforms(body.platforms);
        }
      })
      .catch(() => {
        // Keep fallback platform list silently
      });
    return () => {
      active = false;
    };
  }, []);

  if (done) return <SuccessBanner title="Wallet Funded!" sub={`₦${amount} added to ${platform} account ${userId}`} onHome={() => navigate('/')} />;

  const canProceed = platform && userId && parseFloat(amount.replace(/,/g,'')) > 0;

  const handleContinue = () => {
    if (!canProceed) return;
    const betAmt = parseFloat(amount.replace(/,/g, '') || '0');
    if (user && betAmt > (user.balance ?? 0)) {
      setShowInsufficient(true);
      return;
    }
    setShowPin(true);
  };

  return (
    <PageShell title="Betting" back="/">
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4" style={{ scrollbarWidth: 'none' }}>
        <div className="theme-surface theme-border rounded-2xl p-5 border">
          <p className="text-[12px] font-semibold theme-text-secondary mb-3">Select Platform</p>
          <div className="grid grid-cols-3 gap-2.5">
            {platforms.map(b => {
              const isSelected = platform === b.name;
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setPlatform(b.name)}
                  className={`flex flex-col items-center justify-center gap-2 py-3 px-2 rounded-xl border-2 text-[11px] font-bold transition-all ${
                    isSelected
                      ? 'theme-selected-control border-[#F0B90B] dark:border-[#F0B90B]'
                      : 'theme-border hover:border-[#D0D5DD] dark:hover:border-[#3A414D]'
                  }`}
                >
                  <BettingPlatformLogo item={b} />
                  <span className="truncate max-w-full theme-text-primary">{b.name}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="theme-surface theme-border rounded-2xl p-5 border">
          <p className="text-[12px] font-semibold theme-text-secondary mb-3">User ID / Username</p>
          <input type="text" placeholder="Enter your betting user ID" value={userId}
            onChange={e => setUserId(e.target.value)}
            className="theme-field theme-border w-full border rounded-xl px-4 py-3 text-[14px] theme-text-primary outline-none focus:border-[#F0B90B] transition-colors placeholder:text-[var(--theme-secondary-text)]" />
        </div>
        <div className="theme-surface theme-border rounded-2xl p-5 border">
          <p className="text-[12px] font-semibold theme-text-secondary mb-3">Amount</p>
          <div className="theme-field theme-border flex items-center gap-2 border rounded-xl px-4 py-3 focus-within:border-[#F0B90B] mb-3">
            <span className="text-[18px] font-bold theme-text-secondary">₦</span>
            <input type="text" inputMode="numeric" placeholder="0.00" value={amount}
              onChange={e => setAmount(formatAmt(e.target.value))}
              className="flex-1 text-[18px] font-semibold theme-text-primary outline-none bg-transparent placeholder:text-[var(--theme-secondary-text)]" />
          </div>
          <div className="flex gap-2 flex-wrap">
            {['500','1,000','2,000','5,000','10,000'].map(a => (
              <button key={a} type="button" onClick={() => setAmount(a)}
                className={`px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-all ${amount===a ? 'bg-[#F0B90B] text-[#181A20] border-[#F0B90B] shadow-xs' : 'theme-border theme-text-secondary'}`}>
                ₦{a}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="flex-none px-4 pb-6 pt-2">
        <button onClick={handleContinue} disabled={!canProceed}
          className={`w-full h-[50px] rounded-xl text-[14px] font-bold transition-all shadow-sm ${canProceed ? 'bg-[#F0B90B] hover:bg-[#FCD535] active:bg-[#DDAA09] text-[#181A20]' : 'bg-[#F0B90B]/40 text-[#181A20]/50'}`}>
          Fund Wallet
        </button>
      </div>
      {showPin && <PinModal amount={amount} label={`Fund ${platform} · ${userId}`} onSuccess={() => { setShowPin(false); setDone(true); }} onClose={() => setShowPin(false)} />}
      <InsufficientFundsModal
        isOpen={showInsufficient}
        onClose={() => setShowInsufficient(false)}
        amount={amount}
        action="fund betting wallet"
        accountNumber={user?.accountNumber || '—'}
        accountName={user?.name?.toUpperCase() || 'VEXA USER'}
        bankName="Vexa"
      />
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
  const [goals, setGoals] = useState<SavingsGoal[]>(INIT_GOALS);
  const [activeTab, setActiveTab] = useState<'goals' | 'plans'>('goals');
  const [showCreate, setShowCreate] = useState(false);
  const [goalName, setGoalName] = useState('');
  const [goalAmt, setGoalAmt] = useState('');
  const [frequency, setFreq] = useState('Monthly');
  const [dueDate, setDueDate] = useState('');
  const [autoSave, setAutoSave] = useState(false);
  const [topUpGoalId, setTopUpGoalId] = useState<string | null>(null);
  const [topUpAmt, setTopUpAmt] = useState('');
  const [notice, setNotice] = useState('');

  const totalSaved = goals.reduce((s,g) => s + g.saved, 0);
  const totalTarget = goals.reduce((s,g) => s + g.target, 0);
  const overallPct = totalTarget ? Math.min(100, Math.round((totalSaved / totalTarget) * 100)) : 0;

  const SAVINGS_PLANS = [
    { name:'Flexi Save',    rate:'8% p.a.',  min:'₦1,000',   lock:'None',      tag:'Popular',  color:'#162353', desc:'Save anytime, withdraw anytime.' },
    { name:'Target Save',   rate:'12% p.a.', min:'₦5,000',   lock:'3 months',  tag:'Best Rate',color:'#0F6CBD', desc:'Lock funds, earn higher returns.' },
    { name:'Fixed Deposit', rate:'15% p.a.', min:'₦50,000',  lock:'6 months',  tag:'Highest',  color:'#6D28D9', desc:'Maximum interest for committed savers.' },
  ];

  return (
    <PageShell title="Savings" back="/">
      <div className="theme-page flex-1 overflow-y-auto pb-8" style={{ scrollbarWidth: 'none' }}>
        <div className="mx-4 mt-5 rounded-[26px] overflow-hidden relative"
          style={{ background: 'linear-gradient(145deg, #0f4f5c 0%, #126b70 58%, #17443f 100%)' }}>
          <div className="absolute -right-12 -top-16 h-52 w-52 rounded-full border border-white/10" />
          <div className="absolute right-6 -top-8 h-36 w-36 rounded-full border border-white/10" />
          <div className="relative z-10 px-5 pt-5 pb-4 sm:px-6">
            <div className="flex justify-between items-start gap-3">
              <div>
                <p className="text-white/65 text-[10px] font-bold uppercase tracking-[0.18em]">Your savings, in focus</p>
                <p className="mt-3 text-white text-[12px] font-medium">Tracked across {goals.length} {goals.length === 1 ? 'goal' : 'goals'}</p>
                <p data-testid="text-total-saved" className="mt-0.5 text-white text-[clamp(1.8rem,8vw,2.35rem)] leading-tight font-bold tracking-tight">
                  ₦{totalSaved.toLocaleString('en-NG')}
                </p>
              </div>
              <div className="shrink-0 w-11 h-11 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center text-white">
                <svg aria-hidden="true" width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 19V5m0 14h16M7 15l4-4 3 2 5-6"/><path d="M16 7h3v3"/>
                </svg>
              </div>
            </div>
            <div className="mt-5">
              <div className="flex items-end justify-between mb-2">
                <div>
                  <p className="text-white/65 text-[10px] font-medium">Combined goal progress</p>
                  <p className="text-white/90 text-[11px] mt-0.5">₦{totalSaved.toLocaleString('en-NG')} <span className="text-white/50">of ₦{totalTarget.toLocaleString('en-NG')}</span></p>
                </div>
                <span data-testid="text-overall-progress" className="text-white text-[15px] font-bold tabular-nums">{overallPct}%</span>
              </div>
              <div className="h-2 bg-white/15 rounded-full overflow-hidden" role="progressbar" aria-label="Combined savings goal progress" aria-valuenow={overallPct} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full bg-[#C5E7D8] rounded-full transition-[width] duration-500" style={{ width: `${overallPct}%` }} />
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-white/15 flex justify-between items-center">
              <span className="text-white/65 text-[10px]">Goal target total</span>
              <span className="text-white text-[12px] font-semibold tabular-nums">₦{totalTarget.toLocaleString('en-NG')}</span>
            </div>
          </div>
        </div>

        <div className="mx-4 mt-5 flex items-end justify-between">
          <div>
            <p className="theme-text-primary text-[19px] font-bold tracking-tight">Build at your pace</p>
            <p className="theme-text-secondary text-[11px] mt-1">A clear view of what you are working toward.</p>
          </div>
          <span className="theme-text-secondary text-[10px] font-semibold tracking-wide uppercase">Local tracker</span>
        </div>

        {notice && (
          <div role="status" data-testid="status-savings-update" className="mx-4 mt-3 px-4 py-3 rounded-2xl border border-[#B9D7CD] bg-[#EAF4EF] text-[#205B4B] text-[12px] font-medium dark:bg-[#18352F] dark:border-[#31594E] dark:text-[#B8E6D4]">
            {notice}
            <button type="button" aria-label="Dismiss message" onClick={() => setNotice('')} className="float-right font-bold ml-3">Dismiss</button>
          </div>
        )}

        <div className="theme-control mx-4 mt-4 rounded-2xl p-1 flex gap-1">
          {(['goals','plans'] as const).map(t => (
            <button key={t} type="button" data-testid={`tab-savings-${t}`} onClick={() => setActiveTab(t)}
              className={`flex-1 py-2.5 rounded-xl text-[12px] font-bold transition-colors ${activeTab===t ? 'theme-control-active shadow-sm' : 'theme-text-secondary'}`}>
              {t === 'goals' ? 'My goals' : 'Savings plans'}
            </button>
          ))}
        </div>

        {activeTab === 'goals' && (
          <div className="px-4 mt-4 space-y-3.5">
            {goals.map(g => {
              const pct = g.target > 0 ? Math.min(100, Math.round((g.saved / g.target) * 100)) : 0;
              const remaining = Math.max(0, g.target - g.saved);
              return (
                <article key={g.id} data-testid={`card-savings-goal-${g.id}`} className="theme-surface theme-border rounded-[22px] overflow-hidden border shadow-sm">
                  <div className="px-4 pt-4 pb-3 flex items-start gap-3">
                    <div className="w-10 h-10 shrink-0 rounded-[14px] flex items-center justify-center text-white text-[12px] font-bold tracking-wide" style={{ backgroundColor: g.color }}>
                      {g.name.trim().slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="theme-text-primary text-[14px] font-bold truncate">{g.name}</p>
                      <p className="theme-text-secondary text-[10px] mt-1">{g.dueDate === 'TBD' ? 'No target date' : `Target ${g.dueDate}`} <span className="mx-1">·</span>{g.frequency} preference</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="theme-text-primary text-[17px] font-bold leading-none tabular-nums">{pct}<span className="text-[11px]">%</span></p>
                      <p className="theme-text-secondary text-[9px] mt-1 uppercase tracking-wide">complete</p>
                    </div>
                  </div>
                  <div className="px-4 pb-4">
                    <div className="theme-control h-2 rounded-full overflow-hidden mb-3">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: g.color }} />
                    </div>
                    <div className="grid grid-cols-3 gap-2 mb-3.5">
                      <div>
                        <p className="theme-text-secondary text-[9px] uppercase tracking-wide">Saved</p>
                        <p className="theme-text-primary text-[12px] font-bold mt-1 tabular-nums">₦{g.saved.toLocaleString('en-NG')}</p>
                      </div>
                      <div className="text-center">
                        <p className="theme-text-secondary text-[9px] uppercase tracking-wide">To go</p>
                        <p className="theme-text-primary text-[12px] font-bold mt-1 tabular-nums">₦{remaining.toLocaleString('en-NG')}</p>
                      </div>
                      <div className="text-right">
                        <p className="theme-text-secondary text-[9px] uppercase tracking-wide">Target</p>
                        <p className="theme-text-primary text-[12px] font-bold mt-1 tabular-nums">₦{g.target.toLocaleString('en-NG')}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2 pt-3 border-t theme-border">
                      <span className="theme-text-secondary text-[10px] font-medium">
                        Schedule preference: <span className="theme-text-primary font-semibold">{g.autoSave ? 'On' : 'Off'}</span>
                      </span>
                      <button type="button" data-testid={`button-top-up-${g.id}`} onClick={() => { setTopUpGoalId(g.id); setTopUpAmt(''); }}
                        className="text-[11px] font-bold px-3.5 py-2 rounded-xl text-white transition-transform active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                        style={{ background: g.color }}>
                        Record top-up
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}

            {showCreate && (
              <div className="theme-surface theme-border rounded-[22px] p-4 sm:p-5 border shadow-sm space-y-4">
                <div>
                  <p className="theme-text-primary text-[15px] font-bold">Create a goal</p>
                  <p className="theme-text-secondary text-[11px] mt-1">Keep a personal record of what you are saving toward.</p>
                </div>
                <label className="block">
                  <span className="theme-text-secondary block text-[10px] font-semibold mb-1.5">Goal name</span>
                  <input type="text" data-testid="input-goal-name" placeholder="For example, a new laptop" value={goalName} onChange={e => setGoalName(e.target.value)}
                    className="theme-field theme-border w-full border rounded-xl px-3.5 py-3 text-[13px] outline-none focus:ring-2 focus:ring-[#0f766e]/30 placeholder:opacity-60" />
                </label>
                <label className="block">
                  <span className="theme-text-secondary block text-[10px] font-semibold mb-1.5">Target amount</span>
                  <div className="theme-field theme-border flex items-center gap-2 border rounded-xl px-3.5 py-3 focus-within:ring-2 focus-within:ring-[#0f766e]/30">
                    <span className="theme-text-secondary text-[14px] font-semibold">₦</span>
                    <input type="text" inputMode="numeric" data-testid="input-goal-target" placeholder="0" value={goalAmt} onChange={e => setGoalAmt(formatAmt(e.target.value))}
                      className="theme-text-primary flex-1 text-[14px] font-semibold outline-none bg-transparent placeholder:opacity-50" />
                  </div>
                </label>
                <div>
                  <p className="theme-text-secondary text-[10px] font-semibold mb-1.5">Saving frequency preference</p>
                  <div className="flex gap-2">
                    {['Daily','Weekly','Monthly'].map(f => (
                      <button key={f} type="button" onClick={() => setFreq(f)}
                        className={`flex-1 py-2.5 rounded-xl text-[11px] font-semibold border transition-colors ${frequency===f ? 'bg-[#F0B90B] text-[#181A20] border-[#F0B90B]' : 'theme-border theme-text-secondary'}`}>
                        {f}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="theme-control rounded-xl px-3.5 py-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="theme-text-primary text-[12px] font-semibold">Schedule reminder preference</p>
                    <p className="theme-text-secondary text-[10px] mt-1">This tracker does not move money automatically.</p>
                  </div>
                  <button type="button" data-testid="toggle-goal-auto-save" role="switch" aria-checked={autoSave} aria-label="Schedule reminder preference"
                    onClick={() => setAutoSave(v=>!v)}
                    className={`w-11 h-6 shrink-0 rounded-full transition-colors relative ${autoSave ? 'bg-[#F0B90B]' : 'bg-[#87939A]'}`}>
                    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${autoSave ? 'left-5' : 'left-0.5'}`} />
                  </button>
                </div>
                <label className="block">
                  <span className="theme-text-secondary block text-[10px] font-semibold mb-1.5">Target date <span className="font-normal">(optional)</span></span>
                  <input type="text" data-testid="input-goal-date" placeholder="For example, Dec 2026" value={dueDate} onChange={e => setDueDate(e.target.value)}
                    className="theme-field theme-border w-full border rounded-xl px-3.5 py-3 text-[13px] outline-none focus:ring-2 focus:ring-[#0f766e]/30 placeholder:opacity-60" />
                </label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => { setShowCreate(false); setGoalName(''); setGoalAmt(''); }}
                    className="theme-border theme-text-secondary flex-1 h-11 rounded-xl border text-[12px] font-semibold">
                    Cancel
                  </button>
                  <button type="button" data-testid="button-create-goal" disabled={!goalName.trim() || !goalAmt}
                    onClick={() => {
                    const num = parseFloat(goalAmt.replace(/,/g,''));
                    if (!goalName.trim() || isNaN(num) || num <= 0) return;
                    setGoals(prev => [...prev, {
                      id: String(Date.now()), name: goalName.trim(), emoji: '',
                      target: num, saved: 0, frequency, dueDate: dueDate || 'TBD',
                      autoSave, color: '#0f4f5c'
                    }]);
                    setShowCreate(false);
                    setNotice(`“${goalName.trim()}” was added to your local savings tracker.`);
                    setGoalName(''); setGoalAmt(''); setDueDate(''); setAutoSave(false); setFreq('Monthly');
                  }} className="flex-1 h-11 rounded-xl bg-[#F0B90B] hover:bg-[#FCD535] disabled:opacity-45 text-[12px] font-bold text-[#181A20]">
                    Create Goal
                  </button>
                </div>
              </div>
            )}

            {!showCreate && (
              <button type="button" data-testid="button-open-create-goal" onClick={() => setShowCreate(true)}
                className="theme-border theme-brand-text w-full min-h-[52px] rounded-2xl border border-dashed text-[12px] font-semibold flex items-center justify-center gap-2 hover:bg-[#EAF4EF] dark:hover:bg-[#18352F]">
                <span aria-hidden="true" className="text-[18px] leading-none">+</span> Create a savings goal
              </button>
            )}
          </div>
        )}

        {activeTab === 'plans' && (
          <div className="px-4 mt-4 space-y-3.5">
            <div className="theme-surface theme-border rounded-2xl border px-4 py-3">
              <p className="theme-text-primary text-[12px] font-semibold">Explore available plan terms</p>
              <p className="theme-text-secondary text-[10px] leading-relaxed mt-1">Plan information is shown for reference. Opening or funding a plan is not available here.</p>
            </div>
            {SAVINGS_PLANS.map(plan => (
              <article key={plan.name} className="theme-surface theme-border rounded-[22px] overflow-hidden border shadow-sm">
                <div className="px-4 pt-4 pb-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-1 h-8 rounded-full" style={{ background: plan.color }} />
                    <p className="theme-text-primary font-bold text-[14px]">{plan.name}</p>
                  </div>
                  <span className="theme-selected-control text-[9px] font-bold px-2.5 py-1 rounded-full">{plan.tag}</span>
                </div>
                <div className="px-4 pb-4">
                  <p className="theme-text-secondary text-[11px] mb-3">{plan.desc}</p>
                  <div className="theme-control rounded-xl grid grid-cols-3 divide-x divide-[#DCE3E5] dark:divide-[#34445D] mb-3.5">
                    <div className="px-2 py-2.5 text-center">
                      <p className="theme-text-secondary text-[9px] font-medium">Rate</p>
                      <p className="theme-brand-text text-[14px] font-bold mt-1">{plan.rate}</p>
                    </div>
                    <div className="px-2 py-2.5 text-center">
                      <p className="theme-text-secondary text-[9px] font-medium">Minimum</p>
                      <p className="theme-text-primary text-[12px] font-bold mt-1">{plan.min}</p>
                    </div>
                    <div className="px-2 py-2.5 text-center">
                      <p className="theme-text-secondary text-[9px] font-medium">Lock period</p>
                      <p className="theme-text-primary text-[12px] font-bold mt-1">{plan.lock}</p>
                    </div>
                  </div>
                  <button type="button" disabled aria-disabled="true" className="theme-control theme-text-secondary w-full h-10 rounded-xl text-[11px] font-semibold cursor-not-allowed">
                    Plan opening unavailable
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {topUpGoalId && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center sm:items-center sm:p-5" role="presentation">
          <button type="button" aria-label="Close top-up form" className="absolute inset-0 bg-[#071923]/55 backdrop-blur-[2px]" onClick={() => setTopUpGoalId(null)} />
          <div role="dialog" aria-modal="true" aria-labelledby="top-up-title" className="theme-surface relative z-10 w-full sm:max-w-[420px] rounded-t-[28px] sm:rounded-[26px] px-5 pt-5 pb-[max(env(safe-area-inset-bottom),24px)] sm:pb-6 shadow-2xl">
            <div className="w-9 h-1 rounded-full bg-[#B9C5C7] mx-auto mb-5 sm:hidden" />
            <div className="flex justify-between items-start gap-3">
              <div>
                <p id="top-up-title" className="theme-text-primary text-[17px] font-bold">Record a top-up</p>
                <p className="theme-text-secondary text-[11px] mt-1">{goals.find(g=>g.id===topUpGoalId)?.name}</p>
              </div>
              <button type="button" aria-label="Close" onClick={() => setTopUpGoalId(null)} className="theme-control theme-text-secondary w-8 h-8 rounded-full text-[18px] leading-none">×</button>
            </div>
            <p className="theme-text-secondary text-[10px] leading-relaxed mt-4 mb-3">This updates your local goal tracker only. It will not debit a wallet or move money.</p>
            <div className="theme-field theme-border flex items-center gap-2 border rounded-xl px-4 py-3 focus-within:ring-2 focus-within:ring-[#0f766e]/30 mb-3">
              <span className="theme-text-secondary text-[20px] font-semibold">₦</span>
              <input type="text" inputMode="numeric" data-testid="input-top-up-amount" aria-label="Top-up amount" placeholder="0" value={topUpAmt}
                onChange={e => setTopUpAmt(formatAmt(e.target.value))}
                autoFocus
                className="theme-text-primary flex-1 text-[22px] font-bold outline-none bg-transparent placeholder:opacity-50 placeholder:font-normal" />
            </div>
            <div className="flex gap-2 mb-5">
              {[1000,2000,5000,10000].map(v => (
                <button key={v} type="button" onClick={() => setTopUpAmt(v.toLocaleString('en-NG'))}
                  className="theme-control theme-border theme-text-secondary flex-1 py-2.5 border rounded-xl text-[10px] font-semibold">
                  ₦{v>=1000?(v/1000)+'k':v}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setTopUpGoalId(null)}
                className="theme-border theme-text-secondary flex-1 h-12 rounded-xl border text-[12px] font-semibold">Cancel</button>
              <button type="button" data-testid="button-confirm-top-up" disabled={!topUpAmt}
                onClick={() => {
                const num = parseFloat(topUpAmt.replace(/,/g,''));
                if (!num || num <= 0) return;
                setGoals(prev => prev.map(g => g.id === topUpGoalId ? { ...g, saved: g.saved + num } : g));
                setTopUpGoalId(null);
                setNotice(`₦${num.toLocaleString('en-NG')} recorded in your local savings tracker.`);
                setTopUpAmt('');
              }} className="flex-1 h-12 rounded-xl bg-[#F0B90B] hover:bg-[#FCD535] disabled:opacity-45 text-[12px] font-bold text-[#181A20]">
                Update tracker
              </button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}

function InvestmentsPage() {
  return (
    <PageShell title="Investments" back="/">
      <main className="flex-1 overflow-y-auto px-4 py-5 sm:px-6" style={{ scrollbarWidth: 'none' }}>
        <div className="mx-auto max-w-xl space-y-4">
          <section className="theme-surface theme-border relative overflow-hidden rounded-[26px] border p-5 sm:p-7">
            <div className="absolute -right-8 -top-10 h-36 w-36 rounded-full bg-[#E3F2EE] dark:bg-[#183A39]" aria-hidden="true" />
            <div className="relative">
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EAF4EF] text-[#175B52] dark:bg-[#18352F] dark:text-[#B8E6D4]">
                <TrendingUp className="h-6 w-6" strokeWidth={1.8} />
              </div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] theme-brand-text">A considered next step</p>
              <h1 className="theme-text-primary max-w-sm text-[25px] font-extrabold leading-tight tracking-[-0.03em] sm:text-[30px]">
                Investments are not available on Vexa yet.
              </h1>
              <p className="theme-text-secondary mt-3 max-w-md text-[13px] leading-6">
                We are preparing this service carefully. Vexa will only offer investment products after a licensed provider and approved product terms are in place.
              </p>
              <div role="status" data-testid="status-investments-unavailable" className="mt-5 flex items-start gap-3 rounded-2xl border border-[#D6E8E1] bg-[#F1F8F5] px-4 py-3.5 dark:border-[#31594E] dark:bg-[#18352F]">
                <Shield className="mt-0.5 h-4 w-4 shrink-0 text-[#236B58] dark:text-[#B8E6D4]" strokeWidth={2} />
                <p className="text-[12px] font-semibold leading-5 text-[#245B4E] dark:text-[#B8E6D4]">
                  Transactions cannot be made until a licensed provider and approved terms are configured.
                </p>
              </div>
            </div>
          </section>

          <section className="theme-surface theme-border rounded-[22px] border p-5 sm:p-6" aria-labelledby="investment-readiness-title">
            <div className="flex items-start gap-3">
              <div className="theme-control flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
                <BriefcaseBusiness className="theme-icon h-5 w-5" strokeWidth={1.8} />
              </div>
              <div>
                <h2 id="investment-readiness-title" className="theme-text-primary text-[14px] font-bold">What needs to be in place</h2>
                <p className="theme-text-secondary mt-1 text-[12px] leading-5">
                  Before any product can be offered, Vexa must confirm who provides and safeguards it, and make the approved terms clear to you.
                </p>
              </div>
            </div>
            <div className="theme-border mt-4 border-t pt-4">
              <div className="flex items-start gap-3">
                <Info className="theme-brand-text mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
                <p className="theme-text-secondary text-[12px] leading-5">
                  This page is for information only. It does not represent an offer, account, investment balance, or promise of future availability.
                </p>
              </div>
            </div>
          </section>
        </div>
      </main>
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
          className={`w-full h-[50px] rounded-xl text-[14px] font-bold transition-all shadow-sm ${canProceed ? 'bg-[#F0B90B] hover:bg-[#FCD535] active:bg-[#DDAA09] text-[#181A20]' : 'bg-[#F0B90B]/40 text-[#181A20]/50'}`}>
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
  const { user } = useAuth();
  const [period, setPeriod]   = useState('Last 30 days');
  const [format, setFormat]   = useState('PDF');
  const [email, setEmail]     = useState('');
  const [generating, setGen]  = useState(false);
  const [done, setDone]       = useState(false);

  useEffect(() => {
    if (user?.email) setEmail(user.email);
  }, [user?.email]);

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
                className={`flex-1 py-3 rounded-xl text-[13px] font-semibold border-2 transition-all ${format===f ? 'bg-[#F0B90B] text-[#181A20] border-[#F0B90B]' : 'border-[#E0E0E0] text-[#444]'}`}>
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
          className="w-full h-[50px] rounded-xl text-[14px] font-bold text-[#181A20] bg-[#F0B90B] hover:bg-[#FCD535] active:bg-[#DDAA09] shadow-sm disabled:opacity-45 transition-all">
          {generating ? 'Generating…' : 'Generate Statement'}
        </button>
      </div>
    </PageShell>
  );
}

/* ─── Personal Budget Page ───────────────────────────────────────────── */
type BudgetCategory = {
  id: string;
  label: string;
  limit: number;
  color: string;
  icon: React.ReactNode;
};

const DEFAULT_BUDGET_CATEGORIES: BudgetCategory[] = [
  { id: 'transfer', label: 'Transfers', limit: 100000, color: '#2563EB', icon: <ArrowLeftRight className="w-4 h-4" /> },
  { id: 'bills', label: 'Bills & utilities', limit: 60000, color: '#7C3AED', icon: <FileText className="w-4 h-4" /> },
  { id: 'food', label: 'Food & groceries', limit: 80000, color: '#EA580C', icon: <WalletCards className="w-4 h-4" /> },
  { id: 'airtime', label: 'Airtime & data', limit: 30000, color: '#0891B2', icon: <Phone className="w-4 h-4" /> },
  { id: 'other', label: 'Other spending', limit: 50000, color: '#64748B', icon: <MoreHorizontalIcon /> },
];

function MoreHorizontalIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
      <circle cx="5" cy="12" r="1" fill="currentColor" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
      <circle cx="19" cy="12" r="1" fill="currentColor" />
    </svg>
  );
}

function budgetCategoryFor(transaction: AppTransaction): string {
  const text = `${transaction.name} ${transaction.note}`.toLowerCase();
  if (/airtime|data|mobile|internet|phone/.test(text)) return 'airtime';
  if (/food|grocery|groceries|restaurant|market|supermarket|eat|kfc|shoprite/.test(text)) return 'food';
  if (/bill|electric|power|water|rent|utility|subscription|netflix/.test(text)) return 'bills';
  if (transaction.recipient_bank || /transfer|sent|send/.test(text)) return 'transfer';
  return 'other';
}

function formatBudgetAmount(amount: number): string {
  return amount.toLocaleString('en-NG', { maximumFractionDigits: 0 });
}

function BudgetPage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { transactions, transactionsLoading } = useUserData();
  const storageKey = `vexa_budget_categories_${user?.id ?? 'guest'}`;
  const [categories, setCategories] = useState<BudgetCategory[]>(DEFAULT_BUDGET_CATEGORIES);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newLimit, setNewLimit] = useState('');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const limits = JSON.parse(saved) as Record<string, number>;
        setCategories(prev => prev.map(category => ({
          ...category,
          limit: typeof limits[category.id] === 'number' ? limits[category.id] : category.limit,
        })));
      }
    } catch {
      // Keep the defaults if local storage is unavailable or malformed.
    }
  }, [storageKey]);

  function persist(next: BudgetCategory[]) {
    setCategories(next);
    localStorage.setItem(storageKey, JSON.stringify(
      Object.fromEntries(next.map(category => [category.id, category.limit])),
    ));
  }

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthTransactions = transactions.filter(transaction => {
    if (transaction.type !== 'out') return false;
    if (!transaction.createdAt) return true;
    return new Date(transaction.createdAt) >= monthStart;
  });
  const spendingByCategory = categories.reduce<Record<string, number>>((totals, category) => {
    totals[category.id] = monthTransactions
      .filter(transaction => budgetCategoryFor(transaction) === category.id)
      .reduce((sum, transaction) => sum + transaction.raw_amount, 0);
    return totals;
  }, {});
  const totalSpent = Object.values(spendingByCategory).reduce((sum, amount) => sum + amount, 0);
  const totalLimit = categories.reduce((sum, category) => sum + category.limit, 0);
  const remaining = Math.max(0, totalLimit - totalSpent);
  const overallPercent = totalLimit ? Math.min(100, (totalSpent / totalLimit) * 100) : 0;
  const monthLabel = new Intl.DateTimeFormat('en-NG', { month: 'long', year: 'numeric' }).format(new Date());

  function startEdit(category: BudgetCategory) {
    setEditingId(category.id);
    setEditValue(String(category.limit));
  }

  function saveEdit(categoryId: string) {
    const limit = Number(editValue.replace(/\D/g, ''));
    if (!Number.isFinite(limit) || limit <= 0) return;
    persist(categories.map(category => category.id === categoryId ? { ...category, limit } : category));
    setEditingId(null);
  }

  function addCategory() {
    const label = newName.trim();
    const limit = Number(newLimit.replace(/\D/g, ''));
    if (!label || !Number.isFinite(limit) || limit <= 0) return;
    const id = `${label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${Date.now()}`;
    persist([...categories, { id, label, limit, color: '#16A34A', icon: <WalletCards className="w-4 h-4" /> }]);
    setNewName('');
    setNewLimit('');
    setShowAdd(false);
  }

  function removeCategory(categoryId: string) {
    persist(categories.filter(category => category.id !== categoryId));
    if (editingId === categoryId) setEditingId(null);
  }

  return (
    <PageShell title="Personal Budget" back="/">
      <div className="flex-1 overflow-y-auto px-4 py-4 pb-8" style={{ scrollbarWidth: 'none' }}>
        <div className="rounded-3xl p-5 text-white mb-4 overflow-hidden relative"
          style={{ background: 'linear-gradient(135deg, #22262F 0%, #181A20 58%, #0B0E11 100%)' }}>
          <div className="absolute -right-10 -top-12 w-36 h-36 rounded-full border-[20px] border-white/10" />
          <div className="relative">
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-white/60 text-[11px] font-medium">{monthLabel}</p>
                <p className="text-white text-[18px] font-extrabold mt-0.5">Your spending plan</p>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center">
                <WalletCards className="w-5 h-5" />
              </div>
            </div>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-white/60 text-[11px]">Spent this month</p>
                <p className="text-[28px] font-extrabold tracking-tight mt-0.5">₦{formatBudgetAmount(totalSpent)}</p>
              </div>
              <div className="text-right">
                <p className="text-white/60 text-[11px]">Remaining</p>
                <p className="text-[16px] font-bold mt-1">₦{formatBudgetAmount(remaining)}</p>
              </div>
            </div>
            <div className="mt-5 h-2 bg-white/20 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${overallPercent >= 90 ? 'bg-red-400' : 'bg-[#F0B90B]'}`}
                style={{ width: `${overallPercent}%` }} />
            </div>
            <p className="text-white/60 text-[10px] mt-2">
              ₦{formatBudgetAmount(totalSpent)} of ₦{formatBudgetAmount(totalLimit)} planned
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2.5 mb-5">
          {[
            { label: 'Categories', value: String(categories.length) },
            { label: 'Daily average', value: `₦${formatBudgetAmount(totalSpent / Math.max(1, new Date().getDate()))}` },
            { label: 'On track', value: `${categories.filter(category => (spendingByCategory[category.id] ?? 0) <= category.limit).length}/${categories.length}` },
          ].map(stat => (
            <div key={stat.label} className="bg-white rounded-2xl border border-[#F0F0F0] px-2 py-3 text-center">
              <p className="text-[15px] font-extrabold text-[#162353]">{stat.value}</p>
              <p className="text-[10px] text-[#888] mt-1">{stat.label}</p>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between mb-2.5">
          <div>
            <p className="text-[14px] font-bold text-[#111]">Category limits</p>
            <p className="text-[11px] text-[#888] mt-0.5">Tap a limit to adjust your plan</p>
          </div>
          <button onClick={() => setShowAdd(value => !value)}
            className="flex items-center gap-1 text-[11px] font-bold text-[#2563EB]">
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
        </div>

        {showAdd && (
          <div className="bg-white rounded-2xl border border-[#C7D7FF] p-4 mb-3">
            <div className="flex gap-2">
              <input value={newName} onChange={event => setNewName(event.target.value)}
                placeholder="Category name" className="flex-1 min-w-0 h-11 rounded-xl bg-[#F8F9FB] border border-[#E2E8F0] px-3 text-[13px] outline-none focus:border-[#2563EB]" />
              <input value={newLimit} onChange={event => setNewLimit(event.target.value.replace(/\D/g, ''))}
                inputMode="numeric" placeholder="Limit" className="w-24 h-11 rounded-xl bg-[#F8F9FB] border border-[#E2E8F0] px-3 text-[13px] outline-none focus:border-[#2563EB]" />
            </div>
            <div className="flex justify-end gap-2 mt-3">
              <button onClick={() => setShowAdd(false)} className="px-3 py-2 text-[12px] font-semibold text-[#888]">Cancel</button>
              <button onClick={addCategory} className="px-4 py-2 rounded-xl bg-[#F0B90B] hover:bg-[#FCD535] text-[#181A20] text-[12px] font-bold shadow-xs">Add category</button>
            </div>
          </div>
        )}

        <div className="space-y-2.5">
          {categories.map(category => {
            const spent = spendingByCategory[category.id] ?? 0;
            const percent = category.limit ? Math.min(100, (spent / category.limit) * 100) : 0;
            const over = spent > category.limit;
            return (
              <div key={category.id} className="bg-white rounded-2xl border border-[#F0F0F0] p-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ color: category.color, background: `${category.color}14` }}>
                    {category.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-[#111] truncate">{category.label}</p>
                    <p className={`text-[11px] mt-0.5 ${over ? 'text-red-600 font-semibold' : 'text-[#888]'}`}>
                      ₦{formatBudgetAmount(spent)} spent of ₦{formatBudgetAmount(category.limit)}
                    </p>
                  </div>
                  {editingId === category.id ? (
                    <div className="flex items-center gap-1">
                      <input value={editValue} onChange={event => setEditValue(event.target.value.replace(/\D/g, ''))}
                        autoFocus inputMode="numeric" className="w-20 h-8 rounded-lg border border-[#C7D7FF] px-2 text-[12px] outline-none" />
                      <button onClick={() => saveEdit(category.id)} className="w-8 h-8 rounded-lg bg-[#DCFCE7] text-[#15803D] flex items-center justify-center">
                        <Check className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => startEdit(category)} className="text-[11px] font-bold text-[#2563EB]">Edit</button>
                  )}
                </div>
                <div className="mt-3 h-2 bg-[#EEF1F5] rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all"
                    style={{ width: `${percent}%`, background: over ? '#EF4444' : category.color }} />
                </div>
                <div className="flex items-center justify-between mt-2">
                  <p className={`text-[10px] font-semibold ${over ? 'text-red-600' : 'text-[#888]'}`}>
                    {over ? `₦${formatBudgetAmount(spent - category.limit)} over limit` : `${Math.max(0, Math.round(percent))}% used`}
                  </p>
                  {categories.length > 1 && (
                    <button onClick={() => removeCategory(category.id)} aria-label={`Remove ${category.label} budget`}
                      className="text-[#B5BBC8] hover:text-red-500">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {transactionsLoading && (
          <p className="text-center text-[11px] text-[#888] mt-4">Updating your spending…</p>
        )}
        {!transactionsLoading && transactions.length === 0 && (
          <div className="mt-4 rounded-2xl bg-[#EEF2FF] border border-[#DCE5FF] px-4 py-3">
            <p className="text-[12px] font-bold text-[#162353]">Your plan is ready</p>
            <p className="text-[11px] text-[#555] mt-1">Your category progress will update automatically as you make transactions.</p>
          </div>
        )}
      </div>
    </PageShell>
  );
}

/* ─── More Services Page ─────────────────────────────────────────────── */
const MORE_SERVICES = [
  { label:'Transfer',  emoji:'↔️',  path:'/transfer'  },
  { label:'Airtime',   emoji:'📱',  path:'/airtime'   },
  { label:'Data',      emoji:'📶',  path:'/data'      },
  { label:'Betting',   Icon: BettingBasketballIcon, path:'/betting' },
  { label:'Savings',   emoji:'🐷',  path:'/savings'   },
  { label:'Investments', Icon: TrendingUp, path:'/investments' },
  { label:'Budget',    emoji:'📊',  path:'/budget'    },
  { label:'Education', emoji:'📚',  path:'/education' },
  { label:'Statement', emoji:'📄',  path:'/statement' },
  { label:'Deposit',   emoji:'💰',  path:'/deposit'   },
  { label:'History',   emoji:'🕐',  path:'/history'   },
  { label:'Settings',  emoji:'⚙️',  path:'/settings'  },
  { label:'Card',      emoji:'💳',  path:'/card'      },
  { label:'Crypto',    emoji:'₿',   path:'/crypto'    },
];

function MorePage() {
  const [, navigate] = useLocation();
  return (
    <PageShell title="All Services" back="/">
      <div className="flex-1 overflow-y-auto px-4 py-5" style={{ scrollbarWidth: 'none' }}>
        <div className="grid grid-cols-4 gap-3">
          {MORE_SERVICES.map(s => (
            <button key={s.label} data-testid={`button-more-service-${s.label.toLowerCase()}`} onClick={() => navigate(s.path)}
              className="bg-white rounded-xl py-4 px-1 flex flex-col items-center justify-center gap-2 border border-[#F0F0F0] active:bg-[#F2F3F5]">
              {'Icon' in s && s.Icon
                ? <s.Icon className="theme-brand-text h-[26px] w-[26px]" strokeWidth={1.8} />
                : <span className="text-[26px] leading-none">{'emoji' in s ? s.emoji : ''}</span>}
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
  const { balance, balanceLoading, lastBalanceUpdatedAt } = useUserData();
  const [showWhy, setShowWhy] = useState(false);

  const initials = user?.name
    ?.split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('') || 'VX';
  const balanceLabel = user
    ? Number(balance).toLocaleString('en-NG', { style: 'currency', currency: 'NGN' })
    : 'Sign in to view';
  const lastUpdatedLabel = !user
    ? 'Sign in to sync your wallet balance'
    : lastBalanceUpdatedAt
    ? `Last updated ${new Date(lastBalanceUpdatedAt).toLocaleTimeString('en-NG', { hour: 'numeric', minute: '2-digit' })}`
    : balanceLoading
      ? 'Updating your wallet balance…'
      : 'Your wallet balance updates automatically';

  return (
    <div className="fixed inset-0 theme-page flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>
      <header className="flex-none flex items-center justify-between px-4 pb-3 theme-surface border-b theme-border"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}>
        <button
          type="button"
          data-testid="button-card-back"
          aria-label="Back to home"
          onClick={() => navigate('/')}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100"
        >
          <ChevronRight className="w-5 h-5 rotate-180 theme-icon" />
        </button>
        <div className="text-center">
          <p className="text-[15px] font-bold theme-text-primary">Vexa Card</p>
          <p className="text-[10px] theme-text-secondary">Account view</p>
        </div>
        <div className="w-9 h-9 rounded-full theme-control flex items-center justify-center text-[11px] font-bold theme-brand-text" aria-label={`Signed-in user ${initials}`}>
          {initials}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        <div className="mx-auto w-full max-w-[460px] px-4 pb-8">
          <section className="pt-6">
            <div className="inline-flex items-center gap-2 rounded-full theme-control px-3 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              <span className="text-[9px] font-semibold uppercase tracking-[0.14em] theme-text-secondary">
                Card services not connected
              </span>
            </div>
            <h1 className="mt-4 max-w-[340px] text-[28px] leading-[1.12] font-bold tracking-[-0.04em] theme-text-primary">
              Your Vexa card isn’t available yet.
            </h1>
            <p className="mt-2 max-w-[360px] text-[13px] leading-6 theme-text-secondary">
              No card issuer is connected, so Vexa hasn’t issued a card. Your wallet balance below is real and updates automatically.
            </p>
          </section>

          <section className="mt-5" aria-label="Card preview">
            <div
              data-testid="status-card-not-issued"
              className="relative min-h-[194px] overflow-hidden rounded-[24px] p-5 text-white shadow-[0_16px_36px_rgba(0,0,0,0.28)]"
              style={{ background: 'linear-gradient(135deg, #22262F 0%, #181A20 56%, #0B0E11 100%)' }}
            >
              <div className="absolute -right-10 -top-14 h-48 w-48 rounded-full border border-white/10" />
              <div className="absolute -right-2 -top-7 h-32 w-32 rounded-full border border-white/10" />
              <div className="relative flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/65">Vexa</p>
                  <p className="mt-1 text-[12px] font-medium text-white/85">Card preview</p>
                </div>
                <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.12em]">
                  Not issued
                </span>
              </div>
              <div className="relative mt-10 flex items-end justify-between gap-3">
                <div>
                  <p className="font-mono text-[15px] tracking-[0.12em] text-white/80">No card details yet</p>
                  <p className="mt-2 text-[10px] font-medium uppercase tracking-[0.14em] text-white/55">
                    Preview only · no active card
                  </p>
                </div>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/10">
                  <Lock className="h-4 w-4 text-white/80" />
                </div>
              </div>
            </div>
            <p className="mt-2 px-1 text-[10px] theme-text-secondary">
              This illustration is not an active payment card.
            </p>
          </section>

          <section className="mt-5 rounded-[22px] theme-surface theme-border border p-4 shadow-sm" aria-label="Live wallet balance">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] theme-text-secondary">Available wallet balance</p>
                <p className="mt-2 text-[24px] leading-none font-extrabold tracking-[-0.04em] theme-text-primary" aria-live="polite" data-testid="text-card-wallet-balance">
                  {balanceLabel}
                </p>
              </div>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full theme-control theme-brand-text">
                <WalletCards className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className={`h-1.5 w-1.5 rounded-full ${balanceLoading ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
              <p className="text-[11px] theme-text-secondary" data-testid="text-card-balance-updated">{lastUpdatedLabel}</p>
            </div>
          </section>

          <section className="mt-4 rounded-[22px] theme-surface theme-border border p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full theme-control theme-brand-text">
                <Shield className="h-[18px] w-[18px]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[13px] font-semibold theme-text-primary">Issuer connection</p>
                  <span className="shrink-0 rounded-full bg-amber-50 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-amber-700">
                    Not connected
                  </span>
                </div>
                <p className="mt-1.5 text-[11px] leading-[1.55] theme-text-secondary">
                  Card details and controls will only appear after Vexa connects a card issuer.
                </p>
              </div>
            </div>
            <div className="my-4 h-px bg-[var(--theme-border)]" />
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full theme-control theme-icon">
                <Info className="h-[17px] w-[17px]" />
              </div>
              <div className="flex-1">
                <p className="text-[12px] font-semibold theme-text-primary">Card activity unavailable</p>
                <p className="mt-0.5 text-[11px] theme-text-secondary">
                  There is no card transaction feed to update yet.
                </p>
              </div>
            </div>
          </section>

          <section className="mt-6">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-[0.18em] theme-text-secondary">What happens next</p>
                <h2 className="mt-1.5 text-[23px] leading-tight font-bold tracking-[-0.03em] theme-text-primary">Clear steps to card access</h2>
              </div>
              <Clock className="mb-1 h-4 w-4 theme-icon" />
            </div>
            <div className="mt-4 space-y-4">
              {[
                { number: '01', title: 'Connect a card issuer', copy: 'Vexa needs a supported card provider first.' },
                { number: '02', title: 'Issue your card', copy: 'Card details appear only after a real card is issued.' },
                { number: '03', title: 'Use live card controls', copy: 'Transactions and card settings require issuer data.' },
              ].map((step, index, allSteps) => (
                <div key={step.number} className="relative flex gap-3.5">
                  {index < allSteps.length - 1 && <span className="absolute left-[15px] top-[32px] h-[calc(100%+4px)] w-px bg-[var(--theme-border)]" />}
                  <div className="relative z-10 flex h-[31px] w-[31px] shrink-0 items-center justify-center rounded-full theme-control font-mono text-[9px] theme-text-secondary">
                    {step.number}
                  </div>
                  <div className="pt-0.5">
                    <p className="text-[12px] font-semibold theme-text-primary">{step.title}</p>
                    <p className="mt-1 text-[11px] leading-[1.45] theme-text-secondary">{step.copy}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-6 rounded-[18px] theme-surface theme-border border">
            <button
              type="button"
              data-testid="button-card-help"
              onClick={() => setShowWhy(value => !value)}
              aria-expanded={showWhy}
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
            >
              <HelpCircle className="h-[17px] w-[17px] shrink-0 theme-icon" />
              <span className="flex-1 text-[12px] font-medium theme-text-primary">Why can’t I use a card yet?</span>
              <ChevronDown className={`h-4 w-4 theme-icon transition-transform ${showWhy ? 'rotate-180' : ''}`} />
            </button>
            {showWhy && (
              <div className="border-t theme-border px-4 pb-4 pt-3">
                <p className="text-[11px] leading-[1.65] theme-text-secondary">
                  Vexa has not connected a card issuer, so no card has been issued in this app. Until a provider is selected and connected, card credentials, purchases, limits, and freeze controls cannot be shown or changed.
                </p>
              </div>
            )}
          </section>
          <p className="pt-5 text-center text-[10px] theme-text-secondary">
            Your wallet balance is separate from card availability.
          </p>
        </div>
      </main>
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
    { label:'Betting',   Icon: BettingBasketballIcon, path:'/betting' },
  ]},
  { heading:'Lifestyle', items:[
    { label:'Education', emoji:'📚',  path:'/education' },
    { label:'Savings',   emoji:'🐷',  path:'/savings'   },
    { label:'Investments', Icon: TrendingUp, path:'/investments' },
    { label:'Budget',    emoji:'📊',  path:'/budget'    },
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
                <button key={s.label} data-testid={`button-services-${s.label.toLowerCase()}`} onClick={() => navigate(s.path)}
                  className="bg-white rounded-xl py-4 flex flex-col items-center gap-2 border border-[#F0F0F0] active:bg-[#F2F3F5]">
                  {'Icon' in s && s.Icon
                    ? <s.Icon className="theme-brand-text h-6 w-6" strokeWidth={1.8} />
                    : <span className="text-[24px] leading-none">{'emoji' in s ? s.emoji : ''}</span>}
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
function useCashbackCounter(targetValue: number, durationMs = 850) {
  const safeTarget = Number.isFinite(targetValue) ? Math.max(0, targetValue) : 0;
  const [displayValue, setDisplayValue] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const currentRef = useRef(0);

  useEffect(() => {
    const start = currentRef.current;
    if (Math.abs(safeTarget - start) < 0.005) {
      currentRef.current = safeTarget;
      setDisplayValue(safeTarget);
      setIsAnimating(false);
      return;
    }

    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      currentRef.current = safeTarget;
      setDisplayValue(safeTarget);
      setIsAnimating(false);
      return;
    }

    let frameId = 0;
    let startTime: number | null = null;
    setIsAnimating(true);

    const step = (timestamp: number) => {
      startTime ??= timestamp;
      const progress = Math.min((timestamp - startTime) / durationMs, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = start + (safeTarget - start) * eased;
      currentRef.current = next;
      setDisplayValue(next);

      if (progress < 1) {
        frameId = window.requestAnimationFrame(step);
      } else {
        currentRef.current = safeTarget;
        setDisplayValue(safeTarget);
        setIsAnimating(false);
      }
    };

    frameId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(frameId);
  }, [safeTarget, durationMs]);

  return { displayValue, isAnimating };
}

function formatCashbackNaira(value: number) {
  const safe = Number.isFinite(value) ? Math.max(0, value) : 0;
  return safe.toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function CashbackPage() {
  const [, navigate] = useLocation();
  const [redemptionPhase, setRedemptionPhase] = useState<'idle' | 'redeeming' | 'animating' | 'complete'>('idle');
  const [redeemedAmount, setRedeemedAmount] = useState(0);
  const [balancePulse, setBalancePulse] = useState(false);
  const {
    cashbackTotal: totalEarned,
    cashbackPending: pending,
    cashbackRedeemable: redeemable,
    cashbackHistory: history,
    redeemCashback,
  } = useUserData();

  const { displayValue: animatedTotal, isAnimating: isTotalAnimating } = useCashbackCounter(totalEarned, 900);
  const { displayValue: animatedRedeemable, isAnimating: isRedeemableAnimating } = useCashbackCounter(redeemable, 900);
  const { displayValue: animatedPending } = useCashbackCounter(pending, 900);
  const { displayValue: animatedCredited } = useCashbackCounter(
    redemptionPhase === 'complete' ? redeemedAmount : 0,
    900,
  );

  const prevValuesRef = useRef<{ total: number; redeemable: number; pending: number } | null>(null);
  useEffect(() => {
    const prev = prevValuesRef.current;
    prevValuesRef.current = { total: totalEarned, redeemable, pending };
    if (!prev) return;
    if (prev.total !== totalEarned || prev.redeemable !== redeemable || prev.pending !== pending) {
      setBalancePulse(true);
      const timer = window.setTimeout(() => setBalancePulse(false), 750);
      return () => window.clearTimeout(timer);
    }
  }, [totalEarned, redeemable, pending]);

  useEffect(() => {
    if (redemptionPhase !== 'animating') return;
    if (isTotalAnimating || isRedeemableAnimating) return;

    const timer = window.setTimeout(() => {
      setRedemptionPhase('complete');
    }, 320);
    return () => window.clearTimeout(timer);
  }, [redemptionPhase, isTotalAnimating, isRedeemableAnimating]);

  const rates = [
    { label: 'Transfers',  rate: '2%', icon: '↗' },
    { label: 'Airtime',    rate: '5%', icon: '📶' },
    { label: 'Data',       rate: '5%', icon: '🌐' },
    { label: 'Education',  rate: '3%', icon: '🎓' },
    { label: 'Betting',    rate: '1%', icon: '🎲' },
    { label: 'Savings',    rate: '4%', icon: '🏦' },
  ];

  async function handleRedeem() {
    if (redeemable <= 0 || redemptionPhase !== 'idle') return;
    const snapshot = redeemable;
    setRedeemedAmount(snapshot);
    setRedemptionPhase('redeeming');
    await redeemCashback();
    setRedemptionPhase('animating');
  }

  if (redemptionPhase === 'complete') {
    return (
      <div className="theme-page fixed inset-0 bg-white flex flex-col items-center justify-center px-6" style={{ fontFamily: "'Inter', sans-serif" }}>
        <div className="w-20 h-20 rounded-full bg-yellow-50 dark:bg-yellow-500/15 flex items-center justify-center mb-5 text-[36px] animate-bounce">
          🪙
        </div>
        <p className="theme-text-primary text-[20px] font-bold text-[#111] mb-1">Cashback Redeemed!</p>
        <p className="text-[28px] font-extrabold text-[#16A34A] dark:text-emerald-400 tabular-nums mb-1">
          +₦{formatCashbackNaira(animatedCredited)}
        </p>
        <p className="theme-text-secondary text-[13px] text-[#888] text-center mb-8">
          Added directly to your Vexa wallet balance.
        </p>
        <div className="w-full max-w-xs space-y-2.5">
          <button
            onClick={() => navigate('/')}
            className="w-full bg-[#F0B90B] hover:bg-[#FCD535] active:bg-[#DDAA09] rounded-xl h-[50px] text-[14px] font-bold text-[#181A20] shadow-sm transition-all"
          >
            Back to Home
          </button>
          <button
            onClick={() => setRedemptionPhase('idle')}
            className="theme-surface theme-border theme-text-primary w-full border rounded-xl h-[46px] text-[13px] font-semibold transition-all"
          >
            View Cashback Balance
          </button>
        </div>
      </div>
    );
  }

  const isBusy = redemptionPhase === 'redeeming' || redemptionPhase === 'animating';

  return (
    <div className="theme-page fixed inset-0 bg-[#F2F3F5] flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div className="theme-surface theme-border flex-none flex items-center gap-3 px-4 pb-3 bg-white border-b border-[#E8EBF0]"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}>
        <button onClick={() => navigate('/')} className="theme-text-primary w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <span className="theme-text-primary text-[16px] font-bold text-[#111]">Cashback</span>
      </div>

      <div className="flex-1 overflow-y-auto py-4 px-4 space-y-4" style={{ scrollbarWidth: 'none' }}>

        {/* Hero balance card */}
        <div className="bg-[#162353] rounded-2xl px-5 py-5 relative overflow-hidden">
          <div className="absolute -top-4 -right-4 w-24 h-24 rounded-full opacity-10 bg-white" />
          <div className="absolute bottom-[-20px] right-[40px] w-16 h-16 rounded-full opacity-5 bg-white" />
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full bg-yellow-400/20 flex items-center justify-center transition-transform duration-300 ${isBusy || balancePulse ? 'scale-110' : ''}`}>
                <span className={`text-[14px] ${isBusy ? 'animate-spin' : ''}`}>🪙</span>
              </div>
              <span className="text-white/70 text-[12px] font-medium">Total Earned</span>
            </div>
            {(isTotalAnimating || isRedeemableAnimating || isBusy) && (
              <span className="text-[11px] font-semibold text-yellow-300 animate-pulse">
                {redemptionPhase === 'redeeming' ? 'Redeeming…' : redemptionPhase === 'animating' ? 'Crediting wallet…' : 'Updating…'}
              </span>
            )}
          </div>
          <p
            className={`text-[30px] font-extrabold tabular-nums mb-1 transition-all duration-300 ${
              balancePulse || isBusy ? 'scale-[1.03] origin-left text-yellow-300' : 'text-white'
            }`}
          >
            ₦{formatCashbackNaira(animatedTotal)}
          </p>
          <div className="flex gap-4 mt-3">
            <div className="bg-white/10 rounded-xl px-4 py-2.5 flex-1">
              <p className="text-[10px] text-white/60 mb-0.5">Redeemable</p>
              <p
                className={`text-[15px] font-bold tabular-nums transition-colors duration-300 ${
                  balancePulse || isBusy ? 'text-emerald-300' : 'text-white'
                }`}
              >
                ₦{formatCashbackNaira(animatedRedeemable)}
              </p>
            </div>
            <div className="bg-white/10 rounded-xl px-4 py-2.5 flex-1">
              <p className="text-[10px] text-white/60 mb-0.5">Pending</p>
              <p className="text-[15px] font-bold text-yellow-300 tabular-nums">
                ₦{formatCashbackNaira(animatedPending)}
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={redeemable <= 0 || isBusy}
            onClick={handleRedeem}
            className={`mt-4 w-full rounded-xl h-[42px] text-[13px] font-bold transition-all flex items-center justify-center gap-2 ${
              redeemable <= 0 || isBusy
                ? 'bg-yellow-400/50 text-[#111]/60 cursor-not-allowed'
                : 'bg-yellow-400 text-[#111] active:bg-yellow-300 hover:bg-yellow-300 cursor-pointer'
            }`}
          >
            <Gift className="w-4 h-4" />
            {redemptionPhase === 'redeeming'
              ? 'Redeeming to Wallet…'
              : redemptionPhase === 'animating'
                ? 'Completing Redemption…'
                : `Redeem ₦${formatCashbackNaira(animatedRedeemable)} to Wallet`}
          </button>
        </div>

        {/* Cashback rates */}
        <div>
          <p className="theme-text-secondary text-[11px] font-semibold text-[#888] uppercase tracking-wide mb-2 px-1">Cashback Rates</p>
          <div className="grid grid-cols-3 gap-2">
            {rates.map(r => (
              <div key={r.label} className="theme-surface theme-border bg-white rounded-2xl border border-[#F0F0F0] px-3 py-3 flex flex-col items-center gap-1.5" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <span className="text-[20px]">{r.icon}</span>
                <span className="theme-brand-text text-[12px] font-bold text-[#162353]">{r.rate}</span>
                <span className="theme-text-secondary text-[10px] text-[#888] font-medium">{r.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Earning history */}
        <div>
          <p className="theme-text-secondary text-[11px] font-semibold text-[#888] uppercase tracking-wide mb-2 px-1">Earning History</p>
          <div className="theme-surface theme-border bg-white rounded-2xl border border-[#F0F0F0] overflow-hidden">
            {history.length === 0 ? (
              <p className="theme-text-secondary px-4 py-6 text-center text-[12.5px]">
                No cashback activity yet. Earn instant cashback on airtime, data, and transfers.
              </p>
            ) : (
              history.map((item, i) => (
                <div key={item.id} className={`flex items-center gap-3.5 px-4 py-3.5 ${i < history.length - 1 ? 'theme-border border-b border-[#F5F5F5]' : ''}`}>
                  <div className="w-9 h-9 rounded-full bg-yellow-50 dark:bg-yellow-500/15 flex items-center justify-center flex-shrink-0">
                    <Percent className="w-4 h-4 text-yellow-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="theme-text-primary text-[13px] font-semibold text-[#111] truncate">{item.desc}</p>
                    <p className="theme-text-secondary text-[11px] text-[#888] mt-0.5">
                      {item.date} · {item.rate} · <span className="capitalize">{item.status}</span>
                    </p>
                  </div>
                  <span className={`text-[13px] font-bold tabular-nums flex-shrink-0 ${item.status === 'redeemed' ? 'theme-text-secondary' : 'text-[#16A34A] dark:text-emerald-400'}`}>
                    {item.status === 'redeemed' ? '' : '+'}₦{formatCashbackNaira(Number(item.earned))}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Info note */}
        <div className="theme-surface-alt theme-border bg-[#F0F4FF] border border-[#C7D7FF] rounded-2xl px-4 py-4">
          <p className="theme-text-primary text-[12px] font-bold text-[#162353] mb-1 flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5" /> How it works
          </p>
          <p className="theme-text-secondary text-[11px] text-[#555] leading-relaxed">Earn cashback on every transaction. Pending cashback clears after 7 days and can then be redeemed to your Vexa wallet instantly.</p>
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

  const {
    referrals,
    referralCode: refCode,
    referralTotalEarned: totalEarned,
    referralTotalPending: totalPending,
  } = useUserData();

  function copyCode() {
    navigator.clipboard.writeText(refCode).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function shareCode() {
    if (navigator.share) {
      navigator.share({
        title: 'Join Vexa!',
        text: `Use my referral code ${refCode} on Vexa and we both earn ₦10,000 when you make your first transfer. Download at vexa.app`,
      }).catch((err: unknown) => {
        // User dismissed the share sheet — not an error, ignore silently.
        // Only re-throw unexpected errors (not AbortError / cancel).
        if (err instanceof Error && err.name !== 'AbortError') {
          console.warn('Share failed:', err);
        }
      });
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

function BusinessBrandScope({ children }: { children: React.ReactNode }) {
  return <div className="business-brand-scope contents">{children}</div>;
}

function AccountSecurityBanner() {
  const [, navigate] = useLocation();
  const { state } = useAccountSecurity();
  if (!state.sleepModeActive && !state.freezeActive) return null;

  return (
    <div className={`fixed left-0 right-0 top-0 z-[55] px-4 py-2.5 text-white shadow-md ${state.freezeActive ? 'bg-[#991B1B]' : 'bg-[#162353]'}`}>
      <div className="mx-auto flex max-w-[760px] items-center gap-2">
        <Lock className="h-4 w-4 shrink-0 text-[#8BE3FF]" />
        <p className="min-w-0 flex-1 text-[11px] font-semibold">
          {state.freezeActive ? 'Freeze Account Active' : 'Sleep Mode Active'}
          <span className="ml-1 font-normal text-white/75">· Money movement is blocked</span>
        </p>
        <button onClick={() => navigate('/settings')} className="shrink-0 rounded-lg bg-white/15 px-2.5 py-1.5 text-[10px] font-bold hover:bg-white/25">
          Manage
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
      <Route path="/bank-selection" component={BankSelectionPage} />
      <Route path="/vexa-transfer" component={VexaTransferPage} />
      <Route path="/crypto/fund"><CryptoExchangePage view="fund" /></Route>
      <Route path="/crypto/exchange"><CryptoExchangePage view="exchange" /></Route>
      <Route path="/crypto/transfer"><CryptoExchangePage view="transfer" /></Route>
      <Route path="/crypto/receive"><CryptoExchangePage view="receive" /></Route>
      <Route path="/crypto"><CryptoExchangePage /></Route>
      <Route path="/crypto/incoming" component={IncomingCryptoPage} />
      <Route path="/crypto/outgoing" component={OutgoingCryptoPage} />
      <Route path="/history" component={HistoryPage} />
      <Route path="/receipt/:transactionId" component={TransactionReceiptPage} />
      <Route path="/settings" component={SettingsPage} />
      <Route path="/app-theme" component={AppThemePage} />
      <Route path="/airtime" component={AirtimePage} />
      <Route path="/data" component={DataPage} />
      <Route path="/betting" component={BettingPage} />
      <Route path="/savings" component={SavingsPage} />
      <Route path="/investments" component={InvestmentsPage} />
      <Route path="/education" component={EducationPage} />
      <Route path="/statement" component={StatementPage} />
      <Route path="/budget" component={BudgetPage} />
      <Route path="/more" component={MorePage} />
      <Route path="/card" component={CardPage} />
      <Route path="/services" component={ServicesTabPage} />
      {/* Institutional Admin Dashboard routes */}
      <Route path="/admin">
        <AdminDashboardPage tab="overview" />
      </Route>
      <Route path="/admin/users">
        <AdminDashboardPage tab="users" />
      </Route>
      <Route path="/admin/business">
        <AdminDashboardPage tab="business" />
      </Route>
      <Route path="/admin/crypto">
        <AdminDashboardPage tab="crypto" />
      </Route>
      <Route path="/admin/crypto-logs">
        <AdminDashboardPage tab="crypto-logs" />
      </Route>
      <Route path="/admin/referrals">
        <AdminDashboardPage tab="referrals" />
      </Route>
      <Route path="/admin/cashback">
        <AdminDashboardPage tab="cashback" />
      </Route>
      <Route path="/admin/rewards">
        <AdminDashboardPage tab="referrals" />
      </Route>
      <Route path="/admin/kyc">
        <AdminDashboardPage tab="kyc" />
      </Route>
      <Route path="/admin/transactions">
        <AdminDashboardPage tab="transactions" />
      </Route>
      <Route path="/admin/deposits">
        <AdminDashboardPage tab="deposits" />
      </Route>
      <Route path="/admin/withdrawals">
        <AdminDashboardPage tab="withdrawals" />
      </Route>
      <Route path="/admin/cards">
        <AdminDashboardPage tab="cards" />
      </Route>
      <Route path="/admin/support">
        <AdminDashboardPage tab="support" />
      </Route>
      <Route path="/admin/security">
        <AdminDashboardPage tab="security" />
      </Route>
      <Route path="/admin/integrations">
        <AdminDashboardPage tab="integrations" />
      </Route>
      <Route path="/admin/audit-logs">
        <AdminDashboardPage tab="audit-logs" />
      </Route>
      <Route path="/admin/system-settings">
        <AdminDashboardPage tab="system-settings" />
      </Route>
      {/* Auth routes */}
      <Route path="/signin" component={SignInPage} />
      <Route path="/signup" component={SignUpPage} />
      <Route path="/forgot-passcode" component={ForgotPasscodePage} />
      {/* Settings sub-pages */}
      <Route path="/profile" component={ProfilePage} />
      <Route path="/limits" component={LimitsPage} />
      <Route path="/change-pin" component={ChangePinPage} />
      <Route path="/change-password" component={ChangePasswordPage} />
      <Route path="/two-factor" component={TwoFactorSettingsPage} />
      <Route path="/help-support" component={HelpSupportPage} />
      <Route path="/notifications" component={NotificationsPage} />
      <Route path="/about-vexa" component={AboutVexaPage} />
      <Route path="/cashback" component={CashbackPage} />
      <Route path="/referrals" component={ReferralsPage} />
      {/* Vexa Business — onboarding is unguarded; all other routes require security verification */}
      <Route path="/business/onboarding">
        <BusinessBrandScope><BusinessOnboarding /></BusinessBrandScope>
      </Route>
      <Route path="/business">
        <BusinessBrandScope><BusinessSecurityGate><BusinessDashboard /></BusinessSecurityGate></BusinessBrandScope>
      </Route>
      <Route path="/business/transfers">
        <BusinessBrandScope><BusinessSecurityGate><BusinessTransfers /></BusinessSecurityGate></BusinessBrandScope>
      </Route>
      <Route path="/business/receive">
        <BusinessBrandScope><BusinessSecurityGate><BusinessTransfers /></BusinessSecurityGate></BusinessBrandScope>
      </Route>
      <Route path="/business/bills">
        <BusinessBrandScope><BusinessSecurityGate><BusinessBills /></BusinessSecurityGate></BusinessBrandScope>
      </Route>
      <Route path="/business/employees">
        <BusinessBrandScope><BusinessSecurityGate><EmployeeManagement /></BusinessSecurityGate></BusinessBrandScope>
      </Route>
      <Route path="/business/payroll">
        <BusinessBrandScope><BusinessSecurityGate><PayrollManagement /></BusinessSecurityGate></BusinessBrandScope>
      </Route>
      <Route path="/business/analytics">
        <BusinessBrandScope><BusinessSecurityGate><BusinessAnalytics /></BusinessSecurityGate></BusinessBrandScope>
      </Route>
      <Route path="/business/settings">
        <BusinessBrandScope><BusinessSecurityGate><BusinessSettings /></BusinessSecurityGate></BusinessBrandScope>
      </Route>
      <Route path="/business/transactions">
        <BusinessBrandScope><BusinessSecurityGate><BusinessTransactionHistory /></BusinessSecurityGate></BusinessBrandScope>
      </Route>
      <Route path="/business/notifications">
        <BusinessBrandScope><BusinessSecurityGate><NotificationsPage /></BusinessSecurityGate></BusinessBrandScope>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

/* Handles post-splash redirect — must live inside WouterRouter + AuthProvider */
function AppShell() {
  const [showSplash, setShowSplash] = useState(true);
  const [splashDone, setSplashDone] = useState(false);
  const handleSplashDone = useCallback(() => {
    setShowSplash(false);
    setSplashDone(true);
  }, []);
  const { session, isAuthenticated, loading, profileError, refreshProfile, signOut, twoFactorPending } = useAuth();
  const [path, navigate] = useLocation();
  const { clearVerification } = useBusinessSecurity();
  const prevPathRef = React.useRef('');

  // ── Passcode-on-return lock ──────────────────────────────────────────
  const [locked, setLocked] = useState(false);
  const lockInitializedRef = useRef(false);

  useEffect(() => {
    function onShow() {
      const pref = localStorage.getItem(PASSCODE_RETURN_KEY) === 'true';
      if (pref && isAuthenticated && splashDone && !loading) {
        setLocked(true);
      }
    }

    // A fresh reload is also an app return when the setting is enabled.
    if (splashDone && !loading && isAuthenticated && !lockInitializedRef.current) {
      lockInitializedRef.current = true;
      if (localStorage.getItem(PASSCODE_RETURN_KEY) === 'true') {
        setLocked(true);
      }
    }
    if (!isAuthenticated) {
      lockInitializedRef.current = false;
    }

    // visibilitychange: tab switch, minimise, screen-off on mobile
    function handleVisibility() {
      if (!document.hidden) onShow();
    }

    // pagehide / pageshow: full page unload / back-forward cache restore
    // (iOS Safari & some Android browsers fire these instead of visibilitychange)
    function handlePageShow(e: PageTransitionEvent) {
      // persisted == came from BFCache (page was fully frozen)
      if (e.persisted) onShow();
    }

    // focus / blur on the window itself (desktop tab switch fallback)
    function handleFocus() { onShow(); }

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pageshow',     handlePageShow as EventListener);
    window.addEventListener('focus',        handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pageshow',     handlePageShow as EventListener);
      window.removeEventListener('focus',        handleFocus);
    };
  }, [isAuthenticated, loading, splashDone]);

  useEffect(() => {
    const isPublicAuthRoute = path === '/signin' || path === '/signup' || path === '/forgot-passcode';
    if (splashDone && !loading && !session && !isAuthenticated && !isPublicAuthRoute) {
      navigate('/signin');
    }
  }, [splashDone, loading, session, isAuthenticated, path, navigate]);

  // Clear business verification when the user navigates away from the business section
  useEffect(() => {
    const wasOnBusiness = prevPathRef.current.startsWith('/business');
    const bankSelectionForBusiness = path === '/bank-selection'
      && new URLSearchParams(window.location.search).get('returnTo')?.startsWith('/business');
    const isOnBusiness = path.startsWith('/business') || Boolean(bankSelectionForBusiness);
    if (wasOnBusiness && !isOnBusiness) {
      clearVerification();
    }
    prevPathRef.current = path;
  }, [path]);

  return (
    <>
      {showSplash && <SplashScreen onDone={handleSplashDone} />}
      {!loading && profileError && session && !isAuthenticated && (
        <div className="fixed top-3 left-1/2 z-[60] w-[min(92vw,420px)] -translate-x-1/2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 shadow-lg">
          <p className="text-[13px] font-semibold text-red-700">Your session is active, but your profile could not be loaded.</p>
          <button onClick={() => void refreshProfile()} className="mt-2 text-[12px] font-bold text-[#162353]">Try again</button>
        </div>
      )}
      <Router />
      <AccountSecurityBanner />
      <CryptoDepositToastContainer enabled={isAuthenticated && !locked} />
      {twoFactorPending && <TwoFactorChallenge />}
      {locked && (
        <PasscodeLockScreen
          onUnlock={() => setLocked(false)}
          onSignOut={() => { setLocked(false); signOut(); navigate('/signin'); }}
          onForgotPasscode={() => {
            const lockedPhone = (() => {
              try { return localStorage.getItem('vexa_last_login_phone') ?? ''; } catch { return ''; }
            })();
            setLocked(false);
            void signOut();
            navigate(lockedPhone ? `/forgot-passcode?phone=${encodeURIComponent(lockedPhone)}` : '/forgot-passcode');
          }}
        />
      )}
    </>
  );
}

function App() {
  return (
    <ThemeModeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AccountSecurityProvider>
          <UserDataProvider>
          <VexaFinanceProvider>
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
          </VexaFinanceProvider>
          </UserDataProvider>
          </AccountSecurityProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeModeProvider>
  );
}

export default App;
