// @vitest-environment node
/**
 * R2 — dashboard en rapportage tonen hetzelfde cijfer.
 *
 * De schouw van 15 aug 2026 mat vier verschillende "omzetten" in dezelfde app:
 * analytics telde gearchiveerde offertes mee, het dashboard niet; het dashboard
 * had zelfs twee tegenstrijdige "openstaand"-bedragen in één payload. Deze
 * suite draait beide queries tegen dezélfde nepdatabase en eist gelijke
 * uitkomsten — als iemand later opnieuw een eigen sommetje in dashboard.ts of
 * rapportage.ts schrijft, valt hij hier om.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { getAdminDashboardData } from "../../../../convex/dashboard";
import { getRapportage } from "../../../../convex/rapportage";
import {
  berekenFacturatie,
  berekenGetekendeOmzet,
  isGefactureerd,
  peildatumGetekend,
} from "../../../../convex/lib/omzetDefinities";

// ─── Nep-Convex-database ─────────────────────────────────────────────────────

interface FakeDoc {
  _id: string;
  _creationTime: number;
  [key: string]: unknown;
}

type Vergelijker = "eq" | "gte" | "gt" | "lte" | "lt";

interface IndexQ {
  eq: (field: string, value: unknown) => IndexQ;
  gte: (field: string, value: unknown) => IndexQ;
  gt: (field: string, value: unknown) => IndexQ;
  lte: (field: string, value: unknown) => IndexQ;
  lt: (field: string, value: unknown) => IndexQ;
}

function voldoet(
  waarde: unknown,
  vergelijker: Vergelijker,
  grens: unknown
): boolean {
  switch (vergelijker) {
    case "eq":
      return waarde === grens;
    case "gte":
      return (waarde as number) >= (grens as number);
    case "gt":
      return (waarde as number) > (grens as number);
    case "lte":
      return (waarde as number) <= (grens as number);
    case "lt":
      return (waarde as number) < (grens as number);
  }
}

function bouwer(docs: FakeDoc[]) {
  let huidig = [...docs];
  const builder = {
    withIndex(_index: string, fn: (q: IndexQ) => IndexQ) {
      const constraints: Array<[string, Vergelijker, unknown]> = [];
      const maak = (vergelijker: Vergelijker) => (field: string, value: unknown) => {
        constraints.push([field, vergelijker, value]);
        return q;
      };
      const q: IndexQ = {
        eq: maak("eq"),
        gte: maak("gte"),
        gt: maak("gt"),
        lte: maak("lte"),
        lt: maak("lt"),
      };
      fn(q);
      huidig = huidig.filter((doc) =>
        constraints.every(([field, vergelijker, value]) =>
          voldoet(doc[field], vergelijker, value)
        )
      );
      return builder;
    },
    order(_richting: "asc" | "desc") {
      return builder;
    },
    async collect() {
      return [...huidig];
    },
    async first() {
      return huidig[0] ?? null;
    },
    async unique() {
      return huidig[0] ?? null;
    },
  };
  return builder;
}

class FakeDb {
  private tabellen = new Map<string, FakeDoc[]>();
  private teller = 0;

  insert(tabel: string, data: Record<string, unknown>): string {
    const _id = `${tabel}:${++this.teller}`;
    const doc = { ...data, _id, _creationTime: Date.now() } as FakeDoc;
    this.tabellen.set(tabel, [...(this.tabellen.get(tabel) ?? []), doc]);
    return _id;
  }

  query(tabel: string) {
    return bouwer(this.tabellen.get(tabel) ?? []);
  }

  async get(id: string) {
    for (const docs of this.tabellen.values()) {
      const gevonden = docs.find((d) => d._id === id);
      if (gevonden) return gevonden;
    }
    return null;
  }
}

interface FakeCtx {
  db: FakeDb;
  auth: {
    getUserIdentity: () => Promise<{ subject: string; org_id?: string } | null>;
  };
}

type Handler<TArgs, TResult> = (ctx: FakeCtx, args: TArgs) => Promise<TResult>;

function handlerVan<TArgs, TResult>(fn: unknown): Handler<TArgs, TResult> {
  return (fn as { _handler: Handler<TArgs, TResult> })._handler;
}

const dashboardHandler = handlerVan<
  Record<string, never>,
  {
    offerteStats: { geaccepteerd: number; geaccepteerdWaarde: number; voorcalculatie: number };
    revenueStats: { totalAcceptedValue: number; totalAcceptedCount: number };
    facturenStats: { openstaandBedrag: number; betaaldBedrag: number };
    financieel: { openstaandBedrag: number; vervaldeAantal: number };
    kwartaalVergelijking: { revenueThisQ: number; gefactureerdThisQ: number };
  }
>(getAdminDashboardData);

const rapportageHandler = handlerVan<
  { preset?: string; startDate?: number; endDate?: number; referentie?: number },
  {
    periode: { label: string; start: number; eind: number };
    hoeLoopt: {
      huidig: {
        getekendeOmzetInclBtw: number;
        getekendeOmzetExclBtw: number;
        aantalGetekend: number;
        gefactureerdInclBtw: number;
        openstaand: number;
      };
      zelfdePeriodeVorigJaar: { getekendeOmzetInclBtw: number } | null;
      verschil: { getekendeOmzetVsVorigJaar: number | null };
      maandReeks: Array<{ maandKey: string; getekendeOmzetExclBtw: number }>;
    };
    pipeline: { openStatussen: { voorcalculatie: number } };
    geldLigt: {
      openstaand: { totaalOpenstaand: number };
      voorNacalculatie: {
        aantalProjecten: number;
        afwijkingUren: number;
        afwijkingEuro: number;
        accuratessePercentage: number;
        projectenZonderNacalculatie: number;
        scopes: Array<{ scope: string; afwijkingUren: number }>;
      };
    };
    besteWerk: {
      scopeMarges: Array<{ scope: string; margePercentage: number }>;
      topKlanten: Array<{ klantNaam: string }>;
    };
    meta: { heeftData: boolean };
  }
>(getRapportage);

// ─── Fixture ─────────────────────────────────────────────────────────────────

/** Vast referentiemoment: 15 augustus 2026, 12:00 lokale tijd. */
const NU = new Date(2026, 7, 15, 12, 0, 0).getTime();
const DAG = 24 * 60 * 60 * 1000;

