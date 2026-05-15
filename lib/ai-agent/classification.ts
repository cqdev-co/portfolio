/**
 * Question Classification
 *
 * Smart classification of user questions to determine what context
 * and data needs to be fetched. This enables efficient context loading
 * by skipping unnecessary API calls.
 *
 * Phase 1 of the Xylo roadmap extends this with:
 * - Three new `QuestionType`s (`news_research`, `earnings_check`, `macro_event`).
 * - A `SignalRequirements` map driven by question class — the deterministic
 *   contract that `lib/ai-agent/preflight/runner.ts` consumes.
 *
 * @example
 * ```typescript
 * import { classifyQuestion } from '@lib/ai-agent/classification';
 *
 * const classification = classifyQuestion("How does NVDA look?");
 * // {
 * //   type: 'trade_analysis',
 * //   tickers: ['NVDA'],
 * //   signalRequirements: { ticker_data: true, regime: true, ... },
 * //   ...legacy needsXxx flags
 * // }
 * ```
 */

// ============================================================================
// TYPES
// ============================================================================

/**
 * Types of questions the agent can handle
 */
export type QuestionType =
  | 'price_check' // Simple price/quote questions
  | 'trade_analysis' // Full trade analysis with spreads
  | 'research' // News/why questions requiring web search
  | 'news_research' // Breaking news / "what's happening" without web search
  | 'earnings_check' // "When does X report?" / earnings-window planning
  | 'macro_event' // FOMC / CPI / geopolitical event questions
  | 'scan' // Market scanning requests
  | 'position' // Questions about existing positions
  | 'general'; // General conversation

/**
 * Discrete signals the preflight runner can fetch. Each `QuestionType`
 * maps to a `SignalRequirements` bundle via `QUESTION_CLASS_TO_SIGNALS`,
 * making the fan-out deterministic.
 */
export type SignalKey =
  | 'ticker_data'
  | 'regime'
  | 'calendar'
  | 'news'
  | 'sentiment'
  | 'earnings'
  | 'geopolitical'
  | 'sector_flow'
  | 'fundamentals';

export type SignalRequirements = Record<SignalKey, boolean>;

/**
 * Classification result with context requirements
 */
export interface QuestionClassification {
  /** The type of question */
  type: QuestionType;
  /** Extracted tickers from the question */
  tickers: string[];
  /**
   * Phase 1 deterministic signal-fetch bundle. Consumed by
   * `lib/ai-agent/preflight/runner.ts`.
   */
  signalRequirements: SignalRequirements;

  // ------------------------------------------------------------------
  // Legacy flags (kept for backward compat with existing callers like
  // `ai-analyst/src/commands/chat.ts`'s prepared-context plumbing).
  // Phase 1+ code should prefer `signalRequirements`.
  // ------------------------------------------------------------------
  /** Whether options chain data is needed */
  needsOptions: boolean;
  /** Whether news data is needed */
  needsNews: boolean;
  /** Whether web search is needed */
  needsWebSearch: boolean;
  /** Whether economic calendar is needed */
  needsCalendar: boolean;
  /** Whether trade history is needed */
  needsHistory: boolean;
}

// ============================================================================
// SIGNAL REQUIREMENT BUNDLES
// ============================================================================

/** All signals off — used as a starting point for per-class overrides. */
const NO_SIGNALS: SignalRequirements = {
  ticker_data: false,
  regime: false,
  calendar: false,
  news: false,
  sentiment: false,
  earnings: false,
  geopolitical: false,
  sector_flow: false,
  fundamentals: false,
};

/**
 * Static map: question class → required signal bundle.
 *
 * PR A wired `ticker_data`, `regime`, `calendar` only.
 * PR B flips on `news`, `sentiment`, `earnings`, `geopolitical`, and
 * `sector_flow` for the classes that benefit. `fundamentals` remains
 * off here — it's still served via the existing `get_financials_deep`
 * tool and gated to question types that explicitly ask for it.
 */
export const QUESTION_CLASS_TO_SIGNALS: Record<
  QuestionType,
  SignalRequirements
> = {
  price_check: {
    ...NO_SIGNALS,
    ticker_data: true,
  },
  trade_analysis: {
    ...NO_SIGNALS,
    ticker_data: true,
    regime: true,
    calendar: true,
    sector_flow: true,
    earnings: true,
    news: true,
    sentiment: true,
  },
  research: {
    ...NO_SIGNALS,
    ticker_data: true,
    news: true,
    sentiment: true,
  },
  news_research: {
    ...NO_SIGNALS,
    ticker_data: true,
    news: true,
    sentiment: true,
  },
  earnings_check: {
    ...NO_SIGNALS,
    ticker_data: true,
    earnings: true,
    calendar: true,
  },
  macro_event: {
    ...NO_SIGNALS,
    regime: true,
    calendar: true,
    geopolitical: true,
    sector_flow: true,
  },
  scan: {
    ...NO_SIGNALS,
    regime: true,
    calendar: true,
    sector_flow: true,
  },
  position: {
    ...NO_SIGNALS,
    ticker_data: true,
    regime: true,
    earnings: true,
  },
  general: {
    ...NO_SIGNALS,
    calendar: true,
  },
};

