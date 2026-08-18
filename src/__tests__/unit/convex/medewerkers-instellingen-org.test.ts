// @vitest-environment node
/**
 * Regressietests voor cluster 3.9 van de Clerk-Organizations-migratie:
 * `convex/medewerkers.ts`, `convex/instellingen.ts` en het org-besluit in
 * `users.listUsersWithDetails`.
 *
 * Wat hier bewaakt wordt:
 *   1. medewerkers leest en schrijft op `orgId`, niet meer op de userId van
 *      wie toevallig de rijen bezat (de oude, ad-hoc `getUserRole`);
 *   2. een veldrol ziet alleen het eigen profiel, een kantoorrol het hele
 *      bestand van de eigen organisatie — en nooit dat van een andere;
 *   3. `instellingen` hangt aan de organisatie: twee collega's delen één rij,
 *      inclusief de offertenummer-teller;
 *   4. `listUsersWithDetails` toont accounts van de eigen organisatie plus
 *      ongekoppelde niet-klantaccounts, en géén medewerker-accounts van een
 *      andere tenant.
 *
 * `convex-test` staat niet in dit project; net als de andere convex-tests
 * draaien we de handlers direct tegen een in-memory nep-ctx. De builder past
 * de index-constraints echt toe — een builder die ze negeert zou het verschil
 * tussen by_user en by_org niet zien, en dat is precies wat we testen.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { ConvexError } from "convex/values";
import {
  create as medewerkerCreate,
  list as medewerkerList,
  get as medewerkerGet,
  getActive as medewerkerGetActive,
  update as medewerkerUpdate,
  remove as medewerkerRemove,
} from "../../../../convex/medewerkers";
import {
  get as instellingenGet,
  createDefaults as instellingenCreateDefaults,
  getVeldInstellingen,
  previewNextOfferteNummer,
} from "../../../../convex/instellingen";
import { listUsersWithDetails } from "../../../../convex/users";

// ─── Nep-Convex-database ─────────────────────────────────────────────────────

interface FakeDoc {
  _id: string;
  _creationTime: number;
  [key: string]: unknown;
}

interface IndexQ {
  eq: (field: string, value: unknown) => IndexQ;
}

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

interface FakeIdentity {
  subject: string;
  org_id?: string;
}

interface FakeCtx {
  db: FakeDb;
  auth: { getUserIdentity: () => Promise<FakeIdentity | null> };
}

type Handler<TArgs, TResult> = (ctx: FakeCtx, args: TArgs) => Promise<TResult>;

function handlerVan<TArgs, TResult>(fn: unknown): Handler<TArgs, TResult> {
  return (fn as { _handler: Handler<TArgs, TResult> })._handler;
}

// ─── Fixture: twee organisaties ──────────────────────────────────────────────

let db: FakeDb;
let identity: FakeIdentity | null;
let ctx: FakeCtx;

let orgA: string;
let orgB: string;
let directieA: string;
let medewerkerRijA: string;
let medewerkerRijB: string;

beforeEach(() => {
  db = new FakeDb();
  identity = null;
  ctx = { db, auth: { getUserIdentity: async () => identity } };

  orgA = db.insertSync("organisaties", {
    clerkOrgId: "clerk_org_a",
    naam: "Bedrijf A",
    actief: true,
    aangemaaktOp: Date.now(),
  });
  orgB = db.insertSync("organisaties", {
    clerkOrgId: "clerk_org_b",
    naam: "Bedrijf B",
    actief: true,
    aangemaaktOp: Date.now(),
  });

  directieA = db.insertSync("users", {
    clerkId: "clerk_directie_a",
    email: "directie@bedrijf-a.nl",
    name: "Directie A",
    role: "directie",
    createdAt: Date.now(),
  });

  medewerkerRijA = db.insertSync("medewerkers", {
    orgId: orgA,
    userId: directieA,
    naam: "Jan de Vries",
    isActief: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  // LET OP — deze rij draagt bewust dezelfde `userId` als die van bedrijf A.
  // Dat is wat de tests laat bijten: op de oude `by_user`-index zou hij
  // gewoon meekomen in elke lijst van bedrijf A. Alleen `by_org` houdt hem
  // buiten. Zo'n gedeelde eigenaar-user is geen verzinsel: `userId` was vóór
  // de migratie het bedrijfsaccount en blijft na de migratie op de rijen staan.
  medewerkerRijB = db.insertSync("medewerkers", {
    orgId: orgB,
    userId: directieA,
    naam: "Piet Jansen",
    isActief: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
});

function logInAls(clerkId: string, clerkOrgId = "clerk_org_a") {
  identity = { subject: clerkId, org_id: clerkOrgId };
}

// ─── medewerkers ─────────────────────────────────────────────────────────────

const lijst = handlerVan<{ isActief?: boolean }, FakeDoc[]>(medewerkerList);
const actief = handlerVan<Record<string, never>, FakeDoc[]>(medewerkerGetActive);
const detail = handlerVan<{ id: string }, FakeDoc | null>(medewerkerGet);
const maak = handlerVan<{ naam: string }, string>(medewerkerCreate);
const werkBij = handlerVan<{ id: string; naam?: string }, string>(
  medewerkerUpdate
);
const zetInactief = handlerVan<{ id: string }, string>(medewerkerRemove);

describe("medewerkers — org-scoping", () => {
  it("kantoor ziet alleen medewerkers van de eigen organisatie", async () => {
    logInAls("clerk_directie_a");

    const resultaat = await lijst(ctx, {});

    expect(resultaat.map((m) => m._id)).toEqual([medewerkerRijA]);
  });

  it("getActive laat de medewerker van de andere organisatie weg", async () => {
    logInAls("clerk_directie_a");

    const resultaat = await actief(ctx, {});

    expect(resultaat.map((m) => m.naam)).toEqual(["Jan de Vries"]);
  });

  it("get geeft null voor een medewerker van een andere organisatie", async () => {
    logInAls("clerk_directie_a");

    expect(await detail(ctx, { id: medewerkerRijB })).toBeNull();
    expect(await detail(ctx, { id: medewerkerRijA })).not.toBeNull();
  });

  it("create zet orgId van de actieve organisatie op de nieuwe rij", async () => {
    logInAls("clerk_directie_a");

    const id = await maak(ctx, { naam: "Nieuwe Kracht" });

    expect(db.byId(id)?.orgId).toBe(orgA);
    expect(db.byId(id)?.userId).toBeUndefined();
  });

  it("update weigert een medewerker van een andere organisatie", async () => {
    logInAls("clerk_directie_a");

    await expect(
      werkBij(ctx, { id: medewerkerRijB, naam: "Gekaapt" })
    ).rejects.toBeInstanceOf(ConvexError);
    expect(db.byId(medewerkerRijB)?.naam).toBe("Piet Jansen");
  });

  it("remove weigert een medewerker van een andere organisatie", async () => {
    logInAls("clerk_directie_a");

    await expect(
      zetInactief(ctx, { id: medewerkerRijB })
    ).rejects.toBeInstanceOf(ConvexError);
    expect(db.byId(medewerkerRijB)?.isActief).toBe(true);
  });

  it("een veldrol ziet alleen het eigen profiel", async () => {
    db.insertSync("users", {
      clerkId: "clerk_jan",
      email: "jan@bedrijf-a.nl",
      name: "Jan de Vries",
      role: "medewerker",
      linkedMedewerkerId: medewerkerRijA,
      createdAt: Date.now(),
    });
    db.insertSync("medewerkers", {
      orgId: orgA,
      userId: directieA,
      naam: "Collega",
      isActief: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    logInAls("clerk_jan");

    const resultaat = await lijst(ctx, {});

    expect(resultaat.map((m) => m.naam)).toEqual(["Jan de Vries"]);
  });

  it("een veldrol mag geen medewerkers aanmaken", async () => {
    db.insertSync("users", {
      clerkId: "clerk_jan",
      email: "jan@bedrijf-a.nl",
      name: "Jan de Vries",
      role: "medewerker",
      linkedMedewerkerId: medewerkerRijA,
      createdAt: Date.now(),
    });
    logInAls("clerk_jan");

    await expect(maak(ctx, { naam: "Stiekem" })).rejects.toBeInstanceOf(
      ConvexError
    );
  });
});

// ─── instellingen ────────────────────────────────────────────────────────────

const instellingenLezen = handlerVan<Record<string, never>, FakeDoc | null>(
  instellingenGet
);
const instellingenZaaien = handlerVan<Record<string, never>, string>(
  instellingenCreateDefaults
);
const veldInstellingen = handlerVan<
  Record<string, never>,
  { afwijkingDrempelMinuten: number; noodprotocolTekst: string | null }
>(getVeldInstellingen);
const nummerVoorbeeld = handlerVan<Record<string, never>, string | null>(
  previewNextOfferteNummer
);

describe("instellingen — org-scoping", () => {
  it("leest de rij van de eigen organisatie, niet die van een andere", async () => {
    db.insertSync("instellingen", {
      orgId: orgA,
      userId: directieA,
      uurtarief: 45,
      standaardMargePercentage: 15,
      btwPercentage: 21,
      bedrijfsgegevens: { naam: "Bedrijf A", adres: "", postcode: "", plaats: "" },
      offerteNummerPrefix: "AAA-",
      laatsteOfferteNummer: 7,
    });
    // Zelfde eigenaar-userId als de rij van bedrijf A: op `by_user` zou
    // `.unique()` hier struikelen of de verkeerde rij teruggeven.
    db.insertSync("instellingen", {
      orgId: orgB,
      userId: directieA,
      uurtarief: 99,
      standaardMargePercentage: 15,
      btwPercentage: 21,
      bedrijfsgegevens: { naam: "Bedrijf B", adres: "", postcode: "", plaats: "" },
      offerteNummerPrefix: "BBB-",
      laatsteOfferteNummer: 300,
    });
    logInAls("clerk_directie_a");

    const resultaat = await instellingenLezen(ctx, {});

    expect(resultaat?.uurtarief).toBe(45);
  });

  it("createDefaults zaait één rij per organisatie en is idempotent", async () => {
    logInAls("clerk_directie_a");

    const eerste = await instellingenZaaien(ctx, {});
    const tweede = await instellingenZaaien(ctx, {});

    expect(eerste).toBe(tweede);
    expect(db.rows("instellingen")).toHaveLength(1);
    expect(db.rows("instellingen")[0].orgId).toBe(orgA);
  });

  it("een collega zonder eigen rij krijgt dezelfde bedrijfsinstellingen", async () => {
    db.insertSync("instellingen", {
      orgId: orgA,
      userId: directieA,
      uurtarief: 45,
      standaardMargePercentage: 15,
      btwPercentage: 21,
      bedrijfsgegevens: { naam: "Bedrijf A", adres: "", postcode: "", plaats: "" },
      offerteNummerPrefix: "AAA-",
      laatsteOfferteNummer: 7,
      veldInstellingen: { afwijkingDrempelMinuten: 25, noodprotocolTekst: "Bel 112" },
    });
    db.insertSync("users", {
      clerkId: "clerk_jan",
      email: "jan@bedrijf-a.nl",
      name: "Jan de Vries",
      role: "voorman",
      linkedMedewerkerId: medewerkerRijA,
      createdAt: Date.now(),
    });
    logInAls("clerk_jan");

    const veld = await veldInstellingen(ctx, {});

    expect(veld.afwijkingDrempelMinuten).toBe(25);
    expect(veld.noodprotocolTekst).toBe("Bel 112");
  });

  it("previewNextOfferteNummer telt door op de teller van de organisatie", async () => {
    db.insertSync("instellingen", {
      orgId: orgA,
      userId: directieA,
      uurtarief: 45,
      standaardMargePercentage: 15,
      btwPercentage: 21,
      bedrijfsgegevens: { naam: "Bedrijf A", adres: "", postcode: "", plaats: "" },
      offerteNummerPrefix: "AAA-",
      laatsteOfferteNummer: 7,
    });
    logInAls("clerk_directie_a");

    const jaar = new Date().getFullYear();
    expect(await nummerVoorbeeld(ctx, {})).toBe(`AAA-${jaar}-008`);
  });
});

// ─── users.listUsersWithDetails ──────────────────────────────────────────────

const accountLijst = handlerVan<
  Record<string, never>,
  Array<{ _id: string; email: string }>
>(listUsersWithDetails);

describe("users.listUsersWithDetails — org-besluit cluster 3.9", () => {
  it("toont eigen medewerker-accounts en ongekoppelde staf, niet die van een andere org", async () => {
    const eigenAccount = db.insertSync("users", {
      clerkId: "clerk_jan",
      email: "jan@bedrijf-a.nl",
      name: "Jan de Vries",
      role: "medewerker",
      linkedMedewerkerId: medewerkerRijA,
      createdAt: Date.now(),
    });
    const vreemdAccount = db.insertSync("users", {
      clerkId: "clerk_piet",
      email: "piet@bedrijf-b.nl",
      name: "Piet Jansen",
      role: "medewerker",
      linkedMedewerkerId: medewerkerRijB,
      createdAt: Date.now(),
    });
    const versAccount = db.insertSync("users", {
      clerkId: "clerk_vers",
      email: "vers@bedrijf-a.nl",
      name: "Vers Account",
      createdAt: Date.now(),
    });
    const losKlantAccount = db.insertSync("users", {
      clerkId: "clerk_klant",
      email: "klant@voorbeeld.nl",
      name: "Losse Klant",
      role: "klant",
      createdAt: Date.now(),
    });
    logInAls("clerk_directie_a");

    const ids = (await accountLijst(ctx, {})).map((u) => u._id);

    // directieA is ongekoppeld maar géén klant → zichtbaar, net als het verse
    // account dat nog gekoppeld moet worden.
    expect(ids).toContain(directieA);
    expect(ids).toContain(eigenAccount);
    expect(ids).toContain(versAccount);
    expect(ids).not.toContain(vreemdAccount);
    expect(ids).not.toContain(losKlantAccount);
  });

  it("geeft niets terug zonder directie-rol", async () => {
    db.insertSync("users", {
      clerkId: "clerk_jan",
      email: "jan@bedrijf-a.nl",
      name: "Jan de Vries",
      role: "medewerker",
      linkedMedewerkerId: medewerkerRijA,
      createdAt: Date.now(),
    });
    logInAls("clerk_jan");

    expect(await accountLijst(ctx, {})).toEqual([]);
  });
});
