import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { getAuthenticatedUser } from '@/lib/backend-proxy';
import { Pool } from 'pg';

export const dynamic = 'force-dynamic';

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://postgres.taiaqrtkldbasxvqxhlj:Sarvesh@2004@aws-0-eu-north-1.pooler.supabase.com:5432/postgres';

const globalForDb = globalThis as unknown as { __apiUsagePool?: Pool };

function getPool(): Pool {
  if (!globalForDb.__apiUsagePool) {
    globalForDb.__apiUsagePool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 4,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 8000,
    });
  }
  return globalForDb.__apiUsagePool;
}

async function checkAdminUser(req: NextRequest) {
  // 1. NextAuth session
  try {
    const session = await getServerSession(authOptions);
    if (session?.user && (session.user as any).roles?.includes('ROLE_ADMIN')) {
      return session.user;
    }
  } catch {
    // Continue
  }

  // 2. Bearer / dev token
  const authHeader = req.headers.get('authorization');
  if (
    authHeader === 'Bearer demo-jwt-token' ||
    authHeader === 'Bearer dev-demo-token' ||
    authHeader?.includes('dev-demo-token')
  ) {
    return { id: 'u-admin-001', email: 'admin@tbm.internal', roles: ['ROLE_ADMIN'] };
  }

  // 3. Fallback to getAuthenticatedUser
  try {
    const user = await getAuthenticatedUser(req);
    if (user && (user.roles?.includes('ROLE_ADMIN') || user.permissions?.includes('USER_MANAGE'))) {
      return user;
    }
  } catch {
    // Continue
  }

  // 4. Demo fallback if demo mode enabled
  if (process.env.NEXT_PUBLIC_ENABLE_DEMO_MODE === 'true') {
    return { id: 'u-admin-001', email: 'admin@tbm.internal', roles: ['ROLE_ADMIN'] };
  }

  return null;
}

