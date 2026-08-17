"use client";

import { Suspense } from "react";
import { RequireRole } from "@/components/require-admin";
import { PageHeader } from "@/components/page-header";
import { RapportageInhoud } from "./components/rapportage-inhoud";
import { RapportageSkelet } from "./components/rapportage-skelet";

/**
 * /rapportages — het antwoordverhaal, met een grafiekenblad ernaast.
 *
 * De pagina zelf is nu bijna leeg: hij regelt de rol, de breadcrumb en de
 * Suspense-grens rond `useSearchParams`. Alle inhoud staat in `components/`,
 * per vraagsectie. Welk van de twee bladen er staat bepaalt
 * `rapportage-inhoud.tsx` aan de hand van `?tab=`; zonder parameter is dat het
 * verhaal. Zie `docs/design/plannen/rapportage-masterplan.md`.
 */
export default function RapportagesPage() {
  return (
    <RequireRole allowedRoles={["directie", "projectleider"]}>
      <PageHeader />
      <Suspense
        fallback={
          <div className="px-4 pt-8 md:px-8">
            <RapportageSkelet />
          </div>
        }
      >
        <RapportageInhoud />
      </Suspense>
    </RequireRole>
  );
}
