# ML Options Predictor

Machine learning service for predicting unusual options signal profitability using expired signals as training data.

## Features

- **Smart Labeling**: Automatically labels expired signals as wins/losses
- **Dual Prediction**: Win probability + expected return prediction
- **REST API**: FastAPI server for integration with other services
- **Continuous Learning**: Automated daily retraining with new expired signals
- **Production Ready**: Model versioning, rollback, monitoring

## Quick Start

### Installation

```bash
# Install dependencies
poetry install

# Copy environment template
cp .env.example .env
# Edit .env with your Supabase credentials
```

### CLI Usage

```bash
# Train initial models
poetry run ml-predict train

# Run API server
poetry run ml-predict serve --port 8001

# Check status
poetry run ml-predict status

# Manual prediction
poetry run ml-predict predict --ticker AAPL --strike 275 --expiry 2025-11-21
```

## Architecture

```
ml-options-predictor/
├── src/ml_predictor/
│   ├── data/              # Data loading and labeling
│   ├── models/            # ML models
│   ├── training/          # Training pipeline
│   ├── api/               # FastAPI server
│   └── monitoring/        # Performance tracking
├── models/                # Saved model artifacts
├── data/                  # Training data
└── config/                # Configuration files
```

## How It Works

1. **Label Generation**: Fetches expired signals from Supabase and determines win/loss by checking if options expired in-the-money
2. **Feature Engineering**: Extracts 20+ features from signal data (grade, volume, premium flow, IV, etc.)
3. **Model Training**: Trains XGBoost models for win probability and expected return
4. **API Service**: Serves predictions via REST API
5. **Continuous Learning**: Retrains daily with newly expired signals

## Performance

- **Training Time**: 2-5 minutes (2,500 signals on M3 Pro Max)
- **Prediction Time**: <50ms per signal
- **Expected AUC-ROC**: >0.70 for win probability

## Integration

Integrates with `analyze-options-service` to enhance signal scoring:

```python
# In analyze-options-service
ml_prediction = ml_client.predict(signal)
enhanced_score = (
    base_score * 0.4 +
    ml_prediction.win_probability * 100 * 0.3 +
    ml_prediction.expected_value * 0.3
)
```

## Development

```bash
# Run tests
poetry run pytest

# Format code
poetry run black src/

# Type checking
poetry run mypy src/
```

## License

MIT

