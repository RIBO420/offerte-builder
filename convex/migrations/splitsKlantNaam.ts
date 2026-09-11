/**
 * Migratie: bestaande `klanten.naam` uiteen in `voornaam` + `achternaam`
 * (klantfeedback Mickey, sep 2026).
 *
 * Mickey vult liever voornaam en achternaam apart in en zoekt op achternaam.
 * De ±460 bestaande klanten hebben alleen een `naam`. Deze migratie vult de
 * twee nieuwe velden aan de hand van `splitsNaam` uit `convex/lib/klantNaam.ts`
 * — dezelfde regel die het formulier gebruikt, dus geen tweede waarheid.
 *
 * Wat de migratie NIET doet:
 * - `naam` aanpassen. Het naam-model is additief: `naam` blijft de leidende
 *   weergavenaam, en de samengestelde naam (voornaam + achternaam) is per
 *   constructie gelijk aan de bron — alleen dubbele spaties vallen weg.
 * - Gokken. Een naam van één woord ("Vries"), een bedrijfsachtige naam
 *   ("Smeets Advocaten") of een klant met een ander klanttype dan
 *   `particulier` blijft ongemoeid en komt als `twijfel` in het rapport, zodat
 *   kantoor die handmatig kan nalopen.
 *
 * Eigenschappen: idempotent (een klant die al een voor- of achternaam heeft
 * wordt overgeslagen) en `dryRun` staat standaard AAN — een run zonder
 * argumenten schrijft dus niets.
 *
 * Twee snelheden, met opzet:
 * - `dryRun: true` loopt in één aanroep over ÁLLE klanten en levert het
 *   complete rapport (`isDone: true`, geen cursor). Alleen lezen, dus die ene
 *   transactie kan dat bij deze tabelgrootte prima aan — en kantoor beoordeelt
 *   zo alle twijfelgevallen vóór er iets geschreven wordt, niet de eerste 100.
 * - `dryRun: false` schrijft 100 klanten per transactie en geeft een
 *   `continueCursor` terug; daarmee start de operator de volgende batch.
 *
 * Draaien (in deze volgorde):
 *   1. npx convex run migrations/splitsKlantNaam:start '{"dryRun":true}'
 *      (één aanroep = alle klanten; `isDone` is altijd true)
 *   2. rapport lezen: klopt `gesplitst`, en zijn de `twijfelVoorbeelden` terecht?
 *      `twijfelVoorbeelden` toont er maximaal 50; `twijfel` is het echte aantal.
 *   3. npx convex run migrations/splitsKlantNaam:start '{"dryRun":false}'
 *   4. Zolang `isDone` false is, de volgende batch starten met de teruggegeven
 *      cursor (elke batch een eigen transactie):
 *      npx convex run migrations/splitsKlantNaam:start '{"dryRun":false,"cursor":"<continueCursor>"}'
 *   5. npx convex run migrations/splitsKlantNaam:verifieerSplitsing
 *      (`aantalTeSplitsen` hoort 0 te zijn; `aantalTwijfel` mag blijven staan)
 */

import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { lijktBedrijfsnaam, splitsNaam, woorden } from "../lib/klantNaam";

const BATCH_SIZE = 100;

/** Hooguit zoveel voorbeelden in het rapport — anders wordt de output onleesbaar. */
const MAX_VOORBEELDEN = 50;

/** Waarom een klant niet gesplitst wordt. Alles behalve `al_gesplitst` is twijfel. */
export type NaamOverslagReden =
  | "al_gesplitst"
  | "ander_klanttype"
  | "te_weinig_woorden"
  | "bedrijfsnaam";

export type NaamBesluit =
  | { actie: "splitsen"; voornaam: string | undefined; achternaam: string }
  | { actie: "overslaan"; reden: NaamOverslagReden };

/** De velden die het besluit nodig heeft; los van Convex, zodat tests puur zijn. */
export type NaamKandidaat = {
  naam: string;
  voornaam?: string;
  achternaam?: string;
  klantType?: Doc<"klanten">["klantType"];
};

function isGevuld(waarde: string | undefined): boolean {
  return (waarde ?? "").trim().length > 0;
}

/**
 * Kern van de migratie voor één klant. Exporteerbaar voor tests.
 *
 * Bewust in deze volgorde: eerst "is hier al werk verricht?" (idempotentie),
 * dan "is dit überhaupt een persoonsnaam?" (twijfel).
 */
