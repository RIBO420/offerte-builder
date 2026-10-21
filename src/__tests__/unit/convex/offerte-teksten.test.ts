// @vitest-environment node
/**
 * Vaste teksten op de offerte (HERO-nabouw fase 2), via de echte handlers:
 *
 *   1. Een nieuwe offerte krijgt de standaard inleiding en afsluiting van
 *      zijn soort uit de bibliotheek (met placeholders).
 *   2. Versturen vult de velden in en legt ze vast; een leeg veld (IBAN)
 *      houdt het versturen tegen (DOCUMENTEN-MODULE acceptatietest 3).
 *   3. Een latere wijziging in de bibliotheek raakt een verstuurde offerte
 *      niet (acceptatietest 4); terug naar voorcalculatie maakt hem weer live.
 *
 * Zelfde nep-ctx als offerte-klant-optioneel.test.ts (convex-test is niet
 * geïnstalleerd).
 */

import { describe, it, expect, beforeEach } from "vitest";
import { ConvexError } from "convex/values";
import { create, updateStatus, getTeksten } from "../../../../convex/offertes";
import { laadStandaardteksten, update as updateTekstblok } from "../../../../convex/tekstblokken";
import { DOCUMENT_SOORTEN } from "../../../../convex/lib/documentTekst";
import { DOCUMENT_SOORT_WAARDEN } from "../../../../convex/lib/documentTekstValidators";

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

const createOfferte = handlerVan<Record<string, unknown>, string>(create);
const updateStatusH = handlerVan<Record<string, unknown>, string>(updateStatus);
const getTekstenH = handlerVan<
  Record<string, unknown>,
  { teksten: { inleiding?: string; afsluiting?: string }; ontbrekend: string[]; vastgelegd: boolean }
>(getTeksten);
const laadStandaard = handlerVan<Record<string, unknown>, { toegevoegd: number }>(
  laadStandaardteksten
);
const updateBlok = handlerVan<Record<string, unknown>, string>(updateTekstblok);

const CLERK_ORG_ID = "org_top_tuinen";
const KLANT = { naam: "Jan de Vries", adres: "Lindelaan 4", postcode: "1234 CD", plaats: "Ede" };

let db: FakeDb;
let ctx: FakeCtx;
let instellingenId: string;

beforeEach(() => {
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
    offerteNummerFormaat: "doorlopend",
    offerteNummerCijfers: 5,
    laatsteOfferteNummer: 1399,
    offerteGeldigheidDagen: 30,
    standaardBetalingstermijn: 14,
    deelfactuurTemplates: [
      {
        id: "t1",
        naam: "50/30/20",
        stappen: [
          { percentage: 50, label: "na gunning" },
          { percentage: 30, label: "bij de start" },
          { percentage: 20, label: "bij oplevering" },
        ],
      },
    ],
    bedrijfsgegevens: {
      naam: "Top Tuinen",
      adres: "Tuinweg 1",
      postcode: "1234 AB",
      plaats: "Groenstad",
      email: "info@toptuinen.nl",
      telefoon: "06 12345678",
    },
  });
  ctx = {
    db,
    auth: {
      getUserIdentity: async () => ({ subject: "clerk_staf", org_id: CLERK_ORG_ID }),
    },
    scheduler: { runAfter: async () => {} },
  };
});

async function nieuweOfferte(): Promise<string> {
  return await createOfferte(ctx, {
    type: "aanleg",
    bron: "vrij",
    klant: KLANT,
    algemeenParams: { bereikbaarheid: "goed" },
  });
}

describe("documentsoorten", () => {
  it("validator en motor kennen dezelfde soorten", () => {
    expect([...DOCUMENT_SOORT_WAARDEN]).toEqual([...DOCUMENT_SOORTEN]);
  });
});

describe("vaste teksten op de offerte", () => {
  it("zonder bibliotheek krijgt een nieuwe offerte geen teksten", async () => {
    const id = await nieuweOfferte();
    expect(db.byId(id)!.vrijeTeksten).toBeUndefined();
  });

  it("een nieuwe offerte krijgt de standaardteksten van zijn soort", async () => {
    await laadStandaard(ctx, {});
    const id = await nieuweOfferte();
    const vrije = db.byId(id)!.vrijeTeksten as { aanhef: string; voorwaarden: string };
    expect(vrije.aanhef).toContain("{{klant.naam}}");
    expect(vrije.voorwaarden).toContain("{{offerte.termijnschema}}");
    expect(db.byId(id)!.offerteNummer).toBe("01400");
  });

  it("een leeg IBAN houdt het versturen tegen en noemt het veld", async () => {
    await laadStandaard(ctx, {});
    // De offerte-afsluiting gebruikt geen IBAN; zet hem er voor de test in
    const afsluiting = db
      .rows("tekstblokken")
      .find((b) => b.documentSoort === "offerte_aanleg" && b.categorie === "voorwaarden")!;
    await updateBlok(ctx, {
      id: afsluiting._id,
      inhoud: "Betalen op {{bedrijf.iban}}.",
    });
    const id = await nieuweOfferte();

    const fout = await updateStatusH(ctx, { id, status: "verzonden" }).then(
      () => null,
      (e: unknown) => e as ConvexError<string>
    );
    expect(fout).toBeInstanceOf(ConvexError);
    expect(fout!.data).toContain("Bedrijf: IBAN");
    expect(db.byId(id)!.status).toBe("concept");
  });

  it("versturen legt de ingevulde teksten vast; de bibliotheek raakt ze daarna niet", async () => {
    await laadStandaard(ctx, {});
    const id = await nieuweOfferte();

    const voor = await getTekstenH(ctx, { id });
    expect(voor.vastgelegd).toBe(false);
    expect(voor.ontbrekend).toEqual([]);

    await updateStatusH(ctx, { id, status: "verzonden" });
    const vast = db.byId(id)!.tekstenVastgelegd as { aanhef: string; voorwaarden: string };
    expect(vast.aanhef).toContain("Beste Jan de Vries,");
    expect(vast.voorwaarden).toContain("- 50% na gunning");
    expect(vast.voorwaarden).toContain("Mickey Jansen");
    expect(vast.voorwaarden).toMatch(/geldig tot \d{1,2} \w+ \d{4}/);
    expect(vast.voorwaarden).not.toContain("{{");

    // Bibliotheek aanpassen na versturen
    const inleiding = db
      .rows("tekstblokken")
      .find((b) => b.documentSoort === "offerte_aanleg" && b.categorie === "aanhef")!;
    await updateBlok(ctx, { id: inleiding._id, inhoud: "Geachte {{klant.naam}}," });
    const na = await getTekstenH(ctx, { id });
    expect(na.vastgelegd).toBe(true);
    expect(na.teksten.inleiding).toContain("Beste Jan de Vries,");

    // Terug naar voorcalculatie: weer live
    await updateStatusH(ctx, { id, status: "voorcalculatie" });
    expect(db.byId(id)!.tekstenVastgelegd).toBeUndefined();
  });

  it("de geldigheid komt uit de instellingen", async () => {
    await laadStandaard(ctx, {});
    await db.patch(instellingenId, { offerteGeldigheidDagen: 1 });
    const id = await nieuweOfferte();
    const { teksten } = await getTekstenH(ctx, { id });
    const morgen = new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleDateString("nl-NL", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Europe/Amsterdam",
    });
    expect(teksten.afsluiting).toContain(`geldig tot ${morgen}`);
  });
});
