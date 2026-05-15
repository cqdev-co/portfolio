import { NextRequest, NextResponse } from 'next/server';

const WP_SERVICE_URL = process.env.WP_SERVICE_URL || 'http://localhost:8000';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const upstream = await fetch(`${WP_SERVICE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!upstream.ok) {
      const err = await upstream.text();
      return NextResponse.json({ error: err }, { status: upstream.status });
    }

    const contentType = upstream.headers.get('content-type') || 'image/png';
    const imageBuffer = await upstream.arrayBuffer();

    return new Response(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[Wallpaper API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate wallpaper' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const upstream = await fetch(`${WP_SERVICE_URL}/api/styles`);

    if (!upstream.ok) {
      return NextResponse.json(
        { error: 'wp-service unavailable' },
        { status: 502 }
      );
    }

    const data = await upstream.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      {
        styles: ['rich', 'vibrant', 'sophisticated', 'glass'],
        types: [
          'linear',
          'radial',
          'perlin',
          'fractal',
          'wave',
          'organic',
          'glass',
          'fluid',
        ],
        resolutions: [
          '4k',
          '1440p',
          '1080p',
          '720p',
          'mobile',
          'tablet',
          'ultrawide',
          'square',
          'social',
          'banner',
          'card',
        ],
      },
      { status: 200 }
    );
  }
}
