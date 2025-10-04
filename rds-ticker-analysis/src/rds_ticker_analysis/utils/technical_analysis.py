"""Technical analysis utilities for market data."""

import numpy as np
import pandas as pd
from loguru import logger
from typing import Dict, Optional


class TechnicalAnalyzer:
    """
    Technical analysis calculator for market data.
    
    Provides calculations for:
    - Moving averages (SMA, EMA)
    - Bollinger Bands
    - RSI, MACD, Stochastic
    - ATR and volatility measures
    - Support/resistance levels
    - Trend analysis
    """
    
    def __init__(self) -> None:
        logger.debug("Initialized TechnicalAnalyzer")
    
    def calculate_all_indicators(self, hist_data: pd.DataFrame) -> Dict[str, any]:
        """
        Calculate all technical indicators for price history.
        
        Args:
            hist_data: DataFrame with OHLCV data
            
        Returns:
            Dictionary with calculated indicators
        """
        indicators = {}
        
        try:
            # Moving averages
            indicators.update(self._calculate_moving_averages(hist_data))
            
            # Bollinger Bands
            indicators.update(self._calculate_bollinger_bands(hist_data))
            
            # ATR and volatility
            indicators.update(self._calculate_volatility_indicators(hist_data))
            
            # Momentum oscillators
            indicators.update(self._calculate_momentum_indicators(hist_data))
            
            # MACD
            indicators.update(self._calculate_macd(hist_data))
            
            # Volume indicators
            indicators.update(self._calculate_volume_indicators(hist_data))
            
            # Trend indicators
            indicators.update(self._calculate_trend_indicators(hist_data))
            
            # Support/Resistance
            indicators.update(self._calculate_support_resistance(hist_data))
            
        except Exception as e:
            logger.warning(f"Error calculating technical indicators: {e}")
        
        return indicators
    
    def _calculate_moving_averages(self, hist_data: pd.DataFrame) -> Dict[str, float]:
        """Calculate various moving averages."""
        indicators = {}
        closes = hist_data['Close']
        
        try:
            # Simple Moving Averages
            if len(closes) >= 20:
                indicators['sma_20'] = closes.rolling(20).mean().iloc[-1]
            if len(closes) >= 50:
                indicators['sma_50'] = closes.rolling(50).mean().iloc[-1]
            if len(closes) >= 200:
                indicators['sma_200'] = closes.rolling(200).mean().iloc[-1]
            
            # Exponential Moving Averages
            if len(closes) >= 12:
                indicators['ema_12'] = closes.ewm(span=12).mean().iloc[-1]
            if len(closes) >= 26:
                indicators['ema_26'] = closes.ewm(span=26).mean().iloc[-1]
                
        except Exception as e:
            logger.warning(f"Error calculating moving averages: {e}")
        
        return indicators
    
    def _calculate_bollinger_bands(self, hist_data: pd.DataFrame, period: int = 20, std_dev: float = 2.0) -> Dict[str, float]:
        """Calculate Bollinger Bands."""
        indicators = {}
        closes = hist_data['Close']
        
        try:
            if len(closes) >= period:
                # Calculate middle band (SMA)
                middle = closes.rolling(period).mean()
                
                # Calculate standard deviation
                std = closes.rolling(period).std()
                
                # Calculate bands
                upper = middle + (std * std_dev)
                lower = middle - (std * std_dev)
                
                # Get latest values
                indicators['bb_upper'] = upper.iloc[-1]
                indicators['bb_middle'] = middle.iloc[-1]
                indicators['bb_lower'] = lower.iloc[-1]
                
                # Calculate band width and position
                indicators['bb_width'] = (upper.iloc[-1] - lower.iloc[-1]) / middle.iloc[-1] * 100
                
                # Calculate %B (position within bands)
                current_price = closes.iloc[-1]
                indicators['bb_percent'] = (current_price - lower.iloc[-1]) / (upper.iloc[-1] - lower.iloc[-1]) * 100
                
        except Exception as e:
            logger.warning(f"Error calculating Bollinger Bands: {e}")
        
        return indicators
    
    def _calculate_volatility_indicators(self, hist_data: pd.DataFrame) -> Dict[str, float]:
        """Calculate volatility indicators."""
        indicators = {}
        
        try:
            # Calculate True Range
            high = hist_data['High']
            low = hist_data['Low']
            close = hist_data['Close'].shift(1)
            
            tr1 = high - low
            tr2 = abs(high - close)
            tr3 = abs(low - close)
            
            true_range = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
            
            # Average True Range (ATR)
            if len(true_range) >= 14:
                indicators['atr_14'] = true_range.rolling(14).mean().iloc[-1]
            if len(true_range) >= 20:
                indicators['atr_20'] = true_range.rolling(20).mean().iloc[-1]
            
            # 20-day price volatility
            if len(hist_data) >= 20:
                returns = hist_data['Close'].pct_change()
                indicators['volatility_20d'] = returns.rolling(20).std().iloc[-1] * np.sqrt(252) * 100  # Annualized
                
        except Exception as e:
            logger.warning(f"Error calculating volatility indicators: {e}")
        
        return indicators
    
    def _calculate_momentum_indicators(self, hist_data: pd.DataFrame) -> Dict[str, float]:
        """Calculate momentum oscillators."""
        indicators = {}
        closes = hist_data['Close']
        highs = hist_data['High']
        lows = hist_data['Low']
        
        try:
            # RSI (14-period)
            if len(closes) >= 15:  # Need 15 periods for 14-period RSI
                delta = closes.diff()
                gain = (delta.where(delta > 0, 0)).rolling(14).mean()
                loss = (-delta.where(delta < 0, 0)).rolling(14).mean()
                rs = gain / loss
                rsi = 100 - (100 / (1 + rs))
                indicators['rsi_14'] = rsi.iloc[-1]
            
            # Stochastic Oscillator (14-period)
            if len(hist_data) >= 14:
                lowest_low = lows.rolling(14).min()
                highest_high = highs.rolling(14).max()
                
                k_percent = 100 * ((closes - lowest_low) / (highest_high - lowest_low))
                indicators['stoch_k'] = k_percent.iloc[-1]
                
                # %D is 3-period SMA of %K
                if len(k_percent) >= 3:
                    d_percent = k_percent.rolling(3).mean()
                    indicators['stoch_d'] = d_percent.iloc[-1]
                    
        except Exception as e:
            logger.warning(f"Error calculating momentum indicators: {e}")
        
        return indicators
    
    def _calculate_macd(self, hist_data: pd.DataFrame) -> Dict[str, float]:
        """Calculate MACD indicator."""
        indicators = {}
        closes = hist_data['Close']
        
        try:
            if len(closes) >= 26:
                # Calculate EMAs
                ema_12 = closes.ewm(span=12).mean()
                ema_26 = closes.ewm(span=26).mean()
                
                # MACD line
                macd_line = ema_12 - ema_26
                indicators['macd_line'] = macd_line.iloc[-1]
                
                # Signal line (9-period EMA of MACD)
                if len(macd_line) >= 9:
                    signal_line = macd_line.ewm(span=9).mean()
                    indicators['macd_signal'] = signal_line.iloc[-1]
                    
                    # MACD histogram
                    histogram = macd_line - signal_line
                    indicators['macd_histogram'] = histogram.iloc[-1]
                    
        except Exception as e:
            logger.warning(f"Error calculating MACD: {e}")
        
        return indicators
    
    def _calculate_volume_indicators(self, hist_data: pd.DataFrame) -> Dict[str, any]:
        """Calculate volume-based indicators."""
        indicators = {}
        volumes = hist_data['Volume']
        
        try:
            # Volume SMA
            if len(volumes) >= 20:
                volume_sma_20 = volumes.rolling(20).mean()
                indicators['volume_sma_20'] = int(volume_sma_20.iloc[-1])
                
                # Current volume vs average
                current_volume = volumes.iloc[-1]
                indicators['volume_ratio'] = current_volume / volume_sma_20.iloc[-1]
                
        except Exception as e:
            logger.warning(f"Error calculating volume indicators: {e}")
        
        return indicators
    
    def _calculate_trend_indicators(self, hist_data: pd.DataFrame) -> Dict[str, any]:
        """Calculate trend-based indicators."""
        indicators = {}
        highs = hist_data['High']
        lows = hist_data['Low']
        closes = hist_data['Close']
        
        try:
            # ADX (Average Directional Index) - simplified calculation
            if len(hist_data) >= 14:
                # Calculate directional movement
                dm_plus = highs.diff()
                dm_minus = lows.diff() * -1
                
                # Only keep positive movements
                dm_plus = dm_plus.where(dm_plus > dm_minus, 0)
                dm_minus = dm_minus.where(dm_minus > dm_plus, 0)
                
                # Calculate True Range (already calculated in volatility)
                high = hist_data['High']
                low = hist_data['Low']
                close_prev = hist_data['Close'].shift(1)
                
                tr1 = high - low
                tr2 = abs(high - close_prev)
                tr3 = abs(low - close_prev)
                true_range = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
                
                # Smooth the values
                tr_smooth = true_range.rolling(14).mean()
                dm_plus_smooth = dm_plus.rolling(14).mean()
                dm_minus_smooth = dm_minus.rolling(14).mean()
                
                # Calculate DI+ and DI-
                di_plus = 100 * dm_plus_smooth / tr_smooth
                di_minus = 100 * dm_minus_smooth / tr_smooth
                
                indicators['di_plus'] = di_plus.iloc[-1]
                indicators['di_minus'] = di_minus.iloc[-1]
                
                # Calculate ADX
                dx = 100 * abs(di_plus - di_minus) / (di_plus + di_minus)
                adx = dx.rolling(14).mean()
                indicators['adx_14'] = adx.iloc[-1]
            
            # Simple trend direction based on moving averages
            if len(closes) >= 20:
                sma_20 = closes.rolling(20).mean()
                current_price = closes.iloc[-1]
                sma_20_current = sma_20.iloc[-1]
                
                # Calculate trend strength
                price_above_ma = current_price > sma_20_current
                ma_slope = (sma_20.iloc[-1] - sma_20.iloc[-5]) / sma_20.iloc[-5] if len(sma_20) >= 5 else 0
                
                # Determine trend direction
                if price_above_ma and ma_slope > 0.02:
                    indicators['trend_direction'] = 'strong_bullish'
                    indicators['trend_strength'] = min(1.0, abs(ma_slope) * 10)
                elif price_above_ma and ma_slope > 0:
                    indicators['trend_direction'] = 'bullish'
                    indicators['trend_strength'] = min(1.0, abs(ma_slope) * 10)
                elif not price_above_ma and ma_slope < -0.02:
                    indicators['trend_direction'] = 'strong_bearish'
                    indicators['trend_strength'] = min(1.0, abs(ma_slope) * 10)
                elif not price_above_ma and ma_slope < 0:
                    indicators['trend_direction'] = 'bearish'
                    indicators['trend_strength'] = min(1.0, abs(ma_slope) * 10)
                else:
                    indicators['trend_direction'] = 'sideways'
                    indicators['trend_strength'] = 0.3
                    
        except Exception as e:
            logger.warning(f"Error calculating trend indicators: {e}")
        
        return indicators
    
    def _calculate_support_resistance(self, hist_data: pd.DataFrame, lookback: int = 20) -> Dict[str, float]:
        """Calculate support and resistance levels."""
        indicators = {}
        
        try:
            if len(hist_data) >= lookback:
                # Simple support/resistance based on recent highs/lows
                recent_data = hist_data.tail(lookback)
                
                # Support: lowest low in lookback period
                indicators['support_level'] = recent_data['Low'].min()
                
                # Resistance: highest high in lookback period
                indicators['resistance_level'] = recent_data['High'].max()
                
        except Exception as e:
            logger.warning(f"Error calculating support/resistance: {e}")
        
        return indicators
    
    def calculate_volatility_squeeze(self, hist_data: pd.DataFrame) -> Dict[str, any]:
        """
        Calculate volatility squeeze indicators (Bollinger Bands vs Keltner Channels).
        
        Args:
            hist_data: DataFrame with OHLCV data
            
        Returns:
            Dictionary with squeeze indicators
        """
        squeeze_data = {}
        
        try:
            if len(hist_data) >= 20:
                closes = hist_data['Close']
                highs = hist_data['High']
                lows = hist_data['Low']
                
                # Bollinger Bands (20, 2)
                bb_middle = closes.rolling(20).mean()
                bb_std = closes.rolling(20).std()
                bb_upper = bb_middle + (bb_std * 2)
                bb_lower = bb_middle - (bb_std * 2)
                
                # Keltner Channels (20, 1.5)
                kc_middle = closes.rolling(20).mean()
                
                # Calculate True Range for Keltner Channels
                tr1 = highs - lows
                tr2 = abs(highs - closes.shift(1))
                tr3 = abs(lows - closes.shift(1))
                true_range = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
                atr = true_range.rolling(20).mean()
                
                kc_upper = kc_middle + (atr * 1.5)
                kc_lower = kc_middle - (atr * 1.5)
                
                # Check if squeeze condition is met (BB inside KC)
                squeeze_condition = (bb_upper <= kc_upper) & (bb_lower >= kc_lower)
                
                # Bollinger Band width percentile
                bb_width = (bb_upper - bb_lower) / bb_middle * 100
                bb_width_percentile = (bb_width.iloc[-1] <= bb_width.quantile(0.2)) * 100
                
                squeeze_data = {
                    'bb_upper': bb_upper.iloc[-1],
                    'bb_middle': bb_middle.iloc[-1],
                    'bb_lower': bb_lower.iloc[-1],
                    'kc_upper': kc_upper.iloc[-1],
                    'kc_middle': kc_middle.iloc[-1],
                    'kc_lower': kc_lower.iloc[-1],
                    'bb_width': bb_width.iloc[-1],
                    'bb_width_percentile': bb_width_percentile,
                    'is_squeeze': squeeze_condition.iloc[-1],
                    'atr_20': atr.iloc[-1],
                }
                
        except Exception as e:
            logger.warning(f"Error calculating volatility squeeze: {e}")
        
        return squeeze_data
