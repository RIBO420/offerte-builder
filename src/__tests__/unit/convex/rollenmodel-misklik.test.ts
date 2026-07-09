/**
 * Misklik-test (PRD §8.3) voor het canonieke rollenmodel (PRD §1.2, fase 0).
 *
 * Toont per rol aan dat:
 * 1. de capability "versturen naar klant" alleen voor kantoor
 *    (directie/projectleider) slaagt en voor voorman/medewerker/klant
 *    met een duidelijke foutmelding weigert;
 * 2. een klant-identiteit geen threads van een andere klant en geen
 *    interne threads (team/project/dm) kan lezen — ook niet wanneer daar
 *    per ongeluk een klantId op staat (het lekscenario uit de audit).
 *
 * E-mailveiligheid: er wordt NOOIT echt gemaild — de mock-ctx gebruikt een
 * vi.fn()-scheduler en er wordt geen enkele Resend-/Clerk-code geïmporteerd.
 */

import { describe, it, expect, vi } from "vitest";
import {
  MockConvexStore,
  createMockCtx,
  createMockUser,
} from "../../helpers/convex-mock";
import type { QueryCtx } from "../../../../convex/_generated/server";
import {
  CANONIEKE_ROL_MAPPING,
  toCanonicaleRol,
  isKantoorRol,
  kanNaarKlantVersturen,
  assertKanNaarKlantVersturen,
  requireKantoor,
  klantHeeftToegangTotThread,
  type UserRole,
} from "../../../../convex/roles";
import { AuthError, requireKlant } from "../../../../convex/auth";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Maakt een ctx waarin precies één user is ingelogd met de gegeven rol. */
function ctxMetRol(
  role: string,
  extra: Record<string, unknown> = {}
): { ctx: QueryCtx; store: MockConvexStore } {
  const store = new MockConvexStore();
  store.insert("users", createMockUser({ role, ...extra }));
  const ctx = createMockCtx(store) as unknown as QueryCtx;
  return { ctx, store };
}

const ALLE_ROLLEN: UserRole[] = [
  "directie",
  "projectleider",
  "voorman",
  "medewerker",
  "klant",
  "onderaannemer_zzp",
  "materiaalman",
];

const KANTOOR_ROLLEN = ["directie", "projectleider"] as const;
const NIET_KANTOOR_ROLLEN = [
  "voorman",
  "medewerker",
  "klant",
  "onderaannemer_zzp",
  "materiaalman",
] as const;

// ─── 1. Canonieke rol-mapping (PRD §1.2) ─────────────────────────────────────

describe("Canoniek rollenmodel (PRD §1.2)", () => {
  it("mapt elke bestaande rol op een canonieke rol", () => {
    for (const rol of ALLE_ROLLEN) {
      expect(CANONIEKE_ROL_MAPPING[rol]).toBeDefined();
    }
  });

  it("kantoor = directie + projectleider", () => {
    expect(toCanonicaleRol("directie")).toBe("kantoor");
    expect(toCanonicaleRol("projectleider")).toBe("kantoor");
  });

  it("voorman blijft voorman", () => {
    expect(toCanonicaleRol("voorman")).toBe("voorman");
  });

  it("medewerker = medewerker + onderaannemer_zzp + materiaalman", () => {
    expect(toCanonicaleRol("medewerker")).toBe("medewerker");
    expect(toCanonicaleRol("onderaannemer_zzp")).toBe("medewerker");
    expect(toCanonicaleRol("materiaalman")).toBe("medewerker");
  });

  it("klant blijft klant", () => {
    expect(toCanonicaleRol("klant")).toBe("klant");
  });

  it("legacy admin → kantoor, legacy viewer → klant", () => {
    expect(toCanonicaleRol("admin")).toBe("kantoor");
    expect(toCanonicaleRol("viewer")).toBe("klant");
  });

  it("onbekende/ontbrekende rol valt veilig terug op medewerker (least privilege)", () => {
    expect(toCanonicaleRol(undefined)).toBe("medewerker");
    expect(toCanonicaleRol(null)).toBe("medewerker");
  });

  it("isKantoorRol alleen true voor directie/projectleider/legacy-admin", () => {
    expect(isKantoorRol("directie")).toBe(true);
    expect(isKantoorRol("projectleider")).toBe(true);
    expect(isKantoorRol("admin")).toBe(true);
    for (const rol of NIET_KANTOOR_ROLLEN) {
      expect(isKantoorRol(rol)).toBe(false);
    }
  });
});

// ─── 2. Capability "versturen naar klant" (misklik-test §8.3) ────────────────

