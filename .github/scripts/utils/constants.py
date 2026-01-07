#!/usr/bin/env python3
"""
Constants for ticker fetching scripts

Quality thresholds are calibrated to filter for institutional-grade
tickers with sufficient liquidity, data quality, and market presence.
"""

# Database table names
TABLE_TICKERS = 'tickers'
TABLE_PENNY_TICKERS = 'penny_tickers'

# Batch processing
DEFAULT_BATCH_SIZE = 1000
RATE_LIMIT_DELAY_SECONDS = 0.1

# Penny stock thresholds (separate universe)
PENNY_MIN_PRICE = 0.10
PENNY_MAX_PRICE = 5.00
PENNY_MIN_MARKET_CAP = 5_000_000
PENNY_MAX_MARKET_CAP = 300_000_000
PENNY_MIN_VOLUME = 10_000

# =============================================================================
# Regular ticker thresholds (STRICTER for quality)
# =============================================================================
# Price: $2 minimum excludes borderline penny stocks
TICKER_MIN_PRICE = 2.00
TICKER_MAX_PRICE = 10_000.0

# Market cap: $100M minimum for established companies
TICKER_MIN_MARKET_CAP = 100_000_000

# Volume: 100K shares/day minimum for liquidity
TICKER_MIN_VOLUME = 100_000

# Dollar volume: $500K/day minimum for tradeable positions
TICKER_MIN_DOLLAR_VOLUME = 500_000

# Quality score: 60 minimum (stricter than before)
TICKER_MIN_QUALITY_SCORE = 60.0

# Data quality thresholds
TICKER_MIN_HISTORY_DAYS = 180        # 6 months of history required
TICKER_MIN_DATA_COMPLETENESS = 0.90  # 90% data completeness
TICKER_MAX_GAP_RATIO = 0.05          # Max 5% gaps allowed

# =============================================================================
# API limits
# =============================================================================
FMP_BATCH_LIMIT = 100
FMP_MAX_CANDIDATES = 5000

# =============================================================================
# Default limits
# =============================================================================
# Reduced from 2500 to focus on higher quality tickers
DEFAULT_MAX_TICKERS = 2000
DEFAULT_MAX_PENNY_TICKERS = 2000

# =============================================================================
# Quality scoring weights
# =============================================================================
QUALITY_SCORE_WEIGHTS = {
    'market_cap': 25,      # 25 points max
    'liquidity': 25,       # 25 points max (volume + dollar volume)
    'fundamentals': 20,    # 20 points max (revenue, profitability)
    'index_inclusion': 15, # 15 points max
    'data_quality': 15,    # 15 points max
}

# Index membership bonuses
INDEX_BONUSES = {
    'sp500': 15,
    'nasdaq100': 12,
    'dow30': 15,
    'russell1000': 10,
    'russell2000': 5,
}

# =============================================================================
# Advanced quality check thresholds
# =============================================================================
ADVANCED_QUALITY_CONFIG = {
    # Options eligibility
    'require_options': True,
    'min_option_expiries': 2,
    
    # Institutional ownership
    'min_institutional_ownership': 0.10,  # 10% minimum
    'min_institutional_holders': 5,
    
    # Fundamental requirements
    'min_revenue': 10_000_000,            # $10M minimum
    'require_positive_revenue': True,
    
    # Float/liquidity depth
    'min_float_shares': 5_000_000,        # 5M shares
    'min_float_percent': 0.20,            # 20% of outstanding
    'max_short_percent': 0.50,            # Max 50% short interest
}

# Advanced quality scoring (adds up to 33 bonus points)
ADVANCED_QUALITY_SCORING = {
    'options': 8,           # 8 pts for options eligibility
    'institutional': 8,     # 8 pts for institutional ownership
    'fundamentals': 11,     # 8 + 3 bonus for profitability
    'float': 6,             # 6 pts for adequate float
}

