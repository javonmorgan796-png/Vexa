import React, { useState } from 'react';
import { AlertTriangle, Check, Copy, User, Building2, CreditCard, FileText } from 'lucide-react';

export interface InsufficientFundsModalProps {
  isOpen: boolean;
  onClose: () => void;
  amount: number | string;
  action?: string; // e.g. "buy airtime", "buy data", "complete transfer", "pay bills"
  accountNumber?: string;
  accountName?: string;
  bankName?: string;
  onShareAccount?: () => void;
}

export function InsufficientFundsModal({
  isOpen,
  onClose,
  amount,
  action = 'complete this transaction',
  accountNumber = '9067212032',
  accountName = 'CHIBUZOR EMMANUEL DIKE',
  bankName = 'Moniepoint MFB',
  onShareAccount,
}: InsufficientFundsModalProps) {
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);

  if (!isOpen) return null;

  const rawNum = typeof amount === 'number' ? amount : parseFloat(String(amount).replace(/,/g, '') || '0');
  const formattedAmount = isNaN(rawNum) ? '0' : rawNum.toLocaleString('en-NG');

  const handleCopyAccount = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(accountNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareDetails = (e: React.MouseEvent) => {
    e.stopPropagation();
    const shareText = `Account details:\nAccount Number: ${accountNumber}\nAccount Name: ${accountName}\nBank Name: ${bankName}`;
    if (navigator.share) {
      navigator.share({
        title: 'My Bank Account Details',
        text: shareText,
      }).catch(() => {
        // Fallback to clipboard
        navigator.clipboard?.writeText(shareText);
        setShared(true);
        setTimeout(() => setShared(false), 2000);
      });
    } else {
      navigator.clipboard?.writeText(shareText);
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    }
    if (onShareAccount) onShareAccount();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex flex-col justify-end animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#181A20] rounded-t-[28px] max-w-lg mx-auto w-full px-6 pt-3 pb-8 shadow-2xl animate-in slide-in-from-bottom duration-300 text-[#111] dark:text-[#EAECEF] border-t border-gray-100 dark:border-[#2B313A]"
        style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Handle / Pull Indicator */}
        <div className="w-12 h-1 bg-gray-300 dark:bg-gray-600 rounded-full mx-auto mt-1 mb-6" />

        {/* Concentric Amber Warning Badge matching reference image */}
        <div className="w-16 h-16 rounded-full bg-[#FEF3C7] dark:bg-amber-950/60 flex items-center justify-center mx-auto mb-4 p-1.5 ring-4 ring-amber-100/60 dark:ring-amber-900/30">
          <div className="w-11 h-11 rounded-full bg-[#F59E0B] flex items-center justify-center shadow-sm">
            <AlertTriangle className="w-5 h-5 text-white stroke-[2.8]" />
          </div>
        </div>

        {/* Title */}
        <h3 className="text-[22px] font-bold text-gray-900 dark:text-white text-center mb-2 tracking-tight">
          Insufficient funds
        </h3>

        {/* Subtitle with dynamic action and amount */}
        <p className="text-[14px] text-gray-600 dark:text-gray-300 text-center leading-relaxed max-w-sm mx-auto mb-6">
          You need at least <span className="font-extrabold text-gray-900 dark:text-white">₦{formattedAmount}</span> in your account to {action}. Please fund your account.
        </p>

        {/* Detailed Breakdown Rows */}
        <div className="space-y-4 mb-7 text-[13.5px]">
          {/* Row 1: Account Number */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
              <span className="text-gray-400 dark:text-gray-500 font-bold text-[15px] w-4 text-center">#</span>
              <span>Account number:</span>
            </div>
            <button
              type="button"
              onClick={handleCopyAccount}
              className="flex items-center gap-1.5 text-[#2563EB] dark:text-[#3B82F6] font-bold font-mono text-[15px] hover:opacity-85 active:scale-95 transition-all"
              title="Click to copy account number"
            >
              <span>{accountNumber}</span>
              {copied ? (
                <span className="text-xs font-sans text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.5 rounded">
                  Copied!
                </span>
              ) : (
                <Copy className="w-4 h-4 fill-current stroke-none" />
              )}
            </button>
          </div>

          {/* Row 2: Account Name */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
              <User className="w-4 h-4 text-gray-400 dark:text-gray-500" />
              <span>Account name:</span>
            </div>
            <span className="font-bold text-gray-900 dark:text-white uppercase tracking-wide text-right truncate max-w-[62%]">
              {accountName}
            </span>
          </div>

          {/* Row 3: Bank Name */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
              <Building2 className="w-4 h-4 text-gray-400 dark:text-gray-500" />
              <span>Bank name:</span>
            </div>
            <span className="font-bold text-gray-900 dark:text-white text-right">
              {bankName}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-1">
          <button
            type="button"
            onClick={handleShareDetails}
            className="w-full py-3.5 px-4 rounded-xl bg-[#EFF6FF] dark:bg-blue-950/50 text-[#2563EB] dark:text-[#60A5FA] font-bold text-[15px] hover:bg-blue-100 dark:hover:bg-blue-900/60 active:scale-[0.99] transition-all text-center"
          >
            {shared ? 'Account Details Copied!' : 'Share Account Details'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 text-[#2563EB] dark:text-[#60A5FA] font-semibold text-[15px] hover:opacity-80 active:scale-95 transition-all text-center"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}

export interface TransferSuccessfulModalProps {
  isOpen: boolean;
  onClose: () => void;
  onViewReceipt: () => void;
  amount: number | string;
  recipientName: string;
  recipientAccount: string;
  recipientBank: string;
  reference?: string;
}

export function TransferSuccessfulModal({
  isOpen,
  onClose,
  onViewReceipt,
  amount,
  recipientName,
  recipientAccount,
  recipientBank,
  reference,
}: TransferSuccessfulModalProps) {
  const [copiedAccount, setCopiedAccount] = useState(false);
  const [copiedRef, setCopiedRef] = useState(false);

  if (!isOpen) return null;

  const rawNum = typeof amount === 'number' ? amount : parseFloat(String(amount).replace(/,/g, '') || '0');
  const formattedAmount = isNaN(rawNum) ? '0.00' : rawNum.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const cleanRef = reference || `TXN${Date.now().toString().slice(-8)}`;

  const handleCopyAccount = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(recipientAccount);
    setCopiedAccount(true);
    setTimeout(() => setCopiedAccount(false), 2000);
  };

  const handleCopyRef = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(cleanRef);
    setCopiedRef(true);
    setTimeout(() => setCopiedRef(false), 2000);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex flex-col justify-end animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#181A20] rounded-t-[28px] max-w-lg mx-auto w-full px-6 pt-3 pb-8 shadow-2xl animate-in slide-in-from-bottom duration-300 text-[#111] dark:text-[#EAECEF] border-t border-gray-100 dark:border-[#2B313A]"
        style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Handle / Pull Indicator */}
        <div className="w-12 h-1 bg-gray-300 dark:bg-gray-600 rounded-full mx-auto mt-1 mb-6" />

        {/* Concentric Emerald Success Badge matching reference style */}
        <div className="w-16 h-16 rounded-full bg-[#D1FAE5] dark:bg-emerald-950/60 flex items-center justify-center mx-auto mb-4 p-1.5 ring-4 ring-emerald-100/60 dark:ring-emerald-900/30">
          <div className="w-11 h-11 rounded-full bg-[#10B981] flex items-center justify-center shadow-sm">
            <Check className="w-6 h-6 text-white stroke-[3.5]" />
          </div>
        </div>

        {/* Title */}
        <h3 className="text-[22px] font-bold text-gray-900 dark:text-white text-center mb-2 tracking-tight">
          Transfer successful
        </h3>

        {/* Subtitle */}
        <p className="text-[14px] text-gray-600 dark:text-gray-300 text-center leading-relaxed max-w-sm mx-auto mb-6">
          <span className="font-extrabold text-gray-900 dark:text-white">₦{formattedAmount}</span> has been successfully sent to{' '}
          <span className="font-bold text-gray-900 dark:text-white">{recipientName}</span>.
        </p>

        {/* Detailed Breakdown Rows */}
        <div className="space-y-3.5 mb-7 text-[13.5px]">
          {/* Recipient Account */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
              <span className="text-gray-400 dark:text-gray-500 font-bold text-[15px] w-4 text-center">#</span>
              <span>Recipient account:</span>
            </div>
            <button
              type="button"
              onClick={handleCopyAccount}
              className="flex items-center gap-1.5 text-[#2563EB] dark:text-[#3B82F6] font-bold font-mono text-[14.5px] hover:opacity-85 active:scale-95 transition-all"
              title="Click to copy recipient account"
            >
              <span>{recipientAccount}</span>
              {copiedAccount ? (
                <span className="text-xs font-sans text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.5 rounded">
                  Copied!
                </span>
              ) : (
                <Copy className="w-4 h-4 fill-current stroke-none" />
              )}
            </button>
          </div>

          {/* Recipient Name */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
              <User className="w-4 h-4 text-gray-400 dark:text-gray-500" />
              <span>Recipient name:</span>
            </div>
            <span className="font-bold text-gray-900 dark:text-white uppercase tracking-wide text-right truncate max-w-[62%]">
              {recipientName}
            </span>
          </div>

          {/* Bank Name */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
              <Building2 className="w-4 h-4 text-gray-400 dark:text-gray-500" />
              <span>Bank name:</span>
            </div>
            <span className="font-bold text-gray-900 dark:text-white text-right">
              {recipientBank}
            </span>
          </div>

          {/* Amount Sent */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
              <CreditCard className="w-4 h-4 text-gray-400 dark:text-gray-500" />
              <span>Amount sent:</span>
            </div>
            <span className="font-bold text-gray-900 dark:text-white text-right">
              ₦{formattedAmount}
            </span>
          </div>

          {/* Reference */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
              <FileText className="w-4 h-4 text-gray-400 dark:text-gray-500" />
              <span>Reference:</span>
            </div>
            <button
              type="button"
              onClick={handleCopyRef}
              className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300 font-mono text-[12.5px] hover:text-[#2563EB] dark:hover:text-[#3B82F6] transition-colors"
              title="Click to copy transaction reference"
            >
              <span>{cleanRef}</span>
              {copiedRef ? (
                <span className="text-xs font-sans text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/50 px-1 py-0.2 rounded">
                  Copied!
                </span>
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-1">
          <button
            type="button"
            onClick={onViewReceipt}
            className="w-full py-3.5 px-4 rounded-xl bg-[#EFF6FF] dark:bg-blue-950/50 text-[#2563EB] dark:text-[#60A5FA] font-bold text-[15px] hover:bg-blue-100 dark:hover:bg-blue-900/60 active:scale-[0.99] transition-all text-center"
          >
            View Receipt
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 text-[#2563EB] dark:text-[#60A5FA] font-semibold text-[15px] hover:opacity-80 active:scale-95 transition-all text-center"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
