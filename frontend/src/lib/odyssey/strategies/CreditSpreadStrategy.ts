import { BaseStrategy } from "./BaseStrategy";
import {
  Opportunity,
  MarketData,
  OptionsData,
  OptionsStrategyParameters,
  CreditSpreadDetails,
} from "./types";

/**
 * Credit Spread Strategy
 * Detects bull put and bear call credit spread opportunities
 * based on risk/reward ratio and other configurable parameters
 */
export class CreditSpreadStrategy extends BaseStrategy<
  OptionsStrategyParameters
> {
  constructor() {
    super(
      "credit-spread",
      "Credit Spread Detector",
      "Identifies high-probability credit spread opportunities " +
        "with favorable risk/reward ratios",
      "options",
      {
        enabled: true,
        minDte: 3,
        maxDte: 45,
        minRiskReward: 3.0, // 3:1 means R:R >= 0.33 (typical for credit spreads)
        minConfidence: 50,
        maxResults: 20,
        minIVPercentile: 30,
        maxIVPercentile: 70,
      }
    );
  }

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

      // Skip if outside DTE range
      if (
        dte < this.parameters.minDte ||
        dte > this.parameters.maxDte
      ) {
        continue;
      }
      
      // Get current price for OTM filtering
      const symbolData = marketData.find((m) => m.symbol === symbol);
      // If no market data, estimate price from options (ATM strike)
      const currentPrice = symbolData?.price || 
        this.estimatePriceFromOptions(options);
      
      const puts = options.filter((o) => o.type === "put");
      const calls = options.filter((o) => o.type === "call");

      // Find bull put spreads (sell higher put, buy lower put)
      const bullPutSpreads = this.findBullPutSpreads(
        symbol,
        expiration,
        dte,
        puts,
        currentPrice
      );
      opportunities.push(...bullPutSpreads);

      // Find bear call spreads (sell lower call, buy higher call)
      const bearCallSpreads = this.findBearCallSpreads(
        symbol,
        expiration,
        dte,
        calls,
        currentPrice
      );
      opportunities.push(...bearCallSpreads);
    }

    // Filter by confidence and limit results
    const filtered = this.filterByConfidence(opportunities);
    const sorted = this.sortByConfidence(filtered);
    return this.limitResults(sorted);
  }

  /**
   * Find bull put spread opportunities
   * Sell higher strike put, buy lower strike put
   * Short put must be OTM (below current price)
   */
  private findBullPutSpreads(
    symbol: string,
    expiration: string,
    dte: number,
    puts: OptionsData[],
    currentPrice: number
  ): Opportunity[] {
    const opportunities: Opportunity[] = [];

    if (puts.length === 0) return opportunities;

    // Sort puts by strike (descending)
    const sortedPuts = [...puts].sort(
      (a, b) => b.strike - a.strike
    );

    // Try combinations with standard spread widths
    const spreadWidths = [1, 2, 5, 10];

    for (const shortPut of sortedPuts) {
      // CRITICAL: Short put must be OTM (below current price)
      // Allow small buffer (5%) for near-the-money
      if (currentPrice > 0 && shortPut.strike > currentPrice * 0.95) {
        continue; // Skip ITM or ATM puts
      }

      for (const width of spreadWidths) {
        const longStrike = shortPut.strike - width;
        const longPut = sortedPuts.find(
          (p) => Math.abs(p.strike - longStrike) < 1
        );

        if (!longPut) continue;

        // Use ACTUAL spread width, not target width
        const actualWidth = shortPut.strike - longPut.strike;
        
        // Calculate spread metrics with actual width
        const premium = shortPut.bid - longPut.ask;
        const maxRisk = actualWidth - premium;
        const maxProfit = premium;
        const riskReward = maxRisk > 0 ? maxProfit / maxRisk : 0;

        // Skip if not profitable
        if (premium <= 0 || maxProfit <= 0) continue;
        
        // CRITERIA: Premium should be at least 33% of spread width
        const premiumRatio = premium / actualWidth;
        if (premiumRatio < 0.33) continue;
        
        // Check if meets minimum R:R threshold
        const minRR = 1 / this.parameters.minRiskReward;
        if (riskReward < minRR) continue;

        // Calculate confidence score (capped at realistic levels)
        const confidence = Math.min(
          this.calculateConfidence({
            riskReward: 1 / riskReward,
            dte,
            iv: shortPut.impliedVolatility,
            volume: shortPut.volume + longPut.volume,
            delta: Math.abs(shortPut.delta || 0),
          }),
          85 // Cap at 85% - no trade is >85% confident
        );

        const details: CreditSpreadDetails = {
          direction: "bull_put",
          shortStrike: shortPut.strike,
          longStrike: longPut.strike,
          shortPrice: shortPut.bid,
          longPrice: longPut.ask,
          premium,
          maxRisk,
          maxProfit,
          breakEven: shortPut.strike - premium,
          spreadWidth: actualWidth,
          expiration,
          dte,
          probabilityOfProfit: this.estimatePOP(
            Math.abs(shortPut.delta || 0.5)
          ),
        };

        opportunities.push({
          id: this.generateOpportunityId(symbol, "bull_put"),
          symbol,
          strategyType: "options",
          opportunityType: "credit_spread",
          title: `Put Credit Spread $${shortPut.strike}/$${longPut.strike}`,
          description: `Sell ${shortPut.strike}P / Buy ${longPut.strike}P @ $${premium.toFixed(2)} | ` +
            `Max: $${(maxProfit * 100).toFixed(0)} | Risk: $${(maxRisk * 100).toFixed(0)} | ${dte}d`,
          riskReward: 1 / riskReward,
          confidence,
          timestamp: new Date(),
          details,
        });
      }
    }

    return opportunities;
  }

  /**
   * Find bear call spread opportunities
   * Sell lower strike call, buy higher call
   * Short call must be OTM (above current price)
   */
  private findBearCallSpreads(
    symbol: string,
    expiration: string,
    dte: number,
    calls: OptionsData[],
    currentPrice: number
  ): Opportunity[] {
    const opportunities: Opportunity[] = [];

    // Sort calls by strike (ascending)
    const sortedCalls = [...calls].sort(
      (a, b) => a.strike - b.strike
    );

    // Try combinations with standard spread widths
    const spreadWidths = [5, 10, 15, 20];

    for (const shortCall of sortedCalls) {
      // CRITICAL: Short call must be OTM (above current price)
      // Allow small buffer (5%) for near-the-money
      if (currentPrice > 0 && shortCall.strike < currentPrice * 1.05) {
        continue; // Skip ITM or ATM calls
      }

      for (const width of spreadWidths) {
        const longStrike = shortCall.strike + width;
        const longCall = sortedCalls.find(
          (c) => Math.abs(c.strike - longStrike) < 1
        );

        if (!longCall) continue;

        // Use ACTUAL spread width, not target width
        const actualWidth = longCall.strike - shortCall.strike;

        // Calculate spread metrics with actual width
        const premium = shortCall.bid - longCall.ask;
        const maxRisk = actualWidth - premium;
        const maxProfit = premium;
        const riskReward = maxRisk > 0 ? maxProfit / maxRisk : 0;

        // Skip if not profitable
        if (premium <= 0 || maxProfit <= 0) continue;
        
        // CRITERIA: Premium should be at least 33% of spread width
        const premiumRatio = premium / actualWidth;
        if (premiumRatio < 0.33) continue;
        
        // Check if meets minimum R:R threshold
        const minRR = 1 / this.parameters.minRiskReward;
        if (riskReward < minRR) continue;

        // Calculate confidence score (capped at realistic levels)
        const confidence = Math.min(
          this.calculateConfidence({
            riskReward: 1 / riskReward,
            dte,
            iv: shortCall.impliedVolatility,
            volume: shortCall.volume + longCall.volume,
            delta: Math.abs(shortCall.delta || 0),
          }),
          85 // Cap at 85% - no trade is >85% confident
        );

        const details: CreditSpreadDetails = {
          direction: "bear_call",
          shortStrike: shortCall.strike,
          longStrike: longCall.strike,
          shortPrice: shortCall.bid,
          longPrice: longCall.ask,
          premium,
          maxRisk,
          maxProfit,
          breakEven: shortCall.strike + premium,
          spreadWidth: actualWidth,
          expiration,
          dte,
          probabilityOfProfit: this.estimatePOP(
            1 - Math.abs(shortCall.delta || 0.5)
          ),
        };

        opportunities.push({
          id: this.generateOpportunityId(symbol, "bear_call"),
          symbol,
          strategyType: "options",
          opportunityType: "credit_spread",
          title: `Call Credit Spread $${shortCall.strike}/$${longCall.strike}`,
          description: `Sell ${shortCall.strike}C / Buy ${longCall.strike}C @ $${premium.toFixed(2)} | ` +
            `Max: $${(maxProfit * 100).toFixed(0)} | Risk: $${(maxRisk * 100).toFixed(0)} | ${dte}d`,
          riskReward: 1 / riskReward,
          confidence,
          timestamp: new Date(),
          details,
        });
      }
    }

    return opportunities;
  }

  /**
   * Calculate confidence score (0-100)
   */
  private calculateConfidence(params: {
    riskReward: number;
    dte: number;
    iv: number;
    volume: number;
    delta: number;
  }): number {
    let score = 50; // Base score

    // Risk/reward factor (0-25 points)
    // Higher R:R = higher confidence
    const rrScore = Math.min(
      (params.riskReward / this.parameters.minRiskReward) * 25,
      25
    );
    score += rrScore;

    // DTE factor (0-15 points)
    // Prefer 21-30 DTE range
    const dteFactor = 
      Math.abs(params.dte - 25) <= 5 ? 15 : 
      Math.abs(params.dte - 25) <= 10 ? 10 : 5;
    score += dteFactor;

    // Volume factor (0-10 points)
    const volumeFactor = Math.min(
      (params.volume / 1000) * 10,
      10
    );
    score += volumeFactor;

    // Delta factor (0-10 points)
    // Prefer delta between 0.15 and 0.35 (higher POP)
    const deltaFactor = 
      params.delta >= 0.15 && params.delta <= 0.35 ? 10 :
      params.delta >= 0.10 && params.delta <= 0.40 ? 5 : 0;
    score += deltaFactor;

    return Math.min(Math.round(score), 100);
  }

  /**
   * Estimate probability of profit based on delta
   */
  private estimatePOP(delta: number): number {
    // For credit spreads, POP ≈ 1 - |delta|
    return Math.round((1 - Math.abs(delta)) * 100);
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
   * Estimate current stock price from options chain
   * Uses the strike where call and put prices are closest (ATM)
   */
  private estimatePriceFromOptions(options: OptionsData[]): number {
    const calls = options.filter((o) => o.type === "call");
    const puts = options.filter((o) => o.type === "put");
    
    if (calls.length === 0 || puts.length === 0) return 0;
    
    // Find strike where call mid-price ≈ put mid-price (ATM)
    let bestStrike = 0;
    let smallestDiff = Infinity;
    
    for (const call of calls) {
      const put = puts.find((p) => p.strike === call.strike);
      if (!put) continue;
      
      const callMid = (call.bid + call.ask) / 2;
      const putMid = (put.bid + put.ask) / 2;
      const diff = Math.abs(callMid - putMid);
      
      if (diff < smallestDiff) {
        smallestDiff = diff;
        bestStrike = call.strike;
      }
    }
    
    // If we found a good ATM strike, use it
    if (bestStrike > 0) return bestStrike;
    
    // Fallback: use middle strike of available options
    const allStrikes = [...new Set(options.map((o) => o.strike))].sort(
      (a, b) => a - b
    );
    return allStrikes[Math.floor(allStrikes.length / 2)] || 0;
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

    if (parameters.minDte < 1 || parameters.maxDte < parameters.minDte) {
      return false;
    }

    if (parameters.minRiskReward < 0.5) {
      return false;
    }

    return true;
  }
}

