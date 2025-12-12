"""Anomaly detection algorithms for unusual options activity."""

from typing import List, Optional, Dict, Any, Tuple
from dataclasses import dataclass, field
from datetime import datetime, timezone
from loguru import logger

from ..data.models import OptionsChain, OptionsContract, HistoricalData
from .spread_detector import (
    SpreadDetector, SpreadAnalysis, enrich_detections_with_spread_analysis
)


@dataclass
class Detection:
    """Single anomaly detection result."""
    
    detection_type: str  # VOLUME_ANOMALY, OI_SPIKE, PREMIUM_FLOW, etc.
    contract: OptionsContract
    metrics: Dict[str, Any]
    confidence: float
    timestamp: datetime
    
    # Spread detection metadata (added in Phase 1)
    spread_analysis: Optional[SpreadAnalysis] = field(default=None)


class AnomalyDetector:
    """Detects unusual options activity across multiple dimensions."""
    
    # High-volume tickers that generate excessive noise - need higher thresholds
    HIGH_VOLUME_TICKERS = {
        'TSLA', 'NVDA', 'META', 'SPY', 'QQQ', 'AMD', 'AAPL', 'AMZN', 
        'GOOGL', 'MSFT', 'PLTR', 'AVGO', 'IWM', 'XLF', 'GLD', 'SLV',
        'COIN', 'MSTR', 'HOOD', 'SOFI', 'NIO', 'BABA', 'INTC', 'MU'
    }
    
    # Premium thresholds by ticker type (raised based on data analysis)
    # Correct signals avg $23M (calls), $7.7M (puts) - wrong avg $3M
    PREMIUM_THRESHOLD_HIGH_VOL = 5_000_000   # $5M for high-volume tickers
    PREMIUM_THRESHOLD_NORMAL = 1_000_000     # $1M for normal tickers
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.volume_threshold = config.get('VOLUME_MULTIPLIER_THRESHOLD', 5.0)
        self.oi_change_threshold = config.get('OI_CHANGE_THRESHOLD', 0.30)
        self.min_premium_flow = config.get('MIN_PREMIUM_FLOW', 500000)
        self.min_option_volume = config.get('MIN_OPTION_VOLUME', 200)
        self.min_heuristic_volume = config.get('MIN_HEURISTIC_VOLUME', 2000)
        self.min_heuristic_oi = config.get('MIN_HEURISTIC_OI', 10000)
        
        # Minimum DTE to filter out day-trader noise
        self.min_dte = config.get('MIN_DTE_FILTER', 7)  # Default: filter 0-7 DTE
        
        # Spread detection (Phase 1: Conservative)
        self.enable_spread_detection = config.get('ENABLE_SPREAD_DETECTION', True)
        self.spread_detector = SpreadDetector(config) if self.enable_spread_detection else None
    
    def _get_premium_threshold(self, ticker: str) -> float:
        """Get minimum premium threshold based on ticker volume."""
        if ticker.upper() in self.HIGH_VOLUME_TICKERS:
            return self.PREMIUM_THRESHOLD_HIGH_VOL
        return self.PREMIUM_THRESHOLD_NORMAL
    
    def detect_anomalies(
        self,
        options_chain: OptionsChain,
        historical_data: Optional[HistoricalData] = None
    ) -> List[Detection]:
        """
        Run all detection algorithms on options chain.
        
        Args:
            options_chain: Current options chain data
            historical_data: Historical data for comparison (optional)
            
        Returns:
            List of detected anomalies
        """
        detections = []
        ticker = options_chain.ticker
        
        for contract in options_chain.contracts:
            # Skip contracts with very low volume
            if contract.volume < self.min_option_volume:
                continue
            
            # FILTER: Skip short-dated contracts (day trader noise)
            days_to_expiry = (contract.expiry - contract.timestamp.date()).days
            if days_to_expiry < self.min_dte:
                continue
            
            # 1. Check volume anomalies
            volume_detection = self._detect_volume_anomaly(contract, historical_data)
            if volume_detection:
                detections.append(volume_detection)
            
            # 2. Check open interest spikes
            oi_detection = self._detect_oi_spike(contract, historical_data)
            if oi_detection:
                detections.append(oi_detection)
            
            # 3. Check premium flow (with ticker-specific threshold)
            premium_detection = self._detect_premium_flow(contract, ticker)
            if premium_detection:
                detections.append(premium_detection)
            
            # 4. Check for unusual bid-ask activity
            spread_detection = self._detect_unusual_spread(contract)
            if spread_detection:
                detections.append(spread_detection)
        
        # 5. Check put/call ratio for the entire chain
        pc_ratio_detection = self._detect_pc_ratio_anomaly(options_chain)
        if pc_ratio_detection:
            detections.append(pc_ratio_detection)
        
        logger.info(f"Found {len(detections)} anomalies for {options_chain.ticker}")
        
        # 6. Analyze for spread patterns (Phase 1: Conservative tagging)
        if self.enable_spread_detection and detections:
            detections = self._enrich_with_spread_analysis(detections)
        
        return detections
    
    def _enrich_with_spread_analysis(self, detections: List[Detection]) -> List[Detection]:
        """
        Analyze detections for spread patterns and enrich with metadata.
        
        Phase 1: Non-destructive tagging only (no filtering)
        """
        spread_analyses = self.spread_detector.analyze_all_signals(detections)
        
        # Attach spread analysis to each detection
        for detection in detections:
            symbol = detection.contract.symbol
            if symbol in spread_analyses:
                detection.spread_analysis = spread_analyses[symbol]
                
                # Log high-confidence spreads
                analysis = spread_analyses[symbol]
                if analysis.is_likely_spread:
                    logger.warning(
                        f"⚠️  Likely spread detected: {symbol} "
                        f"({analysis.spread_confidence:.0%} confidence) - "
                        f"{analysis.spread_type} - {analysis.reasoning}"
                    )
        
        return detections
    
    def _detect_volume_anomaly(
        self,
        contract: OptionsContract,
        historical: Optional[HistoricalData]
    ) -> Optional[Detection]:
        """Detect unusual volume vs historical average."""
        
        current_volume = contract.volume
        if current_volume == 0:
            return None
        
        # If no historical data, use a more conservative heuristic
        if not historical:
            # Require much higher volume for heuristic detection
            if current_volume >= self.min_heuristic_volume:
                # More conservative confidence calculation
                confidence = min(current_volume / 10000, 0.8)  # Cap at 0.8 for heuristics
                return Detection(
                    detection_type='VOLUME_ANOMALY',
                    contract=contract,
                    metrics={
                        'current_volume': current_volume,
                        'average_volume': 0,  # Unknown
                        'volume_ratio': float('inf'),
                        'heuristic': True
                    },
                    confidence=confidence,
                timestamp=datetime.now(timezone.utc)
                )
            return None
        
        # Get average volume from historical data
        avg_volume = historical.get_avg_volume(contract.symbol, days=20)
        
        if avg_volume < 50:  # Filter very low liquidity
            return None
        
        volume_ratio = current_volume / avg_volume
        
        if volume_ratio >= self.volume_threshold:
            # More conservative confidence calculation
            confidence = min(volume_ratio / 15.0, 0.9)  # Reduced max confidence
            
            return Detection(
                detection_type='VOLUME_ANOMALY',
                contract=contract,
                metrics={
                    'current_volume': current_volume,
                    'average_volume': avg_volume,
                    'volume_ratio': volume_ratio,
                    'heuristic': False
                },
                confidence=confidence,
                timestamp=datetime.now(timezone.utc)
            )
        
        return None
    
    def _detect_oi_spike(
        self,
        contract: OptionsContract,
        historical: Optional[HistoricalData]
    ) -> Optional[Detection]:
        """Detect significant open interest changes."""
        
        current_oi = contract.open_interest
        if current_oi == 0:
            return None
        
        # If no historical data, use more conservative heuristic
        if not historical:
            # Require much higher OI for heuristic detection
            if current_oi >= self.min_heuristic_oi:
                # More conservative confidence calculation
                confidence = min(current_oi / 25000, 0.7)  # Cap at 0.7 for heuristics
                return Detection(
                    detection_type='OI_SPIKE',
                    contract=contract,
                    metrics={
                        'current_oi': current_oi,
                        'previous_oi': 0,  # Unknown
                        'oi_change_pct': float('inf'),
                        'heuristic': True
                    },
                    confidence=confidence,
                    timestamp=datetime.now(timezone.utc)
                )
            return None
        
        previous_oi = historical.get_previous_oi(contract.symbol, days_ago=1)
        
        if previous_oi == 0:
            return None  # New contract or no data
        
        oi_change_pct = (current_oi - previous_oi) / previous_oi
        
        if oi_change_pct >= self.oi_change_threshold:
            # More conservative confidence calculation
            confidence = min(oi_change_pct / 0.8, 0.9)  # Reduced max confidence
            
            return Detection(
                detection_type='OI_SPIKE',
                contract=contract,
                metrics={
                    'current_oi': current_oi,
                    'previous_oi': previous_oi,
                    'oi_change_pct': oi_change_pct,
                    'absolute_change': current_oi - previous_oi,
                    'heuristic': False
                },
                confidence=confidence,
                timestamp=datetime.now(timezone.utc)
            )
        
        return None
    
    def _detect_premium_flow(
        self, 
        contract: OptionsContract,
        ticker: str = ""
    ) -> Optional[Detection]:
        """
        Detect large premium expenditures.
        
        Uses ticker-specific thresholds - high-volume tickers like TSLA/NVDA
        require higher premium to qualify as unusual.
        """
        # Calculate total premium flow (simplified)
        premium = contract.last_price * contract.volume * 100  # Convert to dollars
        
        # Get ticker-specific threshold
        min_threshold = self._get_premium_threshold(ticker)
        
        if premium < min_threshold:
            return None
        
        # Simple aggressiveness check based on bid-ask spread
        spread = contract.ask - contract.bid
        mid_price = (contract.bid + contract.ask) / 2
        
        # If last price is closer to ask, it's more aggressive
        if mid_price > 0:
            aggressiveness = (contract.last_price - contract.bid) / spread if spread > 0 else 0.5
        else:
            aggressiveness = 0.5
        
        # Scale confidence by premium size relative to threshold
        # Higher premium = higher confidence, but capped
        premium_ratio = premium / min_threshold  # How many multiples of threshold
        
        # Base confidence: scale from 0.3 to 0.7 based on premium size
        # - 1x threshold = 0.3 confidence
        # - 5x threshold = 0.7 confidence (max base)
        base_confidence = min(0.3 + (premium_ratio - 1) * 0.1, 0.7)
        
        # Aggressiveness bonus (max 0.2)
        aggressiveness_bonus = aggressiveness * 0.2
        
        # High-volume tickers get a penalty (harder to stand out)
        ticker_penalty = 0.1 if ticker.upper() in self.HIGH_VOLUME_TICKERS else 0.0
        
        confidence = min(base_confidence + aggressiveness_bonus - ticker_penalty, 0.9)
        confidence = max(confidence, 0.1)  # Floor at 0.1
        
        return Detection(
            detection_type='PREMIUM_FLOW',
            contract=contract,
            metrics={
                'total_premium': premium,
                'aggressive_pct': aggressiveness,
                'volume': contract.volume,
                'avg_price': contract.last_price,
                'premium_threshold': min_threshold,
                'is_high_volume_ticker': ticker.upper() in self.HIGH_VOLUME_TICKERS
            },
            confidence=confidence,
            timestamp=datetime.now(timezone.utc)
        )
    
    def _detect_unusual_spread(self, contract: OptionsContract) -> Optional[Detection]:
        """Detect unusual bid-ask spread activity."""
        
        if contract.bid <= 0 or contract.ask <= 0:
            return None
        
        spread = contract.ask - contract.bid
        mid_price = (contract.bid + contract.ask) / 2
        
        if mid_price <= 0:
            return None
        
        spread_pct = spread / mid_price
        
        # Very tight spreads on high volume might indicate institutional activity
        if spread_pct < 0.015 and contract.volume > 1000:  # Tighter spread, higher volume
            confidence = min(contract.volume / 2000, 0.7)  # More conservative
            
            return Detection(
                detection_type='TIGHT_SPREAD',
                contract=contract,
                metrics={
                    'spread_pct': spread_pct,
                    'spread_dollars': spread,
                    'volume': contract.volume,
                    'mid_price': mid_price
                },
                confidence=confidence,
                timestamp=datetime.now(timezone.utc)
            )
        
        return None
    
    def _detect_pc_ratio_anomaly(self, options_chain: OptionsChain) -> Optional[Detection]:
        """Detect unusual put/call ratio for the entire chain."""
        
        calls = options_chain.get_calls()
        puts = options_chain.get_puts()
        
        if not calls or not puts:
            return None
        
        call_volume = sum(c.volume for c in calls)
        put_volume = sum(p.volume for p in puts)
        
        if call_volume == 0:
            return None
        
        put_call_ratio = put_volume / call_volume
        
        # More extreme ratios required for detection
        if put_call_ratio > 3.0:  # Very bearish (increased from 2.0)
            confidence = min((put_call_ratio - 3.0) / 3.0, 0.8)  # More conservative
            sentiment = 'BEARISH'
        elif put_call_ratio < 0.2:  # Very bullish (decreased from 0.3)
            confidence = min((0.2 - put_call_ratio) / 0.2, 0.8)  # More conservative
            sentiment = 'BULLISH'
        else:
            return None
        
        # Create a dummy contract for the ratio (using first call)
        dummy_contract = calls[0] if calls else puts[0]
        
        return Detection(
            detection_type='PC_RATIO_ANOMALY',
            contract=dummy_contract,
            metrics={
                'put_call_ratio': put_call_ratio,
                'call_volume': call_volume,
                'put_volume': put_volume,
                'sentiment': sentiment,
                'total_volume': call_volume + put_volume
            },
            confidence=confidence,
            timestamp=datetime.now(timezone.utc)
        )
