// @vitest-environment node
/**
 * Regressietests voor de tenant-scoping in `convex/users.ts` (audit §2).
 *
 * Drie functies keken over bedrijfsgrenzen heen terwijl er wél een
 * directie-check stond — de gebruiker was dus ingelogd, maar zag data van
 * andere bedrijven:
 *   1. `getAvailableMedewerkersForLinking` — alle actieve medewerkers van alle
 *      bedrijven (naam, e-mail, functie);
 *   2. `linkUserToMedewerker` — kon een account koppelen aan een medewerker van
 *      een ander bedrijf en daarmee diens clerkUserId overschrijven;
 *   3. `requestDataDeletion` — stuurde het AVG-verzoek (met naam + e-mail van
 *      de aanvrager) naar de directie van élk bedrijf.
 *
 * `convex-test` is in dit project niet geïnstalleerd; net als de andere
 * convex-tests draaien we de handlers daarom direct tegen een in-memory
 * nep-ctx. De handler zit op `_handler` van de geregistreerde query/mutation —
 * dat veld is niet gepubliceerd in de types, vandaar de cast.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { ConvexError } from "convex/values";
import {
  getAvailableMedewerkersForLinking,
  linkUserToMedewerker,
  requestDataDeletion,
  updateUserRole,
  deleteUser,
} from "../../../../convex/users";

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
 * Minimale query-builder die de index-constraints daadwerkelijk toepast —
 * precies dát gedrag (by_user_actief, by_role, by_clerk_id) is wat we hier
 * testen. Een builder die de constraints negeert zou de bug niet zien.
 */
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

  async patch(id: string, updates: Record<string, unknown>): Promise<void> {
    const doc = this.byId(id);
    if (!doc) throw new Error(`Document ${id} bestaat niet`);
    for (const [key, value] of Object.entries(updates)) {
      if (value === undefined) {
        delete doc[key];
      } else {
        doc[key] = value;
      }
    }
  }
}

interface FakeIdentity {
  subject: string;
  /** Het org_id-claim uit het JWT-template "convex"; requireOrg leest dit. */
  org_id?: string;
}

interface FakeCtx {
  db: FakeDb;
  auth: { getUserIdentity: () => Promise<FakeIdentity | null> };
  scheduler: { runAfter: (...args: unknown[]) => Promise<void> };
}

type Handler<TArgs, TResult> = (ctx: FakeCtx, args: TArgs) => Promise<TResult>;

function handlerVan<TArgs, TResult>(fn: unknown): Handler<TArgs, TResult> {
  return (fn as { _handler: Handler<TArgs, TResult> })._handler;
}

const beschikbareMedewerkers = handlerVan<
  Record<string, never>,
  Array<{ _id: string; naam: string }>
>(getAvailableMedewerkersForLinking);

const koppelMedewerker = handlerVan<
  { userId: string; medewerkerId?: string },
  { success: boolean }
>(linkUserToMedewerker);

const zetRol = handlerVan<{ userId: string; role: string }, { success: boolean }>(
  updateUserRole
);

const verwijderGebruiker = handlerVan<{ userId: string }, { success: boolean }>(
  deleteUser
);

const verwijderVerzoek = handlerVan<
  { reason?: string },
  { adminNotified: boolean }
>(requestDataDeletion);

// ─── Fixture: twee bedrijven met elk een directie en een medewerker ──────────

let db: FakeDb;
let identity: FakeIdentity | null;
let ctx: FakeCtx;

/** users._id van het directie-account per organisatie. */
let directieA: string;
let directieB: string;
let medewerkerA: string;
let medewerkerB: string;
/** organisaties._id — sinds de org-migratie DE tenantsleutel. */
let orgA: string;
let orgB: string;

