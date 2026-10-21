import { describe, it, expect } from "vitest";
import {
  minuutOpX,
  overlapt,
  segmentPositie,
  stapVoorCel,
  uurMarkeringen,
} from "@/components/planbord/tijdas";
import { STANDAARD_WERKDAG } from "../../../../convex/tijdbordLogica";

const W = STANDAARD_WERKDAG; // 07:00–18:00 = 660 min

describe("tijdas", () => {
  it("plaatst 08:00–16:00 op de juiste plek in de dagcel", () => {
    const p = segmentPositie(8 * 60, 16 * 60, W);
    expect(p.left).toBeCloseTo((60 / 660) * 100);
    expect(p.width).toBeCloseTo((480 / 660) * 100);
  });

  it("kapt af buiten de werkdag", () => {
    const p = segmentPositie(6 * 60, 19 * 60, W);
    expect(p).toMatchObject({ left: 0, width: 100, afgekaptLinks: true, afgekaptRechts: true });
  });

  it("weekweergave (cel ~200px): stap 15 min; maandweergave (~40px): 1 uur", () => {
    expect(stapVoorCel(200, W)).toBe(15);
    expect(stapVoorCel(40, W)).toBe(60);
  });

  it("x-positie → minuut, afgerond op het kwartier", () => {
    // 200px voor 660 min: 1 min ≈ 0,303 px; 08:07 ligt op ~20,3 px
    expect(minuutOpX(20.3, 200, W)).toBe(8 * 60);
    expect(minuutOpX(200, 200, W)).toBe(18 * 60);
    expect(minuutOpX(-10, 200, W)).toBe(7 * 60);
  });

  it("uurmarkeringen dunnen uit bij een smalle cel", () => {
    expect(uurMarkeringen(W, 660)).toHaveLength(12);
    expect(uurMarkeringen(W, 150).length).toBeLessThan(12);
  });

  it("overlap: aansluitend is geen overlap", () => {
    expect(overlapt({ start: 480, eind: 600 }, { start: 600, eind: 700 })).toBe(false);
    expect(overlapt({ start: 480, eind: 601 }, { start: 600, eind: 700 })).toBe(true);
  });
});
