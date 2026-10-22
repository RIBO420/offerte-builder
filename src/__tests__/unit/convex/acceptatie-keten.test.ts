/**
 * Unit tests acceptatie-keten-kern (convex/acceptatieKeten.ts).
 *
 * De pure beslisregels zijn gedekt in acceptatie-validatie.test.ts; hier
 * testen we wat er bij akkoord ontstaat (klantbesluit okt 2026):
 * - een vrije offerte maakt zelf een project met de niet-optionele regels,
 *   de arbeidsuren als begroting en één planningstaak per regel;
 * - de titel is "Klantnaam – werkzaamheden", ook in het vangnet voor
 *   klant-acceptatie zonder herleidbare keten;
 * - de aanleg-wizard houdt zijn project zonder regel-toewijzing.
 */

import { describe, it, expect } from "vitest";
import {
  MockConvexStore,
  createMockCtx,
  createMockUser,
  createMockKlant,
  createMockOfferte,
  seedMockOrganisatie,
} from "../../helpers/convex-mock";
import type { MutationCtx } from "../../../../convex/_generated/server";
import type { Doc } from "../../../../convex/_generated/dataModel";
import {
  maakVangnetWerkitem,
  voerKetenActieUit,
  voerKlantAcceptatieKetenUit,
} from "../../../../convex/acceptatieKeten";

const now = 1_750_000_000_000;

const vrijeRegels = [
  { id: "r1", scope: "Grondwerk", omschrijving: "Ontgraven", eenheid: "uur", hoeveelheid: 8, prijsPerEenheid: 55, totaal: 440, type: "arbeid" },
  { id: "r2", scope: "Bestrating", omschrijving: "Betontegels", eenheid: "m²", hoeveelheid: 30, prijsPerEenheid: 25, totaal: 750, type: "materiaal" },
  { id: "r3", scope: "Bestrating", omschrijving: "Tegels leggen", eenheid: "uur", hoeveelheid: 12, prijsPerEenheid: 55, totaal: 660, type: "arbeid" },
  { id: "r4", scope: "Vijver", omschrijving: "Vijver (optie)", eenheid: "st", hoeveelheid: 1, prijsPerEenheid: 900, totaal: 900, type: "materiaal", optioneel: true },
];

function maakOfferte(velden: Record<string, unknown>) {
  const store = new MockConvexStore();
  const orgId = seedMockOrganisatie(store);
  const userId = store.insert("users", createMockUser({ role: "directie" }));
  const klantId = store.insert("klanten", createMockKlant(userId, { orgId, naam: "Jansen" }));
  const offerteId = store.insert(
    "offertes",
    createMockOfferte(userId, klantId, {
      orgId,
      status: "geaccepteerd",
      offerteNummer: "2026-042",
      klant: { naam: "Jansen", adres: "Dorpsstraat 1", postcode: "1234 AB", plaats: "Leiden" },
      ...velden,
    })
  );
  const ctx = createMockCtx(store) as unknown as MutationCtx;
  const offerte = store.get(offerteId) as unknown as Doc<"offertes">;
  return { store, ctx, offerte, offerteId, klantId };
}

