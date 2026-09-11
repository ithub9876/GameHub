import { GamepadState, RemoteNavPayload, ConnectionStatus, DiagnosticsData } from '../types';
import { HapticEngine } from './haptics';

export type SignalingCallback = (event: {
  type: string;
  payload?: any;
  senderId?: string;
}) => void;

export class SignalingService {
  private static instance: SignalingService | null = null;

  private ws: WebSocket | null = null;
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;

  private currentPin: string = '';
  private currentSessionId: string = '';
  private targetTvHost: string = 'https://game-tv.vercel.app';
  private currentRole: 'mobile' | 'tv' = 'mobile';
  private connectionStatus: ConnectionStatus = 'disconnected';
  private isTvOnline: boolean = false;

  private callbacks: Set<SignalingCallback> = new Set();
  private pingInterval: any = null;
  private statsInterval: any = null;

  private lastPingSentTime: number = 0;
  private realPingMs: number = 0;
  private packetCount: number = 0;

  private constructor() {}

  public static getInstance(): SignalingService {
    if (!this.instance) {
      this.instance = new SignalingService();
    }
    return this.instance;
  }

  public subscribe(cb: SignalingCallback): () => void {
    this.callbacks.add(cb);
    return () => this.callbacks.delete(cb);
  }

  private emit(type: string, payload?: any, senderId?: string) {
    for (const cb of this.callbacks) {
      try {
        cb({ type, payload, senderId });
      } catch (e) {
        console.error('Signaling callback error:', e);
      }
    }
  }

