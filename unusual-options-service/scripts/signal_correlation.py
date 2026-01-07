#!/usr/bin/env python3
"""
Signal Correlation and Clustering Analysis

This script helps identify:
1. Correlated unusual options activity across tickers
2. Sector-wide unusual activity patterns
3. Market regime changes based on options flow
4. Cross-asset correlation in unusual activity
5. Clustering of similar signals for diversification
"""

import os
import sys
import asyncio
import json
import math
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple, Set
from dataclasses import dataclass
from collections import defaultdict, Counter
import statistics

# Add the src directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from unusual_options.config import load_config
from unusual_options.storage.database import get_storage
from unusual_options.storage.models import UnusualOptionsSignal

# Rich for beautiful terminal output
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.progress import Progress, SpinnerColumn, TextColumn
from rich.text import Text
from rich import box

console = Console()


@dataclass
class CorrelationPair:
    """Correlation between two tickers"""

    ticker1: str
    ticker2: str
    correlation: float
    shared_signals: int
    total_signals: int
    correlation_type: str  # SECTOR, MARKET_CAP, VOLATILITY, etc.


@dataclass
class SignalCluster:
    """Cluster of similar signals"""

    cluster_id: int
    signals: List[UnusualOptionsSignal]
    center_characteristics: Dict[str, Any]
    cluster_type: str  # SECTOR, PREMIUM_FLOW, EXPIRY, etc.
    risk_level: str
    recommendation: str


