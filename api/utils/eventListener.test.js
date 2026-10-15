const subscriber = {
  on: jest.fn(),
  connect: jest.fn(),
  subscribe: jest.fn(),
};
const createClient = jest.fn(() => subscriber);
const broadcastUpdate = jest.fn();
const logger = { error: jest.fn(), info: jest.fn() };

jest.doMock('redis', () => ({ createClient }));
jest.doMock('./websocketManager.js', () => ({ broadcastUpdate }));
jest.doMock('./logger.js', () => ({ logger }));

const { setupRedisEventListeners } = require('./eventListener.js');

describe('setupRedisEventListeners', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    subscriber.connect.mockResolvedValue(undefined);
    subscriber.subscribe.mockResolvedValue(undefined);
  });

  test('connects and subscribes to order and inventory events', async () => {
    const callbacks = {};
    subscriber.subscribe.mockImplementation(async (channel, callback) => {
      callbacks[channel] = callback;
    });

    await setupRedisEventListeners();

    expect(createClient).toHaveBeenCalledWith({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
    });
    expect(subscriber.on).toHaveBeenCalledWith('error', expect.any(Function));
    expect(subscriber.connect).toHaveBeenCalledTimes(1);
    expect(subscriber.subscribe).toHaveBeenCalledTimes(2);

    callbacks['events:orders']('{"type":"ORDER_UPDATED","data":{"id":3}}');
    callbacks['events:inventory']('{"type":"INVENTORY_UPDATED","data":{"id":9}}');

    expect(broadcastUpdate).toHaveBeenNthCalledWith(1, 'ORDER_UPDATED', { id: 3 });
    expect(broadcastUpdate).toHaveBeenNthCalledWith(2, 'INVENTORY_UPDATED', { id: 9 });
    expect(logger.info).toHaveBeenCalledWith(
      '🟢 Redis event listener successfully subscribed to channels.'
    );
  });

  test.each([
    ['events:orders', 'Failed to parse order event message'],
    ['events:inventory', 'Failed to parse inventory event message'],
  ])('logs malformed messages from %s', async (channel, expectedMessage) => {
    const callbacks = {};
    subscriber.subscribe.mockImplementation(async (name, callback) => {
      callbacks[name] = callback;
    });
    await setupRedisEventListeners();

    callbacks[channel]('{malformed');

    expect(logger.error).toHaveBeenCalledWith(expectedMessage, expect.any(SyntaxError));
    expect(broadcastUpdate).not.toHaveBeenCalled();
  });

  test('logs subscriber connection errors and rejects setup', async () => {
    const error = new Error('Redis unavailable');
    subscriber.connect.mockRejectedValue(error);

    await expect(setupRedisEventListeners()).rejects.toBe(error);

    expect(subscriber.subscribe).not.toHaveBeenCalled();
  });

  test('logs subscriber errors reported by Redis', async () => {
    await setupRedisEventListeners();
    const errorHandler = subscriber.on.mock.calls[0][1];
    const error = new Error('Subscriber socket error');

    errorHandler(error);

    expect(logger.error).toHaveBeenCalledWith('Redis Subscriber Error', error);
  });
});
