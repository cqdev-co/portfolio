"""AI-powered analysis service using OpenAI for qualitative insights."""

import asyncio
import json
from datetime import datetime
from typing import Dict, List, Optional

import openai
from loguru import logger

from rds_ticker_analysis.models.analysis import AIInsights
from rds_ticker_analysis.models.market import MarketData, TickerInfo
from rds_ticker_analysis.models.reddit import TickerMention
from rds_ticker_analysis.models.sentiment import SentimentAnalysis


class AIAnalysisService:
    """
    AI-powered analysis service for generating qualitative insights.
    
    Features:
    - OpenAI GPT integration for comprehensive analysis
    - Context-aware prompting with market and Reddit data
    - Investment thesis generation
    - Risk assessment and contrarian viewpoints
    - Trading strategy recommendations
    - Structured output with confidence scoring
    """
    
    def __init__(
        self,
        openai_api_key: str,
        model: str = "gpt-4",
        max_tokens: int = 2000,
        temperature: float = 0.3,
    ) -> None:
        """
        Initialize the AI analysis service.
        
        Args:
            openai_api_key: OpenAI API key
            model: OpenAI model to use
            max_tokens: Maximum tokens per response
            temperature: Response creativity (0.0 = deterministic, 1.0 = creative)
        """
        openai.api_key = openai_api_key
        self.model = model
        self.max_tokens = max_tokens
        self.temperature = temperature
        
        # Analysis templates and prompts
        self.system_prompt = self._build_system_prompt()
        
        logger.info(f"Initialized AIAnalysisService with model {model}")
    
    async def generate_comprehensive_analysis(
        self,
        ticker_symbol: str,
        ticker_info: Optional[TickerInfo],
        market_data: Optional[MarketData],
        sentiment_analyses: List[SentimentAnalysis],
        reddit_mentions: List[TickerMention],
        volatility_squeeze_data: Optional[Dict] = None,
    ) -> Optional[AIInsights]:
        """
        Generate comprehensive AI analysis for a ticker opportunity.
        
        Args:
            ticker_symbol: Stock ticker symbol
            ticker_info: Basic ticker information
            market_data: Current market data
            sentiment_analyses: List of sentiment analysis results
            reddit_mentions: List of Reddit mentions
            volatility_squeeze_data: Optional volatility squeeze signal data
            
        Returns:
            AIInsights with comprehensive analysis or None if failed
        """
        try:
            # Build context for AI analysis
            context = self._build_analysis_context(
                ticker_symbol=ticker_symbol,
                ticker_info=ticker_info,
                market_data=market_data,
                sentiment_analyses=sentiment_analyses,
                reddit_mentions=reddit_mentions,
                volatility_squeeze_data=volatility_squeeze_data,
            )
            
            # Generate analysis prompt
            analysis_prompt = self._build_analysis_prompt(context)
            
            # Call OpenAI API
            response = await self._call_openai_api(analysis_prompt)
            
            if not response:
                return None
            
            # Parse structured response
            insights = self._parse_ai_response(response, ticker_symbol)
            
            logger.info(f"Generated AI analysis for {ticker_symbol}")
            return insights
            
        except Exception as e:
            logger.error(f"Failed to generate AI analysis for {ticker_symbol}: {e}")
            return None
    
    async def generate_quick_summary(
        self,
        ticker_symbol: str,
        key_points: List[str],
        sentiment_summary: str,
    ) -> Optional[str]:
        """
        Generate a quick summary for a ticker opportunity.
        
        Args:
            ticker_symbol: Stock ticker symbol
            key_points: List of key analysis points
            sentiment_summary: Summary of sentiment analysis
            
        Returns:
            Quick summary string or None if failed
        """
        try:
            prompt = f"""
            Generate a concise 2-3 sentence summary for {ticker_symbol} based on:
            
            Key Points:
            {chr(10).join(f"- {point}" for point in key_points)}
            
            Sentiment: {sentiment_summary}
            
            Focus on the most important investment considerations.
            """
            
            response = await self._call_openai_api(prompt, max_tokens=150)
            return response.strip() if response else None
            
        except Exception as e:
            logger.error(f"Failed to generate quick summary for {ticker_symbol}: {e}")
            return None
    
    def _build_system_prompt(self) -> str:
        """Build the system prompt for AI analysis."""
        return """
        You are an expert financial analyst specializing in Reddit-based sentiment analysis 
        and stock market opportunities. Your role is to provide comprehensive, objective 
        analysis that combines quantitative data with qualitative insights.
        
        Key responsibilities:
        1. Analyze Reddit sentiment data with appropriate skepticism
        2. Identify both bullish and bearish perspectives
        3. Consider market context and technical indicators
        4. Provide actionable investment insights
        5. Highlight risks and contrarian viewpoints
        6. Suggest appropriate trading strategies
        
        Always maintain objectivity and provide balanced analysis. Be especially cautious 
        of potential pump-and-dump schemes or manipulated sentiment.
        """
    
    def _build_analysis_context(
        self,
        ticker_symbol: str,
        ticker_info: Optional[TickerInfo],
        market_data: Optional[MarketData],
        sentiment_analyses: List[SentimentAnalysis],
        reddit_mentions: List[TickerMention],
        volatility_squeeze_data: Optional[Dict],
    ) -> Dict:
        """Build comprehensive context for AI analysis."""
        context = {
            "ticker_symbol": ticker_symbol,
            "analysis_timestamp": datetime.utcnow().isoformat(),
        }
        
        # Add ticker information
        if ticker_info:
            context["company_info"] = {
                "name": ticker_info.name,
                "sector": ticker_info.sector.value if ticker_info.sector else None,
                "industry": ticker_info.industry,
                "market_cap": float(ticker_info.market_cap) if ticker_info.market_cap else None,
                "pe_ratio": float(ticker_info.pe_ratio) if ticker_info.pe_ratio else None,
                "beta": float(ticker_info.beta) if ticker_info.beta else None,
            }
        
        # Add market data
        if market_data:
            context["market_data"] = {
                "current_price": float(market_data.current_price),
                "price_change": float(market_data.price_change),
                "price_change_pct": float(market_data.price_change_pct),
                "volume": market_data.current_volume,
                "average_volume": market_data.average_volume,
                "volume_ratio": market_data.current_volume / market_data.average_volume if market_data.average_volume else 1.0,
            }
            
            # Add technical indicators if available
            if market_data.technical_indicators:
                tech = market_data.technical_indicators
                context["technical_indicators"] = {
                    "rsi_14": float(tech.rsi_14) if tech.rsi_14 else None,
                    "bb_percent": float(tech.bb_percent) if tech.bb_percent else None,
                    "trend_direction": tech.trend_direction.value if tech.trend_direction else None,
                    "trend_strength": float(tech.trend_strength) if tech.trend_strength else None,
                }
        
        # Add Reddit sentiment summary
        if sentiment_analyses:
            sentiment_summary = self._summarize_sentiment_analyses(sentiment_analyses)
            context["reddit_sentiment"] = sentiment_summary
        
        # Add mention statistics
        if reddit_mentions:
            mention_stats = self._summarize_reddit_mentions(reddit_mentions)
            context["reddit_mentions"] = mention_stats
        
        # Add volatility squeeze data
        if volatility_squeeze_data:
            context["volatility_squeeze"] = {
                "is_squeeze": volatility_squeeze_data.get("is_squeeze", False),
                "bb_width_percentile": volatility_squeeze_data.get("bb_width_percentile", 0),
                "signal_strength": volatility_squeeze_data.get("signal_strength", 0),
            }
        
        return context
    
    def _build_analysis_prompt(self, context: Dict) -> str:
        """Build the analysis prompt with context."""
        prompt = f"""
        Analyze the following stock opportunity and provide comprehensive insights:
        
        TICKER: {context['ticker_symbol']}
        TIMESTAMP: {context['analysis_timestamp']}
        
        COMPANY INFORMATION:
        {json.dumps(context.get('company_info', {}), indent=2)}
        
        MARKET DATA:
        {json.dumps(context.get('market_data', {}), indent=2)}
        
        TECHNICAL INDICATORS:
        {json.dumps(context.get('technical_indicators', {}), indent=2)}
        
        REDDIT SENTIMENT ANALYSIS:
        {json.dumps(context.get('reddit_sentiment', {}), indent=2)}
        
        REDDIT MENTION STATISTICS:
        {json.dumps(context.get('reddit_mentions', {}), indent=2)}
        
        VOLATILITY SQUEEZE DATA:
        {json.dumps(context.get('volatility_squeeze', {}), indent=2)}
        
        Please provide a comprehensive analysis in the following JSON format:
        
        {{
            "executive_summary": "Brief 2-3 sentence overview of the opportunity",
            "key_bullish_points": ["List of main bullish arguments"],
            "key_bearish_points": ["List of main bearish arguments"],
            "market_context_analysis": "Analysis of current market context and sector trends",
            "sector_analysis": "Sector-specific analysis if relevant",
            "sentiment_summary": "Summary of Reddit sentiment analysis findings",
            "unusual_activity_notes": ["Notes on any unusual Reddit activity patterns"],
            "investment_thesis": "Detailed investment thesis based on all available data",
            "catalyst_identification": ["List of potential upcoming catalysts"],
            "risk_analysis": "Comprehensive risk assessment",
            "contrarian_viewpoints": ["Alternative perspectives to consider"],
            "trading_strategy_suggestions": ["Specific trading strategy recommendations"],
            "timeline_expectations": "Expected timeline for opportunity development",
            "analysis_confidence": 0.85
        }}
        
        Ensure your analysis is:
        1. Objective and balanced
        2. Considers both quantitative and qualitative factors
        3. Acknowledges limitations and uncertainties
        4. Provides actionable insights
        5. Highlights key risks and mitigation strategies
        """
        
        return prompt
    
    async def _call_openai_api(
        self,
        prompt: str,
        max_tokens: Optional[int] = None,
        temperature: Optional[float] = None,
    ) -> Optional[str]:
        """Call OpenAI API with error handling and retries."""
        max_tokens = max_tokens or self.max_tokens
        temperature = temperature or self.temperature
        
        try:
            from openai import AsyncOpenAI
            client = AsyncOpenAI(api_key=openai.api_key)
            
            response = await client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": self.system_prompt},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=max_tokens,
                temperature=temperature,
                timeout=30,
            )
            
            return response.choices[0].message.content.strip()
            
        except Exception as e:
            if "rate_limit" in str(e).lower():
                logger.warning("OpenAI rate limit hit, waiting before retry...")
                await asyncio.sleep(60)
                return None
            else:
                logger.error(f"OpenAI API error: {e}")
                return None
    
    def _parse_ai_response(self, response: str, ticker_symbol: str) -> AIInsights:
        """Parse AI response into structured AIInsights object."""
        try:
            # Try to parse as JSON
            data = json.loads(response)
            
            return AIInsights(
                executive_summary=data.get("executive_summary", ""),
                key_bullish_points=data.get("key_bullish_points", []),
                key_bearish_points=data.get("key_bearish_points", []),
                market_context_analysis=data.get("market_context_analysis", ""),
                sector_analysis=data.get("sector_analysis"),
                sentiment_summary=data.get("sentiment_summary", ""),
                unusual_activity_notes=data.get("unusual_activity_notes", []),
                investment_thesis=data.get("investment_thesis", ""),
                catalyst_identification=data.get("catalyst_identification", []),
                risk_analysis=data.get("risk_analysis", ""),
                contrarian_viewpoints=data.get("contrarian_viewpoints", []),
                trading_strategy_suggestions=data.get("trading_strategy_suggestions", []),
                timeline_expectations=data.get("timeline_expectations", ""),
                analysis_confidence=data.get("analysis_confidence", 0.5),
                model_version=self.model,
            )
            
        except json.JSONDecodeError:
            logger.warning(f"Failed to parse AI response as JSON for {ticker_symbol}")
            
            # Fallback: create basic insights from raw text
            return AIInsights(
                executive_summary=response[:500] + "..." if len(response) > 500 else response,
                key_bullish_points=["AI analysis available in executive summary"],
                key_bearish_points=["See executive summary for details"],
                market_context_analysis="Raw AI response - parsing failed",
                sentiment_summary="Analysis included in executive summary",
                investment_thesis=response,
                risk_analysis="See executive summary",
                trading_strategy_suggestions=["Review full analysis for recommendations"],
                timeline_expectations="Not specified",
                analysis_confidence=0.3,  # Lower confidence due to parsing failure
                model_version=self.model,
            )
    
    def _summarize_sentiment_analyses(self, sentiment_analyses: List[SentimentAnalysis]) -> Dict:
        """Summarize sentiment analysis data for AI context."""
        if not sentiment_analyses:
            return {}
        
        # Calculate aggregate metrics
        total_analyses = len(sentiment_analyses)
        
        # Sentiment distribution
        sentiment_counts = {}
        total_confidence = 0
        total_quality = 0
        
        for analysis in sentiment_analyses:
            label = analysis.sentiment.label.value
            sentiment_counts[label] = sentiment_counts.get(label, 0) + 1
            total_confidence += analysis.sentiment.confidence
            total_quality += analysis.content_quality_score
        
        # Calculate averages
        avg_confidence = total_confidence / total_analyses
        avg_quality = total_quality / total_analyses
        
        # Most common sentiment
        most_common_sentiment = max(sentiment_counts, key=sentiment_counts.get)
        
        return {
            "total_analyses": total_analyses,
            "sentiment_distribution": sentiment_counts,
            "most_common_sentiment": most_common_sentiment,
            "average_confidence": round(avg_confidence, 3),
            "average_quality_score": round(avg_quality, 3),
            "high_quality_analyses": sum(1 for a in sentiment_analyses if a.content_quality_score > 0.7),
        }
    
    def _summarize_reddit_mentions(self, reddit_mentions: List[TickerMention]) -> Dict:
        """Summarize Reddit mention data for AI context."""
        if not reddit_mentions:
            return {}
        
        # Subreddit distribution
        subreddit_counts = {}
        total_confidence = 0
        
        for mention in reddit_mentions:
            subreddit = mention.subreddit
            subreddit_counts[subreddit] = subreddit_counts.get(subreddit, 0) + 1
            total_confidence += mention.confidence_score
        
        # Calculate metrics
        total_mentions = len(reddit_mentions)
        avg_confidence = total_confidence / total_mentions
        
        # Most active subreddit
        most_active_subreddit = max(subreddit_counts, key=subreddit_counts.get)
        
        return {
            "total_mentions": total_mentions,
            "subreddit_distribution": subreddit_counts,
            "most_active_subreddit": most_active_subreddit,
            "average_confidence": round(avg_confidence, 3),
            "validated_mentions": sum(1 for m in reddit_mentions if m.is_ticker_validated),
        }
