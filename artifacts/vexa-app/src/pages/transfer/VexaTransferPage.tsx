import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  Camera,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  QrCode,
  ScanLine,
  Send,
  Share2,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useLocation } from 'wouter';
import { useAuth } from '@/context/AuthContext';
import { useUserData } from '@/context/UserDataContext';
import { useVexaFinance } from '@/context/VexaFinanceContext';

type TransferMode = 'scan' | 'my-qr';
type TransferStep = 'amount' | 'pin';

interface BarcodeResult {
  rawValue: string;
}

interface BarcodeDetectorInstance {
  detect(source: HTMLVideoElement): Promise<BarcodeResult[]>;
}

interface BarcodeDetectorConstructor {
  new (options?: { formats: string[] }): BarcodeDetectorInstance;
}

function getBarcodeDetector() {
  return (window as typeof window & { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
}

function createVexaQrValue(accountNumber: string, name: string) {
  const params = new URLSearchParams({ account: accountNumber, name });
  return `vexa://transfer?${params.toString()}`;
}

interface ParsedVexaRecipient {
  account: string;
  name: string;
}

function parseVexaRecipient(value: string): ParsedVexaRecipient | null {
  const trimmed = value.trim();
  if (/^\d{10}$/.test(trimmed)) return { account: trimmed, name: '' };

  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'vexa:') return null;
    const account = url.searchParams.get('account') ?? '';
    const name = url.searchParams.get('name')?.trim() ?? '';
    return /^\d{10}$/.test(account) ? { account, name } : null;
  } catch {
    try {
      const parsed = JSON.parse(trimmed) as { account?: unknown; accountNumber?: unknown; name?: unknown };
      const account = String(parsed.account ?? parsed.accountNumber ?? '');
      const name = typeof parsed.name === 'string' ? parsed.name.trim() : '';
      return /^\d{10}$/.test(account) ? { account, name } : null;
    } catch {
      return null;
    }
  }
}

