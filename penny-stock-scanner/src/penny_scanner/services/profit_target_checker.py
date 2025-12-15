"""Service for checking if profit targets were hit during trade lifecycle."""

from datetime import date, timedelta
from typing import Optional, Dict, Any, List
from loguru import logger
from decimal import Decimal

from penny_scanner.services.database_service import DatabaseService


class ProfitTargetChecker:
    """Check historical price data to determine if profit targets were hit."""
    
    # Default profit target levels (percentage above entry)
    DEFAULT_TARGETS = {
        'target_1': 0.10,  # 10% - First target
        'target_2': 0.20,  # 20% - Second target  
        'target_3': 0.30,  # 30% - Third target (home run)
    }
    
    def __init__(self, database_service: DatabaseService, data_service: Any):
        """Initialize profit target checker."""
        self.database_service = database_service
        self.data_service = data_service
    
    async def check_profit_targets_hit(
        self,
        symbol: str,
        entry_date: date,
        exit_date: date,
        entry_price: float,
        targets: Dict[str, float] = None
    ) -> Dict[str, Any]:
        """
        Check if profit targets were hit during the trade period.
        
        Args:
            symbol: Stock symbol
            entry_date: Entry date
            exit_date: Exit date (or current date for active trades)
            entry_price: Entry price
            targets: Dictionary of target names to target prices
                     If None, uses default percentage-based targets
            
        Returns:
            Dictionary with:
            - targets_hit: List of target levels that were hit
            - max_price: Maximum price reached during holding period
            - max_gain_pct: Maximum gain percentage achieved
            - first_target_date: Date first target was hit (if any)
        """
        result = {
            'targets_hit': [],
            'max_price': entry_price,
            'max_gain_pct': 0.0,
            'first_target_date': None,
            'target_prices': {}
        }
        
        # Calculate target prices if not provided
        if targets is None:
            targets = {
                name: entry_price * (1 + pct) 
                for name, pct in self.DEFAULT_TARGETS.items()
            }
        
        result['target_prices'] = targets
        
        try:
            # Fetch historical price data for the period
            period_days = (exit_date - entry_date).days + 5  # Add buffer
            period_days = max(period_days, 10)  # Minimum 10 days
            
            # Get historical data
            market_data = await self.data_service.get_market_data(
                symbol,
                period=f"{period_days}d"
            )
            
            if not market_data or not market_data.ohlcv_data:
                logger.warning(f"No historical data for {symbol}")
                return result
            
            # Check each day's high price
            for candle in market_data.ohlcv_data:
                candle_date = candle.timestamp.date()
                
                # Only check dates within the trade period
                if candle_date < entry_date or candle_date > exit_date:
                    continue
                
                day_high = candle.high
                
                # Track maximum price
                if day_high > result['max_price']:
                    result['max_price'] = day_high
                    result['max_gain_pct'] = (day_high - entry_price) / entry_price * 100
                
                # Check each target
                for target_name, target_price in targets.items():
                    if target_name not in result['targets_hit']:
                        if day_high >= target_price:
                            result['targets_hit'].append(target_name)
                            
                            # Record first target hit date
                            if result['first_target_date'] is None:
                                result['first_target_date'] = candle_date
                            
                            logger.info(
                                f"{symbol}: {target_name} hit on {candle_date} "
                                f"(High: ${day_high:.2f}, Target: ${target_price:.2f})"
                            )
            
            return result
            
        except Exception as e:
            logger.error(f"Error checking profit targets for {symbol}: {e}")
            return result
    
    async def update_performance_with_targets(
        self,
        performance_record: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Update a performance record with profit target information.
        
        Args:
            performance_record: Existing performance record from database
            
        Returns:
            Updated performance data to write back
        """
        symbol = performance_record['symbol']
        entry_date = date.fromisoformat(performance_record['entry_date'])
        entry_price = float(performance_record['entry_price'])
        
        # Determine exit date
        if performance_record.get('exit_date'):
            exit_date = date.fromisoformat(performance_record['exit_date'])
        else:
            exit_date = date.today()
        
        # Check targets
        target_result = await self.check_profit_targets_hit(
            symbol,
            entry_date,
            exit_date,
            entry_price
        )
        
        # Prepare update data
        update_data = {
            'max_price_reached': target_result['max_price'],
            'max_gain_pct': target_result['max_gain_pct'],
            'targets_hit_count': len(target_result['targets_hit']),
        }
        
        # Set specific target flags
        update_data['hit_target_10pct'] = 'target_1' in target_result['targets_hit']
        update_data['hit_target_20pct'] = 'target_2' in target_result['targets_hit']
        update_data['hit_target_30pct'] = 'target_3' in target_result['targets_hit']
        
        if target_result['first_target_date']:
            update_data['first_target_hit_date'] = target_result['first_target_date'].isoformat()
        
        return update_data
    
    async def backfill_profit_targets(self) -> int:
        """
        Backfill profit target data for all historical performance records.
        
        Returns:
            Number of records updated
        """
        if not self.database_service.is_available():
            return 0
        
        try:
            # Get all closed performance records
            response = self.database_service.client.table('penny_signal_performance').select(
                '*'
            ).eq('status', 'CLOSED').execute()
            
            if not response.data:
                logger.info("No closed trades to backfill")
                return 0
            
            updated_count = 0
            
            for record in response.data:
                try:
                    update_data = await self.update_performance_with_targets(record)
                    
                    # Update the record
                    self.database_service.client.table('penny_signal_performance').update(
                        update_data
                    ).eq('id', record['id']).execute()
                    
                    updated_count += 1
                    
                except Exception as e:
                    logger.error(f"Error updating record {record['id']}: {e}")
            
            logger.info(f"Backfilled profit targets for {updated_count} records")
            return updated_count
            
        except Exception as e:
            logger.error(f"Error backfilling profit targets: {e}")
            return 0


class DynamicProfitTargetCalculator:
    """
    Calculate dynamic profit targets based on signal characteristics.
    
    Higher quality signals get more ambitious targets.
    """
    
    @staticmethod
    def calculate_targets(
        entry_price: float,
        opportunity_rank: str,
        volume_spike_factor: float,
        is_breakout: bool
    ) -> Dict[str, float]:
        """
        Calculate profit targets based on signal quality.
        
        Args:
            entry_price: Entry price
            opportunity_rank: S/A/B/C/D rank
            volume_spike_factor: Volume spike factor
            is_breakout: Whether it's a breakout signal
            
        Returns:
            Dictionary of target names to target prices
        """
        # Base targets by rank
        base_targets = {
            'S': {'t1': 0.15, 't2': 0.30, 't3': 0.50},  # 15%, 30%, 50%
            'A': {'t1': 0.12, 't2': 0.25, 't3': 0.40},  # 12%, 25%, 40%
            'B': {'t1': 0.10, 't2': 0.20, 't3': 0.30},  # 10%, 20%, 30%
            'C': {'t1': 0.08, 't2': 0.15, 't3': 0.25},  # 8%, 15%, 25%
            'D': {'t1': 0.05, 't2': 0.10, 't3': 0.15},  # 5%, 10%, 15%
        }
        
        targets = base_targets.get(opportunity_rank, base_targets['B'])
        
        # Adjust for volume spike (higher volume = potentially larger move)
        if volume_spike_factor >= 5.0:
            multiplier = 1.2  # 20% boost
        elif volume_spike_factor >= 3.0:
            multiplier = 1.1  # 10% boost
        else:
            multiplier = 1.0
        
        # Adjust for breakout (breakouts tend to run further)
        if is_breakout:
            multiplier *= 1.1
        
        # Calculate final target prices
        return {
            'target_1': entry_price * (1 + targets['t1'] * multiplier),
            'target_2': entry_price * (1 + targets['t2'] * multiplier),
            'target_3': entry_price * (1 + targets['t3'] * multiplier),
        }
