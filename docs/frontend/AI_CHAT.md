# AI Chat Feature

## Overview

A trading-focused AI chat assistant powered by **Ollama Cloud**, rendered
as a **persistent overlay** that opens over the current page when the
URL is `/chat` (replacing the previous floating panel). Uses the
**Xylo** persona - a 67-year-old Wall Street veteran specializing
in Deep ITM Call Debit Spreads.

The overlay is mounted from the root layout, so opening the chat does
not feel like a route navigation: the previous page stays mounted in the
background and the chat surface visibly rises from the dock over it.

**Shared Logic**: The chat uses the same Xylo persona as the CLI
(ai-analyst). See [AI Agent Integration](../ai-agent/INTEGRATION_PLAN.md).

## Architecture

```
frontend/src/
├── app/
│   ├── layout.tsx                # Mounts <ChatOverlay /> in <Suspense>
│   ├── api/chat/
│   │   ├── route.ts              # Streaming API with tool calling
│   │   └── models/route.ts       # Enriched model list (provider, params, tags)
│   └── chat/
│       ├── page.tsx              # Empty placeholder (route only)
│       └── chat-experience.tsx   # Client: empty/thread states + morph
├── components/
│   ├── navbar.tsx            # Floating dock; sparkle toggles /chat
│   └── chat/
│       ├── index.ts                # Export barrel
│       ├── chat-overlay.tsx        # Persistent overlay (rises from dock)
│       ├── chat-messages.tsx       # Message list with smart scroll
│       ├── chat-message.tsx        # Renders typed UIMessage parts
│       ├── chat-input.tsx          # Composer card hosting model selector
│       ├── chat-model-selector.tsx # Provider-grouped model picker
│       ├── chat-actions-popover.tsx# Per-turn capability toggles (Onyx-style)
│       ├── chat-context.tsx        # openChat() router shim + ⌘K toggle
│       ├── typewriter-text.tsx     # Typewriter effect for messages
│       ├── tool-call-card.tsx      # Animated tool execution cards
│       ├── stream-progress.tsx     # Circular/linear progress indicators
│       ├── ticker-data-card.tsx    # Data card for ticker info
│       ├── thinking-block.tsx      # Collapsible Thinking…/Thought for Xs
│       ├── coverage-strip.tsx      # Phase 1 coverage strip
│       ├── risk-gate-strip.tsx     # Phase 2 risk-gate verdict pill
│       ├── ticker-chip.tsx         # Inline ticker pill (e.g. AAPL chip)
│       ├── insight-card.tsx        # Inline rich card with metric grid
│       ├── return-chart.tsx        # Recharts multi-series line chart
│       ├── return-table.tsx        # Comparison table (period × series)
│       ├── suggestion-chips.tsx    # "Try Next" /slash-prefixed pills
│       ├── artifact-context.tsx    # ChatArtifactProvider + registry
│       ├── artifact-card.tsx       # Inline artifact placeholder (opens panel)
│       ├── artifact-panel.tsx      # Right-side artifact preview drawer
│       └── chat-icons.tsx          # SVG icons (Sparkles, Copy, etc.)
├── hooks/
│   └── use-scroll-to-bottom.ts  # Smart scroll with momentum detection
├── lib/chat/
│   ├── types.ts                # XyloUIMessage + data-part shapes
│   └── extract.ts              # Tool output → artifact / suggestions
└── lib/ai/
    ├── models.ts             # Legacy ChatModel/chatModels list
    ├── chat-model-store.ts   # Cookie-backed model preference (xylo_chat_model)
    ├── model-access.ts       # Server-side denylist of inaccessible model ids
    ├── model-meta.ts         # parseModelMeta() — pure id → metadata
    └── providers.tsx         # Provider registry + ProviderIcon (SVG marks)
```

## Dependencies

```json
{
  "ai": "^6.0.0",
  "@ai-sdk/react": "^3.0.0",
  "react-markdown": "^10.0.0",
  "remark-gfm": "^4.0.0",
  "framer-motion": "^11.0.0"
}
```

## Configuration

### Environment Variables

| Variable          | Default                  | Description                                                                                                  |
| ----------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `OLLAMA_API_KEY`  | -                        | **Required.** Your Ollama Cloud API key                                                                      |
| `OLLAMA_BASE_URL` | `https://ollama.com/api` | Ollama Cloud API endpoint                                                                                    |
| `OLLAMA_MODEL`    | `llama3.3:70b-cloud`     | _Optional._ Server-side fallback used by `/api/chat` only when the request body has no `model` field — rare. |

> The chat experience no longer ships a `NEXT_PUBLIC_OLLAMA_MODEL`
> default. The active model is **persisted in a client-side cookie**
> (`xylo_chat_model`, see "Model preference persistence" below); the
> first time a user lands on `/chat` with no cookie, the model
> selector auto-picks the first model returned by `/api/chat/models`
> and that selection is written to the cookie for subsequent visits.

### Setup

1. **Create an Ollama account**: https://ollama.com
2. **Generate an API key**: https://ollama.com/settings/keys
3. **Add to `.env.local`** (in `frontend/`) **OR `.env`** (at the monorepo root):

```bash
OLLAMA_API_KEY=your_api_key_here
OLLAMA_BASE_URL=https://ollama.com/api
# OLLAMA_MODEL is optional — only set it if you want a server-side
# fallback when the request body somehow omits the model field.
```

> **Monorepo env loader.** `frontend/next.config.js` calls
> `process.loadEnvFile('../.env')` before Next.js's own loader runs,
> so secrets stored in the **repo-root `.env`** (used by the shared
> `@lib/ai-agent` workspace and the CLIs) are visible to the chat
> route. Per-environment overrides in `frontend/.env.local` still
> win because Next.js loads `.env.local` _after_ `next.config.js`.
> Practical implication: you can keep one `.env` file with
> `FMP_API_KEY`, `POLYGON_API_TOKEN`, `YAHOO_PROXY_URL`,
> `SUPABASE_SERVICE_ROLE_KEY`, etc. at the repo root and the
> frontend will pick them up automatically.

### Model preference persistence

The user's chosen model is stored client-side in the cookie
`xylo_chat_model` via `lib/ai/chat-model-store.ts`:

- `getStoredChatModel()` — read the saved id (`null` if missing/SSR).
- `setStoredChatModel(id)` — write with `max-age=1y`, `path=/`, `SameSite=Lax`.
- `clearStoredChatModel()` — best-effort delete (`max-age=0`).

`ChatExperience` keeps `selectedModel` in `useState('')` and hydrates
the cookie value in a **post-mount `useEffect`** — _not_ in the lazy
initialiser. Reading `document.cookie` during render would mismatch
the SSR pass (where `document` is undefined and the initial value
would be `''`) against the first client render (where the lazy
initialiser would return the saved id), and React's hydration would
align the wrong DOM nodes (e.g. the model selector against the
microphone button). Hydrating in `useEffect` guarantees server and
first-client render produce identical trees, then the cookie value
is applied on the next tick.

Correspondingly, `ChatInput` gates the model-selector slot on
`Boolean(onModelChange)` only — _not_ `Boolean(selectedModel &&
onModelChange)` — so the slot is always present in the right
cluster. `ChatModelSelector` itself handles `selectedModel === ''`
gracefully: it shows a small loading spinner until `/api/chat/models`
resolves, then either picks up the cookie value the parent just
hydrated, or auto-picks the first model from the API list and writes
that choice back to the cookie via `onModelChange`. From that point
on, the user's selection is sticky.

