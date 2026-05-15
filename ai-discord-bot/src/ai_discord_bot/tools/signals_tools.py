"""
SignalsAgent tools.

Read-only queries over the unified `signals` table (db/schema/03_signals.sql),
`unusual_options_signals` (db/schema/05_unusual_options.sql), and
`cds_signal_outcomes` for historical outcome lookups.

Invariants:
- Same as portfolio_tools: never fabricate. Empty results are meaningful.
- `search_cds_outcomes` is the decision-journal-adjacent tool: it answers
  "how did past CDS setups on X play out".
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

from ai_discord_bot.tools.db import db, safe_table_query, tool_error


def get_recent_signals(
    strategy: str = "all",
    days: int = 3,
    min_grade: str = "B",
) -> dict[str, Any]:
    """Return recent scanner signals from the unified `signals` table. Use
    this to answer "what did the scanners flag today/this week".

    Args:
        strategy: one of "all", "cds", "pcs", "penny". Default "all".
        days: lookback in days. Default 3.
        min_grade: minimum grade letter (A > B > C > D > F). Default "B".
    """
    cutoff = (datetime.now(UTC) - timedelta(days=days)).date().isoformat()
    filters: list[tuple[str, str, Any]] = [
        ("signal_date", "gte", cutoff),
    ]
    if strategy and strategy.lower() != "all":
        filters.append(("strategy", "eq", strategy.lower()))

    grade_rank = {"A": 0, "B": 1, "C": 2, "D": 3, "F": 4}
    allowed = [g for g, r in grade_rank.items() if r <= grade_rank.get(min_grade.upper(), 1)]
    # supabase-py expects a Python list for `in_()`.
    filters.append(("grade", "in", allowed))

    result = safe_table_query(
        "signals",
        columns=(
            "strategy,ticker,signal_date,score_normalized,grade,direction,"
            "price,regime,sector,headline,top_signals,metadata"
        ),
        filters=filters,
        order_by=("signal_date", True),
        limit=50,
    )
    return result


def get_unusual_options_activity(
    ticker: str | None = None, limit: int = 20
) -> dict[str, Any]:
    """Return recent unusual options signals. Use this when the user asks
    about options flow / unusual volume on a ticker or overall.

    Args:
        ticker: optional ticker filter.
        limit: max rows. Default 20.
    """
    filters: list[tuple[str, str, Any]] = []
    if ticker:
        filters.append(("ticker", "eq", ticker.upper()))
    result = safe_table_query(
        "unusual_options_signals",
        columns=(
            "signal_id,ticker,option_symbol,detection_timestamp,strike,"
            "expiration_date,option_type,days_to_expiry,volume,open_interest,"
            "premium,overall_score,grade,confidence,risk_level,classification"
        ),
        filters=filters,
        order_by=("detection_timestamp", True),
        limit=limit,
    )
    return result


def search_cds_outcomes(
    ticker: str | None = None, outcome: str | None = None
) -> dict[str, Any]:
    """Search historical CDS signal outcomes. Use this for
    decision-journal-style questions: "how did my last NVDA CDS go", or
    "show me all losing setups from this regime".

    Args:
        ticker: optional ticker filter (e.g. "NVDA").
        outcome: optional exit-reason filter (e.g. "stopped_out", "target_hit").
    """
    try:
        q = (
            db()
            .table("cds_signal_outcomes")
            .select(
                "signal_id,entry_date,exit_date,entry_price,exit_price,"
                "pnl_dollars,pnl_percent,days_held,exit_reason,"
                "cds_signals(ticker,signal_grade,regime,sector,headline)"
            )
            .order("exit_date", desc=True)
            .limit(25)
        )
        if outcome:
            q = q.eq("exit_reason", outcome)
        # Ticker filter is on the joined cds_signals row; Supabase REST can
        # filter joined columns with `cds_signals.ticker`.
        if ticker:
            q = q.eq("cds_signals.ticker", ticker.upper())
        resp = q.execute()
        rows = resp.data or []
        if ticker:
            rows = [r for r in rows if r.get("cds_signals") and r["cds_signals"].get("ticker") == ticker.upper()]
        return {"count": len(rows), "rows": rows}
    except Exception as e:
        return tool_error("db_query_failed", str(e), table="cds_signal_outcomes")
