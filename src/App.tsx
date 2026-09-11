/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Gamepad2,
  Tv,
  Radio,
  Sliders,
  ExternalLink,
  Minimize,
  Maximize,
  Sparkles,
  Zap,
} from 'lucide-react';
import { DiagnosticsBar } from './components/DiagnosticsBar';
import { UniversalGamepad } from './components/UniversalGamepad';
import { UniversalRemote } from './components/UniversalRemote';
import { PairingModal } from './components/PairingModal';
import { SettingsDrawer } from './components/SettingsDrawer';
import { SignalingService } from './services/signaling';
import { HapticEngine } from './services/haptics';
import { DiagnosticsData, GamepadButtonLayout, AppViewMode } from './types';

export default function App() {
  const signaling = SignalingService.getInstance();

  const [pin, setPin] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [isPaired, setIsPaired] = useState(false);
  const [viewMode, setViewMode] = useState<AppViewMode>('controller');
  const [layoutScheme, setLayoutScheme] = useState<GamepadButtonLayout>('xbox');

  // Modals & Drawers
  const [isPairingModalOpen, setIsPairingModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Settings
  const [hapticsEnabled, setHapticsEnabled] = useState(true);
  const [streamQuality, setStreamQuality] = useState<'1080p60' | '720p60' | '4k60'>('1080p60');
  const [gyroSensitivity, setGyroSensitivity] = useState<'normal' | 'high' | 'ultra'>('high');

  // Diagnostics State
  const [diagnostics, setDiagnostics] = useState<DiagnosticsData>({
    pingMs: 0,
    fps: 60,
    bitrateKbps: 0,
    packetLossPercent: 0,
    batteryLevel: 94,
    isCharging: false,
    isDataChannelOpen: false,
    connectedClients: 0,
  });

  // URL parameters & auto-pairing setup
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlPin = urlParams.get('pin');
    const urlPair = urlParams.get('pair');

    if (urlPin) {
      setPin(urlPin.toUpperCase());
    }
    if (urlPair) {
      setSessionId(urlPair.toUpperCase());
    }

    // Auto-connect to signaling broker
    signaling.connect(undefined, urlPin || '', 'mobile').catch(() => {});

    // Subscribe to signaling events
    const unsubscribe = signaling.subscribe((event) => {
      switch (event.type) {
        case 'CONNECTION_STATUS': {
          if (event.payload?.status === 'disconnected') {
            setIsPaired(false);
          }
          break;
        }

        case 'PAIR_ACCEPT': {
          setIsPaired(true);
          HapticEngine.success();
          const targetSession = event.payload?.sessionId;
          const targetPin = event.payload?.pinCode;
          if (targetSession) setSessionId(targetSession);
          if (targetPin) setPin(targetPin);
          break;
        }

        case 'PAIR_REJECT': {
          setIsPaired(false);
          break;
        }

        case 'RECEIVER_ONLINE': {
          // TV is online, note session info if matching
          if (event.payload?.sessionId) setSessionId(event.payload.sessionId);
          if (event.payload?.pinCode) setPin(event.payload.pinCode);
          break;
        }

        case 'RECEIVER_OFFLINE': {
          setIsPaired(false);
          break;
        }

        case 'DIAGNOSTICS_UPDATE': {
          if (event.payload) {
            setDiagnostics(event.payload);
          }
          break;
        }
      }
    });

    return () => unsubscribe();
  }, [signaling]);

  // Fullscreen toggle helper
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const handlePairSuccess = (newPin: string, newSession?: string) => {
    setPin(newPin);
    if (newSession) setSessionId(newSession);
    setIsPaired(true);
  };

  return (
    <div className="w-full min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between overflow-x-hidden select-none">
      {/* Top Diagnostics & Mode Bar */}
      <DiagnosticsBar
        diagnostics={diagnostics}
        viewMode={viewMode}
        onChangeViewMode={setViewMode}
        pin={pin}
        isPaired={isPaired}
        layoutScheme={layoutScheme}
        onChangeLayoutScheme={setLayoutScheme}
        onOpenPairing={() => setIsPairingModalOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* Connection & Target TV App Banner */}
      {!isPaired && (
        <div className="w-full max-w-4xl mx-auto px-3 pt-2">
          <div className="flex items-center justify-between gap-3 p-2.5 rounded-2xl bg-slate-900/90 border border-slate-800 text-slate-300 backdrop-blur-md">
            <div className="flex items-center gap-2 text-xs font-tech">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span>
                {pin ? (
                  <>
                    Target TV PIN: <span className="font-mono font-bold text-cyan-300">{pin}</span> (Not Connected)
                  </>
                ) : (
                  <>Ready to connect • Enter your GameHub TV PIN or scan TV QR code</>
                )}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsPairingModalOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-tech font-bold text-xs uppercase transition-all active:scale-95 shadow cursor-pointer flex items-center gap-1.5"
              >
                <Radio className="w-3.5 h-3.5" />
                <span>Pair TV</span>
              </button>
              <a
                href="https://game-tv.vercel.app"
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-tech font-bold uppercase transition-colors cursor-pointer"
              >
                <span>Launch TV App</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Main Handheld Interface */}
      <main className="w-full flex-1 flex flex-col items-center justify-center p-2 sm:p-4 max-w-5xl mx-auto my-auto">
        {viewMode === 'controller' ? (
          <UniversalGamepad
            layoutScheme={layoutScheme}
            onToggleLayoutScheme={() => {
              const schemes: GamepadButtonLayout[] = ['xbox', 'playstation', 'nintendo'];
              const nextIdx = (schemes.indexOf(layoutScheme) + 1) % schemes.length;
              setLayoutScheme(schemes[nextIdx]);
            }}
            isPaired={isPaired}
          />
        ) : (
          <UniversalRemote isPaired={isPaired} />
        )}
      </main>

      {/* Bottom Utility & Status Footer */}
      <footer className="w-full bg-slate-950 border-t border-slate-800 px-4 py-2 flex items-center justify-between text-[11px] font-tech text-slate-500 select-none">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          <span>GameHub Mobile Controller • Connected to game-tv.vercel.app</span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Settings</span>
          </button>

          <button
            onClick={toggleFullscreen}
            className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            {isFullscreen ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />}
            <span>Fullscreen</span>
          </button>
        </div>
      </footer>

      {/* Pairing Modal */}
      <PairingModal
        isOpen={isPairingModalOpen}
        onClose={() => setIsPairingModalOpen(false)}
        onPairSuccess={handlePairSuccess}
        currentPin={pin}
        currentSessionId={sessionId}
      />

      {/* Settings Drawer */}
      <SettingsDrawer
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        hapticsEnabled={hapticsEnabled}
        onToggleHaptics={setHapticsEnabled}
        streamQuality={streamQuality}
        onChangeStreamQuality={setStreamQuality}
        gyroSensitivity={gyroSensitivity}
        onChangeGyroSensitivity={setGyroSensitivity}
      />
    </div>
  );
}
