/**
 * Migratie: tweede telefoonnummer uit `klanten.notities` naar `klanten.telefoon2`
 * (klantfeedback Mickey, sep 2026).
 *
 * De relatie-import had geen veld voor een tweede nummer en parkeerde het daarom
 * als losse regel in de notities:
 *
 *     Tweede telefoonnummer: 0612345678
 *
 * Sinds `klanten.telefoon2` bestaat, schrijft `importKlanten` daarnaartoe. Deze
 * migratie haalt de geparkeerde nummers alsnog uit de notities: nummer naar
 * `telefoon2` (opnieuw door `normaliseerImportTelefoon`, dezelfde regel als de
 * import), regel weg uit `notities`, en is er daarna niets meer over, dan wordt
 * het notitieveld gewist.
 *
 * Voorzichtig waar het moet:
 * - Heeft de klant al een `telefoon2`? Dan blijft alles zoals het is — het veld
 *   dat kantoor zelf invulde wint van een regel uit een oude import.
 * - Levert de regel geen bruikbaar nummer op ("Tweede telefoonnummer: onbekend"),
 *   dan blijft de notitie staan en komt de klant in het rapport.
 * - Staan er meerdere van deze regels, dan verhuist alleen de eerste bruikbare;
 *   de rest blijft leesbaar in de notities staan en wordt geteld.
 *
 * Eigenschappen: gebatcht (100 per transactie), idempotent (na de verhuizing is
 * er geen regel meer te vinden) en `dryRun` staat standaard AAN — een run zonder
 * argumenten schrijft dus niets.
 *
 * Draaien (in deze volgorde):
 *   1. npx convex run migrations/telefoon2UitNotities:start '{"dryRun":true}'
 *   2. rapport lezen: klopt `verplaatst`, en zijn de `ongeldigeVoorbeelden` terecht?
 *   3. npx convex run migrations/telefoon2UitNotities:start '{"dryRun":false}'
 *   4. Zolang `isDone` false is, de volgende batch starten met de teruggegeven
 *      cursor (elke batch een eigen transactie):
 *      npx convex run migrations/telefoon2UitNotities:start '{"dryRun":false,"cursor":"<continueCursor>"}'
 *   5. npx convex run migrations/telefoon2UitNotities:verifieerTelefoon2
 *      (`aantalTeVerplaatsen` hoort 0 te zijn; `aantalOngeldig` mag blijven staan)
 */

import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { normaliseerImportTelefoon } from "../validators";

const BATCH_SIZE = 100;

/** Hooguit zoveel voorbeelden in het rapport — anders wordt de output onleesbaar. */
const MAX_VOORBEELDEN = 50;

/** Exact de tekst die `importKlanten` in de notities schreef. */
export const TELEFOON2_NOTITIE_PREFIX = "Tweede telefoonnummer:";

export type Telefoon2Besluit =
  | {
      actie: "verplaatsen";
      telefoon2: string;
      /** De notities zonder de verhuisde regel; `undefined` = veld wissen. */
      notities: string | undefined;
      /** Hoeveel "Tweede telefoonnummer"-regels er blijven staan. */
      resterendeRegels: number;
    }
  | { actie: "overslaan"; reden: "geen_regel" | "al_telefoon2" | "ongeldig_nummer" };

/** De velden die het besluit nodig heeft; los van Convex, zodat tests puur zijn. */
export type Telefoon2Kandidaat = {
  notities?: string;
  telefoon2?: string;
};

/** Staat er op deze regel een geparkeerd tweede nummer? Zo ja: welk stuk tekst? */
function nummerTekst(regel: string): string | undefined {
  const kaal = regel.trim();
  return kaal.startsWith(TELEFOON2_NOTITIE_PREFIX)
    ? kaal.slice(TELEFOON2_NOTITIE_PREFIX.length)
    : undefined;
}

/**
 * Kern van de migratie voor één klant. Exporteerbaar voor tests.
 */
