"""
Signal Filtering System - The 5-Filter Pipeline

Systematically reduces 1000+ signals down to 10-20 high-quality opportunities
using the proven 5-Filter methodology.
"""

from dataclasses import dataclass
from typing import List, Dict, Optional
from datetime import datetime, timedelta

from ..models.signal import EnrichedSignal
from ..models.analysis import FilterResult, FilterStats


@dataclass
class FilterConfig:
    """Configuration for the 5-Filter System."""
    
    # Filter 1: Quality Score
    min_score: float = 0.75
    min_confidence: float = 0.70
    accepted_grades: List[str] = None
    
    # Filter 2: Time Decay Protection
    min_days_to_expiry: int = 10
    max_days_to_expiry: int = 60
    
    # Filter 3: Premium Flow
    min_premium_flow: float = 500_000
    min_volume_ratio: float = 5.0
    
    # Filter 4: Moneyness
    accepted_moneyness: List[str] = None
    exclude_deep_itm: bool = True
    exclude_far_otm: bool = True
    
    # Filter 5: Consistency
    min_signal_count: int = 3
    min_consistency_score: int = 3
    
    def __post_init__(self):
        if self.accepted_grades is None:
            self.accepted_grades = ['S', 'A']
        if self.accepted_moneyness is None:
            self.accepted_moneyness = ['ITM', 'ATM']


