import { NextRequest, NextResponse } from 'next/server';
import { loadStoredMessages } from '@/lib/message-store';
import {
  fetchTwoChatChannels,
  fetchTwoChatContacts,
  fetchTwoChatMessages,
  normalizePhone,
} from '@/lib/twochat-api';
import { TwoChatChannel, TwoChatConversation, TwoChatMessage } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const queryKey = searchParams.get('apiKey');
    const headerKey = req.headers.get('x-user-api-key');
    const envKey = process.env.TWOCHAT_API_KEY;
    const apiKey = queryKey || headerKey || envKey || '';

    const channelParam = searchParams.get('channel');
    const remoteParam = searchParams.get('remote');

    let channels: TwoChatChannel[] = [];
    let contactDirectory: Record<string, string> = {};
    let apiMessages: TwoChatMessage[] = [];
    let activeChannel = channelParam || '';
    let activeChannelName = 'My WhatsApp';

    // 1. If we have an API Key, fetch channels and contacts directory
    if (apiKey) {
      const [fetchedChannels, fetchedContacts] = await Promise.all([
        fetchTwoChatChannels(apiKey),
        fetchTwoChatContacts(apiKey),
      ]);

      channels = fetchedChannels;
      contactDirectory = fetchedContacts;

      if (!activeChannel && channels.length > 0) {
        activeChannel = channels[0].phone_number;
      }

      const activeChanObj = channels.find(
        (c) => normalizePhone(c.phone_number) === normalizePhone(activeChannel)
      );
      if (activeChanObj?.friendly_name) {
        activeChannelName = activeChanObj.friendly_name;
      }

      if (activeChannel) {
        apiMessages = await fetchTwoChatMessages(
          apiKey,
          activeChannel,
          remoteParam || undefined,
          contactDirectory,
          activeChannelName
        );
      }
    }

    // 2. Load webhook-stored messages & enrich with contact directory
    const webhookMessages = loadStoredMessages().map((m) => {
      const cleanRemote = normalizePhone(m.remoteNumber);
      const savedName = m.contactName || contactDirectory[cleanRemote];
      const isOutbound = m.sentBy === 'agent';

      return {
        ...m,
        contactName: savedName || m.contactName,
        senderName: isOutbound
          ? (m.senderName || activeChannelName)
          : (savedName || m.senderName || cleanRemote),
        receiverName: isOutbound
          ? (savedName || m.receiverName || cleanRemote)
          : (m.receiverName || activeChannelName),
      };
    });

    // 3. Merge & Deduplicate
    const messageMap = new Map<string, TwoChatMessage>();

    for (const msg of [...webhookMessages, ...apiMessages]) {
      const key = msg.id || `${msg.remoteNumber}-${msg.timestamp}-${msg.text}`;
      if (!messageMap.has(key)) {
        messageMap.set(key, msg);
      }
    }

    let allMessages = Array.from(messageMap.values());

    // Filter by channel if activeChannel is present
    if (activeChannel) {
      const cleanActive = normalizePhone(activeChannel);
      allMessages = allMessages.filter(
        (m) =>
          !m.fromNumber ||
          normalizePhone(m.fromNumber) === cleanActive ||
          normalizePhone(m.toNumber) === cleanActive ||
          m.source === 'webhook'
      );
    }

    // Group into conversations
    const conversationMap = new Map<string, TwoChatConversation>();
    for (const msg of allMessages) {
      const remote = msg.remoteNumber || 'Unknown';
      const cleanRemote = normalizePhone(remote);
      const existing = conversationMap.get(cleanRemote);
      const contactName = msg.contactName || contactDirectory[cleanRemote];

      if (!existing) {
        conversationMap.set(cleanRemote, {
          remoteNumber: cleanRemote,
          contactName: contactName,
          lastMessage: msg.text,
          lastTimestamp: msg.timestamp,
          messageCount: 1,
        });
      } else {
        existing.messageCount += 1;
        if (new Date(msg.timestamp).getTime() >= new Date(existing.lastTimestamp).getTime()) {
          existing.lastMessage = msg.text;
          existing.lastTimestamp = msg.timestamp;
          if (contactName && !existing.contactName) {
            existing.contactName = contactName;
          }
        }
      }
    }

    const conversations = Array.from(conversationMap.values()).sort(
      (a, b) => new Date(b.lastTimestamp).getTime() - new Date(a.lastTimestamp).getTime()
    );

    const displayMessages = remoteParam
      ? allMessages.filter((m) => normalizePhone(m.remoteNumber) === normalizePhone(remoteParam))
      : allMessages;

    return NextResponse.json({
      success: true,
      apiKeyConfigured: Boolean(apiKey),
      channels,
      activeChannel,
      contacts: contactDirectory,
      conversations,
      messages: displayMessages,
      webhookStoredCount: webhookMessages.length,
    });
  } catch (error: any) {
    console.error('Error in 2chat messages route:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal error' },
      { status: 500 }
    );
  }
}
