#!/usr/bin/env python3
"""
Automated Signal Analysis for Best Trading Opportunities

Implements the 5-Filter System from trading-strategy-framework.md
Analyzes unusual options signals and ranks best plays automatically.

Usage:
    python analyze_best_plays.py signals.csv
    python analyze_best_plays.py --min-score 0.80 --min-premium 1000000 signals.csv
"""

import argparse
import csv
import sys
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Dict, List, Tuple


class SignalAnalyzer:
    """Analyzes unusual options signals using systematic filters."""

    def __init__(
        self,
        min_score: float = 0.75,
        min_confidence: float = 0.70,
        min_days_expiry: int = 10,
        min_premium: float = 500000,
        grades: List[str] = None,
    ):
        self.min_score = min_score
        self.min_confidence = min_confidence
        self.min_days_expiry = min_days_expiry
        self.min_premium = min_premium
        self.grades = grades or ["S", "A"]

    def load_signals(self, filepath: str) -> List[Dict]:
        """Load signals from CSV file."""
        with open(filepath, "r") as f:
            reader = csv.DictReader(f)
            return list(reader)

    def apply_quality_filter(self, signals: List[Dict]) -> List[Dict]:
        """Filter 1: Quality Score."""
        filtered = []
        for signal in signals:
            score = float(signal.get("overall_score", 0))
            confidence = float(signal.get("confidence", 0))
            grade = signal.get("grade", "")

            if (
                score >= self.min_score
                and confidence >= self.min_confidence
                and grade in self.grades
            ):
                filtered.append(signal)

        return filtered

    def apply_time_decay_filter(self, signals: List[Dict]) -> List[Dict]:
        """Filter 2: Time Decay Protection."""
        filtered = []
        for signal in signals:
            days = int(signal.get("days_to_expiry", 0))
            if days >= self.min_days_expiry:
                filtered.append(signal)

        return filtered

    def apply_premium_filter(self, signals: List[Dict]) -> List[Dict]:
        """Filter 3: Premium Flow Significance."""
        filtered = []
        for signal in signals:
            premium = float(signal.get("premium_flow", 0) or 0)
            volume_ratio = float(signal.get("volume_ratio", 0) or 0)

            if premium >= self.min_premium or volume_ratio >= 5.0:
                filtered.append(signal)

        return filtered

    def apply_moneyness_filter(self, signals: List[Dict]) -> List[Dict]:
        """Filter 4: Moneyness Sweet Spot."""
        filtered = []
        acceptable_moneyness = ["ITM", "ATM"]

        for signal in signals:
            moneyness = signal.get("moneyness", "")
            if moneyness in acceptable_moneyness:
                filtered.append(signal)

        return filtered

    def calculate_consistency_score(self, signals: List[Dict]) -> Dict[str, Dict]:
        """Calculate consistency metrics per ticker."""
        ticker_data = defaultdict(
            lambda: {
                "count": 0,
                "calls": 0,
                "puts": 0,
                "strikes": defaultdict(int),
                "total_premium": 0,
                "signals": [],
            }
        )

        for signal in signals:
            ticker = signal["ticker"]
            option_type = signal["option_type"]
            strike = float(signal["strike"])
            premium = float(signal.get("premium_flow", 0) or 0)

            ticker_data[ticker]["count"] += 1
            ticker_data[ticker]["total_premium"] += premium
            ticker_data[ticker]["signals"].append(signal)
            ticker_data[ticker]["strikes"][strike] += 1

            if option_type == "call":
                ticker_data[ticker]["calls"] += 1
            else:
                ticker_data[ticker]["puts"] += 1

        return dict(ticker_data)

    def apply_consistency_filter(
        self, signals: List[Dict]
    ) -> Tuple[List[Dict], Dict[str, int]]:
        """Filter 5: Ticker Consistency."""
        ticker_data = self.calculate_consistency_score(signals)

        # Calculate consistency scores
        consistency_scores = {}
        for ticker, data in ticker_data.items():
            score = 0

            # Points for multiple signals
            if data["count"] >= 3:
                score += 3
            elif data["count"] >= 2:
                score += 2

            # Points for directional consistency
            bias = abs(data["calls"] - data["puts"]) / data["count"]
            if bias > 0.7:  # 70% one direction
                score += 2

            # Points for repeated strikes
            max_strike_count = max(data["strikes"].values())
            if max_strike_count >= 2:
                score += 2

            # Points for large premium flow
            if data["total_premium"] > 5_000_000:
                score += 2
            elif data["total_premium"] > 2_000_000:
                score += 1

            consistency_scores[ticker] = score

        # Keep tickers with score >= 3
        high_consistency_tickers = {
            t: s for t, s in consistency_scores.items() if s >= 3
        }

        filtered = [s for s in signals if s["ticker"] in high_consistency_tickers]

        return filtered, consistency_scores

    def rank_signals(self, signals: List[Dict]) -> List[Tuple[Dict, float]]:
        """Rank signals by composite score."""
        ranked = []

        for signal in signals:
            rank_score = 0.0

            # Base score
            rank_score += float(signal.get("overall_score", 0)) * 40

            # Confidence boost
            rank_score += float(signal.get("confidence", 0)) * 20

            # Premium flow boost
            premium = float(signal.get("premium_flow", 0) or 0)
            if premium > 5_000_000:
                rank_score += 20
            elif premium > 1_000_000:
                rank_score += 10
            elif premium > 500_000:
                rank_score += 5

            # Grade boost
            grade = signal.get("grade", "")
            if grade == "S":
                rank_score += 10
            elif grade == "A":
                rank_score += 5

            # Moneyness boost
            if signal.get("moneyness") == "ITM":
                rank_score += 10
            elif signal.get("moneyness") == "ATM":
                rank_score += 5

            ranked.append((signal, rank_score))

        # Sort by rank score descending
        ranked.sort(key=lambda x: x[1], reverse=True)

        return ranked

    def analyze(self, filepath: str) -> Dict:
        """Run full analysis pipeline."""
        print("=" * 80)
        print("UNUSUAL OPTIONS SIGNAL ANALYSIS - 5-FILTER SYSTEM")
        print("=" * 80)

        # Load signals
        signals = self.load_signals(filepath)
        print(f"\n📥 Loaded {len(signals)} total signals")

        # Filter 1: Quality
        signals = self.apply_quality_filter(signals)
        print(
            f"✅ Filter 1 (Quality): {len(signals)} signals "
            f"(Score ≥{self.min_score}, Conf ≥{self.min_confidence}, "
            f"Grade in {self.grades})"
        )

        # Filter 2: Time Decay
        signals = self.apply_time_decay_filter(signals)
        print(
            f"✅ Filter 2 (Time Decay): {len(signals)} signals "
            f"(≥{self.min_days_expiry} days to expiry)"
        )

        # Filter 3: Premium Flow
        signals = self.apply_premium_filter(signals)
        print(
            f"✅ Filter 3 (Premium Flow): {len(signals)} signals "
            f"(≥${self.min_premium:,.0f} or 5x volume)"
        )

        # Filter 4: Moneyness
        signals = self.apply_moneyness_filter(signals)
        print(f"✅ Filter 4 (Moneyness): {len(signals)} signals (ITM or ATM only)")

        # Filter 5: Consistency
        signals, consistency_scores = self.apply_consistency_filter(signals)
        print(
            f"✅ Filter 5 (Consistency): {len(signals)} signals (≥3 consistency score)"
        )

        # Rank signals
        ranked_signals = self.rank_signals(signals)

        return {
            "signals": ranked_signals,
            "consistency_scores": consistency_scores,
            "total_filtered": len(signals),
        }


