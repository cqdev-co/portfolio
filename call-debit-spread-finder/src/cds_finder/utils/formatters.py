"""Rich formatting utilities for CLI output."""

from typing import List
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text
from rich import box

from ..models.analysis import CallDebitSpreadOpportunity


def format_opportunity_table(
    opportunities: List[CallDebitSpreadOpportunity],
    console: Console,
) -> Table:
    """Format opportunities as a Rich table."""
    table = Table(
        title="Call Debit Spread Opportunities",
        box=box.ROUNDED,
        show_header=True,
        header_style="bold magenta",
    )
    
    table.add_column("Rank", style="cyan", width=5)
    table.add_column("Ticker", style="bold green", width=8)
    table.add_column("Grade", style="yellow", width=6)
    table.add_column("Score", style="cyan", width=6)
    table.add_column("Confidence", width=10)
    table.add_column("POP", style="green", width=6)
    table.add_column("R:R", style="green", width=6)
    table.add_column("Net Debit", style="yellow", width=10)
    table.add_column("Max Profit", style="green", width=10)
    table.add_column("Recommendation", width=12)
    
    for idx, opp in enumerate(opportunities, 1):
        confidence_emoji = {
            "GOLDEN": "🚀",
            "HIGH": "✅",
            "MODERATE": "⚠️",
            "LOW": "❌",
        }.get(opp.confidence_level, "❓")
        
        table.add_row(
            str(idx),
            opp.ticker,
            opp.signal.grade,
            f"{opp.composite_score:.1f}",
            f"{confidence_emoji} {opp.confidence_level}",
            f"{opp.options.probability_of_profit:.0f}%",
            f"{opp.options.risk_reward_ratio:.2f}:1",
            f"${opp.options.net_debit * 100:.0f}",
            f"${opp.options.max_profit * 100:.0f}",
            opp.recommendation,
        )
    
    return table


