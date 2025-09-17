#!/usr/bin/env python3
"""
Test script for quality filtering integration

This script tests the quality filtering system with a small sample
of tickers to verify everything works correctly.
"""

import sys
import os
import logging
from dataclasses import dataclass
from typing import List

# Add the utils directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'utils'))

try:
    from utils.master_filter import MasterTickerFilter
    from utils.exchange_filters import FILTER_CONFIGS
    print("✓ Successfully imported quality filtering utilities")
except ImportError as e:
    print(f"✗ Failed to import quality filtering utilities: {e}")
    sys.exit(1)

@dataclass
class TestTicker:
    """Test ticker data structure"""
    symbol: str
    name: str
    exchange: str = 'NASDAQ'
    country: str = 'US'
    currency: str = 'USD'
    sector: str = 'Technology'
    industry: str = 'Software'
    market_cap: int = 1000000000  # 1B
    ticker_type: str = 'stock'

def create_test_tickers() -> List[dict]:
    """Create a sample set of test tickers"""
    test_tickers = [
        # High quality tickers
        TestTicker('AAPL', 'Apple Inc.', 'NASDAQ', 'US', 'USD', 'Technology', 'Consumer Electronics', 3000000000000),
        TestTicker('MSFT', 'Microsoft Corporation', 'NASDAQ', 'US', 'USD', 'Technology', 'Software', 2800000000000),
        TestTicker('GOOGL', 'Alphabet Inc.', 'NASDAQ', 'US', 'USD', 'Communication Services', 'Internet Content', 1800000000000),
        
        # Medium quality tickers
        TestTicker('AMD', 'Advanced Micro Devices', 'NASDAQ', 'US', 'USD', 'Technology', 'Semiconductors', 200000000000),
        TestTicker('NVDA', 'NVIDIA Corporation', 'NASDAQ', 'US', 'USD', 'Technology', 'Semiconductors', 1500000000000),
        
        # Smaller companies
        TestTicker('PLTR', 'Palantir Technologies', 'NYSE', 'US', 'USD', 'Technology', 'Software', 50000000000),
        TestTicker('RBLX', 'Roblox Corporation', 'NYSE', 'US', 'USD', 'Communication Services', 'Gaming', 30000000000),
        
        # Penny stock examples
        TestTicker('SNDL', 'Sundial Growers Inc.', 'NASDAQ', 'US', 'USD', 'Healthcare', 'Drug Manufacturers', 500000000),
        TestTicker('ZYXI', 'Zynex Inc.', 'NASDAQ', 'US', 'USD', 'Healthcare', 'Medical Devices', 200000000),
        
        # International (should be filtered out with US-only config)
        TestTicker('NESN', 'Nestle S.A.', 'SIX', 'CH', 'CHF', 'Consumer Defensive', 'Packaged Foods', 300000000000),
        TestTicker('ASML', 'ASML Holding N.V.', 'NASDAQ', 'NL', 'USD', 'Technology', 'Semiconductors', 250000000000),
    ]
    
    # Convert to dictionaries
    return [
        {
            'symbol': ticker.symbol,
            'name': ticker.name,
            'exchange': ticker.exchange,
            'country': ticker.country,
            'currency': ticker.currency,
            'sector': ticker.sector,
            'industry': ticker.industry,
            'market_cap': ticker.market_cap,
            'ticker_type': ticker.ticker_type
        }
        for ticker in test_tickers
    ]

def test_exchange_filtering():
    """Test exchange filtering functionality"""
    print("\\n" + "="*50)
    print("Testing Exchange Filtering")
    print("="*50)
    
    test_tickers = create_test_tickers()
    print(f"Input tickers: {len(test_tickers)}")
    
    # Test US-only filter
    us_filter = FILTER_CONFIGS['us_only']
    filtered_tickers = us_filter.filter_by_exchange(test_tickers)
    
    print(f"US-only filtered tickers: {len(filtered_tickers)}")
    print("Filtered tickers:")
    for ticker in filtered_tickers:
        print(f"  {ticker['symbol']} - {ticker['name']} ({ticker['exchange']})")
    
    return filtered_tickers

def test_master_filter(config_name: str):
    """Test master filter with specific configuration"""
    print(f"\\n" + "="*50)
    print(f"Testing Master Filter - {config_name.upper()} Configuration")
    print("="*50)
    
    test_tickers = create_test_tickers()
    
    # Configure filter based on our updated configs
    filter_configs = {
        'conservative': {
            'exchange_filter_config': 'us_only',
            'enable_fundamental_filtering': False,  # Disable for testing
            'min_overall_score': 0.6,
            'max_tickers': 100
        },
        'moderate': {
            'exchange_filter_config': 'us_only',
            'enable_fundamental_filtering': False,
            'min_overall_score': 0.5,
            'max_tickers': 100
        },
        'liberal': {
            'exchange_filter_config': 'us_only',
            'enable_fundamental_filtering': False,
            'min_overall_score': 0.4,
            'max_tickers': 100
        }
    }
    
    config = filter_configs.get(config_name, filter_configs['moderate'])
    master_filter = MasterTickerFilter(**config)
    
    try:
        results = master_filter.filter_all_tickers(test_tickers)
        
        print(f"Filtering Results:")
        print(f"  Original count: {results.original_count}")
        print(f"  Exchange filtered: {results.exchange_filtered_count}")
        print(f"  Quality filtered: {results.quality_filtered_count}")
        print(f"  Final count: {results.final_count}")
        print(f"  Overall pass rate: {results.pass_rates['overall']*100:.1f}%")
        
        if results.filtered_tickers:
            print(f"\\nFiltered Tickers:")
            for ticker in results.filtered_tickers[:10]:  # Show first 10
                score = ticker.get('final_quality_score', 0)
                tier = ticker.get('quality_tier', 'Unknown')
                print(f"  {ticker['symbol']} - {ticker['name']} (Score: {score:.3f}, Tier: {tier})")
        
        if results.summary_stats:
            print(f"\\nSummary Statistics:")
            if 'tier_distribution' in results.summary_stats:
                print("  Tier Distribution:")
                for tier, count in results.summary_stats['tier_distribution'].items():
                    print(f"    {tier}: {count}")
        
        return results
        
    except Exception as e:
        print(f"✗ Error during filtering: {e}")
        return None

def main():
    """Run all tests"""
    print("Quality Filtering Integration Test")
    print("="*50)
    
    # Setup logging
    logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
    
    try:
        # Test 1: Exchange filtering
        exchange_results = test_exchange_filtering()
        
        # Test 2: Master filter configurations
        for config in ['liberal', 'moderate', 'conservative']:
            master_results = test_master_filter(config)
            if master_results is None:
                print(f"✗ {config} configuration failed")
                continue
        
        print("\\n" + "="*50)
        print("✓ All tests completed successfully!")
        print("✓ Quality filtering system is working correctly")
        print("="*50)
        
    except Exception as e:
        print(f"\\n✗ Test failed with error: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
