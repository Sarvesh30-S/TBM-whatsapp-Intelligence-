import { NextRequest, NextResponse } from 'next/server';
import { addStoredMessage, loadStoredMessages } from '@/lib/message-store';
import { TwoChatMessage } from '@/lib/types';
import { extractMessageText, normalizePhone } from '@/lib/twochat-api';

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

    for (const item of events) {
      const isGroupEvent =
        item.event?.includes('group') ||
        Boolean(item.group) ||
        Boolean(item.to_group_uuid);

      const groupName =
        item.group?.name ||
        item.group?.wa_group_name ||
        item.group_name ||
        (isGroupEvent ? 'WhatsApp Group' : undefined);

      const groupUuid =
        item.group?.uuid ||
        item.to_group_uuid ||
        undefined;

      const remoteRaw =
        item.remote_phone_number ||
        item.from_number ||
        item.contact?.phone_number ||
        item.to_number ||
        '';
      const cleanRemote = normalizePhone(remoteRaw);

      const channelRaw =
        item.channel_phone_number ||
        item.channel?.phone_number ||
        item.from_number ||
        '';
      const cleanChannel = normalizePhone(channelRaw);

      const text = extractMessageText(item);

      const isOutbound =
        item.event === 'whatsapp.message.sent' ||
        item.event === 'whatsapp.waba.message.sent' ||
        item.sent_by === 'api' ||
        item.sent_by === 'agent' ||
        item.sent_by === 'user';

      const contactSavedName =
        item.contact?.name ||
        item.contact?.first_name ||
        item.pushname ||
        item.sender?.pushname ||
        item.sender?.name ||
        (item.contact?.last_name
          ? `${item.contact.first_name || ''} ${item.contact.last_name}`.trim()
          : undefined);

      const channelDisplayName = item.channel?.friendly_name || 'My WhatsApp';

      let chatName = '';
      let senderDisplayName = '';
      let receiverDisplayName = '';

      if (isGroupEvent && groupName) {
        chatName = groupName;
        senderDisplayName = isOutbound
          ? channelDisplayName
          : (contactSavedName || cleanRemote || 'Participant');
        receiverDisplayName = groupName;
      } else {
        chatName = contactSavedName || cleanRemote || 'Direct Chat';
        senderDisplayName = isOutbound
          ? channelDisplayName
          : (contactSavedName || cleanRemote || 'Sender');
        receiverDisplayName = isOutbound
          ? (contactSavedName || cleanRemote || 'Recipient')
          : channelDisplayName;
      }

      const msg: TwoChatMessage = {
        id: item.id || item.uuid || `webhook-${Date.now()}-${Math.random()}`,
        source: 'webhook',
        isGroup: isGroupEvent,
        groupUuid,
        groupName,
        chatName,
        fromNumber: cleanChannel,
        toNumber: isOutbound ? cleanRemote : cleanChannel,
        remoteNumber: cleanRemote,
        senderName: senderDisplayName,
        senderNumber: isOutbound ? cleanChannel : cleanRemote,
        receiverName: receiverDisplayName,
        receiverNumber: isOutbound ? cleanRemote : cleanChannel,
        text,
        sentBy: isOutbound ? 'agent' : 'customer',
        timestamp: item.created_at || new Date().toISOString(),
        event: item.event,
        mediaUrl: item.url || item.message?.url,
      };

      await addStoredMessage(msg);
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
