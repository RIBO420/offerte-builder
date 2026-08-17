"use client";

/**
 * ── Rolgezichten van `/uren` (plan §1, WS-C) ────────────────────────────────
 *
 * Eén route, drie gezichten — zoals het dashboard dat doet met
 * `VoormanDashboard`:
 *
 * - **kantoor** (directie/projectleider): de Controlekamer, met de Ploegenfilm
 *   als dag-doorklik (`?dag=YYYY-MM-DD&weergave=film`, deeplinkbaar);
 * - **voorman**: de ploegdag van vandaag — voorstellen bevestigen voor de
 *   hele ploeg, afwijking per man;
 * - **iedereen met een veldrol** (medewerker, zzp, materiaalman): de eigen
 *   week als zeven dagbalken, met kantoorcorrecties zichtbaar.
 *
 * De rolchecks van de queries zelf leven in de backend (`veldLogica`); hier
 * wordt de rol alleen gebruikt om het juiste gezicht te kiezen.
 */

import { useCurrentUserRole, useIsKantoor } from "@/hooks/use-users";
import { DataFetchErrorBoundary } from "@/components/error-boundary";
import { LaadIndicator } from "@/components/ui/laad-indicator";
import { useFilmKeuze } from "./film";
import { KantoorControlekamer } from "./kantoor-controlekamer";
import { MijnWeekGezicht } from "./mijn-week-gezicht";
import { PloegDagGezicht } from "./ploegdag-gezicht";
import { PloegenFilm } from "./ploegen-film";

export function UrenGezicht() {
  const rol = useCurrentUserRole();
  const isKantoor = useIsKantoor();

  // Rol nog niet bekend: geen half gezicht renderen (de kantoor-queries zouden
  // voor een veldrol meteen een fout gooien).
  if (rol === null) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <LaadIndicator formaat="pagina" tekst="Laden…" />
      </div>
    );
  }

  if (isKantoor) {
    return (
      <DataFetchErrorBoundary dataDescription="De controlekamer">
        <KantoorGezicht />
      </DataFetchErrorBoundary>
    );
  }

  if (rol === "voorman") {
    return (
      <DataFetchErrorBoundary dataDescription="De ploegdag">
        <PloegDagGezicht />
      </DataFetchErrorBoundary>
    );
  }

  return (
    <DataFetchErrorBoundary dataDescription="Jouw week">
      <MijnWeekGezicht />
    </DataFetchErrorBoundary>
  );
}

/**
 * Kantoor: de Controlekamer, of — met `?weergave=film` in de URL — de
 * Ploegenfilm van de gekozen dag. De doorklik zit op elke dagkaart in
 * "Wat wijkt af?" en op elke archiefdag.
 */
function KantoorGezicht() {
  const { filmActief, dag, openFilm, kiesDag, sluitFilm } = useFilmKeuze();

  if (filmActief) {
    return <PloegenFilm datum={dag} onKiesDag={kiesDag} onSluit={sluitFilm} />;
  }
  return <KantoorControlekamer onDagFilm={({ datum }) => openFilm(datum)} />;
}
