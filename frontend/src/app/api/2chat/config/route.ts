import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getAuthenticatedUser } from '@/lib/backend-proxy';
import {
  clearTwoChatCache,
  fetchTwoChatChannels,
  subscribeTwoChatWebhook,
} from '@/lib/twochat-api';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: Authentication required' }, { status: 401 });
    }
    const isAuthorized = user.roles?.includes('ROLE_ADMIN') || user.permissions?.includes('SYSTEM_CONFIG_MANAGE');
    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required to update 2Chat configuration' },
        { status: 403 }
      );
    }

    const { apiKey, webhookUrl } = await req.json();
    if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
      return NextResponse.json({ error: 'API key is required' }, { status: 400 });
    }

    const trimmedKey = apiKey.trim();
    process.env.TWOCHAT_API_KEY = trimmedKey;
    clearTwoChatCache();

    // Persist to local .env.local if filesystem is writable (ignored on Vercel)
    try {
      const envPath = path.resolve(process.cwd(), '.env.local');
      let content = '';
      if (fs.existsSync(envPath)) {
        content = fs.readFileSync(envPath, 'utf-8');
      }
      if (content.includes('TWOCHAT_API_KEY=')) {
        content = content.replace(/TWOCHAT_API_KEY=.*(\r?\n|$)/, `TWOCHAT_API_KEY=${trimmedKey}\n`);
      } else {
        content += `\nTWOCHAT_API_KEY=${trimmedKey}\n`;
      }
      fs.writeFileSync(envPath, content, 'utf-8');
    } catch {
      // Read-only filesystem (e.g., Vercel)
    }

    // Attempt to discover channels and auto-subscribe webhooks if a public URL was provided
    let channels: any[] = [];
    const webhookResults: any[] = [];
    try {
      const channelsRes = await fetchTwoChatChannels(trimmedKey);
      channels = channelsRes.channels || [];

      const host = req.headers.get('host') || '';
      const proto = req.headers.get('x-forwarded-proto') || 'https';
      const targetHookUrl =
        (typeof webhookUrl === 'string' && webhookUrl.startsWith('http') ? webhookUrl : null) ||
        (host && !host.includes('localhost') ? `${proto}://${host}/api/webhook/2chat` : null);

      if (targetHookUrl && channels.length > 0) {
        const events = ['whatsapp.message.received', 'whatsapp.message.sent', 'whatsapp.group.message.received'];
        for (const ch of channels) {
          if (ch.phone_number) {
            for (const ev of events) {
              const res = await subscribeTwoChatWebhook(trimmedKey, ev, targetHookUrl, ch.phone_number);
              webhookResults.push({ event: ev, number: ch.phone_number, success: res.success, error: res.error });
            }
          }
        }
      }
    } catch (err: any) {
      console.warn('Channel / Webhook auto-config warning:', err?.message);
    }

    return NextResponse.json({
      success: true,
      message: '2Chat API key saved and verified',
      channels,
      webhookSubscribed: webhookResults,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
