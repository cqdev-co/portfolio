/**
 * Position Tracker
 * Track open positions and generate exit signals
 */

export interface Position {
  id: string;
  ticker: string;
  strategy: 'cds' | 'pds' | 'ic'; // Strategy type
  entryDate: Date;
  entryPrice: number; // Debit paid
  currentPrice: number;
  strikes: {
    long: number;
    short: number;
  };
  expiration: Date;
  quantity: number;
  notes?: string;
}

export type PositionStatus = 'open' | 'closed' | 'expired';

export type ExitReason =
  | 'profit_target'
  | 'stop_loss'
  | 'time_exit'
  | 'earnings'
  | 'manual';

export interface ExitSignal {
  position: Position;
  reason: ExitReason;
  urgency: 'immediate' | 'soon' | 'consider';
  message: string;
  currentPnL: number;
  currentPnLPercent: number;
}

export interface ExitThresholds {
  profitTargetPct: number; // e.g., 35 for +35%
  stopLossPct: number; // e.g., 40 for -40%
  daysBeforeExpiry: number; // e.g., 7
  daysBeforeEarnings: number; // e.g., 3
}

const DEFAULT_THRESHOLDS: ExitThresholds = {
  profitTargetPct: 35,
  stopLossPct: 40,
  daysBeforeExpiry: 7,
  daysBeforeEarnings: 3,
};

/**
 * Calculate P&L for a position
 */
export function calculatePnL(
  entryPrice: number,
  currentPrice: number
): { dollars: number; percent: number } {
  const dollars = currentPrice - entryPrice;
  const percent = (dollars / entryPrice) * 100;
  return { dollars, percent };
}

/**
 * Check if position should be exited
 */
export function checkExitSignals(
  position: Position,
  currentPrice: number,
  earningsDaysUntil: number | null,
  thresholds: ExitThresholds = DEFAULT_THRESHOLDS
): ExitSignal | null {
  const pnl = calculatePnL(position.entryPrice, currentPrice);

  // Check profit target
  if (pnl.percent >= thresholds.profitTargetPct) {
    return {
      position,
      reason: 'profit_target',
      urgency: 'immediate',
      message: `Hit +${thresholds.profitTargetPct}% target`,
      currentPnL: pnl.dollars,
      currentPnLPercent: pnl.percent,
    };
  }

  // Check stop loss
  if (pnl.percent <= -thresholds.stopLossPct) {
    return {
      position,
      reason: 'stop_loss',
      urgency: 'immediate',
      message: `Hit -${thresholds.stopLossPct}% stop loss`,
      currentPnL: pnl.dollars,
      currentPnLPercent: pnl.percent,
    };
  }

  // Check expiration proximity
  const daysToExpiry = Math.ceil(
    (position.expiration.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
  if (daysToExpiry <= thresholds.daysBeforeExpiry) {
    return {
      position,
      reason: 'time_exit',
      urgency: daysToExpiry <= 3 ? 'immediate' : 'soon',
      message: `${daysToExpiry} days to expiration`,
      currentPnL: pnl.dollars,
      currentPnLPercent: pnl.percent,
    };
  }

  // Check earnings proximity
  if (
    earningsDaysUntil !== null &&
    earningsDaysUntil <= thresholds.daysBeforeEarnings
  ) {
    return {
      position,
      reason: 'earnings',
      urgency: 'immediate',
      message: `Earnings in ${earningsDaysUntil} days`,
      currentPnL: pnl.dollars,
      currentPnLPercent: pnl.percent,
    };
  }

  return null;
}
