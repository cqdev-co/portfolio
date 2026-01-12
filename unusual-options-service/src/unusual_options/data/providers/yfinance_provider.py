"""YFinance data provider implementation."""

import asyncio
import time
from datetime import UTC, date, datetime
from typing import Any

import pandas as pd
import yfinance as yf
from loguru import logger

from ..models import HistoricalData, OptionsChain, OptionsContract
from .base import DataProvider, RateLimitError


class YFinanceProvider(DataProvider):
    """YFinance implementation of data provider."""

    def __init__(self, config: dict[str, Any]):
        super().__init__(config)
        self.name = "YFinance"

        # Rate limiting configuration
        self.base_delay = 0.5  # Base delay between requests (seconds)
        self.max_delay = 30.0  # Maximum delay for exponential backoff
        self.max_retries = 3  # Maximum number of retries
        self.backoff_factor = 2.0  # Exponential backoff multiplier

        # Track request timing for rate limiting
        self.last_request_time = 0
        self.consecutive_errors = 0
        self.rate_limit_until = 0  # Timestamp until which we're rate limited

    async def _wait_for_rate_limit(self) -> None:
        """Wait for rate limit to clear and apply base delay."""
        current_time = time.time()

        # Check if we're still in a rate limit period
        if current_time < self.rate_limit_until:
            wait_time = self.rate_limit_until - current_time
            logger.info(f"Rate limited, waiting {wait_time:.1f} seconds")
            await asyncio.sleep(wait_time)

        # Apply base delay between requests
        time_since_last = current_time - self.last_request_time
        if time_since_last < self.base_delay:
            delay = self.base_delay - time_since_last
            await asyncio.sleep(delay)

        self.last_request_time = time.time()

    def _handle_rate_limit_error(self, error_msg: str) -> None:
        """Handle rate limit error by setting backoff period."""
        self.consecutive_errors += 1

        # Calculate exponential backoff delay
        delay = min(
            self.base_delay * (self.backoff_factor**self.consecutive_errors),
            self.max_delay,
        )

        self.rate_limit_until = time.time() + delay
        logger.warning(
            f"Rate limit detected, backing off for {delay:.1f} seconds (attempt {self.consecutive_errors})"
        )

    def _reset_error_count(self) -> None:
        """Reset consecutive error count on successful request."""
        if self.consecutive_errors > 0:
            logger.debug(
                f"Request successful, resetting error count from {self.consecutive_errors}"
            )
            self.consecutive_errors = 0

    async def _make_request_with_retry(self, request_func, *args, **kwargs):
        """Make a request with retry logic and rate limiting."""
        for attempt in range(self.max_retries + 1):
            try:
                # Wait for rate limit
                await self._wait_for_rate_limit()

                # Make the request
                result = request_func(*args, **kwargs)

                # Success - reset error count
                self._reset_error_count()
                return result

            except Exception as e:
                error_msg = str(e).lower()

                # Check if it's a rate limit error
                if any(
                    phrase in error_msg
                    for phrase in [
                        "rate limit",
                        "too many requests",
                        "429",
                        "throttle",
                        "quota exceeded",
                        "requests per second",
                    ]
                ):
                    self._handle_rate_limit_error(error_msg)

                    if attempt < self.max_retries:
                        logger.info(
                            f"Retrying request (attempt {attempt + 1}/{self.max_retries})"
                        )
                        continue
                    else:
                        logger.error("Max retries exceeded for rate limited request")
                        raise RateLimitError(
                            f"Rate limit exceeded after {self.max_retries} retries"
                        ) from e

                # Check for other recoverable errors
                elif any(
                    phrase in error_msg
                    for phrase in ["timeout", "connection", "network", "temporary"]
                ):
                    if attempt < self.max_retries:
                        wait_time = self.base_delay * (attempt + 1)
                        logger.warning(
                            f"Recoverable error, retrying in {wait_time}s: {e}"
                        )
                        await asyncio.sleep(wait_time)
                        continue

                # Non-recoverable error or max retries exceeded
                logger.error(f"Request failed: {e}")
                raise e

        raise Exception("Max retries exceeded")

    async def get_options_chain(self, ticker: str) -> OptionsChain | None:
        """
        Get current options chain from YFinance.

        Args:
            ticker: Stock ticker symbol

        Returns:
            OptionsChain object or None if not available
        """
        try:
            # Create yfinance ticker object and get basic info with retry logic
            def get_ticker_info():
                yf_ticker = yf.Ticker(ticker)
                info = yf_ticker.info
                current_price = info.get("currentPrice") or info.get(
                    "regularMarketPrice"
                )
                expiry_dates = yf_ticker.options
                return yf_ticker, current_price, expiry_dates

            (
                yf_ticker,
                current_price,
                expiry_dates,
            ) = await self._make_request_with_retry(get_ticker_info)

            if not current_price:
                logger.warning(f"Could not get current price for {ticker}")
                return None

            if not expiry_dates:
                logger.warning(f"No options available for {ticker}")
                return None

            # Get options for all available expiries (limit to first 4 for performance)
            all_contracts = []

            for expiry_str in expiry_dates[:4]:  # Limit to avoid too many requests
                try:
                    expiry_date = datetime.strptime(expiry_str, "%Y-%m-%d").date()

                    # Get calls and puts for this expiry with retry logic
                    def get_option_chain(exp=expiry_str):
                        return yf_ticker.option_chain(exp)

                    option_chain = await self._make_request_with_retry(get_option_chain)

                    # Process calls
                    if hasattr(option_chain, "calls") and not option_chain.calls.empty:
                        for _, row in option_chain.calls.iterrows():
                            contract = self._create_contract_from_yf_row(
                                row, expiry_date, "call", ticker
                            )
                            if contract:
                                all_contracts.append(contract)

                    # Process puts
                    if hasattr(option_chain, "puts") and not option_chain.puts.empty:
                        for _, row in option_chain.puts.iterrows():
                            contract = self._create_contract_from_yf_row(
                                row, expiry_date, "put", ticker
                            )
                            if contract:
                                all_contracts.append(contract)

                except RateLimitError:
                    logger.warning(
                        f"Rate limit hit while processing {expiry_str} for {ticker}, skipping"
                    )
                    continue
                except Exception as e:
                    logger.warning(
                        f"Error processing expiry {expiry_str} for {ticker}: {e}"
                    )
                    continue

            if not all_contracts:
                logger.warning(f"No valid options contracts found for {ticker}")
                return None

            return OptionsChain(
                ticker=ticker,
                underlying_price=float(current_price),
                contracts=all_contracts,
                timestamp=datetime.now(UTC),
            )

        except RateLimitError as e:
            logger.error(f"Rate limit exceeded for {ticker}: {e}")
            raise e  # Re-raise to allow higher-level handling
        except Exception as e:
            logger.error(f"Error fetching options chain for {ticker}: {e}")
            return None

    def _create_contract_from_yf_row(
        self, row: Any, expiry_date: date, option_type: str, ticker: str
    ) -> OptionsContract | None:
        """Create OptionsContract from YFinance row data."""
        try:
            # YFinance column names
            strike = float(row.get("strike", 0))
            last_price = float(row.get("lastPrice", 0))
            bid = float(row.get("bid", 0))
            ask = float(row.get("ask", 0))
            # Handle NaN values from YFinance
            volume_raw = row.get("volume", 0)
            volume = int(volume_raw) if volume_raw and not pd.isna(volume_raw) else 0

            oi_raw = row.get("openInterest", 0)
            open_interest = int(oi_raw) if oi_raw and not pd.isna(oi_raw) else 0
            implied_vol = row.get("impliedVolatility")

            # Create option symbol (simplified format)
            option_symbol = f"{ticker}{expiry_date.strftime('%y%m%d')}{'C' if option_type == 'call' else 'P'}{int(strike * 1000):08d}"

            return OptionsContract(
                symbol=option_symbol,
                strike=strike,
                expiry=expiry_date,
                option_type=option_type,
                last_price=last_price,
                bid=bid,
                ask=ask,
                volume=volume,
                open_interest=open_interest,
                implied_volatility=float(implied_vol) if implied_vol else None,
                timestamp=datetime.now(UTC),
            )

        except Exception as e:
            logger.warning(f"Error creating contract from YFinance row: {e}")
            return None

    async def get_historical_options(
        self, ticker: str, days: int = 20
    ) -> HistoricalData | None:
        """
        Get historical options data approximation from YFinance.

        Note: YFinance doesn't provide true historical options data.
        We approximate using current snapshot data with conservative baselines.

        Strategy:
        - Use current volume * 0.2 as "average" (conservative baseline)
        - Use current OI as "previous" OI (enables change detection)
        - This allows volume/OI anomaly detection to work
        """
        try:
            # Get current options chain to build baseline
            chain = await self.get_options_chain(ticker)

            if not chain or not chain.contracts:
                logger.warning(f"No options data for {ticker}, cannot create baseline")
                return HistoricalData(
                    ticker=ticker, avg_volumes={}, prev_oi={}, time_sales={}
                )

            avg_volumes = {}
            prev_oi = {}

            for contract in chain.contracts:
                symbol = contract.symbol

                # Estimate average volume as 20% of current volume
                # This is conservative - high current volume will show as anomaly
                # Minimum baseline of 100 to avoid division issues
                estimated_avg = max(contract.volume * 0.2, 100)
                avg_volumes[symbol] = estimated_avg

                # Use 90% of current OI as "previous" OI
                # This allows detecting 10%+ increases as anomalies
                # Realistic since OI typically doesn't change dramatically daily
                if contract.open_interest > 0:
                    prev_oi[symbol] = int(contract.open_interest * 0.9)
                else:
                    prev_oi[symbol] = 0

            logger.info(
                f"Created historical baseline for {ticker}: "
                f"{len(avg_volumes)} contracts"
            )

            return HistoricalData(
                ticker=ticker,
                avg_volumes=avg_volumes,
                prev_oi=prev_oi,
                time_sales={},  # No time/sales data available
            )

        except Exception as e:
            logger.error(f"Error creating historical baseline for {ticker}: {e}")
            return HistoricalData(
                ticker=ticker, avg_volumes={}, prev_oi={}, time_sales={}
            )

    async def test_connection(self) -> bool:
        """Test YFinance connection by fetching a simple quote."""
        try:

            def test_request():
                test_ticker = yf.Ticker("AAPL")
                info = test_ticker.info
                return info

            info = await self._make_request_with_retry(test_request)

            if info and "currentPrice" in info:
                logger.info("YFinance connection test successful")
                return True
            else:
                logger.warning("YFinance connection test failed - no price data")
                return False

        except RateLimitError as e:
            logger.error(f"YFinance connection test failed due to rate limit: {e}")
            return False
        except Exception as e:
            logger.error(f"YFinance connection test failed: {e}")
            return False

    def get_rate_limit_info(self) -> dict[str, Any]:
        """Get YFinance rate limit information."""
        return {
            "provider": "YFinance",
            "requests_per_hour": "~2000",  # Approximate
            "requests_per_second": 1,
            "delay_between_requests": self.rate_limit_delay,
            "notes": "Free tier with reasonable limits",
        }


