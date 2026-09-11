import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Compass,
  Zap,
  Keyboard,
  RotateCcw,
  Sparkles,
  Sliders,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Disc,
} from 'lucide-react';
import { GamepadState, GamepadButtonLayout, ControllerTheme } from '../types';
import { VirtualJoystick } from './VirtualJoystick';
import { SignalingService } from '../services/signaling';
import { HapticEngine } from '../services/haptics';

interface UniversalGamepadProps {
  layoutScheme: GamepadButtonLayout;
  onToggleLayoutScheme?: () => void;
  isPaired: boolean;
}

const INITIAL_GAMEPAD_STATE: GamepadState = {
  buttonA: false,
  buttonB: false,
  buttonX: false,
  buttonY: false,
  l1: false,
  r1: false,
  l2: false,
  r2: false,
  l2Value: 0,
  r2Value: 0,
  leftStick: { x: 0, y: 0, angle: 0, distance: 0 },
  rightStick: { x: 0, y: 0, angle: 0, distance: 0 },
  l3: false,
  r3: false,
  dpadUp: false,
  dpadDown: false,
  dpadLeft: false,
  dpadRight: false,
  select: false,
  start: false,
  home: false,
  turbo: false,
  gyro: {
    enabled: false,
    alpha: 0,
    beta: 0,
    gamma: 0,
    steer: 0,
    pitch: 0,
  },
  timestamp: Date.now(),
};

