/**
 * Convex Mock Utilities for Unit Testing
 *
 * Provides mock factories for Convex context objects (ctx) used in
 * query and mutation handlers. These mocks simulate the Convex runtime
 * without requiring a real Convex backend.
 *
 * INDEX-BEWUST (taak 3.10a). `withIndex` past de `eq`/range-eisen van de
 * genoemde index daadwerkelijk toe en controleert tegen convex/schema.ts of
 * die velden een prefix van de index zijn. Vóór die wijziging gaf élke
 * `by_org`-query álle rijen terug: een gemiste tenant-scope kon niet omvallen
 * in een test. Dat is de reden dat diverse clusters een eigen mini-mock
 * bouwden; die blijven staan, dit harnas haalt ze alleen in.
 *
 * Twee dingen om te weten als je een test schrijft:
 *   - een rij ZONDER `orgId` valt buiten `q.eq("orgId", …)`, net als in
 *     Convex. Fixtures moeten dus een `orgId` dragen (zie seedMockOrganisatie);
 *   - `createMockCtx` geeft standaard een identity MET `org_id`-claim. Wil je
 *     een org-loze of identity-loze sessie (cron, klantsessie, publieke
 *     intake), gebruik dan `{ zonderOrg: true }` of `{ identity: null }`.
 */

import { vi, type Mock } from "vitest";
import schema from "../../../convex/schema";

// ─── Types ───────────────────────────────────────────────────────────────────

type MockId = string;

interface MockDocument {
  _id: MockId;
  _creationTime: number;
  [key: string]: unknown;
}

interface MockIndexQuery {
  eq: (field: string, value: unknown) => MockIndexQuery;
  gt: (field: string, value: unknown) => MockIndexQuery;
  gte: (field: string, value: unknown) => MockIndexQuery;
  lt: (field: string, value: unknown) => MockIndexQuery;
  lte: (field: string, value: unknown) => MockIndexQuery;
}

interface MockSearchQuery {
  search: (field: string, term: string) => MockSearchQuery;
  eq: (field: string, value: unknown) => MockSearchQuery;
}

interface MockQueryBuilder {
  withIndex: (indexName: string, fn?: (q: MockIndexQuery) => unknown) => MockQueryBuilder;
  withSearchIndex: (indexName: string, fn: (q: MockSearchQuery) => unknown) => MockQueryBuilder;
  filter: (fn: (q: MockFilterBuilder) => unknown) => MockQueryBuilder;
  order: (direction: "asc" | "desc") => MockQueryBuilder;
  collect: () => Promise<MockDocument[]>;
  first: () => Promise<MockDocument | null>;
  unique: () => Promise<MockDocument | null>;
  take: (n: number) => Promise<MockDocument[]>;
  paginate: (opts: { numItems: number; cursor: string | null }) => Promise<{
    page: MockDocument[];
    continueCursor: string;
    isDone: boolean;
  }>;
}

interface MockFilterBuilder {
  eq: (a: unknown, b: unknown) => boolean;
  neq: (a: unknown, b: unknown) => boolean;
  lt: (a: unknown, b: unknown) => boolean;
  lte: (a: unknown, b: unknown) => boolean;
  gt: (a: unknown, b: unknown) => boolean;
  gte: (a: unknown, b: unknown) => boolean;
  and: (...delen: unknown[]) => boolean;
  or: (...delen: unknown[]) => boolean;
  not: (deel: unknown) => boolean;
  field: (name: string) => string;
}

// ─── Index-register (uit het échte schema) ───────────────────────────────────
//
// De mock leidt de indexvelden rechtstreeks uit convex/schema.ts af. Daardoor
// kan hij twee dingen die de oude pass-through-mock niet kon:
//   1. de `q.eq(...)`-eisen van een index écht als filter toepassen — een
//      `by_org`-query geeft niet langer óók de rijen van een andere tenant;
//   2. controleren dat de bevraagde velden een PREFIX van de index zijn,
//      precies zoals Convex zelf eist. Een `by_org`-index bevraagd op
//      `userId` is een schrijffout die anders stilzwijgend zou slagen.
// Het register loopt automatisch mee met schemawijzigingen; er is geen
// handmatige lijst om bij te houden.

