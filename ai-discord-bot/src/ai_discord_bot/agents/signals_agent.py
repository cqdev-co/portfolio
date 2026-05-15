"""SignalsAgent: CDS / PCS / unusual options scanner data + outcomes."""

from __future__ import annotations


def build_signals_agent():
    from agno.agent import Agent

    from ai_discord_bot.agents.system_prompts import SIGNALS_AGENT_PROMPT
    from ai_discord_bot.config import ollama_model_for
    from ai_discord_bot.tools.signals_tools import (
        get_recent_signals,
        get_unusual_options_activity,
        search_cds_outcomes,
    )

    return Agent(
        id="signals_agent",
        name="SignalsAgent",
        model=ollama_model_for("SignalsAgent"),
        description="Queries the unified signals table, unusual options, and historical CDS outcomes.",
        instructions=SIGNALS_AGENT_PROMPT,
        tools=[
            get_recent_signals,
            get_unusual_options_activity,
            search_cds_outcomes,
        ],
        markdown=False,
    )
