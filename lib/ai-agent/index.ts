/**
 * AI Agent - Shared Logic for CLI and Frontend
 *
 * This library provides shared components for building AI trading
 * assistants that work across different runtime environments:
 *
 * - CLI (ai-analyst): Full-featured with tool calling
 * - Frontend (portfolio): Lightweight chat integration
 *
 * @example
 * ```typescript
 * // CLI usage (full context)
 * import {
 *   buildVictorSystemPrompt,
 *   AGENT_TOOLS,
 *   toOllamaTools,
 *   classifyQuestion
 * } from '@lib/ai-agent';
 *
 * const tools = toOllamaTools(AGENT_TOOLS);
 * const classification = classifyQuestion(userMessage);
 * const systemPrompt = buildVictorSystemPrompt({
 *   accountSize: 1750,
 *   context: await buildContext(classification),
 * });
 *
 * // Frontend usage (lite)
 * import { buildVictorLitePrompt } from '@lib/ai-agent';
 *
 * const systemPrompt = buildVictorLitePrompt({ accountSize: 1500 });
 * ```
 *
 * @packageDocumentation
 */

// ============================================================================
// PROMPTS
// ============================================================================

export {
  // Main builders
  buildVictorSystemPrompt,
  buildVictorLitePrompt,
  buildVictorMinimalPrompt,

  // Building blocks
  VICTOR_PERSONA,
  TRADING_STRATEGY,
  TOON_DECODER_SPEC,
  TOOL_INSTRUCTIONS,
  POSITION_ANALYSIS_INSTRUCTIONS,
  DATA_RULES,
  RESPONSE_STYLE,
  buildKeyRules,

  // Position analysis prompts
  buildPositionAnalysisPrompt,
  buildSpreadAnalysisPrompt,
  buildPortfolioAdvisorPrompt,
  getSpreadTypeGuidance,

  // Types
  type VictorPromptConfig,
  type VictorLiteConfig,
  type PositionPromptConfig,
  type SpreadPromptConfig,
  type PortfolioPromptConfig,
} from './prompts';

// ============================================================================
// TOOLS
// ============================================================================

export {
  // Tool collections
  AGENT_TOOLS,
  RESEARCH_TOOLS,
  BASIC_TOOLS,

  // Individual tools
  WEB_SEARCH_TOOL,
  GET_TICKER_DATA_TOOL,
  GET_FINANCIALS_DEEP_TOOL,
  GET_INSTITUTIONAL_HOLDINGS_TOOL,
  GET_UNUSUAL_OPTIONS_TOOL,

  // Converters
  toOllamaTools,
  getToolByName,
  filterTools,

  // Types
  type AgentTool,
  type OllamaTool,
  type ToolParameter,
} from './tools';

// ============================================================================
// CLASSIFICATION
// ============================================================================

export {
  // Main function
  classifyQuestion,
  extractTickers,

  // Helpers
  needsMarketData,
  needsTools,

  // Types
  type QuestionType,
  type QuestionClassification,
} from './classification';

// ============================================================================
// DATA FETCHING
// ============================================================================

export {
  // Data fetching (Yahoo with Polygon fallback)
  fetchTickerData,
  clearYahooCache,
  isYahooRateLimited,
  fetchTickerDataFromPolygon,

  // Cloudflare Worker proxy
  isProxyConfigured,
  checkProxyHealth,

  // Formatters
  formatTickerDataForAI,
  formatSearchResultsForAI,
  formatTickerSummary,

  // Technical helpers
  calculateRSI,
  calculateADX,
  getTrendStrength,
  checkDataStaleness,

  // Types
  type TickerData,
  type SpreadRecommendation,
  type IVAnalysis,
  type TradeGrade,
  type NewsItem,
  type DataQuality,
  type AnalystRatings,
  type TargetPrices,
  type PricePerformance,
  type SectorContext,
  type ShortInterest,
  type OptionsFlow,
  type RelativeStrength,
  type EarningsHistory,
  type SearchResult,
  // New financial types
  type IncomeStatement,
  type BalanceSheet,
  type CashFlow,
  type FinancialsDeep,
  type InstitutionalHolder,
  type InstitutionalHoldings,
  type UnusualOptionsSignal,
  type UnusualOptionsActivity,
} from './data';

// ============================================================================
// TOOL HANDLERS
// ============================================================================

export {
  // Individual handlers
  handleGetTickerData,
  handleWebSearch,
  handleGetFinancialsDeep,
  handleGetInstitutionalHoldings,
  handleGetUnusualOptionsActivity,

  // Unified executor
  executeToolCall,

  // Types
  type ToolCall,
  type ToolExecutorOptions,
  type ToolResult,
  type TickerToolResult,
  type SearchToolResult,
  type FinancialsToolResult,
  type HoldingsToolResult,
  type UnusualOptionsToolResult,
  type OutputFormat,
} from './handlers';

// ============================================================================
// TOON ENCODING (40% fewer tokens, 74% accuracy vs JSON's 70%)
// ============================================================================

export {
  // Ticker encoders
  encodeTickerToTOON,
  encodeTickersToTOON,
  encodeTickerTableToTOON, // Most efficient for multiple tickers

  // Search encoder
  encodeSearchToTOON,

  // Market regime encoder
  encodeMarketRegimeToTOON,

  // Scan results encoder
  encodeScanResultsToTOON,

  // Generic encoder
  encodeTOON,

  // System prompt helper
  getTOONDecoderSpec,
} from './toon';

// ============================================================================
// OPTIONS (REAL DATA)
// ============================================================================

export {
  // Chain fetching
  getOptionsChain,

  // IV analysis (REAL from ATM options)
  getIVAnalysis,

  // Spread recommendations (REAL from bid/ask)
  findOptimalSpread,
  findSpreadWithAlternatives,

  // Types
  type OptionContract,
  type OptionsChain,
  type SpreadAlternatives,
  type SpreadSelectionContext,
  // Note: SpreadRecommendation and IVAnalysis are already exported from data
} from './options';

// ============================================================================
// PSYCHOLOGICAL FAIR VALUE (PFV)
// ============================================================================

export {
  // Main function (SAME as CLI uses)
  getPsychologicalFairValue,

  // Helpers
  getKeyMagneticLevels,
  extractWallsFromPFV,
  formatPFVResult,

  // Types
  type PsychologicalFairValue,
  type PFVServiceOptions,
  type TickerProfileType,
} from './pfv';

// ============================================================================
// MARKET REGIME
// ============================================================================

export {
  // Main function
  getMarketRegime,

  // Individual data fetchers
  getVIXData,
  getSPYTrend,
  getSectorPerformance,

  // Formatters
  formatRegimeForAI,
  getRegimeBadge,

  // Types
  type MarketRegime,
  type MarketRegimeType,
  type VIXLevel,
  type VIXData,
  type SPYTrend,
  type SectorPerformance,
} from './market';
