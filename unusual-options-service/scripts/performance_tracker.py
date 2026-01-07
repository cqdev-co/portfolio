#!/usr/bin/env python3
"""
Performance Tracker for Unusual Options Signals

Tracks forward returns on signals to measure actual performance:
- Fetches historical price data after signal detection
- Calculates 1d, 5d forward returns
- Classifies wins/losses based on directional accuracy
- Generates performance reports by grade, ticker, pattern type

Usage:
    # Update performance data for recent signals
    poetry run python scripts/performance_tracker.py --update --days 30

    # Generate performance report
    poetry run python scripts/performance_tracker.py --report --days 30

    # Backtest historical signals
    poetry run python scripts/performance_tracker.py --backtest --days 60

This creates a feedback loop to understand which signals actually work.
"""

import os
import sys
import asyncio
from datetime import datetime, timedelta, date
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, field
from collections import defaultdict
import statistics
import yfinance as yf

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from unusual_options.config import load_config
from unusual_options.storage.database import get_storage
from unusual_options.storage.models import UnusualOptionsSignal

from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.progress import Progress, SpinnerColumn, TextColumn
from rich import box

console = Console()

# Win threshold: stock must move X% in predicted direction
WIN_THRESHOLD_1D = 0.01  # 1% for 1-day
WIN_THRESHOLD_5D = 0.02  # 2% for 5-day

# Cache for price data to avoid repeated API calls
PRICE_CACHE: Dict[str, Dict[str, float]] = {}


@dataclass
class SignalPerformance:
    """Performance metrics for a single signal."""

    signal: UnusualOptionsSignal

    # Prices
    price_at_detection: Optional[float] = None
    price_1d_later: Optional[float] = None
    price_5d_later: Optional[float] = None
    current_price: Optional[float] = None

    # Returns
    return_1d: Optional[float] = None
    return_5d: Optional[float] = None
    return_current: Optional[float] = None

    # Win/Loss classification
    win_1d: Optional[bool] = None
    win_5d: Optional[bool] = None

    # Metadata
    days_since_detection: int = 0
    data_available: bool = True
    error_message: Optional[str] = None


def get_historical_prices(
    ticker: str, start_date: date, end_date: date
) -> Dict[str, float]:
    """
    Get historical prices for a ticker.

    Returns dict mapping date string to close price.
    """
    cache_key = f"{ticker}_{start_date}_{end_date}"
    if cache_key in PRICE_CACHE:
        return PRICE_CACHE[cache_key]

    try:
        yf_ticker = yf.Ticker(ticker)
        hist = yf_ticker.history(
            start=start_date, end=end_date + timedelta(days=1), interval="1d"
        )

        if hist.empty:
            return {}

        prices = {}
        for idx, row in hist.iterrows():
            date_str = idx.strftime("%Y-%m-%d")
            prices[date_str] = row["Close"]

        PRICE_CACHE[cache_key] = prices
        return prices

    except Exception as e:
        console.print(f"[dim]Error fetching {ticker}: {e}[/dim]")
        return {}


def get_trading_day_offset(
    base_date: date, offset_days: int, prices: Dict[str, float]
) -> Optional[str]:
    """
    Find the trading day that is approximately offset_days after base_date.

    Handles weekends/holidays by finding nearest available date.
    """
    target_date = base_date + timedelta(days=offset_days)

    # Try exact date first
    date_str = target_date.strftime("%Y-%m-%d")
    if date_str in prices:
        return date_str

    # Look forward up to 5 days for next trading day
    for i in range(1, 6):
        check_date = target_date + timedelta(days=i)
        date_str = check_date.strftime("%Y-%m-%d")
        if date_str in prices:
            return date_str

    return None


