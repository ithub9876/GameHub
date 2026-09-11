import express, { Request, Response } from 'express';
import http from 'http';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';

const app = express();
const server = http.createServer(app);
const PORT = 3000;
const HOST = '0.0.0.0';

app.use(express.json());

interface ClientSocket extends WebSocket {
  id?: string;
  pin?: string;
  sessionId?: string;
  role?: 'mobile' | 'tv' | 'receiver';
}

interface TvSession {
  sessionId: string;
  pinCode: string;
  tvSocket: WebSocket | null;
  mobileSockets: Set<WebSocket>;
  paired: boolean;
  deviceInfo: any;
  createdAt: number;
  lastActivity: number;
}

// In-memory room store indexed by both SessionID and PIN
const sessionsById = new Map<string, TvSession>();
const sessionsByPin = new Map<string, TvSession>();

function getExistingSession(pinOrSessionId?: string): TvSession | null {
  if (!pinOrSessionId) return null;
  const cleanKey = pinOrSessionId.trim().toUpperCase();
  if (sessionsById.has(cleanKey)) {
    return sessionsById.get(cleanKey)!;
  }
  if (sessionsByPin.has(cleanKey)) {
    return sessionsByPin.get(cleanKey)!;
  }
  return null;
}

function registerTvSession(preferredPin?: string, preferredSessionId?: string): TvSession {
  const cleanPin = preferredPin ? preferredPin.trim().toUpperCase() : '';
  const cleanSession = preferredSessionId ? preferredSessionId.trim().toUpperCase() : '';

  const existing =
    (cleanPin && getExistingSession(cleanPin)) ||
    (cleanSession && getExistingSession(cleanSession)) ||
    null;

  if (existing) {
    existing.lastActivity = Date.now();
    return existing;
  }

  // Create new real TV session only when TV registers
  const sessionId = cleanSession.startsWith('GH-') ? cleanSession : `GH-${Math.floor(1000 + Math.random() * 9000)}`;
  const pinCode = /^\d{4}$/.test(cleanPin) ? cleanPin : Math.floor(1000 + Math.random() * 9000).toString();

  const session: TvSession = {
    sessionId,
    pinCode,
    tvSocket: null,
    mobileSockets: new Set(),
    paired: false,
    deviceInfo: { model: 'GameHub TV Console' },
    createdAt: Date.now(),
    lastActivity: Date.now(),
  };

  sessionsById.set(sessionId, session);
  sessionsByPin.set(pinCode, session);
  return session;
}

// Auto purge stale sessions after 1 hour
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessionsById.entries()) {
    const isTvAlive = session.tvSocket && session.tvSocket.readyState === WebSocket.OPEN;
    const isMobileAlive = Array.from(session.mobileSockets).some((s) => s.readyState === WebSocket.OPEN);

    if (!isTvAlive && !isMobileAlive && now - session.lastActivity > 60 * 60 * 1000) {
      sessionsById.delete(id);
      sessionsByPin.delete(session.pinCode);
    }
  }
}, 60000);

// API Endpoints
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'GameHub Mobile & TV Signaling Relay',
    activeSessions: sessionsById.size,
    targetTvApp: 'https://game-tv.vercel.app',
    timestamp: Date.now(),
  });
});

app.get('/api/session/:code', (req: Request, res: Response) => {
  const code = req.params.code.trim().toUpperCase();
  const session = getExistingSession(code);

  if (!session) {
    return res.status(404).json({ exists: false, message: `No active TV session with code ${code}` });
  }

  const isTvAlive = !!(session.tvSocket && session.tvSocket.readyState === WebSocket.OPEN);
  const activeMobiles = Array.from(session.mobileSockets).filter((s) => s.readyState === WebSocket.OPEN).length;

  return res.json({
    exists: true,
    sessionId: session.sessionId,
    pinCode: session.pinCode,
    paired: session.paired,
    tvConnected: isTvAlive,
    mobileCount: activeMobiles,
  });
});

