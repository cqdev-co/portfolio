"""Health check endpoints."""

from datetime import datetime
from typing import Dict, Any

from fastapi import APIRouter, Request
from pydantic import BaseModel

router = APIRouter()


class HealthResponse(BaseModel):
    """Health check response model."""
    status: str
    timestamp: datetime
    version: str
    services: Dict[str, Any]


@router.get("/", response_model=HealthResponse)
async def health_check(request: Request) -> HealthResponse:
    """Basic health check endpoint."""
    
    services = {}
    
    # Check service availability
    if hasattr(request.app.state, 'data_service'):
        services['data_service'] = 'available'
    
    if hasattr(request.app.state, 'analysis_service'):
        services['analysis_service'] = 'available'
    
    if hasattr(request.app.state, 'ai_service'):
        ai_service = request.app.state.ai_service
        services['ai_service'] = {
            'available': ai_service.is_available(),
            'providers': ai_service.get_available_providers()
        }
    
    if hasattr(request.app.state, 'backtest_service'):
        services['backtest_service'] = 'available'
    
    return HealthResponse(
        status="healthy",
        timestamp=datetime.now(),
        version="0.1.0",
        services=services
    )


@router.get("/ready")
async def readiness_check(request: Request) -> Dict[str, Any]:
    """Readiness check for Kubernetes."""
    
    # Check if all required services are available
    required_services = ['data_service', 'analysis_service']
    
    for service in required_services:
        if not hasattr(request.app.state, service):
            return {"status": "not_ready", "missing_service": service}
    
    return {"status": "ready"}


@router.get("/live")
async def liveness_check() -> Dict[str, str]:
    """Liveness check for Kubernetes."""
    return {"status": "alive"}
