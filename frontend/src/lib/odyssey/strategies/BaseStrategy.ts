import { 
  Strategy, 
  StrategyParameters, 
  Opportunity,
  MarketData,
  OptionsData,
  SectorData,
  StrategyType
} from "./types";

/**
 * Abstract base class for all trading strategies
 * Provides common functionality and enforces interface implementation
 */
export abstract class BaseStrategy<
  T extends StrategyParameters = StrategyParameters
> implements Strategy<T> {
  public id: string;
  public name: string;
  public description: string;
  public strategyType: StrategyType;
  public parameters: T;

  constructor(
    id: string,
    name: string,
    description: string,
    strategyType: StrategyType,
    defaultParameters: T
  ) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.strategyType = strategyType;
    this.parameters = defaultParameters;
  }

  /**
   * Main detection method - must be implemented by child classes
   */
  abstract detect(
    marketData: MarketData[],
    optionsData?: OptionsData[],
    sectorData?: SectorData[]
  ): Promise<Opportunity[]>;

  /**
   * Validate parameters - can be overridden by child classes
   */
  validateParameters(parameters: T): boolean {
    if (!parameters.enabled !== undefined && 
      typeof parameters.enabled !== "boolean") {
      return false;
    }
    
    if (parameters.minConfidence !== undefined && 
      (parameters.minConfidence < 0 || parameters.minConfidence > 100)) {
      return false;
    }
    
    if (parameters.maxResults !== undefined && 
      parameters.maxResults < 1) {
      return false;
    }
    
    return true;
  }

  /**
   * Update strategy parameters
   */
  updateParameters(parameters: Partial<T>): void {
    const newParams = { ...this.parameters, ...parameters };
    if (this.validateParameters(newParams)) {
      this.parameters = newParams;
    } else {
      throw new Error(
        `Invalid parameters for strategy ${this.id}`
      );
    }
  }

  /**
   * Check if strategy is enabled
   */
  isEnabled(): boolean {
    return this.parameters.enabled;
  }

  /**
   * Filter opportunities by confidence threshold
   */
  protected filterByConfidence(
    opportunities: Opportunity[]
  ): Opportunity[] {
    if (!this.parameters.minConfidence) {
      return opportunities;
    }
    
    return opportunities.filter(
      (opp) => opp.confidence >= this.parameters.minConfidence!
    );
  }

  /**
   * Limit results to max results
   */
  protected limitResults(
    opportunities: Opportunity[]
  ): Opportunity[] {
    if (!this.parameters.maxResults) {
      return opportunities;
    }
    
    return opportunities.slice(0, this.parameters.maxResults);
  }

  /**
   * Sort opportunities by confidence (descending)
   */
  protected sortByConfidence(
    opportunities: Opportunity[]
  ): Opportunity[] {
    return [...opportunities].sort(
      (a, b) => b.confidence - a.confidence
    );
  }

  /**
   * Generate unique opportunity ID
   */
  protected generateOpportunityId(
    symbol: string,
    type: string
  ): string {
    return `${this.id}-${symbol}-${type}-${Date.now()}`;
  }
}

