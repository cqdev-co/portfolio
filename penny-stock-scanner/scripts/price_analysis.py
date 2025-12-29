"""Detailed price range analysis and user trade verification."""

from supabase import create_client
import os
from dotenv import load_dotenv

load_dotenv()
client = create_client(
    os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL"),
    os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY")
)

perf = client.table("penny_signal_performance").select("*").execute().data
closed = [p for p in perf if p.get("status") == "CLOSED"]

# More granular price buckets
price_buckets = {
    "0.10-0.50": {"range": (0.10, 0.50), "trades": []},
    "0.50-1.00": {"range": (0.50, 1.00), "trades": []},
    "1.00-1.50": {"range": (1.00, 1.50), "trades": []},
    "1.50-2.00": {"range": (1.50, 2.00), "trades": []},
    "2.00-2.50": {"range": (2.00, 2.50), "trades": []},
    "2.50-3.00": {"range": (2.50, 3.00), "trades": []},
    "3.00-4.00": {"range": (3.00, 4.00), "trades": []},
    "4.00-5.00": {"range": (4.00, 5.00), "trades": []},
}

for p in closed:
    price = p.get("entry_price", 0)
    for bucket, data in price_buckets.items():
        low, high = data["range"]
        if low <= price < high:
            data["trades"].append(p)
            break

print("=== DETAILED PRICE RANGE ANALYSIS ===")
print(f"{'Price Range':<12} | {'Trades':>6} | {'Win Rate':>8} | {'Avg Return':>10} | Top Winners")
print("-" * 80)

for bucket in ["0.10-0.50", "0.50-1.00", "1.00-1.50", "1.50-2.00", "2.00-2.50", "2.50-3.00", "3.00-4.00", "4.00-5.00"]:
    trades = price_buckets[bucket]["trades"]
    if not trades:
        continue
    wins = sum(1 for t in trades if t.get("is_winner"))
    returns = [t.get("return_pct", 0) for t in trades if t.get("return_pct") is not None]
    wr = wins / len(trades) * 100 if trades else 0
    avg = sum(returns) / len(returns) if returns else 0
    
    # Top winners in this range
    top = sorted(trades, key=lambda x: x.get("return_pct", 0) or 0, reverse=True)[:2]
    top_str = ", ".join([f"{t['symbol']} +{t.get('return_pct',0):.0f}%" for t in top if (t.get("return_pct") or 0) > 0])
    
    print(f"{bucket:<12} | {len(trades):>6} | {wr:>7.1f}% | {avg:>+9.2f}% | {top_str}")

# Also show the user's trades
print("\n=== YOUR TRADES THIS WEEK ===")
your_trades = ["UGRO", "LAZR", "NXXT"]
for symbol in your_trades:
    trades = [p for p in perf if p["symbol"] == symbol]
    if trades:
        for t in trades:
            ret = t.get("return_pct")
            ret_str = f"{ret:.1f}%" if ret is not None else "N/A"
            print(f"  {symbol}: Entry ${t.get('entry_price',0):.2f}, Status: {t.get('status')}, Return: {ret_str}")
    else:
        print(f"  {symbol}: Not in performance tracking")

# Check if LAZR and NXXT were detected by scanner
signals = client.table("penny_stock_signals").select("*").execute().data
print("\n=== WERE YOUR TRADES DETECTED BY SCANNER? ===")
for symbol in your_trades:
    sym_signals = [s for s in signals if s["symbol"] == symbol]
    if sym_signals:
        latest = max(sym_signals, key=lambda x: x["scan_date"])
        print(f"  {symbol}: YES - {len(sym_signals)} signal days, latest: {latest['scan_date']}, score: {latest.get('overall_score',0):.2f}, rank: {latest.get('opportunity_rank')}")
    else:
        print(f"  {symbol}: NOT DETECTED by scanner")

# Big winners by price range
print("\n=== BIGGEST WINNERS BY PRICE ===")
big_winners = [p for p in closed if (p.get("return_pct") or 0) > 15]
big_winners.sort(key=lambda x: x.get("return_pct", 0), reverse=True)
for p in big_winners[:10]:
    print(f"  {p['symbol']}: +{p.get('return_pct',0):.1f}% (entry: ${p.get('entry_price',0):.2f})")
