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
 * const tools = AGENT_TOOLS.filter(t => t.name !== 'get_financials_deep');
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
    type: 'object';
    required?: string[];
    properties: Record<string, ToolParameter>;
  };
}

/**
 * Ollama tool format
 */
export interface OllamaTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
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
  name: 'web_search',
  description:
    'Search the web for current news, market analysis, or any ' +
    'information not in the provided data. Use this when asked to ' +
    'research, look up news, or find out why a stock is moving.',
  parameters: {
    type: 'object',
    required: ['query'],
    properties: {
      query: {
        type: 'string',
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
  name: 'get_ticker_data',
  description:
    'Fetch real-time stock data for a ticker including price, ' +
    'RSI, moving averages, IV, options flow, and news. Use when ' +
    'analyzing a specific stock.',
  parameters: {
    type: 'object',
    required: ['ticker'],
    properties: {
      ticker: {
        type: 'string',
        description: 'Stock ticker symbol (e.g. NVDA, AAPL, TSLA)',
      },
    },
  },
};

/**
 * Get financials deep - fetch detailed financial statements
 */
export const GET_FINANCIALS_DEEP_TOOL: AgentTool = {
  name: 'get_financials_deep',
  description:
    'Fetch detailed financial statements including income statement, ' +
    'balance sheet, and cash flow data. Use when analyzing a ' +
    "company's fundamentals, profitability, debt, or cash position.",
  parameters: {
    type: 'object',
    required: ['ticker'],
    properties: {
      ticker: {
        type: 'string',
        description: 'Stock ticker symbol (e.g. NVDA, AAPL, TSLA)',
      },
    },
  },
};

/**
 * Get institutional holdings - fetch 13F institutional ownership data
 */
export const GET_INSTITUTIONAL_HOLDINGS_TOOL: AgentTool = {
  name: 'get_institutional_holdings',
  description:
    'Fetch institutional ownership data including top holders, ' +
    'ownership percentage, and recent position changes. Use when ' +
    'analyzing who owns the stock and institutional sentiment.',
  parameters: {
    type: 'object',
    required: ['ticker'],
    properties: {
      ticker: {
        type: 'string',
        description: 'Stock ticker symbol (e.g. NVDA, AAPL, TSLA)',
      },
    },
  },
};

/**
 * Get unusual options activity - fetch signals from Supabase
 */
export const GET_UNUSUAL_OPTIONS_TOOL: AgentTool = {
  name: 'get_unusual_options_activity',
  description:
    'Fetch unusual options activity signals from the database. Shows ' +
    'large block trades, sweeps, and volume anomalies that may ' +
    'indicate institutional positioning. Can filter by ticker or get ' +
    'all recent high-grade signals.',
  parameters: {
    type: 'object',
    required: [],
    properties: {
      ticker: {
        type: 'string',
        description:
          'Optional: Filter to specific ticker (e.g. NVDA). ' +
          'If not provided, returns top signals across all tickers.',
      },
      minGrade: {
        type: 'string',
        description:
          'Minimum signal grade to return (S, A, B, C, D). ' +
          "Defaults to 'B' if not specified.",
        enum: ['S', 'A', 'B', 'C', 'D'],
      },
      limit: {
        type: 'number',
        description: 'Maximum number of signals to return. Defaults to 10.',
      },
    },
  },
};

/**
 * Get trading regime - analyze if market conditions favor trading
 */
export const GET_TRADING_REGIME_TOOL: AgentTool = {
  name: 'get_trading_regime',
  description:
    'Analyze current market conditions to determine if trading is ' +
    'advisable. Returns GO (favorable), CAUTION (reduced sizing), or ' +
    'NO_TRADE (preserve cash). Detects choppy markets, signal conflicts, ' +
    'and high volatility. Use BEFORE suggesting any trades to check if ' +
    'market conditions support new entries.',
  parameters: {
    type: 'object',
    required: [],
    properties: {
      ticker: {
        type: 'string',
        description:
          'Optional: Include ticker-specific data (RSI, earnings) in ' +
          'the regime analysis. If not provided, analyzes market-wide ' +
          'conditions only.',
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
  GET_FINANCIALS_DEEP_TOOL,
  GET_INSTITUTIONAL_HOLDINGS_TOOL,
  GET_UNUSUAL_OPTIONS_TOOL,
  GET_TRADING_REGIME_TOOL,
];

/**
 * Tools for research/analysis
 */
export const RESEARCH_TOOLS: AgentTool[] = [
  WEB_SEARCH_TOOL,
  GET_TICKER_DATA_TOOL,
  GET_FINANCIALS_DEEP_TOOL,
  GET_INSTITUTIONAL_HOLDINGS_TOOL,
];

/**
 * Minimal tools for basic queries
 */
export const BASIC_TOOLS: AgentTool[] = [WEB_SEARCH_TOOL, GET_TICKER_DATA_TOOL];

// ============================================================================
// CONVERTERS
// ============================================================================

/**
 * Convert generic tool definitions to Ollama SDK format
 */
export function toOllamaTools(tools: AgentTool[]): OllamaTool[] {
  return tools.map((tool) => ({
    type: 'function' as const,
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
  return AGENT_TOOLS.find((t) => t.name === name);
}

/**
 * Filter tools by names
 */
export function filterTools(names: string[]): AgentTool[] {
  const nameSet = new Set(names);
  return AGENT_TOOLS.filter((t) => nameSet.has(t.name));
}

// ============================================================================
// EXPORTS
// ============================================================================

/**
 * Tools for regime/conditions checking
 */
export const REGIME_TOOLS: AgentTool[] = [GET_TRADING_REGIME_TOOL];

export default {
  AGENT_TOOLS,
  RESEARCH_TOOLS,
  BASIC_TOOLS,
  REGIME_TOOLS,
  WEB_SEARCH_TOOL,
  GET_TICKER_DATA_TOOL,
  GET_FINANCIALS_DEEP_TOOL,
  GET_INSTITUTIONAL_HOLDINGS_TOOL,
  GET_UNUSUAL_OPTIONS_TOOL,
  GET_TRADING_REGIME_TOOL,
  toOllamaTools,
  getToolByName,
  filterTools,
};