class SignalFilter:
    """
    Implements the 5-Filter System to identify best trading opportunities.
    
    Filters are applied sequentially:
    1. Quality Score (grade, score, confidence)
    2. Time Decay Protection (days to expiry)
    3. Premium Flow Significance (institutional commitment)
    4. Moneyness Sweet Spot (ITM/ATM only)
    5. Ticker Consistency (multiple confirming signals)
    """
    
    def __init__(self, config: Optional[FilterConfig] = None):
        self.config = config or FilterConfig()
        self.stats = FilterStats()
    
    def apply_all_filters(
        self, 
        signals: List[EnrichedSignal]
    ) -> Dict[str, any]:
        """
        Apply all 5 filters sequentially and return results with stats.
        
        Returns:
            Dict containing:
            - filtered_signals: Final list after all filters
            - filter_stats: Statistics for each filter step
            - consistency_scores: Ticker consistency metrics
        """
        self.stats.reset()
        self.stats.total_input = len(signals)
        
        # Filter 1: Quality Score
        signals = self._apply_quality_filter(signals)
        self.stats.after_quality = len(signals)
        
        # Filter 2: Time Decay Protection
        signals = self._apply_time_decay_filter(signals)
        self.stats.after_time_decay = len(signals)
        
        # Filter 3: Premium Flow
        signals = self._apply_premium_filter(signals)
        self.stats.after_premium = len(signals)
        
        # Filter 4: Moneyness
        signals = self._apply_moneyness_filter(signals)
        self.stats.after_moneyness = len(signals)
        
        # Filter 5: Consistency
        consistency_scores = self._calculate_consistency_scores(signals)
        signals = self._apply_consistency_filter(
            signals, 
            consistency_scores
        )
        self.stats.after_consistency = len(signals)
        self.stats.final_output = len(signals)
        
        return {
            'filtered_signals': signals,
            'filter_stats': self.stats,
            'consistency_scores': consistency_scores,
            'reduction_rate': (
                (self.stats.total_input - self.stats.final_output) 
                / self.stats.total_input * 100
            ) if self.stats.total_input > 0 else 0
        }
    
    def _apply_quality_filter(
        self, 
        signals: List[EnrichedSignal]
    ) -> List[EnrichedSignal]:
        """
        Filter 1: Quality Score
        Keep only signals with high score, confidence, and grade.
        """
        filtered = []
        for signal in signals:
            if (signal.overall_score >= self.config.min_score and
                signal.confidence >= self.config.min_confidence and
                signal.grade in self.config.accepted_grades):
                signal.filter_passed['quality'] = True
                filtered.append(signal)
            else:
                signal.filter_passed['quality'] = False
                signal.filter_reasons.append(
                    f"Quality: Score {signal.overall_score:.2f} "
                    f"(need {self.config.min_score})"
                )
        
        return filtered
    
    def _apply_time_decay_filter(
        self, 
        signals: List[EnrichedSignal]
    ) -> List[EnrichedSignal]:
        """
        Filter 2: Time Decay Protection
        Avoid options with extreme theta decay (<10 days) or too far out.
        """
        filtered = []
        for signal in signals:
            dte = signal.days_to_expiry
            if (self.config.min_days_to_expiry <= dte <= 
                self.config.max_days_to_expiry):
                signal.filter_passed['time_decay'] = True
                filtered.append(signal)
            else:
                signal.filter_passed['time_decay'] = False
                if dte < self.config.min_days_to_expiry:
                    signal.filter_reasons.append(
                        f"Time: Only {dte} DTE "
                        f"(need {self.config.min_days_to_expiry}+)"
                    )
                else:
                    signal.filter_reasons.append(
                        f"Time: Too far out {dte} DTE "
                        f"(max {self.config.max_days_to_expiry})"
                    )
        
        return filtered
    
    def _apply_premium_filter(
        self, 
        signals: List[EnrichedSignal]
    ) -> List[EnrichedSignal]:
        """
        Filter 3: Premium Flow Significance
        Keep only signals with large institutional commitment.
        """
        filtered = []
        for signal in signals:
            premium_ok = (
                signal.premium_flow >= self.config.min_premium_flow
            )
            volume_ok = (
                signal.volume_ratio >= self.config.min_volume_ratio
            )
            
            if premium_ok or volume_ok:
                signal.filter_passed['premium'] = True
                filtered.append(signal)
            else:
                signal.filter_passed['premium'] = False
                signal.filter_reasons.append(
                    f"Premium: ${signal.premium_flow:,.0f} "
                    f"(need ${self.config.min_premium_flow:,.0f}) "
                    f"or {signal.volume_ratio:.1f}x volume "
                    f"(need {self.config.min_volume_ratio}x)"
                )
        
        return filtered
    
    def _apply_moneyness_filter(
        self, 
        signals: List[EnrichedSignal]
    ) -> List[EnrichedSignal]:
        """
        Filter 4: Moneyness Sweet Spot
        Keep ITM/ATM only, avoid deep ITM (hedges) and far OTM (lottery).
        """
        filtered = []
        for signal in signals:
            if signal.moneyness in self.config.accepted_moneyness:
                # Additional checks for extremes
                underlying = signal.underlying_price
                strike = signal.strike
                
                if underlying and strike:
                    distance_pct = abs(
                        (strike - underlying) / underlying * 100
                    )
                    
                    # Skip deep ITM (likely hedges)
                    if self.config.exclude_deep_itm and distance_pct > 15:
                        if (signal.option_type == 'call' and 
                            strike < underlying * 0.85):
                            signal.filter_passed['moneyness'] = False
                            signal.filter_reasons.append(
                                "Moneyness: Deep ITM (likely hedge)"
                            )
                            continue
                        if (signal.option_type == 'put' and 
                            strike > underlying * 1.15):
                            signal.filter_passed['moneyness'] = False
                            signal.filter_reasons.append(
                                "Moneyness: Deep ITM (likely hedge)"
                            )
                            continue
                    
                    # Skip far OTM (lottery tickets)
                    if self.config.exclude_far_otm and distance_pct > 15:
                        if (signal.option_type == 'call' and 
                            strike > underlying * 1.15):
                            signal.filter_passed['moneyness'] = False
                            signal.filter_reasons.append(
                                "Moneyness: Far OTM (lottery ticket)"
                            )
                            continue
                        if (signal.option_type == 'put' and 
                            strike < underlying * 0.85):
                            signal.filter_passed['moneyness'] = False
                            signal.filter_reasons.append(
                                "Moneyness: Far OTM (lottery ticket)"
                            )
                            continue
                
                signal.filter_passed['moneyness'] = True
                filtered.append(signal)
            else:
                signal.filter_passed['moneyness'] = False
                signal.filter_reasons.append(
                    f"Moneyness: {signal.moneyness} "
                    f"(need {self.config.accepted_moneyness})"
                )
        
        return filtered
    
    def _calculate_consistency_scores(
        self, 
        signals: List[EnrichedSignal]
    ) -> Dict[str, Dict]:
        """
        Calculate consistency metrics per ticker for Filter 5.
        
        Scoring system:
        - Multiple signals: +3 (≥3 signals), +2 (2 signals)
        - Directional bias: +2 (>70% one direction)
        - Repeated strikes: +2 (same strike seen 2+ times)
        - Large premium: +2 (>$5M), +1 (>$2M)
        """
        from collections import defaultdict
        
        ticker_data = defaultdict(lambda: {
            'count': 0,
            'calls': 0,
            'puts': 0,
            'strikes': defaultdict(int),
            'total_premium': 0,
            'signals': [],
            'score': 0
        })
        
        # Aggregate data per ticker
        for signal in signals:
            ticker = signal.ticker
            ticker_data[ticker]['count'] += 1
            ticker_data[ticker]['total_premium'] += signal.premium_flow
            ticker_data[ticker]['signals'].append(signal)
            ticker_data[ticker]['strikes'][signal.strike] += 1
            
            if signal.option_type == 'call':
                ticker_data[ticker]['calls'] += 1
            else:
                ticker_data[ticker]['puts'] += 1
        
        # Calculate scores
        for ticker, data in ticker_data.items():
            score = 0
            
            # Multiple signals
            if data['count'] >= 3:
                score += 3
            elif data['count'] >= 2:
                score += 2
            
            # Directional consistency
            if data['count'] > 0:
                bias = abs(data['calls'] - data['puts']) / data['count']
                if bias > 0.7:
                    score += 2
                    data['direction'] = (
                        'BULLISH' if data['calls'] > data['puts'] 
                        else 'BEARISH'
                    )
                else:
                    data['direction'] = 'MIXED'
            
            # Repeated strikes
            max_strike_count = max(data['strikes'].values())
            if max_strike_count >= 2:
                score += 2
            
            # Premium flow
            if data['total_premium'] > 5_000_000:
                score += 2
            elif data['total_premium'] > 2_000_000:
                score += 1
            
            data['score'] = score
        
        return dict(ticker_data)
    
    def _apply_consistency_filter(
        self, 
        signals: List[EnrichedSignal],
        consistency_scores: Dict[str, Dict]
    ) -> List[EnrichedSignal]:
        """
        Filter 5: Ticker Consistency
        Keep only tickers with multiple confirming signals.
        """
        filtered = []
        
        for signal in signals:
            ticker_score = consistency_scores.get(
                signal.ticker, 
                {}
            ).get('score', 0)
            
            if ticker_score >= self.config.min_consistency_score:
                signal.filter_passed['consistency'] = True
                signal.consistency_score = ticker_score
                filtered.append(signal)
            else:
                signal.filter_passed['consistency'] = False
                signal.filter_reasons.append(
                    f"Consistency: Score {ticker_score}/10 "
                    f"(need {self.config.min_consistency_score}+)"
                )
        
        return filtered


