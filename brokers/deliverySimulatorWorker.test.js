const dbPool = { query: jest.fn() };
const connectRedisClient = jest.fn();
const redisClient = {
  publish: jest.fn(),
  xAck: jest.fn(),
  xGroupCreate: jest.fn(),
  xReadGroup: jest.fn(),
};
const logger = { error: jest.fn(), info: jest.fn() };
const getRandomDelay = jest.fn();

jest.doMock('./shared/db.js', () => ({ connectRedisClient, dbPool, redisClient }));
jest.doMock('./shared/logger.js', () => ({ logger }));
jest.doMock('./shared/timer.js', () => ({ getRandomDelay }));

const { deliverOrder, start } = require('./deliverySimulatorWorker.js');

describe('delivery simulator worker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    connectRedisClient.mockResolvedValue(undefined);
    getRandomDelay.mockReturnValue(30000);
    redisClient.xGroupCreate.mockResolvedValue(undefined);
    redisClient.publish.mockResolvedValue(1);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('marks an order delivered and publishes an order update', async () => {
    jest.useFakeTimers();
    const pending = deliverOrder('8', 'ORDEN-8');
    await jest.advanceTimersByTimeAsync(30000);
    await pending;

    expect(dbPool.query).toHaveBeenCalledWith(
      expect.stringContaining("SET status = 'delivered'"),
      ['8']
    );
    expect(redisClient.publish).toHaveBeenCalledWith(
      'events:orders',
      JSON.stringify({
        type: 'ORDER_UPDATED',
        data: { id: 8, order_number: 'ORDEN-8', status: 'delivered' },
      })
    );
  });

  test('logs and contains delivery failures', async () => {
    jest.useFakeTimers();
    const error = new Error('database unavailable');
    dbPool.query.mockRejectedValue(error);

    const pending = deliverOrder('8', 'ORDEN-8');
    await jest.advanceTimersByTimeAsync(30000);
    await pending;

    expect(logger.error).toHaveBeenCalledWith('Error delivering order ORDEN-8', error);
    expect(redisClient.publish).not.toHaveBeenCalled();
  });

  test('acknowledges stream messages and logs loop failures', async () => {
    const loopError = new Error('stream failed');
    redisClient.xGroupCreate.mockRejectedValueOnce(new Error('group already exists'));
    redisClient.xReadGroup
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce([{
        messages: [{ id: 'message-2', message: { orderId: '8', orderNumber: 'ORDEN-8' } }],
      }])
      .mockRejectedValueOnce(loopError);
    jest.spyOn(global, 'setTimeout').mockImplementation((callback, delay) => {
      if (delay !== 3000) {
        return callback();
      }
      throw new Error('stop worker loop');
    });

    await expect(start()).rejects.toThrow('stop worker loop');

    expect(redisClient.xGroupCreate).toHaveBeenCalledWith(
      'stream:orders:delivery',
      'delivery-group',
      '0',
      { MKSTREAM: true }
    );
    expect(logger.error).toHaveBeenCalledWith('DeliverySimulator loop error', loopError);
    expect(redisClient.xAck).toHaveBeenCalledWith('stream:orders:delivery', 'delivery-group', 'message-2');
  });
});
