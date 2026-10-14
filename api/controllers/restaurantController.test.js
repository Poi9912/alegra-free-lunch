const { EventEmitter } = require('node:events');

const dbPool = { query: jest.fn() };
const getOrSetCache = jest.fn();
const compare = jest.fn();
const sign = jest.fn();
const logger = { error: jest.fn(), info: jest.fn() };

jest.doMock('../utils/db.js', () => ({ dbPool }));
jest.doMock('../utils/cacheHelper.js', () => ({ getOrSetCache }));
jest.doMock('bcryptjs', () => ({
  __esModule: true,
  default: { compare },
}));
jest.doMock('jsonwebtoken', () => ({
  __esModule: true,
  default: { sign },
}));
jest.doMock('../utils/logger.js', () => ({ logger }));

const { restaurantController } = require('./restaurantController.js');

function response() {
  return { writeHead: jest.fn(), end: jest.fn() };
}

function request(body, overrides = {}) {
  const req = Object.assign(new EventEmitter(), {
    headers: { host: 'localhost' },
    url: '/',
    user: { username: 'alex' },
    ...overrides,
  });
  const send = () => {
    req.emit('data', JSON.stringify(body));
    req.emit('end');
  };
  return { req, send };
}

function responseBody(res) {
  return JSON.parse(res.end.mock.calls.at(-1)[0]);
}

