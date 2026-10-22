import { describe, it, expect } from "vitest";
import { verplaatsRegel } from "@/components/offerte/vrije-builder/verplaats-regel";
import { berekenHoofdstukSubtotalen } from "../../../../convex/vrijeOfferteBerekening";

const r = (id: string, scope: string, totaal = 0) => ({ id, scope, totaal });

const ids = (regels: Array<{ id: string }>) => regels.map((x) => x.id);

describe("verplaatsRegel (slepen in de vrije builder)", () => {
  const regels = [
    r("a1", "Grondwerk", 100),
    r("a2", "Grondwerk", 200),
    r("a3", "Grondwerk", 300),
    r("b1", "Bestrating", 1000),
    r("b2", "Bestrating", 2000),
  ];

  it("omlaag binnen een hoofdstuk: komt ná de doelregel (arrayMove)", () => {
    expect(ids(verplaatsRegel(regels, "a1", "a3", "Grondwerk"))).toEqual([
      "a2", "a3", "a1", "b1", "b2",
    ]);
  });

  it("omhoog binnen een hoofdstuk: komt vóór de doelregel", () => {
    expect(ids(verplaatsRegel(regels, "a3", "a1", "Grondwerk"))).toEqual([
      "a3", "a1", "a2", "b1", "b2",
    ]);
  });

  it("naar een ander hoofdstuk: vóór de doelregel, scope wordt het nieuwe hoofdstuk", () => {
    const uit = verplaatsRegel(regels, "a2", "b2", "Bestrating");
    expect(ids(uit)).toEqual(["a1", "a3", "b1", "a2", "b2"]);
    expect(uit.find((x) => x.id === "a2")!.scope).toBe("Bestrating");
  });

  it("op een hoofdstuk zonder doelregel: achteraan in dat hoofdstuk", () => {
    expect(ids(verplaatsRegel(regels, "b1", null, "Grondwerk"))).toEqual([
      "a1", "a2", "a3", "b1", "b2",
    ]);
    expect(verplaatsRegel(regels, "b1", null, "Grondwerk")[3].scope).toBe("Grondwerk");
  });

  it("naar een leeg hoofdstuk uit de editor-volgorde", () => {
    const uit = verplaatsRegel(regels, "a1", null, "Beplanting", [
      "Grondwerk",
      "Beplanting",
      "Bestrating",
    ]);
    expect(ids(uit)).toEqual(["a2", "a3", "a1", "b1", "b2"]);
    expect(uit[2].scope).toBe("Beplanting");
  });

  it("de eerste regel van een hoofdstuk verslepen laat de hoofdstukvolgorde staan", () => {
    // Niet-aaneengesloten array (regel later toegevoegd aan Grondwerk)
    const verspreid = [r("a1", "Grondwerk"), r("b1", "Bestrating"), r("a2", "Grondwerk")];
    expect(ids(verplaatsRegel(verspreid, "a1", "a2", "Grondwerk"))).toEqual([
      "a2", "a1", "b1",
    ]);
  });

  it("op zichzelf neerzetten verandert niets", () => {
    expect(ids(verplaatsRegel(regels, "a2", "a2", "Grondwerk"))).toEqual(ids(regels));
  });

  it("onbekende regel: array ongewijzigd", () => {
    expect(ids(verplaatsRegel(regels, "x", "a1", "Grondwerk"))).toEqual(ids(regels));
  });

  it("muteert de invoer niet", () => {
    const kopie = structuredClone(regels);
    verplaatsRegel(regels, "a1", "b1", "Bestrating");
    expect(regels).toEqual(kopie);
  });

  it("subtotalen per hoofdstuk kloppen na verslepen naar een ander hoofdstuk", () => {
    const volledig = regels.map((x) => ({
      ...x,
      omschrijving: x.id,
      eenheid: "st",
      hoeveelheid: 1,
      prijsPerEenheid: x.totaal,
      type: "materiaal" as const,
    }));
    const uit = verplaatsRegel(volledig, "a3", "b1", "Bestrating");
    expect(berekenHoofdstukSubtotalen(uit)).toEqual([
      { hoofdstuk: "Grondwerk", subtotaal: 300, aantalRegels: 2 },
      { hoofdstuk: "Bestrating", subtotaal: 3300, aantalRegels: 3 },
    ]);
  });
});
