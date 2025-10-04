"""Analysis and scoring models."""

from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Dict, List, Optional

from pydantic import BaseModel, Field, validator

from rds_ticker_analysis.models.base import BaseEntity, DataQuality, RedditMetrics


class OpportunityGrade(str, Enum):
    """Opportunity grade classifications."""
    S_TIER = "S"  # Exceptional (>0.90)
    A_TIER = "A"  # Excellent (0.80-0.90)
    B_TIER = "B"  # Good (0.70-0.80)
    C_TIER = "C"  # Fair (0.60-0.70)
    D_TIER = "D"  # Poor (0.50-0.60)
    F_TIER = "F"  # Very Poor (<0.50)


class RiskLevel(str, Enum):
    """Risk level classifications."""
    VERY_LOW = "very_low"
    LOW = "low"
    MODERATE = "moderate"
    HIGH = "high"
    VERY_HIGH = "very_high"


class SignalStrength(str, Enum):
    """Signal strength classifications."""
    VERY_STRONG = "very_strong"
    STRONG = "strong"
    MODERATE = "moderate"
    WEAK = "weak"
    VERY_WEAK = "very_weak"


class OpportunityScore(BaseModel):
    """Detailed scoring breakdown for a ticker opportunity."""
    
    # Component scores (0-1)
    sentiment_score: Decimal = Field(
        ge=0,
        le=1,
        description="Aggregated sentiment score"
    )
    volume_score: Decimal = Field(
        ge=0,
        le=1,
        description="Reddit activity volume score"
    )
    quality_score: Decimal = Field(
        ge=0,
        le=1,
        description="Content quality score"
    )
    momentum_score: Decimal = Field(
        ge=0,
        le=1,
        description="Recent momentum score"
    )
    technical_score: Decimal = Field(
        ge=0,
        le=1,
        description="Technical analysis score"
    )
    fundamental_score: Decimal = Field(
        ge=0,
        le=1,
        description="Fundamental analysis score"
    )
    
    # Composite scores
    reddit_composite_score: Decimal = Field(
        ge=0,
        le=1,
        description="Combined Reddit-based score"
    )
    market_composite_score: Decimal = Field(
        ge=0,
        le=1,
        description="Combined market-based score"
    )
    overall_score: Decimal = Field(
        ge=0,
        le=1,
        description="Overall opportunity score"
    )
    
    # Grade and classification
    opportunity_grade: OpportunityGrade = Field(
        description="Letter grade classification"
    )
    signal_strength: SignalStrength = Field(
        description="Signal strength classification"
    )
    
    # Confidence and reliability
    score_confidence: Decimal = Field(
        ge=0,
        le=1,
        description="Confidence in scoring accuracy"
    )
    data_reliability: Decimal = Field(
        ge=0,
        le=1,
        description="Reliability of underlying data"
    )
    
    # Component weights used
    weights: Dict[str, Decimal] = Field(
        description="Weights used for score calculation"
    )
    
    @validator('overall_score')
    def validate_overall_score(cls, v: Decimal, values: Dict) -> Decimal:
        """Ensure overall score is consistent with grade."""
        grade_ranges = {
            OpportunityGrade.S_TIER: (Decimal('0.90'), Decimal('1.00')),
            OpportunityGrade.A_TIER: (Decimal('0.80'), Decimal('0.90')),
            OpportunityGrade.B_TIER: (Decimal('0.70'), Decimal('0.80')),
            OpportunityGrade.C_TIER: (Decimal('0.60'), Decimal('0.70')),
            OpportunityGrade.D_TIER: (Decimal('0.50'), Decimal('0.60')),
            OpportunityGrade.F_TIER: (Decimal('0.00'), Decimal('0.50')),
        }
        
        if 'opportunity_grade' in values:
            grade = values['opportunity_grade']
            min_score, max_score = grade_ranges[grade]
            if not (min_score <= v < max_score):
                msg = f"Score {v} inconsistent with grade {grade}"
                raise ValueError(msg)
        
        return v


