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
 *   buildXyloSystemPrompt,
 *   AGENT_TOOLS,
 *   toOllamaTools,
 *   classifyQuestion
 * } from '@lib/ai-agent';
 *
 * const tools = toOllamaTools(AGENT_TOOLS);
 * const classification = classifyQuestion(userMessage);
 * const systemPrompt = buildXyloSystemPrompt({
 *   accountSize: 1750,
 *   context: await buildContext(classification),
 * });
 *
 * // Frontend usage (lite)
 * import { buildXyloLitePrompt } from '@lib/ai-agent';
 *
 * const systemPrompt = buildXyloLitePrompt({ accountSize: 1500 });
 * ```
 *
 * @packageDocumentation
 */

// ============================================================================
// PROMPTS
// ============================================================================

export {
  // Main builders
  buildXyloSystemPrompt,
  buildXyloLitePrompt,
  buildXyloMinimalPrompt,

  // Building blocks
  XYLO_PERSONA,
  TRADING_STRATEGY,
  TOON_DECODER_SPEC,
  TOOL_INSTRUCTIONS,
  DATA_RULES,
  RESPONSE_STYLE,
  buildKeyRules,
  buildTradingStrategy,

  // Position analysis prompts
  buildPositionAnalysisPrompt,
  buildSpreadAnalysisPrompt,
  buildPortfolioAdvisorPrompt,
  getSpreadTypeGuidance,

  // Types
  type XyloPromptConfig,
  type XyloLiteConfig,
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
  GET_IV_BY_STRIKE_TOOL,
  CALCULATE_SPREAD_TOOL,

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
  hasAnyRequiredSignal,

  // Phase 1: deterministic signal-bundle map
  QUESTION_CLASS_TO_SIGNALS,

  // Types
  type QuestionType,
  type QuestionClassification,
  type SignalKey,
  type SignalRequirements,
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
  // PFV types (from shared library)
  type PFVSummary,
  type ConfidenceLevel,
  type BiasSentiment,
  type MagneticLevel,
  type PFVComponentBreakdown,
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
  handleGetIVByStrike,
  handleCalculateSpread,
  // Phase 1 handlers
  handleGetSectorFlow,
  handleGetRecentNews,
  handleGetSentiment,
  handleGetEarningsCalendar,
  handleGetGeopoliticalEvents,

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
  type IVByStrikeToolResult,
  type SpreadCalculationToolResult,
  // Phase 1 result types
  type SectorFlowToolResult,
  type RecentNewsToolResult,
  type SentimentToolResult,
  type EarningsCalendarToolResult,
  type GeopoliticalEventsToolResult,
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

  // Unusual options encoder
  encodeUnusualOptionsToTOON,

  // Phase 1: news encoder
  encodeRecentNewsToTOON,

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

// ============================================================================
// SESSION CACHE
// ============================================================================

export {
  // Main cache instance
  sessionCache,

  // Cache configuration
  CACHE_TTL,
  CacheKeys,

  // Cache class (for custom instances)
  SessionCache,
} from './cache';

// ============================================================================
// CALENDAR (Economic Events)
// ============================================================================

export {
  // Main functions
  getCalendarContext,
  getUpcomingEvents,
  formatCalendarForAI,

  // TOON encoder
  encodeCalendarToTOON,

  // Types
  type EventType,
  type MarketEvent,
  type CalendarContext,
} from './calendar';

// ============================================================================
// SCANNER (Trade Opportunities)
// ============================================================================

export {
  // Scan functions
  quickScan,
  fullScan,

  // Scan lists
  SCAN_LISTS,

  // Grading
  gradeTradeOpportunity,
  gradeAtLeast,
  GRADE_RUBRIC,
  getGradeRubric,

  // Risk scoring
  calculateRiskScore,

  // Formatters
  formatScanResultsForAI,
  encodeScanResultsToTOON as encodeScanToTOON,

  // Types
  type TradeGrade as ScannerTradeGrade,
  type GradingCriteria,
  type TradeGradeResult,
  type RiskFactor,
  type RiskScore,
  type ScanResult,
  type ScanOptions,
} from './scanner';

// ============================================================================
// SESSION (Unified API for CLI & Frontend)
// ============================================================================

export {
  // Main class
  AgentSession,

  // Context building
  ContextBuilder,

  // Conversation management
  ConversationManager,

  // Types
  type SessionMessage,
  type SessionConfig,
  type ChatResponse,
  type MarketContext,
  type TickerContext,
} from './session';

// ============================================================================
// UTILITIES
// ============================================================================

export {
  // Logger (DEBUG mode support)
  log,
} from './utils';

// ============================================================================
// CONFIDENCE (Phase 2: 0-10 score over coverage + risk + signals)
// ============================================================================

export {
  computeConfidence,
  type ConfidenceScore,
  type ConfidenceComponents,
  type ComputeConfidenceInput,
} from './confidence';

// ============================================================================
// EVALS (Phase 2: regression / hallucination / tool-routing harness)
// ============================================================================

export {
  runEvalSuite,
  loadScenarios,
  loadProbes,
  loadRoutingTests,
  scoreScenario,
  scoreProbe,
  scoreRouting,
  type AgentInvoker,
  type AgentRunOutput,
  type EvalFixture,
  type EvalKind,
  type EvalResult,
  type EvalRun,
  type Scenario,
  type Probe,
  type RoutingTest,
} from './evals';

// ============================================================================
// RISK GATE (Phase 2: runtime validation of trade calls)
// ============================================================================

export {
  // Parser (hybrid: regex + optional model fallback)
  parseRecommendation,
  parseRecommendationRegex,
  parseRecommendationViaModel,
  // Gate
  validateRecommendation,
  skipGate,
  // Types
  type ParseOptions,
  type ParsedRecommendation,
  type ParsedSpread,
  type TradeAction,
  type RiskViolation,
  type RiskVerdict,
  type RiskRule,
  type ValidateInput,
} from './risk';

// ============================================================================
// PREFLIGHT (Phase 1: deterministic context fan-out)
// ============================================================================

export {
  // Main entry
  runPreflight,
  serializeCoverage,

  // Types
  type PreflightOptions,
  type PreflightResult,
  type CoverageReport,
  type CoverageError,
  type SignalLatency,
} from './preflight';

// ============================================================================
// DECISION LOG
// ============================================================================

export {
  // Writer + helper
  logDecision,
  hashPrompt,

  // Types
  type DecisionSource,
  type PromptVariant,
  type DecisionToolCall,
  type LogDecisionInput,
  type LogDecisionOptions,
} from './logging';

// ============================================================================
// STRATEGY CONFIG (Single Source of Truth)
// ============================================================================

export {
  // Main config loader
  getStrategyConfig,
  clearConfigCache,
  setConfigPath,

  // Section getters
  getEntryConfig,
  getExitConfig,
  getPositionSizingConfig,
  getSpreadParamsConfig,
  getRiskManagementConfig,
  getMarketRegimeConfig,
  getLessonsLearned,

  // Position size helpers
  getMaxPositionSize,
  getSpreadWidth,

  // Exit rule helpers
  shouldCloseOnProfit,
  shouldCloseOnDTE,
  checkPinRisk,
  getExitRecommendation,

  // Entry validation helpers
  isRSIValid,
  isCushionValid,
  isEarningsSafe,

  // Types
  type StrategyConfig,
  type EntryConfig,
  type ExitConfig,
  type PositionSizingConfig,
  type SpreadParamsConfig,
  type RiskManagementConfig,
  type MarketRegimeConfig,
  type LessonReference,
} from './config';
