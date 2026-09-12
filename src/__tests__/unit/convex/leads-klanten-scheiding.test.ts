/**
 * Leads/Klanten-scheiding (PRD §1.3, fase 0)
 *
 * Test de kern van de scheiding tussen het leads-bord (configuratorAanvragen)
 * en het klantenbestand (klanten):
 *
 * 1. Badge-telling: "Leads" telt alleen actieve funnel-leads, "Klanten" telt
 *    alleen echte klanten — gearchiveerde records en het deprecated
 *    "lead"-stadium tellen nergens mee.
 * 2. Promotie Lead → Gewonnen (promoveerLead): case-insensitieve klant-match,
 *    geen dubbel record, eerste werkitem, correcte tenancy en idempotentie.
 *
 * Er wordt niets gemaild of gepusht: promoveerLead raakt geen scheduler en de
 * mock-ctx gebruikt uitsluitend een in-memory store (convex-mock.ts).
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
  mapOldStatus,
  effectieveLeadStatus,
  isActieveLead,
  isGepromoveerdeLead,
  hoortInKlantenLijst,
  normaliseerEmail,
  vindKlantMatch,
  promoveerLead,
} from "../../../../convex/leadsKlantenHelpers";
import {
  getById as getLeadById,
  listByPipeline,
  koppelKlant,
  maakKlantUitLead,
  ontkoppelKlant,
} from "../../../../convex/configuratorAanvragen";

// ─── Fixtures ────────────────────────────────────────────────────────────────

type LeadFixture = {
  type: string;
  status: string;
  pipelineStatus?: "nieuw" | "contact_gehad" | "offerte_verstuurd" | "gewonnen" | "verloren";
  isArchived?: boolean;
  gekoppeldKlantId?: Id<"klanten">;
  referentie: string;
  klantNaam: string;
  klantEmail: string;
  klantTelefoon: string;
  klantAdres: string;
  klantPostcode: string;
  klantPlaats: string;
  omschrijving?: string;
  specificaties: Record<string, never>;
  indicatiePrijs: number;
  createdAt: number;
  updatedAt: number;
};

function maakLead(overrides: Partial<LeadFixture> = {}): LeadFixture {
  return {
    type: "gazon",
    status: "nieuw",
    pipelineStatus: "nieuw",
    referentie: "CFG-20260701-0001",
    klantNaam: "Jan de Vries",
    klantEmail: "Jan@DeVries.NL",
    klantTelefoon: "0612345678",
    klantAdres: "Dorpsstraat 1",
    klantPostcode: "1234 AB",
    klantPlaats: "Utrecht",
    specificaties: {},
    indicatiePrijs: 2500,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

type KlantFixture = {
  userId: string;
  orgId?: string;
  naam: string;
  adres: string;
  postcode: string;
  plaats: string;
  email?: string;
  pipelineStatus?: string;
  isArchived?: boolean;
  createdAt: number;
  updatedAt: number;
};

function maakKlant(overrides: Partial<KlantFixture> = {}): KlantFixture {
  return {
    userId: "users:1",
    naam: "Jan de Vries",
    adres: "Dorpsstraat 1",
    postcode: "1234 AB",
    plaats: "Utrecht",
    email: "jan@devries.nl",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

/**
 * Store + ctx + organisatie + ingelogde kantoor-gebruiker voor promotie-tests.
 *
 * `orgId` is sinds fase 3 van de org-migratie de tenant-scope van promoveerLead:
 * de klant-match loopt erop, en het nieuwe klant- en werkitem-record krijgen hem
 * mee.
 */
function maakPromotieContext() {
  const store = new MockConvexStore();
  const orgId = seedMockOrganisatie(store);
  const userId = store.insert("users", createMockUser({ role: "directie" }));
  const user = store.get(userId) as unknown as Doc<"users">;
  const ctx = createMockCtx(store) as unknown as GenericMutationCtx<DataModel>;
  return { store, ctx, user, orgId };
}

function getLead(store: MockConvexStore, id: string) {
  return store.get(id) as Record<string, unknown>;
}

