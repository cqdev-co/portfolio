import { BaseStrategy } from "./BaseStrategy";
import {
  Opportunity,
  MarketData,
  OptionsData,
  OptionsStrategyParameters,
  DebitSpreadDetails,
} from "./types";

/**
 * Debit Spread Strategy
 * Detects bull call and bear put debit spread opportunities
 * using rigorous criteria for high-probability setups
 * 
 * Core Criteria:
 * 1. IV Rank < 30-35% (avoid expensive premium)
 * 2. DTE 30-60 days (45 sweet spot, avoid < 21)
 * 3. R:R at least 1.5:1, ideally 2:1
 * 4. Delta of long leg: 0.20-0.35
 * 5. Long strike outside expected move
 * 6. Liquidity: bid/ask ≤ $0.20, OI > 500
 */
export class DebitSpreadStrategy extends BaseStrategy<
  OptionsStrategyParameters
> {
  constructor() {
    super(
      "debit-spread",
      "Debit Spread Detector",
      "High-probability debit spreads with strict criteria: " +
        "low IV, good R:R, proper delta, sufficient liquidity",
      "options",
      {
        enabled: true,
        minDte: 21, // Avoid gamma risk < 21 DTE
        maxDte: 60,
        minRiskReward: 1.5, // At least 1.5:1
        minConfidence: 50,
        maxResults: 20,
        minIVPercentile: 0,
        maxIVPercentile: 35, // Avoid expensive IV
      }
    );
  }

  // ETFs/Indexes for different width handling
  private readonly etfSymbols = new Set([
    "SPY", "QQQ", "IWM", "DIA", "TLT", "GLD", "SLV", 
    "XLF", "XLE", "XLK", "VXX", "UVXY"
  ]);

  async detect(
    marketData: MarketData[],
    optionsData?: OptionsData[]
  ): Promise<Opportunity[]> {
    if (!optionsData || optionsData.length === 0) {
      return [];
    }

    const opportunities: Opportunity[] = [];

    // Group options by symbol and expiration
    const groupedOptions = this.groupOptionsBySymbolAndExpiration(
      optionsData
    );

    // Analyze each symbol/expiration combination
    for (const [key, options] of groupedOptions.entries()) {
      const [symbol, expiration] = key.split("|");
      const dte = this.calculateDTE(expiration);

      // CRITERIA: DTE 30-60 days (allow 21-60 with penalty)
      if (dte < this.parameters.minDte || dte > this.parameters.maxDte) {
        continue;
      }

      // Find market data for trend context and price
      const symbolData = marketData.find((m) => m.symbol === symbol);
      const currentPrice = symbolData?.price || 0;
      
      // Calculate average IV for the chain
      const avgIV = this.calculateAverageIV(options);
      
      // CRITERIA: IV Rank < 35% (we use IV as proxy)
      // Skip if IV is too high (expensive premium)
      if (avgIV > this.parameters.maxIVPercentile / 100) {
        continue;
      }

      // Calculate expected move for strike selection
      const expectedMove = this.calculateExpectedMove(
        currentPrice, avgIV, dte
      );

      // Find bull call spreads
      const bullCallSpreads = this.findBullCallSpreads(
        symbol,
        expiration,
        dte,
        options.filter((o) => o.type === "call"),
        symbolData,
        expectedMove
      );
      opportunities.push(...bullCallSpreads);

      // Find bear put spreads
      const bearPutSpreads = this.findBearPutSpreads(
        symbol,
        expiration,
        dte,
        options.filter((o) => o.type === "put"),
        symbolData,
        expectedMove
      );
      opportunities.push(...bearPutSpreads);
    }

    // Filter by confidence and limit results
    const filtered = this.filterByConfidence(opportunities);
    const sorted = this.sortByConfidence(filtered);
    return this.limitResults(sorted);
  }

  /**
   * Find bull call spread opportunities with strict criteria
   */
  private findBullCallSpreads(
    symbol: string,
    expiration: string,
    dte: number,
    calls: OptionsData[],
    marketData?: MarketData,
    expectedMove?: number
  ): Opportunity[] {
    const opportunities: Opportunity[] = [];
    const isETF = this.etfSymbols.has(symbol);
    const currentPrice = marketData?.price || 0;

    // Sort calls by strike (ascending)
    const sortedCalls = [...calls].sort((a, b) => a.strike - b.strike);

    // CRITERIA: Spread widths - 1-5 for ETFs, 2-10 for stocks
    const spreadWidths = isETF ? [1, 2, 3, 5] : [2.5, 5, 10];

    for (const longCall of sortedCalls) {
      // CRITERIA: Delta of long leg 0.20-0.35
      const longDelta = longCall.delta ?? this.estimateDelta(
        longCall.strike, currentPrice, "call"
      );
      
      if (longDelta < 0.20 || longDelta > 0.35) {
        continue;
      }

      // CRITERIA: Long strike should be outside expected move
      if (expectedMove && currentPrice) {
        const upperBound = currentPrice + expectedMove;
        if (longCall.strike < upperBound * 0.85) {
          continue; // Too close to current price
        }
      }

      // CRITERIA: Liquidity - OI > 500
      if (longCall.openInterest < 500) {
        continue;
      }

      for (const width of spreadWidths) {
        const shortStrike = longCall.strike + width;
        const shortCall = sortedCalls.find(
          (c) => Math.abs(c.strike - shortStrike) < 0.5
        );

        if (!shortCall) continue;

        // CRITERIA: Liquidity - OI > 500 for short leg too
        if (shortCall.openInterest < 500) continue;

        // Calculate spread metrics
        const netDebit = longCall.ask - shortCall.bid;
        const maxProfit = width - netDebit;
        const maxRisk = netDebit;
        const riskReward = maxRisk > 0 ? maxProfit / maxRisk : 0;

        // CRITERIA: R:R at least 1.5:1 (1.5 means profit/risk >= 1.5)
        if (riskReward < this.parameters.minRiskReward) {
          continue;
        }

        // Skip non-profitable spreads
        if (netDebit <= 0 || maxProfit <= 0) {
          continue;
        }

        // CRITERIA: Bid/ask spread ≤ $0.20
        const bidAskSpread = longCall.ask - longCall.bid;
        if (bidAskSpread > 0.20) {
          continue;
        }

        // CRITERIA: Don't pay more than 60% of width
        if (netDebit > width * 0.60) {
          continue;
        }

        // Calculate quality score based on all criteria
        const qualityScore = this.calculateQualityScore({
          riskReward,
          dte,
          iv: longCall.impliedVolatility,
          delta: longDelta,
          volume: longCall.volume + shortCall.volume,
          openInterest: Math.min(longCall.openInterest, shortCall.openInterest),
          bidAskSpread,
          trend: marketData?.changePercent,
          isBullish: true,
        });

        // Only include if quality score meets threshold
        if (qualityScore < this.parameters.minConfidence) {
          continue;
        }

        const details: DebitSpreadDetails = {
          direction: "bull_call",
          longStrike: longCall.strike,
          shortStrike: shortCall.strike,
          longPrice: longCall.ask,
          shortPrice: shortCall.bid,
          netDebit,
          maxProfit,
          maxRisk,
          breakEven: longCall.strike + netDebit,
          spreadWidth: width,
          expiration,
          dte,
          probabilityOfProfit: this.estimatePOP(longDelta, netDebit, width),
        };

        opportunities.push({
          id: this.generateOpportunityId(symbol, "bull_call"),
          symbol,
          strategyType: "options",
          opportunityType: "debit_spread",
          title: `Call Debit Spread $${longCall.strike}/$${shortCall.strike}`,
          description: this.formatDescription(
            "call", longCall.strike, shortCall.strike, 
            netDebit, maxProfit, riskReward, dte
          ),
          riskReward,
          confidence: qualityScore,
          timestamp: new Date(),
          details,
        });
      }
    }

    return opportunities;
  }

  /**
   * Find bear put spread opportunities with strict criteria
   */
  private findBearPutSpreads(
    symbol: string,
    expiration: string,
    dte: number,
    puts: OptionsData[],
    marketData?: MarketData,
    expectedMove?: number
  ): Opportunity[] {
    const opportunities: Opportunity[] = [];
    const isETF = this.etfSymbols.has(symbol);
    const currentPrice = marketData?.price || 0;

    // Sort puts by strike (descending)
    const sortedPuts = [...puts].sort((a, b) => b.strike - a.strike);

    // Spread widths - 1-5 for ETFs, 2-10 for stocks
    const spreadWidths = isETF ? [1, 2, 3, 5] : [2.5, 5, 10];

    for (const longPut of sortedPuts) {
      // CRITERIA: Delta of long leg 0.20-0.35 (absolute value)
      const longDelta = Math.abs(
        longPut.delta ?? this.estimateDelta(longPut.strike, currentPrice, "put")
      );
      
      if (longDelta < 0.20 || longDelta > 0.35) {
        continue;
      }

      // CRITERIA: Long strike should be outside expected move
      if (expectedMove && currentPrice) {
        const lowerBound = currentPrice - expectedMove;
        if (longPut.strike > lowerBound * 1.15) {
          continue; // Too close to current price
        }
      }

      // CRITERIA: Liquidity - OI > 500
      if (longPut.openInterest < 500) {
        continue;
      }

      for (const width of spreadWidths) {
        const shortStrike = longPut.strike - width;
        const shortPut = sortedPuts.find(
          (p) => Math.abs(p.strike - shortStrike) < 0.5
        );

        if (!shortPut) continue;

        // CRITERIA: Liquidity - OI > 500 for short leg too
        if (shortPut.openInterest < 500) continue;

        // Calculate spread metrics
        const netDebit = longPut.ask - shortPut.bid;
        const maxProfit = width - netDebit;
        const maxRisk = netDebit;
        const riskReward = maxRisk > 0 ? maxProfit / maxRisk : 0;

        // CRITERIA: R:R at least 1.5:1
        if (riskReward < this.parameters.minRiskReward) {
          continue;
        }

        // Skip non-profitable spreads
        if (netDebit <= 0 || maxProfit <= 0) {
          continue;
        }

        // CRITERIA: Bid/ask spread ≤ $0.20
        const bidAskSpread = longPut.ask - longPut.bid;
        if (bidAskSpread > 0.20) {
          continue;
        }

        // CRITERIA: Don't pay more than 60% of width
        if (netDebit > width * 0.60) {
          continue;
        }

        // Calculate quality score
        const qualityScore = this.calculateQualityScore({
          riskReward,
          dte,
          iv: longPut.impliedVolatility,
          delta: longDelta,
          volume: longPut.volume + shortPut.volume,
          openInterest: Math.min(longPut.openInterest, shortPut.openInterest),
          bidAskSpread,
          trend: marketData?.changePercent,
          isBullish: false,
        });

        // Only include if quality score meets threshold
        if (qualityScore < this.parameters.minConfidence) {
          continue;
        }

        const details: DebitSpreadDetails = {
          direction: "bear_put",
          longStrike: longPut.strike,
          shortStrike: shortPut.strike,
          longPrice: longPut.ask,
          shortPrice: shortPut.bid,
          netDebit,
          maxProfit,
          maxRisk,
          breakEven: longPut.strike - netDebit,
          spreadWidth: width,
          expiration,
          dte,
          probabilityOfProfit: this.estimatePOP(longDelta, netDebit, width),
        };

        opportunities.push({
          id: this.generateOpportunityId(symbol, "bear_put"),
          symbol,
          strategyType: "options",
          opportunityType: "debit_spread",
          title: `Put Debit Spread $${longPut.strike}/$${shortPut.strike}`,
          description: this.formatDescription(
            "put", longPut.strike, shortPut.strike,
            netDebit, maxProfit, riskReward, dte
          ),
          riskReward,
          confidence: qualityScore,
          timestamp: new Date(),
          details,
        });
      }
    }

    return opportunities;
  }

  /**
   * Format description with key info
   */
  private formatDescription(
    type: "call" | "put",
    longStrike: number,
    shortStrike: number,
    netDebit: number,
    maxProfit: number,
    riskReward: number,
    dte: number
  ): string {
    const typeChar = type === "call" ? "C" : "P";
    return `Buy ${longStrike}${typeChar} / Sell ${shortStrike}${typeChar} @ ` +
      `$${netDebit.toFixed(2)} | Max: $${(maxProfit * 100).toFixed(0)} | ` +
      `R:R ${riskReward.toFixed(1)}:1 | ${dte}d`;
  }

  /**
   * Calculate quality score (0-100) based on all criteria
   * Higher score = better setup
   */
  private calculateQualityScore(params: {
    riskReward: number;
    dte: number;
    iv: number;
    delta: number;
    volume: number;
    openInterest: number;
    bidAskSpread: number;
    trend?: number;
    isBullish: boolean;
  }): number {
    let score = 0;
    let criteriaCount = 0;

    // 1. IV low (< 30%) - 15 points
    if (params.iv < 0.20) {
      score += 15;
    } else if (params.iv < 0.30) {
      score += 12;
    } else if (params.iv < 0.35) {
      score += 8;
    }
    criteriaCount++;

    // 2. DTE in sweet spot (30-60, ideal 45) - 15 points
    if (params.dte >= 40 && params.dte <= 50) {
      score += 15; // Sweet spot
    } else if (params.dte >= 30 && params.dte <= 60) {
      score += 12; // Good range
    } else if (params.dte >= 21 && params.dte <= 75) {
      score += 6; // Acceptable
    }
    criteriaCount++;

    // 3. R:R excellent - 20 points
    if (params.riskReward >= 2.0) {
      score += 20; // Excellent
    } else if (params.riskReward >= 1.8) {
      score += 16;
    } else if (params.riskReward >= 1.5) {
      score += 12;
    }
    criteriaCount++;

    // 4. Delta in range (0.20-0.35) - 15 points
    if (params.delta >= 0.25 && params.delta <= 0.30) {
      score += 15; // Ideal
    } else if (params.delta >= 0.20 && params.delta <= 0.35) {
      score += 12; // Good
    }
    criteriaCount++;

    // 5. Good liquidity - 15 points
    const liquidityScore = 
      (params.openInterest >= 1000 ? 7 : params.openInterest >= 500 ? 4 : 0) +
      (params.volume >= 100 ? 5 : params.volume >= 50 ? 3 : 0) +
      (params.bidAskSpread <= 0.10 ? 3 : params.bidAskSpread <= 0.20 ? 1 : 0);
    score += liquidityScore;
    criteriaCount++;

    // 6. Trend alignment - 10 points
    if (params.trend !== undefined) {
      const trendAligned = 
        (params.isBullish && params.trend > 0) ||
        (!params.isBullish && params.trend < 0);
      
      if (trendAligned) {
        const strength = Math.abs(params.trend);
        if (strength > 1.0) score += 10;
        else if (strength > 0.5) score += 7;
        else score += 4;
      }
    }
    criteriaCount++;

    // Normalize to 0-100
    const maxScore = 90; // Sum of all max points
    return Math.round((score / maxScore) * 100);
  }

  /**
   * Calculate average IV for the options chain
   */
  private calculateAverageIV(options: OptionsData[]): number {
    const ivValues = options
      .map((o) => o.impliedVolatility)
      .filter((iv) => iv > 0);
    
    if (ivValues.length === 0) return 0.3; // Default 30%
    
    return ivValues.reduce((a, b) => a + b, 0) / ivValues.length;
  }

  /**
   * Calculate expected move based on IV and DTE
   * EM = Price × IV × sqrt(DTE/365)
   */
  private calculateExpectedMove(
    price: number,
    iv: number,
    dte: number
  ): number {
    if (price <= 0 || iv <= 0) return 0;
    return price * iv * Math.sqrt(dte / 365);
  }

  /**
   * Estimate delta when not provided
   * Uses simplified approximation based on moneyness
   */
  private estimateDelta(
    strike: number,
    currentPrice: number,
    type: "call" | "put"
  ): number {
    if (currentPrice <= 0) return 0.5;
    
    const moneyness = strike / currentPrice;
    
    if (type === "call") {
      // OTM call: delta decreases as strike increases
      if (moneyness > 1.10) return 0.15;
      if (moneyness > 1.05) return 0.25;
      if (moneyness > 1.02) return 0.35;
      if (moneyness > 0.98) return 0.50;
      return 0.65;
    } else {
      // OTM put: delta increases (absolute) as strike decreases
      if (moneyness < 0.90) return 0.15;
      if (moneyness < 0.95) return 0.25;
      if (moneyness < 0.98) return 0.35;
      if (moneyness < 1.02) return 0.50;
      return 0.65;
    }
  }

  /**
   * Estimate probability of profit for debit spreads
   */
  private estimatePOP(
    longDelta: number,
    netDebit: number,
    spreadWidth: number
  ): number {
    // POP is roughly the delta adjusted for debit ratio
    const debitRatio = netDebit / spreadWidth;
    const adjusted = longDelta * (1 - debitRatio * 0.3);
    return Math.round(Math.max(adjusted, 0.1) * 100);
  }

  /**
   * Calculate days to expiration
   */
  private calculateDTE(expiration: string): number {
    const expDate = new Date(expiration);
    const today = new Date();
    const diff = expDate.getTime() - today.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  /**
   * Group options by symbol and expiration
   */
  private groupOptionsBySymbolAndExpiration(
    options: OptionsData[]
  ): Map<string, OptionsData[]> {
    const grouped = new Map<string, OptionsData[]>();

    for (const option of options) {
      const key = `${option.symbol}|${option.expiration}`;
      const existing = grouped.get(key) || [];
      existing.push(option);
      grouped.set(key, existing);
    }

    return grouped;
  }

  /**
   * Validate options-specific parameters
   */
  validateParameters(
    parameters: OptionsStrategyParameters
  ): boolean {
    if (!super.validateParameters(parameters)) {
      return false;
    }

    if (
      parameters.minDte < 1 ||
      parameters.maxDte < parameters.minDte
    ) {
      return false;
    }

    if (parameters.minRiskReward < 1.0) {
      return false;
    }

    return true;
  }
}
