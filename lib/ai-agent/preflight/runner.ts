/**
 * Preflight runner — deterministic context fan-out
 *
 * Phase 1 foundation. Given a user question, runs the classifier,
 * resolves the required signal bundle, and fetches each signal in
 * parallel. Returns the raw signals, an assembled `LIVE DATA` block,
 * and a `CoverageReport` describing what was checked / skipped /
 * stale / errored.
 *
 * Three signals are wired in PR A: `regime`, `calendar`, `ticker_data`.
 * PR B extends with `news`, `sentiment`, `earnings`, `geopolitical`,
 * `sector_flow`. PR C runs each signal through an extractor.
 *
 * @example
 * ```typescript
 * const result = await runPreflight('How does NVDA look today?');
 * systemPrompt += `\n\n## LIVE DATA\n${result.formattedContext}`;
 * void logDecision({ ..., coverage_report: result.coverage });
 * ```
 */

import {
  classifyQuestion,
  type QuestionClassification,
  type SignalKey,
  type SignalRequirements,
} from '../classification';
import { fetchTickerData } from '../data';
import { fetchRecentNews, type RecentNewsResult } from '../data/news';
import { fetchFmpEarningsCalendar, type FmpEarningsRow } from '../data/fmp';
import { scoreHeadlines, type SentimentScore } from '../sentiment';
import {
  extractNews,
  extractSentiment,
  type NewsDigest,
  type SentimentDigest,
} from '../extractors';
import { encodeTickerToTOON, encodeRecentNewsToTOON } from '../toon';
import {
  getCalendarContext,
  formatCalendarForAI,
  encodeCalendarToTOON,
  getGeopoliticalEvents,
  type MarketEvent,
} from '../calendar';
import {
  getMarketRegime,
  getSectorPerformance,
  type SectorPerformance,
  formatRegimeForAI,
} from '../market';
import { encodeMarketRegimeToTOON } from '../toon';
import { log } from '../utils';
import type {
  CoverageError,
  CoverageReport,
  PreflightOptions,
  PreflightResult,
  SignalLatency,
} from './types';

// ============================================================================
// PER-SIGNAL FETCHERS (PR A subset)
// ============================================================================

/**
 * Wrapper that times a signal fetch and turns thrown errors into a
 * structured `{ ok, error?, value? }` so the runner can assemble the
 * `CoverageReport` uniformly across signals. Never throws.
 */
async function timeSignal<T>(
  signal: SignalKey,
  fetcher: () => Promise<T>
): Promise<{ ok: boolean; latency_ms: number; value?: T; error?: string }> {
  const start = Date.now();
  try {
    const value = await fetcher();
    return { ok: true, latency_ms: Date.now() - start, value };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.warn(`[preflight] ${signal} failed: ${message}`);
    return { ok: false, latency_ms: Date.now() - start, error: message };
  }
}

// ============================================================================
// MAIN ENTRY
// ============================================================================

/**
 * Run preflight for a user question.
 *
 * Pure: no side effects beyond network / cache reads done by the
 * underlying fetchers. Designed to be called once per chat turn before
 * the model is invoked.
 */
