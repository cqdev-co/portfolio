"""
Market comparison service for calculating relative strength vs SPY.

Calculates how penny stocks perform relative to the broader market
to identify true outperformance vs general market moves.
"""

from datetime import datetime

import yfinance as yf
from loguru import logger

from penny_scanner.config.settings import Settings
from penny_scanner.models.market_data import MarketData
from penny_scanner.utils.rate_limiter import get_rate_limiter


class MarketComparisonService:
    """
    Service for comparing penny stock performance to market benchmarks.

    Uses SPY (S&P 500 ETF) as the primary benchmark.
    """

    def __init__(self, settings: Settings):
        """Initialize market comparison service."""
        self.settings = settings
        self._spy_cache: dict[str, any] = {}
        self._cache_timestamp: datetime | None = None
        self._cache_ttl_minutes = 60  # Refresh SPY data every 60 minutes
        self.rate_limiter = get_rate_limiter()

    def _is_cache_valid(self) -> bool:
        """Check if SPY cache is still valid."""
        if not self._cache_timestamp:
            return False
        age = datetime.now() - self._cache_timestamp
        return age.total_seconds() < (self._cache_ttl_minutes * 60)

    def _fetch_spy_data(self, period: str = "1mo") -> dict | None:
        """
        Fetch SPY benchmark data with rate limiting.

        Args:
            period: Time period to fetch

        Returns:
            Dictionary with SPY performance metrics
        """
        last_error = None

        while self.rate_limiter.should_retry():
            try:
                # Use synchronous rate limit check (SPY fetch is sync)
                # We'll just add a small delay before fetching
                import time

                # Check rate limiter stats and wait if needed
                stats = self.rate_limiter.get_stats()
                if stats["requests_last_minute"] > 25:
                    wait_time = 2.0
                    logger.debug(f"SPY fetch: rate limiting, waiting {wait_time}s")
                    time.sleep(wait_time)

                spy = yf.Ticker("SPY")
                hist = spy.history(period=period)

                if hist.empty:
                    logger.warning("No SPY data available")
                    return None

                # Calculate various timeframe returns
                closes = hist["Close"].values

                spy_data = {
                    "latest_close": closes[-1],
                    "prices": closes,
                    "dates": hist.index.tolist(),
                }

                # 5-day return
                if len(closes) >= 6:
                    spy_data["return_5d"] = (closes[-1] - closes[-6]) / closes[-6] * 100
                else:
                    spy_data["return_5d"] = 0

                # 10-day return
                if len(closes) >= 11:
                    spy_data["return_10d"] = (
                        (closes[-1] - closes[-11]) / closes[-11] * 100
                    )
                else:
                    spy_data["return_10d"] = 0

                # 20-day return
                if len(closes) >= 21:
                    spy_data["return_20d"] = (
                        (closes[-1] - closes[-21]) / closes[-21] * 100
                    )
                else:
                    spy_data["return_20d"] = 0

                # 1-day return
                if len(closes) >= 2:
                    spy_data["return_1d"] = (closes[-1] - closes[-2]) / closes[-2] * 100
                else:
                    spy_data["return_1d"] = 0

                self._spy_cache = spy_data
                self._cache_timestamp = datetime.now()

                self.rate_limiter.record_success()

                logger.debug(
                    f"Fetched SPY data: 1d={spy_data['return_1d']:.2f}%, "
                    f"5d={spy_data['return_5d']:.2f}%, "
                    f"20d={spy_data['return_20d']:.2f}%"
                )

                return spy_data

            except Exception as e:
                error_str = str(e).lower()

                # Check for rate limit errors
                if "rate limit" in error_str or "too many requests" in error_str:
                    backoff = self.rate_limiter.record_rate_limit_error()
                    logger.warning(f"SPY rate limited, backing off {backoff:.1f}s")
                    import time

                    time.sleep(backoff)
                    last_error = e
                else:
                    logger.error(f"Error fetching SPY data: {e}")
                    return None

        logger.error(f"Max retries exceeded for SPY: {last_error}")
        return None

    def get_spy_data(self) -> dict | None:
        """
        Get SPY data, using cache if valid.

        Returns:
            Dictionary with SPY metrics or None
        """
        if self._is_cache_valid():
            return self._spy_cache
        return self._fetch_spy_data()

    def calculate_market_outperformance(
        self, stock_return_5d: float, stock_return_20d: float
    ) -> tuple[float | None, float | None]:
        """
        Calculate how much a stock outperforms the market.

        Args:
            stock_return_5d: Stock's 5-day return (%)
            stock_return_20d: Stock's 20-day return (%)

        Returns:
            Tuple of (5d outperformance, 20d outperformance) in percentage points
            Returns None if SPY data unavailable
        """
        spy_data = self.get_spy_data()

        if not spy_data:
            return None, None

        # Outperformance = stock return - market return
        outperf_5d = stock_return_5d - spy_data["return_5d"]
        outperf_20d = stock_return_20d - spy_data["return_20d"]

        return outperf_5d, outperf_20d

    def calculate_relative_strength(
        self, market_data: MarketData
    ) -> dict[str, float | None]:
        """
        Calculate comprehensive relative strength metrics for a stock.

        Args:
            market_data: Stock's market data

        Returns:
            Dictionary with relative strength metrics
        """
        result = {
            "market_outperformance_5d": None,
            "market_outperformance_20d": None,
            "relative_strength_score": None,
            "spy_return_5d": None,
            "spy_return_20d": None,
        }

        spy_data = self.get_spy_data()
        if not spy_data:
            return result

        result["spy_return_5d"] = spy_data["return_5d"]
        result["spy_return_20d"] = spy_data["return_20d"]

        # Calculate stock returns
        if len(market_data.ohlcv_data) < 21:
            return result

        prices = [d.close for d in market_data.ohlcv_data]

        stock_return_5d = (
            (prices[-1] - prices[-6]) / prices[-6] * 100 if len(prices) > 5 else 0
        )
        stock_return_20d = (
            (prices[-1] - prices[-21]) / prices[-21] * 100 if len(prices) > 20 else 0
        )

        # Calculate outperformance
        outperf_5d = stock_return_5d - spy_data["return_5d"]
        outperf_20d = stock_return_20d - spy_data["return_20d"]

        result["market_outperformance_5d"] = outperf_5d
        result["market_outperformance_20d"] = outperf_20d

        # Calculate weighted relative strength score
        # Weight recent performance more heavily
        rs_score = (outperf_5d * 0.6) + (outperf_20d * 0.4)
        result["relative_strength_score"] = rs_score

        return result

    def is_outperforming_market(
        self, market_data: MarketData, threshold_pct: float = 5.0
    ) -> tuple[bool, float]:
        """
        Check if a stock is significantly outperforming the market.

        Args:
            market_data: Stock's market data
            threshold_pct: Minimum outperformance to be considered "outperforming"

        Returns:
            Tuple of (is_outperforming, outperformance_amount)
        """
        metrics = self.calculate_relative_strength(market_data)

        if metrics["market_outperformance_20d"] is None:
            return False, 0.0

        outperf = metrics["market_outperformance_20d"]
        is_outperforming = outperf >= threshold_pct

        return is_outperforming, outperf


# Singleton instance for efficiency
_market_comparison_service: MarketComparisonService | None = None


def get_market_comparison_service(settings: Settings) -> MarketComparisonService:
    """Get or create market comparison service singleton."""
    global _market_comparison_service
    if _market_comparison_service is None:
        _market_comparison_service = MarketComparisonService(settings)
    return _market_comparison_service
