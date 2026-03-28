/**
 * Convex Mock Utilities for Unit Testing
 *
 * Provides mock factories for Convex context objects (ctx) used in
 * query and mutation handlers. These mocks simulate the Convex runtime
 * without requiring a real Convex backend.
 */

import { vi } from "vitest";

// ─── Types ───────────────────────────────────────────────────────────────────

type MockId = string;

interface MockDocument {
  _id: MockId;
  _creationTime: number;
  [key: string]: unknown;
}

interface MockIndexQuery {
  eq: (field: string, value: unknown) => MockIndexQuery;
}

interface MockQueryBuilder {
  withIndex: (indexName: string, fn: (q: MockIndexQuery) => MockIndexQuery) => MockQueryBuilder;
  withSearchIndex: (indexName: string, fn: (q: { search: (field: string, term: string) => { eq: (field: string, value: unknown) => unknown } }) => unknown) => MockQueryBuilder;
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
  field: (name: string) => string;
}

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
    // Spread data first, then override _id to ensure store controls the ID
    const doc = {
      ...data,
      _id: id,
      _creationTime: Date.now(),
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

function createMockQueryBuilder(docs: MockDocument[]): MockQueryBuilder {
  let filteredDocs = [...docs];

  const builder: MockQueryBuilder = {
    withIndex: (_indexName, _fn) => builder,
    withSearchIndex: (_indexName, _fn) => builder,
    filter: (fn) => {
      const filterBuilder: MockFilterBuilder = {
        eq: (a, b) => a === b,
        field: (name) => name,
      };
      // Apply filter in-memory by checking each doc
      filteredDocs = filteredDocs.filter((doc) => {
        try {
          const fieldProxy: MockFilterBuilder = {
            eq: (a: unknown, b: unknown) => a === b,
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
    unique: async () => (filteredDocs.length === 1 ? filteredDocs[0] : filteredDocs[0] || null),
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
    get: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    patch: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    query: ReturnType<typeof vi.fn>;
  };
  auth: {
    getUserIdentity: ReturnType<typeof vi.fn>;
  };
  scheduler: {
    runAfter: ReturnType<typeof vi.fn>;
  };
}

/**
 * Create a mock Convex query/mutation context backed by an in-memory store.
 */
export function createMockCtx(store: MockConvexStore): MockCtx {
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
        createMockQueryBuilder(store.getAll(tableName))
      ),
    },
    auth: {
      getUserIdentity: vi.fn(() =>
        Promise.resolve({ subject: "clerk_test_user_123" })
      ),
    },
    scheduler: {
      runAfter: vi.fn(() => Promise.resolve()),
    },
  };
}

// ─── Mock Data Factories ─────────────────────────────────────────────────────

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
