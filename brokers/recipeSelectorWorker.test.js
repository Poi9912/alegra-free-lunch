const client = { query: jest.fn(), release: jest.fn() };
const dbPool = { connect: jest.fn() };
const connectRedisClient = jest.fn();
const redisClient = {
  del: jest.fn(),
  get: jest.fn(),
  publish: jest.fn(),
  xAck: jest.fn(),
  xAdd: jest.fn(),
  xGroupCreate: jest.fn(),
  xRead: jest.fn(),
  xReadGroup: jest.fn(),
};
const logger = { error: jest.fn(), info: jest.fn() };

jest.doMock('./shared/db.js', () => ({ connectRedisClient, dbPool, redisClient }));
jest.doMock('./shared/logger.js', () => ({ logger }));

const { getInventory, processIntakeOrder, start } = require('./recipeSelectorWorker.js');

describe('recipe selector worker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    connectRedisClient.mockResolvedValue(undefined);
    dbPool.connect.mockResolvedValue(client);
    redisClient.get.mockResolvedValue(null);
    redisClient.del.mockResolvedValue(1);
    redisClient.publish.mockResolvedValue(1);
    redisClient.xAdd.mockResolvedValue('stream-id');
    redisClient.xGroupCreate.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('loads inventory from Redis cache', async () => {
    redisClient.get.mockResolvedValue(
      JSON.stringify([{ ingredient_id: 2, quantity: 7 }])
    );

    await expect(getInventory(client)).resolves.toEqual(new Map([[2, 7]]));
    expect(client.query).not.toHaveBeenCalled();
  });

  test('falls back to the database when cached inventory JSON is invalid', async () => {
    const error = new SyntaxError('bad cache data');
    redisClient.get.mockResolvedValue('{invalid');
    client.query.mockResolvedValue({
      rows: [{ ingredient_id: 3, quantity: 5 }],
    });

    await expect(getInventory(client)).resolves.toEqual(new Map([[3, 5]]));
    expect(logger.error).toHaveBeenCalledWith('Redis cache read error', expect.any(SyntaxError));
    expect(client.query).toHaveBeenCalledWith(
      'SELECT ingredient_id, quantity FROM ingredients_inventory;'
    );
  });

  test('creates a confirmed order from an available recipe and publishes updates', async () => {
    client.query
      .mockResolvedValueOnce({
        rows: [{
          recipe_id: 4,
          product: 'Soup',
          requirements: [{ ingredient_id: 1, quantity: 2 }],
        }],
      })
      .mockResolvedValueOnce({ rows: [{ ingredient_id: 1, quantity: 4 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 12 }] })
      .mockResolvedValueOnce({ rows: [] });
    redisClient.get.mockResolvedValue(
      JSON.stringify([{ ingredient_id: 1, quantity: 4 }])
    );

    await expect(processIntakeOrder()).resolves.toBe(true);

    expect(client.query).toHaveBeenCalledWith(
      'UPDATE ingredients_inventory SET quantity = quantity - $1 WHERE ingredient_id = $2',
      [2, 1]
    );
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO orders'), [4]);
    expect(client.query).toHaveBeenCalledWith(
      'UPDATE orders SET order_number = $1 WHERE id = $2',
      ['ORDEN-12', 12]
    );
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(redisClient.del).toHaveBeenCalledWith('cache:inventory:status');
    expect(redisClient.publish).toHaveBeenNthCalledWith(
      1,
      'events:orders',
      JSON.stringify({
        type: 'ORDERS_CREATED',
        data: { id: 12, order_number: 'ORDEN-12', product: 'Soup', status: 'confirmed' },
      })
    );
    expect(redisClient.publish).toHaveBeenNthCalledWith(
      2,
      'events:inventory',
      JSON.stringify({ type: 'INVENTORY_UPDATED', data: {} })
    );
    expect(redisClient.xAdd).toHaveBeenCalledWith('stream:orders:cooking', '*', {
      orderId: '12',
      orderNumber: 'ORDEN-12',
    });
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  test('requests restock and retries after receiving a restock signal', async () => {
    client.query
      .mockResolvedValueOnce({
        rows: [{
          recipe_id: 5,
          product: 'Salad',
          requirements: [{ ingredient_id: 7, quantity: 1 }],
        }],
      })
      .mockResolvedValueOnce({ rows: [{ ingredient_id: 7, quantity: 0 }] })
      .mockResolvedValueOnce({
        rows: [{
          recipe_id: 5,
          product: 'Salad',
          requirements: [{ ingredient_id: 7, quantity: 1 }],
        }],
      })
      .mockResolvedValueOnce({ rows: [{ ingredient_id: 7, quantity: 2 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 14 }] })
      .mockResolvedValueOnce({ rows: [] });
    redisClient.get.mockResolvedValueOnce(null).mockResolvedValueOnce(
      JSON.stringify([{ ingredient_id: 7, quantity: 2 }])
    );
    redisClient.xRead
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce([{ messages: [] }]);

    await expect(processIntakeOrder()).resolves.toBe(true);

    expect(redisClient.xAdd).toHaveBeenCalledWith(
      'stream:inventory:purchase',
      '*',
      { timestamp: expect.any(String) }
    );
    expect(redisClient.xRead).toHaveBeenCalledWith(
      [{ key: 'stream:inventory:restocked', id: '$' }],
      { BLOCK: 10000 }
    );
    expect(logger.info).toHaveBeenCalledWith(
      '[RecipeSelector] Restock signal received! Re-checking inventory...'
    );
  });

  test('rolls back and returns false for processing errors', async () => {
    const error = new Error('recipe query failed');
    client.query.mockRejectedValue(error);

    await expect(processIntakeOrder()).resolves.toBe(false);

    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(logger.error).toHaveBeenCalledWith('Error processing intake order', error);
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  test('acknowledges successful intake messages and logs stream failures', async () => {
    const error = new Error('stream unavailable');
    redisClient.xGroupCreate.mockRejectedValueOnce(new Error('group already exists'));
    redisClient.xReadGroup
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce([{
        messages: [{ id: 'intake-1', message: {} }],
      }])
      .mockRejectedValueOnce(error);
    client.query
      .mockResolvedValueOnce({
        rows: [{
          recipe_id: 5,
          product: 'Salad',
          requirements: [{ ingredient_id: 7, quantity: 1 }],
        }],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 14 }] })
      .mockResolvedValue({ rows: [] });
    redisClient.get.mockResolvedValue(
      JSON.stringify([{ ingredient_id: 7, quantity: 2 }])
    );
    jest.spyOn(global, 'setTimeout').mockImplementation((callback, delay) => {
      if (delay !== 3000) {
        return callback();
      }
      throw new Error('stop worker loop');
    });

    await expect(start()).rejects.toThrow('stop worker loop');

    expect(redisClient.xGroupCreate).toHaveBeenCalledWith(
      'stream:orders:intake',
      'recipe-group',
      '0',
      { MKSTREAM: true }
    );
    expect(logger.error).toHaveBeenCalledWith('RecipeSelector loop error', error);
    expect(redisClient.xAck).toHaveBeenCalledWith(
      'stream:orders:intake',
      'recipe-group',
      'intake-1'
    );
  });

  test('does not acknowledge intake messages when order processing fails', async () => {
    const error = new Error('recipe query failed');
    const loopError = new Error('stream unavailable');
    redisClient.xReadGroup
      .mockResolvedValueOnce([{
        messages: [{ id: 'intake-2', message: {} }],
      }])
      .mockRejectedValueOnce(loopError);
    client.query.mockRejectedValue(error);
    jest.spyOn(global, 'setTimeout').mockImplementation((callback, delay) => {
      if (delay !== 3000) {
        return callback();
      }
      throw new Error('stop worker loop');
    });

    await expect(start()).rejects.toThrow('stop worker loop');

    expect(logger.error).toHaveBeenCalledWith('Error processing intake order', error);
    expect(redisClient.xAck).not.toHaveBeenCalled();
  });
});
