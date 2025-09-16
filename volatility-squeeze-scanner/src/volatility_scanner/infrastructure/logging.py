"""
Enhanced logging infrastructure with structured logging, correlation IDs, and performance monitoring.
Implements enterprise-grade logging practices for observability and debugging.
"""

import logging
import logging.handlers
import json
import sys
import time
import uuid
from datetime import datetime
from typing import Dict, Any, Optional, Union
from pathlib import Path
from contextvars import ContextVar
from functools import wraps
import traceback

from loguru import logger as loguru_logger
from pythonjsonlogger import jsonlogger

from ..config.enhanced_settings import get_enhanced_settings, LogLevel, LogFormat


# Context variables for request tracking
correlation_id_var: ContextVar[Optional[str]] = ContextVar('correlation_id', default=None)
user_id_var: ContextVar[Optional[str]] = ContextVar('user_id', default=None)
request_id_var: ContextVar[Optional[str]] = ContextVar('request_id', default=None)


class CorrelationIdFilter(logging.Filter):
    """Logging filter to add correlation ID to log records."""
    
    def filter(self, record: logging.LogRecord) -> bool:
        """Add correlation ID and other context to log record."""
        record.correlation_id = correlation_id_var.get() or "unknown"
        record.user_id = user_id_var.get() or "anonymous"
        record.request_id = request_id_var.get() or "no-request"
        record.timestamp = datetime.utcnow().isoformat()
        return True


class PerformanceFilter(logging.Filter):
    """Logging filter to add performance metrics."""
    
    def __init__(self):
        super().__init__()
        self.start_time = time.time()
    
    def filter(self, record: logging.LogRecord) -> bool:
        """Add performance metrics to log record."""
        record.uptime = time.time() - self.start_time
        return True


class StructuredFormatter(jsonlogger.JsonFormatter):
    """Custom JSON formatter for structured logging."""
    
    def add_fields(self, log_record: Dict[str, Any], record: logging.LogRecord, message_dict: Dict[str, Any]) -> None:
        """Add custom fields to log record."""
        super().add_fields(log_record, record, message_dict)
        
        # Add standard fields
        log_record['timestamp'] = datetime.utcnow().isoformat()
        log_record['level'] = record.levelname
        log_record['logger'] = record.name
        log_record['module'] = record.module
        log_record['function'] = record.funcName
        log_record['line'] = record.lineno
        
        # Add context fields
        log_record['correlation_id'] = getattr(record, 'correlation_id', 'unknown')
        log_record['user_id'] = getattr(record, 'user_id', 'anonymous')
        log_record['request_id'] = getattr(record, 'request_id', 'no-request')
        
        # Add performance fields
        log_record['uptime'] = getattr(record, 'uptime', 0)
        
        # Add exception info if present
        if record.exc_info:
            log_record['exception'] = {
                'type': record.exc_info[0].__name__ if record.exc_info[0] else None,
                'message': str(record.exc_info[1]) if record.exc_info[1] else None,
                'traceback': traceback.format_exception(*record.exc_info)
            }


class SecurityFilter(logging.Filter):
    """Filter to remove sensitive information from logs."""
    
    SENSITIVE_FIELDS = {
        'password', 'token', 'api_key', 'secret', 'auth', 'authorization',
        'cookie', 'session', 'csrf', 'private_key', 'credit_card', 'ssn'
    }
    
    def filter(self, record: logging.LogRecord) -> bool:
        """Remove sensitive information from log messages."""
        if hasattr(record, 'msg') and isinstance(record.msg, str):
            record.msg = self._sanitize_message(record.msg)
        
        if hasattr(record, 'args') and record.args:
            record.args = tuple(
                self._sanitize_value(arg) for arg in record.args
            )
        
        return True
    
    def _sanitize_message(self, message: str) -> str:
        """Sanitize sensitive information in message."""
        # Simple implementation - in production, use more sophisticated regex
        for field in self.SENSITIVE_FIELDS:
            if field.lower() in message.lower():
                # Replace with masked value
                message = message.replace(field, f"{field}=***MASKED***")
        return message
    
    def _sanitize_value(self, value: Any) -> Any:
        """Sanitize sensitive values."""
        if isinstance(value, dict):
            return {
                k: "***MASKED***" if any(sensitive in k.lower() for sensitive in self.SENSITIVE_FIELDS)
                else self._sanitize_value(v)
                for k, v in value.items()
            }
        elif isinstance(value, str):
            return self._sanitize_message(value)
        return value


