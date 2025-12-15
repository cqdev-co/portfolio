"""
Discord notification service for penny stock scanner alerts.

Sends formatted alerts for:
- S/A-Tier explosion setup signals
- Daily scan summaries
- Performance reports
"""

import os
import asyncio
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from dataclasses import dataclass, field
import aiohttp
from loguru import logger

from penny_scanner.models.analysis import AnalysisResult, OpportunityRank


@dataclass
class DiscordEmbed:
    """Discord embed structure."""
    title: str
    description: str = ""
    color: int = 0x5865F2  # Discord blurple
    fields: List[Dict[str, Any]] = field(default_factory=list)
    footer: str = ""
    timestamp: str = ""
    thumbnail_url: str = ""
    
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
            
        if self.thumbnail_url:
            embed["thumbnail"] = {"url": self.thumbnail_url}
        
        return embed


class PennyDiscordNotifier:
    """Send penny stock notifications to Discord via webhooks."""
    
    # Color constants
    COLOR_GOLD = 0xFFD700      # S-Tier (Gold)
    COLOR_GREEN = 0x2ECC71    # A-Tier / Winners
    COLOR_BLUE = 0x3498DB     # B-Tier / Info
    COLOR_ORANGE = 0xE67E22   # Volume surge
    COLOR_RED = 0xE74C3C      # Losers / Warnings
    COLOR_PURPLE = 0x9B59B6   # Performance report
    
    def __init__(self, webhook_url: Optional[str] = None):
        self.webhook_url = (
            webhook_url or 
            os.getenv("DISCORD_PENNY_WEBHOOK_URL", "") or
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
        username: str = "Penny Scanner 🚀"
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
            logger.warning("Discord webhook not configured - set DISCORD_PENNY_WEBHOOK_URL")
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
    
    def _get_rank_emoji(self, rank: OpportunityRank) -> str:
        """Get emoji for opportunity rank."""
        rank_emojis = {
            OpportunityRank.S_TIER: "🏆",
            OpportunityRank.A_TIER: "🥇",
            OpportunityRank.B_TIER: "🥈",
            OpportunityRank.C_TIER: "🥉",
            OpportunityRank.D_TIER: "📉",
        }
        return rank_emojis.get(rank, "❓")
    
    def _get_rank_color(self, rank: OpportunityRank) -> int:
        """Get color for opportunity rank."""
        rank_colors = {
            OpportunityRank.S_TIER: self.COLOR_GOLD,
            OpportunityRank.A_TIER: self.COLOR_GREEN,
            OpportunityRank.B_TIER: self.COLOR_BLUE,
            OpportunityRank.C_TIER: self.COLOR_ORANGE,
            OpportunityRank.D_TIER: self.COLOR_RED,
        }
        return rank_colors.get(rank, self.COLOR_BLUE)
    
    async def send_signal_alert(
        self,
        result: AnalysisResult
    ) -> bool:
        """
        Send alert for a high-quality penny stock signal.
        
        Args:
            result: Analysis result to alert on
            
        Returns:
            True if successful
        """
        signal = result.explosion_signal
        rank = result.opportunity_rank
        
        emoji = self._get_rank_emoji(rank)
        color = self._get_rank_color(rank)
        
        # Build setup indicators
        setup_indicators = []
        if signal.is_breakout:
            setup_indicators.append("🚀 Breakout")
        if signal.is_consolidating:
            setup_indicators.append("📦 Consolidation")
        if signal.higher_lows_detected:
            setup_indicators.append("📈 Higher Lows")
        if signal.volume_spike_factor >= 5.0:
            setup_indicators.append("🔥 5x+ Volume")
        elif signal.volume_spike_factor >= 3.0:
            setup_indicators.append("⚡ 3x+ Volume")
        if signal.ema_crossover_signal:
            setup_indicators.append("✨ EMA Cross")
        
        setup_text = " | ".join(setup_indicators) if setup_indicators else "Volume Surge"
        
        # Trend indicator
        trend_emoji = {
            "BULLISH": "🟢",
            "NEUTRAL": "🟡",
            "BEARISH": "🔴"
        }.get(signal.trend_direction.value, "⚪")
        
        embed = DiscordEmbed(
            title=f"{emoji} {result.symbol} - {rank.value}-Tier Signal",
            description=f"**{result.recommendation}** | {setup_text}",
            color=color,
            fields=[
                {
                    "name": "💵 Price",
                    "value": f"${signal.close_price:.2f}",
                    "inline": True
                },
                {
                    "name": "📊 Score",
                    "value": f"**{result.overall_score:.3f}**",
                    "inline": True
                },
                {
                    "name": "📈 Volume",
                    "value": f"**{signal.volume_spike_factor:.1f}x** avg",
                    "inline": True
                },
                {
                    "name": f"{trend_emoji} Trend",
                    "value": signal.trend_direction.value.title(),
                    "inline": True
                },
                {
                    "name": "🎯 Stop Loss",
                    "value": f"${result.stop_loss_level:.2f}",
                    "inline": True
                },
                {
                    "name": "📏 Position",
                    "value": f"{result.position_size_pct:.1f}%",
                    "inline": True
                },
                {
                    "name": "📅 Status",
                    "value": f"{signal.signal_status.value} (Day {signal.days_active})",
                    "inline": True
                },
                {
                    "name": "⚠️ Risk",
                    "value": signal.pump_dump_risk.value,
                    "inline": True
                }
            ],
            footer="Penny Stock Scanner",
            timestamp=datetime.now(timezone.utc).isoformat()
        )
        
        return await self.send_message(embeds=[embed])
    
    async def send_batch_alerts(
        self,
        results: List[AnalysisResult],
        min_rank: OpportunityRank = OpportunityRank.A_TIER
    ) -> int:
        """
        Send alerts for multiple signals that meet minimum rank.
        
        Args:
            results: List of analysis results
            min_rank: Minimum rank to alert (default A-Tier)
            
        Returns:
            Number of alerts sent
        """
        # Filter to eligible signals
        rank_order = [
            OpportunityRank.S_TIER,
            OpportunityRank.A_TIER,
            OpportunityRank.B_TIER,
            OpportunityRank.C_TIER,
            OpportunityRank.D_TIER
        ]
        
        min_rank_idx = rank_order.index(min_rank)
        eligible = [
            r for r in results 
            if rank_order.index(r.opportunity_rank) <= min_rank_idx
        ]
        
        if not eligible:
            logger.info(f"No signals meet minimum rank {min_rank.value}")
            return 0
        
        sent_count = 0
        for result in eligible:
            success = await self.send_signal_alert(result)
            if success:
                sent_count += 1
            # Rate limit - Discord allows 30 requests per minute
            await asyncio.sleep(2)
        
        logger.info(f"Sent {sent_count}/{len(eligible)} Discord alerts")
        return sent_count
    
    async def send_daily_summary(
        self,
        total_signals: int,
        new_signals: int,
        s_tier_count: int,
        a_tier_count: int,
        avg_score: float,
        top_signals: List[AnalysisResult] = None
    ) -> bool:
        """
        Send end-of-day summary.
        
        Args:
            total_signals: Total signals detected
            new_signals: New signals today
            s_tier_count: Number of S-Tier signals
            a_tier_count: Number of A-Tier signals
            avg_score: Average signal score
            top_signals: Top signals to highlight
            
        Returns:
            True if successful
        """
        embed = DiscordEmbed(
            title="📋 Daily Penny Stock Scan Summary",
            description=f"Market close summary for "
                        f"{datetime.now().strftime('%B %d, %Y')}",
            color=self.COLOR_PURPLE,
            fields=[
                {
                    "name": "📊 Total Signals",
                    "value": f"**{total_signals}**",
                    "inline": True
                },
                {
                    "name": "🆕 New Today",
                    "value": f"**{new_signals}**",
                    "inline": True
                },
                {
                    "name": "📈 Avg Score",
                    "value": f"**{avg_score:.3f}**",
                    "inline": True
                },
                {
                    "name": "🏆 S-Tier",
                    "value": f"**{s_tier_count}**",
                    "inline": True
                },
                {
                    "name": "🥇 A-Tier",
                    "value": f"**{a_tier_count}**",
                    "inline": True
                }
            ],
            footer="Penny Stock Scanner",
            timestamp=datetime.now(timezone.utc).isoformat()
        )
        
        embeds = [embed]
        
        # Add top signals
        if top_signals:
            top_text = "\n".join([
                f"**{s.symbol}** {self._get_rank_emoji(s.opportunity_rank)} "
                f"Score: {s.overall_score:.3f} | "
                f"Vol: {s.explosion_signal.volume_spike_factor:.1f}x"
                for s in top_signals[:5]
            ])
            
            top_embed = DiscordEmbed(
                title="🔥 Top Signals Today",
                description=top_text,
                color=self.COLOR_GOLD,
            )
            embeds.append(top_embed)
        
        return await self.send_message(embeds=embeds)
    
    async def send_performance_report(
        self,
        total_trades: int,
        win_rate: float,
        avg_return: float,
        avg_winner: float,
        avg_loser: float,
        stop_loss_pct: float,
        by_rank: Dict[str, Dict] = None,
        top_winners: List[Dict] = None,
        top_losers: List[Dict] = None
    ) -> bool:
        """
        Send performance report.
        
        Args:
            total_trades: Total closed trades
            win_rate: Win rate percentage
            avg_return: Average return percentage
            avg_winner: Average winning trade return
            avg_loser: Average losing trade return
            stop_loss_pct: Percentage of trades hitting stop loss
            by_rank: Performance breakdown by rank
            top_winners: Top winning trades
            top_losers: Top losing trades
            
        Returns:
            True if successful
        """
        # Color based on win rate
        if win_rate >= 50:
            color = self.COLOR_GREEN
            status = "✅ Profitable"
        elif win_rate >= 40:
            color = self.COLOR_ORANGE
            status = "⚠️ Near Breakeven"
        else:
            color = self.COLOR_RED
            status = "❌ Needs Improvement"
        
        embed = DiscordEmbed(
            title="📊 Penny Scanner Performance Report",
            description=f"**Status: {status}**\n"
                        f"Analysis of {total_trades} closed trades",
            color=color,
            fields=[
                {
                    "name": "📈 Win Rate",
                    "value": f"**{win_rate:.1f}%**",
                    "inline": True
                },
                {
                    "name": "💰 Avg Return",
                    "value": f"**{avg_return:+.2f}%**",
                    "inline": True
                },
                {
                    "name": "🛑 Stop Loss Rate",
                    "value": f"**{stop_loss_pct:.1f}%**",
                    "inline": True
                },
                {
                    "name": "✅ Avg Winner",
                    "value": f"+{avg_winner:.2f}%",
                    "inline": True
                },
                {
                    "name": "❌ Avg Loser",
                    "value": f"{avg_loser:.2f}%",
                    "inline": True
                }
            ],
            footer="Penny Stock Scanner",
            timestamp=datetime.now(timezone.utc).isoformat()
        )
        
        embeds = [embed]
        
        # Add rank breakdown
        if by_rank:
            rank_text = "\n".join([
                f"**{rank}-Tier**: {data['count']} trades | "
                f"Win: {data['win_rate']:.1f}% | "
                f"Avg: {data['avg_return']:+.2f}%"
                for rank, data in by_rank.items()
                if data['count'] > 0
            ])
            
            if rank_text:
                rank_embed = DiscordEmbed(
                    title="📊 Performance by Rank",
                    description=rank_text,
                    color=self.COLOR_BLUE,
                )
                embeds.append(rank_embed)
        
        # Add top winners
        if top_winners:
            winners_text = "\n".join([
                f"**{w['symbol']}** → +{w['return_pct']:.1f}% ({w['days_held']}d)"
                for w in top_winners[:5]
            ])
            
            winners_embed = DiscordEmbed(
                title="🏆 Top Winners",
                description=winners_text,
                color=self.COLOR_GREEN,
            )
            embeds.append(winners_embed)
        
        return await self.send_message(embeds=embeds)


# Convenience function for quick alerts
async def send_penny_discord_alert(
    message: str,
    webhook_url: Optional[str] = None
) -> bool:
    """Quick function to send a simple Discord message."""
    notifier = PennyDiscordNotifier(webhook_url)
    try:
        return await notifier.send_message(content=message)
    finally:
        await notifier.close()
