import { act, render } from '@testing-library/react';
import { useWebSocket } from './useWebSocket';

class MockWebSocket {
  static OPEN = 1;
  static CONNECTING = 0;
  static instances: MockWebSocket[] = [];
  readyState = MockWebSocket.CONNECTING;
  onopen?: () => void;
  onmessage?: (event: { data: string }) => void;
  onclose?: (event: { code: number }) => void;
  onerror?: () => void;
  close = jest.fn(() => {
    this.readyState = 3;
  });

  constructor(public url: string) {
    MockWebSocket.instances.push(this);
  }
}

function Harness({ onMessage }: { onMessage: (type: string, data: unknown) => void }) {
  useWebSocket(onMessage);
  return null;
}

describe('useWebSocket', () => {
  const originalWebSocket = global.WebSocket;

  beforeEach(() => {
    MockWebSocket.instances = [];
    localStorage.clear();
    Object.defineProperty(global, 'WebSocket', {
      configurable: true,
      value: MockWebSocket,
    });
    window.history.replaceState({}, '', '/');
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    Object.defineProperty(global, 'WebSocket', {
      configurable: true,
      value: originalWebSocket,
    });
  });

  test('does not connect without an authentication token', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    render(<Harness onMessage={jest.fn()} />);

    expect(MockWebSocket.instances).toHaveLength(0);
    expect(warn).toHaveBeenCalled();
  });

  test('connects to the local backend and forwards parsed events', () => {
    localStorage.setItem('token', 'jwt-token');
    const onMessage = jest.fn();

    render(<Harness onMessage={onMessage} />);

    const socket = MockWebSocket.instances[0];
    expect(socket.url).toBe('ws://localhost:3000/api/ws?token=jwt-token');

    act(() => socket.onmessage?.({ data: '{"type":"ORDER_UPDATED","data":{"id":1}}' }));
    expect(onMessage).toHaveBeenCalledWith('ORDER_UPDATED', { id: 1 });

    act(() => socket.onopen?.());
    expect(socket.readyState).toBe(MockWebSocket.CONNECTING);
  });

  test('logs malformed WebSocket messages', () => {
    localStorage.setItem('token', 'jwt-token');
    const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
    render(<Harness onMessage={jest.fn()} />);

    act(() => MockWebSocket.instances[0].onmessage?.({ data: '{bad json' }));

    expect(errorLog).toHaveBeenCalledWith('Failed to parse WebSocket message:', expect.any(SyntaxError));
  });

  test('reconnects after an unmounted-safe close and closes on error', () => {
    jest.useFakeTimers();
    localStorage.setItem('token', 'jwt-token');
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { unmount } = render(<Harness onMessage={jest.fn()} />);
    const socket = MockWebSocket.instances[0];

    act(() => socket.onerror?.());
    expect(socket.close).toHaveBeenCalledTimes(1);

    act(() => socket.onclose?.({ code: 1006 }));
    expect(warn).toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(3000));
    expect(MockWebSocket.instances).toHaveLength(2);

    const activeSocket = MockWebSocket.instances[1];
    unmount();
    expect(activeSocket.close).toHaveBeenCalledTimes(1);
    act(() => activeSocket.onclose?.({ code: 1000 }));
    act(() => jest.advanceTimersByTime(3000));
    expect(MockWebSocket.instances).toHaveLength(2);
  });
});