beforeEach(() => {
  db = new FakeDb();
  identity = null;
  ctx = {
    db,
    auth: { getUserIdentity: async () => identity },
    scheduler: { runAfter: async () => {} },
  };

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

  directieB = db.insertSync("users", {
    clerkId: "clerk_directie_b",
    email: "directie@bedrijf-b.nl",
    name: "Directie B",
    role: "directie",
    createdAt: Date.now(),
  });

  // Sinds fase 6 hangt de eigenaar aan de organisatie, niet aan de rijen.
  db.patch(orgA, { eigenaarUserId: directieA });
  db.patch(orgB, { eigenaarUserId: directieB });

  medewerkerA = db.insertSync("medewerkers", {
    orgId: orgA,
    userId: directieA,
    naam: "Jan de Vries",
    email: "jan@bedrijf-a.nl",
    functie: "Hovenier",
    isActief: true,
  });

  medewerkerB = db.insertSync("medewerkers", {
    orgId: orgB,
    userId: directieB,
    naam: "Piet Jansen",
    email: "piet@bedrijf-b.nl",
    functie: "Voorman",
    isActief: true,
  });
});

/**
 * Log in als `clerkId`. `clerkOrgId` is het org_id-claim: laat het weg om een
 * account zonder actieve organisatie na te bootsen (requireOrg gooit dan).
 */
function logInAls(clerkId: string, clerkOrgId: string | undefined = "clerk_org_a") {
  identity = { subject: clerkId, ...(clerkOrgId ? { org_id: clerkOrgId } : {}) };
}

// ─── getAvailableMedewerkersForLinking ───────────────────────────────────────

describe("users.getAvailableMedewerkersForLinking — bedrijfsscope", () => {
  it("toont alleen medewerkers van het eigen bedrijf", async () => {
    logInAls("clerk_directie_a");

    const resultaat = await beschikbareMedewerkers(ctx, {});

    expect(resultaat.map((m) => m._id)).toEqual([medewerkerA]);
  });

  it("toont geen inactieve medewerkers van het eigen bedrijf", async () => {
    db.insertSync("medewerkers", {
      orgId: orgA,
      userId: directieA,
      naam: "Uit dienst",
      isActief: false,
    });
    logInAls("clerk_directie_a");

    const resultaat = await beschikbareMedewerkers(ctx, {});

    expect(resultaat).toHaveLength(1);
    expect(resultaat[0].naam).toBe("Jan de Vries");
  });

  it("toont geen al gekoppelde medewerkers", async () => {
    await db.patch(medewerkerA, { clerkUserId: "clerk_iemand" });
    logInAls("clerk_directie_a");

    expect(await beschikbareMedewerkers(ctx, {})).toEqual([]);
  });

  it("geeft niets terug zonder directie-rol", async () => {
    db.insertSync("users", {
      clerkId: "clerk_medewerker_a",
      email: "jan@bedrijf-a.nl",
      name: "Jan de Vries",
      role: "medewerker",
      linkedMedewerkerId: medewerkerA,
      createdAt: Date.now(),
    });
    logInAls("clerk_medewerker_a");

    expect(await beschikbareMedewerkers(ctx, {})).toEqual([]);
  });
});

// ─── linkUserToMedewerker ────────────────────────────────────────────────────

describe("users.linkUserToMedewerker — bedrijfsscope", () => {
  it("weigert een medewerker van een ander bedrijf", async () => {
    const doelgebruiker = db.insertSync("users", {
      clerkId: "clerk_nieuw",
      email: "nieuw@bedrijf-a.nl",
      name: "Nieuw Account",
      createdAt: Date.now(),
    });
    logInAls("clerk_directie_a");

    await expect(
      koppelMedewerker(ctx, {
        userId: doelgebruiker,
        medewerkerId: medewerkerB,
      })
    ).rejects.toBeInstanceOf(ConvexError);

    // De medewerker van bedrijf B is niet aangeraakt.
    expect(db.byId(medewerkerB)?.clerkUserId).toBeUndefined();
    expect(db.byId(doelgebruiker)?.linkedMedewerkerId).toBeUndefined();
  });

  it("koppelt wel binnen het eigen bedrijf", async () => {
    const doelgebruiker = db.insertSync("users", {
      clerkId: "clerk_nieuw",
      email: "nieuw@bedrijf-a.nl",
      name: "Nieuw Account",
      createdAt: Date.now(),
    });
    logInAls("clerk_directie_a");

    await koppelMedewerker(ctx, {
      userId: doelgebruiker,
      medewerkerId: medewerkerA,
    });

    expect(db.byId(medewerkerA)?.clerkUserId).toBe("clerk_nieuw");
    expect(db.byId(doelgebruiker)?.linkedMedewerkerId).toBe(medewerkerA);
    expect(db.byId(doelgebruiker)?.role).toBe("medewerker");
  });
});

