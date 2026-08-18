/**
 * `tijdlijn.legGesprekVast` — het gesprekslog met taakherkenning
 * (klantdossier v7, WS4).
 *
 * Wat hier vastligt is precies wat er mis kan gaan zodra twee tabellen in één
 * handeling geschreven worden:
 *
 * 1. Entry én taken staan er samen in, met de koppeling aan beide kanten
 *    (`gekoppeldeTaakIds` op de entry, `bronTijdlijnId` op elke taak).
 * 2. Het taken-loze pad ("Alleen gesprek vastleggen") schrijft een entry
 *    zonder ook maar één taak — en zonder een lege `gekoppeldeTaakIds`.
 * 3. Toegang: schrijven op de tijdlijn is kantoorwerk. De klant-rol krijgt
 *    een AuthError, en er blijft niets achter in de database.
 *
 * De taken komen altijd van de gebruiker: `gesprekAnalyse.analyseer` doet
 * alleen vóórstellen en wordt hier dus met opzet niet aangeroepen.
 */

import { describe, it, expect } from "vitest";
import {
  MockConvexStore,
  createMockCtx,
  createMockUser,
  createMockKlant,
  seedMockOrganisatie,
} from "../../helpers/convex-mock";
import { AuthError } from "../../../../convex/auth";
import { legGesprekVast } from "../../../../convex/tijdlijn";

type AnyHandler = (ctx: unknown, args: unknown) => Promise<unknown>;

/** Convex registreert de handler op de functie zelf (func._handler). */
function handler(fn: unknown): AnyHandler {
  return (fn as { _handler: AnyHandler })._handler;
}

function opzet(role = "directie", extra: Record<string, unknown> = {}) {
  const store = new MockConvexStore();
  // Sinds fase 3 van de org-migratie is orgId de tenant-scope; zonder deze
  // organisatie-rij gooit requireOrg voordat de handler iets kan doen.
  const orgId = seedMockOrganisatie(store);
  const userId = store.insert("users", createMockUser({ role, ...extra }));
  const ctx = createMockCtx(store);
  const klantId = store.insert("klanten", createMockKlant(userId, { orgId }));
  return { ctx, store, userId, klantId, orgId };
}

