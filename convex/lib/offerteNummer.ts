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
 * De teller hoort bij de ORGANISATIE, niet bij de gebruiker. Op `by_user`
 * ging het twee kanten op mis: een medewerker zonder eigen instellingen-rij
 * kon geen offerte aanmaken ("Instellingen niet gevonden"), en zodra twee
 * collega's elk wél een rij hadden telden ze onafhankelijk door — dan geven
 * twee mensen in hetzelfde bedrijf hetzelfde offertenummer uit.
 *
 * `.unique()` op by_org is bewust hard: twéé tellers binnen één organisatie is
 * precies het probleem dat we hier oplossen, en dat mag niet stilletjes
 * "de eerste de beste" worden.
 *
 * Slaat nummers over die al binnen deze organisatie in gebruik zijn (import,
 * handmatig nummer, gewijzigde prefix).
 */
export async function reserveerOfferteNummer(
  ctx: MutationCtx,
  orgId: Id<"organisaties">
): Promise<string> {
  const settings = await ctx.db
    .query("instellingen")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
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
    // by_nummer is bedrijfsoverstijgend; nummers zijn per organisatie uniek.
    // Zonder dit org-filter (zelfde post-filter als offertes.getByNummer)
    // zou het nummer van een ánder bedrijf ons doen doortellen.
    const treffers = await ctx.db
      .query("offertes")
      .withIndex("by_nummer", (q) => q.eq("offerteNummer", offerteNummer))
      .collect();
    const bestaand = treffers.find(
      (o) => o.orgId?.toString() === orgId.toString()
    );
    if (!bestaand) break;
  }

  await ctx.db.patch(settings._id, { laatsteOfferteNummer: volgnummer });

  return offerteNummer;
}
