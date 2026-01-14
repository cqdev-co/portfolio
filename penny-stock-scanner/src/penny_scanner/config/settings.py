"""Configuration settings for penny stock scanner."""

from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


def find_env_file() -> str:
    """
    Find .env file in current directory or parent directories.
    Checks current dir, parent dir, and repository root.
    """
    current = Path.cwd()

    # Check current directory
    if (current / ".env").exists():
        return str(current / ".env")

    # Check parent directory (repository root)
    if (current.parent / ".env").exists():
        return str(current.parent / ".env")

    # Check two levels up
    if (current.parent.parent / ".env").exists():
        return str(current.parent.parent / ".env")

    # Default to .env in current directory
    return ".env"


class Settings(BaseSettings):
    """Application settings with environment variable support."""

    model_config = SettingsConfigDict(
        env_file=find_env_file(),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Supabase Configuration
    supabase_url: str = Field(
        default="", alias="NEXT_PUBLIC_SUPABASE_URL", description="Supabase project URL"
    )
    supabase_anon_key: str = Field(
        default="",
        alias="NEXT_PUBLIC_SUPABASE_ANON_KEY",
        description="Supabase anonymous key",
    )
    supabase_service_role_key: str = Field(
        default="",
        alias="NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY",
        description="Supabase service role key",
    )

    # AI Integration (Optional)
    openai_api_key: str | None = Field(
        default=None, description="OpenAI API key for AI analysis"
    )
    anthropic_api_key: str | None = Field(
        default=None, description="Anthropic API key for AI analysis"
    )

    # Discord Alerts
    discord_webhook_url: str = Field(
        default="",
        alias="DISCORD_PENNY_WEBHOOK_URL",
        description="Discord webhook URL for penny stock alerts",
    )
    discord_alerts_enabled: bool = Field(
        default=True, description="Enable Discord alerts for high-quality signals"
    )
    discord_min_rank: str = Field(
        default="A", description="Minimum rank to trigger Discord alert (S, A, B, C, D)"
    )

    # Data & Caching
    yfinance_cache_ttl: int = Field(
        default=3600, description="YFinance cache TTL in seconds"
    )
    max_concurrent_requests: int = Field(
        default=10,
        description="Maximum concurrent API requests",
    )

    # Batch Download Settings - OPTIMIZED Jan 2026
    # yfinance batch download can handle 50-100 symbols per call efficiently
    batch_download_size: int = Field(
        default=50,
        description="Number of symbols per batch download (yfinance handles internally)",
    )

    # Rate Limiting - OPTIMIZED Jan 2026
    # Yahoo Finance limits: ~2000/hour, batch downloads count as single requests
    # Batch downloads are much more efficient - one call for 50 symbols
    rate_limit_requests_per_minute: int = Field(
        default=60, description="Max requests per minute (batch downloads)"
    )
    rate_limit_min_delay: float = Field(
        default=0.2, description="Minimum delay between requests (seconds)"
    )
    rate_limit_batch_delay: float = Field(
        default=1.0, description="Delay between batch downloads (seconds)"
    )
    rate_limit_initial_backoff: float = Field(
        default=5.0, description="Initial backoff on rate limit error (seconds)"
    )
    rate_limit_max_backoff: float = Field(
        default=120.0, description="Maximum backoff on rate limit error (seconds)"
    )

    # Penny Stock Filters
    penny_min_price: float = Field(
        default=0.10, description="Minimum penny stock price"
    )
    penny_max_price: float = Field(
        default=5.00, description="Maximum penny stock price"
    )
    penny_min_volume: int = Field(default=200000, description="Minimum daily volume")
    penny_min_dollar_volume: float = Field(
        default=100000.0, description="Minimum daily dollar volume"
    )
    penny_max_spread_pct: float = Field(
        default=5.0, description="Maximum bid-ask spread %"
    )

    # Volume Spike Thresholds
    volume_spike_2x: float = Field(default=2.0, description="2x volume spike threshold")
    volume_spike_3x: float = Field(default=3.0, description="3x volume spike threshold")
    volume_spike_5x: float = Field(default=5.0, description="5x volume spike threshold")

    # Score Thresholds
    # NOTE: Thresholds adjusted after removing inflated partial credits
    # from unimplemented features (market/sector comparison, bid-ask spread)
    # This removes ~6% of artificial score inflation
    min_score_threshold: float = Field(
        default=0.55,
        description="Minimum overall score for signals (lowered from 0.60)",
    )
    s_tier_threshold: float = Field(
        default=0.82, description="S-Tier ranking threshold (exceptional setups)"
    )
    a_tier_threshold: float = Field(
        default=0.72, description="A-Tier ranking threshold (excellent setups)"
    )
    b_tier_threshold: float = Field(
        default=0.62, description="B-Tier ranking threshold (solid setups)"
    )
    c_tier_threshold: float = Field(
        default=0.55, description="C-Tier ranking threshold (watch list)"
    )

    # Consolidation Detection
    # NOTE: Penny stocks are more volatile than large caps
    # Previous 15% range was too tight - only 6.5% of signals showed consolidation
    consolidation_days_min: int = Field(
        default=5, description="Minimum days for consolidation"
    )
    consolidation_days_max: int = Field(
        default=10, description="Maximum days for consolidation check"
    )
    consolidation_range_pct: float = Field(
        default=20.0,
        description="Max price range % for consolidation (20% for penny stock volatility)",
    )

    # Scoring Weights - UPDATED TO MATCH STRATEGY
    # Volume Analysis: 50% (THE DOMINANT SIGNAL)
    weight_volume_surge: float = Field(
        default=0.20, description="Weight for volume surge (20% of total)"
    )
    weight_volume_acceleration: float = Field(
        default=0.15, description="Weight for volume acceleration (15% of total)"
    )
    weight_volume_consistency: float = Field(
        default=0.10, description="Weight for volume consistency (10% of total)"
    )
    weight_liquidity_depth: float = Field(
        default=0.05, description="Weight for liquidity depth (5% of total)"
    )

    # Price Momentum & Consolidation: 30%
    weight_consolidation: float = Field(
        default=0.12, description="Weight for consolidation detection (12% of total)"
    )
    weight_price_acceleration: float = Field(
        default=0.10, description="Weight for price acceleration (10% of total)"
    )
    weight_higher_lows: float = Field(
        default=0.05, description="Weight for higher lows pattern (5% of total)"
    )
    weight_ma_position: float = Field(
        default=0.03, description="Weight for MA position (3% of total)"
    )

    # Relative Strength: 20% (INCREASED - strongest predictor per data)
    # Data shows: Outperforming SPY = 63.6% WR, +4.56% vs Underperforming = 36% WR, -2.73%
    weight_market_outperformance: float = Field(
        default=0.15,
        description="Weight for market outperformance (15% of total) - INCREASED from 8%",
    )
    weight_sector_leadership: float = Field(
        default=0.02, description="Weight for sector leadership (2% of total) - reduced"
    )
    weight_52w_position: float = Field(
        default=0.03, description="Weight for 52-week position (3% of total)"
    )

    # High-Risk Countries (0% WR to 18% WR in data)
    # These countries showed significantly worse performance
    high_risk_countries: list = Field(
        default=[
            "Israel",
            "Malaysia",
            "Greece",
            "Australia",
            "Cayman Islands",
            "British Virgin Islands",
        ],
        description="Countries with historically poor performance - demote signals from these",
    )
    # NOTE: China removed from moderate risk - Jan 2026 data shows
    # China = 61.2% WR, +15.98% avg return (surprisingly best performer!)
    moderate_risk_countries: list = Field(
        default=["Hong Kong"],
        description="Countries with moderate risk - flag but don't filter",
    )

    # Volume Ceiling (Anti-Pump-and-Dump)
    # Data shows: 10x+ volume = 34% WR, -3.16% vs 2-5x = 50% WR, +1.9%
    volume_ceiling: float = Field(
        default=10.0,
        description="Volume above this is penalized (likely pump-and-dump)",
    )
    # Volume Sweet Spot - UPDATED Jan 2026
    # Data shows: 2-3x = 69% WR, +3.53% vs 3-5x = 47.5% WR, +2.74%
    volume_sweet_spot_min: float = Field(
        default=2.0, description="Minimum volume for optimal zone"
    )
    volume_sweet_spot_max: float = Field(
        default=3.0,
        description="Maximum volume for optimal zone (narrowed from 5.0 per Jan 2026 data)",
    )
    # Extreme Volume Penalty - ADDED Jan 13, 2026
    # Data shows: 5x+ volume = 46.1% WR vs 2-3x = 72.5% WR
    # Extreme volume often signals end of move, not beginning
    extreme_volume_threshold: float = Field(
        default=5.0,
        description="Volume above this gets additional penalty (often late to move)",
    )
    extreme_volume_penalty: float = Field(
        default=0.88,
        description="Score multiplier for >5x volume (12% penalty)",
    )

    # Late Entry Penalty - UPDATED Jan 13, 2026
    # Original thresholds (15%/30%) were too lenient - S-Tier still had +24.5% avg 5d
    # Data shows: S/A-Tier avg 5d = +17-24%, but they have 11-26% WR (terrible!)
    # Lowered thresholds and increased penalties to fix score inversion
    late_entry_threshold_5d: float = Field(
        default=10.0,
        description="Penalize if price already up this % in 5 days (was 15%)",
    )
    late_entry_threshold_10d: float = Field(
        default=20.0,
        description="Penalize if price already up this % in 10 days (was 30%)",
    )
    late_entry_penalty_moderate: float = Field(
        default=0.75,
        description="Score multiplier for moderate late entry (was 0.85)",
    )
    late_entry_penalty_severe: float = Field(
        default=0.60,
        description="Score multiplier for severe late entry (was 0.70)",
    )
    early_entry_bonus: float = Field(
        default=1.10, description="Score multiplier for early entry (-5% to +10% 5d)"
    )

    # Minimum Hold Period - ADDED Jan 2026
    # Data shows: 1 day = 43.7% WR, 4-7 days = 76.5% WR
    min_hold_days: int = Field(
        default=3,
        description="Minimum days to hold before closing (unless stop hit)",
    )

    # Consecutive Green Days - ADDED Jan 2026
    # Data shows: 1 green day = 64.8% WR (best!)
    #             0 green days = 42.2% WR
    #             4+ green days = 41.9% WR (late entry)
    green_day_optimal: int = Field(
        default=1, description="Optimal number of consecutive green days"
    )
    green_day_optimal_bonus: float = Field(
        default=1.08, description="Score multiplier for optimal green days (8% bonus)"
    )
    green_day_zero_penalty: float = Field(
        default=0.95, description="Score multiplier for 0 green days (5% penalty)"
    )
    green_day_excessive_penalty: float = Field(
        default=0.92,
        description="Score multiplier for 4+ green days (8% penalty - late entry)",
    )

    # 52-Week Position - UPDATED Jan 13, 2026
    # Data shows: 25-50% from low = 55.1% WR, +5.90% (best!)
    #             <25% from low = 45.3% WR, -3.78% (catching falling knife)
    #             100%+ from low = 48.0% WR, -0.11% (overextended)
    # NEW: S-Tier signals avg 98% from low (near highs!) - need to penalize this
    position_52w_optimal_min: float = Field(
        default=25.0, description="Optimal min distance from 52w low (%)"
    )
    position_52w_optimal_max: float = Field(
        default=50.0, description="Optimal max distance from 52w low (%)"
    )
    position_52w_optimal_bonus: float = Field(
        default=1.06, description="Score multiplier for optimal 52w position (6% bonus)"
    )
    position_52w_near_low_penalty: float = Field(
        default=0.92,
        description="Score multiplier for <25% from low (8% penalty - falling knife)",
    )
    # NEW: Penalty for stocks near 52-week highs (overextended)
    position_52w_near_high_threshold: float = Field(
        default=75.0,
        description="Threshold for near-high penalty (>75% from low = near highs)",
    )
    position_52w_near_high_penalty: float = Field(
        default=0.85,
        description="Score multiplier for >75% from low (15% penalty - overextended)",
    )

    # Day of Week - ADDED Jan 2026
    # Data shows: Friday = 57.4% WR (best), Wednesday = 44.7% WR (worst)
    day_of_week_friday_bonus: float = Field(
        default=1.05, description="Score multiplier for Friday entries (5% bonus)"
    )
    day_of_week_wednesday_penalty: float = Field(
        default=0.95, description="Score multiplier for Wednesday entries (5% penalty)"
    )

    # Risk & Liquidity: 5%
    weight_bid_ask_spread: float = Field(
        default=0.02, description="Weight for bid-ask spread (2% of total)"
    )
    weight_float_analysis: float = Field(
        default=0.02, description="Weight for float analysis (2% of total)"
    )
    weight_price_stability: float = Field(
        default=0.01, description="Weight for price stability (1% of total)"
    )

    # Technical Indicator Periods
    ema_short_period: int = Field(default=20, description="Short EMA period")
    ema_long_period: int = Field(default=50, description="Long EMA period")
    rsi_period: int = Field(default=14, description="RSI period")
    atr_period: int = Field(default=20, description="ATR period")
    volume_sma_period: int = Field(default=20, description="Volume SMA period")

    # Risk Management
    default_stop_loss_pct: float = Field(
        default=0.10, description="Default stop loss percentage"
    )
    default_profit_target_pct: float = Field(
        default=0.25, description="Default profit target percentage"
    )
    max_position_size_pct: float = Field(
        default=0.08, description="Maximum position size as % of capital"
    )

    # System Performance
    analysis_concurrency: int = Field(
        default=10, description="Number of concurrent analysis workers"
    )
    batch_size: int = Field(default=100, description="Batch size for bulk operations")

    # Logging
    log_level: str = Field(default="INFO", description="Logging level")

    def validate_weights(self) -> bool:
        """
        Validate that scoring weights sum to 1.0.
        Returns True if valid, False otherwise.
        """
        total = (
            # Volume: 50%
            self.weight_volume_surge
            + self.weight_volume_acceleration
            + self.weight_volume_consistency
            + self.weight_liquidity_depth
            +
            # Momentum: 30%
            self.weight_consolidation
            + self.weight_price_acceleration
            + self.weight_higher_lows
            + self.weight_ma_position
            +
            # Relative Strength: 15%
            self.weight_market_outperformance
            + self.weight_sector_leadership
            + self.weight_52w_position
            +
            # Risk: 5%
            self.weight_bid_ask_spread
            + self.weight_float_analysis
            + self.weight_price_stability
        )

        # Allow small floating point variance
        return abs(total - 1.0) < 0.001

    def is_ai_enabled(self) -> bool:
        """Check if AI analysis is available."""
        return bool(self.openai_api_key or self.anthropic_api_key)

    def is_database_enabled(self) -> bool:
        """Check if database is configured."""
        return bool(self.supabase_url and self.supabase_service_role_key)

    def is_discord_enabled(self) -> bool:
        """Check if Discord alerts are configured and enabled."""
        return bool(self.discord_webhook_url and self.discord_alerts_enabled)


# Global settings instance
_settings: Settings | None = None


def get_settings() -> Settings:
    """Get or create settings instance."""
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings


def reload_settings() -> Settings:
    """Force reload settings from environment."""
    global _settings
    _settings = Settings()
    return _settings
