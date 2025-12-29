# Tool Calling Implementation Plan for Frontend

**Status**: Planned 📋  
**Priority**: High  
**Goal**: Display Victor's tool calls and results in the frontend chat like the CLI

## Problem Statement

The CLI shows rich information when Victor analyzes a ticker:
- Yahoo Finance data card with technicals, earnings, IV, etc.
- Tool call status ("Fetching AMZN data...")
- PFV analysis
- Options spread recommendations

The frontend chat currently only shows Victor's text responses with no 
visibility into tool calls or data fetching.

## Desired User Experience

```
User: Tell me about AMZN

[Status: Fetching AMZN data...]

┌─ Yahoo Finance ──────────────────────────────────────────
│ AMZN $232.52 +0.1% RSI 55 ↑MA200 ↔9
│   MA20 $229 · MA50 $230 · MA200 $216
│   MCap $2.5T · P/E 32.9 · +64% vs sector
│   🎯 Target: $245-$296-$360 (+27%)
│   📊 Perf: 5d: +1.8% · 1m: +1.5% · YTD: +5.6%
│   Grade: B- · Risk: 10/10 · WAIT
│   🧠 PFV: $227.69 (-2.1%) BEARISH · HIGH
└───────────────────────────────────────────────────────────

Victor: Look, let me give you the full picture on AMZN...
```

## Implementation Options

### Option A: Server-Side Tool Execution (Recommended)

Execute tools in the API route, stream status updates to the frontend.

**Pros**:
- API keys stay on server
- Reuse CLI's data fetching logic
- Full control over tool execution

**Cons**:
- More complex streaming protocol
- Need to extract data fetching into shared lib

**Implementation**:

1. **Enhance API Route** (`/api/chat/route.ts`)
   - Detect when Victor wants to call tools
   - Execute tools on server
   - Stream tool status + results + AI response

2. **New Stream Events**
   ```typescript
   type ChatEvent = 
     | { type: 'tool-start', tool: string, args: object }
     | { type: 'tool-result', tool: string, data: object }
     | { type: 'text-start', id: string }
     | { type: 'text-delta', id: string, delta: string }
     | { type: 'text-end', id: string };
   ```

3. **Frontend Chat UI**
   - Handle tool events in useChat hook
   - Display tool status components
   - Render data cards for tool results

### Option B: Client-Side Tool Execution

Have the frontend execute tools directly using Yahoo Finance API.

**Pros**:
- Simpler streaming (just text)
- Frontend controls data display

**Cons**:
- API keys exposed to client
- Duplicate data fetching code
- CORS issues with Yahoo Finance

**Not recommended** due to security and complexity.

### Option C: Hybrid with Tool Results API

Create a separate `/api/tools/ticker-data` endpoint that the AI SDK 
calls automatically.

**Pros**:
- Clean separation
- Works with AI SDK's built-in tool support

**Cons**:
- May require AI SDK tool support for Ollama
- More API routes to maintain

## Recommended Implementation: Option A

### Phase 1: Extract Data Fetching

Move ticker data fetching from CLI to shared lib:

```
lib/ai-agent/
├── data/
│   ├── index.ts
│   ├── yahoo.ts         # Yahoo Finance wrapper
│   ├── technicals.ts    # RSI, MA calculations
│   └── formatters.ts    # Format data for display
```

### Phase 2: Enhance API Route

Update `/api/chat/route.ts` to:

```typescript
import { 
  AGENT_TOOLS, 
  classifyQuestion,
  extractTickers 
} from "@lib/ai-agent";
import { fetchTickerData } from "@lib/ai-agent/data";

// When AI requests get_ticker_data tool:
if (toolCall.name === 'get_ticker_data') {
  // Stream tool status
  writer.write({ type: 'tool-start', tool: 'get_ticker_data', args });
  
  // Execute tool
  const data = await fetchTickerData(args.ticker);
  
  // Stream result
  writer.write({ type: 'tool-result', tool: 'get_ticker_data', data });
  
  // Continue AI generation with tool result
}
```

### Phase 3: Frontend UI Components

Create components to display tool results:

```
frontend/src/components/chat/
├── tool-status.tsx       # "Fetching AMZN data..."
├── ticker-card.tsx       # Yahoo Finance data card
├── pvf-card.tsx          # Psychological Fair Value
└── spread-card.tsx       # Options spread recommendation
```

### Phase 4: Update Chat Messages

Modify `chat-message.tsx` to render tool results:

```tsx
function ChatMessage({ message }) {
  return (
    <div>
      {message.toolResults?.map(result => (
        <ToolResultCard key={result.id} result={result} />
      ))}
      <div className="prose">
        {message.content}
      </div>
    </div>
  );
}
```

## Data Flow

```
User Input
    │
    ▼
┌─────────────────────────────────────────────┐
│  API Route (/api/chat)                      │
│  1. Classify question                       │
│  2. Pre-fetch data for detected tickers     │
│  3. Send to Ollama with tool definitions    │
│  4. If tool call requested:                 │
│     - Stream tool-start event               │
│     - Execute tool                          │
│     - Stream tool-result event              │
│  5. Stream AI response                      │
└─────────────────────────────────────────────┘
    │
    ▼
Frontend Chat Panel
    │
    ├─ tool-start → Show loading indicator
    ├─ tool-result → Render data card
    └─ text-delta → Append to message
```

## Timeline

| Phase | Task | Estimate |
|-------|------|----------|
| 1 | Extract data fetching to lib | 2-3 hours |
| 2 | Enhance API route with tool support | 2-3 hours |
| 3 | Create UI components | 2-3 hours |
| 4 | Integration and testing | 1-2 hours |
| **Total** | | **7-11 hours** |

## Dependencies

- [ ] Yahoo Finance API access in Next.js API routes
- [ ] Technicalindicators library (already in CLI)
- [ ] Shared formatting utilities

## Success Criteria

1. ✅ User can ask "Tell me about AMZN"
2. ✅ Chat shows "Fetching AMZN data..." status
3. ✅ Yahoo Finance data card renders with key metrics
4. ✅ Victor's analysis references the fetched data
5. ✅ No API keys exposed to client
6. ✅ Streaming works smoothly (no blocking)

## Future Enhancements

- Web search integration
- Market scanning results
- Position analysis tool
- Real-time price updates

