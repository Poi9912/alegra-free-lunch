const pool = {};
const redisClient = { connect: jest.fn() };
const Pool = jest.fn(() => pool);
const createClient = jest.fn(() => redisClient);

jest.doMock('pg', () => ({
  __esModule: true,
  default: { Pool },
}));
jest.doMock('redis', () => ({ createClient }));

const { connectRedisClient, dbPool, redisClient: exportedRedisClient } = require('./db.js');

describe('shared database clients', () => {
  test('creates the PostgreSQL pool and Redis client with default configuration', () => {
    expect(dbPool).toBe(pool);
    expect(Pool).toHaveBeenCalledWith(
      expect.objectContaining({
        host: process.env.DB_HOST || 'localhost',
        database: process.env.DB_NAME || 'restaurant_db',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'secretpassword',
        port: 5432,
      })
    );
    expect(exportedRedisClient).toBe(redisClient);
    expect(createClient).toHaveBeenCalledWith({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
    });
  });

  test('connects Redis when requested by a worker', async () => {
    redisClient.connect.mockResolvedValue(undefined);

    await expect(connectRedisClient()).resolves.toBeUndefined();
    expect(redisClient.connect).toHaveBeenCalledTimes(1);
  });

  test('surfaces Redis connection failures to the worker startup', async () => {
    const error = new Error('Redis unavailable');
    redisClient.connect.mockRejectedValue(error);

    await expect(connectRedisClient()).rejects.toBe(error);
  });
});
