// @vitest-environment node
/**
 * Regressietests voor `users.upsert` (audit §1 — account-overname).
 *
 * `upsert` was een publieke mutation die clerkId, e-mail en naam uit de
 * client-args haalde. Daarmee kon iedereen:
 *   1. via de e-mail-fallback het clerkId van een bestaand bedrijfsaccount
 *      laten overschrijven en dat account overnemen;
 *   2. zichzelf tot "directie" promoveren door een adres uit ADMIN_EMAILS
 *      mee te sturen.
 *
 * Deze tests borgen dat de identiteit uitsluitend uit het geverifieerde
 * Clerk-token komt, én dat de legitieme flows (eerste login met defaults,
 * dev/prod clerkId-wissel, ADMIN_EMAILS-promotie) intact blijven.
 *
 * `convex-test` is in dit project niet geïnstalleerd; net als de andere
 * convex-tests draaien we de handler daarom direct tegen een in-memory
 * nep-ctx. De handler zit op `_handler` van de geregistreerde mutation —
 * dat veld is niet gepubliceerd in de types, vandaar de cast.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { ConvexError } from "convex/values";
import { upsert } from "../../../../convex/users";

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

/**
 * Minimale query-builder. Anders dan de gedeelde mock in
 * `helpers/convex-mock.ts` past deze de index-constraints wél toe — precies
 * dát gedrag (by_clerk_id vs. by_email) is wat we hier testen.
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
    filter(fn: (q: FilterQ) => boolean) {
      current = current.filter((doc) =>
        fn({
          eq: (a, b) => a === b,
          field: (name) => doc[name],
        })
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
      if (value === undefined) {
        delete doc[key];
      } else {
        doc[key] = value;
      }
    }
  }
}

interface FakeIdentity {
  // Het Clerk-org-claim; `upsert` leidt er `users.orgId` uit af.
  org_id?: string;
  subject: string;
  email?: string;
  emailVerified?: boolean;
  name?: string;
  givenName?: string;
}

interface FakeCtx {
  db: FakeDb;
  auth: { getUserIdentity: () => Promise<FakeIdentity | null> };
}

type UpsertHandler = (
  ctx: FakeCtx,
  args: { bedrijfsnaam?: string }
) => Promise<string>;

const upsertHandler = (upsert as unknown as { _handler: UpsertHandler })._handler;

// Adres uit ADMIN_EMAILS in convex/users.ts
const ADMIN_EMAIL = "e2e-test@toptuinen.nl";

let db: FakeDb;
let identity: FakeIdentity | null;
let ctx: FakeCtx;

beforeEach(() => {
  db = new FakeDb();
  identity = null;
  ctx = {
    db,
    auth: { getUserIdentity: async () => identity },
  };
});

function seedUser(overrides: Record<string, unknown> = {}): string {
  return db.insertSync("users", {
    clerkId: "clerk_bestaand",
    email: "directie@toptuinen.nl",
    name: "Bestaande Directie",
    role: "directie",
    createdAt: Date.now(),
    ...overrides,
  });
}

// ─── Auth ────────────────────────────────────────────────────────────────────

describe("users.upsert — auth", () => {
  it("weigert zonder Clerk-identiteit", async () => {
    await expect(upsertHandler(ctx, {})).rejects.toBeInstanceOf(ConvexError);
    expect(db.rows("users")).toHaveLength(0);
  });

  it("accepteert geen identiteitsvelden meer als argument", () => {
    const exported = (
      upsert as unknown as { exportArgs: () => string }
    ).exportArgs();

    expect(exported).toContain("bedrijfsnaam");
    expect(exported).not.toContain("clerkId");
    expect(exported).not.toContain("email");
    expect(exported).not.toContain("name");
  });
});

// ─── Account-overname ────────────────────────────────────────────────────────

describe("users.upsert — account-overname", () => {
  it("laat gebruiker A het clerkId van gebruiker B niet overschrijven", async () => {
    const slachtofferId = seedUser({
      clerkId: "clerk_slachtoffer",
      email: "b@toptuinen.nl",
    });

    // Aanvaller logt in met zijn eigen Clerk-account. Vroeger kon hij het
    // e-mailadres van het slachtoffer meesturen; nu telt alleen het token.
    identity = {
      subject: "clerk_aanvaller",
      email: "a@example.com",
      name: "Aanvaller",
    };

    const resultaatId = await upsertHandler(ctx, {});

    expect(resultaatId).not.toBe(slachtofferId);

    const slachtoffer = db.byId(slachtofferId);
    expect(slachtoffer?.clerkId).toBe("clerk_slachtoffer");
    expect(slachtoffer?.email).toBe("b@toptuinen.nl");

    const aanvaller = db.byId(resultaatId);
    expect(aanvaller?.clerkId).toBe("clerk_aanvaller");
    expect(aanvaller?.email).toBe("a@example.com");
  });

  it("koppelt niet aan een account zonder e-mailadres als de claim ontbreekt", async () => {
    // Een user met een lege e-mail mag geen magneet worden voor iedereen
    // wiens token geen e-mailclaim bevat.
    const zonderEmailId = seedUser({ clerkId: "clerk_zonder", email: "" });

    identity = { subject: "clerk_nieuw", name: "Nieuw" };

    const resultaatId = await upsertHandler(ctx, {});

    expect(resultaatId).not.toBe(zonderEmailId);
    expect(db.byId(zonderEmailId)?.clerkId).toBe("clerk_zonder");
  });

  it("erft geen bestaand account op basis van het e-mailadres", async () => {
    // Realistisch pad zonder Clerk-truc: een vertrokken directielid wordt in
    // Clerk verwijderd, het bedrijf hergebruikt het adres voor een nieuwe
    // medewerker. Die mag NIET op de oude rij (met rol directie) landen.
    const oudeDirectieId = seedUser({
      clerkId: "clerk_vertrokken",
      email: "directie@toptuinen.nl",
      role: "directie",
    });

    identity = {
      subject: "clerk_opvolger",
      email: "directie@toptuinen.nl",
      emailVerified: true,
      name: "Opvolger",
    };

    const resultaatId = await upsertHandler(ctx, {});

    expect(resultaatId).not.toBe(oudeDirectieId);
    expect(db.byId(resultaatId)?.role).toBe("medewerker");
    expect(db.byId(oudeDirectieId)?.clerkId).toBe("clerk_vertrokken");
    expect(db.byId(oudeDirectieId)?.role).toBe("directie");
  });

  it("kiest deterministisch bij twee rijen met hetzelfde e-mailadres", async () => {
    // De oude by_email-fallback gebruikte `.first()` terwijl het schema geen
    // uniciteit afdwingt: de insertievolgorde bepaalde welk account werd
    // overgenomen. Nu speelt e-mail geen rol meer bij het opzoeken.
    seedUser({ clerkId: "clerk_een", email: "dubbel@toptuinen.nl" });
    seedUser({ clerkId: "clerk_twee", email: "dubbel@toptuinen.nl" });

    identity = {
      subject: "clerk_derde",
      email: "dubbel@toptuinen.nl",
      emailVerified: true,
    };

    const resultaatId = await upsertHandler(ctx, {});
    expect(db.byId(resultaatId)?.clerkId).toBe("clerk_derde");
    expect(db.rows("users")).toHaveLength(3);
  });
});

// ─── Rolbepaling ─────────────────────────────────────────────────────────────

describe("users.upsert — rolbepaling", () => {
  it("geeft een niet-admin geen directie-rol", async () => {
    seedUser(); // zorgt dat de nieuwe user niet de eerste is

    identity = {
      subject: "clerk_medewerker",
      email: "medewerker@example.com",
      name: "Medewerker",
    };

    const userId = await upsertHandler(ctx, {});
    expect(db.byId(userId)?.role).toBe("medewerker");
  });

  it("promoveert een bestaande user niet op basis van een vreemd e-mailadres", async () => {
    const bestaandeId = seedUser({
      clerkId: "clerk_medewerker",
      email: "medewerker@example.com",
      role: "medewerker",
    });

    identity = {
      subject: "clerk_medewerker",
      email: "medewerker@example.com",
      name: "Medewerker",
    };

    await upsertHandler(ctx, {});
    expect(db.byId(bestaandeId)?.role).toBe("medewerker");
  });

  it("promoveert wél als het token-adres in ADMIN_EMAILS staat", async () => {
    seedUser();
    const adminId = seedUser({
      clerkId: "clerk_admin",
      email: ADMIN_EMAIL,
      role: "medewerker",
    });

    identity = { subject: "clerk_admin", email: ADMIN_EMAIL, name: "E2E" };

    await upsertHandler(ctx, {});
    expect(db.byId(adminId)?.role).toBe("directie");
  });

  it("promoveert niet op een adres dat Clerk niet geverifieerd heeft", async () => {
    seedUser();
    const adminId = seedUser({
      clerkId: "clerk_onbevestigd",
      email: "nog-leeg@toptuinen.nl",
      role: "medewerker",
    });

    identity = {
      subject: "clerk_onbevestigd",
      email: ADMIN_EMAIL,
      emailVerified: false,
      name: "Onbevestigd",
    };

    await upsertHandler(ctx, {});
    expect(db.byId(adminId)?.role).toBe("medewerker");
    // Een onbevestigd adres wordt ook niet opgeslagen.
    expect(db.byId(adminId)?.email).toBe("nog-leeg@toptuinen.nl");
  });

  it("herkent ADMIN_EMAILS ook met hoofdletters in de claim", async () => {
    // isAdminEmail vergelijkt case-insensitief; het adres wordt genormaliseerd
    // opgeslagen zodat de by_email-index elders deterministisch matcht.
    seedUser(); // zorgt dat de nieuwe user niet de eerste is
    identity = {
      subject: "clerk_hoofdletters",
      email: ADMIN_EMAIL.toUpperCase(),
      emailVerified: true,
      name: "E2E",
    };

    const userId = await upsertHandler(ctx, {});
    expect(db.byId(userId)?.role).toBe("directie");
    expect(db.byId(userId)?.email).toBe(ADMIN_EMAIL);
  });
});

// ─── Legitieme flows ─────────────────────────────────────────────────────────

describe("users.upsert — legitieme flows", () => {
  it("maakt bij de eerste login een medewerker-user aan zónder tenant-bootstrap", async () => {
    // Sinds de Clerk-Organizations-migratie is upsert géén tenant-bootstrap
    // meer: een nieuwe user krijgt geen eigen instellingen/normuren/producten
    // (die horen bij een organisatie, via organisaties.maakOrganisatie +
    // seedOrgDefaults) en ook de allereerste user is gewoon "medewerker".
    // Toegang loopt via Clerk-org-lidmaatschap.
    identity = {
      subject: "clerk_eerste",
      email: "eerste@toptuinen.nl",
      name: "Eerste Gebruiker",
    };

    const userId = await upsertHandler(ctx, { bedrijfsnaam: "Top Tuinen" });

    const user = db.byId(userId);
    expect(user?.clerkId).toBe("clerk_eerste");
    expect(user?.email).toBe("eerste@toptuinen.nl");
    expect(user?.name).toBe("Eerste Gebruiker");
    expect(user?.bedrijfsnaam).toBe("Top Tuinen");
    expect(user?.role).toBe("medewerker");

    // Geen tenant-seed meer.
    expect(db.rows("instellingen")).toHaveLength(0);
    expect(db.rows("normuren")).toHaveLength(0);
    expect(db.rows("producten")).toHaveLength(0);

    // De systeem-correctiefactoren zijn wél gedeeld en blijven staan.
    expect(db.rows("correctiefactoren").length).toBeGreaterThan(0);
  });

  it("geeft ook de allereerste user géén directie-rol", async () => {
    // De oude first-user-→-directie-regel is weg; alleen ADMIN_EMAILS promoveert.
    expect(db.rows("users")).toHaveLength(0);

    identity = {
      subject: "clerk_solo",
      email: "solo@toptuinen.nl",
      emailVerified: true,
      name: "Solo",
    };

    const userId = await upsertHandler(ctx, {});
    expect(db.byId(userId)?.role).toBe("medewerker");
  });

  it("promoveert de allereerste user wél als hij in ADMIN_EMAILS staat", async () => {
    identity = { subject: "clerk_admin_eerste", email: ADMIN_EMAIL, name: "E2E" };

    const userId = await upsertHandler(ctx, {});
    expect(db.byId(userId)?.role).toBe("directie");
  });

  it("valt terug op givenName en daarna op 'Gebruiker'", async () => {
    identity = { subject: "clerk_a", email: "a@toptuinen.nl", givenName: "Ans" };
    expect(db.byId(await upsertHandler(ctx, {}))?.name).toBe("Ans");

    identity = { subject: "clerk_b", email: "b@toptuinen.nl" };
    expect(db.byId(await upsertHandler(ctx, {}))?.name).toBe("Gebruiker");
  });

  it("wist geen bestaande gegevens als de claims ontbreken", async () => {
    // ctx.db.patch VERWIJDERT velden met waarde undefined. Een upsert zonder
    // e-mail-/naamclaim (of zonder bedrijfsnaam-argument) mag daarom niets
    // aanraken — anders sloopt elke pagina-load het account: setUserRole zoekt
    // op e-mail en linkKlantAccount vergelijkt e-mailadressen.
    const bestaandeId = seedUser({
      clerkId: "clerk_kaal",
      email: "kaal@toptuinen.nl",
      name: "Zelfgekozen Naam",
      bedrijfsnaam: "Top Tuinen",
    });

    identity = { subject: "clerk_kaal" };

    const userId = await upsertHandler(ctx, {});

    expect(userId).toBe(bestaandeId);
    const user = db.byId(bestaandeId);
    expect(user?.email).toBe("kaal@toptuinen.nl");
    expect(user?.name).toBe("Zelfgekozen Naam");
    expect(user?.bedrijfsnaam).toBe("Top Tuinen");
  });

  it("draait een via updateProfile gekozen naam niet terug", async () => {
    const bestaandeId = seedUser({
      clerkId: "clerk_naam",
      email: "naam@toptuinen.nl",
      name: "Zelfgekozen Naam",
    });

    identity = {
      subject: "clerk_naam",
      email: "naam@toptuinen.nl",
      emailVerified: true,
      name: "Clerk Volledige Naam",
    };

    await upsertHandler(ctx, {});
    expect(db.byId(bestaandeId)?.name).toBe("Zelfgekozen Naam");
  });

  it("wist de bedrijfsnaam niet bij een herhaalde upsert zonder argument", async () => {
    // De retry-lus in portaal/koppelen roept upsert meermaals aan op een dan
    // al bestaande user.
    identity = {
      subject: "clerk_retry",
      email: "retry@toptuinen.nl",
      emailVerified: true,
      name: "Retry",
    };

    const userId = await upsertHandler(ctx, { bedrijfsnaam: "Top Tuinen" });
    await upsertHandler(ctx, {});

    expect(db.byId(userId)?.bedrijfsnaam).toBe("Top Tuinen");
  });

  it("synchroniseert een gewijzigd e-mailadres uit het token", async () => {
    const bestaandeId = seedUser({
      clerkId: "clerk_verhuisd",
      email: "oud@toptuinen.nl",
    });

    identity = {
      subject: "clerk_verhuisd",
      email: "Nieuw@Toptuinen.nl",
      emailVerified: true,
    };

    await upsertHandler(ctx, {});
    expect(db.byId(bestaandeId)?.email).toBe("nieuw@toptuinen.nl");
  });

  it("is idempotent: een tweede login maakt geen tweede user aan", async () => {
    identity = {
      subject: "clerk_herhaald",
      email: "herhaald@toptuinen.nl",
      name: "Herhaald",
    };

    const eerste = await upsertHandler(ctx, {});
    const tweede = await upsertHandler(ctx, {});

    expect(tweede).toBe(eerste);
    expect(db.rows("users")).toHaveLength(1);
  });
});

// ─── Uitnodigings-koppeling ──────────────────────────────────────────────────

function seedMedewerker(overrides: Record<string, unknown> = {}): string {
  const now = Date.now();
  return db.insertSync("medewerkers", {
    userId: "users:seed",
    naam: "Uitgenodigde Medewerker",
    isActief: true,
    uitnodigingEmail: "nieuw@toptuinen.nl",
    uitnodigingRol: "voorman",
    uitnodigingStatus: "uitgenodigd",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });
}

describe("users.upsert — uitnodigings-koppeling", () => {
  it("koppelt een nieuwe user aan de medewerker die op dit adres is uitgenodigd", async () => {
    const medewerkerId = seedMedewerker();

    identity = {
      subject: "clerk_uitgenodigd",
      email: "Nieuw@Toptuinen.nl", // genormaliseerd matcht dit de uitnodiging
      emailVerified: true,
      name: "Nieuwe Medewerker",
    };

    const userId = await upsertHandler(ctx, {});

    expect(db.byId(medewerkerId)?.clerkUserId).toBe("clerk_uitgenodigd");
    expect(db.byId(medewerkerId)?.uitnodigingStatus).toBe("geaccepteerd");
    // Leeg werk-e-mailveld wordt gevuld met het geverifieerde token-adres.
    expect(db.byId(medewerkerId)?.email).toBe("nieuw@toptuinen.nl");
    expect(db.byId(userId)?.linkedMedewerkerId).toBe(medewerkerId);
    expect(db.byId(userId)?.role).toBe("voorman");
  });

  it("overschrijft een al ingevuld e-mailadres van de medewerker niet", async () => {
    const medewerkerId = seedMedewerker({ email: "prive@voorbeeld.nl" });

    identity = {
      subject: "clerk_eigen_adres",
      email: "nieuw@toptuinen.nl",
      emailVerified: true,
    };

    await upsertHandler(ctx, {});
    expect(db.byId(medewerkerId)?.email).toBe("prive@voorbeeld.nl");
  });

  it("valt terug op 'medewerker' als de uitnodiging geen rol draagt", async () => {
    const medewerkerId = seedMedewerker({ uitnodigingRol: undefined });

    identity = {
      subject: "clerk_zonder_rol",
      email: "nieuw@toptuinen.nl",
      emailVerified: true,
    };

    const userId = await upsertHandler(ctx, {});
    expect(db.byId(userId)?.linkedMedewerkerId).toBe(medewerkerId);
    expect(db.byId(userId)?.role).toBe("medewerker");
  });

  it("koppelt niet aan een medewerker die al een clerkUserId heeft", async () => {
    // Anders kon iemand met hetzelfde adres een reeds gekoppeld
    // medewerkersaccount overnemen — dezelfde overweging als de verwijderde
    // e-mail-fallback bovenin upsert.
    const medewerkerId = seedMedewerker({ clerkUserId: "clerk_al_gekoppeld" });

    identity = {
      subject: "clerk_indringer",
      email: "nieuw@toptuinen.nl",
      emailVerified: true,
    };

    const userId = await upsertHandler(ctx, {});

    expect(db.byId(medewerkerId)?.clerkUserId).toBe("clerk_al_gekoppeld");
    expect(db.byId(medewerkerId)?.uitnodigingStatus).toBe("uitgenodigd");
    expect(db.byId(userId)?.linkedMedewerkerId).toBeUndefined();
    expect(db.byId(userId)?.role).toBe("medewerker");
  });

  it("koppelt niet bij een ingetrokken of al geaccepteerde uitnodiging", async () => {
    const ingetrokkenId = seedMedewerker({
      uitnodigingEmail: "oud-adres@toptuinen.nl",
      uitnodigingStatus: "ingetrokken",
    });
    const geaccepteerdId = seedMedewerker({
      uitnodigingEmail: "oud-adres@toptuinen.nl",
      uitnodigingStatus: "geaccepteerd",
    });

    identity = {
      subject: "clerk_ingetrokken",
      email: "oud-adres@toptuinen.nl",
      emailVerified: true,
    };

    const userId = await upsertHandler(ctx, {});

    expect(db.byId(ingetrokkenId)?.clerkUserId).toBeUndefined();
    expect(db.byId(geaccepteerdId)?.clerkUserId).toBeUndefined();
    expect(db.byId(userId)?.linkedMedewerkerId).toBeUndefined();
  });

  it("degradeert een bestaande directie-user niet naar de uitgenodigde rol", async () => {
    // Een uitnodiging is een instapkaart, geen rolbeheerinstrument: koppelen
    // gebeurt wél, maar de bestaande (hogere) rol blijft staan.
    const directieId = seedUser({
      clerkId: "clerk_directie_uitgenodigd",
      email: "baas@toptuinen.nl",
      role: "directie",
    });
    const medewerkerId = seedMedewerker({
      uitnodigingEmail: "baas@toptuinen.nl",
      uitnodigingRol: "voorman",
    });

    identity = {
      subject: "clerk_directie_uitgenodigd",
      email: "baas@toptuinen.nl",
      emailVerified: true,
    };

    const userId = await upsertHandler(ctx, {});

    expect(userId).toBe(directieId);
    expect(db.byId(directieId)?.role).toBe("directie");
    expect(db.byId(directieId)?.linkedMedewerkerId).toBe(medewerkerId);
    expect(db.byId(medewerkerId)?.clerkUserId).toBe("clerk_directie_uitgenodigd");
    expect(db.byId(medewerkerId)?.uitnodigingStatus).toBe("geaccepteerd");
  });

  it("laat een ADMIN_EMAILS-promotie niet overschrijven door de uitnodiging", async () => {
    // De promotie gebeurt in dezelfde aanroep, vlak vóór de koppeling: de
    // rol-guard moet die verse "directie" al zien.
    const adminId = seedUser({
      clerkId: "clerk_admin_invite",
      email: ADMIN_EMAIL,
      role: "medewerker",
    });
    seedMedewerker({
      uitnodigingEmail: ADMIN_EMAIL,
      uitnodigingRol: "voorman",
    });

    identity = {
      subject: "clerk_admin_invite",
      email: ADMIN_EMAIL,
      emailVerified: true,
    };

    await upsertHandler(ctx, {});
    expect(db.byId(adminId)?.role).toBe("directie");
    expect(db.byId(adminId)?.linkedMedewerkerId).toBeDefined();
  });

  it("koppelt ook een bestaande user die later wordt uitgenodigd", async () => {
    const bestaandeId = seedUser({
      clerkId: "clerk_bestaand_lid",
      email: "later@toptuinen.nl",
      role: "medewerker",
      linkedMedewerkerId: undefined,
    });
    const medewerkerId = seedMedewerker({
      uitnodigingEmail: "later@toptuinen.nl",
      uitnodigingRol: "projectleider",
    });

    identity = {
      subject: "clerk_bestaand_lid",
      email: "later@toptuinen.nl",
      emailVerified: true,
    };

    const userId = await upsertHandler(ctx, {});

    expect(userId).toBe(bestaandeId);
    expect(db.byId(medewerkerId)?.clerkUserId).toBe("clerk_bestaand_lid");
    expect(db.byId(medewerkerId)?.uitnodigingStatus).toBe("geaccepteerd");
    expect(db.byId(bestaandeId)?.linkedMedewerkerId).toBe(medewerkerId);
    expect(db.byId(bestaandeId)?.role).toBe("projectleider");
  });

  it("herbindt een user die al aan een medewerker hangt niet stilzwijgend", async () => {
    const eerdereMedewerkerId = seedMedewerker({
      uitnodigingEmail: "ander@toptuinen.nl",
      uitnodigingStatus: "geaccepteerd",
    });
    const bestaandeId = seedUser({
      clerkId: "clerk_gekoppeld",
      email: "gekoppeld@toptuinen.nl",
      role: "medewerker",
      linkedMedewerkerId: eerdereMedewerkerId,
    });
    const nieuweMedewerkerId = seedMedewerker({
      uitnodigingEmail: "gekoppeld@toptuinen.nl",
      uitnodigingRol: "directie",
    });

    identity = {
      subject: "clerk_gekoppeld",
      email: "gekoppeld@toptuinen.nl",
      emailVerified: true,
    };

    await upsertHandler(ctx, {});

    expect(db.byId(bestaandeId)?.linkedMedewerkerId).toBe(eerdereMedewerkerId);
    expect(db.byId(bestaandeId)?.role).toBe("medewerker");
    expect(db.byId(nieuweMedewerkerId)?.clerkUserId).toBeUndefined();
    expect(db.byId(nieuweMedewerkerId)?.uitnodigingStatus).toBe("uitgenodigd");
  });

  it("koppelt niet op een adres dat Clerk niet geverifieerd heeft", async () => {
    const medewerkerId = seedMedewerker();

    identity = {
      subject: "clerk_onbevestigd_invite",
      email: "nieuw@toptuinen.nl",
      emailVerified: false,
    };

    const userId = await upsertHandler(ctx, {});

    expect(db.byId(medewerkerId)?.clerkUserId).toBeUndefined();
    expect(db.byId(userId)?.linkedMedewerkerId).toBeUndefined();
  });

  it("koppelt niets als de e-mailclaim ontbreekt", async () => {
    // Zonder guard zou q.eq("uitnodigingEmail", "") — of erger, undefined —
    // een willekeurige medewerkersrij kunnen matchen.
    const medewerkerId = seedMedewerker({ uitnodigingEmail: "" });

    identity = { subject: "clerk_zonder_claim" };

    const userId = await upsertHandler(ctx, {});

    expect(db.byId(medewerkerId)?.clerkUserId).toBeUndefined();
    expect(db.byId(userId)?.linkedMedewerkerId).toBeUndefined();
  });
});

// ─── Org-stempel (review v13, bevinding 1) ───────────────────────────────────

/**
 * `users.orgId` is sinds review v13 het bewijs dat een account bij een tenant
 * hoort: `convex/lib/taakPersonen.ts` leunt erop om te bepalen wie er in de
 * toewijs-selects van Mijn dag mag staan. Het stempel komt uit het
 * `org_id`-claim van het JWT en wordt hier gezet — bij aanmaken én bij elke
 * login waarin hij afwijkt.
 */
