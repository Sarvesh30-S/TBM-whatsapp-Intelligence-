import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import {
  getAllUsersWithPermissions,
  getDiscoverableGroups,
  updateUserGroupAssignments,
  setUserActiveStatus,
} from '@/lib/auth-db';

export const dynamic = 'force-dynamic';

async function checkAdmin(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (session?.user && (session.user as any).roles?.includes('ROLE_ADMIN')) {
    return session.user;
  }

  // Also support demo/bearer header for local testing
  const authHeader = req.headers.get('authorization');
  if (authHeader === 'Bearer demo-jwt-token' || authHeader === 'Bearer dev-demo-token') {
    return { id: 'u-admin-001', email: 'admin@tbm.internal', roles: ['ROLE_ADMIN'] };
  }

  return null;
}

export async function GET(req: NextRequest) {
  try {
    const adminUser = await checkAdmin(req);
    if (!adminUser) {
      return NextResponse.json(
        { error: 'Forbidden: Administrator privileges required to manage members' },
        { status: 403 }
      );
    }

    const [users, availableGroups] = await Promise.all([
      getAllUsersWithPermissions(),
      getDiscoverableGroups(),
    ]);

    return NextResponse.json({
      users,
      availableGroups,
    });
  } catch (err: any) {
    console.error('Error in /api/admin/users GET:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error fetching members' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const adminUser = await checkAdmin(req);
    if (!adminUser) {
      return NextResponse.json(
        { error: 'Forbidden: Administrator privileges required' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { targetUserId, groups } = body;

    if (!targetUserId || !Array.isArray(groups)) {
      return NextResponse.json(
        { error: 'Invalid payload: targetUserId and groups array are required' },
        { status: 400 }
      );
    }

    await updateUserGroupAssignments({
      adminUserId: (adminUser as any).id,
      targetUserId,
      groups,
    });

    return NextResponse.json({
      success: true,
      message: 'Group permissions updated successfully',
    });
  } catch (err: any) {
    console.error('Error in /api/admin/users POST:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to update group permissions' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const adminUser = await checkAdmin(req);
    if (!adminUser) {
      return NextResponse.json(
        { error: 'Forbidden: Administrator privileges required' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { targetUserId, isActive } = body;

    if (!targetUserId || typeof isActive !== 'boolean') {
      return NextResponse.json(
        { error: 'Invalid payload: targetUserId and isActive boolean are required' },
        { status: 400 }
      );
    }

    // Protect against self-deactivation
    if ((adminUser as any).id === targetUserId && !isActive) {
      return NextResponse.json(
        { error: 'Cannot deactivate your own administrator account' },
        { status: 400 }
      );
    }

    await setUserActiveStatus(targetUserId, isActive);

    return NextResponse.json({
      success: true,
      message: `User successfully ${isActive ? 'activated' : 'deactivated'}`,
    });
  } catch (err: any) {
    console.error('Error in /api/admin/users PATCH:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to update user status' },
      { status: 500 }
    );
  }
}