The cookie is **never read server-side** — the active model is
forwarded to `/api/chat` via `DefaultChatTransport({ body: { model
} })`, so the cookie is purely a UX continuity primitive. (Reading
it via `next/headers` is straightforward if SSR'd initial state
becomes desirable later — the cookie name and string shape are
stable.)

## Streaming Protocol (April 2026 — typed UI parts)

The chat transport is now **AI SDK v6 typed UI message parts** end-to-end.
The previous approach embedded HTML-comment markers (`<!--TOOL_START:…:START-->`,
`<!--THINKING_START-->`, `<!--COVERAGE:…:COVERAGE-->`, etc.) inside `text-delta`
chunks and parsed them out on the client with regex; that pipeline is gone.

The single source of truth is `frontend/src/lib/chat/types.ts`, which defines
`XyloUIMessage` and the discriminated `data-*` part shapes. Both
`createUIMessageStream<XyloUIMessage>` (server) and `useChat<XyloUIMessage>`
(client) typecheck against it.

### Server → Client chunks

`/api/chat/route.ts` writes the following chunk types via the
`UIMessageStreamWriter`:

| Chunk type                                              | Purpose                                                       |
| ------------------------------------------------------- | ------------------------------------------------------------- |
| `text-start` / `text-delta` / `text-end`                | Assistant prose                                               |
| `reasoning-start` / `reasoning-delta` / `reasoning-end` | Live "thinking" content (DeepSeek-style)                      |
| `tool-input-start` / `tool-input-available`             | Tool invocation; emits `dynamic: true` + `toolName`           |
| `tool-output-available` / `tool-output-error`           | Tool result or error                                          |
| `data-thinkingStep`                                     | Plan-narration row (running → done) for the `<ThinkingBlock>` |
| `data-coverage`                                         | Phase 1 coverage report payload                               |
| `data-riskGate`                                         | Phase 2 risk-gate verdict + confidence                        |
| `data-artifact`                                         | Streamed canvas-style document (id, title, blocks, hero, …)   |
| `data-suggestions`                                      | Post-reply slash-prefixed follow-up chips                     |

Tool parts use the SDK's `dynamic: true` flag so the route can emit them
without declaring static `UITool` schemas. On the client they appear as
`{ type: 'dynamic-tool', toolName, toolCallId, state, … }` parts.

### Client message projection

`chat-message.tsx` walks `message.parts` once and projects them into discrete
UI surfaces (no regex parsing). Each projection step is exhaustive:

```ts
for (const part of message.parts) {
  switch (part.type) {
    case 'text': // accumulate into prose
    case 'reasoning': // feed <ThinkingBlock>
    case 'data-thinkingStep': // upsert into the step list (running → done)
    case 'data-coverage': // <CoverageStrip>
    case 'data-riskGate': // <RiskGateStrip>
    case 'data-artifact': // register with <ArtifactPanel>; render <ArtifactCard>
    case 'data-suggestions': // <SuggestionChips>
    case 'dynamic-tool': // <ToolCallCard> (running / complete / error)
  }
}
```

### Component map

| Component           | Driven by                                                                                           | Responsibility                                                      |
| ------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `<ThinkingBlock>`   | `reasoning` + `data-thinkingStep`                                                                   | Collapsible "Thinking…" → "Thought for Xs"; bullet checklist        |
| `<ToolCallCard>`    | `dynamic-tool`                                                                                      | Running spinner → green check; expand for TOON output               |
| `<CoverageStrip>`   | `data-coverage`                                                                                     | Phase 1 preflight signal coverage                                   |
| `<RiskGateStrip>`   | `data-riskGate`                                                                                     | Risk verdict + confidence pill                                      |
| `<InsightCard>`     | (inline; rendered from a custom callsite — currently unused on the chat path, ready for direct use) | Hero/metric/chart/table card                                        |
| `<ArtifactCard>`    | `data-artifact`                                                                                     | Inline placeholder; "Open" reveals the side panel                   |
| `<ArtifactPanel>`   | `useChatArtifacts` registry                                                                         | Right-side drawer; renders the full artifact (PDF preview shell)    |
| `<SuggestionChips>` | `data-suggestions`                                                                                  | "Try Next" pill row with `/pdf` `/deck` `/mail` `/compare` `/table` |
| `<ReturnChart>`     | block: `returnChart`                                                                                | Recharts multi-series line chart                                    |
| `<ReturnTable>`     | block: `returnTable`                                                                                | Period × series table with +/-% colourisation                       |
| `<TickerChip>`      | curated ticker allow-list                                                                           | Inline pill chip rendered next to recognised symbols in prose       |

### Artifact panel UX

`<ChatArtifactProvider>` (in `artifact-context.tsx`) holds the per-thread
registry of streamed artifacts plus the currently-open id. `chat-experience.tsx`
mounts the provider once at the top of the chat surface, wraps the message
column + composer in a flex parent, and renders `<ArtifactPanel />` as a
flex sibling. When `openArtifactId` flips to a non-null value, the panel
slides in from the right (≈ 520px max-width); the message column shrinks to
`flex-1`. Clicking the panel's close button (or "Export PDF") returns space
to the thread.

The artifact `<ArtifactBlock>` shapes (`paragraph` / `heading` / `callout` /
`metricGrid` / `returnTable` / `returnChart`) are intentionally narrow so
the contract is easy to extend; unknown blocks render as a no-op.

PDF export is **stubbed** — the "Export PDF" button currently downloads a
JSON snapshot of the artifact. Real PDF generation is intentionally out of
scope for this iteration.

### Suggestion-chip slash convention

Post-reply chips wear a slash prefix that doubles as a visual grammar:

| Slash      | Intent                                      |
| ---------- | ------------------------------------------- |
| `/pdf`     | Generate a board-ready PDF artifact         |
| `/deck`    | Turn the response into a slide deck         |
| `/mail`    | Draft an email summarising the brief        |
| `/compare` | Run a comparison turn against a peer ticker |
| `/table`   | Re-cast the answer as a numeric table       |

Clicking a chip sends the chip's `prompt` field through `useChat`'s
`sendMessage`. The chip's slash is **decorative** — there's no
slash-command parser; the prompt field carries the full instruction.

### Extractor pipeline

`frontend/src/lib/chat/extract.ts:extractChatArtifact()` is the canonical
seam between raw tool outputs and the structured `data-artifact` /
`data-suggestions` payloads. The route collects every successful tool call
of the turn and hands the array to the extractor, which inspects shapes
and emits a payload when one matches. Initial scaffolding handles the
two-ticker comparison case (`get_ticker_data` for two distinct symbols);
other turn shapes return `null` and the chat falls back to plain text.

Adding a new artifact shape is a matter of:

1. Detect the relevant tool-call combination inside `extractChatArtifact`.
2. Return an `ArtifactPayload` whose `blocks[]` use existing block types.
3. (Optional) emit a tailored `SuggestionsPayload`.

### Model access filtering

Ollama Cloud's `/api/tags` endpoint returns the **full catalog** —
including models the configured `OLLAMA_API_KEY` isn't entitled to
run (typically tier-gated SKUs like `glm-5`, `glm-5.1`, or
`kimi-k2.6`). We never want those to appear in the selector. Earlier
iterations probed every catalog entry with a tiny `/api/chat`
request to detect entitlement up front, but on a free-tier key this
turned out to:

