/**
 * Discord Webhook Service
 * Send rich embed alerts and morning briefings to Discord
 */

// ============================================================================
// TYPES
// ============================================================================

export type AlertType =
  | 'ENTRY_SIGNAL'
  | 'EXIT_SIGNAL'
  | 'POSITION_RISK'
  | 'EARNINGS_WARNING'
  | 'NEWS_EVENT'
  | 'MACRO_EVENT'
  | 'BRIEFING';

export type Priority = 'HIGH' | 'MEDIUM' | 'LOW';

export interface AlertEmbed {
  type: AlertType;
  priority: Priority;
  ticker?: string;
  headline: string;
  fields: { name: string; value: string; inline?: boolean }[];
  aiCommentary?: string;
  timestamp?: Date;
}

export interface BriefingEmbed {
  date: Date;
  marketPulse: {
    spy: { price: number; changePct: number; trend: string };
    vix: { current: number; level: string };
    regime: string;
  };
  calendar: { name: string; date: string; impact: string }[];
  watchlistAlerts: { ticker: string; reason: string }[];
  positionUpdates: { ticker: string; status: string }[];
  aiCommentary: string;
}

interface DiscordEmbed {
  title?: string;
  description?: string;
  color?: number;
  fields?: { name: string; value: string; inline?: boolean }[];
  footer?: { text: string };
  timestamp?: string;
}

interface DiscordWebhookPayload {
  content?: string;
  embeds?: DiscordEmbed[];
  username?: string;
  avatar_url?: string;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

// Read webhook URLs dynamically (env vars are injected at runtime by dotenvx)
function getWebhookUrl(): string | undefined {
  return process.env.DISCORD_WEBHOOK_URL;
}

function getBriefingWebhookUrl(): string | undefined {
  return (
    process.env.DISCORD_BRIEFING_WEBHOOK_URL || process.env.DISCORD_WEBHOOK_URL
  );
}

// Rate limiting: max 5 requests per minute
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 5;
let requestTimestamps: number[] = [];

// Color mapping by priority
const PRIORITY_COLORS: Record<Priority, number> = {
  HIGH: 0xed4245, // Red
  MEDIUM: 0xfee75c, // Yellow
  LOW: 0x57f287, // Green
};

// Alert type emojis
const ALERT_EMOJIS: Record<AlertType, string> = {
  ENTRY_SIGNAL: '🎯',
  EXIT_SIGNAL: '🚪',
  POSITION_RISK: '⚠️',
  EARNINGS_WARNING: '📅',
  NEWS_EVENT: '📰',
  MACRO_EVENT: '🏛️',
  BRIEFING: '☀️',
};

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Check if Discord is configured
 */
export function isDiscordConfigured(): boolean {
  return !!getWebhookUrl();
}

/**
 * Check rate limit
 */
function checkRateLimit(): boolean {
  const now = Date.now();
  // Remove old timestamps outside the window
  requestTimestamps = requestTimestamps.filter(
    (ts) => now - ts < RATE_LIMIT_WINDOW_MS
  );
  return requestTimestamps.length < RATE_LIMIT_MAX_REQUESTS;
}

/**
 * Record a request for rate limiting
 */
function recordRequest(): void {
  requestTimestamps.push(Date.now());
}

/**
 * Send webhook payload to Discord
 */
async function sendWebhook(
  payload: DiscordWebhookPayload,
  useBriefingWebhook = false
): Promise<boolean> {
  const webhookUrl = useBriefingWebhook
    ? getBriefingWebhookUrl()
    : getWebhookUrl();

  if (!webhookUrl) {
    console.error('Discord webhook URL not configured');
    return false;
  }

  if (!checkRateLimit()) {
    console.warn('Discord rate limit exceeded, skipping message');
    return false;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error(
        `Discord webhook error: ${response.status} ${response.statusText}`
      );
      return false;
    }

    recordRequest();
    return true;
  } catch (error) {
    console.error('Discord webhook error:', error);
    return false;
  }
}

// ============================================================================
// ALERT FUNCTIONS
// ============================================================================

