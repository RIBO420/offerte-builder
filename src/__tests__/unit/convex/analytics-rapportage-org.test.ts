// @vitest-environment node
/**
 * Org-isolatie voor het analytics/rapportage-slot van de
 * Clerk-Organizations-migratie: `convex/dashboard.ts`,
 * `convex/smartAnalytics.ts`, `convex/proactiveWarnings.ts`,
 * `convex/leerfeedback.ts`, `convex/machineGebruik.ts` en
 * `convex/projectRapportages.ts`.
 *
 * Dit zijn dashboards en rapportages: puur leeswerk over veel tabellen, en dus
 * de klassieke plek waar een gemiste scope maandenlang onzichtbaar blijft —
 * het scherm toont gewoon een getal, alleen een te hoog getal.
 *
 * Wat hier bewaakt wordt:
 *   1. het dashboard telt alléén offertes, projecten, facturen, voertuigen,
 *      machines, voorraad en QC-checks van de eigen organisatie;
 *   2. `urenDezeMaand` loopt over `by_org_datum` en niet meer over de
 *      bedrijfsoverstijgende `by_datum` — de uren van een ander bedrijf mogen
 *      niet in de maandteller belanden;
 *   3. de prijshistorie van smartAnalytics is bedrijfsdata, geen persoonlijke;
 *   4. proactiveWarnings leest `weekPlanning` noodgedwongen via de
 *      bedrijfsoverstijgende `by_datum`-index en postfiltert op de eigen
 *      projecten (CLAUDE.md regel 4);
 *   5. leerfeedback doet hetzelfde op de `by_scope`-index;
 *   6. `machineGebruik` is een kindtabel zonder eigen orgId en hangt via
 *      `projectId` aan de organisatie;
 *   7. `projectRapportages.getProjectTimeline` weigert een vreemd projectId.
 *
 * Net als in uren-controlekamer.test.ts een eigen nep-db in plaats van de
 * gedeelde mock: die negeert `withIndex`, en juist de scoping ván die index is
 * hier het testobject. Deze builder gaat één stap verder en controleert ook
 * of de gebruikte velden bij de genoemde index hóren — een `by_org`-index
 * bevraagd op `userId` is een schrijffout die anders stilzwijgend zou slagen.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { ConvexError } from "convex/values";
import { getAdminDashboardData } from "../../../../convex/dashboard";
import {
  getScopePriceStats,
  getKlantenWithStats,
} from "../../../../convex/smartAnalytics";
import { getWarnings } from "../../../../convex/proactiveWarnings";
import { getHistorie } from "../../../../convex/leerfeedback";
import { list as machineGebruikList } from "../../../../convex/machineGebruik";
import { getProjectTimeline } from "../../../../convex/projectRapportages";

// ─── Index-register ──────────────────────────────────────────────────────────
//
// Alleen de indexen die deze tests raken. De builder eist dat de bevraagde
// velden een prefix van de indexvelden zijn — precies wat Convex zelf ook eist.

const INDEXEN: Record<string, Record<string, string[]>> = {
  offertes: { by_org: ["orgId"], by_user: ["userId"] },
  klanten: { by_org: ["orgId"], by_user: ["userId"] },
  projecten: { by_org: ["orgId"], by_user: ["userId"] },
  facturen: {
    by_org: ["orgId"],
    by_user: ["userId"],
    by_project: ["projectId"],
  },
  voertuigen: { by_org: ["orgId"], by_user: ["userId"] },
  machines: { by_org: ["orgId"], by_user: ["userId"] },
  voorraad: { by_org: ["orgId"], by_user: ["userId"] },
  kwaliteitsControles: { by_org: ["orgId"], by_user: ["userId"] },
  medewerkers: { by_org: ["orgId"], by_user: ["userId"] },
  urenRegistraties: {
    by_datum: ["datum"],
    by_org_datum: ["orgId", "datum"],
    by_user_datum: ["userId", "datum"],
    by_project: ["projectId"],
  },
  weekPlanning: { by_datum: ["datum"], by_project: ["projectId"] },
  voorcalculaties: { by_project: ["projectId"], by_offerte: ["offerteId"] },
  machineGebruik: { by_project: ["projectId"] },
  leerfeedback_historie: {
    by_org: ["orgId"],
    by_user: ["userId"],
    by_scope: ["scope"],
  },
  organisaties: { by_clerk_org_id: ["clerkOrgId"] },
  users: { by_clerk_id: ["clerkId"] },
};

// ─── Nep-Convex-database die indexen respecteert ─────────────────────────────

interface FakeDoc {
  _id: string;
  _creationTime: number;
  [key: string]: unknown;
}

interface IndexQ {
  eq: (field: string, value: unknown) => IndexQ;
  gte: (field: string, value: unknown) => IndexQ;
  lte: (field: string, value: unknown) => IndexQ;
}

function createQueryBuilder(table: string, docs: FakeDoc[]) {
  let current = [...docs];

  const builder = {
    withIndex(indexNaam: string, fn: (q: IndexQ) => IndexQ) {
      const velden = INDEXEN[table]?.[indexNaam];
      if (!velden) {
        throw new Error(`Onbekende index ${table}.${indexNaam}`);
      }

      const gebruikt: string[] = [];
      const predicates: Array<(doc: FakeDoc) => boolean> = [];
      const q: IndexQ = {
        eq: (field, value) => {
          gebruikt.push(field);
          predicates.push((doc) => doc[field] === value);
          return q;
        },
        gte: (field, value) => {
          gebruikt.push(field);
          predicates.push((doc) => (doc[field] as string) >= (value as string));
          return q;
        },
        lte: (field, value) => {
          gebruikt.push(field);
          predicates.push((doc) => (doc[field] as string) <= (value as string));
          return q;
        },
      };
      fn(q);

      // Convex staat alleen een prefix van de indexvelden toe.
      gebruikt.forEach((veld, i) => {
        if (velden[i] !== veld) {
          throw new Error(
            `Index ${table}.${indexNaam} heeft veld ${i} = ${velden[i]}, niet ${veld}`
          );
        }
      });

      current = current.filter((doc) => predicates.every((p) => p(doc)));
      return builder;
    },
    filter(fn: (q: FilterQ) => (doc: FakeDoc) => boolean) {
      const predicate = fn(filterQ);
      current = current.filter((doc) => predicate(doc));
      return builder;
    },
    order(richting: "asc" | "desc") {
      current.sort((a, b) =>
        richting === "desc"
          ? b._creationTime - a._creationTime
          : a._creationTime - b._creationTime
      );
      return builder;
    },
    async collect(): Promise<FakeDoc[]> {
      return [...current];
    },
    async first(): Promise<FakeDoc | null> {
      return current[0] ?? null;
    },
    async take(n: number): Promise<FakeDoc[]> {
      return current.slice(0, n);
    },
    async unique(): Promise<FakeDoc | null> {
      if (current.length > 1) {
        throw new Error("unique() vond meerdere documenten");
      }
      return current[0] ?? null;
    },
  };

  return builder;
}

/** Minimale `.filter(q => …)`-taal: genoeg voor eq/and/field. */
interface FilterQ {
  field: (naam: string) => (doc: FakeDoc) => unknown;
  eq: (
    links: (doc: FakeDoc) => unknown,
    rechts: unknown
  ) => (doc: FakeDoc) => boolean;
  and: (
    ...delen: Array<(doc: FakeDoc) => boolean>
  ) => (doc: FakeDoc) => boolean;
}

