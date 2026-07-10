/**
 * §5.5: Consistente Nederlandse periode-labels op het dashboard.
 * Tests voor formatMaandJaar en formatKwartaalJaar (src/lib/format/date.ts).
 */
import { describe, it, expect } from "vitest";
import { formatMaandJaar, formatKwartaalJaar } from "@/lib/format";

describe("formatMaandJaar", () => {
  it("formatteert als afgekorte NL-maand met hoofdletter en jaartal", () => {
    expect(formatMaandJaar(new Date(2026, 6, 10))).toBe("Jul 2026");
  });

  it("laat geen punt achter de maandafkorting staan", () => {
    // nl-NL Intl geeft bv. "mrt." — de helper verwijdert de punt
    expect(formatMaandJaar(new Date(2026, 2, 1))).toBe("Mrt 2026");
  });

  it("accepteert ook timestamps", () => {
    const ts = new Date(2026, 0, 15).getTime();
    expect(formatMaandJaar(ts)).toBe("Jan 2026");
  });
});

describe("formatKwartaalJaar", () => {
  it("formatteert als Q<kwartaal> <jaar>", () => {
    expect(formatKwartaalJaar(new Date(2026, 6, 10))).toBe("Q3 2026");
  });

  it("berekent de kwartaalgrenzen correct", () => {
    expect(formatKwartaalJaar(new Date(2026, 0, 1))).toBe("Q1 2026");
    expect(formatKwartaalJaar(new Date(2026, 2, 31))).toBe("Q1 2026");
    expect(formatKwartaalJaar(new Date(2026, 3, 1))).toBe("Q2 2026");
    expect(formatKwartaalJaar(new Date(2026, 11, 31))).toBe("Q4 2026");
  });

  it("accepteert ook timestamps", () => {
    const ts = new Date(2025, 9, 5).getTime();
    expect(formatKwartaalJaar(ts)).toBe("Q4 2025");
  });
});
