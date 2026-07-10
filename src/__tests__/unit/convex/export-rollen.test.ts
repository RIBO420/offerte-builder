/**
 * Rollen-test voor export-queries (fase 0, PRD §1.2).
 *
 * Export is kantoor-functionaliteit: exportProjecten moet toegankelijk zijn
 * voor kantoor (directie én projectleider) en met een AuthError weigeren
 * voor alle andere rollen. Dit dekt de pre-existente bug waarbij /projecten
 * crashte voor niet-admin-rollen omdat de pagina een directie-only
 * export-query aanriep (requireAdmin i.p.v. requireKantoor).
 */

import { describe, it, expect } from "vitest";
import {
  MockConvexStore,
  createMockCtx,
  createMockUser,
  createMockProject,
} from "../../helpers/convex-mock";
import type { QueryCtx } from "../../../../convex/_generated/server";
import { exportProjecten } from "../../../../convex/export";
import { AuthError } from "../../../../convex/auth";
import type { UserRole } from "../../../../convex/roles";

// Convex registreert de handler op de functie zelf (func._handler);
// zo testen we de echte query-implementatie tegen de mock-ctx.
const exportProjectenHandler = (
  exportProjecten as unknown as {
    _handler: (ctx: QueryCtx, args: Record<string, never>) => Promise<unknown>;
  }
)._handler;

/** Maakt een ctx waarin precies één user is ingelogd met de gegeven rol. */
function ctxMetRol(role: string): { ctx: QueryCtx; store: MockConvexStore } {
  const store = new MockConvexStore();
  store.insert("users", createMockUser({ role }));
  const ctx = createMockCtx(store) as unknown as QueryCtx;
  return { ctx, store };
}

const KANTOOR_ROLLEN: UserRole[] = ["directie", "projectleider"];
const NIET_KANTOOR_ROLLEN: UserRole[] = [
  "voorman",
  "medewerker",
  "klant",
  "onderaannemer_zzp",
  "materiaalman",
];

describe("exportProjecten — kantoor-functionaliteit (PRD §1.2)", () => {
  describe("kantoor-rollen krijgen exportdata", () => {
    for (const rol of KANTOOR_ROLLEN) {
      it(`staat rol "${rol}" toe`, async () => {
        const { ctx } = ctxMetRol(rol);
        await expect(exportProjectenHandler(ctx, {})).resolves.toEqual([]);
      });
    }

    it("geeft actieve projecten terug voor directie", async () => {
      const { ctx, store } = ctxMetRol("directie");
      store.insert(
        "projecten",
        createMockProject("users:1", "offertes:1", { naam: "Tuin Jansen" })
      );
      const result = (await exportProjectenHandler(ctx, {})) as Array<
        Record<string, unknown>
      >;
      expect(result).toHaveLength(1);
      expect(result[0].projectNaam).toBe("Tuin Jansen");
    });

    it("filtert gearchiveerde en verwijderde projecten uit de export", async () => {
      const { ctx, store } = ctxMetRol("projectleider");
      store.insert(
        "projecten",
        createMockProject("users:1", "offertes:1", { naam: "Actief" })
      );
      store.insert(
        "projecten",
        createMockProject("users:1", "offertes:1", {
          naam: "Archief",
          isArchived: true,
        })
      );
      store.insert(
        "projecten",
        createMockProject("users:1", "offertes:1", {
          naam: "Weg",
          deletedAt: Date.now(),
        })
      );
      const result = (await exportProjectenHandler(ctx, {})) as Array<
        Record<string, unknown>
      >;
      expect(result).toHaveLength(1);
      expect(result[0].projectNaam).toBe("Actief");
    });
  });

  describe("niet-kantoor-rollen worden geweigerd (AuthError, geen crashende pagina meer)", () => {
    for (const rol of NIET_KANTOOR_ROLLEN) {
      it(`weigert rol "${rol}"`, async () => {
        const { ctx } = ctxMetRol(rol);
        await expect(exportProjectenHandler(ctx, {})).rejects.toThrow(
          AuthError
        );
      });
    }

    it("weigert legacy rol \"viewer\"", async () => {
      const { ctx } = ctxMetRol("viewer");
      await expect(exportProjectenHandler(ctx, {})).rejects.toThrow(AuthError);
    });
  });

  it("staat legacy rol \"admin\" (→ directie → kantoor) toe", async () => {
    const { ctx } = ctxMetRol("admin");
    await expect(exportProjectenHandler(ctx, {})).resolves.toEqual([]);
  });
});
