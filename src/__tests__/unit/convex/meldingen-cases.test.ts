/**
 * Meldingen/cases-bord + planningsattendering (PRD §2.4 en §2.1-restant).
 *
 * Acceptatietests §8.6 (case-test) en §8.12 (attenderingstest):
 * 1. Routing-defaults per type (klacht/serviceverzoek/schade);
 * 2. Toegang — de klant-rol krijgt op ELKE melding-/thread-functie een
 *    AuthError; muteren is kantoor-only (voorman → AuthError);
 * 3. Aanmaak + statuswissel loggen automatisch op de klanttijdlijn én in de
 *    interne case-thread;
 * 4. @tag → veldtaak, die op de dagkaart verschijnt bij de EERSTVOLGENDE
 *    team-planning bij die klant — niet eerder en niet bij een ander team;
 *    het antwoord van de medewerker landt intern (nooit bij de klant);
 * 5. Promotie melding → werkitem met koppeling in beide richtingen;
 * 6. Attendering-cron: taak op juiste dag (venster − dagenVooraf),
 *    idempotent, respecteert attendering-uit; escalatie-markering;
 * 7. Beurt vrijgeven naar de wachtrij (+ wachtrij-gedrag ritme-moeders);
 * 8. Teller-badge telt open meldingen.
 *
 * MAILVEILIGHEID: er wordt NOOIT gemaild — mock-ctx zonder Resend/Clerk;
 * de attendering-cron is puur database-werk.
 */

import { describe, it, expect } from "vitest";
import { ConvexError } from "convex/values";
import {
  MockConvexStore,
  createMockCtx,
  createMockUser,
  createMockKlant,
  seedMockOrganisatie,
} from "../../helpers/convex-mock";
import { AuthError } from "../../../../convex/auth";
import {
  bordKolomVoorStatus,
  isOpenMelding,
  routingDefaultsVoorType,
  isGeescaleerd,
  DEFAULT_ESCALATIE_DAGEN,
  list as meldingenList,
  getById,
  getBord,
  telOpenMeldingen,
  create as createMelding,
  updateStatus,
  promoveerNaarWerkitem,
} from "../../../../convex/servicemeldingen";
import {
  listComments,
  listVeldtakenVoorMelding,
  addComment,
  rondVeldtaakAf,
} from "../../../../convex/caseThread";
import {
  addDagen,
  dagenTussen,
  maakAttenderingSleutel,
  attenderingTekst,
  attenderingVandaagNodig,
  genereerAttenderingen,
  geefBeurtVrij,
} from "../../../../convex/planningsattendering";
import { getDagkaart } from "../../../../convex/dagkaart";
import { getWachtrij } from "../../../../convex/planbord";
import { vandaagIso } from "../../../../convex/beurtgenerator";

// ─── Helpers ─────────────────────────────────────────────────────────────────

type AnyHandler = (ctx: unknown, args: unknown) => Promise<unknown>;

/** Convex registreert de handler op de functie zelf (func._handler). */
function handler(fn: unknown): AnyHandler {
  return (fn as { _handler: AnyHandler })._handler;
}

/**
 * Ctx + store met precies één ingelogde gebruiker met de gegeven rol.
 *
 * De organisatie hoort erbij: sinds fase 3 van de org-migratie leest
 * `requireOrg` het `org_id`-claim dat `createMockCtx` meegeeft, en zonder rij
 * in `organisaties` strandt élke org-gescopeerde functie op een AuthError.
 */
function ctxMetRol(role: string, extra: Record<string, unknown> = {}) {
  const store = new MockConvexStore();
  const orgId = seedMockOrganisatie(store);
  const userId = store.insert("users", createMockUser({ role, ...extra }));
  const ctx = createMockCtx(store);
  return { ctx, store, userId, orgId };
}

/** Standaard-setup: directie-gebruiker + klant. */
function kantoorMetKlant() {
  const { ctx, store, userId, orgId } = ctxMetRol("directie");
  const klantId = store.insert("klanten", createMockKlant(userId, { orgId }));
  return { ctx, store, userId, orgId, klantId };
}

