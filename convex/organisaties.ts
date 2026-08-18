/**
 * De organisaties-tabel: één rij per tenant, gekoppeld aan een Clerk-organisatie.
 */

import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireOrg } from "./auth";
import { seedOrgDefaults } from "./lib/orgDefaults";

export interface MaakOrganisatieArgs {
  clerkOrgId: string;
  naam: string;
  slug?: string;
  eigenaarUserId: Id<"users">;
  /**
   * Standaard-inrichting meteen zaaien? Default `true`.
   *
   * De datamigratie (`convex/migrations/naarOrganisaties.ts`) zet dit op
   * `false`, en dat is geen smaak maar een noodzaak: `seedOrgDefaults` kijkt
   * of er al een instellingen-rij MET dit orgId is. Bij de migratie is die er
   * nog niet — de echte instellingen-rij van de eigenaar krijgt zijn `orgId`
   * pas een stap later. Zonder deze schakelaar zou de seed dus een tweede
   * instellingen-rij neerzetten en klapt daarna elke `.unique()` op
   * `instellingen.by_org`.
   */
  seedDefaults?: boolean;
}

/**
 * De aanmaaklogica los van de mutation-registratie.
 *
 * Een `internalMutation` is vanuit een andere mutation niet aanroepbaar (dat
 * kan alleen vanuit een action, via `ctx.runMutation`). De migratie heeft de
 * organisatie in dezelfde transactie nodig, dus staat het werk hier als gewone
 * functie en is de mutation eronder nog maar een dunne schil.
 */
export async function maakOrganisatieIntern(
  ctx: MutationCtx,
  args: MaakOrganisatieArgs,
): Promise<Id<"organisaties">> {
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
    eigenaarUserId: args.eigenaarUserId,
    aangemaaktOp: Date.now(),
  });
  if (args.seedDefaults !== false) {
    await seedOrgDefaults(ctx, orgId);
  }
  return orgId;
}

/**
 * Interne beheerdersfunctie: aangeroepen door de migratie (fase 6/8) en bij het
 * later aanmaken van een whitelabel-klant. Idempotent op clerkOrgId — bestaat
 * de organisatie al, dan komt er geen tweede rij en wordt er niets geseed.
 *
 * `eigenaarUserId` legt de directie-account vast op de organisatie zelf: chat,
 * push en de systeemtaken hebben die user nodig waar een *persoon* verwacht
 * wordt (zie convex/lib/orgEigenaar.ts).
 */
export const maakOrganisatie = internalMutation({
  args: {
    clerkOrgId: v.string(),
    naam: v.string(),
    slug: v.optional(v.string()),
    eigenaarUserId: v.id("users"),
    seedDefaults: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => await maakOrganisatieIntern(ctx, args),
});

/** De organisatie waarin de ingelogde gebruiker op dit moment werkt. */
export const getCurrent = query({
  args: {},
  handler: async (ctx) => await requireOrg(ctx),
});
