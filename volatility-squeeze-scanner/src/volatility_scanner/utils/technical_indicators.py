"""Technical indicator calculations for volatility analysis."""

from typing import List, Optional, Tuple
import numpy as np
import pandas as pd
from loguru import logger

from volatility_scanner.models.market_data import MarketData, TechnicalIndicators
from volatility_scanner.config.settings import Settings


class TechnicalIndicatorCalculator:
    """Calculator for technical indicators used in volatility squeeze detection."""
    
    def __init__(self, settings: Settings) -> None:
        """Initialize the calculator with settings."""
        self.settings = settings
    
    def calculate_all_indicators(self, market_data: MarketData) -> MarketData:
        """
        Calculate all technical indicators for market data.
        
        Args:
            market_data: MarketData object with OHLCV data
            
        Returns:
            MarketData object with populated indicators
        """
        df = market_data.to_dataframe()
        
        if len(df) < max(self.settings.bb_period, self.settings.keltner_period, 
                        self.settings.atr_period, self.settings.ema_long):
            logger.warning(
                f"Insufficient data for {market_data.symbol}: "
                f"{len(df)} periods available"
            )
            return market_data
        
        # Calculate all indicators
        bb_data = self._calculate_bollinger_bands(df)
        kc_data = self._calculate_keltner_channels(df)
        atr_data = self._calculate_atr(df)
        ema_data = self._calculate_emas(df)
        volume_data = self._calculate_volume_indicators(df)
        momentum_data = self._calculate_momentum_indicators(df)
        trend_data = self._calculate_trend_indicators(df)
        
        # Combine all indicators
        indicators = []
        for i, timestamp in enumerate(df.index):
            indicator = TechnicalIndicators(
                timestamp=timestamp.to_pydatetime(),
                bb_upper=bb_data['bb_upper'].iloc[i] if not pd.isna(bb_data['bb_upper'].iloc[i]) else None,
                bb_middle=bb_data['bb_middle'].iloc[i] if not pd.isna(bb_data['bb_middle'].iloc[i]) else None,
                bb_lower=bb_data['bb_lower'].iloc[i] if not pd.isna(bb_data['bb_lower'].iloc[i]) else None,
                bb_width=bb_data['bb_width'].iloc[i] if not pd.isna(bb_data['bb_width'].iloc[i]) else None,
                kc_upper=kc_data['kc_upper'].iloc[i] if not pd.isna(kc_data['kc_upper'].iloc[i]) else None,
                kc_middle=kc_data['kc_middle'].iloc[i] if not pd.isna(kc_data['kc_middle'].iloc[i]) else None,
                kc_lower=kc_data['kc_lower'].iloc[i] if not pd.isna(kc_data['kc_lower'].iloc[i]) else None,
                atr=atr_data.iloc[i] if not pd.isna(atr_data.iloc[i]) else None,
                ema_short=ema_data['ema_short'].iloc[i] if not pd.isna(ema_data['ema_short'].iloc[i]) else None,
                ema_long=ema_data['ema_long'].iloc[i] if not pd.isna(ema_data['ema_long'].iloc[i]) else None,
                volume_sma=volume_data['volume_sma'].iloc[i] if not pd.isna(volume_data['volume_sma'].iloc[i]) else None,
                volume_ratio=volume_data['volume_ratio'].iloc[i] if not pd.isna(volume_data['volume_ratio'].iloc[i]) else None,
                # Momentum indicators
                rsi=momentum_data['rsi'].iloc[i] if not pd.isna(momentum_data['rsi'].iloc[i]) else None,
                macd=momentum_data['macd'].iloc[i] if not pd.isna(momentum_data['macd'].iloc[i]) else None,
                macd_signal=momentum_data['macd_signal'].iloc[i] if not pd.isna(momentum_data['macd_signal'].iloc[i]) else None,
                # Trend indicators
                adx=trend_data['adx'].iloc[i] if not pd.isna(trend_data['adx'].iloc[i]) else None,
                di_plus=trend_data['di_plus'].iloc[i] if not pd.isna(trend_data['di_plus'].iloc[i]) else None,
                di_minus=trend_data['di_minus'].iloc[i] if not pd.isna(trend_data['di_minus'].iloc[i]) else None,
            )
            indicators.append(indicator)
        
        # Update market data with indicators
        market_data.indicators = indicators
        
        logger.info(
            f"Calculated technical indicators for {market_data.symbol}: "
            f"{len(indicators)} periods"
        )
        
        return market_data
    
    def _calculate_bollinger_bands(self, df: pd.DataFrame) -> pd.DataFrame:
        """Calculate Bollinger Bands."""
        period = self.settings.bb_period
        std_dev = self.settings.bb_std
        
        # Calculate SMA (middle band)
        sma = df['close'].rolling(window=period).mean()
        
        # Calculate standard deviation
        std = df['close'].rolling(window=period).std()
        
        # Calculate bands
        bb_upper = sma + (std * std_dev)
        bb_lower = sma - (std * std_dev)
        
        # Calculate BB Width (normalized by middle band)
        bb_width = (bb_upper - bb_lower) / sma
        
        return pd.DataFrame({
            'bb_upper': bb_upper,
            'bb_middle': sma,
            'bb_lower': bb_lower,
            'bb_width': bb_width
        })
    
    def _calculate_keltner_channels(self, df: pd.DataFrame) -> pd.DataFrame:
        """Calculate Keltner Channels."""
        period = self.settings.keltner_period
        multiplier = self.settings.keltner_multiplier
        
        # Calculate EMA (middle line)
        ema = df['close'].ewm(span=period).mean()
        
        # Calculate ATR for channel width
        atr = self._calculate_atr(df, period=period)
        
        # Calculate channels
        kc_upper = ema + (atr * multiplier)
        kc_lower = ema - (atr * multiplier)
        
        return pd.DataFrame({
            'kc_upper': kc_upper,
            'kc_middle': ema,
            'kc_lower': kc_lower
        })
    
    def _calculate_atr(self, df: pd.DataFrame, period: Optional[int] = None) -> pd.Series:
        """Calculate Average True Range."""
        if period is None:
            period = self.settings.atr_period
        
        # Calculate True Range components
        high_low = df['high'] - df['low']
        high_close_prev = abs(df['high'] - df['close'].shift(1))
        low_close_prev = abs(df['low'] - df['close'].shift(1))
        
        # True Range is the maximum of the three
        true_range = pd.concat([high_low, high_close_prev, low_close_prev], axis=1).max(axis=1)
        
        # ATR is the moving average of True Range
        atr = true_range.rolling(window=period).mean()
        
        return atr
    
    def _calculate_emas(self, df: pd.DataFrame) -> pd.DataFrame:
        """Calculate Exponential Moving Averages."""
        ema_short = df['close'].ewm(span=self.settings.ema_short).mean()
        ema_long = df['close'].ewm(span=self.settings.ema_long).mean()
        
        return pd.DataFrame({
            'ema_short': ema_short,
            'ema_long': ema_long
        })
    
    def _calculate_volume_indicators(self, df: pd.DataFrame) -> pd.DataFrame:
        """Calculate volume-based indicators."""
        # Volume SMA (20-day default)
        volume_sma = df['volume'].rolling(window=20).mean()
        
        # Volume ratio (current vs average)
        volume_ratio = df['volume'] / volume_sma
        
        return pd.DataFrame({
            'volume_sma': volume_sma,
            'volume_ratio': volume_ratio
        })
    
    def _calculate_momentum_indicators(self, df: pd.DataFrame) -> pd.DataFrame:
        """Calculate momentum-based indicators (RSI, MACD)."""
        
        # RSI calculation
        delta = df['close'].diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
        rs = gain / loss
        rsi = 100 - (100 / (1 + rs))
        
        # MACD calculation
        ema_12 = df['close'].ewm(span=12).mean()
        ema_26 = df['close'].ewm(span=26).mean()
        macd = ema_12 - ema_26
        macd_signal = macd.ewm(span=9).mean()
        
        return pd.DataFrame({
            'rsi': rsi,
            'macd': macd,
            'macd_signal': macd_signal
        })
    
    def _calculate_trend_indicators(self, df: pd.DataFrame) -> pd.DataFrame:
        """Calculate trend strength indicators (ADX, DI+, DI-)."""
        
        if len(df) < 30:  # Need at least 30 periods for reliable ADX
            return pd.DataFrame({
                'adx': [None] * len(df),
                'di_plus': [None] * len(df),
                'di_minus': [None] * len(df)
            }, index=df.index)
        
        # Calculate directional movement
        high_diff = df['high'].diff()
        low_diff = df['low'].diff()
        
        # Directional Movement calculation
        dm_plus = pd.Series(0.0, index=df.index)
        dm_minus = pd.Series(0.0, index=df.index)
        
        # Calculate DM+ and DM-
        for i in range(1, len(df)):
            high_move = high_diff.iloc[i]
            low_move = -low_diff.iloc[i]  # Make positive for downward movement
            
            if high_move > low_move and high_move > 0:
                dm_plus.iloc[i] = high_move
            elif low_move > high_move and low_move > 0:
                dm_minus.iloc[i] = low_move
        
        # Calculate True Range
        tr_series = pd.Series(0.0, index=df.index)
        for i in range(1, len(df)):
            tr = max(
                df['high'].iloc[i] - df['low'].iloc[i],
                abs(df['high'].iloc[i] - df['close'].iloc[i-1]),
                abs(df['low'].iloc[i] - df['close'].iloc[i-1])
            )
            tr_series.iloc[i] = tr
        
        # Set first TR value to high-low
        tr_series.iloc[0] = df['high'].iloc[0] - df['low'].iloc[0]
        
        # Smooth the values using Wilder's smoothing (exponential moving average)
        period = 14
        alpha = 1.0 / period
        
        # Initialize smoothed values
        tr_smooth = tr_series.ewm(alpha=alpha, adjust=False).mean()
        dm_plus_smooth = dm_plus.ewm(alpha=alpha, adjust=False).mean()
        dm_minus_smooth = dm_minus.ewm(alpha=alpha, adjust=False).mean()
        
        # Calculate DI+ and DI- (avoid division by zero)
        di_plus = pd.Series(0.0, index=df.index)
        di_minus = pd.Series(0.0, index=df.index)
        
        valid_tr = tr_smooth > 0
        di_plus[valid_tr] = 100 * (dm_plus_smooth[valid_tr] / tr_smooth[valid_tr])
        di_minus[valid_tr] = 100 * (dm_minus_smooth[valid_tr] / tr_smooth[valid_tr])
        
        # Calculate DX and ADX
        dx = pd.Series(0.0, index=df.index)
        di_sum = di_plus + di_minus
        
        valid_di = di_sum > 0
        dx[valid_di] = 100 * abs(di_plus[valid_di] - di_minus[valid_di]) / di_sum[valid_di]
        
        # Calculate ADX using Wilder's smoothing
        adx = dx.ewm(alpha=alpha, adjust=False).mean()
        
        return pd.DataFrame({
            'adx': adx,
            'di_plus': di_plus,
            'di_minus': di_minus
        })
    
    def calculate_bb_width_percentile(
        self, 
        bb_widths: List[float], 
        current_width: float,
        lookback_periods: Optional[int] = None
    ) -> float:
        """
        Calculate the percentile of current BB width vs historical values.
        
        Args:
            bb_widths: List of historical BB width values
            current_width: Current BB width value
            lookback_periods: Number of periods to look back
            
        Returns:
            Percentile value (0-100)
        """
        if lookback_periods is None:
            lookback_periods = self.settings.squeeze_lookback
        
        # Use only the specified lookback period
        if len(bb_widths) > lookback_periods:
            historical_widths = bb_widths[-lookback_periods:]
        else:
            historical_widths = bb_widths
        
        if not historical_widths:
            return 50.0  # Default to median if no historical data
        
        # Calculate percentile
        historical_array = np.array(historical_widths)
        percentile = (np.sum(historical_array <= current_width) / len(historical_array)) * 100
        
        return percentile
    
    def detect_squeeze_condition(
        self,
        bb_width: float,
        bb_width_percentile: float,
        adx: Optional[float] = None
    ) -> bool:
        """
        Detect if squeeze condition is met.
        
        Args:
            bb_width: Current Bollinger Bands width
            bb_width_percentile: BB width percentile vs historical
            
        Returns:
            True if squeeze condition is detected
        """
        if adx is not None:
            if adx < 20:
                effective_threshold = 20.0
            elif adx > 30:
                effective_threshold = 5.0
            else:
                effective_threshold = self.settings.squeeze_percentile
        else:
            effective_threshold = self.settings.squeeze_percentile
        return bb_width_percentile <= effective_threshold
    
    def detect_expansion_condition(
        self,
        current_bb_width: float,
        previous_bb_width: float,
        current_true_range: float,
        atr_20: float
    ) -> Tuple[bool, float, float]:
        """
        Detect if expansion condition is met with enhanced confirmation rules.
        
        Args:
            current_bb_width: Current BB width
            previous_bb_width: Previous day's BB width
            current_true_range: Current day's true range
            atr_20: 20-day ATR
            
        Returns:
            Tuple of (is_expansion, bb_width_change_pct, range_vs_atr)
        """
        # Calculate BB width change percentage
        if previous_bb_width > 0:
            bb_width_change = (current_bb_width - previous_bb_width) / previous_bb_width
        else:
            bb_width_change = 0.0
        
        # Calculate range vs ATR ratio
        if atr_20 > 0:
            range_vs_atr = current_true_range / atr_20
        else:
            range_vs_atr = 0.0
        
        # Enhanced expansion conditions per feedback:
        # For is_expansion = true, also require bb_width_change > 0 and above-avg volume
        # (volume check will be done in analysis service)
        width_expansion = bb_width_change > 0  # Must be positive (widening)
        range_expansion = range_vs_atr >= self.settings.range_multiplier
        
        # Basic expansion detection - additional volume/positioning checks in analysis service
        is_expansion = width_expansion and range_expansion
        
        return is_expansion, bb_width_change * 100, range_vs_atr
    
    def calculate_trend_direction(
        self,
        ema_short: float,
        ema_long: float
    ) -> str:
        """
        Calculate trend direction based on EMA relationship.
        
        Args:
            ema_short: Short-period EMA value
            ema_long: Long-period EMA value
            
        Returns:
            Trend direction: 'bullish', 'bearish', or 'neutral'
        """
        if ema_short > ema_long:
            return "bullish"
        elif ema_short < ema_long:
            return "bearish"
        else:
            return "neutral"
