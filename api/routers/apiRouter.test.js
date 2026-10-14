const controller = {
  login: jest.fn(),
  getRecipes: jest.fn(),
  getInventory: jest.fn(),
  getPurchaseHistory: jest.fn(),
  getOrders: jest.fn(),
  createOrder: jest.fn(),
  updateOrderStatus: jest.fn(),
};
const authCalls = [];
const requireAuth = jest.fn((roles) => {
  authCalls.push(roles);
  return (req, res, next) => next();
});

jest.doMock('../controllers/restaurantController.js', () => ({
  restaurantController: controller,
}));
jest.doMock('../middleware/auth.js', () => ({ requireAuth }));

const { handleApiRoutes } = require('./apiRouter.js');

function response() {
  return { writeHead: jest.fn(), end: jest.fn() };
}

describe('handleApiRoutes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authCalls.length = 0;
  });

  test('routes public login without authentication', async () => {
    const req = { method: 'POST' };
    const res = response();

    await handleApiRoutes(req, res, new URL('http://localhost/api/login'));

    expect(controller.login).toHaveBeenCalledWith(req, res);
    expect(requireAuth).not.toHaveBeenCalled();
  });

  test.each([
    ['/api/recipes', 'getRecipes', ['manager', 'operation']],
    ['/api/inventory', 'getInventory', ['manager', 'operation']],
    ['/api/purchases', 'getPurchaseHistory', ['manager', 'operation']],
    ['/api/orders', 'getOrders', ['manager', 'operation']],
    ['/api/orders', 'createOrder', ['manager']],
  ])('routes the protected endpoint %s with its allowed roles', async (path, handler, roles) => {
    const method = handler === 'createOrder' ? 'POST' : 'GET';
    const req = { method };
    const res = response();

    await handleApiRoutes(req, res, new URL(`http://localhost${path}`));

    expect(authCalls).toEqual([roles]);
    expect(controller[handler]).toHaveBeenCalledWith(req, res);
  });

  test('passes the order id to the status update handler', async () => {
    const req = { method: 'PATCH' };
    const res = response();

    await handleApiRoutes(req, res, new URL('http://localhost/api/orders/42/status'));

    expect(authCalls).toEqual([['manager', 'operation']]);
    expect(controller.updateOrderStatus).toHaveBeenCalledWith(req, res, '42');
  });

  test('returns a JSON 404 for unknown routes', async () => {
    const res = response();

    await handleApiRoutes({ method: 'GET' }, res, new URL('http://localhost/api/missing'));

    expect(res.writeHead).toHaveBeenCalledWith(404, { 'Content-Type': 'application/json' });
    expect(JSON.parse(res.end.mock.calls[0][0])).toEqual({
      success: false,
      error: 'Endpoint not found',
    });
  });
});