class RiskAssessment(BaseModel):
    """Comprehensive risk assessment."""
    
    # Risk categories
    market_risk: Decimal = Field(
        ge=0,
        le=1,
        description="General market risk"
    )
    liquidity_risk: Decimal = Field(
        ge=0,
        le=1,
        description="Liquidity and trading risk"
    )
    volatility_risk: Decimal = Field(
        ge=0,
        le=1,
        description="Price volatility risk"
    )
    sentiment_risk: Decimal = Field(
        ge=0,
        le=1,
        description="Sentiment reversal risk"
    )
    manipulation_risk: Decimal = Field(
        ge=0,
        le=1,
        description="Market manipulation risk"
    )
    
    # Overall risk assessment
    overall_risk_score: Decimal = Field(
        ge=0,
        le=1,
        description="Combined risk score"
    )
    risk_level: RiskLevel = Field(description="Risk level classification")
    
    # Risk factors
    key_risk_factors: List[str] = Field(
        description="Primary risk factors identified"
    )
    risk_mitigation_suggestions: List[str] = Field(
        description="Suggested risk mitigation strategies"
    )
    
    # Position sizing recommendations
    max_position_size_pct: Decimal = Field(
        ge=0,
        le=100,
        description="Maximum recommended position size (%)"
    )
    recommended_stop_loss_pct: Decimal = Field(
        ge=0,
        le=100,
        description="Recommended stop loss percentage"
    )
    
    # Risk-adjusted metrics
    risk_adjusted_score: Decimal = Field(
        ge=0,
        le=1,
        description="Risk-adjusted opportunity score"
    )
    sharpe_estimate: Optional[Decimal] = Field(
        None,
        description="Estimated Sharpe ratio"
    )


class AIInsights(BaseModel):
    """AI-generated insights and analysis."""
    
    # Summary insights
    executive_summary: str = Field(
        description="Executive summary of the opportunity"
    )
    key_bullish_points: List[str] = Field(
        description="Key bullish arguments identified"
    )
    key_bearish_points: List[str] = Field(
        description="Key bearish arguments identified"
    )
    
    # Market context
    market_context_analysis: str = Field(
        description="Analysis of current market context"
    )
    sector_analysis: Optional[str] = Field(
        None,
        description="Sector-specific analysis"
    )
    
    # Sentiment insights
    sentiment_summary: str = Field(
        description="Summary of sentiment analysis"
    )
    unusual_activity_notes: List[str] = Field(
        description="Notes on unusual Reddit activity"
    )
    
    # Investment thesis
    investment_thesis: str = Field(
        description="AI-generated investment thesis"
    )
    catalyst_identification: List[str] = Field(
        description="Potential catalysts identified"
    )
    
    # Risks and considerations
    risk_analysis: str = Field(
        description="AI analysis of risks"
    )
    contrarian_viewpoints: List[str] = Field(
        description="Contrarian viewpoints to consider"
    )
    
    # Recommendations
    trading_strategy_suggestions: List[str] = Field(
        description="Suggested trading strategies"
    )
    timeline_expectations: str = Field(
        description="Expected timeline for opportunity"
    )
    
    # Confidence and metadata
    analysis_confidence: Decimal = Field(
        ge=0,
        le=1,
        description="AI confidence in analysis"
    )
    model_version: str = Field(description="AI model version used")
    generated_at: datetime = Field(
        default_factory=datetime.utcnow,
        description="When analysis was generated"
    )