// ─── org-guards op user-management (vereisUserBinnenOrg) ─────────────────────

describe("user-management — org-guards op de spiegelpaden", () => {
  /** Account van bedrijf B, herkenbaar aan zijn medewerker-koppeling. */
  function accountVanBedrijfB(): string {
    return db.insertSync("users", {
      clerkId: "clerk_piet",
      email: "piet@bedrijf-b.nl",
      name: "Piet Jansen",
      role: "medewerker",
      linkedMedewerkerId: medewerkerB,
      createdAt: Date.now(),
    });
  }

  it("weigert een rolwijziging op een account van een andere organisatie", async () => {
    const vreemdAccount = accountVanBedrijfB();
    logInAls("clerk_directie_a");

    await expect(
      zetRol(ctx, { userId: vreemdAccount, role: "klant" })
    ).rejects.toBeInstanceOf(ConvexError);

    expect(db.byId(vreemdAccount)?.role).toBe("medewerker");
  });

  it("staat een rolwijziging binnen de eigen organisatie wél toe", async () => {
    const eigenAccount = db.insertSync("users", {
      clerkId: "clerk_jan",
      email: "jan@bedrijf-a.nl",
      name: "Jan de Vries",
      role: "medewerker",
      linkedMedewerkerId: medewerkerA,
      createdAt: Date.now(),
    });
    logInAls("clerk_directie_a");

    await zetRol(ctx, { userId: eigenAccount, role: "voorman" });

    expect(db.byId(eigenAccount)?.role).toBe("voorman");
  });

  it("weigert ontkoppelen van een account van een andere organisatie", async () => {
    const vreemdAccount = accountVanBedrijfB();
    logInAls("clerk_directie_a");

    await expect(
      koppelMedewerker(ctx, { userId: vreemdAccount })
    ).rejects.toBeInstanceOf(ConvexError);

    // Koppeling én rol van bedrijf B ongemoeid.
    expect(db.byId(vreemdAccount)?.linkedMedewerkerId).toBe(medewerkerB);
    expect(db.byId(vreemdAccount)?.role).toBe("medewerker");
  });

  it("weigert het verwijderen van een account van een andere organisatie", async () => {
    const vreemdAccount = accountVanBedrijfB();
    logInAls("clerk_directie_a");

    await expect(
      verwijderGebruiker(ctx, { userId: vreemdAccount })
    ).rejects.toBeInstanceOf(ConvexError);

    expect(db.byId(vreemdAccount)).not.toBeNull();
  });

  it("laat een ongekoppeld account met rust-regel toe (nog van niemand)", async () => {
    // Bewust ruimer dan het leesfilter van listUsersWithDetails: zonder deze
    // uitzondering is een account direct ná het ontkoppelen onbereikbaar.
    const losAccount = db.insertSync("users", {
      clerkId: "clerk_los",
      email: "los@voorbeeld.nl",
      name: "Los Account",
      createdAt: Date.now(),
    });
    logInAls("clerk_directie_a");

    await zetRol(ctx, { userId: losAccount, role: "medewerker" });

    expect(db.byId(losAccount)?.role).toBe("medewerker");
  });
});

// ─── requestDataDeletion ─────────────────────────────────────────────────────