def calculate_signal_performance(
    signal: UnusualOptionsSignal, prices: Dict[str, float]
) -> SignalPerformance:
    """Calculate performance metrics for a single signal."""

    perf = SignalPerformance(signal=signal)

    detection_date = signal.detection_timestamp.date()
    perf.days_since_detection = (date.today() - detection_date).days

    # Get price at detection
    detection_str = detection_date.strftime("%Y-%m-%d")
    if detection_str in prices:
        perf.price_at_detection = prices[detection_str]
    else:
        # Try next trading day
        next_day = get_trading_day_offset(detection_date, 1, prices)
        if next_day:
            perf.price_at_detection = prices[next_day]

    if not perf.price_at_detection:
        perf.data_available = False
        perf.error_message = "No price at detection"
        return perf

    # Get 1-day later price (if available)
    day_1 = get_trading_day_offset(detection_date, 1, prices)
    if day_1 and day_1 in prices:
        perf.price_1d_later = prices[day_1]
        perf.return_1d = (
            perf.price_1d_later - perf.price_at_detection
        ) / perf.price_at_detection

        # Classify win/loss for 1d
        if signal.option_type == "call":
            perf.win_1d = perf.return_1d >= WIN_THRESHOLD_1D
        else:  # put
            perf.win_1d = perf.return_1d <= -WIN_THRESHOLD_1D

    # Get 5-day later price (if available)
    day_5 = get_trading_day_offset(detection_date, 5, prices)
    if day_5 and day_5 in prices:
        perf.price_5d_later = prices[day_5]
        perf.return_5d = (
            perf.price_5d_later - perf.price_at_detection
        ) / perf.price_at_detection

        # Classify win/loss for 5d
        if signal.option_type == "call":
            perf.win_5d = perf.return_5d >= WIN_THRESHOLD_5D
        else:  # put
            perf.win_5d = perf.return_5d <= -WIN_THRESHOLD_5D

    # Get current price (most recent in prices dict)
    if prices:
        latest_date = max(prices.keys())
        perf.current_price = prices[latest_date]
        perf.return_current = (
            perf.current_price - perf.price_at_detection
        ) / perf.price_at_detection

    return perf