- Burn ~30 chat completions per cold cache (visible in Ollama's
  Session Usage gauge as ~2% per page load).
- Trip Ollama's per-minute burst rate limit, returning 429s for the
  user's _real_ chat requests.

So filtering is now **lazy + persistent**:

1. **Lazy-mark on chat 401**. When `POST /api/chat` hits 401/403 for
   a per-model entitlement reason, the route adds the id to a
   server-side in-process denylist
   ([`frontend/src/lib/ai/model-access.ts`](frontend/src/lib/ai/model-access.ts))
   and throws a structured `MODEL_UNAVAILABLE::<id>` sentinel.

2. **Client persistence**. `chat-experience.tsx`'s `useChat` `onError`
   callback parses the sentinel, calls `markModelUnavailableClient`
   to write the id to `localStorage`
   ([`frontend/src/lib/ai/model-access-client.ts`](frontend/src/lib/ai/model-access-client.ts)),
   clears the cookie, and bumps `modelRefreshSignal`.

3. **Selector filter**. On every mount and refresh, `ChatModelSelector`
   reads the localStorage denylist into state and filters its
   rendered models against it before painting the dropdown — so a
   model that's failed entitlement once never reappears for that
   user.

4. **Auto-switch + retry**. Clearing the cookie causes the selector's
   existing auto-pick effect to back-fill the next available id; the
   error banner explains "this model isn't available — switching to
   another model. Try sending again."

Trade-off accepted: the **first** time a particular user encounters a
denied model (e.g. fresh browser session, no client denylist yet)
the chat fails once with the friendly auto-switch banner. Every
subsequent appearance is filtered out client-side. Compared to the
quota-burning probe-up-front approach, this is a much better fit for
free / lower-tier API keys.

> The `unavailable: string[]` field on `/api/chat/models` still
> carries the server-side denylist for transparency / debugging,
> but clients no longer need to read it because the localStorage
> denylist already filters the rendered list.

### Capability tags (Phase 2 details probe)

`/api/tags` doesn't return capability/deployment tags, but
`POST /api/show` does. The route runs a second parallel pass against
`/api/show` for the _survivors_ of the access probe and pulls:

- `capabilities[]` — `["completion", "tools", "vision", "thinking", "embedding", "insert"]`
  → mapped to friendly labels (`Tools`, `Vision`, `Reasoning`,
  `Embeddings`, `Fill-in-Middle`) by a small `CAPABILITY_LABELS`
  registry; `completion` is dropped as redundant. Anything new
  (e.g. `audio`) gets title-cased and surfaced as-is so future
  capabilities appear automatically.
- `details.parameter_size` (or `model_info["general.parameter_count"]`)
  → used in preference to id-parsed sizes, so badges like `30b` are
  accurate even when the id doesn't carry a `:30b` suffix.

The `/api/show` probe runs over the catalog with a **3-way
concurrency cap** so the user's own chat requests never queue
behind a wave of probe fan-out. The whole `/api/chat/models` payload
is cached behind a **stale-while-revalidate** policy:

- `< 5 min` after build → served from cache, no work.
- `5 min – 1 h` → served from cache **immediately**, revalidation
  kicks off in the background so the next caller sees fresh data.
- `≥ 1 h` → cold; the request blocks on a fresh probe.

Net effect: only the very first call after a server cold start pays
the probe latency (~3 s, parallel). Every subsequent caller — for
the next hour — gets an instant response.

On the **client** side the model selector layers a
`localStorage`-backed cache on top
([`frontend/src/lib/ai/model-list-cache.ts`](frontend/src/lib/ai/model-list-cache.ts)):

- Cache is read in a **post-mount `useEffect`**, _not_ in the
  `useState` lazy initialiser. Reading `localStorage` in the
  initialiser would diverge between server (no `localStorage`,
  returns empty) and client (returns cached models) and produce a
  React hydration mismatch — the selector button would render with
  a different `disabled` state, icon, and label in each pass. The
  selector therefore always paints `models = []` + spinner for the
  first frame, and the `useEffect` swaps in the cache immediately
  after — typically before the user can perceive it.
- Fresh hits (`< 5 min`) skip the network round-trip entirely.
- Stale hits hydrate the UI immediately and revalidate from the
  server in the background.
- The cache is bumped to a versioned key (`xylo_chat_models_v1`) so
  a shape change to `EnrichedModel` invalidates every browser's
  stored payload on the next deploy.
- A `refreshSignal` prop (bumped by `ChatExperience` after a
  `MODEL_UNAVAILABLE` error) forces a clear + no-store fetch so the
  just-denied model disappears from the dropdown.

> **Plan-tier access** (which tier of Ollama key can call which
> model) is **not** exposed by either `/api/tags` or `/api/show` —
> both return 200 with full metadata regardless of entitlement. We
> _used to_ probe entitlement with a tiny `/api/chat` per model,
> but that burned chat-completion quota and tripped burst-rate
> limits on free-tier keys. Filtering is now lazy: see the
> **Model access filtering** section above for the
> 401-on-real-use → localStorage-denylist flow.

> Every model returned by `https://ollama.com/api/tags` is by
> definition cloud-hosted, so `enrichModel` always adds the `Cloud`
> tag even when the id or `/api/show` capabilities don't include
> a cloud marker.

## UI/UX Features (April 2026 redesign)

The chat surface was redesigned in April 2026 to match the
"professional / enterprise" pattern shared by Claude, Vercel v0,
Linear AI, and ChatGPT: minimal chrome, the composer is the visual
centre of gravity, and the model selector lives **inside** the
composer rather than in a header bar.

### Keyboard Shortcuts

| Shortcut        | Action                            |
| --------------- | --------------------------------- |
| `⌘K` / `Ctrl+K` | Navigate to `/chat` from anywhere |
| `Escape`        | Leave `/chat` (`router.back()`)   |
| `Enter`         | Send message                      |
| `Shift+Enter`   | New line in input                 |

A subtle hint row underneath the composer surfaces these shortcuts +
the running token estimate so they remain discoverable without
crowding the header.

### Persistent Overlay (`/chat`)

The chat surface lives in `src/components/chat/chat-overlay.tsx` and is
mounted once from the root layout. It watches `usePathname()` and runs an
`AnimatePresence` of two motion layers when the path is `/chat`:

1. **Backdrop** — `bg-background`, opaque from `t=0` so the `<main>`
   swap from the previous page to the empty `/chat/page.tsx` is hidden.
2. **Surface** — the chat UI (`ChatExperience`) with
   `transformOrigin: '50% 50%'` and a tweened cubic-bezier entrance
   (`scale 0.985 → 1`, `ease: [0.32, 0.72, 0, 1]`). No spring — calm
   and composed.

Both layers are `fixed inset-0 z-20` so they sit under the dock
(outer `z-30`); the dock stays clickable as the way home.

### Minimal header

The header is intentionally chromeless:

- **No border, no title, no card, no status text.** It reads as
  ambient padding rather than a UI bar.
- **Right:** a small floating cluster — `New chat` (visible once the
  thread has messages) and `Close (Esc)`. Both are borderless, fully
  rounded, hover-revealed buttons sized at `size-8`.

Streaming state is communicated where it already needs to be — the
assistant's "Thinking…" bubble in the thread, the composer's send →
stop button swap, and the disabled textarea — so the header doesn't
duplicate any of that. Everything that used to crowd the header
(model selector, token counter, large stream-progress ring, page
title, hero sparkle, status pulse) has been moved or removed. The
visual centre of gravity is now the composer.

