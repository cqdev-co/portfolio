import { NextResponse } from 'next/server';
import { ollama, AI_MODEL } from '@/lib/ai/ollama';
import { ASSISTANT_SYSTEM_PROMPT } from '@/lib/ai/prompts';
import { buildAssistantContext } from '@/lib/ai/context';
import { db } from '@/lib/db';
import { aiConversations } from '@/lib/db/schema';
import { v4 as uuid } from 'uuid';

export async function POST(request: Request) {
  try {
    const { message, sessionId } = await request.json();

    const context = await buildAssistantContext();

    await db.insert(aiConversations).values({
      id: uuid(),
      sessionId,
      role: 'user',
      content: message,
    });

    const response = await ollama.chat({
      model: AI_MODEL,
      messages: [
        {
          role: 'system',
          content: `${ASSISTANT_SYSTEM_PROMPT}\n\n---\n\n${context}`,
        },
        { role: 'user', content: message },
      ],
      stream: false,
    });

    const assistantMessage = response.message.content;

    await db.insert(aiConversations).values({
      id: uuid(),
      sessionId,
      role: 'assistant',
      content: assistantMessage,
    });

    return NextResponse.json({ message: assistantMessage });
  } catch (error) {
    console.error('AI chat error:', error);
    return NextResponse.json(
      {
        message:
          "Sorry, I couldn't process your request. Make sure Ollama is running locally (`ollama serve`) with the llama3.2 model pulled.",
      },
      { status: 200 }
    );
  }
}
