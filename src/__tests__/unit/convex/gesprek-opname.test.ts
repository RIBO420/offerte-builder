/**
 * De opnameketen aan de serverkant (klantdossier v7, WS5).
 *
 * Twee harde afspraken uit de klantbriefing staan of vallen met deze test, en
 * allebei gaan ze over audio die er wél of juist níét meer mag zijn:
 *
 * 1. **Gelukte transcriptie → audio weg.** De tekst ís dan het gesprek; de
 *    opname wordt bij het vastleggen verwijderd en het `audioId` blijft leeg.
 * 2. **Mislukte transcriptie → audio blijft.** Dan is de opname het enige wat
 *    er nog van het gesprek is; hij hoort bij de entry te blijven staan zodat
 *    het gesprek alsnog handmatig uitgewerkt kan worden. Nooit stil weggooien.
 *
 * Plus het sluitstuk daarvan: een GDPR-verwijderverzoek haalt óók die bewaarde
 * opnames weg (vastgelegd punt 4). Een geanonimiseerde klant met haar stem nog
 * in de storage is precies wat dat verzoek moest voorkomen.
 */

import { describe, it, expect, vi } from "vitest";
import {
  MockConvexStore,
  createMockCtx,
  createMockUser,
  createMockKlant,
  seedMockOrganisatie,
} from "../../helpers/convex-mock";
import { legGesprekVast } from "../../../../convex/tijdlijn";
import { gdprAnonymize } from "../../../../convex/klanten";

type AnyHandler = (ctx: unknown, args: unknown) => Promise<unknown>;

/** Convex registreert de handler op de functie zelf (func._handler). */
function handler(fn: unknown): AnyHandler {
  return (fn as { _handler: AnyHandler })._handler;
}

/**
 * De mock-ctx uit de helper kent geen storage — die heeft alleen dit
 * werkstroompje nodig. `delete` is een spion, want "is de audio opgeruimd?"
 * is precies de vraag die hier beantwoord moet worden.
 */
function opzet(role = "directie") {
  const store = new MockConvexStore();
  // Zie gesprek-vastleggen.test.ts: org-scope hoort in elke fixture.
  const orgId = seedMockOrganisatie(store);
  const userId = store.insert("users", createMockUser({ role }));
  const klantId = store.insert("klanten", createMockKlant(userId, { orgId }));
  const verwijderd = vi.fn(async () => {});
  const ctx = {
    ...createMockCtx(store),
    storage: { delete: verwijderd },
  };
  return { ctx, store, userId, klantId, verwijderd };
}

const AUDIO_ID = "_storage:opname-1";

describe("legGesprekVast: wat er met de opname gebeurt", () => {
  it("verwijdert de audio zodra de transcriptie is vastgelegd", async () => {
    const { ctx, store, klantId, verwijderd } = opzet();

    await handler(legGesprekVast)(ctx, {
      klantId,
      kanaal: "telefoon",
      tekst: "Mevrouw wil doorgaan met het schetsontwerp.",
      taken: [],
      opnameDuurSec: 96,
      audioId: AUDIO_ID,
      transcriptieStatus: "gelukt",
    });

    // De opname zelf is weg; alleen de uitgewerkte tekst blijft.
    expect(verwijderd).toHaveBeenCalledTimes(1);
    expect(verwijderd).toHaveBeenCalledWith(AUDIO_ID);

    const entry = store.getAll("klantTijdlijn")[0];
    expect(entry.tekst).toBe("Mevrouw wil doorgaan met het schetsontwerp.");
    expect(entry.opnameDuurSec).toBe(96);
    expect(entry.transcriptieStatus).toBe("gelukt");
    // Een id van een verwijderd bestand bewaren is een gebroken verwijzing.
    expect(entry.audioId).toBeUndefined();
    // Een opname is altijd een telefoongesprek.
    expect(entry.kanaal).toBe("telefoon");
  });

  it("bewaart de audio als de transcriptie mislukt is", async () => {
    const { ctx, store, klantId, verwijderd } = opzet();

    await handler(legGesprekVast)(ctx, {
      klantId,
      kanaal: "telefoon",
      tekst: "Zelf uitgetypt: mevrouw belde over de vlonder.",
      taken: [{ titel: "Offerte vlonder versturen" }],
      opnameDuurSec: 312,
      audioId: AUDIO_ID,
      transcriptieStatus: "mislukt",
    });

    // Niets weggegooid: de opname is het enige wat er nog van het gesprek is.
    expect(verwijderd).not.toHaveBeenCalled();

    const entry = store.getAll("klantTijdlijn")[0];
    expect(entry.audioId).toBe(AUDIO_ID);
    expect(entry.transcriptieStatus).toBe("mislukt");
    expect(entry.opnameDuurSec).toBe(312);
    // De handmatige route werkt verder gewoon: taken komen er nog uit.
    expect(store.getAll("klantTaken")).toHaveLength(1);
  });

  it("laat een gesprek zónder opname precies zoals het was", async () => {
    const { ctx, store, klantId, verwijderd } = opzet();

    await handler(legGesprekVast)(ctx, {
      klantId,
      kanaal: "email",
      tekst: "Mail met de foto's doorgestuurd.",
      taken: [],
    });

    expect(verwijderd).not.toHaveBeenCalled();
    const entry = store.getAll("klantTijdlijn")[0];
    expect(entry.opnameDuurSec).toBeUndefined();
    expect(entry.audioId).toBeUndefined();
    expect(entry.transcriptieStatus).toBeUndefined();
  });

  it("legt het gesprek ook vast als het opruimen van de audio faalt", async () => {
    const { ctx, store, klantId } = opzet();
    ctx.storage.delete = vi.fn(async () => {
      throw new Error("storage tijdelijk onbereikbaar");
    });

    await expect(
      handler(legGesprekVast)(ctx, {
        klantId,
        kanaal: "telefoon",
        tekst: "Uitgewerkt gesprek.",
        taken: [],
        opnameDuurSec: 42,
        audioId: AUDIO_ID,
        transcriptieStatus: "gelukt",
      })
    ).resolves.toBeDefined();

    // De entry stond er al: een mislukte opruiming mag hem niet terugdraaien.
    expect(store.getAll("klantTijdlijn")).toHaveLength(1);
  });
});

