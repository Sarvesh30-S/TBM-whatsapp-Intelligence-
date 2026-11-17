import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface StatusCache {
  data: any;
  timestamp: number;
}

let cachedStatus: StatusCache | null = null;
const CACHE_TTL_MS = 25 * 1000; // Cache 25 seconds to protect 2Chat quota while staying real-time

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const forceRefresh = searchParams.get('refresh') === 'true';

    // Check memory cache unless explicit refresh is requested
    const now = Date.now();
    if (!forceRefresh && cachedStatus && now - cachedStatus.timestamp < CACHE_TTL_MS) {
      return NextResponse.json(cachedStatus.data);
    }

    const apiKey = (process.env.TWOCHAT_API_KEY || '').trim();
    if (!apiKey) {
      const resp = {
        isOnline: false,
        twoChatConnected: false,
        whatsappConnected: false,
        status: 'config_error',
        title: '2Chat Not Configured',
        sub: 'Missing API key',
        tooltip: '2Chat API key is missing. Please set TWOCHAT_API_KEY in environment variables.',
        checkedAt: new Date().toISOString(),
      };
      return NextResponse.json(resp);
    }

    // Condition 1: Check whether our backend can connect to 2Chat API
    let res: Response;
    try {
      res = await fetch('https://api.p.2chat.io/open/whatsapp/get-numbers?page_number=0', {
        method: 'GET',
        headers: {
          'X-User-API-Key': apiKey,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
        signal: AbortSignal.timeout(6000), // 6-second timeout
      });
    } catch (netErr: any) {
      const resp = {
        isOnline: false,
        twoChatConnected: false,
        whatsappConnected: false,
        status: '2chat_offline',
        title: '2Chat Disconnected',
        sub: 'API unreachable',
        tooltip: `Cannot reach 2Chat gateway: ${netErr?.message || 'Network error'}`,
        checkedAt: new Date().toISOString(),
      };
      cachedStatus = { data: resp, timestamp: now };
      return NextResponse.json(resp);
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      const resp = {
        isOnline: false,
        twoChatConnected: false,
        whatsappConnected: false,
        status: '2chat_error',
        title: '2Chat Disconnected',
        sub: `HTTP ${res.status}`,
        tooltip: `2Chat API returned error HTTP ${res.status}: ${text.slice(0, 150)}`,
        checkedAt: new Date().toISOString(),
      };
      cachedStatus = { data: resp, timestamp: now };
      return NextResponse.json(resp);
    }

    const body = await res.json().catch(() => null);
    const numbers: any[] = body?.numbers || body?.channels || [];

    // Condition 2: Check whether 2Chat is connected to WhatsApp phone ('C' = Connected)
    const connectedNumber = numbers.find(
      (n: any) => (n.connection_status === 'C' || n.connection_status === 'CONNECTED') && n.enabled !== false
    );

    let resp;
    if (connectedNumber) {
      const phone = connectedNumber.phone_number || '';
      resp = {
        isOnline: true,
        twoChatConnected: true,
        whatsappConnected: true,
        status: 'connected',
        title: 'Connected to WhatsApp',
        sub: `Active • ${phone}`,
        tooltip: `WhatsApp is actively connected (${connectedNumber.friendly_name || connectedNumber.pushname || phone})`,
        phone,
        checkedAt: new Date().toISOString(),
      };
    } else {
      const firstNum = numbers[0];
      const phone = firstNum?.phone_number || '';
      const rawStatus = firstNum?.connection_status || 'Unknown';
      resp = {
        isOnline: false,
        twoChatConnected: true,
        whatsappConnected: false,
        status: 'whatsapp_disconnected',
        title: 'WhatsApp Disconnected',
        sub: '2Chat unlinked from phone',
        tooltip: `WhatsApp (${phone}) is disconnected from 2Chat (Status: ${rawStatus}). Please scan QR code in 2Chat console.`,
        phone,
        rawStatus,
        checkedAt: new Date().toISOString(),
      };
    }

    cachedStatus = { data: resp, timestamp: now };
    return NextResponse.json(resp);
  } catch (error: any) {
    console.error('Error in /api/2chat/status:', error);
    return NextResponse.json({
      isOnline: false,
      twoChatConnected: false,
      whatsappConnected: false,
      status: 'error',
      title: 'Status Check Failed',
      sub: error?.message || 'Internal error',
      tooltip: error?.message || 'Internal status check failure',
      checkedAt: new Date().toISOString(),
    });
  }
}
