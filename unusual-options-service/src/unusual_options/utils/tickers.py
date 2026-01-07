"""Ticker utilities for unusual options scanner."""

import os
import sys
from pathlib import Path
from typing import Any

# Add the lib directory to the path so we can import get_tickers
lib_path = Path(__file__).parent.parent.parent.parent.parent / "lib"
sys.path.insert(0, str(lib_path))

# Load config and set environment variables for lib/utils/get_tickers.py compatibility
try:
    from ..config import load_config

    config = load_config()
    # Set environment variables that lib/utils/get_tickers.py expects
    if config.get("SUPABASE_URL"):
        os.environ["SUPABASE_URL"] = config["SUPABASE_URL"]
    if config.get("SUPABASE_KEY"):
        os.environ["SUPABASE_ANON_KEY"] = config["SUPABASE_KEY"]
except ImportError:
    # Fallback: try to use existing environment variables
    if not os.getenv("SUPABASE_ANON_KEY") and os.getenv("SUPABASE_KEY"):
        os.environ["SUPABASE_ANON_KEY"] = os.getenv("SUPABASE_KEY")

try:
    from utils.get_tickers import (
        get_all_tickers,
        get_sp500_tickers,
        get_tech_tickers,
        get_ticker_by_symbol,
        get_tickers_by_exchange,
        get_tickers_by_sector,
        search_tickers,
    )
except ImportError:
    # Fallback if the lib utils are not available
    def get_all_tickers(
        active_only: bool = True, limit: int | None = None
    ) -> list[dict[str, Any]]:
        """Fallback ticker list if database is not available."""
        return [
            {"symbol": "AAPL", "name": "Apple Inc.", "exchange": "NASDAQ"},
            {"symbol": "MSFT", "name": "Microsoft Corporation", "exchange": "NASDAQ"},
            {"symbol": "GOOGL", "name": "Alphabet Inc.", "exchange": "NASDAQ"},
            {"symbol": "TSLA", "name": "Tesla, Inc.", "exchange": "NASDAQ"},
            {"symbol": "NVDA", "name": "NVIDIA Corporation", "exchange": "NASDAQ"},
            {"symbol": "META", "name": "Meta Platforms, Inc.", "exchange": "NASDAQ"},
            {"symbol": "AMZN", "name": "Amazon.com, Inc.", "exchange": "NASDAQ"},
            {
                "symbol": "AMD",
                "name": "Advanced Micro Devices, Inc.",
                "exchange": "NASDAQ",
            },
        ]

    def get_ticker_by_symbol(symbol: str) -> dict[str, Any] | None:
        """Fallback single ticker lookup."""
        tickers = get_all_tickers()
        for ticker in tickers:
            if ticker["symbol"].upper() == symbol.upper():
                return ticker
        return None

    def get_tickers_by_exchange(
        exchange: str, active_only: bool = True, limit: int | None = None
    ) -> list[dict[str, Any]]:
        """Fallback exchange filter."""
        tickers = get_all_tickers()
        return [t for t in tickers if t.get("exchange", "").upper() == exchange.upper()]

    def get_tickers_by_sector(
        sector: str, active_only: bool = True, limit: int | None = None
    ) -> list[dict[str, Any]]:
        """Fallback sector filter."""
        return get_all_tickers()[:limit] if limit else get_all_tickers()

    def search_tickers(query: str, **kwargs) -> list[dict[str, Any]]:
        """Fallback search."""
        tickers = get_all_tickers()
        return [
            t
            for t in tickers
            if query.upper() in t["symbol"].upper()
            or query.upper() in t["name"].upper()
        ]

    def get_sp500_tickers() -> list[dict[str, Any]]:
        """Fallback S&P 500 list."""
        return get_all_tickers()

    def get_tech_tickers(limit: int = 100) -> list[dict[str, Any]]:
        """Fallback tech tickers."""
        return get_all_tickers()


def get_liquid_tickers(
    min_market_cap: float = 1_000_000_000,
    min_avg_volume: int = 1_000_000,
    limit: int | None = None,
) -> list[str]:
    """
    Get list of liquid, optionable tickers for scanning.

    Args:
        min_market_cap: Minimum market cap filter
        min_avg_volume: Minimum average volume filter
        limit: Maximum number of tickers to return

    Returns:
        List of ticker symbols
    """
    try:
        # Get all tickers and filter by major exchanges (handles pagination automatically)
        all_tickers = get_all_tickers(active_only=True)

        # Filter for major exchanges (most likely to have options)
        major_exchanges = {"NASDAQ", "NYSE", "AMEX", "BATS"}
        filtered_tickers = [
            ticker
            for ticker in all_tickers
            if ticker.get("exchange", "").upper() in major_exchanges
        ]

        # Extract just the symbols
        symbols = [ticker["symbol"] for ticker in filtered_tickers]

        # Remove duplicates and sort
        symbols = sorted(list(set(symbols)))

        return symbols[:limit] if limit else symbols

    except Exception:
        # Fallback to common liquid tickers
        return [
            "AAPL",
            "MSFT",
            "GOOGL",
            "AMZN",
            "TSLA",
            "META",
            "NVDA",
            "AMD",
            "NFLX",
            "CRM",
            "ADBE",
            "PYPL",
            "INTC",
            "CSCO",
            "ORCL",
            "IBM",
            "SPY",
            "QQQ",
            "IWM",
            "DIA",
            "XLF",
            "XLK",
            "XLE",
            "XLV",
            "JPM",
            "BAC",
            "WFC",
            "GS",
            "MS",
            "C",
            "V",
            "MA",
            "JNJ",
            "PFE",
            "UNH",
            "ABBV",
            "MRK",
            "TMO",
            "ABT",
            "LLY",
        ]