def print_top_plays(results: Dict, top_n: int = 10):
    """Print top N plays in formatted output."""
    signals = results["signals"][:top_n]
    consistency = results["consistency_scores"]

    print(f"\n🎯 TOP {top_n} BEST PLAYS")
    print("=" * 80)

    for i, (signal, rank_score) in enumerate(signals, 1):
        ticker = signal["ticker"]
        strike = float(signal["strike"])
        option_type = signal["option_type"].upper()
        expiry = signal["expiry"][:10]
        score = float(signal["overall_score"])
        confidence = float(signal["confidence"])
        premium = float(signal.get("premium_flow", 0) or 0)
        underlying = float(signal.get("underlying_price", 0) or 0)
        moneyness = signal.get("moneyness", "")
        grade = signal.get("grade", "")
        consistency_score = consistency.get(ticker, 0)

        print(f"\n{i}. {ticker} ${strike} {option_type} exp {expiry}")
        print(
            f"   Rank: {rank_score:.1f} | Score: {score:.2f} | "
            f"Grade: {grade} | Conf: {confidence:.2f}"
        )
        print(
            f"   Premium: ${premium:,.0f} | Underlying: ${underlying:.2f} | {moneyness}"
        )
        print(f"   Consistency: {consistency_score}/10 signals on {ticker}")

        # Calculate distance to strike
        if underlying > 0:
            distance = ((strike - underlying) / underlying) * 100
            if option_type == "CALL":
                if distance < 0:
                    print(
                        f"   💚 Already ITM by ${abs(strike - underlying):.2f} "
                        f"({abs(distance):.1f}%)"
                    )
                else:
                    print(f"   📈 Needs {distance:.1f}% move to ${strike}")
            else:  # PUT
                if distance > 0:
                    print(
                        f"   💚 Already ITM by ${abs(strike - underlying):.2f} "
                        f"({abs(distance):.1f}%)"
                    )
                else:
                    print(f"   📉 Needs {abs(distance):.1f}% move to ${strike}")


