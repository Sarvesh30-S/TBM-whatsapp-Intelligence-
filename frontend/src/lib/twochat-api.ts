import { TwoChatChannel, TwoChatGroup, TwoChatMessage } from './types';

const TWOCHAT_BASE_URL = 'https://api.p.2chat.io/open';

export function normalizePhone(phone: string): string {
  if (!phone) return '';
  const digits = phone.replace(/[^0-9]/g, '');
  return digits ? `+${digits}` : phone;
}

export function extractMessageText(raw: any): string {
  if (typeof raw === 'string') return raw;
  if (!raw) return '';

  if (typeof raw.text === 'string' && raw.text.trim()) return raw.text;
  if (typeof raw.body === 'string' && raw.body.trim()) return raw.body;

  if (raw.message) {
    if (typeof raw.message === 'string') return raw.message;
    if (typeof raw.message.text === 'string' && raw.message.text.trim()) return raw.message.text;
    if (typeof raw.message.body === 'string' && raw.message.body.trim()) return raw.message.body;
    if (typeof raw.message.caption === 'string' && raw.message.caption.trim()) return raw.message.caption;
  }

  if (typeof raw.caption === 'string' && raw.caption.trim()) return raw.caption;

  const mediaUrl = raw.url || raw.media_url || raw.message?.url;
  if (mediaUrl) {
    const type = raw.type || raw.message?.type || 'Media';
    return `[${type}: ${mediaUrl}]`;
  }

  return '';
}

export function extractQuotedMessage(raw: any): string | undefined {
  if (!raw) return undefined;
  if (raw.quoted_message) {
    if (typeof raw.quoted_message === 'string') return raw.quoted_message;
    if (raw.quoted_message.text) return raw.quoted_message.text;
    if (raw.quoted_message.body) return raw.quoted_message.body;
  }
  if (raw.message?.quoted_message) {
    if (typeof raw.message.quoted_message === 'string') return raw.message.quoted_message;
    if (raw.message.quoted_message.text) return raw.message.quoted_message.text;
  }
  if (raw.context?.quoted_message) {
    if (typeof raw.context.quoted_message === 'string') return raw.context.quoted_message;
    if (raw.context.quoted_message.text) return raw.context.quoted_message.text;
  }
  return undefined;
}

export async function fetchTwoChatChannels(apiKey: string): Promise<TwoChatChannel[]> {
  try {
    const res = await fetch(`${TWOCHAT_BASE_URL}/whatsapp/channels`, {
      method: 'GET',
      headers: {
        'X-User-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
      next: { revalidate: 0 },
    });

    if (!res.ok) return [];

    const data = await res.json();
    if (data.numbers && Array.isArray(data.numbers)) {
      return data.numbers;
    }
    if (Array.isArray(data)) {
      return data;
    }
    return [];
  } catch (err) {
    console.error('Error fetching 2Chat channels:', err);
    return [];
  }
}

/**
 * Fetch contacts saved in 2Chat directory to map phone numbers to real contact names
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
    console.error('Error fetching 2Chat contacts directory:', err);
  }
  return contactMap;
}

/**
 * Fetch WhatsApp Groups for a connected number
 */
export async function fetchTwoChatGroups(apiKey: string, phoneNumber: string): Promise<TwoChatGroup[]> {
  try {
    const cleanNumber = normalizePhone(phoneNumber);
    const res = await fetch(`${TWOCHAT_BASE_URL}/whatsapp/groups/${encodeURIComponent(cleanNumber)}`, {
      method: 'GET',
      headers: {
        'X-User-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
      next: { revalidate: 0 },
    });

    if (!res.ok) return [];

    const data = await res.json();
    if (data.groups && Array.isArray(data.groups)) {
      return data.groups;
    }
    if (Array.isArray(data)) {
      return data;
    }
    return [];
  } catch (err) {
    console.error('Error fetching 2Chat groups:', err);
    return [];
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

    return (rawList as any[]).map((raw) => {
      const isOutbound =
        raw.sent_by === 'api' ||
        raw.sent_by === 'agent' ||
        raw.sent_by === 'user' ||
        raw.direction === 'outbound';

      const senderNumber = normalizePhone(
        raw.sender?.phone_number ||
        raw.remote_phone_number ||
        raw.from_number ||
        ''
      );

      const senderSavedName =
        contactDirectory[senderNumber] ||
        raw.sender?.pushname ||
        raw.sender?.name ||
        raw.pushname ||
        raw.contact?.name ||
        raw.contact?.first_name ||
        '';

      const senderDisplayName = isOutbound
        ? (channelName || 'You')
        : (senderSavedName || senderNumber || 'Unknown');

      const text = extractMessageText(raw);
      const quotedMessage = extractQuotedMessage(raw);

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
    });
  } catch (err) {
    console.error(`Error fetching messages for group ${group.uuid}:`, err);
    return [];
  }
}

/**
 * Fetch direct 1-on-1 messages
 */
export async function fetchTwoChatMessages(
  apiKey: string,
  connectedNumber: string,
  remoteNumber?: string,
  contactDirectory: Record<string, string> = {},
  channelName?: string
): Promise<TwoChatMessage[]> {
  try {
    const cleanNumber = normalizePhone(connectedNumber);
    let url = `${TWOCHAT_BASE_URL}/whatsapp/messages/${encodeURIComponent(cleanNumber)}`;
    if (remoteNumber) {
      const cleanRemote = normalizePhone(remoteNumber);
      url += `/${encodeURIComponent(cleanRemote)}`;
    }

    const res = await fetch(url, {
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

    return (rawList as any[]).map((raw) => {
      const isOutbound =
        raw.direction === 'outbound' ||
        raw.sent_by === 'api' ||
        raw.sent_by === 'agent' ||
        raw.sent_by === 'user';

      const remoteRaw =
        raw.remote_phone_number ||
        raw.to_number ||
        raw.from_number ||
        'Unknown';
      const cleanRemote = normalizePhone(remoteRaw);
      const cleanConnected = normalizePhone(raw.channel_phone_number || connectedNumber);

      const extractedRemoteName =
        contactDirectory[cleanRemote] ||
        raw.pushname ||
        raw.sender?.pushname ||
        raw.sender?.name ||
        raw.contact?.name ||
        raw.contact?.first_name ||
        (raw.contact?.last_name
          ? `${raw.contact?.first_name || ''} ${raw.contact?.last_name}`.trim()
          : undefined) ||
        '';

      const myDisplayName = channelName || 'My WhatsApp';

      const senderDisplayName = isOutbound
        ? myDisplayName
        : (extractedRemoteName || cleanRemote);

      const receiverDisplayName = isOutbound
        ? (extractedRemoteName || cleanRemote)
        : myDisplayName;

      const chatTitle = extractedRemoteName || cleanRemote;
      const text = extractMessageText(raw);
      const quotedMessage = extractQuotedMessage(raw);

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
        event: raw.event,
        mediaUrl: raw.url || raw.media_url || raw.message?.url,
      } as TwoChatMessage;
    });
  } catch (err) {
    console.error('Error fetching 2Chat messages:', err);
    return [];
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
