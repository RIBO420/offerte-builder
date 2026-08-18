// @vitest-environment node
/**
 * Offerte-entree (masterplan A3 + A6): klant optioneel bij concept, nummer
 * server-side.
 *
 * Twee gedragsveranderingen die samen één belofte waarmaken — "klik → leeg
 * document" — zonder de rest van de keten te verzwakken:
 *
 *   1. `offertes.create` mag zónder klant en zónder offertenummer. Het nummer
 *      wordt binnen de mutation gereserveerd (Convex serialiseert mutations,
 *      dus geen raceconditie meer tussen ophalen en aanmaken).
 *   2. Zodra de offerte de conceptfase verlaat (voorcalculatie, verzonden,
 *      geaccepteerd, afgewezen) is een complete klant keihard verplicht —
 *      inclusief de bulk-route, die anders een sluiproute zou zijn.
 *
 * `convex-test` is in dit project niet geïnstalleerd; net als de andere
 * convex-tests draaien we de handlers direct tegen een in-memory nep-ctx. De
 * handler zit op `_handler` van de geregistreerde mutation — dat veld staat
 * niet in de types, vandaar de casts.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { ConvexError } from "convex/values";
import {
  create,
  koppelKlant,
  updateStatus,
  bulkUpdateStatus,
} from "../../../../convex/offertes";
import { createOfferteFromTemplate } from "../../../../convex/standaardtuinen";
import {
  GEEN_KLANT_LABEL,
  isKlantCompleet,
  klantNaam,
  klantVeld,
  klantOntbreektMelding,
  statusVereistKlant,
  assertKlantVoorStatus,
} from "../../../../convex/lib/offerteKlant";
import { formatteerOfferteNummer } from "../../../../convex/lib/offerteNummer";

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
const koppelKlantH = handlerVan<Record<string, unknown>, string>(koppelKlant);
const updateStatusH = handlerVan<Record<string, unknown>, string>(updateStatus);
const bulkUpdateStatusH = handlerVan<Record<string, unknown>, number>(bulkUpdateStatus);
const uitTemplate = handlerVan<Record<string, unknown>, string>(createOfferteFromTemplate);

/** Vangt de ConvexError van een handler, zodat we de melding kunnen lezen. */
async function vangFout(belofte: Promise<unknown>): Promise<ConvexError<string>> {
  const fout = await belofte.then(
    () => null,
    (e: unknown) => e as ConvexError<string>
  );
  if (!fout) throw new Error("Verwachtte een ConvexError, maar de handler slaagde");
  return fout;
}

const JAAR = new Date().getFullYear();
const VOLLEDIGE_KLANT = {
  naam: "Familie Jansen",
  adres: "Dorpsstraat 1",
  postcode: "1234 AB",
  plaats: "Ede",
};

let db: FakeDb;
let ctx: FakeCtx;
let orgId: string;
let userId: string;
let scheduled: number;

const CLERK_ORG_ID = "org_top_tuinen";

beforeEach(() => {
  db = new FakeDb();
  scheduled = 0;
  orgId = db.insertSync("organisaties", {
    clerkOrgId: CLERK_ORG_ID,
    naam: "Top Tuinen",
    slug: "top-tuinen",
    actief: true,
    aangemaaktOp: Date.now(),
  });
  userId = db.insertSync("users", {
    clerkId: "clerk_staf",
    email: "directie@toptuinen.nl",
    name: "Directie",
    role: "directie",
    createdAt: Date.now(),
  });
  db.insertSync("instellingen", {
    userId,
    orgId,
    offerteNummerPrefix: "OFF-",
    laatsteOfferteNummer: 0,
  });
  ctx = {
    db,
    auth: {
      getUserIdentity: async () => ({
        subject: "clerk_staf",
        org_id: CLERK_ORG_ID,
      }),
    },
    scheduler: {
      runAfter: async () => {
        scheduled += 1;
      },
    },
  };
});

function seedKlant(over: Record<string, unknown> = {}): string {
  return db.insertSync("klanten", {
    userId,
    orgId,
    naam: "Familie Jansen",
    adres: "Dorpsstraat 1",
    postcode: "1234 AB",
    plaats: "Ede",
    email: "jansen@example.nl",
    telefoon: "0612345678",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...over,
  });
}

// ─── 1. Concept zonder klant aanmaken ────────────────────────────────────────

