// @vitest-environment node
/**
 * Factuurketen via de echte handlers (HERO-nabouw fase 3): offerte 01399
 * geaccepteerd → termijn 1 en 2 → eindfactuur. De som is op de cent de
 * offerte; volgorde en dubbel factureren worden bewaakt; het nummer komt pas
 * bij definitief; btw verlegd vraagt een btw-nummer.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect, beforeEach } from "vitest";
import { ConvexError } from "convex/values";
import { factureerTermijn, maakEindfactuur, overzicht } from "../../../../convex/factuurKeten";
import { updateStatus, setBtwVerlegd, generate, getTeksten } from "../../../../convex/facturen";
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

const termijnH = handlerVan<Record<string, unknown>, string>(factureerTermijn);
const eindH = handlerVan<Record<string, unknown>, string>(maakEindfactuur);
const overzichtH = handlerVan<Record<string, unknown>, {
  termijnen: { nummer: number; factuur: { _id: string } | null }[];
  gefactureerd: number;
  nogTeFactureren: number;
  volgendeNummer: number | null;
}>(overzicht);
const statusH = handlerVan<Record<string, unknown>, string>(updateStatus);
const verlegdH = handlerVan<Record<string, unknown>, void>(setBtwVerlegd);
const generateH = handlerVan<Record<string, unknown>, string>(generate);

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
  };
});

describe("factuurketen offerte 01399", () => {
  it("50/30/20 + eindfactuur telt op tot de offerte, op de cent", async () => {
    const t1 = await termijnH(ctx, { offerteId, nummer: 1 });
    expect(db.byId(t1)!.factuurnummer).toBe("Concept");
    expect(db.byId(t1)!.projectId).toBe(projectId);
    await statusH(ctx, { id: t1, status: "definitief" });
    expect(db.byId(t1)!.factuurnummer).toBe("FACT01130");

    const t2 = await termijnH(ctx, { offerteId, nummer: 2 });
    await statusH(ctx, { id: t2, status: "definitief" });
    expect(db.byId(t2)!.factuurnummer).toBe("FACT01131");

    const eind = await eindH(ctx, { offerteId });
    const e = db.byId(eind)!;
    expect(e.isEindfactuur).toBe(true);
    expect(e.btwBedrag).toBe(1021.23);
    expect(e.totaalInclBtw).toBe(5961.05);

    const som = [t1, t2, eind].reduce((t, id) => t + (db.byId(id)!.totaalInclBtw as number), 0);
    expect(Math.round(som * 100) / 100).toBe(29805.27);

    // Concepten tellen nog niet als gefactureerd
    expect((await overzichtH(ctx, { offerteId })).gefactureerd).toBe(23844.22);
    await statusH(ctx, { id: eind, status: "definitief" });
    expect(db.byId(eind)!.factuurnummer).toBe("FACT01132");
    const o = await overzichtH(ctx, { offerteId });
    expect(o.termijnen.every((t) => t.factuur)).toBe(true);
    expect(o.gefactureerd).toBe(29805.27);
    expect(o.nogTeFactureren).toBe(0);
    expect(o.volgendeNummer).toBeNull();
  });

  it("bewaakt de volgorde en dubbel factureren", async () => {
    expect(await fout(termijnH(ctx, { offerteId, nummer: 2 }))).toContain("eerst termijn 1");
    expect(await fout(termijnH(ctx, { offerteId, nummer: 3 }))).toContain("eindfactuur");
    await termijnH(ctx, { offerteId, nummer: 1 });
    expect(await fout(termijnH(ctx, { offerteId, nummer: 1 }))).toContain("al gefactureerd");
    // Volledige factuur naast termijnen kan niet
    expect(await fout(generateH(ctx, { projectId }))).toContain("al een factuur");
  });

  it("eindfactuur pas als de termijnen definitief zijn", async () => {
    await termijnH(ctx, { offerteId, nummer: 1 });
    expect(await fout(eindH(ctx, { offerteId }))).toContain("eerst definitief");
  });

  it("zonder project eerst het project starten", async () => {
    await db.patch(projectId, { offerteId: undefined });
    expect(await fout(termijnH(ctx, { offerteId, nummer: 1 }))).toContain("Start eerst het project");
  });

  it("zonder termijnschema één factuur met de gewone factuurtekst", async () => {
    await db.patch(offerteId, { termijnschema: undefined });
    const id = await eindH(ctx, { offerteId });
    const f = db.byId(id)!;
    expect(f.documentSoort).toBe("factuur");
    expect(f.termijnAftrek).toBeUndefined();
    expect(f.totaalInclBtw).toBe(29805.27);
  });

  it("de termijnfactuur noemt de termijn in de tekst", async () => {
    await handlerVan<Record<string, unknown>, unknown>(laadStandaardteksten)(ctx, {});
    const t1 = await termijnH(ctx, { offerteId, nummer: 1 });
    const { teksten } = await handlerVan<
      Record<string, unknown>,
      { teksten: { inleiding?: string } }
    >(getTeksten)(ctx, { id: t1 });
    expect(teksten.inleiding).toContain("Termijn 1: na gunning (50% van het offertebedrag)");
  });

  it("factureren kan pas na acceptatie", async () => {
    await db.patch(offerteId, { status: "verzonden" });
    expect(await fout(termijnH(ctx, { offerteId, nummer: 1 }))).toContain("geaccepteerd");
  });

  it("btw verlegd: geen btw, en definitief vraagt het btw-nummer van de klant", async () => {
    const t1 = await termijnH(ctx, { offerteId, nummer: 1 });
    await verlegdH(ctx, { id: t1, btwVerlegd: "eu" });
    const f = db.byId(t1)!;
    expect(f.btwBedrag).toBe(0);
    expect(f.totaalInclBtw).toBe(12349.55);
    expect(f.btwVerlegdVermelding).toContain("Intracommunautaire");
    expect(await fout(statusH(ctx, { id: t1, status: "definitief" }))).toContain(
      "btw-nummer van de klant"
    );
    // Mislukt definitief maken kost geen nummer
    expect(db.byId(t1)!.factuurnummer).toBe("Concept");

    await verlegdH(ctx, { id: t1, btwVerlegd: "eu", klantBtwNummer: "BE0123456789" });
    await statusH(ctx, { id: t1, status: "definitief" });
    expect(db.byId(t1)!.factuurnummer).toBe("FACT01130");
  });
});
