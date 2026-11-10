import { NextRequest, NextResponse } from 'next/server';
import { addStoredMessages, loadStoredMessages } from '@/lib/message-store';
import { getAuthenticatedUser } from '@/lib/backend-proxy';
import {
  cleanDigits,
  fetchTwoChatChannels,
  fetchTwoChatContacts,
  fetchTwoChatGroups,
  fetchTwoChatGroupMessages,
  fetchTwoChatMessages,
  formatPhoneDisplay,
  indexGroups,
  isGenericName,
  normalizePhone,
  NormalizeContext,
} from '@/lib/twochat-api';
import { TwoChatChannel, TwoChatConversation, TwoChatGroup, TwoChatMessage } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized: Authentication required to view messages' },
        { status: 401 }
      );
    }

    const hasReadPermission =
      user.permissions?.includes('WHATSAPP_CONTENT_READ') ||
      user.roles?.includes('ROLE_ADMIN');
    if (!hasReadPermission) {
      return NextResponse.json(
        { error: 'Forbidden: You do not have permission to access WhatsApp messages' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const isAdmin = user.roles?.includes('ROLE_ADMIN');
    const queryKey = isAdmin ? searchParams.get('apiKey') : null;
    const headerKey = isAdmin ? req.headers.get('x-user-api-key') : null;
    const envKey = process.env.TWOCHAT_API_KEY;
    const apiKey = (queryKey || headerKey || envKey || '').trim();

    const channelParam = searchParams.get('channel');
    const chatId = searchParams.get('chatId');
    const isGroupParam = searchParams.get('isGroup') === 'true';
    const groupUuid = searchParams.get('groupUuid') || (isGroupParam ? chatId : undefined);
    const shouldSync = searchParams.get('sync') === 'true';

    let channels: TwoChatChannel[] = [];
    let groups: TwoChatGroup[] = [];
    let contactDirectory: Record<string, string> = {};
    const newlyFetchedApiMessages: TwoChatMessage[] = [];
    let activeChannel = channelParam || '';
    let activeChannelName = 'You';
    const apiErrors: string[] = [];

    // 1. Fetch channel metadata, contacts directory, and groups list from 2Chat API only if explicitly requested (sync=true)
    // Default fast path: read directly from Postgres so the dashboard loads in sub-second time without external network latency
    if (apiKey && shouldSync) {
      try {
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
          // Fetch groups
          const groupResult = await fetchTwoChatGroups(apiKey, activeChannel);
          if (groupResult.error && !groupResult.error.includes('402')) {
            apiErrors.push(`Groups: ${groupResult.error}`);
          }
          groups = groupResult.groups;

          const { groupsByJid, groupsByUuid } = indexGroups(groups);
          const normCtx: NormalizeContext = {
            channelNumber: activeChannel,
            channelName: activeChannelName,
            contacts: contactDirectory,
            groupsByJid,
            groupsByUuid,
            source: 'api',
          };

          // Fetch recent messages feed (fast parallel page 0 & 1)
          const feedResult = await fetchTwoChatMessages(apiKey, normCtx, undefined, [0, 1]);
          if (feedResult.error && !feedResult.error.includes('402')) {
            apiErrors.push(`Messages: ${feedResult.error}`);
          }
          if (feedResult.messages.length > 0) {
            newlyFetchedApiMessages.push(...feedResult.messages);
          }

          // If a specific conversation was selected, fetch its history
          if (groupUuid) {
            const targetGroup =
              groupsByUuid.get(groupUuid) ||
              groupsByJid.get(groupUuid) || {
                uuid: groupUuid,
                wa_group_name: '',
              };
            const grpResult = await fetchTwoChatGroupMessages(apiKey, targetGroup, normCtx, [0, 1]);
            if (grpResult.messages.length > 0) {
              newlyFetchedApiMessages.push(...grpResult.messages);
            }
          } else if (chatId && !isGroupParam) {
            const directResult = await fetchTwoChatMessages(apiKey, normCtx, chatId, [0, 1]);
            if (directResult.messages.length > 0) {
              newlyFetchedApiMessages.push(...directResult.messages);
            }
          }
        }
      } catch (syncErr: any) {
        console.warn('2Chat API live sync timed out or failed, serving database records:', syncErr.message);
      }
    }

    // 2. Persist newly fetched messages to Supabase Postgres (fast batched upsert)
    if (newlyFetchedApiMessages.length > 0) {
      await addStoredMessages(newlyFetchedApiMessages);
    }

    // 3. Load all cumulative stored messages from Postgres
    const stored = await loadStoredMessages(activeChannel || undefined);

    // Index all groups from both API and stored Postgres records
    const groupByUuid = new Map<string, TwoChatGroup>();
    const groupByJid = new Map<string, TwoChatGroup>();
    const groupByName = new Map<string, TwoChatGroup>();

    for (const g of groups) {
      if (g.uuid) groupByUuid.set(g.uuid, g);
      if (g.wa_group_id) groupByJid.set(g.wa_group_id, g);
      if (g.wa_group_name && !isGenericName(g.wa_group_name)) {
        groupByName.set(g.wa_group_name.toLowerCase().trim(), g);
      }
    }

    for (const msg of stored) {
      if (msg.isGroup && msg.groupName && !isGenericName(msg.groupName)) {
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

    // 4. Enrich messages with contact names / phone fallback
    const allMessages = stored.map((m) => {
      const cleanSender = normalizePhone(m.senderNumber || m.fromNumber);
      const cleanRemote = normalizePhone(m.remoteNumber);
      const isOutbound = m.sentBy === 'agent';
      const formattedSenderPhone = formatPhoneDisplay(cleanSender) || cleanSender;

      let resolvedSenderName = '';
      if (isOutbound) {
        resolvedSenderName = activeChannelName || 'You';
      } else if (m.isGroup) {
        const rawName = contactDirectory[cleanSender] || m.senderName || '';
        if (rawName && !isGenericName(rawName)) {
          resolvedSenderName = rawName;
        } else {
          resolvedSenderName = formattedSenderPhone || 'Participant';
        }
      } else {
        const rawName = contactDirectory[cleanRemote] || m.senderName || '';
        resolvedSenderName = (!isGenericName(rawName) ? rawName : '') || formattedSenderPhone || 'Contact';
      }

      let resolvedChatName = m.chatName;
      if (m.isGroup) {
        const matched =
          (m.groupUuid ? groupByUuid.get(m.groupUuid) || groupByJid.get(m.groupUuid) : undefined) ||
          (m.remoteNumber ? groupByJid.get(m.remoteNumber) || groupByUuid.get(m.remoteNumber) : undefined) ||
          (m.groupName && !isGenericName(m.groupName) ? groupByName.get(m.groupName.toLowerCase().trim()) : undefined);

        if (matched?.wa_group_name) {
          resolvedChatName = matched.wa_group_name;
        }
      } else {
        const rawChat = contactDirectory[cleanRemote] || m.chatName || '';
        resolvedChatName = (!isGenericName(rawChat) ? rawChat : '') || formatPhoneDisplay(cleanRemote) || cleanRemote || 'Direct Chat';
      }

      return {
        ...m,
        chatName: resolvedChatName,
        senderName: resolvedSenderName,
        senderNumber: m.senderNumber || cleanSender,
        receiverName: isOutbound
          ? (m.isGroup ? resolvedChatName : (contactDirectory[cleanRemote] || m.receiverName || formatPhoneDisplay(cleanRemote) || cleanRemote))
          : (m.groupName || activeChannelName),
      };
    });

    // 5. Build unified conversation directory (strictly deduplicated)
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
          (msg.groupName && !isGenericName(msg.groupName) ? groupByName.get(msg.groupName.toLowerCase().trim()) : undefined) ||
          (msg.chatName && !isGenericName(msg.chatName) ? groupByName.get(msg.chatName.toLowerCase().trim()) : undefined);

        canonicalGroupUuid = matchedGroup?.uuid || msg.groupUuid || 'group-unknown';
        canonicalTitle =
          matchedGroup?.wa_group_name ||
          (msg.groupName && !isGenericName(msg.groupName) ? msg.groupName : undefined) ||
          (msg.chatName && !isGenericName(msg.chatName) ? msg.chatName : undefined) ||
          'WhatsApp Group';

        canonicalPhoneOrId = matchedGroup?.wa_group_id || canonicalGroupUuid;
        convId = canonicalGroupUuid;
      } else {
        const cleanRemote = normalizePhone(msg.remoteNumber);
        if (!cleanRemote) continue;
        convId = cleanRemote;
        const savedName = contactDirectory[cleanRemote] || (!isGenericName(msg.chatName) ? msg.chatName : '');
        canonicalTitle = savedName || formatPhoneDisplay(cleanRemote) || cleanRemote;
        canonicalPhoneOrId = formatPhoneDisplay(cleanRemote) || cleanRemote;
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

        if (isGenericName(conv.name) && !isGenericName(canonicalTitle)) {
          conv.name = canonicalTitle;
        }
        if (new Date(msg.timestamp).getTime() >= new Date(conv.lastTimestamp).getTime()) {
          conv.lastMessage = msg.text || (msg.mediaUrl ? '[Media]' : '');
          conv.lastTimestamp = msg.timestamp;
          if (!isGenericName(canonicalTitle)) {
            conv.name = canonicalTitle;
          }
        }
      }
    }

    const conversations = Array.from(conversationMap.values()).sort(
      (a, b) => new Date(b.lastTimestamp).getTime() - new Date(a.lastTimestamp).getTime()
    );

    // 6. Filter thread messages if chatId is requested
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
