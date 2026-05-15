"""
MarketAgent tools.

Live market data via Yahoo Finance (unauthenticated, rate-limited) and
Financial Modeling Prep (FMP, optional). Both are called through httpx
directly; we deliberately do NOT use yfinance because it has been flaky
across the repo's other services (and we already burned an ai-analyst
run hitting a 429 this session).

Invariants:
- Return structured errors on 429 / network failures; never raise.
- Cache-aware in V2; V1 trusts the caller not to thrash.
"""

from __future__ import annotations

import asyncio
from typing import Any

import httpx
from loguru import logger

from ai_discord_bot.config import get_settings
from ai_discord_bot.tools.db import tool_error

# Yahoo's /v7/finance/quote endpoint started requiring a session crumb/cookie
# in late 2023 and now 401s on most unauthenticated calls. The /v8/finance
# /chart/ endpoint is still openly reachable and includes a `meta` block with
# enough data for our MarketAgent.
_YAHOO_CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart/{ticker}"
_FMP_QUOTE_URL = "https://financialmodelingprep.com/api/v3/quote/{ticker}"
_REQUEST_TIMEOUT_S = 10.0


async def _yahoo_quote(ticker: str) -> dict[str, Any]:
    url = _YAHOO_CHART_URL.format(ticker=ticker.upper())
    params = {"interval": "1d", "range": "5d"}
    headers = {"User-Agent": "Mozilla/5.0 (local ai-discord-bot)"}
    async with httpx.AsyncClient(timeout=_REQUEST_TIMEOUT_S) as client:
        try:
            r = await client.get(url, params=params, headers=headers)
            if r.status_code == 429:
                return tool_error("rate_limited", "Yahoo chart returned 429")
            if r.status_code == 401:
                return tool_error("unauthorized", "Yahoo chart returned 401")
            r.raise_for_status()
            payload = r.json()
        except httpx.HTTPError as e:
            return tool_error("network_error", f"Yahoo chart failed: {e}")

    chart = payload.get("chart", {})
    if chart.get("error"):
        err = chart["error"]
        code = err.get("code", "error")
        desc = err.get("description", str(err))
        return tool_error(code.lower() if isinstance(code, str) else "yahoo_error", desc)

    results = chart.get("result") or []
    if not results:
        return tool_error("not_found", f"No Yahoo data for ticker {ticker.upper()}")
    result = results[0]
    meta = result.get("meta") or {}
    price = meta.get("regularMarketPrice")
    prev_close = meta.get("chartPreviousClose") or meta.get("previousClose")
    change_pct = None
    if price is not None and prev_close:
        try:
            change_pct = round(((price - prev_close) / prev_close) * 100, 4)
        except ZeroDivisionError:
            change_pct = None
    return {
        "source": "yahoo",
        "ticker": meta.get("symbol"),
        "name": meta.get("instrumentType"),
        "price": price,
        "change_pct": change_pct,
        "previous_close": prev_close,
        "day_high": meta.get("regularMarketDayHigh"),
        "day_low": meta.get("regularMarketDayLow"),
        "fifty_two_week_high": meta.get("fiftyTwoWeekHigh"),
        "fifty_two_week_low": meta.get("fiftyTwoWeekLow"),
        "volume": meta.get("regularMarketVolume"),
        "exchange": meta.get("fullExchangeName") or meta.get("exchangeName"),
        "currency": meta.get("currency"),
        "timezone": meta.get("timezone"),
    }


