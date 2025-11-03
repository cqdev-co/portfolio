# Actionable Analysis Scripts for Quants & Investment Analysts

This directory contains practical helper scripts designed to make unusual options signals actionable for quantitative analysts and investment professionals. Each script addresses specific real-world trading and risk management needs.

## 🚀 Quick Start

```bash
# Interactive analysis menu
./scripts/quick_analysis.sh

# Or run individual scripts
poetry run python scripts/analyze_results.py --days 7 --min-grade A
poetry run python scripts/portfolio_impact.py --portfolio my_portfolio.csv
poetry run python scripts/trade_sizing.py --account-size 500000
poetry run python scripts/signal_correlation.py --days 14
```

## 🛠️ Utility Scripts

### **Database Cleanup Tool** (`cleanup_database.py`)
**Purpose**: Clean unusual options data for fresh testing of continuity tracking

**Quick Usage**:
```bash
# Interactive cleanup (with confirmation)
python scripts/cleanup_database.py

# Auto-confirm (no prompt)
python scripts/cleanup_database.py --yes

# Dry run (see what would be deleted)
python scripts/cleanup_database.py --dry-run

# Clean specific table
python scripts/cleanup_database.py --table signals --yes
```

**Use Cases**:
- Testing NEW badge functionality
- Verifying signal continuity tracking
- Resetting between test runs
- Clearing test data

**See**: [DATABASE_CLEANUP.md](DATABASE_CLEANUP.md) for detailed documentation

### **Continuity Diagnostics Tool** (`diagnose_continuity.py`)
**Purpose**: Verify that signal continuity tracking and deduplication are working correctly

**Quick Usage**:
```bash
# Run full diagnostic suite
python scripts/diagnose_continuity.py

# Verbose output with details
python scripts/diagnose_continuity.py --verbose

# Check specific ticker
python scripts/diagnose_continuity.py --ticker AAPL
```

**What It Checks**:
- ✅ **Deduplication**: Ensures no duplicate signals (same ticker/option/expiry)
- ✅ **Detection Counts**: Verifies signals are incrementing when re-detected
- ✅ **Timestamps**: Checks consistency between detection and storage times
- ✅ **Active Status**: Validates active vs inactive signal distribution
- ✅ **History Tracking**: Confirms continuity records are being created

**Example Output**:
```
🔍 Checking for duplicate signals...
✓ No duplicate signals found - deduplication working!

🔢 Checking detection counts...
✓ Found 45 re-detected signals
Top Re-Detected Signals:
  AAPL 270C: Count=5, Active=✓
  AMD 260C: Count=4, Active=✓

⏰ Checking timestamp consistency...
✓ All timestamps consistent!

🟢 Checking active/inactive status...
✓ 293 active signals ready for frontend!

✓ All checks passed! Continuity tracking is working properly.
```

**Use Cases**:
- After deploying hourly cron job
- Verifying deduplication is working
- Troubleshooting "all signals inactive" issues
- Testing after schema changes
- Validating timestamp handling

**Exit Codes**:
- `0`: All checks passed
- `1`: Critical issues found (duplicates or all signals inactive)
- `130`: Interrupted by user

---

## 📊 Analysis Scripts

### 1. **Signal Analysis Tool** (`analyze_results.py`)
**Purpose**: Comprehensive statistical analysis of unusual options signals

**Key Features**:
- Volume, premium flow, and score distributions
- Grade-based performance breakdown (S/A/B/C/D/F)
- Top performers by ticker and signal quality
- Risk analysis and common risk factors
- AI-powered insights (optional with OpenAI API)

**Use Cases**:
- Daily signal quality assessment
- Market environment analysis
- Signal prioritization
- Performance tracking

**Example Output**:
```
📊 Signal Overview
├─ Total Signals: 770
├─ Average Premium Flow: $6,288,465
├─ Total Premium Flow: $4,842,117,767
└─ Top Focus: TSLA, NVDA, META
```