// ─── 1. Badge-telling Leads (PRD §1.3/§5.1) ─────────────────────────────────

describe("Badge-telling Leads (countActieveLeads-logica)", () => {
  it("telt leads in de actieve funnel-stadia mee", () => {
    expect(isActieveLead(maakLead({ pipelineStatus: "nieuw" }))).toBe(true);
    expect(isActieveLead(maakLead({ pipelineStatus: "contact_gehad" }))).toBe(true);
    expect(isActieveLead(maakLead({ pipelineStatus: "offerte_verstuurd" }))).toBe(true);
  });

  it("telt gewonnen (gepromoveerde) en verloren leads niet mee", () => {
    expect(isActieveLead(maakLead({ pipelineStatus: "gewonnen" }))).toBe(false);
    expect(isActieveLead(maakLead({ pipelineStatus: "verloren" }))).toBe(false);
  });

  it("telt gearchiveerde leads niet mee (§5.2)", () => {
    expect(isActieveLead(maakLead({ pipelineStatus: "nieuw", isArchived: true }))).toBe(false);
  });

  it("valt terug op de oude status als pipelineStatus ontbreekt", () => {
    expect(isActieveLead(maakLead({ pipelineStatus: undefined, status: "in_behandeling" }))).toBe(true);
    expect(isActieveLead(maakLead({ pipelineStatus: undefined, status: "goedgekeurd" }))).toBe(false);
    expect(mapOldStatus("voltooid")).toBe("gewonnen");
    expect(effectieveLeadStatus(maakLead({ pipelineStatus: undefined, status: "afgekeurd" }))).toBe("verloren");
  });
});

// ─── 2. Badge-telling Klanten (PRD §1.3/§5.1) ───────────────────────────────

describe("Badge-telling Klanten (countKlanten-logica)", () => {
  it("telt echte klanten mee, ongeacht lifecycle-stadium", () => {
    expect(hoortInKlantenLijst(maakKlant())).toBe(true);
    expect(hoortInKlantenLijst(maakKlant({ pipelineStatus: "getekend" }))).toBe(true);
    expect(hoortInKlantenLijst(maakKlant({ pipelineStatus: "onderhoud" }))).toBe(true);
  });

  it("telt klanten met het deprecated 'lead'-stadium niet mee (één waarheid per fase)", () => {
    expect(hoortInKlantenLijst(maakKlant({ pipelineStatus: "lead" }))).toBe(false);
  });

  it("telt gearchiveerde klanten niet mee (§5.2)", () => {
    expect(hoortInKlantenLijst(maakKlant({ isArchived: true }))).toBe(false);
    expect(hoortInKlantenLijst(maakKlant({ isArchived: true, pipelineStatus: "getekend" }))).toBe(false);
  });
});

// ─── 3. E-mail-normalisatie en case-insensitieve match ──────────────────────

describe("Case-insensitieve e-mail-match", () => {
  it("normaliseert e-mailadressen (trim + lowercase)", () => {
    expect(normaliseerEmail("Jan@DeVries.NL")).toBe("jan@devries.nl");
    expect(normaliseerEmail("  INFO@TOPTUINEN.NL  ")).toBe("info@toptuinen.nl");
    expect(normaliseerEmail("")).toBeUndefined();
    expect(normaliseerEmail("   ")).toBeUndefined();
    expect(normaliseerEmail(undefined)).toBeUndefined();
    expect(normaliseerEmail(null)).toBeUndefined();
  });

  it("matcht kandidaten case-insensitief, ook legacy-rijen met hoofdletters", () => {
    const kandidaten = [
      { _id: "klanten:1", email: "JAN@DEVRIES.NL" }, // legacy, niet genormaliseerd
      { _id: "klanten:2", email: "piet@jansen.nl" },
    ];
    expect(vindKlantMatch(kandidaten, "jan@devries.nl")?._id).toBe("klanten:1");
    expect(vindKlantMatch(kandidaten, "piet@jansen.nl")?._id).toBe("klanten:2");
    expect(vindKlantMatch(kandidaten, "onbekend@mail.nl")).toBeUndefined();
  });

  it("slaat gearchiveerde klanten over bij het matchen", () => {
    const kandidaten = [
      { _id: "klanten:1", email: "jan@devries.nl", isArchived: true },
      { _id: "klanten:2", email: "jan@devries.nl" },
    ];
    expect(vindKlantMatch(kandidaten, "jan@devries.nl")?._id).toBe("klanten:2");
  });
});

