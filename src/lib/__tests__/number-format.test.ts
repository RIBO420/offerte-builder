import { describe, it, expect } from "vitest";
import {
  formatPercentage,
  formatDecimal,
  formatInteger,
  formatCompact,
  formatHours,
  formatHoursWithUnit,
  formatDuration,
  roundToQuarter,
  parseNumber,
  formatOrdinal,
} from "@/lib/format/number";

describe("formatPercentage", () => {
  it("formats with default 1 decimal place", () => {
    expect(formatPercentage(25)).toBe("25,0%");
  });

  it("formats with custom decimal places", () => {
    expect(formatPercentage(25.567, 2)).toBe("25,57%");
  });

  it("formats with 0 decimal places", () => {
    expect(formatPercentage(25, 0)).toBe("25%");
  });

  it("formats zero", () => {
    expect(formatPercentage(0)).toBe("0,0%");
  });

  it("formats 100%", () => {
    expect(formatPercentage(100)).toBe("100,0%");
  });

  it("formats negative percentages", () => {
    expect(formatPercentage(-10)).toBe("-10,0%");
  });

  it("formats very small percentages", () => {
    expect(formatPercentage(0.1, 2)).toBe("0,10%");
  });

  it("formats values over 100%", () => {
    expect(formatPercentage(150)).toBe("150,0%");
  });
});

describe("formatDecimal", () => {
  it("formats with default 2 decimal places in Dutch locale", () => {
    expect(formatDecimal(1234.56)).toBe("1.234,56");
  });

  it("formats with 1 decimal place", () => {
    expect(formatDecimal(1234.5, 1)).toBe("1.234,5");
  });

  it("formats with 0 decimal places", () => {
    expect(formatDecimal(1234, 0)).toBe("1.234");
  });

  it("formats zero", () => {
    expect(formatDecimal(0)).toBe("0,00");
  });

  it("formats negative numbers", () => {
    const result = formatDecimal(-1234.56);
    expect(result).toContain("1.234,56");
    expect(result).toMatch(/-/);
  });

  it("formats very large numbers", () => {
    expect(formatDecimal(1234567.89)).toBe("1.234.567,89");
  });

  it("formats small decimal values", () => {
    expect(formatDecimal(0.01)).toBe("0,01");
  });
});

describe("formatInteger", () => {
  it("formats with thousand separators", () => {
    expect(formatInteger(1234567)).toBe("1.234.567");
  });

  it("formats small numbers without separator", () => {
    expect(formatInteger(999)).toBe("999");
  });

  it("formats zero", () => {
    expect(formatInteger(0)).toBe("0");
  });

  it("rounds decimal input", () => {
    // formatInteger uses maximumFractionDigits: 0, so it rounds
    const result = formatInteger(1234.7);
    expect(result).toBe("1.235");
  });
});

describe("formatCompact", () => {
  it("formats billions with B suffix", () => {
    expect(formatCompact(1500000000)).toBe("1,5B");
  });

  it("formats millions with M suffix", () => {
    expect(formatCompact(2300000)).toBe("2,3M");
  });

  it("formats exact millions", () => {
    expect(formatCompact(1000000)).toBe("1,0M");
  });

  it("formats thousands with K suffix", () => {
    expect(formatCompact(1500)).toBe("1,5K");
  });

  it("formats exact thousands without decimals", () => {
    expect(formatCompact(2000)).toBe("2K");
    expect(formatCompact(5000)).toBe("5K");
  });

  it("formats values below 1000 without suffix", () => {
    expect(formatCompact(500)).toBe("500");
    expect(formatCompact(99)).toBe("99");
  });

  it("formats zero", () => {
    expect(formatCompact(0)).toBe("0");
  });

  it("formats negative millions", () => {
    expect(formatCompact(-2300000)).toBe("-2,3M");
  });

  it("formats negative thousands", () => {
    expect(formatCompact(-1500)).toBe("-1,5K");
  });

  it("formats negative small values", () => {
    expect(formatCompact(-42)).toBe("-42");
  });

  it("rounds small values", () => {
    expect(formatCompact(499.7)).toBe("500");
    expect(formatCompact(0.4)).toBe("0");
  });
});

