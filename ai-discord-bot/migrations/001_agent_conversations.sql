-- ai-discord-bot: conversation memory
--
-- One row per turn (user message, assistant reply, or tool result). Oldest
-- N turns stay in DB but are not necessarily loaded back into the prompt
-- (V1 loads last 20 per channel). No summarization yet; that is V2 work.
--
-- Apply once via:
--   psql "$NEXT_PUBLIC_SUPABASE_URL" -f ai-discord-bot/migrations/001_agent_conversations.sql
-- or paste into Supabase SQL editor.

create extension if not exists "pgcrypto";

create table if not exists agent_conversations (
  id uuid primary key default gen_random_uuid(),
  channel_id text not null,
  user_id text not null,
  role text not null check (role in ('user', 'assistant', 'tool', 'system')),
  content jsonb not null,
  agent_name text, -- which agent produced the reply (null for user turns)
  created_at timestamptz not null default now()
);

-- Primary access pattern: "last N turns in this channel, newest first"
create index if not exists agent_conversations_channel_ts
  on agent_conversations (channel_id, created_at desc);

-- Secondary: look up by user across channels (rare but cheap)
create index if not exists agent_conversations_user_ts
  on agent_conversations (user_id, created_at desc);

comment on table agent_conversations is
  'Local Discord bot conversation memory. Written by ai-discord-bot service. '
  'Service role only; no RLS policies.';
