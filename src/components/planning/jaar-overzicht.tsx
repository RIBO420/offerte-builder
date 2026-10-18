"use client";

import React, { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Skeleton } from "@/components/ui/skeleton";
import { SectiePaneel } from "@/components/ui/sectie-paneel";
import {
  BezettingBalk,
  MAAND_KORT,
  MAAND_NAMEN,
  NU_MARKERING,
  PeriodeWerkbalk,
  SamenvattingRegel,
  UREN_PER_DAG,
  bezettingPct,
  formatGetal,
  telwoord,
} from "./periode-onderdelen";
import { cn } from "@/lib/utils";

interface JaarOverzichtProps {
  initialYear?: number;
  onNavigateToMonth?: (year: number, month: number) => void;
}

/**
 * Warmtekaart in drie stappen op uren per medewerker per maand:
 * tot een werkweek, tot anderhalve werkweek, en meer.
 */
const WARMTE = [
  { tot: 40, klasse: "bg-primary/15 text-foreground", label: "tot 40 uur" },
  { tot: 64, klasse: "bg-primary/30 text-foreground", label: "40 tot 64 uur" },
  { tot: Infinity, klasse: "bg-primary/50 font-semibold text-foreground", label: "64 uur of meer" },
];

function warmteKlasse(uren: number): string {
  return (WARMTE.find((stap) => uren < stap.tot) ?? WARMTE[WARMTE.length - 1]).klasse;
}

