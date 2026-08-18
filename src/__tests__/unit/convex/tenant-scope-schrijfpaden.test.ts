/**
 * Regressietests voor audit §2 — de schrijfkant van de multi-tenant scope.
 *
 * Bij de scope-fix kregen `urenRegistraties` en `voorcalculaties` een tenant-veld
 * plus index, en zijn de leesqueries omgezet naar die index. De inserts bleven
 * daarbij achter: nieuwe rijen kwamen zonder tenant binnen en vielen dus buiten
 * élke gescopete query. Dat is geen crash en geen typefout — de gegevens
 * verdwijnen stilletjes uit de app, en geen enkele gate (tsc, eslint, build)
 * ziet dat.
 *
 * Sinds fase 6 is dat veld `orgId`. Deze tests leggen per schrijfpad vast dat
 * het wordt meegeschreven, langs de route van het bovenliggende record:
 *   - urenRegistraties.orgId  = projecten.orgId
 *   - voorcalculaties.orgId   = projecten.orgId, anders offertes.orgId
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
  auth: {
    getUserIdentity: () => Promise<{
      subject: string;
      org_id?: string;
    } | null>;
  };
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
    machineId?: string;
    productId?: string;
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
const CLERK_ORG_ID = "org_eigen_bedrijf";

let db: FakeDb;
let ctx: FakeCtx;
let eigenOrgId: string;
let eigenUserId: string;
let eigenProjectId: string;
let eigenOfferteId: string;

beforeEach(() => {
  db = new FakeDb();

  eigenOrgId = db.insertSync("organisaties", {
    clerkOrgId: CLERK_ORG_ID,
    naam: "Top Tuinen",
    slug: "top-tuinen",
    actief: true,
    aangemaaktOp: Date.now(),
  });

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
    orgId: eigenOrgId,
    naam: "Tuin Jansen",
    status: "gepland",
  });

  eigenOfferteId = db.insertSync("offertes", {
    userId: eigenUserId,
    orgId: eigenOrgId,
    offerteNummer: "2026-001",
    status: "geaccepteerd",
  });

  ctx = {
    db,
    auth: {
      getUserIdentity: async () => ({
        subject: CLERK_ID,
        org_id: CLERK_ORG_ID,
      }),
    },
  };
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("urenRegistraties — tenant-veld op schrijfpaden", () => {
  it("add zet orgId van het project", async () => {
    await addHandler(ctx, {
      projectId: eigenProjectId,
      datum: "2026-08-12",
      medewerker: "Jan de Vries",
      uren: 8,
    });

    const rijen = db.rows("urenRegistraties");
    expect(rijen).toHaveLength(1);
    expect(rijen[0].orgId).toBe(eigenOrgId);
  });

  it("importBatch zet orgId op élke geïmporteerde regel", async () => {
    await importBatchHandler(ctx, {
      projectId: eigenProjectId,
      entries: [
        { datum: "2026-08-12", medewerker: "Jan de Vries", uren: 8 },
        { datum: "2026-08-13", medewerker: "Piet Bakker", uren: 6 },
      ],
    });

    const rijen = db.rows("urenRegistraties");
    expect(rijen).toHaveLength(2);
    expect(rijen.every((r) => r.orgId === eigenOrgId)).toBe(true);
  });

  it("projectKosten.create (arbeid) zet orgId op de urenregistratie", async () => {
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
    expect(rijen[0].orgId).toBe(eigenOrgId);
  });

  it("een nieuwe registratie is vindbaar via de by_org-index", async () => {
    await addHandler(ctx, {
      projectId: eigenProjectId,
      datum: "2026-08-12",
      medewerker: "Jan de Vries",
      uren: 8,
    });

    // Dit is precies wat de leesqueries doen; vóór de fix leverde dit niets op.
    const gevonden = await db
      .query("urenRegistraties")
      .withIndex("by_org", (q) => q.eq("orgId", eigenOrgId))
      .collect();

    expect(gevonden).toHaveLength(1);
  });
});

describe("projectKosten.create — cross-refs binnen de eigen organisatie", () => {
  it("weigert een machineId van een ander bedrijf", async () => {
    const vreemdeMachineId = db.insertSync("machines", {
      userId: "users:2",
      orgId: "organisaties:999",
      naam: "Minikraan van de buren",
      type: "intern",
      tarief: 150,
      tariefType: "dag",
      gekoppeldeScopes: [],
      isActief: true,
    });

    await expect(
      projectKostHandler(ctx, {
        projectId: eigenProjectId,
        type: "machine",
        datum: "2026-08-12",
        omschrijving: "Kraanuren",
        hoeveelheid: 4,
        prijsPerEenheid: 150,
        machineId: vreemdeMachineId,
      })
    ).rejects.toThrow(/geen toegang/i);

    // Geen half werk: er mag ook geen machineGebruik-rij achterblijven.
    expect(db.rows("machineGebruik")).toHaveLength(0);
  });

  it("boekt een machine van de eigen organisatie wél", async () => {
    const eigenMachineId = db.insertSync("machines", {
      userId: eigenUserId,
      orgId: eigenOrgId,
      naam: "Minikraan",
      type: "intern",
      tarief: 150,
      tariefType: "dag",
      gekoppeldeScopes: [],
      isActief: true,
    });

    await projectKostHandler(ctx, {
      projectId: eigenProjectId,
      type: "machine",
      datum: "2026-08-12",
      omschrijving: "Kraanuren",
      hoeveelheid: 4,
      prijsPerEenheid: 150,
      machineId: eigenMachineId,
    });

    const rijen = db.rows("machineGebruik");
    expect(rijen).toHaveLength(1);
    expect(rijen[0].machineId).toBe(eigenMachineId);
  });

  it("weigert een productId van een ander bedrijf", async () => {
    const vreemdProductId = db.insertSync("producten", {
      userId: "users:2",
      orgId: "organisaties:999",
      productnaam: "Split van de buren",
      categorie: "materiaal",
      eenheid: "ton",
      inkoopprijs: 80,
      verkoopprijs: 120,
      isActief: true,
    });

    await expect(
      projectKostHandler(ctx, {
        projectId: eigenProjectId,
        type: "materiaal",
        datum: "2026-08-12",
        omschrijving: "Split",
        hoeveelheid: 2,
        prijsPerEenheid: 80,
        productId: vreemdProductId,
      })
    ).rejects.toThrow(/geen toegang/i);

    // Zonder de check kreeg het vreemde product hier een voorraadrij én een
    // verbruiksmutatie in de eigen tenant.
    expect(db.rows("voorraad")).toHaveLength(0);
    expect(db.rows("voorraadMutaties")).toHaveLength(0);
  });
});

describe("voorcalculaties — tenant-veld op schrijfpaden", () => {
  it("create via projectId zet orgId op de organisatie van het project", async () => {
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
    expect(rijen[0].orgId).toBe(eigenOrgId);
    // userId blijft tot fase 6 meegeschreven
    expect(rijen[0].orgId).toBe(eigenOrgId);
  });

  it("create via offerteId zet orgId op de organisatie van de offerte", async () => {
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
    expect(rijen[0].orgId).toBe(eigenOrgId);
    expect(rijen[0].orgId).toBe(eigenOrgId);
  });
});
