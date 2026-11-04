import { NextResponse } from 'next/server';
import { loadStoredMessages } from '@/lib/message-store';
import { analyzeAllMessages, getJevConfig } from '@/lib/jev-client';

export async function GET() {
  try {
    const messages = await loadStoredMessages();
    const config = getJevConfig();
    const result = await analyzeAllMessages(messages, config);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err.message || 'Failed to analyze messages',
    }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    let messages = body.messages;

    if (!Array.isArray(messages) || messages.length === 0) {
      messages = await loadStoredMessages();
    }

    const config = getJevConfig();
    const result = await analyzeAllMessages(messages, config);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err.message || 'Failed to analyze messages',
    }, { status: 500 });
  }
}
