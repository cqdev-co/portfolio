/**
 * Risk gate barrel — `lib/ai-agent/risk/`
 *
 * Phase 2: runtime validator over `strategy.config.yaml`. See
 * `gate.ts` for `validateRecommendation` and `parser.ts` for the
 * hybrid trade-call extractor.
 */

export {
  parseRecommendation,
  parseRecommendationRegex,
  parseRecommendationViaModel,
  type ParseOptions,
} from './parser';

export { validateRecommendation, skipGate } from './gate';

export type {
  ParsedRecommendation,
  ParsedSpread,
  TradeAction,
  RiskViolation,
  RiskVerdict,
  RiskRule,
  ValidateInput,
} from './types';
