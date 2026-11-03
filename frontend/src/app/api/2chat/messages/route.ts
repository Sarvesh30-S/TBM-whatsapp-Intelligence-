import { NextRequest, NextResponse } from 'next/server';
import { loadStoredMessages } from '@/lib/message-store';
import { fetchTwoChatChannels, fetchTwoChatMessages } from '@/lib/twochat-api';
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
    let apiMessages: TwoChatMessage[] = [];
    let activeChannel = channelParam || '';

    // 1. If we have an API Key, load channels and API messages
    if (apiKey) {
      channels = await fetchTwoChatChannels(apiKey);
      if (!activeChannel && channels.length > 0) {
        activeChannel = channels[0].phone_number;
      }

      if (activeChannel) {
        apiMessages = await fetchTwoChatMessages(apiKey, activeChannel, remoteParam || undefined);
      }
    }

    // 2. Load webhook-stored messages
    const webhookMessages = loadStoredMessages();

    // 3. Merge & Deduplicate
    const messageMap = new Map<string, TwoChatMessage>();

    for (const msg of [...webhookMessages, ...apiMessages]) {
      const key = msg.id || `${msg.remoteNumber}-${msg.timestamp}-${msg.text}`;
      if (!messageMap.has(key)) {
        messageMap.set(key, msg);
      }
    }

    let allMessages = Array.from(messageMap.values());

    // Filter by channel if activeChannel is present and message has fromNumber
    if (activeChannel) {
      allMessages = allMessages.filter(
        (m) =>
          !m.fromNumber ||
          m.fromNumber === activeChannel ||
          m.toNumber === activeChannel ||
          m.source === 'webhook' // keep webhook messages visible
      );
    }

    // Sort chronologically ascending for chat view
    allMessages.sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Group into conversations
    const conversationMap = new Map<string, TwoChatConversation>();
    for (const msg of allMessages) {
      const remote = msg.remoteNumber || 'Unknown';
      const existing = conversationMap.get(remote);
      if (!existing) {
        conversationMap.set(remote, {
          remoteNumber: remote,
          contactName: msg.contactName,
          lastMessage: msg.text,
          lastTimestamp: msg.timestamp,
          messageCount: 1,
        });
      } else {
        existing.messageCount += 1;
        if (new Date(msg.timestamp).getTime() >= new Date(existing.lastTimestamp).getTime()) {
          existing.lastMessage = msg.text;
          existing.lastTimestamp = msg.timestamp;
          if (msg.contactName && !existing.contactName) {
            existing.contactName = msg.contactName;
          }
        }
      }
    }

    const conversations = Array.from(conversationMap.values()).sort(
      (a, b) => new Date(b.lastTimestamp).getTime() - new Date(a.lastTimestamp).getTime()
    );

    // If remoteParam is given, filter messages for this specific conversation
    const displayMessages = remoteParam
      ? allMessages.filter((m) => m.remoteNumber === remoteParam)
      : allMessages;

    return NextResponse.json({
      success: true,
      apiKeyConfigured: Boolean(apiKey),
      channels,
      activeChannel,
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
