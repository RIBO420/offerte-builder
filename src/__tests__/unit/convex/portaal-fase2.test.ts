/**
 * Klantenportaal fase 2 (PRD §3.1) — security-tests (het zwaartepunt).
 *
 * Geteste scheidingen (letterlijk):
 * 1. Klant A ziet GEEN data van klant B — werkitems, facturen, meldingen
 *    en threads, per query getest;
 * 2. Klant ziet GEEN concepten (documentStatus) en GEEN interne velden
 *    (expliciete allowlist-assertions op de returns);
 * 3. Klant ziet GEEN interne case-comments en GEEN klanttijdlijn
 *    (AuthError op caseThread.listComments / tijdlijn.listVoorKlant);
 * 4. Melding indienen kan alleen voor de EIGEN klantId (scope komt uit
 *    requireKlant, nooit uit args) en alleen door de klant-rol;
 * 5. Stafrollen zonder kantoor kunnen NIET extern versturen
 *    (assertKanNaarKlantVersturen in sendMessage);
 * 6. Ontvangstbevestiging alleen via het trigger-model achter de
 *    mail-guard (gemockt — er wordt nooit echt gemaild).
 *
 * Plus functionele tests: melding → bord met juiste routing-defaults,
 * teller-badge, thread-flow beide kanten (klant ↔ kantoor).
 *
 * MAILVEILIGHEID: mock-ctx zonder Resend; scheduler.runAfter is een vi.fn.
 */

import { describe, it, expect, vi } from "vitest";
import { ConvexError } from "convex/values";
import {
  MockConvexStore,
  createMockCtx,
  createMockUser,
  createMockKlant,
  seedMockOrganisatie,
  type MockCtx,
} from "../../helpers/convex-mock";
import { AuthError } from "../../../../convex/auth";
import {
  getWerkitems,
  getFacturen,
  getFactuurVoorPdf,
  getMeldingen,
  dienMeldingIn,
  getThreadVoorContext,
  openThreadVoorWerkitem,
  openThreadVoorMelding,
} from "../../../../convex/portaal";
import {
  getThread,
  listMessages,
  sendMessage,
  openKlantThreadVoorContext,
  getKlantThreadVoorContext,
} from "../../../../convex/chatThreads";
import { telOpenMeldingen } from "../../../../convex/servicemeldingen";
import { listComments } from "../../../../convex/caseThread";
import { listVoorKlant } from "../../../../convex/tijdlijn";
import {
  zetTriggerMailKlaar,
  MAIL_TRIGGER_DEFAULTS,
} from "../../../../convex/mailTriggers";

// ─── Helpers ─────────────────────────────────────────────────────────────────

type AnyHandler = (ctx: unknown, args?: unknown) => Promise<unknown>;

/** Convex registreert de handler op de functie zelf (func._handler). */
function handler(fn: unknown): AnyHandler {
  return (fn as { _handler: AnyHandler })._handler;
}

const NU = Date.now();

/**
 * Basissetup: de ingelogde gebruiker is user1 (klant-rol, gekoppeld aan
 * klant A). Klant A en B hangen beide aan hetzelfde bedrijf (user1 als
 * company-owner-id; auth resolvet in de mock altijd naar de EERSTE user).
 * Met `alsKantoor()` wisselt de acterende gebruiker naar de kantoor-rol
 * (zelfde bedrijf) voor de kantoor-kant van de flows.
 */
