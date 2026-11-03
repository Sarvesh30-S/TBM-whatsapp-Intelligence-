import { NextRequest, NextResponse } from 'next/server';
import { sendTwoChatMessage } from '@/lib/twochat-api';
import { addStoredMessage } from '@/lib/message-store';
import { TwoChatMessage } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const apiKey = body.apiKey || process.env.TWOCHAT_API_KEY;
    const { fromNumber, toNumber, text } = body;

    if (!apiKey) {
      return NextResponse.json({ error: '2Chat API Key is required' }, { status: 400 });
    }
    if (!fromNumber || !toNumber || !text) {
      return NextResponse.json(
        { error: 'fromNumber, toNumber, and text are required' },
        { status: 400 }
      );
    }

    const result = await sendTwoChatMessage(apiKey, fromNumber, toNumber, text);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to send message via 2Chat' },
        { status: 400 }
      );
    }

    // Record sent message locally
    const sentMsg: TwoChatMessage = {
      id: result.data?.id || `sent-${Date.now()}`,
      source: 'sent',
      fromNumber,
      toNumber,
      remoteNumber: toNumber,
      text,
      sentBy: 'agent',
      timestamp: new Date().toISOString(),
    };
    addStoredMessage(sentMsg);

    return NextResponse.json({ success: true, data: result.data, message: sentMsg });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Send message error' },
      { status: 500 }
    );
  }
}