def format_opportunity_detail(
    opportunity: CallDebitSpreadOpportunity,
    console: Console,
) -> Panel:
    """Format detailed opportunity view."""
    opp = opportunity
    
    # Build detail text
    detail_lines = []
    
    # Header
    detail_lines.append(f"[bold cyan]{opp.ticker}[/bold cyan] - {opp.signal.grade} Grade")
    detail_lines.append("")
    
    # Signal Info
    detail_lines.append("[bold]Signal Information:[/bold]")
    detail_lines.append(f"  Grade: {opp.signal.grade}")
    detail_lines.append(f"  Premium Flow: ${opp.signal.premium_flow:,.0f}")
    detail_lines.append(f"  Volume Ratio: {opp.signal.volume_ratio:.2f}x" if opp.signal.volume_ratio else "  Volume Ratio: N/A")
    detail_lines.append(f"  Overall Score: {opp.signal.overall_score:.3f}")
    if opp.signal.has_sweep:
        detail_lines.append("  ✓ Sweep orders detected")
    if opp.signal.has_block_trade:
        detail_lines.append("  ✓ Block trades detected")
    detail_lines.append("")
    
    # Spread Details
    detail_lines.append("[bold]Call Debit Spread:[/bold]")
    detail_lines.append(f"  Long Strike: ${opp.options.long_strike:.2f}")
    detail_lines.append(f"  Short Strike: ${opp.options.short_strike:.2f}")
    detail_lines.append(f"  Strike Width: ${opp.options.strike_width:.2f}")
    detail_lines.append(f"  Net Debit: ${opp.options.net_debit * 100:.2f} per spread")
    detail_lines.append(f"  Max Profit: ${opp.options.max_profit * 100:.2f} per spread")
    detail_lines.append(f"  Max Loss: ${opp.options.max_loss * 100:.2f} per spread")
    detail_lines.append(f"  Risk/Reward: {opp.options.risk_reward_ratio:.2f}:1")
    detail_lines.append(f"  Breakeven: ${opp.options.breakeven_price:.2f} ({opp.options.breakeven_pct:+.1f}%)")
    detail_lines.append(f"  Probability of Profit: {opp.options.probability_of_profit:.1f}%")
    detail_lines.append("")
    
    # Analysis Scores
    detail_lines.append("[bold]Analysis Scores:[/bold]")
    detail_lines.append(f"  Technical: {opp.technical.score:.1f}/100")
    detail_lines.append(f"  Options: {opp.options.score:.1f}/100")
    detail_lines.append(f"  Fundamental: {opp.fundamental.score:.1f}/100")
    detail_lines.append(f"  [bold]Composite: {opp.composite_score:.1f}/100[/bold]")
    detail_lines.append("")
    
    # Technical Details
    detail_lines.append("[bold]Technical Analysis:[/bold]")
    detail_lines.append(f"  RSI: {opp.technical.rsi:.1f} ({opp.technical.rsi_signal})")
    detail_lines.append(f"  Trend: {opp.technical.trend}")
    detail_lines.append(f"  Price vs SMA20: {opp.technical.price_vs_sma20:+.1f}%")
    detail_lines.append(f"  Momentum (5d): {opp.technical.momentum_5d:+.1f}%")
    detail_lines.append("")
    
    # Options Details
    detail_lines.append("[bold]Options Analysis:[/bold]")
    if opp.options.iv_rank:
        detail_lines.append(f"  IV Rank: {opp.options.iv_rank:.1f}")
    if opp.options.delta:
        detail_lines.append(f"  Delta: {opp.options.delta:.2f}")
    detail_lines.append(f"  Days to Expiry: {opp.signal.days_to_expiry}")
    detail_lines.append("")
    
    # Reasons
    if opp.reasons:
        detail_lines.append("[bold green]Reasons to Trade:[/bold green]")
        for reason in opp.reasons:
            detail_lines.append(f"  ✓ {reason}")
        detail_lines.append("")
    
    # Warnings
    if opp.warnings:
        detail_lines.append("[bold yellow]Warnings:[/bold yellow]")
        for warning in opp.warnings:
            detail_lines.append(f"  ⚠ {warning}")
        detail_lines.append("")
    
    # Recommendation
    confidence_color = {
        "GOLDEN": "bold green",
        "HIGH": "green",
        "MODERATE": "yellow",
        "LOW": "red",
    }.get(opp.confidence_level, "white")
    
    detail_lines.append(f"[{confidence_color}]Recommendation: {opp.recommendation}[/{confidence_color}]")
    
    detail_text = "\n".join(detail_lines)
    
    return Panel(
        detail_text,
        title=f"[bold]{opp.ticker} - {opp.confidence_level} Confidence[/bold]",
        border_style="cyan",
        padding=(1, 2),
    )


def format_summary_stats(
    opportunities: List[CallDebitSpreadOpportunity],
    console: Console,
) -> Panel:
    """Format summary statistics."""
    if not opportunities:
        return Panel("No opportunities found", title="Summary")
    
    total = len(opportunities)
    golden = sum(1 for o in opportunities if o.confidence_level == "GOLDEN")
    high = sum(1 for o in opportunities if o.confidence_level == "HIGH")
    moderate = sum(1 for o in opportunities if o.confidence_level == "MODERATE")
    low = sum(1 for o in opportunities if o.confidence_level == "LOW")
    
    avg_score = sum(o.composite_score for o in opportunities) / total
    avg_pop = sum(o.options.probability_of_profit for o in opportunities) / total
    avg_rr = sum(o.options.risk_reward_ratio for o in opportunities) / total
    
    stats_text = f"""
Total Opportunities: {total}
🚀 Golden: {golden} | ✅ High: {high} | ⚠️ Moderate: {moderate} | ❌ Low: {low}

Average Composite Score: {avg_score:.1f}
Average Probability of Profit: {avg_pop:.1f}%
Average Risk/Reward Ratio: {avg_rr:.2f}:1
"""
    
    return Panel(stats_text, title="Summary Statistics", border_style="green")

