// @vitest-environment node
/**
 * Overige documenten (HERO-nabouw fase 6): orderbevestiging en leveringsbon
 * uit offerte 01399, met de vaste teksten uit de bibliotheek.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect, beforeEach } from "vitest";
import { ConvexError } from "convex/values";
import { orderbevestiging, leveringsbon } from "../../../../convex/documenten";
import { laadStandaardteksten } from "../../../../convex/tekstblokken";

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


async function fout(p: Promise<unknown>): Promise<string> {
  const e = await p.then(() => null, (x: unknown) => x as ConvexError<string>);
  if (!e) throw new Error("Verwachtte een ConvexError");
  return String(e.data);
}

const fixture = JSON.parse(
  readFileSync(join(process.cwd(), "docs/hero-nabouw/offerte/hero-datamodel.json"), "utf8")
).fixture_01399 as {
  lines: { nr: string; name: string; quantity: number; unit: string; net_price_per_unit: number; vat_percent: 9 | 21 }[];
};

const CLERK_ORG_ID = "org_top_tuinen";
let db: FakeDb;
let ctx: FakeCtx;
let offerteId: string;
let projectId: string;

beforeEach(() => {
  db = new FakeDb();
  const orgId = db.insertSync("organisaties", {
    clerkOrgId: CLERK_ORG_ID, naam: "Top Tuinen", slug: "top-tuinen", actief: true, aangemaaktOp: Date.now(),
  });
  const userId = db.insertSync("users", {
    clerkId: "clerk_staf", email: "kantoor@toptuinen.nl", name: "Mickey Jansen", role: "directie", createdAt: Date.now(),
  });
  db.insertSync("instellingen", {
    userId, orgId, offerteNummerPrefix: "", laatsteOfferteNummer: 1399,
    factuurNummerPrefix: "FACT", factuurNummerFormaat: "doorlopend", factuurNummerCijfers: 5,
    laatsteFactuurNummer: 1129, standaardBetalingstermijn: 14, btwPercentage: 21,
    bedrijfsgegevens: {
      naam: "Top Tuinen", adres: "Tuinweg 1", postcode: "1234 AB", plaats: "Groenstad",
      kvk: "12345678", btw: "NL001234567B01", iban: "NL91ABNA0417164300",
    },
  });
  const klantId = db.insertSync("klanten", {
    orgId, naam: "Jan de Vries", adres: "Lindelaan 4", postcode: "1234 CD", plaats: "Ede",
    createdAt: Date.now(), updatedAt: Date.now(),
  });
  const regels = fixture.lines.map((l) => ({
    id: l.nr, scope: "Aanleg", omschrijving: l.name, eenheid: l.unit, hoeveelheid: l.quantity,
    prijsPerEenheid: l.net_price_per_unit, totaal: l.quantity * l.net_price_per_unit,
    type: "materiaal", btwCode: l.vat_percent,
  }));
  offerteId = db.insertSync("offertes", {
    orgId, type: "aanleg", bron: "vrij", status: "geaccepteerd", offerteNummer: "01399", klantId,
    klant: { naam: "Jan de Vries", adres: "Lindelaan 4", postcode: "1234 CD", plaats: "Ede" },
    algemeenParams: { bereikbaarheid: "goed" }, regels,
    totalen: {
      materiaalkosten: 24699.1, arbeidskosten: 0, totaalUren: 0, subtotaal: 24699.1, marge: 0,
      margePercentage: 0, totaalExBtw: 24699.1, btw: 5106.17, totaalInclBtw: 29805.27,
    },
    termijnschema: [
      { percentage: 50, label: "na gunning" },
      { percentage: 30, label: "bij de start" },
      { percentage: 20, label: "bij oplevering" },
    ],
    createdAt: Date.now(), updatedAt: Date.now(),
  });
  projectId = db.insertSync("projecten", {
    orgId, offerteId, klantId, naam: "Tuin De Vries", status: "in_uitvoering", type: "project",
    createdAt: Date.now(), updatedAt: Date.now(),
  });
  ctx = {
    db,
    auth: { getUserIdentity: async () => ({ subject: "clerk_staf", org_id: CLERK_ORG_ID }) },
    scheduler: { runAfter: async () => {} },
    storage: { getUrl: async () => null },
  } as FakeCtx;
});

type Doc = {
  titel: string;
  regels: { omschrijving: string; totaal?: number }[];
  teksten: { inleiding?: string; afsluiting?: string };
  totalen: { inclBtw: number } | null;
};
const obH = handlerVan<Record<string, unknown>, Doc>(orderbevestiging);
const lbH = handlerVan<Record<string, unknown>, Doc>(leveringsbon);
const laadH = handlerVan<Record<string, unknown>, unknown>(laadStandaardteksten);

describe("orderbevestiging en leveringsbon", () => {
  it("orderbevestiging: alle regels met prijzen, totaal en ingevulde tekst", async () => {
    await laadH(ctx, {});
    const d = await obH(ctx, { offerteId });
    expect(d.titel).toBe("Orderbevestiging");
    expect(d.regels).toHaveLength(7);
    expect(d.totalen?.inclBtw).toBe(29805.27);
    expect(d.teksten.inleiding).toContain("Conform onze offerte 01399");
    expect(d.teksten.afsluiting).toContain("Uw handtekening");
  });

  it("orderbevestiging alleen bij een geaccepteerde offerte", async () => {
    await db.patch(offerteId, { status: "verzonden" });
    expect(await fout(obH(ctx, { offerteId }))).toContain("geaccepteerde offerte");
  });

  it("leveringsbon: materiaalregels zonder prijzen", async () => {
    await laadH(ctx, {});
    const d = await lbH(ctx, { projectId });
    expect(d.titel).toBe("Leveringsbon");
    expect(d.regels.length).toBeGreaterThan(0);
    expect(d.regels.every((r) => r.totaal === undefined)).toBe(true);
    expect(d.totalen).toBeNull();
    expect(d.teksten.inleiding).toContain("Beste Jan de Vries");
  });
});