### Model picker (provider icons + enrichment)

The composer's model selector is far richer than a plain dropdown. It
combines server-side enrichment with client-side rendering of
official-style provider marks.

**Server side — `frontend/src/app/api/chat/models/route.ts`**

The route still calls Ollama's `/api/tags`, but each entry is now run
through `parseModelMeta()` (from `lib/ai/model-meta.ts`) before being
returned. The response shape per model is:

```typescript
type EnrichedModel = {
  id: string; // Ollama model id, e.g. "llama3.3:70b-cloud"
  displayName: string; // "Llama 3.3"
  provider: ProviderId; // "meta"
  providerLabel: string; // "Meta"
  parameterSize?: string; // "70B"
  tags: string[]; // ["Cloud"], ["Reasoning"], ["Coder"], …
  sizeBytes: number; // raw bytes from Ollama
  sizeLabel: string; // "65GB" or "Cloud"
  modifiedAt: string | null;
  releasedLabel: string | null; // "today", "3d ago", "Mar 2026", …

  // Backwards-compatible aliases:
  name: string; // == displayName
  size: string; // == sizeLabel
};
```

Why server-side? So the same enrichment is available to any future
consumer (e.g. a `/about` page, an embed widget) without re-shipping
the parsing logic.

**`parseModelMeta(id)` rules — `lib/ai/model-meta.ts`**

Ollama Cloud's `details.{family,parameter_size,…}` block comes back
empty for hosted models, so we parse the model id directly. The id
follows `family[-variant][:tag]`, where the tag often encodes either
the parameter count (`:70b`, `:1t`) or a deployment hint (`:cloud`).

| Input id                 | displayName        | parameterSize | tags          |
| ------------------------ | ------------------ | ------------- | ------------- |
| `llama3.3:70b-cloud`     | `Llama 3.3`        | `70B`         | `[Cloud]`     |
| `gpt-oss:120b`           | `GPT-OSS`          | `120B`        | `[]`          |
| `deepseek-v3.2:cloud`    | `DeepSeek V3.2`    | —             | `[Cloud]`     |
| `deepseek-r1:671b-cloud` | `DeepSeek R1`      | `671B`        | `[Cloud]`     |
| `qwen3-coder:480b`       | `Qwen3`            | `480B`        | `[Coder]`     |
| `gemma4:31b`             | `Gemma 4`          | `31B`         | `[]`          |
| `kimi-k2:1t`             | `Kimi K2`          | `1T`          | `[]`          |
| `kimi-k2-thinking`       | `Kimi K2`          | —             | `[Reasoning]` |
| `mistral-large-3:675b`   | `Mistral Large 3`  | `675B`        | `[]`          |
| `nemotron-3-super`       | `Nemotron 3 Super` | —             | `[]`          |

Capitalisation is brand-correct via the `BRAND_CAPS` map (`gpt-oss` →
`GPT-OSS`, `deepseek` → `DeepSeek`, etc.). Brand-specific number style
keeps `Qwen3` attached while leaving `Llama 3.3` / `Gemma 4` spaced.
Single-letter prefixes (`v3.1`, `k2`) always render attached.

**Provider registry — `lib/ai/providers.tsx`**

`ProviderIcon` exposes monochrome SVG marks for the major weight
publishers. Each mark renders in `currentColor` so it inherits the
surrounding text color, and `getProviderId(name)` resolves a model id
to a provider via an ordered regex list.

Icon provenance is tracked per-provider via `iconProvenance: 'official'
| 'custom'` on the `Provider` record:

| Provider         | Provenance | Source                           | Brand accent |
| ---------------- | ---------- | -------------------------------- | ------------ |
| OpenAI           | Official   | OpenAI 2022 brand mark           | currentColor |
| Meta             | Official   | simple-icons `meta`              | `#0467DF`    |
| Google           | Official   | simple-icons `google`            | `#4285F4`    |
| DeepSeek         | Official   | simple-icons `deepseek`          | `#4D6BFE`    |
| NVIDIA           | Official   | simple-icons `nvidia`            | `#76B900`    |
| Mistral AI       | Official   | simple-icons `mistralai`         | `#FA520F`    |
| Alibaba (Qwen)   | Official   | simple-icons `qwen`              | `#615CED`    |
| MiniMax          | Official   | simple-icons `minimax`           | `#F23F5D`    |
| Anthropic        | Official   | simple-icons `anthropic`         | `#D97757`    |
| Kimi (Moonshot)  | Official   | lobehub `kimi` — Kimi brand mark | `#1F58FF`    |
| Zhipu (GLM)      | Official   | lobehub `zhipu`                  | `#6E37FF`    |
| DeepCogito       | Custom     | diamond                          | `#3B82F6`    |
| Microsoft (Phi)  | Custom     | four-square                      | currentColor |
| Generic fallback | Custom     | neutral cube                     | currentColor |

