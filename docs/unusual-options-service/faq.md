# Unusual Options Service - FAQ

Common questions about the unusual options activity scanner.

---

## Signal Lifecycle

### What does it mean when a signal goes inactive?

**A signal becomes inactive when the option contract expires.** This is the ONLY condition that marks a signal as inactive.

When an option contract reaches its expiration date, it can no longer be traded, so the signal is automatically marked as `is_active = FALSE`. This prevents expired contracts from cluttering the active signals feed shown to users.

**Key Points:**
- ✅ Signals remain active until their option contract expiration date
- ✅ Not detecting a signal for hours or days does NOT make it inactive
- ✅ Only active signals (non-expired) are shown on the frontend
- ✅ Inactive signals remain in the database for historical analysis and backtesting

**Example Timeline:**
```
AAPL 185C expiring 2025-01-17

Jan 10: Signal first detected → is_active = TRUE
Jan 11: Signal re-detected → still active
Jan 12: Signal re-detected → still active
Jan 15: Signal NOT detected → still active (important!)
Jan 16: Signal NOT detected → still active
Jan 17: Option expires → is_active = FALSE (marked inactive)
```

**Important:** The signal stays active on January 15-16 even though it wasn't detected in those scans. The signal only becomes inactive when the option contract actually expires.

---

### What is the difference between NEW and CONTINUING signals?

**NEW Signal:**
- First time the system has detected unusual activity on this specific option contract
- Badge: `🆕 NEW`
- `is_new_signal = TRUE`
- `detection_count = 1`

**CONTINUING Signal:**
- The same option contract was detected in a previous scan (within 24 hours)
- Badge: `🔄 CONTINUING`
- `is_new_signal = FALSE`
- `detection_count` increments with each re-detection
- Shows the unusual activity is persistent, not just a one-time spike

**Why This Matters:**
- **NEW signals** → Fresh opportunity, act quickly
- **CONTINUING signals** → Sustained interest, may indicate stronger conviction
- Both can be valuable, but for different reasons

---

### How does deduplication work?

The system automatically prevents duplicate signals using these criteria:

```python
# Two signals are considered the SAME if ALL match:
- ticker (e.g., "AAPL")
- option_symbol (e.g., "AAPL250117C00185000")
- strike (e.g., 185.0)
- expiry (e.g., 2025-01-17)
- option_type ("call" or "put")
```

When a duplicate is detected:
1. The existing signal is **updated** with new data (volume, price, score)
2. `last_detected_at` timestamp is updated
3. `detection_count` is incremented
4. NO new database row is created

This prevents:
- Multiple alerts for the same signal
- Database bloat from redundant entries
- Confusion from duplicate signals in the UI

---

### Why do I see fewer signals in the frontend than in the database?

The frontend **only shows active signals** (non-expired contracts). 

If you're querying the database directly, you'll see both:
- **Active signals**: `WHERE is_active = TRUE`
- **Inactive signals**: `WHERE is_active = FALSE` (expired contracts)

**To see active signals only:**
```sql
SELECT * FROM unusual_options_signals
WHERE is_active = TRUE
ORDER BY last_detected_at DESC;
```

**To see all signals (including expired):**
```sql
SELECT * FROM unusual_options_signals
ORDER BY last_detected_at DESC;
```

---

## Historical Context

### Was there a bug with signal inactivity?

**Yes.** Prior to November 2025, there was a bug where signals were incorrectly marked inactive if they weren't detected within a 3-hour window. This was wrong because:

- A signal represents an **option contract** that stays valid until expiration
- Not detecting it in a scan doesn't mean the contract expired
- Many valid signals were being incorrectly marked inactive

**The Fix:**
- Signals now ONLY go inactive when `expiry < CURRENT_DATE`
- The 3-hour detection window is no longer used
- Signals stay active until the actual option expiration date

**If you have old data:**
Run the reactivation script to fix signals that were incorrectly marked inactive:

```bash
cd unusual-options-service
python scripts/reactivate_valid_signals.py
```

This will find signals that are:
- Currently marked `is_active = FALSE`
- Have `expiry >= today` (contract not expired)
- Were detected recently

---

## Scanning & Detection

### How often should I scan?

**Recommended Frequencies:**

**Intraday Trading (Hourly):**
```bash
# Every hour during market hours (9:30 AM - 4:00 PM ET)
30 9-16 * * 1-5 unusual-options scan-all --min-grade B
```

**Swing Trading (Daily):**
```bash
# Once per day after market close
30 16 * * 1-5 unusual-options scan-all --min-grade B
```

**Position Trading (Weekly):**
```bash
# Monday mornings
0 9 * * 1 unusual-options scan-all --min-grade A
```

---

### Why are some detected signals not stored?

Signals are filtered out if they fail quality checks:

**Pre-Storage Filters:**
- Grade D or F (too low quality)
- Overall score < 0.40
- High risk + low score (risk_level = HIGH and score < 0.60)
- Too many risk factors (>= 4)
- Very small premium flow (< $100k)
- Days to expiry < minimum threshold (3-5 days depending on ticker)

**Design Philosophy:**
Better to show fewer high-quality signals than flood users with noise.

---

### What happens when the scanner runs?

**Complete Workflow:**

