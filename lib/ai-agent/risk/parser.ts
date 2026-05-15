/**
 * Risk-gate recommendation parser
 *
 * Phase 2: extract a `ParsedRecommendation` from Xylo's natural-language
 * response so the gate can validate it against `strategy.config.yaml`.
 *
 * Strategy: hybrid.
 *   1. Regex pass over a structured "My call:" line that the system
 *      prompt instructs Xylo to end decisive trade-call answers with.
 *      Hits ~80% of cases when the directive is followed.
 *   2. Optional small-model fallback via `resolveAI('extraction')` when
 *      the regex misses or returns partial data. Off by default to
 *      keep zero-cost the common path; callers opt-in via
 *      `enableModelFallback: true`.
 *
 * The fallback prompts the extraction model to return one strict JSON
 * line that matches `ParsedRecommendation` shape.
 */

import { resolveAI } from '@portfolio/ai-config';
import { log } from '../utils';
import type { ParsedRecommendation, ParsedSpread, TradeAction } from './types';

// ============================================================================
// REGEX PARSER
// ============================================================================

const ACTIONS: TradeAction[] = [
  'BUY',
  'WAIT',
  'AVOID',
  'HOLD',
  'TRIM',
  'EXIT',
  'ROLL',
  'ADD',
];

/**
 * Match the canonical structured line we ask Xylo to emit at the end
 * of trade-call answers, e.g.
 *
 *   My call: BUY NVDA $200/$205 CDS, 30 DTE, debit $3.10
 *   My call: AVOID TSLA
 *   My call: WAIT
 *
 * Capture groups:
 *   1: action (BUY/WAIT/AVOID/...)
 *   2: optional ticker (1-5 uppercase letters)
 *   3: optional rest-of-line (strikes, DTE, debit)
 */
const STRUCTURED_LINE = new RegExp(
  String.raw`(?:^|\n)\s*[*_]*\s*My\s+call\s*:\s*(?:[*_\s]*)` +
    String.raw`(${ACTIONS.join('|')})` +
    String.raw`(?:\s+([A-Z]{1,5}))?` +
    String.raw`([^\n]*)`,
  'i'
);

const SPREAD_STRIKES = /\$?(\d+(?:\.\d+)?)\s*\/\s*\$?(\d+(?:\.\d+)?)/;
const SPREAD_TYPE = /\b(cds|pcs|call\s*debit|put\s*credit)\b/i;
const DTE = /\b(\d+)\s*DTE\b/i;
const DEBIT = /\bdebit\s*\$?(\d+(?:\.\d+)?)/i;
const CONTRACTS = /\b(\d+)\s*contract/i;

/**
 * Pure regex parse. Returns `null` if the structured line is absent;
 * returns a partial `ParsedRecommendation` (action + ticker only) if
 * the rest-of-line couldn't be parsed.
 */
export function parseRecommendationRegex(
  text: string
): ParsedRecommendation | null {
  const m = text.match(STRUCTURED_LINE);
  if (!m) return null;

  const actionRaw = m[1].toUpperCase() as TradeAction;
  const ticker = m[2]?.toUpperCase() ?? '';
  const rest = m[3] ?? '';

  // Without a ticker the recommendation isn't risk-gateable beyond
  // the action — surface it anyway so the UI can show "WAIT" pills.
  if (!ticker) {
    return {
      ticker: '',
      action: actionRaw,
      parsed_via: 'regex',
      source_text: m[0].trim(),
    };
  }

  const spread = parseSpread(rest);

  return {
    ticker,
    action: actionRaw,
    spread,
    parsed_via: 'regex',
    source_text: m[0].trim(),
  };
}

function parseSpread(rest: string): ParsedSpread | undefined {
  const strikes = rest.match(SPREAD_STRIKES);
  if (!strikes) return undefined;
  const long = Number(strikes[1]);
  const short = Number(strikes[2]);
  if (!Number.isFinite(long) || !Number.isFinite(short)) return undefined;

  const typeMatch = rest.match(SPREAD_TYPE);
  const type: ParsedSpread['type'] =
    typeMatch && /pcs|put/i.test(typeMatch[1]) ? 'pcs' : 'cds';

  const dteMatch = rest.match(DTE);
  const debitMatch = rest.match(DEBIT);
  const contractsMatch = rest.match(CONTRACTS);

  return {
    type,
    longStrike: long,
    shortStrike: short,
    dte: dteMatch ? Number(dteMatch[1]) : undefined,
    debit: debitMatch ? Number(debitMatch[1]) : undefined,
    contracts: contractsMatch ? Number(contractsMatch[1]) : undefined,
  };
}

// ============================================================================
// MODEL FALLBACK
// ============================================================================

