/**
 * Offertenummer reserveren — server-side, binnen dezelfde mutation als de
 * insert (masterplan offerte-entree, A6).
 *
 * Het nummer werd client-side opgehaald (`instellingen.getNextOfferteNummer`)
 * en daarna als argument meegestuurd naar `offertes.create`. Tussen die twee
 * calls zit netwerklatency: twee tabbladen (of de nieuwe, snellere entree)
 * konden hetzelfde nummer krijgen, of een nummer opbranden zonder offerte.
 * Convex serialiseert mutations, dus reserveren *binnen* de create-mutation is
 * race-vrij: de tweede transactie ziet de opgehoogde teller.
 */

import { MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import { ConvexError } from "convex/values";

export function formatteerOfferteNummer(
  prefix: string,
  jaar: number,
  volgnummer: number
): string {
  return `${prefix}${jaar}-${String(volgnummer).padStart(3, "0")}`;
}

/**
 * Hoogt de teller in `instellingen` op en geeft het nieuwe nummer terug.
 *
 * Slaat nummers over die al in gebruik zijn: `offertes.getByNummer` doet een
 * `.unique()` op de by_nummer-index, dus een dubbel nummer zou daar knallen.
 */
export async function reserveerOfferteNummer(
  ctx: MutationCtx,
  userId: Id<"users">
): Promise<string> {
  const settings = await ctx.db
    .query("instellingen")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();

  if (!settings) {
    throw new ConvexError("Instellingen niet gevonden");
  }

  const jaar = new Date().getFullYear();
  let volgnummer = settings.laatsteOfferteNummer;
  let offerteNummer = "";

  // Maximaal een paar pogingen: alleen nodig als er al offertes met dat nummer
  // bestaan (import, handmatig nummer, andere prefix-instelling).
  for (let poging = 0; poging < 50; poging++) {
    volgnummer += 1;
    offerteNummer = formatteerOfferteNummer(
      settings.offerteNummerPrefix,
      jaar,
      volgnummer
    );
    const bestaand = await ctx.db
      .query("offertes")
      .withIndex("by_nummer", (q) => q.eq("offerteNummer", offerteNummer))
      .first();
    if (!bestaand) break;
  }

  await ctx.db.patch(settings._id, { laatsteOfferteNummer: volgnummer });

  return offerteNummer;
}
