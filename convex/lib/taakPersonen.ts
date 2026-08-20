/**
 * Wie is er toewijsbaar op een taak?
 *
 * Harde klanteis uit prototype v13: **iedereen met een account is toewijsbaar,
 * ook admins.** In v1 hing een taak aan een `medewerkers`-rij, en juist de
 * mensen die het meeste uitzetten (directie, kantoor/projectleider) hebben die
 * rij vaak niet — daardoor was het model in de praktijk onbruikbaar.
 *
 * ── Lidmaatschap moet BLIJKEN, niet ontbreken ────────────────────────────────
 * De eerste versie las "iedereen zonder medewerkersrij" als "hoort erbij". Dat
 * was een cross-tenant lek: het kantooraccount van de buurman heeft ook geen
 * medewerkersrij in ónze organisatie, dus verscheen hij mét naam en e-mail in
 * de toewijs-selects, en `wijsToe` accepteerde hem (review v13, bevinding 1).
 *
 * Een account hoort bij deze organisatie als MINSTENS ÉÉN koppeling dat zegt:
 *
 *   1. `users.orgId` wijst naar deze org — gestempeld bij login uit het
 *      JWT-org-claim (`users.upsert`), eenmalig gevuld door
 *      `migrations/usersOrgBackfill:backfillUsersOrg`;
 *   2. het account is gekoppeld aan een `medewerkers`-rij van deze org — de
 *      route voor veldmensen die (nog) niet gestempeld zijn;
 *   3. het account is `organisaties.eigenaarUserId` van deze org — de
 *      bedrijfseigenaar, die soms geen van beide heeft.
 *
 * Geen enkele koppeling = niet toewijsbaar. Dat is fail-closed: een account
 * dat er wél bij hoort maar nog nergens gestempeld staat, verschijnt zodra hij
 * een keer inlogt. Een klantaccount (rol `klant` of `linkedKlantId`) is nooit
 * toewijsbaar — portaalaccounts horen niet in een intern dossier.
 */

import type { GenericDatabaseReader } from "convex/server";
import type { DataModel, Doc, Id } from "../_generated/dataModel";
import { normalizeRole } from "../roles";
import { initialenVan, isAdminRol } from "./taakModel";

type LeesbareCtx = { db: GenericDatabaseReader<DataModel> };

export interface ToewijsbaarPersoon {
  _id: Id<"users">;
  naam: string;
  initialen: string;
  isAdmin: boolean;
}

export function persoonVanUser(user: Doc<"users">): ToewijsbaarPersoon {
  const naam = user.name?.trim() || user.email || "Onbekend";
  return {
    _id: user._id,
    naam,
    initialen: initialenVan(naam),
    isAdmin: isAdminRol(normalizeRole(user.role)),
  };
}

/** Portaalaccounts vallen overal af, ongeacht hun org-koppeling. */
function isKlantAccount(user: Doc<"users">): boolean {
  return normalizeRole(user.role) === "klant" || user.linkedKlantId !== undefined;
}

/**
 * Alle toewijsbare accounts van deze organisatie, op naam gesorteerd.
 *
 * Drie routes, in dezelfde volgorde als de header. De `users.by_org`-index
 * levert het gros in één query; de medewerkersroute vult de accounts aan die
 * alleen díe koppeling hebben, en de eigenaar is een enkele `get`. Een account
 * dat via meerdere routes binnenkomt telt één keer (dedupe op `_id`).
 */
export async function laadToewijsbarePersonen(
  ctx: LeesbareCtx,
  orgId: Id<"organisaties">
): Promise<ToewijsbaarPersoon[]> {
  const gevonden = new Map<string, Doc<"users">>();

  const onthoud = (user: Doc<"users"> | null) => {
    if (!user) return;
    if (isKlantAccount(user)) return;
    gevonden.set(user._id.toString(), user);
  };

  // 1. Gestempelde accounts van deze organisatie.
  const gestempeld = await ctx.db
    .query("users")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .collect();
  for (const user of gestempeld) onthoud(user);

  // 2. Accounts die alleen via een medewerkersrij van deze org bekend zijn.
  //    Per medewerker één index-lookup: het aantal medewerkers is de
  //    teamgrootte, geen tabelscan over alle users van alle tenants.
  const medewerkers = await ctx.db
    .query("medewerkers")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .collect();
  for (const medewerker of medewerkers) {
    const gekoppeld = await ctx.db
      .query("users")
      .withIndex("by_linked_medewerker", (q) =>
        q.eq("linkedMedewerkerId", medewerker._id)
      )
      .collect();
    for (const user of gekoppeld) onthoud(user);
  }

  // 3. De bedrijfseigenaar.
  const org = await ctx.db.get(orgId);
  if (org?.eigenaarUserId) onthoud(await ctx.db.get(org.eigenaarUserId));

  return [...gevonden.values()]
    .map(persoonVanUser)
    .sort((a, b) => a.naam.localeCompare(b.naam, "nl"));
}

/**
 * Hoort dit account bij deze organisatie? De schrijfkant van bovenstaande
 * regels: hiermee kan een taak nooit aan een account van een andere tenant
 * worden gehangen.
 */
export async function isToewijsbaarBinnenOrg(
  ctx: LeesbareCtx,
  userId: Id<"users">,
  orgId: Id<"organisaties">
): Promise<boolean> {
  const user = await ctx.db.get(userId);
  if (!user) return false;
  if (isKlantAccount(user)) return false;

  // 1. Gestempeld op deze organisatie.
  if (user.orgId?.toString() === orgId.toString()) return true;

  // 2. Gekoppeld aan een medewerker van deze organisatie.
  if (user.linkedMedewerkerId) {
    const medewerker = await ctx.db.get(user.linkedMedewerkerId);
    if (medewerker?.orgId?.toString() === orgId.toString()) return true;
  }

  // 3. Eigenaar van deze organisatie.
  const org = await ctx.db.get(orgId);
  if (org?.eigenaarUserId?.toString() === userId.toString()) return true;

  return false;
}
