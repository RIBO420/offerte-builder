// @vitest-environment node
/**
 * Tests voor `convex/team.ts` — het Team-scherm van de Clerk-Organizations-
 * migratie (taak 4.2).
 *
 * Het bestand doet drie dingen die stuk kunnen gaan:
 *   1. `listTeam` vertaalt de medewerkersrij + een eventueel gekoppeld account
 *      naar één `accountStatus` ("geen" | "uitgenodigd" | "actief"). Dat is de
 *      enige bron van waarheid voor de UI, dus alle drie de takken worden hier
 *      vastgelegd — inclusief de org-isolatie (by_org).
 *   2. `valideerUitnodiging` bewaakt de uniciteit van een uitnodigingsadres.
 *      `users.upsert` koppelt met `.first()`; wie hier twee openstaande
 *      uitnodigingen op hetzelfde adres doorlaat, laat de eerste inlog
 *      willekeurig een van beide medewerkers overnemen.
 *   3. De drie actions praten met de Clerk-API. Die fetch wordt gestubd —
 *      er gaat in een test nooit een echte call naar api.clerk.com.
 *
 * `convex-test` is in dit project niet geïnstalleerd; net als de andere
 * convex-tests draaien we de handlers direct tegen een in-memory nep-ctx. De
 * handler zit op `_handler` van de geregistreerde functie — dat veld is niet
 * gepubliceerd in de types, vandaar de cast. De nep-query-builder past de
 * index-constraints wél toe: juist dát gedrag (by_org, by_clerk_id,
 * by_uitnodiging_email, by_email) is wat de org-isolatie draagt.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ConvexError } from "convex/values";
import { getFunctionName } from "convex/server";
import {
  listTeam,
  stuurUitnodiging,
  valideerUitnodiging,
  registreerUitnodiging,
  trekUitnodigingIn,
  valideerIntrekking,
  registreerIntrekking,
  trekToegangIn,
  valideerToegangIntrekking,
  registreerToegangIntrekking,
} from "../../../../convex/team";

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
  subject: string;
  org_id?: string;
}

interface FakeCtx {
  db: FakeDb;
  auth: { getUserIdentity: () => Promise<FakeIdentity | null> };
}

// ─── Handlers ────────────────────────────────────────────────────────────────

type Handler<A, R> = (ctx: FakeCtx, args: A) => Promise<R>;

function handlerVan<A, R>(fn: unknown): Handler<A, R> {
  return (fn as { _handler: Handler<A, R> })._handler;
}

interface TeamRij {
  _id: string;
  naam: string;
  accountStatus: "geen" | "uitgenodigd" | "actief";
  account: { id: string; email: string; role?: string } | null;
}

const listTeamHandler = handlerVan<Record<string, never>, TeamRij[]>(listTeam);

interface UitnodigingArgs {
  medewerkerId: string;
  email: string;
  rol: string;
}

const valideerUitnodigingHandler = handlerVan<
  UitnodigingArgs,
  { clerkOrgId: string }
>(valideerUitnodiging);

const registreerUitnodigingHandler = handlerVan<
  UitnodigingArgs & { clerkInvitationId?: string },
  null
>(registreerUitnodiging);

const valideerIntrekkingHandler = handlerVan<
  { medewerkerId: string },
  { clerkOrgId: string; uitnodigingClerkId?: string }
>(valideerIntrekking);

const registreerIntrekkingHandler = handlerVan<{ medewerkerId: string }, null>(
  registreerIntrekking
);

const valideerToegangIntrekkingHandler = handlerVan<
  { medewerkerId: string },
  { clerkOrgId: string; clerkUserId: string }
>(valideerToegangIntrekking);

const registreerToegangIntrekkingHandler = handlerVan<
  { medewerkerId: string },
  null
>(registreerToegangIntrekking);

/**
 * Vertaalt een functiereferentie naar de bijbehorende nep-handler. De actions
 * roepen `ctx.runMutation(internal.team.…)` aan; `getFunctionName` geeft
 * "team:valideerUitnodiging" terug en daar hangen we de echte handler aan.
 */
