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
          const targetGroup = groups.find(
            (g) => g.uuid === groupUuid || g.wa_group_id === groupUuid
          ) || {
            uuid: groupUuid,
            wa_group_name: '',
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

    // 4. Build unified conversation directory (only active conversations with messages, strictly deduplicated)
    const conversationMap = new Map<string, TwoChatConversation>();

    const groupByUuid = new Map<string, TwoChatGroup>();
    const groupByJid = new Map<string, TwoChatGroup>();
    const groupByName = new Map<string, TwoChatGroup>();
    for (const g of groups) {
      if (g.uuid) groupByUuid.set(g.uuid, g);
      if (g.wa_group_id) groupByJid.set(g.wa_group_id, g);
      if (g.wa_group_name && g.wa_group_name !== 'WhatsApp Group') {
        groupByName.set(g.wa_group_name.toLowerCase().trim(), g);
      }
    }

    // Populate and update from all stored messages
    for (const msg of allMessages) {
      if (!msg.text && !msg.mediaUrl && !msg.quotedMessage) continue;

      let convId = '';
      const isGroup = Boolean(msg.isGroup);
      let canonicalTitle = '';
      let canonicalGroupUuid = '';
      let canonicalPhoneOrId = '';

      if (isGroup) {
        // Resolve canonical group
        const matched =
          (msg.groupUuid ? groupByUuid.get(msg.groupUuid) || groupByJid.get(msg.groupUuid) : undefined) ||
          (msg.remoteNumber ? groupByJid.get(msg.remoteNumber) || groupByUuid.get(msg.remoteNumber) : undefined) ||
          (msg.groupName && msg.groupName !== 'WhatsApp Group' ? groupByName.get(msg.groupName.toLowerCase().trim()) : undefined) ||
          (msg.chatName && msg.chatName !== 'WhatsApp Group' ? groupByName.get(msg.chatName.toLowerCase().trim()) : undefined);

        canonicalGroupUuid = matched?.uuid || msg.groupUuid || 'group-unknown';
        canonicalTitle =
          matched?.wa_group_name ||
          (msg.groupName && msg.groupName !== 'WhatsApp Group' ? msg.groupName : undefined) ||
          (msg.chatName && msg.chatName !== 'WhatsApp Group' ? msg.chatName : undefined) ||
          'WhatsApp Group';

        canonicalPhoneOrId = matched?.wa_group_id || canonicalGroupUuid;
        // Group conversation key is strictly the canonical group UUID so each group appears ONLY ONCE
        convId = canonicalGroupUuid;
      } else {
        const cleanRemote = normalizePhone(msg.remoteNumber);
        if (!cleanRemote) continue;
        convId = cleanRemote;
        canonicalTitle = contactDirectory[cleanRemote] || msg.chatName || cleanRemote;
        canonicalPhoneOrId = cleanRemote;
      }

      let conv = conversationMap.get(convId);
      if (!conv) {
        conv = {
          id: convId,
          isGroup,
          name: canonicalTitle,
          phoneOrId: canonicalPhoneOrId,
          groupUuid: isGroup ? canonicalGroupUuid : undefined,
          lastMessage: msg.text || (msg.mediaUrl ? '[Media]' : ''),
          lastTimestamp: msg.timestamp,
          messageCount: 1,
        };
        conversationMap.set(convId, conv);
      } else {
        conv.messageCount += 1;
        // Never overwrite a good name with generic "WhatsApp Group"
        if (conv.name === 'WhatsApp Group' && canonicalTitle !== 'WhatsApp Group') {
          conv.name = canonicalTitle;
        }
        if (new Date(msg.timestamp).getTime() >= new Date(conv.lastTimestamp).getTime()) {
          conv.lastMessage = msg.text || (msg.mediaUrl ? '[Media]' : '');
          conv.lastTimestamp = msg.timestamp;
          if (canonicalTitle && canonicalTitle !== 'WhatsApp Group') {
            conv.name = canonicalTitle;
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

      const targetGroup =
        groupByUuid.get(chatId) ||
        groupByJid.get(chatId) ||
        (groupUuid ? groupByUuid.get(groupUuid) || groupByJid.get(groupUuid) : undefined) ||
        groupByName.get(chatId.toLowerCase().trim());

      const targetGroupUuid = targetGroup?.uuid || groupUuid || chatId;
      const targetGroupJid = targetGroup?.wa_group_id;
      const targetGroupName = targetGroup?.wa_group_name;

      threadMessages = allMessages.filter((m) => {
        if (isTargetGroup || m.isGroup) {
          if (targetGroupUuid && (m.groupUuid === targetGroupUuid || m.remoteNumber === targetGroupUuid)) return true;
          if (targetGroupJid && (m.groupUuid === targetGroupJid || m.remoteNumber === targetGroupJid)) return true;
          if (m.groupUuid === chatId || m.remoteNumber === chatId) return true;
          if (targetGroupName && m.groupName && m.groupName.toLowerCase() === targetGroupName.toLowerCase()) return true;
          if (targetGroupName && m.chatName && m.chatName.toLowerCase() === targetGroupName.toLowerCase()) return true;
          return false;
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
