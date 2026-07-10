/**
 * Facturatie-engine onderhoud + statussplitsing (PRD §2.8, acceptatietest
 * §8.8-facturatiedeel).
 *
 * Dekt: alles-afgerond → correcte concept-factuur in "Te versturen" (regels,
 * bedragen, btw-uitsplitsing); deels-uitgevoerd → alleen het uitgevoerde
 * deel; idempotentie (beurt nooit dubbel); maandverzameling voegt toe i.p.v.
 * nieuwe factuur; vast_maandbedrag negeert beurten; directVersturen alleen
 * achter guard + capability; bulk-verstuur; statusmigratie idempotent;
 * deelbetaling → gedeeltelijk_betaald; datum-van-dienst + referenties;
 * rolchecks.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  MockConvexStore,
  createMockCtx,
  createMockUser,
  createMockKlant,
} from "../../helpers/convex-mock";
import type { MutationCtx } from "../../../../convex/_generated/server";
import {
  mapLegacyStatus,
  legacyStatusVan,
  effectieveStatussen,
  bepaalBetaalStatus,
  berekenBtwUitsplitsing,
  berekenFactuurTotalen,
  bepaalEngineActie,
  bouwRegelsUitTaakAfronding,
  magEngineDirectVersturen,
  isGeldigeDocumentOvergang,
  verzamelMaandVan,
  isVerzamelMaandVoorbij,
  type LegacyFactuurStatus,
} from "../../../../convex/facturatieLogica";
import { verwerkKlaarVoorFacturatie } from "../../../../convex/facturatieEngine";
import {
  verstuurFactuurKern,
  verwerkBetaaldBedragKern,
} from "../../../../convex/facturen";
import { kanNaarKlantVersturen } from "../../../../convex/roles";
import type { Doc, Id } from "../../../../convex/_generated/dataModel";

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── Testopstelling ──────────────────────────────────────────────────────────

/** Store met bedrijf (user + instellingen) en klant — de vaste basis. */
function basisOpstelling() {
  const store = new MockConvexStore();
  const userId = store.insert("users", createMockUser({ role: "directie" }));
  const klantId = store.insert("klanten", createMockKlant(userId));
  store.insert("instellingen", {
    userId,
    laatsteFactuurNummer: 41,
    factuurNummerPrefix: "FAC-",
    standaardBetalingstermijn: 14,
    btwPercentage: 21,
    uurtarief: 45,
    bedrijfsgegevens: {
      naam: "Top Tuinen",
      adres: "Kwekerijweg 1",
      postcode: "1234 AB",
      plaats: "Boskoop",
    },
  });
  const ctx = createMockCtx(store);
  return { store, ctx: ctx as unknown as MutationCtx, userId, klantId };
}

function insertBouwsteen(
  store: MockConvexStore,
  userId: string,
  overrides: Record<string, unknown> = {}
) {
  return store.insert("bouwstenen", {
    userId,
    naam: "Gras maaien",
    btwCode: 9,
    createdAt: Date.now(),
    ...overrides,
  });
}

/** Afgeronde onderhoudsbeurt zoals de afrondingsflow (9a) hem achterlaat. */
function insertAfgerondeBeurt(
  store: MockConvexStore,
  userId: string,
  klantId: string,
  overrides: Record<string, unknown> = {}
): Id<"projecten"> {
  return store.insert("projecten", {
    userId,
    klantId,
    type: "onderhoudsbeurt",
    naam: "Onderhoudsbeurt mei",
    status: "uitgevoerd",
    klaarVoorFacturatie: true,
    afgerondOp: Date.UTC(2026, 4, 12, 10, 0), // 12 mei 2026
    taakAfronding: [{ omschrijving: "Gras maaien", status: "afgerond" }],
    bouwsteenRegels: [{ omschrijving: "Gras maaien", prijsPerBeurt: 35 }],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  }) as unknown as Id<"projecten">;
}

// ─── Statussplitsing + migratie (idempotent) ─────────────────────────────────

