import { jest } from '@jest/globals';

const mockClient = { query: jest.fn(), release: jest.fn() };
const mockDbPool = { connect: jest.fn() };
const mockRedisClient = {
  del: jest.fn(),
  publish: jest.fn(),
  xAck: jest.fn(),
  xAdd: jest.fn(),
  xGroupCreate: jest.fn(),
  xReadGroup: jest.fn(),
};
const mockLogger = { error: jest.fn(), info: jest.fn() };

describe('purchasing agent worker', () => {
  beforeEach(async () => {
    jest.resetModules();
    jest.clearAllMocks();
    mockDbPool.connect.mockResolvedValue(mockClient);
    mockClient.query.mockResolvedValue({ rows: [] });
    mockClient.release.mockResolvedValue(undefined);
    mockRedisClient.del.mockResolvedValue(1);
    mockRedisClient.publish.mockResolvedValue(1);
    mockRedisClient.xAdd.mockResolvedValue('stream-id');
    mockRedisClient.xAck.mockResolvedValue(1);
    mockRedisClient.xGroupCreate.mockResolvedValue(undefined);
    mockRedisClient.xReadGroup.mockImplementation(() => new Promise(() => {}));

    jest.unstable_mockModule('./shared/db.js', () => ({
      dbPool: mockDbPool,
      redisClient: mockRedisClient,
    }));
    jest.unstable_mockModule('./shared/logger.js', () => ({ logger: mockLogger }));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('commits when there are no low-stock ingredients and acknowledges the request', async () => {
    mockRedisClient.xReadGroup.mockResolvedValueOnce([{
      messages: [{ id: 'purchase-empty', message: {} }],
    }]);

    await loadWorker();

    expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE COALESCE(inv.quantity, 0) < 5')
    );
    expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    expect(mockClient.query).not.toHaveBeenCalledWith('SAVEPOINT ingredient_sp');
    expect(mockRedisClient.xAdd).not.toHaveBeenCalled();
    expect(mockRedisClient.xAck).toHaveBeenCalledWith(
      'stream:inventory:purchase',
      'purchase-group',
      'purchase-empty'
    );
    expect(mockClient.release).toHaveBeenCalledTimes(1);
  });

  test('updates and inserts purchased stock, records purchases, and publishes changes', async () => {
    const lowStock = [
      { id: 1, name: 'Rice' },
      { id: 2, name: 'Beans' },
    ];
    mockClient.query.mockImplementation(async (query, params) => {
      if (query.includes('SELECT i.id, i.name')) return { rows: lowStock };
      if (query.includes('SELECT ingredient_id FROM ingredients_inventory')) {
        return { rows: params[0] === 1 ? [{ ingredient_id: 1 }] : [] };
      }
      return { rows: [] };
    });
    jest.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({ ok: true, json: async () => ({ quantitySold: 4 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ quantitySold: 3 }) });
    mockRedisClient.xReadGroup.mockResolvedValueOnce([{
      messages: [{ id: 'purchase-restock', message: {} }],
    }]);

    await loadWorker();

    expect(fetch).toHaveBeenNthCalledWith(1, expect.stringMatching(/buy\?ingredient=Rice$/));
    expect(fetch).toHaveBeenNthCalledWith(2, expect.stringMatching(/buy\?ingredient=Beans$/));
    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE ingredients_inventory SET quantity'),
      [1, 4]
    );
    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO ingredients_inventory'),
      [2, 3]
    );
    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO inventory_purchase_history'),
      [1, 4]
    );
    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO inventory_purchase_history'),
      [2, 3]
    );
    expect(mockRedisClient.del).toHaveBeenCalledWith('cache:inventory:status');
    expect(mockRedisClient.publish).toHaveBeenCalledWith(
      'events:inventory',
      JSON.stringify({ type: 'INVENTORY_UPDATED', data: {} })
    );
    expect(mockRedisClient.xAdd).toHaveBeenCalledWith(
      'stream:inventory:restocked',
      '*',
      { timestamp: expect.any(String) }
    );
    expect(mockRedisClient.xAck).toHaveBeenCalledWith(
      'stream:inventory:purchase',
      'purchase-group',
      'purchase-restock'
    );
  });

  test('rolls back an HTTP failure and releases its savepoint before continuing', async () => {
    mockClient.query.mockImplementation(async query => {
      if (query.includes('SELECT i.id, i.name')) {
        return { rows: [{ id: 1, name: 'Rice' }, { id: 2, name: 'Beans' }] };
      }
      return { rows: [] };
    });
    jest.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ quantitySold: 0 }) });
    mockRedisClient.xReadGroup.mockResolvedValueOnce([{
      messages: [{ id: 'purchase-failed', message: {} }],
    }]);

    await loadWorker();

    expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK TO SAVEPOINT ingredient_sp');
    expect(mockClient.query).toHaveBeenCalledWith('RELEASE SAVEPOINT ingredient_sp');
    expect(mockLogger.error).toHaveBeenCalledWith("Market API error for 'Rice': HTTP 503");
    expect(mockLogger.info).toHaveBeenCalledWith(
      "Ingredient 'Beans' is currently unavailable in the market (quantitySold: 0)."
    );
    expect(mockRedisClient.del).not.toHaveBeenCalled();
    expect(mockRedisClient.xAdd).toHaveBeenCalledWith(
      'stream:inventory:restocked',
      '*',
      { timestamp: expect.any(String) }
    );
  });

  test('rolls back an ingredient whose response cannot be parsed and continues processing', async () => {
    mockClient.query.mockImplementation(async (query, params) => {
      if (query.includes('SELECT i.id, i.name')) {
        return { rows: [{ id: 1, name: 'Rice' }, { id: 2, name: 'Beans' }] };
      }
      if (query.includes('SELECT ingredient_id FROM ingredients_inventory')) return { rows: [] };
      return { rows: [] };
    });
    jest.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new SyntaxError('invalid response');
        },
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ quantitySold: 2 }) });
    mockRedisClient.xReadGroup.mockResolvedValueOnce([{
      messages: [{ id: 'purchase-parse-failure', message: {} }],
    }]);

    await loadWorker();

    expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK TO SAVEPOINT ingredient_sp');
    expect(mockLogger.error).toHaveBeenCalledWith(
      "Error/Parsing error for ingredient 'Rice'",
      expect.any(SyntaxError)
    );
    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO ingredients_inventory'),
      [2, 2]
    );
    expect(mockRedisClient.del).toHaveBeenCalledWith('cache:inventory:status');
  });

  test('rolls back and logs transaction-level failures while still releasing the client', async () => {
    const error = new Error('database unavailable');
    const rollbackError = new Error('rollback failed');
    mockClient.query.mockImplementation(query => {
      if (query === 'BEGIN') return Promise.reject(error);
      if (query === 'ROLLBACK') return Promise.reject(rollbackError);
      return Promise.resolve({ rows: [] });
    });
    mockRedisClient.xReadGroup.mockResolvedValueOnce([{
      messages: [{ id: 'purchase-db-error', message: {} }],
    }]);

    await loadWorker();

    expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    expect(mockLogger.error).toHaveBeenCalledWith(
      '[PurchasingAgent] Restock transaction failed',
      error
    );
    expect(mockClient.release).toHaveBeenCalledTimes(1);
    expect(mockRedisClient.xAck).toHaveBeenCalledWith(
      'stream:inventory:purchase',
      'purchase-group',
      'purchase-db-error'
    );
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
      'purchase-group',
      'worker-purchasing',
      [{ key: 'stream:inventory:purchase', id: '>' }],
      { COUNT: 1, BLOCK: 5000 }
    );
    expect(mockLogger.error).toHaveBeenCalledWith(
      '[PurchasingAgent] Stream loop error',
      error
    );
    expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 3000);
  });
});

async function loadWorker() {
  await jest.isolateModulesAsync(async () => {
    await import('./purchasingAgentWorker.js');
  });
  await flushMicrotasks();
}

async function flushMicrotasks() {
  for (let i = 0; i < 30; i += 1) {
    await Promise.resolve();
  }
}
