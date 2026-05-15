/**
 * Seed Xylo eval scenarios from `agent_decisions`.
 *
 * Reads recent rows from the production `agent_decisions` table and
 * writes them as scenario fixtures into
 * `lib/ai-agent/evals/scenarios/`. Each fixture is structured so
 * `runEvalSuite` can replay the question and assert ≥ N coverage
 * signals + a parseable action.
 *
 * Usage:
 *   bun run tools/scripts/seed-eval-scenarios.ts                # 30 most recent trade_analysis rows
 *   bun run tools/scripts/seed-eval-scenarios.ts --limit 10
 *   bun run tools/scripts/seed-eval-scenarios.ts --class earnings_check
 *
 * Idempotent: existing scenario fixtures with matching `original_id`
 * are overwritten. Files for `original_id`s no longer in the DB are
 * left alone.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Scenario } from '../../lib/ai-agent/evals/types';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(HERE, '../../lib/ai-agent/evals/scenarios');

interface DecisionRow {
  id: string;
  user_question: string;
  question_class: string | null;
  ticker: string | null;
  coverage_report: { checked?: string[] } | null;
  recommendation_type: string | null;
}

function parseArgs(argv: string[]): { limit: number; questionClass?: string } {
  const out: { limit: number; questionClass?: string } = { limit: 30 };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--limit' && argv[i + 1]) {
      out.limit = Math.max(
        1,
        Math.min(100, Number.parseInt(argv[++i], 10) || 30)
      );
    } else if (argv[i] === '--class' && argv[i + 1]) {
      out.questionClass = argv[++i];
    }
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error(
      'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing. Source .env first.'
    );
    process.exit(2);
  }

  const params = new URLSearchParams();
  params.set(
    'select',
    'id,user_question,question_class,ticker,coverage_report,recommendation_type'
  );
  params.set('order', 'created_at.desc');
  params.set('limit', String(args.limit));
  if (args.questionClass) {
    params.set('question_class', `eq.${args.questionClass}`);
  } else {
    params.set(
      'question_class',
      'in.(trade_analysis,earnings_check,position,research)'
    );
  }
  // Skip our own smoke rows.
  params.set('user_question', 'not.like.[rollout-smoke]%');

  const res = await fetch(
    `${url}/rest/v1/agent_decisions?${params.toString()}`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } }
  );
  if (!res.ok) {
    console.error('Supabase fetch failed:', res.status, await res.text());
    process.exit(1);
  }
  const rows = (await res.json()) as DecisionRow[];
  console.log(`Fetched ${rows.length} candidate rows.`);

  await mkdir(FIXTURES_DIR, { recursive: true });

  let written = 0;
  for (const r of rows) {
    if (!r.user_question || r.user_question.startsWith('[')) continue;
    const checked = r.coverage_report?.checked ?? [];
    const fixture: Scenario = {
      id: `seeded-${r.id.slice(0, 8)}`,
      kind: 'scenario',
      source: 'agent_decisions',
      original_id: r.id,
      question: r.user_question,
      // Require the same set of signals the original turn checked, so
      // the eval will fail-loud if a code change drops a signal.
      expected_signals: checked.length > 0 ? checked : undefined,
      // Defer expected_action_in / expected_approved to manual review;
      // we don't want to pin the eval to a specific call yet.
    };
    const path = join(FIXTURES_DIR, `${fixture.id}.json`);
    await writeFile(path, JSON.stringify(fixture, null, 2) + '\n', 'utf8');
    written++;
  }
  console.log(`Wrote ${written} scenario fixtures to ${FIXTURES_DIR}`);
}

void main();
