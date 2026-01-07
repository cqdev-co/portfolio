'use client';

import { cn } from '@/lib/utils';
import type { TickerData } from '@lib/ai-agent';

interface TickerDataCardProps {
  data: TickerData;
  className?: string;
}

// Format market cap
const formatMarketCap = (mc?: number) => {
  if (!mc) return null;
  if (mc >= 1e12) return `$${(mc / 1e12).toFixed(1)}T`;
  if (mc >= 1e9) return `$${(mc / 1e9).toFixed(0)}B`;
  return `$${(mc / 1e6).toFixed(0)}M`;
};

// Format percentage with sign
const formatPct = (val?: number) => {
  if (val === undefined || val === null) return null;
  return `${val >= 0 ? '+' : ''}${val.toFixed(1)}%`;
};

/**
 * Enterprise-grade ticker data card with clean, professional design.
 * Displays comprehensive financial data in an organized layout.
 */
export function TickerDataCard({ data, className }: TickerDataCardProps) {
  const {
    ticker,
    price,
    change,
    changePct,
    rsi,
    adx,
    aboveMA200,
    ma20,
    ma50,
    ma200,
    marketCap,
    peRatio,
    forwardPE,
    eps,
    beta,
    dividendYield,
    fiftyTwoWeekLow,
    fiftyTwoWeekHigh,
    analystRatings,
    targetPrices,
    performance,
    earningsDays,
    earningsWarning,
    iv,
    shortInterest,
    support,
    resistance,
    spread,
    grade,
    news,
    dataQuality,
    // Rich data fields
    optionsFlow,
    relativeStrength,
    earnings,
    pfv,
    sectorContext,
  } = data;

  const isPositive = changePct >= 0;

  return (
    <div
      className={cn(
        'rounded-xl border border-border/60 bg-card',
        'shadow-sm overflow-hidden my-4',
        'transition-all duration-200 hover:shadow-md hover:border-border',
        className
      )}
    >
      {/* Header */}
      <div
        className={cn(
          'px-4 py-3 border-b border-border/40',
          'bg-gradient-to-r from-muted/30 to-transparent'
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Ticker badge */}
            <div
              className={cn(
                'flex items-center justify-center',
                'w-10 h-10 rounded-lg',
                'bg-primary/10 text-primary font-bold text-sm'
              )}
            >
              {ticker.slice(0, 2)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">{ticker}</span>
                {grade && (
                  <span
                    className={cn(
                      'px-2 py-0.5 rounded-full text-[10px] font-semibold',
                      'uppercase tracking-wide',
                      grade.grade.startsWith('A')
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                        : grade.grade.startsWith('B')
                          ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
                          : grade.grade.startsWith('C')
                            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                            : 'bg-red-500/15 text-red-600 dark:text-red-400'
                    )}
                  >
                    {grade.grade}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-muted-foreground">
                Yahoo Finance
                {dataQuality?.isStale && (
                  <span className="text-amber-500 ml-1">
                    • {dataQuality.warning}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Price */}
          <div className="text-right">
            <div className="text-lg font-semibold tabular-nums">
              ${price.toFixed(2)}
            </div>
            <div
              className={cn(
                'text-sm font-medium tabular-nums',
                isPositive ? 'text-emerald-600' : 'text-red-500'
              )}
            >
              {change !== undefined && (
                <span>
                  {change >= 0 ? '+' : ''}
                  {change.toFixed(2)}{' '}
                </span>
              )}
              ({formatPct(changePct)})
            </div>
          </div>
        </div>
      </div>

      {/* Content grid */}
      <div className="p-4">
        <div className="grid grid-cols-2 gap-4 text-xs">
          {/* Technical Indicators */}
          <div className="space-y-2">
            <div
              className="text-[10px] font-medium text-muted-foreground 
                            uppercase tracking-wider"
            >
              Technical
            </div>

            {/* RSI */}
            {rsi && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">RSI</span>
                <span
                  className={cn(
                    'font-medium tabular-nums',
                    rsi < 30
                      ? 'text-emerald-600'
                      : rsi > 70
                        ? 'text-red-500'
                        : 'text-foreground'
                  )}
                >
                  {rsi.toFixed(0)}
                </span>
              </div>
            )}

            {/* ADX */}
            {adx && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">ADX</span>
                <span className="font-medium tabular-nums">
                  {adx.toFixed(0)}
                </span>
              </div>
            )}

            {/* MA200 Trend */}
            {aboveMA200 !== undefined && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Trend</span>
                <span
                  className={cn(
                    'font-medium',
                    aboveMA200 ? 'text-emerald-600' : 'text-red-500'
                  )}
                >
                  {aboveMA200 ? '↑ Above MA200' : '↓ Below MA200'}
                </span>
              </div>
            )}

            {/* S/R */}
            {(support || resistance) && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">S/R</span>
                <span className="font-medium tabular-nums">
                  ${support?.toFixed(0)} / ${resistance?.toFixed(0)}
                </span>
              </div>
            )}
          </div>

          {/* Fundamentals */}
          <div className="space-y-2">
            <div
              className="text-[10px] font-medium text-muted-foreground 
                            uppercase tracking-wider"
            >
              Fundamentals
            </div>

            {marketCap && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Market Cap</span>
                <span className="font-medium">
                  {formatMarketCap(marketCap)}
                </span>
              </div>
            )}

            {peRatio && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">P/E</span>
                <span className="font-medium tabular-nums">
                  {peRatio.toFixed(1)}
                </span>
              </div>
            )}

            {forwardPE && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Fwd P/E</span>
                <span className="font-medium tabular-nums">
                  {forwardPE.toFixed(1)}
                </span>
              </div>
            )}

            {eps !== undefined && eps !== null && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">EPS</span>
                <span
                  className={cn(
                    'font-medium tabular-nums',
                    eps < 0 ? 'text-red-500' : 'text-foreground'
                  )}
                >
                  ${eps.toFixed(2)}
                </span>
              </div>
            )}

            {beta !== undefined && beta !== null && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Beta</span>
                <span
                  className={cn(
                    'font-medium tabular-nums',
                    beta > 1.5
                      ? 'text-amber-500'
                      : beta < 0.7
                        ? 'text-blue-500'
                        : 'text-foreground'
                  )}
                >
                  {beta.toFixed(2)}
                </span>
              </div>
            )}

            {dividendYield !== undefined && dividendYield > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Div Yield</span>
                <span className="font-medium tabular-nums text-emerald-600">
                  {(dividendYield * 100).toFixed(2)}%
                </span>
              </div>
            )}

            {earningsDays !== undefined && earningsDays !== null && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Earnings</span>
                <span
                  className={cn(
                    'font-medium',
                    earningsWarning && 'text-amber-500'
                  )}
                >
                  {earningsDays > 0 ? `${earningsDays}d` : 'Passed'}
                  {earningsWarning && ' ⚠'}
                </span>
              </div>
            )}

            {shortInterest && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Short</span>
                <span className="font-medium tabular-nums">
                  {shortInterest.shortPct.toFixed(1)}%
                </span>
              </div>
            )}

            {/* Sector P/E */}
            {sectorContext?.vsAvg !== undefined && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">vs Sector</span>
                <span
                  className={cn(
                    'font-medium tabular-nums',
                    sectorContext.vsAvg > 20
                      ? 'text-amber-500'
                      : sectorContext.vsAvg < -20
                        ? 'text-emerald-600'
                        : 'text-foreground'
                  )}
                >
                  {sectorContext.vsAvg >= 0 ? '+' : ''}
                  {sectorContext.vsAvg}%
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Options Flow & Relative Strength Row */}
        {(optionsFlow || relativeStrength) && (
          <div
            className={cn(
              'mt-3 pt-3 border-t border-border/40',
              'grid grid-cols-2 gap-4 text-xs'
            )}
          >
            {optionsFlow && (
              <div>
                <div
                  className="text-[10px] font-medium text-muted-foreground 
                                uppercase tracking-wider mb-1"
                >
                  Options Flow
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium tabular-nums">
                    P/C {optionsFlow.pcRatioOI.toFixed(2)}
                  </span>
                  <span
                    className={cn(
                      'px-1.5 py-0.5 rounded text-[10px] font-medium',
                      optionsFlow.sentiment === 'bullish'
                        ? 'bg-emerald-500/10 text-emerald-600'
                        : optionsFlow.sentiment === 'bearish'
                          ? 'bg-red-500/10 text-red-500'
                          : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {optionsFlow.sentiment}
                  </span>
                </div>
              </div>
            )}

            {relativeStrength && (
              <div>
                <div
                  className="text-[10px] font-medium text-muted-foreground 
                                uppercase tracking-wider mb-1"
                >
                  vs SPY (30d)
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'font-medium tabular-nums',
                      relativeStrength.vsSPY > 0
                        ? 'text-emerald-600'
                        : relativeStrength.vsSPY < 0
                          ? 'text-red-500'
                          : 'text-foreground'
                    )}
                  >
                    {relativeStrength.vsSPY >= 0 ? '+' : ''}
                    {relativeStrength.vsSPY.toFixed(1)}%
                  </span>
                  <span
                    className={cn(
                      'text-[10px]',
                      relativeStrength.trend === 'outperforming'
                        ? 'text-emerald-600'
                        : relativeStrength.trend === 'underperforming'
                          ? 'text-red-500'
                          : 'text-muted-foreground'
                    )}
                  >
                    {relativeStrength.trend}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Moving Averages Row */}
        {(ma20 || ma50 || ma200) && (
          <div
            className={cn(
              'mt-4 pt-3 border-t border-border/40',
              'flex items-center gap-4 text-xs'
            )}
          >
            <span
              className="text-[10px] font-medium text-muted-foreground 
                             uppercase tracking-wider"
            >
              MAs
            </span>
            <div className="flex items-center gap-3 text-muted-foreground">
              {ma20 && (
                <span>
                  20:{' '}
                  <span className="text-foreground font-medium">
                    ${ma20.toFixed(0)}
                  </span>
                </span>
              )}
              {ma50 && (
                <span>
                  50:{' '}
                  <span className="text-foreground font-medium">
                    ${ma50.toFixed(0)}
                  </span>
                </span>
              )}
              {ma200 && (
                <span>
                  200:{' '}
                  <span className="text-foreground font-medium">
                    ${ma200.toFixed(0)}
                  </span>
                </span>
              )}
            </div>
          </div>
        )}

        {/* 52-Week Range */}
        {(fiftyTwoWeekLow || fiftyTwoWeekHigh) && (
          <div className={cn('mt-3 pt-3 border-t border-border/40', 'text-xs')}>
            <div
              className="text-[10px] font-medium text-muted-foreground 
                            uppercase tracking-wider mb-2"
            >
              52-Week Range
            </div>
            <div className="flex items-center gap-2">
              <span className="text-red-500 font-medium tabular-nums">
                ${fiftyTwoWeekLow?.toFixed(2)}
              </span>
              <div className="flex-1 h-2 bg-muted rounded-full relative overflow-hidden">
                {fiftyTwoWeekLow && fiftyTwoWeekHigh && (
                  <div
                    className="absolute h-full bg-primary/60 rounded-full"
                    style={{
                      left: 0,
                      width: `${Math.min(
                        100,
                        Math.max(
                          0,
                          ((price - fiftyTwoWeekLow) /
                            (fiftyTwoWeekHigh - fiftyTwoWeekLow)) *
                            100
                        )
                      )}%`,
                    }}
                  />
                )}
                {fiftyTwoWeekLow && fiftyTwoWeekHigh && (
                  <div
                    className="absolute w-1 h-full bg-foreground rounded-full"
                    style={{
                      left: `${Math.min(
                        100,
                        Math.max(
                          0,
                          ((price - fiftyTwoWeekLow) /
                            (fiftyTwoWeekHigh - fiftyTwoWeekLow)) *
                            100
                        )
                      )}%`,
                    }}
                  />
                )}
              </div>
              <span className="text-emerald-600 font-medium tabular-nums">
                ${fiftyTwoWeekHigh?.toFixed(2)}
              </span>
            </div>
          </div>
        )}

        {/* Target & Sentiment Row */}
        {(targetPrices || analystRatings) && (
          <div
            className={cn(
              'mt-3 pt-3 border-t border-border/40',
              'grid grid-cols-2 gap-4 text-xs'
            )}
          >
            {targetPrices && (
              <div>
                <div
                  className="text-[10px] font-medium text-muted-foreground 
                                uppercase tracking-wider mb-1"
                >
                  Price Target
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="font-semibold text-foreground">
                    ${targetPrices.mean.toFixed(0)}
                  </span>
                  <span
                    className={cn(
                      'text-[11px]',
                      targetPrices.upside >= 0
                        ? 'text-emerald-600'
                        : 'text-red-500'
                    )}
                  >
                    {formatPct(targetPrices.upside)}
                  </span>
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  Range: ${targetPrices.low.toFixed(0)} – $
                  {targetPrices.high.toFixed(0)}
                </div>
              </div>
            )}

            {analystRatings && (
              <div>
                <div
                  className="text-[10px] font-medium text-muted-foreground 
                                uppercase tracking-wider mb-1"
                >
                  Analyst Sentiment
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      'font-semibold',
                      analystRatings.bullishPercent >= 70
                        ? 'text-emerald-600'
                        : analystRatings.bullishPercent <= 30
                          ? 'text-red-500'
                          : 'text-foreground'
                    )}
                  >
                    {analystRatings.bullishPercent}% Bullish
                  </div>
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {analystRatings.strongBuy}↑↑ {analystRatings.buy}↑{' '}
                  {analystRatings.hold}– {analystRatings.sell}↓
                </div>
              </div>
            )}
          </div>
        )}

        {/* IV Analysis */}
        {iv && (
          <div className={cn('mt-3 pt-3 border-t border-border/40', 'text-xs')}>
            <div className="flex items-center justify-between">
              <div>
                <span
                  className="text-[10px] font-medium text-muted-foreground 
                                 uppercase tracking-wider"
                >
                  Volatility
                </span>
                <div className="flex items-center gap-3 mt-1">
                  <span>
                    IV:{' '}
                    <span className="font-medium">
                      {iv.currentIV.toFixed(0)}%
                    </span>
                  </span>
                  {iv.hv20 && (
                    <span>
                      HV20:{' '}
                      <span className="font-medium">{iv.hv20.toFixed(0)}%</span>
                    </span>
                  )}
                </div>
              </div>
              {iv.premium && (
                <span
                  className={cn(
                    'px-2 py-1 rounded-md text-[10px] font-medium',
                    iv.premium === 'cheap'
                      ? 'bg-emerald-500/10 text-emerald-600'
                      : iv.premium === 'expensive'
                        ? 'bg-amber-500/10 text-amber-600'
                        : 'bg-muted text-muted-foreground'
                  )}
                >
                  Options {iv.premium}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Spread Recommendation */}
        {spread && (
          <div className={cn('mt-3 pt-3 border-t border-border/40', 'text-xs')}>
            <div
              className="text-[10px] font-medium text-muted-foreground 
                            uppercase tracking-wider mb-2"
            >
              Spread Setup
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="font-mono font-medium">
                  ${spread.longStrike}/${spread.shortStrike}
                </span>
                <span className="text-muted-foreground">
                  ${spread.estimatedDebit.toFixed(2)} debit
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">
                  {spread.cushion.toFixed(1)}% cushion
                </span>
                {spread.pop && (
                  <span
                    className={cn(
                      'px-2 py-0.5 rounded text-[10px] font-medium',
                      'bg-primary/10 text-primary'
                    )}
                  >
                    {spread.pop.toFixed(0)}% PoP
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Psychological Fair Value */}
        {pfv && (
          <div className={cn('mt-3 pt-3 border-t border-border/40', 'text-xs')}>
            <div className="flex items-center justify-between mb-2">
              <div
                className="text-[10px] font-medium text-muted-foreground 
                              uppercase tracking-wider flex items-center gap-1"
              >
                🧠 PFV
              </div>
              {pfv.confidence && (
                <span
                  className={cn(
                    'px-1.5 py-0.5 rounded text-[10px]',
                    pfv.confidence === 'HIGH'
                      ? 'bg-emerald-500/10 text-emerald-600'
                      : pfv.confidence === 'MEDIUM'
                        ? 'bg-amber-500/10 text-amber-600'
                        : 'bg-muted text-muted-foreground'
                  )}
                >
                  {pfv.confidence}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-semibold tabular-nums">
                  ${pfv.fairValue.toFixed(2)}
                </span>
                <span
                  className={cn(
                    'font-medium tabular-nums text-[11px]',
                    pfv.deviationPercent < 0
                      ? 'text-red-500'
                      : 'text-emerald-600'
                  )}
                >
                  ({pfv.deviationPercent >= 0 ? '+' : ''}
                  {pfv.deviationPercent.toFixed(1)}%)
                </span>
              </div>
              <span
                className={cn(
                  'px-2 py-0.5 rounded text-[10px] font-medium uppercase',
                  pfv.bias === 'BULLISH'
                    ? 'bg-emerald-500/10 text-emerald-600'
                    : pfv.bias === 'BEARISH'
                      ? 'bg-red-500/10 text-red-500'
                      : 'bg-muted text-muted-foreground'
                )}
              >
                {pfv.bias}
              </span>
            </div>
          </div>
        )}

        {/* Enhanced Earnings Info */}
        {earnings &&
          (earnings.streak || earnings.lastSurprise !== undefined) && (
            <div
              className={cn('mt-3 pt-3 border-t border-border/40', 'text-xs')}
            >
              <div
                className="text-[10px] font-medium text-muted-foreground 
                            uppercase tracking-wider mb-2"
              >
                Earnings History
              </div>
              <div className="flex items-center gap-4">
                {earnings.streak && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">Streak:</span>
                    <span
                      className={cn(
                        'font-medium',
                        earnings.streak > 0
                          ? 'text-emerald-600'
                          : 'text-red-500'
                      )}
                    >
                      {earnings.streak > 0
                        ? `${earnings.streak} beats`
                        : `${Math.abs(earnings.streak)} misses`}
                    </span>
                  </div>
                )}
                {earnings.lastSurprise !== undefined && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">Last:</span>
                    <span
                      className={cn(
                        'font-medium tabular-nums',
                        earnings.lastSurprise >= 0
                          ? 'text-emerald-600'
                          : 'text-red-500'
                      )}
                    >
                      {earnings.lastSurprise >= 0 ? '+' : ''}
                      {earnings.lastSurprise.toFixed(1)}%
                    </span>
                  </div>
                )}
                {earnings.avgSurprise !== undefined && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">Avg:</span>
                    <span
                      className={cn(
                        'font-medium tabular-nums',
                        earnings.avgSurprise >= 0
                          ? 'text-emerald-600'
                          : 'text-red-500'
                      )}
                    >
                      {earnings.avgSurprise >= 0 ? '+' : ''}
                      {earnings.avgSurprise.toFixed(1)}%
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

        {/* Performance */}
        {performance && (
          <div className={cn('mt-3 pt-3 border-t border-border/40', 'text-xs')}>
            <div
              className="text-[10px] font-medium text-muted-foreground 
                            uppercase tracking-wider mb-2"
            >
              Performance
            </div>
            <div className="flex items-center gap-4">
              {performance.day5 !== undefined && (
                <div className="text-center">
                  <div
                    className={cn(
                      'font-medium tabular-nums',
                      performance.day5 >= 0
                        ? 'text-emerald-600'
                        : 'text-red-500'
                    )}
                  >
                    {formatPct(performance.day5)}
                  </div>
                  <div className="text-[10px] text-muted-foreground">5D</div>
                </div>
              )}
              {performance.month1 !== undefined && (
                <div className="text-center">
                  <div
                    className={cn(
                      'font-medium tabular-nums',
                      performance.month1 >= 0
                        ? 'text-emerald-600'
                        : 'text-red-500'
                    )}
                  >
                    {formatPct(performance.month1)}
                  </div>
                  <div className="text-[10px] text-muted-foreground">1M</div>
                </div>
              )}
              {performance.ytd !== undefined && (
                <div className="text-center">
                  <div
                    className={cn(
                      'font-medium tabular-nums',
                      performance.ytd >= 0 ? 'text-emerald-600' : 'text-red-500'
                    )}
                  >
                    {formatPct(performance.ytd)}
                  </div>
                  <div className="text-[10px] text-muted-foreground">YTD</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* News */}
        {news && news.length > 0 && (
          <div className={cn('mt-3 pt-3 border-t border-border/40', 'text-xs')}>
            <div
              className="text-[10px] font-medium text-muted-foreground 
                            uppercase tracking-wider mb-2"
            >
              Recent News
            </div>
            <div className="space-y-1.5">
              {news.slice(0, 2).map((item, i) => (
                <div
                  key={i}
                  className="text-[11px] text-muted-foreground truncate 
                             hover:text-foreground transition-colors cursor-default"
                >
                  {item.title}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Grade Footer */}
        {grade && (
          <div
            className={cn(
              'mt-4 pt-3 border-t border-border/40',
              'flex items-center justify-between'
            )}
          >
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">Score</span>
              <span className="font-semibold">{grade.score}/100</span>
            </div>
            <span
              className={cn(
                'px-3 py-1 rounded-full text-xs font-semibold',
                grade.recommendation === 'STRONG BUY' ||
                  grade.recommendation === 'BUY'
                  ? 'bg-emerald-500/15 text-emerald-600'
                  : grade.recommendation === 'HOLD'
                    ? 'bg-blue-500/15 text-blue-600'
                    : 'bg-red-500/15 text-red-600'
              )}
            >
              {grade.recommendation}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Professional tool status indicator with smooth animations.
 * Shows during async tool execution.
 */
export function ToolStatusIndicator({
  tool,
  status,
}: {
  tool: string;
  status: 'running' | 'complete' | 'error';
}) {
  // Tool display names
  const toolNames: Record<string, string> = {
    get_ticker_data: 'Fetching market data',
    web_search: 'Searching the web',
    analyze_position: 'Analyzing position',
    scan_for_opportunities: 'Scanning for opportunities',
    processing: 'Processing request',
  };

  const displayName = toolNames[tool] || `Running ${tool}`;

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2.5 px-3 py-2 rounded-lg',
        'text-xs font-medium',
        'border shadow-sm',
        'animate-in fade-in slide-in-from-left-2 duration-300',
        status === 'running' && [
          'bg-gradient-to-r from-blue-500/5 to-blue-500/10',
          'border-blue-200/50 dark:border-blue-800/50',
          'text-blue-700 dark:text-blue-300',
        ],
        status === 'complete' && [
          'bg-gradient-to-r from-emerald-500/5 to-emerald-500/10',
          'border-emerald-200/50 dark:border-emerald-800/50',
          'text-emerald-700 dark:text-emerald-300',
        ],
        status === 'error' && [
          'bg-gradient-to-r from-red-500/5 to-red-500/10',
          'border-red-200/50 dark:border-red-800/50',
          'text-red-700 dark:text-red-300',
        ]
      )}
    >
      {/* Icon */}
      {status === 'running' && (
        <div className="relative w-4 h-4">
          <div
            className={cn(
              'absolute inset-0 rounded-full',
              'border-2 border-current border-t-transparent',
              'animate-spin'
            )}
          />
        </div>
      )}
      {status === 'complete' && (
        <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
          <path
            d="M3 8.5L6.5 12L13 4"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
      {status === 'error' && (
        <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
          <path
            d="M4 4L12 12M12 4L4 12"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      )}

      {/* Text */}
      <span>{displayName}</span>

      {/* Animated dots for running state */}
      {status === 'running' && (
        <span className="flex gap-0.5">
          <span className="w-1 h-1 rounded-full bg-current animate-bounce [animation-delay:0ms]" />
          <span className="w-1 h-1 rounded-full bg-current animate-bounce [animation-delay:150ms]" />
          <span className="w-1 h-1 rounded-full bg-current animate-bounce [animation-delay:300ms]" />
        </span>
      )}
    </div>
  );
}
