"use client";

import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { beschrijvingNaarBlokken } from "@/components/pdf/beschrijving-blokken";

/**
 * Info-icoon naast de artikelnaam in het prijsboek: hover of focus (Tab)
 * toont de volledige beschrijving, opgemaakt zoals op de PDF (zelfde
 * beschrijvingNaarBlokken: regeleinden behouden, opsommingen). Lange HERO-teksten
 * (tot ~4.000 tekens) scrollen verticaal binnen de tooltip, nooit zijwaarts.
 */
export function ArtikelBeschrijvingTip({
  naam,
  tekst,
}: {
  naam: string;
  tekst: string | undefined;
}) {
  const blokken = beschrijvingNaarBlokken(tekst);
  if (blokken.length === 0) return null;

  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`Beschrijving van ${naam}`}
          className="ml-1 inline-grid size-6 place-items-center rounded-sm align-middle text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Info className="size-3.5" aria-hidden />
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="bottom"
        align="start"
        collisionPadding={16}
        className="max-h-[min(24rem,60vh)] max-w-[min(26rem,calc(100vw-2rem))] space-y-1.5 overflow-y-auto overflow-x-hidden px-3.5 py-2.5 text-left text-xs leading-relaxed font-normal break-words text-pretty"
      >
        {blokken.map((blok, i) =>
          blok.soort === "alinea" ? (
            <p key={i} className="whitespace-pre-line">
              {blok.regels.join("\n")}
            </p>
          ) : (
            <ul key={i} className="list-disc space-y-0.5 pl-4">
              {blok.punten.map((punt, j) => (
                <li key={j}>{punt}</li>
              ))}
            </ul>
          )
        )}
      </TooltipContent>
    </Tooltip>
  );
}
