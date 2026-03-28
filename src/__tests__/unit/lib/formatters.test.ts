import { describe, it, expect } from "vitest";
import {
  formatCurrency,
  formatPercent,
  formatDecimal,
  formatDate,
  formatShortDate,
  formatDateTime,
} from "@/lib/formatters";

// ============================================================
// formatCurrency — EUR formatting
// ============================================================
describe("formatCurrency", () => {
  it("formats positive amounts with EUR symbol", () => {
    const result = formatCurrency(1234.56);
    // nl-NL format: "€ 1.234,56" (with various space chars)
    expect(result).toContain("€");
    expect(result).toContain("1.234");
    expect(result).toContain("56");
  });

  it("formats zero amount", () => {
    const result = formatCurrency(0);
    expect(result).toContain("€");
    expect(result).toContain("0");
  });

  it("formats negative amounts", () => {
    const result = formatCurrency(-500);
    expect(result).toContain("€");
    expect(result).toContain("500");
  });

  it("formats decimal amounts", () => {
    const result = formatCurrency(99.99);
    expect(result).toContain("99");
  });

  it("formats large amounts with thousand separators", () => {
    const result = formatCurrency(1000000);
    expect(result).toContain("€");
    expect(result).toContain("1.000.000");
  });
});

// ============================================================
// formatPercent — percentage formatting
// ============================================================
describe("formatPercent", () => {
  it("formats 0.25 as 25%", () => {
    const result = formatPercent(0.25);
    expect(result).toContain("25");
    expect(result).toContain("%");
  });

  it("formats 1.0 as 100%", () => {
    const result = formatPercent(1.0);
    expect(result).toContain("100");
    expect(result).toContain("%");
  });

  it("formats 0 as 0%", () => {
    const result = formatPercent(0);
    expect(result).toContain("0");
    expect(result).toContain("%");
  });

  it("formats fractional percentages with up to 1 decimal", () => {
    const result = formatPercent(0.333);
    // Should display 33.3% (max 1 decimal)
    expect(result).toContain("33");
    expect(result).toContain("%");
  });

  it("formats negative percentages", () => {
    const result = formatPercent(-0.1);
    expect(result).toContain("10");
    expect(result).toContain("%");
  });
});

// ============================================================
// formatDecimal
// ============================================================
describe("formatDecimal", () => {
  it("formats with exactly 2 decimal places", () => {
    const result = formatDecimal(3.14159);
    // nl-NL uses comma for decimals: "3,14"
    expect(result).toContain("3,14");
  });

  it("pads integers to 2 decimal places", () => {
    const result = formatDecimal(42);
    expect(result).toContain("42,00");
  });

  it("formats zero", () => {
    const result = formatDecimal(0);
    expect(result).toContain("0,00");
  });

  it("formats large numbers with thousand separators", () => {
    const result = formatDecimal(1234.5);
    expect(result).toContain("1.234,50");
  });
});

// ============================================================
// formatDate — long date
// ============================================================
describe("formatDate", () => {
  it("formats Date object to Dutch long date", () => {
    const date = new Date(2024, 5, 15); // June 15, 2024
    const result = formatDate(date);
    expect(result).toContain("15");
    expect(result).toContain("2024");
    // Should contain Dutch month name
    expect(result.toLowerCase()).toContain("juni");
  });

  it("formats string date", () => {
    const result = formatDate("2024-01-01");
    expect(result).toContain("2024");
    expect(result.toLowerCase()).toContain("januari");
  });

  it("formats numeric timestamp", () => {
    const timestamp = new Date(2024, 11, 25).getTime(); // Dec 25, 2024
    const result = formatDate(timestamp);
    expect(result).toContain("25");
    expect(result.toLowerCase()).toContain("december");
  });
});

// ============================================================
// formatShortDate
// ============================================================
describe("formatShortDate", () => {
  it("formats date in DD-MM-YYYY style", () => {
    const date = new Date(2024, 5, 15);
    const result = formatShortDate(date);
    // nl-NL short: "15-06-2024" or similar
    expect(result).toContain("15");
    expect(result).toContain("06");
    expect(result).toContain("2024");
  });

  it("formats string date", () => {
    const result = formatShortDate("2024-12-31");
    expect(result).toContain("2024");
    expect(result).toContain("12");
    expect(result).toContain("31");
  });
});

// ============================================================
// formatDateTime
// ============================================================
describe("formatDateTime", () => {
  it("formats date with time", () => {
    const date = new Date(2024, 5, 15, 14, 30);
    const result = formatDateTime(date);
    expect(result).toContain("15");
    expect(result).toContain("2024");
    expect(result.toLowerCase()).toContain("juni");
    expect(result).toContain("14");
    expect(result).toContain("30");
  });

  it("formats midnight", () => {
    const date = new Date(2024, 0, 1, 0, 0);
    const result = formatDateTime(date);
    expect(result).toContain("00");
  });

  it("handles string date input", () => {
    const result = formatDateTime("2024-06-15T14:30:00");
    expect(result).toContain("2024");
  });
});
