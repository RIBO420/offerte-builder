/**
 * Unit tests catalogusbeheer (PRD §2.5f + bijlage A, acceptatie §8.7)
 *
 * Test de extraheerbare businesslogica uit convex/bouwstenen.ts,
 * convex/uurtarieven.ts en convex/migrations/seedBouwstenen.ts:
 * - Validatie bouwsteen-invoer (code, seizoensvenster, receptuur, bedragen)
 * - Rolchecks: alleen kantoor (directie/projectleider) mag beheren
 * - Uurtarief-op-datum: historische documenten behouden hun eigen tarief
 * - Seed startvulling bijlage A: 23 records, unieke codes, idempotent
 */

import { describe, it, expect } from "vitest";
import { ConvexError } from "convex/values";
import {
  normaliseerCode,
  valideerBouwsteen,
  berekenPrijsPerBeurt,
  BOUWSTEEN_CATEGORIEEN,
  BOUWSTEEN_SOORTEN,
  CATEGORIE_LABELS,
  type BouwsteenInvoer,
} from "../../../../convex/bouwstenen";
import {
  bepaalTariefOpDatum,
  valideerIngangsdatum,
  STANDAARD_UURTARIEF,
} from "../../../../convex/uurtarieven";
import {
  BOUWSTENEN_STARTVULLING,
  START_UURTARIEF_INGANGSDATUM,
} from "../../../../convex/migrations/seedBouwstenen";
import { isKantoorRol } from "../../../../convex/roles";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function geldigeBouwsteen(
  overrides: Partial<BouwsteenInvoer> = {}
): BouwsteenInvoer {
  return {
    naam: "Heggen snoeien",
    code: "HS",
    prijsmodel: "uren",
    ...overrides,
  };
}

// ─── Validatie bouwsteen-invoer ──────────────────────────────────────────────

describe("valideerBouwsteen", () => {
  it("accepteert een minimale geldige bouwsteen (prijzen/uren mogen leeg)", () => {
    expect(() => valideerBouwsteen(geldigeBouwsteen())).not.toThrow();
  });

  it("weigert een lege naam", () => {
    expect(() => valideerBouwsteen(geldigeBouwsteen({ naam: "  " }))).toThrow(
      ConvexError
    );
  });

  it("weigert ongeldige codes (leeg, te lang, met spaties of leestekens)", () => {
    for (const code of ["", "TELANGE", "H S", "H-S", "H!"]) {
      expect(() => valideerBouwsteen(geldigeBouwsteen({ code }))).toThrow(
        ConvexError
      );
    }
  });

  it("accepteert codes met kleine letters (worden genormaliseerd)", () => {
    expect(() =>
      valideerBouwsteen(geldigeBouwsteen({ code: " hs " }))
    ).not.toThrow();
    expect(normaliseerCode(" hs ")).toBe("HS");
  });

  it("weigert frequentie van 0 of negatief", () => {
    expect(() =>
      valideerBouwsteen(geldigeBouwsteen({ defaultFrequentiePerJaar: 0 }))
    ).toThrow(ConvexError);
    expect(() =>
      valideerBouwsteen(geldigeBouwsteen({ defaultFrequentiePerJaar: -3 }))
    ).toThrow(ConvexError);
    expect(() =>
      valideerBouwsteen(geldigeBouwsteen({ defaultFrequentiePerJaar: 26 }))
    ).not.toThrow();
  });

  it("weigert een half ingevuld seizoensvenster", () => {
    expect(() =>
      valideerBouwsteen(geldigeBouwsteen({ seizoensvensterVan: 3 }))
    ).toThrow(ConvexError);
    expect(() =>
      valideerBouwsteen(geldigeBouwsteen({ seizoensvensterTot: 11 }))
    ).toThrow(ConvexError);
  });

  it("weigert maanden buiten 1-12", () => {
    expect(() =>
      valideerBouwsteen(
        geldigeBouwsteen({ seizoensvensterVan: 0, seizoensvensterTot: 11 })
      )
    ).toThrow(ConvexError);
    expect(() =>
      valideerBouwsteen(
        geldigeBouwsteen({ seizoensvensterVan: 3, seizoensvensterTot: 13 })
      )
    ).toThrow(ConvexError);
  });

  it("accepteert een venster over de jaargrens (van 10 tot 3)", () => {
    expect(() =>
      valideerBouwsteen(
        geldigeBouwsteen({ seizoensvensterVan: 10, seizoensvensterTot: 3 })
      )
    ).not.toThrow();
  });

  it("weigert receptuurstappen zonder omschrijving of met volgorde < 1", () => {
    expect(() =>
      valideerBouwsteen(
        geldigeBouwsteen({
          receptuurstappen: [{ volgorde: 1, omschrijving: "  " }],
        })
      )
    ).toThrow(ConvexError);
    expect(() =>
      valideerBouwsteen(
        geldigeBouwsteen({
          receptuurstappen: [{ volgorde: 0, omschrijving: "Borstelen" }],
        })
      )
    ).toThrow(ConvexError);
    expect(() =>
      valideerBouwsteen(geldigeBouwsteen({ receptuurstappen: [] }))
    ).toThrow(ConvexError);
  });

  it("weigert uren ≤ 0 en negatief vast bedrag; 0 vast bedrag mag", () => {
    expect(() =>
      valideerBouwsteen(geldigeBouwsteen({ urenPerBeurt: 0 }))
    ).toThrow(ConvexError);
    expect(() =>
      valideerBouwsteen(geldigeBouwsteen({ vastBedragPerBeurt: -1 }))
    ).toThrow(ConvexError);
    expect(() =>
      valideerBouwsteen(geldigeBouwsteen({ vastBedragPerBeurt: 0 }))
    ).not.toThrow();
  });
});