// WebSocket Signaling Broker
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws: ClientSocket, req) => {
  const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
  const rawRole = url.searchParams.get('role') || 'mobile';
  const role: 'mobile' | 'tv' | 'receiver' = rawRole === 'tv' || rawRole === 'receiver' ? 'tv' : 'mobile';
  const pinParam = url.searchParams.get('pin')?.toUpperCase();
  const sessionParam = url.searchParams.get('sessionId')?.toUpperCase();

  ws.role = role;
  ws.id = `client_${Math.random().toString(36).substring(2, 9)}`;

  const lookupKey = sessionParam || pinParam;
  if (lookupKey) {
    if (role === 'tv') {
      const session = registerTvSession(pinParam, sessionParam);
      ws.sessionId = session.sessionId;
      ws.pin = session.pinCode;
      session.tvSocket = ws;
      session.lastActivity = Date.now();
      for (const mob of session.mobileSockets) {
        if (mob.readyState === WebSocket.OPEN) {
          mob.send(JSON.stringify({ type: 'RECEIVER_ONLINE', pin: session.pinCode, sessionId: session.sessionId }));
        }
      }
    } else {
      const session = getExistingSession(lookupKey);
      if (session) {
        ws.sessionId = session.sessionId;
        ws.pin = session.pinCode;
        session.mobileSockets.add(ws);
        session.lastActivity = Date.now();
      }
    }
  }

  ws.on('message', (rawData: string) => {
    try {
      const msg = JSON.parse(rawData.toString());
      const { type, sessionId, pin, pinCode, payload } = msg;
      const targetKey = sessionId || pin || pinCode || ws.sessionId || ws.pin || '';

      // 1. TV Registration (standard GameHub-TV Protocol)
      if (type === 'REGISTER_TV' || type === 'REGISTER_RECEIVER') {
        const session = registerTvSession(pin || pinCode, sessionId);
        session.lastActivity = Date.now();
        ws.role = 'tv';
        ws.sessionId = session.sessionId;
        ws.pin = session.pinCode;
        session.tvSocket = ws;

        const origin = req.headers.host || `localhost:${PORT}`;
        const protocol = req.headers['x-forwarded-proto'] || 'http';
        const baseUrl = `${protocol}://${origin}`;
        const pairingUrl = `${baseUrl}/?pair=${session.sessionId}&pin=${session.pinCode}`;
        const qrPayload = JSON.stringify({
          protocol: 'gamehub-v1',
          type: 'pair',
          sessionId: session.sessionId,
          pin: session.pinCode,
          host: baseUrl,
        });

        ws.send(
          JSON.stringify({
            type: 'TV_REGISTERED',
            sessionId: session.sessionId,
            pinCode: session.pinCode,
            pairingUrl,
            qrPayload,
            stunServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:stun1.l.google.com:19302' },
            ],
            timestamp: Date.now(),
            sender: 'server',
          })
        );

        // Notify any mobile sockets waiting
        for (const mob of session.mobileSockets) {
          if (mob.readyState === WebSocket.OPEN) {
            mob.send(JSON.stringify({ type: 'RECEIVER_ONLINE', pin: session.pinCode, sessionId: session.sessionId }));
          }
        }
        return;
      }

      // 2. Mobile Pair Request - STRICT REAL-WORLD VALIDATION
      if (type === 'PAIR_REQUEST') {
        ws.role = 'mobile';
        const reqPin = (pin || pinCode || '').toString().trim().toUpperCase();
        const reqSession = (sessionId || '').toString().trim().toUpperCase();

        // 1. Find session by PIN or SessionID
        let session: TvSession | null = null;
        if (reqPin) {
          session = getExistingSession(reqPin);
        }
        if (!session && reqSession) {
          session = getExistingSession(reqSession);
        }

        // If no TV session was ever registered -> REJECT!
        if (!session) {
          const isVercelFallback = reqPin === '4829' || reqSession === 'GH-8492';
          const msgText = isVercelFallback
            ? `TV PIN "4829" is GameHub-TV's offline fallback on Vercel. Your TV hasn't connected to the WebSocket relay yet because Vercel doesn't host WebSockets. Open "TV Setup" in this app for the TV prompt to connect it!`
            : `Invalid TV PIN "${reqPin || reqSession}". No active GameHub TV console found with this code.`;

          ws.send(
            JSON.stringify({
              type: 'PAIR_REJECT',
              sessionId: reqSession,
              pinCode: reqPin,
              error: isVercelFallback ? 'TV_NOT_CONNECTED_TO_RELAY' : 'INVALID_PIN',
              reason: isVercelFallback ? 'TV_NOT_CONNECTED_TO_RELAY' : 'INVALID_PIN',
              message: msgText,
              timestamp: Date.now(),
              sender: 'server',
            })
          );
          return;
        }

        // 2. Verify TV console is ACTUALLY connected and open
        const isTvAlive = session.tvSocket && session.tvSocket.readyState === WebSocket.OPEN;
        if (!isTvAlive) {
          ws.send(
            JSON.stringify({
              type: 'PAIR_REJECT',
              sessionId: session.sessionId,
              pinCode: reqPin,
              error: 'TV_OFFLINE',
              reason: 'TV_OFFLINE',
              message: `GameHub TV [${session.pinCode}] is currently offline or disconnected. Please open the GameHub TV app.`,
              timestamp: Date.now(),
              sender: 'server',
            })
          );
          return;
        }

        // 3. Verify PIN strictly if PIN was provided
        if (reqPin && session.pinCode && reqPin !== session.pinCode.toUpperCase()) {
          ws.send(
            JSON.stringify({
              type: 'PAIR_REJECT',
              sessionId: session.sessionId,
              pinCode: reqPin,
              error: 'INVALID_PIN',
              reason: 'INVALID_PIN',
              message: `Invalid PIN "${reqPin}". It does not match the active TV PIN (${session.pinCode}).`,
              timestamp: Date.now(),
              sender: 'server',
            })
          );
          return;
        }

        ws.sessionId = session.sessionId;
        ws.pin = session.pinCode;
        session.mobileSockets.add(ws);
        session.deviceInfo = payload?.deviceInfo || msg.deviceInfo || { model: 'GameHub Mobile Controller' };
        session.lastActivity = Date.now();

        // Forward PAIR_REQUEST to the real connected TV socket!
        session.tvSocket.send(JSON.stringify(msg));
        console.log(`[Signaling] Forwarded PAIR_REQUEST to TV socket for session ${session.sessionId} (PIN: ${session.pinCode})`);
        return;
      }

      // 3. For any subsequent messages, retrieve target session
      const session = targetKey ? getExistingSession(targetKey) : (ws.sessionId ? getExistingSession(ws.sessionId) : null);
      if (!session) return;
      session.lastActivity = Date.now();

      // 3. Pair Accept / Reject from TV
      if (type === 'PAIR_ACCEPT' || type === 'PAIR_REJECT') {
        session.paired = type === 'PAIR_ACCEPT';
        for (const mob of session.mobileSockets) {
          if (mob.readyState === WebSocket.OPEN) {
            mob.send(JSON.stringify(msg));
          }
        }
        return;
      }

      // 4. Heartbeat
      if (type === 'HEARTBEAT_PING' || type === 'PING') {
        ws.send(
          JSON.stringify({
            type: type === 'HEARTBEAT_PING' ? 'HEARTBEAT_PONG' : 'PONG',
            sessionId: session.sessionId,
            sequence: msg.sequence,
            originalTimestamp: msg.timestamp || payload?.clientTime,
            payload: { clientTime: payload?.clientTime, serverTime: Date.now() },
            timestamp: Date.now(),
            sender: 'server',
          })
        );
        return;
      }

      // 5. Gamepad & Remote Navigation Input Broadcasting
      if (
        type === 'CONTROLLER_INPUT' ||
        type === 'GAMEPAD_INPUT' ||
        type === 'NAV_INPUT' ||
        type === 'NAV_COMMAND' ||
        type === 'LAUNCH_GAME' ||
        type === 'GAME_LAUNCH_STATUS' ||
        type === 'TERMINATE_GAME' ||
        type === 'REQUEST_QUALITY_CHANGE'
      ) {
        if (ws.role === 'mobile') {
          if (session.tvSocket && session.tvSocket.readyState === WebSocket.OPEN) {
            session.tvSocket.send(JSON.stringify(msg));
          }
        } else {
          for (const mob of session.mobileSockets) {
            if (mob.readyState === WebSocket.OPEN) {
              mob.send(JSON.stringify(msg));
            }
          }
        }
        return;
      }

      // 6. WebRTC SDP & ICE Candidates
      if (
        type === 'SIGNAL_OFFER' ||
        type === 'SIGNAL_ANSWER' ||
        type === 'SIGNAL_ICE_CANDIDATE' ||
        type === 'SDP_OFFER' ||
        type === 'SDP_ANSWER' ||
        type === 'ICE_CANDIDATE'
      ) {
        const targetSocket = ws.role === 'mobile' ? session.tvSocket : null;
        if (targetSocket && targetSocket.readyState === WebSocket.OPEN) {
          targetSocket.send(JSON.stringify(msg));
        } else if (ws.role === 'tv') {
          for (const mob of session.mobileSockets) {
            if (mob.readyState === WebSocket.OPEN) {
              mob.send(JSON.stringify(msg));
            }
          }
        }
        return;
      }

      // Fallback: route between mobile and TV
      if (ws.role === 'mobile' && session.tvSocket && session.tvSocket.readyState === WebSocket.OPEN) {
        session.tvSocket.send(JSON.stringify(msg));
      } else if (ws.role === 'tv') {
        for (const mob of session.mobileSockets) {
          if (mob.readyState === WebSocket.OPEN) {
            mob.send(JSON.stringify(msg));
          }
        }
      }
    } catch (err) {
      console.error('[Signaling] Error routing WS message:', err);
    }
  });

  ws.on('close', () => {
    const key = ws.sessionId || ws.pin;
    if (key) {
      const session = sessionsById.get(key) || sessionsByPin.get(key);
      if (session) {
        if (ws.role === 'tv' && session.tvSocket === ws) {
          session.tvSocket = null;
          for (const mob of session.mobileSockets) {
            if (mob.readyState === WebSocket.OPEN) {
              mob.send(JSON.stringify({ type: 'RECEIVER_OFFLINE', pin: session.pinCode, sessionId: session.sessionId }));
            }
          }
        } else if (ws.role === 'mobile') {
          session.mobileSockets.delete(ws);
          if (session.tvSocket && session.tvSocket.readyState === WebSocket.OPEN) {
            session.tvSocket.send(JSON.stringify({ type: 'DISCONNECT', sender: 'mobile', timestamp: Date.now() }));
          }
        }
      }
    }
  });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, HOST, () => {
    console.log(`[GameHub Mobile Engine] Ready on http://${HOST}:${PORT}`);
  });
}

startServer();
