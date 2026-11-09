import { NextRequest, NextResponse } from 'next/server';

export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  jobTitle?: string;
  departmentCode?: string;
  departmentName?: string;
  roles: string[];
  permissions: string[];
  mustChangePassword?: boolean;
}

export function getBackendUrl(): string {
  return process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8081';
}

export async function getAuthenticatedUser(req: NextRequest): Promise<AuthenticatedUser | null> {
  const backendBase = getBackendUrl().replace(/\/+$/, '');
  const headers = new Headers();

  const authHeader = req.headers.get('authorization');
  if (authHeader) headers.set('authorization', authHeader);

  const cookieHeader = req.headers.get('cookie');
  if (cookieHeader) headers.set('cookie', cookieHeader);

  try {
    const res = await fetch(`${backendBase}/api/v1/auth/me`, {
      method: 'GET',
      headers,
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as AuthenticatedUser;
  } catch {
    return null;
  }
}

export async function proxyToBackend(req: NextRequest, backendPath: string, method?: string): Promise<NextResponse> {
  const backendBase = getBackendUrl().replace(/\/+$/, '');
  const url = `${backendBase}${backendPath}`;

  const headers = new Headers();

  const contentType = req.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);

  const authHeader = req.headers.get('authorization');
  if (authHeader) headers.set('authorization', authHeader);

  const bootstrapToken = req.headers.get('x-bootstrap-token');
  if (bootstrapToken) headers.set('x-bootstrap-token', bootstrapToken);

  const cookieHeader = req.headers.get('cookie');
  if (cookieHeader) headers.set('cookie', cookieHeader);

  let body: string | undefined = undefined;
  const requestMethod = method || req.method;
  if (requestMethod !== 'GET' && requestMethod !== 'HEAD') {
    try {
      body = await req.text();
    } catch {
      // Empty body
    }
  }

  try {
    const backendRes = await fetch(url, {
      method: requestMethod,
      headers,
      body,
      cache: 'no-store',
    });

    const resBody = await backendRes.text();
    const responseHeaders = new Headers();

    const backendContentType = backendRes.headers.get('content-type');
    if (backendContentType) {
      responseHeaders.set('content-type', backendContentType);
    }

    // Forward Set-Cookie headers from Spring Boot to client
    const setCookies = (backendRes.headers as any).getSetCookie
      ? (backendRes.headers as any).getSetCookie()
      : [backendRes.headers.get('set-cookie')].filter(Boolean);

    for (const cookieStr of setCookies) {
      responseHeaders.append('set-cookie', cookieStr);
    }

    return new NextResponse(resBody, {
      status: backendRes.status,
      headers: responseHeaders,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Could not connect to authentication backend server: ' + err.message },
      { status: 503 }
    );
  }
}
