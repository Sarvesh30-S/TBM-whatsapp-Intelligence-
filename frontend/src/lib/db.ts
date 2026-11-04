import { Pool } from 'pg';
import { TwoChatMessage } from './types';

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://postgres.taiaqrtkldbasxvqxhlj:Sarvesh@2004@aws-0-eu-north-1.pooler.supabase.com:5432/postgres';

let pool: Pool | null = null;
let initialized = false;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString,
      ssl: {
        rejectUnauthorized: false,
      },
      max: 10,
      idleTimeoutMillis: 30000,
    });
  }
  return pool;
}

export async function initDb(): Promise<void> {
  if (initialized) return;
  const p = getPool();
  try {
    await p.query(`
      CREATE TABLE IF NOT EXISTS twochat_messages (
        id VARCHAR(255) PRIMARY KEY,
        source VARCHAR(50),
        is_group BOOLEAN DEFAULT FALSE,
        group_uuid VARCHAR(255),
        group_name VARCHAR(255),
        chat_name VARCHAR(255),
        sender_name VARCHAR(255),
        sender_number VARCHAR(100),
        receiver_name VARCHAR(255),
        receiver_number VARCHAR(100),
        from_number VARCHAR(100),
        to_number VARCHAR(100),
        remote_number VARCHAR(100),
        text TEXT,
        quoted_message TEXT,
        sent_by VARCHAR(50),
        timestamp TIMESTAMPTZ,
        event VARCHAR(100),
        media_url TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_twochat_messages_timestamp ON twochat_messages(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_twochat_messages_group_uuid ON twochat_messages(group_uuid);
      CREATE INDEX IF NOT EXISTS idx_twochat_messages_remote_number ON twochat_messages(remote_number);
    `);
    initialized = true;
  } catch (err) {
    console.error('Failed to initialize database tables:', err);
  }
}

export async function saveMessagesToDb(messages: TwoChatMessage[]): Promise<void> {
  if (!messages || messages.length === 0) return;
  await initDb();
  const p = getPool();

  for (const m of messages) {
    if (!m || !m.id) continue;
    try {
      await p.query(
        `
        INSERT INTO twochat_messages (
          id, source, is_group, group_uuid, group_name, chat_name,
          sender_name, sender_number, receiver_name, receiver_number,
          from_number, to_number, remote_number, text, quoted_message,
          sent_by, timestamp, event, media_url
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
        )
        ON CONFLICT (id) DO UPDATE SET
          source = EXCLUDED.source,
          is_group = EXCLUDED.is_group,
          group_uuid = COALESCE(EXCLUDED.group_uuid, twochat_messages.group_uuid),
          group_name = COALESCE(EXCLUDED.group_name, twochat_messages.group_name),
          chat_name = COALESCE(EXCLUDED.chat_name, twochat_messages.chat_name),
          sender_name = EXCLUDED.sender_name,
          sender_number = EXCLUDED.sender_number,
          receiver_name = EXCLUDED.receiver_name,
          sent_by = EXCLUDED.sent_by,
          text = EXCLUDED.text,
          quoted_message = EXCLUDED.quoted_message,
          timestamp = EXCLUDED.timestamp
      `,
        [
          m.id,
          m.source || 'api',
          Boolean(m.isGroup),
          m.groupUuid || null,
          m.groupName || null,
          m.chatName || '',
          m.senderName || '',
          m.senderNumber || '',
          m.receiverName || '',
          m.receiverNumber || '',
          m.fromNumber || '',
          m.toNumber || '',
          m.remoteNumber || '',
          m.text || '',
          m.quotedMessage || null,
          m.sentBy || 'customer',
          m.timestamp ? new Date(m.timestamp) : new Date(),
          m.event || null,
          m.mediaUrl || null,
        ]
      );
    } catch (err) {
      console.error(`Error saving message ${m.id} to Postgres:`, err);
    }
  }
}

export async function getMessagesFromDb(): Promise<TwoChatMessage[]> {
  await initDb();
  const p = getPool();
  try {
    const res = await p.query(`
      SELECT 
        id, source, is_group AS "isGroup", group_uuid AS "groupUuid",
        group_name AS "groupName", chat_name AS "chatName",
        sender_name AS "senderName", sender_number AS "senderNumber",
        receiver_name AS "receiverName", receiver_number AS "receiverNumber",
        from_number AS "fromNumber", to_number AS "toNumber",
        remote_number AS "remoteNumber", text, quoted_message AS "quotedMessage",
        sent_by AS "sentBy", timestamp, event, media_url AS "mediaUrl"
      FROM twochat_messages
      ORDER BY timestamp ASC
      LIMIT 2000
    `);

    return res.rows.map((row) => ({
      ...row,
      timestamp: row.timestamp ? new Date(row.timestamp).toISOString() : new Date().toISOString(),
    }));
  } catch (err) {
    console.error('Error fetching messages from Postgres:', err);
    return [];
  }
}

export async function clearMessagesFromDb(): Promise<void> {
  await initDb();
  const p = getPool();
  try {
    await p.query('TRUNCATE TABLE twochat_messages');
  } catch (err) {
    console.error('Error clearing messages from Postgres:', err);
  }
}
