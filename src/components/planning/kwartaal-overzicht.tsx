"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { addWeeks, getISOWeek, startOfISOWeek } from "date-fns";
import { api } from "../../../convex/_generated/api";
import { Skeleton } from "@/components/ui/skeleton";
import { SectiePaneel } from "@/components/ui/sectie-paneel";
import { getCapaciteitKleur } from "./capaciteit-indicator";
import {
  BezettingBalk,
  MAAND_KORT,
  NU_MARKERING,
  PeriodeWerkbalk,
  SamenvattingRegel,
  UREN_PER_DAG,
  bezettingPct,
  formatGetal,
  isoDatum,
  telwoord,
  werkdagenInMaand,
} from "./periode-onderdelen";
import { cn } from "@/lib/utils";
import { useVorigeData } from "@/hooks/use-vorige-data";

interface KwartaalOverzichtProps {
  initialYear?: number;
  initialQuarter?: number;
}

interface KwartaalWeek {
  nummer: number;
  maandag: string;
  /** "28 sep" */
  datumLabel: string;
  data: {
    aantalTaken: number;
    geplandeUren: number;
    bezetting: number;
    aantalMedewerkers: number;
  } | null;
}

/** Lijst van de weken met werk: week · bezetting · uren · mensen · taken. */
const RIJ =
  "grid grid-cols-[minmax(0,5.5rem)_minmax(0,1fr)_3.5rem] items-center gap-3 px-3.5 @xl/sectie:grid-cols-[7.5rem_minmax(0,1fr)_4.5rem_4.5rem_5rem] @xl/sectie:gap-4";

/** "44", "44 tot en met 53", gegroepeerd in aaneengesloten reeksen. */
function wekenTekst(nummers: number[], weken: KwartaalWeek[]): string {
  // Reeksen op volgorde in het kwartaal (niet op nummer: wk 1 kan na wk 52 komen).
  const volgorde = weken.map((w) => w.nummer);
  const reeksen: number[][] = [];
  for (const nr of nummers) {
    const laatste = reeksen[reeksen.length - 1];
    const vorige = laatste?.[laatste.length - 1];
    if (laatste && volgorde.indexOf(nr) === volgorde.indexOf(vorige!) + 1) laatste.push(nr);
    else reeksen.push([nr]);
  }
  const delen = reeksen.map((r) =>
    r.length === 1 ? `${r[0]}` : r.length === 2 ? `${r[0]} en ${r[1]}` : `${r[0]} tot en met ${r[r.length - 1]}`
  );
  if (delen.length === 1) return delen[0];
  return `${delen.slice(0, -1).join(", ")} en ${delen[delen.length - 1]}`;
}

