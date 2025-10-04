"""Unit tests for the scoring service."""

import pytest
from decimal import Decimal

from rds_ticker_analysis.models.analysis import OpportunityGrade, RiskLevel, SignalStrength
from rds_ticker_analysis.services.scoring import ScoringService


class TestScoringService:
    """Test cases for ScoringService."""
    
    def test_initialization_with_default_weights(self):
        """Test service initialization with default weights."""
        service = ScoringService()
        
        expected_weights = {
            'sentiment': 0.25,
            'volume': 0.20,
            'quality': 0.20,
            'momentum': 0.15,
            'technical': 0.15,
            'fundamental': 0.05,
        }
        
        assert service.weights == expected_weights
    
    def test_initialization_with_custom_weights(self):
        """Test service initialization with custom weights."""
        service = ScoringService(
            sentiment_weight=0.30,
            volume_weight=0.25,
            quality_weight=0.20,
            momentum_weight=0.10,
            technical_weight=0.10,
            fundamental_weight=0.05,
        )
        
        expected_weights = {
            'sentiment': 0.30,
            'volume': 0.25,
            'quality': 0.20,
            'momentum': 0.10,
            'technical': 0.10,
            'fundamental': 0.05,
        }
        
        assert service.weights == expected_weights
    
    def test_invalid_weights_sum(self):
        """Test that invalid weight sums raise ValueError."""
        with pytest.raises(ValueError, match="Weights must sum to 1.0"):
            ScoringService(
                sentiment_weight=0.50,
                volume_weight=0.50,  # Total = 1.0 but other weights default to non-zero
                quality_weight=0.20,
                momentum_weight=0.15,
                technical_weight=0.15,
                fundamental_weight=0.05,
            )
    
    def test_calculate_opportunity_score(
        self,
        scoring_service,
        sample_sentiment_analysis,
        sample_reddit_metrics,
        sample_market_data,
    ):
        """Test opportunity score calculation."""
        sentiment_analyses = [sample_sentiment_analysis]
        
        score = scoring_service.calculate_opportunity_score(
            sentiment_analyses=sentiment_analyses,
            reddit_metrics=sample_reddit_metrics,
            market_data=sample_market_data,
        )
        
        # Verify score structure
        assert isinstance(score.overall_score, Decimal)
        assert 0 <= float(score.overall_score) <= 1
        assert isinstance(score.opportunity_grade, OpportunityGrade)
        assert isinstance(score.signal_strength, SignalStrength)
        
        # Verify component scores are within range
        assert 0 <= float(score.sentiment_score) <= 1
        assert 0 <= float(score.volume_score) <= 1
        assert 0 <= float(score.quality_score) <= 1
        assert 0 <= float(score.momentum_score) <= 1
        assert 0 <= float(score.technical_score) <= 1
        assert 0 <= float(score.fundamental_score) <= 1
        
        # Verify weights are preserved
        expected_weights = scoring_service.weights
        actual_weights = {k: float(v) for k, v in score.weights.items()}
        assert actual_weights == expected_weights
    
    def test_calculate_risk_assessment(
        self,
        scoring_service,
        sample_sentiment_analysis,
        sample_reddit_metrics,
        sample_market_data,
    ):
        """Test risk assessment calculation."""
        sentiment_analyses = [sample_sentiment_analysis]
        
        risk = scoring_service.calculate_risk_assessment(
            sentiment_analyses=sentiment_analyses,
            reddit_metrics=sample_reddit_metrics,
            market_data=sample_market_data,
        )
        
        # Verify risk structure
        assert isinstance(risk.overall_risk_score, Decimal)
        assert 0 <= float(risk.overall_risk_score) <= 1
        assert isinstance(risk.risk_level, RiskLevel)
        
        # Verify component risks are within range
        assert 0 <= float(risk.market_risk) <= 1
        assert 0 <= float(risk.liquidity_risk) <= 1
        assert 0 <= float(risk.volatility_risk) <= 1
        assert 0 <= float(risk.sentiment_risk) <= 1
        assert 0 <= float(risk.manipulation_risk) <= 1
        
        # Verify position sizing recommendations
        assert 0 < float(risk.max_position_size_pct) <= 100
        assert 0 < float(risk.recommended_stop_loss_pct) <= 100
        
        # Verify risk factors and suggestions are lists
        assert isinstance(risk.key_risk_factors, list)
        assert isinstance(risk.risk_mitigation_suggestions, list)
    
    def test_sentiment_score_calculation_empty_analyses(self, scoring_service):
        """Test sentiment score calculation with empty analyses."""
        score = scoring_service._calculate_sentiment_score([])
        assert score == 0.0
    
    def test_sentiment_score_calculation_bullish(
        self, 
        scoring_service, 
        sample_sentiment_analysis
    ):
        """Test sentiment score calculation with bullish sentiment."""
        # Sample analysis is bullish
        score = scoring_service._calculate_sentiment_score([sample_sentiment_analysis])
        
        # Should be above neutral (0.5) for bullish sentiment
        assert score > 0.5
        assert score <= 1.0
    
    def test_volume_score_calculation(self, scoring_service, sample_reddit_metrics):
        """Test volume score calculation."""
        score = scoring_service._calculate_volume_score(sample_reddit_metrics)
        
        assert 0 <= score <= 1
        # Should be positive for non-zero metrics
        assert score > 0
    
    def test_grade_determination(self, scoring_service):
        """Test opportunity grade determination."""
        test_cases = [
            (0.95, OpportunityGrade.S_TIER),
            (0.85, OpportunityGrade.A_TIER),
            (0.75, OpportunityGrade.B_TIER),
            (0.65, OpportunityGrade.C_TIER),
            (0.55, OpportunityGrade.D_TIER),
            (0.45, OpportunityGrade.F_TIER),
        ]
        
        for score, expected_grade in test_cases:
            grade = scoring_service._determine_grade(score)
            assert grade == expected_grade
    
    def test_risk_level_determination(self, scoring_service):
        """Test risk level determination."""
        test_cases = [
            (0.9, RiskLevel.VERY_HIGH),
            (0.7, RiskLevel.HIGH),
            (0.5, RiskLevel.MODERATE),
            (0.3, RiskLevel.LOW),
            (0.1, RiskLevel.VERY_LOW),
        ]
        
        for risk_score, expected_level in test_cases:
            level = scoring_service._determine_risk_level(risk_score)
            assert level == expected_level
    
    def test_signal_strength_determination(self, scoring_service):
        """Test signal strength determination."""
        test_cases = [
            (0.9, 0.9, SignalStrength.VERY_STRONG),
            (0.8, 0.7, SignalStrength.STRONG),
            (0.6, 0.6, SignalStrength.MODERATE),
            (0.5, 0.4, SignalStrength.WEAK),
            (0.3, 0.3, SignalStrength.VERY_WEAK),
        ]
        
        for overall_score, reddit_score, expected_strength in test_cases:
            strength = scoring_service._determine_signal_strength(overall_score, reddit_score)
            assert strength == expected_strength
