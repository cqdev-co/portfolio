#!/usr/bin/env python3
"""
High-Quality Ticker Filter Script

This script provides a command-line interface for filtering tickers
based on quality metrics and market data validation.
"""

import os
import sys
import json
import logging
import argparse
from typing import List, Dict, Optional
from datetime import datetime

# Add the parent directory to the path to import from utils
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.ticker_quality_filters import TickerQualityFilter, TickerQualityMetrics
from utils.market_data_validator import MarketDataValidator
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def setup_logging(verbose: bool = False):
    """Setup logging configuration"""
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format='%(asctime)s - %(levelname)s - %(message)s',
        handlers=[
            logging.StreamHandler(sys.stdout),
            logging.FileHandler('ticker_filtering.log')
        ]
    )
    return logging.getLogger(__name__)

def load_ticker_symbols(file_path: str) -> List[str]:
    """Load ticker symbols from a file"""
    symbols = []
    
    if file_path.endswith('.json'):
        with open(file_path, 'r') as f:
            data = json.load(f)
            if isinstance(data, list):
                symbols = [item['symbol'] if isinstance(item, dict) else str(item) 
                          for item in data]
            elif isinstance(data, dict) and 'symbols' in data:
                symbols = data['symbols']
    
    elif file_path.endswith('.txt'):
        with open(file_path, 'r') as f:
            symbols = [line.strip() for line in f if line.strip()]
    
    else:
        raise ValueError("Unsupported file format. Use .json or .txt")
    
    return symbols

def save_filtered_results(results: Dict, output_file: str):
    """Save filtered results to file"""
    with open(output_file, 'w') as f:
        json.dump(results, f, indent=2, default=str)

