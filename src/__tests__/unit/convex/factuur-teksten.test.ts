// @vitest-environment node
/**
 * Vaste teksten op facturen (HERO-nabouw fase 2), via de echte handlers:
 * standaard bij aanmaken, vastleggen bij definitief, blokkeren bij een leeg
 * IBAN, en de creditfactuur die naar de originele factuur verwijst
 * (DOCUMENTEN-MODULE acceptatietests 3, 4 en 6).
 */

import { describe, it, expect, beforeEach } from "vitest";
import { ConvexError } from "convex/values";
import {
  createVrij,
  updateStatus,
  createCreditnota,
  getTeksten,
} from "../../../../convex/facturen";
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

const createVrijH = handlerVan<Record<string, unknown>, string>(createVrij);
const updateStatusH = handlerVan<Record<string, unknown>, string>(updateStatus);
const creditnotaH = handlerVan<Record<string, unknown>, string>(createCreditnota);
const getTekstenH = handlerVan<
  Record<string, unknown>,
  { teksten: { inleiding?: string; afsluiting?: string }; ontbrekend: string[]; vastgelegd: boolean }
>(getTeksten);
const laadStandaard = handlerVan<Record<string, unknown>, { toegevoegd: number }>(
  laadStandaardteksten
);

const CLERK_ORG_ID = "org_top_tuinen";
let db: FakeDb;
let ctx: FakeCtx;
let instellingenId: string;
let klantId: string;

const BEDRIJF = {
  naam: "Top Tuinen",
  adres: "Tuinweg 1",
  postcode: "1234 AB",
  plaats: "Groenstad",
  email: "info@toptuinen.nl",
  telefoon: "06 12345678",
};

beforeEach(async () => {
  db = new FakeDb();
  const orgId = db.insertSync("organisaties", {
    clerkOrgId: CLERK_ORG_ID,
    naam: "Top Tuinen",
    slug: "top-tuinen",
    actief: true,
    aangemaaktOp: Date.now(),
  });
  const userId = db.insertSync("users", {
    clerkId: "clerk_staf",
    email: "kantoor@toptuinen.nl",
    name: "Mickey Jansen",
    role: "directie",
    createdAt: Date.now(),
  });
  instellingenId = db.insertSync("instellingen", {
    userId,
    orgId,
    offerteNummerPrefix: "",
    laatsteOfferteNummer: 0,
    factuurNummerPrefix: "FACT",
    factuurNummerFormaat: "doorlopend",
    factuurNummerCijfers: 5,
    laatsteFactuurNummer: 1129,
    standaardBetalingstermijn: 14,
    bedrijfsgegevens: { ...BEDRIJF, iban: "NL91ABNA0417164300" },
  });
  klantId = db.insertSync("klanten", {
    orgId,
    naam: "Jan de Vries",
    adres: "Lindelaan 4",
    postcode: "1234 CD",
    plaats: "Ede",
    email: "jan@voorbeeld.nl",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  ctx = {
    db,
    auth: {
      getUserIdentity: async () => ({ subject: "clerk_staf", org_id: CLERK_ORG_ID }),
    },
    scheduler: { runAfter: async () => {} },
  };
  await laadStandaard(ctx, {});
});

const REGELS = [
  { id: "r1", omschrijving: "Snoeiwerk", eenheid: "uur", hoeveelheid: 2, prijsPerEenheid: 60, totaal: 120, btwCode: 21 },
];

describe("vaste teksten op facturen", () => {
  it("een nieuwe factuur krijgt soort en standaardteksten", async () => {
    const id = await createVrijH(ctx, { klantId, regels: REGELS });
    const f = db.byId(id)!;
    expect(f.factuurnummer).toBe("FACT01130");
    expect(f.documentSoort).toBe("factuur");
    expect((f.teksten as { afsluiting: string }).afsluiting).toContain("{{bedrijf.iban}}");
  });

  it("definitief legt de ingevulde teksten vast", async () => {
    const id = await createVrijH(ctx, { klantId, regels: REGELS });
    await updateStatusH(ctx, { id, status: "definitief" });
    const vast = db.byId(id)!.tekstenVastgelegd as { inleiding: string; afsluiting: string };
    expect(vast.inleiding).toContain("Beste Jan de Vries,");
    expect(vast.afsluiting).toContain("NL91ABNA0417164300");
    expect(vast.afsluiting).toContain("factuurnummer FACT01130");
    expect(vast.afsluiting).toMatch(/145,20/);
    expect(vast.afsluiting).not.toContain("{{");

    const na = await getTekstenH(ctx, { id });
    expect(na.vastgelegd).toBe(true);

    // Terug naar concept: weer live
    await updateStatusH(ctx, { id, status: "concept" });
    expect(db.byId(id)!.tekstenVastgelegd).toBeUndefined();
  });

  it("een leeg IBAN houdt definitief maken tegen (acceptatietest 3)", async () => {
    // De bedrijfsgegevens staan als momentopname op de factuur
    await db.patch(instellingenId, { bedrijfsgegevens: BEDRIJF });
    const id = await createVrijH(ctx, { klantId, regels: REGELS });

    const voor = await getTekstenH(ctx, { id });
    expect(voor.ontbrekend).toEqual(["Bedrijf: IBAN"]);

    const fout = await updateStatusH(ctx, { id, status: "definitief" }).then(
      () => null,
      (e: unknown) => e as ConvexError<string>
    );
    expect(fout).toBeInstanceOf(ConvexError);
    expect(fout!.data).toContain("Bedrijf: IBAN");
    expect(db.byId(id)!.documentStatus).toBe("concept");
  });

  it("een creditfactuur krijgt het volgende nummer en verwijst naar het origineel (acceptatietest 6)", async () => {
    const id = await createVrijH(ctx, { klantId, regels: REGELS });
    await updateStatusH(ctx, { id, status: "verzonden" });
    const creditId = await creditnotaH(ctx, { factuurId: id, reden: "Dubbel gefactureerd" });
    const credit = db.byId(creditId)!;
    expect(credit.factuurnummer).toBe("FACT01131");
    expect(credit.documentSoort).toBe("creditnota");
    const vast = credit.tekstenVastgelegd as { inleiding: string };
    expect(vast.inleiding).toContain("onze factuur FACT01130");
  });
});
