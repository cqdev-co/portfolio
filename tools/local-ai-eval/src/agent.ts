/**
 * Agent runner: multi-turn tool-calling loop against a local Ollama model.
 *
 * For each scenario (workload === 'agent-multi-turn'):
 *   - Build message array [system, user]
 *   - Call Ollama with tools
 *   - If assistant emits tool_calls: find matching mock responses, append
 *     assistant turn + tool result messages, continue loop
 *   - If assistant emits content with no tool_calls: record as final answer,
 *     exit loop
 *   - Stop when maxTurns or maxToolCalls exceeded
 *
 * Scores: tool-sequence match, turn/tool-call budget, final-answer content
 * checks. See src/scorers/agent.ts.
 */
import { Ollama } from 'ollama';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { arch, platform, version } from 'node:process';
import { ROOT, loadModelsConfig, loadTasks } from './config.ts';
import { createClient } from './ollama-client.ts';
import { writeJsonReport } from './report/json.ts';
import { writeMarkdownReport } from './report/markdown.ts';
import { scoreAgentRun } from './scorers/agent.ts';
import type {
  AgentConfig,
  AgentTrace,
  AgentTurn,
  ModelEntry,
  Report,
  RunRecord,
  Task,
} from './types.ts';

interface CliOptions {
  model?: string;
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
        console.log(`local-ai-eval agent

Usage:
  bun run src/agent.ts [options]

Runs multi-turn tool-using tasks (workload === 'agent-multi-turn') against the
model(s) in models.config.json.

Options:
  --model <id>   Only run this model id
  --task <id>    Only run this single task id
  --tag <tag>    Only run tasks with this tag
  --runs <n>     Runs per task (default: 1 for agent; these are slow)
  -h, --help     Show this help
`);
        process.exit(0);
    }
  }
  return out;
}