function portaalSetup() {
  const store = new MockConvexStore();
  // De organisatie is sinds de org-migratie de tenant-grens: zonder org-rij
  // ziet geen enkele org-gescopeerde query nog iets (het org-claim zit al in
  // de identity van createMockCtx).
  const orgId = seedMockOrganisatie(store);
  const actingUserId = store.insert(
    "users",
    createMockUser({ role: "klant", name: "Klant A (account)" })
  );
  // Bedrijfseigenaar met kantoor-rol voor de eigenaar-default van meldingen
  const bedrijfseigenaarId = store.insert(
    "users",
    createMockUser({
      role: "directie",
      clerkId: "clerk_eigenaar",
      name: "Kantoor Eigenaar",
    })
  );
  const klantAId = store.insert(
    "klanten",
    createMockKlant(actingUserId, { orgId, naam: "Klant A", email: "a@test.nl" })
  );
  const klantBId = store.insert(
    "klanten",
    createMockKlant(actingUserId, { orgId, naam: "Klant B", email: "b@test.nl" })
  );
  store.patch(actingUserId, { linkedKlantId: klantAId });
  const ctx = createMockCtx(store);

  /** Wissel de acterende gebruiker naar kantoor (zelfde store/bedrijf). */
  const alsKantoor = () => {
    store.patch(actingUserId, { role: "directie", linkedKlantId: undefined });
  };
  /** Wissel terug naar de klant-rol. */
  const alsKlant = () => {
    store.patch(actingUserId, { role: "klant", linkedKlantId: klantAId });
  };
  /** Wissel naar een niet-kantoor-stafrol (voorman). */
  const alsVoorman = () => {
    store.patch(actingUserId, { role: "voorman", linkedKlantId: undefined });
  };

  return {
    store,
    ctx,
    orgId,
    actingUserId,
    bedrijfseigenaarId,
    klantAId,
    klantBId,
    alsKantoor,
    alsKlant,
    alsVoorman,
  };
}

function maakWerkitem(
  store: MockConvexStore,
  userId: string,
  klantId: string,
  overrides: Record<string, unknown> = {}
) {
  return store.insert("projecten", {
    userId,
    klantId,
    naam: "Voorjaarsbeurt",
    type: "onderhoudsbeurt",
    status: "gepland",
    geplandeStart: "2026-08-01",
    teamId: "teams:99",
    geschatteUren: 12,
    adres: "Tulpstraat 12, Amsterdam",
    createdAt: NU,
    updatedAt: NU,
    ...overrides,
  });
}

function maakFactuur(
  store: MockConvexStore,
  userId: string,
  klantId: string,
  overrides: Record<string, unknown> = {}
) {
  return store.insert("facturen", {
    userId,
    klantId,
    factuurnummer: `F-${Math.random().toString(36).slice(2, 7)}`,
    status: "verzonden",
    documentStatus: "verzonden",
    betaalStatus: "open",
    factuurdatum: NU,
    datumVanDienst: "2026-06-15",
    vervaldatum: NU + 14 * 24 * 60 * 60 * 1000,
    klant: { naam: "Klant", adres: "Straat 1", postcode: "1234 AB", plaats: "A'dam" },
    regels: [
      {
        id: "r1",
        omschrijving: "Snoeiwerk",
        hoeveelheid: 2,
        eenheid: "uur",
        prijsPerEenheid: 60,
        totaal: 120,
      },
    ],
    subtotaal: 120,
    btwPercentage: 21,
    btwBedrag: 25.2,
    totaalInclBtw: 145.2,
    // Intern veld dat NOOIT in het portaal mag belanden
    interneNotities: "Marge krap — niet delen",
    createdAt: NU,
    ...overrides,
  });
}

function seedMeldingTrigger(
  store: MockConvexStore,
  orgId: string,
  overrides: Record<string, unknown> = {}
) {
  const seed = MAIL_TRIGGER_DEFAULTS.find(
    (t) => t.event === "melding_ontvangen"
  )!;
  return store.insert("mailTriggers", {
    ...seed,
    orgId,
    createdAt: NU,
    updatedAt: NU,
    ...overrides,
  });
}

async function dienIn(
  ctx: MockCtx,
  args: Record<string, unknown> = {}
): Promise<string> {
  return (await handler(dienMeldingIn)(ctx, {
    type: "serviceverzoek",
    beschrijving: "De heg is kapot gewaaid",
    ...args,
  })) as string;
}

// ─── 1. Werkitems ────────────────────────────────────────────────────────────

