#!/usr/bin/env python3
"""
Classification Validator for Unusual Options Signals

Validates the new classification system by comparing predicted
vs actual win rates. Extends performance tracking with:

1. Stats by classification (not just grade)
2. Predicted vs actual win rate comparison
3. Classification accuracy metrics
4. Updates signals with actual outcomes in DB

Usage:
    # Validate classifications against actual outcomes
    poetry run python scripts/classification_validator.py \
        --validate --days 30

    # Update signals with actual returns (writes to DB)
    poetry run python scripts/classification_validator.py \
        --update --days 30

    # Full report with validation
    poetry run python scripts/classification_validator.py \
        --report --days 60
"""

import asyncio
import os
import statistics
import sys
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, timedelta

import yfinance as yf

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from rich import box
from rich.console import Console
from rich.panel import Panel
from rich.progress import Progress, SpinnerColumn, TextColumn
from rich.table import Table

from unusual_options.config import load_config
from unusual_options.storage.database import get_storage
from unusual_options.storage.models import (
    CLASSIFICATION_WIN_RATES,
    SignalClassification,
    UnusualOptionsSignal,
)

console = Console()

# Win threshold: stock must move X% in predicted direction
WIN_THRESHOLD_1D = 0.01  # 1% for 1-day
WIN_THRESHOLD_5D = 0.02  # 2% for 5-day

# Cache for price data
PRICE_CACHE: dict[str, dict[str, float]] = {}


@dataclass
class SignalOutcome:
    """Outcome metrics for a single signal."""

    signal: UnusualOptionsSignal

    # Prices
    price_at_detection: float | None = None
    price_1d_later: float | None = None
    price_5d_later: float | None = None

    # Returns
    return_1d: float | None = None
    return_5d: float | None = None

    # Win/Loss classification
    win_1d: bool | None = None
    win_5d: bool | None = None

    # Classification validation
    classification_correct: bool | None = None
    prediction_error: float | None = None  # predicted - actual

    # Metadata
    days_since_detection: int = 0
    data_available: bool = True
    error_message: str | None = None


@dataclass
class ClassificationStats:
    """Statistics for a single classification."""

    classification: str
    predicted_win_rate: float | None
    actual_win_rate_1d: float
    actual_win_rate_5d: float
    signal_count: int
    win_count_1d: int
    win_count_5d: int
    avg_return_1d: float
    avg_return_5d: float
    prediction_accuracy: float | None  # How close predicted vs actual


def get_historical_prices(
    ticker: str, start_date: date, end_date: date
) -> dict[str, float]:
    """Get historical prices for a ticker."""
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
    base_date: date, offset_days: int, prices: dict[str, float]
) -> str | None:
    """Find the trading day that is approximately offset_days after."""
    target_date = base_date + timedelta(days=offset_days)

    date_str = target_date.strftime("%Y-%m-%d")
    if date_str in prices:
        return date_str

    for i in range(1, 6):
        check_date = target_date + timedelta(days=i)
        date_str = check_date.strftime("%Y-%m-%d")
        if date_str in prices:
            return date_str

    return None


