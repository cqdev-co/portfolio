/**
 * AgentSession - Unified AI Agent Session Management
 *
 * Provides a consistent API for both CLI and Frontend to interact with
 * the AI trading assistant. Encapsulates:
 * - Context building (calendar, market regime, ticker data)
 * - Conversation history management
 * - Tool execution
 * - Message summarization for long conversations
 *
 * @example CLI usage:
 * ```typescript
 * import { AgentSession } from '@lib/ai-agent';
 *
 * const session = new AgentSession({ accountSize: 1750 });
 * await session.initialize();
 *
 * const response = await session.chat("How does NVDA look?");
 * console.log(response.content);
 * ```
 *
 * @example Frontend usage:
 * ```typescript
 * import { AgentSession } from '@lib/ai-agent';
 *
 * const session = new AgentSession({ accountSize: 1500, streaming: true });
 * await session.initialize();
 *
 * for await (const chunk of session.streamChat("Find me some setups")) {
 *   console.log(chunk);
 * }
 * ```
 */

import {
  getCalendarContext,
  formatCalendarForAI,
  type CalendarContext,
} from '../calendar';
import {
  getMarketRegime,
  formatRegimeForAI,
  type MarketRegime,
} from '../market';
import { buildVictorSystemPrompt, buildVictorLitePrompt } from '../prompts';
import { AGENT_TOOLS, toOllamaTools, type AgentTool } from '../tools';
import { executeToolCall, type ToolCall, type ToolResult } from '../handlers';
import {
  classifyQuestion,
  extractTickers,
  type QuestionClassification,
} from '../classification';
import { fetchTickerData, type TickerData } from '../data';
import {
  encodeTickerToTOON,
  encodeMarketRegimeToTOON,
  encodeCalendarToTOON,
} from '../toon';
import { sessionCache, CacheKeys } from '../cache';
import { log } from '../utils';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Message in the conversation history
 */
export interface SessionMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  timestamp: Date;
}

/**
 * Session configuration options
 */
export interface SessionConfig {
  /** Trading account size in dollars */
  accountSize?: number;

  /** Use lite prompt for faster responses */
  liteMode?: boolean;

  /** Maximum messages before summarization kicks in */
  maxHistoryLength?: number;

  /** Enable TOON encoding for token efficiency */
  useTOON?: boolean;

  /** Custom tools to use (defaults to AGENT_TOOLS) */
  tools?: AgentTool[];

  /** Ollama API key for web search */
  ollamaApiKey?: string;

  /** Supabase credentials for unusual options */
  supabaseUrl?: string;
  supabaseKey?: string;

  /** Callback for status updates */
  onStatus?: (message: string) => void;

  /** Callback for tool results */
  onToolResult?: (tool: string, result: ToolResult) => void;
}

/**
 * Response from the chat method
 */
export interface ChatResponse {
  content: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  classification?: QuestionClassification;
  tokensUsed?: number;
}

/**
 * Market context for the session
 */
export interface MarketContext {
  calendar: CalendarContext;
  regime: MarketRegime | null;
  formattedCalendar: string;
  formattedRegime: string;
  warnings: string[];
}

/**
 * Ticker context for the session
 */
export interface TickerContext {
  ticker: string;
  data: TickerData;
  formatted: string;
}

// ============================================================================
// CONTEXT BUILDER
// ============================================================================

/**
 * Builds context for AI prompts
 */
export class ContextBuilder {
  private useTOON: boolean;
  private cachedMarketContext: MarketContext | null = null;
  private marketContextExpiry: number = 0;
  private readonly MARKET_CONTEXT_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(useTOON: boolean = true) {
    this.useTOON = useTOON;
  }