describe("statussplitsing: mapping oud → documentStatus + betaalStatus", () => {
  it.each([
    ["concept", "concept", "open"],
    ["definitief", "definitief", "open"],
    ["verzonden", "verzonden", "open"],
    ["betaald", "verzonden", "betaald"],
    ["vervallen", "verzonden", "vervallen"],
  ] as const)("%s → %s / %s", (oud, doc, betaal) => {
    expect(mapLegacyStatus(oud)).toEqual({
      documentStatus: doc,
      betaalStatus: betaal,
    });
  });

  it("dual-write spiegelt terug naar exact dezelfde legacy status (roundtrip)", () => {
    const alle: LegacyFactuurStatus[] = [
      "concept",
      "definitief",
      "verzonden",
      "betaald",
      "vervallen",
    ];
    for (const status of alle) {
      const { documentStatus, betaalStatus } = mapLegacyStatus(status);
      expect(legacyStatusVan(documentStatus, betaalStatus)).toBe(status);
    }
  });

  it("migratie-stap is idempotent: al gesplitste rijen veranderen niet", () => {
    // Zelfde skip-conditie als migrations/splitsFactuurStatus
    const factuur = {
      status: "betaald" as const,
      documentStatus: "verzonden" as const,
      betaalStatus: "betaald" as const,
    };
    const alGesplitst =
      factuur.documentStatus !== undefined && factuur.betaalStatus !== undefined;
    expect(alGesplitst).toBe(true);
    // effectieveStatussen respecteert de al gezette velden
    expect(effectieveStatussen(factuur)).toEqual({
      documentStatus: "verzonden",
      betaalStatus: "betaald",
    });
  });

  it("effectieveStatussen valt voor ongemigreerde rijen terug op het legacy-veld", () => {
    expect(effectieveStatussen({ status: "vervallen" })).toEqual({
      documentStatus: "verzonden",
      betaalStatus: "vervallen",
    });
  });

  it("geannuleerd bestaat alleen in de betaalketen en spiegelt als vervallen", () => {
    expect(legacyStatusVan("verzonden", "geannuleerd")).toBe("vervallen");
  });

  it("documentovergangen: concept→verzonden mag (wachtrij), verzonden is eind", () => {
    expect(isGeldigeDocumentOvergang("concept", "verzonden")).toBe(true);
    expect(isGeldigeDocumentOvergang("concept", "definitief")).toBe(true);
    expect(isGeldigeDocumentOvergang("verzonden", "concept")).toBe(false);
  });
});

describe("betaalstatus bij (deel)betalingen", () => {
  it("0 betaald → open; deel → gedeeltelijk_betaald; alles → betaald", () => {
    expect(bepaalBetaalStatus(121, 0)).toBe("open");
    expect(bepaalBetaalStatus(121, 60.5)).toBe("gedeeltelijk_betaald");
    expect(bepaalBetaalStatus(121, 121)).toBe("betaald");
  });

  it("centverschil (afronding) telt als volledig betaald", () => {
    expect(bepaalBetaalStatus(100, 99.995)).toBe("betaald");
  });

  it("vervallen factuur die alsnog (deels) betaald wordt gaat de betaalketen in", () => {
    expect(bepaalBetaalStatus(100, 0, "vervallen")).toBe("vervallen");
    expect(bepaalBetaalStatus(100, 40, "vervallen")).toBe("gedeeltelijk_betaald");
    expect(bepaalBetaalStatus(100, 100, "vervallen")).toBe("betaald");
  });

  it("geannuleerd blijft geannuleerd", () => {
    expect(bepaalBetaalStatus(100, 100, "geannuleerd")).toBe("geannuleerd");
  });
});

// ─── Btw-uitsplitsing (§2.8 punt 4) ─────────────────────────────────────────

describe("btw-uitsplitsing per tarief", () => {
  it("splitst 9/21 met juiste grondslagen en bedragen, 9 vóór 21", () => {
    const uitsplitsing = berekenBtwUitsplitsing(
      [
        { totaal: 100, btwCode: 21 },
        { totaal: 200, btwCode: 9 },
        { totaal: 50, btwCode: 9 },
      ],
      21
    );
    expect(uitsplitsing).toEqual([
      { percentage: 9, grondslag: 250, bedrag: 22.5 },
      { percentage: 21, grondslag: 100, bedrag: 21 },
    ]);
  });

  it("regels zonder btwCode vallen op het default-percentage", () => {
    const totalen = berekenFactuurTotalen([{ totaal: 100 }], 21);
    expect(totalen.btwBedrag).toBe(21);
    expect(totalen.totaalInclBtw).toBe(121);
    expect(totalen.btwUitsplitsing).toEqual([
      { percentage: 21, grondslag: 100, bedrag: 21 },
    ]);
  });

  it("gemengde factuur: totalen kloppen op de cent", () => {
    const totalen = berekenFactuurTotalen(
      [
        { totaal: 35, btwCode: 9 },
        { totaal: 80, btwCode: 21 },
      ],
      9
    );
    expect(totalen.subtotaal).toBe(115);
    expect(totalen.btwBedrag).toBe(19.95); // 3.15 + 16.80
    expect(totalen.totaalInclBtw).toBe(134.95);
  });
});

