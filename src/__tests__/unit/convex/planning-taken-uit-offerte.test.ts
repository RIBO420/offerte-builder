// @vitest-environment node
/**
 * Taken uit offerteregels via de mutations (klantbesluit okt 2026):
 * - werkitems.createWerkitem met toegewezen regels → één taak per regel;
 * - planningTaken.generateFromOfferteRegels → alleen als er nog geen taken zijn;
 * - projecten.create → titel "Klantnaam – werkzaamheden", klant op het project.
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
import { createWerkitem } from "../../../../convex/werkitems";
import { generateFromOfferteRegels } from "../../../../convex/planningTaken";
import { create as createProject } from "../../../../convex/projecten";

function handlerVan<A, R = unknown>(fn: unknown) {
  return (fn as { _handler: (ctx: MutationCtx, args: A) => Promise<R> })._handler;
}

const regels = [
  { id: "r1", scope: "Gazon", omschrijving: "Gazon leggen", eenheid: "uur", hoeveelheid: 6, prijsPerEenheid: 55, totaal: 330, type: "arbeid" },
  { id: "r2", scope: "Gazon", omschrijving: "Graszoden", eenheid: "m²", hoeveelheid: 80, prijsPerEenheid: 7, totaal: 560, type: "materiaal" },
  { id: "r3", scope: "Beplanting", omschrijving: "Hagen planten", eenheid: "uur", hoeveelheid: 4, prijsPerEenheid: 55, totaal: 220, type: "arbeid" },
];

function opzet(offerteVelden: Record<string, unknown> = {}) {
  const store = new MockConvexStore();
  const orgId = seedMockOrganisatie(store);
  const userId = store.insert("users", createMockUser({ role: "directie" }));
  const klantId = store.insert("klanten", createMockKlant(userId, { orgId, naam: "Bakker" }));
  const offerteId = store.insert(
    "offertes",
    createMockOfferte(userId, klantId, {
      orgId,
      status: "geaccepteerd",
      bron: "vrij",
      klant: { naam: "Bakker", adres: "Laan 2", postcode: "1234 AB", plaats: "Delft" },
      regels,
      ...offerteVelden,
    })
  );
  return { store, ctx: createMockCtx(store) as unknown as MutationCtx, orgId, klantId, offerteId };
}

describe("werkitems.createWerkitem met offerteRegelIds", () => {
  it("maakt een taak per toegewezen regel", async () => {
    const { store, ctx, klantId, offerteId } = opzet();

    const werkitemId = await handlerVan<Record<string, unknown>, string>(createWerkitem)(ctx, {
      type: "project",
      klantId,
      naam: "Bakker – Gazon",
      offerteId,
      offerteRegelIds: ["r1", "r2"],
    });

    const taken = store.getAll("planningTaken");
    expect(taken.map((t) => t.taakNaam)).toEqual(["Gazon leggen", "Graszoden"]);
    expect(taken.every((t) => t.projectId === werkitemId)).toBe(true);
  });

  it("maakt geen taken zonder toegewezen regels", async () => {
    const { store, ctx, klantId, offerteId } = opzet();

    await handlerVan<Record<string, unknown>, string>(createWerkitem)(ctx, {
      type: "project",
      klantId,
      naam: "Los werk",
      offerteId,
    });

    expect(store.getAll("planningTaken")).toHaveLength(0);
  });
});

describe("planningTaken.generateFromOfferteRegels", () => {
  function projectBij(store: MockConvexStore, orgId: string, offerteId: string) {
    return store.insert("projecten", {
      orgId,
      type: "project",
      offerteId,
      naam: "Bakker – Gazon en beplanting",
      status: "gepland",
      createdAt: 1,
      updatedAt: 1,
    });
  }

  it("vult taken aan uit alle niet-optionele regels", async () => {
    const { store, ctx, orgId, offerteId } = opzet();
    const projectId = projectBij(store, orgId, offerteId);

    const resultaat = await handlerVan<{ projectId: string }, { count: number }>(
      generateFromOfferteRegels
    )(ctx, { projectId });

    expect(resultaat.count).toBe(3);
    expect(store.getAll("planningTaken")).toHaveLength(3);
  });

  it("weigert als het project al taken heeft — nooit dubbel", async () => {
    const { store, ctx, orgId, offerteId } = opzet();
    const projectId = projectBij(store, orgId, offerteId);
    store.insert("planningTaken", {
      projectId,
      scope: "Gazon",
      taakNaam: "Zelf toegevoegd",
      normUren: 2,
      geschatteDagen: 0.17,
      volgorde: 0,
      status: "gepland",
    });

    await expect(
      handlerVan<{ projectId: string }>(generateFromOfferteRegels)(ctx, { projectId })
    ).rejects.toThrow(/al taken/);
    expect(store.getAll("planningTaken")).toHaveLength(1);
  });

  it("weigert een project van een andere organisatie", async () => {
    const { store, ctx, offerteId } = opzet();
    const projectId = projectBij(store, "organisaties:andere", offerteId);

    await expect(
      handlerVan<{ projectId: string }>(generateFromOfferteRegels)(ctx, { projectId })
    ).rejects.toThrow();
    expect(store.getAll("planningTaken")).toHaveLength(0);
  });
});

describe("projecten.create (Nieuw project)", () => {
  it("stelt de titel voor als Klantnaam – werkzaamheden en zet de klant op het project", async () => {
    const { store, ctx, klantId, offerteId } = opzet();

    const projectId = await handlerVan<{ offerteId: string }, string>(createProject)(ctx, {
      offerteId,
    });

    const project = store.get(projectId);
    expect(project?.naam).toBe("Bakker – Gazon en beplanting");
    expect(project?.klantId).toBe(klantId);
    expect(store.getAll("planningTaken")).toHaveLength(3);
  });

  it("houdt een eigen titel aan", async () => {
    const { store, ctx, offerteId } = opzet();

    const projectId = await handlerVan<{ offerteId: string; naam: string }, string>(createProject)(
      ctx,
      { offerteId, naam: "  Bakker – voortuin  " }
    );

    expect(store.get(projectId)?.naam).toBe("Bakker – voortuin");
  });
});