def validate_ticker_symbols(symbols: list[str]) -> list[str]:
    """
    Validate ticker symbols against database.

    Args:
        symbols: List of ticker symbols to validate

    Returns:
        List of valid ticker symbols
    """
    valid_symbols = []

    for symbol in symbols:
        try:
            ticker = get_ticker_by_symbol(symbol)
            if ticker:
                valid_symbols.append(symbol.upper())
            else:
                # Ticker not in database, but still allow it
                # (yfinance can scan any ticker)
                # This is useful for ETFs, newly listed stocks, etc.
                valid_symbols.append(symbol.upper())
        except Exception:
            # If validation fails, assume it's valid (fallback)
            valid_symbols.append(symbol.upper())

    return valid_symbols


# Predefined watchlists
WATCHLISTS = {
    "mega_cap": ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "META", "NVDA", "BRK.B"],
    "tech": ["AAPL", "MSFT", "GOOGL", "META", "NVDA", "AMD", "NFLX", "CRM", "ADBE"],
    "finance": ["JPM", "BAC", "WFC", "GS", "MS", "C", "V", "MA", "AXP", "BLK"],
    "healthcare": [
        "JNJ",
        "PFE",
        "UNH",
        "ABBV",
        "MRK",
        "TMO",
        "ABT",
        "LLY",
        "BMY",
        "AMGN",
    ],
    "energy": ["XOM", "CVX", "COP", "EOG", "SLB", "MPC", "VLO", "PSX", "KMI", "OKE"],
    "etfs": ["SPY", "QQQ", "IWM", "DIA", "XLF", "XLK", "XLE", "XLV", "XLI", "XLP"],
    "meme": [
        "GME",
        "AMC",
        "BBBY",
        "PLTR",
        "WISH",
        "CLOV",
        "SPCE",
        "HOOD",
        "MVIS",
        "SNDL",
        "NAKD",
        "EXPR",
        "KOSS",
        "NOK",
        "BB",
        "WKHS",
        "RIDE",
        "NKLA",
        "TLRY",
        "SAVA",
        "PROG",
        "ATER",
        "RDBX",
        "MULN",
        "GREE",
        "IRNT",
        "OPAD",
        "DWAC",
        "PHUN",
        "BENE",
        "MARK",
        "MMAT",
        "TRKA",
        "BBIG",
        "SPRT",
        "GNUS",
        "XELA",
        "CTRM",
        "SHIP",
        "TOPS",
        "GLBS",
        "DRYS",
        "EARS",
        "JAGX",
        "INPX",
        "AYTU",
        "BIOC",
        "TNXP",
        "OPTI",
        "PASO",
        "CHEK",
        "HEPA",
        "VXRT",
        "OCGN",
        "NOVN",
        "BNGO",
        "ZOM",
        "SIRI",
        "DOGE",
        "SHIB",
    ],
    "earnings_this_week": [],  # Would be populated dynamically
}


def get_watchlist(name: str) -> list[str]:
    """
    Get predefined watchlist by name.

    Args:
        name: Watchlist name

    Returns:
        List of ticker symbols
    """
    return WATCHLISTS.get(name.lower(), [])


def get_available_watchlists() -> list[str]:
    """Get list of available watchlist names."""
    return list(WATCHLISTS.keys())


def is_meme_stock(ticker: str) -> bool:
    """
    Check if a ticker is considered a meme stock.

    Args:
        ticker: Stock symbol to check

    Returns:
        True if ticker is in the meme stock list
    """
    return ticker.upper() in [t.upper() for t in WATCHLISTS.get("meme", [])]


def get_high_0dte_activity_tickers() -> list[str]:
    """
    Get list of tickers known for high 0DTE activity.

    NOTE: As of Nov 2025, we no longer block these tickers entirely.
    Instead, we filter 0DTE contracts universally across all tickers.
    This list is kept for backwards compatibility and potential future use.

    Returns:
        Empty list (deprecated functionality)
    """
    return []  # No longer blocking entire tickers - filter 0DTE contracts instead


def should_apply_strict_dte_filtering(ticker: str) -> bool:
    """
    DEPRECATED: As of Nov 2025, we use universal 0DTE filtering instead.

    Args:
        ticker: Stock symbol to check

    Returns:
        False (deprecated - always use universal MIN_DTE_ALL_TICKERS config)
    """
    return False  # Deprecated: Use universal 0DTE filtering instead


def should_block_ticker(ticker: str) -> bool:
    """
    Determine if a ticker should be completely blocked from scanning.

    As of Nov 2025: Only blocks true meme stocks.
    No longer blocks popular tickers like TSLA, NVDA, SPY, QQQ.
    Instead, we filter 0DTE contracts universally across all tickers.

    Args:
        ticker: Stock symbol to check

    Returns:
        True if ticker should be completely blocked (meme stocks only)
    """
    ticker_upper = ticker.upper()
    return is_meme_stock(ticker_upper)  # Only block meme stocks, not popular tickers
