"""
Entry Timing Strategies - When and How to Enter Trades

Provides 5 different entry strategies with specific execution criteria.
"""

from dataclasses import dataclass
from typing import Optional, Dict, List
from enum import Enum
from datetime import datetime, time

from ..models.signal import EnrichedSignal
from ..models.analysis import EntryStrategy, EntryRecommendation


class EntryStrategyType(Enum):
    """Types of entry strategies."""
    FIRST_HOUR_FADE = "first_hour_fade"
    CONFIRMATION_ENTRY = "confirmation_entry"
    SCALE_IN = "scale_in"
    SPREAD_ENTRY = "spread_entry"
    GAP_FILL = "gap_fill"
    IMMEDIATE = "immediate"


@dataclass
class EntryConfig:
    """Configuration for entry strategies."""
    
    # First Hour Fade
    fade_wait_minutes: int = 30
    fade_pullback_pct: float = 1.0  # Wait for 1% pullback
    
    # Confirmation Entry
    confirm_wait_days: int = 1
    confirm_breakout_pct: float = 1.5  # Need 1.5% breakout
    
    # Scale-In
    scale_first_pct: float = 33.3
    scale_second_pct: float = 33.3
    scale_third_pct: float = 33.4
    scale_wait_days: int = 2
    
    # Gap Fill
    gap_threshold_pct: float = 2.0  # Min gap to wait for fill
    gap_fill_pct: float = 50.0  # Wait for 50% retracement


