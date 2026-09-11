import React, { useEffect, useState } from 'react';
import {
  Activity,
  Battery,
  BatteryCharging,
  Gamepad2,
  Tv,
  Radio,
  ExternalLink,
} from 'lucide-react';
import { DiagnosticsData, GamepadButtonLayout, AppViewMode } from '../types';

interface DiagnosticsBarProps {
  diagnostics: DiagnosticsData;
  viewMode: AppViewMode;
  onChangeViewMode: (mode: AppViewMode) => void;
  pin: string;
  isPaired: boolean;
  layoutScheme: GamepadButtonLayout;
  onChangeLayoutScheme: (scheme: GamepadButtonLayout) => void;
  onOpenPairing: () => void;
  onOpenSettings?: () => void;
}

export const DiagnosticsBar: React.FC<DiagnosticsBarProps> = ({
  diagnostics,
  viewMode,
  onChangeViewMode,
  pin,
  isPaired,
  layoutScheme,
  onChangeLayoutScheme,
  onOpenPairing,
}) => {
  const [realBattery, setRealBattery] = useState<{ level: number; charging: boolean }>({
    level: diagnostics.batteryLevel,
    charging: diagnostics.isCharging,
  });

  // Battery Status API listener
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
      (navigator as any)
        .getBattery()
        .then((battery: any) => {
          const updateBattery = () => {
            setRealBattery({
              level: Math.round(battery.level * 100),
              charging: battery.charging,
            });
          };
          updateBattery();
          battery.addEventListener('levelchange', updateBattery);
          battery.addEventListener('chargingchange', updateBattery);
        })
        .catch(() => {});
    }
  }, []);

  const getPingColor = (ms: number) => {
    if (!isPaired) return 'text-slate-500 border-slate-800 bg-slate-950/40';
    if (ms <= 15) return 'text-emerald-400 border-emerald-500/30 bg-emerald-950/40';
    if (ms <= 45) return 'text-cyan-400 border-cyan-500/30 bg-cyan-950/40';
    if (ms <= 80) return 'text-amber-400 border-amber-500/30 bg-amber-950/40';
    return 'text-rose-400 border-rose-500/30 bg-rose-950/40';
  };

  return (
    <header className="w-full bg-slate-950/90 border-b border-slate-800 px-3 py-2 flex items-center justify-between gap-2 text-xs font-mono select-none z-30 shadow-md backdrop-blur-md">
      {/* Left: Device & TV Pairing status */}
      <div className="flex items-center gap-2">
        <button
          id="diag-btn-pairing"
          onClick={onOpenPairing}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[11px] font-tech font-bold tracking-wider transition-all shadow-sm active:scale-95 cursor-pointer ${
            isPaired
              ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-300'
              : 'bg-amber-950/40 border-amber-500/60 text-amber-300 animate-pulse'
          }`}
        >
          <Radio className={`w-3.5 h-3.5 ${isPaired ? 'text-emerald-400' : 'text-amber-400'}`} />
          <span>{isPaired ? `TV [${pin}] CONNECTED` : 'TAP TO CONNECT TV'}</span>
        </button>

        {/* View Mode Switcher: Universal Gamepad vs TV Remote */}
        <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-xl border border-slate-800">
          <button
            id="view-btn-controller"
            onClick={() => onChangeViewMode('controller')}
            className={`px-3 py-1 rounded-lg text-[11px] font-tech font-bold uppercase transition-all flex items-center gap-1.5 cursor-pointer ${
              viewMode === 'controller'
                ? 'bg-cyan-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Gamepad2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">UNIVERSAL</span> GAMEPAD
          </button>

          <button
            id="view-btn-remote"
            onClick={() => onChangeViewMode('remote')}
            className={`px-3 py-1 rounded-lg text-[11px] font-tech font-bold uppercase transition-all flex items-center gap-1.5 cursor-pointer ${
              viewMode === 'remote'
                ? 'bg-cyan-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Tv className="w-3.5 h-3.5" />
            <span>TV REMOTE</span>
          </button>
        </div>
      </div>

      {/* Right: Controller Preset & Live Diagnostics */}
      <div className="flex items-center gap-2">
        {/* Layout Preset Switcher (Xbox / PS / Nintendo) */}
        {viewMode === 'controller' && (
          <div className="hidden sm:flex items-center gap-1 bg-slate-900 px-2 py-1 rounded-xl border border-slate-800 text-[10px] font-tech">
            <span className="text-slate-500 uppercase">LAYOUT:</span>
            <select
              value={layoutScheme}
              onChange={(e) => onChangeLayoutScheme(e.target.value as GamepadButtonLayout)}
              className="bg-transparent text-cyan-300 font-bold outline-none cursor-pointer"
            >
              <option value="xbox" className="bg-slate-900 text-white">Xbox (ABXY)</option>
              <option value="playstation" className="bg-slate-900 text-white">PlayStation (△◯✕▢)</option>
              <option value="nintendo" className="bg-slate-900 text-white">Nintendo (BAYX)</option>
            </select>
          </div>
        )}

        {/* Link to GameHub TV Web App */}
        <a
          href="https://game-tv.vercel.app"
          target="_blank"
          rel="noopener noreferrer"
          className="hidden md:flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-cyan-300 hover:text-cyan-200 text-[11px] font-tech font-bold uppercase transition-colors"
          title="Open GameHub TV on your Smart TV or Monitor"
        >
          <ExternalLink className="w-3 h-3 text-cyan-400" />
          <span>GAMEHUB TV</span>
        </a>

        {/* Latency / Ping */}
        <div className={`flex items-center gap-1 px-2 py-1 rounded-xl border text-[11px] font-bold ${getPingColor(diagnostics.pingMs)}`}>
          <Activity className="w-3 h-3" />
          <span>{isPaired ? `${diagnostics.pingMs}ms` : 'Ready'}</span>
        </div>

        {/* Battery Indicator */}
        <div className="hidden xs:flex items-center gap-1 px-2 py-1 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 text-[11px]">
          {realBattery.charging ? (
            <BatteryCharging className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <Battery className="w-3.5 h-3.5 text-slate-300" />
          )}
          <span>{realBattery.level}%</span>
        </div>
      </div>
    </header>
  );
};
