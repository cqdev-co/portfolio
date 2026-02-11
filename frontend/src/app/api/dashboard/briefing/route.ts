import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const maxDuration = 120;

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'https://ollama.com/api';
const OLLAMA_API_KEY = process.env.OLLAMA_API_KEY;
const DEFAULT_MODEL = process.env.OLLAMA_MODEL || 'llama3.3:70b-cloud';

const WHITELISTED_EMAILS: string[] = (
  process.env.NEXT_PUBLIC_WHITELISTED_EMAILS || ''
)
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

// ============================================================================
// Types
// ============================================================================

interface BriefingContext {
  market: {
    indices: Array<{
      symbol: string;
      price: number;
      change: number;
      changePct: number;
    }>;
    regime: string;
    vixLevel: number;
  };
  portfolio: {
    totalValue: number;
    totalPnl: number;
    totalPnlPercent: number;
    positionsCount: number;
    spreadsCount: number;
    spreads: Array<{
      symbol: string;
      longStrike: number;
      shortStrike: number;
      netEntry: number;
      netCurrent: number;
      pnl: number;
      pnlPercent: number;
      dte: number | null;
      underlyingPrice: number;
    }>;
    standalones: Array<{
      symbol: string;
      type: string;
      quantity: number;
      entryPrice: number;
      currentPrice: number;
      pnl: number;
      pnlPercent: number;
    }>;
  };
  signals: {
    recentCount: number;
    topSignals: Array<{
      strategy: string;
      ticker: string;
      grade: string;
      score: number;
      headline: string | null;
      date: string;
    }>;
    convergence: string[]; // Tickers appearing in multiple strategies
  };
  events: Array<{
    date: string;
    title: string;
    impact: string;
  }>;
}

// ============================================================================
// Auth
// ============================================================================

async function authorizeOwner(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieStore.set(name, value, options);
              });
            } catch {
              // Read-only context
            }
          },
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();
    return WHITELISTED_EMAILS.includes(user?.email?.toLowerCase() || '');
  } catch {
    return false;
  }
}

// ============================================================================
// Prompt Builder
// ============================================================================

function buildBriefingPrompt(ctx: BriefingContext): string {
  const now = new Date();
  const estTime = now.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  // Market summary
  const spy = ctx.market.indices.find((i) => i.symbol === 'SPY');
  const vix = ctx.market.indices.find(
    (i) => i.symbol === '^VIX' || i.symbol === 'VIX'
  );
  const indicesSummary = ctx.market.indices
    .map(
      (i) =>
        `${i.symbol}: $${i.price.toFixed(2)} (${i.changePct >= 0 ? '+' : ''}${i.changePct.toFixed(2)}%)`
    )
    .join(', ');

  // Portfolio summary
  const portfolioLines: string[] = [
    `Total Value: $${ctx.portfolio.totalValue.toFixed(2)}`,
    `P&L: ${ctx.portfolio.totalPnl >= 0 ? '+' : ''}$${ctx.portfolio.totalPnl.toFixed(2)} (${ctx.portfolio.totalPnlPercent >= 0 ? '+' : ''}${ctx.portfolio.totalPnlPercent.toFixed(1)}%)`,
    `Positions: ${ctx.portfolio.positionsCount} standalone + ${ctx.portfolio.spreadsCount} spreads`,
  ];

  // Spread details
  const spreadLines = ctx.portfolio.spreads.map((s) => {
    const dteStr = s.dte !== null ? `${s.dte}d` : '?';
    return `  ${s.symbol} $${s.longStrike}/$${s.shortStrike} CDS: entry $${s.netEntry.toFixed(2)}, current $${s.netCurrent.toFixed(2)}, P&L ${s.pnl >= 0 ? '+' : ''}$${s.pnl.toFixed(0)} (${s.pnlPercent >= 0 ? '+' : ''}${s.pnlPercent.toFixed(1)}%), DTE ${dteStr}, underlying $${s.underlyingPrice.toFixed(2)}`;
  });

  // Standalone positions
  const standaloneLines = ctx.portfolio.standalones.map(
    (p) =>
      `  ${p.symbol} ${p.type}: ${p.quantity} @ $${p.entryPrice.toFixed(2)} → $${p.currentPrice.toFixed(2)}, P&L ${p.pnl >= 0 ? '+' : ''}$${p.pnl.toFixed(0)} (${p.pnlPercent >= 0 ? '+' : ''}${p.pnlPercent.toFixed(1)}%)`
  );

  // Signals
  const signalLines = ctx.signals.topSignals.map(
    (s) =>
      `  [${s.strategy.toUpperCase()}] ${s.ticker}: Grade ${s.grade}, Score ${s.score.toFixed(0)} — ${s.headline || 'No headline'} (${s.date})`
  );

  // Events
  const eventLines = ctx.events
    .slice(0, 5)
    .map((e) => `  ${e.date}: ${e.title} [${e.impact.toUpperCase()}]`);

  // Convergence
  const convergenceNote =
    ctx.signals.convergence.length > 0
      ? `Multi-strategy convergence detected: ${ctx.signals.convergence.join(', ')}`
      : 'No multi-strategy convergence today.';

  return `You are Victor, a concise hedge fund analyst. Generate a morning briefing for the fund operator.

DATE: ${estTime} EST
MARKET REGIME: ${ctx.market.regime}
VIX: ${vix?.price?.toFixed(2) || 'N/A'}
SPY: ${spy?.price?.toFixed(2) || 'N/A'} (${spy?.changePct !== undefined ? (spy.changePct >= 0 ? '+' : '') + spy.changePct.toFixed(2) + '%' : 'N/A'})
INDICES: ${indicesSummary}

PORTFOLIO:
${portfolioLines.join('\n')}

SPREADS:
${spreadLines.length > 0 ? spreadLines.join('\n') : '  (none)'}

POSITIONS:
${standaloneLines.length > 0 ? standaloneLines.join('\n') : '  (none)'}

RECENT SIGNALS (last 3 days):
${signalLines.length > 0 ? signalLines.join('\n') : '  (none)'}
${convergenceNote}

UPCOMING EVENTS:
${eventLines.length > 0 ? eventLines.join('\n') : '  (none)'}

INSTRUCTIONS:
Return a JSON object with this EXACT structure (no markdown, no code fences, just raw JSON):

{
  "briefing": "3-4 sentence morning overview covering market conditions, portfolio status, and what to watch today. Be specific about numbers. Reference regime.",
  "positionNotes": {
    "<SYMBOL>": "1-sentence annotation for this position/spread. Include actionable insight (hold, take profit, watch level, roll, etc.)"
  },
  "actionItems": [
    "Most important action to take right now",
    "Second priority action"
  ],
  "riskAlerts": [
    "Any risk warnings (expiring positions, regime shift, event risk, etc.)"
  ],
  "signalHighlights": [
    "Notable signals worth attention (mention convergence if any)"
  ]
}

Be concise, specific, and actionable. Every note should reference real numbers from the data.`;
}

