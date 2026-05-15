import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ROOT, loadModelsConfig, loadTasks } from './config.ts';
import { callOllama, createClient, isModelAvailable } from './ollama-client.ts';
import type { ModelEntry, Task } from './types.ts';

interface SoakOptions {
  model: string;
  durationMs: number;
  intervalMs: number;
  workload?: string;
}

function parseDuration(input: string): number {
  const match = /^(\d+)(ms|s|m|h)?$/.exec(input.trim());
  if (!match) throw new Error(`Invalid duration: ${input}`);
  const n = Number(match[1]);
  const unit = match[2] ?? 'ms';
  switch (unit) {
    case 'ms':
      return n;
    case 's':
      return n * 1000;
    case 'm':
      return n * 60_000;
    case 'h':
      return n * 3_600_000;
  }
  return n;
}

function parseArgs(argv: string[]): SoakOptions {
  const out: Partial<SoakOptions> = {
    durationMs: 60 * 60_000, // 60m default
    intervalMs: 30_000, // 30s default
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = argv[i + 1];
    switch (a) {
      case '--model':
        out.model = next;
        i++;
        break;
      case '--duration':
        out.durationMs = parseDuration(next);
        i++;
        break;
      case '--interval':
        out.intervalMs = parseDuration(next);
        i++;
        break;
      case '--workload':
        out.workload = next;
        i++;
        break;
      case '-h':
      case '--help':
        printHelpAndExit();
        break;
    }
  }
  if (!out.model) {
    console.error(
      'Missing required --model. Example: --model qwen3.6-35b-a3b-q4_k_m'
    );
    process.exit(1);
  }
  return out as SoakOptions;
}

function printHelpAndExit(): never {
  console.log(`local-ai-eval soak

Usage:
  bun run src/soak.ts --model <id> [options]

Options:
  --model <id>         Required. Ollama model id.
  --duration <spec>    Total run duration. e.g. 60m, 2h, 900s. Default 60m.
  --interval <spec>    Time between requests. e.g. 30s, 1m. Default 30s.
  --workload <name>    Only cycle tasks with this workload.
  -h, --help           Show this help.
`);
  process.exit(0);
}

