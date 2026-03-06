import { NextResponse } from 'next/server';
import { ollama, AI_MODEL } from '@/lib/ai/ollama';
import { WEEKLY_RECAP_PROMPT } from '@/lib/ai/prompts';
import { buildAssistantContext } from '@/lib/ai/context';
import { db } from '@/lib/db';
import { weeklyRecaps } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';

export async function POST() {
  try {
    const context = await buildAssistantContext();

    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    const response = await ollama.chat({
      model: AI_MODEL,
      messages: [
        {
          role: 'system',
          content: WEEKLY_RECAP_PROMPT,
        },
        {
          role: 'user',
          content: `Here is the user's current financial data:\n\n${context}\n\nGenerate the weekly recap for the week of ${weekStart.toLocaleDateString()} to ${weekEnd.toLocaleDateString()}.`,
        },
      ],
      stream: false,
    });

    const recap = response.message.content;

    await db.insert(weeklyRecaps).values({
      id: uuid(),
      weekStart: weekStart.toISOString().split('T')[0],
      weekEnd: weekEnd.toISOString().split('T')[0],
      content: recap,
    });

    return NextResponse.json({ recap });
  } catch (error) {
    console.error('Weekly recap error:', error);
    return NextResponse.json(
      { recap: 'Weekly recap unavailable. Ensure Ollama is running locally.' },
      { status: 200 }
    );
  }
}

export async function GET() {
  const latest = await db
    .select()
    .from(weeklyRecaps)
    .orderBy(desc(weeklyRecaps.createdAt))
    .limit(1);

  return NextResponse.json({ recap: latest[0] || null });
}
