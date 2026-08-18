"use client";

import { useClerk } from "@clerk/nextjs";
import { Building2 } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

/**
 * No-access-staat voor een ingelogde stafgebruiker zonder organisatie.
 *
 * De hele Convex-backend is org-gescoped: zonder `org_id`-claim gooit elke
 * staf-query dezelfde melding als hieronder. Zonder deze staat zag zo'n
 * gebruiker een dashboard dat overal foutmeldingen opwerpt of leeg blijft —
 * nu krijgt hij één duidelijke zin en de enige knop die hier zin heeft.
 *
 * Wordt op twee plekken gebruikt: door `OrgGate` (in plaats van de
 * dashboard-shell) en als eigen route `/geen-toegang`, zodat er ook een
 * adres is om naartoe te verwijzen.
 */
export function GeenToegang() {
  const { signOut } = useClerk();

  return (
    <div className="flex min-h-svh flex-1 items-center justify-center bg-background p-4 md:p-6">
      <EmptyState
        className="max-w-md"
        icon={<Building2 aria-hidden="true" />}
        title="Nog geen toegang"
        description="Je account is nog niet aan een organisatie gekoppeld — vraag je beheerder om een uitnodiging."
        action={{
          label: "Uitloggen",
          onClick: () => {
            void signOut({ redirectUrl: "/" });
          },
          variant: "outline",
        }}
      />
    </div>
  );
}
