import asyncio
import os
from supabase import create_client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Error: Supabase credentials not found in environment variables")
    exit(1)

async def cleanup_ncf_to():
    print("Connecting to Supabase...")
    client = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    symbol = "NCF.TO"
    
    print(f"Cleaning up data for {symbol}...")
    
    # 1. Delete from penny_signal_performance
    print("Deleting from penny_signal_performance...")
    response = client.table('penny_signal_performance').delete().eq('symbol', symbol).execute()
    print(f"Deleted {len(response.data)} records from performance tracking")
    
    # 2. Delete from penny_stock_signals
    print("Deleting from penny_stock_signals...")
    response = client.table('penny_stock_signals').delete().eq('symbol', symbol).execute()
    print(f"Deleted {len(response.data)} records from signals")
    
    # 3. Deactivate or delete from penny_tickers
    print("Deactivating in penny_tickers...")
    response = client.table('penny_tickers').update({'is_active': False}).eq('symbol', symbol).execute()
    print(f"Deactivated ticker: {len(response.data)} records updated")
    
    print("Cleanup complete!")

if __name__ == "__main__":
    asyncio.run(cleanup_ncf_to())
