/**
 * Regressietests voor convex/lib/voorcalculatieLookup.ts
 *
 * De bug die dit afdekt: `projecten.offerteId` is optioneel sinds de
 * werkitem-generalisatie (B1). Een query als
 *
 *     .withIndex("by_offerte", (q) => q.eq("offerteId", project.offerteId))
 *     .unique()
 *
 * matcht bij een ontbrekende offerteId ELKE voorcalculatie zónder offerteId —
 * dus alle voorcalculaties die rechtstreeks op een project zijn gemaakt. Bij
 * twee zulke projecten gooide `.unique()` en klapte de projectdetailpagina
 * (en planning, nacalculatie, projectkosten, archief, dashboard, analytics).
 *
 * De nep-db hieronder bootst de Convex-indexsemantiek na, inclusief het
 * matchen op `undefined` en een `unique()` die gooit. Dat laatste is bewust:
 * als de helper alsnog `unique()` zou gebruiken, valt deze test om.
 */

import { describe, it, expect } from "vitest";
import {
  voorcalculatieVanOfferte,
  voorcalculatieVanProject,
  voorcalculatieVoorProject,
} from "../../../../convex/lib/voorcalculatieLookup";

// ─── Nep-database met echte Convex-indexsemantiek ────────────────────────────

type Rij = Record<string, unknown> & { _id: string; _creationTime: number };

const INDEX_VELDEN: Record<string, string[]> = {
  by_project: ["projectId"],
  by_offerte: ["offerteId"],
};

function maakDb(rijen: Rij[]) {
  let queries = 0;

  const db = {
    query(tabel: string) {
      if (tabel !== "voorcalculaties") throw new Error(`onverwachte tabel ${tabel}`);
      queries++;
      let treffers = [...rijen];
      let richting: "asc" | "desc" = "asc";

      const bouwer = {
        withIndex(index: string, fn: (q: unknown) => unknown) {
          const velden = INDEX_VELDEN[index];
          if (!velden) throw new Error(`onbekende index ${index}`);
          const eisen: Array<[string, unknown]> = [];
          fn({
            eq(veld: string, waarde: unknown) {
              eisen.push([veld, waarde]);
              return this;
            },
          });
          // Convex matcht op de exacte waarde — óók als die undefined is.
          treffers = treffers.filter((r) =>
            eisen.every(([veld, waarde]) => r[veld] === waarde)
          );
          return bouwer;
        },
        order(r: "asc" | "desc") {
          richting = r;
          return bouwer;
        },
        async first() {
          const gesorteerd = [...treffers].sort((a, b) =>
            richting === "desc"
              ? b._creationTime - a._creationTime
              : a._creationTime - b._creationTime
          );
          return gesorteerd[0] ?? null;
        },
        async unique() {
          if (treffers.length > 1) {
            throw new Error(
              `unique() query returned more than one result from table voorcalculaties`
            );
          }
          return treffers[0] ?? null;
        },
      };
      return bouwer;
    },
  };

  return { ctx: { db } as never, queryTeller: () => queries };
}

const vc = (
  id: string,
  tijd: number,
  velden: { projectId?: string; offerteId?: string }
): Rij => ({ _id: id, _creationTime: tijd, ...velden });

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("voorcalculatieVanOfferte", () => {
  it("geeft null zonder de db te raken als offerteId ontbreekt", async () => {
    // Dit is de kern van de bug: zonder guard matcht q.eq("offerteId", undefined)
    // alle offerte-loze rijen hieronder.
    const { ctx, queryTeller } = maakDb([
      vc("vc1", 1, { projectId: "p1" }),
      vc("vc2", 2, { projectId: "p2" }),
    ]);

    expect(await voorcalculatieVanOfferte(ctx, undefined)).toBeNull();
    expect(await voorcalculatieVanOfferte(ctx, null)).toBeNull();
    expect(queryTeller()).toBe(0);
  });

  it("vindt de voorcalculatie van de opgegeven offerte", async () => {
    const { ctx } = maakDb([
      vc("vc1", 1, { offerteId: "o1" }),
      vc("vc2", 2, { offerteId: "o2" }),
    ]);

    expect((await voorcalculatieVanOfferte(ctx, "o2" as never))?._id).toBe("vc2");
  });

  it("kiest de nieuwste in plaats van te gooien bij dubbele rijen", async () => {
    const { ctx } = maakDb([
      vc("oud", 100, { offerteId: "o1" }),
      vc("nieuw", 200, { offerteId: "o1" }),
    ]);

    expect((await voorcalculatieVanOfferte(ctx, "o1" as never))?._id).toBe("nieuw");
  });
});

describe("voorcalculatieVanProject", () => {
  it("geeft null zonder de db te raken als projectId ontbreekt", async () => {
    const { ctx, queryTeller } = maakDb([vc("vc1", 1, { offerteId: "o1" })]);

    expect(await voorcalculatieVanProject(ctx, undefined)).toBeNull();
    expect(queryTeller()).toBe(0);
  });

  it("kiest de nieuwste in plaats van te gooien bij dubbele rijen", async () => {
    const { ctx } = maakDb([
      vc("oud", 100, { projectId: "p1" }),
      vc("nieuw", 200, { projectId: "p1" }),
    ]);

    expect((await voorcalculatieVanProject(ctx, "p1" as never))?._id).toBe("nieuw");
  });
});

describe("voorcalculatieVoorProject", () => {
  it("crasht niet op een werkitem zonder offerte terwijl er meer offerte-loze voorcalculaties zijn", async () => {
    // Exact het scenario uit de foutmelding: twee projecten, allebei een eigen
    // voorcalculatie zonder offerteId.
    const { ctx } = maakDb([
      vc("vc-p1", 100, { projectId: "p1" }),
      vc("vc-p2", 200, { projectId: "p2" }),
    ]);

    const gevonden = await voorcalculatieVoorProject(
      ctx,
      { _id: "p1" as never, offerteId: undefined },
      "project"
    );

    expect(gevonden?._id).toBe("vc-p1");
  });

  it("valt terug op de offerte als het project zelf niets heeft", async () => {
    const { ctx } = maakDb([vc("vc-o1", 100, { offerteId: "o1" })]);

    const gevonden = await voorcalculatieVoorProject(
      ctx,
      { _id: "p1" as never, offerteId: "o1" as never },
      "project"
    );

    expect(gevonden?._id).toBe("vc-o1");
  });

  it("respecteert de voorkeur als project én offerte allebei een voorcalculatie hebben", async () => {
    // Bij createFromOfferte met copyVoorcalculatie bestaan beide naast elkaar en
    // kunnen ze uiteenlopen — daarom houdt elke aanroeper zijn eigen volgorde.
    const rijen = [
      vc("kopie-op-project", 200, { projectId: "p1" }),
      vc("origineel-op-offerte", 100, { offerteId: "o1" }),
    ];
    const project = { _id: "p1" as never, offerteId: "o1" as never };

    expect((await voorcalculatieVoorProject(maakDb(rijen).ctx, project, "project"))?._id).toBe(
      "kopie-op-project"
    );
    expect((await voorcalculatieVoorProject(maakDb(rijen).ctx, project, "offerte"))?._id).toBe(
      "origineel-op-offerte"
    );
  });

  it("geeft null als er niets te vinden is", async () => {
    const { ctx } = maakDb([vc("vc-ander", 100, { projectId: "p9" })]);

    expect(
      await voorcalculatieVoorProject(ctx, { _id: "p1" as never, offerteId: undefined })
    ).toBeNull();
  });
});
