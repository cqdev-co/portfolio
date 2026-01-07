"""Data service for fetching market data."""

import asyncio
import yfinance as yf
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from loguru import logger

from penny_scanner.models.market_data import MarketData, OHLCVData
from penny_scanner.config.settings import Settings
from penny_scanner.core.exceptions import DataServiceError


class DataService:
    """Service for fetching market data from yfinance."""

    def __init__(self, settings: Settings):
        """Initialize data service."""
        self.settings = settings

    async def get_market_data(self, symbol: str, period: str = "6mo") -> MarketData:
        """
        Fetch market data for a symbol.

        Args:
            symbol: Stock symbol
            period: Time period (6mo, 1y, etc.)

        Returns:
            MarketData object

        Raises:
            DataServiceError: If data fetch fails
        """
        try:
            ticker = yf.Ticker(symbol)
            hist = ticker.history(period=period)

            if hist.empty:
                raise DataServiceError(f"No data available for {symbol}")

            # Convert to OHLCVData objects
            ohlcv_data = []
            for index, row in hist.iterrows():
                ohlcv = OHLCVData(
                    timestamp=index.to_pydatetime(),
                    open=float(row["Open"]),
                    high=float(row["High"]),
                    low=float(row["Low"]),
                    close=float(row["Close"]),
                    volume=int(row["Volume"]),
                )
                ohlcv_data.append(ohlcv)

            # Get additional info
            info = ticker.info

            market_data = MarketData(
                symbol=symbol.upper(),
                timeframe="1d",
                ohlcv_data=ohlcv_data,
                sector=info.get("sector"),
                industry=info.get("industry"),
                market_cap=info.get("marketCap"),
                float_shares=info.get("floatShares"),
            )

            return market_data

        except Exception as e:
            logger.error(f"Error fetching data for {symbol}: {e}")
            raise DataServiceError(f"Failed to fetch data for {symbol}: {e}")

    async def get_multiple_symbols(
        self, symbols: List[str], period: str = "6mo"
    ) -> Dict[str, MarketData]:
        """
        Fetch market data for multiple symbols concurrently.

        Args:
            symbols: List of stock symbols
            period: Time period

        Returns:
            Dict mapping symbol to MarketData
        """
        results = {}

        # Process in batches to respect rate limits
        batch_size = self.settings.max_concurrent_requests

        for i in range(0, len(symbols), batch_size):
            batch = symbols[i : i + batch_size]

            tasks = [self.get_market_data(symbol, period) for symbol in batch]

            batch_results = await asyncio.gather(*tasks, return_exceptions=True)

            for symbol, result in zip(batch, batch_results):
                if isinstance(result, Exception):
                    logger.warning(f"Failed to fetch {symbol}: {result}")
                    continue
                results[symbol] = result

            # Brief delay between batches
            if i + batch_size < len(symbols):
                await asyncio.sleep(0.5)

        return results

    async def validate_symbol(self, symbol: str) -> bool:
        """
        Validate if a symbol exists and has data.

        Args:
            symbol: Stock symbol

        Returns:
            True if valid, False otherwise
        """
        try:
            ticker = yf.Ticker(symbol)
            hist = ticker.history(period="5d")
            return not hist.empty
        except Exception:
            return False
