/**
 * Number Formatting Utilities
 *
 * Centralized number formatting functions for Dutch locale (nl-NL).
 * Used throughout the app for consistent number display.
 */

/**
 * Format a number as a percentage.
 *
 * @param value - The percentage value (e.g., 25 for 25%)
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted percentage string (e.g., "25,0%")
 *
 * @example
 * formatPercentage(25) // "25,0%"
 * formatPercentage(25.567, 2) // "25,57%"
 * formatPercentage(25, 0) // "25%"
 */
export function formatPercentage(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals).replace(".", ",")}%`;
}

/**
 * Format a decimal number for Dutch locale.
 *
 * @param value - The number to format
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted decimal string (e.g., "1.234,56")
 *
 * @example
 * formatDecimal(1234.56) // "1.234,56"
 * formatDecimal(1234.5, 1) // "1.234,5"
 * formatDecimal(1234, 0) // "1.234"
 */
export function formatDecimal(value: number, decimals: number = 2): string {
  return new Intl.NumberFormat("nl-NL", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Format a number with thousand separators (no decimal places).
 *
 * @param value - The number to format
 * @returns Formatted integer string (e.g., "1.234")
 *
 * @example
 * formatInteger(1234567) // "1.234.567"
 */
export function formatInteger(value: number): string {
  return new Intl.NumberFormat("nl-NL", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Format a number in compact notation.
 *
 * @param value - The number to format
 * @returns Compact formatted string (e.g., "1,5K", "2,3M")
 *
 * @example
 * formatCompact(1500) // "1,5K"
 * formatCompact(2300000) // "2,3M"
 * formatCompact(500) // "500"
 */
export function formatCompact(value: number): string {
  const absValue = Math.abs(value);
  const sign = value < 0 ? "-" : "";

  if (absValue >= 1_000_000_000) {
    return `${sign}${(absValue / 1_000_000_000).toFixed(1).replace(".", ",")}B`;
  }

  if (absValue >= 1_000_000) {
    return `${sign}${(absValue / 1_000_000).toFixed(1).replace(".", ",")}M`;
  }

  if (absValue >= 1_000) {
    const formatted = absValue / 1_000;
    return `${sign}${formatted % 1 === 0 ? formatted.toFixed(0) : formatted.toFixed(1).replace(".", ",")}K`;
  }

  return `${sign}${Math.round(absValue)}`;
}

/**
 * Format hours for display.
 *
 * @param hours - The number of hours
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted hours string with comma as decimal separator
 *
 * @example
 * formatHours(8.5) // "8,5"
 * formatHours(8.567, 2) // "8,57"
 */
export function formatHours(hours: number, decimals: number = 1): string {
  return hours.toFixed(decimals).replace(".", ",");
}

/**
 * Format hours with "uur" suffix.
 *
 * @param hours - The number of hours
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted hours string (e.g., "8,50 uur")
 *
 * @example
 * formatHoursWithUnit(8.5) // "8,50 uur"
 */
export function formatHoursWithUnit(
  hours: number,
  decimals: number = 2
): string {
  return `${hours.toFixed(decimals).replace(".", ",")} uur`;
}

/**
 * Format hours as duration (hours and minutes).
 *
 * @param hours - The number of hours
 * @returns Formatted duration string (e.g., "1 uur 30 min")
 *
 * @example
 * formatDuration(1.5) // "1 uur 30 min"
 * formatDuration(0.25) // "15 min"
 * formatDuration(2) // "2 uur"
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

/**
 * Round hours to nearest quarter (0.25).
 *
 * @param hours - The number of hours
 * @returns Rounded hours
 *
 * @example
 * roundToQuarter(1.1) // 1.0
 * roundToQuarter(1.13) // 1.25
 * roundToQuarter(1.38) // 1.5
 */
export function roundToQuarter(hours: number): number {
  return Math.round(hours * 4) / 4;
}

/**
 * Parse a Dutch-formatted number string to a number.
 *
 * @param str - The number string to parse
 * @returns The numeric value
 *
 * @example
 * parseNumber("1.234,56") // 1234.56
 * parseNumber("1234,56") // 1234.56
 */
export function parseNumber(str: string): number {
  if (!str || typeof str !== "string") return 0;

  // Handle Dutch format: 1.234,56 -> 1234.56
  const cleaned = str.replace(/\./g, "").replace(",", ".");
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Format a number as ordinal in Dutch.
 *
 * @param value - The number to format
 * @returns Ordinal string (e.g., "1e", "2e", "3e")
 *
 * @example
 * formatOrdinal(1) // "1e"
 * formatOrdinal(2) // "2e"
 */
export function formatOrdinal(value: number): string {
  return `${value}e`;
}
