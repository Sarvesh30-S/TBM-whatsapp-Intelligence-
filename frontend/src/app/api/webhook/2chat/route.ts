import { NextRequest, NextResponse } from 'next/server';
import { addStoredMessages, loadStoredMessages } from '@/lib/message-store';
import { TwoChatMessage } from '@/lib/types';
import { normalizeTwoChatMessage, normalizePhone } from '@/lib/twochat-api';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const host = req.headers.get('host') || 'localhost:3000';
  const proto = req.headers.get('x-forwarded-proto') || 'http';
  const webhookUrl = `${proto}://${host}/api/webhook/2chat`;
  const stored = await loadStoredMessages();

  return NextResponse.json({
    status: 'active',
    service: '2Chat WhatsApp Webhook Receiver',
    webhookUrl,
    storedMessagesCount: stored.length,
    instructions:
      'Subscribe to whatsapp.message.received, whatsapp.message.sent, and whatsapp.group.message.received in 2Chat Webhooks.',
  });
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json().catch(() => null);

    if (!rawBody) {
      return NextResponse.json({ error: 'Empty payload' }, { status: 400 });
    }

    const events = Array.isArray(rawBody) ? rawBody : [rawBody];
    const normalizedList: TwoChatMessage[] = [];

    for (const item of events) {
      const channelNumber = normalizePhone(
        item.channel_phone_number ||
        item.channel?.phone_number ||
        item.on_number ||
        ''
      );
      const channelName = item.channel?.friendly_name || item.channel?.name || 'You';

      const msg = normalizeTwoChatMessage(item, {
        channelNumber,
        channelName,
        source: 'webhook',
      });

      if (msg) {
        normalizedList.push(msg);
      }
    }

    if (normalizedList.length > 0) {
      await addStoredMessages(normalizedList);
    }

    return NextResponse.json({
      success: true,
      receivedEvents: events.length,
      savedMessages: normalizedList.length,
    });
  } catch (error: any) {
    console.error('2Chat Webhook Error:', error);
    return NextResponse.json(
      { error: error.message || 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
