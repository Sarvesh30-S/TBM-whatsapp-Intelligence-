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
        message: 'No Groq API key provided. Please enter your Groq API key first.',
      }, { status: 400 });
    }

    // Save configuration if provided
    setGroqConfig({
      apiKey: keyToUse,
      endpoint: endpointToUse,
      model: modelToUse,
    });

    // Test connection from the server
    const result = await testGroqConnection({
      apiKey: keyToUse,
      endpoint: endpointToUse,
      model: modelToUse,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      message: `Error testing Groq connection: ${err.message}`,
    }, { status: 500 });
  }
}
