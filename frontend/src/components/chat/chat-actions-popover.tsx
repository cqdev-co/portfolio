'use client';

import { useMemo, useState } from 'react';
import {
  Check,
  Globe,
  Hourglass,
  Search,
  Settings2,
  SlidersHorizontal,
} from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

// ============================================================================
// Feature registry
// ============================================================================
//
// Mirrors Onyx's `ActionsPopover` (`onyx-main/web/src/sections/input/
// AppInputBar.tsx`) — the user toggles per-turn capabilities like
// Internal Search, Web Search, Image Generation, etc., and the active
// ones render as "selected" pills next to the trigger. We keep the
// same mental model but tailored to this agent: the only real,
// server-mediated tool we expose is `web_search`. "Deep Research" is
// a flag that biases the system prompt toward thorough, multi-step
// reasoning (no separate tool — matches Onyx's flag-based flow).

export type ChatFeatureId = 'web_search' | 'deep_research';

export type ChatFeature = {
  id: ChatFeatureId;
  label: string;
  description: string;
  icon: typeof Globe;
  /**
   * Tint applied to the icon + active pill so each capability has a
   * recognisable identity (matches Onyx's coloured `SelectButton`).
   */
  accent: string;
  /**
   * `true` for capabilities that *would* expose a per-turn settings
   * surface (e.g. choose which connectors / providers / domains).
   * Today that's only Web Search; we render a small gear to signal
   * "configurable" exactly the way Onyx does, even though clicking
   * it is a no-op until the surface lands.
   */
  configurable: boolean;
};

export const CHAT_FEATURES: ChatFeature[] = [
  {
    id: 'web_search',
    label: 'Web Search',
    description: 'Lets the agent fetch current results from the internet.',
    icon: Globe,
    accent: 'text-sky-500',
    configurable: true,
  },
  {
    id: 'deep_research',
    label: 'Deep Research',
    description: 'Bias the assistant toward longer, multi-step reasoning.',
    icon: Hourglass,
    accent: 'text-violet-500',
    configurable: false,
  },
];

const FEATURES_BY_ID = new Map(CHAT_FEATURES.map((f) => [f.id, f]));

export function getChatFeature(id: ChatFeatureId): ChatFeature {
  return FEATURES_BY_ID.get(id) ?? CHAT_FEATURES[0];
}

// ============================================================================
// Component
// ============================================================================

type ChatActionsPopoverProps = {
  enabled: ReadonlySet<ChatFeatureId>;
  onToggle: (id: ChatFeatureId) => void;
  disabled?: boolean;
};

/**
 * Configuration popover for the composer. Lives between the file-
 * attach button and the active-pill row in the toolbar's left cluster.
 * Each row toggles a capability on or off; an enabled row also shows
 * a check on the right and renders as a pill next to the trigger
 * (`ChatActivePill`). The trigger button picks up a faint accent
 * when *any* feature is active so the user can tell at a glance
 * that they have non-default settings.
 */
