"""Script to analyze penny stock scanner performance from database."""

import asyncio
import os
from datetime import date, timedelta
from collections import defaultdict
from supabase import create_client
from dotenv import load_dotenv
from rich.console import Console
from rich.table import Table
from rich.panel import Panel

# Load environment variables
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv(
    "NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY"
)

console = Console()


def get_client():
    """Get Supabase client."""
    if not SUPABASE_URL or not SUPABASE_KEY:
        console.print(
            "[red]Error: Supabase credentials not found in environment variables[/red]"
        )
        console.print("Looking for: SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL")
        console.print(
            "Looking for: SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY"
        )
        return None
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def analyze_signals():
    """Analyze signals from penny_stock_signals table."""
    client = get_client()
    if not client:
        return

    console.print(
        "\n[bold blue]📊 Penny Stock Scanner Performance Analysis[/bold blue]\n"
    )

    # Get all signals
    try:
        response = (
            client.table("penny_stock_signals")
            .select("*")
            .order("scan_date", desc=True)
            .execute()
        )
        signals = response.data or []
    except Exception as e:
        console.print(f"[red]Error fetching signals: {e}[/red]")
        return

    if not signals:
        console.print("[yellow]No signals found in database[/yellow]")
        return

    # === Basic Stats ===
    console.print(
        Panel(
            f"Total Signals in Database: [bold]{len(signals)}[/bold]",
            title="📈 Signal Volume",
        )
    )

    # Date range
    dates = [s["scan_date"] for s in signals]
    earliest = min(dates)
    latest = max(dates)
    console.print(f"Date Range: {earliest} to {latest}")

    # === Signals by Date ===
    signals_by_date = defaultdict(int)
    for s in signals:
        signals_by_date[s["scan_date"]] += 1

    recent_dates = sorted(signals_by_date.keys(), reverse=True)[:14]

    date_table = Table(title="📅 Recent Signal Counts")
    date_table.add_column("Date", style="cyan")
    date_table.add_column("Signals", justify="right")
    date_table.add_column("Avg Score", justify="right")

    for d in recent_dates:
        day_signals = [s for s in signals if s["scan_date"] == d]
        avg_score = (
            sum(s["overall_score"] for s in day_signals) / len(day_signals)
            if day_signals
            else 0
        )
        date_table.add_row(d, str(len(day_signals)), f"{avg_score:.3f}")

    console.print(date_table)

    # === Distribution by Rank ===
    rank_counts = defaultdict(int)
    rank_scores = defaultdict(list)
    for s in signals:
        rank = s.get("opportunity_rank", "Unknown")
        rank_counts[rank] += 1
        rank_scores[rank].append(s.get("overall_score", 0))

    rank_table = Table(title="🏆 Signal Distribution by Rank")
    rank_table.add_column("Rank", style="magenta")
    rank_table.add_column("Count", justify="right")
    rank_table.add_column("% of Total", justify="right")
    rank_table.add_column("Avg Score", justify="right")

    for rank in ["S", "A", "B", "C", "D"]:
        if rank in rank_counts:
            pct = rank_counts[rank] / len(signals) * 100
            avg = (
                sum(rank_scores[rank]) / len(rank_scores[rank])
                if rank_scores[rank]
                else 0
            )
            rank_table.add_row(
                f"{rank}-Tier", str(rank_counts[rank]), f"{pct:.1f}%", f"{avg:.3f}"
            )

    console.print(rank_table)

    # === Recommendation Distribution ===
    rec_counts = defaultdict(int)
    for s in signals:
        rec = s.get("recommendation", "Unknown")
        rec_counts[rec] += 1

    rec_table = Table(title="💡 Recommendation Distribution")
    rec_table.add_column("Recommendation", style="yellow")
    rec_table.add_column("Count", justify="right")
    rec_table.add_column("% of Total", justify="right")

    for rec in sorted(rec_counts.keys()):
        pct = rec_counts[rec] / len(signals) * 100
        rec_table.add_row(rec, str(rec_counts[rec]), f"{pct:.1f}%")

    console.print(rec_table)

    # === Breakout vs Consolidation Stats ===
    breakout_count = sum(1 for s in signals if s.get("is_breakout"))
    consolidating_count = sum(1 for s in signals if s.get("is_consolidating"))
    higher_lows_count = sum(1 for s in signals if s.get("higher_lows_detected"))

    setup_table = Table(title="🔬 Setup Pattern Analysis")
    setup_table.add_column("Pattern", style="blue")
    setup_table.add_column("Count", justify="right")
    setup_table.add_column("% of Signals", justify="right")

    setup_table.add_row(
        "Breakouts 🚀",
        str(breakout_count),
        f"{breakout_count / len(signals) * 100:.1f}%",
    )
    setup_table.add_row(
        "Consolidating 📦",
        str(consolidating_count),
        f"{consolidating_count / len(signals) * 100:.1f}%",
    )
    setup_table.add_row(
        "Higher Lows 📈",
        str(higher_lows_count),
        f"{higher_lows_count / len(signals) * 100:.1f}%",
    )

    console.print(setup_table)

    # === Volume Analysis ===
    volume_ratios = [s.get("volume_ratio", 0) for s in signals if s.get("volume_ratio")]
    volume_spikes = [
        s.get("volume_spike_factor", 0) for s in signals if s.get("volume_spike_factor")
    ]

    if volume_ratios:
        console.print("\n[bold]📊 Volume Analysis:[/bold]")
        console.print(
            f"  Avg Volume Ratio: {sum(volume_ratios) / len(volume_ratios):.2f}x"
        )
        console.print(f"  Max Volume Ratio: {max(volume_ratios):.2f}x")
        console.print(
            f"  Signals with 2x+ Volume: {sum(1 for v in volume_ratios if v >= 2)}"
        )
        console.print(
            f"  Signals with 3x+ Volume: {sum(1 for v in volume_ratios if v >= 3)}"
        )
        console.print(
            f"  Signals with 5x+ Volume: {sum(1 for v in volume_ratios if v >= 5)}"
        )

    # === Signal Continuity Stats ===
    status_counts = defaultdict(int)
    for s in signals:
        status = s.get("signal_status", "Unknown")
        status_counts[status] += 1

    console.print("\n[bold]🔄 Signal Continuity:[/bold]")
    for status, count in sorted(status_counts.items()):
        console.print(f"  {status}: {count} ({count / len(signals) * 100:.1f}%)")

    # Average days active
    days_active = [s.get("days_active", 0) for s in signals]
    if days_active:
        console.print(f"  Avg Days Active: {sum(days_active) / len(days_active):.1f}")
        console.print(f"  Max Days Active: {max(days_active)}")

    # === Top Symbols (Most Frequent) ===
    symbol_counts = defaultdict(int)
    for s in signals:
        symbol_counts[s["symbol"]] += 1

    top_symbols = sorted(symbol_counts.items(), key=lambda x: x[1], reverse=True)[:15]

    symbol_table = Table(title="🔝 Most Frequent Symbols (Top 15)")
    symbol_table.add_column("Symbol", style="cyan")
    symbol_table.add_column("Signal Days", justify="right")
    symbol_table.add_column("Avg Score", justify="right")

    for symbol, count in top_symbols:
        sym_signals = [s for s in signals if s["symbol"] == symbol]
        avg_score = sum(s["overall_score"] for s in sym_signals) / len(sym_signals)
        symbol_table.add_row(symbol, str(count), f"{avg_score:.3f}")

    console.print(symbol_table)

    # === Recent High-Quality Signals (last 7 days) ===
    week_ago = (date.today() - timedelta(days=7)).isoformat()
    recent_high_quality = [
        s
        for s in signals
        if s["scan_date"] >= week_ago and s.get("overall_score", 0) >= 0.75
    ]

    if recent_high_quality:
        recent_high_quality.sort(key=lambda x: x["overall_score"], reverse=True)

        recent_table = Table(
            title="⭐ Recent High-Quality Signals (Last 7 Days, Score ≥ 0.75)"
        )
        recent_table.add_column("Date", style="white")
        recent_table.add_column("Symbol", style="cyan")
        recent_table.add_column("Rank", style="magenta")
        recent_table.add_column("Score", style="green", justify="right")
        recent_table.add_column("Price", justify="right")
        recent_table.add_column("Vol Ratio", justify="right")
        recent_table.add_column("Breakout", justify="center")

        for s in recent_high_quality[:20]:
            recent_table.add_row(
                s["scan_date"],
                s["symbol"],
                f"{s.get('opportunity_rank', '?')}-Tier",
                f"{s.get('overall_score', 0):.3f}",
                f"${s.get('close_price', 0):.2f}",
                f"{s.get('volume_ratio', 0):.1f}x",
                "✅" if s.get("is_breakout") else "—",
            )

        console.print(recent_table)