def print_ticker_summary(results: Dict):
    """Print summary by ticker."""
    consistency = results["consistency_scores"]
    signals = results["signals"]

    # Group by ticker
    ticker_groups = defaultdict(list)
    for signal, rank in signals:
        ticker_groups[signal["ticker"]].append((signal, rank))

    print(f"\n📊 TICKER SUMMARY (Sorted by Consistency)")
    print("=" * 80)

    # Sort by consistency score
    sorted_tickers = sorted(consistency.items(), key=lambda x: x[1], reverse=True)

    for ticker, cons_score in sorted_tickers[:15]:
        if ticker not in ticker_groups:
            continue

        signals_list = ticker_groups[ticker]
        calls = sum(1 for s, _ in signals_list if s["option_type"] == "call")
        puts = len(signals_list) - calls
        total_premium = sum(
            float(s.get("premium_flow", 0) or 0) for s, _ in signals_list
        )

        direction = (
            "📈 BULLISH"
            if calls > puts
            else "📉 BEARISH"
            if puts > calls
            else "⚖️  MIXED"
        )

        print(f"\n{ticker} - Consistency: {cons_score}/10")
        print(
            f"  {direction} | Signals: {len(signals_list)} "
            f"({calls}C / {puts}P) | Premium: ${total_premium:,.0f}"
        )

        # Show top 2 strikes
        for signal, rank in signals_list[:2]:
            strike = float(signal["strike"])
            exp = signal["expiry"][:10]
            opt_type = signal["option_type"].upper()
            score = float(signal["overall_score"])
            print(f"    → ${strike} {opt_type} exp {exp} (Score: {score:.2f})")


