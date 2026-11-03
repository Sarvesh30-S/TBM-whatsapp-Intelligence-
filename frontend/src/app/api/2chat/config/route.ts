import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(req: NextRequest) {
  try {
    const { apiKey } = await req.json();
    if (!apiKey) {
      return NextResponse.json({ error: 'API key is required' }, { status: 400 });
    }

    const envPath = path.resolve(process.cwd(), '.env.local');
    let content = '';
    if (fs.existsSync(envPath)) {
      content = fs.readFileSync(envPath, 'utf-8');
    }

    if (content.includes('TWOCHAT_API_KEY=')) {
      content = content.replace(/TWOCHAT_API_KEY=.*(\r?\n|$)/, `TWOCHAT_API_KEY=${apiKey.trim()}\n`);
    } else {
      content += `\nTWOCHAT_API_KEY=${apiKey.trim()}\n`;
    }

    fs.writeFileSync(envPath, content, 'utf-8');
    process.env.TWOCHAT_API_KEY = apiKey.trim();

    return NextResponse.json({ success: true, message: '2Chat API key saved to server environment' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