export async function runPreflight(
  question: string,
  options: PreflightOptions = {}
): Promise<PreflightResult> {
  const wallStart = Date.now();
  const useTOON = options.useTOON ?? true;

  // 1. Classification — produces the deterministic signal bundle.
  const classification: QuestionClassification = classifyQuestion(question);
  if (options.tickers) {
    classification.tickers = options.tickers;
  }
  const reqs: SignalRequirements =
    options.forceSignals ?? classification.signalRequirements;

  // 2. Run all required signals in parallel; collect ok/error per signal.
  const signals: Partial<Record<SignalKey, unknown>> = {};
  const checked: SignalKey[] = [];
  const skipped: SignalKey[] = [];
  const errors: CoverageError[] = [];
  const latencies: SignalLatency[] = [];

  // Build the parallel list of (signal, promise) pairs only for required signals.
  // Non-required ones go straight to `skipped` without taking latency.
  const tasks: Array<Promise<void>> = [];

  // ----- regime -----
  if (reqs.regime) {
    tasks.push(
      timeSignal('regime', () => getMarketRegime()).then((r) => {
        latencies.push({
          signal: 'regime',
          latency_ms: r.latency_ms,
          ok: r.ok,
        });
        if (r.ok && r.value) {
          signals.regime = r.value;
          checked.push('regime');
        } else {
          errors.push({
            signal: 'regime',
            message: r.error ?? 'unknown error',
          });
        }
      })
    );
  } else {
    skipped.push('regime');
  }

  // ----- calendar (synchronous; still wrap for uniform timing) -----
  if (reqs.calendar) {
    tasks.push(
      timeSignal('calendar', () => Promise.resolve(getCalendarContext())).then(
        (r) => {
          latencies.push({
            signal: 'calendar',
            latency_ms: r.latency_ms,
            ok: r.ok,
          });
          if (r.ok && r.value) {
            signals.calendar = r.value;
            checked.push('calendar');
          } else {
            errors.push({
              signal: 'calendar',
              message: r.error ?? 'unknown error',
            });
          }
        }
      )
    );
  } else {
    skipped.push('calendar');
  }

  // ----- ticker_data (per-ticker, fan out further) -----
  if (reqs.ticker_data && classification.tickers.length > 0) {
    tasks.push(
      timeSignal('ticker_data', async () => {
        const results = await Promise.all(
          classification.tickers.map((t) =>
            fetchTickerData(t).catch(() => null)
          )
        );
        return results.filter((r) => r !== null);
      }).then((r) => {
        latencies.push({
          signal: 'ticker_data',
          latency_ms: r.latency_ms,
          ok: r.ok,
        });
        if (r.ok && r.value) {
          signals.ticker_data = r.value;
          checked.push('ticker_data');
        } else {
          errors.push({
            signal: 'ticker_data',
            message: r.error ?? 'unknown error',
          });
        }
      })
    );
  } else {
    // Either not required, or required but no ticker extracted.
    skipped.push('ticker_data');
  }

  // ----- Phase 1B signals -----

  // News (also drives sentiment).
  const primaryTicker = classification.tickers[0];
  let newsPromise: Promise<RecentNewsResult | null> = Promise.resolve(null);
  if (reqs.news || reqs.sentiment) {
    if (primaryTicker) {
      newsPromise = fetchRecentNews(primaryTicker, { hours: 48 }).catch(
        () => null
      );
    } else {
      // Required but no ticker → log skip with rationale.
      if (reqs.news) skipped.push('news');
      if (reqs.sentiment) skipped.push('sentiment');
    }
  } else {
    skipped.push('news');
    skipped.push('sentiment');
  }

  if (reqs.news && primaryTicker) {
    tasks.push(
      timeSignal('news', () =>
        newsPromise.then(
          (v) => v ?? Promise.reject(new Error('no news returned'))
        )
      ).then((r) => {
        latencies.push({ signal: 'news', latency_ms: r.latency_ms, ok: r.ok });
        if (r.ok && r.value) {
          signals.news = r.value;
          checked.push('news');
        } else {
          errors.push({
            signal: 'news',
            message: r.error ?? 'unknown error',
          });
        }
      })
    );
  }

  if (reqs.sentiment && primaryTicker) {
    tasks.push(
      timeSignal('sentiment', async () => {
        const news = await newsPromise;
        if (!news || news.articles.length === 0) {
          throw new Error('no headlines available');
        }
        return scoreHeadlines(
          news.articles.map((a) => ({
            title: a.title,
            published_at: a.published_at,
          }))
        );
      }).then((r) => {
        latencies.push({
          signal: 'sentiment',
          latency_ms: r.latency_ms,
          ok: r.ok,
        });
        if (r.ok && r.value) {
          signals.sentiment = r.value;
          checked.push('sentiment');
        } else {
          errors.push({
            signal: 'sentiment',
            message: r.error ?? 'unknown error',
          });
        }
      })
    );
  }

  // Earnings calendar.
  if (reqs.earnings) {
    tasks.push(
      timeSignal('earnings', () =>
        fetchFmpEarningsCalendar({
          days: 7,
          tickers: classification.tickers.length
            ? classification.tickers
            : undefined,
        })
      ).then((r) => {
        latencies.push({
          signal: 'earnings',
          latency_ms: r.latency_ms,
          ok: r.ok,
        });
        if (r.ok && r.value) {
          signals.earnings = r.value;
          checked.push('earnings');
        } else {
          errors.push({
            signal: 'earnings',
            message: r.error ?? 'FMP unavailable',
          });
        }
      })
    );
  } else {
    skipped.push('earnings');
  }

  // Sector flow.
  if (reqs.sector_flow) {
    tasks.push(
      timeSignal('sector_flow', () => getSectorPerformance()).then((r) => {
        latencies.push({
          signal: 'sector_flow',
          latency_ms: r.latency_ms,
          ok: r.ok,
        });
        if (r.ok && r.value) {
          signals.sector_flow = r.value;
          checked.push('sector_flow');
        } else {
          errors.push({
            signal: 'sector_flow',
            message: r.error ?? 'unknown error',
          });
        }
      })
    );
  } else {
    skipped.push('sector_flow');
  }

  // Geopolitical (synchronous, but timed for parity).
  if (reqs.geopolitical) {
    tasks.push(
      timeSignal('geopolitical', () =>
        Promise.resolve(getGeopoliticalEvents(14))
      ).then((r) => {
        latencies.push({
          signal: 'geopolitical',
          latency_ms: r.latency_ms,
          ok: r.ok,
        });
        if (r.ok && r.value) {
          signals.geopolitical = r.value;
          checked.push('geopolitical');
        } else {
          errors.push({
            signal: 'geopolitical',
            message: r.error ?? 'unknown error',
          });
        }
      })
    );
  } else {
    skipped.push('geopolitical');
  }

  // Fundamentals — still only served via the model tool (`get_financials_deep`).
  if (reqs.fundamentals) {
    errors.push({
      signal: 'fundamentals',
      message: 'fundamentals served via tool call only (not preflight)',
    });
  } else {
    skipped.push('fundamentals');
  }

  await Promise.all(tasks);

  // 3. Run extractors (Phase 1C). Digests live alongside raw payloads
  //    in `signals` and a slimmed copy goes into `coverage.digests` for
  //    persistence + UI surfacing.
  const digests: Record<string, unknown> = {};

  const newsRaw = signals.news as RecentNewsResult | undefined;
  let newsDigest: NewsDigest | null = null;
  if (newsRaw && newsRaw.articles.length > 0) {
    newsDigest = extractNews(newsRaw);
    digests.news = newsDigest;
  }

  const sentimentRaw = signals.sentiment as SentimentScore | undefined;
  let sentimentDigest: SentimentDigest | null = null;
  if (sentimentRaw) {
    // Pull the primary ticker's daily change pct (if available) so the
    // sentiment extractor can detect news-vs-price divergence.
    const tickerArr = signals.ticker_data as
      | Array<Awaited<ReturnType<typeof fetchTickerData>>>
      | undefined;
    const priceChangePct = tickerArr?.[0]?.changePct;
    sentimentDigest = extractSentiment(sentimentRaw, { priceChangePct });
    digests.sentiment = sentimentDigest;
  }

  const earningsRaw = signals.earnings as FmpEarningsRow[] | undefined;
  if (earningsRaw && earningsRaw.length > 0) {
    digests.earnings = {
      next: `${earningsRaw[0].symbol} ${earningsRaw[0].date}`,
      count: earningsRaw.length,
    };
  }

  // 4. Stale detection (Phase 1C: none yet — every checked signal is
  //    "fresh" by virtue of being fetched on this turn). Hook here so
  //    later phases can push entries when extractors flag stale data.
  const stale: SignalKey[] = [];

  // 5. Assemble the LIVE DATA block. Order matters: warnings first,
  //    then market-wide context (regime + calendar), then per-ticker
  //    blocks, then Phase 1B blocks (digest-driven where extractors
  //    exist; raw lines otherwise).
  const formattedContext = assembleLiveData(signals, classification, useTOON, {
    newsDigest,
    sentimentDigest,
  });

  const coverage: CoverageReport = {
    checked,
    skipped,
    stale,
    errors,
    latencies,
    digests,
  };

  return {
    classification,
    signals,
    formattedContext,
    coverage,
    total_latency_ms: Date.now() - wallStart,
  };
}