describe("offertes.create — concept zonder klant (masterplan A3)", () => {
  it("maakt een concept aan zonder klant en zonder meegegeven nummer", async () => {
    const id = await createOfferte(ctx, {
      type: "aanleg",
      algemeenParams: { bereikbaarheid: "goed" },
      bron: "vrij",
    });

    const offerte = db.byId(id)!;
    expect(offerte.status).toBe("concept");
    expect(offerte.klant).toBeUndefined();
    expect(offerte.klantId).toBeUndefined();
    expect(offerte.bron).toBe("vrij");
    // Tenant-scope: de offerte hangt aan de organisatie uit het JWT
    // (userId blijft tot fase 6 meegeschreven)
    expect(offerte.orgId).toBe(orgId);
    expect(offerte.userId).toBe(userId);
    // TT-004: exact twee types, geen nieuwe literals
    expect(offerte.type).toBe("aanleg");
  });

  it("reserveert het offertenummer server-side en hoogt de teller op", async () => {
    const id = await createOfferte(ctx, {
      type: "onderhoud",
      algemeenParams: { bereikbaarheid: "goed" },
    });

    expect(db.byId(id)!.offerteNummer).toBe(`OFF-${JAAR}-001`);
    const instellingen = db.rows("instellingen")[0];
    expect(instellingen.laatsteOfferteNummer).toBe(1);
  });

  it("geeft elke create een uniek nummer (nummer-uniciteit bij snel opeenvolgende creates)", async () => {
    const ids = [];
    for (let i = 0; i < 5; i++) {
      ids.push(
        await createOfferte(ctx, {
          type: "aanleg",
          algemeenParams: { bereikbaarheid: "goed" },
        })
      );
    }

    const nummers = ids.map((id) => db.byId(id)!.offerteNummer as string);
    expect(new Set(nummers).size).toBe(5);
    expect(nummers).toEqual([
      `OFF-${JAAR}-001`,
      `OFF-${JAAR}-002`,
      `OFF-${JAAR}-003`,
      `OFF-${JAAR}-004`,
      `OFF-${JAAR}-005`,
    ]);
  });

  it("slaat een nummer over dat al in gebruik is (bijv. handmatig meegegeven)", async () => {
    // Client geeft zelf OFF-JAAR-001 mee terwijl de teller nog op 0 staat
    await createOfferte(ctx, {
      type: "aanleg",
      offerteNummer: `OFF-${JAAR}-001`,
      klant: VOLLEDIGE_KLANT,
      algemeenParams: { bereikbaarheid: "goed" },
    });

    const id = await createOfferte(ctx, {
      type: "aanleg",
      algemeenParams: { bereikbaarheid: "goed" },
    });

    expect(db.byId(id)!.offerteNummer).toBe(`OFF-${JAAR}-002`);
  });

  it("neemt de klantgegevens over uit het dossier als alleen klantId meekomt", async () => {
    const klantId = seedKlant();
    const id = await createOfferte(ctx, {
      type: "aanleg",
      klantId,
      algemeenParams: { bereikbaarheid: "goed" },
    });

    const offerte = db.byId(id)!;
    expect(offerte.klantId).toBe(klantId);
    expect(offerte.klant).toMatchObject(VOLLEDIGE_KLANT);
  });

  it("legt versie 1 vast, ook zonder klant", async () => {
    await createOfferte(ctx, {
      type: "aanleg",
      algemeenParams: { bereikbaarheid: "goed" },
    });

    const versies = db.rows("offerte_versions");
    expect(versies).toHaveLength(1);
    expect(versies[0].versieNummer).toBe(1);
    expect(versies[0].orgId).toBe(orgId);
    expect((versies[0].snapshot as Record<string, unknown>).klant).toBeUndefined();
    expect(scheduled).toBeGreaterThan(0);
  });
});

// ─── 2. Statusovergang zonder klant weigert ──────────────────────────────────

describe("statusovergang zonder klant — harde guard", () => {
  async function conceptZonderKlant(over: Record<string, unknown> = {}) {
    return await createOfferte(ctx, {
      type: "aanleg",
      algemeenParams: { bereikbaarheid: "goed" },
      ...over,
    });
  }

  it("weigert concept → voorcalculatie met een nette Nederlandse ConvexError", async () => {
    const id = await conceptZonderKlant();

    await expect(
      updateStatusH(ctx, { id, status: "voorcalculatie" })
    ).rejects.toBeInstanceOf(ConvexError);

    // De melding bereikt de client (ConvexError.data), niet alleen het serverlog
    const fout = await vangFout(updateStatusH(ctx, { id, status: "voorcalculatie" }));
    expect(fout.data).toContain("Koppel eerst een klant");
    expect(fout.data).toContain("naam, adres, postcode en plaats");

    expect(db.byId(id)!.status).toBe("concept");
  });

  it("weigert ook de vrije route concept → verzonden", async () => {
    const id = await conceptZonderKlant({ bron: "vrij" });

    await expect(
      updateStatusH(ctx, { id, status: "verzonden" })
    ).rejects.toBeInstanceOf(ConvexError);
    expect(db.byId(id)!.status).toBe("concept");
  });

  it("noemt het ontbrekende veld bij een half ingevulde klant", async () => {
    const id = await conceptZonderKlant({
      klant: { naam: "Familie Jansen", adres: "", postcode: "1234 AB", plaats: "Ede" },
    });

    const fout = await vangFout(updateStatusH(ctx, { id, status: "voorcalculatie" }));
    expect(fout).toBeInstanceOf(ConvexError);
    expect(fout.data).toContain("onvolledig");
    expect(fout.data).toContain("adres");
  });

  it("laat bulkUpdateStatus geen sluiproute zijn", async () => {
    const id = await conceptZonderKlant();

    await expect(
      bulkUpdateStatusH(ctx, { ids: [id], status: "voorcalculatie" })
    ).rejects.toBeInstanceOf(ConvexError);
    expect(db.byId(id)!.status).toBe("concept");
  });

  it("laat de overgang wél door zodra de klant compleet is", async () => {
    const id = await conceptZonderKlant({ klant: VOLLEDIGE_KLANT });

    await updateStatusH(ctx, { id, status: "voorcalculatie" });

    expect(db.byId(id)!.status).toBe("voorcalculatie");
  });
});

