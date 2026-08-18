// @vitest-environment node
/**
 * Tests voor de org-resolvers in `convex/auth.ts`: `requireOrg`,
 * `requireOrgId` en `verifyOrgOwnership`.
 *
 * Deze drie functies worden straks door ~77 bestanden gebruikt als enige
 * tenant-grens. Ze mogen dus geen enkele van deze gevallen laten passeren:
 * geen sessie, een sessie zónder org-claim (Clerk laat `{{org.id}}` leeg als er
 * geen actieve organisatie is), een claim die naar niets wijst, en een
 * organisatie die op inactief staat.
 *
 * `convex-test` is in dit project niet geïnstalleerd; net als de andere
 * convex-tests draaien we tegen een in-memory nep-ctx. Die nep-ctx bootst
 * alleen `ctx.auth.getUserIdentity` en `ctx.db.query(...).withIndex(...).unique()`
 * na — de index-constraint wordt daarbij écht toegepast, zodat een resolver die
 * de verkeerde org pakt hier ook echt omvalt.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  AuthError,
  requireOrg,
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

let organisaties: FakeDoc[];
let identity: Record<string, unknown> | null;
let ctx: QueryCtx;

function insertOrg(data: Record<string, unknown>): string {
  const id = `organisaties:${organisaties.length + 1}`;
  organisaties.push({ ...data, _id: id, _creationTime: Date.now() });
  return id;
}

beforeEach(() => {
  organisaties = [];
  identity = null;
  ctx = {
    auth: { getUserIdentity: async () => identity },
    db: {
      query: (table: string) => {
        if (table !== "organisaties") {
          throw new Error(`nep-db kent alleen organisaties, niet ${table}`);
        }
        return createQueryBuilder(organisaties);
      },
    },
  } as unknown as QueryCtx;
});

/** Ingelogd als lid van een actieve organisatie. */
function logInBijActieveOrg(clerkOrgId = "org_top_tuinen"): string {
  const id = insertOrg({
    clerkOrgId,
    naam: "Top Tuinen",
    slug: "top-tuinen",
    actief: true,
    aangemaaktOp: Date.now(),
  });
  identity = { subject: "user_1", org_id: clerkOrgId };
  return id;
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

  it("geeft de actieve organisatie terug die bij het claim hoort", async () => {
    const orgId = logInBijActieveOrg();

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
    const eigenOrgId = logInBijActieveOrg("org_top_tuinen");

    const org = await requireOrg(ctx);

    expect(org._id).toBe(eigenOrgId);
  });

  it("weigert een claim dat naar geen enkele organisatie wijst", async () => {
    identity = { subject: "user_1", org_id: "org_bestaat_niet" };

    await expect(requireOrg(ctx)).rejects.toThrow(AuthError);
  });

  it("weigert een organisatie die op inactief staat", async () => {
    insertOrg({
      clerkOrgId: "org_top_tuinen",
      naam: "Top Tuinen",
      actief: false,
      aangemaaktOp: Date.now(),
    });
    identity = { subject: "user_1", org_id: "org_top_tuinen" };

    await expect(requireOrg(ctx)).rejects.toThrow(AuthError);
    await expect(requireOrg(ctx)).rejects.toThrow(/inactief/i);
  });
});

// ─── requireOrgId ────────────────────────────────────────────────────────────

describe("requireOrgId", () => {
  it("geeft het _id van de gevonden organisatie", async () => {
    const orgId = logInBijActieveOrg();

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
    const orgId = logInBijActieveOrg();
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
