"""MarketAgent: live quotes and trading regime."""

from __future__ import annotations


def build_market_agent():
    from agno.agent import Agent

    from ai_discord_bot.agents.system_prompts import MARKET_AGENT_PROMPT
    from ai_discord_bot.config import ollama_model_for
    from ai_discord_bot.tools.calc_tools import calculate_spread
    from ai_discord_bot.tools.market_tools import get_ticker_data, get_trading_regime

    return Agent(
        id="market_agent",
        name="MarketAgent",
        model=ollama_model_for("MarketAgent"),
        description="Fetches live quotes and computes a coarse trading regime.",
        instructions=MARKET_AGENT_PROMPT,
        tools=[
            get_ticker_data,
            get_trading_regime,
            calculate_spread,
        ],
        markdown=False,
    )
