"use client";

/**
 * Werkbord "Mijn dag" (functionele inventaris §B).
 *
 * Het dagelijkse bord voor kleine taken die langs meerdere mensen gaan:
 * perspectief kiezen, verdelen op wanneer/wie/status/klant, slepen, zien wat
 * blijft liggen, overleggen in de drawer en loggen wat je deed.
 *
 * Toegang: elke interne rol. Klantaccounts hebben hier niets te zoeken — de
 * backend weigert ze al op elke functie; deze gate zorgt dat ze het scherm ook
 * niet te zien krijgen.
 */

import { Suspense } from "react";
import { CalendarDays } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PaginaReveal } from "@/components/pagina-reveal";
import { RequireRole } from "@/components/require-admin";
import { Werkbord } from "@/components/mijn-dag/werkbord";

/** "woensdag 20 augustus" → "Woensdag 20 augustus" — het bord gaat over deze
 *  ene dag, dus de dag verdient een plek in de kop (prototype §B1). */
function vandaagLang(): string {
  const tekst = new Intl.DateTimeFormat("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
  return tekst.charAt(0).toUpperCase() + tekst.slice(1);
}

export default function MijnDagPagina() {
  return (
    <RequireRole
      allowedRoles={[
        "directie",
        "projectleider",
        "voorman",
        "medewerker",
        "onderaannemer_zzp",
        "materiaalman",
      ]}
      fallbackUrl="/portaal/overzicht"
    >
      <PageHeader />
      <PaginaReveal className="flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-8">
        <div className="flex min-w-0 flex-wrap items-end justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
              Mijn dag
            </h1>
            <p className="text-muted-foreground">
              Wat er vandaag moet, bij wie het ligt en wat blijft liggen
            </p>
          </div>
          <p className="inline-flex shrink-0 items-center gap-2 rounded-full border bg-card px-3.5 py-1.5 text-sm font-medium">
            <CalendarDays
              className="size-4 text-muted-foreground"
              aria-hidden
            />
            {vandaagLang()}
          </p>
        </div>

        {/* `useSearchParams` in het bord vraagt om een Suspense-grens. */}
        <Suspense
          fallback={
            <p className="text-sm text-muted-foreground">Bord laden…</p>
          }
        >
          <Werkbord />
        </Suspense>
      </PaginaReveal>
    </RequireRole>
  );
}