const EXTRACTION_PROMPT = `You are a structured extraction tool. Given a trading-analyst response, return a single line of JSON describing the final trade call.

JSON shape:
  {"ticker":"NVDA","action":"BUY|WAIT|AVOID|HOLD|TRIM|EXIT|ROLL|ADD","spread":{"type":"cds|pcs","longStrike":N,"shortStrike":N,"dte":N,"debit":N}?,"confidence_self":"HIGH|MEDIUM|LOW"?}

Rules:
- If no clear trade call is being made, return: {"action":"NONE"}
- "spread" is only present when an opening trade is recommended.
- All numeric fields must be numbers (no $, no commas, no quotes).
- Output exactly one JSON object on one line. No prose, no markdown.`;

/**
 * Last-resort extraction via the configured `extraction` workload.
 * Costs one extra Ollama call; never throws — returns null on any
 * failure so the gate falls through to "skipped".
 */
export async function parseRecommendationViaModel(
  text: string,
  options?: { abortSignal?: AbortSignal }
): Promise<ParsedRecommendation | null> {
  let cfg: ReturnType<typeof resolveAI>;
  try {
    cfg = resolveAI('extraction');
  } catch (err) {
    log.warn(`[risk parser] resolveAI('extraction') failed: ${asMessage(err)}`);
    return null;
  }

  try {
    const response = await fetch(`${cfg.baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...cfg.headers,
      },
      body: JSON.stringify({
        model: cfg.model,
        stream: false,
        messages: [
          { role: 'system', content: EXTRACTION_PROMPT },
          { role: 'user', content: text },
        ],
        options: cfg.options,
        ...(cfg.think !== undefined ? { think: cfg.think } : {}),
      }),
      signal: options?.abortSignal,
    });
    if (!response.ok) {
      log.warn(`[risk parser] extraction HTTP ${response.status}`);
      return null;
    }
    const json = (await response.json()) as {
      message?: { content?: string };
    };
    const raw = json?.message?.content?.trim();
    if (!raw) return null;
    return parseExtractionJson(raw);
  } catch (err) {
    log.warn(`[risk parser] extraction failed: ${asMessage(err)}`);
    return null;
  }
}

function parseExtractionJson(raw: string): ParsedRecommendation | null {
  // Some models still wrap their JSON in markdown fences; strip them.
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return null;
  }
  const action = String(parsed.action ?? '').toUpperCase();
  if (action === 'NONE' || !ACTIONS.includes(action as TradeAction)) {
    return null;
  }
  const ticker = String(parsed.ticker ?? '').toUpperCase();

  let spread: ParsedSpread | undefined;
  const sp = parsed.spread as Record<string, unknown> | undefined;
  if (sp && typeof sp === 'object') {
    const long = Number(sp.longStrike);
    const short = Number(sp.shortStrike);
    if (Number.isFinite(long) && Number.isFinite(short)) {
      spread = {
        type: (sp.type as 'cds' | 'pcs') === 'pcs' ? 'pcs' : 'cds',
        longStrike: long,
        shortStrike: short,
        dte: Number.isFinite(Number(sp.dte)) ? Number(sp.dte) : undefined,
        debit: Number.isFinite(Number(sp.debit)) ? Number(sp.debit) : undefined,
      };
    }
  }

  const confSelf = String(parsed.confidence_self ?? '').toUpperCase();
  return {
    ticker,
    action: action as TradeAction,
    spread,
    confidence_self:
      confSelf === 'HIGH' || confSelf === 'MEDIUM' || confSelf === 'LOW'
        ? (confSelf as 'HIGH' | 'MEDIUM' | 'LOW')
        : undefined,
    parsed_via: 'model',
  };
}

// ============================================================================
// HYBRID ENTRYPOINT
// ============================================================================

export interface ParseOptions {
  /**
   * Enable the small-model fallback when the regex pass returns null
   * or a partial parse. Defaults to false to keep the common path
   * zero-cost; the chat route can flip this on per-environment.
   */
  enableModelFallback?: boolean;
  abortSignal?: AbortSignal;
}

/**
 * Hybrid parser: regex first, model fallback when configured. Always
 * returns within bounded time and never throws.
 */
export async function parseRecommendation(
  text: string,
  options: ParseOptions = {}
): Promise<ParsedRecommendation | null> {
  const fast = parseRecommendationRegex(text);
  // We treat a regex hit as authoritative even if it's partial — if
  // there's a "My call:" line the operator's directive is being
  // followed and additional fields can stay undefined.
  if (fast) return fast;

  if (!options.enableModelFallback) {
    return null;
  }

  return parseRecommendationViaModel(text, {
    abortSignal: options.abortSignal,
  });
}

// ============================================================================
// HELPERS
// ============================================================================

function asMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
