/**
 * Sentiment lexicon
 *
 * Phase 1 — moved out of `ai-analyst/src/services/sentiment.ts` so the
 * shared library and the model tool (`get_sentiment`) can score
 * headlines without depending on the CLI package.
 *
 * The lexicons are deliberately conservative: weights bias toward
 * "obvious" signal words (`surge`, `plunge`, `beat`, `miss`) so we
 * don't over-react to ambiguous phrasing in the absence of a real
 * model-driven sentiment service.
 */

/** Bullish signal words → positive weight (0..1). */
export const BULLISH_SIGNALS: Record<string, number> = {
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
  ai: 0.3,
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

/** Bearish signal words → positive weight (subtracted from score). */
export const BEARISH_SIGNALS: Record<string, number> = {
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
