/**
 * News Sentiment Scoring Service
 *
 * Analyzes news headlines and content for sentiment signals.
 * Identifies catalyst risks and key themes.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface NewsItem {
  title: string;
  link?: string;
  publisher?: string;
  publishedAt?: Date;
  summary?: string;
}

export interface SentimentAnalysis {
  // Overall sentiment
  score: number; // -1 (bearish) to +1 (bullish)
  label: 'VERY_BEARISH' | 'BEARISH' | 'NEUTRAL' | 'BULLISH' | 'VERY_BULLISH';
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';

  // Volume analysis
  newsCount: number;
  volumeVsNormal: 'HIGH' | 'NORMAL' | 'LOW';

  // Theme extraction
  themes: string[];
  catalysts: CatalystRisk[];

  // Detailed breakdown
  bullishSignals: string[];
  bearishSignals: string[];

  // Summary for AI
  summary: string;
}

export interface CatalystRisk {
  type:
    | 'EARNINGS'
    | 'REGULATORY'
    | 'MACRO'
    | 'COMPETITIVE'
    | 'LEGAL'
    | 'GUIDANCE'
    | 'ANALYST'
    | 'UNKNOWN';
  description: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
}

// ============================================================================
// SENTIMENT DICTIONARIES
// ============================================================================

// Bullish keywords and their weights
const BULLISH_SIGNALS: Record<string, number> = {
  // Strong bullish
  surge: 0.8,
  soar: 0.8,
  breakout: 0.7,
  rally: 0.7,
  beat: 0.7,
  beats: 0.7,
  record: 0.6,
  'all-time high': 0.8,
  upgrade: 0.7,
  upgrades: 0.7,
  bullish: 0.6,
  strong: 0.4,
  growth: 0.4,
  gains: 0.5,
  positive: 0.4,
  optimistic: 0.5,
  outperform: 0.6,
  buy: 0.5,
  raise: 0.4,
  raises: 0.4,
  higher: 0.3,
  boost: 0.5,
  momentum: 0.4,
  accelerat: 0.5,
  expand: 0.4,
  profit: 0.4,
  profitable: 0.5,
  dividend: 0.3,
  buyback: 0.4,
  ai: 0.3, // AI-related often bullish in current market
  'artificial intelligence': 0.3,

  // Moderate bullish
  improve: 0.3,
  better: 0.3,
  exceed: 0.4,
  top: 0.2,
  win: 0.3,
  deal: 0.3,
  partner: 0.3,
  launch: 0.2,
};

// Bearish keywords and their weights
const BEARISH_SIGNALS: Record<string, number> = {
  // Strong bearish
  crash: 0.9,
  plunge: 0.8,
  plummet: 0.8,
  collapse: 0.8,
  crisis: 0.7,
  miss: 0.6,
  misses: 0.6,
  downgrade: 0.7,
  downgrades: 0.7,
  bearish: 0.6,
  sell: 0.5,
  selloff: 0.7,
  'sell-off': 0.7,
  weak: 0.4,
  decline: 0.5,
  drop: 0.4,
  fall: 0.4,
  falls: 0.4,
  lower: 0.3,
  cut: 0.4,
  cuts: 0.4,
  reduce: 0.3,
  loss: 0.5,
  losses: 0.5,
  negative: 0.4,
  concern: 0.4,
  worried: 0.4,
  fear: 0.5,
  risk: 0.3,
  warning: 0.5,
  warns: 0.5,
  layoff: 0.5,
  layoffs: 0.5,
  restructur: 0.4,
  lawsuit: 0.5,
  investigate: 0.5,
  investigation: 0.5,
  probe: 0.4,
  recall: 0.4,
  delay: 0.3,
  delays: 0.3,

  // Moderate bearish
  slow: 0.3,
  slowing: 0.4,
  disappooint: 0.4,
  struggle: 0.4,
  trouble: 0.4,
  challenge: 0.2,
  uncertain: 0.3,
  volatil: 0.2,
  tariff: 0.4,
  tariffs: 0.4,
};

// Catalyst/theme keywords
const CATALYST_PATTERNS: Array<{
  pattern: RegExp;
  type: CatalystRisk['type'];
  severity: CatalystRisk['severity'];
}> = [
  {
    pattern: /earnings|quarterly|q[1-4]|fiscal/i,
    type: 'EARNINGS',
    severity: 'HIGH',
  },
  {
    pattern: /fda|sec|ftc|doj|regulat|antitrust|compliance/i,
    type: 'REGULATORY',
    severity: 'HIGH',
  },
  {
    pattern: /fed|fomc|rate|inflation|gdp|jobs|employment|cpi|ppi/i,
    type: 'MACRO',
    severity: 'MEDIUM',
  },
  {
    pattern: /compet|rival|market share|disruption/i,
    type: 'COMPETITIVE',
    severity: 'MEDIUM',
  },
  {
    pattern: /lawsuit|legal|court|settlement|litigation/i,
    type: 'LEGAL',
    severity: 'HIGH',
  },
  {
    pattern: /guidance|outlook|forecast|expect/i,
    type: 'GUIDANCE',
    severity: 'MEDIUM',
  },
  {
    pattern: /analyst|price target|rating|upgrade|downgrade/i,
    type: 'ANALYST',
    severity: 'LOW',
  },
];

// ============================================================================
// ANALYSIS FUNCTIONS
// ============================================================================

/**
 * Analyze sentiment of a single headline
 */
