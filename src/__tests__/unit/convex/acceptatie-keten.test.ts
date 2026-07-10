/**
 * Unit tests acceptatie-keten-kern (convex/acceptatieKeten.ts).
 *
 * De pure beslisregels zijn gedekt in acceptatie-validatie.test.ts; hier
 * testen we het klant-pad-vangnet (PRD §2.5-beleid): accepteert de klant
 * zelf (portaal/publieke link) een vrije offerte zonder herleidbare
 * koppeling, dan ontstaat automatisch één eenmalig project-werkitem met
 * álle regels en de titel "Uit offerte [nummer] — koppeling controleren",
 * zodat de regel "geen acceptatie zonder werkitem" nooit geschonden wordt.
 */

import { describe, it, expect } from "vitest";
import type { MutationCtx } from "../../../../convex/_generated/server";
import type { Doc } from "../../../../convex/_generated/dataModel";
import { maakVangnetWerkitem } from "../../../../convex/acceptatieKeten";

type Insert = { table: string; doc: Record<string, unknown> };

function fakeCtx(inserts: Insert[]): MutationCtx {
  return {
    db: {
      insert: async (table: string, doc: Record<string, unknown>) => {
        inserts.push({ table, doc });
        return "nieuw_id";
      },
    },
  } as unknown as MutationCtx;
}

const vrijeOfferte = {
  _id: "offerte_1",
  userId: "user_1",
  klantId: "klant_1",
  offerteNummer: "2026-042",
  type: "aanleg",
  bron: "vrij",
  regels: [
    { id: "r1", omschrijving: "Graafwerk" },
    { id: "r2", omschrijving: "Bestrating" },
    { id: "r3", omschrijving: "Voorrijkosten" },
  ],
} as unknown as Doc<"offertes">;

describe("maakVangnetWerkitem (klant-acceptatie zonder koppeling)", () => {
  it("maakt één eenmalig project-werkitem met alle regels en controle-titel", async () => {
    const inserts: Insert[] = [];
    const now = 1_750_000_000_000;

    await maakVangnetWerkitem(fakeCtx(inserts), vrijeOfferte, now);

    expect(inserts).toHaveLength(1);
    const { table, doc } = inserts[0];
    expect(table).toBe("projecten");
    expect(doc.type).toBe("project");
    expect(doc.status).toBe("gepland");
    expect(doc.offerteId).toBe("offerte_1");
    expect(doc.klantId).toBe("klant_1");
    // Alle regels gaan mee zodat kantoor ze via de koppel-dialoog kan herverdelen
    expect(doc.offerteRegelIds).toEqual(["r1", "r2", "r3"]);
    // De titel markeert het werkitem expliciet als controlepunt
    expect(doc.naam).toBe("Uit offerte 2026-042 — koppeling controleren");
    expect(doc.createdAt).toBe(now);
    expect(doc.updatedAt).toBe(now);
  });
});
