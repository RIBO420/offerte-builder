/**
 * Migratie: backfill werkitem-type op de tabel "projecten" (B1-besluit, stap 2)
 *
 * Onderdeel van de werkitem-generalisatie (PRD §1.1, docs/audit/B1-WERKITEM-BESLUIT.md):
 * 1. type = "project" zetten op alle bestaande rijen zonder type
 *    (semantiek tijdens migratie: undefined === "project")
 * 2. klantId afleiden via de gekoppelde offerte (offerte.klantId) waar die
 *    nog leeg is; rijen zonder afleidbare klant worden GERAPPORTEERD, niet gegokt
 *
 * Gebatcht (paginated, 100 per transactie) en idempotent: reeds gevulde velden
 * worden overgeslagen, dus de migratie kan veilig opnieuw draaien.
 *
 * Draaien via Convex dashboard of CLI (dry run eerst!):
 *   npx convex run migrations/backfillWerkitemType:backfillWerkitemType '{"dryRun": true}'
 *   npx convex run migrations/backfillWerkitemType:backfillWerkitemType
 *
 * Verificatie na afloop (moet aantalZonderType === 0 geven):
 *   npx convex run migrations/backfillWerkitemType:verifieerBackfill
 */

import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import { internal } from "../_generated/api";

const BATCH_SIZE = 100;

export const backfillWerkitemType = internalMutation({
  args: {
    // Paginatie-cursor; leeg laten bij de eerste aanroep. Vervolg-batches
    // plannen zichzelf in via de scheduler (elke batch = eigen transactie).
    cursor: v.optional(v.union(v.string(), v.null())),
    // true = alleen rapporteren, niets schrijven
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const dryRun = args.dryRun ?? false;

    const page = await ctx.db
      .query("projecten")
      .paginate({ cursor: args.cursor ?? null, numItems: BATCH_SIZE });

    let typeGezet = 0;
    let klantIdAfgeleid = 0;
    let alCompleet = 0;
    const zonderAfleidbareKlant: string[] = [];

    for (const project of page.page) {
      const patch: { type?: "project"; klantId?: NonNullable<typeof project.klantId> } = {};

      // 1. Discriminator: alle bestaande rijen zijn projecten (B1 stap 2)
      if (project.type === undefined) {
        patch.type = "project";
      }

      // 2. klantId afleiden via de gekoppelde offerte waar mogelijk
      if (project.klantId === undefined) {
        const offerte = project.offerteId
          ? await ctx.db.get(project.offerteId)
          : null;
        if (offerte?.klantId) {
          patch.klantId = offerte.klantId;
        } else {
          // Niet gokken — rapporteren voor handmatige opschoonlijst (B1 open punt 1)
          zonderAfleidbareKlant.push(project._id);
          console.warn(
            `[Migratie backfillWerkitemType] Geen afleidbare klantId voor project ${project._id} ` +
              `("${project.naam}"): ${project.offerteId ? "offerte heeft geen klantId" : "geen offerteId"}`
          );
        }
      }

      if (patch.type === undefined && patch.klantId === undefined) {
        alCompleet++;
        continue;
      }

      if (patch.type !== undefined) typeGezet++;
      if (patch.klantId !== undefined) klantIdAfgeleid++;

      if (!dryRun) {
        await ctx.db.patch(project._id, patch);
      }
    }

    const summary = {
      dryRun,
      batchGrootte: page.page.length,
      typeGezet,
      klantIdAfgeleid,
      alCompleet,
      zonderAfleidbareKlant,
      isDone: page.isDone,
      continueCursor: page.isDone ? null : page.continueCursor,
    };

    console.log(
      `[Migratie backfillWerkitemType] Batch verwerkt${dryRun ? " (dry run)" : ""}: ` +
        `${typeGezet} type gezet, ${klantIdAfgeleid} klantId afgeleid, ` +
        `${alCompleet} al compleet, ${zonderAfleidbareKlant.length} zonder afleidbare klant` +
        (page.isDone ? " — KLAAR" : " — volgende batch ingepland")
    );

    // Volgende batch in een eigen transactie (productie-veilig bij grote tabellen)
    if (!page.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.migrations.backfillWerkitemType.backfillWerkitemType,
        { cursor: page.continueCursor, dryRun }
      );
    }

    return summary;
  },
});

/**
 * Verificatie (B1 stap 2): telt rijen zonder type en rijen zonder klantId.
 * Na een geslaagde backfill moet aantalZonderType 0 zijn; aantalZonderKlantId
 * is de handmatige opschoonlijst (open punt 1 in het B1-besluit).
 */
export const verifieerBackfill = internalQuery({
  args: {},
  handler: async (ctx) => {
    const alle = await ctx.db.query("projecten").collect();
    const zonderType = alle.filter((p) => p.type === undefined);
    const zonderKlantId = alle.filter((p) => p.klantId === undefined);
    return {
      totaal: alle.length,
      aantalZonderType: zonderType.length,
      aantalZonderKlantId: zonderKlantId.length,
      idsZonderKlantId: zonderKlantId.map((p) => p._id),
    };
  },
});
