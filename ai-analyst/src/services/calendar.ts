/**
 * Economic Calendar Service
 * Provides awareness of major market events: 
 * FOMC, CPI, Jobs Report (NFP), GDP, Fed Speeches, holidays
 */

// ============================================================================
// TYPES
// ============================================================================

export type EventType = 
  | 'FOMC'      // Fed rate decision
  | 'CPI'       // Consumer Price Index
  | 'NFP'       // Non-Farm Payrolls (Jobs Report)
  | 'GDP'       // Gross Domestic Product
  | 'FED'       // Fed speeches, Beige Book
  | 'HOLIDAY'   // Market closed
  | 'WITCHING'  // Options expiration
  | 'ECONOMIC'; // Other economic data

export interface MarketEvent {
  date: Date;
  name: string;
  type: EventType;
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
  description?: string;
}

export interface CalendarContext {
  upcomingEvents: MarketEvent[];
  nextMajorEvent: MarketEvent | null;
  daysUntilNextEvent: number | null;
  isMarketOpen: boolean;
  marketStatus: string;
  warnings: string[];
}

// ============================================================================
// STATIC CALENDAR DATA (2024-2025)
// ============================================================================

// FOMC Meeting Dates (2024-2025)
// Source: Federal Reserve official schedule
const FOMC_DATES_2024_2025 = [
  // 2024
  { date: '2024-01-31', name: 'FOMC Meeting' },
  { date: '2024-03-20', name: 'FOMC Meeting' },
  { date: '2024-05-01', name: 'FOMC Meeting' },
  { date: '2024-06-12', name: 'FOMC Meeting' },
  { date: '2024-07-31', name: 'FOMC Meeting' },
  { date: '2024-09-18', name: 'FOMC Meeting' },
  { date: '2024-11-07', name: 'FOMC Meeting' },
  { date: '2024-12-18', name: 'FOMC Meeting' },
  // 2025 (announcement dates - typically Wednesday of 2-day meetings)
  { date: '2025-01-29', name: 'FOMC Meeting' },
  { date: '2025-03-19', name: 'FOMC Meeting' },
  { date: '2025-05-07', name: 'FOMC Meeting' },
  { date: '2025-06-18', name: 'FOMC Meeting' },
  { date: '2025-07-30', name: 'FOMC Meeting' },
  { date: '2025-09-17', name: 'FOMC Meeting' },
  { date: '2025-11-05', name: 'FOMC Meeting' },
  { date: '2025-12-10', name: 'FOMC Meeting' },  // Dec 9-10 meeting, announcement Dec 10
];

// Major US Market Holidays (2024-2025)
const MARKET_HOLIDAYS_2024_2025 = [
  // 2024
  { date: '2024-01-01', name: "New Year's Day" },
  { date: '2024-01-15', name: 'MLK Day' },
  { date: '2024-02-19', name: "Presidents' Day" },
  { date: '2024-03-29', name: 'Good Friday' },
  { date: '2024-05-27', name: 'Memorial Day' },
  { date: '2024-06-19', name: 'Juneteenth' },
  { date: '2024-07-04', name: 'Independence Day' },
  { date: '2024-09-02', name: 'Labor Day' },
  { date: '2024-11-28', name: 'Thanksgiving' },
  { date: '2024-12-25', name: 'Christmas' },
  // 2025
  { date: '2025-01-01', name: "New Year's Day" },
  { date: '2025-01-20', name: 'MLK Day' },
  { date: '2025-02-17', name: "Presidents' Day" },
  { date: '2025-04-18', name: 'Good Friday' },
  { date: '2025-05-26', name: 'Memorial Day' },
  { date: '2025-06-19', name: 'Juneteenth' },
  { date: '2025-07-04', name: 'Independence Day' },
  { date: '2025-09-01', name: 'Labor Day' },
  { date: '2025-11-27', name: 'Thanksgiving' },
  { date: '2025-12-25', name: 'Christmas' },
];

