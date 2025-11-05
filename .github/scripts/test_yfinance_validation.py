#!/usr/bin/env python3
"""
Test script for YFinance data quality validator.

Usage:
    python test_yfinance_validation.py
"""

import sys
import os
import logging

# Add utils to path
sys.path.append(os.path.join(os.path.dirname(__file__), 'utils'))
from yfinance_validator import YFinanceValidator  # pyright: ignore[reportMissingImports]

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def test_validator():
    """Test the YFinance validator with known tickers"""
    
    # Test tickers with known characteristics
    test_symbols = {
        'high_quality': ['AAPL', 'GOOGL', 'MSFT', 'TSLA'],  # Should pass
        'low_volume': ['TINY', 'XXII'],  # Might fail volume check
        'invalid': ['INVALID123', 'FAKE', 'ZZZZZ'],  # Should fail
        'penny': ['SNDL'],  # Low price, might be borderline
    }
    
    logger.info("=" * 80)
    logger.info("Testing YFinance Data Quality Validator")
    logger.info("=" * 80)
    
    # Initialize validator with standard settings
    validator = YFinanceValidator(
        min_history_days=90,
        min_volume=10_000,
        min_price=0.50,
        max_price=10_000,
        min_data_completeness=0.85,
        max_gap_ratio=0.10,
        recency_days=5,
        max_workers=5
    )
    
    # Test each category
    all_symbols = []
    for category, symbols in test_symbols.items():
        logger.info(f"\n{'='*60}")
        logger.info(f"Testing {category.upper()} tickers: {', '.join(symbols)}")
        logger.info(f"{'='*60}")
        all_symbols.extend(symbols)
    
    # Batch validation
    logger.info("\nStarting batch validation...")
    results = validator.validate_batch(all_symbols, period="6mo", verbose=True)
    
    # Display results by category
    logger.info("\n" + "=" * 80)
    logger.info("VALIDATION RESULTS BY CATEGORY")
    logger.info("=" * 80)
    
    for category, symbols in test_symbols.items():
        logger.info(f"\n{category.upper()} ({len(symbols)} tickers):")
        logger.info("-" * 60)
        
        for symbol in symbols:
            result = results.get(symbol)
            if not result:
                logger.info(f"  ❌ {symbol}: No result")
                continue
            
            if result.is_valid:
                logger.info(
                    f"  ✅ {symbol}: PASSED "
                    f"(price=${result.last_price:.2f}, "
                    f"vol={result.avg_daily_volume:,.0f}, "
                    f"history={result.min_history_days}d, "
                    f"completeness={result.data_completeness*100:.1f}%, "
                    f"ohlc={result.ohlc_quality*100:.1f}%)"
                )
            else:
                issues = '; '.join(result.validation_issues[:2])
                logger.info(f"  ❌ {symbol}: FAILED - {issues}")
    
    # Summary statistics
    logger.info("\n" + "=" * 80)
    logger.info("VALIDATION SUMMARY")
    logger.info("=" * 80)
    
    summary = validator.get_validation_summary(results)
    
    logger.info(f"\nOverall Statistics:")
    logger.info(f"  Total validated: {summary['total_validated']}")
    logger.info(f"  Passed: {summary['passed']}")
    logger.info(f"  Failed: {summary['failed']}")
    logger.info(f"  Pass rate: {summary['pass_rate']*100:.1f}%")
    
    if summary['passed'] > 0:
        logger.info(f"\nQuality Metrics (passed tickers only):")
        logger.info(f"  Avg data completeness: {summary['avg_data_completeness']*100:.1f}%")
        logger.info(f"  Avg OHLC quality: {summary['avg_ohlc_quality']*100:.1f}%")
        logger.info(f"  Avg history: {summary['avg_history_days']:.0f} days")
        logger.info(f"  Avg volume: {summary['avg_volume']:,.0f}")
        logger.info(f"  Price range: ${summary['price_range']['min']:.2f} - ${summary['price_range']['max']:.2f} (avg: ${summary['price_range']['avg']:.2f})")
    
    if summary['top_rejection_reasons']:
        logger.info(f"\nTop Rejection Reasons:")
        for reason_info in summary['top_rejection_reasons'][:5]:
            logger.info(f"  - {reason_info['reason']}: {reason_info['count']} ticker(s)")
    
    logger.info("\n" + "=" * 80)
    logger.info("Test Complete!")
    logger.info("=" * 80)
    
    return summary['pass_rate'] > 0

if __name__ == '__main__':
    try:
        success = test_validator()
        sys.exit(0 if success else 1)
    except Exception as e:
        logger.error(f"Test failed: {e}", exc_info=True)
        sys.exit(1)

