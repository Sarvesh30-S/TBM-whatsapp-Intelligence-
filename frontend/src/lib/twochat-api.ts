import { TwoChatChannel, TwoChatMessage } from './types';

const TWOCHAT_BASE_URL = 'https://api.p.2chat.io/open';

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
      const errText = await res.text();
      console.warn(`2Chat channels fetch returned status ${res.status}: ${errText}`);
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

export async function fetchTwoChatMessages(
  apiKey: string,
  connectedNumber: string,
  remoteNumber?: string
): Promise<TwoChatMessage[]> {
  try {
    const cleanNumber = connectedNumber.startsWith('+') ? connectedNumber : `+${connectedNumber}`;
    let url = `${TWOCHAT_BASE_URL}/whatsapp/messages/${encodeURIComponent(cleanNumber)}`;
    if (remoteNumber) {
      const cleanRemote = remoteNumber.startsWith('+') ? remoteNumber : `+${remoteNumber}`;
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
      const errText = await res.text();
      console.warn(`2Chat messages fetch returned status ${res.status}: ${errText}`);
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
      const remote =
        raw.remote_phone_number ||
        raw.to_number ||
        raw.from_number ||
        'Unknown';

      return {
        id: raw.id || raw.uuid || `api-${Date.now()}-${Math.random()}`,
        source: 'api',
        fromNumber: raw.channel_phone_number || connectedNumber,
        toNumber: raw.to_number || (isOutbound ? remote : connectedNumber),
        remoteNumber: remote,
        text:
          typeof raw.message === 'string'
            ? raw.message
            : raw.message?.text || raw.text || raw.body || '',
        sentBy: isOutbound ? 'agent' : 'customer',
        timestamp: raw.created_at || raw.timestamp || new Date().toISOString(),
        event: raw.event,
        contactName:
          raw.contact?.first_name ||
          raw.contact?.name ||
          (raw.contact?.last_name
            ? `${raw.contact?.first_name || ''} ${raw.contact?.last_name}`.trim()
            : undefined),
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
        from_number: fromNumber.startsWith('+') ? fromNumber : `+${fromNumber}`,
        to_number: toNumber.startsWith('+') ? toNumber : `+${toNumber}`,
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
