/**
 * Economic Calendar Service
 *
 * Re-exports from shared library for backward compatibility.
 * The canonical implementation is in @lib/ai-agent/calendar.
 *
 * This file is maintained for:
 * - Backward compatibility with existing CLI imports
 * - Potential CLI-specific extensions in the future
 *
 * @example
 * ```typescript
 * // CLI usage (unchanged)
 * import { getCalendarContext, formatCalendarForAI } from '../services/calendar';
 *
 * // Or use the shared library directly
 * import { getCalendarContext } from '@lib/ai-agent';
 * ```
 */

// Re-export everything from the shared library
export {
  // Types
  type EventType,
  type MarketEvent,
  type CalendarContext,

  // Functions
  getUpcomingEvents,
  getCalendarContext,
  formatCalendarForAI,
  encodeCalendarToTOON,
} from '../../../lib/ai-agent/calendar';
