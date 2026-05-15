'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Check, Loader2, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ProviderIcon, type ProviderId } from '@/lib/ai/providers';
import { parseModelMeta } from '@/lib/ai/model-meta';
import {
  readModelCache,
  writeModelCache,
  clearModelCache,
} from '@/lib/ai/model-list-cache';
import { readUnavailableModelsClient } from '@/lib/ai/model-access-client';

// ============================================================================
// Types
// ============================================================================
//
// We accept the rich shape returned by `/api/chat/models`. The legacy
// fields (`name`, `size`) are kept so older code paths still compile,
// but the redesigned UI reads `displayName`, `provider`, `parameterSize`,
// etc. for the actual rendering.

export type ChatSelectorModel = {
  id: string;
  name: string;
  size: string;
  displayName?: string;
  provider?: ProviderId;
  providerLabel?: string;
  parameterSize?: string;
  tags?: string[];
  sizeBytes?: number;
  sizeLabel?: string;
  releasedLabel?: string | null;
};

type ChatModelSelectorProps = {
  selectedModel: string;
  onModelChange: (modelId: string) => void;
  /**
   * Bump this number to force the selector to re-fetch
   * `/api/chat/models`. Used by `ChatExperience` after the chat
   * route reports a `MODEL_UNAVAILABLE` error so the dropdown
   * stops listing models the API key can't run.
   */
  refreshSignal?: number;
};

// ============================================================================
// Helpers
// ============================================================================
//
// The API now returns enriched models, but for offline-first defaults
// (or any payload that pre-dates the redesign) we re-derive metadata
// client-side using the same `parseModelMeta` helper the API uses.

function ensureEnriched(
  m: ChatSelectorModel
): Required<
  Pick<ChatSelectorModel, 'displayName' | 'provider' | 'providerLabel' | 'tags'>
> &
  ChatSelectorModel {
  if (m.displayName && m.provider && m.providerLabel) {
    return {
      ...m,
      displayName: m.displayName,
      provider: m.provider,
      providerLabel: m.providerLabel,
      tags: m.tags ?? [],
    };
  }
  const meta = parseModelMeta(m.id);
  return {
    ...m,
    displayName: m.displayName ?? m.name ?? meta.displayName,
    provider: m.provider ?? meta.provider,
    providerLabel: m.providerLabel ?? meta.provider,
    parameterSize: m.parameterSize ?? meta.parameterSize,
    tags: m.tags ?? meta.tags,
  };
}

// ============================================================================
// Component
// ============================================================================

/**
 * Model picker rendered as a pill in the composer toolbar. The trigger
 * shows the provider mark + display name; the dropdown surfaces the
 * full enrichment (provider label, parameter count, deployment tags,
 * "released X ago", and disk/cloud size). Models are grouped by
 * provider with a search field at the top, matching the pattern used
 * by Linear / Vercel v0 / ChatGPT.
 */
