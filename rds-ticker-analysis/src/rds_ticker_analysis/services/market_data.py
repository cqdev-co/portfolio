"""Market data service with yfinance integration and technical analysis."""

import asyncio
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Dict, List, Optional, Tuple

import yfinance as yf
from loguru import logger

from rds_ticker_analysis.models.market import (
    Exchange,
    MarketData,
    MarketSector,
    OHLCV,
    PriceHistory,
    SecurityType,
    TechnicalIndicators,
    TickerInfo,
    TrendDirection,
)
from rds_ticker_analysis.utils.technical_analysis import TechnicalAnalyzer


class MarketDataService:
    """
    Enterprise-grade market data service with yfinance integration.
    
    Features:
    - Real-time and historical price data
    - Technical indicator calculations
    - Ticker information and validation
    - Multi-symbol batch processing
    - Data quality assessment and caching
    """
    
    def __init__(
        self,
        cache_duration_minutes: int = 5,
        max_concurrent_requests: int = 10,
    ) -> None:
        """
        Initialize the market data service.
        
        Args:
            cache_duration_minutes: How long to cache data
            max_concurrent_requests: Max concurrent API requests
        """
        self.cache_duration = timedelta(minutes=cache_duration_minutes)
        self.max_concurrent = max_concurrent_requests
        
        # Simple in-memory cache
        self._cache: Dict[str, Tuple[datetime, any]] = {}
        
        # Initialize technical analyzer
        self.technical_analyzer = TechnicalAnalyzer()
        
        # Rate limiting semaphore
        self._semaphore = asyncio.Semaphore(max_concurrent_requests)
        
        logger.info(f"Initialized MarketDataService with {cache_duration_minutes}min cache")
    
    async def get_ticker_info(self, symbol: str) -> Optional[TickerInfo]:
        """
        Get comprehensive ticker information.
        
        Args:
            symbol: Ticker symbol
            
        Returns:
            TickerInfo object or None if not found
        """
        cache_key = f"info_{symbol}"
        cached_data = self._get_cached_data(cache_key)
        if cached_data:
            return cached_data
        
        try:
            async with self._semaphore:
                ticker = yf.Ticker(symbol)
                info = ticker.info
                
                if not info or 'symbol' not in info:
                    logger.warning(f"No info found for ticker {symbol}")
                    return None
                
                # Map yfinance data to our model
                ticker_info = TickerInfo(
                    symbol=symbol.upper(),
                    name=info.get('longName', info.get('shortName', symbol)),
                    exchange=self._map_exchange(info.get('exchange', 'OTHER')),
                    currency=info.get('currency', 'USD'),
                    security_type=self._map_security_type(info.get('quoteType', 'EQUITY')),
                    sector=self._map_sector(info.get('sector')),
                    industry=info.get('industry'),
                    market_cap=self._safe_decimal(info.get('marketCap')),
                    shares_outstanding=info.get('sharesOutstanding'),
                    float_shares=info.get('floatShares'),
                    pe_ratio=self._safe_decimal(info.get('trailingPE')),
                    pb_ratio=self._safe_decimal(info.get('priceToBook')),
                    dividend_yield=self._safe_decimal(info.get('dividendYield')),
                    beta=self._safe_decimal(info.get('beta')),
                    average_volume=info.get('averageVolume'),
                    average_dollar_volume=self._calculate_avg_dollar_volume(
                        info.get('averageVolume'),
                        info.get('regularMarketPrice')
                    ),
                    is_active=info.get('marketState') != 'CLOSED',
                    is_tradeable=info.get('tradeable', True),
                )
                
                # Cache the result
                self._cache_data(cache_key, ticker_info)
                
                logger.debug(f"Retrieved ticker info for {symbol}")
                return ticker_info
                
        except Exception as e:
            logger.error(f"Failed to get ticker info for {symbol}: {e}")
            return None
    
    async def get_current_market_data(self, symbol: str) -> Optional[MarketData]:
        """
        Get current market data for a ticker.
        
        Args:
            symbol: Ticker symbol
            
        Returns:
            MarketData object or None if not found
        """
        cache_key = f"market_{symbol}"
        cached_data = self._get_cached_data(cache_key)
        if cached_data:
            return cached_data
        
        try:
            async with self._semaphore:
                ticker = yf.Ticker(symbol)
                
                # Get current price data
                info = ticker.info
                if not info:
                    return None
                
                # Get recent history for technical indicators
                hist = ticker.history(period="3mo", interval="1d")
                if hist.empty:
                    logger.warning(f"No price history for {symbol}")
                    return None
                
                latest = hist.iloc[-1]
                previous = hist.iloc[-2] if len(hist) > 1 else latest
                
                # Calculate technical indicators
                technical_indicators = await self._calculate_technical_indicators(hist)
                
                # Create market data object
                market_data = MarketData(
                    ticker_symbol=symbol.upper(),
                    current_price=Decimal(str(latest['Close'])),
                    previous_close=Decimal(str(previous['Close'])),
                    open_price=Decimal(str(latest['Open'])),
                    day_high=Decimal(str(latest['High'])),
                    day_low=Decimal(str(latest['Low'])),
                    current_volume=int(latest['Volume']),
                    average_volume=info.get('averageVolume', int(hist['Volume'].mean())),
                    price_change=Decimal(str(latest['Close'] - previous['Close'])),
                    price_change_pct=Decimal(str((latest['Close'] - previous['Close']) / previous['Close'] * 100)),
                    market_cap=self._safe_decimal(info.get('marketCap')),
                    pe_ratio=self._safe_decimal(info.get('trailingPE')),
                    technical_indicators=technical_indicators,
                    last_trade_time=datetime.now(),
                    market_hours=self._is_market_hours(),
                    data_age_minutes=0,  # Fresh data
                    is_real_time=True,
                )
                
                # Cache the result
                self._cache_data(cache_key, market_data)
                
                logger.debug(f"Retrieved market data for {symbol}")
                return market_data
                
        except Exception as e:
            logger.error(f"Failed to get market data for {symbol}: {e}")
            return None
    
    async def get_price_history(
        self,
        symbol: str,
        period: str = "1y",
        interval: str = "1d",
    ) -> Optional[PriceHistory]:
        """
        Get historical price data for a ticker.
        
        Args:
            symbol: Ticker symbol
            period: Time period (1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max)
            interval: Data interval (1m, 2m, 5m, 15m, 30m, 60m, 90m, 1h, 1d, 5d, 1wk, 1mo, 3mo)
            
        Returns:
            PriceHistory object or None if not found
        """
        cache_key = f"history_{symbol}_{period}_{interval}"
        cached_data = self._get_cached_data(cache_key, cache_hours=1)  # Cache for 1 hour
        if cached_data:
            return cached_data
        
        try:
            async with self._semaphore:
                ticker = yf.Ticker(symbol)
                hist = ticker.history(period=period, interval=interval)
                
                if hist.empty:
                    logger.warning(f"No price history for {symbol}")
                    return None
                
                # Convert to OHLCV objects
                ohlcv_data = []
                for date_idx, row in hist.iterrows():
                    ohlcv = OHLCV(
                        trading_date=date_idx.date(),
                        open_price=Decimal(str(row['Open'])),
                        high_price=Decimal(str(row['High'])),
                        low_price=Decimal(str(row['Low'])),
                        close_price=Decimal(str(row['Close'])),
                        volume=int(row['Volume']),
                        dollar_volume=Decimal(str(row['Close'] * row['Volume'])),
                        true_range=self._calculate_true_range(row, hist, date_idx),
                        price_change=Decimal(str(row['Close'] - row['Open'])),
                        price_change_pct=Decimal(str((row['Close'] - row['Open']) / row['Open'] * 100)),
                    )
                    ohlcv_data.append(ohlcv)
                
                # Calculate summary statistics
                closes = hist['Close']
                volumes = hist['Volume']
                
                price_history = PriceHistory(
                    ticker_symbol=symbol.upper(),
                    timeframe=interval,
                    ohlcv_data=ohlcv_data,
                    start_date=hist.index[0].date(),
                    end_date=hist.index[-1].date(),
                    total_periods=len(hist),
                    missing_periods=0,  # yfinance handles missing data
                    data_completeness=Decimal('1.0'),
                    period_high=Decimal(str(closes.max())),
                    period_low=Decimal(str(closes.min())),
                    period_volume_avg=int(volumes.mean()),
                    period_volatility=Decimal(str(closes.pct_change().std() * 100)),
                )
                
                # Cache the result
                self._cache_data(cache_key, price_history)
                
                logger.debug(f"Retrieved price history for {symbol} ({period}, {interval})")
                return price_history
                
        except Exception as e:
            logger.error(f"Failed to get price history for {symbol}: {e}")
            return None
    
    async def get_batch_market_data(
        self,
        symbols: List[str],
        max_concurrent: Optional[int] = None,
    ) -> Dict[str, Optional[MarketData]]:
        """
        Get market data for multiple tickers concurrently.
        
        Args:
            symbols: List of ticker symbols
            max_concurrent: Override default concurrency limit
            
        Returns:
            Dictionary mapping symbols to MarketData (or None if failed)
        """
        if max_concurrent:
            semaphore = asyncio.Semaphore(max_concurrent)
        else:
            semaphore = self._semaphore
        
        async def get_single_data(symbol: str) -> Tuple[str, Optional[MarketData]]:
            async with semaphore:
                data = await self.get_current_market_data(symbol)
                return symbol, data
        
        # Execute requests concurrently
        tasks = [get_single_data(symbol) for symbol in symbols]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Process results
        market_data_map = {}
        for result in results:
            if isinstance(result, Exception):
                logger.warning(f"Batch request failed: {result}")
                continue
            
            symbol, data = result
            market_data_map[symbol] = data
        
        logger.info(f"Retrieved batch market data for {len(symbols)} symbols")
        return market_data_map
    
    async def validate_tickers(self, symbols: List[str]) -> Dict[str, bool]:
        """
        Validate multiple ticker symbols.
        
        Args:
            symbols: List of ticker symbols to validate
            
        Returns:
            Dictionary mapping symbols to validation results
        """
        validation_results = {}
        
        # Use batch requests to validate
        market_data = await self.get_batch_market_data(symbols)
        
        for symbol in symbols:
            validation_results[symbol] = market_data.get(symbol) is not None
        
        valid_count = sum(validation_results.values())
        logger.info(f"Validated {valid_count}/{len(symbols)} tickers")
        
        return validation_results
    
    async def _calculate_technical_indicators(self, hist_data) -> Optional[TechnicalIndicators]:
        """Calculate technical indicators from price history."""
        try:
            if len(hist_data) < 20:  # Need minimum data for indicators
                return None
            
            # Use the technical analyzer
            indicators = self.technical_analyzer.calculate_all_indicators(hist_data)
            
            return TechnicalIndicators(
                sma_20=self._safe_decimal(indicators.get('sma_20')),
                sma_50=self._safe_decimal(indicators.get('sma_50')),
                sma_200=self._safe_decimal(indicators.get('sma_200')),
                ema_12=self._safe_decimal(indicators.get('ema_12')),
                ema_26=self._safe_decimal(indicators.get('ema_26')),
                bb_upper=self._safe_decimal(indicators.get('bb_upper')),
                bb_middle=self._safe_decimal(indicators.get('bb_middle')),
                bb_lower=self._safe_decimal(indicators.get('bb_lower')),
                bb_width=self._safe_decimal(indicators.get('bb_width')),
                bb_percent=self._safe_decimal(indicators.get('bb_percent')),
                atr_14=self._safe_decimal(indicators.get('atr_14')),
                atr_20=self._safe_decimal(indicators.get('atr_20')),
                volatility_20d=self._safe_decimal(indicators.get('volatility_20d')),
                rsi_14=self._safe_decimal(indicators.get('rsi_14')),
                stoch_k=self._safe_decimal(indicators.get('stoch_k')),
                stoch_d=self._safe_decimal(indicators.get('stoch_d')),
                macd_line=self._safe_decimal(indicators.get('macd_line')),
                macd_signal=self._safe_decimal(indicators.get('macd_signal')),
                macd_histogram=self._safe_decimal(indicators.get('macd_histogram')),
                volume_sma_20=indicators.get('volume_sma_20'),
                volume_ratio=self._safe_decimal(indicators.get('volume_ratio')),
                adx_14=self._safe_decimal(indicators.get('adx_14')),
                di_plus=self._safe_decimal(indicators.get('di_plus')),
                di_minus=self._safe_decimal(indicators.get('di_minus')),
                support_level=self._safe_decimal(indicators.get('support_level')),
                resistance_level=self._safe_decimal(indicators.get('resistance_level')),
                trend_direction=self._map_trend_direction(indicators.get('trend_direction')),
                trend_strength=self._safe_decimal(indicators.get('trend_strength')),
            )
            
        except Exception as e:
            logger.warning(f"Failed to calculate technical indicators: {e}")
            return None
    
    def _get_cached_data(self, key: str, cache_hours: Optional[float] = None) -> any:
        """Get data from cache if still valid."""
        if key not in self._cache:
            return None
        
        timestamp, data = self._cache[key]
        cache_duration = timedelta(hours=cache_hours) if cache_hours else self.cache_duration
        
        if datetime.utcnow() - timestamp < cache_duration:
            return data
        
        # Remove expired data
        del self._cache[key]
        return None
    
    def _cache_data(self, key: str, data: any) -> None:
        """Cache data with timestamp."""
        self._cache[key] = (datetime.utcnow(), data)
        
        # Simple cache cleanup (remove oldest if too many entries)
        if len(self._cache) > 1000:
            oldest_key = min(self._cache.keys(), key=lambda k: self._cache[k][0])
            del self._cache[oldest_key]
    
    def _safe_decimal(self, value) -> Optional[Decimal]:
        """Safely convert value to Decimal."""
        if value is None or str(value).lower() in ['nan', 'inf', '-inf']:
            return None
        try:
            return Decimal(str(value))
        except (ValueError, TypeError):
            return None
    
    def _calculate_true_range(self, row, hist_data, date_idx) -> Decimal:
        """Calculate true range for a given row."""
        try:
            high = row['High']
            low = row['Low']
            
            # Get previous close
            prev_idx = hist_data.index.get_loc(date_idx) - 1
            if prev_idx >= 0:
                prev_close = hist_data.iloc[prev_idx]['Close']
                tr = max(
                    high - low,
                    abs(high - prev_close),
                    abs(low - prev_close)
                )
            else:
                tr = high - low
            
            return Decimal(str(tr))
        except:
            return Decimal('0')
    
    def _calculate_avg_dollar_volume(self, avg_volume, price) -> Optional[Decimal]:
        """Calculate average dollar volume."""
        if avg_volume and price:
            return Decimal(str(avg_volume * price))
        return None
    
    def _map_exchange(self, exchange_str: str) -> Exchange:
        """Map exchange string to Exchange enum."""
        exchange_map = {
            'NMS': Exchange.NASDAQ,
            'NYQ': Exchange.NYSE,
            'ASE': Exchange.AMEX,
            'OTC': Exchange.OTC,
            'TSE': Exchange.TSX,
            'LON': Exchange.LSE,
        }
        return exchange_map.get(exchange_str, Exchange.OTHER)
    
    def _map_security_type(self, quote_type: str) -> SecurityType:
        """Map quote type to SecurityType enum."""
        type_map = {
            'EQUITY': SecurityType.STOCK,
            'ETF': SecurityType.ETF,
            'MUTUALFUND': SecurityType.MUTUAL_FUND,
            'CRYPTOCURRENCY': SecurityType.CRYPTO,
            'CURRENCY': SecurityType.FOREX,
            'COMMODITY': SecurityType.COMMODITY,
            'FUTURE': SecurityType.FUTURE,
            'OPTION': SecurityType.OPTION,
        }
        return type_map.get(quote_type.upper(), SecurityType.STOCK)
    
    def _map_sector(self, sector_str: Optional[str]) -> Optional[MarketSector]:
        """Map sector string to MarketSector enum."""
        if not sector_str:
            return None
        
        sector_map = {
            'Technology': MarketSector.TECHNOLOGY,
            'Healthcare': MarketSector.HEALTHCARE,
            'Financial Services': MarketSector.FINANCIALS,
            'Consumer Cyclical': MarketSector.CONSUMER_DISCRETIONARY,
            'Consumer Defensive': MarketSector.CONSUMER_STAPLES,
            'Industrials': MarketSector.INDUSTRIALS,
            'Energy': MarketSector.ENERGY,
            'Utilities': MarketSector.UTILITIES,
            'Basic Materials': MarketSector.MATERIALS,
            'Real Estate': MarketSector.REAL_ESTATE,
            'Communication Services': MarketSector.COMMUNICATION_SERVICES,
        }
        return sector_map.get(sector_str)
    
    def _map_trend_direction(self, trend_value) -> Optional[TrendDirection]:
        """Map trend value to TrendDirection enum."""
        if trend_value is None:
            return None
        
        if isinstance(trend_value, str):
            trend_map = {
                'strong_bullish': TrendDirection.STRONG_BULLISH,
                'bullish': TrendDirection.BULLISH,
                'sideways': TrendDirection.SIDEWAYS,
                'bearish': TrendDirection.BEARISH,
                'strong_bearish': TrendDirection.STRONG_BEARISH,
            }
            return trend_map.get(trend_value.lower())
        
        return None
    
    def _is_market_hours(self) -> bool:
        """Check if market is currently open (simplified)."""
        now = datetime.now()
        # Simplified: assume market is open 9:30 AM - 4:00 PM ET on weekdays
        if now.weekday() >= 5:  # Weekend
            return False
        
        # This is a simplified check - in production, consider holidays and exact timezone
        hour = now.hour
        return 9 <= hour < 16