// Triple/Quadruple Witching Days (options expiration)
const WITCHING_DATES_2024_2025 = [
  // 2024
  { date: '2024-03-15', name: 'Quad Witching' },
  { date: '2024-06-21', name: 'Quad Witching' },
  { date: '2024-09-20', name: 'Quad Witching' },
  { date: '2024-12-20', name: 'Quad Witching' },
  // 2025
  { date: '2025-03-21', name: 'Quad Witching' },
  { date: '2025-06-20', name: 'Quad Witching' },
  { date: '2025-09-19', name: 'Quad Witching' },
  { date: '2025-12-19', name: 'Quad Witching' },
];

// CPI Release Dates (2024-2025)
// Released around 8:30 AM ET, usually second week of month
const CPI_DATES_2024_2025 = [
  // 2024
  { date: '2024-01-11', name: 'CPI Report' },
  { date: '2024-02-13', name: 'CPI Report' },
  { date: '2024-03-12', name: 'CPI Report' },
  { date: '2024-04-10', name: 'CPI Report' },
  { date: '2024-05-15', name: 'CPI Report' },
  { date: '2024-06-12', name: 'CPI Report' },
  { date: '2024-07-11', name: 'CPI Report' },
  { date: '2024-08-14', name: 'CPI Report' },
  { date: '2024-09-11', name: 'CPI Report' },
  { date: '2024-10-10', name: 'CPI Report' },
  { date: '2024-11-13', name: 'CPI Report' },
  { date: '2024-12-11', name: 'CPI Report' },
  // 2025
  { date: '2025-01-15', name: 'CPI Report' },
  { date: '2025-02-12', name: 'CPI Report' },
  { date: '2025-03-12', name: 'CPI Report' },
  { date: '2025-04-10', name: 'CPI Report' },
  { date: '2025-05-13', name: 'CPI Report' },
  { date: '2025-06-11', name: 'CPI Report' },
  { date: '2025-07-11', name: 'CPI Report' },
  { date: '2025-08-12', name: 'CPI Report' },
  { date: '2025-09-10', name: 'CPI Report' },
  { date: '2025-10-10', name: 'CPI Report' },
  { date: '2025-11-13', name: 'CPI Report' },
  { date: '2025-12-10', name: 'CPI Report' },
];

// Jobs Report / Non-Farm Payrolls (2024-2025)
// Released first Friday of month at 8:30 AM ET
const NFP_DATES_2024_2025 = [
  // 2024
  { date: '2024-01-05', name: 'Jobs Report (NFP)' },
  { date: '2024-02-02', name: 'Jobs Report (NFP)' },
  { date: '2024-03-08', name: 'Jobs Report (NFP)' },
  { date: '2024-04-05', name: 'Jobs Report (NFP)' },
  { date: '2024-05-03', name: 'Jobs Report (NFP)' },
  { date: '2024-06-07', name: 'Jobs Report (NFP)' },
  { date: '2024-07-05', name: 'Jobs Report (NFP)' },
  { date: '2024-08-02', name: 'Jobs Report (NFP)' },
  { date: '2024-09-06', name: 'Jobs Report (NFP)' },
  { date: '2024-10-04', name: 'Jobs Report (NFP)' },
  { date: '2024-11-01', name: 'Jobs Report (NFP)' },
  { date: '2024-12-06', name: 'Jobs Report (NFP)' },
  // 2025
  { date: '2025-01-10', name: 'Jobs Report (NFP)' },
  { date: '2025-02-07', name: 'Jobs Report (NFP)' },
  { date: '2025-03-07', name: 'Jobs Report (NFP)' },
  { date: '2025-04-04', name: 'Jobs Report (NFP)' },
  { date: '2025-05-02', name: 'Jobs Report (NFP)' },
  { date: '2025-06-06', name: 'Jobs Report (NFP)' },
  { date: '2025-07-03', name: 'Jobs Report (NFP)' },
  { date: '2025-08-01', name: 'Jobs Report (NFP)' },
  { date: '2025-09-05', name: 'Jobs Report (NFP)' },
  { date: '2025-10-03', name: 'Jobs Report (NFP)' },
  { date: '2025-11-07', name: 'Jobs Report (NFP)' },
  { date: '2025-12-05', name: 'Jobs Report (NFP)' },
];

