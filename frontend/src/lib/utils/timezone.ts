/**
 * Timezone utility functions for consistent date/time display
 * 
 * All timestamps from the backend are stored in UTC.
 * All frontend displays should show times in EST/EDT 
 * (US Eastern Time) since that's when US stock markets operate.
 */

import { formatInTimeZone } from 'date-fns-tz';
import { parseISO } from 'date-fns';

/**
 * US Eastern Timezone (handles both EST and EDT automatically)
 */
export const US_EASTERN_TZ = 'America/New_York';

/**
 * Format a date/timestamp to EST timezone
 * 
 * @param date - Date string (ISO format) or Date object
 * @param formatStr - Format string (date-fns format)
 * @returns Formatted date string in EST
 * 
 * @example
 * formatInEST('2024-11-07T14:30:00Z', 'yyyy-MM-dd HH:mm:ss')
 * // Returns: "2024-11-07 09:30:00" (EST)
 */
export function formatInEST(
  date: string | Date, 
  formatStr: string = 'yyyy-MM-dd HH:mm:ss'
): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return formatInTimeZone(dateObj, US_EASTERN_TZ, formatStr);
}

/**
 * Format a date to EST date only (no time)
 * 
 * @param date - Date string (ISO format) or Date object
 * @returns Formatted date string in EST (e.g., "Nov 7, 2024")
 */
export function formatDateEST(date: string | Date): string {
  return formatInEST(date, 'MMM d, yyyy');
}

/**
 * Format a time to EST time only (no date)
 * 
 * @param date - Date string (ISO format) or Date object
 * @returns Formatted time string in EST (e.g., "2:30 PM")
 */
export function formatTimeEST(date: string | Date): string {
  return formatInEST(date, 'h:mm a');
}

/**
 * Format a full date and time to EST with weekday
 * 
 * @param date - Date string (ISO format) or Date object
 * @returns Formatted date/time string in EST 
 * (e.g., "Thu, Nov 7, 2024 2:30 PM")
 */
export function formatDateTimeESTLong(date: string | Date): string {
  return formatInEST(date, 'EEE, MMM d, yyyy h:mm a');
}

/**
 * Format a short date for grouping (e.g., in charts)
 * 
 * @param date - Date string (ISO format) or Date object
 * @returns Formatted short date string in EST 
 * (e.g., "Nov 7")
 */
export function formatShortDateEST(date: string | Date): string {
  return formatInEST(date, 'MMM d');
}

/**
 * Format a date with weekday abbreviation for grouping
 * 
 * @param date - Date string (ISO format) or Date object
 * @returns Formatted date string with weekday in EST 
 * (e.g., "Thu, Nov 7")
 */
export function formatDateWithWeekdayEST(date: string | Date): string {
  return formatInEST(date, 'EEE, MMM d');
}

/**
 * Get the current time in EST
 * 
 * @returns Current Date object
 */
export function getCurrentTimeEST(): Date {
  return new Date();
}

/**
 * Format a date for locale display (compatibility wrapper)
 * This maintains compatibility with existing code 
 * that uses toLocaleDateString()
 * 
 * @param date - Date string (ISO format) or Date object
 * @param options - Locale options (ignored, uses EST)
 * @returns Formatted date string in EST
 */
export function toLocaleDateStringEST(
  date: string | Date,
  options?: Intl.DateTimeFormatOptions
): string {
  // Map common locale options to date-fns format
  if (options?.weekday && options?.month && options?.day) {
    return formatDateWithWeekdayEST(date);
  }
  return formatDateEST(date);
}

/**
 * Format a time for locale display (compatibility wrapper)
 * This maintains compatibility with existing code 
 * that uses toLocaleTimeString()
 * 
 * @param date - Date string (ISO format) or Date object
 * @param options - Locale options (ignored, uses EST)
 * @returns Formatted time string in EST
 */
export function toLocaleTimeStringEST(
  date: string | Date,
  _options?: Intl.DateTimeFormatOptions
): string {
  return formatTimeEST(date);
}

/**
 * Format a full date and time for locale display 
 * (compatibility wrapper)
 * This maintains compatibility with existing code 
 * that uses toLocaleString()
 * 
 * @param date - Date string (ISO format) or Date object
 * @returns Formatted date/time string in EST
 */
export function toLocaleStringEST(date: string | Date): string {
  return formatInEST(date, 'MM/dd/yyyy h:mm a');
}

