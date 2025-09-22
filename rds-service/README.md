Project Outline — “Reddit → Structured Events” (local-first, M3 Pro)

This is a drop-in data source you can run locally and later plug into your scanners (Vol Squeeze, Breakout Retest). It ingests Reddit posts, routes images, extracts structured facts with OCR+VLM, enriches with market data, filters low-value items, and exports Parquet for joins.

1) Tech Stack & Dependencies

Language: Python 3.11 (Poetry)
Core: httpx (Reddit API), pydantic, pandas, duckdb, pyarrow
OCR/Layout: paddleocr, layoutparser (optional), opencv-python
Vision routing: open_clip_torch (optional)
Local VLM (optional): transformers, torch (MPS), model: Qwen2-VL-7B or LLaVA-1.6-7B
NLP: spacy (small), regex
DB: SQLite (MVP) → Postgres later
CLI/UI: typer (CLI), streamlit (audit panel)
Testing: pytest
Lint/Format: ruff, black
Images: imagehash (pHash)
Env: python-dotenv

2) Repository Layout
reddit-source/
  pyproject.toml
  Makefile
  .env.example
  README.md
  src/
    app/run.py
    config.py
    ingest/
      reddit_client.py
      poller.py
      models.py
    storage/
      db.py
      parquet_writer.py
      fs.py
    ocr/
      paddle_ocr.py
    route/
      router.py         # chart | pnl | slide | meme | other
    vlm/
      extractor.py      # tool-calling JSON; nulls when unsure
      prompts.py
    rules/
      symbols.py        # symbol table + collisions
      ticker_verify.py
      value_filter.py   # hard-drop / soft-quarantine
      quality.py
      dedupe.py
    enrich/
      market.py         # price_at_post, events/earnings, fwd returns
    join/
      reddit_features.py    # aggregates & z-scores
      scanners_join.py      # glue to your scanner outputs
    ui/
      audit_app.py      # streamlit inspector
  data/
    images/
    parquet/
    cache/
  tests/
    test_router.py
    test_ticker_verify.py
    test_value_filter.py
    test_end_to_end.py

3) Environment & Config

.env.example

REDDIT_CLIENT_ID=xxx
REDDIT_CLIENT_SECRET=xxx
REDDIT_USER_AGENT=reddit-source/0.1 by <youruser>
SUBREDDITS=stocks,investing,options,Daytrading,wallstreetbets,pennystocks,biotech,semiconductors,ETFs
POLL_WINDOW_MINUTES=120
POLL_INTERVAL_SECONDS=600
DATA_DIR=./data
USE_LOCAL_VLM=true
VLM_MODEL_NAME=Qwen/Qwen2-VL-7B-Instruct
MARKET_DATA_PROVIDER=yfinance
TIMEZONE=America/Denver


Makefile

setup: ; poetry install
run:   ; poetry run python -m src.app.run
ui:    ; poetry run streamlit run src/ui/audit_app.py
test:  ; poetry run pytest -q
fmt:   ; poetry run ruff check --fix . && poetry run black .

4) Data Model (Pydantic)
# src/ingest/models.py
from pydantic import BaseModel, Field
from typing import Literal, Optional, Dict, List

class PostCore(BaseModel):
    post_id: str
    subreddit: str
    author: Optional[str]
    created_utc: int
    title: str
    selftext: str
    permalink: str
    score: int
    num_comments: int
    url: Optional[str]
    flair: Optional[str]
    is_image: bool
    image_path: Optional[str]

class ImageExtraction(BaseModel):
    image_type: Optional[Literal["chart","pnl","slide","meme","other"]] = None
    primary_ticker: Optional[str] = None
    tickers: List[str] = Field(default_factory=list)
    timeframe: Optional[Literal["1m","5m","15m","1h","4h","D","W","M"]] = None
    stance: Optional[Literal["bull","bear","neutral"]] = None
    horizon: Optional[Literal["intraday","swing","long"]] = None
    claims: List[str] = Field(default_factory=list)
    numeric: Dict[str, float] = Field(default_factory=dict)  # entry/stop/target
    platform: Optional[str] = None
    field_confidence: Dict[str, float] = Field(default_factory=dict)

