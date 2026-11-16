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

// Ensure the permissions table exists and clean up legacy duplicate entries
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

    -- Remove any redundant duplicate rows for the same user and group name
    DELETE FROM user_group_permissions a
    USING user_group_permissions b
    WHERE a.ctid < b.ctid
      AND a.user_id = b.user_id
      AND LOWER(TRIM(a.group_name)) = LOWER(TRIM(b.group_name));

    -- Normalize group_identifier to canonical group_name
    UPDATE user_group_permissions 
    SET group_identifier = group_name 
    WHERE group_name IS NOT NULL AND group_name != '' AND group_identifier != group_name;
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
    `SELECT group_identifier, group_name FROM user_group_permissions WHERE user_id = $1 AND can_view = true`,
    [userId]
  );

  if (res.rows.length === 0) {
    return [];
  }

  const ids = new Set<string>();
  const groupNames: string[] = [];

  for (const r of res.rows) {
    if (r.group_identifier) ids.add(r.group_identifier.trim());
    if (r.group_name) {
      ids.add(r.group_name.trim());
      groupNames.push(r.group_name.trim());
    }
  }

  // Also query any UUIDs from twochat_messages that belong to these allowed group names
  if (groupNames.length > 0) {
    const uuidRes = await p.query(
      `SELECT DISTINCT COALESCE(group_uuid, remote_number) as uuid 
       FROM twochat_messages 
       WHERE is_group = true 
         AND COALESCE(group_name, chat_name) = ANY($1::text[])
         AND COALESCE(group_uuid, remote_number) IS NOT NULL`,
      [groupNames]
    );
    for (const r of uuidRes.rows) {
      if (r.uuid) ids.add(r.uuid.trim());
    }
  }

  return Array.from(ids);
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

    // Deduplicate permissions per user by canonical group name
    const dedupedPermsMap = new Map<string, { group_identifier: string; group_name: string; can_view: boolean; can_send: boolean }>();
    for (const r of permsRes.rows) {
      const gName = (r.group_name || r.group_identifier || '').trim();
      if (!gName) continue;
      const key = gName.toLowerCase();
      const existing = dedupedPermsMap.get(key);
      if (!existing) {
        dedupedPermsMap.set(key, {
          group_identifier: gName,
          group_name: gName,
          can_view: Boolean(r.can_view),
          can_send: Boolean(r.can_send),
        });
      } else {
        existing.can_view = existing.can_view || Boolean(r.can_view);
        existing.can_send = existing.can_send || Boolean(r.can_send);
      }
    }
    const dedupedPerms = Array.from(dedupedPermsMap.values());

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
      groupPermissions: dedupedPerms,
      assignedGroupCount: isAdmin ? 'All' : dedupedPerms.filter((p) => p.can_view).length,
      createdAt: user.created_at,
    });
  }

  return results;
}

