/**
 * Debiteurenladder (PRD §3.2, fase 2).
 *
 * Acceptatietests:
 * 1. Trede-timing: dag 14 → herinnering, dag 21 → tweede herinnering,
 *    dag 28 → interne kantoortaak — ankerdatum is de VERZENDDATUM;
 * 2. Idempotentie: cron 2× draaien = geen dubbele concepten/taken;
 * 3. Pauzeren (met verplichte reden) stopt de cron voor die factuur;
 *    hervatten start hem weer; alles gelogd op de klanttijdlijn;
 * 4. Deelbetaling verandert de ladder niet; volledige betaling (of
 *    annulering) stopt hem; concepten/creditnota's doen nooit mee;
 * 5. Trede 3 maakt de kantoortaak (taaksoort "debiteurentaak") op het
 *    cases-bord, met instelbare eigenaar (default bedrijfseigenaar);
 * 6. Tijdlijn-logging per stap (trede/pauze/hervat/overslaan);
 * 7. Rolchecks: instellingen + pauzeren/overslaan zijn kantoor-only;
 * 8. Mail alleen via de concept-wachtrij (§2.7): modus "concept" plant
 *    NOOIT een verzend-actie in; modus "automatisch" plant de actie in
 *    die achter de mail-guard zit (gemockt bewijs — geen echte mail);
 * 9. Dedupe met het oude handmatige pad: een bestaande handmatige
 *    herinnering telt als afgedekte trede (één bron van waarheid).
 *
 * MAILVEILIGHEID: er wordt NOOIT gemaild — mock-ctx zonder Resend; de
 * cron zet uitsluitend concept-mails klaar en maakt database-records.
 */

import { describe, it, expect, vi } from "vitest";
import { ConvexError } from "convex/values";
import {
  MockConvexStore,
  createMockCtx,
  createMockUser,
  createMockKlant,
  seedMockOrganisatie,
  TEST_CLERK_ORG_ID,
} from "../../helpers/convex-mock";
import { AuthError } from "../../../../convex/auth";
import {
  verwerkLadder,
  pauzeerLadder,
  hervatLadder,
  slaTredeOver,
  updateLadderInstellingen,
  getLadderInstellingen,
  getOpenstaand,
} from "../../../../convex/debiteuren";
import {
  DAG_MS,
  DEBITEUREN_LADDER_DEFAULTS,
  effectieveTreden,
  valideerTreden,
  ladderVanToepassing,
  tredeNiveauVanRecord,
  hoogsteAfgedekteTrede,
  bepaalVolgendeTrede,
  eerstvolgendeTrede,
  dagenVerschuldigd,
  ouderdomsBucket,
  openstaandBedrag,
  debiteurSleutel,
} from "../../../../convex/debiteurenLogica";

// ─── Helpers ─────────────────────────────────────────────────────────────────

type AnyHandler = (ctx: unknown, args: unknown) => Promise<unknown>;

/** Convex registreert de handler op de functie zelf (func._handler). */
function handler(fn: unknown): AnyHandler {
  return (fn as { _handler: AnyHandler })._handler;
}

const UUR_MS = 60 * 60 * 1000;

interface IndexConstraint {
  op: "eq" | "lte" | "gte" | "lt" | "gt";
  field: string;
  value: unknown;
}

/**
 * Index-bewuste variant van de mock-ctx: `withIndex(q => q.eq(...))` filtert
 * echt op de opgegeven velden. De gedeelde helper negeert indexen volledig,
 * waardoor een query die nog op `by_user` staat tóch het juiste antwoord
 * geeft — precies het gat waar tenant-isolatie doorheen glipt.
 */
function createIndexAwareCtx(store: MockConvexStore) {
  const ctx = createMockCtx(store);
  ctx.db.query = vi.fn((tableName: string) => {
    let docs = store.getAll(tableName);
    const builder = {
      withIndex: (_naam: string, fn?: (q: unknown) => unknown) => {
        const constraints: IndexConstraint[] = [];
        const q = {
          eq: (field: string, value: unknown) => {
            constraints.push({ op: "eq", field, value });
            return q;
          },
          lte: (field: string, value: unknown) => {
            constraints.push({ op: "lte", field, value });
            return q;
          },
          gte: (field: string, value: unknown) => {
            constraints.push({ op: "gte", field, value });
            return q;
          },
          lt: (field: string, value: unknown) => {
            constraints.push({ op: "lt", field, value });
            return q;
          },
          gt: (field: string, value: unknown) => {
            constraints.push({ op: "gt", field, value });
            return q;
          },
        };
        if (fn) fn(q);
        docs = docs.filter((doc) =>
          constraints.every((c) => {
            const waarde = doc[c.field] as never;
            switch (c.op) {
              case "eq":
                return waarde === c.value;
              case "lte":
                return waarde <= (c.value as never);
              case "gte":
                return waarde >= (c.value as never);
              case "lt":
                return waarde < (c.value as never);
              case "gt":
                return waarde > (c.value as never);
            }
          })
        );
        return builder;
      },
      filter: () => builder,
      order: () => builder,
      collect: async () => [...docs],
      first: async () => docs[0] ?? null,
      unique: async () => docs[0] ?? null,
      take: async (n: number) => docs.slice(0, n),
    };
    return builder;
  });
  return ctx;
}

/** Ctx + store met precies één ingelogde gebruiker met de gegeven rol. */
function ctxMetRol(role: string) {
  const store = new MockConvexStore();
  const orgId = seedMockOrganisatie(store);
  const userId = store.insert("users", createMockUser({ role }));
  // De cron-paden leiden de eigenaar van een systeemtaak af uit de organisatie.
  store.patch(orgId, { eigenaarUserId: userId });
  const ctx = createMockCtx(store);
  return { ctx, store, userId, orgId };
}

/** Standaard-setup: directie-gebruiker + klant. */
function kantoorMetKlant() {
  const { ctx, store, userId, orgId } = ctxMetRol("directie");
  const klantId = store.insert("klanten", createMockKlant(userId, { orgId }));
  return { ctx, store, userId, orgId, klantId };
}