describe('restaurantController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('logs in a user and returns a signed token', async () => {
    const user = { id: 7, username: 'alex', password_hash: 'hash', role: 'manager' };
    dbPool.query.mockResolvedValue({ rows: [user] });
    compare.mockResolvedValue(true);
    sign.mockReturnValue('signed-token');
    const { req, send } = request({ username: 'alex', password: 'secret' });
    const res = response();
    const result = restaurantController.login(req, res);
    send();
    await result;

    expect(dbPool.query).toHaveBeenCalledWith(expect.stringContaining('WHERE username = $1'), ['alex']);
    expect(compare).toHaveBeenCalledWith('secret', 'hash');
    expect(sign).toHaveBeenCalledWith(
      { userId: 7, username: 'alex', role: 'manager' },
      expect.any(String),
      { expiresIn: '8h' }
    );
    expect(res.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'application/json' });
    expect(responseBody(res)).toEqual({ success: true, token: 'signed-token', role: 'manager' });
  });

  test.each([
    ['missing user', { rows: [] }, undefined],
    ['incorrect password', { rows: [{ password_hash: 'hash' }] }, false],
  ])('rejects login with %s', async (_case, queryResult, passwordIsValid) => {
    dbPool.query.mockResolvedValue(queryResult);
    compare.mockResolvedValue(passwordIsValid);
    const { req, send } = request({ username: 'alex', password: 'wrong' });
    const res = response();
    const result = restaurantController.login(req, res);
    send();
    await result;

    expect(res.writeHead).toHaveBeenCalledWith(401, { 'Content-Type': 'application/json' });
    expect(responseBody(res)).toEqual({ success: false, error: 'Invalid credentials' });
  });

  test('reports unexpected login failures as a 500 response', async () => {
    dbPool.query.mockRejectedValue(new Error('database unavailable'));
    const { req, send } = request({ username: 'alex', password: 'secret' });
    const res = response();
    const result = restaurantController.login(req, res);
    send();
    await result;

    expect(logger.error).toHaveBeenCalledWith('Login error', expect.any(Error));
    expect(responseBody(res)).toEqual({ success: false, error: 'Internal server error' });
  });

  test.each([
    ['getRecipes', [{ id: 1 }], 'cache:recipes:all'],
    ['getInventory', [{ id: 2 }], 'cache:inventory:status'],
  ])('%s returns cached data', async (method, data, key) => {
    getOrSetCache.mockResolvedValue(data);
    const res = response();

    await restaurantController[method]({}, res);

    expect(getOrSetCache).toHaveBeenCalledWith(key, method === 'getRecipes' ? 300 : 60, expect.any(Function));
    expect(responseBody(res)).toEqual({ success: true, data });
  });

  test.each([
    ['getRecipes', 'SELECT r.id, r.product'],
    ['getInventory', 'SELECT inv.id, i.id AS ingredient_id'],
  ])('%s executes its database query on a cache miss', async (method, query) => {
    const rows = [{ id: 11 }];
    getOrSetCache.mockImplementation((_key, _ttl, fetchData) => fetchData());
    dbPool.query.mockResolvedValue({ rows });
    const res = response();

    await restaurantController[method]({}, res);

    expect(dbPool.query).toHaveBeenCalledWith(expect.stringContaining(query));
    expect(responseBody(res)).toEqual({ success: true, data: rows });
  });

  test('returns an inventory error response when cache loading fails', async () => {
    getOrSetCache.mockRejectedValue(new Error('inventory unavailable'));
    const res = response();

    await restaurantController.getInventory({}, res);

    expect(logger.error).toHaveBeenCalledWith('Get inventory error', expect.any(Error));
    expect(responseBody(res)).toEqual({ success: false, error: 'inventory unavailable' });
  });

  test('returns a 500 response when cached recipe loading fails', async () => {
    getOrSetCache.mockRejectedValue(new Error('database unavailable'));
    const res = response();

    await restaurantController.getRecipes({}, res);

    expect(logger.error).toHaveBeenCalledWith('Get recipes error', expect.any(Error));
    expect(responseBody(res)).toEqual({ success: false, error: 'database unavailable' });
  });

  test.each([
    ['getPurchaseHistory', [{ id: 3 }]],
    ['getStatus', [{ id: 4 }]],
  ])('%s returns database data', async (method, rows) => {
    dbPool.query.mockResolvedValue({ rows });
    const res = response();

    await restaurantController[method]({}, res);

    if (method === 'getStatus') {
      expect(responseBody(res)).toEqual({
        success: true,
        data: { inventory: rows, recipes: rows, orders: rows, purchaseHistory: rows },
      });
      expect(dbPool.query).toHaveBeenCalledTimes(4);
    } else {
      expect(responseBody(res)).toEqual({ success: true, data: rows });
      expect(dbPool.query).toHaveBeenCalledTimes(1);
    }
  });

  test('returns purchase history database errors as 500 responses', async () => {
    dbPool.query.mockRejectedValue(new Error('query failed'));
    const res = response();

    await restaurantController.getPurchaseHistory({}, res);

    expect(logger.error).toHaveBeenCalledWith('Get purchase history error', expect.any(Error));
    expect(responseBody(res)).toEqual({ success: false, error: 'query failed' });
  });

  test('returns status query failures as a 500 response', async () => {
    dbPool.query.mockRejectedValue(new Error('dashboard query failed'));
    const res = response();

    await restaurantController.getStatus({}, res);

    expect(logger.error).toHaveBeenCalledWith('Get status error', expect.any(Error));
    expect(responseBody(res)).toEqual({ success: false, error: 'dashboard query failed' });
  });

  test('filters orders by status when provided', async () => {
    dbPool.query.mockResolvedValue({ rows: [{ id: 8, status: 'ready' }] });
    const res = response();

    await restaurantController.getOrders(
      { url: '/api/orders?status=ready', headers: { host: 'localhost' } },
      res
    );

    expect(dbPool.query).toHaveBeenCalledWith(expect.stringContaining('WHERE o.status = $1'), ['ready']);
    expect(responseBody(res)).toEqual({ success: true, data: [{ id: 8, status: 'ready' }] });
  });

  test('gets all orders when no status filter is set', async () => {
    dbPool.query.mockResolvedValue({ rows: [] });
    const res = response();

    await restaurantController.getOrders(
      { url: '/api/orders', headers: { host: 'localhost' } },
      res
    );

    expect(dbPool.query).toHaveBeenCalledWith(expect.not.stringContaining('WHERE o.status'), []);
    expect(responseBody(res)).toEqual({ success: true, data: [] });
  });

  test('returns order query failures as a 500 response', async () => {
    dbPool.query.mockRejectedValue(new Error('orders query failed'));
    const res = response();

    await restaurantController.getOrders(
      { url: '/api/orders', headers: { host: 'localhost' } },
      res
    );

    expect(logger.error).toHaveBeenCalledWith('Get orders error', expect.any(Error));
    expect(responseBody(res)).toEqual({ success: false, error: 'orders query failed' });
  });

  test('rejects invalid order statuses without querying the database', async () => {
    const { req, send } = request({ status: 'unknown' });
    const res = response();
    const result = restaurantController.updateOrderStatus(req, res, '42');
    send();
    await result;

    expect(dbPool.query).not.toHaveBeenCalled();
    expect(res.writeHead).toHaveBeenCalledWith(400, { 'Content-Type': 'application/json' });
    expect(responseBody(res).error).toContain('Invalid status value');
  });

  test('updates valid order statuses and returns the updated order', async () => {
    const order = { id: 42, order_number: 'A42', status: 'ready' };
    dbPool.query.mockResolvedValue({ rows: [order] });
    const { req, send } = request({ status: 'ready' });
    const res = response();
    const result = restaurantController.updateOrderStatus(req, res, '42');
    send();
    await result;

    expect(dbPool.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE orders'), ['ready', '42']);
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('status updated to ready'));
    expect(responseBody(res)).toEqual({ success: true, data: order });
  });

  test('returns 404 when the order to update does not exist', async () => {
    dbPool.query.mockResolvedValue({ rows: [] });
    const { req, send } = request({ status: 'confirmed' });
    const res = response();
    const result = restaurantController.updateOrderStatus(req, res, 'missing');
    send();
    await result;

    expect(responseBody(res)).toEqual({ success: false, error: 'Order not found' });
  });

  test('returns 500 when an order status update fails', async () => {
    dbPool.query.mockRejectedValue(new Error('update failed'));
    const { req, send } = request({ status: 'confirmed' });
    const res = response();
    const result = restaurantController.updateOrderStatus(req, res, '42');
    send();
    await result;

    expect(logger.error).toHaveBeenCalledWith('Update order status error', expect.any(Error));
    expect(responseBody(res)).toEqual({ success: false, error: 'update failed' });
  });
});
