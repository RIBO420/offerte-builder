/**
 * Rollen-test voor export-queries (fase 0, PRD §1.2).
 *
 * Export is kantoor-functionaliteit: alle entiteit-exports (offertes,
 * klanten, projecten, facturen, uren) moeten toegankelijk zijn voor kantoor
 * (directie én projectleider) en met een AuthError weigeren voor alle andere
 * rollen. Dit dekt de pre-existente bug waarbij lijstpagina's crashten voor
 * niet-admin-rollen omdat ze een directie-only export-query aanriepen
 * (requireAdmin i.p.v. requireKantoor).
 *
 * Uitzondering: exportMedewerkers blijft bewust directie-only (HR-gegevens,
 * AVG) — ook dat gedrag is hier vastgelegd.
 */

import { describe, it, expect } from "vitest";
import {
  MockConvexStore,
  createMockCtx,
  createMockUser,
  createMockProject,
  seedMockOrganisatie,
} from "../../helpers/convex-mock";
import type { QueryCtx } from "../../../../convex/_generated/server";
import {
  exportOffertes,
  exportKlanten,
  exportProjecten,
  exportFacturen,
  exportUren,
  exportMedewerkers,
} from "../../../../convex/export";
import { AuthError } from "../../../../convex/auth";
import type { UserRole } from "../../../../convex/roles";

// Convex registreert de handler op de functie zelf (func._handler);
// zo testen we de echte query-implementatie tegen de mock-ctx.
type ExportHandler = (
  ctx: QueryCtx,
  args: Record<string, unknown>
) => Promise<unknown>;

function handlerVan(fn: unknown): ExportHandler {
  return (fn as { _handler: ExportHandler })._handler;
}

const exportProjectenHandler = handlerVan(exportProjecten);

/** Alle entiteit-exports die voor kantoor open moeten staan (PRD §1.2). */
const KANTOOR_EXPORTS: Array<{ naam: string; handler: ExportHandler }> = [
  { naam: "exportOffertes", handler: handlerVan(exportOffertes) },
  { naam: "exportKlanten", handler: handlerVan(exportKlanten) },
  { naam: "exportProjecten", handler: exportProjectenHandler },
  { naam: "exportFacturen", handler: handlerVan(exportFacturen) },
  { naam: "exportUren", handler: handlerVan(exportUren) },
];

/**
 * Maakt een ctx waarin precies één user is ingelogd met de gegeven rol, binnen
 * de organisatie uit het `org_id`-claim van createMockCtx. Sinds fase 3 scopen
 * de exports op die organisatie (requireOrgId): zonder deze rij weigert elke
 * export met een AuthError over een ontbrekende organisatie.
 */
function ctxMetRol(role: string): {
  ctx: QueryCtx;
  store: MockConvexStore;
  orgId: string;
} {
  const store = new MockConvexStore();
  const orgId = seedMockOrganisatie(store);
  store.insert("users", createMockUser({ role }));
  const ctx = createMockCtx(store) as unknown as QueryCtx;
  return { ctx, store, orgId };
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
      const { ctx, store, orgId } = ctxMetRol("directie");
      store.insert(
        "projecten",
        createMockProject("users:1", "offertes:1", {
          orgId,
          naam: "Tuin Jansen",
        })
      );
      const result = (await exportProjectenHandler(ctx, {})) as Array<
        Record<string, unknown>
      >;
      expect(result).toHaveLength(1);
      expect(result[0].projectNaam).toBe("Tuin Jansen");
    });

    it("filtert gearchiveerde en verwijderde projecten uit de export", async () => {
      const { ctx, store, orgId } = ctxMetRol("projectleider");
      store.insert(
        "projecten",
        createMockProject("users:1", "offertes:1", { orgId, naam: "Actief" })
      );
      store.insert(
        "projecten",
        createMockProject("users:1", "offertes:1", {
          orgId,
          naam: "Archief",
          isArchived: true,
        })
      );
      store.insert(
        "projecten",
        createMockProject("users:1", "offertes:1", {
          orgId,
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

describe("alle entiteit-exports — kantoor-functionaliteit (PRD §1.2)", () => {
  for (const { naam, handler } of KANTOOR_EXPORTS) {
    describe(naam, () => {
      for (const rol of KANTOOR_ROLLEN) {
        it(`staat rol "${rol}" toe`, async () => {
          const { ctx } = ctxMetRol(rol);
          await expect(handler(ctx, {})).resolves.toEqual([]);
        });
      }

      for (const rol of NIET_KANTOOR_ROLLEN) {
        it(`weigert rol "${rol}"`, async () => {
          const { ctx } = ctxMetRol(rol);
          await expect(handler(ctx, {})).rejects.toThrow(AuthError);
        });
      }

      it('weigert legacy rol "viewer"', async () => {
        const { ctx } = ctxMetRol("viewer");
        await expect(handler(ctx, {})).rejects.toThrow(AuthError);
      });
    });
  }
});

describe("exportMedewerkers — bewust directie-only (HR-gegevens, AVG)", () => {
  const handler = handlerVan(exportMedewerkers);

  it('staat rol "directie" toe', async () => {
    const { ctx } = ctxMetRol("directie");
    await expect(handler(ctx, {})).resolves.toEqual([]);
  });

  it('weigert rol "projectleider" (kantoor, maar geen directie)', async () => {
    const { ctx } = ctxMetRol("projectleider");
    await expect(handler(ctx, {})).rejects.toThrow(AuthError);
  });

  /**
   * De rolcheck (`requireAdmin`) staat bewust vóór de org-scope
   * (`requireOrgId`) in de handler: het lidmaatschap van een organisatie is
   * géén toegang tot HR-gegevens. Zonder deze tests dekte dit blok alleen
   * directie en projectleider, waardoor een latere versoepeling naar
   * `requireKantoor` — of het wegvallen van de rolcheck — de veldrollen stil
   * bij de uurtarieven en contracttypes van het hele bedrijf zou brengen.
   */
  for (const rol of NIET_KANTOOR_ROLLEN) {
    it(`weigert veld-/externe rol "${rol}"`, async () => {
      const { ctx } = ctxMetRol(rol);
      await expect(handler(ctx, {})).rejects.toThrow(AuthError);
    });
  }

  it('weigert legacy rol "viewer"', async () => {
    const { ctx } = ctxMetRol("viewer");
    await expect(handler(ctx, {})).rejects.toThrow(AuthError);
  });
});
