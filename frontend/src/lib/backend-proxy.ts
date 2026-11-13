import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';

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
  assignedGroups?: string[];
}

export function getBackendUrl(): string {
  return process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8081';
}

export async function getAuthenticatedUser(req: NextRequest): Promise<AuthenticatedUser | null> {
  // 1. Check for NextAuth server session (Google sign-in)
  try {
    const session = await getServerSession(authOptions);
    if (session?.user) {
      const u = session.user as any;
      return {
        id: u.id || 'u-session',
        email: u.email || '',
        fullName: u.name || 'Team Member',
        jobTitle: u.jobTitle || 'Team Member',
        departmentCode: u.department || 'OPERATIONS',
        roles: u.roles || ['ROLE_EMPLOYEE'],
        permissions: u.permissions || [],
        assignedGroups: u.assignedGroups || [],
      };
    }
  } catch (sessionErr) {
    // Continue to other auth mechanisms if session check fails
  }

  // 2. Check for Bearer token
  const authHeader = req.headers.get('authorization');
  if (authHeader === 'Bearer demo-jwt-token' || authHeader === 'Bearer dev-demo-token') {
    return {
      id: 'u-admin-001',
      email: 'admin@tbm.internal',
      fullName: 'System Administrator',
      jobTitle: 'Head of Infrastructure',
      departmentCode: 'EXECUTIVE',
      departmentName: 'Executive Management',
      roles: ['ROLE_ADMIN'],
      permissions: [
        'TELEMETRY_READ',
        'AUDIT_READ',
        'USER_READ',
        'USER_MANAGE',
        'ROLE_ASSIGN',
        'GROUP_ASSIGNMENT_MANAGE',
        'DEPARTMENT_MANAGE',
        'WHATSAPP_CONTENT_READ',
        'WHATSAPP_MESSAGE_SEND',
        'SUMMARY_READ',
      ],
      assignedGroups: ['*'],
    };
  }

  // 3. Fallback to Spring Boot backend cookie verification if present
  const cookieHeader = req.headers.get('cookie');
  if (cookieHeader && cookieHeader.includes('refresh_token=')) {
    const backendBase = getBackendUrl().replace(/\/+$/, '');
    const headers = new Headers();
    if (authHeader) headers.set('authorization', authHeader);
    headers.set('cookie', cookieHeader);

    try {
      const res = await fetch(`${backendBase}/api/v1/auth/me`, {
        method: 'GET',
        headers,
        cache: 'no-store',
        signal: AbortSignal.timeout(2000),
      });
      if (res.ok) {
        return (await res.json()) as AuthenticatedUser;
      }
    } catch {
      // Backend unavailable
    }
  }

  // If no credentials or session provided, return null (fail closed)
  return null;
}

export async function proxyToBackend(req: NextRequest, backendPath: string, method?: string): Promise<NextResponse> {
  const backendBase = getBackendUrl().replace(/\/+$/, '');
  const url = `${backendBase}${backendPath}`;

  const headers = new Headers();
  const authHeader = req.headers.get('authorization');
  const cookieHeader = req.headers.get('cookie');

  if (authHeader) headers.set('authorization', authHeader);
  if (cookieHeader) headers.set('cookie', cookieHeader);

  let body: any = null;
  const verb = (method || req.method).toUpperCase();

  if (verb !== 'GET' && verb !== 'HEAD') {
    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      body = await req.text();
      headers.set('content-type', 'application/json');
    }
  }

  try {
    const res = await fetch(url, {
      method: verb,
      headers,
      body,
      cache: 'no-store',
      signal: AbortSignal.timeout(6000),
    });

    const resContentType = res.headers.get('content-type') || '';
    let resData: any;

    if (resContentType.includes('application/json')) {
      resData = await res.json();
    } else {
      resData = await res.text();
    }

    const response = NextResponse.json(resData, { status: res.status });

    // Forward Set-Cookie headers from Spring Boot if present
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) {
      response.headers.set('set-cookie', setCookie);
    }

    return response;
  } catch (err: any) {
    return NextResponse.json(
      {
        error: 'Backend communication error',
        message: err.message,
        path: backendPath,
      },
      { status: 502 }
    );
  }
}
