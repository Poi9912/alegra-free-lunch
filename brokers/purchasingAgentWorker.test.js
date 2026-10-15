const client = { query: jest.fn(), release: jest.fn() };
const dbPool = { connect: jest.fn() };
const connectRedisClient = jest.fn();
const redisClient = {
  del: jest.fn(),
  publish: jest.fn(),
  xAck: jest.fn(),
  xAdd: jest.fn(),
  xGroupCreate: jest.fn(),
  xReadGroup: jest.fn(),
};
const logger = { error: jest.fn(), info: jest.fn() };

jest.doMock('./shared/db.js', () => ({ connectRedisClient, dbPool, redisClient }));
jest.doMock('./shared/logger.js', () => ({ logger }));

const { restockInventory, start } = require('./purchasingAgentWorker.js');

describe('purchasing agent worker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    connectRedisClient.mockResolvedValue(undefined);
    dbPool.connect.mockResolvedValue(client);
    client.query.mockResolvedValue({ rows: [] });
    redisClient.del.mockResolvedValue(1);
    redisClient.publish.mockResolvedValue(1);
    redisClient.xAdd.mockResolvedValue('stream-id');
    redisClient.xGroupCreate.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('commits without purchases when all ingredients are adequately stocked', async () => {
    await restockInventory();

    expect(client.query).toHaveBeenCalledWith('BEGIN');
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(client.query).not.toHaveBeenCalledWith('SAVEPOINT ingredient_sp');
    expect(redisClient.xAdd).not.toHaveBeenCalled();
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  test('updates existing stock, inserts missing stock and publishes inventory changes', async () => {
    const lowStock = [
      { id: 1, name: 'Rice' },
      { id: 2, name: 'Beans' },
    ];
    client.query.mockImplementation(async (query, params) => {
      if (query.includes('SELECT i.id, i.name')) return { rows: lowStock };
      if (query.includes('SELECT ingredient_id FROM ingredients_inventory')) {
        return { rows: params[0] === 1 ? [{ ingredient_id: 1 }] : [] };
      }
      return { rows: [] };
    });
    jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce({ ok: true, json: async () => ({ quantitySold: 4 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ quantitySold: 3 }) });

    await restockInventory();

    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE ingredients_inventory SET quantity'),
      [1, 4]
    );
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO ingredients_inventory'),
      [2, 3]
    );
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO inventory_purchase_history'),
      [1, 4]
    );
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO inventory_purchase_history'),
      [2, 3]
    );
    expect(redisClient.del).toHaveBeenCalledWith('cache:inventory:status');
    expect(redisClient.publish).toHaveBeenCalledWith(
      'events:inventory',
      JSON.stringify({ type: 'INVENTORY_UPDATED', data: {} })
    );
    expect(client.query).toHaveBeenCalledWith('COMMIT');
  });

  test('rolls back a market HTTP failure and continues processing ingredients', async () => {
    client.query.mockImplementation(async (query) => {
      if (query.includes('SELECT i.id, i.name')) {
        return { rows: [{ id: 1, name: 'Rice' }, { id: 2, name: 'Beans' }] };
      }
      return { rows: [] };
    });
    jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ quantitySold: 0 }) });

    await restockInventory();

    expect(client.query).toHaveBeenCalledWith('ROLLBACK TO SAVEPOINT ingredient_sp');
    expect(logger.error).toHaveBeenCalledWith("Market API error for 'Rice': HTTP 503");
    expect(client.query).toHaveBeenCalledWith('RELEASE SAVEPOINT ingredient_sp');
    expect(redisClient.del).not.toHaveBeenCalled();
  });

  test('rolls back an individual ingredient when its response cannot be parsed', async () => {
    client.query.mockImplementation(async (query) => {
      if (query.includes('SELECT i.id, i.name')) return { rows: [{ id: 1, name: 'Rice' }] };
      return { rows: [] };
    });
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => {
        throw new SyntaxError('invalid response');
      },
    });

    await restockInventory();

    expect(client.query).toHaveBeenCalledWith('ROLLBACK TO SAVEPOINT ingredient_sp');
    expect(logger.error).toHaveBeenCalledWith(
      "Error/Parsing error for ingredient 'Rice'",
      expect.any(SyntaxError)
    );
    expect(client.query).toHaveBeenCalledWith('COMMIT');
  });

  test('rolls back and logs transaction-level failures then releases the client', async () => {
    const error = new Error('database unavailable');
    client.query.mockRejectedValue(error);

    await restockInventory();

    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(logger.error).toHaveBeenCalledWith('[PurchasingAgent] Restock transaction failed', error);
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  test('acknowledges purchase requests and logs stream loop errors', async () => {
    const error = new Error('stream unavailable');
    redisClient.xGroupCreate.mockRejectedValueOnce(new Error('group already exists'));
    redisClient.xReadGroup
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce([{
        messages: [{ id: 'purchase-1', message: {} }],
      }])
      .mockRejectedValueOnce(error);
    jest.spyOn(global, 'setTimeout').mockImplementation((callback, delay) => {
      if (delay !== 3000) {
        return callback();
      }
      throw new Error('stop worker loop');
    });

    await expect(start()).rejects.toThrow('stop worker loop');

    expect(redisClient.xGroupCreate).toHaveBeenCalledWith(
      'stream:inventory:purchase',
      'purchase-group',
      '0',
      { MKSTREAM: true }
    );
    expect(logger.error).toHaveBeenCalledWith('[PurchasingAgent] Stream loop error', error);
    expect(redisClient.xAck).toHaveBeenCalledWith(
      'stream:inventory:purchase',
      'purchase-group',
      'purchase-1'
    );
  });
});
