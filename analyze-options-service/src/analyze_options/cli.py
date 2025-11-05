"""CLI interface for analyze-options-service."""

import typer
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text
from rich import box
from typing import Optional
from loguru import logger
import sys

from .config import load_config
from .fetcher import SignalFetcher
from .models.signal import EnrichedSignal
from .models.analysis import TechnicalIndicators
from .models.strategy import StrategyComparison, StrategyRecommendation
from .analyzers.strategy_recommender import StrategyRecommender

# Configure logger
logger.remove()
logger.add(sys.stderr, level="INFO")

app = typer.Typer(
    help="Analyze unusual options signals and generate trade recommendations",
    add_completion=False
)
console = Console()


@app.command()
def scan(
    days: int = 7,
    min_grade: str = "A",
):
    """
    Scan for trade opportunities with technical analysis filtering.
    
    Example:
        analyze scan --days 7 --min-grade A
    """
    # For now, always show filtered signals summary
    show_filtered = False
    console.print("\n[bold blue]🎯 Analyze Options Service[/bold blue]")
    console.print("[dim]Scanning for safe, high-conviction opportunities...[/dim]\n")
    
    try:
        # Load configuration
        config = load_config()
        
        # Create fetcher
        fetcher = SignalFetcher(config)
        
        # Fetch and filter signals
        approved, filtered = fetcher.fetch_filtered_signals(
            min_grade=min_grade,
            lookback_days=days,
            show_filtered=show_filtered
        )
        
        # Display approved signals
        if approved:
            console.print(f"\n[bold green]✅ {len(approved)} Safe Opportunities Found[/bold green]\n")
            
            for i, (signal, technical, filter_result) in enumerate(approved, 1):
                display_signal(i, signal, technical, filter_result)
        else:
            console.print("[yellow]No opportunities found matching criteria[/yellow]")
        
        # Display filtered signals if requested
        if show_filtered and filtered:
            console.print(f"\n[bold red]🚫 {len(filtered)} Signals Filtered Out[/bold red]\n")
            
            for signal, technical, filter_result in filtered:
                display_filtered_signal(signal, technical, filter_result)
        
        elif filtered and not show_filtered:
            # Show summary of filtered signals
            console.print(f"\n[dim]🚫 Filtered {len(filtered)} signals for safety[/dim]")
            
            # Group by reason
            reasons = {}
            for _, _, result in filtered:
                reason = result.reason or "Unknown"
                reasons[reason] = reasons.get(reason, 0) + 1
            
            console.print("\n[bold yellow]📋 Reasons signals were filtered:[/bold yellow]")
            for reason, count in sorted(reasons.items(), key=lambda x: -x[1]):
                console.print(f"  • {count}x: {reason}")
        
        console.print()
        
    except Exception as e:
        # Use Text to properly format error without parsing markup in the exception message
        error_msg = Text()
        error_msg.append("Error: ", style="bold red")
        error_msg.append(str(e))
        console.print(error_msg)
        logger.exception("Scan failed")
        raise typer.Exit(1)


def display_signal(
    rank: int,
    signal: EnrichedSignal,
    technical: TechnicalIndicators,
    filter_result
):
    """Display an approved signal with full context."""
    
    # Create panel title
    title = (
        f"#{rank} - {signal.ticker} - "
        f"Grade {signal.grade} - {signal.sentiment.value}"
    )
    
    # Build content
    content = []
    
    # Basic info
    content.append(f"[bold]Option:[/bold] {signal.option_type.upper()} ${signal.strike} exp {signal.expiry}")
    content.append(f"[bold]Premium Flow:[/bold] ${signal.premium_flow:,.0f}")
    content.append(f"[bold]Days to Expiry:[/bold] {signal.days_to_expiry}")
    if signal.days_to_earnings:
        content.append(f"[bold]Days to Earnings:[/bold] {signal.days_to_earnings} 📊")
    
    content.append("")
    
    # Technical Health Check
    content.append("[bold cyan]📊 TECHNICAL HEALTH CHECK:[/bold cyan]")
    content.append(f"  {filter_result.rsi_status}")
    content.append(f"  {filter_result.trend_status}")
    content.append(f"  {filter_result.momentum_status}")
    content.append(f"  {filter_result.volume_status}")
    
    content.append("")
    
    # Current price
    price_change = ((technical.price - signal.underlying_price) / signal.underlying_price) * 100
    price_indicator = "📈" if price_change > 0 else "📉" if price_change < 0 else "➡️"
    content.append(
        f"[bold]Current Price:[/bold] ${technical.price:.2f} "
        f"{price_indicator} ({price_change:+.1f}% since signal)"
    )
    
    content.append("")
    content.append("[dim]💡 Full analysis coming in Phase 2[/dim]")
    content.append("[dim]   Will show: Spread vs Naked, Position Size, P(Profit), R:R[/dim]")
    
    # Create panel
    panel = Panel(
        "\n".join(content),
        title=title,
        border_style="green",
        box=box.ROUNDED
    )
    
    console.print(panel)
    console.print()