@dataclass
class FilterStats:
    """Statistics for each filter stage."""
    total_input: int = 0
    after_quality: int = 0
    after_time_decay: int = 0
    after_premium: int = 0
    after_moneyness: int = 0
    after_consistency: int = 0
    final_output: int = 0
    
    def reset(self):
        """Reset all counters."""
        self.total_input = 0
        self.after_quality = 0
        self.after_time_decay = 0
        self.after_premium = 0
        self.after_moneyness = 0
        self.after_consistency = 0
        self.final_output = 0
    
    def get_reduction_summary(self) -> str:
        """Get human-readable summary of filtering."""
        lines = [
            f"Total Input: {self.total_input} signals",
            f"✅ Filter 1 (Quality): {self.after_quality} remaining",
            f"✅ Filter 2 (Time Decay): {self.after_time_decay} remaining",
            f"✅ Filter 3 (Premium): {self.after_premium} remaining",
            f"✅ Filter 4 (Moneyness): {self.after_moneyness} remaining",
            f"✅ Filter 5 (Consistency): {self.after_consistency} remaining",
            f"",
            f"Final Output: {self.final_output} actionable signals",
            f"Reduction: {self.total_input - self.final_output} filtered out "
            f"({((self.total_input - self.final_output) / self.total_input * 100):.1f}%)"
        ]
        return "\n".join(lines)