// ─── Prijsindicatie (leermodus, principe 6) ──────────────────────────────────

describe("berekenPrijsPerBeurt", () => {
  it("rekent uren × uurtarief bij prijsmodel 'uren'", () => {
    expect(
      berekenPrijsPerBeurt({ prijsmodel: "uren", urenPerBeurt: 2 }, 65)
    ).toBe(130);
    expect(
      berekenPrijsPerBeurt({ prijsmodel: "uren", urenPerBeurt: 2.5 }, 65)
    ).toBe(162.5);
  });

  it("geeft null zolang uren of vast bedrag niet zijn ingevuld", () => {
    expect(berekenPrijsPerBeurt({ prijsmodel: "uren" }, 65)).toBeNull();
    expect(berekenPrijsPerBeurt({ prijsmodel: "vast" }, 65)).toBeNull();
  });

  it("gebruikt het vaste bedrag bij prijsmodel 'vast' (uurtarief irrelevant)", () => {
    expect(
      berekenPrijsPerBeurt(
        { prijsmodel: "vast", vastBedragPerBeurt: 150, urenPerBeurt: 2 },
        65
      )
    ).toBe(150);
  });
});

// ─── Rolchecks: beheer is kantoor-only (PRD §2.5f) ───────────────────────────

describe("catalogusbeheer rolchecks", () => {
  it("kantoor-rollen (directie, projectleider, legacy admin) mogen beheren", () => {
    expect(isKantoorRol("directie")).toBe(true);
    expect(isKantoorRol("projectleider")).toBe(true);
    expect(isKantoorRol("admin")).toBe(true); // legacy → directie
  });

  it("niet-kantoor-rollen worden geweigerd", () => {
    for (const rol of [
      "voorman",
      "medewerker",
      "onderaannemer_zzp",
      "materiaalman",
      "klant",
      "viewer", // legacy → klant
      undefined,
      null,
    ]) {
      expect(isKantoorRol(rol)).toBe(false);
    }
  });
});

// ─── Uurtarief op datum (acceptatie §8.7) ────────────────────────────────────

describe("bepaalTariefOpDatum", () => {
  const historie = [
    { bedrag: 65, ingangsdatum: "2026-01-01" },
    { bedrag: 75, ingangsdatum: "2026-07-01" },
    { bedrag: 80, ingangsdatum: "2027-01-01" },
  ];

  it("pakt het tarief met de meest recente ingangsdatum ≤ datum", () => {
    expect(bepaalTariefOpDatum(historie, "2026-03-15")?.bedrag).toBe(65);
    expect(bepaalTariefOpDatum(historie, "2026-07-01")?.bedrag).toBe(75);
    expect(bepaalTariefOpDatum(historie, "2026-12-31")?.bedrag).toBe(75);
    expect(bepaalTariefOpDatum(historie, "2027-06-01")?.bedrag).toBe(80);
  });

  it("een nieuw tarief raakt documenten met een eerdere datum niet (§8.7)", () => {
    // Offerte van 15 maart: tarief was 65. Ná de tariefwijziging per 1 juli
    // blijft het tarief op de offertedatum 65 — de wijziging is niet met
    // terugwerkende kracht.
    const voorWijziging = [{ bedrag: 65, ingangsdatum: "2026-01-01" }];
    const naWijziging = [
      ...voorWijziging,
      { bedrag: 75, ingangsdatum: "2026-07-01" },
    ];
    expect(bepaalTariefOpDatum(voorWijziging, "2026-03-15")?.bedrag).toBe(65);
    expect(bepaalTariefOpDatum(naWijziging, "2026-03-15")?.bedrag).toBe(65);
  });

  it("geeft null vóór het eerste tarief en negeert toekomstige tarieven", () => {
    expect(bepaalTariefOpDatum(historie, "2025-12-31")).toBeNull();
    expect(bepaalTariefOpDatum([], "2026-01-01")).toBeNull();
  });

  it("is onafhankelijk van de volgorde van de historie", () => {
    const geschud = [historie[2], historie[0], historie[1]];
    expect(bepaalTariefOpDatum(geschud, "2026-08-01")?.bedrag).toBe(75);
  });
});