const filterQ: FilterQ = {
  field: (naam) => (doc) => doc[naam],
  eq: (links, rechts) => (doc) => links(doc) === rechts,
  and:
    (...delen) =>
    (doc) =>
      delen.every((d) => d(doc)),
};

class FakeDb {
  private tables = new Map<string, FakeDoc[]>();
  private counter = 0;

  insertSync(table: string, data: Record<string, unknown>): string {
    this.counter += 1;
    const id = `${table}:${this.counter}`;
    const doc: FakeDoc = { ...data, _id: id, _creationTime: this.counter };
    const rows = this.tables.get(table) ?? [];
    rows.push(doc);
    this.tables.set(table, rows);
    return id;
  }

  rows(table: string): FakeDoc[] {
    return [...(this.tables.get(table) ?? [])];
  }

  private byId(id: string): FakeDoc | null {
    for (const rows of this.tables.values()) {
      const found = rows.find((d) => d._id === id);
      if (found) return found;
    }
    return null;
  }

  query(table: string) {
    return createQueryBuilder(table, this.rows(table));
  }

  async get(id: string): Promise<FakeDoc | null> {
    return this.byId(id);
  }

  async insert(table: string, data: Record<string, unknown>): Promise<string> {
    return this.insertSync(table, data);
  }

  async patch(id: string, updates: Record<string, unknown>): Promise<void> {
    const doc = this.byId(id);
    if (!doc) throw new Error(`Document ${id} bestaat niet`);
    Object.assign(doc, updates);
  }
}