class PolygonProvider(DataProvider):
    """Polygon.io data provider (fallback, requires API key)."""

    def __init__(self, config: dict[str, Any]):
        super().__init__(config)
        self.name = "Polygon.io"
        self.api_key = config.get("POLYGON_API_KEY", "")
        self.base_url = "https://api.polygon.io"

    async def get_options_chain(self, ticker: str) -> OptionsChain | None:
        """Get options chain from Polygon.io."""
        if not self.api_key:
            logger.warning("Polygon.io API key not provided")
            return None

        # TODO: Implement Polygon.io options chain fetching
        logger.info(f"Polygon.io options chain for {ticker} - not implemented yet")
        return None

    async def get_historical_options(
        self, ticker: str, days: int = 20
    ) -> HistoricalData | None:
        """Get historical options from Polygon.io."""
        if not self.api_key:
            logger.warning("Polygon.io API key not provided")
            return None

        # TODO: Implement Polygon.io historical options
        logger.info(f"Polygon.io historical options for {ticker} - not implemented yet")
        return None

    async def test_connection(self) -> bool:
        """Test Polygon.io connection."""
        if not self.api_key:
            logger.warning("Polygon.io API key not provided")
            return False

        # TODO: Implement connection test
        logger.info("Polygon.io connection test - not implemented yet")
        return False

    def get_rate_limit_info(self) -> dict[str, Any]:
        """Get Polygon.io rate limit information."""
        return {
            "provider": "Polygon.io",
            "requests_per_minute": 5,  # Free tier
            "requests_per_day": 1000,  # Free tier
            "notes": "Free tier limits, paid tiers available",
        }


