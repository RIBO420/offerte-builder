"use client"

import { cn } from "@/lib/utils"

import { type Capaciteit, CAPACITEIT_CONFIG } from "./types"

// ---------------------------------------------------------------------------
// Legenda – kleurlegenda voor beschikbaarheidsindicatoren
// ---------------------------------------------------------------------------

export function Legenda() {
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