interface GeexporteerdeTabel {
  indexes?: Array<{ indexDescriptor: string; fields: string[] }>;
  searchIndexes?: Array<{
    indexDescriptor: string;
    searchField: string;
    filterFields?: string[];
  }>;
}

interface TabelIndexen {
  /** Gewone indexen: veldvolgorde telt (prefix-regel). */
  indexen: Record<string, string[]>;
  /** Zoekindexen: alleen de filterFields, volgorde doet er niet toe. */
  zoekIndexen: Record<string, string[]>;
}

function bouwIndexRegister(): Record<string, TabelIndexen> {
  const register: Record<string, TabelIndexen> = {};
  const tabellen = (
    schema as unknown as {
      tables: Record<string, { export?: () => GeexporteerdeTabel }>;
    }
  ).tables;
  for (const [tabel, definitie] of Object.entries(tabellen ?? {})) {
    if (typeof definitie?.export !== "function") continue;
    const geexporteerd = definitie.export();
    const indexen: Record<string, string[]> = {};
    const zoekIndexen: Record<string, string[]> = {};
    for (const index of geexporteerd.indexes ?? []) {
      indexen[index.indexDescriptor] = index.fields;
    }
    for (const index of geexporteerd.searchIndexes ?? []) {
      zoekIndexen[index.indexDescriptor] = index.filterFields ?? [];
    }
    register[tabel] = { indexen, zoekIndexen };
  }
  return register;
}

const INDEX_REGISTER = bouwIndexRegister();

// ─── In-Memory Store ─────────────────────────────────────────────────────────

export class MockConvexStore {
  private tables: Map<string, MockDocument[]> = new Map();
  private idCounter = 0;

  generateId(tableName: string): MockId {
    this.idCounter++;
    return `${tableName}:${this.idCounter}`;
  }

  insert(tableName: string, data: Record<string, unknown>): MockId {
    const id = this.generateId(tableName);
    // Spread data first, then override _id to ensure store controls the ID.
    // `_creationTime` mag een fixture wél zelf zetten: de org-migratie
    // onderscheidt geseede rijen van eigen data op aanmaakmoment, en zonder
    // stuurbare tijd valt dat binnen één milliseconde niet te testen.
    const doc = {
      ...data,
      _id: id,
      _creationTime:
        typeof data._creationTime === "number" ? data._creationTime : Date.now(),
    };
    const table = this.tables.get(tableName) || [];
    table.push(doc);
    this.tables.set(tableName, table);
    return id;
  }

  get(id: MockId): MockDocument | null {
    for (const [, docs] of this.tables) {
      const found = docs.find((d) => d._id === id);
      if (found) return { ...found };
    }
    return null;
  }

  patch(id: MockId, updates: Record<string, unknown>): void {
    for (const [, docs] of this.tables) {
      const idx = docs.findIndex((d) => d._id === id);
      if (idx !== -1) {
        // Handle undefined values as field deletions
        const doc = docs[idx];
        for (const [key, value] of Object.entries(updates)) {
          if (value === undefined) {
            delete doc[key];
          } else {
            doc[key] = value;
          }
        }
        return;
      }
    }
  }

  delete(id: MockId): void {
    for (const [tableName, docs] of this.tables) {
      const idx = docs.findIndex((d) => d._id === id);
      if (idx !== -1) {
        docs.splice(idx, 1);
        this.tables.set(tableName, docs);
        return;
      }
    }
  }

  getAll(tableName: string): MockDocument[] {
    return [...(this.tables.get(tableName) || [])];
  }

  clear(): void {
    this.tables.clear();
    this.idCounter = 0;
  }
}

// ─── Mock Query Builder ──────────────────────────────────────────────────────

