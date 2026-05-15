"""
Supabase client helper + schema-aware error shaping for tools.

All DB tools pass through here so error envelopes are consistent (tools
should never raise into the agent loop - they should return a dict with
an `error` key the model can read and act on).
"""

from __future__ import annotations

from typing import Any

from loguru import logger

from ai_discord_bot.config import supabase_client


def db():
    """Return the shared Supabase client."""
    return supabase_client()


def tool_error(code: str, message: str, **extra: Any) -> dict[str, Any]:
    """Standard error envelope. Models are instructed (via system prompt)
    to surface these rather than fabricating.
    """
    return {"error": {"code": code, "message": message, **extra}}



# PostgREST client method names per supabase-py 2.x. `in` is a Python keyword,
# so the library exposes it as `in_`. `like` uses `ilike` for case-insensitive.
_OP_METHOD = {
    "eq": "eq",
    "neq": "neq",
    "gt": "gt",
    "lt": "lt",
    "gte": "gte",
    "lte": "lte",
    "in": "in_",
    "ilike": "ilike",
    "like": "like",
    "is": "is_",
}


def safe_table_query(
    table: str,
    columns: str = "*",
    filters: list[tuple[str, str, Any]] | None = None,
    order_by: tuple[str, bool] | None = None,
    limit: int | None = None,
) -> dict[str, Any]:
    """Generic safe read. Returns {"rows": [...]} or {"error": {...}}.

    filters: list of (column, op, value). op in `_OP_METHOD` keys.
    order_by: (column, descending)
    """
    try:
        q = db().table(table).select(columns)
        for col, op, val in filters or []:
            method = _OP_METHOD.get(op)
            if method is None:
                return tool_error(
                    "invalid_op",
                    f"Unsupported filter op {op!r}. Allowed: {sorted(_OP_METHOD)}",
                )
            q = getattr(q, method)(col, val)
        if order_by is not None:
            col, desc = order_by
            q = q.order(col, desc=desc)
        if limit is not None:
            q = q.limit(limit)
        resp = q.execute()
        return {"rows": resp.data or []}
    except Exception as e:
        logger.warning("safe_table_query({}) failed: {}", table, e)
        return tool_error("db_query_failed", str(e), table=table)