export function bepaalTelefoon2Migratie(klant: Telefoon2Kandidaat): Telefoon2Besluit {
  const regels = (klant.notities ?? "").split(/\r?\n/);
  const kandidaten = regels
    .map((regel, index) => ({ index, tekst: nummerTekst(regel) }))
    .filter((kandidaat): kandidaat is { index: number; tekst: string } =>
      kandidaat.tekst !== undefined
    );

  if (kandidaten.length === 0) return { actie: "overslaan", reden: "geen_regel" };

  // Wat kantoor zelf invulde blijft staan; de notitieregel blijft dan ook staan.
  if ((klant.telefoon2 ?? "").trim()) {
    return { actie: "overslaan", reden: "al_telefoon2" };
  }

  const bruikbaar = kandidaten
    .map((kandidaat) => ({
      index: kandidaat.index,
      nummer: normaliseerImportTelefoon(kandidaat.tekst),
    }))
    .find((kandidaat): kandidaat is { index: number; nummer: string } =>
      kandidaat.nummer !== undefined
    );

  if (!bruikbaar) return { actie: "overslaan", reden: "ongeldig_nummer" };

  const rest = regels.filter((_, index) => index !== bruikbaar.index);
  const overgebleven = rest.join("\n").trim();

  return {
    actie: "verplaatsen",
    telefoon2: bruikbaar.nummer,
    notities: overgebleven || undefined,
    resterendeRegels: kandidaten.length - 1,
  };
}

type Voorbeeld = { klantId: Id<"klanten">; naam: string };

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

    const page = await ctx.db
      .query("klanten")
      .paginate({ cursor: args.cursor ?? null, numItems: BATCH_SIZE });

    let verplaatst = 0;
    let geenRegel = 0;
    let alTelefoon2 = 0;
    let ongeldig = 0;
    let regelsBlijvenStaan = 0;
    const ongeldigeVoorbeelden: Voorbeeld[] = [];

    for (const klant of page.page) {
      const besluit = bepaalTelefoon2Migratie(klant);

      if (besluit.actie === "overslaan") {
        if (besluit.reden === "geen_regel") geenRegel++;
        else if (besluit.reden === "al_telefoon2") alTelefoon2++;
        else {
          ongeldig++;
          if (ongeldigeVoorbeelden.length < MAX_VOORBEELDEN) {
            // Bewust alleen id + naam: genoeg om na te lopen, geen dossier.
            ongeldigeVoorbeelden.push({ klantId: klant._id, naam: klant.naam });
          }
        }
        continue;
      }

      verplaatst++;
      regelsBlijvenStaan += besluit.resterendeRegels;
      if (!dryRun) {
        await ctx.db.patch(klant._id, {
          telefoon2: besluit.telefoon2,
          notities: besluit.notities,
        });
      }
    }

    const rapport = {
      dryRun,
      batchGrootte: page.page.length,
      verplaatst,
      geenRegel,
      alTelefoon2,
      ongeldig,
      ongeldigeVoorbeelden,
      regelsBlijvenStaan,
      isDone: page.isDone,
      continueCursor: page.isDone ? null : page.continueCursor,
    };

    console.log(
      `[Migratie telefoon2UitNotities] Batch verwerkt${dryRun ? " (dry run)" : ""}: ` +
        `${verplaatst} verplaatst, ${alTelefoon2} had al een telefoon2, ${ongeldig} ongeldig, ` +
        `${geenRegel} zonder regel` +
        (page.isDone ? " — KLAAR" : " — herhalen met continueCursor")
    );

    return rapport;
  },
});

/**
 * Verificatie: hoeveel klanten hebben nog een geparkeerd nummer in de notities?
 */
export const verifieerTelefoon2 = internalQuery({
  args: {},
  handler: async (ctx) => {
    const klanten = await ctx.db.query("klanten").collect();

    let aantalTeVerplaatsen = 0;
    let aantalOngeldig = 0;
    let aantalRegelMetTelefoon2 = 0;

    for (const klant of klanten) {
      const besluit = bepaalTelefoon2Migratie(klant);
      if (besluit.actie === "verplaatsen") aantalTeVerplaatsen++;
      else if (besluit.reden === "ongeldig_nummer") aantalOngeldig++;
      else if (besluit.reden === "al_telefoon2") aantalRegelMetTelefoon2++;
    }

    return {
      totaalKlanten: klanten.length,
      aantalMetTelefoon2: klanten.filter((k) => (k.telefoon2 ?? "").trim()).length,
      aantalTeVerplaatsen,
      aantalOngeldig,
      aantalRegelMetTelefoon2,
    };
  },
});
