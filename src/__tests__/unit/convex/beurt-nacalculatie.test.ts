/**
 * Beurt-nacalculatie + normuur-suggesties (PRD §3.4 + §2.5a, fase 2 slotstuk).
 *
 * Acceptatietests:
 * 1. Aggregatie: bevestigde/ingediende segmenten → werkelijke duur per
 *    werkitem en per bouwsteen; concept telt niet mee; reistijd apart en
 *    BES (afvalverwerker) apart naast de werktijd (§2.6);
 * 2. Suggestie-drempel: 4 uitgevoerde beurten = geen suggestie, 5 wel
 *    (default; instelbaar via instellingen.nacalculatieInstellingen);
 * 3. Overnemen-flow: kantoor-only, gewone update van het bouwsteen-record
 *    (urenPerBeurt bij prijsmodel "uren" → prijs volgt uurtarief-op-datum;
 *    normurenPerEenheid bij "vast");
 * 4. Geen automatische aanpassingen: de queries schrijven niets terug;
 * 5. Rolchecks: queries en mutation zijn kantoor-only.
 */

import { describe, it, expect } from "vitest";
import { ConvexError } from "convex/values";
import {
  MockConvexStore,
  createMockCtx,
  createMockUser,
  createMockKlant,
  seedMockOrganisatie,
} from "../../helpers/convex-mock";
import {
  aggregeerPerBouwsteen,
  bepaalNormuurSuggestie,
  DEFAULT_SUGGESTIE_DREMPEL_BEURTEN,
  huidigeNormVoorBouwsteen,
  isGeldigeSuggestieDrempel,
  normuurVeldVoorBouwsteen,
  segmentMinuten,
  telSegmenten,
  verdeelWerktijdOverBouwstenen,
} from "../../../../convex/beurtNacalculatieLogica";
import {
  getBeurtNacalculatie,
  getNormuurSuggesties,
  neemNormuurOver,
} from "../../../../convex/beurtNacalculatie";

// ─── Helpers ─────────────────────────────────────────────────────────────────

type AnyHandler = (ctx: unknown, args: unknown) => Promise<unknown>;

/** Convex registreert de handler op de functie zelf (func._handler). */
function handler(fn: unknown): AnyHandler {
  return (fn as { _handler: AnyHandler })._handler;
}

/**
 * Ctx + store met precies één ingelogde gebruiker met de gegeven rol.
 *
 * De organisatie hoort erbij: sinds fase 3 van de org-migratie leest
 * `requireOrg` het `org_id`-claim dat `createMockCtx` meegeeft, en zonder rij
 * in `organisaties` strandt élke org-gescopeerde functie op een AuthError.
 */
function ctxMetRol(role: string) {
  const store = new MockConvexStore();
  const orgId = seedMockOrganisatie(store);
  const userId = store.insert("users", createMockUser({ role }));
  const ctx = createMockCtx(store);
  return { ctx, store, userId, orgId };
}

function insertBouwsteen(
  store: MockConvexStore,
  orgId: string,
  overrides: Record<string, unknown> = {}
) {
  const now = Date.now();
  return store.insert("bouwstenen", {
    orgId,
    naam: "Heggen snoeien",
    code: "HS",
    categorie: "heggen_bomen",
    soort: "terugkerend",
    prijsmodel: "uren",
    urenPerBeurt: 2,
    btwCode: 9,
    actief: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });
}

function insertBeurt(
  store: MockConvexStore,
  orgId: string,
  userId: string,
  bouwsteenId: string,
  overrides: Record<string, unknown> = {}
) {
  const now = Date.now();
  return store.insert("projecten", {
    orgId,
    userId,
    type: "onderhoudsbeurt",
    status: "uitgevoerd",
    naam: "Beurt heg",
    geplandeStart: "2026-06-01",
    geschatteUren: 2,
    bouwsteenRegels: [{ bouwsteenId, omschrijving: "Heg snoeien" }],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });
}

function insertSegment(
  store: MockConvexStore,
  orgId: string,
  userId: string,
  werkitemId: string,
  overrides: Record<string, unknown> = {}
) {
  const now = Date.now();
  return store.insert("urenSegmenten", {
    orgId,
    userId,
    medewerkerId: "medewerkers:1",
    datum: "2026-06-01",
    categorie: "werken",
    beginTijd: "08:00",
    eindTijd: "10:30",
    werkitemId,
    status: "ingediend",
    bron: "voorstel",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });
}

