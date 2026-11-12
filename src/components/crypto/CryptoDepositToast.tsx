import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { ArrowDownLeft, X } from 'lucide-react';
import type { CryptoAsset } from '@/context/VexaFinanceContext';
import type { AppNotification } from '@/context/UserDataContext';
import { CRYPTO_ASSET_META, CryptoAssetLogo } from '@/components/crypto/CryptoActivityDetailsModal';

export type CryptoDepositToastStatus = 'incoming' | 'credited';

export interface CryptoDepositToastInput {
  asset: CryptoAsset;
  amount: string;
  status: CryptoDepositToastStatus;
  network?: string;
  subtitle?: string;
  txHash?: string;
  dedupeKey?: string;
}

interface CryptoDepositToastItem extends CryptoDepositToastInput {
  id: string;
  createdAt: number;
  closing: boolean;
}

type ToastListener = (item: CryptoDepositToastInput) => void;

const listeners = new Set<ToastListener>();
const recentDedupeMap = new Map<string, number>();
const DEDUPE_WINDOW_MS = 90_000;
const AUTO_DISMISS_MS = 6500;
const MAX_VISIBLE_TOASTS = 3;

let cachedLogos: Partial<Record<CryptoAsset, string | null>> | null = null;
let logosPromise: Promise<Partial<Record<CryptoAsset, string | null>>> | null = null;

function fetchCachedCoinLogos(): Promise<Partial<Record<CryptoAsset, string | null>>> {
  if (cachedLogos) return Promise.resolve(cachedLogos);
  if (logosPromise) return logosPromise;

  logosPromise = fetch('/api/crypto/logos', { headers: { accept: 'application/json' } })
    .then(async (res) => {
      if (!res.ok) return {};
      const body = (await res.json()) as {
        logos?: Record<string, { asset?: string; logoUrl?: string | null }>;
      };
      const resolved: Partial<Record<CryptoAsset, string | null>> = {
        BTC: body?.logos?.BTC?.logoUrl ?? null,
        ETH: body?.logos?.ETH?.logoUrl ?? null,
        USDT: body?.logos?.USDT?.logoUrl ?? null,
      };
      cachedLogos = resolved;
      return resolved;
    })
    .catch(() => ({}))
    .finally(() => {
      logosPromise = null;
    });

  return logosPromise;
}

function normalizeAmountForDedupe(raw: string): string {
  const numeric = Number(raw.replace(/,/g, '').trim());
  if (!Number.isFinite(numeric)) return raw.trim();
  return numeric.toFixed(8).replace(/\.?0+$/, '');
}

function pruneDedupeMap(now: number) {
  for (const [key, ts] of recentDedupeMap) {
    if (now - ts > DEDUPE_WINDOW_MS) {
      recentDedupeMap.delete(key);
    }
  }
}

export function emitCryptoDepositToast(input: CryptoDepositToastInput) {
  const now = Date.now();
  pruneDedupeMap(now);

  const normalizedAmt = normalizeAmountForDedupe(input.amount);
  const canonicalKey = `${input.status}:${input.asset}:${normalizedAmt}`;
  const keysToCheck = [canonicalKey];
  if (input.txHash) {
    keysToCheck.push(`${input.status}:hash:${input.txHash.toLowerCase()}`);
  }
  if (input.dedupeKey) {
    keysToCheck.push(`${input.status}:custom:${input.dedupeKey.toLowerCase()}`);
  }

  for (const key of keysToCheck) {
    const prev = recentDedupeMap.get(key);
    if (prev && now - prev < DEDUPE_WINDOW_MS) {
      return;
    }
  }

  for (const key of keysToCheck) {
    recentDedupeMap.set(key, now);
  }

  listeners.forEach((listener) => listener(input));
}

