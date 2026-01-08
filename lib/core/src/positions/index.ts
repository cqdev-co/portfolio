/**
 * Position Tracking
 * Core logic for tracking open positions, P&L, and exit signals
 */

export {
  type Position,
  type PositionStatus,
  type ExitSignal,
  checkExitSignals,
  calculatePnL,
} from './tracker.ts';