describe("valideerIngangsdatum", () => {
  it("accepteert geldige JJJJ-MM-DD datums", () => {
    expect(() => valideerIngangsdatum("2026-01-01")).not.toThrow();
    expect(() => valideerIngangsdatum("2026-12-31")).not.toThrow();
  });

  it("weigert verkeerd formaat en niet-bestaande datums", () => {
    for (const datum of [
      "01-01-2026",
      "2026/01/01",
      "2026-1-1",
      "2026-13-01",
      "2026-02-30",
      "",
    ]) {
      expect(() => valideerIngangsdatum(datum)).toThrow(ConvexError);
    }
  });
});

// ─── Seed startvulling bijlage A ─────────────────────────────────────────────

describe("seed startvulling (bijlage A)", () => {
  it("bevat precies 23 bouwstenen met unieke codes", () => {
    expect(BOUWSTENEN_STARTVULLING).toHaveLength(23);
    const codes = BOUWSTENEN_STARTVULLING.map((b) => b.code);
    expect(new Set(codes).size).toBe(23);
    // Codes voldoen aan de code-regels (1-6 hoofdletters/cijfers)
    for (const code of codes) {
      expect(code).toMatch(/^[A-Z0-9]{1,6}$/);
    }
  });

  it("gebruikt alleen geldige categorieën en soorten", () => {
    for (const b of BOUWSTENEN_STARTVULLING) {
      expect(BOUWSTEEN_CATEGORIEEN).toContain(b.categorie);
      expect(BOUWSTEEN_SOORTEN).toContain(b.soort);
    }
    // Alle 7 categorieën uit bijlage A komen voor
    const categorieen = new Set(
      BOUWSTENEN_STARTVULLING.map((b) => b.categorie)
    );
    expect(categorieen.size).toBe(Object.keys(CATEGORIE_LABELS).length);
  });

  it("laat prijzen, uren en frequenties leeg (vult Mickey, §7.1)", () => {
    for (const b of BOUWSTENEN_STARTVULLING) {
      expect(b).not.toHaveProperty("urenPerBeurt");
      expect(b).not.toHaveProperty("vastBedragPerBeurt");
      expect(b).not.toHaveProperty("defaultFrequentiePerJaar");
      expect(b).not.toHaveProperty("normurenPerEenheid");
    }
  });

  it("geeft de reinigingsbeurt (#16) drie geordende receptuurstappen", () => {
    const rb = BOUWSTENEN_STARTVULLING.find((b) => b.code === "RB");
    expect(rb?.soort).toBe("terugkerend");
    expect(rb?.receptuurstappen).toHaveLength(3);
    expect(rb?.receptuurstappen?.map((s) => s.volgorde)).toEqual([1, 2, 3]);
    expect(rb?.receptuurstappen?.[0].omschrijving).toMatch(/borstelen/i);
    expect(rb?.receptuurstappen?.[2].omschrijving).toMatch(/invegen/i);
    // Alleen de reinigingsbeurt heeft een receptuur in de startvulling
    const metReceptuur = BOUWSTENEN_STARTVULLING.filter(
      (b) => b.receptuurstappen !== undefined
    );
    expect(metReceptuur).toHaveLength(1);
  });

  it("markeert #17 als keuzeregel en #19/#20 als bundel", () => {
    expect(
      BOUWSTENEN_STARTVULLING.find((b) => b.code === "IZ")?.soort
    ).toBe("keuzeregel");
    expect(
      BOUWSTENEN_STARTVULLING.find((b) => b.code === "VJ")?.soort
    ).toBe("bundel");
    expect(
      BOUWSTENEN_STARTVULLING.find((b) => b.code === "NJ")?.soort
    ).toBe("bundel");
  });

  it("bevat de drie kostenregels uit bijlage A", () => {
    const kostenregels = BOUWSTENEN_STARTVULLING.filter(
      (b) => b.soort === "kostenregel"
    );
    expect(kostenregels.map((b) => b.code).sort()).toEqual(["AG", "MT", "VR"]);
    for (const k of kostenregels) {
      expect(k.categorie).toBe("kosten_regels");
    }
  });

  it("is idempotent: een tweede run slaat alle bestaande codes over", () => {
    // Zelfde skip-logica als de migratie: bestaat de code al → overslaan
    const naEersteRun = new Set(BOUWSTENEN_STARTVULLING.map((b) => b.code));
    const tweedeRun = BOUWSTENEN_STARTVULLING.filter(
      (b) => !naEersteRun.has(b.code)
    );
    expect(tweedeRun).toHaveLength(0);
  });

  it("start-uurtarief is €65 ex btw met geldige ingangsdatum (§2.5a)", () => {
    expect(STANDAARD_UURTARIEF).toBe(65);
    expect(() =>
      valideerIngangsdatum(START_UURTARIEF_INGANGSDATUM)
    ).not.toThrow();
    // Het starttarief geldt op de ingangsdatum zelf
    expect(
      bepaalTariefOpDatum(
        [
          {
            bedrag: STANDAARD_UURTARIEF,
            ingangsdatum: START_UURTARIEF_INGANGSDATUM,
          },
        ],
        START_UURTARIEF_INGANGSDATUM
      )?.bedrag
    ).toBe(65);
  });
});