// ─── 4. Promotie Lead → Gewonnen (PRD §1.3) ─────────────────────────────────

describe("Promotie Lead → Gewonnen (promoveerLead)", () => {
  it("koppelt case-insensitief aan een bestaande klant — geen dubbel record", async () => {
    const { store, ctx, user, orgId } = maakPromotieContext();
    const bestaandeKlantId = store.insert("klanten", maakKlant({ orgId, email: "jan@devries.nl" }));
    const leadId = store.insert(
      "configuratorAanvragen",
      maakLead({ klantEmail: "Jan@DeVries.NL" })
    );

    const resultaat = await promoveerLead(
      ctx,
      getLead(store, leadId) as unknown as Doc<"configuratorAanvragen">,
      user,
      orgId as Id<"organisaties">
    );

    expect(resultaat.klantId).toBe(bestaandeKlantId);
    expect(resultaat.nieuweKlant).toBe(false);
    expect(resultaat.alGepromoveerd).toBe(false);
    // Geen tweede klantrecord aangemaakt
    expect(store.getAll("klanten")).toHaveLength(1);
  });

  it("maakt een nieuw klantrecord als er geen match is — de lead wórdt de klant", async () => {
    const { store, ctx, user, orgId } = maakPromotieContext();
    const leadId = store.insert("configuratorAanvragen", maakLead());

    const resultaat = await promoveerLead(
      ctx,
      getLead(store, leadId) as unknown as Doc<"configuratorAanvragen">,
      user,
      orgId as Id<"organisaties">
    );

    const klanten = store.getAll("klanten");
    expect(klanten).toHaveLength(1);
    expect(resultaat.nieuweKlant).toBe(true);
    // Tenant-scope: de organisatie van de promoverende gebruiker.
    expect(klanten[0].orgId).toBe(orgId);
    // E-mail genormaliseerd opgeslagen (index-matchbaar)
    expect(klanten[0].email).toBe("jan@devries.nl");
    // Géén deprecated "lead"-stadium op het nieuwe klantrecord
    expect(klanten[0].pipelineStatus).toBeUndefined();
  });

  it("maakt direct een eerste werkitem aan (type project, status gepland)", async () => {
    const { store, ctx, user, orgId } = maakPromotieContext();
    const leadId = store.insert("configuratorAanvragen", maakLead());

    const resultaat = await promoveerLead(
      ctx,
      getLead(store, leadId) as unknown as Doc<"configuratorAanvragen">,
      user,
      orgId as Id<"organisaties">
    );

    const werkitems = store.getAll("projecten");
    expect(werkitems).toHaveLength(1);
    expect(werkitems[0]._id).toBe(resultaat.werkitemId);
    expect(werkitems[0].type).toBe("project");
    expect(werkitems[0].status).toBe("gepland");
    expect(werkitems[0].klantId).toBe(resultaat.klantId);
    expect(werkitems[0].orgId).toBe(orgId);
    expect(werkitems[0].naam).toBe("Aanvraag CFG-20260701-0001");
  });

  it("rondt het lead-record af: gewonnen + koppeling → van het bord, historie blijft", async () => {
    const { store, ctx, user, orgId } = maakPromotieContext();
    const leadId = store.insert("configuratorAanvragen", maakLead());

    const resultaat = await promoveerLead(
      ctx,
      getLead(store, leadId) as unknown as Doc<"configuratorAanvragen">,
      user,
      orgId as Id<"organisaties">
    );

    const lead = getLead(store, leadId);
    expect(lead.pipelineStatus).toBe("gewonnen");
    expect(lead.gekoppeldKlantId).toBe(resultaat.klantId);
    // Gepromoveerde lead verdwijnt van het bord (filter in listByPipeline)…
    expect(
      isGepromoveerdeLead(lead as { status: string; pipelineStatus?: "gewonnen"; gekoppeldKlantId?: Id<"klanten"> })
    ).toBe(true);
    // …maar de historie blijft: activiteit gelogd met klant- en werkitem-verwijzing
    const activiteiten = store.getAll("leadActiviteiten");
    expect(activiteiten).toHaveLength(1);
    expect(activiteiten[0].leadId).toBe(leadId);
    const metadata = activiteiten[0].metadata as Record<string, unknown>;
    expect(metadata.gekoppeldKlantId).toBe(resultaat.klantId);
    expect(metadata.werkitemId).toBe(resultaat.werkitemId);
  });

  it("is idempotent: een tweede promotie maakt geen dubbele klant of werkitem", async () => {
    const { store, ctx, user, orgId } = maakPromotieContext();
    const leadId = store.insert("configuratorAanvragen", maakLead());

    const eerste = await promoveerLead(
      ctx,
      getLead(store, leadId) as unknown as Doc<"configuratorAanvragen">,
      user,
      orgId as Id<"organisaties">
    );
    const tweede = await promoveerLead(
      ctx,
      getLead(store, leadId) as unknown as Doc<"configuratorAanvragen">,
      user,
      orgId as Id<"organisaties">
    );

    expect(tweede.alGepromoveerd).toBe(true);
    expect(tweede.klantId).toBe(eerste.klantId);
    expect(tweede.werkitemId).toBeNull();
    expect(store.getAll("klanten")).toHaveLength(1);
    expect(store.getAll("projecten")).toHaveLength(1);
    expect(store.getAll("leadActiviteiten")).toHaveLength(1);
  });

  it("koppelt nooit aan een klant van een andere organisatie", async () => {
    // De by_email-index is bedrijfsoverstijgend: zonder de org-filter in
    // promoveerLead zou deze lead aan de klant van een ándere tenant worden
    // gehangen — precies het lek dat de org-migratie moet dichten.
    const { store, ctx, user, orgId } = maakPromotieContext();
    const vreemdeKlantId = store.insert(
      "klanten",
      maakKlant({ orgId: "organisaties:andere", email: "jan@devries.nl" })
    );
    const leadId = store.insert(
      "configuratorAanvragen",
      maakLead({ klantEmail: "jan@devries.nl" })
    );

    const resultaat = await promoveerLead(
      ctx,
      getLead(store, leadId) as unknown as Doc<"configuratorAanvragen">,
      user,
      orgId as Id<"organisaties">
    );

    expect(resultaat.klantId).not.toBe(vreemdeKlantId);
    expect(resultaat.nieuweKlant).toBe(true);
    const eigenKlant = store.get(resultaat.klantId as unknown as string);
    expect(eigenKlant?.orgId).toBe(orgId);
  });

  it("gebruikt een bestaande koppeling (gekoppeldKlantId) zonder nieuwe klant te maken", async () => {
    const { store, ctx, user, orgId } = maakPromotieContext();
    const klantId = store.insert("klanten", maakKlant({ orgId, email: "ander@adres.nl" }));
    const leadId = store.insert(
      "configuratorAanvragen",
      maakLead({ gekoppeldKlantId: klantId as Id<"klanten">, pipelineStatus: "offerte_verstuurd" })
    );

    const resultaat = await promoveerLead(
      ctx,
      getLead(store, leadId) as unknown as Doc<"configuratorAanvragen">,
      user,
      orgId as Id<"organisaties">
    );

    expect(resultaat.klantId).toBe(klantId);
    expect(resultaat.nieuweKlant).toBe(false);
    expect(store.getAll("klanten")).toHaveLength(1);
    // Eerste werkitem hoort wél aangemaakt te worden bij de promotie zelf
    expect(store.getAll("projecten")).toHaveLength(1);
  });
});

