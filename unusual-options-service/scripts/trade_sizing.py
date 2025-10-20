#!/usr/bin/env python3
"""
Trade Sizing and Risk Management Script

This script helps quants and analysts determine optimal position sizes for unusual options signals
based on:
1. Kelly Criterion for optimal sizing
2. Risk-adjusted position sizing
3. Portfolio heat and correlation limits
4. Expected value calculations
5. Monte Carlo simulations for risk assessment
"""

import os
import sys
import asyncio
import json
import math
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
from collections import defaultdict
import statistics
import random

# Add the src directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from unusual_options.config import load_config
from unusual_options.storage.database import get_storage
from unusual_options.storage.models import UnusualOptionsSignal

# Rich for beautiful terminal output
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn, MofNCompleteColumn
from rich.text import Text
from rich import box

console = Console()

@dataclass
class TradingParameters:
    """Trading parameters for position sizing"""
    account_size: float
    max_position_risk: float = 0.02  # 2% max risk per trade
    max_portfolio_heat: float = 0.06  # 6% max total portfolio risk
    max_correlation_exposure: float = 0.10  # 10% max in correlated positions
    min_expected_return: float = 0.15  # 15% minimum expected return
    confidence_threshold: float = 0.7  # 70% minimum confidence
    
@dataclass
class PositionSizing:
    """Position sizing recommendation"""
    signal: UnusualOptionsSignal
    recommended_size: float
    max_loss: float
    expected_return: float
    expected_value: float
    kelly_fraction: float
    risk_adjusted_size: float
    confidence_score: float
    rationale: str
    warnings: List[str]

