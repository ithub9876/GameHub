import React, { useState, useRef, useCallback } from 'react';
import {
  Power,
  Volume2,
  VolumeX,
  Volume1,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Home,
  ArrowLeft,
  Menu,
  Play,
  Pause,
  RotateCcw,
  FastForward,
  Rewind,
  Keyboard,
  MousePointer,
  Tv,
} from 'lucide-react';
import { SignalingService } from '../services/signaling';
import { HapticEngine } from '../services/haptics';
import { RemoteNavAction } from '../types';

interface UniversalRemoteProps {
  isPaired: boolean;
}

export const UniversalRemote: React.FC<UniversalRemoteProps> = ({ isPaired }) => {
  const signaling = SignalingService.getInstance();
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [keyboardText, setKeyboardText] = useState('');
  const [isTrackpadActive, setIsTrackpadActive] = useState(false);

  const trackpadRef = useRef<HTMLDivElement>(null);
  const lastTouchRef = useRef<{ x: number; y: number; time: number } | null>(null);

  const sendNav = (action: RemoteNavAction, extra: any = {}) => {
    signaling.sendRemoteNav({
      action,
      ...extra,
      timestamp: Date.now(),
    });
  };

  // Trackpad Touch Handling
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const t = e.touches[0];
      lastTouchRef.current = { x: t.clientX, y: t.clientY, time: Date.now() };
      setIsTrackpadActive(true);
      HapticEngine.light();
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!lastTouchRef.current) return;

    if (e.touches.length === 1) {
      const t = e.touches[0];
      const dx = (t.clientX - lastTouchRef.current.x) * 1.5;
      const dy = (t.clientY - lastTouchRef.current.y) * 1.5;

      lastTouchRef.current = { x: t.clientX, y: t.clientY, time: Date.now() };

      sendNav('TRACKPAD_MOVE', { dx, dy });
    } else if (e.touches.length === 2) {
      // 2-finger scroll
      const t1 = e.touches[0];
      const dy = (t1.clientY - lastTouchRef.current.y) * 2;
      lastTouchRef.current = { x: t1.clientX, y: t1.clientY, time: Date.now() };
      sendNav('TRACKPAD_SCROLL', { dy });
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (lastTouchRef.current) {
      const duration = Date.now() - lastTouchRef.current.time;
      if (duration < 220) {
        // Quick tap -> click
        sendNav('TRACKPAD_CLICK');
        HapticEngine.medium();
      }
    }
    lastTouchRef.current = null;
    setIsTrackpadActive(false);
  };

  return (
    <div className="w-full max-w-lg mx-auto flex flex-col gap-4 select-none touch-none p-4 bg-slate-900/80 border border-slate-800 rounded-3xl backdrop-blur-xl shadow-2xl">
      {/* Top Header: Power & Volume Deck */}
      <div className="flex items-center justify-between gap-3 px-2">
        {/* Power */}
        <button
          id="remote-power-btn"
          onClick={() => {
            sendNav('POWER');
            HapticEngine.heavy();
          }}
          className="w-12 h-12 rounded-2xl bg-red-950/40 border border-red-500/40 text-red-400 hover:bg-red-900/50 flex items-center justify-center transition-all shadow-md active:scale-95"
          title="TV Power"
        >
          <Power className="w-5 h-5" />
        </button>

        {/* Volume & Mute Controls */}
        <div className="flex items-center gap-1.5 bg-slate-950/80 p-1 rounded-2xl border border-slate-800">
          <button
            id="remote-vol-down-btn"
            onClick={() => sendNav('VOL_DOWN')}
            className="w-10 h-10 rounded-xl bg-slate-900 text-slate-300 hover:text-white flex items-center justify-center font-bold"
          >
            <Volume1 className="w-4 h-4" />
          </button>
          <button
            id="remote-mute-btn"
            onClick={() => {
              setIsMuted(!isMuted);
              sendNav('MUTE');
            }}
            className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold transition-colors ${
              isMuted ? 'bg-amber-500 text-slate-950' : 'bg-slate-900 text-slate-300'
            }`}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <button
            id="remote-vol-up-btn"
            onClick={() => sendNav('VOL_UP')}
            className="w-10 h-10 rounded-xl bg-slate-900 text-slate-300 hover:text-white flex items-center justify-center font-bold"
          >
            <Volume2 className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Keyboard Input Modal Trigger */}
        <button
          id="remote-keyboard-btn"
          onClick={() => {
            const text = prompt('Type text to send to TV / PC:');
            if (text !== null && text.trim()) {
              signaling.sendKeyboardText(text.trim());
            }
          }}
          className="w-12 h-12 rounded-2xl bg-cyan-950/40 border border-cyan-500/40 text-cyan-400 hover:bg-cyan-900/50 flex items-center justify-center transition-all shadow-md active:scale-95"
          title="Type Text on TV"
        >
          <Keyboard className="w-5 h-5" />
        </button>
      </div>

      {/* Large Multi-Touch Precision Trackpad Surface */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-[11px] font-tech text-slate-400 px-2 uppercase">
          <span className="flex items-center gap-1">
            <MousePointer className="w-3.5 h-3.5 text-cyan-400" />
            Trackpad (Swipe to move cursor, Tap to click)
          </span>
          <span className="text-[10px] text-slate-500">2-Finger Scroll</span>
        </div>
        <div
          ref={trackpadRef}
          id="remote-trackpad-surface"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className={`w-full h-44 sm:h-52 rounded-2xl border-2 transition-all flex flex-col items-center justify-center cursor-crosshair relative overflow-hidden ${
            isTrackpadActive
              ? 'bg-cyan-950/30 border-cyan-400/80 shadow-[0_0_25px_rgba(6,182,212,0.25)]'
              : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
          }`}
        >
          {/* Subtle Grid Lines */}
          <div className="absolute inset-0 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:16px_16px] opacity-30 pointer-events-none" />

          <div className="flex flex-col items-center gap-1 pointer-events-none opacity-40">
            <MousePointer className="w-6 h-6 text-cyan-400 animate-pulse" />
            <span className="text-[10px] font-mono tracking-widest text-cyan-200">PRECISION SURFACE</span>
          </div>
        </div>
      </div>

      {/* Directional D-Pad & Core Navigation Diamond */}
      <div className="flex items-center justify-center py-2">
        <div className="relative w-48 h-48 flex items-center justify-center">
          {/* D-Pad Background Circle */}
          <div className="absolute inset-0 rounded-full bg-slate-950 border border-slate-800 shadow-inner" />

          {/* UP */}
          <button
            id="remote-dpad-up"
            onClick={() => sendNav('UP')}
            className="absolute top-2 w-12 h-12 rounded-2xl bg-slate-900 border border-slate-700/60 text-slate-200 hover:bg-cyan-500 hover:text-slate-950 flex items-center justify-center transition-all shadow active:scale-95"
          >
            <ChevronUp className="w-6 h-6 stroke-[2.5]" />
          </button>

          {/* DOWN */}
          <button
            id="remote-dpad-down"
            onClick={() => sendNav('DOWN')}
            className="absolute bottom-2 w-12 h-12 rounded-2xl bg-slate-900 border border-slate-700/60 text-slate-200 hover:bg-cyan-500 hover:text-slate-950 flex items-center justify-center transition-all shadow active:scale-95"
          >
            <ChevronDown className="w-6 h-6 stroke-[2.5]" />
          </button>

          {/* LEFT */}
          <button
            id="remote-dpad-left"
            onClick={() => sendNav('LEFT')}
            className="absolute left-2 w-12 h-12 rounded-2xl bg-slate-900 border border-slate-700/60 text-slate-200 hover:bg-cyan-500 hover:text-slate-950 flex items-center justify-center transition-all shadow active:scale-95"
          >
            <ChevronLeft className="w-6 h-6 stroke-[2.5]" />
          </button>

          {/* RIGHT */}
          <button
            id="remote-dpad-right"
            onClick={() => sendNav('RIGHT')}
            className="absolute right-2 w-12 h-12 rounded-2xl bg-slate-900 border border-slate-700/60 text-slate-200 hover:bg-cyan-500 hover:text-slate-950 flex items-center justify-center transition-all shadow active:scale-95"
          >
            <ChevronRight className="w-6 h-6 stroke-[2.5]" />
          </button>

          {/* CENTER OK / SELECT */}
          <button
            id="remote-dpad-select"
            onClick={() => sendNav('SELECT')}
            className="w-16 h-16 rounded-full bg-cyan-500 text-slate-950 font-display font-black text-sm border-2 border-cyan-300 shadow-[0_0_20px_rgba(6,182,212,0.6)] flex items-center justify-center transition-all active:scale-90"
          >
            OK
          </button>
        </div>
      </div>

      {/* System Navigation Deck: Back, Home, Menu */}
      <div className="grid grid-cols-3 gap-3">
        <button
          id="remote-nav-back"
          onClick={() => sendNav('BACK')}
          className="py-3 rounded-2xl bg-slate-950 border border-slate-800 text-slate-300 hover:bg-slate-900 hover:text-white flex items-center justify-center gap-1 text-xs font-tech font-bold uppercase transition-all shadow"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>BACK</span>
        </button>

        <button
          id="remote-nav-home"
          onClick={() => sendNav('HOME')}
          className="py-3 rounded-2xl bg-slate-950 border border-cyan-500/40 text-cyan-400 hover:bg-cyan-950/40 flex items-center justify-center gap-1 text-xs font-tech font-bold uppercase transition-all shadow"
        >
          <Home className="w-4 h-4" />
          <span>HOME</span>
        </button>

        <button
          id="remote-nav-menu"
          onClick={() => sendNav('MENU')}
          className="py-3 rounded-2xl bg-slate-950 border border-slate-800 text-slate-300 hover:bg-slate-900 hover:text-white flex items-center justify-center gap-1 text-xs font-tech font-bold uppercase transition-all shadow"
        >
          <Menu className="w-4 h-4" />
          <span>MENU</span>
        </button>
      </div>

      {/* Media Playback Controls */}
      <div className="flex items-center justify-around bg-slate-950/80 p-2 rounded-2xl border border-slate-800">
        <button
          id="remote-media-rewind"
          onClick={() => sendNav('MEDIA_PREV')}
          className="p-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-900 transition-colors"
        >
          <Rewind className="w-5 h-5" />
        </button>

        <button
          id="remote-media-play-pause"
          onClick={() => {
            setIsPlaying(!isPlaying);
            sendNav('MEDIA_PLAY_PAUSE');
          }}
          className="p-3 rounded-xl bg-cyan-500 text-slate-950 shadow-md hover:bg-cyan-400 transition-all active:scale-95"
        >
          {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-current" />}
        </button>

        <button
          id="remote-media-forward"
          onClick={() => sendNav('MEDIA_NEXT')}
          className="p-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-900 transition-colors"
        >
          <FastForward className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