describe("vrije offerte: akkoord maakt een project", () => {
  it("met titel, niet-optionele regels, arbeidsuren en een taak per regel", async () => {
    const { store, ctx, offerte, offerteId, klantId } = maakOfferte({
      bron: "vrij",
      regels: vrijeRegels,
      totalen: { ...createMockOfferte("u", "k").totalen as object, totaalUren: 0 },
    });

    await voerKetenActieUit(ctx, offerte, "project_aanmaken", now);

    const projecten = store.getAll("projecten");
    expect(projecten).toHaveLength(1);
    const project = projecten[0];
    expect(project.naam).toBe("Jansen – Grondwerk en bestrating");
    expect(project.offerteId).toBe(offerteId);
    expect(project.klantId).toBe(klantId);
    expect(project.offerteRegelIds).toEqual(["r1", "r2", "r3"]);
    expect(project.geschatteUren).toBe(20);

    const taken = store
      .getAll("planningTaken")
      .sort((a, b) => (a.volgorde as number) - (b.volgorde as number));
    expect(taken.map((t) => [t.scope, t.taakNaam, t.normUren])).toEqual([
      ["Grondwerk", "Ontgraven", 8],
      ["Bestrating", "Betontegels", 0],
      ["Bestrating", "Tegels leggen", 12],
    ]);
    expect(taken.every((t) => t.projectId === project._id && t.status === "gepland")).toBe(true);
  });

  it("klant-acceptatie van een vrije offerte gaat via hetzelfde project, niet het vangnet", async () => {
    const { store, ctx, offerte } = maakOfferte({ bron: "vrij", regels: vrijeRegels });

    await voerKlantAcceptatieKetenUit(ctx, offerte, now);

    const projecten = store.getAll("projecten");
    expect(projecten).toHaveLength(1);
    expect(projecten[0].naam).toBe("Jansen – Grondwerk en bestrating");
    expect(store.getAll("planningTaken")).toHaveLength(3);
  });

  it("maakt niets dubbel als kantoor al een werkitem koppelde", async () => {
    const { store, ctx, offerte, offerteId } = maakOfferte({ bron: "vrij", regels: vrijeRegels });
    store.insert("projecten", {
      orgId: offerte.orgId,
      type: "project",
      offerteId,
      naam: "Al gekoppeld",
      status: "gepland",
      createdAt: now,
      updatedAt: now,
    });

    await voerKlantAcceptatieKetenUit(ctx, offerte, now);

    expect(store.getAll("projecten")).toHaveLength(1);
    expect(store.getAll("planningTaken")).toHaveLength(0);
  });
});

describe("aanleg-wizard: project zonder regel-toewijzing", () => {
  it("heet naar klant en scopes en houdt de begrote uren van de offerte", async () => {
    const { store, ctx, offerte } = maakOfferte({
      scopes: ["grondwerk", "gras"],
      regels: [
        { id: "w1", scope: "grondwerk", omschrijving: "Ontgraven", eenheid: "uur", hoeveelheid: 6, prijsPerEenheid: 50, totaal: 300, type: "arbeid" },
        { id: "w2", scope: "gras", omschrijving: "Graszoden", eenheid: "m²", hoeveelheid: 50, prijsPerEenheid: 8, totaal: 400, type: "materiaal" },
        { id: "w3", scope: "algemeen", omschrijving: "Voorbereiding", eenheid: "vast", hoeveelheid: 1, prijsPerEenheid: 75, totaal: 75, type: "arbeid" },
      ],
    });

    await voerKetenActieUit(ctx, offerte, "project_aanmaken", now);

    const project = store.getAll("projecten")[0];
    expect(project.naam).toBe("Jansen – Grondwerk en gras");
    expect(project.offerteRegelIds).toBeUndefined();
    expect(project.geschatteUren).toBe(40); // totalen.totaalUren uit de mock
    // Wizard: alleen de twee arbeidsregels worden een taak, het materiaal niet
    expect(store.getAll("planningTaken").map((t) => t.taakNaam)).toEqual(["Ontgraven", "Voorbereiding"]);
  });
});

describe("maakVangnetWerkitem (klant-acceptatie zonder keten)", () => {
  it("maakt één project met de niet-optionele regels, de nieuwe titel en taken", async () => {
    const { store, ctx, offerte, offerteId, klantId } = maakOfferte({ bron: "vrij", regels: vrijeRegels });

    await maakVangnetWerkitem(ctx, offerte, now);

    const projecten = store.getAll("projecten");
    expect(projecten).toHaveLength(1);
    const doc = projecten[0];
    expect(doc.type).toBe("project");
    expect(doc.status).toBe("gepland");
    expect(doc.offerteId).toBe(offerteId);
    expect(doc.klantId).toBe(klantId);
    expect(doc.offerteRegelIds).toEqual(["r1", "r2", "r3"]);
    expect(doc.naam).toBe("Jansen – Grondwerk en bestrating");
    expect(doc.createdAt).toBe(now);
    expect(store.getAll("planningTaken")).toHaveLength(3);
  });

  it("valt voor de klantnaam terug op het klantrecord", async () => {
    const { store, ctx, offerte } = maakOfferte({ regels: vrijeRegels, klant: undefined });

    await maakVangnetWerkitem(ctx, offerte, now);

    expect(store.getAll("projecten")[0].naam).toBe("Jansen – Grondwerk en bestrating");
  });
});
