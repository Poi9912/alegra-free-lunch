/**
 * @jest-environment jsdom
 * @jest-environment-options {"url":"https://app.example.com"}
 */

import { render } from '@testing-library/react';
import { useWebSocket } from './useWebSocket';

class MockWebSocket {
  static OPEN = 1;
  static CONNECTING = 0;
  static instance: MockWebSocket;
  readyState = MockWebSocket.CONNECTING;
  onopen?: () => void;
  onmessage?: (event: { data: string }) => void;
  onclose?: (event: { code: number }) => void;
  onerror?: () => void;
  close = jest.fn();

  constructor(public url: string) {
    MockWebSocket.instance = this;
  }
}

function Harness() {
  useWebSocket(jest.fn());
  return null;
}

test('uses the secure protocol and current remote host', () => {
  localStorage.setItem('token', 'jwt-token');
  Object.defineProperty(global, 'WebSocket', {
    configurable: true,
    value: MockWebSocket,
  });

  render(<Harness />);

  expect(MockWebSocket.instance.url).toBe('wss://app.example.com/api/ws?token=jwt-token');
});
