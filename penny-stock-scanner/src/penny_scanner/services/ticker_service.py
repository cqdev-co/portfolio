"""Ticker service for querying penny stocks from Supabase."""

from loguru import logger
from supabase import Client, create_client

from penny_scanner.config.settings import Settings
from penny_scanner.core.exceptions import DatabaseError


class TickerService:
    """Service for accessing penny ticker database."""

    def __init__(self, settings: Settings):
        """Initialize ticker service."""
        self.settings = settings
        self.client: Client | None = None

        if settings.is_database_enabled():
            try:
                self.client = create_client(
                    settings.supabase_url, settings.supabase_service_role_key
                )
                logger.info("Ticker service connected to database")
            except Exception as e:
                logger.error(f"Failed to connect to database: {e}")

    def is_available(self) -> bool:
        """Check if ticker service is available."""
        return self.client is not None

    def get_all_symbols(self, limit: int | None = None) -> list[str]:
        """
        Get all active penny ticker symbols.

        Args:
            limit: Maximum number of symbols to return (None = all symbols)

        Returns:
            List of stock symbols
        """
        if not self.is_available():
            raise DatabaseError("Ticker service not available")

        try:
            all_symbols = []
            page_size = 1000
            offset = 0

            # If user specifies a limit, just fetch that many
            if limit:
                response = (
                    self.client.table("penny_tickers")
                    .select("symbol")
                    .eq("is_active", True)
                    .limit(limit)
                    .execute()
                )

                all_symbols = [row["symbol"] for row in response.data]
            else:
                # Fetch all symbols with pagination
                while True:
                    response = (
                        self.client.table("penny_tickers")
                        .select("symbol")
                        .eq("is_active", True)
                        .range(offset, offset + page_size - 1)
                        .execute()
                    )

                    if not response.data:
                        break

                    all_symbols.extend([row["symbol"] for row in response.data])

                    # If we got fewer results than page_size, we're done
                    if len(response.data) < page_size:
                        break

                    offset += page_size

            # Filter out non-US symbols (Canadian, etc.)
            filtered_symbols = [
                s
                for s in all_symbols
                if not any(s.endswith(suffix) for suffix in [".TO", ".V", ".CN", ".NE"])
            ]

            logger.info(
                f"Retrieved {len(filtered_symbols)} penny ticker symbols (filtered {len(all_symbols) - len(filtered_symbols)} non-US)"
            )
            return filtered_symbols

        except Exception as e:
            logger.error(f"Error fetching symbols: {e}")
            raise DatabaseError(f"Failed to fetch symbols: {e}") from e

    def get_symbols_by_exchange(
        self, exchange: str, limit: int | None = None
    ) -> list[str]:
        """
        Get penny ticker symbols from a specific exchange.

        Args:
            exchange: Exchange name (e.g., NASDAQ, NYSE)
            limit: Maximum number of symbols (None = all from exchange)

        Returns:
            List of stock symbols
        """
        if not self.is_available():
            raise DatabaseError("Ticker service not available")

        try:
            all_symbols = []
            page_size = 1000
            offset = 0

            if limit:
                response = (
                    self.client.table("penny_tickers")
                    .select("symbol")
                    .eq("is_active", True)
                    .eq("exchange", exchange.upper())
                    .limit(limit)
                    .execute()
                )

                all_symbols = [row["symbol"] for row in response.data]
            else:
                # Fetch all symbols with pagination
                while True:
                    response = (
                        self.client.table("penny_tickers")
                        .select("symbol")
                        .eq("is_active", True)
                        .eq("exchange", exchange.upper())
                        .range(offset, offset + page_size - 1)
                        .execute()
                    )

                    if not response.data:
                        break

                    all_symbols.extend([row["symbol"] for row in response.data])

                    if len(response.data) < page_size:
                        break

                    offset += page_size

            logger.info(f"Retrieved {len(all_symbols)} symbols from {exchange}")

            return all_symbols

        except Exception as e:
            logger.error(f"Error fetching symbols by exchange: {e}")
            raise DatabaseError(f"Failed to fetch symbols from {exchange}: {e}") from e

    def get_symbols_by_sector(self, sector: str, limit: int | None = None) -> list[str]:
        """
        Get penny ticker symbols from a specific sector.

        Args:
            sector: Sector name
            limit: Maximum number of symbols (None = all from sector)

        Returns:
            List of stock symbols
        """
        if not self.is_available():
            raise DatabaseError("Ticker service not available")

        try:
            all_symbols = []
            page_size = 1000
            offset = 0

            if limit:
                response = (
                    self.client.table("penny_tickers")
                    .select("symbol")
                    .eq("is_active", True)
                    .eq("sector", sector)
                    .limit(limit)
                    .execute()
                )

                all_symbols = [row["symbol"] for row in response.data]
            else:
                # Fetch all symbols with pagination
                while True:
                    response = (
                        self.client.table("penny_tickers")
                        .select("symbol")
                        .eq("is_active", True)
                        .eq("sector", sector)
                        .range(offset, offset + page_size - 1)
                        .execute()
                    )

                    if not response.data:
                        break

                    all_symbols.extend([row["symbol"] for row in response.data])

                    if len(response.data) < page_size:
                        break

                    offset += page_size

            logger.info(f"Retrieved {len(all_symbols)} symbols from {sector} sector")

            return all_symbols

        except Exception as e:
            logger.error(f"Error fetching symbols by sector: {e}")
            raise DatabaseError(f"Failed to fetch symbols from {sector}: {e}") from e

    def search_symbols(self, search_term: str, limit: int = 50) -> list[str]:
        """
        Search for ticker symbols by name or symbol.

        Args:
            search_term: Search term
            limit: Maximum results

        Returns:
            List of matching symbols
        """
        if not self.is_available():
            raise DatabaseError("Ticker service not available")

        try:
            # Search by symbol or name (case-insensitive)
            search_pattern = f"%{search_term.upper()}%"

            response = (
                self.client.table("penny_tickers")
                .select("symbol")
                .eq("is_active", True)
                .or_(f"symbol.ilike.{search_pattern},name.ilike.{search_pattern}")
                .limit(limit)
                .execute()
            )

            symbols = [row["symbol"] for row in response.data]
            logger.info(f"Found {len(symbols)} symbols matching '{search_term}'")

            return symbols

        except Exception as e:
            logger.error(f"Error searching symbols: {e}")
            raise DatabaseError(f"Failed to search symbols: {e}") from e

    def get_ticker_count(self) -> int:
        """
        Get total count of active penny tickers.

        Returns:
            Number of active tickers
        """
        if not self.is_available():
            return 0

        try:
            response = (
                self.client.table("penny_tickers")
                .select("symbol", count="exact")
                .eq("is_active", True)
                .execute()
            )

            return response.count or 0

        except Exception as e:
            logger.error(f"Error getting ticker count: {e}")
            return 0

    def get_available_exchanges(self) -> list[str]:
        """
        Get list of available exchanges.

        Returns:
            List of exchange names
        """
        if not self.is_available():
            return []

        try:
            response = (
                self.client.table("penny_tickers")
                .select("exchange")
                .eq("is_active", True)
                .execute()
            )

            exchanges = list(
                set(row["exchange"] for row in response.data if row.get("exchange"))
            )
            exchanges.sort()

            return exchanges

        except Exception as e:
            logger.error(f"Error getting exchanges: {e}")
            return []

    def get_available_sectors(self) -> list[str]:
        """
        Get list of available sectors.

        Returns:
            List of sector names
        """
        if not self.is_available():
            return []

        try:
            response = (
                self.client.table("penny_tickers")
                .select("sector")
                .eq("is_active", True)
                .execute()
            )

            sectors = list(
                set(row["sector"] for row in response.data if row.get("sector"))
            )
            sectors.sort()

            return sectors

        except Exception as e:
            logger.error(f"Error getting sectors: {e}")
            return []
