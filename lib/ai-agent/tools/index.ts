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
  
  // Converters
  toOllamaTools,
  getToolByName,
  filterTools,
  
  // Types
  type AgentTool,
  type OllamaTool,
  type ToolParameter,
} from './definitions';

