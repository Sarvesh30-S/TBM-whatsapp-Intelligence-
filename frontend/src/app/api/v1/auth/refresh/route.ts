import { NextRequest, NextResponse } from 'next/server';
import { proxyToBackend } from '@/lib/backend-proxy';

export async function POST(req: NextRequest) {
  const cookieHeader = req.headers.get('cookie') || '';
  // If there's no refresh_token cookie, immediately return 401 in 0ms without waiting for a backend proxy round-trip
  if (!cookieHeader.includes('refresh_token=')) {
    return NextResponse.json(
      { error: 'No active session or refresh token available' },
      { status: 401 }
    );
  }
  return proxyToBackend(req, '/api/v1/auth/refresh', 'POST');
}