let db: FakeDb;
let ctx: FakeCtx;
let userId: string;
/** Tenant-sleutel sinds fase 3: het orgId achter het `org_id`-claim. */
let orgId: string;

function maakOfferte(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    orgId,
    userId,
    type: "aanleg",
    status: "geaccepteerd",
    offerteNummer: "TT-001",
    klant: { naam: "Klant", adres: "A 1", postcode: "1000 AA", plaats: "Plaats" },
    scopes: ["bestrating"],
    regels: [],
    totalen: {
      materiaalkosten: 0,
      arbeidskosten: 0,
      totaalUren: 0,
      subtotaal: 0,
      marge: 2000,
      margePercentage: 20,
      totaalExBtw: 10000,
      btw: 2100,
      totaalInclBtw: 12100,
    },
    createdAt: NU - 30 * DAG,
    updatedAt: NU - 5 * DAG,
    ...overrides,
  };
}

function maakFactuur(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    orgId,
    userId,
    factuurnummer: "F-001",
    status: "verzonden",
    documentStatus: "verzonden",
    betaalStatus: "open",
    klant: { naam: "Klant", adres: "A 1", postcode: "1000 AA", plaats: "Plaats" },
    bedrijf: { naam: "Top Tuinen", adres: "B 2", postcode: "1000 BB", plaats: "Plaats" },
    regels: [],
    subtotaal: 5000,
    btwPercentage: 21,
    btwBedrag: 1050,
    totaalInclBtw: 6050,
    factuurdatum: NU - 20 * DAG,
    vervaldatum: NU + 10 * DAG,
    betalingstermijnDagen: 30,
    createdAt: NU - 20 * DAG,
    updatedAt: NU - 20 * DAG,
    ...overrides,
  };
}

