/**
 * Mutation-kant van "taken uit offerteregels": schrijft voor een project één
 * planningstaak per regel van zijn offerte (pure kern:
 * ./planningTakenUitRegels.ts).
 *
 * Aangeroepen bij projectaanmaak uit acceptatie (alle paden in
 * convex/acceptatieKeten.ts), bij werkitems.createWerkitem met
 * offerteRegelIds, bij projecten.create en via de knop op de planningpagina.
 *
 * Nooit dubbel: heeft het project al taken (gegenereerd of zelf toegevoegd),
 * dan gebeurt er niets. Tenant: de offerte moet bij dezelfde organisatie
 * horen als het project; de aanroeper heeft het project al gecontroleerd.
 */

import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { voorcalculatieVanOfferte } from "./voorcalculatieLookup";
import { takenUitOfferteRegels } from "./planningTakenUitRegels";

export async function maakPlanningTakenUitOfferte(
  ctx: MutationCtx,
  projectId: Id<"projecten">
): Promise<number> {
  const project = await ctx.db.get(projectId);
  if (!project?.offerteId) return 0;

  const bestaand = await ctx.db
    .query("planningTaken")
    .withIndex("by_project", (q) => q.eq("projectId", projectId))
    .first();
  if (bestaand) return 0;

  const offerte = await ctx.db.get(project.offerteId);
  if (!offerte || offerte.orgId?.toString() !== project.orgId?.toString()) return 0;

  const voorcalculatie = await voorcalculatieVanOfferte(ctx, offerte._id);
  const taken = takenUitOfferteRegels(offerte.regels, {
    regelIds: project.offerteRegelIds,
    teamGrootte: voorcalculatie?.teamGrootte,
    effectieveUrenPerDag: voorcalculatie?.effectieveUrenPerDag,
    alleenArbeid: offerte.bron !== "vrij",
  });

  const now = Date.now();
  for (const taak of taken) {
    await ctx.db.insert("planningTaken", {
      projectId,
      ...taak,
      status: "gepland",
      updatedAt: now,
    });
  }
  return taken.length;
}
