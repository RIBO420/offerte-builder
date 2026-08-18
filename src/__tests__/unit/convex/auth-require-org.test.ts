// @vitest-environment node
/**
 * Tests voor de org-resolvers in `convex/auth.ts`: `requireOrg`,
 * `requireOrgContext`, `requireOrgId` en `verifyOrgOwnership`.
 *
 * Deze functies worden straks door ~77 bestanden gebruikt als enige
 * tenant-grens. Ze mogen dus geen enkele van deze gevallen laten passeren:
 * geen sessie, een sessie zónder org-claim (Clerk laat `{{org.id}}` leeg als er
 * geen actieve organisatie is), een claim die naar niets wijst, en een
 * organisatie die op inactief staat.
 *
 * `convex-test` is in dit project niet geïnstalleerd; net als de andere
 * convex-tests draaien we tegen een in-memory nep-ctx. Die nep-ctx bootst
 * alleen `ctx.auth.getUserIdentity` en `ctx.db.query(...).withIndex(...).unique()`
 * na — de index-constraint wordt daarbij écht toegepast, zodat een resolver die
 * de verkeerde org (of de verkeerde user) pakt hier ook echt omvalt.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  AuthError,
  requireOrg,
  requireOrgContext,
  requireOrgId,
  verifyOrgOwnership,
} from "../../../../convex/auth";
import type { QueryCtx } from "../../../../convex/_generated/server";
import type { Id } from "../../../../convex/_generated/dataModel";

// ─── Nep-Convex-ctx ──────────────────────────────────────────────────────────

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
    async unique(): Promise<FakeDoc | null> {
      if (current.length > 1) {
        throw new Error("unique() vond meerdere documenten");
      }
      return current[0] ?? null;
    },
  };

  return builder;
}

let tabellen: Map<string, FakeDoc[]>;
let identity: Record<string, unknown> | null;
let ctx: QueryCtx;
let warnSpy: ReturnType<typeof vi.spyOn>;

function insert(table: string, data: Record<string, unknown>): string {
  const rijen = tabellen.get(table) ?? [];
  const id = `${table}:${rijen.length + 1}`;
  rijen.push({ ...data, _id: id, _creationTime: Date.now() });
  tabellen.set(table, rijen);
  return id;
}

beforeEach(() => {
  tabellen = new Map();
  identity = null;
  // requireOrg logt een niet-geprovisioneerde org naar het serverlog; hier
  // afgevangen zodat de testuitvoer schoon blijft én we hem kunnen controleren.
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  ctx = {
    auth: { getUserIdentity: async () => identity },
    db: {
      query: (table: string) => createQueryBuilder(tabellen.get(table) ?? []),
    },
  } as unknown as QueryCtx;
});

afterEach(() => {
  warnSpy.mockRestore();
});

function insertOrg(data: Record<string, unknown>): string {
  return insert("organisaties", data);
}

/**
 * Ingelogd als lid van een actieve organisatie, met de bijbehorende users-rij.
 * Geeft {orgId, userId} zodat een test kan controleren dát het die rijen zijn.
 */
function logInBijActieveOrg(clerkOrgId = "org_top_tuinen"): {
  orgId: string;
  userId: string;
} {
  const orgId = insertOrg({
    clerkOrgId,
    naam: "Top Tuinen",
    slug: "top-tuinen",
    actief: true,
    aangemaaktOp: Date.now(),
  });
  const userId = insert("users", {
    clerkId: "clerk_user_1",
    name: "Ricardo",
    role: "directie",
  });
  identity = { subject: "clerk_user_1", org_id: clerkOrgId };
  return { orgId, userId };
}

// ─── requireOrg ──────────────────────────────────────────────────────────────