export function ChatModelSelector({
  selectedModel,
  onModelChange,
  refreshSignal = 0,
}: ChatModelSelectorProps) {
  // SSR-safe initial state: empty list + loading. Reading from
  // `localStorage` in the lazy initialiser would diverge between
  // server (no `localStorage`, returns `[]`) and client (returns
  // cached models) and produce a React hydration mismatch — the
  // selector renders a different button label, icon, and `disabled`
  // state in each pass. We hydrate from cache in a post-mount
  // `useEffect` instead (same approach as `chat-model-store`).
  const [models, setModels] = useState<ChatSelectorModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  // Client-side persistent denylist of models the user's API key
  // can't run, sourced from `localStorage`. Populated post-mount in
  // the same effect that hydrates the cache so the SSR'd tree (no
  // `localStorage` access) matches the first client render.
  const [clientDenylist, setClientDenylist] = useState<Set<string>>(
    () => new Set()
  );

  useEffect(() => {
    let cancelled = false;

    // Hydrate the client denylist from localStorage every time the
    // selector mounts or `refreshSignal` bumps — this picks up any
    // entries added by `chat-experience.tsx` after the parent
    // intercepts a `MODEL_UNAVAILABLE` error.
    setClientDenylist(readUnavailableModelsClient());

    async function fetchModels() {
      try {
        // When the parent bumps `refreshSignal` we deliberately bypass
        // the client-side cache: the server has just denylisted a
        // model and we want the freshest list. Otherwise prefer the
        // server's stale-while-revalidate cache.
        const isForcedRefresh = refreshSignal > 0;
        if (isForcedRefresh) clearModelCache();

        const response = await fetch('/api/chat/models', {
          cache: isForcedRefresh ? 'no-store' : 'default',
        });
        const data = await response.json();
        if (cancelled) return;
        const next = (data.models || []) as ChatSelectorModel[];
        const unavailable = (data.unavailable || []) as string[];
        setModels(next);
        writeModelCache(next, unavailable);
      } catch (error) {
        if (cancelled) return;
        console.error('Failed to fetch models:', error);
        // Only fall back to defaults if we have nothing on screen
        // already. If we hydrated from cache, leave that in place
        // rather than wiping it for an empty state.
        setModels((prev) =>
          prev.length > 0
            ? prev
            : [
                { id: 'gpt-oss:120b', name: 'GPT-OSS', size: '65GB' },
                { id: 'gpt-oss:20b', name: 'GPT-OSS', size: '14GB' },
              ]
        );
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    // Post-mount hydration step. We always run this *after* the
    // first paint so the SSR'd tree (empty + loading) matches the
    // first client render. Cache is then folded in synchronously
    // via `setModels`, so the empty state is only briefly visible.
    const cached = readModelCache();

    if (cached && cached.fresh && refreshSignal === 0) {
      // Fresh cache — fold it into state and skip the network entirely.
      setModels(cached.models);
      setIsLoading(false);
      return () => {
        cancelled = true;
      };
    }

    if (cached && cached.models.length > 0) {
      // Stale-but-usable: paint cached entries immediately, then
      // revalidate from the server in the background.
      setModels(cached.models);
    }

    fetchModels();
    return () => {
      cancelled = true;
    };
  }, [refreshSignal]);

  // Auto-select the first available model when the parent has no
  // stored preference (or a stored preference that no longer exists in
  // the live model list). This is the new fallback now that we no
  // longer ship a hardcoded `DEFAULT_CHAT_MODEL` — the API itself
  // decides what's "first", and the parent's `onModelChange` wrapper
  // persists the resulting choice to the model cookie so subsequent
  // visits load the same model.
  useEffect(() => {
    if (models.length === 0) return;
    const isCurrentValid =
      selectedModel && models.some((m) => m.id === selectedModel);
    if (!isCurrentValid) {
      onModelChange(models[0].id);
    }
  }, [models, selectedModel, onModelChange]);

  // Memoized enrichment + grouping.
  // Filter out anything on the client persistent denylist before
  // enrichment runs, so the user never sees a model that's already
  // failed entitlement on this machine.
  const visible = useMemo(
    () => models.filter((m) => !clientDenylist.has(m.id)),
    [models, clientDenylist]
  );
  const enriched = useMemo(() => visible.map(ensureEnriched), [visible]);

  const selectedMeta = useMemo(() => {
    const found = enriched.find((m) => m.id === selectedModel);
    if (found) return found;
    return ensureEnriched({ id: selectedModel, name: selectedModel, size: '' });
  }, [enriched, selectedModel]);

  // Filter by free-text query against id, displayName, provider label, tags.
  const filtered = useMemo(() => {
    if (!query.trim()) return enriched;
    const q = query.toLowerCase();
    return enriched.filter((m) =>
      [m.id, m.displayName, m.providerLabel, m.parameterSize, ...(m.tags ?? [])]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(q))
    );
  }, [enriched, query]);

  // Group by provider, preserving stable provider order from the input.
  const grouped = useMemo(() => {
    const groups = new Map<
      ProviderId,
      { label: string; items: typeof filtered }
    >();
    for (const m of filtered) {
      const provider = m.provider as ProviderId;
      const bucket = groups.get(provider);
      if (bucket) {
        bucket.items.push(m);
      } else {
        groups.set(provider, {
          label: m.providerLabel ?? 'Other',
          items: [m],
        });
      }
    }
    return Array.from(groups.entries()).map(([id, group]) => ({
      providerId: id,
      label: group.label,
      items: group.items,
    }));
  }, [filtered]);

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen} modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={isLoading}
          className={cn(
            // Fully transparent at rest — matches the rest of the
            // composer toolbar buttons (paperclip, sliders, mic),
            // which sit on `border-transparent` + no background and
            // only pick up a subtle muted bg on hover. The provider
            // mark + model name + chevron carry the trigger's
            // identity on their own.
            'group inline-flex h-8 max-w-60 items-center gap-1.5 rounded-full',
            'pl-2 pr-2.5',
            'text-xs font-medium',
            'border border-transparent bg-transparent',
            'text-foreground',
            'transition-colors duration-150',
            'hover:bg-muted/50',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/15',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            isOpen && 'bg-muted/60'
          )}
          aria-label={`Model: ${selectedMeta.displayName}`}
          title={`Model: ${selectedMeta.displayName}${
            selectedMeta.parameterSize ? ` · ${selectedMeta.parameterSize}` : ''
          }`}
        >
          {isLoading ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <>
              {/*
                Brand mark of the active model in lieu of a "Model"
                label. Uses the provider's accent colour so the
                trigger reads as identity-bearing without going
                noisy.
              */}
              <ProviderIcon
                provider={selectedMeta.provider}
                className="size-3.5"
                colored
              />
              <span className="min-w-0 truncate text-foreground/90">
                {selectedMeta.displayName}
              </span>
              <ChevronDown
                className={cn(
                  'size-3 shrink-0 opacity-60 transition-transform duration-150',
                  isOpen && 'rotate-180 opacity-100'
                )}
              />
            </>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        side="top"
        sideOffset={6}
        className={cn(
          // Width tracks the trigger (so the panel always feels
          // anchored to it) but `min-w-60` keeps the menu usable
          // when the trigger is hugging a short model name.
          'w-(--radix-dropdown-menu-trigger-width) min-w-60',
          'max-h-[420px] overflow-hidden p-0 rounded-xl',
          'z-100'
        )}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        {/* Search row */}
        <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border/60 bg-background/95 px-2.5 py-2 backdrop-blur">
          <Search className="size-3.5 text-muted-foreground/70" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search models…"
            className={cn(
              'w-full bg-transparent text-xs outline-none',
              'placeholder:text-muted-foreground/50'
            )}
          />
          {enriched.length > 0 && (
            <span className="font-mono text-[10px] tabular-nums text-muted-foreground/50">
              {filtered.length}/{enriched.length}
            </span>
          )}
        </div>

        {/* Scrollable model list */}
        <div className="max-h-[360px] overflow-y-auto p-1">
          {grouped.length === 0 && (
            <div className="px-3 py-6 text-center text-xs text-muted-foreground">
              No models match
              <span className="ml-1 font-medium">&ldquo;{query}&rdquo;</span>
            </div>
          )}

          {grouped.map((group) => (
            <div key={group.providerId} className="py-1">
              <div className="flex items-center gap-1.5 px-2 pt-1 pb-1.5">
                <span className="inline-flex size-3 items-center justify-center text-muted-foreground/70">
                  <ProviderIcon provider={group.providerId} />
                </span>
                <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">
                  {group.label}
                </span>
                <span className="ml-auto text-[10px] font-mono tabular-nums text-muted-foreground/40">
                  {group.items.length}
                </span>
              </div>

              {group.items.map((model) => {
                const isSelected = selectedModel === model.id;
                const tags = model.tags ?? [];
                // In the narrow panel we only have room for one tag pill
                // alongside the meta line. Anything extra is dropped
                // silently — the most important tags ("Cloud",
                // "Reasoning", "Coder") are always first thanks to the
                // tag-extraction order.
                const primaryTag = tags[0];
                return (
                  <DropdownMenuItem
                    key={model.id}
                    onClick={() => {
                      onModelChange(model.id);
                      setIsOpen(false);
                    }}
                    className={cn(
                      'flex items-center gap-2 cursor-pointer',
                      'rounded-lg px-1.5 py-1.5 mb-0.5',
                      'focus:bg-muted/70',
                      isSelected && 'bg-muted/70'
                    )}
                  >
                    <span
                      className={cn(
                        'flex size-6 shrink-0 items-center justify-center',
                        'rounded-md bg-muted/40 ring-1 ring-border/60',
                        'text-foreground/80',
                        isSelected && 'bg-muted/80 text-foreground'
                      )}
                    >
                      <ProviderIcon
                        provider={model.provider}
                        className="size-3.5"
                        colored
                      />
                    </span>

                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex items-baseline gap-1.5">
                        <span className="truncate text-xs font-medium text-foreground">
                          {model.displayName}
                        </span>
                        {model.parameterSize && (
                          <span className="ml-auto pl-1 font-mono text-[10px] tabular-nums text-muted-foreground/80">
                            {model.parameterSize}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70">
                        <span className="truncate">{model.providerLabel}</span>
                        {primaryTag && (
                          <>
                            <span className="text-muted-foreground/30">·</span>
                            <span
                              className={cn(
                                'shrink-0 rounded-full border border-border/40',
                                'px-1.5 py-px',
                                'text-[9px] font-medium uppercase tracking-wide',
                                'text-muted-foreground/80'
                              )}
                            >
                              {primaryTag}
                            </span>
                          </>
                        )}
                        <span className="ml-auto shrink-0 font-mono tabular-nums">
                          {model.sizeLabel && model.sizeLabel !== 'Cloud'
                            ? model.sizeLabel
                            : model.releasedLabel || ''}
                        </span>
                      </div>
                    </div>

                    {isSelected && (
                      <Check className="size-3.5 shrink-0 text-foreground/80" />
                    )}
                  </DropdownMenuItem>
                );
              })}
            </div>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
