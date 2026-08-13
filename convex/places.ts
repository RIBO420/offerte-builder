/**
 * Bedrijfszoeken via Google Places (TT-006) — Convex-actions.
 *
 * De API-sleutel blijft hier server-side: de client krijgt hem nooit te zien.
 * Dat is niet alleen netjes, het is ook nodig — dezelfde sleutel doet de
 * (betaalde) Distance Matrix-calls voor de dagkaart.
 *
 * Zonder `GOOGLE_MAPS_API_KEY` geven beide functies gewoon leeg terug; het
 * formulier blijft dan handmatig werken (zie `beschikbaar`).
 */

import { v, ConvexError } from "convex/values";
import { action, type ActionCtx } from "./_generated/server";
import { api } from "./_generated/api";
import { checkPlacesRateLimit } from "./security";
import {
  haalPlaatsDetails,
  zoekPlaatsen,
  type FetchLike,
} from "./placesLogica";

/** Vertelt de UI of het zoekveld iets te bieden heeft. */
export const beschikbaar = action({
  args: {},
  handler: async (): Promise<boolean> => {
    return Boolean(process.env.GOOGLE_MAPS_API_KEY);
  },
});

/**
 * Een action heeft geen `ctx.db`, dus de rolcheck loopt via een query.
 * Klantaccounts mogen hier niet bij: zij zien dit formulier nooit, en elke
 * aanroep kost geld op de sleutel van de app-eigenaar.
 */
async function bewaakToegang(ctx: ActionCtx) {
  const identiteit = await ctx.auth.getUserIdentity();
  if (!identiteit) {
    throw new ConvexError("Niet ingelogd");
  }

  const rol = await ctx.runQuery(api.roles.getCurrentUserRole, {});
  if (!rol || rol.isKlant) {
    throw new ConvexError("Geen toegang tot bedrijfszoeken");
  }

  const limiet = checkPlacesRateLimit(identiteit.subject);
  if (!limiet.allowed) {
    throw new ConvexError(
      "Te veel zoekopdrachten achter elkaar. Probeer het over een minuut opnieuw."
    );
  }
}

export const zoek = action({
  args: {
    invoer: v.string(),
    sessionToken: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args
  ): Promise<Array<{ placeId: string; hoofdtekst: string; subtekst: string }>> => {
    await bewaakToegang(ctx);

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) return [];

    return await zoekPlaatsen(args.invoer, {
      apiKey,
      fetchFn: fetch as unknown as FetchLike,
      sessionToken: args.sessionToken,
    });
  },
});

export const details = action({
  args: {
    placeId: v.string(),
    sessionToken: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    naam: string;
    adres: string;
    postcode: string;
    plaats: string;
    telefoon?: string;
    website?: string;
  } | null> => {
    await bewaakToegang(ctx);

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) return null;

    return await haalPlaatsDetails(args.placeId, {
      apiKey,
      fetchFn: fetch as unknown as FetchLike,
      sessionToken: args.sessionToken,
    });
  },
});