class TradeSizingCalculator:
    def __init__(self, trading_params: TradingParameters):
        self.config = load_config()
        self.storage = get_storage(self.config)
        self.params = trading_params
        self.signals: List[UnusualOptionsSignal] = []
        
        # Historical performance data (would be loaded from database in production)
        self.historical_performance = {
            'S': {'win_rate': 0.75, 'avg_win': 0.45, 'avg_loss': -0.25, 'volatility': 0.35},
            'A': {'win_rate': 0.68, 'avg_win': 0.35, 'avg_loss': -0.22, 'volatility': 0.30},
            'B': {'win_rate': 0.58, 'avg_win': 0.28, 'avg_loss': -0.20, 'volatility': 0.28},
            'C': {'win_rate': 0.48, 'avg_win': 0.22, 'avg_loss': -0.18, 'volatility': 0.25},
            'D': {'win_rate': 0.38, 'avg_win': 0.18, 'avg_loss': -0.16, 'volatility': 0.22},
            'F': {'win_rate': 0.25, 'avg_win': 0.12, 'avg_loss': -0.15, 'volatility': 0.20}
        }
    
    async def fetch_signals(self, days: int = 7, min_grade: str = 'B') -> None:
        """Fetch recent signals for analysis"""
        console.print(f"[blue]Fetching signals from last {days} days (grade {min_grade}+)...[/blue]")
        
        end_date = datetime.now().date() + timedelta(days=1)
        start_date = end_date - timedelta(days=days + 1)
        
        self.signals = await self.storage.get_signals(
            min_grade=min_grade,
            start_date=start_date,
            end_date=end_date,
            limit=10000
        )
        
        # Filter for tradeable signals (sufficient liquidity, reasonable expiry)
        tradeable_signals = []
        for signal in self.signals:
            if (signal.current_volume and signal.current_volume >= 100 and
                signal.days_to_expiry and 7 <= signal.days_to_expiry <= 60 and
                signal.premium_flow and signal.premium_flow >= 50000):
                tradeable_signals.append(signal)
        
        self.signals = tradeable_signals
        console.print(f"[green]✓ Loaded {len(self.signals)} tradeable signals[/green]")
    
    def calculate_kelly_fraction(self, win_rate: float, avg_win: float, avg_loss: float) -> float:
        """Calculate Kelly Criterion optimal fraction"""
        if avg_loss >= 0:  # Avoid division by zero or negative
            return 0
        
        # Kelly formula: f = (bp - q) / b
        # where b = avg_win/avg_loss, p = win_rate, q = 1-win_rate
        b = abs(avg_win / avg_loss)
        p = win_rate
        q = 1 - win_rate
        
        kelly = (b * p - q) / b
        
        # Cap Kelly at reasonable levels (never more than 25%)
        return max(0, min(kelly, 0.25))
    
    def calculate_expected_value(self, win_rate: float, avg_win: float, avg_loss: float) -> float:
        """Calculate expected value of the trade"""
        return (win_rate * avg_win) + ((1 - win_rate) * avg_loss)
    
    def estimate_option_pricing(self, signal: UnusualOptionsSignal) -> Tuple[float, float]:
        """Estimate option entry price and potential target"""
        # Simplified option pricing estimation
        # In production, use Black-Scholes or market data
        
        # Estimate current option price based on premium flow and volume
        if signal.current_volume and signal.premium_flow:
            estimated_price = signal.premium_flow / signal.current_volume
        else:
            # Fallback estimation based on moneyness and time
            if signal.moneyness == "ITM":
                estimated_price = 5.0
            elif signal.moneyness == "ATM":
                estimated_price = 3.0
            else:  # OTM
                estimated_price = 1.5
        
        # Adjust for time decay
        time_factor = max(0.5, signal.days_to_expiry / 30) if signal.days_to_expiry else 0.5
        estimated_price *= time_factor
        
        # Estimate target based on historical performance
        grade_perf = self.historical_performance.get(signal.grade, self.historical_performance['C'])
        target_price = estimated_price * (1 + grade_perf['avg_win'])
        
        return max(0.1, estimated_price), max(estimated_price * 1.1, target_price)
    
    def calculate_position_sizing(self, signal: UnusualOptionsSignal) -> PositionSizing:
        """Calculate optimal position sizing for a signal"""
        
        # Get historical performance for this grade
        grade_perf = self.historical_performance.get(signal.grade, self.historical_performance['C'])
        
        # Estimate option pricing
        entry_price, target_price = self.estimate_option_pricing(signal)
        
        # Calculate expected returns
        potential_gain = (target_price - entry_price) / entry_price
        potential_loss = -0.8  # Assume max 80% loss on options
        
        # Adjust for signal confidence
        confidence_adj = signal.overall_score
        adj_win_rate = grade_perf['win_rate'] * confidence_adj
        adj_avg_win = potential_gain * confidence_adj
        adj_avg_loss = potential_loss
        
        # Calculate Kelly fraction
        kelly_fraction = self.calculate_kelly_fraction(adj_win_rate, adj_avg_win, adj_avg_loss)
        
        # Calculate expected value
        expected_value = self.calculate_expected_value(adj_win_rate, adj_avg_win, adj_avg_loss)
        
        # Risk-adjusted position sizing
        max_loss_amount = self.params.account_size * self.params.max_position_risk
        contracts_by_risk = max_loss_amount / (entry_price * 100)  # 100 shares per contract
        
        # Kelly-based sizing
        kelly_amount = self.params.account_size * kelly_fraction
        contracts_by_kelly = kelly_amount / (entry_price * 100)
        
        # Take the more conservative approach
        recommended_contracts = min(contracts_by_risk, contracts_by_kelly)
        
        # Apply additional filters
        warnings = []
        
        # Check minimum expected return
        if expected_value < self.params.min_expected_return:
            recommended_contracts *= 0.5
            warnings.append(f"Low expected value ({expected_value:.1%})")
        
        # Check confidence threshold
        if signal.overall_score < self.params.confidence_threshold:
            recommended_contracts *= 0.7
            warnings.append(f"Below confidence threshold ({signal.overall_score:.2f})")
        
        # Check liquidity
        if signal.current_volume and signal.current_volume < 500:
            recommended_contracts *= 0.6
            warnings.append("Low liquidity")
        
        # Check time to expiry
        if signal.days_to_expiry and signal.days_to_expiry < 14:
            recommended_contracts *= 0.8
            warnings.append("Short time to expiry")
        
        # Final position size
        final_contracts = max(1, round(recommended_contracts))
        position_value = final_contracts * entry_price * 100
        max_loss = position_value * 0.8  # Max 80% loss
        
        # Generate rationale
        rationale = f"Kelly: {kelly_fraction:.1%}, EV: {expected_value:.1%}, Win Rate: {adj_win_rate:.1%}"
        
        return PositionSizing(
            signal=signal,
            recommended_size=final_contracts,
            max_loss=max_loss,
            expected_return=expected_value,
            expected_value=expected_value * position_value,
            kelly_fraction=kelly_fraction,
            risk_adjusted_size=contracts_by_risk,
            confidence_score=signal.overall_score,
            rationale=rationale,
            warnings=warnings
        )
    
    def run_monte_carlo_simulation(self, positions: List[PositionSizing], num_simulations: int = 1000) -> Dict[str, Any]:
        """Run Monte Carlo simulation on portfolio of positions"""
        
        console.print(f"[blue]Running {num_simulations} Monte Carlo simulations...[/blue]")
        
        results = []
        
        with Progress(
            SpinnerColumn(),
            BarColumn(),
            MofNCompleteColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=console,
        ) as progress:
            task = progress.add_task("Simulating...", total=num_simulations)
            
            for i in range(num_simulations):
                portfolio_return = 0
                
                for position in positions:
                    grade_perf = self.historical_performance.get(position.signal.grade, 
                                                              self.historical_performance['C'])
                    
                    # Simulate trade outcome
                    if random.random() < grade_perf['win_rate'] * position.confidence_score:
                        # Win
                        return_pct = random.normalvariate(grade_perf['avg_win'], grade_perf['volatility'] * 0.5)
                    else:
                        # Loss
                        return_pct = random.normalvariate(grade_perf['avg_loss'], grade_perf['volatility'] * 0.3)
                    
                    position_return = position.recommended_size * 100 * return_pct
                    portfolio_return += position_return
                
                results.append(portfolio_return / self.params.account_size)  # As percentage of account
                progress.update(task, advance=1)
        
        # Calculate statistics
        results.sort()
        
        return {
            'mean_return': statistics.mean(results),
            'median_return': statistics.median(results),
            'std_dev': statistics.stdev(results),
            'var_95': results[int(0.05 * len(results))],  # 5th percentile (95% VaR)
            'var_99': results[int(0.01 * len(results))],  # 1st percentile (99% VaR)
            'max_loss': min(results),
            'max_gain': max(results),
            'prob_profit': len([r for r in results if r > 0]) / len(results),
            'sharpe_ratio': statistics.mean(results) / statistics.stdev(results) if statistics.stdev(results) > 0 else 0
        }
    
    def display_position_recommendations(self, positions: List[PositionSizing]) -> None:
        """Display position sizing recommendations"""
        
        table = Table(title="📊 Position Sizing Recommendations", box=box.ROUNDED)
        table.add_column("Ticker", style="cyan", no_wrap=True)
        table.add_column("Grade", justify="center")
        table.add_column("Contracts", justify="right")
        table.add_column("Max Loss", justify="right")
        table.add_column("Expected Return", justify="right")
        table.add_column("Kelly %", justify="right")
        table.add_column("Confidence", justify="right")
        table.add_column("Warnings", style="yellow")
        
        total_risk = 0
        
        for position in sorted(positions, key=lambda x: x.expected_value, reverse=True)[:20]:
            grade_style = {
                'S': 'bold green', 'A': 'bold blue', 'B': 'bold yellow',
                'C': 'bold orange', 'D': 'bold red', 'F': 'dim red'
            }.get(position.signal.grade, 'white')
            
            warnings_text = ", ".join(position.warnings[:2]) if position.warnings else "None"
            
            table.add_row(
                position.signal.ticker,
                f"[{grade_style}]{position.signal.grade}[/{grade_style}]",
                f"{position.recommended_size:.0f}",
                f"${position.max_loss:,.0f}",
                f"{position.expected_return:.1%}",
                f"{position.kelly_fraction:.1%}",
                f"{position.confidence_score:.2f}",
                warnings_text
            )
            
            total_risk += position.max_loss
        
        console.print(table)
        
        # Risk summary
        risk_pct = total_risk / self.params.account_size
        risk_color = "green" if risk_pct < 0.05 else "yellow" if risk_pct < 0.08 else "red"
        
        console.print()
        console.print(Panel.fit(
            f"[bold]Portfolio Risk Summary[/bold]\n"
            f"Total Max Risk: [{risk_color}]${total_risk:,.0f} ({risk_pct:.1%} of account)[/{risk_color}]\n"
            f"Risk Limit: ${self.params.account_size * self.params.max_portfolio_heat:,.0f} ({self.params.max_portfolio_heat:.1%})\n"
            f"Positions Analyzed: {len(positions)}",
            title="⚠️ Risk Management",
            border_style=risk_color
        ))
    
    def display_monte_carlo_results(self, mc_results: Dict[str, Any]) -> None:
        """Display Monte Carlo simulation results"""
        
        table = Table(title="🎲 Monte Carlo Simulation Results", box=box.ROUNDED)
        table.add_column("Metric", style="cyan")
        table.add_column("Value", justify="right")
        table.add_column("Interpretation", style="dim")
        
        table.add_row("Expected Return", f"{mc_results['mean_return']:.2%}", "Average portfolio return")
        table.add_row("Median Return", f"{mc_results['median_return']:.2%}", "50th percentile outcome")
        table.add_row("Standard Deviation", f"{mc_results['std_dev']:.2%}", "Return volatility")
        table.add_row("95% VaR", f"{mc_results['var_95']:.2%}", "5% chance of losing more")
        table.add_row("99% VaR", f"{mc_results['var_99']:.2%}", "1% chance of losing more")
        table.add_row("Maximum Loss", f"{mc_results['max_loss']:.2%}", "Worst case scenario")
        table.add_row("Maximum Gain", f"{mc_results['max_gain']:.2%}", "Best case scenario")
        table.add_row("Probability of Profit", f"{mc_results['prob_profit']:.1%}", "Chance of positive return")
        table.add_row("Sharpe Ratio", f"{mc_results['sharpe_ratio']:.2f}", "Risk-adjusted return")
        
        console.print(table)
        
        # Risk assessment
        risk_assessment = "LOW" if mc_results['var_95'] > -0.05 else "MEDIUM" if mc_results['var_95'] > -0.10 else "HIGH"
        risk_color = {"LOW": "green", "MEDIUM": "yellow", "HIGH": "red"}[risk_assessment]
        
        console.print()
        console.print(Panel.fit(
            f"[bold]Risk Assessment: [{risk_color}]{risk_assessment}[/{risk_color}][/bold]\n"
            f"Expected Return: {mc_results['mean_return']:.2%}\n"
            f"95% VaR: {mc_results['var_95']:.2%}\n"
            f"Win Probability: {mc_results['prob_profit']:.1%}",
            title="📈 Portfolio Outlook",
            border_style=risk_color
        ))
    
    async def run_analysis(self, days: int = 7, min_grade: str = 'B'):
        """Run the complete trade sizing analysis"""
        
        console.print(Panel.fit(
            "[bold blue]💰 Trade Sizing & Risk Management Analysis[/bold blue]\n"
            f"Account Size: ${self.params.account_size:,.0f}\n"
            f"Max Risk per Trade: {self.params.max_position_risk:.1%}\n"
            f"Max Portfolio Heat: {self.params.max_portfolio_heat:.1%}",
            border_style="blue"
        ))
        
        # Fetch signals
        await self.fetch_signals(days, min_grade)
        
        if not self.signals:
            console.print("[red]No tradeable signals found.[/red]")
            return
        
        # Calculate position sizing for each signal
        console.print("[blue]Calculating optimal position sizes...[/blue]")
        positions = []
        
        for signal in self.signals:
            position = self.calculate_position_sizing(signal)
            if position.expected_value > 0:  # Only positive expected value trades
                positions.append(position)
        
        if not positions:
            console.print("[yellow]No positions with positive expected value found.[/yellow]")
            return
        
        # Display recommendations
        console.print()
        self.display_position_recommendations(positions)
        
        # Run Monte Carlo simulation on top positions
        top_positions = sorted(positions, key=lambda x: x.expected_value, reverse=True)[:10]
        
        if len(top_positions) >= 3:
            console.print()
            mc_results = self.run_monte_carlo_simulation(top_positions)
            console.print()
            self.display_monte_carlo_results(mc_results)
        
        # Final recommendations
        console.print()
        console.print(Panel.fit(
            f"[bold green]Analysis Complete[/bold green]\n"
            f"• {len(positions)} tradeable opportunities identified\n"
            f"• {len([p for p in positions if p.signal.grade in ['S', 'A']])} high-grade signals\n"
            f"• {len([p for p in positions if p.expected_return > 0.2])} signals with >20% expected return\n"
            f"• Average Kelly fraction: {statistics.mean([p.kelly_fraction for p in positions]):.1%}",
            title="📊 Summary",
            border_style="green"
        ))

async def main():
    """Main function"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Calculate optimal position sizes for unusual options signals")
    parser.add_argument("--account-size", type=float, default=100000, help="Account size in dollars (default: 100000)")
    parser.add_argument("--max-risk", type=float, default=0.02, help="Max risk per trade as decimal (default: 0.02)")
    parser.add_argument("--days", type=int, default=7, help="Number of days to analyze (default: 7)")
    parser.add_argument("--min-grade", type=str, default="B", help="Minimum signal grade (default: B)")
    
    args = parser.parse_args()
    
    trading_params = TradingParameters(
        account_size=args.account_size,
        max_position_risk=args.max_risk
    )
    
    calculator = TradeSizingCalculator(trading_params)
    await calculator.run_analysis(days=args.days, min_grade=args.min_grade)

if __name__ == "__main__":
    asyncio.run(main())