/** `a < b` op een manier die zowel getallen als strings aankan. */
function kleinerDan(a: unknown, b: unknown): boolean {
  return (a as number) < (b as number);
}

function createMockQueryBuilder(
  tableName: string,
  docs: MockDocument[]
): MockQueryBuilder {
  let filteredDocs = [...docs];
  const tabel = INDEX_REGISTER[tableName];

  const builder: MockQueryBuilder = {
    withIndex: (indexName, fn) => {
      const indexVelden = tabel?.indexen[indexName];
      if (tabel && !indexVelden) {
        throw new Error(
          `Onbekende index "${indexName}" op tabel "${tableName}" — controleer convex/schema.ts`
        );
      }

      // Volgorde van de gebruikte velden bepaalt of dit een geldige
      // index-range is: eerst nul of meer eq's (prefix), daarna hooguit een
      // range op het eerstvolgende veld.
      const eqVelden: string[] = [];
      const rangeVelden: string[] = [];
      const predicaten: Array<(doc: MockDocument) => boolean> = [];

      const range = (
        veld: string,
        waarde: unknown,
        test: (docWaarde: unknown) => boolean
      ) => {
        rangeVelden.push(veld);
        predicaten.push((doc) => test(doc[veld]));
        void waarde;
      };

      const q: MockIndexQuery = {
        eq: (veld, waarde) => {
          eqVelden.push(veld);
          predicaten.push((doc) => doc[veld] === waarde);
          return q;
        },
        gt: (veld, waarde) => {
          range(veld, waarde, (dv) => kleinerDan(waarde, dv));
          return q;
        },
        gte: (veld, waarde) => {
          range(veld, waarde, (dv) => !kleinerDan(dv, waarde));
          return q;
        },
        lt: (veld, waarde) => {
          range(veld, waarde, (dv) => kleinerDan(dv, waarde));
          return q;
        },
        lte: (veld, waarde) => {
          range(veld, waarde, (dv) => !kleinerDan(waarde, dv));
          return q;
        },
      };
      fn?.(q);

      if (indexVelden) {
        eqVelden.forEach((veld, i) => {
          if (indexVelden[i] !== veld) {
            throw new Error(
              `Index ${tableName}.${indexName} heeft veld ${i} = ${indexVelden[i] ?? "(geen)"}, niet ${veld}`
            );
          }
        });
        const rangeVeld = indexVelden[eqVelden.length];
        for (const veld of rangeVelden) {
          if (veld !== rangeVeld) {
            throw new Error(
              `Index ${tableName}.${indexName}: range op ${veld} mag alleen op veld ${eqVelden.length} (${rangeVeld ?? "(geen)"})`
            );
          }
        }
      }

      // Zoals een echte index-range: een document zónder het veld heeft
      // undefined en valt dus buiten `eq(<concrete waarde>)`. Precies die
      // fail-closed keuze bewaakt de org-grens tijdens de backfill.
      filteredDocs = filteredDocs.filter((doc) =>
        predicaten.every((p) => p(doc))
      );
      return builder;
    },
    withSearchIndex: (indexName, fn) => {
      const filterVelden = tabel?.zoekIndexen[indexName];
      if (tabel && !filterVelden) {
        throw new Error(
          `Onbekende zoekindex "${indexName}" op tabel "${tableName}" — controleer convex/schema.ts`
        );
      }
      // De full-text-kant (`search`) wordt niet nagebootst — daar zit geen
      // tenant-grens in. De `eq`-filterfields wél: dáár hangt `orgId` aan.
      const predicaten: Array<(doc: MockDocument) => boolean> = [];
      const q: MockSearchQuery = {
        search: () => q,
        eq: (veld, waarde) => {
          if (filterVelden && !filterVelden.includes(veld)) {
            throw new Error(
              `Zoekindex ${tableName}.${indexName} heeft geen filterField ${veld}`
            );
          }
          predicaten.push((doc) => doc[veld] === waarde);
          return q;
        },
      };
      fn(q);
      filteredDocs = filteredDocs.filter((doc) =>
        predicaten.every((p) => p(doc))
      );
      return builder;
    },
    filter: (fn) => {
      // Apply filter in-memory by checking each doc
      filteredDocs = filteredDocs.filter((doc) => {
        try {
          const fieldProxy: MockFilterBuilder = {
            eq: (a: unknown, b: unknown) => a === b,
            neq: (a: unknown, b: unknown) => a !== b,
            lt: kleinerDan,
            lte: (a: unknown, b: unknown) => !kleinerDan(b, a),
            gt: (a: unknown, b: unknown) => kleinerDan(b, a),
            gte: (a: unknown, b: unknown) => !kleinerDan(a, b),
            and: (...delen: unknown[]) => delen.every(Boolean),
            or: (...delen: unknown[]) => delen.some(Boolean),
            not: (deel: unknown) => !deel,
            field: (name: string) => doc[name] as string,
          };
          return fn(fieldProxy);
        } catch {
          return true;
        }
      });
      return builder;
    },
    order: (direction) => {
      filteredDocs.sort((a, b) => {
        const aTime = (a._creationTime as number) || 0;
        const bTime = (b._creationTime as number) || 0;
        return direction === "desc" ? bTime - aTime : aTime - bTime;
      });
      return builder;
    },
    collect: async () => [...filteredDocs],
    first: async () => filteredDocs[0] || null,
    unique: async () => {
      // Convex gooit bij meer dan één treffer; de mock deed dat niet en
      // verborg daarmee `.unique()` op een niet-unieke index (CLAUDE.md §4).
      if (filteredDocs.length > 1) {
        throw new Error(
          `unique() vond ${filteredDocs.length} documenten in "${tableName}"`
        );
      }
      return filteredDocs[0] || null;
    },
    take: async (n) => filteredDocs.slice(0, n),
    paginate: async (opts) => ({
      page: filteredDocs.slice(0, opts.numItems),
      continueCursor: "",
      isDone: filteredDocs.length <= opts.numItems,
    }),
  };

  return builder;
}

