import { NextResponse } from 'next/server';

interface EconomicEvent {
  date: string;
  title: string;
  impact: 'high' | 'medium' | 'low';
  country: string;
}

// Cache for 1 hour (events don't change frequently)
let cachedEvents: EconomicEvent[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Get OPEX dates (3rd Friday of each month)
 */
function getOpexDates(year: number = new Date().getFullYear()): Date[] {
  const dates: Date[] = [];
  for (let month = 0; month < 12; month++) {
    // Find the first day of the month
    const firstDay = new Date(year, month, 1);
    // Find the first Friday
    const firstFriday = 1 + ((5 - firstDay.getDay() + 7) % 7);
    // Third Friday is 14 days after first Friday
    const thirdFriday = firstFriday + 14;
    dates.push(new Date(year, month, thirdFriday));
  }
  return dates;
}

/**
 * Get Triple Witching dates (3rd Friday of Mar, Jun, Sep, Dec)
 */
function getTripleWitchingDates(year: number): Date[] {
  const opex = getOpexDates(year);
  // March (2), June (5), September (8), December (11)
  return [opex[2], opex[5], opex[8], opex[11]];
}

/**
 * Try to fetch from Investing.com (may fail due to CORS/blocking)
 */
async function fetchInvestingComEvents(
  from: string,
  to: string
): Promise<EconomicEvent[]> {
  try {
    const url =
      'https://www.investing.com/economic-calendar/Service/getCalendarFilteredData';

    const body = {
      dateFrom: from,
      dateTo: to,
      timeZone: 58, // EST
      timeFilter: 'timeRemain',
      currentTab: 'custom',
      limit_from: 0,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Requested-With': 'XMLHttpRequest',
        'User-Agent': 'Mozilla/5.0 (compatible)',
      },
      body: new URLSearchParams(body as Record<string, string>).toString(),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const json = await response.json();
    const html = json.data as string;

    if (!html) return [];

    const events: EconomicEvent[] = [];

    // Parse high-impact US events from HTML
    // Look for rows with high volatility and USD currency
    const rowRegex =
      /<tr[^>]*class="[^"]*js-event-item[^"]*"[^>]*>[\s\S]*?<\/tr>/gi;
    const rows = html.match(rowRegex) || [];

    for (const row of rows) {
      // Check for high impact (3 bulls)
      const isHighImpact = (row.match(/grayFullBull498/g) || []).length >= 3;

      // Check for USD
      const isUSD =
        row.includes('data-country="USD"') || row.includes('cemark-USD');

      if (!isHighImpact || !isUSD) continue;

      // Extract event title
      const titleMatch = row.match(
        /class="event"[^>]*>[\s\S]*?<a[^>]+>([^<]+)<\/a>/
      );
      const title = titleMatch?.[1]?.trim() || '';

      // Extract date/time
      const timeMatch = row.match(/data-event-datetime="([^"]+)"/);
      const date = timeMatch?.[1] || from;

      if (title) {
        events.push({
          date,
          title,
          impact: 'high',
          country: 'USD',
        });
      }
    }

    return events;
  } catch (error) {
    console.error('Failed to fetch Investing.com calendar:', error);
    return [];
  }
}

/**
 * Generate known events as fallback
 */
function getKnownEvents(year: number): EconomicEvent[] {
  const events: EconomicEvent[] = [];

  // FOMC meetings (approximate - 8 per year)
  const fomcDates = [
    `${year}-01-29`,
    `${year}-03-19`,
    `${year}-05-07`,
    `${year}-06-18`,
    `${year}-07-30`,
    `${year}-09-17`,
    `${year}-11-05`,
    `${year}-12-17`,
  ];

  for (const date of fomcDates) {
    events.push({
      date,
      title: 'FOMC Interest Rate Decision',
      impact: 'high',
      country: 'USD',
    });
  }

  // Jobs Report (first Friday of each month)
  for (let month = 0; month < 12; month++) {
    const firstDay = new Date(year, month, 1);
    const firstFriday = 1 + ((5 - firstDay.getDay() + 7) % 7);
    const date = new Date(year, month, firstFriday);
    events.push({
      date: date.toISOString().split('T')[0],
      title: 'Nonfarm Payrolls',
      impact: 'high',
      country: 'USD',
    });
  }

  // CPI (usually mid-month)
  for (let month = 0; month < 12; month++) {
    const date = new Date(year, month, 12 + Math.floor(Math.random() * 3));
    events.push({
      date: date.toISOString().split('T')[0],
      title: 'CPI m/m',
      impact: 'high',
      country: 'USD',
    });
  }

  // Triple Witching
  for (const date of getTripleWitchingDates(year)) {
    events.push({
      date: date.toISOString().split('T')[0],
      title: 'Triple Witching',
      impact: 'high',
      country: 'USD',
    });
  }

  // OPEX (monthly)
  for (const date of getOpexDates(year)) {
    events.push({
      date: date.toISOString().split('T')[0],
      title: 'Monthly Options Expiration',
      impact: 'medium',
      country: 'USD',
    });
  }

  return events;
}

export async function GET() {
  // Check cache
  if (cachedEvents && Date.now() - cacheTimestamp < CACHE_TTL) {
    return NextResponse.json(cachedEvents);
  }

  const now = new Date();
  const from = now.toISOString().split('T')[0];
  const to = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];

  // Try Investing.com first
  let events = await fetchInvestingComEvents(from, to);

  // If no events from API, use fallback
  if (events.length === 0) {
    const currentYear = now.getFullYear();
    const allEvents = [
      ...getKnownEvents(currentYear),
      ...getKnownEvents(currentYear + 1),
    ];

    // Filter to next 30 days
    events = allEvents.filter((e) => {
      const eventDate = new Date(e.date);
      return eventDate >= now && eventDate <= new Date(to);
    });
  }

  // Sort by date
  events.sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Cache results
  cachedEvents = events;
  cacheTimestamp = Date.now();

  return NextResponse.json(events);
}
