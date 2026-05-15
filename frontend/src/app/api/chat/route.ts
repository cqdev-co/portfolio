import { createUIMessageStream, createUIMessageStreamResponse } from 'ai';
import { chatRateLimiter } from '@/lib/rate-limit';
import { isUserAuthorized } from '@/lib/auth/whitelist';
import type { XyloUIMessage, ThinkingStep } from '@/lib/chat/types';
import { extractChatArtifact, type ExecutedToolCall } from '@/lib/chat/extract';
import { markModelUnavailable } from '@/lib/ai/model-access';

/**
 * Sentinel sentinel marker the chat route throws when the upstream
 * model returns 401/403 — the outer handler unpacks it into a 403
 * `code: 'model_unavailable'` JSON response so the UI can refresh
 * the selector and auto-switch.
 */
const MODEL_UNAVAILABLE_PREFIX = 'MODEL_UNAVAILABLE::';

// Shared AI agent library (monorepo root)
import {
  buildXyloLitePrompt,
  AGENT_TOOLS,
  toOllamaTools,
  executeToolCall,
  logDecision,
  hashPrompt,
  runPreflight,
  parseRecommendation,
  validateRecommendation,
  skipGate,
  computeConfidence,
  type DecisionToolCall,
  type CoverageReport,
  type PreflightResult,
  type RiskVerdict,
  type ConfidenceScore,
} from '@lib/ai-agent';

export const maxDuration = 60;

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'https://ollama.com/api';
const OLLAMA_API_KEY = process.env.OLLAMA_API_KEY;
const DEFAULT_MODEL = process.env.OLLAMA_MODEL || 'llama3.3:70b-cloud';

const ollamaTools = toOllamaTools(AGENT_TOOLS);

// ============================================================================
// USER-FACING FEATURE TOGGLES
// ============================================================================

type ChatFeatureId = 'web_search' | 'deep_research';

const GATED_TOOL_NAMES: Record<ChatFeatureId, ReadonlySet<string>> = {
  web_search: new Set(['web_search']),
  deep_research: new Set(),
};

const ALL_GATED_TOOL_NAMES = new Set<string>(
  Object.values(GATED_TOOL_NAMES).flatMap((s) => Array.from(s))
);

function selectToolsForRequest(enabled: ReadonlySet<ChatFeatureId>) {
  const allowed = new Set<string>();
  for (const id of enabled) {
    for (const t of GATED_TOOL_NAMES[id] ?? []) allowed.add(t);
  }
  return ollamaTools.filter((tool) => {
    const name = tool.function?.name;
    if (!name) return true;
    if (!ALL_GATED_TOOL_NAMES.has(name)) return true;
    return allowed.has(name);
  });
}

function buildFeatureDirectives(enabled: ReadonlySet<ChatFeatureId>): string {
  const lines: string[] = [];
  if (enabled.has('deep_research')) {
    lines.push(
      '=== DEEP RESEARCH MODE ===',
      'The user has enabled Deep Research for this turn. Take more time:',
      '- Plan a short list of sub-questions before answering.',
      '- Use multiple complementary tools where helpful (web_search if',
      '  enabled, ticker / financials / regime tools as needed).',
      '- Cross-check findings and call out anything ambiguous or contradictory.',
      '- Conclude with a concise actionable synthesis.',
      '=== END DEEP RESEARCH MODE ==='
    );
  }
  if (enabled.has('web_search')) {
    lines.push(
      '=== WEB SEARCH ENABLED ===',
      'The `web_search` tool is available this turn. Prefer it for any',
      'question that depends on current events, recent news, or data',
      'outside your training cutoff.',
      '=== END WEB SEARCH ==='
    );
  }
  return lines.length > 0 ? `\n\n${lines.join('\n')}` : '';
}

function parseEnabledFeatures(value: unknown): Set<ChatFeatureId> {
  const valid: ChatFeatureId[] = ['web_search', 'deep_research'];
  if (!Array.isArray(value)) return new Set();
  const set = new Set<ChatFeatureId>();
  for (const entry of value) {
    if (typeof entry === 'string' && (valid as string[]).includes(entry)) {
      set.add(entry as ChatFeatureId);
    }
  }
  return set;
}

