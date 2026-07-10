/**
 * Klanttijdlijn-tests (PRD §2.3, acceptatie §8.1 "Pietje-test").
 *
 * Dekt:
 * 1. logTijdlijnEvent — defaults, niet-blokkerend gedrag;
 * 2. toegang — de klant-rol krijgt op ELKE tijdlijn-query/mutation een
 *    AuthError (de tijdlijn is een intern kantoordossier, PRD §1.2);
 * 3. handmatige entries (kantoor-only) incl. werkitem-koppeling en validatie;
 * 4. filters op kanaal en werkitem + vrij zoeken;
 * 5. auto-events vanuit de gekoppelde mutations (offerte verzonden,
 *    werkitem ingepland, contract geactiveerd/opgezegd, portaal-uitnodiging,
 *    lead gewonnen, portaal-acceptatie);
 * 6. notities-migratie — gebatcht, idempotent, dry-run.
 *
 * E-mailveiligheid: er wordt NOOIT echt gemaild — de mock-ctx gebruikt een
 * vi.fn()-scheduler; Resend-/Clerk-code wordt nergens uitgevoerd.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import {
  MockConvexStore,
  createMockCtx,
  createMockUser,
  createMockKlant,
  createMockOfferte,
} from "../../helpers/convex-mock";
import { AuthError } from "../../../../convex/auth";
import {
  logTijdlijnEvent,
  requireInterneRol,
  listVoorKlant,
  listVoorWerkitem,
  zoek,
  listKlantenMetTijdlijn,
  listWerkitemsMetTijdlijn,
  listWerkitemsVoorFilter,
  chatHistorieVoorKlant,
  voegEntryToe,
} from "../../../../convex/tijdlijn";
import {
  migreerNotitieVoorKlant,
  migreerNotities,
} from "../../../../convex/tijdlijnMigratie";
import { updatePlanning } from "../../../../convex/werkitems";
import { updateStatus as offerteUpdateStatus } from "../../../../convex/offertes";
import { activeerContract } from "../../../../convex/beurtgenerator";
import { cancelContract } from "../../../../convex/onderhoudscontracten";
import { sendPortalInvitation } from "../../../../convex/klanten";
import { respondToOfferte } from "../../../../convex/portaal";
import { promoveerLead } from "../../../../convex/leadsKlantenHelpers";
import type { MutationCtx } from "../../../../convex/_generated/server";

// ─── Helpers ─────────────────────────────────────────────────────────────────

type AnyHandler = (ctx: unknown, args: unknown) => Promise<unknown>;

/** Convex registreert de handler op de functie zelf (func._handler). */
function handler(fn: unknown): AnyHandler {
  return (fn as { _handler: AnyHandler })._handler;
}

/** Ctx + store met precies één ingelogde gebruiker met de gegeven rol. */
function ctxMetRol(role: string, extra: Record<string, unknown> = {}) {
  const store = new MockConvexStore();
  const userId = store.insert("users", createMockUser({ role, ...extra }));
  const ctx = createMockCtx(store);
  return { ctx, store, userId };
}

