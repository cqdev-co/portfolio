"""Abstract base class for data providers."""

from abc import ABC, abstractmethod
from typing import Any

from ..models import HistoricalData, OptionsChain


class DataProvider(ABC):
    """Abstract base class for market data providers."""

    def __init__(self, config: dict[str, Any]):
        self.config = config
        self.name = self.__class__.__name__

    @abstractmethod
    async def get_options_chain(self, ticker: str) -> OptionsChain | None:
        """
        Get current options chain for ticker.

        Args:
            ticker: Stock ticker symbol

        Returns:
            OptionsChain object or None if not available
        """
        pass

    @abstractmethod
    async def get_historical_options(
        self, ticker: str, days: int = 20
    ) -> HistoricalData | None:
        """
        Get historical options data for lookback analysis.

        Args:
            ticker: Stock ticker symbol
            days: Number of days to look back

        Returns:
            HistoricalData object or None if not available
        """
        pass

    @abstractmethod
    async def test_connection(self) -> bool:
        """
        Test if the provider is accessible.

        Returns:
            True if connection successful, False otherwise
        """
        pass

    @abstractmethod
    def get_rate_limit_info(self) -> dict[str, Any]:
        """
        Get rate limit information for this provider.

        Returns:
            Dictionary with rate limit details
        """
        pass


class DataProviderError(Exception):
    """Base exception for data provider errors."""

    pass


class RateLimitError(DataProviderError):
    """Raised when rate limit is exceeded."""

    pass


class DataNotAvailableError(DataProviderError):
    """Raised when requested data is not available."""

    pass
