"""
Dependency injection container for managing application dependencies.
Implements the Dependency Inversion Principle and facilitates testing.
"""

from typing import Dict, Any, TypeVar, Type, Callable, Optional
from abc import ABC, abstractmethod
import inspect
from functools import wraps
import asyncio

from ..config.settings import Settings
from ..domain.repositories import (
    IMarketDataRepository, ISignalRepository, IIndicatorRepository, IBacktestRepository
)
from ..domain.services import (
    IVolatilitySqueezeDetector, ITechnicalAnalysisService, IMarketRegimeDetector,
    VolatilitySqueezeDetectorService, RiskManagementService, MarketRegimeDetectorService,
    SqueezeDetectionConfig, RiskManagementConfig
)
from ..application.use_cases import (
    IAnalyzeSymbolUseCase, IBatchAnalysisUseCase, IBacktestUseCase,
    AnalyzeSymbolUseCase, BatchAnalysisUseCase, BacktestUseCase
)

T = TypeVar('T')


class ServiceLifetime:
    """Enumeration for service lifetimes."""
    SINGLETON = "singleton"
    TRANSIENT = "transient"
    SCOPED = "scoped"


class ServiceDescriptor:
    """Describes how a service should be registered and created."""
    
    def __init__(
        self,
        service_type: Type[T],
        implementation_type: Optional[Type[T]] = None,
        factory: Optional[Callable[..., T]] = None,
        lifetime: str = ServiceLifetime.TRANSIENT,
        **kwargs
    ):
        self.service_type = service_type
        self.implementation_type = implementation_type or service_type
        self.factory = factory
        self.lifetime = lifetime
        self.kwargs = kwargs


class IDependencyContainer(ABC):
    """Interface for dependency injection container."""
    
    @abstractmethod
    def register(
        self, 
        service_type: Type[T], 
        implementation_type: Optional[Type[T]] = None,
        lifetime: str = ServiceLifetime.TRANSIENT,
        **kwargs
    ) -> None:
        """Register a service with the container."""
        pass
    
    @abstractmethod
    def register_factory(
        self, 
        service_type: Type[T], 
        factory: Callable[..., T],
        lifetime: str = ServiceLifetime.TRANSIENT
    ) -> None:
        """Register a service factory with the container."""
        pass
    
    @abstractmethod
    def register_instance(self, service_type: Type[T], instance: T) -> None:
        """Register a service instance (singleton)."""
        pass
    
    @abstractmethod
    def resolve(self, service_type: Type[T]) -> T:
        """Resolve a service instance."""
        pass
    
    @abstractmethod
    def create_scope(self) -> 'IDependencyContainer':
        """Create a new scope for scoped services."""
        pass


class DependencyContainer(IDependencyContainer):
    """
    Dependency injection container implementation.
    Supports singleton, transient, and scoped lifetimes.
    """
    
    def __init__(self, parent: Optional['DependencyContainer'] = None):
        self._services: Dict[Type, ServiceDescriptor] = {}
        self._singletons: Dict[Type, Any] = {}
        self._scoped_instances: Dict[Type, Any] = {}
        self._parent = parent
    
    def register(
        self, 
        service_type: Type[T], 
        implementation_type: Optional[Type[T]] = None,
        lifetime: str = ServiceLifetime.TRANSIENT,
        **kwargs
    ) -> None:
        """Register a service with the container."""
        descriptor = ServiceDescriptor(
            service_type=service_type,
            implementation_type=implementation_type,
            lifetime=lifetime,
            **kwargs
        )
        self._services[service_type] = descriptor
    
    def register_factory(
        self, 
        service_type: Type[T], 
        factory: Callable[..., T],
        lifetime: str = ServiceLifetime.TRANSIENT
    ) -> None:
        """Register a service factory with the container."""
        descriptor = ServiceDescriptor(
            service_type=service_type,
            factory=factory,
            lifetime=lifetime
        )
        self._services[service_type] = descriptor
    
    def register_instance(self, service_type: Type[T], instance: T) -> None:
        """Register a service instance (singleton)."""
        self._singletons[service_type] = instance
        descriptor = ServiceDescriptor(
            service_type=service_type,
            lifetime=ServiceLifetime.SINGLETON
        )
        self._services[service_type] = descriptor
    
    def resolve(self, service_type: Type[T]) -> T:
        """Resolve a service instance."""
        # Check if already created as singleton
        if service_type in self._singletons:
            return self._singletons[service_type]
        
        # Check if already created in current scope
        if service_type in self._scoped_instances:
            return self._scoped_instances[service_type]
        
        # Check if registered in this container
        if service_type in self._services:
            return self._create_instance(service_type)
        
        # Check parent container
        if self._parent:
            return self._parent.resolve(service_type)
        
        raise ValueError(f"Service {service_type} is not registered")
    
    def create_scope(self) -> 'DependencyContainer':
        """Create a new scope for scoped services."""
        return DependencyContainer(parent=self)
    
    def _create_instance(self, service_type: Type[T]) -> T:
        """Create a new instance of the service."""
        descriptor = self._services[service_type]
        
        # Use factory if provided
        if descriptor.factory:
            instance = self._invoke_factory(descriptor.factory)
        else:
            # Create using constructor injection
            instance = self._create_with_injection(descriptor.implementation_type)
        
        # Handle lifetime
        if descriptor.lifetime == ServiceLifetime.SINGLETON:
            self._singletons[service_type] = instance
        elif descriptor.lifetime == ServiceLifetime.SCOPED:
            self._scoped_instances[service_type] = instance
        
        return instance
    
    def _invoke_factory(self, factory: Callable[..., T]) -> T:
        """Invoke a factory function with dependency injection."""
        sig = inspect.signature(factory)
        kwargs = {}
        
        for param_name, param in sig.parameters.items():
            if param.annotation != inspect.Parameter.empty:
                kwargs[param_name] = self.resolve(param.annotation)
        
        return factory(**kwargs)
    
    def _create_with_injection(self, implementation_type: Type[T]) -> T:
        """Create instance using constructor dependency injection."""
        sig = inspect.signature(implementation_type.__init__)
        kwargs = {}
        
        for param_name, param in sig.parameters.items():
            if param_name == 'self':
                continue
            
            if param.annotation != inspect.Parameter.empty:
                kwargs[param_name] = self.resolve(param.annotation)
        
        return implementation_type(**kwargs)