// ─── Pure logica: segmenten → werkelijke duur ────────────────────────────────

describe("telSegmenten", () => {
  it("telt werken, reistijd en BES apart op (BES niet in de werktijd, §2.6)", () => {
    const tijden = telSegmenten([
      { categorie: "werken", beginTijd: "08:00", eindTijd: "10:00", status: "ingediend" },
      { categorie: "werken", beginTijd: "10:30", eindTijd: "11:00", status: "bevestigd" },
      { categorie: "reistijd", beginTijd: "07:30", eindTijd: "08:00", status: "ingediend" },
      { categorie: "afvalverwerker_bes", beginTijd: "11:00", eindTijd: "11:45", status: "ingediend" },
    ]);
    expect(tijden.werkenMinuten).toBe(150);
    expect(tijden.reistijdMinuten).toBe(30);
    expect(tijden.besMinuten).toBe(45);
  });

  it("telt concept-segmenten en overige categorieën niet mee", () => {
    const tijden = telSegmenten([
      { categorie: "werken", beginTijd: "08:00", eindTijd: "09:00", status: "concept" },
      { categorie: "pauze", beginTijd: "12:00", eindTijd: "12:30", status: "ingediend" },
      { categorie: "teammeeting", beginTijd: "07:00", eindTijd: "07:15", status: "ingediend" },
    ]);
    expect(tijden).toEqual({ werkenMinuten: 0, reistijdMinuten: 0, besMinuten: 0 });
  });

  it("negeert ongeldige of negatieve tijden (segmentMinuten = 0)", () => {
    expect(segmentMinuten("10:00", "09:00")).toBe(0);
    expect(segmentMinuten("kapot", "10:00")).toBe(0);
    expect(segmentMinuten("08:15", "09:00")).toBe(45);
  });
});

describe("verdeelWerktijdOverBouwstenen", () => {
  it("wijst alle werktijd toe bij één bouwsteen-taak", () => {
    expect(
      verdeelWerktijdOverBouwstenen(
        [{ bouwsteenId: "b1", normUren: null }],
        120
      )
    ).toEqual([{ bouwsteenId: "b1", minuten: 120 }]);
  });

  it("verdeelt naar rato van de normuren bij meerdere taken", () => {
    const bijdragen = verdeelWerktijdOverBouwstenen(
      [
        { bouwsteenId: "b1", normUren: 2 },
        { bouwsteenId: "b2", normUren: 1 },
      ],
      90
    );
    expect(bijdragen).toEqual([
      { bouwsteenId: "b1", minuten: 60 },
      { bouwsteenId: "b2", minuten: 30 },
    ]);
  });

  it("geeft null bij meerdere taken zonder volledige normuren (giswerk)", () => {
    expect(
      verdeelWerktijdOverBouwstenen(
        [
          { bouwsteenId: "b1", normUren: 2 },
          { bouwsteenId: "b2", normUren: null },
        ],
        90
      )
    ).toBeNull();
  });

  it("geeft null zonder bouwsteen-taken of zonder werktijd", () => {
    expect(
      verdeelWerktijdOverBouwstenen([{ bouwsteenId: null, normUren: null }], 60)
    ).toBeNull();
    expect(
      verdeelWerktijdOverBouwstenen([{ bouwsteenId: "b1", normUren: 1 }], 0)
    ).toBeNull();
  });
});

describe("aggregeerPerBouwsteen", () => {
  it("berekent gemiddelde werkelijke duur per beurt per bouwsteen", () => {
    const aggregaties = aggregeerPerBouwsteen([
      [{ bouwsteenId: "b1", minuten: 120 }],
      [{ bouwsteenId: "b1", minuten: 180 }],
      [{ bouwsteenId: "b2", minuten: 60 }],
    ]);
    const b1 = aggregaties.find((a) => a.bouwsteenId === "b1");
    expect(b1?.aantalBeurten).toBe(2);
    expect(b1?.gemiddeldeUren).toBeCloseTo(2.5);
    const b2 = aggregaties.find((a) => a.bouwsteenId === "b2");
    expect(b2?.aantalBeurten).toBe(1);
    expect(b2?.gemiddeldeUren).toBeCloseTo(1);
  });
});