describe("gdprAnonymize: opnames vallen onder het verwijderverzoek", () => {
  it("verwijdert bewaarde audio en maakt het veld leeg", async () => {
    const { ctx, store, userId, klantId, verwijderd } = opzet();

    const metOpname = store.insert("klantTijdlijn", {
      userId,
      klantId,
      timestamp: Date.now(),
      auteurNaam: "Test User",
      kanaal: "telefoon",
      eventType: "handmatig",
      tekst: "Telefoongesprek, transcriptie mislukt.",
      audioId: AUDIO_ID,
      transcriptieStatus: "mislukt",
      opnameDuurSec: 120,
      createdAt: Date.now(),
    });
    const zonderOpname = store.insert("klantTijdlijn", {
      userId,
      klantId,
      timestamp: Date.now(),
      auteurNaam: "Test User",
      kanaal: "email",
      eventType: "handmatig",
      tekst: "Mail over de bestrating.",
      createdAt: Date.now(),
    });

    await handler(gdprAnonymize)(ctx, { id: klantId });

    expect(verwijderd).toHaveBeenCalledTimes(1);
    expect(verwijderd).toHaveBeenCalledWith(AUDIO_ID);

    const opgeruimd = store.get(metOpname);
    expect(opgeruimd?.audioId).toBeUndefined();
    expect(opgeruimd?.transcriptieStatus).toBeUndefined();
    // De tekst blijft: die is het dossier, en de klantnaam is elders al weg.
    expect(opgeruimd?.tekst).toBe("Telefoongesprek, transcriptie mislukt.");
    // Duur is geen persoonsgegeven en blijft de regel duiden.
    expect(opgeruimd?.opnameDuurSec).toBe(120);

    // Een entry zonder opname wordt niet aangeraakt.
    expect(store.get(zonderOpname)?.tekst).toBe("Mail over de bestrating.");
    expect(store.get(klantId)?.naam).toBe("Geanonimiseerd");
  });

  it("gaat door als een opname al uit de storage verdwenen is", async () => {
    const { ctx, store, userId, klantId } = opzet();
    ctx.storage.delete = vi.fn(async () => {
      throw new Error("bestand bestaat niet meer");
    });

    const entryId = store.insert("klantTijdlijn", {
      userId,
      klantId,
      timestamp: Date.now(),
      auteurNaam: "Test User",
      kanaal: "telefoon",
      eventType: "handmatig",
      tekst: "Oud gesprek.",
      audioId: AUDIO_ID,
      transcriptieStatus: "mislukt",
      createdAt: Date.now(),
    });

    await expect(
      handler(gdprAnonymize)(ctx, { id: klantId })
    ).resolves.toMatchObject({ success: true });

    // Het verzoek is uitgevoerd: verwijzing weg, klant geanonimiseerd.
    expect(store.get(entryId)?.audioId).toBeUndefined();
    expect(store.get(klantId)?.gdprAnonymized).toBe(true);
  });
});
