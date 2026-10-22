/**
 * Projecttitel "Klantnaam – werkzaamheden" (convex/lib/projectTitel.ts).
 */

import { describe, it, expect } from "vitest";
import {
  PROJECT_TITEL_MAX,
  kapAf,
  leesbaarHoofdstuk,
  onderwerpUitLeadNaam,
  projectTitel,
  werkzaamhedenTekst,
  werkzaamhedenUitOfferte,
} from "../../../../convex/lib/projectTitel";

describe("werkzaamhedenTekst", () => {
  it("noemt er hooguit drie, als zin", () => {
    expect(werkzaamhedenTekst(["Gazon"])).toBe("Gazon");
    expect(werkzaamhedenTekst(["Gazon", "Bestrating"])).toBe("Gazon en bestrating");
    expect(werkzaamhedenTekst(["Gazon", "Bestrating", "Beplanting"])).toBe(
      "Gazon, bestrating en beplanting"
    );
  });

  it("kort een langere lijst in tot de eerste twee + e.a.", () => {
    expect(werkzaamhedenTekst(["Gazon", "Bestrating", "Beplanting", "Verlichting"])).toBe(
      "Gazon, bestrating e.a."
    );
  });

  it("laat dubbelen en lege namen weg, hoofdletterongevoelig", () => {
    expect(werkzaamhedenTekst(["Gazon", "gazon", " ", "Bestrating"])).toBe("Gazon en bestrating");
  });

  it("laat afkortingen midden in de zin staan", () => {
    expect(werkzaamhedenTekst(["Gazon", "LED-verlichting"])).toBe("Gazon en LED-verlichting");
  });

  it("geeft een lege tekst zonder namen", () => {
    expect(werkzaamhedenTekst([])).toBe("");
  });
});

describe("leesbaarHoofdstuk", () => {
  it("vertaalt vaste scopes en laat vrije hoofdstukken staan", () => {
    expect(leesbaarHoofdstuk("water_elektra")).toBe("Water & elektra");
    expect(leesbaarHoofdstuk("gras")).toBe("Gras");
    expect(leesbaarHoofdstuk("Bestrating voortuin")).toBe("Bestrating voortuin");
    expect(leesbaarHoofdstuk("nieuwe_scope")).toBe("Nieuwe scope");
  });
});

describe("werkzaamhedenUitOfferte", () => {
  it("neemt de hoofdstukken van de niet-optionele regels in offertevolgorde", () => {
    expect(
      werkzaamhedenUitOfferte({
        type: "aanleg",
        regels: [
          { scope: "Gazon" },
          { scope: "Gazon" },
          { scope: "Vijver", optioneel: true },
          { scope: "Bestrating" },
          { scope: "Beplanting" },
        ],
      })
    ).toBe("Gazon, bestrating en beplanting");
  });

  it("slaat offerte-overhead (algemeen) over", () => {
    expect(
      werkzaamhedenUitOfferte({
        type: "aanleg",
        regels: [{ scope: "grondwerk" }, { scope: "algemeen" }, { scope: "bestrating" }],
      })
    ).toBe("Grondwerk en bestrating");
  });

  it("valt terug op de gekozen scopes en dan op het offertetype", () => {
    expect(werkzaamhedenUitOfferte({ type: "aanleg", scopes: ["gras"], regels: [] })).toBe("Gras");
    expect(werkzaamhedenUitOfferte({ type: "onderhoud", regels: [] })).toBe("Onderhoud");
    expect(
      werkzaamhedenUitOfferte({ type: "aanleg", regels: [{ scope: "algemeen" }] })
    ).toBe("Aanleg");
  });
});

describe("projectTitel", () => {
  it("is Klantnaam – werkzaamheden", () => {
    expect(projectTitel({ klantNaam: "Jansen", werkzaamheden: "Gazon en bestrating" })).toBe(
      "Jansen – Gazon en bestrating"
    );
  });

  it("valt terug op het deel dat er wel is", () => {
    expect(projectTitel({ klantNaam: "Jansen", werkzaamheden: "" })).toBe("Jansen");
    expect(projectTitel({ klantNaam: " ", werkzaamheden: "Aanleg" })).toBe("Aanleg");
    expect(projectTitel({})).toBe("Nieuw project");
  });

  it("blijft binnen de grens en kapt de werkzaamheden netjes af", () => {
    const titel = projectTitel({
      klantNaam: "Familie van den Berg-de Vries",
      werkzaamheden:
        "Grondwerk, bestrating van de oprit en de achtertuin, beplanting en verlichting",
    });
    expect(titel.length).toBeLessThanOrEqual(PROJECT_TITEL_MAX);
    expect(titel.startsWith("Familie van den Berg-de Vries – Grondwerk")).toBe(true);
    expect(titel.endsWith("…")).toBe(true);
    expect(titel).not.toMatch(/[ ,]…$/);
  });

  it("kapt de hele titel af als de klantnaam zelf al te lang is", () => {
    const titel = projectTitel({ klantNaam: "A".repeat(75), werkzaamheden: "Gazon" });
    expect(titel.length).toBeLessThanOrEqual(PROJECT_TITEL_MAX);
    expect(titel.endsWith("…")).toBe(true);
  });
});

describe("kapAf", () => {
  it("laat korte tekst ongemoeid en normaliseert witruimte", () => {
    expect(kapAf("  Gazon   en bestrating ", 80)).toBe("Gazon en bestrating");
  });

  it("knipt op een woordgrens", () => {
    expect(kapAf("Gazon, bestrating en beplanting", 20)).toBe("Gazon, bestrating…");
  });
});

describe("onderwerpUitLeadNaam", () => {
  it("haalt het label tussen [ ] uit een oude lead-projectnaam", () => {
    expect(onderwerpUitLeadNaam("[Tuinaanleg] Hallo, wij willen graag")).toBe("Tuinaanleg");
    expect(onderwerpUitLeadNaam("Geen label")).toBeNull();
    expect(onderwerpUitLeadNaam("[ ] leeg")).toBeNull();
  });
});
