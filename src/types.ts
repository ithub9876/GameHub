export type GamepadButtonLayout = 'xbox' | 'playstation' | 'nintendo';

export type ControllerTheme = 'midnight_cyan' | 'obsidian_crimson' | 'stealth_emerald' | 'cyber_purple';

export interface GamepadState {
  // Face buttons
  buttonA: boolean; // Bottom (Xbox A, PS ✕, Nintendo B)
  buttonB: boolean; // Right (Xbox B, PS ◯, Nintendo A)
  buttonX: boolean; // Left (Xbox X, PS ▢, Nintendo Y)
  buttonY: boolean; // Top (Xbox Y, PS △, Nintendo X)

  // Bumpers & Triggers
  l1: boolean;
  r1: boolean;
  l2: boolean;
  r2: boolean;
  l2Value: number; // 0.0 to 1.0
  r2Value: number; // 0.0 to 1.0

  // Sticks
  leftStick: { x: number; y: number; angle: number; distance: number };
  rightStick: { x: number; y: number; angle: number; distance: number };
  l3: boolean;
  r3: boolean;

  // D-Pad
  dpadUp: boolean;
  dpadDown: boolean;
  dpadLeft: boolean;
  dpadRight: boolean;

  // System
  select: boolean;
  start: boolean;
  home: boolean;
  turbo: boolean;

  // Gyro Motion
  gyro: {
    enabled: boolean;
    alpha: number; // Z-axis compass
    beta: number;  // X-axis pitch (-180 to 180)
    gamma: number; // Y-axis roll (-90 to 90)
    steer: number; // Normalized -1 to 1
    pitch: number; // Normalized -1 to 1
  };

  timestamp: number;
}

export type RemoteNavAction =
  | 'UP'
  | 'DOWN'
  | 'LEFT'
  | 'RIGHT'
  | 'SELECT'
  | 'BACK'
  | 'HOME'
  | 'MENU'
  | 'VOL_UP'
  | 'VOL_DOWN'
  | 'MUTE'
  | 'CH_UP'
  | 'CH_DOWN'
  | 'POWER'
  | 'MEDIA_PLAY_PAUSE'
  | 'MEDIA_PREV'
  | 'MEDIA_NEXT'
  | 'MEDIA_STOP'
  | 'TRACKPAD_MOVE'
  | 'TRACKPAD_CLICK'
  | 'TRACKPAD_RIGHT_CLICK'
  | 'TRACKPAD_SCROLL'
  | 'KEYBOARD_INPUT';

export interface RemoteNavPayload {
  action: RemoteNavAction;
  dx?: number;
  dy?: number;
  text?: string;
  timestamp: number;
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface DiagnosticsData {
  pingMs: number;
  fps: number;
  bitrateKbps: number;
  packetLossPercent: number;
  batteryLevel: number;
  isCharging: boolean;
  isDataChannelOpen: boolean;
  connectedClients: number;
}

export type AppViewMode = 'controller' | 'remote';

export interface GameHubTvSession {
  sessionId?: string;
  pinCode: string;
  host?: string;
  tvName?: string;
}
