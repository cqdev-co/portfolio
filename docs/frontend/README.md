# Frontend Documentation

## SEO Implementation

The portfolio frontend implements comprehensive SEO optimizations using Next.js App Router metadata features.

### Core SEO Features

#### Metadata Configuration

**Root Layout (`src/app/layout.tsx`)**:

- Title template with `%s | cgq` format
- OpenGraph and Twitter card configurations
- Search engine verification (Google, Yandex, Bing)
- Format detection disabled for cleaner display

**`createMetadata()` Utility (`src/lib/utils.ts`)**:

- Reusable metadata generator for consistent SEO across pages
- Supports: title, description, pageUrl, type (website/article/profile), imagePath, keywords
- Generates canonical URLs and robots directives

#### Dynamic Sitemap (`src/app/sitemap.ts`)

Automatically generates sitemap including:

- Static routes (home, about, blog, scanners)
- Dynamic blog post routes with featured post prioritization
- Scanner pages (penny-stock-scanner, unusual-options-scanner, positions)
- Error handling with fallback to static routes

#### Robots Configuration (`src/app/robots.ts`)

- Rules for all user agents
- Specific crawl delays for Googlebot and Bingbot
- Disallows private, API, and Next.js internal routes
- References sitemap URL

#### Structured Data (JSON-LD)

Located in `src/components/schema.tsx`:

| Schema             | Usage                                         |
| ------------------ | --------------------------------------------- |
| `PersonSchema`     | Root layout - author/person information       |
| `WebsiteSchema`    | Root layout - website metadata                |
| `BlogPostSchema`   | Blog posts - article structured data          |
| `BreadcrumbSchema` | Blog posts, scanners - navigation breadcrumbs |

#### Dynamic OpenGraph Images

- Root OG image (`src/app/opengraph-image.tsx`)
- Blog post OG images (`src/app/blog/[slug]/opengraph-image.tsx`)
- About page OG image (`src/app/about/opengraph-image.tsx`)
- Penny Stock Scanner OG image (`src/app/penny-stock-scanner/opengraph-image.tsx`)

### Search Engine Verification

Add verification codes via environment variables:

```bash
# .env.local
NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=your_google_code
NEXT_PUBLIC_YANDEX_VERIFICATION=your_yandex_code
```

### Breadcrumb Schema Implementation

Breadcrumbs are implemented on:

- **Blog posts**: Home → Blog → Post Title
- **Scanners page**: Home → Scanners
- **Penny Stock Scanner**: Home → Scanners → Penny Stock Scanner
- **Unusual Options Scanner**: Home → Scanners → Unusual Options Scanner

### Adding SEO to New Pages

1. **Server Components**: Export metadata object or use `generateMetadata()` for dynamic pages
2. **Use `createMetadata()` utility**: For consistent metadata structure
3. **Add to sitemap**: Include new routes in `src/app/sitemap.ts`
4. **Add BreadcrumbSchema**: For hierarchical pages

Example for a new page:

```typescript
// src/app/new-page/layout.tsx
import type { Metadata } from 'next';
import { BreadcrumbSchema } from '@/components/schema';

export const metadata: Metadata = {
  title: 'New Page Title',
  description: 'Page description for search engines',
  keywords: ['keyword1', 'keyword2'],
  openGraph: {
    title: 'New Page Title',
    description: 'OpenGraph description',
    type: 'website',
  },
};

export default function NewPageLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <BreadcrumbSchema
        items={[
          { name: 'Home', url: 'https://conorq.com' },
          { name: 'New Page', url: 'https://conorq.com/new-page' },
        ]}
      />
      {children}
    </>
  );
}
```

---

## Error Boundaries

The frontend implements React Error Boundaries at multiple levels to prevent
runtime errors from crashing the page:

### Next.js Route-Level Error Boundaries

Each major section has a dedicated `error.tsx` file that catches errors within
that route segment:

| Route                   | File                                        |
| ----------------------- | ------------------------------------------- |
| Global (all pages)      | `src/app/error.tsx`                         |
| Unusual Options Scanner | `src/app/unusual-options-scanner/error.tsx` |
| Penny Stock Scanner     | `src/app/penny-stock-scanner/error.tsx`     |
| Position Tracker        | `src/app/positions/error.tsx`               |

Each error boundary:

- Displays a user-friendly error message specific to the section
- Provides "Try again" and "Reload page" buttons for recovery
- Shows error details in development mode only
- Logs errors to the console with section context

### Reusable ErrorBoundary Component

For wrapping specific component trees within a page:

```typescript
import { ErrorBoundary } from '@/components/error-boundary';

<ErrorBoundary section="Options Chain">
  <OptionsChainTable data={data} />
</ErrorBoundary>
```

## Chat Page (`/chat`)

The AI assistant lives on a dedicated route at `/chat`. The floating chat
panel that previously overlaid the current page has been retired; the new
chat surface is rendered as a **persistent overlay from the root layout**
so opening it feels like the layout expanding over the current page, not
a route navigation. The URL still becomes `/chat` (deep-linkable,
share-able, ⌘K-driven), but the previous page's tree stays mounted in
the background.

### Entry Points

- **Dock**: the sparkle icon in the bottom dock toggles `/chat`. When
  closed it `router.push`es; when already open it `router.back()`s
  (falls back to `router.push('/')` if there is no history).
  See `src/components/navbar.tsx`.
- **⌘K / Ctrl+K**: handled in `ChatProvider`
  (`src/components/chat/chat-context.tsx`), same toggle semantics as
  the dock.
- **Programmatic**: feature code calls `useGlobalChat().openChat(prompt?)`
  which `router.push`es to `/chat?prompt=<encoded>`. Used by:
  - Dashboard "Ask Xylo" button (`src/components/dashboard/dashboard-client.tsx`)
  - Positions per-position / per-spread / portfolio analysis buttons
    (`src/components/positions/positions-page-client.tsx`)
  - Built via the `buildPositionPrompt`, `buildSpreadPrompt`, and
    `buildPortfolioPrompt` helpers exported from `chat-context.tsx`.

### Overlay Strategy