def calculate_signal_outcome(
    signal: UnusualOptionsSignal, prices: dict[str, float]
) -> SignalOutcome:
    """Calculate outcome metrics for a single signal."""

    outcome = SignalOutcome(signal=signal)
    detection_date = signal.detection_timestamp.date()
    outcome.days_since_detection = (date.today() - detection_date).days

    # Get price at detection
    detection_str = detection_date.strftime("%Y-%m-%d")
    if detection_str in prices:
        outcome.price_at_detection = prices[detection_str]
    else:
        next_day = get_trading_day_offset(detection_date, 1, prices)
        if next_day:
            outcome.price_at_detection = prices[next_day]

    if not outcome.price_at_detection:
        outcome.data_available = False
        outcome.error_message = "No price at detection"
        return outcome

    # Get 1-day later price
    day_1 = get_trading_day_offset(detection_date, 1, prices)
    if day_1 and day_1 in prices:
        outcome.price_1d_later = prices[day_1]
        outcome.return_1d = (
            outcome.price_1d_later - outcome.price_at_detection
        ) / outcome.price_at_detection

        # Classify win/loss for 1d
        if signal.option_type == "call":
            outcome.win_1d = outcome.return_1d >= WIN_THRESHOLD_1D
        else:  # put
            outcome.win_1d = outcome.return_1d <= -WIN_THRESHOLD_1D

    # Get 5-day later price
    day_5 = get_trading_day_offset(detection_date, 5, prices)
    if day_5 and day_5 in prices:
        outcome.price_5d_later = prices[day_5]
        outcome.return_5d = (
            outcome.price_5d_later - outcome.price_at_detection
        ) / outcome.price_at_detection

        # Classify win/loss for 5d
        if signal.option_type == "call":
            outcome.win_5d = outcome.return_5d >= WIN_THRESHOLD_5D
        else:  # put
            outcome.win_5d = outcome.return_5d <= -WIN_THRESHOLD_5D

    return outcome


