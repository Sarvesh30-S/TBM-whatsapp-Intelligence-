import { NextRequest, NextResponse } from 'next/server';
import { loadStoredMessages } from '@/lib/message-store';
import {
  fetchTwoChatChannels,
  fetchTwoChatContacts,
  fetchTwoChatGroups,
  fetchTwoChatGroupMessages,
  fetchTwoChatMessages,
  normalizePhone,
} from '@/lib/twochat-api';
import { TwoChatChannel, TwoChatGroup, TwoChatMessage } from '@/lib/types';

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
    let groups: TwoChatGroup[] = [];
    let contactDirectory: Record<string, string> = {};
    let apiMessages: TwoChatMessage[] = [];
    let activeChannel = channelParam || '';
    let activeChannelName = 'My WhatsApp';

    // 1. If we have an API Key, fetch channels, contacts directory, and groups
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
        // Fetch direct messages and groups in parallel
        const [directMsgs, fetchedGroups] = await Promise.all([
          fetchTwoChatMessages(
            apiKey,
            activeChannel,
            remoteParam || undefined,
            contactDirectory,
            activeChannelName
          ),
          fetchTwoChatGroups(apiKey, activeChannel),
        ]);

        apiMessages = [...directMsgs];
        groups = fetchedGroups;

        // Fetch recent messages for top groups (up to 8 active groups)
        if (groups.length > 0) {
          const groupMessagePromises = groups.slice(0, 8).map((grp) =>
            fetchTwoChatGroupMessages(apiKey, grp, contactDirectory, activeChannelName)
          );
          const groupMessagesResults = await Promise.all(groupMessagePromises);
          for (const gMsgs of groupMessagesResults) {
            apiMessages.push(...gMsgs);
          }
        }
      }
    }

    // 2. Load webhook-stored messages & enrich with contact directory
    const webhookMessages = loadStoredMessages().map((m) => {
      const cleanSender = normalizePhone(m.senderNumber || m.fromNumber);
      const cleanRemote = normalizePhone(m.remoteNumber);
      const isOutbound = m.sentBy === 'agent';

      // Check contact directory for sender name
      const savedSenderName = !isOutbound
        ? (contactDirectory[cleanSender] || contactDirectory[cleanRemote] || m.senderName || cleanSender)
        : activeChannelName;

      // Check contact directory for chat name if not group
      let resolvedChatName = m.chatName;
      if (!m.isGroup) {
        resolvedChatName = contactDirectory[cleanRemote] || m.chatName || cleanRemote;
      }

      return {
        ...m,
        chatName: resolvedChatName,
        senderName: savedSenderName,
        senderNumber: m.senderNumber || cleanSender,
        receiverName: isOutbound
          ? (contactDirectory[cleanRemote] || m.receiverName || cleanRemote)
          : (m.groupName || activeChannelName),
      };
    });

    // 3. Merge & Deduplicate
    const messageMap = new Map<string, TwoChatMessage>();

    for (const msg of [...webhookMessages, ...apiMessages]) {
      const key = msg.id || `${msg.chatName}-${msg.senderNumber}-${msg.timestamp}-${msg.text}`;
      if (!messageMap.has(key)) {
        messageMap.set(key, msg);
      }
    }

    const allMessages = Array.from(messageMap.values()).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return NextResponse.json({
      success: true,
      apiKeyConfigured: Boolean(apiKey),
      channels,
      activeChannel,
      groups,
      contacts: contactDirectory,
      messages: allMessages,
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
