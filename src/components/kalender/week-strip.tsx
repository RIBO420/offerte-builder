"use client"

import * as React from "react"
import { Clock, CheckCircle2 } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

import {
  type BeschikbaarheidItem,
  CAPACITEIT_CONFIG,
  datumNaarIso,
  formateerDatumKort,
} from "./types"

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

export function WeekStrip({
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