// ─── 3. Klant koppelen ───────────────────────────────────────────────────────

describe("offertes.koppelKlant", () => {
  async function concept() {
    return await createOfferte(ctx, {
      type: "aanleg",
      algemeenParams: { bereikbaarheid: "goed" },
      bron: "vrij",
    });
  }

  it("koppelt een klant uit het dossier en maakt de statusovergang mogelijk", async () => {
    const id = await concept();
    const klantId = seedKlant();

    await koppelKlantH(ctx, { id, klantId });

    const offerte = db.byId(id)!;
    expect(offerte.klantId).toBe(klantId);
    expect(offerte.klant).toMatchObject(VOLLEDIGE_KLANT);

    await updateStatusH(ctx, { id, status: "voorcalculatie" });
    expect(db.byId(id)!.status).toBe("voorcalculatie");
  });

  it("wisselt van klant: de vorige koppeling verdwijnt", async () => {
    const id = await concept();
    const eerste = seedKlant();
    const tweede = seedKlant({ naam: "Bedrijf Bosman", plaats: "Barneveld" });

    await koppelKlantH(ctx, { id, klantId: eerste });
    await koppelKlantH(ctx, { id, klantId: tweede });

    const offerte = db.byId(id)!;
    expect(offerte.klantId).toBe(tweede);
    expect((offerte.klant as Record<string, string>).naam).toBe("Bedrijf Bosman");
  });

  it("accepteert losse klantgegevens zonder dossier en wist dan het klantId", async () => {
    const id = await concept();
    await koppelKlantH(ctx, { id, klantId: seedKlant() });

    await koppelKlantH(ctx, { id, klant: { ...VOLLEDIGE_KLANT, naam: "Losse klant" } });

    const offerte = db.byId(id)!;
    expect(offerte.klantId).toBeUndefined();
    expect((offerte.klant as Record<string, string>).naam).toBe("Losse klant");
  });

  it("ontkoppelt alleen op expliciet verzoek", async () => {
    const id = await concept();
    await koppelKlantH(ctx, { id, klantId: seedKlant() });

    await koppelKlantH(ctx, { id, ontkoppelen: true });

    expect(db.byId(id)!.klant).toBeUndefined();
    expect(db.byId(id)!.klantId).toBeUndefined();
  });

  it("weigert een lege aanroep", async () => {
    const id = await concept();
    await expect(koppelKlantH(ctx, { id })).rejects.toBeInstanceOf(ConvexError);
  });

  it("weigert wijzigen zodra de offerte verzonden is", async () => {
    const id = await createOfferte(ctx, {
      type: "aanleg",
      klant: VOLLEDIGE_KLANT,
      algemeenParams: { bereikbaarheid: "goed" },
      bron: "vrij",
    });
    await updateStatusH(ctx, { id, status: "verzonden" });

    await expect(
      koppelKlantH(ctx, { id, klantId: seedKlant() })
    ).rejects.toBeInstanceOf(ConvexError);
  });

  it("legt de klantwissel vast in de offertehistorie", async () => {
    const id = await concept();
    await koppelKlantH(ctx, { id, klantId: seedKlant() });

    const versies = db.rows("offerte_versions");
    expect(versies).toHaveLength(2); // versie 1 (aangemaakt) + de koppeling
    expect(versies[1].omschrijving).toContain("Klant gekoppeld");
  });
});

// ─── 4. Template → concept zonder klant ──────────────────────────────────────