async def _fmp_quote(ticker: str) -> dict[str, Any] | None:
    s = get_settings()
    if not s.fmp_api_key:
        return None
    url = _FMP_QUOTE_URL.format(ticker=ticker.upper())
    async with httpx.AsyncClient(timeout=_REQUEST_TIMEOUT_S) as client:
        try:
            r = await client.get(url, params={"apikey": s.fmp_api_key})
            if r.status_code == 429:
                return tool_error("rate_limited", "FMP returned 429")
            r.raise_for_status()
            payload = r.json()
        except httpx.HTTPError as e:
            return tool_error("network_error", f"FMP quote failed: {e}")
    if not payload:
        return tool_error("not_found", f"No FMP data for ticker {ticker.upper()}")
    q = payload[0] if isinstance(payload, list) else payload
    return {
        "source": "fmp",
        "ticker": q.get("symbol"),
        "name": q.get("name"),
        "price": q.get("price"),
        "change_pct": q.get("changesPercentage"),
        "volume": q.get("volume"),
        "avg_volume": q.get("avgVolume"),
        "day_high": q.get("dayHigh"),
        "day_low": q.get("dayLow"),
        "market_cap": q.get("marketCap"),
        "pe": q.get("pe"),
        "exchange": q.get("exchange"),
    }


def _run_async(coro):
    """Agno calls tools synchronously; wrap an async call to run on the
    current event loop if we are already inside one, else a new loop."""
    try:
        asyncio.get_running_loop()
    except RuntimeError:
        return asyncio.run(coro)
    # If we are already in an event loop (Agno's runner under FastAPI),
    # schedule the coroutine and block until done via run_until_complete.
    # Agno's tool executor uses asyncio.to_thread for sync tools; the loop
    # we see here would be the main bot loop, which we must NOT block.
    # Safer: run in a dedicated thread with its own loop.
    import concurrent.futures

    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as ex:
        fut = ex.submit(asyncio.run, coro)
        return fut.result()


def get_ticker_data(ticker: str) -> dict[str, Any]:
    """Return a live quote for a single stock ticker. Use this to verify or
    enrich claims about a specific symbol. Do not call repeatedly for the
    same ticker in one turn; the result is stable for the duration of the
    turn.

    Args:
        ticker: stock symbol, e.g. "NVDA", "SPY".

    Returns fields: price, change_pct, volume, avg_volume, day_high/low,
    market_cap, pe, exchange. On failure returns {"error": {...}}.
    """
    if not ticker or not ticker.strip():
        return tool_error("invalid_arg", "ticker is required")
    ticker = ticker.upper()
    logger.debug("get_ticker_data({})", ticker)

    async def run() -> dict[str, Any]:
        result = await _yahoo_quote(ticker)
        if "error" in result and result["error"].get("code") in {"rate_limited", "network_error", "not_found"}:
            fmp = await _fmp_quote(ticker)
            if fmp is not None and "error" not in fmp:
                return fmp
            # If FMP not configured or also failed, surface the Yahoo error.
        return result

    return _run_async(run())


def get_trading_regime() -> dict[str, Any]:
    """Return a coarse trading regime signal based on SPY and VIX. Use this
    to sanity-check whether entering new positions is advisable today.

    Regime labels:
      GO      - SPY positive on day AND VIX < 18
      CAUTION - anything else not NO_TRADE
      NO_TRADE- VIX > 25 OR SPY down more than 1.5%
    """

    async def run() -> dict[str, Any]:
        spy = await _yahoo_quote("SPY")
        vix = await _yahoo_quote("^VIX")
        if "error" in spy:
            return tool_error(
                "regime_unavailable",
                f"SPY quote failed: {spy['error'].get('message')}",
            )
        if "error" in vix:
            return tool_error(
                "regime_unavailable",
                f"VIX quote failed: {vix['error'].get('message')}",
            )
        spy_change = spy.get("change_pct")
        vix_price = vix.get("price")
        if spy_change is None or vix_price is None:
            return tool_error("incomplete_data", "SPY or VIX missing from Yahoo response")

        if vix_price > 25 or spy_change < -1.5:
            regime = "NO_TRADE"
        elif spy_change > 0 and vix_price < 18:
            regime = "GO"
        else:
            regime = "CAUTION"

        return {
            "regime": regime,
            "spy_change_pct": round(spy_change, 3),
            "vix": round(vix_price, 2),
            "notes": (
                "Coarse heuristic from SPY day change and VIX level. "
                "Not a substitute for scanner-level regime detection."
            ),
        }

    return _run_async(run())
