"""Signal grading and scoring system."""

from typing import Dict, List, Any
from loguru import logger

from ..storage.models import UnusualOptionsSignal
from ..scanner.detector import Detection


class SignalGrader:
    """Multi-factor scoring system for signal quality."""
    
    # Weight allocations for different factors
    WEIGHTS = {
        'volume': 0.35,      # Volume anomaly strength
        'premium': 0.25,     # Premium flow size
        'oi': 0.20,          # Open interest changes
        'spread': 0.10,      # Bid-ask spread tightness
        'ratio': 0.10        # Put/call ratio extremes
    }
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
    
    def create_signal_from_detections(
        self,
        ticker: str,
        underlying_price: float,
        detections: List[Detection]
    ) -> UnusualOptionsSignal:
        """
        Create a signal from multiple detections.
        
        Args:
            ticker: Stock ticker symbol
            underlying_price: Current stock price
            detections: List of anomaly detections
            
        Returns:
            UnusualOptionsSignal with calculated score and grade
        """
        if not detections:
            raise ValueError("Cannot create signal from empty detections list")
        
        # Use the detection with highest confidence as primary
        primary_detection = max(detections, key=lambda d: d.confidence)
        contract = primary_detection.contract
        
        # Create base signal
        signal = UnusualOptionsSignal(
            ticker=ticker,
            option_symbol=contract.symbol,
            strike=contract.strike,
            expiry=contract.expiry,
            option_type=contract.option_type,
            days_to_expiry=(contract.expiry - contract.timestamp.date()).days,
            underlying_price=underlying_price,
            current_volume=contract.volume,
            current_oi=contract.open_interest,
            implied_volatility=contract.implied_volatility,
            data_provider="YFinance"
        )
        
        # Set detection flags and extract metrics
        detection_metrics = {}
        heuristic_count = 0
        
        for detection in detections:
            # Track heuristic detections
            if detection.metrics.get('heuristic', False):
                heuristic_count += 1
            
            if detection.detection_type == 'VOLUME_ANOMALY':
                signal.has_volume_anomaly = True
                signal.volume_ratio = detection.metrics.get('volume_ratio', 0)
                signal.average_volume = detection.metrics.get('average_volume', 0)
                detection_metrics['volume'] = detection.confidence
                
            elif detection.detection_type == 'OI_SPIKE':
                signal.has_oi_spike = True
                signal.oi_change_pct = detection.metrics.get('oi_change_pct', 0)
                signal.previous_oi = detection.metrics.get('previous_oi', 0)
                detection_metrics['oi'] = detection.confidence
                
            elif detection.detection_type == 'PREMIUM_FLOW':
                signal.has_premium_flow = True
                signal.premium_flow = detection.metrics.get('total_premium', 0)
                signal.aggressive_order_pct = detection.metrics.get('aggressive_pct', 0)
                detection_metrics['premium'] = detection.confidence
                
            elif detection.detection_type == 'TIGHT_SPREAD':
                detection_metrics['spread'] = detection.confidence
                
            elif detection.detection_type == 'PC_RATIO_ANOMALY':
                signal.put_call_ratio = detection.metrics.get('put_call_ratio', 0)
                signal.sentiment = detection.metrics.get('sentiment', 'NEUTRAL')
                detection_metrics['ratio'] = detection.confidence
        
        # Mark if signal is primarily heuristic-based
        if heuristic_count >= len(detections) * 0.7:  # 70% or more heuristic
            detection_metrics['heuristic_only'] = True
        
        # Calculate overall score
        signal.overall_score = self._calculate_overall_score(detection_metrics)
        signal.grade = self._assign_grade(signal.overall_score)
        signal.confidence = self._calculate_confidence(detections)
        
        # Determine moneyness
        signal.moneyness = self._calculate_moneyness(contract.strike, underlying_price, contract.option_type)
        
        # Basic risk assessment
        signal.risk_level, signal.risk_factors = self._assess_basic_risk(signal)
        
        # Apply risk-based score adjustment
        signal.overall_score = self._apply_risk_adjustment(signal.overall_score, signal.risk_level, signal.risk_factors)
        
        logger.info(f"Created signal: {ticker} {contract.symbol} Grade: {signal.grade} Score: {signal.overall_score:.3f}")
        
        return signal
    
    def _calculate_overall_score(self, detection_metrics: Dict[str, float]) -> float:
        """
        Calculate weighted overall score from detection confidences.
        
        Args:
            detection_metrics: Dictionary of detection_type -> confidence
            
        Returns:
            Overall score between 0.0 and 1.0
        """
        total_score = 0.0
        total_weight = 0.0
        
        for factor, weight in self.WEIGHTS.items():
            if factor in detection_metrics:
                total_score += detection_metrics[factor] * weight
                total_weight += weight
        
        # Normalize by actual weights used
        if total_weight > 0:
            normalized_score = total_score / total_weight
        else:
            normalized_score = 0.0
        
        # Reduced bonus for multiple detection types
        detection_count = len(detection_metrics)
        if detection_count >= 4:
            bonus = 0.08  # Reduced from 0.15
        elif detection_count >= 3:
            bonus = 0.05  # Reduced from 0.15
        elif detection_count >= 2:
            bonus = 0.03  # Reduced from 0.10
        else:
            bonus = 0.0
        
        # Apply penalty for heuristic-only detections
        heuristic_penalty = 0.0
        if 'heuristic_only' in detection_metrics:
            heuristic_penalty = 0.15
        
        final_score = max(min(normalized_score + bonus - heuristic_penalty, 0.95), 0.0)  # Cap at 0.95
        
        logger.debug(f"Score calculation: base={normalized_score:.3f}, bonus={bonus:.3f}, penalty={heuristic_penalty:.3f}, final={final_score:.3f}")
        
        return final_score
    
    def _assign_grade(self, score: float) -> str:
        """Convert numerical score to letter grade with stricter thresholds."""
        if score >= 0.85:  # Increased from 0.90
            return 'S'
        elif score >= 0.75:  # Increased from 0.80
            return 'A'
        elif score >= 0.65:  # Increased from 0.70
            return 'B'
        elif score >= 0.55:  # Increased from 0.60
            return 'C'
        elif score >= 0.45:  # Increased from 0.50
            return 'D'
        else:
            return 'F'
    
    def _calculate_confidence(self, detections: List[Detection]) -> float:
        """Calculate overall confidence from detections."""
        if not detections:
            return 0.0
        
        # Use average confidence, weighted by detection importance
        weights = {
            'VOLUME_ANOMALY': 0.3,
            'PREMIUM_FLOW': 0.25,
            'OI_SPIKE': 0.2,
            'PC_RATIO_ANOMALY': 0.15,
            'TIGHT_SPREAD': 0.1
        }
        
        total_confidence = 0.0
        total_weight = 0.0
        
        for detection in detections:
            weight = weights.get(detection.detection_type, 0.1)
            total_confidence += detection.confidence * weight
            total_weight += weight
        
        return total_confidence / total_weight if total_weight > 0 else 0.5
    
    def _calculate_moneyness(self, strike: float, underlying_price: float, option_type: str) -> str:
        """Calculate if option is ITM, ATM, or OTM."""
        price_diff_pct = abs(strike - underlying_price) / underlying_price
        
        if price_diff_pct < 0.02:  # Within 2%
            return 'ATM'
        
        if option_type == 'call':
            return 'ITM' if strike < underlying_price else 'OTM'
        else:  # put
            return 'ITM' if strike > underlying_price else 'OTM'
    
    def _assess_basic_risk(self, signal: UnusualOptionsSignal) -> tuple[str, List[str]]:
        """
        Perform basic risk assessment.
        
        Returns:
            Tuple of (risk_level, risk_factors)
        """
        risk_factors = []
        
        # Check days to expiry
        if signal.days_to_expiry <= 7:
            risk_factors.append("SHORT_EXPIRY")
        
        # Check if very OTM
        if signal.moneyness == 'OTM':
            price_diff_pct = abs(signal.strike - signal.underlying_price) / signal.underlying_price
            if price_diff_pct > 0.10:  # > 10% OTM
                risk_factors.append("FAR_OTM")
        
        # Check volume vs OI ratio
        if signal.current_oi > 0:
            vol_oi_ratio = signal.current_volume / signal.current_oi
            if vol_oi_ratio > 2.0:  # High volume relative to OI
                risk_factors.append("HIGH_VOLUME_LOW_OI")
        
        # Check premium size (too small might be retail noise)
        if signal.premium_flow > 0 and signal.premium_flow < 250000:  # Increased from 50k
            risk_factors.append("SMALL_PREMIUM")
        
        # Check for unrealistic moneyness scenarios
        if signal.moneyness == 'OTM':
            price_diff_pct = abs(signal.strike - signal.underlying_price) / signal.underlying_price
            if price_diff_pct > 0.25:  # > 25% OTM
                risk_factors.append("EXTREMELY_OTM")
        
        # Check for very short expiry with high risk
        if signal.days_to_expiry <= 2 and signal.moneyness == 'OTM':
            risk_factors.append("SHORT_EXPIRY_OTM")
        
        # Check for low implied volatility (might indicate stale data)
        if signal.implied_volatility is not None and signal.implied_volatility < 0.10:  # < 10% IV
            risk_factors.append("LOW_IV")
        
        # Determine overall risk level with more nuanced assessment
        high_risk_factors = {"EXTREMELY_OTM", "SHORT_EXPIRY_OTM"}
        has_high_risk = any(factor in high_risk_factors for factor in risk_factors)
        
        risk_count = len(risk_factors)
        if has_high_risk or risk_count >= 4:
            risk_level = "HIGH"
        elif risk_count >= 3:
            risk_level = "HIGH"
        elif risk_count >= 2:
            risk_level = "MEDIUM"
        elif risk_count >= 1:
            risk_level = "LOW"
        else:
            risk_level = "LOW"
        
        return risk_level, risk_factors
    
    def _apply_risk_adjustment(self, score: float, risk_level: str, risk_factors: List[str]) -> float:
        """
        Apply risk-based adjustments to the overall score.
        
        Args:
            score: Original score
            risk_level: Risk level (LOW/MEDIUM/HIGH)
            risk_factors: List of risk factors
            
        Returns:
            Adjusted score
        """
        penalty = 0.0
        
        # Apply penalties for specific risk factors
        for factor in risk_factors:
            if factor == "SHORT_EXPIRY":
                penalty += 0.10  # 10% penalty for short expiry
            elif factor == "FAR_OTM":
                penalty += 0.15  # 15% penalty for far OTM
            elif factor == "EXTREMELY_OTM":
                penalty += 0.25  # 25% penalty for extremely OTM
            elif factor == "HIGH_VOLUME_LOW_OI":
                penalty += 0.08  # 8% penalty for suspicious volume/OI ratio
            elif factor == "SMALL_PREMIUM":
                penalty += 0.12  # 12% penalty for small premium (likely retail)
            elif factor == "SHORT_EXPIRY_OTM":
                penalty += 0.20  # 20% penalty for short expiry + OTM combo
            elif factor == "LOW_IV":
                penalty += 0.10  # 10% penalty for low IV (stale data)
        
        # Apply overall risk level penalty
        if risk_level == "HIGH":
            penalty += 0.05
        elif risk_level == "MEDIUM":
            penalty += 0.02
        
        adjusted_score = max(score - penalty, 0.0)
        
        if penalty > 0:
            logger.debug(f"Applied risk penalty: {penalty:.3f}, adjusted score: {score:.3f} -> {adjusted_score:.3f}")
        
        return adjusted_score


