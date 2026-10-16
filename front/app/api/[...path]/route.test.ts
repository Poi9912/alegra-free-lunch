/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { DELETE, GET, PATCH, POST, PUT } from './route';

describe('API proxy route handlers', () => {
  const originalBackendUrl = process.env.BACKEND_URL;

  beforeEach(() => {
    process.env.BACKEND_URL = 'http://api.test';
    global.fetch = jest.fn();
  });

  afterEach(() => {
    if (originalBackendUrl === undefined) delete process.env.BACKEND_URL;
    else process.env.BACKEND_URL = originalBackendUrl;
  });

  test('forwards GET path and query parameters to the backend', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      status: 200,
      json: async () => ({ data: [] }),
    });
    const request = new NextRequest('http://front.test/api/orders?status=ready');

    const response = await GET(request, {
      params: Promise.resolve({ path: ['orders'] }),
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'http://api.test/api/orders?status=ready',
      expect.objectContaining({
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      })
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ data: [] });
  });

  test('uses the local backend URL when BACKEND_URL is not configured', async () => {
    delete process.env.BACKEND_URL;
    (global.fetch as jest.Mock).mockResolvedValue({
      status: 200,
      json: async () => ({ ok: true }),
    });

    await GET(new NextRequest('http://front.test/api/inventory'), {
      params: Promise.resolve({ path: ['inventory'] }),
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/inventory',
      expect.anything()
    );
  });

  test.each([
    ['POST', POST],
    ['PUT', PUT],
    ['PATCH', PATCH],
    ['DELETE', DELETE],
  ] as const)('forwards %s request body', async (method, handler) => {
    (global.fetch as jest.Mock).mockResolvedValue({
      status: 202,
      json: async () => ({ accepted: true }),
    });
    const body = JSON.stringify({ status: 'ready' });
    const request = new NextRequest('http://front.test/api/orders/7', { method, body });

    const response = await handler(request, {
      params: Promise.resolve({ path: ['orders', '7'] }),
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'http://api.test/api/orders/7',
      expect.objectContaining({ method, body })
    );
    expect(response.status).toBe(202);
  });

  test('returns an empty object when the backend response is not JSON', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      status: 502,
      json: async () => {
        throw new SyntaxError('empty response');
      },
    });

    const response = await GET(new NextRequest('http://front.test/api/orders'), {
      params: Promise.resolve({ path: ['orders'] }),
    });

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({});
  });

  test('forwards the token cookie as an authorization header', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      status: 200,
      json: async () => ({ ok: true }),
    });
    const request = new NextRequest('http://front.test/api/orders');
    request.cookies.set('token', 'test-token');

    await GET(request, { params: Promise.resolve({ path: ['orders'] }) });

    expect((global.fetch as jest.Mock).mock.calls[0][1].headers).toEqual(
      expect.objectContaining({ Authorization: expect.stringContaining('test-token') })
    );
  });

  test('does not include a body for an empty mutation request', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      status: 200,
      json: async () => ({ ok: true }),
    });
    const request = new NextRequest('http://front.test/api/orders/1', {
      method: 'POST',
      body: '',
    });

    await POST(request, { params: Promise.resolve({ path: ['orders', '1'] }) });

    expect((global.fetch as jest.Mock).mock.calls[0][1]).not.toHaveProperty('body');
  });

  test('returns 500 when forwarding fails', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('backend down'));

    const response = await GET(new NextRequest('http://front.test/api/orders'), {
      params: Promise.resolve({ path: ['orders'] }),
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      message: 'Internal server proxy error',
      error: 'backend down',
    });
  });
});