export function ChatActionsPopover({
  enabled,
  onToggle,
  disabled,
}: ChatActionsPopoverProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const hasAny = enabled.size > 0;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return CHAT_FEATURES;
    return CHAT_FEATURES.filter((f) =>
      [f.label, f.description].some((field) => field.toLowerCase().includes(q))
    );
  }, [query]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              type="button"
              disabled={disabled}
              aria-label="Configure tools"
              className={cn(
                'flex size-8 shrink-0 items-center justify-center',
                'rounded-full border border-transparent',
                'text-muted-foreground hover:text-foreground',
                'hover:border-border/70 hover:bg-muted/50',
                'transition-colors duration-150',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/15',
                'disabled:cursor-not-allowed disabled:opacity-50',
                (open || hasAny) &&
                  'border-border/70 bg-muted/60 text-foreground'
              )}
            >
              <SlidersHorizontal className="size-4" />
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p>Configure tools</p>
        </TooltipContent>
      </Tooltip>

      {/*
        Onyx's popover opens *below* the input bar, anchored to the
        sliders trigger (`side="bottom"`). The panel itself is dense
        — a search input on top, then borderless rows with an icon, a
        label, and a settings cog on the right for capabilities that
        expose configuration. Matches the screenshot the user shared.
      */}
      <PopoverContent
        side="bottom"
        align="start"
        sideOffset={8}
        className={cn(
          'w-72 p-0 rounded-xl overflow-hidden',
          'border-border/60 bg-popover/95 backdrop-blur',
          'shadow-[0_4px_24px_-8px_rgb(0_0_0/0.18)]'
        )}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2.5">
          <Search className="size-3.5 text-muted-foreground/70" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Actions"
            className={cn(
              'w-full bg-transparent text-[13px] outline-none',
              'placeholder:text-muted-foreground/50'
            )}
          />
        </div>

        <ul className="flex flex-col p-1">
          {filtered.length === 0 && (
            <li className="px-3 py-6 text-center text-xs text-muted-foreground">
              No actions match
              <span className="ml-1 font-medium">&ldquo;{query}&rdquo;</span>
            </li>
          )}
          {/*
            We render each row as `[icon] [label + description] [check] [gear]`
            with the **description always visible** as a second line.
            Earlier we relied on a row-level Radix Tooltip to surface
            the description on hover, but the app's `TooltipProvider`
            uses the default 700ms delay and the popover's portal
            stack made the tooltip feel invisible — by the time it
            appeared, the user had already moved on. Inlining the
            description removes that timing dependency entirely; the
            user sees what each capability does the moment they open
            the popover. The gear keeps its own tooltip (wrapped in
            a local provider with a shorter `delayDuration`) so the
            "settings coming soon" hint is actually responsive.
          */}
          {filtered.map((feature) => {
            const isActive = enabled.has(feature.id);
            const Icon = feature.icon;
            return (
              <li key={feature.id}>
                <div
                  role="button"
                  tabIndex={0}
                  aria-pressed={isActive}
                  onClick={() => onToggle(feature.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onToggle(feature.id);
                    }
                  }}
                  className={cn(
                    'group relative flex items-start gap-2.5',
                    'rounded-lg px-2 py-2 cursor-pointer',
                    'transition-colors duration-150',
                    'hover:bg-muted/70',
                    isActive && 'bg-muted/50'
                  )}
                >
                  <Icon
                    className={cn(
                      'mt-0.5 size-4 shrink-0',
                      isActive ? feature.accent : 'text-muted-foreground'
                    )}
                  />

                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'flex-1 truncate text-[13px] font-medium',
                          isActive ? 'text-foreground' : 'text-foreground/85'
                        )}
                      >
                        {feature.label}
                      </span>

                      {isActive && (
                        <Check className="size-3.5 shrink-0 text-foreground/80" />
                      )}

                      {feature.configurable && (
                        <TooltipProvider delayDuration={120}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                aria-label={`${feature.label} settings (coming soon)`}
                                onClick={(e) => e.stopPropagation()}
                                className={cn(
                                  'flex size-6 shrink-0 items-center justify-center',
                                  'rounded-md text-muted-foreground/70',
                                  'hover:bg-muted hover:text-foreground',
                                  'opacity-70 hover:opacity-100',
                                  'transition-opacity duration-150',
                                  'focus:outline-none focus-visible:opacity-100',
                                  'focus-visible:ring-2 focus-visible:ring-foreground/15'
                                )}
                              >
                                <Settings2 className="size-3.5" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent
                              side="right"
                              sideOffset={6}
                              className="z-100"
                            >
                              <p>{feature.label} settings (coming soon)</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>

                    <p
                      className={cn(
                        'mt-0.5 text-[11px] leading-snug',
                        'text-muted-foreground'
                      )}
                    >
                      {feature.description}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

// ============================================================================
// Active-pill renderer
// ============================================================================

type ChatActivePillProps = {
  feature: ChatFeature;
  onClear: () => void;
  disabled?: boolean;
};

/**
 * Onyx-style "selected" pill that appears to the right of the config
 * icon when a feature is enabled. Click to remove (mirrors Onyx's
 * `forcedToolIds.map(... => <SelectButton state="selected" />)`).
 */
export function ChatActivePill({
  feature,
  onClear,
  disabled,
}: ChatActivePillProps) {
  const Icon = feature.icon;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClear}
          disabled={disabled}
          aria-label={`Disable ${feature.label}`}
          aria-pressed
          className={cn(
            'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-2.5',
            'text-xs font-medium',
            'border border-border/70 bg-muted/60',
            'text-foreground',
            'transition-colors duration-150',
            'hover:border-foreground/20 hover:bg-muted',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/15',
            'disabled:cursor-not-allowed disabled:opacity-50'
          )}
        >
          <Icon className={cn('size-3.5', feature.accent)} />
          <span className="truncate">{feature.label}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">
        <p>{feature.label} on — click to disable</p>
      </TooltipContent>
    </Tooltip>
  );
}
