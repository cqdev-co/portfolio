"""Data service for fetching market data."""

import asyncio

import yfinance as yf
from loguru import logger

from penny_scanner.config.settings import Settings
from penny_scanner.core.exceptions import DataServiceError
from penny_scanner.models.market_data import MarketData, OHLCVData
from penny_scanner.utils.rate_limiter import get_rate_limiter


class DataService:
    """Service for fetching market data from yfinance."""

    def __init__(self, settings: Settings):
        """Initialize data service."""
        self.settings = settings
        self.rate_limiter = get_rate_limiter()

    async def get_market_data(self, symbol: str, period: str = "6mo") -> MarketData:
        """
        Fetch market data for a symbol with rate limiting.

        Args:
            symbol: Stock symbol
            period: Time period (6mo, 1y, etc.)

        Returns:
            MarketData object

        Raises:
            DataServiceError: If data fetch fails
        """
        last_error = None

        while self.rate_limiter.should_retry():
            try:
                # Wait for rate limit
                await self.rate_limiter.acquire()

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

                # Get additional info (another API call)
                await self.rate_limiter.acquire()
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

                self.rate_limiter.record_success()
                return market_data

            except Exception as e:
                error_str = str(e).lower()

                # Check for rate limit errors
                if "rate limit" in error_str or "too many requests" in error_str:
                    backoff = self.rate_limiter.record_rate_limit_error()
                    logger.warning(
                        f"Rate limited on {symbol}, backing off {backoff:.1f}s"
                    )
                    await asyncio.sleep(backoff)
                    last_error = e
                else:
                    # Non-rate-limit error
                    logger.error(f"Error fetching data for {symbol}: {e}")
                    raise DataServiceError(
                        f"Failed to fetch data for {symbol}: {e}"
                    ) from e

        # Max retries exceeded
        logger.error(f"Max retries exceeded for {symbol}")
        raise DataServiceError(
            f"Failed to fetch data for {symbol} after retries: {last_error}"
        )

    async def get_multiple_symbols(
        self, symbols: list[str], period: str = "6mo"
    ) -> dict[str, MarketData]:
        """
        Fetch market data for multiple symbols with rate limiting.

        Processes symbols sequentially with rate limiting to avoid
        Yahoo Finance 429 errors.

        Args:
            symbols: List of stock symbols
            period: Time period

        Returns:
            Dict mapping symbol to MarketData
        """
        results = {}
        failed_count = 0
        total = len(symbols)

        # Process in small batches with delays
        # Reduced batch size to avoid overwhelming the API
        batch_size = min(5, self.settings.max_concurrent_requests)

        for i in range(0, len(symbols), batch_size):
            batch = symbols[i : i + batch_size]
            batch_num = (i // batch_size) + 1
            total_batches = (total + batch_size - 1) // batch_size

            logger.debug(
                f"Processing batch {batch_num}/{total_batches} ({len(batch)} symbols)"
            )

            # Process batch sequentially to control rate
            for symbol in batch:
                try:
                    result = await self.get_market_data(symbol, period)
                    results[symbol] = result
                except Exception as e:
                    logger.warning(f"Failed to fetch {symbol}: {e}")
                    failed_count += 1

                    # If we're getting too many failures, slow down more
                    if failed_count > 5:
                        logger.warning(
                            f"High failure rate ({failed_count}), adding extra delay"
                        )
                        await asyncio.sleep(5.0)

            # Delay between batches
            if i + batch_size < len(symbols):
                batch_delay = self.rate_limiter.config.batch_delay
                logger.debug(f"Batch complete, waiting {batch_delay}s")
                await asyncio.sleep(batch_delay)

            # Log progress periodically
            if batch_num % 10 == 0 or batch_num == total_batches:
                stats = self.rate_limiter.get_stats()
                logger.info(
                    f"Progress: {len(results)}/{total} symbols fetched, "
                    f"{failed_count} failed, "
                    f"{stats['requests_last_minute']} req/min"
                )

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