function analyzeHeadline(headline: string): {
  score: number;
  bullish: string[];
  bearish: string[];
} {
  const lower = headline.toLowerCase();
  let score = 0;
  const bullish: string[] = [];
  const bearish: string[] = [];

  // Check bullish signals
  for (const [word, weight] of Object.entries(BULLISH_SIGNALS)) {
    if (lower.includes(word)) {
      score += weight;
      bullish.push(word);
    }
  }

  // Check bearish signals
  for (const [word, weight] of Object.entries(BEARISH_SIGNALS)) {
    if (lower.includes(word)) {
      score -= weight;
      bearish.push(word);
    }
  }

  return { score, bullish, bearish };
}

/**
 * Extract catalyst risks from news
 */
function extractCatalysts(headlines: string[]): CatalystRisk[] {
  const catalysts: CatalystRisk[] = [];
  const seenTypes = new Set<string>();

  for (const headline of headlines) {
    for (const { pattern, type, severity } of CATALYST_PATTERNS) {
      if (pattern.test(headline) && !seenTypes.has(type)) {
        catalysts.push({
          type,
          description:
            headline.slice(0, 60) + (headline.length > 60 ? '...' : ''),
          severity,
        });
        seenTypes.add(type);
      }
    }
  }

  return catalysts;
}

/**
 * Extract key themes from headlines
 */
function extractThemes(headlines: string[]): string[] {
  const themes: string[] = [];
  const combinedText = headlines.join(' ').toLowerCase();

  // Theme patterns
  const themePatterns: Array<{ pattern: RegExp; theme: string }> = [
    { pattern: /ai|artificial intelligence|machine learning/i, theme: 'AI/ML' },
    { pattern: /chip|semiconductor|gpu|nvidia/i, theme: 'Semiconductors' },
    { pattern: /cloud|aws|azure|saas/i, theme: 'Cloud Computing' },
    { pattern: /tariff|trade war|china/i, theme: 'Trade/Tariffs' },
    { pattern: /rate|fed|inflation/i, theme: 'Interest Rates' },
    { pattern: /ev|electric vehicle|tesla/i, theme: 'EV/Clean Energy' },
    { pattern: /buyback|dividend|return/i, theme: 'Shareholder Returns' },
    { pattern: /growth|expansion|revenue/i, theme: 'Growth' },
    { pattern: /margin|cost|efficiency/i, theme: 'Profitability' },
    { pattern: /debt|leverage|credit/i, theme: 'Debt/Credit' },
  ];

  for (const { pattern, theme } of themePatterns) {
    if (pattern.test(combinedText)) {
      themes.push(theme);
    }
  }

  return themes.slice(0, 5); // Limit to top 5 themes
}