  /**
   * Get market context (calendar + regime)
   */
  async getMarketContext(): Promise<MarketContext> {
    const now = Date.now();

    // Return cached if still valid
    if (this.cachedMarketContext && now < this.marketContextExpiry) {
      log.debug('[ContextBuilder] Using cached market context');
      return this.cachedMarketContext;
    }

    log.debug('[ContextBuilder] Building fresh market context');

    // Fetch calendar and regime in parallel
    const [calendar, regime] = await Promise.all([
      Promise.resolve(getCalendarContext()),
      getMarketRegime().catch(() => null),
    ]);

    // Build formatted strings
    const formattedCalendar = this.useTOON
      ? encodeCalendarToTOON()
      : formatCalendarForAI();

    const formattedRegime = regime
      ? this.useTOON
        ? encodeMarketRegimeToTOON(regime)
        : formatRegimeForAI(regime)
      : '';

    // Collect warnings
    const warnings: string[] = [...calendar.warnings];
    if (regime?.regime === 'HIGH_VOL') {
      warnings.push('⚠️ High volatility regime - reduce position sizes');
    }
    if (regime?.regime === 'RISK_OFF') {
      warnings.push('⚠️ Risk-off market regime - exercise extra caution');
    }

    this.cachedMarketContext = {
      calendar,
      regime,
      formattedCalendar,
      formattedRegime,
      warnings,
    };
    this.marketContextExpiry = now + this.MARKET_CONTEXT_TTL;

    return this.cachedMarketContext;
  }

  /**
   * Get ticker context
   */
  async getTickerContext(ticker: string): Promise<TickerContext | null> {
    const cacheKey = CacheKeys.ticker(ticker);
    const cached = sessionCache.get<TickerContext>(cacheKey);

    if (cached) {
      log.debug(`[ContextBuilder] Using cached ticker context for ${ticker}`);
      return cached;
    }

    log.debug(`[ContextBuilder] Fetching ticker data for ${ticker}`);
    const data = await fetchTickerData(ticker);

    if (!data) {
      return null;
    }

    const formatted = this.useTOON
      ? encodeTickerToTOON(data)
      : JSON.stringify(data, null, 2);

    const context: TickerContext = { ticker, data, formatted };
    sessionCache.set(cacheKey, context, 60000); // 1 minute TTL

    return context;
  }

  /**
   * Build full context for system prompt
   */
  async buildFullContext(tickers: string[] = []): Promise<string> {
    const parts: string[] = [];

    // Market context
    const marketContext = await this.getMarketContext();

    if (marketContext.warnings.length > 0) {
      parts.push('=== MARKET WARNINGS ===');
      marketContext.warnings.forEach((w) => parts.push(w));
      parts.push('');
    }

    if (marketContext.formattedCalendar) {
      parts.push(marketContext.formattedCalendar);
    }

    if (marketContext.formattedRegime) {
      parts.push(marketContext.formattedRegime);
    }

    // Ticker context (if any)
    for (const ticker of tickers) {
      const tickerContext = await this.getTickerContext(ticker);
      if (tickerContext) {
        parts.push(`\n=== ${ticker} DATA ===`);
        parts.push(tickerContext.formatted);
      }
    }

    return parts.join('\n');
  }

  /**
   * Clear cached context
   */
  clearCache(): void {
    this.cachedMarketContext = null;
    this.marketContextExpiry = 0;
    sessionCache.clear();
  }
}

// ============================================================================
// CONVERSATION MANAGER
// ============================================================================

/**
 * Manages conversation history with summarization
 */
export class ConversationManager {
  private messages: SessionMessage[] = [];
  private maxLength: number;
  private summarizedContext: string = '';

  constructor(maxLength: number = 20) {
    this.maxLength = maxLength;
  }

  /**
   * Add a message to history
   */
  addMessage(message: Omit<SessionMessage, 'timestamp'>): void {
    this.messages.push({
      ...message,
      timestamp: new Date(),
    });

    // Check if we need to summarize
    if (this.messages.length > this.maxLength) {
      this.summarize();
    }
  }

  /**
   * Get conversation history formatted for AI
   */
  getHistory(): SessionMessage[] {
    return [...this.messages];
  }

