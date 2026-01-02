## Issue Type
- [x] New Feature
- [ ] Bug Fix
- [ ] Enhancement
- [ ] Documentation

## Description
Build a Python tool that scans for **small- to mid-cap stocks** (preferably priced $10–$50/share, market cap $500M–$10B) showing **unusual bullish options activity** (heavy call volume, especially deep ITM or long-dated calls), which could signal strong institutional conviction and make them ideal candidates for **Poor Man's Covered Calls (PMCC)**.

The strategy focuses on identifying stocks where "smart money" is taking bullish positions via options, indicating potential upward momentum or stability—perfect for PMCC setups (buy deep ITM long-dated call as "synthetic stock" + sell shorter OTM calls for premium).

This scanner will help generate a daily/weekly watchlist of high-conviction PMCC opportunities, filtering out mega-caps and focusing on affordable underlyings.

### Key Requirements
- Detect **unusual options activity** focused on **bullish calls** (e.g., calls traded above ask, high volume relative to OI, sweeps/blocks).
- Filter for:
  - Stock price: $10–$50 (to keep LEAPs affordable for smaller accounts).
  - Market cap: $500M–$10B (small/mid-cap, avoid micros/pennies).
  - Bullish sentiment: High call volume/OI ratio, preferably long-dated expirations (for LEAP availability).
  - Liquidity: Sufficient OI in deep ITM calls (delta > 0.7–0.8) for PMCC long leg.
- Additional PMCC suitability checks:
  - Availability of LEAPs (expirations 6–24 months out) with deep ITM strikes.
  - Reasonable bid/ask spreads on options.
  - Positive technicals (e.g., above key moving averages) or high IV rank for premium selling.
- Output: Sorted table/list with:
  - Ticker
  - Company Name
  - Current Price
  - Market Cap
  - Unusual Activity Details (e.g., "Heavy June 2026 $X calls, vol 10x avg")
  - PMCC Potential (e.g., "Deep ITM LEAP delta 0.85, extrinsic low")
  - Brief Note (why bullish/PMCC-friendly)

(*Note: Adjust filters to cap at mid-cap.)

### Data Sources
- Primary: `yfinance` for stock prices, market cap, options chains (free, includes volume/OI).
- Unusual activity detection: Calculate proxies like volume > 5–10x average, or vol/OI > certain threshold; focus on calls traded aggressively.
- Alternatives (if API keys):
  - Polygon.io (has options trades feed; unusual via volume spikes).
  - Intrinio or Barchart APIs for direct unusual activity (paid).
  - Scrape sites like Barchart Unusual Activity (as fallback, but prefer API).
- Start with a predefined watchlist of small/mid-caps or scan major exchanges.

### Technical Details
- Language: Python 3.x
- Libraries: `yfinance`, `pandas`, `requests` (for any API), `tabulate` for pretty tables.
- Run as CLI: `python pmcc_uoa_scanner.py --price_min=10 --price_max=50 --bullish_only`
- Optional: Daily run via scheduler, export to CSV/email, or simple web dashboard (Streamlit).
- Handle data limits gracefully (yfinance rate limits).

### PMCC-Specific Filters
- Check for LEAPs with delta ≥ 0.80 and low extrinsic value (good synthetic stock substitute).
- Estimate potential monthly premium from selling 30–45 DTE OTM calls.

### Acceptance Criteria
- Script runs and outputs 5–15 candidates on a typical day (based on current market).
- Accurately flags bullish unusual call activity.
- Includes basic PMCC viability check (LEAP availability + liquidity).
- Code is modular, commented, with README (setup, usage, limitations).