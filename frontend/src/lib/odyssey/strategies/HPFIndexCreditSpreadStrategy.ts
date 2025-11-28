import {
  ChecklistCondition,
  HPFChecklistResult,
  HPFEntryRules,
  HPFExitRules,
  MarketData,
  OptionsData,
  Opportunity,
  CreditSpreadDetails,
} from "./types";

/**
 * High-Probability Filtered Index Credit Spread (HPF-ICS) Strategy
 * 
 * A systematic bull put spread strategy with strict entry filters:
 * 1. Uptrend confirmed (price > 50 SMA > 200 SMA)
 * 2. Short-term momentum positive (price > 20 EMA)
 * 3. IV high enough (VIX >= 15)
 * 4. No major macro events in next 7 days
 * 5. Not within 3 days of triple witching/month-end
 * 6. Position size within limits
 */

// Default entry rules matching the strategy spec
export const DEFAULT_ENTRY_RULES: HPFEntryRules = {
  targetDte: { min: 38, max: 52, target: 45 },
  shortDelta: { min: 0.16, max: 0.25 },
  spreadWidth: [10, 15],
  minCreditPercent: 0.33,
  maxRiskPercent: 0.03,
  entryTimeWindow: { start: "10:00", end: "14:00" },
};

// Default exit rules
export const DEFAULT_EXIT_RULES: HPFExitRules = {
  profitTarget: 0.50,
  maxDteToClose: 21,
  maxLossMultiple: 2.0,
  deltaDefense: 0.40,
  vixPanicLevel: 35,
};

// Economic event interface
interface EconomicEvent {
  date: string;
  title: string;
  impact: "high" | "medium" | "low";
  country: string;
}

// Cached events from API
let cachedEconomicEvents: EconomicEvent[] = [];
let eventsCacheTimestamp = 0;
const EVENTS_CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Fetch economic events from API
 */
async function fetchEconomicEvents(): Promise<EconomicEvent[]> {
  // Return cache if fresh
  if (
    cachedEconomicEvents.length > 0 && 
    Date.now() - eventsCacheTimestamp < EVENTS_CACHE_TTL
  ) {
    return cachedEconomicEvents;
  }

  try {
    const response = await fetch("/api/odyssey/economic-calendar");
    if (!response.ok) throw new Error("Failed to fetch");
    
    const events = await response.json();
    cachedEconomicEvents = events;
    eventsCacheTimestamp = Date.now();
    return events;
  } catch (error) {
    console.error("Failed to fetch economic events:", error);
    return cachedEconomicEvents; // Return stale cache if available
  }
}

/**
 * Get OPEX dates (3rd Friday of each month) - computed locally
 */
function getOpexDates(year: number = new Date().getFullYear()): Date[] {
  const dates: Date[] = [];
  for (let month = 0; month < 12; month++) {
    const firstDay = new Date(year, month, 1);
    const firstFriday = 1 + ((5 - firstDay.getDay() + 7) % 7);
    const thirdFriday = firstFriday + 14;
    dates.push(new Date(year, month, thirdFriday));
  }
  return dates;
}

/**
 * Get Triple Witching dates (3rd Friday of Mar, Jun, Sep, Dec)
 */
function getTripleWitchingDates(year: number): Date[] {
  const opex = getOpexDates(year);
  return [opex[2], opex[5], opex[8], opex[11]];
}

export interface TechnicalIndicators {
  sma50: number;
  sma200: number;
  ema20: number;
  currentPrice: number;
}

export class HPFIndexCreditSpreadStrategy {
  public id = "hpf-ics";
  public name = "HPF Index Credit Spread";
  public description = 
    "High-probability filtered bull put spreads on index options";
  
  private entryRules: HPFEntryRules;
  private exitRules: HPFExitRules;

  constructor(
    entryRules: HPFEntryRules = DEFAULT_ENTRY_RULES,
    exitRules: HPFExitRules = DEFAULT_EXIT_RULES
  ) {
    this.entryRules = entryRules;
    this.exitRules = exitRules;
  }