  /**
   * Get history as Ollama-compatible messages
   */
  getOllamaMessages(): Array<{ role: string; content: string }> {
    return this.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));
  }

  /**
   * Get summarized context (for long conversations)
   */
  getSummarizedContext(): string {
    return this.summarizedContext;
  }

  /**
   * Summarize older messages to reduce token count
   */
  private summarize(): void {
    // Keep the most recent messages, summarize the rest
    const keepCount = Math.floor(this.maxLength / 2);
    const toSummarize = this.messages.slice(0, -keepCount);
    const toKeep = this.messages.slice(-keepCount);

    if (toSummarize.length === 0) return;

    // Build summary
    const summaryParts: string[] = ['Previous conversation summary:'];

    // Extract key topics and tickers mentioned
    const tickers = new Set<string>();
    const topics: string[] = [];

    for (const msg of toSummarize) {
      // Extract tickers from content
      const tickerMatches = msg.content.match(/\b[A-Z]{2,5}\b/g) || [];
      tickerMatches.forEach((t) => {
        if (
          ['NVDA', 'AAPL', 'GOOGL', 'MSFT', 'AMD', 'TSLA', 'META'].includes(t)
        ) {
          tickers.add(t);
        }
      });

      // Track tool usage
      if (msg.toolResults) {
        msg.toolResults.forEach((r) => {
          if (r.success) {
            topics.push(`Used tool successfully`);
          }
        });
      }
    }

    if (tickers.size > 0) {
      summaryParts.push(`Discussed tickers: ${Array.from(tickers).join(', ')}`);
    }

    if (topics.length > 0) {
      summaryParts.push(`Actions: ${topics.slice(0, 3).join('; ')}`);
    }

    this.summarizedContext = summaryParts.join('\n');
    this.messages = toKeep;

    log.debug(
      `[ConversationManager] Summarized ${toSummarize.length} messages, ` +
        `keeping ${toKeep.length}`
    );
  }

  /**
   * Clear conversation history
   */
  clear(): void {
    this.messages = [];
    this.summarizedContext = '';
  }

  /**
   * Get message count
   */
  get length(): number {
    return this.messages.length;
  }
}

// ============================================================================
// AGENT SESSION
// ============================================================================

/**
 * AgentSession - Main class for AI agent interactions
 */
export class AgentSession {
  private config: Required<SessionConfig>;
  private contextBuilder: ContextBuilder;
  private conversationManager: ConversationManager;
  private initialized: boolean = false;
  private systemPrompt: string = '';

  constructor(config: SessionConfig = {}) {
    this.config = {
      accountSize: config.accountSize ?? 1500,
      liteMode: config.liteMode ?? false,
      maxHistoryLength: config.maxHistoryLength ?? 20,
      useTOON: config.useTOON ?? true,
      tools: config.tools ?? AGENT_TOOLS,
      ollamaApiKey: config.ollamaApiKey ?? process.env.OLLAMA_API_KEY ?? '',
      supabaseUrl: config.supabaseUrl ?? process.env.SUPABASE_URL ?? '',
      supabaseKey:
        config.supabaseKey ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
      onStatus: config.onStatus ?? (() => {}),
      onToolResult: config.onToolResult ?? (() => {}),
    };

    this.contextBuilder = new ContextBuilder(this.config.useTOON);
    this.conversationManager = new ConversationManager(
      this.config.maxHistoryLength
    );
  }

  /**
   * Initialize the session with market context
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    log.debug('[AgentSession] Initializing...');

    // Build initial context
    const marketContext = await this.contextBuilder.getMarketContext();

    // Build system prompt
    if (this.config.liteMode) {
      this.systemPrompt = buildVictorLitePrompt({
        accountSize: this.config.accountSize,
        withTools: true,
      });
    } else {
      // Full prompt needs context - will be added below
      this.systemPrompt = buildVictorSystemPrompt({
        accountSize: this.config.accountSize,
        context: '', // Will be populated in the next section
      });
    }

    // Add market context to system prompt
    if (marketContext.formattedCalendar || marketContext.formattedRegime) {
      this.systemPrompt += '\n\n=== CURRENT MARKET CONTEXT ===\n';

      if (marketContext.warnings.length > 0) {
        this.systemPrompt += 'WARNINGS:\n';
        marketContext.warnings.forEach((w) => {
          this.systemPrompt += `  ${w}\n`;
        });
        this.systemPrompt += '\n';
      }

      if (marketContext.formattedCalendar) {
        this.systemPrompt += marketContext.formattedCalendar + '\n';
      }

      if (marketContext.formattedRegime) {
        this.systemPrompt += marketContext.formattedRegime + '\n';
      }

      this.systemPrompt += '=== END CONTEXT ===';
    }

    this.initialized = true;
    log.debug('[AgentSession] Initialized successfully');
  }

  /**
   * Get the current system prompt
   */
  getSystemPrompt(): string {
    return this.systemPrompt;
  }

