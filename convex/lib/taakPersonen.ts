/**
 * Wie is er toewijsbaar op een taak?
 *
 * Harde klanteis uit prototype v13: **iedereen met een account is toewijsbaar,
 * ook admins.** In v1 hing een taak aan een `medewerkers`-rij, en juist de
 * mensen die het meeste uitzetten (directie, kantoor/projectleider) hebben die
 * rij vaak niet — daardoor was het model in de praktijk onbruikbaar.
 *
 * ── Waarom dit niet één index-query is ───────────────────────────────────────
 * De `users`-tabel heeft geen `orgId`: een account kan in meerdere Clerk-
 * organisaties zitten. De tenant leiden we daarom af uit de koppeling die er
 * wél is, precies zoals `users.listUsersWithDetails` en `vereisUserBinnenOrg`
 * dat doen:
 *
 *   1. account gekoppeld aan een medewerker van DEZE organisatie → hoort erbij;
 *   2. account zonder koppeling en géén klant-rol → hoort erbij (directie en
 *      kantoor zijn vaak niet aan een medewerkersrij gekoppeld);
 *   3. klant-rol → nooit (portaalaccounts horen niet in een intern dossier);
 *   4. account gekoppeld aan een medewerker van een ándere organisatie → nooit.
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

/**
 * Alle toewijsbare accounts van deze organisatie, op naam gesorteerd.
 */
export async function laadToewijsbarePersonen(
  ctx: LeesbareCtx,
  orgId: Id<"organisaties">
): Promise<ToewijsbaarPersoon[]> {
  const users = await ctx.db.query("users").collect();

  const personen: ToewijsbaarPersoon[] = [];
  for (const user of users) {
    if (normalizeRole(user.role) === "klant") continue;
    if (user.linkedKlantId) continue;
    if (user.linkedMedewerkerId) {
      const medewerker = await ctx.db.get(user.linkedMedewerkerId);
      // Geen medewerker meer, of een van de buurman: buiten deze organisatie.
      if (!medewerker || medewerker.orgId?.toString() !== orgId.toString()) {
        continue;
      }
    }
    personen.push(persoonVanUser(user));
  }

  return personen.sort((a, b) => a.naam.localeCompare(b.naam, "nl"));
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
  if (normalizeRole(user.role) === "klant") return false;
  if (user.linkedKlantId) return false;
  if (user.linkedMedewerkerId) {
    const medewerker = await ctx.db.get(user.linkedMedewerkerId);
    if (!medewerker || medewerker.orgId?.toString() !== orgId.toString()) {
      return false;
    }
  }
  return true;
}
