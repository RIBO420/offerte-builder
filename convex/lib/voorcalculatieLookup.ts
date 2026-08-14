/**
 * Voorcalculatie opzoeken bij een project of offerte.
 *
 * Het probleem dat dit oplost: sinds de werkitem-generalisatie (B1) is
 * `projecten.offerteId` optioneel. Op tientallen plekken stond
 *
 *     .withIndex("by_offerte", (q) => q.eq("offerteId", project.offerteId))
 *     .unique()
 *
 * Bij een werkitem zonder offerte wordt dat `q.eq("offerteId", undefined)`, en
 * dat is géén lege zoekopdracht: het matcht ELKE voorcalculatie die zelf geen
 * offerteId heeft — dus alle voorcalculaties die rechtstreeks op een project
 * zijn gemaakt. Zodra er twee van die projecten bestaan gooit `.unique()`:
 *
 *     unique() query returned more than one result from table voorcalculaties
 *
 * Dat is geen datacorruptie maar een queryfout: de twee documenten horen bij
 * verschillende projecten. De projectdetailpagina, planning, nacalculatie,
 * projectkosten, archief, dashboard, analytics en rapportages liepen er allemaal
 * op stuk.
 *
 * Deze helpers doen twee dingen:
 *  1. een ontbrekende `offerteId` betekent "niets te zoeken" → `null`;
 *  2. bij meerdere treffers wordt de nieuwste gekozen in plaats van te gooien.
 *     Een leesquery mag nooit een scherm slopen om een dubbele rij.
 */

import type { GenericDatabaseReader } from "convex/server";
import type { DataModel, Doc, Id } from "../_generated/dataModel";

/** Minimale ctx-vorm; een MutationCtx voldoet ook (writer extends reader). */
type LeesbareCtx = { db: GenericDatabaseReader<DataModel> };

/** Het project zoals deze helpers het nodig hebben. */
type ProjectRef = {
  _id: Id<"projecten">;
  offerteId?: Id<"offertes">;
};

/**
 * De voorcalculatie die rechtstreeks aan dit project hangt (legacy/gekopieerd).
 * Bij meerdere treffers wint de nieuwste.
 */
export async function voorcalculatieVanProject(
  ctx: LeesbareCtx,
  projectId: Id<"projecten"> | undefined | null
): Promise<Doc<"voorcalculaties"> | null> {
  if (!projectId) return null;
  return await ctx.db
    .query("voorcalculaties")
    .withIndex("by_project", (q) => q.eq("projectId", projectId))
    .order("desc")
    .first();
}

/**
 * De voorcalculatie die aan de offerte hangt (de normale werkwijze).
 *
 * `offerteId` mag `undefined` zijn — dan is er niets te zoeken en komt er
 * `null` terug. Zonder die guard matcht de index alle offerte-loze
 * voorcalculaties; zie de toelichting bovenaan dit bestand.
 */
export async function voorcalculatieVanOfferte(
  ctx: LeesbareCtx,
  offerteId: Id<"offertes"> | undefined | null
): Promise<Doc<"voorcalculaties"> | null> {
  if (!offerteId) return null;
  return await ctx.db
    .query("voorcalculaties")
    .withIndex("by_offerte", (q) => q.eq("offerteId", offerteId))
    .order("desc")
    .first();
}

/**
 * De voorcalculatie voor een project, met fallback.
 *
 * `voorkeur` bepaalt welke bron voorgaat als er allebei één is. Dat is bewust
 * een parameter en geen vaste volgorde: bij `projecten.createFromOfferte`
 * (`copyVoorcalculatie`) bestaat er een projectkopie náást het origineel op de
 * offerte, en die twee kunnen uiteenlopen zodra iemand de offerte bijwerkt.
 * Elke aanroeper houdt daarom de volgorde die hij altijd al had.
 */
export async function voorcalculatieVoorProject(
  ctx: LeesbareCtx,
  project: ProjectRef,
  voorkeur: "offerte" | "project" = "offerte"
): Promise<Doc<"voorcalculaties"> | null> {
  if (voorkeur === "project") {
    return (
      (await voorcalculatieVanProject(ctx, project._id)) ??
      (await voorcalculatieVanOfferte(ctx, project.offerteId))
    );
  }
  return (
    (await voorcalculatieVanOfferte(ctx, project.offerteId)) ??
    (await voorcalculatieVanProject(ctx, project._id))
  );
}