  /**
   * Get tools in Ollama format
   */
  getOllamaTools() {
    return toOllamaTools(this.config.tools);
  }

  /**
   * Classify a user message
   */
  classifyMessage(message: string): QuestionClassification {
    return classifyQuestion(message);
  }

  /**
   * Extract tickers from a message
   */
  extractTickers(message: string): string[] {
    return extractTickers(message);
  }

  /**
   * Execute a tool call
   */
  async executeTool(toolCall: ToolCall): Promise<ToolResult> {
    this.config.onStatus?.(`Executing ${toolCall.name}...`);

    const result = await executeToolCall(toolCall, {
      apiKey: this.config.ollamaApiKey,
      supabaseUrl: this.config.supabaseUrl,
      supabaseKey: this.config.supabaseKey,
      format: this.config.useTOON ? 'toon' : 'text',
      onStatus: this.config.onStatus,
      onToolResult: this.config.onToolResult,
    });

    return result;
  }

  /**
   * Add a user message and get context for the AI
   */
  async prepareContext(userMessage: string): Promise<{
    systemPrompt: string;
    messages: Array<{ role: string; content: string }>;
    classification: QuestionClassification;
    tickers: string[];
  }> {
    // Classify the question
    const classification = this.classifyMessage(userMessage);
    const tickers = this.extractTickers(userMessage);

    log.debug(
      `[AgentSession] Classification: ${classification.type}, Tickers: ${tickers.join(', ')}`
    );

    // Build dynamic context if needed
    let contextAddition = '';

    // Fetch ticker data if tickers are mentioned
    if (tickers.length > 0) {
      for (const ticker of tickers) {
        const tickerContext =
          await this.contextBuilder.getTickerContext(ticker);
        if (tickerContext) {
          contextAddition += `\n\n=== ${ticker} DATA ===\n${tickerContext.formatted}`;
        }
      }
    }

    // Get summarized context if we have one
    const summarized = this.conversationManager.getSummarizedContext();
    if (summarized) {
      contextAddition = `\n\n${summarized}` + contextAddition;
    }

    // Build messages array
    const messages = [
      ...this.conversationManager.getOllamaMessages(),
      { role: 'user', content: userMessage },
    ];

    // Add user message to history
    this.conversationManager.addMessage({
      role: 'user',
      content: userMessage,
    });

    return {
      systemPrompt: this.systemPrompt + contextAddition,
      messages,
      classification,
      tickers,
    };
  }

  /**
   * Add an assistant response to history
   */
  addAssistantMessage(
    content: string,
    toolCalls?: ToolCall[],
    toolResults?: ToolResult[]
  ): void {
    this.conversationManager.addMessage({
      role: 'assistant',
      content,
      toolCalls,
      toolResults,
    });
  }

  /**
   * Get current market context
   */
  async getMarketContext(): Promise<MarketContext> {
    return this.contextBuilder.getMarketContext();
  }

  /**
   * Get ticker data
   */
  async getTickerData(ticker: string): Promise<TickerData | null> {
    const context = await this.contextBuilder.getTickerContext(ticker);
    return context?.data ?? null;
  }

  /**
   * Clear session state
   */
  clear(): void {
    this.conversationManager.clear();
    this.contextBuilder.clearCache();
  }

  /**
   * Get conversation history
   */
  getHistory(): SessionMessage[] {
    return this.conversationManager.getHistory();
  }

  /**
   * Get message count
   */
  get messageCount(): number {
    return this.conversationManager.length;
  }

  /**
   * Check if session is initialized
   */
  get isInitialized(): boolean {
    return this.initialized;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default AgentSession;