def analyze_performance():
    """Analyze performance from penny_signal_performance table if it exists."""
    client = get_client()
    if not client:
        return

    console.print("\n[bold blue]💰 Performance Tracking Analysis[/bold blue]\n")

    try:
        response = client.table("penny_signal_performance").select("*").execute()
        perf_data = response.data or []
    except Exception as e:
        console.print(f"[yellow]Performance table not found or error: {e}[/yellow]")
        console.print("[dim]Performance tracking may not be set up yet.[/dim]")
        return

    if not perf_data:
        console.print("[yellow]No performance data found[/yellow]")
        return

    console.print(f"Total Performance Records: [bold]{len(perf_data)}[/bold]")

    # Split by status
    active = [p for p in perf_data if p.get("status") == "ACTIVE"]
    closed = [p for p in perf_data if p.get("status") == "CLOSED"]

    console.print(f"Active Trades: {len(active)}")
    console.print(f"Closed Trades: {len(closed)}")

    if closed:
        # Win rate
        winners = [p for p in closed if p.get("is_winner")]
        losers = [p for p in closed if not p.get("is_winner")]

        win_rate = len(winners) / len(closed) * 100 if closed else 0

        # Returns
        returns = [
            p.get("return_pct", 0) for p in closed if p.get("return_pct") is not None
        ]
        avg_return = sum(returns) / len(returns) if returns else 0

        winner_returns = [
            p.get("return_pct", 0) for p in winners if p.get("return_pct") is not None
        ]
        loser_returns = [
            p.get("return_pct", 0) for p in losers if p.get("return_pct") is not None
        ]

        avg_win = sum(winner_returns) / len(winner_returns) if winner_returns else 0
        avg_loss = sum(loser_returns) / len(loser_returns) if loser_returns else 0

        console.print("\n[bold green]📈 Closed Trade Performance:[/bold green]")
        console.print(f"  Win Rate: {win_rate:.1f}%")
        console.print(f"  Average Return: {avg_return:.2f}%")
        console.print(f"  Average Winner: +{avg_win:.2f}%")
        console.print(f"  Average Loser: {avg_loss:.2f}%")
        console.print(f"  Total Winners: {len(winners)}")
        console.print(f"  Total Losers: {len(losers)}")

        # Days held
        days_held = [
            p.get("days_held", 0) for p in closed if p.get("days_held") is not None
        ]
        if days_held:
            console.print(f"  Avg Days Held: {sum(days_held) / len(days_held):.1f}")

        # By rank
        rank_perf = defaultdict(lambda: {"count": 0, "wins": 0, "returns": []})
        for p in closed:
            rank = p.get("opportunity_rank", "Unknown")
            rank_perf[rank]["count"] += 1
            if p.get("is_winner"):
                rank_perf[rank]["wins"] += 1
            if p.get("return_pct") is not None:
                rank_perf[rank]["returns"].append(p["return_pct"])

        rank_table = Table(title="🎯 Performance by Rank")
        rank_table.add_column("Rank", style="magenta")
        rank_table.add_column("Trades", justify="right")
        rank_table.add_column("Win Rate", justify="right")
        rank_table.add_column("Avg Return", justify="right")

        for rank in ["S", "A", "B", "C", "D"]:
            if rank in rank_perf:
                data = rank_perf[rank]
                wr = data["wins"] / data["count"] * 100 if data["count"] else 0
                ar = (
                    sum(data["returns"]) / len(data["returns"])
                    if data["returns"]
                    else 0
                )
                wr_color = "green" if wr >= 50 else "red"
                ar_color = "green" if ar > 0 else "red"
                rank_table.add_row(
                    f"{rank}-Tier",
                    str(data["count"]),
                    f"[{wr_color}]{wr:.1f}%[/{wr_color}]",
                    f"[{ar_color}]{ar:.2f}%[/{ar_color}]",
                )

        console.print(rank_table)

        # Exit reason breakdown
        exit_reasons = defaultdict(int)
        for p in closed:
            reason = p.get("exit_reason", "Unknown")
            exit_reasons[reason] += 1

        console.print("\n[bold]🚪 Exit Reasons:[/bold]")
        for reason, count in sorted(
            exit_reasons.items(), key=lambda x: x[1], reverse=True
        ):
            console.print(f"  {reason}: {count} ({count / len(closed) * 100:.1f}%)")

        # Top winners and losers
        if returns:
            sorted_by_return = sorted(
                closed, key=lambda x: x.get("return_pct", 0) or 0, reverse=True
            )

            console.print("\n[bold green]🏆 Top 5 Winners:[/bold green]")
            for p in sorted_by_return[:5]:
                console.print(
                    f"  {p['symbol']}: +{p.get('return_pct', 0):.1f}% "
                    f"({p.get('entry_date')} → {p.get('exit_date')})"
                )

            console.print("\n[bold red]📉 Top 5 Losers:[/bold red]")
            for p in sorted_by_return[-5:]:
                console.print(
                    f"  {p['symbol']}: {p.get('return_pct', 0):.1f}% "
                    f"({p.get('entry_date')} → {p.get('exit_date')})"
                )


def main():
    """Run full analysis."""
    analyze_signals()
    analyze_performance()

    console.print("\n[bold]💡 Analysis Tips:[/bold]")
    console.print("  • Higher rank (S/A) signals should have better win rates")
    console.print("  • Breakout signals with high volume typically perform better")
    console.print(
        "  • Watch for symbols that appear frequently - they may have persistent setups"
    )
    console.print("  • Compare actual performance to expected returns by rank")


if __name__ == "__main__":
    main()
