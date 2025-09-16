"""Helper utility functions."""

from typing import List, Optional, Union
import numpy as np


def calculate_percentile(
    values: List[float], 
    target_value: float
) -> float:
    """
    Calculate the percentile of a target value within a list of values.
    
    Args:
        values: List of numerical values
        target_value: Value to find percentile for
        
    Returns:
        Percentile (0-100)
    """
    if not values:
        return 50.0
    
    values_array = np.array(values)
    percentile = (np.sum(values_array <= target_value) / len(values_array)) * 100
    return percentile


def normalize_symbol(symbol: str) -> str:
    """
    Normalize a stock symbol to standard format.
    
    Args:
        symbol: Raw symbol string
        
    Returns:
        Normalized symbol (uppercase, stripped)
    """
    return symbol.upper().strip()


def format_percentage(value: float, decimal_places: int = 1) -> str:
    """
    Format a decimal value as a percentage string.
    
    Args:
        value: Decimal value (e.g., 0.15 for 15%)
        decimal_places: Number of decimal places
        
    Returns:
        Formatted percentage string
    """
    return f"{value * 100:.{decimal_places}f}%"


def safe_divide(
    numerator: Union[float, int], 
    denominator: Union[float, int],
    default: float = 0.0
) -> float:
    """
    Safely divide two numbers, returning default if denominator is zero.
    
    Args:
        numerator: Numerator value
        denominator: Denominator value
        default: Default value if division by zero
        
    Returns:
        Division result or default value
    """
    if denominator == 0:
        return default
    return numerator / denominator


def calculate_true_range(
    high: float,
    low: float, 
    prev_close: Optional[float] = None
) -> float:
    """
    Calculate True Range for a single period.
    
    Args:
        high: High price
        low: Low price
        prev_close: Previous period's close price
        
    Returns:
        True Range value
    """
    if prev_close is None:
        return high - low
    
    return max(
        high - low,
        abs(high - prev_close),
        abs(low - prev_close)
    )


def calculate_sma(values: List[float], period: int) -> List[Optional[float]]:
    """
    Calculate Simple Moving Average.
    
    Args:
        values: List of values
        period: Moving average period
        
    Returns:
        List of SMA values (None for insufficient data)
    """
    if len(values) < period:
        return [None] * len(values)
    
    sma_values = []
    for i in range(len(values)):
        if i < period - 1:
            sma_values.append(None)
        else:
            window_values = values[i - period + 1:i + 1]
            sma_values.append(sum(window_values) / period)
    
    return sma_values


def calculate_ema(
    values: List[float], 
    period: int,
    smoothing: float = 2.0
) -> List[Optional[float]]:
    """
    Calculate Exponential Moving Average.
    
    Args:
        values: List of values
        period: EMA period
        smoothing: Smoothing factor (default 2.0)
        
    Returns:
        List of EMA values (None for insufficient data)
    """
    if not values or period <= 0:
        return [None] * len(values)
    
    multiplier = smoothing / (period + 1)
    ema_values = []
    
    # First EMA value is just the first price
    ema_values.append(values[0])
    
    # Calculate subsequent EMA values
    for i in range(1, len(values)):
        ema = (values[i] * multiplier) + (ema_values[i-1] * (1 - multiplier))
        ema_values.append(ema)
    
    return ema_values


def validate_ohlc_data(
    open_price: float,
    high: float,
    low: float,
    close: float
) -> bool:
    """
    Validate OHLC data for consistency.
    
    Args:
        open_price: Opening price
        high: High price
        low: Low price
        close: Closing price
        
    Returns:
        True if data is valid, False otherwise
    """
    # Check that high is the highest and low is the lowest
    if high < max(open_price, close) or low > min(open_price, close):
        return False
    
    # Check that all values are positive
    if any(price <= 0 for price in [open_price, high, low, close]):
        return False
    
    return True


def calculate_volatility(prices: List[float], period: int = 20) -> Optional[float]:
    """
    Calculate price volatility (standard deviation of returns).
    
    Args:
        prices: List of prices
        period: Period for volatility calculation
        
    Returns:
        Volatility value or None if insufficient data
    """
    if len(prices) < period + 1:
        return None
    
    # Calculate returns
    returns = []
    for i in range(1, len(prices)):
        if prices[i-1] != 0:
            return_val = (prices[i] - prices[i-1]) / prices[i-1]
            returns.append(return_val)
    
    if len(returns) < period:
        return None
    
    # Use the last 'period' returns
    recent_returns = returns[-period:]
    
    # Calculate standard deviation
    mean_return = sum(recent_returns) / len(recent_returns)
    variance = sum((r - mean_return) ** 2 for r in recent_returns) / len(recent_returns)
    volatility = variance ** 0.5
    
    # Annualize (assuming daily data)
    return volatility * (252 ** 0.5)
