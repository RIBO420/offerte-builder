/**
 * Regressietests voor "Start project" bij een geaccepteerde offerte
 * (convex/projecten.ts `create`).
 *
 * De bug: `create` eiste een voorcalculatie-RECORD voor élke geaccepteerde
 * offerte. Vrije offertes (PRD §2.5b) kennen die stap per ontwerp niet en
 * onderhoud loopt via bouwstenen/contract (§2.1) — daar was de knop dus een
 * doodlopende weg met een serverfout. De voorcalculatie-eis geldt nu alleen
 * waar de flow die stap kent (`heeftVoorcalculatieStap`, dezelfde regel als de
 * acceptatie-keten in convex/acceptatieRegels.ts).
 */

import { describe, it, expect } from "vitest";
import {
  MockConvexStore,
  createMockCtx,
  createMockUser,
  createMockKlant,
  createMockOfferte,
} from "../../helpers/convex-mock";
import type { MutationCtx } from "../../../../convex/_generated/server";
import { create } from "../../../../convex/projecten";
import { heeftVoorcalculatieStap } from "../../../../convex/acceptatieRegels";

type CreateArgs = {
  offerteId: string;
  naam?: string;
  copyVoorcalculatie?: boolean;
};

const createHandler = (
  create as unknown as {
    _handler: (ctx: MutationCtx, args: CreateArgs) => Promise<string>;
  }
)._handler;

/** Geaccepteerde offerte in een verse store; `metVoorcalculatie` zet het record. */
function maakCtx(
  offerteVelden: Record<string, unknown>,
  metVoorcalculatie = false
): { ctx: MutationCtx; store: MockConvexStore; offerteId: string } {
  const store = new MockConvexStore();
  const userId = store.insert("users", createMockUser({ role: "directie" }));
  const klantId = store.insert("klanten", createMockKlant(userId));
  const offerteId = store.insert(
    "offertes",
    createMockOfferte(userId, klantId, {
      status: "geaccepteerd",
      ...offerteVelden,
    })
  );

  if (metVoorcalculatie) {
    store.insert("voorcalculaties", {
      userId,
      offerteId,
      teamGrootte: 3,
      teamleden: ["Michel", "Sander", "Rick"],
      effectieveUrenPerDag: 7,
      normUrenTotaal: 42,
      geschatteDagen: 2,
      normUrenPerScope: { grondwerk: 42 },
      createdAt: Date.now(),
    });
  }

  return {
    ctx: createMockCtx(store) as unknown as MutationCtx,
    store,
    offerteId,
  };
}

describe("heeftVoorcalculatieStap (welke offerte kent de stap?)", () => {
  it("geldt voor de aanleg-wizard", () => {
    expect(heeftVoorcalculatieStap({ type: "aanleg", bron: "wizard" })).toBe(true);
  });

  it("geldt ook zonder bron (oudere offertes uit de wizard)", () => {
    expect(heeftVoorcalculatieStap({ type: "aanleg" })).toBe(true);
  });

  it("geldt niet voor vrije offertes (PRD §2.5b)", () => {
    expect(heeftVoorcalculatieStap({ type: "aanleg", bron: "vrij" })).toBe(false);
  });

  it("geldt niet voor onderhoud (route 1 → contract)", () => {
    expect(heeftVoorcalculatieStap({ type: "onderhoud", bron: "wizard" })).toBe(
      false
    );
  });
});

describe("projecten.create — voorcalculatie alleen eisen waar de flow die kent", () => {
  it("maakt een project voor een vrije offerte zonder voorcalculatie", async () => {
    const { ctx, store, offerteId } = maakCtx({ type: "aanleg", bron: "vrij" });

    const projectId = await createHandler(ctx, { offerteId });

    const project = store.get(projectId);
    expect(project?.status).toBe("gepland");
    expect(project?.offerteId).toBe(offerteId);
    expect(store.getAll("projecten")).toHaveLength(1);
  });

  it("maakt een project voor een onderhoud-offerte zonder voorcalculatie", async () => {
    const { ctx, store, offerteId } = maakCtx({
      type: "onderhoud",
      bron: "wizard",
    });

    const projectId = await createHandler(ctx, { offerteId });

    expect(store.get(projectId)?.status).toBe("gepland");
  });

  it("weigert de aanleg-wizard zonder voorcalculatie en wijst de weg", async () => {
    const { ctx, store, offerteId } = maakCtx({
      type: "aanleg",
      bron: "wizard",
    });

    await expect(createHandler(ctx, { offerteId })).rejects.toThrow(
      /voorcalculatie/i
    );
    // De melding verwijst naar de voorcalculatie bij de offerte
    await expect(createHandler(ctx, { offerteId })).rejects.toThrow(
      /Maak eerst een voorcalculatie aan bij de offerte/
    );
    expect(store.getAll("projecten")).toHaveLength(0);
  });

  it("maakt een project voor de aanleg-wizard mét voorcalculatie", async () => {
    const { ctx, store, offerteId } = maakCtx(
      { type: "aanleg", bron: "wizard" },
      true
    );

    const projectId = await createHandler(ctx, { offerteId });

    expect(store.get(projectId)?.status).toBe("gepland");
  });

  it("kopieert geen lege voorcalculatie bij een vrije offerte", async () => {
    const { ctx, store, offerteId } = maakCtx({ type: "aanleg", bron: "vrij" });

    await createHandler(ctx, { offerteId, copyVoorcalculatie: true });

    expect(store.getAll("voorcalculaties")).toHaveLength(0);
  });

  it("blijft de acceptatie-eis handhaven: geen project bij een concept", async () => {
    const { ctx, offerteId } = maakCtx({
      type: "aanleg",
      bron: "vrij",
      status: "concept",
    });

    await expect(createHandler(ctx, { offerteId })).rejects.toThrow(
      /geaccepteerd/
    );
  });
});
