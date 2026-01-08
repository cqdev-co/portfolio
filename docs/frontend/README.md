# Frontend Documentation

## Recent Updates

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
