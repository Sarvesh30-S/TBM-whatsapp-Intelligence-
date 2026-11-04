import { NextResponse } from 'next/server';
import { getJevConfig, setJevConfig } from '@/lib/jev-client';

export async function GET() {
  const conf = getJevConfig();
  const isConfigured = Boolean(conf.apiKey && conf.apiKey.trim().length > 0);
  const maskedKey = isConfigured
    ? `${conf.apiKey.slice(0, 4)}••••••••${conf.apiKey.slice(-4)}`
    : '';

  return NextResponse.json({
    success: true,
    isConfigured,
    endpoint: conf.endpoint,
    model: conf.model,
    maskedKey,
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { apiKey, endpoint, model } = body;

    if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
      return NextResponse.json({ error: 'Jev API key is required.' }, { status: 400 });
    }

    const updated = setJevConfig({
      apiKey: apiKey.trim(),
      endpoint: endpoint ? String(endpoint).trim() : undefined,
      model: model ? String(model).trim() : undefined,
    });

    return NextResponse.json({
      success: true,
      message: 'Jev AI configuration saved securely on server.',
      model: updated.model,
      endpoint: updated.endpoint,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to save configuration' }, { status: 500 });
  }
}
