#!/usr/bin/env python3
"""
Penny Stock Ticker Fetcher

This script fetches penny stock tickers from multiple global markets
and stores them in a Supabase database. Penny stocks are typically
defined as stocks trading below $5 with smaller market caps.

Penny Stock Characteristics:
- Price: $0.10 - $5.00 per share
- Market Cap: $5M - $300M (micro to small cap)
- Volume: Lower thresholds than regular stocks
- Higher risk, higher volatility profile

Data Sources:
- Alpha Vantage API (US markets)
- Financial Modeling Prep API (Global markets)
- Yahoo Finance (fallback validation)

Quality Filtering:
- Removes CFDs and derivatives
- Filters out warrants, units, preferred shares
- Validates data availability and quality
- Focuses on tradeable penny stocks

Usage:
    python fetch_penny_tickers.py [--dry-run] [--verbose]
"""

import os
import sys
import logging
import argparse
from dataclasses import dataclass
import requests
from supabase import create_client, Client
from dotenv import load_dotenv

# Import quality filtering utilities
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "utils"))
from utils.yfinance_validator import YFinanceValidator
from utils.common_filters import is_cfd_ticker
from utils.db_utils import store_tickers as store_tickers_util
from utils.constants import (
    TABLE_PENNY_TICKERS,
    DEFAULT_BATCH_SIZE,
    RATE_LIMIT_DELAY_SECONDS,
    PENNY_MIN_PRICE,
    PENNY_MAX_PRICE,
    PENNY_MIN_MARKET_CAP,
    PENNY_MAX_MARKET_CAP,
    PENNY_MIN_VOLUME,
    FMP_MAX_CANDIDATES,
    DEFAULT_MAX_PENNY_TICKERS,
)

# Load environment variables
load_dotenv()


@dataclass
class PennyTickerInfo:
    """Data class for penny ticker information"""

    symbol: str
    name: str
    exchange: str | None = None
    country: str | None = None
    currency: str | None = None
    sector: str | None = None
    industry: str | None = None
    market_cap: int | None = None
    ticker_type: str = "stock"


class PennyTickerFilter:
    """Penny stock specific filtering logic"""

    def __init__(self) -> None:
        # Penny stock specific thresholds
        self.min_price = PENNY_MIN_PRICE
        self.max_price = PENNY_MAX_PRICE
        self.min_market_cap = PENNY_MIN_MARKET_CAP
        self.max_market_cap = PENNY_MAX_MARKET_CAP
        self.min_volume = PENNY_MIN_VOLUME

        # US exchanges
        self.us_exchanges = {
            "NASDAQ",
            "NYSE",
            "NYSEARCA",
            "NYSEMKT",
            "OTC",
            "OTCQX",
            "OTCQB",
            "PINK",  # Include OTC markets
        }

    def calculate_penny_quality_score(
        self, price: float, volume: float, market_cap: float
    ) -> float:
        """
        Calculate quality score specific to penny stocks.
        Score: 0-100 (higher is better)
        """
        score = 0.0

        # Price scoring (inverted - lower prices get higher scores)
        if 0.50 <= price <= 2.00:
            score += 30  # Sweet spot for penny stocks
        elif 0.10 <= price < 0.50:
            score += 25  # Very low price
        elif 2.00 < price <= 5.00:
            score += 20  # Upper range penny stocks

        # Volume scoring
        if volume >= 500_000:
            score += 30  # High liquidity for penny stock
        elif volume >= 100_000:
            score += 25  # Good liquidity
        elif volume >= 50_000:
            score += 20  # Acceptable liquidity
        elif volume >= 10_000:
            score += 10  # Minimum liquidity

        # Market cap scoring
        if 50_000_000 <= market_cap <= 300_000_000:
            score += 25  # Small cap
        elif 10_000_000 <= market_cap < 50_000_000:
            score += 20  # Micro cap
        elif 5_000_000 <= market_cap < 10_000_000:
            score += 15  # Very small cap

        # Base score for passing basic filters
        score += 15

        return score


