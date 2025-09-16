"""Custom exceptions for the volatility scanner service."""


class VolatilityScannerError(Exception):
    """Base exception for all volatility scanner errors."""
    
    def __init__(self, message: str, error_code: str = None) -> None:
        """Initialize the exception with message and optional error code."""
        super().__init__(message)
        self.message = message
        self.error_code = error_code or self.__class__.__name__


class DataError(VolatilityScannerError):
    """Exception raised for data-related errors."""
    pass


class AnalysisError(VolatilityScannerError):
    """Exception raised for analysis-related errors."""
    pass


class BacktestError(VolatilityScannerError):
    """Exception raised for backtesting-related errors."""
    pass


class ValidationError(VolatilityScannerError):
    """Exception raised for validation errors."""
    pass


class ConfigurationError(VolatilityScannerError):
    """Exception raised for configuration errors."""
    pass


class ExternalServiceError(VolatilityScannerError):
    """Exception raised for external service errors."""
    pass
