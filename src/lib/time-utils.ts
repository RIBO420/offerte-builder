/**
 * Time Utilities
 *
 * Shared utility functions for time/hour calculations.
 */

/**
 * Round hours to nearest quarter (kwartier = 0.25)
 * Used throughout the app for consistent hour rounding.
 *
 * @example
 * roundToQuarter(1.1) // returns 1.0
 * roundToQuarter(1.13) // returns 1.25
 * roundToQuarter(1.38) // returns 1.5
 * roundToQuarter(1.63) // returns 1.75
 */
export function roundToQuarter(hours: number): number {
  return Math.round(hours * 4) / 4;
}

/**
 * Format hours as a readable string
 * @example
 * formatHours(1.5) // returns "1,5 uur"
 * formatHours(0.25) // returns "0,25 uur"
 */
export function formatHours(hours: number): string {
  return `${hours.toFixed(2).replace(".", ",")} uur`;
}

/**
 * Format hours as duration string (uren en minuten)
 * @example
 * formatDuration(1.5) // returns "1 uur 30 min"
 * formatDuration(0.25) // returns "15 min"
 */
export function formatDuration(hours: number): string {
  const wholeHours = Math.floor(hours);
  const minutes = Math.round((hours - wholeHours) * 60);

  if (wholeHours === 0) {
    return `${minutes} min`;
  }
  if (minutes === 0) {
    return `${wholeHours} uur`;
  }
  return `${wholeHours} uur ${minutes} min`;
}