/** Verzonden factuur, verzonden N dagen geleden (ankerdatum-test §3.2). */
function insertFactuur(
  store: MockConvexStore,
  userId: string,
  klantId: string,
  dagenGeledenVerzonden: number,
  overrides: Record<string, unknown> = {}
) {
  const now = Date.now();
  const verzondenAt = now - dagenGeledenVerzonden * DAG_MS - UUR_MS;
  return store.insert("facturen", {
    // De ladder-cron leidt de tenant af uit de factuur (geen identity).
    orgId: (store.getAll("organisaties")[0]?._id ?? undefined) as
      | string
      | undefined,
    userId,
    klantId,
    factuurnummer: `F-2026-${Math.floor(Math.random() * 10000)}`,
    status: "verzonden",
    documentStatus: "verzonden",
    betaalStatus: "open",
    klant: {
      naam: "Jan de Vries",
      adres: "Tulpstraat 12",
      postcode: "1234 AB",
      plaats: "Amsterdam",
      email: "jan@devries.nl",
    },
    bedrijf: {
      naam: "Top Tuinen",
      adres: "Straat 1",
      postcode: "1111 AA",
      plaats: "Utrecht",
    },
    regels: [],
    subtotaal: 1000,
    btwPercentage: 21,
    btwBedrag: 210,
    totaalInclBtw: 1210,
    factuurdatum: verzondenAt,
    // Betalingstermijn 14 dagen na factuurdatum
    vervaldatum: verzondenAt + 14 * DAG_MS,
    betalingstermijnDagen: 14,
    verzondenAt,
    createdAt: verzondenAt,
    updatedAt: verzondenAt,
    ...overrides,
  });
}

/** Mail-trigger voor een ladder-event (modus concept tenzij anders). */
function insertTrigger(
  store: MockConvexStore,
  event: string,
  overrides: Record<string, unknown> = {}
) {
  const now = Date.now();
  return store.insert("mailTriggers", {
    orgId: (store.getAll("organisaties")[0]?._id ?? undefined) as
      | string
      | undefined,
    event,
    naam: "Betalingsherinnering",
    omschrijving: "Test",
    onderwerp: "Herinnering: factuur {{factuurnummer}}",
    inhoud:
      "Beste {{klantnaam}}, factuur {{factuurnummer}} ({{openstaandBedrag}}) staat nog open.",
    variabelen: ["klantnaam", "factuurnummer", "openstaandBedrag"],
    vertragingDagen: 0,
    ontvanger: "klant",
    modus: "concept",
    actief: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });
}

const runLadder = () => handler(verwerkLadder);

// ─── 1. Pure treden-logica (timing dag 14/21/28) ─────────────────────────────

describe("debiteurenLogica — treden-timing", () => {
  const treden = DEBITEUREN_LADDER_DEFAULTS;

  it("doet niets vóór dag 14", () => {
    expect(bepaalVolgendeTrede(treden, 13, 0)).toBeNull();
  });

  it("trede 1 op dag 14 (vanaf verzenddatum)", () => {
    expect(bepaalVolgendeTrede(treden, 14, 0)?.trede).toBe(1);
  });

  it("trede 2 op dag 21 als trede 1 is afgedekt", () => {
    expect(bepaalVolgendeTrede(treden, 21, 1)?.trede).toBe(2);
  });

  it("geen trede 2 vóór dag 21", () => {
    expect(bepaalVolgendeTrede(treden, 20, 1)).toBeNull();
  });

  it("trede 3 (interne taak) op dag 28", () => {
    const trede = bepaalVolgendeTrede(treden, 28, 2);
    expect(trede?.trede).toBe(3);
    expect(trede?.escalatie).toBe("interne_taak");
  });

  it("oude factuur: alleen de HOOGSTE vervallen trede (geen mail-salvo)", () => {
    const trede = bepaalVolgendeTrede(treden, 45, 0);
    expect(trede?.trede).toBe(3);
  });

  it("alles afgedekt → null", () => {
    expect(bepaalVolgendeTrede(treden, 100, 3)).toBeNull();
  });

  it("handmatige records dekken treden af (dedupe met het oude pad)", () => {
    // Handmatige herinnering (zonder trede-veld) telt als niveau 1
    expect(tredeNiveauVanRecord({ type: "herinnering" })).toBe(1);
    expect(tredeNiveauVanRecord({ type: "eerste_aanmaning" })).toBe(2);
    expect(tredeNiveauVanRecord({ type: "ingebrekestelling" })).toBe(4);
    // Ladder-records dragen hun eigen trede
    expect(tredeNiveauVanRecord({ type: "herinnering", trede: 2 })).toBe(2);
    const hoogste = hoogsteAfgedekteTrede(
      [{ type: "herinnering" }, { type: "tweede_herinnering", trede: 2 }],
      [3]
    );
    expect(hoogste).toBe(3);
  });

  it("valideerTreden: max 4, uniek, oplopend", () => {
    expect(() => valideerTreden([])).toThrow(ConvexError);
    expect(() =>
      valideerTreden([
        { trede: 1, dagenNaVerzending: 14, escalatie: "mail" },
        { trede: 2, dagenNaVerzending: 21, escalatie: "mail" },
        { trede: 3, dagenNaVerzending: 28, escalatie: "mail" },
        { trede: 4, dagenNaVerzending: 35, escalatie: "mail" },
        { trede: 5, dagenNaVerzending: 42, escalatie: "mail" },
      ])
    ).toThrow(ConvexError);
    expect(() =>
      valideerTreden([
        { trede: 1, dagenNaVerzending: 21, escalatie: "mail" },
        { trede: 2, dagenNaVerzending: 14, escalatie: "mail" },
      ])
    ).toThrow(ConvexError);
    expect(() =>
      valideerTreden([
        { trede: 1, dagenNaVerzending: 14, escalatie: "mail" },
        { trede: 1, dagenNaVerzending: 21, escalatie: "mail" },
      ])
    ).toThrow(ConvexError);
    expect(() => valideerTreden(DEBITEUREN_LADDER_DEFAULTS)).not.toThrow();
  });

  it("effectieveTreden: inactieve treden vallen weg, defaults als vangnet", () => {
    expect(effectieveTreden(undefined)).toHaveLength(3);
    const eigen = effectieveTreden({
      treden: [
        { trede: 1, dagenNaVerzending: 7, escalatie: "mail", actief: true },
        { trede: 2, dagenNaVerzending: 14, escalatie: "mail", actief: false },
      ],
    });
    expect(eigen).toHaveLength(1);
    expect(eigen[0].dagenNaVerzending).toBe(7);
  });

  it("ladderVanToepassing: alleen verzonden + open/deels betaald", () => {
    const basis = { documentStatus: "verzonden", betaalStatus: "open" } as const;
    expect(ladderVanToepassing(basis)).toBe(true);
    expect(
      ladderVanToepassing({ ...basis, betaalStatus: "gedeeltelijk_betaald" })
    ).toBe(true);
    expect(ladderVanToepassing({ ...basis, betaalStatus: "betaald" })).toBe(
      false
    );
    expect(
      ladderVanToepassing({ ...basis, betaalStatus: "geannuleerd" })
    ).toBe(false);
    expect(ladderVanToepassing({ ...basis, betaalStatus: "vervallen" })).toBe(
      false
    );
    expect(
      ladderVanToepassing({ documentStatus: "concept", betaalStatus: "open" })
    ).toBe(false);
    expect(ladderVanToepassing({ ...basis, isCreditnota: true })).toBe(false);
  });

  it("ouderdomsbuckets 0-14/14-30/30-60/60+", () => {
    expect(ouderdomsBucket(0)).toBe("0_14");
    expect(ouderdomsBucket(13)).toBe("0_14");
    expect(ouderdomsBucket(14)).toBe("14_30");
    expect(ouderdomsBucket(29)).toBe("14_30");
    expect(ouderdomsBucket(30)).toBe("30_60");
    expect(ouderdomsBucket(60)).toBe("60_plus");
  });

  it("dagenVerschuldigd en openstaandBedrag", () => {
    const nu = Date.now();
    expect(dagenVerschuldigd(nu + DAG_MS, nu)).toBe(0);
    expect(dagenVerschuldigd(nu - 5 * DAG_MS, nu)).toBe(5);
    expect(openstaandBedrag({ totaalInclBtw: 1210 })).toBe(1210);
    expect(
      openstaandBedrag({ totaalInclBtw: 1210, betaaldBedrag: 500 })
    ).toBe(710);
    expect(
      openstaandBedrag({ totaalInclBtw: 1210, betaaldBedrag: 2000 })
    ).toBe(0);
  });
});

