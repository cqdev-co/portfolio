"""Unit tests for technical indicators."""

import pytest
import pandas as pd
from datetime import datetime

from volatility_scanner.utils.technical_indicators import TechnicalIndicatorCalculator
from volatility_scanner.models.market_data import MarketData
from volatility_scanner.config.settings import Settings


class TestTechnicalIndicatorCalculator:
    """Test technical indicator calculations."""
    
    def test_calculate_bollinger_bands(self, test_settings: Settings, sample_market_data: MarketData):
        """Test Bollinger Bands calculation."""
        calculator = TechnicalIndicatorCalculator(test_settings)
        
        # Calculate indicators
        result = calculator.calculate_all_indicators(sample_market_data)
        
        # Check that indicators were calculated
        assert len(result.indicators) == len(sample_market_data.ohlcv_data)
        
        # Check that BB values are present for later periods
        later_indicators = [ind for ind in result.indicators[-20:] if ind.bb_width is not None]
        assert len(later_indicators) > 0
        
        # Check BB width is positive
        for indicator in later_indicators:
            assert indicator.bb_width > 0
            assert indicator.bb_upper > indicator.bb_middle
            assert indicator.bb_middle > indicator.bb_lower
    
    def test_calculate_atr(self, test_settings: Settings, sample_market_data: MarketData):
        """Test ATR calculation."""
        calculator = TechnicalIndicatorCalculator(test_settings)
        
        # Convert to DataFrame for direct testing
        df = sample_market_data.to_dataframe()
        atr_series = calculator._calculate_atr(df)
        
        # Check ATR values
        atr_values = atr_series.dropna()
        assert len(atr_values) > 0
        
        # ATR should be positive
        assert all(atr > 0 for atr in atr_values)
    
    def test_detect_squeeze_condition(self, test_settings: Settings):
        """Test squeeze condition detection."""
        calculator = TechnicalIndicatorCalculator(test_settings)
        
        # Test squeeze condition (low percentile)
        is_squeeze = calculator.detect_squeeze_condition(
            bb_width=0.02,
            bb_width_percentile=5.0  # Low percentile = squeeze
        )
        assert is_squeeze
        
        # Test no squeeze condition (high percentile)
        is_squeeze = calculator.detect_squeeze_condition(
            bb_width=0.08,
            bb_width_percentile=50.0  # High percentile = no squeeze
        )
        assert not is_squeeze
    
    def test_detect_expansion_condition(self, test_settings: Settings):
        """Test expansion condition detection."""
        calculator = TechnicalIndicatorCalculator(test_settings)
        
        # Test expansion condition
        is_expansion, bb_change, range_ratio = calculator.detect_expansion_condition(
            current_bb_width=0.06,
            previous_bb_width=0.04,  # 50% increase
            current_true_range=2.0,
            atr_20=1.5  # 1.33x ATR
        )
        
        assert is_expansion
        assert bb_change == 50.0  # 50% change
        assert range_ratio > 1.0
    
    def test_calculate_trend_direction(self, test_settings: Settings):
        """Test trend direction calculation."""
        calculator = TechnicalIndicatorCalculator(test_settings)
        
        # Test bullish trend
        trend = calculator.calculate_trend_direction(ema_short=105.0, ema_long=100.0)
        assert trend == "bullish"
        
        # Test bearish trend
        trend = calculator.calculate_trend_direction(ema_short=95.0, ema_long=100.0)
        assert trend == "bearish"
        
        # Test neutral trend
        trend = calculator.calculate_trend_direction(ema_short=100.0, ema_long=100.0)
        assert trend == "neutral"
    
    def test_bb_width_percentile_calculation(self, test_settings: Settings):
        """Test BB width percentile calculation."""
        calculator = TechnicalIndicatorCalculator(test_settings)
        
        # Create sample BB width history
        bb_widths = [0.02, 0.03, 0.04, 0.05, 0.06, 0.07, 0.08, 0.09, 0.10, 0.11]
        
        # Test percentile calculation
        percentile = calculator.calculate_bb_width_percentile(bb_widths, 0.05)
        assert 30 <= percentile <= 40  # Should be around 30-40th percentile
        
        # Test with very low value
        percentile = calculator.calculate_bb_width_percentile(bb_widths, 0.01)
        assert percentile == 0.0  # Should be 0th percentile
        
        # Test with very high value
        percentile = calculator.calculate_bb_width_percentile(bb_widths, 0.15)
        assert percentile == 100.0  # Should be 100th percentile