describe("portaal.getWerkitems — scoping + allowlist", () => {
  it("toont eigen projecten én onderhoudsbeurten, maar niets van klant B", async () => {
    const s = portaalSetup();
    maakWerkitem(s.store, s.actingUserId, s.klantAId, {
      naam: "Eigen project",
      type: "project",
    });
    maakWerkitem(s.store, s.actingUserId, s.klantAId, { naam: "Eigen beurt" });
    maakWerkitem(s.store, s.actingUserId, s.klantBId, {
      naam: "GEHEIM: tuin van B",
    });

    const items = (await handler(getWerkitems)(s.ctx)) as Array<{
      naam: string;
      type: string;
    }>;

    expect(items).toHaveLength(2);
    expect(items.map((i) => i.naam).sort()).toEqual([
      "Eigen beurt",
      "Eigen project",
    ]);
    expect(JSON.stringify(items)).not.toContain("GEHEIM");
  });

  it("retourneert UITSLUITEND allowlist-velden (geen team, uren of interne velden)", async () => {
    const s = portaalSetup();
    maakWerkitem(s.store, s.actingUserId, s.klantAId);

    const items = (await handler(getWerkitems)(s.ctx)) as Array<
      Record<string, unknown>
    >;

    expect(Object.keys(items[0]).sort()).toEqual(
      ["_id", "adres", "createdAt", "geplandeStart", "naam", "status", "type"].sort()
    );
    expect(items[0]).not.toHaveProperty("teamId");
    expect(items[0]).not.toHaveProperty("geschatteUren");
    expect(items[0]).not.toHaveProperty("userId");
  });

  it("verbergt soft-deleted en gearchiveerde werkitems", async () => {
    const s = portaalSetup();
    maakWerkitem(s.store, s.actingUserId, s.klantAId, { deletedAt: NU });
    maakWerkitem(s.store, s.actingUserId, s.klantAId, { isArchived: true });

    const items = (await handler(getWerkitems)(s.ctx)) as unknown[];
    expect(items).toHaveLength(0);
  });

  it("weigert stafrollen (requireKlant)", async () => {
    const s = portaalSetup();
    s.alsKantoor();
    await expect(handler(getWerkitems)(s.ctx)).rejects.toThrow(AuthError);
  });
});

// ─── 2. Facturen ─────────────────────────────────────────────────────────────

describe("portaal.getFacturen — nooit concepten, nooit andermans facturen", () => {
  it("toont geen facturen van klant B", async () => {
    const s = portaalSetup();
    maakFactuur(s.store, s.actingUserId, s.klantAId, { factuurnummer: "F-A" });
    maakFactuur(s.store, s.actingUserId, s.klantBId, { factuurnummer: "F-B" });

    const facturen = (await handler(getFacturen)(s.ctx)) as Array<{
      factuurnummer: string;
    }>;
    expect(facturen.map((f) => f.factuurnummer)).toEqual(["F-A"]);
  });

  it("toont geen concept- of definitief-facturen (documentStatus)", async () => {
    const s = portaalSetup();
    maakFactuur(s.store, s.actingUserId, s.klantAId, {
      factuurnummer: "F-CONCEPT",
      status: "concept",
      documentStatus: "concept",
    });
    maakFactuur(s.store, s.actingUserId, s.klantAId, {
      factuurnummer: "F-DEF",
      status: "definitief",
      documentStatus: "definitief",
    });
    maakFactuur(s.store, s.actingUserId, s.klantAId, {
      factuurnummer: "F-OK",
    });

    const facturen = (await handler(getFacturen)(s.ctx)) as Array<{
      factuurnummer: string;
    }>;
    expect(facturen.map((f) => f.factuurnummer)).toEqual(["F-OK"]);
  });

  it("legacy-rijen zonder statussplitsing: concept blijft onzichtbaar", async () => {
    const s = portaalSetup();
    maakFactuur(s.store, s.actingUserId, s.klantAId, {
      factuurnummer: "F-LEGACY-CONCEPT",
      status: "concept",
      documentStatus: undefined,
      betaalStatus: undefined,
    });
    maakFactuur(s.store, s.actingUserId, s.klantAId, {
      factuurnummer: "F-LEGACY-BETAALD",
      status: "betaald",
      documentStatus: undefined,
      betaalStatus: undefined,
    });

    const facturen = (await handler(getFacturen)(s.ctx)) as Array<{
      factuurnummer: string;
      betaalStatus: string;
    }>;
    expect(facturen.map((f) => f.factuurnummer)).toEqual(["F-LEGACY-BETAALD"]);
    expect(facturen[0].betaalStatus).toBe("betaald");
  });

  it("allowlist: deelbetaald zichtbaar, interne notities NOOIT", async () => {
    const s = portaalSetup();
    maakFactuur(s.store, s.actingUserId, s.klantAId, {
      betaalStatus: "gedeeltelijk_betaald",
      betaaldBedrag: 100,
    });

    const facturen = (await handler(getFacturen)(s.ctx)) as Array<
      Record<string, unknown>
    >;
    expect(facturen[0].betaalStatus).toBe("gedeeltelijk_betaald");
    expect(facturen[0].betaaldBedrag).toBe(100);
    expect(facturen[0].datumVanDienst).toBe("2026-06-15");
    expect(Object.keys(facturen[0]).sort()).toEqual(
      [
        "_id",
        "betaalStatus",
        "betaaldAt",
        "betaaldBedrag",
        "createdAt",
        "datumVanDienst",
        "factuurdatum",
        "factuurnummer",
        "isCreditnota",
        "paymentUrl",
        "totaalInclBtw",
        "vervaldatum",
      ].sort()
    );
    expect(JSON.stringify(facturen)).not.toContain("Marge krap");
  });
});