// ─── Pure logica: suggestie-drempel ──────────────────────────────────────────

describe("bepaalNormuurSuggestie", () => {
  const basis = { gemiddeldeUren: 2.62, huidigeNormUren: 2, drempel: 5 };

  it("geeft GEEN suggestie bij 4 beurten en WEL bij 5 (drempel)", () => {
    expect(bepaalNormuurSuggestie({ ...basis, aantalBeurten: 4 })).toBeNull();
    const suggestie = bepaalNormuurSuggestie({ ...basis, aantalBeurten: 5 });
    expect(suggestie).not.toBeNull();
    expect(suggestie?.voorgesteldeNormUren).toBeCloseTo(2.6);
    expect(suggestie?.huidigeNormUren).toBe(2);
    expect(suggestie?.aantalBeurten).toBe(5);
  });

  it("default drempel is 5", () => {
    expect(DEFAULT_SUGGESTIE_DREMPEL_BEURTEN).toBe(5);
  });

  it("geeft geen suggestie als de norm al klopt (afgerond gelijk)", () => {
    expect(
      bepaalNormuurSuggestie({
        aantalBeurten: 8,
        gemiddeldeUren: 2.04,
        huidigeNormUren: 2,
        drempel: 5,
      })
    ).toBeNull();
  });

  it("suggereert ook als er nog géén norm is (huidigeNormUren null)", () => {
    const suggestie = bepaalNormuurSuggestie({
      aantalBeurten: 6,
      gemiddeldeUren: 1.71,
      huidigeNormUren: null,
      drempel: 5,
    });
    expect(suggestie?.voorgesteldeNormUren).toBeCloseTo(1.7);
  });

  it("valideert de drempel-instelling (geheel getal ≥ 1)", () => {
    expect(isGeldigeSuggestieDrempel(1)).toBe(true);
    expect(isGeldigeSuggestieDrempel(5)).toBe(true);
    expect(isGeldigeSuggestieDrempel(0)).toBe(false);
    expect(isGeldigeSuggestieDrempel(2.5)).toBe(false);
    expect(isGeldigeSuggestieDrempel(-3)).toBe(false);
  });
});

describe("normuurVeld / huidige norm", () => {
  it("prijsmodel uren → urenPerBeurt; vast → normurenPerEenheid", () => {
    expect(normuurVeldVoorBouwsteen({ prijsmodel: "uren" })).toBe("urenPerBeurt");
    expect(normuurVeldVoorBouwsteen({ prijsmodel: "vast" })).toBe(
      "normurenPerEenheid"
    );
  });

  it("huidige norm volgt dezelfde voorrang als de dagkaart", () => {
    expect(
      huidigeNormVoorBouwsteen({ urenPerBeurt: 2, normurenPerEenheid: 3 })
    ).toBe(2);
    expect(huidigeNormVoorBouwsteen({ normurenPerEenheid: 3 })).toBe(3);
    expect(huidigeNormVoorBouwsteen({})).toBeNull();
  });
});

// ─── Keten: segmenten → beurt-nacalculatie (query-handlers) ──────────────────

