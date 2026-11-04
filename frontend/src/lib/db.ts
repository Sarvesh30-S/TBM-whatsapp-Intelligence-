import { Pool } from 'pg';
import { TwoChatMessage } from './types';

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://postgres.taiaqrtkldbasxvqxhlj:Sarvesh@2004@aws-0-eu-north-1.pooler.supabase.com:5432/postgres';

// Keep a single pool across hot reloads / warm serverless invocations
const globalForDb = globalThis as unknown as { __twochatPool?: Pool; __twochatDbInit?: Promise<void> };

function getPool(): Pool {
  if (!globalForDb.__twochatPool) {
    globalForDb.__twochatPool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 8000,
    });
  }
  return globalForDb.__twochatPool;
}

export function initDb(): Promise<void> {
  if (!globalForDb.__twochatDbInit) {
    globalForDb.__twochatDbInit = getPool()
      .query(`
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
        ALTER TABLE twochat_messages ADD COLUMN IF NOT EXISTS channel_number VARCHAR(100);
        CREATE INDEX IF NOT EXISTS idx_twochat_messages_timestamp ON twochat_messages(timestamp DESC);
        CREATE INDEX IF NOT EXISTS idx_twochat_messages_channel ON twochat_messages(channel_number);
        CREATE INDEX IF NOT EXISTS idx_twochat_messages_remote_number ON twochat_messages(remote_number);
      `)
      .then(() => undefined)
      .catch((err) => {
        console.error('Failed to initialize database tables:', err);
        globalForDb.__twochatDbInit = undefined;
      });
  }
  return globalForDb.__twochatDbInit;
}

const COLUMNS = [
  'id', 'source', 'channel_number', 'is_group', 'group_uuid', 'group_name', 'chat_name',
  'sender_name', 'sender_number', 'receiver_name', 'receiver_number',
  'from_number', 'to_number', 'remote_number', 'text', 'quoted_message',
  'sent_by', 'timestamp', 'event', 'media_url',
];

function rowValues(m: TwoChatMessage): unknown[] {
  return [
    m.id,
    m.source || 'api',
    m.channelNumber || null,
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
  ];
}

/**
 * Deduplicate messages to ensure 100% data collection accuracy:
 * Prevents identical messages from being double-counted when an optimistic
 * sent record and a 2Chat webhook/API confirmation arrive for the same text.
 */
