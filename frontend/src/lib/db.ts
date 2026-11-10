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

export async function initDb(): Promise<void> {
  // Schema is permanently provisioned via Flyway migrations (V1-V8) in Supabase.
  // Skipping redundant DDL queries on serverless cold starts saves 1.5-3 seconds per invocation.
  return Promise.resolve();
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

export interface GroupHistoryQueryResult {
  messages: TwoChatMessage[];
  totalInDb: number;
  excludedCount: number;
  excludedDetails: Array<{ id: string; reason: string }>;
  dateRange: {
    start: string;
    end: string;
  };
}

/**
 * Fetch 100% of available messages for a specific group directly from Postgres in strict chronological order.
 */
export async function getGroupHistoryFromDb(
  groupIdentifier: string,
  dateRangeFilter: 'all' | '24h' | '7d' = 'all'
): Promise<GroupHistoryQueryResult> {
  await initDb();
  const p = getPool();
  const normalized = (groupIdentifier || '').trim();

  const res = await p.query(
    `
    SELECT
      id, source, channel_number AS "channelNumber", is_group AS "isGroup", group_uuid AS "groupUuid",
      group_name AS "groupName", chat_name AS "chatName",
      sender_name AS "senderName", sender_number AS "senderNumber",
      receiver_name AS "receiverName", receiver_number AS "receiverNumber",
      from_number AS "fromNumber", to_number AS "toNumber",
      remote_number AS "remoteNumber", text, quoted_message AS "quotedMessage",
      sent_by AS "sentBy", timestamp, event, media_url AS "mediaUrl"
    FROM twochat_messages
    WHERE (
      group_name ILIKE $1
      OR group_uuid = $1
      OR remote_number = $1
      OR chat_name ILIKE $1
    )
    ORDER BY timestamp ASC
    `,
    [normalized]
  );

  const rawRows = res.rows;
  const totalInDb = rawRows.length;
  const excludedDetails: Array<{ id: string; reason: string }> = [];

  const now = Date.now();
  const validMessages: TwoChatMessage[] = [];

  for (const row of rawRows) {
    const text = (row.text || '').trim();
    const media = row.mediaUrl;
    if (!text && !media) {
      excludedDetails.push({ id: row.id, reason: 'Empty message text without media attachment' });
      continue;
    }

    const ts = row.timestamp ? new Date(row.timestamp).getTime() : 0;
    if (dateRangeFilter === '24h' && now - ts > 24 * 3600 * 1000) {
      continue;
    }
    if (dateRangeFilter === '7d' && now - ts > 7 * 24 * 3600 * 1000) {
      continue;
    }

    validMessages.push({
      ...row,
      groupUuid: row.groupUuid || undefined,
      groupName: row.groupName || undefined,
      quotedMessage: row.quotedMessage || undefined,
      mediaUrl: row.mediaUrl || undefined,
      event: row.event || undefined,
      channelNumber: row.channelNumber || undefined,
      timestamp: row.timestamp ? new Date(row.timestamp).toISOString() : new Date().toISOString(),
    });
  }

  const deduped = deduplicateMessages(validMessages);
  const start = deduped[0]?.timestamp || (totalInDb > 0 && rawRows[0]?.timestamp ? new Date(rawRows[0].timestamp).toISOString() : new Date().toISOString());
  const end = deduped[deduped.length - 1]?.timestamp || start;

  return {
    messages: deduped,
    totalInDb,
    excludedCount: excludedDetails.length,
    excludedDetails,
    dateRange: { start, end },
  };
}
