import { NextRequest, NextResponse } from 'next/server';
import { sendTwoChatMessage } from '@/lib/twochat-api';
import { addStoredMessage } from '@/lib/message-store';
import { TwoChatMessage } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const apiKey = body.apiKey || process.env.TWOCHAT_API_KEY;
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

    const sentMsg: TwoChatMessage = {
      id: result.data?.id || `sent-${Date.now()}`,
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
