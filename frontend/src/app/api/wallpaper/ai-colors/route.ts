import { NextRequest, NextResponse } from 'next/server';

const WP_SERVICE_URL = process.env.WP_SERVICE_URL || 'http://localhost:8000';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const upstream = await fetch(`${WP_SERVICE_URL}/api/ai-colors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!upstream.ok) {
      const err = await upstream.text();
      return NextResponse.json({ error: err }, { status: upstream.status });
    }

    const data = await upstream.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[Wallpaper AI Colors] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate AI colors' },
      { status: 500 }
    );
  }
}
