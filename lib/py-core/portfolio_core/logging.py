"""
Logging Configuration

Provides consistent loguru setup across all Python services.

Usage:
    from portfolio_core import setup_logging

    setup_logging(level="DEBUG", service_name="unusual-options")
"""

import sys

from loguru import logger


def setup_logging(
    level: str = "INFO",
    service_name: str = "portfolio",
    enable_file: bool = False,
    log_dir: str = "logs",
) -> None:
    """
    Configure loguru with consistent formatting.

    Args:
        level: Minimum log level (DEBUG, INFO, WARNING, ERROR)
        service_name: Name to include in log format
        enable_file: Whether to also log to a file
        log_dir: Directory for log files (if enabled)
    """
    # Remove default handler
    logger.remove()

    # Console handler with color
    log_format = (
        "<green>{time:HH:mm:ss}</green> | "
        "<level>{level: <8}</level> | "
        f"<cyan>{service_name}</cyan> | "
        "<level>{message}</level>"
    )
    logger.add(sys.stderr, format=log_format, level=level, colorize=True)

    # Optional file handler
    if enable_file:
        file_format = (
            "{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | "
            f"{service_name} | {{message}}"
        )
        logger.add(
            f"{log_dir}/{service_name}.log",
            format=file_format,
            level=level,
            rotation="10 MB",
            retention="7 days",
            compression="gz",
        )
