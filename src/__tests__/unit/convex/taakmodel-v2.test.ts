/**
 * Taakmodel v2 — klantdossier v13 + werkbord "Mijn dag" (fase 1).
 *
 * Dekt:
 * 1. de migratie v1 → v2 (statusmapping, medewerker → account, stilstandmeter);
 * 2. de afgeleide velden die het bord kleuren: stilDagen, over, ai, subtaken;
 * 3. de stilstandmeter die bij ELKE beweging terugvalt (setStatus, wijsToe,
 *    zelfOppakken) en juist NIET bij een herinnering;
 * 4. de herinnering die de server adresseert (checker bij "check");
 * 5. urenparsing van het daglogboek;
 * 6. org-isolatie op elk nieuw endpoint;
 * 7. de klant-rol die overal een fout krijgt;
 * 8. de mijnTaken-REGRESSIE: een account zonder medewerkersrij kreeg vroeger
 *    álle taken van het bedrijf te zien in een paneel dat "Mijn taken" heet;
 * 9. toewijsbaarheid: admins staan er expliciet bij (harde klanteis), en een
 *    account van een andere tenant NOOIT (review v13, bevinding 1);
 * 10. de backfill die `users.orgId` vult voor accounts van vóór die fix.
 */

import { describe, it, expect } from "vitest";
import {
  MockConvexStore,
  createMockCtx,
  createMockUser,
  createMockKlant,
  seedMockOrganisatie,
  seedAndereOrganisatie,
} from "../../helpers/convex-mock";
import {
  listVoorKlant,
  mijnTaken,
  mijnDag,
  create as createTaak,
  update as updateTaak,
  setStatus,
  wijsToe,
  zelfOppakken,
  remove as removeTaak,
  openTellingPerKlant,
} from "../../../../convex/klantTaken";
import {
  list as listReacties,
  plaats as plaatsReactie,
  plaatsHerinnering,
} from "../../../../convex/taakReacties";
import {
  vandaag as logboekVandaag,
  voegToe as logboekVoegToe,
  parseerUren,
} from "../../../../convex/dagLogboek";
import {
  list as listBestanden,
  registreer as registreerBestand,
} from "../../../../convex/klantBestanden";
import { takenToewijsbaar } from "../../../../convex/users";
import { backfillUsersOrg } from "../../../../convex/migrations/usersOrgBackfill";
import { dossierTellingen } from "../../../../convex/klanten";
import {
  migreer,
  migreerStatus,
  heeftMigratieNodig,
} from "../../../../convex/migrations/taakmodelV2";
import {
  initialenVan,
  isOver,
  stilDagen,
  telSubtaken,
} from "../../../../convex/lib/taakModel";
import { archiveerVerzondenDocument } from "../../../../convex/lib/klantBestandenArchief";
import type { MutationCtx } from "../../../../convex/_generated/server";

// ─── Helpers ─────────────────────────────────────────────────────────────────

type AnyHandler = (ctx: unknown, args: unknown) => Promise<unknown>;

/** Convex registreert de handler op de functie zelf (func._handler). */
function handler(fn: unknown): AnyHandler {
  return (fn as { _handler: AnyHandler })._handler;
}

const DAG = 24 * 60 * 60 * 1000;

/** Vandaag als YYYY-MM-DD in Europe/Amsterdam — zelfde bron als de server. */
function vandaagISO(offsetDagen = 0): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(Date.now() + offsetDagen * DAG));
}

interface Wereld {
  store: MockConvexStore;
  ctx: ReturnType<typeof createMockCtx>;
  orgId: string;
  userId: string;
  klantId: string;
}

/** Organisatie + ingelogde gebruiker + één klant. */
function bouwWereld(role: string = "directie", extra: Record<string, unknown> = {}): Wereld {
  const store = new MockConvexStore();
  const orgId = seedMockOrganisatie(store);
  // `orgId` op de users-rij ís het lidmaatschap: sinds review v13 telt een
  // account zonder koppeling nergens meer mee (zie convex/lib/taakPersonen.ts).
  const userId = store.insert(
    "users",
    createMockUser({ role, name: "Ricardo Bos", orgId, ...extra })
  );
  const klantId = store.insert(
    "klanten",
    createMockKlant(userId, { orgId, naam: "Familie De Vries" })
  );
  return { store, ctx: createMockCtx(store), orgId, userId, klantId };
}

/** Tweede account binnen dezelfde organisatie (geen medewerkersrij nodig). */
function voegCollegaToe(
  wereld: Wereld,
  naam: string,
  role: string = "medewerker"
): string {
  return wereld.store.insert(
    "users",
    createMockUser({
      _id: undefined,
      clerkId: `clerk_${naam.toLowerCase().replace(/\s+/g, "_")}`,
      email: `${naam.toLowerCase().replace(/\s+/g, ".")}@toptuinen.nl`,
      name: naam,
      role,
      orgId: wereld.orgId,
    })
  );
}

function insertTaak(
  wereld: Wereld,
  velden: Record<string, unknown> = {}
): string {
  const now = Date.now();
  return wereld.store.insert("klantTaken", {
    orgId: wereld.orgId,
    klantId: wereld.klantId,
    titel: "Maten opmeten",
    status: "todo",
    prioriteit: "normaal",
    laatsteBewegingOp: now,
    createdAt: now,
    updatedAt: now,
    ...velden,
  });
}

/** Ctx met een storage-stub — klantBestanden.list vraagt download-URL's op. */
function ctxMetStorage(wereld: Wereld) {
  return {
    ...wereld.ctx,
    storage: {
      getUrl: async (id: string) => `https://storage.test/${id}`,
      generateUploadUrl: async () => "https://upload.test/abc",
      delete: async () => undefined,
    },
  };
}

// ─── 1. Migratie v1 → v2 ─────────────────────────────────────────────────────

