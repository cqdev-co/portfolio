"""ML Predictor API client for analyze-options-service."""

from datetime import date
from typing import Dict, List, Optional

import httpx
from loguru import logger
from pydantic import BaseModel


class MLPrediction(BaseModel):
    """ML prediction result."""

    win_probability: float
    expected_return_pct: float
    expected_value: float
    confidence: str
    recommendation: str
    reasoning: List[str]


class MLPredictorClient:
    """Client for ML Options Predictor API."""

    def __init__(self, base_url: str = "http://localhost:8001"):
        """
        Initialize ML predictor client.

        Args:
            base_url: Base URL of ML predictor API
        """
        self.base_url = base_url.rstrip("/")
        self.client = httpx.Client(timeout=30.0)

    def is_available(self) -> bool:
        """
        Check if ML predictor service is available.

        Returns:
            True if available, False otherwise
        """
        try:
            response = self.client.get(f"{self.base_url}/health")
            return response.status_code == 200 and response.json().get(
                "model_loaded", False
            )
        except Exception as e:
            logger.debug(f"ML predictor not available: {e}")
            return False

    def predict(
        self,
        ticker: str,
        strike: float,
        expiry: date,
        option_type: str,
        days_to_expiry: int,
        grade: str,
        overall_score: float,
        confidence: float,
        premium_flow: float,
        volume_ratio: Optional[float] = None,
        current_volume: Optional[int] = None,
        implied_volatility: Optional[float] = None,
        iv_rank: Optional[float] = None,
        moneyness: Optional[str] = None,
        underlying_price: Optional[float] = None,
        sentiment: Optional[str] = None,
        has_volume_anomaly: bool = False,
        has_oi_spike: bool = False,
        has_premium_flow: bool = False,
        has_sweep: bool = False,
        has_block_trade: bool = False,
        **kwargs,
    ) -> Optional[MLPrediction]:
        """
        Get ML prediction for a signal.

        Args:
            ticker: Stock ticker
            strike: Strike price
            expiry: Expiry date
            option_type: call or put
            days_to_expiry: Days to expiry
            grade: Signal grade
            overall_score: Signal score
            confidence: Confidence score
            premium_flow: Premium flow
            volume_ratio: Volume ratio
            current_volume: Current volume
            implied_volatility: IV
            iv_rank: IV rank
            moneyness: ITM/ATM/OTM
            underlying_price: Stock price
            sentiment: Signal sentiment
            has_volume_anomaly: Volume anomaly flag
            has_oi_spike: OI spike flag
            has_premium_flow: Premium flow flag
            has_sweep: Sweep flag
            has_block_trade: Block trade flag
            **kwargs: Additional parameters

        Returns:
            MLPrediction or None if service unavailable
        """
        if not self.is_available():
            logger.debug("ML predictor service not available")
            return None

        try:
            payload = {
                "ticker": ticker,
                "strike": strike,
                "expiry": expiry.isoformat() if isinstance(expiry, date) else expiry,
                "option_type": option_type,
                "days_to_expiry": days_to_expiry,
                "grade": grade,
                "overall_score": overall_score,
                "confidence": confidence,
                "premium_flow": premium_flow,
                "volume_ratio": volume_ratio,
                "current_volume": current_volume,
                "implied_volatility": implied_volatility,
                "iv_rank": iv_rank,
                "moneyness": moneyness,
                "underlying_price": underlying_price or strike,
                "sentiment": sentiment,
                "has_volume_anomaly": has_volume_anomaly,
                "has_oi_spike": has_oi_spike,
                "has_premium_flow": has_premium_flow,
                "has_sweep": has_sweep,
                "has_block_trade": has_block_trade,
            }

            # Remove None values
            payload = {k: v for k, v in payload.items() if v is not None}

            response = self.client.post(
                f"{self.base_url}/predict",
                json=payload,
            )

            if response.status_code != 200:
                logger.error(
                    f"ML prediction failed: {response.status_code} - {response.text}"
                )
                return None

            result = response.json()

            return MLPrediction(
                win_probability=result["predictions"]["win_probability"],
                expected_return_pct=result["predictions"]["expected_return_pct"],
                expected_value=result["predictions"]["expected_value"],
                confidence=result["predictions"]["confidence"],
                recommendation=result["recommendation"],
                reasoning=result.get("reasoning", []),
            )

        except Exception as e:
            logger.error(f"ML prediction error: {e}")
            return None

    def enhance_signal_score(
        self,
        base_score: float,
        signal_data: Dict,
    ) -> tuple[float, Optional[MLPrediction]]:
        """
        Enhance signal score with ML prediction.

        Args:
            base_score: Original signal score (0-100)
            signal_data: Signal data dictionary

        Returns:
            Tuple of (enhanced_score, ml_prediction)
        """
        # Get ML prediction
        ml_prediction = self.predict(**signal_data)

        if ml_prediction is None:
            # ML service not available, return original score
            return base_score, None

        # Enhance score with ML prediction
        # Formula: 40% base + 30% ML win prob + 30% ML expected value
        ml_score = (
            base_score * 0.4
            + ml_prediction.win_probability * 100 * 0.3
            + ml_prediction.expected_value * 0.3
        )

        # Clamp to 0-100
        enhanced_score = max(0, min(100, ml_score))

        logger.debug(
            f"Enhanced score: {base_score:.1f} → {enhanced_score:.1f} "
            f"(ML win prob: {ml_prediction.win_probability:.2%})"
        )

        return enhanced_score, ml_prediction

    def close(self):
        """Close the HTTP client."""
        self.client.close()

