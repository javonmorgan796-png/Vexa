import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  Camera,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Flashlight,
  FlashlightOff,
  ImageIcon,
  QrCode,
  RefreshCw,
  ScanLine,
  Send,
  Share2,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useLocation } from 'wouter';
import jsQR from 'jsqr';
import { useAuth } from '@/context/AuthContext';
import { useUserData } from '@/context/UserDataContext';
import { useVexaFinance } from '@/context/VexaFinanceContext';
import { TransferConfirmationModal, PaymentPinModal } from '@/components/transfer/TransferModals';

type TransferMode = 'scan' | 'my-qr';
type TransferStep = 'amount' | 'pin';

function createVexaQrValue(accountNumber: string, name: string) {
  const params = new URLSearchParams({ account: accountNumber, name });
  return `vexa://transfer?${params.toString()}`;
}

interface ParsedVexaRecipient {
  account: string;
  name: string;
}

function parseVexaRecipient(value: string): ParsedVexaRecipient | null {
  if (!value) return null;
  const trimmed = value.trim();

  // 1. Plain 10-digit account number
  if (/^\d{10}$/.test(trimmed)) return { account: trimmed, name: '' };

  // 2. vexa://transfer?account=... or http/https URL with query params
  try {
    const url = new URL(trimmed);
    const account = url.searchParams.get('account') || url.searchParams.get('acc') || '';
    const name = url.searchParams.get('name')?.trim() || '';
    if (/^\d{10}$/.test(account)) return { account, name };
  } catch {
    // Continue parsing
  }

  // 3. JSON object payload (e.g. { "account": "0123456789", "name": "..." })
  try {
    const parsed = JSON.parse(trimmed) as { account?: unknown; accountNumber?: unknown; name?: unknown };
    const rawAcc = String(parsed.account ?? parsed.accountNumber ?? '').replace(/\D/g, '');
    const name = typeof parsed.name === 'string' ? parsed.name.trim() : '';
    if (/^\d{10}$/.test(rawAcc)) return { account: rawAcc, name };
  } catch {
    // Continue parsing
  }

  // 4. Any 10-digit number sequence within the string (e.g. "VEXA:9012345678")
  const match = trimmed.match(/\b(\d{10})\b/);
  if (match) {
    return { account: match[1], name: '' };
  }

  return null;
}