/**
 * Updates a user's assigned group permissions.
 * Guarantees that unassigning completely purges all permission records for that group name or identifier.
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

  // Resolve targetUserId to a valid UUID from database if needed
  let realTargetUserId = targetUserId;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(realTargetUserId)) {
    const uRes = await p.query(
      `SELECT id FROM users WHERE LOWER(email) = LOWER($1) OR id::text = $1 LIMIT 1`,
      [realTargetUserId]
    );
    if (uRes.rows.length > 0) {
      realTargetUserId = uRes.rows[0].id;
    }
  }

  // Ensure adminUserId is a valid UUID or set to null so foreign key never fails
  let validAdminUuid: string | null = null;
  if (adminUserId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(adminUserId)) {
    const adminCheck = await p.query(`SELECT id FROM users WHERE id = $1 LIMIT 1`, [adminUserId]);
    if (adminCheck.rows.length > 0) {
      validAdminUuid = adminUserId;
    }
  }

  await p.query('BEGIN');
  try {
    for (const g of groups) {
      const gName = (g.groupName || g.groupIdentifier || '').trim();
      const gId = (g.groupIdentifier || g.groupName || '').trim();
      if (!gName) continue;

      if (g.canView) {
        // Delete any existing permission row matching this group by name or id
        await p.query(
          `DELETE FROM user_group_permissions 
           WHERE user_id = $1 
             AND (
               LOWER(TRIM(group_name)) = LOWER(TRIM($2)) 
               OR LOWER(TRIM(group_identifier)) = LOWER(TRIM($2))
               OR LOWER(TRIM(group_identifier)) = LOWER(TRIM($3))
               OR LOWER(TRIM(group_name)) = LOWER(TRIM($3))
             )`,
          [realTargetUserId, gName, gId]
        );

        // Insert fresh canonical record with group name as both identifier and name
        await p.query(
          `INSERT INTO user_group_permissions (user_id, group_identifier, group_name, can_view, can_send, assigned_by)
           VALUES ($1, $2, $2, true, $3, $4)
           ON CONFLICT (user_id, group_identifier)
           DO UPDATE SET can_view = true, can_send = EXCLUDED.can_send, group_name = EXCLUDED.group_name`,
          [realTargetUserId, gName, g.canSend, validAdminUuid]
        );
      } else {
        // UNASSIGN: Purge ALL matching permission records for this group name and identifier!
        await p.query(
          `DELETE FROM user_group_permissions 
           WHERE user_id = $1 
             AND (
               LOWER(TRIM(group_name)) = LOWER(TRIM($2)) 
               OR LOWER(TRIM(group_identifier)) = LOWER(TRIM($2))
               OR LOWER(TRIM(group_identifier)) = LOWER(TRIM($3))
               OR LOWER(TRIM(group_name)) = LOWER(TRIM($3))
             )`,
          [realTargetUserId, gName, gId]
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
 * Guarantees zero duplicates by grouping by canonical group name.
 */
export async function getDiscoverableGroups(): Promise<Array<{ id: string; name: string; channelNumber?: string }>> {
  const p = getPool();
  const res = await p.query(`
    SELECT 
      COALESCE(group_name, chat_name) as name, 
      MIN(COALESCE(group_uuid, remote_number, group_name, chat_name)) as id,
      MAX(channel_number) as "channelNumber"
    FROM twochat_messages 
    WHERE is_group = true 
      AND COALESCE(group_name, chat_name) IS NOT NULL 
      AND COALESCE(group_name, chat_name) != ''
      AND LOWER(COALESCE(group_name, chat_name)) NOT LIKE '%pink apple%'
    GROUP BY COALESCE(group_name, chat_name)
    ORDER BY name ASC
  `);

  const seenNames = new Set<string>();
  const uniqueGroups: Array<{ id: string; name: string; channelNumber?: string }> = [];

  for (const r of res.rows) {
    const rawName = (r.name || '').trim();
    if (!rawName) continue;
    const lowerKey = rawName.toLowerCase();
    if (!seenNames.has(lowerKey)) {
      seenNames.add(lowerKey);
      uniqueGroups.push({
        id: rawName, // Canonical name as id ensures 1:1 consistent mapping
        name: rawName,
        channelNumber: r.channelNumber || undefined,
      });
    }
  }

  return uniqueGroups;
}

/**
 * Ensures the group_access_requests table exists for tracking non-admin group access requests.
 */
export async function ensureAccessRequestsTable(): Promise<void> {
  const p = getPool();
  await p.query(`
    CREATE TABLE IF NOT EXISTS group_access_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id VARCHAR(255) NOT NULL,
      user_email VARCHAR(255) NOT NULL,
      user_name VARCHAR(255) NOT NULL,
      requested_groups TEXT[] NOT NULL,
      message TEXT,
      status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      resolved_at TIMESTAMP WITH TIME ZONE,
      resolved_by VARCHAR(255)
    );
    CREATE INDEX IF NOT EXISTS idx_gar_status ON group_access_requests(status);
    CREATE INDEX IF NOT EXISTS idx_gar_user ON group_access_requests(user_id);
    CREATE INDEX IF NOT EXISTS idx_gar_email ON group_access_requests(user_email);
  `);
}