// ============================================================================
// TICKER EXTRACTION
// ============================================================================

/** Common words that look like tickers but aren't */
const COMMON_WORDS = new Set([
  // Articles/prepositions
  'I',
  'A',
  'THE',
  'AND',
  'OR',
  'BUT',
  'IS',
  'IT',
  'TO',
  'FOR',
  'IN',
  'ON',
  'AT',
  'BY',
  'UP',
  'IF',
  'SO',
  'NO',
  'YES',
  'OK',
  // Trading terms
  'CDS',
  'PCS',
  'ITM',
  'OTM',
  'ATM',
  'RSI',
  'MA',
  'DTE',
  'AI',
  'BUY',
  'SELL',
  'HOLD',
  'WAIT',
  'PASS',
  'NOT',
  'CAN',
  'DO',
  // Question words
  'HOW',
  'WHAT',
  'WHY',
  'WHEN',
  'WHO',
  'MY',
  'PM',
  'AM',
  // Common verbs/adjectives
  'GET',
  'SET',
  'RUN',
  'NEW',
  'OLD',
  'BIG',
  'TOP',
  'LOW',
  'MAX',
  'MIN',
  'ALL',
  'ANY',
  'HAS',
  'HAD',
  'WAS',
  'ARE',
  'BE',
  'BEEN',
  // Market terms
  'FOMC',
  'CPI',
  'GDP',
  'FED',
  'SPY',
  'QQQ',
  'VIX',
  // Directions
  'ENTER',
  'EXIT',
  'ABOVE',
  'BELOW',
  'LONG',
  'SHORT',
]);

/**
 * Extract potential ticker symbols from a message
 */
export function extractTickers(message: string): string[] {
  const matches = message.match(/\b[A-Z]{1,5}\b/g) ?? [];
  const tickers = matches.filter((t) => !COMMON_WORDS.has(t) && t.length >= 2);
  return [...new Set(tickers)];
}

// ============================================================================
// PATTERN DETECTION
// ============================================================================

/** Patterns for scan/opportunity requests */
const SCAN_PATTERNS = [
  /\b(scan|find|search|opportunities|setups|grade\s*a|best\s*stocks?)\b/i,
  /\b(what.+(?:buy|trade|look\s*at))\b/i,
  /\b(any.+opportunities)\b/i,
];

/** Patterns for research/news requests */
const RESEARCH_PATTERNS = [
  /\b(why\s+is|what.+news|research|look\s*up)\b/i,
  /\b(what.+happening|what.+going\s*on)\b/i,
  /\b(recent.+(?:news|events|announcement))\b/i,
];

/**
 * News-research patterns: breaking news / "what's the latest" framing
 * that should hit our news bundle but does NOT necessarily need web
 * search (we have native news providers post-Phase 1B).
 */
const NEWS_RESEARCH_PATTERNS = [
  /\b(latest\s+(?:on|news)|breaking|headlines?)\b/i,
  /\b(what'?s\s+(?:up|new)\s+with)\b/i,
];

/** Patterns for earnings-window questions */
const EARNINGS_PATTERNS = [
  /\b(earnings|reports?|next\s+report|earnings\s+date|reports?\s+(?:on|when))\b/i,
  /\bwhen\s+(?:does|will)\s+\w+\s+report\b/i,
];

/** Patterns for macro / geopolitical event framing */
const MACRO_EVENT_PATTERNS = [
  /\b(FOMC|fed\s+meeting|rate\s+(?:decision|hike|cut))\b/i,
  /\b(CPI|inflation\s+(?:print|data))\b/i,
  /\b(geopolitical|tariff|war|election|sanction)\b/i,
];

/** Patterns for simple price checks */
const PRICE_PATTERNS = [/\b(price|quote|how\s*much|what.+at|trading\s*at)\b/i];

/** Patterns for trade analysis */
const TRADE_ANALYSIS_PATTERNS = [
  /\b(analyze|should|entry|trade|spread|setup)\b/i,
  /\b(how\s+does.+look|looking\s*at)\b/i,
  /\b(opportunity|opportunities|good\s+(?:buy|trade))\b/i,
];

/** Patterns for existing position questions */
const POSITION_PATTERNS = [
  /\b(my\s+position|i\s+have|i\s+bought|i\s+own)\b/i,
  /\b(hold\s+or\s+sell|close\s+or\s+hold|roll)\b/i,
  /\b(profit|loss|p\/?l|value)\s+(?:on|of|for)\b/i,
  /\b(\d+\/\d+)\s*(spread|cds|call)\b/i,
];

/** Patterns that indicate full analysis is NOT needed */
const SIMPLE_PATTERNS = [/\b(just|only|quick|simply)\b/i];

/**
 * Test if message matches any pattern in a list
 */
function matchesAny(message: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(message));
}

