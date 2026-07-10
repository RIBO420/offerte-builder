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

/** Store + ctx + ingelogde kantoor-gebruiker voor promotie-tests. */
function maakPromotieContext() {
  const store = new MockConvexStore();
  const userId = store.insert("users", createMockUser({ role: "directie" }));
  const user = store.get(userId) as unknown as Doc<"users">;
  const ctx = createMockCtx(store) as unknown as GenericMutationCtx<DataModel>;
  return { store, ctx, user };
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
    const { store, ctx, user } = maakPromotieContext();
    const bestaandeKlantId = store.insert("klanten", maakKlant({ email: "jan@devries.nl" }));
    const leadId = store.insert(
      "configuratorAanvragen",
      maakLead({ klantEmail: "Jan@DeVries.NL" })
    );

    const resultaat = await promoveerLead(
      ctx,
      getLead(store, leadId) as unknown as Doc<"configuratorAanvragen">,
      user
    );

    expect(resultaat.klantId).toBe(bestaandeKlantId);
    expect(resultaat.nieuweKlant).toBe(false);
    expect(resultaat.alGepromoveerd).toBe(false);
    // Geen tweede klantrecord aangemaakt
    expect(store.getAll("klanten")).toHaveLength(1);
  });

  it("maakt een nieuw klantrecord als er geen match is — de lead wórdt de klant", async () => {
    const { store, ctx, user } = maakPromotieContext();
    const leadId = store.insert("configuratorAanvragen", maakLead());

    const resultaat = await promoveerLead(
      ctx,
      getLead(store, leadId) as unknown as Doc<"configuratorAanvragen">,
      user
    );

    const klanten = store.getAll("klanten");
    expect(klanten).toHaveLength(1);
    expect(resultaat.nieuweKlant).toBe(true);
    // Tenancy conform bestaande conventie: de kantoor-gebruiker die promoveert
    expect(klanten[0].userId).toBe(user._id);
    // E-mail genormaliseerd opgeslagen (index-matchbaar)
    expect(klanten[0].email).toBe("jan@devries.nl");
    // Géén deprecated "lead"-stadium op het nieuwe klantrecord
    expect(klanten[0].pipelineStatus).toBeUndefined();
  });

  it("maakt direct een eerste werkitem aan (type project, status gepland)", async () => {
    const { store, ctx, user } = maakPromotieContext();
    const leadId = store.insert("configuratorAanvragen", maakLead());

    const resultaat = await promoveerLead(
      ctx,
      getLead(store, leadId) as unknown as Doc<"configuratorAanvragen">,
      user
    );

    const werkitems = store.getAll("projecten");
    expect(werkitems).toHaveLength(1);
    expect(werkitems[0]._id).toBe(resultaat.werkitemId);
    expect(werkitems[0].type).toBe("project");
    expect(werkitems[0].status).toBe("gepland");
    expect(werkitems[0].klantId).toBe(resultaat.klantId);
    expect(werkitems[0].userId).toBe(user._id);
    expect(werkitems[0].naam).toBe("Aanvraag CFG-20260701-0001");
  });

  it("rondt het lead-record af: gewonnen + koppeling → van het bord, historie blijft", async () => {
    const { store, ctx, user } = maakPromotieContext();
    const leadId = store.insert("configuratorAanvragen", maakLead());

    const resultaat = await promoveerLead(
      ctx,
      getLead(store, leadId) as unknown as Doc<"configuratorAanvragen">,
      user
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
    const { store, ctx, user } = maakPromotieContext();
    const leadId = store.insert("configuratorAanvragen", maakLead());

    const eerste = await promoveerLead(
      ctx,
      getLead(store, leadId) as unknown as Doc<"configuratorAanvragen">,
      user
    );
    const tweede = await promoveerLead(
      ctx,
      getLead(store, leadId) as unknown as Doc<"configuratorAanvragen">,
      user
    );

    expect(tweede.alGepromoveerd).toBe(true);
    expect(tweede.klantId).toBe(eerste.klantId);
    expect(tweede.werkitemId).toBeNull();
    expect(store.getAll("klanten")).toHaveLength(1);
    expect(store.getAll("projecten")).toHaveLength(1);
    expect(store.getAll("leadActiviteiten")).toHaveLength(1);
  });

  it("gebruikt een bestaande koppeling (gekoppeldKlantId) zonder nieuwe klant te maken", async () => {
    const { store, ctx, user } = maakPromotieContext();
    const klantId = store.insert("klanten", maakKlant({ email: "ander@adres.nl" }));
    const leadId = store.insert(
      "configuratorAanvragen",
      maakLead({ gekoppeldKlantId: klantId as Id<"klanten">, pipelineStatus: "offerte_verstuurd" })
    );

    const resultaat = await promoveerLead(
      ctx,
      getLead(store, leadId) as unknown as Doc<"configuratorAanvragen">,
      user
    );

    expect(resultaat.klantId).toBe(klantId);
    expect(resultaat.nieuweKlant).toBe(false);
    expect(store.getAll("klanten")).toHaveLength(1);
    // Eerste werkitem hoort wél aangemaakt te worden bij de promotie zelf
    expect(store.getAll("projecten")).toHaveLength(1);
  });
});
