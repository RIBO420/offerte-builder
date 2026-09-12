/**
 * Lead-aanvraag (tekst + foto's) in het klantdossier — Task 15.
 *
 * Dekt: overname bij promoveerLead en koppelKlant (event op de aanvraagdatum
 * met bijlagen + klantBestanden-verwijzingen), idempotentie, tenancy-guard,
 * GDPR-opruiming en de backfill-migratie (dry run schrijft niets).
 */
import { describe, it, expect } from "vitest";
import {
  MockConvexStore,
  createMockCtx,
  createMockUser,
  seedMockOrganisatie,
} from "../../helpers/convex-mock";
import type { GenericMutationCtx } from "convex/server";
import type { DataModel, Doc, Id } from "../../../../convex/_generated/dataModel";
import {
  promoveerLead,
  neemAanvraagOverInDossier,
  bepaalAanvraagOvername,
} from "../../../../convex/leadsKlantenHelpers";
import { koppelKlant, verwijder } from "../../../../convex/configuratorAanvragen";
import { verwijder as verwijderBestand } from "../../../../convex/klantBestanden";
import {
  start as migratieStart,
  verifieerAanvraagOvername,
} from "../../../../convex/migrations/leadAanvraagNaarDossier";

const AANVRAAG_MOMENT = Date.UTC(2026, 7, 1, 9, 30);
const FOTO_A = "storage:foto-a" as Id<"_storage">;
const FOTO_B = "storage:foto-b" as Id<"_storage">;

function handlerVan<A = unknown, R = unknown>(fn: unknown) {
  return (fn as { _handler: (ctx: unknown, args: A) => Promise<R> })._handler;
}

function maakContext() {
  const store = new MockConvexStore();
  const orgId = seedMockOrganisatie(store) as Id<"organisaties">;
  const userId = store.insert("users", createMockUser({ role: "directie" }));
  const user = store.get(userId) as unknown as Doc<"users">;
  const ctx = createMockCtx(store) as unknown as GenericMutationCtx<DataModel>;
  // De mock heeft geen storage; verwijder-paden roepen storage.delete aan.
  const verwijderdeStorage: string[] = [];
  (ctx as unknown as { storage: { delete: (id: string) => Promise<void> } }).storage = {
    delete: async (id: string) => {
      verwijderdeStorage.push(id);
    },
  };
  return { store, ctx, user, orgId, verwijderdeStorage };
}

function seedLead(
  store: MockConvexStore,
  orgId: Id<"organisaties">,
  overrides: Record<string, unknown> = {}
) {
  const id = store.insert("configuratorAanvragen", {
    orgId,
    type: "contact",
    status: "nieuw",
    pipelineStatus: "offerte_verstuurd",
    bron: "website_contact",
    referentie: "AV-2026-0042",
    klantNaam: "Odile Sikkes",
    klantEmail: "odile@voorbeeld.test",
    klantTelefoon: "0622448843",
    klantAdres: "Seringenlaan 78",
    klantPostcode: "6163 EZ",
    klantPlaats: "Geleen",
    specificaties: {
      onderwerp: "Tuinonderhoud",
      bericht: "Graag een offerte voor het onderhoud.",
      tuinoppervlak: "Groter dan 300 m²",
    },
    indicatiePrijs: 0,
    fotoIds: [FOTO_A, FOTO_B],
    createdAt: AANVRAAG_MOMENT,
    updatedAt: AANVRAAG_MOMENT,
    ...overrides,
  });
  return id as Id<"configuratorAanvragen">;
}

function seedKlant(store: MockConvexStore, orgId: Id<"organisaties"> | string) {
  return store.insert("klanten", {
    userId: "users:1",
    orgId,
    naam: "Odile Sikkes",
    adres: "Seringenlaan 78",
    postcode: "6163 EZ",
    plaats: "Geleen",
    email: "odile@voorbeeld.test",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }) as Id<"klanten">;
}

function lead(store: MockConvexStore, id: string) {
  return store.get(id) as unknown as Doc<"configuratorAanvragen">;
}

