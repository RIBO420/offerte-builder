"use client"

import * as React from "react"
import { getDefaultClassNames, type DayButton } from "react-day-picker"

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
} from "./types"

// ---------------------------------------------------------------------------
// GekleurdeKalenderDag – aangepaste DayButton met kleurcodering en tooltip
// ---------------------------------------------------------------------------

interface GekleurdeKalenderDagProps
  extends React.ComponentProps<typeof DayButton> {
  beschikbaarheidMap: Map<string, BeschikbaarheidItem>
  geselecteerdIso?: string
}

export function GekleurdeKalenderDag({
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
          ? "text-muted-foreground/70"
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