// GDP Releases (2024-2025)
// Released quarterly, typically end of month
const GDP_DATES_2024_2025 = [
  // 2024 (advance, second, third estimates)
  { date: '2024-01-25', name: 'GDP Q4 Advance' },
  { date: '2024-02-28', name: 'GDP Q4 Second' },
  { date: '2024-03-28', name: 'GDP Q4 Third' },
  { date: '2024-04-25', name: 'GDP Q1 Advance' },
  { date: '2024-05-30', name: 'GDP Q1 Second' },
  { date: '2024-06-27', name: 'GDP Q1 Third' },
  { date: '2024-07-25', name: 'GDP Q2 Advance' },
  { date: '2024-08-29', name: 'GDP Q2 Second' },
  { date: '2024-09-26', name: 'GDP Q2 Third' },
  { date: '2024-10-30', name: 'GDP Q3 Advance' },
  { date: '2024-11-27', name: 'GDP Q3 Second' },
  { date: '2024-12-19', name: 'GDP Q3 Third' },
  // 2025
  { date: '2025-01-30', name: 'GDP Q4 Advance' },
  { date: '2025-02-27', name: 'GDP Q4 Second' },
  { date: '2025-03-27', name: 'GDP Q4 Third' },
  { date: '2025-04-30', name: 'GDP Q1 Advance' },
  { date: '2025-05-29', name: 'GDP Q1 Second' },
  { date: '2025-06-26', name: 'GDP Q1 Third' },
  { date: '2025-07-30', name: 'GDP Q2 Advance' },
  { date: '2025-08-28', name: 'GDP Q2 Second' },
  { date: '2025-09-25', name: 'GDP Q2 Third' },
  { date: '2025-10-30', name: 'GDP Q3 Advance' },
  { date: '2025-11-26', name: 'GDP Q3 Second' },
  { date: '2025-12-23', name: 'GDP Q3 Third' },
];

// Fed Beige Book and Major Speeches (2024-2025)
const FED_EVENTS_2024_2025 = [
  // 2024 Beige Book releases (8 per year, ~2 weeks before FOMC)
  { date: '2024-01-17', name: 'Fed Beige Book' },
  { date: '2024-03-06', name: 'Fed Beige Book' },
  { date: '2024-04-17', name: 'Fed Beige Book' },
  { date: '2024-05-29', name: 'Fed Beige Book' },
  { date: '2024-07-17', name: 'Fed Beige Book' },
  { date: '2024-09-04', name: 'Fed Beige Book' },
  { date: '2024-10-23', name: 'Fed Beige Book' },
  { date: '2024-12-04', name: 'Fed Beige Book' },
  // 2025 Beige Book releases
  { date: '2025-01-15', name: 'Fed Beige Book' },
  { date: '2025-03-05', name: 'Fed Beige Book' },
  { date: '2025-04-23', name: 'Fed Beige Book' },
  { date: '2025-06-04', name: 'Fed Beige Book' },
  { date: '2025-07-16', name: 'Fed Beige Book' },
  { date: '2025-09-03', name: 'Fed Beige Book' },
  { date: '2025-10-22', name: 'Fed Beige Book' },
  { date: '2025-12-03', name: 'Fed Beige Book' },
];

// ============================================================================
// FUNCTIONS
// ============================================================================

function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function daysBetween(date1: Date, date2: Date): number {
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.ceil((date2.getTime() - date1.getTime()) / oneDay);
}

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function isMarketHours(date: Date): boolean {
  const hour = date.getHours();
  const minute = date.getMinutes();
  const time = hour * 60 + minute;
  
  // Market hours: 9:30 AM - 4:00 PM ET
  // Note: This assumes the system is in ET timezone
  return time >= 9 * 60 + 30 && time < 16 * 60;
}

function isHoliday(date: Date): boolean {
  const dateStr = date.toISOString().split('T')[0];
  return MARKET_HOLIDAYS_2024_2025.some(h => h.date === dateStr);
}

/**
 * Get all upcoming market events within N days
 */