const MUTATIE_HANDLERS: Record<string, Handler<never, unknown>> = {
  "team:valideerUitnodiging": valideerUitnodigingHandler as Handler<
    never,
    unknown
  >,
  "team:registreerUitnodiging": registreerUitnodigingHandler as Handler<
    never,
    unknown
  >,
  "team:valideerIntrekking": valideerIntrekkingHandler as Handler<
    never,
    unknown
  >,
  "team:registreerIntrekking": registreerIntrekkingHandler as Handler<
    never,
    unknown
  >,
  "team:valideerToegangIntrekking":
    valideerToegangIntrekkingHandler as Handler<never, unknown>,
  "team:registreerToegangIntrekking":
    registreerToegangIntrekkingHandler as Handler<never, unknown>,
};

interface FakeActionCtx {
  runMutation: (ref: unknown, args: unknown) => Promise<unknown>;
}

type ActionHandler<A, R> = (ctx: FakeActionCtx, args: A) => Promise<R>;

function actionHandlerVan<A, R>(fn: unknown): ActionHandler<A, R> {
  return (fn as { _handler: ActionHandler<A, R> })._handler;
}

const stuurUitnodigingHandler = actionHandlerVan<
  UitnodigingArgs,
  { clerkInvitationId: string | null }
>(stuurUitnodiging);

const trekUitnodigingInHandler = actionHandlerVan<
  { medewerkerId: string },
  { success: true }
>(trekUitnodigingIn);

const trekToegangInHandler = actionHandlerVan<
  { medewerkerId: string },
  { success: true }
>(trekToegangIn);

// ─── Fixtures ────────────────────────────────────────────────────────────────

let db: FakeDb;
let identity: FakeIdentity | null;
let ctx: FakeCtx;
let actionCtx: FakeActionCtx;
let orgId: string;
let andereOrgId: string;
let directieUserId: string;
let fetchMock: ReturnType<typeof vi.fn>;
const origineleFetch = globalThis.fetch;
const origineleSecret = process.env.CLERK_SECRET_KEY;

beforeEach(() => {
  db = new FakeDb();
  ctx = {
    db,
    auth: { getUserIdentity: async () => identity },
  };
  actionCtx = {
    runMutation: async (ref, args) => {
      const naam = getFunctionName(ref as Parameters<typeof getFunctionName>[0]);
      const handler = MUTATIE_HANDLERS[naam];
      if (!handler) throw new Error(`Onbekende mutatie in test: ${naam}`);
      return handler(ctx, args as never);
    },
  };

  orgId = db.insertSync("organisaties", {
    clerkOrgId: "org_top_tuinen",
    naam: "Top Tuinen",
    actief: true,
    aangemaaktOp: Date.now(),
  });
  andereOrgId = db.insertSync("organisaties", {
    clerkOrgId: "org_ander",
    naam: "Ander Bedrijf",
    actief: true,
    aangemaaktOp: Date.now(),
  });

  directieUserId = db.insertSync("users", {
    clerkId: "clerk_directie",
    email: "directie@toptuinen.nl",
    name: "Directie",
    role: "directie",
    createdAt: Date.now(),
  });

  identity = { subject: "clerk_directie", org_id: "org_top_tuinen" };

  process.env.CLERK_SECRET_KEY = "sk_test_geheim";
  fetchMock = vi.fn();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = origineleFetch;
  if (origineleSecret === undefined) {
    delete process.env.CLERK_SECRET_KEY;
  } else {
    process.env.CLERK_SECRET_KEY = origineleSecret;
  }
  vi.restoreAllMocks();
});

function seedMedewerker(overrides: Record<string, unknown> = {}): string {
  const now = Date.now();
  return db.insertSync("medewerkers", {
    userId: directieUserId,
    orgId,
    naam: "Medewerker",
    isActief: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });
}

function okResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

function foutResponse(status: number, body: string) {
  return {
    ok: false,
    status,
    json: async () => JSON.parse(body),
    text: async () => body,
  };
}

