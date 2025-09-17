#!/usr/bin/env python3
"""
Exchange-Specific Filtering Utilities

This module provides specialized filtering for different stock exchanges
to ensure we only include tickers from reputable exchanges and apply
exchange-specific quality criteria.

Features:
- Exchange reputation scoring
- Exchange-specific market cap thresholds
- Regional market considerations
- Currency and regulatory filtering
- Exchange trading hour validation
"""

import logging
from typing import List, Dict, Set, Optional
from dataclasses import dataclass
from datetime import datetime

logger = logging.getLogger(__name__)

@dataclass
class ExchangeInfo:
    """Information about a stock exchange"""
    code: str
    name: str
    country: str
    currency: str
    reputation_score: float  # 0-1 scale
    min_market_cap_usd: float  # Minimum market cap in USD millions
    is_major_exchange: bool
    regulatory_quality: str  # 'high', 'medium', 'low'
    trading_hours_utc: Optional[str] = None

class ExchangeFilter:
    """Filter tickers based on exchange quality and characteristics"""
    
    # Comprehensive exchange database
    EXCHANGES = {
        # Major US Exchanges
        'NYSE': ExchangeInfo(
            code='NYSE',
            name='New York Stock Exchange',
            country='US',
            currency='USD',
            reputation_score=1.0,
            min_market_cap_usd=500,
            is_major_exchange=True,
            regulatory_quality='high',
            trading_hours_utc='14:30-21:00'
        ),
        'NASDAQ': ExchangeInfo(
            code='NASDAQ',
            name='NASDAQ Stock Market',
            country='US',
            currency='USD',
            reputation_score=1.0,
            min_market_cap_usd=300,
            is_major_exchange=True,
            regulatory_quality='high',
            trading_hours_utc='14:30-21:00'
        ),
        'AMEX': ExchangeInfo(
            code='AMEX',
            name='American Stock Exchange',
            country='US',
            currency='USD',
            reputation_score=0.8,
            min_market_cap_usd=100,
            is_major_exchange=False,
            regulatory_quality='high',
            trading_hours_utc='14:30-21:00'
        ),
        
        # Canadian Exchanges
        'TSX': ExchangeInfo(
            code='TSX',
            name='Toronto Stock Exchange',
            country='CA',
            currency='CAD',
            reputation_score=0.9,
            min_market_cap_usd=200,
            is_major_exchange=True,
            regulatory_quality='high',
            trading_hours_utc='14:30-21:00'
        ),
        'TSXV': ExchangeInfo(
            code='TSXV',
            name='TSX Venture Exchange',
            country='CA',
            currency='CAD',
            reputation_score=0.6,
            min_market_cap_usd=25,
            is_major_exchange=False,
            regulatory_quality='medium',
            trading_hours_utc='14:30-21:00'
        ),
        
        # European Exchanges
        'LSE': ExchangeInfo(
            code='LSE',
            name='London Stock Exchange',
            country='GB',
            currency='GBP',
            reputation_score=0.95,
            min_market_cap_usd=400,
            is_major_exchange=True,
            regulatory_quality='high',
            trading_hours_utc='08:00-16:30'
        ),
        'EURONEXT': ExchangeInfo(
            code='EURONEXT',
            name='Euronext',
            country='EU',
            currency='EUR',
            reputation_score=0.9,
            min_market_cap_usd=300,
            is_major_exchange=True,
            regulatory_quality='high',
            trading_hours_utc='08:00-16:30'
        ),
        'XETRA': ExchangeInfo(
            code='XETRA',
            name='Deutsche Börse XETRA',
            country='DE',
            currency='EUR',
            reputation_score=0.9,
            min_market_cap_usd=300,
            is_major_exchange=True,
            regulatory_quality='high',
            trading_hours_utc='08:00-16:30'
        ),
        'SIX': ExchangeInfo(
            code='SIX',
            name='SIX Swiss Exchange',
            country='CH',
            currency='CHF',
            reputation_score=0.85,
            min_market_cap_usd=250,
            is_major_exchange=False,
            regulatory_quality='high',
            trading_hours_utc='08:00-16:30'
        ),
        
        # Asian Exchanges
        'TSE': ExchangeInfo(
            code='TSE',
            name='Tokyo Stock Exchange',
            country='JP',
            currency='JPY',
            reputation_score=0.9,
            min_market_cap_usd=200,
            is_major_exchange=True,
            regulatory_quality='high',
            trading_hours_utc='00:00-06:00'
        ),
        'HKEX': ExchangeInfo(
            code='HKEX',
            name='Hong Kong Stock Exchange',
            country='HK',
            currency='HKD',
            reputation_score=0.85,
            min_market_cap_usd=200,
            is_major_exchange=True,
            regulatory_quality='high',
            trading_hours_utc='01:30-08:00'
        ),
        'SSE': ExchangeInfo(
            code='SSE',
            name='Shanghai Stock Exchange',
            country='CN',
            currency='CNY',
            reputation_score=0.7,
            min_market_cap_usd=150,
            is_major_exchange=True,
            regulatory_quality='medium',
            trading_hours_utc='01:30-07:00'
        ),
        'SZSE': ExchangeInfo(
            code='SZSE',
            name='Shenzhen Stock Exchange',
            country='CN',
            currency='CNY',
            reputation_score=0.7,
            min_market_cap_usd=100,
            is_major_exchange=True,
            regulatory_quality='medium',
            trading_hours_utc='01:30-07:00'
        ),
        'KRX': ExchangeInfo(
            code='KRX',
            name='Korea Exchange',
            country='KR',
            currency='KRW',
            reputation_score=0.8,
            min_market_cap_usd=100,
            is_major_exchange=True,
            regulatory_quality='high',
            trading_hours_utc='00:00-06:30'
        ),
        
        # Australian Exchange
        'ASX': ExchangeInfo(
            code='ASX',
            name='Australian Securities Exchange',
            country='AU',
            currency='AUD',
            reputation_score=0.8,
            min_market_cap_usd=150,
            is_major_exchange=True,
            regulatory_quality='high',
            trading_hours_utc='00:00-06:00'
        ),
        
        # Indian Exchanges
        'NSE': ExchangeInfo(
            code='NSE',
            name='National Stock Exchange of India',
            country='IN',
            currency='INR',
            reputation_score=0.75,
            min_market_cap_usd=100,
            is_major_exchange=True,
            regulatory_quality='medium',
            trading_hours_utc='03:45-10:00'
        ),
        'BSE': ExchangeInfo(
            code='BSE',
            name='Bombay Stock Exchange',
            country='IN',
            currency='INR',
            reputation_score=0.75,
            min_market_cap_usd=100,
            is_major_exchange=True,
            regulatory_quality='medium',
            trading_hours_utc='03:45-10:00'
        ),
        
        # Brazilian Exchange
        'B3': ExchangeInfo(
            code='B3',
            name='B3 - Brasil Bolsa Balcão',
            country='BR',
            currency='BRL',
            reputation_score=0.7,
            min_market_cap_usd=75,
            is_major_exchange=True,
            regulatory_quality='medium',
            trading_hours_utc='13:00-20:00'
        ),
        
        # Lower Quality Exchanges
        'OTC': ExchangeInfo(
            code='OTC',
            name='Over-The-Counter',
            country='US',
            currency='USD',
            reputation_score=0.3,
            min_market_cap_usd=50,
            is_major_exchange=False,
            regulatory_quality='low',
            trading_hours_utc='14:30-21:00'
        ),
        'OTCBB': ExchangeInfo(
            code='OTCBB',
            name='OTC Bulletin Board',
            country='US',
            currency='USD',
            reputation_score=0.3,
            min_market_cap_usd=25,
            is_major_exchange=False,
            regulatory_quality='low',
            trading_hours_utc='14:30-21:00'
        ),
        'PINK': ExchangeInfo(
            code='PINK',
            name='Pink Sheets',
            country='US',
            currency='USD',
            reputation_score=0.2,
            min_market_cap_usd=10,
            is_major_exchange=False,
            regulatory_quality='low',
            trading_hours_utc='14:30-21:00'
        ),
        'GREY': ExchangeInfo(
            code='GREY',
            name='Grey Market',
            country='US',
            currency='USD',
            reputation_score=0.1,
            min_market_cap_usd=5,
            is_major_exchange=False,
            regulatory_quality='low',
            trading_hours_utc='14:30-21:00'
        )
    }
    
    # Exchange aliases and variations
    EXCHANGE_ALIASES = {
        'NEW YORK STOCK EXCHANGE': 'NYSE',
        'NASDAQ GLOBAL SELECT': 'NASDAQ',
        'NASDAQ GLOBAL MARKET': 'NASDAQ',
        'NASDAQ CAPITAL MARKET': 'NASDAQ',
        'AMERICAN STOCK EXCHANGE': 'AMEX',
        'TORONTO STOCK EXCHANGE': 'TSX',
        'LONDON STOCK EXCHANGE': 'LSE',
        'DEUTSCHE BOERSE XETRA': 'XETRA',
        'TOKYO STOCK EXCHANGE': 'TSE',
        'HONG KONG STOCK EXCHANGE': 'HKEX',
        'AUSTRALIAN SECURITIES EXCHANGE': 'ASX',
        'NATIONAL STOCK EXCHANGE': 'NSE',
        'BOMBAY STOCK EXCHANGE': 'BSE',
        'OVER THE COUNTER': 'OTC',
        'OTC MARKETS': 'OTC',
        'PINK SHEETS': 'PINK',
        'PINK OTC MARKETS': 'PINK'
    }
    
    def __init__(self, 
                 min_reputation_score: float = 0.5,
                 exclude_otc: bool = True,
                 exclude_pink_sheets: bool = True,
                 major_exchanges_only: bool = False,
                 allowed_countries: Optional[Set[str]] = None,
                 excluded_countries: Optional[Set[str]] = None):
        """
        Initialize exchange filter with criteria
        
        Args:
            min_reputation_score: Minimum reputation score (0-1)
            exclude_otc: Exclude OTC markets
            exclude_pink_sheets: Exclude pink sheet markets
            major_exchanges_only: Only include major exchanges
            allowed_countries: Set of allowed country codes (if specified)
            excluded_countries: Set of excluded country codes
        """
        self.min_reputation_score = min_reputation_score
        self.exclude_otc = exclude_otc
        self.exclude_pink_sheets = exclude_pink_sheets
        self.major_exchanges_only = major_exchanges_only
        self.allowed_countries = allowed_countries
        self.excluded_countries = excluded_countries or set()
        
    def normalize_exchange_code(self, exchange: str) -> Optional[str]:
        """Normalize exchange name/code to standard format"""
        if not exchange:
            return None
            
        exchange_upper = exchange.upper().strip()
        
        # Direct match
        if exchange_upper in self.EXCHANGES:
            return exchange_upper
            
        # Alias match
        if exchange_upper in self.EXCHANGE_ALIASES:
            return self.EXCHANGE_ALIASES[exchange_upper]
            
        # Partial matching for common variations
        for alias, standard in self.EXCHANGE_ALIASES.items():
            if alias in exchange_upper or exchange_upper in alias:
                return standard
                
        # Common abbreviations
        if 'NYSE' in exchange_upper:
            return 'NYSE'
        elif 'NASDAQ' in exchange_upper:
            return 'NASDAQ'
        elif 'TSX' in exchange_upper and 'VENTURE' not in exchange_upper:
            return 'TSX'
        elif 'LSE' in exchange_upper or 'LONDON' in exchange_upper:
            return 'LSE'
        elif 'TOKYO' in exchange_upper or 'TSE' in exchange_upper:
            return 'TSE'
        elif 'HONG KONG' in exchange_upper or 'HKEX' in exchange_upper:
            return 'HKEX'
        elif 'AUSTRALIA' in exchange_upper or 'ASX' in exchange_upper:
            return 'ASX'
        elif 'OTC' in exchange_upper and 'PINK' not in exchange_upper:
            return 'OTC'
        elif 'PINK' in exchange_upper:
            return 'PINK'
            
        logger.debug(f"Unknown exchange: {exchange}")
        return None
    
    def get_exchange_info(self, exchange: str) -> Optional[ExchangeInfo]:
        """Get exchange information"""
        normalized = self.normalize_exchange_code(exchange)
        if normalized and normalized in self.EXCHANGES:
            return self.EXCHANGES[normalized]
        return None
    
    def is_exchange_allowed(self, exchange: str) -> bool:
        """Check if exchange meets filtering criteria"""
        exchange_info = self.get_exchange_info(exchange)
        
        if not exchange_info:
            return False
            
        # Check reputation score
        if exchange_info.reputation_score < self.min_reputation_score:
            return False
            
        # Check OTC exclusion
        if self.exclude_otc and exchange_info.code in ['OTC', 'OTCBB']:
            return False
            
        # Check pink sheets exclusion
        if self.exclude_pink_sheets and exchange_info.code in ['PINK', 'GREY']:
            return False
            
        # Check major exchanges only
        if self.major_exchanges_only and not exchange_info.is_major_exchange:
            return False
            
        # Check country restrictions
        if self.allowed_countries and exchange_info.country not in self.allowed_countries:
            return False
            
        if exchange_info.country in self.excluded_countries:
            return False
            
        return True
    
    def filter_by_exchange(self, tickers: List[Dict]) -> List[Dict]:
        """Filter tickers based on exchange criteria"""
        filtered_tickers = []
        
        exchange_stats = {}
        filtered_stats = {}
        
        for ticker in tickers:
            exchange = ticker.get('exchange', '')
            
            # Track statistics
            normalized_exchange = self.normalize_exchange_code(exchange)
            if normalized_exchange:
                exchange_stats[normalized_exchange] = exchange_stats.get(normalized_exchange, 0) + 1
            else:
                exchange_stats['UNKNOWN'] = exchange_stats.get('UNKNOWN', 0) + 1
            
            # Apply filter
            if self.is_exchange_allowed(exchange):
                # Add exchange info to ticker
                exchange_info = self.get_exchange_info(exchange)
                if exchange_info:
                    ticker_copy = ticker.copy()
                    ticker_copy.update({
                        'normalized_exchange': exchange_info.code,
                        'exchange_country': exchange_info.country,
                        'exchange_currency': exchange_info.currency,
                        'exchange_reputation_score': exchange_info.reputation_score,
                        'is_major_exchange': exchange_info.is_major_exchange,
                        'min_market_cap_usd': exchange_info.min_market_cap_usd
                    })
                    filtered_tickers.append(ticker_copy)
                    
                    # Track filtered stats
                    filtered_stats[exchange_info.code] = filtered_stats.get(exchange_info.code, 0) + 1
        
        # Log statistics
        logger.info(f"Exchange filtering results:")
        logger.info(f"  Input tickers: {len(tickers)}")
        logger.info(f"  Output tickers: {len(filtered_tickers)}")
        logger.info(f"  Filter rate: {len(filtered_tickers)/len(tickers)*100:.1f}%")
        
        logger.info("Exchange distribution (input):")
        for exchange, count in sorted(exchange_stats.items(), key=lambda x: x[1], reverse=True):
            logger.info(f"  {exchange}: {count}")
            
        logger.info("Exchange distribution (filtered):")
        for exchange, count in sorted(filtered_stats.items(), key=lambda x: x[1], reverse=True):
            logger.info(f"  {exchange}: {count}")
        
        return filtered_tickers
    
    def get_recommended_exchanges(self, region: str = 'global') -> List[str]:
        """Get list of recommended exchanges by region"""
        recommendations = {
            'global': ['NYSE', 'NASDAQ', 'LSE', 'TSE', 'HKEX', 'TSX', 'EURONEXT', 'ASX'],
            'us': ['NYSE', 'NASDAQ', 'AMEX'],
            'europe': ['LSE', 'EURONEXT', 'XETRA', 'SIX'],
            'asia': ['TSE', 'HKEX', 'SSE', 'SZSE', 'KRX', 'NSE', 'BSE'],
            'americas': ['NYSE', 'NASDAQ', 'TSX', 'B3'],
            'developed': ['NYSE', 'NASDAQ', 'LSE', 'TSE', 'HKEX', 'TSX', 'EURONEXT', 'XETRA', 'ASX'],
            'emerging': ['SSE', 'SZSE', 'NSE', 'BSE', 'B3', 'KRX']
        }
        
        return recommendations.get(region.lower(), recommendations['global'])
    
    def create_exchange_summary(self, tickers: List[Dict]) -> Dict:
        """Create summary of exchange distribution and quality"""
        exchange_counts = {}
        exchange_quality_scores = {}
        total_market_cap_by_exchange = {}
        
        for ticker in tickers:
            exchange = ticker.get('normalized_exchange', 'UNKNOWN')
            market_cap = ticker.get('market_cap', 0) or 0
            
            exchange_counts[exchange] = exchange_counts.get(exchange, 0) + 1
            
            if exchange in self.EXCHANGES:
                score = self.EXCHANGES[exchange].reputation_score
                if exchange not in exchange_quality_scores:
                    exchange_quality_scores[exchange] = []
                exchange_quality_scores[exchange].append(score)
                
            total_market_cap_by_exchange[exchange] = total_market_cap_by_exchange.get(exchange, 0) + market_cap
        
        # Calculate average quality scores
        avg_quality_scores = {
            exchange: sum(scores) / len(scores)
            for exchange, scores in exchange_quality_scores.items()
        }
        
        summary = {
            'total_exchanges': len(exchange_counts),
            'total_tickers': sum(exchange_counts.values()),
            'exchange_distribution': dict(sorted(exchange_counts.items(), key=lambda x: x[1], reverse=True)),
            'exchange_quality_scores': avg_quality_scores,
            'total_market_cap_by_exchange': total_market_cap_by_exchange,
            'major_exchanges_count': sum(
                count for exchange, count in exchange_counts.items()
                if exchange in self.EXCHANGES and self.EXCHANGES[exchange].is_major_exchange
            ),
            'high_quality_exchanges_count': sum(
                count for exchange, count in exchange_counts.items()
                if exchange in self.EXCHANGES and self.EXCHANGES[exchange].reputation_score >= 0.8
            )
        }
        
        return summary

# Predefined filter configurations
FILTER_CONFIGS = {
    'conservative': ExchangeFilter(
        min_reputation_score=0.8,
        exclude_otc=True,
        exclude_pink_sheets=True,
        major_exchanges_only=True
    ),
    'moderate': ExchangeFilter(
        min_reputation_score=0.6,
        exclude_otc=True,
        exclude_pink_sheets=True,
        major_exchanges_only=False
    ),
    'liberal': ExchangeFilter(
        min_reputation_score=0.4,
        exclude_otc=False,
        exclude_pink_sheets=True,
        major_exchanges_only=False
    ),
    'us_only': ExchangeFilter(
        min_reputation_score=0.7,
        exclude_otc=True,
        exclude_pink_sheets=True,
        allowed_countries={'US'}
    ),
    'developed_markets': ExchangeFilter(
        min_reputation_score=0.7,
        exclude_otc=True,
        exclude_pink_sheets=True,
        allowed_countries={'US', 'CA', 'GB', 'DE', 'FR', 'JP', 'AU', 'CH'}
    )
}