describe("users.upsert — org-stempel", () => {
  function seedOrganisatie(clerkOrgId: string, naam = "Top Tuinen"): string {
    return db.insertSync("organisaties", {
      clerkOrgId,
      naam,
      actief: true,
      aangemaaktOp: Date.now(),
    });
  }

  it("stempelt de organisatie uit het JWT op een nieuw account", async () => {
    const orgId = seedOrganisatie("org_toptuinen");
    identity = { subject: "clerk_nieuw", org_id: "org_toptuinen" };

    const userId = await upsertHandler(ctx, {});

    expect(db.byId(userId)?.orgId).toBe(orgId);
  });

  it("vult het stempel alsnog bij een volgende login", async () => {
    const orgId = seedOrganisatie("org_toptuinen");
    const bestaandeId = seedUser({ clerkId: "clerk_bestaand" });
    expect(db.byId(bestaandeId)?.orgId).toBeUndefined();

    identity = { subject: "clerk_bestaand", org_id: "org_toptuinen" };
    await upsertHandler(ctx, {});

    expect(db.byId(bestaandeId)?.orgId).toBe(orgId);
  });

  it("wist een bestaand stempel niet als de sessie geen org-claim heeft", async () => {
    const orgId = seedOrganisatie("org_toptuinen");
    const bestaandeId = seedUser({ clerkId: "clerk_bestaand", orgId });

    identity = { subject: "clerk_bestaand" };
    await upsertHandler(ctx, {});

    expect(db.byId(bestaandeId)?.orgId).toBe(orgId);
  });

  it("laat inloggen zonder organisatie gewoon slagen, zonder stempel", async () => {
    identity = { subject: "clerk_zwevend" };

    const userId = await upsertHandler(ctx, {});

    expect(db.byId(userId)).not.toBeNull();
    expect(db.byId(userId)?.orgId).toBeUndefined();
  });

  it("stempelt niets bij een onbekend of niet-tekstueel org-claim", async () => {
    seedOrganisatie("org_toptuinen");

    identity = { subject: "clerk_onbekend", org_id: "org_bestaat_niet" };
    const onbekendId = await upsertHandler(ctx, {});
    expect(db.byId(onbekendId)?.orgId).toBeUndefined();

    // Een niet-string claim mag nooit als string de index-query in glippen.
    identity = { subject: "clerk_rommel", org_id: 42 as unknown as string };
    const rommelId = await upsertHandler(ctx, {});
    expect(db.byId(rommelId)?.orgId).toBeUndefined();
  });
});