// ─── listTeam ────────────────────────────────────────────────────────────────

describe("team.listTeam", () => {
  it("geeft per medewerker de juiste accountStatus", async () => {
    const zonderId = seedMedewerker({ naam: "Zonder Account" });
    const uitgenodigdId = seedMedewerker({
      naam: "Uitgenodigde",
      uitnodigingEmail: "nieuw@toptuinen.nl",
      uitnodigingRol: "voorman",
      uitnodigingStatus: "uitgenodigd",
    });
    const actiefId = seedMedewerker({
      naam: "Actieve",
      clerkUserId: "clerk_actief",
      uitnodigingStatus: "geaccepteerd",
    });
    const accountId = db.insertSync("users", {
      clerkId: "clerk_actief",
      email: "actief@toptuinen.nl",
      name: "Actieve",
      role: "voorman",
      linkedMedewerkerId: actiefId,
      createdAt: Date.now(),
    });

    const rijen = await listTeamHandler(ctx, {});
    const perId = new Map(rijen.map((r) => [r._id, r]));

    expect(perId.get(zonderId)?.accountStatus).toBe("geen");
    expect(perId.get(zonderId)?.account).toBeNull();

    expect(perId.get(uitgenodigdId)?.accountStatus).toBe("uitgenodigd");
    expect(perId.get(uitgenodigdId)?.account).toBeNull();

    expect(perId.get(actiefId)?.accountStatus).toBe("actief");
    expect(perId.get(actiefId)?.account).toEqual({
      id: accountId,
      email: "actief@toptuinen.nl",
      role: "voorman",
    });
  });

  it("noemt een ingetrokken uitnodiging geen openstaande uitnodiging", async () => {
    const id = seedMedewerker({
      uitnodigingStatus: "ingetrokken",
    });

    const rijen = await listTeamHandler(ctx, {});
    expect(rijen.find((r) => r._id === id)?.accountStatus).toBe("geen");
  });

  it("toont geen medewerkers van een andere organisatie", async () => {
    seedMedewerker({ naam: "Eigen" });
    seedMedewerker({ naam: "Vreemd", orgId: andereOrgId });

    const rijen = await listTeamHandler(ctx, {});

    expect(rijen).toHaveLength(1);
    expect(rijen[0].naam).toBe("Eigen");
  });

  it("laat een projectleider het team lezen", async () => {
    db.insertSync("users", {
      clerkId: "clerk_pl",
      email: "pl@toptuinen.nl",
      name: "Projectleider",
      role: "projectleider",
      createdAt: Date.now(),
    });
    identity = { subject: "clerk_pl", org_id: "org_top_tuinen" };
    seedMedewerker();

    await expect(listTeamHandler(ctx, {})).resolves.toHaveLength(1);
  });

  it("weigert een sessie zonder organisatie", async () => {
    identity = { subject: "clerk_directie" };

    await expect(listTeamHandler(ctx, {})).rejects.toThrow(/organisatie/i);
  });
});

// ─── valideerUitnodiging ─────────────────────────────────────────────────────

