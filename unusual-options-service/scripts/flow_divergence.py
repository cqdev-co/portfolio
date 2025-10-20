#!/usr/bin/env python3
"""
Options Flow Divergence Analyzer

Identifies divergences between:
1. Call vs Put flow (directional bets)
2. Large vs Small premium flow (institutional vs retail)
3. Near vs Far dated options (short-term vs long-term positioning)
4. ITM vs OTM positioning (conviction vs speculation)

These divergences often signal important market turning points or hedging activity.
"""

import os
import sys
import asyncio
from datetime import datetime, timedelta
from typing import List, Dict, Any, Tuple
from dataclasses import dataclass
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

@dataclass
class FlowDivergence:
    """Represents a flow divergence pattern"""
    ticker: str
    divergence_type: str
    strength: float  # 0-1 scale
    call_signals: List[UnusualOptionsSignal]
    put_signals: List[UnusualOptionsSignal]
    call_premium: float
    put_premium: float
    interpretation: str
    confidence: float

class FlowDivergenceAnalyzer:
    def __init__(self):
        self.config = load_config()
        self.storage = get_storage(self.config)
        self.signals: List[UnusualOptionsSignal] = []
    
    async def fetch_signals(self, days: int = 3, min_grade: str = 'B') -> None:
        """Fetch recent signals"""
        console.print(f"[blue]Fetching signals from last {days} days (grade {min_grade}+)...[/blue]")
        
        end_date = datetime.now().date() + timedelta(days=1)
        start_date = end_date - timedelta(days=days + 1)
        
        self.signals = await self.storage.get_signals(
            min_grade=min_grade,
            start_date=start_date,
            end_date=end_date,
            limit=10000
        )
        
        console.print(f"[green]✓ Loaded {len(self.signals)} signals[/green]")
    
    def analyze_call_put_divergence(self) -> List[FlowDivergence]:
        """Identify divergence between call and put flow"""
        divergences = []
        
        # Group signals by ticker
        ticker_signals = defaultdict(lambda: {'calls': [], 'puts': []})
        
        for signal in self.signals:
            if signal.option_type == 'call':
                ticker_signals[signal.ticker]['calls'].append(signal)
            elif signal.option_type == 'put':
                ticker_signals[signal.ticker]['puts'].append(signal)
        
        for ticker, signals in ticker_signals.items():
            calls = signals['calls']
            puts = signals['puts']
            
            if not calls or not puts:
                continue
            
            # Calculate premium flows
            call_premium = sum([s.premium_flow for s in calls if s.premium_flow])
            put_premium = sum([s.premium_flow for s in puts if s.premium_flow])
            
            if call_premium == 0 and put_premium == 0:
                continue
            
            total_premium = call_premium + put_premium
            call_ratio = call_premium / total_premium if total_premium > 0 else 0
            
            # Strong divergence if >75% in one direction
            if call_ratio > 0.75 or call_ratio < 0.25:
                strength = abs(call_ratio - 0.5) * 2  # Scale to 0-1
                
                if call_ratio > 0.75:
                    interpretation = f"STRONG BULLISH BIAS: {call_ratio:.0%} call premium vs {1-call_ratio:.0%} put premium"
                    divergence_type = "BULLISH_CALL_HEAVY"
                else:
                    interpretation = f"STRONG BEARISH BIAS: {1-call_ratio:.0%} put premium vs {call_ratio:.0%} call premium"
                    divergence_type = "BEARISH_PUT_HEAVY"
                
                # Calculate confidence based on signal quality
                avg_score = statistics.mean([s.overall_score for s in calls + puts])
                
                divergences.append(FlowDivergence(
                    ticker=ticker,
                    divergence_type=divergence_type,
                    strength=strength,
                    call_signals=calls,
                    put_signals=puts,
                    call_premium=call_premium,
                    put_premium=put_premium,
                    interpretation=interpretation,
                    confidence=avg_score
                ))
        
        return sorted(divergences, key=lambda x: x.strength * x.confidence, reverse=True)
    
    def analyze_size_divergence(self) -> List[Dict[str, Any]]:
        """Identify divergence between large and small premium flows"""
        ticker_flows = defaultdict(lambda: {'large': [], 'small': []})
        
        # Define threshold for "large" flow (top 25%)
        all_premium_flows = [s.premium_flow for s in self.signals if s.premium_flow and s.premium_flow > 0]
        if not all_premium_flows:
            return []
        
        all_premium_flows.sort()
        large_threshold = all_premium_flows[int(0.75 * len(all_premium_flows))]
        
        for signal in self.signals:
            if not signal.premium_flow:
                continue
            
            if signal.premium_flow >= large_threshold:
                ticker_flows[signal.ticker]['large'].append(signal)
            else:
                ticker_flows[signal.ticker]['small'].append(signal)
        
        divergences = []
        
        for ticker, flows in ticker_flows.items():
            large_signals = flows['large']
            small_signals = flows['small']
            
            if not large_signals or not small_signals:
                continue
            
            # Analyze directional bias of large vs small flows
            large_bullish = len([s for s in large_signals if s.option_type == 'call'])
            large_bearish = len([s for s in large_signals if s.option_type == 'put'])
            small_bullish = len([s for s in small_signals if s.option_type == 'call'])
            small_bearish = len([s for s in small_signals if s.option_type == 'put'])
            
            # Calculate directional bias
            large_bias = (large_bullish - large_bearish) / (large_bullish + large_bearish) if (large_bullish + large_bearish) > 0 else 0
            small_bias = (small_bullish - small_bearish) / (small_bullish + small_bearish) if (small_bullish + small_bearish) > 0 else 0
            
            # Divergence if large and small money are going opposite directions
            if (large_bias > 0.3 and small_bias < -0.3) or (large_bias < -0.3 and small_bias > 0.3):
                divergences.append({
                    'ticker': ticker,
                    'large_bias': large_bias,
                    'small_bias': small_bias,
                    'large_premium': sum([s.premium_flow for s in large_signals if s.premium_flow]),
                    'small_premium': sum([s.premium_flow for s in small_signals if s.premium_flow]),
                    'interpretation': self._interpret_size_divergence(large_bias, small_bias),
                    'strength': abs(large_bias - small_bias)
                })
        
        return sorted(divergences, key=lambda x: x['strength'], reverse=True)
    
    def _interpret_size_divergence(self, large_bias: float, small_bias: float) -> str:
        """Interpret what the divergence means"""
        if large_bias > 0 and small_bias < 0:
            return "SMART MONEY BULLISH vs RETAIL BEARISH - Institutions buying while retail sells (contrarian bullish)"
        elif large_bias < 0 and small_bias > 0:
            return "SMART MONEY BEARISH vs RETAIL BULLISH - Institutions selling while retail buys (contrarian bearish)"
        return "MIXED"
    
    def analyze_time_divergence(self) -> List[Dict[str, Any]]:
        """Identify divergence between near-dated and far-dated options"""
        ticker_times = defaultdict(lambda: {'near': [], 'far': []})
        
        for signal in self.signals:
            if not signal.days_to_expiry:
                continue
            
            if signal.days_to_expiry <= 14:
                ticker_times[signal.ticker]['near'].append(signal)
            elif signal.days_to_expiry >= 30:
                ticker_times[signal.ticker]['far'].append(signal)
        
        divergences = []
        
        for ticker, times in ticker_times.items():
            near_signals = times['near']
            far_signals = times['far']
            
            if not near_signals or not far_signals:
                continue
            
            # Analyze directional bias
            near_call_premium = sum([s.premium_flow for s in near_signals if s.option_type == 'call' and s.premium_flow])
            near_put_premium = sum([s.premium_flow for s in near_signals if s.option_type == 'put' and s.premium_flow])
            far_call_premium = sum([s.premium_flow for s in far_signals if s.option_type == 'call' and s.premium_flow])
            far_put_premium = sum([s.premium_flow for s in far_signals if s.option_type == 'put' and s.premium_flow])
            
            near_total = near_call_premium + near_put_premium
            far_total = far_call_premium + far_put_premium
            
            if near_total == 0 or far_total == 0:
                continue
            
            near_call_ratio = near_call_premium / near_total
            far_call_ratio = far_call_premium / far_total
            
            # Divergence if near and far term have opposite biases
            if (near_call_ratio > 0.6 and far_call_ratio < 0.4) or (near_call_ratio < 0.4 and far_call_ratio > 0.6):
                divergences.append({
                    'ticker': ticker,
                    'near_call_ratio': near_call_ratio,
                    'far_call_ratio': far_call_ratio,
                    'near_premium': near_total,
                    'far_premium': far_total,
                    'interpretation': self._interpret_time_divergence(near_call_ratio, far_call_ratio),
                    'strength': abs(near_call_ratio - far_call_ratio)
                })
        
        return sorted(divergences, key=lambda x: x['strength'], reverse=True)
    
    def _interpret_time_divergence(self, near_ratio: float, far_ratio: float) -> str:
        """Interpret time-based divergence"""
        if near_ratio > 0.6 and far_ratio < 0.4:
            return "SHORT-TERM BULLISH, LONG-TERM BEARISH - Possible near-term bounce with longer-term concerns"
        elif near_ratio < 0.4 and far_ratio > 0.6:
            return "SHORT-TERM BEARISH, LONG-TERM BULLISH - Possible near-term pullback with longer-term optimism"
        return "MIXED"
    
    def analyze_moneyness_divergence(self) -> List[Dict[str, Any]]:
        """Identify divergence between ITM and OTM positioning"""
        ticker_moneyness = defaultdict(lambda: {'itm': [], 'otm': []})
        
        for signal in self.signals:
            if signal.moneyness == 'ITM':
                ticker_moneyness[signal.ticker]['itm'].append(signal)
            elif signal.moneyness == 'OTM':
                ticker_moneyness[signal.ticker]['otm'].append(signal)
        
        divergences = []
        
        for ticker, moneyness in ticker_moneyness.items():
            itm_signals = moneyness['itm']
            otm_signals = moneyness['otm']
            
            if not itm_signals or not otm_signals:
                continue
            
            # Calculate premiums
            itm_premium = sum([s.premium_flow for s in itm_signals if s.premium_flow])
            otm_premium = sum([s.premium_flow for s in otm_signals if s.premium_flow])
            
            total_premium = itm_premium + otm_premium
            if total_premium == 0:
                continue
            
            itm_ratio = itm_premium / total_premium
            
            # ITM-heavy suggests conviction, OTM-heavy suggests speculation
            if itm_ratio > 0.7 or itm_ratio < 0.3:
                divergences.append({
                    'ticker': ticker,
                    'itm_ratio': itm_ratio,
                    'otm_ratio': 1 - itm_ratio,
                    'itm_premium': itm_premium,
                    'otm_premium': otm_premium,
                    'interpretation': self._interpret_moneyness_divergence(itm_ratio),
                    'strength': abs(itm_ratio - 0.5) * 2
                })
        
        return sorted(divergences, key=lambda x: x['strength'], reverse=True)
    
    def _interpret_moneyness_divergence(self, itm_ratio: float) -> str:
        """Interpret moneyness-based positioning"""
        if itm_ratio > 0.7:
            return "HIGH CONVICTION POSITIONING - Heavy ITM flow suggests institutional hedging or confident directional bets"
        else:
            return "SPECULATIVE POSITIONING - Heavy OTM flow suggests lottery-ticket speculation or cheap hedges"
    
    def display_call_put_divergence(self, divergences: List[FlowDivergence]) -> None:
        """Display call/put divergence analysis"""
        if not divergences:
            console.print("[yellow]No significant call/put divergences found.[/yellow]")
            return
        
        table = Table(title="📊 Call vs Put Flow Divergence", box=box.ROUNDED)
        table.add_column("Ticker", style="cyan", no_wrap=True)
        table.add_column("Type", style="magenta")
        table.add_column("Call Premium", justify="right")
        table.add_column("Put Premium", justify="right")
        table.add_column("Strength", justify="right")
        table.add_column("Confidence", justify="right")
        table.add_column("Interpretation", style="yellow")
        
        for div in divergences[:15]:
            type_color = "green" if "BULLISH" in div.divergence_type else "red"
            
            table.add_row(
                div.ticker,
                f"[{type_color}]{div.divergence_type.replace('_', ' ')}[/{type_color}]",
                f"${div.call_premium:,.0f}",
                f"${div.put_premium:,.0f}",
                f"{div.strength:.1%}",
                f"{div.confidence:.2f}",
                div.interpretation
            )
        
        console.print(table)
    
    def display_size_divergence(self, divergences: List[Dict[str, Any]]) -> None:
        """Display smart money vs retail divergence"""
        if not divergences:
            console.print("[yellow]No significant size divergences found.[/yellow]")
            return
        
        table = Table(title="💰 Smart Money vs Retail Divergence", box=box.ROUNDED)
        table.add_column("Ticker", style="cyan")
        table.add_column("Large Flow Bias", justify="center")
        table.add_column("Small Flow Bias", justify="center")
        table.add_column("Large Premium", justify="right")
        table.add_column("Strength", justify="right")
        table.add_column("Interpretation", style="yellow")
        
        for div in divergences[:10]:
            large_style = "green" if div['large_bias'] > 0 else "red"
            small_style = "green" if div['small_bias'] > 0 else "red"
            
            table.add_row(
                div['ticker'],
                f"[{large_style}]{div['large_bias']:+.0%}[/{large_style}]",
                f"[{small_style}]{div['small_bias']:+.0%}[/{small_style}]",
                f"${div['large_premium']:,.0f}",
                f"{div['strength']:.1%}",
                div['interpretation']
            )
        
        console.print(table)
    
    def display_time_divergence(self, divergences: List[Dict[str, Any]]) -> None:
        """Display near-term vs far-term divergence"""
        if not divergences:
            console.print("[yellow]No significant time divergences found.[/yellow]")
            return
        
        table = Table(title="⏰ Near-Term vs Far-Term Divergence", box=box.ROUNDED)
        table.add_column("Ticker", style="cyan")
        table.add_column("Near-Term (≤14d)", justify="center")
        table.add_column("Far-Term (≥30d)", justify="center")
        table.add_column("Strength", justify="right")
        table.add_column("Interpretation", style="yellow")
        
        for div in divergences[:10]:
            near_style = "green" if div['near_call_ratio'] > 0.5 else "red"
            far_style = "green" if div['far_call_ratio'] > 0.5 else "red"
            
            table.add_row(
                div['ticker'],
                f"[{near_style}]{div['near_call_ratio']:.0%} Calls[/{near_style}]",
                f"[{far_style}]{div['far_call_ratio']:.0%} Calls[/{far_style}]",
                f"{div['strength']:.1%}",
                div['interpretation']
            )
        
        console.print(table)
    
    def display_moneyness_divergence(self, divergences: List[Dict[str, Any]]) -> None:
        """Display ITM vs OTM positioning"""
        if not divergences:
            console.print("[yellow]No significant moneyness divergences found.[/yellow]")
            return
        
        table = Table(title="🎯 ITM vs OTM Positioning", box=box.ROUNDED)
        table.add_column("Ticker", style="cyan")
        table.add_column("ITM Premium", justify="right")
        table.add_column("OTM Premium", justify="right")
        table.add_column("ITM Ratio", justify="right")
        table.add_column("Interpretation", style="yellow")
        
        for div in divergences[:10]:
            ratio_style = "green" if div['itm_ratio'] > 0.7 else "yellow"
            
            table.add_row(
                div['ticker'],
                f"${div['itm_premium']:,.0f}",
                f"${div['otm_premium']:,.0f}",
                f"[{ratio_style}]{div['itm_ratio']:.0%}[/{ratio_style}]",
                div['interpretation']
            )
        
        console.print(table)
    
    async def run_analysis(self, days: int = 3, min_grade: str = 'B'):
        """Run the complete divergence analysis"""
        
        console.print(Panel.fit(
            "[bold blue]🔍 Options Flow Divergence Analysis[/bold blue]\n"
            f"Identifying unusual patterns in options positioning",
            border_style="blue"
        ))
        
        # Fetch signals
        await self.fetch_signals(days, min_grade)
        
        if len(self.signals) < 10:
            console.print("[red]Insufficient signals for divergence analysis.[/red]")
            return
        
        # Analyze different types of divergence
        console.print("[blue]Analyzing call/put divergence...[/blue]")
        call_put_div = self.analyze_call_put_divergence()
        
        console.print("[blue]Analyzing smart money vs retail divergence...[/blue]")
        size_div = self.analyze_size_divergence()
        
        console.print("[blue]Analyzing time-based divergence...[/blue]")
        time_div = self.analyze_time_divergence()
        
        console.print("[blue]Analyzing moneyness positioning...[/blue]")
        moneyness_div = self.analyze_moneyness_divergence()
        
        # Display results
        console.print()
        self.display_call_put_divergence(call_put_div)
        console.print()
        
        if size_div:
            self.display_size_divergence(size_div)
            console.print()
        
        if time_div:
            self.display_time_divergence(time_div)
            console.print()
        
        if moneyness_div:
            self.display_moneyness_divergence(moneyness_div)
            console.print()
        
        # Summary
        console.print(Panel.fit(
            f"[bold green]Analysis Complete[/bold green]\n"
            f"• {len(call_put_div)} call/put divergences\n"
            f"• {len(size_div)} smart money vs retail divergences\n"
            f"• {len(time_div)} time-based divergences\n"
            f"• {len(moneyness_div)} moneyness positioning patterns",
            title="📊 Summary",
            border_style="green"
        ))

async def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="Analyze options flow divergence patterns")
    parser.add_argument("--days", type=int, default=3, help="Number of days to analyze (default: 3)")
    parser.add_argument("--min-grade", type=str, default="B", help="Minimum signal grade (default: B)")
    
    args = parser.parse_args()
    
    analyzer = FlowDivergenceAnalyzer()
    await analyzer.run_analysis(days=args.days, min_grade=args.min_grade)

if __name__ == "__main__":
    asyncio.run(main())
