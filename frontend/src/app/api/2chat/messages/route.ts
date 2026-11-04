import { NextRequest, NextResponse } from 'next/server';
import { addStoredMessages, loadStoredMessages } from '@/lib/message-store';
import {
  cleanDigits,
  fetchTwoChatChannels,
  fetchTwoChatContacts,
  fetchTwoChatGroups,
  fetchTwoChatGroupMessages,
  fetchTwoChatMessages,
  formatPhoneDisplay,
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
    let activeChannelName = 'sarvesh';
    const apiErrors: string[] = [];

    // 1. Fetch channel metadata, contacts directory, and groups list from 2Chat API
    if (apiKey) {
      const [channelResult, fetchedContacts] = await Promise.all([
        fetchTwoChatChannels(apiKey),
        fetchTwoChatContacts(apiKey),
      ]);

      channels = channelResult.channels;
      if (channelResult.error && !channelResult.error.includes('402')) {
        apiErrors.push(`Channels: ${channelResult.error}`);
      }
      contactDirectory = fetchedContacts;

      if (!activeChannel && channels.length > 0) {
        const connected = channels.find((c) => c.connection_status === 'C') || channels[0];
        activeChannel = connected.phone_number;
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
        if (groupResult.error && !groupResult.error.includes('402')) {
          apiErrors.push(`Groups: ${groupResult.error}`);
        }
        groups = groupResult.groups;

        // Fetch recent messages feed
        const directResult = await fetchTwoChatMessages(
          apiKey,
          activeChannel,
          undefined,
          contactDirectory,
          activeChannelName,
          groups
        );
        if (directResult.error && !directResult.error.includes('402')) {
          apiErrors.push(`Messages: ${directResult.error}`);
        }
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
        }
      }
    }

    // 2. Persist any newly fetched messages to Supabase Postgres
    if (newlyFetchedApiMessages.length > 0) {
      await addStoredMessages(newlyFetchedApiMessages);
    }

    // 3. Load all cumulative stored messages from Postgres
    const stored = await loadStoredMessages();

    // Index known groups from both API and stored Postgres records
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

    // Also populate group directory from existing stored messages in case API was rate limited
    for (const msg of stored) {
      if (msg.isGroup && msg.groupName && msg.groupName !== 'WhatsApp Group') {
        const lower = msg.groupName.toLowerCase().trim();
        if (!groupByName.has(lower)) {
          const fallbackGroup: TwoChatGroup = {
            uuid: msg.groupUuid || `group-${cleanDigits(msg.groupName)}`,
            wa_group_name: msg.groupName,
            name: msg.groupName,
            wa_group_id: msg.receiverNumber?.includes('@g.us') ? msg.receiverNumber : undefined,
          };
          groupByName.set(lower, fallbackGroup);
          if (msg.groupUuid) groupByUuid.set(msg.groupUuid, fallbackGroup);
          if (fallbackGroup.wa_group_id) groupByJid.set(fallbackGroup.wa_group_id, fallbackGroup);
        }
      }
    }

    // 4. Enrich stored messages with accurate sender names and phone formatting
    const allMessages = stored.map((m) => {
      const cleanSender = normalizePhone(m.senderNumber || m.fromNumber);
      const cleanRemote = normalizePhone(m.remoteNumber);
      const isOutbound = m.sentBy === 'agent';
      const formattedSenderPhone = formatPhoneDisplay(cleanSender);

      let resolvedSenderName = '';
      if (isOutbound) {
        resolvedSenderName = activeChannelName || 'sarvesh';
      } else if (m.isGroup) {
        // If already formatted as Name (+Phone), keep it
        if (m.senderName && m.senderName.includes('(') && m.senderName.includes(')')) {
          resolvedSenderName = m.senderName;
        } else {
          const rawName = contactDirectory[cleanSender] || m.senderName || '';
          if (rawName && formattedSenderPhone) {
            resolvedSenderName = `${rawName} (${formattedSenderPhone})`;
          } else if (rawName) {
            resolvedSenderName = rawName;
          } else if (formattedSenderPhone) {
            resolvedSenderName = formattedSenderPhone;
          } else {
            resolvedSenderName = 'Participant';
          }
        }
      } else {
        resolvedSenderName = contactDirectory[cleanRemote] || m.senderName || formattedSenderPhone || cleanRemote || 'Direct Chat';
      }

      let resolvedChatName = m.chatName;
      if (m.isGroup) {
        const matched =
          (m.groupUuid ? groupByUuid.get(m.groupUuid) || groupByJid.get(m.groupUuid) : undefined) ||
          (m.remoteNumber ? groupByJid.get(m.remoteNumber) || groupByUuid.get(m.remoteNumber) : undefined) ||
          (m.groupName && m.groupName !== 'WhatsApp Group' ? groupByName.get(m.groupName.toLowerCase().trim()) : undefined);

        if (matched?.wa_group_name) {
          resolvedChatName = matched.wa_group_name;
        }
      } else {
        resolvedChatName = contactDirectory[cleanRemote] || m.chatName || formatPhoneDisplay(cleanRemote) || cleanRemote;
      }

      return {
        ...m,
        chatName: resolvedChatName,
        senderName: resolvedSenderName,
        senderNumber: m.senderNumber || cleanSender,
        receiverName: isOutbound
          ? (m.isGroup ? resolvedChatName : (contactDirectory[cleanRemote] || m.receiverName || cleanRemote))
          : (m.groupName || activeChannelName),
      };
    });

    // 5. Build unified conversation directory (only active conversations with messages, strictly deduplicated)
    const conversationMap = new Map<string, TwoChatConversation>();

    for (const msg of allMessages) {
      if (!msg.text && !msg.mediaUrl && !msg.quotedMessage) continue;

      let convId = '';
      const isGroup = Boolean(msg.isGroup);
      let canonicalTitle = '';
      let canonicalGroupUuid = '';
      let canonicalPhoneOrId = '';
      let matchedGroup: TwoChatGroup | undefined;

      if (isGroup) {
        matchedGroup =
          (msg.groupUuid ? groupByUuid.get(msg.groupUuid) || groupByJid.get(msg.groupUuid) : undefined) ||
          (msg.remoteNumber ? groupByJid.get(msg.remoteNumber) || groupByUuid.get(msg.remoteNumber) : undefined) ||
          (msg.groupName && msg.groupName !== 'WhatsApp Group' ? groupByName.get(msg.groupName.toLowerCase().trim()) : undefined) ||
          (msg.chatName && msg.chatName !== 'WhatsApp Group' ? groupByName.get(msg.chatName.toLowerCase().trim()) : undefined);

        canonicalGroupUuid = matchedGroup?.uuid || msg.groupUuid || 'group-unknown';
        canonicalTitle =
          matchedGroup?.wa_group_name ||
          (msg.groupName && msg.groupName !== 'WhatsApp Group' ? msg.groupName : undefined) ||
          (msg.chatName && msg.chatName !== 'WhatsApp Group' ? msg.chatName : undefined) ||
          'WhatsApp Group';

        canonicalPhoneOrId = matchedGroup?.wa_group_id || canonicalGroupUuid;
        // Group conversation key is strictly the canonical group UUID so each group appears ONLY ONCE
        convId = canonicalGroupUuid;
      } else {
        const cleanRemote = normalizePhone(msg.remoteNumber);
        if (!cleanRemote) continue;
        convId = cleanRemote;
        canonicalTitle = contactDirectory[cleanRemote] || msg.chatName || formatPhoneDisplay(cleanRemote) || cleanRemote;
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
          description: matchedGroup?.wa_subject,
          size: matchedGroup?.size,
          ownerPhone: matchedGroup?.wa_owner_id,
          twoChatLink: matchedGroup?._2chat_link,
        };
        conversationMap.set(convId, conv);
      } else {
        conv.messageCount += 1;
        if (matchedGroup) {
          if (matchedGroup.wa_subject && !conv.description) conv.description = matchedGroup.wa_subject;
          if (matchedGroup.size && !conv.size) conv.size = matchedGroup.size;
          if (matchedGroup.wa_owner_id && !conv.ownerPhone) conv.ownerPhone = matchedGroup.wa_owner_id;
          if (matchedGroup._2chat_link && !conv.twoChatLink) conv.twoChatLink = matchedGroup._2chat_link;
        }

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

    // 6. If chatId is specified, filter messages specifically for this conversation
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
          if (targetGroupJid && (m.groupUuid === targetGroupJid || m.remoteNumber === targetGroupJid || m.receiverNumber === targetGroupJid || m.toNumber === targetGroupJid)) return true;
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