describe("team.valideerUitnodiging", () => {
  it("geeft het clerkOrgId terug voor een geldige uitnodiging", async () => {
    const medewerkerId = seedMedewerker();

    await expect(
      valideerUitnodigingHandler(ctx, {
        medewerkerId,
        email: "Nieuw@Toptuinen.nl",
        rol: "voorman",
      })
    ).resolves.toEqual({ clerkOrgId: "org_top_tuinen" });
  });

  it("weigert iedereen behalve directie", async () => {
    db.insertSync("users", {
      clerkId: "clerk_pl",
      email: "pl@toptuinen.nl",
      name: "Projectleider",
      role: "projectleider",
      createdAt: Date.now(),
    });
    identity = { subject: "clerk_pl", org_id: "org_top_tuinen" };
    const medewerkerId = seedMedewerker();

    await expect(
      valideerUitnodigingHandler(ctx, {
        medewerkerId,
        email: "nieuw@toptuinen.nl",
        rol: "voorman",
      })
    ).rejects.toBeInstanceOf(ConvexError);
  });

  it("weigert een medewerker van een andere organisatie", async () => {
    const vreemdeId = seedMedewerker({ orgId: andereOrgId });

    await expect(
      valideerUitnodigingHandler(ctx, {
        medewerkerId: vreemdeId,
        email: "nieuw@toptuinen.nl",
        rol: "voorman",
      })
    ).rejects.toThrow(/niet gevonden/i);
  });

  it("weigert een medewerker die al een account heeft", async () => {
    const medewerkerId = seedMedewerker({ clerkUserId: "clerk_al_actief" });

    await expect(
      valideerUitnodigingHandler(ctx, {
        medewerkerId,
        email: "nieuw@toptuinen.nl",
        rol: "voorman",
      })
    ).rejects.toThrow(/account/i);
  });

  it("weigert de rol klant", async () => {
    const medewerkerId = seedMedewerker();

    await expect(
      valideerUitnodigingHandler(ctx, {
        medewerkerId,
        email: "nieuw@toptuinen.nl",
        rol: "klant",
      })
    ).rejects.toThrow(/rol/i);
  });

  it("weigert de legacy-rollen admin en viewer", async () => {
    const medewerkerId = seedMedewerker();

    for (const rol of ["admin", "viewer"]) {
      await expect(
        valideerUitnodigingHandler(ctx, {
          medewerkerId,
          email: "nieuw@toptuinen.nl",
          rol,
        })
      ).rejects.toThrow(/rol/i);
    }
  });

  it("weigert een tweede openstaande uitnodiging op hetzelfde adres", async () => {
    seedMedewerker({
      naam: "Al uitgenodigd",
      uitnodigingEmail: "nieuw@toptuinen.nl",
      uitnodigingStatus: "uitgenodigd",
    });
    const medewerkerId = seedMedewerker({ naam: "Tweede" });

    await expect(
      valideerUitnodigingHandler(ctx, {
        medewerkerId,
        // Hoofdletters: de uniciteit werkt op het genormaliseerde adres.
        email: "NIEUW@toptuinen.nl",
        rol: "voorman",
      })
    ).rejects.toThrow(/uitnodiging/i);
  });

  it("laat een ingetrokken uitnodiging op hetzelfde adres wél toe", async () => {
    seedMedewerker({
      uitnodigingEmail: "nieuw@toptuinen.nl",
      uitnodigingStatus: "ingetrokken",
    });
    const medewerkerId = seedMedewerker();

    await expect(
      valideerUitnodigingHandler(ctx, {
        medewerkerId,
        email: "nieuw@toptuinen.nl",
        rol: "voorman",
      })
    ).resolves.toEqual({ clerkOrgId: "org_top_tuinen" });
  });

  it("laat opnieuw uitnodigen van dezelfde medewerker toe", async () => {
    const medewerkerId = seedMedewerker({
      uitnodigingEmail: "nieuw@toptuinen.nl",
      uitnodigingStatus: "uitgenodigd",
    });

    await expect(
      valideerUitnodigingHandler(ctx, {
        medewerkerId,
        email: "nieuw@toptuinen.nl",
        rol: "voorman",
      })
    ).resolves.toEqual({ clerkOrgId: "org_top_tuinen" });
  });

  it("blokkeert een wees-uitnodiging van dezelfde medewerker niet", async () => {
    // Status "uitgenodigd" zonder uitnodigingClerkId = de Clerk-call slaagde
    // maar de registratie erna niet (of andersom). Dat mag zichzelf niet
    // opsluiten: opnieuw uitnodigen is precies het herstelpad.
    const medewerkerId = seedMedewerker({
      uitnodigingEmail: "nieuw@toptuinen.nl",
      uitnodigingRol: "voorman",
      uitnodigingStatus: "uitgenodigd",
      uitnodigingClerkId: undefined,
    });

    await expect(
      valideerUitnodigingHandler(ctx, {
        medewerkerId,
        email: "nieuw@toptuinen.nl",
        rol: "voorman",
      })
    ).resolves.toEqual({ clerkOrgId: "org_top_tuinen" });
  });

  it("laat een openstaande uitnodiging van een andere organisatie ongemoeid", async () => {
    seedMedewerker({
      orgId: andereOrgId,
      uitnodigingEmail: "nieuw@toptuinen.nl",
      uitnodigingStatus: "uitgenodigd",
    });
    const medewerkerId = seedMedewerker();

    await expect(
      valideerUitnodigingHandler(ctx, {
        medewerkerId,
        email: "nieuw@toptuinen.nl",
        rol: "voorman",
      })
    ).resolves.toEqual({ clerkOrgId: "org_top_tuinen" });
  });

  it("weigert een adres dat al aan een ándere medewerker gekoppeld is", async () => {
    const andereMedewerkerId = seedMedewerker({ naam: "Bezet" });
    db.insertSync("users", {
      clerkId: "clerk_bezet",
      email: "bezet@toptuinen.nl",
      name: "Bezet",
      role: "medewerker",
      linkedMedewerkerId: andereMedewerkerId,
      createdAt: Date.now(),
    });
    const medewerkerId = seedMedewerker({ naam: "Nieuw" });

    await expect(
      valideerUitnodigingHandler(ctx, {
        medewerkerId,
        email: "Bezet@toptuinen.nl",
        rol: "voorman",
      })
    ).rejects.toThrow(/account/i);
  });

  it("laat een ongekoppeld account op dat adres wél toe", async () => {
    db.insertSync("users", {
      clerkId: "clerk_los",
      email: "los@toptuinen.nl",
      name: "Los",
      role: "medewerker",
      createdAt: Date.now(),
    });
    const medewerkerId = seedMedewerker();

    await expect(
      valideerUitnodigingHandler(ctx, {
        medewerkerId,
        email: "los@toptuinen.nl",
        rol: "voorman",
      })
    ).resolves.toEqual({ clerkOrgId: "org_top_tuinen" });
  });

  it("weigert een leeg e-mailadres", async () => {
    const medewerkerId = seedMedewerker();

    await expect(
      valideerUitnodigingHandler(ctx, {
        medewerkerId,
        email: "   ",
        rol: "voorman",
      })
    ).rejects.toThrow(/e-mail/i);
  });
});