/**
 * Analyze news sentiment for a ticker
 */
export function analyzeNewsSentiment(news: NewsItem[]): SentimentAnalysis {
  if (!news || news.length === 0) {
    return {
      score: 0,
      label: 'NEUTRAL',
      confidence: 'LOW',
      newsCount: 0,
      volumeVsNormal: 'LOW',
      themes: [],
      catalysts: [],
      bullishSignals: [],
      bearishSignals: [],
      summary: 'No recent news available.',
    };
  }

  // Analyze each headline
  let totalScore = 0;
  const allBullish: string[] = [];
  const allBearish: string[] = [];

  for (const item of news) {
    const { score, bullish, bearish } = analyzeHeadline(item.title);
    totalScore += score;
    allBullish.push(...bullish);
    allBearish.push(...bearish);
  }

  // Normalize score to -1 to +1 range
  const normalizedScore = Math.max(-1, Math.min(1, totalScore / news.length));

  // Determine label
  let label: SentimentAnalysis['label'];
  if (normalizedScore >= 0.5) label = 'VERY_BULLISH';
  else if (normalizedScore >= 0.15) label = 'BULLISH';
  else if (normalizedScore <= -0.5) label = 'VERY_BEARISH';
  else if (normalizedScore <= -0.15) label = 'BEARISH';
  else label = 'NEUTRAL';

  // Determine confidence based on signal count and agreement
  const signalCount = allBullish.length + allBearish.length;
  const signalAgreement =
    Math.abs(allBullish.length - allBearish.length) / Math.max(1, signalCount);

  let confidence: SentimentAnalysis['confidence'];
  if (signalCount >= 5 && signalAgreement >= 0.6) {
    confidence = 'HIGH';
  } else if (signalCount >= 3) {
    confidence = 'MEDIUM';
  } else {
    confidence = 'LOW';
  }

  // News volume assessment (arbitrary thresholds)
  let volumeVsNormal: SentimentAnalysis['volumeVsNormal'];
  if (news.length >= 10) volumeVsNormal = 'HIGH';
  else if (news.length >= 3) volumeVsNormal = 'NORMAL';
  else volumeVsNormal = 'LOW';

  // Extract themes and catalysts
  const headlines = news.map((n) => n.title);
  const themes = extractThemes(headlines);
  const catalysts = extractCatalysts(headlines);

  // Deduplicate signals
  const bullishSignals = [...new Set(allBullish)].slice(0, 5);
  const bearishSignals = [...new Set(allBearish)].slice(0, 5);

  // Build summary
  const summary = buildSentimentSummary(
    normalizedScore,
    label,
    confidence,
    themes,
    catalysts,
    bullishSignals,
    bearishSignals,
    news.length
  );

  return {
    score: normalizedScore,
    label,
    confidence,
    newsCount: news.length,
    volumeVsNormal,
    themes,
    catalysts,
    bullishSignals,
    bearishSignals,
    summary,
  };
}

/**
 * Build human-readable summary
 */
function buildSentimentSummary(
  score: number,
  label: SentimentAnalysis['label'],
  confidence: SentimentAnalysis['confidence'],
  themes: string[],
  catalysts: CatalystRisk[],
  bullish: string[],
  bearish: string[],
  newsCount: number
): string {
  const parts: string[] = [];

  // Sentiment statement
  const sentimentStr = score >= 0 ? `+${score.toFixed(2)}` : score.toFixed(2);
  parts.push(`News sentiment: ${sentimentStr} (${label}, ${confidence} conf)`);

  // Signal breakdown
  if (bullish.length > 0 || bearish.length > 0) {
    const signalParts: string[] = [];
    if (bullish.length > 0) {
      signalParts.push(`+: ${bullish.slice(0, 3).join(', ')}`);
    }
    if (bearish.length > 0) {
      signalParts.push(`-: ${bearish.slice(0, 3).join(', ')}`);
    }
    parts.push(signalParts.join(' | '));
  }

  // Themes
  if (themes.length > 0) {
    parts.push(`Themes: ${themes.join(', ')}`);
  }

  // High severity catalysts
  const highCatalysts = catalysts.filter((c) => c.severity === 'HIGH');
  if (highCatalysts.length > 0) {
    parts.push(`⚠️ Catalysts: ${highCatalysts.map((c) => c.type).join(', ')}`);
  }

  return parts.join('\n');
}

