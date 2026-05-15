"""
Discord bot: registers /brief and /ask slash commands.

Runs in the same asyncio loop as the AgentOS FastAPI server. Orchestrator
calls are sync and slow (tens of seconds), so we offload them to a thread
via `asyncio.to_thread` to keep the Discord gateway responsive and avoid
hitting the 3-second interaction timeout (we use `defer` + `followup`).
"""

from __future__ import annotations

import asyncio
import contextlib

import discord
from discord import app_commands
from loguru import logger

from ai_discord_bot.agents.orchestrator import run_orchestrator
from ai_discord_bot.bot.formatter import chunk_for_discord
from ai_discord_bot.config import get_settings


def build_client() -> tuple[discord.Client, app_commands.CommandTree]:
    intents = discord.Intents.default()
    # We use slash commands only; message content intent is not required.
    client = discord.Client(intents=intents)
    tree = app_commands.CommandTree(client)

    s = get_settings()
    guild_obj = discord.Object(id=int(s.discord_bot_guild_id)) if s.discord_bot_guild_id else None

    @client.event
    async def on_ready() -> None:
        logger.info("Discord bot logged in as {} (id={})", client.user, getattr(client.user, "id", "?"))
        # Sync commands; guild sync is instant, global can take ~1h.
        try:
            if guild_obj is not None:
                await tree.sync(guild=guild_obj)
                logger.info("Slash commands synced to guild {}", s.discord_bot_guild_id)
            else:
                await tree.sync()
                logger.info("Slash commands synced globally (may take up to 1h to appear)")
        except Exception as e:
            logger.warning("Command sync failed: {}", e)

    # ----- /brief ---------------------------------------------------------

    async def _run_brief(interaction: discord.Interaction) -> None:
        channel_id = str(interaction.channel_id)
        user_id = str(interaction.user.id)
        reply = await asyncio.to_thread(
            run_orchestrator,
            channel_id,
            user_id,
            "",  # ignored when is_brief=True
            True,
        )
        await _send_reply(interaction, reply)

    brief_cmd = app_commands.Command(
        name="brief",
        description="Generate the morning brief now.",
        callback=_brief_callback_factory(_run_brief),
    )

    # ----- /ask -----------------------------------------------------------

    async def _run_ask(interaction: discord.Interaction, question: str) -> None:
        channel_id = str(interaction.channel_id)
        user_id = str(interaction.user.id)
        reply = await asyncio.to_thread(
            run_orchestrator,
            channel_id,
            user_id,
            question,
            False,
        )
        await _send_reply(interaction, reply)

    ask_cmd = app_commands.Command(
        name="ask",
        description="Ask Xylo a question about your portfolio, signals, or market.",
        callback=_ask_callback_factory(_run_ask),
    )

    if guild_obj is not None:
        tree.add_command(brief_cmd, guild=guild_obj)
        tree.add_command(ask_cmd, guild=guild_obj)
    else:
        tree.add_command(brief_cmd)
        tree.add_command(ask_cmd)

    return client, tree


# Callbacks are factored out so we can `await interaction.response.defer()`
# before the long-running orchestrator call; Discord otherwise times out
# the interaction after 3 seconds.


def _brief_callback_factory(runner):
    async def callback(interaction: discord.Interaction) -> None:
        with contextlib.suppress(discord.errors.InteractionResponded):
            await interaction.response.defer(thinking=True)
        try:
            await runner(interaction)
        except Exception as e:
            logger.exception("/brief failed")
            await _send_reply(interaction, f"Brief failed: {e}")

    return callback


def _ask_callback_factory(runner):
    @app_commands.describe(question="Your question (free-form).")
    async def callback(interaction: discord.Interaction, question: str) -> None:
        with contextlib.suppress(discord.errors.InteractionResponded):
            await interaction.response.defer(thinking=True)
        try:
            await runner(interaction, question)
        except Exception as e:
            logger.exception("/ask failed")
            await _send_reply(interaction, f"Ask failed: {e}")

    return callback


async def _send_reply(interaction: discord.Interaction, text: str) -> None:
    """Deliver `text` to the user, chunking for Discord's 2000-char limit.

    Strategy: try `interaction.followup.send` first (shows as a reply to the
    slash command) while the token is still valid. If the token has expired
    (50027 Invalid Webhook Token) - which happens when the orchestrator runs
    longer than Discord's 15-minute interaction-token lifetime - fall back
    to `channel.send`, which has no time limit.
    """
    chunks = chunk_for_discord(text)
    channel = interaction.channel
    followup_ok = True

    for chunk in chunks:
        sent = False
        if followup_ok:
            try:
                await interaction.followup.send(chunk)
                sent = True
            except discord.errors.HTTPException as e:
                # 50027 = Invalid Webhook Token (token expired, >15m since defer).
                # 10015 = Unknown Webhook. 40060 = already acknowledged.
                followup_ok = False
                logger.warning(
                    "followup.send failed (code={}); falling back to channel.send",
                    getattr(e, "code", None) or e.status,
                )

        if not sent:
            if channel is None:
                logger.error("No channel on interaction; cannot deliver reply")
                return
            try:
                await channel.send(chunk)  # type: ignore[union-attr]
            except Exception as e:
                logger.error("channel.send failed: {}", e)
                return
