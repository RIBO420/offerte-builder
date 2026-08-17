"use client";

/**
 * De Ploegenfilm — de dag-doorklik van de Controlekamer (concept C).
 *
 * De as omgedraaid: niet mensen × dagen, maar één dag, alle ploegen. Per ploeg
 * een hoofdstuk met de dagbalken van alle leden op dezelfde tijd-as, zodat je
 * in één blik ziet dat de ploeg synchroon liep — en waar iemand uit de pas
 * ging. Bovenaan de filmstrip-dagkiezer (10 werkdagen, wrap — nooit zijwaarts
 * scrollen), onderaan het dagtotaal als zin. Een regen- of uitvaldag vertelt
 * zichzelf: alle balken van een ploeg krijgen dezelfde loods-kleur.
 *
 * Deeplinkbaar als `?dag=YYYY-MM-DD&weergave=film` — "kijk even naar de
 * dagfilm van donderdag" is één link (plan §3 WS-C).
 */

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Clapperboard, Users } from "lucide-react";
import { api } from "@convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SectiePaneel } from "@/components/ui/sectie-paneel";
import { REVEAL_KLASSE } from "@/components/pagina-reveal";
import { cn } from "@/lib/utils";
import { DagbalkRij } from "./dagbalk-rij";
import { Daginspector, type InspectorDag } from "./daginspector";
import { dagZin, gedeeldeAs } from "./film";
import { dagLabelLang } from "./week";

type DagFilm = FunctionReturnType<typeof api.urenControle.getDagFilm>;
type FilmStripDag = DagFilm["strip"][number];
type FilmPloeg = DagFilm["ploegen"][number];
type FilmDagSamenvatting = DagFilm["los"][number];

/** Status van een stripdag: stip + tekst — kleur is nooit de enige drager. */
const STRIP_STATUS: Record<
  FilmStripDag["status"],
  { stip: string; tekst: string }
> = {
  compleet: { stip: "bg-status-geaccepteerd-dot", tekst: "compleet" },
  open: { stip: "bg-muted-foreground/40", tekst: "nog open" },
  afwijkend: { stip: "bg-status-verzonden-dot", tekst: "wijkt af" },
};

export function PloegenFilm({
  datum,
  onKiesDag,
  onSluit,
}: {
  datum: string;
  onKiesDag: (datum: string) => void;
  onSluit: () => void;
}) {
  const film = useQuery(api.urenControle.getDagFilm, { datum });
  const [inspector, setInspector] = useState<InspectorDag | null>(null);

  // Eén tijd-as voor de hele dag: 07:00 ligt in elke rij op dezelfde plek,
  // over de ploegen heen.
  const as = useMemo(
    () =>
      gedeeldeAs([
        ...(film?.ploegen.flatMap((ploeg) => ploeg.leden) ?? []),
        ...(film?.los ?? []),
      ]),
    [film]
  );

  const openInspector = (lid: FilmDagSamenvatting) =>
    setInspector({
      medewerkerId: lid.medewerkerId,
      datum: lid.datum,
      naam: lid.naam,
    });

  const leeg = film !== undefined && film.ploegen.length === 0 && film.los.length === 0;

  return (
    <div className={cn("flex flex-1 flex-col gap-5 p-4 md:p-8", REVEAL_KLASSE)}>
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className="font-display flex min-w-0 items-center gap-2 text-[19px] leading-7 font-semibold tracking-tight">
            <Clapperboard
              className="size-4.5 shrink-0 text-muted-foreground"
              aria-hidden
            />
            {film?.dagLabel ?? dagLabelLang(datum)}
          </h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground">
            De dag als film: per ploeg de dagbalken van alle leden op dezelfde
            tijd-as.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8"
          onClick={onSluit}
        >
          Terug naar de controlekamer
        </Button>
      </div>

      {film === undefined ? (
        <FilmSkelet />
      ) : (
        <>
          <Filmstrip strip={film.strip} focus={datum} onKiesDag={onKiesDag} />

          {leeg ? (
            <SectiePaneel
              kopbalk
              titel="Geen film voor deze dag"
              icoon={<Clapperboard aria-hidden />}
              legeRegel={{
                tekst: "Geen ploegen gepland en geen uren gelogd.",
                hint: "Kies hierboven een andere dag uit de filmstrip.",
              }}
            />
          ) : (
            <div className="flex flex-col gap-4">
              {film.ploegen.map((ploeg) => (
                <PloegHoofdstuk
                  key={ploeg.teamId}
                  ploeg={ploeg}
                  asVanMinuten={as.asVanMinuten}
                  asTotMinuten={as.asTotMinuten}
                  onLid={openInspector}
                />
              ))}

              {film.los.length > 0 && (
                <SectiePaneel
                  kopbalk
                  titel="Los van een ploeg"
                  icoon={<Users aria-hidden />}
                  telling={film.los.length}
                  uitleg="Mensen met uren die deze dag niet in een ploeg zaten: materiaalman, zzp'ers, kantoor."
                >
                  <div className="divide-y divide-border/70">
                    {film.los.map((lid, i) => (
                      <DagbalkRij
                        key={lid.medewerkerId}
                        label={lid.naam}
                        balkLabel={`${lid.naam}, ${dagLabelLang(lid.datum)}`}
                        segmenten={lid.segmenten}
                        asVanMinuten={as.asVanMinuten}
                        asTotMinuten={as.asTotMinuten}
                        uren={lid.totaalUren}
                        status={lid.status}
                        metAs={i === film.los.length - 1}
                        onClick={() => openInspector(lid)}
                      />
                    ))}
                  </div>
                </SectiePaneel>
              )}

              <p className="rounded-lg border bg-muted/30 px-3 py-2.5 text-[13px] tabular-nums">
                {dagZin(film.totaalZin)}
              </p>
            </div>
          )}
        </>
      )}

      <Daginspector dag={inspector} onSluit={() => setInspector(null)} />
    </div>
  );
}