function eventsVan(store: MockConvexStore, klantId: string) {
  return store
    .getAll("klantTijdlijn")
    .filter((e) => e.klantId === klantId) as Array<Record<string, unknown>>;
}

function bestandenVan(store: MockConvexStore, klantId: string) {
  return store
    .getAll("klantBestanden")
    .filter((b) => b.klantId === klantId) as Array<Record<string, unknown>>;
}

describe("aanvraag overnemen bij conversie", () => {
  it("promoveerLead zet de aanvraag als event op de aanvraagdatum met de foto's als bijlagen", async () => {
    const { store, ctx, user, orgId } = maakContext();
    const leadId = seedLead(store, orgId);

    const resultaat = await promoveerLead(ctx, lead(store, leadId), user, orgId);

    const aanvraag = eventsVan(store, resultaat.klantId).find(
      (e) => e.eventType === "lead_aanvraag"
    );
    expect(aanvraag).toBeDefined();
    expect(aanvraag?.timestamp).toBe(AANVRAAG_MOMENT);
    expect(aanvraag?.kanaal).toBe("systeem");
    expect(aanvraag?.bronLeadId).toBe(leadId);
    expect(aanvraag?.bijlagen).toEqual([FOTO_A, FOTO_B]);
    expect(aanvraag?.tekst).toContain("Aanvraag via website contactformulier (AV-2026-0042)");
    expect(aanvraag?.tekst).toContain("Bericht: Graag een offerte voor het onderhoud.");
    expect(aanvraag?.tekst).toContain("2 foto's bijgevoegd");

    const fotos = bestandenVan(store, resultaat.klantId);
    expect(fotos).toHaveLength(2);
    expect(fotos.map((f) => f.storageId).sort()).toEqual([FOTO_A, FOTO_B].sort());
    expect(fotos.every((f) => f.bron === "lead" && f.leadId === leadId)).toBe(true);
    expect(fotos.every((f) => f.soort === "foto" && f.timestamp === AANVRAAG_MOMENT)).toBe(true);
    expect(fotos[0].titel).toBe("Foto bij aanvraag AV-2026-0042");
    expect(fotos[0].orgId).toBe(orgId);
    // De lead zelf is alleen door de promotie zelf aangeraakt: foto's blijven staan.
    expect(lead(store, leadId).fotoIds).toEqual([FOTO_A, FOTO_B]);
  });

  it("koppelKlant neemt de aanvraag ook over, en een tweede koppeling voegt niets toe", async () => {
    const { store, ctx, orgId } = maakContext();
    const klantId = seedKlant(store, orgId);
    const leadId = seedLead(store, orgId);
    const koppel = handlerVan<{ id: Id<"configuratorAanvragen">; klantId: Id<"klanten"> }>(koppelKlant);

    await koppel(ctx, { id: leadId, klantId });
    expect(eventsVan(store, klantId).filter((e) => e.eventType === "lead_aanvraag")).toHaveLength(1);
    expect(bestandenVan(store, klantId)).toHaveLength(2);

    // Nog eens (bijv. na ontkoppelen en opnieuw koppelen): idempotent.
    await neemAanvraagOverInDossier(ctx, lead(store, leadId), klantId, orgId);
    expect(eventsVan(store, klantId).filter((e) => e.eventType === "lead_aanvraag")).toHaveLength(1);
    expect(bestandenVan(store, klantId)).toHaveLength(2);
  });

  it("vult alleen de ontbrekende foto's aan als het event er al staat", async () => {
    const { store, ctx, orgId } = maakContext();
    const klantId = seedKlant(store, orgId);
    const leadId = seedLead(store, orgId, { fotoIds: [FOTO_A] });
    await neemAanvraagOverInDossier(ctx, lead(store, leadId), klantId, orgId);

    // De klant krijgt later een tweede foto op de lead (bijv. nagestuurd).
    store.patch(leadId, { fotoIds: [FOTO_A, FOTO_B] });
    const plan = await bepaalAanvraagOvername(ctx, lead(store, leadId), klantId, orgId);
    expect(plan.eventNodig).toBe(false);
    expect(plan.ontbrekendeFotoIds).toEqual([FOTO_B]);

    const resultaat = await neemAanvraagOverInDossier(ctx, lead(store, leadId), klantId, orgId);
    expect(resultaat).toEqual({ eventToegevoegd: false, fotosToegevoegd: 1 });
    expect(bestandenVan(store, klantId)).toHaveLength(2);
  });

  it("schrijft niets in het dossier van een klant uit een andere organisatie", async () => {
    const { store, ctx, orgId } = maakContext();
    const andereOrg = store.insert("organisaties", { naam: "Andere Hovenier", createdAt: Date.now() });
    const vreemdeKlant = seedKlant(store, andereOrg);
    const leadId = seedLead(store, orgId);

    const resultaat = await neemAanvraagOverInDossier(ctx, lead(store, leadId), vreemdeKlant, orgId);

    expect(resultaat.overgeslagen).toBe("andere_org");
    expect(eventsVan(store, vreemdeKlant)).toHaveLength(0);
    expect(bestandenVan(store, vreemdeKlant)).toHaveLength(0);
  });

  it("een lead zonder foto's krijgt alleen het event, zonder bijlagen", async () => {
    const { store, ctx, orgId } = maakContext();
    const klantId = seedKlant(store, orgId);
    const leadId = seedLead(store, orgId, { fotoIds: undefined });

    await neemAanvraagOverInDossier(ctx, lead(store, leadId), klantId, orgId);

    const [event] = eventsVan(store, klantId);
    expect(event.eventType).toBe("lead_aanvraag");
    expect(event.bijlagen).toBeUndefined();
    expect(bestandenVan(store, klantId)).toHaveLength(0);
  });
});