// ============================================================================
// FORMAT
// ============================================================================

function assembleLiveData(
  signals: Partial<Record<SignalKey, unknown>>,
  classification: QuestionClassification,
  useTOON: boolean,
  extras: {
    newsDigest: NewsDigest | null;
    sentimentDigest: SentimentDigest | null;
  }
): string {
  const parts: string[] = [];

  // Warnings come first so the model sees them before any data.
  const calendar = signals.calendar as
    | ReturnType<typeof getCalendarContext>
    | undefined;
  const regime = signals.regime as
    | Awaited<ReturnType<typeof getMarketRegime>>
    | undefined;

  const warnings: string[] = [];
  if (calendar?.warnings.length) warnings.push(...calendar.warnings);
  if (regime?.regime === 'HIGH_VOL') {
    warnings.push('⚠️ High volatility regime - reduce position sizes');
  }
  if (regime?.regime === 'RISK_OFF') {
    warnings.push('⚠️ Risk-off market regime - exercise extra caution');
  }
  if (warnings.length > 0) {
    parts.push('=== MARKET WARNINGS ===');
    warnings.forEach((w) => parts.push(w));
    parts.push('');
  }

  // Calendar.
  if (calendar) {
    parts.push(useTOON ? encodeCalendarToTOON() : formatCalendarForAI());
  }

  // Regime.
  if (regime) {
    parts.push(
      useTOON ? encodeMarketRegimeToTOON(regime) : formatRegimeForAI(regime)
    );
  }

  // Per-ticker data.
  const tickerArr = signals.ticker_data as
    | Array<Awaited<ReturnType<typeof fetchTickerData>>>
    | undefined;
  if (tickerArr && tickerArr.length > 0) {
    for (const data of tickerArr) {
      if (!data) continue;
      parts.push(`\n=== ${data.ticker.toUpperCase()} DATA ===`);
      parts.push(useTOON ? encodeTickerToTOON(data) : JSON.stringify(data));
    }
  }

  // Phase 1C: news + sentiment use digests, not raw payloads. The raw
  // articles are still in `signals.news` for tool calls that drill in;
  // the system prompt sees the compressed catalysts/risk-flags view.
  const news = signals.news as RecentNewsResult | undefined;
  if (news && extras.newsDigest) {
    const d = extras.newsDigest;
    const lines: string[] = [
      `\n=== ${news.ticker} NEWS DIGEST (${d.article_count} articles, ${news.hours}h) ===`,
      `Sentiment: ${d.sentiment.score.toFixed(2)} (${d.sentiment.label})`,
    ];
    if (d.catalysts.length > 0) {
      lines.push(
        `Catalysts (${d.catalysts.length}):\n` +
          d.catalysts
            .slice(0, 5)
            .map((c) => `  \u00b7 [${c.type}] ${c.detail} (${c.confidence})`)
            .join('\n')
      );
    }
    if (d.risk_flags.length > 0) {
      lines.push(
        `Risk flags:\n` +
          d.risk_flags.map((r) => `  \u00b7 ${r.kind}: ${r.detail}`).join('\n')
      );
    }
    parts.push(lines.join('\n'));
  } else if (news && news.articles.length > 0) {
    // Fallback: no digest (shouldn't happen for non-empty news, but
    // be defensive — useTOON path remains available for tool calls).
    parts.push(`\n=== ${news.ticker} RECENT NEWS (${news.hours}h) ===`);
    parts.push(useTOON ? encodeRecentNewsToTOON(news) : JSON.stringify(news));
  }

  if (extras.sentimentDigest) {
    const d = extras.sentimentDigest;
    const momentumStr =
      d.momentum != null ? d.momentum.toFixed(2) : 'insufficient';
    const divergenceStr =
      d.divergences.length > 0
        ? `\nDivergences: ${d.divergences.map((x) => x.detail).join('; ')}`
        : '';
    parts.push(
      `\n=== SENTIMENT DIGEST ===\nScore: ${d.score.toFixed(2)} (${d.label}) \u00b7 ` +
        `${d.article_count} articles \u00b7 ` +
        `momentum: ${momentumStr}${divergenceStr}`
    );
  }

  const earnings = signals.earnings as FmpEarningsRow[] | undefined;
  if (earnings && earnings.length > 0) {
    const lines = earnings
      .slice(0, 8)
      .map((e) => `${e.date} ${e.symbol} EPS est ${e.epsEstimated ?? '?'}`)
      .join('\n');
    parts.push(`\n=== UPCOMING EARNINGS (preflight) ===\n${lines}`);
  }

  const sectors = signals.sector_flow as SectorPerformance[] | undefined;
  if (sectors && sectors.length > 0) {
    const top = sectors
      .slice()
      .sort((a, b) => b.changePct - a.changePct)
      .slice(0, 4)
      .map((s) => `${s.ticker} ${s.changePct.toFixed(2)}% (${s.momentum})`)
      .join(', ');
    parts.push(`\n=== SECTOR FLOW (preflight) ===\n${top}`);
  }

  const geo = signals.geopolitical as MarketEvent[] | undefined;
  if (geo && geo.length > 0) {
    const lines = geo
      .slice(0, 5)
      .map(
        (e) => `${e.date.toISOString().slice(0, 10)} [${e.impact}] ${e.name}`
      )
      .join('\n');
    parts.push(`\n=== GEOPOLITICAL (preflight, curated) ===\n${lines}`);
  }

  // If nothing was checked, return an empty string so callers can
  // detect the no-context case cleanly.
  return parts.join('\n').trim();
}

// ============================================================================
// COVERAGE-ONLY HELPERS (used by chat routes that need to build the
// stream marker / decision log payload without re-running preflight)
// ============================================================================

/**
 * Stable JSON serializer for the `<!--COVERAGE:{json}:COVERAGE-->`
 * stream marker so the parser on the UI side has a single canonical
 * shape to match against.
 */
export function serializeCoverage(coverage: CoverageReport): string {
  return JSON.stringify(coverage);
}
