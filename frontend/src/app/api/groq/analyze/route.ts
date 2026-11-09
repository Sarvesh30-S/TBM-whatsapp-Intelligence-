import { NextRequest, NextResponse } from 'next/server';
import { loadGroupHistory, loadStoredMessages } from '@/lib/message-store';
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
    const dateRange = (searchParams.get('dateRange') || 'all') as 'all' | '24h' | '7d';

    const config = getGroqConfig();

    if (mode === 'group_intelligence') {
      let dbAudit;
      let messages: any[] = [];
      if (groupName && groupName !== 'all') {
        dbAudit = await loadGroupHistory(groupName, dateRange);
        messages = dbAudit.messages;
      }
      if (!messages || messages.length === 0) {
        messages = await loadStoredMessages();
      }

      const briefing = await analyzeGroupIntelligenceWithGroq(groupName, messages, config, dbAudit);
      return NextResponse.json({
        success: true,
        data: briefing,
      });
    }

    const messages = await loadStoredMessages();
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
    const mode = body.mode;
    const groupName = body.groupName || 'all';
    const dateRange = (body.dateRange || 'all') as 'all' | '24h' | '7d';
    const config = getGroqConfig();

    if (mode === 'group_intelligence') {
      let dbAudit;
      let messages = body.messages;

      // Always load verified complete history from Postgres if group is selected
      if (groupName && groupName !== 'all') {
        dbAudit = await loadGroupHistory(groupName, dateRange);
        if (dbAudit && dbAudit.messages.length > 0) {
          messages = dbAudit.messages;
        }
      }

      if (!Array.isArray(messages) || messages.length === 0) {
        messages = await loadStoredMessages();
      }

      const briefing = await analyzeGroupIntelligenceWithGroq(groupName, messages, config, dbAudit);
      return NextResponse.json({
        success: true,
        data: briefing,
      });
    }

    let messages = body.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
      messages = await loadStoredMessages();
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