export function JaarOverzicht({ initialYear, onNavigateToMonth }: JaarOverzichtProps) {
  const now = new Date();
  const [year, setYear] = useState(initialYear ?? now.getFullYear());

  const data = useQuery(api.weekPlanning.getCapacityOverview, { year });

  const huidigeMaand = now.getMonth() + 1;
  const isHuidigJaar = year === now.getFullYear();

  const totaal = useMemo(() => {
    if (!data) return null;
    const gepland = data.maanden.reduce((s, m) => s + m.geplandeUren, 0);
    const beschikbaar = data.maanden.reduce((s, m) => s + m.beschikbareUren, 0);
    return { gepland, beschikbaar, pct: bezettingPct(gepland, beschikbaar) };
  }, [data]);

  // Alleen medewerkers met uren, gesorteerd op totaal
  const medewerkers = useMemo(() => {
    if (!data) return [];
    return data.medewerkers
      .map((mw) => ({ ...mw, totaal: mw.urenPerMaand.reduce((s, u) => s + u, 0) }))
      .filter((mw) => mw.totaal > 0)
      .sort((a, b) => b.totaal - a.totaal || a.naam.localeCompare(b.naam, "nl"));
  }, [data]);

  return (
    <div className="flex flex-col gap-4">
      {data && totaal ? (
        <SamenvattingRegel
          label={String(year)}
          delen={[
            totaal.beschikbaar > 0
              ? {
                  sterk: formatGetal(totaal.gepland),
                  staart: ` van ${formatGetal(totaal.beschikbaar)} uur gepland`,
                }
              : { sterk: formatGetal(totaal.gepland), staart: " uur gepland" },
            ...(totaal.pct !== null ? [{ sterk: `${totaal.pct}%`, staart: " bezet" }] : []),
            {
              sterk: formatGetal(data.totaalMedewerkers),
              staart: data.totaalMedewerkers === 1 ? " actieve medewerker" : " actieve medewerkers",
            },
          ]}
        />
      ) : (
        <Skeleton className="h-[22px] w-72" />
      )}

      <PeriodeWerkbalk
        titel={String(year)}
        vorigeLabel="Vorig jaar"
        volgendeLabel="Volgend jaar"
        vandaagLabel="Dit jaar"
        onVorige={() => setYear(year - 1)}
        onVolgende={() => setYear(year + 1)}
        onVandaag={() => setYear(now.getFullYear())}
      />

      <SectiePaneel
        titel="Bezetting per maand"
        kopbalk
        acties={
          onNavigateToMonth ? (
            <span className="truncate text-[13px] text-muted-foreground">
              klik een maand om de kalender te openen
            </span>
          ) : undefined
        }
      >
        <div className="grid grid-cols-3 gap-0.5 p-1.5 @md/sectie:grid-cols-4 @2xl/sectie:grid-cols-6 @5xl/sectie:grid-cols-12">
          {data === undefined
            ? Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="flex flex-col gap-1.5 p-2.5">
                  <Skeleton className="h-3.5 w-8" />
                  <Skeleton className="h-5 w-10" />
                  <Skeleton className="h-1 w-full" />
                  <Skeleton className="h-3 w-16" />
                </div>
              ))
            : data.maanden.map((maand) => {
                const isNu = isHuidigJaar && maand.maand === huidigeMaand;
                const heeftWerk = maand.geplandeUren > 0;
                const kort = MAAND_KORT[maand.maand - 1];
                const sub = heeftWerk
                  ? `${formatGetal(maand.geplandeUren)} u · ${formatGetal(maand.aantalProjecten)} proj.`
                  : `0 / ${formatGetal(maand.beschikbareUren)} u`;
                const label = heeftWerk
                  ? `${MAAND_NAMEN[maand.maand - 1]} ${year}${isNu ? " (deze maand)" : ""}: ${maand.bezetting}% bezet, ${formatGetal(maand.geplandeUren)} van ${formatGetal(maand.beschikbareUren)} uur, ${telwoord(maand.aantalProjecten, "project", "projecten")}`
                  : `${MAAND_NAMEN[maand.maand - 1]} ${year}${isNu ? " (deze maand)" : ""}: nog niets gepland`;
                const inhoud = (
                  <>
                    <span
                      className={cn(
                        "text-xs text-muted-foreground",
                        isNu && "font-semibold text-primary"
                      )}
                    >
                      {isNu ? `${kort} · nu` : kort}
                    </span>
                    <span
                      className={cn(
                        "text-lg leading-tight font-semibold tabular-nums",
                        !heeftWerk && "font-normal text-muted-foreground/70"
                      )}
                    >
                      {heeftWerk ? `${maand.bezetting}%` : "—"}
                    </span>
                    <BezettingBalk pct={heeftWerk ? maand.bezetting : 0} />
                    <span className="truncate text-[11px] tabular-nums text-muted-foreground">
                      {sub}
                    </span>
                  </>
                );
                const klasse = cn(
                  "flex min-w-0 flex-col gap-1.5 rounded-md p-2.5 text-left",
                  isNu && NU_MARKERING
                );
                return onNavigateToMonth ? (
                  <button
                    key={maand.maand}
                    type="button"
                    onClick={() => onNavigateToMonth(year, maand.maand)}
                    aria-label={`${label}. Open de maandkalender`}
                    className={cn(
                      klasse,
                      "transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    )}
                  >
                    {inhoud}
                  </button>
                ) : (
                  <div key={maand.maand} className={klasse}>
                    {inhoud}
                  </div>
                );
              })}
        </div>
      </SectiePaneel>

      {data === undefined ? (
        <SectiePaneel titel="Uren per medewerker" kopbalk>
          <div className="space-y-1.5 p-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-7" />
            ))}
          </div>
        </SectiePaneel>
      ) : medewerkers.length === 0 ? (
        <SectiePaneel
          titel="Uren per medewerker"
          kopbalk
          legeRegel={{ tekst: `Nog geen geplande uren in ${year}.` }}
        />
      ) : (
        <SectiePaneel
          titel="Uren per medewerker"
          kopbalk
          acties={
            <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
              minder
              {WARMTE.map((stap) => (
                <span
                  key={stap.label}
                  title={stap.label}
                  aria-hidden
                  className={cn("h-2.5 w-3.5 rounded-[3px]", stap.klasse)}
                />
              ))}
              meer
              <span className="sr-only">
                : {WARMTE.map((stap) => stap.label).join(", ")}
              </span>
            </span>
          }
        >
          <p className="px-3.5 pt-3 text-[13px] text-muted-foreground tabular-nums">
            {formatGetal(medewerkers.length)} van {formatGetal(data.totaalMedewerkers)} medewerkers
            hebben in {year} geplande uren
          </p>
          <div className="px-2 pt-1 pb-2.5">
            <table className="w-full table-fixed border-separate border-spacing-[3px] tabular-nums">
              <thead>
                <tr>
                  <th
                    scope="col"
                    className="w-24 py-1 ps-1.5 text-start text-[11px] font-medium text-muted-foreground @3xl/sectie:w-40"
                  >
                    Medewerker
                  </th>
                  {MAAND_KORT.map((naam) => (
                    <th
                      key={naam}
                      scope="col"
                      className="py-1 text-center text-[11px] font-medium text-muted-foreground"
                    >
                      <span aria-hidden className="@xl/sectie:hidden">
                        {naam.charAt(0)}
                      </span>
                      <span className="sr-only @xl/sectie:not-sr-only">{naam}</span>
                    </th>
                  ))}
                  <th
                    scope="col"
                    className="w-14 py-1 pe-1.5 text-end text-[11px] font-medium text-muted-foreground @xl/sectie:w-16"
                  >
                    Totaal
                  </th>
                </tr>
              </thead>
              <tbody>
                {medewerkers.map((mw) => (
                  <tr key={mw.medewerkerId}>
                    <th
                      scope="row"
                      title={mw.naam}
                      className="truncate ps-1.5 text-start text-[13px] font-medium"
                    >
                      {mw.naam}
                    </th>
                    {mw.urenPerMaand.map((uren, idx) => (
                      <td
                        key={idx}
                        className={cn(
                          "h-[30px] rounded-[5px] text-center text-xs",
                          uren > 0 ? warmteKlasse(uren) : "bg-muted/50"
                        )}
                      >
                        {uren > 0 && (
                          // Smal: alleen de tint, het getal blijft voorleesbaar.
                          <span className="sr-only @xl/sectie:not-sr-only">
                            {formatGetal(uren)}
                            <span className="sr-only"> uur in {MAAND_NAMEN[idx].toLowerCase()}</span>
                          </span>
                        )}
                      </td>
                    ))}
                    <td className="pe-1.5 text-end text-[13px] font-semibold whitespace-nowrap">
                      {formatGetal(mw.totaal)} u
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.totaalMedewerkers > 0 && (
            <p className="px-3.5 pb-3 text-xs text-muted-foreground">
              Beschikbaar ={" "}
              {telwoord(data.totaalMedewerkers, "actieve medewerker", "actieve medewerkers")} ×{" "}
              {UREN_PER_DAG} uur per werkdag, zonder weekenden. Gesorteerd op totaal.
            </p>
          )}
        </SectiePaneel>
      )}

      {data && medewerkers.length === 0 && data.totaalMedewerkers > 0 && (
        <p className="text-xs text-muted-foreground">
          Beschikbaar = {telwoord(data.totaalMedewerkers, "actieve medewerker", "actieve medewerkers")}{" "}
          × {UREN_PER_DAG} uur per werkdag, zonder weekenden.
        </p>
      )}
    </div>
  );
}
