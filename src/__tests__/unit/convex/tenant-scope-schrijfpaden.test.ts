/**
 * Regressietests voor audit §2 — de schrijfkant van de multi-tenant scope.
 *
 * Bij de scope-fix kregen `urenRegistraties` en `voorcalculaties` een optioneel
 * `userId` + een `by_user`-index, en zijn de leesqueries omgezet naar die index.
 * De inserts bleven daarbij achter: nieuwe rijen kwamen zonder `userId` binnen
 * en vielen dus buiten élke `by_user`-query. Dat is geen crash en geen
 * typefout — de gegevens verdwijnen stilletjes uit de app, en geen enkele
 * gate (tsc, eslint, build) ziet dat.
 *
 * Deze tests leggen per schrijfpad vast dat het tenant-veld wordt meegeschreven,
 * met dezelfde route als de backfill-migraties in convex/migrations.ts:
 *   - urenRegistraties.userId  = projecten.userId
 *   - voorcalculaties.userId   = projecten.userId, anders offertes.userId
 */

import { describe, it, expect, beforeEach } from "vitest";
import { add, importBatch } from "../../../../convex/urenRegistraties";
import { create as createProjectKost } from "../../../../convex/projectKosten";
import { create as createVoorcalculatie } from "../../../../convex/voorcalculaties";

// ─── Nep-Convex-database ─────────────────────────────────────────────────────

interface FakeDoc {
  _id: string;
  _creationTime: number;
  [key: string]: unknown;
}

interface IndexQ {
  eq: (field: string, value: unknown) => IndexQ;
}

/**
 * Query-builder die index-constraints wél toepast — de gedeelde mock in
 * `helpers/convex-mock.ts` negeert `withIndex`, terwijl juist de scoping ván
 * die index is wat hier getest wordt.
 */
