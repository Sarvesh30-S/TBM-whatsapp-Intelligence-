import { NextRequest, NextResponse } from 'next/server';
import { sendTwoChatMessage } from '@/lib/twochat-api';
import { addStoredMessage } from '@/lib/message-store';
import { TwoChatMessage } from '@/lib/types';
import { getAuthenticatedUser } from '@/lib/backend-proxy';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized: Authentication required to send messages' },
        { status: 401 }
      );
    }

    if (user.roles?.includes('ROLE_DEVELOPER')) {
      return NextResponse.json(
        { error: 'Forbidden: Developer role is strictly prohibited from sending WhatsApp messages' },
        { status: 403 }
      );
    }

    const hasSendPermission =
      user.permissions?.includes('WHATSAPP_MESSAGE_SEND') ||
      user.roles?.includes('ROLE_ADMIN');
    if (!hasSendPermission) {
      return NextResponse.json(
        { error: 'Forbidden: You do not have permission to send WhatsApp messages' },
        { status: 403 }
      );
    }

    const body = await req.json();
    // Only ADMIN can override API key from client body; otherwise use server environment
    const isAdmin = user.roles?.includes('ROLE_ADMIN');
    const apiKey = (isAdmin && body.apiKey) ? body.apiKey : process.env.TWOCHAT_API_KEY;
    const { fromNumber, toNumber, toGroupUuid, text, groupName } = body;

    if (!apiKey) {
      return NextResponse.json({ error: '2Chat API Key is required' }, { status: 400 });
    }
    if (!fromNumber || (!toNumber && !toGroupUuid) || !text) {
      return NextResponse.json(
        { error: 'fromNumber, destination (toNumber or toGroupUuid), and text are required' },
        { status: 400 }
      );
    }

    const result = await sendTwoChatMessage(
      apiKey,
      fromNumber,
      { toNumber, toGroupUuid },
      text
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to send message via 2Chat' },
        { status: 400 }
      );
    }

    const isGroup = Boolean(toGroupUuid);
    const destinationId = toGroupUuid || toNumber;
    const chatTitle = groupName || toNumber;

    const canonicalId =
      result.data?.message?.id ||
      result.data?.uuid ||
      result.data?.id ||
      result.data?.msg_id ||
      `sent-${Date.now()}`;

    const sentMsg: TwoChatMessage = {
      id: canonicalId,
      source: 'sent',
      isGroup,
      groupUuid: toGroupUuid,
      groupName,
      chatName: chatTitle,
      senderName: 'You',
      senderNumber: fromNumber,
      receiverName: chatTitle,
      receiverNumber: destinationId,
      fromNumber,
      toNumber: destinationId,
      remoteNumber: destinationId,
      text,
      sentBy: 'agent',
      timestamp: new Date().toISOString(),
    };
    await addStoredMessage(sentMsg);

    return NextResponse.json({ success: true, data: result.data, message: sentMsg });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Send message error' },
      { status: 500 }
    );
  }
}
