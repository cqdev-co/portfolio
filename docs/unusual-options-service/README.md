# Unusual Options Activity Scanner - Documentation

This directory contains comprehensive documentation for the Unusual Options Activity Scanner system.

## 📚 Documentation Index

### Getting Started
- [System Overview](system-overview.md) - High-level architecture and concepts
- [Installation Guide](installation-guide.md) - Setup and configuration
- [Quick Start Tutorial](quick-start.md) - First scans and basic usage

### Core Concepts
- [Understanding Unusual Activity](understanding-unusual-activity.md) - What makes options activity unusual
- [Signal Grading System](signal-grading.md) - How signals are scored and classified
- [Detection Algorithms](detection-algorithms.md) - Technical details of anomaly detection

### User Guides
- [CLI Reference](cli-reference.md) - Complete command-line interface documentation
- [Scanning Strategies](scanning-strategies.md) - How to scan effectively for different trading styles
- [Signal Interpretation](signal-interpretation.md) - How to read and act on signals
- [Watchlist Management](watchlist-management.md) - Creating and managing ticker watchlists
- [Grouped Ticker View](grouped-ticker-view.md) - Frontend UI for aggregated signal display
- [Price Chart Visualization](price-chart-visualization.md) - Interactive charts with option detection overlay
- [Spread Detection](spread-detection.md) - Multi-leg strategy detection system
- [Frontend Spread Updates](frontend-spread-detection-updates.md) - UI changes for spread visualization
- [Spread Detection Results](spread-detection-results.md) - Analysis of recent scan data
- [Spread Detection Quick Start](SPREAD_DETECTION_QUICKSTART.md) - 3-step guide to see spreads

### Technical Documentation
- [Architecture](architecture.md) - System design and components
- [Database Schema](database-schema.md) - Supabase table structures and relationships
- [API Integration](api-integration.md) - Data provider integration details
- [Performance Tuning](performance-tuning.md) - Optimization and scaling

### Advanced Topics
- [Backtesting](backtesting.md) - Historical performance analysis
- [Risk Management](risk-management.md) - Position sizing and risk controls
- [Alert Configuration](alerts.md) - Setting up notifications
- [Custom Indicators](custom-indicators.md) - Extending the detection system
- [0DTE and Meme Stock Filtering](0dte-meme-stock-filtering.md) - Enhanced noise reduction system
- [Hourly Cron Job Setup](hourly-cron-setup.md) - Automated scanning with deduplication and continuity tracking

### Research & Analysis
- [Options Flow Patterns](options-flow-patterns.md) - Common patterns and their meanings
- [Case Studies](case-studies.md) - Real-world examples and lessons learned
- [Performance Metrics](performance-metrics.md) - Historical accuracy and statistics

## 🎯 Quick Links

### For Traders
- **Day Traders**: See [Intraday Scanning](scanning-strategies.md#intraday-scanning)
- **Swing Traders**: See [Multi-Day Signals](scanning-strategies.md#swing-trading)
- **Options Sellers**: See [High IV Opportunities](signal-interpretation.md#selling-premium)

### For Automation
- **GitHub Actions Workflow**: See [GitHub Actions Setup](github-actions-setup.md) - Complete automated scanning guide
- **Signal Lifecycle**: See [Signal Lifecycle](github-actions-setup.md#signal-lifecycle) - How signals are tracked over time
- **Deduplication**: See [How It Works](github-actions-setup.md#how-it-works) - Prevents duplicate signals
- **Troubleshooting**: See [Troubleshooting](github-actions-setup.md#-troubleshooting) - Common issues and solutions

### For Developers
- **Integration**: See [Python API](python-api.md)
- **Contributing**: See [Development Guide](development.md)
- **Testing**: See [Testing Guide](testing.md)

## 📖 Documentation Standards

All documentation follows these principles:
1. **Practical Examples**: Every concept includes working examples
2. **Risk Awareness**: Clear disclaimers and risk warnings
3. **Progressive Detail**: Start simple, offer deep dives for advanced users
4. **Up-to-date**: Documentation updated with each feature release

## 🔄 Recent Updates

**November 5, 2025**
- **Continuity Tracking Fix**: Fixed signals being marked inactive after 3 hours
  - Signals now only marked inactive when option contract actually expires
  - Previously: Marked inactive if not detected in last 3 hours
  - Now: Marked inactive only when `expiry < CURRENT_DATE`
  - This prevents active signals from disappearing between scans
  - Updated database function `mark_stale_signals_inactive()` and Python code

**November 4, 2025**
- **Price Chart Visualization**: Interactive stock price charts with option detection overlay
- **Unified Timeline View**: Merged chart and signal details into single interactive tab
- **Click-to-Pin Tooltips**: Click detection dots to pin tooltips in place for easy interaction
- **Enhanced Pinned Tooltip UX**: 
  - Polished design with arrow pointer to detection dot
  - Pulsing ring animation on active detection
  - Semi-transparent overlay for focus
  - Smooth fade-in/zoom animations
  - Close via X button, ESC key, or click outside
  - Auto-closes when clicking signal to navigate
- **Flat Signal Display**: Streamlined signal list with sticky date headers
- **Multi-Signal Detection**: Smart handling of grouped options at same timestamp
- **Click-to-Navigate**: Click tooltip signals to jump to detail view in table
- **Robinhood/Perplexity-Style Design**: Clean, minimal charts with modern aesthetic
- **Multi-Timeframe Analysis**: Support for 1D, 1W, 1M, 3M, 1Y, 5Y, MAX ranges
- **Yahoo Finance Integration**: Real-time price data without API keys

**November 3, 2025**
- **GitHub Actions Fix**: Fixed `--no-root` installation issue preventing CLI from running
- **Timezone Fix**: Resolved UTC timestamp mismatch causing false inactive signals
- **Diagnostic Tool**: Added comprehensive diagnostics script for continuity verification
- **Complete Documentation**: New [GitHub Actions Setup Guide](github-actions-setup.md)

**November 2, 2025**
- **Hourly Cron Job System**: Complete automated scanning setup
- **Signal Deduplication**: Prevents duplicate signals on every run
- **Continuity Tracking**: Tracks signal lifecycle (NEW → CONTINUING → INACTIVE)
- **Enhanced Database Schema**: Added signal continuity fields and functions
- **GitHub Actions Workflow**: Automated hourly execution during market hours

**October 30, 2025**
- Added Grouped Ticker View documentation
- Frontend UI enhancement for signal aggregation
- Improved user experience for multi-signal analysis

**October 2025**
- Initial documentation structure created
- System overview and architecture documented
- CLI reference completed

## 🤝 Contributing to Docs

Found an error or want to improve documentation?
1. Documentation lives in `/docs/unusual-options-service/`
2. Use markdown format
3. Include practical examples
4. Test all code snippets
5. Submit clear, concise explanations

## 📞 Support

- **Issues**: Use GitHub issues for bug reports
- **Questions**: See FAQ sections in each guide
- **Updates**: Check changelog for latest features

---

**Next Steps**: Start with [System Overview](system-overview.md) to understand the core concepts, then move to [Quick Start Tutorial](quick-start.md) to begin scanning.

