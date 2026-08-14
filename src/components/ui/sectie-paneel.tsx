"use client";

import type { ReactNode } from "react";
import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Sectiepaneel voor werkschermen. Bewust géén <Card>: die brengt een eigen
 * kop-, padding- en schaduwlaag mee, en meerdere Cards onder elkaar lezen als
 * losse eilanden. Eén rand met een klein kopje houdt een dossier rustig.
 *
 * Spiegelt de lokale `Paneel` op de klantdetailpagina, zodat de hoofdkolom en
 * de rechterkolom dezelfde taal spreken.
 */
export function SectiePaneel({
  titel,
  icoon,
  telling,
  uitleg,
  acties,
  children,
  className,
}: {
  titel: string;
  icoon?: ReactNode;
  /** Klein getal rechts van de titel (open taken, aantal entries). */
  telling?: number;
  /**
   * Waar deze sectie voor is. Hangt achter een info-icoon in de kop in plaats
   * van als alinea in beeld te staan: uitleg lees je één keer, daarna is het
   * ruimte die je elke dag kwijt bent.
   */
  uitleg?: ReactNode;
  /** Compacte knoppen/filters rechts in de kop. */
  acties?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    // @container: de sectie staat in een smalle kolom, niet in de viewport —
    // breakpoints moeten dus op de containerbreedte reageren, niet op het scherm.
    <section
      className={cn(
        "@container/sectie overflow-hidden rounded-lg border bg-card",
        className
      )}
    >
      <header className="flex items-center gap-2 border-b px-3 py-2">
        {icoon && (
          <span className="shrink-0 text-muted-foreground [&>svg]:size-3.5">
            {icoon}
          </span>
        )}
        <h2 className="shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {titel}
        </h2>
        {typeof telling === "number" && telling > 0 && (
          <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
            {telling}
          </span>
        )}
        {uitleg && (
          <Tooltip>
            {/* asChild: de trigger moet de knop zijn, niet een extra span —
                anders is de uitleg niet met Tab te bereiken. */}
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={`Wat is ${titel.toLowerCase()}?`}
                className="shrink-0 rounded text-muted-foreground/70 transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <Info className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-[36ch] text-pretty">
              {uitleg}
            </TooltipContent>
          </Tooltip>
        )}
        {acties && (
          <div className="ml-auto flex min-w-0 items-center gap-1">{acties}</div>
        )}
      </header>
      {children}
    </section>
  );
}

/**
 * Lege staat: één regel, meer niet. De uitleg over waar de sectie voor dient
 * hoort in de `uitleg`-tooltip van `SectiePaneel` — die lees je één keer,
 * terwijl een alinea in beeld elke dag ruimte kost.
 */
export function SectieLegeStaat({ tekst }: { tekst: string }) {
  return (
    <p className="px-3 py-3 text-xs text-muted-foreground">{tekst}</p>
  );
}
