"""
Discord notification service for unusual options alerts.

Sends formatted alerts for:
- High-conviction insider plays
- Weekly performance reports
- Signal summaries
"""

import os
import json
import asyncio
from typing import List, Dict, Any, Optional
from datetime import datetime
from dataclasses import dataclass
import aiohttp
from loguru import logger


@dataclass
class DiscordEmbed:
    """Discord embed structure."""
    title: str
    description: str = ""
    color: int = 0x5865F2  # Discord blurple
    fields: List[Dict[str, Any]] = None
    footer: str = ""
    timestamp: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        embed = {
            "title": self.title,
            "color": self.color,
        }
        
        if self.description:
            embed["description"] = self.description
        
        if self.fields:
            embed["fields"] = self.fields
        
        if self.footer:
            embed["footer"] = {"text": self.footer}
        
        if self.timestamp:
            embed["timestamp"] = self.timestamp
        
        return embed


class DiscordNotifier:
    """Send notifications to Discord via webhooks."""
    
    # Color constants
    COLOR_GREEN = 0x2ECC71   # Success/Bullish
    COLOR_RED = 0xE74C3C     # Warning/Bearish
    COLOR_GOLD = 0xF1C40F    # High conviction
    COLOR_BLUE = 0x3498DB    # Info
    COLOR_PURPLE = 0x9B59B6  # Performance report
    
    def __init__(self, webhook_url: Optional[str] = None):
        self.webhook_url = (
            webhook_url or 
            os.getenv("DISCORD_UOS_WEBHOOK_URL", "") or
            os.getenv("DISCORD_WEBHOOK_URL", "")
        )
        self._session: Optional[aiohttp.ClientSession] = None
    
    @property
    def is_configured(self) -> bool:
        """Check if Discord is configured."""
        return bool(self.webhook_url)
    
    async def _get_session(self) -> aiohttp.ClientSession:
        """Get or create aiohttp session."""
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession()
        return self._session
    
    async def close(self):
        """Close the session."""
        if self._session and not self._session.closed:
            await self._session.close()
    
    async def send_message(
        self, 
        content: str = "", 
        embeds: List[DiscordEmbed] = None,
        username: str = "Options Scanner"
    ) -> bool:
        """
        Send a message to Discord.
        
        Args:
            content: Plain text message
            embeds: List of embeds
            username: Bot username to display
            
        Returns:
            True if successful
        """
        if not self.is_configured:
            logger.warning("Discord webhook not configured")
            return False
        
        payload = {"username": username}
        
        if content:
            payload["content"] = content
        
        if embeds:
            payload["embeds"] = [e.to_dict() for e in embeds]
        
        try:
            session = await self._get_session()
            async with session.post(
                self.webhook_url,
                json=payload,
                headers={"Content-Type": "application/json"}
            ) as response:
                if response.status == 204:
                    logger.info("Discord notification sent successfully")
                    return True
                else:
                    text = await response.text()
                    logger.error(
                        f"Discord webhook failed: {response.status} - {text}"
                    )
                    return False
                    
        except Exception as e:
            logger.error(f"Discord notification error: {e}")
            return False
    
    async def send_insider_play_alert(
        self,
        ticker: str,
        option_symbol: str,
        option_type: str,
        premium: float,
        strike: float,
        dte: int,
        suspicion_score: float,
        patterns: List[str],
        grade: str = "S"
    ) -> bool:
        """
        Send alert for high-conviction insider play.
        """
        # Determine color based on option type
        color = self.COLOR_GREEN if option_type == 'call' else self.COLOR_RED
        
        # High suspicion gets gold
        if suspicion_score >= 80:
            color = self.COLOR_GOLD
        
        direction = "🟢 BULLISH" if option_type == 'call' else "🔴 BEARISH"
        
        # Format patterns
        pattern_emojis = {
            'LARGE_BET': '💰',
            'URGENT_SHORT_DTE': '⏰',
            'FRESH_POSITIONING': '🆕',
            'AGGRESSIVE_BUYER': '🚨',
            'MULTI_STRIKE_SCALING': '📊',
            'EARNINGS_PLAY': '📈'
        }
        patterns_str = " ".join(
            [pattern_emojis.get(p, '•') for p in patterns]
        )
        
        embed = DiscordEmbed(
            title=f"🎯 {ticker} - High Conviction Play",
            description=f"**{direction}** | Grade **{grade}** | "
                        f"Suspicion **{suspicion_score:.0f}/100**",
            color=color,
            fields=[
                {
                    "name": "📋 Contract",
                    "value": f"`{option_symbol}`",
                    "inline": True
                },
                {
                    "name": "💵 Premium",
                    "value": f"${premium/1_000_000:.1f}M",
                    "inline": True
                },
                {
                    "name": "🎯 Strike",
                    "value": f"${strike:.0f}",
                    "inline": True
                },
                {
                    "name": "📅 DTE",
                    "value": f"{dte} days",
                    "inline": True
                },
                {
                    "name": "🔍 Patterns",
                    "value": patterns_str or "Multiple indicators",
                    "inline": False
                }
            ],
            footer="Unusual Options Scanner",
            timestamp=datetime.utcnow().isoformat()
        )
        
        return await self.send_message(embeds=[embed])
    
    async def send_performance_report(
        self,
        total_signals: int,
        win_rate_1d: float,
        win_rate_5d: float,
        avg_return_5d: float,
        calls_win_rate: float,
        puts_win_rate: float,
        hedge_pct: float,
        top_winners: List[Dict[str, Any]] = None
    ) -> bool:
        """
        Send weekly performance report.
        """
        # Color based on win rate
        if win_rate_5d >= 0.55:
            color = self.COLOR_GREEN
            status = "✅ Edge Detected"
        elif win_rate_5d >= 0.45:
            color = self.COLOR_GOLD
            status = "⚠️ Near Breakeven"
        else:
            color = self.COLOR_RED
            status = "❌ Needs Tuning"
        
        embed = DiscordEmbed(
            title="📊 Weekly Performance Report",
            description=f"**Status: {status}**\n"
                        f"Analyzed {total_signals} signals over 7 days",
            color=color,
            fields=[
                {
                    "name": "📈 Win Rates",
                    "value": f"1-Day: **{win_rate_1d*100:.1f}%**\n"
                             f"5-Day: **{win_rate_5d*100:.1f}%**",
                    "inline": True
                },
                {
                    "name": "💰 5D Avg Return",
                    "value": f"**{avg_return_5d*100:+.2f}%**",
                    "inline": True
                },
                {
                    "name": "🔄 By Type",
                    "value": f"Calls: {calls_win_rate*100:.1f}%\n"
                             f"Puts: {puts_win_rate*100:.1f}%",
                    "inline": True
                },
                {
                    "name": "🛡️ Hedge Activity",
                    "value": f"**{hedge_pct*100:.1f}%** of signals",
                    "inline": True
                }
            ],
            footer="Run: poetry run python scripts/performance_tracker.py --report",
            timestamp=datetime.utcnow().isoformat()
        )
        
        embeds = [embed]
        
        # Add top winners if provided
        if top_winners:
            winners_text = "\n".join([
                f"**{w['ticker']}** {w['type']} → {w['return']*100:+.1f}%"
                for w in top_winners[:5]
            ])
            
            winners_embed = DiscordEmbed(
                title="🏆 Top Performers This Week",
                description=winners_text,
                color=self.COLOR_GREEN,
            )
            embeds.append(winners_embed)
        
        return await self.send_message(embeds=embeds)
    
    async def send_daily_summary(
        self,
        new_signals: int,
        high_conviction: int,
        total_premium: float,
        top_plays: List[Dict[str, Any]] = None
    ) -> bool:
        """
        Send end-of-day summary.
        """
        embed = DiscordEmbed(
            title="📋 Daily Options Flow Summary",
            description=f"Market close summary for "
                        f"{datetime.now().strftime('%B %d, %Y')}",
            color=self.COLOR_BLUE,
            fields=[
                {
                    "name": "📊 New Signals",
                    "value": f"**{new_signals}** detected",
                    "inline": True
                },
                {
                    "name": "🎯 High Conviction",
                    "value": f"**{high_conviction}** plays",
                    "inline": True
                },
                {
                    "name": "💰 Total Premium",
                    "value": f"**${total_premium/1_000_000:.1f}M**",
                    "inline": True
                }
            ],
            footer="Unusual Options Scanner",
            timestamp=datetime.utcnow().isoformat()
        )
        
        embeds = [embed]
        
        # Add top plays
        if top_plays:
            plays_text = "\n".join([
                f"**{p['ticker']}** {p['type']} "
                f"${p['premium']/1_000_000:.1f}M | "
                f"Score: {p['score']:.0f}"
                for p in top_plays[:5]
            ])
            
            plays_embed = DiscordEmbed(
                title="🔥 Top Plays Today",
                description=plays_text,
                color=self.COLOR_GOLD,
            )
            embeds.append(plays_embed)
        
        return await self.send_message(embeds=embeds)


# Convenience function for quick alerts
async def send_discord_alert(
    message: str,
    webhook_url: Optional[str] = None
) -> bool:
    """Quick function to send a simple Discord message."""
    notifier = DiscordNotifier(webhook_url)
    try:
        return await notifier.send_message(content=message)
    finally:
        await notifier.close()