def print_strategy_recommendations(results: Dict):
    """Print strategic recommendations."""
    print("\n💡 STRATEGY RECOMMENDATIONS")
    print("=" * 80)

    signals = results["signals"]
    consistency = results["consistency_scores"]

    # Categorize into tiers
    tier1 = [s for s, r in signals if r >= 80]
    tier2 = [s for s, r in signals if 65 <= r < 80]
    tier3 = [s for s, r in signals if 50 <= r < 65]

    print(f"\n🏆 TIER 1 - Core Holdings ({len(tier1)} plays)")
    print("   Position Size: 3-5% each | Expected Win Rate: 60%")
    for signal in tier1[:3]:
        ticker = signal["ticker"]
        strike = float(signal["strike"])
        opt = signal["option_type"].upper()
        exp = signal["expiry"][:10]
        print(f"   • {ticker} ${strike} {opt} exp {exp}")

    print(f"\n🎯 TIER 2 - Opportunistic ({len(tier2)} plays)")
    print("   Position Size: 2-3% each | Expected Win Rate: 45-50%")
    for signal in tier2[:3]:
        ticker = signal["ticker"]
        strike = float(signal["strike"])
        opt = signal["option_type"].upper()
        exp = signal["expiry"][:10]
        print(f"   • {ticker} ${strike} {opt} exp {exp}")

    print(f"\n🎲 TIER 3 - Speculative ({len(tier3)} plays)")
    print("   Position Size: 0.5-1% each | Expected Win Rate: 30-35%")
    for signal in tier3[:3]:
        ticker = signal["ticker"]
        strike = float(signal["strike"])
        opt = signal["option_type"].upper()
        exp = signal["expiry"][:10]
        print(f"   • {ticker} ${strike} {opt} exp {exp}")

    # Sector plays
    print("\n🔬 SECTOR OPPORTUNITIES")
    ticker_groups = defaultdict(int)
    for signal, _ in signals:
        ticker_groups[signal["ticker"]] += 1

    # Identify sectors (simplified - in reality would use sector mapping)
    tech_tickers = [
        "AAPL",
        "GOOGL",
        "GOOG",
        "MSFT",
        "AMD",
        "NVDA",
        "TSM",
        "AVGO",
        "QCOM",
        "INTC",
    ]
    semi_tickers = ["AMD", "NVDA", "TSM", "AVGO", "QCOM", "INTC"]
    crypto_tickers = ["COIN", "MARA", "RIOT", "HUT", "CLSK"]

    tech_count = sum(ticker_groups[t] for t in tech_tickers if t in ticker_groups)
    semi_count = sum(ticker_groups[t] for t in semi_tickers if t in ticker_groups)
    crypto_count = sum(ticker_groups[t] for t in crypto_tickers if t in ticker_groups)

    if semi_count >= 5:
        print(f"   🔥 SEMICONDUCTORS: {semi_count} signals - Consider sector basket")
    if crypto_count >= 3:
        print(f"   ₿  CRYPTO: {crypto_count} signals - Watch Bitcoin correlation")
    if tech_count >= 10:
        print(f"   💻 TECH SECTOR: {tech_count} signals - Broad tech strength")


def main():
    parser = argparse.ArgumentParser(
        description="Analyze unusual options signals for best plays",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )

    parser.add_argument("csv_file", help="Path to signals CSV file")
    parser.add_argument(
        "--min-score",
        type=float,
        default=0.75,
        help="Minimum overall score (default: 0.75)",
    )
    parser.add_argument(
        "--min-confidence",
        type=float,
        default=0.70,
        help="Minimum confidence (default: 0.70)",
    )
    parser.add_argument(
        "--min-days", type=int, default=10, help="Minimum days to expiry (default: 10)"
    )
    parser.add_argument(
        "--min-premium",
        type=float,
        default=500000,
        help="Minimum premium flow (default: 500000)",
    )
    parser.add_argument(
        "--grades",
        nargs="+",
        default=["S", "A"],
        help="Acceptable grades (default: S A)",
    )
    parser.add_argument(
        "--top-n",
        type=int,
        default=10,
        help="Number of top plays to show (default: 10)",
    )

    args = parser.parse_args()

    # Initialize analyzer
    analyzer = SignalAnalyzer(
        min_score=args.min_score,
        min_confidence=args.min_confidence,
        min_days_expiry=args.min_days,
        min_premium=args.min_premium,
        grades=args.grades,
    )

    try:
        # Run analysis
        results = analyzer.analyze(args.csv_file)

        if results["total_filtered"] == 0:
            print("\n❌ No signals passed all filters. Try loosening criteria.")
            return 1

        # Print results
        print_top_plays(results, args.top_n)
        print_ticker_summary(results)
        print_strategy_recommendations(results)

        print("\n" + "=" * 80)
        print("✅ Analysis Complete - Ready to Trade!")
        print("=" * 80)
        print("\nNext Steps:")
        print("1. Review top plays and validate with checklist")
        print("2. Check technical charts for confirmation")
        print(
            "3. Size positions according to tier (Tier 1: 3-5%, "
            "Tier 2: 2-3%, Tier 3: 0.5-1%)"
        )
        print("4. Set stop losses at -20% to -25%")
        print("5. Take profits at 50% (half position), 100% (quarter), trail remainder")
        print("\n⚠️  Remember: These are signals, not guarantees. Trade responsibly!")

        return 0

    except FileNotFoundError:
        print(f"\n❌ Error: File '{args.csv_file}' not found")
        return 1
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        import traceback

        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
