import { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import { createClient } from 'redis';
import { logger } from './logger.js';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

let wss = null;
const clients = new Set();
const subscriber = createClient({ url: REDIS_URL });

export async function setupWebSocketServer(server) {
  wss = new WebSocketServer({ noServer: true });

  // Initialize Redis subscriber for cross-instance and worker synchronization
  try {
    await subscriber.connect();

    await subscriber.subscribe('events:orders', (message) => {
      try {
        const event = JSON.parse(message);
        logger.info(`[WS Pub/Sub] Broadcasting order event: ${event.type}`);
        broadcastUpdate(event.type, event.data);
      } catch (err) {
        logger.error('Failed to parse order pub/sub event', err);
      }
    });

    await subscriber.subscribe('events:inventory', (message) => {
      try {
        const event = JSON.parse(message);
        logger.info(`[WS Pub/Sub] Broadcasting inventory event: ${event.type}`);
        broadcastUpdate(event.type, event.data);
      } catch (err) {
        logger.error('Failed to parse inventory pub/sub event', err);
      }
    });

    logger.info('🟢 WebSocket manager successfully subscribed to Redis Pub/Sub channels.');
  } catch (err) {
    logger.error('Failed to connect Redis subscriber in WebSocket manager', err);
  }

  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url, `http://${request.headers.host}`);
    console.log(`🔍 [WS Upgrade] Incoming request path: ${url.pathname}`);

    if (url.pathname !== '/api/ws') {
      console.warn(`❌ [WS Upgrade] Rejected: Invalid path (${url.pathname})`);
      socket.destroy();
      return;
    }

    const token = url.searchParams.get('token');
    if (!token) {
      console.warn('❌ [WS Upgrade] Rejected: Missing token query parameter');
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    try {
      const user = jwt.verify(token, JWT_SECRET);
      console.log(`✅ [WS Upgrade] Authenticated user successfully: ${user.username} (${user.role})`);
      
      wss.handleUpgrade(request, socket, head, (ws) => {
        ws.user = user;
        wss.emit('connection', ws, request);
      });
    } catch (err) {
      console.error(`❌ [WS Upgrade] Rejected: JWT Verification Failed -> ${err.message}`);
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
    }
  });

  wss.on('connection', (ws) => {
    clients.add(ws);
    console.log(`🟢 [WS Connection] Client connected. Total active clients: ${clients.size}`);

    ws.on('close', () => {
      clients.delete(ws);
      console.log(`🔴 [WS Connection] Client disconnected. Total active clients: ${clients.size}`);
    });
  });
}

export function broadcastUpdate(type, payload) {
  const message = JSON.stringify({ type, data: payload });
  for (const client of clients) {
    if (client.readyState === 1) { // OPEN
      client.send(message);
    }
  }
}