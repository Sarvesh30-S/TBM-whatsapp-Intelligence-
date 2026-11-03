import { NextRequest, NextResponse } from 'next/server';
import { addStoredMessage, loadStoredMessages } from '@/lib/message-store';
import { TwoChatMessage } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const host = req.headers.get('host') || 'localhost:3000';
  const proto = req.headers.get('x-forwarded-proto') || 'http';
  const webhookUrl = `${proto}://${host}/api/webhook/2chat`;
  const stored = loadStoredMessages();

  return NextResponse.json({
    status: 'active',
    service: '2Chat WhatsApp Webhook Receiver',
    webhookUrl,
    storedMessagesCount: stored.length,
    instructions:
      'Subscribe this webhook URL in 2Chat dashboard under Webhooks for whatsapp.message.received, whatsapp.message.new, and whatsapp.message.sent.',
  });
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json().catch(() => null);

    if (!rawBody) {
      return NextResponse.json({ error: 'Empty payload' }, { status: 400 });
    }

    // 2Chat can send a single object or an array of events
    const events = Array.isArray(rawBody) ? rawBody : [rawBody];

    for (const item of events) {
      // Extract fields according to 2Chat webhook specs
      const remote =
        item.remote_phone_number ||
        item.from_number ||
        item.to_number ||
        item.session_key?.split('-')?.pop() ||
        'Unknown';

      const channel =
        item.channel_phone_number ||
        item.channel?.phone_number ||
        item.from_number ||
        '';

      const text =
        typeof item.message === 'string'
          ? item.message
          : item.message?.text || item.text || item.body || '';

      const isOutbound =
        item.event === 'whatsapp.message.sent' ||
        item.sent_by === 'api' ||
        item.sent_by === 'agent' ||
        item.sent_by === 'user';

      const contactName =
        item.contact?.first_name ||
        item.contact?.name ||
        (item.contact?.last_name
          ? `${item.contact.first_name || ''} ${item.contact.last_name}`.trim()
          : undefined);

      const msg: TwoChatMessage = {
        id: item.id || item.uuid || `webhook-${Date.now()}-${Math.random()}`,
        source: 'webhook',
        fromNumber: channel,
        toNumber: item.to_number || (isOutbound ? remote : channel),
        remoteNumber: remote,
        text: text,
        sentBy: isOutbound ? 'agent' : 'customer',
        timestamp: item.created_at || new Date().toISOString(),
        event: item.event,
        contactName: contactName,
        mediaUrl: item.url || item.message?.url,
      };

      addStoredMessage(msg);
    }

    return NextResponse.json({
      success: true,
      receivedEvents: events.length,
    });
  } catch (error: any) {
    console.error('2Chat Webhook Error:', error);
    return NextResponse.json(
      { error: error.message || 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