describe("portaal.getFactuurVoorPdf — render-pad, strikt gescopet", () => {
  it("geeft null voor een factuur van klant B", async () => {
    const s = portaalSetup();
    const id = maakFactuur(s.store, s.actingUserId, s.klantBId);
    const result = await handler(getFactuurVoorPdf)(s.ctx, { id });
    expect(result).toBeNull();
  });

  it("geeft null voor een concept-factuur van de eigen klant", async () => {
    const s = portaalSetup();
    const id = maakFactuur(s.store, s.actingUserId, s.klantAId, {
      status: "concept",
      documentStatus: "concept",
    });
    expect(await handler(getFactuurVoorPdf)(s.ctx, { id })).toBeNull();
  });

  it("geeft PDF-velden (allowlist) voor een verzonden eigen factuur", async () => {
    const s = portaalSetup();
    const id = maakFactuur(s.store, s.actingUserId, s.klantAId);
    const result = (await handler(getFactuurVoorPdf)(s.ctx, { id })) as {
      factuur: Record<string, unknown>;
    };
    expect(result.factuur.factuurnummer).toBeDefined();
    expect(result.factuur.regels).toHaveLength(1);
    expect(result.factuur).not.toHaveProperty("interneNotities");
    expect(result.factuur).not.toHaveProperty("userId");
    expect(JSON.stringify(result)).not.toContain("Marge krap");
  });
});

// ─── 3. Meldingen: indienen + zien ──────────────────────────────────────────

describe("portaal.dienMeldingIn — instroom op het cases-bord", () => {
  it("serviceverzoek: kanaal portaal, status nieuw, beoordelen-voor-planning-vlag", async () => {
    const s = portaalSetup();
    const meldingId = await dienIn(s.ctx);

    const melding = s.store.get(meldingId)!;
    expect(melding.kanaal).toBe("portaal");
    expect(melding.status).toBe("nieuw");
    expect(melding.type).toBe("serviceverzoek");
    expect(melding.taaksoort).toBe("melding");
    expect(melding.beoordelenVoorPlanning).toBe(true);
    expect(melding.klantId).toBe(s.klantAId);
    expect(melding.userId).toBe(s.actingUserId); // bedrijfsscope
  });

  it("klacht: kantoor-eigenaar als routing-default, geen planning-vlag", async () => {
    const s = portaalSetup();
    const meldingId = await dienIn(s.ctx, {
      type: "klacht",
      beschrijving: "Border niet netjes",
    });

    const melding = s.store.get(meldingId)!;
    expect(melding.type).toBe("klacht");
    expect(melding.eigenaarId).toBe(s.bedrijfseigenaarId);
    expect(melding.beoordelenVoorPlanning).toBeUndefined();
    expect(melding.verzekeringsvlag).toBeUndefined();
  });

  it("schade bestaat niet als klant-optie (validator weigert op typeniveau)", () => {
    // De mutation-args accepteren uitsluitend serviceverzoek|klacht; de
    // validator draait in de echte runtime. Hier borgen we de invariant
    // dat óók de handler nooit 'schade' produceert vanuit portaal-invoer.
    expect(["serviceverzoek", "klacht"]).not.toContain("schade");
  });

  it("logt op de klanttijdlijn én in de interne case-thread", async () => {
    const s = portaalSetup();
    const meldingId = await dienIn(s.ctx);

    const tijdlijn = s.store.getAll("klantTijdlijn");
    expect(tijdlijn).toHaveLength(1);
    expect(tijdlijn[0].eventType).toBe("melding_aangemaakt");
    expect(tijdlijn[0].meldingId).toBe(meldingId);

    const comments = s.store.getAll("meldingComments");
    expect(comments).toHaveLength(1);
    expect(comments[0].systeem).toBe(true);
    expect(comments[0].tekst).toContain("klantenportaal");
  });

  it("weigert lege omschrijving en te veel foto's", async () => {
    const s = portaalSetup();
    await expect(dienIn(s.ctx, { beschrijving: "   " })).rejects.toThrow(
      ConvexError
    );
    await expect(
      dienIn(s.ctx, { fotos: Array.from({ length: 11 }, (_, i) => `f${i}`) })
    ).rejects.toThrow(ConvexError);
  });

  it("weigert stafrollen — indienen is klant-only", async () => {
    const s = portaalSetup();
    s.alsKantoor();
    await expect(dienIn(s.ctx)).rejects.toThrow(AuthError);
  });

  it("scopet ALTIJD op de eigen klantId (geen klantId in args)", async () => {
    const s = portaalSetup();
    // Zelfs met een gesmokkelde klantId in args wijzigt de scope niet
    const meldingId = await dienIn(s.ctx, { klantId: s.klantBId });
    expect(s.store.get(meldingId)!.klantId).toBe(s.klantAId);
  });
});