export function parseCryptoDepositNotification(
  notification: Pick<AppNotification, 'id' | 'type' | 'title' | 'body'>,
): CryptoDepositToastInput | null {
  const title = notification.title.trim();
  const body = notification.body.trim();
  const haystack = `${title} ${body}`;

  // Ignore receive-address-created alerts
  if (/receive address ready/i.test(title)) return null;

  const isCryptoType = notification.type === 'crypto';
  const matchesDepositTitle =
    /\bdeposit\s+(incoming|received)\b/i.test(title) ||
    /\b(BTC|ETH|USDT)\s+received\b/i.test(title) ||
    /\bcredited to your Exchange wallet\b/i.test(body);

  if (!isCryptoType || !matchesDepositTitle) return null;

  let asset: CryptoAsset | null = null;
  if (/\b(BTC|Bitcoin)\b/i.test(haystack)) asset = 'BTC';
  else if (/\b(ETH|Ethereum)\b/i.test(haystack)) asset = 'ETH';
  else if (/\b(USDT|Tether)\b/i.test(haystack)) asset = 'USDT';
  if (!asset) return null;

  const amountRegex = new RegExp(`([0-9][0-9,]*(?:\\.[0-9]+)?)\\s*${asset}\\b`, 'i');
  const amountMatch = body.match(amountRegex) ?? title.match(amountRegex);
  if (!amountMatch?.[1]) return null;

  const amount = amountMatch[1];
  const isIncoming =
    /\bdeposit\s+incoming\b/i.test(title) || /\bdetected on\b/i.test(body);
  const status: CryptoDepositToastStatus = isIncoming ? 'incoming' : 'credited';

  const networkMatch = body.match(/\bon\s+([A-Za-z0-9\s\-()]+?)(?:\s*\(|\s+and credited|\s*$)/i);
  const network = networkMatch?.[1]?.trim();

  const txMatch = body.match(/\bTx\s+([a-f0-9]{6,})/i);
  const txHash = txMatch?.[1];

  const confirmationsMatch = body.match(/\((\d+\/\d+\s+confirmations)/i);
  const subtitle = isIncoming
    ? confirmationsMatch?.[1]
      ? `${confirmationsMatch[1]}${network ? ` · ${network}` : ''}`
      : network
        ? `Confirming on ${network}`
        : 'Confirming on blockchain'
    : network
      ? `Credited to Exchange wallet · ${network}`
      : /\breceived from\b/i.test(body)
        ? body.replace(/\s*\(Ref [^)]+\)\.?$/i, '')
        : 'Credited to Exchange wallet';

  return {
    asset,
    amount,
    status,
    network,
    subtitle,
    txHash,
    dedupeKey: `notif:${notification.id}`,
  };
}

function ToastCoinBadge({
  asset,
  logoUrl,
}: {
  asset: CryptoAsset;
  logoUrl?: string | null;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const meta = CRYPTO_ASSET_META[asset];

  useEffect(() => {
    setImgFailed(false);
  }, [logoUrl, asset]);

  return (
    <div className="relative w-8 h-8 shrink-0">
      {logoUrl && !imgFailed ? (
        <div className="w-8 h-8 rounded-full bg-white/70 dark:bg-black/40 border border-white/40 dark:border-white/10 flex items-center justify-center overflow-hidden shadow-xs">
          <img
            src={logoUrl}
            alt={`${meta.name} (${asset}) logo`}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover rounded-full"
            onError={() => setImgFailed(true)}
          />
        </div>
      ) : (
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center shadow-xs"
          style={{ backgroundColor: meta.color }}
        >
          <CryptoAssetLogo asset={asset} size={16} />
        </div>
      )}
      <span
        aria-hidden="true"
        className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[#16A34A] text-white border border-white dark:border-[#1E2329] flex items-center justify-center"
      >
        <ArrowDownLeft className="w-2 h-2" strokeWidth={2.75} />
      </span>
    </div>
  );
}

function CryptoDepositToastCard({
  item,
  logoUrl,
  onDismiss,
  onOpen,
}: {
  item: CryptoDepositToastItem;
  logoUrl?: string | null;
  onDismiss: (id: string) => void;
  onOpen: (item: CryptoDepositToastItem) => void;
}) {
  const [entered, setEntered] = useState(false);
  const [paused, setPaused] = useState(false);
  const [dragX, setDragX] = useState(0);
  const dragStartRef = useRef<number | null>(null);
  const remainingRef = useRef(AUTO_DISMISS_MS);
  const startedAtRef = useRef(Date.now());

  useEffect(() => {
    const raf = window.requestAnimationFrame(() => {
      setEntered(true);
    });
    return () => window.cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (item.closing || paused) return;
    startedAtRef.current = Date.now();
    const timer = window.setTimeout(() => {
      onDismiss(item.id);
    }, remainingRef.current);
    return () => {
      window.clearTimeout(timer);
      remainingRef.current = Math.max(0, remainingRef.current - (Date.now() - startedAtRef.current));
    };
  }, [item.id, item.closing, paused, onDismiss]);

  const meta = CRYPTO_ASSET_META[item.asset];
  const isIncoming = item.status === 'incoming';
  const visible = entered && !item.closing;

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest('button[data-toast-dismiss="true"]')) return;
    dragStartRef.current = e.clientX;
    setPaused(true);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (dragStartRef.current === null) return;
    const delta = e.clientX - dragStartRef.current;
    if (delta > 0) setDragX(delta);
  }

  function handlePointerUp() {
    if (dragStartRef.current === null) return;
    dragStartRef.current = null;
    if (dragX > 72) {
      onDismiss(item.id);
    } else {
      setDragX(0);
      setPaused(false);
    }
  }

  const transformStyle = !visible
    ? 'translate3d(calc(100% + 28px), 0, 0)'
    : dragX > 0
      ? `translate3d(${dragX}px, 0, 0)`
      : 'translate3d(0, 0, 0)';

  return (
    <div
      role="status"
      aria-live="polite"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => { if (dragStartRef.current === null) setPaused(false); }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{
        transform: transformStyle,
        opacity: visible ? Math.max(0.25, 1 - dragX / 180) : 0,
        transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
      }}
      className="pointer-events-auto relative overflow-hidden rounded-xl bg-white/40 dark:bg-black/40 backdrop-blur-xl border border-white/50 dark:border-white/10 shadow-[0_8px_24px_-6px_rgba(0,0,0,0.14)] dark:shadow-[0_8px_24px_-6px_rgba(0,0,0,0.5)] transition-[transform,opacity] duration-300 select-none touch-pan-y"
    >
      <div className="flex items-center gap-2.5 px-3 py-2">
        <button
          type="button"
          onClick={() => onOpen(item)}
          className="flex-1 min-w-0 flex items-center gap-2.5 text-left focus:outline-none focus-visible:ring-1 focus-visible:ring-[#F0B90B] rounded-lg"
        >
          <ToastCoinBadge asset={item.asset} logoUrl={logoUrl} />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-[10.5px] font-medium text-slate-700 dark:text-slate-300">
              <span className="truncate">{meta.name}</span>
              <span aria-hidden="true">·</span>
              <span className={isIncoming ? 'text-amber-600 dark:text-[#F0B90B] font-semibold' : 'text-emerald-600 dark:text-[#22C55E] font-semibold'}>
                {isIncoming ? 'Incoming' : 'Received'}
              </span>
            </div>

            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-[13.5px] font-bold text-slate-900 dark:text-white tabular-nums leading-tight truncate">
                +{item.amount} {item.asset}
              </span>
              <span className="text-[10px] text-slate-600 dark:text-slate-400 truncate hidden xs:inline">
                {item.subtitle || (isIncoming ? 'Confirming' : 'Exchange wallet')}
              </span>
            </div>
          </div>
        </button>

        <button
          type="button"
          data-toast-dismiss="true"
          aria-label="Dismiss deposit notification"
          onClick={() => onDismiss(item.id)}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors shrink-0 focus:outline-none focus-visible:ring-1 focus-visible:ring-[#F0B90B]"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Subtle compositor-only timer indicator */}
      <div className="h-[1.5px] w-full bg-black/5 dark:bg-white/10 overflow-hidden">
        <div
          className="h-full w-full origin-left bg-[#16A34A] dark:bg-[#22C55E]"
          style={{
            animation: `vexaDepositToastDrain ${AUTO_DISMISS_MS}ms linear forwards`,
            animationPlayState: paused || item.closing ? 'paused' : 'running',
          }}
        />
      </div>
    </div>
  );
}

export function CryptoDepositToastContainer({ enabled = true }: { enabled?: boolean }) {
  const [, navigate] = useLocation();
  const [toasts, setToasts] = useState<CryptoDepositToastItem[]>([]);
  const [logos, setLogos] = useState<Partial<Record<CryptoAsset, string | null>>>(() => cachedLogos ?? {});

  useEffect(() => {
    let active = true;
    void fetchCachedCoinLogos().then((resolved) => {
      if (active) setLogos(resolved);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const handleEvent: ToastListener = (input) => {
      if (!enabled) return;
      const newToast: CryptoDepositToastItem = {
        ...input,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        createdAt: Date.now(),
        closing: false,
      };
      setToasts((prev) => [newToast, ...prev].slice(0, MAX_VISIBLE_TOASTS));
    };

    listeners.add(handleEvent);
    return () => {
      listeners.delete(handleEvent);
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled && toasts.length > 0) {
      setToasts([]);
    }
  }, [enabled, toasts.length]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, closing: true } : t)));
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 300);
  }, []);

  const openToast = useCallback(
    (item: CryptoDepositToastItem) => {
      dismissToast(item.id);
      navigate('/crypto/incoming');
    },
    [dismissToast, navigate],
  );

  if (!enabled || toasts.length === 0) return null;

  return (
    <>
      <style>{`
        @keyframes vexaDepositToastDrain {
          from { transform: scaleX(1); }
          to { transform: scaleX(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes vexaDepositToastDrain {
            from { transform: scaleX(1); }
            to { transform: scaleX(1); }
          }
        }
      `}</style>
      <div
        className="fixed z-[85] right-4 left-4 sm:left-auto sm:w-[340px] pointer-events-none flex flex-col gap-2"
        style={{
          top: 'max(env(safe-area-inset-top, 12px), 12px)',
          fontFamily: "'Inter', sans-serif",
        }}
      >
        {toasts.map((item) => (
          <CryptoDepositToastCard
            key={item.id}
            item={item}
            logoUrl={logos[item.asset]}
            onDismiss={dismissToast}
            onOpen={openToast}
          />
        ))}
      </div>
    </>
  );
}
