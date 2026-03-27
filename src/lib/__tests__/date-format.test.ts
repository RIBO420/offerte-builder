import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  formatDate,
  formatDateLong,
  formatDateWithWeekday,
  formatDateCompact,
  formatDateTime,
  formatTime,
  formatRelativeTime,
  formatDateRange,
  formatMonth,
  getISODateString,
  getTodayString,
  getDaysAgoString,
} from "@/lib/format/date";

describe("formatDate", () => {
  it("formats a Date object in Dutch short format", () => {
    // January 15, 2024
    const date = new Date(2024, 0, 15);
    const result = formatDate(date);
    expect(result).toContain("15");
    expect(result).toContain("2024");
    // Dutch short month for January is "jan."
    expect(result.toLowerCase()).toMatch(/jan/);
  });

  it("formats a timestamp", () => {
    const timestamp = new Date(2024, 0, 15).getTime();
    const result = formatDate(timestamp);
    expect(result).toContain("15");
    expect(result).toContain("2024");
  });

  it("formats an ISO string", () => {
    const result = formatDate("2024-01-15T12:00:00Z");
    expect(result).toContain("15");
    expect(result).toContain("2024");
  });

  it("formats different months correctly", () => {
    const feb = formatDate(new Date(2024, 1, 1));
    expect(feb.toLowerCase()).toMatch(/feb/);

    const dec = formatDate(new Date(2024, 11, 25));
    expect(dec.toLowerCase()).toMatch(/dec/);
  });
});

describe("formatDateLong", () => {
  it("formats with full Dutch month name", () => {
    const date = new Date(2024, 0, 15);
    const result = formatDateLong(date);
    expect(result).toContain("15");
    expect(result).toContain("2024");
    expect(result.toLowerCase()).toContain("januari");
  });

  it("formats February correctly", () => {
    const date = new Date(2024, 1, 1);
    const result = formatDateLong(date);
    expect(result.toLowerCase()).toContain("februari");
  });
});

describe("formatDateWithWeekday", () => {
  it("includes Dutch weekday name", () => {
    // January 15, 2024 is a Monday (maandag)
    const date = new Date(2024, 0, 15);
    const result = formatDateWithWeekday(date);
    expect(result.toLowerCase()).toContain("maandag");
    expect(result).toContain("15");
    expect(result.toLowerCase()).toContain("januari");
    expect(result).toContain("2024");
  });
});

describe("formatDateCompact", () => {
  it("formats as DD-MM-YYYY", () => {
    const date = new Date(2024, 0, 15);
    const result = formatDateCompact(date);
    expect(result).toBe("15-01-2024");
  });

  it("pads single-digit days and months", () => {
    const date = new Date(2024, 0, 5);
    const result = formatDateCompact(date);
    expect(result).toBe("05-01-2024");
  });
});

describe("formatDateTime", () => {
  it("includes date and time", () => {
    const date = new Date(2024, 0, 15, 14, 30);
    const result = formatDateTime(date);
    expect(result).toContain("15");
    expect(result).toContain("2024");
    expect(result).toContain("14:30");
  });
});

describe("formatTime", () => {
  it("formats time in 24h format", () => {
    const date = new Date(2024, 0, 15, 14, 30);
    const result = formatTime(date);
    expect(result).toBe("14:30");
  });

  it("formats midnight", () => {
    const date = new Date(2024, 0, 15, 0, 0);
    const result = formatTime(date);
    expect(result).toBe("00:00");
  });

  it("pads single-digit minutes", () => {
    const date = new Date(2024, 0, 15, 9, 5);
    const result = formatTime(date);
    expect(result).toBe("09:05");
  });
});

