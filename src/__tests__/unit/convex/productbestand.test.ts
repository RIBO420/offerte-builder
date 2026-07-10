/**
 * Unit tests productbestand (PRD §2.5b/c, HERO-lessen bijlage B)
 *
 * Test de extraheerbare businesslogica uit convex/producten.ts en
 * convex/productenImport.ts:
 * - Picker-sortering op gebruiksteller (meest gebruikt bovenaan)
 * - verhoogTeller (gebruiksteller, ook voor records zonder teller)
 * - Naam-normalisatie en near-duplicate-detectie
 *   (incl. het "Voorrijkosten" vs "Voorrrijkosten"-geval uit bijlage B)
 * - €0/lege inkoopprijs → prijs-op-regel-vlag + marge-verbod
 *   (voorkomt HERO's "Infinity%")
 * - Import-validatie (waarschuwingen) en import-idempotentie
 * - Rolcheck: import en beheer zijn kantoor-only
 */

import { describe, it, expect } from "vitest";
import { ConvexError } from "convex/values";
import type { Id } from "../../../../convex/_generated/dataModel";
import {
  normaliseerProductnaam,
  bepaalPrijsOpRegel,
  berekenVerkoopprijsUitMarge,
  valideerBtwCode,
  sorteerVoorPicker,
  verhoogTeller,
  GELDIGE_BTW_CODES,
} from "../../../../convex/producten";
import { verkoopprijsUitMarge } from "../../../../convex/vrijeOfferteBerekening";
import {
  spelafstand,
  maxSpelafstandVoor,
  vergelijkNamen,
  valideerImportRijen,
  bepaalImportActies,
  IMPORT_STANDAARD_CATEGORIE,
  type ImportRij,
  type BestaandProduct,
} from "../../../../convex/productenImport";
import { isKantoorRol } from "../../../../convex/roles";

const productId = (s: string) => s as unknown as Id<"producten">;
const leverancierId = (s: string) => s as unknown as Id<"leveranciers">;

// ─── Naam-normalisatie ───────────────────────────────────────────────────────

describe("normaliseerProductnaam", () => {
  it("normaliseert case, whitespace en diakritieken", () => {
    expect(normaliseerProductnaam("  Voorrijkosten ")).toBe("voorrijkosten");
    expect(normaliseerProductnaam("Betontegel   30x30  GRIJS")).toBe(
      "betontegel 30x30 grijs"
    );
    expect(normaliseerProductnaam("Coniferen (Thuja) géén aanslag")).toBe(
      "coniferen (thuja) geen aanslag"
    );
  });

  it("geeft een lege string voor namen zonder inhoud", () => {
    expect(normaliseerProductnaam("   ")).toBe("");
  });
});

// ─── Near-duplicate-detectie (bijlage B) ─────────────────────────────────────

describe("spelafstand", () => {
  it("berekent de Levenshtein-afstand", () => {
    expect(spelafstand("voorrijkosten", "voorrijkosten", 2)).toBe(0);
    expect(spelafstand("voorrijkosten", "voorrrijkosten", 2)).toBe(1);
    expect(spelafstand("abc", "axc", 2)).toBe(1);
  });

  it("kapt af boven het maximum (retourneert max + 1)", () => {
    expect(spelafstand("gazon maaien", "heggen snoeien", 2)).toBe(3);
  });
});

describe("vergelijkNamen", () => {
  it("herkent het HERO-geval: 'Voorrijkosten' vs 'Voorrrijkosten' als near-duplicate", () => {
    expect(vergelijkNamen("Voorrijkosten", "Voorrrijkosten")).toBe("near");
  });

  it("herkent identieke namen (na normalisatie) als exact duplicaat", () => {
    expect(vergelijkNamen("Voorrijkosten", "  voorrijkosten ")).toBe("exact");
    expect(vergelijkNamen("VOORRIJKOSTEN", "Voorrijkosten")).toBe("exact");
  });

  it("laat duidelijk verschillende namen met rust", () => {
    expect(vergelijkNamen("Voorrijkosten", "Graszoden")).toBeNull();
    expect(vergelijkNamen("Straatzand", "Metselzand")).toBeNull();
  });

  it("is strenger op korte namen (geen speling onder 5 tekens)", () => {
    expect(maxSpelafstandVoor(4)).toBe(0);
    expect(maxSpelafstandVoor(8)).toBe(1);
    expect(maxSpelafstandVoor(15)).toBe(2);
    expect(vergelijkNamen("Zand", "Rand")).toBeNull();
  });
});

