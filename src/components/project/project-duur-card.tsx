"use client";

/**
 * Zijkolom "Doorlooptijd" van de projectplanning (redesign okt 2026): het
 * aantal werkdagen groot, hoe dat getal ontstaat, een startdatum om de
 * oplevering uit te rekenen, en of het project al op het weekbord staat.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { addBusinessDays, isWeekend, parseISO, startOfDay } from "date-fns";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SectiePaneel } from "@/components/ui/sectie-paneel";
import { nl } from "@/lib/date-locale";
import { cn } from "@/lib/utils";
import { getal, heleWerkdagen } from "./project-cijfers";

interface ProjectDuurCardProps {
  /** Som van de geschatte dagen van alle taken. */
  totaalDagen: number;
  /** Som van de normuren van alle taken. */
  totaalUren: number;
  teamGrootte: number;
  effectieveUrenPerDag: number;
  startDatum: Date | null;
  onStartDatumChange: (date: Date | null) => void;
  /** Weekbord-planning van het werkitem (YYYY-MM-DD). */
  geplandeStart?: string;
  geplandeEind?: string;
  teamNaam?: string | null;
}

function wekenEnDagen(werkdagen: number): string | null {
  if (werkdagen < 5) return null;
  const weken = Math.floor(werkdagen / 5);
  const rest = werkdagen % 5;
  const w = `${weken} ${weken === 1 ? "week" : "weken"}`;
  return rest === 0 ? w : `${w} en ${rest} ${rest === 1 ? "dag" : "dagen"}`;
}

const kort = (d: Date) =>
  d.toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short" });
const dagKort = (d: Date) =>
  d.toLocaleDateString("nl-NL", { weekday: "short", day: "numeric" });
const lang = (d: Date) =>
  d.toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" });

/** "di 13 – do 15 okt", "di 30 sep – do 2 okt" of "di 13 okt". */
export function weekbordPeriode(start: string, eind?: string): string {
  const s = parseISO(start);
  if (!eind || eind === start) return kort(s);
  const e = parseISO(eind);
  const zelfdeMaand =
    s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear();
  return zelfdeMaand ? `${dagKort(s)} – ${kort(e)}` : `${kort(s)} – ${kort(e)}`;
}

export function ProjectDuurCard({
  totaalDagen,
  totaalUren,
  teamGrootte,
  effectieveUrenPerDag,
  startDatum,
  onStartDatumChange,
  geplandeStart,
  geplandeEind,
  teamNaam,
}: ProjectDuurCardProps) {
  const [kalenderOpen, setKalenderOpen] = useState(false);
  const werkdagen = heleWerkdagen(totaalDagen);
  const urenPerDag = teamGrootte * effectieveUrenPerDag;

  // Laatste werkdag: start telt als dag 1, weekenden tellen niet mee.
  const oplevering = useMemo(() => {
    if (!startDatum || werkdagen <= 0) return null;
    return addBusinessDays(startDatum, werkdagen - 1);
  }, [startDatum, werkdagen]);

  return (
    <SectiePaneel titel="Doorlooptijd" kopbalk>
      <div className="flex flex-col gap-3.5 p-4">
        {totaalUren > 0 ? (
          <div className="flex flex-col gap-1.5">
            <p className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
              <span className="font-display text-4xl leading-none font-semibold tabular-nums">
                {werkdagen}
              </span>
              <span className="text-[15px]">{werkdagen === 1 ? "werkdag" : "werkdagen"}</span>
              {wekenEnDagen(werkdagen) && (
                <span className="text-[13px] text-muted-foreground">
                  {wekenEnDagen(werkdagen)}
                </span>
              )}
            </p>
            {urenPerDag > 0 && (
              <p className="text-[13px] tabular-nums text-muted-foreground">
                {getal(totaalUren)} taakuren ÷ {getal(urenPerDag)} uur per dag ({teamGrootte}{" "}
                personen × {getal(effectieveUrenPerDag)} uur)
              </p>
            )}
          </div>
        ) : (
          <p className="text-[13px] text-muted-foreground">
            Voeg taken toe om de doorlooptijd uit te rekenen.
          </p>
        )}

        <div className="flex flex-col gap-1.5 border-t pt-3">
          <label htmlFor="startdatum" className="text-xs text-muted-foreground">
            Startdatum
          </label>
          <div className="flex items-center gap-2">
            <Popover open={kalenderOpen} onOpenChange={setKalenderOpen}>
              <PopoverTrigger asChild>
                <Button
                  id="startdatum"
                  variant="outline"
                  className={cn(
                    "min-w-0 flex-1 justify-start font-normal",
                    !startDatum && "text-muted-foreground"
                  )}
                >
                  <CalendarDays className="mr-2 size-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">
                    {startDatum ? kort(startDatum) : "Kies een datum"}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={startDatum ?? undefined}
                  onSelect={(date) => {
                    onStartDatumChange(date ?? null);
                    setKalenderOpen(false);
                  }}
                  disabled={(date) => date < startOfDay(new Date()) || isWeekend(date)}
                  initialFocus
                  locale={nl}
                />
              </PopoverContent>
            </Popover>
            {startDatum && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onStartDatumChange(null)}
                className="shrink-0 text-muted-foreground"
              >
                Wissen
              </Button>
            )}
          </div>
          <span className="text-xs text-muted-foreground">
            {oplevering ? (
              <>
                Oplevering rond <span className="font-medium text-foreground">{lang(oplevering)}</span>
              </>
            ) : (
              "Met een startdatum rekenen we de oplevering uit."
            )}
          </span>
        </div>

        <div className="flex items-center gap-2.5 rounded-md bg-muted px-3 py-2.5 text-[13px]">
          <CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          {geplandeStart ? (
            <>
              <span className="min-w-0 flex-1">
                Op het weekbord: {weekbordPeriode(geplandeStart, geplandeEind)}
                {teamNaam ? ` · ${teamNaam}` : ""}
              </span>
              <Link
                href={`/planning/weekbord?datum=${geplandeStart}`}
                className="shrink-0 font-medium text-primary hover:underline"
              >
                Bekijk →
              </Link>
            </>
          ) : (
            <>
              <span className="min-w-0 flex-1">Nog niet op het weekbord</span>
              <Link
                href="/planning/weekbord"
                className="shrink-0 font-medium text-primary hover:underline"
              >
                Inplannen →
              </Link>
            </>
          )}
        </div>
      </div>
    </SectiePaneel>
  );
}
