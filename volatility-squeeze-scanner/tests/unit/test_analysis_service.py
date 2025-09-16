"""Unit tests for analysis service."""

import pytest
from unittest.mock import AsyncMock, patch

from volatility_scanner.services.analysis_service import AnalysisService
from volatility_scanner.models.market_data import MarketData
from volatility_scanner.models.analysis import TrendDirection
from volatility_scanner.config.settings import Settings


class TestAnalysisService:
    """Test analysis service functionality."""
    
    @pytest.mark.asyncio
    async def test_analyze_symbol_with_signal(
        self, 
        test_settings: Settings, 
        sample_market_data: MarketData
    ):
        """Test symbol analysis with a valid signal."""
        analysis_service = AnalysisService(test_settings)
        
        # Calculate indicators first
        sample_market_data = (
            analysis_service.indicator_calculator
            .calculate_all_indicators(sample_market_data)
        )
        
        # Analyze the symbol
        result = await analysis_service.analyze_symbol(
            sample_market_data,
            include_ai_analysis=False
        )
        
        # Check result structure
        if result:  # May be None if no signal detected
            assert result.symbol == "TEST"
            assert result.squeeze_signal is not None
            assert result.overall_score >= 0.0
            assert result.overall_score <= 1.0
            assert result.recommendation in ["BUY", "SELL", "HOLD", "WATCH"]
            assert result.analysis_duration_ms > 0
            assert result.data_quality_score >= 0.0
            assert result.data_quality_score <= 1.0
    
    @pytest.mark.asyncio
    async def test_analyze_symbol_insufficient_data(self, test_settings: Settings):
        """Test analysis with insufficient data."""
        analysis_service = AnalysisService(test_settings)
        
        # Create market data with minimal OHLCV data
        minimal_data = MarketData(
            symbol="MINIMAL",
            ohlcv_data=[],  # Empty data
            indicators=[],
            data_start=None,
            data_end=None,
            last_updated=None
        )
        
        # Should return None for insufficient data
        result = await analysis_service.analyze_symbol(minimal_data)
        assert result is None
    
    def test_calculate_signal_strength(self, test_settings: Settings):
        """Test signal strength calculation."""
        analysis_service = AnalysisService(test_settings)
        
        # Test high strength signal
        strength = analysis_service._calculate_signal_strength(
            is_squeeze=True,
            is_expansion=True,
            bb_width_percentile=5.0,  # Very tight squeeze
            range_vs_atr=2.0,  # Strong range expansion
            volume_ratio=2.5   # High volume
        )
        
        assert strength > 0.8  # Should be high strength
        
        # Test low strength signal
        strength = analysis_service._calculate_signal_strength(
            is_squeeze=False,
            is_expansion=False,
            bb_width_percentile=50.0,  # No squeeze
            range_vs_atr=0.5,   # Weak range
            volume_ratio=0.8    # Low volume
        )
        
        assert strength < 0.3  # Should be low strength
    
    def test_generate_recommendation(self, test_settings: Settings):
        """Test recommendation generation."""
        analysis_service = AnalysisService(test_settings)
        
        # Mock squeeze signal
        class MockSqueezeSignal:
            trend_direction = TrendDirection.BULLISH
        
        squeeze_signal = MockSqueezeSignal()
        
        # Test high score recommendation
        rec = analysis_service._generate_recommendation(squeeze_signal, 0.85)
        assert rec == "BUY"
        
        # Test medium score recommendation
        rec = analysis_service._generate_recommendation(squeeze_signal, 0.65)
        assert rec == "WATCH"
        
        # Test low score recommendation
        rec = analysis_service._generate_recommendation(squeeze_signal, 0.45)
        assert rec == "HOLD"
    
    def test_calculate_technical_score(self, test_settings: Settings):
        """Test technical score calculation."""
        analysis_service = AnalysisService(test_settings)
        
        # Mock squeeze signal with bullish trend
        class MockSqueezeSignal:
            signal_strength = 0.7
            trend_direction = TrendDirection.BULLISH
            volume_ratio = 2.0
            price_vs_20d_high = -2.0  # Near highs
            price_vs_20d_low = 15.0
        
        squeeze_signal = MockSqueezeSignal()
        
        score = analysis_service._calculate_technical_score(squeeze_signal)
        
        # Should get bonuses for bullish trend, high volume, near highs
        assert score > 0.7
        assert score <= 1.0
    
    def test_calculate_stop_loss(self, test_settings: Settings):
        """Test stop loss calculation."""
        analysis_service = AnalysisService(test_settings)
        
        # Mock indicators and squeeze signal
        class MockIndicators:
            atr = 2.0
        
        class MockSqueezeSignal:
            close_price = 100.0
            trend_direction = TrendDirection.BULLISH
        
        indicators = MockIndicators()
        squeeze_signal = MockSqueezeSignal()
        
        stop_loss = analysis_service._calculate_stop_loss(squeeze_signal, indicators)
        
        # For bullish trend, stop loss should be below current price
        assert stop_loss < squeeze_signal.close_price
        assert stop_loss == 100.0 - (2.0 * 1.5)  # price - (ATR * 1.5)
    
    def test_calculate_position_size(self, test_settings: Settings):
        """Test position size calculation."""
        analysis_service = AnalysisService(test_settings)
        
        # Test high confidence position size
        size = analysis_service._calculate_position_size(0.85)
        assert size == 0.05  # 5%
        
        # Test medium confidence position size
        size = analysis_service._calculate_position_size(0.65)
        assert size == 0.03  # 3%
        
        # Test low confidence position size
        size = analysis_service._calculate_position_size(0.45)
        assert size == 0.01  # 1%
    
    def test_assess_data_quality(self, test_settings: Settings, sample_market_data: MarketData):
        """Test data quality assessment."""
        analysis_service = AnalysisService(test_settings)
        
        # Calculate indicators to populate the data
        sample_market_data = (
            analysis_service.indicator_calculator
            .calculate_all_indicators(sample_market_data)
        )
        
        quality_score = analysis_service._assess_data_quality(sample_market_data)
        
        # Should have good quality score for complete sample data
        assert quality_score >= 0.5
        assert quality_score <= 1.0
