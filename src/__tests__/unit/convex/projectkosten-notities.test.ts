/**
 * Regressietest voor de latente bug uit de opschoonronde: projectKosten
 * sloeg notities rauw op terwijl de rest van de codebase (klanten,
 * inkooporders, leveranciers) sanitizeOptionalString gebruikt (trim,
 * leeg → undefined). De sanitize is hersteld op create (arbeid- en
 * materiaal-insert) en update.
 */

import { describe, it, expect } from "vitest";
import {
  MockConvexStore,
  createMockCtx,
  createMockUser,
  createMockProject,
} from "../../helpers/convex-mock";
import type { MutationCtx } from "../../../../convex/_generated/server";
import { create } from "../../../../convex/projectKosten";

type CreateArgs = {
  projectId: string;
  type: "arbeid";
  datum: string;
  omschrijving: string;
  hoeveelheid: number;
  prijsPerEenheid: number;
  medewerker: string;
  notities?: string;
};

const createHandler = (
  create as unknown as {
    _handler: (
      ctx: MutationCtx,
      args: CreateArgs
    ) => Promise<{ id: string; type: string; totaal: number }>;
  }
)._handler;

function maakCtxMetProject(): {
  ctx: MutationCtx;
  store: MockConvexStore;
  projectId: string;
} {
  const store = new MockConvexStore();
  store.insert("users", createMockUser({ role: "directie" }));
  const projectId = store.insert(
    "projecten",
    createMockProject("users:1", "offertes:1", { naam: "Tuin Test" })
  );
  const ctx = createMockCtx(store) as unknown as MutationCtx;
  return { ctx, store, projectId };
}

function arbeidArgs(
  projectId: string,
  notities: string | undefined
): CreateArgs {
  return {
    projectId,
    type: "arbeid",
    datum: "2026-07-10",
    omschrijving: "Snoeiwerk",
    hoeveelheid: 2,
    prijsPerEenheid: 65,
    medewerker: "Michel",
    notities,
  };
}

describe("projectKosten.create — notities gesanitized opslaan", () => {
  it("trimt witruimte rond notities", async () => {
    const { ctx, store, projectId } = maakCtxMetProject();
    const result = await createHandler(
      ctx,
      arbeidArgs(projectId, "  met spaties  ")
    );
    const rij = store.get(result.id);
    expect(rij?.notities).toBe("met spaties");
  });

  it("slaat lege of alleen-witruimte notities op als undefined", async () => {
    const { ctx, store, projectId } = maakCtxMetProject();
    const result = await createHandler(ctx, arbeidArgs(projectId, "   "));
    const rij = store.get(result.id);
    expect(rij?.notities).toBeUndefined();
  });

  it("laat gevulde notities inhoudelijk intact", async () => {
    const { ctx, store, projectId } = maakCtxMetProject();
    const result = await createHandler(
      ctx,
      arbeidArgs(projectId, "Extra snoeiafval afgevoerd")
    );
    const rij = store.get(result.id);
    expect(rij?.notities).toBe("Extra snoeiafval afgevoerd");
  });
});
