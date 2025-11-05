"""Signal fetcher - combines database signals with fresh market data."""

from typing import List, Dict, Tuple
from loguru import logger

from .config import Settings
from .data.supabase_client import SupabaseClient
from .data.market_data import MarketDataProvider
from .analyzers.technical_filter import TechnicalFilter, FilterResult
from .models.signal import EnrichedSignal
from .models.analysis import TechnicalIndicators


class SignalFetcher:
    """
    Fetch unusual options signals and enrich with fresh market data.
    Apply technical filters to remove bad setups.
    """
    
    def __init__(self, config: Settings):
        self.config = config
        self.db = SupabaseClient(config)
        self.market = MarketDataProvider()
        self.filter = TechnicalFilter(config)
    
    def fetch_filtered_signals(
        self,
        min_grade: str = None,
        lookback_days: int = None,
        min_premium_flow: float = None,
        min_dte: int = None,
        max_dte: int = None,
        show_filtered: bool = False
    ) -> Tuple[List[Tuple[EnrichedSignal, TechnicalIndicators, FilterResult]], 
               List[Tuple[EnrichedSignal, TechnicalIndicators, FilterResult]]]:
        """
        Fetch signals, enrich with market data, and apply technical filters.
        
        Args:
            min_grade: Minimum signal grade (uses config default if None)
            lookback_days: Days to look back (uses config default if None)
            min_premium_flow: Minimum premium flow (uses config default if None)
            min_dte: Minimum days to expiry (uses config default if None)
            max_dte: Maximum days to expiry (uses config default if None)
            show_filtered: Whether to return filtered signals
            
        Returns:
            Tuple of (approved_signals, filtered_signals)
            Each is list of (signal, technical, filter_result)
        """
        # Use config defaults if not provided
        min_grade = min_grade or self.config.min_signal_grade
        lookback_days = lookback_days or self.config.default_lookback_days
        min_premium_flow = min_premium_flow or self.config.min_premium_flow
        min_dte = min_dte or self.config.min_dte
        max_dte = max_dte or self.config.max_dte
        
        logger.info(
            f"Fetching signals: grade={min_grade}+, days={lookback_days}, "
            f"dte={min_dte}-{max_dte}"
        )
        
        # Step 1: Fetch signals from database
        signals = self.db.get_signals(
            min_grade=min_grade,
            lookback_days=lookback_days,
            min_premium_flow=min_premium_flow,
            min_dte=min_dte,
            max_dte=max_dte
        )
        
        if not signals:
            logger.warning("No signals found matching criteria")
            return [], []
        
        logger.info(f"Found {len(signals)} signals from database")
        
        # Step 2: Get unique tickers for batch fetching
        unique_tickers = list(set(s.ticker for s in signals))
        logger.info(f"Fetching market data for {len(unique_tickers)} unique tickers")
        
        # Step 3: Batch fetch technical indicators
        technical_data = self.market.batch_get_technical_indicators(unique_tickers)
        
        # Step 4: Enrich signals and apply filters
        approved_signals = []
        filtered_signals = []
        
        for signal in signals:
            # Get technical data for this ticker
            technical = technical_data.get(signal.ticker)
            
            if not technical:
                logger.warning(f"No technical data for {signal.ticker}, skipping")
                filtered_signals.append((
                    signal,
                    None,
                    FilterResult(
                        should_skip=True,
                        reason="Could not fetch market data"
                    )
                ))
                continue
            
            # Update signal with fresh price
            signal.current_price = technical.price
            
            # Apply technical filter
            filter_result = self.filter.should_skip_signal(signal, technical)
            
            if filter_result.should_skip:
                logger.debug(
                    f"Filtered {signal.ticker} ({signal.grade}): {filter_result.reason}"
                )
                filtered_signals.append((signal, technical, filter_result))
            else:
                logger.debug(f"Approved {signal.ticker} ({signal.grade})")
                approved_signals.append((signal, technical, filter_result))
        
        logger.info(
            f"Results: {len(approved_signals)} approved, "
            f"{len(filtered_signals)} filtered"
        )
        
        return approved_signals, filtered_signals