async function buildPreflightedPrompt(question: string): Promise<{
  systemPrompt: string;
  preflight: PreflightResult | null;
}> {
  const basePrompt = buildXyloLitePrompt({
    accountSize: 1750,
    withTools: true,
  });

  try {
    const preflight = await runPreflight(question);
    const block = preflight.formattedContext
      ? `\n\n=== CURRENT MARKET CONTEXT ===\n${preflight.formattedContext}\n=== END CONTEXT ===`
      : '';
    return { systemPrompt: `${basePrompt}${block}`, preflight };
  } catch (error) {
    console.error(
      '[Chat] preflight failed; falling back to static prompt:',
      error
    );
    return { systemPrompt: basePrompt, preflight: null };
  }
}

// Extract text content from UIMessage parts or direct content
function extractContent(msg: {
  role: string;
  content?: string;
  parts?: Array<{ type: string; text?: string }>;
}): string {
  if (msg.parts && Array.isArray(msg.parts)) {
    return msg.parts
      .filter((part) => part.type === 'text' && part.text)
      .map((part) => part.text)
      .join('');
  }
  return msg.content || '';
}

interface OllamaToolCall {
  function: {
    name: string;
    arguments: Record<string, unknown>;
  };
}

// ============================================================================
// XML TOOL CALL PARSER
// Some models (e.g. llama3.3) output tool calls as XML text instead of using
// Ollama's native structured tool_calls format. This parser detects and
// converts those XML-style calls so they can be executed normally.
// ============================================================================

function parseXMLToolCalls(text: string): OllamaToolCall[] {
  const toolCalls: OllamaToolCall[] = [];
  const invokePattern = /<invoke\s+name="([^"]+)"[^>]*>([\s\S]*?)<\/invoke>/g;
  let match;

  while ((match = invokePattern.exec(text)) !== null) {
    const name = match[1];
    const body = match[2];
    const args: Record<string, unknown> = {};

    const paramPattern =
      /<parameter\s+name="([^"]+)"[^>]*>([\s\S]*?)<\/parameter>/g;
    let paramMatch;

    while ((paramMatch = paramPattern.exec(body)) !== null) {
      const paramName = paramMatch[1];
      const rawValue = paramMatch[2].trim();

      if (/^-?\d+\.?\d*$/.test(rawValue)) {
        args[paramName] = parseFloat(rawValue);
      } else if (rawValue === 'true') {
        args[paramName] = true;
      } else if (rawValue === 'false') {
        args[paramName] = false;
      } else {
        args[paramName] = rawValue;
      }
    }

    toolCalls.push({
      function: { name, arguments: args },
    });
  }

  return toolCalls;
}

