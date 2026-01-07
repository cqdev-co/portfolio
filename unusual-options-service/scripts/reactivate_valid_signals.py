#!/usr/bin/env python3
"""
Reactivate Valid Signals - Helper Script
==========================================
Identifies and reactivates signals that were falsely marked inactive
due to the 3-hour rule bug (before the fix).

A signal should be reactivated if:
1. Currently marked as inactive (is_active = false)
2. Option hasn't expired yet (expiry >= today)
3. Was detected recently (within last 7 days)

Usage:
    python scripts/reactivate_valid_signals.py [--dry-run] [--days 7]

Options:
    --dry-run    Show what would be reactivated without making changes
    --days N     Look back N days for signals (default: 7)
    --verbose    Show detailed information about each signal
"""

import os
import sys
from datetime import datetime, timezone, date, timedelta
from pathlib import Path
from typing import List, Dict, Any
import argparse

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from supabase import create_client, Client
from rich.console import Console
from rich.table import Table
from rich.panel import Panel

console = Console()


def load_config() -> Dict[str, Any]:
    """Load Supabase configuration from environment."""
    from dotenv import load_dotenv

    load_dotenv()

    config = {
        "SUPABASE_URL": os.getenv("SUPABASE_URL"),
        "SUPABASE_SERVICE_KEY": os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        or os.getenv("SUPABASE_SERVICE_KEY")
        or os.getenv("SUPABASE_KEY"),
    }

    return config


def get_falsely_inactive_signals(
    client: Client, days_back: int = 7
) -> List[Dict[str, Any]]:
    """
    Find signals that were incorrectly marked inactive.

    Criteria:
    - is_active = false (marked inactive)
    - expiry >= CURRENT_DATE (option not expired)
    - last_detected_at within days_back (recently seen)
    """
    cutoff_date = datetime.now(timezone.utc) - timedelta(days=days_back)
    today = date.today()

    console.print(f"\n[cyan]Searching for falsely inactive signals...[/cyan]")
    console.print(f"  • Option expiry: >= {today}")
    console.print(f"  • Last detected: >= {cutoff_date.strftime('%Y-%m-%d')}")

    result = (
        client.table("unusual_options_signals")
        .select("*")
        .eq("is_active", False)
        .gte("expiry", today.isoformat())
        .gte("last_detected_at", cutoff_date.isoformat())
        .order("last_detected_at", desc=True)
        .execute()
    )

    return result.data if result.data else []


def display_signal_summary(signals: List[Dict[str, Any]]) -> None:
    """Display summary table of signals to reactivate."""
    if not signals:
        console.print("[green]✓ No falsely inactive signals found![/green]")
        console.print("All signals are correctly marked.")
        return

    table = Table(title=f"Falsely Inactive Signals ({len(signals)} found)")
    table.add_column("Ticker", style="cyan")
    table.add_column("Contract", style="magenta")
    table.add_column("Grade", style="bold")
    table.add_column("Expiry", style="yellow")
    table.add_column("Last Detected", style="dim")
    table.add_column("Days to Expiry", justify="right")

    for signal in signals:
        expiry = datetime.fromisoformat(signal["expiry"].replace("Z", "+00:00"))
        last_detected = datetime.fromisoformat(
            signal["last_detected_at"].replace("Z", "+00:00")
        )
        days_to_expiry = (expiry.date() - date.today()).days

        grade_style = {
            "S": "bold red",
            "A": "bold yellow",
            "B": "bold blue",
            "C": "bold green",
            "D": "dim",
            "F": "dim red",
        }.get(signal["grade"], "white")

        table.add_row(
            signal["ticker"],
            signal["option_symbol"][-15:],  # Last 15 chars
            f"[{grade_style}]{signal['grade']}[/{grade_style}]",
            expiry.strftime("%Y-%m-%d"),
            last_detected.strftime("%Y-%m-%d %H:%M"),
            str(days_to_expiry),
        )

    console.print("\n")
    console.print(table)


def display_detailed_info(signals: List[Dict[str, Any]]) -> None:
    """Display detailed information about signals."""
    by_ticker = {}
    for signal in signals:
        ticker = signal["ticker"]
        if ticker not in by_ticker:
            by_ticker[ticker] = []
        by_ticker[ticker].append(signal)

    console.print("\n[bold]Breakdown by Ticker:[/bold]")
    for ticker, ticker_signals in sorted(
        by_ticker.items(), key=lambda x: len(x[1]), reverse=True
    )[:10]:  # Top 10
        console.print(f"  • {ticker}: {len(ticker_signals)} signals")


