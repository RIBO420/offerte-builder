"use client";

/**
 * Veld-weergave "Mijn dag" (PRD §2.6 + bijlage C, fase 1 stap 9a).
 *
 * De dagkaart voor buiten: voorman en medewerker zien de eigen dag, bevestigen
 * of corrigeren urensegmenten (voorinvulling uit de dagkaart, §8.10), vinken
 * taken af bij het uitklokken (§8.8), sturen meerwerk-verzoeken, gebruiken de
 * route-knop met materiaaldelta-checklist (§8.5), voegen foto's toe aan de
 * klanttijdlijn en dienen de dag in. Kantoor-knoppen (versturen, plannen)
 * bestaan hier bewust niet; kantoor gebruikt deze pagina alleen voor
 * heropenen/corrigeren. Mét "Buiten"-modus (hoog contrast) en de vaste
 * noodprotocol-snelkoppeling.
 */

import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { VeldDag } from "@/components/veld/veld-dag";

export default function VeldPagina() {
  return (
    <>
      <PageHeader />
      <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        <Suspense
          fallback={
            <p className="text-sm text-muted-foreground">Dag laden…</p>
          }
        >
          <VeldDag />
        </Suspense>
      </div>
    </>
  );
}
