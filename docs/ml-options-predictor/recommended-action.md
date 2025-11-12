# Recommended Action - ML Model Training

**Date**: November 10, 2025  
**Status**: Cold Start Phase (Week 1 of 7)

---

## Situation

You've clarified two critical facts:
1. **Only running for 7 business days** 
2. **Already capturing 3-165 DTE** (no MAX_DTE limit)

This completely changes the diagnosis!

---

## What's Actually Happening

### The Timing Problem (Not a Config Problem!)

```
Day 1: Service detects signals
  - 3 DTE signal (expires Day 4)
  - 7 DTE signal (expires Day 8)
  - 14 DTE signal (expires Day 15)
  - 30 DTE signal (expires Day 31)

Day 8 (Today): Only 3-4 DTE have expired
  - Can only label expired signals
  - 7+ DTE signals still active
  - Can't train on them yet
```

**Result**: ML training data only has 3-4 DTE because that's all that's expired!

---

## Your Two Options

### Option 1: Wait (RECOMMENDED) ✅

**Pros**:
- No code changes
- System working as designed
- Natural DTE variation over time
- Best long-term solution

**Cons**:
- Takes 30-60 days
- Can't retrain immediately

**Timeline**:
- Week 2: 7 DTE signals start expiring
- Week 3: 14 DTE signals start expiring
- Week 4: 21 DTE signals start expiring
- Month 2: 30-45 DTE signals available → Ready to retrain!

**Action**: Keep using old model (v20251107_211931), be patient

---

### Option 2: Add MAX_DTE Limit (OPTIONAL)

**Recommendation**: Cap at **45 DTE**

**Why?**
- 165 DTE is TOO long for unusual options ML
- Unusual activity signals are short-term plays
- 3-45 DTE is the sweet spot:
  - 3-7 DTE: Day/swing trades (35-40%)
  - 7-14 DTE: Swing trades (25-30%)
  - 14-30 DTE: Medium-term (20-25%)
  - 30-45 DTE: Strategic plays (10-15%)

**Benefits**:
- Faster data maturity (45 days vs 165 days)
- Focus on actionable timeframes
- Reduces noise from very long-dated options
- Better ML training (more relevant patterns)

**Changes Needed**:

```python
# unusual-options-service/src/unusual_options/config.py
"MAX_DTE_ALL_TICKERS": int(os.getenv("MAX_DTE_ALL_TICKERS", "45")),

# unusual-options-service/src/unusual_options/scanner/orchestrator.py
max_dte = self.config.get("MAX_DTE_ALL_TICKERS", 45)
if days_to_expiry > max_dte:
    logger.debug(f"Filtered {ticker}: {days_to_expiry} DTE > {max_dte} maximum")
    return False
```

**Note**: This is optional but recommended for better ML performance.

---

## Recommended Approach

### Best Strategy: **Option 1 + Option 2 Combined**

1. ✅ **Add MAX_DTE = 45** (5 minutes of work)
   - Caps future signals at 45 DTE
   - Won't affect existing data
   - Focuses on actionable timeframes

2. ✅ **Wait 30-60 days** (patience)
   - Let shorter-dated options expire naturally
   - Accumulate 500-1000 labeled signals
   - Get natural DTE variation (3-45 range)

3. ✅ **Keep using old model** (v20251107_211931)
   - Still 92.9% AUC
   - Works well for current signals
   - Don't retrain until data is ready

4. ✅ **Monitor weekly**
   - Check DTE distribution of expired signals
   - Week 2: Should see 7 DTE
   - Week 3: Should see 14 DTE
   - Week 4: Should see 21 DTE

---

## Why Cap at 45 DTE?

### Unusual Options Context

**What Unusual Options Activity Means**:
- Smart money taking positions
- Expected move in days/weeks (not months)
- High conviction, time-sensitive
- Want to see results soon

**DTE Ranges**:
- **3-7 DTE**: High-risk, high-reward, day/swing trades
- **7-14 DTE**: Swing trades, event plays
- **14-30 DTE**: Medium-term directional
- **30-45 DTE**: Strategic positioning
- **45+ DTE**: ❌ TOO LONG (not "unusual" anymore, more like normal investing)

### ML Training Perspective

For a model predicting unusual options:
- ✅ **3-45 DTE**: Relevant patterns, actionable signals
- ⚠️ **45-90 DTE**: Less relevant, different behavior
- ❌ **90-165 DTE**: LEAPS territory, fundamentally different

**Analogy**: 
- Training a day-trading model on year-long positions doesn't make sense
- Training unusual options model on 6-month contracts doesn't make sense

---

## Expected Data Growth (With MAX_DTE = 45)

### Week 1 (Now):
```
Expired signals: 358
DTE range: 3-4 days
Unique DTEs: 2
Status: Too early ⏰
```

### Week 2:
```
Expired signals: ~500
DTE range: 3-7 days
Unique DTEs: 4-5
Status: Getting better
```

### Week 3:
```
Expired signals: ~600
DTE range: 3-14 days
Unique DTEs: 10-12
Status: Improving
```