def reactivate_signals(
    client: Client, signals: List[Dict[str, Any]], dry_run: bool = False
) -> int:
    """
    Reactivate the falsely inactive signals.

    Returns:
        Number of signals successfully reactivated
    """
    if not signals:
        return 0

    if dry_run:
        console.print("\n[yellow]DRY RUN: Would reactivate these signals[/yellow]")
        return len(signals)

    console.print(f"\n[cyan]Reactivating {len(signals)} signals...[/cyan]")

    # Get signal IDs
    signal_ids = [s["signal_id"] for s in signals]

    # Batch update
    result = (
        client.table("unusual_options_signals")
        .update(
            {"is_active": True, "updated_at": datetime.now(timezone.utc).isoformat()}
        )
        .in_("signal_id", signal_ids)
        .execute()
    )

    if result.data:
        count = len(result.data)
        console.print(f"[green]✓ Successfully reactivated {count} signals[/green]")
        return count
    else:
        console.print("[red]✗ Failed to reactivate signals[/red]")
        return 0


def verify_reactivation(client: Client, days_back: int = 7) -> None:
    """Verify no more falsely inactive signals exist."""
    signals = get_falsely_inactive_signals(client, days_back)

    if not signals:
        console.print("\n[green bold]✓ Verification passed![/green bold]")
        console.print("No falsely inactive signals remaining.")
    else:
        console.print(
            f"\n[yellow]⚠ Warning: Still {len(signals)} "
            f"falsely inactive signals found[/yellow]"
        )


def get_stats(client: Client) -> Dict[str, int]:
    """Get current signal statistics."""
    # Active signals
    active_result = (
        client.table("unusual_options_signals")
        .select("signal_id", count="exact")
        .eq("is_active", True)
        .execute()
    )

    # Inactive signals (expired)
    today = date.today()
    inactive_expired = (
        client.table("unusual_options_signals")
        .select("signal_id", count="exact")
        .eq("is_active", False)
        .lt("expiry", today.isoformat())
        .execute()
    )

    # Inactive signals (not expired - should be 0 after fix)
    inactive_not_expired = (
        client.table("unusual_options_signals")
        .select("signal_id", count="exact")
        .eq("is_active", False)
        .gte("expiry", today.isoformat())
        .execute()
    )

    return {
        "active": active_result.count or 0,
        "inactive_expired": inactive_expired.count or 0,
        "inactive_not_expired": inactive_not_expired.count or 0,
    }


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Reactivate signals falsely marked inactive"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be reactivated without making changes",
    )
    parser.add_argument(
        "--days", type=int, default=7, help="Look back N days for signals (default: 7)"
    )
    parser.add_argument(
        "--verbose", action="store_true", help="Show detailed information"
    )

    args = parser.parse_args()

    try:
        # Load config
        config = load_config()

        # Create client
        client = create_client(config["SUPABASE_URL"], config["SUPABASE_SERVICE_KEY"])

        # Display header
        console.print(
            Panel(
                "[bold cyan]Reactivate Valid Signals[/bold cyan]\n"
                "Fixes signals incorrectly marked inactive by 3-hour rule bug",
                border_style="cyan",
            )
        )

        # Get current stats
        console.print("\n[bold]Current Database Status:[/bold]")
        stats = get_stats(client)
        console.print(f"  • Active signals: {stats['active']}")
        console.print(f"  • Inactive (expired): {stats['inactive_expired']}")
        console.print(
            f"  • Inactive (NOT expired): "
            f"[{'red' if stats['inactive_not_expired'] > 0 else 'green'}]"
            f"{stats['inactive_not_expired']}[/]"
        )

        if stats["inactive_not_expired"] == 0:
            console.print("\n[green bold]✓ All signals correctly marked![/green bold]")
            console.print("No action needed.")
            return

        # Find falsely inactive signals
        signals = get_falsely_inactive_signals(client, args.days)

        if not signals:
            console.print("\n[green]✓ No falsely inactive signals found![/green]")
            return

        # Display summary
        display_signal_summary(signals)

        if args.verbose:
            display_detailed_info(signals)

        # Reactivate
        if args.dry_run:
            console.print("\n[yellow]DRY RUN MODE[/yellow]")
            console.print(f"Would reactivate {len(signals)} signals")
        else:
            # Confirm
            console.print(
                f"\n[yellow]About to reactivate {len(signals)} signals. "
                f"Continue?[/yellow]"
            )
            response = input("Type 'yes' to confirm: ")

            if response.lower() != "yes":
                console.print("[dim]Cancelled.[/dim]")
                return

            # Do it
            count = reactivate_signals(client, signals, dry_run=False)

            if count > 0:
                # Verify
                verify_reactivation(client, args.days)

                # Show new stats
                console.print("\n[bold]New Database Status:[/bold]")
                new_stats = get_stats(client)
                console.print(f"  • Active signals: {new_stats['active']}")
                console.print(
                    f"  • Inactive (NOT expired): "
                    f"[{'red' if new_stats['inactive_not_expired'] > 0 else 'green'}]"
                    f"{new_stats['inactive_not_expired']}[/]"
                )

    except Exception as e:
        console.print(f"\n[red bold]Error: {e}[/red bold]")
        raise


if __name__ == "__main__":
    main()
