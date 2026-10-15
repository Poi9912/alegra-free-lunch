import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Default backend base URL includes /api prefix on port 3000
    const backendBase = process.env.BACKEND_URL || 'http://localhost:3000';

    const backendRes = await fetch(`${backendBase}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await backendRes.json();

    if (!backendRes.ok) {
      return NextResponse.json(
        { message: data.message || 'Invalid credentials' },
        { status: backendRes.status }
      );
    }

    // Set secure HTTP-only cookie
    const response = NextResponse.json(data);
    response.cookies.set({
      name: 'token',
      value: data.token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 8 * 60 * 60, // 8 hours
      path: '/',
    });

    return response;
  } catch (err: any) {
    return NextResponse.json(
      { message: 'Internal server error connecting to backend' },
      { status: 500 }
    );
  }
}