export function getUpcomingEvents(withinDays: number = 14): MarketEvent[] {
  const now = new Date();
  const events: MarketEvent[] = [];

  // Add FOMC meetings (HIGH impact)
  for (const fomc of FOMC_DATES_2024_2025) {
    const date = parseDate(fomc.date);
    const days = daysBetween(now, date);
    if (days > 0 && days <= withinDays) {
      events.push({
        date,
        name: fomc.name,
        type: 'FOMC',
        impact: 'HIGH',
        description: 'Federal Reserve interest rate decision',
      });
    }
  }

  // Add CPI releases (HIGH impact)
  for (const cpi of CPI_DATES_2024_2025) {
    const date = parseDate(cpi.date);
    const days = daysBetween(now, date);
    if (days > 0 && days <= withinDays) {
      events.push({
        date,
        name: cpi.name,
        type: 'CPI',
        impact: 'HIGH',
        description: 'Consumer Price Index - inflation data',
      });
    }
  }

  // Add Jobs Report / NFP (HIGH impact)
  for (const nfp of NFP_DATES_2024_2025) {
    const date = parseDate(nfp.date);
    const days = daysBetween(now, date);
    if (days > 0 && days <= withinDays) {
      events.push({
        date,
        name: nfp.name,
        type: 'NFP',
        impact: 'HIGH',
        description: 'Non-Farm Payrolls - employment data',
      });
    }
  }

  // Add GDP releases (MEDIUM impact - advance is higher)
  for (const gdp of GDP_DATES_2024_2025) {
    const date = parseDate(gdp.date);
    const days = daysBetween(now, date);
    if (days > 0 && days <= withinDays) {
      const isAdvance = gdp.name.includes('Advance');
      events.push({
        date,
        name: gdp.name,
        type: 'GDP',
        impact: isAdvance ? 'HIGH' : 'MEDIUM',
        description: 'Gross Domestic Product growth data',
      });
    }
  }

  // Add Fed events (MEDIUM impact)
  for (const fed of FED_EVENTS_2024_2025) {
    const date = parseDate(fed.date);
    const days = daysBetween(now, date);
    if (days > 0 && days <= withinDays) {
      events.push({
        date,
        name: fed.name,
        type: 'FED',
        impact: 'MEDIUM',
        description: 'Fed regional economic report',
      });
    }
  }

  // Add holidays (MEDIUM impact - market closed)
  for (const holiday of MARKET_HOLIDAYS_2024_2025) {
    const date = parseDate(holiday.date);
    const days = daysBetween(now, date);
    if (days > 0 && days <= withinDays) {
      events.push({
        date,
        name: holiday.name,
        type: 'HOLIDAY',
        impact: 'MEDIUM',
        description: 'Market closed',
      });
    }
  }

  // Add witching days (MEDIUM impact)
  for (const witch of WITCHING_DATES_2024_2025) {
    const date = parseDate(witch.date);
    const days = daysBetween(now, date);
    if (days > 0 && days <= withinDays) {
      events.push({
        date,
        name: witch.name,
        type: 'WITCHING',
        impact: 'MEDIUM',
        description: 'High volume options expiration day',
      });
    }
  }

  // Sort by date
  events.sort((a, b) => a.date.getTime() - b.date.getTime());
  
  return events;
}

/**
 * Get full calendar context for AI
 */
