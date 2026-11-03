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
import { TwoChatChannel, TwoChatConversation, TwoChatGroup, TwoChatMessage } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const queryKey = searchParams.get('apiKey');
    const headerKey = req.headers.get('x-user-api-key');
    const envKey = process.env.TWOCHAT_API_KEY;
    const apiKey = queryKey || headerKey || envKey || '';

    const channelParam = searchParams.get('channel');
    const chatId = searchParams.get('chatId');
    const isGroupParam = searchParams.get('isGroup') === 'true';
    const groupUuid = searchParams.get('groupUuid') || (isGroupParam ? chatId : undefined);

    let channels: TwoChatChannel[] = [];
    let groups: TwoChatGroup[] = [];
    let contactDirectory: Record<string, string> = {};
    let apiMessages: TwoChatMessage[] = [];
    let activeChannel = channelParam || '';
    let activeChannelName = 'My WhatsApp';

    // 1. Fetch channel metadata, contacts directory, and groups list
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
        // Fetch groups list and general direct messages list
        const [directMsgs, fetchedGroups] = await Promise.all([
          fetchTwoChatMessages(
            apiKey,
            activeChannel,
            undefined,
            contactDirectory,
            activeChannelName
          ),
          fetchTwoChatGroups(apiKey, activeChannel),
        ]);

        apiMessages = [...directMsgs];
        groups = fetchedGroups;

        // If a specific group is requested, fetch that group's messages immediately
        if (groupUuid) {
          const targetGroup = groups.find((g) => g.uuid === groupUuid) || {
            uuid: groupUuid,
            wa_group_name: 'WhatsApp Group',
          };
          const specificGroupMsgs = await fetchTwoChatGroupMessages(
            apiKey,
            targetGroup,
            contactDirectory,
            activeChannelName
          );
          apiMessages.push(...specificGroupMsgs);
        } else if (chatId && !isGroupParam) {
          // If a specific direct customer is requested, fetch full conversation with that customer
          const specificDirectMsgs = await fetchTwoChatMessages(
            apiKey,
            activeChannel,
            chatId,
            contactDirectory,
            activeChannelName
          );
          apiMessages.push(...specificDirectMsgs);
        } else {
          // Otherwise fetch recent messages for top 5 active groups
          const topGroups = groups.slice(0, 5);
          const groupMsgsArrays = await Promise.all(
            topGroups.map((g) =>
              fetchTwoChatGroupMessages(apiKey, g, contactDirectory, activeChannelName)
            )
          );
          for (const arr of groupMsgsArrays) {
            apiMessages.push(...arr);
          }
        }
      }
    }

    // 2. Load webhook-stored messages & enrich with contact directory
    const webhookMessages = loadStoredMessages().map((m) => {
      const cleanSender = normalizePhone(m.senderNumber || m.fromNumber);
      const cleanRemote = normalizePhone(m.remoteNumber);
      const isOutbound = m.sentBy === 'agent';

      const savedSenderName = !isOutbound
        ? (contactDirectory[cleanSender] || contactDirectory[cleanRemote] || m.senderName || cleanSender)
        : activeChannelName;

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

    // 3. Merge & Deduplicate all messages
    const messageMap = new Map<string, TwoChatMessage>();

    for (const msg of [...webhookMessages, ...apiMessages]) {
      const key = msg.id || `${msg.chatName}-${msg.senderNumber}-${msg.timestamp}-${msg.text}`;
      if (!messageMap.has(key)) {
        messageMap.set(key, msg);
      }
    }

    const allMessages = Array.from(messageMap.values()).sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // 4. Build unified conversation directory
    const conversationMap = new Map<string, TwoChatConversation>();

    // Add all groups first
    for (const grp of groups) {
      const title = grp.wa_group_name || grp.name || 'WhatsApp Group';
      conversationMap.set(grp.uuid, {
        id: grp.uuid,
        isGroup: true,
        name: title,
        phoneOrId: grp.wa_group_id || grp.uuid,
        groupUuid: grp.uuid,
        lastMessage: '',
        lastTimestamp: new Date(0).toISOString(),
        messageCount: 0,
      });
    }

    // Populate and update from messages
    for (const msg of allMessages) {
      const convId = msg.isGroup
        ? (msg.groupUuid || msg.groupName || 'unknown-group')
        : normalizePhone(msg.remoteNumber);

      if (!convId) continue;

      let conv = conversationMap.get(convId);
      if (!conv) {
        const title = msg.isGroup
          ? (msg.groupName || msg.chatName)
          : (contactDirectory[convId] || msg.chatName || convId);

        conv = {
          id: convId,
          isGroup: Boolean(msg.isGroup),
          name: title,
          phoneOrId: msg.isGroup ? (msg.groupUuid || '') : convId,
          groupUuid: msg.groupUuid,
          lastMessage: msg.text,
          lastTimestamp: msg.timestamp,
          messageCount: 1,
        };
        conversationMap.set(convId, conv);
      } else {
        conv.messageCount += 1;
        if (new Date(msg.timestamp).getTime() >= new Date(conv.lastTimestamp).getTime()) {
          conv.lastMessage = msg.text;
          conv.lastTimestamp = msg.timestamp;
          if (msg.groupName && conv.isGroup) {
            conv.name = msg.groupName;
          }
        }
      }
    }

    const conversations = Array.from(conversationMap.values()).sort(
      (a, b) => new Date(b.lastTimestamp).getTime() - new Date(a.lastTimestamp).getTime()
    );

    // 5. If chatId is specified, filter messages specifically for this conversation
    let threadMessages: TwoChatMessage[] = [];
    if (chatId) {
      threadMessages = allMessages.filter((m) => {
        if (isGroupParam || groupUuid) {
          const target = groupUuid || chatId;
          return m.groupUuid === target || m.remoteNumber === target || m.groupName === chatId;
        }
        const cleanId = normalizePhone(chatId);
        const cleanRemote = normalizePhone(m.remoteNumber);
        return cleanRemote === cleanId;
      });
    }

    return NextResponse.json({
      success: true,
      apiKeyConfigured: Boolean(apiKey),
      channels,
      activeChannel,
      groups,
      contacts: contactDirectory,
      conversations,
      messages: allMessages,
      threadMessages,
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