function insertMelding(
  store: MockConvexStore,
  userId: string,
  klantId: string,
  overrides: Record<string, unknown> = {}
) {
  const now = Date.now();
  return store.insert("servicemeldingen", {
    userId,
    klantId,
    beschrijving: "Testmelding",
    isGarantie: false,
    status: "nieuw",
    prioriteit: "normaal",
    kosten: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });
}

function insertBeurt(
  store: MockConvexStore,
  userId: string,
  klantId: string,
  overrides: Record<string, unknown> = {}
) {
  const now = Date.now();
  return store.insert("projecten", {
    userId,
    type: "onderhoudsbeurt",
    klantId,
    naam: "Snoeibeurt",
    status: "gepland",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });
}

// ─── 1. Pure helpers: kolommen, open-telling, routing, escalatie ─────────────

describe("bordKolomVoorStatus / isOpenMelding", () => {
  it("mapt de vier PRD-statussen op hun eigen kolom", () => {
    expect(bordKolomVoorStatus("nieuw")).toBe("nieuw");
    expect(bordKolomVoorStatus("in_behandeling")).toBe("in_behandeling");
    expect(bordKolomVoorStatus("wacht_op_derden")).toBe("wacht_op_derden");
    expect(bordKolomVoorStatus("opgelost")).toBe("opgelost");
  });

  it("mapt legacy-statussen naar in_behandeling / opgelost", () => {
    expect(bordKolomVoorStatus("ingepland")).toBe("in_behandeling");
    expect(bordKolomVoorStatus("afgehandeld")).toBe("opgelost");
  });

  it("telt alles buiten de opgelost-kolom als open", () => {
    expect(isOpenMelding("nieuw")).toBe(true);
    expect(isOpenMelding("wacht_op_derden")).toBe(true);
    expect(isOpenMelding("ingepland")).toBe(true);
    expect(isOpenMelding("opgelost")).toBe(false);
    expect(isOpenMelding("afgehandeld")).toBe(false);
  });
});

describe("routingDefaultsVoorType (PRD §2.4)", () => {
  it("klacht → eigenaar moet kantoor zijn", () => {
    expect(routingDefaultsVoorType("klacht")).toEqual({
      eigenaarMoetKantoorZijn: true,
      beoordelenVoorPlanning: false,
      verzekeringsvlag: false,
    });
  });

  it("serviceverzoek → beoordelen voor de planning-wachtrij", () => {
    expect(routingDefaultsVoorType("serviceverzoek")).toEqual({
      eigenaarMoetKantoorZijn: false,
      beoordelenVoorPlanning: true,
      verzekeringsvlag: false,
    });
  });

  it("schade → kantoor + verzekeringsvlag", () => {
    expect(routingDefaultsVoorType("schade")).toEqual({
      eigenaarMoetKantoorZijn: true,
      beoordelenVoorPlanning: false,
      verzekeringsvlag: true,
    });
  });
});

describe("isGeescaleerd (escalatie §2.1/§8.12)", () => {
  const dag = 24 * 60 * 60 * 1000;
  const now = Date.now();

  it("kleurt een open plantaak zonder actie na de default (7 dagen)", () => {
    expect(
      isGeescaleerd(
        { taaksoort: "plantaak", status: "nieuw", updatedAt: now - 8 * dag },
        now
      )
    ).toBe(true);
    expect(DEFAULT_ESCALATIE_DAGEN).toBe(7);
  });

  it("respecteert een ingestelde escalatietermijn per taak", () => {
    expect(
      isGeescaleerd(
        {
          taaksoort: "plantaak",
          status: "nieuw",
          updatedAt: now - 8 * dag,
          escalatieDagen: 30,
        },
        now
      )
    ).toBe(false);
  });

  it("escaleert geen gewone meldingen, opgeloste taken of verse taken", () => {
    expect(
      isGeescaleerd(
        { taaksoort: "melding", status: "nieuw", updatedAt: now - 30 * dag },
        now
      )
    ).toBe(false);
    expect(
      isGeescaleerd(
        { taaksoort: "plantaak", status: "opgelost", updatedAt: now - 30 * dag },
        now
      )
    ).toBe(false);
    expect(
      isGeescaleerd(
        { taaksoort: "plantaak", status: "nieuw", updatedAt: now - 2 * dag },
        now
      )
    ).toBe(false);
  });
});

