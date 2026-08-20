// @vitest-environment node
/**
 * Regressietests voor `users.initializeDefaults` (console-storm 20 aug 2026).
 *
 * Deze mutation is een bootstrap-hulpje: `use-current-user.ts` vuurt hem als
 * achtergrondoperatie af bij het laden van een pagina, niemand vraagt erom.
 * Hij liep via `requireOrgContext` en gooide dus een AuthError zodra het JWT
 * naar een organisatie wees die niet in Convex staat — bij elke gemounte
 * component opnieuw. Er valt in dat geval niets te initialiseren, dus is
 * `{ overgeslagen: true }` het juiste antwoord.
 *
 * `convex-test` is in dit project niet geïnstalleerd; net als de andere
 * convex-tests draaien we de handler direct tegen een in-memory nep-ctx, via
 * het niet-gepubliceerde `_handler`-veld van de geregistreerde mutation.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { initializeDefaults } from "../../../../convex/users";

interface FakeDoc {
  _id: string;
  _creationTime: number;
  [key: string]: unknown;
}

interface IndexQ {
  eq: (field: string, value: unknown) => IndexQ;
}

/** Past de index-constraints écht toe: een resolver die de verkeerde rij pakt valt hier om. */
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
    async unique(): Promise<FakeDoc | null> {
      if (current.length > 1) throw new Error("unique() vond meerdere documenten");
      return current[0] ?? null;
    },
  };

  return builder;
}

type FakeCtx = Parameters<typeof handler>[0];

const handler = (
  initializeDefaults as unknown as {
    _handler: (
      ctx: {
        db: { query: (table: string) => ReturnType<typeof createQueryBuilder> };
        auth: { getUserIdentity: () => Promise<Record<string, unknown> | null> };
      },
      args: Record<string, never>
    ) => Promise<{ overgeslagen: boolean; reden?: string }>;
  }
)._handler;

let tabellen: Map<string, FakeDoc[]>;
let identity: Record<string, unknown> | null;
let ctx: FakeCtx;

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
  ctx = {
    auth: { getUserIdentity: async () => identity },
    db: {
      query: (table: string) => createQueryBuilder(tabellen.get(table) ?? []),
    },
  };
});

describe("users.initializeDefaults zonder bruikbare organisatie", () => {
  it("slaat over zonder te gooien als er geen sessie is", async () => {
    await expect(handler(ctx, {})).resolves.toEqual({
      overgeslagen: true,
      reden: "geen-sessie",
    });
  });

  it("slaat over zonder te gooien als de sessie geen org_id-claim heeft", async () => {
    identity = { subject: "clerk_user_1" };

    await expect(handler(ctx, {})).resolves.toEqual({
      overgeslagen: true,
      reden: "geen-organisatie",
    });
  });

  // Precies het geval van 20 aug: een geldig JWT (org_391vh9…) zonder rij in
  // `organisaties`. Voorheen ontsnapte hier een AuthError "Organisatie niet
  // gevonden" naar de achtergrond-catch, bij elke poging opnieuw.
  it("slaat over zonder te gooien als het claim naar een onbekende organisatie wijst", async () => {
    identity = { subject: "clerk_user_1", org_id: "org_391vh9Mj2PDwnZU74Yzl3kCMEp6" };
    insert("users", { clerkId: "clerk_user_1", name: "Ricardo" });

    await expect(handler(ctx, {})).resolves.toEqual({
      overgeslagen: true,
      reden: "onbekende-organisatie",
    });
  });

  it("slaat over zonder te gooien als de organisatie op inactief staat", async () => {
    insert("organisaties", {
      clerkOrgId: "org_top_tuinen",
      naam: "Top Tuinen",
      actief: false,
      aangemaaktOp: Date.now(),
    });
    identity = { subject: "clerk_user_1", org_id: "org_top_tuinen" };

    await expect(handler(ctx, {})).resolves.toEqual({
      overgeslagen: true,
      reden: "inactieve-organisatie",
    });
  });

  it("slaat over als de users-rij nog niet gesynct is (upsert loopt gelijktijdig)", async () => {
    insert("organisaties", {
      clerkOrgId: "org_top_tuinen",
      naam: "Top Tuinen",
      actief: true,
      aangemaaktOp: Date.now(),
    });
    identity = { subject: "clerk_nog_niet_gesynct", org_id: "org_top_tuinen" };

    await expect(handler(ctx, {})).resolves.toEqual({
      overgeslagen: true,
      reden: "geen-gebruiker",
    });
  });
});
