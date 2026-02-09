/**
 * Strategy Config Schema Validation Tests
 *
 * These tests ensure the Zod schema correctly validates strategy.config.yaml
 * and catches common misconfigurations that could affect trading decisions.
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parse as parseYaml } from 'yaml';
import { validateStrategyConfig, assertValidStrategyConfig } from './schema.ts';
import { getStrategyConfig, clearConfigCache, setConfigPath } from './index.ts';

// Path to the real config file
const CONFIG_PATH = join(import.meta.dir, '../../../strategy.config.yaml');

/**
 * Load the real config for testing
 */
function loadRawConfig() {
  const yaml = readFileSync(CONFIG_PATH, 'utf-8');
  return parseYaml(yaml);
}

// ============================================================================
// REAL CONFIG VALIDATION
// ============================================================================

describe('strategy.config.yaml validation', () => {
  test('real config file passes validation', () => {
    const config = loadRawConfig();
    const result = validateStrategyConfig(config);

    if (!result.success) {
      // Pretty-print errors for debugging
      const errors = result.error.issues
        .map((i) => `  ${i.path.join('.')}: ${i.message}`)
        .join('\n');
      throw new Error(`Config validation failed:\n${errors}`);
    }

    expect(result.success).toBe(true);
  });

  test('real config loads successfully through getStrategyConfig()', () => {
    clearConfigCache();
    setConfigPath(CONFIG_PATH);

    const config = getStrategyConfig(true);
    expect(config).toBeDefined();
    expect(config.strategy.name).toBe('Deep ITM Call Debit Spread');
  });
});

// ============================================================================
// ENTRY CRITERIA CONSTRAINTS
// ============================================================================

