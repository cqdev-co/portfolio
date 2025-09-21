"""Performance configuration profiles for different use cases."""

from typing import Dict, Any, List
from dataclasses import dataclass
from enum import Enum

from volatility_scanner.config.settings import Settings


class PerformanceProfile(Enum):
    """Performance profile types."""
    CONSERVATIVE = "conservative"  # Current default - safe and slow
    BALANCED = "balanced"         # Good balance of speed and safety
    AGGRESSIVE = "aggressive"     # Maximum performance, higher risk
    DEVELOPMENT = "development"   # For development/testing
    PRODUCTION = "production"     # For production with monitoring


@dataclass
class ProfileConfig:
    """Configuration for a performance profile."""
    name: str
    description: str
    max_concurrent_requests: int
    bulk_scan_concurrency: int
    bulk_scan_batch_size: int
    request_delay_seconds: float
    chunk_delay_seconds: float
    analysis_concurrency: int
    max_retries: int
    retry_delay_base: float
    yfinance_cache_ttl: int
    rate_limit_backoff_factor: float
    
    # Advanced settings
    use_bulk_download: bool = True
    enable_aggressive_caching: bool = True
    skip_ticker_info: bool = False  # Skip expensive ticker.info calls
    parallel_indicator_calculation: bool = True


class PerformanceProfiles:
    """Predefined performance profiles for different use cases."""
    
    PROFILES: Dict[PerformanceProfile, ProfileConfig] = {
        
        PerformanceProfile.CONSERVATIVE: ProfileConfig(
            name="Conservative",
            description="Safe, slow processing with minimal API load - current default",
            max_concurrent_requests=5,
            bulk_scan_concurrency=3,
            bulk_scan_batch_size=100,
            request_delay_seconds=0.2,
            chunk_delay_seconds=2.0,
            analysis_concurrency=20,
            max_retries=3,
            retry_delay_base=1.0,
            yfinance_cache_ttl=3600,
            rate_limit_backoff_factor=2.0,
            use_bulk_download=False,
            enable_aggressive_caching=False,
            skip_ticker_info=False,
            parallel_indicator_calculation=False
        ),
        
        PerformanceProfile.BALANCED: ProfileConfig(
            name="Balanced",
            description="Good balance of speed and reliability - recommended for most users",
            max_concurrent_requests=15,
            bulk_scan_concurrency=10,
            bulk_scan_batch_size=200,
            request_delay_seconds=0.1,
            chunk_delay_seconds=0.5,
            analysis_concurrency=40,
            max_retries=3,
            retry_delay_base=0.5,
            yfinance_cache_ttl=1800,  # 30 minutes
            rate_limit_backoff_factor=1.8,
            use_bulk_download=True,
            enable_aggressive_caching=True,
            skip_ticker_info=True,  # Skip expensive info calls
            parallel_indicator_calculation=True
        ),
        
        PerformanceProfile.AGGRESSIVE: ProfileConfig(
            name="Aggressive",
            description="Maximum performance - use with caution, may hit rate limits",
            max_concurrent_requests=25,  # Reduced from 50
            bulk_scan_concurrency=15,   # Reduced from 25
            bulk_scan_batch_size=300,   # Reduced from 500
            request_delay_seconds=0.08, # Increased from 0.05
            chunk_delay_seconds=0.2,    # Increased from 0.1
            analysis_concurrency=40,    # Reduced from 80
            max_retries=5,              # More retries since we're more likely to hit limits
            retry_delay_base=0.5,       # Increased from 0.3
            yfinance_cache_ttl=900,     # 15 minutes - fresher data
            rate_limit_backoff_factor=2.0,  # Increased from 1.5
            use_bulk_download=True,
            enable_aggressive_caching=True,
            skip_ticker_info=True,
            parallel_indicator_calculation=True
        ),
        
        PerformanceProfile.DEVELOPMENT: ProfileConfig(
            name="Development",
            description="Fast processing for development and testing",
            max_concurrent_requests=20,
            bulk_scan_concurrency=15,
            bulk_scan_batch_size=100,  # Smaller batches for easier debugging
            request_delay_seconds=0.05,
            chunk_delay_seconds=0.1,
            analysis_concurrency=30,
            max_retries=2,  # Fail fast in development
            retry_delay_base=0.2,
            yfinance_cache_ttl=7200,  # 2 hours - longer cache for development
            rate_limit_backoff_factor=1.5,
            use_bulk_download=True,
            enable_aggressive_caching=True,
            skip_ticker_info=True,
            parallel_indicator_calculation=True
        ),
        
        PerformanceProfile.PRODUCTION: ProfileConfig(
            name="Production",
            description="Optimized for production with monitoring and reliability",
            max_concurrent_requests=25,
            bulk_scan_concurrency=20,
            bulk_scan_batch_size=300,
            request_delay_seconds=0.08,
            chunk_delay_seconds=0.3,
            analysis_concurrency=60,
            max_retries=4,
            retry_delay_base=0.5,
            yfinance_cache_ttl=1200,  # 20 minutes
            rate_limit_backoff_factor=1.6,
            use_bulk_download=True,
            enable_aggressive_caching=True,
            skip_ticker_info=True,
            parallel_indicator_calculation=True
        )
    }
    
    @classmethod
    def get_profile(cls, profile: PerformanceProfile) -> ProfileConfig:
        """Get configuration for a specific profile."""
        return cls.PROFILES[profile]
    
    @classmethod
    def apply_profile(cls, settings: Settings, profile: PerformanceProfile) -> Settings:
        """Apply a performance profile to settings."""
        config = cls.get_profile(profile)
        
        # Update settings with profile values
        settings.max_concurrent_requests = config.max_concurrent_requests
        settings.bulk_scan_concurrency = config.bulk_scan_concurrency
        settings.bulk_scan_batch_size = config.bulk_scan_batch_size
        settings.request_delay_seconds = config.request_delay_seconds
        settings.chunk_delay_seconds = config.chunk_delay_seconds
        settings.analysis_concurrency = config.analysis_concurrency
        settings.max_retries = config.max_retries
        settings.retry_delay_base = config.retry_delay_base
        settings.yfinance_cache_ttl = config.yfinance_cache_ttl
        settings.rate_limit_backoff_factor = config.rate_limit_backoff_factor
        
        return settings
    
    @classmethod
    def get_recommended_profile(cls, symbol_count: int, time_constraint: str = "normal") -> PerformanceProfile:
        """
        Get recommended profile based on use case.
        
        Args:
            symbol_count: Number of symbols to process
            time_constraint: "fast", "normal", or "slow"
            
        Returns:
            Recommended performance profile
        """
        if symbol_count < 100:
            if time_constraint == "fast":
                return PerformanceProfile.AGGRESSIVE
            else:
                return PerformanceProfile.BALANCED
        
        elif symbol_count < 1000:
            if time_constraint == "fast":
                return PerformanceProfile.AGGRESSIVE
            elif time_constraint == "slow":
                return PerformanceProfile.CONSERVATIVE
            else:
                return PerformanceProfile.BALANCED
        
        else:  # Large datasets
            if time_constraint == "fast":
                return PerformanceProfile.PRODUCTION  # Aggressive might be too risky
            elif time_constraint == "slow":
                return PerformanceProfile.CONSERVATIVE
            else:
                return PerformanceProfile.PRODUCTION
    
    @classmethod
    def estimate_processing_time(cls, symbol_count: int, profile: PerformanceProfile) -> Dict[str, float]:
        """
        Estimate processing time for a given symbol count and profile.
        
        Args:
            symbol_count: Number of symbols to process
            profile: Performance profile to use
            
        Returns:
            Dictionary with time estimates
        """
        config = cls.get_profile(profile)
        
        # Base processing rates (symbols per second) for each profile
        base_rates = {
            PerformanceProfile.CONSERVATIVE: 2.0,
            PerformanceProfile.BALANCED: 8.0,
            PerformanceProfile.AGGRESSIVE: 20.0,
            PerformanceProfile.DEVELOPMENT: 12.0,
            PerformanceProfile.PRODUCTION: 15.0
        }
        
        base_rate = base_rates[profile]
        
        # Adjust rate based on batch size and concurrency
        effective_rate = base_rate * (config.bulk_scan_concurrency / 10.0) * (config.bulk_scan_batch_size / 200.0)
        
        # Calculate estimates
        estimated_seconds = symbol_count / effective_rate
        
        return {
            "estimated_seconds": estimated_seconds,
            "estimated_minutes": estimated_seconds / 60,
            "estimated_rate_symbols_per_second": effective_rate,
            "profile_name": config.name,
            "symbol_count": symbol_count
        }
    
    @classmethod
    def get_profile_comparison(cls) -> Dict[str, Dict[str, Any]]:
        """Get a comparison of all profiles."""
        comparison = {}
        
        for profile_enum, config in cls.PROFILES.items():
            # Estimate performance for 1000 symbols
            estimates = cls.estimate_processing_time(1000, profile_enum)
            
            comparison[profile_enum.value] = {
                "name": config.name,
                "description": config.description,
                "concurrency": config.bulk_scan_concurrency,
                "batch_size": config.bulk_scan_batch_size,
                "request_delay_ms": config.request_delay_seconds * 1000,
                "estimated_time_for_1000_symbols_minutes": estimates["estimated_minutes"],
                "estimated_rate_symbols_per_second": estimates["estimated_rate_symbols_per_second"],
                "risk_level": cls._get_risk_level(config),
                "recommended_for": cls._get_recommended_use_cases(profile_enum)
            }
        
        return comparison
    
    @classmethod
    def _get_risk_level(cls, config: ProfileConfig) -> str:
        """Determine risk level based on configuration."""
        if config.bulk_scan_concurrency >= 20:
            return "High"
        elif config.bulk_scan_concurrency >= 10:
            return "Medium"
        else:
            return "Low"
    
    @classmethod
    def _get_recommended_use_cases(cls, profile: PerformanceProfile) -> List[str]:
        """Get recommended use cases for a profile."""
        use_cases = {
            PerformanceProfile.CONSERVATIVE: [
                "First-time users",
                "Unreliable internet connection",
                "Small-scale personal use",
                "When stability is critical"
            ],
            PerformanceProfile.BALANCED: [
                "Most users",
                "Regular portfolio scanning",
                "Medium-scale operations",
                "Good internet connection"
            ],
            PerformanceProfile.AGGRESSIVE: [
                "Power users",
                "Time-critical analysis",
                "High-speed internet",
                "Can handle occasional failures"
            ],
            PerformanceProfile.DEVELOPMENT: [
                "Development and testing",
                "Debugging analysis issues",
                "Local development environment"
            ],
            PerformanceProfile.PRODUCTION: [
                "Production environments",
                "Automated scanning systems",
                "Enterprise deployments",
                "With proper monitoring"
            ]
        }
        return use_cases.get(profile, [])


# Convenience function for CLI usage
def get_performance_profile_settings(profile_name: str) -> Dict[str, Any]:
    """Get settings dictionary for a performance profile by name."""
    try:
        profile_enum = PerformanceProfile(profile_name.lower())
        config = PerformanceProfiles.get_profile(profile_enum)
        
        return {
            "max_concurrent_requests": config.max_concurrent_requests,
            "bulk_scan_concurrency": config.bulk_scan_concurrency,
            "bulk_scan_batch_size": config.bulk_scan_batch_size,
            "request_delay_seconds": config.request_delay_seconds,
            "chunk_delay_seconds": config.chunk_delay_seconds,
            "analysis_concurrency": config.analysis_concurrency,
            "max_retries": config.max_retries,
            "retry_delay_base": config.retry_delay_base,
            "yfinance_cache_ttl": config.yfinance_cache_ttl,
            "rate_limit_backoff_factor": config.rate_limit_backoff_factor
        }
    except ValueError:
        raise ValueError(f"Unknown profile: {profile_name}. Available: {[p.value for p in PerformanceProfile]}")
