# AI Chat Feature

## Overview

A trading-focused AI chat assistant powered by **Ollama Cloud**, integrated as
a floating chat panel. Uses the **Victor Chen** persona - a 67-year-old Wall 
Street veteran specializing in Deep ITM Call Debit Spreads.

**Shared Logic**: The chat uses the same Victor persona as the CLI 
(ai-analyst). See [AI Agent Integration](../ai-agent/INTEGRATION_PLAN.md).

## Architecture

```
frontend/src/
├── app/api/chat/
│   ├── route.ts              # Streaming API with tool calling
│   └── models/route.ts       # API to fetch available models
├── components/chat/
│   ├── index.ts              # Export barrel
│   ├── chat-button.tsx       # Floating action button (FAB)
│   ├── chat-panel.tsx        # Main chat panel with useChat hook
│   ├── chat-messages.tsx     # Message list with tool data cards
│   ├── chat-message.tsx      # Individual message bubble
│   ├── chat-input.tsx        # Input with send/stop functionality
│   ├── chat-greeting.tsx     # Empty state with suggestions
│   ├── chat-model-selector.tsx  # Model dropdown selector
│   ├── ticker-data-card.tsx  # Data card for ticker info
│   └── chat-icons.tsx        # SVG icons (SparklesIcon, etc.)
├── hooks/
│   └── use-scroll-to-bottom.ts  # Auto-scroll behavior
└── lib/ai/
    └── models.ts             # Model type definitions
```

## Dependencies

```json
{
  "ai": "^6.0.0",
  "@ai-sdk/react": "^3.0.0",
  "react-markdown": "^10.0.0",
  "remark-gfm": "^4.0.0"
}
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OLLAMA_API_KEY` | - | **Required.** Your Ollama Cloud API key |
| `OLLAMA_BASE_URL` | `https://ollama.com/api` | Ollama Cloud API endpoint |
| `OLLAMA_MODEL` | `gpt-oss:120b` | Default model to use |

### Setup

1. **Create an Ollama account**: https://ollama.com
2. **Generate an API key**: https://ollama.com/settings/keys
3. **Add to `.env.local`**:

```bash
OLLAMA_API_KEY=your_api_key_here
OLLAMA_BASE_URL=https://ollama.com/api
OLLAMA_MODEL=gpt-oss:120b
```

## Available Models

Models are fetched dynamically from the Ollama Cloud API (`/api/tags`).

### Model Selector
The chat panel includes a dropdown to switch models on-the-fly. Models are 
fetched from `/api/chat/models` which proxies the Ollama API.

### Popular Cloud Models

| Model ID | Description |
|----------|-------------|
| `gpt-oss:120b` | Most capable open-source model (default) |
| `gpt-oss:20b` | Faster, smaller GPT-OSS variant |
| `deepseek-v3.2` | DeepSeek's latest model |
| `qwen3-coder:480b` | Qwen3 optimized for code |
| `kimi-k2:1t` | Kimi's 1 trillion parameter model |
| `gemma3:27b` | Google's Gemma 3 |

See all available models: https://ollama.com/search?c=cloud

The model list updates automatically - just open the dropdown to see 
all currently available Ollama Cloud models.

## Components

### ChatButton

Floating action button that triggers the chat panel. Styled to match the 
floating navbar dock with matching shadows and glass morphism effects.

Features:
- Matches navbar dock styling (shadows, borders, glassmorphism)
- Vertically aligned with navbar (`h-full max-h-14` + `items-center`)
- Positioned to the right of the navbar
- Tooltip on hover showing "AI Chat"
- Smooth scale animation on hover
- Uses `SparklesIcon` for AI branding

```tsx
import { ChatButton } from "@/components/chat";

// In your layout or page
<ChatButton />
```

### ChatPanel

Full chat interface with:
- Header with title, model selector, and action buttons
- "New Chat" button to clear conversation and start fresh
- Message history with auto-scroll
- Suggested actions (empty state)
- Input area with send/stop buttons
- Keyboard shortcuts (Enter to send, Shift+Enter for newline)

