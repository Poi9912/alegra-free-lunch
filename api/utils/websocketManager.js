import { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key';
let wss = null;
const clients = new Set();

export function setupWebSocketServer(server) {
  wss = new WebSocketServer({ noServer: true });

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