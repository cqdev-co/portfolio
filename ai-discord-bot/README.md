# ai-discord-bot

Local-only Python Discord bot running on your Mac. Lets you ask questions about
your private financial data (CDS/PCS signals, positions, P&L) and posts a
scheduled morning brief. Multi-agent: one orchestrator delegates to four
specialists over the [A2A protocol](https://a2a-protocol.org), with
`qwen3.6:35b` via local Ollama as the single model across all agents.

Full documentation: [docs/ai-discord-bot/README.md](../docs/ai-discord-bot/README.md).

## Quick start

From the repo root:

```bash
bun run py:bot:install   # poetry install inside ai-discord-bot/
bun run py:bot           # starts AgentOS + Discord bot in one process
```

Or from this folder:

```bash
poetry install
poetry run ai-discord-bot
```

## First-time setup

1. **Create a Discord bot** in the [Discord Developer Portal](https://discord.com/developers/applications).
   - Generate a bot token. Enable the "Message Content" intent.
   - Invite the bot to your private server with `applications.commands` + `bot` scopes.
2. **Set env vars** in the repo-root `.env.local`:
   ```
   DISCORD_BOT_TOKEN=...
   DISCORD_BOT_GUILD_ID=...     # your server ID (right-click server -> Copy ID)
   DISCORD_BOT_CHANNEL_ID=...   # channel for scheduled morning brief
   ```
3. **Apply the DB migration** (one-time):
   ```bash
   psql "$NEXT_PUBLIC_SUPABASE_URL" -f ai-discord-bot/migrations/001_agent_conversations.sql
   ```
   (Or run the SQL through the Supabase dashboard.)
4. **Ensure Ollama is running** and has `qwen3.6:35b` pulled:
   ```bash
   ollama list | grep qwen3.6
   ```
5. `bun run py:bot`. Check Discord for `/brief` and `/ask` slash commands.

## Commands

- `/brief` - Generate the morning brief on demand (also runs automatically on cron at 08:30 ET weekdays).
- `/ask <question>` - Free-form Q&A. The orchestrator delegates to specialists as needed.

## Architecture

Detailed in [docs/ai-discord-bot/README.md](../docs/ai-discord-bot/README.md). Short version:

- **Orchestrator** receives the user's message, reads recent memory, calls specialists via A2A, writes memory.
- **PortfolioAgent** - positions, spreads, P&L (Supabase).
- **SignalsAgent** - CDS / PCS / unusual options scanner data (Supabase).
- **MarketAgent** - live prices, trading regime (Yahoo / FMP).
- **NarrativeAgent** - formats the final Discord message (no tools).

All agents hit the same Ollama `qwen3.6:35b` endpoint - one resident model, no RAM
thrashing.

## Known limits

- Bot is online only while the Python process is running and your Mac is awake.
- Scheduled brief is skipped if the Mac is asleep at 08:30 ET (catchup is V2).
- No public deployment. This is strictly local.
