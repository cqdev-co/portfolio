#!/usr/bin/env python3
"""
Quick test to verify the validation fix works properly.
Tests with a known good ticker (AAPL) and a known bad ticker.
"""

import sys
import os
import logging

# Add utils to path
sys.path.append(os.path.join(os.path.dirname(__file__), 'utils'))
from yfinance_validator import YFinanceValidator

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def test_single_ticker():
    """Test validation with a single known-good ticker"""
    
    logger.info("=" * 80)
    logger.info("Testing YFinance Validator Fix")
    logger.info("=" * 80)
    
    # Initialize validator with lenient settings for testing
    validator = YFinanceValidator(
        min_history_days=60,  # Reduced for testing
        min_volume=5_000,      # Reduced for testing
        min_price=0.50,
        max_price=10_000,
        min_data_completeness=0.75,  # More lenient
        max_gap_ratio=0.15,
        recency_days=7,  # More lenient
        max_workers=1,
        request_delay=1.0  # Slower for testing
    )
    
    # Test with AAPL (should always pass)
    logger.info("\nTest 1: Validating AAPL (should PASS)")
    logger.info("-" * 60)
    
    result = validator.validate_ticker('AAPL', period='3mo')
    
    if result.is_valid:
        logger.info(f"✅ AAPL: PASSED")
        logger.info(f"   Price: ${result.last_price:.2f}")
        logger.info(f"   Volume: {result.avg_daily_volume:,.0f}")
        logger.info(f"   History: {result.min_history_days} days")
        logger.info(f"   Completeness: {result.data_completeness*100:.1f}%")
        logger.info(f"   OHLC Quality: {result.ohlc_quality*100:.1f}%")
    else:
        logger.error(f"❌ AAPL: FAILED - {', '.join(result.validation_issues)}")
        return False
    
    # Test with a delisted ticker (should fail gracefully)
    logger.info("\nTest 2: Validating INVALID123 (should FAIL gracefully)")
    logger.info("-" * 60)
    
    result = validator.validate_ticker('INVALID123', period='3mo')
    
    if not result.is_valid:
        logger.info(f"✅ INVALID123: Correctly rejected")
        logger.info(f"   Reason: {', '.join(result.validation_issues[:2])}")
    else:
        logger.error(f"❌ INVALID123: Should have been rejected but passed!")
        return False
    
    logger.info("\n" + "=" * 80)
    logger.info("✅ All tests passed! Validation is working correctly.")
    logger.info("=" * 80)
    
    return True

if __name__ == '__main__':
    try:
        success = test_single_ticker()
        sys.exit(0 if success else 1)
    except Exception as e:
        logger.error(f"Test failed with exception: {e}", exc_info=True)
        sys.exit(1)

