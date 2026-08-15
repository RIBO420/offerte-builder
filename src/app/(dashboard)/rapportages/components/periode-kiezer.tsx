"use client";

/**
 * R5 — de eerlijke periodekiezer.
 *
 * De oude kiezer bood elf opties die de client op vier echte presets terugmapte:
 * "Vorig jaar" liet bewijsbaar exact dezelfde cijfers zien als "Dit jaar", en
 * "Deze week" toonde de hele maand. Hier staan uitsluitend presets die
 * `convex/lib/rapportagePeriode.ts` kent — elk met een echte begin- en
 * eindgrens en twee echte vergelijkingsperiodes.
 *
 * De vergelijk-toggle is weg. Vergelijken is geen instelling meer: sectie 1
 * toont altijd beide vergelijkingen, met echte `verschil`-velden die `null`
 * zijn als er geen basis is.
 *
 * Het label op de knop komt van de server (`periode.label`), niet uit een
 * tweede tabel hier. Zo kan de knop nooit iets anders beweren dan de cijfers.
 */

import { useState } from "react";
import { CalendarDays, CalendarRange, Check, ChevronDown } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { nl } from "@/lib/date-locale";
import { cn } from "@/lib/utils";
import {
  PERIODE_GROEPEN,
  periodePresetLabel,
  type PeriodePreset,
} from "@/lib/rapportage-labels";

export interface AangepastBereik {
  van: number;
  tot: number;
}

export function PeriodeKiezer({
  preset,
  /** Het label zoals de server de periode noemt: "Augustus 2026", "Zomer 2026". */
  periodeLabel,
  aangepast,
  onKies,
}: {
  preset: PeriodePreset;
  periodeLabel?: string;
  aangepast?: AangepastBereik;
  onKies: (preset: PeriodePreset, bereik?: AangepastBereik) => void;
}) {
  const [open, setOpen] = useState(false);
  const [toonKalender, setToonKalender] = useState(preset === "aangepast");
  const [bereik, setBereik] = useState<DateRange | undefined>(
    aangepast
      ? { from: new Date(aangepast.van), to: new Date(aangepast.tot - 1) }
      : undefined
  );

  const kies = (nieuw: PeriodePreset) => {
    setToonKalender(false);
    onKies(nieuw);
    setOpen(false);
  };

  const bevestigBereik = () => {
    if (!bereik?.from || !bereik?.to) return;
    const van = new Date(
      bereik.from.getFullYear(),
      bereik.from.getMonth(),
      bereik.from.getDate()
    ).getTime();
    // Half-open venster, net als op de server: tot en met de gekozen dag.
    const tot = new Date(
      bereik.to.getFullYear(),
      bereik.to.getMonth(),
      bereik.to.getDate() + 1
    ).getTime();
    onKies("aangepast", { van, tot });
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-2 font-normal"
          aria-label={`Periode: ${periodeLabel ?? periodePresetLabel(preset)}`}
        >
          <CalendarDays className="size-3.5 text-muted-foreground" />
          <span className="max-w-[16ch] truncate">
            {periodeLabel ?? periodePresetLabel(preset)}
          </span>
          <ChevronDown
            className={cn(
              "size-3.5 text-muted-foreground transition-transform duration-200",
              open && "rotate-180"
            )}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto p-0">
        <div className="flex">
          <div className="min-w-[13rem] space-y-3 p-2.5">
            {PERIODE_GROEPEN.map((groep) => (
              <div key={groep.kop}>
                <p className="px-2 pb-1 text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
                  {groep.kop}
                </p>
                <div className="space-y-0.5">
                  {groep.presets.map((optie) => (
                    <button
                      key={optie}
                      type="button"
                      onClick={() => kies(optie)}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                        preset === optie && !toonKalender
                          ? "bg-muted font-medium text-foreground"
                          : "hover:bg-muted/60"
                      )}
                    >
                      {periodePresetLabel(optie)}
                      {preset === optie && !toonKalender && (
                        <Check className="size-3.5 text-primary" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            <Separator />

            <div className="space-y-0.5">
              <button
                type="button"
                onClick={() => kies("alles")}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                  preset === "alles" && !toonKalender
                    ? "bg-muted font-medium text-foreground"
                    : "hover:bg-muted/60"
                )}
              >
                {periodePresetLabel("alles")}
                {preset === "alles" && !toonKalender && (
                  <Check className="size-3.5 text-primary" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setToonKalender((t) => !t)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                  toonKalender
                    ? "bg-muted font-medium text-foreground"
                    : "hover:bg-muted/60"
                )}
              >
                <CalendarRange className="size-3.5" />
                {periodePresetLabel("aangepast")}
              </button>
            </div>
          </div>

          {toonKalender && (
            <div className="border-l p-2.5">
              <Calendar
                mode="range"
                selected={bereik}
                onSelect={setBereik}
                numberOfMonths={2}
                locale={nl}
                disabled={(datum) => datum > new Date()}
                className="rounded-md"
              />
              <div className="mt-2 flex items-center justify-end gap-2">
                <Button
                  size="sm"
                  disabled={!bereik?.from || !bereik?.to}
                  onClick={bevestigBereik}
                >
                  Toepassen
                </Button>
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