// ─── 2. Cron: mail-treden via de concept-wachtrij ────────────────────────────

describe("verwerkLadder — mail-treden (§2.7 concept-wachtrij)", () => {
  it("dag 15: trede 1 als CONCEPT in de wachtrij, gelogd op de tijdlijn", async () => {
    const { ctx, store, userId, klantId } = kantoorMetKlant();
    insertTrigger(store, "betalingsherinnering_1");
    insertFactuur(store, userId, klantId, 15);

    const res = (await runLadder()(ctx, {})) as { mailsKlaargezet: number };
    expect(res.mailsKlaargezet).toBe(1);

    // Concept-mail in de wachtrij: kantoor keurt goed, er is NIETS verstuurd
    const mails = store.getAll("conceptMails");
    expect(mails).toHaveLength(1);
    expect(mails[0].status).toBe("wachtrij");
    expect(mails[0].modus).toBe("concept");
    expect(mails[0].ontvangerEmail).toBe("jan@devries.nl");
    // Geen verzend-actie ingepland in concept-modus (mail-guard-bewijs)
    expect(ctx.scheduler.runAfter).not.toHaveBeenCalled();

    // Ladder-record (aanmaanniveau + idempotentie)
    const records = store.getAll("betalingsherinneringen");
    expect(records).toHaveLength(1);
    expect(records[0].trede).toBe(1);
    expect(records[0].bron).toBe("ladder");
    expect(records[0].type).toBe("herinnering");
    expect(records[0].emailVerstuurd).toBe(false);

    // Tijdlijn-log per trede
    const tijdlijn = store.getAll("klantTijdlijn");
    expect(
      tijdlijn.filter(
        (t) => t.eventType === "betalingsherinnering_klaargezet"
      )
    ).toHaveLength(1);
  });

  it("dag 10: nog geen trede", async () => {
    const { ctx, store, userId, klantId } = kantoorMetKlant();
    insertTrigger(store, "betalingsherinnering_1");
    insertFactuur(store, userId, klantId, 10);

    await runLadder()(ctx, {});
    expect(store.getAll("conceptMails")).toHaveLength(0);
    expect(store.getAll("betalingsherinneringen")).toHaveLength(0);
  });

  it("idempotent: cron 2× = geen dubbele concepten of records", async () => {
    const { ctx, store, userId, klantId } = kantoorMetKlant();
    insertTrigger(store, "betalingsherinnering_1");
    insertFactuur(store, userId, klantId, 15);

    await runLadder()(ctx, {});
    await runLadder()(ctx, {});

    expect(store.getAll("conceptMails")).toHaveLength(1);
    expect(store.getAll("betalingsherinneringen")).toHaveLength(1);
  });

  it("dag 22 met trede 1 afgedekt → trede 2 (tweede herinnering)", async () => {
    const { ctx, store, userId, klantId } = kantoorMetKlant();
    insertTrigger(store, "betalingsherinnering_2");
    const factuurId = insertFactuur(store, userId, klantId, 22);
    store.insert("betalingsherinneringen", {
      factuurId,
      userId,
      type: "herinnering",
      volgnummer: 1,
      dagenVervallen: 1,
      verstuurdAt: Date.now() - 7 * DAG_MS,
      emailVerstuurd: false,
      trede: 1,
      bron: "ladder",
    });

    await runLadder()(ctx, {});
    const records = store.getAll("betalingsherinneringen");
    expect(records).toHaveLength(2);
    const trede2 = records.find((r) => r.trede === 2);
    expect(trede2?.type).toBe("tweede_herinnering");
  });

  it("dedupe met het handmatige pad: bestaande handmatige herinnering = trede 1 afgedekt", async () => {
    const { ctx, store, userId, klantId } = kantoorMetKlant();
    insertTrigger(store, "betalingsherinnering_1");
    const factuurId = insertFactuur(store, userId, klantId, 15);
    // Kantoor verstuurde eerder al handmatig een herinnering (oude pad)
    store.insert("betalingsherinneringen", {
      factuurId,
      userId,
      type: "herinnering",
      volgnummer: 1,
      dagenVervallen: 1,
      verstuurdAt: Date.now() - DAG_MS,
      emailVerstuurd: true,
    });

    await runLadder()(ctx, {});
    // Geen tweede herinnering op dag 15 — trede 1 is al afgedekt
    expect(store.getAll("conceptMails")).toHaveLength(0);
    expect(store.getAll("betalingsherinneringen")).toHaveLength(1);
  });

  it("betaalde, geannuleerde en concept-facturen doen nooit mee", async () => {
    const { ctx, store, userId, klantId } = kantoorMetKlant();
    insertTrigger(store, "betalingsherinnering_1");
    insertFactuur(store, userId, klantId, 20, {
      betaalStatus: "betaald",
      status: "betaald",
    });
    insertFactuur(store, userId, klantId, 20, {
      betaalStatus: "geannuleerd",
      status: "vervallen",
    });
    insertFactuur(store, userId, klantId, 20, {
      documentStatus: "concept",
      status: "concept",
      betaalStatus: "open",
    });
    insertFactuur(store, userId, klantId, 20, { isCreditnota: true });

    await runLadder()(ctx, {});
    expect(store.getAll("conceptMails")).toHaveLength(0);
    expect(store.getAll("betalingsherinneringen")).toHaveLength(0);
  });

  it("ladder-records en concept-mail dragen de orgId van de factuur", async () => {
    const { ctx, store, userId, orgId, klantId } = kantoorMetKlant();
    insertTrigger(store, "betalingsherinnering_1");
    insertFactuur(store, userId, klantId, 15);

    await runLadder()(ctx, {});

    // Zonder orgId op het record valt de herinnering buiten de org-gescoopte
    // leeskant (listByFactuur/getAanmaningStatus) en telt de ladder hem niet
    // meer als afgedekte trede.
    const records = store.getAll("betalingsherinneringen");
    expect(records).toHaveLength(1);
    expect(records[0].orgId).toBe(orgId);
    expect(store.getAll("conceptMails")[0].orgId).toBe(orgId);
  });

  it("deelbetaling verandert de ladder niet; volledige betaling stopt hem", async () => {
    const { ctx, store, userId, klantId } = kantoorMetKlant();
    insertTrigger(store, "betalingsherinnering_1");
    const factuurId = insertFactuur(store, userId, klantId, 15, {
      betaalStatus: "gedeeltelijk_betaald",
      betaaldBedrag: 500,
    });

    await runLadder()(ctx, {});
    expect(store.getAll("betalingsherinneringen")).toHaveLength(1);

    // Volledige betaling → geen volgende trede meer
    store.patch(factuurId, { betaalStatus: "betaald", betaaldBedrag: 1210 });
    // (factuur ver genoeg in de tijd voor trede 2)
    store.patch(factuurId, {
      verzondenAt: Date.now() - 25 * DAG_MS,
    });
    await runLadder()(ctx, {});
    expect(store.getAll("betalingsherinneringen")).toHaveLength(1);
  });

  it("trigger op 'automatisch': verzend-actie wordt ingepland (achter de mail-guard, gemockt)", async () => {
    const { ctx, store, userId, klantId } = kantoorMetKlant();
    insertTrigger(store, "betalingsherinnering_1", { modus: "automatisch" });
    insertFactuur(store, userId, klantId, 15);

    await runLadder()(ctx, {});
    const mails = store.getAll("conceptMails");
    expect(mails).toHaveLength(1);
    expect(mails[0].modus).toBe("automatisch");
    // De cron verstuurt zelf NOOIT: er wordt alleen een actie ingepland,
    // en die actie zit achter EMAIL_VERZENDEN_ACTIEF (fail-closed).
    expect(ctx.scheduler.runAfter).toHaveBeenCalledTimes(1);
  });

  it("ladder uit (instelling) → cron doet niets", async () => {
    const { ctx, store, userId, orgId, klantId } = kantoorMetKlant();
    insertTrigger(store, "betalingsherinnering_1");
    insertFactuur(store, userId, klantId, 15);
    // orgId is verplicht: getLadderInstellingen leest via by_org, dus zonder
    // orgId ziet de cron de "uit"-stand niet eens.
    store.insert("instellingen", {
      orgId,
      userId,
      debiteurenLadder: { actief: false },
    });

    await runLadder()(ctx, {});
    expect(store.getAll("conceptMails")).toHaveLength(0);
  });
});