export function bepaalNaamSplitsing(klant: NaamKandidaat): NaamBesluit {
  if (isGevuld(klant.voornaam) || isGevuld(klant.achternaam)) {
    return { actie: "overslaan", reden: "al_gesplitst" };
  }

  // Een oud record zonder klanttype is in de praktijk een particulier; alles
  // wat expliciet zakelijk/vve/gemeente/overig is, heeft in `naam` een
  // organisatienaam staan en hoort daar te blijven.
  if (klant.klantType !== undefined && klant.klantType !== "particulier") {
    return { actie: "overslaan", reden: "ander_klanttype" };
  }

  if (woorden(klant.naam).length < 2) {
    return { actie: "overslaan", reden: "te_weinig_woorden" };
  }

  if (lijktBedrijfsnaam(klant.naam)) {
    return { actie: "overslaan", reden: "bedrijfsnaam" };
  }

  const { voornaam, achternaam } = splitsNaam(klant.naam);
  // "van der Berg" levert geen voornaam op — dan schrijven we het veld niet,
  // in plaats van er een lege string in te zetten.
  return { actie: "splitsen", voornaam: voornaam || undefined, achternaam };
}

type Voorbeeld = { klantId: Id<"klanten">; naam: string; reden: NaamOverslagReden };

export const start = internalMutation({
  args: {
    // Paginatie-cursor; leeg laten bij de eerste aanroep, daarna de
    // `continueCursor` uit het vorige rapport meegeven.
    cursor: v.optional(v.union(v.string(), v.null())),
    // Standaard true: een run zonder argumenten rapporteert alleen.
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const dryRun = args.dryRun ?? true;

    let bekeken = 0;
    let gesplitst = 0;
    let alGesplitst = 0;
    let twijfel = 0;
    const twijfelVoorbeelden: Voorbeeld[] = [];

    let cursor: string | null = args.cursor ?? null;

    // Eén batch bij een echte run; bij een dry run loopt deze lus door tot de
    // laatste pagina, zodat het rapport compleet is.
    for (;;) {
      const page = await ctx.db
        .query("klanten")
        .paginate({ cursor, numItems: BATCH_SIZE });

      bekeken += page.page.length;

      for (const klant of page.page) {
        const besluit = bepaalNaamSplitsing(klant);

        if (besluit.actie === "overslaan") {
          if (besluit.reden === "al_gesplitst") {
            alGesplitst++;
            continue;
          }
          twijfel++;
          if (twijfelVoorbeelden.length < MAX_VOORBEELDEN) {
            // Bewust alleen id + naam: genoeg om na te lopen, geen dossier.
            twijfelVoorbeelden.push({
              klantId: klant._id,
              naam: klant.naam,
              reden: besluit.reden,
            });
          }
          continue;
        }

        gesplitst++;
        if (!dryRun) {
          await ctx.db.patch(klant._id, {
            voornaam: besluit.voornaam,
            achternaam: besluit.achternaam,
          });
        }
      }

      if (dryRun && !page.isDone) {
        cursor = page.continueCursor;
        continue;
      }

      const rapport = {
        dryRun,
        bekeken,
        gesplitst,
        alGesplitst,
        twijfel,
        twijfelVoorbeelden,
        isDone: page.isDone,
        continueCursor: page.isDone ? null : page.continueCursor,
      };

      console.log(
        `[Migratie splitsKlantNaam] ${dryRun ? "Dry run over alle klanten" : "Batch verwerkt"}: ` +
          `${bekeken} bekeken, ${gesplitst} gesplitst, ${alGesplitst} al gesplitst, ` +
          `${twijfel} twijfel` +
          (page.isDone ? " — KLAAR" : " — herhalen met continueCursor")
      );

      return rapport;
    }
  },
});

/**
 * Verificatie: hoeveel klanten wachten nog op een splitsing, en hoeveel
 * blijven met opzet ongesplitst (twijfel)?
 */
export const verifieerSplitsing = internalQuery({
  args: {},
  handler: async (ctx) => {
    const klanten = await ctx.db.query("klanten").collect();

    let aantalGesplitst = 0;
    let aantalTeSplitsen = 0;
    let aantalTwijfel = 0;

    for (const klant of klanten) {
      const besluit = bepaalNaamSplitsing(klant);
      if (besluit.actie === "splitsen") aantalTeSplitsen++;
      else if (besluit.reden === "al_gesplitst") aantalGesplitst++;
      else aantalTwijfel++;
    }

    return {
      totaalKlanten: klanten.length,
      aantalGesplitst,
      aantalTeSplitsen,
      aantalTwijfel,
    };
  },
});
