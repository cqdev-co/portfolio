#!/usr/bin/env python3
"""
Hedge Activity Analyzer

Analyzes unusual options signals to identify potential hedging activity
vs. directional bets. Helps filter out false positives from:
- Protective puts
- Collars
- Covered calls
- Index hedges
- Sector hedges

Usage:
    poetry run python scripts/hedge_analyzer.py --days 7 --min-grade A
    poetry run python scripts/hedge_analyzer.py --days 30 --show-hedges-only
    poetry run python scripts/hedge_analyzer.py --days 7 --exclude-hedges
"""

import os
import sys
import asyncio
from datetime import datetime, timedelta, date
from typing import List, Dict, Any, Optional, Tuple, Set
from dataclasses import dataclass, field
from collections import defaultdict
import statistics

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from unusual_options.config import load_config
from unusual_options.storage.database import get_storage
from unusual_options.storage.models import UnusualOptionsSignal

from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich import box

console = Console()

# Known hedge targets
MEGA_CAPS = {
    'AAPL', 'MSFT', 'GOOGL', 'GOOG', 'AMZN', 'NVDA', 'META', 'TSLA',
    'BRK.B', 'UNH', 'JNJ', 'XOM', 'V', 'PG', 'JPM', 'MA', 'HD', 'CVX',
    'LLY', 'ABBV', 'MRK', 'KO', 'AVGO', 'PEP', 'COST', 'WMT', 'CSCO',
    'AMD', 'NFLX', 'ADBE', 'CRM', 'TMO', 'DIS', 'ABT', 'NKE', 'INTC'
}

INDEX_ETFS = {'SPY', 'QQQ', 'IWM', 'DIA', 'VXX', 'UVXY', 'SQQQ', 'TQQQ'}

SECTOR_ETFS = {
    'XLF', 'XLE', 'XLK', 'XLV', 'XLI', 'XLP', 'XLU', 'XLY', 'XLB', 
    'XLRE', 'XLC', 'GDX', 'XBI', 'SMH', 'XOP', 'KRE', 'XHB'
}


@dataclass
class HedgeAnalysis:
    """Result of hedge analysis for a signal."""
    signal: UnusualOptionsSignal
    is_likely_hedge: bool
    hedge_confidence: float
    hedge_type: Optional[str]
    hedge_indicators: List[str]
    reasoning: str
    
    # Correlation data
    correlated_signals: List[UnusualOptionsSignal] = field(
        default_factory=list
    )
    correlation_type: Optional[str] = None


