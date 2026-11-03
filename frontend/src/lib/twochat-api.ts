import { TwoChatChannel, TwoChatMessage } from './types';

const TWOCHAT_BASE_URL = 'https://api.p.2chat.io/open';

export function normalizePhone(phone: string): string {
  if (!phone) return '';
  const digits = phone.replace(/[^0-9]/g, '');
  return digits ? `+${digits}` : phone;
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

    if (!res.ok) {
      return [];
    }

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

    if (!res.ok) {
      return [];
    }

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

      // Extract best name for the remote party
      const extractedRemoteName =
        raw.pushname ||
        raw.sender?.pushname ||
        raw.sender?.name ||
        raw.contact?.name ||
        raw.contact?.first_name ||
        (raw.contact?.last_name
          ? `${raw.contact?.first_name || ''} ${raw.contact?.last_name}`.trim()
          : undefined) ||
        contactDirectory[cleanRemote];

      const myDisplayName = channelName || 'My WhatsApp';

      const senderName = isOutbound
        ? myDisplayName
        : (extractedRemoteName || cleanRemote);

      const receiverName = isOutbound
        ? (extractedRemoteName || cleanRemote)
        : myDisplayName;

      return {
        id: raw.id || raw.uuid || `api-${Date.now()}-${Math.random()}`,
        source: 'api',
        fromNumber: cleanConnected,
        toNumber: isOutbound ? cleanRemote : cleanConnected,
        remoteNumber: cleanRemote,
        senderName,
        receiverName,
        text:
          typeof raw.message === 'string'
            ? raw.message
            : raw.message?.text || raw.text || raw.body || '',
        sentBy: isOutbound ? 'agent' : 'customer',
        timestamp: raw.created_at || raw.timestamp || new Date().toISOString(),
        event: raw.event,
        contactName: extractedRemoteName,
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
  toNumber: string,
  text: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const res = await fetch(`${TWOCHAT_BASE_URL}/whatsapp/send-message`, {
      method: 'POST',
      headers: {
        'X-User-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from_number: normalizePhone(fromNumber),
        to_number: normalizePhone(toNumber),
        text,
      }),
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