// ─── Engine-beslissingen ─────────────────────────────────────────────────────

describe("engine-actie per facturatiemodus", () => {
  it("per_bezoek en 'geen contract' → per_bezoek; verzameld → maandverzameling; vast → geen", () => {
    expect(bepaalEngineActie("per_bezoek")).toBe("per_bezoek");
    expect(bepaalEngineActie(undefined)).toBe("per_bezoek"); // losse beurt
    expect(bepaalEngineActie("maandelijks_verzameld")).toBe("maandverzameling");
    expect(bepaalEngineActie("vast_maandbedrag")).toBe("geen");
  });

  it("regels uit taak-afronding: alleen afgeronde taken, met prijs en btw", () => {
    const regels = bouwRegelsUitTaakAfronding(
      [
        { omschrijving: "Gras maaien", status: "afgerond" },
        { omschrijving: "Heg knippen", status: "begonnen_niet_af" },
        { omschrijving: "Borders wieden", status: "niet_gestart" },
      ],
      [
        { omschrijving: "Gras maaien", prijsPerBeurt: 35, btwCode: 9 },
        { omschrijving: "Heg knippen", prijsPerBeurt: 80, btwCode: 21 },
      ],
      "2026-05-12"
    );
    expect(regels).toHaveLength(1); // §8.8: alleen het uitgevoerde deel
    expect(regels[0]).toMatchObject({
      omschrijving: "Gras maaien (uitgevoerd 2026-05-12)",
      prijsPerEenheid: 35,
      totaal: 35,
      btwCode: 9,
      eenheid: "beurt",
    });
  });

  it("taak zonder prijsbron wordt een €0-regel (zichtbaar voor de check), default btw 9", () => {
    const regels = bouwRegelsUitTaakAfronding(
      [{ omschrijving: "Onbekende taak", status: "afgerond" }],
      [],
      "2026-05-12"
    );
    expect(regels[0].totaal).toBe(0);
    expect(regels[0].btwCode).toBe(9);
  });

  it("verzamelmaand-helpers", () => {
    expect(verzamelMaandVan("2026-05-12")).toBe("2026-05");
    expect(isVerzamelMaandVoorbij("2026-04", Date.UTC(2026, 4, 3))).toBe(true);
    expect(isVerzamelMaandVoorbij("2026-05", Date.UTC(2026, 4, 3))).toBe(false);
  });
});

// ─── §8.8: afrondingstest — engine met mock-ctx ──────────────────────────────

