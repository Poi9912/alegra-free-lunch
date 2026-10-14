const verify = jest.fn();
jest.doMock('jsonwebtoken', () => ({
  __esModule: true,
  default: { verify },
}));

const { requireAuth } = require('./auth.js');

function response() {
  return { writeHead: jest.fn(), end: jest.fn() };
}

describe('requireAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns 401 when the authorization token is missing', () => {
    const res = response();

    requireAuth(['manager'])({ headers: {} }, res, jest.fn());

    expect(res.writeHead).toHaveBeenCalledWith(401, { 'Content-Type': 'application/json' });
    expect(JSON.parse(res.end.mock.calls[0][0])).toEqual({
      success: false,
      error: 'Unauthorized: Missing authentication token',
    });
    expect(verify).not.toHaveBeenCalled();
  });

  test('returns 403 when token verification fails', () => {
    verify.mockImplementation((token, secret, callback) => callback(new Error('expired')));
    const res = response();

    requireAuth()({ headers: { authorization: 'Bearer invalid' } }, res, jest.fn());

    expect(verify).toHaveBeenCalledWith('invalid', expect.any(String), expect.any(Function));
    expect(JSON.parse(res.end.mock.calls[0][0]).error).toBe('Forbidden: Invalid or expired token');
  });

  test('returns 403 when the verified user has a disallowed role', () => {
    verify.mockImplementation((token, secret, callback) => callback(null, { role: 'operation' }));
    const next = jest.fn();
    const res = response();

    requireAuth(['manager'])({ headers: { authorization: 'Bearer valid' } }, res, next);

    expect(JSON.parse(res.end.mock.calls[0][0]).error).toBe(
      'Forbidden: You do not have permission to access this resource'
    );
    expect(next).not.toHaveBeenCalled();
  });

  test('attaches the verified user and continues for an allowed role', () => {
    const user = { username: 'alex', role: 'manager' };
    verify.mockImplementation((token, secret, callback) => callback(null, user));
    const req = { headers: { authorization: 'Bearer valid' } };
    const next = jest.fn();

    requireAuth(['manager'])(req, response(), next);

    expect(req.user).toBe(user);
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('allows any verified role when no roles are restricted', () => {
    verify.mockImplementation((token, secret, callback) => callback(null, { role: 'guest' }));
    const next = jest.fn();

    requireAuth()({ headers: { authorization: 'Bearer valid' } }, response(), next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});