function stripXMLToolCalls(text: string): string {
  return text
    .replace(/<function_calls>[\s\S]*?<\/function_calls>/g, '')
    .replace(/<invoke\s+name="[^"]*"[^>]*>[\s\S]*?<\/invoke>/g, '')
    .replace(/<\/?(?:function(?:_calls)?|invoke|parameter)\b[^>]*>?/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function findXMLToolCallStart(text: string): number {
  const patterns = ['<function_calls>', '<invoke '];
  let earliest = -1;
  for (const p of patterns) {
    const idx = text.indexOf(p);
    if (idx !== -1 && (earliest === -1 || idx < earliest)) {
      earliest = idx;
    }
  }
  return earliest;
}

function cleanPartialXMLTags(text: string): string {
  return text.replace(
    /<\/?(?:function(?:_calls)?|invoke|parameter)\b[^>]*>?/g,
    ''
  );
}

export async function POST(req: Request) {
  const requestStartedAt = Date.now();
  let loggingContext: {
    userQuestion: string;
    selectedModel: string;
    systemPrompt: string;
    promptVariant: 'lite';
    userId: string | null;
  } | null = null;

  try {
    const authResult = await isUserAuthorized();

    if (!authResult.authorized) {
      console.log(
        `[Chat] Unauthorized access attempt: ${authResult.email || 'unknown'}`
      );
      return new Response(
        JSON.stringify({
          error: 'Unauthorized',
          message: authResult.error,
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`[Chat] Authorized user: ${authResult.email}`);

    const rateLimitKey = authResult.email || 'unknown';
    const rateLimit = chatRateLimiter.check(rateLimitKey);

    if (!rateLimit.allowed) {
      console.log(
        `[Chat] Rate limited: ${rateLimitKey} (resets at ${new Date(rateLimit.resetAt).toISOString()})`
      );
      return new Response(
        JSON.stringify({
          error: 'Rate limit exceeded',
          message:
            'Too many requests. Please wait a moment before sending another message.',
          resetAt: rateLimit.resetAt,
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(
              Math.ceil((rateLimit.resetAt - Date.now()) / 1000)
            ),
            'X-RateLimit-Remaining': '0',
          },
        }
      );
    }

    const { messages, model, enabledFeatures } = await req.json();

    const selectedModel = model || DEFAULT_MODEL;

    const enabledFeatureSet = parseEnabledFeatures(enabledFeatures);
    const requestTools = selectToolsForRequest(enabledFeatureSet);

    const lastUserMessage = [...messages]
      .reverse()
      .find(
        (m: {
          role: string;
          content?: string;
          parts?: Array<{ type: string; text?: string }>;
        }) => m.role === 'user'
      );
    const userQuestion = lastUserMessage ? extractContent(lastUserMessage) : '';

    const { systemPrompt: baseSystemPrompt, preflight } =
      await buildPreflightedPrompt(userQuestion);
    const systemPrompt =
      baseSystemPrompt + buildFeatureDirectives(enabledFeatureSet);
    const coverageReport: CoverageReport | null = preflight?.coverage ?? null;

    if (enabledFeatureSet.size > 0) {
      console.log(
        `[Chat] Enabled features: ${Array.from(enabledFeatureSet).join(', ')} (tools: ${requestTools.length}/${ollamaTools.length})`
      );
    }
    if (coverageReport) {
      console.log(
        `[Chat] Preflight: checked=[${coverageReport.checked.join(',')}] errors=${coverageReport.errors.length}`
      );
    }

    const ollamaMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.map(
        (msg: {
          role: string;
          content?: string;
          parts?: Array<{ type: string; text?: string }>;
        }) => ({
          role: msg.role,
          content: extractContent(msg),
        })
      ),
    ];

    loggingContext = {
      userQuestion,
      selectedModel,
      systemPrompt,
      promptVariant: 'lite',
      userId: authResult.email ?? null,
    };

    const loggedToolCalls: DecisionToolCall[] = [];
    const executedToolCalls: ExecutedToolCall[] = [];
    let finalAssistantText = '';

    const stream = createUIMessageStream<XyloUIMessage>({
      async execute({ writer }) {
        let reasoningId: string | null = null;
        // Plan-narration steps emitted up front (one per tool name) and
        // updated to `done` as each tool resolves. Stable ids are
        // produced from the tool name so the same chunk replaces the
        // running row in place on the client.
        const plannedStepIds = new Set<string>();

        function emitStep(step: ThinkingStep) {
          writer.write({
            type: 'data-thinkingStep',
            id: step.stepId,
            data: step,
          });
        }

        async function processChat(msgs: typeof ollamaMessages) {
          const requestBody = {
            model: selectedModel,
            messages: msgs,
            tools: requestTools,
            stream: true,
          };

          console.log(`[Chat] Sending request to ${selectedModel} with tools`);

          const response = await fetch(`${OLLAMA_BASE_URL}/chat`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(OLLAMA_API_KEY && {
                Authorization: `Bearer ${OLLAMA_API_KEY}`,
              }),
            },
            body: JSON.stringify(requestBody),
          });

          if (!response.ok) {
            const errorText = await response.text();

            if (response.status === 429) {
              throw new Error(
                'Rate limit reached. Please wait a moment before trying again.'
              );
            }
            if (response.status === 503 || response.status === 502) {
              throw new Error(
                'AI service is temporarily unavailable. Please try again.'
              );
            }
            if (response.status === 401 || response.status === 403) {
              // Per-model 401/403 from Ollama means the configured
              // API key isn't entitled to run this model. Mark it in
              // the in-memory denylist so `/api/chat/models` filters
              // it out on the next selector refresh, and surface a
              // structured signal to the UI so it can auto-switch.
              markModelUnavailable(selectedModel);
              throw new Error(`${MODEL_UNAVAILABLE_PREFIX}${selectedModel}`);
            }

            throw new Error(
              `Ollama API error: ${response.status} - ${errorText}`
            );
          }

          if (!response.body) {
            throw new Error('No response body');
          }

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let textId: string | null = null;
          let buffer = '';
          let pendingToolCalls: OllamaToolCall[] = [];
          let assistantContent = '';
          let xmlToolCallDetected = false;

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (!line.trim()) continue;

              try {
                const json = JSON.parse(line);

                if (!textId && !reasoningId) {
                  console.log(
                    '[Chat] First response chunk:',
                    JSON.stringify(json).slice(0, 200)
                  );
                }

                if (json.message?.tool_calls) {
                  pendingToolCalls = json.message.tool_calls;
                  console.log(
                    `[Chat] Tool calls detected:`,
                    JSON.stringify(pendingToolCalls).slice(0, 200)
                  );
                }

                // Reasoning / thinking content streams as native
                // `reasoning-*` chunks now — the client renders these
                // through `<ThinkingBlock>`.
                const thinking =
                  json.message?.reasoning_content || json.message?.thinking;
                if (thinking) {
                  if (!reasoningId) {
                    reasoningId = crypto.randomUUID();
                    writer.write({
                      type: 'reasoning-start',
                      id: reasoningId,
                    });
                  }
                  writer.write({
                    type: 'reasoning-delta',
                    id: reasoningId,
                    delta: thinking,
                  });
                }

                const content = json.message?.content || json.response;
                if (content) {
                  assistantContent += content;

                  if (
                    !xmlToolCallDetected &&
                    findXMLToolCallStart(assistantContent) !== -1
                  ) {
                    xmlToolCallDetected = true;
                    console.log(
                      '[Chat] XML tool call detected in text output - suppressing from stream'
                    );
                  }

                  if (!xmlToolCallDetected) {
                    const cleanedContent = cleanPartialXMLTags(content);

                    if (cleanedContent.trim()) {
                      // Close the reasoning block as soon as actual
                      // assistant text starts streaming.
                      if (reasoningId) {
                        writer.write({
                          type: 'reasoning-end',
                          id: reasoningId,
                        });
                        reasoningId = null;
                      }

                      if (!textId) {
                        textId = crypto.randomUUID();
                        writer.write({ type: 'text-start', id: textId });
                      }

                      writer.write({
                        type: 'text-delta',
                        id: textId,
                        delta: cleanedContent,
                      });
                    }
                  }
                }

                if (json.done) {
                  if (pendingToolCalls.length === 0 && assistantContent) {
                    const xmlToolCalls = parseXMLToolCalls(assistantContent);
                    if (xmlToolCalls.length > 0) {
                      console.log(
                        `[Chat] Parsed ${xmlToolCalls.length} XML tool call(s) from text output:`,
                        xmlToolCalls.map((tc) => tc.function.name)
                      );
                      pendingToolCalls = xmlToolCalls;
                      assistantContent = stripXMLToolCalls(assistantContent);
                    }
                  }

                  console.log(
                    `[Chat] Stream done. Pending tools: ${pendingToolCalls.length}`
                  );

                  if (textId) {
                    writer.write({ type: 'text-end', id: textId });
                    textId = null;
                  }

                  if (assistantContent.trim()) {
                    finalAssistantText = stripXMLToolCalls(assistantContent);
                  }

                  if (pendingToolCalls.length > 0) {
                    const newMsgs = [
                      ...msgs,
                      {
                        role: 'assistant',
                        content: assistantContent || null,
                        tool_calls: pendingToolCalls,
                      },
                    ];

                    for (const tc of pendingToolCalls) {
                      const toolName = tc.function.name;
                      const toolArgs = tc.function.arguments;
                      const toolCallId = `${toolName}-${crypto.randomUUID()}`;

                      console.log(
                        `[Chat] Executing tool: ${toolName}`,
                        toolArgs
                      );

                      // Tool input lifecycle (typed parts).
                      writer.write({
                        type: 'tool-input-start',
                        toolCallId,
                        toolName,
                        dynamic: true,
                      });
                      writer.write({
                        type: 'tool-input-available',
                        toolCallId,
                        toolName,
                        input: toolArgs,
                        dynamic: true,
                      });

                      // Plan-step row (running) for this tool. We
                      // emit one step per tool, keyed by name, and
                      // upgrade to `done` after the tool resolves.
                      const planStepId = `plan-${toolName}`;
                      if (!plannedStepIds.has(planStepId)) {
                        plannedStepIds.add(planStepId);
                      }
                      emitStep({
                        stepId: planStepId,
                        label: humanizeToolPlanLabel(toolName),
                        detail: planDetail(toolName, toolArgs),
                        status: 'running',
                      });

                      const toolStartedAt = Date.now();
                      const result = await executeToolCall(
                        { name: toolName, arguments: toolArgs },
                        { apiKey: OLLAMA_API_KEY }
                      );
                      loggedToolCalls.push({
                        name: toolName,
                        args: toolArgs,
                        latency_ms: Date.now() - toolStartedAt,
                        ok: !!result.success,
                        error: result.success ? undefined : result.error,
                      });

                      console.log(`[Chat] Tool ${toolName} result:`, {
                        success: result.success,
                        hasData: !!result.data,
                        hasFormatted: !!result.formatted,
                        error: result.error,
                      });

                      if (result.success && result.data) {
                        executedToolCalls.push({
                          name: toolName,
                          args: toolArgs,
                          output: result.data,
                        });
                        writer.write({
                          type: 'tool-output-available',
                          toolCallId,
                          output: {
                            data: result.data,
                            formatted: result.formatted ?? null,
                          },
                          dynamic: true,
                        });
                        emitStep({
                          stepId: planStepId,
                          label: humanizeToolPlanLabel(toolName),
                          detail: planDetail(toolName, toolArgs),
                          status: 'done',
                        });
                      } else {
                        writer.write({
                          type: 'tool-output-error',
                          toolCallId,
                          errorText: result.error || 'Tool execution failed',
                          dynamic: true,
                        });
                        emitStep({
                          stepId: planStepId,
                          label: humanizeToolPlanLabel(toolName),
                          detail:
                            result.error ?? planDetail(toolName, toolArgs),
                          status: 'done',
                        });
                      }

                      newMsgs.push({
                        role: 'tool',
                        content:
                          result.formatted ||
                          result.error ||
                          JSON.stringify(result.data),
                        tool_call_id: toolCallId,
                      } as (typeof newMsgs)[number]);
                    }

                    await processChat(newMsgs);
                  }
                }
              } catch {
                // Skip non-JSON lines
              }
            }
          }

          if (buffer.trim()) {
            try {
              const json = JSON.parse(buffer);
              const bufferContent = json.message?.content || json.response;
              if (bufferContent && textId) {
                writer.write({
                  type: 'text-delta',
                  id: textId,
                  delta: bufferContent,
                });
              }
              if (json.done && textId) {
                writer.write({ type: 'text-end', id: textId });
              }
            } catch {
              // Ignore
            }
          }

          if (textId) {
            writer.write({ type: 'text-end', id: textId });
          }
          if (reasoningId) {
            writer.write({ type: 'reasoning-end', id: reasoningId });
            reasoningId = null;
          }
        }

        await processChat(ollamaMessages);

        // ====================================================================
        // POST-TURN: risk gate, coverage, artifact, suggestions
        // ====================================================================

        let riskVerdict: RiskVerdict;
        try {
          const parsed = await parseRecommendation(finalAssistantText, {
            enableModelFallback: false,
          });
          if (!parsed) {
            riskVerdict = skipGate('no structured "My call:" line found');
          } else {
            const tickerData =
              (preflight?.signals.ticker_data as
                | Array<Record<string, unknown>>
                | undefined) ?? [];
            const ctx = tickerData.find(
              (t) =>
                String(t?.ticker ?? '').toUpperCase() ===
                parsed.ticker.toUpperCase()
            );
            riskVerdict = validateRecommendation({
              recommendation: parsed,
              account: { sizeUSD: 1750 },
              positions: [],
              tickerContext: ctx
                ? {
                    rsi: ctx.rsi as number | undefined,
                    iv_pct: (ctx.iv as Record<string, number> | undefined)
                      ?.currentIV,
                    aboveMA200: ctx.aboveMA200 as boolean | undefined,
                    daysUntilEarnings:
                      (ctx.earnings as Record<string, number> | undefined)
                        ?.daysUntil ?? null,
                  }
                : undefined,
            });
          }
        } catch (err) {
          console.error('[Chat] risk gate error:', err);
          riskVerdict = skipGate(
            `gate error: ${err instanceof Error ? err.message : String(err)}`
          );
        }

        if (coverageReport) {
          writer.write({
            type: 'data-coverage',
            data: {
              checked: coverageReport.checked,
              skipped: coverageReport.skipped,
              stale: coverageReport.stale,
              errors: coverageReport.errors,
              latencies: coverageReport.latencies,
              digests: coverageReport.digests,
            },
          });
        }

        // Phase 2 PR C: confidence score over coverage + risk + signal_agreement.
        let confidence: ConfidenceScore | null = null;
        try {
          confidence = computeConfidence({
            coverage: coverageReport,
            riskVerdict: riskVerdict.gate_skipped ? null : riskVerdict,
            action: riskVerdict.recommendation?.action ?? null,
          });
        } catch (err) {
          console.error('[Chat] confidence error:', err);
        }

        writer.write({
          type: 'data-riskGate',
          data: {
            approved: riskVerdict.approved,
            gate_skipped: riskVerdict.gate_skipped,
            violations: riskVerdict.violations,
            recommendation: riskVerdict.recommendation
              ? {
                  ticker: riskVerdict.recommendation.ticker,
                  action: riskVerdict.recommendation.action,
                  spread: riskVerdict.recommendation.spread,
                }
              : null,
            confidence: confidence
              ? {
                  score: confidence.score,
                  components: confidence.components,
                }
              : null,
          },
        });

        // Synthesise an artifact + follow-up chips from the executed
        // tool calls. Returns null payloads when the turn doesn't
        // match any known shape (e.g. plain Q&A); the chat falls
        // back to text-only in that case.
        try {
          const extraction = extractChatArtifact(executedToolCalls);
          if (extraction.artifact) {
            writer.write({
              type: 'data-artifact',
              id: extraction.artifact.artifactId,
              data: extraction.artifact,
            });
          }
          if (extraction.suggestions && extraction.suggestions.chips.length) {
            writer.write({
              type: 'data-suggestions',
              data: extraction.suggestions,
            });
          }
        } catch (err) {
          console.error('[Chat] extractor failed:', err);
        }

        if (loggingContext) {
          void logDecision({
            source: 'frontend',
            user_id: loggingContext.userId,
            user_question: loggingContext.userQuestion,
            model_id: loggingContext.selectedModel,
            prompt_hash: hashPrompt(loggingContext.systemPrompt),
            prompt_variant: loggingContext.promptVariant,
            tool_calls: loggedToolCalls,
            final_response: finalAssistantText,
            total_latency_ms: Date.now() - requestStartedAt,
            question_class: preflight?.classification.type ?? null,
            ticker:
              riskVerdict.recommendation?.ticker ||
              preflight?.classification.tickers[0] ||
              null,
            recommendation_type:
              riskVerdict.recommendation?.spread?.type ??
              (riskVerdict.recommendation?.action === 'HOLD'
                ? 'hold'
                : riskVerdict.recommendation?.action === 'AVOID'
                  ? 'avoid'
                  : null),
            coverage_report: coverageReport,
            risk_violations: riskVerdict.gate_skipped
              ? null
              : riskVerdict.violations,
            confidence: confidence?.score ?? null,
          });
        }
      },
      onError: (error) => {
        const rawMessage =
          error instanceof Error ? error.message : 'Unknown error';
        // The `MODEL_UNAVAILABLE` sentinel is an *expected* signal —
        // not a bug — that the route emits whenever Ollama 401s for
        // a per-model access reason. Logging it as `console.error`
        // (with a stack trace) is misleading; a one-line warn is
        // enough since the UI handles it and surfaces a friendly
        // banner to the user.
        if (rawMessage.startsWith(MODEL_UNAVAILABLE_PREFIX)) {
          const id = rawMessage.slice(MODEL_UNAVAILABLE_PREFIX.length);
          console.warn(
            `[Chat] Model "${id}" is not available on this API key; the UI will auto-switch.`
          );
        } else {
          console.error('Stream error:', error);
        }
        const message = rawMessage.startsWith(MODEL_UNAVAILABLE_PREFIX)
          ? `${MODEL_UNAVAILABLE_PREFIX}${rawMessage.slice(
              MODEL_UNAVAILABLE_PREFIX.length
            )} :: This model isn't available on your Ollama plan. Switching to another model.`
          : rawMessage;
        if (loggingContext) {
          void logDecision({
            source: 'frontend',
            user_id: loggingContext.userId,
            user_question: loggingContext.userQuestion,
            model_id: loggingContext.selectedModel,
            prompt_hash: hashPrompt(loggingContext.systemPrompt),
            prompt_variant: loggingContext.promptVariant,
            tool_calls: loggedToolCalls,
            final_response: finalAssistantText || `[error] ${message}`,
            total_latency_ms: Date.now() - requestStartedAt,
            question_class: preflight?.classification.type ?? null,
            ticker: preflight?.classification.tickers[0] ?? null,
            coverage_report: coverageReport,
          });
        }
        return message;
      },
    });

    return createUIMessageStreamResponse({ stream });
  } catch (error) {
    console.error('Chat API error:', error);

    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';

    if (loggingContext) {
      void logDecision({
        source: 'frontend',
        user_id: loggingContext.userId,
        user_question: loggingContext.userQuestion,
        model_id: loggingContext.selectedModel,
        prompt_hash: hashPrompt(loggingContext.systemPrompt),
        prompt_variant: loggingContext.promptVariant,
        tool_calls: [],
        final_response: `[error] ${errorMessage}`,
        total_latency_ms: Date.now() - requestStartedAt,
      });
    }

    return new Response(
      JSON.stringify({
        error: 'Failed to process chat request',
        details: errorMessage,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Human-readable plan-step label per tool name. Sentence-cased so
 * the row reads as a checklist item rather than a function name.
 */
function humanizeToolPlanLabel(name: string): string {
  switch (name) {
    case 'get_ticker_data':
      return 'Pulled live market data.';
    case 'web_search':
      return 'Scanned the open web.';
    case 'get_financials_deep':
      return 'Reviewed the latest financials.';
    case 'get_institutional_holdings':
      return 'Checked institutional ownership.';
    case 'get_unusual_options_activity':
      return 'Inspected unusual options activity.';
    case 'get_trading_regime':
      return 'Read the current trading regime.';
    case 'get_iv_by_strike':
      return 'Sampled IV by strike.';
    case 'calculate_spread':
      return 'Sized a candidate spread.';
    case 'get_sector_flow':
      return 'Surveyed sector flow.';
    case 'get_recent_news':
      return 'Scanned recent headlines.';
    case 'get_sentiment':
      return 'Gauged sentiment.';
    case 'get_earnings_calendar':
      return 'Checked the earnings calendar.';
    case 'get_geopolitical_events':
      return 'Reviewed geopolitical events.';
    default:
      return `Ran ${name}.`;
  }
}

/**
 * Free-text detail line for a planning step — usually the ticker /
 * query that the tool was invoked with so the row stays specific.
 */
function planDetail(
  name: string,
  args: Record<string, unknown>
): string | undefined {
  const ticker = (args.ticker as string | undefined) ?? '';
  const query = (args.query as string | undefined) ?? '';
  if (ticker) return `${name}: ${ticker.toUpperCase()}`;
  if (query) return `${name}: ${query.slice(0, 64)}`;
  return undefined;
}
