"""
PortfolioAgent tools.

Read-only queries over `user_positions` and `user_spreads` (see
db/schema/07_positions.sql) and `cds_signal_outcomes` for P&L history.

Invariants for the model:
- These tools return real rows from your DB. Never invent values.
- Returning an empty result is meaningful: it means you have no open
  positions / spreads / outcomes in the requested window.
- On error, the returned dict has an `error` key; surface it verbatim and do
  not answer the underlying question.
"""

from __future__ import annotations

from datetime import UTC
from typing import Any

from ai_discord_bot.tools.db import db, safe_table_query, tool_error


def get_portfolio_snapshot() -> dict[str, Any]:
    """Return the current portfolio snapshot: open stock/option positions and
    open multi-leg spreads. Use this to answer any question about what the
    user currently holds.

    Returns:
        {
          "positions": [ { symbol, position_type, quantity, entry_price,
                           entry_date, strike_price, option_type, expiration_date,
                           leg_label }, ... ],
          "spreads":   [ { symbol, spread_type, quantity, net_debit_credit,
                           entry_date, expiration_date, max_profit, max_loss,
                           width }, ... ],
          "counts":    { "positions": N, "spreads": M }
        }
    """
    positions = safe_table_query(
        "user_positions",
        columns=(
            "id,symbol,position_type,quantity,entry_price,entry_date,"
            "strike_price,option_type,expiration_date,leg_label,spread_id,notes"
        ),
        order_by=("entry_date", True),
    )
    if "error" in positions:
        return positions
    spreads = safe_table_query(
        "user_spreads",
        columns=(
            "id,symbol,spread_type,quantity,net_debit_credit,entry_date,"
            "expiration_date,max_profit,max_loss,width,notes"
        ),
        order_by=("entry_date", True),
    )
    if "error" in spreads:
        return spreads
    return {
        "positions": positions["rows"],
        "spreads": spreads["rows"],
        "counts": {
            "positions": len(positions["rows"]),
            "spreads": len(spreads["rows"]),
        },
    }


def get_open_spreads(ticker: str | None = None) -> dict[str, Any]:
    """Return open multi-leg spreads. If `ticker` is provided, filter to
    that symbol (case-insensitive). Use this when the user asks about a
    specific spread position.

    Args:
        ticker: optional stock symbol to filter by (e.g. "NVDA").
    """
    filters: list[tuple[str, str, Any]] = []
    if ticker:
        filters.append(("symbol", "eq", ticker.upper()))
    result = safe_table_query(
        "user_spreads",
        columns=(
            "id,symbol,spread_type,quantity,net_debit_credit,entry_date,"
            "expiration_date,max_profit,max_loss,width,notes"
        ),
        filters=filters,
        order_by=("entry_date", True),
    )
    return result


def get_pnl_history(days: int = 30) -> dict[str, Any]:
    """Return realized P&L over the last N days, aggregated from closed
    CDS signal outcomes. Use this for "how was my trading last month".

    Args:
        days: lookback window in days. Default 30.
    """
    from datetime import datetime, timedelta

    cutoff = (datetime.now(UTC) - timedelta(days=days)).date().isoformat()
    try:
        resp = (
            db()
            .table("cds_signal_outcomes")
            .select(
                "signal_id,entry_date,exit_date,entry_price,exit_price,"
                "pnl_dollars,pnl_percent,days_held,exit_reason"
            )
            .gte("exit_date", cutoff)
            .order("exit_date", desc=True)
            .execute()
        )
    except Exception as e:
        return tool_error("db_query_failed", str(e), table="cds_signal_outcomes")

    rows = resp.data or []
    if not rows:
        return {
            "window_days": days,
            "closed_trades": 0,
            "total_pnl_dollars": 0.0,
            "win_rate": None,
            "rows": [],
        }

    total = sum((r.get("pnl_dollars") or 0) for r in rows)
    wins = sum(1 for r in rows if (r.get("pnl_dollars") or 0) > 0)
    win_rate = wins / len(rows) if rows else None
    return {
        "window_days": days,
        "closed_trades": len(rows),
        "total_pnl_dollars": round(total, 2),
        "win_rate": round(win_rate, 3) if win_rate is not None else None,
        "rows": rows,
    }
