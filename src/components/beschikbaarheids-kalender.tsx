"use client"

import * as React from "react"
import { DayPicker, getDefaultClassNames, type DayButton } from "react-day-picker"
import { nl } from "date-fns/locale"
import {
  CalendarDays,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { buttonVariants } from "@/components/ui/button"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Capaciteit = "vol" | "beperkt" | "beschikbaar"

interface BeschikbaarheidItem {
  datum: string // ISO date, e.g. "2026-03-15"
  capaciteit: Capaciteit
  opmerking?: string
}

interface BeschikbaarheidsKalenderProps {
  beschikbaarheid?: BeschikbaarheidItem[]
  onDatumSelect?: (datum: Date) => void
  selectedDatum?: Date
  minDatum?: Date
  maxDatum?: Date
  mode?: "selectie" | "overzicht"
  geblokkeerdeDagen?: number[]
  className?: string
}

// ---------------------------------------------------------------------------
// useBeschikbaarheid – mock-data hook (vervang later door Convex query)
// ---------------------------------------------------------------------------

export function useBeschikbaarheid(): BeschikbaarheidItem[] {
  return React.useMemo(() => {
    const items: BeschikbaarheidItem[] = []
    const vandaag = new Date()
    vandaag.setHours(0, 0, 0, 0)

    const eindDatum = new Date(vandaag)
    eindDatum.setMonth(eindDatum.getMonth() + 3)

    const capaciteiten: Capaciteit[] = [
      "beschikbaar",
      "beschikbaar",
      "beschikbaar",
      "beperkt",
      "beperkt",
      "vol",
    ]

    const opmerkingen: Record<Capaciteit, string[]> = {
      beschikbaar: [
        "Volledig team beschikbaar",
        "Ruime planning mogelijk",
        "Meerdere projecten starten",
      ],
      beperkt: [
        "Slechts 1 team beschikbaar",
        "Beperkte capaciteit, snel boeken",
        "Nog 2 plekken vrij",
      ],
      vol: [
        "Volledig volgeboekt",
        "Geen ruimte meer beschikbaar",
        "Alle teams ingepland",
      ],
    }

    const cursor = new Date(vandaag)
    cursor.setDate(cursor.getDate() + 1) // begin morgen

    while (cursor <= eindDatum) {
      const dagVanDeWeek = cursor.getDay()
      const isWeekend = dagVanDeWeek === 0 || dagVanDeWeek === 6

      if (!isWeekend) {
        const cap = capaciteiten[
          Math.floor(Math.random() * capaciteiten.length)
        ] as Capaciteit
        const opmerkingenVoorCap = opmerkingen[cap]
        const opmerking =
          Math.random() > 0.35
            ? opmerkingenVoorCap[
                Math.floor(Math.random() * opmerkingenVoorCap.length)
              ]
            : undefined

        items.push({
          datum: cursor.toISOString().split("T")[0],
          capaciteit: cap,
          opmerking,
        })
      }

      cursor.setDate(cursor.getDate() + 1)
    }

    return items
  }, [])
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isoNaarDatum(iso: string): Date {
  const [jaar, maand, dag] = iso.split("-").map(Number)
  return new Date(jaar, maand - 1, dag)
}

function datumNaarIso(datum: Date): string {
  const j = datum.getFullYear()
  const m = String(datum.getMonth() + 1).padStart(2, "0")
  const d = String(datum.getDate()).padStart(2, "0")
  return `${j}-${m}-${d}`
}

function formateerDatumKort(datum: Date): string {
  return datum.toLocaleDateString("nl-NL", {
    weekday: "short",
    day: "numeric",
    month: "short",
  })
}

function formateerDatumVolledig(datum: Date): string {
  return datum.toLocaleDateString("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

const CAPACITEIT_CONFIG: Record<
  Capaciteit,
  {
    dagKlasse: string
    stip: string
    label: string
    icon: React.ComponentType<{ className?: string }>
    ringKlasse: string
  }
> = {
  beschikbaar: {
    dagKlasse:
      "bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/40 dark:text-green-300 dark:hover:bg-green-900/60",
    stip: "bg-green-500",
    label: "Beschikbaar",
    icon: CheckCircle2,
    ringKlasse: "ring-2 ring-green-500 ring-offset-1",
  },
  beperkt: {
    dagKlasse:
      "bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:hover:bg-amber-900/60",
    stip: "bg-amber-500",
    label: "Beperkt beschikbaar",
    icon: AlertCircle,
    ringKlasse: "ring-2 ring-amber-500 ring-offset-1",
  },
  vol: {
    dagKlasse:
      "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 cursor-not-allowed opacity-70",
    stip: "bg-red-500",
    label: "Volledig bezet",
    icon: XCircle,
    ringKlasse: "ring-2 ring-red-500 ring-offset-1",
  },
}

// ---------------------------------------------------------------------------
// WeekStrip – compacte strip van de eerste 5 komende werkdagen
// ---------------------------------------------------------------------------

interface WeekStripProps {
  beschikbaarheidMap: Map<string, BeschikbaarheidItem>
  geselecteerdDatum?: Date
  geblokkeerdeDagen: number[]
  minDatum: Date
  onDatumSelect?: (datum: Date) => void
}

function WeekStrip({
  beschikbaarheidMap,
  geselecteerdDatum,
  geblokkeerdeDagen,
  minDatum,
  onDatumSelect,
}: WeekStripProps) {
  const werkdagen = React.useMemo(() => {
    const dagen: Date[] = []
    const cursor = new Date(minDatum)
    cursor.setHours(0, 0, 0, 0)

    while (dagen.length < 5) {
      const dag = cursor.getDay()
      if (!geblokkeerdeDagen.includes(dag)) {
        dagen.push(new Date(cursor))
      }
      cursor.setDate(cursor.getDate() + 1)
    }

    return dagen
  }, [minDatum, geblokkeerdeDagen])

  const eersteBeschikbaar = React.useMemo(() => {
    for (const dag of werkdagen) {
      const item = beschikbaarheidMap.get(datumNaarIso(dag))
      if (item && item.capaciteit !== "vol") return dag
    }
    return null
  }, [werkdagen, beschikbaarheidMap])

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Clock className="size-4" />
        <span>Komende werkdagen</span>
      </div>

      {eersteBeschikbaar && (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 px-3 py-2 text-sm">
          <CheckCircle2 className="size-4 text-green-600 dark:text-green-400 shrink-0" />
          <span className="text-green-800 dark:text-green-300">
            <span className="font-medium">Eerste beschikbare datum:</span>{" "}
            {formateerDatumKort(eersteBeschikbaar)}
          </span>
        </div>
      )}

      <div className="grid grid-cols-5 gap-1.5">
        {werkdagen.map((dag) => {
          const iso = datumNaarIso(dag)
          const item = beschikbaarheidMap.get(iso)
          const isGeselecteerd =
            geselecteerdDatum && datumNaarIso(geselecteerdDatum) === iso
          const isSelecteerbaar = item && item.capaciteit !== "vol"

          const config = item ? CAPACITEIT_CONFIG[item.capaciteit] : null

          return (
            <Tooltip key={iso}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => {
                    if (isSelecteerbaar && onDatumSelect) {
                      onDatumSelect(dag)
                    }
                  }}
                  disabled={!isSelecteerbaar}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-lg border p-2 text-center transition-all",
                    isSelecteerbaar
                      ? "cursor-pointer hover:shadow-sm"
                      : "cursor-not-allowed opacity-50",
                    isGeselecteerd
                      ? cn(
                          "border-transparent shadow-sm",
                          config?.ringKlasse
                        )
                      : "border-border",
                    config
                      ? config.dagKlasse
                      : "bg-muted/40 text-muted-foreground"
                  )}
                >
                  <span className="text-[10px] font-medium uppercase tracking-wide opacity-70">
                    {dag.toLocaleDateString("nl-NL", { weekday: "short" })}
                  </span>
                  <span className="text-base font-bold leading-none">
                    {dag.getDate()}
                  </span>
                  {config && (
                    <span
                      className={cn(
                        "size-1.5 rounded-full",
                        config.stip
                      )}
                    />
                  )}
                </button>
              </TooltipTrigger>
              {item?.opmerking && (
                <TooltipContent side="bottom">
                  {item.opmerking}
                </TooltipContent>
              )}
            </Tooltip>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Legenda
// ---------------------------------------------------------------------------

function Legenda() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
      {(["beschikbaar", "beperkt", "vol"] as Capaciteit[]).map((cap) => {
        const cfg = CAPACITEIT_CONFIG[cap]
        const Icon = cfg.icon
        return (
          <div key={cap} className="flex items-center gap-1.5">
            <span className={cn("size-2.5 rounded-full shrink-0", cfg.stip)} />
            <Icon className="size-3.5 opacity-70" />
            <span>{cfg.label}</span>
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Aangepaste DayButton met kleurcodering en tooltip
// ---------------------------------------------------------------------------

interface GekleurdeKalenderDagProps
  extends React.ComponentProps<typeof DayButton> {
  beschikbaarheidMap: Map<string, BeschikbaarheidItem>
  geselecteerdIso?: string
}

function GekleurdeKalenderDag({
  day,
  modifiers,
  onClick,
  beschikbaarheidMap,
  geselecteerdIso,
  className,
  ...rest
}: GekleurdeKalenderDagProps) {
  const defaultClassNames = getDefaultClassNames()
  const ref = React.useRef<HTMLButtonElement>(null)

  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus()
  }, [modifiers.focused])

  const iso = datumNaarIso(day.date)
  const item = beschikbaarheidMap.get(iso)
  const config = item ? CAPACITEIT_CONFIG[item.capaciteit] : null
  const isGeselecteerd = iso === geselecteerdIso
  const isVol = item?.capaciteit === "vol"
  const isDisabled = modifiers.disabled || isVol

  const button = (
    <button
      ref={ref}
      type="button"
      onClick={isDisabled ? undefined : onClick}
      data-day={day.date.toLocaleDateString()}
      aria-disabled={isDisabled}
      aria-pressed={isGeselecteerd}
      className={cn(
        // Basis-afmetingen gelijk aan CalendarDayButton uit calendar.tsx
        "flex aspect-square size-auto w-full min-w-[var(--cell-size)] items-center justify-center rounded-md text-sm transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        // Buiten-maand / disabled / verleden
        (modifiers.outside || modifiers.disabled) && !item
          ? "text-muted-foreground opacity-40"
          : "",
        // Kleur o.b.v. beschikbaarheid
        config && !modifiers.outside ? config.dagKlasse : "",
        // Geen beschikbaarheidsdata maar ook niet disabled: neutrale stijl
        !config && !modifiers.outside && !modifiers.disabled
          ? "text-muted-foreground hover:bg-accent"
          : "",
        // Vandaag (geen beschikbaarheidsdata)
        modifiers.today && !config ? "bg-accent text-accent-foreground font-semibold" : "",
        // Geselecteerde dag
        isGeselecteerd && config
          ? cn("font-bold shadow-sm border-transparent", config.ringKlasse)
          : "",
        // Vol = niet klikbaar
        isVol ? "pointer-events-none" : "",
        defaultClassNames.day,
        className
      )}
      {...rest}
    />
  )

  if (item?.opmerking && !isDisabled) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="top">{item.opmerking}</TooltipContent>
      </Tooltip>
    )
  }

  return button
}

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
    const map = new Map<string, BeschikbaarheidItem>()
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
                  !kanVorigeManand && "pointer-events-none opacity-40"
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
                  !kanVolgendeMaand && "pointer-events-none opacity-40"
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
                  "text-muted-foreground opacity-30",
                  defaultClassNames.outside
                ),
                disabled: cn(
                  "text-muted-foreground opacity-40",
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