// ─── Mock Context Factories ──────────────────────────────────────────────────

export interface MockCtx {
  db: {
    get: Mock;
    insert: Mock;
    patch: Mock;
    delete: Mock;
    query: Mock;
  };
  auth: {
    getUserIdentity: Mock;
  };
  scheduler: {
    runAfter: Mock;
  };
}

export interface MockCtxOpties {
  /**
   * Laat het `org_id`-claim wég uit de identity, terwijl er wél een ingelogde
   * gebruiker is. Dit is de stand van een sessie die (nog) geen actieve Clerk-
   * organisatie heeft — en de enige manier om te testen dat een pad
   * fail-closed is in plaats van "toevallig goed omdat de mock altijd een
   * claim meegaf".
   */
  zonderOrg?: boolean;
  /**
   * Volledige identity-override. `null` = géén ingelogde gebruiker: de stand
   * van crons, webhooks en publieke intake. Wint van `zonderOrg`.
   */
  identity?: Record<string, unknown> | null;
}

/** De standaard-identity van createMockCtx: staf mét actieve organisatie. */
export function identityMetOrg(): Record<string, unknown> {
  return {
    subject: "clerk_test_user_123",
    // Sinds de org-migratie (fase 3) leest requireOrg dit claim; het
    // JWT-template "convex" vult het met {{org.id}}.
    org_id: TEST_CLERK_ORG_ID,
  };
}

/**
 * Identity van een ingelogde gebruiker ZONDER actieve organisatie.
 *
 * Gebruik dit (of `createMockCtx(store, { zonderOrg: true })`) om te bewijzen
 * dat een pad fail-closed is als het JWT-org-claim ontbreekt — bijvoorbeeld
 * bij het `bepaalOrgId`-patroon in convex/mailTriggers.ts, waar het document
 * zelf de orgId draagt maar de sessie hem niet meelevert.
 */
export function identityZonderOrg(): Record<string, unknown> {
  return { subject: "clerk_test_user_123" };
}

