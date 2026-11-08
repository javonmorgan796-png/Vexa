import React, { useState } from 'react';
import { X, Info, Plus, ChevronRight, Delete } from 'lucide-react';
import { cleanBankName } from '@/pages/transfer/BankSelectionPage';
import { BankLogoBadge } from '@/components/BankLogoBadge';

interface TransferConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProceedToPin: () => void;
  bankName: string;
  bankLogo?: string | null;
  accountNumber: string;
  recipientName: string;
  amount: number;
  userBalance: number;
  onAddMoney?: () => void;
  fee?: number;
  vat?: number;
}

export function TransferConfirmationModal({
  isOpen,
  onClose,
  onProceedToPin,
  bankName,
  bankLogo,
  accountNumber,
  recipientName,
  amount,
  userBalance,
  onAddMoney,
  fee = 10.0,
  vat = 0.75,
}: TransferConfirmationModalProps) {
  if (!isOpen) return null;

  const totalAmount = amount + fee + vat;
  const isInsufficient = userBalance < totalAmount;
  const cleanBank = cleanBankName(bankName);

  const formattedTotal = totalAmount.toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const formattedAmount = amount.toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const formattedBalance = userBalance.toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex flex-col justify-end animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-[28px] max-w-lg mx-auto w-full p-5 pb-8 shadow-2xl animate-in slide-in-from-bottom duration-300 max-h-[92vh] overflow-y-auto"
        style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header with Close Button */}
        <div className="flex items-center justify-between pb-1">
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 stroke-[2.2]" />
          </button>
          <div className="w-8" />
        </div>

        {/* Total Payment Headline */}
        <div className="text-center my-3">
          <p className="text-[34px] font-extrabold text-[#111] tracking-tight leading-none flex items-baseline justify-center">
            <span className="text-[26px] font-extrabold mr-1">₦</span>
            {formattedTotal}
          </p>
        </div>

        {/* Transaction Breakdown Details Card without outlines */}
        <div className="rounded-2xl border-0 shadow-sm bg-[#FAFAFC] p-4 space-y-3 mt-4 text-[13px]">
          {/* Bank Row */}
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Bank</span>
            <div className="flex items-center gap-1.5 font-bold text-[#111] uppercase">
              <BankLogoBadge bankName={cleanBank} bankLogo={bankLogo} size="xs" />
              <span>{cleanBank}</span>
            </div>
          </div>

          {/* Account Number */}
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Account Number</span>
            <span className="font-semibold text-[#111] font-mono tracking-wider">{accountNumber}</span>
          </div>

          {/* Recipient Name */}
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Name</span>
            <span className="font-bold text-[#111] uppercase max-w-[65%] text-right truncate">
              {recipientName}
            </span>
          </div>

          {/* Transfer Amount */}
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Amount</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] bg-[#E6F9F0] text-[#00C582] font-bold px-1.5 py-0.5 rounded">
                Thousands
              </span>
              <span className="font-bold text-[#111]">₦{formattedAmount}</span>
            </div>
          </div>

          {/* Transaction Fee */}
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Fee</span>
            <span className="font-semibold text-[#111]">₦{fee.toFixed(2)}</span>
          </div>

          {/* VAT */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 text-gray-500">
              <span>VAT</span>
              <Info className="w-3.5 h-3.5 text-gray-400" />
            </div>
            <span className="font-semibold text-[#111]">₦{vat.toFixed(2)}</span>
          </div>
        </div>

        {/* Payment Method Section */}
        <div className="mt-5 space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <span className="text-[13px] font-bold text-gray-600">Payment Method</span>
            <button
              type="button"
              className="text-[12px] font-semibold text-gray-400 hover:text-gray-600 flex items-center gap-0.5"
            >
              All <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Balance Selection Card without outlines */}
          <div className="rounded-2xl border-0 bg-white p-4 shadow-sm">
            <div className="flex items-start gap-2.5">
              {/* Radio Indicator */}
              <div className="mt-0.5 w-4 h-4 rounded-full border-2 border-[#162353] flex items-center justify-center shrink-0">
                <div className="w-2 h-2 rounded-full bg-[#162353]" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[13.5px] font-bold text-[#111]">
                    Available Balance (₦{formattedBalance})
                  </span>
                  <Info className="w-3.5 h-3.5 text-gray-400" />
                </div>

                {isInsufficient && (
                  <p className="text-[12px] text-rose-500 font-medium mt-1">Insufficient balance</p>
                )}

                {/* Dashed Divider */}
                <div className="border-t border-dashed border-gray-200 my-3" />

                {/* Sub-Balances and Add Money */}
                <div className="flex items-center justify-between text-[12px] text-gray-500">
                  <div className="space-y-0.5">
                    <p>Wallet (₦{formattedBalance})</p>
                    <p>OWealth (₦0.00)</p>
                  </div>
                  {onAddMoney && (
                    <button
                      type="button"
                      onClick={onAddMoney}
                      className="text-[#162353] font-bold hover:underline flex items-center gap-0.5 text-[12.5px]"
                    >
                      Add Money <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Add a Bank Card / Account Option without outlines */}
          <button
            type="button"
            className="w-full rounded-2xl border-0 bg-white p-3.5 flex items-center gap-2.5 text-[13px] font-semibold text-gray-700 hover:bg-gray-50 transition-colors shadow-sm outline-none ring-0"
          >
            <div className="w-5 h-5 rounded-full border border-gray-300 flex items-center justify-center text-gray-500 shrink-0">
              <Plus className="w-3 h-3 stroke-[3]" />
            </div>
            <span>Add a Bank Card / Account</span>
          </button>
        </div>

        {/* Pay Button */}
        <div className="mt-6">
          <button
            type="button"
            onClick={onProceedToPin}
            disabled={isInsufficient}
            className={`w-full h-[52px] rounded-full text-[16px] font-bold text-white transition-all shadow-sm active:scale-[0.99] flex items-center justify-center ${
              isInsufficient
                ? 'bg-[#162353]/35 cursor-not-allowed text-white/70'
                : 'bg-[#162353] hover:bg-[#121c42] active:bg-[#0c1432]'
            }`}
          >
            Pay
          </button>
        </div>
      </div>
    </div>
  );
}

interface PaymentPinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccessPin: (pin: string) => void;
  amount: number;
  recipientName: string;
  bankName: string;
  error?: string;
  processing?: boolean;
}

