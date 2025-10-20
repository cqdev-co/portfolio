#!/usr/bin/env python3
"""
Insider-Type Play Detector

Identifies unusual options activity that looks like informed trading:
1. Large premium flow in single strikes (concentrated bets)
2. Unusual activity with upcoming catalysts (earnings, FDA, etc.)
3. Sudden interest in previously quiet options
4. Large ITM or near-ATM positioning (conviction plays)

Example: $6.5M in ORCL calls 4 days before OpenAI partnership announcement
Goal: Find these plays BEFORE the news drops, so we can follow the smart money
"""

import os
import sys
import asyncio
from datetime import datetime, timedelta, date
from typing import List, Dict, Any, Optional, Set
from dataclasses import dataclass, field
from collections import defaultdict
import statistics
import yfinance as yf

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from unusual_options.config import load_config
from unusual_options.storage.database import get_storage
from unusual_options.storage.models import UnusualOptionsSignal

from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich import box

console = Console()

# Cache for earnings dates to avoid repeated API calls
EARNINGS_CACHE: Dict[str, Optional[date]] = {}

def get_earnings_date(ticker: str) -> Optional[date]:
    """Get next earnings date for a ticker using yfinance (with caching)"""
    if ticker in EARNINGS_CACHE:
        return EARNINGS_CACHE[ticker]
    
    try:
        yf_ticker = yf.Ticker(ticker)
        calendar = yf_ticker.calendar
        
        if calendar and 'Earnings Date' in calendar:
            earnings_dates = calendar['Earnings Date']
            if isinstance(earnings_dates, list) and len(earnings_dates) > 0:
                # Get the first (next) earnings date
                next_earnings = earnings_dates[0]
                EARNINGS_CACHE[ticker] = next_earnings
                return next_earnings
            elif isinstance(earnings_dates, date):
                EARNINGS_CACHE[ticker] = earnings_dates
                return earnings_dates
    except Exception as e:
        # Silently fail - not all tickers have earnings data
        pass
    
    EARNINGS_CACHE[ticker] = None
    return None

def days_to_earnings(ticker: str, reference_date: date = None) -> Optional[int]:
    """Calculate days until next earnings date"""
    if reference_date is None:
        reference_date = date.today()
    
    earnings_date = get_earnings_date(ticker)
    if earnings_date:
        delta = (earnings_date - reference_date).days
        return delta if delta >= 0 else None
    return None

# Mega-cap tickers that always have huge options flow (exclude from scaling detection)
MEGA_CAPS = {
    'AAPL', 'MSFT', 'GOOGL', 'GOOG', 'AMZN', 'NVDA', 'META', 'TSLA', 
    'BRK.B', 'UNH', 'JNJ', 'XOM', 'V', 'PG', 'JPM', 'MA', 'HD', 'CVX',
    'LLY', 'ABBV', 'MRK', 'KO', 'AVGO', 'PEP', 'COST', 'WMT', 'CSCO',
    'AMD', 'NFLX', 'ADBE', 'CRM', 'TMO', 'DIS', 'ABT', 'NKE', 'INTC'
}

@dataclass
class InsiderPlay:
    """Represents a potential insider-type play with all matched patterns"""
    signal: UnusualOptionsSignal
    play_types: Set[str] = field(default_factory=set)  # All patterns this signal matches
    suspicion_score: float = 0.0  # 0-100, composite from all patterns
    surprise_factor: float = 0.0  # Relative to ticker's normal volume
    key_metrics: Dict[str, Any] = field(default_factory=dict)
    why_interesting: List[str] = field(default_factory=list)  # All reasons
    action_recommendation: str = ""
    
    def add_pattern(self, play_type: str, suspicion: float, reason: str):
        """Add a matched pattern to this play"""
        self.play_types.add(play_type)
        # Use max suspicion across all patterns
        self.suspicion_score = max(self.suspicion_score, suspicion)
        self.why_interesting.append(reason)

