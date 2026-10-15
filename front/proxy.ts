import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export default function proxy(request: NextRequest) {
  const tokenCookie = request.cookies.get('token');

  // If token is missing or invalid, redirect to login
  if (!tokenCookie || !tokenCookie.value) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  try {
    const token = tokenCookie.value;
    const parts = token.split('.');
    
    if (parts.length !== 3) {
      throw new Error('Malformed token');
    }

    // Decode JWT payload safely in Edge runtime
    const payloadJson = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(payloadJson);

    // Check expiration
    if (payload.exp && Date.now() >= payload.exp * 1000) {
      const response = NextResponse.redirect(new URL('/login', request.url));
      response.cookies.delete('token');
      return response;
    }
  } catch (err) {
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete('token');
    return response;
  }

  return NextResponse.next();
}

// Restrict proxy to ONLY run on internal dashboard and API routes
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/api/orders/:path*',
    '/api/inventory/:path*',
    '/api/recipes/:path*',
    '/api/purchases/:path*',
    '/api/status/:path*',
  ],
};