`/chat` is intentionally a thin route — `src/app/chat/page.tsx` returns
`null`. The actual UI is `<ChatOverlay />` mounted from
`src/app/layout.tsx` (inside `ChatProvider`, wrapped in `Suspense` so
`useSearchParams` doesn't deopt static routes). The overlay watches
`usePathname()` and renders the chat surface inside `<AnimatePresence>`
when pathname is `/chat`.

Two motion layers run in parallel (both `fixed inset-0 z-20`, sitting
under the dock at `z-30` so the dock stays clickable):

1. **Backdrop** — a solid `bg-background` plane, opaque from `t=0` so the
   `<main>` swap from the previous page to the empty `/chat/page.tsx`
   is never visible.
2. **Surface** — the chat UI scaled subtly from the centre of the
   viewport (`transformOrigin: '50% 50%'`, `scale: 0.985 → 1`) with an
   ease-out cubic-bezier (`[0.32, 0.72, 0, 1]`, the Vercel/Linear
   curve). No spring, no overshoot — composed and intentional.

A single 320ms duration governs both opacity and scale on entrance, so
they arrive together. On close, the backdrop fades over 220ms and the
surface scales back to 0.99 with the same easing, revealing the
previously-mounted page underneath.

Files:

- `src/components/chat/chat-overlay.tsx` — overlay wrapper, owns the
  open/close motion + reads `?prompt=` via `useSearchParams`.
- `src/app/chat/page.tsx` — empty placeholder, exists only so `/chat` is
  a real route.
- `src/app/chat/chat-experience.tsx` — the chat UI itself: `useChat`,
  empty/thread morph, error banner, keyboard handlers.

### Empty → Thread Morph

The page has two states driven by `messages.length === 0`:

1. **Empty (centered hero)** — large gradient sparkle, "Ask anything"
   headline, centered input, and four suggestion chips.
2. **Thread** — small sparkle in the header, `ChatMessages` thread, and a
   bottom-docked composer.

Both states are wrapped in a framer-motion `LayoutGroup`. Two pairs of
shared `layoutId`s drive the morph on first message:

- `layoutId="chat-sparkle"` morphs the large hero sparkle into a small
  header badge.
- `layoutId="chat-input-wrapper"` morphs the centered composer down to its
  docked position above the bottom dock (`pb-20 sm:pb-24`).

`AnimatePresence mode="wait"` cross-fades the rest of the empty / thread
content around the morphing elements.

### Initial Prompt Flow

When `/chat?prompt=...` is loaded, the client experience:

1. Stashes the prompt in a `useRef` and bumps the `useChat` `id` key.
2. `router.replace('/chat')` strips the query string immediately so a
   refresh doesn't resend the prompt.
3. As soon as `status === 'ready'` and the message list is empty, the
   pending prompt is sent.

### ChatProvider

`src/components/chat/chat-context.tsx` is now a thin shim around
`router.push`. It exposes only `openChat(prompt?)` plus the prompt-builder
helpers; the prior `isOpen` / `isFullscreen` / `toggleChat` /
`toggleFullscreen` / `clearInitialPrompt` panel state has been removed.

## API Rate Limiting

The chat API endpoint (`/api/chat`) includes per-user rate limiting to prevent
abuse and excessive Ollama API calls.

### Configuration

```bash
# .env.local
AI_CHAT_RATE_LIMIT=20          # Max requests per window
AI_CHAT_RATE_WINDOW_MS=60000   # Window duration (ms)
```

### Email Whitelist (AI Chat + Dashboard)

Both the AI chat feature and the private fund dashboard are restricted to
whitelisted email addresses configured via a single environment variable
(comma-separated):

```bash
# .env.local
NEXT_PUBLIC_WHITELISTED_EMAILS=user1@example.com,user2@example.com
```

This variable controls access to:

- **AI Chat** (`/api/chat`) — only whitelisted emails can use the chat
- **Dashboard** (`/dashboard`) — only whitelisted emails can view the dashboard
- **Dashboard Briefing API** (`/api/dashboard/briefing`) — only whitelisted emails can generate briefings

### Rate Limiter Implementation

Located in `src/lib/rate-limit.ts`, the rate limiter uses an in-memory sliding
window approach. Pre-configured limiters:

- `chatRateLimiter` — 20 requests/60s per user email
- `apiRateLimiter` — 60 requests/60s per IP (available for other routes)

### API Response Caching

API routes include HTTP cache headers for CDN and browser caching:

| Route                      | Cache Strategy                               |
| -------------------------- | -------------------------------------------- |
| `/api/stock-prices`        | 2 min s-maxage, 1 min stale-while-revalidate |
| `/api/odyssey/market-data` | 2 min s-maxage, 3 min stale-while-revalidate |
| `/api/odyssey/sector-data` | 3 min s-maxage, 2 min stale-while-revalidate |
| `/api/chat/models`         | 5 min Next.js revalidate                     |

---

## Recent Updates

### Blog: Log Ingestion Pipeline Post (April 2026)

Added a new long-form blog post at `frontend/content/log-ingestion-pipeline.mdx`
covering the six-month journey of architecting a serverless AWS log
ingestion pipeline for eight SaaS security sources.

**May 2026 editorial pass.** Reframed the article around the build-vs-buy
narrative the author actually lived: the SAM had no data to query, the
unlock was discovering the SAM could query S3 directly, and the LIP
displaced what would have been a five-figure commercial pipeline (Cribl)
with a four-figure in-house equivalent. Concrete changes:

- Rewrote the introduction to lead with the SAM forcing function and the
  S3-query unlock, and to explicitly name the Cribl alternative.
- Added a fourth factor to the architecture decision rationale —
  "stayed inside our existing AWS bill" — addressing CISO concerns about
  vendor sprawl and additional attack surface.
- Replaced the soft "fraction of a SaaS subscription" cost row in the
  Results table with a concrete "low four figures/year — roughly 1/10th
  the cost of a comparable commercial pipeline tool" comparison.
- Added a new `## Build vs. Buy` section between Results and Lessons
  Learned, mirroring the structure of
  `seceng-event-gateway-autonomous-security.mdx`.
- Strengthened the conclusion with a "For the reader still here"
  multi-audience tail (engineer / architect / security leader).
- Updated the frontmatter `summary` field to reflect the new framing
  (so blog cards and OG previews surface the build-vs-buy hook).

**May 2026 voice revision.** Second editorial pass after the author
flagged that the article still read more like a story than a personal
blog. Tightened the voice and reframed the introduction around the
author's own words:

- Rewrote the introduction to lead directly with "We were missing a
  critical layer in our security stack: our data layer" and the
  Cribl-vs-in-house cost comparison up front. Replaced the strategic
  framing with the author's two real reasons for building own
  integrations: speed vs. waiting on the SAM vendor's roadmap, and
  keeping data inside our own AWS environment.
- Fixed the "unlock" sentence — previously "the SAM could query S3
  directly," now phrased as the author actually experienced it: "The
  idea hit me when I saw I could connect the SAM to S3 directly."
- Tightened the architecture decision paragraph to three factors and
  removed the confusing "the SAM already lived in AWS" line.
- Reworked `## Build vs. Buy` around the author's stated reasoning:
  cheaper, easy CISO conversation, data stays inside our environment,
  and Claude Code as a real shipping accelerator. Dropped the
  "six months" framing (author was split across responsibilities) and
  the bus-factor admission.
- Replaced the three "What I'd Do Differently" items with the author's
  three: prioritize observability AND get one source production-ready
  first; build the test suite alongside the first source for vendor
  sanity-checking; watch for code duplication and abstract earlier.
- Voice pass on the rest of the article: removed retrospective arc
  phrasings ("After six months in production…", "what started as…"),
  trimmed redundant `_"I remember thinking…"_` quoted thoughts (kept
  only the `BasePoller` aha-moment), and tightened the Conclusion
  intro from narrative to direct claim.
- Re-aimed the frontmatter `summary` at the new opening framing.

**Mermaid diagram support (May 2026).** Added first-class mermaid
diagram rendering so MDX authors can write real flowcharts instead of
ASCII arrow strings. Integration points:

- New dependency: `mermaid@^11` in
  [frontend/package.json](../../frontend/package.json).
- New client component:
  [frontend/src/components/mermaid-diagram.tsx](../../frontend/src/components/mermaid-diagram.tsx).
  `'use client'`, lazy-imports `mermaid` inside a `useEffect`, calls
  `mermaid.initialize` with theme derived from `next-themes`'
  `resolvedTheme` (so dark mode picks up automatically), then renders
  the resulting SVG via `dangerouslySetInnerHTML`. Re-runs whenever
  `source` or `resolvedTheme` changes. Uses `securityLevel: 'loose'`
  because MDX content is author-controlled and we need `<br/>` line
  breaks inside node labels. Renders a "Rendering diagram…" placeholder
  during the async import and falls back to the raw source in a styled
  `<pre>` if mermaid throws.
- Wiring lives in the `CodeBlock` handler in
  [frontend/src/components/mdx.tsx](../../frontend/src/components/mdx.tsx).
  We inspect the child `<code>` element's `className`; if it equals
  `'language-mermaid'` we extract the text content and render
  `<MermaidDiagram source={…} />` instead of the styled `<pre>`. Every
  other language (`language-python`, `language-hcl`, `language-yaml`,
  etc.) passes through unchanged, so the other two posts continue to
  render identically.
- Authoring: any MDX file may now use a ` ```mermaid ` code block.
  Node labels with line breaks should use `Label["First line<br/>second line"]`.
- Three diagrams in `log-ingestion-pipeline.mdx` (the three ingestion
  patterns) were migrated from ASCII arrow strings to mermaid
  `flowchart LR` diagrams as part of this revision. The
  `source=<name>/year=…` path layout block stayed a ` ```text ` block
  because it's a string format, not a diagram.

**May 13 2026 follow-up revision.** Third editorial pass driven by
author feedback on the rendered post:

- **De-branded the build-vs-buy framing.** Replaced every explicit
  "Cribl" mention with category language ("commercial security data
  pipeline", "commercial pipelines in this space"). The cost framing
  (five figures vs. less than four figures) stays intact. This applies
  to the frontmatter `summary`, the Introduction's lead sentence, and
  all three references in the `## Build vs. Buy` section.
- **Rewrote the data-residency bullet in the Introduction.** The prior
  version listed short-term operational concerns (extra credentials,
  vendor security reviews, integrations to maintain). Replaced with
  the actual reasons: data governance — security logs are sensitive
  and we shouldn't accept a SAM vendor's retention/access posture by
  default — and avoiding lock-in if we ever need to swap SAM vendors.
- **Reframed the "building solo" paragraph in The Problem.** The prior
  version positioned the architecture as constrained by the author
  working alone. Reframed as a longer-term, architect-mindset
  constraint: designing for the team that doesn't exist yet, so
  anyone who picks the system up later can learn, maintain, and
  extend it. Also softened a now-duplicated "ruled out clever / ruled
  in boring" cadence in the 2 AM sentence below the requirements list.
- **Simplified the three mermaid diagrams.** The prior versions
  enumerated every AWS service (API Gateway, Lambda Handler, SQS,
  Lambda Processor, Kinesis Firehose, S3 Bucket — 7 nodes for the
  webhook diagram, 8 for polling). The screenshots showed they were
  unreadable at-a-glance because the rail spanned the full width.
  Collapsed to conceptual stages: `SaaS Source → Receive &
Authenticate → Buffer & Process → Data Lake` (4 nodes for webhook),
  `Schedule → Poll & Fetch ↔ SaaS Source API → Buffer & Process →
Data Lake` (5 nodes for polling), `SaaS Source → Data Lake` (2 nodes
  for S3 streaming). The AWS service names stay in the prose
  underneath each diagram.
- **Added a 30-day reliability row to the Results table** to
  highlight hands-off operation: "Reliability (last 30 days): 100%
  uptime, zero errors." Renamed the existing Lambda success rate row
  to "Lambda success rate (lifetime)" to distinguish the two
  measurements. Updated the closing paragraph below the table to
  explicitly state that no failed invocations, no DLQ messages, and
  no on-call pages occurred in the trailing 30 days — proof the
  system can run without daily attention.

The file was normalized to match the standard MDX frontmatter contract
consumed by `frontend/src/data/blog.ts` (see `Metadata` type):

```yaml
---
title: >
  Building a Security Data Lake: How I Architected a Log
  Ingestion Pipeline for 8 SaaS Sources
publishedAt: '2026-03-21'
summary: >
  The six-month journey of designing and operating a serverless AWS
  log ingestion pipeline that delivers security logs from eight SaaS
  platforms into a data lake in under three minutes, built and run
  by a single engineer.
image: '/wallpapers/Cyera_Gradient_Blue_Purple.png'
tags:
  [
    'Security',
    'Data Engineering',
    'AWS',
    'Serverless',
    'Terraform',
    'Observability',
    'Cyera',
  ]
---
```

Authoring conventions applied (to stay consistent with
`seceng-event-gateway-autonomous-security.mdx` and
`integrating-nuclei-into-cicd.mdx`):

- Frontmatter uses `title`, `publishedAt`, `summary`, `image`, `tags` — no
  ad-hoc keys like `project`, `type`, `author`, or `last_updated`.
- No top-level `# H1` heading in the body — the title is rendered from
  frontmatter; body sections start at `##`.
- No manual reading-time line — reading time is auto-calculated by
  `calculateReadingTime()` in `frontend/src/data/blog.ts`.
- A banner image (`![alt](/path)`) is placed immediately after the
  frontmatter, matching the `image` field.
- Inline quoted thoughts use `_"..."_` italics for consistency.
- ASCII flow diagrams are tagged ` ```text ` so `rehype-pretty-code`
  renders them as plain code blocks rather than attempting language
  highlighting.

### FinanceChart Component (January 2026)

Added a new Robinhood-inspired finance chart component for clean, modern financial data visualization.

#### Design Philosophy

Inspired by Robinhood's iconic chart design, focusing on:

- **Minimalism**: No chart clutter - just the line, gradient fill, and essential info
- **Color Psychology**: Green (#00C805) for gains, orange (#FF5000) for losses
- **Motion**: Smooth animations and micro-interactions via Framer Motion
- **Intuitive Hover**: Crosshair cursor with glowing dot and vertical guide line
- **Responsive**: Works seamlessly across all screen sizes

#### Components

**1. FinanceChart (Main Component)**

Full-featured chart with header, time range selector, and hover interactions.

```typescript
import { FinanceChart } from '@/components/ui/finance-chart';

<FinanceChart
  data={priceData}
  ticker="AAPL"
  companyName="Apple Inc."
  selectedRange="1M"
  onRangeChange={(range) => setRange(range)}
  height={300}
  showHeader={true}
/>
```

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `data` | `FinanceDataPoint[]` | required | Array of price data |
| `ticker` | `string` | - | Stock ticker symbol |
| `companyName` | `string` | - | Company name |
| `selectedRange` | `TimeRange` | `'1M'` | Current time range |
| `onRangeChange` | `(range) => void` | - | Range change callback |
| `timeRanges` | `TimeRange[]` | `['1D','1W','1M','3M','1Y','ALL']` | Available ranges |
| `height` | `number` | `300` | Chart height in px |
| `showHeader` | `boolean` | `true` | Show price header |
| `loading` | `boolean` | `false` | Loading state |
| `error` | `string \| null` | `null` | Error message |
| `forceColor` | `'positive' \| 'negative'` | - | Override gain/loss colors |
| `showVolume` | `boolean` | `false` | Show volume bars |
| `currency` | `string` | `'$'` | Currency symbol |
| `decimals` | `number` | `2` | Price decimal places |

**2. CompactFinanceChart (Widget Variant)**

Minimal sparkline-style chart for cards and list items.

```typescript
import { CompactFinanceChart } from '@/components/ui/finance-chart';

<CompactFinanceChart
  data={priceData}
  height={60}
  showIndicator={true}
/>
```

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `data` | `FinanceDataPoint[]` | required | Price data array |
| `height` | `number` | `60` | Chart height |
| `showIndicator` | `boolean` | `true` | Show pulsing dot |
| `className` | `string` | - | Additional classes |

#### Data Types

```typescript
interface FinanceDataPoint {
  time: string; // ISO timestamp
  price: number; // Current/close price
  open?: number; // Open price (optional)
  high?: number; // High price (optional)
  low?: number; // Low price (optional)
  close?: number; // Close price (optional)
  volume?: number; // Volume (optional)
}

type TimeRange = '1D' | '1W' | '1M' | '3M' | '6M' | '1Y' | 'ALL';
```

#### Exported Utilities

```typescript
import {
  formatFinancePrice, // Format price with currency
  formatFinanceChange, // Format change with sign
  calculatePriceChange, // Get change stats from data
  FINANCE_CHART_COLORS, // Color constants
} from '@/components/ui/finance-chart';
```

#### Features

- **Animated Time Range Selector**: Spring-animated pill indicator
- **Smart Color Theming**: Auto-switches between green/red based on performance
- **Reference Line**: Dashed line at starting price for visual comparison
- **Gradient Fill**: Subtle area fill matching the line color
- **Loading Skeleton**: Animated shimmer effect during data fetch
- **Error State**: Clean error display with destructive styling
- **Keyboard Accessible**: Proper focus states and ARIA support

#### Integration with Stock Prices API

Works seamlessly with the existing `/api/stock-prices` endpoint:

```typescript
import { fetchHistoricalPrices } from '@/lib/api/stock-prices';
import { FinanceChart } from '@/components/ui/finance-chart';

const [data, setData] = useState([]);
const [range, setRange] = useState('1M');

useEffect(() => {
  fetchHistoricalPrices('AAPL', range).then(setData);
}, [range]);

<FinanceChart
  data={data}
  selectedRange={range}
  onRangeChange={setRange}
/>
```

#### Files

- `src/components/ui/finance-chart.tsx` - Main component file
- `src/app/globals.css` - Added shimmer animation

#### Integration: Unusual Options Scanner

The `price-chart.tsx` component in `src/components/unusual-options/` has been completely refactored to use the Robinhood-inspired design while maintaining its signal detection overlay functionality.

**Key Features Preserved:**

- Signal detection dots on the chart (green for calls, red for puts, purple for mixed)
- Clickable signal dots with pinned tooltip functionality
- Signal count badges for multiple detections at same time
- ESC key to close pinned tooltips

**New Robinhood-Style Updates:**

- Area fill with gradient instead of plain line
- Spring-animated time range selector
- Smooth hover transitions with Framer Motion
- Reference line at starting price
- Cleaner tooltip design with larger typography
- Color-matched cursors and indicators

#### Integration: Penny Stock Scanner

Added the `FinanceChart` component to the penny stock scanner's detail sidebar.

```typescript
// In page.tsx, new state variables:
const [chartData, setChartData] = useState<PriceDataPoint[]>([]);
const [chartLoading, setChartLoading] = useState(false);
const [chartError, setChartError] = useState<string | null>(null);
const [chartRange, setChartRange] = useState<ChartTimeRange>('1M');

// Auto-fetch when selected signal changes:
useEffect(() => {
  fetchHistoricalPrices(selectedSignal.symbol, chartRange).then(setChartData);
  // ...
}, [selectedSignal?.symbol, chartRange]);
```

**Features:**

- Chart appears at top of sidebar when viewing signal details
- Compact 180px height to fit sidebar
- Time ranges: 1D, 1W, 1M, 3M, 1Y
- Header hidden (price already shown in sidebar stats)
- Auto-fetches data when switching between signals

### Penny Stock Scanner UI Enhancements (January 2026)

Enhanced the Penny Stock Scanner frontend to display new signal quality indicators based on January 2026 performance analysis. These changes surface the data-driven insights that were added to the backend scoring logic.

#### Performance Stats Dashboard (NEW)

Added a prominent performance stats section showing 30-day trading performance:

- **Win Rate**: Overall win rate with color coding (green ≥50%, red <50%)
- **Avg Return**: Average return percentage with trend indicator
- **Profit Targets**: Percentage of trades hitting 10%+ profit target
- **Stop Loss Rate**: Percentage of trades hitting stop loss

The stats are displayed in gradient cards that stand out from the regular signal stats.

#### Functional Filters (NEW)

Replaced the placeholder Filters button with a functional filter popover:

**Filter Options:**

- **Opportunity Rank**: Multi-select (S, A, B, C, D) with color-coded buttons
- **Recommendation**: Multi-select (STRONG_BUY, BUY, WATCH, HOLD)
- **Quick Filters**:
  - Volume Sweet Spot (2-3x) - checkbox
  - Breakouts Only - checkbox

**Features:**

- Active filter count badge on button
- Clear all filters option
- Apply/Cancel buttons
- Filter state persists until cleared

#### New Table Columns

1. **Action Column**: Displays the recommendation (STRONG_BUY, BUY, WATCH, HOLD) with color-coded badges
2. **Signals Column**: Visual indicators showing signal quality factors:
   - 💰 **Volume Sweet Spot** (emerald): Volume is in optimal 2-3x range
   - 🔥 **Green Days Optimal** (green): 1 consecutive green day (64.8% WR)
   - 📈 **52-Week Position Optimal** (blue): Stock is 25-50% from 52-week low
   - ⏰ **Late Entry Warning** (amber): Price already moved 15%+ in 5 days
   - 📅 **Friday Bonus** (green): Entry on Friday (historically better performance)

#### Enhanced Sidebar Sections

**Recommendation Section**:

- Prominent recommendation badge with color coding
- Overall score displayed inline

**Signal Quality Section** (New):

- **Volume Range**: Shows volume ratio with "Sweet Spot" or "High" indicators
- **Green Days**: Consecutive up days with optimal (1 day) highlighting
- **From 52w Low**: Distance from 52-week low with optimal zone (25-50%) indicator
- **5-Day Move**: Late entry detection with warning for 15%+ moves
- **Entry Day**: Day of week with bonus/penalty indicators

**Market Comparison Section** (New):

- SPY outperformance percentage for 5-day period
- Green/red color coding based on relative performance

**Component Scores Section** (Updated):

- Now shows weight percentages: Volume (50%), Momentum (30%), Rel Strength (15%), Risk (5%)
- Added Risk Score display

#### Helper Functions Added

```typescript
// Check if volume is in sweet spot (2-3x is optimal)
function isVolumeInSweetSpot(volumeRatio: number | null): boolean;

// Check if late entry (price already moved 15%+ in 5 days)
function isLateEntry(priceChange5d: number | null): boolean;

// Check if 52-week position is optimal (25-50% from low)
function is52wPositionOptimal(distanceFromLow: number | null): boolean;

// Check if green days count is optimal (1 day = 64.8% WR)
function isGreenDaysOptimal(greenDays: number | null): boolean;

// Get day of week status (bonus/penalty/neutral)
function getDayOfWeekStatus(dateStr: string): 'bonus' | 'penalty' | 'neutral';
```

#### New Icons Used

- `TrendingUp` - 52-week position indicator
- `Calendar` - Day of week indicator
- `Flame` - Green days indicator
- `Clock` - Late entry warning

#### Design Principles

- All indicators use consistent color coding:
  - ✓ Green/Emerald/Blue: Optimal conditions
  - ⚠️ Amber: Warning conditions
  - Muted: Neutral conditions
- Tooltips explain what each indicator means
- Compact layout to avoid overwhelming users
- Information hierarchy: Most actionable info (recommendation) shown first

### Dashboard CI Fixes (February 2026)

Fixed multiple typecheck, lint, and build errors in dashboard components:

- **`daily-briefing.tsx`**: Fixed `changePct` → `changePercent` to match `MarketDataPoint` type from `market-pulse.tsx`. Also fixed `usePositionAnnotations()` hook — moved sessionStorage read from a synchronous `setState` inside `useEffect` to a lazy `useState` initializer, resolving the `react-hooks/set-state-in-effect` lint error.
- **`positions-overview.tsx`**: Fixed conditional `useMemo` hook call — moved `useMemo` above the early `if (loading)` return to comply with React's rules of hooks.
- **`performance-section.tsx`**: Removed unused `totalPnl` variable in `TradeStats` component.
- **`options-chain/route.ts`**: Removed unused `eslint-disable-next-line @typescript-eslint/no-explicit-any` directives.
- **`mdx.tsx`**: Removed unused eslint-disable directive and improved type from `any` to `Record<string, React.ComponentType<any>>`.

### Fund Dashboard (February 2026)

A private, auth-gated dashboard at `/dashboard` designed as an **AI-native morning brief** for the hedge fund. The layout follows a narrative flow — not a data-dense terminal — using progressive disclosure to prevent information overload while ensuring everything you need is immediately accessible.

Access is restricted to whitelisted emails (configured via `NEXT_PUBLIC_WHITELISTED_EMAILS` in `.env.local`).

#### Design Philosophy

The dashboard answers three questions in order:

1. **"What's happening?"** — Market regime, VIX, circuit breaker status (Status Bar)
2. **"What should I do?"** — AI briefing with interactive action items (Daily Briefing)
3. **"What needs my attention?"** — Positions filtered by urgency (Attention Required)

Everything else (raw market data, full signal lists, trade history) is available on demand via collapsible sections. The goal is **zero scroll for the 80% case** — status bar + briefing + urgent positions fits on one screen most mornings.

#### Route & Auth

- **Route**: `/dashboard` with `layout.tsx` (metadata, `robots: noindex`)
- **Auth Gating**: Client-side email check via `useAuth()` hook against `NEXT_PUBLIC_WHITELISTED_EMAILS` whitelist
- **States**: Loading spinner, sign-in prompt, access denied, and full dashboard

#### Dashboard Layout (top to bottom)

**1. Status Bar** (`status-bar.tsx`) — **NEW**

- Single compact header line replacing the old header + Market Pulse + Risk Status
- Shows: title, market open/closed badge, regime badge (RISK_ON / RISK_OFF / NEUTRAL / HIGH_VOL), VIX regime badge (CALM / NORMAL / ELEVATED / HIGH / EXTREME)
- **Circuit breaker indicator**: Colored dot (green/yellow-pulse/red-pulse) with label (All Clear / Reduce Size / Pause Trading)
- Last refresh timestamp, Refresh button, Ask Xylo button
- Regime detection: SPY % change + VIX price → market regime classification
- Circuit breaker logic: portfolio drawdown + positions-at-risk count → green/yellow/red

**2. AI Daily Briefing** (`daily-briefing.tsx`) — **Hero Section**

- Auto-generated morning briefing by Xylo (AI analyst persona) on dashboard load
- Gathers context: market data, positions, spreads, unified signals, economic calendar, regime
- Calls `/api/dashboard/briefing` (POST) which sends context to Ollama for structured analysis
- Returns JSON with: `briefing`, `positionNotes`, `actionItems`, `riskAlerts`, `signalHighlights`
- **Interactive action items** with checkboxes — check off items as you act on them during the session
  - Checked state persisted in sessionStorage
  - Progress counter ("2/4 done")
  - Checked items reset when a new briefing is generated
- Typewriter animation for briefing text display
- Collapsible sections: Action Items (checkboxes), Risk Alerts, Signal Highlights, Upcoming Events
- Caches in sessionStorage (30-minute TTL) to avoid re-generation on refresh
- Position annotations surfaced via `usePositionAnnotations()` hook

**3. Attention Required** (`attention-required.tsx`) — **NEW**

- Replaces the old Portfolio Summary + full Positions Overview table
- Filters all positions for **urgency**, showing only those needing a decision:
  - **EXPIRED** (DTE ≤ 0) — highest priority
  - **Expiring Soon** (DTE ≤ 7) — needs roll or expiry decision
  - **Review** (P&L ≤ -30%) — significant loss, needs evaluation
  - **Take Profit** (P&L ≥ 50%) — profit target hit
- Each urgent item renders as a compact card with: symbol, strategy detail, DTE, P&L, and action badge
- AI position annotations (from briefing) shown inline on urgent cards
- When no positions need attention: green "All X positions on track" banner
- **Collapsible full positions table**: "N positions on track" toggle expands to the full `PositionsOverview` component with all spread/standalone tables
- Section header shows total open positions count + attention-needed count

**4. Market Context** (`market-context.tsx`) — **NEW (collapsible, collapsed by default)**

- Wraps existing `MarketPulse` + `SectorHeatmap` in a collapsible section
- **Collapsed state**: Shows inline summary — "SPY +0.82% · QQQ +1.2% · VIX 14.2"
- **Expanded state**: Full Market Pulse cards (SPY, QQQ, DIA, IWM, VIX) + Sector Heatmap grid
- Default collapsed because the AI briefing already synthesizes this data into a narrative

**5. Signal Highlights** (`signal-highlights.tsx`) — **NEW (replaces SignalFeed + SignalsPanel)**

- Single unified signal section replacing the old two separate signal components
- Fetches from unified `signals` table (last 7 days, ordered by score)
- **Compact view** (default):
  - Multi-strategy convergence alerts (purple card with ticker + strategy combinations)
  - Top 5 S/A-grade signals as compact rows with grade badge, ticker, strategy, direction, score, date
- **Expanded view** (toggle):
  - Strategy filter tabs (All / CDS / PCS / PENNY)
  - Full signal list with all grades
  - Convergence highlighting preserved

**6. Trade Journal** (collapsible, collapsed by default)

- Inline collapsible toggle in `dashboard-client.tsx`
- Expands to render the existing `PerformanceSection` component
- Trade stats: Total Trades, Win Rate, Avg Win %, Avg Loss %
- Recent trades list with outcome, P&L, strategy, date

#### Components Retained (used internally)

These components are no longer rendered directly by `dashboard-client.tsx` but are used internally by the new wrapper components:

| Component                 | Used By                               |
| ------------------------- | ------------------------------------- |
| `market-pulse.tsx`        | `MarketContext` (expanded state)      |
| `sector-heatmap.tsx`      | `MarketContext` (expanded state)      |
| `positions-overview.tsx`  | `AttentionRequired` (expanded state)  |
| `performance-section.tsx` | Trade Journal toggle (expanded state) |

#### Components Superseded

These components are no longer rendered in the dashboard layout but remain in the codebase:

| Component               | Replaced By                                         |
| ----------------------- | --------------------------------------------------- |
| `portfolio-summary.tsx` | Removed — Robinhood handles portfolio value display |
| `signal-feed.tsx`       | `SignalHighlights` (merged)                         |
| `signals-panel.tsx`     | `SignalHighlights` (merged)                         |
| `risk-status.tsx`       | `StatusBar` (circuit breaker moved to header)       |

#### Data Sources

| Section           | API / Data Source                                                            |
| ----------------- | ---------------------------------------------------------------------------- |
| Status Bar        | Client-side calculation from market data + positions                         |
| AI Briefing       | `/api/dashboard/briefing` (POST) → Ollama + all context sources              |
| Market Context    | `/api/odyssey/market-data`, `/api/odyssey/sector-data` (Yahoo Finance)       |
| Positions         | `/api/positions` + `/api/positions/prices` + `/api/positions/options-prices` |
| Signal Highlights | Supabase direct: `signals` (unified table)                                   |
| Events            | `/api/odyssey/economic-calendar`                                             |
| Trade Journal     | Supabase direct: `analyst_trades`                                            |

#### Auto-Refresh

- Market data refreshes every 60 seconds during market hours (Mon-Fri, 9:30 AM - 4:00 PM EST)
- Positions auto-refresh with market data on initial load
- Manual refresh button available at all times
- Market hours detection uses EST timezone

#### AI Integration

- **Daily Briefing** (proactive): Auto-generates on dashboard load with typewriter animation
  - Gathers: market indices, regime, positions, spreads, unified signals, economic calendar
  - Calls `/api/dashboard/briefing` which sends structured context to Ollama (non-streaming, temperature 0.3)
  - Returns structured JSON: briefing text, per-position annotations, action items, risk alerts, signal highlights
  - **Interactive action items**: Checkboxes to track completion during the session
  - Annotations flow to Attention Required cards + Positions Overview via `usePositionAnnotations()` hook + sessionStorage
  - Cached 30 minutes in sessionStorage; regenerate button available
- **Ask Xylo** (reactive): Button in status bar opens AI chat pre-loaded with full portfolio context
  - Builds prompt with all position data, spread details, and summary metrics
  - Uses existing `buildPortfolioPrompt` from chat component library

#### Files

```
src/app/dashboard/
├── layout.tsx               # Metadata (noindex, nofollow)
└── page.tsx                 # Entry point

src/app/api/dashboard/
└── briefing/route.ts       # AI briefing generation endpoint (POST)

src/components/dashboard/
├── dashboard-client.tsx     # Main orchestrator — narrative layout
├── status-bar.tsx           # Compact header: regime, VIX, circuit breaker, actions
├── daily-briefing.tsx       # AI briefing with interactive action item checkboxes
├── attention-required.tsx   # Urgent position cards + collapsible full table
├── market-context.tsx       # Collapsible wrapper: MarketPulse + SectorHeatmap
├── signal-highlights.tsx    # Convergence + top signals, expandable full list
├── market-pulse.tsx         # Market indices + regime badges (used by MarketContext)
├── sector-heatmap.tsx       # Sector performance grid (used by MarketContext)
├── positions-overview.tsx   # Full positions table (used by AttentionRequired)
├── performance-section.tsx  # Trade journal + stats (used by Trade Journal toggle)
├── portfolio-summary.tsx    # [Superseded] Summary metric cards
├── signal-feed.tsx          # [Superseded] Full signal feed with filters
├── signals-panel.tsx        # [Superseded] Live scanner signals feed
└── risk-status.tsx          # [Superseded] Circuit breaker + risk metrics
```

#### Options Pricing & Strike Interpolation

Yahoo Finance's v7 API returns a limited subset of strikes per expiration (~30 per side), which means specific strikes may be absent from the chain data. The `/api/positions/options-prices` route handles this with a multi-layer matching strategy:

1. **Exact match**: `c.strike === requestedStrike`
2. **Tolerance match**: Within $0.50 to handle floating-point differences
3. **Linear interpolation**: When the target strike is missing, finds the two nearest available strikes (one above, one below) and linearly interpolates bid, ask, lastPrice, and IV

This is critical for accurate spread P&L calculation — without interpolation, a missing short leg would fall back to intrinsic value (no time value), inflating the apparent spread value and showing false "max profit" signals.

#### Spread Mid Pricing

The spread calculation (`dashboard-client.tsx` and `positions-page-client.tsx`) uses **spread mid** pricing for P&L display. When full bid/ask data is available for both legs:

- **Spread bid** = long bid - short ask (worst case / natural close)
- **Spread ask** = long ask - short bid (best case)
- **Spread mid** = (spread bid + spread ask) / 2

This is more accurate than natural close (bid-ask) alone, which is too pessimistic for deep ITM spreads with wide bid/ask spreads. For example, a deep ITM $290/$295 call spread might show:

- Natural close: $2.50 (misleadingly negative P&L)
- Spread mid: $3.975 (accurate representation of current value)

The code also includes a safety-net estimation: if mid-price spread value exceeds spread width (indicating an intrinsic-only fallback), it estimates the missing leg using the known leg's time value ratio.

#### AI Briefing JSON Parsing

The `/api/dashboard/briefing` route handles two key DeepSeek quirks:

- **Thinking-only responses**: The model puts its entire response in `message.thinking` and leaves `message.content` empty. The route detects this and falls back to the thinking field automatically
- **Thinking mode disabled**: The request sets `think: false` to force the model to output directly into `content`, avoiding the empty-content issue entirely. If thinking content is still returned as plain prose (no JSON), it's used directly as the briefing text

It then uses a 4-strategy JSON extraction pipeline to handle extra text, `<think>` blocks, or malformed wrappers around the JSON:

1. **Strategy 1 — Direct parse**: Strip markdown fences, closed `<think>...</think>` tags, and unclosed `<think>` tags (anchoring on `{` after the tag), then `JSON.parse()`
2. **Strategy 2 — Anchor on `"briefing"` key**: Find `"briefing"` in the raw content, walk backward to the opening `{`, forward to the last `}`, then parse the extracted substring. This bypasses any thinking text that contains JSON-like characters
3. **Strategy 3 — Regex value extraction**: Extract individual values (`briefing`, `positionNotes`, `actionItems`, etc.) using targeted regex patterns, avoiding full JSON parse entirely
4. **Final fallback**: Return a graceful error message with an action item to review positions manually

Each strategy logs its success/failure for debugging. The raw content preview is also logged to help diagnose model output issues

#### Design

- Consistent with existing portfolio UI (shadcn/ui, Tailwind, Lucide icons)
- Loading skeletons for every section (progressive loading)
- Dark mode support throughout
- Compact typography with monospace for financial data
- Color-coded badges and metrics (green/red/amber)

---

### XML Tool Call Fallback Parser (February 2026)

Some LLM models (notably llama3.3 via Ollama) output tool calls as XML text in their response instead of using Ollama's native structured `tool_calls` JSON format. This caused tool calls to appear as raw XML in the chat UI and never actually execute.

**The Problem:**

When asked "Tell me what you think of MSFT", the model would output:

```xml
<function_calls>
<invoke name="get_ticker_data">
<parameter name="ticker">MSFT</parameter>
</invoke>
</function_calls>
```

This XML text was streamed to the client as visible content and the tool never executed, so the model couldn't complete its analysis.

**The Fix (3 layers):**

1. **XML Tool Call Parser** (`route.ts`): Added `parseXMLToolCalls()` that detects `<invoke>` / `<parameter>` patterns in the model's text output and converts them to the same `OllamaToolCall` format used by native tool calls. At stream completion, if no structured tool calls were detected but XML tool calls exist in the text, they are parsed and executed through the normal tool execution pipeline.

2. **Stream Suppression** (`route.ts`): Two layers of XML suppression in the streaming handler:
   - **Full-block suppression**: An `xmlToolCallDetected` flag detects complete XML patterns (`<function_calls>` or `<invoke `) in accumulated content. Once detected, all further text deltas from that streaming round are suppressed.
   - **Per-chunk cleaning**: `cleanPartialXMLTags()` strips partial/incomplete XML tag fragments (e.g., `<function`, `</invoke>`, `<parameter>`) from each text chunk before streaming. Uses word boundary (`\b`) to avoid false positives on words like `<functionality>`. This handles the case where models output partial XML in follow-up responses after tool execution (e.g., attempting additional tool calls but only emitting truncated tags).

3. **System Prompt Guidance** (`xylo.ts`): Added an explicit instruction in the `buildXyloLitePrompt` tool section telling the model to use the native function/tool calling mechanism and NOT write out function calls as XML/JSON/text. This is a preventive measure — models don't always follow this, which is why the parser exists as a safety net.

**Helper Functions Added:**

```typescript
// Parse XML-style function calls from model text output
function parseXMLToolCalls(text: string): OllamaToolCall[];

// Strip XML function call blocks from text for clean conversation history
function stripXMLToolCalls(text: string): string;

// Detect start of XML function call pattern in accumulated text
function findXMLToolCallStart(text: string): number;

// Clean partial XML tag fragments from streamed chunks (e.g., "<function")
function cleanPartialXMLTags(text: string): string;
```

**Files Changed:**

- `src/app/api/chat/route.ts` — Parser, stream suppression, fallback execution
- `lib/ai-agent/prompts/xylo.ts` — System prompt native tool call guidance

---

### Dedicated Chat Page (April 2026)

Replaced the floating `ChatPanel` with a `/chat` route whose UI is a
**persistent overlay rendered from the root layout**. Opening the chat
no longer feels like a route navigation — the previous page stays
mounted and the chat surface visibly rises from the dock over it.

**Why:**

- Give the AI assistant a real, focused UI rather than a cramped overlay
- Avoid the "redirect" feel of swapping `<main>` content
- Make conversations linkable / shareable (`/chat?prompt=...`)
- Set the foundation for future chat features (history, deeper context)
  without reshaping the panel each time.

**UX:**

- Dock sparkle is a toggle: open → `router.push('/chat')`; already on
  `/chat` → `router.back()` (or `/` fallback)
- Overlay backdrop is opaque from `t=0` so the `<main>` swap from
  homepage → empty `/chat/page.tsx` is never visible
- Surface scales in from the centre (`transformOrigin: '50% 50%'`,
  scale 0.985 → 1) with an ease-out cubic-bezier — composed, no
  spring overshoot
- Centered-hero empty state with four prompt suggestions
- First message morphs the layout into a thread view via framer-motion
  `LayoutGroup` + shared `layoutId`s (`chat-sparkle`, `chat-input-wrapper`)
- Escape closes (`router.back()`); dock stays visible above the overlay

**Changes Made:**

- **New `src/components/chat/chat-overlay.tsx`**: persistent overlay
  wrapper mounted from the root layout. Uses `usePathname()` to detect
  `/chat`, `useSearchParams()` to read `?prompt=`, and `AnimatePresence`
  with two layers (opaque backdrop + spring-up surface).
- **New `src/app/chat/chat-experience.tsx`**: the chat UI itself —
  `useChat`, empty/thread states, error banner, morph transitions, and
  keyboard handlers. No fixed positioning of its own; the overlay
  wrapper provides that.
- **`src/app/chat/page.tsx`**: empty placeholder (`return null`); only
  exists so `/chat` is a real route.
- **`src/app/layout.tsx`**: mounts `<ChatOverlay />` inside
  `<ChatProvider>` wrapped in `<Suspense fallback={null}>`.
- **`src/components/chat/chat-context.tsx`**: pruned to a router-backed
  `openChat(prompt?)` plus the prompt-builder helpers; removed
  `isOpen`/`isFullscreen`/`toggleChat`/`toggleFullscreen`/
  `clearInitialPrompt`. ⌘K toggles between push and back.
- **`src/components/navbar.tsx`**: dock sparkle is now a `button` that
  toggles `router.push('/chat')` ↔ `router.back()`; tooltip and
  `aria-pressed` reflect the open state. The button overrides
  `buttonVariants`' default `rounded-md` with `rounded-full` so the
  active `bg-muted` highlight is a circle that fits cleanly inside
  the dock's pill-shaped container — at the dock's last slot a
  rounded-square highlight clashed with the dock's curved corner.
- **Deleted `src/components/chat/chat-panel.tsx`** and its export from
  `src/components/chat/index.ts`.

**Files:**

- `src/app/chat/page.tsx`
- `src/app/chat/chat-experience.tsx`
- `src/app/layout.tsx`
- `src/components/chat/chat-overlay.tsx`
- `src/components/chat/chat-context.tsx`
- `src/components/chat/index.ts`
- `src/components/navbar.tsx`
- _Removed_ `src/components/chat/chat-panel.tsx`

---

### Chat Component Fix (December 2025)

Fixed runtime TypeErrors in the chat components related to the `@ai-sdk/react`
v3+ API changes and Ollama provider incompatibility with AI SDK 6.x.

**Issues Fixed:**

1. `useChat` hook API changes - no longer manages input state internally
2. `ollama-ai-provider` v1.2.0 uses v1 spec, but AI SDK 6.x requires v2

**Changes Made:**

- **chat-panel.tsx**:
  - Added local `useState` for input management
  - Changed from `handleSubmit()` to `sendMessage({ role, parts })` API
  - Replaced `append` with `sendMessage` for suggestion clicks
- **chat-input.tsx**:
  - Made `input` prop optional with default value (`input = ""`)
- **api/chat/route.ts**:
  - Replaced `ollama-ai-provider` with direct Ollama API calls
  - Implemented custom stream transformer for AI SDK compatibility
  - More reliable and avoids version spec incompatibilities

**Files:**

- `src/components/chat/chat-input.tsx`
- `src/components/chat/chat-panel.tsx`
- `src/app/api/chat/route.ts`

### Signal Aggregation & Smart Summary View (November 2025)

Completely redesigned the Unusual Options Scanner sidebar to solve the "75 signals problem" by implementing intelligent signal aggregation with a modern, polished UI:

#### The Problem

Previously, when a ticker like AMD had 75 unusual options signals, users had to manually click through each signal one-by-one using arrow navigation. This was tedious and prevented users from quickly understanding the "big picture" of what was happening with the ticker.

#### The Solution: Tabbed Smart Summary Interface

Replaced single-signal navigation with a 5-tab aggregated view:

**1. Overview Tab (Default)**

- **Smart Summary Metrics**: Total premium flow, dominant sentiment (BULLISH/BEARISH/NEUTRAL), call/put split, high conviction count
- **Top Strikes**: 5 most active strike prices by premium flow with grade badges, signal counts, and call/put distribution
- **Top Expiries**: 5 most active expiration dates with days to expiry and premium flow
- **Detection Patterns**: Aggregated counts of volume anomalies, OI spikes, sweeps, and block trades
- **Time Range**: First and latest detection timestamps
- **Clickable Navigation**: Click any strike/expiry to jump to detailed view in corresponding tab

**2. By Strike Tab**

- Groups all signals by strike price
- Shows total premium flow, call/put split, highest grade, and signal count per strike
- Expandable sections showing up to 10 individual signals per strike
- Sorted by total premium flow (highest first)

**3. By Expiry Tab**

- Groups all signals by expiration date
- Shows days to expiry, call/put split, total premium flow per expiry
- Expandable sections with individual signal details
- Sorted by days to expiry (nearest first)

**4. Timeline Tab**

- Groups signals by detection date
- Shows daily signal counts, call/put split, and premium flow
- Helps identify when unusual activity occurred
- Sorted by date (most recent first)

**5. All Signals Tab**

- Shows top 20 signals by premium flow
- Compact card view with key metrics (strike, type, grade, score, volume ratio, detection flags)
- Useful for power users who want to audit individual signals
- Clear messaging when showing subset: "Showing top 20 of 75 signals"

#### Technical Implementation

- **Aggregation Helpers**: Created `createAggregatedSummary()`, `groupSignalsByStrike()`, `groupSignalsByExpiry()`, and `groupSignalsByDate()` helper functions
- **TypeScript Interfaces**: Added `AggregatedSignalSummary`, `SignalsByStrike`, `SignalsByExpiry`, and `SignalsByDate` interfaces
- **State Management**: Uses React state for active tab and expanded sections (strikes/expiries/dates)
- **Wider Sidebar**: Increased sidebar width from 384px to 600px to accommodate richer data visualizations
- **Performance**: Efficient aggregation using Map data structures and single-pass algorithms

#### Modern UI Design

- **Compact Sidebar**: 480px width for focused viewing without overwhelming the screen
- **Refined Spacing**: Compact padding (p-3, p-4) with tight gaps for efficient use of space
- **Sophisticated Shadows**: Subtle shadow-sm with hover:shadow-md transitions for depth
- **Polished Borders**: Semi-transparent borders (border-border/50) for softer visual separation
- **Rounded Corners**: Consistent rounded-lg throughout for modern look
- **Minimalist Tabs**:
  - Clean underline indicator (0.5px primary color line)
  - No button backgrounds or borders
  - Text-only design with color transitions
  - Active state: foreground color, Inactive: muted-foreground
- **Compact Typography**:
  - Small, efficient text sizing (text-[10px] to text-lg)
  - Font-medium for labels with tracking-tight for professional appearance
  - Uppercase labels with tracking-wide for section headers
- **Refined Badges**: Rounded-full pills with proper font-weight
- **Smooth Transitions**: transition-all for buttery hover states
- **Layered Backgrounds**: bg-muted/20, bg-muted/30 with subtle opacity for visual hierarchy
- **Hover States**: Subtle border and shadow changes on interactive elements

#### User Benefits

- **Instant Understanding**: See the complete story in one glance rather than clicking through 75 signals
- **Pattern Recognition**: Easily identify if activity is concentrated in specific strikes, expiries, or dates
- **Flexible Exploration**: Choose the view that matches your analysis needs (overview, strike-focused, time-based, etc.)
- **Better UX**: No more tedious arrow-key navigation through dozens of similar signals
- **Modern Aesthetic**: Clean, professional design matching portfolio standards (480px sidebar, compact text sizing)
- **Keyboard Navigation**:
  - Arrow Up/Down: Navigate between different tickers
  - ESC: Close sidebar
- **Visual Navigation**: Compact up/down arrow buttons in sidebar header for ticker navigation

This represents a fundamental shift from "signal-by-signal navigation" to "aggregated insights with drill-down capability" wrapped in a sleek, modern interface.

### Unusual Options Scanner UX Improvements (November 2025)

Enhanced the Unusual Options Scanner sidebar with critical usability improvements:

- **Fixed Sidebar Scrolling**: Restructured the sidebar as a proper flex container to enable independent scrolling within the sidebar content area, preventing the entire page from scrolling when navigating signal details
- **Robinhood Quick Access**: Added a dedicated Robinhood icon button next to the ticker name in the sidebar header, providing instant access to trade on Robinhood
- **Visual Enhancement**: The Robinhood button uses the official Robinhood logo (robinhood-svgrepo-com.svg) with hover effects, maintaining a clean and professional appearance alongside the existing Yahoo Finance link
- **Premium Flow Formatting**: Enhanced the `formatPremiumFlow()` function to properly handle all number ranges:
  - Billions: $1.00B+ (2 decimal places for precision)
  - Millions: $1.0M+ (1 decimal place)
  - Thousands: $1K+ (no decimals)
  - Sub-thousand: $500 (exact amount)
  - Properly handles negative values with sign prefix

### Content Refinements (October 2025)

Updated the Security Event Gateway article to align with professional standards:

- **Language Refinement**: Replaced "alert fatigue" terminology with more neutral, growth-focused language about "high alert volume challenging efficiency"
- **Metrics Standardization**: Rounded all financial figures and performance metrics to avoid implying precise internal data (e.g., "$1,000" → "~$1,000", "90%" → "~90%")
- **Result Framing**: Added disclaimers framing results as "illustrative" or "based on internal analysis" to clarify the nature of the data
- **Deployment Clarity**: Clarified that the system is a proof-of-concept/prototype rather than production deployment

## Scanner Navigation Structure

The portfolio now features a unified scanner navigation system that provides users with access to multiple trading analysis tools:

### Scanner Hub (`/scanners`)

- **Centralized Access**: Single entry point for all available scanners
- **Minimalistic Design**: Clean, simple list layout with scanner titles and win rates
- **Simple Link Styling**: Traditional underlined links with hover effects for clarity
- **Visual Separation**: Horizontal divider between title and scanner list
- **Performance Indicators**: Win rate statistics displayed where applicable in monospace badges
- **Responsive Layout**: Optimized for all screen sizes with focused content

### Available Scanners

1. **Unusual Options Scanner** (`/unusual-options-scanner`)
   - Status: Active
   - Focus: Insider detection through options flow analysis
   - Features: Real-time data with 0DTE exclusion filters

2. **Penny Stock Scanner** (`/penny-stock-scanner`)
   - Status: Active
   - Focus: Penny stock explosion setups with volume analysis

### Navigation Updates

- **Dock Icon**: Scanner icon points to `/scanners` for unified scanner access
- **Label**: "Scanners" reflects multiple available options
- **User Experience**: Improved discoverability of all available analysis tools

## Public Access Model

All scanners are fully public and accessible to all users without authentication requirements. This change was implemented based on user feedback to remove barriers and encourage more users to utilize the professional trading tools.

## Open Graph Images with WP-Service Backgrounds

### Overview

The portfolio frontend now features enhanced Open Graph (OG) images that utilize beautiful gradient backgrounds inspired by the WP-Service wallpaper generation system. The serene gold gradient provides a professional, glossy aesthetic for social media previews.

### Features

- **Multiple Background Styles**: Support for default, serene-gold, and custom gradient backgrounds
- **Consistent Branding**: Maintains portfolio design language across all preview images
- **Professional Aesthetics**: Glass-like effects with backdrop blur and subtle borders
- **Responsive Design**: Optimized for all social media platforms (1200x630px)
- **Type-Safe Implementation**: Full TypeScript support with proper typing

### Implementation

#### Background Styles

The system supports three background styles:

1. **Default**: Classic dark background (`#0f172a`)
2. **Serene Gold**: Gradient inspired by WP-Service wallpapers
   - Colors: `#fbbf24` → `#f59e0b` → `#d97706` → `#92400e` → `#451a03`
   - Direction: 135-degree diagonal gradient
3. **Gradient**: Purple-blue gradient for variety

#### Usage

```typescript
import { createOGImage } from '@/lib/og-image';

// Use serene gold background
export default async function OGImage() {
  return createOGImage({
    title: 'Page Title',
    subtitle: 'Page description',
    logoText: 'CQ',
    backgroundStyle: 'serene-gold',
  });
}
```

#### Visual Enhancements

- **Glass Morphism**: Semi-transparent elements with backdrop blur
- **Text Shadows**: Improved readability on gradient backgrounds
- **Subtle Borders**: 1px white borders with low opacity
- **Professional Typography**: Sans-serif fonts with proper hierarchy

### File Structure

```
src/lib/
└── og-image.tsx           # Enhanced OG image generation system

src/app/
├── opengraph-image.tsx    # Main site OG image (serene-gold)
├── about/
│   └── opengraph-image.tsx # About page OG image (serene-gold)
└── blog/[slug]/
    └── opengraph-image.tsx # Blog post OG images (default)
```

### Configuration

Background styles are configured in `/src/lib/og-image.tsx`:

```typescript
const backgroundStyles = {
  'serene-gold': {
    background:
      'linear-gradient(135deg, #fbbf24 0%, #f59e0b 25%, #d97706 50%, #92400e 75%, #451a03 100%)',
    textColor: 'white',
    logoBackground: 'rgba(255, 255, 255, 0.2)',
    buttonBackground: 'rgba(255, 255, 255, 0.15)',
  },
  // ... other styles
};
```

### Integration with WP-Service

The serene gold gradient is inspired by the `serene_gold_1.png` wallpaper from the WP-Service, creating visual consistency between:

- Social media previews (Open Graph images)
- Desktop wallpapers (WP-Service output)
- Portfolio branding elements

This creates a cohesive visual identity across all touchpoints while maintaining the glossy, professional aesthetic preferred by the user.

### Next.js Integration

The system leverages Next.js's built-in Open Graph image generation:

- Automatic optimization and caching
- Edge runtime compatibility
- Social media platform optimization
- SEO-friendly metadata generation

### Future Enhancements

- Dynamic background selection based on content type
- Integration with additional WP-Service gradients
- Animated gradient transitions
- Custom logo overlays for different sections
