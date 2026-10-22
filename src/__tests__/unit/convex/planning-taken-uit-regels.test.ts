/**
 * Planningstaken uit offerteregels (convex/lib/planningTakenUitRegels.ts):
 * één taak per niet-optionele regel, in offertevolgorde.
 */

import { describe, it, expect } from "vitest";
import {
  arbeidsUrenVanRegels,
  isUurEenheid,
  normUrenVanRegel,
  regelsVoorTaken,
  takenUitOfferteRegels,
  type RegelVoorTaak,
} from "../../../../convex/lib/planningTakenUitRegels";

function regel(velden: Partial<RegelVoorTaak> & { id: string }): RegelVoorTaak {
  return {
    scope: "Bestrating",
    omschrijving: `Regel ${velden.id}`,
    eenheid: "m²",
    hoeveelheid: 10,
    type: "materiaal",
    ...velden,
  };
}

describe("normuren per regel", () => {
  it("telt alleen arbeid in uren", () => {
    expect(normUrenVanRegel({ type: "arbeid", eenheid: "uur", hoeveelheid: 12 })).toBe(12);
    expect(normUrenVanRegel({ type: "arbeid", eenheid: "Uren", hoeveelheid: 3.5 })).toBe(3.5);
    expect(normUrenVanRegel({ type: "arbeid", eenheid: "boom", hoeveelheid: 3 })).toBe(0);
    expect(normUrenVanRegel({ type: "materiaal", eenheid: "uur", hoeveelheid: 3 })).toBe(0);
    expect(normUrenVanRegel({ type: "machine", eenheid: "uur", hoeveelheid: 3 })).toBe(0);
    expect(normUrenVanRegel({ type: "arbeid", eenheid: "uur", hoeveelheid: -2 })).toBe(0);
  });

  it("herkent gangbare schrijfwijzen van uur", () => {
    expect(isUurEenheid("u.")).toBe(true);
    expect(isUurEenheid(" manuur ")).toBe(true);
    expect(isUurEenheid("m²")).toBe(false);
  });

  it("somt de arbeidsuren", () => {
    expect(
      arbeidsUrenVanRegels([
        { type: "arbeid", eenheid: "uur", hoeveelheid: 8 },
        { type: "arbeid", eenheid: "uur", hoeveelheid: 4.25 },
        { type: "materiaal", eenheid: "m²", hoeveelheid: 40 },
      ])
    ).toBe(12.25);
  });
});

describe("regelsVoorTaken", () => {
  const regels = [regel({ id: "a" }), regel({ id: "b", optioneel: true }), regel({ id: "c" })];

  it("laat optionele posten weg", () => {
    expect(regelsVoorTaken(regels).map((r) => r.id)).toEqual(["a", "c"]);
  });

  it("volgt de toegewezen regels van het werkitem als die er zijn", () => {
    expect(regelsVoorTaken(regels, ["b", "c"]).map((r) => r.id)).toEqual(["b", "c"]);
  });
});

describe("takenUitOfferteRegels", () => {
  it("maakt één taak per regel met hoofdstuk, omschrijving en volgorde", () => {
    const taken = takenUitOfferteRegels([
      regel({ id: "1", scope: "Grondwerk", omschrijving: "Ontgraven tuin", type: "arbeid", eenheid: "uur", hoeveelheid: 12 }),
      regel({ id: "2", scope: "Bestrating", omschrijving: "Betontegels 30x30" }),
      regel({ id: "3", scope: "Grondwerk", omschrijving: "Grond afvoeren", type: "machine", eenheid: "uur", hoeveelheid: 4 }),
      regel({ id: "4", scope: "Bestrating", omschrijving: "Vijver", optioneel: true }),
    ]);

    // Per hoofdstuk gegroepeerd, in volgorde van voorkomen
    expect(taken.map((t) => [t.scope, t.taakNaam, t.volgorde])).toEqual([
      ["Grondwerk", "Ontgraven tuin", 0],
      ["Grondwerk", "Grond afvoeren", 1],
      ["Bestrating", "Betontegels 30x30", 2],
    ]);
    expect(taken.map((t) => t.normUren)).toEqual([12, 0, 0]);
  });

  it("leidt de dagen af zoals de planning: uren ÷ (team × uren per dag)", () => {
    const regels = [regel({ id: "1", type: "arbeid", eenheid: "uur", hoeveelheid: 24 })];
    // Standaard 2 man × 6 uur
    expect(takenUitOfferteRegels(regels)[0].geschatteDagen).toBe(2);
    // Met voorcalculatie: 3 man × 8 uur
    expect(
      takenUitOfferteRegels(regels, { teamGrootte: 3, effectieveUrenPerDag: 8 })[0].geschatteDagen
    ).toBe(1);
  });

  it("slaat regels zonder omschrijving over en ruimt witruimte op", () => {
    const taken = takenUitOfferteRegels([
      regel({ id: "1", omschrijving: "   " }),
      regel({ id: "2", omschrijving: "  Gazon   leggen " }),
    ]);
    expect(taken).toHaveLength(1);
    expect(taken[0].taakNaam).toBe("Gazon leggen");
    expect(taken[0].volgorde).toBe(0);
  });

  it("geeft niets bij een offerte zonder regels", () => {
    expect(takenUitOfferteRegels([])).toEqual([]);
  });
});