function insertTijdlijnEntry(
  store: MockConvexStore,
  userId: string,
  klantId: string,
  overrides: Record<string, unknown> = {}
) {
  return store.insert("klantTijdlijn", {
    userId,
    klantId,
    timestamp: Date.now(),
    auteurNaam: "Systeem",
    kanaal: "systeem",
    eventType: "handmatig",
    tekst: "Testentry",
    createdAt: Date.now(),
    ...overrides,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── 1. logTijdlijnEvent ─────────────────────────────────────────────────────

describe("logTijdlijnEvent (centrale helper)", () => {
  it("schrijft een systeem-event met defaults (kanaal systeem, auteur Systeem)", async () => {
    const { ctx, store, userId } = ctxMetRol("directie");
    const klantId = store.insert("klanten", createMockKlant(userId));

    const id = await logTijdlijnEvent(ctx as unknown as MutationCtx, {
      userId: userId as never,
      klantId: klantId as never,
      eventType: "offerte_verzonden",
      tekst: "Offerte OFF-1 verzonden",
    });

    expect(id).not.toBeNull();
    const entries = store.getAll("klantTijdlijn");
    expect(entries).toHaveLength(1);
    expect(entries[0].kanaal).toBe("systeem");
    expect(entries[0].auteurNaam).toBe("Systeem");
    expect(entries[0].eventType).toBe("offerte_verzonden");
    expect(entries[0].klantId).toBe(klantId);
  });

  it("ondersteunt toekomstige event-typen (§2.6/§2.8/§2.4) en meldingId alvast", async () => {
    const { ctx, store, userId } = ctxMetRol("directie");
    const klantId = store.insert("klanten", createMockKlant(userId));

    for (const eventType of [
      "beurt_afgerond",
      "factuur_verzonden",
      "factuur_betaald",
      "melding_aangemaakt",
      "melding_status_gewijzigd",
    ] as const) {
      const id = await logTijdlijnEvent(ctx as unknown as MutationCtx, {
        userId: userId as never,
        klantId: klantId as never,
        eventType,
        tekst: `Event ${eventType}`,
        meldingId: "melding-123" as never,
      });
      expect(id).not.toBeNull();
    }
    expect(store.getAll("klantTijdlijn")).toHaveLength(5);
  });

  it("is niet-blokkerend: een insert-fout gooit niet maar geeft null terug", async () => {
    const { ctx, userId } = ctxMetRol("directie");
    const consoleSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    ctx.db.insert.mockRejectedValueOnce(new Error("db down"));

    const id = await logTijdlijnEvent(ctx as unknown as MutationCtx, {
      userId: userId as never,
      klantId: "klanten:999" as never,
      eventType: "handmatig",
      tekst: "mag niet crashen",
    });

    expect(id).toBeNull();
    expect(consoleSpy).toHaveBeenCalled();
    // Geen PII in de log: alleen event-type + foutklasse
    const logArgs = consoleSpy.mock.calls[0].join(" ");
    expect(logArgs).not.toContain("mag niet crashen");
  });
});

// ─── 2. Toegang: klant-rol krijgt AuthError op ALLES ─────────────────────────

describe("Toegang (PRD §1.2): klant-rol heeft geen enkele tijdlijn-functie", () => {
  const alleFuncties: Array<[string, unknown, unknown]> = [
    ["listVoorKlant", listVoorKlant, { klantId: "klanten:1" }],
    ["listVoorWerkitem", listVoorWerkitem, { werkitemId: "projecten:1" }],
    ["zoek", zoek, { zoekterm: "heg" }],
    ["listKlantenMetTijdlijn", listKlantenMetTijdlijn, {}],
    ["listWerkitemsMetTijdlijn", listWerkitemsMetTijdlijn, {}],
    ["listWerkitemsVoorFilter", listWerkitemsVoorFilter, { klantId: "klanten:1" }],
    ["chatHistorieVoorKlant", chatHistorieVoorKlant, { klantId: "klanten:1" }],
    [
      "voegEntryToe",
      voegEntryToe,
      { klantId: "klanten:1", kanaal: "telefoon", tekst: "hoi" },
    ],
  ];

  for (const [naam, fn, args] of alleFuncties) {
    it(`${naam} gooit AuthError voor de klant-rol`, async () => {
      const { ctx } = ctxMetRol("klant", { linkedKlantId: "klanten:1" });
      await expect(handler(fn)(ctx, args)).rejects.toThrow(AuthError);
    });
  }

  it("requireInterneRol accepteert alle interne rollen", async () => {
    for (const rol of [
      "directie",
      "projectleider",
      "voorman",
      "medewerker",
      "materiaalman",
      "onderaannemer_zzp",
    ]) {
      const { ctx } = ctxMetRol(rol);
      await expect(
        requireInterneRol(ctx as unknown as MutationCtx)
      ).resolves.toBeDefined();
    }
  });

  it("voegEntryToe weigert ook voorman en medewerker (schrijven = kantoor)", async () => {
    for (const rol of ["voorman", "medewerker"]) {
      const { ctx, store, userId } = ctxMetRol(rol);
      const klantId = store.insert("klanten", createMockKlant(userId));
      await expect(
        handler(voegEntryToe)(ctx, {
          klantId,
          kanaal: "telefoon",
          tekst: "poging",
        })
      ).rejects.toThrow(AuthError);
      expect(store.getAll("klantTijdlijn")).toHaveLength(0);
    }
  });
});

// ─── 3. Handmatige entries ───────────────────────────────────────────────────

describe("voegEntryToe (handmatige entry, kantoor)", () => {
  it("slaat een telefoonnotitie op met werkitem-koppeling en foto's", async () => {
    const { ctx, store, userId } = ctxMetRol("directie");
    const klantId = store.insert("klanten", createMockKlant(userId));
    const werkitemId = store.insert("projecten", {
      userId,
      klantId,
      naam: "Voorjaarsbeurt",
      type: "onderhoudsbeurt",
      status: "gepland",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    await handler(voegEntryToe)(ctx, {
      klantId,
      kanaal: "telefoon",
      tekst: "Klant belde: heg graag vóór juni snoeien.",
      werkitemId,
      bijlagen: ["_storage:1"],
    });

    const entries = store.getAll("klantTijdlijn");
    expect(entries).toHaveLength(1);
    expect(entries[0].kanaal).toBe("telefoon");
    expect(entries[0].eventType).toBe("handmatig");
    expect(entries[0].werkitemId).toBe(werkitemId);
    expect(entries[0].bijlagen).toEqual(["_storage:1"]);
    expect(entries[0].auteurNaam).toBe("Test User");
  });

  it("ondersteunt WhatsApp als handmatig kanaal (fase 1: plakken/samenvatten)", async () => {
    const { ctx, store, userId } = ctxMetRol("projectleider");
    const klantId = store.insert("klanten", createMockKlant(userId));

    await handler(voegEntryToe)(ctx, {
      klantId,
      kanaal: "whatsapp",
      tekst: "WhatsApp-samenvatting: akkoord met meerwerk borders.",
    });

    expect(store.getAll("klantTijdlijn")[0].kanaal).toBe("whatsapp");
  });

  it("weigert lege tekst", async () => {
    const { ctx, store, userId } = ctxMetRol("directie");
    const klantId = store.insert("klanten", createMockKlant(userId));
    await expect(
      handler(voegEntryToe)(ctx, { klantId, kanaal: "intern", tekst: "   " })
    ).rejects.toThrow();
  });

  it("weigert een werkitem dat niet bij de klant hoort", async () => {
    const { ctx, store, userId } = ctxMetRol("directie");
    const klantA = store.insert("klanten", createMockKlant(userId));
    const klantB = store.insert("klanten", createMockKlant(userId));
    const werkitemVanB = store.insert("projecten", {
      userId,
      klantId: klantB,
      naam: "Klus van B",
      status: "gepland",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    await expect(
      handler(voegEntryToe)(ctx, {
        klantId: klantA,
        kanaal: "telefoon",
        tekst: "verkeerde koppeling",
        werkitemId: werkitemVanB,
      })
    ).rejects.toThrow();
  });
});

// ─── 4. Filters + zoeken (Pietje-test §8.1) ──────────────────────────────────

describe("Filters en zoeken (Pietje-test §8.1)", () => {
  function storeMetEntries() {
    const basis = ctxMetRol("directie");
    const { store, userId } = basis;
    const klantId = store.insert("klanten", createMockKlant(userId));
    const andereKlant = store.insert("klanten", createMockKlant(userId));
    const werkitemId = store.insert("projecten", {
      userId,
      klantId,
      naam: "Herfstsnoei",
      status: "gepland",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    insertTijdlijnEntry(store, userId, klantId, {
      kanaal: "telefoon",
      tekst: "Belde over de heg",
      auteurNaam: "Yannick",
      timestamp: 3,
    });
    insertTijdlijnEntry(store, userId, klantId, {
      kanaal: "whatsapp",
      tekst: "App over factuur",
      werkitemId,
      timestamp: 2,
    });
    insertTijdlijnEntry(store, userId, andereKlant, {
      kanaal: "telefoon",
      tekst: "Andere klant, andere klus",
      timestamp: 1,
    });
    return { ...basis, klantId, andereKlant, werkitemId };
  }

  it("listVoorKlant toont alleen entries van díe klant, nieuwste boven", async () => {
    const { ctx, klantId } = storeMetEntries();
    const result = (await handler(listVoorKlant)(ctx, { klantId })) as Array<{
      tekst: string;
      timestamp: number;
    }>;
    expect(result).toHaveLength(2);
    expect(result[0].timestamp).toBeGreaterThan(result[1].timestamp);
    expect(result.every((e) => e.tekst !== "Andere klant, andere klus")).toBe(
      true
    );
  });

  it("filtert op kanaal", async () => {
    const { ctx, klantId } = storeMetEntries();
    const result = (await handler(listVoorKlant)(ctx, {
      klantId,
      kanaal: "whatsapp",
    })) as Array<{ kanaal: string }>;
    expect(result).toHaveLength(1);
    expect(result[0].kanaal).toBe("whatsapp");
  });

  it("filtert op werkitem en verrijkt met werkitemNaam (over welke klus?)", async () => {
    const { ctx, klantId, werkitemId } = storeMetEntries();
    const result = (await handler(listVoorKlant)(ctx, {
      klantId,
      werkitemId,
    })) as Array<{ tekst: string; werkitemNaam?: string }>;
    expect(result).toHaveLength(1);
    expect(result[0].tekst).toBe("App over factuur");
    expect(result[0].werkitemNaam).toBe("Herfstsnoei");
  });

  it("listVoorWerkitem geeft dezelfde data via de werkitem-ingang", async () => {
    const { ctx, werkitemId } = storeMetEntries();
    const result = (await handler(listVoorWerkitem)(ctx, {
      werkitemId,
    })) as Array<{ tekst: string }>;
    expect(result).toHaveLength(1);
    expect(result[0].tekst).toBe("App over factuur");
  });

  it("zoeken vindt een entry op tekst binnen de klant", async () => {
    const { ctx, klantId } = storeMetEntries();
    const result = (await handler(zoek)(ctx, {
      zoekterm: "heg",
      klantId,
    })) as Array<{ tekst: string }>;
    expect(result.some((e) => e.tekst.includes("heg"))).toBe(true);
    expect(result.every((e) => e.tekst !== "Andere klant, andere klus")).toBe(
      true
    );
  });

  it("lege zoekterm geeft lege lijst (geen full-table dump)", async () => {
    const { ctx } = storeMetEntries();
    const result = await handler(zoek)(ctx, { zoekterm: "   " });
    expect(result).toEqual([]);
  });

  it("listKlantenMetTijdlijn sorteert op laatste activiteit met preview", async () => {
    const { ctx, klantId } = storeMetEntries();
    const result = (await handler(listKlantenMetTijdlijn)(ctx, {})) as Array<{
      klantId: string;
      laatsteEntryPreview?: string;
    }>;
    expect(result.length).toBeGreaterThanOrEqual(2);
    const eerste = result.find((k) => k.klantId === klantId);
    expect(eerste?.laatsteEntryPreview).toBeDefined();
  });
});

// ─── 5. Auto-events per gekoppelde mutation ──────────────────────────────────

describe("Auto-events (kanaal systeem) vanuit bestaande mutations", () => {
  it("werkitems.updatePlanning logt 'Ingepland: team, datum' op de tijdlijn", async () => {
    const { ctx, store, userId } = ctxMetRol("directie");
    const klantId = store.insert("klanten", createMockKlant(userId));
    const teamId = store.insert("teams", {
      userId,
      naam: "Team Groen",
      createdAt: Date.now(),
    });
    const werkitemId = store.insert("projecten", {
      userId,
      klantId,
      naam: "Voorjaarsbeurt",
      type: "onderhoudsbeurt",
      status: "gepland",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    await handler(updatePlanning)(ctx, {
      id: werkitemId,
      geplandeStart: "2026-05-14",
      teamId,
    });

    const entries = store
      .getAll("klantTijdlijn")
      .filter((e) => e.eventType === "werkitem_ingepland");
    expect(entries).toHaveLength(1);
    expect(entries[0].kanaal).toBe("systeem");
    expect(entries[0].werkitemId).toBe(werkitemId);
    expect(entries[0].tekst).toContain("Ingepland");
    expect(entries[0].tekst).toContain("Team Groen");
    expect(entries[0].tekst).toContain("2026-05-14");
    // Naast, niet in plaats van, het planbordLogboek
    expect(store.getAll("planbordLogboek")).toHaveLength(1);
  });

  it("offertes.updateStatus logt 'offerte verzonden'", async () => {
    const { ctx, store, userId } = ctxMetRol("directie");
    const klantId = store.insert("klanten", createMockKlant(userId));
    const offerteId = store.insert(
      "offertes",
      createMockOfferte(userId, klantId, { status: "concept", bron: "vrij" })
    );

    await handler(offerteUpdateStatus)(ctx, {
      id: offerteId,
      status: "verzonden",
    });

    const entries = store
      .getAll("klantTijdlijn")
      .filter((e) => e.eventType === "offerte_verzonden");
    expect(entries).toHaveLength(1);
    expect(entries[0].tekst).toContain("OFF-2026-001");
    expect(entries[0].klantId).toBe(klantId);
  });

  it("portaal.respondToOfferte logt 'geaccepteerd via het portaal'", async () => {
    const store = new MockConvexStore();
    const klantId = store.insert("klanten", {
      userId: "users:eigenaar",
      naam: "Jan de Vries",
      adres: "Tulpstraat 12",
      postcode: "1234 AB",
      plaats: "Amsterdam",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    store.insert(
      "users",
      createMockUser({ role: "klant", linkedKlantId: klantId })
    );
    const offerteId = store.insert(
      "offertes",
      createMockOfferte("users:eigenaar", klantId, {
        status: "verzonden",
        bron: "vrij",
      })
    );
    const ctx = createMockCtx(store);

    await handler(respondToOfferte)(ctx, {
      offerteId,
      status: "geaccepteerd",
      signature: "handtekening-jan",
    });

    const entries = store
      .getAll("klantTijdlijn")
      .filter((e) => e.eventType === "offerte_geaccepteerd");
    expect(entries).toHaveLength(1);
    expect(entries[0].tekst).toContain("portaal");
    expect(entries[0].kanaal).toBe("systeem");
  });

  it("beurtgenerator.activeerContract logt 'contract geactiveerd' (alleen bij concept → actief)", async () => {
    const { ctx, store, userId } = ctxMetRol("directie");
    const klantId = store.insert("klanten", createMockKlant(userId));
    const contractId = store.insert("onderhoudscontracten", {
      userId,
      klantId,
      contractNummer: "OC-2026-001",
      naam: "Onderhoud voorjaar",
      locatie: { adres: "Tulpstraat 12", postcode: "1234 AB", plaats: "Amsterdam" },
      status: "concept",
      startDatum: "2026-01-01",
      eindDatum: "2026-12-31",
      opzegtermijnDagen: 30,
      tariefPerTermijn: 100,
      betalingsfrequentie: "maandelijks",
      autoVerlenging: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    await handler(activeerContract)(ctx, { id: contractId });

    const entries = store
      .getAll("klantTijdlijn")
      .filter((e) => e.eventType === "contract_geactiveerd");
    expect(entries).toHaveLength(1);
    expect(entries[0].tekst).toContain("OC-2026-001");

    // Idempotente her-run op een al actief contract logt NIET dubbel
    await handler(activeerContract)(ctx, { id: contractId });
    expect(
      store
        .getAll("klantTijdlijn")
        .filter((e) => e.eventType === "contract_geactiveerd")
    ).toHaveLength(1);
  });

  it("onderhoudscontracten.cancelContract logt 'contract opgezegd' met reden", async () => {
    const { ctx, store, userId } = ctxMetRol("directie");
    const klantId = store.insert("klanten", createMockKlant(userId));
    const contractId = store.insert("onderhoudscontracten", {
      userId,
      klantId,
      contractNummer: "OC-2026-002",
      naam: "Onderhoud",
      status: "actief",
      startDatum: "2026-01-01",
      eindDatum: "2026-12-31",
      opzegtermijnDagen: 30,
      tariefPerTermijn: 100,
      betalingsfrequentie: "maandelijks",
      autoVerlenging: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    await handler(cancelContract)(ctx, {
      id: contractId,
      reden: "Verhuizing",
    });

    const entries = store
      .getAll("klantTijdlijn")
      .filter((e) => e.eventType === "contract_opgezegd");
    expect(entries).toHaveLength(1);
    expect(entries[0].tekst).toContain("OC-2026-002");
    expect(entries[0].tekst).toContain("Verhuizing");
  });

  it("klanten.sendPortalInvitation logt 'portaal-uitnodiging verstuurd' (mail via gemockte scheduler)", async () => {
    const { ctx, store, userId } = ctxMetRol("directie");
    const klantId = store.insert(
      "klanten",
      createMockKlant(userId, { email: "jan@devries.nl" })
    );

    await handler(sendPortalInvitation)(ctx, { id: klantId });

    const entries = store
      .getAll("klantTijdlijn")
      .filter((e) => e.eventType === "portaal_uitnodiging");
    expect(entries).toHaveLength(1);
    // Geen e-mailadres in de tijdlijntekst
    expect(entries[0].tekst).not.toContain("jan@devries.nl");
    // Mail is alleen GEPLAND via de gemockte scheduler — nooit echt verstuurd
    expect(ctx.scheduler.runAfter).toHaveBeenCalled();
  });

  it("promoveerLead (markGewonnen-kern) logt 'lead gewonnen' met werkitem", async () => {
    const { ctx, store, userId } = ctxMetRol("directie");
    const user = store.getAll("users")[0];
    const leadId = store.insert("configuratorAanvragen", {
      referentie: "AAN-2026-042",
      klantNaam: "Pietje Puk",
      klantEmail: "pietje@puk.nl",
      klantAdres: "Dorpsstraat 1",
      status: "nieuw",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    const lead = store.get(leadId);

    const resultaat = await promoveerLead(
      ctx as unknown as Parameters<typeof promoveerLead>[0],
      lead as never,
      user as never
    );

    expect(resultaat.klantId).toBeDefined();
    const entries = store
      .getAll("klantTijdlijn")
      .filter((e) => e.eventType === "lead_gewonnen");
    expect(entries).toHaveLength(1);
    expect(entries[0].klantId).toBe(resultaat.klantId);
    expect(entries[0].werkitemId).toBe(resultaat.werkitemId);
    expect(entries[0].tekst).toContain("AAN-2026-042");
    expect(entries[0].userId).toBe(userId);
  });
});

// ─── 6. Notities-migratie ────────────────────────────────────────────────────

describe("Notities-migratie (klanten.notities → tijdlijn, idempotent)", () => {
  it("migreert een notitie als 'Genoteerd vóór tijdlijn'-entry", async () => {
    const { ctx, store, userId } = ctxMetRol("directie");
    const klantId = store.insert(
      "klanten",
      createMockKlant(userId, { notities: "Sleutel ligt onder de mat" })
    );
    const klant = store.get(klantId);

    const uitkomst = await migreerNotitieVoorKlant(
      ctx as unknown as MutationCtx,
      klant as never,
      false
    );

    expect(uitkomst).toBe("gemigreerd");
    const entries = store.getAll("klantTijdlijn");
    expect(entries).toHaveLength(1);
    expect(entries[0].eventType).toBe("notitie_migratie");
    expect(entries[0].kanaal).toBe("intern");
    expect(entries[0].tekst).toBe(
      "Genoteerd vóór tijdlijn: Sleutel ligt onder de mat"
    );
  });

  it("is idempotent: tweede run slaat de klant over", async () => {
    const { ctx, store, userId } = ctxMetRol("directie");
    const klantId = store.insert(
      "klanten",
      createMockKlant(userId, { notities: "Notitie" })
    );
    const klant = store.get(klantId);

    const run1 = await migreerNotitieVoorKlant(
      ctx as unknown as MutationCtx,
      klant as never,
      false
    );
    const run2 = await migreerNotitieVoorKlant(
      ctx as unknown as MutationCtx,
      klant as never,
      false
    );

    expect(run1).toBe("gemigreerd");
    expect(run2).toBe("al_gemigreerd");
    expect(store.getAll("klantTijdlijn")).toHaveLength(1);
  });

  it("dry-run schrijft niets", async () => {
    const { ctx, store, userId } = ctxMetRol("directie");
    const klantId = store.insert(
      "klanten",
      createMockKlant(userId, { notities: "Notitie" })
    );
    const uitkomst = await migreerNotitieVoorKlant(
      ctx as unknown as MutationCtx,
      store.get(klantId) as never,
      true
    );
    expect(uitkomst).toBe("gemigreerd");
    expect(store.getAll("klantTijdlijn")).toHaveLength(0);
  });

  it("slaat klanten zonder notities over en batcht via de handler", async () => {
    const { ctx, store, userId } = ctxMetRol("directie");
    store.insert("klanten", createMockKlant(userId, { notities: "A" }));
    store.insert("klanten", createMockKlant(userId));
    store.insert("klanten", createMockKlant(userId, { notities: "  " }));

    const resultaat = (await handler(migreerNotities)(ctx, {})) as {
      verwerkt: number;
      gemigreerd: number;
      overgeslagenLeeg: number;
      klaar: boolean;
    };

    expect(resultaat.verwerkt).toBe(3);
    expect(resultaat.gemigreerd).toBe(1);
    expect(resultaat.overgeslagenLeeg).toBe(2);
    expect(resultaat.klaar).toBe(true);
    expect(store.getAll("klantTijdlijn")).toHaveLength(1);
  });
});