beforeEach(() => {
  db = new FakeDb();
  ctx = {
    db,
    auth: {
      getUserIdentity: async () => ({
        subject: "clerk_directie",
        org_id: "clerk_org_toptuinen",
      }),
    },
  };
  orgId = db.insert("organisaties", {
    clerkOrgId: "clerk_org_toptuinen",
    naam: "Top Tuinen",
    actief: true,
    aangemaaktOp: NU,
  });
  userId = db.insert("users", {
    clerkId: "clerk_directie",
    email: "directie@toptuinen.nl",
    name: "Directie",
    role: "directie",
    createdAt: NU,
  });
  db.insert("instellingen", {
    orgId,
    userId,
    uurtarief: 50,
    btwPercentage: 21,
  });
});

// ─── De gedeelde definitie ───────────────────────────────────────────────────

describe("gedeelde omzetdefinitie", () => {
  it("dashboard en rapportage tonen dezelfde getekende omzet", async () => {
    db.insert("offertes", maakOfferte({ offerteNummer: "TT-001" }));
    db.insert("offertes", maakOfferte({ offerteNummer: "TT-002" }));
    db.insert("offertes", maakOfferte({ offerteNummer: "TT-003", status: "verzonden" }));

    const dashboard = await dashboardHandler(ctx, {});
    const rapportage = await rapportageHandler(ctx, {
      preset: "alles",
      referentie: NU,
    });

    expect(dashboard.revenueStats.totalAcceptedValue).toBe(24200);
    expect(rapportage.hoeLoopt.huidig.getekendeOmzetInclBtw).toBe(
      dashboard.revenueStats.totalAcceptedValue
    );
    expect(rapportage.hoeLoopt.huidig.aantalGetekend).toBe(
      dashboard.revenueStats.totalAcceptedCount
    );
    expect(dashboard.offerteStats.geaccepteerdWaarde).toBe(
      rapportage.hoeLoopt.huidig.getekendeOmzetInclBtw
    );
  });

  it("laat gearchiveerde en verwijderde offertes op beide plekken buiten de omzet", async () => {
    db.insert("offertes", maakOfferte({ offerteNummer: "TT-001" }));
    db.insert("offertes", maakOfferte({ offerteNummer: "TT-ARCHIEF", isArchived: true }));
    db.insert("offertes", maakOfferte({ offerteNummer: "TT-PRULLENBAK", deletedAt: NU }));

    const dashboard = await dashboardHandler(ctx, {});
    const rapportage = await rapportageHandler(ctx, {
      preset: "alles",
      referentie: NU,
    });

    expect(dashboard.revenueStats.totalAcceptedValue).toBe(12100);
    expect(rapportage.hoeLoopt.huidig.getekendeOmzetInclBtw).toBe(12100);
  });

  it("telt de legacy-status definitief als voorcalculatie in plaats van in een NaN-veld", async () => {
    db.insert("offertes", maakOfferte({ status: "definitief" }));
    db.insert("offertes", maakOfferte({ status: "voorcalculatie" }));

    const dashboard = await dashboardHandler(ctx, {});
    const rapportage = await rapportageHandler(ctx, {
      preset: "alles",
      referentie: NU,
    });

    expect(dashboard.offerteStats.voorcalculatie).toBe(2);
    expect(rapportage.pipeline.openStatussen.voorcalculatie).toBe(2);
    expect(Number.isNaN(dashboard.offerteStats.geaccepteerdWaarde)).toBe(false);
  });

  it("gebruikt één openstaand-bedrag in plaats van twee tegenstrijdige", async () => {
    // Verzonden en onbetaald: telt mee.
    db.insert("facturen", maakFactuur({ factuurnummer: "F-OPEN" }));
    // Definitief maar nog niet verzonden: ligt op kantoor, telt niet mee.
    db.insert(
      "facturen",
      maakFactuur({
        factuurnummer: "F-CONCEPT",
        status: "definitief",
        documentStatus: "definitief",
      })
    );
    // Deels betaald: alleen de rest staat open.
    db.insert(
      "facturen",
      maakFactuur({
        factuurnummer: "F-DEELS",
        betaalStatus: "gedeeltelijk_betaald",
        betaaldBedrag: 2000,
      })
    );

    const dashboard = await dashboardHandler(ctx, {});
    const rapportage = await rapportageHandler(ctx, {
      preset: "alles",
      referentie: NU,
    });

    // 6050 volledig open + (6050 − 2000) van de deelbetaling.
    expect(dashboard.facturenStats.openstaandBedrag).toBe(10100);
    expect(dashboard.financieel.openstaandBedrag).toBe(
      dashboard.facturenStats.openstaandBedrag
    );
    expect(rapportage.geldLigt.openstaand.totaalOpenstaand).toBe(
      dashboard.financieel.openstaandBedrag
    );
  });

  it("dashboardkwartaal en rapportagekwartaal zijn hetzelfde venster", async () => {
    // Q3 2026 loopt van 1 juli t/m 30 september.
    db.insert(
      "offertes",
      maakOfferte({
        offerteNummer: "TT-Q3",
        updatedAt: new Date(2026, 7, 1).getTime(),
      })
    );
    // Getekend in juni = Q2, valt buiten dit kwartaal.
    db.insert(
      "offertes",
      maakOfferte({
        offerteNummer: "TT-Q2",
        createdAt: new Date(2026, 4, 1).getTime(),
        updatedAt: new Date(2026, 5, 10).getTime(),
      })
    );

    const dashboard = await dashboardHandler(ctx, {});
    const rapportage = await rapportageHandler(ctx, {
      preset: "dit-kwartaal",
      referentie: NU,
    });

    expect(rapportage.periode.label).toBe("Q3 2026");
    expect(dashboard.kwartaalVergelijking.revenueThisQ).toBe(12100);
    expect(rapportage.hoeLoopt.huidig.getekendeOmzetInclBtw).toBe(
      dashboard.kwartaalVergelijking.revenueThisQ
    );
  });

  it("gefactureerd op het dashboard telt alleen verzonden facturen, net als de rapportage", async () => {
    db.insert("facturen", maakFactuur({ factuurnummer: "F-VERZONDEN" }));
    db.insert(
      "facturen",
      maakFactuur({
        factuurnummer: "F-CONCEPT",
        status: "concept",
        documentStatus: "concept",
      })
    );

    const dashboard = await dashboardHandler(ctx, {});
    const rapportage = await rapportageHandler(ctx, {
      preset: "dit-kwartaal",
      referentie: NU,
    });

    expect(dashboard.kwartaalVergelijking.gefactureerdThisQ).toBe(6050);
    expect(rapportage.hoeLoopt.huidig.gefactureerdInclBtw).toBe(
      dashboard.kwartaalVergelijking.gefactureerdThisQ
    );
  });
});

