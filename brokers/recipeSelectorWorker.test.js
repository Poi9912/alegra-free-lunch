import { jest } from '@jest/globals';

const mockClient = { query: jest.fn(), release: jest.fn() };
const mockDbPool = { connect: jest.fn() };
const mockRedisClient = {
  del: jest.fn(),
  get: jest.fn(),
  publish: jest.fn(),
  xAck: jest.fn(),
  xAdd: jest.fn(),
  xGroupCreate: jest.fn(),
  xRead: jest.fn(),
  xReadGroup: jest.fn(),
};
const mockLogger = { error: jest.fn(), info: jest.fn() };

describe('recipe selector worker', () => {
  beforeEach(async () => {
    jest.resetModules();
    jest.clearAllMocks();
    mockDbPool.connect.mockResolvedValue(mockClient);
    mockClient.query.mockResolvedValue({ rows: [] });
    mockClient.release.mockResolvedValue(undefined);
    mockRedisClient.get.mockResolvedValue(null);
    mockRedisClient.del.mockResolvedValue(1);
    mockRedisClient.publish.mockResolvedValue(1);
    mockRedisClient.xAdd.mockResolvedValue('stream-id');
    mockRedisClient.xAck.mockResolvedValue(1);
    mockRedisClient.xGroupCreate.mockResolvedValue(undefined);
    mockRedisClient.xRead.mockResolvedValue(null);
    mockRedisClient.xReadGroup.mockImplementation(() => new Promise(() => {}));

    jest.unstable_mockModule('./shared/db.js', () => ({
      dbPool: mockDbPool,
      redisClient: mockRedisClient,
    }));
    jest.unstable_mockModule('./shared/logger.js', () => ({ logger: mockLogger }));
  });

  test('creates and queues an order from cached inventory', async () => {
    mockClient.query
      .mockResolvedValueOnce({
        rows: [{
          recipe_id: 4,
          product: 'Soup',
          requirements: [{ ingredient_id: 1, quantity: 2 }],
        }],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 12 }] })
      .mockResolvedValueOnce({ rows: [] });
    mockRedisClient.get.mockResolvedValue(
      JSON.stringify([{ ingredient_id: 1, quantity: 4 }])
    );
    mockRedisClient.xReadGroup.mockResolvedValueOnce([{
      messages: [{ id: 'intake-1', message: {} }],
    }]);

    await loadWorker();

    expect(mockRedisClient.xGroupCreate).toHaveBeenCalledWith(
      'stream:orders:intake',
      'recipe-group',
      '0',
      { MKSTREAM: true }
    );
    expect(mockClient.query).toHaveBeenCalledWith(
      'UPDATE ingredients_inventory SET quantity = quantity - $1 WHERE ingredient_id = $2',
      [2, 1]
    );
    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO orders'),
      [4]
    );
    expect(mockClient.query).toHaveBeenCalledWith(
      'UPDATE orders SET order_number = $1 WHERE id = $2',
      ['ORDEN-12', 12]
    );
    expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    expect(mockRedisClient.del).toHaveBeenCalledWith('cache:inventory:status');
    expect(mockRedisClient.publish).toHaveBeenNthCalledWith(
      1,
      'events:orders',
      JSON.stringify({
        type: 'ORDERS_CREATED',
        data: { id: 12, order_number: 'ORDEN-12', product: 'Soup', status: 'confirmed' },
      })
    );
    expect(mockRedisClient.publish).toHaveBeenNthCalledWith(
      2,
      'events:inventory',
      JSON.stringify({ type: 'INVENTORY_UPDATED', data: {} })
    );
    expect(mockRedisClient.xAdd).toHaveBeenCalledWith('stream:orders:cooking', '*', {
      orderId: '12',
      orderNumber: 'ORDEN-12',
    });
    expect(mockRedisClient.xAck).toHaveBeenCalledWith(
      'stream:orders:intake',
      'recipe-group',
      'intake-1'
    );
    expect(mockClient.release).toHaveBeenCalledTimes(1);
  });

  test('falls back to the database after invalid cache data', async () => {
    mockRedisClient.get.mockResolvedValue('{invalid');
    mockClient.query
      .mockResolvedValueOnce({
        rows: [{
          recipe_id: 5,
          product: 'Salad',
          requirements: [{ ingredient_id: 7, quantity: 1 }],
        }],
      })
      .mockResolvedValueOnce({ rows: [{ ingredient_id: 7, quantity: 2 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 15 }] })
      .mockResolvedValueOnce({ rows: [] });
    mockRedisClient.xReadGroup.mockResolvedValueOnce([{
      messages: [{ id: 'intake-cache-error', message: {} }],
    }]);

    await loadWorker();

    expect(mockLogger.error).toHaveBeenCalledWith(
      'Redis cache read error',
      expect.any(SyntaxError)
    );
    expect(mockClient.query).toHaveBeenCalledWith(
      'SELECT ingredient_id, quantity FROM ingredients_inventory;'
    );
    expect(mockRedisClient.xAck).toHaveBeenCalledWith(
      'stream:orders:intake',
      'recipe-group',
      'intake-cache-error'
    );
  });

  test('requests a purchase, waits for restock, and retries recipe selection', async () => {
    const recipe = {
      recipe_id: 7,
      product: 'Salad',
      requirements: [{ ingredient_id: 9, quantity: 1 }],
    };
    mockClient.query
      .mockResolvedValueOnce({ rows: [recipe] })
      .mockResolvedValueOnce({ rows: [{ ingredient_id: 9, quantity: 0 }] })
      .mockResolvedValueOnce({ rows: [recipe] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 16 }] })
      .mockResolvedValueOnce({ rows: [] });
    mockRedisClient.get
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(JSON.stringify([{ ingredient_id: 9, quantity: 3 }]));
    mockRedisClient.xRead
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce([{ messages: [] }]);
    mockRedisClient.xReadGroup.mockResolvedValueOnce([{
      messages: [{ id: 'intake-restock', message: {} }],
    }]);

    await loadWorker();

    expect(mockRedisClient.xAdd).toHaveBeenCalledWith(
      'stream:inventory:purchase',
      '*',
      { timestamp: expect.any(String) }
    );
    expect(mockRedisClient.xRead).toHaveBeenNthCalledWith(
      1,
      [{ key: 'stream:inventory:restocked', id: '$' }],
      { BLOCK: 10000 }
    );
    expect(mockRedisClient.xRead).toHaveBeenNthCalledWith(
      2,
      [{ key: 'stream:inventory:restocked', id: '$' }],
      { BLOCK: 10000 }
    );
    expect(mockLogger.info).toHaveBeenCalledWith(
      '[RecipeSelector] Restock signal received! Re-checking inventory...'
    );
    expect(mockRedisClient.xAck).toHaveBeenCalledWith(
      'stream:orders:intake',
      'recipe-group',
      'intake-restock'
    );
  });

  test('rolls back on database errors and leaves the intake message unacknowledged', async () => {
    const error = new Error('recipe query failed');
    const rollbackError = new Error('rollback failed');
    mockClient.query.mockImplementation(query => {
      if (query.includes('SELECT r.id AS recipe_id')) return Promise.reject(error);
      if (query === 'ROLLBACK') return Promise.reject(rollbackError);
      return { rows: [] };
    });
    mockRedisClient.xReadGroup.mockResolvedValueOnce([{
      messages: [{ id: 'intake-failed', message: {} }],
    }]);

    await loadWorker();

    expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    expect(mockLogger.error).toHaveBeenCalledWith('Error processing intake order', error);
    expect(mockClient.release).toHaveBeenCalledTimes(1);
    expect(mockRedisClient.xAck).not.toHaveBeenCalled();
  });

  test('ignores existing consumer groups and logs stream read errors', async () => {
    const error = new Error('stream unavailable');
    mockRedisClient.xGroupCreate.mockRejectedValueOnce(new Error('group exists'));
    mockRedisClient.xReadGroup
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(error)
      .mockImplementation(() => new Promise(() => {}));
    jest.spyOn(globalThis, 'setTimeout').mockImplementation(() => 0);

    await loadWorker();

    expect(mockRedisClient.xReadGroup).toHaveBeenNthCalledWith(
      1,
      'recipe-group',
      'worker-selector',
      [{ key: 'stream:orders:intake', id: '>' }],
      { COUNT: 1, BLOCK: 5000 }
    );
    expect(mockLogger.error).toHaveBeenCalledWith('RecipeSelector loop error', error);
    expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 3000);
  });
});

async function loadWorker() {
  await jest.isolateModulesAsync(async () => {
    await import('./recipeSelectorWorker.js');
  });
  await flushMicrotasks();
}

async function flushMicrotasks() {
  for (let i = 0; i < 30; i += 1) {
    await Promise.resolve();
  }
}