// ─── 5. Tenant-scope van het leads-bord (org-migratie fase 3) ────────────────

/**
 * De leads-tabel was tot fase 3 volledig ONgescoopt: elke query las de hele
 * tabel. Met meerdere organisaties op één deployment betekent dat het bord van
 * de buurman op je scherm. Deze twee tests bewaken de ondergrens: een lead van
 * een andere organisatie is onzichtbaar én niet opvraagbaar.
 */
describe("Leads zijn org-gescoopt", () => {
  function ctxMetLeadsVanTweeOrgs() {
    const store = new MockConvexStore();
    const orgId = seedMockOrganisatie(store);
    store.insert("users", createMockUser({ role: "directie" }));
    const eigenLeadId = store.insert(
      "configuratorAanvragen",
      maakLead({ referentie: "CFG-EIGEN" })
    );
    store.patch(eigenLeadId, { orgId });
    const vreemdeLeadId = store.insert(
      "configuratorAanvragen",
      maakLead({ referentie: "CFG-VREEMD" })
    );
    store.patch(vreemdeLeadId, { orgId: "organisaties:andere" });
    return { store, ctx: createMockCtx(store), eigenLeadId, vreemdeLeadId };
  }

  function handlerVan(fn: unknown) {
    return (fn as { _handler: (ctx: unknown, args: unknown) => Promise<unknown> })
      ._handler;
  }

  it("getById geeft null voor een lead van een andere organisatie", async () => {
    const { ctx, eigenLeadId, vreemdeLeadId } = ctxMetLeadsVanTweeOrgs();

    await expect(
      handlerVan(getLeadById)(ctx, { id: eigenLeadId })
    ).resolves.not.toBeNull();
    await expect(
      handlerVan(getLeadById)(ctx, { id: vreemdeLeadId })
    ).resolves.toBeNull();
  });

  it("listByPipeline toont alleen leads van de eigen organisatie", async () => {
    const { ctx } = ctxMetLeadsVanTweeOrgs();

    const bord = (await handlerVan(listByPipeline)(ctx, {})) as Record<
      string,
      Array<{ referentie: string }>
    >;
    const referenties = Object.values(bord).flat().map((l) => l.referentie);

    expect(referenties).toContain("CFG-EIGEN");
    expect(referenties).not.toContain("CFG-VREEMD");
  });
});

