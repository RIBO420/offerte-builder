/**
 * Currency Formatting Utilities
 *
 * Centralized currency formatting functions for Dutch locale (nl-NL).
 * Used throughout the app for consistent currency display.
 */

/**
 * Format a number as currency in Dutch locale.
 *
 * @param amount - The amount to format
 * @param locale - The locale to use (default: "nl-NL")
 * @param showDecimals - Whether to show decimal places (default: true)
 * @returns Formatted currency string (e.g., "€ 1.234,56")
 *
 * @example
 * formatCurrency(1234.56) // "€ 1.234,56"
 * formatCurrency(1234.56, "nl-NL", false) // "€ 1.235"
 */
export function formatCurrency(
  amount: number,
  locale: string = "nl-NL",
  showDecimals: boolean = true
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  }).format(amount);
}

/**
 * Parse a currency string back to a number.
 * Handles Dutch locale format with comma as decimal separator.
 *
 * @param str - The currency string to parse
 * @returns The numeric value
 *
 * @example
 * parseCurrency("€ 1.234,56") // 1234.56
 * parseCurrency("1.234,56") // 1234.56
 * parseCurrency("1234,56") // 1234.56
 */
export function parseCurrency(str: string): number {
  if (!str || typeof str !== "string") return 0;

  // Remove currency symbol and whitespace
  let cleaned = str.replace(/[€\s]/g, "").trim();

  // Handle Dutch format: 1.234,56 -> 1234.56
  // First remove thousand separators (dots), then replace comma with dot
  cleaned = cleaned.replace(/\./g, "").replace(",", ".");

  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Format currency in compact notation for large amounts.
 * Uses K for thousands and M for millions.
 *
 * @param amount - The amount to format
 * @returns Compact formatted string (e.g., "€1,5K", "€2,3M")
 *
 * @example
 * formatCurrencyCompact(1500) // "€1,5K"
 * formatCurrencyCompact(2300000) // "€2,3M"
 * formatCurrencyCompact(500) // "€500"
 */
export function formatCurrencyCompact(amount: number): string {
  const absAmount = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";

  if (absAmount >= 1_000_000) {
    const value = absAmount / 1_000_000;
    return `${sign}€${value.toFixed(1).replace(".", ",")}M`;
  }

  if (absAmount >= 1_000) {
    const value = absAmount / 1_000;
    // Use 0 decimals for clean thousands, 1 decimal otherwise
    const formatted =
      value % 1 === 0
        ? value.toFixed(0)
        : value.toFixed(1).replace(".", ",");
    return `${sign}€${formatted}K`;
  }

  // For small amounts, show without decimals
  return `${sign}€${Math.round(absAmount)}`;
}

/**
 * Format currency for numeric operations (no symbol, rounded to cents).
 * Useful for Excel exports and calculations.
 *
 * @param amount - The amount to format
 * @returns Rounded number value
 *
 * @example
 * formatCurrencyNumeric(1234.567) // 1234.57
 */
export function formatCurrencyNumeric(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/**
 * Format currency with custom options.
 * Provides full control over formatting.
 *
 * @param amount - The amount to format
 * @param options - Formatting options
 * @returns Formatted currency string
 */
export function formatCurrencyCustom(
  amount: number,
  options: {
    locale?: string;
    currency?: string;
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
    showSymbol?: boolean;
  } = {}
): string {
  const {
    locale = "nl-NL",
    currency = "EUR",
    minimumFractionDigits = 2,
    maximumFractionDigits = 2,
    showSymbol = true,
  } = options;

  if (showSymbol) {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits,
      maximumFractionDigits,
    }).format(amount);
  }

  return new Intl.NumberFormat(locale, {
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(amount);
}
