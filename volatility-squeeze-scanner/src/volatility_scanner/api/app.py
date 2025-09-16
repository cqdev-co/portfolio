"""FastAPI application factory and configuration."""

from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger

from volatility_scanner.config.settings import get_settings
from volatility_scanner.api.routes import analysis, backtest, health, paper_trading
from volatility_scanner.services.data_service import DataService
from volatility_scanner.services.analysis_service import AnalysisService
from volatility_scanner.services.ai_service import AIService
from volatility_scanner.services.backtest_service import BacktestService


# Global service instances
data_service: DataService = None
analysis_service: AnalysisService = None
ai_service: AIService = None
backtest_service: BacktestService = None


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan manager."""
    global data_service, analysis_service, ai_service, backtest_service
    
    settings = get_settings()
    
    # Initialize services
    logger.info("Initializing services...")
    
    data_service = DataService(settings)
    analysis_service = AnalysisService(settings)
    ai_service = AIService(settings)
    backtest_service = BacktestService(settings, data_service, analysis_service)
    
    # Store services in app state
    app.state.data_service = data_service
    app.state.analysis_service = analysis_service
    app.state.ai_service = ai_service
    app.state.backtest_service = backtest_service
    
    logger.info("Services initialized successfully")
    
    yield
    
    # Cleanup
    logger.info("Shutting down services...")


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    
    settings = get_settings()
    
    app = FastAPI(
        title="Volatility Squeeze Scanner",
        description="Enterprise-grade volatility squeeze detection and analysis service",
        version="0.1.0",
        docs_url="/docs" if settings.debug else None,
        redoc_url="/redoc" if settings.debug else None,
        lifespan=lifespan
    )
    
    # Add CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"] if settings.debug else ["https://yourdomain.com"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # Include routers
    app.include_router(health.router, prefix="/health", tags=["Health"])
    app.include_router(analysis.router, prefix="/api/v1/analysis", tags=["Analysis"])
    app.include_router(backtest.router, prefix="/api/v1/backtest", tags=["Backtest"])
    app.include_router(paper_trading.router, prefix="/api/v1", tags=["Paper Trading"])
    
    @app.exception_handler(Exception)
    async def global_exception_handler(request, exc):
        """Global exception handler."""
        logger.error(f"Unhandled exception: {exc}")
        return HTTPException(
            status_code=500,
            detail="Internal server error"
        )
    
    return app


def get_services():
    """Get service instances (for dependency injection)."""
    return {
        'data_service': data_service,
        'analysis_service': analysis_service,
        'ai_service': ai_service,
        'backtest_service': backtest_service,
    }