/**
 * Send a trading alert to Discord
 */
export async function sendDiscordAlert(embed: AlertEmbed): Promise<boolean> {
  const emoji = ALERT_EMOJIS[embed.type];
  const color = PRIORITY_COLORS[embed.priority];

  // Build title
  let title = `${emoji} ${embed.type.replace(/_/g, ' ')}`;
  if (embed.ticker) {
    title += `: ${embed.ticker}`;
  }

  // Build fields
  const fields: { name: string; value: string; inline?: boolean }[] = [];

  // Add custom fields
  for (const field of embed.fields) {
    fields.push({
      name: field.name,
      value: field.value,
      inline: field.inline ?? true,
    });
  }

  // Add AI commentary if present
  if (embed.aiCommentary) {
    fields.push({
      name: "💭 Victor's Take",
      value: embed.aiCommentary,
      inline: false,
    });
  }

  const discordEmbed: DiscordEmbed = {
    title,
    description: embed.headline,
    color,
    fields,
    footer: {
      text: `Priority: ${embed.priority} | Agentic Victor`,
    },
    timestamp: (embed.timestamp ?? new Date()).toISOString(),
  };

  const payload: DiscordWebhookPayload = {
    username: 'Victor',
    embeds: [discordEmbed],
  };

  return sendWebhook(payload);
}

/**
 * Send entry signal alert
 */
export async function sendEntrySignal(data: {
  ticker: string;
  price: number;
  changePct: number;
  rsi?: number;
  iv?: { current: number; percentile: number; level: string };
  grade: string;
  spread?: { strikes: string; debit: number; cushion: number; dte: number };
  aiCommentary?: string;
  conviction?: number;
}): Promise<boolean> {
  const fields: { name: string; value: string; inline?: boolean }[] = [
    {
      name: '💰 Price',
      value: `$${data.price.toFixed(2)} (${data.changePct >= 0 ? '+' : ''}${data.changePct.toFixed(1)}%)`,
      inline: true,
    },
    {
      name: '📊 Grade',
      value: data.grade,
      inline: true,
    },
  ];

  if (data.rsi !== undefined) {
    const rsiStatus = data.rsi >= 35 && data.rsi <= 55 ? '✅' : '⚠️';
    fields.push({
      name: '📈 RSI',
      value: `${data.rsi.toFixed(0)} ${rsiStatus}`,
      inline: true,
    });
  }

  if (data.iv !== undefined) {
    const ivStatus =
      data.iv.level === 'LOW' || data.iv.level === 'NORMAL' ? '✅' : '⚠️';
    fields.push({
      name: '📉 IV',
      value: `${data.iv.current.toFixed(0)}% (${data.iv.percentile}th %ile) ${ivStatus}`,
      inline: true,
    });
  }

  if (data.spread) {
    fields.push({
      name: '📋 Spread',
      value: `${data.spread.strikes} @ $${data.spread.debit.toFixed(2)}`,
      inline: true,
    });
    fields.push({
      name: '🛡️ Cushion',
      value: `${data.spread.cushion.toFixed(1)}%`,
      inline: true,
    });
    fields.push({
      name: '⏱️ DTE',
      value: `${data.spread.dte}`,
      inline: true,
    });
  }

  if (data.conviction !== undefined) {
    fields.push({
      name: '🎯 Conviction',
      value: `${data.conviction}/10`,
      inline: true,
    });
  }

  return sendDiscordAlert({
    type: 'ENTRY_SIGNAL',
    priority: data.grade.startsWith('A') ? 'HIGH' : 'MEDIUM',
    ticker: data.ticker,
    headline: `Grade ${data.grade} opportunity detected`,
    fields,
    aiCommentary: data.aiCommentary,
  });
}

/**
 * Send position risk alert
 */
