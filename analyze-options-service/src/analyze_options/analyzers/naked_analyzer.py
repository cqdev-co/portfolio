"""Naked option strategy analyzer."""

from typing import Optional, Tuple
from loguru import logger
import numpy as np
from scipy.stats import norm

from ..models.signal import EnrichedSignal, Sentiment
from ..models.analysis import TechnicalIndicators
from ..models.strategy import NakedOptionAnalysis, StrategyType
from ..data.market_data import get_option_chain


class NakedOptionAnalyzer:
    """Analyzes naked (single-leg) option strategies."""
    
    def __init__(self, account_size: float = 10000, risk_per_trade_pct: float = 2.0):
        """
        Initialize the analyzer.
        
        Args:
            account_size: Total account size in dollars
            risk_per_trade_pct: Percentage of account to risk per trade
        """
        self.account_size = account_size
        self.risk_per_trade_pct = risk_per_trade_pct
        self.max_risk_per_trade = account_size * (risk_per_trade_pct / 100)
    
    def analyze(
        self,
        signal: EnrichedSignal,
        technical: TechnicalIndicators
    ) -> Optional[NakedOptionAnalysis]:
        """
        Analyze naked option strategy for a signal.
        
        Args:
            signal: The enriched signal
            technical: Technical analysis indicators
            
        Returns:
            NakedOptionAnalysis or None if not suitable
        """
        try:
            # Determine strategy type
            if signal.option_type == 'call':
                strategy_type = StrategyType.NAKED_CALL
            else:
                strategy_type = StrategyType.NAKED_PUT
            
            # Get option chain
            chain = get_option_chain(signal.ticker, signal.expiry)
            if not chain:
                logger.warning(f"No option chain for {signal.ticker}")
                return None
            
            # Select appropriate chain
            # yfinance returns a named tuple with .calls and .puts attributes
            options_chain = chain.calls if signal.option_type == 'call' else chain.puts
            if options_chain.empty:
                logger.warning(f"Empty {signal.option_type} chain for {signal.ticker}")
                return None
            
            # Find the option in the chain
            strike = signal.strike
            option = options_chain[options_chain['strike'] == strike]
            
            if option.empty:
                logger.warning(f"Strike {strike} not found in chain")
                return None
            
            # Get premium and other data
            premium = float(option['lastPrice'].iloc[0])
            
            # Calculate intrinsic and extrinsic value
            if signal.option_type == 'call':
                intrinsic_value = max(0, technical.price - strike)
            else:
                intrinsic_value = max(0, strike - technical.price)
            
            extrinsic_value = premium - intrinsic_value
            
            # Max loss is the premium paid (100%)
            max_loss = premium
            
            # For conservative R:R estimate, assume 2x-3x return as target
            # (In reality, can be unlimited for calls, but we need something for comparison)
            conservative_target = premium * 2.5
            potential_profit = conservative_target
            risk_reward_ratio = potential_profit / max_loss if max_loss > 0 else 0
            
            # Calculate breakeven
            if signal.option_type == 'call':
                breakeven_price = strike + premium
            else:
                breakeven_price = strike - premium
            
            breakeven_pct = ((breakeven_price - technical.price) / technical.price) * 100
            
            # Estimate probability of profit
            probability_profit = self._estimate_probability(
                current_price=technical.price,
                breakeven=breakeven_price,
                days_to_expiry=signal.days_to_expiry,
                implied_vol=signal.current_iv
            )
            
            # Create analysis
            analysis = NakedOptionAnalysis(
                strategy_type=strategy_type,
                strike=strike,
                expiry=str(signal.expiry),
                days_to_expiry=signal.days_to_expiry,
                premium=premium,
                current_price=technical.price,
                max_loss=max_loss,
                potential_profit=potential_profit,
                risk_reward_ratio=risk_reward_ratio,
                breakeven_price=breakeven_price,
                breakeven_pct=breakeven_pct,
                probability_profit=probability_profit,
                moneyness=signal.moneyness,
                intrinsic_value=intrinsic_value,
                extrinsic_value=extrinsic_value
            )
            
            # Try to get Greeks if available
            if 'delta' in option.columns:
                analysis.delta = float(option['delta'].iloc[0]) if not option['delta'].isna().iloc[0] else None
            if 'gamma' in option.columns:
                analysis.gamma = float(option['gamma'].iloc[0]) if not option['gamma'].isna().iloc[0] else None
            if 'theta' in option.columns:
                analysis.theta = float(option['theta'].iloc[0]) if not option['theta'].isna().iloc[0] else None
            if 'vega' in option.columns:
                analysis.vega = float(option['vega'].iloc[0]) if not option['vega'].isna().iloc[0] else None
            
            # Score the strategy
            analysis.score, analysis.score_breakdown = self._score_naked(
                analysis, signal, technical
            )
            
            # Add warnings
            analysis.warnings = self._generate_warnings(analysis, signal, technical)
            
            return analysis
            
        except Exception as e:
            logger.error(f"Error analyzing naked option for {signal.ticker}: {e}")
            return None
    
    def _estimate_probability(
        self,
        current_price: float,
        breakeven: float,
        days_to_expiry: int,
        implied_vol: float
    ) -> float:
        """
        Estimate probability of profit using Black-Scholes framework.
        """
        if days_to_expiry <= 0 or implied_vol <= 0:
            return 0.5  # 50% if can't calculate
        
        # Time in years
        time_to_expiry = days_to_expiry / 365.0
        
        # Standard deviation of returns
        std_dev = implied_vol * np.sqrt(time_to_expiry)
        
        if std_dev == 0:
            return 0.5
        
        # Z-score
        z_score = (np.log(breakeven / current_price)) / std_dev
        
        # Probability stock ends above breakeven
        probability = 1 - norm.cdf(z_score)
        
        return max(0.0, min(1.0, probability)) * 100
    
    def _score_naked(
        self,
        analysis: NakedOptionAnalysis,
        signal: EnrichedSignal,
        technical: TechnicalIndicators
    ) -> Tuple[float, dict]:
        """
        Score the naked option strategy (0-100).
        
        Factors:
        - Potential return (25%)
        - Signal quality (25%)
        - Probability of profit (20%)
        - Moneyness (15%)
        - Technical setup (10%)
        - Time value (5%)
        """
        scores = {}
        
        # 1. Potential Return (25 points)
        # Conservative R:R estimate
        rr = analysis.risk_reward_ratio or 0
        if rr >= 3.0:
            scores['potential_return'] = 25
        elif rr >= 2.5:
            scores['potential_return'] = 20
        elif rr >= 2.0:
            scores['potential_return'] = 15
        elif rr >= 1.5:
            scores['potential_return'] = 10
        else:
            scores['potential_return'] = 5
        
        # 2. Signal Quality (25 points)
        grade_scores = {'S': 25, 'A': 20, 'B': 15, 'C': 10}
        scores['signal_quality'] = grade_scores.get(signal.grade, 5)
        
        # Bonus for very high premium flow
        if signal.premium_flow > 2000000:  # $2M+
            scores['signal_quality'] = min(25, scores['signal_quality'] + 5)
        elif signal.premium_flow > 1000000:  # $1M+
            scores['signal_quality'] = min(25, scores['signal_quality'] + 3)
        
        # 3. Probability of Profit (20 points)
        prob = analysis.probability_profit or 0
        if prob >= 50:
            scores['probability'] = 20
        elif prob >= 40:
            scores['probability'] = 15
        elif prob >= 30:
            scores['probability'] = 10
        elif prob >= 20:
            scores['probability'] = 5
        else:
            scores['probability'] = 2
        
        # 4. Moneyness (15 points)
        # Slightly OTM or ATM is ideal
        moneyness_score = 0
        if analysis.moneyness == 'ATM':
            moneyness_score = 15
        elif analysis.moneyness == 'ITM':
            moneyness_score = 12
        elif analysis.moneyness == 'OTM':
            # Check how far OTM
            dist_pct = abs(analysis.distance_to_strike_pct or 0)
            if dist_pct < 5:  # Less than 5% OTM
                moneyness_score = 13
            elif dist_pct < 10:
                moneyness_score = 10
            else:
                moneyness_score = 5
        
        scores['moneyness'] = moneyness_score
        
        # 5. Technical Setup (10 points)
        tech_score = 0
        
        # Good RSI
        if 40 <= technical.rsi <= 60:
            tech_score += 3
        elif 35 <= technical.rsi <= 65:
            tech_score += 2
        
        # Strong momentum (important for naked options)
        if abs(technical.momentum_5d) > 5:
            tech_score += 4
        elif abs(technical.momentum_5d) > 3:
            tech_score += 2
        
        # Good volume
        if technical.volume_ratio > 1.0:
            tech_score += 3
        elif technical.volume_ratio > 0.7:
            tech_score += 1
        
        scores['technical_setup'] = min(10, tech_score)
        
        # 6. Time Value (5 points)
        # More time = less theta decay risk
        if signal.days_to_expiry > 30:
            scores['time_value'] = 5
        elif signal.days_to_expiry > 21:
            scores['time_value'] = 4
        elif signal.days_to_expiry > 14:
            scores['time_value'] = 3
        else:
            scores['time_value'] = 1
        
        # Calculate total
        total_score = sum(scores.values())
        
        return total_score, scores
    
    def _generate_warnings(
        self,
        analysis: NakedOptionAnalysis,
        signal: EnrichedSignal,
        technical: TechnicalIndicators
    ) -> list:
        """Generate warnings for the naked option strategy."""
        warnings = []
        
        # High cost
        if analysis.premium and analysis.premium > 10.0:
            warnings.append(f"💰 High premium cost (${analysis.premium * 100:.0f} per contract)")
        
        # Low probability
        if analysis.probability_profit and analysis.probability_profit < 35:
            warnings.append(f"⚠️ Low probability of profit ({analysis.probability_profit:.0f}%)")
        
        # Far OTM
        dist_pct = abs(analysis.distance_to_strike_pct or 0)
        if dist_pct > 15:
            warnings.append(f"⚠️ Strike far from current price ({dist_pct:.1f}%)")
        
        # Short time
        if signal.days_to_expiry < 14:
            warnings.append(f"⏰ Short time to expiry ({signal.days_to_expiry} days) - high theta decay")
        
        # High IV (expensive premium)
        if signal.current_iv and signal.current_iv > 0.8:  # 80% IV
            warnings.append(f"⚠️ High implied volatility ({signal.current_iv:.0%}) - expensive premium")
        
        # Mostly extrinsic value
        if analysis.extrinsic_value > analysis.premium * 0.8:
            warnings.append(f"⚠️ Mostly time value - will decay quickly")
        
        # 100% loss risk
        warnings.append(f"🚨 Risk: Can lose 100% of premium paid (${analysis.cost_per_contract:.0f})")
        
        return warnings