Brand colours are sourced from simple-icons.org's brand-color
metadata (or each org's press kit) wherever the SVG itself is.
`OpenAI` and `Microsoft` stay on `currentColor` because their
official marks are intentionally monochrome / multicoloured
respectively; rendering them in a single custom hue would
misrepresent the brand.

> **Provider label note.** The `moonshot` provider is surfaced as
> **Kimi** because Moonshot AI's only public model family is Kimi —
> the mark we ship is the Kimi brand mark, not the corporate
> Moonshot wordmark. The internal id stays `moonshot` for stability.

Replace any `'custom'` mark with the official press-kit SVG the
moment one becomes available — the registry exposes the field so this
is easy to audit at a glance.

**Selector UI — `components/chat/chat-model-selector.tsx`**

- **Trigger pill** (in the composer toolbar): the active model's
  **brand mark** (in its accent colour) + model display name +
  chevron. The icon stands in for a "Model" label so the trigger
  reads as identity-bearing — at a glance you know _whose_ model
  you're talking to as well as _which_ version. Parameter size and
  full metadata still live on the dropdown rows. The full
  description is also exposed via `aria-label` and the native
  `title` tooltip ("Model: Llama 3.3 · 70B") for accessibility.
- **Dropdown panel** (opens upward via `side="top"`):
  - **Width tracks the trigger, with a usability floor.** The panel
    uses Radix's `--radix-dropdown-menu-trigger-width` CSS variable
    for `width`, plus a `min-w-60` (240px) floor. So when the trigger
    is wider than 240px the panel matches it exactly; when the
    trigger is hugging a short name the panel stays at 240px so the
    rich row content (icon · name · params · provider · tag · size)
    still reads cleanly. `align="start"` keeps the panel anchored to
    the trigger's left edge regardless of width.
  - Sticky search input with a live `filtered/total` count.
  - Models grouped by provider; each group header has a **monochrome**
    provider icon + uppercase label + per-group count. The headers
    deliberately stay on `currentColor` so they read as quiet section
    labels rather than competing with the colourful row icons below.
  - Each item shows: a 24px provider tile (icon rendered in the
    **brand accent colour**), model display name + param size on
    row 1, provider label + the primary capability tag pill (`Cloud`
    / `Reasoning` / `Coder`) + disk size or "released X ago" on row 2,
    plus a check mark on the selected item. The metadata is
    intentionally tightened to a single line per row so the rich
    content reads cleanly inside the narrower panel.
  - **Colour control:** `<ProviderIcon colored />` opts a single icon
    into its registered brand accent. Any caller that wants a uniform
    monochrome look can simply omit the prop (e.g. for icons embedded
    in markdown or used as small section glyphs).
- **Backwards compatibility:** if an older payload arrives without the
  enriched fields, the selector calls `parseModelMeta` client-side so
  the UI keeps working without surprises.

### Header (sidebar-friendly, absolute)

`ChatExperience` keeps a thin viewport header so a chat history /
sidebar can land later without a redesign:

- **Top-left:** `× close` (`HeaderAction` with the `CrossIcon`).
  Anchored left so a sidebar toggle / rail rendered on the same
  side reads as one composed surface — close is part of the
  navigation chrome, not stranded at the opposite edge.
- **Top-right:** intentionally empty (reserved for future sidebar
  controls / chat history toggle).

The header is rendered with **absolute positioning**
(`absolute top-3 left-3 sm:top-4 sm:left-4 z-30`) so it is _not_
part of the column flex flow. That's deliberate: it lets the body
beneath fill the entire viewport, which is what makes the empty-
state hero land on the geometric viewport centre at every
resolution (instead of being biased upward by the header's
~50 px). The trade-off is that surfaces below need to clear it:

- The error banner gets `pt-14 sm:pt-16`.
- The thread-state container gets `pt-14 sm:pt-16` so the first
  message doesn't slide under the close button.

Both values are sized off `top-3 + size-8` ≈ 44 px with breathing
room.

There is no session-level cluster (no `+ new chat`, no header-
mounted model pill) — the model selector lives inside the composer
itself, which is where the user is already looking when they're
about to send.

### Composer (the hero)

`ChatInput` is rendered as a single elevated card:

- `rounded-3xl border border-border/60 bg-background/80 backdrop-blur-xl`
- Soft layered shadow that strengthens on `focus-within`
- **Top row:** auto-resizing textarea with a generous **44px min /
  240px max** range. The 44px floor (≈ two lines worth of vertical
  breathing room at `text-[15px] leading-7`) means the empty
  composer presents a substantial typing surface rather than a thin
  one-line strip. `adjustHeight` resets the inline `height` to
  `auto` before reading `scrollHeight`, then clamps the result to
  the max — the CSS min-h handles the floor on its own so the
  textarea always reads as a "card" rather than an "input".
- **Toolbar row** under the textarea (`px-3 pb-3 pt-1.5`) — split
  into two clusters, matching Onyx's `AppInputBar`
  (`onyx-main/web/src/sections/input/AppInputBar.tsx`):
  - **Left cluster:**
    - **Paperclip** attach button (placeholder, "coming soon" tooltip)
    - **Sliders** trigger → `ChatActionsPopover` (per-turn
      capability toggles, see below)
    - **Active capability pills** — one per enabled feature
      (e.g. "Web Search", "Deep Research"). Click a pill to
      disable. Renders to the right of the sliders icon, in a
      stable order that matches the popover.
  - **Right cluster:**
    - **`ChatModelSelector`** pill — the active model travels
      with the input it'll be sent to. Fully transparent at rest
      (`border-transparent bg-transparent`) and only picks up
      `bg-muted/50` on hover / `bg-muted/60` while open, matching
      the other composer toolbar buttons (paperclip, sliders,
      mic). The provider mark + model name + chevron carry the
      trigger's identity on their own — no bordered chip needed.
    - **Microphone** placeholder (voice input, "coming soon" tooltip)
    - Circular send / stop button (`size-9`, foreground/
      background colour swap, subtle haptic-style scale on press)
- **Width:** `max-w-2xl` (~42rem / 672 px) when fullscreen —
  unified with the empty-state wrapper so the thread-state
  composer doesn't balloon to `max-w-4xl` when its parent has no
  outer constraint. Keeps the chat box visually proportional to
  the floating dock and the messages list above it.
- **Footer hint** under the card (very small, muted): keyboard
  shortcut summary on the left, running token estimate on the right.

`ChatInput` exposes both the model selector and the capability-
toggle plumbing as optional prop pairs, so each cluster can be
opted into independently:

```typescript
type ChatInputProps = {
  // ...existing fields
  selectedModel?: string;
  onModelChange?: (id: string) => void;
  enabledFeatures?: ReadonlySet<ChatFeatureId>;
  onToggleFeature?: (id: ChatFeatureId) => void;
  /** Hint row under the composer (keyboard shortcuts, token estimate). */
  footerHint?: React.ReactNode;
};
```

When `selectedModel` + `onModelChange` are provided, the right
cluster renders the model pill (just left of the mic placeholder).
When `enabledFeatures` + `onToggleFeature` are provided, the left
cluster renders the sliders config trigger and any active pills.
Omitting either pair just collapses that cluster.

### Configuration popover (per-turn capabilities)

`ChatActionsPopover` is the panel anchored to the sliders icon in
the left cluster. Borrowed from Onyx's `ActionsPopover` pattern —
toggle a row to flip a capability on or off; an active capability
shows a check on the right inside the popover _and_ renders as a
pill next to the trigger so the user can see what's enabled
without re-opening the menu.

Layout details (matches the user-shared Onyx screenshot):

- **Opens below** the input (`side="bottom"`, `sideOffset={8}`)
- Width `w-72`, rounded-`xl`, soft shadow, backdrop blur
- **Search input** at the top (`Search Actions` placeholder,
  `Search` lucide icon) — filters rows by label / description
- **Borderless rows** with `icon + label` and a right-aligned cog
  for capabilities flagged `configurable: true` (a placeholder
  surface for per-tool settings; the cog is a `stopPropagation`-
  guarded sibling so clicking it doesn't toggle the row).
- A row's icon picks up the feature's accent colour when active.
- **Always-visible description** — each row renders its description
  as a small muted second line beneath the label
  (`text-[11px] text-muted-foreground`). Earlier we surfaced the
  description via a Radix Tooltip, but the app's `TooltipProvider`
  uses the default 700ms delay and the popover's portal stack made
  the hover hint feel invisible. Inlining the description removes
  the timing dependency entirely.
- **Snappy gear tooltip** — for `configurable: true` features, the
  cog still has its own tooltip (`{feature.label} settings
(coming soon)`), but it's wrapped in a _local_
  `<TooltipProvider delayDuration={120}>` and uses `z-100` so it
  reliably renders above the popover content.

The current registry (in `chat-actions-popover.tsx`):

| Feature ID      | Icon (lucide) | Configurable | Effect                                                                                                         |
| --------------- | ------------- | ------------ | -------------------------------------------------------------------------------------------------------------- |
| `web_search`    | `Globe`       | Yes (cog)    | Adds the `web_search` tool to the request schema (server-side filter). Pill tinted sky.                        |
| `deep_research` | `Hourglass`   | No           | Appends a "Deep Research mode" directive to the system prompt (multi-step reasoning bias). Pill tinted violet. |

Toggles are stored in `ChatExperience` as a `ChatFeatureId[]` (with
a memoised `Set` for membership lookups) and forwarded to the API
on every request via `DefaultChatTransport({ body: { ... ,
enabledFeatures } })`.

#### Backend filtering

The route reads `enabledFeatures` from the request body and uses
two helpers (`/api/chat/route.ts`):

- `selectToolsForRequest(enabled)` returns the subset of
  `ollamaTools` to expose this turn. Tools listed in
  `GATED_TOOL_NAMES` (currently just `web_search`) are _included
  only when their feature is enabled_; everything else (financial
  tools, regime, options analysis) passes through unchanged.
- `buildFeatureDirectives(enabled)` returns extra system-prompt
  text appended to `buildDynamicSystemPrompt()` — `deep_research`
  appends a mode block instructing the model to plan
  sub-questions and use multiple tools; `web_search` appends a
  reminder that the tool is available and should be preferred for
  current-events questions.

The default state (no features enabled) is the conservative one:
`web_search` is **off** until the user opts in, financial tools
remain available. This mirrors Onyx's "forced tools" mental model
where capability surfaces are explicit per turn.

### Empty / Thread

- **Empty state — restrained, finance-focused:**
  - **Hero wordmark.** A single typographic element renders as the
    hero — `<h1>xylo</h1>` at `text-3xl → text-5xl` (down from
    `text-4xl → text-6xl`), `font-light`, `tracking-tight`,
    lowercase. The slimmer ramp keeps the page feeling composed at
    narrower widths and lets the composer remain the centre of
    gravity.
  - **Centered composer** below the wordmark at `max-w-2xl` (down
    from `max-w-3xl`) — see the Composer section below. The whole
    empty-state stack (hero → composer → suggestions) lives in a
    `flex flex-1 flex-col items-center justify-center px-4 py-12
sm:py-16` motion.div. Because the page header is absolutely
    positioned (see "Header" above), this body fills the _entire_
    viewport and `justify-center` actually lands the stack on the
    geometric viewport centre at every resolution — no upward
    bias from header height, no `pb-32` over-correction.
  - **Suggestions strip** under the composer at **`max-w-lg`** —
    deliberately _narrower_ than the composer (`max-w-2xl`) so the
    strip reads as a smaller, secondary affordance tucked under
    the input rather than competing with it. The parent already
    centres children via `items-center`, so the narrower strip
    lands horizontally centred under the chat with no extra
    layout work. Sleek finance-dashboard layout, no bordered card,
    no header label:
    - **Underline tab strip** with four categories — `Markets` ·
      `Scanners` · `Research` · `Approach` — each with a small
      lucide icon (`TrendingUp`, `Radar`, `LineChart`, `Compass`).
      The strip flows left-to-right (default flex justification, no
      `justify-center`) so the first tab's left edge aligns with
      the first prompt row's left edge below — centring the tabs
      within the strip clusters them in the middle while the
      underline border and prompt rows span the full width, which
      reads as a width mismatch. The strip as a whole is already
      centred on the page via the suggestions container's
      `mx-auto max-w-2xl`. The active tab has a hairline underline
      that animates between tabs via framer-motion
      `layoutId="suggestion-tab-underline"`.
    - **Prompt rows** below: a `divide-y` list of three prompts for
      the active tab. Each row is a borderless full-width button at
      `text-[13px]` (a touch smaller than body text) that slides a
      small `→` arrow in from the right on hover/focus.
    - Tab switches cross-fade the prompt list via
      `AnimatePresence mode="wait"`.
  - The prompts are deliberately finance-oriented so users land on
    the chat already pointed at the questions the assistant is best
    at: regime reads, scanners, ticker research, and methodology.
  - All three blocks (wordmark, composer, suggestions strip) fade
    up with a short stagger so the surface reads as composed.
- **Thread state:** `ChatMessages` (max-w-3xl, px-6 py-6 sm:px-8) with
  the bottom-docked composer above the dock (`pb-20 sm:pb-24`).
- **Empty → thread morph:** framer-motion `LayoutGroup` with a shared
  `layoutId="chat-input-wrapper"` so the composer animates between
  the centred-hero position and the bottom-docked position. The
  wordmark and suggestions card cross-fade with the rest of the
  empty state.

Suggestion data lives in `SUGGESTION_CATEGORIES` at the top of
`chat-experience.tsx` — four categories with three prompts each, easy
to edit without touching the JSX. Add or rename categories there and
the tab strip + body update automatically.

### Composer footer hint (kbd boxes + icons)

The hint row beneath the composer card uses real `<kbd>` boxes
with lucide icon glyphs so the shortcuts read like keyboard keys
instead of inline prose. The `Kbd` helper in `chat-experience.tsx`
renders an `h-5 min-w-[20px]` rounded box with a subtle border and
muted background; inside, we drop:

- `<CornerDownLeft />` for the **Return** key (used in _send_ and
  _newline_)
- `<ArrowBigUp />` for the **Shift** key (combined with Return for
  _newline_)
- The literal text **`Esc`** for _close_

The full row reads `[⌅] send · [⇧] + [⌅] newline · [Esc] close
· ~N tokens`, sized at `text-[11px] text-muted-foreground/80` —
big enough to actually scan rather than fading into the page like
the previous near-invisible `text-[10px] text-muted-foreground/55`.

On narrow viewports the _newline_ and _close_ hints collapse
(they're gated by `sm:inline-flex`) so the strip never wraps onto
two lines on mobile.

The token estimate stays at the right after a hairline divider —
no longer a header chip; the footer hint is its only home.

### Typewriter Effect

Assistant messages are revealed with a typewriter effect:

- During streaming: Shows content as it arrives (real-time)
- After streaming: Reveals remaining content character-by-character
- Smooth cursor animation while typing

### Smart Scroll Momentum

Intelligent auto-scroll behavior:

- Tracks scroll velocity to detect user intent
- Won't interrupt if user is actively scrolling up
- Resumes auto-scroll after user stops or scrolls down
- Uses exponential moving average for smooth velocity detection

### Message Actions

Hover over assistant messages to reveal:

- **Copy**: Copy message content to clipboard (no layout shift)

### Stream activity indicator

Streaming state is now communicated by a small animated pulse dot +
"Thinking…" label in the top-left of the chat surface (no header
border, no spinner ring). The `StreamProgress` and `StreamProgressBar`
components are still exported from the chat barrel for any future
embedded use, but the chat experience itself no longer mounts the
circular ring — it felt heavy next to the new minimal header.

### Haptic Feedback

Subtle scale animations on button press:

- Send button: `[1, 0.92, 1.02, 1]` - bounce effect
- Header buttons: `scale: 0.9` - quick tap feedback
- Provides tactile feel without being distracting

### Motion & Animations

All animations use Framer Motion with consistent design language:

1. **Overlay Open / Close**
   - Two-layer `AnimatePresence` driven by `usePathname() === '/chat'`
   - Backdrop: opaque from `t=0`, fades out over 220ms on close
   - Surface: tweened entrance (320ms, ease `[0.32, 0.72, 0, 1]`) from
     `transformOrigin: '50% 50%'` — a subtle 0.985 → 1 scale and an
     opacity fade, both arriving on the same timeline
   - Exit: surface scales to 0.99 with the same easing

2. **Empty → Thread Morph**
   - `LayoutGroup` + shared `layoutId="chat-input-wrapper"` on the
     composer wrapper (the only morphed element after the redesign)
   - Spring-based morph (stiffness: 280, damping: 30)
   - `AnimatePresence mode="wait"` cross-fades surrounding content

3. **Message Animations**
   - BlurFade entrance (opacity, y, blur)
   - Typewriter text reveal
   - No icon pulsing (cleaner)

4. **Tool Status Animations**
   - Spring spinner for running state
   - Path animation for checkmark on completion
   - Bouncing dots with staggered delays

5. **Tool Data Display**
   - Shows **exact data AI receives** (TOON or text format)
   - TOON badge indicates token-optimized format (~40% fewer tokens)
   - Consistent across all tools (no custom formatters needed)
   - Collapsible cards - click to expand

6. **Scan Results Stagger**
   - Container uses `staggerChildren: 0.04`
   - Items animate with spring physics (stiffness: 300, damping: 24)
   - Grade badges have extra spring bounce (stiffness: 500)

## Components

### ChatOverlay

Persistent overlay wrapper rendered from the root layout. Reads
`usePathname()` and `useSearchParams()` and runs the two-layer
`AnimatePresence` described above. Wrapped in `<Suspense fallback={null}>`
in the layout so `useSearchParams` doesn't deopt static routes.

### ChatExperience

The chat UI itself, rendered inside the overlay's surface layer. Owns
`useChat`, the empty/thread state machine, error banner, morph
transitions, and keyboard handlers.

- Header: minimal — `Thinking…` pulse on the left when streaming,
  `New chat` + `Close (Esc)` floating buttons on the right. No title,
  no border, no model selector here.
- Empty state: small sparkle tile + headline + supporting copy +
  centred composer + suggestion chips.
- Thread state: messages + bottom-docked composer; the composer
  hosts the model selector pill in its toolbar.
- Composer footer: keyboard hint + running token estimate (very subtle).
- Initial prompt: reads `?prompt=` from `searchParams`, queues via ref,
  bumps the `useChat` `id` key, then `router.replace('/chat')` to clear
  the URL so refresh doesn't resend.

Uses the `useChat` hook from `@ai-sdk/react` (v6.0 stable API):

- `sendMessage({ text: "..." })` for sending messages
- `messages` - array of `UIMessage` objects with `parts` array
- `status` for loading states (`ready`, `submitted`, `streaming`)
- `stop` for aborting streams

### ChatContext

Thin router shim that exposes a single navigation entry point:

```typescript
interface ChatContextValue {
  /** router.push('/chat?prompt=...') with the prompt URL-encoded */
  openChat: (prompt?: string) => void;
}
```

Plus the prompt-builder helpers (`buildPositionPrompt`,
`buildSpreadPrompt`, `buildPortfolioPrompt`) re-exported from
`@/components/chat`.

Includes:

- ⌘K / Ctrl+K keyboard shortcut → `router.push('/chat')`
- Initial prompt is forwarded via the URL query string

### TypewriterText

Typewriter effect component:

```typescript
interface TypewriterTextProps {
  content: string; // The text to display
  isStreaming?: boolean; // If true, shows content immediately
  speed?: number; // Characters per animation frame (default: 3)
  className?: string;
}
```

Features:

- During streaming: Shows content as it arrives
- After streaming: Animates remaining characters
- Includes markdown rendering with all formatting support
- Animated cursor while typing

### ChatMessage

Renders individual messages with:

- **User messages**: Primary color bubble, right-aligned
- **Assistant messages**: TypewriterText with sparkles avatar
- Thinking display (collapsible)
- Tool call cards embedded
- Hover actions (copy)

### StreamProgress

Circular progress indicator:

```typescript
interface StreamProgressProps {
  isActive: boolean; // Show/hide the indicator
  size?: number; // Size in pixels (default: 16)
  className?: string;
}
```

Also exports `StreamProgressBar` for linear progress.

### useScrollToBottom

Smart scroll hook with momentum detection:

```typescript
interface ScrollHookReturn {
  containerRef: RefObject<HTMLDivElement>;
  endRef: RefObject<HTMLDivElement>;
  isAtBottom: boolean;
  scrollToBottom: (behavior?: ScrollBehavior) => void;
  getScrollVelocity: () => number;
  isScrollingUp: () => boolean;
}
```

Velocity tracking:

- Positive velocity = scrolling down
- Negative velocity = scrolling up
- Threshold: -0.3 px/ms to detect active scroll-up

## API Route

`POST /api/chat`

### Request Body

The AI SDK sends messages in `UIMessage` format with `parts` array.
The composer also forwards the active model and the per-turn
capability toggles set in the configuration popover:

```typescript
{
  messages: Array<{
    id: string;
    role: 'user' | 'assistant';
    parts: Array<{
      type: 'text';
      text: string;
    }>;
  }>;
  /** Selected model id from `ChatModelSelector` (e.g. "gpt-oss:120b"). */
  model?: string;
  /**
   * Capability ids enabled for this turn via `ChatActionsPopover`.
   * The server uses this to filter the tool schema (e.g. omit
   * `web_search` if not enabled) and to bias the system prompt
   * (e.g. append "Deep Research mode" directives).
   */
  enabledFeatures?: Array<'web_search' | 'deep_research'>;
}
```

### Error Handling

Returns styled error banners with type-specific colors:

| Error Type   | Color  | Example            |
| ------------ | ------ | ------------------ |
| `auth`       | Purple | Not authenticated  |
| `rate_limit` | Amber  | Rate limit reached |
| `network`    | Blue   | Connection failed  |
| `server`     | Red    | 500/502/503 errors |
| `unknown`    | Muted  | Generic errors     |

### Decision Logging (Phase 0 of Xylo Roadmap)

Every chat turn is persisted to the `agent_decisions` Supabase table via
`logDecision` from `@lib/ai-agent`. Captured fields:

- `source: 'frontend'`, `user_id` (whitelisted email).
- `user_question` (last user message), `model_id`, `prompt_hash` (sha256 prefix), `prompt_variant: 'lite'`.
- `tool_calls`: an array of `{ name, args, latency_ms, ok, error }` collected as the recursive tool loop runs.
- `final_response`: the user-visible assistant text after all tool iterations.
- `total_latency_ms`: end-to-end wall time.
- Errors are logged too (with `final_response: '[error] …'`) so we can detect regressions.

The writer is fire-and-forget: a Supabase outage never breaks the chat path. The data feeds the [`/decisions` viewer](#decisions-viewer) (see below).

> **Required env**: `SUPABASE_URL` (or `NEXT_PUBLIC_SUPABASE_URL`) **and**
> `SUPABASE_SERVICE_ROLE_KEY`. The `agent_decisions` RLS policy only
> permits inserts from the `service_role`; `logDecision` therefore
> _does not_ fall back to `NEXT_PUBLIC_SUPABASE_ANON_KEY` — anon
> writes always fail with `42501` and only add log noise. When the
> service key is missing, the writer logs a single warning per
> process and skips writes entirely.

### `/decisions` Viewer

`frontend/src/app/decisions/page.tsx` is a server component gated by the same
email whitelist as `/chat` (extracted into `frontend/src/lib/auth/whitelist.ts`).
It renders `DecisionsClient`, which:

- Fetches from `GET /api/decisions` (most recent 50 by default).
- Supports filters: `source`, `model_id`, `question_class`, `ticker`.
- Expands a row to show the full question, response, and tool-call breakdown.

This is the operator's answer to "what has Xylo said this week, with what tools, on what model?".

### Preflight + Coverage Strip (Phase 1 of Xylo Roadmap)

Before the model is invoked on any turn, `frontend/src/app/api/chat/route.ts`
calls `runPreflight(userQuestion)` from `@lib/ai-agent`. The result:

- The classifier produces a deterministic `signalRequirements` bundle
  (see `lib/ai-agent/classification.ts`).
- All required signals are fetched in parallel. As of PR B the
  preflight wires: `regime`, `calendar`, `ticker_data`, `news`,
  `sentiment`, `earnings` (FMP), `sector_flow`, and `geopolitical`
  (curated static).
- A `LIVE DATA` block is assembled (TOON-encoded) and appended to the
  Xylo system prompt.
- A `CoverageReport` is built with `{ checked, skipped, stale, errors, latencies }`.

The model also has the same five new tools available to call directly:
`get_sector_flow`, `get_recent_news`, `get_sentiment`,
`get_earnings_calendar`, `get_geopolitical_events` (see
[`docs/ai-agent/TOOLS.md`](../ai-agent/TOOLS.md)). Preflight pre-loads
the data; tool calls are for when the model needs to drill in or
verify.

The coverage report is surfaced in two places:

1. **Stream marker** — the route emits `<!--COVERAGE:{json}:COVERAGE-->`
   after the main text. `frontend/src/components/chat/chat-message.tsx`
   parses it (alongside the existing tool markers) and hands the
   payload to `frontend/src/components/chat/coverage-strip.tsx`,
   which renders a small "Coverage 3/9 checked" pill above the
   assistant's response. Click expands per-signal latencies + errors.
2. **Decision log** — `coverage_report` is included in the
   `logDecision` payload, so every row in `agent_decisions.coverage_report`
   has the same shape and the `/decisions` viewer surfaces a Coverage
   column (e.g. `2/3` with red text when there were errors).

If preflight itself fails, the route falls back to the static lite
prompt — chat still works, the coverage strip is simply absent.

### Risk Gate + `<!--RISK_GATE-->` marker (Phase 2 of Xylo Roadmap)

After `processChat` resolves, the route runs the Phase 2 risk gate:

1. `parseRecommendation(finalText)` extracts a structured trade call
   (regex against the canonical `My call: <ACTION> <TICKER>
$<long>/$<short> CDS, <DTE> DTE, debit $<X>` line that the system
   prompt instructs Xylo to emit).
2. `validateRecommendation` checks the call against
   `strategy.config.yaml` (position sizing, RSI band, IV ceiling,
   DTE, earnings window, blacklist, concentration when positions are
   provided).
3. The route emits `<!--RISK_GATE:{json}:RISK_GATE-->` so the UI can
   render `risk-gate-strip.tsx` (green/red pill, click to expand
   per-rule violations).
4. `risk_violations` is persisted to the `agent_decisions` row; the
   `/decisions` viewer surfaces a Risk column.

If the parser can't find a "My call:" line, the gate is skipped
(`gate_skipped: true`) and no pill is rendered — chat-style answers
shouldn't be gated.

The strip also renders a **confidence badge** (Phase 2 PR C) — a
color-coded 0-10 score computed from:

- `0.4 * coverage_completeness` (signals fetched / signals required)
- `0.3 * signal_agreement` (direction alignment across news / sentiment / fundamentals)
- `0.3 * risk_pass` (1.0 for clean approve, 0.85 with warnings, 0 if blocked, 0.5 if gate skipped)

Hover the badge to see component values. Score is also persisted to
`agent_decisions.confidence` and surfaced as a sortable column in the
`/decisions` viewer.

## Tool Calling

The chat supports tool calling via shared handlers from `lib/ai-agent`.
On every turn the route filters the registered tools through
`selectToolsForRequest()` based on the user's per-turn toggles, so
**gated tools are absent from the request schema** (not just
discouraged) when their feature is disabled.

Tool lifecycle is now streamed as **typed UI parts** (`tool-input-start`
→ `tool-input-available` → `tool-output-available` / `tool-output-error`)
with `dynamic: true` so the route can avoid declaring static `UITool`
schemas. The client converts these into the existing `ToolCall` shape
(`tool-call-card.tsx`) so `<ToolCallCard>` keeps rendering against a
stable contract. See _Streaming Protocol_ above for the full chunk list.

### Available Tools

| Tool                           | Description                                | Gating                                                   |
| ------------------------------ | ------------------------------------------ | -------------------------------------------------------- |
| `get_ticker_data`              | Fetches stock data from Yahoo Finance      | Always on                                                |
| `web_search`                   | Web search with Brave Search API           | **Gated by `web_search` toggle in `ChatActionsPopover`** |
| `get_financials_deep`          | Income statement, balance sheet, cash flow | Always on                                                |
| `get_institutional_holdings`   | Top institutional holders and % owned      | Always on                                                |
| `get_unusual_options_activity` | High-grade unusual options signals         | Always on                                                |
| `get_trading_regime`           | Market conditions: GO/CAUTION/NO_TRADE     | Always on                                                |
| `get_iv_by_strike`             | IV analysis for specific strike prices     | Always on                                                |
| `calculate_spread`             | Calculate spread metrics for given strikes | Always on                                                |

> Add a new gated capability by registering it in `CHAT_FEATURES`
> (`chat-actions-popover.tsx`) and listing the tool name in
> `GATED_TOOL_NAMES` on the API route. Flag-only features (no tool
> binding, like `deep_research`) leave their `GATED_TOOL_NAMES`
> entry as an empty set and only contribute system-prompt text via
> `buildFeatureDirectives()`.

## Mobile Experience

`/chat` is full-viewport on every breakpoint, so mobile gets the same
edge-to-edge surface without any extra panel chrome.

- Single-column suggestion grid below the composer
- Composer reserves bottom padding (`pb-20`) so it sits above the dock
- Press the in-page close button or browser back gesture to leave

## Customization

### System Prompt (Xylo Persona)

**Source of truth**: `lib/ai-agent/prompts/xylo.ts`

To update Xylo's behavior:

1. Edit `lib/ai-agent/prompts/xylo.ts`
2. Test with CLI: `cd ai-analyst && bun run chat`
3. Changes automatically available in frontend!

### Motion Configuration

Animation constants follow the site's design language:

```typescript
// Spring physics (dock-style)
{ stiffness: 300, damping: 25 }

// Entrance animations (BlurFade style)
{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }

// Typewriter speed
speed: 4 // characters per frame
```

## Future Enhancements

1. ~~**Enhanced Data Parity**~~ ✅ **COMPLETED**
   - ✅ Full tool parity with CLI
   - ✅ Live market context

2. ~~**UI/UX Improvements**~~ ✅ **COMPLETED**
   - ✅ Keyboard shortcuts
   - ✅ Fullscreen mode
   - ✅ Message actions
   - ✅ Token counter
   - ✅ Typewriter effect
   - ✅ Smart scroll momentum
   - ✅ Mobile swipe-to-close

3. ~~**Dedicated Chat Page**~~ ✅ **COMPLETED (April 2026)**
   - ✅ Full-screen chat at `/chat`
   - Chat history persistence (still pending)
   - Multiple conversations (still pending)

4. **Chat Persistence**
   - Save conversations to Supabase
   - Resume previous chats

## Troubleshooting

### "Authorization required" error

1. Check `OLLAMA_API_KEY` is set correctly in `.env.local`
2. Verify the API key at https://ollama.com/settings/keys
3. Ensure the key has not expired

### Messages not showing

1. Check browser console for API errors
2. Verify the API route is working
3. Ensure `messages` array format is correct

### Keyboard shortcut not working

1. Ensure focus is not in an input field
2. Check if other extensions intercept ⌘K
3. Try Ctrl+K on non-Mac devices