class ClassificationValidator:
    """Validate classification system against actual outcomes."""

    def __init__(self):
        self.config = load_config()
        self.storage = get_storage(self.config)
        self.signals: list[UnusualOptionsSignal] = []
        self.outcomes: list[SignalOutcome] = []

    async def fetch_signals(self, days: int = 30, min_grade: str = "F") -> None:
        """Fetch signals for classification validation."""
        console.print(
            f"[blue]Fetching signals for classification validation "
            f"(last {days} days)...[/blue]"
        )

        # Exclude today to allow for forward returns
        end_date = datetime.now().date() - timedelta(days=1)
        start_date = end_date - timedelta(days=days)

        self.signals = await self.storage.get_signals(
            min_grade=min_grade,
            start_date=start_date,
            end_date=end_date,
            limit=10000,
        )

        console.print(f"[green]✓ Loaded {len(self.signals)} signals[/green]")

        # Log classification distribution
        by_class = defaultdict(int)
        for s in self.signals:
            by_class[s.signal_classification] += 1

        console.print("[dim]Classification distribution:[/dim]")
        for cls, count in sorted(by_class.items()):
            console.print(f"  [dim]{cls}: {count}[/dim]")

    def calculate_all_outcomes(self) -> None:
        """Calculate outcomes for all signals."""

        by_ticker = defaultdict(list)
        for signal in self.signals:
            by_ticker[signal.ticker].append(signal)

        console.print(
            f"[blue]Calculating outcomes for {len(by_ticker)} tickers...[/blue]"
        )

        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=console,
        ) as progress:
            task = progress.add_task("Processing...", total=len(by_ticker))

            for ticker, ticker_signals in by_ticker.items():
                progress.update(task, description=f"Processing {ticker}...")

                # Get date range
                dates = [s.detection_timestamp.date() for s in ticker_signals]
                min_date = min(dates) - timedelta(days=1)
                max_date = max(dates) + timedelta(days=10)

                if max_date > date.today():
                    max_date = date.today()

                prices = get_historical_prices(ticker, min_date, max_date)

                for signal in ticker_signals:
                    outcome = calculate_signal_outcome(signal, prices)
                    self.outcomes.append(outcome)

                progress.advance(task)

    def get_stats_by_classification(self) -> dict[str, ClassificationStats]:
        """Calculate performance statistics by classification."""

        by_class = defaultdict(list)
        for outcome in self.outcomes:
            classification = outcome.signal.signal_classification
            by_class[classification].append(outcome)

        stats = {}
        for classification, outcomes in by_class.items():
            valid_1d = [o for o in outcomes if o.win_1d is not None]
            valid_5d = [o for o in outcomes if o.win_5d is not None]

            wins_1d = sum(1 for o in valid_1d if o.win_1d)
            wins_5d = sum(1 for o in valid_5d if o.win_5d)

            returns_1d = [o.return_1d for o in outcomes if o.return_1d is not None]
            returns_5d = [o.return_5d for o in outcomes if o.return_5d is not None]

            actual_win_rate_1d = wins_1d / len(valid_1d) if valid_1d else 0
            actual_win_rate_5d = wins_5d / len(valid_5d) if valid_5d else 0

            # Get predicted win rate from constants
            try:
                cls_enum = SignalClassification(classification)
                predicted = CLASSIFICATION_WIN_RATES.get(cls_enum)
            except ValueError:
                predicted = None

            # Calculate prediction accuracy (how close we were)
            prediction_accuracy = None
            if predicted is not None and valid_5d:
                prediction_accuracy = 1 - abs(predicted - actual_win_rate_5d)

            stats[classification] = ClassificationStats(
                classification=classification,
                predicted_win_rate=predicted,
                actual_win_rate_1d=actual_win_rate_1d,
                actual_win_rate_5d=actual_win_rate_5d,
                signal_count=len(outcomes),
                win_count_1d=wins_1d,
                win_count_5d=wins_5d,
                avg_return_1d=(statistics.mean(returns_1d) if returns_1d else 0),
                avg_return_5d=(statistics.mean(returns_5d) if returns_5d else 0),
                prediction_accuracy=prediction_accuracy,
            )

        return stats

    def display_classification_validation(self) -> None:
        """Display classification validation results."""

        stats = self.get_stats_by_classification()

        table = Table(
            title="📊 Classification System Validation",
            box=box.ROUNDED,
        )
        table.add_column("Classification", style="bold")
        table.add_column("Count", justify="right")
        table.add_column("Predicted", justify="right")
        table.add_column("Actual 5D", justify="right")
        table.add_column("Δ Error", justify="right")
        table.add_column("Accuracy", justify="right")
        table.add_column("Avg 5D Ret", justify="right")

        # Order by classification priority
        class_order = [
            "high_conviction",
            "moderate",
            "informational",
            "likely_hedge",
            "contrarian",
            "unclassified",
        ]

        for classification in class_order:
            if classification not in stats:
                continue

            s = stats[classification]

            # Style based on classification
            class_style = {
                "high_conviction": "bold green",
                "moderate": "bold yellow",
                "informational": "blue",
                "likely_hedge": "magenta",
                "contrarian": "bold red",
                "unclassified": "dim",
            }.get(classification, "white")

            # Predicted win rate
            predicted_str = (
                f"{s.predicted_win_rate:.0%}"
                if s.predicted_win_rate is not None
                else "N/A"
            )

            # Actual win rate with color coding
            actual_style = (
                "green"
                if s.actual_win_rate_5d >= 0.50
                else "red"
                if s.actual_win_rate_5d < 0.40
                else "yellow"
            )
            actual_str = f"[{actual_style}]{s.actual_win_rate_5d:.0%}"
            actual_str += f"[/{actual_style}]"

            # Prediction error
            if s.predicted_win_rate is not None:
                error = s.actual_win_rate_5d - s.predicted_win_rate
                error_style = (
                    "green"
                    if abs(error) < 0.10
                    else "red"
                    if abs(error) > 0.20
                    else "yellow"
                )
                error_str = f"[{error_style}]{error:+.0%}[/{error_style}]"
            else:
                error_str = "N/A"

            # Prediction accuracy
            if s.prediction_accuracy is not None:
                acc_style = (
                    "green"
                    if s.prediction_accuracy >= 0.85
                    else "red"
                    if s.prediction_accuracy < 0.70
                    else "yellow"
                )
                acc_str = f"[{acc_style}]{s.prediction_accuracy:.0%}[/{acc_style}]"
            else:
                acc_str = "N/A"

            # Average return
            ret_style = "green" if s.avg_return_5d > 0 else "red"
            ret_str = f"[{ret_style}]{s.avg_return_5d * 100:+.2f}%[/{ret_style}]"

            table.add_row(
                f"[{class_style}]{classification}[/{class_style}]",
                str(s.signal_count),
                predicted_str,
                actual_str,
                error_str,
                acc_str,
                ret_str,
            )

        console.print(table)

    def display_validation_summary(self) -> None:
        """Display overall validation summary."""

        stats = self.get_stats_by_classification()

        # Calculate weighted accuracy
        total_signals = sum(s.signal_count for s in stats.values())
        weighted_accuracy = 0
        accuracy_count = 0

        for s in stats.values():
            if s.prediction_accuracy is not None:
                weighted_accuracy += s.prediction_accuracy * s.signal_count
                accuracy_count += s.signal_count

        avg_accuracy = weighted_accuracy / accuracy_count if accuracy_count > 0 else 0

        # Count classifications with edge (>50% win rate)
        classifications_with_edge = sum(
            1 for s in stats.values() if s.actual_win_rate_5d > 0.50
        )

        # Best and worst performing
        valid_stats = [s for s in stats.values() if s.signal_count >= 5]

        if valid_stats:
            best = max(valid_stats, key=lambda x: x.actual_win_rate_5d)
            worst = min(valid_stats, key=lambda x: x.actual_win_rate_5d)
        else:
            best = worst = None

        summary = f"""
[bold cyan]Classification System Validation Summary[/bold cyan]

Total Signals Analyzed: {total_signals}
Classifications with Edge (>50%): {classifications_with_edge}/{len(stats)}

[bold cyan]Model Accuracy[/bold cyan]
Average Prediction Accuracy: {avg_accuracy:.1%}
(Accuracy = 1 - |predicted_rate - actual_rate|)
"""

        if best:
            summary += f"""
[bold cyan]Best Performing Classification[/bold cyan]
{best.classification}: {best.actual_win_rate_5d:.1%} win rate
({best.win_count_5d}/{best.signal_count} signals)
"""

        if worst:
            summary += f"""
[bold cyan]Worst Performing Classification[/bold cyan]
{worst.classification}: {worst.actual_win_rate_5d:.1%} win rate
({worst.win_count_5d}/{worst.signal_count} signals)
"""

        summary += """
[bold cyan]Recommendations[/bold cyan]
"""

        # Dynamic recommendations based on results
        for classification, s in stats.items():
            if s.signal_count < 5:
                continue

            predicted = s.predicted_win_rate
            actual = s.actual_win_rate_5d

            if predicted is not None:
                error = actual - predicted
                if error > 0.15:
                    summary += (
                        f"• {classification}: Underrated! "
                        f"Consider boosting to "
                        f"{actual:.0%} expected win rate\n"
                    )
                elif error < -0.15:
                    summary += (
                        f"• {classification}: Overrated! "
                        f"Consider lowering to "
                        f"{actual:.0%} expected win rate\n"
                    )

        console.print(
            Panel(
                summary,
                title="📈 Validation Results",
                border_style="cyan",
            )
        )

    def display_factor_analysis(self) -> None:
        """Display analysis of classification factors."""

        factor_wins = defaultdict(lambda: {"wins": 0, "total": 0})

        for outcome in self.outcomes:
            if outcome.win_5d is None:
                continue

            factors = outcome.signal.classification_factors
            if not factors:
                continue

            for factor in factors:
                factor_wins[factor]["total"] += 1
                if outcome.win_5d:
                    factor_wins[factor]["wins"] += 1

        if not factor_wins:
            return

        table = Table(
            title="📊 Factor Performance Analysis",
            box=box.ROUNDED,
        )
        table.add_column("Factor", style="bold")
        table.add_column("Signals", justify="right")
        table.add_column("Win Rate", justify="right")

        # Sort by win rate
        sorted_factors = sorted(
            factor_wins.items(),
            key=lambda x: x[1]["wins"] / x[1]["total"] if x[1]["total"] > 0 else 0,
            reverse=True,
        )

        for factor, data in sorted_factors:
            if data["total"] < 3:
                continue

            win_rate = data["wins"] / data["total"]
            rate_style = (
                "green" if win_rate >= 0.55 else "red" if win_rate < 0.45 else "yellow"
            )

            table.add_row(
                factor,
                str(data["total"]),
                f"[{rate_style}]{win_rate:.0%}[/{rate_style}]",
            )

        console.print(table)

    async def update_signals_with_outcomes(self) -> int:
        """Update signals in DB with actual returns."""

        console.print("[blue]Updating signals with actual outcomes...[/blue]")

        client = self.storage._get_client()
        updated_count = 0

        for outcome in self.outcomes:
            if not outcome.data_available:
                continue

            # Only update if we have 5d data
            if outcome.return_5d is None:
                continue

            try:
                update_data = {
                    "forward_return_1d": outcome.return_1d,
                    "forward_return_5d": outcome.return_5d,
                    "win": outcome.win_5d,
                }

                result = (
                    client.table("unusual_options_signals")
                    .update(update_data)
                    .eq("ticker", outcome.signal.ticker)
                    .eq("option_symbol", outcome.signal.option_symbol)
                    .eq(
                        "detection_timestamp",
                        outcome.signal.detection_timestamp.isoformat(),
                    )
                    .execute()
                )

                if result.data:
                    updated_count += 1

            except Exception as e:
                console.print(f"[dim]Error updating {outcome.signal.ticker}: {e}[/dim]")

        console.print(f"[green]✓ Updated {updated_count} signals with outcomes[/green]")
        return updated_count

    async def run_validation(self, days: int = 30) -> None:
        """Run full classification validation."""

        console.print(
            Panel.fit(
                "[bold cyan]🔍 Classification System Validation[/bold cyan]\n"
                f"Analyzing {days} days of signals\n"
                f"Win threshold: {WIN_THRESHOLD_1D * 100:.0f}% (1d), "
                f"{WIN_THRESHOLD_5D * 100:.0f}% (5d)",
                border_style="cyan",
            )
        )

        await self.fetch_signals(days, min_grade="F")

        if len(self.signals) < 5:
            console.print("[yellow]Not enough signals for validation.[/yellow]")
            return

        self.calculate_all_outcomes()

        console.print()
        self.display_classification_validation()
        console.print()
        self.display_validation_summary()
        console.print()
        self.display_factor_analysis()

        # Interpretation guide
        console.print()
        console.print(
            Panel(
                "[bold]📖 How to Use Validation Results[/bold]\n\n"
                "[cyan]Prediction Accuracy[/cyan]\n"
                "  • ≥85% = Model is well calibrated\n"
                "  • 70-85% = Acceptable, minor tuning needed\n"
                "  • <70% = Significant recalibration needed\n\n"
                "[cyan]Delta Error[/cyan]\n"
                "  • Positive = Actual better than predicted "
                "(underrated)\n"
                "  • Negative = Actual worse than predicted "
                "(overrated)\n\n"
                "[cyan]Action Items[/cyan]\n"
                "  • Update CLASSIFICATION_WIN_RATES in models.py\n"
                "  • Adjust classification thresholds in grader.py\n"
                "  • Add/remove classification factors",
                border_style="blue",
            )
        )


async def main():
    import argparse

    parser = argparse.ArgumentParser(description="Validate classification system")
    parser.add_argument(
        "--days",
        type=int,
        default=30,
        help="Number of days to analyze (default: 30)",
    )
    parser.add_argument(
        "--validate",
        action="store_true",
        help="Run classification validation",
    )
    parser.add_argument(
        "--update",
        action="store_true",
        help="Update signals with actual outcomes in DB",
    )
    parser.add_argument(
        "--report",
        action="store_true",
        help="Generate full validation report",
    )

    args = parser.parse_args()

    validator = ClassificationValidator()

    if args.update:
        await validator.fetch_signals(args.days, min_grade="F")
        validator.calculate_all_outcomes()
        await validator.update_signals_with_outcomes()
    elif (
        args.validate
        or args.report
        or not any([args.validate, args.update, args.report])
    ):
        await validator.run_validation(days=args.days)


if __name__ == "__main__":
    asyncio.run(main())
