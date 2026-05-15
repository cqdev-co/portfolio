import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { arch, platform, version } from 'node:process';
import { ROOT, loadModelsConfig, loadTasks } from './config.ts';
import { callOllama, createClient, isModelAvailable } from './ollama-client.ts';
import { writeJsonReport } from './report/json.ts';
import { writeMarkdownReport } from './report/markdown.ts';
import { scoreRun } from './scorers/index.ts';
import type { ModelEntry, Report, RunRecord, Task } from './types.ts';

interface CliOptions {
  model?: string;
  workload?: string;
  task?: string;
  tag?: string;
  runs?: number;
}

function parseArgs(argv: string[]): CliOptions {
  const out: CliOptions = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = argv[i + 1];
    switch (a) {
      case '--model':
        out.model = next;
        i++;
        break;
      case '--workload':
        out.workload = next;
        i++;
        break;
      case '--task':
        out.task = next;
        i++;
        break;
      case '--tag':
        out.tag = next;
        i++;
        break;
      case '--runs':
        out.runs = Number(next);
        i++;
        break;
      case '-h':
      case '--help':
        printHelpAndExit();
        break;
    }
  }
  return out;
}

function printHelpAndExit(): never {
  console.log(`local-ai-eval

Usage:
  bun run src/runner.ts [options]

Options:
  --model <id>       Only run this model id (as listed in models.config.json)
  --workload <name>  Only run tasks with this workload (chat|briefing|narrative|tool-call)
  --task <id>        Only run this single task id
  --tag <tag>        Only run tasks with this tag (from task JSON "tags" array)
  --runs <n>         Override runsPerTask
  -h, --help         Show this help
`);
  process.exit(0);
}

function timestampDir(): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

async function runOneTaskOnModel(
  client: ReturnType<typeof createClient>,
  model: ModelEntry,
  task: Task,
  runsPerTask: number,
  timeoutMs: number
): Promise<RunRecord[]> {
  const records: RunRecord[] = [];
  for (let i = 0; i < runsPerTask; i++) {
    const runIndex = i + 1;
    process.stdout.write(
      `  [${model.label}] ${task.id} run ${runIndex}/${runsPerTask}... `
    );
    try {
      const res = await callOllama(client, model, task, timeoutMs);
      const score = scoreRun({
        task,
        output: res.content,
        toolCalls: res.toolCalls,
      });
      records.push({
        modelId: model.id,
        modelLabel: model.label,
        taskId: task.id,
        workload: task.workload,
        runIndex,
        timing: {
          totalMs: res.totalMs,
          firstTokenMs: res.firstTokenMs,
          promptTokens: res.promptTokens,
          completionTokens: res.completionTokens,
          tokensPerSec: res.tokensPerSec,
        },
        output: res.content,
        toolCalls: res.toolCalls,
        score,
      });
      const tps = res.tokensPerSec
        ? ` @ ${res.tokensPerSec.toFixed(1)} tok/s`
        : '';
      console.log(
        `${score.passed ? 'PASS' : 'FAIL'} in ${(res.totalMs / 1000).toFixed(1)}s${tps}`
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`ERROR: ${message}`);
      records.push({
        modelId: model.id,
        modelLabel: model.label,
        taskId: task.id,
        workload: task.workload,
        runIndex,
        timing: { totalMs: 0 },
        output: '',
        score: { workload: task.workload, passed: false, checks: [] },
        error: message,
      });
    }
  }
  return records;
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const config = await loadModelsConfig();
  const allTasks = await loadTasks();

  let models = config.models;
  if (opts.model) {
    models = models.filter((m) => m.id === opts.model);
    if (models.length === 0) {
      console.error(
        `No model matching --model ${opts.model} in models.config.json`
      );
      process.exit(1);
    }
  }

  let tasks = allTasks;
  if (opts.workload) {
    tasks = tasks.filter((t) => t.workload === opts.workload);
  }
  if (opts.task) {
    tasks = tasks.filter((t) => t.id === opts.task);
  }
  if (opts.tag) {
    tasks = tasks.filter((t) => t.tags?.includes(opts.tag as string));
  }
  if (tasks.length === 0) {
    console.error('No tasks matched filters.');
    process.exit(1);
  }

  const runsPerTask = opts.runs ?? config.runsPerTask;

  const client = createClient(config.baseUrl);

  console.log(`local-ai-eval`);
  console.log(`  Base URL: ${config.baseUrl}`);
  console.log(`  Models: ${models.map((m) => m.id).join(', ')}`);
  console.log(`  Tasks: ${tasks.map((t) => t.id).join(', ')}`);
  console.log(`  Runs per task: ${runsPerTask}`);
  console.log('');

  const startedAt = new Date().toISOString();
  const runs: RunRecord[] = [];

  for (const model of models) {
    console.log(`> ${model.label} (${model.id})`);
    const available = await isModelAvailable(client, model.id);
    if (!available) {
      console.log(
        `  SKIP: model not found on Ollama server. Run \`ollama pull ${model.id}\` to enable.`
      );
      continue;
    }
    for (const task of tasks) {
      const records = await runOneTaskOnModel(
        client,
        model,
        task,
        runsPerTask,
        config.requestTimeoutMs
      );
      runs.push(...records);
    }
  }

  const finishedAt = new Date().toISOString();

  const report: Report = {
    startedAt,
    finishedAt,
    host: { platform, arch, nodeVersion: version },
    config: { ...config, models, runsPerTask },
    tasks: tasks.map((t) => ({
      id: t.id,
      workload: t.workload,
      description: t.description,
    })),
    runs,
  };

  const outDir = join(ROOT, 'reports', timestampDir());
  await mkdir(outDir, { recursive: true });
  const jsonPath = join(outDir, 'raw.json');
  const mdPath = join(outDir, 'report.md');
  await writeJsonReport(jsonPath, report);
  await writeMarkdownReport(mdPath, report);

  console.log('');
  console.log(`Report written:`);
  console.log(`  ${mdPath}`);
  console.log(`  ${jsonPath}`);

  if (runs.length === 0) {
    console.log('');
    console.log(
      'No runs recorded. Likely cause: none of the configured models are pulled locally.'
    );
    console.log(
      'Pull one, update models.config.json ids if needed, and rerun.'
    );
    process.exit(2);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
