"use client";

import React, { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { addDays, getISOWeek, startOfISOWeek } from "date-fns";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SectiePaneel } from "@/components/ui/sectie-paneel";
import { X } from "lucide-react";
import { CapaciteitIndicator } from "./capaciteit-indicator";
import {
  BezettingBalk,
  BezettingLegenda,
  MAAND_NAMEN,
  PeriodeWerkbalk,
  SamenvattingRegel,
  UREN_PER_DAG,
  WEEKEND_ARCERING,
  bezettingPct,
  formatGetal,
  isoDatum,
  telwoord,
  werkdagenInMaand,
} from "./periode-onderdelen";
import { cn } from "@/lib/utils";
import { useVorigeData } from "@/hooks/use-vorige-data";

const DAG_NAMEN = ["ma", "di", "wo", "do", "vr", "za", "zo"];

/** Week-kolom, vijf gelijke werkdagen en een smaller weekend (0,6). */
const RASTER =
  "grid grid-cols-[2.25rem_repeat(5,minmax(0,1fr))_repeat(2,minmax(0,0.6fr))] @2xl/maand:grid-cols-[2.75rem_repeat(5,minmax(0,1fr))_repeat(2,minmax(0,0.6fr))]";

interface MaandKalenderProps {
  initialYear?: number;
  initialMonth?: number;
}

type MaandData = FunctionReturnType<typeof api.weekPlanning.listByMonth>;
type DagDetail = MaandData["perDag"][string];

interface KalenderDag {
  datum: string;
  dag: number;
  inMaand: boolean;
  weekend: boolean;
}

/** Het project met de meeste taken die dag, plus hoeveel andere projecten er nog zijn. */
function hoofdProject(taken: DagDetail["taken"]): { naam: string; overige: number } | null {
  const perProject = new Map<string, { naam: string; aantal: number }>();
  for (const taak of taken) {
    const huidig = perProject.get(taak.projectId);
    if (huidig) huidig.aantal += 1;
    else perProject.set(taak.projectId, { naam: taak.projectNaam, aantal: 1 });
  }
  let beste: { naam: string; aantal: number } | null = null;
  for (const p of perProject.values()) {
    if (!beste || p.aantal > beste.aantal) beste = p;
  }
  return beste ? { naam: beste.naam, overige: perProject.size - 1 } : null;
}

