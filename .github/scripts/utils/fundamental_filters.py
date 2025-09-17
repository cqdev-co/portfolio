#!/usr/bin/env python3
"""
Fundamental Analysis Filtering Utilities

This module provides fundamental analysis-based filtering to identify
financially healthy companies and filter out potentially problematic
tickers that could negatively impact model training and backtesting.

Key Filtering Criteria:
- Financial Health: Debt ratios, profitability, cash flow
- Market Position: Market cap, revenue growth, market share
- Operational Efficiency: ROE, ROA, profit margins
- Stability Metrics: Earnings consistency, dividend history
- Risk Factors: Beta, volatility, sector concentration
"""

import logging
import requests
import time
from typing import List, Dict, Optional, Set, Tuple, Union
from dataclasses import dataclass
from datetime import datetime, timedelta
import yfinance as yf
import pandas as pd
from concurrent.futures import ThreadPoolExecutor, as_completed

logger = logging.getLogger(__name__)

@dataclass
class FundamentalMetrics:
    """Comprehensive fundamental analysis metrics"""
    symbol: str
    
    # Valuation Metrics
    market_cap: Optional[float] = None
    enterprise_value: Optional[float] = None
    pe_ratio: Optional[float] = None
    forward_pe: Optional[float] = None
    peg_ratio: Optional[float] = None
    price_to_book: Optional[float] = None
    price_to_sales: Optional[float] = None
    ev_to_revenue: Optional[float] = None
    ev_to_ebitda: Optional[float] = None
    
    # Profitability Metrics
    gross_margins: Optional[float] = None
    operating_margins: Optional[float] = None
    profit_margins: Optional[float] = None
    return_on_equity: Optional[float] = None
    return_on_assets: Optional[float] = None
    return_on_capital: Optional[float] = None
    
    # Financial Health Metrics
    debt_to_equity: Optional[float] = None
    current_ratio: Optional[float] = None
    quick_ratio: Optional[float] = None
    cash_ratio: Optional[float] = None
    interest_coverage: Optional[float] = None
    
    # Growth Metrics
    revenue_growth: Optional[float] = None
    earnings_growth: Optional[float] = None
    revenue_growth_3y: Optional[float] = None
    earnings_growth_3y: Optional[float] = None
    
    # Efficiency Metrics
    asset_turnover: Optional[float] = None
    inventory_turnover: Optional[float] = None
    receivables_turnover: Optional[float] = None
    
    # Market Metrics
    beta: Optional[float] = None
    shares_outstanding: Optional[float] = None
    float_shares: Optional[float] = None
    insider_ownership: Optional[float] = None
    institutional_ownership: Optional[float] = None
    
    # Dividend Metrics
    dividend_yield: Optional[float] = None
    payout_ratio: Optional[float] = None
    dividend_growth_rate: Optional[float] = None
    
    # Quality Scores
    financial_health_score: Optional[float] = None
    profitability_score: Optional[float] = None
    growth_score: Optional[float] = None
    valuation_score: Optional[float] = None
    overall_fundamental_score: Optional[float] = None
    
    # Flags
    is_profitable: bool = False
    is_growing: bool = False
    is_financially_stable: bool = False
    has_sustainable_debt: bool = False
    passes_fundamental_filters: bool = False