class PerformanceTracker:
    """Track signal performance over time."""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
    
    def calculate_forward_returns(
        self,
        entry_price: float,
        current_price: float,
        days_elapsed: int
    ) -> Dict[str, float]:
        """
        Calculate forward returns for performance tracking.
        
        Args:
            entry_price: Price when signal was generated
            current_price: Current stock price
            days_elapsed: Days since signal
            
        Returns:
            Dictionary with return metrics
        """
        if entry_price <= 0:
            return {}
        
        return_pct = (current_price - entry_price) / entry_price
        
        return {
            'return_pct': return_pct,
            'return_dollars': current_price - entry_price,
            'days_elapsed': days_elapsed,
            'annualized_return': return_pct * (365 / max(days_elapsed, 1))
        }
    
    def classify_win_loss(
        self,
        return_pct: float,
        sentiment: str,
        threshold: float = 0.02
    ) -> bool:
        """
        Classify signal as win or loss based on direction and threshold.
        
        Args:
            return_pct: Forward return percentage
            sentiment: Signal sentiment (BULLISH/BEARISH/NEUTRAL)
            threshold: Minimum return to count as win (default 2%)
            
        Returns:
            True if win, False if loss
        """
        if sentiment == 'BULLISH':
            return return_pct >= threshold
        elif sentiment == 'BEARISH':
            return return_pct <= -threshold
        else:  # NEUTRAL
            return abs(return_pct) >= threshold