export function getCalendarContext(): CalendarContext {
  const now = new Date();
  const upcomingEvents = getUpcomingEvents(14);
  const warnings: string[] = [];

  // Determine market status
  let isMarketOpen = false;
  let marketStatus = '';
  
  if (isWeekend(now)) {
    marketStatus = 'CLOSED (Weekend)';
  } else if (isHoliday(now)) {
    const holiday = MARKET_HOLIDAYS_2024_2025.find(
      h => h.date === now.toISOString().split('T')[0]
    );
    marketStatus = `CLOSED (${holiday?.name ?? 'Holiday'})`;
  } else if (isMarketHours(now)) {
    isMarketOpen = true;
    marketStatus = 'OPEN';
  } else {
    const hour = now.getHours();
    if (hour < 9 || (hour === 9 && now.getMinutes() < 30)) {
      marketStatus = 'PRE-MARKET';
    } else {
      marketStatus = 'AFTER-HOURS';
    }
  }

  // Find next major event
  const nextMajorEvent = upcomingEvents.find(e => e.impact === 'HIGH') ?? null;
  const daysUntilNextEvent = nextMajorEvent 
    ? daysBetween(now, nextMajorEvent.date) 
    : null;

  // Check for FOMC within 10 days (full lead-up period)
  const fomcSoon = upcomingEvents.find(
    e => e.type === 'FOMC' && daysBetween(now, e.date) <= 10
  );
  if (fomcSoon) {
    const daysToFomc = daysBetween(now, fomcSoon.date);
    const urgency = daysToFomc <= 3 ? '⚠️' : '🏛️';
    warnings.push(
      `${urgency} FOMC Meeting ${formatDate(fomcSoon.date)} (${daysToFomc}d) - ` +
      `${daysToFomc <= 3 ? 'HIGH volatility risk' : 'Fed rate decision pending'}`
    );
  }
  
  // Check for CPI within 5 days (major market mover)
  const cpiSoon = upcomingEvents.find(
    e => e.type === 'CPI' && daysBetween(now, e.date) <= 5
  );
  if (cpiSoon) {
    const daysToCpi = daysBetween(now, cpiSoon.date);
    const urgency = daysToCpi <= 2 ? '⚠️' : '📊';
    warnings.push(
      `${urgency} CPI Report ${formatDate(cpiSoon.date)} (${daysToCpi}d) - ` +
      `${daysToCpi <= 2 ? 'HIGH volatility expected' : 'Inflation data release'}`
    );
  }
  
  // Check for Jobs Report within 5 days
  const nfpSoon = upcomingEvents.find(
    e => e.type === 'NFP' && daysBetween(now, e.date) <= 5
  );
  if (nfpSoon) {
    const daysToNfp = daysBetween(now, nfpSoon.date);
    const urgency = daysToNfp <= 2 ? '⚠️' : '👷';
    warnings.push(
      `${urgency} Jobs Report ${formatDate(nfpSoon.date)} (${daysToNfp}d) - ` +
      `${daysToNfp <= 2 ? 'Employment data can move markets' : 'NFP release pending'}`
    );
  }
  
  // Check for GDP Advance within 3 days (advance estimates most impactful)
  const gdpSoon = upcomingEvents.find(
    e => e.type === 'GDP' && e.name.includes('Advance') && daysBetween(now, e.date) <= 3
  );
  if (gdpSoon) {
    const daysToGdp = daysBetween(now, gdpSoon.date);
    warnings.push(
      `📈 ${gdpSoon.name} ${formatDate(gdpSoon.date)} (${daysToGdp}d) - growth data release`
    );
  }

  // Check for witching
  const witchingThisWeek = upcomingEvents.find(
    e => e.type === 'WITCHING' && daysBetween(now, e.date) <= 5
  );
  if (witchingThisWeek) {
    warnings.push(
      `📊 Quad Witching ${formatDate(witchingThisWeek.date)} - expect high volume`
    );
  }

  return {
    upcomingEvents,
    nextMajorEvent,
    daysUntilNextEvent,
    isMarketOpen,
    marketStatus,
    warnings,
  };
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { 
    weekday: 'short', 
    month: 'short', 
    day: 'numeric' 
  });
}

/**
 * Format calendar context for AI prompt
 */
export function formatCalendarForAI(): string {
  const ctx = getCalendarContext();
  let output = '';

  output += `\n=== ECONOMIC CALENDAR ===\n`;
  output += `Market Status: ${ctx.marketStatus}\n`;

  if (ctx.warnings.length > 0) {
    output += `\nWARNINGS:\n`;
    for (const w of ctx.warnings) {
      output += `  ${w}\n`;
    }
  }

  if (ctx.upcomingEvents.length > 0) {
    output += `\nUpcoming Events (14 days):\n`;
    for (const e of ctx.upcomingEvents.slice(0, 5)) {
      const days = daysBetween(new Date(), e.date);
      output += `  • ${formatDate(e.date)} (${days}d): ${e.name} [${e.impact}]\n`;
    }
  }

  output += `=== END CALENDAR ===\n`;
  
  return output;
}