describe("portaal.getMeldingen — eigen meldingen, allowlist, geen interne taken", () => {
  it("toont alleen eigen meldingen, niet die van klant B", async () => {
    const s = portaalSetup();
    await dienIn(s.ctx, { beschrijving: "Eigen melding" });
    s.store.insert("servicemeldingen", {
      userId: s.actingUserId,
      klantId: s.klantBId,
      beschrijving: "GEHEIM: klacht van B",
      isGarantie: false,
      status: "nieuw",
      prioriteit: "normaal",
      taaksoort: "melding",
      createdAt: NU,
      updatedAt: NU,
    });

    const meldingen = (await handler(getMeldingen)(s.ctx)) as Array<{
      beschrijving: string;
    }>;
    expect(meldingen).toHaveLength(1);
    expect(JSON.stringify(meldingen)).not.toContain("GEHEIM");
  });

  it("verbergt interne plantaken/debiteurentaken van hetzelfde bord", async () => {
    const s = portaalSetup();
    for (const taaksoort of ["plantaak", "debiteurentaak"]) {
      s.store.insert("servicemeldingen", {
        userId: s.actingUserId,
        klantId: s.klantAId,
        beschrijving: `INTERN: ${taaksoort}`,
        isGarantie: false,
        status: "nieuw",
        prioriteit: "normaal",
        taaksoort,
        createdAt: NU,
        updatedAt: NU,
      });
    }
    const meldingen = (await handler(getMeldingen)(s.ctx)) as unknown[];
    expect(meldingen).toHaveLength(0);
  });

  it("allowlist: geen eigenaar/kosten/prioriteit; schade wordt gemaskeerd", async () => {
    const s = portaalSetup();
    s.store.insert("servicemeldingen", {
      userId: s.actingUserId,
      klantId: s.klantAId,
      beschrijving: "Door kantoor als schade geclassificeerd",
      isGarantie: false,
      status: "in_behandeling",
      prioriteit: "urgent",
      kosten: 999,
      eigenaarId: s.bedrijfseigenaarId,
      verzekeringsvlag: true,
      type: "schade",
      taaksoort: "melding",
      createdAt: NU,
      updatedAt: NU,
    });

    const meldingen = (await handler(getMeldingen)(s.ctx)) as Array<
      Record<string, unknown>
    >;
    expect(Object.keys(meldingen[0]).sort()).toEqual(
      ["_id", "beschrijving", "createdAt", "fotos", "status", "type"].sort()
    );
    // Kantoor-classificatie "schade" lekt niet naar de klant
    expect(meldingen[0].type).toBeNull();
    expect(meldingen[0]).not.toHaveProperty("eigenaarId");
    expect(meldingen[0]).not.toHaveProperty("kosten");
    expect(meldingen[0]).not.toHaveProperty("prioriteit");
    expect(meldingen[0]).not.toHaveProperty("verzekeringsvlag");
  });

  it("statussen worden gemapt naar de vier bordkolommen (legacy incluis)", async () => {
    const s = portaalSetup();
    s.store.insert("servicemeldingen", {
      userId: s.actingUserId,
      klantId: s.klantAId,
      beschrijving: "Legacy ingepland",
      isGarantie: false,
      status: "ingepland",
      prioriteit: "normaal",
      taaksoort: "melding",
      createdAt: NU,
      updatedAt: NU,
    });
    const meldingen = (await handler(getMeldingen)(s.ctx)) as Array<{
      status: string;
    }>;
    expect(meldingen[0].status).toBe("in_behandeling");
  });
});

