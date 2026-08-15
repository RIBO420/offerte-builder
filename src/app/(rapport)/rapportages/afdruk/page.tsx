"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { RequireRole } from "@/components/require-admin";
import { AfdrukBlad } from "./afdruk-blad";

/**
 * `/rapportages/afdruk` — de printversie van hetzelfde rapport.
 *
 * Staat bewust in de routegroep `(rapport)` en dus buiten de dashboard-shell:
 * geen sidebar, geen commandopalet, geen breadcrumb. Wat je afdrukt is het
 * document, niet de applicatie eromheen.
 *
 * Dezelfde query en dezelfde periode-parameters als /rapportages, zodat het
 * blad per constructie dezelfde cijfers toont als het scherm.
 */
function AfdrukInhoud() {
  const searchParams = useSearchParams();
  return (
    <AfdrukBlad
      periode={searchParams.get("periode")}
      van={Number(searchParams.get("van")) || undefined}
      tot={Number(searchParams.get("tot")) || undefined}
      /* Alleen afdrukken als de knop erom vroeg (`?direct=1`). Stond hier
         omgekeerd (`!== "0"`), waardoor elk gewoon bezoek meteen de native
         printdialoog opende. */
      direct={searchParams.get("direct") === "1"}
    />
  );
}

export default function AfdrukPage() {
  return (
    <RequireRole allowedRoles={["directie", "projectleider"]}>
      <Suspense fallback={null}>
        <AfdrukInhoud />
      </Suspense>
    </RequireRole>
  );
}
