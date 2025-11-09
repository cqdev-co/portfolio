"""FastAPI server for ML predictions."""

from contextlib import asynccontextmanager
from typing import List, Optional

import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger

from ml_predictor.api.schemas import (
    BatchPredictionRequest,
    BatchPredictionResponse,
    HealthResponse,
    ModelInfo,
    PredictionResponse,
    SignalPrediction,
    SignalPredictionRequest,
)
from ml_predictor.config import get_settings
from ml_predictor.data.feature_engineering import FeatureEngineer
from ml_predictor.models.predictor import MLPredictor
from ml_predictor.training.trainer import ModelTrainer


# Global state
_predictor: Optional[MLPredictor] = None
_feature_engineer: Optional[FeatureEngineer] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown logic."""
    global _predictor, _feature_engineer

    settings = get_settings()

    # Load model on startup
    try:
        logger.info("Loading ML model...")
        _predictor = MLPredictor(model_dir=settings.models_dir)
        _predictor.load()
        _feature_engineer = FeatureEngineer()
        _feature_engineer.feature_names = _predictor.feature_names
        logger.info(f"Model loaded: version {_predictor.model_version}")
    except Exception as e:
        logger.error(f"Failed to load model: {e}")
        logger.warning("Starting server without model. Train a model first.")

    yield

    # Cleanup on shutdown
    logger.info("Shutting down...")


# Create FastAPI app
app = FastAPI(
    title="ML Options Predictor",
    description="Machine learning service for predicting options signal profitability",
    version="0.1.0",
    lifespan=lifespan,
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _get_predictor() -> MLPredictor:
    """Get predictor instance."""
    if _predictor is None:
        raise HTTPException(
            status_code=503,
            detail="Model not loaded. Train a model first.",
        )
    return _predictor


def _get_feature_engineer() -> FeatureEngineer:
    """Get feature engineer instance."""
    if _feature_engineer is None:
        raise HTTPException(
            status_code=503,
            detail="Feature engineer not initialized.",
        )
    return _feature_engineer


def _signal_to_dataframe(signal: SignalPredictionRequest) -> pd.DataFrame:
    """Convert signal request to DataFrame."""
    data = signal.model_dump()
    # Convert date to string
    if "expiry" in data and data["expiry"]:
        data["expiry"] = data["expiry"].isoformat()
    return pd.DataFrame([data])


def _generate_recommendation(
    predictions: PredictionResponse,
    signal: SignalPredictionRequest,
) -> tuple[str, List[str]]:
    """
    Generate recommendation and reasoning.

    Args:
        predictions: Model predictions
        signal: Signal data

    Returns:
        Tuple of (recommendation, reasoning)
    """
    reasoning = []

    # Decision thresholds
    TRADE_THRESHOLD = 0.45  # 45% win probability
    HIGH_EV_THRESHOLD = 10  # 10% expected value

    # Analyze signal
    if predictions.win_probability < TRADE_THRESHOLD:
        recommendation = "SKIP"
        reasoning.append(
            f"Low win probability ({predictions.win_probability:.1%}) "
            f"below threshold ({TRADE_THRESHOLD:.1%})"
        )
    elif predictions.expected_value > HIGH_EV_THRESHOLD:
        recommendation = "TRADE"
        reasoning.append(
            f"High expected value ({predictions.expected_value:.1f}%)"
        )
    elif predictions.win_probability > 0.60:
        recommendation = "TRADE"
        reasoning.append(
            f"Strong win probability ({predictions.win_probability:.1%})"
        )
    else:
        recommendation = "TRADE"
        reasoning.append(
            f"Acceptable win probability ({predictions.win_probability:.1%})"
        )

    # Add signal-specific insights
    if signal.grade in ["S", "A"]:
        reasoning.append(f"High-quality signal (Grade {signal.grade})")

    if signal.premium_flow > 500000:
        reasoning.append(
            f"Strong premium flow (${signal.premium_flow:,.0f})"
        )

    if signal.implied_volatility and signal.iv_rank:
        if signal.iv_rank < 50:
            reasoning.append(
                f"Favorable IV rank ({signal.iv_rank:.0f})"
            )

    if signal.days_to_earnings and signal.days_to_earnings <= 14:
        reasoning.append(
            f"Near-term catalyst: earnings in {signal.days_to_earnings} days"
        )

    return recommendation, reasoning


@app.get("/", tags=["Root"])
async def root():
    """Root endpoint."""
    return {
        "service": "ML Options Predictor",
        "version": "0.1.0",
        "status": "running",
    }


@app.get("/health", response_model=HealthResponse, tags=["Health"])
async def health_check():
    """Health check endpoint."""
    model_loaded = _predictor is not None
    model_version = _predictor.model_version if model_loaded else None

    return HealthResponse(
        status="ok" if model_loaded else "degraded",
        model_loaded=model_loaded,
        model_version=model_version,
    )


@app.get("/model/info", response_model=ModelInfo, tags=["Model"])
async def model_info():
    """Get current model information."""
    predictor = _get_predictor()

    classification_metrics = predictor.metrics.get("classification", {})
    regression_metrics = predictor.metrics.get("regression", {})

    return ModelInfo(
        version=predictor.model_version,
        classification_auc=classification_metrics.get("val_auc"),
        regression_r2=regression_metrics.get("val_r2"),
        features=predictor.feature_names or [],
    )


@app.post("/predict", response_model=SignalPrediction, tags=["Prediction"])
async def predict_signal(signal: SignalPredictionRequest):
    """Predict profitability for a single signal."""
    predictor = _get_predictor()
    feature_engineer = _get_feature_engineer()

    try:
        # Convert to DataFrame
        signal_df = _signal_to_dataframe(signal)

        # Engineer features
        X = feature_engineer.prepare_prediction_data(signal_df)

        # Make prediction
        predictions_df = predictor.predict(X)

        # Extract predictions
        pred_response = PredictionResponse(
            win_probability=float(predictions_df.iloc[0]["win_probability"]),
            expected_return_pct=float(predictions_df.iloc[0]["expected_return_pct"]),
            expected_value=float(predictions_df.iloc[0]["expected_value"]),
            confidence="high"
            if predictions_df.iloc[0]["win_probability"] > 0.65
            else "medium"
            if predictions_df.iloc[0]["win_probability"] > 0.50
            else "low",
        )

        # Generate recommendation
        recommendation, reasoning = _generate_recommendation(pred_response, signal)

        return SignalPrediction(
            ticker=signal.ticker,
            predictions=pred_response,
            recommendation=recommendation,
            model_version=predictor.model_version,
            reasoning=reasoning,
        )

    except Exception as e:
        logger.error(f"Prediction error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post(
    "/predict_batch",
    response_model=BatchPredictionResponse,
    tags=["Prediction"],
)
async def predict_batch(request: BatchPredictionRequest):
    """Predict profitability for multiple signals."""
    predictor = _get_predictor()
    feature_engineer = _get_feature_engineer()

    try:
        # Convert all signals to DataFrame
        signal_dicts = [s.model_dump() for s in request.signals]
        for d in signal_dicts:
            if "expiry" in d and d["expiry"]:
                d["expiry"] = d["expiry"].isoformat()

        signals_df = pd.DataFrame(signal_dicts)

        # Engineer features
        X = feature_engineer.prepare_prediction_data(signals_df)

        # Make predictions
        predictions_df = predictor.predict(X)

        # Build response
        predictions = []
        trade_count = 0
        skip_count = 0

        for i, (_, pred_row) in enumerate(predictions_df.iterrows()):
            signal = request.signals[i]

            pred_response = PredictionResponse(
                win_probability=float(pred_row["win_probability"]),
                expected_return_pct=float(pred_row["expected_return_pct"]),
                expected_value=float(pred_row["expected_value"]),
                confidence="high"
                if pred_row["win_probability"] > 0.65
                else "medium"
                if pred_row["win_probability"] > 0.50
                else "low",
            )

            recommendation, reasoning = _generate_recommendation(
                pred_response, signal
            )

            if recommendation == "TRADE":
                trade_count += 1
            else:
                skip_count += 1

            predictions.append(
                SignalPrediction(
                    ticker=signal.ticker,
                    predictions=pred_response,
                    recommendation=recommendation,
                    model_version=predictor.model_version,
                    reasoning=reasoning,
                )
            )

        return BatchPredictionResponse(
            predictions=predictions,
            total_signals=len(request.signals),
            trade_signals=trade_count,
            skip_signals=skip_count,
        )

    except Exception as e:
        logger.error(f"Batch prediction error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/retrain", tags=["Training"])
async def trigger_retrain(min_new_signals: Optional[int] = None):
    """Trigger model retraining with new data."""
    try:
        global _predictor, _feature_engineer

        trainer = ModelTrainer()
        new_predictor = trainer.retrain_with_new_data(
            min_new_signals=min_new_signals
        )

        if new_predictor:
            # Update global predictor
            _predictor = new_predictor
            _feature_engineer = FeatureEngineer()
            _feature_engineer.feature_names = _predictor.feature_names

            return {
                "status": "success",
                "message": "Model retrained successfully",
                "version": _predictor.model_version,
            }
        else:
            return {
                "status": "skipped",
                "message": "Not enough new data to retrain",
            }

    except Exception as e:
        logger.error(f"Retrain error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

