"""
Trade Validation Checklist - 10-Point Pre-Trade Validation

Every trade must pass 8/10 checks before execution.
"""

from dataclasses import dataclass, field
from typing import List, Dict, Optional
from enum import Enum

from ..models.signal import EnrichedSignal
from ..models.analysis import ValidationResult, ValidationCheck


class CheckCategory(Enum):
    """Categories of validation checks."""
    TECHNICAL = "technical"
    SIGNAL_QUALITY = "signal_quality"
    MACRO = "macro"


@dataclass
class ValidationCheck:
    """Individual validation check."""
    name: str
    category: CheckCategory
    passed: bool
    score: float  # 0-1
    reason: str
    weight: float = 1.0
    critical: bool = False  # If True, failing this fails entire validation


@dataclass
class ValidationConfig:
    """Configuration for validation thresholds."""
    
    # Technical thresholds
    max_rsi_call: float = 70  # RSI above this = overbought (bad for calls)
    min_rsi_put: float = 30  # RSI below this = oversold (bad for puts)
    min_iv_rank_for_buying: float = 0  # Don't buy if IV too high
    max_iv_rank_for_buying: float = 60
    
    # Signal quality thresholds
    min_score: float = 0.75
    min_confidence: float = 0.75
    min_premium_flow: float = 500_000
    
    # Risk thresholds
    max_position_pct: float = 5.0
    min_risk_reward: float = 1.5
    
    # Macro
    allow_against_market: bool = False
    
    # Overall
    min_checks_passed: int = 8
    total_checks: int = 10


