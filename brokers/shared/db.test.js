import { jest } from '@jest/globals';

describe('shared database clients', () => {
  const environmentKeys = ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'REDIS_URL'];
  let originalEnvironment;
  let mockPoolConstructor;
  let mockRedisClient;
  let mockCreateClient;

  beforeEach(async () => {
    jest.resetModules();
    originalEnvironment = Object.fromEntries(
      environmentKeys.map(key => [key, process.env[key]])
    );
    for (const key of environmentKeys) delete process.env[key];

    mockPoolConstructor = jest.fn();
    mockRedisClient = { connect: jest.fn() };
    mockCreateClient = jest.fn(() => mockRedisClient);
    mockRedisClient.connect.mockResolvedValue(undefined);

    jest.unstable_mockModule('pg', () => ({
      default: { Pool: mockPoolConstructor },
    }));
    jest.unstable_mockModule('redis', () => ({
      createClient: mockCreateClient,
    }));
  });

  afterEach(() => {
    for (const key of environmentKeys) {
      const value = originalEnvironment[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  test('constructs clients with defaults and awaits Redis connection', async () => {
    const pool = {};
    mockPoolConstructor.mockReturnValue(pool);

    const { dbPool, redisClient } = await import('./db.js');

    expect(mockPoolConstructor).toHaveBeenCalledWith({
      host: 'localhost',
      database: 'restaurant_db',
      user: 'postgres',
      password: 'secretpassword',
      port: 5432,
    });
    expect(mockCreateClient).toHaveBeenCalledWith({ url: 'redis://localhost:6379' });
    expect(dbPool).toBe(pool);
    expect(redisClient).toBe(mockRedisClient);
    expect(mockRedisClient.connect).toHaveBeenCalledTimes(1);
  });

  test('uses configured database and Redis environment values', async () => {
    process.env.DB_HOST = 'db.example.test';
    process.env.DB_NAME = 'lunch';
    process.env.DB_USER = 'worker';
    process.env.DB_PASSWORD = 'password';
    process.env.REDIS_URL = 'redis://cache.example.test:6379';

    await import('./db.js');

    expect(mockPoolConstructor).toHaveBeenCalledWith({
      host: 'db.example.test',
      database: 'lunch',
      user: 'worker',
      password: 'password',
      port: 5432,
    });
    expect(mockCreateClient).toHaveBeenCalledWith({
      url: 'redis://cache.example.test:6379',
    });
  });

  test('surfaces Redis connection failures during initialization', async () => {
    const error = new Error('Redis unavailable');
    mockRedisClient.connect.mockRejectedValue(error);

    await expect(import('./db.js')).rejects.toBe(error);
    expect(mockRedisClient.connect).toHaveBeenCalledTimes(1);
  });
});
