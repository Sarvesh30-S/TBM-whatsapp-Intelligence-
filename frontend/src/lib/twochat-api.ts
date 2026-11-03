import { TwoChatChannel, TwoChatGroup, TwoChatMessage } from './types';

const TWOCHAT_BASE_URL = 'https://api.p.2chat.io/open';

export function normalizePhone(phone: string): string {
  if (!phone) return '';
  const digits = phone.replace(/[^0-9]/g, '');
  return digits ? `+${digits}` : phone;
}

export function cleanDigits(phone: string): string {
  if (!phone) return '';
  return phone.replace(/[^0-9]/g, '');
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
  }
  else if (typeof raw.caption === 'string' && raw.caption.trim()) text = raw.caption;
  else {
    const mediaUrl = raw.url || raw.media_url || raw.message?.url;
    if (mediaUrl) {
      const type = raw.type || raw.message?.type || 'Media';
      return `[${type}: ${mediaUrl}]`;
    }
  }

  return decodeHtmlEntities(text);
}

export function extractQuotedMessage(raw: any): string | undefined {
  if (!raw) return undefined;
  if (raw.message?.quoted_msg) {
    const q = raw.message.quoted_msg;
    if (typeof q === 'string') return decodeHtmlEntities(q);
    if (typeof q.message === 'string') return decodeHtmlEntities(q.message);
    if (typeof q.text === 'string') return decodeHtmlEntities(q.text);
    if (typeof q.body === 'string') return decodeHtmlEntities(q.body);
  }
  if (raw.quoted_msg) {
    const q = raw.quoted_msg;
    if (typeof q === 'string') return decodeHtmlEntities(q);
    if (typeof q.message === 'string') return decodeHtmlEntities(q.message);
    if (typeof q.text === 'string') return decodeHtmlEntities(q.text);
  }
  if (raw.quoted_message) {
    if (typeof raw.quoted_message === 'string') return decodeHtmlEntities(raw.quoted_message);
    if (raw.quoted_message.text) return decodeHtmlEntities(raw.quoted_message.text);
    if (raw.quoted_message.body) return decodeHtmlEntities(raw.quoted_message.body);
    if (raw.quoted_message.message) return decodeHtmlEntities(raw.quoted_message.message);
  }
  if (raw.message?.quoted_message) {
    if (typeof raw.message.quoted_message === 'string') return decodeHtmlEntities(raw.message.quoted_message);
    if (raw.message.quoted_message.text) return decodeHtmlEntities(raw.message.quoted_message.text);
    if (raw.message.quoted_message.message) return decodeHtmlEntities(raw.message.quoted_message.message);
  }
  if (raw.context?.quoted_message) {
    if (typeof raw.context.quoted_message === 'string') return decodeHtmlEntities(raw.context.quoted_message);
    if (raw.context.quoted_message.text) return decodeHtmlEntities(raw.context.quoted_message.text);
  }
  return undefined;
}

/**
 * Fetch connected WhatsApp numbers/channels
 */
export async function fetchTwoChatChannels(apiKey: string): Promise<{ channels: TwoChatChannel[]; error?: string }> {
  try {
    let res = await fetch(`${TWOCHAT_BASE_URL}/whatsapp/get-numbers?page_number=0`, {
      method: 'GET',
      headers: {
        'X-User-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      res = await fetch(`${TWOCHAT_BASE_URL}/whatsapp/channels`, {
        method: 'GET',
        headers: {
          'X-User-API-Key': apiKey,
          'Content-Type': 'application/json',
        },
        next: { revalidate: 0 },
      });
    }

    if (!res.ok) {
      const errText = await res.text();
      return { channels: [], error: `Channels HTTP ${res.status}: ${errText}` };
    }

    const data = await res.json();
    const rawList =
      data.numbers ||
      data.channels ||
      data.data ||
      (Array.isArray(data) ? data : []);

    const channels: TwoChatChannel[] = rawList.map((ch: any) => ({
      uuid: ch.uuid || ch.id || ch.channel_uuid || '',
      phone_number: ch.phone_number || ch.number || ch.from_number || '',
      friendly_name: ch.friendly_name || ch.name || ch.phone_number || '',
      connection_status: ch.connection_status,
      enabled: ch.enabled,
      channel_type: ch.channel_type,
    }));

    return { channels };
  } catch (err: any) {
    return { channels: [], error: err.message };
  }
}

/**
 * Fetch contacts saved in 2Chat directory
 */
