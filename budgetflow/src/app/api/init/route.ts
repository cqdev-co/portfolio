import { NextResponse } from 'next/server';
import { initializeDatabase } from '@/lib/db/migrate';

let initialized = false;

export async function GET() {
  if (!initialized) {
    await initializeDatabase();
    initialized = true;
  }
  return NextResponse.json({ ok: true });
}
