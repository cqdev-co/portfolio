"""CLI interface for analyze-options-service."""

import typer
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text
from rich import box
from typing import Optional, Annotated
from loguru import logger
import sys

from .config import load_config
from .fetcher import SignalFetcher
from .models.signal import EnrichedSignal
from .models.analysis import TechnicalIndicators
from .models.strategy import (
    StrategyComparison, 
    StrategyRecommendation,
    RecommendationTier
)
from .analyzers.strategy_recommender import StrategyRecommender
from .analyzers.signal_qa import SignalQAEngine

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
    Scan for trade opportunities with full analysis (Phase 1 + Phase 2).
    
    Shows technical filtering AND strategy recommendations for each signal.
    
    Example:
        analyze scan --days 7 --min-grade A
    """
    show_filtered = False
    console.print("\n[bold blue]🎯 Analyze Options Service - Full Analysis[/bold blue]")
    console.print("[dim]Scanning and analyzing strategies...[/dim]\n")
    
    try:
        # Load configuration
        config = load_config()
        
        # Create fetcher
        fetcher = SignalFetcher(config)
        
        # Fetch and filter signals (Phase 1)
        approved, filtered = fetcher.fetch_filtered_signals(
            min_grade=min_grade,
            lookback_days=days,
            show_filtered=show_filtered
        )
        
        if not approved:
            console.print("[yellow]No opportunities found matching criteria[/yellow]")
            return
        
        console.print(f"[green]✅ {len(approved)} safe opportunities found[/green]")
        console.print(f"[cyan]🔄 Analyzing strategies...[/cyan]\n")
        
        # Create strategy recommender (Phase 2)
        recommender = StrategyRecommender(
            account_size=config.default_account_size,
            risk_per_trade_pct=config.default_risk_pct,
            risk_tolerance=config.risk_tolerance
        )
        
        # Analyze strategies for each approved signal
        comparisons_data = []
        for signal, technical, filter_result in approved:
            comparison = recommender.recommend(signal, technical)
            comparisons_data.append((comparison, signal, technical, filter_result))
        
        # Rank all opportunities
        all_comparisons = [c[0] for c in comparisons_data]
        ranked = recommender.rank_opportunities(all_comparisons)
        
        # Create lookup for display
        comparison_lookup = {id(comp): (comp, sig, tech, filt) for comp, sig, tech, filt in comparisons_data}
        
        # Display all opportunities with strategy analysis
        console.print(f"[bold green]🏆 ALL OPPORTUNITIES (Ranked by Score):[/bold green]\n")
        
        for comparison in ranked:
            lookup_data = comparison_lookup.get(id(comparison))
            if lookup_data:
                _, signal, technical, filter_result = lookup_data
                display_signal(comparison.rank, signal, technical, filter_result, comparison)
        
        console.print(f"[dim]💡 Tip: Run 'analyze best' to see only high-confidence trades (score ≥ 85)[/dim]\n")
        
        # Summary stats
        console.print(f"[bold]📊 SUMMARY:[/bold]")
        console.print(f"  • Total Analyzed: {len(ranked)}")
        console.print(f"  • Average Score: {sum(c.composite_score for c in ranked)/len(ranked):.0f}/100")
        
        spread_count = sum(1 for c in ranked if c.recommended_strategy == StrategyRecommendation.VERTICAL_SPREAD)
        naked_count = sum(1 for c in ranked if c.recommended_strategy == StrategyRecommendation.NAKED_OPTION)
        
        console.print(f"  • Vertical Spreads: {spread_count}")
        console.print(f"  • Naked Options: {naked_count}")
        
        # Show filtered summary
        if filtered:
            console.print(f"\n[dim]🚫 Filtered {len(filtered)} signals for safety[/dim]")
            
            # Group by reason
            reasons = {}
            for _, _, result in filtered:
                reason = result.reason or "Unknown"
                reasons[reason] = reasons.get(reason, 0) + 1
            
            console.print("\n[bold yellow]📋 Top filter reasons:[/bold yellow]")
            for reason, count in list(sorted(reasons.items(), key=lambda x: -x[1]))[:3]:
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
    filter_result,
    comparison: Optional[StrategyComparison] = None
):
    """Display an approved signal with full context and optional strategy analysis."""
    
    # Create panel title
    score_text = f" - Score: {comparison.composite_score:.0f}/100" if comparison else ""
    title = (
        f"#{rank} - {signal.ticker} - "
        f"Grade {signal.grade} - {signal.sentiment.value}{score_text}"
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
    
    # Add strategy recommendation if available
    if comparison:
        content.append("")
        
        # Recommendation
        rec_emoji = {
            StrategyRecommendation.VERTICAL_SPREAD: "🎯",
            StrategyRecommendation.NAKED_OPTION: "🚀",
            StrategyRecommendation.SKIP: "⏭️"
        }
        emoji = rec_emoji.get(comparison.recommended_strategy, "")
        content.append(f"[bold cyan]{emoji} RECOMMENDED: {comparison.recommended_strategy.value}[/bold cyan]")
        
        # Quick metrics based on strategy
        if comparison.recommended_strategy == StrategyRecommendation.VERTICAL_SPREAD and comparison.spread:
            spread = comparison.spread
            content.append(f"[dim]Strategy: {spread.strategy_type.value}[/dim]")
            content.append(f"[dim]Cost: ${spread.cost_per_contract:.0f} | Max Profit: ${spread.profit_per_contract:.0f} | R:R 1:{spread.risk_reward_ratio:.1f}[/dim]")
            content.append(f"[dim]Probability: {spread.probability_profit:.0f}% | Contracts: {comparison.suggested_contracts}[/dim]")
        elif comparison.recommended_strategy == StrategyRecommendation.NAKED_OPTION and comparison.naked:
            naked = comparison.naked
            content.append(f"[dim]Strategy: {naked.strategy_type.value}[/dim]")
            content.append(f"[dim]Cost: ${naked.cost_per_contract:.0f} | Target: ${naked.potential_profit * 100:.0f} | R:R 1:{naked.risk_reward_ratio:.1f}[/dim]")
            content.append(f"[dim]Probability: {naked.probability_profit:.0f}% | Contracts: {comparison.suggested_contracts}[/dim]")
        elif comparison.recommended_strategy == StrategyRecommendation.SKIP:
            content.append(f"[dim]Reason: {comparison.recommendation_reason}[/dim]")
    
    # Create panel
    border_color = "green"
    if comparison:
        if comparison.composite_score >= 85:
            border_color = "bright_green"
        elif comparison.recommended_strategy == StrategyRecommendation.SKIP:
            border_color = "yellow"
    
    panel = Panel(
        "\n".join(content),
        title=title,
        border_style=border_color,
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


@app.command(name="all")
def all_cmd(
    days: int = 7,
    min_grade: str = "B"
):
    """
    Analyze ALL unusual options signals - comprehensive overview.
    
    Shows honest buy/skip recommendations for every signal.
    Categorizes signals into STRONG BUY, BUY, CONSIDER, and SKIP tiers.
    
    Example:
        analyze all --days 7 --min-grade B
        analyze all --days 3 --min-grade A
    """
    # Always show skip signals for comprehensive view
    show_skip = True
    console.print("\n[bold blue]🔍 Comprehensive Signal Analysis - ALL Signals[/bold blue]")
    console.print("[dim]Evaluating every signal with honest buy/skip recommendations...[/dim]\n")
    
    try:
        # Load configuration
        config = load_config()
        
        # Create fetcher
        fetcher = SignalFetcher(config)
        
        # Fetch ALL signals (no filtering yet)
        all_signals = fetcher.fetch_all_signals_for_analysis(
            lookback_days=days,
            min_grade=min_grade
        )
        
        if not all_signals:
            console.print("[yellow]No signals found in database[/yellow]")
            return
        
        console.print(f"[cyan]Analyzing {len(all_signals)} signals...[/cyan]\n")
        
        # Create strategy recommender
        recommender = StrategyRecommender(
            account_size=config.default_account_size,
            risk_per_trade_pct=config.default_risk_pct,
            risk_tolerance=config.risk_tolerance
        )
        
        # Analyze each signal
        all_comparisons = []
        for signal, technical in all_signals:
            comparison = recommender.recommend(signal, technical)
            all_comparisons.append((comparison, signal, technical))
        
        # Categorize by tier
        by_tier = {
            RecommendationTier.STRONG_BUY: [],
            RecommendationTier.BUY: [],
            RecommendationTier.CONSIDER: [],
            RecommendationTier.SKIP: []
        }
        
        for comparison, signal, technical in all_comparisons:
            tier = comparison.recommendation_tier or RecommendationTier.SKIP
            by_tier[tier].append((comparison, signal, technical))
        
        # Display summary header
        display_all_signals_summary(by_tier, days)
        
        # Display each tier
        if by_tier[RecommendationTier.STRONG_BUY]:
            console.print(f"\n[bold bright_green]🚀 STRONG BUY - High Conviction ({len(by_tier[RecommendationTier.STRONG_BUY])} signals)[/bold bright_green]")
            console.print("[dim]These are excellent setups worth immediate consideration[/dim]\n")
            display_tier_table(by_tier[RecommendationTier.STRONG_BUY], show_details=True)
        
        if by_tier[RecommendationTier.BUY]:
            console.print(f"\n[bold green]✅ BUY - Good Opportunities ({len(by_tier[RecommendationTier.BUY])} signals)[/bold green]")
            console.print("[dim]Viable trades with moderate conviction[/dim]\n")
            display_tier_table(by_tier[RecommendationTier.BUY], show_details=True)
        
        if by_tier[RecommendationTier.CONSIDER]:
            console.print(f"\n[bold yellow]⚠️  CONSIDER - Marginal Setups ({len(by_tier[RecommendationTier.CONSIDER])} signals)[/bold yellow]")
            console.print("[dim]Risky setups requiring extra research and caution[/dim]\n")
            display_tier_table(by_tier[RecommendationTier.CONSIDER], show_details=False)
        
        if show_skip and by_tier[RecommendationTier.SKIP]:
            console.print(f"\n[bold red]❌ SKIP - Don't Trade ({len(by_tier[RecommendationTier.SKIP])} signals)[/bold red]")
            console.print("[dim]These signals don't meet quality standards[/dim]\n")
            display_skip_table(by_tier[RecommendationTier.SKIP])
        
        # Final summary
        console.print(f"\n[bold]📊 FINAL SUMMARY:[/bold]")
        console.print(f"  • Total Signals Analyzed: {len(all_comparisons)}")
        console.print(f"  • Worth Trading (STRONG BUY + BUY): {len(by_tier[RecommendationTier.STRONG_BUY]) + len(by_tier[RecommendationTier.BUY])}")
        console.print(f"  • Marginal (CONSIDER): {len(by_tier[RecommendationTier.CONSIDER])}")
        console.print(f"  • Skip: {len(by_tier[RecommendationTier.SKIP])}")
        
        trade_rate = (len(by_tier[RecommendationTier.STRONG_BUY]) + len(by_tier[RecommendationTier.BUY])) / len(all_comparisons) * 100
        console.print(f"  • Quality Rate: {trade_rate:.1f}% worth trading\n")
        
    except Exception as e:
        error_msg = Text()
        error_msg.append("Error: ", style="bold red")
        error_msg.append(str(e))
        console.print(error_msg)
        logger.exception("All signals analysis failed")
        raise typer.Exit(1)


def display_all_signals_summary(by_tier: dict, days: int):
    """Display summary panel for all signals analysis."""
    strong_buy_count = len(by_tier[RecommendationTier.STRONG_BUY])
    buy_count = len(by_tier[RecommendationTier.BUY])
    consider_count = len(by_tier[RecommendationTier.CONSIDER])
    skip_count = len(by_tier[RecommendationTier.SKIP])
    total = strong_buy_count + buy_count + consider_count + skip_count
    
    summary_lines = [
        f"Analyzed {total} signals from last {days} days",
        "",
        f"🚀 {strong_buy_count} STRONG BUY | ✅ {buy_count} BUY | ⚠️  {consider_count} CONSIDER | ❌ {skip_count} SKIP"
    ]
    
    panel = Panel(
        "\n".join(summary_lines),
        title="ALL SIGNALS ANALYSIS",
        border_style="blue",
        box=box.DOUBLE
    )
    console.print(panel)


def display_tier_table(signals: list, show_details: bool = True):
    """Display table for STRONG BUY, BUY, or CONSIDER tiers."""
    table = Table(box=box.ROUNDED, width=140)
    table.add_column("Ticker", style="cyan", width=6)
    table.add_column("Gr", style="white", width=3)
    table.add_column("Sc", style="green", width=3)
    table.add_column("Strategy", style="white", width=16)
    table.add_column("Cost", style="yellow", width=7)
    table.add_column("P%", style="white", width=4)
    table.add_column("R:R", style="white", width=5)
    
    if show_details:
        table.add_column("Why Trade", style="dim", no_wrap=False)
    
    for comparison, signal, technical in signals:
        # Get strategy details
        if comparison.recommended_strategy == StrategyRecommendation.VERTICAL_SPREAD and comparison.spread:
            strategy = comparison.spread.strategy_type.value
            cost = f"${comparison.spread.cost_per_contract:.0f}" if comparison.spread.cost_per_contract else "N/A"
            prob = f"{comparison.spread.probability_profit:.0f}%" if comparison.spread.probability_profit else "N/A"
            rr = f"1:{comparison.spread.risk_reward_ratio:.1f}" if comparison.spread.risk_reward_ratio else "N/A"
        elif comparison.recommended_strategy == StrategyRecommendation.NAKED_OPTION and comparison.naked:
            strategy = comparison.naked.strategy_type.value
            cost = f"${comparison.naked.cost_per_contract:.0f}" if comparison.naked.cost_per_contract else "N/A"
            prob = f"{comparison.naked.probability_profit:.0f}%" if comparison.naked.probability_profit else "N/A"
            rr = f"1:{comparison.naked.risk_reward_ratio:.1f}" if comparison.naked.risk_reward_ratio else "N/A"
        else:
            strategy = "N/A"
            cost = "N/A"
            prob = "N/A"
            rr = "N/A"
        
        # Add row
        row = [
            signal.ticker,
            signal.grade,
            f"{comparison.composite_score:.0f}",
            strategy,
            cost,
            prob,
            rr
        ]
        
        if show_details:
            # Show full reason (will wrap in table)
            row.append(comparison.recommendation_reason)
        
        table.add_row(*row)
    
    console.print(table)


def display_skip_table(signals: list):
    """Display table for SKIP tier with skip reasons."""
    table = Table(box=box.ROUNDED)
    table.add_column("Ticker", style="cyan", width=8)
    table.add_column("Grade", style="white", width=6)
    table.add_column("Score", style="red", width=6)
    table.add_column("Skip Reasons", style="dim", width=60)
    
    for comparison, signal, technical in signals:
        # Get skip reasons
        if comparison.skip_reasons:
            reasons = " | ".join(comparison.skip_reasons[:2])  # Show first 2 reasons
            if len(comparison.skip_reasons) > 2:
                reasons += f" (+{len(comparison.skip_reasons) - 2} more)"
        else:
            reasons = comparison.recommendation_reason
        
        table.add_row(
            signal.ticker,
            signal.grade,
            f"{comparison.composite_score:.0f}",
            reasons
        )
    
    console.print(table)


@app.command(name="ask")
def ask_cmd(
    question: str,
    days: int = 7
):
    """
    Ask questions about unusual options signals.
    
    Get intelligent answers about signals, risks, comparisons, and more.
    
    Examples:
        analyze ask "Why should I trade AAPL?"
        analyze ask "What are the risks for TSLA?"
        analyze ask "Compare GOOGL vs MSFT"
        analyze ask "What's the best signal?"
    """
    console.print(f"\n[bold blue]🤔 Signal Q&A[/bold blue]")
    console.print(f"[dim]Question: {question}[/dim]\n")
    
    try:
        # Load configuration
        config = load_config()
        
        # Create fetcher
        fetcher = SignalFetcher(config)
        
        # Fetch ALL signals for context
        all_signals = fetcher.fetch_all_signals_for_analysis(lookback_days=days)
        
        if not all_signals:
            console.print("[yellow]No signals found in database[/yellow]")
            return
        
        console.print(f"[dim]Analyzing {len(all_signals)} signals...[/dim]\n")
        
        # Create strategy recommender
        recommender = StrategyRecommender(
            account_size=config.default_account_size,
            risk_per_trade_pct=config.default_risk_pct,
            risk_tolerance=config.risk_tolerance
        )
        
        # Analyze each signal
        signals_data = []
        for signal, technical in all_signals:
            comparison = recommender.recommend(signal, technical)
            signals_data.append((comparison, signal, technical))
        
        # Create Q&A engine
        qa_engine = SignalQAEngine(use_ai=False)  # Use template-based for now
        
        # Get answer
        response = qa_engine.ask(question, signals_data)
        
        # Display answer
        confidence_color = "green" if response.confidence >= 0.8 else "yellow" if response.confidence >= 0.6 else "red"
        confidence_text = f"[{confidence_color}]Confidence: {response.confidence*100:.0f}%[/{confidence_color}]"
        
        panel = Panel(
            response.answer,
            title=f"💡 Answer {confidence_text}",
            border_style="blue",
            box=box.ROUNDED
        )
        console.print(panel)
        
        # Show relevant signals if any
        if response.relevant_signals:
            console.print(f"\n[dim]📎 Relevant signals: {len(response.relevant_signals)}[/dim]")
        
        console.print()
        
    except Exception as e:
        error_msg = Text()
        error_msg.append("Error: ", style="bold red")
        error_msg.append(str(e))
        console.print(error_msg)
        logger.exception("Q&A failed")
        raise typer.Exit(1)


@app.command()
def entry(
    ticker: str,
    show_alternatives: bool = False
):
    """
    Get entry timing strategy recommendation for a signal.
    
    Analyzes signal characteristics and market conditions to recommend
    optimal entry approach (First Hour Fade, Confirmation Entry, etc.)
    
    Example:
        analyze entry --ticker AAPL
        analyze entry --ticker AAPL --show-alternatives
    """
    console.print(f"\n[bold blue]⏰ Entry Timing Strategy for {ticker}[/bold blue]\n")
    
    try:
        # Load configuration and fetch signal
        config = load_config()
        fetcher = SignalFetcher(config)
        
        # Fetch signals for this ticker
        console.print(f"[dim]Fetching signals for {ticker}...[/dim]")
        approved, _ = fetcher.fetch_filtered_signals(
            min_grade="B",
            lookback_days=7,
            show_filtered=False
        )
        
        # Find the signal for this ticker
        ticker_signal = None
        ticker_technical = None
        for signal, technical, _ in approved:
            if signal.ticker == ticker:
                ticker_signal = signal
                ticker_technical = technical
                break
        
        if not ticker_signal:
            console.print(f"[yellow]No active signals found for {ticker}[/yellow]")
            console.print("[dim]Try: analyze scan --days 7 to see available tickers[/dim]")
            return
        
        # Import here to avoid circular dependencies
        from .analyzers.entry_timing import EntryStrategySelector
        
        # Get entry recommendation
        selector = EntryStrategySelector()
        recommendation = selector.recommend_entry_strategy(
            ticker_signal,
            market_data={'technical': ticker_technical} if ticker_technical else None
        )
        
        # Display primary strategy
        strategy = recommendation.primary_strategy
        
        console.print(Panel(
            f"[bold]{strategy.name}[/bold]\n\n"
            f"{strategy.description}\n\n"
            f"[cyan]Timing:[/cyan] {strategy.timing}\n"
            f"[cyan]Risk Level:[/cyan] {strategy.risk_level}\n"
            f"[cyan]Best For:[/cyan] {strategy.best_for}",
            title=f"🎯 Recommended Strategy",
            border_style="green",
            box=box.ROUNDED
        ))
        
        # Execution steps
        console.print("\n[bold]📋 Execution Steps:[/bold]")
        for step in strategy.execution_steps:
            console.print(f"  {step}")
        
        # Pros and Cons
        console.print("\n[bold green]✅ Advantages:[/bold green]")
        for pro in strategy.pros:
            console.print(f"  • {pro}")
        
        console.print("\n[bold yellow]⚠️  Considerations:[/bold yellow]")
        for con in strategy.cons:
            console.print(f"  • {con}")
        
        # Recommendation reason
        console.print(f"\n[bold]💡 Why This Strategy:[/bold]")
        console.print(f"  {recommendation.recommendation_reason}")
        
        # Show alternatives if requested
        if show_alternatives and recommendation.alternative_strategies:
            console.print("\n[bold blue]🔄 Alternative Strategies:[/bold blue]")
            for alt in recommendation.alternative_strategies:
                console.print(f"\n  [cyan]• {alt.name}[/cyan]")
                console.print(f"    {alt.description}")
                console.print(f"    Best for: {alt.best_for}")
        
        console.print()
        
    except Exception as e:
        console.print(f"[bold red]Error:[/bold red] {str(e)}")
        logger.exception("Entry command failed")
        raise typer.Exit(1)


@app.command()
def validate(
    ticker: Optional[str] = None,
    all: bool = False,
    min_checks: int = 8
):
    """
    Validate signal(s) using 10-point pre-trade checklist.
    
    Checks technical, signal quality, and macro conditions before trading.
    
    Examples:
        analyze validate --ticker AAPL
        analyze validate --all
        analyze validate --ticker AAPL --min-checks 9
    """
    console.print(f"\n[bold blue]✅ Signal Validation (10-Point Checklist)[/bold blue]\n")
    
    try:
        # Load configuration and fetch signals
        config = load_config()
        fetcher = SignalFetcher(config)
        
        console.print(f"[dim]Fetching and validating signals...[/dim]\n")
        approved, _ = fetcher.fetch_filtered_signals(
            min_grade="B",
            lookback_days=7,
            show_filtered=False
        )
        
        if not approved:
            console.print("[yellow]No signals found[/yellow]")
            return
        
        # Filter by ticker if specified
        if ticker and not all:
            approved = [(s, t, f) for s, t, f in approved if s.ticker == ticker]
            if not approved:
                console.print(f"[yellow]No signals found for {ticker}[/yellow]")
                return
        
        # Import validator
        from .analyzers.validation_checklist import TradeValidator
        
        validator = TradeValidator()
        
        # Validate each signal
        passed_count = 0
        failed_count = 0
        
        for signal, technical, _ in approved:
            market_data = {'technical': technical} if technical else None
            result = validator.validate_trade(signal, market_data)
            
            # Status color
            if result.passed:
                status = f"[bold green]✅ PASS[/bold green]"
                passed_count += 1
            else:
                status = f"[bold red]❌ FAIL[/bold red]"
                failed_count += 1
            
            # Display result
            console.print(Panel(
                f"{status} | "
                f"{result.checks_passed}/{result.checks_total} checks | "
                f"Score: {result.score:.1%}\n\n"
                f"{result.recommendation}\n\n"
                f"[dim]{result.summary}[/dim]",
                title=f"📊 {result.ticker} (Grade {signal.grade})",
                border_style="green" if result.passed else "red",
                box=box.ROUNDED
            ))
            
            # Show failed checks if any
            failed_checks = [c for c in result.checks if not c.passed]
            if failed_checks:
                console.print("[yellow]Failed Checks:[/yellow]")
                for check in failed_checks:
                    console.print(f"  ❌ {check.name}: {check.reason}")
                console.print()
        
        # Summary
        console.print(f"\n[bold]Summary:[/bold]")
        console.print(f"  ✅ Passed: {passed_count}")
        console.print(f"  ❌ Failed: {failed_count}")
        console.print(f"  Total: {len(approved)}")
        console.print()
        
    except Exception as e:
        console.print(f"[bold red]Error:[/bold red] {str(e)}")
        logger.exception("Validation command failed")
        raise typer.Exit(1)


if __name__ == "__main__":
    app()

