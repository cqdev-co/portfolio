# Portfolio Documentation

This directory contains comprehensive documentation for all services and 
components in the portfolio project.

## 📁 Service Documentation

### Trading & Analysis Services

#### [Unusual Options Service](unusual-options-service/)
Detect unusual options activity that may indicate insider information or 
smart money positioning.

**Key Features:**
- Real-time unusual options activity detection
- Signal grading system (S, A, B, C, D, F)
- Spread detection (vertical spreads, iron condors, etc.)
- **Advanced Filter System** - Filter by date, grade, option type, premium 
  flow, and detection patterns
- Interactive price charts with signal overlay
- Automated hourly scanning with signal continuity
- Frontend dashboard with grouped ticker view
- RLS (Row Level Security) policies for data protection

**Quick Links:**
- [System Overview](unusual-options-service/system-overview.md)
- [Quick Start Guide](unusual-options-service/quick-start.md)
- [Filter System Guide](unusual-options-service/filter-system.md) ⭐ NEW
- [Database Schema](unusual-options-service/database-schema.md)
- [Technical Implementation](unusual-options-service/technical-implementation.md)
- [Troubleshooting RLS](unusual-options-service/troubleshooting-rls.md)

#### [Analyze Options Service](analyze-options-service/) ✅ Phase 2+ Complete
Enterprise-grade options analysis system with high-confidence trade filtering.

**Status:** Phase 2+ Complete - Best-of-Best Command Added

**Key Features:**
- 🏆 **`analyze best`** - Get only high-confidence opportunities (top 1-2% of signals)
- 🎯 Automated vertical spread vs naked option comparison
- 📊 Intelligent position sizing and risk management  
- 🔍 Multi-layer quality filtering (technical + strategy + quality gates)
- 📈 Black-Scholes probability estimation
- 💰 Account-based risk allocation (conservative/moderate/aggressive)
- ⚡ Fast execution: 408 signals → 5 actionable trades in 2 minutes

**Quick Links:**
- [Quick Start Guide](../analyze-options-service/QUICK_START.md) ⭐
- [Command Guide](../analyze-options-service/COMMAND_GUIDE.md) - Which command when?
- [Best Command Explained](../analyze-options-service/BEST_COMMAND.md) - High-confidence filtering
- [Architecture](analyze-options-service/architecture.md)
- [Trade Strategies](analyze-options-service/trade-strategies.md)
- [Phase 2 Complete](../analyze-options-service/PHASE_2_COMPLETE.md)

#### [RDS Ticker Analysis](rds-ticker-analysis/)
Reddit sentiment analysis combined with AI-powered investment insights.

**Key Features:**
- Reddit sentiment analysis from multiple subreddits
- AI-generated investment thesis
- Technical analysis integration
- Risk assessment
- Fast analysis mode for debugging

**Quick Links:**
- [System Overview](rds-ticker-analysis/system-overview.md)

#### [Volatility Squeeze Scanner](volatility-squeeze-scanner/)
TTM Squeeze indicator scanner for identifying consolidation breakouts.

**Key Features:**
- Real-time volatility squeeze detection
- Historical backtesting capabilities
- Multi-timeframe analysis
- GitHub Actions CI/CD integration
- Professional logging system

**Quick Links:**
- [System Overview](volatility-squeeze-scanner/system-overview.md)
- [Technical Implementation](volatility-squeeze-scanner/technical-implementation.md)
- [User Guide](volatility-squeeze-scanner/user-guide.md)

#### [Penny Stocks Service](pennystocks/)
Small-cap stock screening and analysis system.

**Quick Links:**
- [System Overview](pennystocks/system-overview.md)
- [Technical Implementation](pennystocks/technical-implementation.md)

### Frontend

#### [Frontend Documentation](frontend/)
Next.js frontend application with Vercel deployment.

**Key Features:**
- Modern React with TypeScript
- Responsive design with Tailwind CSS
- Real-time data updates via Supabase
- Interactive data visualizations
- Advanced filtering system for options signals

**Quick Links:**
- [Vercel Build Fixes](frontend/vercel-build-fixes.md)
- [Volatility Squeeze Scanner UI](frontend/volatility-squeeze-scanner.md)

### Utilities

#### [Database](db/)
Shared database schemas and migrations for all services.

**Quick Links:**
- [Database README](db/README.md)

#### [Library](lib/)
Shared types and utilities across services.

**Quick Links:**
- [Library README](lib/README.md)

## 🎯 Getting Started

### For Traders
1. Start with the [Unusual Options Quick Start](unusual-options-service/quick-start.md)
2. Learn about [Signal Interpretation](unusual-options-service/signal-interpretation.md)
3. Use the [Filter System](unusual-options-service/filter-system.md) to find 
   signals that match your strategy
4. Set up [Scanning Strategies](unusual-options-service/scanning-strategies.md)

### For Developers
1. Review [Architecture](unusual-options-service/architecture.md)
2. Set up [Database Schema](unusual-options-service/database-schema.md)
3. Understand the [Filter System Architecture](unusual-options-service/filter-system.md)
4. Follow [Technical Implementation](unusual-options-service/technical-implementation.md)

## 📊 Recent Updates

### November 2024

#### Filter System Enhancement (Latest) ⭐
- Implemented modular, scalable filter system for unusual options scanner
- Date-based filtering with quick presets
- Multi-select grade and option type filters
- Premium flow range filtering
- Detection pattern toggles (volume anomaly, OI spike, sweep, block trade)
- Slide-out filter panel with active filter count
- Full documentation in [filter-system.md](unusual-options-service/filter-system.md)

#### Spread Detection System
- Phase 1 implementation for vertical spreads, iron condors, etc.
- Confidence scoring and reasoning
- Frontend visualization with warning badges
- Comprehensive documentation in [spread-detection.md](unusual-options-service/spread-detection.md)

#### Signal Continuity & Cron Jobs
- Automated hourly scanning
- Signal deduplication
- Active signal tracking
- Detection count metrics

#### RLS & Security
- Row Level Security policies implemented
- Anonymous access controls
- Premium account distinction
- Frontend fixes for authentication

## 🔧 Technical Stack

### Backend
- **Python 3.12+** - Core services
- **Poetry** - Dependency management
- **Supabase** - PostgreSQL database with real-time features
- **FastAPI** - API framework (where applicable)

### Frontend
- **Next.js 14** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Bun** - Package manager
- **Recharts** - Data visualization

### Infrastructure
- **Vercel** - Frontend hosting
- **GitHub Actions** - CI/CD
- **Supabase** - Backend as a Service

## 📝 Documentation Standards

All service documentation should include:
- System overview and purpose
- Technical architecture
- Setup and configuration
- Usage examples
- API references (where applicable)
- Performance considerations
- Troubleshooting guide

## 🤝 Contributing

When making changes:
1. Update relevant documentation
2. Follow existing code style
3. Add tests for new features
4. Update the changelog in docs

## 📧 Support

For questions or issues:
- Check the relevant service documentation
- Review troubleshooting guides
- Check GitHub issues

---

**Last Updated:** November 2024  
**Maintained by:** Portfolio Project Team
