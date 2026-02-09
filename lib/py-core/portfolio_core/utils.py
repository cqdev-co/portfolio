"""
Shared Utility Functions

Common calculations and helpers used across multiple Python services.
"""

from typing import Optional


def safe_divide(
    numerator: float,
    denominator: float,
    default: float = 0.0,
) -> float:
    """
    Safely divide two numbers, returning a default on zero denominator.

    Args:
        numerator: The dividend
        denominator: The divisor
        default: Value to return if denominator is zero

    Returns:
        Result of division or default value
    """
    if denominator == 0:
        return default
    return numerator / denominator


def clamp(value: float, min_val: float, max_val: float) -> float:
    """
    Clamp a value between a minimum and maximum.

    Args:
        value: The value to clamp
        min_val: Minimum bound
        max_val: Maximum bound

    Returns:
        Clamped value
    """
    return max(min_val, min(value, max_val))


def normalize_score(
    value: float,
    min_val: float,
    max_val: float,
    target_min: float = 0.0,
    target_max: float = 1.0,
) -> float:
    """
    Normalize a value from one range to another.

    Args:
        value: The value to normalize
        min_val: Source range minimum
        max_val: Source range maximum
        target_min: Target range minimum (default: 0.0)
        target_max: Target range maximum (default: 1.0)

    Returns:
        Normalized value in target range, clamped to bounds
    """
    if max_val == min_val:
        return target_min
    normalized = (value - min_val) / (max_val - min_val)
    scaled = target_min + normalized * (target_max - target_min)
    return clamp(scaled, target_min, target_max)


def pct_change(current: float, previous: float) -> Optional[float]:
    """
    Calculate percentage change between two values.

    Args:
        current: Current value
        previous: Previous value

    Returns:
        Percentage change, or None if previous is zero
    """
    if previous == 0:
        return None
    return ((current - previous) / abs(previous)) * 100


def format_currency(value: float, decimals: int = 2) -> str:
    """Format a number as currency string."""
    if value >= 0:
        return f"${value:,.{decimals}f}"
    return f"-${abs(value):,.{decimals}f}"


def format_pct(value: float, decimals: int = 1) -> str:
    """Format a number as percentage string."""
    sign = "+" if value > 0 else ""
    return f"{sign}{value:.{decimals}f}%"