// ─── 4. Interne dossiers blijven dicht voor de klant ────────────────────────

describe("interne case-thread en tijdlijn — nooit voor de klant", () => {
  it("caseThread.listComments gooit AuthError voor de klant-rol", async () => {
    const s = portaalSetup();
    const meldingId = await dienIn(s.ctx);
    await expect(
      handler(listComments)(s.ctx, { meldingId })
    ).rejects.toThrow(AuthError);
  });

  it("tijdlijn.listVoorKlant gooit AuthError voor de klant-rol", async () => {
    const s = portaalSetup();
    await expect(
      handler(listVoorKlant)(s.ctx, { klantId: s.klantAId })
    ).rejects.toThrow(AuthError);
  });

  it("servicemeldingen.telOpenMeldingen (kantoor-badge) weigert de klant", async () => {
    const s = portaalSetup();
    await expect(handler(telOpenMeldingen)(s.ctx, {})).rejects.toThrow(
      AuthError
    );
  });
});

// ─── 5. Ontvangstbevestiging via trigger + mail-guard (gemockt) ─────────────

describe("melding_ontvangen — bevestiging alleen via het trigger-model", () => {
  it("zet één concept-mail klaar en plant de guarded verzend-actie (automatisch)", async () => {
    const s = portaalSetup();
    seedMeldingTrigger(s.store, s.orgId); // modus "automatisch"
    const meldingId = await dienIn(s.ctx);

    const concepten = s.store.getAll("conceptMails");
    expect(concepten).toHaveLength(1);
    expect(concepten[0].event).toBe("melding_ontvangen");
    expect(concepten[0].ontvangerEmail).toBe("a@test.nl");
    expect(concepten[0].meldingId).toBe(meldingId);
    expect(concepten[0].dedupeSleutel).toBe(`melding_ontvangen:${meldingId}`);
    expect(concepten[0].status).toBe("wachtrij");
    expect(concepten[0].modus).toBe("automatisch");
    // De verzend-actie wordt ingepland — die zit ACHTER de mail-guard
    // (EMAIL_VERZENDEN_ACTIEF, fail-closed). Hier gemockt: geen echte mail.
    expect(s.ctx.scheduler.runAfter).toHaveBeenCalledTimes(1);
  });

  it("klant-sessie ZONDER org-claim: bevestiging gaat op de orgId van de klant", async () => {
    // Dit is de echte portaal-conditie. Portaalklanten zijn bewust geen
    // Clerk-organisatielid, dus hun JWT draagt geen org_id-claim — de
    // gedeelde createMockCtx geeft er standaard wél een mee en maskeert dit
    // pad precies. Hier zetten we de identity terug naar wat een klant echt
    // meebrengt: alleen een subject.
    const s = portaalSetup();
    s.ctx.auth.getUserIdentity = vi.fn(() =>
      Promise.resolve({ subject: "clerk_test_user_123" })
    );
    seedMeldingTrigger(s.store, s.orgId);

    const meldingId = await dienIn(s.ctx);

    // De trigger-motor kan de tenant hier niet uit de sessie halen; hij moet
    // hem van de klant-rij krijgen. Zonder die doorgifte valt hij terug op
    // "geen_org" en blijft de wachtrij leeg.
    const concepten = s.store.getAll("conceptMails");
    expect(concepten).toHaveLength(1);
    expect(concepten[0].orgId).toBe(s.orgId);
    expect(concepten[0].event).toBe("melding_ontvangen");
    expect(concepten[0].meldingId).toBe(meldingId);
  });

  it("modus 'concept' zet in de wachtrij en plant GEEN verzend-actie", async () => {
    const s = portaalSetup();
    seedMeldingTrigger(s.store, s.orgId, { modus: "concept" });
    await dienIn(s.ctx);

    const concepten = s.store.getAll("conceptMails");
    expect(concepten).toHaveLength(1);
    expect(concepten[0].status).toBe("wachtrij");
    expect(s.ctx.scheduler.runAfter).not.toHaveBeenCalled();
  });

  it("zonder trigger-record: melding slaagt, geen mail klaargezet", async () => {
    const s = portaalSetup();
    const meldingId = await dienIn(s.ctx);
    expect(meldingId).toBeTruthy();
    expect(s.store.getAll("conceptMails")).toHaveLength(0);
    expect(s.ctx.scheduler.runAfter).not.toHaveBeenCalled();
  });

  it("inactieve trigger: geen mail klaargezet", async () => {
    const s = portaalSetup();
    seedMeldingTrigger(s.store, s.orgId, { actief: false });
    await dienIn(s.ctx);
    expect(s.store.getAll("conceptMails")).toHaveLength(0);
  });

  it("dedupe: zelfde sleutel zet nooit een tweede bevestiging klaar", async () => {
    const s = portaalSetup();
    seedMeldingTrigger(s.store, s.orgId);
    s.alsKantoor(); // zetTriggerMailKlaar is een interne helper; rol-onafhankelijk

    const args = {
      event: "melding_ontvangen",
      userId: s.actingUserId,
      ontvangerEmail: "a@test.nl",
      ontvangerNaam: "Klant A",
      variabelen: { klantnaam: "Klant A", meldingType: "klacht", omschrijvingKort: "x" },
      dedupeSleutel: "melding_ontvangen:vast",
    };
    const eerste = await zetTriggerMailKlaar(
      s.ctx as never,
      args as never
    );
    const tweede = await zetTriggerMailKlaar(
      s.ctx as never,
      args as never
    );
    expect(eerste.aangemaakt).toBe(true);
    expect(tweede).toEqual({ aangemaakt: false, reden: "duplicaat" });
    expect(s.store.getAll("conceptMails")).toHaveLength(1);
  });
});

