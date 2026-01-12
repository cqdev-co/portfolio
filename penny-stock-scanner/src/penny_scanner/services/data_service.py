"""Data service for fetching market data."""

import asyncio

import pandas as pd
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
        Fetch market data for a single symbol with rate limiting.

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
                await self.rate_limiter.acquire()

                ticker = yf.Ticker(symbol)
                hist = ticker.history(period=period)

                if hist.empty:
                    raise DataServiceError(f"No data available for {symbol}")

                ohlcv_data = self._convert_df_to_ohlcv(hist)

                market_data = MarketData(
                    symbol=symbol.upper(),
                    timeframe="1d",
                    ohlcv_data=ohlcv_data,
                )

                self.rate_limiter.record_success()
                return market_data

            except Exception as e:
                error_str = str(e).lower()

                if "rate limit" in error_str or "too many requests" in error_str:
                    backoff = self.rate_limiter.record_rate_limit_error()
                    logger.warning(
                        f"Rate limited on {symbol}, backing off {backoff:.1f}s"
                    )
                    await asyncio.sleep(backoff)
                    last_error = e
                else:
                    logger.error(f"Error fetching data for {symbol}: {e}")
                    raise DataServiceError(
                        f"Failed to fetch data for {symbol}: {e}"
                    ) from e

        logger.error(f"Max retries exceeded for {symbol}")
        raise DataServiceError(
            f"Failed to fetch data for {symbol} after retries: {last_error}"
        )

    def _convert_df_to_ohlcv(self, df: pd.DataFrame) -> list[OHLCVData]:
        """Convert pandas DataFrame to list of OHLCVData."""
        ohlcv_data = []
        for index, row in df.iterrows():
            try:
                ohlcv = OHLCVData(
                    timestamp=index.to_pydatetime(),
                    open=float(row["Open"]),
                    high=float(row["High"]),
                    low=float(row["Low"]),
                    close=float(row["Close"]),
                    volume=int(row["Volume"]),
                )
                ohlcv_data.append(ohlcv)
            except (KeyError, ValueError) as e:
                logger.debug(f"Skipping invalid row: {e}")
                continue
        return ohlcv_data

    async def get_multiple_symbols_batch(
        self, symbols: list[str], period: str = "6mo"
    ) -> dict[str, MarketData]:
        """
        Fetch market data for multiple symbols using batch download.

        This is MUCH faster than individual calls - yfinance downloads
        all symbols in parallel internally.

        Args:
            symbols: List of stock symbols
            period: Time period

        Returns:
            Dict mapping symbol to MarketData
        """
        if not symbols:
            return {}

        results = {}
        total = len(symbols)

        # Split into batches to avoid overwhelming yfinance
        # yfinance can handle large batches but we split for progress tracking
        batch_size = self.settings.batch_download_size

        for i in range(0, len(symbols), batch_size):
            batch = symbols[i : i + batch_size]
            batch_num = (i // batch_size) + 1
            total_batches = (total + batch_size - 1) // batch_size

            logger.info(
                f"Batch download {batch_num}/{total_batches}: {len(batch)} symbols"
            )

            try:
                # Rate limit before batch download
                await self.rate_limiter.acquire()

                # Use yfinance batch download - this is the key optimization!
                # It fetches all symbols in parallel internally
                df = yf.download(
                    tickers=batch,
                    period=period,
                    group_by="ticker",
                    threads=True,  # Use threading for parallel downloads
                    progress=False,  # Disable progress bar
                    auto_adjust=True,
                    prepost=False,
                )

                self.rate_limiter.record_success()

                # Process results
                if len(batch) == 1:
                    # Single symbol - df has simple structure
                    symbol = batch[0]
                    if not df.empty:
                        ohlcv = self._convert_df_to_ohlcv(df)
                        if ohlcv:
                            results[symbol] = MarketData(
                                symbol=symbol.upper(),
                                timeframe="1d",
                                ohlcv_data=ohlcv,
                            )
                else:
                    # Multiple symbols - df is multi-indexed by ticker
                    for symbol in batch:
                        try:
                            if symbol in df.columns.get_level_values(0):
                                symbol_df = df[symbol].dropna(how="all")
                                if not symbol_df.empty:
                                    ohlcv = self._convert_df_to_ohlcv(symbol_df)
                                    if ohlcv:
                                        results[symbol] = MarketData(
                                            symbol=symbol.upper(),
                                            timeframe="1d",
                                            ohlcv_data=ohlcv,
                                        )
                        except Exception as e:
                            logger.debug(f"Failed to process {symbol}: {e}")
                            continue

            except Exception as e:
                error_str = str(e).lower()

                if "rate limit" in error_str or "too many requests" in error_str:
                    backoff = self.rate_limiter.record_rate_limit_error()
                    logger.warning(f"Rate limited on batch, backing off {backoff:.1f}s")
                    await asyncio.sleep(backoff)

                    # Retry this batch with individual downloads
                    logger.info("Retrying batch with individual downloads...")
                    for symbol in batch:
                        try:
                            result = await self.get_market_data(symbol, period)
                            results[symbol] = result
                        except Exception as inner_e:
                            logger.debug(f"Failed to fetch {symbol}: {inner_e}")
                else:
                    logger.error(f"Batch download failed: {e}")
                    # Try individual downloads as fallback
                    for symbol in batch:
                        try:
                            result = await self.get_market_data(symbol, period)
                            results[symbol] = result
                        except Exception as inner_e:
                            logger.debug(f"Failed to fetch {symbol}: {inner_e}")

            # Small delay between batches
            if i + batch_size < len(symbols):
                await asyncio.sleep(self.settings.rate_limit_batch_delay)

            # Log progress
            logger.info(
                f"Progress: {len(results)}/{total} symbols "
                f"({len(results) / total * 100:.1f}%)"
            )

        return results

    async def get_multiple_symbols(
        self, symbols: list[str], period: str = "6mo"
    ) -> dict[str, MarketData]:
        """
        Fetch market data for multiple symbols.

        Uses batch download for efficiency.

        Args:
            symbols: List of stock symbols
            period: Time period

        Returns:
            Dict mapping symbol to MarketData
        """
        # Use batch download for efficiency
        return await self.get_multiple_symbols_batch(symbols, period)

    async def enrich_with_info(self, market_data: MarketData) -> MarketData:
        """
        Enrich market data with ticker info (sector, industry, float).

        This is a separate call to avoid slowing down the main scan.
        Only call this for signals that need the extra data.

        Args:
            market_data: MarketData to enrich

        Returns:
            Enriched MarketData
        """
        try:
            await self.rate_limiter.acquire()

            ticker = yf.Ticker(market_data.symbol)
            info = ticker.info

            self.rate_limiter.record_success()

            # Update with info
            market_data.sector = info.get("sector")
            market_data.industry = info.get("industry")
            market_data.market_cap = info.get("marketCap")
            market_data.float_shares = info.get("floatShares")

            return market_data

        except Exception as e:
            logger.debug(f"Failed to enrich {market_data.symbol}: {e}")
            return market_data

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