function timestampDir(): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function sparkline(values: number[], width = 48): string {
  if (values.length === 0) return '';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const chars = '▁▂▃▄▅▆▇█';
  const stride = Math.max(1, Math.ceil(values.length / width));
  const out: string[] = [];
  for (let i = 0; i < values.length; i += stride) {
    const slice = values.slice(i, i + stride);
    const avg = slice.reduce((a, b) => a + b, 0) / slice.length;
    const norm = max === min ? 0 : (avg - min) / (max - min);
    const idx = Math.min(chars.length - 1, Math.floor(norm * chars.length));
    out.push(chars[idx]);
  }
  return out.join('');
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const config = await loadModelsConfig();
  const allTasks = await loadTasks();

  const model: ModelEntry | undefined = config.models.find(
    (m) => m.id === opts.model
  );
  if (!model) {
    console.error(
      `Model ${opts.model} not found in models.config.json. Add it there first.`
    );
    process.exit(1);
  }

  let tasks: Task[] = allTasks;
  if (opts.workload) tasks = tasks.filter((t) => t.workload === opts.workload);
  if (tasks.length === 0) {
    console.error('No tasks matched filters.');
    process.exit(1);
  }

  const client = createClient(config.baseUrl);
  const available = await isModelAvailable(client, model.id);
  if (!available) {
    console.error(
      `Model ${model.id} is not pulled locally. Run \`ollama pull ${model.id}\` first.`
    );
    process.exit(1);
  }

  const outDir = join(ROOT, 'reports', `${timestampDir()}-soak`);
  await mkdir(outDir, { recursive: true });
  const ndjsonPath = join(outDir, 'soak.ndjson');
  const mdPath = join(outDir, 'soak.md');

  const startedAt = Date.now();
  const endsAt = startedAt + opts.durationMs;
  let requestCount = 0;
  let errorCount = 0;
  const latencies: number[] = [];

  console.log(
    `Soak: model=${model.id}, duration=${opts.durationMs}ms, interval=${opts.intervalMs}ms`
  );
  console.log(`Logs: ${ndjsonPath}`);

  let cursor = 0;
  while (Date.now() < endsAt) {
    const task = tasks[cursor % tasks.length];
    cursor++;
    const requestStartedAt = new Date().toISOString();
    const startedTs = performance.now();
    try {
      const res = await callOllama(
        client,
        model,
        task,
        config.requestTimeoutMs
      );
      const totalMs = performance.now() - startedTs;
      latencies.push(totalMs);
      requestCount++;
      await appendFile(
        ndjsonPath,
        JSON.stringify({
          ts: requestStartedAt,
          taskId: task.id,
          workload: task.workload,
          totalMs,
          firstTokenMs: res.firstTokenMs,
          tokensPerSec: res.tokensPerSec,
          promptTokens: res.promptTokens,
          completionTokens: res.completionTokens,
        }) + '\n',
        'utf8'
      );
      process.stdout.write(
        `  ${requestStartedAt} ${task.id} ${(totalMs / 1000).toFixed(1)}s\n`
      );
    } catch (err) {
      errorCount++;
      const message = err instanceof Error ? err.message : String(err);
      await appendFile(
        ndjsonPath,
        JSON.stringify({
          ts: requestStartedAt,
          taskId: task.id,
          workload: task.workload,
          error: message,
        }) + '\n',
        'utf8'
      );
      process.stdout.write(
        `  ${requestStartedAt} ${task.id} ERROR ${message}\n`
      );
    }

    const nextFireAt = startedTs + opts.intervalMs;
    const waitMs = Math.max(0, nextFireAt - performance.now());
    if (Date.now() + waitMs >= endsAt) break;
    if (waitMs > 0) await new Promise((r) => setTimeout(r, waitMs));
  }

  const finishedAt = Date.now();
  const minutes = (finishedAt - startedAt) / 60_000;

  const p = (pct: number): number | undefined => {
    if (latencies.length === 0) return undefined;
    const sorted = [...latencies].sort((a, b) => a - b);
    return sorted[
      Math.min(sorted.length - 1, Math.floor((pct / 100) * sorted.length))
    ];
  };

  const mean =
    latencies.length > 0
      ? latencies.reduce((a, b) => a + b, 0) / latencies.length
      : undefined;

  const firstHalf = latencies.slice(0, Math.floor(latencies.length / 2));
  const secondHalf = latencies.slice(Math.floor(latencies.length / 2));
  const meanFirst =
    firstHalf.length > 0
      ? firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length
      : undefined;
  const meanSecond =
    secondHalf.length > 0
      ? secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length
      : undefined;
  const driftPct =
    meanFirst && meanSecond && meanFirst > 0
      ? ((meanSecond - meanFirst) / meanFirst) * 100
      : undefined;

  const md: string[] = [];
  md.push(`# Soak Report`);
  md.push('');
  md.push(`- Model: \`${model.id}\` (${model.label})`);
  md.push(`- Duration: ${minutes.toFixed(1)} min`);
  md.push(`- Interval: ${opts.intervalMs}ms`);
  md.push(`- Requests: ${requestCount}`);
  md.push(`- Errors: ${errorCount}`);
  md.push('');
  md.push(`## Latency`);
  md.push('');
  md.push(`| metric | ms |`);
  md.push(`| --- | ---: |`);
  md.push(`| mean | ${mean ? Math.round(mean) : '—'} |`);
  md.push(`| p50 | ${p(50) ? Math.round(p(50) as number) : '—'} |`);
  md.push(`| p95 | ${p(95) ? Math.round(p(95) as number) : '—'} |`);
  md.push(`| p99 | ${p(99) ? Math.round(p(99) as number) : '—'} |`);
  md.push('');
  md.push(
    `- Mean first half: ${meanFirst ? Math.round(meanFirst) + ' ms' : '—'}`
  );
  md.push(
    `- Mean second half: ${meanSecond ? Math.round(meanSecond) + ' ms' : '—'}`
  );
  md.push(
    `- Drift: ${driftPct !== undefined ? driftPct.toFixed(1) + '%' : '—'}  (positive = slower over time; watch for thermal throttling)`
  );
  md.push('');
  md.push(`## Latency sparkline (chronological)`);
  md.push('');
  md.push('```');
  md.push(sparkline(latencies));
  md.push('```');
  md.push('');
  md.push(`Raw per-request log: \`soak.ndjson\``);

  await writeFile(mdPath, md.join('\n'), 'utf8');
  console.log('');
  console.log(`Soak report: ${mdPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
