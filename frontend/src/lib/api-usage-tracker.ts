import { Pool } from 'pg';

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://postgres.taiaqrtkldbasxvqxhlj:Sarvesh@2004@aws-0-eu-north-1.pooler.supabase.com:5432/postgres';

const globalForDb = globalThis as unknown as { __apiAuditPool?: Pool };

function getPool(): Pool {
  if (!globalForDb.__apiAuditPool) {
    globalForDb.__apiAuditPool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 2,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 8000,
    });
  }
  return globalForDb.__apiAuditPool;
}

export async function logApiCreditUsage(
  eventType: 'webhook_received' | 'message_sent' | 'sync_query' | 'health_check' | 'flow_trigger',
  credits: number = 1,
  endpoint?: string,
  details?: Record<string, any>
): Promise<void> {
  try {
    const pool = getPool();
    await pool.query(
      `
      INSERT INTO twochat_api_audit_log (event_type, credits_consumed, endpoint, details)
      VALUES ($1, $2, $3, $4)
      `,
      [eventType, credits, endpoint || null, details ? JSON.stringify(details) : null]
    );
  } catch (err) {
    // Audit logging should never block the primary operational flow
    console.warn('API credit audit log non-fatal warning:', err);
  }
}
