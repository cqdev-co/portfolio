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
├── components/
│   ├── navbar.tsx            # Floating navbar with AI Chat button
│   └── chat/
│       ├── index.ts              # Export barrel
│       ├── chat-panel.tsx        # Main chat panel with useChat hook
│       ├── chat-messages.tsx     # Message list with smart scroll
│       ├── chat-message.tsx      # Individual message bubble + actions
│       ├── chat-input.tsx        # Input with send/stop functionality
│       ├── chat-model-selector.tsx  # Model dropdown selector
│       ├── chat-context.tsx      # Global state + keyboard shortcuts
│       ├── typewriter-text.tsx   # Typewriter effect for messages
│       ├── tool-call-card.tsx    # Animated tool execution cards
│       ├── stream-progress.tsx   # Circular/linear progress indicators
│       ├── ticker-data-card.tsx  # Data card for ticker info
│       └── chat-icons.tsx        # SVG icons (Sparkles, Copy, etc.)
├── hooks/
│   └── use-scroll-to-bottom.ts  # Smart scroll with momentum detection
└── lib/ai/
    └── models.ts             # Model type definitions
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

| Variable                   | Default                  | Description                             |
| -------------------------- | ------------------------ | --------------------------------------- |
| `OLLAMA_API_KEY`           | -                        | **Required.** Your Ollama Cloud API key |
| `OLLAMA_BASE_URL`          | `https://ollama.com/api` | Ollama Cloud API endpoint               |
| `OLLAMA_MODEL`             | `llama3.3:70b-cloud`     | Default model for API route             |
| `NEXT_PUBLIC_OLLAMA_MODEL` | `llama3.3:70b-cloud`     | Default model for frontend              |

### Setup

1. **Create an Ollama account**: https://ollama.com
2. **Generate an API key**: https://ollama.com/settings/keys
3. **Add to `.env.local`**:

```bash
OLLAMA_API_KEY=your_api_key_here
OLLAMA_BASE_URL=https://ollama.com/api
OLLAMA_MODEL=llama3.3:70b-cloud
NEXT_PUBLIC_OLLAMA_MODEL=llama3.3:70b-cloud
```

## UI/UX Features (January 2026)

### Keyboard Shortcuts

| Shortcut        | Action                 |
| --------------- | ---------------------- |
| `⌘K` / `Ctrl+K` | Toggle chat open/close |
| `Escape`        | Close chat panel       |
| `Enter`         | Send message           |
| `Shift+Enter`   | New line in input      |

### Fullscreen Mode

ChatGPT-inspired centered layout for distraction-free conversations:

- **Desktop**: Click the expand icon in header to toggle fullscreen
- **Mobile**: Automatically fullscreen with swipe-to-close gesture
- **Centered Content**: Messages and input centered with `max-w-3xl` container
- **Generous Spacing**: Increased padding (`px-6 py-6 sm:px-8`) for breathing room
- **Polished Header**: Larger icon and typography, gradient avatar background

### Token Counter

Always-visible token counter in the header:

- Shows estimated tokens for current conversation
- Rough estimate: ~4 characters per token
- Helps track usage for rate limit awareness

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

### Stream Progress Visualization

Circular progress indicator in the header during streaming:

- Spinning arc with variable dash offset
- Center dot pulse animation
- Clean, minimal design

### Haptic Feedback

Subtle scale animations on button press:

- Send button: `[1, 0.92, 1.02, 1]` - bounce effect
- Header buttons: `scale: 0.9` - quick tap feedback
- Provides tactile feel without being distracting

### Motion & Animations

All animations use Framer Motion with consistent design language:

1. **Panel Animations**
   - Spring-based open/close (stiffness: 300, damping: 25)
   - Swipe-to-close with drag physics (mobile, from handle only)
   - Opacity/scale transforms during drag

2. **Message Animations**
   - BlurFade entrance (opacity, y, blur)
   - Typewriter text reveal
   - No icon pulsing (cleaner)

