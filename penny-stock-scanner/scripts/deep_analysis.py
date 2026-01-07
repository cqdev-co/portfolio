"""Deep performance analysis for penny stock scanner."""

from supabase import create_client
import os
from dotenv import load_dotenv
from collections import defaultdict

load_dotenv()

client = create_client(
    os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL"),
    os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    or os.getenv("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY"),
)

perf = client.table("penny_signal_performance").select("*").execute().data
signals = client.table("penny_stock_signals").select("*").execute().data

symbol_signals = {(s["symbol"], s["scan_date"]): s for s in signals}

# 1. Analyze performance by volume ratio
print("=== PERFORMANCE BY VOLUME RATIO ===")
vol_buckets = {
    "1-2x": {"count": 0, "wins": 0, "returns": []},
    "2-3x": {"count": 0, "wins": 0, "returns": []},
    "3-5x": {"count": 0, "wins": 0, "returns": []},
    "5-10x": {"count": 0, "wins": 0, "returns": []},
    "10x+": {"count": 0, "wins": 0, "returns": []},
}

for p in perf:
    if p.get("status") != "CLOSED":
        continue
    key = (p["symbol"], p.get("entry_date"))
    sig = symbol_signals.get(key)
    if sig:
        vol = sig.get("volume_ratio", 1)
        if vol < 2:
            bucket = "1-2x"
        elif vol < 3:
            bucket = "2-3x"
        elif vol < 5:
            bucket = "3-5x"
        elif vol < 10:
            bucket = "5-10x"
        else:
            bucket = "10x+"

        vol_buckets[bucket]["count"] += 1
        if p.get("is_winner"):
            vol_buckets[bucket]["wins"] += 1
        if p.get("return_pct") is not None:
            vol_buckets[bucket]["returns"].append(p["return_pct"])

for bucket in ["1-2x", "2-3x", "3-5x", "5-10x", "10x+"]:
    d = vol_buckets[bucket]
    if d["count"] == 0:
        continue
    wr = d["wins"] / d["count"] * 100
    avg_ret = sum(d["returns"]) / len(d["returns"]) if d["returns"] else 0
    print(
        f"  {bucket}: {d['count']} trades, Win Rate: {wr:.1f}%, Avg Return: {avg_ret:.2f}%"
    )

# 2. Combination analysis: Breakout + Higher Lows
print("\n=== BREAKOUT + HIGHER LOWS COMBINATION ===")
combo_perf = {
    "both": {"count": 0, "wins": 0, "returns": []},
    "breakout_only": {"count": 0, "wins": 0, "returns": []},
    "hl_only": {"count": 0, "wins": 0, "returns": []},
    "neither": {"count": 0, "wins": 0, "returns": []},
}

for p in perf:
    if p.get("status") != "CLOSED":
        continue
    key = (p["symbol"], p.get("entry_date"))
    sig = symbol_signals.get(key)
    if sig:
        is_breakout = sig.get("is_breakout", False)
        has_hl = sig.get("higher_lows_detected", False)

        if is_breakout and has_hl:
            bucket = "both"
        elif is_breakout:
            bucket = "breakout_only"
        elif has_hl:
            bucket = "hl_only"
        else:
            bucket = "neither"

        combo_perf[bucket]["count"] += 1
        if p.get("is_winner"):
            combo_perf[bucket]["wins"] += 1
        if p.get("return_pct") is not None:
            combo_perf[bucket]["returns"].append(p["return_pct"])

labels = {
    "both": "Breakout + Higher Lows",
    "breakout_only": "Breakout Only",
    "hl_only": "Higher Lows Only",
    "neither": "Neither",
}
for name in ["both", "breakout_only", "hl_only", "neither"]:
    d = combo_perf[name]
    if d["count"] == 0:
        continue
    wr = d["wins"] / d["count"] * 100
    avg_ret = sum(d["returns"]) / len(d["returns"]) if d["returns"] else 0
    print(
        f"  {labels[name]}: {d['count']} trades, Win Rate: {wr:.1f}%, Avg Return: {avg_ret:.2f}%"
    )

# 3. Look at worst losses to identify patterns
print("\n=== WORST LOSSES (>20% loss) ===")
big_losses = [
    p for p in perf if p.get("status") == "CLOSED" and (p.get("return_pct") or 0) < -20
]
for p in sorted(big_losses, key=lambda x: x.get("return_pct", 0)):
    key = (p["symbol"], p.get("entry_date"))
    sig = symbol_signals.get(key)
    rank = sig.get("opportunity_rank", "?") if sig else "?"
    score = sig.get("overall_score", 0) if sig else 0
    vol = sig.get("volume_ratio", 0) if sig else 0
    breakout = sig.get("is_breakout", False) if sig else False
    print(
        f"  {p['symbol']}: {p.get('return_pct', 0):.1f}%, Rank: {rank}, Score: {score:.2f}, Vol: {vol:.1f}x, Breakout: {breakout}"
    )

# 4. Price range analysis
print("\n=== PERFORMANCE BY PRICE RANGE ===")
price_buckets = {
    "sub1": {"count": 0, "wins": 0, "returns": [], "label": "Sub-$1"},
    "1to2": {"count": 0, "wins": 0, "returns": [], "label": "$1-2"},
    "2to3": {"count": 0, "wins": 0, "returns": [], "label": "$2-3"},
    "3to5": {"count": 0, "wins": 0, "returns": [], "label": "$3-5"},
}