function createQueryBuilder(docs: FakeDoc[]) {
  let current = [...docs];

  const builder = {
    withIndex(_indexName: string, fn?: (q: IndexQ) => IndexQ) {
      if (!fn) return builder;
      const predicates: Array<(doc: FakeDoc) => boolean> = [];
      const q: IndexQ = {
        eq: (field, value) => {
          predicates.push((doc) => doc[field] === value);
          return q;
        },
      };
      fn(q);
      current = current.filter((doc) => predicates.every((p) => p(doc)));
      return builder;
    },
    order(richting: "asc" | "desc") {
      current = [...current].sort((a, b) =>
        richting === "desc"
          ? (b._creationTime ?? 0) - (a._creationTime ?? 0)
          : (a._creationTime ?? 0) - (b._creationTime ?? 0)
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

const addHandler = handlerVan<
  {
    projectId: string;
    datum: string;
    medewerker: string;
    uren: number;
    scope?: string;
  },
  string
>(add);

const importBatchHandler = handlerVan<
  {
    projectId: string;
    entries: Array<{ datum: string; medewerker: string; uren: number }>;
  },
  { count: number; ids: string[] }
>(importBatch);

const projectKostHandler = handlerVan<
  {
    projectId: string;
    type: string;
    datum: string;
    omschrijving: string;
    hoeveelheid: number;
    prijsPerEenheid: number;
    medewerker?: string;
  },
  { id: string; type: string; totaal: number }
>(createProjectKost);

const voorcalculatieHandler = handlerVan<
  {
    projectId?: string;
    offerteId?: string;
    teamGrootte: number;
    effectieveUrenPerDag: number;
    normUrenTotaal: number;
    geschatteDagen: number;
    normUrenPerScope: Record<string, number>;
  },
  string
>(createVoorcalculatie);

// ─── Fixture ─────────────────────────────────────────────────────────────────

const CLERK_ID = "clerk_eigen_bedrijf";

let db: FakeDb;
let ctx: FakeCtx;
let eigenUserId: string;
let eigenProjectId: string;
let eigenOfferteId: string;

beforeEach(() => {
  db = new FakeDb();

  eigenUserId = db.insertSync("users", {
    clerkId: CLERK_ID,
    email: "directie@toptuinen.nl",
    name: "Directie",
    role: "directie",
  });

  // Tweede bedrijf: puur om te bewijzen dat we niet toevallig de enige tenant
  // in de database zijn en het veld dus niet "per ongeluk" goed staat.
  db.insertSync("users", {
    clerkId: "clerk_ander_bedrijf",
    email: "ander@bedrijf.nl",
    name: "Ander bedrijf",
    role: "directie",
  });

  eigenProjectId = db.insertSync("projecten", {
    userId: eigenUserId,
    naam: "Tuin Jansen",
    status: "gepland",
  });

  eigenOfferteId = db.insertSync("offertes", {
    userId: eigenUserId,
    offerteNummer: "2026-001",
    status: "geaccepteerd",
  });

  ctx = {
    db,
    auth: {
      getUserIdentity: async () => ({ subject: CLERK_ID }),
    },
  };
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("urenRegistraties — tenant-veld op schrijfpaden", () => {
  it("add zet userId op de eigenaar van het project", async () => {
    await addHandler(ctx, {
      projectId: eigenProjectId,
      datum: "2026-08-12",
      medewerker: "Jan de Vries",
      uren: 8,
    });

    const rijen = db.rows("urenRegistraties");
    expect(rijen).toHaveLength(1);
    expect(rijen[0].userId).toBe(eigenUserId);
  });

  it("importBatch zet userId op élke geïmporteerde regel", async () => {
    await importBatchHandler(ctx, {
      projectId: eigenProjectId,
      entries: [
        { datum: "2026-08-12", medewerker: "Jan de Vries", uren: 8 },
        { datum: "2026-08-13", medewerker: "Piet Bakker", uren: 6 },
      ],
    });

    const rijen = db.rows("urenRegistraties");
    expect(rijen).toHaveLength(2);
    expect(rijen.every((r) => r.userId === eigenUserId)).toBe(true);
  });

  it("projectKosten.create (arbeid) zet userId op de urenregistratie", async () => {
    await projectKostHandler(ctx, {
      projectId: eigenProjectId,
      type: "arbeid",
      datum: "2026-08-12",
      omschrijving: "Bestrating leggen",
      hoeveelheid: 8,
      prijsPerEenheid: 45,
      medewerker: "Jan de Vries",
    });

    const rijen = db.rows("urenRegistraties");
    expect(rijen).toHaveLength(1);
    expect(rijen[0].userId).toBe(eigenUserId);
  });

  it("een nieuwe registratie is vindbaar via de by_user-index", async () => {
    await addHandler(ctx, {
      projectId: eigenProjectId,
      datum: "2026-08-12",
      medewerker: "Jan de Vries",
      uren: 8,
    });

    // Dit is precies wat de leesqueries doen; vóór de fix leverde dit niets op.
    const gevonden = await db
      .query("urenRegistraties")
      .withIndex("by_user", (q) => q.eq("userId", eigenUserId))
      .collect();

    expect(gevonden).toHaveLength(1);
  });
});

describe("voorcalculaties — tenant-veld op schrijfpaden", () => {
  it("create via projectId zet userId op de eigenaar", async () => {
    await voorcalculatieHandler(ctx, {
      projectId: eigenProjectId,
      teamGrootte: 2,
      effectieveUrenPerDag: 7,
      normUrenTotaal: 56,
      geschatteDagen: 4,
      normUrenPerScope: { bestrating: 56 },
    });

    const rijen = db.rows("voorcalculaties");
    expect(rijen).toHaveLength(1);
    expect(rijen[0].userId).toBe(eigenUserId);
  });

  it("create via offerteId zet userId op de eigenaar", async () => {
    await voorcalculatieHandler(ctx, {
      offerteId: eigenOfferteId,
      teamGrootte: 3,
      effectieveUrenPerDag: 7,
      normUrenTotaal: 84,
      geschatteDagen: 4,
      normUrenPerScope: { grondwerk: 84 },
    });

    const rijen = db.rows("voorcalculaties");
    expect(rijen).toHaveLength(1);
    expect(rijen[0].userId).toBe(eigenUserId);
  });
});
