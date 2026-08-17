"use client";

import { FolderKanban } from "lucide-react";
import { SectiePaneel } from "@/components/ui/sectie-paneel";

/**
 * Projecten — de klussen van deze klant.
 *
 * WS2 vult dit paneel met de echte tabel (planning, status, waarde) via de
 * nieuwe query `projecten.listVoorKlant`. Tot die er is staat hier de nette
 * lege staat, zodat het submenu-item nergens naar een blanco vlak wijst.
 *
 * WS2: geef de component een `klantId: Id<"klanten">`-prop en geef die door
 * vanaf `klanten/[id]/page.tsx` (de pagina heeft de id al bij de hand); de
 * lege staat hieronder blijft dan gewoon staan zolang er niets is.
 */
export function TabProjecten() {
  return (
    <SectiePaneel
      titel="Projecten"
      icoon={<FolderKanban />}
      kopbalk
      legeRegel={{
        tekst: "Nog geen projecten voor deze klant.",
        hint: "Een project ontstaat zodra een offerte geaccepteerd wordt.",
      }}
    />
  );
}
