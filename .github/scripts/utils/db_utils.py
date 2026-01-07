#!/usr/bin/env python3
"""
Shared database utilities for ticker fetching scripts
"""

import logging
import time
from datetime import datetime, UTC
from supabase import Client

from .constants import DEFAULT_BATCH_SIZE, RATE_LIMIT_DELAY_SECONDS

logger = logging.getLogger(__name__)


def store_tickers(
    supabase: Client,
    tickers: list,
    table_name: str,
    dry_run: bool = False,
    batch_size: int = DEFAULT_BATCH_SIZE,
    rate_limit_delay: float = RATE_LIMIT_DELAY_SECONDS,
) -> bool:
    """
    Store tickers in Supabase database.

    Args:
        supabase: Supabase client instance
        tickers: List of ticker objects (must have symbol, name attributes)
        table_name: Name of the table to insert into
        dry_run: If True, don't actually store data
        batch_size: Number of tickers per batch
        rate_limit_delay: Delay between batches in seconds

    Returns:
        True if successful, False otherwise
    """
    if dry_run:
        logger.info(f"DRY RUN: Would store {len(tickers)} tickers in {table_name}")
        return True

    try:
        # Prepare data for batch insert
        ticker_data = []
        skipped_count = 0

        for ticker in tickers:
            # Skip tickers with missing required fields
            if not (ticker.name or "").strip():
                logger.warning(
                    f"Skipping ticker {getattr(ticker, 'symbol', 'unknown')}: "
                    f"missing or empty name"
                )
                skipped_count += 1
                continue

            symbol = getattr(ticker, "symbol", "").strip()
            if not symbol:
                logger.warning(f"Skipping ticker with empty symbol: name={ticker.name}")
                skipped_count += 1
                continue

            # Build data dictionary
            data = {
                "symbol": symbol,
                "name": ticker.name.strip(),
                "exchange": (
                    ticker.exchange.strip()
                    if getattr(ticker, "exchange", None)
                    else None
                ),
                "country": (
                    ticker.country.strip() if getattr(ticker, "country", None) else None
                ),
                "currency": (
                    ticker.currency.strip()
                    if getattr(ticker, "currency", None)
                    else None
                ),
                "sector": (
                    ticker.sector.strip() if getattr(ticker, "sector", None) else None
                ),
                "industry": (
                    ticker.industry.strip()
                    if getattr(ticker, "industry", None)
                    else None
                ),
                "market_cap": getattr(ticker, "market_cap", None),
                "ticker_type": getattr(ticker, "ticker_type", "stock") or "stock",
                "is_active": True,
                "last_fetched": datetime.now(UTC).isoformat(),
            }
            ticker_data.append(data)

        if skipped_count > 0:
            logger.info(
                f"Skipped {skipped_count} tickers due to missing required fields"
            )

        if not ticker_data:
            logger.warning("No ticker data to insert")
            return False

        # Insert in batches to avoid timeouts
        total_inserted = 0

        for i in range(0, len(ticker_data), batch_size):
            batch = ticker_data[i : i + batch_size]

            try:
                supabase.table(table_name).upsert(batch, on_conflict="symbol").execute()

                total_inserted += len(batch)
                logger.info(
                    f"Inserted batch {i // batch_size + 1}: "
                    f"{len(batch)} tickers "
                    f"({total_inserted}/{len(ticker_data)} total)"
                )

                # Rate limiting
                if i + batch_size < len(ticker_data):
                    time.sleep(rate_limit_delay)

            except (ValueError, KeyError, TypeError) as e:
                logger.error(
                    f"Error inserting batch {i // batch_size + 1}: {e}", exc_info=True
                )
                # Continue with next batch instead of failing completely
                continue
            except Exception as e:
                # Catch-all for unexpected errors (network, API, etc.)
                logger.error(
                    f"Unexpected error inserting batch {i // batch_size + 1}: {e}",
                    exc_info=True,
                )
                continue

        logger.info(f"Successfully stored {total_inserted} tickers in {table_name}")
        return total_inserted > 0

    except Exception as e:
        logger.error(f"Error storing tickers in {table_name}: {e}", exc_info=True)
        return False
