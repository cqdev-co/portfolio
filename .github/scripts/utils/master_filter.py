#!/usr/bin/env python3
"""
Master Ticker Quality Filter

This module orchestrates all ticker quality filtering utilities to provide
a comprehensive filtering system that identifies high-quality tickers
suitable for model training and backtesting.

Usage:
    from master_filter import MasterTickerFilter
    
    filter = MasterTickerFilter()
    quality_tickers = filter.filter_all_tickers(raw_tickers)
"""

import logging
from typing import List, Dict, Optional
from dataclasses import dataclass
import json

from ticker_quality_filters import TickerQualityFilter
from exchange_filters import ExchangeFilter, FILTER_CONFIGS
from fundamental_filters import FundamentalFilter, FUNDAMENTAL_FILTER_CONFIGS

logger = logging.getLogger(__name__)

@dataclass
class FilteringResults:
    """Results from the complete filtering process"""
    original_count: int
    filtered_tickers: List[Dict]
    exchange_filtered_count: int
    quality_filtered_count: int
    fundamental_filtered_count: int
    final_count: int
    pass_rates: Dict[str, float]
    summary_stats: Dict

class MasterTickerFilter:
    """Master filter that orchestrates all filtering stages"""
    
    def __init__(self,
                 exchange_filter_config: str = 'moderate',
                 quality_filter_params: Optional[Dict] = None,
                 fundamental_filter_config: str = 'moderate',
                 enable_fundamental_filtering: bool = True,
                 max_tickers: Optional[int] = None,
                 min_overall_score: float = 0.65):
        """Initialize master ticker filter"""
        self.max_tickers = max_tickers
        self.min_overall_score = min_overall_score
        self.enable_fundamental_filtering = enable_fundamental_filtering
        
        # Initialize filters
        self.exchange_filter = FILTER_CONFIGS.get(exchange_filter_config, FILTER_CONFIGS['moderate'])
        self.quality_filter = TickerQualityFilter(**(quality_filter_params or {}))
        
        if enable_fundamental_filtering:
            self.fundamental_filter = FUNDAMENTAL_FILTER_CONFIGS.get(
                fundamental_filter_config, 
                FUNDAMENTAL_FILTER_CONFIGS['moderate']
            )
        else:
            self.fundamental_filter = None
    
    def filter_all_tickers(self, tickers: List[Dict]) -> FilteringResults:
        """Apply all filtering stages to ticker list"""
        original_count = len(tickers)
        logger.info(f"Starting comprehensive ticker filtering for {original_count} tickers")
        
        # Stage 1: Exchange Filtering
        exchange_filtered = self.exchange_filter.filter_by_exchange(tickers)
        exchange_filtered_count = len(exchange_filtered)
        
        if not exchange_filtered:
            return self._empty_results(original_count)
        
        # Stage 2: Technical Quality Filtering
        quality_filtered = self.quality_filter.filter_high_quality_tickers(
            exchange_filtered, min_quality_score=0.5
        )
        quality_filtered_count = len(quality_filtered)
        
        if not quality_filtered:
            return self._empty_results(original_count, exchange_filtered_count)
        
        # Stage 3: Fundamental Analysis (optional)
        fundamental_filtered_count = quality_filtered_count
        if self.enable_fundamental_filtering and self.fundamental_filter:
            fundamental_filtered = self.fundamental_filter.filter_by_fundamentals(quality_filtered)
            if fundamental_filtered:
                quality_filtered = fundamental_filtered
                fundamental_filtered_count = len(fundamental_filtered)
        
        # Stage 4: Final Scoring
        final_tickers = self._calculate_final_scores(quality_filtered)
        final_tickers = [t for t in final_tickers if t.get('final_quality_score', 0) >= self.min_overall_score]
        final_tickers.sort(key=lambda x: x.get('final_quality_score', 0), reverse=True)
        
        if self.max_tickers:
            final_tickers = final_tickers[:self.max_tickers]
        
        final_count = len(final_tickers)
        
        # Calculate results
        pass_rates = {
            'exchange': exchange_filtered_count / original_count if original_count > 0 else 0,
            'quality': quality_filtered_count / exchange_filtered_count if exchange_filtered_count > 0 else 0,
            'fundamental': fundamental_filtered_count / quality_filtered_count if quality_filtered_count > 0 else 0,
            'overall': final_count / original_count if original_count > 0 else 0
        }
        
        summary_stats = self._generate_summary_stats(final_tickers)
        
        return FilteringResults(
            original_count=original_count,
            filtered_tickers=final_tickers,
            exchange_filtered_count=exchange_filtered_count,
            quality_filtered_count=quality_filtered_count,
            fundamental_filtered_count=fundamental_filtered_count,
            final_count=final_count,
            pass_rates=pass_rates,
            summary_stats=summary_stats
        )
    
    def _empty_results(self, original_count: int, exchange_count: int = 0) -> FilteringResults:
        """Return empty results structure"""
        return FilteringResults(
            original_count=original_count,
            filtered_tickers=[],
            exchange_filtered_count=exchange_count,
            quality_filtered_count=0,
            fundamental_filtered_count=0,
            final_count=0,
            pass_rates={'exchange': exchange_count/original_count if original_count > 0 else 0, 
                       'quality': 0.0, 'fundamental': 0.0, 'overall': 0.0},
            summary_stats={}
        )
    
    def _calculate_final_scores(self, tickers: List[Dict]) -> List[Dict]:
        """Calculate final composite quality scores"""
        enhanced_tickers = []
        
        for ticker in tickers:
            exchange_score = ticker.get('exchange_quality_score', 0.5)
            quality_score = ticker.get('quality_score', 0.5)
            fundamental_score = ticker.get('fundamental_score', 0.5)
            
            # Adjust weights based on available data
            if ticker.get('fundamental_score'):
                weights = {'exchange': 0.2, 'quality': 0.4, 'fundamental': 0.4}
            else:
                weights = {'exchange': 0.3, 'quality': 0.7, 'fundamental': 0.0}
                fundamental_score = 0.5
            
            final_score = (
                exchange_score * weights['exchange'] +
                quality_score * weights['quality'] +
                fundamental_score * weights['fundamental']
            )
            
            # Tier classification
            if final_score >= 0.9:
                tier = 'S-Tier'
            elif final_score >= 0.8:
                tier = 'A-Tier'
            elif final_score >= 0.7:
                tier = 'B-Tier'
            elif final_score >= 0.6:
                tier = 'C-Tier'
            else:
                tier = 'D-Tier'
            
            enhanced_ticker = ticker.copy()
            enhanced_ticker.update({
                'final_quality_score': final_score,
                'quality_tier': tier,
                'component_scores': {
                    'exchange': exchange_score,
                    'quality': quality_score,
                    'fundamental': fundamental_score
                }
            })
            
            enhanced_tickers.append(enhanced_ticker)
        
        return enhanced_tickers
    
    def _generate_summary_stats(self, tickers: List[Dict]) -> Dict:
        """Generate comprehensive summary statistics"""
        if not tickers:
            return {}
        
        final_scores = [t.get('final_quality_score', 0) for t in tickers]
        tier_counts = {}
        exchange_counts = {}
        
        for ticker in tickers:
            tier = ticker.get('quality_tier', 'Unknown')
            tier_counts[tier] = tier_counts.get(tier, 0) + 1
            
            exchange = ticker.get('normalized_exchange', 'Unknown')
            exchange_counts[exchange] = exchange_counts.get(exchange, 0) + 1
        
        return {
            'total_filtered_tickers': len(tickers),
            'avg_final_score': sum(final_scores) / len(final_scores) if final_scores else 0,
            'tier_distribution': tier_counts,
            'exchange_distribution': exchange_counts,
            'score_distribution': {
                'excellent (>= 0.9)': sum(1 for s in final_scores if s >= 0.9),
                'very_good (>= 0.8)': sum(1 for s in final_scores if 0.8 <= s < 0.9),
                'good (>= 0.7)': sum(1 for s in final_scores if 0.7 <= s < 0.8),
                'fair (>= 0.6)': sum(1 for s in final_scores if 0.6 <= s < 0.7),
                'poor (< 0.6)': sum(1 for s in final_scores if s < 0.6)
            }
        }
