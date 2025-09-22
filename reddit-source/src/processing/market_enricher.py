"""
Market data enrichment system for validating tickers and adding price context.
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional
import yfinance as yf
import httpx

from ..config.settings import get_settings

logger = logging.getLogger(__name__)

# Silence yfinance debug logging
logging.getLogger("yfinance").setLevel(logging.ERROR)
logging.getLogger("peewee").setLevel(logging.ERROR)


class MarketDataEnricher:
    """
    Enriches Reddit posts with real-time market data and ticker validation.
    """
    
    def __init__(self):
        self.settings = get_settings()
        self.client = httpx.AsyncClient(timeout=30.0)
        
    async def enrich_post_with_market_data(self, post_data: Dict) -> Dict:
        """
        Add market data context to processed posts.
        
        Args:
            post_data: Processed post with extracted tickers
            
        Returns:
            Enhanced post data with market context
        """
        if not post_data.get('tickers'):
            return post_data
            
        try:
            tickers = post_data['tickers']
            if isinstance(tickers, str):
                tickers = eval(tickers)  # Handle JSON string
                
            # Validate and enrich each ticker
            market_data = {}
            valid_tickers = []
            
            for ticker in tickers[:5]:  # Limit to 5 tickers per post
                ticker_data = await self.get_ticker_data(ticker)
                if ticker_data:
                    market_data[ticker] = ticker_data
                    valid_tickers.append(ticker)
                    
            # Update post with validated tickers and market data
            post_data['tickers'] = valid_tickers
            post_data['market_data'] = market_data
            
            # Add market context flags
            post_data['market_context'] = self._analyze_market_context(market_data)
            
            return post_data
            
        except Exception as e:
            logger.error(f"Error enriching post with market data: {e}")
            return post_data
    
    async def get_ticker_data(self, ticker: str) -> Optional[Dict]:
        """
        Get real-time market data for a ticker.
        
        Args:
            ticker: Stock symbol to lookup
            
        Returns:
            Dictionary with market data or None if invalid
        """
        try:
            # Use yfinance for reliable data
            stock = yf.Ticker(ticker)
            info = stock.info
            hist = stock.history(period="5d")
            
            if hist.empty or not info.get('regularMarketPrice'):
                return None
                
            # Extract key metrics
            current_price = info.get('regularMarketPrice', hist['Close'].iloc[-1])
            prev_close = info.get('previousClose', hist['Close'].iloc[-2] if len(hist) > 1 else current_price)
            volume = info.get('regularMarketVolume', hist['Volume'].iloc[-1])
            
            # Calculate metrics
            price_change = current_price - prev_close
            price_change_pct = (price_change / prev_close) * 100 if prev_close > 0 else 0
            avg_volume = hist['Volume'].mean() if len(hist) > 1 else volume
            
            return {
                'symbol': ticker,
                'price': round(current_price, 2),
                'price_change': round(price_change, 2),
                'price_change_pct': round(price_change_pct, 2),
                'volume': int(volume),
                'avg_volume': int(avg_volume),
                'market_cap': info.get('marketCap'),
                'sector': info.get('sector'),
                'industry': info.get('industry'),
                'pe_ratio': info.get('trailingPE'),
                'is_active': volume > 1000,  # Basic activity check
                'retrieved_at': datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.debug(f"Could not get data for ticker {ticker}: {e}")
            return None
    
    def _analyze_market_context(self, market_data: Dict) -> Dict:
        """
        Analyze market context from ticker data.
        
        Args:
            market_data: Dictionary of ticker -> market data
            
        Returns:
            Market context analysis
        """
        if not market_data:
            return {}
            
        context = {
            'total_tickers': len(market_data),
            'valid_tickers': len([t for t in market_data.values() if t.get('is_active')]),
            'sectors': list(set(t.get('sector') for t in market_data.values() if t.get('sector'))),
            'avg_price_change': 0,
            'high_volume_tickers': [],
            'large_moves': []
        }
        
        # Calculate aggregate metrics
        price_changes = []
        for ticker, data in market_data.items():
            if data.get('price_change_pct'):
                price_changes.append(data['price_change_pct'])
                
                # Flag significant moves
                if abs(data['price_change_pct']) > 5:
                    context['large_moves'].append({
                        'ticker': ticker,
                        'change_pct': data['price_change_pct']
                    })
                
                # Flag high volume
                if data.get('volume', 0) > data.get('avg_volume', 0) * 2:
                    context['high_volume_tickers'].append(ticker)
        
        if price_changes:
            context['avg_price_change'] = round(sum(price_changes) / len(price_changes), 2)
            
        return context
    
    async def __aenter__(self):
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.client.aclose()
