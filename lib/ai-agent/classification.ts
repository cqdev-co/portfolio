/**
 * Question Classification
 *
 * Smart classification of user questions to determine what context
 * and data needs to be fetched. This enables efficient context loading
 * by skipping unnecessary API calls.
 *
 * @example
 * ```typescript
 * import { classifyQuestion } from '@lib/ai-agent/classification';
 *
 * const classification = classifyQuestion("How does NVDA look?");
 * // { type: 'trade_analysis', needsOptions: true, ... }
 *
 * if (classification.needsWebSearch) {
 *   // Fetch web search results
 * }
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
  | 'scan' // Market scanning requests
  | 'position' // Questions about existing positions
  | 'general'; // General conversation

/**
 * Classification result with context requirements
 */
export interface QuestionClassification {
  /** The type of question */
  type: QuestionType;
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
  /** Extracted tickers from the question */
  tickers: string[];
}

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
  // Match uppercase words that look like tickers (1-5 letters)
  const matches = message.match(/\b[A-Z]{1,5}\b/g) ?? [];

  // Filter out common words
  const tickers = matches.filter((t) => !COMMON_WORDS.has(t) && t.length >= 2);

  // Return unique tickers
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
 * Classify a user question to determine what context to load
 *
 * This enables smart context loading:
 * - Price checks: minimal data, fast response
 * - Trade analysis: full options, PFV, etc.
 * - Research: web search enabled
 * - Scan: run market scanner
 */
export function classifyQuestion(message: string): QuestionClassification {
  const tickers = extractTickers(message);
  const lower = message.toLowerCase();

  // Check for position questions first (highest priority)
  if (matchesAny(message, POSITION_PATTERNS)) {
    return {
      type: 'position',
      needsOptions: false, // Position tool handles this
      needsNews: false,
      needsWebSearch: false,
      needsCalendar: false,
      needsHistory: true,
      tickers,
    };
  }

  // Scan requests - need full data
  if (matchesAny(message, SCAN_PATTERNS) && tickers.length === 0) {
    return {
      type: 'scan',
      needsOptions: true,
      needsNews: false,
      needsWebSearch: false,
      needsCalendar: true,
      needsHistory: false,
      tickers,
    };
  }

  // Research/news questions - need web search
  if (matchesAny(message, RESEARCH_PATTERNS)) {
    return {
      type: 'research',
      needsOptions: false,
      needsNews: true,
      needsWebSearch: true,
      needsCalendar: false,
      needsHistory: false,
      tickers,
    };
  }

  // Simple price check - minimal data needed
  const isPriceCheck = matchesAny(message, PRICE_PATTERNS);
  const isSimple = matchesAny(message, SIMPLE_PATTERNS);
  const isTradeAnalysis = matchesAny(message, TRADE_ANALYSIS_PATTERNS);

  if (isPriceCheck && !isTradeAnalysis) {
    return {
      type: 'price_check',
      needsOptions: false,
      needsNews: false,
      needsWebSearch: false,
      needsCalendar: false,
      needsHistory: false,
      tickers,
    };
  }

  // Trade analysis - full context needed
  if (isTradeAnalysis || tickers.length > 0) {
    return {
      type: 'trade_analysis',
      needsOptions: !isSimple,
      needsNews: !isSimple,
      needsWebSearch: false,
      needsCalendar: !isSimple,
      needsHistory: true,
      tickers,
    };
  }

  // Default: general question with minimal context
  return {
    type: 'general',
    needsOptions: false,
    needsNews: false,
    needsWebSearch: false,
    needsCalendar: true,
    needsHistory: false,
    tickers,
  };
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

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  classifyQuestion,
  extractTickers,
  needsMarketData,
  needsTools,
};
