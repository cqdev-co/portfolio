"""
Strategy Configuration Loader (Python)

Loads and validates the centralized strategy.config.yaml file.
Used by spread_quant_analysis.py, unusual-options-service, and other Python services.
"""

from dataclasses import dataclass
from pathlib import Path

import yaml


# =============================================================================
# TYPES
# =============================================================================


@dataclass
class EntryValidation:
    """Result of validating entry criteria."""

    passed: bool
    failures: list[str]
    warnings: list[str]
    score: int


@dataclass
class PositionSizingResult:
    """Position sizing recommendation."""

    max_position_pct: float
    max_position_dollars: float
    max_positions: int
    max_deployed: float


@dataclass
class SpreadWidthResult:
    """Spread width recommendation."""

    width: float
    typical_debit: float


# =============================================================================
# LOADER
# =============================================================================

_cached_config: dict | None = None


def find_config_path() -> Path:
    """Find strategy.config.yaml by walking up from cwd."""
    possible_paths = [
        Path.cwd() / "strategy.config.yaml",
        Path.cwd().parent / "strategy.config.yaml",
        Path.cwd().parent.parent / "strategy.config.yaml",
        Path(__file__).parent.parent.parent / "strategy.config.yaml",
    ]

    for p in possible_paths:
        if p.exists():
            return p

    raise FileNotFoundError(
        "strategy.config.yaml not found. Create it in the repository root."
    )


def load_strategy_config(config_path: Path | None = None) -> dict:
    """Load the strategy configuration from YAML."""
    global _cached_config

    if _cached_config is not None:
        return _cached_config

    path = config_path or find_config_path()

    with open(path) as f:
        _cached_config = yaml.safe_load(f)

    return _cached_config


def clear_config_cache() -> None:
    """Clear cached config (useful for testing)."""
    global _cached_config
    _cached_config = None


# =============================================================================
# VALIDATION HELPERS
# =============================================================================


def validate_entry(
    price: float,
    ma200: float | None = None,
    ma50: float | None = None,
    rsi: float | None = None,
    cushion_pct: float | None = None,
    iv: float | None = None,
    iv_rank: float | None = None,
    days_to_earnings: int | None = None,
    analyst_bullish_pct: float | None = None,
    analyst_count: int | None = None,
    pe_ratio: float | None = None,
    market_cap_b: float | None = None,
    return_on_risk_pct: float | None = None,
    config: dict | None = None,
) -> EntryValidation:
    """
    Validate a potential trade against entry criteria.

    Returns EntryValidation with pass/fail status, reasons, and score.
    """
    cfg = config or load_strategy_config()
    entry = cfg["entry"]

    failures: list[str] = []
    warnings: list[str] = []
    score = 100

    # --- Trend ---
    if entry["trend"]["above_ma200"] and ma200 is not None:
        if price <= ma200:
            failures.append(f"Price {price:.2f} below MA200 {ma200:.2f}")
            score -= 25

    if entry["trend"]["above_ma50"] and ma50 is not None:
        if price <= ma50:
            warnings.append(f"Price {price:.2f} below MA50 {ma50:.2f}")
            score -= 10

    # --- Momentum ---
    if rsi is not None:
        if rsi < entry["momentum"]["rsi_min"]:
            failures.append(f"RSI {rsi:.1f} below min {entry['momentum']['rsi_min']}")
            score -= 15
        if rsi > entry["momentum"]["rsi_max"]:
            failures.append(f"RSI {rsi:.1f} above max {entry['momentum']['rsi_max']}")
            score -= 20
        if (
            entry["momentum"]["rsi_ideal_min"]
            <= rsi
            <= entry["momentum"]["rsi_ideal_max"]
        ):
            score += 5  # Bonus for ideal range

    # --- Cushion ---
    if cushion_pct is not None:
        if cushion_pct < entry["cushion"]["minimum_pct"]:
            failures.append(
                f"Cushion {cushion_pct:.1f}% below min "
                f"{entry['cushion']['minimum_pct']}%"
            )
            score -= 20
        elif cushion_pct >= entry["cushion"]["excellent_pct"]:
            score += 10  # Excellent cushion bonus
        elif cushion_pct >= entry["cushion"]["preferred_pct"]:
            score += 5  # Good cushion bonus

    # --- Volatility ---
    if iv is not None:
        if iv > entry["volatility"]["avoid_if_iv_above"]:
            failures.append(
                f"IV {iv:.0f}% above hard limit "
                f"{entry['volatility']['avoid_if_iv_above']}%"
            )
            score -= 25
        elif iv > entry["volatility"]["iv_max_pct"]:
            warnings.append(
                f"IV {iv:.0f}% above preferred max {entry['volatility']['iv_max_pct']}%"
            )
            score -= 10
        elif iv <= entry["volatility"]["iv_preferred_max_pct"]:
            score += 5  # Low IV bonus

    # --- Earnings ---
    if days_to_earnings is not None:
        if days_to_earnings < entry["earnings"]["min_days_until"]:
            failures.append(
                f"Only {days_to_earnings} days to earnings "
                f"(min: {entry['earnings']['min_days_until']})"
            )
            score -= 20
        elif days_to_earnings >= entry["earnings"]["preferred_days_until"]:
            score += 5  # Comfortable earnings buffer

    # --- Sentiment ---
    if analyst_bullish_pct is not None:
        if analyst_bullish_pct < entry["sentiment"]["analyst_bullish_min_pct"]:
            failures.append(
                f"Analyst bullish {analyst_bullish_pct:.0f}% below min "
                f"{entry['sentiment']['analyst_bullish_min_pct']}%"
            )
            score -= 15
        elif analyst_bullish_pct >= entry["sentiment"]["analyst_bullish_preferred"]:
            score += 5  # Strong analyst support

    # --- Return on Risk ---
    if return_on_risk_pct is not None:
        if return_on_risk_pct < entry["spread"]["min_return_on_risk_pct"]:
            failures.append(
                f"R/R {return_on_risk_pct:.1f}% below min "
                f"{entry['spread']['min_return_on_risk_pct']}%"
            )
            score -= 10
        elif return_on_risk_pct >= entry["spread"]["preferred_ror_pct"]:
            score += 5  # Good R/R bonus

    return EntryValidation(
        passed=len(failures) == 0,
        failures=failures,
        warnings=warnings,
        score=max(0, min(100, score)),
    )