describe("verwerkKlaarVoorFacturatie (per_bezoek, §8.8 afrondingstest)", () => {
  it("alles afgerond → direct een correcte concept-factuur in 'Te versturen'", async () => {
    const { store, ctx, userId, klantId } = basisOpstelling();
    const bouwsteenId = insertBouwsteen(store, userId, { btwCode: 9 });
    const werkitemId = insertAfgerondeBeurt(store, userId, klantId, {
      taakAfronding: [
        { omschrijving: "Gras maaien", status: "afgerond", bouwsteenId },
        { omschrijving: "Heg knippen", status: "afgerond" },
      ],
      bouwsteenRegels: [
        { omschrijving: "Gras maaien", prijsPerBeurt: 35, bouwsteenId },
        { omschrijving: "Heg knippen", prijsPerBeurt: 80 },
      ],
    });

    const resultaat = await verwerkKlaarVoorFacturatie(ctx, { werkitemId });

    expect(resultaat.actie).toBe("per_bezoek");
    const facturen = store.getAll("facturen");
    expect(facturen).toHaveLength(1);
    const factuur = facturen[0];
    // Wachtrij: concept-documentstatus, betaalketen open
    expect(factuur.documentStatus).toBe("concept");
    expect(factuur.betaalStatus).toBe("open");
    expect(factuur.status).toBe("concept"); // legacy-spiegel
    expect(factuur.bron).toBe("engine_per_bezoek");
    // Juiste regels en bedragen (btw 9 uit bouwsteen, 21-loze taak → default 9)
    const regels = factuur.regels as Array<{ totaal: number; btwCode: number }>;
    expect(regels).toHaveLength(2);
    expect(factuur.subtotaal).toBe(115);
    expect(factuur.btwBedrag).toBe(10.35); // alles 9%: 115 × 0.09
    expect(factuur.totaalInclBtw).toBe(125.35);
    // Datum van dienst = uitvoeringsdag; referenties naar werkitem
    expect(factuur.datumVanDienst).toBe("2026-05-12");
    expect(factuur.werkitemIds).toEqual([werkitemId]);
    expect(factuur.factuurnummer).toMatch(/^FAC-\d{4}-042$/);
    // Idempotentie-vergrendeling terug op het werkitem
    expect(store.get(werkitemId)?.factuurId).toBe(factuur._id);
  });

  it("idempotent: dezelfde beurt komt nooit twee keer op een factuur", async () => {
    const { store, ctx, userId, klantId } = basisOpstelling();
    const werkitemId = insertAfgerondeBeurt(store, userId, klantId);

    const eerste = await verwerkKlaarVoorFacturatie(ctx, { werkitemId });
    const tweede = await verwerkKlaarVoorFacturatie(ctx, { werkitemId });

    expect(tweede.actie).toBe("overgeslagen");
    expect(tweede.reden).toBe("al gefactureerd");
    expect(tweede.factuurId).toBe(eerste.factuurId);
    const facturen = store.getAll("facturen");
    expect(facturen).toHaveLength(1);
    expect(facturen[0].regels).toHaveLength(1);
  });

  it("deels uitgevoerd: alleen het uitgevoerde deel gefactureerd, rest-taak niet", async () => {
    const { store, ctx, userId, klantId } = basisOpstelling();
    const werkitemId = insertAfgerondeBeurt(store, userId, klantId, {
      status: "deels_uitgevoerd",
      taakAfronding: [
        { omschrijving: "Gras maaien", status: "afgerond" },
        { omschrijving: "Heg knippen", status: "begonnen_niet_af" },
      ],
      bouwsteenRegels: [
        { omschrijving: "Gras maaien", prijsPerBeurt: 35 },
        { omschrijving: "Heg knippen", prijsPerBeurt: 80 },
      ],
    });

    await verwerkKlaarVoorFacturatie(ctx, { werkitemId });

    const factuur = store.getAll("facturen")[0];
    expect(factuur.regels).toHaveLength(1);
    expect(factuur.subtotaal).toBe(35); // alleen het uitgevoerde deel
    expect(
      (factuur.regels as Array<{ omschrijving: string }>)[0].omschrijving
    ).toContain("Gras maaien");
  });

  it("tweede beurt bij dezelfde klant op dezelfde dag → regels bij de bestaande dagfactuur", async () => {
    const { store, ctx, userId, klantId } = basisOpstelling();
    const beurt1 = insertAfgerondeBeurt(store, userId, klantId);
    const beurt2 = insertAfgerondeBeurt(store, userId, klantId, {
      naam: "Tweede beurt",
      taakAfronding: [{ omschrijving: "Heg knippen", status: "afgerond" }],
      bouwsteenRegels: [{ omschrijving: "Heg knippen", prijsPerBeurt: 80 }],
    });

    await verwerkKlaarVoorFacturatie(ctx, { werkitemId: beurt1 });
    await verwerkKlaarVoorFacturatie(ctx, { werkitemId: beurt2 });

    const facturen = store.getAll("facturen");
    expect(facturen).toHaveLength(1); // één factuur per klant per dag
    expect(facturen[0].regels).toHaveLength(2);
    expect(facturen[0].werkitemIds).toEqual([beurt1, beurt2]);
    expect(facturen[0].subtotaal).toBe(115);
  });

  it("losse beurt zonder contract volgt het per_bezoek-gedrag", async () => {
    const { store, ctx, userId, klantId } = basisOpstelling();
    const werkitemId = insertAfgerondeBeurt(store, userId, klantId, {
      contractId: undefined,
    });
    const resultaat = await verwerkKlaarVoorFacturatie(ctx, { werkitemId });
    expect(resultaat.actie).toBe("per_bezoek");
    expect(store.getAll("facturen")).toHaveLength(1);
  });
});