Uses the `useChat` hook from `@ai-sdk/react` (v6.0 stable API):
- `sendMessage({ text: "..." })` for sending messages
- `messages` - array of `UIMessage` objects with `parts` array
- `status` for loading states (`ready`, `submitted`, `streaming`)
- `stop` for aborting streams
- Local `useState` for input management (SDK doesn't provide input state)

### ChatModelSelector

Dropdown to select from available Ollama Cloud models:
- Fetches models from `/api/chat/models` on mount
- Shows model name and size
- Falls back to defaults if API fails
- Updates chat body to use selected model

### ChatMessage

Renders individual messages matching the Vercel AI Chatbot template:
- **User messages**: Primary color bubble, right-aligned
- **Assistant messages**: No background, left-aligned with sparkles avatar
- Full GitHub Flavored Markdown (GFM) via `react-markdown` + `remark-gfm`
- Extracts text from `UIMessage.parts` array (AI SDK 6.0 format)
- Streaming cursor animation while loading

**Supported markdown elements:**
- Tables (with proper borders, headers, and responsive scrolling)
- Code blocks with syntax highlighting container
- Inline code with background
- Lists (ordered and unordered, nested)
- Blockquotes
- Headings (h1-h4)
- Links, images
- Bold, italic, strikethrough

### ChatGreeting

Empty state component with:
- Welcome message with emoji
- Grid of 4 suggested prompts
- Animated entrance with staggered delays

## UI/UX Features

The chat follows the Vercel AI Chatbot template patterns:

1. **Message Styling**
   - User: Primary color rounded bubble
   - Assistant: Clean typography with sparkles avatar in muted circle

2. **Input**
   - Auto-resizing textarea (44px → 200px max)
   - Submit on Enter, newline on Shift+Enter
   - Stop button during streaming
   - IME composition support for international keyboards
   - Subtle border/background changes on focus

3. **Scroll Behavior**
   - Auto-scroll during streaming
   - Respects user scroll position
   - "Scroll to bottom" button when scrolled up
   - Smooth scroll animations

4. **Animations**
   - Framer Motion for panel open/close
   - Fade-in for messages
   - Staggered suggestions animation
   - "Thinking" indicator with bouncing dots

5. **Panel Design**
   - Subtle dark backdrop (20% opacity, no blur)
   - Click backdrop to close
   - Rounded 2xl corners with shadow
   - Responsive width (100vw - 2rem on mobile, 420px on desktop)

## API Route

`POST /api/chat`

### Request Body

The AI SDK sends messages in `UIMessage` format with `parts` array:

```typescript
{
  messages: Array<{
    id: string;
    role: "user" | "assistant";
    parts: Array<{
      type: "text";
      text: string;
    }>;
  }>;
}
```

The API route extracts content from parts or falls back to direct content.

### Response

The API uses AI SDK 6.0's `createUIMessageStream` and `createUIMessageStreamResponse` 
for proper streaming. The stream format uses `UIMessageChunk` types:

- `text-start` - Begins a new text part
- `text-delta` - Streams text content incrementally
- `text-end` - Ends the text part

### Error Handling

Returns JSON error response with details:
```json
{
  "error": "Failed to process chat request",
  "details": "Error message here"
}
```

## Customization

### System Prompt (Victor Persona)

The chat uses the Victor Chen persona from the shared AI agent library.
Direct imports work via dual Turbopack/Webpack configuration.

**Source of truth**: `lib/ai-agent/prompts/victor.ts`

To update Victor's behavior:
1. Edit `lib/ai-agent/prompts/victor.ts`
2. Test with CLI: `cd ai-analyst && bun run chat`
3. Changes automatically available in frontend! (direct import)

```typescript
// src/app/api/chat/route.ts
import { buildVictorLitePrompt } from "@lib/ai-agent";

const systemPrompt = buildVictorLitePrompt({ accountSize: 1750 });
```

### Default Model

Change `OLLAMA_MODEL` environment variable or update the fallback:

```typescript
const selectedModel = process.env.OLLAMA_MODEL || "llama3.3:70b-cloud";
```

### Suggested Actions

Edit in `src/components/chat/chat-greeting.tsx`:

```typescript
const suggestedActions: SuggestedAction[] = [
  { label: "Your prompt label", prompt: "The actual prompt" },
  // ...
];
```

### Styling

All components use Tailwind CSS and respect the app's theme variables:
- `primary` / `primary-foreground` for user messages
- `muted` / `muted-foreground` for accents
- `background` / `foreground` for base colors

## Tool Calling

The chat supports tool calling via shared handlers from `lib/ai-agent`:

### Available Tools

| Tool | Description |
|------|-------------|
| `get_ticker_data` | Fetches stock data from Yahoo Finance |
| `web_search` | Web search (requires search function injection) |
| `analyze_position` | Analyzes existing spread positions |

### Data Cards

When Victor uses the `get_ticker_data` tool, a data card is displayed showing:
- Price, change, RSI, ADX
- Moving averages (MA20, MA50, MA200)
- Market cap, P/E ratio, sector comparison
- Target prices and analyst ratings
- Earnings date and warnings
- IV/HV data
- Short interest
- Support/Resistance levels
- Spread recommendations (if available)
- Trade grade

### Tool Event Streaming

The API streams data events for tool calls:

```typescript
// Tool start event
{ type: "tool-start", tool: "get_ticker_data", args: { ticker: "NVDA" } }

// Tool result event
{ type: "tool-result", tool: "get_ticker_data", success: true, data: {...} }
```

The frontend parses these events and renders:
- `ToolStatusIndicator` during tool execution
- `TickerDataCard` when data is received

## Future Enhancements

1. **Enhanced Data Parity**
   - Spread recommendations with full calculations
   - Psychological Fair Value (PFV) analysis
   - Options flow data

2. **Dedicated Chat Page** (Option B)
   - Full-screen chat at `/chat`
   - Chat history persistence
   - Multiple conversations

3. **Chat Persistence**
   - Save conversations to Supabase
   - Resume previous chats

4. **File Attachments**
   - Upload images/documents for analysis
   - Code file parsing

## Troubleshooting

### "Authorization required" error

1. Check `OLLAMA_API_KEY` is set correctly in `.env.local`
2. Verify the API key at https://ollama.com/settings/keys
3. Ensure the key has not expired

### Model not found

1. Verify model ID at https://ollama.com/search?c=cloud
2. Some models require cloud access (ending in `-cloud`)
3. Check for typos in model name

### Slow responses

1. Cloud models may have cold start latency
2. Try a smaller model like `llama3.3:70b-cloud`
3. Check your network connection

### Messages not showing

1. Check browser console for API errors
2. Verify the API route is working: `curl -X POST /api/chat`
3. Ensure `messages` array format is correct (`{ role, content }`)

### CORS errors

1. Ensure API calls go through your Next.js API route
2. Don't call Ollama Cloud directly from the browser
