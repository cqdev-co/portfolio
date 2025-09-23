"""Simplified storage client for the single table RDS approach."""

import asyncio
import json
import logging
from datetime import datetime
from typing import Dict, Any, List, Optional

from supabase import create_client, Client, ClientOptions
from postgrest.exceptions import APIError as PostgrestAPIError

from ..config.settings import get_settings
from ..ingest.simple_models import RDSDataSource, convert_post_core_to_rds

logger = logging.getLogger(__name__)


class SimpleSupabaseStorage:
    """
    Simplified storage client for the single table RDS approach.
    """

    def __init__(self, use_service_key: bool = False):
        settings = get_settings()
        key = (
            settings.supabase.service_key
            if use_service_key and settings.supabase.service_key
            else settings.supabase.key
        )

        # Configure client options for production use
        options = ClientOptions(
            auto_refresh_token=True,
            persist_session=True,
            headers={"x-application-name": "reddit-source"}
        )

        self.client: Client = create_client(
            settings.supabase.url,
            key,
            options=options
        )
        self.table = self.client.from_("rds_data_source")

    async def health_check(self) -> bool:
        """Check if the database connection is working."""
        try:
            # Simple health check - just try to select from the table
            response = await asyncio.to_thread(
                lambda: self.table.select("post_id").limit(1).execute()
            )
            # Table exists and is accessible if we get a response (even if empty)
            return True
        except Exception as e:
            logger.error(f"Health check failed: {e}")
            return False

    async def insert_post(self, post_data) -> bool:
        """
        Insert a single post into the database.
        Accepts either PostCore or RDSDataSource models.
        """
        try:
            # Convert PostCore to RDSDataSource if needed
            if hasattr(post_data, 'post_id') and not isinstance(post_data, RDSDataSource):
                rds_data = convert_post_core_to_rds(post_data)
            else:
                rds_data = post_data

            # Prepare data for insertion
            insert_data = {
                "post_id": rds_data.post_id,
                "subreddit": rds_data.subreddit,
                "author": rds_data.author,
                "created_utc": rds_data.created_utc,
                "created_datetime": rds_data.created_datetime.isoformat() if rds_data.created_datetime else None,
                "title": rds_data.title,
                "selftext": rds_data.selftext,
                "permalink": rds_data.permalink,
                "url": rds_data.url,
                "score": rds_data.score,
                "upvote_ratio": rds_data.upvote_ratio,
                "num_comments": rds_data.num_comments,
                "flair": rds_data.flair,
                "is_image": rds_data.is_image,
                "is_video": rds_data.is_video,
                "is_self": rds_data.is_self,
                "image_path": rds_data.image_path,
                "tickers": json.dumps(rds_data.tickers),
                "sentiment": rds_data.sentiment,
                "horizon": rds_data.horizon,
                "claims": json.dumps(rds_data.claims),
                "numeric_data": json.dumps(rds_data.numeric_data),
                "image_type": rds_data.image_type,
                "ocr_text": rds_data.ocr_text,
                "confidence_score": rds_data.confidence_score,
                "quality_tier": rds_data.quality_tier,
                "market_data": json.dumps(rds_data.market_data),
                "processed_at": rds_data.processed_at.isoformat() if rds_data.processed_at else None,
                "processing_status": rds_data.processing_status,
                "error_message": rds_data.error_message
            }

            # Insert into database
            response = await asyncio.to_thread(
                lambda: self.table.insert(insert_data).execute()
            )
            
            if response.data:
                logger.info(f"Successfully inserted post: {rds_data.post_id}")
                return True
            else:
                logger.error(f"Failed to insert post {rds_data.post_id}: No data returned")
                return False

        except PostgrestAPIError as e:
            if "duplicate key value violates unique constraint" in str(e):
                logger.info(f"Post {rds_data.post_id} already exists, skipping")
                return True  # Consider duplicate as success
            else:
                logger.error(f"Database error inserting post {rds_data.post_id}: {e}")
                return False
        except Exception as e:
            logger.error(f"Unexpected error inserting post {rds_data.post_id}: {e}")
            return False

    async def insert_posts_batch(self, posts: List) -> int:
        """Insert multiple posts in batch."""
        success_count = 0
        
        for post in posts:
            if await self.insert_post(post):
                success_count += 1
        
        return success_count
    
    async def update_post(self, post: 'RDSDataSource') -> bool:
        """
        Update an existing post in the database.
        
        Args:
            post: RDSDataSource model instance to update
            
        Returns:
            True if successful, False otherwise
        """
        try:
            # Convert model to dict for update
            update_data = post.model_dump(exclude={'id'})  # Exclude id from update
            
            # Convert lists/dicts to JSON strings for database storage
            if isinstance(update_data.get('tickers'), list):
                update_data['tickers'] = json.dumps(update_data['tickers'])
            if isinstance(update_data.get('claims'), list):
                update_data['claims'] = json.dumps(update_data['claims'])
            if isinstance(update_data.get('numeric_data'), dict):
                update_data['numeric_data'] = json.dumps(update_data['numeric_data'])
            if isinstance(update_data.get('market_data'), dict):
                update_data['market_data'] = json.dumps(update_data['market_data'])
            
            # Update the post by post_id
            response = await asyncio.to_thread(
                lambda: self.table.update(update_data)
                .eq('post_id', post.post_id)
                .execute()
            )
            
            logger.debug(f"Updated post {post.post_id} in database")
            return True
            
        except Exception as e:
            logger.error(f"Error updating post {post.post_id}: {e}")
            return False

    async def get_post(self, post_id: str) -> Optional[Dict[str, Any]]:
        """Get a single post by ID."""
        try:
            response = await asyncio.to_thread(
                lambda: self.table.select("*").eq("post_id", post_id).execute()
            )
            
            if response.data and len(response.data) > 0:
                return response.data[0]
            return None
            
        except Exception as e:
            logger.error(f"Error fetching post {post_id}: {e}")
            return None

    async def get_posts_by_subreddit(
        self, 
        subreddit: str, 
        limit: int = 100,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """Get posts from a specific subreddit."""
        try:
            response = await asyncio.to_thread(
                lambda: self.table
                .select("*")
                .eq("subreddit", subreddit)
                .order("created_datetime", desc=True)
                .range(offset, offset + limit - 1)
                .execute()
            )
            
            return response.data or []
            
        except Exception as e:
            logger.error(f"Error fetching posts from r/{subreddit}: {e}")
            return []

    async def get_recent_posts(self, hours: int = 24) -> List[Dict[str, Any]]:
        """Get posts from the last N hours."""
        try:
            from datetime import datetime, timedelta
            cutoff = datetime.utcnow() - timedelta(hours=hours)
            
            response = await asyncio.to_thread(
                lambda: self.table
                .select("*")
                .gte("created_datetime", cutoff.isoformat())
                .order("created_datetime", desc=True)
                .execute()
            )
            
            return response.data or []
            
        except Exception as e:
            logger.error(f"Error fetching recent posts: {e}")
            return []

    async def update_post_processing_status(
        self, 
        post_id: str, 
        status: str, 
        error_message: Optional[str] = None
    ) -> bool:
        """Update the processing status of a post."""
        try:
            update_data = {
                "processing_status": status,
                "error_message": error_message
            }
            
            if status == "completed":
                update_data["processed_at"] = datetime.utcnow().isoformat()
            
            response = await asyncio.to_thread(
                lambda: self.table
                .update(update_data)
                .eq("post_id", post_id)
                .execute()
            )
            
            return response.data is not None
            
        except Exception as e:
            logger.error(f"Error updating post {post_id} status: {e}")
            return False

    async def get_stats(self) -> Dict[str, Any]:
        """Get basic statistics about the data."""
        try:
            # Total posts
            total_response = await asyncio.to_thread(
                lambda: self.table.select("count()").execute()
            )
            
            # Posts by subreddit
            subreddit_response = await asyncio.to_thread(
                lambda: self.table
                .select("subreddit, count()")
                .group_by("subreddit")
                .execute()
            )
            
            # Posts with tickers
            ticker_response = await asyncio.to_thread(
                lambda: self.table
                .select("count()")
                .neq("tickers", "[]")
                .execute()
            )
            
            return {
                "total_posts": total_response.data[0]["count"] if total_response.data else 0,
                "posts_by_subreddit": subreddit_response.data or [],
                "posts_with_tickers": ticker_response.data[0]["count"] if ticker_response.data else 0
            }
            
        except Exception as e:
            logger.error(f"Error getting stats: {e}")
            return {}

    async def get_high_quality_posts(
        self,
        min_confidence: float = 0.5,
        quality_tiers: Optional[List[str]] = None,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """
        Fetches high-quality posts that passed all filtering criteria.
        """
        try:
            query = self.table.select("*").eq("processing_status", "completed")
            
            # Filter by minimum confidence
            query = query.gte("confidence_score", min_confidence)
            
            # Filter by quality tiers
            if quality_tiers:
                query = query.filter("quality_tier", "in", tuple(quality_tiers))
            else:
                # Default to high-quality tiers only
                query = query.filter("quality_tier", "in", ("valuable", "soft_quarantine"))
            
            # Ensure posts have meaningful content
            query = query.not_.eq("tickers", "[]")
            
            response = await asyncio.to_thread(
                lambda: query.order("confidence_score", desc=True).limit(limit).execute()
            )
            return response.data if response.data else []
        except Exception as e:
            logger.error(f"Error fetching high-quality posts: {e}")
            return []

    async def get_filtered_posts_stats(self) -> Dict[str, int]:
        """
        Get statistics on filtered vs stored posts for monitoring data quality.
        """
        try:
            stats = {}
            
            # Count by processing status
            for status in ["completed", "filtered", "pending", "failed"]:
                response = await asyncio.to_thread(
                    lambda s=status: self.table.select("post_id", count="exact")
                    .eq("processing_status", s).execute()
                )
                stats[f"{status}_count"] = response.count or 0
            
            # Count by quality tier
            for tier in ["valuable", "soft_quarantine", "quarantine", "unprocessed"]:
                response = await asyncio.to_thread(
                    lambda t=tier: self.table.select("post_id", count="exact")
                    .eq("quality_tier", t).execute()
                )
                stats[f"{tier}_count"] = response.count or 0
            
            return stats
        except Exception as e:
            logger.error(f"Error fetching filtered posts stats: {e}")
            return {}


# Global client instance
_simple_storage_client: Optional[SimpleSupabaseStorage] = None


def get_simple_storage_client(use_service_key: bool = False) -> SimpleSupabaseStorage:
    """Get the simplified storage client."""
    global _simple_storage_client
    if _simple_storage_client is None:
        _simple_storage_client = SimpleSupabaseStorage(use_service_key=use_service_key)
    return _simple_storage_client


def get_admin_simple_storage_client() -> SimpleSupabaseStorage:
    """Get the simplified storage client with service key (admin privileges)."""
    return SimpleSupabaseStorage(use_service_key=True)