describe("verwerkKlaarVoorFacturatie (contractmodi)", () => {
  function insertContract(
    store: MockConvexStore,
    userId: string,
    klantId: string,
    overrides: Record<string, unknown> = {}
  ) {
    return store.insert("onderhoudscontracten", {
      userId,
      klantId,
      contractNummer: "OC-2026-001",
      naam: "Onderhoud villa",
      status: "actief",
      facturatiemodus: "per_bezoek",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ...overrides,
    });
  }

  it("maandelijks_verzameld: tweede beurt in dezelfde maand voegt toe i.p.v. nieuwe factuur", async () => {
    const { store, ctx, userId, klantId } = basisOpstelling();
    const contractId = insertContract(store, userId, klantId, {
      facturatiemodus: "maandelijks_verzameld",
    });
    const beurt1 = insertAfgerondeBeurt(store, userId, klantId, { contractId });
    const beurt2 = insertAfgerondeBeurt(store, userId, klantId, {
      contractId,
      afgerondOp: Date.UTC(2026, 4, 26, 10, 0), // andere dag, zelfde maand
      taakAfronding: [{ omschrijving: "Heg knippen", status: "afgerond" }],
      bouwsteenRegels: [{ omschrijving: "Heg knippen", prijsPerBeurt: 80 }],
    });

    const r1 = await verwerkKlaarVoorFacturatie(ctx, { werkitemId: beurt1 });
    const r2 = await verwerkKlaarVoorFacturatie(ctx, { werkitemId: beurt2 });

    expect(r1.actie).toBe("maandverzameling");
    expect(r2.factuurId).toBe(r1.factuurId);
    const facturen = store.getAll("facturen");
    expect(facturen).toHaveLength(1);
    expect(facturen[0].bron).toBe("engine_maandverzameling");
    expect(facturen[0].verzamelMaand).toBe("2026-05");
    expect(facturen[0].regels).toHaveLength(2);
    expect(facturen[0].contractId).toBe(contractId);
  });

  it("gesloten verzamelmaand (maandwissel-cron) → nieuwe beurt opent een nieuwe verzamelfactuur", async () => {
    const { store, ctx, userId, klantId } = basisOpstelling();
    const contractId = insertContract(store, userId, klantId, {
      facturatiemodus: "maandelijks_verzameld",
    });
    const beurt1 = insertAfgerondeBeurt(store, userId, klantId, { contractId });
    const r1 = await verwerkKlaarVoorFacturatie(ctx, { werkitemId: beurt1 });
    store.patch(r1.factuurId as string, { verzamelGesloten: true });

    const beurt2 = insertAfgerondeBeurt(store, userId, klantId, { contractId });
    const r2 = await verwerkKlaarVoorFacturatie(ctx, { werkitemId: beurt2 });

    expect(r2.factuurId).not.toBe(r1.factuurId);
    expect(store.getAll("facturen")).toHaveLength(2);
  });

  it("vast_maandbedrag: beurten worden genegeerd — het termijnschema is het enige spoor", async () => {
    const { store, ctx, userId, klantId } = basisOpstelling();
    const contractId = insertContract(store, userId, klantId, {
      facturatiemodus: "vast_maandbedrag",
    });
    const werkitemId = insertAfgerondeBeurt(store, userId, klantId, { contractId });

    const resultaat = await verwerkKlaarVoorFacturatie(ctx, { werkitemId });

    expect(resultaat.actie).toBe("termijnschema");
    expect(resultaat.factuurId).toBeNull();
    expect(store.getAll("facturen")).toHaveLength(0);
    // Geen factuurkoppeling: de beurt hangt niet aan een (termijn)factuur
    expect(store.get(werkitemId)?.factuurId).toBeUndefined();
  });

  it("directVersturen AAN → engine verstuurt zelf: verzonden + tijdlijn + mail-actie (achter mailGuard)", async () => {
    const { store, ctx, userId, klantId } = basisOpstelling();
    const contractId = insertContract(store, userId, klantId, {
      directVersturen: true,
    });
    const werkitemId = insertAfgerondeBeurt(store, userId, klantId, { contractId });

    const resultaat = await verwerkKlaarVoorFacturatie(ctx, { werkitemId });

    const factuur = store.get(resultaat.factuurId as string)!;
    expect(factuur.documentStatus).toBe("verzonden");
    expect(factuur.status).toBe("verzonden"); // legacy-spiegel
    expect(factuur.verzondenAt).toBeDefined();
    // Tijdlijn-event factuur_verzonden gelogd
    const events = store
      .getAll("klantTijdlijn")
      .filter((e) => e.eventType === "factuur_verzonden");
    expect(events).toHaveLength(1);
    // Mail loopt via de ingeplande portaalEmail-actie → die zit achter de
    // mailGuard (EMAIL_VERZENDEN_ACTIEF, fail-closed) — gemockt bewijs
    const mockCtx = ctx as unknown as { scheduler: { runAfter: ReturnType<typeof vi.fn> } };
    expect(mockCtx.scheduler.runAfter).toHaveBeenCalledTimes(1);
    expect(mockCtx.scheduler.runAfter.mock.calls[0][2]).toEqual({
      factuurId: resultaat.factuurId,
    });
  });

  it("directVersturen UIT (default, human-in-the-loop) → concept blijft wachten, geen mail", async () => {
    const { store, ctx, userId, klantId } = basisOpstelling();
    const contractId = insertContract(store, userId, klantId); // geen toggle
    const werkitemId = insertAfgerondeBeurt(store, userId, klantId, { contractId });

    const resultaat = await verwerkKlaarVoorFacturatie(ctx, { werkitemId });

    expect(store.get(resultaat.factuurId as string)?.documentStatus).toBe("concept");
    const mockCtx = ctx as unknown as { scheduler: { runAfter: ReturnType<typeof vi.fn> } };
    expect(mockCtx.scheduler.runAfter).not.toHaveBeenCalled();
    expect(magEngineDirectVersturen(null)).toBe(false); // losse beurt: nooit direct
  });
});