describe("migratie taakmodel v2", () => {
  it("mapt de oude statussen op de nieuwe", () => {
    expect(migreerStatus("open")).toBe("todo");
    expect(migreerStatus("afgerond")).toBe("klaar");
    // v2-waarden blijven zichzelf: twee keer draaien mag niets veranderen.
    expect(migreerStatus("todo")).toBe("todo");
    expect(migreerStatus("bezig")).toBe("bezig");
    expect(migreerStatus("check")).toBe("check");
    expect(migreerStatus("klaar")).toBe("klaar");
  });

  it("herkent welke rijen nog werk nodig hebben", () => {
    expect(heeftMigratieNodig({ status: "open" })).toBe(true);
    expect(
      heeftMigratieNodig({ status: "todo", laatsteBewegingOp: undefined })
    ).toBe(true);
    expect(
      heeftMigratieNodig({
        status: "todo",
        laatsteBewegingOp: 1,
        toegewezenAanId: "medewerkers:1",
      })
    ).toBe(true);
    expect(heeftMigratieNodig({ status: "todo", laatsteBewegingOp: 1 })).toBe(
      false
    );
  });

  it("zet status om, vertaalt de medewerker naar zijn account en vult de stilstandmeter", async () => {
    const wereld = bouwWereld();
    const collegaId = voegCollegaToe(wereld, "Jan Bakker");
    const collega = wereld.store.get(collegaId)!;
    const medewerkerId = wereld.store.insert("medewerkers", {
      orgId: wereld.orgId,
      naam: "Jan Bakker",
      clerkUserId: collega.clerkId,
    });

    const geboren = Date.now() - 5 * DAG;
    const oudeTaak = wereld.store.insert("klantTaken", {
      orgId: wereld.orgId,
      klantId: wereld.klantId,
      titel: "Oprit terugbellen",
      status: "open",
      prioriteit: "normaal",
      toegewezenAanId: medewerkerId,
      aangemaaktDoorId: wereld.userId,
      _creationTime: geboren,
      createdAt: geboren,
      updatedAt: geboren,
    });
    const afgerondeTaak = wereld.store.insert("klantTaken", {
      orgId: wereld.orgId,
      klantId: wereld.klantId,
      titel: "Offerte nagebeld",
      status: "afgerond",
      prioriteit: "laag",
      _creationTime: geboren,
      createdAt: geboren,
      updatedAt: geboren,
    });

    const uitkomst = (await handler(migreer)(wereld.ctx, {})) as {
      verwerkt: number;
      klaar: boolean;
    };
    expect(uitkomst.verwerkt).toBe(2);
    expect(uitkomst.klaar).toBe(true);

    const gemigreerd = wereld.store.get(oudeTaak)!;
    expect(gemigreerd.status).toBe("todo");
    expect(gemigreerd.makerId).toBe(collegaId);
    expect(gemigreerd.uitgezetDoorId).toBe(wereld.userId);
    expect(gemigreerd.laatsteBewegingOp).toBe(geboren);
    expect(gemigreerd.toegewezenAanId).toBeUndefined();

    expect(wereld.store.get(afgerondeTaak)!.status).toBe("klaar");

    // Idempotent: een tweede ronde doet niets meer.
    const tweede = (await handler(migreer)(wereld.ctx, {})) as {
      verwerkt: number;
    };
    expect(tweede.verwerkt).toBe(0);
  });

  it("laat de maker leeg als de medewerker geen account heeft", async () => {
    const wereld = bouwWereld();
    const medewerkerId = wereld.store.insert("medewerkers", {
      orgId: wereld.orgId,
      naam: "Losse kracht",
      // geen clerkUserId — er hangt geen account aan
    });
    const taakId = wereld.store.insert("klantTaken", {
      orgId: wereld.orgId,
      klantId: wereld.klantId,
      titel: "Haag snoeien",
      status: "open",
      prioriteit: "normaal",
      toegewezenAanId: medewerkerId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    await handler(migreer)(wereld.ctx, {});
    const taak = wereld.store.get(taakId)!;
    expect(taak.makerId).toBeUndefined();
    expect(taak.toegewezenAanId).toBeUndefined();
  });
});

// ─── 2. Afleidingen ──────────────────────────────────────────────────────────

describe("afgeleide velden", () => {
  it("telt hele dagen stilstand en valt terug op de aanmaaktijd", () => {
    const nu = Date.now();
    expect(stilDagen(nu - 2.5 * DAG, nu - 10 * DAG, nu)).toBe(2);
    expect(stilDagen(undefined, nu - 3 * DAG, nu)).toBe(3);
    // Een klok die vooruit loopt mag geen negatieve stilstand geven.
    expect(stilDagen(nu + DAG, nu, nu)).toBe(0);
  });

  it("noemt een taak alleen 'over' als hij niet klaar is", () => {
    expect(isOver("2026-08-19", "todo", "2026-08-20")).toBe(true);
    expect(isOver("2026-08-20", "todo", "2026-08-20")).toBe(false);
    expect(isOver("2026-08-19", "klaar", "2026-08-20")).toBe(false);
    expect(isOver(undefined, "todo", "2026-08-20")).toBe(false);
  });

  it("telt subtaken en maakt initialen", () => {
    expect(telSubtaken([{ klaar: true }, { klaar: false }])).toEqual({
      subtakenKlaar: 1,
      subtakenTotaal: 2,
    });
    expect(telSubtaken(undefined)).toEqual({
      subtakenKlaar: 0,
      subtakenTotaal: 0,
    });
    expect(initialenVan("Ricardo Bos")).toBe("RB");
    expect(initialenVan("kantoor")).toBe("K");
    expect(initialenVan("  ")).toBe("?");
  });

  it("levert de verrijkte taak zoals het dossier hem verwacht", async () => {
    const wereld = bouwWereld();
    const checkerId = voegCollegaToe(wereld, "Sanne Groen");
    const tijdlijnId = wereld.store.insert("klantTijdlijn", {
      orgId: wereld.orgId,
      klantId: wereld.klantId,
      timestamp: Date.now(),
      auteurNaam: "Ricardo Bos",
      kanaal: "telefoon",
      eventType: "handmatig",
      tekst: "Gebeld over de oprit",
      createdAt: Date.now(),
    });
    const taakId = insertTaak(wereld, {
      makerId: wereld.userId,
      checkerId,
      uitgezetDoorId: wereld.userId,
      deadline: vandaagISO(-1),
      bronTijdlijnId: tijdlijnId,
      subtaken: [
        { titel: "Maten opnemen", klaar: true },
        { titel: "Prijs opvragen", klaar: false },
      ],
      laatsteBewegingOp: Date.now() - 3 * DAG,
    });
    wereld.store.insert("taakReacties", {
      orgId: wereld.orgId,
      taakId,
      auteurId: wereld.userId,
      tekst: "Leverancier gebeld",
      timestamp: Date.now(),
      soort: "reactie",
    });

    const taken = (await handler(listVoorKlant)(wereld.ctx, {
      klantId: wereld.klantId,
    })) as Array<Record<string, unknown>>;

    expect(taken).toHaveLength(1);
    const taak = taken[0];
    expect(taak.stilDagen).toBe(3);
    expect(taak.over).toBe(true);
    expect(taak.ai).toBe(true);
    expect(taak.subtakenKlaar).toBe(1);
    expect(taak.subtakenTotaal).toBe(2);
    expect(taak.reactieCount).toBe(1);
    expect(taak.klantNaam).toBe("Familie De Vries");
    expect((taak.maker as { initialen: string }).initialen).toBe("RB");
    expect((taak.checker as { naam: string }).naam).toBe("Sanne Groen");
    expect((taak.uitzetter as { isAdmin: boolean }).isAdmin).toBe(true);
  });
});

// ─── 3. De stilstandmeter valt terug bij elke beweging ───────────────────────

describe("stilstandmeter", () => {
  it("reset bij setStatus, wijsToe en zelfOppakken", async () => {
    const wereld = bouwWereld();
    const collegaId = voegCollegaToe(wereld, "Jan Bakker");
    const lang = Date.now() - 9 * DAG;

    for (const [naam, fn, args] of [
      ["setStatus", setStatus, { status: "bezig" }],
      ["wijsToe", wijsToe, { makerId: collegaId }],
      ["zelfOppakken", zelfOppakken, {}],
    ] as const) {
      const taakId = insertTaak(wereld, { laatsteBewegingOp: lang });
      await handler(fn)(wereld.ctx, { taakId, ...args });
      const taak = wereld.store.get(taakId)!;
      expect(
        (taak.laatsteBewegingOp as number) > lang,
        `${naam} zette de stilstandmeter niet terug`
      ).toBe(true);
    }
  });

  it("reset bij het verzetten van de deadline, maar niet bij een titelcorrectie", async () => {
    const wereld = bouwWereld();
    const lang = Date.now() - 9 * DAG;

    // Slepen in de Wanneer-indeling = planning verzetten = beweging (§B2).
    const verzetId = insertTaak(wereld, { laatsteBewegingOp: lang });
    await handler(updateTaak)(wereld.ctx, {
      taakId: verzetId,
      deadline: "2026-08-25",
    });
    expect(
      (wereld.store.get(verzetId)!.laatsteBewegingOp as number) > lang
    ).toBe(true);

    // Een titelcorrectie is geen beweging op de taak.
    const titelId = insertTaak(wereld, { laatsteBewegingOp: lang });
    await handler(updateTaak)(wereld.ctx, {
      taakId: titelId,
      titel: "Nieuwe titel",
    });
    expect(wereld.store.get(titelId)!.laatsteBewegingOp).toBe(lang);
  });

  it("laat de stilstandmeter met rust bij een herinnering", async () => {
    const wereld = bouwWereld();
    const lang = Date.now() - 9 * DAG;
    const taakId = insertTaak(wereld, {
      laatsteBewegingOp: lang,
      makerId: wereld.userId,
    });

    await handler(plaatsHerinnering)(wereld.ctx, { taakId });

    // Anders pord je een taak simpelweg uit het blijft-liggen-paneel zonder
    // dat er iets is gebeurd.
    expect(wereld.store.get(taakId)!.laatsteBewegingOp).toBe(lang);
  });

  it("zet afgerondAt bij klaar en haalt hem weg bij heropenen", async () => {
    const wereld = bouwWereld();
    const taakId = insertTaak(wereld);

    await handler(setStatus)(wereld.ctx, { taakId, status: "klaar" });
    expect(typeof wereld.store.get(taakId)!.afgerondAt).toBe("number");

    await handler(setStatus)(wereld.ctx, { taakId, status: "todo" });
    expect(wereld.store.get(taakId)!.afgerondAt).toBeUndefined();
  });
});

// ─── 4. Herinnering ──────────────────────────────────────────────────────────

describe("herinnering", () => {
  it("richt zich op de checker zodra de taak op 'check' staat", async () => {
    const wereld = bouwWereld();
    const makerId = voegCollegaToe(wereld, "Jan Bakker");
    const checkerId = voegCollegaToe(wereld, "Sanne Groen");
    const taakId = insertTaak(wereld, {
      status: "check",
      makerId,
      checkerId,
    });

    const uitkomst = (await handler(plaatsHerinnering)(wereld.ctx, {
      taakId,
    })) as { gerichtAan: string | null };

    expect(uitkomst.gerichtAan).toBe("Sanne");
    const reacties = wereld.store.getAll("taakReacties");
    expect(reacties[0].soort).toBe("herinnering");
    expect(reacties[0].tekst).toBe(
      "Even een reminder: dit staat nog open bij Sanne."
    );
  });

  it("richt zich op de maker bij elke andere status", async () => {
    const wereld = bouwWereld();
    const makerId = voegCollegaToe(wereld, "Jan Bakker");
    const checkerId = voegCollegaToe(wereld, "Sanne Groen");
    const taakId = insertTaak(wereld, { status: "bezig", makerId, checkerId });

    const uitkomst = (await handler(plaatsHerinnering)(wereld.ctx, {
      taakId,
    })) as { gerichtAan: string | null };

    expect(uitkomst.gerichtAan).toBe("Jan");
  });

  it("geeft reacties chronologisch terug met auteursnaam en initialen", async () => {
    const wereld = bouwWereld();
    const taakId = insertTaak(wereld);
    await handler(plaatsReactie)(wereld.ctx, { taakId, tekst: "Eerste" });
    await handler(plaatsReactie)(wereld.ctx, { taakId, tekst: "Tweede" });

    const reacties = (await handler(listReacties)(wereld.ctx, {
      taakId,
    })) as Array<Record<string, unknown>>;

    expect(reacties.map((r) => r.tekst)).toEqual(["Eerste", "Tweede"]);
    expect(reacties[0].auteurNaam).toBe("Ricardo Bos");
    expect(reacties[0].auteurInitialen).toBe("RB");
  });

  it("verwijdert de reacties samen met de taak", async () => {
    const wereld = bouwWereld();
    const taakId = insertTaak(wereld);
    await handler(plaatsReactie)(wereld.ctx, { taakId, tekst: "Hoi" });

    await handler(removeTaak)(wereld.ctx, { taakId });

    expect(wereld.store.getAll("taakReacties")).toHaveLength(0);
  });
});

// ─── 5. Urenparsing daglogboek ───────────────────────────────────────────────

describe("daglogboek", () => {
  it("parseert uren en minuten, en laat tekst zonder tijd met rust", () => {
    expect(parseerUren("1,5u overleg")).toBe(1.5);
    expect(parseerUren("2u")).toBe(2);
    expect(parseerUren("1.5 uur bestrating")).toBe(1.5);
    expect(parseerUren("45m")).toBe(0.8);
    expect(parseerUren("30 min bellen")).toBe(0.5);
    expect(parseerUren("overleg met Jan")).toBeUndefined();
    expect(parseerUren("")).toBeUndefined();
  });

  it("telt het dagtotaal van de eigen regels op", async () => {
    const wereld = bouwWereld();
    await handler(logboekVoegToe)(wereld.ctx, { tekst: "1,5u bestrating" });
    await handler(logboekVoegToe)(wereld.ctx, { tekst: "45m nabellen" });
    await handler(logboekVoegToe)(wereld.ctx, { tekst: "koffie met Jan" });

    const dag = (await handler(logboekVandaag)(wereld.ctx, {})) as {
      regels: unknown[];
      totaalUren: number;
    };

    expect(dag.regels).toHaveLength(3);
    expect(dag.totaalUren).toBe(2.3);
  });

  it("toont de regels van een collega niet", async () => {
    const wereld = bouwWereld();
    const collegaId = voegCollegaToe(wereld, "Jan Bakker");
    await handler(logboekVoegToe)(wereld.ctx, { tekst: "1u eigen werk" });
    wereld.store.insert("dagLogboek", {
      orgId: wereld.orgId,
      userId: collegaId,
      datum: vandaagISO(),
      timestamp: Date.now(),
      tekst: "3u werk van Jan",
      uren: 3,
    });

    const dag = (await handler(logboekVandaag)(wereld.ctx, {})) as {
      regels: unknown[];
      totaalUren: number;
    };

    expect(dag.regels).toHaveLength(1);
    expect(dag.totaalUren).toBe(1);
  });
});

// ─── 6. mijnTaken-regressie + mijnDag ────────────────────────────────────────

describe("mijnTaken (regressie v1-bug)", () => {
  /**
   * De bug: `alleenEigen` viel terug op `Boolean(user.linkedMedewerkerId)`.
   * Een account zonder medewerkersrij — precies kantoor en directie — kreeg
   * daardoor ALLE openstaande taken van het bedrijf in een paneel dat "Mijn
   * taken" heet. In v2 hangt de scope aan het account.
   */
  it("toont een account zonder medewerkersrij alleen eigen taken", async () => {
    const wereld = bouwWereld("directie");
    expect(wereld.store.get(wereld.userId)!.linkedMedewerkerId).toBeUndefined();
    const collegaId = voegCollegaToe(wereld, "Jan Bakker");

    insertTaak(wereld, { titel: "Van mij (maker)", makerId: wereld.userId });
    insertTaak(wereld, {
      titel: "Van mij (checker)",
      makerId: collegaId,
      checkerId: wereld.userId,
    });
    insertTaak(wereld, { titel: "Van Jan", makerId: collegaId });
    insertTaak(wereld, { titel: "Van niemand" });

    const taken = (await handler(mijnTaken)(wereld.ctx, {})) as Array<{
      titel: string;
    }>;

    expect(taken.map((t) => t.titel).sort()).toEqual([
      "Van mij (checker)",
      "Van mij (maker)",
    ]);
  });

  it("geeft met alleenEigen:false wél het teamoverzicht", async () => {
    const wereld = bouwWereld("directie");
    const collegaId = voegCollegaToe(wereld, "Jan Bakker");
    insertTaak(wereld, { titel: "Van mij", makerId: wereld.userId });
    insertTaak(wereld, { titel: "Van Jan", makerId: collegaId });

    const taken = (await handler(mijnTaken)(wereld.ctx, {
      alleenEigen: false,
    })) as Array<{ titel: string }>;

    expect(taken).toHaveLength(2);
  });

  it("laat afgeronde taken weg", async () => {
    const wereld = bouwWereld();
    insertTaak(wereld, { titel: "Open", makerId: wereld.userId });
    insertTaak(wereld, {
      titel: "Klaar",
      makerId: wereld.userId,
      status: "klaar",
    });

    const taken = (await handler(mijnTaken)(wereld.ctx, {})) as Array<{
      titel: string;
    }>;

    expect(taken.map((t) => t.titel)).toEqual(["Open"]);
  });
});

describe("mijnDag", () => {
  it("geeft alle open taken van de org plus wat de laatste week af is", async () => {
    const wereld = bouwWereld();
    insertTaak(wereld, { titel: "Open" });
    insertTaak(wereld, {
      titel: "Gisteren afgerond",
      status: "klaar",
      afgerondAt: Date.now() - DAG,
    });
    insertTaak(wereld, {
      titel: "Vorige maand afgerond",
      status: "klaar",
      afgerondAt: Date.now() - 40 * DAG,
    });

    const bord = (await handler(mijnDag)(wereld.ctx, {})) as {
      taken: Array<{ titel: string }>;
      personen: unknown[];
      klanten: Array<{ naam: string }>;
    };

    expect(bord.taken.map((t) => t.titel).sort()).toEqual([
      "Gisteren afgerond",
      "Open",
    ]);
    expect(bord.klanten.map((k) => k.naam)).toEqual(["Familie De Vries"]);
    expect(bord.personen.length).toBeGreaterThan(0);
  });
});

// ─── 7. Toewijsbaarheid ──────────────────────────────────────────────────────

describe("takenToewijsbaar", () => {
  it("bevat het admin-account en markeert het als admin", async () => {
    const wereld = bouwWereld("directie");
    voegCollegaToe(wereld, "Jan Bakker", "medewerker");
    voegCollegaToe(wereld, "Kantoor Kim", "projectleider");

    const personen = (await handler(takenToewijsbaar)(wereld.ctx, {})) as Array<{
      naam: string;
      isAdmin: boolean;
      initialen: string;
    }>;

    const namen = personen.map((p) => p.naam);
    expect(namen).toContain("Ricardo Bos");
    expect(namen).toContain("Jan Bakker");
    expect(personen.find((p) => p.naam === "Ricardo Bos")!.isAdmin).toBe(true);
    expect(personen.find((p) => p.naam === "Kantoor Kim")!.isAdmin).toBe(true);
    expect(personen.find((p) => p.naam === "Jan Bakker")!.isAdmin).toBe(false);
  });

  it("laat klantaccounts en accounts van een andere organisatie weg", async () => {
    const wereld = bouwWereld("directie");
    const andereOrgId = seedAndereOrganisatie(wereld.store);
    voegCollegaToe(wereld, "Klant Kees", "klant");

    const buurmanMedewerker = wereld.store.insert("medewerkers", {
      orgId: andereOrgId,
      naam: "Buurman Bert",
    });
    wereld.store.insert(
      "users",
      createMockUser({
        clerkId: "clerk_bert",
        email: "bert@groen.nl",
        name: "Buurman Bert",
        role: "medewerker",
        linkedMedewerkerId: buurmanMedewerker,
      })
    );

    const personen = (await handler(takenToewijsbaar)(wereld.ctx, {})) as Array<{
      naam: string;
    }>;

    const namen = personen.map((p) => p.naam);
    expect(namen).not.toContain("Klant Kees");
    expect(namen).not.toContain("Buurman Bert");
  });

  it("weigert een taak aan een account van een andere organisatie te hangen", async () => {
    const wereld = bouwWereld("directie");
    const andereOrgId = seedAndereOrganisatie(wereld.store);
    const buurmanMedewerker = wereld.store.insert("medewerkers", {
      orgId: andereOrgId,
      naam: "Buurman Bert",
    });
    const buurmanUser = wereld.store.insert(
      "users",
      createMockUser({
        clerkId: "clerk_bert",
        email: "bert@groen.nl",
        name: "Buurman Bert",
        role: "medewerker",
        linkedMedewerkerId: buurmanMedewerker,
      })
    );
    const taakId = insertTaak(wereld);

    await expect(
      handler(wijsToe)(wereld.ctx, { taakId, makerId: buurmanUser })
    ).rejects.toThrow();
  });

  /**
   * REGRESSIE (review v13, bevinding 1): een account ZONDER medewerkersrij
   * werd als lid van élke organisatie behandeld. Het kantooraccount van de
   * buurman verscheen daardoor mét naam en e-mail in de selects van Mijn dag,
   * en `wijsToe` accepteerde hem ook nog. Lidmaatschap moet blijken uit een
   * koppeling: `users.orgId`, een medewerkersrij van deze org, of eigenaar
   * zijn van deze org.
   */
  it("laat het kantooraccount van de buurman (users.orgId elders, geen medewerkersrij) niet zien", async () => {
    const wereld = bouwWereld("directie");
    const andereOrgId = seedAndereOrganisatie(wereld.store);
    const buurmanUser = wereld.store.insert(
      "users",
      createMockUser({
        clerkId: "clerk_bianca",
        email: "bianca@groen.nl",
        name: "Bianca Buurman",
        role: "projectleider",
        orgId: andereOrgId,
      })
    );

    const personen = (await handler(takenToewijsbaar)(wereld.ctx, {})) as Array<{
      naam: string;
    }>;
    expect(personen.map((p) => p.naam)).not.toContain("Bianca Buurman");

    const bord = (await handler(mijnDag)(wereld.ctx, {})) as {
      personen: Array<{ naam: string }>;
    };
    expect(bord.personen.map((p) => p.naam)).not.toContain("Bianca Buurman");

    const taakId = insertTaak(wereld);
    await expect(
      handler(wijsToe)(wereld.ctx, { taakId, makerId: buurmanUser })
    ).rejects.toThrow();
  });

  it("laat de eigenaar van een andere organisatie (zonder users.orgId) niet zien", async () => {
    const wereld = bouwWereld("directie");
    const andereOrgId = seedAndereOrganisatie(wereld.store);
    const buurmanEigenaar = wereld.store.insert(
      "users",
      createMockUser({
        clerkId: "clerk_els",
        email: "els@groen.nl",
        name: "Els Eigenaar",
        role: "directie",
      })
    );
    // Nog niet gestempeld door de backfill: alleen de org wijst naar hem.
    wereld.store.patch(andereOrgId, { eigenaarUserId: buurmanEigenaar });

    const personen = (await handler(takenToewijsbaar)(wereld.ctx, {})) as Array<{
      naam: string;
    }>;
    expect(personen.map((p) => p.naam)).not.toContain("Els Eigenaar");

    const taakId = insertTaak(wereld);
    await expect(
      handler(wijsToe)(wereld.ctx, { taakId, makerId: buurmanEigenaar })
    ).rejects.toThrow();
  });

  it("houdt het eigen kantooraccount zonder medewerkersrij wél toewijsbaar", async () => {
    const wereld = bouwWereld("directie");
    const kantoorId = wereld.store.insert(
      "users",
      createMockUser({
        clerkId: "clerk_kim",
        email: "kim@toptuinen.nl",
        name: "Kantoor Kim",
        role: "projectleider",
        orgId: wereld.orgId,
      })
    );

    const personen = (await handler(takenToewijsbaar)(wereld.ctx, {})) as Array<{
      naam: string;
    }>;
    expect(personen.map((p) => p.naam)).toContain("Kantoor Kim");

    const taakId = insertTaak(wereld);
    await expect(
      handler(wijsToe)(wereld.ctx, { taakId, makerId: kantoorId })
    ).resolves.toEqual({ success: true });
  });

  it("houdt de eigenaar van de eigen organisatie toewijsbaar, ook zonder users.orgId", async () => {
    const wereld = bouwWereld("directie");
    const eigenaarId = wereld.store.insert(
      "users",
      createMockUser({
        clerkId: "clerk_ricardo_eigenaar",
        email: "eigenaar@toptuinen.nl",
        name: "Eigen Eigenaar",
        role: "directie",
      })
    );
    wereld.store.patch(wereld.orgId, { eigenaarUserId: eigenaarId });

    const personen = (await handler(takenToewijsbaar)(wereld.ctx, {})) as Array<{
      naam: string;
    }>;
    expect(personen.map((p) => p.naam)).toContain("Eigen Eigenaar");
  });

  it("noemt een account met alléén een medewerkersrij van deze org één keer", async () => {
    const wereld = bouwWereld("directie");
    const medewerkerId = wereld.store.insert("medewerkers", {
      orgId: wereld.orgId,
      naam: "Jan Bakker",
    });
    // Beide routes wijzen naar hem: users.by_org én de medewerkerskoppeling.
    wereld.store.insert(
      "users",
      createMockUser({
        clerkId: "clerk_jan",
        email: "jan@toptuinen.nl",
        name: "Jan Bakker",
        role: "medewerker",
        orgId: wereld.orgId,
        linkedMedewerkerId: medewerkerId,
      })
    );

    const personen = (await handler(takenToewijsbaar)(wereld.ctx, {})) as Array<{
      naam: string;
    }>;
    expect(personen.filter((p) => p.naam === "Jan Bakker")).toHaveLength(1);
  });
});

// ─── 8. Org-isolatie ─────────────────────────────────────────────────────────

describe("org-isolatie", () => {
  it("laat de taken van de buurman nergens opduiken", async () => {
    const wereld = bouwWereld();
    const andereOrgId = seedAndereOrganisatie(wereld.store);
    const andereKlant = wereld.store.insert(
      "klanten",
      createMockKlant(wereld.userId, {
        orgId: andereOrgId,
        naam: "Klant van de buurman",
      })
    );
    wereld.store.insert("klantTaken", {
      orgId: andereOrgId,
      klantId: andereKlant,
      titel: "Geheim werk",
      status: "todo",
      prioriteit: "normaal",
      makerId: wereld.userId,
      laatsteBewegingOp: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    insertTaak(wereld, { titel: "Eigen werk", makerId: wereld.userId });

    const eigen = (await handler(mijnTaken)(wereld.ctx, {})) as Array<{
      titel: string;
    }>;
    expect(eigen.map((t) => t.titel)).toEqual(["Eigen werk"]);

    const bord = (await handler(mijnDag)(wereld.ctx, {})) as {
      taken: Array<{ titel: string }>;
    };
    expect(bord.taken.map((t) => t.titel)).toEqual(["Eigen werk"]);

    const telling = (await handler(openTellingPerKlant)(
      wereld.ctx,
      {}
    )) as Record<string, number>;
    expect(telling[andereKlant]).toBeUndefined();
    expect(telling[wereld.klantId]).toBe(1);

    // Het dossier van de buurman is niet te openen.
    await expect(
      handler(listVoorKlant)(wereld.ctx, { klantId: andereKlant })
    ).rejects.toThrow();
  });

  it("weigert een reactie op een taak van een andere organisatie", async () => {
    const wereld = bouwWereld();
    const andereOrgId = seedAndereOrganisatie(wereld.store);
    const andereKlant = wereld.store.insert(
      "klanten",
      createMockKlant(wereld.userId, { orgId: andereOrgId })
    );
    const andereTaak = wereld.store.insert("klantTaken", {
      orgId: andereOrgId,
      klantId: andereKlant,
      titel: "Geheim",
      status: "todo",
      prioriteit: "normaal",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    await expect(
      handler(plaatsReactie)(wereld.ctx, { taakId: andereTaak, tekst: "Hoi" })
    ).rejects.toThrow();
    await expect(
      handler(listReacties)(wereld.ctx, { taakId: andereTaak })
    ).rejects.toThrow();
    await expect(
      handler(setStatus)(wereld.ctx, { taakId: andereTaak, status: "klaar" })
    ).rejects.toThrow();
  });

  it("weigert bestanden van een klant van een andere organisatie", async () => {
    const wereld = bouwWereld();
    const andereOrgId = seedAndereOrganisatie(wereld.store);
    const andereKlant = wereld.store.insert(
      "klanten",
      createMockKlant(wereld.userId, { orgId: andereOrgId })
    );

    await expect(
      handler(listBestanden)(ctxMetStorage(wereld), { klantId: andereKlant })
    ).rejects.toThrow();
  });
});

// ─── 9. Klant-rol krijgt nergens toegang ─────────────────────────────────────

describe("klant-rol", () => {
  it("krijgt op elk nieuw endpoint een fout", async () => {
    const wereld = bouwWereld("klant");
    const taakId = insertTaak(wereld);

    const pogingen: Array<[string, Promise<unknown>]> = [
      ["listVoorKlant", handler(listVoorKlant)(wereld.ctx, { klantId: wereld.klantId })],
      ["mijnTaken", handler(mijnTaken)(wereld.ctx, {})],
      ["mijnDag", handler(mijnDag)(wereld.ctx, {})],
      ["openTellingPerKlant", handler(openTellingPerKlant)(wereld.ctx, {})],
      [
        "create",
        handler(createTaak)(wereld.ctx, {
          klantId: wereld.klantId,
          titel: "Stiekem",
        }),
      ],
      ["setStatus", handler(setStatus)(wereld.ctx, { taakId, status: "klaar" })],
      ["wijsToe", handler(wijsToe)(wereld.ctx, { taakId, makerId: null })],
      ["zelfOppakken", handler(zelfOppakken)(wereld.ctx, { taakId })],
      ["remove", handler(removeTaak)(wereld.ctx, { taakId })],
      ["taakReacties.list", handler(listReacties)(wereld.ctx, { taakId })],
      ["taakReacties.plaats", handler(plaatsReactie)(wereld.ctx, { taakId, tekst: "Hoi" })],
      ["taakReacties.plaatsHerinnering", handler(plaatsHerinnering)(wereld.ctx, { taakId })],
      ["dagLogboek.vandaag", handler(logboekVandaag)(wereld.ctx, {})],
      ["dagLogboek.voegToe", handler(logboekVoegToe)(wereld.ctx, { tekst: "1u" })],
      [
        "klantBestanden.list",
        handler(listBestanden)(ctxMetStorage(wereld), { klantId: wereld.klantId }),
      ],
      [
        "klantBestanden.registreer",
        handler(registreerBestand)(ctxMetStorage(wereld), {
          klantId: wereld.klantId,
          soort: "foto",
          titel: "Tuin",
          storageId: "_storage:1",
        }),
      ],
      ["users.takenToewijsbaar", handler(takenToewijsbaar)(wereld.ctx, {})],
    ];

    for (const [naam, poging] of pogingen) {
      await expect(poging, `${naam} liet een klantaccount door`).rejects.toThrow();
    }
  });
});

// ─── 10. Bestanden + auto-archivering ────────────────────────────────────────

describe("klantbestanden", () => {
  it("splitst foto's en documenten en geeft download-URL's", async () => {
    const wereld = bouwWereld();
    const ctx = ctxMetStorage(wereld);

    await handler(registreerBestand)(ctx, {
      klantId: wereld.klantId,
      soort: "foto",
      label: "voor",
      titel: "Achtertuin voor",
      storageId: "_storage:1",
    });
    await handler(registreerBestand)(ctx, {
      klantId: wereld.klantId,
      soort: "document",
      label: "voor", // een document heeft geen fotolabel
      titel: "Tekening",
      storageId: "_storage:2",
    });

    const uit = (await handler(listBestanden)(ctx, {
      klantId: wereld.klantId,
    })) as {
      fotos: Array<Record<string, unknown>>;
      documenten: Array<Record<string, unknown>>;
    };

    expect(uit.fotos).toHaveLength(1);
    expect(uit.fotos[0].label).toBe("voor");
    expect(uit.fotos[0].url).toBe("https://storage.test/_storage:1");
    expect(uit.fotos[0].geuploadDoorNaam).toBe("Ricardo Bos");
    expect(uit.documenten).toHaveLength(1);
    expect(uit.documenten[0].label).toBeUndefined();
  });

  it("archiveert een verzonden document één keer", async () => {
    const wereld = bouwWereld();
    const offerteId = wereld.store.insert("offertes", {
      orgId: wereld.orgId,
      klantId: wereld.klantId,
      offerteNummer: "OF-2026-014",
      status: "verzonden",
    });

    const ctx = wereld.ctx as unknown as MutationCtx;
    await archiveerVerzondenDocument(ctx, {
      klantId: wereld.klantId as never,
      bron: "offerte",
      nummer: "OF-2026-014",
      offerteId: offerteId as never,
    });
    // Opnieuw versturen mag geen tweede rij opleveren.
    await archiveerVerzondenDocument(ctx, {
      klantId: wereld.klantId as never,
      bron: "offerte",
      nummer: "OF-2026-014",
      offerteId: offerteId as never,
    });

    const rijen = wereld.store.getAll("klantBestanden");
    expect(rijen).toHaveLength(1);
    expect(rijen[0].titel).toBe("Offerte OF-2026-014");
    expect(rijen[0].bron).toBe("offerte");
    expect(rijen[0].orgId).toBe(wereld.orgId);
  });
});

// ─── 11. Dossiertellingen v2 ─────────────────────────────────────────────────

describe("dossierTellingen", () => {
  it("levert de velden voor de statregel en de gekleurde tellers", async () => {
    const wereld = bouwWereld();
    insertTaak(wereld, { titel: "Later", deadline: "2026-12-01" });
    insertTaak(wereld, { titel: "Eerst", deadline: "2026-09-01" });
    insertTaak(wereld, { titel: "Klaar", status: "klaar" });

    wereld.store.insert("offertes", {
      orgId: wereld.orgId,
      klantId: wereld.klantId,
      offerteNummer: "OF-1",
      status: "concept",
    });
    wereld.store.insert("offertes", {
      orgId: wereld.orgId,
      klantId: wereld.klantId,
      offerteNummer: "OF-2",
      status: "verzonden",
    });

    const nu = Date.now();
    wereld.store.insert("facturen", {
      orgId: wereld.orgId,
      klantId: wereld.klantId,
      factuurnummer: "F-1",
      documentStatus: "verzonden",
      betaalStatus: "open",
      status: "verzonden",
      totaalInclBtw: 1210,
      factuurdatum: nu - 45 * DAG,
      verzondenAt: nu - 45 * DAG,
      vervaldatum: nu - 15 * DAG,
    });

    wereld.store.insert("klantBestanden", {
      orgId: wereld.orgId,
      klantId: wereld.klantId,
      soort: "document",
      titel: "Offerte OF-2",
      bron: "offerte",
      timestamp: nu,
    });

    const t = (await handler(dossierTellingen)(wereld.ctx, {
      klantId: wereld.klantId,
    })) as Record<string, unknown>;

    expect(t.openTaken).toBe(2);
    expect(t.eerstvolgendeDeadline).toBe("2026-09-01");
    expect(t.offertesTotaal).toBe(2);
    expect(t.offertesConcept).toBe(1);
    expect(t.openFacturen).toBe(1);
    expect(t.openstaandBedrag).toBe(1210);
    expect(t.factuurOuderDan30).toBe(true);
    expect(t.factuurTeLaat).toBe(true);
    expect(t.bestanden).toBe(1);
    expect(typeof t.klantSinds).toBe("number");
  });
});

// ─── 12. Backfill users.orgId ────────────────────────────────────────────────

/**
 * `migrations/usersOrgBackfill` vult het tenant-stempel voor accounts die er al
 * stonden toen `users.orgId` erbij kwam. Zonder deze run zou de fix uit
 * bevinding 1 bestaande kantooraccounts uit hun eigen selects gooien.
 */
describe("backfillUsersOrg", () => {
  it("stempelt via de medewerkersrij, via de koppeling en via het eigenaarschap", async () => {
    const wereld = bouwWereld();
    const andereOrgId = seedAndereOrganisatie(wereld.store);

    // (a2) alleen bekend via medewerkers.clerkUserId
    wereld.store.insert("medewerkers", {
      orgId: wereld.orgId,
      naam: "Jan Bakker",
      clerkUserId: "clerk_jan",
    });
    const janId = wereld.store.insert(
      "users",
      createMockUser({ clerkId: "clerk_jan", name: "Jan Bakker", role: "medewerker" })
    );

    // (a1) expliciete koppeling naar een medewerkersrij van de buurman
    const bertMedewerker = wereld.store.insert("medewerkers", {
      orgId: andereOrgId,
      naam: "Buurman Bert",
    });
    const bertId = wereld.store.insert(
      "users",
      createMockUser({
        clerkId: "clerk_bert",
        name: "Buurman Bert",
        role: "medewerker",
        linkedMedewerkerId: bertMedewerker,
      })
    );

    // (b) eigenaar van de organisatie
    const elsId = wereld.store.insert(
      "users",
      createMockUser({ clerkId: "clerk_els", name: "Els Eigenaar", role: "directie" })
    );
    wereld.store.patch(andereOrgId, { eigenaarUserId: elsId });

    // Geen enkele koppeling: bewust overslaan, hij krijgt zijn stempel bij login.
    const zwevendId = wereld.store.insert(
      "users",
      createMockUser({ clerkId: "clerk_zwevend", name: "Zwevend Account" })
    );

    const uitkomst = (await handler(backfillUsersOrg)(wereld.ctx, {})) as {
      gestempeld: number;
      overgeslagen: number;
      klaar: boolean;
    };

    expect(uitkomst.gestempeld).toBe(3);
    expect(uitkomst.overgeslagen).toBe(1);
    expect(uitkomst.klaar).toBe(true);
    expect(wereld.store.get(janId)!.orgId).toBe(wereld.orgId);
    expect(wereld.store.get(bertId)!.orgId).toBe(andereOrgId);
    expect(wereld.store.get(elsId)!.orgId).toBe(andereOrgId);
    expect(wereld.store.get(zwevendId)!.orgId).toBeUndefined();
  });

  it("is idempotent: een tweede run stempelt niets meer", async () => {
    const wereld = bouwWereld();
    wereld.store.insert("medewerkers", {
      orgId: wereld.orgId,
      naam: "Jan Bakker",
      clerkUserId: "clerk_jan",
    });
    wereld.store.insert(
      "users",
      createMockUser({ clerkId: "clerk_jan", name: "Jan Bakker", role: "medewerker" })
    );

    await handler(backfillUsersOrg)(wereld.ctx, {});
    const tweede = (await handler(backfillUsersOrg)(wereld.ctx, {})) as {
      gestempeld: number;
      klaar: boolean;
    };

    expect(tweede.gestempeld).toBe(0);
    expect(tweede.klaar).toBe(true);
  });

  it("blijft aflopen als álle resterende accounts worden overgeslagen", async () => {
    // De batchgrens telt stempels, niet bekeken rijen: anders bleef een
    // overgeslagen account voor eeuwig vooraan in de lijst staan.
    const wereld = bouwWereld();
    wereld.store.insert(
      "users",
      createMockUser({ clerkId: "clerk_zwevend_1", name: "Zwevend Een" })
    );
    wereld.store.insert(
      "users",
      createMockUser({ clerkId: "clerk_zwevend_2", name: "Zwevend Twee" })
    );

    const uitkomst = (await handler(backfillUsersOrg)(wereld.ctx, {
      limit: 1,
    })) as { gestempeld: number; overgeslagen: number; klaar: boolean };

    expect(uitkomst.gestempeld).toBe(0);
    expect(uitkomst.overgeslagen).toBe(2);
    expect(uitkomst.klaar).toBe(true);
  });
});
