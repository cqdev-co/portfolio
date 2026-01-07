#!/usr/bin/env python3
"""
Backfill script to add country risk data to existing penny stock signals.

This script:
1. Fetches all unique symbols from penny_stock_signals
2. Gets country info for each symbol via yfinance
3. Determines high-risk country status
4. Checks for pump-and-dump warning criteria
5. Updates all records for each symbol
"""

import os
import sys
from datetime import datetime

# Add parent to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import yfinance as yf
from supabase import create_client
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn
from rich.table import Table

console = Console()

# High-risk countries (from settings)
HIGH_RISK_COUNTRIES = ["China", "Israel", "Malaysia", "Greece", "Cyprus"]
MODERATE_RISK_COUNTRIES = ["Hong Kong", "Cayman Islands", "British Virgin Islands"]


def get_supabase_client():
    """Create Supabase client from environment variables."""
    url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get(
        "NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY"
    )

    if not url or not key:
        console.print("[red]Error: Missing Supabase credentials[/red]")
        console.print("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY")
        sys.exit(1)

    return create_client(url, key)


def get_country(symbol: str) -> str | None:
    """Fetch country from yfinance with caching."""
    try:
        ticker = yf.Ticker(symbol)
        info = ticker.info
        return info.get("country")
    except Exception as e:
        console.print(
            f"[yellow]Warning: Could not get country for {symbol}: {e}[/yellow]"
        )
        return None


def check_pump_dump_warning(
    volume_ratio: float | None,
    overall_score: float | None,
    is_high_risk: bool,
    close_price: float | None,
) -> bool:
    """Check if signal shows pump-and-dump characteristics."""
    if volume_ratio is None or overall_score is None:
        return False

    # Extreme volume (10x+) with high score is suspicious
    if volume_ratio >= 10.0 and overall_score >= 0.75:
        return True

    # High-risk country + very high volume + sub-$1 price
    if is_high_risk and volume_ratio >= 8.0 and close_price and close_price < 1.0:
        return True

    return False


def main():
    console.print("\n[bold blue]📊 Backfilling Country Risk Data[/bold blue]\n")

    supabase = get_supabase_client()

    # Step 1: Get all unique symbols
    console.print("[cyan]Fetching unique symbols from database...[/cyan]")

    result = supabase.table("penny_stock_signals").select("symbol").execute()

    if not result.data:
        console.print("[yellow]No signals found in database[/yellow]")
        return

    # Get unique symbols
    symbols = list(set(row["symbol"] for row in result.data))
    console.print(f"[green]Found {len(symbols)} unique symbols[/green]\n")

    # Step 2: Fetch country for each symbol
    country_cache: dict[str, str | None] = {}
    updates_made = 0
    errors = 0

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        console=console,
    ) as progress:
        task = progress.add_task("Processing symbols...", total=len(symbols))

        for symbol in symbols:
            progress.update(task, description=f"Processing {symbol}...")

            # Get country
            country = get_country(symbol)
            country_cache[symbol] = country

            # Determine risk status
            is_high_risk = country in HIGH_RISK_COUNTRIES if country else False

            # Fetch all signals for this symbol to check pump-dump warning
            signals = (
                supabase.table("penny_stock_signals")
                .select("id, volume_ratio, overall_score, close_price")
                .eq("symbol", symbol)
                .execute()
            )

            for signal in signals.data:
                pump_dump_warning = check_pump_dump_warning(
                    signal.get("volume_ratio"),
                    signal.get("overall_score"),
                    is_high_risk,
                    signal.get("close_price"),
                )

                # Update the record
                try:
                    supabase.table("penny_stock_signals").update(
                        {
                            "country": country,
                            "is_high_risk_country": is_high_risk,
                            "pump_dump_warning": pump_dump_warning,
                        }
                    ).eq("id", signal["id"]).execute()
                    updates_made += 1
                except Exception as e:
                    console.print(f"[red]Error updating {symbol}: {e}[/red]")
                    errors += 1

            progress.advance(task)

    # Summary
    console.print("\n" + "=" * 50)
    console.print("[bold green]✅ Backfill Complete![/bold green]\n")

    # Stats table
    stats_table = Table(title="Backfill Summary")
    stats_table.add_column("Metric", style="cyan")
    stats_table.add_column("Value", style="green")

    stats_table.add_row("Symbols Processed", str(len(symbols)))
    stats_table.add_row("Records Updated", str(updates_made))
    stats_table.add_row("Errors", str(errors))

    console.print(stats_table)

    # Country breakdown
    console.print("\n[bold]Country Distribution:[/bold]")
    country_counts: dict[str, int] = {}
    for symbol, country in country_cache.items():
        key = country or "Unknown"
        country_counts[key] = country_counts.get(key, 0) + 1

    country_table = Table()
    country_table.add_column("Country", style="cyan")
    country_table.add_column("Count", style="green")
    country_table.add_column("Risk", style="yellow")

    for country, count in sorted(country_counts.items(), key=lambda x: -x[1]):
        risk = "⚠️ HIGH" if country in HIGH_RISK_COUNTRIES else ""
        if country in MODERATE_RISK_COUNTRIES:
            risk = "⚡ MODERATE"
        country_table.add_row(country, str(count), risk)

    console.print(country_table)


if __name__ == "__main__":
    main()
