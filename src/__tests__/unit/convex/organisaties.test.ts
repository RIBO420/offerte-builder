// @vitest-environment node
/**
 * Tests voor `convex/organisaties.ts` en de org-defaults-seed in
 * `convex/lib/orgDefaults.ts`.
 *
 * `maakOrganisatie` is de enige plek waar een tenant ontstaat: de prod-migratie
 * (fase 6/8) roept hem aan, en later het aanmaken van een whitelabel-klant. Hij
 * moet daarom in drie vormen idempotent zijn:
 *   1. tweede aanroep met hetzelfde clerkOrgId → geen tweede organisaties-rij;
 *   2. die tweede aanroep seedt ook niets opnieuw;
 *   3. is er al gemigreerde data (een instellingen-rij mét dit orgId), dan
 *      slaat de seed over — anders krijgt een gemigreerde organisatie er een
 *      complete set standaard-normuren en -producten bovenop.
 *
 * `convex-test` is in dit project niet geïnstalleerd; net als de andere
 * convex-tests draaien we de handlers direct tegen een in-memory nep-ctx. De
 * handler zit op `_handler` van de geregistreerde mutation/query — dat veld is
 * niet gepubliceerd in de types, vandaar de cast.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { maakOrganisatie, getCurrent } from "../../../../convex/organisaties";
import {
  DEFAULT_NORMUREN,
  DEFAULT_PRODUCTEN,
  seedOrgDefaults,
} from "../../../../convex/lib/orgDefaults";
import type { MutationCtx } from "../../../../convex/_generated/server";
import type { Id } from "../../../../convex/_generated/dataModel";

// ─── Nep-Convex-database ─────────────────────────────────────────────────────

interface FakeDoc {
  _id: string;
  _creationTime: number;
  [key: string]: unknown;
}

interface IndexQ {
  eq: (field: string, value: unknown) => IndexQ;
}

/** Query-builder die de index-constraints écht toepast. */
function createQueryBuilder(docs: FakeDoc[]) {
  let current = [...docs];

  const builder = {
    withIndex(_indexName: string, fn: (q: IndexQ) => IndexQ) {
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
    const doc: FakeDoc = { ...data, _id: id, _creationTime: Date.now() };
    const rows = this.tables.get(table) ?? [];
    rows.push(doc);
    this.tables.set(table, rows);
    return id;
  }

  rows(table: string): FakeDoc[] {
    return [...(this.tables.get(table) ?? [])];
  }

  query(table: string) {
    return createQueryBuilder(this.rows(table));
  }

  async insert(table: string, data: Record<string, unknown>): Promise<string> {
    return this.insertSync(table, data);
  }
}

interface FakeIdentity {
  subject: string;
  org_id?: string;
}

interface FakeCtx {
  db: FakeDb;
  auth: { getUserIdentity: () => Promise<FakeIdentity | null> };
}

type MaakOrganisatieArgs = {
  clerkOrgId: string;
  naam: string;
  slug?: string;
  eigenaarUserId: string;
  seedDefaults?: boolean;
};

const maakOrganisatieHandler = (
  maakOrganisatie as unknown as {
    _handler: (ctx: FakeCtx, args: MaakOrganisatieArgs) => Promise<string>;
  }
)._handler;

const getCurrentHandler = (
  getCurrent as unknown as {
    _handler: (ctx: FakeCtx, args: Record<string, never>) => Promise<FakeDoc>;
  }
)._handler;

let db: FakeDb;
let identity: FakeIdentity | null;
let ctx: FakeCtx;
let eigenaarUserId: string;

beforeEach(() => {
  db = new FakeDb();
  identity = null;
  ctx = {
    db,
    auth: { getUserIdentity: async () => identity },
  };
  eigenaarUserId = db.insertSync("users", {
    clerkId: "clerk_directie",
    email: "directie@toptuinen.nl",
    name: "Directie",
    role: "directie",
    createdAt: Date.now(),
  });
});

function maakTopTuinen(overrides: Partial<MaakOrganisatieArgs> = {}) {
  return maakOrganisatieHandler(ctx, {
    clerkOrgId: "org_top_tuinen",
    naam: "Top Tuinen",
    eigenaarUserId,
    ...overrides,
  });
}

// ─── Aanmaken ────────────────────────────────────────────────────────────────

describe("organisaties.maakOrganisatie — aanmaken", () => {
  it("maakt een actieve organisatie-rij met clerkOrgId, naam en aanmaakmoment", async () => {
    const voor = Date.now();

    const orgId = await maakTopTuinen({ slug: "top-tuinen" });

    const orgs = db.rows("organisaties");
    expect(orgs).toHaveLength(1);
    expect(orgs[0]._id).toBe(orgId);
    expect(orgs[0].clerkOrgId).toBe("org_top_tuinen");
    expect(orgs[0].naam).toBe("Top Tuinen");
    expect(orgs[0].slug).toBe("top-tuinen");
    expect(orgs[0].actief).toBe(true);
    expect(orgs[0].aangemaaktOp as number).toBeGreaterThanOrEqual(voor);
  });

  it("laat slug leeg als die niet is meegegeven", async () => {
    await maakTopTuinen();

    expect(db.rows("organisaties")[0].slug).toBeUndefined();
  });
});

// ─── Seed ────────────────────────────────────────────────────────────────────

describe("organisaties.maakOrganisatie — org-defaults", () => {
  it("seedt standaardinstellingen met orgId", async () => {
    const orgId = await maakTopTuinen();

    const instellingen = db.rows("instellingen");
    expect(instellingen).toHaveLength(1);
    expect(instellingen[0].orgId).toBe(orgId);
    expect(instellingen[0].uurtarief).toBe(45.0);
    expect(instellingen[0].standaardMargePercentage).toBe(15);
    expect(instellingen[0].btwPercentage).toBe(21);
    expect(instellingen[0].offerteNummerPrefix).toBe("OFF-");
    expect(instellingen[0].laatsteOfferteNummer).toBe(0);
  });

  it("seedt alle standaard-normuren en -producten met orgId", async () => {
    const orgId = await maakTopTuinen();

    const normuren = db.rows("normuren");
    const producten = db.rows("producten");
    expect(normuren).toHaveLength(DEFAULT_NORMUREN.length);
    expect(producten).toHaveLength(DEFAULT_PRODUCTEN.length);
    expect(normuren.every((n) => n.orgId === orgId)).toBe(true);
    expect(producten.every((p) => p.orgId === orgId)).toBe(true);
    expect(producten.every((p) => p.isActief === true)).toBe(true);
  });

  /**
   * Regressie voor de bug uit de dev-schouw (18 aug), gevonden bij het bouwen
   * van `convex/migrations/naarOrganisaties.ts`.
   *
   * `seedOrgDefaults` kijkt of er al een instellingen-rij MET dit orgId is —
   * niet of de eigenaar er al een heeft. Tijdens de migratie is dat verschil
   * fataal: de organisatie wordt aangemaakt vóórdat de instellingen-rij van de
   * eigenaar zijn orgId krijgt, dus zou de seed een tweede rij neerzetten en
   * klapt daarna élke `.unique()` op `instellingen.by_org`. Vandaar de
   * schakelaar; de migratie is de enige aanroeper die hem op false zet.
   */
  it("seedt niets als seedDefaults false is (de migratie-route)", async () => {
    const orgId = await maakTopTuinen({ seedDefaults: false });

    expect(db.rows("organisaties")).toHaveLength(1);
    expect(db.rows("organisaties")[0]._id).toBe(orgId);
    expect(db.rows("instellingen")).toHaveLength(0);
    expect(db.rows("normuren")).toHaveLength(0);
    expect(db.rows("producten")).toHaveLength(0);
  });

  it("seedt wél bij seedDefaults true en bij weglaten van de vlag", async () => {
    await maakTopTuinen({ seedDefaults: true });
    await maakOrganisatieHandler(ctx, {
      clerkOrgId: "org_tweede",
      naam: "Tweede",
      eigenaarUserId,
    });

    expect(db.rows("instellingen")).toHaveLength(2);
    expect(db.rows("normuren")).toHaveLength(DEFAULT_NORMUREN.length * 2);
  });

  it("legt de eigenaar vast op de organisatie zelf", async () => {
    const orgId = await maakTopTuinen();

    expect(db.rows("organisaties")[0]._id).toBe(orgId);
    expect(db.rows("organisaties")[0].eigenaarUserId).toBe(eigenaarUserId);

    // De gezaaide rijen dragen alleen nog de org-scope.
    for (const tabel of ["instellingen", "normuren", "producten"]) {
      expect(db.rows(tabel).every((doc) => doc.orgId === orgId)).toBe(true);
      expect(db.rows(tabel).every((doc) => doc.userId === undefined)).toBe(true);
    }
  });
});

// ─── Idempotentie ────────────────────────────────────────────────────────────

describe("organisaties.maakOrganisatie — idempotentie", () => {
  it("maakt geen tweede rij voor hetzelfde clerkOrgId en geeft het bestaande id terug", async () => {
    const eerste = await maakTopTuinen();

    const tweede = await maakTopTuinen({ naam: "Top Tuinen BV" });

    expect(tweede).toBe(eerste);
    expect(db.rows("organisaties")).toHaveLength(1);
    // De bestaande rij blijft ongewijzigd: dit is een aanmaak-, geen update-functie.
    expect(db.rows("organisaties")[0].naam).toBe("Top Tuinen");
  });

  it("seedt bij een tweede aanroep niets opnieuw", async () => {
    await maakTopTuinen();

    await maakTopTuinen();

    expect(db.rows("instellingen")).toHaveLength(1);
    expect(db.rows("normuren")).toHaveLength(DEFAULT_NORMUREN.length);
    expect(db.rows("producten")).toHaveLength(DEFAULT_PRODUCTEN.length);
  });

  it("slaat de seed over als er al gemigreerde data met dit orgId bestaat", async () => {
    // Situatie na de prod-migratie: de organisaties-rij is er nog niet, maar de
    // instellingen van de bestaande user zijn al van een orgId voorzien.
    const bestaandOrgId = db.insertSync("organisaties", {
      clerkOrgId: "org_gemigreerd",
      naam: "Gemigreerd",
      actief: true,
      aangemaaktOp: Date.now(),
    });
    db.insertSync("instellingen", {
      userId: eigenaarUserId,
      orgId: bestaandOrgId,
      uurtarief: 62.5,
      standaardMargePercentage: 22,
      btwPercentage: 21,
      bedrijfsgegevens: { naam: "Gemigreerd", adres: "", postcode: "", plaats: "" },
      offerteNummerPrefix: "TT-",
      laatsteOfferteNummer: 417,
    });
    db.insertSync("normuren", {
      userId: eigenaarUserId,
      orgId: bestaandOrgId,
      activiteit: "Eigen norm",
      scope: "grondwerk",
      normuurPerEenheid: 0.3,
      eenheid: "m²",
    });

    // Een tweede migratie-run gebruikt hetzelfde clerkOrgId.
    const orgId = await maakOrganisatieHandler(ctx, {
      clerkOrgId: "org_gemigreerd",
      naam: "Gemigreerd",
      eigenaarUserId,
    });

    expect(orgId).toBe(bestaandOrgId);
    expect(db.rows("instellingen")).toHaveLength(1);
    expect(db.rows("instellingen")[0].uurtarief).toBe(62.5);
    expect(db.rows("normuren")).toHaveLength(1);
    expect(db.rows("producten")).toHaveLength(0);
  });
});

// ─── seedOrgDefaults ─────────────────────────────────────────────────────────

describe("seedOrgDefaults", () => {
  /** De seed praat alleen met ctx.db; de nep-ctx volstaat. */
  function seed(orgId: string) {
    return seedOrgDefaults(
      ctx as unknown as MutationCtx,
      orgId as Id<"organisaties">
    );
  }

  it("seedt een lege organisatie en meldt dat er geseed is", async () => {
    const orgId = db.insertSync("organisaties", {
      clerkOrgId: "org_leeg",
      naam: "Leeg",
      actief: true,
      aangemaaktOp: Date.now(),
    });

    await expect(seed(orgId)).resolves.toBe(true);
    expect(db.rows("instellingen")).toHaveLength(1);
    expect(db.rows("producten")).toHaveLength(DEFAULT_PRODUCTEN.length);
  });

  it("slaat alles over zodra er al een instellingen-rij met dit orgId is", async () => {
    const orgId = db.insertSync("organisaties", {
      clerkOrgId: "org_gemigreerd",
      naam: "Gemigreerd",
      actief: true,
      aangemaaktOp: Date.now(),
    });
    db.insertSync("instellingen", {
      userId: eigenaarUserId,
      orgId,
      uurtarief: 62.5,
      standaardMargePercentage: 22,
      btwPercentage: 21,
      bedrijfsgegevens: { naam: "", adres: "", postcode: "", plaats: "" },
      offerteNummerPrefix: "TT-",
      laatsteOfferteNummer: 417,
    });

    await expect(seed(orgId)).resolves.toBe(false);
    expect(db.rows("instellingen")).toHaveLength(1);
    expect(db.rows("normuren")).toHaveLength(0);
    expect(db.rows("producten")).toHaveLength(0);
  });

  it("laat de instellingen van een ándere organisatie de seed niet blokkeren", async () => {
    const andereOrgId = db.insertSync("organisaties", {
      clerkOrgId: "org_ander",
      naam: "Ander Bedrijf",
      actief: true,
      aangemaaktOp: Date.now(),
    });
    db.insertSync("instellingen", {
      userId: eigenaarUserId,
      orgId: andereOrgId,
      uurtarief: 50,
      standaardMargePercentage: 15,
      btwPercentage: 21,
      bedrijfsgegevens: { naam: "", adres: "", postcode: "", plaats: "" },
      offerteNummerPrefix: "AB-",
      laatsteOfferteNummer: 0,
    });
    const eigenOrgId = db.insertSync("organisaties", {
      clerkOrgId: "org_eigen",
      naam: "Eigen",
      actief: true,
      aangemaaktOp: Date.now(),
    });

    await expect(seed(eigenOrgId)).resolves.toBe(true);
    expect(db.rows("instellingen")).toHaveLength(2);
    expect(
      db.rows("normuren").every((n) => n.orgId === eigenOrgId)
    ).toBe(true);
  });
});

// ─── getCurrent ──────────────────────────────────────────────────────────────

describe("organisaties.getCurrent", () => {
  it("geeft de organisatie van de ingelogde gebruiker terug", async () => {
    const orgId = await maakTopTuinen();
    identity = { subject: "clerk_directie", org_id: "org_top_tuinen" };

    const org = await getCurrentHandler(ctx, {});

    expect(org._id).toBe(orgId);
    expect(org.naam).toBe("Top Tuinen");
  });

  it("weigert een sessie zonder organisatie", async () => {
    await maakTopTuinen();
    identity = { subject: "clerk_directie" };

    await expect(getCurrentHandler(ctx, {})).rejects.toThrow(/organisatie/i);
  });

  it("weigert een verzoek zonder sessie", async () => {
    await maakTopTuinen();

    await expect(getCurrentHandler(ctx, {})).rejects.toThrow(/ingelogd/i);
  });
});
