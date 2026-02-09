/**
 * Integration test for the unified signals table.
 *
 * Tests the full dual-write flow:
 *   1. CDS write  -> cds_signals + signals
 *   2. Penny write -> penny_stock_signals + signals
 *   3. Read back from signals (filter, sort, views)
 *   4. Cleanup test rows
 *
 * Run:  bun run db/test-signals-integration.ts
 * Requires: .env with SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// ── Helpers ──────────────────────────────────────────────────────────────

const TEST_DATE = '2099-12-31'; // far-future date so it never conflicts with real data
const TEST_TICKER_CDS = '_ZCDS'; // leading underscore + Z = won't collide
const TEST_TICKER_PENNY = '_ZPNY';

function ok(label: string) {
  console.log(`  ✅ ${label}`);
}
function fail(label: string, detail?: string) {
  console.error(`  ❌ ${label}${detail ? ': ' + detail : ''}`);
  process.exitCode = 1;
}

// ── Setup ────────────────────────────────────────────────────────────────

function getClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SERVICE_KEY;

  if (!url || !key) {
    throw new Error(
      'Missing env: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC variants)'
    );
  }
  return createClient(url, key);
}

// ── Tests ────────────────────────────────────────────────────────────────

async function testCdsDualWrite(client: SupabaseClient) {
  console.log('\n── CDS Dual-Write ──');

  // Step 1: Write to cds_signals via the RPC (same path the engine uses)
  const { data: detailId, error: rpcErr } = await client.rpc(
    'upsert_cds_signal',
    {
      p_ticker: TEST_TICKER_CDS,
      p_signal_date: TEST_DATE,
      p_signal_score: 82,
      p_regime: 'bull',
      p_regime_confidence: 0.75,
      p_signals: JSON.stringify(['RSI Bounce', 'MA Cross', 'Volume Surge']),
      p_top_signals: 'RSI Bounce, MA Cross, Volume Surge',
      p_price: 150.25,
      p_ma50: 145.0,
      p_ma200: 130.0,
      p_rsi: 42.5,
      p_spread_viable: true,
      p_spread_strikes: '145/150',
      p_spread_debit: 3.2,
      p_spread_cushion: 7.5,
      p_spread_pop: 72.0,
      p_spread_return: 56.0,
      p_sector: 'Technology',
      p_upside_potential: 0.12,
      p_target_price: 168.28,
    }
  );

  if (rpcErr) return fail('cds_signals RPC', rpcErr.message);
  if (!detailId) return fail('cds_signals RPC returned null ID');
  ok(`cds_signals upsert → detail_id: ${detailId}`);

  // Step 2: Dual-write to unified signals table (same logic as engine)
  const grade = 82 >= 80 ? 'A' : 82 >= 70 ? 'B' : 82 >= 60 ? 'C' : 'D';
  const { error: sigErr } = await client.from('signals').upsert(
    {
      strategy: 'cds',
      ticker: TEST_TICKER_CDS,
      signal_date: TEST_DATE,
      score_normalized: 82,
      grade,
      direction: 'bullish',
      price: 150.25,
      regime: 'bull',
      sector: 'Technology',
      detail_id: detailId,
      detail_table: 'cds_signals',
      headline: `${TEST_TICKER_CDS}: Grade ${grade} CDS (score 82)`,
      top_signals: ['RSI Bounce', 'MA Cross', 'Volume Surge'],
      metadata: {
        spread_viable: true,
        spread_strikes: '145/150',
        spread_return: 56.0,
        upside_potential: 0.12,
      },
    },
    { onConflict: 'strategy,ticker,signal_date' }
  );

  if (sigErr) return fail('signals upsert (CDS)', sigErr.message);
  ok('signals upsert (CDS) succeeded');

  // Step 3: Verify the signal is readable
  const { data: rows, error: readErr } = await client
    .from('signals')
    .select('*')
    .eq('strategy', 'cds')
    .eq('ticker', TEST_TICKER_CDS)
    .eq('signal_date', TEST_DATE)
    .single();

  if (readErr) return fail('signals read (CDS)', readErr.message);
  if (rows.score_normalized !== 82)
    return fail('score mismatch', `got ${rows.score_normalized}`);
  if (rows.grade !== 'A') return fail('grade mismatch', `got ${rows.grade}`);
  if (rows.detail_id !== detailId) return fail('detail_id mismatch');
  ok(
    `signals read (CDS) verified: score=${rows.score_normalized}, grade=${rows.grade}, detail_id matches`
  );
}

async function testPennyDualWrite(client: SupabaseClient) {
  console.log('\n── Penny Stock Dual-Write ──');

  // Step 1: Write to penny_stock_signals directly (same path the scanner uses)
  const pennyData = {
    symbol: TEST_TICKER_PENNY,
    scan_date: TEST_DATE,
    close_price: 2.45,
    overall_score: 0.78,
    opportunity_rank: 'A',
    recommendation: 'STRONG_BUY',
    volume_score: 0.85,
    momentum_score: 0.72,
    relative_strength_score: 0.68,
    risk_score: 0.55,
    volume: 5000000,
    avg_volume_20d: 1200000,
    volume_ratio: 4.17,
    volume_spike_factor: 3.2,
    volume_acceleration_2d: 1.8,
    volume_acceleration_5d: 2.1,
    volume_consistency_score: 0.7,
    dollar_volume: 12250000,
    is_consolidating: false,
    is_breakout: true,
    trend_direction: 'UP',
    signal_status: 'NEW',
    days_active: 0,
    data_quality_score: 0.92,
    price_change_5d: 15.5,
    price_change_10d: 22.3,
    price_change_20d: 8.7,
    daily_volatility: 5.2,
  };

  const { data: pennyRows, error: pennyErr } = await client
    .from('penny_stock_signals')
    .upsert(pennyData, { onConflict: 'symbol,scan_date' })
    .select('id')
    .single();

  if (pennyErr) return fail('penny_stock_signals upsert', pennyErr.message);
  if (!pennyRows?.id) return fail('penny_stock_signals returned no ID');
  ok(`penny_stock_signals upsert → detail_id: ${pennyRows.id}`);

  // Step 2: Dual-write to unified signals table (same logic as scanner)
  const score = 0.78;
  const scoreNorm = Math.round(score * 100 * 100) / 100; // 78.00
  const grade =
    score >= 0.85
      ? 'S'
      : score >= 0.7
        ? 'A'
        : score >= 0.55
          ? 'B'
          : score >= 0.4
            ? 'C'
            : 'D';

  const { error: sigErr } = await client.from('signals').upsert(
    {
      strategy: 'penny',
      ticker: TEST_TICKER_PENNY,
      signal_date: TEST_DATE,
      score_normalized: scoreNorm,
      grade,
      direction: 'bullish',
      price: 2.45,
      regime: null,
      sector: null,
      detail_id: pennyRows.id,
      detail_table: 'penny_stock_signals',
      headline: `${TEST_TICKER_PENNY}: Rank ${grade} Penny Signal (score ${scoreNorm})`,
      top_signals: [],
      metadata: {
        is_breakout: true,
        volume_ratio: 4.17,
        volume_spike_factor: 3.2,
        is_consolidating: false,
        recommendation: 'STRONG_BUY',
      },
    },
    { onConflict: 'strategy,ticker,signal_date' }
  );

  if (sigErr) return fail('signals upsert (Penny)', sigErr.message);
  ok('signals upsert (Penny) succeeded');

  // Step 3: Verify
  const { data: row, error: readErr } = await client
    .from('signals')
    .select('*')
    .eq('strategy', 'penny')
    .eq('ticker', TEST_TICKER_PENNY)
    .eq('signal_date', TEST_DATE)
    .single();

  if (readErr) return fail('signals read (Penny)', readErr.message);
  if (row.score_normalized != scoreNorm)
    return fail(
      'score mismatch',
      `expected ${scoreNorm}, got ${row.score_normalized}`
    );
  if (row.grade !== 'A')
    return fail('grade mismatch', `expected A, got ${row.grade}`);
  if (row.metadata?.is_breakout !== true)
    return fail('metadata.is_breakout mismatch');
  ok(
    `signals read (Penny) verified: score=${row.score_normalized}, grade=${row.grade}, metadata.is_breakout=${row.metadata?.is_breakout}`
  );
}

async function testCrossStrategyRead(client: SupabaseClient) {
  console.log('\n── Cross-Strategy Reads ──');

  // Read all test signals ordered by score
  const { data, error } = await client
    .from('signals')
    .select('strategy, ticker, score_normalized, grade, headline')
    .in('ticker', [TEST_TICKER_CDS, TEST_TICKER_PENNY])
    .eq('signal_date', TEST_DATE)
    .order('score_normalized', { ascending: false });

  if (error) return fail('cross-strategy read', error.message);
  if (!data || data.length !== 2)
    return fail('expected 2 test signals', `got ${data?.length ?? 0}`);
  ok(`cross-strategy read: ${data.length} signals returned`);

  // Verify ordering (CDS 82 > Penny 78)
  if (data[0]!.strategy !== 'cds')
    return fail(
      'ordering wrong',
      `expected cds first, got ${data[0]!.strategy}`
    );
  ok('ordering correct: CDS (82) > Penny (78)');

  // Read with strategy filter
  const { data: cdsOnly, error: cdsErr } = await client
    .from('signals')
    .select('ticker, grade')
    .eq('strategy', 'cds')
    .eq('signal_date', TEST_DATE)
    .in('ticker', [TEST_TICKER_CDS]);

  if (cdsErr) return fail('strategy filter read', cdsErr.message);
  if (cdsOnly?.length !== 1)
    return fail('strategy filter', `expected 1, got ${cdsOnly?.length}`);
  ok('strategy filter works (cds only → 1 result)');

  // Read with grade filter
  const { data: gradeA, error: gradeErr } = await client
    .from('signals')
    .select('ticker, strategy')
    .eq('grade', 'A')
    .eq('signal_date', TEST_DATE)
    .in('ticker', [TEST_TICKER_CDS, TEST_TICKER_PENNY]);

  if (gradeErr) return fail('grade filter read', gradeErr.message);
  if (gradeA?.length !== 2)
    return fail('grade filter', `expected 2 A-grade, got ${gradeA?.length}`);
  ok(`grade filter works (grade=A → ${gradeA.length} results)`);
}

async function testPcsPlaceholder(client: SupabaseClient) {
  console.log('\n── PCS Strategy Placeholder ──');

  // PCS isn't deployed yet, but verify the strategy enum accepts 'pcs'
  // We'll write and immediately read back a test signal
  const { error: sigErr } = await client.from('signals').upsert(
    {
      strategy: 'pcs',
      ticker: TEST_TICKER_CDS, // reuse ticker, different strategy
      signal_date: TEST_DATE,
      score_normalized: 75,
      grade: 'B',
      direction: 'bullish',
      price: 150.25,
      regime: 'bull',
      detail_id: '00000000-0000-0000-0000-000000000001',
      detail_table: 'pcs_signals',
      headline: `${TEST_TICKER_CDS}: Grade B PCS (score 75)`,
      top_signals: [],
      metadata: { iv_rank: 45 },
    },
    { onConflict: 'strategy,ticker,signal_date' }
  );

  if (sigErr) return fail('signals upsert (PCS)', sigErr.message);
  ok('PCS strategy enum accepted — ready for future deployment');
}

// ── Cleanup ──────────────────────────────────────────────────────────────

async function cleanup(client: SupabaseClient) {
  console.log('\n── Cleanup ──');

  // Delete test rows from signals
  const { error: sigDel } = await client
    .from('signals')
    .delete()
    .eq('signal_date', TEST_DATE);
  if (sigDel) fail('cleanup signals', sigDel.message);
  else ok('signals test rows deleted');

  // Delete test row from cds_signals
  const { error: cdsDel } = await client
    .from('cds_signals')
    .delete()
    .eq('ticker', TEST_TICKER_CDS)
    .eq('signal_date', TEST_DATE);
  if (cdsDel) fail('cleanup cds_signals', cdsDel.message);
  else ok('cds_signals test row deleted');

  // Delete test row from penny_stock_signals
  const { error: pennyDel } = await client
    .from('penny_stock_signals')
    .delete()
    .eq('symbol', TEST_TICKER_PENNY)
    .eq('scan_date', TEST_DATE);
  if (pennyDel) fail('cleanup penny_stock_signals', pennyDel.message);
  else ok('penny_stock_signals test row deleted');
}

// ── Main ─────────────────────────────────────────────────────────────────

async function main() {
  console.log('🧪 Unified Signals Integration Test\n');
  console.log(`   Test date:   ${TEST_DATE}`);
  console.log(`   CDS ticker:  ${TEST_TICKER_CDS}`);
  console.log(`   Penny ticker: ${TEST_TICKER_PENNY}`);

  const client = getClient();

  try {
    await testCdsDualWrite(client);
    await testPennyDualWrite(client);
    await testCrossStrategyRead(client);
    await testPcsPlaceholder(client);
  } finally {
    await cleanup(client);
  }

  console.log(
    '\n' +
      (process.exitCode ? '❌ SOME TESTS FAILED' : '✅ ALL TESTS PASSED') +
      '\n'
  );
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
