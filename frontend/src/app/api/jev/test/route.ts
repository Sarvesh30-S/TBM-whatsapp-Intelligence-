import { NextResponse } from 'next/server';
import { getJevConfig, setJevConfig, testJevConnection } from '@/lib/jev-client';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    let { apiKey, endpoint, model } = body;

    const currentConfig = getJevConfig();
    const keyToUse = apiKey?.trim() || currentConfig.apiKey;
    const endpointToUse = endpoint?.trim() || currentConfig.endpoint;
    const modelToUse = model?.trim() || currentConfig.model;

    if (!keyToUse) {
      return NextResponse.json({
        success: false,
        message: 'No Jev API key provided. Please enter your Jev API key first.',
      }, { status: 400 });
    }

    // Save configuration if provided
    setJevConfig({
      apiKey: keyToUse,
      endpoint: endpointToUse,
      model: modelToUse,
    });

    // Test connection from the server
    const result = await testJevConnection({
      apiKey: keyToUse,
      endpoint: endpointToUse,
      model: modelToUse,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      message: `Error testing Jev connection: ${err.message}`,
    }, { status: 500 });
  }
}
