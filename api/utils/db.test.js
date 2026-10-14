const pool = { query: jest.fn() };
const redisErrorHandler = jest.fn();
const redisClient = {
  on: jest.fn((event, handler) => {
    if (event === 'error') redisErrorHandler.mockImplementation(handler);
  }),
  connect: jest.fn().mockResolvedValue(undefined),
};
const poolConstructor = jest.fn(() => pool);
const createClient = jest.fn(() => redisClient);
const logger = { error: jest.fn(), info: jest.fn() };

jest.doMock('pg', () => ({
  __esModule: true,
  default: { Pool: poolConstructor },
}));
jest.doMock('redis', () => ({ createClient }));
jest.doMock('./logger.js', () => ({ logger }));

const { dbPool, redisClient: exportedRedisClient } = require('./db.js');

describe('database clients', () => {
  test('creates a PostgreSQL pool and Redis client using configured defaults', () => {
    expect(dbPool).toBe(pool);
    expect(poolConstructor).toHaveBeenCalledWith(
      expect.objectContaining({ port: 5432 })
    );
    expect(exportedRedisClient).toBe(redisClient);
    expect(createClient).toHaveBeenCalledWith({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
    });
    expect(redisClient.connect).toHaveBeenCalledTimes(1);
  });

  test('logs Redis connection errors from the client event', () => {
    const error = new Error('redis disconnected');

    redisErrorHandler(error);

    expect(logger.error).toHaveBeenCalledWith('Redis Client Error', error);
  });

  test('logs a failed Redis connection', async () => {
    const error = new Error('connection refused');
    redisClient.connect.mockRejectedValueOnce(error);
    jest.resetModules();
    jest.doMock('pg', () => ({
      __esModule: true,
      default: { Pool: poolConstructor },
    }));
    jest.doMock('redis', () => ({ createClient }));
    jest.doMock('./logger.js', () => ({ logger }));

    require('./db.js');
    await new Promise((resolve) => setImmediate(resolve));

    expect(logger.error).toHaveBeenCalledWith('Failed to connect to Redis', error);
  });
});
