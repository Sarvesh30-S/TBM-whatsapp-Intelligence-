import { Pool } from 'pg';
import crypto from 'crypto';

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://postgres.taiaqrtkldbasxvqxhlj:Sarvesh@2004@aws-0-eu-north-1.pooler.supabase.com:5432/postgres';

const globalForDb = globalThis as unknown as { __authDbPool?: Pool };

function getPool(): Pool {
  if (!globalForDb.__authDbPool) {
    globalForDb.__authDbPool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 8000,
    });
  }
  return globalForDb.__authDbPool;
}

export interface UserDbProfile {
  id: string;
  email: string;
  fullName: string;
  jobTitle?: string;
  departmentCode?: string;
  departmentName?: string;
  roles: string[];
  permissions: string[];
  isActive: boolean;
  assignedGroups: string[]; // List of group_identifiers
}

// Ensure the permissions table exists
export async function ensurePermissionsTable(): Promise<void> {
  const p = getPool();
  await p.query(`
    CREATE TABLE IF NOT EXISTS user_group_permissions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      group_identifier VARCHAR(255) NOT NULL,
      group_name VARCHAR(255) NOT NULL,
      can_view BOOLEAN NOT NULL DEFAULT TRUE,
      can_send BOOLEAN NOT NULL DEFAULT FALSE,
      assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      CONSTRAINT uq_user_group_identifier UNIQUE (user_id, group_identifier)
    );
    CREATE INDEX IF NOT EXISTS idx_ugp_user ON user_group_permissions(user_id, can_view);
  `);
}

/**
 * Syncs a Google OAuth user with the database.
 * Rule:
 * 1. If 0 users exist in the database, the first user is promoted to ROLE_ADMIN!
 * 2. If users already exist, any new user gets created with ROLE_EMPLOYEE (zero groups assigned).
 * 3. If an existing user signs in, returns their current role & assigned groups.
 * 4. If user is deactivated, throws an error.
 */
export async function syncGoogleUser(params: {
  email: string;
  name?: string | null;
  image?: string | null;
}): Promise<UserDbProfile> {
  await ensurePermissionsTable();
  const p = getPool();
  const email = params.email.trim().toLowerCase();
  const fullName = params.name?.trim() || email.split('@')[0];

  // 1. Check if user already exists
  const existingUserRes = await p.query(
    `SELECT u.id, u.email, u.full_name, u.job_title, u.is_active, u.department_id,
            d.code as department_code, d.name as department_name
     FROM users u
     LEFT JOIN departments d ON u.department_id = d.id
     WHERE LOWER(u.email) = $1`,
    [email]
  );

  let userId: string;
  let isActive = true;
  let jobTitle = 'Team Member';
  let departmentCode: string | undefined;
  let departmentName: string | undefined;

  if (existingUserRes.rows.length > 0) {
    const existing = existingUserRes.rows[0];
    if (!existing.is_active) {
      throw new Error('ACCOUNT_DEACTIVATED');
    }
    userId = existing.id;
    isActive = existing.is_active;
    jobTitle = existing.job_title || 'Team Member';
    departmentCode = existing.department_code || undefined;
    departmentName = existing.department_name || undefined;
  } else {
    // 2. Check total users count to determine if this is the FIRST login (Bootstrap Admin)
    const countRes = await p.query('SELECT count(*) as count FROM users');
    const totalUsers = parseInt(countRes.rows[0].count, 10);
    const isFirstUser = totalUsers === 0;

    userId = crypto.randomUUID();
    jobTitle = isFirstUser ? 'Head of Infrastructure / Administrator' : 'Operations Specialist';

    // Get default department
    const deptRes = await p.query(
      `SELECT id, code, name FROM departments WHERE code = $1 LIMIT 1`,
      [isFirstUser ? 'EXECUTIVE' : 'OPERATIONS']
    );
    const deptId = deptRes.rows[0]?.id || null;
    departmentCode = deptRes.rows[0]?.code;
    departmentName = deptRes.rows[0]?.name;

    // Insert user (password_hash set to dummy OAUTH string)
    await p.query(
      `INSERT INTO users (id, email, password_hash, full_name, job_title, department_id, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), NOW())`,
      [userId, email, 'OAUTH_GOOGLE_ACCOUNT', fullName, jobTitle, deptId]
    );

    // Assign Role: ROLE_ADMIN for first user, ROLE_EMPLOYEE for subsequent users
    const targetRoleName = isFirstUser ? 'ROLE_ADMIN' : 'ROLE_EMPLOYEE';
    const roleRes = await p.query(`SELECT id FROM roles WHERE name = $1`, [targetRoleName]);
    if (roleRes.rows.length > 0) {
      const roleId = roleRes.rows[0].id;
      await p.query(
        `INSERT INTO user_roles (user_id, role_id, assigned_at) VALUES ($1, $2, NOW()) ON CONFLICT DO NOTHING`,
        [userId, roleId]
      );
    }
  }

  // 3. Fetch user roles
  const rolesRes = await p.query(
    `SELECT r.name FROM roles r
     JOIN user_roles ur ON ur.role_id = r.id
     WHERE ur.user_id = $1`,
    [userId]
  );
  const roles = rolesRes.rows.map((r) => r.name);
  const isAdmin = roles.includes('ROLE_ADMIN');

  // 4. Fetch permissions based on roles
  const permRes = await p.query(
    `SELECT DISTINCT p.code FROM permissions p
     JOIN role_permissions rp ON rp.permission_id = p.id
     JOIN user_roles ur ON ur.role_id = rp.role_id
     WHERE ur.user_id = $1`,
    [userId]
  );
  const permissions = permRes.rows.map((p) => p.code);

  // 5. Fetch assigned groups
  let assignedGroups: string[] = [];
  if (isAdmin) {
    // Admin has access to all groups (wildcard)
    assignedGroups = ['*'];
  } else {
    const groupPermsRes = await p.query(
      `SELECT group_identifier FROM user_group_permissions WHERE user_id = $1 AND can_view = true`,
      [userId]
    );
    assignedGroups = groupPermsRes.rows.map((g) => g.group_identifier);
  }

  return {
    id: userId,
    email,
    fullName,
    jobTitle,
    departmentCode,
    departmentName,
    roles,
    permissions,
    isActive,
    assignedGroups,
  };
}

