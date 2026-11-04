import { TwoChatChannel, TwoChatGroup, TwoChatMessage } from './types';

const TWOCHAT_BASE_URL = 'https://api.p.2chat.io/open';
const REQUEST_TIMEOUT_MS = 7000;

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

export function cleanDigits(phone: string): string {
  if (!phone) return '';
  return String(phone).replace(/[^0-9]/g, '');
}

export function normalizePhone(phone: string): string {
  if (!phone) return '';
  const digits = cleanDigits(phone);
  return digits ? `+${digits}` : '';
}

export function formatPhoneDisplay(phone: string): string {
  if (!phone) return '';
  const digits = cleanDigits(phone);
  if (!digits) return '';
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  return `+${digits}`;
}

export function decodeHtmlEntities(str: string): string {
  if (!str) return '';
  return str
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

/**
 * 2Chat returns timestamps like "2026-11-04T05:49:19" which are UTC but carry no zone.
 * Without this, servers/browsers in IST parse them as local time and shift them by 5h30m.
 */
export function normalizeTimestamp(value: unknown): string {
  if (!value) return new Date().toISOString();
  if (typeof value === 'number') {
    return new Date(value < 1e12 ? value * 1000 : value).toISOString();
  }
  let s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(s)) {
    s = s.replace(' ', 'T') + 'Z';
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

const GENERIC_NAMES = new Set(['', 'whatsapp group', 'participant', 'unknown', 'my whatsapp', 'direct chat', 'sender', 'recipient']);

export function isGenericName(name?: string | null): boolean {
  if (!name) return true;
  const n = name.trim().toLowerCase();
  if (GENERIC_NAMES.has(n)) return true;
  // A "name" that is only a phone number is not a real name
  return /^[+\d\s()-]+$/.test(n);
}

export function extractMessageText(raw: any): string {
  if (typeof raw === 'string') return decodeHtmlEntities(raw);
  if (!raw) return '';

  let text = '';
  if (typeof raw.text === 'string' && raw.text.trim()) text = raw.text;
  else if (typeof raw.body === 'string' && raw.body.trim()) text = raw.body;
  else if (raw.message) {
    if (typeof raw.message === 'string') text = raw.message;
    else if (typeof raw.message.text === 'string' && raw.message.text.trim()) text = raw.message.text;
    else if (typeof raw.message.body === 'string' && raw.message.body.trim()) text = raw.message.body;
    else if (typeof raw.message.caption === 'string' && raw.message.caption.trim()) text = raw.message.caption;
  } else if (typeof raw.caption === 'string' && raw.caption.trim()) text = raw.caption;

  return decodeHtmlEntities(text);
}

export function extractMediaUrl(raw: any): string | undefined {
  if (!raw) return undefined;
  return (
    raw.url ||
    raw.media_url ||
    raw.message?.url ||
    raw.message?.media?.url ||
    raw.media?.url ||
    undefined
  );
}

export function extractMediaType(raw: any): string | undefined {
  return raw?.message?.media?.type || raw?.media?.type || raw?.type || undefined;
}

export function extractQuotedMessage(raw: any): string | undefined {
  if (!raw) return undefined;
  const candidates = [
    raw.message?.quoted_msg,
    raw.quoted_msg,
    raw.quoted_message,
    raw.message?.quoted_message,
    raw.context?.quoted_message,
  ];
  for (const q of candidates) {
    if (!q) continue;
    if (typeof q === 'string') return decodeHtmlEntities(q);
    const t = q.message || q.text || q.body || q.caption;
    if (typeof t === 'string' && t.trim()) return decodeHtmlEntities(t);
  }
  return undefined;
}

export function extractJidFromSessionKey(sessionKey: string): string {
  if (!sessionKey) return '';
  // WW-WPN<channel uuid>-<jid>. Match the UUID strictly so hyphens inside old group JIDs
  // (e.g. 919619029760-1582312311@g.us) are kept intact.
  const match = sessionKey.match(
    /^(?:[A-Za-z0-9]+-)?(?:[A-Za-z]{3})?[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}-(.+)$/
  );
  if (match) return match[1];
  return sessionKey.includes('@') ? sessionKey : '';
}

/* ------------------------------------------------------------------ */
/* Direction: who actually sent the message                           */
/* ------------------------------------------------------------------ */

/**
 * 2Chat conventions:
 *   sent_by = "user"            -> written by the external WhatsApp contact / group participant (INBOUND)
 *   sent_by = "agent" | "api"   -> written by the connected number (you) (OUTBOUND)
 * Explicit flags always win. The phone comparison is only a last resort and uses the
 * *current* connected channel number (never a hard-coded one).
 */
export function resolveDirection(raw: any, channelDigits: string, senderDigits: string): 'inbound' | 'outbound' {
  const sentBy = String(raw?.sent_by ?? '').toLowerCase();
  if (sentBy === 'user' || sentBy === 'contact' || sentBy === 'customer') return 'inbound';
  if (['agent', 'api', 'bot', 'flow', 'campaign', 'system', 'channel', 'owner'].includes(sentBy)) return 'outbound';

  const event = String(raw?.event ?? '').toLowerCase();
  if (event.endsWith('.sent')) return 'outbound';
  if (event.endsWith('.received')) return 'inbound';

  if (raw?.from_me === true || raw?.fromMe === true) return 'outbound';
  if (raw?.from_me === false || raw?.fromMe === false) return 'inbound';

  const dir = String(raw?.direction ?? '').toLowerCase();
  if (['outbound', 'out', 'sent'].includes(dir)) return 'outbound';
  if (['inbound', 'in', 'received'].includes(dir)) return 'inbound';

  if (channelDigits && senderDigits && channelDigits === senderDigits) return 'outbound';
  return 'inbound';
}

/* ------------------------------------------------------------------ */
/* Normalization: one function for REST feed, group history & webhooks */
/* ------------------------------------------------------------------ */

export interface NormalizeContext {
  channelNumber: string;
  channelName?: string;
  contacts?: Record<string, string>;
  groupsByJid?: Map<string, TwoChatGroup>;
  groupsByUuid?: Map<string, TwoChatGroup>;
  forcedGroup?: TwoChatGroup;
  source: 'api' | 'webhook';
}

function phoneFromJid(jid?: string): string {
  if (!jid) return '';
  if (jid.endsWith('@c.us') || jid.endsWith('@s.whatsapp.net')) return normalizePhone(jid.split('@')[0]);
  return '';
}

function firstGroupJid(...values: unknown[]): string | undefined {
  for (const v of values) {
    if (typeof v === 'string' && v.endsWith('@g.us')) return v;
  }
  return undefined;
}

export function normalizeTwoChatMessage(raw: any, ctx: NormalizeContext): TwoChatMessage | null {
  if (!raw || typeof raw !== 'object') return null;

  const text = extractMessageText(raw);
  const quotedMessage = extractQuotedMessage(raw);
  const mediaUrl = extractMediaUrl(raw);
  if (!text && !quotedMessage && !mediaUrl) return null; // e.g. "ready" / status events

  const channelNumber = normalizePhone(
    raw.channel_phone_number || raw.channel?.phone_number || raw.on_number || ctx.channelNumber || ''
  );
  const channelDigits = cleanDigits(channelNumber);
  const contacts = ctx.contacts || {};

  const jid = extractJidFromSessionKey(raw.session_key || '');

  // ---- Group detection ----
  const rawGroupUuid: string | undefined = raw.group?.uuid || raw.group_uuid || raw.to_group_uuid || undefined;
  const rawGroupJid = firstGroupJid(raw.group?.wa_group_id, raw.group_jid, jid, raw.to_number, raw.from_number, raw.remote_phone_number);

  let group: TwoChatGroup | undefined = ctx.forcedGroup;
  if (!group && rawGroupJid) group = ctx.groupsByJid?.get(rawGroupJid);
  if (!group && rawGroupUuid) group = ctx.groupsByUuid?.get(rawGroupUuid);

  const isGroup = Boolean(
    group || rawGroupJid || rawGroupUuid || raw.participant || String(raw.event || '').includes('group')
  );

  // ---- Who wrote it ----
  const participantNumber = normalizePhone(raw.participant?.phone_number || raw.sender?.phone_number || '');
  const directRemote = isGroup
    ? ''
    : normalizePhone(
        phoneFromJid(jid) ||
          raw.remote_phone_number ||
          raw.contact?.phone_number ||
          [raw.from_number, raw.to_number].find(
            (n) => typeof n === 'string' && cleanDigits(n) && cleanDigits(n) !== channelDigits && !n.includes('@g.us')
          ) ||
          ''
      );

  const candidateSender = isGroup ? participantNumber : directRemote;
  const direction = resolveDirection(raw, channelDigits, cleanDigits(candidateSender));
  const isOutbound = direction === 'outbound';

  const contactFullName = [raw.contact?.first_name, raw.contact?.last_name].filter(Boolean).join(' ').trim();

  let senderNumber: string;
  let senderName: string;
  if (isOutbound) {
    senderNumber = channelNumber;
    senderName = ctx.channelName || 'You';
  } else if (isGroup) {
    senderNumber = participantNumber || normalizePhone(raw.remote_phone_number || '');
    senderName =
      contacts[senderNumber] ||
      raw.participant?.pushname ||
      raw.participant?.name ||
      raw.sender?.pushname ||
      raw.sender?.name ||
      raw.pushname ||
      '';
  } else {
    senderNumber = directRemote;
    senderName =
      contacts[directRemote] ||
      contactFullName ||
      raw.contact?.name ||
      raw.contact?.friendly_name ||
      raw.pushname ||
      raw.sender?.pushname ||
      '';
  }
  if (!isOutbound) {
    if (!senderName || isGenericName(senderName)) {
      senderName = formatPhoneDisplay(senderNumber) || senderNumber || 'Unknown';
    }
  } else {
    senderName = ctx.channelName || 'You';
  }

  // ---- Chat identity ----
  const groupJid = group?.wa_group_id || rawGroupJid;
  const groupUuid = group?.uuid || rawGroupUuid;
  let groupName = '';
  if (isGroup) {
    const candidates = [
      group?.wa_group_name,
      group?.name,
      raw.group?.wa_group_name,
      raw.group?.name,
      raw.group_name,
      raw.contact?.friendly_name,
    ];
    groupName = candidates.find((n) => typeof n === 'string' && !isGenericName(n)) || '';
    if (!groupName) groupName = groupJid || 'WhatsApp Group';
  }

  const directFormatted = formatPhoneDisplay(directRemote) || directRemote;
  const directName = isGroup
    ? ''
    : contacts[directRemote] ||
      (!isOutbound && !isGenericName(senderName) ? senderName : '') ||
      contactFullName ||
      (!isGenericName(raw.contact?.friendly_name) ? raw.contact?.friendly_name : '') ||
      directFormatted ||
      'Direct Chat';

  const chatId = isGroup ? groupJid || groupUuid || '' : directRemote;
  const chatName = isGroup ? groupName : directName;

  const myName = ctx.channelName || 'You';

  return {
    id: raw.id || raw.uuid || `${ctx.source}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    source: ctx.source,
    channelNumber: channelNumber || undefined,
    isGroup,
    groupUuid: isGroup ? groupUuid : undefined,
    groupName: isGroup ? groupName || undefined : undefined,
    chatName,
    senderName,
    senderNumber,
    receiverName: isGroup ? groupName : isOutbound ? directName : myName,
    receiverNumber: isGroup ? groupJid || groupUuid || '' : isOutbound ? directRemote : channelNumber,
    fromNumber: senderNumber,
    toNumber: isGroup ? groupJid || groupUuid || '' : isOutbound ? directRemote : channelNumber,
    remoteNumber: chatId,
    text: text || (mediaUrl ? `[${extractMediaType(raw) || 'media'}]` : ''),
    quotedMessage,
    sentBy: isOutbound ? 'agent' : 'customer',
    timestamp: normalizeTimestamp(raw.created_at || raw.timestamp || raw.sent_at),
    event: raw.event || undefined,
    mediaUrl,
  };
}

/* ------------------------------------------------------------------ */
/* HTTP + in-memory caching (keeps every request fast)                */
/* ------------------------------------------------------------------ */

type CacheEntry<T> = { value: T; expires: number };
const globalCache = globalThis as unknown as { __twochatCache?: Map<string, CacheEntry<unknown>> };
const cache = (globalCache.__twochatCache ||= new Map());

function getCached<T>(key: string): T | undefined {
  const hit = cache.get(key) as CacheEntry<T> | undefined;
  if (hit && hit.expires > Date.now()) return hit.value;
  return undefined;
}

function setCached<T>(key: string, value: T, ttlMs: number) {
  cache.set(key, { value, expires: Date.now() + ttlMs });
}

export function clearTwoChatCache() {
  cache.clear();
}

async function twoChatGet(apiKey: string, path: string): Promise<{ ok: boolean; status: number; data: any; text?: string }> {
  try {
    const res = await fetch(`${TWOCHAT_BASE_URL}${path}`, {
      method: 'GET',
      headers: { 'X-User-API-Key': apiKey, 'Content-Type': 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const text = await res.text();
    let data: any = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
    return { ok: res.ok, status: res.status, data, text };
  } catch (err: any) {
    return { ok: false, status: 0, data: null, text: err?.message || 'Network error' };
  }
}

function describeError(r: { status: number; data: any; text?: string }): string {
  const msg = r.data?.error_message || r.data?.message || r.text || 'Request failed';
  return `HTTP ${r.status}: ${String(msg).slice(0, 200)}`;
}

function listFrom(data: any, ...keys: string[]): any[] {
  if (Array.isArray(data)) return data;
  for (const k of keys) {
    if (Array.isArray(data?.[k])) return data[k];
  }
  return [];
}

/** Connected WhatsApp numbers for this API key (cached 10 min). */
export async function fetchTwoChatChannels(apiKey: string): Promise<{ channels: TwoChatChannel[]; error?: string }> {
  const key = `channels:${apiKey}`;
  const cached = getCached<TwoChatChannel[]>(key);
  if (cached) return { channels: cached };

  const r = await twoChatGet(apiKey, '/whatsapp/get-numbers?page_number=0');
  if (!r.ok) return { channels: [], error: describeError(r) };

  const channels: TwoChatChannel[] = listFrom(r.data, 'numbers', 'channels', 'data').map((ch: any) => ({
    uuid: ch.uuid || ch.id || '',
    phone_number: normalizePhone(ch.phone_number || ch.number || ''),
    friendly_name: ch.friendly_name || ch.pushname || ch.name || '',
    connection_status: ch.connection_status,
    enabled: ch.enabled,
    channel_type: ch.channel_type,
  }));
  setCached(key, channels, 10 * 60 * 1000);
  return { channels };
}

/** Saved contacts directory: phone -> name (cached 10 min). */
export async function fetchTwoChatContacts(apiKey: string): Promise<Record<string, string>> {
  const key = `contacts:${apiKey}`;
  const cached = getCached<Record<string, string>>(key);
  if (cached) return cached;

  const contactMap: Record<string, string> = {};
  const r = await twoChatGet(apiKey, '/contacts?results_per_page=100&page_number=1');
  if (r.ok) {
    for (const c of listFrom(r.data, 'contacts', 'data')) {
      const fullName = (c.name || `${c.first_name || ''} ${c.last_name || ''}`.trim()).trim();
      if (!fullName) continue;
      if (c.phone_number) contactMap[normalizePhone(c.phone_number)] = fullName;
      if (Array.isArray(c.contact_details)) {
        for (const d of c.contact_details) {
          if (d?.value && cleanDigits(d.value).length >= 8) contactMap[normalizePhone(d.value)] = fullName;
        }
      }
    }
  }
  setCached(key, contactMap, 10 * 60 * 1000);
  return contactMap;
}

/** WhatsApp groups of a connected number (cached 10 min). */
export async function fetchTwoChatGroups(
  apiKey: string,
  phoneNumber: string
): Promise<{ groups: TwoChatGroup[]; error?: string }> {
  const plus = normalizePhone(phoneNumber);
  const key = `groups:${apiKey}:${plus}`;
  const cached = getCached<TwoChatGroup[]>(key);
  if (cached) return { groups: cached };

  let r = await twoChatGet(apiKey, `/whatsapp/groups/${plus}`);
  // Only retry with alternate formatting when the number format was the problem (not auth / quota)
  if (!r.ok && ![401, 402, 403, 429].includes(r.status)) {
    r = await twoChatGet(apiKey, `/whatsapp/groups/${cleanDigits(plus)}`);
  }
  if (!r.ok) return { groups: [], error: describeError(r) };

  const groups: TwoChatGroup[] = listFrom(r.data, 'groups', 'data').map((g: any) => ({
    uuid: g.uuid || g.id || '',
    wa_group_name: g.wa_group_name || g.name || g.subject || '',
    name: g.wa_group_name || g.name || g.subject || '',
    wa_group_id: g.wa_group_id || g.group_id || g.jid || '',
    size: g.size || g.participants_count,
    wa_subject: g.wa_subject || g.description || undefined,
    wa_owner_id: g.wa_owner_id || undefined,
    _2chat_link: g._2chat_link || undefined,
  }));
  setCached(key, groups, 10 * 60 * 1000);
  return { groups };
}

export function indexGroups(groups: TwoChatGroup[]) {
  const groupsByJid = new Map<string, TwoChatGroup>();
  const groupsByUuid = new Map<string, TwoChatGroup>();
  for (const g of groups) {
    if (g.wa_group_id) groupsByJid.set(g.wa_group_id, g);
    if (g.uuid) groupsByUuid.set(g.uuid, g);
  }
  return { groupsByJid, groupsByUuid };
}

/** Recent message feed of the channel (all chats) or of one direct contact. Pages are fetched in parallel. */
export async function fetchTwoChatMessages(
  apiKey: string,
  ctx: NormalizeContext,
  remoteNumber?: string,
  pages: number[] = [0, 1, 2]
): Promise<{ messages: TwoChatMessage[]; error?: string }> {
  let path = `/whatsapp/messages/${normalizePhone(ctx.channelNumber)}`;
  if (remoteNumber) path += `/${normalizePhone(remoteNumber)}`;

  const results = await Promise.all(pages.map((p) => twoChatGet(apiKey, `${path}?page_number=${p}`)));
  const firstFail = results.find((r) => !r.ok);
  const raw = results.filter((r) => r.ok).flatMap((r) => listFrom(r.data, 'messages', 'data'));

  const messages = raw
    .map((m) => normalizeTwoChatMessage(m, ctx))
    .filter((m): m is TwoChatMessage => m !== null);

  return { messages, error: messages.length === 0 && firstFail ? describeError(firstFail) : undefined };
}

/** Full history of one group. */
export async function fetchTwoChatGroupMessages(
  apiKey: string,
  group: TwoChatGroup,
  ctx: NormalizeContext,
  pages: number[] = [0, 1, 2]
): Promise<{ messages: TwoChatMessage[]; error?: string }> {
  const results = await Promise.all(
    pages.map((p) => twoChatGet(apiKey, `/whatsapp/groups/messages/${group.uuid}?page_number=${p}`))
  );
  const firstFail = results.find((r) => !r.ok);
  const raw = results.filter((r) => r.ok).flatMap((r) => listFrom(r.data, 'messages', 'data'));

  const messages = raw
    .map((m) => normalizeTwoChatMessage(m, { ...ctx, forcedGroup: group }))
    .filter((m): m is TwoChatMessage => m !== null);

  return { messages, error: messages.length === 0 && firstFail ? describeError(firstFail) : undefined };
}

export async function sendTwoChatMessage(
  apiKey: string,
  fromNumber: string,
  target: { toNumber?: string; toGroupUuid?: string },
  text: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const payload: any = { from_number: normalizePhone(fromNumber), text };
    if (target.toGroupUuid) payload.to_group_uuid = target.toGroupUuid;
    else if (target.toNumber) payload.to_number = normalizePhone(target.toNumber);

    const res = await fetch(`${TWOCHAT_BASE_URL}/whatsapp/send-message`, {
      method: 'POST',
      headers: { 'X-User-API-Key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      return { success: false, error: body?.error_message || body?.message || body?.error || `HTTP ${res.status}` };
    }
    return { success: true, data: body };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network request failed' };
  }
}

/** Subscribe a webhook URL to a 2Chat event for a connected number. */
export async function subscribeTwoChatWebhook(
  apiKey: string,
  event: string,
  hookUrl: string,
  onNumber: string
): Promise<{ success: boolean; error?: string; data?: any }> {
  try {
    const res = await fetch(`${TWOCHAT_BASE_URL}/webhooks/subscribe/${event}`, {
      method: 'POST',
      headers: { 'X-User-API-Key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ hook_url: hookUrl, on_number: normalizePhone(onNumber) }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || body?.error) {
      return { success: false, error: body?.error_message || body?.message || `HTTP ${res.status}`, data: body };
    }
    return { success: true, data: body };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network request failed' };
  }
}