class InsiderPlayDetector:
    def __init__(self):
        self.config = load_config()
        self.storage = get_storage(self.config)
        self.signals: List[UnusualOptionsSignal] = []
        self.plays_by_signal_id: Dict[str, InsiderPlay] = {}  # Deduplicated plays
    
    async def fetch_signals(self, days: int = 3, min_grade: str = 'A') -> None:
        """Fetch recent high-quality signals"""
        console.print(f"[blue]Scanning for insider-type plays (last {days} days, grade {min_grade}+)...[/blue]")
        
        end_date = datetime.now().date() + timedelta(days=1)
        start_date = end_date - timedelta(days=days + 1)
        
        self.signals = await self.storage.get_signals(
            min_grade=min_grade,
            start_date=start_date,
            end_date=end_date,
            limit=10000
        )
        
        console.print(f"[green]✓ Analyzing {len(self.signals)} signals[/green]")
        
        # Filter out 0-2 DTE options (0DTE gambling noise)
        original_count = len(self.signals)
        self.signals = [
            s for s in self.signals 
            if s.days_to_expiry and s.days_to_expiry >= 3
        ]
        filtered_count = original_count - len(self.signals)
        if filtered_count > 0:
            console.print(f"[dim]Filtered out {filtered_count} 0-2 DTE signals (0DTE gambling noise)[/dim]")
        
        # Calculate surprise factor for each signal
        self._calculate_surprise_factors()
    
    def _calculate_surprise_factors(self):
        """Calculate how surprising each signal is relative to ticker's normal volume"""
        # Group signals by ticker to calculate ticker-specific stats
        ticker_volumes = defaultdict(list)
        
        for signal in self.signals:
            if signal.current_volume:
                ticker_volumes[signal.ticker].append(signal.current_volume)
        
        # Calculate surprise factor for each signal
        for signal in self.signals:
            if not signal.current_volume:
                signal.surprise_factor = 0.0
                continue
            
            ticker_vols = ticker_volumes.get(signal.ticker, [])
            
            if len(ticker_vols) < 2:
                # Not enough data, use absolute volume
                signal.surprise_factor = min(signal.current_volume / 10000, 10.0)
            else:
                # Calculate how many std deviations above mean
                mean_vol = statistics.mean(ticker_vols)
                try:
                    stdev_vol = statistics.stdev(ticker_vols)
                    if stdev_vol > 0:
                        z_score = (signal.current_volume - mean_vol) / stdev_vol
                        signal.surprise_factor = max(0, min(z_score, 10.0))
                    else:
                        signal.surprise_factor = 1.0
                except:
                    signal.surprise_factor = 1.0
    
    def _get_or_create_play(self, signal: UnusualOptionsSignal) -> InsiderPlay:
        """Get existing play for this signal or create new one"""
        if signal.signal_id not in self.plays_by_signal_id:
            play = InsiderPlay(
                signal=signal,
                surprise_factor=getattr(signal, 'surprise_factor', 0.0)
            )
            self.plays_by_signal_id[signal.signal_id] = play
        return self.plays_by_signal_id[signal.signal_id]
    
    def detect_large_concentrated_bets(self) -> List[InsiderPlay]:
        """
        Detect: Someone puts a LOT of money into a SPECIFIC strike
        
        Example: $6.5M in ORCL $115 calls (not spread across multiple strikes)
        Why suspicious: Smart money is very confident in a specific outcome
        """
        # Minimum premium for "large" bet
        LARGE_BET_THRESHOLD = 3_000_000  # $3M+
        
        for signal in self.signals:
            if not signal.premium_flow or signal.premium_flow < LARGE_BET_THRESHOLD:
                continue
            
            # Check if this is ITM or near-ATM (not a lottery ticket)
            if signal.moneyness in ['ITM', 'ATM']:
                # Calculate suspicion score
                suspicion = min(signal.premium_flow / 10_000_000 * 100, 100)  # Scale to 100
                
                # Bonus for very short time to expiry (urgency = knows something is coming)
                if signal.days_to_expiry and signal.days_to_expiry <= 14:
                    suspicion = min(suspicion * 1.3, 100)
                
                # Bonus for S-grade signals
                if signal.grade == 'S':
                    suspicion = min(suspicion * 1.2, 100)
                
                # Bonus for surprise factor
                if signal.surprise_factor and signal.surprise_factor > 2.0:
                    suspicion = min(suspicion * 1.1, 100)
                
                play = self._get_or_create_play(signal)
                play.add_pattern(
                    "LARGE_BET",
                    suspicion,
                    f"${signal.premium_flow/1_000_000:.1f}M premium in single strike"
                )
                play.key_metrics.update({
                    'premium': signal.premium_flow,
                    'strike': signal.strike,
                    'dte': signal.days_to_expiry,
                    'moneyness': signal.moneyness
                })
        
        return list(self.plays_by_signal_id.values())
    
    def detect_unusual_dte_premium_combo(self) -> List[InsiderPlay]:
        """
        Detect: Large premium + Short DTE = Someone knows something is happening SOON
        
        Example: $4M in calls expiring in 7 days (not months out)
        Why suspicious: Short-dated + large size = knows catalyst timing
        """
        for signal in self.signals:
            if not signal.premium_flow or not signal.days_to_expiry:
                continue
            
            # Short DTE (3-14 days) + Large premium
            if 3 <= signal.days_to_expiry <= 14 and signal.premium_flow >= 2_000_000:
                # Calculate urgency score
                urgency = (15 - signal.days_to_expiry) / 12  # Shorter = more urgent
                size_score = min(signal.premium_flow / 5_000_000, 1.0)
                suspicion = (urgency * 0.5 + size_score * 0.5) * 100
                
                # Bonus for near-the-money (easier to profit = more confident)
                if signal.moneyness in ['ATM', 'ITM']:
                    suspicion = min(suspicion * 1.3, 100)
                
                # Bonus for surprise factor
                if signal.surprise_factor and signal.surprise_factor > 2.0:
                    suspicion = min(suspicion * 1.1, 100)
                
                play = self._get_or_create_play(signal)
                play.add_pattern(
                    "URGENT_SHORT_DTE",
                    suspicion,
                    f"${signal.premium_flow/1_000_000:.1f}M bet expiring in {signal.days_to_expiry} days"
                )
                play.key_metrics.update({
                    'premium': signal.premium_flow,
                    'dte': signal.days_to_expiry,
                    'option_type': signal.option_type
                })
        
        return list(self.plays_by_signal_id.values())
    
    def detect_volume_to_oi_anomalies(self) -> List[InsiderPlay]:
        """
        Detect: Volume >> Open Interest = Fresh new positioning (not existing positions trading)
        
        Example: Option has 500 OI but 5,000 volume today
        Why suspicious: Sudden NEW interest, not existing holders trading
        """
        for signal in self.signals:
            if not signal.current_oi or signal.current_oi == 0:
                continue
            
            if not signal.current_volume:
                continue
            
            volume_to_oi = signal.current_volume / signal.current_oi
            
            # Volume is 5x+ the open interest = lots of new positioning
            if volume_to_oi >= 5.0 and signal.premium_flow and signal.premium_flow >= 1_000_000:
                suspicion = min((volume_to_oi / 10) * 100, 100)
                
                # Bonus for ITM options (real positioning, not speculation)
                if signal.moneyness == 'ITM':
                    suspicion = min(suspicion * 1.2, 100)
                
                # Bonus for surprise factor
                if signal.surprise_factor and signal.surprise_factor > 2.0:
                    suspicion = min(suspicion * 1.1, 100)
                
                play = self._get_or_create_play(signal)
                play.add_pattern(
                    "FRESH_POSITIONING",
                    suspicion,
                    f"{volume_to_oi:.1f}x volume vs OI - major NEW positioning"
                )
                play.key_metrics.update({
                    'volume': signal.current_volume,
                    'oi': signal.current_oi,
                    'volume_to_oi': volume_to_oi
                })
        
        return list(self.plays_by_signal_id.values())
    
    def detect_aggressive_buyer_patterns(self) -> List[InsiderPlay]:
        """
        Detect: High percentage of aggressive orders (buying the ask, not waiting)
        
        Example: 85% aggressive orders = buyer is DESPERATE to get in
        Why suspicious: Urgency suggests they know something
        """
        for signal in self.signals:
            # FIX: aggressive_order_pct is stored as decimal (0.70 = 70%), not percentage
            if not signal.aggressive_order_pct or signal.aggressive_order_pct < 0.70:
                continue
            
            if not signal.premium_flow or signal.premium_flow < 1_000_000:
                continue
            
            # High aggression + large size = urgent positioning
            # Convert to 0-100 scale (0.70 = 70 points)
            suspicion = min(signal.aggressive_order_pct * 100, 100)
            
            # Bonus for very high aggression (>80%)
            if signal.aggressive_order_pct > 0.80:
                suspicion = min(suspicion * 1.2, 100)
            
            # Bonus for surprise factor
            if signal.surprise_factor and signal.surprise_factor > 2.0:
                suspicion = min(suspicion * 1.1, 100)
            
            play = self._get_or_create_play(signal)
            play.add_pattern(
                "AGGRESSIVE_BUYER",
                suspicion,
                f"{signal.aggressive_order_pct*100:.0f}% aggressive orders - buyer paying up"
            )
            play.key_metrics.update({
                'aggressive_pct': signal.aggressive_order_pct,
                'premium': signal.premium_flow,
                'option_type': signal.option_type
            })
        
        return list(self.plays_by_signal_id.values())
    
    def detect_multi_strike_building(self) -> List[InsiderPlay]:
        """
        Detect: Multiple large positions at different strikes in same ticker/direction
        BUT: Filter out mega-caps where this is normal flow
        
        Example: $5M in ROKU $90 calls + $3M in ROKU $95 calls same day
        Why suspicious: Scaling into conviction (institutional-style positioning)
        """
        # Group signals by ticker and option type
        ticker_positions = defaultdict(lambda: {'calls': [], 'puts': []})
        
        for signal in self.signals:
            if not signal.premium_flow or signal.premium_flow < 1_000_000:
                continue
            
            # FILTER: Skip mega-caps - they always have multi-strike flow
            if signal.ticker in MEGA_CAPS:
                continue
            
            if signal.option_type == 'call':
                ticker_positions[signal.ticker]['calls'].append(signal)
            else:
                ticker_positions[signal.ticker]['puts'].append(signal)
        
        # Look for tickers with multiple large positions
        for ticker, positions in ticker_positions.items():
            for option_type, signals in positions.items():
                if len(signals) < 2:  # Need at least 2 positions
                    continue
                
                total_premium = sum([s.premium_flow for s in signals if s.premium_flow])
                
                if total_premium >= 5_000_000:  # $5M+ total
                    # Calculate suspicion
                    suspicion = min((total_premium / 10_000_000) * 100, 100)
                    
                    # Bonus if positions are within 10% strike range (concentrated conviction)
                    strikes = [s.strike for s in signals]
                    strike_range = (max(strikes) - min(strikes)) / min(strikes)
                    if strike_range < 0.10:  # Within 10%
                        suspicion = min(suspicion * 1.3, 100)
                    
                    # Bonus for smaller cap names (more unusual)
                    if ticker not in MEGA_CAPS:
                        suspicion = min(suspicion * 1.2, 100)
                    
                    # Add pattern to EACH signal involved in the scaling
                    for signal in signals:
                        play = self._get_or_create_play(signal)
                        play.add_pattern(
                            "MULTI_STRIKE_SCALING",
                            suspicion,
                            f"${total_premium/1_000_000:.1f}M across {len(signals)} strikes (${min(strikes):.0f}-${max(strikes):.0f})"
                        )
                        play.key_metrics.update({
                            'total_premium': total_premium,
                            'num_strikes': len(signals),
                            'strike_range': f"${min(strikes):.0f}-${max(strikes):.0f}"
                        })
        
        return list(self.plays_by_signal_id.values())
    
    def detect_earnings_plays(self) -> List[InsiderPlay]:
        """
        Detect: Large positioning before earnings
        
        Example: $5M in options 3 days before earnings
        Why suspicious: Someone expects big earnings move
        """
        for signal in self.signals:
            if not signal.premium_flow or signal.premium_flow < 2_000_000:
                continue
            
            days_until_earnings_date = days_to_earnings(signal.ticker)
            
            # Check if earnings is within next 14 days
            if days_until_earnings_date is not None and 0 <= days_until_earnings_date <= 14:
                # Large bet before earnings = expecting big move
                suspicion = min((signal.premium_flow / 5_000_000) * 100, 100)
                
                # Bonus for very close to earnings (3-7 days)
                if 3 <= days_until_earnings_date <= 7:
                    suspicion = min(suspicion * 1.3, 100)
                
                # Bonus if earnings is very soon (0-2 days)
                if days_until_earnings_date <= 2:
                    suspicion = min(suspicion * 1.5, 100)
                
                # Bonus for surprise factor
                if signal.surprise_factor and signal.surprise_factor > 2.0:
                    suspicion = min(suspicion * 1.1, 100)
                
                play = self._get_or_create_play(signal)
                play.add_pattern(
                    "EARNINGS_PLAY",
                    suspicion,
                    f"${signal.premium_flow/1_000_000:.1f}M bet {days_until_earnings_date}d before earnings"
                )
                play.key_metrics.update({
                    'days_to_earnings': days_until_earnings_date,
                    'premium': signal.premium_flow
                })
        
        return list(self.plays_by_signal_id.values())
    
    def _generate_recommendation(self, play: InsiderPlay) -> str:
        """Generate action recommendation based on play"""
        signal = play.signal
        suspicion = play.suspicion_score
        
        if suspicion >= 80:
            action = "STRONG FOLLOW"
        elif suspicion >= 60:
            action = "CONSIDER FOLLOWING"
        else:
            action = "MONITOR"
        
        direction = "bullish" if signal.option_type == 'call' else "bearish"
        
        # Add surprise factor context
        surprise_context = ""
        if play.surprise_factor > 3.0:
            surprise_context = f" [HIGHLY UNUSUAL for {signal.ticker}]"
        elif play.surprise_factor > 2.0:
            surprise_context = f" [Unusual for {signal.ticker}]"
        
        return f"{action}: {signal.ticker} looking {direction}. Strike ${signal.strike:.0f}, expires {signal.days_to_expiry}d. Premium ${signal.premium_flow/1_000_000:.1f}M.{surprise_context}"
    
    def get_filtered_plays(self) -> List[InsiderPlay]:
        """Get all plays, filtered and sorted by suspicion + surprise factor"""
        plays = list(self.plays_by_signal_id.values())
        
        # Generate recommendations
        for play in plays:
            play.action_recommendation = self._generate_recommendation(play)
        
        # Sort by composite score: suspicion * (1 + surprise_factor/10)
        # This gives a small boost to surprising plays without overwhelming the suspicion score
        for play in plays:
            play.composite_score = play.suspicion_score * (1 + play.surprise_factor / 10)
        
        return sorted(plays, key=lambda x: x.composite_score, reverse=True)
    
    def display_insider_plays(self, plays: List[InsiderPlay], title: str, max_rows: int = 20) -> None:
        """Display insider-type plays (deduplicated)"""
        if not plays:
            return
        
        table = Table(title=title, box=box.ROUNDED, show_lines=True)
        table.add_column("Ticker\nContract", style="cyan bold", no_wrap=True)
        table.add_column("Patterns Matched", style="magenta")
        table.add_column("Suspicion\nSurprise", justify="center", style="bold")
        table.add_column("Key Metrics", style="dim")
        table.add_column("Why Interesting", style="yellow")
        table.add_column("Action", style="green")
        
        for play in plays[:max_rows]:
            # Color code suspicion
            if play.suspicion_score >= 80:
                suspicion_style = "bold red"
            elif play.suspicion_score >= 60:
                suspicion_style = "bold yellow"
            else:
                suspicion_style = "white"
            
            # Color code surprise factor
            if play.surprise_factor >= 3.0:
                surprise_style = "bold red"
            elif play.surprise_factor >= 2.0:
                surprise_style = "bold yellow"
            else:
                surprise_style = "dim"
            
            # Format patterns
            pattern_names = {
                'LARGE_BET': '💰 Large Bet',
                'URGENT_SHORT_DTE': '⏰ Urgent',
                'FRESH_POSITIONING': '🆕 Fresh',
                'AGGRESSIVE_BUYER': '🚨 Aggressive',
                'MULTI_STRIKE_SCALING': '📊 Scaling',
                'EARNINGS_PLAY': '📈 Earnings'
            }
            patterns_str = "\n".join([pattern_names.get(p, p) for p in sorted(play.play_types)])
            
            # Format key metrics (top 5, including earnings if relevant)
            metrics_items = []
            if 'premium' in play.key_metrics:
                metrics_items.append(f"Premium: ${play.key_metrics['premium']/1_000_000:.1f}M")
            if 'dte' in play.key_metrics:
                metrics_items.append(f"DTE: {play.key_metrics['dte']}d")
            
            # Add earnings proximity if within 30 days
            days_until_earnings = days_to_earnings(play.signal.ticker)
            if days_until_earnings is not None and 0 <= days_until_earnings <= 30:
                if days_until_earnings == 0:
                    metrics_items.append(f"📊 Earnings: TODAY")
                elif days_until_earnings <= 7:
                    metrics_items.append(f"📊 Earnings: {days_until_earnings}d")
                else:
                    metrics_items.append(f"Earnings: {days_until_earnings}d")
            
            if 'volume_to_oi' in play.key_metrics:
                metrics_items.append(f"Vol/OI: {play.key_metrics['volume_to_oi']:.1f}x")
            if 'aggressive_pct' in play.key_metrics:
                # Cap at 100% (some stored values are already > 1.0 due to data issues)
                aggr_pct = min(play.key_metrics['aggressive_pct'], 1.0) * 100
                metrics_items.append(f"Aggr: {aggr_pct:.0f}%")
            metrics_str = "\n".join(metrics_items[:5])
            
            # Format why interesting (top 3 reasons)
            why_str = "\n".join(play.why_interesting[:3])
            
            table.add_row(
                f"{play.signal.ticker}\n{play.signal.option_symbol}",
                patterns_str,
                f"[{suspicion_style}]{play.suspicion_score:.0f}/100[/{suspicion_style}]\n"
                f"[{surprise_style}]{play.surprise_factor:.1f}σ[/{surprise_style}]",
                metrics_str,
                why_str,
                play.action_recommendation
            )
        
        console.print(table)
    
    async def run_analysis(self, days: int = 3, min_grade: str = 'A'):
        """Run the complete insider play detection"""
        
        console.print(Panel.fit(
            "[bold red]🕵️ Insider-Type Play Detector[/bold red]\n"
            f"Scanning for suspicious unusual options activity\n"
            f"Goal: Find plays BEFORE the news drops",
            border_style="red"
        ))
        
        # Fetch signals
        await self.fetch_signals(days, min_grade)
        
        if len(self.signals) < 5:
            console.print("[yellow]Not enough high-quality signals for analysis.[/yellow]")
            return
        
        # Run all detection algorithms (they all update the same deduplicated plays)
        console.print("[blue]Running detection algorithms...[/blue]\n")
        
        console.print("[dim]Detecting large concentrated bets...[/dim]")
        self.detect_large_concentrated_bets()
        
        console.print("[dim]Detecting short-term urgency plays...[/dim]")
        self.detect_unusual_dte_premium_combo()
        
        console.print("[dim]Detecting sudden new interest...[/dim]")
        self.detect_volume_to_oi_anomalies()
        
        console.print("[dim]Detecting aggressive urgent buyers...[/dim]")
        self.detect_aggressive_buyer_patterns()
        
        console.print("[dim]Detecting institutional scaling (non-mega-caps)...[/dim]")
        self.detect_multi_strike_building()
        
        console.print("[dim]Detecting earnings plays...[/dim]")
        self.detect_earnings_plays()
        
        # Get filtered and sorted plays
        all_plays = self.get_filtered_plays()
        
        console.print()
        
        # Display plays by pattern count
        multi_pattern = [p for p in all_plays if len(p.play_types) >= 3]
        high_suspicion = [p for p in all_plays if p.suspicion_score >= 80]
        high_surprise = [p for p in all_plays if p.surprise_factor >= 3.0]
        
        # Display most suspicious plays (multiple patterns matched)
        if multi_pattern:
            self.display_insider_plays(
                multi_pattern, 
                "🎯 HIGHEST CONVICTION PLAYS (Multiple Patterns Matched)",
                max_rows=15
            )
            console.print()
        
        # Display high suspicion plays
        if high_suspicion:
            self.display_insider_plays(
                high_suspicion,
                "🔥 HIGH SUSPICION PLAYS (Score ≥80)",
                max_rows=15
            )
            console.print()
        
        # Display most surprising plays (unusual for the ticker)
        if high_surprise:
            self.display_insider_plays(
                high_surprise,
                "⚡ MOST SURPRISING PLAYS (Highly Unusual Volume)",
                max_rows=15
            )
            console.print()
        
        # Display top 20 overall
        if all_plays:
            self.display_insider_plays(
                all_plays,
                "🏆 TOP 20 PLAYS (Ranked by Suspicion × Surprise Factor)",
                max_rows=20
            )
        
        # Count patterns
        pattern_counts = defaultdict(int)
        for play in all_plays:
            for pattern in play.play_types:
                pattern_counts[pattern] += 1
        
        # Summary
        console.print()
        console.print(Panel.fit(
            f"[bold green]Detection Complete[/bold green]\n"
            f"• {len(all_plays)} unique suspicious plays identified\n"
            f"• {len(multi_pattern)} plays match 3+ patterns\n"
            f"• {len(high_suspicion)} plays score ≥80 suspicion\n"
            f"• {len(high_surprise)} plays are highly unusual for their ticker\n\n"
            f"[bold yellow]Pattern Breakdown:[/bold yellow]\n"
            f"  💰 Large Bets: {pattern_counts.get('LARGE_BET', 0)}\n"
            f"  ⏰ Urgent/Short DTE: {pattern_counts.get('URGENT_SHORT_DTE', 0)}\n"
            f"  🆕 Fresh Positioning: {pattern_counts.get('FRESH_POSITIONING', 0)}\n"
            f"  🚨 Aggressive Buyers: {pattern_counts.get('AGGRESSIVE_BUYER', 0)}\n"
            f"  📊 Multi-Strike (non-mega-caps): {pattern_counts.get('MULTI_STRIKE_SCALING', 0)}\n"
            f"  📈 Earnings Plays: {pattern_counts.get('EARNINGS_PLAY', 0)}",
            title="📊 Summary",
            border_style="green"
        ))
        
        # Mega-cap note
        console.print()
        console.print(Panel(
            f"[bold]ℹ️ Filtering Applied[/bold]\n\n"
            f"Multi-strike scaling detection excludes mega-caps:\n"
            f"{', '.join(sorted(list(MEGA_CAPS)[:20]))}...\n\n"
            f"Why? These tickers always have huge multi-strike flow. We focus on\n"
            f"mid/small-cap names where multi-strike scaling is MORE unusual.",
            border_style="blue",
            title="Mega-Cap Filter"
        ))
        
        if all_plays:
            console.print()
            console.print(Panel(
                "[bold]⚠️ DISCLAIMER[/bold]\n\n"
                "This tool identifies unusual patterns that MAY indicate informed trading.\n"
                "However, unusual activity can also be:\n"
                "• Hedging activity (not directional bets)\n"
                "• Market making operations\n"
                "• Institutional rebalancing\n"
                "• Retail herding\n\n"
                "[yellow]Always do your own research and risk management.[/yellow]",
                border_style="red",
                title="Important"
            ))

async def main():
    import argparse
    
    parser = argparse.ArgumentParser(
        description="Detect insider-type unusual options plays",
        epilog="Example: Someone buys $6.5M in ORCL calls 4 days before OpenAI partnership news"
    )
    parser.add_argument("--days", type=int, default=3, help="Number of days to scan (default: 3)")
    parser.add_argument("--min-grade", type=str, default="A", help="Minimum signal grade (default: A)")
    
    args = parser.parse_args()
    
    detector = InsiderPlayDetector()
    await detector.run_analysis(days=args.days, min_grade=args.min_grade)

if __name__ == "__main__":
    asyncio.run(main())
