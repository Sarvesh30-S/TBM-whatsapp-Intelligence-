import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import {
  createGroupAccessRequest,
  getGroupAccessRequests,
  resolveGroupAccessRequest,
  getDiscoverableGroups,
} from '@/lib/auth-db';

export const dynamic = 'force-dynamic';

const KNOWN_COMPANY_GROUPS = [
  'Client || Blue Tyga x TBM || Celeb execution',
  'Blue Tyga DVC || TBM internal',
  'Emami X TheBoredMonkey',
  'Cent X TheBoredMonkey',
  'BM x Eclipse Solaire Matte Effect',
];

async function getAuthenticatedUser(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (session?.user) {
    const u = session.user as any;
    return {
      id: u.id || 'u-session',
      email: (u.email || '').toLowerCase().trim(),
      name: u.name || (u.email ? u.email.split('@')[0] : 'Team Member'),
      roles: u.roles || ['ROLE_EMPLOYEE'],
      isAdmin: Boolean(u.roles?.includes('ROLE_ADMIN')),
    };
  }

  // Fallback for dev / bearer tokens
  const authHeader = req.headers.get('authorization');
  if (authHeader === 'Bearer demo-jwt-token' || authHeader === 'Bearer dev-demo-token') {
    return {
      id: 'u-admin-001',
      email: 'admin@tbm.internal',
      name: 'System Administrator',
      roles: ['ROLE_ADMIN'],
      isAdmin: true,
    };
  }

  return null;
}

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    const [discoverableGroups] = await Promise.all([
      getDiscoverableGroups().catch(() => []),
    ]);

    // Merge discoverable groups with default company groups
    const groupNameSet = new Set<string>();
    KNOWN_COMPANY_GROUPS.forEach((g) => groupNameSet.add(g));
    discoverableGroups.forEach((dg) => {
      if (dg.name && !dg.name.toLowerCase().includes('pink apple')) {
        groupNameSet.add(dg.name);
      }
    });
    const allGroups = Array.from(groupNameSet);

    if (user?.isAdmin) {
      // Super Admin sees all requests
      const allRequests = await getGroupAccessRequests();
      const pendingCount = allRequests.filter((r) => r.status === 'PENDING').length;
      return NextResponse.json({
        isAdmin: true,
        requests: allRequests,
        pendingCount,
        availableGroups: allGroups,
      });
    }

    // Non-admin sees their own requests
    const userEmail = user?.email || req.nextUrl.searchParams.get('email') || '';
    const userRequests = userEmail ? await getGroupAccessRequests(userEmail) : [];

    return NextResponse.json({
      isAdmin: false,
      requests: userRequests,
      availableGroups: allGroups,
    });
  } catch (err: any) {
    console.error('Error in /api/access-requests GET:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to fetch access requests' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    const body = await req.json();

    const userEmail = (user?.email || body.userEmail || '').trim().toLowerCase();
    const userName = user?.name || body.userName || (userEmail ? userEmail.split('@')[0] : 'Team Member');
    const userId = user?.id || body.userId || `u-${Date.now()}`;
    const requestedGroups = Array.isArray(body.requestedGroups) ? body.requestedGroups.filter(Boolean) : [];
    const message = body.message?.trim() || '';

    // Enforce: only non-admin accounts need this feature!
    if (user?.isAdmin) {
      return NextResponse.json(
        { error: 'Administrator accounts already possess full access to all WhatsApp groups.' },
        { status: 400 }
      );
    }

    if (!userEmail) {
      return NextResponse.json(
        { error: 'Valid user email is required to submit an access request.' },
        { status: 400 }
      );
    }

    if (requestedGroups.length === 0) {
      return NextResponse.json(
        { error: 'Please select at least one WhatsApp group you require access to.' },
        { status: 400 }
      );
    }

    const newRequest = await createGroupAccessRequest({
      userId,
      userEmail,
      userName,
      requestedGroups,
      message,
    });

    return NextResponse.json({
      success: true,
      message: 'Alert notification sent to Super Admin (Sarvesh) successfully.',
      request: newRequest,
    });
  } catch (err: any) {
    console.error('Error in /api/access-requests POST:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to create access request' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const adminUser = await getAuthenticatedUser(req);
    if (!adminUser?.isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Super Administrator privileges required to resolve access requests.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { requestId, action, targetUserId, targetUserEmail, groups } = body;

    if (!requestId || !action) {
      return NextResponse.json(
        { error: 'requestId and action (APPROVE or REJECT) are required' },
        { status: 400 }
      );
    }

    const status = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    const updated = await resolveGroupAccessRequest({
      requestId,
      status,
      resolvedBy: adminUser.email || 'sarvesh@theboredmonkey.com',
      targetUserId,
      targetUserEmail,
      groups: Array.isArray(groups) ? groups : [],
    });

    return NextResponse.json({
      success: true,
      message: `Access request ${status.toLowerCase()} successfully`,
      request: updated,
    });
  } catch (err: any) {
    console.error('Error in /api/access-requests PATCH:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to resolve access request' },
      { status: 500 }
    );
  }
}
