"""Script to recalculate performance with proper stop loss checking."""

import asyncio
import os
from datetime import date
from supabase import create_client
from dotenv import load_dotenv
from loguru import logger

# Load environment variables
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Error: Supabase credentials not found in environment variables")
    exit(1)


async def recalculate_with_stop_losses():
    """Recalculate all closed trades checking if stop losses were hit."""
    
    print("Initializing services...")
    
    # Import services
    from penny_scanner.config.settings import get_settings
    from penny_scanner.services.database_service import DatabaseService
    from penny_scanner.services.data_service import DataService
    from penny_scanner.services.stop_loss_checker import StopLossChecker
    
    settings = get_settings()
    database_service = DatabaseService(settings)
    data_service = DataService(settings)
    stop_checker = StopLossChecker(database_service, data_service)
    
    client = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    # Get all closed trades
    print("Fetching closed trades...")
    response = client.table('penny_signal_performance').select('*').eq('status', 'CLOSED').execute()
    
    trades = response.data
    print(f"Found {len(trades)} closed trades to recalculate")
    
    recalculated = 0
    stop_losses_hit = 0
    
    for i, trade in enumerate(trades, 1):
        symbol = trade['symbol']
        entry_price = float(trade['entry_price'])
        entry_date = date.fromisoformat(trade['entry_date'])
        exit_date = date.fromisoformat(trade['exit_date'])
        stop_loss_price = trade.get('stop_loss_price')
        original_exit = float(trade['exit_price'])
        
        print(f"\n[{i}/{len(trades)}] {symbol}: Entry ${entry_price:.2f}, Original Exit ${original_exit:.2f}")
        
        if not stop_loss_price:
            print(f"  ⚠️  No stop loss set, skipping")
            continue
        
        try:
            # Check if stop loss was hit
            result = await stop_checker.check_stop_loss_hit(
                symbol,
                entry_date,
                exit_date,
                entry_price,
                stop_loss_price
            )
            
            if result['stop_hit']:
                new_exit_price = result['exit_price']
                new_exit_date = result['exit_date']
                
                # Recalculate metrics
                days_held = (new_exit_date - entry_date).days
                return_pct = (new_exit_price - entry_price) / entry_price * 100
                is_winner = new_exit_price > entry_price
                
                print(f"  🛑 STOP HIT! New exit: ${new_exit_price:.2f} on {new_exit_date}")
                print(f"     Old return: {trade['return_pct']:.2f}% → New return: {return_pct:.2f}%")
                
                # Update the record
                update_data = {
                    'exit_price': new_exit_price,
                    'exit_date': new_exit_date.isoformat(),
                    'exit_reason': 'STOP_LOSS',
                    'return_pct': round(return_pct, 4),
                    'days_held': days_held,
                    'is_winner': is_winner
                }
                
                client.table('penny_signal_performance').update(update_data).eq('id', trade['id']).execute()
                
                stop_losses_hit += 1
                recalculated += 1
            else:
                print(f"  ✅ Stop not hit, exit at market was correct")
                
        except Exception as e:
            print(f"  ❌ Error: {e}")
            continue
    
    print(f"\n{'='*80}")
    print(f"Recalculation complete!")
    print(f"Total trades: {len(trades)}")
    print(f"Stop losses hit: {stop_losses_hit}")
    print(f"Records updated: {recalculated}")
    print(f"{'='*80}")


if __name__ == "__main__":
    asyncio.run(recalculate_with_stop_losses())
