/**
 * AI Agent Tool Definitions
 * 
 * Shared tool schemas that work with both Ollama SDK and Vercel AI SDK.
 * Tool handlers are implemented separately in each runtime environment.
 * 
 * @example
 * ```typescript
 * import { AGENT_TOOLS, toOllamaTools } from '@lib/ai-agent/tools';
 * 
 * // For Ollama SDK (CLI)
 * const ollamaTools = toOllamaTools(AGENT_TOOLS);
 * 
 * // For custom implementation
 * const tools = AGENT_TOOLS.filter(t => t.name !== 'scan_for_opportunities');
 * ```
 */

// ============================================================================
// TYPES
// ============================================================================

/**
 * Generic tool parameter definition
 */
export interface ToolParameter {
  type: string;
  description: string;
  enum?: string[];
}

/**
 * Generic tool definition (SDK-agnostic)
 */
export interface AgentTool {
  name: string;
  description: string;
  parameters: {
    type: "object";
    required?: string[];
    properties: Record<string, ToolParameter>;
  };
}

/**
 * Ollama tool format
 */
export interface OllamaTool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      required?: string[];
      properties: Record<string, ToolParameter>;
    };
  };
}

// ============================================================================
// TOOL DEFINITIONS
// ============================================================================

/**
 * Web search tool - search the internet for current information
 */
export const WEB_SEARCH_TOOL: AgentTool = {
  name: "web_search",
  description: 
    "Search the web for current news, market analysis, or any " +
    "information not in the provided data. Use this when asked to " +
    "research, look up news, or find out why a stock is moving.",
  parameters: {
    type: "object",
    required: ["query"],
    properties: {
      query: {
        type: "string",
        description: 
          "The search query - be specific (e.g. 'NVDA stock " +
          "news today', 'FOMC meeting December 2024 impact')",
      },
    },
  },
};

/**
 * Get ticker data tool - fetch real-time stock data
 */
export const GET_TICKER_DATA_TOOL: AgentTool = {
  name: "get_ticker_data",
  description: 
    "Fetch real-time stock data for a ticker including price, " +
    "RSI, moving averages, options spreads, and news. Use when " +
    "analyzing a specific stock.",
  parameters: {
    type: "object",
    required: ["ticker"],
    properties: {
      ticker: {
        type: "string",
        description: "Stock ticker symbol (e.g. NVDA, AAPL, TSLA)",
      },
    },
  },
};

/**
 * Scan for opportunities tool - find trade setups
 */
export const SCAN_OPPORTUNITIES_TOOL: AgentTool = {
  name: "scan_for_opportunities",
  description: 
    "Scan the market for trade opportunities matching our " +
    "Deep ITM Call Debit Spread criteria. Returns graded setups.",
  parameters: {
    type: "object",
    required: [],
    properties: {},
  },
};

/**
 * Analyze position tool - evaluate existing spread positions
 */
export const ANALYZE_POSITION_TOOL: AgentTool = {
  name: "analyze_position",
  description: 
    "Analyze an existing call debit spread position. Use this when " +
    "the user asks about a position they already hold, whether to " +
    "close/hold/roll, or for P&L calculations. Provides accurate " +
    "profit calculations and recommendations. ALWAYS use this tool " +
    "for position math - never calculate spread P&L manually.",
  parameters: {
    type: "object",
    required: ["ticker", "longStrike", "shortStrike", "costBasis", "dte"],
    properties: {
      ticker: {
        type: "string",
        description: "Stock ticker symbol (e.g. NVDA, AAPL)",
      },
      longStrike: {
        type: "number",
        description: "The long (lower) strike price of the call spread",
      },
      shortStrike: {
        type: "number",
        description: "The short (higher) strike price of the call spread",
      },
      costBasis: {
        type: "number",
        description: 
          "Original debit paid per share (e.g., 3.62 for a $362 debit)",
      },
      currentValue: {
        type: "number",
        description: 
          "Current mid price of the spread per share (optional - " +
          "will estimate if not provided)",
      },
      dte: {
        type: "number",
        description: "Days to expiration",
      },
    },
  },
};

// ============================================================================
// TOOL COLLECTIONS
// ============================================================================

/**
 * All available agent tools
 */
export const AGENT_TOOLS: AgentTool[] = [
  WEB_SEARCH_TOOL,
  GET_TICKER_DATA_TOOL,
  SCAN_OPPORTUNITIES_TOOL,
  ANALYZE_POSITION_TOOL,
];

/**
 * Tools for research/analysis (no scanning)
 */
export const RESEARCH_TOOLS: AgentTool[] = [
  WEB_SEARCH_TOOL,
  GET_TICKER_DATA_TOOL,
  ANALYZE_POSITION_TOOL,
];

/**
 * Minimal tools for basic queries
 */
export const BASIC_TOOLS: AgentTool[] = [
  WEB_SEARCH_TOOL,
  GET_TICKER_DATA_TOOL,
];

// ============================================================================
// CONVERTERS
// ============================================================================

/**
 * Convert generic tool definitions to Ollama SDK format
 */
export function toOllamaTools(tools: AgentTool[]): OllamaTool[] {
  return tools.map(tool => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}

/**
 * Get tool by name
 */
export function getToolByName(name: string): AgentTool | undefined {
  return AGENT_TOOLS.find(t => t.name === name);
}

/**
 * Filter tools by names
 */
export function filterTools(names: string[]): AgentTool[] {
  const nameSet = new Set(names);
  return AGENT_TOOLS.filter(t => nameSet.has(t.name));
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  AGENT_TOOLS,
  RESEARCH_TOOLS,
  BASIC_TOOLS,
  toOllamaTools,
  getToolByName,
  filterTools,
};