export default function VexaTransferPage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { refreshAll } = useUserData();
  const { transferVexaMoney } = useVexaFinance();
  const [mode, setMode] = useState<TransferMode>(() =>
    new URLSearchParams(window.location.search).get('mode') === 'my-qr' ? 'my-qr' : 'scan'
  );
  const [accountNumber, setAccountNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [pinDigits, setPinDigits] = useState(['', '', '', '']);
  const pin = pinDigits.join('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<{ name: string; amount: number } | null>(null);
  const [scannerActive, setScannerActive] = useState(false);
  const [scannerError, setScannerError] = useState('');
  const [scanMessage, setScanMessage] = useState('');
  const [scanComplete, setScanComplete] = useState(false);
  const [recipientName, setRecipientName] = useState('');
  const [transferStep, setTransferStep] = useState<TransferStep>('amount');
  const [copied, setCopied] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<number | null>(null);
  const pinInputsRef = useRef<Array<HTMLInputElement | null>>([]);

  const stopCamera = () => {
    if (scanTimerRef.current !== null) {
      window.clearTimeout(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setScannerActive(false);
  };

  useEffect(() => () => stopCamera(), []);

  const startCamera = async () => {
    const Detector = getBarcodeDetector();
    if (!navigator.mediaDevices?.getUserMedia) {
      setScannerError('Camera access is not available here. Enter the 10-digit account number below instead.');
      return;
    }

    setScannerError('');
    setScanMessage('');
    setScanComplete(false);
    setRecipientName('');
    setTransferStep('amount');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = stream;
      if (!videoRef.current) {
        stopCamera();
        return;
      }
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setScannerActive(true);
      if (!Detector) {
        setScannerError('Camera started, but automatic QR reading is not supported in this browser. Enter the 10-digit account number below instead.');
        return;
      }
      const detector = new Detector({ formats: ['qr_code'] });

      const scanFrame = async () => {
        if (!streamRef.current || !videoRef.current) return;
        try {
          const results = await detector.detect(videoRef.current);
          const recipient = results.map(result => parseVexaRecipient(result.rawValue)).find(Boolean);
          if (recipient) {
            setAccountNumber(recipient.account);
            setRecipientName(recipient.name);
            setScanMessage(
              recipient.name
                ? 'QR code found. Confirm the recipient details, then enter the amount below.'
                : 'QR code found. Confirm the account number, then enter the amount below.',
            );
            setScanComplete(true);
            stopCamera();
            return;
          }
        } catch {
          // Keep the camera open; a frame can be unavailable while the camera starts.
        }
        if (streamRef.current) scanTimerRef.current = window.setTimeout(() => void scanFrame(), 250);
      };

      void scanFrame();
    } catch {
      setScannerError('Camera permission was not granted. You can still enter a Vexa account number manually.');
      stopCamera();
    }
  };

  const copyMyQrDetails = async () => {
    if (!user?.accountNumber) return;
    try {
      await navigator.clipboard.writeText(user.accountNumber);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setScannerError('Copy is not available on this device. Your account number is shown below the QR code.');
    }
  };

  const shareMyQr = async () => {
    if (!user?.accountNumber) return;
    const text = `Send me money on Vexa. My Vexa account number is ${user.accountNumber}.`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'My Vexa account', text });
        return;
      } catch {
        // Sharing was cancelled or is unavailable; copying is the fallback.
      }
    }
    await copyMyQrDetails();
  };

  const submit = async () => {
    const numericAmount = Number(amount.replace(/,/g, ''));
    if (!/^\d{10}$/.test(accountNumber)) return setError('Enter or scan the recipient’s 10-digit Vexa account number');
    if (!numericAmount || numericAmount <= 0) return setError('Enter a valid amount');
    if (accountNumber === user?.accountNumber) return setError('You cannot transfer to your own account');
    if (user?.pin === '0000') return setError('Set your transaction PIN in Settings before sending money');
    if (pin.length !== 4) return setError('Enter your 4-digit transaction PIN');
    setBusy(true);
    setError('');
    const result = await transferVexaMoney(accountNumber, numericAmount, note, pin);
    setBusy(false);
    if (!result.success) return setError(result.error ?? 'Transfer failed');
    await refreshAll();
    setSuccess({ name: result.recipientName ?? 'Vexa user', amount: numericAmount });
  };

  const continueToPin = () => {
    const numericAmount = Number(amount.replace(/,/g, ''));
    if (!numericAmount || numericAmount <= 0) {
      setError('Enter a valid amount before continuing');
      return;
    }
    setError('');
    setPinDigits(['', '', '', '']);
    setTransferStep('pin');
  };

  const handlePinChange = (index: number, value: string) => {
    const digits = value.replace(/\D/g, '');
    if (!digits) {
      const nextPin = [...pinDigits];
      nextPin[index] = '';
      setPinDigits(nextPin);
      setError('');
      return;
    }

    const nextPin = [...pinDigits];
    nextPin[index] = digits.slice(-1);
    setPinDigits(nextPin);
    setError('');
    if (index < 3) pinInputsRef.current[index + 1]?.focus();
  };

  const handlePinKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace' && !pinDigits[index] && index > 0) {
      pinInputsRef.current[index - 1]?.focus();
    }
  };

  const handlePinPaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const digits = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
    if (!digits) return;
    const nextPin = ['', '', '', ''];
    digits.split('').forEach((digit, index) => { nextPin[index] = digit; });
    setPinDigits(nextPin);
    setError('');
    pinInputsRef.current[Math.min(digits.length, 4) - 1]?.focus();
  };

  const resetScan = () => {
    stopCamera();
    setAccountNumber('');
    setAmount('');
    setNote('');
    setPinDigits(['', '', '', '']);
    setRecipientName('');
    setError('');
    setScannerError('');
    setScanMessage('');
    setScanComplete(false);
    setTransferStep('amount');
  };

  if (success) {
    return (
      <div className="fixed inset-0 bg-[#F2F3F5] flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>
        <div className="flex-none flex items-center gap-3 px-4 pb-3 bg-white border-b border-[#E8EBF0]" style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}>
          <button onClick={() => navigate('/')} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"><ChevronLeft className="w-5 h-5" /></button>
          <span className="text-[16px] font-bold text-[#111]">Transfer complete</span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <CheckCircle2 className="w-16 h-16 text-[#16A34A]" />
          <p className="text-[22px] font-extrabold text-[#111] mt-5">Money sent</p>
          <p className="text-[14px] text-[#666] mt-2">₦{success.amount.toLocaleString('en-NG', { minimumFractionDigits: 2 })} was delivered to {success.name}.</p>
          <button onClick={() => { setSuccess(null); setAccountNumber(''); setAmount(''); setNote(''); setPinDigits(['', '', '', '']); setScanMessage(''); setRecipientName(''); setTransferStep('amount'); }} className="w-full max-w-sm mt-8 rounded-xl bg-[#162353] text-white py-3.5 text-[13px] font-bold">Send another transfer</button>
          <button onClick={() => navigate('/')} className="mt-3 text-[#2563EB] text-[13px] font-semibold">Back to home</button>
        </div>
      </div>
    );
  }

  const myQrValue = user?.accountNumber ? createVexaQrValue(user.accountNumber, user.name) : '';

  if (mode === 'scan' && !scanComplete) {
    return (
      <div className="fixed inset-0 bg-[#F2F3F5] text-[#111] flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>
        <div className="flex-none flex items-center gap-3 px-5 pb-4" style={{ paddingTop: 'max(env(safe-area-inset-top), 16px)' }}>
          <button onClick={() => { stopCamera(); navigate('/transfer'); }} className="w-10 h-10 flex items-center justify-center rounded-full bg-white hover:bg-[#E8EDF1]" aria-label="Back to transfer">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <p className="text-[17px] font-bold">Scan Vexa QR</p>
            <p className="text-[11px] text-[#64748B]">Scan to start your transfer</p>
          </div>
          <button
            onClick={() => { stopCamera(); setMode('my-qr'); }}
            className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-2 text-[11px] font-bold text-[#162353] shadow-sm hover:bg-[#E8EDF1]"
          >
            <QrCode className="w-3.5 h-3.5" /> My QR code
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-5 pb-8">
          <div className="w-full max-w-md aspect-square rounded-[28px] overflow-hidden bg-[#E7EEF2] relative flex items-center justify-center shadow-2xl">
            <video
              ref={videoRef}
              muted
              playsInline
              className={`absolute inset-0 w-full h-full object-cover transition-opacity ${scannerActive ? 'opacity-100' : 'opacity-0'}`}
            />
            {scannerActive ? (
              <>
                <div className="absolute inset-[12%] border-2 border-[#8BE3FF] rounded-[24px] shadow-[0_0_0_999px_rgba(11,18,43,0.55)]" />
                <div className="vexa-scan-line absolute left-[18%] right-[18%] h-0.5 bg-[#8BE3FF] shadow-[0_0_14px_#8BE3FF]" />
                <p className="absolute bottom-5 left-0 right-0 text-center text-[12px] font-semibold text-white">Point the camera at the QR code</p>
              </>
            ) : (
              <div className="relative z-10 flex flex-col items-center text-center px-8">
                <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center mb-4"><Camera className="w-8 h-8 text-[#8BE3FF]" /></div>
                <p className="text-[15px] font-bold text-[#162353]">Ready to scan</p>
                <p className="text-[12px] text-[#64748B] mt-2 leading-relaxed">Center the recipient’s Vexa QR code inside the frame.</p>
                <button onClick={() => void startCamera()} className="mt-5 rounded-xl bg-[#162353] text-white px-5 py-3 text-[12px] font-bold">Start camera</button>
              </div>
            )}
          </div>

          <p className="text-[12px] text-[#64748B] text-center mt-5 max-w-sm">Only a Vexa QR code containing a valid account number can continue.</p>
          {scannerError && (
            <div className="w-full max-w-md mt-4 rounded-xl bg-red-400/10 border border-red-300/20 px-4 py-3 text-[11px] leading-relaxed text-red-100">
              {scannerError}
              <label className="block mt-3">
                <span className="block text-white/70 mb-1.5">Enter the account number instead</span>
                <input
                  value={accountNumber}
                  onChange={e => setAccountNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  inputMode="numeric"
                  placeholder="10-digit Vexa account"
                  className="w-full rounded-lg bg-white text-[#111] px-3 py-2.5 text-[14px] tracking-[0.12em] outline-none"
                />
                {accountNumber.length === 10 && (
                  <button onClick={() => setScanComplete(true)} className="mt-2 rounded-lg bg-white text-[#162353] px-3 py-2 text-[11px] font-bold">
                    Continue with account
                  </button>
                )}
              </label>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-[#F2F3F5] flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="flex-none flex items-center gap-3 px-4 pb-3 bg-white border-b border-[#E8EBF0]" style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}>
        <button onClick={() => { stopCamera(); navigate('/transfer'); }} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"><ChevronLeft className="w-5 h-5" /></button>
        <span className="text-[16px] font-bold text-[#111]">Vexa to Vexa</span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4" style={{ scrollbarWidth: 'none' }}>
        <div className="rounded-2xl bg-[#162353] text-white p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center"><ArrowLeftRight className="w-5 h-5 text-[#8BE3FF]" /></div>
            <div><p className="text-[14px] font-bold">Instant Vexa transfer</p><p className="text-[11px] text-white/60 mt-0.5">No fee · settles directly to their balance</p></div>
          </div>
          <p className="text-[11px] leading-relaxed text-white/65 mt-4">Scan the recipient’s Vexa QR code or enter their account number. The transfer is only sent after you confirm the amount and PIN.</p>
        </div>

        <div className="bg-white rounded-2xl border border-[#E8EBF0] p-1.5 flex gap-1">
          <button onClick={() => { stopCamera(); setMode('scan'); }} className={`flex-1 rounded-xl py-3 text-[12px] font-bold flex items-center justify-center gap-2 ${mode === 'scan' ? 'bg-[#162353] text-white' : 'text-[#64748B]'}`}>
            <ScanLine className="w-4 h-4" /> Scan QR
          </button>
          <button onClick={() => { stopCamera(); setMode('my-qr'); setScannerError(''); }} className={`flex-1 rounded-xl py-3 text-[12px] font-bold flex items-center justify-center gap-2 ${mode === 'my-qr' ? 'bg-[#162353] text-white' : 'text-[#64748B]'}`}>
            <QrCode className="w-4 h-4" /> My QR code
          </button>
        </div>

        {mode === 'scan' ? (
          <>
            <div className="bg-white rounded-2xl border border-[#F0F0F0] p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-[#EAF8FC] flex items-center justify-center shrink-0"><Check className="w-5 h-5 text-[#0E7490]" /></div>
                  <div className="min-w-0">
                    <p className="text-[11px] text-[#64748B]">Recipient full name</p>
                    <p className="text-[15px] font-bold text-[#111] truncate">{recipientName || 'Name not provided'}</p>
                    <p className="text-[11px] tracking-[0.12em] text-[#64748B] mt-0.5">Account {accountNumber}</p>
                  </div>
                </div>
                <button onClick={resetScan} className="shrink-0 text-[11px] font-bold text-[#2563EB]">Scan again</button>
              </div>
              {scanMessage && <p className="mt-3 text-[11px] leading-relaxed text-[#166534]">{scanMessage}</p>}
            </div>
          </>
        ) : (
          <div className="bg-white rounded-2xl border border-[#F0F0F0] p-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#EAF2FF] flex items-center justify-center shrink-0"><QrCode className="w-5 h-5 text-[#2563EB]" /></div>
              <div><p className="text-[14px] font-bold text-[#111]">Your Vexa QR code</p><p className="text-[11px] text-[#888] mt-1 leading-relaxed">Show this code to another Vexa user so they can scan it and send money to you.</p></div>
            </div>
            {myQrValue ? (
              <div className="mt-5 flex flex-col items-center">
                <div className="inline-flex rounded-2xl bg-white p-4 border border-[#E8EBF0]"><QRCodeSVG value={myQrValue} size={220} includeMargin fgColor="#162353" /></div>
                <p className="text-[15px] font-bold text-[#111] mt-4">{user?.name}</p>
                <p className="text-[13px] tracking-[0.14em] text-[#64748B] mt-1">{user?.accountNumber}</p>
                <div className="flex gap-2 mt-4 w-full">
                  <button onClick={() => void copyMyQrDetails()} className="flex-1 rounded-xl border border-[#DCE3EE] py-3 text-[12px] font-bold text-[#162353] flex items-center justify-center gap-2">{copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}{copied ? 'Copied' : 'Copy number'}</button>
                  <button onClick={() => void shareMyQr()} className="flex-1 rounded-xl bg-[#162353] py-3 text-[12px] font-bold text-white flex items-center justify-center gap-2"><Share2 className="w-4 h-4" /> Share QR</button>
                </div>
              </div>
            ) : <p className="mt-5 text-[12px] text-[#888]">Your Vexa account number is not available yet.</p>}
          </div>
        )}

        {error && <div className="rounded-2xl bg-red-50 border border-red-200 px-4 py-3 text-[12px] text-red-600">{error}</div>}

        {mode === 'scan' && scanComplete && (
          transferStep === 'amount' ? (
            <div className="bg-white rounded-2xl border border-[#F0F0F0] p-5 space-y-4">
              <div>
                <p className="text-[14px] font-bold text-[#111]">How much do you want to send?</p>
                <p className="text-[11px] text-[#888] mt-1">Enter the amount for {recipientName || 'this Vexa account'}.</p>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#555] mb-1.5">Amount</label>
                <div className="flex items-center border border-[#E0E0E0] rounded-xl px-4 focus-within:border-[#162353]">
                  <span className="text-[18px] font-bold text-[#555]">₦</span>
                  <input value={amount} onChange={e => { setAmount(e.target.value.replace(/[^\d.]/g, '')); setError(''); }} inputMode="decimal" placeholder="0.00" autoFocus className="w-full px-3 py-3.5 text-[18px] font-semibold outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#555] mb-1.5">Note <span className="font-normal text-[#999]">(optional)</span></label>
                <input value={note} onChange={e => setNote(e.target.value.slice(0, 120))} placeholder="What’s this for?" className="w-full border border-[#E0E0E0] rounded-xl px-4 py-3.5 text-[14px] outline-none focus:border-[#162353]" />
              </div>
              <button onClick={continueToPin} className="w-full rounded-xl bg-[#162353] text-white py-3.5 text-[13px] font-bold flex items-center justify-center gap-2">
                Continue to PIN <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-[#F0F0F0] p-5 space-y-4">
              <div className="flex items-center justify-between rounded-xl bg-[#F1F7FF] px-4 py-3">
                <div>
                  <p className="text-[11px] text-[#64748B]">Amount to transfer</p>
                  <p className="text-[21px] font-extrabold text-[#162353]">₦{Number(amount || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}</p>
                </div>
                <button onClick={() => { setError(''); setPinDigits(['', '', '', '']); setTransferStep('amount'); }} className="text-[11px] font-bold text-[#2563EB]">Edit amount</button>
              </div>
              <div>
                <p className="text-[14px] font-bold text-[#111]">Confirm with your PIN</p>
                <p className="text-[11px] text-[#888] mt-1">Enter your 4-digit transaction PIN to send this amount.</p>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#555] mb-1.5">Transaction PIN</label>
                <div className="flex gap-3">
                  {[0, 1, 2, 3].map(index => (
                    <input
                      key={index}
                      ref={element => { pinInputsRef.current[index] = element; }}
                      value={pinDigits[index]}
                      onChange={event => handlePinChange(index, event.target.value)}
                      onKeyDown={event => handlePinKeyDown(index, event)}
                      onPaste={handlePinPaste}
                      type="password"
                      inputMode="numeric"
                      maxLength={1}
                      autoFocus={index === 0}
                      aria-label={`Transaction PIN digit ${index + 1}`}
                      className="h-14 w-full rounded-xl border border-[#D8E0EA] bg-[#FAFBFC] text-center text-[22px] font-bold text-[#162353] outline-none transition focus:border-[#162353] focus:ring-2 focus:ring-[#162353]/10"
                    />
                  ))}
                </div>
              </div>
              <p className="text-[11px] text-[#888] text-center">Vexa verifies the recipient again when the transfer is submitted.</p>
            </div>
          )
        )}
      </div>
      {mode === 'scan' && scanComplete && transferStep === 'pin' && (
        <div className="flex-none px-4 pb-6 pt-2">
          <button disabled={busy} onClick={() => void submit()} className="w-full rounded-xl bg-[#162353] text-white py-3.5 text-[13px] font-bold disabled:opacity-50">
            <span className="inline-flex items-center gap-2">{busy ? 'Sending…' : <><Send className="w-4 h-4" /> Send ₦{Number(amount || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}</>}</span>
          </button>
        </div>
      )}
    </div>
  );
}