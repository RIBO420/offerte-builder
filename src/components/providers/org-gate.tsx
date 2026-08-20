"use client";

import { useAuth, useOrganizationList } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { useEffect, useState, type ReactNode } from "react";
import { api } from "@convex/_generated/api";
import { GeenToegang } from "@/app/(dashboard)/geen-toegang/geen-toegang";

/**
 * Zorgt dat er een actieve Clerk-organisatie is *die Convex ook kent*, voordat
 * er ook maar één org-gescoopte query afgaat.
 *
 * De Convex-backend leest `org_id` uit het JWT (`requireOrg`). Clerk vult dat
 * claim alleen als de sessie een *actieve* organisatie heeft — lid zijn is niet
 * genoeg. Iedereen zit hier in precies één organisatie, dus die zetten we
 * automatisch actief; de gebruiker hoeft niets te kiezen.
 *
 * Een geldig claim is echter nog geen toegang: wijst het naar een organisatie
 * die nooit in Convex geprovisioneerd is, dan gooit élke query van de shell
 * (normuren, sidebartellingen, dashboard, klanten…) zijn eigen
 * "Organisatie niet gevonden", klapt de shell in de ErrorBoundary en loopt de
 * console vol. Daarom stelt de gate één tolerante voorvraag
 * (`organisaties.toegangsStatus`) en blokkeert hij vóórdat de children mounten.
 *
 * Uitkomsten:
 * - actieve org die Convex kent → children;
 * - lid, nog niet actief → laadstaat terwijl `setActive` loopt;
 * - geen lidmaatschap (of `setActive` mislukt) → `GeenToegang`;
 * - org onbekend of uitgezet in Convex → `GeenToegang` met de passende zin.
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

  // De voorvraag draait pas als Clerk een org-claim heeft: zonder claim weten
  // we het antwoord al ("geen-organisatie") en zou de query alleen maar een
  // extra rondje zijn. `toegangsStatus` gooit niet, dus deze ene query kan de
  // gate zelf niet in een ErrorBoundary laten vallen.
  const toegang = useQuery(api.organisaties.toegangsStatus, orgId ? {} : "skip");

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

  if (orgId) {
    // Zolang de voorvraag loopt blijven de children ongemount — dit is precies
    // de plek waar de query-storm anders begon.
    if (toegang === undefined) return <>{laadstaat}</>;
    if (toegang.status === "ok") return <>{children}</>;
    if (toegang.status === "onbekende-organisatie") {
      return <GeenToegang reden="onbekende-organisatie" />;
    }
    if (toegang.status === "inactieve-organisatie") {
      return <GeenToegang reden="inactieve-organisatie" />;
    }
    // "geen-sessie"/"geen-organisatie" terwijl Clerk wél een actieve org meldt:
    // het Convex-token loopt nog achter op de Clerk-sessie (vlak na `setActive`
    // zit het claim er nog niet in). Convex vraagt de query opnieuw zodra het
    // token ververst is, dus hier wachten in plaats van ten onrechte de
    // no-access-staat tonen.
    return <>{laadstaat}</>;
  }

  if (!eersteOrgId || setActiveMislukt) return <GeenToegang />;
  // Lid, maar de organisatie is nog niet actief: setActive loopt.
  return <>{laadstaat}</>;
}
