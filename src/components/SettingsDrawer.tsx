import React from 'react';
import { Sliders, X, Vibrate, Video, Compass, Shield, Smartphone, Zap } from 'lucide-react';
import { HapticEngine } from '../services/haptics';

interface SettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  hapticsEnabled: boolean;
  onToggleHaptics: (enabled: boolean) => void;
  streamQuality: '1080p60' | '720p60' | '4k60';
  onChangeStreamQuality: (quality: '1080p60' | '720p60' | '4k60') => void;
  gyroSensitivity: 'normal' | 'high' | 'ultra';
  onChangeGyroSensitivity: (sens: 'normal' | 'high' | 'ultra') => void;
}

export const SettingsDrawer: React.FC<SettingsDrawerProps> = ({
  isOpen,
  onClose,
  hapticsEnabled,
  onToggleHaptics,
  streamQuality,
  onChangeStreamQuality,
  gyroSensitivity,
  onChangeGyroSensitivity,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-950/70 backdrop-blur-sm">
      <div className="w-full max-w-sm h-full bg-[#0c0f18] border-l border-cyan-500/30 p-6 flex flex-col justify-between shadow-2xl text-slate-100 overflow-y-auto">
        <div className="flex flex-col gap-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Sliders className="w-5 h-5 text-cyan-400" />
              <h2 className="font-display font-bold text-lg text-white">CONTROLLER SETTINGS</h2>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Haptic Rumble Feedback */}
          <div className="flex flex-col gap-2 p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Vibrate className="w-4 h-4 text-cyan-400" />
                <span className="font-tech font-bold text-sm text-slate-200">HAPTIC ENGINE</span>
              </div>
              <button
                onClick={() => {
                  onToggleHaptics(!hapticsEnabled);
                  HapticEngine.setEnabled(!hapticsEnabled);
                  if (!hapticsEnabled) HapticEngine.success();
                }}
                className={`w-12 h-6 rounded-full transition-colors relative ${
                  hapticsEnabled ? 'bg-cyan-500' : 'bg-slate-700'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-slate-950 absolute top-1 transition-transform ${
                    hapticsEnabled ? 'translate-x-7' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            <p className="text-[11px] font-tech text-slate-400">
              Tactile vibration triggers for firing, shifting, and navigation taps.
            </p>
          </div>

          {/* WebRTC Video Stream Quality */}
          <div className="flex flex-col gap-2.5 p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800">
            <div className="flex items-center gap-2">
              <Video className="w-4 h-4 text-amber-400" />
              <span className="font-tech font-bold text-sm text-slate-200">STREAM RESOLUTION & FPS</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(['720p60', '1080p60', '4k60'] as const).map((q) => (
                <button
                  key={q}
                  onClick={() => {
                    onChangeStreamQuality(q);
                    HapticEngine.light();
                  }}
                  className={`py-2 rounded-xl text-xs font-tech font-bold uppercase transition-all ${
                    streamQuality === q
                      ? 'bg-cyan-500 text-slate-950 shadow-md font-bold'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {q === '720p60' ? '720p 60' : q === '1080p60' ? '1080p 60' : '4K 60'}
                </button>
              ))}
            </div>
          </div>

          {/* Gyro Steering Sensitivity */}
          <div className="flex flex-col gap-2.5 p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800">
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-emerald-400" />
              <span className="font-tech font-bold text-sm text-slate-200">MOTION GYRO SENSITIVITY</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(['normal', 'high', 'ultra'] as const).map((sens) => (
                <button
                  key={sens}
                  onClick={() => {
                    onChangeGyroSensitivity(sens);
                    HapticEngine.light();
                  }}
                  className={`py-2 rounded-xl text-xs font-tech font-bold uppercase transition-all ${
                    gyroSensitivity === sens
                      ? 'bg-emerald-500 text-slate-950 shadow-md font-bold'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {sens}
                </button>
              ))}
            </div>
          </div>

          {/* Protocol Diagnostics */}
          <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col gap-1 text-[11px] font-mono text-slate-400">
            <div className="flex justify-between">
              <span>DataChannel MTU:</span>
              <span className="text-cyan-400">1200 bytes</span>
            </div>
            <div className="flex justify-between">
              <span>Signaling Protocol:</span>
              <span className="text-cyan-400">WebSocket / JSON</span>
            </div>
            <div className="flex justify-between">
              <span>Video Codec:</span>
              <span className="text-emerald-400">H.264 / VP8 HW Accel</span>
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 rounded-2xl bg-cyan-500 hover:bg-cyan-400 active:scale-95 text-slate-950 font-display font-bold text-xs uppercase transition-all shadow-lg"
        >
          Save & Return
        </button>
      </div>
    </div>
  );
};