// ─── €0 / prijs-op-regel en marge-verbod ("Infinity%") ───────────────────────

describe("bepaalPrijsOpRegel", () => {
  it("markeert €0, negatieve en ontbrekende inkoopprijzen", () => {
    expect(bepaalPrijsOpRegel(0)).toBe(true);
    expect(bepaalPrijsOpRegel(undefined)).toBe(true);
    expect(bepaalPrijsOpRegel(null)).toBe(true);
    expect(bepaalPrijsOpRegel(-5)).toBe(true);
  });

  it("laat echte prijzen met rust", () => {
    expect(bepaalPrijsOpRegel(0.01)).toBe(false);
    expect(bepaalPrijsOpRegel(12.5)).toBe(false);
  });
});

describe("berekenVerkoopprijsUitMarge", () => {
  it("rekent met de PRD-margefactor 1÷(1−m), niet met een opslag óp inkoop", () => {
    // PRD §2.5b: 30% marge → ×1,43 (100 → 142,86), 40% → ×1,67 (100 → 166,67)
    expect(berekenVerkoopprijsUitMarge(100, 30, false)).toBe(142.86);
    expect(berekenVerkoopprijsUitMarge(100, 40, false)).toBe(166.67);
    expect(berekenVerkoopprijsUitMarge(100, 25, false)).toBe(133.33);
    expect(berekenVerkoopprijsUitMarge(10, 0, false)).toBe(10);
  });

  it("is exact dezelfde functie als de vrije-builder-berekening (één definitie)", () => {
    expect(berekenVerkoopprijsUitMarge).toBe(verkoopprijsUitMarge);
  });

  it("weigert marge < 0% of ≥ 100% (Infinity%-verbod)", () => {
    expect(() => berekenVerkoopprijsUitMarge(100, 100, false)).toThrow(
      ConvexError
    );
    expect(() => berekenVerkoopprijsUitMarge(100, -5, false)).toThrow(
      ConvexError
    );
  });

  it("weigert marge op een prijs-op-regel-artikel", () => {
    expect(() => berekenVerkoopprijsUitMarge(100, 25, true)).toThrow(
      ConvexError
    );
  });

  it("weigert marge op €0-inkoopprijs — nooit meer 'Infinity%' (bijlage B)", () => {
    expect(() => berekenVerkoopprijsUitMarge(0, 25, false)).toThrow(
      ConvexError
    );
    expect(() => berekenVerkoopprijsUitMarge(-1, 25, false)).toThrow(
      ConvexError
    );
  });

  it("weigert een niet-eindig marge-percentage", () => {
    expect(() =>
      berekenVerkoopprijsUitMarge(100, Number.POSITIVE_INFINITY, false)
    ).toThrow(ConvexError);
  });
});

describe("valideerBtwCode", () => {
  it("accepteert 9, 21 en undefined", () => {
    expect(() => valideerBtwCode(9)).not.toThrow();
    expect(() => valideerBtwCode(21)).not.toThrow();
    expect(() => valideerBtwCode(undefined)).not.toThrow();
    expect(GELDIGE_BTW_CODES).toEqual([9, 21]);
  });

  it("weigert andere codes", () => {
    for (const code of [0, 6, 19, 100]) {
      expect(() => valideerBtwCode(code)).toThrow(ConvexError);
    }
  });
});

// ─── Picker-sortering en gebruiksteller (PRD §2.5b) ──────────────────────────

