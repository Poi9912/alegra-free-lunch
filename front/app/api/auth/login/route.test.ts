/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { POST } from './route';

describe('login route handler', () => {
  const originalBackendUrl = process.env.BACKEND_URL;

  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    if (originalBackendUrl === undefined) delete process.env.BACKEND_URL;
    else process.env.BACKEND_URL = originalBackendUrl;
  });

  test('forwards credentials and sets an HTTP-only session cookie', async () => {
    process.env.BACKEND_URL = 'http://api.test';
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ token: 'signed', role: 'manager' }),
    });
    const request = new NextRequest('http://front.test/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'alex', password: 'secret' }),
    });

    const response = await POST(request);

    expect(global.fetch).toHaveBeenCalledWith('http://api.test/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'alex', password: 'secret' }),
    });
    expect(response.status).toBe(200);
    expect(response.cookies.get('token')?.value).toBe('signed');
    expect(response.cookies.get('token')?.httpOnly).toBe(true);
    expect(response.cookies.get('token')?.sameSite).toBe('strict');
  });

  test('passes authentication failures through as a JSON error', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ message: 'Invalid credentials' }),
    });
    const request = new NextRequest('http://front.test/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'alex', password: 'wrong' }),
    });

    const response = await POST(request);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ message: 'Invalid credentials' });
  });

  test('uses a generic message when backend auth error has no message', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({}),
    });
    const response = await POST(new NextRequest('http://front.test/api/auth/login', {
      method: 'POST',
      body: '{}',
    }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ message: 'Invalid credentials' });
  });

  test('returns 500 when request parsing or backend access fails', async () => {
    const response = await POST(new NextRequest('http://front.test/api/auth/login', {
      method: 'POST',
      body: '{bad json',
    }));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      message: 'Internal server error connecting to backend',
    });
  });
});
