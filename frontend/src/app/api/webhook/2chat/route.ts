import { NextRequest, NextResponse } from 'next/server';
import { addStoredMessage, loadStoredMessages } from '@/lib/message-store';
import { TwoChatMessage } from '@/lib/types';
import {
  cleanDigits,
  extractJidFromSessionKey,
  extractMessageText,
  extractQuotedMessage,
  formatPhoneDisplay,
  normalizePhone,
} from '@/lib/twochat-api';

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
      const sessionKey = item.session_key || '';
      const jidFromSession = extractJidFromSessionKey(sessionKey);
      const toOrFromJid = item.to_number || item.from_number || item.remote_phone_number || '';

      const isGroupEvent =
        item.event?.includes('group') ||
        Boolean(item.group) ||
        Boolean(item.to_group_uuid) ||
        Boolean(item.participant) ||
        jidFromSession.endsWith('@g.us') ||
        toOrFromJid.includes('@g.us');

      const groupUuid =
        item.group?.uuid ||
        item.group_uuid ||
        item.to_group_uuid ||
        undefined;

      const groupJid =
        item.group?.wa_group_id ||
        item.group_jid ||
        (jidFromSession.endsWith('@g.us') ? jidFromSession : undefined) ||
        (toOrFromJid.includes('@g.us') ? toOrFromJid : undefined);

      const groupName =
        item.group?.name ||
        item.group?.wa_group_name ||
        item.group_name ||
        item.contact?.friendly_name ||
        (isGroupEvent ? 'WhatsApp Group' : undefined);

      const channelRaw =
        item.channel_phone_number ||
        item.channel?.phone_number ||
        '+917738674950';
      const cleanChannel = normalizePhone(channelRaw);
      const channelDigits = cleanDigits(cleanChannel);

      const remoteRaw =
        item.remote_phone_number ||
        item.from_number ||
        item.contact?.phone_number ||
        item.to_number ||
        '';
      const cleanRemote = normalizePhone(remoteRaw);

      const participantPhone = normalizePhone(
        item.participant?.phone_number ||
        item.sender?.phone_number ||
        (isGroupEvent ? cleanRemote : '')
      );
      const participantDigits = cleanDigits(participantPhone);

      // Check if sent by channel owner (Sarvesh)
      const isChannelOwner =
        (Boolean(participantDigits) && participantDigits === channelDigits) ||
        item.from_me === true;

      // Note: item.sent_by === 'user' means an external contact sent it (INBOUND)
      const isOutbound =
        item.event === 'whatsapp.message.sent' ||
        item.event === 'whatsapp.waba.message.sent' ||
        item.sent_by === 'api' ||
        item.sent_by === 'agent' ||
        item.direction === 'outbound' ||
        isChannelOwner;

      const participantPushname =
        item.participant?.pushname ||
        item.participant?.name ||
        item.sender?.pushname ||
        item.sender?.name ||
        item.contact?.name ||
        item.contact?.first_name ||
        item.pushname ||
        '';

      const formattedPhone = formatPhoneDisplay(participantPhone || cleanRemote);
      const channelDisplayName = item.channel?.friendly_name || 'sarvesh';

      let chatName = '';
      let senderDisplayName = '';
      let receiverDisplayName = '';

      if (isGroupEvent) {
        chatName = groupName || 'WhatsApp Group';
        if (isOutbound) {
          senderDisplayName = channelDisplayName;
        } else if (participantPushname && formattedPhone) {
          senderDisplayName = `${participantPushname} (${formattedPhone})`;
        } else if (participantPushname) {
          senderDisplayName = participantPushname;
        } else if (formattedPhone) {
          senderDisplayName = formattedPhone;
        } else {
          senderDisplayName = 'Participant';
        }
        receiverDisplayName = chatName;
      } else {
        const directName = participantPushname || formattedPhone || cleanRemote || 'Direct Chat';
        chatName = directName;
        senderDisplayName = isOutbound ? channelDisplayName : directName;
        receiverDisplayName = isOutbound ? directName : channelDisplayName;
      }

      const text = extractMessageText(item);
      const quotedMessage = extractQuotedMessage(item);

      const msg: TwoChatMessage = {
        id: item.id || item.uuid || `webhook-${Date.now()}-${Math.random()}`,
        source: 'webhook',
        isGroup: isGroupEvent,
        groupUuid: groupUuid || groupJid,
        groupName: groupName,
        chatName,
        fromNumber: isOutbound ? cleanChannel : (participantPhone || cleanRemote),
        toNumber: isOutbound ? (isGroupEvent ? (groupJid || groupUuid || '') : cleanRemote) : cleanChannel,
        remoteNumber: isGroupEvent ? (groupUuid || groupJid || '') : cleanRemote,
        senderName: senderDisplayName,
        senderNumber: isOutbound ? cleanChannel : (participantPhone || cleanRemote),
        receiverName: receiverDisplayName,
        receiverNumber: isGroupEvent ? (groupJid || groupUuid || '') : (isOutbound ? cleanRemote : cleanChannel),
        text,
        quotedMessage,
        sentBy: isOutbound ? 'agent' : 'customer',
        timestamp: item.created_at || new Date().toISOString(),
        event: item.event,
        mediaUrl: item.url || item.message?.url || item.message?.media?.url,
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
