import { NextResponse } from 'next/server';
import { getGroqConfig, setGroqConfig, testGroqConnection } from '@/lib/groq-client';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    let { apiKey, endpoint, model } = body;

    const currentConfig = getGroqConfig();
    const keyToUse = apiKey?.trim() || currentConfig.apiKey;
    const endpointToUse = endpoint?.trim() || currentConfig.endpoint;
    const modelToUse = model?.trim() || currentConfig.model;

    if (!keyToUse) {
      return NextResponse.json({
        success: false,
        message: 'No API key provided. Please enter your API key first.',
      }, { status: 400 });
    }

    setGroqConfig({
      apiKey: keyToUse,
      endpoint: endpointToUse,
      model: modelToUse,
    });

    const result = await testGroqConnection({
      apiKey: keyToUse,
      endpoint: endpointToUse,
      model: modelToUse,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      message: `Error testing connection: ${err.message}`,
    }, { status: 500 });
  }
}
