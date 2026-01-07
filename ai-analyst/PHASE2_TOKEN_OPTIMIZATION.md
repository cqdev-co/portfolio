# Phase 2: Token Optimization Plan

## Current Token Usage Analysis

Based on recent conversations:

- **Input tokens**: 3,500-4,000 per request
- **Output tokens**: 300-500 per response
- **Cost per conversation**: ~$0.05-0.10 (at DeepSeek rates)

### Where Tokens Are Going

| Component             | Est. Tokens | % of Total |
| --------------------- | ----------- | ---------- |
| System Prompt         | ~1,500      | 40%        |
| Ticker Data (Yahoo)   | ~800        | 22%        |
| Trade History Context | ~400        | 11%        |
| Calendar/News Context | ~300        | 8%         |
| User Message          | ~100        | 3%         |
| Conversation History  | ~400+       | 11%+       |

## Optimization Strategies

### 1. TOON (Token Optimized Object Notation)

Convert verbose JSON context into compressed format:

**Before (JSON):**

```json
{
  "ticker": "NVDA",
  "price": 185.55,
  "change_percent": 1.7,
  "rsi": 51.2,
  "ma20": 184.35,
  "ma50": 187.24,
  "ma200": 154.99,
  "above_ma200": true,
  "iv": 40.3,
  "iv_level": "ELEVATED",
  "support": 184.0,
  "resistance": 187.0,
  "spread": {
    "long_strike": 165,
    "short_strike": 170,
    "debit": 4.02,
    "cushion": 8.6
  },
  "grade": "B+",
  "risk_score": 3
}
```

**After (TOON):**

```
NVDA|185.55|+1.7%|RSI51|MA:184/187/155|↑MA200|IV40E|S184R187|165/170@4.02|8.6%|B+|R3
```

**Token savings**: ~150 → ~30 tokens per ticker (80% reduction)

### 2. System Prompt Compression

Current system prompt is ~1,500 tokens. Optimize by:

1. **Remove redundant rules**: Combine similar instructions
2. **Use abbreviations**: "CDS" instead of "Call Debit Spread" in rules
3. **Reference by ID**: "Rule #3" instead of repeating full rules
4. **Conditional loading**: Only load rules relevant to current context

**Target**: Reduce from 1,500 → 800 tokens (47% reduction)

### 3. Smart Context Pruning

Only include data relevant to the question:

| Question Type        | Required Context            |
| -------------------- | --------------------------- |
| "Analyze NVDA"       | Ticker data, spread, grade  |
| "Should I buy?"      | + Calendar, position sizing |
| "Research news"      | + Web search results        |
| "What's fair value?" | + Fundamentals only         |

### 4. Conversation Summarization

Instead of full history, summarize previous turns:

**Before**: Full messages (100+ tokens each)
**After**: `[USER asked about NVDA. VICTOR recommended WAIT due to FOMC.]` (20 tokens)

### 5. Response Token Limits

Add hard limits to prevent verbose responses:

- Quick questions: max_tokens=150
- Trade analysis: max_tokens=300
- Full research: max_tokens=500

## Implementation Phases

### Phase 2.1: TOON Context (Week 1)

- [ ] Create TOON encoder for ticker data
- [ ] Create TOON decoder (for AI to understand)
- [ ] Add TOON format to system prompt
- [ ] Test compression ratio

### Phase 2.2: System Prompt Optimization (Week 1-2)

- [ ] Audit current system prompt for redundancy
- [ ] Create tiered prompt levels (minimal/standard/full)
- [ ] Implement dynamic prompt selection based on question type
- [ ] Benchmark token reduction

### Phase 2.3: Smart Context (Week 2)

- [ ] Classify question types
- [ ] Build context selector based on question type
- [ ] Prune irrelevant data before sending
- [ ] Test response quality

### Phase 2.4: Response Optimization (Week 2-3)

- [ ] Add max_tokens parameter by question type
- [ ] Implement conversation summarization
- [ ] Test cost reduction vs quality tradeoff

## Expected Results

| Metric            | Current | Target | Reduction |
| ----------------- | ------- | ------ | --------- |
| Avg Input Tokens  | 3,800   | 1,500  | 60%       |
| Avg Output Tokens | 400     | 250    | 38%       |
| Cost per Conv     | $0.08   | $0.03  | 62%       |
| Response Quality  | 8/10    | 8/10   | Maintain  |

## TOON Format Specification

### Ticker Data Format

```
TICKER|PRICE|CHANGE|RSI|MA:20/50/200|TREND|IV_PCT+LEVEL|S+R|SPREAD|CUSHION|GRADE|RISK
```

Example:

```
NVDA|185.55|+1.7%|RSI51|MA:184/187/155|↑MA200|IV40E|S184R187|165/170@4.02|8.6%|B+|R3
```

### Calendar Format

```
CAL:EVENT|DATE|DAYS_OUT|RISK_LEVEL
```

Example:

```
CAL:FOMC|Dec10|2d|HIGH
```

### Position Format

```
POS:TICKER|STRIKES|DTE|ENTRY|PNL
```

Example:

```
POS:NVDA|165/170|32d|$4.02|+$15
```

## Notes

- TOON requires training the AI to understand the format
- Include TOON decoder in system prompt (adds ~100 tokens but saves more)
- Test with smaller models first (they may struggle with compression)
- Monitor response quality closely during rollout
