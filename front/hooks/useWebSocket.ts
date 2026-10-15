'use client';

import { useEffect, useRef } from 'react';

export function useWebSocket(onMessage: (type: string, data: any) => void) {
  const savedCallback = useRef(onMessage);

  useEffect(() => {
    savedCallback.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      console.warn('❌ WebSocket connection aborted: No auth token found in localStorage.');
      return;
    }

    const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const backendWsHost = isDev ? 'localhost:3000' : window.location.host;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    
    const wsUrl = `${protocol}//${backendWsHost}/api/ws?token=${token}`;

    let ws: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout;
    let isMounted = true;

    const connect = () => {
      if (!isMounted) return;

      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('✅ WebSocket connected successfully to backend!');
      };

      ws.onmessage = (event) => {
        try {
          const { type, data } = JSON.parse(event.data);
          savedCallback.current(type, data);
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
        }
      };

      ws.onclose = (event) => {
        // Only attempt to reconnect if the component is still mounted and it wasn't a clean intentional close
        if (isMounted) {
          console.warn(`⚠️ WebSocket closed (code: {event.code}). Reconnecting in 3s...`);
          reconnectTimeout = setTimeout(connect, 3000);
        }
      };

      ws.onerror = () => {
        // Suppress noisy logs during React strict mode double-invocations
        ws?.close();
      };
    };

    connect();

    return () => {
      isMounted = false;
      clearTimeout(reconnectTimeout);
      if (ws) {
        // Ensure socket is in OPEN or CONNECTING state before closing to avoid abort exceptions
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close();
        }
      }
    };
  }, []);
}