interface FakeIdentity {
  subject: string;
  org_id?: string;
}

interface FakeCtx {
  db: FakeDb;
  auth: { getUserIdentity: () => Promise<FakeIdentity | null> };
}

type Handler<TArgs, TResult> = (ctx: FakeCtx, args: TArgs) => Promise<TResult>;

function handlerVan<TArgs, TResult>(fn: unknown): Handler<TArgs, TResult> {
  return (fn as { _handler: Handler<TArgs, TResult> })._handler;
}

// ─── Fixture: twee bedrijven met exact dezelfde vorm ─────────────────────────

const NU = Date.parse("2026-08-18T10:00:00Z");
const DEZE_MAAND = "2026-08-05";
const VANDAAG = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
})();

let db: FakeDb;
let identity: FakeIdentity | null;
let ctx: FakeCtx;

let orgA: string;
let orgB: string;
/** De bedrijfseigenaar-user van A — draagt bewust óók de rijen van B. */
let eigenaarA: string;
let projectA: string;
let projectB: string;
let machineA: string;
let medewerkerA: string;
let medewerkerB: string;

function offerte(orgId: string, status: string, bedrag: number) {
  return db.insertSync("offertes", {
    orgId,
    userId: eigenaarA,
    offerteNummer: `OF-${bedrag}`,
    status,
    type: "aanleg",
    scopes: ["bestrating"],
    regels: [],
    klant: { naam: "Klant" },
    totalen: {
      subtotaal: bedrag,
      totaalExBtw: bedrag,
      totaalInclBtw: bedrag * 1.21,
      totaalUren: 10,
      marge: bedrag * 0.2,
    },
    createdAt: NU,
    updatedAt: NU,
  });
}

function factuur(orgId: string, bedrag: number) {
  return db.insertSync("facturen", {
    orgId,
    userId: eigenaarA,
    factuurnummer: `F-${bedrag}`,
    status: "verzonden",
    subtotaal: bedrag,
    totaalInclBtw: bedrag,
    factuurdatum: NU,
    vervaldatum: NU + 30 * 86_400_000,
    createdAt: NU,
  });
}

beforeEach(() => {
  db = new FakeDb();
  identity = null;
  ctx = { db, auth: { getUserIdentity: async () => identity } };

  orgA = db.insertSync("organisaties", {
    clerkOrgId: "clerk_org_a",
    naam: "Bedrijf A",
    actief: true,
  });
  orgB = db.insertSync("organisaties", {
    clerkOrgId: "clerk_org_b",
    naam: "Bedrijf B",
    actief: true,
  });

  eigenaarA = db.insertSync("users", {
    clerkId: "clerk_directie_a",
    email: "directie@bedrijf-a.nl",
    name: "Directie A",
    role: "directie",
  });
  db.insertSync("users", {
    clerkId: "clerk_directie_b",
    email: "directie@bedrijf-b.nl",
    name: "Directie B",
    role: "directie",
  });

  // Eén geaccepteerde offerte per bedrijf, met hetzelfde bedrag: als de scope
  // lekt is de omzet exact het dubbele — geen subtiel verschil.
  offerte(orgA, "geaccepteerd", 1000);
  offerte(orgB, "geaccepteerd", 1000);

  projectA = db.insertSync("projecten", {
    orgId: orgA,
    userId: eigenaarA,
    naam: "Tuin A",
    status: "in_uitvoering",
    createdAt: NU,
    updatedAt: NU,
  });
  projectB = db.insertSync("projecten", {
    orgId: orgB,
    userId: eigenaarA,
    naam: "Tuin B",
    status: "in_uitvoering",
    createdAt: NU,
    updatedAt: NU,
  });

  factuur(orgA, 500);
  factuur(orgB, 500);

  db.insertSync("urenRegistraties", {
    orgId: orgA,
    userId: eigenaarA,
    projectId: projectA,
    medewerker: "Jan",
    datum: DEZE_MAAND,
    uren: 8,
  });
  db.insertSync("urenRegistraties", {
    orgId: orgB,
    userId: eigenaarA,
    projectId: projectB,
    medewerker: "Piet",
    datum: DEZE_MAAND,
    uren: 8,
  });

  for (const org of [orgA, orgB]) {
    db.insertSync("voertuigen", {
      orgId: org,
      userId: eigenaarA,
      kenteken: "AA-11-BB",
      merk: "VW",
      model: "Crafter",
      status: "onderhoud",
    });
    db.insertSync("machines", {
      orgId: org,
      userId: eigenaarA,
      naam: "Trilplaat",
      type: "grondwerk",
      tariefType: "uur",
      tarief: 25,
      isActief: false,
    });
    db.insertSync("voorraad", {
      orgId: org,
      userId: eigenaarA,
      hoeveelheid: 1,
      minVoorraad: 5,
    });
    db.insertSync("kwaliteitsControles", {
      orgId: org,
      userId: eigenaarA,
      status: "open",
    });
  }

  medewerkerA = db.insertSync("medewerkers", {
    orgId: orgA,
    userId: eigenaarA,
    naam: "Jan de Vries",
    isActief: true,
  });
  medewerkerB = db.insertSync("medewerkers", {
    orgId: orgB,
    userId: eigenaarA,
    naam: "Piet Jansen",
    isActief: true,
  });

  machineA = db.rows("machines").find((m) => m.orgId === orgA)!._id;
});

