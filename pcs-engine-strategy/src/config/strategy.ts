/**
 * PCS Strategy Configuration Loader
 *
 * Reads PCS-specific sections from the shared strategy.config.yaml.
 * Falls back to sensible defaults if PCS sections are not present.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import YAML from 'yaml';
import { logger } from '../utils/logger.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cachedConfig: any = null;

/**
 * Load strategy.config.yaml from repo root
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function loadConfig(): any {
  if (cachedConfig) return cachedConfig;

  // Try multiple paths to find config (handles running from different CWDs)
  const paths = [
    join(process.cwd(), 'strategy.config.yaml'),
    join(process.cwd(), '..', 'strategy.config.yaml'),
    join(process.cwd(), '..', '..', 'strategy.config.yaml'),
  ];

  for (const configPath of paths) {
    try {
      const content = readFileSync(configPath, 'utf-8');
      cachedConfig = YAML.parse(content);
      logger.debug(`Loaded strategy config from ${configPath}`);
      return cachedConfig;
    } catch {
      continue;
    }
  }

  logger.warn('strategy.config.yaml not found, using defaults');
  return {};
}

/**
 * Get PCS spread criteria from config
 * Falls back to reasonable defaults
 */
export function getPCSSpreadCriteria(): {
  minCreditRatio: number;
  maxCreditRatio: number;
  minCushion: number;
  minPoP: number;
  minReturn: number;
  targetDTE: number;
  minDTE: number;
  maxDTE: number;
  minOI: number;
  shortDeltaMin: number;
  shortDeltaMax: number;
} {
  const config = loadConfig();
  const pcsEntry = config.pcs_entry ?? {};
  const pcsSpreadParams = config.pcs_spread_params ?? {};
  const pcsSpread = pcsEntry.spread ?? {};

  return {
    minCreditRatio: (pcsSpread.min_credit_ratio_pct ?? 20) / 100,
    maxCreditRatio: (pcsSpread.max_credit_ratio_pct ?? 45) / 100,
    minCushion: pcsEntry.cushion?.minimum_pct ?? 5.0,
    minPoP: (pcsSpread.min_pop_pct ?? 65) / 100,
    minReturn: (pcsSpread.min_return_on_risk_pct ?? 20) / 100,
    targetDTE: pcsSpreadParams.dte?.target ?? 35,
    minDTE: pcsSpreadParams.dte?.min ?? 21,
    maxDTE: pcsSpreadParams.dte?.max ?? 45,
    minOI: pcsSpread.min_open_interest ?? 50,
    shortDeltaMin: pcsSpreadParams.strikes?.short_put_delta_min ?? 0.2,
    shortDeltaMax: pcsSpreadParams.strikes?.short_put_delta_max ?? 0.35,
  };
}

/**
 * Get PCS regime adjustments from config
 */
export function getRegimeAdjustments(regime: 'bull' | 'neutral' | 'bear'): {
  minScore: number;
  rsiMax: number;
  positionSizeMultiplier: number;
  maxConcurrentPositions: number;
} {
  const config = loadConfig();
  const regimeConfig = config.market_regime?.[regime]?.adjustments;

  if (!regimeConfig) {
    // Defaults - more conservative for PCS than CDS
    const defaults = {
      bull: { minScore: 60, rsiMax: 65, mult: 1.0, maxPos: 6 },
      neutral: { minScore: 70, rsiMax: 60, mult: 0.65, maxPos: 4 },
      bear: { minScore: 80, rsiMax: 55, mult: 0.35, maxPos: 2 },
    };
    const d = defaults[regime];
    return {
      minScore: d.minScore,
      rsiMax: d.rsiMax,
      positionSizeMultiplier: d.mult,
      maxConcurrentPositions: d.maxPos,
    };
  }

  return {
    minScore: regimeConfig.min_score ?? 70,
    rsiMax: regimeConfig.rsi_max ?? 60,
    positionSizeMultiplier: regimeConfig.position_size_multiplier ?? 0.75,
    maxConcurrentPositions: regimeConfig.max_concurrent_positions ?? 4,
  };
}
