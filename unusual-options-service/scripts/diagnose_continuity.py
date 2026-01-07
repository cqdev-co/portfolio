#!/usr/bin/env python3
"""
Diagnostic tool for unusual options signal continuity tracking.

This script verifies that:
1. Deduplication is working (no duplicate signals)
2. Detection counts are incrementing properly
3. Timestamps are consistent
4. Active/inactive status is correct
5. Stale signal detection is working

Usage:
    python scripts/diagnose_continuity.py
    python scripts/diagnose_continuity.py --verbose
    python scripts/diagnose_continuity.py --ticker AAPL
"""

import sys
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

import click
from loguru import logger
from rich import box
from rich.console import Console
from rich.panel import Panel
from rich.table import Table

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from unusual_options.config import load_config
from unusual_options.storage.database import SupabaseStorage

console = Console()


class ContinuityDiagnostics:
    """Diagnostic tool for signal continuity tracking."""

    def __init__(self, config: dict[str, Any]):
        """Initialize diagnostics with config."""
        self.config = config
        self.storage = SupabaseStorage(config)

    def check_duplicates(self) -> dict[str, Any]:
        """
        Check for duplicate signals that should have been deduplicated.

        Returns signals with same ticker/option_symbol/expiry that are
        both active.
        """
        console.print("\n[cyan]🔍 Checking for duplicate signals...[/cyan]")

        try:
            # Get all active signals
            client = self.storage._get_client()
            result = (
                client.table("unusual_options_signals")
                .select("*")
                .eq("is_active", True)
                .execute()
            )

            if not result.data:
                console.print("[green]✓ No active signals found[/green]")
                return {"duplicates": [], "count": 0}

            signals = result.data

            # Group by ticker + option_symbol + expiry
            groups = defaultdict(list)
            for signal in signals:
                key = (signal["ticker"], signal["option_symbol"], signal["expiry"])
                groups[key].append(signal)

            # Find duplicates (same key, multiple active signals)
            duplicates = []
            for key, group in groups.items():
                if len(group) > 1:
                    duplicates.append(
                        {
                            "ticker": key[0],
                            "option_symbol": key[1],
                            "expiry": key[2],
                            "count": len(group),
                            "signals": group,
                        }
                    )

            if duplicates:
                console.print(
                    f"[red]✗ Found {len(duplicates)} duplicate signal groups[/red]"
                )

                # Show first few
                for dup in duplicates[:5]:
                    console.print(
                        f"  • {dup['ticker']} {dup['option_symbol']}: "
                        f"{dup['count']} active signals"
                    )
                    for sig in dup["signals"]:
                        console.print(
                            f"    - ID: {sig['signal_id'][:8]}..., "
                            f"Count: {sig['detection_count']}, "
                            f"Last: {sig['last_detected_at']}"
                        )

                if len(duplicates) > 5:
                    console.print(f"  ... and {len(duplicates) - 5} more")
            else:
                console.print(
                    "[green]✓ No duplicate signals found - "
                    "deduplication working![/green]"
                )

            return {
                "duplicates": duplicates,
                "count": len(duplicates),
                "total_signals": len(signals),
            }

        except Exception as e:
            console.print(f"[red]✗ Error checking duplicates: {e}[/red]")
            return {"duplicates": [], "count": 0, "error": str(e)}

    def check_detection_counts(self) -> dict[str, Any]:
        """
        Check if detection counts are incrementing properly.

        Returns signals with detection_count > 1 (re-detected signals).
        """
        console.print("\n[cyan]🔢 Checking detection counts...[/cyan]")

        try:
            client = self.storage._get_client()
            result = (
                client.table("unusual_options_signals")
                .select("*")
                .gt("detection_count", 1)
                .order("detection_count", desc=True)
                .limit(20)
                .execute()
            )

            if not result.data:
                console.print(
                    "[yellow]⚠ No signals with detection_count > 1 found[/yellow]"
                )
                console.print(
                    "   This is normal if you just started, or if "
                    "deduplication isn't working"
                )
                return {"re_detected": [], "count": 0}

            signals = result.data

            console.print(f"[green]✓ Found {len(signals)} re-detected signals[/green]")

            # Show top re-detected signals
            table = Table(title="Top Re-Detected Signals", box=box.ROUNDED)
            table.add_column("Ticker", style="cyan")
            table.add_column("Option", style="yellow")
            table.add_column("Count", style="green")
            table.add_column("First", style="blue")
            table.add_column("Last", style="blue")
            table.add_column("Active", style="magenta")

            for sig in signals[:10]:
                first = (
                    sig["first_detected_at"][:16]
                    if sig.get("first_detected_at")
                    else "N/A"
                )
                last = (
                    sig["last_detected_at"][:16]
                    if sig.get("last_detected_at")
                    else "N/A"
                )

                table.add_row(
                    sig["ticker"],
                    sig["option_symbol"][:15],
                    str(sig["detection_count"]),
                    first,
                    last,
                    "✓" if sig["is_active"] else "✗",
                )

            console.print(table)

            return {
                "re_detected": signals,
                "count": len(signals),
                "max_count": signals[0]["detection_count"],
            }

        except Exception as e:
            console.print(f"[red]✗ Error checking detection counts: {e}[/red]")
            return {"re_detected": [], "count": 0, "error": str(e)}

    def check_timestamp_consistency(self) -> dict[str, Any]:
        """
        Check for timestamp inconsistencies.

        Verifies:
        - first_detected_at <= last_detected_at
        - last_detected_at is recent for active signals
        - detection_timestamp vs storage timestamps
        """
        console.print("\n[cyan]⏰ Checking timestamp consistency...[/cyan]")

        try:
            client = self.storage._get_client()
            result = (
                client.table("unusual_options_signals")
                .select("*")
                .eq("is_active", True)
                .execute()
            )

            if not result.data:
                console.print("[yellow]⚠ No active signals to check[/yellow]")
                return {"issues": [], "count": 0}

            signals = result.data
            issues = []
            now = datetime.now()

            for sig in signals:
                issue_list = []

                # Check first <= last
                if sig.get("first_detected_at") and sig.get("last_detected_at"):
                    first = datetime.fromisoformat(
                        sig["first_detected_at"].replace("Z", "+00:00")
                    )
                    last = datetime.fromisoformat(
                        sig["last_detected_at"].replace("Z", "+00:00")
                    )

                    if first > last:
                        issue_list.append("first_detected_at > last_detected_at")

                    # Check how recent last_detected_at is
                    time_since_last = now - last.replace(tzinfo=None)
                    if time_since_last > timedelta(hours=6):
                        issue_list.append(
                            f"last_detected_at is {time_since_last.total_seconds() / 3600:.1f}h old"
                        )

                # Check detection_timestamp vs last_detected_at
                if sig.get("detection_timestamp") and sig.get("last_detected_at"):
                    det = datetime.fromisoformat(
                        sig["detection_timestamp"].replace("Z", "+00:00")
                    )
                    last = datetime.fromisoformat(
                        sig["last_detected_at"].replace("Z", "+00:00")
                    )

                    # Large gap indicates old detection_timestamp
                    gap = abs((last - det).total_seconds() / 3600)
                    if gap > 4:
                        issue_list.append(
                            f"{gap:.1f}h gap between detection and storage"
                        )

                if issue_list:
                    issues.append(
                        {
                            "signal_id": sig["signal_id"],
                            "ticker": sig["ticker"],
                            "option_symbol": sig["option_symbol"],
                            "issues": issue_list,
                            "detection_timestamp": sig.get("detection_timestamp"),
                            "first_detected_at": sig.get("first_detected_at"),
                            "last_detected_at": sig.get("last_detected_at"),
                        }
                    )

            if issues:
                console.print(
                    f"[yellow]⚠ Found {len(issues)} timestamp issues[/yellow]"
                )

                for issue in issues[:5]:
                    console.print(
                        f"  • {issue['ticker']} {issue['option_symbol'][:15]}:"
                    )
                    for problem in issue["issues"]:
                        console.print(f"    - {problem}")

                if len(issues) > 5:
                    console.print(f"  ... and {len(issues) - 5} more")
            else:
                console.print("[green]✓ All timestamps consistent![/green]")

            return {
                "issues": issues,
                "count": len(issues),
                "total_signals": len(signals),
            }

        except Exception as e:
            console.print(f"[red]✗ Error checking timestamps: {e}[/red]")
            return {"issues": [], "count": 0, "error": str(e)}

    def check_active_status(self) -> dict[str, Any]:
        """
        Check active vs inactive signal distribution.

        Shows:
        - Total active vs inactive
        - Recently inactive signals (might be false positives)
        """
        console.print("\n[cyan]🟢 Checking active/inactive status...[/cyan]")

        try:
            client = self.storage._get_client()

            # Count active
            active_result = (
                client.table("unusual_options_signals")
                .select("*", count="exact")
                .eq("is_active", True)
                .execute()
            )

            active_count = active_result.count or 0

            # Count inactive
            inactive_result = (
                client.table("unusual_options_signals")
                .select("*", count="exact")
                .eq("is_active", False)
                .execute()
            )

            inactive_count = inactive_result.count or 0

            total = active_count + inactive_count

            # Show distribution
            table = Table(title="Signal Status Distribution", box=box.ROUNDED)
            table.add_column("Status", style="cyan")
            table.add_column("Count", style="yellow")
            table.add_column("Percentage", style="green")

            if total > 0:
                table.add_row(
                    "🟢 Active", str(active_count), f"{active_count / total * 100:.1f}%"
                )
                table.add_row(
                    "🔴 Inactive",
                    str(inactive_count),
                    f"{inactive_count / total * 100:.1f}%",
                )
            else:
                table.add_row("Total", "0", "0%")

            console.print(table)

            # Check recently inactive signals (potential false positives)
            recently_inactive = (
                client.table("unusual_options_signals")
                .select("*")
                .eq("is_active", False)
                .gte(
                    "last_detected_at",
                    (datetime.now() - timedelta(hours=1)).isoformat(),
                )
                .execute()
            )

            recent_count = len(recently_inactive.data) if recently_inactive.data else 0

            if recent_count > 0:
                console.print(
                    f"\n[yellow]⚠ Found {recent_count} signals marked "
                    f"inactive within last hour[/yellow]"
                )
                console.print(
                    "   These might be false positives if the stale "
                    "threshold is too low"
                )

            # Warnings
            if total == 0:
                console.print("\n[yellow]⚠ No signals in database[/yellow]")
            elif active_count == 0 and inactive_count > 0:
                console.print(
                    "\n[red]✗ ALL signals are inactive - this is likely a bug![/red]"
                )
                console.print(
                    "   Check if stale threshold is too low or if "
                    "timestamps are incorrect"
                )
            elif active_count > 0:
                console.print(
                    f"\n[green]✓ {active_count} active signals "
                    f"ready for frontend![/green]"
                )

            return {
                "active_count": active_count,
                "inactive_count": inactive_count,
                "total": total,
                "recently_inactive": recent_count,
            }

        except Exception as e:
            console.print(f"[red]✗ Error checking active status: {e}[/red]")
            return {"active_count": 0, "inactive_count": 0, "total": 0, "error": str(e)}

    def check_continuity_history(self, ticker: str = None) -> dict[str, Any]:
        """
        Check continuity tracking history.

        Shows signals with history records to verify tracking is working.
        """
        console.print("\n[cyan]📊 Checking continuity history...[/cyan]")

        try:
            client = self.storage._get_client()

            # Count continuity records
            count_result = (
                client.table("unusual_options_signal_continuity")
                .select("*", count="exact")
                .execute()
            )

            continuity_count = count_result.count or 0

            if continuity_count == 0:
                console.print("[yellow]⚠ No continuity history found[/yellow]")
                console.print(
                    "   This is normal if signals haven't been re-detected yet"
                )
                return {"continuity_records": 0}

            console.print(
                f"[green]✓ Found {continuity_count} continuity records[/green]"
            )

            # Get sample with history
            query = (
                client.table("unusual_options_signals")
                .select("*")
                .gt("detection_count", 1)
            )

            if ticker:
                query = query.eq("ticker", ticker.upper())

            signals_result = query.limit(5).execute()

            if signals_result.data:
                console.print("\nSample signals with continuity tracking:")

                for sig in signals_result.data:
                    # Get history
                    history_result = (
                        client.table("unusual_options_signal_continuity")
                        .select("*")
                        .eq("signal_id", sig["signal_id"])
                        .order("detected_at", desc=True)
                        .execute()
                    )

                    if history_result.data:
                        console.print(
                            f"\n  {sig['ticker']} "
                            f"{sig['option_symbol'][:15]} "
                            f"(detected {sig['detection_count']} times):"
                        )

                        for record in history_result.data[:3]:
                            console.print(
                                f"    • {record['detected_at'][:16]}: "
                                f"Vol={record['current_volume']}, "
                                f"Score={record['overall_score']:.3f}"
                                f"{' (↑' + str(record['volume_delta']) + ')' if record.get('volume_delta') else ''}"
                            )

            return {
                "continuity_records": continuity_count,
                "signals_with_history": len(signals_result.data)
                if signals_result.data
                else 0,
            }

        except Exception as e:
            console.print(f"[red]✗ Error checking continuity history: {e}[/red]")
            return {"continuity_records": 0, "error": str(e)}

    def run_full_diagnostics(self, ticker: str = None) -> dict[str, Any]:
        """Run all diagnostic checks."""
        console.print(
            Panel(
                "[bold cyan]Unusual Options Signal Continuity Diagnostics[/bold cyan]",
                box=box.DOUBLE,
            )
        )

        results = {}

        # Run all checks
        results["duplicates"] = self.check_duplicates()
        results["detection_counts"] = self.check_detection_counts()
        results["timestamps"] = self.check_timestamp_consistency()
        results["active_status"] = self.check_active_status()
        results["continuity_history"] = self.check_continuity_history(ticker)

        # Summary
        console.print("\n" + "=" * 60)
        console.print(Panel("[bold]Diagnostic Summary[/bold]", box=box.ROUNDED))

        # Check for critical issues
        critical_issues = []

        if results["duplicates"]["count"] > 0:
            critical_issues.append(
                f"❌ {results['duplicates']['count']} duplicate signal groups"
            )

        if (
            results["active_status"]["active_count"] == 0
            and results["active_status"]["total"] > 0
        ):
            critical_issues.append("❌ All signals inactive (likely timestamp issue)")

        if results["timestamps"]["count"] > 0:
            critical_issues.append(
                f"⚠️  {results['timestamps']['count']} timestamp issues"
            )

        if critical_issues:
            console.print("\n[bold red]Critical Issues Found:[/bold red]")
            for issue in critical_issues:
                console.print(f"  {issue}")
        else:
            console.print(
                "\n[bold green]✓ All checks passed! "
                "Continuity tracking is working properly.[/bold green]"
            )

        # Recommendations
        console.print("\n[bold cyan]Recommendations:[/bold cyan]")

        if results["detection_counts"]["count"] == 0:
            console.print("  • Run the scanner twice to test deduplication")

        if results["continuity_history"]["continuity_records"] == 0:
            console.print("  • Re-run scanner to build continuity history")

        if results["duplicates"]["count"] > 0:
            console.print(
                "  • Run cleanup script and re-scan with fixed continuity service"
            )

        if results["active_status"]["active_count"] > 0:
            console.print(
                f"  • {results['active_status']['active_count']} "
                f"signals ready for frontend!"
            )

        return results