  /**
   * Run the 6-filter checklist to determine if conditions are met
   */
  runChecklist(
    technicals: TechnicalIndicators,
    vix: number,
    openPositions: number = 0,
    maxPositions: number = 8
  ): HPFChecklistResult {
    const conditions: ChecklistCondition[] = [];
    const now = new Date();

    // 1. Uptrend confirmed
    const uptrendPassed = 
      technicals.currentPrice > technicals.sma50 &&
      technicals.currentPrice > technicals.sma200;
    conditions.push({
      id: "uptrend",
      name: "Uptrend Confirmed",
      description: "SPX > 50 SMA AND SPX > 200 SMA",
      passed: uptrendPassed,
      value: `Price: ${technicals.currentPrice.toFixed(2)}`,
      threshold: `50 SMA: ${technicals.sma50.toFixed(2)}, ` +
        `200 SMA: ${technicals.sma200.toFixed(2)}`,
      importance: "critical",
    });

    // 2. Short-term momentum positive
    const momentumPassed = technicals.currentPrice > technicals.ema20;
    conditions.push({
      id: "momentum",
      name: "Momentum Positive",
      description: "SPX > 20 EMA",
      passed: momentumPassed,
      value: `Price: ${technicals.currentPrice.toFixed(2)}`,
      threshold: `20 EMA: ${technicals.ema20.toFixed(2)}`,
      importance: "critical",
    });

    // 3. IV high enough (using VIX as proxy)
    const ivPassed = vix >= 15;
    conditions.push({
      id: "iv_rank",
      name: "IV Rank Sufficient",
      description: "VIX >= 15 (proxy for IV Percentile >= 45)",
      passed: ivPassed,
      value: `VIX: ${vix.toFixed(2)}`,
      threshold: "15",
      importance: "critical",
    });

    // 4. No major macro event in next 7 days
    const eventCheck = this.checkMacroEvents(now);
    conditions.push({
      id: "macro_events",
      name: "No Major Events (7 days)",
      description: "FOMC, CPI, Jobs, Triple Witching clear",
      passed: eventCheck.passed,
      value: eventCheck.nextEvent || "Clear",
      threshold: "7 days",
      importance: "important",
    });

    // 5. Not within 3 days of triple witching/month-end
    const witchingCheck = this.checkTripleWitching(now);
    conditions.push({
      id: "witching",
      name: "Triple Witching Clear",
      description: "Not within 3 days of expiration Friday",
      passed: witchingCheck.passed,
      value: witchingCheck.daysUntil !== null 
        ? `${witchingCheck.daysUntil} days until` 
        : "Clear",
      threshold: "> 3 days",
      importance: "important",
    });

    // 6. Position allocation within limits
    const allocationPassed = openPositions < maxPositions * 0.5;
    conditions.push({
      id: "allocation",
      name: "Position Allocation OK",
      description: "Open positions < 50% of max (6-8 spreads)",
      passed: allocationPassed,
      value: `${openPositions} open`,
      threshold: `< ${Math.floor(maxPositions * 0.5)} positions`,
      importance: "important",
    });

    // Calculate overall result
    const criticalPassed = conditions
      .filter((c) => c.importance === "critical")
      .every((c) => c.passed);
    const importantPassed = conditions
      .filter((c) => c.importance === "important")
      .every((c) => c.passed);
    const allPassed = conditions.every((c) => c.passed);

    let recommendation: "GO" | "NO_GO" | "CAUTION";
    let summary: string;

    if (allPassed) {
      recommendation = "GO";
      summary = "All conditions met. Safe to enter new bull put spread.";
    } else if (criticalPassed && !importantPassed) {
      recommendation = "CAUTION";
      const failedImportant = conditions
        .filter((c) => c.importance === "important" && !c.passed)
        .map((c) => c.name)
        .join(", ");
      summary = `Technical conditions met but: ${failedImportant}. ` +
        "Proceed with reduced size or wait.";
    } else {
      recommendation = "NO_GO";
      const failedCritical = conditions
        .filter((c) => c.importance === "critical" && !c.passed)
        .map((c) => c.name)
        .join(", ");
      summary = `Critical conditions failed: ${failedCritical}. ` +
        "Do not enter new positions.";
    }

    return {
      allPassed,
      conditions,
      recommendation,
      summary,
      timestamp: now,
    };
  }