// ─── 3. Cron: taak-trede (dag 28) op het cases-bord ──────────────────────────

describe("verwerkLadder — trede 3 kantoortaak (cases-bord)", () => {
  it("dag 29 met trede 1+2 afgedekt → debiteurentaak, idempotent", async () => {
    const { ctx, store, userId, orgId, klantId } = kantoorMetKlant();
    const factuurId = insertFactuur(store, userId, klantId, 29);
    for (const trede of [1, 2]) {
      store.insert("betalingsherinneringen", {
        factuurId,
        orgId,
        userId,
        type: trede === 1 ? "herinnering" : "tweede_herinnering",
        volgnummer: 1,
        dagenVervallen: 1,
        verstuurdAt: Date.now(),
        emailVerstuurd: false,
        trede,
        bron: "ladder",
      });
    }

    const res = (await runLadder()(ctx, {})) as { takenAangemaakt: number };
    expect(res.takenAangemaakt).toBe(1);

    const taken = store.getAll("servicemeldingen");
    expect(taken).toHaveLength(1);
    expect(taken[0].taaksoort).toBe("debiteurentaak");
    expect(taken[0].status).toBe("nieuw");
    // Default eigenaar: de directie van de organisatie (instelbaar)
    expect(taken[0].eigenaarId).toBe(userId);
    expect(taken[0].attenderingSleutel).toBe(
      debiteurSleutel(factuurId, 3)
    );
    // De cron draait zonder identity: de taak moet de tenant van de factuur
    // meekrijgen, anders valt hij buiten het org-gescoopte cases-bord en ziet
    // kantoor hem nooit staan.
    expect(taken[0].orgId).toBe(orgId);

    // Record + tijdlijn + systeem-comment in de case-thread
    const records = store.getAll("betalingsherinneringen");
    const taakRecords = records.filter((r) => r.type === "interne_taak");
    expect(taakRecords).toHaveLength(1);
    expect(taakRecords[0].orgId).toBe(orgId);
    expect(
      store
        .getAll("klantTijdlijn")
        .filter((t) => t.eventType === "debiteurentaak_aangemaakt")
    ).toHaveLength(1);
    expect(store.getAll("meldingComments")).toHaveLength(1);

    // Idempotent: tweede run maakt geen tweede taak
    await runLadder()(ctx, {});
    expect(store.getAll("servicemeldingen")).toHaveLength(1);
  });

  it("oude factuur zonder historie: alleen de taak-trede, geen mail-salvo", async () => {
    const { ctx, store, userId, klantId } = kantoorMetKlant();
    insertTrigger(store, "betalingsherinnering_1");
    insertFactuur(store, userId, klantId, 45);

    await runLadder()(ctx, {});
    expect(store.getAll("conceptMails")).toHaveLength(0);
    expect(store.getAll("servicemeldingen")).toHaveLength(1);
    const records = store.getAll("betalingsherinneringen");
    expect(records).toHaveLength(1);
    expect(records[0].trede).toBe(3);
  });

  it("taak-eigenaar is een instelling (geen hardcoded naam)", async () => {
    const { ctx, store, userId, orgId, klantId } = kantoorMetKlant();
    const elkeId = store.insert("users", {
      clerkId: "clerk_elke",
      email: "elke@toptuinen.nl",
      name: "Elke",
      role: "projectleider",
      createdAt: Date.now(),
    });
    store.insert("instellingen", {
      orgId,
      userId,
      debiteurenLadder: { actief: true, taakEigenaarId: elkeId },
    });
    insertFactuur(store, userId, klantId, 30);

    await runLadder()(ctx, {});
    const taken = store.getAll("servicemeldingen");
    expect(taken).toHaveLength(1);
    expect(taken[0].eigenaarId).toBe(elkeId);
  });
});