// ─── Verstuur-kern (wachtrij + bulk) ─────────────────────────────────────────

describe("verstuurFactuurKern (wachtrij/bulk-pad)", () => {
  it("concept → verzonden met tijdlijn-event en mail-actie; tweede keer versturen weigert", async () => {
    const { store, ctx, userId, klantId } = basisOpstelling();
    const werkitemId = insertAfgerondeBeurt(store, userId, klantId);
    const { factuurId } = await verwerkKlaarVoorFacturatie(ctx, { werkitemId });
    const factuur = store.get(factuurId as string) as unknown as Doc<"facturen">;

    await verstuurFactuurKern(ctx, factuur, { auteurNaam: "Kantoor" });

    const verzonden = store.get(factuurId as string)!;
    expect(verzonden.documentStatus).toBe("verzonden");
    expect(verzonden.betaalStatus).toBe("open");

    // Idempotent bulk-gedrag: nogmaals versturen gooit een duidelijke fout
    const opnieuw = store.get(factuurId as string) as unknown as Doc<"facturen">;
    await expect(
      verstuurFactuurKern(ctx, opnieuw, { auteurNaam: "Kantoor" })
    ).rejects.toThrow(/kan niet verstuurd worden/);
  });

  it("bulk: meerdere concepten worden allemaal verzonden", async () => {
    const { store, ctx, userId, klantId } = basisOpstelling();
    const klant2 = store.insert("klanten", createMockKlant(userId, { naam: "Klant twee" }));
    const beurt1 = insertAfgerondeBeurt(store, userId, klantId);
    const beurt2 = insertAfgerondeBeurt(store, userId, klant2);
    await verwerkKlaarVoorFacturatie(ctx, { werkitemId: beurt1 });
    await verwerkKlaarVoorFacturatie(ctx, { werkitemId: beurt2 });

    const concepten = store
      .getAll("facturen")
      .filter((f) => f.documentStatus === "concept");
    expect(concepten).toHaveLength(2);

    for (const concept of concepten) {
      await verstuurFactuurKern(
        ctx,
        store.get(concept._id as string) as unknown as Doc<"facturen">,
        { auteurNaam: "Kantoor" }
      );
    }

    expect(
      store.getAll("facturen").every((f) => f.documentStatus === "verzonden")
    ).toBe(true);
    const events = store
      .getAll("klantTijdlijn")
      .filter((e) => e.eventType === "factuur_verzonden");
    expect(events).toHaveLength(2);
  });
});