/**
 * Create a mock Convex query/mutation context backed by an in-memory store.
 */
export function createMockCtx(
  store: MockConvexStore,
  opties: MockCtxOpties = {}
): MockCtx {
  const identity =
    opties.identity !== undefined
      ? opties.identity
      : opties.zonderOrg
        ? identityZonderOrg()
        : identityMetOrg();

  return {
    db: {
      get: vi.fn((id: MockId) => Promise.resolve(store.get(id))),
      insert: vi.fn((tableName: string, data: Record<string, unknown>) =>
        Promise.resolve(store.insert(tableName, data))
      ),
      patch: vi.fn((id: MockId, updates: Record<string, unknown>) => {
        store.patch(id, updates);
        return Promise.resolve();
      }),
      delete: vi.fn((id: MockId) => {
        store.delete(id);
        return Promise.resolve();
      }),
      query: vi.fn((tableName: string) =>
        createMockQueryBuilder(tableName, store.getAll(tableName))
      ),
    },
    auth: {
      getUserIdentity: vi.fn(() => Promise.resolve(identity)),
    },
    scheduler: {
      runAfter: vi.fn(() => Promise.resolve()),
    },
  };
}

// ─── Mock Data Factories ─────────────────────────────────────────────────────

/** Het `org_id`-claim dat createMockCtx in de identity meegeeft. */
export const TEST_CLERK_ORG_ID = "clerk_test_org_123";

/** Clerk-id van de tweede organisatie: de buurman die niets mag zien. */
export const TEST_ANDERE_CLERK_ORG_ID = "clerk_test_org_999";

/**
 * Zet de organisatie van de ingelogde gebruiker in de store en geef haar id
 * terug.
 *
 * Sinds fase 3 van de org-migratie is `orgId` DE tenant-scope: elke test die
 * een org-gescopeerde query of mutation aanroept heeft deze rij nodig, anders
 * gooit `requireOrg` een AuthError ("Organisatie niet gevonden"). Geef het
 * resultaat mee als `orgId` op de fixtures die bij deze tenant horen.
 */
export function seedMockOrganisatie(
  store: MockConvexStore,
  overrides: Record<string, unknown> = {}
): string {
  return store.insert("organisaties", {
    clerkOrgId: TEST_CLERK_ORG_ID,
    naam: "Top Tuinen",
    slug: "top-tuinen",
    actief: true,
    aangemaaktOp: Date.now(),
    ...overrides,
  });
}

/**
 * Tweede organisatie in dezelfde store: de buurman.
 *
 * Bedoeld voor "org A ziet org B niet"-asserties. Hang fixtures met dit id
 * als `orgId` in de store en controleer dat ze niet in het resultaat van de
 * ingelogde organisatie opduiken. Sinds de mock `withIndex` écht toepast is
 * dat een echte assertie geworden en niet langer een formaliteit.
 */
export function seedAndereOrganisatie(
  store: MockConvexStore,
  overrides: Record<string, unknown> = {}
): string {
  return store.insert("organisaties", {
    clerkOrgId: TEST_ANDERE_CLERK_ORG_ID,
    naam: "Groen & Co",
    slug: "groen-en-co",
    actief: true,
    aangemaaktOp: Date.now(),
    ...overrides,
  });
}

export function createMockUser(overrides: Partial<MockDocument> = {}): MockDocument {
  return {
    _id: "users:1",
    _creationTime: Date.now(),
    clerkId: "clerk_test_user_123",
    email: "test@test.nl",
    name: "Test User",
    role: "directie",
    createdAt: Date.now(),
    ...overrides,
  };
}