// ─── 2. Toegang: klant-rol → AuthError op ALLES; muteren kantoor-only ────────

describe("toegang (PRD §1.2 — misklik-hard)", () => {
  it("weigert de klant-rol op elke melding-query met een AuthError", async () => {
    const { ctx, store, userId } = ctxMetRol("klant");
    const klantId = store.insert("klanten", createMockKlant(userId));
    const meldingId = insertMelding(store, userId, klantId);

    await expect(handler(meldingenList)(ctx, {})).rejects.toThrow(AuthError);
    await expect(handler(getById)(ctx, { id: meldingId })).rejects.toThrow(
      AuthError
    );
    await expect(handler(getBord)(ctx, {})).rejects.toThrow(AuthError);
    await expect(handler(telOpenMeldingen)(ctx, {})).rejects.toThrow(AuthError);
  });

  it("weigert de klant-rol op elke thread-functie met een AuthError", async () => {
    const { ctx, store, userId } = ctxMetRol("klant");
    const klantId = store.insert("klanten", createMockKlant(userId));
    const meldingId = insertMelding(store, userId, klantId);

    await expect(
      handler(listComments)(ctx, { meldingId })
    ).rejects.toThrow(AuthError);
    await expect(
      handler(listVeldtakenVoorMelding)(ctx, { meldingId })
    ).rejects.toThrow(AuthError);
    await expect(
      handler(addComment)(ctx, { meldingId, tekst: "hoi" })
    ).rejects.toThrow(AuthError);
    await expect(
      handler(rondVeldtaakAf)(ctx, { veldtaakId: "veldtaken:1" })
    ).rejects.toThrow(AuthError);
  });

  it("laat muteren alleen aan kantoor: voorman krijgt AuthError", async () => {
    const { ctx, store, userId } = ctxMetRol("voorman");
    const klantId = store.insert("klanten", createMockKlant(userId));
    const meldingId = insertMelding(store, userId, klantId);

    await expect(
      handler(createMelding)(ctx, {
        klantId,
        beschrijving: "x",
        prioriteit: "normaal",
      })
    ).rejects.toThrow(AuthError);
    await expect(
      handler(updateStatus)(ctx, { id: meldingId, status: "opgelost" })
    ).rejects.toThrow(AuthError);
    await expect(
      handler(promoveerNaarWerkitem)(ctx, { id: meldingId })
    ).rejects.toThrow(AuthError);
    await expect(
      handler(geefBeurtVrij)(ctx, { meldingId })
    ).rejects.toThrow(AuthError);
  });

  it("laat een voorman het bord wél lezen", async () => {
    const { ctx, store, userId } = ctxMetRol("voorman");
    const klantId = store.insert("klanten", createMockKlant(userId));
    insertMelding(store, userId, klantId);
    // Voorman zonder linkedMedewerker → companyUserId = eigen id (fallback)
    const bord = (await handler(getBord)(ctx, {})) as {
      nieuw: unknown[];
    };
    expect(bord.nieuw).toHaveLength(1);
  });
});

// ─── 3. Aanmaak: routing-defaults + automatische logging ─────────────────────

