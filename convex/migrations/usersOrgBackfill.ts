/**
 * Eenmalige backfill van `users.orgId` (review v13, bevinding 1).
 *
 * WAAROM. Tot deze wijziging was "hoort dit account bij deze organisatie?"
 * alleen af te leiden uit een medewerkersrij. Kantoor en directie hebben die
 * vaak niet, dus behandelde `convex/lib/taakPersonen.ts` zo'n account als lid
 * van ÉLKE tenant: het kantooraccount van de buurman verscheen mét naam en
 * e-mail in de toewijs-selects van Mijn dag, en `wijsToe` accepteerde hem.
 * `users.orgId` maakt het lidmaatschap expliciet. Nieuwe en terugkerende
 * gebruikers krijgen hem bij login gestempeld (`users.upsert`, uit het
 * JWT-org-claim); deze migratie vult de rijen die er al stonden.
 *
 * Commando's:
 *   npx convex run migrations/usersOrgBackfill:voorTelling
 *   npx convex run migrations/usersOrgBackfill:backfillUsersOrg
 *   npx convex run migrations/usersOrgBackfill:backfillUsersOrg  # tot klaar=true
 *   npx convex run migrations/usersOrgBackfill:voorTelling
 *
 * ── Drie keuzes die je moet kennen ──────────────────────────────────────────
 *
 * 1. TWEE ROUTES, IN VOLGORDE. (a) de medewerkersrij van dit account — via
 *    `linkedMedewerkerId`, anders via de index `medewerkers.by_clerk_id` op
 *    `clerkUserId`; (b) `organisaties.eigenaarUserId === user._id`. De
 *    medewerkersroute gaat voor: die is de directe koppeling, het
 *    eigenaarsveld is een afgeleide van de org-migratie.
 *
 * 2. GEEN MATCH = OVERSLAAN. Een account zonder enige koppeling krijgt géén
 *    orgId gegokt. Hij is daarmee nergens toewijsbaar tot hij een keer inlogt
 *    (dan stempelt `users.upsert` hem uit het JWT) — fail-closed, precies de
 *    bedoeling van deze fix.
 *
 * 3. BATCHED EN HERSTARTBAAR. Elke aanroep verwerkt maximaal `BATCH` rijen en
 *    zegt of er nog werk ligt (`klaar`). Rijen die al een `orgId` hebben
 *    worden overgeslagen, dus twee keer draaien is een no-op. Geen
 *    zelfplanning: net als `taakmodelV2` draait de orchestrator hem herhaald.
 */

import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";

/** Rijen per aanroep van `backfillUsersOrg`. */
export const BATCH = 500;

/**
 * De organisatie van dit account, of `null` als er geen koppeling is.
 *
 * `organisaties` krijgt de aanroeper mee: de tabel is klein (één rij per
 * bedrijf) en zo wordt hij één keer per batch gelezen in plaats van per user.
 */
export async function zoekOrgVanUser(
  ctx: QueryCtx | MutationCtx,
  user: Doc<"users">,
  organisaties: Doc<"organisaties">[]
): Promise<Id<"organisaties"> | null> {
  // Route (a1): de expliciete koppeling naar een medewerkersrij.
  if (user.linkedMedewerkerId) {
    const medewerker = await ctx.db.get(user.linkedMedewerkerId);
    if (medewerker?.orgId) return medewerker.orgId;
  }

  // Route (a2): de medewerkersrij die dit Clerk-account claimt. `clerkId` is
  // verplicht op users, dus hier geen undefined-gat in de index-`q.eq`.
  if (user.clerkId) {
    const medewerker = await ctx.db
      .query("medewerkers")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", user.clerkId))
      .first();
    if (medewerker?.orgId) return medewerker.orgId;
  }

  // Route (b): eigenaar van een organisatie.
  const eigenVan = organisaties.find(
    (org) => org.eigenaarUserId?.toString() === user._id.toString()
  );
  return eigenVan?._id ?? null;
}

/** Voortgangsmeter: draai hem vóór en ná de backfill. */
export const voorTelling = internalQuery({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    let metOrg = 0;
    for (const user of users) if (user.orgId) metOrg += 1;
    return {
      totaal: users.length,
      metOrg,
      zonderOrg: users.length - metOrg,
    };
  },
});

/**
 * Verwerk maximaal `BATCH` accounts zonder `orgId`. Herhaal tot `klaar: true`.
 */
export const backfillUsersOrg = internalMutation({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limiet = Math.max(1, Math.min(args.limit ?? BATCH, BATCH));
    const users = await ctx.db.query("users").collect();
    const openstaand = users.filter((user) => !user.orgId);
    const organisaties = await ctx.db.query("organisaties").collect();

    let gestempeld = 0;
    let overgeslagen = 0;
    let bekeken = 0;

    // De batchgrens telt STEMPELS, niet bekeken rijen. Zou hij bekeken rijen
    // tellen, dan bleven overgeslagen accounts vooraan in `openstaand` staan en
    // bekeek elke volgende aanroep exact dezelfde kop van de lijst: een run die
    // nooit klaar komt. Gestempelde rijen vallen wél uit `openstaand`, dus op
    // stempels tellen loopt gegarandeerd af.
    for (const user of openstaand) {
      if (gestempeld >= limiet) break;
      bekeken += 1;
      const orgId = await zoekOrgVanUser(ctx, user, organisaties);
      if (!orgId) {
        overgeslagen += 1;
        continue;
      }
      await ctx.db.patch(user._id, { orgId });
      gestempeld += 1;
    }

    return {
      gestempeld,
      // Deze houden hun orgId leeg tot ze een keer inloggen — bewust.
      overgeslagen,
      resterend: Math.max(0, openstaand.length - bekeken),
      klaar: bekeken >= openstaand.length,
    };
  },
});
