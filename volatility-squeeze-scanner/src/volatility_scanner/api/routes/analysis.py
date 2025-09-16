"""Analysis endpoints for volatility squeeze detection."""

from typing import List, Optional
from datetime import datetime

from fastapi import APIRouter, HTTPException, Request, Query
from pydantic import BaseModel, Field

from volatility_scanner.models.analysis import AnalysisResult
from volatility_scanner.core.exceptions import DataError, AnalysisError

router = APIRouter()


class AnalysisRequest(BaseModel):
    """Request model for symbol analysis."""
    symbol: str = Field(description="Stock/ETF symbol to analyze")
    period: str = Field(
        default="1y",
        description="Data period (1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y)"
    )
    include_ai_analysis: bool = Field(
        default=True,
        description="Whether to include AI-powered analysis"
    )
    force_refresh: bool = Field(
        default=False,
        description="Force refresh data from API"
    )


class BatchAnalysisRequest(BaseModel):
    """Request model for batch analysis."""
    symbols: List[str] = Field(description="List of symbols to analyze")
    period: str = Field(default="1y", description="Data period")
    include_ai_analysis: bool = Field(default=True, description="Include AI analysis")
    max_concurrent: Optional[int] = Field(
        default=None,
        description="Maximum concurrent requests"
    )


class SymbolValidationResponse(BaseModel):
    """Response model for symbol validation."""
    symbol: str
    is_valid: bool
    info: Optional[dict] = None


@router.post("/analyze", response_model=AnalysisResult)
async def analyze_symbol(
    request: Request,
    analysis_request: AnalysisRequest
) -> AnalysisResult:
    """
    Analyze a single symbol for volatility squeeze signals.
    
    This endpoint fetches market data, calculates technical indicators,
    and performs volatility squeeze analysis with optional AI enhancement.
    """
    try:
        data_service = request.app.state.data_service
        analysis_service = request.app.state.analysis_service
        ai_service = request.app.state.ai_service
        
        # Fetch market data
        market_data = await data_service.get_market_data(
            analysis_request.symbol,
            analysis_request.period,
            analysis_request.force_refresh
        )
        
        # Perform analysis
        analysis_result = await analysis_service.analyze_symbol(
            market_data,
            include_ai_analysis=False  # We'll add AI separately
        )
        
        if not analysis_result:
            raise HTTPException(
                status_code=404,
                detail=f"No volatility squeeze signals found for {analysis_request.symbol}"
            )
        
        # Add AI analysis if requested and available
        if analysis_request.include_ai_analysis and ai_service.is_available():
            analysis_result = await ai_service.analyze_signal(analysis_result)
        
        return analysis_result
        
    except DataError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except AnalysisError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@router.post("/batch", response_model=List[AnalysisResult])
async def batch_analyze(
    request: Request,
    batch_request: BatchAnalysisRequest
) -> List[AnalysisResult]:
    """
    Analyze multiple symbols for volatility squeeze signals.
    
    This endpoint processes multiple symbols concurrently and returns
    analysis results for symbols with detected signals.
    """
    try:
        data_service = request.app.state.data_service
        analysis_service = request.app.state.analysis_service
        ai_service = request.app.state.ai_service
        
        # Fetch data for all symbols
        symbol_data = await data_service.get_multiple_symbols(
            batch_request.symbols,
            batch_request.period,
            batch_request.max_concurrent
        )
        
        # Analyze each symbol
        results = []
        for symbol, market_data in symbol_data.items():
            try:
                analysis_result = await analysis_service.analyze_symbol(
                    market_data,
                    include_ai_analysis=False
                )
                
                if analysis_result:
                    # Add AI analysis if requested
                    if (batch_request.include_ai_analysis and 
                        ai_service.is_available()):
                        analysis_result = await ai_service.analyze_signal(
                            analysis_result
                        )
                    
                    results.append(analysis_result)
                    
            except Exception as e:
                # Log error but continue with other symbols
                print(f"Analysis failed for {symbol}: {e}")
                continue
        
        return results
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Batch analysis failed: {str(e)}"
        )


@router.get("/validate/{symbol}", response_model=SymbolValidationResponse)
async def validate_symbol(
    request: Request,
    symbol: str
) -> SymbolValidationResponse:
    """
    Validate if a symbol exists and has available data.
    
    This endpoint checks symbol validity and returns basic information
    if the symbol is valid.
    """
    try:
        data_service = request.app.state.data_service
        
        # Validate symbol
        is_valid = await data_service.validate_symbol(symbol)
        
        info = None
        if is_valid:
            try:
                info = await data_service.get_symbol_info(symbol)
            except Exception:
                # Symbol is valid but info retrieval failed
                pass
        
        return SymbolValidationResponse(
            symbol=symbol.upper(),
            is_valid=is_valid,
            info=info
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Symbol validation failed: {str(e)}"
        )


@router.get("/cache/stats")
async def get_cache_stats(request: Request) -> dict:
    """Get data service cache statistics."""
    try:
        data_service = request.app.state.data_service
        return data_service.get_cache_stats()
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get cache stats: {str(e)}"
        )


@router.delete("/cache")
async def clear_cache(
    request: Request,
    symbol: Optional[str] = Query(None, description="Symbol to clear (all if not specified)")
) -> dict:
    """Clear data service cache."""
    try:
        data_service = request.app.state.data_service
        data_service.clear_cache(symbol)
        
        return {
            "message": f"Cache cleared for {symbol if symbol else 'all symbols'}",
            "timestamp": datetime.now()
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to clear cache: {str(e)}"
        )