// ============================================================================
// Route Handler
// ============================================================================

export async function POST(req: Request) {
  // Auth check
  const authorized = await authorizeOwner();
  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const context: BriefingContext = await req.json();

    const prompt = buildBriefingPrompt(context);

    // Call Ollama (non-streaming for structured output)
    const response = await fetch(`${OLLAMA_BASE_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(OLLAMA_API_KEY && { Authorization: `Bearer ${OLLAMA_API_KEY}` }),
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        messages: [{ role: 'user', content: prompt }],
        stream: false,
        think: false, // Disable thinking mode — forces output into content field
        options: {
          temperature: 0.3, // Low temperature for factual, concise output
          num_predict: 1024,
        },
      }),
      signal: AbortSignal.timeout(90000), // 90s timeout
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[Briefing] Ollama error:', response.status, errText);
      return NextResponse.json(
        { error: 'AI service unavailable', fallback: true },
        { status: 502 }
      );
    }

    const data = await response.json();
    // DeepSeek models often put the entire response in `message.thinking` and leave
    // `message.content` empty. Fall back to the thinking field when content is empty.
    let rawContent = data.message?.content || data.response || '';
    const thinkingContent = data.message?.thinking || '';

    if (!rawContent && thinkingContent) {
      console.log(
        '[Briefing] Content is empty, using thinking field (' +
          thinkingContent.length +
          ' chars)'
      );
      rawContent = thinkingContent;
    }

    console.log('[Briefing] Raw content length:', rawContent.length);
    console.log('[Briefing] Raw content preview:', rawContent.slice(0, 300));

    // ---- JSON extraction with multiple strategies ----
    let briefing;

    // Strategy 1: Direct parse after cleaning markdown fences & thinking tags
    try {
      let cleaned = rawContent
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim();

      // Strip closed <think>...</think> blocks
      cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

      // Strip unclosed <think> tags (model didn't close the tag — take everything
      // before the tag, plus everything after the LAST occurrence of "}" that
      // follows the tag, which should be the end of the JSON)
      if (cleaned.includes('<think>')) {
        const thinkIdx = cleaned.indexOf('<think>');
        const beforeThink = cleaned.slice(0, thinkIdx).trim();
        const afterContent = cleaned.slice(thinkIdx);
        // Find the JSON object after the think block
        const jsonInAfter = afterContent.indexOf('{');
        if (jsonInAfter !== -1) {
          cleaned = afterContent.slice(jsonInAfter);
        } else if (beforeThink) {
          cleaned = beforeThink;
        }
      }

      // If cleaned still doesn't start with {, extract JSON boundaries
      if (!cleaned.startsWith('{')) {
        const jsonStart = cleaned.indexOf('{');
        const jsonEnd = cleaned.lastIndexOf('}');
        if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
          cleaned = cleaned.slice(jsonStart, jsonEnd + 1);
        }
      }

      briefing = JSON.parse(cleaned);
      console.log('[Briefing] Strategy 1 succeeded (direct parse)');
    } catch {
      // Strategy 2: Anchor on "briefing" key and extract the enclosing JSON object
      try {
        const anchorIdx = rawContent.indexOf('"briefing"');
        if (anchorIdx === -1) throw new Error('No "briefing" key found');

        // Walk backward from "briefing" to find the opening {
        const openBrace = rawContent.lastIndexOf('{', anchorIdx);
        if (openBrace === -1) throw new Error('No opening { before "briefing"');

        // Extract from opening brace to the last } in the content
        const sub = rawContent.slice(openBrace);
        const closeBrace = sub.lastIndexOf('}');
        if (closeBrace === -1) throw new Error('No closing } found');

        const jsonStr = sub.slice(0, closeBrace + 1);
        briefing = JSON.parse(jsonStr);
        console.log(
          '[Briefing] Strategy 2 succeeded (anchor on "briefing" key)'
        );
      } catch {
        // Strategy 3: Try extracting JSON values with regex
        try {
          // Extract just the briefing string value
          const briefingMatch = rawContent.match(
            /"briefing"\s*:\s*"((?:[^"\\]|\\.)*)"/
          );
          if (!briefingMatch) throw new Error('Cannot extract briefing value');

          const briefingText = briefingMatch[1]
            .replace(/\\n/g, ' ')
            .replace(/\\"/g, '"')
            .replace(/\\\\/g, '\\');

          // Try to extract positionNotes
          const positionNotes: Record<string, string> = {};
          const notesRegex = /"(\w+)"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
          const notesBlock = rawContent.match(
            /"positionNotes"\s*:\s*\{([^}]*)\}/
          );
          if (notesBlock) {
            let m;
            while ((m = notesRegex.exec(notesBlock[1])) !== null) {
              positionNotes[m[1]] = m[2]
                .replace(/\\n/g, ' ')
                .replace(/\\"/g, '"');
            }
          }

          // Try to extract arrays
          const extractArray = (key: string): string[] => {
            const arrMatch = rawContent.match(
              new RegExp(`"${key}"\\s*:\\s*\\[([^\\]]*)\\]`)
            );
            if (!arrMatch) return [];
            const items: string[] = [];
            const itemRegex = /"((?:[^"\\]|\\.)*)"/g;
            let m;
            while ((m = itemRegex.exec(arrMatch[1])) !== null) {
              items.push(m[1].replace(/\\n/g, ' ').replace(/\\"/g, '"'));
            }
            return items;
          };

          briefing = {
            briefing: briefingText,
            positionNotes,
            actionItems: extractArray('actionItems'),
            riskAlerts: extractArray('riskAlerts'),
            signalHighlights: extractArray('signalHighlights'),
          };
          console.log(
            '[Briefing] Strategy 3 succeeded (regex value extraction)'
          );
        } catch {
          // Final fallback: if the raw content is plain text (no JSON at all),
          // use it directly as the briefing prose — this handles the case where
          // the model's thinking field contains useful analysis but no JSON
          console.warn(
            '[Briefing] All parse strategies failed. Raw content:',
            rawContent.slice(0, 500)
          );

          // Clean up the text for display
          const plainText = rawContent
            .replace(/<think>[\s\S]*?<\/think>/gi, '')
            .replace(/<think>[\s\S]*/gi, '') // unclosed think tag
            .replace(/```[\s\S]*?```/g, '') // code fences
            .trim();

          if (plainText.length > 30) {
            // The model returned useful prose, use it as the briefing
            console.log(
              '[Briefing] Using plain text response as briefing (' +
                plainText.length +
                ' chars)'
            );
            briefing = {
              briefing: plainText.slice(0, 800),
              positionNotes: {},
              actionItems: [],
              riskAlerts: [],
              signalHighlights: [],
            };
          } else {
            briefing = {
              briefing:
                'Briefing generation is temporarily unavailable — the AI model returned an unparseable response. Your live dashboard data is shown below.',
              positionNotes: {},
              actionItems: [
                'Review your positions manually using the data below',
              ],
              riskAlerts: [],
              signalHighlights: [],
            };
          }
        }
      }
    }

    return NextResponse.json({
      ...briefing,
      generated_at: new Date().toISOString(),
      model: DEFAULT_MODEL,
    });
  } catch (error) {
    console.error('[Briefing] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate briefing', fallback: true },
      { status: 500 }
    );
  }
}