class FundamentalFilter:
    """Filter tickers based on fundamental analysis criteria"""
    
    # Industry-specific thresholds
    INDUSTRY_THRESHOLDS = {
        'Technology': {
            'min_gross_margin': 0.4,
            'max_pe_ratio': 50,
            'min_roe': 0.10,
            'max_debt_to_equity': 0.5
        },
        'Healthcare': {
            'min_gross_margin': 0.5,
            'max_pe_ratio': 30,
            'min_roe': 0.12,
            'max_debt_to_equity': 0.6
        },
        'Financial Services': {
            'min_roe': 0.08,
            'max_pe_ratio': 15,
            'min_book_value': 1.0,
            'max_debt_to_equity': 5.0  # Banks have higher leverage
        },
        'Consumer Cyclical': {
            'min_gross_margin': 0.25,
            'max_pe_ratio': 25,
            'min_roe': 0.10,
            'max_debt_to_equity': 0.8
        },
        'Consumer Defensive': {
            'min_gross_margin': 0.20,
            'max_pe_ratio': 20,
            'min_roe': 0.12,
            'max_debt_to_equity': 0.7
        },
        'Industrial': {
            'min_gross_margin': 0.15,
            'max_pe_ratio': 25,
            'min_roe': 0.10,
            'max_debt_to_equity': 0.8
        },
        'Energy': {
            'min_gross_margin': 0.10,
            'max_pe_ratio': 15,
            'min_roe': 0.08,
            'max_debt_to_equity': 1.0
        },
        'Utilities': {
            'min_gross_margin': 0.25,
            'max_pe_ratio': 18,
            'min_roe': 0.08,
            'max_debt_to_equity': 1.2
        },
        'Real Estate': {
            'min_gross_margin': 0.30,
            'max_pe_ratio': 20,
            'min_roe': 0.06,
            'max_debt_to_equity': 2.0
        },
        'Materials': {
            'min_gross_margin': 0.15,
            'max_pe_ratio': 20,
            'min_roe': 0.08,
            'max_debt_to_equity': 0.8
        },
        'Communication Services': {
            'min_gross_margin': 0.35,
            'max_pe_ratio': 30,
            'min_roe': 0.10,
            'max_debt_to_equity': 0.8
        }
    }
    
    def __init__(self,
                 min_market_cap: float = 1000,  # Million USD
                 max_pe_ratio: float = 40,
                 min_roe: float = 0.05,
                 max_debt_to_equity: float = 1.0,
                 min_current_ratio: float = 1.0,
                 min_profit_margin: float = 0.02,
                 min_revenue_growth: float = -0.1,  # Allow slight decline
                 require_profitability: bool = True,
                 exclude_penny_stocks: bool = True,
                 batch_size: int = 20,
                 max_workers: int = 5):
        """
        Initialize fundamental filter with criteria
        
        Args:
            min_market_cap: Minimum market cap in millions USD
            max_pe_ratio: Maximum P/E ratio
            min_roe: Minimum return on equity
            max_debt_to_equity: Maximum debt-to-equity ratio
            min_current_ratio: Minimum current ratio
            min_profit_margin: Minimum profit margin
            min_revenue_growth: Minimum revenue growth rate
            require_profitability: Require positive net income
            exclude_penny_stocks: Exclude stocks under $5
            batch_size: Batch size for processing
            max_workers: Maximum concurrent workers
        """
        self.min_market_cap = min_market_cap * 1_000_000  # Convert to actual value
        self.max_pe_ratio = max_pe_ratio
        self.min_roe = min_roe
        self.max_debt_to_equity = max_debt_to_equity
        self.min_current_ratio = min_current_ratio
        self.min_profit_margin = min_profit_margin
        self.min_revenue_growth = min_revenue_growth
        self.require_profitability = require_profitability
        self.exclude_penny_stocks = exclude_penny_stocks
        self.batch_size = batch_size
        self.max_workers = max_workers
        
    def fetch_fundamental_data(self, symbol: str) -> Optional[Dict]:
        """Fetch comprehensive fundamental data for a ticker"""
        try:
            ticker = yf.Ticker(symbol)
            
            # Get basic info
            info = ticker.info
            
            # Get financial statements
            try:
                financials = ticker.financials
                balance_sheet = ticker.balance_sheet
                cashflow = ticker.cashflow
            except:
                financials = balance_sheet = cashflow = pd.DataFrame()
            
            # Extract key metrics
            data = {
                'symbol': symbol,
                
                # Basic Info
                'market_cap': info.get('marketCap'),
                'enterprise_value': info.get('enterpriseValue'),
                'shares_outstanding': info.get('sharesOutstanding'),
                'float_shares': info.get('floatShares'),
                'sector': info.get('sector'),
                'industry': info.get('industry'),
                
                # Valuation Metrics
                'pe_ratio': info.get('trailingPE'),
                'forward_pe': info.get('forwardPE'),
                'peg_ratio': info.get('pegRatio'),
                'price_to_book': info.get('priceToBook'),
                'price_to_sales': info.get('priceToSalesTrailing12Months'),
                'ev_to_revenue': info.get('enterpriseToRevenue'),
                'ev_to_ebitda': info.get('enterpriseToEbitda'),
                
                # Profitability Metrics
                'gross_margins': info.get('grossMargins'),
                'operating_margins': info.get('operatingMargins'),
                'profit_margins': info.get('profitMargins'),
                'return_on_equity': info.get('returnOnEquity'),
                'return_on_assets': info.get('returnOnAssets'),
                
                # Financial Health Metrics
                'debt_to_equity': info.get('debtToEquity'),
                'current_ratio': info.get('currentRatio'),
                'quick_ratio': info.get('quickRatio'),
                'total_cash': info.get('totalCash'),
                'total_debt': info.get('totalDebt'),
                
                # Growth Metrics
                'revenue_growth': info.get('revenueGrowth'),
                'earnings_growth': info.get('earningsGrowth'),
                'revenue_quarterly_growth': info.get('revenueQuarterlyGrowth'),
                'earnings_quarterly_growth': info.get('earningsQuarterlyGrowth'),
                
                # Other Metrics
                'beta': info.get('beta'),
                'dividend_yield': info.get('dividendYield'),
                'payout_ratio': info.get('payoutRatio'),
                'insider_ownership': info.get('heldPercentInsiders'),
                'institutional_ownership': info.get('heldPercentInstitutions'),
                
                # Financial Statement Data
                'total_revenue': info.get('totalRevenue'),
                'net_income': info.get('netIncomeToCommon'),
                'total_assets': info.get('totalAssets'),
                'total_liabilities': info.get('totalLiab'),
                'book_value': info.get('bookValue'),
                'cash_and_equivalents': info.get('totalCashFromOperatingActivities'),
                
                # Quality Indicators
                'audit_risk': info.get('auditRisk'),
                'board_risk': info.get('boardRisk'),
                'compensation_risk': info.get('compensationRisk'),
                'shareholder_rights_risk': info.get('shareHolderRightsRisk'),
                'overall_risk': info.get('overallRisk'),
            }
            
            return data
            
        except Exception as e:
            logger.debug(f"Error fetching fundamental data for {symbol}: {e}")
            return None
    
    def calculate_fundamental_scores(self, data: Dict) -> FundamentalMetrics:
        """Calculate comprehensive fundamental analysis scores"""
        symbol = data['symbol']
        
        # Extract metrics with safe defaults
        market_cap = data.get('market_cap', 0) or 0
        pe_ratio = data.get('pe_ratio')
        roe = data.get('return_on_equity')
        debt_to_equity = data.get('debt_to_equity')
        current_ratio = data.get('current_ratio')
        profit_margins = data.get('profit_margins')
        gross_margins = data.get('gross_margins')
        revenue_growth = data.get('revenue_growth')
        earnings_growth = data.get('earnings_growth')
        beta = data.get('beta')
        
        # Financial Health Score (0-1)
        financial_health_score = 0.5  # Default neutral
        health_factors = 0
        
        if debt_to_equity is not None:
            if debt_to_equity <= 0.3:
                financial_health_score += 0.2
            elif debt_to_equity <= 0.6:
                financial_health_score += 0.1
            elif debt_to_equity >= 2.0:
                financial_health_score -= 0.2
            health_factors += 1
            
        if current_ratio is not None:
            if current_ratio >= 2.0:
                financial_health_score += 0.15
            elif current_ratio >= 1.5:
                financial_health_score += 0.1
            elif current_ratio < 1.0:
                financial_health_score -= 0.2
            health_factors += 1
            
        if health_factors > 0:
            financial_health_score = max(0, min(1, financial_health_score))
        
        # Profitability Score (0-1)
        profitability_score = 0.5  # Default neutral
        profit_factors = 0
        
        if roe is not None:
            if roe >= 0.20:
                profitability_score += 0.25
            elif roe >= 0.15:
                profitability_score += 0.2
            elif roe >= 0.10:
                profitability_score += 0.1
            elif roe <= 0:
                profitability_score -= 0.3
            profit_factors += 1
            
        if profit_margins is not None:
            if profit_margins >= 0.15:
                profitability_score += 0.2
            elif profit_margins >= 0.10:
                profitability_score += 0.15
            elif profit_margins >= 0.05:
                profitability_score += 0.1
            elif profit_margins <= 0:
                profitability_score -= 0.3
            profit_factors += 1
            
        if gross_margins is not None:
            if gross_margins >= 0.50:
                profitability_score += 0.1
            elif gross_margins >= 0.30:
                profitability_score += 0.05
            elif gross_margins <= 0.10:
                profitability_score -= 0.1
            profit_factors += 1
            
        if profit_factors > 0:
            profitability_score = max(0, min(1, profitability_score))
        
        # Growth Score (0-1)
        growth_score = 0.5  # Default neutral
        growth_factors = 0
        
        if revenue_growth is not None:
            if revenue_growth >= 0.20:
                growth_score += 0.25
            elif revenue_growth >= 0.10:
                growth_score += 0.2
            elif revenue_growth >= 0.05:
                growth_score += 0.1
            elif revenue_growth <= -0.10:
                growth_score -= 0.2
            growth_factors += 1
            
        if earnings_growth is not None:
            if earnings_growth >= 0.20:
                growth_score += 0.25
            elif earnings_growth >= 0.10:
                growth_score += 0.15
            elif earnings_growth >= 0.05:
                growth_score += 0.1
            elif earnings_growth <= -0.15:
                growth_score -= 0.25
            growth_factors += 1
            
        if growth_factors > 0:
            growth_score = max(0, min(1, growth_score))
        
        # Valuation Score (0-1) - Lower P/E is better
        valuation_score = 0.5  # Default neutral
        
        if pe_ratio is not None and pe_ratio > 0:
            if pe_ratio <= 15:
                valuation_score = 0.9
            elif pe_ratio <= 20:
                valuation_score = 0.8
            elif pe_ratio <= 25:
                valuation_score = 0.7
            elif pe_ratio <= 35:
                valuation_score = 0.6
            elif pe_ratio <= 50:
                valuation_score = 0.4
            else:
                valuation_score = 0.2
        
        # Overall Fundamental Score (weighted average)
        weights = {
            'financial_health': 0.3,
            'profitability': 0.3,
            'growth': 0.25,
            'valuation': 0.15
        }
        
        overall_score = (
            financial_health_score * weights['financial_health'] +
            profitability_score * weights['profitability'] +
            growth_score * weights['growth'] +
            valuation_score * weights['valuation']
        )
        
        # Quality flags
        is_profitable = (profit_margins or 0) > 0 and (roe or 0) > 0
        is_growing = (revenue_growth or -1) > 0 or (earnings_growth or -1) > 0
        is_financially_stable = (
            (debt_to_equity or 999) <= self.max_debt_to_equity and
            (current_ratio or 0) >= self.min_current_ratio
        )
        has_sustainable_debt = (debt_to_equity or 999) <= 1.5
        
        # Basic filters check
        passes_basic = (
            market_cap >= self.min_market_cap and
            (not self.require_profitability or is_profitable) and
            (pe_ratio is None or pe_ratio <= self.max_pe_ratio) and
            (roe is None or roe >= self.min_roe) and
            (debt_to_equity is None or debt_to_equity <= self.max_debt_to_equity) and
            (current_ratio is None or current_ratio >= self.min_current_ratio) and
            (profit_margins is None or profit_margins >= self.min_profit_margin) and
            (revenue_growth is None or revenue_growth >= self.min_revenue_growth)
        )
        
        return FundamentalMetrics(
            symbol=symbol,
            market_cap=market_cap,
            pe_ratio=pe_ratio,
            forward_pe=data.get('forward_pe'),
            peg_ratio=data.get('peg_ratio'),
            price_to_book=data.get('price_to_book'),
            price_to_sales=data.get('price_to_sales'),
            ev_to_revenue=data.get('ev_to_revenue'),
            ev_to_ebitda=data.get('ev_to_ebitda'),
            gross_margins=gross_margins,
            operating_margins=data.get('operating_margins'),
            profit_margins=profit_margins,
            return_on_equity=roe,
            return_on_assets=data.get('return_on_assets'),
            debt_to_equity=debt_to_equity,
            current_ratio=current_ratio,
            quick_ratio=data.get('quick_ratio'),
            revenue_growth=revenue_growth,
            earnings_growth=earnings_growth,
            beta=beta,
            shares_outstanding=data.get('shares_outstanding'),
            dividend_yield=data.get('dividend_yield'),
            payout_ratio=data.get('payout_ratio'),
            insider_ownership=data.get('insider_ownership'),
            institutional_ownership=data.get('institutional_ownership'),
            financial_health_score=financial_health_score,
            profitability_score=profitability_score,
            growth_score=growth_score,
            valuation_score=valuation_score,
            overall_fundamental_score=overall_score,
            is_profitable=is_profitable,
            is_growing=is_growing,
            is_financially_stable=is_financially_stable,
            has_sustainable_debt=has_sustainable_debt,
            passes_fundamental_filters=passes_basic
        )
    
    def filter_by_fundamentals(self, tickers: List[Dict]) -> List[Dict]:
        """Filter tickers based on fundamental analysis criteria"""
        logger.info(f"Starting fundamental analysis of {len(tickers)} tickers...")
        
        filtered_tickers = []
        
        def process_ticker(ticker_info):
            symbol = ticker_info['symbol']
            
            # Fetch fundamental data
            fundamental_data = self.fetch_fundamental_data(symbol)
            
            if not fundamental_data:
                return None
                
            # Calculate metrics and scores
            metrics = self.calculate_fundamental_scores(fundamental_data)
            
            return ticker_info, metrics
        
        # Process in batches with threading
        for i in range(0, len(tickers), self.batch_size):
            batch = tickers[i:i + self.batch_size]
            logger.info(f"Processing fundamental batch {i//self.batch_size + 1}/{(len(tickers)-1)//self.batch_size + 1}")
            
            with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
                future_to_ticker = {
                    executor.submit(process_ticker, ticker): ticker 
                    for ticker in batch
                }
                
                for future in as_completed(future_to_ticker):
                    try:
                        result = future.result()
                        if result:
                            ticker_info, metrics = result
                            
                            # Apply fundamental filters
                            if metrics.passes_fundamental_filters:
                                # Enhance ticker with fundamental data
                                enhanced_ticker = ticker_info.copy()
                                enhanced_ticker.update({
                                    'fundamental_score': metrics.overall_fundamental_score,
                                    'financial_health_score': metrics.financial_health_score,
                                    'profitability_score': metrics.profitability_score,
                                    'growth_score': metrics.growth_score,
                                    'valuation_score': metrics.valuation_score,
                                    'market_cap': metrics.market_cap,
                                    'pe_ratio': metrics.pe_ratio,
                                    'roe': metrics.return_on_equity,
                                    'debt_to_equity': metrics.debt_to_equity,
                                    'profit_margins': metrics.profit_margins,
                                    'revenue_growth': metrics.revenue_growth,
                                    'is_profitable': metrics.is_profitable,
                                    'is_growing': metrics.is_growing,
                                    'is_financially_stable': metrics.is_financially_stable,
                                    'passes_fundamental_analysis': True
                                })
                                
                                filtered_tickers.append(enhanced_ticker)
                                
                    except Exception as e:
                        ticker = future_to_ticker[future]
                        logger.error(f"Error processing fundamental analysis for {ticker['symbol']}: {e}")
                        continue
            
            # Rate limiting between batches
            time.sleep(1)
        
        logger.info(
            f"Fundamental filtering complete: {len(filtered_tickers)} / {len(tickers)} tickers passed "
            f"({len(filtered_tickers)/len(tickers)*100:.1f}% pass rate)"
        )
        
        # Sort by fundamental score
        filtered_tickers.sort(key=lambda x: x['fundamental_score'], reverse=True)
        
        return filtered_tickers
    
    def create_fundamental_summary(self, tickers: List[Dict]) -> Dict:
        """Create summary of fundamental analysis results"""
        if not tickers:
            return {}
        
        # Collect metrics
        fundamental_scores = [t.get('fundamental_score', 0) for t in tickers if t.get('fundamental_score')]
        market_caps = [t.get('market_cap', 0) for t in tickers if t.get('market_cap')]
        pe_ratios = [t.get('pe_ratio', 0) for t in tickers if t.get('pe_ratio') and t.get('pe_ratio') > 0]
        roe_values = [t.get('roe', 0) for t in tickers if t.get('roe')]
        
        # Count categories
        profitable_count = sum(1 for t in tickers if t.get('is_profitable'))
        growing_count = sum(1 for t in tickers if t.get('is_growing'))
        stable_count = sum(1 for t in tickers if t.get('is_financially_stable'))
        
        # Score distribution
        score_distribution = {
            'excellent (>= 0.8)': sum(1 for s in fundamental_scores if s >= 0.8),
            'very_good (>= 0.7)': sum(1 for s in fundamental_scores if 0.7 <= s < 0.8),
            'good (>= 0.6)': sum(1 for s in fundamental_scores if 0.6 <= s < 0.7),
            'fair (>= 0.5)': sum(1 for s in fundamental_scores if 0.5 <= s < 0.6),
            'poor (< 0.5)': sum(1 for s in fundamental_scores if s < 0.5)
        }
        
        summary = {
            'total_tickers': len(tickers),
            'profitable_companies': profitable_count,
            'growing_companies': growing_count,
            'financially_stable_companies': stable_count,
            'profitability_rate': (profitable_count / len(tickers)) * 100,
            'growth_rate': (growing_count / len(tickers)) * 100,
            'stability_rate': (stable_count / len(tickers)) * 100,
            'avg_fundamental_score': sum(fundamental_scores) / len(fundamental_scores) if fundamental_scores else 0,
            'avg_market_cap_billions': (sum(market_caps) / len(market_caps)) / 1_000_000_000 if market_caps else 0,
            'avg_pe_ratio': sum(pe_ratios) / len(pe_ratios) if pe_ratios else 0,
            'avg_roe': sum(roe_values) / len(roe_values) if roe_values else 0,
            'score_distribution': score_distribution,
            'market_cap_distribution': {
                'mega_cap (>200B)': sum(1 for mc in market_caps if mc > 200_000_000_000),
                'large_cap (10B-200B)': sum(1 for mc in market_caps if 10_000_000_000 <= mc <= 200_000_000_000),
                'mid_cap (2B-10B)': sum(1 for mc in market_caps if 2_000_000_000 <= mc < 10_000_000_000),
                'small_cap (300M-2B)': sum(1 for mc in market_caps if 300_000_000 <= mc < 2_000_000_000),
                'micro_cap (<300M)': sum(1 for mc in market_caps if mc < 300_000_000)
            }
        }
        
        return summary