describe("getBeurtNacalculatie", () => {
  it("aggregeert per beurt: werken vs gepland, reistijd apart, BES apart", async () => {
    const { ctx, store, userId, orgId } = ctxMetRol("directie");
    const klantId = store.insert("klanten", createMockKlant(userId, { orgId }));
    const bouwsteenId = insertBouwsteen(store, orgId);
    const beurtId = insertBeurt(store, orgId, userId, bouwsteenId, { klantId });
    // 2,5 uur werken + 0,5 uur reistijd + 0,75 uur BES; concept telt niet mee
    insertSegment(store, orgId, userId, beurtId); // 08:00-10:30 werken
    insertSegment(store, orgId, userId, beurtId, {
      categorie: "reistijd",
      beginTijd: "07:30",
      eindTijd: "08:00",
    });
    insertSegment(store, orgId, userId, beurtId, {
      categorie: "afvalverwerker_bes",
      beginTijd: "11:00",
      eindTijd: "11:45",
    });
    insertSegment(store, orgId, userId, beurtId, {
      beginTijd: "13:00",
      eindTijd: "14:00",
      status: "concept",
    });

    const resultaat = (await handler(getBeurtNacalculatie)(ctx, {})) as {
      beurten: {
        werkelijkeUren: number;
        reistijdUren: number;
        besUren: number;
        geplandeUren: number | null;
        afwijkingUren: number | null;
        klantNaam: string | null;
      }[];
    };
    expect(resultaat.beurten).toHaveLength(1);
    const rij = resultaat.beurten[0];
    expect(rij.werkelijkeUren).toBeCloseTo(2.5);
    expect(rij.reistijdUren).toBeCloseTo(0.5);
    expect(rij.besUren).toBeCloseTo(0.75);
    expect(rij.geplandeUren).toBe(2);
    expect(rij.afwijkingUren).toBeCloseTo(0.5);
    expect(rij.klantNaam).toBe("Jan de Vries");
  });

  it("slaat beurten zonder gelogde segmenten over en valideert de periode", async () => {
    const { ctx, store, userId, orgId } = ctxMetRol("directie");
    const bouwsteenId = insertBouwsteen(store, orgId);
    insertBeurt(store, orgId, userId, bouwsteenId); // geen segmenten
    const resultaat = (await handler(getBeurtNacalculatie)(ctx, {})) as {
      beurten: unknown[];
    };
    expect(resultaat.beurten).toHaveLength(0);

    await expect(
      handler(getBeurtNacalculatie)(ctx, { vanDatum: "01-06-2026" })
    ).rejects.toThrow(ConvexError);
    await expect(
      handler(getBeurtNacalculatie)(ctx, {
        vanDatum: "2026-06-30",
        totDatum: "2026-06-01",
      })
    ).rejects.toThrow(ConvexError);
  });

  it("is kantoor-only (voorman/medewerker geweigerd)", async () => {
    for (const rol of ["voorman", "medewerker"]) {
      const { ctx } = ctxMetRol(rol);
      await expect(handler(getBeurtNacalculatie)(ctx, {})).rejects.toThrow();
    }
  });
});

describe("getNormuurSuggesties — drempel over de echte keten", () => {
  function seedBeurten(
    store: MockConvexStore,
    orgId: string,
    userId: string,
    bouwsteenId: string,
    aantal: number
  ) {
    for (let i = 0; i < aantal; i++) {
      const beurtId = insertBeurt(store, orgId, userId, bouwsteenId, {
        geplandeStart: `2026-06-0${i + 1}`,
      });
      // 3 uur werkelijk per beurt (norm is 2 → suggestie 3,0 verwacht)
      insertSegment(store, orgId, userId, beurtId, {
        beginTijd: "08:00",
        eindTijd: "11:00",
      });
    }
  }

  it("4 uitgevoerde beurten = geen suggestie, 5 wel", async () => {
    // 4 beurten → leeg
    const vier = ctxMetRol("directie");
    const bouwsteen4 = insertBouwsteen(vier.store, vier.orgId);
    seedBeurten(vier.store, vier.orgId, vier.userId, bouwsteen4, 4);
    const resultaat4 = (await handler(getNormuurSuggesties)(vier.ctx, {})) as {
      suggesties: unknown[];
      drempel: number;
    };
    expect(resultaat4.drempel).toBe(5);
    expect(resultaat4.suggesties).toHaveLength(0);

    // 5 beurten → suggestie 3,0 uur (huidige norm 2)
    const vijf = ctxMetRol("directie");
    const bouwsteen5 = insertBouwsteen(vijf.store, vijf.orgId);
    seedBeurten(vijf.store, vijf.orgId, vijf.userId, bouwsteen5, 5);
    const resultaat5 = (await handler(getNormuurSuggesties)(vijf.ctx, {})) as {
      suggesties: {
        bouwsteenId: string;
        voorgesteldeNormUren: number;
        huidigeNormUren: number | null;
        aantalBeurten: number;
        normuurVeld: string;
      }[];
    };
    expect(resultaat5.suggesties).toHaveLength(1);
    expect(resultaat5.suggesties[0].bouwsteenId).toBe(bouwsteen5);
    expect(resultaat5.suggesties[0].voorgesteldeNormUren).toBeCloseTo(3);
    expect(resultaat5.suggesties[0].huidigeNormUren).toBe(2);
    expect(resultaat5.suggesties[0].aantalBeurten).toBe(5);
    expect(resultaat5.suggesties[0].normuurVeld).toBe("urenPerBeurt");
  });

  it("respecteert een ingestelde drempel uit instellingen", async () => {
    const { ctx, store, userId, orgId } = ctxMetRol("directie");
    store.insert("instellingen", {
      orgId,
      userId,
      nacalculatieInstellingen: { suggestieDrempelBeurten: 3 },
    });
    const bouwsteenId = insertBouwsteen(store, orgId);
    seedBeurten(store, orgId, userId, bouwsteenId, 3);
    const resultaat = (await handler(getNormuurSuggesties)(ctx, {})) as {
      suggesties: unknown[];
      drempel: number;
    };
    expect(resultaat.drempel).toBe(3);
    expect(resultaat.suggesties).toHaveLength(1);
  });

  it("deels uitgevoerde beurten voeden de aggregatie niet", async () => {
    const { ctx, store, userId, orgId } = ctxMetRol("directie");
    const bouwsteenId = insertBouwsteen(store, orgId);
    seedBeurten(store, orgId, userId, bouwsteenId, 4);
    const deelsId = insertBeurt(store, orgId, userId, bouwsteenId, {
      status: "deels_uitgevoerd",
      geplandeStart: "2026-06-09",
    });
    insertSegment(store, orgId, userId, deelsId, {
      beginTijd: "08:00",
      eindTijd: "11:00",
    });
    const resultaat = (await handler(getNormuurSuggesties)(ctx, {})) as {
      suggesties: unknown[];
    };
    // 4 volledige + 1 deels = nog steeds onder de drempel van 5
    expect(resultaat.suggesties).toHaveLength(0);
  });

  it("is kantoor-only", async () => {
    const { ctx } = ctxMetRol("medewerker");
    await expect(handler(getNormuurSuggesties)(ctx, {})).rejects.toThrow();
  });
});

