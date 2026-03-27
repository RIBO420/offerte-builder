import { internalMutation } from "./_generated/server";

/**
 * Backfill migrations for klantId fields.
 *
 * These are one-time internal mutations to populate the new klantId foreign
 * keys added for the klantenportaal feature. Run them manually after
 * deployment via the Convex dashboard or CLI:
 *
 *   npx convex run backfillKlantIds:backfillProjectenKlantId --prod
 *   npx convex run backfillKlantIds:backfillFacturenKlantId --prod
 *   npx convex run backfillKlantIds:linkOrphanedOffertes --prod
 */

/**
 * Backfill klantId on projecten by looking up the linked offerte.
 *
 * For each project without a klantId, fetches the offerte via project.offerteId
 * and copies offerte.klantId to the project.
 */
export const backfillProjectenKlantId = internalMutation({
  args: {},
  handler: async (ctx) => {
    const projecten = await ctx.db.query("projecten").collect();
    let updated = 0;

    for (const project of projecten) {
      if (project.klantId) continue;

      const offerte = await ctx.db.get(project.offerteId);
      if (!offerte || !offerte.klantId) continue;

      await ctx.db.patch(project._id, { klantId: offerte.klantId });
      updated++;
    }

    console.log(
      `backfillProjectenKlantId: updated ${updated} of ${projecten.length} projecten`
    );
    return { updated, total: projecten.length };
  },
});

/**
 * Backfill klantId on facturen by traversing factuur → project → offerte.
 *
 * For each factuur without a klantId, looks up the project, then the offerte,
 * and copies offerte.klantId to the factuur.
 */
export const backfillFacturenKlantId = internalMutation({
  args: {},
  handler: async (ctx) => {
    const facturen = await ctx.db.query("facturen").collect();
    let updated = 0;

    for (const factuur of facturen) {
      if (factuur.klantId) continue;

      const project = await ctx.db.get(factuur.projectId);
      if (!project) continue;

      const offerte = await ctx.db.get(project.offerteId);
      if (!offerte || !offerte.klantId) continue;

      await ctx.db.patch(factuur._id, { klantId: offerte.klantId });
      updated++;
    }

    console.log(
      `backfillFacturenKlantId: updated ${updated} of ${facturen.length} facturen`
    );
    return { updated, total: facturen.length };
  },
});

/**
 * Link orphaned offertes to existing klanten by matching email.
 *
 * For each offerte without a klantId but with an embedded klant.email,
 * searches the klanten table (using the by_email index) for a matching
 * klant belonging to the same company (userId). If found, patches the
 * offerte with the klantId.
 */
export const linkOrphanedOffertes = internalMutation({
  args: {},
  handler: async (ctx) => {
    const offertes = await ctx.db.query("offertes").collect();
    let linked = 0;

    for (const offerte of offertes) {
      if (offerte.klantId) continue;

      const email = offerte.klant?.email;
      if (!email) continue;

      // Find a klant with matching email
      const klant = await ctx.db
        .query("klanten")
        .withIndex("by_email", (q) => q.eq("email", email))
        .first();

      if (!klant) continue;

      // Verify same company (userId) to avoid cross-tenant linking
      if (klant.userId.toString() !== offerte.userId.toString()) continue;

      await ctx.db.patch(offerte._id, { klantId: klant._id });
      linked++;
    }

    console.log(
      `linkOrphanedOffertes: linked ${linked} of ${offertes.length} offertes`
    );
    return { linked, total: offertes.length };
  },
});