class LoggerManager:
    """
    Centralized logger management with enterprise features.
    Handles configuration, formatting, and routing of log messages.
    """
    
    def __init__(self):
        self.settings = get_enhanced_settings()
        self.loggers: Dict[str, logging.Logger] = {}
        self._configured = False
    
    def configure_logging(self) -> None:
        """Configure application-wide logging."""
        if self._configured:
            return
        
        # Configure root logger
        root_logger = logging.getLogger()
        root_logger.setLevel(getattr(logging, self.settings.log_level.value))
        
        # Remove default handlers
        for handler in root_logger.handlers[:]:
            root_logger.removeHandler(handler)
        
        # Configure handlers based on format
        if self.settings.log_format == LogFormat.JSON:
            self._configure_json_logging()
        else:
            self._configure_text_logging()
        
        # Configure loguru for enhanced features
        self._configure_loguru()
        
        self._configured = True
    
    def _configure_json_logging(self) -> None:
        """Configure JSON structured logging."""
        formatter = StructuredFormatter(
            fmt='%(timestamp)s %(level)s %(logger)s %(correlation_id)s %(message)s'
        )
        
        # Console handler
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setFormatter(formatter)
        console_handler.addFilter(CorrelationIdFilter())
        console_handler.addFilter(PerformanceFilter())
        console_handler.addFilter(SecurityFilter())
        
        # File handler (if configured)
        if self.settings.log_file_path:
            file_handler = logging.handlers.RotatingFileHandler(
                filename=self.settings.log_file_path,
                maxBytes=self._parse_size(self.settings.log_rotation_size),
                backupCount=self.settings.log_retention_days
            )
            file_handler.setFormatter(formatter)
            file_handler.addFilter(CorrelationIdFilter())
            file_handler.addFilter(PerformanceFilter())
            file_handler.addFilter(SecurityFilter())
            
            logging.getLogger().addHandler(file_handler)
        
        logging.getLogger().addHandler(console_handler)
    
    def _configure_text_logging(self) -> None:
        """Configure text-based logging."""
        formatter = logging.Formatter(
            fmt='%(asctime)s - %(name)s - %(levelname)s - %(correlation_id)s - %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setFormatter(formatter)
        console_handler.addFilter(CorrelationIdFilter())
        console_handler.addFilter(SecurityFilter())
        
        logging.getLogger().addHandler(console_handler)
    
    def _configure_loguru(self) -> None:
        """Configure loguru for enhanced logging features."""
        # Remove default loguru handler
        loguru_logger.remove()
        
        # Add custom loguru configuration
        log_format = (
            "<green>{time:YYYY-MM-DD HH:mm:ss}</green> | "
            "<level>{level: <8}</level> | "
            "<cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> | "
            "<level>{message}</level>"
        )
        
        if self.settings.log_format == LogFormat.JSON:
            # JSON format for loguru
            loguru_logger.add(
                sys.stdout,
                format="{time} {level} {name} {function} {line} {message}",
                serialize=True,
                level=self.settings.log_level.value
            )
        else:
            # Text format for loguru
            loguru_logger.add(
                sys.stdout,
                format=log_format,
                level=self.settings.log_level.value,
                colorize=True
            )
        
        # Add file handler for loguru
        if self.settings.log_file_path:
            loguru_logger.add(
                self.settings.log_file_path,
                rotation=self.settings.log_rotation_size,
                retention=f"{self.settings.log_retention_days} days",
                compression="zip",
                serialize=self.settings.log_format == LogFormat.JSON,
                level=self.settings.log_level.value
            )
    
    def get_logger(self, name: str) -> logging.Logger:
        """Get or create a logger with the specified name."""
        if name not in self.loggers:
            self.loggers[name] = logging.getLogger(name)
        return self.loggers[name]
    
    def _parse_size(self, size_str: str) -> int:
        """Parse size string (e.g., '100 MB') to bytes."""
        size_str = size_str.upper().strip()
        if 'KB' in size_str:
            return int(size_str.replace('KB', '').strip()) * 1024
        elif 'MB' in size_str:
            return int(size_str.replace('MB', '').strip()) * 1024 * 1024
        elif 'GB' in size_str:
            return int(size_str.replace('GB', '').strip()) * 1024 * 1024 * 1024
        else:
            return int(size_str)


# Global logger manager instance
logger_manager = LoggerManager()


def setup_logging() -> None:
    """Setup application logging."""
    logger_manager.configure_logging()


def get_logger(name: str) -> logging.Logger:
    """Get a logger instance."""
    return logger_manager.get_logger(name)


def set_correlation_id(correlation_id: str) -> None:
    """Set correlation ID for current context."""
    correlation_id_var.set(correlation_id)


def get_correlation_id() -> Optional[str]:
    """Get current correlation ID."""
    return correlation_id_var.get()


def set_user_id(user_id: str) -> None:
    """Set user ID for current context."""
    user_id_var.set(user_id)


def set_request_id(request_id: str) -> None:
    """Set request ID for current context."""
    request_id_var.set(request_id)


def generate_correlation_id() -> str:
    """Generate a new correlation ID."""
    return str(uuid.uuid4())


def with_correlation_id(func):
    """Decorator to automatically generate correlation ID for function calls."""
    @wraps(func)
    def wrapper(*args, **kwargs):
        if not get_correlation_id():
            set_correlation_id(generate_correlation_id())
        return func(*args, **kwargs)
    
    @wraps(func)
    async def async_wrapper(*args, **kwargs):
        if not get_correlation_id():
            set_correlation_id(generate_correlation_id())
        return await func(*args, **kwargs)
    
    return async_wrapper if hasattr(func, '__call__') and hasattr(func, '__await__') else wrapper


def log_performance(operation_name: str):
    """Decorator to log performance metrics for functions."""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            start_time = time.time()
            logger = get_logger(func.__module__)
            
            try:
                result = func(*args, **kwargs)
                duration = time.time() - start_time
                
                logger.info(
                    f"Operation completed: {operation_name}",
                    extra={
                        'operation': operation_name,
                        'duration_ms': duration * 1000,
                        'success': True,
                        'function': func.__name__,
                        'module': func.__module__
                    }
                )
                return result
            
            except Exception as e:
                duration = time.time() - start_time
                logger.error(
                    f"Operation failed: {operation_name}",
                    extra={
                        'operation': operation_name,
                        'duration_ms': duration * 1000,
                        'success': False,
                        'error': str(e),
                        'error_type': type(e).__name__,
                        'function': func.__name__,
                        'module': func.__module__
                    },
                    exc_info=True
                )
                raise
        
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            start_time = time.time()
            logger = get_logger(func.__module__)
            
            try:
                result = await func(*args, **kwargs)
                duration = time.time() - start_time
                
                logger.info(
                    f"Async operation completed: {operation_name}",
                    extra={
                        'operation': operation_name,
                        'duration_ms': duration * 1000,
                        'success': True,
                        'function': func.__name__,
                        'module': func.__module__
                    }
                )
                return result
            
            except Exception as e:
                duration = time.time() - start_time
                logger.error(
                    f"Async operation failed: {operation_name}",
                    extra={
                        'operation': operation_name,
                        'duration_ms': duration * 1000,
                        'success': False,
                        'error': str(e),
                        'error_type': type(e).__name__,
                        'function': func.__name__,
                        'module': func.__module__
                    },
                    exc_info=True
                )
                raise
        
        return async_wrapper if hasattr(func, '__call__') and hasattr(func, '__await__') else wrapper
    
    return decorator


class AuditLogger:
    """Specialized logger for audit events."""
    
    def __init__(self):
        self.logger = get_logger('audit')
    
    def log_user_action(
        self, 
        user_id: str, 
        action: str, 
        resource: str, 
        success: bool = True,
        metadata: Optional[Dict[str, Any]] = None
    ) -> None:
        """Log user actions for audit purposes."""
        self.logger.info(
            f"User action: {action}",
            extra={
                'audit_event': True,
                'user_id': user_id,
                'action': action,
                'resource': resource,
                'success': success,
                'metadata': metadata or {},
                'timestamp': datetime.utcnow().isoformat()
            }
        )
    
    def log_system_event(
        self, 
        event_type: str, 
        description: str, 
        severity: str = 'INFO',
        metadata: Optional[Dict[str, Any]] = None
    ) -> None:
        """Log system events for audit purposes."""
        log_method = getattr(self.logger, severity.lower(), self.logger.info)
        log_method(
            f"System event: {event_type}",
            extra={
                'audit_event': True,
                'event_type': event_type,
                'description': description,
                'severity': severity,
                'metadata': metadata or {},
                'timestamp': datetime.utcnow().isoformat()
            }
        )


# Global audit logger instance
audit_logger = AuditLogger()