1. **Fetch Data**: Get options chain from provider (Polygon/Tradier)
2. **Detect Anomalies**: Check volume, OI, premium flow
3. **Score Signal**: Calculate multi-factor score (0.0 - 1.0)
4. **Assign Grade**: Convert score to letter grade (S/A/B/C/D/F)
5. **Assess Risk**: Identify risk factors
6. **Check Filters**: Apply minimum grade, score, risk thresholds
7. **Deduplication Check**: Is this signal already in DB?
   - **If YES**: Update existing signal (volume, price, detection_count)
   - **If NO**: Store as new signal
8. **Mark Expired**: Mark any expired contracts as inactive
9. **Send Alerts**: Notify channels if grade meets threshold
10. **Output Results**: Display to user/logs

---

## Database & Storage

### Can I manually mark a signal as inactive?

**Not recommended.** The system automatically manages signal lifecycle based on option expiration dates.

If you really need to:
```sql
UPDATE unusual_options_signals
SET is_active = FALSE, updated_at = NOW()
WHERE signal_id = 'your-signal-id';
```

But this will be overridden if the signal is detected again before expiration.

---

### How do I query signals by status?

**Active signals:**
```sql
SELECT * FROM unusual_options_signals
WHERE is_active = TRUE
ORDER BY overall_score DESC;
```

**Inactive signals (for backtesting):**
```sql
SELECT * FROM unusual_options_signals
WHERE is_active = FALSE
ORDER BY expiry DESC;
```

**Signals expiring soon:**
```sql
SELECT * FROM unusual_options_signals
WHERE is_active = TRUE
  AND expiry <= CURRENT_DATE + INTERVAL '7 days'
ORDER BY expiry ASC;
```

**Continuing signals (detected multiple times):**
```sql
SELECT * FROM unusual_options_signals
WHERE is_active = TRUE
  AND detection_count > 1
ORDER BY detection_count DESC;
```

---

## Troubleshooting

### All my signals show as inactive!

This likely means the `mark_stale_signals_inactive()` function is incorrectly marking signals.

**Diagnosis:**
```sql
-- Check for incorrectly inactive signals
SELECT COUNT(*) as incorrectly_inactive
FROM unusual_options_signals
WHERE is_active = FALSE
  AND expiry >= CURRENT_DATE;
```

If this count > 0, you have signals that should be active.

**Fix:**
```bash
cd unusual-options-service
python scripts/reactivate_valid_signals.py
```

Or manually:
```sql
UPDATE unusual_options_signals
SET is_active = TRUE, updated_at = NOW()
WHERE is_active = FALSE
  AND expiry >= CURRENT_DATE;
```

---

### I'm not seeing any signals in my scans

**Possible Causes:**

1. **No unusual activity detected** (most common)
   - The market may be quiet
   - Your tickers may not have unusual activity today
   - Try scanning more tickers or lowering `--min-grade`

2. **All signals filtered out**
   - Check your filter settings: `--min-grade`, `--min-score`
   - Lower thresholds temporarily to see what's being detected

3. **API/Data Provider Issues**
   - Check your API keys are valid
   - Verify rate limits aren't being hit
   - Check provider status page

4. **Time of Day**
   - Best results during market hours (9:30 AM - 4:00 PM ET)
   - After hours will have minimal activity

**Debug Mode:**
```bash
# See exactly what's happening
unusual-options scan AAPL --debug

# Lower quality threshold to see more
unusual-options scan AAPL --min-grade D
```

---

### How do I see signal history?

**Via CLI:**
```bash
unusual-options history AAPL --days 30
```

**Via Database:**
```sql
-- Signal timeline
SELECT 
    ticker,
    option_symbol,
    detection_count,
    first_detected_at,
    last_detected_at,
    is_active,
    grade,
    overall_score
FROM unusual_options_signals
WHERE ticker = 'AAPL'
ORDER BY last_detected_at DESC;

-- Continuity records
SELECT * FROM unusual_options_signal_continuity
WHERE signal_id = 'your-signal-id'
ORDER BY detected_at DESC;
```

---

## Performance & Optimization

### How many signals should I expect?

**Typical Results (per scan):**

**Scanning S&P 100 (~100 tickers):**
- Total detections: 50-200
- After filtering: 5-30 high-quality signals
- Grade A or higher: 1-5 signals
- Grade S: 0-2 signals (rare)

**Single Ticker Scan:**
- If unusual activity present: 1-10 signals
- Most days: 0-2 signals
- Some days: no signals (normal!)

**Remember:** More signals ≠ better. Quality over quantity.

---

### How long does a full scan take?

**Performance Metrics:**

**Single Ticker:**
- With cache: 2-5 seconds
- Without cache: 10-30 seconds

**Batch (100 tickers):**
- Concurrent requests: 5-15 minutes
- Sequential: 30-60 minutes (not recommended)

**Factors:**
- Data provider speed
- Network latency
- Rate limits
- Cache hit rate

---

## Further Reading

- [System Overview](system-overview.md) - Architecture and design
- [Technical Implementation](technical-implementation.md) - Code details
- [User Guide](user-guide.md) - How to use the scanner
- [Trading Strategy Framework](trading-strategy-framework.md) - How to trade signals
- [Understanding Unusual Activity](understanding-unusual-activity.md) - What to look for

---

**Still have questions?** Check the main [README](../../unusual-options-service/README.md) or review the code comments.

