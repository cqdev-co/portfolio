# ML Options Predictor - Testing Guide

## Overview

This guide provides comprehensive testing procedures for the ML Options Predictor service to ensure it's working correctly before production deployment.

## Prerequisites

- ML service running on `localhost:8001`
- Model trained and loaded
- `curl` and `jq` installed for API testing

## Quick Verification

Run the automated test suite:

```bash
cd /Users/conorquinlan/Desktop/GitHub/portfolio/ml-options-predictor
./scripts/test_service.sh
```

**Expected Output**: All tests pass with ✅ indicators

## Manual Testing Procedures

### 1. Service Health Check

**Purpose**: Verify the service is running and model is loaded.

```bash
curl -s http://localhost:8001/health | jq .
```

**Expected Response**:
```json
{
  "status": "ok",
  "model_loaded": true,
  "model_version": "v20251107_170218"
}
```

**Validation**:
- ✅ `status` is "ok"
- ✅ `model_loaded` is `true`
- ✅ `model_version` is present

---

### 2. Model Information

**Purpose**: Check model performance metrics and features.

```bash
curl -s http://localhost:8001/model/info | jq .
```

**Expected Response**:
```json
{
  "version": "v20251107_170218",
  "classification_auc": 0.9555555555555556,
  "regression_r2": 0.4569339694918291,
  "training_samples": null,
  "features": [
    "grade_numeric",
    "overall_score",
    ...
  ]
}
```

**Validation**:
- ✅ `classification_auc` > 0.90 (excellent)
- ✅ `features` contains 31 items
- ✅ `version` matches loaded model

---

### 3. Single Prediction Test

**Purpose**: Test prediction with realistic signal data.

**Create Test Payload**:
```bash
cat > /tmp/test_signal.json << 'EOF'
{
  "ticker": "AAPL",
  "option_type": "call",
  "strike": 180.0,
  "expiry": "2024-12-20",
  "days_to_expiry": 43,
  "grade": "A",
  "overall_score": 0.85,
  "confidence": 0.92,
  "premium_flow": 500000,
  "underlying_price": 175.00,
  "implied_volatility": 0.35,
  "iv_rank": 45.0,
  "delta": 0.65,
  "gamma": 0.05,
  "theta": -0.15,
  "vega": 0.25
}
EOF
```

**Make Prediction**:
```bash
curl -s -X POST http://localhost:8001/predict \
  -H "Content-Type: application/json" \
  -d @/tmp/test_signal.json | jq .
```

**Expected Response**:
```json
{
  "signal_id": null,
  "ticker": "AAPL",
  "predictions": {
    "win_probability": 0.652,
    "expected_return_pct": 15.3,
    "expected_value": 9.98,
    "confidence": "high"
  },
  "recommendation": "TRADE",
  "model_version": "v20251107_170218",
  "reasoning": [
    "Strong win probability (65.2%)",
    "High-quality signal (Grade A)",
    "Strong premium flow ($500,000)",
    "Favorable IV rank (45)"
  ]
}
```

**Validation**:
- ✅ `win_probability` between 0 and 1
- ✅ `expected_return_pct` is numeric
- ✅ `recommendation` is "TRADE" or "SKIP"
- ✅ `reasoning` provides explanations
- ✅ Response time < 100ms

---

### 4. Grade Comparison Test

**Purpose**: Verify model distinguishes between high and low quality signals.

**Test Grade A**:
```bash
curl -s -X POST http://localhost:8001/predict \
  -H "Content-Type: application/json" \
  -d '{
    "ticker": "TSLA",
    "option_type": "call",
    "strike": 250.0,
    "expiry": "2024-12-15",
    "days_to_expiry": 35,
    "grade": "A",
    "overall_score": 0.90,
    "confidence": 0.95,
    "premium_flow": 750000,
    "underlying_price": 240.00
  }' | jq '.predictions.win_probability, .recommendation'
```

**Test Grade C**:
```bash
curl -s -X POST http://localhost:8001/predict \
  -H "Content-Type: application/json" \
  -d '{
    "ticker": "TSLA",
    "option_type": "call",
    "strike": 250.0,
    "expiry": "2024-12-15",
    "days_to_expiry": 35,
    "grade": "C",
    "overall_score": 0.50,
    "confidence": 0.60,
    "premium_flow": 100000,
    "underlying_price": 240.00
  }' | jq '.predictions.win_probability, .recommendation'
```

**Expected Behavior**:
- Grade A signal should have higher win probability than Grade C
- Grade A more likely to get "TRADE" recommendation
- Both should return valid predictions

---

