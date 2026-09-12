/**
 * Route-knop van de materiaaldelta (PRD §2.6/§8.5, stap 9a).
 *
 * Ruling sep 2026: wérk gaat naar het uitvoeradres van de klant, de rekening
 * naar het hoofdadres. `getDeltaChecklist` bouwt de Maps-link waarmee de
 * monteur na het afvinken wegrijdt, dus staat hier vast dat die link het
 * uitvoeradres aanwijst — en het hoofdadres alleen als de klant geen
 * uitvoeradres heeft. Het eigen adres van het werkitem gaat voor allebei.
 */

import { describe, it, expect } from "vitest";
import { getDeltaChecklist } from "../../../../convex/materiaalDelta";
import {
  MockConvexStore,
  createMockCtx,
  createMockKlant,
  createMockUser,
  seedMockOrganisatie,
} from "../../helpers/convex-mock";

const DATUM = "2026-07-21";
const HOOFD = { adres: "Hoofdweg 1", postcode: "1234 AB", plaats: "Meppel" };
const UITVOER = { adres: "Tuinlaan 9", postcode: "7941 CD", plaats: "Staphorst" };
const HOOFD_REGEL = "Hoofdweg 1, 1234 AB Meppel";
const UITVOER_REGEL = "Tuinlaan 9, 7941 CD Staphorst";

type Checklist = { adres: string | null; mapsUrl: string | null };

const checklistHandler = (
  getDeltaChecklist as unknown as {
    _handler: (
      ctx: unknown,
      args: { werkitemId: string; datum: string }
    ) => Promise<Checklist>;
  }
)._handler;

function wereld(
  klantVelden: Record<string, unknown>,
  werkitemVelden: Record<string, unknown> = {}
) {
  const store = new MockConvexStore();
  const orgId = seedMockOrganisatie(store);
  const userId = store.insert("users", createMockUser({ role: "voorman" }));
  const klantId = store.insert(
    "klanten",
    createMockKlant(userId, { orgId, ...HOOFD, ...klantVelden })
  );
  const werkitemId = store.insert("projecten", {
    orgId,
    userId,
    type: "onderhoudsbeurt",
    klantId,
    naam: "Snoeibeurt",
    status: "gepland",
    geplandeStart: DATUM,
    geplandeEind: DATUM,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...werkitemVelden,
  });
  return { ctx: createMockCtx(store), werkitemId };
}

const maps = (adres: string) =>
  `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(adres)}`;

describe("getDeltaChecklist — adres van de route-knop", () => {
  it("stuurt de monteur naar het uitvoeradres, niet naar het hoofdadres", async () => {
    const { ctx, werkitemId } = wereld({ uitvoerAdres: UITVOER });

    const checklist = await checklistHandler(ctx, { werkitemId, datum: DATUM });

    expect(checklist.adres).toBe(UITVOER_REGEL);
    expect(checklist.mapsUrl).toBe(maps(UITVOER_REGEL));
    expect(checklist.mapsUrl).not.toContain("Hoofdweg");
  });

  it("valt zonder uitvoeradres terug op het hoofdadres", async () => {
    const { ctx, werkitemId } = wereld({});

    const checklist = await checklistHandler(ctx, { werkitemId, datum: DATUM });

    expect(checklist.adres).toBe(HOOFD_REGEL);
    expect(checklist.mapsUrl).toBe(maps(HOOFD_REGEL));
  });

  it("houdt het eigen adres van het werkitem aan als dat er is", async () => {
    const { ctx, werkitemId } = wereld(
      { uitvoerAdres: UITVOER },
      { adres: "Kwekerijweg 1, Boskoop" }
    );

    const checklist = await checklistHandler(ctx, { werkitemId, datum: DATUM });

    expect(checklist.adres).toBe("Kwekerijweg 1, Boskoop");
    expect(checklist.mapsUrl).toBe(maps("Kwekerijweg 1, Boskoop"));
  });
});
