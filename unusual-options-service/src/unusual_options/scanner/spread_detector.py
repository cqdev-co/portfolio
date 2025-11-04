"""
Spread pattern detection for options signals.

Detects vertical spreads, calendar spreads, and other multi-leg strategies
with conservative confidence thresholds to minimize false positives.
"""

from typing import List, Optional, Dict, Tuple
from dataclasses import dataclass
from datetime import date, datetime
from loguru import logger

from ..data.models import OptionsContract


@dataclass
class SpreadAnalysis:
    """Result of spread pattern analysis for a single signal."""
    
    is_likely_spread: bool
    spread_confidence: float
    spread_type: Optional[str]
    matched_contracts: List[str]  # Contract symbols
    strike_width: Optional[float]
    net_premium: Optional[float]
    reasoning: str
    detection_indicators: List[str]


@dataclass
class Detection:
    """Import Detection type from detector.py."""
    detection_type: str
    contract: OptionsContract
    metrics: Dict
    confidence: float
    timestamp: datetime


class SpreadDetector:
    """
    Conservative spread detection with explainability.
    
    Phase 1: High-confidence only (≥80%)
    - Requires multiple indicators to align
    - Perfect/near-perfect volume and OI correlation
    - Reasonable strike proximity
    
    Design Philosophy:
    - Tag, don't filter (non-destructive)
    - Explainable detections (show reasoning)
    - Conservative thresholds (low false positive rate)
    - Validate over time before using for filtering
    """
    
    def __init__(self, config: Optional[Dict] = None):
        """Initialize spread detector with conservative config."""
        self.config = config or {}
        
        # Phase 1: Very conservative thresholds
        self.min_confidence_to_flag = self.config.get(
            'MIN_SPREAD_CONFIDENCE', 0.80
        )
        self.min_volume_correlation = self.config.get(
            'MIN_VOLUME_CORRELATION', 0.80
        )
        self.max_strike_width = self.config.get('MAX_STRIKE_WIDTH', 50)
        self.min_indicators_required = self.config.get(
            'MIN_INDICATORS', 3
        )
        
        # Volume ratio bounds (tighter = higher confidence)
        self.tight_volume_ratio = (0.80, 1.25)
        self.moderate_volume_ratio = (0.60, 1.60)
        
        # OI ratio bounds
        self.tight_oi_ratio = (0.70, 1.40)
        self.moderate_oi_ratio = (0.50, 2.00)
    
    def analyze_all_signals(
        self, 
        detections: List[Detection]
    ) -> Dict[str, SpreadAnalysis]:
        """
        Analyze all signals for spread patterns.
        
        Returns:
            Dict mapping contract symbol to SpreadAnalysis
        """
        analyses = {}
        
        # Group by ticker and expiry for vertical spread detection
        by_ticker_expiry = self._group_by_ticker_expiry(detections)
        
        # Check each signal against others for patterns
        for detection in detections:
            contract = detection.contract
            symbol = contract.symbol
            
            # Find potential spread matches
            potential_matches = self._find_matching_contracts(
                contract,
                detections
            )
            
            if not potential_matches:
                # No matches = not a spread
                analyses[symbol] = SpreadAnalysis(
                    is_likely_spread=False,
                    spread_confidence=0.0,
                    spread_type=None,
                    matched_contracts=[],
                    strike_width=None,
                    net_premium=None,
                    reasoning="No matching contracts detected",
                    detection_indicators=[]
                )
                continue
            
            # Calculate spread confidence
            analysis = self._calculate_spread_confidence(
                contract,
                potential_matches
            )
            
            analyses[symbol] = analysis
        
        # Log summary
        high_conf = sum(
            1 for a in analyses.values() 
            if a.spread_confidence >= 0.80
        )
        med_conf = sum(
            1 for a in analyses.values() 
            if 0.60 <= a.spread_confidence < 0.80
        )
        
        logger.info(
            f"Spread detection: {high_conf} high-confidence, "
            f"{med_conf} medium-confidence out of {len(detections)} signals"
        )
        
        return analyses
    
    def _find_matching_contracts(
        self,
        contract: OptionsContract,
        all_detections: List[Detection]
    ) -> List[OptionsContract]:
        """
        Find contracts that could form a spread with given contract.
        
        Matches on:
        - Same ticker
        - Same option type (for vertical spreads)
        - Similar expiry (for vertical) OR same strike (for calendar)
        """
        matches = []
        
        for detection in all_detections:
            other = detection.contract
            
            # Skip self
            if other.symbol == contract.symbol:
                continue
            
            # Must be same ticker
            if not other.symbol.startswith(contract.symbol.split('_')[0]):
                continue
            
            # Vertical spread: same expiry, same type, different strike
            if (other.expiry == contract.expiry and 
                other.option_type == contract.option_type):
                
                strike_diff = abs(other.strike - contract.strike)
                
                # Reasonable spread width
                if 0 < strike_diff <= self.max_strike_width:
                    matches.append(other)
            
            # Calendar spread: same strike, same type, different expiry
            elif (other.strike == contract.strike and
                  other.option_type == contract.option_type):
                
                days_apart = abs((other.expiry - contract.expiry).days)
                
                # Calendar spreads typically 7-90 days apart
                if 7 <= days_apart <= 90:
                    matches.append(other)
        
        return matches
    
    def _calculate_spread_confidence(
        self,
        contract: OptionsContract,
        matches: List[OptionsContract]
    ) -> SpreadAnalysis:
        """
        Calculate confidence that this contract is part of a spread.
        
        Uses conservative multi-indicator approach:
        - Volume correlation (strongest)
        - OI correlation (strong)
        - Strike proximity (supporting)
        - Detection timing (supporting)
        - IV similarity (supporting)
        
        Requires ≥3 indicators to align for confidence ≥ 80%
        """
        best_confidence = 0.0
        best_match = None
        best_indicators = []
        best_type = None
        best_reasoning = ""
        
        for match in matches:
            score = 0.0
            indicators = []
            
            # 1. Volume correlation (40% weight)
            if match.volume > 0:
                volume_ratio = contract.volume / match.volume
                
                if self._in_range(volume_ratio, self.tight_volume_ratio):
                    score += 0.40
                    indicators.append(
                        f"Tight volume match: {volume_ratio:.2f}"
                    )
                elif self._in_range(
                    volume_ratio, self.moderate_volume_ratio
                ):
                    score += 0.25
                    indicators.append(
                        f"Moderate volume match: {volume_ratio:.2f}"
                    )
            
            # 2. OI correlation (30% weight)
            if (contract.open_interest > 0 and match.open_interest > 0):
                oi_ratio = contract.open_interest / match.open_interest
                
                if self._in_range(oi_ratio, self.tight_oi_ratio):
                    score += 0.30
                    indicators.append(f"Tight OI match: {oi_ratio:.2f}")
                elif self._in_range(oi_ratio, self.moderate_oi_ratio):
                    score += 0.15
                    indicators.append(f"Moderate OI match: {oi_ratio:.2f}")
            
            # 3. Strike proximity (15% weight)
            strike_diff = abs(contract.strike - match.strike)
            if strike_diff > 0:  # Vertical spread
                if strike_diff <= 10:
                    score += 0.15
                    indicators.append(f"Tight strikes: ${strike_diff}")
                elif strike_diff <= 25:
                    score += 0.08
                    indicators.append(
                        f"Reasonable strikes: ${strike_diff}"
                    )
            
            # 4. Time proximity (10% weight)
            # Both detected in same scan = higher confidence
            time_diff = abs(
                (contract.timestamp - match.timestamp).total_seconds()
            )
            if time_diff < 300:  # 5 minutes
                score += 0.10
                indicators.append("Detected simultaneously")
            elif time_diff < 1800:  # 30 minutes
                score += 0.05
                indicators.append("Detected close in time")
            
            # 5. IV similarity (5% weight, if available)
            if (contract.implied_volatility and 
                match.implied_volatility):
                iv_diff = abs(
                    contract.implied_volatility - 
                    match.implied_volatility
                )
                if iv_diff < 0.05:
                    score += 0.05
                    indicators.append("Similar IV")
            
            # Determine spread type
            if match.expiry == contract.expiry:
                if contract.option_type == 'call':
                    spread_type = 'VERTICAL_CALL_SPREAD'
                else:
                    spread_type = 'VERTICAL_PUT_SPREAD'
            else:
                spread_type = 'CALENDAR_SPREAD'
            
            # Require minimum indicators to flag
            if len(indicators) >= self.min_indicators_required:
                if score > best_confidence:
                    best_confidence = score
                    best_match = match
                    best_indicators = indicators
                    best_type = spread_type
                    
                    # Build reasoning
                    if score >= 0.80:
                        best_reasoning = (
                            f"HIGH CONFIDENCE spread detected. "
                            f"Matched with {match.symbol}: "
                            f"{', '.join(indicators[:3])}"
                        )
                    elif score >= 0.60:
                        best_reasoning = (
                            f"Moderate confidence spread pattern. "
                            f"Matched with {match.symbol}: "
                            f"{', '.join(indicators[:2])}"
                        )
        
        # Cap confidence at 90% (never 100% certain with delayed data)
        best_confidence = min(best_confidence, 0.90)
        
        # Determine if likely spread (≥80% threshold)
        is_likely = best_confidence >= self.min_confidence_to_flag
        
        # Calculate metrics if we have a match
        strike_width = None
        net_premium = None
        matched_symbols = []
        
        if best_match:
            matched_symbols = [best_match.symbol]
            
            # Strike width for vertical spreads
            if best_match.expiry == contract.expiry:
                strike_width = abs(best_match.strike - contract.strike)
            
            # Estimate net premium (rough approximation)
            if contract.last_price > 0 and best_match.last_price > 0:
                net_premium = abs(
                    contract.last_price - best_match.last_price
                ) * contract.volume * 100
        
        # Return comprehensive analysis
        return SpreadAnalysis(
            is_likely_spread=is_likely,
            spread_confidence=best_confidence,
            spread_type=best_type if is_likely else (
                'POSSIBLE_SPREAD' if best_confidence >= 0.60 else None
            ),
            matched_contracts=matched_symbols,
            strike_width=strike_width,
            net_premium=net_premium,
            reasoning=best_reasoning if best_reasoning else (
                "No strong spread pattern detected"
            ),
            detection_indicators=best_indicators
        )
    
    def _group_by_ticker_expiry(
        self,
        detections: List[Detection]
    ) -> Dict[Tuple[str, date, str], List[Detection]]:
        """Group detections by ticker, expiry, and option type."""
        grouped = {}
        
        for detection in detections:
            contract = detection.contract
            
            # Extract ticker from symbol (before first underscore or digit)
            symbol_parts = contract.symbol.split('_')
            ticker = symbol_parts[0] if symbol_parts else contract.symbol
            
            key = (ticker, contract.expiry, contract.option_type)
            
            if key not in grouped:
                grouped[key] = []
            grouped[key].append(detection)
        
        return grouped
    
    def _in_range(
        self, value: float, bounds: Tuple[float, float]
    ) -> bool:
        """Check if value is within bounds."""
        return bounds[0] <= value <= bounds[1]


# Helper function for integration
def enrich_detections_with_spread_analysis(
    detections: List[Detection],
    config: Optional[Dict] = None
) -> Tuple[List[Detection], Dict[str, SpreadAnalysis]]:
    """
    Convenience function to analyze detections for spreads.
    
    Returns:
        Tuple of (original detections, spread analyses dict)
    """
    detector = SpreadDetector(config)
    analyses = detector.analyze_all_signals(detections)
    
    return detections, analyses

