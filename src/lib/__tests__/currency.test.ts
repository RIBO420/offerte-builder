import { describe, it, expect } from "vitest";
import {
  formatCurrency,
  parseCurrency,
  formatCurrencyCompact,
  formatCurrencyNumeric,
  formatCurrencyCustom,
} from "@/lib/format/currency";

describe("parseCurrency", () => {
  it("parses Dutch format with thousand separators", () => {
    expect(parseCurrency("1.234,56")).toBe(1234.56);
  });

  it("parses format with currency symbol", () => {
    expect(parseCurrency("\u20AC 1.234,56")).toBe(1234.56);
  });

  it("parses format without thousand separators", () => {
    expect(parseCurrency("1234,56")).toBe(1234.56);
  });

  it("parses zero values", () => {
    expect(parseCurrency("0")).toBe(0);
    expect(parseCurrency("0,00")).toBe(0);
  });

  it("parses negative amounts", () => {
    expect(parseCurrency("-1.234,56")).toBe(-1234.56);
    expect(parseCurrency("-500,00")).toBe(-500);
  });

  it("parses large amounts", () => {
    expect(parseCurrency("1.000.000,00")).toBe(1000000);
    expect(parseCurrency("12.345.678,90")).toBe(12345678.9);
  });

  it("parses small amounts", () => {
    expect(parseCurrency("0,01")).toBe(0.01);
    expect(parseCurrency("0,99")).toBe(0.99);
  });

  it("returns 0 for empty string", () => {
    expect(parseCurrency("")).toBe(0);
  });

  it("returns 0 for non-string input", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(parseCurrency(null as any)).toBe(0);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(parseCurrency(undefined as any)).toBe(0);
  });

  it("returns 0 for invalid input", () => {
    expect(parseCurrency("abc")).toBe(0);
    expect(parseCurrency("geen bedrag")).toBe(0);
  });

  it("parses whole numbers without decimals", () => {
    expect(parseCurrency("1.000")).toBe(1000);
    expect(parseCurrency("500")).toBe(500);
  });
});

describe("formatCurrency", () => {
  it("formats a standard amount in Dutch locale", () => {
    const result = formatCurrency(1234.56);
    // Intl may use non-breaking space; normalize for comparison
    const normalized = result.replace(/\s/g, " ");
    expect(normalized).toContain("1.234,56");
    expect(normalized).toContain("\u20AC");
  });

  it("formats zero", () => {
    const result = formatCurrency(0).replace(/\s/g, " ");
    expect(result).toContain("0,00");
    expect(result).toContain("\u20AC");
  });

  it("formats negative amounts", () => {
    const result = formatCurrency(-500).replace(/\s/g, " ");
    expect(result).toContain("500,00");
    // Should contain a negative sign or minus indicator
    expect(result).toMatch(/-/);
  });

  it("formats very large amounts", () => {
    const result = formatCurrency(1000000).replace(/\s/g, " ");
    expect(result).toContain("1.000.000,00");
  });

  it("formats very small amounts (cents)", () => {
    const result = formatCurrency(0.01).replace(/\s/g, " ");
    expect(result).toContain("0,01");
  });

  it("handles NaN by formatting as NaN indicator", () => {
    // Intl.NumberFormat.format(NaN) returns "NaN" in most environments
    const result = formatCurrency(NaN);
    expect(result).toBeDefined();
  });

  it("respects showDecimals=false", () => {
    const result = formatCurrency(1234.56, "nl-NL", false).replace(/\s/g, " ");
    // With showDecimals=false, should round and not show decimals
    expect(result).toContain("1.235");
    expect(result).not.toContain(",");
  });

  it("respects custom locale parameter", () => {
    const result = formatCurrency(1234.56, "en-US");
    // en-US format uses period for decimals
    expect(result).toContain("1,234.56");
  });
});

