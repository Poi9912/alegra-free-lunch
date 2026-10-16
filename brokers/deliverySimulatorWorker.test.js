import { jest } from '@jest/globals';

const mockDbPool = { query: jest.fn() };
const mockRedisClient = {
  publish: jest.fn(),
  xAck: jest.fn(),
  xGroupCreate: jest.fn(),
  xReadGroup: jest.fn(),
};
const mockLogger = { error: jest.fn(), info: jest.fn() };
const mockGetRandomDelay = jest.fn();

describe('delivery simulator worker', () => {
  beforeEach(async () => {
    jest.resetModules();
    jest.clearAllMocks();
    mockDbPool.query.mockResolvedValue({ rows: [] });
    mockRedisClient.publish.mockResolvedValue(1);
    mockRedisClient.xAck.mockResolvedValue(1);
    mockRedisClient.xGroupCreate.mockResolvedValue(undefined);
    mockRedisClient.xReadGroup.mockImplementation(() => new Promise(() => {}));
    mockGetRandomDelay.mockReturnValue(30000);

    jest.unstable_mockModule('./shared/db.js', () => ({
      dbPool: mockDbPool,
      redisClient: mockRedisClient,
    }));
    jest.unstable_mockModule('./shared/logger.js', () => ({ logger: mockLogger }));
    jest.unstable_mockModule('./shared/timer.js', () => ({
      getRandomDelay: mockGetRandomDelay,
    }));
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('delivers a stream order, publishes its update, and acknowledges it', async () => {
    jest.useFakeTimers();
    mockRedisClient.xReadGroup.mockResolvedValueOnce([{
      messages: [{
        id: 'delivery-1',
        message: { orderId: '8', orderNumber: 'ORDEN-8' },
      }],
    }]);

    await loadWorker();
    await jest.advanceTimersByTimeAsync(30000);
    await flushMicrotasks();

    expect(mockRedisClient.xGroupCreate).toHaveBeenCalledWith(
      'stream:orders:delivery',
      'delivery-group',
      '0',
      { MKSTREAM: true }
    );
    expect(mockRedisClient.xReadGroup).toHaveBeenCalledWith(
      'delivery-group',
      'worker-delivery',
      [{ key: 'stream:orders:delivery', id: '>' }],
      { COUNT: process.env.BATCH_COUNT || 10, BLOCK: 5000 }
    );
    expect(mockDbPool.query).toHaveBeenCalledWith(
      expect.stringContaining("SET status = 'delivered'"),
      ['8']
    );
    expect(mockRedisClient.publish).toHaveBeenCalledWith(
      'events:orders',
      JSON.stringify({
        type: 'ORDER_UPDATED',
        data: { id: 8, order_number: 'ORDEN-8', status: 'delivered' },
      })
    );
    expect(mockRedisClient.xAck).toHaveBeenCalledWith(
      'stream:orders:delivery',
      'delivery-group',
      'delivery-1'
    );
  });

  test('logs database failures and acknowledges the stream message', async () => {
    jest.useFakeTimers();
    const error = new Error('database unavailable');
    mockDbPool.query.mockRejectedValueOnce(error);
    mockRedisClient.xReadGroup.mockResolvedValueOnce([{
      messages: [{
        id: 'delivery-db-error',
        message: { orderId: '9', orderNumber: 'ORDEN-9' },
      }],
    }]);

    await loadWorker();
    await jest.advanceTimersByTimeAsync(30000);
    await flushMicrotasks();

    expect(mockLogger.error).toHaveBeenCalledWith('Error delivering order ORDEN-9', error);
    expect(mockRedisClient.publish).not.toHaveBeenCalled();
    expect(mockRedisClient.xAck).toHaveBeenCalledWith(
      'stream:orders:delivery',
      'delivery-group',
      'delivery-db-error'
    );
  });

  test('ignores existing consumer groups and logs stream read errors', async () => {
    const error = new Error('stream failed');
    mockRedisClient.xGroupCreate.mockRejectedValueOnce(new Error('group exists'));
    mockRedisClient.xReadGroup
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(error)
      .mockImplementation(() => new Promise(() => {}));
    jest.spyOn(globalThis, 'setTimeout').mockImplementation(() => 0);

    await loadWorker();

    expect(mockLogger.error).toHaveBeenCalledWith('DeliverySimulator loop error', error);
    expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 3000);
  });
});

async function loadWorker() {
  await jest.isolateModulesAsync(async () => {
    await import('./deliverySimulatorWorker.js');
  });
  await flushMicrotasks();
}

async function flushMicrotasks() {
  for (let i = 0; i < 30; i += 1) {
    await Promise.resolve();
  }
}