// ─── De vier vraagsecties krijgen echte data ─────────────────────────────────

describe("getRapportage voedt de vier secties", () => {
  it("sluit de voorheen ongebruikte voor/nacalculatie aan op echte data", async () => {
    const offerteId = db.insert("offertes", maakOfferte({ offerteNummer: "TT-VN" }));
    const projectId = db.insert("projecten", {
      orgId,
      userId,
      offerteId,
      naam: "Tuin Van Dijk",
      status: "nacalculatie_compleet",
      createdAt: NU - 60 * DAG,
      updatedAt: NU - 10 * DAG,
    });
    db.insert("voorcalculaties", {
      userId,
      offerteId,
      teamGrootte: 2,
      effectieveUrenPerDag: 14,
      normUrenTotaal: 100,
      geschatteDagen: 8,
      normUrenPerScope: { bestrating: 60, grondwerk: 40 },
      createdAt: NU - 60 * DAG,
    });
    db.insert("nacalculaties", {
      projectId,
      werkelijkeUren: 130,
      werkelijkeDagen: 10,
      werkelijkeMachineKosten: 0,
      afwijkingUren: 30,
      afwijkingPercentage: 30,
      afwijkingenPerScope: { bestrating: 25, grondwerk: 5 },
      createdAt: NU - 10 * DAG,
    });
    // Afgerond project zonder nacalculatie: het blok moet eerlijk melden dat
    // het onvolledig is in plaats van te doen alsof alles geteld is.
    db.insert("projecten", {
      orgId,
      userId,
      naam: "Tuin Zonder Nacalculatie",
      status: "afgerond",
      createdAt: NU - 20 * DAG,
      updatedAt: NU - 20 * DAG,
    });

    const rapportage = await rapportageHandler(ctx, {
      preset: "dit-jaar",
      referentie: NU,
    });
    const vn = rapportage.geldLigt.voorNacalculatie;

    expect(vn.aantalProjecten).toBe(1);
    expect(vn.afwijkingUren).toBe(30);
    expect(vn.afwijkingEuro).toBe(1500); // 30 uur × € 50 uurtarief
    expect(vn.accuratessePercentage).toBe(0); // 30% afwijking is niet accuraat
    expect(vn.projectenZonderNacalculatie).toBe(1);
    expect(vn.scopes.find((s) => s.scope === "bestrating")?.afwijkingUren).toBe(25);
  });

  it("vult marge per scope en topklanten met echte cijfers", async () => {
    db.insert(
      "offertes",
      maakOfferte({
        offerteNummer: "TT-SCOPE",
        scopes: ["bestrating", "borders"],
        regels: [
          { id: "r1", scope: "bestrating", totaal: 7500, type: "materiaal" },
          { id: "r2", scope: "borders", totaal: 2500, type: "materiaal" },
        ],
      })
    );

    const rapportage = await rapportageHandler(ctx, {
      preset: "alles",
      referentie: NU,
    });

    expect(rapportage.besteWerk.scopeMarges.map((s) => s.scope)).toEqual([
      "bestrating",
      "borders",
    ]);
    expect(rapportage.besteWerk.scopeMarges[0].margePercentage).toBe(20);
    expect(rapportage.besteWerk.topKlanten[0].klantNaam).toBe("Klant");
    expect(rapportage.meta.heeftData).toBe(true);
  });

  it("geeft bij vorig jaar aantoonbaar andere cijfers dan bij dit jaar", async () => {
    db.insert(
      "offertes",
      maakOfferte({
        offerteNummer: "TT-2026",
        createdAt: new Date(2026, 2, 1).getTime(),
        updatedAt: new Date(2026, 3, 1).getTime(),
      })
    );
    db.insert(
      "offertes",
      maakOfferte({
        offerteNummer: "TT-2025",
        createdAt: new Date(2025, 2, 1).getTime(),
        updatedAt: new Date(2025, 3, 1).getTime(),
        totalen: {
          materiaalkosten: 0,
          arbeidskosten: 0,
          totaalUren: 0,
          subtotaal: 0,
          marge: 1000,
          margePercentage: 20,
          totaalExBtw: 5000,
          btw: 1050,
          totaalInclBtw: 6050,
        },
      })
    );

    const ditJaar = await rapportageHandler(ctx, {
      preset: "dit-jaar",
      referentie: NU,
    });
    const vorigJaar = await rapportageHandler(ctx, {
      preset: "vorig-jaar",
      referentie: NU,
    });

    expect(ditJaar.periode.label).toBe("2026");
    expect(vorigJaar.periode.label).toBe("2025");
    expect(ditJaar.hoeLoopt.huidig.getekendeOmzetInclBtw).toBe(12100);
    expect(vorigJaar.hoeLoopt.huidig.getekendeOmzetInclBtw).toBe(6050);
    expect(ditJaar.hoeLoopt.huidig.getekendeOmzetInclBtw).not.toBe(
      vorigJaar.hoeLoopt.huidig.getekendeOmzetInclBtw
    );
    // Dit jaar t.o.v. vorig jaar: 12100 vs 6050 = +100%.
    expect(ditJaar.hoeLoopt.verschil.getekendeOmzetVsVorigJaar).toBe(100);
  });

  it("vergelijkt een seizoen met hetzelfde seizoen vorig jaar", async () => {
    db.insert(
      "offertes",
      maakOfferte({
        offerteNummer: "TT-VOORJAAR-2026",
        createdAt: new Date(2026, 3, 1).getTime(),
        updatedAt: new Date(2026, 3, 10).getTime(),
      })
    );
    db.insert(
      "offertes",
      maakOfferte({
        offerteNummer: "TT-VOORJAAR-2025",
        createdAt: new Date(2025, 3, 1).getTime(),
        updatedAt: new Date(2025, 3, 10).getTime(),
      })
    );

    const rapportage = await rapportageHandler(ctx, {
      preset: "voorjaar",
      referentie: NU,
    });

    expect(rapportage.periode.label).toBe("Voorjaar 2026");
    expect(rapportage.hoeLoopt.huidig.getekendeOmzetInclBtw).toBe(12100);
    expect(rapportage.hoeLoopt.zelfdePeriodeVorigJaar?.getekendeOmzetInclBtw).toBe(
      12100
    );
    expect(rapportage.hoeLoopt.verschil.getekendeOmzetVsVorigJaar).toBe(0);
  });

  it("geeft een maandreeks met lege maanden expliciet op nul", async () => {
    db.insert(
      "offertes",
      maakOfferte({
        offerteNummer: "TT-MEI",
        createdAt: new Date(2026, 4, 1).getTime(),
        updatedAt: new Date(2026, 4, 10).getTime(),
      })
    );

    const rapportage = await rapportageHandler(ctx, {
      preset: "dit-jaar",
      referentie: NU,
    });

    const reeks = rapportage.hoeLoopt.maandReeks;
    // Januari t/m augustus 2026 — geen maanden overgeslagen, geen toekomst.
    expect(reeks.map((p) => p.maandKey)).toEqual([
      "2026-01", "2026-02", "2026-03", "2026-04",
      "2026-05", "2026-06", "2026-07", "2026-08",
    ]);
    expect(reeks.find((p) => p.maandKey === "2026-05")?.getekendeOmzetExclBtw).toBe(
      10000
    );
    expect(reeks.find((p) => p.maandKey === "2026-03")?.getekendeOmzetExclBtw).toBe(0);
  });

  it("weigert een klantaccount de bedrijfscijfers", async () => {
    const klantCtx: FakeCtx = {
      db,
      auth: {
        getUserIdentity: async () => ({
          subject: "clerk_klant",
          org_id: "clerk_org_toptuinen",
        }),
      },
    };
    db.insert("users", {
      clerkId: "clerk_klant",
      email: "klant@example.nl",
      name: "Klant",
      role: "klant",
      createdAt: NU,
    });

    await expect(
      rapportageHandler(klantCtx, { preset: "alles", referentie: NU })
    ).rejects.toThrow(/Alleen kantoor/);
  });

  it("meldt eerlijk dat er niets te tonen is bij een lege set", async () => {
    const rapportage = await rapportageHandler(ctx, {
      preset: "alles",
      referentie: NU,
    });
    expect(rapportage.meta.heeftData).toBe(false);
    expect(rapportage.hoeLoopt.huidig.getekendeOmzetInclBtw).toBe(0);
    expect(rapportage.geldLigt.voorNacalculatie.aantalProjecten).toBe(0);
  });
});