class PerformanceTracker:
    """Track and analyze signal performance."""

    def __init__(self):
        self.config = load_config()
        self.storage = get_storage(self.config)
        self.signals: List[UnusualOptionsSignal] = []
        self.performances: List[SignalPerformance] = []

    async def fetch_signals(self, days: int = 30, min_grade: str = "A") -> None:
        """Fetch signals for performance tracking."""
        console.print(
            f"[blue]Fetching signals for performance analysis "
            f"(last {days} days, grade {min_grade}+)...[/blue]"
        )

        # Need signals old enough to have forward returns
        end_date = datetime.now().date() - timedelta(days=1)  # Exclude today
        start_date = end_date - timedelta(days=days)

        self.signals = await self.storage.get_signals(
            min_grade=min_grade, start_date=start_date, end_date=end_date, limit=10000
        )

        console.print(f"[green]✓ Loaded {len(self.signals)} signals[/green]")

    def calculate_all_performance(self) -> None:
        """Calculate performance for all signals."""

        # Group signals by ticker for efficient API calls
        by_ticker = defaultdict(list)
        for signal in self.signals:
            by_ticker[signal.ticker].append(signal)

        console.print(
            f"[blue]Calculating performance for {len(by_ticker)} tickers...[/blue]"
        )

        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=console,
        ) as progress:
            task = progress.add_task("Processing...", total=len(by_ticker))

            for ticker, ticker_signals in by_ticker.items():
                progress.update(task, description=f"Processing {ticker}...")

                # Get date range for this ticker
                dates = [s.detection_timestamp.date() for s in ticker_signals]
                min_date = min(dates) - timedelta(days=1)
                max_date = max(dates) + timedelta(days=10)  # Buffer for forward returns

                # Don't go beyond today
                if max_date > date.today():
                    max_date = date.today()

                # Fetch prices
                prices = get_historical_prices(ticker, min_date, max_date)

                # Calculate performance for each signal
                for signal in ticker_signals:
                    perf = calculate_signal_performance(signal, prices)
                    self.performances.append(perf)

                progress.advance(task)

    def get_stats_by_grade(self) -> Dict[str, Dict[str, Any]]:
        """Calculate performance statistics by grade."""

        by_grade = defaultdict(list)
        for perf in self.performances:
            by_grade[perf.signal.grade].append(perf)

        stats = {}
        for grade, perfs in by_grade.items():
            valid_1d = [p for p in perfs if p.win_1d is not None]
            valid_5d = [p for p in perfs if p.win_5d is not None]

            wins_1d = sum(1 for p in valid_1d if p.win_1d)
            wins_5d = sum(1 for p in valid_5d if p.win_5d)

            returns_1d = [p.return_1d for p in perfs if p.return_1d is not None]
            returns_5d = [p.return_5d for p in perfs if p.return_5d is not None]

            stats[grade] = {
                "total": len(perfs),
                "win_rate_1d": wins_1d / len(valid_1d) if valid_1d else 0,
                "win_rate_5d": wins_5d / len(valid_5d) if valid_5d else 0,
                "avg_return_1d": statistics.mean(returns_1d) if returns_1d else 0,
                "avg_return_5d": statistics.mean(returns_5d) if returns_5d else 0,
                "valid_1d": len(valid_1d),
                "valid_5d": len(valid_5d),
            }

        return stats

    def get_stats_by_type(self) -> Dict[str, Dict[str, Any]]:
        """Calculate performance statistics by option type."""

        calls = [p for p in self.performances if p.signal.option_type == "call"]
        puts = [p for p in self.performances if p.signal.option_type == "put"]

        stats = {}

        for name, perfs in [("CALLS", calls), ("PUTS", puts)]:
            valid_1d = [p for p in perfs if p.win_1d is not None]
            valid_5d = [p for p in perfs if p.win_5d is not None]

            wins_1d = sum(1 for p in valid_1d if p.win_1d)
            wins_5d = sum(1 for p in valid_5d if p.win_5d)

            returns_1d = [p.return_1d for p in perfs if p.return_1d is not None]
            returns_5d = [p.return_5d for p in perfs if p.return_5d is not None]

            stats[name] = {
                "total": len(perfs),
                "win_rate_1d": wins_1d / len(valid_1d) if valid_1d else 0,
                "win_rate_5d": wins_5d / len(valid_5d) if valid_5d else 0,
                "avg_return_1d": statistics.mean(returns_1d) if returns_1d else 0,
                "avg_return_5d": statistics.mean(returns_5d) if returns_5d else 0,
            }

        return stats

    def get_top_performers(self, n: int = 10) -> List[SignalPerformance]:
        """Get top N performing signals by 5d return."""

        valid = [p for p in self.performances if p.return_5d is not None]

        # Sort calls by highest return, puts by lowest (most negative)
        calls = sorted(
            [p for p in valid if p.signal.option_type == "call"],
            key=lambda x: x.return_5d or 0,
            reverse=True,
        )

        puts = sorted(
            [p for p in valid if p.signal.option_type == "put"],
            key=lambda x: x.return_5d or 0,
            reverse=False,  # Most negative = best for puts
        )

        # Interleave and return top N
        result = []
        for i in range(max(len(calls), len(puts))):
            if i < len(calls):
                result.append(calls[i])
            if i < len(puts):
                result.append(puts[i])
            if len(result) >= n:
                break

        return result[:n]

    def get_worst_performers(self, n: int = 10) -> List[SignalPerformance]:
        """Get worst N performing signals by 5d return."""

        valid = [p for p in self.performances if p.return_5d is not None]

        # Sort calls by lowest return (worst), puts by highest (worst for puts)
        calls = sorted(
            [p for p in valid if p.signal.option_type == "call"],
            key=lambda x: x.return_5d or 0,
            reverse=False,  # Lowest = worst for calls
        )

        puts = sorted(
            [p for p in valid if p.signal.option_type == "put"],
            key=lambda x: x.return_5d or 0,
            reverse=True,  # Highest = worst for puts
        )

        # Return worst performers
        result = []
        for i in range(max(len(calls), len(puts))):
            if i < len(calls):
                result.append(calls[i])
            if i < len(puts):
                result.append(puts[i])
            if len(result) >= n:
                break

        return result[:n]

    def display_summary(self) -> None:
        """Display overall performance summary."""

        valid_1d = [p for p in self.performances if p.win_1d is not None]
        valid_5d = [p for p in self.performances if p.win_5d is not None]

        wins_1d = sum(1 for p in valid_1d if p.win_1d)
        wins_5d = sum(1 for p in valid_5d if p.win_5d)

        win_rate_1d = wins_1d / len(valid_1d) * 100 if valid_1d else 0
        win_rate_5d = wins_5d / len(valid_5d) * 100 if valid_5d else 0

        returns_1d = [p.return_1d for p in self.performances if p.return_1d]
        returns_5d = [p.return_5d for p in self.performances if p.return_5d]

        avg_return_1d = statistics.mean(returns_1d) * 100 if returns_1d else 0
        avg_return_5d = statistics.mean(returns_5d) * 100 if returns_5d else 0

        summary = f"""
[bold cyan]Performance Summary[/bold cyan]

Total Signals Analyzed: {len(self.performances)}
├── With 1d data: {len(valid_1d)}
└── With 5d data: {len(valid_5d)}

[bold cyan]Win Rates[/bold cyan] (stock moves ≥{WIN_THRESHOLD_1D * 100:.0f}%/≥{WIN_THRESHOLD_5D * 100:.0f}% in predicted direction)

1-Day Win Rate: {win_rate_1d:.1f}% ({wins_1d}/{len(valid_1d)})
5-Day Win Rate: {win_rate_5d:.1f}% ({wins_5d}/{len(valid_5d)})

[bold cyan]Average Returns[/bold cyan]

1-Day Avg Return: {avg_return_1d:+.2f}%
5-Day Avg Return: {avg_return_5d:+.2f}%
"""

        console.print(
            Panel(summary, title="📊 Signal Performance Analysis", border_style="cyan")
        )

    def display_by_grade(self) -> None:
        """Display performance breakdown by grade."""

        stats = self.get_stats_by_grade()

        table = Table(title="Performance by Grade", box=box.ROUNDED)
        table.add_column("Grade", style="bold")
        table.add_column("Signals", justify="right")
        table.add_column("1D Win%", justify="right")
        table.add_column("5D Win%", justify="right")
        table.add_column("1D Avg", justify="right")
        table.add_column("5D Avg", justify="right")

        grade_order = ["S", "A", "B", "C", "D", "F"]

        for grade in grade_order:
            if grade not in stats:
                continue

            s = stats[grade]

            # Color code win rates
            win_1d_style = (
                "green"
                if s["win_rate_1d"] >= 0.55
                else "red"
                if s["win_rate_1d"] < 0.45
                else "yellow"
            )
            win_5d_style = (
                "green"
                if s["win_rate_5d"] >= 0.55
                else "red"
                if s["win_rate_5d"] < 0.45
                else "yellow"
            )

            grade_style = {
                "S": "bold green",
                "A": "bold blue",
                "B": "bold yellow",
                "C": "orange",
                "D": "red",
                "F": "dim red",
            }.get(grade, "white")

            table.add_row(
                f"[{grade_style}]{grade}[/{grade_style}]",
                str(s["total"]),
                f"[{win_1d_style}]{s['win_rate_1d'] * 100:.1f}%[/{win_1d_style}]",
                f"[{win_5d_style}]{s['win_rate_5d'] * 100:.1f}%[/{win_5d_style}]",
                f"{s['avg_return_1d'] * 100:+.2f}%",
                f"{s['avg_return_5d'] * 100:+.2f}%",
            )

        console.print(table)

    def display_by_type(self) -> None:
        """Display performance breakdown by option type."""

        stats = self.get_stats_by_type()

        table = Table(title="Performance by Option Type", box=box.ROUNDED)
        table.add_column("Type", style="bold")
        table.add_column("Signals", justify="right")
        table.add_column("1D Win%", justify="right")
        table.add_column("5D Win%", justify="right")
        table.add_column("1D Avg", justify="right")
        table.add_column("5D Avg", justify="right")

        for name, s in stats.items():
            type_style = "green" if name == "CALLS" else "red"

            win_1d_style = (
                "green"
                if s["win_rate_1d"] >= 0.55
                else "red"
                if s["win_rate_1d"] < 0.45
                else "yellow"
            )
            win_5d_style = (
                "green"
                if s["win_rate_5d"] >= 0.55
                else "red"
                if s["win_rate_5d"] < 0.45
                else "yellow"
            )

            table.add_row(
                f"[{type_style}]{name}[/{type_style}]",
                str(s["total"]),
                f"[{win_1d_style}]{s['win_rate_1d'] * 100:.1f}%[/{win_1d_style}]",
                f"[{win_5d_style}]{s['win_rate_5d'] * 100:.1f}%[/{win_5d_style}]",
                f"{s['avg_return_1d'] * 100:+.2f}%",
                f"{s['avg_return_5d'] * 100:+.2f}%",
            )

        console.print(table)

    def display_top_performers(self, n: int = 10) -> None:
        """Display top performing signals."""

        top = self.get_top_performers(n)

        if not top:
            return

        table = Table(title=f"🏆 Top {n} Best Performing Signals", box=box.ROUNDED)
        table.add_column("Ticker", style="cyan bold")
        table.add_column("Type", justify="center")
        table.add_column("Grade", justify="center")
        table.add_column("5D Return", justify="right", style="green")
        table.add_column("Premium", justify="right")
        table.add_column("Detected", justify="right")

        for perf in top:
            s = perf.signal
            type_style = "green" if s.option_type == "call" else "red"
            type_icon = "🟢" if s.option_type == "call" else "🔴"

            # For puts, a negative return is a win, so show absolute value
            return_display = perf.return_5d * 100 if perf.return_5d else 0
            if s.option_type == "put":
                return_display = abs(return_display)

            table.add_row(
                s.ticker,
                f"[{type_style}]{type_icon} {s.option_type.upper()}[/{type_style}]",
                s.grade,
                f"{return_display:+.1f}%",
                f"${s.premium_flow / 1_000_000:.1f}M" if s.premium_flow else "N/A",
                s.detection_timestamp.strftime("%m/%d"),
            )

        console.print(table)

    def display_worst_performers(self, n: int = 10) -> None:
        """Display worst performing signals."""

        worst = self.get_worst_performers(n)

        if not worst:
            return

        table = Table(title=f"📉 Top {n} Worst Performing Signals", box=box.ROUNDED)
        table.add_column("Ticker", style="cyan bold")
        table.add_column("Type", justify="center")
        table.add_column("Grade", justify="center")
        table.add_column("5D Return", justify="right", style="red")
        table.add_column("Premium", justify="right")
        table.add_column("Detected", justify="right")

        for perf in worst:
            s = perf.signal
            type_style = "green" if s.option_type == "call" else "red"
            type_icon = "🟢" if s.option_type == "call" else "🔴"

            return_display = perf.return_5d * 100 if perf.return_5d else 0

            table.add_row(
                s.ticker,
                f"[{type_style}]{type_icon} {s.option_type.upper()}[/{type_style}]",
                s.grade,
                f"{return_display:+.1f}%",
                f"${s.premium_flow / 1_000_000:.1f}M" if s.premium_flow else "N/A",
                s.detection_timestamp.strftime("%m/%d"),
            )

        console.print(table)

    async def run_report(self, days: int = 30, min_grade: str = "A") -> None:
        """Generate full performance report."""

        console.print(
            Panel.fit(
                "[bold cyan]📊 Signal Performance Report[/bold cyan]\n"
                f"Analyzing {days} days of signals (grade {min_grade}+)\n"
                f"Win threshold: {WIN_THRESHOLD_1D * 100:.0f}% (1d), "
                f"{WIN_THRESHOLD_5D * 100:.0f}% (5d)",
                border_style="cyan",
            )
        )

        # Fetch signals
        await self.fetch_signals(days, min_grade)

        if len(self.signals) < 5:
            console.print("[yellow]Not enough signals for analysis.[/yellow]")
            return

        # Calculate performance
        self.calculate_all_performance()

        # Display reports
        console.print()
        self.display_summary()
        console.print()
        self.display_by_grade()
        console.print()
        self.display_by_type()
        console.print()
        self.display_top_performers(10)
        console.print()
        self.display_worst_performers(10)

        # Interpretation guide
        console.print()
        console.print(
            Panel(
                "[bold]📖 How to Interpret[/bold]\n\n"
                "[cyan]Win Rate[/cyan]: % of signals where stock moved "
                "in predicted direction\n"
                f"  • CALL win = stock up ≥{WIN_THRESHOLD_1D * 100:.0f}% (1d) / "
                f"≥{WIN_THRESHOLD_5D * 100:.0f}% (5d)\n"
                f"  • PUT win = stock down ≥{WIN_THRESHOLD_1D * 100:.0f}% (1d) / "
                f"≥{WIN_THRESHOLD_5D * 100:.0f}% (5d)\n\n"
                "[cyan]What's Good?[/cyan]\n"
                "  • >55% win rate = strategy has edge\n"
                "  • 50% win rate = coin flip (no edge)\n"
                "  • <45% win rate = negative edge (signals inversely useful)\n\n"
                "[cyan]Next Steps[/cyan]\n"
                "  • If Grade S/A > 55% win rate → focus on those\n"
                "  • If specific tickers outperform → track those\n"
                "  • If win rate < 50% → filters need tuning",
                border_style="blue",
            )
        )


async def main():
    import argparse

    parser = argparse.ArgumentParser(description="Track and analyze signal performance")
    parser.add_argument(
        "--days", type=int, default=30, help="Number of days to analyze (default: 30)"
    )
    parser.add_argument(
        "--min-grade", type=str, default="A", help="Minimum signal grade (default: A)"
    )
    parser.add_argument(
        "--report", action="store_true", help="Generate performance report"
    )

    args = parser.parse_args()

    tracker = PerformanceTracker()
    await tracker.run_report(days=args.days, min_grade=args.min_grade)


if __name__ == "__main__":
    asyncio.run(main())
