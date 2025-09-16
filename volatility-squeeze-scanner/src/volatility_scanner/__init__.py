"""
Volatility Squeeze Scanner - Enterprise-grade market analysis service.

A comprehensive service for detecting volatility squeezes in equities and ETFs,
with AI-powered analysis and backtesting capabilities.
"""

__version__ = "0.1.0"
__author__ = "Conor Quinlan"
__email__ = "conorq@icloud.com"

from volatility_scanner.core.exceptions import (
    VolatilityScannerError,
    DataError,
    AnalysisError,
    BacktestError,
)

__all__ = [
    "__version__",
    "__author__",
    "__email__",
    "VolatilityScannerError",
    "DataError", 
    "AnalysisError",
    "BacktestError",
]