function timestampDir(): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}-agent`;
}

interface OllamaMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: Array<{
    function: { name: string; arguments: Record<string, unknown> };
  }>;
  tool_name?: string;
}

interface ChatResponseShape {
  message: {
    content?: string;
    tool_calls?: Array<{
      function: { name: string; arguments: Record<string, unknown> };
    }>;
  };
  done?: boolean;
  eval_count?: number;
  prompt_eval_count?: number;
}

function mockForCall(
  config: AgentConfig,
  name: string,
  args: Record<string, unknown>
): unknown | undefined {
  for (const m of config.mockToolResponses) {
    if (m.tool !== name) continue;
    if (!m.argsContain) return m.response;
    const ok = Object.entries(m.argsContain).every(([k, v]) => args[k] === v);
    if (ok) return m.response;
  }
  // Fallback: look for any mock for this tool without argsContain
  for (const m of config.mockToolResponses) {
    if (m.tool === name && !m.argsContain) return m.response;
  }
  return undefined;
}

async function runAgentTask(
  client: Ollama,
  model: ModelEntry,
  task: Task,
  timeoutMs: number
): Promise<{ trace: AgentTrace; error?: string; totalMs: number }> {
  const cfg = task.agent!;
  const messages: OllamaMessage[] = [
    { role: 'system', content: task.system },
    { role: 'user', content: task.user },
  ];

  const turns: AgentTurn[] = [];
  let totalToolCalls = 0;
  const uniqueTools = new Set<string>();
  let terminatedReason: AgentTurn['terminatedReason'] = undefined;
  let finalContent = '';
  const overallStart = performance.now();

  for (let turn = 1; turn <= cfg.maxTurns; turn++) {
    const turnStart = performance.now();
    let content = '';
    const toolCalls: AgentTurn['toolCalls'] = [];

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(
        () =>
          reject(new Error(`Ollama request timed out after ${timeoutMs}ms`)),
        timeoutMs
      )
    );

    const call = (async () => {
      const response = await client.chat({
        model: model.id,
        messages: messages as Parameters<Ollama['chat']>[0]['messages'],
        stream: false,
        options: model.options,
        tools: task.tools,
        ...(model.think !== undefined ? { think: model.think } : {}),
      } as Parameters<Ollama['chat']>[0]);
      return response as unknown as ChatResponseShape;
    })();

    let resp: ChatResponseShape;
    try {
      resp = (await Promise.race([call, timeout])) as ChatResponseShape;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      terminatedReason = 'error';
      turns.push({
        turn,
        durationMs: performance.now() - turnStart,
        content: '',
        toolCalls: [],
        mockedToolResults: [],
        terminatedReason: 'error',
      });
      return {
        trace: {
          turns,
          totalToolCalls,
          uniqueTools: [...uniqueTools],
          terminatedReason,
          finalContent: '',
        },
        error: msg,
        totalMs: performance.now() - overallStart,
      };
    }

    content = resp.message.content ?? '';
    const rawCalls = resp.message.tool_calls ?? [];
    for (const tc of rawCalls) {
      toolCalls.push({
        name: tc.function.name,
        arguments: tc.function.arguments ?? {},
      });
      uniqueTools.add(tc.function.name);
    }

    const mockedToolResults: AgentTurn['mockedToolResults'] = [];

    if (toolCalls.length === 0) {
      // Final answer
      finalContent = content;
      terminatedReason = 'final-answer';
      turns.push({
        turn,
        durationMs: performance.now() - turnStart,
        content,
        toolCalls,
        mockedToolResults,
        terminatedReason: 'final-answer',
      });
      break;
    }

    // Append assistant turn (with tool_calls) to messages
    messages.push({
      role: 'assistant',
      content: content,
      tool_calls: rawCalls,
    });

    // For each tool call, look up mock and append a tool result message
    let abortForUnmocked = false;
    for (const c of toolCalls) {
      totalToolCalls++;
      const mock = mockForCall(cfg, c.name, c.arguments);
      if (mock === undefined) {
        mockedToolResults.push({
          tool: c.name,
          responsePreview: '(no matching mock - aborting)',
        });
        abortForUnmocked = true;
        break;
      }
      const payload = typeof mock === 'string' ? mock : JSON.stringify(mock);
      mockedToolResults.push({
        tool: c.name,
        responsePreview: payload.slice(0, 200),
      });
      messages.push({
        role: 'tool',
        content: payload,
        tool_name: c.name,
      });
    }

    turns.push({
      turn,
      durationMs: performance.now() - turnStart,
      content,
      toolCalls,
      mockedToolResults,
      terminatedReason: abortForUnmocked ? 'no-matching-mock' : undefined,
    });

    if (abortForUnmocked) {
      terminatedReason = 'no-matching-mock';
      break;
    }

    if (cfg.maxToolCalls !== undefined && totalToolCalls > cfg.maxToolCalls) {
      terminatedReason = 'max-tool-calls';
      break;
    }
  }

  if (terminatedReason === undefined) {
    terminatedReason = 'max-turns';
  }

  return {
    trace: {
      turns,
      totalToolCalls,
      uniqueTools: [...uniqueTools],
      terminatedReason,
      finalContent,
    },
    totalMs: performance.now() - overallStart,
  };
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const config = await loadModelsConfig();
  const allTasks = await loadTasks();

  const agentTasks = allTasks.filter(
    (t) => t.workload === 'agent-multi-turn' && t.agent !== undefined
  );

  let tasks = agentTasks;
  if (opts.task) tasks = tasks.filter((t) => t.id === opts.task);
  if (opts.tag)
    tasks = tasks.filter((t) => t.tags?.includes(opts.tag as string));
  if (tasks.length === 0) {
    console.error('No agent-multi-turn tasks matched filters.');
    process.exit(1);
  }

  let models = config.models;
  if (opts.model) models = models.filter((m) => m.id === opts.model);
  if (models.length === 0) {
    console.error(`No model matching --model ${opts.model}`);
    process.exit(1);
  }

  const runsPerTask = opts.runs ?? 1;
  const client = createClient(config.baseUrl);

  console.log(`local-ai-eval agent`);
  console.log(`  Base URL: ${config.baseUrl}`);
  console.log(`  Models: ${models.map((m) => m.id).join(', ')}`);
  console.log(`  Tasks: ${tasks.map((t) => t.id).join(', ')}`);
  console.log(`  Runs per task: ${runsPerTask}`);
  console.log('');

  const startedAt = new Date().toISOString();
  const runs: RunRecord[] = [];

  for (const model of models) {
    console.log(`> ${model.label} (${model.id})`);
    for (const task of tasks) {
      for (let i = 0; i < runsPerTask; i++) {
        const runIndex = i + 1;
        process.stdout.write(
          `  [${model.label}] ${task.id} run ${runIndex}/${runsPerTask}... `
        );
        const { trace, error, totalMs } = await runAgentTask(
          client,
          model,
          task,
          config.requestTimeoutMs
        );
        const checks = error
          ? [
              {
                kind: 'agent.error',
                passed: false,
                detail: error,
              },
            ]
          : scoreAgentRun({ task, trace });
        const passed = !error && checks.every((c) => c.passed);
        runs.push({
          modelId: model.id,
          modelLabel: model.label,
          taskId: task.id,
          workload: task.workload,
          runIndex,
          timing: { totalMs },
          output: trace.finalContent,
          toolCalls: trace.turns.flatMap((t) => t.toolCalls),
          score: { workload: task.workload, passed, checks },
          error,
          agentTrace: trace,
        });
        const status = error ? 'ERROR' : passed ? 'PASS' : 'FAIL';
        console.log(
          `${status} in ${(totalMs / 1000).toFixed(1)}s (${trace.turns.length} turns, ${trace.totalToolCalls} tool calls, term=${trace.terminatedReason})`
        );
      }
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
  await writeJsonReport(join(outDir, 'raw.json'), report);
  await writeMarkdownReport(join(outDir, 'report.md'), report);

  console.log('');
  console.log(`Report written:`);
  console.log(`  ${join(outDir, 'report.md')}`);
  console.log(`  ${join(outDir, 'raw.json')}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