// ============================================================================
// MAIN CLASSIFIER
// ============================================================================

/**
 * Build a `QuestionClassification` with both the new `signalRequirements`
 * field and the legacy `needsXxx` booleans populated from the same source
 * of truth.
 */
function build(
  type: QuestionType,
  tickers: string[],
  overrides: Partial<{
    needsOptions: boolean;
    needsNews: boolean;
    needsWebSearch: boolean;
    needsCalendar: boolean;
    needsHistory: boolean;
  }> = {}
): QuestionClassification {
  const signalRequirements = QUESTION_CLASS_TO_SIGNALS[type];
  // Default legacy booleans derived from the bundle. Per-call overrides
  // (e.g. `isSimple` → no options) win.
  return {
    type,
    tickers,
    signalRequirements,
    needsOptions: overrides.needsOptions ?? false,
    needsNews: overrides.needsNews ?? signalRequirements.news,
    needsWebSearch: overrides.needsWebSearch ?? false,
    needsCalendar: overrides.needsCalendar ?? signalRequirements.calendar,
    needsHistory: overrides.needsHistory ?? false,
  };
}

/**
 * Classify a user question to determine what context to load
 *
 * This enables smart context loading:
 * - Price checks: minimal data, fast response
 * - Trade analysis: full options, PFV, etc.
 * - Research: web search enabled
 * - News research: news bundle (no web search)
 * - Earnings check: earnings calendar
 * - Macro event: regime + geopolitical events
 * - Scan: run market scanner
 */
export function classifyQuestion(message: string): QuestionClassification {
  const tickers = extractTickers(message);

  // Position questions first (highest priority).
  if (matchesAny(message, POSITION_PATTERNS)) {
    return build('position', tickers, {
      needsOptions: false,
      needsHistory: true,
    });
  }

  // Scan requests - no specific ticker.
  if (matchesAny(message, SCAN_PATTERNS) && tickers.length === 0) {
    return build('scan', tickers, {
      needsOptions: true,
      needsCalendar: true,
    });
  }

  // Earnings-window questions ("when does NVDA report?").
  if (matchesAny(message, EARNINGS_PATTERNS)) {
    return build('earnings_check', tickers, { needsCalendar: true });
  }

  // Macro / geopolitical events ("what's the FOMC impact?").
  if (matchesAny(message, MACRO_EVENT_PATTERNS)) {
    return build('macro_event', tickers, { needsCalendar: true });
  }

  // News research without web search ("latest on AAPL").
  if (matchesAny(message, NEWS_RESEARCH_PATTERNS)) {
    return build('news_research', tickers, { needsNews: true });
  }

  // Web-research questions ("why is X moving?").
  if (matchesAny(message, RESEARCH_PATTERNS)) {
    return build('research', tickers, {
      needsNews: true,
      needsWebSearch: true,
    });
  }

  const isPriceCheck = matchesAny(message, PRICE_PATTERNS);
  const isSimple = matchesAny(message, SIMPLE_PATTERNS);
  const isTradeAnalysis = matchesAny(message, TRADE_ANALYSIS_PATTERNS);

  if (isPriceCheck && !isTradeAnalysis) {
    return build('price_check', tickers);
  }

  if (isTradeAnalysis || tickers.length > 0) {
    return build('trade_analysis', tickers, {
      needsOptions: !isSimple,
      needsNews: !isSimple,
      needsCalendar: !isSimple,
      needsHistory: true,
    });
  }

  return build('general', tickers, { needsCalendar: true });
}

/**
 * Check if a question needs live market data
 */
export function needsMarketData(
  classification: QuestionClassification
): boolean {
  return (
    classification.type === 'trade_analysis' ||
    classification.type === 'price_check' ||
    classification.type === 'scan' ||
    classification.tickers.length > 0
  );
}

/**
 * Check if a question needs AI tools
 */
export function needsTools(classification: QuestionClassification): boolean {
  return (
    classification.type !== 'general' && classification.type !== 'price_check'
  );
}

/**
 * Convenience predicate: does this classification require ANY signal?
 * Used by the preflight runner to short-circuit when nothing is needed.
 */
export function hasAnyRequiredSignal(reqs: SignalRequirements): boolean {
  return (Object.values(reqs) as boolean[]).some(Boolean);
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  classifyQuestion,
  extractTickers,
  needsMarketData,
  needsTools,
  hasAnyRequiredSignal,
  QUESTION_CLASS_TO_SIGNALS,
};
