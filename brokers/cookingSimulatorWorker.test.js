import { jest } from '@jest/globals';

const mockDbPool = { query: jest.fn() };
const mockRedisClient = {
  publish: jest.fn(),
  xAck: jest.fn(),
  xAdd: jest.fn(),
  xGroupCreate: jest.fn(),
  xReadGroup: jest.fn(),
};
const mockLogger = { error: jest.fn(), info: jest.fn() };
const mockGetRandomDelay = jest.fn();

describe('cooking simulator worker', () => {
  beforeEach(async () => {
    jest.resetModules();
    jest.clearAllMocks();
    mockDbPool.query.mockResolvedValue({ rows: [] });
    mockRedisClient.publish.mockResolvedValue(1);
    mockRedisClient.xAck.mockResolvedValue(1);
    mockRedisClient.xAdd.mockResolvedValue('stream-id');
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

  test('cooks a stream order, publishes status events, queues delivery, and acknowledges it', async () => {
    jest.useFakeTimers();
    mockRedisClient.xReadGroup.mockResolvedValueOnce([{
      messages: [{
        id: 'cooking-1',
        message: { orderId: '5', orderNumber: 'ORDEN-5' },
      }],
    }]);

    await loadWorker();
    await jest.advanceTimersByTimeAsync(30000);
    await flushMicrotasks();

    expect(mockRedisClient.xGroupCreate).toHaveBeenCalledWith(
      'stream:orders:cooking',
      'cooking-group',
      '0',
      { MKSTREAM: true }
    );
    expect(mockRedisClient.xReadGroup).toHaveBeenCalledWith(
      'cooking-group',
      'worker-cooking',
      [{ key: 'stream:orders:cooking', id: '>' }],
      { COUNT: expect.any(Number), BLOCK: 5000 }
    );
    expect(mockDbPool.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("SET status = 'cooking'"),
      ['5']
    );
    expect(mockDbPool.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("SET status = 'ready'"),
      ['5']
    );
    expect(mockRedisClient.publish).toHaveBeenNthCalledWith(
      1,
      'events:orders',
      JSON.stringify({
        type: 'ORDER_UPDATED',
        data: { id: 5, order_number: 'ORDEN-5', status: 'cooking' },
      })
    );
    expect(mockRedisClient.publish).toHaveBeenNthCalledWith(
      2,
      'events:orders',
      JSON.stringify({
        type: 'ORDER_UPDATED',
        data: { id: 5, order_number: 'ORDEN-5', status: 'ready' },
      })
    );
    expect(mockRedisClient.xAdd).toHaveBeenCalledWith('stream:orders:delivery', '*', {
      orderId: '5',
      orderNumber: 'ORDEN-5',
    });
    expect(mockRedisClient.xAck).toHaveBeenCalledWith(
      'stream:orders:cooking',
      'cooking-group',
      'cooking-1'
    );
  });

  test('logs cooking database failures and acknowledges the processed message', async () => {
    const error = new Error('database unavailable');
    mockDbPool.query.mockRejectedValueOnce(error);
    mockRedisClient.xReadGroup.mockResolvedValueOnce([{
      messages: [{
        id: 'cooking-db-error',
        message: { orderId: '6', orderNumber: 'ORDEN-6' },
      }],
    }]);

    await loadWorker();

    expect(mockLogger.error).toHaveBeenCalledWith('Error cooking order ORDEN-6', error);
    expect(mockRedisClient.publish).not.toHaveBeenCalled();
    expect(mockRedisClient.xAck).toHaveBeenCalledWith(
      'stream:orders:cooking',
      'cooking-group',
      'cooking-db-error'
    );
  });

  test('logs when acknowledging a cooked order fails', async () => {
    jest.useFakeTimers();
    const error = new Error('ack failed');
    mockRedisClient.xAck.mockRejectedValueOnce(error);
    mockRedisClient.xReadGroup.mockResolvedValueOnce([{
      messages: [{
        id: 'cooking-ack-error',
        message: { orderId: '7', orderNumber: 'ORDEN-7' },
      }],
    }]);

    await loadWorker();
    await jest.advanceTimersByTimeAsync(30000);
    await flushMicrotasks();

    expect(mockLogger.error).toHaveBeenCalledWith(
      'Failed to process and ack order ORDEN-7',
      error
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

    expect(mockLogger.error).toHaveBeenCalledWith('CookingSimulator loop error', error);
    expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 3000);
  });
});

async function loadWorker() {
  await jest.isolateModulesAsync(async () => {
    await import('./cookingSimulatorWorker.js');
  });
  await flushMicrotasks();
}

async function flushMicrotasks() {
  for (let i = 0; i < 30; i += 1) {
    await Promise.resolve();
  }
}
