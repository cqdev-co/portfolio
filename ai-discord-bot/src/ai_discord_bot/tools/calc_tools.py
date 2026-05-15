"""
Deterministic calculators.

Pure Python math, no LLM, no network. This enforces the house rule from the
eval findings: "model narrates, code computes". If the model claims a
numeric value that a calculator could have produced, it should have called
the calculator instead.
"""

from __future__ import annotations

import math
from typing import Any

from ai_discord_bot.tools.db import tool_error


def calculate_spread(
    ticker: str,
    long_strike: float,
    short_strike: float,
    dte: int,
    debit: float | None = None,
    underlying_price: float | None = None,
    iv: float | None = None,
) -> dict[str, Any]:
    """Compute exact pricing and risk metrics for a call debit spread.

    Args:
        ticker: underlying symbol (informational; not used in math).
        long_strike: the lower call strike you buy.
        short_strike: the higher call strike you sell.
        dte: days to expiration (>=1).
        debit: optional net debit paid. If provided, full metrics are
            returned; otherwise max_profit, max_loss and breakeven are
            omitted.
        underlying_price: optional current price of the underlying. When
            provided along with iv and dte, a rough probability of profit is
            estimated via a Black-Scholes-lognormal approximation.
        iv: optional annualized implied volatility (e.g. 0.35 for 35%).

    Returns:
        Dict with width, max_profit, max_loss, breakeven, cushion_pct,
        return_on_risk, prob_profit (when inputs allow), plus the inputs
        echoed back.
    """
    if long_strike >= short_strike:
        return tool_error(
            "invalid_arg",
            "For a call debit spread, long_strike must be less than short_strike",
            long_strike=long_strike,
            short_strike=short_strike,
        )
    if dte < 1:
        return tool_error("invalid_arg", "dte must be >= 1", dte=dte)

    width = round(short_strike - long_strike, 4)
    out: dict[str, Any] = {
        "ticker": ticker.upper(),
        "long_strike": long_strike,
        "short_strike": short_strike,
        "dte": dte,
        "width": width,
    }

    if debit is not None:
        if debit <= 0 or debit >= width:
            return tool_error(
                "invalid_arg",
                "debit must be > 0 and < width (otherwise the spread is mispriced)",
                debit=debit,
                width=width,
            )
        max_profit = round(width - debit, 4)
        max_loss = round(debit, 4)
        breakeven = round(long_strike + debit, 4)
        out.update(
            {
                "debit": debit,
                "max_profit": max_profit,
                "max_loss": max_loss,
                "breakeven": breakeven,
                "return_on_risk": round(max_profit / max_loss, 3),
            }
        )

        if underlying_price is not None:
            cushion = underlying_price - breakeven
            out["cushion_dollars"] = round(cushion, 4)
            out["cushion_pct"] = round(cushion / underlying_price, 4)

    if underlying_price is not None and iv is not None and iv > 0:
        # Rough probability that underlying closes above breakeven at expiry,
        # assuming lognormal returns with drift=0. This is a back-of-envelope
        # estimate; not a substitute for a real pricing model.
        # Without debit we don't know the breakeven; estimate using short
        # strike instead (probability of reaching max profit).
        target = short_strike if debit is None else out["breakeven"]

        t_years = dte / 365.0
        sigma = iv
        try:
            z = (math.log(target / underlying_price)) / (sigma * math.sqrt(t_years))
            prob = 1.0 - _phi(z)
            out["prob_profit"] = round(prob, 3)
        except Exception:
            pass

    return out


def _phi(z: float) -> float:
    """Standard normal CDF via error function."""
    return 0.5 * (1.0 + math.erf(z / math.sqrt(2.0)))