def display_filtered_signal(
    signal: EnrichedSignal,
    technical: Optional[TechnicalIndicators],
    filter_result
):
    """Display a filtered signal with reason."""
    
    content = []
    content.append(f"[bold]{signal.ticker}[/bold] - Grade {signal.grade} - {signal.sentiment.value}")
    content.append(f"[red]❌ Filtered:[/red] {filter_result.reason}")
    
    if technical:
        content.append("")
        content.append(f"  Price: ${technical.price:.2f}")
        content.append(f"  RSI: {technical.rsi:.0f}")
        content.append(f"  50-day MA: ${technical.ma_50:.2f}")
        content.append(f"  Volume: {technical.volume_ratio:.1f}x avg")
    
    panel = Panel(
        "\n".join(content),
        border_style="red",
        box=box.ROUNDED
    )
    
    console.print(panel)


def display_strategy_recommendation(
    comparison: StrategyComparison,
    technical: TechnicalIndicators
):
    """Display strategy analysis and recommendation."""
    
    # Create panel title
    title = (
        f"#{comparison.rank} - {comparison.ticker} - "
        f"Grade {comparison.signal_grade} - Score: {comparison.composite_score:.0f}/100"
    )
    
    content = []
    
    # Recommendation header
    rec_emoji = {
        StrategyRecommendation.VERTICAL_SPREAD: "🎯",
        StrategyRecommendation.NAKED_OPTION: "🚀",
        StrategyRecommendation.SKIP: "⏭️"
    }
    
    emoji = rec_emoji.get(comparison.recommended_strategy, "")
    content.append(f"[bold cyan]{emoji} RECOMMENDATION: {comparison.recommended_strategy.value}[/bold cyan]")
    content.append(f"[dim]{comparison.recommendation_reason}[/dim]")
    content.append("")
    
    # Strategy details
    if comparison.recommended_strategy == StrategyRecommendation.VERTICAL_SPREAD and comparison.spread:
        spread = comparison.spread
        content.append(f"[bold]Strategy:[/bold] {spread.strategy_type.value}")
        content.append(f"[bold]Buy:[/bold] ${spread.buy_strike} @ ${spread.buy_premium:.2f}")
        content.append(f"[bold]Sell:[/bold] ${spread.sell_strike} @ ${spread.sell_premium:.2f}")
        content.append(f"[bold]Net Debit:[/bold] ${spread.net_debit:.2f} (${spread.cost_per_contract:.0f} per contract)")
        content.append("")
        content.append(f"[bold green]Max Profit:[/bold green] ${spread.max_profit:.2f} (${spread.profit_per_contract:.0f} per contract)")
        content.append(f"[bold red]Max Loss:[/bold red] ${spread.max_loss:.2f} (${spread.cost_per_contract:.0f} per contract)")
        content.append(f"[bold]Risk/Reward:[/bold] 1:{spread.risk_reward_ratio:.2f}")
        content.append(f"[bold]Breakeven:[/bold] ${spread.breakeven_price:.2f} ({spread.breakeven_pct:+.1f}%)")
        content.append(f"[bold]Probability:[/bold] {spread.probability_profit:.0f}%")
        
        # Show warnings if any
        if spread.warnings:
            content.append("")
            for warning in spread.warnings:
                content.append(warning)
    
    elif comparison.recommended_strategy == StrategyRecommendation.NAKED_OPTION and comparison.naked:
        naked = comparison.naked
        content.append(f"[bold]Strategy:[/bold] {naked.strategy_type.value}")
        content.append(f"[bold]Strike:[/bold] ${naked.strike}")
        content.append(f"[bold]Premium:[/bold] ${naked.premium:.2f} (${naked.cost_per_contract:.0f} per contract)")
        content.append(f"[bold]Moneyness:[/bold] {naked.moneyness}")
        content.append("")
        content.append(f"[bold green]Target Profit:[/bold green] ${naked.potential_profit:.2f} ({naked.risk_reward_ratio:.1f}x return)")
        content.append(f"[bold red]Max Loss:[/bold red] ${naked.max_loss:.2f} (100% of premium)")
        content.append(f"[bold]Breakeven:[/bold] ${naked.breakeven_price:.2f} ({naked.breakeven_pct:+.1f}%)")
        content.append(f"[bold]Probability:[/bold] {naked.probability_profit:.0f}%")
        
        # Greeks if available
        if naked.delta:
            content.append("")
            content.append(f"[dim]Delta: {naked.delta:.3f} | Theta: {naked.theta:.3f if naked.theta else 'N/A'}[/dim]")
        
        # Show warnings
        if naked.warnings:
            content.append("")
            for warning in naked.warnings:
                content.append(warning)
    
    # Position sizing
    content.append("")
    content.append("[bold cyan]📊 POSITION SIZING:[/bold cyan]")
    content.append(f"  Suggested Contracts: {comparison.suggested_contracts}")
    content.append(f"  Capital Required: ${comparison.suggested_capital:.0f}")
    content.append(f"  Max Risk: ${comparison.risk_per_trade:.0f} ({(comparison.risk_per_trade/10000)*100:.1f}% of account)")
    
    # Current price
    content.append("")
    content.append(f"[bold]Current Price:[/bold] ${technical.price:.2f}")
    
    # Determine border color based on recommendation
    border_color = "green" if comparison.recommended_strategy != StrategyRecommendation.SKIP else "yellow"
    
    panel = Panel(
        "\n".join(content),
        title=title,
        border_style=border_color,
        box=box.ROUNDED
    )
    
    console.print(panel)
    console.print()