### 2. **Portfolio Impact Analyzer** (`portfolio_impact.py`)
**Purpose**: Analyze how unusual options signals affect existing portfolio positions

**Key Features**:
- Direct position impact analysis
- Sector correlation detection
- Hedging opportunity identification
- Risk-adjusted recommendations
- Prioritized action items

**Use Cases**:
- Portfolio risk management
- Position adjustment decisions
- Hedging strategy development
- Correlation risk assessment

**Portfolio CSV Format**:
```csv
ticker,shares,avg_cost,current_price,market_value,sector
AAPL,1000,150.0,175.0,175000,Technology
MSFT,500,300.0,350.0,175000,Technology
```

**Example Output**:
```
🎯 Direct Portfolio Impacts
├─ AAPL: HOLD_OR_ADD (Bullish signal, 25% weight)
├─ TSLA: CONSIDER_HEDGE (Bearish activity detected)
└─ 3 hedge opportunities identified
```

### 3. **Trade Sizing Calculator** (`trade_sizing.py`)
**Purpose**: Calculate optimal position sizes using Kelly Criterion and risk management

**Key Features**:
- Kelly Criterion optimal sizing
- Risk-adjusted position calculations
- Expected value analysis
- Monte Carlo simulations
- Portfolio heat management

**Use Cases**:
- Position sizing decisions
- Risk budget allocation
- Expected return calculations
- Portfolio optimization

**Example Output**:
```
💰 Position Sizing Recommendations
├─ NVDA: 5 contracts, $2,500 max loss, 25% expected return
├─ TSLA: 3 contracts, $1,800 max loss, 18% expected return
└─ Portfolio Risk: 4.2% of account (within 6% limit)
```

### 4. **Signal Correlation Analyzer** (`signal_correlation.py`)
**Purpose**: Identify correlated unusual activity and market regime patterns

**Key Features**:
- Cross-ticker correlation analysis
- Sector-wide activity clustering
- Market regime identification
- Signal clustering by characteristics
- Diversification insights

**Use Cases**:
- Market regime analysis
- Diversification planning
- Sector rotation strategies
- Risk concentration detection

**Example Output**:
```
🔗 Ticker Signal Correlations
├─ AAPL-MSFT: 0.85 correlation (SECTOR_TECHNOLOGY)
├─ Market Regime: INSTITUTIONAL_ACCUMULATION
└─ 5 sector clusters identified
```

## 🎯 Practical Use Cases for Quants & Analysts

### **Daily Workflow**
```bash
# 1. Morning market analysis
./scripts/quick_analysis.sh  # Select option 1: Daily S-Grade Analysis

# 2. Portfolio impact check
poetry run python scripts/portfolio_impact.py --portfolio positions.csv --days 1

# 3. Position sizing for new opportunities
poetry run python scripts/trade_sizing.py --account-size 1000000 --days 1 --min-grade A
```

### **Weekly Review**
```bash
# 1. Comprehensive signal analysis
poetry run python scripts/analyze_results.py --days 7 --min-grade B

# 2. Correlation and regime analysis
poetry run python scripts/signal_correlation.py --days 14 --min-grade B

# 3. Portfolio rebalancing analysis
poetry run python scripts/portfolio_impact.py --portfolio positions.csv --days 7
```

### **Risk Management**
```bash
# Check portfolio heat and correlations
poetry run python scripts/portfolio_impact.py --portfolio positions.csv
poetry run python scripts/signal_correlation.py --days 7

# Validate position sizes
poetry run python scripts/trade_sizing.py --account-size 500000 --max-risk 0.015
```

## 📈 Advanced Analytics Features

### **Kelly Criterion Position Sizing**
- Optimal fraction calculation based on win rates and payoffs
- Risk-adjusted sizing with portfolio heat limits
- Monte Carlo simulation for portfolio outcomes
- Conservative caps to prevent over-leveraging