export function deduplicateMessages(messages: TwoChatMessage[]): TwoChatMessage[] {
  const result: TwoChatMessage[] = [];
  const seenIds = new Set<string>();

  for (const msg of messages) {
    if (!msg || !msg.text || !msg.text.trim()) continue; // Skip empty text
    if (seenIds.has(msg.id)) continue;

    const cleanText = msg.text.trim().toLowerCase();
    const msgTime = new Date(msg.timestamp).getTime();

    // Check for duplicate message with same text & direction within a 120s window
    const dupIndex = result.findIndex((existing) => {
      if (existing.sentBy !== msg.sentBy) return false;
      if (existing.text?.trim().toLowerCase() !== cleanText) return false;
      const existTime = new Date(existing.timestamp).getTime();
      return Math.abs(existTime - msgTime) <= 120000;
    });

    if (dupIndex !== -1) {
      const existing = result[dupIndex];
      // If the incoming message is canonical 2Chat (starts with MSG or UUID) and existing was a temporary sent-*, replace it!
      if (!msg.id.startsWith('sent-') && existing.id.startsWith('sent-')) {
        result[dupIndex] = msg;
        seenIds.add(msg.id);
      }
      continue;
    }

    seenIds.add(msg.id);
    result.push(msg);
  }

  return result.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

/**
 * Batched upsert: one round-trip per 200 messages (instead of one per message).
 */
export async function saveMessagesToDb(messages: TwoChatMessage[]): Promise<void> {
  if (!messages || messages.length === 0) return;
  await initDb();
  const p = getPool();

  // Deduplicate before saving
  const deduplicated = deduplicateMessages(messages);

  // Clean up any matching sent-* messages from the database when real 2Chat messages arrive
  const canonicalTexts = deduplicated
    .filter((m) => !m.id.startsWith('sent-'))
    .map((m) => m.text?.trim())
    .filter(Boolean);

  if (canonicalTexts.length > 0) {
    try {
      await p.query(
        "DELETE FROM twochat_messages WHERE id LIKE 'sent-%' AND text = ANY($1::text[])",
        [canonicalTexts]
      );
    } catch {
      // ignore
    }
  }

  const list = deduplicated;

  const CHUNK = 200;
  for (let i = 0; i < list.length; i += CHUNK) {
    const chunk = list.slice(i, i + CHUNK);
    const params: unknown[] = [];
    const tuples = chunk.map((m) => {
      const vals = rowValues(m);
      const placeholders = vals.map((v) => {
        params.push(v);
        return `$${params.length}`;
      });
      return `(${placeholders.join(', ')})`;
    });

    await p.query(
      `
      INSERT INTO twochat_messages (${COLUMNS.join(', ')})
      VALUES ${tuples.join(', ')}
      ON CONFLICT (id) DO UPDATE SET
        source = EXCLUDED.source,
        channel_number = COALESCE(EXCLUDED.channel_number, twochat_messages.channel_number),
        is_group = EXCLUDED.is_group OR twochat_messages.is_group,
        group_uuid = COALESCE(EXCLUDED.group_uuid, twochat_messages.group_uuid),
        group_name = COALESCE(NULLIF(EXCLUDED.group_name, ''), twochat_messages.group_name),
        chat_name = COALESCE(NULLIF(EXCLUDED.chat_name, ''), twochat_messages.chat_name),
        sender_name = COALESCE(NULLIF(EXCLUDED.sender_name, ''), twochat_messages.sender_name),
        sender_number = COALESCE(NULLIF(EXCLUDED.sender_number, ''), twochat_messages.sender_number),
        receiver_name = COALESCE(NULLIF(EXCLUDED.receiver_name, ''), twochat_messages.receiver_name),
        receiver_number = COALESCE(NULLIF(EXCLUDED.receiver_number, ''), twochat_messages.receiver_number),
        from_number = COALESCE(NULLIF(EXCLUDED.from_number, ''), twochat_messages.from_number),
        to_number = COALESCE(NULLIF(EXCLUDED.to_number, ''), twochat_messages.to_number),
        remote_number = COALESCE(NULLIF(EXCLUDED.remote_number, ''), twochat_messages.remote_number),
        sent_by = EXCLUDED.sent_by,
        text = COALESCE(NULLIF(EXCLUDED.text, ''), twochat_messages.text),
        quoted_message = COALESCE(EXCLUDED.quoted_message, twochat_messages.quoted_message),
        timestamp = EXCLUDED.timestamp,
        media_url = COALESCE(EXCLUDED.media_url, twochat_messages.media_url)
      `,
      params
    );
  }
}

/**
 * Load messages, optionally only those that belong to a given connected channel number.
 */
export async function getMessagesFromDb(channelNumber?: string, limit = 3000): Promise<TwoChatMessage[]> {
  await initDb();
  const p = getPool();
  const res = await p.query(
    `
    SELECT * FROM (
      SELECT
        id, source, channel_number AS "channelNumber", is_group AS "isGroup", group_uuid AS "groupUuid",
        group_name AS "groupName", chat_name AS "chatName",
        sender_name AS "senderName", sender_number AS "senderNumber",
        receiver_name AS "receiverName", receiver_number AS "receiverNumber",
        from_number AS "fromNumber", to_number AS "toNumber",
        remote_number AS "remoteNumber", text, quoted_message AS "quotedMessage",
        sent_by AS "sentBy", timestamp, event, media_url AS "mediaUrl"
      FROM twochat_messages
      WHERE ($1::text IS NULL OR channel_number = $1 OR channel_number IS NULL)
        AND text IS NOT NULL AND text != ''
      ORDER BY timestamp DESC
      LIMIT $2
    ) recent
    ORDER BY timestamp ASC
    `,
    [channelNumber || null, limit]
  );

  const mapped = res.rows.map((row) => ({
    ...row,
    groupUuid: row.groupUuid || undefined,
    groupName: row.groupName || undefined,
    quotedMessage: row.quotedMessage || undefined,
    mediaUrl: row.mediaUrl || undefined,
    event: row.event || undefined,
    channelNumber: row.channelNumber || undefined,
    timestamp: row.timestamp ? new Date(row.timestamp).toISOString() : new Date().toISOString(),
  }));

  return deduplicateMessages(mapped);
}

export async function clearMessagesFromDb(channelNumber?: string): Promise<void> {
  await initDb();
  const p = getPool();
  if (channelNumber) {
    await p.query('DELETE FROM twochat_messages WHERE channel_number = $1 OR channel_number IS NULL', [channelNumber]);
  } else {
    await p.query('TRUNCATE TABLE twochat_messages');
  }
}