### 5. Batch Prediction Test

**Purpose**: Test batch processing capability.

```bash
curl -s -X POST http://localhost:8001/predict_batch \
  -H "Content-Type: application/json" \
  -d '{
    "signals": [
      {
        "ticker": "AAPL",
        "option_type": "call",
        "strike": 180.0,
        "expiry": "2024-12-20",
        "days_to_expiry": 43,
        "grade": "A",
        "overall_score": 0.85,
        "confidence": 0.92,
        "premium_flow": 500000,
        "underlying_price": 175.00
      },
      {
        "ticker": "MSFT",
        "option_type": "put",
        "strike": 350.0,
        "expiry": "2024-12-15",
        "days_to_expiry": 35,
        "grade": "B",
        "overall_score": 0.75,
        "confidence": 0.85,
        "premium_flow": 300000,
        "underlying_price": 360.00
      }
    ]
  }' | jq .
```

**Expected Response**:
```json
{
  "predictions": [
    {
      "ticker": "AAPL",
      "predictions": {...},
      "recommendation": "TRADE",
      ...
    },
    {
      "ticker": "MSFT",
      "predictions": {...},
      "recommendation": "SKIP",
      ...
    }
  ],
  "total_signals": 2,
  "trade_signals": 1,
  "skip_signals": 1
}
```

**Validation**:
- ✅ Returns predictions for all signals
- ✅ Summary counts are correct
- ✅ Response time reasonable for batch size

---

### 6. Error Handling Tests

**Purpose**: Verify graceful error handling.

**Test 1: Missing Required Field**
```bash
curl -s -X POST http://localhost:8001/predict \
  -H "Content-Type: application/json" \
  -d '{"ticker": "AAPL"}' | jq .
```

**Expected**: 422 Validation Error with field details

**Test 2: Invalid Data Type**
```bash
curl -s -X POST http://localhost:8001/predict \
  -H "Content-Type: application/json" \
  -d '{
    "ticker": "AAPL",
    "strike": "not_a_number",
    "expiry": "2024-12-20"
  }' | jq .
```

**Expected**: 422 Validation Error

**Test 3: Invalid Option Type**
```bash
curl -s -X POST http://localhost:8001/predict \
  -H "Content-Type: application/json" \
  -d '{
    "ticker": "AAPL",
    "option_type": "invalid",
    "strike": 180.0,
    "expiry": "2024-12-20"
  }' | jq .
```

**Expected**: 422 Validation Error

**Validation**:
- ✅ All errors return proper HTTP status codes
- ✅ Error messages are helpful
- ✅ Service doesn't crash

---

### 7. Edge Cases

**Test Extreme Values**:

```bash
# Very high premium flow
curl -s -X POST http://localhost:8001/predict \
  -H "Content-Type: application/json" \
  -d '{
    "ticker": "AAPL",
    "option_type": "call",
    "strike": 180.0,
    "expiry": "2024-12-20",
    "days_to_expiry": 43,
    "grade": "A",
    "overall_score": 0.85,
    "confidence": 0.92,
    "premium_flow": 50000000,
    "underlying_price": 175.00
  }' | jq '.predictions.win_probability'
```

```bash
# Very short time to expiry
curl -s -X POST http://localhost:8001/predict \
  -H "Content-Type: application/json" \
  -d '{
    "ticker": "AAPL",
    "option_type": "call",
    "strike": 180.0,
    "expiry": "2024-11-10",
    "days_to_expiry": 2,
    "grade": "A",
    "overall_score": 0.85,
    "confidence": 0.92,
    "premium_flow": 500000,
    "underlying_price": 175.00
  }' | jq '.predictions.win_probability'
```

**Validation**:
- ✅ Handles extreme values gracefully
- ✅ Predictions are still reasonable
- ✅ No NaN or infinity values in response

---

### 8. Performance Test

**Purpose**: Verify response times under load.

**Simple Load Test**:
```bash
# Time 100 sequential requests
time for i in {1..100}; do
  curl -s -X POST http://localhost:8001/predict \
    -H "Content-Type: application/json" \
    -d @/tmp/test_signal.json > /dev/null
done
```

**Expected**:
- Average response time < 100ms per request
- No failed requests

**Using Apache Bench** (if installed):
```bash
ab -n 100 -c 10 -p /tmp/test_signal.json \
  -T application/json \
  http://localhost:8001/predict
```

**Expected**:
- ✅ 0% failed requests
- ✅ Mean response time < 100ms
- ✅ Server remains stable

---

### 9. Integration Test with analyze-options-service

**Purpose**: Verify ML predictions integrate into strategy analysis.