class PennyTickerFetcher:
    """Main class for fetching and storing penny stock ticker data"""

    def __init__(
        self,
        dry_run: bool = False,
        verbose: bool = False,
        enable_yfinance_validation: bool = True,
        max_tickers: int = DEFAULT_MAX_PENNY_TICKERS,
    ) -> None:
        self.dry_run = dry_run
        self.verbose = verbose
        self.enable_yfinance_validation = enable_yfinance_validation
        self.max_tickers = max_tickers

        self.setup_logging()
        self.setup_supabase()
        self.setup_api_keys()
        self.penny_filter = PennyTickerFilter()
        self.setup_yfinance_validator()

    def setup_logging(self):
        """Configure logging"""
        level = logging.DEBUG if self.verbose else logging.INFO
        logging.basicConfig(
            level=level,
            format="%(asctime)s - %(levelname)s - %(message)s",
            handlers=[
                logging.StreamHandler(sys.stdout),
                logging.FileHandler("penny_ticker_fetch.log"),
            ],
        )
        self.logger = logging.getLogger(__name__)

    def setup_supabase(self) -> None:
        """Initialize Supabase client"""
        url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
        key = os.getenv("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY")

        if not url or not key:
            raise ValueError(
                "Missing Supabase credentials. Please set "
                "NEXT_PUBLIC_SUPABASE_URL and "
                "NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY in your .env file"
            )

        self.supabase: Client = create_client(url, key)
        self.logger.info("Supabase client initialized")

    def setup_api_keys(self) -> None:
        """Setup API keys for data sources"""
        self.alpha_vantage_key = os.getenv("ALPHA_VANTAGE_API_KEY")
        self.fmp_key = os.getenv("FMP_API_KEY")

        if not self.alpha_vantage_key and not self.fmp_key:
            self.logger.warning("No API keys found. Will use free data sources only.")

    def setup_yfinance_validator(self) -> None:
        """Setup YFinance data quality validator with penny stock settings"""
        if self.enable_yfinance_validation:
            self.yfinance_validator = YFinanceValidator(
                min_history_days=60,  # Reduced for penny stocks
                min_volume=PENNY_MIN_VOLUME,
                min_price=PENNY_MIN_PRICE,
                max_price=PENNY_MAX_PRICE,
                min_data_completeness=0.75,  # More lenient
                max_gap_ratio=0.15,  # Allow more gaps
                recency_days=7,  # Extended recency window
                max_workers=3,
                request_delay=0.5,
            )
            self.logger.info(
                "YFinance validation enabled for penny stocks "
                "(price: $0.10-$5.00, volume: 10k+)"
            )
        else:
            self.yfinance_validator = None
            self.logger.info("YFinance validation disabled")

    def fetch_fmp_penny_tickers(self) -> list[PennyTickerInfo]:
        """Fetch penny stock tickers from Financial Modeling Prep API"""
        if not self.fmp_key:
            self.logger.info("Skipping FMP (no API key)")
            return []

        tickers = []
        try:
            # FMP stock list endpoint with penny stock filters
            url = "https://financialmodelingprep.com/api/v3/stock-screener"
            params = {
                "apikey": self.fmp_key,
                "priceMoreThan": PENNY_MIN_PRICE,
                "priceLowerThan": PENNY_MAX_PRICE,
                "marketCapMoreThan": PENNY_MIN_MARKET_CAP,
                "marketCapLowerThan": PENNY_MAX_MARKET_CAP,
                "volumeMoreThan": PENNY_MIN_VOLUME,
                "limit": FMP_MAX_CANDIDATES,
            }

            self.logger.info("Fetching penny tickers from Financial Modeling Prep...")
            response = requests.get(url, params=params, timeout=60)
            response.raise_for_status()

            data = response.json()

            for item in data:
                symbol = item.get("symbol", "").strip() if item.get("symbol") else ""
                name = (
                    item.get("companyName", "").strip()
                    if item.get("companyName")
                    else ""
                )

                # Skip tickers with missing required fields
                if not symbol or not name:
                    continue

                # Skip CFDs
                if is_cfd_ticker(symbol, name, item.get("exchange", "")):
                    continue

                ticker = PennyTickerInfo(
                    symbol=symbol,
                    name=name,
                    exchange=item.get("exchange"),
                    country=item.get("country", "US"),
                    currency="USD",
                    sector=item.get("sector"),
                    industry=item.get("industry"),
                    market_cap=item.get("marketCap"),
                    ticker_type="stock",
                )
                tickers.append(ticker)

            self.logger.info(f"Fetched {len(tickers)} penny tickers from FMP")

        except requests.RequestException as e:
            self.logger.error(f"Network error fetching from FMP: {e}")
        except (ValueError, KeyError) as e:
            self.logger.error(f"Data parsing error from FMP: {e}")
        except Exception as e:
            self.logger.error(f"Unexpected error fetching from FMP: {e}", exc_info=True)

        return tickers

    def fetch_alpha_vantage_penny_tickers(self) -> list[PennyTickerInfo]:
        """
        Fetch penny stock tickers from Alpha Vantage API
        (Note: Alpha Vantage doesn't support penny stock filtering,
        so we'll fetch all and filter locally)
        """
        if not self.alpha_vantage_key:
            self.logger.info("Skipping Alpha Vantage (no API key)")
            return []

        tickers = []
        try:
            url = "https://www.alphavantage.co/query"
            params = {"function": "LISTING_STATUS", "apikey": self.alpha_vantage_key}

            self.logger.info(
                "Fetching tickers from Alpha Vantage (will filter locally)..."
            )
            response = requests.get(url, params=params, timeout=30)
            response.raise_for_status()

            response_text = response.text.strip()
            if not response_text or response_text == "{}" or len(response_text) < 100:
                self.logger.warning("Alpha Vantage returned empty/invalid response")
                return []

            if response_text.startswith("{") and response_text.endswith("}"):
                self.logger.warning("Alpha Vantage returned JSON error response")
                return []

            lines = response_text.split("\n")
            if len(lines) < 2:
                self.logger.warning("Alpha Vantage response has insufficient data")
                return []

            for line in lines[1:]:
                if not line.strip():
                    continue

                values = line.split(",")
                if len(values) >= 3:
                    symbol = values[0].strip()
                    name = values[1].strip()

                    if not symbol or not name:
                        continue

                    # Skip CFDs
                    exchange = values[2].strip() if len(values) > 2 else None
                    if is_cfd_ticker(symbol, name, exchange or ""):
                        continue

                    ticker = PennyTickerInfo(
                        symbol=symbol,
                        name=name,
                        exchange=exchange,
                        country="US",
                        currency="USD",
                        ticker_type="stock",
                    )
                    tickers.append(ticker)

            self.logger.info(
                f"Fetched {len(tickers)} tickers from Alpha Vantage "
                f"(will validate for penny stock criteria)"
            )

        except requests.RequestException as e:
            self.logger.error(f"Network error fetching from Alpha Vantage: {e}")
        except (ValueError, KeyError) as e:
            self.logger.error(f"Data parsing error from Alpha Vantage: {e}")
        except Exception as e:
            self.logger.error(
                f"Unexpected error fetching from Alpha Vantage: {e}", exc_info=True
            )

        return tickers

    def deduplicate_tickers(
        self, all_tickers: list[PennyTickerInfo]
    ) -> list[PennyTickerInfo]:
        """Remove duplicate tickers"""
        seen_symbols: set[str] = set()
        unique_tickers: list[PennyTickerInfo] = []

        for ticker in all_tickers:
            if ticker.symbol not in seen_symbols:
                seen_symbols.add(ticker.symbol)
                unique_tickers.append(ticker)

        self.logger.info(
            f"Deduplicated {len(all_tickers)} tickers to "
            f"{len(unique_tickers)} unique tickers"
        )

        return unique_tickers

    def apply_yfinance_validation(
        self, tickers: list[PennyTickerInfo]
    ) -> list[PennyTickerInfo]:
        """
        Apply YFinance data quality validation for penny stocks.
        This validates price range, volume, and data availability.
        """
        if not self.enable_yfinance_validation or not self.yfinance_validator:
            self.logger.info("YFinance validation disabled, skipping")
            return tickers

        self.logger.info(
            f"Applying YFinance validation to {len(tickers)} penny tickers "
            f"(this may take 10-20 minutes...)"
        )

        # Extract symbols for validation
        symbols = [t.symbol for t in tickers]

        try:
            # Validate all tickers in parallel
            validation_results = self.yfinance_validator.validate_batch(
                symbols,
                period="3mo",  # Shorter period for penny stocks
                verbose=self.verbose,
            )

            # Filter to only valid penny stock tickers
            validated_tickers = []
            for ticker in tickers:
                result = validation_results.get(ticker.symbol)
                if result and result.is_valid:
                    # Double-check price is in penny stock range
                    if (
                        result.last_price
                        and self.penny_filter.min_price
                        <= result.last_price
                        <= self.penny_filter.max_price
                    ):
                        validated_tickers.append(ticker)
                elif result and self.verbose:
                    self.logger.debug(
                        f"Rejected {ticker.symbol}: "
                        f"{', '.join(result.validation_issues[:2])}"
                    )

            # Generate summary
            summary = self.yfinance_validator.get_validation_summary(validation_results)

            self.logger.info(
                f"YFinance validation complete: {len(validated_tickers)} "
                f"penny tickers passed ({summary['pass_rate'] * 100:.1f}% pass rate)"
            )

            if summary["top_rejection_reasons"]:
                self.logger.info("Top rejection reasons:")
                for reason_info in summary["top_rejection_reasons"][:5]:
                    self.logger.info(
                        f"  - {reason_info['reason']}: {reason_info['count']} tickers"
                    )

            self.logger.info(
                f"Price range: ${summary['price_range']['min']:.2f} - "
                f"${summary['price_range']['max']:.2f} "
                f"(avg: ${summary['price_range']['avg']:.2f})"
            )

            return validated_tickers

        except (ValueError, KeyError) as e:
            self.logger.error(f"Data error during YFinance validation: {e}")
            self.logger.warning(
                "YFinance validation failed, proceeding with unvalidated tickers"
            )
            return tickers
        except Exception as e:
            self.logger.error(
                f"Unexpected error during YFinance validation: {e}", exc_info=True
            )
            self.logger.warning(
                "YFinance validation failed, proceeding with unvalidated tickers"
            )
            return tickers

    def store_tickers(self, tickers: list[PennyTickerInfo]) -> bool:
        """Store penny tickers in Supabase database"""
        return store_tickers_util(
            self.supabase,
            tickers,
            TABLE_PENNY_TICKERS,
            dry_run=self.dry_run,
            batch_size=DEFAULT_BATCH_SIZE,
            rate_limit_delay=RATE_LIMIT_DELAY_SECONDS,
        )

    def run(self) -> bool:
        """Main execution method"""
        self.logger.info("Starting penny ticker fetch process...")

        # Fetch from all sources
        all_tickers = []

        # Financial Modeling Prep (preferred for penny stocks)
        fmp_tickers = self.fetch_fmp_penny_tickers()
        all_tickers.extend(fmp_tickers)

        # Alpha Vantage (will need filtering)
        av_tickers = self.fetch_alpha_vantage_penny_tickers()
        all_tickers.extend(av_tickers)

        if not all_tickers:
            self.logger.error("No penny tickers fetched from any source")
            return False

        # Deduplicate
        unique_tickers = self.deduplicate_tickers(all_tickers)

        # Apply YFinance validation (validates price range and data quality)
        validated_tickers = self.apply_yfinance_validation(unique_tickers)

        if not validated_tickers:
            self.logger.error("No penny tickers remaining after YFinance validation")
            return False

        # Final limit
        if len(validated_tickers) > self.max_tickers:
            self.logger.info(
                f"Final limit: Reducing from {len(validated_tickers)} to "
                f"{self.max_tickers} penny tickers"
            )
            validated_tickers = validated_tickers[: self.max_tickers]

        # Store in database
        success = self.store_tickers(validated_tickers)

        if success:
            self.logger.info("Penny ticker fetch process completed successfully")
        else:
            self.logger.error("Penny ticker fetch process failed")

        return success


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description="Fetch penny stock tickers and store in Supabase"
    )
    parser.add_argument(
        "--dry-run", action="store_true", help="Run without actually storing data"
    )
    parser.add_argument("--verbose", action="store_true", help="Enable verbose logging")
    parser.add_argument(
        "--disable-yfinance-validation",
        action="store_true",
        help="Disable YFinance data quality validation (not recommended)",
    )
    parser.add_argument(
        "--max-tickers",
        type=int,
        default=DEFAULT_MAX_PENNY_TICKERS,
        help=f"Maximum number of penny tickers to store (default: {DEFAULT_MAX_PENNY_TICKERS})",
    )

    args = parser.parse_args()

    try:
        fetcher = PennyTickerFetcher(
            dry_run=args.dry_run,
            verbose=args.verbose,
            enable_yfinance_validation=not args.disable_yfinance_validation,
            max_tickers=args.max_tickers,
        )
        success = fetcher.run()
        sys.exit(0 if success else 1)

    except (ValueError, KeyError) as e:
        logging.error(f"Configuration error: {e}")
        sys.exit(1)
    except Exception as e:
        logging.error(f"Fatal error: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
