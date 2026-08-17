"use client";

/**
 * Het kantoor-gezicht van `/uren`: de Controlekamer.
 *
 * Vier vragen onder elkaar, in de volgorde waarin kantoor ze stelt:
 * **wie is achter → wat wijkt af → wat kan door → waar zoek ik iets terug.**
 * Dat is dezelfde beweging als rapportages (vier vragen) en de dagstaat (actie
 * boven informatie): van datasoort-ordening naar vraag-ordening.
 *
 * Wat hier met opzet níet meer staat (onderzoek §0 en §6, bindend):
 * de vier statkaarten ("Deze Week 0,0", "Totaal 346,3", "Registraties 44"), de
 * voortgangsbalk-kaarten "Uren per Project" en de zeven filtercontrols boven een
 * gepagineerde tabel. De structuur ís het filter; één periode-kiezer in het
 * archief is genoeg. En er staat geen geld op deze pagina (besluit Ricardo).
 */

import { useState } from "react";
import { useQuery } from "convex/react";
import { useIsKantoor } from "@/hooks/use-users";
import {
  ExportDropdown,
  urenExportColumns,
} from "@/components/export-dropdown";
import { api } from "@convex/_generated/api";
import { Skeleton } from "@/components/ui/skeleton";
import { REVEAL_KLASSE } from "@/components/pagina-reveal";
import { cn } from "@/lib/utils";
import { AfwijkingenBlok } from "./afwijkingen-blok";
import { ArchiefBlok } from "./archief-blok";
import { getControleWeekRef } from "./controle-api";
import { ControlekamerKop } from "./controlekamer-kop";
import { Daginspector, type InspectorDag } from "./daginspector";
import { KanDoorBlok } from "./kan-door-blok";
import { WieIsAchterBlok } from "./wie-is-achter-blok";
import { useWeekKeuze, weekLabelVan } from "./week";

/**
 * De backend levert één `weekLabel` ("Week 33 · 10 t/m 16 augustus"); de kop
 * gebruikt de twee helften apart. Ontbreekt het label (of de backend), dan
 * rekent de UI het zelf uit — de kop is nooit leeg.
 */
export function splitsWeekLabel(
  label: string | undefined,
  weekStart: string
): { weekLabel: string; periodeLabel: string } {
  const bron = label && label.includes("·") ? label : weekLabelVan(weekStart);
  const [kop, ...rest] = bron.split("·");
  return {
    weekLabel: kop.trim(),
    periodeLabel: rest.join("·").trim(),
  };
}

export function KantoorControlekamer({
  onDagFilm,
}: {
  /**
   * WS-C hangt hier de film-doorklik aan: `(dag) => kiesFilm(dag.datum)`. Zonder
   * de prop blijft de knop weg op elke dagkaart.
   */
  onDagFilm?: (dag: { medewerkerId: string; datum: string }) => void;
}) {
  const { weekStart, kiesWeek, schuif, isDezeWeek } = useWeekKeuze();
  const isKantoor = useIsKantoor();
  const [inspector, setInspector] = useState<InspectorDag | null>(null);

  const week = useQuery(getControleWeekRef, { weekStart });

  // Export blijft op de oude bron (`export.exportUren`): dat is de bron waar de
  // loonadministratie op draait. Bewust niet gemengd met de dagcontrole — één
  // export, één waarheid (onderzoek §6).
  const exportData = useQuery(api.export.exportUren, isKantoor ? {} : "skip");

  const { weekLabel, periodeLabel } = splitsWeekLabel(week?.weekLabel, weekStart);
  const stand = {
    afwijkend: week?.afwijkend.length ?? 0,
    achter: week?.achter.length ?? 0,
    stil: week?.stil.length ?? 0,
  };

  const exportKnop = isKantoor
    ? (variant: "default" | "outline") => (
        <ExportDropdown
          getData={() => exportData ?? []}
          columns={urenExportColumns}
          filename={`uren-${weekStart}`}
          sheetName="Uren"
          buttonLabel="Export naar loon"
          buttonVariant={variant}
          buttonSize="sm"
          className="h-8"
          disabled={!exportData || exportData.length === 0}
        />
      )
    : undefined;

  return (
    <div className={cn("flex flex-1 flex-col gap-5 p-4 md:p-8", REVEAL_KLASSE)}>
      <ControlekamerKop
        weekLabel={weekLabel}
        periodeLabel={periodeLabel}
        stand={stand}
        isDezeWeek={isDezeWeek}
        onVorige={() => schuif(-1)}
        onVolgende={() => schuif(1)}
        onDezeWeek={() => kiesWeek(weekStart)}
        acties={exportKnop?.(
          stand.achter === 0 && stand.afwijkend === 0 ? "default" : "outline"
        )}
      />

      {week === undefined ? (
        <ControlekamerSkelet />
      ) : (
        <div className="flex flex-col gap-4">
          <WieIsAchterBlok achter={week.achter} />

          <AfwijkingenBlok
            afwijkend={week.afwijkend}
            onCorrigeren={setInspector}
            onDagFilm={onDagFilm}
          />

          <KanDoorBlok
            stil={week.stil}
            weekStart={weekStart}
            achterAantal={week.achter.length}
            afwijkendAantal={week.afwijkend.length}
            gekweten={week.gekweten}
            exportKnop={exportKnop}
          />

          <ArchiefBlok onDagFilm={onDagFilm} />
        </div>
      )}

      <Daginspector dag={inspector} onSluit={() => setInspector(null)} />
    </div>
  );
}

/**
 * Skelet in de vórm van de drie vraagblokken — geen statkaart-raster. Wat je
 * ziet laden hoort te lijken op wat er komt.
 */
function ControlekamerSkelet() {
  return (
    <div
      className="flex flex-col gap-4"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">Controlekamer laden…</span>
      {[0, 1, 2].map((i) => (
        <div key={i} className="overflow-hidden rounded-lg border bg-card">
          <div className="flex items-center gap-2 border-b bg-muted/40 px-3 py-2.5">
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="flex flex-col gap-3 p-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-[22px] w-full rounded-md" />
            {i === 1 && <Skeleton className="h-8 w-56" />}
          </div>
        </div>
      ))}
    </div>
  );
}