// ─── De definitie zelf ───────────────────────────────────────────────────────

describe("berekenGetekendeOmzet", () => {
  const basis = {
    status: "geaccepteerd",
    createdAt: 1000,
    updatedAt: 2000,
    totalen: { totaalExBtw: 100, totaalInclBtw: 121, marge: 20 },
  };

  it("geeft ex én incl. btw terug als aparte, benoemde velden", () => {
    const cijfers = berekenGetekendeOmzet([basis]);
    expect(cijfers.getekendeOmzetExclBtw).toBe(100);
    expect(cijfers.getekendeOmzetInclBtw).toBe(121);
    expect(cijfers.getekendeMarge).toBe(20);
    expect(cijfers.getekendeMargePercentage).toBe(20);
  });

  it("peilt op het tekenmoment, niet op de aanmaakdatum", () => {
    const offerte = {
      ...basis,
      createdAt: 1000,
      updatedAt: 5000,
      customerResponse: { respondedAt: 9000 },
    };
    expect(peildatumGetekend(offerte)).toBe(9000);

    // Venster rond de aanmaakdatum: geen omzet.
    expect(
      berekenGetekendeOmzet([offerte], { start: 0, eind: 2000 }).aantalGetekend
    ).toBe(0);
    // Venster rond het tekenmoment: wél omzet.
    expect(
      berekenGetekendeOmzet([offerte], { start: 8000, eind: 10000 }).aantalGetekend
    ).toBe(1);
  });

  it("valt terug op updatedAt als de klant niet zelf getekend heeft", () => {
    expect(peildatumGetekend(basis)).toBe(2000);
  });

  it("telt alleen status geaccepteerd", () => {
    const cijfers = berekenGetekendeOmzet([
      basis,
      { ...basis, status: "verzonden" },
      { ...basis, status: "afgewezen" },
    ]);
    expect(cijfers.aantalGetekend).toBe(1);
  });

  it("geeft nullen bij een lege set zonder te delen door nul", () => {
    const cijfers = berekenGetekendeOmzet([]);
    expect(cijfers.getekendeMargePercentage).toBe(0);
    expect(cijfers.gemiddeldeOpdrachtwaarde).toBe(0);
  });
});

