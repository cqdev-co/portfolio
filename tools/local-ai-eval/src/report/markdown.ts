import { writeFile } from 'node:fs/promises';
import type { Report, RunRecord, Workload } from '../types.ts';

function percentile(values: number[], p: number): number | undefined {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.floor((p / 100) * sorted.length))
  );
  return sorted[idx];
}

function mean(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function fmtMs(ms: number | undefined): string {
  if (ms === undefined) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function fmtTps(tps: number | undefined): string {
  if (tps === undefined) return '—';
  return `${tps.toFixed(1)} tok/s`;
}

function truncate(str: string, n: number): string {
  if (str.length <= n) return str;
  return str.slice(0, n) + '…';
}

interface AggregateRow {
  modelId: string;
  modelLabel: string;
  workload: Workload;
  runs: number;
  passRate: number;
  p50TotalMs?: number;
  p95TotalMs?: number;
  meanFirstTokenMs?: number;
  meanTps?: number;
  errors: number;
}

function aggregate(runs: RunRecord[]): AggregateRow[] {
  const groups = new Map<string, RunRecord[]>();
  for (const r of runs) {
    const key = `${r.modelId}::${r.workload}`;
    const arr = groups.get(key) ?? [];
    arr.push(r);
    groups.set(key, arr);
  }
  const rows: AggregateRow[] = [];
  for (const [key, arr] of groups) {
    const [modelId, workload] = key.split('::') as [string, Workload];
    const passes = arr.filter((r) => r.score.passed).length;
    const totals = arr.filter((r) => !r.error).map((r) => r.timing.totalMs);
    const firsts = arr
      .filter((r) => !r.error && r.timing.firstTokenMs !== undefined)
      .map((r) => r.timing.firstTokenMs as number);
    const tps = arr
      .filter((r) => !r.error && r.timing.tokensPerSec !== undefined)
      .map((r) => r.timing.tokensPerSec as number);
    rows.push({
      modelId,
      modelLabel: arr[0].modelLabel,
      workload,
      runs: arr.length,
      passRate: arr.length > 0 ? passes / arr.length : 0,
      p50TotalMs: percentile(totals, 50),
      p95TotalMs: percentile(totals, 95),
      meanFirstTokenMs: mean(firsts),
      meanTps: mean(tps),
      errors: arr.filter((r) => r.error).length,
    });
  }
  rows.sort(
    (a, b) =>
      a.modelId.localeCompare(b.modelId) || a.workload.localeCompare(b.workload)
  );
  return rows;
}

function samplesSection(runs: RunRecord[]): string {
  const byModel = new Map<string, RunRecord[]>();
  for (const r of runs) {
    const arr = byModel.get(r.modelId) ?? [];
    arr.push(r);
    byModel.set(r.modelId, arr);
  }

  const lines: string[] = [];
  for (const [modelId, arr] of byModel) {
    lines.push(`### ${arr[0].modelLabel} (\`${modelId}\`)`);
    lines.push('');
    const worst = [...arr]
      .filter((r) => !r.score.passed || r.error)
      .slice(0, 3);
    const best = arr.filter((r) => r.score.passed && !r.error).slice(0, 2);
    if (worst.length > 0) {
      lines.push('**Failures / worst samples:**');
      lines.push('');
      for (const r of worst) {
        lines.push(
          `- \`${r.taskId}\` run ${r.runIndex} (${r.workload}) — ${r.error ? `ERROR: ${r.error}` : 'failed checks'}`
        );
        const failedChecks = r.score.checks.filter((c) => !c.passed);
        for (const c of failedChecks) {
          lines.push(`    - ${c.kind}: ${c.detail ?? 'failed'}`);
        }
        lines.push('');
        lines.push('    ```');
        lines.push(
          truncate(r.output, 500)
            .split('\n')
            .map((l) => `    ${l}`)
            .join('\n')
        );
        lines.push('    ```');
        lines.push('');
      }
    }
    if (best.length > 0) {
      lines.push('**Best samples:**');
      lines.push('');
      for (const r of best) {
        lines.push(`- \`${r.taskId}\` run ${r.runIndex} (${r.workload})`);
        lines.push('');
        lines.push('    ```');
        lines.push(
          truncate(r.output, 500)
            .split('\n')
            .map((l) => `    ${l}`)
            .join('\n')
        );
        lines.push('    ```');
        lines.push('');
      }
    }
  }
  return lines.join('\n');
}

export async function writeMarkdownReport(
  path: string,
  report: Report
): Promise<void> {
  const rows = aggregate(report.runs);

  const lines: string[] = [];
  lines.push(`# Local AI Eval Report`);
  lines.push('');
  lines.push(`- Started: ${report.startedAt}`);
  lines.push(`- Finished: ${report.finishedAt}`);
  lines.push(
    `- Host: ${report.host.platform}/${report.host.arch}, Node ${report.host.nodeVersion}`
  );
  lines.push(`- Base URL: \`${report.config.baseUrl}\``);
  lines.push(`- Runs per task: ${report.config.runsPerTask}`);
  lines.push(`- Tasks: ${report.tasks.length}`);
  lines.push(`- Models: ${report.config.models.length}`);
  lines.push('');

  lines.push(`## Summary`);
  lines.push('');
  lines.push(
    `| Model | Workload | Runs | Pass | p50 total | p95 total | mean TTFT | mean tok/s | errors |`
  );
  lines.push(`| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |`);
  for (const r of rows) {
    lines.push(
      `| ${r.modelLabel} | ${r.workload} | ${r.runs} | ${(r.passRate * 100).toFixed(0)}% | ${fmtMs(r.p50TotalMs)} | ${fmtMs(r.p95TotalMs)} | ${fmtMs(r.meanFirstTokenMs)} | ${fmtTps(r.meanTps)} | ${r.errors} |`
    );
  }
  lines.push('');

  lines.push(`## Samples`);
  lines.push('');
  lines.push(samplesSection(report.runs));

  await writeFile(path, lines.join('\n'), 'utf8');
}
