import React, { useRef, useState, useEffect, useCallback } from 'react';
import { HapticEngine } from '../services/haptics';

interface VirtualJoystickProps {
  id: 'left' | 'right' | 'movement' | 'aim' | 'steer';
  label?: string;
  size?: number;
  accentColor?: 'cyan' | 'amber' | 'emerald' | 'crimson' | 'purple';
  onMove: (stick: { id: any; x: number; y: number; angle: number; distance: number }) => void;
  onRelease?: () => void;
}

export const VirtualJoystick: React.FC<VirtualJoystickProps> = ({
  id,
  label = 'STICK',
  size = 140,
  accentColor = 'cyan',
  onMove,
  onRelease,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [knobPos, setKnobPos] = useState({ x: 0, y: 0 });
  const [isActive, setIsActive] = useState(false);
  const touchIdRef = useRef<number | null>(null);

  const radius = size / 2;
  const maxDistance = radius * 0.72;

  const colorStyles = {
    cyan: {
      ring: 'border-cyan-500/40 bg-cyan-950/20 shadow-[0_0_25px_rgba(6,182,212,0.2)]',
      knob: 'bg-gradient-to-br from-cyan-400 to-blue-600 shadow-[0_0_18px_rgba(6,182,212,0.6)] border-cyan-200/60',
      activeRing: 'border-cyan-400 bg-cyan-900/30',
      label: 'text-cyan-400',
    },
    amber: {
      ring: 'border-amber-500/40 bg-amber-950/20 shadow-[0_0_25px_rgba(245,158,11,0.2)]',
      knob: 'bg-gradient-to-br from-amber-400 to-orange-600 shadow-[0_0_18px_rgba(245,158,11,0.6)] border-amber-200/60',
      activeRing: 'border-amber-400 bg-amber-900/30',
      label: 'text-amber-400',
    },
    emerald: {
      ring: 'border-emerald-500/40 bg-emerald-950/20 shadow-[0_0_25px_rgba(16,185,129,0.2)]',
      knob: 'bg-gradient-to-br from-emerald-400 to-teal-600 shadow-[0_0_18px_rgba(16,185,129,0.6)] border-emerald-200/60',
      activeRing: 'border-emerald-400 bg-emerald-900/30',
      label: 'text-emerald-400',
    },
    crimson: {
      ring: 'border-rose-500/40 bg-rose-950/20 shadow-[0_0_25px_rgba(244,63,94,0.2)]',
      knob: 'bg-gradient-to-br from-rose-500 to-red-700 shadow-[0_0_18px_rgba(244,63,94,0.6)] border-rose-200/60',
      activeRing: 'border-rose-400 bg-rose-900/30',
      label: 'text-rose-400',
    },
    purple: {
      ring: 'border-purple-500/40 bg-purple-950/20 shadow-[0_0_25px_rgba(168,85,247,0.2)]',
      knob: 'bg-gradient-to-br from-purple-400 to-indigo-600 shadow-[0_0_18px_rgba(168,85,247,0.6)] border-purple-200/60',
      activeRing: 'border-purple-400 bg-purple-900/30',
      label: 'text-purple-400',
    },
  }[accentColor];

  const handlePointer = useCallback(
    (clientX: number, clientY: number) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      let dx = clientX - centerX;
      let dy = clientY - centerY;
      const distance = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx);

      const clampedDist = Math.min(distance, maxDistance);
      const clampedX = Math.cos(angle) * clampedDist;
      const clampedY = Math.sin(angle) * clampedDist;

      setKnobPos({ x: clampedX, y: clampedY });

      const normalizedX = Number((clampedX / maxDistance).toFixed(3));
      const normalizedY = Number((clampedY / maxDistance).toFixed(3));
      const normalizedDist = Number((clampedDist / maxDistance).toFixed(3));

      onMove({
        id,
        x: normalizedX,
        y: normalizedY,
        angle,
        distance: normalizedDist,
      });
    },
    [id, maxDistance, onMove]
  );

  const resetStick = useCallback(() => {
    setKnobPos({ x: 0, y: 0 });
    setIsActive(false);
    touchIdRef.current = null;
    onMove({ id, x: 0, y: 0, angle: 0, distance: 0 });
    if (onRelease) onRelease();
  }, [id, onMove, onRelease]);

  // Touch handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (touchIdRef.current !== null) return;
    const touch = e.changedTouches[0];
    touchIdRef.current = touch.identifier;
    setIsActive(true);
    HapticEngine.light();
    handlePointer(touch.clientX, touch.clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchIdRef.current === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === touchIdRef.current) {
        handlePointer(touch.clientX, touch.clientY);
        break;
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchIdRef.current === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === touchIdRef.current) {
        resetStick();
        break;
      }
    }
  };

  // Mouse fallback handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsActive(true);
    HapticEngine.light();
    handlePointer(e.clientX, e.clientY);

    const onMouseMove = (moveEvent: MouseEvent) => {
      handlePointer(moveEvent.clientX, moveEvent.clientY);
    };

    const onMouseUp = () => {
      resetStick();
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  return (
    <div className="flex flex-col items-center select-none touch-none">
      <div
        ref={containerRef}
        id={`virtual-joystick-${id}`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        onMouseDown={handleMouseDown}
        style={{ width: size, height: size }}
        className={`relative rounded-full border-2 transition-colors duration-200 flex items-center justify-center cursor-grab active:cursor-grabbing backdrop-blur-md ${
          isActive ? colorStyles.activeRing : colorStyles.ring
        }`}
      >
        {/* Crosshair guidelines */}
        <div className="absolute w-full h-[1px] bg-slate-700/40 pointer-events-none" />
        <div className="absolute h-full w-[1px] bg-slate-700/40 pointer-events-none" />
        <div className="absolute w-2/3 h-2/3 rounded-full border border-dashed border-slate-700/30 pointer-events-none" />

        {/* Center thumb knob */}
        <div
          style={{
            transform: `translate3d(${knobPos.x}px, ${knobPos.y}px, 0)`,
            width: size * 0.42,
            height: size * 0.42,
          }}
          className={`absolute rounded-full border shadow-xl flex items-center justify-center pointer-events-none transition-transform ${
            isActive ? 'duration-0 scale-105' : 'duration-150 scale-100 ease-out'
          } ${colorStyles.knob}`}
        >
          {/* Inner metallic concentric core */}
          <div className="w-5 h-5 rounded-full bg-slate-900/60 border border-white/30 flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-white/90 shadow-sm" />
          </div>
        </div>
      </div>

      {label && (
        <span className={`mt-2 text-[10px] font-tech font-bold uppercase tracking-widest ${colorStyles.label} opacity-80`}>
          {label}
        </span>
      )}
    </div>
  );
};
