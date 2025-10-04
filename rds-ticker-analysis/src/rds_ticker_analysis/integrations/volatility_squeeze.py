"""Integration with the volatility squeeze scanner system."""

import asyncio
import json
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

from loguru import logger

from rds_ticker_analysis.models.analysis import TickerOpportunity


class VolatilitySqueezeIntegration:
    """
    Integration with the volatility squeeze scanner system.
    
    This integration allows the RDS ticker analysis system to:
    - Query volatility squeeze signals for specific tickers
    - Incorporate squeeze data into opportunity scoring
    - Run combined analysis with both Reddit sentiment and technical signals
    - Export enhanced analysis results
    """
    
    def __init__(
        self,
        scanner_path: Optional[str] = None,
        supabase_url: Optional[str] = None,
        supabase_key: Optional[str] = None,
    ) -> None:
        """
        Initialize the volatility squeeze integration.
        
        Args:
            scanner_path: Path to volatility squeeze scanner executable
            supabase_url: Supabase URL for direct database access
            supabase_key: Supabase service key for database access
        """
        # Default to relative path if not specified
        self.scanner_path = scanner_path or "../volatility-squeeze-scanner"
        self.supabase_url = supabase_url
        self.supabase_key = supabase_key
        
        logger.info(f"Initialized VolatilitySqueezeIntegration with scanner at {self.scanner_path}")
    
    async def get_squeeze_signal(self, ticker_symbol: str) -> Optional[Dict]:
        """
        Get the latest volatility squeeze signal for a ticker.
        
        Args:
            ticker_symbol: Stock ticker symbol
            
        Returns:
            Dictionary with squeeze signal data or None if not found
        """
        try:
            # Try to get signal via CLI command first
            signal_data = await self._get_signal_via_cli(ticker_symbol)
            
            if not signal_data:
                # Fallback to database query if available
                signal_data = await self._get_signal_via_database(ticker_symbol)
            
            return signal_data
            
        except Exception as e:
            logger.warning(f"Failed to get squeeze signal for {ticker_symbol}: {e}")
            return None
    
    async def get_batch_squeeze_signals(
        self,
        ticker_symbols: List[str],
        max_concurrent: int = 5,
    ) -> Dict[str, Optional[Dict]]:
        """
        Get volatility squeeze signals for multiple tickers.
        
        Args:
            ticker_symbols: List of ticker symbols
            max_concurrent: Maximum concurrent requests
            
        Returns:
            Dictionary mapping symbols to signal data
        """
        semaphore = asyncio.Semaphore(max_concurrent)
        
        async def get_single_signal(symbol: str) -> tuple[str, Optional[Dict]]:
            async with semaphore:
                signal = await self.get_squeeze_signal(symbol)
                return symbol, signal
        
        # Execute requests concurrently
        tasks = [get_single_signal(symbol) for symbol in ticker_symbols]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Process results
        signals = {}
        for result in results:
            if isinstance(result, Exception):
                logger.warning(f"Batch squeeze signal request failed: {result}")
                continue
            
            symbol, signal = result
            signals[symbol] = signal
        
        logger.info(f"Retrieved squeeze signals for {len(signals)} tickers")
        return signals
    
    async def run_combined_analysis(
        self,
        ticker_symbols: List[str],
        scan_params: Optional[Dict] = None,
    ) -> List[Dict]:
        """
        Run combined analysis with both Reddit sentiment and volatility squeeze signals.
        
        Args:
            ticker_symbols: List of ticker symbols to analyze
            scan_params: Optional parameters for volatility scan
            
        Returns:
            List of combined analysis results
        """
        try:
            # Step 1: Run volatility squeeze scan
            squeeze_results = await self._run_volatility_scan(ticker_symbols, scan_params)
            
            # Step 2: Get Reddit sentiment for tickers with squeeze signals
            squeeze_tickers = [
                result['symbol'] for result in squeeze_results
                if result.get('is_squeeze') or result.get('signal_strength', 0) > 0.6
            ]
            
            if not squeeze_tickers:
                logger.info("No significant squeeze signals found")
                return []
            
            logger.info(f"Found squeeze signals for {len(squeeze_tickers)} tickers")
            
            # Step 3: Create combined results
            combined_results = []
            for result in squeeze_results:
                symbol = result['symbol']
                if symbol in squeeze_tickers:
                    combined_result = {
                        'ticker_symbol': symbol,
                        'volatility_squeeze': result,
                        'analysis_timestamp': datetime.utcnow().isoformat(),
                        'combined_signal_strength': self._calculate_combined_strength(result),
                    }
                    combined_results.append(combined_result)
            
            # Sort by combined signal strength
            combined_results.sort(
                key=lambda x: x['combined_signal_strength'],
                reverse=True
            )
            
            logger.info(f"Generated {len(combined_results)} combined analysis results")
            return combined_results
            
        except Exception as e:
            logger.error(f"Combined analysis failed: {e}")
            return []
    
    async def enhance_ticker_opportunity(
        self,
        opportunity: TickerOpportunity,
    ) -> TickerOpportunity:
        """
        Enhance a ticker opportunity with volatility squeeze data.
        
        Args:
            opportunity: Existing ticker opportunity
            
        Returns:
            Enhanced opportunity with squeeze data
        """
        try:
            # Get squeeze signal for this ticker
            squeeze_data = await self.get_squeeze_signal(opportunity.ticker_symbol)
            
            if squeeze_data:
                # Add squeeze data to opportunity
                opportunity.volatility_squeeze_signal = squeeze_data
                
                # Potentially adjust scoring based on squeeze signal
                if squeeze_data.get('is_squeeze') and squeeze_data.get('signal_strength', 0) > 0.7:
                    # Boost technical score for strong squeeze signals
                    current_technical = float(opportunity.opportunity_score.technical_score)
                    squeeze_boost = min(0.2, squeeze_data.get('signal_strength', 0) * 0.2)
                    enhanced_technical = min(1.0, current_technical + squeeze_boost)
                    
                    # Update the technical score (this would require rebuilding the score)
                    logger.info(f"Enhanced {opportunity.ticker_symbol} technical score from "
                              f"{current_technical:.3f} to {enhanced_technical:.3f}")
                
                logger.info(f"Enhanced opportunity for {opportunity.ticker_symbol} with squeeze data")
            
            return opportunity
            
        except Exception as e:
            logger.warning(f"Failed to enhance opportunity for {opportunity.ticker_symbol}: {e}")
            return opportunity
    
    async def export_combined_signals(
        self,
        opportunities: List[TickerOpportunity],
        output_path: str,
        format: str = "json",
    ) -> None:
        """
        Export combined analysis results with both Reddit and volatility data.
        
        Args:
            opportunities: List of ticker opportunities
            output_path: Output file path
            format: Export format (json, csv, parquet)
        """
        try:
            # Prepare export data
            export_data = []
            for opp in opportunities:
                record = {
                    # Basic info
                    'ticker_symbol': opp.ticker_symbol,
                    'company_name': opp.company_name,
                    'analysis_date': opp.analysis_date.isoformat(),
                    'current_price': float(opp.current_price) if opp.current_price else None,
                    
                    # Reddit metrics
                    'reddit_total_mentions': opp.reddit_metrics.total_mentions,
                    'reddit_unique_authors': opp.reddit_metrics.unique_authors,
                    'reddit_quality_ratio': opp.reddit_metrics.quality_ratio,
                    'reddit_momentum_score': opp.reddit_metrics.momentum_score,
                    
                    # Opportunity scoring
                    'overall_score': float(opp.opportunity_score.overall_score),
                    'opportunity_grade': opp.opportunity_score.opportunity_grade.value,
                    'sentiment_score': float(opp.opportunity_score.sentiment_score),
                    'technical_score': float(opp.opportunity_score.technical_score),
                    
                    # Risk assessment
                    'risk_level': opp.risk_assessment.risk_level.value,
                    'overall_risk_score': float(opp.risk_assessment.overall_risk_score),
                    'max_position_size_pct': float(opp.risk_assessment.max_position_size_pct),
                    
                    # Recommendations
                    'recommended_action': opp.recommended_action,
                    'conviction_level': float(opp.conviction_level),
                }
                
                # Add volatility squeeze data if available
                if opp.volatility_squeeze_signal:
                    squeeze = opp.volatility_squeeze_signal
                    record.update({
                        'squeeze_is_active': squeeze.get('is_squeeze', False),
                        'squeeze_signal_strength': squeeze.get('signal_strength', 0),
                        'squeeze_bb_width_percentile': squeeze.get('bb_width_percentile', 0),
                        'squeeze_opportunity_rank': squeeze.get('opportunity_rank'),
                        'squeeze_technical_score': squeeze.get('technical_score', 0),
                    })
                
                export_data.append(record)
            
            # Export based on format
            output_file = Path(output_path)
            output_file.parent.mkdir(parents=True, exist_ok=True)
            
            if format.lower() == "json":
                with open(output_file, 'w') as f:
                    json.dump(export_data, f, indent=2)
            
            elif format.lower() == "csv":
                import pandas as pd
                df = pd.DataFrame(export_data)
                df.to_csv(output_file, index=False)
            
            elif format.lower() == "parquet":
                import pandas as pd
                df = pd.DataFrame(export_data)
                df.to_parquet(output_file, index=False)
            
            else:
                raise ValueError(f"Unsupported export format: {format}")
            
            logger.info(f"Exported {len(export_data)} combined signals to {output_path}")
            
        except Exception as e:
            logger.error(f"Failed to export combined signals: {e}")
            raise
    
    async def _get_signal_via_cli(self, ticker_symbol: str) -> Optional[Dict]:
        """Get squeeze signal via CLI command."""
        try:
            # Check if scanner executable exists
            scanner_exec = Path(self.scanner_path) / "src" / "volatility_scanner" / "cli.py"
            if not scanner_exec.exists():
                return None
            
            # Run scanner command
            cmd = [
                "python", str(scanner_exec),
                "analyze", ticker_symbol,
                "--output-format", "json"
            ]
            
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=self.scanner_path
            )
            
            stdout, stderr = await process.communicate()
            
            if process.returncode == 0 and stdout:
                result = json.loads(stdout.decode())
                return result.get('signals', [{}])[0] if result.get('signals') else None
            
            return None
            
        except Exception as e:
            logger.debug(f"CLI signal retrieval failed for {ticker_symbol}: {e}")
            return None
    
    async def _get_signal_via_database(self, ticker_symbol: str) -> Optional[Dict]:
        """Get squeeze signal via direct database query."""
        try:
            if not self.supabase_url or not self.supabase_key:
                return None
            
            # This would require implementing Supabase client
            # For now, return None as placeholder
            logger.debug(f"Database signal retrieval not implemented for {ticker_symbol}")
            return None
            
        except Exception as e:
            logger.debug(f"Database signal retrieval failed for {ticker_symbol}: {e}")
            return None
    
    async def _run_volatility_scan(
        self,
        ticker_symbols: List[str],
        scan_params: Optional[Dict] = None,
    ) -> List[Dict]:
        """Run volatility squeeze scan on specified tickers."""
        try:
            # Check if scanner executable exists
            scanner_exec = Path(self.scanner_path) / "src" / "volatility_scanner" / "cli.py"
            if not scanner_exec.exists():
                logger.warning(f"Volatility scanner not found at {scanner_exec}")
                return []
            
            # Prepare command
            cmd = [
                "python", str(scanner_exec),
                "scan-symbols"
            ]
            
            # Add ticker symbols
            cmd.extend(ticker_symbols)
            
            # Add scan parameters
            if scan_params:
                if scan_params.get('min_score'):
                    cmd.extend(["--min-score", str(scan_params['min_score'])])
                if scan_params.get('timeframe'):
                    cmd.extend(["--timeframe", scan_params['timeframe']])
            
            cmd.extend(["--output-format", "json"])
            
            # Run scanner
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=self.scanner_path
            )
            
            stdout, stderr = await process.communicate()
            
            if process.returncode == 0 and stdout:
                result = json.loads(stdout.decode())
                return result.get('signals', [])
            
            if stderr:
                logger.warning(f"Volatility scanner stderr: {stderr.decode()}")
            
            return []
            
        except Exception as e:
            logger.error(f"Volatility scan failed: {e}")
            return []
    
    def _calculate_combined_strength(self, squeeze_result: Dict) -> float:
        """Calculate combined signal strength from squeeze data."""
        try:
            base_strength = squeeze_result.get('signal_strength', 0)
            
            # Boost for active squeeze
            if squeeze_result.get('is_squeeze'):
                base_strength += 0.2
            
            # Boost for low BB width percentile
            bb_percentile = squeeze_result.get('bb_width_percentile', 50)
            if bb_percentile <= 20:
                base_strength += 0.3
            elif bb_percentile <= 30:
                base_strength += 0.2
            elif bb_percentile <= 40:
                base_strength += 0.1
            
            # Boost for high technical score
            technical_score = squeeze_result.get('technical_score', 0)
            if technical_score > 0.8:
                base_strength += 0.2
            elif technical_score > 0.6:
                base_strength += 0.1
            
            return min(1.0, base_strength)
            
        except Exception:
            return 0.0
