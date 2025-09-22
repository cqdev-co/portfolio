"""Reddit API client for enterprise-grade data collection."""

import asyncio
import logging
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional, Set
from urllib.parse import urlparse

import httpx
from PIL import Image

from ..config.settings import get_settings
from .models import PostCore

logger = logging.getLogger(__name__)


class RedditAPIError(Exception):
    """Custom exception for Reddit API errors."""
    pass


class RedditClient:
    """Enterprise-grade Reddit API client with rate limiting and error handling."""
    
    def __init__(self):
        """Initialize Reddit client with OAuth2 authentication."""
        self.settings = get_settings()
        self.client = httpx.AsyncClient(
            timeout=httpx.Timeout(self.settings.processing.request_timeout),
            limits=httpx.Limits(
                max_connections=self.settings.processing.max_concurrent_requests,
                max_keepalive_connections=5
            ),
            headers={
                "User-Agent": self.settings.reddit.user_agent
            }
        )
        
        self.access_token: Optional[str] = None
        self.token_expires_at: Optional[datetime] = None
        self.rate_limit_remaining = 100
        self.rate_limit_reset_time = 0
        
        # Track processed posts to avoid duplicates
        self.processed_posts: Set[str] = set()
        
        logger.info("Initialized Reddit API client")
    
    async def __aenter__(self):
        """Async context manager entry."""
        await self.authenticate()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        await self.client.aclose()
    
    async def authenticate(self) -> bool:
        """Authenticate with Reddit API using OAuth2."""
        try:
            auth_data = {
                "grant_type": "client_credentials"
            }
            
            auth = httpx.BasicAuth(
                self.settings.reddit.client_id,
                self.settings.reddit.client_secret
            )
            
            response = await self.client.post(
                "https://www.reddit.com/api/v1/access_token",
                data=auth_data,
                auth=auth,
                headers={"User-Agent": self.settings.reddit.user_agent}
            )
            
            if response.status_code == 200:
                token_data = response.json()
                self.access_token = token_data["access_token"]
                expires_in = token_data.get("expires_in", 3600)
                self.token_expires_at = datetime.utcnow() + timedelta(
                    seconds=expires_in - 60  # Refresh 1 minute early
                )
                
                # Update client headers with access token
                self.client.headers["Authorization"] = f"Bearer {self.access_token}"
                
                logger.info("Successfully authenticated with Reddit API")
                return True
            else:
                logger.error(f"Authentication failed: {response.status_code} - {response.text}")
                raise RedditAPIError(f"Authentication failed: {response.status_code}")
                
        except Exception as e:
            logger.error(f"Error during authentication: {e}")
            raise RedditAPIError(f"Authentication error: {e}")
    
    async def _ensure_authenticated(self) -> None:
        """Ensure we have a valid access token."""
        if (
            not self.access_token or 
            not self.token_expires_at or 
            datetime.utcnow() >= self.token_expires_at
        ):
            await self.authenticate()
    
    async def _handle_rate_limiting(self, response: httpx.Response) -> None:
        """Handle Reddit API rate limiting."""
        # Update rate limit info from headers
        if "x-ratelimit-remaining" in response.headers:
            self.rate_limit_remaining = int(float(response.headers["x-ratelimit-remaining"]))
        
        if "x-ratelimit-reset" in response.headers:
            self.rate_limit_reset_time = int(float(response.headers["x-ratelimit-reset"]))
        
        # If we're rate limited, wait
        if response.status_code == 429:
            reset_time = self.rate_limit_reset_time
            current_time = int(time.time())
            wait_time = max(reset_time - current_time, 1)
            
            logger.warning(f"Rate limited. Waiting {wait_time} seconds...")
            await asyncio.sleep(wait_time)
        
        # Proactive rate limiting - slow down if we're getting close
        elif self.rate_limit_remaining < 10:
            logger.info(f"Rate limit low ({self.rate_limit_remaining}), slowing down...")
            await asyncio.sleep(2)
    
    async def _make_request(
        self, 
        url: str, 
        params: Optional[Dict[str, Any]] = None,
        retries: int = None
    ) -> Dict[str, Any]:
        """Make a request to Reddit API with error handling and retries."""
        if retries is None:
            retries = self.settings.processing.retry_attempts
        
        await self._ensure_authenticated()
        
        for attempt in range(retries + 1):
            try:
                response = await self.client.get(url, params=params)
                
                # Handle rate limiting
                await self._handle_rate_limiting(response)
                
                if response.status_code == 200:
                    return response.json()
                elif response.status_code == 429:
                    # Rate limited - retry after waiting
                    if attempt < retries:
                        continue
                    else:
                        raise RedditAPIError("Rate limited after all retries")
                elif response.status_code == 401:
                    # Token expired - re-authenticate and retry
                    await self.authenticate()
                    if attempt < retries:
                        continue
                    else:
                        raise RedditAPIError("Authentication failed after retries")
                else:
                    logger.error(f"API request failed: {response.status_code} - {response.text}")
                    if attempt < retries:
                        await asyncio.sleep(self.settings.processing.retry_delay * (attempt + 1))
                        continue
                    else:
                        raise RedditAPIError(f"API request failed: {response.status_code}")
                        
            except httpx.RequestError as e:
                logger.error(f"Request error (attempt {attempt + 1}): {e}")
                if attempt < retries:
                    await asyncio.sleep(self.settings.processing.retry_delay * (attempt + 1))
                    continue
                else:
                    raise RedditAPIError(f"Request error after {retries} retries: {e}")
        
        raise RedditAPIError("Max retries exceeded")
    
    def _parse_post_data(self, post_data: Dict[str, Any]) -> Optional[PostCore]:
        """Parse Reddit post data into PostCore model."""
        try:
            data = post_data.get("data", {})
            
            # Skip if already processed
            post_id = data.get("id")
            if post_id in self.processed_posts:
                return None
            
            # Skip deleted/removed posts
            if data.get("removed_by_category") or data.get("author") == "[deleted]":
                return None
            
            # Determine if post has image
            is_image = False
            image_url = None
            
            url = data.get("url", "")
            if url:
                # Check for direct image links
                if any(url.lower().endswith(ext) for ext in ['.jpg', '.jpeg', '.png', '.gif']):
                    is_image = True
                    image_url = url
                # Check for Reddit image/gallery posts
                elif "i.redd.it" in url or "reddit.com/gallery/" in url:
                    is_image = True
                    image_url = url
                # Check for imgur links
                elif "imgur.com" in url and not url.endswith(".gifv"):
                    is_image = True
                    image_url = url
            
            # Create PostCore instance
            created_utc = int(float(data.get("created_utc", 0)))
            post = PostCore(
                post_id=post_id,
                subreddit=data.get("subreddit", ""),
                author=data.get("author"),
                created_utc=created_utc,
                created_datetime=datetime.fromtimestamp(created_utc),
                title=data.get("title", ""),
                selftext=data.get("selftext", ""),
                permalink=data.get("permalink", ""),
                url=image_url,
                score=int(float(data.get("score", 0))),
                upvote_ratio=float(data.get("upvote_ratio", 0.0)),
                num_comments=int(float(data.get("num_comments", 0))),
                flair=data.get("link_flair_text"),
                is_image=is_image,
                is_video=bool(data.get("is_video", False)),
                is_self=bool(data.get("is_self", False)),
                is_nsfw=bool(data.get("over_18", False)),
                is_spoiler=bool(data.get("spoiler", False))
            )
            
            self.processed_posts.add(post_id)
            return post
            
        except Exception as e:
            logger.error(f"Error parsing post data: {e}")
            return None
    
    async def get_subreddit_posts(
        self,
        subreddit: str,
        sort: str = "new",
        time_filter: str = "hour",
        limit: int = 100
    ) -> List[PostCore]:
        """Get posts from a specific subreddit."""
        try:
            url = f"https://oauth.reddit.com/r/{subreddit}/{sort}"
            params = {
                "limit": min(limit, 100),  # Reddit API limit
                "t": time_filter,
                "raw_json": 1
            }
            
            logger.info(f"Fetching posts from r/{subreddit} (sort={sort}, limit={limit})")
            
            response_data = await self._make_request(url, params)
            
            posts = []
            if "data" in response_data and "children" in response_data["data"]:
                for post_data in response_data["data"]["children"]:
                    post = self._parse_post_data(post_data)
                    if post:
                        posts.append(post)
            
            logger.info(f"Retrieved {len(posts)} posts from r/{subreddit}")
            return posts
            
        except Exception as e:
            logger.error(f"Error fetching posts from r/{subreddit}: {e}")
            return []
    
    async def get_posts_from_multiple_subreddits(
        self,
        subreddits: List[str],
        sort: str = "new",
        time_filter: str = "hour",
        limit_per_sub: int = 50
    ) -> List[PostCore]:
        """Get posts from multiple subreddits concurrently."""
        tasks = []
        
        for subreddit in subreddits:
            task = self.get_subreddit_posts(
                subreddit=subreddit,
                sort=sort,
                time_filter=time_filter,
                limit=limit_per_sub
            )
            tasks.append(task)
        
        # Execute all requests concurrently
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        all_posts = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                logger.error(f"Error fetching from r/{subreddits[i]}: {result}")
            else:
                all_posts.extend(result)
        
        # Sort by creation time (newest first)
        all_posts.sort(key=lambda p: p.created_utc, reverse=True)
        
        logger.info(f"Retrieved {len(all_posts)} total posts from {len(subreddits)} subreddits")
        return all_posts
    
    async def download_image(self, url: str, save_path: Path) -> bool:
        """Download image from URL and save to local path."""
        try:
            # Skip gallery URLs and other complex formats
            if "gallery" in url or "reddit.com/r/" in url:
                logger.debug(f"Skipping gallery/complex URL: {url}")
                return False
                
            # Check for null characters in the path string and skip if found
            path_str = str(save_path)
            if '\x00' in path_str:
                logger.warning(f"Skipping image with null character in path: {repr(path_str)}")
                return False
                
            # Clean the save_path to remove any null characters or problematic chars
            clean_filename = "".join(c for c in save_path.name if c.isprintable() and c not in '\x00\n\r\t')
            if not clean_filename:
                clean_filename = f"image_{hash(str(save_path)) % 1000000}.jpg"
            clean_save_path = save_path.parent / clean_filename
                
            # Ensure directory exists
            clean_save_path.parent.mkdir(parents=True, exist_ok=True)
            
            # Handle different image hosting services
            download_url = self._get_direct_image_url(url)
            
            response = await self.client.get(download_url)
            
            if response.status_code == 200:
                # Validate it's actually an image
                try:
                    with Image.open(response.content) as img:
                        # Convert to RGB if necessary and save as JPEG
                        if img.mode in ('RGBA', 'LA', 'P'):
                            img = img.convert('RGB')
                        
                        # Resize if too large (max 2048x2048)
                        if img.width > 2048 or img.height > 2048:
                            img.thumbnail((2048, 2048), Image.Resampling.LANCZOS)
                        
                        img.save(clean_save_path, "JPEG", quality=85, optimize=True)
                        
                    logger.debug(f"Downloaded image: {clean_save_path}")
                    return True
                    
                except Exception as e:
                    logger.error(f"Error processing image {url}: {e}")
                    return False
            else:
                logger.error(f"Failed to download image {url}: {response.status_code}")
                return False
                
        except Exception as e:
            logger.error(f"Error downloading image {url}: {e}")
            return False
    
    def _get_direct_image_url(self, url: str) -> str:
        """Convert various image hosting URLs to direct image URLs."""
        parsed = urlparse(url)
        
        # Handle imgur URLs
        if "imgur.com" in parsed.netloc:
            if "/a/" in url or "/gallery/" in url:
                # Gallery URLs - would need special handling
                return url
            else:
                # Single image - ensure we get the direct link
                image_id = parsed.path.split("/")[-1].split(".")[0]
                return f"https://i.imgur.com/{image_id}.jpg"
        
        # Handle Reddit image URLs
        elif "i.redd.it" in parsed.netloc:
            return url
        
        # Handle Reddit gallery URLs (more complex, might need special handling)
        elif "reddit.com/gallery/" in url:
            return url
        
        # Default - assume it's already a direct URL
        return url
    
    async def get_recent_posts(
        self,
        window_minutes: int = None,
        max_posts: int = None
    ) -> List[PostCore]:
        """Get recent posts from all configured subreddits."""
        if window_minutes is None:
            window_minutes = self.settings.data.poll_window_minutes
        
        if max_posts is None:
            max_posts = self.settings.data.max_posts_per_poll
        
        # Calculate time filter based on window
        if window_minutes <= 60:
            time_filter = "hour"
        elif window_minutes <= 1440:  # 24 hours
            time_filter = "day"
        else:
            time_filter = "week"
        
        # Get posts from all subreddits
        posts = await self.get_posts_from_multiple_subreddits(
            subreddits=self.settings.data.subreddits,
            sort="new",
            time_filter=time_filter,
            limit_per_sub=max_posts // len(self.settings.data.subreddits)
        )
        
        # Filter by time window
        cutoff_time = int((datetime.utcnow() - timedelta(minutes=window_minutes)).timestamp())
        recent_posts = [p for p in posts if p.created_utc >= cutoff_time]
        
        # Limit total posts
        if len(recent_posts) > max_posts:
            recent_posts = recent_posts[:max_posts]
        
        logger.info(
            f"Retrieved {len(recent_posts)} recent posts "
            f"(within {window_minutes} minutes)"
        )
        
        return recent_posts
    
    def clear_processed_cache(self) -> None:
        """Clear the processed posts cache."""
        self.processed_posts.clear()
        logger.info("Cleared processed posts cache")
