import { NextRequest, NextResponse } from 'next/server';
import { clearStoredMessages } from '@/lib/message-store';
import { getAuthenticatedUser } from '@/lib/backend-proxy';

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized: Authentication required' }, { status: 401 });
  }
  if (!user.roles?.includes('ROLE_ADMIN')) {
    return NextResponse.json({ error: 'Forbidden: Admin access required to clear message store' }, { status: 403 });
  }

  await clearStoredMessages();
  return NextResponse.json({ success: true, message: 'Message store cleared' });
}
