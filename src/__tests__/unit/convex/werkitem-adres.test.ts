// @vitest-environment node
/**
 * `werkitems.resolveAdres` — welk adres een werkitem toont.
 *
 * De ruling van sep 2026 (wens Mickey): wérk gaat naar het uitvoeradres van de
 * klant als dat er is, anders naar het hoofdadres. Een eigen `adres` op het
 * werkitem blijft de hardste override — dat is het vrije veld waarin kantoor
 * "achterom, poort naast nr. 12" kan zetten.
 *
 * Deze suite bewaakt de volgorde: werkitem-adres → uitvoeradres → hoofdadres.
 */

import { describe, it, expect } from "vitest";

import {
  MockConvexStore,
  createMockCtx,
  createMockKlant,
  createMockUser,
  seedMockOrganisatie,
} from "../../helpers/convex-mock";
import type { MutationCtx } from "../../../../convex/_generated/server";
import { createWerkitem, resolveAdres } from "../../../../convex/werkitems";

const hoofdadres = {
  adres: "Hoofdweg 1",
  postcode: "1234 AB",
  plaats: "Meppel",
};

const uitvoerAdres = {
  adres: "Tuinlaan 9",
  postcode: "7941 CD",
  plaats: "Staphorst",
};

describe("resolveAdres", () => {
  it("gebruikt het uitvoeradres van de klant als dat er is", () => {
    expect(resolveAdres({}, { ...hoofdadres, uitvoerAdres })).toBe(
      "Tuinlaan 9, 7941 CD Staphorst"
    );
  });

  it("valt terug op het hoofdadres zonder uitvoeradres", () => {
    expect(resolveAdres({}, hoofdadres)).toBe("Hoofdweg 1, 1234 AB Meppel");
  });

  it("laat een eigen werkitem-adres altijd winnen", () => {
    expect(
      resolveAdres({ adres: "Achterom, poort naast nr. 12" }, {
        ...hoofdadres,
        uitvoerAdres,
      })
    ).toBe("Achterom, poort naast nr. 12");
  });

  it("geeft null zonder klant en zonder eigen adres", () => {
    expect(resolveAdres({}, null)).toBeNull();
  });

  it("geeft null als klant én uitvoeradres helemaal leeg zijn", () => {
    expect(
      resolveAdres(
        {},
        {
          adres: "",
          postcode: "",
          plaats: "",
          uitvoerAdres: { adres: " ", postcode: " ", plaats: " " },
        }
      )
    ).toBeNull();
  });
});

// ─── createWerkitem: welk adres wordt vastgelegd ─────────────────────────────

type CreateArgs = {
  type: "project" | "onderhoudsbeurt";
  klantId: string;
  naam: string;
  adres?: string;
  adresKeuze?: "uitvoer" | "hoofd";
};

const createHandler = (
  createWerkitem as unknown as {
    _handler: (ctx: MutationCtx, args: CreateArgs) => Promise<string>;
  }
)._handler;

function maakCtx(klantVelden: Record<string, unknown>) {
  const store = new MockConvexStore();
  const orgId = seedMockOrganisatie(store);
  const userId = store.insert("users", createMockUser({ role: "directie" }));
  const klantId = store.insert(
    "klanten",
    createMockKlant(userId, { orgId, ...klantVelden })
  );
  const ctx = createMockCtx(store) as unknown as MutationCtx;
  return { ctx, store, klantId };
}

describe("createWerkitem — adresKeuze", () => {
  const metUitvoerAdres = { ...hoofdadres, uitvoerAdres };

  it("legt het uitvoeradres vast bij keuze \"uitvoer\"", async () => {
    const { ctx, store, klantId } = maakCtx(metUitvoerAdres);
    const id = await createHandler(ctx, {
      type: "project",
      klantId,
      naam: "Tuin achter",
      adresKeuze: "uitvoer",
    });
    expect(store.get(id)?.adres).toBe("Tuinlaan 9, 7941 CD Staphorst");
  });

  it("legt het hoofdadres vast bij keuze \"hoofd\"", async () => {
    const { ctx, store, klantId } = maakCtx(metUitvoerAdres);
    const id = await createHandler(ctx, {
      type: "project",
      klantId,
      naam: "Tuin voor",
      adresKeuze: "hoofd",
    });
    expect(store.get(id)?.adres).toBe("Hoofdweg 1, 1234 AB Meppel");
  });

  it("laat het adres leeg zonder keuze — resolveAdres lost het levend op", async () => {
    const { ctx, store, klantId } = maakCtx(metUitvoerAdres);
    const id = await createHandler(ctx, {
      type: "onderhoudsbeurt",
      klantId,
      naam: "Snoeibeurt",
    });
    expect(store.get(id)?.adres).toBeUndefined();
  });

  it("laat een expliciet meegegeven adres altijd winnen", async () => {
    const { ctx, store, klantId } = maakCtx(metUitvoerAdres);
    const id = await createHandler(ctx, {
      type: "project",
      klantId,
      naam: "Tuin zijkant",
      adres: "Achterom, poort naast nr. 12",
      adresKeuze: "uitvoer",
    });
    expect(store.get(id)?.adres).toBe("Achterom, poort naast nr. 12");
  });

  it("valt bij keuze \"uitvoer\" terug op het hoofdadres zonder uitvoeradres", async () => {
    const { ctx, store, klantId } = maakCtx(hoofdadres);
    const id = await createHandler(ctx, {
      type: "project",
      klantId,
      naam: "Tuin",
      adresKeuze: "uitvoer",
    });
    expect(store.get(id)?.adres).toBe("Hoofdweg 1, 1234 AB Meppel");
  });
});
