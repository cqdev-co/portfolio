# Screen-Ticker Documentation

The `screen-ticker` service is a comprehensive stock opportunity scanner 
that analyzes tickers across technical, fundamental, and analyst dimensions 
to identify high-conviction entry points.

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v2.1.0 | Dec 2024 | Spread Scanner - find tickers with viable deep ITM spreads |
| v1.7.1 | Dec 2024 | Performance & logic fixes (batch scanning, LRU cache, signal caps) |
| v1.7.0 | Dec 2024 | ADX/Bollinger signals, balance sheet health, short interest |
| v2.0.0 | Nov 2024 | AI-first architecture, cloud mode |

## Documentation

| Document | Description |
|----------|-------------|
| [Scan Command Analysis](scan-command-analysis.md) | Deep analysis of the `bun run scan` command - all fixes implemented in v1.7.1 |

## Quick Reference

### Commands

```bash
# Scan S&P 500 stocks (default)
bun run scan

# Scan with custom parameters
bun run scan --list sp500 --min-score 70

# Scan specific tickers
bun run scan --tickers NVDA,AAPL,GOOGL

# Detailed single-stock analysis with AI
bun run analyze NVDA

# Position management mode
bun run analyze NVDA --position "165/170 Call Debit Spread"

# View score trends
bun run trends --days 7

# Two-stage workflow (RECOMMENDED):
# Stage 1: Find technically sound stocks
bun run scan --list sp500

# Stage 2: Find spreads for qualified tickers
bun run scan-spreads --from-scan --relaxed

# Direct spread scanning
bun run scan-spreads --list db
bun run scan-spreads --list mega --relaxed
```

### Spread Scanner (Two-Stage Workflow)

The spread scanner finds tickers with viable deep ITM call spreads.
Best results with the **two-stage workflow**:

1. **`bun run scan`** - identifies technically sound stocks (ENTER decisions)
2. **`bun run scan-spreads --from-scan`** - finds spreads for those tickers

| Criteria | Strict (default) | Relaxed (`--relaxed`) |
|----------|------------------|------------------------|
| Debit | 55-80% of width | 50-85% of width |
| Cushion | ≥5% | ≥3% |
| PoP | ≥70% | ≥60% |
| Return | ≥20% | ≥15% |

Lists available: `mega`, `growth`, `etf`, `value`, `db`, `sp500`

### Scoring System

| Category | Max Points | Weight |
|----------|-----------|--------|
| Technical | 50 | 50% |
| Fundamental | 30 | 30% |
| Analyst | 20 | 20% |
| **Total** | **100** | **100%** |

### Decision Matrix

| Decision | Criteria |
|----------|----------|
| **ENTER** | Score ≥75, Above MA200, RSI OK, ≥4/5 checks |
| **WAIT** | 3-4 checks pass, Below MA200, or minor issues |
| **PASS** | <3 checks pass, multiple issues |

## Related Services

- **[AI Analyst](../ai-analyst/)** - AI-powered analysis with trade journal
- **[Stock Scanner Roadmap](../stock-scanner/roadmap.md)** - Future development plans

---

*Last Updated: December 2024*