@app.command(name="best")
def best_cmd(
    days: int = 7,
    top_n: int = 5,
):
    """
    Show ONLY the best of the best opportunities (HIGH CONFIDENCE).
    
    Applies strict quality filters:
    - Score >= 85 (excellent only)
    - Probability >= 50%
    - Risk/Reward >= 2:1
    - S or A grade only
    
    Example:
        analyze best
        analyze best --top-n 3
    """
    console.print("\n[bold blue]🏆 Best of the Best - High Confidence Opportunities[/bold blue]")
    console.print("[dim]Applying strict quality filters for top-tier setups...[/dim]\n")
    
    try:
        # Load configuration
        config = load_config()
        
        # Create fetcher (always use A+ grades for best)
        fetcher = SignalFetcher(config)
        
        # Fetch and filter signals
        approved, filtered = fetcher.fetch_filtered_signals(
            min_grade="A",  # A or better
            lookback_days=days
        )
        
        if not approved:
            console.print("[yellow]No opportunities found matching criteria[/yellow]")
            return
        
        # Create strategy recommender
        recommender = StrategyRecommender(
            account_size=config.default_account_size,
            risk_per_trade_pct=config.default_risk_pct,
            risk_tolerance=config.risk_tolerance
        )
        
        # Analyze strategies
        console.print(f"[cyan]Analyzing {len(approved)} safe signals...[/cyan]")
        comparisons = []
        
        for signal, technical, filter_result in approved:
            comparison = recommender.recommend(signal, technical)
            comparisons.append((comparison, technical))
        
        # Apply STRICT quality filters for "best of the best"
        all_comparisons = [c[0] for c in comparisons]
        ranked = recommender.rank_opportunities(all_comparisons)
        
        # Filter for HIGH QUALITY only
        best_opportunities = []
        for comparison in ranked:
            # Must have excellent score
            if comparison.composite_score < 85:
                continue
            
            # Must have good probability
            if comparison.recommended_strategy == StrategyRecommendation.VERTICAL_SPREAD:
                if comparison.spread and (comparison.spread.probability_profit or 0) < 50:
                    continue
                if comparison.spread and (comparison.spread.risk_reward_ratio or 0) < 2.0:
                    continue
            elif comparison.recommended_strategy == StrategyRecommendation.NAKED_OPTION:
                if comparison.naked and (comparison.naked.probability_profit or 0) < 45:
                    continue
                if comparison.naked and (comparison.naked.risk_reward_ratio or 0) < 2.0:
                    continue
            
            # Must be S or high-quality A grade
            if comparison.signal_grade == "B" or comparison.signal_grade == "C":
                continue
            
            best_opportunities.append(comparison)
        
        if not best_opportunities:
            console.print("[yellow]No opportunities meet the strict 'best of the best' criteria[/yellow]")
            console.print("[dim]Tip: Try 'analyze strategies' to see all viable opportunities[/dim]")
            return
        
        # Re-rank the filtered set
        for i, comparison in enumerate(best_opportunities, 1):
            comparison.rank = i
        
        # Show top N
        top_best = best_opportunities[:top_n]
        
        console.print(f"\n[bold green]🌟 TOP {len(top_best)} HIGH-CONFIDENCE OPPORTUNITIES:[/bold green]")
        console.print(f"[dim]Filtered from {len(ranked)} total opportunities[/dim]\n")
        
        # Create mapping back to technical indicators
        comparison_map = {id(c[0]): c[1] for c in comparisons}
        
        for comparison in top_best:
            technical = comparison_map.get(id(comparison))
            if technical:
                display_strategy_recommendation(comparison, technical)
        
        # Summary with quality metrics
        console.print(f"[bold]📊 QUALITY SUMMARY:[/bold]")
        console.print(f"  • High-Confidence Opportunities: {len(best_opportunities)}")
        console.print(f"  • Filtered Out: {len(ranked) - len(best_opportunities)}")
        console.print(f"  • Average Score: {sum(c.composite_score for c in best_opportunities)/len(best_opportunities):.0f}/100")
        console.print(f"  • Success Rate: {len(best_opportunities)/len(ranked)*100:.1f}%")
        
        spread_count = sum(1 for c in best_opportunities if c.recommended_strategy == StrategyRecommendation.VERTICAL_SPREAD)
        naked_count = sum(1 for c in best_opportunities if c.recommended_strategy == StrategyRecommendation.NAKED_OPTION)
        
        console.print(f"\n  • Vertical Spreads: {spread_count}")
        console.print(f"  • Naked Options: {naked_count}")
        
        # Show quality thresholds
        console.print(f"\n[dim]Quality Thresholds Applied:[/dim]")
        console.print(f"[dim]  ✓ Score ≥ 85/100[/dim]")
        console.print(f"[dim]  ✓ Probability ≥ 50% (spreads) / 45% (naked)[/dim]")
        console.print(f"[dim]  ✓ Risk/Reward ≥ 2:1[/dim]")
        console.print(f"[dim]  ✓ Grade A or S only[/dim]")
        console.print()
        
    except Exception as e:
        # Use Text to properly format error without parsing markup in the exception message
        error_msg = Text()
        error_msg.append("Error: ", style="bold red")
        error_msg.append(str(e))
        console.print(error_msg)
        logger.exception("Best opportunities analysis failed")
        raise typer.Exit(1)