describe("formatHours", () => {
  it("formats with default 1 decimal place", () => {
    expect(formatHours(8.5)).toBe("8,5");
  });

  it("formats with custom decimal places", () => {
    expect(formatHours(8.567, 2)).toBe("8,57");
  });

  it("formats zero hours", () => {
    expect(formatHours(0)).toBe("0,0");
  });

  it("formats whole hours", () => {
    expect(formatHours(8)).toBe("8,0");
  });
});

describe("formatHoursWithUnit", () => {
  it("formats with uur suffix and default 2 decimals", () => {
    expect(formatHoursWithUnit(8.5)).toBe("8,50 uur");
  });

  it("formats zero", () => {
    expect(formatHoursWithUnit(0)).toBe("0,00 uur");
  });

  it("respects custom decimals", () => {
    expect(formatHoursWithUnit(8.5, 1)).toBe("8,5 uur");
  });
});

describe("formatDuration", () => {
  it("formats hours and minutes", () => {
    expect(formatDuration(1.5)).toBe("1 uur 30 min");
    expect(formatDuration(2.25)).toBe("2 uur 15 min");
  });

  it("formats whole hours without minutes", () => {
    expect(formatDuration(2)).toBe("2 uur");
  });

  it("formats minutes only when less than 1 hour", () => {
    expect(formatDuration(0.25)).toBe("15 min");
    expect(formatDuration(0.5)).toBe("30 min");
  });

  it("formats zero as 0 minutes", () => {
    expect(formatDuration(0)).toBe("0 min");
  });
});

describe("roundToQuarter", () => {
  it("rounds to nearest 0.25", () => {
    expect(roundToQuarter(1.0)).toBe(1.0);
    expect(roundToQuarter(1.1)).toBe(1.0);
    expect(roundToQuarter(1.13)).toBe(1.25);
    expect(roundToQuarter(1.38)).toBe(1.5);
    expect(roundToQuarter(1.63)).toBe(1.75);
    expect(roundToQuarter(1.88)).toBe(2.0);
  });

  it("handles zero", () => {
    expect(roundToQuarter(0)).toBe(0);
  });
});

describe("parseNumber", () => {
  it("parses Dutch format with thousand separators", () => {
    expect(parseNumber("1.234,56")).toBe(1234.56);
  });

  it("parses without thousand separators", () => {
    expect(parseNumber("1234,56")).toBe(1234.56);
  });

  it("parses whole numbers", () => {
    expect(parseNumber("500")).toBe(500);
  });

  it("parses zero", () => {
    expect(parseNumber("0")).toBe(0);
    expect(parseNumber("0,00")).toBe(0);
  });

  it("parses negative numbers", () => {
    expect(parseNumber("-1.234,56")).toBe(-1234.56);
  });

  it("parses large numbers", () => {
    expect(parseNumber("1.000.000,00")).toBe(1000000);
  });

  it("returns 0 for empty string", () => {
    expect(parseNumber("")).toBe(0);
  });

  it("returns 0 for non-string input", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(parseNumber(null as any)).toBe(0);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(parseNumber(undefined as any)).toBe(0);
  });

  it("returns 0 for invalid input", () => {
    expect(parseNumber("abc")).toBe(0);
    expect(parseNumber("niet een nummer")).toBe(0);
  });

  it("parses small decimal values", () => {
    expect(parseNumber("0,01")).toBe(0.01);
    expect(parseNumber("0,99")).toBe(0.99);
  });
});

describe("formatOrdinal", () => {
  it("formats Dutch ordinals with 'e' suffix", () => {
    expect(formatOrdinal(1)).toBe("1e");
    expect(formatOrdinal(2)).toBe("2e");
    expect(formatOrdinal(3)).toBe("3e");
    expect(formatOrdinal(10)).toBe("10e");
    expect(formatOrdinal(100)).toBe("100e");
  });
});