/**
 * De dagkiezer: de laatste tien werkdagen als tegels met statusstip. De rij
 * wrapt — op een smal scherm worden het twee regels, nooit een zijwaartse
 * scroll (CLAUDE.md regel 1).
 */
function Filmstrip({
  strip,
  focus,
  onKiesDag,
}: {
  strip: FilmStripDag[];
  focus: string;
  onKiesDag: (datum: string) => void;
}) {
  return (
    <nav aria-label="Kies een dag">
      <ul className="flex flex-wrap gap-2">
        {strip.map((dag) => {
          const actief = dag.datum === focus;
          const status = STRIP_STATUS[dag.status];
          return (
            <li key={dag.datum}>
              <button
                type="button"
                onClick={() => onKiesDag(dag.datum)}
                aria-current={actief ? "date" : undefined}
                aria-label={`${dag.kortLabel} — ${status.tekst}`}
                title={`${dag.kortLabel} — ${status.tekst}`}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-lg border bg-card px-3 py-1.5 text-[13px] font-medium tabular-nums transition-colors",
                  actief
                    ? "border-primary/50 bg-primary/10"
                    : "hover:bg-muted/40"
                )}
              >
                {dag.kortLabel}
                <span
                  aria-hidden="true"
                  data-status={dag.status}
                  className={cn("size-1.5 rounded-full", status.stip)}
                />
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Eén ploeg als hoofdstuk: kopbalk, rit-regel, en de leden op één tijd-as. */
function PloegHoofdstuk({
  ploeg,
  asVanMinuten,
  asTotMinuten,
  onLid,
}: {
  ploeg: FilmPloeg;
  asVanMinuten: number;
  asTotMinuten: number;
  onLid: (lid: FilmDagSamenvatting) => void;
}) {
  const rit = [
    ploeg.voermanNaam ? `voorman ${ploeg.voermanNaam}` : null,
    ploeg.busLabel ? `bus ${ploeg.busLabel}` : null,
  ].filter((deel): deel is string => deel !== null);

  return (
    <SectiePaneel
      kopbalk
      titel={ploeg.naam}
      icoon={<Users aria-hidden />}
      telling={ploeg.leden.length}
    >
      {(rit.length > 0 || ploeg.stops.length > 0) && (
        <p className="border-b bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground">
          {rit.join(" · ")}
          {rit.length > 0 && ploeg.stops.length > 0 && " · "}
          {ploeg.stops.join(" → ")}
        </p>
      )}
      {ploeg.leden.length === 0 ? (
        <p className="px-3 py-2 text-[13px] text-muted-foreground">
          Geen leden met een dag om te tonen.
        </p>
      ) : (
        <div className="divide-y divide-border/70">
          {ploeg.leden.map((lid, i) => (
            <DagbalkRij
              key={lid.medewerkerId}
              label={lid.naam}
              balkLabel={`${lid.naam}, ${dagLabelLang(lid.datum)}`}
              segmenten={lid.segmenten}
              asVanMinuten={asVanMinuten}
              asTotMinuten={asTotMinuten}
              uren={lid.totaalUren}
              status={lid.status}
              metAs={i === ploeg.leden.length - 1}
              onClick={() => onLid(lid)}
            />
          ))}
        </div>
      )}
    </SectiePaneel>
  );
}

/** Skelet in de vorm van de film: strip + twee hoofdstukken. */
function FilmSkelet() {
  return (
    <div
      className="flex flex-col gap-4"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">Ploegenfilm laden…</span>
      <div className="flex flex-wrap gap-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-[52px] w-[72px] rounded-lg" />
        ))}
      </div>
      {[0, 1].map((i) => (
        <div key={i} className="overflow-hidden rounded-lg border bg-card">
          <div className="flex items-center gap-2 border-b bg-muted/40 px-3 py-2.5">
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="flex flex-col gap-3 p-3">
            <Skeleton className="h-[10px] w-full rounded" />
            <Skeleton className="h-[10px] w-full rounded" />
            <Skeleton className="h-[10px] w-full rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
