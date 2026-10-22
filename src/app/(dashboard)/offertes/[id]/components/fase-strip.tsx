"use client";

import { Fragment } from "react";
import { ArrowRight, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Fase } from "./offerte-voortgang";

const korteDatum = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short" });

/**
 * De fasestrip onder de kop: één regel, vinkjes voor wat gehaald is, de
 * volgende stap gemarkeerd. Vervangt de losse stepper-kaart.
 *
 * Nooit zijwaarts scrollen: de lijnen krimpen, en in een smalle container
 * vallen eerst de datums en dan de labels weg — behalve dat van de fase die nu
 * aan de beurt is (of de rode afwijzing). Het volledige label blijft voor
 * schermlezers in `sr-only` staan.
 */
export function FaseStrip({ fases }: { fases: Fase[] }) {
  return (
    <div className="@container/fase">
      <ol aria-label="Voortgang" className="flex min-w-0 items-center">
        {fases.map((fase, i) => {
          const nadruk = fase.staat === "nu" || fase.staat === "afgewezen";
          return (
            <Fragment key={fase.id}>
              {i > 0 && (
                <li
                  aria-hidden="true"
                  className={cn(
                    "mx-2 h-0.5 min-w-3 flex-1 rounded-full @2xl/fase:mx-3",
                    fase.staat === "klaar" ? "bg-primary" : "bg-border"
                  )}
                />
              )}
              <li
                className={cn(
                  "flex min-w-0 shrink-0 items-center gap-2 text-[13px] whitespace-nowrap",
                  nadruk || fase.staat === "klaar"
                    ? "text-foreground"
                    : "text-muted-foreground"
                )}
                aria-current={fase.staat === "nu" ? "step" : undefined}
              >
                <Bol staat={fase.staat} />
                <span
                  className={cn(
                    nadruk ? "font-semibold" : "sr-only @2xl/fase:not-sr-only",
                    fase.staat === "afgewezen" && "text-status-afgewezen-text"
                  )}
                >
                  {fase.label}
                  {fase.detail && (
                    <span className="font-normal text-muted-foreground"> · {fase.detail}</span>
                  )}
                </span>
                {fase.datum !== undefined && (
                  <span className="hidden text-xs text-muted-foreground tabular-nums @3xl/fase:inline">
                    · {korteDatum.format(new Date(fase.datum))}
                  </span>
                )}
              </li>
            </Fragment>
          );
        })}
      </ol>
    </div>
  );
}

function Bol({ staat }: { staat: Fase["staat"] }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid size-[22px] shrink-0 place-items-center rounded-full",
        staat === "klaar" && "bg-primary text-primary-foreground",
        staat === "nu" &&
          "bg-status-geaccepteerd text-status-geaccepteerd-text ring-1 ring-status-geaccepteerd-border ring-inset",
        staat === "afgewezen" &&
          "bg-status-afgewezen text-status-afgewezen-text ring-1 ring-status-afgewezen-border ring-inset",
        staat === "open" && "border border-dashed border-input"
      )}
    >
      {staat === "klaar" && <Check className="size-3" strokeWidth={3} />}
      {staat === "nu" && <ArrowRight className="size-3" strokeWidth={2.5} />}
      {staat === "afgewezen" && <X className="size-3" strokeWidth={3} />}
    </span>
  );
}
