"""
Main processing pipeline for Reddit data enrichment.
Coordinates ticker extraction, sentiment analysis, and other processing steps.
"""

import asyncio
import json
import logging
import re
from datetime import datetime
from typing import List, Dict, Optional

from ..config.settings import get_settings
from ..storage.simple_storage import get_admin_simple_storage_client
from ..ingest.simple_models import RDSDataSource
from .ticker_extractor import TickerExtractor
from .market_enricher import MarketDataEnricher

logger = logging.getLogger(__name__)


class RedditProcessor:
    """
    Main processor that orchestrates all data enrichment steps.
    """
    
    def __init__(self):
        self.settings = get_settings()
        self.storage = get_admin_simple_storage_client()
        self.ticker_extractor = TickerExtractor()
        self.market_enricher = MarketDataEnricher()
        
    async def process_pending_posts(self, limit: int = 100) -> Dict:
        """
        Process posts that are in 'pending' status.
        
        Args:
            limit: Maximum number of posts to process in this batch
            
        Returns:
            Dictionary with processing statistics
        """
        logger.info(f"Starting to process up to {limit} pending posts...")
        
        # Get pending posts from database
        pending_posts = await self._get_pending_posts(limit)
        if not pending_posts:
            logger.info("No pending posts found to process")
            return {"processed": 0, "errors": 0, "skipped": 0, "total_found": 0}
        
        logger.info(f"Found {len(pending_posts)} pending posts to process")
        
        processed_count = 0
        error_count = 0
        skipped_count = 0
        
        for post_data in pending_posts:
            try:
                # Parse JSON fields from database strings
                if isinstance(post_data.get('tickers'), str):
                    post_data['tickers'] = json.loads(post_data['tickers'])
                if isinstance(post_data.get('claims'), str):
                    post_data['claims'] = json.loads(post_data['claims'])
                if isinstance(post_data.get('numeric_data'), str):
                    post_data['numeric_data'] = json.loads(post_data['numeric_data'])
                if isinstance(post_data.get('market_data'), str):
                    post_data['market_data'] = json.loads(post_data['market_data'])
                
                # Convert dict to RDSDataSource model
                post = RDSDataSource(**post_data)
                
                # Process the post
                updated_post = await self.process_single_post(post)
                
                if updated_post:
                    # Update in database
                    await self._update_post_in_db(updated_post)
                    processed_count += 1
                    
                    if processed_count % 10 == 0:
                        logger.info(f"Processed {processed_count}/{len(pending_posts)} posts...")
                else:
                    skipped_count += 1
                    
            except Exception as e:
                logger.error(f"Error processing post {post_data.get('post_id', 'unknown')}: {e}")
                error_count += 1
                continue
        
        logger.info(f"Processing complete: {processed_count} processed, {error_count} errors, {skipped_count} skipped")
        
        return {
            "processed": processed_count,
            "errors": error_count,
            "skipped": skipped_count,
            "total_found": len(pending_posts)
        }
    
    async def process_single_post(self, post: RDSDataSource) -> Optional[RDSDataSource]:
        """
        Process a single post through all enrichment steps.
        
        Args:
            post: The post to process
            
        Returns:
            Updated post with enriched data, or None if processing failed
        """
        try:
            logger.debug(f"Processing post {post.post_id} from r/{post.subreddit}")
            
            # Step 1: Extract tickers
            tickers = await self._extract_tickers(post)
            
            # Step 2: Analyze sentiment (placeholder for now)
            sentiment = await self._analyze_sentiment(post)
            
            # Step 3: Extract claims and numeric data (placeholder for now)
            claims, numeric_data = await self._extract_claims(post)
            
            # Step 4: Add market data enrichment
            if tickers:
                post_dict = post.model_dump()
                post_dict['tickers'] = tickers
                enriched_data = await self.market_enricher.enrich_post_with_market_data(post_dict)
                
                # Update with validated tickers and market data
                tickers = enriched_data.get('tickers', tickers)
                market_data = enriched_data.get('market_data', {})
                market_context = enriched_data.get('market_context', {})
            else:
                market_data = {}
                market_context = {}
            
            # Step 5: Determine quality tier (after market validation)
            quality_tier = await self._determine_quality(post, tickers, sentiment, market_context)
            
            # Update the post with extracted data
            post.tickers = tickers
            post.sentiment = sentiment
            post.claims = claims
            post.numeric_data = numeric_data
            post.market_data = market_data
            post.quality_tier = quality_tier
            post.processing_status = "completed"
            post.processed_at = datetime.utcnow()
            # updated_at will be handled by the database trigger
            
            # Calculate confidence score
            post.confidence_score = self._calculate_overall_confidence(post)
            
            logger.debug(f"Processed post {post.post_id}: {len(tickers)} tickers, sentiment={sentiment}, quality={quality_tier}")
            
            return post
            
        except Exception as e:
            logger.error(f"Error processing post {post.post_id}: {e}")
            
            # Mark as failed
            post.processing_status = "failed"
            post.error_message = str(e)
            post.processed_at = datetime.utcnow()
            # updated_at will be handled by the database trigger
            
            return post
    
    async def _extract_tickers(self, post: RDSDataSource) -> List[str]:
        """Extract ticker symbols from post content with enhanced confidence filtering."""
        try:
            # Use the enhanced ticker extractor with full TickerMatch objects
            matches = self.ticker_extractor.extract_tickers(post.selftext or "", post.title)
            
            # Filter by confidence and return only high-confidence tickers
            high_confidence_tickers = [
                match.symbol for match in matches 
                if match.confidence >= 0.6  # Higher threshold for cleaner results
            ]
            
            logger.debug(f"Post {post.post_id}: Found {len(matches)} total matches, {len(high_confidence_tickers)} high-confidence tickers: {high_confidence_tickers}")
            return high_confidence_tickers
            
        except Exception as e:
            logger.error(f"Error extracting tickers from post {post.post_id}: {e}")
            return []
    
    async def _analyze_sentiment(self, post: RDSDataSource) -> Optional[str]:
        """Enhanced sentiment analysis with context awareness and post type detection."""
        try:
            title_lower = post.title.lower()
            text_lower = post.selftext.lower() if post.selftext else ""
            combined_text = f"{title_lower} {text_lower}"
            
            # Question/Educational post detection (should be neutral)
            question_indicators = [
                'what are your', 'thoughts?', 'opinions?', 'advice?', 'help', 'question',
                'new to', 'beginner', 'first trade', 'how to', 'should i', 'what should',
                'anyone else', 'does anyone', 'looking for advice', 'need help'
            ]
            
            if any(indicator in combined_text for indicator in question_indicators):
                return "neutral"
            
            # Celebration/Achievement posts (usually bullish)
            celebration_indicators = [
                'hits', 'reached', 'breaks', 'new high', 'ath', 'milestone', 'record',
                'finally', 'made it', 'achieved', 'success', 'won', 'victory', 'gainz', 'gains'
            ]
            
            celebration_score = sum(1 for indicator in celebration_indicators if indicator in combined_text)
            
            # Strong bullish indicators with weights
            strong_bull_patterns = [
                ('moon', 3), ('rocket', 2), ('🚀', 3), ('to the moon', 3),
                ('diamond hands', 2), ('hodl', 2), ('yolo', 2), ('all in', 2),
                ('squeeze', 2), ('gamma squeeze', 3), ('short squeeze', 3),
                ('massive gains', 2), ('huge potential', 2), ('undervalued', 2),
                ('buy the dip', 2), ('loading up', 2), ('accumulating', 2),
                ('bull run', 2), ('breakout', 2), ('tendies', 2)
            ]
            
            # Strong bearish indicators with weights
            strong_bear_patterns = [
                ('puts', 2), ('short', 1), ('crash', 3), ('dump', 2), ('bubble', 2),
                ('overvalued', 2), ('sell off', 2), ('bearish', 2), ('recession', 2),
                ('correction', 2), ('bag holder', 2), ('rekt', 2), ('drill', 2),
                ('tank', 2), ('collapse', 3), ('dead cat bounce', 3)
            ]
            
            # Moderate indicators
            moderate_bull_patterns = [
                ('buy', 1), ('long', 1), ('bullish', 1), ('gain', 1), ('profit', 1),
                ('green', 1), ('up', 1), ('rally', 1), ('surge', 1), ('climb', 1),
                ('beat earnings', 2), ('good news', 1), ('upgrade', 1)
            ]
            
            moderate_bear_patterns = [
                ('sell', 1), ('down', 1), ('red', 1), ('loss', 1), ('drop', 1),
                ('fall', 1), ('decline', 1), ('weak', 1), ('miss earnings', 2),
                ('bad news', 1), ('downgrade', 1), ('concern', 1)
            ]
            
            # Calculate weighted scores
            bull_score = celebration_score * 2  # Celebration bonus
            bear_score = 0
            
            for pattern, weight in strong_bull_patterns:
                bull_score += combined_text.count(pattern) * weight
            
            for pattern, weight in moderate_bull_patterns:
                bull_score += combined_text.count(pattern) * weight
            
            for pattern, weight in strong_bear_patterns:
                bear_score += combined_text.count(pattern) * weight
            
            for pattern, weight in moderate_bear_patterns:
                bear_score += combined_text.count(pattern) * weight
            
            # Flair-based sentiment hints
            if post.flair:
                flair_lower = post.flair.lower()
                if flair_lower in ['gain', 'gains', 'yolo', 'dd']:
                    bull_score += 1
                elif flair_lower in ['loss', 'losses']:
                    bear_score += 1
            
            # Price movement context
            if any(word in combined_text for word in ['%', 'percent', 'up', 'gained']):
                if any(word in combined_text for word in ['up ', 'gained', 'rose', 'climbed']):
                    bull_score += 1
                elif any(word in combined_text for word in ['down ', 'lost', 'fell', 'dropped']):
                    bear_score += 1
            
            # Determine sentiment with improved thresholds
            score_diff = bull_score - bear_score
            total_score = bull_score + bear_score
            
            if total_score == 0:
                return "neutral"
            
            # Require stronger signal for classification
            if score_diff >= 2 and bull_score >= 2:
                return "bull"
            elif score_diff <= -2 and bear_score >= 2:
                return "bear"
            else:
                return "neutral"
                
        except Exception as e:
            logger.error(f"Error analyzing sentiment for post {post.post_id}: {e}")
            return "neutral"
    
    async def _extract_claims(self, post: RDSDataSource) -> tuple[List[str], Dict]:
        """Extract claims and numeric data. Placeholder implementation."""
        try:
            claims = []
            numeric_data = {}
            
            text = f"{post.title} {post.selftext}"
            
            # Simple price target extraction
            import re
            price_patterns = [
                r'\$(\d+(?:\.\d+)?)',  # $123.45
                r'(\d+(?:\.\d+)?)\s*(?:dollars?|usd|\$)',  # 123.45 dollars
                r'target.*?(\d+(?:\.\d+)?)',  # target 150
                r'(\d+(?:\.\d+)?).*?target'   # 150 target
            ]
            
            for pattern in price_patterns:
                matches = re.findall(pattern, text.lower())
                if matches:
                    try:
                        prices = [float(match) for match in matches if float(match) > 1]
                        if prices:
                            numeric_data['price_targets'] = prices
                            claims.append(f"Price targets mentioned: {', '.join(map(str, prices))}")
                    except ValueError:
                        continue
            
            # Extract percentage moves
            pct_pattern = r'(\d+(?:\.\d+)?)%'
            pct_matches = re.findall(pct_pattern, text)
            if pct_matches:
                try:
                    percentages = [float(match) for match in pct_matches if 0 < float(match) < 1000]
                    if percentages:
                        numeric_data['percentages'] = percentages
                except ValueError:
                    pass
            
            return claims, numeric_data
            
        except Exception as e:
            logger.error(f"Error extracting claims from post {post.post_id}: {e}")
            return [], {}
    
    async def _determine_quality(self, post: RDSDataSource, tickers: List[str], sentiment: Optional[str], market_context: Dict = None) -> str:
        """Aggressive quality filtering with high standards for data cleanliness."""
        try:
            score = 0
            
            # STRICT: Must have valid tickers to be considered valuable
            if not tickers:
                return "unprocessed"  # No tickers = low value
            
            # Ticker quality scoring
            if len(tickers) >= 3:
                score += 4  # Multiple tickers indicate broader analysis
            elif len(tickers) == 2:
                score += 2
            else:
                score += 1
            
            # Content depth requirements (MUCH STRICTER)
            text_length = len(post.selftext) if post.selftext else 0
            if text_length > 500:  # Substantial analysis
                score += 4
            elif text_length > 200:  # Medium analysis
                score += 2
            elif text_length > 100:  # Basic analysis
                score += 1
            else:
                score -= 2  # Penalize short/empty posts
            
            # Engagement requirements (HIGHER THRESHOLDS)
            if post.score >= 10:
                score += 3
            elif post.score >= 5:
                score += 2
            elif post.score >= 1:
                score += 1
            else:
                score -= 1  # Penalize posts with no/negative engagement
            
            if post.num_comments >= 10:
                score += 3
            elif post.num_comments >= 5:
                score += 2
            elif post.num_comments >= 1:
                score += 1
            
            # Sentiment clarity bonus
            if sentiment and sentiment != "neutral":
                score += 2  # Clear sentiment indicates actionable content
            else:
                score -= 1  # Neutral sentiment often means low-value posts
            
            # Market data validation bonus
            if market_context and market_context.get('market_data'):
                score += 2  # Validated tickers are higher quality
            
            # STRICT Flair-based filtering
            if post.flair:
                flair_lower = post.flair.lower()
                
                # High-value content
                if any(flair in flair_lower for flair in ['dd', 'analysis', 'news', 'earnings', 'technical']):
                    score += 4
                # Medium-value content
                elif any(flair in flair_lower for flair in ['discussion', 'yolo', 'gain']):
                    score += 1
                # Low-value content (AGGRESSIVE FILTERING)
                elif any(flair in flair_lower for flair in ['meme', 'shitpost', 'fluff']):
                    return "unprocessed"  # Immediately filter out memes
                # Question posts (often low actionable value)
                elif 'question' in flair_lower:
                    score -= 2
            
            # Subreddit quality requirements
            subreddit_lower = post.subreddit.lower()
            
            # High-quality subs get bonus
            if subreddit_lower in ['investing', 'securityanalysis', 'valueinvesting', 'financialindependence']:
                score += 3
            # Standard subs
            elif subreddit_lower in ['stocks', 'stockmarket', 'options']:
                score += 1
            # Penny stocks (higher risk, lower base quality)
            elif subreddit_lower in ['pennystocks']:
                score -= 1
            # Meme subs (much stricter requirements)
            elif subreddit_lower in ['wallstreetbets']:
                score -= 2
                # WSB posts need exceptional engagement to be valuable
                if post.score < 20:
                    return "unprocessed"
            
            # FILTER OUT common low-value patterns
            combined_text = f"{post.title} {post.selftext or ''}".lower()
            
            # Red flags that indicate low-value posts
            red_flags = [
                'first trade', 'new to trading', 'beginner question', 'help me',
                'what should i', 'thoughts?', 'opinions?', 'am i doing this right',
                'is this good', 'rate my portfolio', 'roast my', 'simple question'
            ]
            
            if any(flag in combined_text for flag in red_flags):
                return "unprocessed"  # Filter out beginner/question posts
            
            # MUCH HIGHER quality thresholds
            if score >= 12:
                return "valuable"      # Only exceptional posts
            elif score >= 8:
                return "soft_quarantine"  # Good posts with some value
            elif score >= 4:
                return "quarantine"    # Marginal posts
            else:
                return "unprocessed"   # Low-value posts filtered out
                
        except Exception as e:
            logger.error(f"Error determining quality for post {post.post_id}: {e}")
            return "unprocessed"
    
    def _calculate_overall_confidence(self, post: RDSDataSource) -> float:
        """Calculate overall confidence score for the post."""
        try:
            confidence = 0.0
            
            # Base confidence from tickers
            if post.tickers:
                confidence += 0.3 * min(len(post.tickers) / 3.0, 1.0)
            
            # Confidence from sentiment
            if post.sentiment and post.sentiment != "neutral":
                confidence += 0.2
            
            # Confidence from claims
            if post.claims:
                confidence += 0.2 * min(len(post.claims) / 2.0, 1.0)
            
            # Confidence from numeric data
            if post.numeric_data:
                confidence += 0.1
            
            # Confidence from engagement
            engagement_score = (post.score + post.num_comments) / 100.0
            confidence += min(engagement_score * 0.2, 0.2)
            
            return min(confidence, 1.0)
            
        except Exception as e:
            logger.error(f"Error calculating confidence for post {post.post_id}: {e}")
            return 0.0
    
    async def _get_pending_posts(self, limit: int) -> List[Dict]:
        """Get pending posts from database."""
        try:
            # Use raw SQL query since supabase-py doesn't have great ORM features
            response = await asyncio.to_thread(
                lambda: self.storage.table.select("*")
                .eq("processing_status", "pending")
                .limit(limit)
                .execute()
            )
            
            if response.data:
                logger.info(f"Retrieved {len(response.data)} pending posts from database")
                return response.data
            else:
                return []
                
        except Exception as e:
            logger.error(f"Error getting pending posts: {e}")
            return []
    
    async def _update_post_in_db(self, post: RDSDataSource) -> bool:
        """Update a processed post in the database."""
        try:
            # Convert to dict for database update
            update_data = {
                "tickers": json.dumps(post.tickers),
                "sentiment": post.sentiment,
                "claims": json.dumps(post.claims),
                "numeric_data": json.dumps(post.numeric_data),
                "quality_tier": post.quality_tier,
                "confidence_score": post.confidence_score,
                "processing_status": post.processing_status,
                "processed_at": post.processed_at.isoformat() if post.processed_at else None,
                "error_message": post.error_message,
                "updated_at": datetime.utcnow().isoformat()
            }
            
            response = await asyncio.to_thread(
                lambda: self.storage.table.update(update_data)
                .eq("post_id", post.post_id)
                .execute()
            )
            
            if response.data:
                logger.debug(f"Updated post {post.post_id} in database")
                return True
            else:
                logger.warning(f"No rows updated for post {post.post_id}")
                return False
                
        except Exception as e:
            logger.error(f"Error updating post {post.post_id} in database: {e}")
            return False
