import { describe, it, expect } from "vitest";
import { roundToQuarter, formatHours, formatDuration } from "@/lib/time-utils";

describe("roundToQuarter", () => {
  it("rounds to nearest 0.25", () => {
    expect(roundToQuarter(1.0)).toBe(1.0);
    expect(roundToQuarter(1.1)).toBe(1.0);
    expect(roundToQuarter(1.13)).toBe(1.25);
    expect(roundToQuarter(1.25)).toBe(1.25);
    expect(roundToQuarter(1.38)).toBe(1.5);
    expect(roundToQuarter(1.5)).toBe(1.5);
    expect(roundToQuarter(1.63)).toBe(1.75);
    expect(roundToQuarter(1.75)).toBe(1.75);
    expect(roundToQuarter(1.88)).toBe(2.0);
  });

  it("handles zero", () => {
    expect(roundToQuarter(0)).toBe(0);
  });

  it("handles small values", () => {
    expect(roundToQuarter(0.1)).toBe(0);
    expect(roundToQuarter(0.13)).toBe(0.25);
    expect(roundToQuarter(0.25)).toBe(0.25);
  });

  it("handles large values", () => {
    expect(roundToQuarter(100.13)).toBe(100.25);
    expect(roundToQuarter(100.38)).toBe(100.5);
  });
});

describe("formatHours", () => {
  it("formats hours with Dutch decimal separator", () => {
    expect(formatHours(1.5)).toBe("1,50 uur");
    expect(formatHours(0.25)).toBe("0,25 uur");
    expect(formatHours(2)).toBe("2,00 uur");
  });
});

describe("formatDuration", () => {
  it("formats hours and minutes", () => {
    expect(formatDuration(1.5)).toBe("1 uur 30 min");
    expect(formatDuration(2.25)).toBe("2 uur 15 min");
  });

  it("handles whole hours", () => {
    expect(formatDuration(2)).toBe("2 uur");
  });

  it("handles minutes only", () => {
    expect(formatDuration(0.25)).toBe("15 min");
    expect(formatDuration(0.5)).toBe("30 min");
  });
});