describe("opruimen", () => {
  it("een dossierfoto met bron lead verwijderen laat het storage-object van de lead staan", async () => {
    const { store, ctx, orgId, verwijderdeStorage } = maakContext();
    const klantId = seedKlant(store, orgId);
    const leadId = seedLead(store, orgId, { fotoIds: [FOTO_A] });
    await neemAanvraagOverInDossier(ctx, lead(store, leadId), klantId, orgId);
    const [rij] = bestandenVan(store, klantId);

    await handlerVan<{ bestandId: Id<"klantBestanden"> }>(verwijderBestand)(ctx, {
      bestandId: rij._id as Id<"klantBestanden">,
    });

    expect(bestandenVan(store, klantId)).toHaveLength(0);
    expect(verwijderdeStorage).toEqual([]);
  });

  it("GDPR-verwijdering van de lead ruimt het aanvraag-event en de verwijzingen mee op", async () => {
    const { store, ctx, orgId } = maakContext();
    const klantId = seedKlant(store, orgId);
    const leadId = seedLead(store, orgId);
    await neemAanvraagOverInDossier(ctx, lead(store, leadId), klantId, orgId);
    // Een gewone tijdlijnregel van de klant moet blijven staan.
    store.insert("klantTijdlijn", {
      orgId,
      klantId,
      timestamp: Date.now(),
      auteurNaam: "Mickey",
      kanaal: "telefoon",
      eventType: "handmatig",
      tekst: "Gebeld over de offerte",
      createdAt: Date.now(),
    });

    await handlerVan<{ id: Id<"configuratorAanvragen"> }>(verwijder)(ctx, { id: leadId });

    expect(store.get(leadId)).toBeNull();
    expect(bestandenVan(store, klantId)).toHaveLength(0);
    const events = eventsVan(store, klantId);
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe("handmatig");
  });
});

