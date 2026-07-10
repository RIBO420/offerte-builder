"use client";

import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { MARGEFACTOR_TOELICHTING } from "../../../../convex/vrijeOfferteBerekening";

/**
 * (i)-toelichting bij het margeveld (PRD §2.5b, leermodus principe 6).
 * De tekst is de letterlijke PRD-tekst en leeft in de berekeningsmodule.
 */
export function MargefactorInfo() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label="Uitleg margefactor"
          className="inline-flex items-center text-muted-foreground hover:text-foreground"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <p>{MARGEFACTOR_TOELICHTING}</p>
      </TooltipContent>
    </Tooltip>
  );
}