describe("legGesprekVast: entry en taken in één handeling", () => {
  it("schrijft de entry én de aangevinkte taken, gekoppeld aan beide kanten", async () => {
    const { ctx, store, userId, klantId } = opzet();

    const uitkomst = (await handler(legGesprekVast)(ctx, {
      klantId,
      kanaal: "telefoon",
      tekst: "Mevrouw wil een schetsontwerp zien.",
      taken: [
        { titel: "Terugbellen over ontwerp", deadline: "2026-08-25" },
        { titel: "Offerte vlonder versturen" },
      ],
    })) as { entryId: string; taakIds: string[] };

    const entries = store.getAll("klantTijdlijn");
    const taken = store.getAll("klantTaken");

    expect(entries).toHaveLength(1);
    expect(taken).toHaveLength(2);
    expect(uitkomst.taakIds).toHaveLength(2);

    // Heen: de entry weet welke taken eruit zijn gekomen.
    expect(entries[0].gekoppeldeTaakIds).toEqual(uitkomst.taakIds);
    // Terug: elke taak weet uit welk gesprek hij komt.
    for (const taak of taken) {
      expect(taak.bronTijdlijnId).toBe(uitkomst.entryId);
      expect(taak.klantId).toBe(klantId);
      expect(taak.status).toBe("open");
      expect(taak.prioriteit).toBe("normaal");
      expect(taak.aangemaaktDoorId).toBe(userId);
    }

    expect(taken[0].titel).toBe("Terugbellen over ontwerp");
    expect(taken[0].deadline).toBe("2026-08-25");
    // Geen deadline meegegeven blijft leeg — niet een lege string.
    expect(taken[1].deadline).toBeUndefined();

    expect(entries[0].kanaal).toBe("telefoon");
    expect(entries[0].eventType).toBe("handmatig");
    expect(entries[0].auteurNaam).toBe("Test User");
  });

  it("legt een afspraak vast met een eigen eventType op kanaal intern", async () => {
    const { ctx, store, klantId } = opzet();

    await handler(legGesprekVast)(ctx, {
      klantId,
      kanaal: "intern",
      eventType: "afspraak",
      tekst: "Langsgeweest om de achtertuin op te meten.",
      taken: [],
    });

    const entry = store.getAll("klantTijdlijn")[0];
    expect(entry.kanaal).toBe("intern");
    // Zonder dit onderscheid is een bezoek later niet terug te vinden tussen
    // de losse interne notities — die delen hetzelfde kanaal.
    expect(entry.eventType).toBe("afspraak");
  });

  it("laat het taken-loze pad een kale entry achter", async () => {
    const { ctx, store, klantId } = opzet();

    const uitkomst = (await handler(legGesprekVast)(ctx, {
      klantId,
      kanaal: "email",
      tekst: "Mail met de foto's van de bestrating doorgestuurd.",
      taken: [],
    })) as { entryId: string; taakIds: string[] };

    expect(uitkomst.taakIds).toEqual([]);
    expect(store.getAll("klantTaken")).toHaveLength(0);
    const entry = store.getAll("klantTijdlijn")[0];
    // Geen lege array: "heeft dit gesprek taken opgeleverd?" blijft één check.
    expect(entry.gekoppeldeTaakIds).toBeUndefined();
  });

  it("slaat lege titels over in plaats van lege taken aan te maken", async () => {
    const { ctx, store, klantId } = opzet();

    await handler(legGesprekVast)(ctx, {
      klantId,
      kanaal: "telefoon",
      tekst: "Kort telefoontje.",
      taken: [{ titel: "   " }, { titel: "Offerte nabellen" }],
    });

    const taken = store.getAll("klantTaken");
    expect(taken).toHaveLength(1);
    expect(taken[0].titel).toBe("Offerte nabellen");
  });

  it("weigert een gesprek zonder tekst", async () => {
    const { ctx, store, klantId } = opzet();

    await expect(
      handler(legGesprekVast)(ctx, {
        klantId,
        kanaal: "telefoon",
        tekst: "   ",
        taken: [{ titel: "Terugbellen" }],
      })
    ).rejects.toThrow();

    expect(store.getAll("klantTijdlijn")).toHaveLength(0);
    expect(store.getAll("klantTaken")).toHaveLength(0);
  });

  it("weigert een deadline in een ander formaat dan JJJJ-MM-DD", async () => {
    const { ctx, klantId } = opzet();

    await expect(
      handler(legGesprekVast)(ctx, {
        klantId,
        kanaal: "telefoon",
        tekst: "Terugbellen volgende week.",
        taken: [{ titel: "Terugbellen", deadline: "25-08-2026" }],
      })
    ).rejects.toThrow();
  });
});

describe("legGesprekVast: toegang (PRD §1.2)", () => {
  it("gooit AuthError voor de klant-rol en schrijft niets", async () => {
    const { ctx, store, klantId } = opzet("klant", {
      linkedKlantId: "klanten:1",
    });

    await expect(
      handler(legGesprekVast)(ctx, {
        klantId,
        kanaal: "telefoon",
        tekst: "poging",
        taken: [{ titel: "Terugbellen" }],
      })
    ).rejects.toThrow(AuthError);

    expect(store.getAll("klantTijdlijn")).toHaveLength(0);
    expect(store.getAll("klantTaken")).toHaveLength(0);
  });

  it("weigert ook voorman en medewerker — schrijven is kantoorwerk", async () => {
    for (const rol of ["voorman", "medewerker"]) {
      const { ctx, store, klantId } = opzet(rol);

      await expect(
        handler(legGesprekVast)(ctx, {
          klantId,
          kanaal: "telefoon",
          tekst: "poging",
          taken: [],
        })
      ).rejects.toThrow(AuthError);

      expect(store.getAll("klantTijdlijn")).toHaveLength(0);
      expect(store.getAll("klantTaken")).toHaveLength(0);
    }
  });

  it("accepteert projectleider naast directie", async () => {
    const { ctx, store, klantId } = opzet("projectleider");

    await handler(legGesprekVast)(ctx, {
      klantId,
      kanaal: "telefoon",
      tekst: "Klant belde over de heg.",
      taken: [{ titel: "Heg inplannen" }],
    });

    expect(store.getAll("klantTijdlijn")).toHaveLength(1);
    expect(store.getAll("klantTaken")).toHaveLength(1);
  });
});
