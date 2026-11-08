import React, { useState } from 'react';
import {
  CheckCircle2,
  Copy,
  Check,
  Share2,
  ArrowDownToLine,
  Printer,
  ChevronLeft,
  ShieldCheck,
  RotateCcw,
} from 'lucide-react';
import { BankLogoBadge } from '@/components/BankLogoBadge';
import { TransferReceiptData, formatReceiptDate, formatReceiptTime } from '@/App';

interface BankingTransferReceiptProps {
  receipt: TransferReceiptData;
  onHome: () => void;
  onTransferAgain?: () => void;
  createReceiptImageFn: (receipt: TransferReceiptData, reference: string) => Promise<File>;
}

export function BankingTransferReceipt({
  receipt,
  onHome,
  onTransferAgain,
  createReceiptImageFn,
}: BankingTransferReceiptProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<'share' | 'download' | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState('');

  const { transaction, recipientName, bank, accountNumber, senderName, senderAccountNumber } = receipt;

  // Authentic 12-char reference and 30-digit NIBSS NIP Session ID
  const cleanId = transaction.id.replace(/-/g, '').toUpperCase();
  const reference = `VX${cleanId.slice(0, 10)}`;
  const sessionId = `9990${cleanId.slice(0, 8)}20261108${cleanId.slice(8, 18).padEnd(10, '7')}`;

  const amountValue = Number(transaction.raw_amount) || Number(transaction.amount.replace(/,/g, '')) || 0;
  const feeValue = transaction.fee !== undefined ? transaction.fee : (bank.toLowerCase().includes('vexa') ? 0 : 10.75);
  const totalDebit = amountValue + (feeValue > 0 ? feeValue : 0);

  const formattedAmount = amountValue.toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const formattedFee = feeValue > 0
    ? `₦${feeValue.toFixed(2)}`
    : '₦0.00 (Waived)';
  const formattedTotal = totalDebit.toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      // ignore
    }
  };

  const handleShare = async () => {
    setBusyAction('share');
    setFeedbackMessage('');
    try {
      const file = await createReceiptImageFn(receipt, reference);
      if (navigator.share) {
        await navigator.share({
          title: 'Vexa Transfer Receipt',
          text: `Transfer of ₦${formattedAmount} to ${recipientName} (${bank}) was successful. Reference: ${reference}`,
          files: [file],
        });
      } else {
        const url = URL.createObjectURL(file);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        setFeedbackMessage('Receipt image saved to your device.');
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        setFeedbackMessage('Could not share receipt. You can download or print it.');
      }
    } finally {
      setBusyAction(null);
    }
  };

  const handleDownload = async () => {
    setBusyAction('download');
    setFeedbackMessage('');
    try {
      const file = await createReceiptImageFn(receipt, reference);
      const url = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setFeedbackMessage('Receipt downloaded successfully.');
    } catch {
      setFeedbackMessage('Could not download receipt.');
    } finally {
      setBusyAction(null);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-[#F4F6F9] flex flex-col w-full max-w-full overflow-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .printable-receipt, .printable-receipt * { visibility: visible !important; }
          .printable-receipt {
            position: absolute !important;
            inset: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 24px !important;
            box-shadow: none !important;
            background: white !important;
          }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* Top Navigation Bar */}
      <div
        className="no-print flex-none flex items-center justify-between px-4 pb-3 bg-white w-full shadow-xs"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}
      >
        <button
          onClick={onHome}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors text-slate-700"
          aria-label="Back to home"
        >
          <ChevronLeft className="w-5 h-5" strokeWidth={2.5} />
        </button>
        <div className="text-center">
          <p className="text-[16px] font-bold text-[#111]">Transaction Receipt</p>
          <p className="text-[11px] font-medium text-[#16A34A] flex items-center justify-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A] animate-pulse" />
            NIP Instant Transfer · Settled
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handlePrint}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors text-slate-700"
            title="Print receipt"
            aria-label="Print receipt"
          >
            <Printer className="w-4 h-4" />
          </button>
          <button
            onClick={handleShare}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors text-slate-700"
            title="Share receipt"
            aria-label="Share receipt"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Scrollable Receipt Area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden w-full max-w-full px-4 py-5 space-y-4" style={{ scrollbarWidth: 'none' }}>
        <div className="max-w-md mx-auto">

          {/* Official Bank Receipt Card */}
          <div className="printable-receipt bg-white rounded-3xl shadow-md border-0 p-6 relative overflow-hidden">
            {/* Watermark Logo in Background */}
            <div className="absolute right-[-20px] top-[-20px] opacity-[0.03] pointer-events-none select-none">
              <svg width="260" height="260" viewBox="0 0 100 100" fill="none">
                <circle cx="50" cy="50" r="45" stroke="#162353" strokeWidth="6" />
                <path d="M30 35L50 65L70 35" stroke="#162353" strokeWidth="8" strokeLinecap="round" />
              </svg>
            </div>

            {/* Receipt Header Banner */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#162353] flex items-center justify-center shadow-xs">
                  <span className="text-white font-extrabold text-[15px] tracking-wider">V</span>
                </div>
                <div>
                  <p className="text-[14px] font-extrabold text-[#162353] tracking-tight leading-none">VEXA BANK</p>
                  <p className="text-[9.5px] font-semibold text-slate-400 uppercase tracking-widest mt-0.5">
                    Licensed by the CBN · NDIC Insured
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 uppercase tracking-wider border border-emerald-100">
                Official
              </span>
            </div>

            {/* Central Success & Hero Amount */}
            <div className="text-center my-6">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 mb-3 shadow-xs">
                <CheckCircle2 className="w-8 h-8 stroke-[2.2]" />
              </div>
              <p className="text-[13px] font-bold uppercase tracking-wider text-emerald-600">
                Transfer Successful
              </p>
              <p className="text-[36px] font-black text-[#111] tracking-tight leading-none mt-1.5 flex items-baseline justify-center">
                <span className="text-[26px] font-extrabold mr-1">₦</span>
                {formattedAmount}
              </p>
              <p className="text-[11.5px] font-medium text-slate-500 mt-2">
                {formatReceiptDate(transaction)} at {formatReceiptTime(transaction)}
              </p>
            </div>

            {/* Perforated Notches and Divider */}
            <div className="relative my-6 -mx-6 flex items-center">
              <div className="w-4 h-8 bg-[#F4F6F9] rounded-r-full shadow-inner" />
              <div className="flex-1 border-t-2 border-dashed border-slate-200 mx-2" />
              <div className="w-4 h-8 bg-[#F4F6F9] rounded-l-full shadow-inner" />
            </div>

            {/* Transaction Breakdown Rows */}
            <div className="space-y-3.5 text-[13px]">
              {/* Recipient Details */}
              <div className="flex items-start justify-between gap-3">
                <span className="text-slate-500 shrink-0">Recipient Name</span>
                <span className="font-bold text-[#111] text-right uppercase break-words max-w-[65%]">
                  {recipientName}
                </span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500 shrink-0">Recipient Bank</span>
                <div className="flex items-center gap-1.5 font-bold text-[#111]">
                  <BankLogoBadge bankName={bank} size="sm" />
                  <span>{bank}</span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500 shrink-0">Account Number</span>
                <span className="font-mono font-bold text-[#111] tracking-wider text-[13.5px]">
                  {accountNumber}
                </span>
              </div>

              {/* Sender Details */}
              <div className="pt-2 border-t border-slate-100" />

              <div className="flex items-start justify-between gap-3">
                <span className="text-slate-500 shrink-0">Sender Name</span>
                <span className="font-bold text-[#111] text-right uppercase break-words max-w-[65%]">
                  {senderName || 'Account Holder'}
                </span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500 shrink-0">Sender Account</span>
                <span className="font-mono font-medium text-slate-700">
                  Vexa · {senderAccountNumber || 'Main Wallet'}
                </span>
              </div>

              {/* Financials */}
              <div className="pt-2 border-t border-slate-100" />

              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500 shrink-0">Transfer Amount</span>
                <span className="font-semibold text-slate-800">₦{formattedAmount}</span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500 shrink-0">Transaction Fee</span>
                <span className="font-semibold text-slate-800">{formattedFee}</span>
              </div>

              <div className="flex items-center justify-between gap-3 pt-1 border-t border-slate-100">
                <span className="font-bold text-slate-800">Total Debit</span>
                <span className="text-[15px] font-black text-[#162353]">₦{formattedTotal}</span>
              </div>

              {/* Network Audit & Identifiers */}
              <div className="pt-2 border-t border-slate-100" />

              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500 shrink-0">Payment Type</span>
                <span className="font-semibold text-slate-800">NIP Electronic Transfer</span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500 shrink-0">Reference</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(reference, 'ref')}
                  className="inline-flex items-center gap-1 font-mono font-bold text-[#162353] hover:text-[#2563EB] transition-colors"
                  title="Copy reference"
                >
                  <span>{reference}</span>
                  {copiedKey === 'ref' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-slate-400" />
                  )}
                </button>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500 shrink-0">Session ID</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(sessionId, 'session')}
                  className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-slate-700 hover:text-[#162353] transition-colors max-w-[65%]"
                  title="Copy session ID"
                >
                  <span className="truncate">{sessionId}</span>
                  {copiedKey === 'session' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  )}
                </button>
              </div>

              <div className="flex items-start justify-between gap-3">
                <span className="text-slate-500 shrink-0">Remark / Narration</span>
                <span className="font-medium text-slate-800 text-right max-w-[65%] break-words">
                  {transaction.note || `Transfer to ${recipientName}`}
                </span>
              </div>

              <div className="flex items-center justify-between gap-3 pt-1">
                <span className="text-slate-500 shrink-0">Status</span>
                <span className="inline-flex items-center gap-1 font-bold text-emerald-600 text-[12px] bg-emerald-50 px-2.5 py-0.5 rounded-full">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  COMPLETED
                </span>
              </div>
            </div>

            {/* Official Legal Footer */}
            <div className="mt-7 pt-4 border-t border-slate-100 text-center">
              <div className="flex items-center justify-center gap-1.5 text-slate-400 text-[11px] font-semibold uppercase tracking-wider mb-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>NIBSS Instant Payment Guaranteed</span>
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed max-w-xs mx-auto">
                Generated by Vexa Core Banking System. This document serves as legal proof of payment transmitted through the Central Clearing House.
              </p>
            </div>
          </div>

          {/* Feedback message */}
          {feedbackMessage && (
            <p className="no-print text-center text-[12px] font-semibold text-emerald-600 bg-emerald-50 py-2 px-3 rounded-xl mt-3 animate-in fade-in">
              {feedbackMessage}
            </p>
          )}

          {/* Bottom Action Buttons */}
          <div className="no-print mt-5 space-y-2.5">
            <button
              type="button"
              onClick={handleShare}
              disabled={busyAction !== null}
              className="w-full h-[52px] rounded-2xl bg-[#162353] hover:bg-[#111c43] active:bg-[#0c1432] text-white font-bold text-[15px] shadow-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              <Share2 className="w-4 h-4" />
              <span>{busyAction === 'share' ? 'Preparing Receipt…' : 'Share Receipt'}</span>
            </button>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={handleDownload}
                disabled={busyAction !== null}
                className="h-[48px] rounded-2xl bg-white border-0 shadow-sm text-slate-800 font-bold text-[14px] hover:bg-slate-50 flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <ArrowDownToLine className="w-4 h-4 text-slate-600" />
                <span>{busyAction === 'download' ? 'Saving…' : 'Save PDF'}</span>
              </button>

              {onTransferAgain ? (
                <button
                  type="button"
                  onClick={onTransferAgain}
                  className="h-[48px] rounded-2xl bg-white border-0 shadow-sm text-[#162353] font-bold text-[14px] hover:bg-slate-50 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <RotateCcw className="w-4 h-4 text-[#162353]" />
                  <span>Send Again</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onHome}
                  className="h-[48px] rounded-2xl bg-white border-0 shadow-sm text-slate-700 font-bold text-[14px] hover:bg-slate-50 flex items-center justify-center transition-colors"
                >
                  Done
                </button>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