export function KwartaalOverzicht({ initialYear, initialQuarter }: KwartaalOverzichtProps) {
  const now = new Date();
  const currentQuarter = Math.ceil((now.getMonth() + 1) / 3);
  const [year, setYear] = useState(initialYear ?? now.getFullYear());
  const [quarter, setQuarter] = useState(initialQuarter ?? currentQuarter);

  // Vorig resultaat vasthouden bij navigeren: de panelen dimmen even in
  // plaats van terug te vallen op skeletons (geen layout shift).
  const { data, verversen } = useVorigeData(useQuery(api.weekPlanning.listByQuarter, { year, quarter }));
  const dimKlasse = cn("transition-opacity", verversen && "opacity-60");

  const prevQuarter = () => {
    if (quarter === 1) {
      setYear(year - 1);
      setQuarter(4);
    } else {
      setQuarter(quarter - 1);
    }
  };

  const nextQuarter = () => {
    if (quarter === 4) {
      setYear(year + 1);
      setQuarter(1);
    } else {
      setQuarter(quarter + 1);
    }
  };

  const goToHuidigKwartaal = () => {
    setYear(now.getFullYear());
    setQuarter(currentQuarter);
  };

  const startMaand = (quarter - 1) * 3 + 1; // 1-12
  const huidigeMaandag = isoDatum(startOfISOWeek(now));

  // Elke ISO-week die een dag van het kwartaal raakt, ook de lege.
  const weken: KwartaalWeek[] = useMemo(() => {
    const perNummer = new Map((data?.weken ?? []).map((w) => [w.weekNummer, w]));
    const laatste = new Date(year, startMaand + 2, 0);
    const lijst: KwartaalWeek[] = [];
    let maandag = startOfISOWeek(new Date(year, startMaand - 1, 1));
    while (maandag <= laatste) {
      const nummer = getISOWeek(maandag);
      const w = perNummer.get(nummer);
      lijst.push({
        nummer,
        maandag: isoDatum(maandag),
        datumLabel: `${maandag.getDate()} ${MAAND_KORT[maandag.getMonth()]}`,
        data: w
          ? {
              aantalTaken: w.aantalTaken,
              geplandeUren: w.geplandeUren,
              bezetting: w.bezetting,
              aantalMedewerkers: w.aantalMedewerkers,
            }
          : null,
      });
      maandag = addWeeks(maandag, 1);
    }
    return lijst;
  }, [data, year, startMaand]);

  // Kwartaaltotaal: capaciteit over alle werkdagen van het kwartaal, niet alleen
  // over de weken waarin al iets staat.
  const totaal = useMemo(() => {
    if (!data) return null;
    const gepland = data.weken.reduce((s, w) => s + w.geplandeUren, 0);
    const taken = data.weken.reduce((s, w) => s + w.aantalTaken, 0);
    const werkdagen = [0, 1, 2].reduce((s, i) => s + werkdagenInMaand(year, startMaand + i), 0);
    const beschikbaar = data.totaalMedewerkers * UREN_PER_DAG * werkdagen;
    return { gepland, taken, beschikbaar, pct: bezettingPct(gepland, beschikbaar) };
  }, [data, year, startMaand]);

  const wekenMetWerk = weken.filter((w) => w.data);
  const legeWeken = weken.filter((w) => !w.data).map((w) => w.nummer);
  const kwartaalLabel = `${MAAND_KORT[startMaand - 1]} – ${MAAND_KORT[startMaand + 1]}`;

  return (
    <div className="flex flex-col gap-4">
      {totaal ? (
        <SamenvattingRegel
          label={`Q${quarter}`}
          delen={[
            totaal.beschikbaar > 0
              ? {
                  sterk: formatGetal(totaal.gepland),
                  staart: ` van ${formatGetal(totaal.beschikbaar)} uur gepland`,
                }
              : { sterk: formatGetal(totaal.gepland), staart: " uur gepland" },
            ...(totaal.pct !== null
              ? [{ sterk: `${totaal.pct}%`, staart: " gemiddeld bezet" }]
              : []),
            { sterk: formatGetal(totaal.taken), staart: totaal.taken === 1 ? " taak" : " taken" },
          ]}
        />
      ) : (
        <Skeleton className="h-[22px] w-72" />
      )}

      <PeriodeWerkbalk
        titel={`Q${quarter} ${year}`}
        subtitel={kwartaalLabel}
        vorigeLabel="Vorig kwartaal"
        volgendeLabel="Volgend kwartaal"
        vandaagLabel="Dit kwartaal"
        onVorige={prevQuarter}
        onVolgende={nextQuarter}
        onVandaag={goToHuidigKwartaal}
      />

      <SectiePaneel
        className={dimKlasse}
        titel="Bezetting per week"
        kopbalk
        acties={
          data && data.totaalMedewerkers > 0 ? (
            <span className="truncate text-[13px] text-muted-foreground tabular-nums">
              {telwoord(data.totaalMedewerkers, "medewerker", "medewerkers")} · {UREN_PER_DAG} uur per
              dag · 5 werkdagen
            </span>
          ) : undefined
        }
      >
        <div
          className="grid grid-cols-7 gap-1 p-2.5 @xl/sectie:grid-cols-[repeat(var(--weken),minmax(0,1fr))]"
          style={{ "--weken": weken.length } as React.CSSProperties}
        >
          {weken.map((week) => {
            const isNu = week.maandag === huidigeMaandag;
            const pct = week.data?.bezetting ?? 0;
            const label = week.data
              ? `Week ${week.nummer}${isNu ? " (deze week)" : ""}: ${pct}% bezet, ${formatGetal(week.data.geplandeUren)} uur gepland`
              : `Week ${week.nummer}${isNu ? " (deze week)" : ""}: nog niets gepland`;
            return (
              <Link
                key={week.maandag}
                href={`/planning/weekbord?datum=${week.maandag}`}
                aria-label={`${label}. Naar het weekbord`}
                className={cn(
                  "flex min-w-0 flex-col items-center gap-1.5 rounded-md px-0.5 py-2 transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isNu && NU_MARKERING
                )}
              >
                {data === undefined ? (
                  <Skeleton className="h-4 w-7" />
                ) : (
                  <span
                    className={cn(
                      "text-xs font-semibold tabular-nums",
                      !week.data && "font-normal text-muted-foreground"
                    )}
                  >
                    {week.data ? `${pct}%` : "—"}
                  </span>
                )}
                <span
                  aria-hidden
                  className="flex h-24 w-full max-w-11 items-end overflow-hidden rounded-md bg-muted @xl/sectie:h-44"
                >
                  {week.data && pct > 0 && (
                    <span
                      className={cn("block w-full rounded-t-md", getCapaciteitKleur(pct).fill)}
                      style={{ height: `${Math.min(Math.max(pct, 2), 100)}%` }}
                    />
                  )}
                </span>
                <span
                  className={cn(
                    "max-w-full truncate text-[11px] tabular-nums text-muted-foreground",
                    isNu && "font-semibold text-primary"
                  )}
                >
                  {isNu ? `nu · ${week.nummer}` : `wk ${week.nummer}`}
                </span>
              </Link>
            );
          })}
        </div>
        <p className="px-3.5 pb-3 text-xs text-muted-foreground">
          Een lege week is vrije capaciteit — klik een week om op het weekbord te plannen.
        </p>
      </SectiePaneel>

      {data === undefined ? (
        <SectiePaneel titel="Weken met werk" kopbalk>
          <div className="space-y-2 p-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-8" />
            ))}
          </div>
        </SectiePaneel>
      ) : wekenMetWerk.length === 0 ? (
        <SectiePaneel
          className={dimKlasse}
          titel="Weken met werk"
          kopbalk
          legeRegel={{ tekst: "Nog niets gepland dit kwartaal." }}
          acties={
            <Link
              href="/planning/weekbord"
              className="shrink-0 text-[13px] font-medium text-primary transition-colors hover:text-primary/80"
            >
              Plannen op het weekbord &rarr;
            </Link>
          }
        />
      ) : (
        <SectiePaneel className={dimKlasse} titel="Weken met werk" kopbalk telling={wekenMetWerk.length}>
          <div className="p-1">
            <div aria-hidden className={cn(RIJ, "py-1.5 text-xs text-muted-foreground")}>
              <span>Week</span>
              <span>Bezetting</span>
              <span className="text-end">Uren</span>
              <span className="hidden text-end @xl/sectie:block">Mensen</span>
              <span className="hidden text-end @xl/sectie:block">Taken</span>
            </div>
            {wekenMetWerk.map((week) => {
              const w = week.data!;
              const isNu = week.maandag === huidigeMaandag;
              return (
                <Link
                  key={week.maandag}
                  href={`/planning/weekbord?datum=${week.maandag}`}
                  aria-label={`Week ${week.nummer}${isNu ? " (deze week)" : `, vanaf ${week.datumLabel}`}: ${w.bezetting}% bezet, ${formatGetal(w.geplandeUren)} uur, ${telwoord(w.aantalMedewerkers, "persoon", "mensen")}, ${telwoord(w.aantalTaken, "taak", "taken")}. Naar het weekbord`}
                  className={cn(
                    RIJ,
                    "rounded-md py-2.5 text-sm transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isNu && "bg-primary/5"
                  )}
                >
                  <span className="flex min-w-0 flex-wrap items-baseline gap-x-1.5">
                    <span className="font-semibold">Week {week.nummer}</span>
                    <span
                      className={cn(
                        "text-xs tabular-nums text-muted-foreground",
                        isNu && "text-primary"
                      )}
                    >
                      {isNu ? "deze week" : week.datumLabel}
                    </span>
                  </span>
                  <span className="flex min-w-0 items-center gap-2.5">
                    <BezettingBalk pct={w.bezetting} className="h-1.5 flex-1" />
                    <span className="w-9 text-end text-[13px] font-semibold tabular-nums">
                      {w.bezetting}%
                    </span>
                  </span>
                  <span className="text-end tabular-nums">{formatGetal(w.geplandeUren)} u</span>
                  <span className="hidden text-end tabular-nums @xl/sectie:block">
                    {formatGetal(w.aantalMedewerkers)}
                  </span>
                  <span className="hidden text-end tabular-nums @xl/sectie:block">
                    {formatGetal(w.aantalTaken)}
                  </span>
                </Link>
              );
            })}
            {legeWeken.length > 0 && (
              <p className="px-3.5 pt-2.5 pb-3 text-[13px] text-muted-foreground">
                Week {wekenTekst(legeWeken, weken)}{" "}
                {legeWeken.length === 1 ? "heeft" : "hebben"} nog niets staan.{" "}
                <Link
                  href="/planning/weekbord"
                  className="font-medium text-primary transition-colors hover:text-primary/80"
                >
                  Plannen op het weekbord &rarr;
                </Link>
              </p>
            )}
          </div>
        </SectiePaneel>
      )}
    </div>
  );
}
