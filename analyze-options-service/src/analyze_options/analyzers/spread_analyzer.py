"""Vertical spread strategy analyzer."""

from typing import Optional, Tuple
from loguru import logger
import numpy as np
from scipy.stats import norm

from ..models.signal import EnrichedSignal, Sentiment
from ..models.analysis import TechnicalIndicators
from ..models.strategy import VerticalSpreadAnalysis, StrategyType
from ..data.market_data import get_option_chain


class VerticalSpreadAnalyzer:
    """Analyzes vertical spread strategies for options signals."""
    
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
    ) -> Optional[VerticalSpreadAnalysis]:
        """
        Analyze vertical spread strategy for a signal.
        
        Args:
            signal: The enriched signal
            technical: Technical analysis indicators
            
        Returns:
            VerticalSpreadAnalysis or None if not suitable
        """
        try:
            # Determine strategy type based on option type and sentiment
            if signal.option_type == 'call':
                strategy_type = StrategyType.BULL_CALL_SPREAD
            else:
                strategy_type = StrategyType.BEAR_PUT_SPREAD
            
            # Get option chain
            chain = get_option_chain(signal.ticker, signal.expiry)
            if not chain:
                logger.warning(f"No option chain for {signal.ticker}")
                return None
            
            # Select appropriate chain (calls or puts)
            # yfinance returns a named tuple with .calls and .puts attributes
            options_chain = chain.calls if signal.option_type == 'call' else chain.puts
            if options_chain.empty:
                logger.warning(f"Empty {signal.option_type} chain for {signal.ticker}")
                return None
            
            # Find the signal's strike in the chain
            buy_strike = signal.strike
            buy_option = options_chain[options_chain['strike'] == buy_strike]
            
            if buy_option.empty:
                logger.warning(f"Strike {buy_strike} not found in chain")
                return None
            
            buy_premium = float(buy_option['lastPrice'].iloc[0])
            
            # Find suitable sell strike (sell OTM option to cap profit)
            sell_strike = self._find_sell_strike(
                options_chain,
                buy_strike,
                technical.price,
                signal.option_type
            )
            
            if not sell_strike:
                logger.warning(f"No suitable sell strike found")
                return None
            
            sell_option = options_chain[options_chain['strike'] == sell_strike]
            sell_premium = float(sell_option['lastPrice'].iloc[0])
            
            # Calculate spread metrics
            net_debit = buy_premium - sell_premium
            strike_width = abs(sell_strike - buy_strike)
            max_profit = strike_width - net_debit
            max_loss = net_debit
            
            # Calculate breakeven
            if signal.option_type == 'call':
                breakeven_price = buy_strike + net_debit
            else:
                breakeven_price = buy_strike - net_debit
            
            breakeven_pct = ((breakeven_price - technical.price) / technical.price) * 100
            
            # Estimate probability of profit using Black-Scholes approximation
            probability_profit = self._estimate_probability(
                current_price=technical.price,
                breakeven=breakeven_price,
                days_to_expiry=signal.days_to_expiry,
                implied_vol=signal.current_iv
            )
            
            # Calculate risk/reward ratio
            risk_reward_ratio = max_profit / max_loss if max_loss > 0 else 0
            
            # Create analysis
            analysis = VerticalSpreadAnalysis(
                strategy_type=strategy_type,
                buy_strike=buy_strike,
                sell_strike=sell_strike,
                expiry=str(signal.expiry),
                days_to_expiry=signal.days_to_expiry,
                buy_premium=buy_premium,
                sell_premium=sell_premium,
                net_debit=net_debit,
                max_profit=max_profit,
                max_loss=max_loss,
                risk_reward_ratio=risk_reward_ratio,
                breakeven_price=breakeven_price,
                breakeven_pct=breakeven_pct,
                probability_profit=probability_profit
            )
            
            # Score the strategy
            analysis.score, analysis.score_breakdown = self._score_spread(
                analysis, signal, technical
            )
            
            # Add warnings
            analysis.warnings = self._generate_warnings(analysis, signal, technical)
            
            return analysis
            
        except Exception as e:
            logger.error(f"Error analyzing spread for {signal.ticker}: {e}")
            return None
    
    def _find_sell_strike(
        self,
        chain,
        buy_strike: float,
        current_price: float,
        option_type: str
    ) -> Optional[float]:
        """
        Find suitable strike to sell for the spread.
        
        Target: $5-10 width for stocks under $100, $10-20 for higher prices
        """
        # Determine target width based on stock price
        if current_price < 50:
            target_width = 5
        elif current_price < 100:
            target_width = 7.5
        elif current_price < 200:
            target_width = 10
        else:
            target_width = 15
        
        # For calls: sell higher strike (OTM)
        # For puts: sell lower strike (OTM)
        if option_type == 'call':
            target_sell = buy_strike + target_width
            # Find closest available strike above buy_strike
            higher_strikes = chain[chain['strike'] > buy_strike]['strike'].values
        else:
            target_sell = buy_strike - target_width
            # Find closest available strike below buy_strike
            higher_strikes = chain[chain['strike'] < buy_strike]['strike'].values
        
        if len(higher_strikes) == 0:
            return None
        
        # Find strike closest to target
        closest_strike = min(higher_strikes, key=lambda x: abs(x - target_sell))
        return float(closest_strike)
    
    def _estimate_probability(
        self,
        current_price: float,
        breakeven: float,
        days_to_expiry: int,
        implied_vol: float
    ) -> float:
        """
        Estimate probability of profit using Black-Scholes framework.
        
        This is a simplified approximation.
        """
        if days_to_expiry <= 0 or implied_vol <= 0:
            return 0.5  # 50% if can't calculate
        
        # Time in years
        time_to_expiry = days_to_expiry / 365.0
        
        # Standard deviation of returns
        std_dev = implied_vol * np.sqrt(time_to_expiry)
        
        if std_dev == 0:
            return 0.5
        
        # Z-score: how many standard deviations away is breakeven?
        z_score = (np.log(breakeven / current_price)) / std_dev
        
        # Probability stock ends above breakeven (for calls)
        # For puts, we'd want below, but keeping simple for now
        probability = 1 - norm.cdf(z_score)
        
        # Convert to percentage
        return max(0.0, min(1.0, probability)) * 100
    
    def _score_spread(
        self,
        analysis: VerticalSpreadAnalysis,
        signal: EnrichedSignal,
        technical: TechnicalIndicators
    ) -> Tuple[float, dict]:
        """
        Score the vertical spread strategy (0-100).
        
        Factors:
        - Risk/reward ratio (25%)
        - Probability of profit (25%)
        - Signal quality (25%)
        - Cost efficiency (15%)
        - Technical setup (10%)
        """
        scores = {}
        
        # 1. Risk/Reward Ratio (25 points)
        # Target: 1:1.5 to 1:3 is good for spreads
        rr = analysis.risk_reward_ratio or 0
        if rr >= 2.0:
            scores['risk_reward'] = 25
        elif rr >= 1.5:
            scores['risk_reward'] = 20
        elif rr >= 1.0:
            scores['risk_reward'] = 15
        elif rr >= 0.75:
            scores['risk_reward'] = 10
        else:
            scores['risk_reward'] = 5
        
        # 2. Probability of Profit (25 points)
        prob = analysis.probability_profit or 0
        if prob >= 60:
            scores['probability'] = 25
        elif prob >= 50:
            scores['probability'] = 20
        elif prob >= 40:
            scores['probability'] = 15
        elif prob >= 30:
            scores['probability'] = 10
        else:
            scores['probability'] = 5
        
        # 3. Signal Quality (25 points)
        grade_scores = {'S': 25, 'A': 20, 'B': 15, 'C': 10}
        scores['signal_quality'] = grade_scores.get(signal.grade, 5)
        
        # Bonus for high premium flow
        if signal.premium_flow > 1000000:  # $1M+
            scores['signal_quality'] = min(25, scores['signal_quality'] + 3)
        
        # 4. Cost Efficiency (15 points)
        # Lower cost = better capital efficiency
        cost = analysis.net_debit or 0
        if cost < 1.0:  # Under $100 per contract
            scores['cost_efficiency'] = 15
        elif cost < 2.0:
            scores['cost_efficiency'] = 12
        elif cost < 3.0:
            scores['cost_efficiency'] = 9
        elif cost < 5.0:
            scores['cost_efficiency'] = 6
        else:
            scores['cost_efficiency'] = 3
        
        # 5. Technical Setup (10 points)
        tech_score = 0
        # Good RSI
        if 40 <= technical.rsi <= 60:
            tech_score += 3
        elif 35 <= technical.rsi <= 65:
            tech_score += 2
        
        # Good momentum
        if abs(technical.momentum_5d) > 3:
            tech_score += 3
        
        # Good volume
        if technical.volume_ratio > 0.8:
            tech_score += 4
        elif technical.volume_ratio > 0.6:
            tech_score += 2
        
        scores['technical_setup'] = tech_score
        
        # Calculate total
        total_score = sum(scores.values())
        
        return total_score, scores
    
    def _generate_warnings(
        self,
        analysis: VerticalSpreadAnalysis,
        signal: EnrichedSignal,
        technical: TechnicalIndicators
    ) -> list:
        """Generate warnings for the spread strategy."""
        warnings = []
        
        # Low probability of profit
        if analysis.probability_profit and analysis.probability_profit < 40:
            warnings.append(f"⚠️ Low probability of profit ({analysis.probability_profit:.0f}%)")
        
        # Poor risk/reward
        if analysis.risk_reward_ratio and analysis.risk_reward_ratio < 1.0:
            warnings.append(f"⚠️ Risk/reward below 1:1 ({analysis.risk_reward_ratio:.2f})")
        
        # High cost
        if analysis.net_debit and analysis.net_debit > 5.0:
            warnings.append(f"⚠️ High cost per spread (${analysis.net_debit * 100:.0f})")
        
        # Short time to expiry
        if signal.days_to_expiry < 14:
            warnings.append(f"⚠️ Short time to expiry ({signal.days_to_expiry} days)")
        
        # Far breakeven
        if analysis.breakeven_pct and abs(analysis.breakeven_pct) > 10:
            warnings.append(f"⚠️ Breakeven far from current price ({abs(analysis.breakeven_pct):.1f}%)")
        
        return warnings