class TextExtraction(BaseModel):
    tickers: List[str] = Field(default_factory=list)
    stance: Optional[Literal["bull","bear","neutral"]] = None
    horizon: Optional[Literal["intraday","swing","long"]] = None
    claims: List[str] = Field(default_factory=list)
    confidence: float = 0.0

5) Pipeline (MVP)

Step A — Ingest

Poll each sub for new posts in last POLL_WINDOW_MINUTES.

Persist PostCore to SQLite.

Download image to data/images/{post_id}.jpg when applicable.

Step B — OCR & Routing

Run PaddleOCR → tokens+boxes+conf.

router.py heuristics:

pnl tokens: ["P/L", "Total Return", "Filled", "Qty", "%"]

chart tokens: ["Open","High","Low","Close","EMA","RSI","1h","15m","D","TradingView"]

slide: dense table/grid; many dates/tickers.

fallback: meme/other.

Optional CLIP tie-breaker.

Step C — VLM Extraction (guarded)

If route ∈ {chart,pnl,slide} and finance tokens present → call local VLM with strict JSON tool-calling prompt (see §9).

Step D — Ticker Verify

symbols.py: symbol table + collision list (CAT, ALL, ONE, FOR, IT, RH, L, ON, RUN, META(old), EV, AI…).

Accept ticker only if:

$TICKER in title/selftext, or

Nearby finance tokens in OCR window, or

In chart title/watermark/legend region.

Market sanity: if price extracted, must be within ±2% of market snapshot at created_utc.

Step E — Dedupe

pHash on image, MinHash on OCR text → mark dup_group.

Step F — Value Filter

Compute value_score and mark: valuable | soft_quarantine | hard_drop.

Step G — Enrichment

price_at_post, iv_rank_at_post (if available), earnings_window.

Nightly compute fwd_1d_ret, fwd_5d_ret.

Step H — Outputs

Parquet snapshot per day combining core + extractions + enrichment (one wide table).

Aggregates (reddit_features.py): by (ticker, 2h bucket): post_count, uniq_authors, score_sum, bull_pct, has_tradeplan, buzz_z.

Step I — Join with Scanners

scanners_join.py function: join_scanner_signals(scanner_df, reddit_features_df) -> ranked_signals_df

Feature ideas: buzz_z, bull_bias, pre_event_days, image_tradeplan_flag.

6) Value Filter (rules & weights)
# src/rules/value_filter.py
VALUE_THRESHOLDS = {"keep": 0.60, "quarantine": 0.30}

# content_score (0..1)
# +0.4 verified ticker, +0.2 (stance|horizon), +0.2 (event or entry/stop/target), +0.2 >=2 claims
# image_signal_score: router type + OCR density + extracted timeframe/levels
# evidence_score: numbers/units, filings links, catalyst keywords
# crosscheck_score: price sanity + ticker appears in >=2 sources
# quality_score: sub weight + author age + score velocity (normed)

# Hard-drop: spam/NSFW/dup/no finance context.
# Soft-quarantine: PnL flex w/o ticker, generic questions, mega-watchlists, illegible charts.

7) CLI Commands
poetry run reddit-source ingest --once         # single poll cycle
poetry run reddit-source ingest --watch        # continuous loop
poetry run reddit-source eval --sample 300     # label & evaluate
poetry run reddit-source export --date 2025-09-21
poetry run reddit-source join --scanner parquet/path/to/signals.parquet
poetry run reddit-source audit                 # launches Streamlit

8) Acceptance Criteria (MVP)

✅ Pulls posts from 6+ subs and stores PostCore.

✅ Downloads images and runs OCR; routes to {chart|pnl|slide|meme}.

✅ Calls local VLM on routed images and returns valid JSON with null when unsure.

