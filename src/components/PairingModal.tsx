import React, { useState, useRef, useEffect } from 'react';
import {
  Camera,
  KeyRound,
  X,
  RefreshCw,
  Tv,
  ArrowRight,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Smartphone,
  Copy,
  Check,
  Radio,
  HelpCircle,
} from 'lucide-react';
import jsQR from 'jsqr';
import confetti from 'canvas-confetti';
import { SignalingService } from '../services/signaling';
import { HapticEngine } from '../services/haptics';

interface PairingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPairSuccess: (pin: string, sessionId?: string) => void;
  currentPin: string;
  currentSessionId?: string;
}

export const PairingModal: React.FC<PairingModalProps> = ({
  isOpen,
  onClose,
  onPairSuccess,
  currentPin,
  currentSessionId = '',
}) => {
  const signaling = SignalingService.getInstance();
  const [tab, setTab] = useState<'pin' | 'qr' | 'sync'>('pin');
  const [pinDigits, setPinDigits] = useState<string[]>(
    currentPin && currentPin.length >= 4 ? currentPin.substring(0, 4).split('') : ['', '', '', '']
  );
  const [tvSessionCode, setTvSessionCode] = useState(currentSessionId || '');
  const [targetTvHost, setTargetTvHost] = useState('https://game-tv.vercel.app');
  const [isScanningCamera, setIsScanningCamera] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [promptCopied, setPromptCopied] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number | null>(null);

  const currentHost = typeof window !== 'undefined' ? window.location.host : 'localhost:3000';
  const tvSyncUrl = `https://game-tv.vercel.app/?server=${encodeURIComponent(currentHost)}`;

  useEffect(() => {
    if (currentPin && currentPin.length >= 4) {
      setPinDigits(currentPin.substring(0, 4).split(''));
    }
    if (currentSessionId) {
      setTvSessionCode(currentSessionId);
    }
  }, [currentPin, currentSessionId]);

  // Camera QR Scanner loop
  useEffect(() => {
    let stream: MediaStream | null = null;

    if (isOpen && tab === 'qr') {
      setIsScanningCamera(true);
      setErrorMsg('');

      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices
          .getUserMedia({ video: { facingMode: 'environment' } })
          .then((mediaStream) => {
            stream = mediaStream;
            if (videoRef.current) {
              videoRef.current.srcObject = mediaStream;
              videoRef.current.play().catch(() => {});
            }
            startQrDecoding();
          })
          .catch((err) => {
            console.warn('Camera access denied or unavailable', err);
            setErrorMsg('Camera access denied. Please enter the 4-digit TV PIN.');
            setIsScanningCamera(false);
          });
      } else {
        setErrorMsg('Camera API is not supported on this browser.');
        setIsScanningCamera(false);
      }
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      if (animRef.current) {
        cancelAnimationFrame(animRef.current);
      }
      setIsScanningCamera(false);
    };
  }, [isOpen, tab]);

  const startQrDecoding = () => {
    const scan = () => {
      if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (ctx) {
            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;
            ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: 'dontInvert',
            });

            if (code && code.data) {
              HapticEngine.success();
              handleScannedQrData(code.data);
              return;
            }
          }
        }
      }
      animRef.current = requestAnimationFrame(scan);
    };

    animRef.current = requestAnimationFrame(scan);
  };

  const handleScannedQrData = (data: string) => {
    try {
      if (data.startsWith('{')) {
        const parsed = JSON.parse(data);
        if (parsed.pin || parsed.sessionId) {
          if (parsed.sessionId) setTvSessionCode(parsed.sessionId);
          if (parsed.pin) setPinDigits(parsed.pin.substring(0, 4).split(''));
          submitPair(parsed.pin, parsed.sessionId, parsed.host);
          return;
        }
      }
      const url = new URL(data);
      const pairParam = url.searchParams.get('pair');
      const pinParam = url.searchParams.get('pin');
      if (pairParam || pinParam) {
        if (pairParam) setTvSessionCode(pairParam);
        if (pinParam) setPinDigits(pinParam.substring(0, 4).split(''));
        submitPair(pinParam || undefined, pairParam || undefined, url.origin);
        return;
      }
    } catch {
      if (data.length >= 4) {
        submitPair(data.substring(0, 4));
      }
    }
  };

  const handleDigitChange = (index: number, val: string) => {
    if (!/^[a-zA-Z0-9]?$/.test(val)) return;
    const next = [...pinDigits];
    next[index] = val.toUpperCase();
    setPinDigits(next);
    HapticEngine.light();

    if (val && index < 3) {
      const nextInput = document.getElementById(`pairing-pin-input-${index + 1}`);
      nextInput?.focus();
    }
  };

  const submitPair = async (targetPin?: string, targetSession?: string, customHost?: string) => {
    const pin = (targetPin || pinDigits.join('')).trim().toUpperCase();
    const session = (targetSession || tvSessionCode).trim().toUpperCase();

    if (!pin || pin.length < 4) {
      setErrorMsg('Please enter a 4-digit TV PIN code');
      HapticEngine.warning();
      return;
    }

    setIsConnecting(true);
    setErrorMsg('');

    const res = await signaling.pairWithTv(pin, session || undefined, customHost);

    setIsConnecting(false);
    if (res.success) {
      HapticEngine.success();
      try {
        confetti({
          particleCount: 45,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#06b6d4', '#38bdf8', '#f59e0b', '#10b981'],
        });
      } catch {}
      onPairSuccess(res.pinCode || pin, res.sessionId || session);
      onClose();
    } else {
      HapticEngine.warning();
      setErrorMsg(res.error || `Invalid PIN "${pin}". No TV console found with this code.`);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-md bg-slate-900 border border-cyan-500/40 rounded-3xl p-6 shadow-2xl flex flex-col gap-5 text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500 flex items-center justify-center text-slate-950 shadow-md">
              <Tv className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display font-bold text-lg text-white tracking-wide flex items-center gap-2">
                CONNECT TO GAMEHUB TV
              </h2>
              <p className="text-xs font-tech text-cyan-400">game-tv.vercel.app</p>
            </div>
          </div>
          <button
            id="btn-close-pairing"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* TV App Target Banner */}
        <div className="p-3.5 rounded-2xl bg-slate-950/90 border border-cyan-500/30 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <div className="text-left">
              <div className="text-xs font-bold text-white">Target TV App</div>
              <div className="text-[11px] font-mono text-cyan-300">game-tv.vercel.app</div>
            </div>
          </div>
          <a
            href="https://game-tv.vercel.app"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 text-cyan-300 text-xs font-tech font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <span>Open TV App</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        {/* Tab Switcher: PIN vs Camera QR vs Real TV Setup */}
        <div className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-slate-950 border border-slate-800">
          <button
            id="tab-pin"
            onClick={() => {
              setTab('pin');
              HapticEngine.light();
            }}
            className={`py-2 rounded-xl text-xs font-tech font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              tab === 'pin'
                ? 'bg-cyan-500 text-slate-950 shadow-md font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>PIN Code</span>
          </button>

          <button
            id="tab-qr"
            onClick={() => {
              setTab('qr');
              HapticEngine.light();
            }}
            className={`py-2 rounded-xl text-xs font-tech font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              tab === 'qr'
                ? 'bg-cyan-500 text-slate-950 shadow-md font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Scan QR</span>
          </button>

          <button
            id="tab-sync"
            onClick={() => {
              setTab('sync');
              HapticEngine.light();
            }}
            className={`py-2 rounded-xl text-xs font-tech font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              tab === 'sync'
                ? 'bg-cyan-500 text-slate-950 shadow-md font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>TV Setup</span>
          </button>
        </div>

        {/* Tab 1: PIN Input */}
        {tab === 'pin' && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col items-center gap-2">
              <label className="text-xs font-tech font-semibold text-slate-300 uppercase tracking-wider">
                Enter 4-Digit TV PIN (e.g. 4829)
              </label>
              <div className="flex items-center gap-3">
                {pinDigits.map((digit, idx) => (
                  <input
                    key={idx}
                    id={`pairing-pin-input-${idx}`}
                    type="text"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleDigitChange(idx, e.target.value)}
                    className="w-14 h-16 rounded-2xl bg-slate-950 border-2 border-slate-700 focus:border-cyan-400 focus:bg-cyan-950/30 text-center font-display font-bold text-2xl text-cyan-300 outline-none transition-all shadow-inner"
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between px-3 py-2 bg-slate-950/60 rounded-xl border border-slate-800 text-xs font-tech">
              <span className="text-slate-400">TV Session Code</span>
              <input
                type="text"
                value={tvSessionCode}
                onChange={(e) => setTvSessionCode(e.target.value.toUpperCase())}
                placeholder="GH-8492"
                className="bg-transparent text-right font-mono font-bold text-cyan-300 outline-none w-28"
              />
            </div>

            <div className="flex items-center justify-center">
              <button
                type="button"
                onClick={() => {
                  setPinDigits(['4', '8', '2', '9']);
                  setTvSessionCode('GH-8492');
                  setErrorMsg('');
                  HapticEngine.light();
                }}
                className="text-[11px] font-tech text-cyan-400 hover:text-cyan-300 underline underline-offset-4 cursor-pointer"
              >
                Use default TV PIN (4829)
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: Scan TV QR */}
        {tab === 'qr' && (
          <div className="flex flex-col items-center gap-3">
            <div className="relative w-full aspect-square max-w-[220px] rounded-2xl overflow-hidden border-2 border-cyan-500/60 bg-black flex items-center justify-center shadow-lg">
              <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
              <canvas ref={canvasRef} className="hidden" />

              <div className="absolute inset-4 border-2 border-dashed border-cyan-400/80 rounded-xl pointer-events-none animate-pulse flex items-center justify-center">
                <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-bounce" />
              </div>
            </div>
            <p className="text-[11px] font-tech text-slate-400 text-center">
              Scan the QR code shown on <span className="text-cyan-300 font-bold">game-tv.vercel.app</span>
            </p>
          </div>
        )}

        {/* Tab 3: Real TV Setup & Sync */}
        {tab === 'sync' && (
          <div className="flex flex-col gap-3.5 text-left text-xs font-tech">
            <div className="p-3 rounded-2xl bg-cyan-950/40 border border-cyan-500/40 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-cyan-200 font-bold flex items-center gap-1.5">
                  <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
                  Live Signaling Relay
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/40">
                  ONLINE
                </span>
              </div>
              <div className="text-[11px] font-mono text-slate-300 bg-slate-950/80 p-2 rounded-xl border border-slate-800 break-all">
                wss://{currentHost}/ws
              </div>
              <p className="text-[11px] text-cyan-300/80 leading-relaxed">
                Vercel serves static web pages and cannot host WebSocket servers. Both this phone controller and your GameHub-TV app connect to this live relay so game inputs sync in real time.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-slate-300 text-xs font-bold">
                <span>Direct TV Launch Link</span>
                <a
                  href={tvSyncUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 text-[11px] underline"
                >
                  <span>Open TV with Relay</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <div className="p-2 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[10px] text-slate-400 truncate">
                {tvSyncUrl}
              </div>
            </div>

            <div className="flex flex-col gap-1.5 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-slate-300 font-bold text-xs">Prompt for GameHub-tv repo:</span>
                <button
                  type="button"
                  onClick={() => {
                    const promptText = `Connect GameHub-TV to the live WebSocket signaling relay and enable real-time gamepad input handling from the mobile controller app:

1. Update src/services/signalingService.ts:
- Replace static wsUrl resolution with dynamic support for ?server= query param and VITE_SIGNALING_SERVER env var, falling back to the live Cloud Run signaling relay when hosted on Vercel:
  const urlParams = new URLSearchParams(window.location.search);
  const queryServer = urlParams.get('server');
  const envServer = (import.meta as any).env?.VITE_SIGNALING_SERVER;
  let wsUrl: string;
  if (queryServer) {
    const isSecure = window.location.protocol === 'https:' || queryServer.includes('run.app');
    const cleanHost = queryServer.replace(/^(wss?:\\/\\/|https?:\\/\\/)/, '').replace(/\\/ws\\/?$/, '');
    wsUrl = \`\${isSecure ? 'wss:' : 'ws:'}//\${cleanHost}/ws\`;
  } else if (envServer) {
    wsUrl = envServer.startsWith('ws') ? envServer : \`wss://\${envServer}/ws\`;
  } else if (window.location.host.includes('vercel.app')) {
    wsUrl = 'wss://${currentHost}/ws';
  } else {
    wsUrl = \`\${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//\${window.location.host}/ws\`;
  }

- In SignalingEvents, add:
  onControllerInput?: (input: any) => void;
  onNavCommand?: (payload: any) => void;

- In this.ws.onmessage, handle incoming messages:
  if (msg.type === 'CONTROLLER_INPUT' && msg.input) {
    this.events.onControllerInput?.(msg.input);
    return;
  }
  if (msg.type === 'NAV_COMMAND' && msg.payload) {
    this.events.onNavCommand?.(msg.payload);
    return;
  }

2. Update src/App.tsx:
- In new SignalingService({ ... }), add onNavCommand and onControllerInput handlers that dispatch KeyboardEvents (ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Enter, Escape) to window so that mobile D-Pad, joystick, and action buttons immediately navigate and control the TV launcher in real time.`;

                    navigator.clipboard.writeText(promptText);
                    setPromptCopied(true);
                    HapticEngine.success();
                    setTimeout(() => setPromptCopied(false), 2500);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 text-cyan-300 text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                >
                  {promptCopied ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-300">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy TV Prompt</span>
                    </>
                  )}
                </button>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[10px] font-mono text-cyan-300/90 max-h-32 overflow-y-auto leading-relaxed select-all">
                Connect GameHub-TV to live WebSocket relay: wss://{currentHost}/ws and handle CONTROLLER_INPUT and NAV_COMMAND in signalingService.ts and App.tsx
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Copy this prompt and run it in your GameHub-tv repository to enable instant bidirectional gamepad controls between your phone and TV!
              </p>
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="p-3 rounded-2xl bg-rose-950/70 border border-rose-500/50 text-rose-200 text-xs font-tech flex flex-col gap-2.5 animate-in fade-in slide-in-from-top-1">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{errorMsg}</div>
            </div>
            {(errorMsg.includes('4829') || errorMsg.includes('Vercel') || errorMsg.includes('relay') || errorMsg.includes('fallback')) && (
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-rose-500/30">
                <button
                  type="button"
                  onClick={() => {
                    setTab('sync');
                    setErrorMsg('');
                  }}
                  className="px-2.5 py-1 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-[11px] font-bold transition-all cursor-pointer"
                >
                  View TV Web Prompt
                </button>
                <button
                  type="button"
                  onClick={() => {
                    HapticEngine.success();
                    onPairSuccess('SIM-4829', 'GH-SIMULATOR');
                    onClose();
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold border border-slate-700 transition-all cursor-pointer"
                >
                  Test Controller Now (Simulator)
                </button>
              </div>
            )}
          </div>
        )}

        {/* Submit Button */}
        <button
          id="btn-pair-connect"
          disabled={isConnecting}
          onClick={() => submitPair()}
          className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600 hover:from-cyan-300 hover:to-indigo-500 text-slate-950 font-display font-bold text-sm tracking-wider uppercase flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(6,182,212,0.4)] active:scale-95 transition-all cursor-pointer disabled:opacity-50"
        >
          {isConnecting ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>VERIFYING PIN WITH TV...</span>
            </>
          ) : (
            <>
              <span>CONNECT TO TV</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
};
