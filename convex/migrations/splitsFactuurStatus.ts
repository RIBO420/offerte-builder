/**
 * Migratie: statussplitsing facturen (PRD §2.8, HERO-pariteit bijlage B)
 *
 * De enkele statusketen (concept → definitief → verzonden → betaald /
 * vervallen) mengt document- en betaalstatus; deelbetalingen passen daar
 * niet in. Deze migratie vult op elke bestaande factuur de twee nieuwe
 * velden volgens mapLegacyStatus (facturatieLogica.ts):
 *
 *   concept    → documentStatus concept,    betaalStatus open
 *   definitief → documentStatus definitief, betaalStatus open
 *   verzonden  → documentStatus verzonden,  betaalStatus open
 *   betaald    → documentStatus verzonden,  betaalStatus betaald
 *   vervallen  → documentStatus verzonden,  betaalStatus vervallen
 *
 * Het oude status-veld blijft staan (deprecated, dual-write) zodat
 * bestaande consumers niet breken.
 *
 * Gebatcht (100 per transactie) en idempotent: rijen waar beide nieuwe
 * velden al gezet zijn worden overgeslagen — veilig om opnieuw te draaien.
 *
 * Draaien via CLI (dry run eerst!):
 *   npx convex run migrations/splitsFactuurStatus:splitsFactuurStatus '{"dryRun": true}'
 *   npx convex run migrations/splitsFactuurStatus:splitsFactuurStatus
 *
 * Verificatie na afloop (aantalZonderSplitsing moet 0 zijn):
 *   npx convex run migrations/splitsFactuurStatus:verifieerSplitsing
 */

import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import { internal } from "../_generated/api";
import { mapLegacyStatus, legacyStatusVan } from "../facturatieLogica";

const BATCH_SIZE = 100;

export const splitsFactuurStatus = internalMutation({
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
      .query("facturen")
      .paginate({ cursor: args.cursor ?? null, numItems: BATCH_SIZE });

    let gemigreerd = 0;
    let alGesplitst = 0;
    const perStatus: Record<string, number> = {};

    for (const factuur of page.page) {
      if (
        factuur.documentStatus !== undefined &&
        factuur.betaalStatus !== undefined
      ) {
        alGesplitst++;
        continue;
      }

      const mapped = mapLegacyStatus(factuur.status);
      perStatus[factuur.status] = (perStatus[factuur.status] ?? 0) + 1;
      gemigreerd++;

      if (!dryRun) {
        await ctx.db.patch(factuur._id, {
          // Deels gezette rijen behouden hun al gezette veld
          documentStatus: factuur.documentStatus ?? mapped.documentStatus,
          betaalStatus: factuur.betaalStatus ?? mapped.betaalStatus,
        });
      }
    }

    const summary = {
      dryRun,
      batchGrootte: page.page.length,
      gemigreerd,
      alGesplitst,
      perStatus,
      isDone: page.isDone,
      continueCursor: page.isDone ? null : page.continueCursor,
    };

    console.log(
      `[Migratie splitsFactuurStatus] Batch verwerkt${dryRun ? " (dry run)" : ""}: ` +
        `${gemigreerd} gemigreerd, ${alGesplitst} al gesplitst` +
        (page.isDone ? " — KLAAR" : " — volgende batch ingepland")
    );

    // Volgende batch in een eigen transactie (productie-veilig)
    if (!page.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.migrations.splitsFactuurStatus.splitsFactuurStatus,
        { cursor: page.continueCursor, dryRun }
      );
    }

    return summary;
  },
});

/**
 * Verificatie: telt facturen zonder gesplitste status en controleert dat de
 * dual-write-spiegel klopt (legacyStatusVan(document, betaal) === status).
 */
export const verifieerSplitsing = internalQuery({
  args: {},
  handler: async (ctx) => {
    const alle = await ctx.db.query("facturen").collect();
    const zonderSplitsing = alle.filter(
      (f) => f.documentStatus === undefined || f.betaalStatus === undefined
    );
    const inconsistent = alle.filter(
      (f) =>
        f.documentStatus !== undefined &&
        f.betaalStatus !== undefined &&
        legacyStatusVan(f.documentStatus, f.betaalStatus) !== f.status
    );
    return {
      totaal: alle.length,
      aantalZonderSplitsing: zonderSplitsing.length,
      aantalInconsistent: inconsistent.length,
      idsInconsistent: inconsistent.map((f) => f._id),
    };
  },
});