class EntryStrategySelector:
    """
    Selects optimal entry strategy based on signal characteristics.
    
    Strategies:
    1. First Hour Fade - Day trading volatile stocks
    2. Confirmation Entry - Swing trades waiting for breakout
    3. Scale-In - Large positions or uncertain entries
    4. Spread Entry - Reduce cost on expensive options
    5. Gap-Fill - Wait for pullback after gaps
    6. Immediate - High conviction, time-sensitive
    """
    
    def __init__(self, config: Optional[EntryConfig] = None):
        self.config = config or EntryConfig()
    
    def recommend_entry_strategy(
        self, 
        signal: EnrichedSignal,
        market_data: Optional[Dict] = None
    ) -> EntryRecommendation:
        """
        Recommend best entry strategy for this signal.
        
        Decision logic:
        - High volatility + day trade → First Hour Fade
        - Swing trade + near resistance → Confirmation Entry
        - Large position or uncertain → Scale-In
        - Expensive premium → Spread Entry
        - Overnight gap → Gap-Fill Entry
        - S-grade + catalyst → Immediate
        """
        
        # Analyze signal characteristics
        is_day_trade = signal.days_to_expiry < 14
        is_high_vol = (
            hasattr(signal, 'implied_volatility') and 
            signal.implied_volatility > 0.8
        )
        is_expensive = (
            hasattr(signal, 'estimated_premium') and
            signal.estimated_premium > 500
        )
        is_s_grade = signal.grade == 'S'
        has_catalyst = (
            hasattr(signal, 'days_to_earnings') and
            signal.days_to_earnings and
            0 < signal.days_to_earnings < 14
        )
        
        has_gap = False
        gap_pct = 0.0
        if market_data and 'gap' in market_data:
            gap_pct = market_data['gap'].get('gap_pct', 0)
            has_gap = abs(gap_pct) >= self.config.gap_threshold_pct
        
        # Decision tree
        if is_s_grade and has_catalyst:
            strategy_type = EntryStrategyType.IMMEDIATE
            primary = self._create_immediate_strategy(signal)
        elif has_gap:
            strategy_type = EntryStrategyType.GAP_FILL
            primary = self._create_gap_fill_strategy(signal, gap_pct)
        elif is_expensive:
            strategy_type = EntryStrategyType.SPREAD_ENTRY
            primary = self._create_spread_entry_strategy(signal)
        elif is_day_trade and is_high_vol:
            strategy_type = EntryStrategyType.FIRST_HOUR_FADE
            primary = self._create_first_hour_fade_strategy(signal)
        elif not is_day_trade:
            strategy_type = EntryStrategyType.CONFIRMATION_ENTRY
            primary = self._create_confirmation_entry_strategy(signal)
        else:
            strategy_type = EntryStrategyType.SCALE_IN
            primary = self._create_scale_in_strategy(signal)
        
        # Generate alternatives
        alternatives = self._generate_alternatives(
            signal, 
            primary_type=strategy_type
        )
        
        return EntryRecommendation(
            signal_id=signal.signal_id,
            ticker=signal.ticker,
            primary_strategy=primary,
            alternative_strategies=alternatives,
            recommendation_reason=self._get_recommendation_reason(
                strategy_type, 
                signal
            )
        )
    
    def _create_immediate_strategy(
        self, 
        signal: EnrichedSignal
    ) -> EntryStrategy:
        """Immediate entry - enter right now."""
        return EntryStrategy(
            type=EntryStrategyType.IMMEDIATE,
            name="Immediate Entry",
            description="Enter immediately at market",
            timing="Now - don't wait",
            position_allocation=100.0,
            execution_steps=[
                "1. Enter full position at market",
                "2. Set stop loss immediately",
                "3. Set profit targets",
            ],
            pros=[
                "Capture time-sensitive catalyst",
                "High conviction signal",
                "No risk of missing entry"
            ],
            cons=[
                "May pay inflated premium at open",
                "No room for better pricing",
                "All-or-nothing risk"
            ],
            best_for="S-grade signals with near-term catalysts",
            risk_level="MEDIUM-HIGH"
        )
    
    def _create_first_hour_fade_strategy(
        self, 
        signal: EnrichedSignal
    ) -> EntryStrategy:
        """First hour fade - wait for pullback after open."""
        return EntryStrategy(
            type=EntryStrategyType.FIRST_HOUR_FADE,
            name="First Hour Fade",
            description="Wait for first 30-60min pullback, then enter",
            timing=f"Wait {self.config.fade_wait_minutes} min after open, "
                   f"enter on {self.config.fade_pullback_pct}% pullback",
            position_allocation=100.0,
            execution_steps=[
                "1. Watch price action first 30 minutes",
                f"2. Identify high/low range",
                f"3. Enter when price pulls back {self.config.fade_pullback_pct}%",
                "4. If no pullback by 10:30am, reassess"
            ],
            pros=[
                "Better pricing than market open",
                "Avoid inflated IV at open",
                "Clear risk/reward setup"
            ],
            cons=[
                "May miss strong trending moves",
                "Requires active monitoring",
                "Not suitable for swing trades"
            ],
            best_for="Day trades, volatile stocks, high IV",
            risk_level="MEDIUM",
            target_entry_price_vs_current=f"-{self.config.fade_pullback_pct}% "
                                          f"from open high"
        )
    
    def _create_confirmation_entry_strategy(
        self, 
        signal: EnrichedSignal
    ) -> EntryStrategy:
        """Confirmation entry - wait for breakout confirmation."""
        
        # Calculate breakout level (simplified)
        current = signal.underlying_price
        breakout_level = current * (
            1 + self.config.confirm_breakout_pct / 100
        )
        if signal.option_type == 'put':
            breakout_level = current * (
                1 - self.config.confirm_breakout_pct / 100
            )
        
        return EntryStrategy(
            type=EntryStrategyType.CONFIRMATION_ENTRY,
            name="Confirmation Entry",
            description="Wait for price to confirm direction before entering",
            timing=f"Wait {self.config.confirm_wait_days} day(s) for "
                   f"{self.config.confirm_breakout_pct}% move",
            position_allocation=100.0,
            execution_steps=[
                "1. Identify key resistance/support level",
                f"2. Wait for price to break level "
                f"({self.config.confirm_breakout_pct}%)",
                "3. Enter after breakout is confirmed",
                "4. Use breakout level as stop loss reference"
            ],
            pros=[
                "Confirms institutions were right",
                "Reduces false signals",
                "Better risk/reward with confirmation"
            ],
            cons=[
                "May enter at worse price",
                "Could miss fast moves",
                "Requires patience"
            ],
            best_for="Swing trades, uncertain entries, near resistance",
            risk_level="LOW-MEDIUM",
            target_entry_price_vs_current=f"After {breakout_level:.2f} "
                                          f"breakout"
        )
    
    def _create_scale_in_strategy(
        self, 
        signal: EnrichedSignal
    ) -> EntryStrategy:
        """Scale-in - pyramid into position over time."""
        return EntryStrategy(
            type=EntryStrategyType.SCALE_IN,
            name="Scale-In Approach",
            description="Build position gradually as thesis confirms",
            timing="Initial entry now, add on confirmation",
            position_allocation=100.0,
            execution_steps=[
                f"1. Enter {self.config.scale_first_pct:.0f}% position now",
                f"2. Add {self.config.scale_second_pct:.0f}% if profitable "
                f"after {self.config.scale_wait_days} days",
                f"3. Add final {self.config.scale_third_pct:.0f}% if "
                f"hitting targets",
                "4. Set stops on each tranche independently"
            ],
            pros=[
                "Reduces timing risk",
                "Pyramid winners (add to winning positions)",
                "Lower average cost if patient"
            ],
            cons=[
                "Complexity in management",
                "May never get full position",
                "Requires discipline"
            ],
            best_for="Large positions, uncertain timing, learning",
            risk_level="LOW",
            target_entry_price_vs_current="Average into position",
            scale_allocation=[
                self.config.scale_first_pct,
                self.config.scale_second_pct,
                self.config.scale_third_pct
            ]
        )
    
    def _create_spread_entry_strategy(
        self, 
        signal: EnrichedSignal
    ) -> EntryStrategy:
        """Spread entry - use spread instead of naked option."""
        return EntryStrategy(
            type=EntryStrategyType.SPREAD_ENTRY,
            name="Spread Entry (Cost Reduction)",
            description="Use vertical spread to reduce capital requirement",
            timing="Enter when IV settles (avoid open)",
            position_allocation=100.0,
            execution_steps=[
                "1. Wait 15-30 min after open for IV to settle",
                "2. Buy ATM or ITM strike (long leg)",
                "3. Sell 5-10% OTM strike (short leg)",
                "4. Aim for 2:1 or better risk/reward"
            ],
            pros=[
                "Much cheaper than naked option",
                "Defined risk",
                "Can afford more contracts",
                "Lower breakeven"
            ],
            cons=[
                "Capped upside",
                "Two-leg execution risk",
                "Less leverage than naked"
            ],
            best_for="Expensive premiums (>$500), limited capital",
            risk_level="LOW",
            target_entry_price_vs_current="50-70% cheaper than naked option"
        )
    
    def _create_gap_fill_strategy(
        self, 
        signal: EnrichedSignal,
        gap_pct: float
    ) -> EntryStrategy:
        """Gap-fill entry - wait for gap to partially fill."""
        
        current = signal.underlying_price
        fill_target = current * (
            1 - (gap_pct * self.config.gap_fill_pct / 100) / 100
        )
        
        return EntryStrategy(
            type=EntryStrategyType.GAP_FILL,
            name="Gap-Fill Entry",
            description="Wait for overnight gap to partially retrace",
            timing=f"Wait for {self.config.gap_fill_pct}% gap fill",
            position_allocation=100.0,
            execution_steps=[
                f"1. Stock gapped {gap_pct:+.1f}% overnight",
                f"2. Wait for {self.config.gap_fill_pct}% retracement "
                f"to ${fill_target:.2f}",
                "3. Enter when retracement completes",
                "4. If no fill by 2pm, reassess or enter at market"
            ],
            pros=[
                "Better entry price",
                "Lower option premium cost",
                "Defined entry level"
            ],
            cons=[
                "May never get fill",
                "Could miss if gap extends",
                "Requires watching"
            ],
            best_for="Stocks with overnight gaps >2%",
            risk_level="MEDIUM",
            target_entry_price_vs_current=f"At ${fill_target:.2f} "
                                          f"({self.config.gap_fill_pct}% fill)"
        )
    
    def _generate_alternatives(
        self, 
        signal: EnrichedSignal,
        primary_type: EntryStrategyType
    ) -> List[EntryStrategy]:
        """Generate 1-2 alternative entry strategies."""
        
        alternatives = []
        
        # Always offer immediate as alternative for urgent plays
        if primary_type != EntryStrategyType.IMMEDIATE:
            alternatives.append(self._create_immediate_strategy(signal))
        
        # Offer scale-in for risk-averse
        if primary_type not in [
            EntryStrategyType.SCALE_IN, 
            EntryStrategyType.IMMEDIATE
        ]:
            alternatives.append(self._create_scale_in_strategy(signal))
        
        return alternatives[:2]  # Max 2 alternatives
    
    def _get_recommendation_reason(
        self, 
        strategy_type: EntryStrategyType,
        signal: EnrichedSignal
    ) -> str:
        """Explain why this strategy was recommended."""
        
        reasons = {
            EntryStrategyType.IMMEDIATE: (
                f"S-grade signal with near-term catalyst warrants "
                f"immediate entry to capture time-sensitive opportunity."
            ),
            EntryStrategyType.FIRST_HOUR_FADE: (
                f"High volatility and short-dated expiration suggest "
                f"waiting for intraday pullback to avoid inflated pricing."
            ),
            EntryStrategyType.CONFIRMATION_ENTRY: (
                f"Swing trade setup benefits from waiting for technical "
                f"confirmation to reduce false signal risk."
            ),
            EntryStrategyType.SCALE_IN: (
                f"Gradual entry reduces timing risk and allows for "
                f"position building as thesis confirms."
            ),
            EntryStrategyType.SPREAD_ENTRY: (
                f"Expensive premium justifies using vertical spread "
                f"to reduce capital requirement while maintaining exposure."
            ),
            EntryStrategyType.GAP_FILL: (
                f"Overnight gap creates opportunity to enter at better "
                f"price by waiting for partial retracement."
            )
        }
        
        return reasons.get(
            strategy_type, 
            "Selected based on signal characteristics and market conditions."
        )


def get_current_trading_window() -> Dict[str, any]:
    """
    Get current trading window status.
    
    Returns dict with:
    - is_market_open: bool
    - is_first_hour: bool
    - is_power_hour: bool
    - minutes_since_open: int
    """
    
    now = datetime.now().time()
    market_open = time(9, 30)
    market_close = time(16, 0)
    first_hour_end = time(10, 30)
    power_hour_start = time(15, 0)
    
    is_open = market_open <= now <= market_close
    
    if not is_open:
        return {
            'is_market_open': False,
            'is_first_hour': False,
            'is_power_hour': False,
            'minutes_since_open': None
        }
    
    # Calculate minutes since open
    now_minutes = now.hour * 60 + now.minute
    open_minutes = market_open.hour * 60 + market_open.minute
    minutes_since = now_minutes - open_minutes
    
    return {
        'is_market_open': True,
        'is_first_hour': now <= first_hour_end,
        'is_power_hour': now >= power_hour_start,
        'minutes_since_open': minutes_since
    }