// ─── 6. Klant koppelen vanuit een OPEN lead (klantfeedback augustus) ─────────

/**
 * Mickey stuurde een offerte naar een lead en wilde dat in het klantdossier
 * loggen — maar dat dossier bestond nog niet: een klant ontstond pas bij
 * "gewonnen". Sindsdien kan een lead al eerder een klantrecord krijgen
 * (koppelKlant/maakKlantUitLead) zonder dat hij van het bord verdwijnt:
 * `isGepromoveerdeLead` eist gewonnen ÉN een koppeling.
 */
describe("Klant koppelen vanuit een open lead", () => {
  function handlerVan<A, R>(fn: unknown) {
    return (fn as { _handler: (ctx: unknown, args: A) => Promise<R> })._handler;
  }

  const koppelKlantH = handlerVan<Record<string, unknown>, unknown>(koppelKlant);
  const maakKlantUitLeadH = handlerVan<Record<string, unknown>, {
    klantId: string;
    nieuweKlant: boolean;
  }>(maakKlantUitLead);
  const ontkoppelKlantH = handlerVan<Record<string, unknown>, unknown>(ontkoppelKlant);

  /** Vangt de fout van een handler, zodat we de melding kunnen lezen. */
  async function vangFout(belofte: Promise<unknown>): Promise<{ data?: string; message: string }> {
    const fout = await belofte.then(
      () => null,
      (e: unknown) => e as { data?: string; message: string }
    );
    if (!fout) throw new Error("Verwachtte een fout, maar de handler slaagde");
    return fout;
  }

  function maakKoppelContext() {
    const basis = maakPromotieContext();
    const seedLead = (overrides: Partial<LeadFixture> = {}) => {
      const id = basis.store.insert("configuratorAanvragen", maakLead(overrides));
      basis.store.patch(id, { orgId: basis.orgId });
      return id;
    };
    return { ...basis, seedLead };
  }

  it("laat een gekoppelde lead met status contact_gehad gewoon op het bord staan", async () => {
    const { store, ctx, orgId, seedLead } = maakKoppelContext();
    const klantId = store.insert("klanten", maakKlant({ orgId }));
    seedLead({
      referentie: "CFG-OPEN",
      pipelineStatus: "contact_gehad",
      gekoppeldKlantId: klantId as Id<"klanten">,
    });

    const bord = (await handlerVan<Record<string, never>, Record<string, Array<{ referentie: string }>>>(
      listByPipeline
    )(ctx, {})) as Record<string, Array<{ referentie: string }>>;

    expect(bord.contact_gehad.map((l) => l.referentie)).toContain("CFG-OPEN");
  });

  it("koppelKlant legt de koppeling zonder de pipelinestatus aan te raken", async () => {
    const { store, ctx, orgId, seedLead } = maakKoppelContext();
    const klantId = store.insert("klanten", maakKlant({ orgId }));
    const leadId = seedLead({ pipelineStatus: "offerte_verstuurd" });

    await koppelKlantH(ctx, { id: leadId, klantId });

    const lead = getLead(store, leadId);
    expect(lead.gekoppeldKlantId).toBe(klantId);
    expect(lead.pipelineStatus).toBe("offerte_verstuurd");
    // De lead blijft dus zichtbaar op het bord
    expect(
      isGepromoveerdeLead(lead as { status: string; gekoppeldKlantId?: Id<"klanten"> })
    ).toBe(false);

    const activiteiten = store.getAll("leadActiviteiten");
    expect(activiteiten).toHaveLength(1);
    expect(activiteiten[0].type).toBe("klant_gekoppeld");
    expect((activiteiten[0].metadata as Record<string, unknown>).gekoppeldKlantId).toBe(klantId);
    // Zichtbaar in het klantdossier (tijdlijn)
    const tijdlijn = store.getAll("klantTijdlijn");
    expect(tijdlijn).toHaveLength(1);
    expect(tijdlijn[0].klantId).toBe(klantId);
  });

  /**
   * Legacy: leads die vóór de promotieflow al "gewonnen" waren, hebben geen
   * klantrecord. Weigeren ("koppel via Gewonnen") helpt kantoor niet verder —
   * koppelen betekent hier: promoveren met déze klant, zodat de lead net zo
   * consistent is als een lead die via markGewonnen ging.
   */
  it("koppelKlant op een gewonnen lead zonder koppeling promoveert met de gekozen klant", async () => {
    const { store, ctx, orgId, seedLead } = maakKoppelContext();
    const klantId = store.insert("klanten", maakKlant({ orgId, email: "ander@adres.nl" }));
    const leadId = seedLead({ pipelineStatus: "gewonnen", omschrijving: "Achtertuin" });

    const resultaat = (await koppelKlantH(ctx, { id: leadId, klantId })) as {
      klantId: string;
      alGekoppeld: boolean;
      werkitemId: string | null;
    };

    const lead = getLead(store, leadId);
    expect(lead.gekoppeldKlantId).toBe(klantId);
    expect(lead.pipelineStatus).toBe("gewonnen");
    expect(resultaat.klantId).toBe(klantId);
    expect(resultaat.alGekoppeld).toBe(false);
    // De gekozen klant, geen nieuw record via de e-mail-match
    expect(store.getAll("klanten")).toHaveLength(1);
    // Het promotiepad: eerste werkitem bij die klant + promotielog
    const werkitems = store.getAll("projecten");
    expect(werkitems).toHaveLength(1);
    expect(werkitems[0].klantId).toBe(klantId);
    expect(werkitems[0].orgId).toBe(orgId);
    expect(resultaat.werkitemId).toBe(werkitems[0]._id);
    const activiteiten = store.getAll("leadActiviteiten");
    expect(activiteiten).toHaveLength(1);
    expect(activiteiten[0].type).toBe("status_wijziging");
    expect((activiteiten[0].metadata as Record<string, unknown>).gekoppeldKlantId).toBe(klantId);
    expect(store.getAll("klantTijdlijn")[0].eventType).toBe("lead_gewonnen");
  });

  it("koppelKlant op een gewonnen lead weigert nog steeds een klant van een andere organisatie", async () => {
    const { store, ctx, seedLead } = maakKoppelContext();
    const vreemdeKlantId = store.insert(
      "klanten",
      maakKlant({ orgId: "organisaties:andere", email: "buurman@groenenco.nl" })
    );
    const leadId = seedLead({ pipelineStatus: "gewonnen" });

    const fout = await vangFout(koppelKlantH(ctx, { id: leadId, klantId: vreemdeKlantId }));
    expect(fout.data ?? fout.message).toContain("Klant niet gevonden");
    expect(getLead(store, leadId).gekoppeldKlantId).toBeUndefined();
    expect(store.getAll("projecten")).toHaveLength(0);
  });

  it("koppelKlant weigert een klant van een andere organisatie (generieke melding)", async () => {
    const { store, ctx, seedLead } = maakKoppelContext();
    const vreemdeKlantId = store.insert(
      "klanten",
      maakKlant({ orgId: "organisaties:andere", email: "buurman@groenenco.nl" })
    );
    const leadId = seedLead();

    const fout = await vangFout(koppelKlantH(ctx, { id: leadId, klantId: vreemdeKlantId }));
    expect(fout.data ?? fout.message).toContain("Klant niet gevonden");
    expect(getLead(store, leadId).gekoppeldKlantId).toBeUndefined();
  });

  it("koppelKlant weigert een gearchiveerde klant van de eigen organisatie", async () => {
    const { store, ctx, orgId, seedLead } = maakKoppelContext();
    const klantId = store.insert("klanten", maakKlant({ orgId, isArchived: true }));
    const leadId = seedLead();

    const fout = await vangFout(koppelKlantH(ctx, { id: leadId, klantId }));
    expect(fout.data ?? fout.message).toContain("Klant niet gevonden");
  });

  it("maakKlantUitLead dedupt case-insensitief op e-mail — geen dubbel klantrecord", async () => {
    const { store, ctx, orgId, seedLead } = maakKoppelContext();
    const bestaandeKlantId = store.insert("klanten", maakKlant({ orgId, email: "jan@devries.nl" }));
    const leadId = seedLead({ klantEmail: "Jan@DeVries.NL", pipelineStatus: "contact_gehad" });

    const resultaat = await maakKlantUitLeadH(ctx, { id: leadId });

    expect(resultaat.klantId).toBe(bestaandeKlantId);
    expect(resultaat.nieuweKlant).toBe(false);
    expect(store.getAll("klanten")).toHaveLength(1);
    // Lead blijft open: geen promotie, geen werkitem
    expect(getLead(store, leadId).pipelineStatus).toBe("contact_gehad");
    expect(store.getAll("projecten")).toHaveLength(0);
  });

  it("maakKlantUitLead maakt een klantrecord als er geen match is en koppelt dat", async () => {
    const { store, ctx, orgId, seedLead } = maakKoppelContext();
    const leadId = seedLead({ pipelineStatus: "nieuw" });

    const resultaat = await maakKlantUitLeadH(ctx, { id: leadId });

    const klanten = store.getAll("klanten");
    expect(klanten).toHaveLength(1);
    expect(resultaat.nieuweKlant).toBe(true);
    expect(klanten[0].orgId).toBe(orgId);
    expect(klanten[0].email).toBe("jan@devries.nl");
    expect(getLead(store, leadId).gekoppeldKlantId).toBe(resultaat.klantId);
    expect(getLead(store, leadId).pipelineStatus).toBe("nieuw");
  });

  /**
   * Een klant uit een lead kreeg alleen een `naam`, terwijl kantoor sorteert
   * en zoekt op `achternaam`: zo'n klant stond in de lijst onder zijn
   * voornaam. De splitsregel van lib/klantNaam.ts geldt nu ook hier — en
   * blijft af van namen die naar een organisatie ruiken.
   */
  it("maakKlantUitLead vult voor- en achternaam bij een persoonsnaam", async () => {
    const { store, ctx, seedLead } = maakKoppelContext();
    const leadId = seedLead({
      klantNaam: "Ellen Kuipers",
      klantEmail: "ellen@kuipers.nl",
    });

    await maakKlantUitLeadH(ctx, { id: leadId });

    const klant = store.getAll("klanten")[0];
    expect(klant.naam).toBe("Ellen Kuipers");
    expect(klant.voornaam).toBe("Ellen");
    expect(klant.achternaam).toBe("Kuipers");
  });

  it("maakKlantUitLead laat een bedrijfsnaam ongesplitst", async () => {
    const { store, ctx, seedLead } = maakKoppelContext();
    const leadId = seedLead({
      klantNaam: "Dreessen Advocaten BV",
      klantEmail: "info@dreessen.nl",
    });

    await maakKlantUitLeadH(ctx, { id: leadId });

    const klant = store.getAll("klanten")[0];
    expect(klant.naam).toBe("Dreessen Advocaten BV");
    expect(klant.voornaam).toBeUndefined();
    expect(klant.achternaam).toBeUndefined();
  });

  it("maakKlantUitLead is idempotent: een al gekoppelde lead geeft dezelfde klant terug", async () => {
    const { store, ctx, orgId, seedLead } = maakKoppelContext();
    const klantId = store.insert("klanten", maakKlant({ orgId, email: "ander@adres.nl" }));
    const leadId = seedLead({ gekoppeldKlantId: klantId as Id<"klanten"> });

    const resultaat = await maakKlantUitLeadH(ctx, { id: leadId });

    expect(resultaat.klantId).toBe(klantId);
    expect(resultaat.nieuweKlant).toBe(false);
    expect(store.getAll("klanten")).toHaveLength(1);
    expect(store.getAll("leadActiviteiten")).toHaveLength(0);
  });

  it("ontkoppelKlant wist de koppeling van een open lead", async () => {
    const { store, ctx, orgId, seedLead } = maakKoppelContext();
    const klantId = store.insert("klanten", maakKlant({ orgId }));
    const leadId = seedLead({
      gekoppeldKlantId: klantId as Id<"klanten">,
      pipelineStatus: "offerte_verstuurd",
    });

    await ontkoppelKlantH(ctx, { id: leadId });

    expect(getLead(store, leadId).gekoppeldKlantId).toBeUndefined();
    // Eigen logtype: in de historie is "ontkoppeld" dan niet te verwarren met
    // "gekoppeld" (zelfde kleur/label zou de tijdlijn onleesbaar maken).
    const activiteiten = store.getAll("leadActiviteiten");
    expect(activiteiten).toHaveLength(1);
    expect(activiteiten[0].type).toBe("klant_ontkoppeld");
    expect((activiteiten[0].metadata as Record<string, unknown>).ontkoppeldKlantId).toBe(klantId);
    // Het klantrecord zelf blijft bestaan
    expect(store.getAll("klanten")).toHaveLength(1);
  });

  it("ontkoppelKlant weigert bij een gewonnen lead (de lead ís de klant)", async () => {
    const { store, ctx, orgId, seedLead } = maakKoppelContext();
    const klantId = store.insert("klanten", maakKlant({ orgId }));
    const leadId = seedLead({
      gekoppeldKlantId: klantId as Id<"klanten">,
      pipelineStatus: "gewonnen",
    });

    const fout = await vangFout(ontkoppelKlantH(ctx, { id: leadId }));
    expect(fout.data ?? fout.message).toContain("gewonnen");
    expect(getLead(store, leadId).gekoppeldKlantId).toBe(klantId);
  });
});