def inject(container: IDependencyContainer):
    """Decorator for automatic dependency injection in functions."""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            sig = inspect.signature(func)
            injected_kwargs = {}
            
            for param_name, param in sig.parameters.items():
                if param_name not in kwargs and param.annotation != inspect.Parameter.empty:
                    try:
                        injected_kwargs[param_name] = container.resolve(param.annotation)
                    except ValueError:
                        # Parameter not registered, skip injection
                        pass
            
            return func(*args, **kwargs, **injected_kwargs)
        
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            sig = inspect.signature(func)
            injected_kwargs = {}
            
            for param_name, param in sig.parameters.items():
                if param_name not in kwargs and param.annotation != inspect.Parameter.empty:
                    try:
                        injected_kwargs[param_name] = container.resolve(param.annotation)
                    except ValueError:
                        # Parameter not registered, skip injection
                        pass
            
            return await func(*args, **kwargs, **injected_kwargs)
        
        return async_wrapper if asyncio.iscoroutinefunction(func) else wrapper
    
    return decorator


class ContainerBuilder:
    """Builder for configuring the dependency container."""
    
    def __init__(self):
        self.container = DependencyContainer()
    
    def configure_core_services(self, settings: Settings) -> 'ContainerBuilder':
        """Configure core application services."""
        # Register settings as singleton
        self.container.register_instance(Settings, settings)
        
        # Register configurations
        squeeze_config = SqueezeDetectionConfig(
            lookback_periods=settings.squeeze_lookback_periods,
            percentile_threshold=settings.squeeze_percentile,
            expansion_threshold=settings.expansion_threshold
        )
        self.container.register_instance(SqueezeDetectionConfig, squeeze_config)
        
        risk_config = RiskManagementConfig()
        self.container.register_instance(RiskManagementConfig, risk_config)
        
        return self
    
    def configure_domain_services(self) -> 'ContainerBuilder':
        """Configure domain services."""
        # Register domain services
        self.container.register(
            IVolatilitySqueezeDetector,
            VolatilitySqueezeDetectorService,
            ServiceLifetime.SINGLETON
        )
        
        self.container.register(
            IMarketRegimeDetector,
            MarketRegimeDetectorService,
            ServiceLifetime.SINGLETON
        )
        
        self.container.register(
            RiskManagementService,
            lifetime=ServiceLifetime.SINGLETON
        )
        
        return self
    
    def configure_application_services(self) -> 'ContainerBuilder':
        """Configure application use cases."""
        self.container.register(
            IAnalyzeSymbolUseCase,
            AnalyzeSymbolUseCase,
            ServiceLifetime.SCOPED
        )
        
        self.container.register(
            IBatchAnalysisUseCase,
            BatchAnalysisUseCase,
            ServiceLifetime.SCOPED
        )
        
        self.container.register(
            IBacktestUseCase,
            BacktestUseCase,
            ServiceLifetime.SCOPED
        )
        
        return self
    
    def configure_infrastructure_services(self) -> 'ContainerBuilder':
        """Configure infrastructure services (repositories, external services)."""
        # These would be implemented based on specific infrastructure choices
        # For now, we'll register placeholders
        
        # Note: Actual implementations would be registered here
        # self.container.register(IMarketDataRepository, YFinanceRepository)
        # self.container.register(ISignalRepository, SqlSignalRepository)
        # etc.
        
        return self
    
    def build(self) -> IDependencyContainer:
        """Build and return the configured container."""
        return self.container


def create_container(settings: Settings) -> IDependencyContainer:
    """Create and configure the application container."""
    return (ContainerBuilder()
            .configure_core_services(settings)
            .configure_domain_services()
            .configure_application_services()
            .configure_infrastructure_services()
            .build())


# Global container instance (can be overridden for testing)
_container: Optional[IDependencyContainer] = None


def get_container() -> IDependencyContainer:
    """Get the global container instance."""
    if _container is None:
        raise RuntimeError("Container not initialized. Call set_container() first.")
    return _container


def set_container(container: IDependencyContainer) -> None:
    """Set the global container instance."""
    global _container
    _container = container


def reset_container() -> None:
    """Reset the global container (useful for testing)."""
    global _container
    _container = None