export async function sendPositionRisk(data: {
  ticker: string;
  reason: string;
  details: string;
  action: string;
  priority?: Priority;
}): Promise<boolean> {
  const fields: { name: string; value: string; inline?: boolean }[] = [
    {
      name: '⚠️ Risk',
      value: data.reason,
      inline: false,
    },
    {
      name: '📝 Details',
      value: data.details,
      inline: false,
    },
    {
      name: '💡 Recommended Action',
      value: data.action,
      inline: false,
    },
  ];

  return sendDiscordAlert({
    type: 'POSITION_RISK',
    priority: data.priority ?? 'MEDIUM',
    ticker: data.ticker,
    headline: `Position risk detected for ${data.ticker}`,
    fields,
  });
}

// ============================================================================
// BRIEFING FUNCTIONS
// ============================================================================

/**
 * Send morning briefing to Discord
 */
export async function sendMorningBriefing(
  briefing: BriefingEmbed
): Promise<boolean> {
  const dateStr = briefing.date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  // Market Pulse section
  const marketPulse = [
    `**SPY:** $${briefing.marketPulse.spy.price.toFixed(2)} ` +
      `(${briefing.marketPulse.spy.changePct >= 0 ? '+' : ''}${briefing.marketPulse.spy.changePct.toFixed(1)}%)`,
    `**VIX:** ${briefing.marketPulse.vix.current.toFixed(1)} (${briefing.marketPulse.vix.level})`,
    `**Regime:** ${briefing.marketPulse.regime}`,
  ].join('\n');

  // Calendar section
  let calendarSection = 'No major events today';
  if (briefing.calendar.length > 0) {
    calendarSection = briefing.calendar
      .map((e) => `• ${e.date}: ${e.name} [${e.impact}]`)
      .join('\n');
  }

  // Watchlist alerts
  let watchlistSection = 'No alerts';
  if (briefing.watchlistAlerts.length > 0) {
    watchlistSection = briefing.watchlistAlerts
      .map((a) => `• **${a.ticker}:** ${a.reason}`)
      .join('\n');
  }

  // Position updates
  let positionSection = 'No updates';
  if (briefing.positionUpdates.length > 0) {
    positionSection = briefing.positionUpdates
      .map((p) => `• **${p.ticker}:** ${p.status}`)
      .join('\n');
  }

  const fields: { name: string; value: string; inline?: boolean }[] = [
    {
      name: '📊 Market Pulse',
      value: marketPulse,
      inline: false,
    },
    {
      name: "📅 Today's Calendar",
      value: calendarSection,
      inline: false,
    },
    {
      name: '🎯 Watchlist Alerts',
      value: watchlistSection,
      inline: false,
    },
    {
      name: '💼 Position Check',
      value: positionSection,
      inline: false,
    },
  ];

  const discordEmbed: DiscordEmbed = {
    title: `☀️ Victor's Morning Briefing`,
    description: dateStr,
    color: 0x5865f2, // Discord blurple
    fields,
    footer: {
      text: 'Agentic Victor | Market Intelligence',
    },
    timestamp: briefing.date.toISOString(),
  };

  // Add AI commentary as a second embed
  const commentaryEmbed: DiscordEmbed = {
    description: `💭 **Victor's Take**\n\n${briefing.aiCommentary}`,
    color: 0x5865f2,
  };

  const payload: DiscordWebhookPayload = {
    username: 'Victor',
    embeds: [discordEmbed, commentaryEmbed],
  };

  // Use briefing webhook if configured, otherwise fall back to main webhook
  return sendWebhook(payload, true);
}

/**
 * Send a simple text message to Discord
 */
export async function sendDiscordMessage(
  message: string,
  useBriefingChannel = false
): Promise<boolean> {
  const payload: DiscordWebhookPayload = {
    content: message,
    username: 'Victor',
  };

  return sendWebhook(payload, useBriefingChannel);
}

/**
 * Test Discord webhook configuration
 */
export async function testDiscordWebhook(): Promise<boolean> {
  if (!isDiscordConfigured()) {
    console.log(
      'Discord webhook not configured. Set DISCORD_WEBHOOK_URL in .env'
    );
    return false;
  }

  return sendDiscordMessage('🤖 Victor is online and monitoring markets!');
}