### Week 4:
```
Expired signals: ~700
DTE range: 3-21 days
Unique DTEs: 15-18
Status: Good variation ✅
```

### Month 2:
```
Expired signals: ~1000+
DTE range: 3-45 days
Unique DTEs: 30-40
Status: READY TO RETRAIN! 🚀
```

---

## Implementation Steps

### Step 1: Add MAX_DTE (Optional but Recommended)

```bash
cd unusual-options-service

# Edit src/unusual_options/config.py
# Add after line 48:
"MAX_DTE_ALL_TICKERS": int(os.getenv("MAX_DTE_ALL_TICKERS", "45")),

# Edit src/unusual_options/scanner/orchestrator.py
# Add after line 281:
max_dte = self.config.get("MAX_DTE_ALL_TICKERS", 45)
if days_to_expiry > max_dte:
    logger.debug(f"Filtered {ticker}: {days_to_expiry} DTE > {max_dte} maximum")
    return False
```

See: `unusual-options-service/PROPOSED_DTE_FIX.md` for exact changes

### Step 2: Monitor Progress

```bash
# Weekly check (Mondays)
cd ml-options-predictor
poetry run python << 'EOF'
import pandas as pd
df = pd.read_parquet('data/labeled/labeled_signals.parquet')
print(f"Total expired: {len(df)}")
print(f"DTE range: {df['days_to_expiry'].min()}-{df['days_to_expiry'].max()}")
print(f"Unique DTEs: {df['days_to_expiry'].nunique()}")
print("\nDistribution:")
print(df['days_to_expiry'].value_counts().sort_index().head(20))
EOF
```

### Step 3: Wait for Data Maturity

**Don't retrain until**:
- ✅ 500+ expired signals
- ✅ DTE range 3-30+ (at least 10 unique values)
- ✅ Win rate 50-60%
- ✅ 30+ days of data collection

**Target**: Month 2 (around December 10-15, 2025)

### Step 4: Retrain with Validation

When data is ready:
```bash
cd ml-options-predictor
poetry run ml-predict train --retrain
poetry run python scripts/validate_model.py

# Check metrics BEFORE deployment:
# - AUC > 85%
# - Accuracy > 80%
# - Train-Val gap < 15%
```

---

## Why This Approach Works

### Short-Term (Now):
- ✅ Old model (v20251107_211931) works fine
- ✅ 92.9% AUC, 87.2% accuracy
- ✅ Validated on similar data
- ✅ Safe for trading

### Medium-Term (Weeks 2-4):
- ✅ Data naturally maturing
- ✅ DTE variation increasing
- ✅ No panic, no rush
- ✅ System working as designed

### Long-Term (Month 2+):
- ✅ 500-1000 labeled signals
- ✅ 3-45 DTE range (excellent variation!)
- ✅ Model can learn time decay patterns
- ✅ Expected AUC: 85-92%
- ✅ Stable, reliable performance

---

## FAQs

### Q: Should I delete existing data and start over?
**A**: NO! Keep it. It's valuable baseline data. Just wait for more to accumulate.

### Q: Should I stop the unusual-options-service?
**A**: NO! Keep it running. You're accumulating signals that will expire and provide training data.

### Q: Can I use active (not expired) signals for training?
**A**: NO! You don't know the outcomes yet. Would introduce massive bias and destroy model accuracy.

### Q: What if I need a better model NOW?
**A**: Use the old model (v20251107_211931). It's 92.9% AUC - that's excellent! Be patient for the new data.

### Q: Should I manually label some historical data?
**A**: Optional, but probably not worth it. Just let time pass naturally.

---

## Summary

**Problem**: Only 7 days of data → only 3-4 DTE expired

**Root Cause**: ⏰ TIME (cold start)

**Solution**: 
1. Add MAX_DTE = 45 (optional but recommended)
2. Wait 30-60 days for data to mature
3. Keep using old model (works great!)
4. Monitor weekly progress
5. Retrain when ready (Month 2)

**Status**: ✅ System healthy, no emergency

**Timeline**: Month 2 for retrain (early December)

**Confidence**: 🟢 HIGH - This is a natural cold-start issue

---

## Action Items

### Today:
- [ ] Review this document
- [ ] Decide: Add MAX_DTE = 45 or not (recommended: yes)
- [ ] If yes: Make 2 small code changes (5 mins)
- [ ] Keep service running

### Weekly:
- [ ] Check DTE distribution (Mondays)
- [ ] Verify data is maturing
- [ ] Monitor for issues

### Month 2 (Dec 10-15):
- [ ] Run data quality checks
- [ ] Retrain if metrics look good
- [ ] Validate before deployment
- [ ] Deploy if passes all checks

---

**You're doing great! This is exactly how new ML systems mature. Patience is your friend.** 🎯⏰

---

**Last Updated**: November 10, 2025  
**Status**: Cold Start - Week 1 of 7  
**Next Action**: Add MAX_DTE = 45 (optional), then wait  
**Expected Resolution**: Early December 2025