describe("create (routing-defaults + logging)", () => {
  it("serviceverzoek: vlag beoordelenVoorPlanning, eigenaar default aanmaker", async () => {
    const { ctx, store, userId, klantId } = kantoorMetKlant();
    const id = (await handler(createMelding)(ctx, {
      klantId,
      beschrijving: "Poort klemt",
      prioriteit: "normaal",
      type: "serviceverzoek",
      kanaal: "telefoon",
    })) as string;

    const melding = store.get(id)!;
    expect(melding.type).toBe("serviceverzoek");
    expect(melding.beoordelenVoorPlanning).toBe(true);
    expect(melding.verzekeringsvlag).toBeUndefined();
    expect(melding.eigenaarId).toBe(userId);
    expect(melding.aangemaaktDoorId).toBe(userId);
    expect(melding.status).toBe("nieuw");
    expect(melding.taaksoort).toBe("melding");
  });

  it("schade: verzekeringsvlag + kantoor-eigenaar afgedwongen", async () => {
    const { ctx, store, userId, klantId } = kantoorMetKlant();
    const veldUserId = store.insert(
      "users",
      createMockUser({ role: "medewerker", clerkId: "clerk_veld", name: "Michel" })
    );

    const id = (await handler(createMelding)(ctx, {
      klantId,
      beschrijving: "Ruit gesneuveld",
      prioriteit: "hoog",
      type: "schade",
    })) as string;
    expect(store.get(id)!.verzekeringsvlag).toBe(true);
    expect(store.get(id)!.eigenaarId).toBe(userId);

    // Niet-kantoor-eigenaar bij schade/klacht → ConvexError
    await expect(
      handler(createMelding)(ctx, {
        klantId,
        beschrijving: "Ruit",
        prioriteit: "hoog",
        type: "schade",
        eigenaarId: veldUserId,
      })
    ).rejects.toThrow(ConvexError);
    await expect(
      handler(createMelding)(ctx, {
        klantId,
        beschrijving: "Klacht over de voorjaarsbeurt",
        prioriteit: "normaal",
        type: "klacht",
        eigenaarId: veldUserId,
      })
    ).rejects.toThrow(ConvexError);
  });

  it("logt de aanmaak op de klanttijdlijn én in de case-thread", async () => {
    const { ctx, store, klantId } = kantoorMetKlant();
    const id = (await handler(createMelding)(ctx, {
      klantId,
      beschrijving: "Poort klemt",
      prioriteit: "normaal",
      type: "klacht",
    })) as string;

    const tijdlijn = store.getAll("klantTijdlijn");
    expect(tijdlijn).toHaveLength(1);
    expect(tijdlijn[0].eventType).toBe("melding_aangemaakt");
    expect(tijdlijn[0].kanaal).toBe("systeem");
    expect(tijdlijn[0].meldingId).toBe(id);
    expect(tijdlijn[0].klantId).toBe(klantId);

    const comments = store.getAll("meldingComments");
    expect(comments).toHaveLength(1);
    expect(comments[0].systeem).toBe(true);
    expect(comments[0].meldingId).toBe(id);
  });
});

// ─── 4. Statuswissel logt op tijdlijn + thread ───────────────────────────────

describe("updateStatus (logging §2.4)", () => {
  it("logt elke statuswissel op de klanttijdlijn en in de thread", async () => {
    const { ctx, store, userId, klantId } = kantoorMetKlant();
    const meldingId = insertMelding(store, userId, klantId);

    await handler(updateStatus)(ctx, {
      id: meldingId,
      status: "wacht_op_derden",
    });

    expect(store.get(meldingId)!.status).toBe("wacht_op_derden");
    const tijdlijn = store.getAll("klantTijdlijn");
    expect(tijdlijn).toHaveLength(1);
    expect(tijdlijn[0].eventType).toBe("melding_status_gewijzigd");
    expect(String(tijdlijn[0].tekst)).toContain("Wacht op derden");
    expect(store.getAll("meldingComments")).toHaveLength(1);
  });

  it("logt niets bij een ongewijzigde status (no-op)", async () => {
    const { ctx, store, userId, klantId } = kantoorMetKlant();
    const meldingId = insertMelding(store, userId, klantId);
    await handler(updateStatus)(ctx, { id: meldingId, status: "nieuw" });
    expect(store.getAll("klantTijdlijn")).toHaveLength(0);
  });
});

// ─── 5. Case-test §8.6: @tag → veldtaak → dagkaart ───────────────────────────

