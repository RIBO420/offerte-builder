/**
 * Factuurnummer uitgeven uit de reeks van de organisatie (HERO-nabouw).
 * Eén plek voor de teller; het formaat komt uit lib/documentNummer.ts.
 * Creditnota's delen de teller met facturen.
 */

import { ConvexError } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { formatteerFactuurNummer } from "./documentNummer";

export async function reserveerFactuurNummer(
  ctx: MutationCtx,
  orgId: Id<"organisaties">,
  soort: "factuur" | "creditnota" = "factuur"
): Promise<string> {
  const instellingen = await ctx.db
    .query("instellingen")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .unique();
  if (!instellingen) {
    throw new ConvexError("Instellingen niet gevonden. Configureer eerst je bedrijfsgegevens.");
  }
  const volgnummer = (instellingen.laatsteFactuurNummer ?? 0) + 1;
  await ctx.db.patch(instellingen._id, { laatsteFactuurNummer: volgnummer });
  return formatteerFactuurNummer(instellingen, volgnummer, new Date().getFullYear(), soort);
}

/**
 * Een conceptfactuur heeft nog geen nummer (HERO: "0xxxx"). Het nummer komt
 * pas bij definitief maken of versturen, zodat de reeks geen gaten krijgt
 * door concepten die nooit verstuurd worden.
 */
export const CONCEPT_FACTUURNUMMER = "Concept";

export function heeftFactuurNummer(factuurnummer: string): boolean {
  return factuurnummer !== CONCEPT_FACTUURNUMMER;
}

/** Geeft een concept zijn nummer; een factuur met nummer blijft ongemoeid. */
export async function geefFactuurNummerUit(
  ctx: MutationCtx,
  factuur: Doc<"facturen">
): Promise<Doc<"facturen">> {
  if (heeftFactuurNummer(factuur.factuurnummer)) return factuur;
  const factuurnummer = await reserveerFactuurNummer(
    ctx,
    factuur.orgId,
    factuur.isCreditnota ? "creditnota" : "factuur"
  );
  await ctx.db.patch(factuur._id, { factuurnummer });
  return { ...factuur, factuurnummer };
}