export function PaymentPinModal({
  isOpen,
  onClose,
  onSuccessPin,
  amount,
  recipientName,
  bankName,
  error,
  processing = false,
}: PaymentPinModalProps) {
  const [pin, setPin] = useState('');

  if (!isOpen) return null;

  const handleKey = (digit: string) => {
    if (processing) return;
    if (pin.length < 4) {
      const nextPin = pin + digit;
      setPin(nextPin);
      if (nextPin.length === 4) {
        onSuccessPin(nextPin);
      }
    }
  };

  const handleBackspace = () => {
    if (processing) return;
    setPin(prev => prev.slice(0, -1));
  };

  const formattedAmount = amount.toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const cleanBank = cleanBankName(bankName);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex flex-col justify-end animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-[28px] max-w-lg mx-auto w-full p-5 pb-8 shadow-2xl animate-in slide-in-from-bottom duration-300 max-h-[92vh] overflow-y-auto"
        style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header with Close */}
        <div className="flex items-center justify-between pb-1">
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 stroke-[2.2]" />
          </button>
          <span className="text-[16px] font-bold text-[#111]">Enter Payment PIN</span>
          <div className="w-8" />
        </div>

        {/* Transfer Subtitle & Amount */}
        <div className="text-center my-3">
          <p className="text-[12px] text-gray-500 truncate max-w-xs mx-auto">
            Transfer to <b className="text-gray-800 uppercase">{recipientName}</b> ({cleanBank})
          </p>
          <p className="text-[32px] font-extrabold text-[#111] tracking-tight mt-1 flex items-baseline justify-center">
            <span className="text-[24px] font-extrabold mr-1">₦</span>
            {formattedAmount}
          </p>
        </div>

        {/* 4 PIN Dots */}
        <div className="flex justify-center gap-5 my-5">
          {[0, 1, 2, 3].map(index => {
            const isFilled = index < pin.length;
            return (
              <div
                key={index}
                className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${
                  isFilled
                    ? 'bg-[#162353] border-[#162353] scale-110 shadow-xs'
                    : 'border-gray-300 bg-transparent'
                }`}
              />
            );
          })}
        </div>

        {/* Error message */}
        {error && (
          <p className="text-center text-[12px] text-rose-500 font-medium mb-3 animate-in fade-in">
            {error}
          </p>
        )}

        {/* Processing State */}
        {processing && (
          <div className="flex items-center justify-center gap-2 py-3 text-[13px] font-semibold text-[#162353]">
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40 20" />
            </svg>
            Authorizing transfer securely…
          </div>
        )}

        {/* Sleek On-screen Keypad */}
        <div className="w-full max-w-xs mx-auto mt-4">
          <div className="grid grid-cols-3 gap-3 mb-2">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(key => (
              <button
                key={key}
                type="button"
                onClick={() => handleKey(key)}
                disabled={processing}
                className="h-14 rounded-2xl bg-[#F4F5F7] text-[22px] font-semibold text-[#111] active:bg-[#E5E7EB] hover:bg-[#EBEEF2] transition-colors flex items-center justify-center select-none"
              >
                {key}
              </button>
            ))}
            <div />
            <button
              type="button"
              onClick={() => handleKey('0')}
              disabled={processing}
              className="h-14 rounded-2xl bg-[#F4F5F7] text-[22px] font-semibold text-[#111] active:bg-[#E5E7EB] hover:bg-[#EBEEF2] transition-colors flex items-center justify-center select-none"
            >
              0
            </button>
            <button
              type="button"
              onClick={handleBackspace}
              disabled={processing}
              className="h-14 rounded-2xl bg-[#F4F5F7] flex items-center justify-center active:bg-[#E5E7EB] hover:bg-[#EBEEF2] transition-colors select-none text-gray-700"
              aria-label="Backspace"
            >
              <Delete className="w-6 h-6 stroke-[1.8]" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
