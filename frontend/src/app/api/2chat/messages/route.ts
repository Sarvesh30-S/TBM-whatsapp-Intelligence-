import { NextRequest, NextResponse } from 'next/server';
import { addStoredMessages, loadStoredMessages } from '@/lib/message-store';
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

function cleanDigits(val: string): string {
  if (!val) return '';
  return val.replace(/[^0-9]/g, '');
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const queryKey = searchParams.get('apiKey');
    const headerKey = req.headers.get('x-user-api-key');
    const envKey = process.env.TWOCHAT_API_KEY;
    const apiKey = (queryKey || headerKey || envKey || '').trim();

    const channelParam = searchParams.get('channel');
    const chatId = searchParams.get('chatId');
    const isGroupParam = searchParams.get('isGroup') === 'true';
    const groupUuid = searchParams.get('groupUuid') || (isGroupParam ? chatId : undefined);

    let channels: TwoChatChannel[] = [];
    let groups: TwoChatGroup[] = [];
    let contactDirectory: Record<string, string> = {};
    let newlyFetchedApiMessages: TwoChatMessage[] = [];
    let activeChannel = channelParam || '';
    let activeChannelName = 'My WhatsApp';
    const apiErrors: string[] = [];

    // 1. Fetch channel metadata, contacts directory, and groups list from 2Chat API
    if (apiKey) {
      const [channelResult, fetchedContacts] = await Promise.all([
        fetchTwoChatChannels(apiKey),
        fetchTwoChatContacts(apiKey),
      ]);

      channels = channelResult.channels;
      if (channelResult.error) {
        apiErrors.push(`Channels error: ${channelResult.error}`);
      }
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
        // Fetch groups list first
        const groupResult = await fetchTwoChatGroups(apiKey, activeChannel, activeChanObj?.uuid);
        if (groupResult.error) apiErrors.push(`Groups error: ${groupResult.error}`);
        groups = groupResult.groups;

        // Fetch recent messages feed with groups context so group messages in the feed are identified
        const directResult = await fetchTwoChatMessages(
          apiKey,
          activeChannel,
          undefined,
          contactDirectory,
          activeChannelName,
          groups
        );
        if (directResult.error) apiErrors.push(`Messages error: ${directResult.error}`);
        if (directResult.messages.length > 0) {
          newlyFetchedApiMessages.push(...directResult.messages);
        }

        // If a specific group is requested, fetch that group's messages
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
          if (specificGroupMsgs.length > 0) newlyFetchedApiMessages.push(...specificGroupMsgs);
        } else if (chatId && !isGroupParam) {
          // If a specific direct customer is requested, fetch full conversation
          const specificDirectResult = await fetchTwoChatMessages(
            apiKey,
            activeChannel,
            chatId,
            contactDirectory,
            activeChannelName,
            groups
          );
          if (specificDirectResult.messages.length > 0) {
            newlyFetchedApiMessages.push(...specificDirectResult.messages);
          }
        } else if (groups.length > 0) {
          // Fetch messages for top active groups (up to 10)
          const groupMsgsArrays = await Promise.all(
            groups.slice(0, 10).map((g) =>
              fetchTwoChatGroupMessages(apiKey, g, contactDirectory, activeChannelName)
            )
          );
          for (const arr of groupMsgsArrays) {
            if (arr.length > 0) newlyFetchedApiMessages.push(...arr);
          }
        }
      }
    }

    // 2. Persist any newly fetched messages to Supabase Postgres
    if (newlyFetchedApiMessages.length > 0) {
      await addStoredMessages(newlyFetchedApiMessages);
    }

    // 3. Load all cumulative stored messages from Postgres
    const stored = await loadStoredMessages();

    // Enrich stored messages with contact directory in case names were updated
    const allMessages = stored.map((m) => {
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

    // 4. Build unified conversation directory
    const conversationMap = new Map<string, TwoChatConversation>();

    // Seed known groups from 2Chat API
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

    // Populate and update from all stored messages
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
      const targetDigits = cleanDigits(chatId);
      const isTargetGroup = isGroupParam || Boolean(groupUuid);

      threadMessages = allMessages.filter((m) => {
        if (isTargetGroup || m.isGroup) {
          const matchUuid = groupUuid && m.groupUuid === groupUuid;
          const matchId = m.groupUuid === chatId || m.remoteNumber === chatId;
          const matchName = m.groupName && m.groupName.toLowerCase() === chatId.toLowerCase();
          return matchUuid || matchId || matchName;
        }

        // Direct chat match
        const msgDigits = cleanDigits(m.remoteNumber);
        if (targetDigits && msgDigits) {
          return targetDigits === msgDigits || msgDigits.endsWith(targetDigits) || targetDigits.endsWith(msgDigits);
        }
        return m.remoteNumber === chatId || m.chatName === chatId;
      });
    }

    return NextResponse.json({
      success: true,
      apiKeyConfigured: Boolean(apiKey),
      apiKey: apiKey || undefined,
      channels,
      activeChannel,
      groups,
      contacts: contactDirectory,
      conversations,
      messages: allMessages,
      threadMessages,
      webhookStoredCount: allMessages.length,
      apiErrors: apiErrors.length > 0 ? apiErrors : undefined,
    });
  } catch (error: any) {
    console.error('Error in 2chat messages route:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal error' },
      { status: 500 }
    );
  }
}
