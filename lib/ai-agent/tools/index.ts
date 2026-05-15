/**
 * AI Agent Tools
 *
 * Shared tool definitions for CLI and Frontend AI agents.
 */

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
  GET_TRADING_REGIME_TOOL,
  GET_IV_BY_STRIKE_TOOL,
  CALCULATE_SPREAD_TOOL,
  GET_SECTOR_FLOW_TOOL,
  GET_RECENT_NEWS_TOOL,
  GET_SENTIMENT_TOOL,
  GET_EARNINGS_CALENDAR_TOOL,
  GET_GEOPOLITICAL_EVENTS_TOOL,

  // Converters
  toOllamaTools,
  getToolByName,
  filterTools,

  // Types
  type AgentTool,
  type OllamaTool,
  type ToolParameter,
} from './definitions';