// ─── stuurUitnodiging ────────────────────────────────────────────────────────

describe("team.stuurUitnodiging", () => {
  it("stuurt de Clerk-uitnodiging en registreert hem lokaal", async () => {
    const medewerkerId = seedMedewerker();
    fetchMock.mockResolvedValue(okResponse({ id: "orginv_123" }));

    await stuurUitnodigingHandler(actionCtx, {
      medewerkerId,
      email: "  Nieuw@Toptuinen.nl ",
      rol: "voorman",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [
      string,
      { method: string; headers: Record<string, string>; body: string },
    ];
    expect(url).toBe(
      "https://api.clerk.com/v1/organizations/org_top_tuinen/invitations"
    );
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer sk_test_geheim");
    expect(JSON.parse(init.body)).toEqual({
      email_address: "nieuw@toptuinen.nl",
      role: "org:member",
      public_metadata: { role: "voorman" },
    });

    const medewerker = db.byId(medewerkerId);
    expect(medewerker?.uitnodigingEmail).toBe("nieuw@toptuinen.nl");
    expect(medewerker?.uitnodigingRol).toBe("voorman");
    expect(medewerker?.uitnodigingStatus).toBe("uitgenodigd");
    expect(medewerker?.uitnodigingClerkId).toBe("orginv_123");
  });

  it("vertaalt de rol directie naar org:admin", async () => {
    const medewerkerId = seedMedewerker();
    fetchMock.mockResolvedValue(okResponse({ id: "orginv_admin" }));

    await stuurUitnodigingHandler(actionCtx, {
      medewerkerId,
      email: "baas@toptuinen.nl",
      rol: "directie",
    });

    const [, init] = fetchMock.mock.calls[0] as [string, { body: string }];
    expect(JSON.parse(init.body).role).toBe("org:admin");
  });

  it("belt Clerk niet als de validatie faalt", async () => {
    const vreemdeId = seedMedewerker({ orgId: andereOrgId });

    await expect(
      stuurUitnodigingHandler(actionCtx, {
        medewerkerId: vreemdeId,
        email: "nieuw@toptuinen.nl",
        rol: "voorman",
      })
    ).rejects.toThrow(/niet gevonden/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("meldt status en body als Clerk de uitnodiging weigert", async () => {
    const medewerkerId = seedMedewerker();
    fetchMock.mockResolvedValue(
      foutResponse(422, '{"errors":[{"message":"duplicate invitation"}]}')
    );

    await expect(
      stuurUitnodigingHandler(actionCtx, {
        medewerkerId,
        email: "nieuw@toptuinen.nl",
        rol: "voorman",
      })
    ).rejects.toThrow(/422[\s\S]*duplicate invitation/);

    // Mislukte uitnodiging = geen lokale registratie.
    expect(db.byId(medewerkerId)?.uitnodigingStatus).toBeUndefined();
  });

  it("herstelt zichzelf als Clerk de uitnodiging al kent", async () => {
    // Het venster uit de vorige poging: Clerk verstuurde de mail, maar de
    // lokale registratie brak af. De retry krijgt nu een duplicaat-fout terug
    // en moet daaruit alsnog de juiste toestand opbouwen.
    const medewerkerId = seedMedewerker();
    fetchMock
      .mockResolvedValueOnce(
        foutResponse(
          400,
          '{"errors":[{"code":"duplicate_record","message":"duplicate record"}]}'
        )
      )
      .mockResolvedValueOnce(
        okResponse({
          data: [
            { id: "orginv_ander", email_address: "iemand@toptuinen.nl" },
            { id: "orginv_wees", email_address: "Nieuw@Toptuinen.nl" },
          ],
        })
      );

    const resultaat = await stuurUitnodigingHandler(actionCtx, {
      medewerkerId,
      email: "nieuw@toptuinen.nl",
      rol: "voorman",
    });

    expect(resultaat.clerkInvitationId).toBe("orginv_wees");
    expect(fetchMock.mock.calls[1][0]).toBe(
      "https://api.clerk.com/v1/organizations/org_top_tuinen/invitations?status=pending&limit=100"
    );

    const medewerker = db.byId(medewerkerId);
    expect(medewerker?.uitnodigingStatus).toBe("uitgenodigd");
    expect(medewerker?.uitnodigingClerkId).toBe("orginv_wees");
    expect(medewerker?.uitnodigingEmail).toBe("nieuw@toptuinen.nl");
  });

  it("registreert bij een duplicaat ook zonder terugvindbaar invitation-id", async () => {
    const medewerkerId = seedMedewerker();
    fetchMock
      .mockResolvedValueOnce(
        foutResponse(400, '{"errors":[{"code":"duplicate_record"}]}')
      )
      .mockResolvedValueOnce(foutResponse(500, "lijst onbereikbaar"));

    const resultaat = await stuurUitnodigingHandler(actionCtx, {
      medewerkerId,
      email: "nieuw@toptuinen.nl",
      rol: "voorman",
    });

    // Liever een uitnodiging zonder id in het scherm dan een onzichtbare
    // uitnodiging die bij Clerk wél is uitgegaan.
    expect(resultaat.clerkInvitationId).toBeNull();
    expect(db.byId(medewerkerId)?.uitnodigingStatus).toBe("uitgenodigd");
    expect(db.byId(medewerkerId)?.uitnodigingClerkId).toBeUndefined();
  });

  it("weigert netjes zonder CLERK_SECRET_KEY", async () => {
    delete process.env.CLERK_SECRET_KEY;
    const medewerkerId = seedMedewerker();

    await expect(
      stuurUitnodigingHandler(actionCtx, {
        medewerkerId,
        email: "nieuw@toptuinen.nl",
        rol: "voorman",
      })
    ).rejects.toThrow(/CLERK_SECRET_KEY/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// ─── trekUitnodigingIn ───────────────────────────────────────────────────────

describe("team.trekUitnodigingIn", () => {
  function seedUitgenodigd(overrides: Record<string, unknown> = {}) {
    return seedMedewerker({
      uitnodigingEmail: "nieuw@toptuinen.nl",
      uitnodigingRol: "voorman",
      uitnodigingStatus: "uitgenodigd",
      uitnodigingClerkId: "orginv_123",
      ...overrides,
    });
  }

  it("trekt de uitnodiging in bij Clerk en lokaal", async () => {
    const medewerkerId = seedUitgenodigd();
    fetchMock.mockResolvedValue(okResponse({ id: "orginv_123" }));

    await trekUitnodigingInHandler(actionCtx, { medewerkerId });

    const [url, init] = fetchMock.mock.calls[0] as [
      string,
      { method: string },
    ];
    expect(url).toBe(
      "https://api.clerk.com/v1/organizations/org_top_tuinen/invitations/orginv_123/revoke"
    );
    expect(init.method).toBe("POST");

    const medewerker = db.byId(medewerkerId);
    expect(medewerker?.uitnodigingStatus).toBe("ingetrokken");
    expect(medewerker?.uitnodigingEmail).toBeUndefined();
  });

  it("trekt lokaal tóch in als Clerk de uitnodiging niet (meer) kent", async () => {
    const medewerkerId = seedUitgenodigd();
    fetchMock.mockResolvedValue(foutResponse(404, '{"errors":[]}'));

    await trekUitnodigingInHandler(actionCtx, { medewerkerId });

    const medewerker = db.byId(medewerkerId);
    expect(medewerker?.uitnodigingStatus).toBe("ingetrokken");
    expect(medewerker?.uitnodigingEmail).toBeUndefined();
  });

  it("laat een echte Clerk-fout wél staan", async () => {
    const medewerkerId = seedUitgenodigd();
    fetchMock.mockResolvedValue(foutResponse(500, "boom"));

    await expect(
      trekUitnodigingInHandler(actionCtx, { medewerkerId })
    ).rejects.toThrow(/500[\s\S]*boom/);
    expect(db.byId(medewerkerId)?.uitnodigingStatus).toBe("uitgenodigd");
  });

  it("belt Clerk niet als er geen invitation-id bekend is", async () => {
    const medewerkerId = seedUitgenodigd({ uitnodigingClerkId: undefined });

    await trekUitnodigingInHandler(actionCtx, { medewerkerId });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(db.byId(medewerkerId)?.uitnodigingStatus).toBe("ingetrokken");
  });

  it("weigert een medewerker zonder openstaande uitnodiging", async () => {
    const medewerkerId = seedMedewerker();

    await expect(
      trekUitnodigingInHandler(actionCtx, { medewerkerId })
    ).rejects.toThrow(/uitnodiging/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("weigert een medewerker van een andere organisatie", async () => {
    const vreemdeId = seedUitgenodigd({ orgId: andereOrgId });

    await expect(
      trekUitnodigingInHandler(actionCtx, { medewerkerId: vreemdeId })
    ).rejects.toThrow(/niet gevonden/i);
  });

  it("weigert een projectleider", async () => {
    db.insertSync("users", {
      clerkId: "clerk_pl",
      email: "pl@toptuinen.nl",
      name: "Projectleider",
      role: "projectleider",
      createdAt: Date.now(),
    });
    const medewerkerId = seedUitgenodigd();
    identity = { subject: "clerk_pl", org_id: "org_top_tuinen" };

    await expect(
      trekUitnodigingInHandler(actionCtx, { medewerkerId })
    ).rejects.toBeInstanceOf(ConvexError);
  });
});

// ─── trekToegangIn ───────────────────────────────────────────────────────────

describe("team.trekToegangIn", () => {
  function seedActief() {
    const medewerkerId = seedMedewerker({
      clerkUserId: "clerk_actief",
      uitnodigingStatus: "geaccepteerd",
    });
    const accountId = db.insertSync("users", {
      clerkId: "clerk_actief",
      email: "actief@toptuinen.nl",
      name: "Actieve",
      role: "voorman",
      linkedMedewerkerId: medewerkerId,
      createdAt: Date.now(),
    });
    return { medewerkerId, accountId };
  }

  it("verwijdert het org-lidmaatschap en ontkoppelt lokaal", async () => {
    const { medewerkerId, accountId } = seedActief();
    fetchMock.mockResolvedValue(okResponse({ id: "orgmem_1" }));

    await trekToegangInHandler(actionCtx, { medewerkerId });

    const [url, init] = fetchMock.mock.calls[0] as [
      string,
      { method: string; headers: Record<string, string> },
    ];
    expect(url).toBe(
      "https://api.clerk.com/v1/organizations/org_top_tuinen/memberships/clerk_actief"
    );
    expect(init.method).toBe("DELETE");
    expect(init.headers.Authorization).toBe("Bearer sk_test_geheim");

    expect(db.byId(medewerkerId)?.clerkUserId).toBeUndefined();
    expect(db.byId(accountId)?.linkedMedewerkerId).toBeUndefined();
    // De rol blijft: toegang intrekken is geen rolwijziging.
    expect(db.byId(accountId)?.role).toBe("voorman");
  });

  it("weigert een medewerker zonder account", async () => {
    const medewerkerId = seedMedewerker();

    await expect(
      trekToegangInHandler(actionCtx, { medewerkerId })
    ).rejects.toThrow(/account/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("weigert een medewerker van een andere organisatie", async () => {
    const vreemdeId = seedMedewerker({
      orgId: andereOrgId,
      clerkUserId: "clerk_vreemd",
    });

    await expect(
      trekToegangInHandler(actionCtx, { medewerkerId: vreemdeId })
    ).rejects.toThrow(/niet gevonden/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("ontkoppelt lokaal tóch als Clerk het lidmaatschap niet (meer) kent", async () => {
    // Zonder deze tolerantie blijft clerkUserId hangen zodra iemand het
    // lidmaatschap in het Clerk-dashboard heeft weggehaald, en is de
    // medewerker via dit scherm nooit meer los te koppelen.
    const { medewerkerId, accountId } = seedActief();
    fetchMock.mockResolvedValue(foutResponse(404, '{"errors":[]}'));

    await trekToegangInHandler(actionCtx, { medewerkerId });

    expect(db.byId(medewerkerId)?.clerkUserId).toBeUndefined();
    expect(db.byId(accountId)?.linkedMedewerkerId).toBeUndefined();
    expect(db.byId(accountId)?.role).toBe("voorman");
  });

  it("meldt status en body als Clerk de verwijdering weigert", async () => {
    const { medewerkerId } = seedActief();
    fetchMock.mockResolvedValue(foutResponse(403, "verboden"));

    await expect(
      trekToegangInHandler(actionCtx, { medewerkerId })
    ).rejects.toThrow(/403[\s\S]*verboden/);
    expect(db.byId(medewerkerId)?.clerkUserId).toBe("clerk_actief");
  });

  it("laat een serverfout van Clerk niets lokaal wijzigen", async () => {
    const { medewerkerId, accountId } = seedActief();
    fetchMock.mockResolvedValue(foutResponse(500, "boem"));

    await expect(
      trekToegangInHandler(actionCtx, { medewerkerId })
    ).rejects.toThrow(/500[\s\S]*boem/);
    expect(db.byId(medewerkerId)?.clerkUserId).toBe("clerk_actief");
    expect(db.byId(accountId)?.linkedMedewerkerId).toBe(medewerkerId);
  });

  it("weigert een projectleider", async () => {
    const { medewerkerId } = seedActief();
    db.insertSync("users", {
      clerkId: "clerk_pl",
      email: "pl@toptuinen.nl",
      name: "Projectleider",
      role: "projectleider",
      createdAt: Date.now(),
    });
    identity = { subject: "clerk_pl", org_id: "org_top_tuinen" };

    await expect(
      trekToegangInHandler(actionCtx, { medewerkerId })
    ).rejects.toBeInstanceOf(ConvexError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
