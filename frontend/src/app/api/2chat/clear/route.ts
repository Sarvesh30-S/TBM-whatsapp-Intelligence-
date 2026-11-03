import { NextResponse } from 'next/server';
import { clearStoredMessages } from '@/lib/message-store';

export async function POST() {
  await clearStoredMessages();
  return NextResponse.json({ success: true, message: 'Message store cleared' });
}
