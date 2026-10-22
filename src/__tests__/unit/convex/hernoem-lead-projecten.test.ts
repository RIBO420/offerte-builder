// @vitest-environment node
/**
 * Migratie hernoemLeadProjecten: oude lead-projecten ("[Tuinaanleg] Hallo…")
 * krijgen de titel "Klantnaam – werkzaamheden"; verder blijft alles staan.
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
import {
  isLeadProjectNaam,
  leesbaarOnderwerp,
  nieuweLeadProjectNaam,
  run,
} from "../../../../convex/migrations/hernoemLeadProjecten";

type Rapport = {
  kandidaten: number;
  hernoemd: number;
  zonderOnderwerp: number;
  aanvraagNietInDossier: number;
  gewonnenLeadsOpBord: number | null;
  overgeslagen: Array<{ projectId: string; reden: string }>;
  voorstellen: Array<{ projectId: string; oudeNaamKort: string; nieuweNaam: string }>;
};

const runHandler = (run as unknown as {
  _handler: (ctx: MutationCtx, args: Record<string, unknown>) => Promise<Rapport>;
})._handler;

describe("pure regels", () => {
  it("herkent lead-projecten: zonder offerte, naam met [ of te lang", () => {
    expect(isLeadProjectNaam({ naam: "[Tuinaanleg] Hallo" })).toBe(true);
    expect(isLeadProjectNaam({ naam: "x".repeat(81) })).toBe(true);
    expect(isLeadProjectNaam({ naam: "Jansen – Gazon" })).toBe(false);
    expect(isLeadProjectNaam({ naam: "[Tuinaanleg] Hallo", offerteId: "offertes:1" })).toBe(false);
  });

  it("maakt een leesbaar onderwerp en laat nietszeggende weg", () => {
    expect(leesbaarOnderwerp("tuinaanleg")).toBe("Tuinaanleg");
    expect(leesbaarOnderwerp("Reiniging")).toBe("Reiniging");
    expect(leesbaarOnderwerp("anders")).toBeNull();
    expect(leesbaarOnderwerp(undefined)).toBeNull();
  });

  it("neemt het label uit de naam, anders het onderwerp van de lead", () => {
    expect(
      nieuweLeadProjectNaam({ oudeNaam: "[Tuinaanleg] Wij willen…", klantNaam: "Jansen" }).naam
    ).toBe("Jansen – Tuinaanleg");
    expect(
      nieuweLeadProjectNaam({
        oudeNaam: "Hallo, wij hebben een grote tuin ".repeat(4),
        klantNaam: "Jansen",
        leadOnderwerp: "tuinonderhoud",
      }).naam
    ).toBe("Jansen – Tuinonderhoud");
    expect(
      nieuweLeadProjectNaam({ oudeNaam: "[Anders] vraag", klantNaam: "Jansen" })
    ).toEqual({ naam: "Jansen", onderwerp: null });
  });
});

describe("run", () => {
  function opzet() {
    const store = new MockConvexStore();
    const orgId = seedMockOrganisatie(store);
    const userId = store.insert("users", createMockUser({ role: "directie" }));
    const klantId = store.insert("klanten", createMockKlant(userId, { orgId, naam: "De Boer" }));
    const leadId = store.insert("configuratorAanvragen", {
      orgId,
      type: "contact",
      status: "nieuw",
      pipelineStatus: "gewonnen",
      gekoppeldKlantId: klantId,
      referentie: "TOP-WEB-1",
      klantNaam: "De Boer",
      klantEmail: "boer@example.nl",
      omschrijving: "Wij willen graag een nieuwe tuin met veel groen en een terras achter het huis, graag met verlichting",
      specificaties: { onderwerp: "tuinaanleg", bericht: "…" },
      createdAt: 1,
      updatedAt: 1,
    });
    const leadProject = store.insert("projecten", {
      orgId,
      type: "project",
      klantId,
      naam: "Wij willen graag een nieuwe tuin met veel groen en een terras achter het huis, graag met verlichting",
      status: "gepland",
      createdAt: 1,
      updatedAt: 1,
    });
    store.insert("leadActiviteiten", {
      leadId,
      type: "status_wijziging",
      beschrijving: "Lead gewonnen",
      metadata: { werkitemId: leadProject, gekoppeldKlantId: klantId },
      createdAt: 2,
    });
    const metLabel = store.insert("projecten", {
      orgId,
      type: "project",
      klantId,
      naam: "[Reiniging] Graag de oprit reinigen",
      status: "gepland",
      createdAt: 1,
      updatedAt: 1,
    });
    const normaal = store.insert("projecten", {
      orgId,
      type: "project",
      klantId,
      naam: "De Boer – Gazon",
      status: "gepland",
      createdAt: 1,
      updatedAt: 1,
    });
    return { store, ctx: createMockCtx(store) as unknown as MutationCtx, orgId, leadProject, metLabel, normaal };
  }

  it("dry run stelt nieuwe namen voor en schrijft niets", async () => {
    const { store, ctx, leadProject, metLabel, normaal } = opzet();

    const rapport = await runHandler(ctx, {});

    expect(rapport.kandidaten).toBe(2);
    expect(rapport.hernoemd).toBe(0);
    const perId = Object.fromEntries(rapport.voorstellen.map((v) => [v.projectId, v]));
    expect(perId[leadProject].nieuweNaam).toBe("De Boer – Tuinaanleg");
    expect(perId[leadProject].oudeNaamKort).toHaveLength(50);
    expect(perId[metLabel].nieuweNaam).toBe("De Boer – Reiniging");
    expect(perId[normaal]).toBeUndefined();
    // Geen lead_aanvraag-event in de mock → gemeld, niet verwijderd
    expect(rapport.aanvraagNietInDossier).toBe(2);
    expect(rapport.gewonnenLeadsOpBord).toBe(1);
    expect(store.get(leadProject)?.naam).toMatch(/^Wij willen/);
  });

  it("echte run patcht alleen de naam", async () => {
    const { store, ctx, leadProject, metLabel, normaal } = opzet();
    const voor = { ...store.get(leadProject) };

    const rapport = await runHandler(ctx, { dryRun: false });

    expect(rapport.hernoemd).toBe(2);
    const na = store.get(leadProject)!;
    expect(na.naam).toBe("De Boer – Tuinaanleg");
    expect(na.status).toBe(voor.status);
    expect(na.klantId).toBe(voor.klantId);
    expect(store.get(metLabel)?.naam).toBe("De Boer – Reiniging");
    expect(store.get(normaal)?.naam).toBe("De Boer – Gazon");

    // Idempotent: een tweede run vindt niets meer
    const tweede = await runHandler(ctx, { dryRun: false });
    expect(tweede.kandidaten).toBe(0);
  });

  it("beperkt zich tot de opgegeven organisatie", async () => {
    const { ctx } = opzet();
    const rapport = await runHandler(ctx, { orgId: "organisaties:andere" });
    expect(rapport.kandidaten).toBe(0);
  });
});