### **Correlation Analysis**
- Time-based signal correlation detection
- Sector and market cap clustering
- Market regime identification (Bullish/Bearish/Neutral/Uncertain)
- Cross-asset unusual activity patterns

### **Risk Management**
- Portfolio heat monitoring (max 6% total risk)
- Position-level risk limits (max 2% per trade)
- Correlation exposure limits
- Dynamic risk adjustment based on signal quality

### **AI-Powered Insights** (Optional)
- Pattern recognition in unusual activity
- Market context interpretation
- Actionable trading recommendations
- Risk factor analysis

## 🔧 Configuration & Setup

### **Environment Variables**
```bash
# Required for database access
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
SUPABASE_SERVICE_KEY=your_service_key

# Optional for AI insights
OPENAI_API_KEY=your_openai_key
```

### **Portfolio File Format**
Create a CSV file with your positions:
```csv
ticker,shares,avg_cost,current_price,market_value,sector
AAPL,1000,150.00,175.00,175000,Technology
GOOGL,100,2500.00,2750.00,275000,Technology
JPM,500,140.00,160.00,80000,Financial
```

### **Trading Parameters**
Customize risk parameters in scripts:
```python
trading_params = TradingParameters(
    account_size=1000000,      # Account size
    max_position_risk=0.02,    # 2% max risk per trade
    max_portfolio_heat=0.06,   # 6% max total portfolio risk
    min_expected_return=0.15   # 15% minimum expected return
)
```

## 📊 Output Formats

### **Terminal Output**
- Rich, colorful tables with grade-based color coding
- Progress bars for long-running analyses
- Structured panels for key insights
- Action-oriented recommendations

### **Data Export** (Future Enhancement)
- CSV export of analysis results
- JSON format for API integration
- Excel reports with charts
- PDF summaries for presentations

## 🚨 Risk Warnings & Disclaimers

### **Important Considerations**
1. **Historical Performance**: Past signal performance doesn't guarantee future results
2. **Market Conditions**: Unusual activity patterns change with market regimes
3. **Liquidity Risk**: Ensure sufficient option liquidity before trading
4. **Model Risk**: Kelly Criterion assumes stable win rates and payoffs
5. **Correlation Risk**: Correlations can change rapidly during market stress

### **Best Practices**
- Start with smaller position sizes while validating signal quality
- Monitor portfolio heat and correlation exposure regularly
- Use stop-losses and position management rules
- Validate signals with fundamental and technical analysis
- Keep detailed records for performance attribution

## 🔄 Integration with Trading Systems

### **API Integration** (Future)
```python
# Example integration
from unusual_options.scripts import PortfolioImpactAnalyzer

analyzer = PortfolioImpactAnalyzer()
impacts = await analyzer.analyze_portfolio_impact()

# Send to trading system
for impact in impacts:
    if impact.recommendation == "CONSIDER_HEDGE":
        trading_system.create_hedge_order(impact.signal.ticker)
```

### **Alert Integration**
- Discord/Slack notifications for high-impact signals
- Email alerts for portfolio risk threshold breaches
- SMS alerts for urgent hedge recommendations

## 📚 Additional Resources

### **Academic References**
- Kelly, J.L. (1956). "A New Interpretation of Information Rate"
- Markowitz, H. (1952). "Portfolio Selection"
- Black, F. & Scholes, M. (1973). "The Pricing of Options and Corporate Liabilities"

### **Industry Best Practices**
- Risk management frameworks from major hedge funds
- Options market making and flow analysis techniques
- Institutional order flow interpretation methods

## 🤝 Contributing

To add new analysis scripts:
1. Follow the existing script structure
2. Include comprehensive error handling
3. Add rich terminal output formatting
4. Document use cases and examples
5. Include risk warnings where appropriate

## 📞 Support

For questions about the analysis scripts:
1. Check the individual script help: `python script_name.py --help`
2. Review the main documentation in `docs/`
3. Examine the example outputs and use cases above