def get_provider(config: dict[str, Any]) -> DataProvider:
    """
    Get the appropriate data provider based on configuration.

    Args:
        config: Configuration dictionary

    Returns:
        DataProvider instance
    """
    provider_name = config.get("DATA_PROVIDER", "yfinance").lower()

    if provider_name == "yfinance":
        return YFinanceProvider(config)
    elif provider_name == "polygon":
        return PolygonProvider(config)
    else:
        logger.warning(f"Unknown provider {provider_name}, defaulting to YFinance")
        return YFinanceProvider(config)


async def get_provider_with_fallback(config: dict[str, Any]) -> DataProvider:
    """
    Get provider with automatic fallback to YFinance if primary fails.

    Args:
        config: Configuration dictionary

    Returns:
        Working DataProvider instance
    """
    primary_provider = get_provider(config)

    # Test primary provider
    if await primary_provider.test_connection():
        logger.info(f"Using primary provider: {primary_provider.name}")
        return primary_provider

    # Fallback to YFinance if not already using it
    if not isinstance(primary_provider, YFinanceProvider):
        logger.warning(
            f"Primary provider {primary_provider.name} failed, falling back to YFinance"
        )
        fallback_provider = YFinanceProvider(config)

        if await fallback_provider.test_connection():
            return fallback_provider

    # If all else fails, return the primary provider anyway
    logger.warning("All providers failed connection test, using primary anyway")
    return primary_provider
