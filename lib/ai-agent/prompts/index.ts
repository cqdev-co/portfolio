/**
 * AI Agent Prompts
 *
 * Shared system prompts for CLI and Frontend AI agents.
 * Now uses strategy.config.yaml for trading rules.
 */

export {
  // Main builders
  buildXyloSystemPrompt,
  buildXyloLitePrompt,
  buildXyloMinimalPrompt,

  // Building blocks (for customization)
  XYLO_PERSONA,
  TRADING_STRATEGY,
  TOON_DECODER_SPEC,
  TOOL_INSTRUCTIONS,
  DATA_RULES,
  RESPONSE_STYLE,

  // Utilities
  buildKeyRules,
  buildTradingStrategy,

  // Types
  type XyloPromptConfig,
  type XyloLiteConfig,
} from './xylo';

// Position analysis prompts
export {
  buildPositionAnalysisPrompt,
  buildSpreadAnalysisPrompt,
  buildPortfolioAdvisorPrompt,
  getSpreadTypeGuidance,
  type PositionPromptConfig,
  type SpreadPromptConfig,
  type PortfolioPromptConfig,
} from './positions';