describe("standaardtuinen.createOfferteFromTemplate", () => {
  function seedTemplate(over: Record<string, unknown> = {}): string {
    return db.insertSync("standaardtuinen", {
      userId,
      orgId,
      naam: "Standaard achtertuin",
      type: "aanleg",
      scopes: ["grondwerk", "bestrating"],
      defaultWaarden: { bestrating: { oppervlakte: 40 } },
      ...over,
    });
  }

  it("maakt een concept zonder klant, met scopes uit het sjabloon", async () => {
    const templateId = seedTemplate();

    const id = await uitTemplate(ctx, { templateId });

    const offerte = db.byId(id)!;
    expect(offerte.status).toBe("concept");
    expect(offerte.klant).toBeUndefined();
    expect(offerte.type).toBe("aanleg");
    // Sjabloon-offertes krijgen dezelfde tenant-scope als offertes.create
    expect(offerte.orgId).toBe(orgId);
    expect(offerte.scopes).toEqual(["grondwerk", "bestrating"]);
    expect(offerte.scopeData).toEqual({ bestrating: { oppervlakte: 40 } });
  });

  it("zet bron op 'wizard' en reserveert het nummer server-side", async () => {
    const id = await uitTemplate(ctx, { templateId: seedTemplate() });

    expect(db.byId(id)!.bron).toBe("wizard");
    expect(db.byId(id)!.offerteNummer).toBe(`OFF-${JAAR}-001`);
    expect(db.rows("instellingen")[0].laatsteOfferteNummer).toBe(1);
  });

  it("neemt het type onveranderd over uit het sjabloon (TT-004)", async () => {
    const id = await uitTemplate(ctx, {
      templateId: seedTemplate({ type: "onderhoud" }),
    });
    expect(db.byId(id)!.type).toBe("onderhoud");
  });

  it("kan meteen met een klant uit het dossier starten", async () => {
    const klantId = seedKlant();
    const id = await uitTemplate(ctx, { templateId: seedTemplate(), klantId });

    expect(db.byId(id)!.klantId).toBe(klantId);
    expect(db.byId(id)!.klant).toMatchObject(VOLLEDIGE_KLANT);
  });

  it("een sjabloon-offerte zonder klant komt niet verder dan concept", async () => {
    const id = await uitTemplate(ctx, { templateId: seedTemplate() });

    await expect(
      updateStatusH(ctx, { id, status: "voorcalculatie" })
    ).rejects.toBeInstanceOf(ConvexError);
  });

  it("legt versie 1 vast met verwijzing naar het sjabloon", async () => {
    await uitTemplate(ctx, { templateId: seedTemplate() });

    const versies = db.rows("offerte_versions");
    expect(versies).toHaveLength(1);
    expect(versies[0].omschrijving).toContain("Standaard achtertuin");
  });
});

// ─── 5. Pure guard-logica ────────────────────────────────────────────────────

describe("convex/lib/offerteKlant — pure logica", () => {
  it("alleen concept mag zonder klant", () => {
    expect(statusVereistKlant("concept")).toBe(false);
    for (const status of ["voorcalculatie", "definitief", "verzonden", "geaccepteerd", "afgewezen"]) {
      expect(statusVereistKlant(status)).toBe(true);
    }
  });

  it("isKlantCompleet eist vier gevulde velden", () => {
    expect(isKlantCompleet(undefined)).toBe(false);
    expect(isKlantCompleet({ ...VOLLEDIGE_KLANT })).toBe(true);
    expect(isKlantCompleet({ ...VOLLEDIGE_KLANT, postcode: "   " })).toBe(false);
  });

  it("klantNaam en klantVeld zijn null-veilig", () => {
    expect(klantNaam(undefined)).toBe(GEEN_KLANT_LABEL);
    expect(klantNaam(undefined, "Onbekend")).toBe("Onbekend");
    expect(klantNaam({ ...VOLLEDIGE_KLANT, naam: "  " })).toBe(GEEN_KLANT_LABEL);
    expect(klantVeld(undefined, "adres")).toBe("");
    expect(klantVeld({ ...VOLLEDIGE_KLANT }, "adres")).toBe("Dorpsstraat 1");
  });

  it("de melding benoemt de actie waar het op stukloopt", () => {
    expect(klantOntbreektMelding("verzonden", undefined, "OFF-2026-001")).toContain(
      "OFF-2026-001"
    );
    expect(klantOntbreektMelding("verzonden", undefined)).toContain("versturen");
    expect(klantOntbreektMelding("geaccepteerd", undefined)).toContain("geaccepteerd");
  });

  it("assertKlantVoorStatus laat concept altijd door", () => {
    expect(() => assertKlantVoorStatus({ klant: undefined }, "concept")).not.toThrow();
    expect(() => assertKlantVoorStatus({ klant: undefined }, "verzonden")).toThrow(
      ConvexError
    );
  });

  it("formatteerOfferteNummer houdt het bestaande formaat aan", () => {
    expect(formatteerOfferteNummer("OFF-", 2026, 7)).toBe("OFF-2026-007");
    expect(formatteerOfferteNummer("TT", 2026, 123)).toBe("TT2026-123");
  });
});