describe("requireOrg", () => {
  it("weigert een verzoek zonder sessie met een melding over inloggen", async () => {
    await expect(requireOrg(ctx)).rejects.toThrow(AuthError);
    await expect(requireOrg(ctx)).rejects.toThrow(/ingelogd/i);
  });

  it("weigert een sessie zonder org_id-claim met een melding over de organisatie", async () => {
    identity = { subject: "user_1" };

    await expect(requireOrg(ctx)).rejects.toThrow(AuthError);
    await expect(requireOrg(ctx)).rejects.toThrow(/organisatie/i);
  });

  it("weigert een leeg org_id-claim (Clerk vult {{org.id}} niet zonder actieve org)", async () => {
    identity = { subject: "user_1", org_id: "" };

    await expect(requireOrg(ctx)).rejects.toThrow(/organisatie/i);
  });

  // Pint de typeof-guard vast: zonder die guard zou een niet-string claim als
  // string de index-query in gaan en stilzwijgend niets (of iets vreemds) vinden.
  it("weigert een org_id-claim dat geen string is", async () => {
    identity = { subject: "user_1", org_id: 42 };

    await expect(requireOrg(ctx)).rejects.toThrow(AuthError);
    await expect(requireOrg(ctx)).rejects.toThrow(/organisatie/i);
  });

  it("geeft de actieve organisatie terug die bij het claim hoort", async () => {
    const { orgId } = logInBijActieveOrg();

    const org = await requireOrg(ctx);

    expect(org._id).toBe(orgId);
    expect(org.clerkOrgId).toBe("org_top_tuinen");
    expect(org.naam).toBe("Top Tuinen");
  });

  it("pakt de organisatie van het claim, niet zomaar de eerste rij", async () => {
    insertOrg({
      clerkOrgId: "org_ander_bedrijf",
      naam: "Ander Bedrijf",
      actief: true,
      aangemaaktOp: Date.now(),
    });
    const { orgId } = logInBijActieveOrg("org_top_tuinen");

    const org = await requireOrg(ctx);

    expect(org._id).toBe(orgId);
  });

  // De twee takken hieronder zijn verschillende problemen: "niet gevonden" is
  // een systeemfout (het JWT wijst naar een org die nooit geprovisioneerd is),
  // "inactief" is een bewuste beheerdersactie. Ze moeten dus uit elkaar te
  // houden zijn — vandaar dat elke test óók checkt dat de ándere melding niet
  // matcht.
  it("meldt een claim dat naar geen enkele organisatie wijst als 'niet gevonden'", async () => {
    identity = { subject: "user_1", org_id: "org_bestaat_niet" };

    await expect(requireOrg(ctx)).rejects.toThrow(AuthError);
    await expect(requireOrg(ctx)).rejects.toThrow(/niet gevonden/i);
    await expect(requireOrg(ctx)).rejects.not.toThrow(/actief/i);
  });

  it("logt het clerkOrgId naar het serverlog als de organisatie niet bestaat", async () => {
    identity = { subject: "user_1", org_id: "org_bestaat_niet" };

    await expect(requireOrg(ctx)).rejects.toThrow(AuthError);

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(String(warnSpy.mock.calls[0]?.join(" "))).toContain(
      "org_bestaat_niet"
    );
  });

  it("meldt een organisatie die op inactief staat als 'niet actief'", async () => {
    insertOrg({
      clerkOrgId: "org_top_tuinen",
      naam: "Top Tuinen",
      actief: false,
      aangemaaktOp: Date.now(),
    });
    identity = { subject: "user_1", org_id: "org_top_tuinen" };

    await expect(requireOrg(ctx)).rejects.toThrow(AuthError);
    await expect(requireOrg(ctx)).rejects.toThrow(/niet actief/i);
    await expect(requireOrg(ctx)).rejects.not.toThrow(/niet gevonden/i);
    // Een bestaande maar uitgezette org is geen systeemfout: niets in het log.
    expect(warnSpy).not.toHaveBeenCalled();
  });
});

// ─── requireOrgContext ───────────────────────────────────────────────────────

