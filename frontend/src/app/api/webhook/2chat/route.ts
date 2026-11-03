import { NextRequest, NextResponse } from 'next/server';
import { addStoredMessage, loadStoredMessages } from '@/lib/message-store';
import { TwoChatMessage } from '@/lib/types';
import { normalizePhone } from '@/lib/twochat-api';

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
  });
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json().catch(() => null);

    if (!rawBody) {
      return NextResponse.json({ error: 'Empty payload' }, { status: 400 });
    }

    const events = Array.isArray(rawBody) ? rawBody : [rawBody];

    for (const item of events) {
      const remoteRaw =
        item.remote_phone_number ||
        item.from_number ||
        item.to_number ||
        item.session_key?.split('-')?.pop() ||
        'Unknown';
      const cleanRemote = normalizePhone(remoteRaw);

      const channelRaw =
        item.channel_phone_number ||
        item.channel?.phone_number ||
        item.from_number ||
        '';
      const cleanChannel = normalizePhone(channelRaw);

      const text =
        typeof item.message === 'string'
          ? item.message
          : item.message?.text || item.text || item.body || '';

      const isOutbound =
        item.event === 'whatsapp.message.sent' ||
        item.event === 'whatsapp.waba.message.sent' ||
        item.sent_by === 'api' ||
        item.sent_by === 'agent' ||
        item.sent_by === 'user';

      const contactName =
        item.contact?.name ||
        item.contact?.first_name ||
        item.pushname ||
        item.sender?.pushname ||
        item.sender?.name ||
        (item.contact?.last_name
          ? `${item.contact.first_name || ''} ${item.contact.last_name}`.trim()
          : undefined);

      const channelName = item.channel?.friendly_name || 'My WhatsApp';

      const senderName = isOutbound
        ? channelName
        : (contactName || cleanRemote);

      const receiverName = isOutbound
        ? (contactName || cleanRemote)
        : channelName;

      const msg: TwoChatMessage = {
        id: item.id || item.uuid || `webhook-${Date.now()}-${Math.random()}`,
        source: 'webhook',
        fromNumber: cleanChannel,
        toNumber: isOutbound ? cleanRemote : cleanChannel,
        remoteNumber: cleanRemote,
        senderName,
        receiverName,
        text,
        sentBy: isOutbound ? 'agent' : 'customer',
        timestamp: item.created_at || new Date().toISOString(),
        event: item.event,
        contactName,
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
