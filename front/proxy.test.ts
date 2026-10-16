/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import proxy, { config } from './proxy';

function request(path = '/dashboard') {
  return new NextRequest(`http://front.test${path}`);
}

function token(payload: object) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `header.${encoded}.signature`;
}

describe('authentication proxy', () => {
  test('redirects when the token cookie is missing', () => {
    const response = proxy(request());

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('http://front.test/login');
  });

  test('redirects and clears malformed tokens', () => {
    const req = request();
    req.cookies.set('token', 'malformed');

    const response = proxy(req);

    expect(response.status).toBe(307);
    expect(response.cookies.get('token')?.value).toBe('');
  });

  test('redirects and clears expired tokens', () => {
    const req = request();
    req.cookies.set('token', token({ exp: 1 }));

    const response = proxy(req);

    expect(response.status).toBe(307);
    expect(response.cookies.get('token')?.value).toBe('');
  });

  test('continues for a valid token without expiration', () => {
    const req = request();
    req.cookies.set('token', token({ role: 'manager' }));

    expect(proxy(req).status).toBe(200);
  });

  test('continues for an unexpired token', () => {
    const req = request();
    req.cookies.set('token', token({ exp: Math.floor(Date.now() / 1000) + 600 }));

    expect(proxy(req).status).toBe(200);
  });

  test('restricts the middleware matcher to protected routes', () => {
    expect(config.matcher).toContain('/dashboard/:path*');
    expect(config.matcher).toContain('/api/orders/:path*');
  });
});
