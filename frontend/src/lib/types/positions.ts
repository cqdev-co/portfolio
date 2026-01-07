/**
 * Position & Spread Types (Frontend)
 *
 * Re-exports types from lib/types/positions.ts for frontend use.
 * This file exists to provide a clean import path for frontend components.
 */

export type {
  PositionType,
  OptionType,
  SpreadType,
  LegLabel,
  Spread,
  SpreadWithMarketData,
  Position,
  PositionWithMarketData,
  PositionSummary,
  CreatePositionRequest,
  CreateSpreadRequest,
  UpdatePositionRequest,
  UpdateSpreadRequest,
  PositionsResponse,
  SpreadsResponse,
  PositionsWithMarketDataResponse,
  PositionAIContext,
  SpreadAIContext,
  PortfolioAIContext,
} from '@/../../../lib/types/positions';

export {
  calculateSpreadMetrics,
  getSpreadTypeName,
} from '@/../../../lib/types/positions';
