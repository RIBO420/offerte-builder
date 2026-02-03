/**
 * Shared formatters for consistent number and date formatting across the app.
 * These are instantiated once and reused to avoid performance overhead.
 */

// Currency formatter for EUR
const currencyFormatter = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
});

// Number formatter for percentages
const percentFormatter = new Intl.NumberFormat("nl-NL", {
  style: "percent",
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

// Number formatter for decimals
const decimalFormatter = new Intl.NumberFormat("nl-NL", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// Date formatters
const dateFormatter = new Intl.DateTimeFormat("nl-NL", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

const shortDateFormatter = new Intl.DateTimeFormat("nl-NL", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const dateTimeFormatter = new Intl.DateTimeFormat("nl-NL", {
  year: "numeric",
  month: "long",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

// Export formatter functions
export function formatCurrency(amount: number): string {
  return currencyFormatter.format(amount);
}

export function formatPercent(value: number): string {
  return percentFormatter.format(value);
}

export function formatDecimal(value: number): string {
  return decimalFormatter.format(value);
}

export function formatDate(date: Date | number | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return dateFormatter.format(d);
}

export function formatShortDate(date: Date | number | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return shortDateFormatter.format(d);
}

export function formatDateTime(date: Date | number | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return dateTimeFormatter.format(d);
}