def get_position_sizing(
    account_size: float,
    config: dict | None = None,
) -> PositionSizingResult:
    """Get position sizing based on account size."""
    cfg = config or load_strategy_config()
    sizing = cfg["position_sizing"]

    # Find matching scaling rule
    rule = None
    for r in sizing["scaling"]:
        if r["account_min"] <= account_size < r["account_max"]:
            rule = r
            break

    if rule is None:
        rule = sizing["scaling"][-1]

    return PositionSizingResult(
        max_position_pct=rule["max_position_pct"],
        max_position_dollars=account_size * rule["max_position_pct"] / 100,
        max_positions=rule["max_positions"],
        max_deployed=account_size * sizing["max_total_deployed_pct"] / 100,
    )


def get_spread_width(
    account_size: float,
    config: dict | None = None,
) -> SpreadWidthResult:
    """Get spread width recommendation based on account size."""
    cfg = config or load_strategy_config()

    rule = None
    for w in cfg["spread_params"]["width"]:
        if account_size <= w["account_max"]:
            rule = w
            break

    if rule is None:
        rule = cfg["spread_params"]["width"][-1]

    return SpreadWidthResult(
        width=rule["width"],
        typical_debit=rule["typical_debit"],
    )


def get_exit_rules(config: dict | None = None) -> dict:
    """Get exit rules from config."""
    cfg = config or load_strategy_config()
    return cfg["exit"]


def get_circuit_breakers(config: dict | None = None) -> dict:
    """Get circuit breaker rules from config."""
    cfg = config or load_strategy_config()
    return cfg["risk_management"]["circuit_breakers"]


def is_ticker_allowed(
    ticker: str,
    config: dict | None = None,
) -> bool:
    """Check if ticker is allowed (not blacklisted)."""
    cfg = config or load_strategy_config()
    blacklist = cfg["risk_management"]["blacklist"]["tickers"]
    return ticker.upper() not in [t.upper() for t in blacklist]


def get_ticker_tier(
    ticker: str,
    config: dict | None = None,
) -> int | None:
    """Get the tier of a ticker (1, 2, 3) or None if not in universe."""
    cfg = config or load_strategy_config()
    ticker_upper = ticker.upper()

    if ticker_upper in [t.upper() for t in cfg["universe"]["tier1"]]:
        return 1
    if ticker_upper in [t.upper() for t in cfg["universe"]["tier2"]]:
        return 2
    if ticker_upper in [t.upper() for t in cfg["universe"]["tier3"]]:
        return 3

    return None


# =============================================================================
# CLI HELPER
# =============================================================================


def print_validation(validation: EntryValidation, ticker: str = "") -> None:
    """Pretty print validation result."""
    prefix = f"[{ticker}] " if ticker else ""

    if validation.passed:
        print(f"{prefix}✅ PASSED (Score: {validation.score})")
    else:
        print(f"{prefix}❌ FAILED (Score: {validation.score})")

    if validation.failures:
        print("  Failures:")
        for f in validation.failures:
            print(f"    ✗ {f}")

    if validation.warnings:
        print("  Warnings:")
        for w in validation.warnings:
            print(f"    ⚠ {w}")


# =============================================================================
# EXAMPLE USAGE
# =============================================================================

if __name__ == "__main__":
    # Example: Validate a trade
    result = validate_entry(
        price=188.61,
        ma200=175.00,
        ma50=180.00,
        rsi=42,
        cushion_pct=8.5,
        iv=35,
        days_to_earnings=25,
        analyst_bullish_pct=85,
        return_on_risk_pct=22,
    )

    print_validation(result, "NVDA")

    # Example: Get position sizing
    sizing = get_position_sizing(5000)
    print("\nPosition Sizing for $5,000 account:")
    print(
        f"  Max per position: ${sizing.max_position_dollars:.0f} "
        f"({sizing.max_position_pct}%)"
    )
    print(f"  Max positions: {sizing.max_positions}")
    print(f"  Max deployed: ${sizing.max_deployed:.0f}")

    # Example: Get spread width
    width = get_spread_width(5000)
    print("\nSpread Width for $5,000 account:")
    print(f"  Width: ${width.width}")
    print(f"  Typical debit: ${width.typical_debit}")