export function createMockKlant(
  userId: string,
  overrides: Partial<MockDocument> = {}
): MockDocument {
  const now = Date.now();
  return {
    _id: `klanten:${Math.random().toString(36).slice(2, 8)}`,
    _creationTime: now,
    userId,
    naam: "Jan de Vries",
    adres: "Tulpstraat 12",
    postcode: "1234 AB",
    plaats: "Amsterdam",
    email: "jan@devries.nl",
    telefoon: "0612345678",
    pipelineStatus: "lead",
    klantType: "particulier",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function createMockOfferte(
  userId: string,
  klantId: string,
  overrides: Partial<MockDocument> = {}
): MockDocument {
  const now = Date.now();
  return {
    _id: `offertes:${Math.random().toString(36).slice(2, 8)}`,
    _creationTime: now,
    userId,
    klantId,
    type: "aanleg",
    status: "concept",
    offerteNummer: "OFF-2026-001",
    klant: {
      naam: "Jan de Vries",
      adres: "Tulpstraat 12",
      postcode: "1234 AB",
      plaats: "Amsterdam",
    },
    algemeenParams: {
      bereikbaarheid: "goed",
    },
    totalen: {
      materiaalkosten: 1000,
      arbeidskosten: 2000,
      totaalUren: 40,
      subtotaal: 3000,
      marge: 600,
      margePercentage: 20,
      totaalExBtw: 3600,
      btw: 756,
      totaalInclBtw: 4356,
    },
    regels: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function createMockProject(
  userId: string,
  offerteId: string,
  overrides: Partial<MockDocument> = {}
): MockDocument {
  const now = Date.now();
  return {
    _id: `projecten:${Math.random().toString(36).slice(2, 8)}`,
    _creationTime: now,
    userId,
    offerteId,
    naam: "Project OFF-2026-001 - Jan de Vries",
    status: "gepland",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function createMockRegel(overrides: Record<string, unknown> = {}) {
  return {
    id: `regel-${Math.random().toString(36).slice(2, 8)}`,
    scope: "grondwerk",
    omschrijving: "Ontgraven standaard",
    eenheid: "m2",
    hoeveelheid: 50,
    prijsPerEenheid: 25,
    totaal: 1250,
    type: "arbeid" as const,
    ...overrides,
  };
}

// ─── Business Logic Helpers (extracted from Convex handlers for testability) ──

/**
 * Valid status transitions for offertes.
 * Mirrors the validTransitions map in convex/offertes.ts updateStatus handler.
 */
export const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  concept: ["voorcalculatie"],
  voorcalculatie: ["concept", "verzonden"],
  verzonden: ["voorcalculatie", "geaccepteerd", "afgewezen"],
  geaccepteerd: ["verzonden"],
  afgewezen: ["verzonden"],
};

/** All valid offerte statuses */
export const ALL_STATUSES = [
  "concept",
  "voorcalculatie",
  "verzonden",
  "geaccepteerd",
  "afgewezen",
] as const;

/** Deprecated status kept for backwards compatibility */
export const DEPRECATED_STATUS = "definitief";

/**
 * Check if a status transition is valid according to the workflow.
 * Pure function extracted from updateStatus for unit testing.
 */
export function isValidStatusTransition(from: string, to: string): boolean {
  return VALID_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Calculate offerte totals from regels.
 * Pure function that mirrors the calculation logic in the updateRegels mutation handler.
 */
export function calculateOfferteRegelsTotal(
  regels: Array<{
    totaal: number;
    type: "materiaal" | "arbeid" | "machine";
    hoeveelheid: number;
    scope: string;
    margePercentage?: number;
  }>,
  margePercentage: number,
  btwPercentage: number,
  scopeMarges?: Record<string, number | undefined>
) {
  const getEffectiveMargePercentage = (regel: (typeof regels)[0]): number => {
    if (regel.margePercentage !== undefined && regel.margePercentage !== null) {
      return regel.margePercentage;
    }
    if (scopeMarges) {
      const scopeMarge = scopeMarges[regel.scope];
      if (scopeMarge !== undefined && scopeMarge !== null) {
        return scopeMarge;
      }
    }
    return margePercentage;
  };

  let materiaalkosten = 0;
  let arbeidskosten = 0;
  let totaalUren = 0;
  let totaleMarge = 0;

  for (const regel of regels) {
    const effectieveMarge = getEffectiveMargePercentage(regel);
    const regelMarge = regel.totaal * (effectieveMarge / 100);
    totaleMarge += regelMarge;

    if (regel.type === "materiaal") {
      materiaalkosten += regel.totaal;
    } else if (regel.type === "arbeid") {
      arbeidskosten += regel.totaal;
      totaalUren += regel.hoeveelheid;
    } else if (regel.type === "machine") {
      // Machine costs go to arbeidskosten (mirrors Convex handler)
      arbeidskosten += regel.totaal;
    }
  }

  const subtotaal = materiaalkosten + arbeidskosten;
  const marge = totaleMarge;
  const effectiefMargePercentage =
    subtotaal > 0 ? (marge / subtotaal) * 100 : margePercentage;
  const totaalExBtw = subtotaal + marge;
  const btw = totaalExBtw * (btwPercentage / 100);
  const totaalInclBtw = totaalExBtw + btw;

  return {
    materiaalkosten,
    arbeidskosten,
    totaalUren,
    subtotaal,
    marge,
    margePercentage: Math.round(effectiefMargePercentage * 100) / 100,
    totaalExBtw,
    btw,
    totaalInclBtw,
  };
}

/**
 * Dashboard stats calculator.
 * Pure function that mirrors the stats logic in getDashboardData handler.
 */
export function calculateDashboardStats(
  offertes: Array<{
    status: string;
    totalen: { totaalInclBtw: number };
    isArchived?: boolean;
    deletedAt?: number;
  }>
) {
  const filtered = offertes.filter((o) => !o.isArchived && !o.deletedAt);

  const stats = {
    totaal: filtered.length,
    concept: 0,
    voorcalculatie: 0,
    verzonden: 0,
    geaccepteerd: 0,
    afgewezen: 0,
    totaalWaarde: 0,
    geaccepteerdWaarde: 0,
  };

  for (const offerte of filtered) {
    (stats as Record<string, number>)[offerte.status]++;
    stats.totaalWaarde += offerte.totalen.totaalInclBtw;
    if (offerte.status === "geaccepteerd") {
      stats.geaccepteerdWaarde += offerte.totalen.totaalInclBtw;
    }
  }

  return stats;
}

/**
 * Revenue stats calculator.
 * Pure function that mirrors the logic in getRevenueStats/getFullDashboardData handlers.
 */
export function calculateRevenueStats(
  offertes: Array<{
    status: string;
    totalen: { totaalInclBtw: number };
  }>
) {
  let totalAcceptedValue = 0;
  let totalAcceptedCount = 0;
  let totalSentCount = 0;

  for (const offerte of offertes) {
    if (offerte.status === "geaccepteerd") {
      totalAcceptedValue += offerte.totalen.totaalInclBtw;
      totalAcceptedCount++;
    }
    if (
      offerte.status === "verzonden" ||
      offerte.status === "geaccepteerd" ||
      offerte.status === "afgewezen"
    ) {
      totalSentCount++;
    }
  }

  const conversionRate =
    totalSentCount > 0
      ? Math.round((totalAcceptedCount / totalSentCount) * 100)
      : 0;
  const averageOfferteValue =
    totalAcceptedCount > 0
      ? Math.round(totalAcceptedValue / totalAcceptedCount)
      : 0;

  return {
    totalAcceptedValue,
    totalAcceptedCount,
    conversionRate,
    averageOfferteValue,
  };
}

/**
 * List filter logic (extracted from list query handler).
 * Filters out archived/deleted unless explicitly included.
 */
export function filterOfferteList<T extends { isArchived?: unknown; deletedAt?: unknown }>(
  offertes: T[],
  options: { includeArchived?: boolean; includeDeleted?: boolean } = {}
): T[] {
  let filtered = [...offertes];
  if (!options.includeDeleted) {
    filtered = filtered.filter((o) => !o.deletedAt);
  }
  if (!options.includeArchived) {
    filtered = filtered.filter((o) => !o.isArchived);
  }
  return filtered;
}
