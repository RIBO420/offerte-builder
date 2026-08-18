"use client";

import { useAuth, useOrganizationList } from "@clerk/nextjs";
import { useEffect, useState, type ReactNode } from "react";
import { GeenToegang } from "@/app/(dashboard)/geen-toegang/geen-toegang";

/**
 * Zorgt dat er een actieve Clerk-organisatie is voordat er ook maar één
 * org-gescoopte query afgaat.
 *
 * De Convex-backend leest `org_id` uit het JWT (`requireOrg`). Clerk vult dat
 * claim alleen als de sessie een *actieve* organisatie heeft — lid zijn is niet
 * genoeg. Iedereen zit hier in precies één organisatie, dus die zetten we
 * automatisch actief; de gebruiker hoeft niets te kiezen.
 *
 * Drie uitkomsten:
 * - actieve org → children;
 * - lid, nog niet actief → laadstaat terwijl `setActive` loopt;
 * - geen lidmaatschap (of `setActive` mislukt) → `GeenToegang`.
 *
 * Deze gate hoort alleen om de dashboard-tree. Het klantenportaal scoopt via de
 * klant-koppeling en heeft bewust géén org-lidmaatschap, en de publieke
 * configurator draait zonder sessie.
 */
export function OrgGate({
  children,
  laadstaat = null,
}: {
  children: ReactNode;
  /**
   * Wat er staat terwijl Clerk laadt of `setActive` onderweg is. De
   * dashboard-layout geeft hier hetzelfde shell-silhouet mee dat hij zelf
   * gebruikt, zodat de wachtervaring niet verspringt.
   */
  laadstaat?: ReactNode;
}) {
  const { orgId } = useAuth();
  const { isLoaded, setActive, userMemberships } = useOrganizationList({
    userMemberships: { infinite: false },
  });
  // Eén mislukte setActive maakt de gate niet stil-oneindig: we tonen de
  // no-access-staat in plaats van eeuwig te blijven laden, en proberen het niet
  // in een lus opnieuw.
  const [setActiveMislukt, setSetActiveMislukt] = useState(false);

  const eersteOrgId = userMemberships?.data?.[0]?.organization?.id;
  // In de niet-geladen tak van Clerk's union is dit `false`; pas na isLoaded
  // zegt het iets. Zonder deze vlag flitst GeenToegang tijdens het ophalen van
  // de lidmaatschappen.
  const ledenLaden = userMemberships?.isLoading ?? false;

  useEffect(() => {
    if (!isLoaded || orgId || !eersteOrgId || !setActive || setActiveMislukt) {
      return;
    }
    void Promise.resolve(setActive({ organization: eersteOrgId })).catch(
      (fout: unknown) => {
        console.error(
          "[OrgGate] Actieve organisatie zetten mislukt — no-access-staat getoond",
          fout
        );
        setSetActiveMislukt(true);
      }
    );
  }, [isLoaded, orgId, eersteOrgId, setActive, setActiveMislukt]);

  if (!isLoaded || ledenLaden) return <>{laadstaat}</>;
  if (orgId) return <>{children}</>;
  if (!eersteOrgId || setActiveMislukt) return <GeenToegang />;
  // Lid, maar de organisatie is nog niet actief: setActive loopt.
  return <>{laadstaat}</>;
}