@app.command(name="strategies")
def strategies_cmd(
    days: int = 7,
    min_grade: str = "A",
    top_n: int = 10,
):
    """
    Analyze strategies for safe opportunities (Phase 2).
    
    Compares vertical spreads vs naked options for each signal.
    
    Example:
        analyze strategies --days 7 --top-n 10
    """
    console.print("\n[bold blue]🎯 Analyze Options Service - Strategy Analysis (Phase 2)[/bold blue]")
    console.print("[dim]Analyzing vertical spreads vs naked options...[/dim]\n")
    
    try:
        # Load configuration
        config = load_config()
        
        # Create fetcher
        fetcher = SignalFetcher(config)
        
        # Fetch and filter signals
        approved, filtered = fetcher.fetch_filtered_signals(
            min_grade=min_grade,
            lookback_days=days
        )
        
        if not approved:
            console.print("[yellow]No opportunities found matching criteria[/yellow]")
            return
        
        console.print(f"[green]✅ {len(approved)} safe opportunities found[/green]")
        console.print(f"[dim]🚫 {len(filtered)} signals filtered for safety[/dim]\n")
        
        # Create strategy recommender
        recommender = StrategyRecommender(
            account_size=config.default_account_size,
            risk_per_trade_pct=config.default_risk_pct,
            risk_tolerance=config.risk_tolerance
        )
        
        # Analyze strategies for each signal
        console.print(f"[cyan]Analyzing strategies for {len(approved)} signals...[/cyan]\n")
        comparisons = []
        
        for signal, technical, filter_result in approved:
            comparison = recommender.recommend(signal, technical)
            comparisons.append((comparison, technical))
        
        # Rank all opportunities
        all_comparisons = [c[0] for c in comparisons]
        ranked = recommender.rank_opportunities(all_comparisons)
        
        # Display top N recommendations
        top_comparisons = ranked[:top_n]
        
        console.print(f"\n[bold green]🏆 TOP {len(top_comparisons)} RECOMMENDATIONS:[/bold green]\n")
        
        # Create mapping back to technical indicators
        comparison_map = {id(c[0]): c[1] for c in comparisons}
        
        for comparison in top_comparisons:
            technical = comparison_map.get(id(comparison))
            if technical:
                display_strategy_recommendation(comparison, technical)
        
        # Summary
        console.print(f"[bold]📊 SUMMARY:[/bold]")
        spread_count = sum(1 for c in ranked if c.recommended_strategy == StrategyRecommendation.VERTICAL_SPREAD)
        naked_count = sum(1 for c in ranked if c.recommended_strategy == StrategyRecommendation.NAKED_OPTION)
        
        console.print(f"  • Vertical Spreads Recommended: {spread_count}")
        console.print(f"  • Naked Options Recommended: {naked_count}")
        console.print(f"  • Total Viable Opportunities: {len(ranked)}")
        console.print(f"  • Average Score: {sum(c.composite_score for c in ranked)/len(ranked) if ranked else 0:.0f}/100")
        console.print()
        
    except Exception as e:
        # Use Text to properly format error without parsing markup in the exception message
        error_msg = Text()
        error_msg.append("Error: ", style="bold red")
        error_msg.append(str(e))
        console.print(error_msg)
        logger.exception("Strategy analysis failed")
        raise typer.Exit(1)


@app.command()
def info():
    """Show configuration and system info."""
    
    try:
        config = load_config()
        
        table = Table(title="Configuration", box=box.ROUNDED)
        table.add_column("Setting", style="cyan")
        table.add_column("Value", style="white")
        
        table.add_row("Account Size", f"${config.default_account_size:,.0f}")
        table.add_row("Risk per Trade", f"{config.default_risk_pct}%")
        table.add_row("Risk Tolerance", config.risk_tolerance)
        table.add_row("Min Signal Grade", config.min_signal_grade)
        table.add_row("Lookback Days", str(config.default_lookback_days))
        table.add_row("Min Premium Flow", f"${config.min_premium_flow:,.0f}")
        table.add_row("DTE Range", f"{config.min_dte} - {config.max_dte} days")
        table.add_row("RSI Overbought", str(config.rsi_overbought))
        table.add_row("RSI Oversold", str(config.rsi_oversold))
        
        console.print(table)
        
    except Exception as e:
        console.print(f"[bold red]Error loading config: {e}[/bold red]")
        raise typer.Exit(1)


if __name__ == "__main__":
    app()

