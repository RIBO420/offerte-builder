/**
 * De eigenaar (directie-account) van een organisatie.
 *
 * GEEN tenant-resolver: scopen doe je op `orgId`. Dit is de user achter het
 * bedrijf, nodig waar een *persoon* verwacht wordt en er geen sessie is —
 * de eigenaar van een systeemtaak, de ontvanger van een cron-notificatie, de
 * directie als gesprekspartner in de chat.
 *
 * Voorheen liep dit via `getCompanyUserId` (rol → gekoppelde medewerker →
 * diens tenant-userId). Dat was een omweg langs data die sinds de org-migratie
 * niet meer bestaat; de koppeling staat nu gewoon op de organisatie zelf.
 */

import type { GenericDatabaseReader } from "convex/server";
import type { DataModel, Id } from "../_generated/dataModel";

type LeesbareCtx = { db: GenericDatabaseReader<DataModel> };

/**
 * `undefined` als de organisatie niet (meer) bestaat of nog geen eigenaar
 * heeft — aanroepers moeten dat pad aankunnen, want het veld is optioneel
 * (organisaties van vóór de migratie krijgen hem via `backfillEigenaar`).
 */
export async function eigenaarVanOrg(
  ctx: LeesbareCtx,
  orgId: Id<"organisaties">
): Promise<Id<"users"> | undefined> {
  const org = await ctx.db.get(orgId);
  return org?.eigenaarUserId;
}
