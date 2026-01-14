# Shared Services Architecture

This document describes the shared services in `@lib/ai-agent` that are used by
both the CLI (ai-analyst) and Frontend (portfolio).

## Overview

The shared library (`lib/ai-agent/`) provides canonical implementations of
common services to ensure consistency between CLI and Frontend:

```
┌─────────────────────────────────────────────────────────────────┐
│                         lib/ai-agent/                           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │ calendar │ │ scanner  │ │  market  │ │   pfv    │           │
│  │ context  │ │ & grade  │ │  regime  │ │   data   │           │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘           │
│       │            │            │            │                  │
│  ┌────┴────────────┴────────────┴────────────┴────┐            │
│  │                    index.ts                     │            │
│  │              (central exports)                  │            │
│  └─────────────────────────────────────────────────┘            │
└─────────────────────────────────────────────────────────────────┘
          ▲                                    ▲
          │                                    │
    ┌─────┴─────┐                        ┌─────┴─────┐
    │    CLI    │                        │  Frontend │
    │(ai-analyst)                        │(portfolio)│
    └───────────┘                        └───────────┘
```

## Shared Services

### 1. Calendar Service (`calendar/`)

Economic calendar with major market events:

- **FOMC meetings** - Fed rate decisions
- **CPI reports** - Inflation data
- **Jobs Report (NFP)** - Employment data
- **GDP releases** - Growth data
- **Market holidays** - Market closures
- **Quad witching** - Options expiration days

```typescript
import {
  getCalendarContext,
  formatCalendarForAI,
  encodeCalendarToTOON,
} from '@lib/ai-agent';

// Get full context
const ctx = getCalendarContext();
console.log(ctx.marketStatus); // 'OPEN', 'PRE-MARKET', etc.
console.log(ctx.warnings); // Event warnings

// Format for AI prompt
const prompt = formatCalendarForAI();

// Token-efficient TOON format
const toon = encodeCalendarToTOON();
```

### 2. Scanner Service (`scanner/`)

Trade opportunity scanner with grading system:

- **Scan lists** - Predefined ticker groups (tech, semis, mega-cap, etc.)
- **Trade grading** - A+ to F grading based on multiple criteria
- **Risk scoring** - 1-10 risk assessment
- **Cushion analysis** - Buffer from breakeven

```typescript
import {
  quickScan,
  fullScan,
  SCAN_LISTS,
  gradeTradeOpportunity,
  formatScanResultsForAI,
} from '@lib/ai-agent';

// Quick scan of tech stocks
const results = await quickScan(SCAN_LISTS.TECH, {
  minGrade: 'B',
  maxRisk: 6,
  onProgress: (ticker, current, total) => {
    console.log(`Scanning ${ticker} (${current}/${total})`);
  },
});

// Format for AI
const formatted = formatScanResultsForAI(results);
```

### 3. Market Regime (`market/`)

Market condition analysis:

- **Regime detection** - BULL, BEAR, NEUTRAL, HIGH_VOL
- **Trading regime** - GO, CAUTION, NO_TRADE signals
- **VIX analysis** - Volatility levels
- **SPY trend** - Market direction

```typescript
import { getMarketRegime, analyzeTradingRegime } from '@lib/ai-agent';

const regime = await getMarketRegime();
console.log(regime.type); // 'BULL', 'BEAR', etc.

const tradingRegime = await analyzeTradingRegime();
console.log(tradingRegime.regime); // 'GO', 'CAUTION', 'NO_TRADE'
```

### 4. Psychological Fair Value (`pfv/`)

Options-based fair value analysis:

- **Put/Call wall detection** - Major options levels
- **Fair value calculation** - Based on options positioning
- **Magnetic levels** - Key price points

```typescript
import { getPsychologicalFairValue } from '@lib/ai-agent';

const pfv = await getPsychologicalFairValue('AAPL');
console.log(pfv.fairValue); // Calculated fair value
console.log(pfv.majorPutWall); // Key support level
```

## CLI Extensions

The CLI (`ai-analyst/`) extends shared services with additional features:

### Trade Analyzer (`engine/trade-analyzer.ts`)

CLI-specific extensions:

- **Scenario analysis** - Price movement simulations
- **Full analysis** - Combined grade + risk + scenarios
- **Position sizing** - Account-based calculations