/**
 * Returns list of allowed group identifiers for a specific user.
 * Returns null if user is an admin (meaning ALL groups allowed).
 */
export async function getUserAllowedGroupIds(userId: string): Promise<string[] | null> {
  const p = getPool();
  // Check if admin
  const roleCheck = await p.query(
    `SELECT r.name FROM roles r
     JOIN user_roles ur ON ur.role_id = r.id
     WHERE ur.user_id = $1 AND r.name = 'ROLE_ADMIN'`,
    [userId]
  );
  if (roleCheck.rows.length > 0) {
    return null; // Wildcard / Full access
  }

  await ensurePermissionsTable();
  const res = await p.query(
    `SELECT group_identifier FROM user_group_permissions WHERE user_id = $1 AND can_view = true`,
    [userId]
  );
  return res.rows.map((r) => r.group_identifier);
}

/**
 * Fetches all users along with their roles and assigned groups (for Admin Management View).
 */
export async function getAllUsersWithPermissions() {
  await ensurePermissionsTable();
  const p = getPool();

  const usersRes = await p.query(`
    SELECT u.id, u.email, u.full_name, u.job_title, u.is_active, u.created_at,
           d.code as department_code, d.name as department_name
    FROM users u
    LEFT JOIN departments d ON u.department_id = d.id
    ORDER BY u.created_at ASC
  `);

  const results = [];
  for (const user of usersRes.rows) {
    // Roles
    const rolesRes = await p.query(
      `SELECT r.name FROM roles r
       JOIN user_roles ur ON ur.role_id = r.id
       WHERE ur.user_id = $1`,
      [user.id]
    );
    const roles = rolesRes.rows.map((r) => r.name);

    // Group permissions
    const permsRes = await p.query(
      `SELECT group_identifier, group_name, can_view, can_send FROM user_group_permissions WHERE user_id = $1`,
      [user.id]
    );

    const isAdmin = roles.includes('ROLE_ADMIN');

    results.push({
      id: user.id,
      fullName: user.full_name,
      email: user.email,
      jobTitle: user.job_title,
      department: user.department_code || 'OPERATIONS',
      departmentName: user.department_name || 'Fleet & General Operations',
      roles,
      status: user.is_active ? 'ACTIVE' : 'INACTIVE',
      isAdmin,
      groupPermissions: permsRes.rows,
      assignedGroupCount: isAdmin ? 'All' : permsRes.rows.filter((p) => p.can_view).length,
      createdAt: user.created_at,
    });
  }

  return results;
}

/**
 * Updates a user's assigned group permissions.
 */
export async function updateUserGroupAssignments(params: {
  adminUserId?: string;
  targetUserId: string;
  groups: Array<{
    groupIdentifier: string;
    groupName: string;
    canView: boolean;
    canSend: boolean;
  }>;
}) {
  await ensurePermissionsTable();
  const p = getPool();
  const { targetUserId, groups, adminUserId } = params;

  // In transaction, upsert or replace
  await p.query('BEGIN');
  try {
    for (const g of groups) {
      if (g.canView) {
        await p.query(
          `INSERT INTO user_group_permissions (user_id, group_identifier, group_name, can_view, can_send, assigned_by)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (user_id, group_identifier)
           DO UPDATE SET can_view = EXCLUDED.can_view, can_send = EXCLUDED.can_send, group_name = EXCLUDED.group_name`,
          [targetUserId, g.groupIdentifier, g.groupName, g.canView, g.canSend, adminUserId || null]
        );
      } else {
        // If canView is false, remove permission
        await p.query(
          `DELETE FROM user_group_permissions WHERE user_id = $1 AND group_identifier = $2`,
          [targetUserId, g.groupIdentifier]
        );
      }
    }
    await p.query('COMMIT');
    return { success: true };
  } catch (err) {
    await p.query('ROLLBACK');
    throw err;
  }
}

/**
 * Toggles a user's active/inactive status.
 */
export async function setUserActiveStatus(targetUserId: string, isActive: boolean) {
  const p = getPool();
  await p.query(
    `UPDATE users SET is_active = $1, updated_at = NOW(), deactivated_at = $2 WHERE id = $3`,
    [isActive, isActive ? null : new Date(), targetUserId]
  );
  return { success: true };
}

/**
 * Discovers all unique WhatsApp groups from twochat_messages so admin can assign them.
 */
export async function getDiscoverableGroups(): Promise<Array<{ id: string; name: string; channelNumber?: string }>> {
  const p = getPool();
  const res = await p.query(`
    SELECT DISTINCT 
      COALESCE(group_name, chat_name) as name, 
      COALESCE(group_uuid, remote_number, group_name, chat_name) as id,
      channel_number as "channelNumber"
    FROM twochat_messages 
    WHERE is_group = true 
      AND COALESCE(group_name, chat_name) IS NOT NULL 
      AND COALESCE(group_name, chat_name) != ''
    ORDER BY name ASC
  `);

  return res.rows.map((r) => ({
    id: r.id,
    name: r.name,
    channelNumber: r.channelNumber || undefined,
  }));
}