export interface GroupAccessRequestRecord {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  requested_groups: string[];
  message?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  created_at: string;
  resolved_at?: string;
  resolved_by?: string;
}

/**
 * Creates a new group access request alert for the Super Admin.
 */
export async function createGroupAccessRequest(params: {
  userId: string;
  userEmail: string;
  userName: string;
  requestedGroups: string[];
  message?: string;
}): Promise<GroupAccessRequestRecord> {
  await ensureAccessRequestsTable();
  const p = getPool();
  const res = await p.query(
    `INSERT INTO group_access_requests (user_id, user_email, user_name, requested_groups, message, status, created_at)
     VALUES ($1, $2, $3, $4, $5, 'PENDING', NOW())
     RETURNING *`,
    [
      params.userId,
      params.userEmail.trim().toLowerCase(),
      params.userName,
      params.requestedGroups,
      params.message || '',
    ]
  );
  return res.rows[0];
}

/**
 * Fetches group access requests. If userEmail is provided, returns that user's requests.
 * Otherwise returns all requests (ordered by pending first).
 */
export async function getGroupAccessRequests(userEmail?: string): Promise<GroupAccessRequestRecord[]> {
  await ensureAccessRequestsTable();
  const p = getPool();
  if (userEmail) {
    const res = await p.query(
      `SELECT * FROM group_access_requests 
       WHERE LOWER(user_email) = LOWER($1) 
       ORDER BY created_at DESC 
       LIMIT 30`,
      [userEmail]
    );
    return res.rows;
  }
  const res = await p.query(
    `SELECT * FROM group_access_requests 
     ORDER BY CASE WHEN status = 'PENDING' THEN 0 ELSE 1 END, created_at DESC 
     LIMIT 50`
  );
  return res.rows;
}

/**
 * Resolves an access request (APPROVED or REJECTED) and auto-grants permissions if APPROVED.
 */
export async function resolveGroupAccessRequest(params: {
  requestId: string;
  status: 'APPROVED' | 'REJECTED';
  resolvedBy: string;
  targetUserId?: string;
  targetUserEmail?: string;
  groups?: string[];
}): Promise<GroupAccessRequestRecord> {
  await ensureAccessRequestsTable();
  await ensurePermissionsTable();
  const p = getPool();
  const { requestId, status, resolvedBy, targetUserId, targetUserEmail, groups } = params;

  if (status === 'APPROVED' && groups && groups.length > 0) {
    let realUserId = targetUserId;
    if (!realUserId || realUserId.startsWith('u-session') || realUserId.startsWith('u-emp')) {
      if (targetUserEmail) {
        const uRes = await p.query(
          'SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
          [targetUserEmail.toLowerCase()]
        );
        if (uRes.rows.length > 0) {
          realUserId = uRes.rows[0].id;
        }
      }
    }

    if (realUserId) {
      for (const groupName of groups) {
        await p.query(
          `INSERT INTO user_group_permissions (user_id, group_identifier, group_name, can_view, can_send, assigned_by)
           VALUES ($1, $2, $3, true, true, (SELECT id FROM users WHERE LOWER(email) = LOWER($4) LIMIT 1))
           ON CONFLICT (user_id, group_identifier)
           DO UPDATE SET can_view = true, can_send = true, group_name = EXCLUDED.group_name`,
          [realUserId, groupName, groupName, resolvedBy]
        );
      }
    }
  }

  const res = await p.query(
    `UPDATE group_access_requests 
     SET status = $1, resolved_at = NOW(), resolved_by = $2 
     WHERE id = $3 
     RETURNING *`,
    [status, resolvedBy, requestId]
  );
  return res.rows[0];
}

/**
 * Deletes an access request by id.
 */
export async function deleteGroupAccessRequest(requestId: string): Promise<boolean> {
  await ensureAccessRequestsTable();
  const p = getPool();
  const res = await p.query(`DELETE FROM group_access_requests WHERE id = $1`, [requestId]);
  return (res.rowCount ?? 0) > 0;
}
