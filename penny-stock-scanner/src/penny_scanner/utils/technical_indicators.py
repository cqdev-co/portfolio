"""Technical indicator calculations for penny stock analysis."""

import numpy as np
import pandas as pd
from loguru import logger

from penny_scanner.config.settings import Settings
from penny_scanner.models.market_data import MarketData, OHLCVData, TechnicalIndicators
from penny_scanner.utils.helpers import safe_divide


class TechnicalIndicatorCalculator:
    """Calculate technical indicators optimized for penny stocks."""

    def __init__(self, settings: Settings):
        """Initialize calculator with settings."""
        self.settings = settings

    def calculate_all_indicators(self, market_data: MarketData) -> MarketData:
        """
        Calculate all technical indicators for market data.

        Args:
            market_data: Market data with OHLCV

        Returns:
            Market data with calculated indicators
        """
        if len(market_data.ohlcv_data) < 50:
            logger.warning(
                f"{market_data.symbol}: Insufficient data "
                f"({len(market_data.ohlcv_data)} bars)"
            )
            return market_data

        # Convert to pandas for easier calculation
        df = self._to_dataframe(market_data.ohlcv_data)

        # Calculate indicators
        df = self._calculate_emas(df)
        df = self._calculate_volume_metrics(df)
        df = self._calculate_atr(df)
        df = self._calculate_rsi(df)
        df = self._calculate_macd(df)
        df = self._calculate_52w_metrics(df)

        # Convert back to TechnicalIndicators objects
        indicators = self._from_dataframe(df)
        market_data.indicators = indicators

        return market_data

    def _to_dataframe(self, ohlcv_data: list[OHLCVData]) -> pd.DataFrame:
        """Convert OHLCV data to pandas DataFrame."""
        data = {
            "timestamp": [d.timestamp for d in ohlcv_data],
            "open": [d.open for d in ohlcv_data],
            "high": [d.high for d in ohlcv_data],
            "low": [d.low for d in ohlcv_data],
            "close": [d.close for d in ohlcv_data],
            "volume": [d.volume for d in ohlcv_data],
        }
        return pd.DataFrame(data)

    def _calculate_emas(self, df: pd.DataFrame) -> pd.DataFrame:
        """Calculate exponential moving averages."""
        df["ema_20"] = (
            df["close"].ewm(span=self.settings.ema_short_period, adjust=False).mean()
        )
        df["ema_50"] = (
            df["close"].ewm(span=self.settings.ema_long_period, adjust=False).mean()
        )
        df["sma_20"] = df["close"].rolling(window=self.settings.ema_short_period).mean()
        return df

    def _calculate_volume_metrics(self, df: pd.DataFrame) -> pd.DataFrame:
        """Calculate volume-related metrics."""
        # Volume moving average
        df["volume_sma_20"] = (
            df["volume"].rolling(window=self.settings.volume_sma_period).mean()
        )

        # Volume ratio
        df["volume_ratio"] = df.apply(
            lambda row: safe_divide(row["volume"], row["volume_sma_20"], 1.0), axis=1
        )

        # Dollar volume
        df["dollar_volume"] = df["close"] * df["volume"]

        return df

    def _calculate_atr(self, df: pd.DataFrame) -> pd.DataFrame:
        """Calculate Average True Range."""
        # True Range calculation
        df["tr1"] = df["high"] - df["low"]
        df["tr2"] = abs(df["high"] - df["close"].shift(1))
        df["tr3"] = abs(df["low"] - df["close"].shift(1))
        df["true_range"] = df[["tr1", "tr2", "tr3"]].max(axis=1)

        # ATR
        df["atr_20"] = df["true_range"].rolling(window=self.settings.atr_period).mean()

        # Clean up temporary columns
        df.drop(["tr1", "tr2", "tr3"], axis=1, inplace=True)

        return df

    def _calculate_rsi(self, df: pd.DataFrame) -> pd.DataFrame:
        """Calculate Relative Strength Index."""
        period = self.settings.rsi_period

        # Calculate price changes
        delta = df["close"].diff()

        # Separate gains and losses
        gains = delta.where(delta > 0, 0.0)
        losses = -delta.where(delta < 0, 0.0)

        # Calculate average gains and losses
        avg_gains = gains.rolling(window=period, min_periods=period).mean()
        avg_losses = losses.rolling(window=period, min_periods=period).mean()

        # Calculate RS and RSI
        rs = avg_gains / avg_losses
        df["rsi_14"] = 100 - (100 / (1 + rs))

        return df

    def _calculate_macd(self, df: pd.DataFrame) -> pd.DataFrame:
        """Calculate MACD indicator."""
        # Calculate MACD
        ema_12 = df["close"].ewm(span=12, adjust=False).mean()
        ema_26 = df["close"].ewm(span=26, adjust=False).mean()

        df["macd"] = ema_12 - ema_26
        df["macd_signal"] = df["macd"].ewm(span=9, adjust=False).mean()
        df["macd_histogram"] = df["macd"] - df["macd_signal"]

        return df

    def _calculate_52w_metrics(self, df: pd.DataFrame) -> pd.DataFrame:
        """Calculate 52-week high/low metrics."""
        # Use min of 252 trading days or available data
        window = min(252, len(df))

        df["52w_high"] = df["high"].rolling(window=window, min_periods=1).max()
        df["52w_low"] = df["low"].rolling(window=window, min_periods=1).min()

        # Distance from 52-week high/low as percentage
        df["distance_from_52w_high"] = (
            (df["close"] - df["52w_high"]) / df["52w_high"] * 100
        )
        df["distance_from_52w_low"] = (
            (df["close"] - df["52w_low"]) / df["52w_low"] * 100
        )

        return df

    def _from_dataframe(self, df: pd.DataFrame) -> list[TechnicalIndicators]:
        """Convert DataFrame back to TechnicalIndicators objects."""
        indicators = []

        for _, row in df.iterrows():
            indicator = TechnicalIndicators(
                timestamp=row["timestamp"],
                ema_20=row.get("ema_20"),
                ema_50=row.get("ema_50"),
                sma_20=row.get("sma_20"),
                volume_sma_20=row.get("volume_sma_20"),
                volume_ratio=row.get("volume_ratio"),
                dollar_volume=row.get("dollar_volume"),
                atr_20=row.get("atr_20"),
                true_range=row.get("true_range"),
                rsi_14=row.get("rsi_14"),
                macd=row.get("macd"),
                macd_signal=row.get("macd_signal"),
                macd_histogram=row.get("macd_histogram"),
                distance_from_52w_high=row.get("distance_from_52w_high"),
                distance_from_52w_low=row.get("distance_from_52w_low"),
            )
            indicators.append(indicator)

        return indicators

    # Advanced Penny Stock Specific Calculations

    def detect_consolidation(
        self, ohlcv_data: list[OHLCVData], lookback_days: int | None = None
    ) -> tuple[bool, int, float]:
        """
        Detect if stock is in consolidation phase.

        Args:
            ohlcv_data: OHLCV data
            lookback_days: Days to look back (default from settings)

        Returns:
            (is_consolidating, days_consolidating, range_pct)
        """
        if lookback_days is None:
            lookback_days = self.settings.consolidation_days_max

        if len(ohlcv_data) < lookback_days:
            return False, 0, 0.0

        recent_data = ohlcv_data[-lookback_days:]

        high_prices = [d.high for d in recent_data]
        low_prices = [d.low for d in recent_data]

        highest = max(high_prices)
        lowest = min(low_prices)
        avg_price = (highest + lowest) / 2

        # Calculate range as percentage
        range_pct = safe_divide(highest - lowest, avg_price, 0) * 100

        # Check if range is within consolidation threshold
        is_consolidating = range_pct <= self.settings.consolidation_range_pct

        return is_consolidating, len(recent_data), range_pct

    def detect_higher_lows(
        self, ohlcv_data: list[OHLCVData], lookback_days: int = 10
    ) -> bool:
        """
        Detect if stock is forming higher lows (accumulation pattern).

        Args:
            ohlcv_data: OHLCV data
            lookback_days: Days to analyze

        Returns:
            True if higher lows detected
        """
        if len(ohlcv_data) < lookback_days:
            return False

        recent_data = ohlcv_data[-lookback_days:]
        lows = [d.low for d in recent_data]

        # Find local minima
        local_mins = []
        for i in range(1, len(lows) - 1):
            if lows[i] < lows[i - 1] and lows[i] < lows[i + 1]:
                local_mins.append(lows[i])

        # Need at least 2 local minima
        if len(local_mins) < 2:
            return False

        # Check if each successive low is higher
        for i in range(1, len(local_mins)):
            if local_mins[i] <= local_mins[i - 1]:
                return False

        return True

    def calculate_volume_acceleration(
        self, ohlcv_data: list[OHLCVData], periods: list[int] = None
    ) -> dict:
        """
        Calculate volume acceleration over different periods.

        Args:
            ohlcv_data: OHLCV data
            periods: List of periods to calculate

        Returns:
            Dict with acceleration values for each period
        """
        if periods is None:
            periods = [2, 5]
        result = {}

        for period in periods:
            if len(ohlcv_data) < period + 1:
                result[f"{period}d"] = 0.0
                continue

            recent_volumes = [d.volume for d in ohlcv_data[-period:]]
            previous_volumes = [d.volume for d in ohlcv_data[-period * 2 : -period]]

            if not previous_volumes:
                result[f"{period}d"] = 0.0
                continue

            recent_avg = np.mean(recent_volumes)
            previous_avg = np.mean(previous_volumes)

            acceleration = (
                safe_divide(recent_avg - previous_avg, previous_avg, 0.0) * 100
            )

            result[f"{period}d"] = acceleration

        return result

    def count_consecutive_green_days(
        self, ohlcv_data: list[OHLCVData], max_lookback: int = 10
    ) -> int:
        """
        Count consecutive days where close > open.

        Args:
            ohlcv_data: OHLCV data
            max_lookback: Maximum days to look back

        Returns:
            Number of consecutive green days
        """
        count = 0

        for i in range(
            len(ohlcv_data) - 1, max(0, len(ohlcv_data) - max_lookback - 1), -1
        ):
            if ohlcv_data[i].close > ohlcv_data[i].open:
                count += 1
            else:
                break

        return count

    def calculate_volume_consistency(
        self,
        ohlcv_data: list[OHLCVData],
        lookback_days: int = 5,
        threshold_multiplier: float = 1.5,
    ) -> float:
        """
        Calculate volume consistency score (0-1).
        Higher score = more consistent high volume days.

        Args:
            ohlcv_data: OHLCV data
            lookback_days: Days to analyze
            threshold_multiplier: Volume threshold vs average

        Returns:
            Consistency score (0-1)
        """
        if len(ohlcv_data) < lookback_days + 20:
            return 0.0

        # Get baseline average volume
        baseline_data = ohlcv_data[-lookback_days - 20 : -lookback_days]
        baseline_avg = np.mean([d.volume for d in baseline_data])

        # Check recent days
        recent_data = ohlcv_data[-lookback_days:]
        high_volume_days = sum(
            1 for d in recent_data if d.volume >= baseline_avg * threshold_multiplier
        )

        # Score based on proportion of high volume days
        consistency_score = high_volume_days / lookback_days

        return consistency_score
