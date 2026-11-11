import React, { useEffect, useState } from 'react';
import { ChevronRight, Info, Plus, X } from 'lucide-react';

export interface TelecomCheckoutNetwork {
  id: string;
  name: string;
  domain: string;
  color: string;
  text: string;
  logoUrl?: string | null;
}

export interface TelecomCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  productType: 'airtime' | 'data';
  network: TelecomCheckoutNetwork;
  phone: string;
  dataBundle?: string;
  amount: number;
  availableBalance: number;
  cashbackBalance: number;
  pendingCashbackBalance?: number;
  onPay: (payableAmount: number, cashbackUsed: number, useCashback: boolean) => void;
  onAddMoney: () => void;
}

function formatNaira(value: number): string {
  const safe = Number.isFinite(value) ? Math.max(0, value) : 0;
  return safe.toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatRecipientMobile(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('0')) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 7)} ${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `0${digits.slice(0, 2)} ${digits.slice(2, 6)} ${digits.slice(6)}`;
  }
  return phone;
}

function SmallNetworkBadge({ network }: { network: TelecomCheckoutNetwork }) {
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [network.id, network.logoUrl]);

  if (network.logoUrl && !imgFailed) {
    return (
      <span className="w-6 h-6 rounded-full bg-white border border-slate-200 dark:border-[#2B313A] flex items-center justify-center overflow-hidden shrink-0 shadow-2xs">
        <img
          src={network.logoUrl}
          alt={`${network.name} logo`}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover rounded-full"
          onError={() => setImgFailed(true)}
        />
      </span>
    );
  }

  return (
    <span
      className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-black shrink-0"
      style={{ backgroundColor: network.color, color: network.text }}
      aria-hidden="true"
    >
      {network.name.slice(0, 3)}
    </span>
  );
}