class HedgeAnalyzer:
    """Analyzes options signals for hedging patterns."""
    
    def __init__(self):
        self.config = load_config()
        self.storage = get_storage(self.config)
        self.signals: List[UnusualOptionsSignal] = []
        self.analyses: Dict[str, HedgeAnalysis] = {}
    
    async def fetch_signals(
        self, 
        days: int = 7, 
        min_grade: str = 'A'
    ) -> None:
        """Fetch recent signals from database."""
        console.print(
            f"[blue]Fetching signals "
            f"(last {days} days, grade {min_grade}+)...[/blue]"
        )
        
        end_date = datetime.now().date() + timedelta(days=1)
        start_date = end_date - timedelta(days=days + 1)
        
        self.signals = await self.storage.get_signals(
            min_grade=min_grade,
            start_date=start_date,
            end_date=end_date,
            limit=10000
        )
        
        console.print(f"[green]✓ Loaded {len(self.signals)} signals[/green]")
    
    def _is_protective_put(
        self, 
        signal: UnusualOptionsSignal
    ) -> Tuple[bool, float, List[str], str]:
        """
        Detect protective put pattern.
        
        Pattern: Long stock + Buy OTM puts for downside protection
        """
        indicators = []
        
        if signal.option_type != 'put':
            return False, 0.0, [], ""
        
        # OTM put (5-20% below current price)
        if signal.moneyness == 'OTM' and signal.underlying_price > 0:
            otm_pct = (
                (signal.underlying_price - signal.strike) / 
                signal.underlying_price
            )
            if 0.05 <= otm_pct <= 0.25:
                indicators.append(f"OTM_PUT_{otm_pct*100:.0f}%_BELOW")
        
        # Medium-dated (30-120 DTE) - typical for hedging
        if signal.days_to_expiry and 30 <= signal.days_to_expiry <= 180:
            indicators.append(f"HEDGE_DTE_{signal.days_to_expiry}d")
        
        # Large premium (institutional size)
        if signal.premium_flow and signal.premium_flow >= 1_000_000:
            indicators.append(
                f"INSTITUTIONAL_SIZE_${signal.premium_flow/1_000_000:.1f}M"
            )
        
        # Mega-cap or index (common hedge targets)
        if signal.ticker in MEGA_CAPS:
            indicators.append("MEGA_CAP_HEDGE_TARGET")
        elif signal.ticker in INDEX_ETFS:
            indicators.append("INDEX_ETF_HEDGE")
        elif signal.ticker in SECTOR_ETFS:
            indicators.append("SECTOR_ETF_HEDGE")
        
        # Low aggression suggests patient execution (hedging, not panic)
        if (signal.aggressive_order_pct and 
            signal.aggressive_order_pct < 0.50):
            indicators.append("PATIENT_EXECUTION")
        
        confidence = min(len(indicators) / 4.0, 1.0)
        is_hedge = len(indicators) >= 3
        
        reasoning = (
            f"Protective put pattern: {len(indicators)} indicators matched. "
            f"OTM put on {signal.ticker} with "
            f"{signal.days_to_expiry}d DTE."
        ) if is_hedge else ""
        
        return is_hedge, confidence, indicators, reasoning
    
    def _is_index_hedge(
        self, 
        signal: UnusualOptionsSignal
    ) -> Tuple[bool, float, List[str], str]:
        """
        Detect index-level hedging.
        
        Pattern: Large OTM puts on SPY/QQQ/IWM for portfolio protection
        """
        indicators = []
        
        if signal.ticker not in INDEX_ETFS:
            return False, 0.0, [], ""
        
        # Put option on index
        if signal.option_type == 'put':
            indicators.append("INDEX_PUT")
        else:
            return False, 0.0, [], ""  # Call on index = not typical hedge
        
        # Far-dated (60+ DTE) - disaster protection
        if signal.days_to_expiry and signal.days_to_expiry >= 45:
            indicators.append(f"FAR_DATED_{signal.days_to_expiry}d")
        
        # Large size
        if signal.premium_flow and signal.premium_flow >= 2_000_000:
            indicators.append(
                f"LARGE_PREMIUM_${signal.premium_flow/1_000_000:.1f}M"
            )
        
        # OTM (disaster protection)
        if signal.moneyness == 'OTM':
            indicators.append("OTM_PROTECTION")
        
        confidence = min(len(indicators) / 4.0, 1.0)
        is_hedge = len(indicators) >= 3
        
        reasoning = (
            f"Index hedge pattern: {signal.ticker} put with "
            f"{signal.days_to_expiry}d DTE, "
            f"${signal.premium_flow/1_000_000:.1f}M premium."
        ) if is_hedge else ""
        
        return is_hedge, confidence, indicators, reasoning
    
    def _is_sector_hedge(
        self, 
        signal: UnusualOptionsSignal
    ) -> Tuple[bool, float, List[str], str]:
        """
        Detect sector-level hedging.
        
        Pattern: OTM puts on sector ETFs (XLF, XLE, XLK, etc.)
        """
        indicators = []
        
        if signal.ticker not in SECTOR_ETFS:
            return False, 0.0, [], ""
        
        # Put option on sector ETF
        if signal.option_type == 'put':
            indicators.append("SECTOR_ETF_PUT")
        else:
            return False, 0.0, [], ""
        
        # Medium to far-dated
        if signal.days_to_expiry and signal.days_to_expiry >= 30:
            indicators.append(f"DTE_{signal.days_to_expiry}d")
        
        # Significant premium
        if signal.premium_flow and signal.premium_flow >= 500_000:
            indicators.append(
                f"PREMIUM_${signal.premium_flow/1_000_000:.1f}M"
            )
        
        # OTM
        if signal.moneyness == 'OTM':
            indicators.append("OTM")
        
        confidence = min(len(indicators) / 4.0, 1.0)
        is_hedge = len(indicators) >= 3
        
        reasoning = (
            f"Sector hedge: {signal.ticker} put, "
            f"{signal.days_to_expiry}d DTE."
        ) if is_hedge else ""
        
        return is_hedge, confidence, indicators, reasoning
    
    def _is_far_dated_mega_cap(
        self, 
        signal: UnusualOptionsSignal
    ) -> Tuple[bool, float, List[str], str]:
        """
        Detect far-dated positions in mega-caps.
        
        Pattern: Long-dated options on AAPL/MSFT/etc. = likely hedging
        """
        indicators = []
        
        if signal.ticker not in MEGA_CAPS:
            return False, 0.0, [], ""
        
        # Very far-dated (90+ DTE)
        if signal.days_to_expiry and signal.days_to_expiry >= 90:
            indicators.append(f"LEAPS_RANGE_{signal.days_to_expiry}d")
        else:
            return False, 0.0, [], ""
        
        # Put = definitely hedging pattern
        if signal.option_type == 'put':
            indicators.append("MEGA_CAP_PUT")
            indicators.append("LIKELY_PORTFOLIO_PROTECTION")
        
        # Large institutional size
        if signal.premium_flow and signal.premium_flow >= 2_000_000:
            indicators.append(
                f"INSTITUTIONAL_${signal.premium_flow/1_000_000:.1f}M"
            )
        
        confidence = min(len(indicators) / 3.0, 1.0)
        is_hedge = len(indicators) >= 2 and signal.option_type == 'put'
        
        reasoning = (
            f"Far-dated mega-cap hedge: {signal.ticker} put, "
            f"{signal.days_to_expiry}d DTE."
        ) if is_hedge else ""
        
        return is_hedge, confidence, indicators, reasoning
    
    def _detect_paired_activity(
        self
    ) -> Dict[str, List[UnusualOptionsSignal]]:
        """
        Detect paired call/put activity on same ticker.
        
        Pattern: Both calls AND puts on same ticker in same time window
        suggests hedging/neutral positioning.
        """
        # Group by ticker and date
        ticker_day_groups = defaultdict(list)
        for signal in self.signals:
            key = (
                signal.ticker, 
                signal.detection_timestamp.date()
            )
            ticker_day_groups[key].append(signal)
        
        # Find tickers with both calls and puts same day
        paired = {}
        for key, signals in ticker_day_groups.items():
            calls = [s for s in signals if s.option_type == 'call']
            puts = [s for s in signals if s.option_type == 'put']
            
            if calls and puts:
                paired[key[0]] = signals
        
        return paired
    
    def _detect_collar_patterns(
        self
    ) -> List[Tuple[UnusualOptionsSignal, UnusualOptionsSignal, float]]:
        """
        Detect potential collar patterns (call sell + put buy).
        
        Returns list of (call_signal, put_signal, confidence) tuples.
        """
        collars = []
        
        # Group by ticker
        by_ticker = defaultdict(list)
        for signal in self.signals:
            by_ticker[signal.ticker].append(signal)
        
        for ticker, signals in by_ticker.items():
            calls = [s for s in signals if s.option_type == 'call']
            puts = [s for s in signals if s.option_type == 'put']
            
            for call in calls:
                for put in puts:
                    confidence = self._collar_confidence(call, put)
                    if confidence >= 0.6:
                        collars.append((call, put, confidence))
        
        return collars
    
    def _collar_confidence(
        self, 
        call: UnusualOptionsSignal, 
        put: UnusualOptionsSignal
    ) -> float:
        """Calculate confidence that call/put pair is a collar."""
        indicators = 0
        
        # Same expiry
        if call.expiry == put.expiry:
            indicators += 1
        
        # Call strike > Put strike (typical collar structure)
        if call.strike > put.strike:
            indicators += 1
        
        # Both bracket current price
        if (put.strike < call.underlying_price < call.strike):
            indicators += 1
        
        # Similar premium (often zero-cost collar)
        if call.premium_flow and put.premium_flow:
            ratio = call.premium_flow / put.premium_flow
            if 0.5 <= ratio <= 2.0:
                indicators += 1
        
        # Close detection time (< 30 minutes)
        time_diff = abs(
            (call.detection_timestamp - 
             put.detection_timestamp).total_seconds()
        )
        if time_diff < 1800:
            indicators += 1
        
        return indicators / 5.0
    
    def analyze_all_signals(self) -> None:
        """Run hedge analysis on all signals."""
        console.print("[blue]Running hedge analysis...[/blue]\n")
        
        for signal in self.signals:
            analysis = self._analyze_single_signal(signal)
            self.analyses[signal.signal_id] = analysis
        
        # Detect paired activity
        paired = self._detect_paired_activity()
        if paired:
            console.print(
                f"[dim]Found {len(paired)} tickers with "
                f"paired call/put activity[/dim]"
            )
            
            # Mark paired signals
            for ticker, signals in paired.items():
                for signal in signals:
                    if signal.signal_id in self.analyses:
                        analysis = self.analyses[signal.signal_id]
                        if not analysis.is_likely_hedge:
                            analysis.hedge_indicators.append(
                                "PAIRED_CALL_PUT_ACTIVITY"
                            )
                            analysis.hedge_confidence = max(
                                analysis.hedge_confidence, 0.5
                            )
        
        # Detect collars
        collars = self._detect_collar_patterns()
        if collars:
            console.print(
                f"[dim]Found {len(collars)} potential collar patterns[/dim]"
            )
            
            for call, put, conf in collars:
                for signal in [call, put]:
                    if signal.signal_id in self.analyses:
                        analysis = self.analyses[signal.signal_id]
                        analysis.is_likely_hedge = True
                        analysis.hedge_type = "COLLAR"
                        analysis.hedge_confidence = max(
                            analysis.hedge_confidence, conf
                        )
                        analysis.hedge_indicators.append(
                            f"COLLAR_PATTERN_{conf*100:.0f}%"
                        )
                        analysis.correlated_signals = [call, put]
                        analysis.correlation_type = "COLLAR"
    
    def _analyze_single_signal(
        self, 
        signal: UnusualOptionsSignal
    ) -> HedgeAnalysis:
        """Analyze a single signal for hedging patterns."""
        
        # Check each hedge pattern
        checks = [
            self._is_protective_put(signal),
            self._is_index_hedge(signal),
            self._is_sector_hedge(signal),
            self._is_far_dated_mega_cap(signal),
        ]
        
        # Find best matching pattern
        best_match = max(checks, key=lambda x: x[1])
        is_hedge, confidence, indicators, reasoning = best_match
        
        # Determine hedge type
        hedge_type = None
        if is_hedge:
            if signal.ticker in INDEX_ETFS:
                hedge_type = "INDEX_HEDGE"
            elif signal.ticker in SECTOR_ETFS:
                hedge_type = "SECTOR_HEDGE"
            elif signal.days_to_expiry and signal.days_to_expiry >= 90:
                hedge_type = "LEAPS_HEDGE"
            else:
                hedge_type = "PROTECTIVE_PUT"
        
        return HedgeAnalysis(
            signal=signal,
            is_likely_hedge=is_hedge,
            hedge_confidence=confidence,
            hedge_type=hedge_type,
            hedge_indicators=indicators,
            reasoning=reasoning
        )
    
    def get_hedges(self) -> List[HedgeAnalysis]:
        """Get all signals identified as likely hedges."""
        return [
            a for a in self.analyses.values() 
            if a.is_likely_hedge or a.hedge_confidence >= 0.5
        ]
    
    def get_directional(self) -> List[HedgeAnalysis]:
        """Get all signals likely to be directional bets."""
        return [
            a for a in self.analyses.values() 
            if not a.is_likely_hedge and a.hedge_confidence < 0.5
        ]
    
    def display_summary(self) -> None:
        """Display analysis summary."""
        hedges = self.get_hedges()
        directional = self.get_directional()
        
        # Calculate hedge statistics
        hedge_premium = sum(
            a.signal.premium_flow or 0 for a in hedges
        )
        directional_premium = sum(
            a.signal.premium_flow or 0 for a in directional
        )
        total_premium = hedge_premium + directional_premium
        
        # Summary panel
        summary = f"""
[bold cyan]Signal Classification Summary[/bold cyan]

Total Signals: {len(self.analyses)}
├── Likely Hedges: {len(hedges)} ({len(hedges)/len(self.analyses)*100:.1f}%)
└── Directional Bets: {len(directional)} ({len(directional)/len(self.analyses)*100:.1f}%)

[bold cyan]Premium Flow Analysis[/bold cyan]

Total Premium: ${total_premium/1_000_000:.1f}M
├── Hedge Premium: ${hedge_premium/1_000_000:.1f}M ({hedge_premium/total_premium*100:.1f}%)
└── Directional Premium: ${directional_premium/1_000_000:.1f}M ({directional_premium/total_premium*100:.1f}%)
"""
        
        console.print(Panel(
            summary,
            title="🛡️ Hedge vs. Directional Analysis",
            border_style="cyan"
        ))
        
        # Hedge type breakdown
        hedge_types = defaultdict(int)
        for a in hedges:
            if a.hedge_type:
                hedge_types[a.hedge_type] += 1
            elif a.hedge_confidence >= 0.5:
                hedge_types["PROBABLE_HEDGE"] += 1
        
        if hedge_types:
            type_table = Table(
                title="Hedge Type Breakdown", 
                box=box.ROUNDED
            )
            type_table.add_column("Type", style="cyan")
            type_table.add_column("Count", justify="right")
            type_table.add_column("Percentage", justify="right")
            
            for htype, count in sorted(
                hedge_types.items(), 
                key=lambda x: x[1], 
                reverse=True
            ):
                pct = count / len(hedges) * 100
                type_table.add_row(htype, str(count), f"{pct:.1f}%")
            
            console.print(type_table)
    
    def display_hedge_signals(self, max_rows: int = 20) -> None:
        """Display signals identified as hedges."""
        hedges = sorted(
            self.get_hedges(), 
            key=lambda x: x.hedge_confidence, 
            reverse=True
        )
        
        if not hedges:
            console.print("[yellow]No hedge patterns detected[/yellow]")
            return
        
        table = Table(
            title=f"🛡️ Likely Hedge Activity ({len(hedges)} signals)",
            box=box.ROUNDED,
            show_lines=True
        )
        table.add_column("Ticker\nContract", style="cyan", no_wrap=True)
        table.add_column("Type", style="magenta")
        table.add_column("Confidence", justify="center")
        table.add_column("Premium", justify="right")
        table.add_column("DTE", justify="center")
        table.add_column("Indicators", style="dim")
        
        for analysis in hedges[:max_rows]:
            signal = analysis.signal
            
            # Confidence color
            if analysis.hedge_confidence >= 0.8:
                conf_style = "bold green"
            elif analysis.hedge_confidence >= 0.6:
                conf_style = "yellow"
            else:
                conf_style = "dim"
            
            # Format indicators (max 3)
            indicators_str = "\n".join(
                analysis.hedge_indicators[:3]
            )
            
            table.add_row(
                f"{signal.ticker}\n{signal.option_symbol}",
                analysis.hedge_type or "UNKNOWN",
                f"[{conf_style}]{analysis.hedge_confidence:.0%}"
                f"[/{conf_style}]",
                f"${signal.premium_flow/1_000_000:.1f}M" 
                    if signal.premium_flow else "N/A",
                str(signal.days_to_expiry) if signal.days_to_expiry else "N/A",
                indicators_str
            )
        
        console.print(table)
    
    def display_directional_signals(self, max_rows: int = 20) -> None:
        """Display signals identified as directional bets."""
        directional = sorted(
            self.get_directional(),
            key=lambda x: x.signal.premium_flow or 0,
            reverse=True
        )
        
        if not directional:
            console.print(
                "[yellow]No directional signals found[/yellow]"
            )
            return
        
        table = Table(
            title=f"🎯 Likely Directional Bets ({len(directional)} signals)",
            box=box.ROUNDED,
            show_lines=True
        )
        table.add_column("Ticker\nContract", style="cyan", no_wrap=True)
        table.add_column("Grade", justify="center")
        table.add_column("Direction", style="bold")
        table.add_column("Premium", justify="right")
        table.add_column("DTE", justify="center")
        table.add_column("Score", justify="center")
        
        for analysis in directional[:max_rows]:
            signal = analysis.signal
            
            # Grade style
            grade_style = {
                'S': 'bold green',
                'A': 'bold blue',
                'B': 'bold yellow',
                'C': 'orange',
                'D': 'red',
                'F': 'dim red'
            }.get(signal.grade, 'white')
            
            # Direction
            direction = "🟢 BULLISH" if signal.option_type == 'call' else "🔴 BEARISH"
            
            table.add_row(
                f"{signal.ticker}\n{signal.option_symbol}",
                f"[{grade_style}]{signal.grade}[/{grade_style}]",
                direction,
                f"${signal.premium_flow/1_000_000:.1f}M" 
                    if signal.premium_flow else "N/A",
                str(signal.days_to_expiry) if signal.days_to_expiry else "N/A",
                f"{signal.overall_score:.2f}"
            )
        
        console.print(table)
    
    async def run_analysis(
        self, 
        days: int = 7, 
        min_grade: str = 'A',
        show_hedges: bool = True,
        show_directional: bool = True,
        exclude_hedges: bool = False
    ):
        """Run complete hedge analysis."""
        
        console.print(Panel.fit(
            "[bold cyan]🛡️ Hedge Activity Analyzer[/bold cyan]\n"
            f"Analyzing {days} days of signals (grade {min_grade}+)\n"
            f"Goal: Separate hedging from directional bets",
            border_style="cyan"
        ))
        
        # Fetch signals
        await self.fetch_signals(days, min_grade)
        
        if len(self.signals) < 5:
            console.print(
                "[yellow]Not enough signals for analysis.[/yellow]"
            )
            return
        
        # Run analysis
        self.analyze_all_signals()
        
        # Display summary
        console.print()
        self.display_summary()
        console.print()
        
        # Display results based on flags
        if show_hedges and not exclude_hedges:
            self.display_hedge_signals()
            console.print()
        
        if show_directional or exclude_hedges:
            self.display_directional_signals()
        
        # Data quality warning
        console.print()
        console.print(Panel(
            "[bold yellow]⚠️ Data Limitations[/bold yellow]\n\n"
            "Hedge detection is based on heuristics and may not be "
            "100% accurate.\n"
            "Missing data that would improve accuracy:\n"
            "• Order side (buy vs. sell) - critical for covered "
            "call/put detection\n"
            "• Greeks (delta) - for net exposure calculation\n"
            "• Historical position context - for roll detection\n\n"
            "See: docs/unusual-options-service/"
            "hedge-detection-analysis.md",
            border_style="yellow"
        ))


async def main():
    import argparse
    
    parser = argparse.ArgumentParser(
        description="Analyze unusual options for hedging patterns"
    )
    parser.add_argument(
        "--days", type=int, default=7,
        help="Number of days to analyze (default: 7)"
    )
    parser.add_argument(
        "--min-grade", type=str, default="A",
        help="Minimum signal grade (default: A)"
    )
    parser.add_argument(
        "--show-hedges-only", action="store_true",
        help="Only show hedge activity"
    )
    parser.add_argument(
        "--exclude-hedges", action="store_true",
        help="Only show directional bets (exclude hedges)"
    )
    
    args = parser.parse_args()
    
    analyzer = HedgeAnalyzer()
    await analyzer.run_analysis(
        days=args.days,
        min_grade=args.min_grade,
        show_hedges=not args.exclude_hedges,
        show_directional=not args.show_hedges_only,
        exclude_hedges=args.exclude_hedges
    )


if __name__ == "__main__":
    asyncio.run(main())