3. **Tool Status Animations**
   - Spring spinner for running state
   - Path animation for checkmark on completion
   - Bouncing dots with staggered delays

4. **Tool Data Display**
   - Shows **exact data AI receives** (TOON or text format)
   - TOON badge indicates token-optimized format (~40% fewer tokens)
   - Consistent across all tools (no custom formatters needed)
   - Collapsible cards - click to expand

5. **Scan Results Stagger**
   - Container uses `staggerChildren: 0.04`
   - Items animate with spring physics (stiffness: 300, damping: 24)
   - Grade badges have extra spring bounce (stiffness: 500)

## Components

### ChatPanel

Full chat interface with:

- Header with title, model selector, expand/close buttons
- Token counter (always visible)
- "New Chat" button to clear conversation
- Message history with smart auto-scroll
- Input area with send/stop buttons
- Mobile: Full-screen with drag handle and swipe-to-close
- Desktop: Expandable to fullscreen mode

**Fullscreen Layout (ChatGPT-style)**:

- Messages container: `max-w-3xl mx-auto px-6 py-6 sm:px-8`
- Input container: `max-w-3xl mx-auto` matching messages
- Header: Larger typography and spacing in fullscreen
- Passes `isFullscreen` prop to `ChatMessages` and `ChatInput`

Uses the `useChat` hook from `@ai-sdk/react` (v6.0 stable API):

- `sendMessage({ text: "..." })` for sending messages
- `messages` - array of `UIMessage` objects with `parts` array
- `status` for loading states (`ready`, `submitted`, `streaming`)
- `stop` for aborting streams

### ChatContext

Global state provider with:

```typescript
interface ChatContextValue {
  isOpen: boolean;
  isFullscreen: boolean;
  initialPrompt: string | null;
  openChat: (prompt?: string) => void;
  closeChat: () => void;
  toggleChat: () => void;
  toggleFullscreen: () => void;
  clearInitialPrompt: () => void;
}
```

Includes:

- Keyboard shortcuts (⌘K, Escape)
- Fullscreen toggle state
- Initial prompt for position analysis

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

The AI SDK sends messages in `UIMessage` format with `parts` array:

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

## Tool Calling

The chat supports tool calling via shared handlers from `lib/ai-agent`.

### Available Tools

| Tool                           | Description                                   |
| ------------------------------ | --------------------------------------------- |
| `get_ticker_data`              | Fetches stock data from Yahoo Finance         |
| `web_search`                   | Web search with Brave Search API              |
| `get_financials_deep`          | Income statement, balance sheet, cash flow    |
| `get_institutional_holdings`   | Top institutional holders and % owned         |
| `get_unusual_options_activity` | High-grade unusual options signals            |
| `get_trading_regime`           | Market conditions: GO/CAUTION/NO_TRADE        |
| `get_iv_by_strike`             | IV analysis for specific strike prices        |
| `calculate_spread`             | Calculate spread metrics for given strikes    |
| `scan_opportunities`           | Scan multiple tickers for trade opportunities |

## Mobile Experience

### Full-Screen Mode

On mobile devices (< 640px):

- Panel takes full viewport
- Drag handle at top for swipe gesture
- No rounded corners for edge-to-edge feel

### Swipe to Close

- Drag down from **handle only** to dismiss (threshold: 100px or velocity > 500)
- Opacity fades as dragging down
- Spring physics for natural feel
- Text selection works normally (drag listener disabled except on handle)
- Resets position if not closed

## Customization

### System Prompt (Victor Persona)

**Source of truth**: `lib/ai-agent/prompts/victor.ts`

To update Victor's behavior:

1. Edit `lib/ai-agent/prompts/victor.ts`
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

3. **Dedicated Chat Page**
   - Full-screen chat at `/chat`
   - Chat history persistence
   - Multiple conversations

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

### Swipe-to-close not working

1. Only works on mobile (< 640px viewport)
2. Ensure you're dragging from the main panel
3. Drag threshold is 100px or high velocity