export function TelecomCheckoutModal({
  isOpen,
  onClose,
  productType,
  network,
  phone,
  dataBundle,
  amount,
  availableBalance,
  cashbackBalance,
  pendingCashbackBalance = 0,
  onPay,
  onAddMoney,
}: TelecomCheckoutModalProps) {
  const [useCashback, setUseCashback] = useState(false);
  const [showBalanceInfo, setShowBalanceInfo] = useState(false);
  const [cashbackHint, setCashbackHint] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setUseCashback(false);
    setShowBalanceInfo(false);
    setCashbackHint('');

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const safeAmount = Number.isFinite(amount) ? Math.max(0, amount) : 0;
  const safeBalance = Number.isFinite(availableBalance) ? Math.max(0, availableBalance) : 0;
  const safeCashback = Number.isFinite(cashbackBalance) ? Math.max(0, cashbackBalance) : 0;
  const safePendingCashback = Number.isFinite(pendingCashbackBalance) ? Math.max(0, pendingCashbackBalance) : 0;

  const maxApplicableCashback = Number(Math.min(safeAmount, safeCashback).toFixed(2));
  const cashbackApplied = useCashback ? maxApplicableCashback : 0;
  const payableAmount = Math.max(0, Number((safeAmount - cashbackApplied).toFixed(2)));
  const isInsufficient = payableAmount > safeBalance;
  const rewardCashback = Number((safeAmount * 0.05).toFixed(2));

  const productLabel = productType === 'data' ? 'Mobile Data' : 'Airtime';

  const handleToggleCashback = () => {
    if (maxApplicableCashback <= 0) {
      setUseCashback(false);
      setCashbackHint(
        safePendingCashback > 0
          ? `₦${formatNaira(safePendingCashback)} cashback is currently pending clearance.`
          : 'No redeemable cashback yet. You earn 5% cashback on airtime & data purchases.',
      );
      return;
    }
    setCashbackHint('');
    setUseCashback((prev) => !prev);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="telecom-checkout-title"
      className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex flex-col justify-end animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="theme-page rounded-t-[26px] max-w-lg mx-auto w-full px-4 pt-3 pb-[max(env(safe-area-inset-bottom),24px)] shadow-2xl animate-in slide-in-from-bottom duration-300 max-h-[90vh] overflow-y-auto"
        style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif", scrollbarWidth: 'none' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Close Row */}
        <div className="flex items-center justify-between mb-1">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close checkout"
            className="min-w-[44px] min-h-[44px] -ml-2 flex items-center justify-center rounded-full theme-text-secondary hover:theme-text-primary active:scale-95 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
          <span className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-700" aria-hidden="true" />
          <span className="w-11" aria-hidden="true" />
        </div>

        {/* Hero Payable Amount */}
        <div className="text-center mt-1 mb-5">
          <h2 id="telecom-checkout-title" className="sr-only">
            {productLabel} Checkout
          </h2>
          <p className="text-[34px] font-extrabold tracking-tight tabular-nums theme-text-primary leading-none">
            <span className="naira-sign text-[24px] mr-0.5">₦</span>
            {formatNaira(payableAmount)}
          </p>
          {useCashback && cashbackApplied > 0 ? (
            <p className="text-[12px] font-medium text-emerald-600 dark:text-emerald-400 mt-1.5 tabular-nums">
              ₦{formatNaira(cashbackApplied)} cashback applied · Original ₦{formatNaira(safeAmount)}
            </p>
          ) : (
            rewardCashback > 0 && (
              <p className="text-[12px] font-medium theme-text-secondary mt-1.5 tabular-nums">
                Earn +₦{formatNaira(rewardCashback)} (5%) cashback on this order
              </p>
            )
          )}
        </div>

        {/* Order Summary Card */}
        <div className="theme-surface rounded-2xl px-4 py-4 space-y-3.5 shadow-2xs mb-4">
          {/* Product Name */}
          <div className="flex items-center justify-between gap-3">
            <span className="text-[13.5px] theme-text-secondary">Product Name</span>
            <div className="flex items-center gap-2">
              <SmallNetworkBadge network={network} />
              <span className="text-[14px] font-semibold theme-text-primary">{productLabel}</span>
            </div>
          </div>

          {/* Recipient Mobile */}
          <div className="flex items-center justify-between gap-3">
            <span className="text-[13.5px] theme-text-secondary">Recipient Mobile</span>
            <span className="text-[14px] font-semibold theme-text-primary tabular-nums tracking-wide">
              {formatRecipientMobile(phone)}
            </span>
          </div>

          {/* Data Bundle (Data only) */}
          {productType === 'data' && dataBundle && (
            <div className="flex items-center justify-between gap-3">
              <span className="text-[13.5px] theme-text-secondary shrink-0">Data Bundle</span>
              <span className="text-[14px] font-semibold theme-text-primary text-right truncate">
                {dataBundle}
              </span>
            </div>
          )}

          {/* Amount */}
          <div className="flex items-center justify-between gap-3">
            <span className="text-[13.5px] theme-text-secondary">Amount</span>
            <span className="text-[14px] font-semibold theme-text-primary tabular-nums">
              ₦{formatNaira(safeAmount)}
            </span>
          </div>

          {/* Use Cashback Toggle */}
          <div className="pt-0.5">
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleToggleCashback}
                className="text-[13.5px] theme-text-secondary tabular-nums text-left hover:theme-text-primary transition-colors cursor-pointer"
              >
                Use Cashback (₦{formatNaira(safeCashback)})
              </button>
              <div className="flex items-center gap-2.5">
                <span
                  className={`text-[13.5px] font-semibold tabular-nums transition-colors ${
                    useCashback && maxApplicableCashback > 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'theme-text-secondary'
                  }`}
                >
                  -₦{formatNaira(maxApplicableCashback)}
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={useCashback}
                  aria-label="Use cashback balance"
                  onClick={handleToggleCashback}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F0B90B] cursor-pointer ${
                    maxApplicableCashback <= 0
                      ? 'bg-slate-200 dark:bg-[#2B313A] opacity-70'
                      : useCashback
                        ? 'bg-[#10B981]'
                        : 'bg-slate-300 dark:bg-[#3A414D]'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                      useCashback ? 'translate-x-5.5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
            </div>
            {cashbackHint && (
              <p className="mt-1.5 text-[12px] text-amber-600 dark:text-amber-400 leading-snug">
                {cashbackHint}
              </p>
            )}
          </div>
        </div>

        {/* Payment Method Section Header */}
        <div className="flex items-center justify-between px-1 mb-2">
          <span className="text-[13px] font-medium theme-text-secondary">Payment Method</span>
          <button
            type="button"
            onClick={onAddMoney}
            className="min-h-[32px] inline-flex items-center gap-0.5 text-[13px] font-medium theme-text-secondary hover:theme-text-primary transition-colors"
          >
            <span>Wallet</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Payment Method Card */}
        <div className="theme-surface rounded-2xl px-4 py-4 shadow-2xs mb-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              {/* Vexa concentric balance badge */}
              <span
                className="w-6 h-6 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0"
                aria-hidden="true"
              >
                <span className="w-3.5 h-3.5 rounded-full border-[3px] border-[#10B981] bg-transparent" />
              </span>
              <span className="text-[14px] font-semibold theme-text-primary tabular-nums truncate">
                Available Balance (₦{formatNaira(safeBalance)})
              </span>
              <button
                type="button"
                onClick={() => setShowBalanceInfo((prev) => !prev)}
                aria-label="Available balance details"
                className="min-w-[28px] min-h-[28px] flex items-center justify-center rounded-full theme-text-secondary hover:theme-text-primary transition-colors"
              >
                <Info className="w-4 h-4" />
              </button>
            </div>
          </div>

          {showBalanceInfo && (
            <p className="mt-1.5 text-[12px] theme-text-secondary leading-relaxed">
              Your available Vexa Naira wallet balance ready for instant airtime and data payments.
            </p>
          )}

          {isInsufficient && (
            <p className="mt-1.5 text-[13px] font-semibold text-[#E11D48] dark:text-[#FB7185]">
              Insufficient balance
            </p>
          )}

          {/* Dashed Separator (works reliably in both light & dark mode) */}
          <div
            className="h-px w-full my-3.5 text-slate-300 dark:text-slate-600"
            style={{
              backgroundImage: 'linear-gradient(to right, currentColor 55%, transparent 55%)',
              backgroundSize: '8px 1px',
              backgroundRepeat: 'repeat-x',
            }}
            aria-hidden="true"
          />

          <div className="flex items-center justify-between gap-3">
            <div className="space-y-1 text-[13px] tabular-nums">
              <p className="theme-text-secondary">
                Wallet (₦{formatNaira(safeBalance)})
              </p>
              <p className={useCashback && cashbackApplied > 0 ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'theme-text-secondary'}>
                {useCashback && cashbackApplied > 0
                  ? `Cashback Applied (-₦${formatNaira(cashbackApplied)})`
                  : `Cashback (₦${formatNaira(safeCashback)})`}
              </p>
            </div>

            <button
              type="button"
              onClick={onAddMoney}
              className="min-h-[44px] inline-flex items-center gap-0.5 px-1 text-[13.5px] font-semibold text-[#10B981] hover:opacity-80 active:scale-95 transition-all shrink-0"
            >
              <span>Add Money</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Fund Account / Bank Transfer Option */}
        <button
          type="button"
          onClick={onAddMoney}
          className="theme-surface w-full rounded-2xl px-4 py-3.5 flex items-center justify-between gap-3 shadow-2xs hover:opacity-95 active:scale-[0.99] transition-all mb-5 text-left"
        >
          <div className="flex items-center gap-3">
            <span className="w-7 h-7 rounded-full theme-control flex items-center justify-center theme-text-secondary shrink-0">
              <Plus className="w-4 h-4" />
            </span>
            <span className="text-[14px] font-semibold theme-text-primary">
              Add a Bank Card / Account
            </span>
          </div>
          <ChevronRight className="w-4 h-4 theme-text-secondary shrink-0" />
        </button>

        {/* Bottom Primary CTA */}
        <button
          type="button"
          disabled={isInsufficient || payableAmount < 0}
          onClick={() => onPay(payableAmount, cashbackApplied, useCashback && cashbackApplied > 0)}
          className={`w-full h-[52px] rounded-full text-[15px] font-bold transition-all shadow-sm ${
            isInsufficient
              ? 'bg-[#F0B90B]/35 text-[#181A20]/45 dark:bg-[#F0B90B]/25 dark:text-[#EAECEF]/40 cursor-not-allowed'
              : 'bg-[#F0B90B] hover:bg-[#FCD535] active:scale-[0.99] text-[#181A20] cursor-pointer'
          }`}
        >
          {payableAmount === 0 && cashbackApplied > 0
            ? 'Pay with Cashback'
            : `Pay${useCashback && cashbackApplied > 0 ? ` ₦${formatNaira(payableAmount)}` : ''}`}
        </button>
      </div>
    </div>
  );
}
