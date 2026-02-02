/**
 * Date Formatting Utilities
 *
 * Centralized date formatting functions for Dutch locale (nl-NL).
 * Used throughout the app for consistent date display.
 */

/**
 * Convert various date inputs to a Date object.
 */
function toDate(date: Date | number | string): Date {
  if (date instanceof Date) return date;
  if (typeof date === "number") return new Date(date);
  return new Date(date);
}

/**
 * Format a date for display (day, month, year).
 *
 * @param date - The date to format (Date object, timestamp, or ISO string)
 * @returns Formatted date string (e.g., "15 jan. 2024")
 *
 * @example
 * formatDate(new Date()) // "2 feb. 2026"
 * formatDate(1706889600000) // "2 feb. 2024"
 */
export function formatDate(date: Date | number | string): string {
  const d = toDate(date);
  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

/**
 * Format a date with full month name.
 *
 * @param date - The date to format
 * @returns Formatted date string (e.g., "15 januari 2024")
 *
 * @example
 * formatDateLong(new Date()) // "2 februari 2026"
 */
export function formatDateLong(date: Date | number | string): string {
  const d = toDate(date);
  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

/**
 * Format a date with weekday.
 *
 * @param date - The date to format
 * @returns Formatted date string (e.g., "maandag 15 januari 2024")
 *
 * @example
 * formatDateWithWeekday(new Date()) // "maandag 2 februari 2026"
 */
export function formatDateWithWeekday(date: Date | number | string): string {
  const d = toDate(date);
  return new Intl.DateTimeFormat("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

/**
 * Format a date for compact display (DD-MM-YYYY).
 *
 * @param date - The date to format
 * @returns Formatted date string (e.g., "15-01-2024")
 *
 * @example
 * formatDateCompact(new Date()) // "02-02-2026"
 */
export function formatDateCompact(date: Date | number | string): string {
  const d = toDate(date);
  return new Intl.DateTimeFormat("nl-NL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

/**
 * Format a date and time for display.
 *
 * @param date - The date to format
 * @returns Formatted datetime string (e.g., "15 jan. 2024 14:30")
 *
 * @example
 * formatDateTime(new Date()) // "2 feb. 2026 14:30"
 */
export function formatDateTime(date: Date | number | string): string {
  const d = toDate(date);
  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/**
 * Format a time for display.
 *
 * @param date - The date to format
 * @returns Formatted time string (e.g., "14:30")
 *
 * @example
 * formatTime(new Date()) // "14:30"
 */
export function formatTime(date: Date | number | string): string {
  const d = toDate(date);
  return new Intl.DateTimeFormat("nl-NL", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/**
 * Format a date as relative time from now.
 *
 * @param date - The date to format
 * @returns Relative time string (e.g., "2 dagen geleden", "over 3 uur")
 *
 * @example
 * formatRelativeTime(Date.now() - 86400000) // "1 dag geleden"
 * formatRelativeTime(Date.now() + 3600000) // "over 1 uur"
 */
export function formatRelativeTime(date: Date | number | string): string {
  const d = toDate(date);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffSeconds = Math.round(diffMs / 1000);
  const diffMinutes = Math.round(diffSeconds / 60);
  const diffHours = Math.round(diffMinutes / 60);
  const diffDays = Math.round(diffHours / 24);
  const diffWeeks = Math.round(diffDays / 7);
  const diffMonths = Math.round(diffDays / 30);
  const diffYears = Math.round(diffDays / 365);

  const rtf = new Intl.RelativeTimeFormat("nl-NL", { numeric: "auto" });

  if (Math.abs(diffSeconds) < 60) {
    return rtf.format(diffSeconds, "second");
  }
  if (Math.abs(diffMinutes) < 60) {
    return rtf.format(diffMinutes, "minute");
  }
  if (Math.abs(diffHours) < 24) {
    return rtf.format(diffHours, "hour");
  }
  if (Math.abs(diffDays) < 7) {
    return rtf.format(diffDays, "day");
  }
  if (Math.abs(diffWeeks) < 4) {
    return rtf.format(diffWeeks, "week");
  }
  if (Math.abs(diffMonths) < 12) {
    return rtf.format(diffMonths, "month");
  }
  return rtf.format(diffYears, "year");
}

/**
 * Format a date range for display.
 *
 * @param start - The start date
 * @param end - The end date
 * @returns Formatted date range string
 *
 * @example
 * formatDateRange(new Date('2024-01-15'), new Date('2024-01-20'))
 * // "15 - 20 jan. 2024"
 *
 * formatDateRange(new Date('2024-01-15'), new Date('2024-02-20'))
 * // "15 jan. - 20 feb. 2024"
 *
 * formatDateRange(new Date('2023-12-15'), new Date('2024-01-20'))
 * // "15 dec. 2023 - 20 jan. 2024"
 */
export function formatDateRange(
  start: Date | number | string,
  end: Date | number | string
): string {
  const startDate = toDate(start);
  const endDate = toDate(end);

  const sameYear = startDate.getFullYear() === endDate.getFullYear();
  const sameMonth =
    sameYear && startDate.getMonth() === endDate.getMonth();

  if (sameMonth) {
    // Same month: "15 - 20 jan. 2024"
    const startDay = startDate.getDate();
    const endFormatted = formatDate(endDate);
    return `${startDay} - ${endFormatted}`;
  }

  if (sameYear) {
    // Same year: "15 jan. - 20 feb. 2024"
    const startFormatted = new Intl.DateTimeFormat("nl-NL", {
      day: "numeric",
      month: "short",
    }).format(startDate);
    const endFormatted = formatDate(endDate);
    return `${startFormatted} - ${endFormatted}`;
  }

  // Different years: "15 dec. 2023 - 20 jan. 2024"
  return `${formatDate(startDate)} - ${formatDate(endDate)}`;
}

/**
 * Format month and year.
 *
 * @param date - The date to format
 * @returns Formatted month string (e.g., "januari 2024")
 *
 * @example
 * formatMonth(new Date()) // "februari 2026"
 */
export function formatMonth(date: Date | number | string): string {
  const d = toDate(date);
  return new Intl.DateTimeFormat("nl-NL", {
    month: "long",
    year: "numeric",
  }).format(d);
}

/**
 * Get ISO date string (YYYY-MM-DD) from a date.
 * Useful for form inputs and API calls.
 *
 * @param date - The date to format
 * @returns ISO date string (e.g., "2024-01-15")
 *
 * @example
 * getISODateString(new Date()) // "2026-02-02"
 */
export function getISODateString(date: Date | number | string): string {
  const d = toDate(date);
  return d.toISOString().split("T")[0];
}

/**
 * Get today's date as ISO string.
 *
 * @returns Today's date in YYYY-MM-DD format
 */
export function getTodayString(): string {
  return getISODateString(new Date());
}

/**
 * Get a date N days ago as ISO string.
 *
 * @param days - Number of days ago
 * @returns Date string in YYYY-MM-DD format
 */
export function getDaysAgoString(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return getISODateString(date);
}
