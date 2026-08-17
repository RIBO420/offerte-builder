"use client";

/**
 * `/uren` — de Controlekamer, met per rol een eigen gezicht.
 *
 * Deze pagina was tot 17 aug 2026 een pre-designprogramma-scherm: vier
 * statkaarten ("Deze Week 0,0", "Deze Maand", "Totaal", "Registraties 44"), twee
 * voortgangsbalk-kaarten en één gepagineerde tabel met zeven filtercontrols op
 * de óude urenbron. Hij vertelde dát er uren waren, niet óf ze kloppen — en de
 * echte urenketen (`urenSegmenten`, dag op slot, voorstellen, logboek) kwam er
 * niet in voor.
 *
 * Nu: één route, per rol een ander gezicht (`UrenGezicht`), en voor kantoor de
 * vier vragen van de Controlekamer met de Ploegenfilm als dag-doorklik.
 * Onderbouwing in `docs/design/plannen/uren-controlekamer-plan.md` en
 * `uren-redesign-onderzoek-ux.md`; het datacontract staat in plan §2.
 */

import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { LaadIndicator } from "@/components/ui/laad-indicator";
import { UrenGezicht } from "@/components/uren/uren-gezicht";

export default function UrenPage() {
  return (
    <>
      <PageHeader />
      {/* De week-, dag- en filmkeuze leven in de URL (`?week=`, `?dag=`,
          `?weergave=`); `useSearchParams` vraagt daarom om een Suspense-grens
          boven het gezicht. */}
      <Suspense
        fallback={
          <div className="flex flex-1 items-center justify-center">
            <LaadIndicator formaat="pagina" tekst="Laden…" />
          </div>
        }
      >
        <UrenGezicht />
      </Suspense>
    </>
  );
}