  /**
   * Connect to GameHub TV Signaling Server (Local relay or remote TV host)
   */
  public connect(
    customHost?: string,
    pinOrSessionId: string = '',
    role: 'mobile' | 'tv' = 'mobile'
  ): Promise<boolean> {
    return new Promise((resolve) => {
      if (pinOrSessionId) {
        const input = pinOrSessionId.trim().toUpperCase();
        if (input.startsWith('GH-')) {
          this.currentSessionId = input;
        } else {
          this.currentPin = input;
        }
      }

      this.currentRole = role;

      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.connectionStatus = 'connected';
        resolve(true);
        return;
      }

      this.disconnect();
      this.connectionStatus = 'connecting';
      this.emit('CONNECTION_STATUS', { status: 'connecting', pin: this.currentPin, sessionId: this.currentSessionId });

      let host = customHost;
      if (!host) {
        // Default to current host relay WebSocket
        const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const locHost = typeof window !== 'undefined' ? window.location.host : 'localhost:3000';
        host = `${protocol}//${locHost}/ws`;
      }

      const formattedUrl = host.includes('/ws') ? host : `${host.replace(/\/$/, '')}/ws`;
      const fullUrl = `${formattedUrl}?pin=${encodeURIComponent(this.currentPin)}&sessionId=${encodeURIComponent(
        this.currentSessionId
      )}&role=${role}`;

      try {
        this.ws = new WebSocket(fullUrl);

        this.ws.onopen = () => {
          this.connectionStatus = 'connected';
          this.emit('CONNECTION_STATUS', {
            status: 'connected',
            pin: this.currentPin,
            sessionId: this.currentSessionId,
            role,
          });

          this.startPingLoop();
          this.startStatsLoop();
          resolve(true);
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleIncomingMessage(data);
          } catch (err) {
            console.error('Failed to parse WS message', err);
          }
        };

        this.ws.onerror = (err) => {
          console.warn('WebSocket connection error:', err);
          this.connectionStatus = 'error';
          this.emit('CONNECTION_STATUS', { status: 'error' });
          resolve(false);
        };

        this.ws.onclose = () => {
          this.connectionStatus = 'disconnected';
          this.isTvOnline = false;
          this.emit('CONNECTION_STATUS', { status: 'disconnected' });
        };
      } catch (err) {
        console.error('Socket init error:', err);
        this.connectionStatus = 'error';
        this.emit('CONNECTION_STATUS', { status: 'error' });
        resolve(false);
      }
    });
  }

  /**
   * Request pairing with TV and strictly verify PIN acceptance
   */
  public async pairWithTv(
    pin: string,
    sessionId?: string,
    customHost?: string
  ): Promise<{ success: boolean; error?: string; sessionId?: string; pinCode?: string; tvInfo?: any }> {
    const cleanPin = pin.trim().toUpperCase();
    const cleanSession = sessionId ? sessionId.trim().toUpperCase() : '';

    // 1. Ensure WebSocket connection
    const connected = await this.connect(customHost, cleanPin, 'mobile');
    if (!connected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return { success: false, error: 'Could not connect to signaling broker.' };
    }

    return new Promise((resolve) => {
      let resolved = false;

      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          cleanup();
          resolve({
            success: false,
            error: `TV response timed out. Ensure the TV is running with PIN ${cleanPin}.`,
          });
        }
      }, 5000);

      const cleanup = this.subscribe((event) => {
        if (event.type === 'PAIR_ACCEPT') {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            cleanup();
            this.isTvOnline = true;
            this.currentPin = cleanPin;
            this.currentSessionId = event.payload?.sessionId || cleanSession;
            resolve({
              success: true,
              sessionId: this.currentSessionId,
              pinCode: this.currentPin,
              tvInfo: event.payload?.tvCapabilities,
            });
          }
        } else if (event.type === 'PAIR_REJECT') {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            cleanup();
            this.isTvOnline = false;
            const errMsg =
              event.payload?.message ||
              event.payload?.error ||
              `Invalid PIN "${cleanPin}". No TV console found with this code.`;
            resolve({
              success: false,
              error: errMsg,
            });
          }
        }
      });

      // Send GameHub-TV standard PAIR_REQUEST
      this.sendSignalingMessage({
        type: 'PAIR_REQUEST',
        sessionId: cleanSession || undefined,
        pinCode: cleanPin,
        pin: cleanPin,
        sender: 'mobile',
        timestamp: Date.now(),
        deviceInfo: {
          deviceId: `mobile_${Math.random().toString(36).substring(2, 8)}`,
          model: 'GameHub Mobile Controller',
          manufacturer: 'Universal',
          osVersion: 'Web-1.0',
          batteryLevel: 94,
          isCharging: false,
          networkType: 'wifi_5ghz',
          screenResolution: {
            width: typeof window !== 'undefined' ? window.innerWidth : 1080,
            height: typeof window !== 'undefined' ? window.innerHeight : 2400,
          },
        },
      });
    });
  }

  public disconnect() {
    if (this.pingInterval) clearInterval(this.pingInterval);
    if (this.statsInterval) clearInterval(this.statsInterval);

    if (this.dataChannel) {
      try {
        this.dataChannel.close();
      } catch {}
      this.dataChannel = null;
    }

    if (this.peerConnection) {
      try {
        this.peerConnection.close();
      } catch {}
      this.peerConnection = null;
    }

    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }

    this.connectionStatus = 'disconnected';
    this.isTvOnline = false;
    this.realPingMs = 0;
    this.emit('CONNECTION_STATUS', { status: 'disconnected' });
  }

  public sendSignalingMessage(msg: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  /**
   * Send realtime gamepad states to GameHub-TV
   */
  public sendGamepadState(state: GamepadState) {
    this.packetCount++;

    // 1. DataChannel direct WebRTC if open
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      try {
        this.dataChannel.send(
          JSON.stringify({
            type: 'CONTROLLER_INPUT',
            state,
            timestamp: Date.now(),
          })
        );
        return;
      } catch {}
    }

    // 2. WebSocket signaling transmission (GameHub-TV Protocol format)
    const tvInputMessage = {
      type: 'CONTROLLER_INPUT',
      sessionId: this.currentSessionId,
      sender: 'mobile',
      timestamp: Date.now(),
      input: {
        buttons: {
          a: state.buttonA,
          b: state.buttonB,
          x: state.buttonX,
          y: state.buttonY,
          l1: state.l1,
          r1: state.r1,
          l2: state.l2,
          r2: state.r2,
          l3: state.l3,
          r3: state.r3,
          dpadUp: state.dpadUp,
          dpadDown: state.dpadDown,
          dpadLeft: state.dpadLeft,
          dpadRight: state.dpadRight,
          select: state.select,
          start: state.start,
          home: state.home,
          turbo: state.turbo,
        },
        axes: {
          leftStickX: state.leftStick?.x ?? 0,
          leftStickY: state.leftStick?.y ?? 0,
          rightStickX: state.rightStick?.x ?? 0,
          rightStickY: state.rightStick?.y ?? 0,
          leftTrigger: state.l2Value ?? 0,
          rightTrigger: state.r2Value ?? 0,
        },
        gyro: state.gyro?.enabled
          ? {
              steer: state.gyro.steer,
              pitch: state.gyro.pitch,
            }
          : undefined,
        timestamp: state.timestamp,
      },
    };

    this.sendSignalingMessage(tvInputMessage);
  }

  /**
   * Send Smart TV D-Pad & Trackpad Navigation to GameHub-TV
   */
  public sendRemoteNav(payload: RemoteNavPayload) {
    HapticEngine.light();
    this.packetCount++;

    const navMsg = {
      type: 'NAV_COMMAND',
      sessionId: this.currentSessionId,
      sender: 'mobile',
      timestamp: Date.now(),
      payload,
    };

    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      try {
        this.dataChannel.send(JSON.stringify(navMsg));
        return;
      } catch {}
    }

    this.sendSignalingMessage(navMsg);
  }

  public sendKeyboardText(text: string) {
    this.sendRemoteNav({
      action: 'KEYBOARD_INPUT',
      text,
      timestamp: Date.now(),
    });
  }

  private async handleIncomingMessage(msg: any) {
    const { type, payload, sessionId, pinCode } = msg;

    switch (type) {
      case 'TV_REGISTERED':
      case 'RECEIVER_ONLINE':
      case 'RECEIVER_REGISTERED':
        this.isTvOnline = true;
        if (sessionId) this.currentSessionId = sessionId;
        if (pinCode) this.currentPin = pinCode;
        this.emit('RECEIVER_ONLINE', { sessionId: this.currentSessionId, pinCode: this.currentPin });
        break;

      case 'RECEIVER_OFFLINE':
      case 'DISCONNECT':
        this.isTvOnline = false;
        this.emit('RECEIVER_OFFLINE', payload);
        break;

      case 'PAIR_ACCEPT':
        this.isTvOnline = true;
        if (sessionId) this.currentSessionId = sessionId;
        if (pinCode) this.currentPin = pinCode;
        HapticEngine.success();
        this.emit('PAIR_ACCEPT', msg);
        break;

      case 'PAIR_REJECT':
        this.isTvOnline = false;
        this.emit('PAIR_REJECT', msg);
        break;

      case 'LAUNCH_GAME':
        this.emit('LAUNCH_GAME', msg.payload || payload);
        break;

      case 'HEARTBEAT_PONG':
      case 'PONG': {
        const sendTime = msg.originalTimestamp || payload?.clientTime;
        if (sendTime) {
          const rtt = Date.now() - sendTime;
          this.realPingMs = Math.max(1, Math.min(rtt, 999));
        }
        break;
      }
    }
  }

  private startPingLoop() {
    if (this.pingInterval) clearInterval(this.pingInterval);
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.lastPingSentTime = Date.now();
        this.sendSignalingMessage({
          type: 'HEARTBEAT_PING',
          sessionId: this.currentSessionId,
          sequence: Math.floor(Math.random() * 10000),
          timestamp: this.lastPingSentTime,
          sender: 'mobile',
        });
      }
    }, 2000);
  }

  private startStatsLoop() {
    if (this.statsInterval) clearInterval(this.statsInterval);
    this.statsInterval = setInterval(() => {
      const diagnostics: DiagnosticsData = {
        pingMs: this.realPingMs,
        fps: 60,
        bitrateKbps: Math.round(this.packetCount * 0.45 * 8),
        packetLossPercent: 0,
        batteryLevel: 94,
        isCharging: false,
        isDataChannelOpen: this.dataChannel?.readyState === 'open',
        connectedClients: this.isTvOnline ? 1 : 0,
      };
      this.packetCount = 0;
      this.emit('DIAGNOSTICS_UPDATE', diagnostics);
    }, 1000);
  }

  public getPin(): string {
    return this.currentPin;
  }

  public getSessionId(): string {
    return this.currentSessionId;
  }

  public getTargetTvHost(): string {
    return this.targetTvHost;
  }

  public setTargetTvHost(host: string) {
    this.targetTvHost = host;
  }

  public getStatus(): ConnectionStatus {
    return this.connectionStatus;
  }

  public getIsTvOnline(): boolean {
    return this.isTvOnline;
  }
}
