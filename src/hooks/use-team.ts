"use client";

import { useQuery, useMutation, useAction } from "convex/react";
import { useCallback, useMemo } from "react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useCurrentUser } from "./use-current-user";
import type { UserRole, UserWithDetails } from "./use-users";

// ============================================================================
// TEAM — personeelsdossier én app-toegang in één hook
// ============================================================================
// Het Team-scherm leest uit drie hoeken: `team.listTeam` (medewerker +
// accountstatus), de medewerker-CRUD (`medewerkers.*`) en het accountbeheer
// (`users.*`). Die drie hier bundelen houdt de pagina bij het scherm en de
// vertaling naar Convex bij de hook — dezelfde stijl als use-medewerkers.ts en
// use-users.ts.
//
// Let op de vorm van de schrijfacties: uitnodigen, uitnodiging intrekken en
// toegang intrekken zijn **actions** (ze bellen api.clerk.com), niet mutations.
// `useAction` is dus geen detail dat je mag "opschonen" naar `useMutation`.
// ============================================================================

/** Eén rij van het Team-scherm: de medewerker plus wat hij in de app mag. */
export type Teamlid = FunctionReturnType<typeof api.team.listTeam>[number];

/** `geen` · `uitgenodigd` · `actief` — afgeleid in `team.listTeam`. */
export type AccountStatus = Teamlid["accountStatus"];

/**
 * Rollen die je via het Team-scherm mag uitdelen.
 *
 * Spiegel van `UITNODIGBARE_ROLLEN` in convex/team.ts. `klant` hoort bij de
 * portaal-flow, `admin`/`viewer` zijn legacy-literals die alleen nog in
 * bestaande rijen mogen staan. De server weigert ze; de UI toont ze niet.
 */
export const UITNODIGBARE_ROLLEN = [
  "directie",
  "projectleider",
  "voorman",
  "medewerker",
  "onderaannemer_zzp",
  "materiaalman",
] as const satisfies readonly UserRole[];

export type UitnodigbareRol = (typeof UITNODIGBARE_ROLLEN)[number];

export function isUitnodigbareRol(rol: string): rol is UitnodigbareRol {
  return (UITNODIGBARE_ROLLEN as readonly string[]).includes(rol);
}

/**
 * De rol van een account, met de veilige standaard erin.
 *
 * `users.role` is in het schema optioneel, dus een rij zónder rol bestaat
 * echt — en een rolbadge mag daar niet op leeglopen. Dezelfde standaard als
 * `useCurrentUserRole`: wie geen rol heeft, is medewerker.
 */
export function rolVanAccount(
  account: { role?: UserRole | null } | null | undefined
): UserRole {
  return account?.role ?? "medewerker";
}

/** Trim + lowercase — exact wat convex/team.ts met het adres doet. */
export function normaliseerEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Alles wat het Team-scherm nodig heeft: de lijst, de dossier-CRUD en de
 * toegangsacties.
 */
export function useTeam() {
  const { user } = useCurrentUser();

  const teamleden = useQuery(api.team.listTeam, user?._id ? {} : "skip");
  // Accounts zonder medewerkersdossier komen uit het accountbeheer; die query
  // geeft [] terug voor niet-directie, dus de Accounts-tab blijft vanzelf leeg.
  const accounts = useQuery(
    api.users.listUsersWithDetails,
    user?._id ? {} : "skip"
  );

  const stuurUitnodigingAction = useAction(api.team.stuurUitnodiging);
  const trekUitnodigingInAction = useAction(api.team.trekUitnodigingIn);
  const trekToegangInAction = useAction(api.team.trekToegangIn);

  const updateMedewerkerMutation = useMutation(api.medewerkers.update);
  const removeMedewerkerMutation = useMutation(api.medewerkers.remove);
  const updateUserRoleMutation = useMutation(api.users.updateUserRole);
  const deleteUserMutation = useMutation(api.users.deleteUser);

  const isLoading = !!user && teamleden === undefined;

  const teamledenLijst = useMemo(() => teamleden ?? [], [teamleden]);
  const accountLijst = useMemo(
    () => (accounts ?? []) as UserWithDetails[],
    [accounts]
  );

  /**
   * Accounts zonder personeelsdossier — de Accounts-tab.
   *
   * Een klantaccount valt er al server-side uit (`listUsersWithDetails`); de
   * rolfilter hier is de tweede zeef voor legacy-rijen die nog `klant` heten.
   */
  const losseAccounts = useMemo(
    () =>
      accountLijst.filter(
        (account) => !account.linkedMedewerkerId && account.role !== "klant"
      ),
    [accountLijst]
  );

  const stuurUitnodiging = useCallback(
    async (
      medewerkerId: Id<"medewerkers">,
      email: string,
      rol: UitnodigbareRol
    ) =>
      await stuurUitnodigingAction({
        medewerkerId,
        email: normaliseerEmail(email),
        rol,
      }),
    [stuurUitnodigingAction]
  );

  const trekUitnodigingIn = useCallback(
    async (medewerkerId: Id<"medewerkers">) =>
      await trekUitnodigingInAction({ medewerkerId }),
    [trekUitnodigingInAction]
  );

  const trekToegangIn = useCallback(
    async (medewerkerId: Id<"medewerkers">) =>
      await trekToegangInAction({ medewerkerId }),
    [trekToegangInAction]
  );

  const wijzigRol = useCallback(
    async (userId: Id<"users">, rol: UserRole) =>
      await updateUserRoleMutation({ userId, role: rol }),
    [updateUserRoleMutation]
  );

  const verwijderAccount = useCallback(
    async (userId: Id<"users">) => await deleteUserMutation({ userId }),
    [deleteUserMutation]
  );

  /**
   * "Uit dienst" = de bestaande soft-delete van de medewerker-CRUD
   * (`medewerkers.remove` zet `isActief` op false). Het dossier blijft staan —
   * uren, projecten en certificaten hangen eraan.
   */
  const uitDienst = useCallback(
    async (medewerkerId: Id<"medewerkers">) =>
      await removeMedewerkerMutation({ id: medewerkerId }),
    [removeMedewerkerMutation]
  );

  const inDienst = useCallback(
    async (medewerkerId: Id<"medewerkers">) =>
      await updateMedewerkerMutation({ id: medewerkerId, isActief: true }),
    [updateMedewerkerMutation]
  );

  return {
    teamleden: teamledenLijst,
    losseAccounts,
    isLoading,
    stuurUitnodiging,
    trekUitnodigingIn,
    trekToegangIn,
    wijzigRol,
    verwijderAccount,
    uitDienst,
    inDienst,
  };
}
