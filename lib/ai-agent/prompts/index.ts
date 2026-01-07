/**
 * AI Agent Prompts
 *
 * Shared system prompts for CLI and Frontend AI agents.
 */

export {
  // Main builders
  buildVictorSystemPrompt,
  buildVictorLitePrompt,
  buildVictorMinimalPrompt,

  // Building blocks (for customization)
  VICTOR_PERSONA,
  TRADING_STRATEGY,
  TOON_DECODER_SPEC,
  TOOL_INSTRUCTIONS,
  POSITION_ANALYSIS_INSTRUCTIONS,
  DATA_RULES,
  RESPONSE_STYLE,

  // Utilities
  buildKeyRules,

  // Types
  type VictorPromptConfig,
  type VictorLiteConfig,
} from './victor';

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