describe("formatRelativeTime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 5, 15, 12, 0, 0)); // June 15, 2024, noon
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("formats seconds ago", () => {
    const thirtySecondsAgo = Date.now() - 30_000;
    const result = formatRelativeTime(thirtySecondsAgo);
    // Dutch: "30 seconden geleden"
    expect(result.toLowerCase()).toMatch(/seconde|seconden/);
    expect(result.toLowerCase()).toMatch(/geleden/);
  });

  it("formats minutes ago", () => {
    const fiveMinutesAgo = Date.now() - 5 * 60_000;
    const result = formatRelativeTime(fiveMinutesAgo);
    expect(result.toLowerCase()).toMatch(/minu/);
    expect(result.toLowerCase()).toMatch(/geleden/);
  });

  it("formats hours ago", () => {
    const threeHoursAgo = Date.now() - 3 * 3_600_000;
    const result = formatRelativeTime(threeHoursAgo);
    expect(result.toLowerCase()).toMatch(/uur/);
    expect(result.toLowerCase()).toMatch(/geleden/);
  });

  it("formats days ago", () => {
    const twoDaysAgo = Date.now() - 2 * 86_400_000;
    const result = formatRelativeTime(twoDaysAgo);
    // Dutch Intl with numeric: "auto" may produce "eergisteren" for 2 days ago
    expect(result.toLowerCase()).toMatch(/dag|dagen|eergisteren/);
  });

  it("formats weeks ago", () => {
    const twoWeeksAgo = Date.now() - 14 * 86_400_000;
    const result = formatRelativeTime(twoWeeksAgo);
    expect(result.toLowerCase()).toMatch(/we/);
    expect(result.toLowerCase()).toMatch(/geleden/);
  });

  it("formats months ago", () => {
    const twoMonthsAgo = Date.now() - 60 * 86_400_000;
    const result = formatRelativeTime(twoMonthsAgo);
    expect(result.toLowerCase()).toMatch(/maand/);
    expect(result.toLowerCase()).toMatch(/geleden/);
  });

  it("formats years ago", () => {
    const twoYearsAgo = Date.now() - 730 * 86_400_000;
    const result = formatRelativeTime(twoYearsAgo);
    expect(result.toLowerCase()).toMatch(/jaar/);
    expect(result.toLowerCase()).toMatch(/geleden/);
  });

  it("formats future times", () => {
    const inOneHour = Date.now() + 3_600_000;
    const result = formatRelativeTime(inOneHour);
    expect(result.toLowerCase()).toMatch(/over|uur/);
  });

  it("handles 'yesterday' special case", () => {
    const yesterday = Date.now() - 86_400_000;
    const result = formatRelativeTime(yesterday);
    // Intl numeric: "auto" may produce "gisteren" for exactly 1 day ago
    expect(result.toLowerCase()).toMatch(/gisteren|dag/);
  });
});

describe("formatDateRange", () => {
  it("formats same-month range", () => {
    const start = new Date(2024, 0, 15);
    const end = new Date(2024, 0, 20);
    const result = formatDateRange(start, end);
    // "15 - 20 jan. 2024"
    expect(result).toContain("15");
    expect(result).toContain("20");
    expect(result).toContain("2024");
    expect(result.toLowerCase()).toMatch(/jan/);
    // Should only have year once
    expect(result.split("2024").length).toBe(2); // appears once
  });

  it("formats same-year different-month range", () => {
    const start = new Date(2024, 0, 15);
    const end = new Date(2024, 1, 20);
    const result = formatDateRange(start, end);
    // "15 jan. - 20 feb. 2024"
    expect(result).toContain("15");
    expect(result).toContain("20");
    expect(result.toLowerCase()).toMatch(/jan/);
    expect(result.toLowerCase()).toMatch(/feb/);
    expect(result).toContain("2024");
  });

  it("formats different-year range", () => {
    const start = new Date(2023, 11, 15);
    const end = new Date(2024, 0, 20);
    const result = formatDateRange(start, end);
    // "15 dec. 2023 - 20 jan. 2024"
    expect(result).toContain("2023");
    expect(result).toContain("2024");
    expect(result).toContain("15");
    expect(result).toContain("20");
  });

  it("formats same-day range", () => {
    const start = new Date(2024, 0, 15);
    const end = new Date(2024, 0, 15);
    const result = formatDateRange(start, end);
    // Same month logic: "15 - 15 jan. 2024"
    expect(result).toContain("15");
    expect(result).toContain("2024");
  });
});

describe("formatMonth", () => {
  it("formats month and year in Dutch", () => {
    const date = new Date(2024, 0, 1);
    const result = formatMonth(date);
    expect(result.toLowerCase()).toContain("januari");
    expect(result).toContain("2024");
  });

  it("formats various months", () => {
    expect(formatMonth(new Date(2024, 5, 1)).toLowerCase()).toContain("juni");
    expect(formatMonth(new Date(2024, 11, 1)).toLowerCase()).toContain("december");
  });
});

describe("getISODateString", () => {
  it("returns YYYY-MM-DD format", () => {
    const date = new Date("2024-01-15T12:00:00Z");
    const result = getISODateString(date);
    expect(result).toBe("2024-01-15");
  });

  it("works with timestamps", () => {
    const timestamp = new Date("2024-06-01T00:00:00Z").getTime();
    const result = getISODateString(timestamp);
    expect(result).toBe("2024-06-01");
  });

  it("works with ISO strings", () => {
    const result = getISODateString("2024-01-15T14:30:00Z");
    expect(result).toBe("2024-01-15");
  });
});

describe("getTodayString", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns today in YYYY-MM-DD format", () => {
    expect(getTodayString()).toBe("2024-06-15");
  });
});

describe("getDaysAgoString", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns date N days ago", () => {
    const result = getDaysAgoString(7);
    expect(result).toBe("2024-06-08");
  });

  it("returns today for 0 days ago", () => {
    expect(getDaysAgoString(0)).toBe("2024-06-15");
  });

  it("crosses month boundaries", () => {
    const result = getDaysAgoString(20);
    expect(result).toBe("2024-05-26");
  });
});