✅ Ticker verification reduces false positives on collision words by ≥70% vs naive regex (measured on a 300-item labeled set).

✅ Value filter partitions into valuable / quarantine / hard-drop; quarantine items don’t affect features.

✅ Daily Parquet export with columns:

post_id, subreddit, created_utc, title, tickers, primary_ticker, stance, claims, image_type, numeric.entry/stop/target, quality_score, value_score, price_at_post, fwd_1d_ret, fwd_5d_ret

✅ reddit_features.py returns per-ticker 2h aggregates and a buzz_z.

✅ scanners_join.py merges Reddit features with your scanner signals.

9) VLM Prompt (tool-calling)

System

You extract structured facts from finance images for trading research. Use the JSON schema exactly. Only include facts explicitly visible. If unsure, set fields to null or empty. Do not infer.

User (per image)

The image is from a finance subreddit and may be a trading chart, a P&L/positions screenshot, or a slide/table of catalysts.
Tasks:

Identify US equity/ETF tickers only.

If multiple tickers, choose the most emphasized as primary_ticker (chart title/watermark/legend or repeated emphasis).

Extract explicit stance and horizon only if stated or visually obvious (e.g., “LONG”, green BUY arrow).

If labeled, place numeric levels into numeric with keys entry, stop, target.

Add concise factual claims (≤20 words each).

Return valid JSON.

Few-shots to include:

TradingView long idea (NVDA) with TP/SL.

Robinhood positions/P&L with ticker column.

FDA calendar slide → multiple tickers and dates.

10) Cursor Tasks (copy/paste as TODOs)

Bootstrap

Create Poetry project, add deps, write config.py and .env.example.

Implement reddit_client.py (OAuth via httpx) + poller.py (last 120m).

Save PostCore to SQLite; download images.

OCR + Router

Build paddle_ocr.py returning tokens+boxes+conf.

Implement router.py with heuristics + optional CLIP.

Symbol & Ticker Verify

Load symbol table; add collision list; implement context-window checks and market sanity.

VLM Extractor

extractor.py with local model (MPS) + tool-calling to ImageExtraction.

Retry/backoff; enforce valid JSON with Pydantic.

Dedupe & Value Filter

dedupe.py (pHash + MinHash).

value_filter.py with scores & thresholds; engagement override.

Enrichment

market.py snapshot price_at_post via yfinance; add simple earnings calendar (CSV seed).

Outputs & Joins

parquet_writer.py for daily wide table.

reddit_features.py (2h aggregates + z-scores).

scanners_join.py to merge with your scanner Parquet.

UI & Tests

Streamlit audit_app.py to visualize post → OCR → JSON → scores.

Pytests: router, ticker_verify, value_filter, end-to-end happy path.

11) Milestones & Timeboxes

Day 1: Ingest + storage + image download; OCR working; router v1.

Day 2: Ticker verify + market sanity; value filter v1; Parquet export.

Day 3: Local VLM extraction; few-shots; JSON validation; dedupe.

Day 4: Enrichment + nightly forward returns; aggregates & z-scores.

Day 5: Streamlit audit; tests; first join with squeeze scanner; tweak thresholds.

12) Example Join (pseudocode)
# reddit_features_df: [ticker, bucket_2h, post_count, uniq_authors, bull_pct, has_tradeplan, buzz_z]
# scanner_df:         [ticker, signal_ts, signal_type, params...]

scanner_df["bucket_2h"] = scanner_df.signal_ts.dt.floor("2H")
out = (scanner_df
       .merge(reddit_features_df, how="left", on=["ticker","bucket_2h"])
       .assign(reddit_confirmed=lambda d: (d.buzz_z>=2) & (d.bull_pct>=0.6))
       .sort_values(["signal_ts", "buzz_z"], ascending=[True, False]))

13) Runbook

cp .env.example .env (fill Reddit creds).

make setup

make run (let it poll ~30–60 min)

make ui (inspect)

poetry run reddit-source export --date <today>

poetry run reddit-source join --scanner path/to/your_scanner.parquet