"""
APScheduler cron: runs the morning brief on weekdays at BRIEF_CRON_HOUR:MINUTE
in BRIEF_CRON_TZ (default 08:30 America/New_York).

If the Mac is asleep at fire time, the job is skipped; APScheduler's
misfire grace is tight. Catchup on wake is V2 work.
"""

from __future__ import annotations

import asyncio

import discord
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from loguru import logger

from ai_discord_bot.agents.orchestrator import run_orchestrator
from ai_discord_bot.bot.formatter import chunk_for_discord
from ai_discord_bot.config import get_settings


def attach_scheduler(client: discord.Client) -> AsyncIOScheduler:
    """Attach a cron scheduler to the bot's event loop. Returns the scheduler
    for lifecycle management (caller starts/stops it)."""
    s = get_settings()

    async def fire_brief() -> None:
        if not s.discord_bot_channel_id:
            logger.warning("DISCORD_BOT_CHANNEL_ID not set; skipping scheduled brief")
            return
        channel = client.get_channel(int(s.discord_bot_channel_id))
        if channel is None:
            try:
                channel = await client.fetch_channel(int(s.discord_bot_channel_id))
            except Exception as e:
                logger.warning("Scheduled brief: could not resolve channel: {}", e)
                return

        logger.info("Scheduled brief firing at cron trigger")
        try:
            reply = await asyncio.to_thread(
                run_orchestrator,
                str(s.discord_bot_channel_id),
                "scheduler",
                "",
                True,
            )
        except Exception as e:
            logger.exception("Scheduled brief failed")
            reply = f"Morning brief failed: {e}"

        for chunk in chunk_for_discord(reply):
            try:
                await channel.send(chunk)  # type: ignore[union-attr]
            except Exception as e:
                logger.warning("Scheduled brief send failed: {}", e)
                break

    scheduler = AsyncIOScheduler(timezone=s.brief_cron_tz)
    trigger = CronTrigger(
        day_of_week="mon-fri",
        hour=s.brief_cron_hour,
        minute=s.brief_cron_minute,
        timezone=s.brief_cron_tz,
    )
    scheduler.add_job(fire_brief, trigger, id="morning_brief", replace_existing=True)
    logger.info(
        "Morning brief scheduled: weekdays {:02d}:{:02d} {}",
        s.brief_cron_hour,
        s.brief_cron_minute,
        s.brief_cron_tz,
    )
    return scheduler
