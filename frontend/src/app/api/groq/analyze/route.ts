import { NextRequest, NextResponse } from 'next/server';
import { loadStoredMessages } from '@/lib/message-store';
import {
  analyzeAllMessagesWithGroq,
  analyzeGroupIntelligenceWithGroq,
  getGroqConfig,
} from '@/lib/groq-client';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get('mode');
    const groupName = searchParams.get('groupName') || 'all';

    const messages = await loadStoredMessages();
    const config = getGroqConfig();

    if (mode === 'group_intelligence') {
      const briefing = await analyzeGroupIntelligenceWithGroq(groupName, messages, config);
      return NextResponse.json({
        success: true,
        data: briefing,
      });
    }

    const result = await analyzeAllMessagesWithGroq(messages, config);
    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err.message || 'Failed to analyze messages with Groq',
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    let messages = body.messages;

    if (!Array.isArray(messages) || messages.length === 0) {
      messages = await loadStoredMessages();
    }

    const config = getGroqConfig();
    const mode = body.mode;
    const groupName = body.groupName || 'all';

    if (mode === 'group_intelligence') {
      const briefing = await analyzeGroupIntelligenceWithGroq(groupName, messages, config);
      return NextResponse.json({
        success: true,
        data: briefing,
      });
    }

    const result = await analyzeAllMessagesWithGroq(messages, config);
    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err.message || 'Failed to analyze messages with Groq',
      },
      { status: 500 }
    );
  }
}