export default function VexaTransferPage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { balance = 0, refreshAll } = useUserData();
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
  const [showConfirmPopup, setShowConfirmPopup] = useState(false);
  const [showPinPopup, setShowPinPopup]         = useState(false);
  const [pinModalError, setPinModalError]       = useState('');
  const [copied, setCopied] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<number | null>(null);
  const pinInputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const stopCamera = () => {
    if (scanTimerRef.current !== null) {
      window.cancelAnimationFrame(scanTimerRef.current);
      window.clearTimeout(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setScannerActive(false);
    setTorchOn(false);
    setHasTorch(false);
  };

  useEffect(() => () => stopCamera(), []);

  const handleQrFound = (recipient: ParsedVexaRecipient) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([40, 30, 40]);
      } catch {
        // ignore
      }
    }
    setAccountNumber(recipient.account);
    setRecipientName(recipient.name);
    setScanMessage(
      recipient.name
        ? `QR code verified: ${recipient.name} (${recipient.account})`
        : `QR code verified: Account ${recipient.account}`
    );
    setScanComplete(true);
    stopCamera();
  };

  const startCamera = async (overrideFacing?: 'environment' | 'user') => {
    const targetFacing = overrideFacing || facingMode;
    stopCamera();

    if (!navigator.mediaDevices?.getUserMedia) {
      setScannerError('Camera access is not supported on this browser. Upload a QR photo or enter the account number below.');
      return;
    }

    setScannerError('');
    setScanMessage('');
    setScanComplete(false);
    setRecipientName('');
    setTransferStep('amount');

    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: targetFacing },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      } catch (firstErr: any) {
        // Fallback for laptops / desktop webcams that don't support environment facingMode
        if (firstErr?.name === 'OverconstrainedError' || firstErr?.name === 'ConstraintNotSatisfiedError') {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        } else {
          throw firstErr;
        }
      }

      streamRef.current = stream;

      // Check torch capability
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const capabilities = (videoTrack.getCapabilities ? videoTrack.getCapabilities() : {}) as { torch?: boolean };
        setHasTorch(Boolean(capabilities.torch));
      }

      if (!videoRef.current) {
        stopCamera();
        return;
      }

      videoRef.current.srcObject = stream;
      videoRef.current.setAttribute('playsinline', 'true');
      videoRef.current.setAttribute('muted', 'true');
      await videoRef.current.play();
      setScannerActive(true);

      if (!offscreenCanvasRef.current) {
        offscreenCanvasRef.current = document.createElement('canvas');
      }
      const canvas = offscreenCanvasRef.current;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      const scanLoop = () => {
        if (!streamRef.current || !videoRef.current) return;

        const video = videoRef.current;
        if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0 && video.videoHeight > 0) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: 'attemptBoth',
            });
            if (code && code.data) {
              const recipient = parseVexaRecipient(code.data);
              if (recipient) {
                handleQrFound(recipient);
                return;
              }
            }
          }
        }

        if (streamRef.current) {
          scanTimerRef.current = window.setTimeout(() => {
            scanLoop();
          }, 120);
        }
      };

      scanLoop();
    } catch (err: any) {
      console.warn('Camera start note:', err);
      const isDenied = err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError' || err?.name === 'SecurityError';
      setScannerError(
        isDenied
          ? 'Camera permission was not granted by your browser. You can select a QR image directly from your gallery below, or test with a sample recipient.'
          : 'Unable to start camera. Select a QR image from your gallery below or enter the account number.'
      );
      stopCamera();
    }
  };

  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;
    try {
      const nextState = !torchOn;
      await (track as any).applyConstraints({
        advanced: [{ torch: nextState }],
      });
      setTorchOn(nextState);
    } catch {
      // ignore
    }
  };

  const flipCamera = async () => {
    const nextFacing = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextFacing);
    if (scannerActive) {
      await startCamera(nextFacing);
    }
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const img = new Image();
    const reader = new FileReader();

    reader.onload = (event) => {
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, img.width, img.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'attemptBoth',
        });

        if (code && code.data) {
          const recipient = parseVexaRecipient(code.data);
          if (recipient) {
            handleQrFound(recipient);
            return;
          }
          setScannerError('Found a QR code in the image, but it does not contain a valid Vexa account number.');
        } else {
          setScannerError('Could not find a valid QR code in the uploaded image. Please try a clearer screenshot or enter the account number.');
        }
      };
      img.src = event.target?.result as string;
    };

    reader.readAsDataURL(file);
    e.target.value = '';
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
    if (!user?.hasPin) return setError('Set your transaction PIN in Settings before sending money');
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
    setShowConfirmPopup(true);
  };

  const handleModalPin = async (enteredPin: string) => {
    const numericAmount = Number(amount.replace(/,/g, ''));
    if (!/^\d{10}$/.test(accountNumber)) {
      setPinModalError('Recipient account number is invalid');
      return;
    }
    setPinModalError('');
    setBusy(true);
    const result = await transferVexaMoney(accountNumber, numericAmount, note, enteredPin);
    setBusy(false);
    if (!result.success) {
      setPinModalError(result.error ?? 'Transfer failed');
      return;
    }
    setShowPinPopup(false);
    setShowConfirmPopup(false);
    await refreshAll();
    setSuccess({ name: result.recipientName ?? recipientName ?? 'Vexa user', amount: numericAmount });
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
          <button onClick={() => { setSuccess(null); setAccountNumber(''); setAmount(''); setNote(''); setPinDigits(['', '', '', '']); setScanMessage(''); setRecipientName(''); setTransferStep('amount'); }} className="w-full max-w-sm mt-8 rounded-xl bg-[#F0B90B] hover:bg-[#FCD535] active:bg-[#DDAA09] text-[#181A20] py-3.5 text-[13px] font-bold shadow-sm transition-all">Send another transfer</button>
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

        <div className="flex-1 flex flex-col items-center justify-center px-5 pb-8 overflow-y-auto">
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            className="hidden"
            onChange={handleImageFileChange}
          />

          <div className="w-full max-w-md aspect-square rounded-[28px] overflow-hidden bg-[#0B122B] relative flex items-center justify-center shadow-2xl">
            <video
              ref={videoRef}
              muted
              playsInline
              autoPlay
              className={`absolute inset-0 w-full h-full object-cover transition-opacity ${scannerActive ? 'opacity-100' : 'opacity-0'}`}
            />
            {scannerActive ? (
              <>
                <div className="absolute inset-[12%] border-2 border-[#8BE3FF] rounded-[24px] shadow-[0_0_0_999px_rgba(11,18,43,0.65)] pointer-events-none" />
                <div className="vexa-scan-line absolute left-[16%] right-[16%] h-0.5 bg-[#8BE3FF] shadow-[0_0_14px_#8BE3FF] pointer-events-none" />
                
                {/* Floating On-Screen Controls */}
                <div className="absolute top-4 right-4 flex items-center gap-2 z-20">
                  {hasTorch && (
                    <button
                      onClick={toggleTorch}
                      className={`p-2.5 rounded-full backdrop-blur-md transition-colors ${
                        torchOn ? 'bg-amber-400 text-black shadow-lg' : 'bg-black/40 text-white hover:bg-black/60'
                      }`}
                      aria-label="Toggle flashlight"
                    >
                      {torchOn ? <Flashlight className="w-4 h-4" /> : <FlashlightOff className="w-4 h-4" />}
                    </button>
                  )}
                  <button
                    onClick={flipCamera}
                    className="p-2.5 rounded-full bg-black/40 text-white hover:bg-black/60 backdrop-blur-md transition-colors"
                    aria-label="Switch camera"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>

                <div className="absolute bottom-4 left-0 right-0 flex items-center justify-center gap-3 z-20 px-4">
                  <p className="text-[12px] font-semibold text-white/90 bg-black/50 px-3 py-1.5 rounded-full backdrop-blur-sm">
                    Center the recipient's Vexa QR code
                  </p>
                </div>
              </>
            ) : (
              <div className="relative z-10 flex flex-col items-center text-center px-6 py-4">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-3 ${scannerError ? 'bg-amber-400/15 text-amber-300' : 'bg-white/10 text-[#8BE3FF]'}`}>
                  {scannerError ? <ImageIcon className="w-7 h-7" /> : <Camera className="w-7 h-7" />}
                </div>
                <p className="text-[16px] font-bold text-white">
                  {scannerError ? 'Scan or Select QR Code' : 'Vexa QR Scanner'}
                </p>
                <p className="text-[12px] text-white/75 mt-1.5 leading-relaxed max-w-xs">
                  {scannerError
                    ? 'Camera access was restricted by your browser. You can select a QR photo directly from your device gallery, or pick a verified recipient.'
                    : 'Scan another Vexa user\'s QR code to initiate an instant, fee-free transfer.'}
                </p>

                <div className="flex flex-col sm:flex-row gap-2 mt-4 w-full max-w-xs">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 rounded-xl bg-[#8BE3FF] hover:bg-[#6ed8f7] text-[#0B122B] px-4 py-3 text-[12px] font-bold flex items-center justify-center gap-2 transition-colors shadow-md"
                  >
                    <ImageIcon className="w-4 h-4" />
                    <span>Upload QR from gallery</span>
                  </button>
                  <button
                    onClick={() => void startCamera()}
                    className="flex-1 rounded-xl bg-white/10 hover:bg-white/20 text-white px-4 py-3 text-[12px] font-bold flex items-center justify-center gap-2 transition-colors border border-white/15"
                  >
                    <Camera className="w-4 h-4" />
                    <span>{scannerError ? 'Retry camera' : 'Start camera'}</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => handleQrFound({ account: '2094817291', name: 'Chibuzor Emmanuel' })}
                  className="mt-3 text-[11px] font-semibold text-[#8BE3FF]/90 hover:text-white underline underline-offset-2 transition-colors"
                >
                  Quick test: use Chibuzor Emmanuel (2094817291)
                </button>
              </div>
            )}
          </div>

          {/* Quick Actions Ribbon */}
          <div className="mt-4 flex items-center gap-3 w-full max-w-md justify-center">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-[11px] font-bold text-[#162353] border border-[#E2E8F0] shadow-2xs hover:bg-gray-50 transition-colors"
            >
              <ImageIcon className="w-3.5 h-3.5 text-[#2563EB]" />
              <span>Choose QR photo from gallery</span>
            </button>
          </div>

          {/* Manual Entry Fallback Card */}
          <div className="w-full max-w-md mt-4 rounded-2xl bg-white border border-[#E8EBF0] p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-[12px] font-bold text-[#111]">Or enter account number directly</p>
              <span className="text-[11px] text-[#64748B]">10 digits</span>
            </div>
            <div className="mt-2.5 flex items-center gap-2">
              <input
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                inputMode="numeric"
                maxLength={10}
                placeholder="10-digit Vexa account (e.g. 2094817291)"
                className="flex-1 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[#111] px-3.5 py-2.5 text-[14px] font-mono tracking-wider outline-none focus:border-[#162353]"
              />
              {accountNumber.length === 10 && (
                <button
                  onClick={() => setScanComplete(true)}
                  className="rounded-xl bg-[#F0B90B] hover:bg-[#FCD535] active:bg-[#DDAA09] text-[#181A20] px-4 py-2.5 text-[12px] font-bold shrink-0 shadow-sm transition-colors"
                >
                  Continue
                </button>
              )}
            </div>

            {/* Quick Demo Recipients */}
            <div className="mt-3 pt-3 border-t border-[#F1F3F7]">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#888] mb-1.5">Quick Recipients</p>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { name: 'Chibuzor Emmanuel', acc: '2094817291' },
                  { name: 'Amina Bello', acc: '2094817292' },
                  { name: 'Babatunde Adeleke', acc: '2094817293' },
                ].map((rec) => (
                  <button
                    key={rec.acc}
                    type="button"
                    onClick={() => {
                      setAccountNumber(rec.acc);
                      setRecipientName(rec.name);
                      setScanComplete(true);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-[#F1F4F9] hover:bg-[#E4EAF4] text-[#162353] text-[11px] font-medium transition-colors"
                  >
                    {rec.name.split(' ')[0]} ({rec.acc.slice(-4)})
                  </button>
                ))}
              </div>
            </div>

            {scannerError && (
              <div className="mt-3 rounded-xl bg-amber-50 border border-amber-200 p-3 text-[11.5px] leading-relaxed text-amber-800">
                <p className="font-semibold">{scannerError}</p>
                <p className="mt-1 text-[10.5px] text-amber-700">
                  Tip: To enable live scanning, tap the browser's address bar lock/site settings icon and allow Camera. Or select an image from your gallery above.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'scan' && scanComplete && transferStep === 'pin') {
    return (
      <div className="fixed inset-0 bg-[#F2F3F5] text-[#111] flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>
        <div className="flex-none flex items-center gap-3 px-4 pb-3 bg-white border-b border-[#E8EBF0]" style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}>
          <button
            onClick={() => { setError(''); setPinDigits(['', '', '', '']); setTransferStep('amount'); }}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
            aria-label="Back to transfer details"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <p className="text-[16px] font-bold">Confirm transfer</p>
            <p className="text-[11px] text-[#64748B]">Enter your PIN to send money</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-8" style={{ scrollbarWidth: 'none' }}>
          <div className="mx-auto w-full max-w-md">
            <div className="text-center">
              <p className="text-[12px] font-semibold text-[#64748B]">You are sending</p>
              <p className="mt-2 text-[36px] font-extrabold tracking-tight text-[#162353]">
                ₦{Number(amount || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
              </p>
            </div>

            <div className="mt-8 rounded-2xl border border-[#E8EBF0] bg-white p-5">
              <p className="text-[11px] text-[#64748B]">Recipient</p>
              <p className="mt-1 text-[16px] font-bold text-[#111]">{recipientName || 'Name not provided'}</p>
              <p className="mt-1 text-[11px] tracking-[0.12em] text-[#64748B]">Account {accountNumber}</p>
              {note && (
                <div className="mt-4 border-t border-[#F0F2F5] pt-3">
                  <p className="text-[11px] text-[#64748B]">Note</p>
                  <p className="mt-1 text-[13px] text-[#333]">{note}</p>
                </div>
              )}
            </div>

            <div className="mt-8">
              <div className="text-center">
                <p className="text-[17px] font-bold text-[#111]">Enter transaction PIN</p>
                <p className="mt-1 text-[12px] text-[#888]">Use your 4-digit PIN to authorize this transfer.</p>
              </div>
              <div className="mt-5 flex gap-3">
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
                    className="h-16 w-full rounded-xl border border-[#D8E0EA] bg-white text-center text-[24px] font-bold text-[#162353] outline-none transition focus:border-[#162353] focus:ring-2 focus:ring-[#162353]/10"
                  />
                ))}
              </div>
              {error && <div className="mt-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-center text-[12px] text-red-600">{error}</div>}
            </div>
          </div>
        </div>

        <div className="flex-none border-t border-[#E8EBF0] bg-white px-5 pb-6 pt-3" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 24px)' }}>
          <button disabled={busy} onClick={() => void submit()} className="mx-auto block w-full max-w-md rounded-xl bg-[#F0B90B] hover:bg-[#FCD535] active:bg-[#DDAA09] text-[#181A20] py-3.5 text-[13px] font-bold shadow-sm disabled:opacity-45 transition-all">
            <span className="inline-flex items-center gap-2">{busy ? 'Sending…' : <><Send className="w-4 h-4" /> Send ₦{Number(amount || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}</>}</span>
          </button>
        </div>
      </div>
    );
  }

  if (mode === 'scan' && scanComplete && transferStep === 'amount') {
    return (
      <div className="fixed inset-0 bg-[#F2F3F5] text-[#111] flex flex-col w-full max-w-full overflow-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>
        <div className="flex-none flex items-center gap-3 px-4 pb-3 bg-white w-full shadow-xs" style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}>
          <button
            onClick={resetScan}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
            aria-label="Back to QR scanner"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <p className="text-[16px] font-bold">Enter amount</p>
            <p className="text-[11px] text-[#64748B]">Choose how much to send</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden w-full max-w-full px-5 py-8" style={{ scrollbarWidth: 'none' }}>
          <div className="mx-auto w-full max-w-md">
            <div className="rounded-2xl border-0 shadow-sm bg-white p-5">
              <p className="text-[11px] text-[#64748B]">Recipient</p>
              <p className="mt-1 text-[16px] font-bold text-[#111]">{recipientName || 'Name not provided'}</p>
              <p className="mt-1 text-[11px] tracking-[0.12em] text-[#64748B]">Account {accountNumber}</p>
            </div>

            <div className="mt-8 rounded-2xl border-0 shadow-sm bg-white p-5">
              <label className="block text-[12px] font-semibold text-[#888] mb-1">How much do you want to send?</label>
              <div className="flex items-center border-0 outline-none ring-0 py-2 w-full min-w-0">
                <span className="text-[32px] font-extrabold text-[#111] select-none shrink-0">₦</span>
                <input
                  value={amount}
                  onChange={event => { setAmount(event.target.value.replace(/[^\d.]/g, '')); setError(''); }}
                  inputMode="decimal"
                  placeholder="0.00"
                  className="w-full min-w-0 px-2 py-1 text-[36px] font-extrabold text-[#162353] outline-none border-0 ring-0 focus:outline-none focus:ring-0 bg-transparent placeholder:text-[#CBD5E1]"
                  aria-label="Transfer amount"
                />
              </div>
              <p className="mt-1 text-[11px] text-[#888]">Enter the amount in Nigerian naira.</p>
            </div>

            <div className="mt-4 rounded-2xl border-0 shadow-sm bg-white p-5">
              <label className="block text-[12px] font-semibold text-[#888] mb-2">Note <span className="font-normal text-[#AAA]">(optional)</span></label>
              <input
                value={note}
                onChange={event => setNote(event.target.value.slice(0, 120))}
                placeholder="What’s this for?"
                className="w-full rounded-xl border-0 outline-none ring-0 focus:outline-none focus:ring-0 bg-[#F8FAFC] px-4 py-3 text-[14px]"
              />
            </div>

            {error && <div className="mt-4 rounded-xl bg-red-50 border-0 shadow-xs px-4 py-3 text-[12px] text-red-600">{error}</div>}
          </div>
        </div>

        <div className="flex-none border-t-0 shadow-xs bg-white px-5 pb-6 pt-3" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 24px)' }}>
          <button onClick={continueToPin} className="mx-auto flex w-full max-w-md items-center justify-center gap-2 rounded-xl bg-[#F0B90B] hover:bg-[#FCD535] active:bg-[#DDAA09] text-[#181A20] py-3.5 text-[13px] font-bold shadow-sm transition-all">
            Continue <ChevronRight className="w-4 h-4" />
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
          bankName="Vexa"
          accountNumber={accountNumber}
          recipientName={recipientName || 'Vexa User'}
          amount={Number(amount.replace(/,/g, '')) || 0}
          userBalance={balance}
          onAddMoney={() => navigate('/')}
          fee={0.00}
          vat={0.00}
        />

        {/* Enter PIN Bottom Sheet Popup matching same sleek design */}
        <PaymentPinModal
          isOpen={showPinPopup}
          onClose={() => setShowPinPopup(false)}
          onSuccessPin={handleModalPin}
          amount={Number(amount.replace(/,/g, '')) || 0}
          recipientName={recipientName || 'Vexa User'}
          bankName="Vexa"
          error={pinModalError}
          processing={busy}
        />
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
          <button onClick={() => { stopCamera(); setMode('scan'); }} className={`flex-1 rounded-xl py-3 text-[12px] font-bold flex items-center justify-center gap-2 transition-colors ${mode === 'scan' ? 'bg-[#F0B90B] text-[#181A20] shadow-xs' : 'text-[#64748B]'}`}>
            <ScanLine className="w-4 h-4" /> Scan QR
          </button>
          <button onClick={() => { stopCamera(); setMode('my-qr'); setScannerError(''); }} className={`flex-1 rounded-xl py-3 text-[12px] font-bold flex items-center justify-center gap-2 transition-colors ${mode === 'my-qr' ? 'bg-[#F0B90B] text-[#181A20] shadow-xs' : 'text-[#64748B]'}`}>
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
                  <button onClick={() => void copyMyQrDetails()} className="theme-control theme-brand-text flex-1 rounded-xl border border-[#DCE3EE] py-3 text-[12px] font-bold flex items-center justify-center gap-2">{copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}{copied ? 'Copied' : 'Copy number'}</button>
                  <button onClick={() => void shareMyQr()} className="flex-1 rounded-xl bg-[#F0B90B] hover:bg-[#FCD535] active:bg-[#DDAA09] py-3 text-[12px] font-bold text-[#181A20] shadow-sm flex items-center justify-center gap-2 transition-all"><Share2 className="w-4 h-4" /> Share QR</button>
                </div>
              </div>
            ) : <p className="mt-5 text-[12px] text-[#888]">Your Vexa account number is not available yet.</p>}
          </div>
        )}

        {error && <div className="rounded-2xl bg-red-50 border border-red-200 px-4 py-3 text-[12px] text-red-600">{error}</div>}

      </div>
    </div>
  );
}