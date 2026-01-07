"""Helper utility functions for penny stock scanner."""

from typing import Optional


def safe_divide(numerator: float, denominator: float, default: float = 0.0) -> float:
    """
    Safely divide two numbers, returning default if denominator is zero.

    Args:
        numerator: The numerator
        denominator: The denominator
        default: Default value if division by zero

    Returns:
        Result of division or default value
    """
    if denominator == 0 or denominator is None:
        return default
    return numerator / denominator


def calculate_percentage_change(
    current: float, previous: float, default: float = 0.0
) -> float:
    """
    Calculate percentage change between two values.

    Args:
        current: Current value
        previous: Previous value
        default: Default if previous is zero

    Returns:
        Percentage change
    """
    if previous == 0 or previous is None:
        return default
    return ((current - previous) / previous) * 100


def clamp(value: float, min_val: float, max_val: float) -> float:
    """
    Clamp a value between min and max.

    Args:
        value: Value to clamp
        min_val: Minimum value
        max_val: Maximum value

    Returns:
        Clamped value
    """
    return max(min_val, min(max_val, value))


def normalize_score(
    value: float, min_val: float, max_val: float, inverse: bool = False
) -> float:
    """
    Normalize a value to 0-1 range.

    Args:
        value: Value to normalize
        min_val: Minimum expected value
        max_val: Maximum expected value
        inverse: If True, invert the score (lower is better)

    Returns:
        Normalized score (0-1)
    """
    if max_val == min_val:
        return 0.5

    score = (value - min_val) / (max_val - min_val)
    score = clamp(score, 0.0, 1.0)

    if inverse:
        score = 1.0 - score

    return score