// ─── 4. Pauzeren / hervatten / trede overslaan ───────────────────────────────

describe("pauzeren, hervatten en trede overslaan", () => {
  it("pauzeren (met verplichte reden) stopt de cron; hervatten start hem", async () => {
    const { ctx, store, userId, klantId } = kantoorMetKlant();
    insertTrigger(store, "betalingsherinnering_1");
    const factuurId = insertFactuur(store, userId, klantId, 15);

    await handler(pauzeerLadder)(ctx, {
      factuurId,
      reden: "Betalingsafspraak: klant betaalt in twee termijnen",
    });
    const factuur = store.get(factuurId);
    expect(factuur?.ladderGepauzeerd).toBe(true);
    expect(factuur?.ladderPauzeReden).toContain("Betalingsafspraak");

    // Cron slaat gepauzeerde facturen over
    await runLadder()(ctx, {});
    expect(store.getAll("conceptMails")).toHaveLength(0);

    // Hervatten → de trede wordt weer opgepakt
    await handler(hervatLadder)(ctx, { factuurId });
    expect(store.get(factuurId)?.ladderGepauzeerd).toBe(false);
    await runLadder()(ctx, {});
    expect(store.getAll("conceptMails")).toHaveLength(1);

    // Beide acties gelogd op de klanttijdlijn
    const events = store.getAll("klantTijdlijn").map((t) => t.eventType);
    expect(events).toContain("debiteurenladder_gepauzeerd");
    expect(events).toContain("debiteurenladder_hervat");
  });

  it("pauzeren zonder reden → ConvexError", async () => {
    const { ctx, store, userId, klantId } = kantoorMetKlant();
    const factuurId = insertFactuur(store, userId, klantId, 15);
    await expect(
      handler(pauzeerLadder)(ctx, { factuurId, reden: "   " })
    ).rejects.toThrow(ConvexError);
  });

  it("trede overslaan markeert de eerstvolgende trede als afgedekt", async () => {
    const { ctx, store, userId, klantId } = kantoorMetKlant();
    insertTrigger(store, "betalingsherinnering_2");
    const factuurId = insertFactuur(store, userId, klantId, 22);

    const res = (await handler(slaTredeOver)(ctx, { factuurId })) as {
      overgeslagenTrede: number;
    };
    expect(res.overgeslagenTrede).toBe(1);
    expect(store.get(factuurId)?.ladderOvergeslagenTreden).toEqual([1]);
    expect(
      store
        .getAll("klantTijdlijn")
        .filter(
          (t) => t.eventType === "debiteurenladder_trede_overgeslagen"
        )
    ).toHaveLength(1);

    // Cron pakt daarna trede 2 (dag 22 ≥ 21), niet trede 1
    await runLadder()(ctx, {});
    const records = store.getAll("betalingsherinneringen");
    expect(records).toHaveLength(1);
    expect(records[0].trede).toBe(2);
  });
});

// ─── 5. Rolchecks (§1.2/§3.2: kantoor-only beheer) ───────────────────────────