describe("migratie leadAanvraagNaarDossier", () => {
  type Rapport = {
    dryRun: boolean;
    bekeken: number;
    gekoppeld: number;
    eventsToegevoegd: number;
    fotosToegevoegd: number;
    alAanwezig: number;
    overgeslagen: { klant_weg: number; andere_org: number };
    voorbeelden: Array<{ referentie: string; actie: string }>;
    isDone: boolean;
  };
  const startH = handlerVan<{ dryRun?: boolean; cursor?: string | null }, Rapport>(migratieStart);
  const verifieerH = handlerVan<Record<string, never>, { gekoppeld: number; zonderEvent: number }>(
    verifieerAanvraagOvername
  );

  function seedScenario() {
    const basis = maakContext();
    const { store, orgId } = basis;
    const klantA = seedKlant(store, orgId);
    const klantB = seedKlant(store, orgId);
    const andereOrg = store.insert("organisaties", { naam: "Andere", createdAt: Date.now() });
    const vreemdeKlant = seedKlant(store, andereOrg);
    // 1: gewonnen lead met 2 foto's, nog niets in het dossier
    seedLead(store, orgId, { referentie: "L-1", pipelineStatus: "gewonnen", gekoppeldKlantId: klantA });
    // 2: gekoppelde open lead zonder foto's
    seedLead(store, orgId, { referentie: "L-2", gekoppeldKlantId: klantB, fotoIds: undefined });
    // 3: niet gekoppeld → telt niet mee
    seedLead(store, orgId, { referentie: "L-3" });
    // 4: klant bestaat niet meer
    seedLead(store, orgId, { referentie: "L-4", gekoppeldKlantId: "klanten:weg" as Id<"klanten"> });
    // 5: klant van een andere organisatie (mag nooit)
    seedLead(store, orgId, { referentie: "L-5", gekoppeldKlantId: vreemdeKlant });
    return { ...basis, klantA, klantB, vreemdeKlant };
  }

  it("dry run telt wat er zou gebeuren en schrijft niets", async () => {
    const { store, ctx, klantA, klantB } = seedScenario();

    const rapport = await startH(ctx, { dryRun: true });

    expect(rapport).toMatchObject({
      dryRun: true,
      bekeken: 5,
      gekoppeld: 4,
      eventsToegevoegd: 2,
      fotosToegevoegd: 2,
      alAanwezig: 0,
      overgeslagen: { klant_weg: 1, andere_org: 1 },
      isDone: true,
    });
    expect(rapport.voorbeelden.map((v) => `${v.referentie}:${v.actie}`).sort()).toEqual(
      ["L-1:event+fotos", "L-2:event", "L-4:klant_weg", "L-5:andere_org"].sort()
    );
    expect(eventsVan(store, klantA)).toHaveLength(0);
    expect(eventsVan(store, klantB)).toHaveLength(0);
    expect(store.getAll("klantBestanden")).toHaveLength(0);
  });

  it("echte run vult het dossier, is idempotent en verifieert schoon", async () => {
    const { store, ctx, klantA, klantB, vreemdeKlant } = seedScenario();

    const eerste = await startH(ctx, { dryRun: false });
    expect(eerste).toMatchObject({ eventsToegevoegd: 2, fotosToegevoegd: 2, isDone: true });
    expect(eventsVan(store, klantA).filter((e) => e.eventType === "lead_aanvraag")).toHaveLength(1);
    expect(eventsVan(store, klantA)[0].timestamp).toBe(AANVRAAG_MOMENT);
    expect(bestandenVan(store, klantA)).toHaveLength(2);
    expect(eventsVan(store, klantB)).toHaveLength(1);
    expect(eventsVan(store, vreemdeKlant)).toHaveLength(0);

    const tweede = await startH(ctx, { dryRun: false });
    expect(tweede).toMatchObject({ eventsToegevoegd: 0, fotosToegevoegd: 0, alAanwezig: 2 });
    expect(store.getAll("klantBestanden")).toHaveLength(2);

    const controle = await verifieerH(ctx, {});
    // L-5 (andere org) blijft bewust zonder event; L-4 telt als klantWeg.
    expect(controle).toMatchObject({ gekoppeld: 4, zonderEvent: 1 });
  });
});
