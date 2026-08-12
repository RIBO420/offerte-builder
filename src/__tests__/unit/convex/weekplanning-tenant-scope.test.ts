/**
 * Regressietests voor audit §2 — cross-tenant lek in convex/weekPlanning.ts.
 *
 * Het planbord las `medewerkers` met een ongescopete `.filter()`-scan en
 * `projecten` via de `by_status`-index: beide leverden de gegevens van álle
 * bedrijven op. De planningrijen zelf (tabel `weekPlanning`, zonder `userId`)
 * werden alleen op datum gefilterd, en de mutations accepteerden willekeurige
 * medewerker-, project- en toewijzing-ids.
 *
 * Deze tests leggen vast dat:
 *   - queries uitsluitend data van het eigen bedrijf teruggeven;
 *   - een medewerker (geen leesrecht op `medewerkers`, zie roles.ts) alleen de
 *     eigen rij ziet — zelfde regel als medewerkers.ts::list;
 *   - de mutations weigeren te schrijven op vreemde medewerkers/projecten.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { ConvexError } from "convex/values";
import {
  assign,
  getActiveProjects,
  getCapacityOverview,
  getMedewerkers,
  getWeek,
  move,
  remove,
} from "../../../../convex/weekPlanning";

// ─── Nep-Convex-database ─────────────────────────────────────────────────────

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

interface FilterQ {
  eq: (a: unknown, b: unknown) => boolean;
  field: (name: string) => unknown;
}

/**
 * Query-builder die de index-constraints wél toepast. De gedeelde mock in
 * `helpers/convex-mock.ts` negeert `withIndex`, en juist de scoping ván die
 * index is wat hier getest wordt.
 */
