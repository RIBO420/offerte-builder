"use client"

import * as React from "react"
import { DayPicker, getDefaultClassNames } from "react-day-picker"
import { nl } from "@/lib/date-locale"
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"

import {
  type BeschikbaarheidsKalenderProps,
  datumNaarIso,
  formateerDatumVolledig,
  useBeschikbaarheid,
} from "./types"
import { WeekStrip } from "./week-strip"
import { Legenda } from "./legenda"
import { GekleurdeKalenderDag } from "./gekleurde-kalender-dag"

// ---------------------------------------------------------------------------
// Hoofd-component: BeschikbaarheidsKalender
// ---------------------------------------------------------------------------

export function BeschikbaarheidsKalender({
  beschikbaarheid,
  onDatumSelect,
  selectedDatum,
  minDatum,
  maxDatum,
  mode = "selectie",
  geblokkeerdeDagen = [0, 6],
  className,
}: BeschikbaarheidsKalenderProps) {
  // Demo-data fallback via hook (stabiel door useMemo binnenin de hook)
  const demoBeschikbaarheid = useBeschikbaarheid()
  const effectieveBeschikbaarheid = beschikbaarheid ?? demoBeschikbaarheid

  // Datum-grenzen
  const vandaag = React.useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const effectiefMin = React.useMemo(() => {
    if (minDatum) return minDatum
    const morgen = new Date(vandaag)
    morgen.setDate(morgen.getDate() + 1)
    return morgen
  }, [minDatum, vandaag])

  const effectiefMax = React.useMemo(() => {
    if (maxDatum) return maxDatum
    const drieMananden = new Date(vandaag)
    drieMananden.setMonth(drieMananden.getMonth() + 3)
    return drieMananden
  }, [maxDatum, vandaag])

  // Maand-navigatie
  const [huidigeMaand, setHuidigeMaand] = React.useState<Date>(() => {
    const d = new Date(effectiefMin)
    d.setDate(1)
    return d
  })

  // Bouw lookup-map op
  const beschikbaarheidMap = React.useMemo(() => {
    const map = new Map<string, (typeof effectieveBeschikbaarheid)[number]>()
    for (const item of effectieveBeschikbaarheid) {
      map.set(item.datum, item)
    }
    return map
  }, [effectieveBeschikbaarheid])

  // Uitgeschakelde datums voor DayPicker
  const isDisabled = React.useCallback(
    (dag: Date): boolean => {
      dag = new Date(dag)
      dag.setHours(0, 0, 0, 0)

      if (dag < effectiefMin) return true
      if (dag > effectiefMax) return true
      if (geblokkeerdeDagen.includes(dag.getDay())) return true

      const iso = datumNaarIso(dag)
      const item = beschikbaarheidMap.get(iso)
      if (item?.capaciteit === "vol") return true

      return false
    },
    [effectiefMin, effectiefMax, geblokkeerdeDagen, beschikbaarheidMap]
  )

  // Maand navigatie guards
  const kanVorigeManand = React.useMemo(() => {
    const vorigeStart = new Date(
      huidigeMaand.getFullYear(),
      huidigeMaand.getMonth() - 1,
      1
    )
    const minStart = new Date(
      effectiefMin.getFullYear(),
      effectiefMin.getMonth(),
      1
    )
    return vorigeStart >= minStart
  }, [huidigeMaand, effectiefMin])

  const kanVolgendeMaand = React.useMemo(() => {
    const volgendeStart = new Date(
      huidigeMaand.getFullYear(),
      huidigeMaand.getMonth() + 1,
      1
    )
    const maxStart = new Date(
      effectiefMax.getFullYear(),
      effectiefMax.getMonth(),
      1
    )
    return volgendeStart <= maxStart
  }, [huidigeMaand, effectiefMax])

  const naarVorigeMaand = () => {
    if (!kanVorigeManand) return
    setHuidigeMaand(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
    )
  }

  const naarVolgendeMaand = () => {
    if (!kanVolgendeMaand) return
    setHuidigeMaand(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
    )
  }

  const geselecteerdIso = selectedDatum
    ? datumNaarIso(selectedDatum)
    : undefined

  const defaultClassNames = getDefaultClassNames()

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="border-b pb-4">
        <div className="flex items-center gap-2">
          <CalendarDays className="size-5 text-primary" />
          <CardTitle className="text-base">
            {mode === "selectie"
              ? "Kies een startdatum"
              : "Beschikbaarheidsoverzicht"}
          </CardTitle>
        </div>
        {mode === "selectie" && (
          <p className="text-sm text-muted-foreground mt-1">
            Selecteer een beschikbare datum voor de start van uw project.
          </p>
        )}
      </CardHeader>

      <CardContent className="pt-4 space-y-5">
        {/* Geselecteerde datum badge */}
        {selectedDatum && (
          <div className="flex items-center gap-2">
            <Badge
              className={cn(
                "gap-1.5 px-3 py-1 text-sm font-medium",
                geselecteerdIso &&
                  beschikbaarheidMap.get(geselecteerdIso)?.capaciteit ===
                    "beschikbaar"
                  ? "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/40 dark:text-green-300 dark:border-green-700"
                  : geselecteerdIso &&
                      beschikbaarheidMap.get(geselecteerdIso)?.capaciteit ===
                        "beperkt"
                    ? "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700"
                    : "bg-secondary text-secondary-foreground"
              )}
              variant="outline"
            >
              <CheckCircle2 className="size-3.5" />
              {formateerDatumVolledig(selectedDatum)}
            </Badge>
          </div>
        )}

        {/* Layout: kalender + weekstrip */}
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:gap-8">
          {/* Kalender */}
          <div className="min-w-0">
            {/* Maand-header met eigen navigatie */}
            <div className="mb-3 flex items-center justify-between">
              <button
                type="button"
                onClick={naarVorigeMaand}
                aria-disabled={!kanVorigeManand}
                className={cn(
                  buttonVariants({ variant: "ghost" }),
                  "size-8 p-0",
                  !kanVorigeManand && "pointer-events-none opacity-60"
                )}
                aria-label="Vorige maand"
              >
                <ChevronLeft className="size-4" />
              </button>

              <span className="text-sm font-semibold capitalize">
                {huidigeMaand.toLocaleDateString("nl-NL", {
                  month: "long",
                  year: "numeric",
                })}
              </span>

              <button
                type="button"
                onClick={naarVolgendeMaand}
                aria-disabled={!kanVolgendeMaand}
                className={cn(
                  buttonVariants({ variant: "ghost" }),
                  "size-8 p-0",
                  !kanVolgendeMaand && "pointer-events-none opacity-60"
                )}
                aria-label="Volgende maand"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>

            <DayPicker
              mode="single"
              month={huidigeMaand}
              onMonthChange={setHuidigeMaand}
              selected={selectedDatum}
              onSelect={(dag) => {
                if (dag && onDatumSelect) onDatumSelect(dag)
              }}
              disabled={isDisabled}
              locale={nl}
              showOutsideDays={false}
              hideNavigation
              classNames={{
                root: cn("w-fit", defaultClassNames.root),
                months: cn(
                  "flex gap-4 flex-col md:flex-row relative",
                  defaultClassNames.months
                ),
                month: cn(
                  "flex flex-col w-full gap-3",
                  defaultClassNames.month
                ),
                month_caption: "hidden", // eigen maand-header hierboven
                nav: "hidden",
                table: "w-full border-collapse",
                weekdays: cn("flex", defaultClassNames.weekdays),
                weekday: cn(
                  "text-muted-foreground rounded-md flex-1 font-normal text-[0.75rem] select-none text-center pb-1",
                  defaultClassNames.weekday
                ),
                week: cn("flex w-full mt-1", defaultClassNames.week),
                day: cn(
                  "relative w-full h-full p-0 text-center [&:last-child[data-selected=true]_button]:rounded-r-md group/day aspect-square select-none",
                  defaultClassNames.day
                ),
                today: cn(
                  "font-semibold ring-1 ring-inset ring-border rounded-md",
                  defaultClassNames.today
                ),
                outside: cn(
                  "text-muted-foreground/60",
                  defaultClassNames.outside
                ),
                disabled: cn(
                  "text-muted-foreground/70",
                  defaultClassNames.disabled
                ),
                hidden: cn("invisible", defaultClassNames.hidden),
              }}
              components={{
                DayButton: (props) => (
                  <GekleurdeKalenderDag
                    {...props}
                    beschikbaarheidMap={beschikbaarheidMap}
                    geselecteerdIso={geselecteerdIso}
                  />
                ),
              }}
            />
          </div>

          {/* Scheidingslijn op desktop */}
          <div className="hidden lg:block w-px bg-border self-stretch" />

          {/* Week-overzicht strip */}
          <div className="flex-1 min-w-0">
            <WeekStrip
              beschikbaarheidMap={beschikbaarheidMap}
              geselecteerdDatum={selectedDatum}
              geblokkeerdeDagen={geblokkeerdeDagen}
              minDatum={effectiefMin}
              onDatumSelect={
                mode === "selectie" ? onDatumSelect : undefined
              }
            />
          </div>
        </div>

        {/* Legenda */}
        <div className="border-t pt-4">
          <Legenda />
        </div>
      </CardContent>
    </Card>
  )
}

export default BeschikbaarheidsKalender