class TradeValidator:
    """
    Validates trades using 10-point checklist before execution.
    
    Categories:
    - Technical (3 checks): Chart, IV, Earnings
    - Signal Quality (4 checks): Score, Flow, Timing, Spread status
    - Macro (3 checks): Market, Ticker, Correlation
    """
    
    def __init__(self, config: Optional[ValidationConfig] = None):
        self.config = config or ValidationConfig()
    
    def validate_trade(
        self, 
        signal: EnrichedSignal,
        market_data: Optional[Dict] = None
    ) -> ValidationResult:
        """
        Run complete 10-point validation checklist.
        
        Returns:
            ValidationResult with pass/fail and detailed reasoning.
        """
        checks: List[ValidationCheck] = []
        
        # ===== TECHNICAL CHECKS (3) =====
        
        # Check 1: Chart Confirmation
        checks.append(self._check_chart_confirmation(signal, market_data))
        
        # Check 2: IV Rank
        checks.append(self._check_iv_rank(signal))
        
        # Check 3: Earnings Calendar
        checks.append(self._check_earnings(signal))
        
        # ===== SIGNAL QUALITY CHECKS (4) =====
        
        # Check 4: Score Breakdown
        checks.append(self._check_score(signal))
        
        # Check 5: Flow Analysis
        checks.append(self._check_flow(signal))
        
        # Check 6: Timing Check
        checks.append(self._check_timing(signal))
        
        # Check 7: Spread Status
        checks.append(self._check_spread_status(signal))
        
        # ===== MACRO CHECKS (3) =====
        
        # Check 8: Market Environment
        checks.append(self._check_market_environment(signal, market_data))
        
        # Check 9: Ticker Fundamentals
        checks.append(self._check_ticker_fundamentals(signal))
        
        # Check 10: Risk Assessment
        checks.append(self._check_risk_assessment(signal))
        
        # Calculate results
        passed_count = sum(1 for c in checks if c.passed)
        total_count = len(checks)
        score = sum(c.score * c.weight for c in checks) / sum(c.weight for c in checks)
        
        # Check for critical failures
        critical_failures = [c for c in checks if not c.passed and c.critical]
        
        overall_pass = (
            passed_count >= self.config.min_checks_passed and
            len(critical_failures) == 0
        )
        
        return ValidationResult(
            signal_id=signal.signal_id,
            ticker=signal.ticker,
            passed=overall_pass,
            checks_passed=passed_count,
            checks_total=total_count,
            score=score,
            checks=checks,
            critical_failures=critical_failures,
            recommendation=self._get_recommendation(
                overall_pass, 
                passed_count, 
                score
            ),
            summary=self._get_summary(checks, passed_count, score)
        )
    
    def _check_chart_confirmation(
        self, 
        signal: EnrichedSignal,
        market_data: Optional[Dict]
    ) -> ValidationCheck:
        """Check 1: Chart shows technical confirmation."""
        
        if not market_data or 'technical' not in market_data:
            return ValidationCheck(
                name="Chart Confirmation",
                category=CheckCategory.TECHNICAL,
                passed=True,  # Pass if no data (don't penalize)
                score=0.5,
                reason="No technical data available for confirmation"
            )
        
        tech = market_data['technical']
        rsi = tech.get('rsi')
        trend = tech.get('trend', 'NEUTRAL')
        
        passed = True
        score = 1.0
        reasons = []
        
        # RSI checks
        if rsi:
            if signal.option_type == 'call':
                if rsi > self.config.max_rsi_call:
                    passed = False
                    score = 0.0
                    reasons.append(f"RSI overbought ({rsi:.1f})")
                elif rsi > 60:
                    score = 0.7
                    reasons.append(f"RSI elevated ({rsi:.1f})")
                else:
                    reasons.append(f"RSI healthy ({rsi:.1f})")
            else:  # put
                if rsi < self.config.min_rsi_put:
                    passed = False
                    score = 0.0
                    reasons.append(f"RSI oversold ({rsi:.1f})")
                elif rsi < 40:
                    score = 0.7
                    reasons.append(f"RSI low ({rsi:.1f})")
                else:
                    reasons.append(f"RSI healthy ({rsi:.1f})")
        
        # Trend alignment
        if signal.option_type == 'call' and trend != 'BULLISH':
            score *= 0.8
            reasons.append(f"Trend: {trend} (call prefers bullish)")
        elif signal.option_type == 'put' and trend != 'BEARISH':
            score *= 0.8
            reasons.append(f"Trend: {trend} (put prefers bearish)")
        else:
            reasons.append(f"Trend aligned: {trend}")
        
        return ValidationCheck(
            name="Chart Confirmation",
            category=CheckCategory.TECHNICAL,
            passed=passed,
            score=score,
            reason=", ".join(reasons)
        )
    
    def _check_iv_rank(self, signal: EnrichedSignal) -> ValidationCheck:
        """Check 2: IV Rank appropriate for buying options."""
        
        iv_rank = signal.iv_rank if hasattr(signal, 'iv_rank') else None
        
        if iv_rank is None:
            return ValidationCheck(
                name="IV Rank",
                category=CheckCategory.TECHNICAL,
                passed=True,
                score=0.5,
                reason="IV rank not available"
            )
        
        if iv_rank > self.config.max_iv_rank_for_buying:
            return ValidationCheck(
                name="IV Rank",
                category=CheckCategory.TECHNICAL,
                passed=False,
                score=0.0,
                reason=f"IV rank too high ({iv_rank:.0f}), overpaying for volatility",
                critical=False
            )
        elif iv_rank > 50:
            return ValidationCheck(
                name="IV Rank",
                category=CheckCategory.TECHNICAL,
                passed=True,
                score=0.7,
                reason=f"IV rank elevated ({iv_rank:.0f}), but acceptable"
            )
        else:
            return ValidationCheck(
                name="IV Rank",
                category=CheckCategory.TECHNICAL,
                passed=True,
                score=1.0,
                reason=f"IV rank favorable ({iv_rank:.0f})"
            )
    
    def _check_earnings(self, signal: EnrichedSignal) -> ValidationCheck:
        """Check 3: Earnings timing check."""
        
        days_to_earnings = getattr(signal, 'days_to_earnings', None)
        
        if days_to_earnings is None:
            return ValidationCheck(
                name="Earnings Calendar",
                category=CheckCategory.TECHNICAL,
                passed=True,
                score=0.8,
                reason="No earnings data available"
            )
        
        dte = signal.days_to_expiry
        
        # Earnings before expiration
        if 0 < days_to_earnings < dte:
            # This could be intentional (earnings play)
            if signal.grade == 'S' and signal.overall_score > 0.85:
                return ValidationCheck(
                    name="Earnings Calendar",
                    category=CheckCategory.TECHNICAL,
                    passed=True,
                    score=1.0,
                    reason=f"Earnings in {days_to_earnings}d (intentional catalyst play)",
                    weight=1.5  # Bonus for earnings catalyst
                )
            else:
                return ValidationCheck(
                    name="Earnings Calendar",
                    category=CheckCategory.TECHNICAL,
                    passed=False,
                    score=0.3,
                    reason=f"Earnings in {days_to_earnings}d before expiration (IV crush risk)"
                )
        
        return ValidationCheck(
            name="Earnings Calendar",
            category=CheckCategory.TECHNICAL,
            passed=True,
            score=1.0,
            reason="No earnings conflict"
        )
    
    def _check_score(self, signal: EnrichedSignal) -> ValidationCheck:
        """Check 4: Signal score breakdown."""
        
        score_ok = signal.overall_score >= self.config.min_score
        conf_ok = signal.confidence >= self.config.min_confidence
        grade_ok = signal.grade in ['S', 'A']
        
        all_ok = score_ok and conf_ok and grade_ok
        
        parts = []
        if not score_ok:
            parts.append(f"Score {signal.overall_score:.2f} "
                        f"(need {self.config.min_score})")
        if not conf_ok:
            parts.append(f"Confidence {signal.confidence:.2f} "
                        f"(need {self.config.min_confidence})")
        if not grade_ok:
            parts.append(f"Grade {signal.grade} (prefer S/A)")
        
        if all_ok:
            reason = (
                f"Grade {signal.grade}, "
                f"Score {signal.overall_score:.2f}, "
                f"Conf {signal.confidence:.2f}"
            )
        else:
            reason = "Quality issues: " + ", ".join(parts)
        
        return ValidationCheck(
            name="Score Breakdown",
            category=CheckCategory.SIGNAL_QUALITY,
            passed=all_ok,
            score=1.0 if all_ok else 0.5,
            reason=reason,
            critical=not score_ok  # Low score is critical
        )
    
    def _check_flow(self, signal: EnrichedSignal) -> ValidationCheck:
        """Check 5: Premium flow analysis."""
        
        flow_ok = signal.premium_flow >= self.config.min_premium_flow
        volume_ok = signal.volume_ratio >= 3.0
        
        if flow_ok or volume_ok:
            reason = f"Premium ${signal.premium_flow:,.0f}, "
            reason += f"Volume {signal.volume_ratio:.1f}x"
            return ValidationCheck(
                name="Flow Analysis",
                category=CheckCategory.SIGNAL_QUALITY,
                passed=True,
                score=1.0,
                reason=reason
            )
        else:
            return ValidationCheck(
                name="Flow Analysis",
                category=CheckCategory.SIGNAL_QUALITY,
                passed=False,
                score=0.3,
                reason=f"Low flow ${signal.premium_flow:,.0f}, "
                      f"volume {signal.volume_ratio:.1f}x"
            )
    
    def _check_timing(self, signal: EnrichedSignal) -> ValidationCheck:
        """Check 6: Signal timing - freshness and DTE."""
        
        # Check DTE
        dte = signal.days_to_expiry
        dte_ok = 10 <= dte <= 60
        
        # Check signal freshness (multiple detections = sustained interest)
        detection_count = getattr(signal, 'detection_count', 1)
        fresh = detection_count >= 2
        
        reasons = []
        score = 1.0
        
        if not dte_ok:
            if dte < 10:
                reasons.append(f"{dte} DTE (high theta decay)")
                score = 0.3
            else:
                reasons.append(f"{dte} DTE (too far out)")
                score = 0.7
        else:
            reasons.append(f"{dte} DTE optimal")
        
        if fresh:
            reasons.append(f"{detection_count} detections (sustained)")
        else:
            reasons.append("Single detection")
            score *= 0.9
        
        return ValidationCheck(
            name="Timing Check",
            category=CheckCategory.SIGNAL_QUALITY,
            passed=dte_ok,
            score=score,
            reason=", ".join(reasons)
        )
    
    def _check_spread_status(self, signal: EnrichedSignal) -> ValidationCheck:
        """Check 7: Not part of unidentified spread."""
        
        is_likely_spread = getattr(signal, 'is_likely_spread', False)
        
        if is_likely_spread:
            return ValidationCheck(
                name="Spread Status",
                category=CheckCategory.SIGNAL_QUALITY,
                passed=False,
                score=0.0,
                reason="Likely part of spread (missing other leg)",
                critical=True
            )
        
        return ValidationCheck(
            name="Spread Status",
            category=CheckCategory.SIGNAL_QUALITY,
            passed=True,
            score=1.0,
            reason="Standalone signal"
        )
    
    def _check_market_environment(
        self, 
        signal: EnrichedSignal,
        market_data: Optional[Dict]
    ) -> ValidationCheck:
        """Check 8: Market environment alignment."""
        
        if not market_data or 'market' not in market_data:
            return ValidationCheck(
                name="Market Environment",
                category=CheckCategory.MACRO,
                passed=True,
                score=0.7,
                reason="No market data available"
            )
        
        market = market_data['market']
        spy_trend = market.get('spy_trend', 'NEUTRAL')
        vix = market.get('vix')
        
        # Check alignment
        call_in_bull = (signal.option_type == 'call' and spy_trend == 'BULLISH')
        put_in_bear = (signal.option_type == 'put' and spy_trend == 'BEARISH')
        aligned = call_in_bull or put_in_bear
        
        # VIX check
        vix_warning = vix and vix > 30
        
        reasons = []
        score = 1.0
        
        if aligned:
            reasons.append(f"Aligned with market ({spy_trend})")
        else:
            if self.config.allow_against_market:
                reasons.append(f"Against market ({spy_trend}), but allowed")
                score = 0.7
            else:
                reasons.append(f"Against market ({spy_trend})")
                score = 0.3
        
        if vix_warning:
            reasons.append(f"VIX elevated ({vix:.1f})")
            score *= 0.8
        
        return ValidationCheck(
            name="Market Environment",
            category=CheckCategory.MACRO,
            passed=aligned or self.config.allow_against_market,
            score=score,
            reason=", ".join(reasons)
        )
    
    def _check_ticker_fundamentals(
        self, 
        signal: EnrichedSignal
    ) -> ValidationCheck:
        """Check 9: No major negative catalysts."""
        
        # This would check news, legal issues, etc.
        # For now, simple check based on what's available
        
        risk_factors = signal.risk_factors or []
        high_risk = len(risk_factors) > 3
        
        if high_risk:
            return ValidationCheck(
                name="Ticker Fundamentals",
                category=CheckCategory.MACRO,
                passed=False,
                score=0.4,
                reason=f"Multiple risk factors: {', '.join(risk_factors[:3])}"
            )
        elif risk_factors:
            return ValidationCheck(
                name="Ticker Fundamentals",
                category=CheckCategory.MACRO,
                passed=True,
                score=0.8,
                reason=f"Some risks: {', '.join(risk_factors)}"
            )
        else:
            return ValidationCheck(
                name="Ticker Fundamentals",
                category=CheckCategory.MACRO,
                passed=True,
                score=1.0,
                reason="No major risk factors identified"
            )
    
    def _check_risk_assessment(
        self, 
        signal: EnrichedSignal
    ) -> ValidationCheck:
        """Check 10: Overall risk assessment."""
        
        # This would be enhanced with position sizing calculation
        # For now, check basic risk factors
        
        risk_level = signal.risk_level
        moneyness = signal.moneyness
        
        # Assess risk
        low_risk = (
            risk_level in ['LOW', 'MEDIUM'] and
            moneyness in ['ITM', 'ATM']
        )
        
        if low_risk:
            return ValidationCheck(
                name="Risk Assessment",
                category=CheckCategory.MACRO,
                passed=True,
                score=1.0,
                reason=f"{risk_level} risk, {moneyness}"
            )
        else:
            return ValidationCheck(
                name="Risk Assessment",
                category=CheckCategory.MACRO,
                passed=False,
                score=0.5,
                reason=f"{risk_level} risk, {moneyness} (elevated risk)"
            )
    
    def _get_recommendation(
        self, 
        overall_pass: bool, 
        passed_count: int,
        score: float
    ) -> str:
        """Get recommendation based on validation results."""
        
        if not overall_pass:
            return "❌ DO NOT TRADE - Failed validation"
        
        if passed_count >= 9:
            return "🚀 EXCELLENT - Trade immediately"
        elif passed_count >= 8:
            return "✅ GOOD - Viable trade"
        else:
            return "⚠️ MARGINAL - Extra caution advised"
    
    def _get_summary(
        self, 
        checks: List[ValidationCheck],
        passed_count: int,
        score: float
    ) -> str:
        """Generate human-readable summary."""
        
        passed_checks = [c.name for c in checks if c.passed]
        failed_checks = [c.name for c in checks if not c.passed]
        
        summary = f"Passed {passed_count}/10 checks (Score: {score:.1%})\n"
        
        if failed_checks:
            summary += f"\n❌ Failed: {', '.join(failed_checks)}"
        
        critical = [c for c in checks if not c.passed and c.critical]
        if critical:
            summary += f"\n🚨 Critical Issues: {', '.join(c.name for c in critical)}"
        
        return summary