def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description='Filter tickers based on quality metrics'
    )
    
    parser.add_argument(
        'input_file',
        help='Input file containing ticker symbols (.json or .txt)'
    )
    
    parser.add_argument(
        '--output', '-o',
        default='filtered_tickers.json',
        help='Output file for filtered results (default: filtered_tickers.json)'
    )
    
    parser.add_argument(
        '--min-score',
        type=float,
        default=60.0,
        help='Minimum quality score (0-100, default: 60.0)'
    )
    
    parser.add_argument(
        '--us-only',
        action='store_true',
        help='Filter to US tickers only'
    )
    
    parser.add_argument(
        '--validate-data',
        action='store_true',
        help='Perform additional data quality validation'
    )
    
    parser.add_argument(
        '--use-alpha-vantage',
        action='store_true',
        help='Use Alpha Vantage API (requires API key)'
    )
    
    parser.add_argument(
        '--batch-size',
        type=int,
        default=50,
        help='Batch size for processing (default: 50)'
    )
    
    parser.add_argument(
        '--max-workers',
        type=int,
        default=5,
        help='Maximum worker threads (default: 5)'
    )
    
    parser.add_argument(
        '--verbose', '-v',
        action='store_true',
        help='Enable verbose logging'
    )
    
    parser.add_argument(
        '--summary-only',
        action='store_true',
        help='Only output summary statistics'
    )
    
    args = parser.parse_args()
    
    # Setup logging
    logger = setup_logging(args.verbose)
    
    try:
        # Load input symbols
        logger.info(f"Loading ticker symbols from {args.input_file}")
        symbols = load_ticker_symbols(args.input_file)
        logger.info(f"Loaded {len(symbols)} ticker symbols")
        
        if not symbols:
            logger.error("No symbols found in input file")
            return 1
        
        # Initialize filter
        alpha_vantage_key = os.getenv('ALPHA_VANTAGE_API_KEY') if args.use_alpha_vantage else None
        quality_filter = TickerQualityFilter(alpha_vantage_key=alpha_vantage_key)
        
        # Filter to US tickers only if requested
        if args.us_only:
            logger.info("Filtering to US tickers only")
            # Convert symbols to dict format expected by filter
            ticker_dicts = [{'symbol': s, 'country': None} for s in symbols]
            us_tickers = quality_filter.filter_us_tickers_only(ticker_dicts)
            symbols = [t['symbol'] for t in us_tickers]
            logger.info(f"Filtered to {len(symbols)} US tickers")
        
        # Get high-quality tickers
        logger.info("Starting quality filtering process...")
        high_quality_symbols, quality_metrics = quality_filter.get_high_quality_tickers(
            symbols,
            min_quality_score=args.min_score,
            batch_size=args.batch_size,
            max_workers=args.max_workers,
            use_alpha_vantage=args.use_alpha_vantage
        )
        
        results = {
            'timestamp': datetime.now().isoformat(),
            'input_file': args.input_file,
            'total_input_symbols': len(symbols),
            'high_quality_symbols': high_quality_symbols,
            'high_quality_count': len(high_quality_symbols),
            'filter_rate': len(high_quality_symbols) / len(symbols) * 100 if symbols else 0,
            'min_quality_score': args.min_score,
            'settings': {
                'us_only': args.us_only,
                'use_alpha_vantage': args.use_alpha_vantage,
                'validate_data': args.validate_data,
                'batch_size': args.batch_size,
                'max_workers': args.max_workers
            }
        }
        
        # Add detailed metrics if not summary-only
        if not args.summary_only:
            results['detailed_metrics'] = []
            for metrics in quality_metrics:
                metric_dict = {
                    'symbol': metrics.symbol,
                    'quality_score': metrics.quality_score,
                    'market_cap': metrics.market_cap,
                    'price': metrics.price,
                    'avg_volume': metrics.avg_volume,
                    'beta': metrics.beta,
                    'exchange': metrics.exchange,
                    'sector': metrics.sector,
                    'quality_reasons': metrics.quality_reasons
                }
                results['detailed_metrics'].append(metric_dict)
        
        # Additional data validation if requested
        if args.validate_data:
            logger.info("Performing additional data quality validation...")
            validator = MarketDataValidator()
            validation_results = validator.validate_ticker_list(high_quality_symbols)
            
            # Filter based on validation
            validated_symbols = [s for s, r in validation_results.items() if r.is_valid]
            
            results['data_validation'] = {
                'pre_validation_count': len(high_quality_symbols),
                'post_validation_count': len(validated_symbols),
                'validation_pass_rate': len(validated_symbols) / len(high_quality_symbols) * 100 if high_quality_symbols else 0,
                'validated_symbols': validated_symbols
            }
            
            # Update final symbol list
            results['final_symbols'] = validated_symbols
            results['final_count'] = len(validated_symbols)
            
            # Add validation summary
            validation_summary = validator.get_validation_summary(validation_results)
            results['validation_summary'] = validation_summary
        else:
            results['final_symbols'] = high_quality_symbols
            results['final_count'] = len(high_quality_symbols)
        
        # Save results
        save_filtered_results(results, args.output)
        logger.info(f"Results saved to {args.output}")
        
        # Print summary
        print(f"\n{'='*60}")
        print("TICKER FILTERING SUMMARY")
        print(f"{'='*60}")
        print(f"Input symbols: {results['total_input_symbols']}")
        print(f"High-quality symbols: {results['high_quality_count']}")
        print(f"Quality filter rate: {results['filter_rate']:.1f}%")
        
        if args.validate_data:
            print(f"Data-validated symbols: {results['final_count']}")
            print(f"Final filter rate: {results['final_count'] / results['total_input_symbols'] * 100:.1f}%")
        
        print(f"\nFinal symbol count: {results['final_count']}")
        print(f"Results saved to: {args.output}")
        
        # Show sample of final symbols
        if results['final_symbols']:
            sample_size = min(10, len(results['final_symbols']))
            print(f"\nSample symbols ({sample_size} of {len(results['final_symbols'])}):")
            for symbol in results['final_symbols'][:sample_size]:
                print(f"  - {symbol}")
        
        return 0
        
    except Exception as e:
        logger.error(f"Fatal error: {e}")
        return 1

if __name__ == '__main__':
    sys.exit(main())