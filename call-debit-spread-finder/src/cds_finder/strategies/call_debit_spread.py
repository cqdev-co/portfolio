"""Call Debit Spread calculator."""

from typing import Optional, Tuple
from loguru import logger
import numpy as np
from scipy.stats import norm

from ..data.market_data import MarketDataProvider
from ..models.signal import Signal


class CallDebitSpreadCalculator:
    """Calculate optimal Call Debit Spread configuration."""
    
    def __init__(self, market_data_provider: MarketDataProvider):
        """Initialize calculator."""
        self.market_data = market_data_provider
    
    def calculate_spread(
        self,
        signal: Signal,
        target_rr: float = 2.0,
    ) -> Optional[dict]:
        """
        Calculate optimal Call Debit Spread for a signal.
        
        Args:
            signal: Signal to analyze
            target_rr: Target risk/reward ratio
            
        Returns:
            Dictionary with spread details or None
        """
        ticker = signal.ticker
        current_price = signal.underlying_price
        expiry = signal.expiry
        
        # Get option chain
        opt_chain = self.market_data.get_option_chain(
            ticker,
            expiry=str(expiry)
        )
        
        if not opt_chain:
            logger.warning(f"No option chain for {ticker} expiry {expiry}")
            return None
        
        calls = opt_chain.calls
        if calls.empty:
            logger.warning(f"Empty call chain for {ticker}")
            return None
        
        # Find optimal strikes
        long_strike, short_strike = self._find_optimal_strikes(
            calls=calls,
            current_price=current_price,
            signal_strike=signal.strike,
            target_rr=target_rr,
        )
        
        if not long_strike or not short_strike:
            logger.warning(f"Could not find suitable strikes for {ticker}")
            return None
        
        # Get premiums
        long_option = calls[calls["strike"] == long_strike]
        short_option = calls[calls["strike"] == short_strike]
        
        if long_option.empty or short_option.empty:
            logger.warning(f"Strikes not found in chain for {ticker}")
            return None
        
        long_premium = float(long_option["lastPrice"].iloc[0])
        short_premium = float(short_option["lastPrice"].iloc[0])
        
        # Calculate spread metrics
        net_debit = long_premium - short_premium
        strike_width = short_strike - long_strike
        max_profit = strike_width - net_debit
        max_loss = net_debit
        risk_reward_ratio = max_profit / max_loss if max_loss > 0 else 0
        
        # Breakeven
        breakeven_price = long_strike + net_debit
        breakeven_pct = ((breakeven_price - current_price) / current_price) * 100
        
        # Probability of profit
        probability_profit = self._estimate_probability(
            current_price=current_price,
            breakeven=breakeven_price,
            days_to_expiry=signal.days_to_expiry,
            implied_vol=signal.implied_volatility or 0.3,
        )
        
        # Greeks (simplified - would need actual option pricing for accurate)
        delta = self._estimate_delta(
            current_price=current_price,
            strike=long_strike,
            days_to_expiry=signal.days_to_expiry,
            iv=signal.implied_volatility or 0.3,
        )
        
        return {
            "long_strike": long_strike,
            "short_strike": short_strike,
            "strike_width": strike_width,
            "long_premium": long_premium,
            "short_premium": short_premium,
            "net_debit": net_debit,
            "max_profit": max_profit,
            "max_loss": max_loss,
            "risk_reward_ratio": risk_reward_ratio,
            "breakeven_price": breakeven_price,
            "breakeven_pct": breakeven_pct,
            "probability_of_profit": probability_profit,
            "delta": delta,
        }
    
    def _find_optimal_strikes(
        self,
        calls,
        current_price: float,
        signal_strike: float,
        target_rr: float,
    ) -> Tuple[Optional[float], Optional[float]]:
        """
        Find optimal long and short strikes targeting realistic R:R (1.5:1 to 3:1).
        
        Strategy:
        - Long strike: ATM or slightly OTM (5-10% above current)
        - Short strike: Selected to achieve target R:R ratio
        - Validate: Net debit should be 20-50% of strike width
        """
        # Long strike: Use signal strike if reasonable, otherwise ATM or slightly OTM
        if signal_strike >= current_price * 0.95 and signal_strike <= current_price * 1.10:
            long_strike = signal_strike
        else:
            # Find ATM or slightly OTM strike
            atm_strikes = calls[
                (calls["strike"] >= current_price * 0.98) &
                (calls["strike"] <= current_price * 1.05)
            ]
            if not atm_strikes.empty:
                long_strike = float(atm_strikes.iloc[0]["strike"])
            else:
                # Fallback: closest strike to current price
                long_strike = float(
                    calls.iloc[(calls["strike"] - current_price).abs().argsort()[:1]]["strike"].iloc[0]
                )
        
        # Get long strike premium
        long_option = calls[calls["strike"] == long_strike]
        if long_option.empty:
            return None, None
        
        long_premium = float(long_option["lastPrice"].iloc[0])
        
        # Find short strike that achieves target R:R
        # Target R:R = (strike_width - net_debit) / net_debit
        # Solving: net_debit = strike_width / (target_rr + 1)
        # So: short_premium = long_premium - (strike_width / (target_rr + 1))
        
        # Try different strike widths to find realistic R:R
        short_strikes = calls[calls["strike"] > long_strike].sort_values("strike")
        
        if short_strikes.empty:
            return None, None
        
        best_short = None
        best_rr = 0
        best_width = 0
        
        # Try strike widths from $2.50 to $20 (in $2.50 increments)
        for width_multiplier in range(1, 9):  # 2.5, 5, 7.5, 10, 12.5, 15, 17.5, 20
            target_width = width_multiplier * 2.5
            
            # Find closest strike to target width
            target_short = long_strike + target_width
            closest_short_strikes = short_strikes[
                (short_strikes["strike"] - target_short).abs() <= 2.5
            ]
            
            if closest_short_strikes.empty:
                continue
            
            # Try each candidate short strike
            for _, short_row in closest_short_strikes.iterrows():
                short_strike = float(short_row["strike"])
                short_premium = float(short_row["lastPrice"])
                
                net_debit = long_premium - short_premium
                actual_width = short_strike - long_strike
                
                # Validate net debit is positive and reasonable
                if net_debit <= 0 or net_debit > actual_width * 0.6:
                    continue
                
                max_profit = actual_width - net_debit
                if max_profit <= 0:
                    continue
                
                rr = max_profit / net_debit if net_debit > 0 else 0
                
                # Target R:R between 1.5:1 and 3:1
                if 1.5 <= rr <= 3.0:
                    # Prefer strikes closer to target R:R
                    if abs(rr - target_rr) < abs(best_rr - target_rr) or best_rr == 0:
                        best_short = short_strike
                        best_rr = rr
                        best_width = actual_width
        
        # If no ideal R:R found, find best available
        if best_short is None:
            # Fallback: find strike with best R:R in acceptable range
            for _, short_row in short_strikes.iterrows():
                short_strike = float(short_row["strike"])
                short_premium = float(short_row["lastPrice"])
                
                net_debit = long_premium - short_premium
                actual_width = short_strike - long_strike
                
                if net_debit <= 0 or net_debit > actual_width * 0.6:
                    continue
                
                max_profit = actual_width - net_debit
                if max_profit <= 0:
                    continue
                
                rr = max_profit / net_debit if net_debit > 0 else 0
                
                # Accept R:R up to 3.5:1 (slightly above ideal)
                if 1.0 <= rr <= 3.5:
                    if rr > best_rr:
                        best_short = short_strike
                        best_rr = rr
                        best_width = actual_width
        
        if best_short is None:
            return None, None
        
        return long_strike, best_short
    
    def _estimate_probability(
        self,
        current_price: float,
        breakeven: float,
        days_to_expiry: int,
        implied_vol: float,
    ) -> float:
        """
        Estimate probability of profit using Black-Scholes framework.
        
        Args:
            current_price: Current stock price
            breakeven: Breakeven price
            days_to_expiry: Days to expiration
            implied_vol: Implied volatility
            
        Returns:
            Probability as percentage (0-100)
        """
        if days_to_expiry <= 0 or implied_vol <= 0:
            return 50.0
        
        # Time in years
        time_to_expiry = days_to_expiry / 365.0
        
        # Standard deviation of returns
        std_dev = implied_vol * np.sqrt(time_to_expiry)
        
        if std_dev == 0:
            return 50.0
        
        # Z-score: how many standard deviations away is breakeven?
        z_score = (np.log(breakeven / current_price)) / std_dev
        
        # Probability stock ends above breakeven (for calls)
        probability = 1 - norm.cdf(z_score)
        
        # Convert to percentage
        return max(0.0, min(100.0, probability * 100))
    
    def _estimate_delta(
        self,
        current_price: float,
        strike: float,
        days_to_expiry: int,
        iv: float,
    ) -> float:
        """
        Estimate delta for a call option.
        
        Simplified approximation - for accurate delta, use Black-Scholes.
        """
        if days_to_expiry <= 0:
            return 0.5
        
        # Moneyness
        moneyness = current_price / strike
        
        # Time decay factor
        time_factor = max(0.1, days_to_expiry / 365.0)
        
        # Rough delta approximation
        if moneyness > 1.05:  # ITM
            delta = 0.6 + (moneyness - 1.05) * 0.4
        elif moneyness > 0.95:  # Near ATM
            delta = 0.4 + (moneyness - 0.95) * 2.0
        else:  # OTM
            delta = max(0.1, (moneyness - 0.85) * 2.0)
        
        # Adjust for time decay
        delta = delta * (1 - 0.1 * (1 - time_factor))
        
        return max(0.1, min(0.9, delta))