# Predefined filter configurations
FUNDAMENTAL_FILTER_CONFIGS = {
    'conservative': FundamentalFilter(
        min_market_cap=5000,  # 5B minimum
        max_pe_ratio=25,
        min_roe=0.12,
        max_debt_to_equity=0.5,
        min_current_ratio=1.5,
        min_profit_margin=0.05,
        require_profitability=True
    ),
    'moderate': FundamentalFilter(
        min_market_cap=1000,  # 1B minimum
        max_pe_ratio=35,
        min_roe=0.08,
        max_debt_to_equity=0.8,
        min_current_ratio=1.2,
        min_profit_margin=0.02,
        require_profitability=True
    ),
    'growth_focused': FundamentalFilter(
        min_market_cap=500,  # 500M minimum
        max_pe_ratio=60,  # Allow higher P/E for growth
        min_roe=0.05,
        max_debt_to_equity=1.0,
        min_current_ratio=1.0,
        min_profit_margin=0.0,  # Allow unprofitable growth companies
        min_revenue_growth=0.10,  # Require 10% revenue growth
        require_profitability=False
    ),
    'value_focused': FundamentalFilter(
        min_market_cap=2000,  # 2B minimum
        max_pe_ratio=20,  # Low P/E for value
        min_roe=0.10,
        max_debt_to_equity=0.6,
        min_current_ratio=1.5,
        min_profit_margin=0.05,
        require_profitability=True
    ),
    'large_cap_only': FundamentalFilter(
        min_market_cap=10000,  # 10B minimum
        max_pe_ratio=30,
        min_roe=0.10,
        max_debt_to_equity=0.7,
        min_current_ratio=1.3,
        min_profit_margin=0.03,
        require_profitability=True
    )
}