// ============================================================================
// FORMATTING FOR AI
// ============================================================================

/**
 * Format sentiment analysis for AI context
 */
export function formatSentimentForAI(sentiment: SentimentAnalysis): string {
  const lines: string[] = [];

  // Main sentiment line
  const scoreStr =
    sentiment.score >= 0
      ? `+${sentiment.score.toFixed(2)}`
      : sentiment.score.toFixed(2);
  const emoji = sentiment.label.includes('BULLISH')
    ? '📈'
    : sentiment.label.includes('BEARISH')
      ? '📉'
      : '➡️';

  lines.push(
    `NEWS SENTIMENT: ${emoji} ${scoreStr} (${sentiment.label}) - ` +
      `${sentiment.confidence} confidence`
  );

  // Volume context
  if (sentiment.volumeVsNormal === 'HIGH') {
    lines.push(`  ⚡ High news volume (${sentiment.newsCount} articles)`);
  }

  // Key signals
  if (sentiment.bullishSignals.length > 0) {
    lines.push(
      `  ✓ Bullish: ${sentiment.bullishSignals.slice(0, 4).join(', ')}`
    );
  }
  if (sentiment.bearishSignals.length > 0) {
    lines.push(
      `  ✗ Bearish: ${sentiment.bearishSignals.slice(0, 4).join(', ')}`
    );
  }

  // Themes
  if (sentiment.themes.length > 0) {
    lines.push(`  📌 Themes: ${sentiment.themes.join(', ')}`);
  }

  // Catalyst warnings
  const highCatalysts = sentiment.catalysts.filter(
    (c) => c.severity === 'HIGH'
  );
  for (const catalyst of highCatalysts) {
    lines.push(`  ⚠️ ${catalyst.type}: ${catalyst.description}`);
  }

  return lines.join('\n');
}

/**
 * Compact TOON format for token efficiency
 */
export function formatSentimentTOON(sentiment: SentimentAnalysis): string {
  const score =
    sentiment.score >= 0
      ? `+${sentiment.score.toFixed(1)}`
      : sentiment.score.toFixed(1);
  const label = sentiment.label.replace('VERY_', 'V').charAt(0);
  const conf = sentiment.confidence.charAt(0);
  const catalystCount = sentiment.catalysts.filter(
    (c) => c.severity === 'HIGH'
  ).length;

  return (
    `SENT:${score}|${label}|${conf}|` +
    `${sentiment.newsCount}art|` +
    `${catalystCount > 0 ? catalystCount + 'cat' : 'ok'}`
  );
}

/**
 * Get sentiment-based risk assessment for Victor
 */
export function getSentimentRiskLevel(
  sentiment: SentimentAnalysis
): 'LOW' | 'MEDIUM' | 'HIGH' {
  // High risk conditions
  if (sentiment.label === 'VERY_BEARISH' && sentiment.confidence !== 'LOW') {
    return 'HIGH';
  }
  if (
    sentiment.catalysts.some(
      (c) =>
        c.severity === 'HIGH' &&
        ['REGULATORY', 'LEGAL', 'EARNINGS'].includes(c.type)
    )
  ) {
    return 'HIGH';
  }
  if (sentiment.volumeVsNormal === 'HIGH' && sentiment.score < -0.3) {
    return 'HIGH';
  }

  // Medium risk conditions
  if (sentiment.label === 'BEARISH') {
    return 'MEDIUM';
  }
  if (sentiment.catalysts.length > 0) {
    return 'MEDIUM';
  }

  return 'LOW';
}