describe("rolchecks", () => {
  it("pauzeren/hervatten/overslaan: voorman → AuthError", async () => {
    const { ctx, store, userId } = ctxMetRol("voorman");
    const klantId = store.insert("klanten", createMockKlant(userId));
    const factuurId = insertFactuur(store, userId, klantId, 15);

    await expect(
      handler(pauzeerLadder)(ctx, { factuurId, reden: "test" })
    ).rejects.toThrow(AuthError);
    await expect(
      handler(hervatLadder)(ctx, { factuurId })
    ).rejects.toThrow(AuthError);
    await expect(
      handler(slaTredeOver)(ctx, { factuurId })
    ).rejects.toThrow(AuthError);
  });

  it("ladder-instellingen bijwerken: medewerker → AuthError, kantoor → ok", async () => {
    const medewerker = ctxMetRol("medewerker");
    await expect(
      handler(updateLadderInstellingen)(medewerker.ctx, { actief: false })
    ).rejects.toThrow(AuthError);

    const kantoor = ctxMetRol("directie");
    kantoor.store.insert("instellingen", {
      orgId: kantoor.orgId,
      userId: kantoor.userId,
    });
    await handler(updateLadderInstellingen)(kantoor.ctx, {
      actief: false,
      treden: [
        { trede: 1, dagenNaVerzending: 10, escalatie: "mail" },
        { trede: 2, dagenNaVerzending: 20, escalatie: "interne_taak" },
      ],
    });
    const settings = kantoor.store.getAll("instellingen")[0];
    const ladder = settings.debiteurenLadder as {
      actief: boolean;
      treden: Array<{ trede: number }>;
    };
    expect(ladder.actief).toBe(false);
    expect(ladder.treden).toHaveLength(2);
  });

  it("bijwerken raakt de instellingen-rij van de eigen organisatie", async () => {
    const store = new MockConvexStore();
    const ctx = createIndexAwareCtx(store);
    const orgA = seedMockOrganisatie(store);
    const orgB = seedMockOrganisatie(store, {
      clerkOrgId: `${TEST_CLERK_ORG_ID}_b`,
      naam: "Buurman Hoveniers",
    });
    const userA = store.insert("users", createMockUser({ role: "directie" }));
    // De rij van de buurman staat vooraan: een niet-org-gescoopte lookup
    // patcht diens ladder in plaats van die van A.
    const rijB = store.insert("instellingen", {
      orgId: orgB,
      userId: "users:999",
      debiteurenLadder: { actief: true },
    });
    const rijA = store.insert("instellingen", { orgId: orgA, userId: userA });

    await handler(updateLadderInstellingen)(ctx, { actief: false });

    const na = (id: string) =>
      store.getAll("instellingen").find((r) => r._id === id)!;
    expect(
      (na(rijA).debiteurenLadder as { actief: boolean }).actief
    ).toBe(false);
    // De buurman is ongemoeid gebleven
    expect(
      (na(rijB).debiteurenLadder as { actief: boolean }).actief
    ).toBe(true);
  });

  it("ongeldige treden-configuratie → ConvexError", async () => {
    const { ctx, store, userId, orgId } = ctxMetRol("directie");
    store.insert("instellingen", { orgId, userId });
    await expect(
      handler(updateLadderInstellingen)(ctx, {
        treden: [
          { trede: 1, dagenNaVerzending: 21, escalatie: "mail" },
          { trede: 2, dagenNaVerzending: 14, escalatie: "mail" },
        ],
      })
    ).rejects.toThrow(ConvexError);
  });

  it("getLadderInstellingen levert defaults zonder opgeslagen record", async () => {
    const { ctx } = ctxMetRol("directie");
    const config = (await handler(getLadderInstellingen)(ctx, {})) as {
      actief: boolean;
      treden: Array<{ trede: number; dagenNaVerzending: number }>;
    };
    expect(config.actief).toBe(true);
    expect(config.treden.map((t) => t.dagenNaVerzending)).toEqual([
      14, 21, 28,
    ]);
  });

  it("getLadderInstellingen pakt de instellingen van de eigen organisatie", async () => {
    const store = new MockConvexStore();
    const ctx = createIndexAwareCtx(store);
    const orgA = seedMockOrganisatie(store);
    const orgB = seedMockOrganisatie(store, {
      clerkOrgId: `${TEST_CLERK_ORG_ID}_b`,
      naam: "Buurman Hoveniers",
    });
    const userA = store.insert("users", createMockUser({ role: "directie" }));
    // De buurman staat als EERSTE in de tabel: een lezing die niet op org
    // filtert pakt zijn ritme (7/14/21) in plaats van dat van A.
    store.insert("instellingen", {
      orgId: orgB,
      userId: "users:999",
      debiteurenLadder: {
        actief: false,
        treden: [
          { trede: 1, dagenNaVerzending: 7, escalatie: "mail", actief: true },
        ],
      },
    });
    store.insert("instellingen", {
      orgId: orgA,
      userId: userA,
      debiteurenLadder: {
        actief: true,
        treden: [
          { trede: 1, dagenNaVerzending: 30, escalatie: "mail", actief: true },
        ],
      },
    });

    const config = (await handler(getLadderInstellingen)(ctx, {})) as {
      actief: boolean;
      treden: Array<{ dagenNaVerzending: number }>;
    };
    expect(config.actief).toBe(true);
    expect(config.treden.map((t) => t.dagenNaVerzending)).toEqual([30]);
  });
});

// ─── 6. Openstaande-postenoverzicht ──────────────────────────────────────────

