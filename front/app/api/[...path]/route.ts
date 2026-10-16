import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

async function proxyHandler(
  request: NextRequest, 
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    // Await params as required by newer Next.js versions
    const resolvedParams = await params;
    const pathSegments = resolvedParams.path || [];
    const backendBase = `${process.env.BACKEND_URL || 'http://localhost:3000'}/api`;
    
    // Construct target URL including any query parameters
    const targetUrl = `${backendBase}/${pathSegments.join('/')}${request.nextUrl.search}`;

    const tokenCookie = request.cookies.get('token');
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (tokenCookie) {
      headers['Authorization'] = `Bearer ${tokenCookie.value}`;
    }

    const fetchOptions: RequestInit = {
      method: request.method,
      headers,
    };

    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
      const bodyText = await request.text();
      if (bodyText) {
        fetchOptions.body = bodyText;
      }
    }

    const backendRes = await fetch(targetUrl, fetchOptions);
    const data = await backendRes.json().catch(() => ({}));

    return NextResponse.json(data, { status: backendRes.status });
  } catch (err: any) {
    return NextResponse.json(
      { message: 'Internal server proxy error', error: err.message },
      { status: 500 }
    );
  }
}

export { 
  proxyHandler as GET, 
  proxyHandler as POST, 
  proxyHandler as PUT, 
  proxyHandler as PATCH, 
  proxyHandler as DELETE 
};