class SignalCorrelationAnalyzer:
    def __init__(self):
        self.config = load_config()
        self.storage = get_storage(self.config)
        self.signals: List[UnusualOptionsSignal] = []

        # Sector mappings (simplified - in production use proper sector data)
        self.sector_map = {
            # Technology
            "AAPL": "Technology",
            "MSFT": "Technology",
            "GOOGL": "Technology",
            "GOOG": "Technology",
            "META": "Technology",
            "NVDA": "Technology",
            "AMD": "Technology",
            "CRM": "Technology",
            "ORCL": "Technology",
            "ADBE": "Technology",
            "INTC": "Technology",
            "CSCO": "Technology",
            # Financial
            "JPM": "Financial",
            "BAC": "Financial",
            "WFC": "Financial",
            "GS": "Financial",
            "MS": "Financial",
            "C": "Financial",
            "USB": "Financial",
            "PNC": "Financial",
            # Healthcare
            "JNJ": "Healthcare",
            "PFE": "Healthcare",
            "UNH": "Healthcare",
            "ABBV": "Healthcare",
            "MRK": "Healthcare",
            "TMO": "Healthcare",
            "ABT": "Healthcare",
            "DHR": "Healthcare",
            # Consumer
            "AMZN": "Consumer",
            "TSLA": "Consumer",
            "HD": "Consumer",
            "MCD": "Consumer",
            "NKE": "Consumer",
            "SBUX": "Consumer",
            "TGT": "Consumer",
            "WMT": "Consumer",
            # Energy
            "XOM": "Energy",
            "CVX": "Energy",
            "COP": "Energy",
            "EOG": "Energy",
            "SLB": "Energy",
            "PSX": "Energy",
            "VLO": "Energy",
            "MPC": "Energy",
        }

        # Market cap tiers (simplified)
        self.market_cap_tiers = {
            "AAPL": "Mega",
            "MSFT": "Mega",
            "GOOGL": "Mega",
            "AMZN": "Mega",
            "NVDA": "Mega",
            "META": "Mega",
            "TSLA": "Large",
            "JPM": "Large",
            "JNJ": "Large",
            "PG": "Large",
        }

    async def fetch_signals(self, days: int = 14, min_grade: str = "C") -> None:
        """Fetch signals for correlation analysis"""
        console.print(
            f"[blue]Fetching signals from last {days} days (grade {min_grade}+)...[/blue]"
        )

        end_date = datetime.now().date() + timedelta(days=1)
        start_date = end_date - timedelta(days=days + 1)

        self.signals = await self.storage.get_signals(
            min_grade=min_grade, start_date=start_date, end_date=end_date, limit=10000
        )

        console.print(f"[green]✓ Loaded {len(self.signals)} signals[/green]")

    def calculate_ticker_correlations(self) -> List[CorrelationPair]:
        """Calculate correlations between tickers based on signal patterns"""

        # Group signals by ticker and time windows
        ticker_signals = defaultdict(list)
        for signal in self.signals:
            ticker_signals[signal.ticker].append(signal)

        # Only analyze tickers with sufficient signals
        active_tickers = {
            ticker: signals
            for ticker, signals in ticker_signals.items()
            if len(signals) >= 3
        }

        correlations = []
        tickers = list(active_tickers.keys())

        for i, ticker1 in enumerate(tickers):
            for ticker2 in tickers[i + 1 :]:
                correlation = self._calculate_pair_correlation(
                    active_tickers[ticker1], active_tickers[ticker2], ticker1, ticker2
                )
                if correlation:
                    correlations.append(correlation)

        return sorted(correlations, key=lambda x: abs(x.correlation), reverse=True)

    def _calculate_pair_correlation(
        self,
        signals1: List[UnusualOptionsSignal],
        signals2: List[UnusualOptionsSignal],
        ticker1: str,
        ticker2: str,
    ) -> Optional[CorrelationPair]:
        """Calculate correlation between two tickers' signal patterns"""

        # Create time-based signal intensity vectors
        time_buckets = defaultdict(lambda: {"ticker1": 0, "ticker2": 0})

        # Bucket signals by hour
        for signal in signals1:
            bucket = signal.detection_timestamp.replace(
                minute=0, second=0, microsecond=0
            )
            time_buckets[bucket]["ticker1"] += signal.overall_score

        for signal in signals2:
            bucket = signal.detection_timestamp.replace(
                minute=0, second=0, microsecond=0
            )
            time_buckets[bucket]["ticker2"] += signal.overall_score

        if len(time_buckets) < 3:
            return None

        # Calculate correlation
        values1 = [bucket["ticker1"] for bucket in time_buckets.values()]
        values2 = [bucket["ticker2"] for bucket in time_buckets.values()]

        if (
            len(values1) < 3
            or all(v == 0 for v in values1)
            or all(v == 0 for v in values2)
        ):
            return None

        try:
            correlation = self._pearson_correlation(values1, values2)
        except:
            return None

        # Determine correlation type
        correlation_type = self._determine_correlation_type(ticker1, ticker2)

        # Count shared signal characteristics
        shared_signals = self._count_shared_characteristics(signals1, signals2)

        return CorrelationPair(
            ticker1=ticker1,
            ticker2=ticker2,
            correlation=correlation,
            shared_signals=shared_signals,
            total_signals=len(signals1) + len(signals2),
            correlation_type=correlation_type,
        )

    def _pearson_correlation(self, x: List[float], y: List[float]) -> float:
        """Calculate Pearson correlation coefficient"""
        n = len(x)
        if n < 2:
            return 0

        sum_x = sum(x)
        sum_y = sum(y)
        sum_x2 = sum(xi * xi for xi in x)
        sum_y2 = sum(yi * yi for yi in y)
        sum_xy = sum(xi * yi for xi, yi in zip(x, y))

        numerator = n * sum_xy - sum_x * sum_y
        denominator = math.sqrt(
            (n * sum_x2 - sum_x * sum_x) * (n * sum_y2 - sum_y * sum_y)
        )

        if denominator == 0:
            return 0

        return numerator / denominator

    def _determine_correlation_type(self, ticker1: str, ticker2: str) -> str:
        """Determine the type of correlation between two tickers"""
        sector1 = self.sector_map.get(ticker1, "Unknown")
        sector2 = self.sector_map.get(ticker2, "Unknown")

        if sector1 == sector2 and sector1 != "Unknown":
            return f"SECTOR_{sector1.upper()}"

        cap1 = self.market_cap_tiers.get(ticker1, "Unknown")
        cap2 = self.market_cap_tiers.get(ticker2, "Unknown")

        if cap1 == cap2 and cap1 != "Unknown":
            return f"MARKET_CAP_{cap1.upper()}"

        return "GENERAL_MARKET"

    def _count_shared_characteristics(
        self, signals1: List[UnusualOptionsSignal], signals2: List[UnusualOptionsSignal]
    ) -> int:
        """Count signals with shared characteristics"""
        shared = 0

        for s1 in signals1:
            for s2 in signals2:
                # Check if signals occurred within similar timeframe
                time_diff = abs(
                    (s1.detection_timestamp - s2.detection_timestamp).total_seconds()
                )
                if time_diff < 3600:  # Within 1 hour
                    # Check for shared characteristics
                    if (
                        s1.option_type == s2.option_type
                        and s1.sentiment == s2.sentiment
                        and abs(s1.overall_score - s2.overall_score) < 0.2
                    ):
                        shared += 1
                        break

        return shared

    def identify_signal_clusters(self) -> List[SignalCluster]:
        """Identify clusters of similar signals"""

        clusters = []

        # Cluster by sector
        sector_clusters = self._cluster_by_sector()
        clusters.extend(sector_clusters)

        # Cluster by premium flow size
        premium_clusters = self._cluster_by_premium_flow()
        clusters.extend(premium_clusters)

        # Cluster by expiry and moneyness
        expiry_clusters = self._cluster_by_expiry_moneyness()
        clusters.extend(expiry_clusters)

        return clusters

    def _cluster_by_sector(self) -> List[SignalCluster]:
        """Cluster signals by sector"""
        sector_signals = defaultdict(list)

        for signal in self.signals:
            sector = self.sector_map.get(signal.ticker, "Unknown")
            if sector != "Unknown":
                sector_signals[sector].append(signal)

        clusters = []
        cluster_id = 1

        for sector, signals in sector_signals.items():
            if len(signals) >= 5:  # Minimum cluster size
                # Calculate cluster characteristics
                avg_score = statistics.mean([s.overall_score for s in signals])
                avg_premium = statistics.mean(
                    [s.premium_flow for s in signals if s.premium_flow]
                )

                # Determine risk level
                risk_scores = [len(s.risk_factors) for s in signals]
                avg_risk = statistics.mean(risk_scores) if risk_scores else 0
                risk_level = (
                    "HIGH" if avg_risk > 2 else "MEDIUM" if avg_risk > 1 else "LOW"
                )

                # Generate recommendation
                if avg_score > 0.8 and len(signals) > 10:
                    recommendation = f"STRONG_SECTOR_SIGNAL: {sector} showing widespread unusual activity"
                elif avg_score > 0.6:
                    recommendation = f"MODERATE_SECTOR_SIGNAL: Monitor {sector} for trend continuation"
                else:
                    recommendation = (
                        f"WEAK_SECTOR_SIGNAL: {sector} activity may be noise"
                    )

                clusters.append(
                    SignalCluster(
                        cluster_id=cluster_id,
                        signals=signals,
                        center_characteristics={
                            "sector": sector,
                            "avg_score": avg_score,
                            "avg_premium": avg_premium,
                            "signal_count": len(signals),
                        },
                        cluster_type=f"SECTOR_{sector.upper()}",
                        risk_level=risk_level,
                        recommendation=recommendation,
                    )
                )
                cluster_id += 1

        return clusters

    def _cluster_by_premium_flow(self) -> List[SignalCluster]:
        """Cluster signals by premium flow size"""
        # Define premium flow tiers
        premium_signals = [
            s for s in self.signals if s.premium_flow and s.premium_flow > 0
        ]

        if not premium_signals:
            return []

        premium_flows = [s.premium_flow for s in premium_signals]
        premium_flows.sort()

        # Define thresholds
        large_threshold = premium_flows[int(0.9 * len(premium_flows))]  # Top 10%
        medium_threshold = premium_flows[int(0.7 * len(premium_flows))]  # Top 30%

        large_flow_signals = [
            s for s in premium_signals if s.premium_flow >= large_threshold
        ]
        medium_flow_signals = [
            s
            for s in premium_signals
            if medium_threshold <= s.premium_flow < large_threshold
        ]

        clusters = []
        cluster_id = 100  # Start at 100 to distinguish from sector clusters

        if len(large_flow_signals) >= 3:
            clusters.append(
                SignalCluster(
                    cluster_id=cluster_id,
                    signals=large_flow_signals,
                    center_characteristics={
                        "min_premium": large_threshold,
                        "avg_premium": statistics.mean(
                            [s.premium_flow for s in large_flow_signals]
                        ),
                        "signal_count": len(large_flow_signals),
                    },
                    cluster_type="LARGE_PREMIUM_FLOW",
                    risk_level="MEDIUM",
                    recommendation="INSTITUTIONAL_ACTIVITY: Large premium flows indicate institutional interest",
                )
            )
            cluster_id += 1

        if len(medium_flow_signals) >= 5:
            clusters.append(
                SignalCluster(
                    cluster_id=cluster_id,
                    signals=medium_flow_signals,
                    center_characteristics={
                        "min_premium": medium_threshold,
                        "avg_premium": statistics.mean(
                            [s.premium_flow for s in medium_flow_signals]
                        ),
                        "signal_count": len(medium_flow_signals),
                    },
                    cluster_type="MEDIUM_PREMIUM_FLOW",
                    risk_level="LOW",
                    recommendation="MODERATE_ACTIVITY: Medium premium flows suggest retail/small institutional activity",
                )
            )

        return clusters

    def _cluster_by_expiry_moneyness(self) -> List[SignalCluster]:
        """Cluster signals by expiry and moneyness patterns"""
        # Group by expiry buckets and moneyness
        expiry_moneyness_signals = defaultdict(list)

        for signal in self.signals:
            if signal.days_to_expiry:
                if signal.days_to_expiry <= 7:
                    expiry_bucket = "SHORT_TERM"
                elif signal.days_to_expiry <= 30:
                    expiry_bucket = "MEDIUM_TERM"
                else:
                    expiry_bucket = "LONG_TERM"

                key = f"{expiry_bucket}_{signal.moneyness}"
                expiry_moneyness_signals[key].append(signal)

        clusters = []
        cluster_id = 200

        for key, signals in expiry_moneyness_signals.items():
            if len(signals) >= 5:
                expiry_bucket, moneyness = key.split("_", 1)

                # Assess risk based on expiry and moneyness
                if expiry_bucket == "SHORT_TERM" and moneyness == "OTM":
                    risk_level = "HIGH"
                    recommendation = (
                        "HIGH_RISK: Short-term OTM options are highly speculative"
                    )
                elif expiry_bucket == "LONG_TERM" and moneyness == "ITM":
                    risk_level = "LOW"
                    recommendation = (
                        "CONSERVATIVE: Long-term ITM options offer lower risk"
                    )
                else:
                    risk_level = "MEDIUM"
                    recommendation = f"MODERATE: {expiry_bucket} {moneyness} options require careful analysis"

                clusters.append(
                    SignalCluster(
                        cluster_id=cluster_id,
                        signals=signals,
                        center_characteristics={
                            "expiry_bucket": expiry_bucket,
                            "moneyness": moneyness,
                            "avg_days_to_expiry": statistics.mean(
                                [s.days_to_expiry for s in signals if s.days_to_expiry]
                            ),
                            "signal_count": len(signals),
                        },
                        cluster_type=f"EXPIRY_{key}",
                        risk_level=risk_level,
                        recommendation=recommendation,
                    )
                )
                cluster_id += 1

        return clusters

    def analyze_market_regime(self) -> Dict[str, Any]:
        """Analyze current market regime based on options flow patterns"""

        # Calculate various regime indicators
        total_signals = len(self.signals)
        if total_signals == 0:
            return {"regime": "UNKNOWN", "confidence": 0}

        # Sentiment analysis
        bullish_signals = len([s for s in self.signals if s.sentiment == "BULLISH"])
        bearish_signals = len([s for s in self.signals if s.sentiment == "BEARISH"])

        sentiment_ratio = (
            bullish_signals / (bullish_signals + bearish_signals)
            if (bullish_signals + bearish_signals) > 0
            else 0.5
        )

        # Premium flow analysis
        total_premium = sum([s.premium_flow for s in self.signals if s.premium_flow])
        avg_premium = total_premium / total_signals if total_signals > 0 else 0

        # Volatility analysis (based on signal grades and risk factors)
        high_grade_signals = len([s for s in self.signals if s.grade in ["S", "A"]])
        high_grade_ratio = high_grade_signals / total_signals

        # Risk analysis
        high_risk_signals = len([s for s in self.signals if s.risk_level == "HIGH"])
        risk_ratio = high_risk_signals / total_signals

        # Determine regime
        if sentiment_ratio > 0.7 and high_grade_ratio > 0.3 and avg_premium > 1000000:
            regime = "STRONG_BULLISH"
            confidence = 0.8
        elif sentiment_ratio < 0.3 and risk_ratio > 0.4:
            regime = "BEARISH_DEFENSIVE"
            confidence = 0.7
        elif high_grade_ratio > 0.5 and avg_premium > 500000:
            regime = "INSTITUTIONAL_ACCUMULATION"
            confidence = 0.6
        elif risk_ratio > 0.6 or high_grade_ratio < 0.2:
            regime = "HIGH_UNCERTAINTY"
            confidence = 0.5
        else:
            regime = "NEUTRAL_MIXED"
            confidence = 0.4

        return {
            "regime": regime,
            "confidence": confidence,
            "sentiment_ratio": sentiment_ratio,
            "high_grade_ratio": high_grade_ratio,
            "avg_premium_flow": avg_premium,
            "risk_ratio": risk_ratio,
            "total_signals": total_signals,
        }

    def display_correlations(self, correlations: List[CorrelationPair]) -> None:
        """Display ticker correlations"""

        table = Table(title="🔗 Ticker Signal Correlations", box=box.ROUNDED)
        table.add_column("Ticker Pair", style="cyan")
        table.add_column("Correlation", justify="right")
        table.add_column("Type", style="magenta")
        table.add_column("Shared Signals", justify="right")
        table.add_column("Total Signals", justify="right")
        table.add_column("Strength", justify="center")

        for corr in correlations[:15]:  # Top 15 correlations
            # Color code correlation strength
            if abs(corr.correlation) > 0.7:
                strength = "[bold green]STRONG[/bold green]"
            elif abs(corr.correlation) > 0.5:
                strength = "[bold yellow]MODERATE[/bold yellow]"
            else:
                strength = "[dim]WEAK[/dim]"

            # Color code correlation value
            corr_color = "green" if corr.correlation > 0 else "red"

            table.add_row(
                f"{corr.ticker1} - {corr.ticker2}",
                f"[{corr_color}]{corr.correlation:.3f}[/{corr_color}]",
                corr.correlation_type.replace("_", " ").title(),
                str(corr.shared_signals),
                str(corr.total_signals),
                strength,
            )

        console.print(table)

    def display_clusters(self, clusters: List[SignalCluster]) -> None:
        """Display signal clusters"""

        # Group clusters by type
        cluster_types = defaultdict(list)
        for cluster in clusters:
            cluster_types[cluster.cluster_type.split("_")[0]].append(cluster)

        for cluster_type, type_clusters in cluster_types.items():
            table = Table(title=f"📊 {cluster_type.title()} Clusters", box=box.ROUNDED)
            table.add_column("Cluster", style="cyan")
            table.add_column("Signals", justify="right")
            table.add_column("Risk Level", justify="center")
            table.add_column("Key Metrics", style="dim")
            table.add_column("Recommendation", style="yellow")

            for cluster in sorted(
                type_clusters, key=lambda x: len(x.signals), reverse=True
            ):
                risk_color = {"LOW": "green", "MEDIUM": "yellow", "HIGH": "red"}[
                    cluster.risk_level
                ]

                # Format key metrics based on cluster type
                if cluster_type == "SECTOR":
                    metrics = (
                        f"Avg Score: {cluster.center_characteristics['avg_score']:.2f}"
                    )
                elif cluster_type == "LARGE" or cluster_type == "MEDIUM":
                    metrics = f"Avg Premium: ${cluster.center_characteristics['avg_premium']:,.0f}"
                else:
                    metrics = f"Avg DTE: {cluster.center_characteristics.get('avg_days_to_expiry', 0):.0f}"

                table.add_row(
                    cluster.cluster_type.replace("_", " ").title(),
                    str(len(cluster.signals)),
                    f"[{risk_color}]{cluster.risk_level}[/{risk_color}]",
                    metrics,
                    cluster.recommendation.split(":")[1].strip()
                    if ":" in cluster.recommendation
                    else cluster.recommendation,
                )

            console.print(table)
            console.print()

    def display_market_regime(self, regime_analysis: Dict[str, Any]) -> None:
        """Display market regime analysis"""

        regime = regime_analysis["regime"]
        confidence = regime_analysis["confidence"]

        # Color code regime
        regime_colors = {
            "STRONG_BULLISH": "bold green",
            "BEARISH_DEFENSIVE": "bold red",
            "INSTITUTIONAL_ACCUMULATION": "bold blue",
            "HIGH_UNCERTAINTY": "bold yellow",
            "NEUTRAL_MIXED": "dim",
        }

        regime_color = regime_colors.get(regime, "white")

        table = Table(title="📈 Market Regime Analysis", box=box.ROUNDED)
        table.add_column("Metric", style="cyan")
        table.add_column("Value", justify="right")
        table.add_column("Interpretation", style="dim")

        table.add_row(
            "Current Regime",
            f"[{regime_color}]{regime.replace('_', ' ')}[/{regime_color}]",
            "Based on options flow patterns",
        )
        table.add_row(
            "Confidence", f"{confidence:.1%}", "Reliability of regime identification"
        )
        table.add_row(
            "Sentiment Ratio",
            f"{regime_analysis['sentiment_ratio']:.1%}",
            "Bullish vs Bearish signals",
        )
        table.add_row(
            "High-Grade Ratio",
            f"{regime_analysis['high_grade_ratio']:.1%}",
            "Quality signal percentage",
        )
        table.add_row(
            "Avg Premium Flow",
            f"${regime_analysis['avg_premium_flow']:,.0f}",
            "Average institutional activity",
        )
        table.add_row(
            "Risk Ratio",
            f"{regime_analysis['risk_ratio']:.1%}",
            "High-risk signal percentage",
        )

        console.print(table)

        # Regime interpretation
        interpretations = {
            "STRONG_BULLISH": "Strong bullish sentiment with high institutional activity. Consider long positions.",
            "BEARISH_DEFENSIVE": "Defensive positioning with elevated risk. Consider hedging strategies.",
            "INSTITUTIONAL_ACCUMULATION": "Large players accumulating positions. Follow institutional flow.",
            "HIGH_UNCERTAINTY": "Mixed signals with elevated risk. Exercise caution and reduce position sizes.",
            "NEUTRAL_MIXED": "No clear directional bias. Wait for clearer signals or use neutral strategies.",
        }

        interpretation = interpretations.get(
            regime, "Regime unclear - monitor for pattern development."
        )

        console.print()
        console.print(
            Panel.fit(
                f"[bold]Market Regime: [{regime_color}]{regime.replace('_', ' ')}[/{regime_color}][/bold]\n"
                f"Confidence: {confidence:.1%}\n\n"
                f"{interpretation}",
                title="🎯 Trading Implications",
                border_style=regime_color.split()[1]
                if " " in regime_color
                else regime_color,
            )
        )

    async def run_analysis(self, days: int = 14, min_grade: str = "C"):
        """Run the complete correlation and clustering analysis"""

        console.print(
            Panel.fit(
                "[bold blue]🔗 Signal Correlation & Clustering Analysis[/bold blue]\n"
                f"Analyzing signal patterns and correlations over {days} days",
                border_style="blue",
            )
        )

        # Fetch signals
        await self.fetch_signals(days, min_grade)

        if len(self.signals) < 10:
            console.print("[red]Insufficient signals for correlation analysis.[/red]")
            return

        # Calculate correlations
        console.print("[blue]Calculating ticker correlations...[/blue]")
        correlations = self.calculate_ticker_correlations()

        # Identify clusters
        console.print("[blue]Identifying signal clusters...[/blue]")
        clusters = self.identify_signal_clusters()

        # Analyze market regime
        console.print("[blue]Analyzing market regime...[/blue]")
        regime_analysis = self.analyze_market_regime()

        # Display results
        console.print()
        if correlations:
            self.display_correlations(correlations)
            console.print()

        if clusters:
            self.display_clusters(clusters)

        self.display_market_regime(regime_analysis)

        # Summary
        console.print()
        console.print(
            Panel.fit(
                f"[bold green]Analysis Complete[/bold green]\n"
                f"• {len(correlations)} ticker correlations identified\n"
                f"• {len(clusters)} signal clusters found\n"
                f"• Market regime: {regime_analysis['regime'].replace('_', ' ')}\n"
                f"• {len([c for c in correlations if abs(c.correlation) > 0.5])} strong correlations detected",
                title="📊 Summary",
                border_style="green",
            )
        )


async def main():
    """Main function"""
    import argparse

    parser = argparse.ArgumentParser(
        description="Analyze signal correlations and clustering patterns"
    )
    parser.add_argument(
        "--days", type=int, default=14, help="Number of days to analyze (default: 14)"
    )
    parser.add_argument(
        "--min-grade", type=str, default="C", help="Minimum signal grade (default: C)"
    )

    args = parser.parse_args()

    analyzer = SignalCorrelationAnalyzer()
    await analyzer.run_analysis(days=args.days, min_grade=args.min_grade)


if __name__ == "__main__":
    asyncio.run(main())