```typescript
import {
  performFullAnalysis,
  analyzeScenarios,
} from '../engine/trade-analyzer';

const analysis = performFullAnalysis({
  ticker: 'NVDA',
  price: 135,
  rsi: 45,
  aboveMA200: true,
  longStrike: 125,
  shortStrike: 130,
  debit: 3.8,
  dte: 30,
  accountSize: 5000,
});
```

### Scanner Service (`services/scanner.ts`)

CLI-specific scanner features:

- **Yahoo Finance integration** - Direct API calls
- **Additional scan lists** - High beta, ETFs
- **CLI-optimized progress** - Terminal-friendly callbacks

## Frontend Integration

The Frontend uses the shared library for consistent data:

```typescript
// frontend/src/app/api/chat/route.ts
import {
  getCalendarContext,
  getMarketRegime,
  AGENT_TOOLS,
  toOllamaTools,
} from '@lib/ai-agent';

// Get market context for system prompt
const calendar = getCalendarContext();
const regime = await getMarketRegime();

// Use full tool set
const tools = toOllamaTools(AGENT_TOOLS);
```

## Adding New Shared Services

When adding new shared functionality:

1. **Create in lib/ai-agent/** - Canonical implementation
2. **Export from index.ts** - Central exports
3. **Create CLI wrapper** (optional) - For CLI-specific extensions
4. **Update this doc** - Document the new service

Example structure:

```
lib/ai-agent/
├── new-service/
│   └── index.ts      # Implementation
├── index.ts          # Add exports
└── ...

ai-analyst/src/services/
└── new-service.ts    # Optional CLI wrapper
```

## AgentSession - Unified API (January 2026)

The `AgentSession` class provides a unified API for both CLI and Frontend
to interact with the AI trading assistant.

### Features

- **Context building** - Calendar, market regime, ticker data
- **Conversation management** - History tracking with auto-summarization
- **Tool execution** - Unified interface for all 9 tools
- **TOON encoding** - Token-efficient context formatting

### Usage

```typescript
import { AgentSession } from '@lib/ai-agent';

// Initialize session
const session = new AgentSession({
  accountSize: 1750,
  useTOON: true,
  onStatus: (msg) => console.log(msg),
});

await session.initialize();

// Prepare context for user message
const { systemPrompt, messages, classification, tickers } =
  await session.prepareContext('How does NVDA look?');

// Execute tools
if (classification.needsTools) {
  for (const toolCall of pendingToolCalls) {
    const result = await session.executeTool(toolCall);
  }
}

// Add assistant response to history
session.addAssistantMessage(response.content, toolCalls, toolResults);

// Get market context directly
const marketContext = await session.getMarketContext();
console.log(marketContext.warnings);

// Get ticker data
const nvdaData = await session.getTickerData('NVDA');
```

### Components

| Class                 | Purpose                                    |
| --------------------- | ------------------------------------------ |
| `AgentSession`        | Main class for AI agent interactions       |
| `ContextBuilder`      | Builds context from calendar, regime, data |
| `ConversationManager` | Manages history with auto-summarization    |

### Configuration

```typescript
interface SessionConfig {
  accountSize?: number; // Trading account size ($)
  liteMode?: boolean; // Use lite prompt for speed
  maxHistoryLength?: number; // Messages before summarization
  useTOON?: boolean; // Token-efficient encoding
  tools?: AgentTool[]; // Custom tool set
  ollamaApiKey?: string; // For web search
  supabaseUrl?: string; // For unusual options
  supabaseKey?: string;
  onStatus?: (msg: string) => void;
  onToolResult?: (tool: string, result: ToolResult) => void;
}
```

## Migration Notes

### Calendar (Migrated 2026-01)

- **Before**: `ai-analyst/src/services/calendar.ts` (local)
- **After**: `lib/ai-agent/calendar/index.ts` (shared)
- **CLI**: Re-exports from shared library
- **Added**: 2026 dates, TOON encoding

### Scanner (Migrated 2026-01)

- **Before**: `ai-analyst/src/services/scanner.ts` (local only)
- **After**: `lib/ai-agent/scanner/index.ts` (shared core)
- **CLI**: Keeps local scanner for CLI-specific features
- **Shared**: Core grading, risk scoring, scan lists

### AgentSession (Added 2026-01)

- **Location**: `lib/ai-agent/session/index.ts`
- **Purpose**: Unified API for CLI and Frontend
- **Includes**: ContextBuilder, ConversationManager
- **Benefits**: Consistent context, history, tool execution
