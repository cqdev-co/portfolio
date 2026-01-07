#!/usr/bin/env python3
"""
Options Flow Momentum & Reversal Tracker

Tracks changes in unusual options activity over time to identify:
1. Momentum acceleration (increasing unusual activity)
2. Momentum exhaustion (decreasing activity after spike)
3. Reversal patterns (shift from calls to puts or vice versa)
4. Sustained vs one-off unusual activity

Useful for timing entries and exits based on flow patterns.
"""

import asyncio
import os
import statistics
import sys
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Any

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from rich import box
from rich.console import Console
from rich.panel import Panel
from rich.table import Table

from unusual_options.config import load_config
from unusual_options.storage.database import get_storage
from unusual_options.storage.models import UnusualOptionsSignal

console = Console()


@dataclass
class MomentumPattern:
    """Represents a momentum pattern"""

    ticker: str
    pattern_type: str  # ACCELERATING, EXHAUSTING, REVERSING, SUSTAINED
    current_score: float
    previous_score: float
    momentum_strength: float
    days_active: int
    total_premium: float
    interpretation: str
    confidence: float


class MomentumTracker:
    def __init__(self):
        self.config = load_config()
        self.storage = get_storage(self.config)
        self.signals_by_day: dict[date, list[UnusualOptionsSignal]] = {}

    async def fetch_multi_day_signals(
        self, days: int = 7, min_grade: str = "C"
    ) -> None:
        """Fetch signals for multiple days"""
        console.print(f"[blue]Fetching {days} days of historical signals...[/blue]")

        end_date = datetime.now().date() + timedelta(days=1)
        start_date = end_date - timedelta(days=days + 1)

        all_signals = await self.storage.get_signals(
            min_grade=min_grade, start_date=start_date, end_date=end_date, limit=10000
        )

        # Group by day
        for signal in all_signals:
            signal_date = signal.detection_timestamp.date()
            if signal_date not in self.signals_by_day:
                self.signals_by_day[signal_date] = []
            self.signals_by_day[signal_date].append(signal)

        console.print(
            f"[green]✓ Loaded {len(all_signals)} signals across {len(self.signals_by_day)} days[/green]"
        )

    def calculate_daily_scores(self) -> dict[str, dict[date, float]]:
        """Calculate daily activity scores for each ticker"""
        ticker_daily_scores = defaultdict(dict)

        for day, signals in self.signals_by_day.items():
            ticker_signals = defaultdict(list)

            for signal in signals:
                ticker_signals[signal.ticker].append(signal)

            for ticker, ticker_sigs in ticker_signals.items():
                # Calculate composite score based on signal quality and premium flow
                total_score = sum([s.overall_score for s in ticker_sigs])
                total_premium = (
                    sum([s.premium_flow for s in ticker_sigs if s.premium_flow])
                    / 1000000
                )  # In millions

                # Composite score: weighted average of quality and premium
                composite = (total_score * 0.6) + (min(total_premium / 10, 1.0) * 0.4)
                ticker_daily_scores[ticker][day] = composite

        return ticker_daily_scores

    def identify_momentum_patterns(
        self, ticker_daily_scores: dict[str, dict[date, float]]
    ) -> list[MomentumPattern]:
        """Identify momentum and reversal patterns"""
        patterns = []

        sorted_days = sorted(self.signals_by_day.keys())
        if len(sorted_days) < 3:
            return patterns

        for ticker, daily_scores in ticker_daily_scores.items():
            # Need at least 3 days of data
            ticker_days = sorted([day for day in daily_scores.keys()])
            if len(ticker_days) < 3:
                continue

            # Calculate momentum
            recent_scores = [daily_scores[day] for day in ticker_days[-3:]]

            if len(ticker_days) >= 5:
                older_scores = [daily_scores[day] for day in ticker_days[-5:-3]]
            else:
                older_scores = [daily_scores[ticker_days[0]]]

            current_avg = statistics.mean(recent_scores)
            previous_avg = statistics.mean(older_scores)

            # Calculate momentum strength
            if previous_avg > 0:
                momentum_change = (current_avg - previous_avg) / previous_avg
            else:
                momentum_change = 1.0 if current_avg > 0 else 0

            # Identify pattern type
            pattern_type, interpretation, confidence = self._classify_momentum(
                ticker, ticker_days, daily_scores, momentum_change
            )

            if pattern_type:
                # Calculate total premium
                recent_signals = []
                for day in ticker_days[-3:]:
                    recent_signals.extend(
                        [s for s in self.signals_by_day[day] if s.ticker == ticker]
                    )

                total_premium = sum(
                    [s.premium_flow for s in recent_signals if s.premium_flow]
                )

                patterns.append(
                    MomentumPattern(
                        ticker=ticker,
                        pattern_type=pattern_type,
                        current_score=current_avg,
                        previous_score=previous_avg,
                        momentum_strength=momentum_change,
                        days_active=len(ticker_days),
                        total_premium=total_premium,
                        interpretation=interpretation,
                        confidence=confidence,
                    )
                )

        return sorted(
            patterns,
            key=lambda x: abs(x.momentum_strength) * x.confidence,
            reverse=True,
        )

    def _classify_momentum(
        self,
        ticker: str,
        ticker_days: list[date],
        daily_scores: dict[date, float],
        momentum_change: float,
    ) -> tuple[str, str, float]:
        """Classify the momentum pattern"""

        scores = [daily_scores[day] for day in ticker_days]

        # Check for acceleration (increasing momentum)
        if momentum_change > 0.3:
            # Verify it's truly accelerating
            if len(scores) >= 4 and scores[-1] > scores[-2] > scores[-3]:
                return (
                    "ACCELERATING",
                    f"Momentum accelerating: {momentum_change:+.0%} increase in activity",
                    0.9,
                )
            return (
                "INCREASING",
                f"Activity increasing: {momentum_change:+.0%} rise",
                0.7,
            )

        # Check for exhaustion (decreasing momentum after spike)
        elif momentum_change < -0.3:
            if len(scores) >= 4 and max(scores[:-2]) > scores[-1]:
                return (
                    "EXHAUSTING",
                    f"Momentum fading: {momentum_change:+.0%} decline after spike",
                    0.8,
                )
            return (
                "DECREASING",
                f"Activity decreasing: {momentum_change:+.0%} decline",
                0.6,
            )

        # Check for sustained activity
        elif len(ticker_days) >= 5 and abs(momentum_change) < 0.2:
            return (
                "SUSTAINED",
                f"Persistent unusual activity over {len(ticker_days)} days",
                0.85,
            )

        return (None, None, 0)

    def identify_reversals(self) -> list[dict[str, Any]]:
        """Identify directional reversals (calls to puts or vice versa)"""
        reversals = []

        sorted_days = sorted(self.signals_by_day.keys())
        if len(sorted_days) < 3:
            return reversals

        # Split into recent and previous periods
        split_point = len(sorted_days) // 2
        previous_days = sorted_days[:split_point]
        recent_days = sorted_days[split_point:]

        # Group signals by ticker and period
        ticker_periods = defaultdict(
            lambda: {
                "previous": {"calls": [], "puts": []},
                "recent": {"calls": [], "puts": []},
            }
        )

        for day in previous_days:
            for signal in self.signals_by_day[day]:
                if signal.option_type == "call":
                    ticker_periods[signal.ticker]["previous"]["calls"].append(signal)
                elif signal.option_type == "put":
                    ticker_periods[signal.ticker]["previous"]["puts"].append(signal)

        for day in recent_days:
            for signal in self.signals_by_day[day]:
                if signal.option_type == "call":
                    ticker_periods[signal.ticker]["recent"]["calls"].append(signal)
                elif signal.option_type == "put":
                    ticker_periods[signal.ticker]["recent"]["puts"].append(signal)

        # Identify reversals
        for ticker, periods in ticker_periods.items():
            prev_calls = len(periods["previous"]["calls"])
            prev_puts = len(periods["previous"]["puts"])
            recent_calls = len(periods["recent"]["calls"])
            recent_puts = len(periods["recent"]["puts"])

            if (prev_calls + prev_puts) < 3 or (recent_calls + recent_puts) < 3:
                continue

            # Calculate ratios
            prev_ratio = prev_calls / (prev_calls + prev_puts)
            recent_ratio = recent_calls / (recent_calls + recent_puts)

            # Reversal if ratio changes significantly (>40% shift)
            if abs(prev_ratio - recent_ratio) > 0.4:
                if prev_ratio > 0.6 and recent_ratio < 0.4:
                    reversal_type = "BULLISH_TO_BEARISH"
                    interpretation = f"Flow reversed from {prev_ratio:.0%} calls to {recent_ratio:.0%} calls (bearish shift)"
                elif prev_ratio < 0.4 and recent_ratio > 0.6:
                    reversal_type = "BEARISH_TO_BULLISH"
                    interpretation = f"Flow reversed from {prev_ratio:.0%} calls to {recent_ratio:.0%} calls (bullish shift)"
                else:
                    continue

                # Calculate premium
                recent_premium = sum(
                    [
                        s.premium_flow
                        for s in periods["recent"]["calls"] + periods["recent"]["puts"]
                        if s.premium_flow
                    ]
                )

                reversals.append(
                    {
                        "ticker": ticker,
                        "reversal_type": reversal_type,
                        "previous_ratio": prev_ratio,
                        "recent_ratio": recent_ratio,
                        "shift_magnitude": abs(prev_ratio - recent_ratio),
                        "recent_premium": recent_premium,
                        "interpretation": interpretation,
                    }
                )

        return sorted(reversals, key=lambda x: x["shift_magnitude"], reverse=True)

    def display_momentum_patterns(self, patterns: list[MomentumPattern]) -> None:
        """Display momentum patterns"""
        if not patterns:
            console.print("[yellow]No significant momentum patterns found.[/yellow]")
            return

        # Group by pattern type
        by_type = defaultdict(list)
        for pattern in patterns:
            by_type[pattern.pattern_type].append(pattern)

        for pattern_type, type_patterns in by_type.items():
            if not type_patterns:
                continue

            # Color code by pattern type
            type_colors = {
                "ACCELERATING": "bold green",
                "INCREASING": "green",
                "EXHAUSTING": "red",
                "DECREASING": "yellow",
                "SUSTAINED": "blue",
            }
            type_colors.get(pattern_type, "white")

            table = Table(title=f"📈 {pattern_type} Momentum", box=box.ROUNDED)
            table.add_column("Ticker", style="cyan")
            table.add_column("Momentum Change", justify="right")
            table.add_column("Days Active", justify="right")
            table.add_column("Premium Flow", justify="right")
            table.add_column("Confidence", justify="right")
            table.add_column("Interpretation", style="dim")

            for pattern in type_patterns[:10]:
                momentum_color = "green" if pattern.momentum_strength > 0 else "red"

                table.add_row(
                    pattern.ticker,
                    f"[{momentum_color}]{pattern.momentum_strength:+.0%}[/{momentum_color}]",
                    str(pattern.days_active),
                    f"${pattern.total_premium:,.0f}",
                    f"{pattern.confidence:.2f}",
                    pattern.interpretation,
                )

            console.print(table)
            console.print()

    def display_reversals(self, reversals: list[dict[str, Any]]) -> None:
        """Display directional reversals"""
        if not reversals:
            console.print("[yellow]No significant reversals found.[/yellow]")
            return

        table = Table(title="🔄 Directional Reversals", box=box.ROUNDED)
        table.add_column("Ticker", style="cyan")
        table.add_column("Reversal Type", style="magenta")
        table.add_column("Previous", justify="center")
        table.add_column("Recent", justify="center")
        table.add_column("Shift", justify="right")
        table.add_column("Premium", justify="right")
        table.add_column("Interpretation", style="yellow")

        for reversal in reversals[:15]:
            type_color = "green" if "BULLISH" in reversal["reversal_type"] else "red"

            table.add_row(
                reversal["ticker"],
                f"[{type_color}]{reversal['reversal_type'].replace('_', ' ')}[/{type_color}]",
                f"{reversal['previous_ratio']:.0%} calls",
                f"{reversal['recent_ratio']:.0%} calls",
                f"{reversal['shift_magnitude']:.0%}",
                f"${reversal['recent_premium']:,.0f}",
                reversal["interpretation"],
            )

        console.print(table)

    async def run_analysis(self, days: int = 7, min_grade: str = "C"):
        """Run the complete momentum analysis"""

        console.print(
            Panel.fit(
                "[bold blue]📈 Options Flow Momentum & Reversal Tracker[/bold blue]\n"
                f"Tracking momentum changes over {days} days",
                border_style="blue",
            )
        )

        # Fetch multi-day signals
        await self.fetch_multi_day_signals(days, min_grade)

        if len(self.signals_by_day) < 3:
            console.print(
                "[red]Need at least 3 days of data for momentum analysis.[/red]"
            )
            return

        # Calculate daily scores
        console.print("[blue]Calculating daily activity scores...[/blue]")
        ticker_daily_scores = self.calculate_daily_scores()

        # Identify patterns
        console.print("[blue]Identifying momentum patterns...[/blue]")
        momentum_patterns = self.identify_momentum_patterns(ticker_daily_scores)

        console.print("[blue]Identifying directional reversals...[/blue]")
        reversals = self.identify_reversals()

        # Display results
        console.print()
        self.display_momentum_patterns(momentum_patterns)

        if reversals:
            self.display_reversals(reversals)
            console.print()

        # Top opportunities
        accelerating = [
            p
            for p in momentum_patterns
            if p.pattern_type in ["ACCELERATING", "INCREASING"]
        ]
        exhausting = [
            p
            for p in momentum_patterns
            if p.pattern_type in ["EXHAUSTING", "DECREASING"]
        ]

        console.print(
            Panel.fit(
                f"[bold green]Analysis Complete[/bold green]\n"
                f"• {len(accelerating)} stocks with accelerating momentum\n"
                f"• {len(exhausting)} stocks showing exhaustion\n"
                f"• {len(reversals)} directional reversals identified\n"
                f"• {len([p for p in momentum_patterns if p.pattern_type == 'SUSTAINED'])} stocks with sustained activity",
                title="📊 Summary",
                border_style="green",
            )
        )


async def main():
    import argparse

    parser = argparse.ArgumentParser(
        description="Track momentum and reversal patterns in options flow"
    )
    parser.add_argument(
        "--days", type=int, default=7, help="Number of days to analyze (default: 7)"
    )
    parser.add_argument(
        "--min-grade", type=str, default="C", help="Minimum signal grade (default: C)"
    )

    args = parser.parse_args()

    tracker = MomentumTracker()
    await tracker.run_analysis(days=args.days, min_grade=args.min_grade)


if __name__ == "__main__":
    asyncio.run(main())