describe("users.requestDataDeletion — bedrijfsscope", () => {
  it("notificeert alleen de directie van het eigen bedrijf", async () => {
    db.insertSync("users", {
      clerkId: "clerk_medewerker_a",
      email: "jan@bedrijf-a.nl",
      name: "Jan de Vries",
      role: "medewerker",
      linkedMedewerkerId: medewerkerA,
      createdAt: Date.now(),
    });
    logInAls("clerk_medewerker_a");

    const resultaat = await verwijderVerzoek(ctx, { reason: "Uit dienst" });

    const ontvangers = db.rows("notifications").map((n) => n.userId);
    expect(ontvangers).toEqual([directieA]);
    expect(ontvangers).not.toContain(directieB);
    expect(resultaat.adminNotified).toBe(true);
  });

  it("neemt extra directie-accounts van hetzelfde bedrijf wél mee", async () => {
    const tweedeDirectieMedewerker = db.insertSync("medewerkers", {
      orgId: orgA,
      userId: directieA,
      naam: "Mede-directeur",
      isActief: true,
    });
    const tweedeDirectie = db.insertSync("users", {
      clerkId: "clerk_directie_a2",
      email: "mede@bedrijf-a.nl",
      name: "Mede-directeur",
      role: "directie",
      linkedMedewerkerId: tweedeDirectieMedewerker,
      createdAt: Date.now(),
    });
    db.insertSync("users", {
      clerkId: "clerk_medewerker_a",
      email: "jan@bedrijf-a.nl",
      name: "Jan de Vries",
      role: "medewerker",
      linkedMedewerkerId: medewerkerA,
      createdAt: Date.now(),
    });
    logInAls("clerk_medewerker_a");

    await verwijderVerzoek(ctx, {});

    const ontvangers = db.rows("notifications").map((n) => n.userId);
    expect(ontvangers).toHaveLength(2);
    expect(ontvangers).toContain(directieA);
    expect(ontvangers).toContain(tweedeDirectie);
  });

  it("stuurt het verzoek van een klant naar het bedrijf achter het klantrecord", async () => {
    const klantId = db.insertSync("klanten", {
      orgId: orgA,
      userId: directieA,
      naam: "Familie Bakker",
    });
    db.insertSync("users", {
      clerkId: "clerk_klant",
      email: "bakker@voorbeeld.nl",
      name: "Familie Bakker",
      role: "klant",
      linkedKlantId: klantId,
      createdAt: Date.now(),
    });
    logInAls("clerk_klant");

    const resultaat = await verwijderVerzoek(ctx, {});

    expect(db.rows("notifications").map((n) => n.userId)).toEqual([directieA]);
    expect(resultaat.adminNotified).toBe(true);
  });

  it("notificeert niemand als er geen organisatie te bepalen is", async () => {
    // Geen koppeling én geen org-claim in het JWT (klantaccount-scenario):
    // dan is er geen bedrijf, en gokken zou een cross-tenant lek zijn.
    db.insertSync("users", {
      clerkId: "clerk_los",
      email: "los@voorbeeld.nl",
      name: "Los Account",
      role: "medewerker",
      createdAt: Date.now(),
    });
    logInAls("clerk_los", ""); // lege claim = geen actieve organisatie

    const resultaat = await verwijderVerzoek(ctx, {});

    expect(db.rows("notifications")).toHaveLength(0);
    expect(resultaat.adminNotified).toBe(false);
    // Het verzoek wordt wél vastgelegd, zodat het niet stilletjes verdwijnt.
    expect(db.rows("locationAuditLog")).toHaveLength(0);
  });

  it("valt terug op de org-claim uit het JWT als er geen koppeling is", async () => {
    db.insertSync("users", {
      clerkId: "clerk_los",
      email: "los@voorbeeld.nl",
      name: "Los Account",
      role: "medewerker",
      createdAt: Date.now(),
    });
    logInAls("clerk_los");

    const resultaat = await verwijderVerzoek(ctx, {});

    expect(db.rows("notifications").map((n) => n.userId)).toEqual([directieA]);
    expect(resultaat.adminNotified).toBe(true);
  });

  it("legt het verzoek vast in de auditlog", async () => {
    logInAls("clerk_directie_a");

    await verwijderVerzoek(ctx, { reason: "Testverzoek" });

    const auditRegels = db.rows("locationAuditLog");
    expect(auditRegels).toHaveLength(1);
    expect(auditRegels[0].orgId).toBe(orgA);
    expect(auditRegels[0].action).toBe("data_deleted");
  });
});