// ─── Overnemen-flow (mens beslist; gewone record-update) ─────────────────────

describe("neemNormuurOver", () => {
  it("werkt urenPerBeurt bij (prijsmodel uren) — prijs volgt uurtarief-op-datum", async () => {
    const { ctx, store, orgId } = ctxMetRol("directie");
    const bouwsteenId = insertBouwsteen(store, orgId);
    await handler(neemNormuurOver)(ctx, { bouwsteenId, uren: 2.6 });
    const bouwsteen = store.get(bouwsteenId);
    expect(bouwsteen?.urenPerBeurt).toBe(2.6);
    expect(bouwsteen?.normurenPerEenheid).toBeUndefined();
  });

  it("werkt normurenPerEenheid bij (prijsmodel vast) — vast bedrag blijft staan", async () => {
    const { ctx, store, orgId } = ctxMetRol("projectleider");
    const bouwsteenId = insertBouwsteen(store, orgId, {
      prijsmodel: "vast",
      urenPerBeurt: undefined,
      vastBedragPerBeurt: 85,
    });
    await handler(neemNormuurOver)(ctx, { bouwsteenId, uren: 1.4 });
    const bouwsteen = store.get(bouwsteenId);
    expect(bouwsteen?.normurenPerEenheid).toBe(1.4);
    expect(bouwsteen?.vastBedragPerBeurt).toBe(85);
  });

  it("weigert ongeldige uren en onbekende bouwstenen", async () => {
    const { ctx, store, orgId } = ctxMetRol("directie");
    const bouwsteenId = insertBouwsteen(store, orgId);
    for (const uren of [0, -1, Number.NaN, 5000]) {
      await expect(
        handler(neemNormuurOver)(ctx, { bouwsteenId, uren })
      ).rejects.toThrow(ConvexError);
    }
    await expect(
      handler(neemNormuurOver)(ctx, { bouwsteenId: "bouwstenen:999", uren: 2 })
    ).rejects.toThrow(ConvexError);
  });

  it("is kantoor-only: voorman/medewerker/klant mogen niet overnemen", async () => {
    for (const rol of ["voorman", "medewerker", "klant"]) {
      const { ctx, store, orgId } = ctxMetRol(rol);
      const bouwsteenId = insertBouwsteen(store, orgId);
      await expect(
        handler(neemNormuurOver)(ctx, { bouwsteenId, uren: 2.5 })
      ).rejects.toThrow();
      expect(store.get(bouwsteenId)?.urenPerBeurt).toBe(2);
    }
  });
});
