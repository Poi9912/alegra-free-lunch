const dbPool = { query: jest.fn() };
const connectRedisClient = jest.fn();
const redisClient = {
  publish: jest.fn(),
  xAck: jest.fn(),
  xAdd: jest.fn(),
  xGroupCreate: jest.fn(),
  xReadGroup: jest.fn(),
};
const logger = { error: jest.fn(), info: jest.fn() };
const getRandomDelay = jest.fn();

jest.doMock('./shared/db.js', () => ({ connectRedisClient, dbPool, redisClient }));
jest.doMock('./shared/logger.js', () => ({ logger }));
jest.doMock('./shared/timer.js', () => ({ getRandomDelay }));

const { cookOrder, start } = require('./cookingSimulatorWorker.js');

describe('cooking simulator worker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    connectRedisClient.mockResolvedValue(undefined);
    getRandomDelay.mockReturnValue(30000);
    redisClient.xGroupCreate.mockResolvedValue(undefined);
    redisClient.publish.mockResolvedValue(1);
    redisClient.xAdd.mockResolvedValue('stream-id');
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('marks an order cooking and ready, publishes both events, and queues delivery', async () => {
    jest.useFakeTimers();
    const pending = cookOrder('5', 'ORDEN-5');
    await jest.advanceTimersByTimeAsync(30000);
    await pending;

    expect(dbPool.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("SET status = 'cooking'"),
      ['5']
    );
    expect(dbPool.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("SET status = 'ready'"),
      ['5']
    );
    expect(redisClient.publish).toHaveBeenNthCalledWith(
      1,
      'events:orders',
      JSON.stringify({
        type: 'ORDER_UPDATED',
        data: { id: 5, order_number: 'ORDEN-5', status: 'cooking' },
      })
    );
    expect(redisClient.publish).toHaveBeenNthCalledWith(
      2,
      'events:orders',
      JSON.stringify({
        type: 'ORDER_UPDATED',
        data: { id: 5, order_number: 'ORDEN-5', status: 'ready' },
      })
    );
    expect(redisClient.xAdd).toHaveBeenCalledWith('stream:orders:delivery', '*', {
      orderId: '5',
      orderNumber: 'ORDEN-5',
    });
  });

  test('logs and contains database failures while cooking', async () => {
    const error = new Error('database unavailable');
    dbPool.query.mockRejectedValue(error);

    await cookOrder('5', 'ORDEN-5');

    expect(logger.error).toHaveBeenCalledWith('Error cooking order ORDEN-5', error);
    expect(redisClient.publish).not.toHaveBeenCalled();
  });

  test('acknowledges stream messages and logs loop failures', async () => {
    const loopError = new Error('stream failed');
    redisClient.xGroupCreate.mockRejectedValueOnce(new Error('group already exists'));
    redisClient.xReadGroup
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce([{
        messages: [{ id: 'message-1', message: { orderId: '5', orderNumber: 'ORDEN-5' } }],
      }])
      .mockRejectedValueOnce(loopError);
    const ackError = new Error('ack failed');
    redisClient.xAck.mockRejectedValueOnce(ackError);
    jest.spyOn(global, 'setTimeout').mockImplementation((callback, delay) => {
      if (delay !== 3000) {
        return callback();
      }
      throw new Error('stop worker loop');
    });
    const pending = start();

    await expect(pending).rejects.toThrow('stop worker loop');
    expect(redisClient.xGroupCreate).toHaveBeenCalledWith(
      'stream:orders:cooking',
      'cooking-group',
      '0',
      { MKSTREAM: true }
    );
    expect(logger.error).toHaveBeenCalledWith('CookingSimulator loop error', loopError);
    await Promise.resolve();
    expect(redisClient.xAck).toHaveBeenCalledWith('stream:orders:cooking', 'cooking-group', 'message-1');
    expect(logger.error).toHaveBeenCalledWith(
      'Failed to process and ack order ORDEN-5',
      ackError
    );
  });
});