@click.command()
@click.option("--ticker", "-t", help="Filter diagnostics to specific ticker")
@click.option("--verbose", "-v", is_flag=True, help="Show detailed output")
def main(ticker: str = None, verbose: bool = False):
    """
    Run diagnostics on unusual options signal continuity tracking.

    This tool verifies that deduplication, detection counts, timestamps,
    and active/inactive status are all working correctly.
    """
    try:
        # Load config
        config = load_config()

        # Setup logging
        if not verbose:
            logger.remove()
            logger.add(sys.stderr, level="ERROR")

        # Run diagnostics
        diagnostics = ContinuityDiagnostics(config)
        results = diagnostics.run_full_diagnostics(ticker)

        # Exit code based on critical issues
        if results["duplicates"]["count"] > 0 or (
            results["active_status"]["active_count"] == 0
            and results["active_status"]["total"] > 0
        ):
            sys.exit(1)

        sys.exit(0)

    except KeyboardInterrupt:
        console.print("\n[yellow]Interrupted by user[/yellow]")
        sys.exit(130)
    except Exception as e:
        console.print(f"\n[red]Fatal error: {e}[/red]")
        if verbose:
            import traceback

            console.print(traceback.format_exc())
        sys.exit(1)


if __name__ == "__main__":
    main()