describe("berekenFacturatie", () => {
  const basisFactuur = {
    status: "verzonden" as const,
    documentStatus: "verzonden" as const,
    betaalStatus: "open" as const,
    subtotaal: 100,
    totaalInclBtw: 121,
    factuurdatum: 5000,
    vervaldatum: 9000,
    createdAt: 4000,
  };

  it("telt concept- en definitief-facturen niet als gefactureerd", () => {
    expect(isGefactureerd(basisFactuur)).toBe(true);
    expect(
      isGefactureerd({ ...basisFactuur, documentStatus: "concept" })
    ).toBe(false);
    expect(
      isGefactureerd({ ...basisFactuur, documentStatus: "definitief" })
    ).toBe(false);
  });

  it("leest legacy-rijen zonder documentStatus via de statusmapping", () => {
    const legacy = {
      status: "betaald" as const,
      subtotaal: 100,
      totaalInclBtw: 121,
      factuurdatum: 5000,
      vervaldatum: 9000,
      createdAt: 4000,
    };
    const cijfers = berekenFacturatie([legacy], null, 10000);
    expect(cijfers.gefactureerdInclBtw).toBe(121);
    expect(cijfers.ontvangen).toBe(121);
    expect(cijfers.openstaand).toBe(0);
  });

  it("rekent een factuur pas als vervallen zodra de vervaldatum voorbij is", () => {
    const voorVervaldatum = berekenFacturatie([basisFactuur], null, 8000);
    const naVervaldatum = berekenFacturatie([basisFactuur], null, 10000);
    expect(voorVervaldatum.aantalVervallen).toBe(0);
    expect(naVervaldatum.aantalVervallen).toBe(1);
    expect(naVervaldatum.vervallenBedrag).toBe(121);
  });

  it("trekt deelbetalingen van het openstaande bedrag af", () => {
    const cijfers = berekenFacturatie(
      [{ ...basisFactuur, betaalStatus: "gedeeltelijk_betaald", betaaldBedrag: 21 }],
      null,
      6000
    );
    expect(cijfers.ontvangen).toBe(21);
    expect(cijfers.openstaand).toBe(100);
  });

  it("peilt op factuurdatum, niet op aanmaakdatum", () => {
    const binnen = berekenFacturatie([basisFactuur], { start: 4500, eind: 6000 }, 6000);
    const buiten = berekenFacturatie([basisFactuur], { start: 3500, eind: 4500 }, 6000);
    expect(binnen.aantalFacturen).toBe(1);
    expect(buiten.aantalFacturen).toBe(0);
  });
});
