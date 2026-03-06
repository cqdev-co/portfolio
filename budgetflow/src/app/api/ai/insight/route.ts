import { NextResponse } from 'next/server';
import { ollama, AI_MODEL } from '@/lib/ai/ollama';
import { INSIGHT_SYSTEM_PROMPT } from '@/lib/ai/prompts';
import { buildInsightContext } from '@/lib/ai/context';

export async function POST(request: Request) {
  try {
    const { widgetType } = await request.json();

    const context = await buildInsightContext(widgetType);

    const response = await ollama.chat({
      model: AI_MODEL,
      messages: [
        { role: 'system', content: INSIGHT_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Here is the financial data:\n\n${context}\n\nProvide a brief insight about this data.`,
        },
      ],
      stream: false,
    });

    return NextResponse.json({ insight: response.message.content });
  } catch (error) {
    console.error('AI insight error:', error);
    return NextResponse.json(
      { insight: 'AI insights unavailable. Ensure Ollama is running locally.' },
      { status: 200 }
    );
  }
}