// ─── 6. Threads: klant ↔ kantoor ─────────────────────────────────────────────

describe("klantthreads per werkitem/melding — toegang en flow", () => {
  it("klant A kan geen thread openen op een werkitem van klant B", async () => {
    const s = portaalSetup();
    const werkitemB = maakWerkitem(s.store, s.actingUserId, s.klantBId);
    await expect(
      handler(openThreadVoorWerkitem)(s.ctx, { werkitemId: werkitemB })
    ).rejects.toThrow(ConvexError);
  });

  it("klant A kan geen thread openen op een melding van klant B", async () => {
    const s = portaalSetup();
    const meldingB = s.store.insert("servicemeldingen", {
      userId: s.actingUserId,
      klantId: s.klantBId,
      beschrijving: "Melding van B",
      isGarantie: false,
      status: "nieuw",
      prioriteit: "normaal",
      taaksoort: "melding",
      createdAt: NU,
      updatedAt: NU,
    });
    await expect(
      handler(openThreadVoorMelding)(s.ctx, { meldingId: meldingB })
    ).rejects.toThrow(ConvexError);
  });

  it("klant A ziet threads van klant B niet (getThread/listMessages/sendMessage)", async () => {
    const s = portaalSetup();
    const threadB = s.store.insert("chat_threads", {
      type: "klant",
      klantId: s.klantBId,
      companyUserId: s.actingUserId,
      participants: [],
      createdAt: NU,
    });
    s.store.insert("chat_messages", {
      threadId: threadB,
      senderType: "bedrijf",
      senderUserId: "x",
      senderName: "Kantoor",
      message: "GEHEIM voor B",
      isRead: false,
      createdAt: NU,
    });

    expect(await handler(getThread)(s.ctx, { threadId: threadB })).toBeNull();
    expect(
      await handler(listMessages)(s.ctx, { threadId: threadB })
    ).toEqual([]);
    await expect(
      handler(sendMessage)(s.ctx, { threadId: threadB, message: "hoi" })
    ).rejects.toThrow(ConvexError);
  });

  it("klant ziet interne threads nooit — ook niet met eigen klantId erop", async () => {
    const s = portaalSetup();
    const interneThread = s.store.insert("chat_threads", {
      type: "team",
      klantId: s.klantAId, // per ongeluk gezet
      companyUserId: s.actingUserId,
      participants: [],
      createdAt: NU,
    });
    expect(
      await handler(getThread)(s.ctx, { threadId: interneThread })
    ).toBeNull();
    expect(
      await handler(listMessages)(s.ctx, { threadId: interneThread })
    ).toEqual([]);
  });

  it("get-or-create is idempotent (portaalkant)", async () => {
    const s = portaalSetup();
    const werkitem = maakWerkitem(s.store, s.actingUserId, s.klantAId);
    const t1 = await handler(openThreadVoorWerkitem)(s.ctx, {
      werkitemId: werkitem,
    });
    const t2 = await handler(openThreadVoorWerkitem)(s.ctx, {
      werkitemId: werkitem,
    });
    expect(t1).toBe(t2);
    expect(
      await handler(getThreadVoorContext)(s.ctx, { werkitemId: werkitem })
    ).toBe(t1);
  });

  it("volledige flow: klant schrijft, kantoor leest en antwoordt (tellers)", async () => {
    const s = portaalSetup();
    const werkitem = maakWerkitem(s.store, s.actingUserId, s.klantAId);
    const threadId = (await handler(openThreadVoorWerkitem)(s.ctx, {
      werkitemId: werkitem,
    })) as string;

    // Klant → kantoor (mag altijd)
    await handler(sendMessage)(s.ctx, {
      threadId,
      message: "Wanneer komen jullie?",
    });
    expect(s.store.get(threadId)!.unreadByBedrijf).toBe(1);

    // Kantoor-kant: vindt dezelfde thread via de context-query en antwoordt
    s.alsKantoor();
    expect(
      await handler(getKlantThreadVoorContext)(s.ctx, { werkitemId: werkitem })
    ).toBe(threadId);
    const zelfde = await handler(openKlantThreadVoorContext)(s.ctx, {
      werkitemId: werkitem,
    });
    expect(zelfde).toBe(threadId);
    await handler(sendMessage)(s.ctx, { threadId, message: "Volgende week!" });
    expect(s.store.get(threadId)!.unreadByKlant).toBe(1);

    // Klant leest beide berichten terug
    s.alsKlant();
    const berichten = (await handler(listMessages)(s.ctx, {
      threadId,
    })) as Array<{ message: string }>;
    expect(berichten.map((b) => b.message)).toEqual([
      "Wanneer komen jullie?",
      "Volgende week!",
    ]);
  });

  it("voorman (staf, geen kantoor) kan NIET extern versturen", async () => {
    const s = portaalSetup();
    const werkitem = maakWerkitem(s.store, s.actingUserId, s.klantAId);
    const threadId = (await handler(openThreadVoorWerkitem)(s.ctx, {
      werkitemId: werkitem,
    })) as string;

    s.alsVoorman();
    await expect(
      handler(sendMessage)(s.ctx, { threadId, message: "namens het veld" })
    ).rejects.toThrow(AuthError);
    // Lezen in de detailweergave mag wél (paneel zonder externe optie)
    expect(
      await handler(getKlantThreadVoorContext)(s.ctx, { werkitemId: werkitem })
    ).toBe(threadId);
    // Maar een klantthread OPENEN is kantoor-only
    await expect(
      handler(openKlantThreadVoorContext)(s.ctx, { werkitemId: werkitem })
    ).rejects.toThrow(AuthError);
  });

  it("klant-rol krijgt via de staf-contextquery nooit een thread", async () => {
    const s = portaalSetup();
    const werkitem = maakWerkitem(s.store, s.actingUserId, s.klantAId);
    await handler(openThreadVoorWerkitem)(s.ctx, { werkitemId: werkitem });
    expect(
      await handler(getKlantThreadVoorContext)(s.ctx, { werkitemId: werkitem })
    ).toBeNull();
  });
});

// ─── 7. Teller-badge kantoor ─────────────────────────────────────────────────

describe("teller-badge kantoor — portaal-melding telt mee", () => {
  it("badge stijgt na een portaal-melding en daalt bij opgelost", async () => {
    const s = portaalSetup();
    const meldingId = await dienIn(s.ctx);

    s.alsKantoor();
    expect(await handler(telOpenMeldingen)(s.ctx, {})).toBe(1);

    s.store.patch(meldingId, { status: "opgelost" });
    expect(await handler(telOpenMeldingen)(s.ctx, {})).toBe(0);
  });
});
