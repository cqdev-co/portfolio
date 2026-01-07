#!/usr/bin/env python3
"""
Unusual Options Signal Analysis Script

This script analyzes unusual options signals from the database to answer key questions:
1. What is the win rate of the signals?
2. What is the average return of the signals?
3. What is the average risk of the signals?
4. What is the average duration of the signals?
5. What is the average volume of the signals?
6. What is the average open interest of the signals?
7. What is the average premium flow of the signals?
8. What is the average aggressive order percentage of the signals?
9. What is the average volume ratio of the signals?
10. What is the average oi change percentage of the signals?
11. Why should I invest in these signals?
12. Which signals should I care about the most?
"""

import os
import sys
import asyncio
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
import statistics
from collections import defaultdict, Counter

# Add the src directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from unusual_options.config import load_config
from unusual_options.storage.database import get_storage
from unusual_options.storage.models import UnusualOptionsSignal

# Rich for beautiful terminal output
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.columns import Columns
from rich.progress import Progress, SpinnerColumn, TextColumn
from rich.text import Text
from rich.layout import Layout
from rich.align import Align
from rich import box

# OpenAI for intelligent analysis
import openai
from openai import OpenAI

console = Console()


class SignalAnalyzer:
    def __init__(self):
        self.config = load_config()
        self.storage = get_storage(self.config)
        self.signals: List[UnusualOptionsSignal] = []

        # Initialize OpenAI client if API key is available
        self.openai_client = None
        if self.config.get("OPENAI_API_KEY"):
            self.openai_client = OpenAI(api_key=self.config["OPENAI_API_KEY"])

    async def fetch_signals(
        self, days: int = 7, min_grade: str = "B"
    ) -> List[UnusualOptionsSignal]:
        """Fetch signals from the database"""
        console.print(
            f"[blue]Fetching signals from the last {days} days (grade {min_grade}+)...[/blue]"
        )

        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=console,
        ) as progress:
            task = progress.add_task("Loading signals...", total=None)

            try:
                # Calculate date range - include full days (same logic as CLI)
                end_date = datetime.now().date() + timedelta(days=1)  # Include today
                start_date = end_date - timedelta(
                    days=days + 1
                )  # Go back the specified days

                signals = await self.storage.get_signals(
                    min_grade=min_grade,
                    start_date=start_date,
                    end_date=end_date,
                    limit=10000,  # Large limit to get all signals
                )
                progress.update(task, description=f"Loaded {len(signals)} signals")
                return signals
            except Exception as e:
                console.print(f"[red]Error fetching signals: {e}[/red]")
                return []

    def calculate_basic_stats(self) -> Dict[str, Any]:
        """Calculate basic statistical metrics"""
        if not self.signals:
            return {}

        # Extract numerical values
        volumes = [s.current_volume for s in self.signals if s.current_volume]
        open_interests = [s.current_oi for s in self.signals if s.current_oi]
        premium_flows = [s.premium_flow for s in self.signals if s.premium_flow]
        scores = [s.overall_score for s in self.signals]

        # Calculate volume ratios and OI changes from signal attributes
        volume_ratios = [s.volume_ratio for s in self.signals if s.volume_ratio]
        oi_changes = [s.oi_change_pct for s in self.signals if s.oi_change_pct]
        aggressive_percentages = [
            s.aggressive_order_pct for s in self.signals if s.aggressive_order_pct
        ]

        return {
            "total_signals": len(self.signals),
            "avg_volume": statistics.mean(volumes) if volumes else 0,
            "median_volume": statistics.median(volumes) if volumes else 0,
            "avg_open_interest": statistics.mean(open_interests)
            if open_interests
            else 0,
            "median_open_interest": statistics.median(open_interests)
            if open_interests
            else 0,
            "avg_premium_flow": statistics.mean(premium_flows) if premium_flows else 0,
            "median_premium_flow": statistics.median(premium_flows)
            if premium_flows
            else 0,
            "total_premium_flow": sum(premium_flows) if premium_flows else 0,
            "avg_score": statistics.mean(scores) if scores else 0,
            "avg_volume_ratio": statistics.mean(volume_ratios) if volume_ratios else 0,
            "avg_oi_change": statistics.mean(oi_changes) if oi_changes else 0,
            "avg_aggressive_pct": statistics.mean(aggressive_percentages)
            if aggressive_percentages
            else 0,
        }

    def analyze_by_grade(self) -> Dict[str, Dict[str, Any]]:
        """Analyze signals grouped by grade"""
        grade_groups = defaultdict(list)
        for signal in self.signals:
            grade_groups[signal.grade].append(signal)

        grade_analysis = {}
        for grade, signals in grade_groups.items():
            volumes = [s.current_volume for s in signals if s.current_volume]
            premium_flows = [s.premium_flow for s in signals if s.premium_flow]
            scores = [s.overall_score for s in signals]

            grade_analysis[grade] = {
                "count": len(signals),
                "avg_volume": statistics.mean(volumes) if volumes else 0,
                "avg_premium_flow": statistics.mean(premium_flows)
                if premium_flows
                else 0,
                "total_premium_flow": sum(premium_flows) if premium_flows else 0,
                "avg_score": statistics.mean(scores) if scores else 0,
                "min_score": min(scores) if scores else 0,
                "max_score": max(scores) if scores else 0,
            }

        return grade_analysis

    def analyze_by_ticker(self, top_n: int = 20) -> Dict[str, Dict[str, Any]]:
        """Analyze signals grouped by ticker"""
        ticker_groups = defaultdict(list)
        for signal in self.signals:
            ticker_groups[signal.ticker].append(signal)

        ticker_analysis = {}
        for ticker, signals in ticker_groups.items():
            premium_flows = [s.premium_flow for s in signals if s.premium_flow]
            volumes = [s.current_volume for s in signals if s.current_volume]
            grades = [s.grade for s in signals]

            ticker_analysis[ticker] = {
                "count": len(signals),
                "total_premium_flow": sum(premium_flows) if premium_flows else 0,
                "avg_premium_flow": statistics.mean(premium_flows)
                if premium_flows
                else 0,
                "total_volume": sum(volumes) if volumes else 0,
                "avg_volume": statistics.mean(volumes) if volumes else 0,
                "grade_distribution": dict(Counter(grades)),
                "s_grade_count": grades.count("S"),
                "a_grade_count": grades.count("A"),
            }

        # Sort by total premium flow and return top N
        sorted_tickers = sorted(
            ticker_analysis.items(),
            key=lambda x: x[1]["total_premium_flow"],
            reverse=True,
        )

        return dict(sorted_tickers[:top_n])

    def analyze_risk_patterns(self) -> Dict[str, Any]:
        """Analyze risk patterns in the signals"""
        risk_levels = defaultdict(list)
        risk_factors = defaultdict(int)

        for signal in self.signals:
            risk_levels[signal.risk_level].append(signal)
            for factor in signal.risk_factors:
                risk_factors[factor] += 1

        return {
            "risk_distribution": {
                level: len(signals) for level, signals in risk_levels.items()
            },
            "common_risk_factors": dict(
                sorted(risk_factors.items(), key=lambda x: x[1], reverse=True)
            ),
            "total_risk_factors": sum(risk_factors.values()),
        }

    def get_top_signals(
        self, n: int = 10, criteria: str = "score"
    ) -> List[UnusualOptionsSignal]:
        """Get top N signals based on specified criteria"""
        if criteria == "score":
            return sorted(self.signals, key=lambda x: x.overall_score, reverse=True)[:n]
        elif criteria == "premium_flow":
            return sorted(
                self.signals, key=lambda x: x.premium_flow or 0, reverse=True
            )[:n]
        elif criteria == "volume":
            return sorted(
                self.signals, key=lambda x: x.current_volume or 0, reverse=True
            )[:n]
        else:
            return self.signals[:n]

    async def get_ai_insights(
        self,
        stats: Dict[str, Any],
        grade_analysis: Dict[str, Any],
        ticker_analysis: Dict[str, Any],
    ) -> Optional[str]:
        """Get AI-powered insights using OpenAI"""
        if not self.openai_client:
            return None

        try:
            # Prepare data summary for AI analysis
            data_summary = f"""
            Signal Analysis Summary:
            - Total Signals: {stats["total_signals"]}
            - Average Premium Flow: ${stats["avg_premium_flow"]:,.0f}
            - Total Premium Flow: ${stats["total_premium_flow"]:,.0f}
            - Average Volume: {stats["avg_volume"]:,.0f}
            - Average Score: {stats["avg_score"]:.3f}
            
            Grade Distribution:
            {grade_analysis}
            
            Top Tickers by Premium Flow:
            {dict(list(ticker_analysis.items())[:5])}
            """

            response = await asyncio.to_thread(
                self.openai_client.chat.completions.create,
                model="gpt-4",
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert options trader and quantitative analyst. Analyze the unusual options activity data and provide actionable insights.",
                    },
                    {
                        "role": "user",
                        "content": f"""
                        Analyze this unusual options activity data and answer these key questions:
                        
                        1. What patterns do you see in the data?
                        2. Which signals represent the most interesting opportunities?
                        3. What risk factors should traders be aware of?
                        4. What market sentiment does this activity suggest?
                        5. Which tickers deserve the most attention and why?
                        
                        Data:
                        {data_summary}
                        
                        Provide a concise but comprehensive analysis focusing on actionable insights for options traders.
                        """,
                    },
                ],
                max_tokens=1000,
                temperature=0.7,
            )

            return response.choices[0].message.content
        except Exception as e:
            console.print(f"[yellow]Warning: Could not get AI insights: {e}[/yellow]")
            return None

    def display_overview(self, stats: Dict[str, Any]):
        """Display overview statistics"""
        overview_table = Table(title="📊 Signal Overview", box=box.ROUNDED)
        overview_table.add_column("Metric", style="cyan", no_wrap=True)
        overview_table.add_column("Value", style="magenta")

        overview_table.add_row("Total Signals", f"{stats['total_signals']:,}")
        overview_table.add_row("Average Volume", f"{stats['avg_volume']:,.0f}")
        overview_table.add_row("Median Volume", f"{stats['median_volume']:,.0f}")
        overview_table.add_row(
            "Average Premium Flow", f"${stats['avg_premium_flow']:,.0f}"
        )
        overview_table.add_row(
            "Total Premium Flow", f"${stats['total_premium_flow']:,.0f}"
        )
        overview_table.add_row("Average Score", f"{stats['avg_score']:.3f}")
        overview_table.add_row(
            "Average Volume Ratio", f"{stats['avg_volume_ratio']:.1f}x"
        )
        overview_table.add_row("Average OI Change", f"{stats['avg_oi_change']:.1f}%")

        console.print(overview_table)

    def display_grade_analysis(self, grade_analysis: Dict[str, Any]):
        """Display grade-based analysis"""
        grade_table = Table(title="🎯 Analysis by Grade", box=box.ROUNDED)
        grade_table.add_column("Grade", style="bold")
        grade_table.add_column("Count", justify="right")
        grade_table.add_column("Avg Premium Flow", justify="right")
        grade_table.add_column("Total Premium Flow", justify="right")
        grade_table.add_column("Avg Score", justify="right")

        # Sort by grade (S, A, B, C, D, F)
        grade_order = ["S", "A", "B", "C", "D", "F"]
        for grade in grade_order:
            if grade in grade_analysis:
                data = grade_analysis[grade]
                grade_style = {
                    "S": "bold green",
                    "A": "bold blue",
                    "B": "bold yellow",
                    "C": "bold orange",
                    "D": "bold red",
                    "F": "dim red",
                }.get(grade, "white")

                grade_table.add_row(
                    f"[{grade_style}]{grade}[/{grade_style}]",
                    f"{data['count']:,}",
                    f"${data['avg_premium_flow']:,.0f}",
                    f"${data['total_premium_flow']:,.0f}",
                    f"{data['avg_score']:.3f}",
                )

        console.print(grade_table)

    def display_ticker_analysis(self, ticker_analysis: Dict[str, Any]):
        """Display top tickers analysis"""
        ticker_table = Table(title="🏆 Top Tickers by Premium Flow", box=box.ROUNDED)
        ticker_table.add_column("Ticker", style="bold cyan")
        ticker_table.add_column("Signals", justify="right")
        ticker_table.add_column("Total Premium", justify="right")
        ticker_table.add_column("S Grade", justify="right", style="green")
        ticker_table.add_column("A Grade", justify="right", style="blue")
        ticker_table.add_column("Avg Volume", justify="right")

        for ticker, data in ticker_analysis.items():
            ticker_table.add_row(
                ticker,
                f"{data['count']:,}",
                f"${data['total_premium_flow']:,.0f}",
                f"{data['s_grade_count']:,}",
                f"{data['a_grade_count']:,}",
                f"{data['avg_volume']:,.0f}",
            )

        console.print(ticker_table)

    def display_top_signals(self, signals: List[UnusualOptionsSignal], title: str):
        """Display top signals table"""
        signals_table = Table(title=title, box=box.ROUNDED)
        signals_table.add_column("Ticker", style="bold cyan")
        signals_table.add_column("Contract", style="white")
        signals_table.add_column("Grade", justify="center")
        signals_table.add_column("Score", justify="right")
        signals_table.add_column("Volume", justify="right")
        signals_table.add_column("Premium Flow", justify="right")
        signals_table.add_column("Expiry", justify="center")

        for signal in signals:
            grade_style = {
                "S": "bold green",
                "A": "bold blue",
                "B": "bold yellow",
                "C": "bold orange",
                "D": "bold red",
                "F": "dim red",
            }.get(signal.grade, "white")

            # Format expiry date
            expiry_str = signal.expiry.strftime("%m/%d") if signal.expiry else "N/A"

            signals_table.add_row(
                signal.ticker,
                signal.option_symbol,
                f"[{grade_style}]{signal.grade}[/{grade_style}]",
                f"{signal.overall_score:.3f}",
                f"{signal.current_volume:,}" if signal.current_volume else "N/A",
                f"${signal.premium_flow:,.0f}" if signal.premium_flow else "N/A",
                expiry_str,
            )

        console.print(signals_table)

    def display_risk_analysis(self, risk_analysis: Dict[str, Any]):
        """Display risk analysis"""
        risk_table = Table(title="⚠️ Risk Analysis", box=box.ROUNDED)
        risk_table.add_column("Risk Level", style="bold")
        risk_table.add_column("Count", justify="right")
        risk_table.add_column("Percentage", justify="right")

        total_signals = sum(risk_analysis["risk_distribution"].values())
        for level, count in risk_analysis["risk_distribution"].items():
            percentage = (count / total_signals * 100) if total_signals > 0 else 0
            level_style = {"LOW": "green", "MEDIUM": "yellow", "HIGH": "red"}.get(
                level, "white"
            )

            risk_table.add_row(
                f"[{level_style}]{level}[/{level_style}]",
                f"{count:,}",
                f"{percentage:.1f}%",
            )

        console.print(risk_table)

        # Display common risk factors
        if risk_analysis["common_risk_factors"]:
            factors_table = Table(title="🚨 Common Risk Factors", box=box.ROUNDED)
            factors_table.add_column("Risk Factor", style="yellow")
            factors_table.add_column("Occurrences", justify="right")

            for factor, count in list(risk_analysis["common_risk_factors"].items())[
                :10
            ]:
                factors_table.add_row(factor, f"{count:,}")

            console.print(factors_table)

    async def run_analysis(self, days: int = 7, min_grade: str = "B"):
        """Run the complete analysis"""
        console.print(
            Panel.fit(
                "[bold blue]🔍 Unusual Options Signal Analysis[/bold blue]\n"
                f"Analyzing signals from the last {days} days (grade {min_grade}+)",
                border_style="blue",
            )
        )

        # Fetch signals
        self.signals = await self.fetch_signals(days, min_grade)

        if not self.signals:
            console.print(
                "[red]No signals found. Please check your database connection and data.[/red]"
            )
            return

        console.print(
            f"[green]✓ Loaded {len(self.signals)} signals for analysis[/green]\n"
        )

        # Calculate statistics
        stats = self.calculate_basic_stats()
        grade_analysis = self.analyze_by_grade()
        ticker_analysis = self.analyze_by_ticker()
        risk_analysis = self.analyze_risk_patterns()

        # Display analysis
        self.display_overview(stats)
        console.print()

        self.display_grade_analysis(grade_analysis)
        console.print()

        self.display_ticker_analysis(ticker_analysis)
        console.print()

        # Display top signals by different criteria
        top_by_score = self.get_top_signals(10, "score")
        self.display_top_signals(top_by_score, "🌟 Top Signals by Score")
        console.print()

        top_by_premium = self.get_top_signals(10, "premium_flow")
        self.display_top_signals(top_by_premium, "💰 Top Signals by Premium Flow")
        console.print()

        self.display_risk_analysis(risk_analysis)
        console.print()

        # Get AI insights if available
        console.print("[blue]Getting AI insights...[/blue]")
        ai_insights = await self.get_ai_insights(stats, grade_analysis, ticker_analysis)

        if ai_insights:
            console.print(
                Panel(
                    ai_insights,
                    title="🤖 AI Analysis & Recommendations",
                    border_style="green",
                    padding=(1, 2),
                )
            )
        else:
            console.print(
                "[yellow]AI insights not available (OpenAI API key not configured)[/yellow]"
            )

        # Summary recommendations
        console.print(
            Panel.fit(
                self.generate_summary_recommendations(
                    stats, grade_analysis, ticker_analysis
                ),
                title="📋 Summary & Action Items",
                border_style="cyan",
            )
        )

    def generate_summary_recommendations(
        self,
        stats: Dict[str, Any],
        grade_analysis: Dict[str, Any],
        ticker_analysis: Dict[str, Any],
    ) -> str:
        """Generate summary recommendations"""
        recommendations = []

        # Signal quality assessment
        s_grade_count = grade_analysis.get("S", {}).get("count", 0)
        total_signals = stats["total_signals"]
        s_grade_pct = (s_grade_count / total_signals * 100) if total_signals > 0 else 0

        if s_grade_pct > 10:
            recommendations.append("🟢 High-quality signal environment detected")
        elif s_grade_pct > 5:
            recommendations.append("🟡 Moderate signal quality - be selective")
        else:
            recommendations.append("🔴 Low S-grade signal ratio - exercise caution")

        # Premium flow analysis
        avg_premium = stats["avg_premium_flow"]
        if avg_premium > 1000000:
            recommendations.append("💰 High institutional activity detected")
        elif avg_premium > 500000:
            recommendations.append("💵 Moderate institutional interest")

        # Top ticker recommendations
        top_3_tickers = list(ticker_analysis.keys())[:3]
        if top_3_tickers:
            recommendations.append(f"🎯 Focus on: {', '.join(top_3_tickers)}")

        # Volume analysis
        if stats["avg_volume"] > 10000:
            recommendations.append("📈 High volume environment - good liquidity")

        return "\n".join(recommendations)


async def main():
    """Main function"""
    import argparse

    parser = argparse.ArgumentParser(description="Analyze unusual options signals")
    parser.add_argument(
        "--days", type=int, default=7, help="Number of days to analyze (default: 7)"
    )
    parser.add_argument(
        "--min-grade",
        type=str,
        default="B",
        help="Minimum grade to analyze (default: B)",
    )

    args = parser.parse_args()

    analyzer = SignalAnalyzer()
    await analyzer.run_analysis(days=args.days, min_grade=args.min_grade)


if __name__ == "__main__":
    asyncio.run(main())
