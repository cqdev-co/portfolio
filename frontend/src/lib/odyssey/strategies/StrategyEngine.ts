import { 
  Strategy, 
  Opportunity,
  MarketData,
  OptionsData,
  SectorData,
  StrategyEngineResult
} from "./types";

/**
 * Central orchestrator for all trading strategies
 * Manages strategy registration, execution, and result aggregation
 */
export class StrategyEngine {
  private strategies: Map<string, Strategy>;

  constructor() {
    this.strategies = new Map();
  }

  /**
   * Register a strategy with the engine
   */
  registerStrategy(strategy: Strategy): void {
    if (this.strategies.has(strategy.id)) {
      console.warn(
        `Strategy ${strategy.id} already registered, overwriting`
      );
    }
    this.strategies.set(strategy.id, strategy);
  }

  /**
   * Unregister a strategy
   */
  unregisterStrategy(strategyId: string): void {
    this.strategies.delete(strategyId);
  }

  /**
   * Get all registered strategies
   */
  getStrategies(): Strategy[] {
    return Array.from(this.strategies.values());
  }

  /**
   * Get a specific strategy by ID
   */
  getStrategy(strategyId: string): Strategy | undefined {
    return this.strategies.get(strategyId);
  }

  /**
   * Execute all enabled strategies in parallel
   */
  async executeAll(
    marketData: MarketData[],
    optionsData?: OptionsData[],
    sectorData?: SectorData[]
  ): Promise<StrategyEngineResult> {
    const startTime = Date.now();
    const enabledStrategies = this.getStrategies().filter(
      (s) => s.parameters.enabled
    );

    if (enabledStrategies.length === 0) {
      return {
        opportunities: [],
        executionTime: Date.now() - startTime,
        errors: [],
      };
    }

    // Execute all strategies in parallel
    const results = await Promise.allSettled(
      enabledStrategies.map((strategy) =>
        strategy.detect(marketData, optionsData, sectorData)
      )
    );

    // Aggregate results and errors
    const opportunities: Opportunity[] = [];
    const errors: Array<{ strategyId: string; error: string }> = [];

    results.forEach((result, index) => {
      const strategy = enabledStrategies[index];
      
      if (result.status === "fulfilled") {
        opportunities.push(...result.value);
      } else {
        console.error(
          `Strategy ${strategy.id} failed:`,
          result.reason
        );
        errors.push({
          strategyId: strategy.id,
          error: result.reason?.message || "Unknown error",
        });
      }
    });

    // Deduplicate opportunities
    const uniqueOpportunities = this.deduplicateOpportunities(
      opportunities
    );

    // Sort by confidence
    const sortedOpportunities = uniqueOpportunities.sort(
      (a, b) => b.confidence - a.confidence
    );

    return {
      opportunities: sortedOpportunities,
      executionTime: Date.now() - startTime,
      errors,
    };
  }

  /**
   * Execute a specific strategy by ID
   */
  async executeStrategy(
    strategyId: string,
    marketData: MarketData[],
    optionsData?: OptionsData[],
    sectorData?: SectorData[]
  ): Promise<Opportunity[]> {
    const strategy = this.strategies.get(strategyId);
    
    if (!strategy) {
      throw new Error(`Strategy ${strategyId} not found`);
    }

    if (!strategy.parameters.enabled) {
      console.warn(
        `Strategy ${strategyId} is disabled, skipping execution`
      );
      return [];
    }

    return strategy.detect(marketData, optionsData, sectorData);
  }

  /**
   * Deduplicate opportunities based on symbol and type
   * Keep the one with highest confidence
   */
  private deduplicateOpportunities(
    opportunities: Opportunity[]
  ): Opportunity[] {
    const map = new Map<string, Opportunity>();

    for (const opp of opportunities) {
      const key = `${opp.symbol}-${opp.opportunityType}`;
      const existing = map.get(key);

      if (!existing || opp.confidence > existing.confidence) {
        map.set(key, opp);
      }
    }

    return Array.from(map.values());
  }

  /**
   * Clear all registered strategies
   */
  clearStrategies(): void {
    this.strategies.clear();
  }

  /**
   * Get summary statistics
   */
  getSummary() {
    const strategies = this.getStrategies();
    return {
      total: strategies.length,
      enabled: strategies.filter((s) => s.parameters.enabled).length,
      disabled: strategies.filter((s) => !s.parameters.enabled).length,
      byType: strategies.reduce((acc, s) => {
        acc[s.strategyType] = (acc[s.strategyType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };
  }
}

// Singleton instance
export const strategyEngine = new StrategyEngine();