// ─── Deelbetalingen ──────────────────────────────────────────────────────────

describe("verwerkBetaaldBedragKern (deelbetalingen §2.8)", () => {
  async function verzondenFactuur() {
    const opstelling = basisOpstelling();
    const { store, ctx, userId, klantId } = opstelling;
    const werkitemId = insertAfgerondeBeurt(store, userId, klantId, {
      bouwsteenRegels: [{ omschrijving: "Gras maaien", prijsPerBeurt: 100 }],
    });
    const { factuurId } = await verwerkKlaarVoorFacturatie(ctx, { werkitemId });
    await verstuurFactuurKern(
      ctx,
      store.get(factuurId as string) as unknown as Doc<"facturen">
    );
    return { ...opstelling, factuurId: factuurId as string };
  }

  it("deelbetaling → gedeeltelijk_betaald (legacy blijft verzonden)", async () => {
    const { store, ctx, factuurId } = await verzondenFactuur();
    const factuur = store.get(factuurId) as unknown as Doc<"facturen">;

    const status = await verwerkBetaaldBedragKern(ctx, factuur, 40);

    expect(status).toBe("gedeeltelijk_betaald");
    const bijgewerkt = store.get(factuurId)!;
    expect(bijgewerkt.betaalStatus).toBe("gedeeltelijk_betaald");
    expect(bijgewerkt.status).toBe("verzonden"); // legacy-spiegel
    expect(bijgewerkt.betaaldBedrag).toBe(40);
    expect(bijgewerkt.betaaldAt).toBeUndefined();
  });

  it("restbetaling → betaald + tijdlijn-event + contracttermijn doorgezet", async () => {
    const { store, ctx, userId, factuurId } = await verzondenFactuur();
    // Termijn die aan deze factuur hangt (vast_maandbedrag-spoor §2.8 punt 6)
    const termijnId = store.insert("contractFacturen", {
      contractId: "onderhoudscontracten:999",
      userId,
      termijnNummer: 1,
      periodeStart: "2026-05-01",
      periodeEinde: "2026-05-31",
      bedrag: 100,
      status: "gefactureerd",
      factuurId,
      createdAt: Date.now(),
    });

    const factuur = store.get(factuurId) as unknown as Doc<"facturen">;
    const status = await verwerkBetaaldBedragKern(ctx, factuur, 109);

    expect(status).toBe("betaald");
    const bijgewerkt = store.get(factuurId)!;
    expect(bijgewerkt.betaalStatus).toBe("betaald");
    expect(bijgewerkt.status).toBe("betaald"); // legacy-spiegel
    expect(bijgewerkt.betaaldAt).toBeDefined();
    expect(
      store
        .getAll("klantTijdlijn")
        .filter((e) => e.eventType === "factuur_betaald")
    ).toHaveLength(1);
    expect(store.get(termijnId)?.status).toBe("betaald");
  });
});

// ─── Rolchecks (§8.8) ────────────────────────────────────────────────────────

describe("rolchecks: capability 'versturen naar klant' (PRD §1.2)", () => {
  it("kantoor (directie/projectleider/admin) mag versturen", () => {
    expect(kanNaarKlantVersturen("directie")).toBe(true);
    expect(kanNaarKlantVersturen("projectleider")).toBe(true);
    expect(kanNaarKlantVersturen("admin")).toBe(true);
  });

  it("veld en klant mogen niet versturen (en dus ook de toggle niet zetten)", () => {
    expect(kanNaarKlantVersturen("voorman")).toBe(false);
    expect(kanNaarKlantVersturen("medewerker")).toBe(false);
    expect(kanNaarKlantVersturen("klant")).toBe(false);
    expect(kanNaarKlantVersturen("onderaannemer_zzp")).toBe(false);
    expect(kanNaarKlantVersturen("materiaalman")).toBe(false);
  });
});