describe("Capability versturen-naar-klant (misklik-test PRD §8.3)", () => {
  describe("pure check kanNaarKlantVersturen", () => {
    for (const rol of KANTOOR_ROLLEN) {
      it(`staat versturen toe voor ${rol}`, () => {
        expect(kanNaarKlantVersturen(rol)).toBe(true);
      });
    }
    for (const rol of NIET_KANTOOR_ROLLEN) {
      it(`weigert versturen voor ${rol}`, () => {
        expect(kanNaarKlantVersturen(rol)).toBe(false);
      });
    }
  });

  describe("server-side assertKanNaarKlantVersturen(ctx)", () => {
    for (const rol of KANTOOR_ROLLEN) {
      it(`slaagt voor ingelogde ${rol}`, async () => {
        const { ctx } = ctxMetRol(rol);
        const user = await assertKanNaarKlantVersturen(ctx);
        expect(user.role).toBe(rol);
      });
    }

    for (const rol of NIET_KANTOOR_ROLLEN) {
      it(`weigert met duidelijke foutmelding voor ${rol}`, async () => {
        const { ctx } = ctxMetRol(rol);
        await expect(assertKanNaarKlantVersturen(ctx)).rejects.toThrow(
          AuthError
        );
        await expect(assertKanNaarKlantVersturen(ctx)).rejects.toThrow(
          /alleen kantoor/i
        );
      });
    }

    it("weigert zonder ingelogde gebruiker", async () => {
      const store = new MockConvexStore();
      const ctx = createMockCtx(store) as unknown as QueryCtx;
      (ctx.auth.getUserIdentity as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      );
      await expect(assertKanNaarKlantVersturen(ctx)).rejects.toThrow(AuthError);
    });
  });

  describe("requireKantoor(ctx)", () => {
    it("slaagt voor directie en projectleider", async () => {
      for (const rol of KANTOOR_ROLLEN) {
        const { ctx } = ctxMetRol(rol);
        await expect(requireKantoor(ctx)).resolves.toBeDefined();
      }
    });

    it("weigert voor voorman, medewerker en klant", async () => {
      for (const rol of ["voorman", "medewerker", "klant"]) {
        const { ctx } = ctxMetRol(rol);
        await expect(requireKantoor(ctx)).rejects.toThrow(AuthError);
      }
    });
  });
});

// ─── 3. Klant-scoping: threads (RLS-equivalent, PRD §1.2) ────────────────────

describe("Klant-scoping op chat-threads (PRD §1.2)", () => {
  const klantA = "klanten:100";
  const klantB = "klanten:200";

  it("klant heeft toegang tot eigen klant-thread", () => {
    expect(
      klantHeeftToegangTotThread(klantA, { type: "klant", klantId: klantA })
    ).toBe(true);
  });

  it("klant heeft GEEN toegang tot klant-thread van een andere klant", () => {
    expect(
      klantHeeftToegangTotThread(klantA, { type: "klant", klantId: klantB })
    ).toBe(false);
  });

  it("klant heeft GEEN toegang tot interne threads, ook niet met eigen klantId (lekscenario audit)", () => {
    // Precies het scenario dat PRD §1.2 structureel uitsluit: een intern
    // (project/team) thread waar per ongeluk een klantId op staat mag
    // NOOIT leesbaar worden voor de klant.
    for (const interneType of ["project", "team", "dm", "intern"]) {
      expect(
        klantHeeftToegangTotThread(klantA, {
          type: interneType,
          klantId: klantA,
        })
      ).toBe(false);
    }
  });

  it("geen toegang zonder gekoppelde klant of zonder thread", () => {
    expect(
      klantHeeftToegangTotThread(undefined, { type: "klant", klantId: klantA })
    ).toBe(false);
    expect(klantHeeftToegangTotThread(klantA, null)).toBe(false);
    expect(
      klantHeeftToegangTotThread(klantA, { type: "klant", klantId: undefined })
    ).toBe(false);
  });
});

// ─── 4. Klant-identiteit: requireKlant scoping ───────────────────────────────

describe("requireKlant (portaal-scoping)", () => {
  it("geeft user + gekoppeld klantprofiel terug voor klant-rol", async () => {
    const store = new MockConvexStore();
    const klantId = store.insert("klanten", {
      naam: "Klant A",
      userId: "users:999",
    });
    store.insert(
      "users",
      createMockUser({ role: "klant", linkedKlantId: klantId })
    );
    const ctx = createMockCtx(store) as unknown as QueryCtx;

    const { klant } = await requireKlant(ctx);
    expect(klant._id).toBe(klantId);
  });

  it("weigert stafrollen (kantoor/voorman/medewerker) op portaal-functies", async () => {
    for (const rol of ["directie", "projectleider", "voorman", "medewerker"]) {
      const { ctx } = ctxMetRol(rol);
      await expect(requireKlant(ctx)).rejects.toThrow(AuthError);
    }
  });

  it("weigert klant-rol zonder gekoppeld klantprofiel", async () => {
    const { ctx } = ctxMetRol("klant", { linkedKlantId: undefined });
    await expect(requireKlant(ctx)).rejects.toThrow(AuthError);
  });
});
