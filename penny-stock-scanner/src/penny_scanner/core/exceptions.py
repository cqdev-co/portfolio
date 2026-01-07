"""Custom exceptions for the penny stock scanner."""


class PennyScannerError(Exception):
    """Base exception for penny scanner errors."""

    pass


class DataServiceError(PennyScannerError):
    """Raised when data service encounters an error."""

    pass


class AnalysisError(PennyScannerError):
    """Raised when analysis fails."""

    pass


class DatabaseError(PennyScannerError):
    """Raised when database operations fail."""

    pass


class ConfigurationError(PennyScannerError):
    """Raised when configuration is invalid."""

    pass
