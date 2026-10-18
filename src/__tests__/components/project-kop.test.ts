/**
 * De fase-tabs van een project volgen de projectstatus. Vroeger toonde de
 * stepper "Afgerond" als stap die naar het overzicht linkte; nu zijn de vier
 * fasen zelf de navigatie, en staat vast wanneer een fase open, klaar of "nu" is.
 */
import { describe, it, expect } from "vitest";
import { projectFasen } from "@/components/project/project-kop";

function stand(status: string) {
  return projectFasen(status).map((f) => ({
    tab: f.tab,
    open: f.open,
    klaar: f.klaar,
    nu: f.nu,
  }));
}

describe("projectFasen", () => {
  it("gepland: alleen planning open, en die is nu aan de beurt", () => {
    expect(stand("gepland")).toEqual([
      { tab: "planning", open: true, klaar: false, nu: true },
      { tab: "uitvoering", open: false, klaar: false, nu: false },
      { tab: "nacalculatie", open: false, klaar: false, nu: false },
      { tab: "factuur", open: false, klaar: false, nu: false },
    ]);
  });

  it("in uitvoering: planning klaar, uitvoering nu, de rest op slot", () => {
    const fasen = stand("in_uitvoering");
    expect(fasen[0]).toMatchObject({ klaar: true, nu: false });
    expect(fasen[1]).toMatchObject({ open: true, klaar: false, nu: true });
    expect(fasen[2].open).toBe(false);
    expect(fasen[3].open).toBe(false);
  });

  it("afgerond: de nacalculatie is de volgende stap", () => {
    const fasen = stand("afgerond");
    expect(fasen[1]).toMatchObject({ klaar: true });
    expect(fasen[2]).toMatchObject({ open: true, klaar: false, nu: true });
    expect(fasen[3].open).toBe(false);
  });

  it("gefactureerd: alles klaar, niets meer nu", () => {
    expect(stand("gefactureerd").every((f) => f.open && f.klaar && !f.nu)).toBe(true);
  });

  it("legacy voorcalculatie telt als gepland", () => {
    expect(stand("voorcalculatie")).toEqual(stand("gepland"));
  });
});
