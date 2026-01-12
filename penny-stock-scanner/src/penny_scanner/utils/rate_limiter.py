"""
Rate limiter for Yahoo Finance API calls.

Yahoo Finance has rate limits (~2000 requests/hour, ~100/minute aggressive).
This module provides rate limiting and exponential backoff to avoid 429 errors.
"""

import asyncio
import time
from collections import deque
from dataclasses import dataclass, field
from typing import Any
from collections.abc import Callable

from loguru import logger


@dataclass
class RateLimiterConfig:
    """Configuration for rate limiter."""

    # Max requests per window
    # With batch downloads, we make fewer but larger requests
    requests_per_minute: int = 60  # Increased - batch downloads are efficient
    requests_per_hour: int = 2000  # yfinance allows ~2000/hour

    # Delays - reduced for faster scanning
    min_delay_between_requests: float = 0.2  # 200ms minimum
    batch_delay: float = 1.0  # 1s between batches

    # Backoff settings
    initial_backoff: float = 5.0  # Start with 5 second backoff
    max_backoff: float = 120.0  # Max 2 minute backoff
    backoff_multiplier: float = 2.0  # Double each retry

    # Retry settings
    max_retries: int = 3


@dataclass
class RateLimiter:
    """
    Rate limiter with sliding window and exponential backoff.

    Tracks request timestamps and enforces rate limits to avoid
    Yahoo Finance 429 errors.
    """

    config: RateLimiterConfig = field(default_factory=RateLimiterConfig)

    # Request tracking
    _minute_requests: deque = field(default_factory=deque)
    _hour_requests: deque = field(default_factory=deque)
    _last_request_time: float = field(default=0.0)

    # Backoff state
    _current_backoff: float = field(default=0.0)
    _consecutive_errors: int = field(default=0)

    def __post_init__(self):
        """Initialize deques if not already done."""
        if not isinstance(self._minute_requests, deque):
            self._minute_requests = deque()
        if not isinstance(self._hour_requests, deque):
            self._hour_requests = deque()

    def _clean_old_requests(self):
        """Remove requests outside the time windows."""
        now = time.time()

        # Clean minute window (60 seconds)
        while self._minute_requests and now - self._minute_requests[0] > 60:
            self._minute_requests.popleft()

        # Clean hour window (3600 seconds)
        while self._hour_requests and now - self._hour_requests[0] > 3600:
            self._hour_requests.popleft()

    def _get_wait_time(self) -> float:
        """Calculate how long to wait before next request."""
        now = time.time()
        self._clean_old_requests()

        # Check if we need to wait for backoff
        if self._current_backoff > 0:
            return self._current_backoff

        wait_times = []

        # Enforce minimum delay between requests
        time_since_last = now - self._last_request_time
        if time_since_last < self.config.min_delay_between_requests:
            wait_times.append(self.config.min_delay_between_requests - time_since_last)

        # Check minute limit
        if len(self._minute_requests) >= self.config.requests_per_minute:
            oldest_in_minute = self._minute_requests[0]
            wait_for_minute = 60 - (now - oldest_in_minute) + 1
            wait_times.append(wait_for_minute)

        # Check hour limit
        if len(self._hour_requests) >= self.config.requests_per_hour:
            oldest_in_hour = self._hour_requests[0]
            wait_for_hour = 3600 - (now - oldest_in_hour) + 1
            wait_times.append(wait_for_hour)

        return max(wait_times) if wait_times else 0

    async def acquire(self):
        """
        Wait until a request can be made within rate limits.

        This should be called before each API request.
        """
        wait_time = self._get_wait_time()

        if wait_time > 0:
            logger.debug(f"Rate limiter: waiting {wait_time:.1f}s")
            await asyncio.sleep(wait_time)

        # Record this request
        now = time.time()
        self._minute_requests.append(now)
        self._hour_requests.append(now)
        self._last_request_time = now

    def record_success(self):
        """Record a successful request, reset backoff."""
        self._consecutive_errors = 0
        self._current_backoff = 0

    def record_rate_limit_error(self):
        """
        Record a rate limit error, increase backoff.

        Returns the backoff time to wait.
        """
        self._consecutive_errors += 1

        if self._current_backoff == 0:
            self._current_backoff = self.config.initial_backoff
        else:
            self._current_backoff = min(
                self._current_backoff * self.config.backoff_multiplier,
                self.config.max_backoff,
            )

        logger.warning(
            f"Rate limit hit! Backoff: {self._current_backoff:.1f}s "
            f"(error #{self._consecutive_errors})"
        )

        return self._current_backoff

    def should_retry(self) -> bool:
        """Check if we should retry after a rate limit error."""
        return self._consecutive_errors <= self.config.max_retries

    def get_stats(self) -> dict:
        """Get current rate limiter statistics."""
        self._clean_old_requests()
        return {
            "requests_last_minute": len(self._minute_requests),
            "requests_last_hour": len(self._hour_requests),
            "consecutive_errors": self._consecutive_errors,
            "current_backoff": self._current_backoff,
        }


# Global rate limiter instance
_rate_limiter: RateLimiter | None = None


def get_rate_limiter() -> RateLimiter:
    """Get or create the global rate limiter instance."""
    global _rate_limiter
    if _rate_limiter is None:
        _rate_limiter = RateLimiter()
    return _rate_limiter


async def rate_limited_call(
    func: Callable,
    *args,
    rate_limiter: RateLimiter | None = None,
    **kwargs,
) -> Any:
    """
    Execute a function with rate limiting and retry logic.

    Args:
        func: The function to call (can be sync or async)
        *args: Positional arguments for the function
        rate_limiter: Rate limiter instance (uses global if not provided)
        **kwargs: Keyword arguments for the function

    Returns:
        The function's return value

    Raises:
        The function's exception after max retries
    """
    limiter = rate_limiter or get_rate_limiter()

    last_error = None

    while limiter.should_retry():
        # Wait for rate limit
        await limiter.acquire()

        try:
            # Call the function
            if asyncio.iscoroutinefunction(func):
                result = await func(*args, **kwargs)
            else:
                result = func(*args, **kwargs)

            limiter.record_success()
            return result

        except Exception as e:
            error_str = str(e).lower()

            # Check if it's a rate limit error
            if "rate limit" in error_str or "too many requests" in error_str:
                backoff = limiter.record_rate_limit_error()
                logger.warning(f"Rate limited, backing off {backoff:.1f}s...")
                await asyncio.sleep(backoff)
                last_error = e
            else:
                # Non-rate-limit error, don't retry
                raise

    # Max retries exceeded
    raise last_error or Exception("Rate limit retries exceeded")