describe("getOpenstaand — de lijst ís het debiteurenoverzicht", () => {
  it("toont openstaande facturen met verschuldigd-sinds, bucket en niveau", async () => {
    const { ctx, store, userId, orgId, klantId } = kantoorMetKlant();
    // 49 dagen na verzending → 35 dagen over de vervaldatum (bucket 30-60)
    const oudId = insertFactuur(store, userId, klantId, 49, {
      betaaldBedrag: 210,
      betaalStatus: "gedeeltelijk_betaald",
    });
    store.insert("betalingsherinneringen", {
      factuurId: oudId,
      orgId,
      userId,
      type: "herinnering",
      volgnummer: 1,
      dagenVervallen: 15,
      verstuurdAt: Date.now(),
      emailVerstuurd: false,
      trede: 1,
      bron: "ladder",
    });
    // Betaalde factuur hoort NIET in het overzicht
    insertFactuur(store, userId, klantId, 40, {
      betaalStatus: "betaald",
      status: "betaald",
    });
    // Gepauzeerde openstaande factuur (10 dagen verzonden, nog niet vervallen)
    insertFactuur(store, userId, klantId, 10, {
      ladderGepauzeerd: true,
      ladderPauzeReden: "Betalingsafspraak",
    });

    const data = (await handler(getOpenstaand)(ctx, {})) as {
      posten: Array<Record<string, unknown>>;
      totalen: {
        totaalOpenstaand: number;
        aantal: number;
        buckets: Record<string, { aantal: number; bedrag: number }>;
      };
    };

    expect(data.posten).toHaveLength(2);
    // Oudste bovenaan
    const oud = data.posten[0];
    expect(oud.factuurId).toBe(oudId);
    expect(oud.dagenVerschuldigd).toBe(35);
    expect(oud.bucket).toBe("30_60");
    expect(oud.openstaandBedrag).toBe(1000);
    expect(oud.aanmaanniveau).toBe(1);
    expect(
      (oud.volgendeTrede as { trede: number } | null)?.trede
    ).toBe(2);

    const gepauzeerd = data.posten[1];
    expect(gepauzeerd.gepauzeerd).toBe(true);
    expect(gepauzeerd.pauzeReden).toBe("Betalingsafspraak");
    expect(gepauzeerd.dagenVerschuldigd).toBe(0);
    expect(gepauzeerd.bucket).toBe("0_14");

    expect(data.totalen.aantal).toBe(2);
    expect(data.totalen.totaalOpenstaand).toBe(1000 + 1210);
    expect(data.totalen.buckets["30_60"].aantal).toBe(1);
    expect(data.totalen.buckets["30_60"].bedrag).toBe(1000);
    expect(data.totalen.buckets["0_14"].aantal).toBe(1);
  });

  it("cron pakt per factuur de ladder-instellingen van de juiste organisatie", async () => {
    // Eén run bedient álle organisaties (de by_status-index is bedrijfsbreed).
    // De config moet dus per factuur uit díe tenant komen: A heeft de ladder
    // uitgezet, B niet. Een lookup die de verkeerde org pakt, zet ofwel bij A
    // ten onrechte een mail klaar, ofwel bij B ten onrechte niet.
    const store = new MockConvexStore();
    const ctx = createIndexAwareCtx(store);
    const orgA = seedMockOrganisatie(store);
    const orgB = seedMockOrganisatie(store, {
      clerkOrgId: `${TEST_CLERK_ORG_ID}_b`,
      naam: "Buurman Hoveniers",
    });
    const userA = store.insert("users", createMockUser({ role: "directie" }));
    // Collega binnen organisatie A: HIJ maakt de factuur aan, terwijl de
    // instellingen-rij op de organisatie (en op userA) staat. Een lookup op
    // factuur.userId vindt dan niets en valt terug op de defaults — dus op
    // "ladder actief" — en mailt de klant van een bedrijf dat de ladder juist
    // had uitgezet.
    const userA2 = store.insert(
      "users",
      createMockUser({ role: "projectleider", clerkId: "clerk_collega" })
    );
    const userB = store.insert(
      "users",
      createMockUser({ role: "directie", clerkId: "clerk_buurman" })
    );
    const klantA = store.insert("klanten", createMockKlant(userA, { orgId: orgA }));
    const klantB = store.insert("klanten", createMockKlant(userB, { orgId: orgB }));

    store.insert("instellingen", {
      orgId: orgA,
      userId: userA,
      debiteurenLadder: { actief: false },
    });
    store.insert("instellingen", {
      orgId: orgB,
      userId: userB,
      debiteurenLadder: { actief: true },
    });
    insertTrigger(store, "betalingsherinnering_1", { orgId: orgA });
    insertTrigger(store, "betalingsherinnering_1", { orgId: orgB });
    insertFactuur(store, userA2, klantA, 15, { orgId: orgA });
    const factuurB = insertFactuur(store, userB, klantB, 15, { orgId: orgB });

    await runLadder()(ctx, {});

    const records = store.getAll("betalingsherinneringen");
    expect(records).toHaveLength(1);
    expect(records[0].factuurId).toBe(factuurB);
    expect(records[0].orgId).toBe(orgB);
  });

  it("org-isolatie: organisatie A ziet de facturen van B niet", async () => {
    // Index-BEWUSTE ctx: de gedeelde createMockCtx negeert withIndex, en dan
    // slaagt deze test ook als de query nog op by_user staat — het defensieve
    // filter in de lus zou het werk doen. Hier filtert withIndex echt, zodat
    // zowel de index als het filter org-gescoopt moeten zijn.
    const store = new MockConvexStore();
    const ctx = createIndexAwareCtx(store);

    // Organisatie A is de ingelogde tenant (haar clerkOrgId matcht het
    // org_id-claim dat createMockCtx meegeeft); B is de vreemde buur.
    const orgA = seedMockOrganisatie(store);
    const orgB = seedMockOrganisatie(store, {
      clerkOrgId: `${TEST_CLERK_ORG_ID}_b`,
      naam: "Buurman Hoveniers",
    });
    const userA = store.insert("users", createMockUser({ role: "directie" }));
    // Collega binnen dezelfde organisatie: zijn ladder-record moet WEL
    // meetellen voor de ingelogde gebruiker — dat is precies wat by_user
    // (op de ingelogde user) miste en by_org wel vindt.
    const userA2 = store.insert(
      "users",
      createMockUser({ role: "projectleider", clerkId: "clerk_collega" })
    );
    const userB = store.insert(
      "users",
      createMockUser({ role: "directie", clerkId: "clerk_buurman" })
    );
    const klantA = store.insert("klanten", createMockKlant(userA, { orgId: orgA }));
    const klantB = store.insert("klanten", createMockKlant(userB, { orgId: orgB }));

    const factuurA = insertFactuur(store, userA, klantA, 20, { orgId: orgA });
    const factuurB = insertFactuur(store, userB, klantB, 40, { orgId: orgB });
    // Trede 1 op A's factuur, weggeschreven door de COLLEGA. Op de oude
    // by_user-index (de ingelogde gebruiker) viel dit record buiten beeld en
    // stond het aanmaanniveau ten onrechte op 0.
    store.insert("betalingsherinneringen", {
      factuurId: factuurA,
      orgId: orgA,
      userId: userA2,
      type: "herinnering",
      volgnummer: 1,
      dagenVervallen: 6,
      verstuurdAt: Date.now(),
      emailVerstuurd: false,
      trede: 1,
      bron: "ladder",
    });
    // Ladder-record van de buurman: mag nooit in het overzicht van A opduiken.
    store.insert("betalingsherinneringen", {
      factuurId: factuurB,
      orgId: orgB,
      userId: userB,
      type: "herinnering",
      volgnummer: 1,
      dagenVervallen: 20,
      verstuurdAt: Date.now(),
      emailVerstuurd: false,
      trede: 1,
      bron: "ladder",
    });

    const data = (await handler(getOpenstaand)(ctx, {})) as {
      posten: Array<Record<string, unknown>>;
      totalen: { aantal: number; totaalOpenstaand: number };
    };

    expect(data.posten).toHaveLength(1);
    expect(data.posten[0].factuurId).toBe(factuurA);
    expect(data.posten.map((p) => p.factuurId)).not.toContain(factuurB);
    expect(data.totalen.aantal).toBe(1);
    expect(data.totalen.totaalOpenstaand).toBe(1210);
    // Het record van de collega telt WEL mee (org-scope, niet user-scope)
    expect(data.posten[0].aanmaanniveau).toBe(1);
  });

  it("org-isolatie houdt ook stand als de index niets afvangt", async () => {
    // Spiegelbeeld van de test hierboven: de gedeelde createMockCtx negeert
    // withIndex, dus hier komt élke factuur uit de store terug en moet het
    // defensieve filter in de lus de tenant-grens alleen trekken.
    const store = new MockConvexStore();
    const ctx = createMockCtx(store);
    const orgA = seedMockOrganisatie(store);
    const userA = store.insert("users", createMockUser({ role: "directie" }));
    const klantA = store.insert("klanten", createMockKlant(userA, { orgId: orgA }));
    const factuurA = insertFactuur(store, userA, klantA, 20, { orgId: orgA });
    // Factuur van een andere organisatie, plus eentje uit de tijd vóór de
    // migratie (nog helemaal zonder orgId) — geen van beide hoort in de lijst.
    insertFactuur(store, userA, klantA, 40, { orgId: "organisaties:999" });
    insertFactuur(store, userA, klantA, 40, { orgId: undefined });
    // Ladder-record van vóór de migratie op A's eigen factuur: telt bewust
    // NIET mee zolang het geen orgId heeft (geen fallback bouwen — het komt
    // terug zodra de dev-migratie het veld vult).
    store.insert("betalingsherinneringen", {
      factuurId: factuurA,
      userId: userA,
      type: "herinnering",
      volgnummer: 1,
      dagenVervallen: 6,
      verstuurdAt: Date.now(),
      emailVerstuurd: false,
      trede: 1,
      bron: "ladder",
    });

    const data = (await handler(getOpenstaand)(ctx, {})) as {
      posten: Array<Record<string, unknown>>;
      totalen: { aantal: number };
    };

    expect(data.posten).toHaveLength(1);
    expect(data.posten[0].factuurId).toBe(factuurA);
    expect(data.totalen.aantal).toBe(1);
    expect(data.posten[0].aanmaanniveau).toBe(0);
  });

  it("pauzeren van een factuur van een andere organisatie wordt geweigerd", async () => {
    // requireEigenFactuur deed ondanks zijn naam géén eigenaarscheck: met een
    // factuur-id van de buurman kon elke kantoorrol diens ladder stilzetten.
    const store = new MockConvexStore();
    const ctx = createIndexAwareCtx(store);
    seedMockOrganisatie(store);
    const orgB = seedMockOrganisatie(store, {
      clerkOrgId: `${TEST_CLERK_ORG_ID}_b`,
      naam: "Buurman Hoveniers",
    });
    store.insert("users", createMockUser({ role: "directie" }));
    const userB = store.insert(
      "users",
      createMockUser({ role: "directie", clerkId: "clerk_buurman" })
    );
    const klantB = store.insert("klanten", createMockKlant(userB, { orgId: orgB }));
    const factuurB = insertFactuur(store, userB, klantB, 20, { orgId: orgB });

    await expect(
      handler(pauzeerLadder)(ctx, {
        factuurId: factuurB,
        reden: "Betalingsafspraak",
      })
    ).rejects.toThrow(AuthError);
    await expect(
      handler(hervatLadder)(ctx, { factuurId: factuurB })
    ).rejects.toThrow(AuthError);
    await expect(
      handler(slaTredeOver)(ctx, { factuurId: factuurB })
    ).rejects.toThrow(AuthError);

    // En de factuur van de buurman is onaangeroerd gebleven
    const naderhand = store.getAll("facturen").find((f) => f._id === factuurB)!;
    expect(naderhand.ladderGepauzeerd).toBeUndefined();
  });

  it("eerstvolgendeTrede helper: null als alles afgedekt is", () => {
    expect(
      eerstvolgendeTrede(DEBITEUREN_LADDER_DEFAULTS, 3)
    ).toBeNull();
    expect(
      eerstvolgendeTrede(DEBITEUREN_LADDER_DEFAULTS, 1)?.trede
    ).toBe(2);
  });
});
