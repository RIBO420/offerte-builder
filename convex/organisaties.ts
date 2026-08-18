/**
 * De organisaties-tabel: één rij per tenant, gekoppeld aan een Clerk-organisatie.
 */

import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import { requireOrg } from "./auth";
import { seedOrgDefaults } from "./lib/orgDefaults";

/**
 * Interne beheerdersfunctie: aangeroepen door de migratie (fase 6/8) en bij het
 * later aanmaken van een whitelabel-klant. Idempotent op clerkOrgId — bestaat
 * de organisatie al, dan komt er geen tweede rij en wordt er niets geseed.
 *
 * `eigenaarUserId` gaat mee naar de seed omdat `userId` op instellingen,
 * normuren en producten in het schema nog verplicht is; dat veld verdwijnt in
 * fase 6.
 */
export const maakOrganisatie = internalMutation({
  args: {
    clerkOrgId: v.string(),
    naam: v.string(),
    slug: v.optional(v.string()),
    eigenaarUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const bestaande = await ctx.db
      .query("organisaties")
      .withIndex("by_clerk_org_id", (q) => q.eq("clerkOrgId", args.clerkOrgId))
      .unique();
    if (bestaande) return bestaande._id;

    const orgId = await ctx.db.insert("organisaties", {
      clerkOrgId: args.clerkOrgId,
      naam: args.naam,
      slug: args.slug,
      actief: true,
      aangemaaktOp: Date.now(),
    });
    await seedOrgDefaults(ctx, orgId, args.eigenaarUserId);
    return orgId;
  },
});

/** De organisatie waarin de ingelogde gebruiker op dit moment werkt. */
export const getCurrent = query({
  args: {},
  handler: async (ctx) => await requireOrg(ctx),
});