function createQueryBuilder(docs: FakeDoc[]) {
  let current = [...docs];

  const builder = {
    withIndex(_indexName: string, fn: (q: IndexQ) => IndexQ) {
      const predicates: Array<(doc: FakeDoc) => boolean> = [];
      const q: IndexQ = {
        eq: (field, value) => {
          predicates.push((doc) => doc[field] === value);
          return q;
        },
        gte: (field, value) => {
          predicates.push((doc) => (doc[field] as string) >= (value as string));
          return q;
        },
        lte: (field, value) => {
          predicates.push((doc) => (doc[field] as string) <= (value as string));
          return q;
        },
      };
      fn(q);
      current = current.filter((doc) => predicates.every((p) => p(doc)));
      return builder;
    },
    filter(fn: (q: FilterQ) => boolean) {
      current = current.filter((doc) =>
        fn({
          eq: (a, b) => a === b,
          field: (name) => doc[name],
        })
      );
      return builder;
    },
    async collect(): Promise<FakeDoc[]> {
      return [...current];
    },
    async first(): Promise<FakeDoc | null> {
      return current[0] ?? null;
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
    return createQueryBuilder(this.rows(table));
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

  async delete(id: string): Promise<void> {
    for (const [table, rows] of this.tables) {
      const idx = rows.findIndex((d) => d._id === id);
      if (idx !== -1) {
        rows.splice(idx, 1);
        this.tables.set(table, rows);
        return;
      }
    }
  }
}

interface FakeCtx {
  db: FakeDb;
  auth: { getUserIdentity: () => Promise<{ subject: string } | null> };
}

// ─── Handler-extractie (zelfde patroon als de andere convex-tests) ───────────

type Handler<TArgs, TResult> = (ctx: FakeCtx, args: TArgs) => Promise<TResult>;

function handlerVan<TArgs, TResult>(fn: unknown): Handler<TArgs, TResult> {
  return (fn as { _handler: Handler<TArgs, TResult> })._handler;
}

const getMedewerkersHandler = handlerVan<
  Record<string, never>,
  Array<{ _id: string; naam: string }>
>(getMedewerkers);

const getWeekHandler = handlerVan<
  { startDatum: string; eindDatum: string },
  Array<{ medewerkerNaam: string; projectNaam: string }>
>(getWeek);

const getActiveProjectsHandler = handlerVan<
  Record<string, never>,
  Array<{ _id: string; naam: string }>
>(getActiveProjects);

const getCapacityOverviewHandler = handlerVan<
  { year: number },
  {
    medewerkers: Array<{ naam: string; urenPerMaand: number[] }>;
    totaalMedewerkers: number;
  }
>(getCapacityOverview);

const assignHandler = handlerVan<
  { medewerkerId: string; projectId: string; datum: string; uren?: number },
  string
>(assign);

const moveHandler = handlerVan<
  { id: string; medewerkerId: string; datum: string },
  void
>(move);

const removeHandler = handlerVan<{ id: string }, void>(remove);

// ─── Testdata: twee bedrijven met eigen medewerkers en projecten ────────────

const CLERK_DIRECTIE_A = "clerk_directie_a";
const CLERK_MEDEWERKER_A = "clerk_medewerker_a";

let db: FakeDb;
let ids: {
  userA: string;
  userB: string;
  anna: string;
  bram: string;
  cor: string;
  zoe: string;
  projectA1: string;
  projectA2: string;
  projectB1: string;
  rijAnna: string;
  rijBram: string;
  rijZoe: string;
};

function ctxVoor(clerkId: string): FakeCtx {
  return {
    db,
    auth: { getUserIdentity: async () => ({ subject: clerkId }) },
  };
}

beforeEach(() => {
  db = new FakeDb();

  const userA = db.insertSync("users", {
    clerkId: CLERK_DIRECTIE_A,
    email: "directie@bedrijf-a.nl",
    name: "Directie A",
    role: "directie",
    createdAt: 1,
  });
  const userB = db.insertSync("users", {
    clerkId: "clerk_directie_b",
    email: "directie@bedrijf-b.nl",
    name: "Directie B",
    role: "directie",
    createdAt: 1,
  });

  const anna = db.insertSync("medewerkers", {
    userId: userA,
    naam: "Anna",
    functie: "hovenier",
    isActief: true,
    clerkUserId: CLERK_MEDEWERKER_A,
    createdAt: 1,
    updatedAt: 1,
  });
  const bram = db.insertSync("medewerkers", {
    userId: userA,
    naam: "Bram",
    isActief: true,
    createdAt: 1,
    updatedAt: 1,
  });
  const cor = db.insertSync("medewerkers", {
    userId: userA,
    naam: "Cor",
    isActief: false,
    createdAt: 1,
    updatedAt: 1,
  });
  const zoe = db.insertSync("medewerkers", {
    userId: userB,
    naam: "Zoë",
    isActief: true,
    createdAt: 1,
    updatedAt: 1,
  });

  // Medewerker-account van bedrijf A (rol zonder leesrecht op medewerkers)
  db.insertSync("users", {
    clerkId: CLERK_MEDEWERKER_A,
    email: "anna@bedrijf-a.nl",
    name: "Anna",
    role: "medewerker",
    linkedMedewerkerId: anna,
    createdAt: 1,
  });

  const projectA1 = db.insertSync("projecten", {
    userId: userA,
    naam: "Tuin Amsterdam",
    status: "gepland",
    createdAt: 1,
    updatedAt: 1,
  });
  const projectA2 = db.insertSync("projecten", {
    userId: userA,
    naam: "Tuin Utrecht",
    status: "in_uitvoering",
    createdAt: 1,
    updatedAt: 1,
  });
  const projectB1 = db.insertSync("projecten", {
    userId: userB,
    naam: "Geheim project B",
    status: "gepland",
    createdAt: 1,
    updatedAt: 1,
  });

  const rijAnna = db.insertSync("weekPlanning", {
    medewerkerId: anna,
    projectId: projectA1,
    datum: "2026-08-12",
    uren: 8,
    createdAt: 1,
  });
  const rijBram = db.insertSync("weekPlanning", {
    medewerkerId: bram,
    projectId: projectA2,
    datum: "2026-08-13",
    uren: 8,
    createdAt: 1,
  });
  const rijZoe = db.insertSync("weekPlanning", {
    medewerkerId: zoe,
    projectId: projectB1,
    datum: "2026-08-12",
    uren: 8,
    createdAt: 1,
  });

  ids = {
    userA,
    userB,
    anna,
    bram,
    cor,
    zoe,
    projectA1,
    projectA2,
    projectB1,
    rijAnna,
    rijBram,
    rijZoe,
  };
});

// ─── Queries ────────────────────────────────────────────────────────────────

describe("weekPlanning queries: tenant-scope", () => {
  it("getMedewerkers geeft alleen actieve medewerkers van het eigen bedrijf", async () => {
    const resultaat = await getMedewerkersHandler(
      ctxVoor(CLERK_DIRECTIE_A),
      {}
    );

    expect(resultaat.map((m) => m.naam).sort()).toEqual(["Anna", "Bram"]);
    expect(resultaat.map((m) => m.naam)).not.toContain("Zoë");
  });

  it("getWeek geeft geen planningrijen van een ander bedrijf", async () => {
    const resultaat = await getWeekHandler(ctxVoor(CLERK_DIRECTIE_A), {
      startDatum: "2026-08-10",
      eindDatum: "2026-08-14",
    });

    expect(resultaat).toHaveLength(2);
    expect(resultaat.map((t) => t.medewerkerNaam).sort()).toEqual([
      "Anna",
      "Bram",
    ]);
    expect(resultaat.map((t) => t.projectNaam)).not.toContain(
      "Geheim project B"
    );
  });

  it("getActiveProjects geeft alleen projecten van het eigen bedrijf", async () => {
    const resultaat = await getActiveProjectsHandler(
      ctxVoor(CLERK_DIRECTIE_A),
      {}
    );

    expect(resultaat.map((p) => p.naam).sort()).toEqual([
      "Tuin Amsterdam",
      "Tuin Utrecht",
    ]);
  });

  it("getCapacityOverview telt alleen de eigen medewerkers mee", async () => {
    const resultaat = await getCapacityOverviewHandler(
      ctxVoor(CLERK_DIRECTIE_A),
      { year: 2026 }
    );

    expect(resultaat.totaalMedewerkers).toBe(2);
    expect(resultaat.medewerkers.map((m) => m.naam).sort()).toEqual([
      "Anna",
      "Bram",
    ]);
  });
});

// ─── Rol-check ──────────────────────────────────────────────────────────────

describe("weekPlanning: rol bepaalt de zichtbare medewerkers", () => {
  it("een medewerker ziet alleen de eigen rij op de Y-as", async () => {
    const resultaat = await getMedewerkersHandler(
      ctxVoor(CLERK_MEDEWERKER_A),
      {}
    );

    expect(resultaat).toHaveLength(1);
    expect(resultaat[0].naam).toBe("Anna");
  });

  it("een medewerker ziet alleen de eigen planningrijen", async () => {
    const resultaat = await getWeekHandler(ctxVoor(CLERK_MEDEWERKER_A), {
      startDatum: "2026-08-10",
      eindDatum: "2026-08-14",
    });

    expect(resultaat).toHaveLength(1);
    expect(resultaat[0].medewerkerNaam).toBe("Anna");
  });
});

// ─── Mutations ──────────────────────────────────────────────────────────────

describe("weekPlanning mutations: eigendomscheck", () => {
  it("assign weigert een medewerker van een ander bedrijf", async () => {
    await expect(
      assignHandler(ctxVoor(CLERK_DIRECTIE_A), {
        medewerkerId: ids.zoe,
        projectId: ids.projectA1,
        datum: "2026-08-12",
      })
    ).rejects.toBeInstanceOf(ConvexError);
  });

  it("assign weigert een project van een ander bedrijf", async () => {
    await expect(
      assignHandler(ctxVoor(CLERK_DIRECTIE_A), {
        medewerkerId: ids.anna,
        projectId: ids.projectB1,
        datum: "2026-08-12",
      })
    ).rejects.toBeInstanceOf(ConvexError);
  });

  it("assign werkt binnen het eigen bedrijf", async () => {
    const id = await assignHandler(ctxVoor(CLERK_DIRECTIE_A), {
      medewerkerId: ids.bram,
      projectId: ids.projectA1,
      datum: "2026-08-14",
      uren: 6,
    });

    expect(db.rows("weekPlanning").find((r) => r._id === id)).toMatchObject({
      medewerkerId: ids.bram,
      projectId: ids.projectA1,
      uren: 6,
    });
  });

  it("move weigert een toewijzing van een ander bedrijf", async () => {
    await expect(
      moveHandler(ctxVoor(CLERK_DIRECTIE_A), {
        id: ids.rijZoe,
        medewerkerId: ids.anna,
        datum: "2026-08-13",
      })
    ).rejects.toBeInstanceOf(ConvexError);

    expect(
      db.rows("weekPlanning").find((r) => r._id === ids.rijZoe)
    ).toMatchObject({ medewerkerId: ids.zoe });
  });

  it("move weigert verplaatsen naar een medewerker van een ander bedrijf", async () => {
    await expect(
      moveHandler(ctxVoor(CLERK_DIRECTIE_A), {
        id: ids.rijAnna,
        medewerkerId: ids.zoe,
        datum: "2026-08-13",
      })
    ).rejects.toBeInstanceOf(ConvexError);
  });

  it("remove weigert een toewijzing van een ander bedrijf", async () => {
    await expect(
      removeHandler(ctxVoor(CLERK_DIRECTIE_A), { id: ids.rijZoe })
    ).rejects.toBeInstanceOf(ConvexError);

    expect(db.rows("weekPlanning")).toHaveLength(3);
  });

  it("remove werkt op een eigen toewijzing", async () => {
    await removeHandler(ctxVoor(CLERK_DIRECTIE_A), { id: ids.rijBram });

    expect(
      db.rows("weekPlanning").map((r) => r._id)
    ).not.toContain(ids.rijBram);
  });
});
