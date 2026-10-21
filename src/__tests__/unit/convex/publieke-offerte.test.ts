// @vitest-environment node
/**
 * Openbare offertelink (HERO-nabouw fase 6): alleen verstuurde offertes,
 * alleen met de juiste token, en zonder inkoop, marge of interne notities.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { getByToken } from "../../../../convex/publiekeOfferte";

// ─── Nep-Convex-database ─────────────────────────────────────────────────────

interface FakeDoc {
  _id: string;
  _creationTime: number;
  [key: string]: unknown;
}

interface IndexQ {
  eq: (field: string, value: unknown) => IndexQ;
}

interface FilterQ {
  eq: (a: unknown, b: unknown) => boolean;
  field: (name: string) => unknown;
}

function createQueryBuilder(docs: FakeDoc[]) {
  let current = [...docs];

  const builder = {
    withIndex(_indexName: string, fn?: (q: IndexQ) => IndexQ) {
      if (!fn) return builder;
      const constraints: Array<[string, unknown]> = [];
      const q: IndexQ = {
        eq: (field, value) => {
          constraints.push([field, value]);
          return q;
        },
      };
      fn(q);
      current = current.filter((doc) =>
        constraints.every(([field, value]) => doc[field] === value)
      );
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
    order(richting: "asc" | "desc") {
      current = [...current].sort((a, b) =>
        richting === "desc"
          ? b._creationTime - a._creationTime
          : a._creationTime - b._creationTime
      );
      return builder;
    },
    async take(n: number): Promise<FakeDoc[]> {
      return current.slice(0, n);
    },
    async collect(): Promise<FakeDoc[]> {
      return [...current];
    },
    async first(): Promise<FakeDoc | null> {
      return current[0] ?? null;
    },
    async unique(): Promise<FakeDoc | null> {
      if (current.length > 1) throw new Error("unique() vond meerdere documenten");
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

  byId(id: string): FakeDoc | null {
    for (const rows of this.tables.values()) {
      const found = rows.find((d) => d._id === id);
      if (found) return found;
    }
    return null;
  }

  query(table: string) {
    return createQueryBuilder(this.rows(table));
  }

  async insert(table: string, data: Record<string, unknown>): Promise<string> {
    return this.insertSync(table, data);
  }

  async get(id: string): Promise<FakeDoc | null> {
    return this.byId(id);
  }

  async patch(id: string, updates: Record<string, unknown>): Promise<void> {
    const doc = this.byId(id);
    if (!doc) throw new Error(`Document ${id} bestaat niet`);
    for (const [key, value] of Object.entries(updates)) {
      if (value === undefined) delete doc[key];
      else doc[key] = value;
    }
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
  scheduler: { runAfter: (...args: unknown[]) => Promise<void> };
}

type Handler<A, R> = (ctx: FakeCtx, args: A) => Promise<R>;
const handlerVan = <A, R>(fn: unknown): Handler<A, R> =>
  (fn as { _handler: Handler<A, R> })._handler;
const getH = handlerVan<{ token: string }, Record<string, unknown> | null>(getByToken);

const TOKEN = "a".repeat(32);
let db: FakeDb;
let ctx: FakeCtx & { storage: { getUrl: () => Promise<string | null> } };
let offerteId: string;

beforeEach(() => {
  db = new FakeDb();
  const orgId = db.insertSync("organisaties", { naam: "Top Tuinen" });
  db.insertSync("instellingen", {
    orgId,
    offerteNummerPrefix: "",
    laatsteOfferteNummer: 0,
    bedrijfsgegevens: { naam: "Top Tuinen", adres: "Tuinweg 1", postcode: "1234 AB", plaats: "Groenstad" },
  });
  offerteId = db.insertSync("offertes", {
    orgId,
    type: "aanleg",
    status: "verzonden",
    offerteNummer: "01400",
    shareToken: TOKEN,
    klant: { naam: "Jan", adres: "Lindelaan 4", postcode: "1234 CD", plaats: "Ede" },
    algemeenParams: { bereikbaarheid: "goed" },
    regels: [
      {
        id: "r1", scope: "Aanleg", omschrijving: "Bestrating", eenheid: "m2", hoeveelheid: 10,
        prijsPerEenheid: 50, totaal: 500, type: "materiaal", margePercentage: 30,
        inkoopprijsPerEenheid: 35, interneNotitie: "geheim",
      },
    ],
    totalen: {
      materiaalkosten: 350, arbeidskosten: 0, totaalUren: 0, subtotaal: 500, marge: 150,
      margePercentage: 30, totaalExBtw: 500, btw: 105, totaalInclBtw: 605,
    },
    createdAt: 1, updatedAt: 1,
  });
  ctx = {
    db,
    auth: { getUserIdentity: async () => null },
    scheduler: { runAfter: async () => {} },
    storage: { getUrl: async () => null },
  };
});

describe("openbare offertelink", () => {
  it("geeft de offerte zonder interne calculatie", async () => {
    const r = (await getH(ctx, { token: TOKEN })) as {
      offerte: { regels: Record<string, unknown>[]; totalen: { marge: number; totaalInclBtw: number } };
    };
    expect(r.offerte.totalen.totaalInclBtw).toBe(605);
    expect(r.offerte.totalen.marge).toBe(0);
    const regel = r.offerte.regels[0];
    expect(regel).not.toHaveProperty("margePercentage");
    expect(regel).not.toHaveProperty("inkoopprijsPerEenheid");
    expect(regel).not.toHaveProperty("interneNotitie");
  });

  it("verkeerde token of een concept geeft niets", async () => {
    expect(await getH(ctx, { token: "b".repeat(32) })).toBeNull();
    expect(await getH(ctx, { token: "kort" })).toBeNull();
    await db.patch(offerteId, { status: "concept" });
    expect(await getH(ctx, { token: TOKEN })).toBeNull();
  });

  it("een verlopen link geeft niets", async () => {
    await db.patch(offerteId, { shareExpiresAt: Date.now() - 1000 });
    expect(await getH(ctx, { token: TOKEN })).toBeNull();
  });
});
