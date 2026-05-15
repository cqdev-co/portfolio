/**
 * Types for the local AI eval harness.
 *
 * Tasks are loaded from tasks/*.json, models from models.config.json.
 * Reports are written to reports/{timestamp}/.
 */

export type Workload =
  | 'chat'
  | 'briefing'
  | 'narrative'
  | 'tool-call'
  | 'agent-multi-turn';

export interface ToolParameterProperty {
  type: string;
  description: string;
  enum?: string[];
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      required?: string[];
      properties: Record<string, ToolParameterProperty>;
    };
  };
}

export type ContentCheck =
  | { kind: 'contains'; value: string; caseInsensitive?: boolean }
  | { kind: 'notContains'; value: string; caseInsensitive?: boolean }
  | { kind: 'regex'; pattern: string; flags?: string }
  | { kind: 'maxLength'; chars: number }
  | { kind: 'minLength'; chars: number };

export interface Task {
  id: string;
  workload: Workload;
  description?: string;
  system: string;
  user: string;
  tools?: ToolDefinition[];
  /**
   * JSON Schema subset used for briefing/narrative workloads.
   * Only `type: "object"` with `properties` + `required` is honored in V1.
   */
  expectedSchema?: {
    type: 'object';
    required?: string[];
    properties: Record<string, { type: string }>;
  };
  contentChecks?: ContentCheck[];
  expectedTool?: { name: string; requiredArgs?: string[] };
  tags?: string[];
  /**
   * Multi-turn agent configuration. Present only when `workload === 'agent-multi-turn'`.
   * The agent runner loads mock responses keyed by tool name (plus optional arg
   * matchers) and injects them back into the conversation when the model calls a
   * tool, up to `maxTurns` iterations.
   */
  agent?: AgentConfig;
}

export interface MockToolResponse {
  /** Name of the tool this mock responds to. */
  tool: string;
  /**
   * Optional argument matchers. All listed pairs must be present in the model's
   * tool_call.arguments for the mock to apply. If omitted, any call to `tool`
   * matches. First matching mock in the list wins.
   */
  argsContain?: Record<string, string | number | boolean>;
  /** JSON-serializable payload returned to the model as the tool's result. */
  response: unknown;
}

export interface ExpectedToolStep {
  /** Tool name. Use `|` to allow any of several names, e.g. `"get_ticker_data|web_search"`. */
  tool: string;
  /** Optional required args the step's tool call should include. */
  requiredArgs?: string[];
  /** Whether this step is optional (model may skip it and still pass). */
  optional?: boolean;
}

export interface AgentConfig {
  /** Hard cap on total assistant turns before we abort and score the partial run. */
  maxTurns: number;
  /** Mock responses for tools the model may call. */
  mockToolResponses: MockToolResponse[];
  /**
   * Expected tool sequence. The runner scores "sequence match" by walking this
   * list in order; model may interleave extra tools (scored separately as
   * "unexpected calls").
   */
  expectedToolSequence?: ExpectedToolStep[];
  /**
   * Content checks to run against the FINAL assistant message (the one with no
   * tool calls, after the model has decided it's done).
   */
  finalContentChecks?: ContentCheck[];
  /**
   * Optional: cap on total tool calls allowed. If exceeded, task fails.
   * Useful to catch infinite-loop or over-calling behaviors.
   */
  maxToolCalls?: number;
}

export interface ModelEntry {
  id: string;
  label: string;
  /** Passed straight to Ollama `options` (temperature, num_ctx, num_predict, ...) */
  options?: Record<string, unknown>;
  /** Optional per-model override for think mode */
  think?: boolean;
  /** Optional note for humans reading the report */
  note?: string;
  /**
   * Which workloads this model is preferred for, based on eval results.
   * Consumed by downstream code (e.g. env-driven resolver) to pick a model per
   * workload instead of hardcoding a single default.
   */
  preferredFor?: Workload[];
  /**
   * Free-form quality/reliability caveats surfaced by the eval. Not programmatic;
   * meant for humans reading the config to understand known failure modes.
   */
  caveats?: string[];
}

export interface ModelsConfig {
  baseUrl: string;
  models: ModelEntry[];
  runsPerTask: number;
  requestTimeoutMs: number;
}

export interface CheckResult {
  kind: string;
  passed: boolean;
  detail?: string;
}

export interface ScoreResult {
  workload: Workload;
  passed: boolean;
  checks: CheckResult[];
}

export interface RunTiming {
  totalMs: number;
  firstTokenMs?: number;
  promptTokens?: number;
  completionTokens?: number;
  tokensPerSec?: number;
}

export interface RunRecord {
  modelId: string;
  modelLabel: string;
  taskId: string;
  workload: Workload;
  runIndex: number;
  timing: RunTiming;
  output: string;
  toolCalls?: Array<{ name: string; arguments: Record<string, unknown> }>;
  score: ScoreResult;
  error?: string;
  /** Present only for agent-multi-turn runs. */
  agentTrace?: AgentTrace;
}

export interface AgentTurn {
  turn: number;
  durationMs: number;
  content: string;
  toolCalls: Array<{ name: string; arguments: Record<string, unknown> }>;
  mockedToolResults: Array<{ tool: string; responsePreview: string }>;
  terminatedReason?:
    | 'final-answer'
    | 'max-turns'
    | 'max-tool-calls'
    | 'no-matching-mock'
    | 'error';
}

export interface AgentTrace {
  turns: AgentTurn[];
  totalToolCalls: number;
  uniqueTools: string[];
  terminatedReason: AgentTurn['terminatedReason'];
  finalContent: string;
}

export interface Report {
  startedAt: string;
  finishedAt: string;
  host: {
    platform: string;
    arch: string;
    nodeVersion: string;
  };
  config: ModelsConfig;
  tasks: Array<Pick<Task, 'id' | 'workload' | 'description'>>;
  runs: RunRecord[];
}