**Setup**:
1. Ensure ML service is running
2. Configure analyze-options-service:
   ```bash
   cd ../analyze-options-service
   # Check .env has:
   # ML_PREDICTOR_ENABLED=true
   # ML_PREDICTOR_URL=http://localhost:8001
   ```

**Run Analysis**:
```bash
poetry run analyze strategies AAPL --expiry 2024-12-20
```

**Expected Output**:
```
Strategy Analysis for AAPL (Expires: 2024-12-20)
================================================================

ML PREDICTIONS:
  Win Probability: 65.2%
  Expected Return: +15.3%
  Expected Value: $98.50
  Recommendation: TRADE
  Reasoning: 
    - Strong win probability (65.2%)
    - High-quality signal (Grade A)

RECOMMENDED STRATEGIES:
  1. Bull Call Spread
     - ML Expected Return: +18.5%
     ...
```

**Validation**:
- ✅ ML predictions appear in output
- ✅ Strategies include ML insights
- ✅ No integration errors

---

## Automated Test Script

The project includes an automated test script at `ml-options-predictor/scripts/test_service.sh`.

**Usage**:
```bash
cd ml-options-predictor
chmod +x scripts/test_service.sh
./scripts/test_service.sh
```

**What it tests**:
1. Model status
2. API server startup
3. Health endpoint
4. Model info endpoint
5. Single predictions
6. Batch predictions
7. Error handling

**Expected Output**:
```
🧪 ML Options Predictor - Automated Test Suite
================================================

Test 1: Model Status
✅ Model status OK

Test 2: Starting API Server
✅ Server started (PID: 12345)

Test 3: Health Check
✅ Health check passed

...

================================================
✅ All tests passed! Service is working correctly.
================================================
```

---

## Continuous Testing

### During Development

Run tests after any code changes:

```bash
poetry run pytest tests/
```

### Before Deployment

Run full test suite:

```bash
# Unit tests
poetry run pytest tests/unit/

# Integration tests
poetry run pytest tests/integration/

# Manual API tests
./scripts/test_service.sh

# Load testing
ab -n 1000 -c 50 -p /tmp/test_signal.json \
  -T application/json http://localhost:8001/predict
```

### In Production

Monitor continuously:

```bash
# Health check every 5 minutes
*/5 * * * * curl -s http://localhost:8001/health | jq .

# Log response times
curl -w "@curl-format.txt" -o /dev/null -s http://localhost:8001/health
```

---

## Success Criteria

The ML Options Predictor service is working correctly if:

1. ✅ Health endpoint returns "ok" with model loaded
2. ✅ Model info shows classification AUC > 90%
3. ✅ Single predictions return valid probabilities (0-1)
4. ✅ Recommendations are "TRADE" or "SKIP"
5. ✅ Reasoning includes helpful explanations
6. ✅ Batch predictions process multiple signals
7. ✅ Error handling catches invalid inputs
8. ✅ Response times < 100ms per prediction
9. ✅ Integration with analyze-options-service works
10. ✅ Service handles edge cases gracefully

---

## Troubleshooting Failed Tests

### Health Check Fails

**Symptom**: `/health` returns error or "degraded"

**Solutions**:
1. Check server is running: `ps aux | grep ml-predict`
2. Train a model: `poetry run ml-predict train`
3. Check logs for errors

### Predictions Return Random Values

**Symptom**: Win probabilities inconsistent or unrealistic

**Solutions**:
1. Check model performance: `poetry run ml-predict status`
2. Retrain with more data (need 100+ signals)
3. Verify feature engineering: Check for NaN values in logs

### Slow Response Times

**Symptom**: Predictions take > 100ms

**Solutions**:
1. Check system resources (CPU, memory)
2. Optimize feature engineering
3. Use batch predictions for multiple signals

### Integration Tests Fail

**Symptom**: analyze-options-service doesn't show ML predictions

**Solutions**:
1. Verify `ML_PREDICTOR_ENABLED=true` in .env
2. Check `ML_PREDICTOR_URL` is correct
3. Ensure both services can communicate
4. Check network/firewall settings

---

## Next Steps

After successful testing:

1. **Deploy to Production**: Set up systemd service or Docker container
2. **Set Up Monitoring**: Configure logging and alerts
3. **Schedule Retraining**: Weekly/monthly automated retraining
4. **Backtest Predictions**: Validate against actual outcomes
5. **Iterate**: Improve features and model based on real-world performance

---

**Last Updated**: November 8, 2025  
**Test Coverage**: 100% of API endpoints  
**Status**: ✅ All Tests Passing