for p in perf:
    if p.get("status") != "CLOSED":
        continue
    price = p.get("entry_price", 0)
    if price < 1:
        bucket = "sub1"
    elif price < 2:
        bucket = "1to2"
    elif price < 3:
        bucket = "2to3"
    else:
        bucket = "3to5"

    price_buckets[bucket]["count"] += 1
    if p.get("is_winner"):
        price_buckets[bucket]["wins"] += 1
    if p.get("return_pct") is not None:
        price_buckets[bucket]["returns"].append(p["return_pct"])

for bucket in ["sub1", "1to2", "2to3", "3to5"]:
    d = price_buckets[bucket]
    if d["count"] == 0:
        continue
    wr = d["wins"] / d["count"] * 100
    avg_ret = sum(d["returns"]) / len(d["returns"]) if d["returns"] else 0
    print(
        f"  {d['label']}: {d['count']} trades, Win Rate: {wr:.1f}%, Avg Return: {avg_ret:.2f}%"
    )

# 5. Recommendation performance
print("\n=== PERFORMANCE BY RECOMMENDATION ===")
rec_perf = defaultdict(lambda: {"count": 0, "wins": 0, "returns": []})

for p in perf:
    if p.get("status") != "CLOSED":
        continue
    key = (p["symbol"], p.get("entry_date"))
    sig = symbol_signals.get(key)
    if sig:
        rec = sig.get("recommendation", "Unknown")
        rec_perf[rec]["count"] += 1
        if p.get("is_winner"):
            rec_perf[rec]["wins"] += 1
        if p.get("return_pct") is not None:
            rec_perf[rec]["returns"].append(p["return_pct"])

for rec in ["STRONG_BUY", "BUY", "WATCH", "HOLD"]:
    if rec not in rec_perf:
        continue
    d = rec_perf[rec]
    if d["count"] == 0:
        continue
    wr = d["wins"] / d["count"] * 100
    avg_ret = sum(d["returns"]) / len(d["returns"]) if d["returns"] else 0
    print(
        f"  {rec}: {d['count']} trades, Win Rate: {wr:.1f}%, Avg Return: {avg_ret:.2f}%"
    )

# 6. Score bucket analysis
print("\n=== PERFORMANCE BY SCORE ===")
score_buckets = {
    "0.55-0.62": {"count": 0, "wins": 0, "returns": []},
    "0.62-0.72": {"count": 0, "wins": 0, "returns": []},
    "0.72-0.82": {"count": 0, "wins": 0, "returns": []},
    "0.82+": {"count": 0, "wins": 0, "returns": []},
}

for p in perf:
    if p.get("status") != "CLOSED":
        continue
    key = (p["symbol"], p.get("entry_date"))
    sig = symbol_signals.get(key)
    if sig:
        score = sig.get("overall_score", 0)
        if score < 0.62:
            bucket = "0.55-0.62"
        elif score < 0.72:
            bucket = "0.62-0.72"
        elif score < 0.82:
            bucket = "0.72-0.82"
        else:
            bucket = "0.82+"

        score_buckets[bucket]["count"] += 1
        if p.get("is_winner"):
            score_buckets[bucket]["wins"] += 1
        if p.get("return_pct") is not None:
            score_buckets[bucket]["returns"].append(p["return_pct"])

for bucket in ["0.55-0.62", "0.62-0.72", "0.72-0.82", "0.82+"]:
    d = score_buckets[bucket]
    if d["count"] == 0:
        continue
    wr = d["wins"] / d["count"] * 100
    avg_ret = sum(d["returns"]) / len(d["returns"]) if d["returns"] else 0
    print(
        f"  {bucket}: {d['count']} trades, Win Rate: {wr:.1f}%, Avg Return: {avg_ret:.2f}%"
    )

# 7. Market outperformance analysis
print("\n=== MARKET OUTPERFORMANCE ANALYSIS ===")
mkt_perf = {
    "outperforming": {"count": 0, "wins": 0, "returns": []},
    "underperforming": {"count": 0, "wins": 0, "returns": []},
}

for p in perf:
    if p.get("status") != "CLOSED":
        continue
    key = (p["symbol"], p.get("entry_date"))
    sig = symbol_signals.get(key)
    if sig:
        mkt_out = sig.get("market_outperformance", 0) or 0
        bucket = "outperforming" if mkt_out > 0 else "underperforming"
        mkt_perf[bucket]["count"] += 1
        if p.get("is_winner"):
            mkt_perf[bucket]["wins"] += 1
        if p.get("return_pct") is not None:
            mkt_perf[bucket]["returns"].append(p["return_pct"])

for name in ["outperforming", "underperforming"]:
    d = mkt_perf[name]
    if d["count"] == 0:
        continue
    wr = d["wins"] / d["count"] * 100
    avg_ret = sum(d["returns"]) / len(d["returns"]) if d["returns"] else 0
    print(
        f"  {name.title()}: {d['count']} trades, Win Rate: {wr:.1f}%, Avg Return: {avg_ret:.2f}%"
    )

# 8. Check for stocks that hit stop loss quickly
print("\n=== STOP LOSS HITS BY TIME ===")
stop_loss_trades = [p for p in perf if p.get("exit_reason") == "STOP_LOSS"]
print(f"  Total stop loss hits: {len(stop_loss_trades)}")
for p in stop_loss_trades[:10]:
    key = (p["symbol"], p.get("entry_date"))
    sig = symbol_signals.get(key)
    rank = sig.get("opportunity_rank", "?") if sig else "?"
    print(
        f"  {p['symbol']}: {p.get('return_pct', 0):.1f}%, Rank: {rank}, {p.get('entry_date')} -> {p.get('exit_date')}"
    )