describe("@tag → veldtaak (case-test §8.6)", () => {
  function setupMetMichel() {
    const { ctx, store, userId, orgId, klantId } = kantoorMetKlant();
    const michelId = store.insert("medewerkers", {
      orgId,
      userId,
      naam: "Michel",
      isActief: true,
      createdAt: Date.now(),
    });
    const meldingId = insertMelding(store, userId, klantId, { orgId });
    return { ctx, store, userId, orgId, klantId, michelId, meldingId };
  }

  it("een @Michel-tag in een comment maakt een open veldtaak, gekoppeld aan melding + klant", async () => {
    const { ctx, store, klantId, michelId, meldingId } = setupMetMichel();

    const result = (await handler(addComment)(ctx, {
      meldingId,
      tekst: "@Michel wil jij de klimop bij de schutting weghalen?",
      taggedMedewerkerIds: [michelId],
    })) as { commentId: string; veldtaakIds: string[] };

    expect(result.veldtaakIds).toHaveLength(1);
    const taak = store.get(result.veldtaakIds[0])!;
    expect(taak.meldingId).toBe(meldingId);
    expect(taak.klantId).toBe(klantId);
    expect(taak.medewerkerId).toBe(michelId);
    expect(taak.medewerkerNaam).toBe("Michel");
    expect(taak.status).toBe("open");
    expect(taak.commentId).toBe(result.commentId);
  });

  it("zonder tag komt er alleen een comment, geen veldtaak", async () => {
    const { ctx, store, meldingId } = setupMetMichel();
    await handler(addComment)(ctx, { meldingId, tekst: "Interne notitie" });
    expect(store.getAll("veldtaken")).toHaveLength(0);
    expect(store.getAll("meldingComments")).toHaveLength(1);
  });

  it("de veldtaak verschijnt op de dagkaart zodra Michels team bij die klant gepland staat", async () => {
    const { ctx, store, userId, orgId, klantId, michelId, meldingId } =
      setupMetMichel();
    const janId = store.insert("medewerkers", {
      orgId,
      userId,
      naam: "Jan",
      isActief: true,
      createdAt: Date.now(),
    });
    const teamA = store.insert("teams", {
      orgId,
      userId,
      naam: "Team A",
      leden: [michelId],
      isActief: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    const teamB = store.insert("teams", {
      orgId,
      userId,
      naam: "Team B",
      leden: [janId],
      isActief: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    await handler(addComment)(ctx, {
      meldingId,
      tekst: "@Michel klimop weghalen graag",
      taggedMedewerkerIds: [michelId],
    });

    const datum = "2026-07-20";
    // Werkitem van die klant, gepland op team A op `datum`
    insertBeurt(store, userId, klantId, {
      orgId,
      teamId: teamA,
      geplandeStart: datum,
      geplandeEind: datum,
      volgordeBinnenDag: 1,
    });

    // Team A op de geplande dag: veldtaak als eigen regel in het klantblok
    const kaartA = (await handler(getDagkaart)(ctx, {
      teamId: teamA,
      datum,
    })) as { stops: { veldtaken: { medewerkerNaam: string; tekst: string }[] }[] };
    expect(kaartA.stops).toHaveLength(1);
    expect(kaartA.stops[0].veldtaken).toHaveLength(1);
    expect(kaartA.stops[0].veldtaken[0].medewerkerNaam).toBe("Michel");
    expect(kaartA.stops[0].veldtaken[0].tekst).toContain("klimop");

    // Niet op een dag ZONDER planning bij die klant (niet ervoor)
    const kaartEerder = (await handler(getDagkaart)(ctx, {
      teamId: teamA,
      datum: "2026-07-13",
    })) as { stops: unknown[] };
    expect(kaartEerder.stops).toHaveLength(0);

    // Niet bij een ander team (team B heeft die dag geen planning bij de klant)
    const kaartB = (await handler(getDagkaart)(ctx, {
      teamId: teamB,
      datum,
    })) as { stops: unknown[] };
    expect(kaartB.stops).toHaveLength(0);
  });

  it("verdwijnt van de dagkaart als Michel die dag niet in de bemanning zit", async () => {
    const { ctx, store, userId, orgId, klantId, michelId, meldingId } =
      setupMetMichel();
    const teamA = store.insert("teams", {
      orgId,
      userId,
      naam: "Team A",
      leden: [michelId],
      isActief: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    await handler(addComment)(ctx, {
      meldingId,
      tekst: "@Michel klimop",
      taggedMedewerkerIds: [michelId],
    });
    const datum = "2026-07-20";
    insertBeurt(store, userId, klantId, {
      orgId,
      teamId: teamA,
      geplandeStart: datum,
      geplandeEind: datum,
    });
    // Bemanning-afwijking: Michel zit die dag NIET in team A
    store.insert("teamBemanning", {
      orgId,
      userId,
      teamId: teamA,
      datum,
      medewerkerIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const kaart = (await handler(getDagkaart)(ctx, {
      teamId: teamA,
      datum,
    })) as { stops: { veldtaken: unknown[] }[] };
    expect(kaart.stops).toHaveLength(1);
    expect(kaart.stops[0].veldtaken).toHaveLength(0);
  });

  it("het antwoord van de getagde medewerker landt in de interne thread (nooit bij de klant)", async () => {
    const { ctx, store, userId, michelId, meldingId } = setupMetMichel();

    // Wissel van actor: kantoor eruit, Michel (medewerker-rol, gelinkt aan
    // de medewerker-record van het bedrijf) wordt de ingelogde gebruiker.
    store.delete(userId);
    store.insert(
      "users",
      createMockUser({ role: "medewerker", name: "Michel", linkedMedewerkerId: michelId })
    );

    await handler(addComment)(ctx, { meldingId, tekst: "Is gebeurd!" });

    const comments = store.getAll("meldingComments");
    expect(comments).toHaveLength(1);
    expect(comments[0].auteurNaam).toBe("Michel");
    // Interne thread: GEEN klant-zichtbare tabellen geraakt
    expect(store.getAll("chat_messages")).toHaveLength(0);
    expect(store.getAll("chat_threads")).toHaveLength(0);
    expect(store.getAll("klantTijdlijn")).toHaveLength(0);

    // En Michel kan zijn veldtaak afronden
    const veldtaakId = store.insert("veldtaken", {
      userId,
      meldingId,
      klantId: "klanten:x",
      medewerkerId: michelId,
      medewerkerNaam: "Michel",
      tekst: "klimop",
      status: "open",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    await handler(rondVeldtaakAf)(ctx, { veldtaakId });
    expect(store.get(veldtaakId)!.status).toBe("afgerond");
  });
});

// ─── 6. Promotie melding → werkitem ──────────────────────────────────────────

describe("promoveerNaarWerkitem (§2.4)", () => {
  it("maakt een ongepland werkitem met koppeling in beide richtingen", async () => {
    const { ctx, store, userId, klantId } = kantoorMetKlant();
    const meldingId = insertMelding(store, userId, klantId, {
      type: "klacht",
      beschrijving: "Klacht over de voorjaarsbeurt",
    });

    const werkitemId = (await handler(promoveerNaarWerkitem)(ctx, {
      id: meldingId,
    })) as string;

    const werkitem = store.get(werkitemId)!;
    expect(werkitem.type).toBe("onderhoudsbeurt");
    expect(werkitem.status).toBe("gepland");
    expect(werkitem.geplandeStart).toBeUndefined(); // ongepland → wachtrij
    expect(werkitem.klantId).toBe(klantId);
    expect(werkitem.meldingId).toBe(meldingId); // werkitem → melding
    expect(store.get(meldingId)!.werkitemId).toBe(werkitemId); // melding → werkitem

    // En het logt op de tijdlijn + in de thread
    expect(store.getAll("klantTijdlijn")).toHaveLength(1);
    expect(store.getAll("meldingComments")).toHaveLength(1);
  });
});

// ─── 7. Attenderingstest §8.12: cron, idempotentie, vrijgeven ────────────────

describe("planningsattendering (§2.1-restant, §8.12)", () => {
  const vandaag = vandaagIso();

  it("pure helpers: sleutel, tekst en attenderen-vanaf-datum", () => {
    expect(maakAttenderingSleutel("projecten:7", "2026-08-01")).toBe(
      "plantaak:projecten:7:2026-08-01"
    );
    expect(dagenTussen("2026-07-10", "2026-07-24")).toBe(14);
    expect(addDagen("2026-07-10", -14)).toBe("2026-06-26");
    expect(
      attenderingTekst("Snoeibeurt", "Jan de Vries", addDagen(vandaag, 14), vandaag)
    ).toBe("Snoeibeurt (Jan de Vries) inplannen — venster opent over 14 dagen");
    expect(
      attenderingTekst("Snoeibeurt", "Jan", vandaag, vandaag)
    ).toContain("venster is open");
  });

  it("attenderingVandaagNodig: pas vanaf venster − dagenVooraf; uitschakelbaar", () => {
    const ritme = { intervalWeken: 26 };
    // 10 dagen vooruit, default 14 dagen vooraf → attenderen
    expect(
      attenderingVandaagNodig(
        { ritme, volgendeVoorzieneDatum: addDagen(vandaag, 10) },
        vandaag
      )
    ).toEqual({ vensterOpening: addDagen(vandaag, 10) });
    // 30 dagen vooruit → nog niet
    expect(
      attenderingVandaagNodig(
        { ritme, volgendeVoorzieneDatum: addDagen(vandaag, 30) },
        vandaag
      )
    ).toBeNull();
    // 30 dagen vooruit maar 45 dagen vooraf ingesteld → wél
    expect(
      attenderingVandaagNodig(
        {
          ritme,
          volgendeVoorzieneDatum: addDagen(vandaag, 30),
          attenderingDagenVooraf: 45,
        },
        vandaag
      )
    ).not.toBeNull();
    // Attendering uit → nooit
    expect(
      attenderingVandaagNodig(
        {
          ritme,
          volgendeVoorzieneDatum: addDagen(vandaag, 10),
          attenderingNodig: false,
        },
        vandaag
      )
    ).toBeNull();
  });

  function setupBeurt(overrides: Record<string, unknown> = {}) {
    const { ctx, store, userId, orgId, klantId } = kantoorMetKlant();
    const beurtId = insertBeurt(store, userId, klantId, {
      orgId,
      ritme: { intervalWeken: 26 },
      volgendeVoorzieneDatum: addDagen(vandaag, 10),
      voorzieneDatum: addDagen(vandaag, 10),
      ...overrides,
    });
    return { ctx, store, userId, orgId, klantId, beurtId };
  }

  it("cron genereert een plantaak op het bord: eigenaar kantoor, klant + beurt gekoppeld", async () => {
    const { ctx, store, userId, klantId, beurtId } = setupBeurt();

    const result = (await handler(genereerAttenderingen)(ctx, {})) as {
      aangemaakt: number;
    };
    expect(result.aangemaakt).toBe(1);

    const taken = store
      .getAll("servicemeldingen")
      .filter((m) => m.taaksoort === "plantaak");
    expect(taken).toHaveLength(1);
    const taak = taken[0];
    expect(taak.eigenaarId).toBe(userId);
    expect(taak.klantId).toBe(klantId);
    expect(taak.werkitemId).toBe(beurtId);
    expect(taak.status).toBe("nieuw");
    expect(String(taak.beschrijving)).toContain("inplannen — venster opent over");
    expect(taak.attenderingSleutel).toBe(
      maakAttenderingSleutel(beurtId, addDagen(vandaag, 10))
    );
    // Logt op de klanttijdlijn; er is NIETS gemaild (geen scheduler-calls)
    expect(store.getAll("klantTijdlijn")).toHaveLength(1);
    expect(
      (ctx as unknown as { scheduler: { runAfter: { mock: { calls: unknown[] } } } })
        .scheduler.runAfter.mock.calls
    ).toHaveLength(0);
  });

  it("is idempotent: nogmaals draaien maakt geen tweede taak", async () => {
    const { ctx, store } = setupBeurt();
    await handler(genereerAttenderingen)(ctx, {});
    const tweede = (await handler(genereerAttenderingen)(ctx, {})) as {
      aangemaakt: number;
    };
    expect(tweede.aangemaakt).toBe(0);
    expect(
      store.getAll("servicemeldingen").filter((m) => m.taaksoort === "plantaak")
    ).toHaveLength(1);
  });

  it("respecteert attendering-uit en een venster dat nog te ver weg is", async () => {
    const { ctx: ctx1, store: store1 } = setupBeurt({
      attenderingNodig: false,
    });
    await handler(genereerAttenderingen)(ctx1, {});
    expect(store1.getAll("servicemeldingen")).toHaveLength(0);

    const { ctx: ctx2, store: store2 } = setupBeurt({
      volgendeVoorzieneDatum: addDagen(vandaag, 60),
    });
    await handler(genereerAttenderingen)(ctx2, {});
    expect(store2.getAll("servicemeldingen")).toHaveLength(0);
  });

  it("vrijgeven zet de concrete beurt in de wachtrij en schuift het ritme door", async () => {
    const { ctx, store, beurtId } = setupBeurt();
    await handler(genereerAttenderingen)(ctx, {});
    const taak = store
      .getAll("servicemeldingen")
      .find((m) => m.taaksoort === "plantaak")!;

    const nieuweBeurtId = (await handler(geefBeurtVrij)(ctx, {
      meldingId: taak._id,
    })) as string;

    const nieuweBeurt = store.get(nieuweBeurtId)!;
    expect(nieuweBeurt.type).toBe("onderhoudsbeurt");
    expect(nieuweBeurt.status).toBe("gepland");
    expect(nieuweBeurt.geplandeStart).toBeUndefined(); // ongepland → bak
    expect(nieuweBeurt.voorzieneDatum).toBe(addDagen(vandaag, 10));
    expect(nieuweBeurt.meldingId).toBe(taak._id);
    expect(nieuweBeurt.generatieSleutel).toBe(
      `los:${beurtId}:${addDagen(vandaag, 10)}`
    );

    // Moederbeurt: ritme doorgeschoven (interval 26 weken)
    const moeder = store.get(beurtId)!;
    expect(moeder.volgendeVoorzieneDatum).toBe(
      addDagen(addDagen(vandaag, 10), 26 * 7)
    );
    // Plantaak afgehandeld
    expect(store.get(taak._id as string)!.status).toBe("opgelost");

    // Nogmaals vrijgeven → geweigerd (geen tweede beurt / ritme-sprong)
    await expect(
      handler(geefBeurtVrij)(ctx, { meldingId: taak._id })
    ).rejects.toThrow(ConvexError);

    // Wachtrij (§8.12): de vrijgegeven beurt staat in de bak, de
    // ritme-moeder met attendering NIET
    const wachtrij = (await handler(getWachtrij)(ctx, {
      start: vandaag,
      eind: addDagen(vandaag, 28),
    })) as { _id: string }[];
    const ids = wachtrij.map((w) => w._id);
    expect(ids).toContain(nieuweBeurtId);
    expect(ids).not.toContain(beurtId);
  });

  it("een ritme-beurt met attendering uit blijft gewoon in de wachtrij staan", async () => {
    const { ctx, beurtId } = setupBeurt({ attenderingNodig: false });
    const wachtrij = (await handler(getWachtrij)(ctx, {
      start: vandaag,
      eind: addDagen(vandaag, 28),
    })) as { _id: string }[];
    expect(wachtrij.map((w) => w._id)).toContain(beurtId);
  });
});

// ─── 8. Bord + badge ─────────────────────────────────────────────────────────

describe("getBord / telOpenMeldingen", () => {
  it("groepeert in de vier PRD-kolommen en filtert op 'mijn cases'", async () => {
    const { ctx, store, userId, klantId } = kantoorMetKlant();
    const anderUserId = store.insert(
      "users",
      createMockUser({ role: "projectleider", clerkId: "clerk_ander", name: "Ander" })
    );
    insertMelding(store, userId, klantId, { eigenaarId: userId });
    insertMelding(store, userId, klantId, {
      eigenaarId: anderUserId,
      status: "wacht_op_derden",
    });
    insertMelding(store, userId, klantId, { status: "afgehandeld" }); // legacy

    const bord = (await handler(getBord)(ctx, {})) as Record<
      string,
      { _id: string }[]
    >;
    expect(bord.nieuw).toHaveLength(1);
    expect(bord.wacht_op_derden).toHaveLength(1);
    expect(bord.opgelost).toHaveLength(1); // legacy afgehandeld → opgelost

    const mijn = (await handler(getBord)(ctx, { mijnCases: true })) as Record<
      string,
      unknown[]
    >;
    expect(mijn.nieuw).toHaveLength(1);
    expect(mijn.wacht_op_derden).toHaveLength(0);
  });

  it("de teller-badge telt alleen open meldingen", async () => {
    const { ctx, store, userId, klantId } = kantoorMetKlant();
    insertMelding(store, userId, klantId, { status: "nieuw" });
    insertMelding(store, userId, klantId, { status: "in_behandeling" });
    insertMelding(store, userId, klantId, { status: "wacht_op_derden" });
    insertMelding(store, userId, klantId, { status: "opgelost" });
    insertMelding(store, userId, klantId, { status: "afgehandeld" });
    insertMelding(store, userId, klantId, {
      status: "nieuw",
      deletedAt: Date.now(),
    });

    expect(await handler(telOpenMeldingen)(ctx, {})).toBe(3);
  });
});