describe("sorteerVoorPicker", () => {
  it("sorteert op gebruiksteller aflopend — meest gebruikt bovenaan", () => {
    const gesorteerd = sorteerVoorPicker([
      { productnaam: "Graszoden", gebruiksteller: 3 },
      { productnaam: "Voorrijkosten", gebruiksteller: 116 },
      { productnaam: "Straatzand", gebruiksteller: 42 },
    ]);
    expect(gesorteerd.map((p) => p.productnaam)).toEqual([
      "Voorrijkosten",
      "Straatzand",
      "Graszoden",
    ]);
  });

  it("behandelt een ontbrekende teller als 0 en sorteert dan alfabetisch", () => {
    const gesorteerd = sorteerVoorPicker([
      { productnaam: "Zand" },
      { productnaam: "Aarde", gebruiksteller: 0 },
      { productnaam: "Compost", gebruiksteller: 1 },
    ]);
    expect(gesorteerd.map((p) => p.productnaam)).toEqual([
      "Compost",
      "Aarde",
      "Zand",
    ]);
  });

  it("muteert de invoer niet", () => {
    const invoer = [
      { productnaam: "B", gebruiksteller: 1 },
      { productnaam: "A", gebruiksteller: 2 },
    ];
    sorteerVoorPicker(invoer);
    expect(invoer[0].productnaam).toBe("B");
  });
});

describe("verhoogTeller", () => {
  it("verhoogt met 1 en behandelt ontbrekende teller als 0", () => {
    expect(verhoogTeller(undefined)).toBe(1);
    expect(verhoogTeller(0)).toBe(1);
    expect(verhoogTeller(115)).toBe(116);
  });
});

// ─── Import-validatie (stap 2: preview) ──────────────────────────────────────

describe("valideerImportRijen", () => {
  const rij = (overrides: Partial<ImportRij> = {}): ImportRij => ({
    naam: "Graszoden",
    inkoopprijs: 3.5,
    ...overrides,
  });

  it("waarschuwt voor near-duplicates tegen bestaande producten (Voorrrijkosten-geval)", () => {
    const [resultaat] = valideerImportRijen(
      [rij({ naam: "Voorrrijkosten" })],
      ["Voorrijkosten"]
    );
    expect(resultaat.bestaand).toEqual({
      soort: "near",
      naam: "Voorrijkosten",
    });
    expect(resultaat.waarschuwingen.join(" ")).toContain("Voorrijkosten");
  });

  it("markeert een exacte match met bestaand product als update, niet als duplicaat", () => {
    const [resultaat] = valideerImportRijen(
      [rij({ naam: "  GRASZODEN " })],
      ["Graszoden"]
    );
    expect(resultaat.bestaand?.soort).toBe("exact");
    expect(resultaat.waarschuwingen.join(" ")).toContain("bijgewerkt");
  });

  it("detecteert duplicaten binnen het bestand zelf (exact én near)", () => {
    const resultaten = valideerImportRijen(
      [
        rij({ naam: "Voorrijkosten" }),
        rij({ naam: "voorrijkosten" }),
        rij({ naam: "Voorrrijkosten" }),
      ],
      []
    );
    expect(resultaten[0].inBestand).toBeUndefined();
    expect(resultaten[1].inBestand?.soort).toBe("exact");
    expect(resultaten[1].inBestand?.index).toBe(0);
    expect(resultaten[2].inBestand?.soort).toBe("near");
  });

  it("geeft €0/lege inkoopprijs de prijs-op-regel-vlag met waarschuwing", () => {
    const resultaten = valideerImportRijen(
      [rij({ inkoopprijs: 0 }), rij({ naam: "Anders", inkoopprijs: undefined })],
      []
    );
    for (const resultaat of resultaten) {
      expect(resultaat.prijsOpRegel).toBe(true);
      expect(resultaat.waarschuwingen.join(" ")).toContain("prijs op regel");
    }
  });

  it("markeert rijen zonder naam als ongeldig", () => {
    const [resultaat] = valideerImportRijen([rij({ naam: "   " })], []);
    expect(resultaat.geldig).toBe(false);
  });

  it("waarschuwt voor een ongeldige btw-code", () => {
    const [resultaat] = valideerImportRijen([rij({ btwCode: 19 })], []);
    expect(resultaat.waarschuwingen.join(" ")).toContain("btw-code");
  });
});