export async function fetchTwoChatContacts(apiKey: string): Promise<Record<string, string>> {
  const contactMap: Record<string, string> = {};
  try {
    const res = await fetch(`${TWOCHAT_BASE_URL}/contacts?results_per_page=100&page_number=1`, {
      method: 'GET',
      headers: {
        'X-User-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
      next: { revalidate: 0 },
    });

    if (!res.ok) return contactMap;

    const data = await res.json();
    const contactsList = Array.isArray(data)
      ? data
      : data.contacts || data.data || [];

    for (const c of contactsList) {
      const fullName = (
        c.name ||
        `${c.first_name || ''} ${c.last_name || ''}`.trim() ||
        c.first_name ||
        ''
      ).trim();

      if (!fullName) continue;

      if (c.phone_number) {
        contactMap[normalizePhone(c.phone_number)] = fullName;
      }

      if (Array.isArray(c.contact_details)) {
        for (const detail of c.contact_details) {
          if (detail.value) {
            contactMap[normalizePhone(detail.value)] = fullName;
          }
        }
      }
    }
  } catch (err) {
    console.error('Error fetching contacts:', err);
  }
  return contactMap;
}

/**
 * Fetch WhatsApp Groups for a connected number
 */
export async function fetchTwoChatGroups(
  apiKey: string,
  phoneNumber: string,
  channelUuid?: string
): Promise<{ groups: TwoChatGroup[]; error?: string }> {
  try {
    const plusNumber = normalizePhone(phoneNumber);
    const rawDigits = cleanDigits(phoneNumber);

    // Try path with +
    let res = await fetch(`${TWOCHAT_BASE_URL}/whatsapp/groups/${plusNumber}`, {
      method: 'GET',
      headers: { 'X-User-API-Key': apiKey, 'Content-Type': 'application/json' },
      next: { revalidate: 0 },
    });

    // Fallback: try raw digits without +
    if (!res.ok && rawDigits) {
      res = await fetch(`${TWOCHAT_BASE_URL}/whatsapp/groups/${rawDigits}`, {
        method: 'GET',
        headers: { 'X-User-API-Key': apiKey, 'Content-Type': 'application/json' },
        next: { revalidate: 0 },
      });
    }

    // Fallback: try encoded +
    if (!res.ok && plusNumber) {
      res = await fetch(`${TWOCHAT_BASE_URL}/whatsapp/groups/${encodeURIComponent(plusNumber)}`, {
        method: 'GET',
        headers: { 'X-User-API-Key': apiKey, 'Content-Type': 'application/json' },
        next: { revalidate: 0 },
      });
    }

    // Fallback: try channel uuid if available
    if (!res.ok && channelUuid) {
      res = await fetch(`${TWOCHAT_BASE_URL}/whatsapp/groups/${channelUuid}`, {
        method: 'GET',
        headers: { 'X-User-API-Key': apiKey, 'Content-Type': 'application/json' },
        next: { revalidate: 0 },
      });

      if (!res.ok && channelUuid.startsWith('WW-WPN')) {
        const stripped = channelUuid.replace('WW-WPN', '');
        res = await fetch(`${TWOCHAT_BASE_URL}/whatsapp/groups/${stripped}`, {
          method: 'GET',
          headers: { 'X-User-API-Key': apiKey, 'Content-Type': 'application/json' },
          next: { revalidate: 0 },
        });
      }
    }

    if (!res.ok) {
      const errText = await res.text();
      return { groups: [], error: `Groups HTTP ${res.status}: ${errText}` };
    }

    const data = await res.json();
    const rawGroups = data.groups || data.data || (Array.isArray(data) ? data : []);

    const groups: TwoChatGroup[] = rawGroups.map((g: any) => ({
      uuid: g.uuid || g.id || g.group_uuid || '',
      wa_group_name: g.wa_group_name || g.name || g.subject || 'WhatsApp Group',
      name: g.wa_group_name || g.name || g.subject || 'WhatsApp Group',
      wa_group_id: g.wa_group_id || g.group_id || g.jid || '',
      size: g.size || g.participants_count,
    }));

    return { groups };
  } catch (err: any) {
    return { groups: [], error: err.message };
  }
}

/**
 * Fetch messages for a specific group
 */
export async function fetchTwoChatGroupMessages(
  apiKey: string,
  group: TwoChatGroup,
  contactDirectory: Record<string, string> = {},
  channelName = 'My WhatsApp'
): Promise<TwoChatMessage[]> {
  try {
    const res = await fetch(`${TWOCHAT_BASE_URL}/whatsapp/groups/messages/${group.uuid}?page_number=0`, {
      method: 'GET',
      headers: {
        'X-User-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
      next: { revalidate: 0 },
    });

    if (!res.ok) return [];

    const data = await res.json();
    const rawList = Array.isArray(data)
      ? data
      : data.messages || data.data || [];

    const groupTitle = group.wa_group_name || group.name || 'WhatsApp Group';

    return (rawList as any[])
      .map((raw) => {
        const text = extractMessageText(raw);
        const quotedMessage = extractQuotedMessage(raw);
        if (!text && !quotedMessage && !raw.url && !raw.media_url) {
          return null;
        }

        const isOutbound =
          raw.sent_by === 'api' ||
          raw.sent_by === 'agent' ||
          raw.direction === 'outbound' ||
          raw.from_me === true;

        const senderNumber = normalizePhone(
          raw.participant?.phone_number ||
          raw.sender?.phone_number ||
          raw.remote_phone_number ||
          raw.from_number ||
          ''
        );

        const senderSavedName =
          contactDirectory[senderNumber] ||
          raw.participant?.pushname ||
          raw.participant?.name ||
          raw.sender?.pushname ||
          raw.sender?.name ||
          raw.pushname ||
          raw.contact?.name ||
          raw.contact?.first_name ||
          '';

        const senderDisplayName = isOutbound
          ? (channelName || 'You')
          : (senderSavedName || senderNumber || 'Unknown');

        return {
          id: raw.id || raw.uuid || `group-msg-${Date.now()}-${Math.random()}`,
          source: 'api',
          isGroup: true,
          groupUuid: group.uuid,
          groupName: groupTitle,
          chatName: groupTitle,
          senderName: senderDisplayName,
          senderNumber: senderNumber,
          receiverName: groupTitle,
          receiverNumber: group.wa_group_id || '',
          fromNumber: senderNumber,
          toNumber: group.wa_group_id || group.uuid,
          remoteNumber: group.uuid,
          text,
          quotedMessage,
          sentBy: isOutbound ? 'agent' : 'customer',
          timestamp: raw.created_at || raw.timestamp || new Date().toISOString(),
          mediaUrl: raw.url || raw.media_url || raw.message?.url,
        } as TwoChatMessage;
      })
      .filter((m): m is TwoChatMessage => m !== null);
  } catch (err) {
    console.error(`Error fetching group ${group.uuid} messages:`, err);
    return [];
  }
}

/**
 * Fetch direct 1-on-1 messages or feed (resolving both group and direct messages)
 */
export async function fetchTwoChatMessages(
  apiKey: string,
  connectedNumber: string,
  remoteNumber?: string,
  contactDirectory: Record<string, string> = {},
  channelName?: string,
  groups: TwoChatGroup[] = []
): Promise<{ messages: TwoChatMessage[]; error?: string }> {
  try {
    const plusNumber = normalizePhone(connectedNumber);
    const rawDigits = cleanDigits(connectedNumber);

    let url = `${TWOCHAT_BASE_URL}/whatsapp/messages/${plusNumber}`;
    if (remoteNumber) {
      url += `/${normalizePhone(remoteNumber)}`;
    }

    let res = await fetch(url, {
      method: 'GET',
      headers: {
        'X-User-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
      next: { revalidate: 0 },
    });

    // Fallback without + in path
    if (!res.ok && rawDigits) {
      let fallbackUrl = `${TWOCHAT_BASE_URL}/whatsapp/messages/${rawDigits}`;
      if (remoteNumber) {
        fallbackUrl += `/${cleanDigits(remoteNumber)}`;
      }
      res = await fetch(fallbackUrl, {
        method: 'GET',
        headers: {
          'X-User-API-Key': apiKey,
          'Content-Type': 'application/json',
        },
        next: { revalidate: 0 },
      });
    }

    // Fallback using query parameter
    if (!res.ok) {
      let queryUrl = `${TWOCHAT_BASE_URL}/whatsapp/messages?from_number=${encodeURIComponent(plusNumber)}`;
      if (remoteNumber) {
        queryUrl += `&remote_phone_number=${encodeURIComponent(normalizePhone(remoteNumber))}`;
      }
      res = await fetch(queryUrl, {
        method: 'GET',
        headers: {
          'X-User-API-Key': apiKey,
          'Content-Type': 'application/json',
        },
        next: { revalidate: 0 },
      });
    }

    if (!res.ok) {
      const errText = await res.text();
      return { messages: [], error: `Messages HTTP ${res.status}: ${errText}` };
    }

    const data = await res.json();
    const rawList = Array.isArray(data)
      ? data
      : data.messages || data.data || [];

    const groupJidMap = new Map<string, TwoChatGroup>();
    for (const g of groups) {
      if (g.wa_group_id) groupJidMap.set(g.wa_group_id, g);
      if (g.uuid) groupJidMap.set(g.uuid, g);
    }

    const messages = (rawList as any[])
      .map((raw) => {
        const text = extractMessageText(raw);
        const quotedMessage = extractQuotedMessage(raw);
        if (!text && !quotedMessage && !raw.url && !raw.media_url) {
          return null;
        }

        const isOutbound =
          raw.sent_by === 'agent' ||
          raw.sent_by === 'api' ||
          raw.direction === 'outbound' ||
          raw.from_me === true;

        const sessionKey = raw.session_key || '';
        const jid = sessionKey ? sessionKey.slice(sessionKey.lastIndexOf('-') + 1) : '';
        const isGroupMsg = jid.endsWith('@g.us') || Boolean(groupJidMap.get(jid));
        const matchedGroup = isGroupMsg ? groupJidMap.get(jid) : undefined;

        if (isGroupMsg) {
          const groupTitle = matchedGroup?.wa_group_name || matchedGroup?.name || 'WhatsApp Group';
          const groupUuid = matchedGroup?.uuid || jid;
          const senderNumber = normalizePhone(
            raw.participant?.phone_number ||
            raw.sender?.phone_number ||
            raw.remote_phone_number ||
            raw.from_number ||
            ''
          );
          const senderSavedName =
            contactDirectory[senderNumber] ||
            raw.participant?.pushname ||
            raw.participant?.name ||
            raw.sender?.pushname ||
            raw.pushname ||
            '';

          const senderDisplayName = isOutbound
            ? (channelName || 'You')
            : (senderSavedName || senderNumber || 'Unknown');

          return {
            id: raw.id || raw.uuid || `group-msg-${Date.now()}-${Math.random()}`,
            source: 'api',
            isGroup: true,
            groupUuid,
            groupName: groupTitle,
            chatName: groupTitle,
            senderName: senderDisplayName,
            senderNumber,
            receiverName: groupTitle,
            receiverNumber: matchedGroup?.wa_group_id || jid,
            fromNumber: senderNumber,
            toNumber: matchedGroup?.wa_group_id || groupUuid,
            remoteNumber: groupUuid,
            text,
            quotedMessage,
            sentBy: isOutbound ? 'agent' : 'customer',
            timestamp: raw.created_at || raw.timestamp || new Date().toISOString(),
            mediaUrl: raw.url || raw.media_url || raw.message?.url,
          } as TwoChatMessage;
        }

        const directNumberFromJid = jid.endsWith('@c.us')
          ? normalizePhone(jid.replace('@c.us', ''))
          : '';

        const remoteRaw =
          directNumberFromJid ||
          raw.remote_phone_number ||
          raw.to_number ||
          raw.from_number ||
          'Unknown';
        const cleanRemote = normalizePhone(remoteRaw);
        const cleanConnected = normalizePhone(raw.channel_phone_number || connectedNumber);

        const extractedRemoteName =
          contactDirectory[cleanRemote] ||
          raw.participant?.pushname ||
          raw.pushname ||
          raw.sender?.pushname ||
          raw.sender?.name ||
          raw.contact?.friendly_name ||
          raw.contact?.name ||
          raw.contact?.first_name ||
          '';

        const myDisplayName = channelName || 'My WhatsApp';

        const senderDisplayName = isOutbound
          ? myDisplayName
          : (extractedRemoteName || cleanRemote);

        const receiverDisplayName = isOutbound
          ? (extractedRemoteName || cleanRemote)
          : myDisplayName;

        const chatTitle = extractedRemoteName || cleanRemote;

        return {
          id: raw.id || raw.uuid || `api-${Date.now()}-${Math.random()}`,
          source: 'api',
          isGroup: false,
          chatName: chatTitle,
          fromNumber: cleanConnected,
          toNumber: isOutbound ? cleanRemote : cleanConnected,
          remoteNumber: cleanRemote,
          senderName: senderDisplayName,
          senderNumber: isOutbound ? cleanConnected : cleanRemote,
          receiverName: receiverDisplayName,
          receiverNumber: isOutbound ? cleanRemote : cleanConnected,
          text,
          quotedMessage,
          sentBy: isOutbound ? 'agent' : 'customer',
          timestamp: raw.created_at || raw.timestamp || new Date().toISOString(),
          mediaUrl: raw.url || raw.media_url || raw.message?.url,
        } as TwoChatMessage;
      })
      .filter((m): m is TwoChatMessage => m !== null);

    return { messages };
  } catch (err: any) {
    return { messages: [], error: err.message };
  }
}

export async function sendTwoChatMessage(
  apiKey: string,
  fromNumber: string,
  target: { toNumber?: string; toGroupUuid?: string },
  text: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const payload: any = {
      from_number: normalizePhone(fromNumber),
      text,
    };
    if (target.toGroupUuid) {
      payload.to_group_uuid = target.toGroupUuid;
    } else if (target.toNumber) {
      payload.to_number = normalizePhone(target.toNumber);
    }

    const res = await fetch(`${TWOCHAT_BASE_URL}/whatsapp/send-message`, {
      method: 'POST',
      headers: {
        'X-User-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const body = await res.json().catch(() => null);
    if (!res.ok) {
      return {
        success: false,
        error: body?.message || body?.error || `HTTP ${res.status}`,
      };
    }
    return { success: true, data: body };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network request failed' };
  }
}