export async function GET(req: NextRequest) {
  try {
    const adminUser = await checkAdminUser(req);
    if (!adminUser) {
      return NextResponse.json(
        { error: 'Forbidden: Administrator privileges required to access API Usage Calculator' },
        { status: 403 }
      );
    }

    const pool = getPool();

    // Ensure audit log table exists for recording explicit sync / API calls
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS twochat_api_audit_log (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          event_type VARCHAR(50) NOT NULL,
          credits_consumed INTEGER NOT NULL DEFAULT 1,
          endpoint VARCHAR(255),
          details JSONB,
          created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        );
      `);
    } catch (tblErr) {
      console.warn('Could not ensure twochat_api_audit_log table:', tblErr);
    }

    // 1. Query aggregate message counts by sent_by and timeframes from twochat_messages
    const statsQuery = `
      SELECT 
        COUNT(*)::int AS total_messages,
        COALESCE(SUM(CASE WHEN sent_by = 'agent' THEN 1 ELSE 0 END), 0)::int AS outbound_sent,
        COALESCE(SUM(CASE WHEN sent_by != 'agent' OR sent_by IS NULL THEN 1 ELSE 0 END), 0)::int AS inbound_webhooks,
        COALESCE(SUM(CASE WHEN timestamp >= CURRENT_DATE THEN 1 ELSE 0 END), 0)::int AS today_count,
        COALESCE(SUM(CASE WHEN timestamp >= (NOW() - INTERVAL '24 hours') THEN 1 ELSE 0 END), 0)::int AS last_24h_count,
        COALESCE(SUM(CASE WHEN timestamp >= (NOW() - INTERVAL '7 days') THEN 1 ELSE 0 END), 0)::int AS last_7d_count,
        COALESCE(SUM(CASE WHEN timestamp >= (NOW() - INTERVAL '30 days') THEN 1 ELSE 0 END), 0)::int AS last_30d_count
      FROM twochat_messages;
    `;

    // 2. Query top consuming groups
    const topGroupsQuery = `
      SELECT 
        COALESCE(NULLIF(TRIM(group_name), ''), NULLIF(TRIM(chat_name), ''), 'Direct Messages') AS name,
        COUNT(*)::int AS count
      FROM twochat_messages
      GROUP BY COALESCE(NULLIF(TRIM(group_name), ''), NULLIF(TRIM(chat_name), ''), 'Direct Messages')
      ORDER BY count DESC
      LIMIT 8;
    `;

    // 3. Query distinct active groups count
    const distinctGroupsQuery = `
      SELECT COUNT(DISTINCT COALESCE(NULLIF(TRIM(group_name), ''), NULLIF(TRIM(chat_name), '')))::int AS count
      FROM twochat_messages
      WHERE COALESCE(NULLIF(TRIM(group_name), ''), NULLIF(TRIM(chat_name), '')) IS NOT NULL;
    `;

    // 4. Query audit log sync calls
    const auditQuery = `
      SELECT COALESCE(SUM(credits_consumed), 0)::int AS sync_credits
      FROM twochat_api_audit_log;
    `;

    const [statsRes, topGroupsRes, distinctGroupsRes, auditRes] = await Promise.all([
      pool.query(statsQuery),
      pool.query(topGroupsQuery),
      pool.query(distinctGroupsQuery),
      pool.query(auditQuery).catch(() => ({ rows: [{ sync_credits: 0 }] })),
    ]);

    const stats = statsRes.rows[0] || {
      total_messages: 0,
      outbound_sent: 0,
      inbound_webhooks: 0,
      today_count: 0,
      last_24h_count: 0,
      last_7d_count: 0,
      last_30d_count: 0,
    };

    const recordedSyncCredits = auditRes.rows[0]?.sync_credits || 0;
    // Default baseline for initial channel, contacts, group syncs and health verification checks:
    // If audit log is fresh, provide an accurate baseline (14 calls)
    const systemSyncCalls = Math.max(14, recordedSyncCredits);

    const inboundWebhooks = Number(stats.inbound_webhooks) || 0;
    const outboundSent = Number(stats.outbound_sent) || 0;

    // Core rule: Each message received via webhook = 1 credit
    // Each outbound message sent via API = 1 credit
    // Each sync endpoint call = 1 credit
    const totalApiCredits = inboundWebhooks + outboundSent + systemSyncCalls;

    // Optional query parameter to simulate or display custom plan pool (defaults to 500 trial or 1000 starter)
    const { searchParams } = new URL(req.url);
    const poolParam = Number(searchParams.get('poolLimit'));
    const allocatedCredits = Number.isFinite(poolParam) && poolParam > 0 ? poolParam : 1000;

    const remainingCredits = Math.max(0, allocatedCredits - totalApiCredits);
    const percentUsed = Math.min(100, Math.round((totalApiCredits / allocatedCredits) * 1000) / 10);

    let status: 'healthy' | 'warning' | 'critical' | 'exhausted' = 'healthy';
    if (percentUsed >= 100) {
      status = 'exhausted';
    } else if (percentUsed >= 90) {
      status = 'critical';
    } else if (percentUsed >= 80) {
      status = 'warning';
    }

    const totalMsgsForPct = Math.max(1, Number(stats.total_messages) || 1);
    const topGroups = topGroupsRes.rows.map((row: any) => {
      const cnt = Number(row.count) || 0;
      return {
        name: row.name,
        messageCount: cnt,
        creditsUsed: cnt, // 1 message = 1 credit
        percentage: Math.round((cnt / totalMsgsForPct) * 1000) / 10,
      };
    });

    const activeGroupsCount = Math.max(1, Number(distinctGroupsRes.rows[0]?.count) || 1);
    const last7dCount = Number(stats.last_7d_count) || 0;
    const avgMessagesPerGroupDay = Math.max(
      0.5,
      Math.round(((last7dCount / activeGroupsCount) / 7) * 10) / 10
    );

    // Projections for 500+ active groups
    const projectedDailyCredits500 = Math.round(500 * avgMessagesPerGroupDay);
    const projectedMonthlyCredits500 = Math.round(projectedDailyCredits500 * 30);

    let recommendedTier = 'Starter (1,000 credits/mo)';
    if (projectedMonthlyCredits500 > 50000) {
      recommendedTier = 'Enterprise Plan (75,000+ credits/mo)';
    } else if (projectedMonthlyCredits500 > 20000) {
      recommendedTier = 'Scale Plan (50,000 credits/mo)';
    } else if (projectedMonthlyCredits500 > 5000) {
      recommendedTier = 'Growth Plan (20,000 credits/mo)';
    } else if (projectedMonthlyCredits500 > 1000) {
      recommendedTier = 'Team Plan (5,000 credits/mo)';
    }

    return NextResponse.json({
      success: true,
      totalApiCredits,
      breakdown: {
        inboundWebhooks,
        outboundSentMessages: outboundSent,
        systemSyncCalls,
        totalMessages: Number(stats.total_messages) || 0,
      },
      periods: {
        today: Number(stats.today_count) || 0,
        last24Hours: Number(stats.last_24h_count) || 0,
        last7Days: last7dCount,
        last30Days: Number(stats.last_30d_count) || 0,
      },
      pool: {
        allocatedCredits,
        usedCredits: totalApiCredits,
        remainingCredits,
        percentUsed,
        status,
      },
      activeGroupsCount,
      topGroups,
      projections: {
        avgMessagesPerGroupDay,
        projectedDailyCredits500Groups: projectedDailyCredits500,
        projectedMonthlyCredits500Groups: projectedMonthlyCredits500,
        recommendedTier,
      },
      rules: {
        creditModel: '1 API credit per message received (webhook), per message sent (API), and per sync query',
        emailAlertThreshold: '90%',
        cutoffThreshold: '100%',
      },
      lastUpdated: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('Error calculating 2Chat API usage:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to calculate API usage' },
      { status: 500 }
    );
  }
}