export const UniversalGamepad: React.FC<UniversalGamepadProps> = ({
  layoutScheme,
  onToggleLayoutScheme,
  isPaired,
}) => {
  const signaling = SignalingService.getInstance();
  const [padState, setPadState] = useState<GamepadState>(INITIAL_GAMEPAD_STATE);
  const [isGyroActive, setIsGyroActive] = useState(false);
  const [isTurboActive, setIsTurboActive] = useState(false);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [keyboardText, setKeyboardText] = useState('');

  const stateRef = useRef<GamepadState>(INITIAL_GAMEPAD_STATE);
  stateRef.current = padState;

  // Dispatch state helper
  const updatePadState = useCallback((updater: (prev: GamepadState) => GamepadState) => {
    setPadState((prev) => {
      const next = updater(prev);
      next.timestamp = Date.now();
      signaling.sendGamepadState(next);
      return next;
    });
  }, [signaling]);

  // Turbo autofire loop
  useEffect(() => {
    if (!isTurboActive) return;
    const interval = setInterval(() => {
      // Toggle active face buttons if pressed
      const current = stateRef.current;
      if (current.buttonA || current.buttonB || current.buttonX || current.buttonY || current.r2) {
        HapticEngine.light();
      }
    }, 100);
    return () => clearInterval(interval);
  }, [isTurboActive]);

  // Hardware Gyroscope / DeviceOrientation Motion Steering
  useEffect(() => {
    if (!isGyroActive) return;

    const handleOrientation = (e: DeviceOrientationEvent) => {
      const gamma = e.gamma || 0; // Left-to-right tilt [-90, 90]
      const beta = e.beta || 0;   // Front-to-back tilt [-180, 180]
      const alpha = e.alpha || 0; // Compass direction

      // Normalize steering (-1 to 1) clamped
      const steer = Math.max(-1, Math.min(1, gamma / 35));
      const pitch = Math.max(-1, Math.min(1, (beta - 45) / 35));

      updatePadState((prev) => ({
        ...prev,
        gyro: {
          enabled: true,
          alpha,
          beta,
          gamma,
          steer,
          pitch,
        },
      }));
    };

    if (typeof window !== 'undefined' && 'DeviceOrientationEvent' in window) {
      if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
        (DeviceOrientationEvent as any).requestPermission().then((res: string) => {
          if (res === 'granted') {
            window.addEventListener('deviceorientation', handleOrientation);
          }
        }).catch(() => {});
      } else {
        window.addEventListener('deviceorientation', handleOrientation);
      }
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('deviceorientation', handleOrientation);
      }
    };
  }, [isGyroActive, updatePadState]);

  // Toggle button helper
  const handleButtonPress = (key: keyof GamepadState, pressed: boolean, haptic: () => void = HapticEngine.medium) => {
    if (pressed) haptic();
    updatePadState((prev) => ({ ...prev, [key]: pressed }));
  };

  // Trigger pressure helper
  const handleTriggerPress = (side: 'l2' | 'r2', pressed: boolean, val = 1.0) => {
    if (pressed) {
      side === 'r2' ? HapticEngine.triggerFire() : HapticEngine.heavy();
    }
    updatePadState((prev) => ({
      ...prev,
      [side]: pressed,
      [`${side}Value`]: pressed ? val : 0,
    }));
  };

  // Dynamic Button Legends based on Layout Preset
  const getButtonLabels = () => {
    switch (layoutScheme) {
      case 'playstation':
        return {
          top: { label: '△', color: 'text-emerald-400 border-emerald-500/40' },
          left: { label: '▢', color: 'text-rose-400 border-rose-500/40' },
          right: { label: '◯', color: 'text-red-400 border-red-500/40' },
          bottom: { label: '✕', color: 'text-blue-400 border-blue-500/40' },
        };
      case 'nintendo':
        return {
          top: { label: 'X', color: 'text-cyan-400 border-cyan-500/40' },
          left: { label: 'Y', color: 'text-amber-400 border-amber-500/40' },
          right: { label: 'A', color: 'text-red-400 border-red-500/40' },
          bottom: { label: 'B', color: 'text-emerald-400 border-emerald-500/40' },
        };
      case 'xbox':
      default:
        return {
          top: { label: 'Y', color: 'text-amber-400 border-amber-500/40' },
          left: { label: 'X', color: 'text-blue-400 border-blue-500/40' },
          right: { label: 'B', color: 'text-rose-400 border-rose-500/40' },
          bottom: { label: 'A', color: 'text-emerald-400 border-emerald-500/40' },
        };
    }
  };

  const labels = getButtonLabels();

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col gap-3 sm:gap-5 select-none touch-none">
      {/* Top Shoulder Triggers & Bumpers Deck */}
      <div className="w-full grid grid-cols-2 gap-4 px-2 sm:px-6">
        {/* Left Shoulder (L1 & L2) */}
        <div className="flex items-center gap-2">
          {/* L2 Analog Trigger */}
          <button
            id="pad-btn-l2"
            onTouchStart={(e) => { e.preventDefault(); handleTriggerPress('l2', true); }}
            onTouchEnd={(e) => { e.preventDefault(); handleTriggerPress('l2', false); }}
            onMouseDown={() => handleTriggerPress('l2', true)}
            onMouseUp={() => handleTriggerPress('l2', false)}
            className={`flex-1 py-3 sm:py-4 rounded-2xl border-2 flex flex-col items-center justify-center gap-0.5 transition-all shadow-md active:scale-95 ${
              padState.l2
                ? 'bg-cyan-500 border-cyan-300 text-slate-950 shadow-[0_0_20px_rgba(6,182,212,0.6)]'
                : 'bg-slate-900/90 border-slate-700/80 text-slate-300 hover:border-slate-500'
            }`}
          >
            <span className="font-display font-black text-sm sm:text-base">LT / L2</span>
            <span className="text-[9px] font-mono opacity-70">TRIGGER</span>
          </button>

          {/* L1 Bumper */}
          <button
            id="pad-btn-l1"
            onTouchStart={(e) => { e.preventDefault(); handleButtonPress('l1', true, HapticEngine.medium); }}
            onTouchEnd={(e) => { e.preventDefault(); handleButtonPress('l1', false); }}
            onMouseDown={() => handleButtonPress('l1', true, HapticEngine.medium)}
            onMouseUp={() => handleButtonPress('l1', false)}
            className={`flex-1 py-3 sm:py-4 rounded-2xl border-2 flex flex-col items-center justify-center gap-0.5 transition-all shadow-md active:scale-95 ${
              padState.l1
                ? 'bg-cyan-400 border-cyan-200 text-slate-950 shadow-[0_0_20px_rgba(6,182,212,0.6)]'
                : 'bg-slate-900/90 border-slate-700/80 text-slate-300 hover:border-slate-500'
            }`}
          >
            <span className="font-display font-black text-sm sm:text-base">LB / L1</span>
            <span className="text-[9px] font-mono opacity-70">BUMPER</span>
          </button>
        </div>

        {/* Right Shoulder (R1 & R2) */}
        <div className="flex items-center gap-2">
          {/* R1 Bumper */}
          <button
            id="pad-btn-r1"
            onTouchStart={(e) => { e.preventDefault(); handleButtonPress('r1', true, HapticEngine.medium); }}
            onTouchEnd={(e) => { e.preventDefault(); handleButtonPress('r1', false); }}
            onMouseDown={() => handleButtonPress('r1', true, HapticEngine.medium)}
            onMouseUp={() => handleButtonPress('r1', false)}
            className={`flex-1 py-3 sm:py-4 rounded-2xl border-2 flex flex-col items-center justify-center gap-0.5 transition-all shadow-md active:scale-95 ${
              padState.r1
                ? 'bg-amber-400 border-amber-200 text-slate-950 shadow-[0_0_20px_rgba(245,158,11,0.6)]'
                : 'bg-slate-900/90 border-slate-700/80 text-slate-300 hover:border-slate-500'
            }`}
          >
            <span className="font-display font-black text-sm sm:text-base">RB / R1</span>
            <span className="text-[9px] font-mono opacity-70">BUMPER</span>
          </button>

          {/* R2 Analog Trigger */}
          <button
            id="pad-btn-r2"
            onTouchStart={(e) => { e.preventDefault(); handleTriggerPress('r2', true); }}
            onTouchEnd={(e) => { e.preventDefault(); handleTriggerPress('r2', false); }}
            onMouseDown={() => handleTriggerPress('r2', true)}
            onMouseUp={() => handleTriggerPress('r2', false)}
            className={`flex-1 py-3 sm:py-4 rounded-2xl border-2 flex flex-col items-center justify-center gap-0.5 transition-all shadow-md active:scale-95 ${
              padState.r2
                ? 'bg-rose-500 border-rose-300 text-slate-950 shadow-[0_0_20px_rgba(244,63,94,0.6)]'
                : 'bg-slate-900/90 border-slate-700/80 text-slate-300 hover:border-slate-500'
            }`}
          >
            <span className="font-display font-black text-sm sm:text-base">RT / R2</span>
            <span className="text-[9px] font-mono opacity-70">FIRE / GAS</span>
          </button>
        </div>
      </div>

      {/* Center System & Utility Bar */}
      <div className="w-full flex items-center justify-center gap-2 sm:gap-4 px-4 py-1">
        {/* SELECT / BACK Button */}
        <button
          id="pad-btn-select"
          onTouchStart={(e) => { e.preventDefault(); handleButtonPress('select', true); }}
          onTouchEnd={(e) => { e.preventDefault(); handleButtonPress('select', false); }}
          onMouseDown={() => handleButtonPress('select', true)}
          onMouseUp={() => handleButtonPress('select', false)}
          className={`px-3 sm:px-4 py-1.5 rounded-xl border text-[11px] font-tech font-bold uppercase transition-all shadow-sm ${
            padState.select ? 'bg-cyan-500 border-cyan-300 text-slate-950' : 'bg-slate-900 border-slate-700 text-slate-400'
          }`}
        >
          VIEW / BACK
        </button>

        {/* TURBO Toggle */}
        <button
          id="pad-btn-turbo"
          onClick={() => {
            setIsTurboActive(!isTurboActive);
            HapticEngine.medium();
          }}
          className={`px-3 py-1.5 rounded-xl border text-[11px] font-tech font-bold uppercase flex items-center gap-1 transition-all ${
            isTurboActive
              ? 'bg-amber-500 border-amber-300 text-slate-950 shadow-[0_0_15px_rgba(245,158,11,0.5)]'
              : 'bg-slate-900 border-slate-700 text-slate-400'
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          <span>TURBO</span>
        </button>

        {/* GUIDE / HOME Center Button */}
        <button
          id="pad-btn-home"
          onTouchStart={(e) => { e.preventDefault(); handleButtonPress('home', true, HapticEngine.success); }}
          onTouchEnd={(e) => { e.preventDefault(); handleButtonPress('home', false); }}
          onMouseDown={() => handleButtonPress('home', true, HapticEngine.success)}
          onMouseUp={() => handleButtonPress('home', false)}
          className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all shadow-lg active:scale-90 ${
            padState.home
              ? 'bg-cyan-400 border-white text-slate-950 shadow-[0_0_25px_rgba(6,182,212,0.9)]'
              : 'bg-slate-900 border-cyan-500/50 text-cyan-400 hover:border-cyan-400'
          }`}
          title="Home / Guide"
        >
          <Disc className="w-5 h-5 animate-spin-slow" />
        </button>

        {/* GYRO Motion Steering */}
        <button
          id="pad-btn-gyro"
          onClick={() => {
            setIsGyroActive(!isGyroActive);
            HapticEngine.medium();
          }}
          className={`px-3 py-1.5 rounded-xl border text-[11px] font-tech font-bold uppercase flex items-center gap-1 transition-all ${
            isGyroActive
              ? 'bg-emerald-500 border-emerald-300 text-slate-950 shadow-[0_0_15px_rgba(16,185,129,0.5)]'
              : 'bg-slate-900 border-slate-700 text-slate-400'
          }`}
        >
          <Compass className="w-3.5 h-3.5" />
          <span>GYRO</span>
        </button>

        {/* START / MENU Button */}
        <button
          id="pad-btn-start"
          onTouchStart={(e) => { e.preventDefault(); handleButtonPress('start', true); }}
          onTouchEnd={(e) => { e.preventDefault(); handleButtonPress('start', false); }}
          onMouseDown={() => handleButtonPress('start', true)}
          onMouseUp={() => handleButtonPress('start', false)}
          className={`px-3 sm:px-4 py-1.5 rounded-xl border text-[11px] font-tech font-bold uppercase transition-all shadow-sm ${
            padState.start ? 'bg-cyan-500 border-cyan-300 text-slate-950' : 'bg-slate-900 border-slate-700 text-slate-400'
          }`}
        >
          MENU / START
        </button>
      </div>

      {/* Main Dual Thumb Layout (Left D-Pad & Left Stick | Right Diamond & Right Stick) */}
      <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-10 p-2 sm:p-6 bg-gradient-to-b from-slate-900/60 to-slate-950/90 rounded-3xl border border-slate-800/80 shadow-2xl backdrop-blur-xl">
        {/* Left Side: 8-Way D-Pad + Left Analog Stick */}
        <div className="flex items-center justify-around gap-4 sm:gap-6">
          {/* 8-Way Directional Pad */}
          <div className="relative w-36 h-36 sm:w-44 sm:h-44 flex items-center justify-center">
            {/* D-Pad Center Cross Background */}
            <div className="absolute w-32 h-10 sm:w-36 sm:h-12 bg-slate-900/90 rounded-xl border border-slate-700/80 shadow-inner" />
            <div className="absolute w-10 h-32 sm:w-12 sm:h-36 bg-slate-900/90 rounded-xl border border-slate-700/80 shadow-inner" />

            {/* UP */}
            <button
              id="pad-dpad-up"
              onTouchStart={(e) => { e.preventDefault(); handleButtonPress('dpadUp', true, HapticEngine.light); }}
              onTouchEnd={(e) => { e.preventDefault(); handleButtonPress('dpadUp', false); }}
              onMouseDown={() => handleButtonPress('dpadUp', true, HapticEngine.light)}
              onMouseUp={() => handleButtonPress('dpadUp', false)}
              className={`absolute top-0 w-11 h-12 sm:w-12 sm:h-14 rounded-t-xl flex items-center justify-center transition-all z-10 ${
                padState.dpadUp ? 'bg-cyan-500 text-slate-950 shadow-[0_0_15px_rgba(6,182,212,0.8)] scale-95' : 'text-slate-300 hover:text-white'
              }`}
            >
              <ChevronUp className="w-6 h-6 stroke-[3]" />
            </button>

            {/* DOWN */}
            <button
              id="pad-dpad-down"
              onTouchStart={(e) => { e.preventDefault(); handleButtonPress('dpadDown', true, HapticEngine.light); }}
              onTouchEnd={(e) => { e.preventDefault(); handleButtonPress('dpadDown', false); }}
              onMouseDown={() => handleButtonPress('dpadDown', true, HapticEngine.light)}
              onMouseUp={() => handleButtonPress('dpadDown', false)}
              className={`absolute bottom-0 w-11 h-12 sm:w-12 sm:h-14 rounded-b-xl flex items-center justify-center transition-all z-10 ${
                padState.dpadDown ? 'bg-cyan-500 text-slate-950 shadow-[0_0_15px_rgba(6,182,212,0.8)] scale-95' : 'text-slate-300 hover:text-white'
              }`}
            >
              <ChevronDown className="w-6 h-6 stroke-[3]" />
            </button>

            {/* LEFT */}
            <button
              id="pad-dpad-left"
              onTouchStart={(e) => { e.preventDefault(); handleButtonPress('dpadLeft', true, HapticEngine.light); }}
              onTouchEnd={(e) => { e.preventDefault(); handleButtonPress('dpadLeft', false); }}
              onMouseDown={() => handleButtonPress('dpadLeft', true, HapticEngine.light)}
              onMouseUp={() => handleButtonPress('dpadLeft', false)}
              className={`absolute left-0 w-12 h-11 sm:w-14 sm:h-12 rounded-l-xl flex items-center justify-center transition-all z-10 ${
                padState.dpadLeft ? 'bg-cyan-500 text-slate-950 shadow-[0_0_15px_rgba(6,182,212,0.8)] scale-95' : 'text-slate-300 hover:text-white'
              }`}
            >
              <ChevronLeft className="w-6 h-6 stroke-[3]" />
            </button>

            {/* RIGHT */}
            <button
              id="pad-dpad-right"
              onTouchStart={(e) => { e.preventDefault(); handleButtonPress('dpadRight', true, HapticEngine.light); }}
              onTouchEnd={(e) => { e.preventDefault(); handleButtonPress('dpadRight', false); }}
              onMouseDown={() => handleButtonPress('dpadRight', true, HapticEngine.light)}
              onMouseUp={() => handleButtonPress('dpadRight', false)}
              className={`absolute right-0 w-12 h-11 sm:w-14 sm:h-12 rounded-r-xl flex items-center justify-center transition-all z-10 ${
                padState.dpadRight ? 'bg-cyan-500 text-slate-950 shadow-[0_0_15px_rgba(6,182,212,0.8)] scale-95' : 'text-slate-300 hover:text-white'
              }`}
            >
              <ChevronRight className="w-6 h-6 stroke-[3]" />
            </button>

            {/* Center Pivot */}
            <div className="w-7 h-7 rounded-full bg-slate-950 border border-slate-700/80 z-20" />
          </div>

          {/* Left Analog Thumbstick (Move / L3) */}
          <div className="flex flex-col items-center">
            <VirtualJoystick
              id="left"
              label="LS / MOVE"
              size={135}
              accentColor="cyan"
              onMove={(stick) => updatePadState((prev) => ({ ...prev, leftStick: stick }))}
            />
            <button
              id="pad-btn-l3"
              onTouchStart={(e) => { e.preventDefault(); handleButtonPress('l3', true, HapticEngine.heavy); }}
              onTouchEnd={(e) => { e.preventDefault(); handleButtonPress('l3', false); }}
              className={`mt-1 px-2.5 py-0.5 rounded text-[10px] font-mono border ${
                padState.l3 ? 'bg-cyan-500 text-slate-950 border-cyan-300' : 'bg-slate-900 text-slate-400 border-slate-700'
              }`}
            >
              L3 CLICK
            </button>
          </div>
        </div>

        {/* Right Side: Right Stick + Diamond Action Buttons */}
        <div className="flex items-center justify-around gap-4 sm:gap-6">
          {/* Right Analog Thumbstick (Aim / Camera / R3) */}
          <div className="flex flex-col items-center">
            <VirtualJoystick
              id="right"
              label="RS / AIM"
              size={135}
              accentColor="amber"
              onMove={(stick) => updatePadState((prev) => ({ ...prev, rightStick: stick }))}
            />
            <button
              id="pad-btn-r3"
              onTouchStart={(e) => { e.preventDefault(); handleButtonPress('r3', true, HapticEngine.heavy); }}
              onTouchEnd={(e) => { e.preventDefault(); handleButtonPress('r3', false); }}
              className={`mt-1 px-2.5 py-0.5 rounded text-[10px] font-mono border ${
                padState.r3 ? 'bg-amber-500 text-slate-950 border-amber-300' : 'bg-slate-900 text-slate-400 border-slate-700'
              }`}
            >
              R3 CLICK
            </button>
          </div>

          {/* Diamond Action Buttons (A/B/X/Y) */}
          <div className="relative w-36 h-36 sm:w-44 sm:h-44 flex items-center justify-center">
            {/* TOP (Y / △) */}
            <button
              id="pad-btn-y"
              onTouchStart={(e) => { e.preventDefault(); handleButtonPress('buttonY', true, HapticEngine.medium); }}
              onTouchEnd={(e) => { e.preventDefault(); handleButtonPress('buttonY', false); }}
              onMouseDown={() => handleButtonPress('buttonY', true, HapticEngine.medium)}
              onMouseUp={() => handleButtonPress('buttonY', false)}
              className={`absolute top-0 w-12 h-12 sm:w-14 sm:h-14 rounded-full border-2 flex items-center justify-center font-display font-black text-lg sm:text-xl shadow-lg transition-all active:scale-90 ${
                padState.buttonY
                  ? 'bg-amber-400 text-slate-950 border-white shadow-[0_0_20px_rgba(245,158,11,0.9)]'
                  : `bg-slate-900/90 ${labels.top.color} hover:scale-105`
              }`}
            >
              {labels.top.label}
            </button>

            {/* LEFT (X / ▢) */}
            <button
              id="pad-btn-x"
              onTouchStart={(e) => { e.preventDefault(); handleButtonPress('buttonX', true, HapticEngine.medium); }}
              onTouchEnd={(e) => { e.preventDefault(); handleButtonPress('buttonX', false); }}
              onMouseDown={() => handleButtonPress('buttonX', true, HapticEngine.medium)}
              onMouseUp={() => handleButtonPress('buttonX', false)}
              className={`absolute left-0 w-12 h-12 sm:w-14 sm:h-14 rounded-full border-2 flex items-center justify-center font-display font-black text-lg sm:text-xl shadow-lg transition-all active:scale-90 ${
                padState.buttonX
                  ? 'bg-blue-500 text-slate-950 border-white shadow-[0_0_20px_rgba(59,130,246,0.9)]'
                  : `bg-slate-900/90 ${labels.left.color} hover:scale-105`
              }`}
            >
              {labels.left.label}
            </button>

            {/* RIGHT (B / ◯) */}
            <button
              id="pad-btn-b"
              onTouchStart={(e) => { e.preventDefault(); handleButtonPress('buttonB', true, HapticEngine.medium); }}
              onTouchEnd={(e) => { e.preventDefault(); handleButtonPress('buttonB', false); }}
              onMouseDown={() => handleButtonPress('buttonB', true, HapticEngine.medium)}
              onMouseUp={() => handleButtonPress('buttonB', false)}
              className={`absolute right-0 w-12 h-12 sm:w-14 sm:h-14 rounded-full border-2 flex items-center justify-center font-display font-black text-lg sm:text-xl shadow-lg transition-all active:scale-90 ${
                padState.buttonB
                  ? 'bg-rose-500 text-slate-950 border-white shadow-[0_0_20px_rgba(244,63,94,0.9)]'
                  : `bg-slate-900/90 ${labels.right.color} hover:scale-105`
              }`}
            >
              {labels.right.label}
            </button>

            {/* BOTTOM (A / ✕) */}
            <button
              id="pad-btn-a"
              onTouchStart={(e) => { e.preventDefault(); handleButtonPress('buttonA', true, HapticEngine.medium); }}
              onTouchEnd={(e) => { e.preventDefault(); handleButtonPress('buttonA', false); }}
              onMouseDown={() => handleButtonPress('buttonA', true, HapticEngine.medium)}
              onMouseUp={() => handleButtonPress('buttonA', false)}
              className={`absolute bottom-0 w-12 h-12 sm:w-14 sm:h-14 rounded-full border-2 flex items-center justify-center font-display font-black text-lg sm:text-xl shadow-lg transition-all active:scale-90 ${
                padState.buttonA
                  ? 'bg-emerald-400 text-slate-950 border-white shadow-[0_0_20px_rgba(16,185,129,0.9)]'
                  : `bg-slate-900/90 ${labels.bottom.color} hover:scale-105`
              }`}
            >
              {labels.bottom.label}
            </button>
          </div>
        </div>
      </div>

      {/* Quick Input Keyboard Drawer */}
      {isKeyboardOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-cyan-500/50 rounded-2xl p-4 shadow-2xl flex flex-col gap-3">
            <h3 className="font-display font-bold text-sm text-cyan-300">SEND TEXT TO TV / PC</h3>
            <input
              type="text"
              autoFocus
              value={keyboardText}
              onChange={(e) => setKeyboardText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  signaling.sendKeyboardText(keyboardText);
                  setIsKeyboardOpen(false);
                  setKeyboardText('');
                }
              }}
              placeholder="Type search queries, chat, or text..."
              className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white outline-none focus:border-cyan-400"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsKeyboardOpen(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  signaling.sendKeyboardText(keyboardText);
                  setIsKeyboardOpen(false);
                  setKeyboardText('');
                }}
                className="px-4 py-1.5 rounded-lg bg-cyan-500 text-slate-950 font-bold text-xs hover:bg-cyan-400"
              >
                Send to TV
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
