const { EventEmitter } = require('node:events');

const client = new EventEmitter();
client.readyState = 1;
client.send = jest.fn();

class MockWebSocketServer extends EventEmitter {
  constructor(options) {
    super();
    this.options = options;
    this.handleUpgrade = jest.fn((request, socket, head, callback) => callback(client));
  }
}

const verify = jest.fn();
const subscriber = {
  connect: jest.fn(),
  subscribe: jest.fn(),
};
const logger = { error: jest.fn(), info: jest.fn() };

jest.doMock('ws', () => ({ WebSocketServer: MockWebSocketServer }));
jest.doMock('jsonwebtoken', () => ({
  __esModule: true,
  default: { verify },
}));
jest.doMock('redis', () => ({ createClient: jest.fn(() => subscriber) }));
jest.doMock('./logger.js', () => ({ logger }));

const { setupWebSocketServer, broadcastUpdate } = require('./websocketManager.js');

function setupServer() {
  const server = new EventEmitter();
  return setupWebSocketServer(server).then(() => ({ server }));
}

function upgrade(server, path, socketOverrides = {}) {
  const socket = {
    destroy: jest.fn(),
    write: jest.fn(),
    ...socketOverrides,
  };
  const request = {
    url: path,
    headers: { host: 'localhost' },
  };
  server.emit('upgrade', request, socket, Buffer.from('head'));
  return { socket, request };
}

describe('websocketManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    subscriber.connect.mockResolvedValue(undefined);
    subscriber.subscribe.mockResolvedValue(undefined);
    client.readyState = 1;
    client.removeAllListeners();
    client.send.mockClear();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('initializes Redis subscriptions and broadcasts valid events', async () => {
    verify.mockReturnValue({ username: 'alex', role: 'manager' });
    const callbacks = {};
    subscriber.subscribe.mockImplementation(async (channel, callback) => {
      callbacks[channel] = callback;
    });

    const { server } = await setupServer();

    expect(server.listenerCount('upgrade')).toBe(1);
    expect(subscriber.connect).toHaveBeenCalledTimes(1);
    expect(subscriber.subscribe).toHaveBeenCalledTimes(2);

    await upgrade(server, '/api/ws?token=valid');

    callbacks['events:orders']('{"type":"ORDER_UPDATED","data":{"id":1}}');
    expect(client.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'ORDER_UPDATED', data: { id: 1 } })
    );

    callbacks['events:inventory']('{"type":"INVENTORY_UPDATED","data":{"id":2}}');
    expect(client.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'INVENTORY_UPDATED', data: { id: 2 } })
    );
  });

  test.each([
    ['events:orders', 'Failed to parse order pub/sub event'],
    ['events:inventory', 'Failed to parse inventory pub/sub event'],
  ])('logs malformed pub/sub messages on %s', async (channel, expectedMessage) => {
    const callbacks = {};
    subscriber.subscribe.mockImplementation(async (name, callback) => {
      callbacks[name] = callback;
    });
    await setupServer();

    callbacks[channel]('{malformed');

    expect(logger.error).toHaveBeenCalledWith(expectedMessage, expect.any(SyntaxError));
  });

  test('logs Redis setup failures but still configures the upgrade handler', async () => {
    const error = new Error('Redis unavailable');
    subscriber.connect.mockRejectedValue(error);

    const { server } = await setupServer();

    expect(logger.error).toHaveBeenCalledWith(
      'Failed to connect Redis subscriber in WebSocket manager',
      error
    );
    expect(server.listenerCount('upgrade')).toBe(1);
  });

  test('rejects upgrades on paths other than the WebSocket endpoint', async () => {
    const { server } = await setupServer();
    const { socket } = upgrade(server, '/not-websocket?token=valid');

    expect(socket.destroy).toHaveBeenCalledTimes(1);
    expect(socket.write).not.toHaveBeenCalled();
  });

  test('rejects WebSocket upgrades without a token', async () => {
    const { server } = await setupServer();
    const { socket } = upgrade(server, '/api/ws');

    expect(socket.write).toHaveBeenCalledWith('HTTP/1.1 401 Unauthorized\r\n\r\n');
    expect(socket.destroy).toHaveBeenCalledTimes(1);
  });

  test('rejects WebSocket upgrades with an invalid token', async () => {
    verify.mockImplementation(() => {
      throw new Error('invalid token');
    });
    const { server } = await setupServer();
    const { socket } = upgrade(server, '/api/ws?token=invalid');

    expect(verify).toHaveBeenCalledWith('invalid', expect.any(String));
    expect(socket.write).toHaveBeenCalledWith('HTTP/1.1 403 Forbidden\r\n\r\n');
    expect(socket.destroy).toHaveBeenCalledTimes(1);
  });

  test('authenticates connections and removes clients when they close', async () => {
    const user = { username: 'alex', role: 'manager' };
    verify.mockReturnValue(user);
    const { server } = await setupServer();
    const { request } = upgrade(server, '/api/ws?token=valid');

    expect(client.user).toBe(user);
    expect(client.listenerCount('close')).toBe(1);
    broadcastUpdate('DIRECT', { id: 10 });
    expect(client.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'DIRECT', data: { id: 10 } })
    );

    client.readyState = 3;
    broadcastUpdate('CLOSED', {});
    expect(client.send).toHaveBeenCalledTimes(1);

    client.emit('close');
    client.send.mockClear();
    broadcastUpdate('AFTER_CLOSE', {});
    expect(client.send).not.toHaveBeenCalled();
    expect(request.url).toBe('/api/ws?token=valid');
  });
});