class TickerOpportunity(BaseEntity):
    """Complete ticker opportunity analysis."""
    
    # Basic identification
    ticker_symbol: str = Field(description="Stock ticker symbol")
    company_name: str = Field(description="Company name")
    analysis_date: datetime = Field(
        default_factory=datetime.utcnow,
        description="Analysis timestamp"
    )
    
    # Reddit metrics
    reddit_metrics: RedditMetrics = Field(
        description="Aggregated Reddit activity metrics"
    )
    
    # Market data
    current_price: Decimal = Field(gt=0, description="Current stock price")
    market_cap: Optional[Decimal] = Field(None, description="Market capitalization")
    daily_volume: int = Field(ge=0, description="Current daily volume")
    
    # Scoring and assessment
    opportunity_score: OpportunityScore = Field(
        description="Detailed opportunity scoring"
    )
    risk_assessment: RiskAssessment = Field(
        description="Comprehensive risk assessment"
    )
    
    # AI analysis
    ai_insights: Optional[AIInsights] = Field(
        None,
        description="AI-generated insights and analysis"
    )
    
    # Data quality
    data_quality: DataQuality = Field(
        description="Data quality assessment"
    )
    
    # Integration with other systems
    volatility_squeeze_signal: Optional[Dict] = Field(
        None,
        description="Associated volatility squeeze signal data"
    )
    
    # Temporal context
    analysis_period_start: datetime = Field(
        description="Start of analysis period"
    )
    analysis_period_end: datetime = Field(
        description="End of analysis period"
    )
    
    # Ranking and comparison
    percentile_rank: Optional[int] = Field(
        None,
        ge=1,
        le=100,
        description="Percentile rank among all analyzed tickers"
    )
    
    # Action recommendations
    recommended_action: str = Field(
        description="Recommended action (buy, hold, avoid, etc.)"
    )
    conviction_level: Decimal = Field(
        ge=0,
        le=1,
        description="Conviction level in recommendation"
    )
    
    # Monitoring flags
    requires_monitoring: bool = Field(
        default=True,
        description="Whether opportunity requires ongoing monitoring"
    )
    next_review_date: Optional[datetime] = Field(
        None,
        description="When to next review this opportunity"
    )


class AnalysisResult(BaseEntity):
    """Results of a ticker analysis run."""
    
    # Run metadata
    analysis_run_id: str = Field(description="Unique analysis run identifier")
    start_time: datetime = Field(description="Analysis start time")
    end_time: datetime = Field(description="Analysis end time")
    duration_seconds: int = Field(ge=0, description="Analysis duration")
    
    # Scope
    tickers_analyzed: List[str] = Field(description="Tickers included in analysis")
    subreddits_monitored: List[str] = Field(
        description="Subreddits monitored for mentions"
    )
    time_period_hours: int = Field(
        ge=1,
        description="Analysis time period in hours"
    )
    
    # Results summary
    opportunities_found: int = Field(
        ge=0,
        description="Number of opportunities identified"
    )
    high_grade_opportunities: int = Field(
        ge=0,
        description="Number of A/S tier opportunities"
    )
    
    # Top opportunities
    top_opportunities: List[TickerOpportunity] = Field(
        description="Top-ranked opportunities from this analysis"
    )
    
    # Performance metrics
    total_reddit_posts_analyzed: int = Field(
        ge=0,
        description="Total Reddit posts processed"
    )
    total_comments_analyzed: int = Field(
        ge=0,
        description="Total Reddit comments processed"
    )
    unique_tickers_mentioned: int = Field(
        ge=0,
        description="Unique tickers found in Reddit data"
    )
    
    # Data quality summary
    overall_data_quality: Decimal = Field(
        ge=0,
        le=1,
        description="Overall data quality score for this run"
    )
    data_completeness_pct: Decimal = Field(
        ge=0,
        le=100,
        description="Data completeness percentage"
    )
    
    # System performance
    processing_rate_posts_per_second: Decimal = Field(
        ge=0,
        description="Processing rate (posts/second)"
    )
    memory_usage_mb: Optional[int] = Field(
        None,
        description="Peak memory usage in MB"
    )
    
    # Configuration used
    analysis_config: Dict = Field(
        description="Configuration parameters used for analysis"
    )
