// @vitest-environment node
/**
 * Klant zichtbaar op elk project en de titel aanpasbaar (klantbesluit okt 2026):
 * - projecten.getWithDetails laadt de klant via project.klantId (lead-projecten
 *   hebben geen offerte), met terugval op de klant van de offerte, en alleen
 *   binnen de eigen organisatie;
 * - projecten.update weigert een lege of te lange titel.
 */

import { describe, it, expect } from "vitest";
import {
  MockConvexStore,
  createMockCtx,
  createMockKlant,
  createMockOfferte,
  createMockUser,
  seedMockOrganisatie,
} from "../../helpers/convex-mock";
import type { MutationCtx } from "../../../../convex/_generated/server";
import { getWithDetails, update } from "../../../../convex/projecten";

function handlerVan<A, R = unknown>(fn: unknown) {
  return (fn as { _handler: (ctx: MutationCtx, args: A) => Promise<R> })._handler;
}

type Details = { klant: { _id: string; naam: string } | null } | null;

function opzet() {
  const store = new MockConvexStore();
  const orgId = seedMockOrganisatie(store);
  const userId = store.insert("users", createMockUser({ role: "directie" }));
  const klantId = store.insert("klanten", createMockKlant(userId, { orgId, naam: "Visser" }));
  return { store, ctx: createMockCtx(store) as unknown as MutationCtx, orgId, userId, klantId };
}

function project(store: MockConvexStore, velden: Record<string, unknown>) {
  return store.insert("projecten", {
    type: "project",
    naam: "Visser – Tuinaanleg",
    status: "gepland",
    createdAt: 1,
    updatedAt: 1,
    ...velden,
  });
}

describe("projecten.getWithDetails: klant", () => {
  it("laadt de klant via project.klantId, ook zonder offerte", async () => {
    const { store, ctx, orgId, klantId } = opzet();
    const id = project(store, { orgId, klantId });

    const details = await handlerVan<{ id: string }, Details>(getWithDetails)(ctx, { id });

    expect(details?.klant).toEqual({ _id: klantId, naam: "Visser" });
  });

  it("valt terug op de klant van de offerte", async () => {
    const { store, ctx, orgId, userId, klantId } = opzet();
    const offerteId = store.insert("offertes", createMockOfferte(userId, klantId, { orgId }));
    const id = project(store, { orgId, offerteId });

    const details = await handlerVan<{ id: string }, Details>(getWithDetails)(ctx, { id });

    expect(details?.klant?._id).toBe(klantId);
  });

  it("toont geen klant van een andere organisatie", async () => {
    const { store, ctx, orgId, userId } = opzet();
    const vreemd = store.insert(
      "klanten",
      createMockKlant(userId, { orgId: "organisaties:andere", naam: "Buurman" })
    );
    const id = project(store, { orgId, klantId: vreemd });

    const details = await handlerVan<{ id: string }, Details>(getWithDetails)(ctx, { id });

    expect(details?.klant).toBeNull();
  });
});

describe("projecten.update: titel wijzigen", () => {
  it("slaat een opgeschoonde titel op", async () => {
    const { store, ctx, orgId, klantId } = opzet();
    const id = project(store, { orgId, klantId });

    await handlerVan<{ id: string; naam: string }>(update)(ctx, {
      id,
      naam: "  Visser   – achtertuin ",
    });

    expect(store.get(id)?.naam).toBe("Visser – achtertuin");
  });

  it("weigert een lege of te lange titel", async () => {
    const { store, ctx, orgId, klantId } = opzet();
    const id = project(store, { orgId, klantId });
    const h = handlerVan<{ id: string; naam: string }>(update);

    await expect(h(ctx, { id, naam: "   " })).rejects.toThrow(/titel/);
    await expect(h(ctx, { id, naam: "x".repeat(121) })).rejects.toThrow(/te lang/);
    expect(store.get(id)?.naam).toBe("Visser – Tuinaanleg");
  });
});