describe("requireOrgContext", () => {
  it("geeft zowel de organisatie als de users-rij terug", async () => {
    const { orgId, userId } = logInBijActieveOrg();

    const { org, user } = await requireOrgContext(ctx);

    expect(org._id).toBe(orgId);
    expect(org.naam).toBe("Top Tuinen");
    expect(user._id).toBe(userId);
    expect(user.clerkId).toBe("clerk_user_1");
  });

  it("weigert een sessie zonder users-rij met dezelfde melding als requireAuth", async () => {
    // Org bestaat en is actief, maar het account is nooit gesynct naar `users`.
    insertOrg({
      clerkOrgId: "org_top_tuinen",
      naam: "Top Tuinen",
      actief: true,
      aangemaaktOp: Date.now(),
    });
    identity = { subject: "clerk_onbekend", org_id: "org_top_tuinen" };

    await expect(requireOrgContext(ctx)).rejects.toThrow(AuthError);
    await expect(requireOrgContext(ctx)).rejects.toThrow(/ingelogd/i);
  });

  it("pakt de users-rij van de ingelogde gebruiker, niet zomaar de eerste", async () => {
    logInBijActieveOrg();
    insert("users", { clerkId: "clerk_iemand_anders", name: "Iemand Anders" });
    identity = { subject: "clerk_iemand_anders", org_id: "org_top_tuinen" };

    const { user } = await requireOrgContext(ctx);

    expect(user.clerkId).toBe("clerk_iemand_anders");
  });

  it("erft de org-controles: geen org_id-claim → AuthError", async () => {
    identity = { subject: "clerk_user_1" };

    await expect(requireOrgContext(ctx)).rejects.toThrow(/organisatie/i);
  });
});

// ─── requireOrgId ────────────────────────────────────────────────────────────

describe("requireOrgId", () => {
  it("geeft het _id van de gevonden organisatie", async () => {
    const { orgId } = logInBijActieveOrg();

    await expect(requireOrgId(ctx)).resolves.toBe(orgId);
  });

  it("gooit dezelfde fout als requireOrg wanneer er geen sessie is", async () => {
    await expect(requireOrgId(ctx)).rejects.toThrow(AuthError);
  });
});

// ─── verifyOrgOwnership ──────────────────────────────────────────────────────

describe("verifyOrgOwnership", () => {
  it("meldt 'niet gevonden' bij een ontbrekend document", async () => {
    logInBijActieveOrg();

    await expect(verifyOrgOwnership(ctx, null, "offerte")).rejects.toThrow(
      /offerte niet gevonden/i
    );
  });

  it("weigert een document van een andere organisatie", async () => {
    logInBijActieveOrg();
    const vreemdDocument = {
      _id: "offertes:9",
      orgId: "organisaties:99" as Id<"organisaties">,
    };

    await expect(
      verifyOrgOwnership(ctx, vreemdDocument, "offerte")
    ).rejects.toThrow(/geen toegang/i);
  });

  it("weigert een document zonder orgId", async () => {
    logInBijActieveOrg();
    const ongemigreerd: { _id: string; orgId?: Id<"organisaties"> } = {
      _id: "offertes:9",
    };

    await expect(
      verifyOrgOwnership(ctx, ongemigreerd, "offerte")
    ).rejects.toThrow(/geen toegang/i);
  });

  it("geeft een document van de eigen organisatie terug", async () => {
    const { orgId } = logInBijActieveOrg();
    const eigenDocument = {
      _id: "offertes:1",
      orgId: orgId as Id<"organisaties">,
      titel: "Achtertuin Bloemendaal",
    };

    await expect(
      verifyOrgOwnership(ctx, eigenDocument, "offerte")
    ).resolves.toBe(eigenDocument);
  });

  it("gebruikt 'resource' als er geen naam is meegegeven", async () => {
    logInBijActieveOrg();

    await expect(verifyOrgOwnership(ctx, null)).rejects.toThrow(
      /resource niet gevonden/i
    );
  });

  it("controleert de sessie ook wanneer het document er wél is", async () => {
    // Geen identity: een document met een willekeurig orgId mag niet
    // stilzwijgend door de controle glippen.
    const document = {
      _id: "offertes:1",
      orgId: "organisaties:1" as Id<"organisaties">,
    };

    await expect(verifyOrgOwnership(ctx, document, "offerte")).rejects.toThrow(
      /ingelogd/i
    );
  });
});