// ─── Import-idempotentie (stap 3) ────────────────────────────────────────────

describe("bepaalImportActies", () => {
  const lev = leverancierId("lev-1");
  const rijen: ImportRij[] = [
    { naam: "Voorrijkosten", inkoopprijs: 45 },
    { naam: "Graszoden", inkoopprijs: 3.5 },
  ];

  it("maakt alles aan bij een lege database", () => {
    const acties = bepaalImportActies(rijen, [], lev);
    expect(acties.map((a) => a.actie)).toEqual(["aanmaken", "aanmaken"]);
  });

  it("is idempotent: her-import van hetzelfde bestand werkt bij i.p.v. dupliceert", () => {
    // Simuleer de toestand ná de eerste import
    const bestaande: BestaandProduct[] = rijen.map((r, i) => ({
      _id: productId(`p-${i}`),
      productnaam: r.naam,
      naamGenormaliseerd: normaliseerProductnaam(r.naam),
      leverancierId: lev,
    }));
    const acties = bepaalImportActies(rijen, bestaande, lev);
    expect(acties.map((a) => a.actie)).toEqual(["bijwerken", "bijwerken"]);
    expect(
      acties.every((a) => a.actie !== "bijwerken" || a.bestaandId)
    ).toBe(true);
  });

  it("matcht op genormaliseerde naam + leverancier: andere leverancier = nieuw product", () => {
    const bestaande: BestaandProduct[] = [
      {
        _id: productId("p-0"),
        productnaam: "Voorrijkosten",
        naamGenormaliseerd: "voorrijkosten",
        leverancierId: leverancierId("lev-ANDERS"),
      },
    ];
    const acties = bepaalImportActies(
      [{ naam: "Voorrijkosten", inkoopprijs: 45 }],
      bestaande,
      lev
    );
    expect(acties[0].actie).toBe("aanmaken");
  });

  it("valt terug op de genormaliseerde productnaam voor bestaande records zonder naamGenormaliseerd", () => {
    const bestaande: BestaandProduct[] = [
      {
        _id: productId("p-0"),
        productnaam: "  VOORRIJKOSTEN ",
        leverancierId: lev,
      },
    ];
    const acties = bepaalImportActies(
      [{ naam: "Voorrijkosten" }],
      bestaande,
      lev
    );
    expect(acties[0].actie).toBe("bijwerken");
  });

  it("slaat exacte duplicaten binnen het bestand en naamloze rijen over", () => {
    const acties = bepaalImportActies(
      [
        { naam: "Graszoden" },
        { naam: "graszoden  " },
        { naam: "" },
      ],
      [],
      undefined
    );
    expect(acties.map((a) => a.actie)).toEqual([
      "aanmaken",
      "overslaan",
      "overslaan",
    ]);
  });

  it("gebruikt een vaste standaard-categorie voor rijen zonder categorie", () => {
    expect(IMPORT_STANDAARD_CATEGORIE).toBe("Overig");
  });
});

// ─── Rolchecks (PRD §2.5c: beheer bij een klein aantal mensen) ───────────────

describe("rolchecks productbestand", () => {
  it("kantoor = directie of projectleider (import + tekstblokbeheer)", () => {
    expect(isKantoorRol("directie")).toBe(true);
    expect(isKantoorRol("projectleider")).toBe(true);
    expect(isKantoorRol("admin")).toBe(true); // legacy mapping → directie
  });

  it("veldrollen en klanten mogen niet importeren of beheren", () => {
    for (const rol of [
      "voorman",
      "medewerker",
      "klant",
      "onderaannemer_zzp",
      "materiaalman",
    ]) {
      expect(isKantoorRol(rol)).toBe(false);
    }
  });
});
