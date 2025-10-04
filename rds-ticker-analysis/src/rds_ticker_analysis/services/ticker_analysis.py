"""Main ticker analysis service that orchestrates all components."""

import asyncio
from datetime import datetime, timedelta
from typing import Dict, List, Optional

from loguru import logger

from rds_ticker_analysis.models.analysis import AnalysisResult, TickerOpportunity
from rds_ticker_analysis.models.base import DataQuality, RedditMetrics
from rds_ticker_analysis.models.reddit import TickerMention
from rds_ticker_analysis.models.sentiment import SentimentAnalysis
from rds_ticker_analysis.services.ai_analysis import AIAnalysisService
from rds_ticker_analysis.services.market_data import MarketDataService
from rds_ticker_analysis.services.reddit_sentiment import RedditSentimentService
from rds_ticker_analysis.services.scoring import ScoringService


class TickerAnalysisService:
    """
    Main ticker analysis service that orchestrates all components.
    
    This service coordinates:
    - Reddit sentiment analysis with bot detection
    - Market data enrichment via yfinance
    - Mathematical scoring and opportunity ranking
    - AI-powered qualitative analysis
    - Risk assessment and position sizing
    """
    
    def __init__(
        self,
        reddit_sentiment_service: RedditSentimentService,
        market_data_service: MarketDataService,
        scoring_service: ScoringService,
        ai_analysis_service: Optional[AIAnalysisService] = None,
    ) -> None:
        """
        Initialize the ticker analysis service.
        
        Args:
            reddit_sentiment_service: Reddit sentiment analysis service
            market_data_service: Market data service
            scoring_service: Mathematical scoring service
            ai_analysis_service: Optional AI analysis service
        """
        self.reddit_service = reddit_sentiment_service
        self.market_service = market_data_service
        self.scoring_service = scoring_service
        self.ai_service = ai_analysis_service
        
        logger.info("Initialized TickerAnalysisService")
    
    async def analyze_ticker_opportunity(
        self,
        ticker_symbol: str,
        analysis_hours: int = 24,
        include_ai_analysis: bool = True,
        volatility_squeeze_data: Optional[Dict] = None,
    ) -> Optional[TickerOpportunity]:
        """
        Perform comprehensive analysis of a ticker opportunity.
        
        Args:
            ticker_symbol: Stock ticker symbol to analyze
            analysis_hours: How many hours back to analyze Reddit data
            include_ai_analysis: Whether to include AI-powered analysis
            volatility_squeeze_data: Optional volatility squeeze signal data
            
        Returns:
            TickerOpportunity with complete analysis or None if failed
        """
        logger.info(f"Starting comprehensive analysis for {ticker_symbol}")
        
        try:
            # Step 1: Get basic ticker information and market data
            ticker_info_task = self.market_service.get_ticker_info(ticker_symbol)
            market_data_task = self.market_service.get_current_market_data(ticker_symbol)
            
            ticker_info, market_data = await asyncio.gather(
                ticker_info_task, market_data_task, return_exceptions=True
            )
            
            # Handle exceptions
            if isinstance(ticker_info, Exception):
                logger.warning(f"Failed to get ticker info for {ticker_symbol}: {ticker_info}")
                ticker_info = None
            
            if isinstance(market_data, Exception):
                logger.warning(f"Failed to get market data for {ticker_symbol}: {market_data}")
                market_data = None
            
            if not ticker_info and not market_data:
                logger.error(f"No market data available for {ticker_symbol}")
                return None
            
            # Step 2: Gather Reddit sentiment data
            reddit_mentions, sentiment_analyses = await self._gather_reddit_data(
                ticker_symbol, analysis_hours
            )
            
            if not reddit_mentions and not sentiment_analyses:
                logger.warning(f"No Reddit data found for {ticker_symbol}")
                # Continue with analysis using market data only
            
            # Step 3: Calculate aggregated Reddit metrics
            reddit_metrics = self._calculate_reddit_metrics(
                reddit_mentions, sentiment_analyses
            )
            
            # Step 4: Calculate opportunity score and risk assessment
            opportunity_score = self.scoring_service.calculate_opportunity_score(
                sentiment_analyses=sentiment_analyses,
                reddit_metrics=reddit_metrics,
                market_data=market_data,
                volatility_squeeze_data=volatility_squeeze_data,
            )
            
            risk_assessment = self.scoring_service.calculate_risk_assessment(
                sentiment_analyses=sentiment_analyses,
                reddit_metrics=reddit_metrics,
                market_data=market_data,
                opportunity_score=opportunity_score,
            )
            
            # Step 5: Generate AI insights (if requested and available)
            ai_insights = None
            if include_ai_analysis and self.ai_service:
                try:
                    ai_insights = await self.ai_service.generate_comprehensive_analysis(
                        ticker_symbol=ticker_symbol,
                        ticker_info=ticker_info,
                        market_data=market_data,
                        sentiment_analyses=sentiment_analyses,
                        reddit_mentions=reddit_mentions,
                        volatility_squeeze_data=volatility_squeeze_data,
                    )
                except Exception as e:
                    logger.warning(f"AI analysis failed for {ticker_symbol}: {e}")
            
            # Step 6: Assess data quality
            data_quality = self._assess_data_quality(
                ticker_info, market_data, reddit_mentions, sentiment_analyses
            )
            
            # Step 7: Create comprehensive ticker opportunity
            opportunity = TickerOpportunity(
                ticker_symbol=ticker_symbol,
                company_name=ticker_info.name if ticker_info else ticker_symbol,
                reddit_metrics=reddit_metrics,
                current_price=market_data.current_price if market_data else 0,
                market_cap=market_data.market_cap if market_data else None,
                daily_volume=market_data.current_volume if market_data else 0,
                opportunity_score=opportunity_score,
                risk_assessment=risk_assessment,
                ai_insights=ai_insights,
                data_quality=data_quality,
                volatility_squeeze_signal=volatility_squeeze_data,
                analysis_period_start=datetime.utcnow() - timedelta(hours=analysis_hours),
                analysis_period_end=datetime.utcnow(),
                recommended_action=self._determine_recommended_action(
                    opportunity_score, risk_assessment
                ),
                conviction_level=self._calculate_conviction_level(
                    opportunity_score, risk_assessment, data_quality
                ),
            )
            
            logger.info(f"Completed analysis for {ticker_symbol} - Grade: {opportunity_score.opportunity_grade.value}")
            return opportunity
            
        except Exception as e:
            logger.error(f"Failed to analyze ticker {ticker_symbol}: {e}")
            return None
    
    async def analyze_multiple_tickers(
        self,
        ticker_symbols: List[str],
        analysis_hours: int = 24,
        include_ai_analysis: bool = False,  # Disabled by default for batch
        max_concurrent: int = 5,
    ) -> List[TickerOpportunity]:
        """
        Analyze multiple tickers concurrently.
        
        Args:
            ticker_symbols: List of ticker symbols to analyze
            analysis_hours: How many hours back to analyze Reddit data
            include_ai_analysis: Whether to include AI analysis (expensive)
            max_concurrent: Maximum concurrent analyses
            
        Returns:
            List of TickerOpportunity objects
        """
        logger.info(f"Starting batch analysis of {len(ticker_symbols)} tickers")
        
        # Create semaphore to limit concurrency
        semaphore = asyncio.Semaphore(max_concurrent)
        
        async def analyze_single(symbol: str) -> Optional[TickerOpportunity]:
            async with semaphore:
                return await self.analyze_ticker_opportunity(
                    symbol, analysis_hours, include_ai_analysis
                )
        
        # Execute analyses concurrently
        tasks = [analyze_single(symbol) for symbol in ticker_symbols]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Filter successful results
        opportunities = []
        for result in results:
            if isinstance(result, TickerOpportunity):
                opportunities.append(result)
            elif isinstance(result, Exception):
                logger.warning(f"Batch analysis failed for ticker: {result}")
        
        # Sort by overall score
        opportunities.sort(
            key=lambda x: float(x.opportunity_score.overall_score), 
            reverse=True
        )
        
        logger.info(f"Completed batch analysis: {len(opportunities)} successful")
        return opportunities
    
    async def run_comprehensive_scan(
        self,
        subreddits: Optional[List[str]] = None,
        analysis_hours: int = 24,
        min_mentions: int = 3,
        include_ai_analysis: bool = False,
    ) -> AnalysisResult:
        """
        Run comprehensive scan across all monitored subreddits.
        
        Args:
            subreddits: Optional list of subreddits to scan (uses default if None)
            analysis_hours: How many hours back to analyze
            min_mentions: Minimum mentions required for analysis
            include_ai_analysis: Whether to include AI analysis
            
        Returns:
            AnalysisResult with complete scan results
        """
        start_time = datetime.utcnow()
        logger.info(f"Starting comprehensive scan across subreddits")
        
        try:
            # Step 1: Gather all Reddit data from subreddits
            all_sentiment_analyses = []
            subreddits_to_scan = subreddits or self.reddit_service.subreddits
            
            for subreddit in subreddits_to_scan:
                try:
                    analyses = await self.reddit_service.analyze_subreddit_activity(
                        subreddit_name=subreddit,
                        hours_back=analysis_hours,
                        limit=200,  # Reasonable limit per subreddit
                    )
                    all_sentiment_analyses.extend(analyses)
                except Exception as e:
                    logger.warning(f"Failed to analyze r/{subreddit}: {e}")
            
            # Step 2: Aggregate by ticker and filter by minimum mentions
            ticker_data = {}
            for analysis in all_sentiment_analyses:
                ticker = analysis.ticker_symbol
                if ticker not in ticker_data:
                    ticker_data[ticker] = []
                ticker_data[ticker].append(analysis)
            
            # Filter tickers with sufficient mentions
            qualified_tickers = {
                ticker: analyses 
                for ticker, analyses in ticker_data.items()
                if len(analyses) >= min_mentions
            }
            
            logger.info(f"Found {len(qualified_tickers)} tickers with >= {min_mentions} mentions")
            
            # Step 3: Analyze qualified tickers
            opportunities = await self.analyze_multiple_tickers(
                ticker_symbols=list(qualified_tickers.keys()),
                analysis_hours=analysis_hours,
                include_ai_analysis=include_ai_analysis,
                max_concurrent=10,  # Higher concurrency for scans
            )
            
            # Step 4: Calculate performance metrics
            end_time = datetime.utcnow()
            duration = (end_time - start_time).total_seconds()
            
            # Count high-grade opportunities
            high_grade_count = sum(
                1 for opp in opportunities 
                if opp.opportunity_score.opportunity_grade.value in ['S', 'A', 'B']
            )
            
            # Calculate data quality metrics
            total_posts = sum(len(analyses) for analyses in ticker_data.values())
            overall_quality = (
                sum(
                    analysis.content_quality_score 
                    for analyses in ticker_data.values() 
                    for analysis in analyses
                ) / total_posts if total_posts > 0 else 0.0
            )
            
            # Create analysis result
            analysis_result = AnalysisResult(
                analysis_run_id=f"scan_{start_time.strftime('%Y%m%d_%H%M%S')}",
                start_time=start_time,
                end_time=end_time,
                duration_seconds=int(duration),
                tickers_analyzed=list(qualified_tickers.keys()),
                subreddits_monitored=subreddits_to_scan,
                time_period_hours=analysis_hours,
                opportunities_found=len(opportunities),
                high_grade_opportunities=high_grade_count,
                top_opportunities=opportunities[:20],  # Top 20
                total_reddit_posts_analyzed=total_posts,
                total_comments_analyzed=0,  # TODO: Track separately
                unique_tickers_mentioned=len(ticker_data),
                overall_data_quality=overall_quality,
                data_completeness_pct=100.0,  # Assume complete for now
                processing_rate_posts_per_second=total_posts / duration if duration > 0 else 0,
                analysis_config={
                    'analysis_hours': analysis_hours,
                    'min_mentions': min_mentions,
                    'include_ai_analysis': include_ai_analysis,
                    'subreddits': subreddits_to_scan,
                },
            )
            
            logger.info(f"Scan complete: {len(opportunities)} opportunities, {high_grade_count} high-grade")
            return analysis_result
            
        except Exception as e:
            logger.error(f"Comprehensive scan failed: {e}")
            raise
    
    async def _gather_reddit_data(
        self,
        ticker_symbol: str,
        analysis_hours: int,
    ) -> tuple[List[TickerMention], List[SentimentAnalysis]]:
        """Gather Reddit data for a specific ticker."""
        # For now, we'll gather data from all monitored subreddits
        # In production, this could be optimized to only check subreddits
        # where the ticker was recently mentioned
        
        all_mentions = []
        all_analyses = []
        
        for subreddit in self.reddit_service.subreddits:
            try:
                analyses = await self.reddit_service.analyze_subreddit_activity(
                    subreddit_name=subreddit,
                    hours_back=analysis_hours,
                    limit=100,
                )
                
                # Filter for our specific ticker
                ticker_analyses = [
                    analysis for analysis in analyses
                    if analysis.ticker_symbol.upper() == ticker_symbol.upper()
                ]
                
                all_analyses.extend(ticker_analyses)
                
                # TODO: Extract actual TickerMention objects
                # For now, create placeholder mentions
                for analysis in ticker_analyses:
                    mention = TickerMention(
                        ticker_symbol=ticker_symbol,
                        content_type=analysis.content_type,
                        content_id=analysis.content_id,
                        subreddit=subreddit,
                        author="unknown",  # TODO: Extract from analysis
                        mention_context=analysis.analyzed_text[:200],
                        position_in_content=0,
                        confidence_score=0.8,  # TODO: Calculate properly
                        is_ticker_validated=True,
                        sentiment_confidence=analysis.sentiment.confidence,  # Add missing field
                        mentioned_at=analysis.analysis_timestamp,
                    )
                    all_mentions.append(mention)
                
            except Exception as e:
                logger.warning(f"Failed to gather data from r/{subreddit}: {e}")
        
        return all_mentions, all_analyses
    
    def _calculate_reddit_metrics(
        self,
        mentions: List[TickerMention],
        analyses: List[SentimentAnalysis],
    ) -> RedditMetrics:
        """Calculate aggregated Reddit metrics."""
        if not mentions and not analyses:
            return RedditMetrics(
                total_mentions=0,
                unique_posts=0,
                unique_comments=0,
                unique_authors=0,
                total_upvotes=0,
                total_downvotes=0,
                total_comments=0,
                average_score=0.0,
                high_quality_mentions=0,
                bot_filtered_mentions=0,
                spam_filtered_mentions=0,
                mentions_last_hour=0,
                mentions_last_day=0,
                mentions_last_week=0,
                subreddit_distribution={},
                engagement_rate=0.0,
                quality_ratio=0.0,
                momentum_score=0.0,
            )
        
        # Count mentions by type
        posts = [m for m in mentions if m.content_type == "post"]
        comments = [m for m in mentions if m.content_type == "comment"]
        
        # Get unique authors
        unique_authors = set(m.author for m in mentions if m.author)
        
        # Calculate subreddit distribution
        subreddit_dist = {}
        for mention in mentions:
            subreddit_dist[mention.subreddit] = subreddit_dist.get(mention.subreddit, 0) + 1
        
        # Calculate time-based metrics
        now = datetime.utcnow()
        mentions_1h = sum(1 for m in mentions if (now - m.mentioned_at).total_seconds() < 3600)
        mentions_24h = sum(1 for m in mentions if (now - m.mentioned_at).total_seconds() < 86400)
        mentions_7d = sum(1 for m in mentions if (now - m.mentioned_at).total_seconds() < 604800)
        
        # Quality metrics from analyses
        high_quality = sum(1 for a in analyses if a.content_quality_score > 0.7)
        avg_quality = sum(a.content_quality_score for a in analyses) / len(analyses) if analyses else 0.0
        
        # Simple momentum calculation (recent activity / total activity)
        momentum = mentions_24h / len(mentions) if mentions else 0.0
        
        return RedditMetrics(
            total_mentions=len(mentions),
            unique_posts=len(posts),
            unique_comments=len(comments),
            unique_authors=len(unique_authors),
            total_upvotes=0,  # TODO: Extract from Reddit data
            total_downvotes=0,  # TODO: Extract from Reddit data
            total_comments=0,  # TODO: Extract from Reddit data
            average_score=0.0,  # TODO: Calculate from Reddit scores
            high_quality_mentions=high_quality,
            bot_filtered_mentions=len(mentions),  # Assume all are filtered
            spam_filtered_mentions=len(mentions),  # Assume all are filtered
            mentions_last_hour=mentions_1h,
            mentions_last_day=mentions_24h,
            mentions_last_week=mentions_7d,
            subreddit_distribution=subreddit_dist,
            engagement_rate=0.0,  # TODO: Calculate engagement
            quality_ratio=avg_quality,
            momentum_score=momentum,
        )
    
    def _assess_data_quality(
        self,
        ticker_info,
        market_data,
        mentions: List[TickerMention],
        analyses: List[SentimentAnalysis],
    ) -> DataQuality:
        """Assess overall data quality for the analysis."""
        # Completeness: Do we have all expected data?
        completeness_factors = []
        if ticker_info:
            completeness_factors.append(1.0)
        else:
            completeness_factors.append(0.0)
            
        if market_data:
            completeness_factors.append(1.0)
        else:
            completeness_factors.append(0.0)
            
        if mentions:
            completeness_factors.append(1.0)
        else:
            completeness_factors.append(0.3)  # Can still analyze without Reddit data
            
        completeness_score = sum(completeness_factors) / len(completeness_factors)
        
        # Accuracy: Quality of sentiment analyses
        if analyses:
            accuracy_score = sum(a.sentiment.confidence for a in analyses) / len(analyses)
        else:
            accuracy_score = 0.5
        
        # Freshness: How recent is the data?
        if market_data:
            data_age_hours = market_data.data_age_minutes / 60
            freshness_score = max(0.0, 1.0 - (data_age_hours / 24))  # Decay over 24 hours
        else:
            freshness_score = 0.5
        
        # Consistency: Consistency of Reddit data
        if analyses and len(analyses) > 1:
            sentiment_values = [a.sentiment.confidence for a in analyses]
            consistency_score = 1.0 - (max(sentiment_values) - min(sentiment_values))
        else:
            consistency_score = 0.8
        
        # Overall quality
        overall_quality = (
            completeness_score * 0.3 +
            accuracy_score * 0.3 +
            freshness_score * 0.2 +
            consistency_score * 0.2
        )
        
        return DataQuality(
            completeness_score=completeness_score,
            accuracy_score=accuracy_score,
            freshness_score=freshness_score,
            consistency_score=consistency_score,
            overall_quality=overall_quality,
            has_missing_data=completeness_score < 0.9,
            has_outliers=False,  # TODO: Implement outlier detection
            is_stale=freshness_score < 0.5,
            quality_checks={
                'ticker_info_available': ticker_info is not None,
                'market_data_available': market_data is not None,
                'reddit_data_available': len(mentions) > 0,
                'sentiment_analyses_available': len(analyses) > 0,
            },
        )
    
    def _determine_recommended_action(self, opportunity_score, risk_assessment) -> str:
        """Determine recommended action based on scores."""
        score = float(opportunity_score.overall_score)
        risk = float(risk_assessment.overall_risk_score)
        
        if score >= 0.8 and risk <= 0.4:
            return "strong_buy"
        elif score >= 0.7 and risk <= 0.6:
            return "buy"
        elif score >= 0.6 and risk <= 0.7:
            return "weak_buy"
        elif score >= 0.5:
            return "hold"
        elif score >= 0.4:
            return "monitor"
        else:
            return "avoid"
    
    def _calculate_conviction_level(self, opportunity_score, risk_assessment, data_quality) -> float:
        """Calculate conviction level in the recommendation."""
        score_confidence = float(opportunity_score.score_confidence)
        data_reliability = float(opportunity_score.data_reliability)
        overall_quality = data_quality.overall_quality
        
        # Lower conviction if high risk
        risk_penalty = float(risk_assessment.overall_risk_score) * 0.3
        
        conviction = (
            score_confidence * 0.4 +
            data_reliability * 0.3 +
            overall_quality * 0.3 -
            risk_penalty
        )
        
        return max(0.0, min(1.0, conviction))