// Eén dag in het raster
const KalenderCel = React.memo(function KalenderCel({
  cel,
  maandNaam,
  isVandaag,
  isVerleden,
  dagData,
  isSelected,
  onSelect,
}: {
  cel: KalenderDag;
  maandNaam: string;
  isVandaag: boolean;
  isVerleden: boolean;
  dagData: DagDetail | null;
  isSelected: boolean;
  onSelect: (datum: string) => void;
}) {
  const heeftWerk = !!dagData && dagData.aantalTaken > 0;
  const pct = dagData ? bezettingPct(dagData.uren, dagData.beschikbareUren) : null;
  const project = heeftWerk ? hoofdProject(dagData.taken) : null;

  const basis = cn(
    "flex min-h-16 min-w-0 flex-col gap-1.5 border-t border-l px-1.5 py-1.5 text-left transition-colors @2xl/maand:min-h-[104px] @2xl/maand:px-2.5 @2xl/maand:py-2",
    cel.weekend && WEEKEND_ARCERING,
    isVandaag && "bg-primary/5 ring-2 ring-inset ring-primary/70",
    isSelected && "bg-accent"
  );

  const inhoud = (
    <>
      <span
        className={cn(
          "text-[13px] font-semibold tabular-nums",
          !cel.inMaand && "text-muted-foreground/60",
          cel.inMaand && cel.weekend && "text-muted-foreground",
          isVandaag && "text-primary"
        )}
      >
        {cel.dag}
      </span>
      {isVandaag && (
        <span className="hidden text-[11px] font-semibold text-primary @2xl/maand:block">
          vandaag
        </span>
      )}
      {heeftWerk && (
        <>
          <BezettingBalk pct={pct ?? 0} />
          <span className="hidden text-[11px] tabular-nums text-muted-foreground @3xl/maand:block">
            {telwoord(dagData.medewerkers.length, "persoon", "mensen")} ·{" "}
            {telwoord(dagData.aantalTaken, "taak", "taken")}
          </span>
          <span className="truncate text-[11px] tabular-nums text-muted-foreground @3xl/maand:hidden">
            {telwoord(dagData.aantalTaken, "taak", "taken")}
          </span>
          {project && (
            <span className="hidden truncate rounded border border-status-gepland-border bg-status-gepland px-1.5 py-px text-[11px] text-foreground @2xl/maand:block">
              {project.naam}
            </span>
          )}
          {project && project.overige > 0 && (
            <span className="hidden text-[11px] tabular-nums text-muted-foreground @2xl/maand:block">
              + {telwoord(project.overige, "project", "projecten")}
            </span>
          )}
        </>
      )}
      {!heeftWerk && cel.inMaand && !cel.weekend && isVerleden && (
        <span className="hidden text-[11px] text-muted-foreground @2xl/maand:block">
          niets gepland
        </span>
      )}
    </>
  );

  if (!heeftWerk) {
    return <div className={basis}>{inhoud}</div>;
  }

  const label = [
    `${cel.dag} ${maandNaam.toLowerCase()}${isVandaag ? " (vandaag)" : ""}`,
    telwoord(dagData.medewerkers.length, "persoon", "mensen"),
    telwoord(dagData.aantalTaken, "taak", "taken"),
    pct !== null ? `${pct}% bezet` : null,
    project
      ? project.overige > 0
        ? `${project.naam} en ${telwoord(project.overige, "ander project", "andere projecten")}`
        : project.naam
      : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <button
      type="button"
      onClick={() => onSelect(cel.datum)}
      aria-pressed={isSelected}
      aria-label={label}
      className={cn(
        basis,
        "cursor-pointer hover:bg-muted/60 focus-visible:relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      )}
    >
      {inhoud}
    </button>
  );
});

// Dagdetail onder de kalender
function DagDetailPanel({
  dagData,
  onClose,
}: {
  dagData: DagDetail;
  onClose: () => void;
}) {
  const bezetting = bezettingPct(dagData.uren, dagData.beschikbareUren) ?? 0;

  const datum = new Date(dagData.datum + "T00:00:00");
  const dagLabel = datum.toLocaleDateString("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const titel = dagLabel.charAt(0).toUpperCase() + dagLabel.slice(1);

  // Taken per project
  const perProject = new Map<string, { projectNaam: string; taken: DagDetail["taken"] }>();
  for (const taak of dagData.taken) {
    const groep = perProject.get(taak.projectId);
    if (groep) groep.taken.push(taak);
    else perProject.set(taak.projectId, { projectNaam: taak.projectNaam, taken: [taak] });
  }

  return (
    <SectiePaneel
      titel={titel}
      kopbalk
      acties={
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Dagdetail sluiten">
          <X className="size-4" aria-hidden />
        </Button>
      }
    >
      <div className="flex flex-col gap-3 p-3">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground tabular-nums">
          <span>
            <span className="font-semibold text-foreground">{formatGetal(dagData.uren)}</span> uur gepland
          </span>
          <span>{telwoord(dagData.medewerkers.length, "medewerker", "medewerkers")}</span>
          <CapaciteitIndicator bezetting={bezetting} variant="badge" />
        </p>
        <div className="grid gap-2 @2xl/sectie:grid-cols-2">
          {[...perProject.entries()].map(([projectId, { projectNaam, taken }]) => (
            <div key={projectId} className="min-w-0 rounded-md border p-3">
              <h3 className="mb-2 truncate text-sm font-medium">{projectNaam}</h3>
              <ul className="space-y-1">
                {taken.map((taak) => (
                  <li key={taak._id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate text-muted-foreground">
                      {taak.medewerkerNaam}
                    </span>
                    <Badge variant="secondary" className="shrink-0 text-xs tabular-nums">
                      {formatGetal(taak.uren ?? UREN_PER_DAG)} u
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </SectiePaneel>
  );
}

export function MaandKalender({ initialYear, initialMonth }: MaandKalenderProps) {
  const now = new Date();
  const [year, setYear] = useState(initialYear ?? now.getFullYear());
  const [month, setMonth] = useState(initialMonth ?? now.getMonth() + 1);
  const [selectedDag, setSelectedDag] = useState<string | null>(null);

  // Vorig resultaat vasthouden bij een andere maand: de kalender dimt even
  // in plaats van terug te vallen op skeletoncellen (geen layout shift).
  const { data, verversen } = useVorigeData(
    useQuery(api.weekPlanning.listByMonth, { year, month })
  );

  const prevMonth = () => {
    if (month === 1) {
      setYear(year - 1);
      setMonth(12);
    } else {
      setMonth(month - 1);
    }
    setSelectedDag(null);
  };

  const nextMonth = () => {
    if (month === 12) {
      setYear(year + 1);
      setMonth(1);
    } else {
      setMonth(month + 1);
    }
    setSelectedDag(null);
  };

  const goToToday = () => {
    setYear(now.getFullYear());
    setMonth(now.getMonth() + 1);
    setSelectedDag(null);
  };

  // Hele weken van maandag t/m zondag; dagen buiten de maand vullen de randen.
  const weken = useMemo(() => {
    const eerste = new Date(year, month - 1, 1);
    const laatste = new Date(year, month, 0);
    const rijen: Array<{ nummer: number; dagen: KalenderDag[] }> = [];
    let maandag = startOfISOWeek(eerste);
    while (maandag <= laatste) {
      const dagen: KalenderDag[] = [];
      for (let i = 0; i < 7; i++) {
        const d = addDays(maandag, i);
        dagen.push({
          datum: isoDatum(d),
          dag: d.getDate(),
          inMaand: d.getMonth() === month - 1,
          weekend: i >= 5,
        });
      }
      rijen.push({ nummer: getISOWeek(maandag), dagen });
      maandag = addDays(maandag, 7);
    }
    return rijen;
  }, [year, month]);

  const vandaagStr = isoDatum(now);
  const maandNaam = MAAND_NAMEN[month - 1];

  // Maandtotaal uit de dagen die de query teruggeeft
  const totaal = useMemo(() => {
    if (!data) return null;
    const dagen = Object.values(data.perDag);
    const gepland = dagen.reduce((s, d) => s + d.uren, 0);
    const beschikbaar = data.beschikbareUrenPerDag * werkdagenInMaand(year, month);
    const projecten = new Set(dagen.flatMap((d) => d.taken.map((t) => t.projectId))).size;
    return { gepland, beschikbaar, projecten, pct: bezettingPct(gepland, beschikbaar) };
  }, [data, year, month]);

  const selectedDagData = selectedDag ? (data?.perDag[selectedDag] ?? null) : null;

  // Stabiel houden: KalenderCel is gememoïseerd en krijgt dit als prop.
  const selecteer = useCallback(
    (datum: string) => setSelectedDag((huidig) => (huidig === datum ? null : datum)),
    [setSelectedDag]
  );

  return (
    <div className="flex flex-col gap-4">
      {totaal ? (
        <SamenvattingRegel
          label={maandNaam}
          delen={[
            totaal.beschikbaar > 0
              ? {
                  sterk: formatGetal(totaal.gepland),
                  staart: ` van ${formatGetal(totaal.beschikbaar)} uur gepland`,
                }
              : { sterk: formatGetal(totaal.gepland), staart: " uur gepland" },
            ...(totaal.pct !== null ? [{ sterk: `${totaal.pct}%`, staart: " bezet" }] : []),
            {
              sterk: formatGetal(totaal.projecten),
              staart: totaal.projecten === 1 ? " project" : " projecten",
            },
          ]}
        />
      ) : (
        <Skeleton className="h-[22px] w-72" />
      )}

      <PeriodeWerkbalk
        titel={`${maandNaam} ${year}`}
        vorigeLabel="Vorige maand"
        volgendeLabel="Volgende maand"
        vandaagLabel="Vandaag"
        onVorige={prevMonth}
        onVolgende={nextMonth}
        onVandaag={goToToday}
      >
        <BezettingLegenda className="ml-auto" />
      </PeriodeWerkbalk>

      <section
        aria-label={`Maandkalender ${maandNaam.toLowerCase()} ${year}`}
        aria-busy={verversen || undefined}
        className={cn(
          "@container/maand overflow-hidden rounded-lg border bg-card transition-opacity",
          verversen && "opacity-60"
        )}
      >
        <div className={RASTER}>
          <span className="py-2.5 text-center text-[11px] text-muted-foreground">wk</span>
          {DAG_NAMEN.map((dag) => (
            <span key={dag} className="border-l px-1.5 py-2.5 text-xs text-muted-foreground @2xl/maand:px-2.5">
              {dag}
            </span>
          ))}

          {weken.map((week) => (
            <React.Fragment key={week.nummer}>
              <span className="flex justify-center border-t pt-1.5 @2xl/maand:pt-2">
                <Link
                  href={`/planning/weekbord?datum=${week.dagen[0].datum}`}
                  aria-label={`Week ${week.nummer}, naar het weekbord`}
                  className="inline-flex size-6 items-center justify-center rounded text-[11px] tabular-nums text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {week.nummer}
                </Link>
              </span>
              {week.dagen.map((cel) =>
                data === undefined ? (
                  <div
                    key={cel.datum}
                    className={cn(
                      "flex min-h-16 flex-col gap-1.5 border-t border-l p-1.5 @2xl/maand:min-h-[104px] @2xl/maand:px-2.5 @2xl/maand:py-2",
                      cel.weekend && WEEKEND_ARCERING
                    )}
                  >
                    <Skeleton className="h-3.5 w-4" />
                    {cel.inMaand && !cel.weekend && <Skeleton className="h-1 w-full" />}
                  </div>
                ) : (
                  <KalenderCel
                    key={cel.datum}
                    cel={cel}
                    maandNaam={MAAND_NAMEN[Number(cel.datum.slice(5, 7)) - 1]}
                    isVandaag={cel.datum === vandaagStr}
                    isVerleden={cel.datum < vandaagStr}
                    dagData={cel.inMaand ? (data.perDag[cel.datum] ?? null) : null}
                    isSelected={selectedDag === cel.datum}
                    onSelect={selecteer}
                  />
                )
              )}
            </React.Fragment>
          ))}
        </div>
      </section>

      {selectedDagData && (
        <DagDetailPanel dagData={selectedDagData} onClose={() => setSelectedDag(null)} />
      )}

      <p className="text-xs text-muted-foreground">
        Klik op een dag voor de taken per project; het weeknummer opent het weekbord.
        {data && data.totaalMedewerkers > 0 && (
          <>
            {" "}
            Bezetting = geplande uren tegenover{" "}
            {telwoord(data.totaalMedewerkers, "actieve medewerker", "actieve medewerkers")} ×{" "}
            {UREN_PER_DAG} uur per werkdag.
          </>
        )}
      </p>
    </div>
  );
}