describe("formatCurrencyCompact", () => {
  it("formats millions with M suffix", () => {
    expect(formatCurrencyCompact(2300000)).toBe("\u20AC2,3M");
  });

  it("formats exact millions", () => {
    expect(formatCurrencyCompact(1000000)).toBe("\u20AC1,0M");
  });

  it("formats thousands with K suffix", () => {
    expect(formatCurrencyCompact(1500)).toBe("\u20AC1,5K");
  });

  it("formats exact thousands without decimals", () => {
    expect(formatCurrencyCompact(2000)).toBe("\u20AC2K");
    expect(formatCurrencyCompact(5000)).toBe("\u20AC5K");
  });

  it("formats amounts below 1000 without suffix", () => {
    expect(formatCurrencyCompact(500)).toBe("\u20AC500");
    expect(formatCurrencyCompact(99)).toBe("\u20AC99");
  });

  it("formats zero", () => {
    expect(formatCurrencyCompact(0)).toBe("\u20AC0");
  });

  it("formats negative millions", () => {
    expect(formatCurrencyCompact(-2300000)).toBe("-\u20AC2,3M");
  });

  it("formats negative thousands", () => {
    expect(formatCurrencyCompact(-1500)).toBe("-\u20AC1,5K");
  });

  it("formats negative small amounts", () => {
    expect(formatCurrencyCompact(-500)).toBe("-\u20AC500");
  });

  it("rounds small amounts to nearest integer", () => {
    expect(formatCurrencyCompact(499.7)).toBe("\u20AC500");
    expect(formatCurrencyCompact(0.4)).toBe("\u20AC0");
  });
});

describe("formatCurrencyNumeric", () => {
  it("rounds to two decimal places", () => {
    expect(formatCurrencyNumeric(1234.567)).toBe(1234.57);
    expect(formatCurrencyNumeric(1234.564)).toBe(1234.56);
  });

  it("preserves exact two-decimal amounts", () => {
    expect(formatCurrencyNumeric(1234.56)).toBe(1234.56);
  });

  it("handles zero", () => {
    expect(formatCurrencyNumeric(0)).toBe(0);
  });

  it("handles negative amounts", () => {
    expect(formatCurrencyNumeric(-1234.567)).toBe(-1234.57);
  });

  it("handles whole numbers", () => {
    expect(formatCurrencyNumeric(100)).toBe(100);
  });

  it("handles very small amounts", () => {
    expect(formatCurrencyNumeric(0.001)).toBe(0);
    expect(formatCurrencyNumeric(0.005)).toBe(0.01);
  });

  it("handles very large amounts", () => {
    expect(formatCurrencyNumeric(999999.999)).toBe(1000000);
  });
});

describe("formatCurrencyCustom", () => {
  it("formats with default options (EUR, nl-NL, 2 decimals, symbol)", () => {
    const result = formatCurrencyCustom(1234.56).replace(/\s/g, " ");
    expect(result).toContain("\u20AC");
    expect(result).toContain("1.234,56");
  });

  it("formats without symbol when showSymbol=false", () => {
    const result = formatCurrencyCustom(1234.56, { showSymbol: false });
    expect(result).not.toContain("\u20AC");
    expect(result).toContain("1.234,56");
  });

  it("respects custom fraction digits", () => {
    const result = formatCurrencyCustom(1234.5, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).replace(/\s/g, " ");
    expect(result).toContain("1.235");
  });

  it("supports different locale", () => {
    const result = formatCurrencyCustom(1234.56, { locale: "en-US" });
    expect(result).toContain("1,234.56");
  });
});

describe("round-trip: parseCurrency(formatCurrency(amount))", () => {
  it("preserves standard amounts", () => {
    const amounts = [0, 1, 100, 1234.56, 99999.99, 0.01, 0.5];
    for (const amount of amounts) {
      const formatted = formatCurrency(amount);
      const parsed = parseCurrency(formatted);
      expect(parsed).toBeCloseTo(amount, 2);
    }
  });

  it("preserves negative amounts", () => {
    const formatted = formatCurrency(-1234.56);
    const parsed = parseCurrency(formatted);
    expect(parsed).toBeCloseTo(-1234.56, 2);
  });

  it("preserves large amounts", () => {
    const formatted = formatCurrency(1000000);
    const parsed = parseCurrency(formatted);
    expect(parsed).toBeCloseTo(1000000, 2);
  });
});