function logInAls(clerkId: string, clerkOrgId: string) {
  identity = { subject: clerkId, org_id: clerkOrgId };
}

const alsA = () => logInAls("clerk_directie_a", "clerk_org_a");

const dashboard = handlerVan<
  Record<string, never>,
  {
    offerteStats: { totaal: number; geaccepteerdWaarde: number };
    facturenStats: { totaal: number };
    urenDezeMaand: number;
    projectStats: { totaal: number };
    vlootSummary: { issueCount: number };
  }
>(getAdminDashboardData);

// ─── 1. Dashboard ────────────────────────────────────────────────────────────

describe("dashboard.getAdminDashboardData", () => {
  it("telt alleen de offertes, projecten en facturen van de eigen organisatie", async () => {
    alsA();
    const data = await dashboard(ctx, {});

    expect(data.offerteStats.totaal).toBe(1);
    expect(data.offerteStats.geaccepteerdWaarde).toBe(1210);
    expect(data.projectStats.totaal).toBe(1);
    expect(data.facturenStats.totaal).toBe(1);
  });

  it("telt de uren van deze maand op by_org_datum, niet op de bedrijfsoverstijgende by_datum", async () => {
    alsA();
    const data = await dashboard(ctx, {});

    // Beide bedrijven boekten 8 uur in dezelfde maand. Op `by_datum` zou hier
    // 16 staan; dat was de fout die deze test afvangt.
    expect(data.urenDezeMaand).toBe(8);
  });

  it("telt materieel-, voorraad- en QC-signalen alleen voor de eigen organisatie", async () => {
    alsA();
    const data = await dashboard(ctx, {});

    // 1 voertuig in onderhoud + 1 inactieve machine + 1 voorraadalert + 1 open QC.
    expect(data.vlootSummary.issueCount).toBe(4);
  });

  it("weigert een gebruiker zonder actieve organisatie", async () => {
    identity = { subject: "clerk_directie_a" };
    await expect(dashboard(ctx, {})).rejects.toThrow(ConvexError);
  });
});

// ─── 2. smartAnalytics ───────────────────────────────────────────────────────

describe("smartAnalytics", () => {
  const scopeStats = handlerVan<
    Record<string, never>,
    { hasData: boolean; totalOffertes?: number }
  >(getScopePriceStats);
  const klantenStats = handlerVan<
    { limit?: number },
    Array<{ offerteCount: number }>
  >(getKlantenWithStats);

  it("baseert de prijshistorie op de offertes van de organisatie", async () => {
    // Bedrijf A heeft er twee, bedrijf B één — als de scope lekt worden het er drie.
    offerte(orgA, "voorcalculatie", 2000);
    alsA();

    const stats = await scopeStats(ctx, {});
    expect(stats.hasData).toBe(true);
    expect(stats.totalOffertes).toBe(2);
  });

  it("verrijkt alleen klanten van de eigen organisatie", async () => {
    const klantA = db.insertSync("klanten", {
      orgId: orgA,
      userId: eigenaarA,
      naam: "Klant A",
    });
    db.insertSync("klanten", { orgId: orgB, userId: eigenaarA, naam: "Klant B" });

    // Een offerte van B op de klant van A: de teller mag hem niet meenemen.
    db.rows("offertes")
      .filter((o) => o.orgId === orgB)
      .forEach((o) => {
        o.klantId = klantA;
      });

    alsA();
    const klanten = await klantenStats(ctx, {});
    expect(klanten).toHaveLength(1);
    expect(klanten[0].offerteCount).toBe(0);
  });
});

