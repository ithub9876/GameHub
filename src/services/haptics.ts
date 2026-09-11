export class HapticEngine {
  private static enabled = true;
  private static audioCtx: AudioContext | null = null;

  public static setEnabled = (state: boolean) => {
    HapticEngine.enabled = state;
  };

  public static isEnabled = (): boolean => {
    return HapticEngine.enabled;
  };

  private static getAudioContext = (): AudioContext | null => {
    if (!HapticEngine.audioCtx && typeof window !== 'undefined') {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        HapticEngine.audioCtx = new AudioCtxClass();
      }
    }
    if (HapticEngine.audioCtx && HapticEngine.audioCtx.state === 'suspended') {
      HapticEngine.audioCtx.resume().catch(() => {});
    }
    return HapticEngine.audioCtx;
  };

  private static playSubtleSound = (frequency: number, type: OscillatorType = 'sine', duration = 0.05, gainValue = 0.08) => {
    try {
      const ctx = HapticEngine.getAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(frequency, ctx.currentTime);
      
      gain.gain.setValueAtTime(gainValue, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {
      // Audio autoplay policy catch
    }
  };

  public static light = () => {
    if (!HapticEngine.enabled) return;
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(12);
      } catch {}
    }
    HapticEngine.playSubtleSound(440, 'triangle', 0.03, 0.04);
  };

  public static medium = () => {
    if (!HapticEngine.enabled) return;
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(28);
      } catch {}
    }
    HapticEngine.playSubtleSound(320, 'sine', 0.05, 0.08);
  };

  public static heavy = () => {
    if (!HapticEngine.enabled) return;
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(55);
      } catch {}
    }
    HapticEngine.playSubtleSound(160, 'square', 0.08, 0.1);
  };

  public static success = () => {
    if (!HapticEngine.enabled) return;
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([20, 50, 40]);
      } catch {}
    }
    HapticEngine.playSubtleSound(580, 'sine', 0.08, 0.08);
    setTimeout(() => HapticEngine.playSubtleSound(880, 'sine', 0.12, 0.1), 60);
  };

  public static warning = () => {
    if (!HapticEngine.enabled) return;
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([50, 40, 50]);
      } catch {}
    }
    HapticEngine.playSubtleSound(220, 'sawtooth', 0.1, 0.12);
  };

  public static error = () => {
    if (!HapticEngine.enabled) return;
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([80, 50, 80]);
      } catch {}
    }
    HapticEngine.playSubtleSound(150, 'square', 0.15, 0.15);
  };

  public static triggerFire = () => {
    if (!HapticEngine.enabled) return;
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([15, 10, 25]);
      } catch {}
    }
    HapticEngine.playSubtleSound(120, 'sawtooth', 0.07, 0.12);
  };

  public static nitroRumble = () => {
    if (!HapticEngine.enabled) return;
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([30, 20, 30, 20, 40]);
      } catch {}
    }
    HapticEngine.playSubtleSound(90, 'sawtooth', 0.15, 0.14);
  };
}
