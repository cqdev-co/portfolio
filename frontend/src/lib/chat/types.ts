/**
 * Typed UI message contract shared between the server-side stream
 * (`/api/chat/route.ts`) and the client (`@ai-sdk/react`'s `useChat`).
 *
 * The chat upgrade migrates the transport off HTML-comment markers
 * embedded in `text-delta` chunks and onto native AI SDK v6 typed
 * UI message parts:
 *
 * - `text-*` for the assistant prose
 * - `reasoning-*` for live thinking content
 * - `tool-input-*` / `tool-output-*` for tool lifecycle (with
 *   `dynamic: true` so we don't have to declare static `UITool`s)
 * - `data-<NAME>` for structured side-channel events that drive
 *   custom UI: thinking-step bullets, coverage / risk strips,
 *   artifacts, and recommended-next-action chips.
 *
 * Centralising the data-part shapes here lets both `createUIMessageStream`
 * (server) and `useChat<XyloUIMessage>` (client) typecheck the
 * `writer.write` and `message.parts` payloads end-to-end.
 */

import type { UIMessage } from 'ai';
import type { CoverageReportPayload } from '@/components/chat/coverage-strip';
import type { RiskGatePayload } from '@/components/chat/risk-gate-strip';

// ---------------------------------------------------------------------------
// data-thinkingStep — driver for the `<ThinkingBlock>` checklist
// ---------------------------------------------------------------------------

/**
 * One row in the assistant's planning narration. Streams in while the
 * server is preparing/executing tools and collapses into the
 * "Thought for Xs" summary once the assistant text starts. Multiple
 * steps with distinct ids may stream; the client renders them in
 * order. Repeating the same `id` lets the server transition a step
 * from `running` to `done` without inserting a new row.
 */
export type ThinkingStep = {
  /** Stable id; reused to update the same row in place. */
  stepId: string;
  /** Short row label, e.g. "Using Microsoft as the benchmark". */
  label: string;
  /** Optional supporting detail rendered under the label. */
  detail?: string;
  status: 'running' | 'done';
};

// ---------------------------------------------------------------------------
// data-artifact — streamed canvas-style document (PDF preview shell)
// ---------------------------------------------------------------------------

/**
 * Block-level content the artifact panel knows how to render. Kept
 * intentionally narrow so the contract stays easy to evolve; the
 * client renders unknown blocks as a no-op rather than throwing.
 */
export type ArtifactBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'callout'; tone?: 'info' | 'warn'; text: string }
  | {
      type: 'metricGrid';
      items: { label: string; value: string; hint?: string }[];
    }
  | {
      type: 'returnTable';
      columns: string[];
      rows: { period: string; values: (string | number)[] }[];
    }
  | {
      type: 'returnChart';
      series: { name: string; color?: string }[];
      points: { x: string; values: number[] }[];
    };

export type ArtifactKind = 'pdf' | 'deck' | 'mail' | 'table';

export type ArtifactPayload = {
  /** Stable id; the inline `<ArtifactCard>` opens the panel by id. */
  artifactId: string;
  title: string;
  filename: string;
  kind: ArtifactKind;
  /** Short tagline shown in the inline card. */
  summary?: string;
  /** Lead bullets rendered at the top of the side panel. */
  keyTakeaways?: string[];
  blocks: ArtifactBlock[];
  /** Hero callout chip, e.g. { label: 'LARGEST SPREAD', value: '1Y +23.28 pts' }. */
  hero?: { label: string; value: string };
  generatedAt?: string;
};

// ---------------------------------------------------------------------------
// data-suggestions — post-reply recommended next actions
// ---------------------------------------------------------------------------

export type SuggestionChipKind = 'pdf' | 'deck' | 'mail' | 'compare' | 'table';

export type SuggestionChip = {
  /** Slash prefix shown inside the pill (e.g. `/pdf`). */
  slash: SuggestionChipKind;
  /** Action label shown after the slash, e.g. "Generate board-ready PDF". */
  label: string;
  /** Underlying prompt that gets sent when the chip is clicked. */
  prompt: string;
};

export type SuggestionsPayload = {
  chips: SuggestionChip[];
};

// ---------------------------------------------------------------------------
// XyloUIMessage — the one type both ends of the wire share
// ---------------------------------------------------------------------------

export type XyloDataParts = {
  thinkingStep: ThinkingStep;
  coverage: CoverageReportPayload;
  riskGate: RiskGatePayload;
  artifact: ArtifactPayload;
  suggestions: SuggestionsPayload;
};

export type XyloUIMessage = UIMessage<unknown, XyloDataParts>;