  /**
   * Check for upcoming macro events (async version)
   */
  async checkMacroEventsAsync(date: Date): Promise<{ 
    passed: boolean; 
    nextEvent: string | null 
  }> {
    const checkDate = new Date(date);
    const sevenDaysLater = new Date(date);
    sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);

    // Fetch dynamic events
    const events = await fetchEconomicEvents();
    
    for (const event of events) {
      if (event.impact !== "high") continue;
      
      const eventDate = new Date(event.date);
      if (eventDate >= checkDate && eventDate <= sevenDaysLater) {
        const daysUntil = Math.ceil(
          (eventDate.getTime() - checkDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        return {
          passed: false,
          nextEvent: `${event.title} in ${daysUntil} days`,
        };
      }
    }

    return { passed: true, nextEvent: null };
  }

  /**
   * Check for upcoming macro events (sync version using cached data)
   */
  private checkMacroEvents(date: Date): { 
    passed: boolean; 
    nextEvent: string | null 
  } {
    const checkDate = new Date(date);
    const sevenDaysLater = new Date(date);
    sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);

    // Use cached events (populated by async call)
    for (const event of cachedEconomicEvents) {
      if (event.impact !== "high") continue;
      
      const eventDate = new Date(event.date);
      if (eventDate >= checkDate && eventDate <= sevenDaysLater) {
        const daysUntil = Math.ceil(
          (eventDate.getTime() - checkDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        return {
          passed: false,
          nextEvent: `${event.title} in ${daysUntil} days`,
        };
      }
    }

    return { passed: true, nextEvent: null };
  }

  /**
   * Check for triple witching proximity
   * Uses computed dates instead of hardcoded
   */
  private checkTripleWitching(date: Date): { 
    passed: boolean; 
    daysUntil: number | null 
  } {
    const checkDate = new Date(date);
    const currentYear = checkDate.getFullYear();
    
    // Get dynamically computed triple witching dates
    const tripleWitchingDates = [
      ...getTripleWitchingDates(currentYear),
      ...getTripleWitchingDates(currentYear + 1),
    ];

    for (const witch of tripleWitchingDates) {
      const diff = witch.getTime() - checkDate.getTime();
      const daysUntil = Math.ceil(diff / (1000 * 60 * 60 * 24));

      if (daysUntil >= 0 && daysUntil <= 3) {
        return { passed: false, daysUntil };
      }
    }

    // Also check month-end (last 3 trading days)
    const lastDayOfMonth = new Date(
      checkDate.getFullYear(),
      checkDate.getMonth() + 1,
      0
    );
    const daysUntilMonthEnd = Math.ceil(
      (lastDayOfMonth.getTime() - checkDate.getTime()) / 
      (1000 * 60 * 60 * 24)
    );

    if (daysUntilMonthEnd <= 3) {
      return { passed: false, daysUntil: daysUntilMonthEnd };
    }

    return { passed: true, daysUntil: null };
  }

  /**
   * Find qualifying bull put spread opportunities
   */
  async findOpportunities(
    marketData: MarketData[],
    optionsData: OptionsData[],
    checklist: HPFChecklistResult
  ): Promise<Opportunity[]> {
    // Only look for opportunities if checklist is GO or CAUTION
    if (checklist.recommendation === "NO_GO") {
      return [];
    }

    const opportunities: Opportunity[] = [];
    const spxOptions = optionsData.filter(
      (o) => o.symbol === "SPX" || o.symbol === "^SPX"
    );

    if (spxOptions.length === 0) {
      return [];
    }

    // Group by expiration
    const byExpiration = this.groupByExpiration(spxOptions);

    for (const [expiration, options] of byExpiration.entries()) {
      const dte = this.calculateDTE(expiration);

      // Check DTE range
      if (
        dte < this.entryRules.targetDte.min ||
        dte > this.entryRules.targetDte.max
      ) {
        continue;
      }

      const puts = options.filter((o) => o.type === "put");
      const spreads = this.findQualifyingBullPutSpreads(
        puts,
        expiration,
        dte
      );

      opportunities.push(...spreads);
    }

    // Sort by confidence and limit
    return opportunities
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5);
  }

  /**
   * Find bull put spreads meeting entry criteria
   */
  private findQualifyingBullPutSpreads(
    puts: OptionsData[],
    expiration: string,
    dte: number
  ): Opportunity[] {
    const opportunities: Opportunity[] = [];
    const sortedPuts = [...puts].sort((a, b) => b.strike - a.strike);

    for (const shortPut of sortedPuts) {
      // Check delta range
      const shortDelta = Math.abs(shortPut.delta || 0);
      if (
        shortDelta < this.entryRules.shortDelta.min ||
        shortDelta > this.entryRules.shortDelta.max
      ) {
        continue;
      }

      for (const width of this.entryRules.spreadWidth) {
        const longStrike = shortPut.strike - width;
        const longPut = sortedPuts.find(
          (p) => Math.abs(p.strike - longStrike) < 1
        );

        if (!longPut) continue;

        const credit = shortPut.bid - longPut.ask;
        const maxRisk = width - credit;
        const creditPercent = credit / width;

        // Check minimum credit requirement
        if (creditPercent < this.entryRules.minCreditPercent) {
          continue;
        }

        // Calculate confidence
        const confidence = this.calculateConfidence(
          shortDelta,
          creditPercent,
          dte
        );

        const details: CreditSpreadDetails = {
          direction: "bull_put",
          shortStrike: shortPut.strike,
          longStrike: longPut.strike,
          shortPrice: shortPut.bid,
          longPrice: longPut.ask,
          premium: credit,
          maxRisk,
          maxProfit: credit,
          breakEven: shortPut.strike - credit,
          spreadWidth: width,
          expiration,
          dte,
          probabilityOfProfit: Math.round((1 - shortDelta) * 100),
        };

        opportunities.push({
          id: `hpf-spx-${shortPut.strike}-${longPut.strike}-${dte}`,
          symbol: "SPX",
          strategyType: "options",
          opportunityType: "credit_spread",
          title: `SPX ${shortPut.strike}/${longPut.strike} Bull Put`,
          description: 
            `Sell ${shortPut.strike}P / Buy ${longPut.strike}P ` +
            `for $${credit.toFixed(2)} credit (${(creditPercent * 100)
              .toFixed(1)}% of width)`,
          riskReward: credit / maxRisk,
          confidence,
          timestamp: new Date(),
          details,
        });
      }
    }

    return opportunities;
  }

  /**
   * Calculate confidence score for HPF strategy
   */
  private calculateConfidence(
    delta: number,
    creditPercent: number,
    dte: number
  ): number {
    let score = 50;

    // Delta factor (prefer 16-20 delta)
    if (delta >= 0.16 && delta <= 0.20) {
      score += 20;
    } else if (delta > 0.20 && delta <= 0.25) {
      score += 10;
    }

    // Credit factor (prefer > 33% of width)
    if (creditPercent >= 0.40) {
      score += 20;
    } else if (creditPercent >= 0.33) {
      score += 15;
    }

    // DTE factor (prefer 42-48 DTE)
    if (dte >= 42 && dte <= 48) {
      score += 10;
    } else if (dte >= 38 && dte <= 52) {
      score += 5;
    }

    return Math.min(score, 100);
  }

  private calculateDTE(expiration: string): number {
    const exp = new Date(expiration);
    const today = new Date();
    return Math.ceil(
      (exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );
  }

  private groupByExpiration(
    options: OptionsData[]
  ): Map<string, OptionsData[]> {
    const grouped = new Map<string, OptionsData[]>();
    for (const opt of options) {
      const existing = grouped.get(opt.expiration) || [];
      existing.push(opt);
      grouped.set(opt.expiration, existing);
    }
    return grouped;
  }

  /**
   * Check if an open position should be closed
   */
  checkExitConditions(
    currentCredit: number,
    originalCredit: number,
    currentDte: number,
    currentShortDelta: number,
    currentVix: number
  ): {
    shouldClose: boolean;
    reason: string;
    urgency: "immediate" | "soon" | "none";
  } {
    // Rule A: 50% profit target
    const currentProfit = (originalCredit - currentCredit) / originalCredit;
    if (currentProfit >= this.exitRules.profitTarget) {
      return {
        shouldClose: true,
        reason: `Profit target reached (${(currentProfit * 100).toFixed(1)}%)`,
        urgency: "immediate",
      };
    }

    // Rule B: 21 DTE
    if (currentDte <= this.exitRules.maxDteToClose) {
      return {
        shouldClose: true,
        reason: `DTE threshold (${currentDte} days remaining)`,
        urgency: "soon",
      };
    }

    // Rule C: 2x loss stop
    const lossMultiple = currentCredit / originalCredit;
    if (lossMultiple >= this.exitRules.maxLossMultiple) {
      return {
        shouldClose: true,
        reason: `Stop loss triggered (${lossMultiple.toFixed(1)}x loss)`,
        urgency: "immediate",
      };
    }

    // Rule D: Delta defense
    if (currentShortDelta >= this.exitRules.deltaDefense) {
      return {
        shouldClose: true,
        reason: `Delta defense (short delta ${(currentShortDelta * 100)
          .toFixed(0)}%)`,
        urgency: "immediate",
      };
    }

    // Rule E: VIX panic
    if (currentVix >= this.exitRules.vixPanicLevel) {
      return {
        shouldClose: true,
        reason: `VIX panic level (${currentVix.toFixed(2)})`,
        urgency: "immediate",
      };
    }

    return { shouldClose: false, reason: "", urgency: "none" };
  }

  getEntryRules(): HPFEntryRules {
    return this.entryRules;
  }

  getExitRules(): HPFExitRules {
    return this.exitRules;
  }

  /**
   * Prefetch economic events to populate cache
   * Call this before running checklist for accurate results
   */
  async prefetchEvents(): Promise<void> {
    await fetchEconomicEvents();
  }

  /**
   * Get upcoming events for display
   */
  async getUpcomingEvents(days: number = 14): Promise<EconomicEvent[]> {
    const events = await fetchEconomicEvents();
    const now = new Date();
    const cutoff = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    
    return events.filter((e) => {
      const eventDate = new Date(e.date);
      return eventDate >= now && eventDate <= cutoff;
    });
  }

  /**
   * Get next OPEX date
   */
  getNextOpex(): Date | null {
    const now = new Date();
    const opexDates = [
      ...getOpexDates(now.getFullYear()),
      ...getOpexDates(now.getFullYear() + 1),
    ];
    
    return opexDates.find((d) => d > now) || null;
  }

  /**
   * Get next Triple Witching date
   */
  getNextTripleWitching(): Date | null {
    const now = new Date();
    const dates = [
      ...getTripleWitchingDates(now.getFullYear()),
      ...getTripleWitchingDates(now.getFullYear() + 1),
    ];
    
    return dates.find((d) => d > now) || null;
  }
}

// Singleton instance
export const hpfStrategy = new HPFIndexCreditSpreadStrategy();

// Export types and helpers
export type { EconomicEvent };
export { fetchEconomicEvents, getOpexDates, getTripleWitchingDates };