// ─── 3. proactiveWarnings (postfilter op bedrijfsoverstijgende index) ────────

describe("proactiveWarnings.getWarnings", () => {
  const warnings = handlerVan<
    Record<string, never>,
    Array<{ id: string; titel: string }>
  >(getWarnings);

  it("negeert een dubbele planning op het project van een ander bedrijf", async () => {
    // Zelfde dag, twee projecten — maar allebei van bedrijf B.
    for (const project of [projectB, projectB]) {
      db.insertSync("weekPlanning", {
        projectId: project,
        medewerkerId: medewerkerB,
        datum: VANDAAG,
      });
    }

    alsA();
    const lijst = await warnings(ctx, {});
    expect(lijst.some((w) => w.id.startsWith("double-"))).toBe(false);
    expect(lijst.some((w) => w.titel.includes("Piet Jansen"))).toBe(false);
  });

  it("signaleert de dubbele planning wel op een eigen project", async () => {
    const tweedeProjectA = db.insertSync("projecten", {
      orgId: orgA,
      userId: eigenaarA,
      naam: "Tuin A2",
      status: "in_uitvoering",
      createdAt: NU,
      updatedAt: NU,
    });
    for (const project of [projectA, tweedeProjectA]) {
      db.insertSync("weekPlanning", {
        projectId: project,
        medewerkerId: medewerkerA,
        datum: VANDAAG,
      });
    }

    alsA();
    const lijst = await warnings(ctx, {});
    expect(lijst.some((w) => w.titel.includes("Jan de Vries"))).toBe(true);
  });
});

// ─── 4. leerfeedback (postfilter op by_scope) ────────────────────────────────

describe("leerfeedback.getHistorie", () => {
  const historie = handlerVan<
    { scope?: string; limit?: number },
    Array<{ scope: string }>
  >(getHistorie);

  beforeEach(() => {
    for (const org of [orgA, orgB]) {
      db.insertSync("leerfeedback_historie", {
        orgId: org,
        userId: eigenaarA,
        normuurId: "normuren:1",
        scope: "bestrating",
        activiteit: "straatwerk",
        oudeWaarde: 1,
        nieuweWaarde: 1.2,
        wijzigingPercentage: 20,
        reden: "test",
        bronProjecten: [],
        toegepastDoor: "Directie",
        createdAt: NU,
      });
    }
  });

  it("levert op de bedrijfsoverstijgende by_scope-index alleen eigen rijen", async () => {
    alsA();
    const rijen = await historie(ctx, { scope: "bestrating" });
    expect(rijen).toHaveLength(1);
  });

  it("levert zonder scope-filter alleen eigen rijen (by_org)", async () => {
    alsA();
    const rijen = await historie(ctx, {});
    expect(rijen).toHaveLength(1);
  });
});

// ─── 5. machineGebruik (kindtabel via project.orgId) ─────────────────────────

describe("machineGebruik.list", () => {
  const lijst = handlerVan<{ projectId: string }, unknown[]>(machineGebruikList);

  beforeEach(() => {
    db.insertSync("machineGebruik", {
      projectId: projectB,
      machineId: machineA,
      datum: DEZE_MAAND,
      uren: 4,
      kosten: 100,
    });
  });

  it("weigert het machinegebruik van een project van een andere organisatie", async () => {
    alsA();
    await expect(lijst(ctx, { projectId: projectB })).rejects.toThrow(
      ConvexError
    );
  });

  it("geeft het gebruik van een eigen project wel terug", async () => {
    db.insertSync("machineGebruik", {
      projectId: projectA,
      machineId: machineA,
      datum: DEZE_MAAND,
      uren: 2,
      kosten: 50,
    });

    alsA();
    expect(await lijst(ctx, { projectId: projectA })).toHaveLength(1);
  });
});

// ─── 6. projectRapportages.getProjectTimeline ────────────────────────────────

describe("projectRapportages.getProjectTimeline", () => {
  const timeline = handlerVan<
    { projectId?: string },
    { samenvatting: { totaalUren: number } }
  >(getProjectTimeline);

  it("weigert een projectId van een andere organisatie", async () => {
    alsA();
    await expect(timeline(ctx, { projectId: projectB })).rejects.toThrow(
      ConvexError
    );
  });

  it("telt zonder projectId alleen de uren van de eigen projecten", async () => {
    alsA();
    const data = await timeline(ctx, {});
    expect(data.samenvatting.totaalUren).toBe(8);
  });
});