describe('entry criteria validation', () => {
  let config: Record<string, unknown>;

  beforeEach(() => {
    config = loadRawConfig() as Record<string, unknown>;
  });

  test('rejects RSI min >= max', () => {
    const badConfig = structuredClone(config);
    (
      badConfig as { entry: { momentum: { rsi_min: number } } }
    ).entry.momentum.rsi_min = 60;
    (
      badConfig as { entry: { momentum: { rsi_max: number } } }
    ).entry.momentum.rsi_max = 40;
    const result = validateStrategyConfig(badConfig);
    expect(result.success).toBe(false);
  });

  test('rejects RSI ideal range outside valid range', () => {
    const badConfig = structuredClone(config);
    (
      badConfig as { entry: { momentum: { rsi_ideal_max: number } } }
    ).entry.momentum.rsi_ideal_max = 70;
    const result = validateStrategyConfig(badConfig);
    expect(result.success).toBe(false);
  });

  test('rejects cushion minimum >= preferred', () => {
    const badConfig = structuredClone(config);
    (
      badConfig as { entry: { cushion: { minimum_pct: number } } }
    ).entry.cushion.minimum_pct = 20;
    (
      badConfig as { entry: { cushion: { preferred_pct: number } } }
    ).entry.cushion.preferred_pct = 10;
    const result = validateStrategyConfig(badConfig);
    expect(result.success).toBe(false);
  });

  test('rejects IV preferred max > hard max', () => {
    const badConfig = structuredClone(config);
    (
      badConfig as { entry: { volatility: { iv_preferred_max_pct: number } } }
    ).entry.volatility.iv_preferred_max_pct = 60;
    (
      badConfig as { entry: { volatility: { iv_max_pct: number } } }
    ).entry.volatility.iv_max_pct = 40;
    const result = validateStrategyConfig(badConfig);
    expect(result.success).toBe(false);
  });

  test('rejects negative RSI values', () => {
    const badConfig = structuredClone(config);
    (
      badConfig as { entry: { momentum: { rsi_min: number } } }
    ).entry.momentum.rsi_min = -5;
    const result = validateStrategyConfig(badConfig);
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// EXIT RULES CONSTRAINTS
// ============================================================================

describe('exit rules validation', () => {
  let config: Record<string, unknown>;

  beforeEach(() => {
    config = loadRawConfig() as Record<string, unknown>;
  });

  test('rejects profit target > greed limit', () => {
    const badConfig = structuredClone(config);
    (
      badConfig as { exit: { profit: { target_pct: number } } }
    ).exit.profit.target_pct = 90;
    (
      badConfig as { exit: { profit: { greed_limit_pct: number } } }
    ).exit.profit.greed_limit_pct = 80;
    const result = validateStrategyConfig(badConfig);
    expect(result.success).toBe(false);
  });

  test('rejects forced exit DTE > gamma risk zone DTE', () => {
    const badConfig = structuredClone(config);
    (
      badConfig as { exit: { time: { forced_exit_dte: number } } }
    ).exit.time.forced_exit_dte = 14;
    (
      badConfig as { exit: { time: { gamma_risk_zone_dte: number } } }
    ).exit.time.gamma_risk_zone_dte = 7;
    const result = validateStrategyConfig(badConfig);
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// POSITION SIZING CONSTRAINTS
// ============================================================================

describe('position sizing validation', () => {
  let config: Record<string, unknown>;

  beforeEach(() => {
    config = loadRawConfig() as Record<string, unknown>;
  });

  test('rejects empty scaling tiers', () => {
    const badConfig = structuredClone(config);
    (
      badConfig as { position_sizing: { scaling: unknown[] } }
    ).position_sizing.scaling = [];
    const result = validateStrategyConfig(badConfig);
    expect(result.success).toBe(false);
  });

  test('rejects scaling tier with account_min >= account_max', () => {
    const badConfig = structuredClone(config);
    (
      badConfig as {
        position_sizing: {
          scaling: Array<{ account_min: number; account_max: number }>;
        };
      }
    ).position_sizing.scaling[0] = {
      ...(
        badConfig as {
          position_sizing: {
            scaling: Array<{ account_min: number; account_max: number }>;
          };
        }
      ).position_sizing.scaling[0],
      account_min: 10000,
      account_max: 5000,
    };
    const result = validateStrategyConfig(badConfig);
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// SPREAD PARAMETERS CONSTRAINTS
// ============================================================================

describe('spread parameters validation', () => {
  let config: Record<string, unknown>;

  beforeEach(() => {
    config = loadRawConfig() as Record<string, unknown>;
  });

  test('rejects DTE min > target', () => {
    const badConfig = structuredClone(config);
    (
      badConfig as { spread_params: { dte: { min: number; target: number } } }
    ).spread_params.dte.min = 45;
    (
      badConfig as { spread_params: { dte: { min: number; target: number } } }
    ).spread_params.dte.target = 30;
    const result = validateStrategyConfig(badConfig);
    expect(result.success).toBe(false);
  });

  test('rejects delta ranges where min >= max', () => {
    const badConfig = structuredClone(config);
    (
      badConfig as {
        spread_params: {
          strikes: {
            long_strike_delta_min: number;
            long_strike_delta_max: number;
          };
        };
      }
    ).spread_params.strikes.long_strike_delta_min = 0.9;
    (
      badConfig as {
        spread_params: {
          strikes: {
            long_strike_delta_min: number;
            long_strike_delta_max: number;
          };
        };
      }
    ).spread_params.strikes.long_strike_delta_max = 0.7;
    const result = validateStrategyConfig(badConfig);
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// MISSING FIELDS
// ============================================================================

describe('missing required fields', () => {
  test('rejects config with missing entry section', () => {
    const result = validateStrategyConfig({
      strategy: { name: 'test', version: '1.0', description: 'test' },
    });
    expect(result.success).toBe(false);
  });

  test('rejects completely empty config', () => {
    const result = validateStrategyConfig({});
    expect(result.success).toBe(false);
  });

  test('rejects null config', () => {
    const result = validateStrategyConfig(null);
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// assertValidStrategyConfig
// ============================================================================

describe('assertValidStrategyConfig', () => {
  test('throws on invalid config', () => {
    expect(() => assertValidStrategyConfig({})).toThrow();
  });

  test('does not throw on valid config', () => {
    const config = loadRawConfig();
    expect(() => assertValidStrategyConfig(config)).not.toThrow();
  });
});
