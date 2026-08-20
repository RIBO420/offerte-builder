"use client";

import { useClerk } from "@clerk/nextjs";
import { Building2 } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

/**
 * Waaróm er geen toegang is. Drie verschillende problemen, dus drie zinnen:
 * de gebruiker die zelf een uitnodiging kan vragen moet niet dezelfde tekst
 * krijgen als degene wiens organisatie nooit is aangemaakt — die kan er niets
 * aan doen en moet naar de beheerder.
 */
export type GeenToegangReden =
  | "geen-organisatie"
  | "onbekende-organisatie"
  | "inactieve-organisatie";

const TEKSTEN: Record<
  GeenToegangReden,
  { titel: string; beschrijving: string }
> = {
  "geen-organisatie": {
    titel: "Nog geen toegang",
    beschrijving:
      "Je account is nog niet aan een organisatie gekoppeld — vraag je beheerder om een uitnodiging.",
  },
  "onbekende-organisatie": {
    titel: "Organisatie niet bekend",
    beschrijving:
      "Je organisatie is niet bekend in het systeem. Neem contact op met je beheerder.",
  },
  "inactieve-organisatie": {
    titel: "Organisatie niet actief",
    beschrijving:
      "Deze organisatie staat op inactief. Neem contact op met je beheerder.",
  },
};

/**
 * No-access-staat voor een ingelogde stafgebruiker zonder werkende organisatie.
 *
 * De hele Convex-backend is org-gescoped: zonder bruikbare organisatie gooit
 * elke staf-query dezelfde melding als hieronder. Zonder deze staat zag zo'n
 * gebruiker een dashboard dat overal foutmeldingen opwerpt of leeg blijft —
 * nu krijgt hij één duidelijke zin en de enige knop die hier zin heeft.
 *
 * Wordt op twee plekken gebruikt: door `OrgGate` (in plaats van de
 * dashboard-shell) en als eigen route `/geen-toegang`, zodat er ook een
 * adres is om naartoe te verwijzen.
 */
export function GeenToegang({
  reden = "geen-organisatie",
}: {
  reden?: GeenToegangReden;
} = {}) {
  const { signOut } = useClerk();
  const { titel, beschrijving } = TEKSTEN[reden];

  return (
    <div className="flex min-h-svh flex-1 items-center justify-center bg-background p-4 md:p-6">
      <EmptyState
        className="max-w-md"
        icon={<Building2 aria-hidden="true" />}
        title={titel}
        description={beschrijving}
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
